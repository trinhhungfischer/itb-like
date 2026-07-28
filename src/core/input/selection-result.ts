/**
 * Input & Selection — error contract (Result vs throw).
 *
 * Mirrors the two-channel convention ratified by
 * docs/architecture/adr-0005-board-combat-error-contract.md ("if a
 * rule-abiding player or AI could cause it, return a `Result`; if only a
 * code bug could cause it, throw") and reused verbatim in shape by
 * src/core/board/board-result.ts and src/core/turn/turn-phase-result.ts.
 * Input & Selection is explicitly named as a Core-layer system ADR-0005
 * governs, so this module is bound by it — not merely following convention.
 *
 * Every rejection a rule-abiding player can trigger with an ordinary
 * misclick (clicking while Locked, clicking an illegal target, a
 * drag/press-and-hold that fails Formula 3) is Channel 1 — a value-typed
 * {@link SelectionResult}, never a throw, per Core Rule 9 ("every click
 * either does something visible or is visibly rejected... never a silent
 * no-op"). {@link SelectionInvariantError} is reserved for genuine caller
 * misuse (e.g. constructing this module with an out-of-range tuning knob) —
 * conditions no legal input stream can ever reach.
 *
 * Scoping note (matching board-result.ts's own precedent): this
 * `RejectReason` is narrowed to reasons the *selection state machine itself*
 * produces. It is a sibling type to Board's and Turn & Phase Manager's own
 * `RejectReason`s, not a re-export of either — each Core/Foundation module
 * owns the reasons its own operations can refuse, per that established
 * pattern.
 */

/** Reasons a selection-state-machine call can be legitimately refused (Channel 1). */
export type SelectionRejectReason =
  /** Any commit-attempt (click or key) made while the machine is `Locked` (Core Rule 8). */
  | 'Locked'
  /** `pointerUp` did not pair with a matching `pointerDown` within `click_tolerance_px`/`max_click_hold_ms` (Formula 3) — a drag or a press-and-hold, not a click. */
  | 'InvalidClick'
  /** `chooseMode` (or an implicit re-check) targeted a unit with no Move/Ability slot remaining this Player Phase. */
  | 'NotActingEligible'
  /** A `Targeting`-mode commit click landed on a tile outside the owning ability's legal-target set (Heroes & Abilities' `legalMoveTiles`/`legalTargets`). */
  | 'IllegalTarget'
  /** `chooseMode` called while the machine is not `UnitSelected`. */
  | 'WrongState'
  /** The referenced unit no longer exists on the board (e.g. removed since selection) — defensive re-validation failure. */
  | 'NoSelection';

/** Value-typed outcome of an expected-gameplay-rejectable selection call. */
export type SelectionResult = { readonly ok: true } | { readonly ok: false; readonly reason: SelectionRejectReason };

/** Shared frozen success singleton — avoids a per-call allocation on the hot input path. */
export const SELECTION_OK: SelectionResult = Object.freeze({ ok: true });

/** Builds a rejected {@link SelectionResult} carrying `reason`. */
export function selectionReject(reason: SelectionRejectReason): SelectionResult {
  return { ok: false, reason };
}

/**
 * Thrown for genuine programmer errors (Channel 2): constructing this module
 * with an invalid tuning-knob value, or an internal state-shape invariant
 * violation. Never thrown for a legal gameplay input — see {@link selectionReject}.
 */
export class SelectionInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SelectionInvariantError';
  }
}

/** Fail-fast assertion helper for Channel-2 programmer errors. Throws {@link SelectionInvariantError} if `condition` is false. */
export function selectionInvariant(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new SelectionInvariantError(message);
  }
}
