// Board & Grid — Story 001: Board State & Pure Queries
//
// Implements: production/epics/board-grid/story-001-board-state-queries.md
// GDD: design/gdd/board-and-grid.md (Formula 1, 5, 7; Core Rules 1-2, 6, 10)
//
// Covers construction/defaults, classify() precedence (Formula 7), the
// water_lethal knob, and query purity (no query mutates state) — the parts
// of Story 001 not already exercised by board_grid_test.ts's F1-F4 cases.
//
// Naming: [system]_[feature]_test.ts / test_[scenario]_[expected].
// Deterministic: no RNG, no wall clock. Each test builds its own board.

import { describe, it, expect } from 'vitest'
import { makeBoard } from '../../../src/core/board/board.js'
import { TerrainType } from '../../../src/core/board/board-types.js'

describe('board-and-grid: construction', () => {
  it('test_no_dimensions_defaults_to_eight_by_eight', () => {
    const board = makeBoard()
    expect(board.width).toBe(8)
    expect(board.height).toBe(8)
  })

  it('test_explicit_dimensions_succeed', () => {
    const board = makeBoard({ width: 5, height: 12 })
    expect(board.width).toBe(5)
    expect(board.height).toBe(12)
  })

  it('test_width_less_than_one_rejected', () => {
    expect(() => makeBoard({ width: 0 })).toThrow()
  })

  it('test_height_less_than_one_rejected', () => {
    expect(() => makeBoard({ height: -1 })).toThrow()
  })

  it('test_fresh_board_all_tiles_normal_clear_and_empty', () => {
    const board = makeBoard()
    for (let col = 0; col < board.width; col++) {
      for (let row = 0; row < board.height; row++) {
        const tile = board.getTile(col, row)
        expect(tile.terrain).toBe(TerrainType.Normal)
        expect(tile.occupant).toBeNull()
        expect(tile.hazard).toBeNull()
        expect(tile.flags).toEqual([])
      }
    }
  })
})

describe('board-and-grid: classify precedence (F7)', () => {
  it('test_out_of_bounds_tile_classifies_out_of_bounds', () => {
    const board = makeBoard()
    expect(board.classify({ col: -1, row: 0 }).kind).toBe('OutOfBounds')
    expect(board.classify({ col: board.width, row: 0 }).kind).toBe('OutOfBounds')
  })

  it('test_blocked_tile_classifies_blocked_terrain_and_is_blocked_true', () => {
    const board = makeBoard()
    const tile = { col: 2, row: 2 }
    expect(board.setTerrain(tile, TerrainType.Blocked).ok).toBe(true)
    expect(board.isBlocked(tile.col, tile.row)).toBe(true)
    expect(board.classify(tile).kind).toBe('BlockedTerrain')
  })

  it('test_chasm_tile_classifies_lethal', () => {
    const board = makeBoard()
    const tile = { col: 3, row: 3 }
    expect(board.setTerrain(tile, TerrainType.Chasm).ok).toBe(true)
    expect(board.classify(tile).kind).toBe('Lethal')
  })

  it('test_occupied_clear_tile_classifies_occupied_with_unit_id', () => {
    const board = makeBoard()
    const tile = { col: 4, row: 4 }
    expect(board.place(tile, 'hero-1').ok).toBe(true)
    const c = board.classify(tile)
    expect(c.kind).toBe('Occupied')
    expect(c.kind === 'Occupied' && c.unitId).toBe('hero-1')
  })

  it('test_empty_normal_tile_classifies_clear', () => {
    const board = makeBoard()
    expect(board.classify({ col: 5, row: 5 }).kind).toBe('Clear')
  })

  it('test_occupied_chasm_classifies_lethal_not_occupied', () => {
    // Precedence check: Lethal outranks Occupied. Board.place() only guards
    // the one-occupant invariant (ADR-0005 taxonomy: 'Occupied' is place's
    // only rejection reason) — it does not itself refuse placement onto
    // Lethal/Blocked terrain, so this state is directly constructible here
    // even though Combat's spawnUnit would refuse it via classify() first.
    const board = makeBoard()
    const tile = { col: 6, row: 6 }
    expect(board.setTerrain(tile, TerrainType.Chasm).ok).toBe(true)
    expect(board.place(tile, 'enemy-1').ok).toBe(true)
    expect(board.classify(tile).kind).toBe('Lethal')
  })
})

describe('board-and-grid: water_lethal knob', () => {
  it('test_water_lethal_true_classifies_lethal', () => {
    const board = makeBoard({ waterLethal: true })
    const tile = { col: 1, row: 1 }
    expect(board.setTerrain(tile, TerrainType.Water).ok).toBe(true)
    expect(board.classify(tile).kind).toBe('Lethal')
  })

  it('test_water_lethal_false_classifies_clear_non_lethal', () => {
    const board = makeBoard({ waterLethal: false })
    const tile = { col: 1, row: 1 }
    expect(board.setTerrain(tile, TerrainType.Water).ok).toBe(true)
    expect(board.classify(tile).kind).toBe('Clear')
    expect(board.isBlocked(tile.col, tile.row)).toBe(false)
  })
})

describe('board-and-grid: query purity (Rule 10)', () => {
  it('test_repeated_queries_never_mutate_state', () => {
    const board = makeBoard()
    const tile = { col: 2, row: 5 }
    board.setTerrain(tile, TerrainType.Blocked)
    board.place({ col: 0, row: 0 }, 'hero-1')
    board.setHazard({ col: 1, row: 1 }, 'fire')
    board.setFlag({ col: 7, row: 7 }, 'objective')

    const before = JSON.stringify(
      Array.from({ length: board.width * board.height }, (_, n) =>
        board.getTile(n % board.width, Math.floor(n / board.width)),
      ),
    )

    // Exercise every pure query several times.
    for (let i = 0; i < 3; i++) {
      board.inBounds(2, 5)
      board.isOccupied(0, 0)
      board.getOccupant(0, 0)
      board.isBlocked(2, 5)
      board.getHazard(1, 1)
      board.hasFlag(7, 7, 'objective')
      board.neighbors(3, 3)
      board.distance({ col: 0, row: 0 }, { col: 7, row: 7 })
      board.tilesInRange({ col: 3, row: 3 }, 2)
      board.step({ col: 3, row: 3 }, 'N')
      board.classify({ col: 2, row: 5 })
      board.rayTiles({ col: 0, row: 0 }, 'E', 4)
      board.reachableTiles({ col: 5, row: 5 }, 2, board)
      board.snapshot()
    }

    const after = JSON.stringify(
      Array.from({ length: board.width * board.height }, (_, n) =>
        board.getTile(n % board.width, Math.floor(n / board.width)),
      ),
    )

    expect(after).toEqual(before)
  })
})
