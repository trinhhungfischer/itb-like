// Combat Resolution — Story 004: Swap and Terrain
//
// Implements: production/epics/combat-resolution/story-004-swap-and-terrain.md
// GDD: design/gdd/combat-resolution.md (Rules 6, 14)
// Governing ADR: docs/architecture/adr-0006-combat-resolve-single-mutation-path.md
//
// NOTE on the "Blocked tile" teardown case: Board & Grid models two distinct
// impassable terrain values — TerrainType.Blocked (permanent) and
// TerrainType.BlockedDestructible (can setTerrain(..., Normal) back to
// Normal) — see src/core/board/board-types.ts. The GDD's Rule 14 "wall verb"
// (raise a wall, tear it back down) can only be realized with
// BlockedDestructible; a plain Blocked tile is intentionally permanent per
// Board's own error contract (ADR-0005: setTerrain(Normal) on non-destructible
// Blocked -> Rejected(NotDestructible)). This file tests the teardown case
// against BlockedDestructible and separately proves plain Blocked stays
// permanent, reconciling the story's generic "Blocked tile" wording with the
// actual two-variant Board model — see this implementer's report.
//
// Naming: [system]_[feature]_test.ts / test_[scenario]_[expected].
// Deterministic: no RNG, no wall clock. Each test builds its own board/state.

import { describe, it, expect } from 'vitest'
import { makeBoard, TerrainType } from '../../../src/core/board/index.js'
import { resolve, CombatState } from '../../../src/core/combat/index.js'
import type { EffectPrimitive } from '../../../src/core/combat/index.js'

describe('combat-resolution: swap (Rule 6)', () => {
  it('test_swap_exchanges_both_units_positions_and_emits_swap_complete', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 1, row: 1 }, 'hero-a')
    state.registerUnit('hero-a', 10)
    board.place({ col: 4, row: 4 }, 'hero-b')
    state.registerUnit('hero-b', 10)

    const events = resolve(board, state, [{ kind: 'swap', unitAId: 'hero-a', unitBId: 'hero-b' }])

    expect(board.getOccupant(4, 4)).toBe('hero-a')
    expect(board.getOccupant(1, 1)).toBe('hero-b')
    expect(events).toEqual([{ type: 'swap_complete', unitAId: 'hero-a', unitBId: 'hero-b' }])
  })

  it('test_swap_with_a_unit_removed_earlier_in_chain_is_rejected_no_partial_swap', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 1, row: 1 }, 'hero-a')
    state.registerUnit('hero-a', 10)
    board.place({ col: 4, row: 4 }, 'hero-b')
    state.registerUnit('hero-b', 10)

    const effects: EffectPrimitive[] = [
      { kind: 'removeUnit', targetId: 'hero-a', cause: 'Defeated' },
      { kind: 'swap', unitAId: 'hero-a', unitBId: 'hero-b' },
    ]
    const events = resolve(board, state, effects)

    expect(events).toEqual([
      { type: 'unit_removed', targetId: 'hero-a', cause: 'Defeated', tile: { col: 1, row: 1 } },
      { type: 'swap_failed', unitAId: 'hero-a', unitBId: 'hero-b', reason: 'UnitNotOnBoard' },
    ])
    // B never moved.
    expect(board.getOccupant(4, 4)).toBe('hero-b')
  })

  it('test_swap_landing_on_hazarded_tiles_fires_hazard_on_entry_independently_for_each_unit', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 1, row: 1 }, 'hero-a')
    state.registerUnit('hero-a', 10)
    board.place({ col: 4, row: 4 }, 'hero-b')
    state.registerUnit('hero-b', 10)
    board.setHazard({ col: 1, row: 1 }, 'Fire')
    state.setHazardDuration({ col: 1, row: 1 }, null)
    board.setHazard({ col: 4, row: 4 }, 'Fire')
    state.setHazardDuration({ col: 4, row: 4 }, null)

    const events = resolve(board, state, [{ kind: 'swap', unitAId: 'hero-a', unitBId: 'hero-b' }])

    expect(events).toEqual([
      { type: 'swap_complete', unitAId: 'hero-a', unitBId: 'hero-b' },
      { type: 'hazard_applied', tile: { col: 4, row: 4 }, unitId: 'hero-a', amount: 1 },
      { type: 'damage_applied', targetId: 'hero-a', amount: 1, hp: 9 },
      { type: 'hazard_applied', tile: { col: 1, row: 1 }, unitId: 'hero-b', amount: 1 },
      { type: 'damage_applied', targetId: 'hero-b', amount: 1, hp: 9 },
    ])
  })
})

describe('combat-resolution: setTerrain (Rule 14)', () => {
  it('test_set_terrain_blocked_destructible_blocks_a_subsequent_push_as_a_wall', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 2, row: 2 }, 'hero-1')
    state.registerUnit('hero-1', 10)

    const effects: EffectPrimitive[] = [
      { kind: 'setTerrain', tile: { col: 3, row: 2 }, terrainType: TerrainType.BlockedDestructible },
      { kind: 'push', targetId: 'hero-1', direction: 'E', distance: 1 },
    ]
    const events = resolve(board, state, effects)

    expect(events[0]).toEqual({ type: 'terrain_set', tile: { col: 3, row: 2 }, terrainType: TerrainType.BlockedDestructible })
    expect(events).toContainEqual({ type: 'collision_resolved', a: 'hero-1', collisionDamage: 1, kind: 'Wall' })
    expect(board.getOccupant(2, 2)).toBe('hero-1')
  })

  it('test_set_terrain_torn_down_becomes_clear_and_pushable', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.setTerrain({ col: 5, row: 5 }, TerrainType.BlockedDestructible)
    board.place({ col: 4, row: 5 }, 'hero-1')
    state.registerUnit('hero-1', 10)

    const events = resolve(board, state, [{ kind: 'setTerrain', tile: { col: 5, row: 5 }, terrainType: TerrainType.Normal }])

    expect(events).toEqual([{ type: 'terrain_set', tile: { col: 5, row: 5 }, terrainType: TerrainType.Normal }])
    expect(board.classify({ col: 5, row: 5 })).toEqual({ kind: 'Clear' })

    const pushEvents = resolve(board, state, [{ kind: 'push', targetId: 'hero-1', direction: 'E', distance: 1 }])
    expect(board.getOccupant(5, 5)).toBe('hero-1')
    expect(pushEvents).toContainEqual({ type: 'displacement_complete', targetId: 'hero-1', stepsMoved: 1 })
  })

  it('test_set_terrain_on_occupied_tile_to_blocked_is_rejected_terrain_unchanged', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 6, row: 6 }, 'hero-1')
    state.registerUnit('hero-1', 10)

    const events = resolve(board, state, [
      { kind: 'setTerrain', tile: { col: 6, row: 6 }, terrainType: TerrainType.Blocked },
    ])

    expect(events).toEqual([
      { type: 'set_terrain_rejected', tile: { col: 6, row: 6 }, terrainType: TerrainType.Blocked, reason: 'WouldStrandOccupant' },
    ])
    expect(board.classify({ col: 6, row: 6 })).toEqual({ kind: 'Occupied', unitId: 'hero-1' })
  })

  it('test_set_terrain_normal_on_permanent_blocked_tile_is_rejected_not_destructible', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.setTerrain({ col: 7, row: 7 }, TerrainType.Blocked)

    const events = resolve(board, state, [
      { kind: 'setTerrain', tile: { col: 7, row: 7 }, terrainType: TerrainType.Normal },
    ])

    expect(events).toEqual([
      { type: 'set_terrain_rejected', tile: { col: 7, row: 7 }, terrainType: TerrainType.Normal, reason: 'NotDestructible' },
    ])
    expect(board.isBlocked(7, 7)).toBe(true)
  })
})
