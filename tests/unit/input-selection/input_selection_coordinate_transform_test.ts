// Input & Selection — Story 001: Coordinate Transform Math
//
// Implements: production/epics/input-selection/story-001-coordinate-transform.md
// GDD: design/gdd/input-and-selection.md Formulas 1–2
// Governing ADR: docs/architecture/adr-0009-reachable-tiles-coordinate-transform.md
//
// Covers: centre-of-tile mapping (AC-1 example), the exact boundary-pixel
// tie-break rule (Math.floor half-open tiles — pinned in
// src/core/input/coordinate-transform.ts doc comment since the GDD does not
// separately specify it), off-board misses (never a clamp), round-trip
// tile->pixel->tile stability, and non-square/offset viewport geometry
// (rectangular board + asymmetric origin) to prove the transform never
// hardcodes the 8x8 default.
//
// Naming: [system]_[feature]_test.ts / test_[scenario]_[expected].
// Deterministic: no RNG, no wall clock. Every test builds its own ViewTransform.

import { describe, it, expect } from 'vitest'
import { screenToTile, tileToScreenCenter } from '../../../src/core/input/coordinate-transform.js'
import type { ViewTransform } from '../../../src/core/input/coordinate-transform.js'

/** GDD's own worked example: 8x8 board, tileSize=64, origin=(32,32). */
const DEFAULT_VIEW: ViewTransform = {
  originX: 32,
  originY: 32,
  tileSize: 64,
  boardWidth: 8,
  boardHeight: 8,
}

describe('input-and-selection: screenToTile (F1) centre-of-tile mapping', () => {
  it('test_screen_to_tile_gdd_worked_example_returns_col4_row1', () => {
    const result = screenToTile(300, 150, DEFAULT_VIEW)
    expect(result).toEqual({ col: 4, row: 1 })
  })

  it('test_screen_to_tile_click_at_tile_center_returns_that_tile', () => {
    // Tile (2,3) spans x:[160,224), y:[224,288); center is (192,256).
    const result = screenToTile(192, 256, DEFAULT_VIEW)
    expect(result).toEqual({ col: 2, row: 3 })
  })

  it('test_screen_to_tile_origin_pixel_returns_tile_zero_zero', () => {
    // AC-1 edge case: exact boundary at the board's own origin.
    const result = screenToTile(32, 32, DEFAULT_VIEW)
    expect(result).toEqual({ col: 0, row: 0 })
  })
})

describe('input-and-selection: screenToTile (F1) exact boundary-pixel tie-break', () => {
  // Tie-break rule (pinned in coordinate-transform.ts): each tile's pixel
  // footprint is HALF-OPEN on its top/left edge and closed on none of its
  // edges in practice — Math.floor((px - origin) / tileSize) means a pixel
  // exactly on a boundary belongs to the tile that STARTS there (the
  // higher-index tile), never the tile that ends there.

  it('test_screen_to_tile_exact_column_boundary_pixel_resolves_to_higher_col_tile', () => {
    // Boundary between col 0 and col 1 is x=96 (originX 32 + 1*tileSize 64).
    const onBoundary = screenToTile(96, 32, DEFAULT_VIEW)
    const justBefore = screenToTile(95, 32, DEFAULT_VIEW)

    expect(onBoundary).toEqual({ col: 1, row: 0 })
    expect(justBefore).toEqual({ col: 0, row: 0 })
  })

  it('test_screen_to_tile_exact_row_boundary_pixel_resolves_to_higher_row_tile', () => {
    // Boundary between row 0 and row 1 is y=96.
    const onBoundary = screenToTile(32, 96, DEFAULT_VIEW)
    const justBefore = screenToTile(32, 95, DEFAULT_VIEW)

    expect(onBoundary).toEqual({ col: 0, row: 1 })
    expect(justBefore).toEqual({ col: 0, row: 0 })
  })

  it('test_screen_to_tile_boundary_tie_break_holds_deep_in_the_board_not_just_near_origin', () => {
    // Boundary between col 4 and col 5 is x = 32 + 5*64 = 352.
    expect(screenToTile(352, 32, DEFAULT_VIEW)).toEqual({ col: 5, row: 0 })
    expect(screenToTile(351, 32, DEFAULT_VIEW)).toEqual({ col: 4, row: 0 })
  })
})

describe('input-and-selection: screenToTile (F1) off-board misses (never a clamp)', () => {
  it('test_screen_to_tile_far_outside_board_returns_null', () => {
    expect(screenToTile(1000, 1000, DEFAULT_VIEW)).toBeNull()
  })

  it('test_screen_to_tile_one_pixel_west_of_origin_returns_null', () => {
    // AC-3 edge case: just outside the origin (x=31).
    expect(screenToTile(31, 32, DEFAULT_VIEW)).toBeNull()
  })

  it('test_screen_to_tile_one_pixel_north_of_origin_returns_null', () => {
    expect(screenToTile(32, 31, DEFAULT_VIEW)).toBeNull()
  })

  it('test_screen_to_tile_one_pixel_past_max_width_returns_null', () => {
    // 8x8 board: last valid column pixel range is [32+7*64, 32+8*64) = [480,544).
    // x=544 is one pixel past the board's east edge.
    expect(screenToTile(544, 32, DEFAULT_VIEW)).toBeNull()
    expect(screenToTile(543, 32, DEFAULT_VIEW)).toEqual({ col: 7, row: 0 })
  })

  it('test_screen_to_tile_one_pixel_past_max_height_returns_null', () => {
    expect(screenToTile(32, 544, DEFAULT_VIEW)).toBeNull()
    expect(screenToTile(32, 543, DEFAULT_VIEW)).toEqual({ col: 0, row: 7 })
  })

  it('test_screen_to_tile_negative_pixels_return_null_not_a_clamped_edge_tile', () => {
    const result = screenToTile(-500, -500, DEFAULT_VIEW)
    expect(result).toBeNull()
  })

  it('test_screen_to_tile_in_bounds_column_but_out_of_bounds_row_returns_null', () => {
    // Proves both axes are checked independently, not OR'd into a single miss.
    expect(screenToTile(300, 1000, DEFAULT_VIEW)).toBeNull()
  })
})

describe('input-and-selection: tileToScreenCenter (F2)', () => {
  it('test_tile_to_screen_center_gdd_worked_example_returns_320_128', () => {
    const result = tileToScreenCenter(4, 1, DEFAULT_VIEW)
    expect(result).toEqual({ px: 320, py: 128 })
  })

  it('test_tile_to_screen_center_origin_tile_returns_half_tile_offset_from_origin', () => {
    const result = tileToScreenCenter(0, 0, DEFAULT_VIEW)
    expect(result).toEqual({ px: 64, py: 64 })
  })

  it('test_tile_to_screen_center_does_not_throw_on_out_of_bounds_tile_coordinates', () => {
    // Formula 2 is unconditional arithmetic (no validation branch) — see
    // coordinate-transform.ts doc comment. Out-of-bounds col/row is a real,
    // non-throwing input here even though no legitimate caller should reach it.
    expect(() => tileToScreenCenter(-1, 99, DEFAULT_VIEW)).not.toThrow()
    // px = 32 + (-1)*64 + 32 = 0; py = 32 + 99*64 + 32 = 6400.
    expect(tileToScreenCenter(-1, 99, DEFAULT_VIEW)).toEqual({ px: 0, py: 6400 })
  })
})

describe('input-and-selection: round-trip tile -> pixel -> tile stability', () => {
  it('test_round_trip_center_of_every_tile_on_default_board_resolves_back_to_itself', () => {
    for (let col = 0; col < DEFAULT_VIEW.boardWidth; col++) {
      for (let row = 0; row < DEFAULT_VIEW.boardHeight; row++) {
        const center = tileToScreenCenter(col, row, DEFAULT_VIEW)
        const resolved = screenToTile(center.px, center.py, DEFAULT_VIEW)
        expect(resolved).toEqual({ col, row })
      }
    }
  })

  it('test_round_trip_corner_tiles_resolve_back_to_themselves', () => {
    const corners = [
      { col: 0, row: 0 },
      { col: DEFAULT_VIEW.boardWidth - 1, row: 0 },
      { col: 0, row: DEFAULT_VIEW.boardHeight - 1 },
      { col: DEFAULT_VIEW.boardWidth - 1, row: DEFAULT_VIEW.boardHeight - 1 },
    ]

    for (const corner of corners) {
      const center = tileToScreenCenter(corner.col, corner.row, DEFAULT_VIEW)
      expect(screenToTile(center.px, center.py, DEFAULT_VIEW)).toEqual(corner)
    }
  })

  it('test_round_trip_repeated_calls_are_deterministic', () => {
    const center = tileToScreenCenter(5, 6, DEFAULT_VIEW)
    const first = screenToTile(center.px, center.py, DEFAULT_VIEW)
    const second = screenToTile(center.px, center.py, DEFAULT_VIEW)
    expect(second).toEqual(first)
  })
})

describe('input-and-selection: non-square / offset viewport geometry', () => {
  // The GDD's Formula 1-2 define a single scalar `tileSize` (uniform SQUARE
  // tiles) — there is no separate tile-width/tile-height concept to test.
  // "Non-square viewport" is interpreted here as (a) a rectangular board
  // (boardWidth != boardHeight) and (b) an asymmetric screen origin
  // (originX != originY, as letterboxing/HUD margins would produce) — both
  // proving the transform takes geometry as data and never hardcodes 8x8
  // or a symmetric origin.

  const WIDE_VIEW: ViewTransform = {
    originX: 10,
    originY: 50,
    tileSize: 32,
    boardWidth: 10,
    boardHeight: 6,
  }

  it('test_screen_to_tile_non_square_board_maps_correctly_within_custom_geometry', () => {
    // Tile (9,5) is the far corner of a 10x6 board: x:[10+9*32,10+10*32)=[298,330), y:[50+5*32,50+6*32)=[210,242).
    const result = screenToTile(300, 220, WIDE_VIEW)
    expect(result).toEqual({ col: 9, row: 5 })
  })

  it('test_screen_to_tile_non_square_board_rejects_column_beyond_narrower_width', () => {
    // boardWidth=10 means max valid col is 9; col 10 starts at x = 10+10*32=330.
    expect(screenToTile(330, 60, WIDE_VIEW)).toBeNull()
  })

  it('test_screen_to_tile_non_square_board_rejects_row_beyond_shorter_height', () => {
    // boardHeight=6 means max valid row is 5; row 6 starts at y = 50+6*32=242.
    expect(screenToTile(20, 242, WIDE_VIEW)).toBeNull()
  })

  it('test_tile_to_screen_center_asymmetric_origin_offsets_each_axis_independently', () => {
    const result = tileToScreenCenter(0, 0, WIDE_VIEW)
    expect(result).toEqual({ px: 10 + 16, py: 50 + 16 })
  })

  it('test_round_trip_holds_under_custom_non_default_geometry', () => {
    for (let col = 0; col < WIDE_VIEW.boardWidth; col++) {
      for (let row = 0; row < WIDE_VIEW.boardHeight; row++) {
        const center = tileToScreenCenter(col, row, WIDE_VIEW)
        expect(screenToTile(center.px, center.py, WIDE_VIEW)).toEqual({ col, row })
      }
    }
  })
})
