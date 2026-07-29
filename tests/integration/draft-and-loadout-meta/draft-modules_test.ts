import { describe, it, expect } from 'vitest';
import { DraftSystem } from '../../../src/feature/draft-and-loadout-meta/draft-system.js';
import { PASSIVE_CATALOG } from '../../../src/feature/heroes-abilities/passive-catalog.js';
import { equipItem, replaceItem, HeroRunState, EquipmentError } from '../../../src/feature/heroes-abilities/equipment.js';

describe('Draft Modules Integration', () => {
  it('AC-2: Attempting to equip a 3rd module prompts replacement', () => {
    let heroState: HeroRunState = { heroId: 'hero-1', equipment: [] };
    
    // Equip 1st
    heroState = equipItem(heroState, PASSIVE_CATALOG['C1']);
    expect(heroState.equipment.length).toBe(1);

    // Equip 2nd
    heroState = equipItem(heroState, PASSIVE_CATALOG['C2']);
    expect(heroState.equipment.length).toBe(2);

    // Attempting 3rd throws error (prompts replacement in UI)
    expect(() => equipItem(heroState, PASSIVE_CATALOG['C3'])).toThrow(EquipmentError);
    expect(() => equipItem(heroState, PASSIVE_CATALOG['C3'])).toThrow('Max 2 equipment slots allowed.');

    // Replace 1st module (C1) with 3rd module (C3)
    heroState = replaceItem(heroState, 0, PASSIVE_CATALOG['C3']);
    expect(heroState.equipment.length).toBe(2);
    expect(heroState.equipment[0].id).toBe('C3');
    expect(heroState.equipment[1].id).toBe('C2');
  });

  it('Adds modules to the draftable content pool, distributing by rarity weights', () => {
    const modules = Object.values(PASSIVE_CATALOG);
    const draftSystem = new DraftSystem([], modules);

    const squadEquipped: string[] = [];
    
    // Test Battle encounter (Common, Uncommon)
    const battlePool = draftSystem.generateRewardPool('Battle', 'Vanguard', 12345, squadEquipped);
    expect(battlePool.length).toBeLessThanOrEqual(3);
    for (const item of battlePool) {
      expect(item.type).toBe('passive');
      expect(['Common', 'Uncommon']).toContain((item as any).rarity);
    }

    // Test Boss encounter (Rare)
    const bossPool = draftSystem.generateRewardPool('Boss', 'Vanguard', 12345, squadEquipped);
    expect(bossPool.length).toBeLessThanOrEqual(3);
    for (const item of bossPool) {
      expect(item.type).toBe('passive');
      expect((item as any).rarity).toBe('Rare');
    }
  });

  it('Removes Squad-scoped modules from draft if already equipped', () => {
    const modules = Object.values(PASSIVE_CATALOG);
    const draftSystem = new DraftSystem([], modules);

    // U1 is Scavenger (Squad scope, Common)
    // First draft without it equipped
    let hasU1 = false;
    // We check 10 seeds to ensure U1 appears at least once
    for (let i = 0; i < 20; i++) {
      const pool = draftSystem.generateRewardPool('Battle', 'Vanguard', i, []);
      if (pool.some(item => item.id === 'U1')) {
        hasU1 = true;
        break;
      }
    }
    expect(hasU1).toBe(true);

    // Now draft WITH it equipped by the squad
    hasU1 = false;
    for (let i = 0; i < 20; i++) {
      const pool = draftSystem.generateRewardPool('Battle', 'Vanguard', i, ['U1']);
      if (pool.some(item => item.id === 'U1')) {
        hasU1 = true;
        break;
      }
    }
    expect(hasU1).toBe(false); // Should never appear!
  });
});
