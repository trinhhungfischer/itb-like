import { describe, it, expect } from 'vitest';
import { createBoss } from '../../../src/feature/enemy/boss-enemies.js';

describe('Boss Enemies Configuration', () => {
  describe('Behemoth', () => {
    it('AC-1: Behemoth has 15 HP, 2 move, and two abilities (Slam, Summon)', () => {
      const boss = createBoss('b1', 'Behemoth', { col: 0, row: 0 });
      expect(boss.maxHP).toBe(15);
      expect(boss.moveRange).toBe(2);
      expect(boss.abilities.length).toBe(2);
      
      const ability1 = boss.abilities[0];
      expect(ability1.id).toBe('Seismic Slam');
      expect(ability1.shape.type).toBe('Area');
      expect(ability1.shape.range).toBe(1);
      expect(ability1.effectTemplate).toEqual([
        { kind: 'damage', amount: 3 },
        { kind: 'push', distance: 1 }
      ]);
      
      const ability2 = boss.abilities[1];
      expect(ability2.id).toBe('Summon Swarm');
      expect(ability2.effectTemplate.length).toBe(2);
      expect(ability2.effectTemplate[0].kind).toBe('spawnUnit');
      expect(ability2.effectTemplate[1].kind).toBe('spawnUnit');
    });
  });

  describe('Architect', () => {
    it('AC-2: Architect has 12 HP, 1 move, and two abilities (Rift Tear, Shockwave)', () => {
      const boss = createBoss('b2', 'Architect', { col: 0, row: 0 });
      expect(boss.maxHP).toBe(12);
      expect(boss.moveRange).toBe(1);
      expect(boss.abilities.length).toBe(2);
      
      const ability1 = boss.abilities[0];
      expect(ability1.id).toBe('Rift Tear');
      expect(ability1.effectTemplate).toEqual([
        { kind: 'setTerrain', terrainType: 'Chasm' }
      ]);
      
      const ability2 = boss.abilities[1];
      expect(ability2.id).toBe('Shockwave');
      expect(ability2.effectTemplate).toEqual([
        { kind: 'push', distance: 2 },
        { kind: 'damage', amount: 1 }
      ]);
    });
  });
});
