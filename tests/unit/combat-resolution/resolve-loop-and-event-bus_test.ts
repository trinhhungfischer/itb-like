// Combat Resolution — Story 001: Resolve Loop and Event Bus
//
// Implements: production/epics/combat-resolution/story-001-resolve-loop-and-event-bus.md
// GDD: design/gdd/combat-resolution.md (Core Rules 1-2)
// Governing ADR: docs/architecture/adr-0006-combat-resolve-single-mutation-path.md
//
// Naming: [system]_[feature]_test.ts / test_[scenario]_[expected].
// Deterministic: no RNG, no wall clock. Each test builds its own board/state.

import { describe, it, expect } from 'vitest'
import { makeBoard, TerrainType } from '../../../src/core/board/index.js'
import { resolve, CombatState } from '../../../src/core/combat/index.js'
import type { EffectPrimitive } from '../../../src/core/combat/index.js'

describe('combat-resolution: resolve() contract (Rules 1-2)', () => {
  it('test_resolve_with_empty_effects_returns_empty_log_and_board_unchanged', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 2, row: 2 }, 'hero-1')

    const events = resolve(board, state, [])

    expect(events).toEqual([])
    expect(board.isOccupied(2, 2)).toBe(true)
    expect(board.getOccupant(2, 2)).toBe('hero-1')
  })

  it('test_resolve_applies_effects_strictly_sequentially_effect_i_sees_effect_i_minus_1', () => {
    // effect 2 (push into (3,3)) only collides with a Wall because effect 1
    // (setTerrain) ran first and changed (3,3) from Clear to Blocked.
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 2, row: 3 }, 'hero-1')
    state.registerUnit('hero-1', 10)

    const effects: EffectPrimitive[] = [
      { kind: 'setTerrain', tile: { col: 3, row: 3 }, terrainType: TerrainType.Blocked },
      { kind: 'push', targetId: 'hero-1', direction: 'E', distance: 1 },
    ]

    const events = resolve(board, state, effects)

    expect(events).toEqual([
      { type: 'terrain_set', tile: { col: 3, row: 3 }, terrainType: TerrainType.Blocked },
      { type: 'collision_resolved', a: 'hero-1', collisionDamage: 1, kind: 'Wall' },
      { type: 'damage_applied', targetId: 'hero-1', amount: 1, hp: 9 },
    ])
    // Unit never entered the now-Blocked tile.
    expect(board.getOccupant(2, 3)).toBe('hero-1')
    expect(board.isOccupied(3, 3)).toBe(false)
  })

  it('test_resolve_is_deterministic_across_100_runs_on_fresh_identical_boards', () => {
    const effects: EffectPrimitive[] = [
      { kind: 'spawnUnit', tile: { col: 1, row: 1 }, unitSpec: { id: 'hero-1', hp: 10 } },
      { kind: 'spawnUnit', tile: { col: 4, row: 1 }, unitSpec: { id: 'enemy-1', hp: 6 } },
      { kind: 'push', targetId: 'hero-1', direction: 'E', distance: 3 },
      { kind: 'spawnHazard', tile: { col: 2, row: 1 }, hazardType: 'Fire' },
      { kind: 'applyHazard', tile: { col: 2, row: 1 } },
    ]

    const results: unknown[] = []
    for (let run = 0; run < 100; run++) {
      const board = makeBoard()
      const state = CombatState.empty()
      const events = resolve(board, state, effects)
      results.push({ events, occupant2_1: board.getOccupant(2, 1), occupant3_1: board.getOccupant(3, 1) })
    }

    const first = JSON.stringify(results[0])
    for (const result of results) {
      expect(JSON.stringify(result)).toBe(first)
    }
  })

  it('test_resolve_with_no_valid_targets_ability_is_a_legal_no_op', () => {
    const board = makeBoard()
    const state = CombatState.empty()

    const events = resolve(board, state, [])

    expect(events).toEqual([])
  })
})
