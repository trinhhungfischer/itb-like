/**
 * Turn & Phase Manager — error contract (Result vs throw).
 *
 * Mirrors the two-channel convention established by
 * src/core/board/board-result.ts (ADR-0005): "if a rule-abiding player or AI
 * could cause it, return a `Result`; if only a code bug could cause it,
 * throw." ADR-0005 is formally scoped to the Core layer (Combat Resolution,
 * Input & Selection, Move Preview) and is not literally binding on this
 * Foundation-layer module, but the same split is the project-wide
 * convention and is followed here for consistency, matching the GDD's own
 * "rejected/no-op" language for illegal apply/end/abandon calls.
 */

import type { BusEvent } from '../events/event-bus.js';

/** Reasons a Turn & Phase Manager call can be legitimately refused (Channel 1). */
export type TurnRejectReason =
  /** `applyAction()` / `endPlayerPhase()` called outside Player Phase. */
  | 'NotPlayerPhase'
  /** `abandon()` called while the `abandonEnabled` tuning knob is `false`. */
  | 'AbandonDisabled'
  /** `abandon()` called while the battle is not in progress (still `Setup`, or already `Ended`). */
  | 'BattleNotInProgress';

/** Value-typed outcome of an expected-gameplay-rejectable Turn & Phase Manager call. */
export type TurnResult = { readonly ok: true } | { readonly ok: false; readonly reason: TurnRejectReason };

/** Shared frozen success singleton — avoids a per-call allocation on the hot path. */
export const TURN_OK: TurnResult = Object.freeze({ ok: true });

/** Builds a rejected {@link TurnResult} carrying `reason`. */
export function turnReject(reason: TurnRejectReason): TurnResult {
  return { ok: false, reason };
}

/** Result of {@link TurnPhaseManager.applyAction} — success additionally carries the events Combat Resolution returned, for the caller's own bookkeeping (never re-emitted onto the phase event bus). */
export type ApplyActionResult =
  | { readonly ok: true; readonly events: readonly BusEvent[] }
  | { readonly ok: false; readonly reason: TurnRejectReason };

/**
 * Thrown for genuine programmer errors (Channel 2): calling `startBattle()`
 * twice, or an internal stack-invariant violation. Never thrown for a legal
 * gameplay input — those return a {@link TurnResult} instead.
 */
export class TurnInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TurnInvariantError';
  }
}

/** Fail-fast assertion helper for Channel-2 programmer errors. Throws {@link TurnInvariantError} if `condition` is false. */
export function turnInvariant(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new TurnInvariantError(message);
  }
}
