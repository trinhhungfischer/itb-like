// Combat Resolution — Story 002: Unit Lifecycle - Damage, Remove, Spawn
//
// Implements: production/epics/combat-resolution/story-002-unit-lifecycle.md
// GDD: design/gdd/combat-resolution.md (Rules 3, 8, 15; Formula F1)
// Governing ADR: docs/architecture/adr-0006-combat-resolve-single-mutation-path.md
//
// Naming: [system]_[feature]_test.ts / test_[scenario]_[expected].
// Deterministic: no RNG, no wall clock. Each test builds its own board/state.

import { describe, it, expect } from 'vitest'
import { makeBoard } from '../../../src/core/board/index.js'
import { resolve, CombatState } from '../../../src/core/combat/index.js'
import type { EffectPrimitive } from '../../../src/core/combat/index.js'

describe('combat-resolution: damage (Rule 3, Formula F1)', () => {
  it('test_damage_reducing_hp_to_zero_emits_damage_applied_and_unit_removed', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 1, row: 1 }, 'hero-1')
    state.registerUnit('hero-1', 5)

    const events = resolve(board, state, [{ kind: 'damage', targetId: 'hero-1', amount: 7 }])

    expect(events).toEqual([
      { type: 'damage_applied', targetId: 'hero-1', amount: 7, hp: 0 },
      { type: 'unit_removed', targetId: 'hero-1', cause: 'Defeated', tile: { col: 1, row: 1 } },
    ])
    expect(board.isOccupied(1, 1)).toBe(false)
    expect(state.hasUnit('hero-1')).toBe(false)
  })

  it('test_damage_below_hp_reduces_hp_and_fires_no_removal_event', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 1, row: 1 }, 'hero-1')
    state.registerUnit('hero-1', 10)

    const events = resolve(board, state, [{ kind: 'damage', targetId: 'hero-1', amount: 3 }])

    expect(events).toEqual([{ type: 'damage_applied', targetId: 'hero-1', amount: 3, hp: 7 }])
    expect(state.getHp('hero-1')).toBe(7)
    expect(board.isOccupied(1, 1)).toBe(true)
  })

  it('test_damage_with_negative_amount_throws_before_any_effect_applies', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 1, row: 1 }, 'hero-1')
    state.registerUnit('hero-1', 10)
    board.place({ col: 2, row: 1 }, 'hero-2')
    state.registerUnit('hero-2', 10)

    const effects: EffectPrimitive[] = [
      { kind: 'damage', targetId: 'hero-2', amount: 1 },
      { kind: 'damage', targetId: 'hero-1', amount: -1 },
    ]

    expect(() => resolve(board, state, effects)).toThrow()
    // The whole list was rejected up front — effect 1 never applied either.
    expect(state.getHp('hero-2')).toBe(10)
  })
})

describe('combat-resolution: spawnUnit (Rule 15)', () => {
  it('test_spawn_unit_on_clear_tile_creates_alive_unit_and_emits_unit_spawned', () => {
    const board = makeBoard()
    const state = CombatState.empty()

    const events = resolve(board, state, [
      { kind: 'spawnUnit', tile: { col: 3, row: 3 }, unitSpec: { id: 'enemy-1', hp: 8 } },
    ])

    expect(events).toEqual([
      {
        type: 'unit_spawned',
        unitId: 'enemy-1',
        tile: { col: 3, row: 3 },
        unitSpec: { id: 'enemy-1', hp: 8 },
      },
    ])
    expect(board.getOccupant(3, 3)).toBe('enemy-1')
    expect(state.hasUnit('enemy-1')).toBe(true)
    expect(state.getHp('enemy-1')).toBe(8)
  })

  it.each([
    ['Occupied', { col: 4, row: 4 }, (b: ReturnType<typeof makeBoard>) => b.place({ col: 4, row: 4 }, 'blocker')],
    ['OutOfBounds', { col: 99, row: 99 }, () => undefined],
  ] as const)('test_spawn_unit_on_%s_tile_is_rejected_no_op', (_label, tile, setup) => {
    const board = makeBoard()
    const state = CombatState.empty()
    setup(board)

    const events = resolve(board, state, [{ kind: 'spawnUnit', tile, unitSpec: { id: 'enemy-1', hp: 8 } }])

    expect(events).toEqual([{ type: 'spawn_unit_rejected', tile, reason: 'TileNotClear' }])
    expect(state.hasUnit('enemy-1')).toBe(false)
  })
})

describe('combat-resolution: removeUnit (Rule 8)', () => {
  it('test_remove_unit_clears_tile_and_emits_unit_removed_exactly_once', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 5, row: 5 }, 'hero-1')
    state.registerUnit('hero-1', 10)

    const events = resolve(board, state, [{ kind: 'removeUnit', targetId: 'hero-1', cause: 'Defeated' }])

    expect(events).toEqual([{ type: 'unit_removed', targetId: 'hero-1', cause: 'Defeated', tile: { col: 5, row: 5 } }])
    expect(board.isOccupied(5, 5)).toBe(false)
  })

  it('test_remove_unit_called_twice_is_idempotent_no_second_event', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 5, row: 5 }, 'hero-1')
    state.registerUnit('hero-1', 10)

    const effects: EffectPrimitive[] = [
      { kind: 'removeUnit', targetId: 'hero-1', cause: 'Defeated' },
      { kind: 'removeUnit', targetId: 'hero-1', cause: 'Fell' },
    ]
    const events = resolve(board, state, effects)

    expect(events).toEqual([{ type: 'unit_removed', targetId: 'hero-1', cause: 'Defeated', tile: { col: 5, row: 5 } }])
  })
})
