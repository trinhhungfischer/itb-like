// Combat Resolution — Story 003: Smoke Hazard
//
// Implements: production/epics/gadgets-secondary/story-003-smoke-hazard.md
//
import { describe, it, expect } from 'vitest'
import { makeBoard } from '../../../src/core/board/index.js'
import { resolve, CombatState } from '../../../src/core/combat/index.js'
import { legalTargets } from '../../../src/feature/heroes-abilities/ability-targeting.js'
import type { AbilityDefinition } from '../../../src/feature/heroes-abilities/ability-targeting.js'
import { EnemyAbilitiesAndTelegraph } from '../../../src/feature/enemy/enemy-abilities-and-telegraph.js'

describe('smoke-hazard: Target blocking and movement', () => {
  it('AC-1: AI targeting ignores units on Smoke', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 2, row: 2 }, 'enemy-1')
    state.registerUnit('enemy-1', 10)

    board.place({ col: 2, row: 4 }, 'hero-1') // distance 2
    state.registerUnit('hero-1', 10)

    const enemyUnit = {
      id: 'enemy-1',
      position: { col: 2, row: 2 },
      team: 'enemy',
      abilities: [{ id: 'Attack', shape: { type: 'UnitTarget', range: 3 } }]
    } as any

    const heroUnit = {
      id: 'hero-1',
      position: { col: 2, row: 4 },
      team: 'player'
    } as any

    const unitProvider = {
      getAliveEnemies: () => [enemyUnit],
      getAliveHeroes: () => [heroUnit]
    }

    const ai = new EnemyAbilitiesAndTelegraph({ resolve } as any, state, unitProvider)
    
    // First without smoke
    ai.chooseIntents(board)
    expect(ai.getIntent('enemy-1')?.targetId).toBe('hero-1')

    // Add Smoke
    board.setHazard({ col: 2, row: 4 }, 'Smoke')
    ai.chooseIntents(board)
    // Should idle because only hero is in smoke
    expect(ai.getIntent('enemy-1')?.abilityId).toBe('Idle')
  })

  it('AC-1: Player targeting ignores units on Smoke', () => {
    const board = makeBoard()
    board.place({ col: 2, row: 2 }, 'hero-1')
    board.place({ col: 2, row: 4 }, 'enemy-1')

    const caster = { id: 'hero-1', position: { col: 2, row: 2 }, team: 'player' } as any
    const target = { id: 'enemy-1', position: { col: 2, row: 4 }, team: 'enemy' } as any
    const getUnit = (id: string) => (id === 'hero-1' ? caster : target)

    const ability: AbilityDefinition = {
      id: 'Shoot',
      shape: { type: 'UnitTarget', range: 3 },
      targetFilter: 'Enemy'
    }

    // Without smoke
    let targets = legalTargets(caster, ability, board, getUnit)
    expect(targets).toContainEqual({ col: 2, row: 4 })

    // With smoke
    board.setHazard({ col: 2, row: 4 }, 'Smoke')
    targets = legalTargets(caster, ability, board, getUnit)
    expect(targets).not.toContainEqual({ col: 2, row: 4 })
  })

  it('AC-2: Movement is allowed on Smoke (Smoke does not block)', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 2, row: 2 }, 'hero-1')
    state.registerUnit('hero-1', 10)
    
    // Put smoke in the way
    board.setHazard({ col: 2, row: 3 }, 'Smoke')

    // Push hero through smoke
    resolve(board, state, [{ kind: 'push', targetId: 'hero-1', direction: 'S', distance: 1 }])

    // Should move successfully onto the smoke tile
    expect(board.getOccupant(2, 3)).toBe('hero-1')
    
    // Smoke should deal 0 damage
    expect(state.getHp('hero-1')).toBe(10)
  })

  it('Smoke deals 0 damage when applied', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 2, row: 2 }, 'hero-1')
    state.registerUnit('hero-1', 10)
    
    // Put smoke on hero
    resolve(board, state, [
      { kind: 'spawnHazard', tile: { col: 2, row: 2 }, hazardType: 'Smoke', duration: 1 },
      { kind: 'applyHazard', tile: { col: 2, row: 2 } }
    ])

    // Hero takes no damage
    expect(state.getHp('hero-1')).toBe(10)
    // Duration decremented
    expect(board.getHazard(2, 2)).toBeNull()
  })
})
