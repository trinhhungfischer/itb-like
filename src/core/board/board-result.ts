/**
 * Board & Grid — error contract (Result vs throw).
 *
 * Implements: design/gdd/board-and-grid.md Open Q1.
 * Governing ADR: docs/architecture/adr-0005-board-combat-error-contract.md
 *
 * Two-channel rule: "If a rule-abiding player or AI could cause it, return a
 * `Result`; if only a code bug could cause it, throw." Board & Grid's
 * mutations use {@link Result} for expected gameplay rejections and
 * {@link invariant} for genuine programmer errors (bad construction args,
 * out-of-bounds query/mutation origins, negative ranges).
 *
 * Scoping note: ADR-0005 defines a project-wide `RejectReason` union that
 * also covers Combat Resolution primitives (`TileNotClear`, `UnitNotOnBoard`,
 * `OutOfBounds`). Since Combat Resolution is out of this module's scope,
 * {@link RejectReason} here is intentionally narrowed to the reasons Board &
 * Grid's own mutations can actually produce (`Occupied`,
 * `WouldStrandOccupant`, `NotDestructible`). When Combat Resolution is
 * implemented, its owner should decide whether to import/extend this type or
 * promote it to a shared Foundation module — that decision is out of scope
 * here and intentionally left open rather than made unilaterally.
 */

/** Reasons a Board & Grid mutation can be legitimately refused (Channel 1). */
export type RejectReason =
  /** `place()` onto a tile that already holds an occupant. */
  | 'Occupied'
  /** `setTerrain()` would leave an existing occupant on Blocked/Lethal terrain. */
  | 'WouldStrandOccupant'
  /** `setTerrain(tile, Normal)` ("destroy") on non-destructible Blocked or Chasm terrain. */
  | 'NotDestructible';

/** Value-typed outcome of an expected-gameplay-rejectable board mutation. */
export type Result = { readonly ok: true } | { readonly ok: false; readonly reason: RejectReason };

/** Shared frozen success singleton — avoids a per-call allocation on the hot path. */
export const OK: Result = Object.freeze({ ok: true });

/** Builds a rejected {@link Result} carrying `reason`. */
export function reject(reason: RejectReason): Result {
  return { ok: false, reason };
}

/**
 * Thrown for genuine programmer errors (Channel 2): invalid construction
 * arguments, out-of-bounds query/mutation origins, negative ranges. Never
 * thrown for a legal gameplay input — see {@link invariant}.
 */
export class InvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvariantError';
  }
}

/**
 * Fail-fast assertion helper for Channel-2 programmer errors. Throws
 * {@link InvariantError} if `condition` is false. Never used for expected
 * gameplay rejections — those return a {@link Result} instead.
 */
export function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new InvariantError(message);
  }
}
