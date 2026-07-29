// Heroes & Abilities — Story 004: Decoy Drone
//
// Implements: production/epics/gadgets-secondary/story-004-decoy-drone.md
//
import { describe, it, expect } from 'vitest'
import { makeBoard } from '../../../src/core/board/index.js'
import { resolve, CombatState } from '../../../src/core/combat/index.js'
import { constructDecoyDrone } from '../../../src/feature/heroes-abilities/decoy-drone.js'
import { EnemyAbilitiesAndTelegraph } from '../../../src/feature/enemy/enemy-abilities-and-telegraph.js'

describe('decoy-drone: Target selection (AC-1)', () => {
  it('AC-1: Enemy selects Decoy Drone if it is the nearest threat', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    
    // Setup Enemy
    board.place({ col: 2, row: 2 }, 'enemy-1')
    state.registerUnit('enemy-1', 10)
    const enemyUnit = {
      id: 'enemy-1',
      position: { col: 2, row: 2 },
      team: 'enemy',
      abilities: [{ id: 'Attack', shape: { type: 'UnitTarget', range: 1 } }]
    } as any

    // Setup Decoy Drone (closer)
    board.place({ col: 2, row: 3 }, 'decoy-1')
    state.registerUnit('decoy-1', 1)
    const decoyUnit = constructDecoyDrone('decoy-1', { col: 2, row: 3 })

    // Setup Hero (farther)
    board.place({ col: 2, row: 5 }, 'hero-1')
    state.registerUnit('hero-1', 10)
    const heroUnit = {
      id: 'hero-1',
      position: { col: 2, row: 5 },
      team: 'hero', // Unit is hero
      archetype: 'Soldier',
      maxHP: 10,
      currentHP: 10,
      size: 1,
      abilities: [],
      hazardImmunities: [],
      statusFlags: [],
      moveSlot: 'Available',
      abilitySlot: 'Available'
    } as any

    const unitProvider = {
      getAliveEnemies: () => [enemyUnit],
      getAliveHeroes: () => [decoyUnit, heroUnit] // Decoy counts as hero
    }

    const ai = new EnemyAbilitiesAndTelegraph({ resolve } as any, state, unitProvider)
    
    ai.chooseIntents(board)

    const intent = ai.getIntent('enemy-1')
    expect(intent).toBeDefined()
    // The decoy is at distance 1, hero is at distance 3.
    // The F1 Nearest-Threat should target the decoy.
    expect(intent?.targetId).toBe('decoy-1')
  })
})
