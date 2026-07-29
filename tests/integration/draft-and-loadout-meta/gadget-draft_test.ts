// Draft & Loadout Meta — Story 005: Gadget Draft Integration
//
// Implements: production/epics/gadgets-secondary/story-005-draft-pool-integration.md
//
import { describe, it, expect } from 'vitest'
import { DraftSystem } from '../../../src/feature/draft-and-loadout-meta/draft-system.js'
import type { GadgetDefinition } from '../../../src/feature/heroes-abilities/equipment.js'

describe('gadget-draft: Draft reward pool and Shop (AC-1, AC-2)', () => {
  const testGadgets: GadgetDefinition[] = [
    { type: 'gadget', id: 'smoke-bomb', cooldownTurns: 3, usesPerBattle: 1, compatible: ['Soldier', 'Scout'] },
    { type: 'gadget', id: 'decoy-drone', cooldownTurns: 4, usesPerBattle: 1, compatible: ['Engineer'] }
  ]

  it('AC-1: Gadgets are valid candidates in the reward pool and respect compatibility', () => {
    const draftSystem = new DraftSystem(testGadgets)
    
    const soldierPool = draftSystem.generateRewardPool('Elite', 'Soldier')
    expect(soldierPool).toHaveLength(1)
    expect(soldierPool[0].id).toBe('smoke-bomb')

    const engineerPool = draftSystem.generateRewardPool('Boss', 'Engineer')
    expect(engineerPool).toHaveLength(1)
    expect(engineerPool[0].id).toBe('decoy-drone')
    
    const medicPool = draftSystem.generateRewardPool('Battle', 'Medic')
    expect(medicPool).toHaveLength(0)
  })

  it('AC-2: Gadgets in the Shop cost exactly 3 Reputation', () => {
    const draftSystem = new DraftSystem(testGadgets)
    const shop = draftSystem.generateShop()
    
    expect(shop).toHaveLength(2)
    for (const offer of shop) {
      expect(offer.item.type).toBe('gadget')
      expect(offer.cost).toBe(3)
    }
  })
})
