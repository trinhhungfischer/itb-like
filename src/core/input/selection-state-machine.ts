/**
 * Input & Selection — the core selection/targeting state machine.
 *
 * Implements: design/gdd/input-and-selection.md "States and Transitions",
 * Core Rules 1–10, Edge Cases, Formula 3.
 * Story: production/epics/input-selection/story-002-selection-state-machine.md
 * Governing ADR: docs/architecture/adr-0002-deterministic-event-bus.md
 * (silent-emitter contract) and
 * docs/architecture/adr-0009-reachable-tiles-coordinate-transform.md
 * (shared coordinate transform, imported verbatim below — never re-derived).
 *
 * A pure, headlessly-testable reducer over input **events taken as data**
 * (`pointerDown`/`pointerUp`/`hoverTile`/`escape`/`chooseMode`) — this module
 * never touches the DOM. Actual `pointerdown`/`pointerup`/`keydown` listener
 * wiring is a later, Presentation-layer concern; every public method here
 * accepts plain `{px,py}`/timestamp/`Tile` data, matching the story's "no
 * DOM access" constraint.
 *
 * Scope note (see the story's Out of Scope): Locked-state input **buffering**
 * (Formula 6 — remembering and replaying one click intent across a Locked
 * period) is story-003's. This module implements Locked as a real state with
 * both of Core Rule 8's entry gates (`getCurrentPhase() !== 'PlayerPhase'`
 * OR `isAnimating() === true`) and unlocks cleanly, but a commit **attempt**
 * made while Locked is rejected immediately (`SelectionRejectReason.Locked`)
 * rather than remembered — story-003 replaces that immediate rejection with
 * the buffer-then-revalidate-on-unlock behavior.
 */

import type { Board } from '../board/board-interface.js';
import type { Tile, UnitId } from '../board/board-types.js';
import type { EventBus } from '../events/event-bus.js';
import type { Phase } from '../turn/turn-phase-types.js';
import type { ViewTransform } from './coordinate-transform.js';
import { screenToTile } from './coordinate-transform.js';
import type { ClickPoint } from './click-precision.js';
import { isValidClick } from './click-precision.js';
import type { SelectionConfig } from './selection-config.js';
import { DEFAULT_SELECTION_CONFIG } from './selection-config.js';
import type { SelectionEventMap } from './selection-events.js';
import type { ActionCommitter, TargetLegalityQuery, UnitLookup } from './selection-ports.js';
import type { SelectionResult } from './selection-result.js';
import { SELECTION_OK, selectionInvariant, selectionReject } from './selection-result.js';
import type { ActionMode, ReturnableState, SelectionState } from './selection-types.js';

/** A pixel position, taken as data (no DOM `PointerEvent` dependency). */
export interface ScreenPointInput {
  readonly px: number;
  readonly py: number;
}

/**
 * Dependencies injected into a {@link SelectionStateMachine} at construction
 * (DI over singletons, matching `TurnPhaseManagerDeps`'s established
 * pattern). `getCurrentPhase`/`isAnimating`/`getView` are live queries
 * (functions), not frozen values at construction time — each can change
 * frame-to-frame (phase advances, an animation batch starts/ends, the canvas
 * resizes) and this module must always observe the current value, per Core
 * Rule 8 ("Input & Selection polls it rather than tracking animation state
 * itself") and ADR-0009 Part B ("Board Rendering & Juice remains the
 * authoritative *source* of the view parameters"). `board`, by contrast, is
 * a fixed reference at construction — matching `TurnPhaseManagerDeps.board`
 * and `TurnPhaseManager`'s own documented behavior that its board reference
 * "never changes... only its contents change" (no undo/redo swap is wired
 * yet anywhere in this codebase).
 */
export interface SelectionDeps {
  readonly board: Board;
  /** The shared synchronous selection-event bus (ADR-0002). Constructed and injected by the caller — this module holds no module-level singleton. */
  readonly eventBus: EventBus<SelectionEventMap>;
  readonly unitLookup: UnitLookup;
  readonly targetLegality: TargetLegalityQuery;
  readonly actionCommitter: ActionCommitter;
  /** Turn & Phase Manager's `getCurrentPhase()` — the phase half of the Locked gate (Core Rule 8). */
  readonly getCurrentPhase: () => Phase | null;
  /** Board Rendering & Juice's `isAnimating()` — the animation half of the Locked gate (Core Rule 8). */
  readonly isAnimating: () => boolean;
  /** Board Rendering & Juice's current view geometry, fed into `screenToTile` (Formula 1 / ADR-0009 Part B). Queried fresh on every `pointerUp`, never cached. */
  readonly getView: () => ViewTransform;
  /** Tuning knobs (GDD Tuning Knobs section). Any field not supplied falls back to {@link DEFAULT_SELECTION_CONFIG}. */
  readonly config?: Partial<SelectionConfig>;
}

function sameTile(a: Tile, b: Tile): boolean {
  return a.col === b.col && a.row === b.row;
}

/**
 * The selection/targeting state machine (GDD "States and Transitions").
 * Construct one instance per battle via dependency injection.
 */
export class SelectionStateMachine {
  private readonly deps: Omit<SelectionDeps, 'config'>;
  private readonly config: SelectionConfig;

  private state: SelectionState = { status: 'Idle' };
  private pendingDown: ClickPoint | null = null;
  private hoveredTile: Tile | null = null;
  /** The state to adopt once both Locked gates clear, set only by a just-confirmed commit (AC-7). `null` means "no pending commit resolution" — unlocking from a phase/animation-only Locked goes to `Idle` (selection cleared). */
  private pendingPostLockState: ReturnableState | null = null;

  constructor(deps: SelectionDeps) {
    this.deps = {
      board: deps.board,
      eventBus: deps.eventBus,
      unitLookup: deps.unitLookup,
      targetLegality: deps.targetLegality,
      actionCommitter: deps.actionCommitter,
      getCurrentPhase: deps.getCurrentPhase,
      isAnimating: deps.isAnimating,
      getView: deps.getView,
    };
    this.config = { ...DEFAULT_SELECTION_CONFIG, ...(deps.config ?? {}) };

    selectionInvariant(
      this.config.clickTolerancePx > 0,
      `SelectionConfig.clickTolerancePx must be > 0, got ${this.config.clickTolerancePx}`
    );
    selectionInvariant(
      this.config.maxClickHoldMs > 0,
      `SelectionConfig.maxClickHoldMs must be > 0, got ${this.config.maxClickHoldMs}`
    );
  }

  /** Current selection state. Read-only snapshot — mutate only via this class's methods. */
  getState(): SelectionState {
    return this.state;
  }

  /** The last tile reported to {@link hoverTile}, or `null`. Exposed for Presentation to draw the hover highlight without re-deriving it. */
  getHoveredTile(): Tile | null {
    return this.hoveredTile;
  }

  /**
   * Re-evaluates the Locked gate (Core Rule 8) against the current
   * `getCurrentPhase()`/`isAnimating()` values, independent of any input
   * event. Every commit-attempt method below calls this first, so a caller
   * is never required to call it manually before a click/key — but a
   * Presentation frame loop should still call it once per frame so Locked
   * begins (and selection clears) the instant the gate trips, not only the
   * next time the player happens to click.
   */
  syncLockGate(): void {
    const phase = this.deps.getCurrentPhase();
    const animating = this.deps.isAnimating();
    const shouldBeLocked = phase !== 'PlayerPhase' || animating;

    if (shouldBeLocked) {
      if (this.state.status !== 'Locked') {
        // Freshly entering Locked (not a re-confirmation of an already-Locked
        // state from a just-confirmed commit, which already set
        // `pendingPostLockState` itself) — discard the in-progress selection.
        this.pendingPostLockState = null;
        this.state = { status: 'Locked' };
        this.hoveredTile = null;
        this.pendingDown = null;
      }
      return;
    }

    if (this.state.status === 'Locked') {
      this.state = this.pendingPostLockState ?? { status: 'Idle' };
      this.pendingPostLockState = null;
    }
  }

  /** Records a `pointerdown` sample for the next matching {@link pointerUp} to validate against (Formula 3). Never itself a commit attempt. */
  pointerDown(point: ScreenPointInput, t: number): void {
    this.pendingDown = { px: point.px, py: point.py, t };
  }

  /**
   * Resolves a `pointerup` sample: validates it against the last
   * `pointerDown` via Formula 3, then — if valid — resolves the pixel to a
   * tile (Formula 1) and dispatches into the state machine.
   */
  pointerUp(point: ScreenPointInput, t: number): SelectionResult {
    this.syncLockGate();

    const down = this.pendingDown;
    this.pendingDown = null;

    if (this.state.status === 'Locked') {
      return selectionReject('Locked');
    }

    if (down === null) {
      return selectionReject('InvalidClick');
    }

    const up: ClickPoint = { px: point.px, py: point.py, t };
    if (!isValidClick(down, up, this.config)) {
      return selectionReject('InvalidClick');
    }

    const tile = screenToTile(up.px, up.py, this.deps.getView());
    return this.resolveCommitClick(tile);
  }

  /**
   * Updates the hovered tile. Emits a `hover` event only while `Targeting`
   * (tagged with the active mode, Core Rule 2) — `Idle`/`UnitSelected`/
   * `Inspect` hover is a local highlight-only concern (nothing to dry-run
   * yet); `Locked` emits no hover events at all (Core Rule 8).
   */
  hoverTile(tile: Tile | null): void {
    this.hoveredTile = tile;

    const state = this.state;
    if (state.status === 'Locked') {
      return;
    }
    if (state.status === 'Targeting' && tile !== null) {
      this.deps.eventBus.emit({ type: 'hover', unitId: state.unitId, mode: state.mode, tile });
    }
  }

  /** `Escape` (or right-click, per the GDD's shared binding) — the free, instant cancel. */
  escape(): SelectionResult {
    this.syncLockGate();
    const state = this.state;

    switch (state.status) {
      case 'Locked':
        return selectionReject('Locked');
      case 'Idle':
        // Reserved pause/options-menu hook (Settings/Options #28) — not
        // implemented in MVP scope (GDD Edge Cases, Open Question 5).
        return SELECTION_OK;
      case 'UnitSelected':
        this.state = { status: 'Idle' };
        this.deps.eventBus.emit({ type: 'cancel', unitId: state.unitId });
        return SELECTION_OK;
      case 'Targeting':
        this.state = { status: 'UnitSelected', unitId: state.unitId };
        this.deps.eventBus.emit({ type: 'cancel', unitId: state.unitId });
        return SELECTION_OK;
      case 'Inspect':
        this.state = state.returnTo;
        return SELECTION_OK;
    }
  }

  /** Chooses an action mode (HUD click or hotkey) from `UnitSelected`, entering `Targeting`. */
  chooseMode(mode: ActionMode): SelectionResult {
    this.syncLockGate();
    const state = this.state;

    if (state.status === 'Locked') {
      return selectionReject('Locked');
    }
    if (state.status !== 'UnitSelected') {
      return selectionReject('WrongState');
    }

    const unit = this.deps.unitLookup.unit(state.unitId, this.deps.board);
    if (unit === null) {
      return selectionReject('NoSelection');
    }
    if (!unit.actingEligible) {
      return selectionReject('NotActingEligible');
    }

    this.state = { status: 'Targeting', unitId: state.unitId, mode, armedTarget: null };
    return SELECTION_OK;
  }

  // ── Click resolution (dispatches on current state) ──────────────────────

  private resolveCommitClick(tile: Tile | null): SelectionResult {
    const state = this.state;

    switch (state.status) {
      case 'Idle':
        return this.resolveFromIdle(tile);
      case 'UnitSelected':
        return this.resolveFromUnitSelected(state, tile);
      case 'Targeting':
        return this.resolveFromTargeting(state, tile);
      case 'Inspect':
        this.state = state.returnTo;
        return this.resolveCommitClick(tile);
      case 'Locked':
        return selectionReject('Locked');
    }
  }

  private resolveFromIdle(tile: Tile | null): SelectionResult {
    if (tile === null) {
      // Off-board click while Idle: true no-op (Edge Cases — nothing to cancel).
      return SELECTION_OK;
    }

    const unit = this.deps.unitLookup.unitAt(tile, this.deps.board);
    if (unit === null) {
      // Empty on-board tile while Idle: also a no-op.
      return SELECTION_OK;
    }

    if (unit.team === 'hero' && unit.actingEligible) {
      this.state = { status: 'UnitSelected', unitId: unit.id };
      this.deps.eventBus.emit({ type: 'select', unitId: unit.id });
      return SELECTION_OK;
    }

    // Exhausted friendly unit, or any enemy unit: read-only Inspect (Edge Cases).
    this.state = { status: 'Inspect', unitId: unit.id, team: unit.team, returnTo: { status: 'Idle' } };
    return SELECTION_OK;
  }

  private resolveFromUnitSelected(
    state: Extract<SelectionState, { status: 'UnitSelected' }>,
    tile: Tile | null
  ): SelectionResult {
    if (tile === null) {
      this.state = { status: 'Idle' };
      this.deps.eventBus.emit({ type: 'cancel', unitId: state.unitId });
      return SELECTION_OK;
    }

    const unit = this.deps.unitLookup.unitAt(tile, this.deps.board);

    if (unit === null) {
      // "click empty non-target space" exit transition (GDD state table).
      this.state = { status: 'Idle' };
      this.deps.eventBus.emit({ type: 'cancel', unitId: state.unitId });
      return SELECTION_OK;
    }

    if (unit.id === state.unitId) {
      // Deselect toggle (Edge Cases).
      this.state = { status: 'Idle' };
      this.deps.eventBus.emit({ type: 'cancel', unitId: state.unitId });
      return SELECTION_OK;
    }

    if (unit.team === 'hero' && unit.actingEligible) {
      // Immediate switch, no confirmation (Core Rule 4 / Edge Cases).
      this.state = { status: 'UnitSelected', unitId: unit.id };
      this.deps.eventBus.emit({ type: 'select', unitId: unit.id });
      return SELECTION_OK;
    }

    this.state = {
      status: 'Inspect',
      unitId: unit.id,
      team: unit.team,
      returnTo: { status: 'UnitSelected', unitId: state.unitId },
    };
    return SELECTION_OK;
  }

  private resolveFromTargeting(
    state: Extract<SelectionState, { status: 'Targeting' }>,
    tile: Tile | null
  ): SelectionResult {
    if (tile === null) {
      // Off-board click while Targeting: free cancel, no Board mutation (Core Rule 6).
      this.state = { status: 'UnitSelected', unitId: state.unitId };
      this.deps.eventBus.emit({ type: 'cancel', unitId: state.unitId });
      return SELECTION_OK;
    }

    const unit = this.deps.unitLookup.unitAt(tile, this.deps.board);
    if (unit !== null && unit.id !== state.unitId && unit.team === 'hero' && unit.actingEligible) {
      // A different eligible friendly unit takes priority over target-legality —
      // nothing was committed yet (Core Rule 4 / Edge Cases: "while UnitSelected
      // or Targeting: immediately switches").
      this.state = { status: 'UnitSelected', unitId: unit.id };
      this.deps.eventBus.emit({ type: 'select', unitId: unit.id });
      return SELECTION_OK;
    }

    const legal = this.deps.targetLegality.isLegalTarget(state.unitId, state.mode, tile, this.deps.board);
    if (!legal) {
      // No-commit rejection (Core Rule 9); state is untouched, still Targeting.
      return selectionReject('IllegalTarget');
    }

    const alreadyArmedHere = state.armedTarget !== null && sameTile(state.armedTarget, tile);
    if (this.config.requireConfirmClick && !alreadyArmedHere) {
      // First click on a legal target under require_confirm_click: arm, don't commit yet.
      this.state = { status: 'Targeting', unitId: state.unitId, mode: state.mode, armedTarget: tile };
      return SELECTION_OK;
    }

    this.deps.eventBus.emit({ type: 'confirm', unitId: state.unitId, mode: state.mode, target: tile });
    const outcome = this.deps.actionCommitter.commit(state.unitId, state.mode, tile, this.deps.board);

    if (!outcome.committed) {
      // Legal per the query but refused by the committer (e.g. stale mid-resolution
      // state) — defensive fallback; state remains Targeting, no lock entered.
      return selectionReject('IllegalTarget');
    }

    this.pendingPostLockState = outcome.unitHasActionsRemaining
      ? { status: 'UnitSelected', unitId: state.unitId }
      : { status: 'Idle' };
    this.state = { status: 'Locked' };
    return SELECTION_OK;
  }
}

export type { UnitId };
