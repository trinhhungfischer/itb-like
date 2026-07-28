// Combat Resolution — Story 005: Hazard Integration
//
// Implements: production/epics/combat-resolution/story-005-hazard-integration.md
// GDD: design/gdd/combat-resolution.md (Rule 7, Formulas F3-F4)
// Governing ADRs:
//  - docs/architecture/adr-0006-combat-resolve-single-mutation-path.md
//  - docs/architecture/adr-0008-shared-unit-record.md (hazardImmunities threading)
//
// Naming: [system]_[feature]_test.ts / test_[scenario]_[expected].
// Deterministic: no RNG, no wall clock. Each test builds its own board/state.

import { describe, it, expect } from 'vitest'
import { makeBoard } from '../../../src/core/board/index.js'
import { resolve, CombatState, DEFAULT_COMBAT_CONFIG } from '../../../src/core/combat/index.js'
import type { EffectPrimitive } from '../../../src/core/combat/index.js'

describe('combat-resolution: spawnHazard / applyHazard split responsibility (Rule 7)', () => {
  it('test_spawn_hazard_alone_sets_the_tile_but_deals_no_damage_to_occupant', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 2, row: 2 }, 'hero-1')
    state.registerUnit('hero-1', 10)

    const events = resolve(board, state, [
      { kind: 'spawnHazard', tile: { col: 2, row: 2 }, hazardType: 'Fire', duration: 3 },
    ])

    expect(events).toEqual([{ type: 'hazard_spawned', tile: { col: 2, row: 2 }, hazardType: 'Fire', duration: 3 }])
    expect(board.getHazard(2, 2)).toBe('Fire')
    expect(state.getHp('hero-1')).toBe(10)
  })

  it('test_spawn_hazard_then_apply_hazard_in_same_chain_damages_the_occupant', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 2, row: 2 }, 'hero-1')
    state.registerUnit('hero-1', 10)

    const effects: EffectPrimitive[] = [
      { kind: 'spawnHazard', tile: { col: 2, row: 2 }, hazardType: 'Fire', duration: 3 },
      { kind: 'applyHazard', tile: { col: 2, row: 2 } },
    ]
    const events = resolve(board, state, effects)

    expect(events).toEqual([
      { type: 'hazard_spawned', tile: { col: 2, row: 2 }, hazardType: 'Fire', duration: 3 },
      { type: 'hazard_applied', tile: { col: 2, row: 2 }, unitId: 'hero-1', amount: 1 },
      { type: 'damage_applied', targetId: 'hero-1', amount: 1, hp: 9 },
    ])
  })

  it('test_apply_hazard_on_tile_with_no_hazard_is_a_no_op', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 2, row: 2 }, 'hero-1')
    state.registerUnit('hero-1', 10)

    const events = resolve(board, state, [{ kind: 'applyHazard', tile: { col: 2, row: 2 } }])

    expect(events).toEqual([])
    expect(state.getHp('hero-1')).toBe(10)
  })

  it('test_apply_hazard_on_hazarded_tile_with_no_occupant_is_a_no_op', () => {
    const board = makeBoard()
    const state = CombatState.empty()

    const effects: EffectPrimitive[] = [
      { kind: 'spawnHazard', tile: { col: 2, row: 2 }, hazardType: 'Fire', duration: 3 },
      { kind: 'applyHazard', tile: { col: 2, row: 2 } },
    ]
    const events = resolve(board, state, effects)

    expect(events).toEqual([{ type: 'hazard_spawned', tile: { col: 2, row: 2 }, hazardType: 'Fire', duration: 3 }])
  })
})

describe('combat-resolution: hazard duration (Formula F4)', () => {
  it('test_apply_hazard_decrements_finite_duration_and_auto_clears_at_zero', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 2, row: 2 }, 'hero-1')
    state.registerUnit('hero-1', 10)

    const effects: EffectPrimitive[] = [
      { kind: 'spawnHazard', tile: { col: 2, row: 2 }, hazardType: 'Fire', duration: 1 },
      { kind: 'applyHazard', tile: { col: 2, row: 2 } },
    ]
    resolve(board, state, effects)

    expect(board.getHazard(2, 2)).toBeNull()
    // A further applyHazard on the now-cleared tile is a no-op.
    const events = resolve(board, state, [{ kind: 'applyHazard', tile: { col: 2, row: 2 } }])
    expect(events).toEqual([])
  })

  it('test_apply_hazard_with_permanent_duration_never_auto_clears', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 2, row: 2 }, 'hero-1')
    state.registerUnit('hero-1', 20)

    const effects: EffectPrimitive[] = [
      { kind: 'spawnHazard', tile: { col: 2, row: 2 }, hazardType: 'Fire', duration: null },
      { kind: 'applyHazard', tile: { col: 2, row: 2 } },
      { kind: 'applyHazard', tile: { col: 2, row: 2 } },
      { kind: 'applyHazard', tile: { col: 2, row: 2 } },
    ]
    resolve(board, state, effects)

    expect(board.getHazard(2, 2)).toBe('Fire')
    expect(state.getHp('hero-1')).toBe(17)
  })
})

describe('combat-resolution: fire_damage_per_tick is config-driven, not a hardcoded literal', () => {
  it('test_apply_hazard_reads_fire_damage_per_tick_from_the_supplied_config', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 2, row: 2 }, 'hero-1')
    state.registerUnit('hero-1', 10)
    const customConfig = { ...DEFAULT_COMBAT_CONFIG, fireDamagePerTick: 3 }

    const effects: EffectPrimitive[] = [
      { kind: 'spawnHazard', tile: { col: 2, row: 2 }, hazardType: 'Fire', duration: 3 },
      { kind: 'applyHazard', tile: { col: 2, row: 2 } },
    ]
    const events = resolve(board, state, effects, { config: customConfig })

    expect(events).toContainEqual({ type: 'hazard_applied', tile: { col: 2, row: 2 }, unitId: 'hero-1', amount: 3 })
    expect(state.getHp('hero-1')).toBe(7)
  })
})

describe('combat-resolution: hazardImmunities threading (ADR-0008)', () => {
  it('test_immune_unit_takes_no_damage_and_no_hazard_applied_event_fires', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 2, row: 2 }, 'hero-1')
    state.registerUnit('hero-1', 10, ['Fire'])

    const effects: EffectPrimitive[] = [
      { kind: 'spawnHazard', tile: { col: 2, row: 2 }, hazardType: 'Fire', duration: 3 },
      { kind: 'applyHazard', tile: { col: 2, row: 2 } },
    ]
    const events = resolve(board, state, effects)

    expect(events).toEqual([{ type: 'hazard_spawned', tile: { col: 2, row: 2 }, hazardType: 'Fire', duration: 3 }])
    expect(state.getHp('hero-1')).toBe(10)
  })

  it('test_non_immune_unit_on_same_tile_type_still_takes_damage', () => {
    // Control case proving immunity is per-unit, not a global hazard-type switch.
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 2, row: 2 }, 'hero-1')
    state.registerUnit('hero-1', 10, ['Acid']) // immune to Acid, not Fire

    const effects: EffectPrimitive[] = [
      { kind: 'spawnHazard', tile: { col: 2, row: 2 }, hazardType: 'Fire', duration: 3 },
      { kind: 'applyHazard', tile: { col: 2, row: 2 } },
    ]
    const events = resolve(board, state, effects)

    expect(events).toContainEqual({ type: 'hazard_applied', tile: { col: 2, row: 2 }, unitId: 'hero-1', amount: 1 })
    expect(state.getHp('hero-1')).toBe(9)
  })
})

describe('combat-resolution: hazard damage can kill (Formula F1/F3 shared defeat trigger)', () => {
  it('test_apply_hazard_reducing_hp_to_zero_emits_unit_removed', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 2, row: 2 }, 'hero-1')
    state.registerUnit('hero-1', 1)

    const effects: EffectPrimitive[] = [
      { kind: 'spawnHazard', tile: { col: 2, row: 2 }, hazardType: 'Fire', duration: 3 },
      { kind: 'applyHazard', tile: { col: 2, row: 2 } },
    ]
    const events = resolve(board, state, effects)

    expect(events).toEqual([
      { type: 'hazard_spawned', tile: { col: 2, row: 2 }, hazardType: 'Fire', duration: 3 },
      { type: 'hazard_applied', tile: { col: 2, row: 2 }, unitId: 'hero-1', amount: 1 },
      { type: 'damage_applied', targetId: 'hero-1', amount: 1, hp: 0 },
      { type: 'unit_removed', targetId: 'hero-1', cause: 'Defeated', tile: { col: 2, row: 2 } },
    ])
    expect(board.isOccupied(2, 2)).toBe(false)
  })
})

describe('combat-resolution: spawnUnit onto a hazarded tile (Rule 15 Edge Case)', () => {
  it('test_spawn_unit_onto_hazarded_clear_tile_is_not_damaged_by_the_existing_hazard', () => {
    const board = makeBoard()
    const state = CombatState.empty()

    const events = resolve(board, state, [
      { kind: 'spawnHazard', tile: { col: 3, row: 3 }, hazardType: 'Fire', duration: 3 },
      { kind: 'spawnUnit', tile: { col: 3, row: 3 }, unitSpec: { id: 'enemy-1', hp: 5 } },
    ])

    expect(events).toEqual([
      { type: 'hazard_spawned', tile: { col: 3, row: 3 }, hazardType: 'Fire', duration: 3 },
      { type: 'unit_spawned', unitId: 'enemy-1', tile: { col: 3, row: 3 }, unitSpec: { id: 'enemy-1', hp: 5 } },
    ])
    expect(state.getHp('enemy-1')).toBe(5)
  })
})
