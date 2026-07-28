/**
 * Input & Selection — the single screen↔tile coordinate transform.
 *
 * Implements: design/gdd/input-and-selection.md Formulas 1–2.
 * Governing ADR: docs/architecture/adr-0009-reachable-tiles-coordinate-transform.md
 * Story: production/epics/input-selection/story-001-coordinate-transform.md
 *
 * Per ADR-0009 Part B, this is the ONE screen↔tile transform module in the
 * codebase — Input & Selection (click hit-testing) and Board Rendering &
 * Juice (highlight/reticle placement) both import it verbatim; neither may
 * re-implement the pixel↔tile arithmetic locally, or clicks would silently
 * misregister against what the player sees highlighted (breaks Pillar #1
 * "perfect blame").
 *
 * This module is small and dependency-free: it takes all geometry as an
 * explicit {@link ViewTransform} argument and holds no mutable state, so
 * every importer stays in lockstep automatically (ADR-0009 Implementation
 * Guidelines). It does not import PixiJS, the DOM, or the live `Board`
 * runtime — only the `Tile` shape from Board & Grid's pure type module, per
 * the story's constraint that this be a pure function of (pixel coords,
 * geometry) → tile, testable headlessly with no canvas.
 *
 * Rounding is defined once, here (ADR-0009): `screenToTile` uses
 * `Math.floor` on the offset-and-divide; `tileToScreenCenter` adds the
 * `tileSize / 2` center offset. Do not vary rounding between importers.
 */

import type { Tile } from '../board/board-types.js';

/**
 * Explicit board/view geometry the transform is a pure function of. Board
 * Rendering & Juice is the authoritative *source* of these values (camera,
 * zoom, letterboxing); this module only consumes them (ADR-0009 Part B —
 * "geometry ownership stays split, transform math is shared").
 *
 * `boardWidth`/`boardHeight` are included (beyond the ADR's illustrative
 * `{originX, originY, tileSize}` sketch, which the ADR itself describes as
 * growable — "future fields added here once, consumed everywhere") so that
 * {@link screenToTile}'s bounds check never hardcodes the board's tile
 * count. The board is 8×8 by default (`design/registry/entities.yaml`
 * `grid_width`/`grid_height`), but this module takes that as data, never a
 * literal — see the story's "must not hardcode 8" constraint.
 */
export interface ViewTransform {
  /** Board's top-left screen x, in canvas px (camera/letterbox-dependent). */
  readonly originX: number;
  /** Board's top-left screen y, in canvas px. */
  readonly originY: number;
  /** Uniform square tile edge length, in px. Must be `> 0`. */
  readonly tileSize: number;
  /** Board width in tiles. Must be a positive integer. Not hardcoded — supplied by Board & Grid's `BoardConfig`. */
  readonly boardWidth: number;
  /** Board height in tiles. Must be a positive integer. */
  readonly boardHeight: number;
}

/** A pixel coordinate pair in canvas space. */
export interface ScreenPoint {
  readonly px: number;
  readonly py: number;
}

/**
 * Formula 1 (`input-and-selection.md`): maps a pointer/click pixel position
 * to the board tile it falls within.
 *
 * `col = ⌊(px − originX) / tileSize⌋`, `row = ⌊(py − originY) / tileSize⌋`.
 *
 * Each tile's pixel footprint is the half-open square
 * `[originX + col·tileSize, originX + (col+1)·tileSize) ×
 * [originY + row·tileSize, originY + (row+1)·tileSize)` — i.e. a pixel
 * exactly on a tile's top/left edge belongs to that (higher-index) tile,
 * never the previous one. This is `Math.floor`'s natural behavior and is
 * the tie-break rule for exact boundary pixels (not separately specified by
 * the GDD; pinned here and covered by
 * `tests/unit/input-selection/input_selection_coordinate_transform_test.ts`).
 *
 * Returns `null` — a miss, never a clamp — if the resulting `(col, row)`
 * falls outside `[0, boardWidth) × [0, boardHeight)`. Per the GDD, an
 * off-board click is a distinct outcome from any in-bounds tile and callers
 * (the selection state machine, Story 002) must not silently clamp it onto
 * an edge tile.
 *
 * @param px - Pointer x in canvas px.
 * @param py - Pointer y in canvas px.
 * @param view - Board/view geometry supplying origin, tile size, and extent.
 * @returns The resolved `(col, row)` tile, or `null` if the pixel is off-board.
 */
export function screenToTile(px: number, py: number, view: ViewTransform): Tile | null {
  const col = Math.floor((px - view.originX) / view.tileSize);
  const row = Math.floor((py - view.originY) / view.tileSize);

  if (col < 0 || col >= view.boardWidth || row < 0 || row >= view.boardHeight) {
    return null;
  }

  return { col, row };
}

/**
 * Formula 2 (`input-and-selection.md`): maps a tile coordinate to the
 * canvas-space center point of its pixel footprint — the exact inverse of
 * {@link screenToTile}, up to the tile-center offset. Used to place the
 * keyboard-cursor reticle, targeting highlights, and juice anchors.
 *
 * `px = originX + col·tileSize + tileSize/2`,
 * `py = originY + row·tileSize + tileSize/2`.
 *
 * Unconditional arithmetic — unlike Board & Grid's tile-taking queries
 * (`getTile`, etc.), this does not throw on an out-of-bounds `(col, row)`.
 * Formula 2 is defined as a pure inverse with no validation branch, and the
 * GDD's own edge-case note treats out-of-bounds input here as merely
 * hypothetical ("if out-of-bounds queries were somehow allowed") since
 * every real caller already constrains `col`/`row` via `inBounds` upstream.
 *
 * @param col - Tile column.
 * @param row - Tile row.
 * @param view - Board/view geometry supplying origin and tile size.
 * @returns The tile's center point in canvas px.
 */
export function tileToScreenCenter(col: number, row: number, view: ViewTransform): ScreenPoint {
  return {
    px: view.originX + col * view.tileSize + view.tileSize / 2,
    py: view.originY + row * view.tileSize + view.tileSize / 2,
  };
}
