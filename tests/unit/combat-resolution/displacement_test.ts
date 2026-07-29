// Combat Resolution — Story 003: Displacement - Push, Pull and Collision
//
// Implements: production/epics/combat-resolution/story-003-displacement.md
// GDD: design/gdd/combat-resolution.md (Rules 4, 5, 10, 11, 12; Formula F2)
// Governing ADR: docs/architecture/adr-0006-combat-resolve-single-mutation-path.md
//
// Naming: [system]_[feature]_test.ts / test_[scenario]_[expected].
// Deterministic: no RNG, no wall clock. Each test builds its own board/state.

import { describe, it, expect } from 'vitest'
import { makeBoard, TerrainType } from '../../../src/core/board/index.js'
import { resolve, CombatState } from '../../../src/core/combat/index.js'
import type { EffectPrimitive } from '../../../src/core/combat/index.js'

describe('combat-resolution: push edge/wall/unit collisions (Rules 4, 10, 12; Formula F2)', () => {
  it('test_push_into_board_edge_stops_short_and_deals_collision_damage_once', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 7, row: 3 }, 'hero-1')
    state.registerUnit('hero-1', 10)

    const events = resolve(board, state, [{ kind: 'push', targetId: 'hero-1', direction: 'E', distance: 2 }])

    expect(board.getOccupant(7, 3)).toBe('hero-1')
    expect(events).toEqual([
      { type: 'collision_resolved', a: 'hero-1', collisionDamage: 1, kind: 'Edge' },
      { type: 'damage_applied', targetId: 'hero-1', amount: 1, hp: 9 },
    ])
  })

  it('test_push_into_occupied_tile_stops_one_short_both_units_take_collision_damage_no_chain', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 2, row: 3 }, 'hero-1')
    state.registerUnit('hero-1', 10)
    board.place({ col: 5, row: 3 }, 'enemy-1')
    state.registerUnit('enemy-1', 10)

    const events = resolve(board, state, [{ kind: 'push', targetId: 'hero-1', direction: 'E', distance: 3 }])

    expect(board.getOccupant(4, 3)).toBe('hero-1')
    expect(board.getOccupant(5, 3)).toBe('enemy-1')
    expect(events).toEqual([
      { type: 'collision_resolved', a: 'hero-1', b: 'enemy-1', collisionDamage: 1, kind: 'Unit' },
      { type: 'damage_applied', targetId: 'hero-1', amount: 1, hp: 9 },
      { type: 'damage_applied', targetId: 'enemy-1', amount: 1, hp: 9 },
    ])
  })

  it('test_push_into_chasm_removes_unit_with_cause_fell', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.setTerrain({ col: 3, row: 4 }, TerrainType.Chasm)
    board.place({ col: 3, row: 3 }, 'hero-1')
    state.registerUnit('hero-1', 10)

    const events = resolve(board, state, [{ kind: 'push', targetId: 'hero-1', direction: 'S', distance: 1 }])

    expect(events).toEqual([{ type: 'unit_removed', targetId: 'hero-1', cause: 'Fell', tile: { col: 3, row: 4 } }])
    expect(board.isOccupied(3, 3)).toBe(false)
    expect(board.isOccupied(3, 4)).toBe(false)
  })

  it('test_push_landing_on_hazarded_clear_tile_triggers_hazard_on_entry_exactly_once', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 2, row: 2 }, 'hero-1')
    state.registerUnit('hero-1', 10)
    board.setHazard({ col: 3, row: 2 }, 'Fire')
    state.setHazardDuration({ col: 3, row: 2 }, null)

    const events = resolve(board, state, [{ kind: 'push', targetId: 'hero-1', direction: 'E', distance: 1 }])

    expect(events).toEqual([
      { type: 'hazard_applied', tile: { col: 3, row: 2 }, unitId: 'hero-1', amount: 1 },
      { type: 'damage_applied', targetId: 'hero-1', amount: 1, hp: 9 },
      { type: 'displacement_complete', targetId: 'hero-1', stepsMoved: 1 },
    ])
  })
})

describe('combat-resolution: pull (Rule 5)', () => {
  it('test_pull_without_explicit_direction_throws', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 1, row: 1 }, 'hero-1')
    state.registerUnit('hero-1', 10)
    board.place({ col: 3, row: 1 }, 'caster-1')
    state.registerUnit('caster-1', 10)

    const malformedPull = { kind: 'pull', targetId: 'hero-1', sourceId: 'caster-1', distance: 2 } as unknown as EffectPrimitive

    expect(() => resolve(board, state, [malformedPull])).toThrow()
  })

  it('test_pull_landing_on_source_own_tile_deals_collision_damage_to_both_target_and_source', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 5, row: 1 }, 'hero-1') // target, 2 tiles east of source
    state.registerUnit('hero-1', 10)
    board.place({ col: 3, row: 1 }, 'caster-1') // source/puller
    state.registerUnit('caster-1', 10)

    const events = resolve(board, state, [
      { kind: 'pull', targetId: 'hero-1', sourceId: 'caster-1', direction: 'W', distance: 2 },
    ])

    // Target stops one tile short of the source's own tile (Occupied collision).
    expect(board.getOccupant(4, 1)).toBe('hero-1')
    expect(board.getOccupant(3, 1)).toBe('caster-1')
    
    const filteredEvents = events.filter(e => e.type !== 'on_hit');
    expect(filteredEvents).toEqual([
      { type: 'collision_resolved', a: 'hero-1', b: 'caster-1', collisionDamage: 1, kind: 'Unit' },
      { type: 'damage_applied', targetId: 'hero-1', amount: 1, hp: 9 },
      { type: 'damage_applied', targetId: 'caster-1', amount: 1, hp: 9 },
    ])
  })
})

describe('combat-resolution: determinism & ordering (Edge Cases)', () => {
  it('test_two_pushes_to_same_destination_first_in_list_claims_the_tile', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 1, row: 5 }, 'hero-a')
    state.registerUnit('hero-a', 10)
    board.place({ col: 3, row: 5 }, 'hero-b')
    state.registerUnit('hero-b', 10)

    const effects: EffectPrimitive[] = [
      { kind: 'push', targetId: 'hero-a', direction: 'E', distance: 1 }, // -> (2,5), Clear, claims it
      { kind: 'push', targetId: 'hero-b', direction: 'W', distance: 1 }, // -> (2,5) now Occupied by hero-a
    ]

    resolve(board, state, effects)

    expect(board.getOccupant(2, 5)).toBe('hero-a')
    expect(board.getOccupant(3, 5)).toBe('hero-b')
  })

  it('test_swapping_effect_order_changes_which_push_claims_the_tile', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 1, row: 6 }, 'hero-a')
    state.registerUnit('hero-a', 10)
    board.place({ col: 3, row: 6 }, 'hero-b')
    state.registerUnit('hero-b', 10)

    const effects: EffectPrimitive[] = [
      { kind: 'push', targetId: 'hero-b', direction: 'W', distance: 1 }, // -> (2,6), Clear, claims it
      { kind: 'push', targetId: 'hero-a', direction: 'E', distance: 1 }, // -> (2,6) now Occupied by hero-b
    ]

    resolve(board, state, effects)

    expect(board.getOccupant(2, 6)).toBe('hero-b')
    expect(board.getOccupant(1, 6)).toBe('hero-a')
  })
})
