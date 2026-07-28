/**
 * Input & Selection — tuning knobs for the selection state machine.
 *
 * Implements: design/gdd/input-and-selection.md Tuning Knobs (`click_tolerance_px`,
 * `max_click_hold_ms`, `require_confirm_click`).
 * Story: production/epics/input-selection/story-002-selection-state-machine.md
 *
 * Per `design/ux/accessibility-requirements.md` A13 (added 2026-07-28),
 * `click_tolerance_px` must be **player-adjustable**, not a designer-only
 * constant — this module therefore never hardcodes it as a literal inside
 * {@link isValidClick} or {@link SelectionStateMachine}. Every consumer takes
 * a {@link SelectionConfig} as injected data (constructor DI, matching
 * `TurnPhaseManagerDeps.config`'s `Partial<Config>` pattern) with these
 * defaults as the fallback only. Settings / Options (`settings-and-options.md`,
 * system #28) is the eventual source of a player-adjusted value; this module
 * does not know or care where the value came from.
 */

/** Tuning knobs this story owns (GDD Tuning Knobs table). */
export interface SelectionConfig {
  /**
   * Formula 3: max pixel drift between pointerdown and pointerup still
   * counted as a click, not a drag. GDD default `6`, safe range `2–15`.
   * **Player-adjustable (A13)** — never hardcode at a call site.
   */
  readonly clickTolerancePx: number;
  /**
   * Formula 3: max hold duration between pointerdown and pointerup still
   * counted as a click, not a press-and-hold. GDD default `600`, safe range
   * `400–800`.
   */
  readonly maxClickHoldMs: number;
  /**
   * Accessibility accommodation (A6). `false` (default): a valid click on a
   * legal target commits immediately. `true`: the first valid click on a
   * legal target only arms it; a second valid click on the same armed tile
   * commits. See `SelectionStateMachine`'s Targeting-commit doc comment.
   */
  readonly requireConfirmClick: boolean;
}

/** GDD-specified defaults — used only when a caller does not supply an override. */
export const DEFAULT_SELECTION_CONFIG: SelectionConfig = {
  clickTolerancePx: 6,
  maxClickHoldMs: 600,
  requireConfirmClick: false,
};
