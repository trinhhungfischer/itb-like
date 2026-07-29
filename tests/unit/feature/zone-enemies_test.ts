import { describe, it, expect } from 'vitest';
import { createBroodmother, createShifter } from '../../../src/feature/enemy/zone-enemies.js';

describe('Zone Enemies Configuration', () => {
  describe('Broodmother', () => {
    it('AC-1: T1 Broodmother has Spawn Brood and 5 HP, 1 move, 3 range', () => {
      const bm = createBroodmother('bm1', 'T1', { col: 0, row: 0 });
      expect(bm.maxHP).toBe(5);
      expect(bm.moveRange).toBe(1);
      expect(bm.abilities[0].id).toBe('Spawn Brood');
      expect(bm.abilities[0].shape.range).toBe(3);
      expect(bm.abilities[0].shape.type).toBe('SingleTile');
      expect(bm.abilities[0].effectTemplate[0].kind).toBe('spawnUnit');
      expect(bm.onDeath).toBeUndefined();
    });

    it('AC-1: T2 Broodmother has Spawn Brood and 6 HP, 1 move, 3 range, OnDeath spawn 1', () => {
      const bm = createBroodmother('bm2', 'T2', { col: 0, row: 0 });
      expect(bm.maxHP).toBe(6);
      expect(bm.moveRange).toBe(1);
      expect(bm.abilities[0].id).toBe('Spawn Brood');
      expect(bm.abilities[0].shape.type).toBe('SingleTile');
      
      expect(bm.onDeath).toBeDefined();
      const onDeathEffects = bm.onDeath!({ col: 2, row: 2 });
      expect(onDeathEffects.length).toBe(1);
      expect(onDeathEffects[0].kind).toBe('spawnUnit');
    });

    it('AC-1: T3 Broodmother has Spawn Brood (Area) and 8 HP, 1 move, 1 range, OnDeath spawn 2', () => {
      const bm = createBroodmother('bm3', 'T3', { col: 0, row: 0 });
      expect(bm.maxHP).toBe(8);
      expect(bm.moveRange).toBe(1);
      expect(bm.abilities[0].id).toBe('Spawn Brood');
      expect(bm.abilities[0].shape.type).toBe('Area');
      expect(bm.abilities[0].shape.range).toBe(1);
      
      expect(bm.onDeath).toBeDefined();
      const onDeathEffects = bm.onDeath!({ col: 2, row: 2 });
      expect(onDeathEffects.length).toBe(2);
      expect(onDeathEffects[0].kind).toBe('spawnUnit');
      expect(onDeathEffects[1].kind).toBe('spawnUnit');
    });
  });

  describe('Shifter', () => {
    it('AC-2: T1 Shifter has Erect Wall and 4 HP, 1 move, 3 range', () => {
      const shifter = createShifter('sh1', 'T1', { col: 0, row: 0 });
      expect(shifter.maxHP).toBe(4);
      expect(shifter.moveRange).toBe(1);
      expect(shifter.abilities[0].id).toBe('Erect Wall');
      expect(shifter.abilities[0].shape.type).toBe('SingleTile');
      expect(shifter.abilities[0].shape.range).toBe(3);
      expect(shifter.abilities[0].effectTemplate).toEqual([
        { kind: 'setTerrain', terrainType: 'Wall' }
      ]);
    });

    it('AC-2: T2 Shifter has Erect Wall and 5 HP, 1 move, 4 range', () => {
      const shifter = createShifter('sh2', 'T2', { col: 0, row: 0 });
      expect(shifter.maxHP).toBe(5);
      expect(shifter.moveRange).toBe(1);
      expect(shifter.abilities[0].id).toBe('Erect Wall');
      expect(shifter.abilities[0].shape.range).toBe(4);
      expect(shifter.abilities[0].effectTemplate).toEqual([
        { kind: 'setTerrain', terrainType: 'Wall' }
      ]);
    });

    it('AC-2: T3 Shifter has Terraform (Area) and 6 HP, 1 move, 1 range', () => {
      const shifter = createShifter('sh3', 'T3', { col: 0, row: 0 });
      expect(shifter.maxHP).toBe(6);
      expect(shifter.moveRange).toBe(1);
      expect(shifter.abilities[0].id).toBe('Terraform');
      expect(shifter.abilities[0].shape.type).toBe('Area');
      expect(shifter.abilities[0].shape.range).toBe(1);
      expect(shifter.abilities[0].effectTemplate).toEqual([
        { kind: 'setTerrain', terrainType: 'Wall' }
      ]);
    });
  });
});
