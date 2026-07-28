/**
 * Turn & Phase Manager (Foundation layer) — the battle's clock and referee.
 *
 * Implements: design/gdd/turn-and-phase-manager.md
 * Stories: production/epics/turn-phase-manager/story-001-core-phase-loop.md,
 *          production/epics/turn-phase-manager/story-002-phase-events.md
 * Governing ADRs: ADR-0002 (deterministic event bus), ADR-0006 (Combat
 *   `resolve()` as the single mutation path / interface inversion),
 *   ADR-0007 (snapshot-based undo = adoption, not board rollback — governs
 *   the undo SEAM this module owns; full undo/redo is Story 004, see below).
 *
 * Drives every battle through the fixed seven-phase ring
 * `TurnStart -> PlayerPhase -> Environment -> EnemyResolve -> Spawn ->
 * Telegraph -> EndCheck -> (TurnStart | Ended)`, identical every turn, no
 * reordering (GDD Core Rule 1/3). Depends only on the abstract contracts in
 * `turn-phase-contracts.ts` ({@link CombatResolver}, {@link EnemyDriver},
 * {@link EnvironmentDriver}, {@link ObjectiveEvaluator}) — never a concrete
 * Combat/Enemy/Objective implementation — so the dependency graph stays
 * acyclic (GDD Open Question #1). The manager never mutates Board tiles,
 * units, or HP directly; all mutation is delegated to the injected
 * {@link CombatResolver} (GDD Rule 8 ownership boundary).
 *
 * SCOPE NOTE (2026-07-28 correction): full undo/redo — a method that pops a
 * captured snapshot and *adopts* it as the new live board reference
 * (ADR-0007) — is "Story 004: In-Phase Undo/Redo"
 * (production/epics/turn-phase-manager/story-004-*), explicitly Out of
 * Scope for the two stories this module implements, and is deliberately
 * NOT implemented here. There is no `undo()`/`redo()` method on this class.
 *
 * What this module DOES own is the seam Story 004 builds undo/redo on top
 * of: a per-Player-Phase list of `Board.snapshot()`s (captured at
 * Player-Phase start and after each `applyAction()`), exposed read-only via
 * {@link getPlayerPhaseSnapshotCount}, and cleared when the Player Phase
 * commits (`endPlayerPhase()`) — bounding its memory to a single phase
 * (Formula F3). This list is never popped and never used to reassign the
 * live board; the live board is mutated only by the injected
 * {@link CombatResolver} (ADR-0006). There is also no `Board.restore()`
 * anywhere in this module, and none should ever be added (ADR-0007).
 */

import type { Board } from '../board/index.js';
import type { EventBus } from '../events/event-bus.js';
import type {
  CombatResolver,
  EffectPrimitive,
  EnemyDriver,
  EnvironmentDriver,
  EvaluationResult,
  ObjectiveConfig,
  ObjectiveEvaluator,
} from './turn-phase-contracts.js';
import { DEFAULT_TURN_PHASE_CONFIG, type TurnPhaseConfig } from './turn-phase-config.js';
import type { PhaseEventMap } from './turn-phase-events.js';
import type { BattleResult, BattleState, Phase } from './turn-phase-types.js';
import {
  TURN_OK,
  turnInvariant,
  turnReject,
  type ApplyActionResult,
  type TurnResult,
} from './turn-phase-result.js';

/** Dependencies injected into a {@link TurnPhaseManager} at construction (dependency injection over singletons — no module-level global). */
export interface TurnPhaseManagerDeps {
  /** The live board reference at battle start. This module never mutates this object in place itself and never reassigns the live-board reference at all (no undo/redo — see class doc comment); only the injected {@link CombatResolver} mutates it, per ADR-0006. */
  readonly board: Board;
  /** The shared synchronous phase-event bus (ADR-0002). Constructed and injected by the caller — this module holds no module-level singleton. */
  readonly eventBus: EventBus<PhaseEventMap>;
  readonly combat: CombatResolver;
  readonly enemy: EnemyDriver;
  readonly environment: EnvironmentDriver;
  readonly objective: ObjectiveEvaluator;
  /** Forwarded opaquely to every `objective.evaluate()` call; see {@link ObjectiveConfig}. */
  readonly objectiveConfig: ObjectiveConfig;
  /** Tuning knobs (GDD Tuning Knobs section). Any field not supplied falls back to {@link DEFAULT_TURN_PHASE_CONFIG}. */
  readonly config?: Partial<TurnPhaseConfig>;
}

export class TurnPhaseManager {
  private readonly deps: Omit<TurnPhaseManagerDeps, 'board' | 'config'>;
  private readonly config: TurnPhaseConfig;

  private liveBoard: Board;
  private battleState: BattleState = 'Setup';
  private phase: Phase | null = null;
  private turn = 0;
  private battleEndedEmitted = false;

  /**
   * Player-Phase snapshot list (the undo SEAM — see class doc comment).
   * Index 0 is always the phase-start snapshot while `phase === 'PlayerPhase'`;
   * empty in every other phase/state (GDD Rule 4). Never popped or adopted
   * by this module.
   */
  private playerPhaseSnapshots: Board[] = [];

  constructor(deps: TurnPhaseManagerDeps) {
    this.liveBoard = deps.board;
    this.deps = {
      eventBus: deps.eventBus,
      combat: deps.combat,
      enemy: deps.enemy,
      environment: deps.environment,
      objective: deps.objective,
      objectiveConfig: deps.objectiveConfig,
    };
    this.config = { ...DEFAULT_TURN_PHASE_CONFIG, ...(deps.config ?? {}) };
  }

  // ── Read-only accessors (GDD Rule 8: manager exposes turn/phase; HUD reads them) ──

  /** Current turn number, 1-indexed; `0` before {@link startBattle} has been called. */
  getCurrentTurn(): number {
    return this.turn;
  }

  /** Current phase within the ring, or `null` before {@link startBattle} / after the battle ends without ever having started a phase. */
  getCurrentPhase(): Phase | null {
    return this.phase;
  }

  getBattleState(): BattleState {
    return this.battleState;
  }

  /** The current live board reference. Its identity never changes across calls on this class (no undo/redo — see class doc comment); only its contents change, via the injected {@link CombatResolver}. */
  getBoard(): Board {
    return this.liveBoard;
  }

  /**
   * Number of entries on the Player-Phase snapshot list (Formula F2
   * `stackDepth`); `0` outside Player Phase. This is the undo SEAM's depth,
   * not an undo-capable stack — see class doc comment.
   */
  getPlayerPhaseSnapshotCount(): number {
    return this.playerPhaseSnapshots.length;
  }

  // ── Setup (GDD Rule 2) ───────────────────────────────────────────────────

  /**
   * Battle setup: computes and displays every enemy's and every active
   * environmental effect's Turn-1 telegraph, with zero player input and zero
   * RNG, then begins Turn 1 (`TurnStart` -> `PlayerPhase`). After this call
   * returns, `getCurrentTurn() === 1` and `getCurrentPhase() === 'PlayerPhase'`.
   *
   * Channel-2 guard: throws if called more than once (genuine programmer
   * error, not a legal gameplay input).
   */
  startBattle(): void {
    turnInvariant(this.battleState === 'Setup', 'startBattle() called after the battle already started');

    this.deps.environment.telegraphIntents(this.liveBoard);
    this.deps.enemy.chooseIntents(this.liveBoard);
    this.emitIntentsTelegraphed();

    this.battleState = 'InTurn';
    this.beginTurn();
  }

  // ── Player Phase ─────────────────────────────────────────────────────────

  /**
   * Applies a hero action's effects via the injected {@link CombatResolver}
   * — the ONE board-mutation path (ADR-0006) — and, once its full
   * consequence chain has resolved, records a snapshot on the undo SEAM
   * (ADR-0007 Rule 3 timing: captured after the full chain, never mid-chain).
   * Rejected outside Player Phase. Does not itself provide any way to undo
   * the action — see class doc comment.
   */
  applyAction(effects: readonly EffectPrimitive[]): ApplyActionResult {
    if (this.phase !== 'PlayerPhase') {
      return { ok: false, reason: 'NotPlayerPhase' };
    }
    const events = this.deps.combat.resolve(this.liveBoard, effects);
    this.playerPhaseSnapshots.push(this.liveBoard.snapshot());
    this.emit({ type: 'action_applied', turn: this.turn, stackDepth: this.playerPhaseSnapshots.length });
    return { ok: true, events };
  }

  /**
   * Explicit "End Turn": commits the Player Phase (Planning -> Committed,
   * the phase's only irreversible transition), clears the Player-Phase
   * snapshot list (bounding its memory to one phase, GDD Rule 4), then runs
   * the remaining system-driven phases (Environment -> EnemyResolve ->
   * Spawn -> Telegraph -> EndCheck) synchronously to completion, looping to
   * the next Turn Start or ending the battle. Rejected if not currently in
   * Player Phase.
   */
  endPlayerPhase(): TurnResult {
    if (this.phase !== 'PlayerPhase') return turnReject('NotPlayerPhase');
    this.playerPhaseSnapshots = [];
    this.runSystemPhases();
    return TURN_OK;
  }

  // ── Abandon (GDD Rule 6 / Edge Cases) ───────────────────────────────────

  /**
   * The player quits the run mid-battle. Emits `battle_ended(Abandon)`,
   * overriding any in-flight phase; no further phases run. Rejected if the
   * battle is not in progress, or while the `abandonEnabled` tuning knob is
   * `false`.
   */
  abandon(): TurnResult {
    if (this.battleState !== 'InTurn') return turnReject('BattleNotInProgress');
    if (!this.config.abandonEnabled) return turnReject('AbandonDisabled');
    this.endBattle('Abandon');
    return TURN_OK;
  }

  // ── Internal phase sequencing ────────────────────────────────────────────

  private runSystemPhases(): void {
    this.phase = 'Environment';
    this.deps.environment.resolveEnvironment(this.liveBoard);
    this.emit({ type: 'hazard_ticked', turn: this.turn });
    this.emit({ type: 'environment_resolved', turn: this.turn });
    if (this.checkEarlyDefeat()) return;

    this.phase = 'EnemyResolve';
    this.deps.enemy.resolveTelegraphed(this.liveBoard);
    this.emit({ type: 'enemy_action_resolved', turn: this.turn });
    if (this.checkEarlyDefeat()) return;

    this.phase = 'Spawn';
    this.deps.enemy.emergeSpawns(this.liveBoard);
    this.emit({ type: 'enemy_spawned', turn: this.turn });
    if (this.checkEarlyDefeat()) return;

    this.phase = 'Telegraph';
    this.deps.environment.telegraphIntents(this.liveBoard);
    this.deps.enemy.chooseIntents(this.liveBoard);
    this.emitIntentsTelegraphed();

    this.phase = 'EndCheck';
    const verdict = this.evaluateObjective();
    let result = verdict.result;
    // Hard turn cap: a manager-owned safety valve, applied ONLY at the
    // terminal EndCheck (never at an early lose-only check) — GDD Edge Cases.
    if (result === 'ongoing' && this.turn >= this.config.hardTurnCap) {
      result = 'defeat';
    }

    if (result === 'victory') {
      this.endBattle('Victory');
      return;
    }
    if (result === 'defeat') {
      this.endBattle('Defeat');
      return;
    }
    this.beginTurn();
  }

  /** Early defeat check (GDD Rule 7): lose-only. Returns `true` iff the battle just ended. */
  private checkEarlyDefeat(): boolean {
    const verdict = this.evaluateObjective();
    if (verdict.result === 'defeat') {
      this.endBattle('Defeat');
      return true;
    }
    return false;
  }

  private evaluateObjective(): EvaluationResult {
    return this.deps.objective.evaluate({ board: this.liveBoard }, this.turn, this.deps.objectiveConfig);
  }

  private beginTurn(): void {
    this.turn += 1;
    this.phase = 'TurnStart';
    this.emit({ type: 'turn_started', turn: this.turn });

    this.phase = 'PlayerPhase';
    this.playerPhaseSnapshots = [this.liveBoard.snapshot()];
    this.emit({ type: 'player_phase_begun', turn: this.turn });
  }

  /** `intents_telegraphed.turn` is the turn these intents apply to (the NEXT turn), per `IntentsTelegraphedEvent`'s doc comment. */
  private emitIntentsTelegraphed(): void {
    this.emit({ type: 'intents_telegraphed', turn: this.turn + 1 });
  }

  private endBattle(result: BattleResult): void {
    if (this.battleEndedEmitted) return; // GDD Rule 6: exactly one battle_ended per battle
    this.battleEndedEmitted = true;
    this.battleState = 'Ended';
    this.emit({ type: 'battle_ended', turn: this.turn, result });
  }

  private emit(event: PhaseEventMap[keyof PhaseEventMap]): void {
    this.deps.eventBus.emit(event);
  }
}
