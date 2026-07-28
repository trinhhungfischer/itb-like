/**
 * Move Preview — silent, subscription-driven dry-run harness around Combat
 * Resolution (Core layer).
 *
 * Implements: design/gdd/move-preview.md Rules 1-8, 10-12; "States and
 * Transitions".
 * Stories: production/epics/move-preview/story-001-dry-run-mechanism.md,
 *          production/epics/move-preview/story-002-preview-lifecycle.md
 * Governing ADRs:
 *  - docs/architecture/adr-0007-snapshot-undo-preview.md (dry-run mechanism:
 *    `resolve(board.snapshot(), state.snapshot(), effects)`, silent via a
 *    private `EventBus`, never touches the undo stack)
 *  - docs/architecture/adr-0006-combat-resolve-single-mutation-path.md
 *    (reuses the identical `resolve()` entry point — never a second
 *    simulation)
 *  - docs/architecture/adr-0002-deterministic-event-bus.md (synchronous,
 *    registration-ordered subscription to Input & Selection's stream)
 *
 * NOT implemented here (out of scope, story-003):
 *  - Formula F3 telegraph threat cross-reference (`threatened` flags).
 *
 * ## Why `Stale` and `Committed` are momentary
 *
 * Every event this class reacts to — `hover`/`select`/`cancel`/`confirm` on
 * the injected `EventBus<SelectionEventMap>` — is dispatched synchronously
 * (ADR-0002); `resolve()` itself is synchronous (ADR-0006); there is no
 * async boundary anywhere in this path. Consequently a full GDD-table
 * cascade like `Ready -> Stale -> Computing -> Ready` triggered by one
 * `hover` event completes entirely within that single, synchronous handler
 * call — an external caller of `getLifecycleState()` can only ever observe
 * the *stable* state the cascade settles into (`Ready`, `Idle`, or, briefly
 * within the GDD's own words, "Stale... exists for testability... not as a
 * UI-visible state"). `tests/unit/move-preview/preview-lifecycle_test.ts`
 * exercises the full table directly against the pure
 * `transitionPreviewState` function in `preview-lifecycle.ts`, where every
 * intermediate state IS directly assertable.
 *
 * ## The board-mutation-without-a-new-hover gap (judgement call)
 *
 * **Flagged per this implementer's report instructions.** GDD Rule 4b
 * requires a `Ready` preview to go `Stale` when "the live board mutates —
 * an earlier action in the same Player Phase is committed or undone." Move
 * Preview's *only* subscribed signal is Input & Selection's four-event
 * stream (`hover`/`select`/`cancel`/`confirm`, Rule 1 — "it does not expose
 * a synchronous `preview()` entry point... this is a one-way, event-driven
 * relationship"). None of those four events fires for an **undo** — undo is
 * Turn & Phase Manager Story 004 ("In-Phase Undo/Redo"), which does not
 * exist under `src/` yet, and `SelectionEventMap` (`selection-events.ts`)
 * has no event for it at all. So a board mutated by undo, with no
 * intervening hover, is currently *unobservable* through the subscription
 * Rule 1 mandates as Move Preview's only input.
 *
 * Resolved here with an additive, explicitly-named escape hatch,
 * {@link MovePreview.notifyLiveBoardMutated}, that a future undo integration
 * (or any other out-of-band board mutator) calls to close the gap. This is
 * NOT a second entry point for forming a candidate (Rule 1 is unbroken — it
 * only ever *invalidates* an existing `Ready` result, exactly Rule 4b's
 * effect, and immediately re-runs the *same* dry run through the *same*
 * `resolve()` path); it is the seam Rule 4b's guarantee needs until Story
 * 004 lands and a real "board mutated" signal exists to wire it to. Flagged
 * for `lead-programmer`/`systems-designer` — the alternative (Move Preview
 * re-validating on every access rather than being notified) was rejected
 * because Rule 4 requires the *transition itself* to happen immediately, not
 * only be caught lazily on the next read.
 */

import type { Board } from '../board/board-interface.js';
import { EventBus } from '../events/event-bus.js';
import { resolve, CombatState } from '../combat/index.js';
import type { CombatEventMap, EffectPrimitive } from '../combat/index.js';
import type { CancelEvent, ConfirmEvent, HoverEvent, SelectEvent, SelectionEventMap } from '../input/selection-events.js';
import type { ActionMode } from '../input/selection-types.js';
import type { Phase } from '../turn/turn-phase-types.js';
import type { EffectCompiler } from './preview-ports.js';
import { transitionPreviewState } from './preview-lifecycle.js';
import type { PreviewCandidate, PreviewLifecycleState, PreviewResult } from './preview-types.js';

/**
 * Dependencies injected into a {@link MovePreview} at construction
 * (dependency injection over singletons, matching `SelectionStateMachine`'s
 * and `TurnPhaseManager`'s established pattern).
 *
 * `board`/`state` are the LIVE references — fixed identity across this
 * class's lifetime (mirroring `SelectionDeps.board`'s documented behavior);
 * only their *contents* change, via Combat Resolution's `resolve()` on the
 * commit path this class never calls directly. `MovePreview` only ever
 * calls `.snapshot()` on them, never a mutation method.
 */
export interface MovePreviewDeps {
  readonly board: Board;
  readonly state: CombatState;
  /** Input & Selection's shared, synchronous selection-event bus (ADR-0002). Move Preview subscribes to it in the constructor and never emits onto it — Rule 1's one-way relationship. */
  readonly selectionBus: EventBus<SelectionEventMap>;
  /** Stands in for Heroes & Abilities' `compileEffects()` — see `preview-ports.ts`'s doc comment for why this seam exists. */
  readonly effectCompiler: EffectCompiler;
  /** Turn & Phase Manager's `getCurrentPhase()` — the Player-Phase gate (Rule 11). Queried fresh on every hover, never cached (matches `SelectionDeps.getCurrentPhase`'s own live-query contract). */
  readonly getCurrentPhase: () => Phase | null;
}

function sameMode(a: ActionMode, b: ActionMode): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind === 'Ability' && b.kind === 'Ability' ? a.abilityId === b.abilityId : true;
}

function sameCandidate(a: PreviewCandidate, b: PreviewCandidate): boolean {
  return a.unitId === b.unitId && a.target.col === b.target.col && a.target.row === b.target.row && sameMode(a.mode, b.mode);
}

/**
 * The Move Preview module (Core layer). Construct one instance per battle,
 * injecting the same `board`/`state` the live commit path (Turn & Phase
 * Manager / Combat Resolution) uses, and the battle's shared
 * `EventBus<SelectionEventMap>` — never a private copy of either, and never
 * a second board/state pair.
 */
export class MovePreview {
  private lifecycle: PreviewLifecycleState = 'Idle';
  private candidate: PreviewCandidate | null = null;
  private result: PreviewResult | null = null;

  constructor(private readonly deps: MovePreviewDeps) {
    deps.selectionBus.on('hover', (e) => this.onHover(e));
    deps.selectionBus.on('select', (e) => this.onSelectOrCancel(e));
    deps.selectionBus.on('cancel', (e) => this.onSelectOrCancel(e));
    deps.selectionBus.on('confirm', (e) => this.onConfirm(e));
  }

  /** The current stable lifecycle state (GDD "States and Transitions" — see class doc comment for why only stable states are ever observable here). */
  getLifecycleState(): PreviewLifecycleState {
    return this.lifecycle;
  }

  /** The current preview result, or `null` if none is `Ready` right now. Downstream consumers (Battle HUD, Board Rendering & Juice) must treat a `null` result exactly as Rule 10 requires: confirm unavailable, never "confirm blind." */
  getResult(): PreviewResult | null {
    return this.lifecycle === 'Ready' ? this.result : null;
  }

  /** `true` iff a `Ready` preview exists right now — the fail-safe signal Rule 10's confirm-affordance gating reads. */
  isReady(): boolean {
    return this.lifecycle === 'Ready';
  }

  /**
   * Notifies Move Preview that the live board changed by a source outside
   * its own `hover`/`select`/`cancel`/`confirm` subscription (e.g. a future
   * undo). See this file's class doc comment ("board-mutation-without-a-
   * new-hover gap") for why this exists. A no-op unless a `Ready` preview is
   * currently displayed; when one is, it goes `Stale` and is immediately
   * recomputed against the same tracked candidate over the now-current live
   * board (Rule 4b's "immediate recompute").
   */
  notifyLiveBoardMutated(): void {
    if (this.lifecycle !== 'Ready' || this.candidate === null) return;
    this.lifecycle = transitionPreviewState(this.lifecycle, { type: 'board_mutated' });
    this.recomputeCurrentCandidate();
  }

  // ── Subscription handlers (Rule 1: one-way, event-driven; never emits) ──

  private onHover(e: HoverEvent): void {
    if (!this.isPlayerPhase()) {
      // Rule 11 / defensive Edge Case: "rejected — Move Preview computes
      // nothing and remains Idle." Input & Selection should already gate
      // this; this branch is defensive.
      this.forceIdle();
      return;
    }

    const candidate: PreviewCandidate = { unitId: e.unitId, mode: e.mode, target: e.tile };

    // Rule 5: legality is never Move Preview's to decide. Compile FIRST,
    // before touching lifecycle at all — an illegal target must leave any
    // existing preview completely undisturbed ("simply never invoked").
    const effects = this.deps.effectCompiler.compileEffects(candidate.unitId, candidate.mode, candidate.target, this.deps.board);
    if (effects === null) return;

    if (this.lifecycle === 'Ready' && this.candidate !== null && sameCandidate(this.candidate, candidate)) {
      // Acceptance Criteria: "no board or candidate change... returned
      // without triggering a redundant resolve() call."
      return;
    }

    if (this.lifecycle === 'Ready') {
      this.lifecycle = transitionPreviewState(this.lifecycle, { type: 'candidate_changed' }); // -> Stale
    }
    this.lifecycle =
      this.lifecycle === 'Idle'
        ? transitionPreviewState(this.lifecycle, { type: 'candidate_formed' }) // -> Computing
        : transitionPreviewState(this.lifecycle, { type: 'recompute_started' }); // Stale -> Computing

    this.candidate = candidate;
    this.runDryRun(candidate, effects);
  }

  /**
   * `select` (fresh selection or a direct unit switch) and `cancel`
   * (deselect / Targeting -> UnitSelected) both mean, from Move Preview's
   * perspective, "no candidate action currently exists" — Input's
   * `chooseMode` step (which forms `Targeting`) has not yet happened again.
   * Both are treated identically: end any active preview with zero board
   * effect (Rule 6), functionally the `Discarded -> Idle` path even though
   * `select` is a structurally distinct Input event from `cancel`.
   */
  private onSelectOrCancel(_e: SelectEvent | CancelEvent): void {
    if (this.lifecycle === 'Idle') return;
    this.lifecycle = transitionPreviewState(this.lifecycle, { type: 'cancelled' }); // -> Discarded
    this.lifecycle = transitionPreviewState(this.lifecycle, { type: 'settled' }); // -> Idle
    this.candidate = null;
    this.result = null;
  }

  /**
   * Rule 7: confirming does not "apply the preview" — it only ends Move
   * Preview's own tracked lifecycle for this candidate. The real commit
   * (`resolve()` against the live board) is Turn & Phase Manager's job,
   * reached through Input & Selection's `ActionCommitter` port, not through
   * this class.
   */
  private onConfirm(_e: ConfirmEvent): void {
    if (this.lifecycle !== 'Ready') {
      // Rule 10 fail-safe is enforced upstream (the confirm affordance must
      // already be disabled without a Ready preview) — Move Preview does not
      // own blocking confirm itself. A confirm arriving anyway while not
      // Ready is not this preview's candidate to clear; ignore defensively.
      return;
    }
    this.lifecycle = transitionPreviewState(this.lifecycle, { type: 'confirmed' }); // -> Committed
    this.lifecycle = transitionPreviewState(this.lifecycle, { type: 'settled' }); // -> Idle
    this.candidate = null;
    this.result = null;
  }

  // ── Dry-run mechanism (ADR-0007 / ADR-0006) ──────────────────────────────

  private recomputeCurrentCandidate(): void {
    const candidate = this.candidate;
    if (candidate === null) return;
    const effects = this.deps.effectCompiler.compileEffects(candidate.unitId, candidate.mode, candidate.target, this.deps.board);
    if (effects === null) {
      // The candidate that was legal a moment ago no longer is (the board
      // mutation that triggered this recompute removed/invalidated it).
      // There is no legal candidate to preview any more (Rule 5) — clear.
      this.lifecycle = 'Idle';
      this.candidate = null;
      this.result = null;
      return;
    }
    this.lifecycle = transitionPreviewState(this.lifecycle, { type: 'recompute_started' }); // Stale -> Computing
    this.runDryRun(candidate, effects);
  }

  /**
   * THE dry-run mechanism (ADR-0007 Decision point 2): snapshot both live
   * inputs, run the identical `resolve()` entry point Turn & Phase Manager
   * uses for a real commit, through a fresh PRIVATE `EventBus` so the dry
   * run's events never reach any shared subscriber (ADR-0007 — "the silence
   * IS the boundary; there is no `committed` flag"). Both `previewBoard` and
   * `previewState` are discarded when this method returns; nothing else ever
   * receives a reference to either.
   */
  private runDryRun(candidate: PreviewCandidate, effects: readonly EffectPrimitive[]): void {
    try {
      const previewBoard = this.deps.board.snapshot();
      const previewState = this.deps.state.snapshot();
      const privateBus = new EventBus<CombatEventMap>();
      const events = resolve(previewBoard, previewState, effects, { bus: privateBus });

      this.result = { candidate, effects, events };
      this.lifecycle = transitionPreviewState(this.lifecycle, { type: 'compute_succeeded' }); // -> Ready
    } catch {
      // Rule 10 fail-safe: an implementation fault (never a gameplay
      // rejection — those come back as `null` from `compileEffects` and are
      // handled before this method is ever reached, per Rule 5 and this
      // module's Result-vs-throw handling in story-001). See
      // `preview-lifecycle.ts`'s judgement-call doc comment for why
      // `compute_failed` resolves to `Idle`.
      this.result = null;
      this.lifecycle = transitionPreviewState(this.lifecycle, { type: 'compute_failed' }); // Computing -> Idle
    }
  }

  private isPlayerPhase(): boolean {
    return this.deps.getCurrentPhase() === 'PlayerPhase';
  }

  private forceIdle(): void {
    this.lifecycle = 'Idle';
    this.candidate = null;
    this.result = null;
  }
}
