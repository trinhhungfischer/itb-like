/**
 * Input & Selection — Formula 3: click precision tolerance.
 *
 * Implements: design/gdd/input-and-selection.md Formula 3 (`isValidClick`).
 * Story: production/epics/input-selection/story-002-selection-state-machine.md
 * (deliberately NOT implemented by story-001 — see that story's Out of Scope,
 * which assigns "click precision and state" to this story).
 *
 * `isValidClick(down, up) = (euclidean(down.xy, up.xy) ≤ click_tolerance_px)
 * ∧ ((up.t − down.t) ≤ max_click_hold_ms)`. A pure function of two timestamped
 * points and the injected {@link SelectionConfig} — no DOM, no wall-clock
 * read internally (the caller supplies `t`).
 */

import type { SelectionConfig } from './selection-config.js';

/** A timestamped pointer sample — the shape of a `pointerdown`/`pointerup` event, taken as data (no DOM access in this module). */
export interface ClickPoint {
  readonly px: number;
  readonly py: number;
  /** Event timestamp in ms. Caller-supplied (e.g. `PointerEvent.timeStamp`); never read from `Date.now()` here. */
  readonly t: number;
}

/**
 * Formula 3. Returns `true` iff `up` is within `config.clickTolerancePx` of
 * `down` (Euclidean distance) AND `up.t - down.t` is within
 * `config.maxClickHoldMs`. Both bounds are inclusive (`≤`), matching the
 * GDD's worked boundary examples (exact tolerance distance, exact hold-time
 * limit both count as valid).
 *
 * @example
 * ```ts
 * isValidClick({px:300,py:150,t:0}, {px:303,py:152,t:120}, DEFAULT_SELECTION_CONFIG); // true (dist ≈ 3.6 ≤ 6)
 * isValidClick({px:300,py:150,t:0}, {px:320,py:170,t:120}, DEFAULT_SELECTION_CONFIG); // false (dist ≈ 28.3 > 6)
 * ```
 */
export function isValidClick(
  down: ClickPoint,
  up: ClickPoint,
  config: Pick<SelectionConfig, 'clickTolerancePx' | 'maxClickHoldMs'>
): boolean {
  const dx = up.px - down.px;
  const dy = up.py - down.py;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const holdMs = up.t - down.t;

  return distance <= config.clickTolerancePx && holdMs <= config.maxClickHoldMs;
}
