/**
 * Board & Grid — data-driven tuning knobs.
 *
 * Implements: design/gdd/board-and-grid.md (Tuning Knobs section).
 * `grid_width` / `grid_height` are registered in design/registry/entities.yaml
 * (both default to 8). Values here must never be scattered as inline literals
 * elsewhere in this module.
 *
 * Scope note: the GDD lists two additional knobs, `edge_behavior` and
 * `blocked_destructible_default`, under Board & Grid's Tuning Knobs table.
 * Neither is consumed by any Board & Grid query or mutation:
 * - `edge_behavior` only affects how Combat Resolution *interprets* a
 *   `classify() === 'OutOfBounds'` result (Core Rule 8: "the board never
 *   moves a unit off the grid... Combat Resolution applies the edge
 *   collision"). Board always reports the same OutOfBounds fact regardless.
 * - `blocked_destructible_default` would only matter for a convenience
 *   "build a wall with implied destructibility" API. The canonical Board
 *   mutation surface (design/architecture/cross-system-contracts.md §2) has
 *   no such API — `setTerrain(tile, terrain)` always takes an explicit
 *   `TerrainType`, including the destructible/non-destructible distinction
 *   (`TerrainType.Blocked` vs `TerrainType.BlockedDestructible`). Callers
 *   (e.g. Encounter Generator) decide destructibility per tile explicitly.
 *
 * Both knobs are therefore intentionally omitted from {@link BoardConfig} —
 * including them here would be dead configuration with no code path reading
 * it. If a future story gives Board itself a reason to consume them, add the
 * field then.
 */

/** Default board width in tiles (design/registry/entities.yaml `grid_width`). */
export const GRID_WIDTH_DEFAULT = 8;

/** Default board height in tiles (design/registry/entities.yaml `grid_height`). */
export const GRID_HEIGHT_DEFAULT = 8;

/** Construction-time configuration for a {@link Board}. */
export interface BoardConfig {
  /** Board width in tiles. Safe range 5–12 (GDD Tuning Knobs). Must be >= 1. */
  readonly width: number;
  /** Board height in tiles. Safe range 5–12 (GDD Tuning Knobs). Must be >= 1. */
  readonly height: number;
  /**
   * Whether Water terrain is lethal on entry. `true` (default) makes Water
   * behave like Chasm; `false` makes it passable and non-lethal.
   */
  readonly waterLethal: boolean;
}

/** Default configuration: 8×8 board, lethal Water (GDD Tuning Knobs defaults). */
export const DEFAULT_BOARD_CONFIG: Readonly<BoardConfig> = Object.freeze({
  width: GRID_WIDTH_DEFAULT,
  height: GRID_HEIGHT_DEFAULT,
  waterLethal: true,
});
