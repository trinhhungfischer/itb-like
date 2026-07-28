/**
 * Input & Selection — the silent-emitter event vocabulary (Core Rule 2).
 *
 * Implements: design/gdd/input-and-selection.md Core Rule 2, "States and
 * Transitions".
 * Governing ADR: docs/architecture/adr-0002-deterministic-event-bus.md —
 * `emit()` must be synchronous, registration-ordered, on the caller's stack;
 * no Promise/microtask/setTimeout/rAF anywhere in the dispatch path.
 *
 * Input & Selection emits exactly four event types — `hover`, `select`,
 * `cancel`, `confirm` — and nothing else. It never calls a `preview()`
 * function and never reads a preview result back; Move Preview and Battle
 * HUD subscribe to this stream independently. Construct one
 * `EventBus<SelectionEventMap>` per battle and inject it (dependency
 * injection, matching `EventBus`'s own "never a module-level singleton"
 * rule) — never reach for a shared global bus.
 */

import type { BusEvent } from '../events/event-bus.js';
import type { Tile, UnitId } from '../board/board-types.js';
import type { ActionMode } from './selection-types.js';

/**
 * Emitted when the pointer/keyboard cursor moves over a candidate tile
 * while `Targeting`, tagged with the active `mode` (GDD States and
 * Transitions, `Targeting` row). Not emitted in any other state — `Idle`/
 * `UnitSelected` hover is a local highlight-only concern with no dry-run to
 * trigger (nothing is being targeted yet), and `Locked` explicitly emits no
 * hover events at all ("nothing to preview against a state that is about to
 * change").
 */
export interface HoverEvent extends BusEvent {
  readonly type: 'hover';
  readonly unitId: UnitId;
  readonly mode: ActionMode;
  readonly tile: Tile;
}

/** Emitted whenever a unit becomes the selected unit — fresh selection from `Idle`, or a direct switch from one unit to another (Core Rule 4). */
export interface SelectEvent extends BusEvent {
  readonly type: 'select';
  readonly unitId: UnitId;
}

/**
 * Emitted on every free, no-mutation backing-out: deselect (`UnitSelected` →
 * `Idle`), and `Targeting` → `UnitSelected` (Escape/right-click/off-board
 * click). Distinct from a rejection — cancel is a valid, expected action
 * (Visual/Audio Requirements: "a soft descending tick, distinct from
 * rejection").
 */
export interface CancelEvent extends BusEvent {
  readonly type: 'cancel';
  /** The unit that was selected/targeting before this cancel, or `null` if none (reserved for future no-selection cancel sources). */
  readonly unitId: UnitId | null;
}

/** Emitted the instant a valid click (or the second click, under `require_confirm_click`) lands on a legal target tile — commits immediately, no separate "preview accepted" step. */
export interface ConfirmEvent extends BusEvent {
  readonly type: 'confirm';
  readonly unitId: UnitId;
  readonly mode: ActionMode;
  readonly target: Tile;
}

/**
 * The full event map for `EventBus<SelectionEventMap>` — exactly the four
 * events Core Rule 2 names, no more.
 *
 * Declared with `type` (not `interface`), matching the precedent set by
 * `turn-phase-events.ts`'s `PhaseEventMap`: TS only structurally matches the
 * `EventMap` index-signature constraint (`Record<string, BusEvent>`) against
 * type aliases, not interfaces — an `interface` here would fail
 * `EventBus<SelectionEventMap>`'s `TEventMap extends EventMap` bound (TS2344).
 */
export type SelectionEventMap = {
  hover: HoverEvent;
  select: SelectEvent;
  cancel: CancelEvent;
  confirm: ConfirmEvent;
};
