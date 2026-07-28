/**
 * Turn & Phase Manager — abstract contracts for driven systems.
 *
 * Implements: design/gdd/turn-and-phase-manager.md Open Question #1
 * ("Interface inversion for the driven systems"). Combat Resolution, Enemy
 * Abilities & Telegraph, and Objective / Win-Lose are all listed in the GDD
 * as systems the manager *drives*, yet those systems also *consume* the
 * manager's phase signals — a potential dependency cycle. The GDD resolves
 * this by having the manager depend only on abstract contracts it defines
 * (this file), never a concrete implementation. Those systems implement
 * these contracts once built; none of them exist yet (only Board & Grid and
 * the Event Bus have landed — Wave 1), so this module owns the contract
 * shapes for now.
 */

import type { Board } from '../board/index.js';
import type { BusEvent } from '../events/event-bus.js';

/**
 * Opaque echo of ADR-0006's `EffectPrimitive` union discriminant. The Turn &
 * Phase Manager never branches on `kind` — it only forwards effects to
 * {@link CombatResolver.resolve}. Combat Resolution (src/core/combat/, not
 * yet implemented) owns the real closed 10-primitive vocabulary (registry
 * `combat_primitives`, design/registry/entities.yaml); once that module
 * exists, prefer importing its real `EffectPrimitive` union in place of this
 * local echo. Mirrors the scoping pattern documented in
 * src/core/board/board-result.ts's `RejectReason` doc comment.
 */
export interface EffectPrimitive {
  readonly kind: string;
}

/**
 * Abstract contract for Combat Resolution (ADR-0006: the single, exclusive
 * board-mutation path). `resolve()` is pure with respect to its inputs (no
 * RNG, no wall-clock) and never advances the turn or phase — "Combat never
 * calls back into Turn & Phase Manager" (control-manifest.md, Core layer,
 * Forbidden Approaches).
 */
export interface CombatResolver {
  resolve(board: Board, effects: readonly EffectPrimitive[]): readonly BusEvent[];
}

/**
 * Abstract contract for Enemy, Abilities & Telegraph (GDD "Interactions with
 * Other Systems"). All three methods must be deterministic (no RNG) — Pillar
 * #1 requires enemies reveal intent before the player acts, with the only
 * nondeterministic element in the whole battle being Player-Phase input.
 */
export interface EnemyDriver {
  /** Enemy Resolve phase: executes previously telegraphed enemy actions in Enemy's own deterministic resolution order. */
  resolveTelegraphed(board: Board): readonly BusEvent[];
  /** Spawn phase: emerges telegraphed enemy spawns onto their spawn tiles, in deterministic order. */
  emergeSpawns(board: Board): readonly BusEvent[];
  /** Telegraph phase (and Setup): chooses and displays every surviving enemy's intent for the NEXT turn. */
  chooseIntents(board: Board): void;
}

/**
 * Abstract contract for the environmental half of the Environment and
 * Telegraph phases.
 *
 * Judgment call: the GDD's Dependencies table names exactly three Hard
 * driven contracts — Combat Resolution, Enemy Abilities & Telegraph, and
 * Objective / Win-Lose — with no fourth "Environment" contract, even though
 * Core Rule 3 requires the Environment phase to resolve telegraphed
 * environmental effects and tick hazards, and Core Rule 2/Telegraph phase
 * both require environmental intents to be telegraphed exactly like enemy
 * intents. The GDD attributes environmental *content* ownership to "Combat
 * Resolution / Encounter Generator" but never names the calling contract the
 * manager should use to sequence it. This interface fills that gap,
 * symmetric with {@link EnemyDriver} — see the implementer's report for
 * the full reasoning; flagged for design/architecture confirmation.
 */
export interface EnvironmentDriver {
  /** Environment phase: resolves telegraphed environmental effects and ticks tile hazards. Always runs strictly before EnemyResolve (GDD Core Rule 3, environment-first regression guard). */
  resolveEnvironment(board: Board): readonly BusEvent[];
  /** Telegraph phase (and Setup): chooses and displays every active environmental effect's intent for the NEXT turn, alongside {@link EnemyDriver.chooseIntents}. */
  telegraphIntents(board: Board): void;
}

/** One of the three mutually-exclusive verdicts Objective's pure `evaluate()` can report at a check point (GDD Rule 7). */
export type ObjectiveResult = 'ongoing' | 'victory' | 'defeat';

/**
 * Pure, side-effect-free evaluation result. GDD Edge Cases: "the manager
 * treats Objective's single verdict as authoritative" — Defeat-over-Victory
 * precedence (GDD Edge Cases) is therefore Objective's responsibility to
 * encode into a single `result`, not something this manager reconciles from
 * two independent booleans.
 */
export interface EvaluationResult {
  readonly result: ObjectiveResult;
}

/**
 * The minimal view of battle state Objective's `evaluate()` needs. Kept
 * intentionally small — the manager does not know or care what Objective
 * reads from it beyond the live board reference.
 */
export interface BattleStateView {
  readonly board: Board;
}

/**
 * Opaque to the Turn & Phase Manager. GDD: "the manager holds no local
 * `max_turns` state — it reads it via the Objective interface" (ownership
 * boundary). The manager stores and forwards this reference to every
 * `evaluate()` call without ever reading or interpreting its fields;
 * Objective's implementation defines and owns the actual shape, including
 * `max_turns`.
 */
export type ObjectiveConfig = Readonly<Record<string, unknown>>;

/**
 * Abstract contract for Objective / Win-Lose. Pure and side-effect-free;
 * callable multiple times per turn — up to 4 (3 early lose-only checks + 1
 * terminal check, GDD Rule 7 / "Fixed structural counts").
 */
export interface ObjectiveEvaluator {
  evaluate(battleState: BattleStateView, turn: number, config: ObjectiveConfig): EvaluationResult;
}
