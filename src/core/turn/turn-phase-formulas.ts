/**
 * Turn & Phase Manager — pure formula helpers (Formulas F1, F2).
 *
 * Implements: design/gdd/turn-and-phase-manager.md (Formulas section).
 * These are counters/memory-footprint math only — no tunable gameplay
 * outcome (GDD Formulas "Scope note"). Exported as standalone pure
 * functions rather than manager methods because neither `max_turns` (F1)
 * nor hero count / actions-per-hero (F2) is state the manager itself owns
 * (GDD Dependencies / Rule 8 ownership boundaries) — callers (e.g. Battle
 * HUD, Objective) supply them explicitly.
 */

/** Sentinel for "no finite turn cap" (GDD F1: "N/A when uncapped — do not conflate with 0"). */
export const TURNS_REMAINING_UNCAPPED = 'N/A' as const;

/** Formula F1: `turnsElapsed = currentTurn - 1`. */
export function turnsElapsed(currentTurn: number): number {
  return currentTurn - 1;
}

/**
 * Formula F1: `turnsRemaining = max_turns - currentTurn + 1` (includes the
 * current turn), or the {@link TURNS_REMAINING_UNCAPPED} sentinel when
 * `maxTurns` is `null` (uncapped).
 */
export function turnsRemaining(
  currentTurn: number,
  maxTurns: number | null,
): number | typeof TURNS_REMAINING_UNCAPPED {
  return maxTurns === null ? TURNS_REMAINING_UNCAPPED : maxTurns - currentTurn + 1;
}

/** Formula F2: `undoLevels_max = H x A_max` (hero count x max actions per hero). */
export function undoLevelsUpperBound(heroCount: number, actionsPerHero: number): number {
  return heroCount * actionsPerHero;
}
