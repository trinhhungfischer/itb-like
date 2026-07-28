/**
 * Turn & Phase Manager — data-driven tuning knobs.
 *
 * Implements: design/gdd/turn-and-phase-manager.md (Tuning Knobs section).
 * `squad_size` (H) and `actions_per_hero_turn` (A_max) are registered in
 * design/registry/entities.yaml and owned by heroes-and-abilities.md; they
 * are consumed here ONLY to document Formula F2's undo-stack upper bound
 * (`undoLevels_max = H x A_max`) — never scattered as inline literals
 * elsewhere in this module.
 */

/** design/registry/entities.yaml `squad_size` (owner: design/gdd/heroes-and-abilities.md). */
export const SQUAD_SIZE_DEFAULT = 3;

/** design/registry/entities.yaml `actions_per_hero_turn` (owner: design/gdd/heroes-and-abilities.md). */
export const ACTIONS_PER_HERO_TURN_DEFAULT = 2;

/**
 * Formula F2's documented (not enforced) practical upper bound on undo
 * levels within a single Player Phase, under default squad size / action
 * economy: `H x A_max`.
 */
export const UNDO_LEVELS_UPPER_BOUND_DEFAULT = SQUAD_SIZE_DEFAULT * ACTIONS_PER_HERO_TURN_DEFAULT;

/**
 * Construction-time tuning knobs for a {@link TurnPhaseManager}.
 *
 * Scope note: the GDD's Tuning Knobs section also lists `undo_enabled` and
 * `max_undo_levels`. Both are deliberately OMITTED here — they govern full
 * undo/redo behavior, which is "Story 004: In-Phase Undo/Redo" and is not
 * implemented by this module (see turn-phase-manager.ts's class doc
 * comment). Adding them back is Story 004's job, alongside the `undo()`/
 * `redo()` methods they gate.
 */
export interface TurnPhaseConfig {
  /** GDD Tuning Knobs. Safety valve: force-ends the battle as Defeat at this turn if Objective never reaches a terminal verdict. Default `50`, safe range 20-200. */
  readonly hardTurnCap: number;
  /** GDD Tuning Knobs. If `false`, the player cannot abandon a battle mid-run. Default `true`. */
  readonly abandonEnabled: boolean;
}

/** Default configuration (GDD Tuning Knobs defaults). */
export const DEFAULT_TURN_PHASE_CONFIG: Readonly<TurnPhaseConfig> = Object.freeze({
  hardTurnCap: 50,
  abandonEnabled: true,
});
