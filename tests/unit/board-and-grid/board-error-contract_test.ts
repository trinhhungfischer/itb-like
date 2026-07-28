// Board & Grid — Story 004: Board Error Contract
//
// Implements: production/epics/board-grid/story-004-board-error-contract.md
// Governing ADR: docs/architecture/adr-0005-board-combat-error-contract.md
//
// Channel 1 (expected gameplay rejection) must return a Result and must
// NEVER throw. Channel 2 (programmer error) must throw InvariantError. This
// file asserts both the *shape* of Channel-1 failures (not just truthiness)
// and that Channel-2 conditions throw the correct error type — plus the
// origin-vs-destination boundary note: an out-of-bounds *destination*
// (classify) is Channel 1, never a throw; only an out-of-bounds *origin*
// argument is Channel 2.
//
// Naming: [system]_[feature]_test.ts / test_[scenario]_[expected].
// Deterministic: no RNG, no wall clock. Each test builds its own board.

import { describe, it, expect } from 'vitest'
import { makeBoard } from '../../../src/core/board/board.js'
import { TerrainType } from '../../../src/core/board/board-types.js'
import { InvariantError } from '../../../src/core/board/board-result.js'
import type { Tile } from '../../../src/core/board/board-types.js'

describe('board-and-grid: Channel 1 — Result, never throw', () => {
  it('test_place_on_occupied_tile_returns_result_reject_occupied_shape', () => {
    const board = makeBoard()
    const tile = { col: 1, row: 1 }
    board.place(tile, 'hero-A')

    let result
    expect(() => {
      result = board.place(tile, 'hero-B')
    }).not.toThrow()

    expect(result).toEqual({ ok: false, reason: 'Occupied' })
    expect(board.getOccupant(tile.col, tile.row)).toBe('hero-A')
  })

  it('test_set_terrain_would_strand_occupant_returns_result_reject_shape', () => {
    const board = makeBoard()
    const tile = { col: 2, row: 2 }
    board.place(tile, 'hero-A')

    let result
    expect(() => {
      result = board.setTerrain(tile, TerrainType.Blocked)
    }).not.toThrow()

    expect(result).toEqual({ ok: false, reason: 'WouldStrandOccupant' })
    expect(board.getTile(tile.col, tile.row).terrain).toBe(TerrainType.Normal)
  })

  it('test_destroy_non_destructible_returns_result_reject_not_destructible_shape', () => {
    const board = makeBoard()
    const tile = { col: 3, row: 3 }
    board.setTerrain(tile, TerrainType.Blocked)

    let result
    expect(() => {
      result = board.setTerrain(tile, TerrainType.Normal)
    }).not.toThrow()

    expect(result).toEqual({ ok: false, reason: 'NotDestructible' })
  })

  it('test_clear_and_set_hazard_and_set_flag_never_return_a_rejectable_result', () => {
    // Per ADR-0005's BoardMutations interface, clear/setHazard/setFlag are
    // typed `void` — they always succeed, there is no rejection channel.
    const board = makeBoard()
    const tile = { col: 4, row: 4 }
    expect(board.clear(tile)).toBeUndefined()
    expect(board.setHazard(tile, 'fire')).toBeUndefined()
    expect(board.setFlag(tile, 'objective')).toBeUndefined()
  })

  it('test_push_destination_out_of_bounds_is_channel_one_classify_never_throws', () => {
    // Boundary note (ADR-0005): an OOB push/move *destination* is an ordinary
    // gameplay outcome (edge collision), detected via classify — not a throw.
    const board = makeBoard()
    const edge = { col: board.width - 1, row: 3 }
    let destination: Tile = edge
    expect(() => {
      destination = board.step(edge, 'E')
    }).not.toThrow()
    expect(board.inBounds(destination.col, destination.row)).toBe(false)

    let classificationKind = ''
    expect(() => {
      classificationKind = board.classify(destination).kind
    }).not.toThrow()
    expect(classificationKind).toBe('OutOfBounds')
  })
})

describe('board-and-grid: Channel 2 — assert/throw', () => {
  it('test_construction_width_less_than_one_throws_invariant_error', () => {
    expect(() => makeBoard({ width: 0 })).toThrow(InvariantError)
  })

  it('test_construction_height_less_than_one_throws_invariant_error', () => {
    expect(() => makeBoard({ height: 0 })).toThrow(InvariantError)
  })

  it('test_tiles_in_range_with_out_of_bounds_origin_throws', () => {
    const board = makeBoard()
    expect(() => board.tilesInRange({ col: -1, row: 0 }, 2)).toThrow(InvariantError)
  })

  it('test_neighbors_with_out_of_bounds_origin_throws', () => {
    const board = makeBoard()
    expect(() => board.neighbors(board.width, 0)).toThrow(InvariantError)
  })

  it('test_tiles_in_range_with_negative_radius_throws', () => {
    const board = makeBoard()
    expect(() => board.tilesInRange({ col: 3, row: 3 }, -1)).toThrow(InvariantError)
  })

  it('test_query_with_negative_coordinate_throws', () => {
    const board = makeBoard()
    expect(() => board.getOccupant(-1, 0)).toThrow(InvariantError)
    expect(() => board.isOccupied(0, -1)).toThrow(InvariantError)
  })

  it('test_mutation_with_out_of_bounds_tile_throws', () => {
    const board = makeBoard()
    expect(() => board.place({ col: -1, row: 0 }, 'hero-1')).toThrow(InvariantError)
    expect(() => board.setTerrain({ col: board.width, row: 0 }, TerrainType.Blocked)).toThrow(InvariantError)
  })

  it('test_reachable_tiles_with_out_of_bounds_origin_throws', () => {
    const board = makeBoard()
    expect(() => board.reachableTiles({ col: -1, row: 0 }, 2, board)).toThrow(InvariantError)
  })

  it('test_ray_tiles_with_negative_max_length_throws', () => {
    const board = makeBoard()
    expect(() => board.rayTiles({ col: 0, row: 0 }, 'E', -1)).toThrow(InvariantError)
  })
})
