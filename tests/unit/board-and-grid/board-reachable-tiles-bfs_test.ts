// Board & Grid — Story 003: Reachable Tiles BFS
//
// Implements: production/epics/board-grid/story-003-board-reachable-tiles-bfs.md
// GDD: design/gdd/board-and-grid.md Formula 9
// Governing ADR: docs/architecture/adr-0009-reachable-tiles-coordinate-transform.md
//
// Beyond the open-board happy path (radius-3 = 24 tiles), this file covers:
// range=0, an origin whose OWN tile is non-Clear (BFS must still expand from
// it — Formula 9 never gates on classify(origin)), a fully enclosed origin,
// range exceeding the board's extent, a blocked tile PRUNING an otherwise
// in-range tile (not merely excluding the blocked tile itself), determinism,
// and equality between the standalone function and the Board.reachableTiles
// method (single canonical implementation, ADR-0009).
//
// Naming: [system]_[feature]_test.ts / test_[scenario]_[expected].
// Deterministic: no RNG, no wall clock. Each test builds its own board.

import { describe, it, expect } from 'vitest'
import { makeBoard } from '../../../src/core/board/board.js'
import { TerrainType } from '../../../src/core/board/board-types.js'
import { reachableTiles } from '../../../src/core/board/reachable-tiles.js'
import type { Tile } from '../../../src/core/board/board-types.js'

const key = (t: Tile): string => `${t.col},${t.row}`

describe('board-and-grid: reachableTiles (F9) happy path', () => {
  it('test_interior_origin_range_three_open_board_returns_24_tiles_excluding_origin', () => {
    const board = makeBoard()
    const origin = { col: 3, row: 3 }
    const result = board.reachableTiles(origin, 3, board)
    expect(result.length).toBe(24)
    expect(result.some((t) => t.col === origin.col && t.row === origin.row)).toBe(false)
  })

  it('test_every_result_satisfies_distance_within_range_and_is_clear', () => {
    const board = makeBoard()
    const origin = { col: 4, row: 4 }
    const range = 3
    const result = board.reachableTiles(origin, range, board)
    for (const tile of result) {
      expect(board.distance(origin, tile)).toBeLessThanOrEqual(range)
      expect(board.classify(tile).kind).toBe('Clear')
    }
  })
})

describe('board-and-grid: reachableTiles edge cases', () => {
  it('test_range_zero_returns_empty_set', () => {
    const board = makeBoard()
    const result = board.reachableTiles({ col: 3, row: 3 }, 0, board)
    expect(result).toEqual([])
  })

  it('test_fully_enclosed_origin_returns_empty_set_even_with_range_greater_than_zero', () => {
    const board = makeBoard()
    const origin = { col: 4, row: 4 }
    board.setTerrain({ col: 4, row: 3 }, TerrainType.Blocked) // N
    board.setTerrain({ col: 4, row: 5 }, TerrainType.Blocked) // S
    board.setTerrain({ col: 3, row: 4 }, TerrainType.Blocked) // W
    board.setTerrain({ col: 5, row: 4 }, TerrainType.Blocked) // E

    const result = board.reachableTiles(origin, 5, board)
    expect(result).toEqual([])
  })

  it('test_origin_tile_itself_blocked_does_not_prevent_expansion_from_it', () => {
    // Formula 9's pseudocode adds `origin` to visited/frontier unconditionally
    // and never checks classify(origin) — only neighbors are gated on Clear.
    const board = makeBoard()
    const origin = { col: 4, row: 4 }
    board.setTerrain(origin, TerrainType.Blocked)

    const result = board.reachableTiles(origin, 1, board)
    const resultKeys = new Set(result.map(key))
    const expectedNeighbors = board.neighbors(origin.col, origin.row)

    expect(result.length).toBe(expectedNeighbors.length)
    for (const n of expectedNeighbors) {
      expect(resultKeys.has(key(n))).toBe(true)
    }
  })

  it('test_range_exceeding_board_extent_reaches_every_clear_tile_except_origin', () => {
    const board = makeBoard() // 8x8, fully open
    const origin = { col: 3, row: 3 }
    const result = board.reachableTiles(origin, 100, board)
    expect(result.length).toBe(board.width * board.height - 1)
  })

  it('test_blocked_tile_prunes_an_otherwise_in_range_tile_not_just_itself', () => {
    // origin (0,0), range 2. Manhattan distance to (2,0) is 2 (in range),
    // but its only 2-step orthogonal path runs through (1,0). Blocking (1,0)
    // must remove BOTH (1,0) (it's not Clear) AND (2,0) (unreachable without
    // a <=2-step detour) from the result — proving this is a real flood-fill,
    // not a Manhattan-disk clip with blocked tiles merely subtracted out.
    const board = makeBoard()
    const origin = { col: 0, row: 0 }
    board.setTerrain({ col: 1, row: 0 }, TerrainType.Blocked)

    const result = board.reachableTiles(origin, 2, board)
    const resultKeys = new Set(result.map(key))

    expect(resultKeys.has('1,0')).toBe(false) // blocked tile itself
    expect(resultKeys.has('2,0')).toBe(false) // pruned: only path ran through (1,0)
    expect(board.distance(origin, { col: 2, row: 0 })).toBeLessThanOrEqual(2) // confirms it WOULD be in-range on an open board
  })

  it('test_out_of_bounds_origin_throws', () => {
    const board = makeBoard()
    expect(() => board.reachableTiles({ col: -1, row: 0 }, 2, board)).toThrow()
  })

  it('test_negative_range_throws', () => {
    const board = makeBoard()
    expect(() => board.reachableTiles({ col: 3, row: 3 }, -1, board)).toThrow()
  })
})

describe('board-and-grid: reachableTiles determinism and single-implementation guarantee', () => {
  it('test_repeated_calls_with_identical_inputs_produce_identically_ordered_results', () => {
    const board = makeBoard()
    board.setTerrain({ col: 3, row: 2 }, TerrainType.Blocked)
    const origin = { col: 3, row: 3 }

    const first = board.reachableTiles(origin, 3, board)
    const second = board.reachableTiles(origin, 3, board)

    expect(second).toEqual(first)
  })

  it('test_board_method_matches_standalone_function_exactly', () => {
    // ADR-0009: Board.reachableTiles must be a pass-through to the ONE
    // standalone implementation, never a re-derived local computation.
    const board = makeBoard()
    board.setTerrain({ col: 2, row: 2 }, TerrainType.Blocked)
    const origin = { col: 3, row: 3 }

    const viaMethod = board.reachableTiles(origin, 3, board)
    const viaFunction = reachableTiles(origin, 3, board)

    expect(viaMethod).toEqual(viaFunction)
  })
})
