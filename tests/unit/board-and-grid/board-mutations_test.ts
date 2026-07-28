// Board & Grid — Story 005: Board Mutations
//
// Implements: production/epics/board-grid/story-005-board-mutations.md
// GDD: design/gdd/board-and-grid.md (Core Rules 5-7, 9; States and Transitions;
//   Edge Cases: destroy() on non-destructible Blocked -> no-op returns false;
//   clear() on empty -> idempotent no-op; setFlag on Blocked/Chasm -> allowed)
// Governing ADR: docs/architecture/adr-0006 (place/clear/setTerrain/setHazard/
//   setFlag are the only methods that alter board state).
//
// Naming: [system]_[feature]_test.ts / test_[scenario]_[expected].
// Deterministic: no RNG, no wall clock. Each test builds its own board.

import { describe, it, expect } from 'vitest'
import { makeBoard } from '../../../src/core/board/board.js'
import { TerrainType } from '../../../src/core/board/board-types.js'

describe('board-and-grid: place / clear (occupancy)', () => {
  it('test_place_on_empty_tile_occupies_it', () => {
    const board = makeBoard()
    const result = board.place({ col: 1, row: 1 }, 'hero-1')
    expect(result.ok).toBe(true)
    expect(board.isOccupied(1, 1)).toBe(true)
    expect(board.getOccupant(1, 1)).toBe('hero-1')
  })

  it('test_clear_on_occupied_tile_empties_it', () => {
    const board = makeBoard()
    board.place({ col: 2, row: 2 }, 'hero-1')
    board.clear({ col: 2, row: 2 })
    expect(board.isOccupied(2, 2)).toBe(false)
    expect(board.getOccupant(2, 2)).toBeNull()
  })

  it('test_clear_on_already_empty_tile_is_idempotent_no_op', () => {
    const board = makeBoard()
    expect(() => board.clear({ col: 3, row: 3 })).not.toThrow()
    expect(board.isOccupied(3, 3)).toBe(false)
    // Calling it again changes nothing further.
    board.clear({ col: 3, row: 3 })
    expect(board.isOccupied(3, 3)).toBe(false)
  })

  it('test_move_via_clear_then_place_never_leaves_unit_on_both_or_neither_tile', () => {
    const board = makeBoard()
    const from = { col: 0, row: 0 }
    const to = { col: 0, row: 1 }
    board.place(from, 'hero-1')

    board.clear(from)
    board.place(to, 'hero-1')

    expect(board.isOccupied(from.col, from.row)).toBe(false)
    expect(board.isOccupied(to.col, to.row)).toBe(true)
    expect(board.getOccupant(to.col, to.row)).toBe('hero-1')

    // Exactly one tile on the whole board holds the unit.
    let occupiedCount = 0
    for (let col = 0; col < board.width; col++) {
      for (let row = 0; row < board.height; row++) {
        if (board.isOccupied(col, row)) occupiedCount++
      }
    }
    expect(occupiedCount).toBe(1)
  })
})

describe('board-and-grid: setHazard', () => {
  it('test_set_hazard_stores_type_with_no_side_effects_on_other_fields', () => {
    const board = makeBoard()
    const tile = { col: 4, row: 4 }
    board.place(tile, 'hero-1')
    board.setTerrain(tile, TerrainType.Normal)

    board.setHazard(tile, 'fire')

    expect(board.getHazard(tile.col, tile.row)).toBe('fire')
    expect(board.getOccupant(tile.col, tile.row)).toBe('hero-1')
    expect(board.getTile(tile.col, tile.row).terrain).toBe(TerrainType.Normal)
  })

  it('test_set_hazard_to_null_clears_it', () => {
    const board = makeBoard()
    const tile = { col: 5, row: 5 }
    board.setHazard(tile, 'acid')
    board.setHazard(tile, null)
    expect(board.getHazard(tile.col, tile.row)).toBeNull()
  })
})

describe('board-and-grid: setFlag', () => {
  it('test_set_flag_is_visible_via_get_tile_and_has_flag', () => {
    const board = makeBoard()
    const tile = { col: 6, row: 6 }
    board.setFlag(tile, 'spawn-point')
    expect(board.hasFlag(tile.col, tile.row, 'spawn-point')).toBe(true)
    expect(board.getTile(tile.col, tile.row).flags).toContain('spawn-point')
  })

  it('test_multiple_flags_on_one_tile_all_persist', () => {
    const board = makeBoard()
    const tile = { col: 1, row: 6 }
    board.setFlag(tile, 'spawn-point')
    board.setFlag(tile, 'objective')
    const flags = board.getTile(tile.col, tile.row).flags
    expect(flags).toContain('spawn-point')
    expect(flags).toContain('objective')
    expect(flags).not.toContain('deploy-zone')
  })

  it('test_set_flag_allowed_and_stored_opaquely_on_blocked_and_chasm_tiles', () => {
    const board = makeBoard()
    const blocked = { col: 2, row: 6 }
    const chasm = { col: 3, row: 6 }
    board.setTerrain(blocked, TerrainType.Blocked)
    board.setTerrain(chasm, TerrainType.Chasm)

    board.setFlag(blocked, 'deploy-zone')
    board.setFlag(chasm, 'objective')

    expect(board.hasFlag(blocked.col, blocked.row, 'deploy-zone')).toBe(true)
    expect(board.hasFlag(chasm.col, chasm.row, 'objective')).toBe(true)
  })
})

describe('board-and-grid: destroy via setTerrain(tile, Normal)', () => {
  it('test_destructible_blocked_tile_destroys_to_normal_and_flags_persist', () => {
    const board = makeBoard()
    const tile = { col: 2, row: 3 }
    board.setTerrain(tile, TerrainType.BlockedDestructible)
    board.setFlag(tile, 'objective')

    const result = board.setTerrain(tile, TerrainType.Normal)

    expect(result.ok).toBe(true)
    expect(board.getTile(tile.col, tile.row).terrain).toBe(TerrainType.Normal)
    expect(board.isBlocked(tile.col, tile.row)).toBe(false)
    expect(board.hasFlag(tile.col, tile.row, 'objective')).toBe(true)
  })

  it('test_chasm_tile_destroy_is_a_permanent_no_op', () => {
    const board = makeBoard()
    const tile = { col: 3, row: 4 }
    board.setTerrain(tile, TerrainType.Chasm)

    const result = board.setTerrain(tile, TerrainType.Normal)

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toBe('NotDestructible')
    expect(board.getTile(tile.col, tile.row).terrain).toBe(TerrainType.Chasm)
  })

  it('test_non_destructible_blocked_tile_destroy_is_a_no_op', () => {
    const board = makeBoard()
    const tile = { col: 4, row: 5 }
    board.setTerrain(tile, TerrainType.Blocked)

    const result = board.setTerrain(tile, TerrainType.Normal)

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toBe('NotDestructible')
    expect(board.getTile(tile.col, tile.row).terrain).toBe(TerrainType.Blocked)
    expect(board.isBlocked(tile.col, tile.row)).toBe(true)
  })
})
