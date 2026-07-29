import { describe, it, expect } from 'vitest';
import { createLobber, createSpitter, createSentinel } from '../../../src/feature/enemy/artillery-enemies.js';
import type { EffectPrimitive } from '../../../src/core/combat/combat-types.js';

describe('Artillery Enemies Configuration', () => {
  describe('Lobber', () => {
    it('AC-1: T1 Lobber has Acid Glob and 2 HP, 1 move, 4 range', () => {
      const lobber = createLobber('l1', 'T1', { col: 0, row: 0 });
      expect(lobber.maxHP).toBe(2);
      expect(lobber.moveRange).toBe(1);
      expect(lobber.abilities[0].id).toBe('Acid Glob');
      expect(lobber.abilities[0].shape.range).toBe(4);
      expect(lobber.abilities[0].shape.type).toBe('SingleTile');
      expect(lobber.abilities[0].effectTemplate).toEqual([
        { kind: 'damage', amount: 1 }
      ]);
      expect(lobber.onDeath).toBeUndefined();
    });

    it('AC-1: T2 Lobber has Acid Glob (Area) and 4 HP, 1 move, 4 range', () => {
      const lobber = createLobber('l2', 'T2', { col: 0, row: 0 });
      expect(lobber.maxHP).toBe(4);
      expect(lobber.moveRange).toBe(1);
      expect(lobber.abilities[0].id).toBe('Acid Glob');
      expect(lobber.abilities[0].shape.type).toBe('Area');
      expect(lobber.abilities[0].shape.range).toBe(4);
      expect(lobber.abilities[0].effectTemplate).toEqual([
        { kind: 'damage', amount: 1 }
      ]);
      expect(lobber.onDeath).toBeUndefined();
    });

    it('AC-1: T3 Lobber has Acid Rain (Acid) and 5 HP, 2 move, 5 range', () => {
      const lobber = createLobber('l3', 'T3', { col: 0, row: 0 });
      expect(lobber.maxHP).toBe(5);
      expect(lobber.moveRange).toBe(2);
      expect(lobber.abilities[0].id).toBe('Acid Rain');
      expect(lobber.abilities[0].shape.type).toBe('Area');
      expect(lobber.abilities[0].shape.range).toBe(5);
      expect(lobber.abilities[0].effectTemplate).toEqual([
        { kind: 'damage', amount: 1 },
        { kind: 'spawnHazard', hazardType: 'Acid', duration: 2 }
      ]);
      
      expect(lobber.onDeath).toBeDefined();
      const onDeathEffects = lobber.onDeath!({ col: 2, row: 2 });
      expect(onDeathEffects.length).toBe(4);
      expect((onDeathEffects[0] as any).hazardType).toBe('Acid');
    });
  });

  describe('Spitter', () => {
    it('AC-2: T1 Spitter has Spike Shot (dmg 2) and 2 HP, 0 move, inf range', () => {
      const spitter = createSpitter('s1', 'T1', { col: 0, row: 0 });
      expect(spitter.maxHP).toBe(2);
      expect(spitter.moveRange).toBe(0);
      expect(spitter.abilities[0].id).toBe('Spike Shot');
      expect(spitter.abilities[0].shape.type).toBe('SingleTile');
      expect(spitter.abilities[0].shape.range).toBe(100);
      expect(spitter.abilities[0].shape.requiresOrthogonalAlignment).toBe(true);
      expect(spitter.abilities[0].effectTemplate).toEqual([
        { kind: 'damage', amount: 2 }
      ]);
    });

    it('AC-2: T3 Spitter has Impaling Shot (dmg 2, push 1) and 4 HP, 1 move, inf range', () => {
      const spitter = createSpitter('s3', 'T3', { col: 0, row: 0 });
      expect(spitter.maxHP).toBe(4);
      expect(spitter.moveRange).toBe(1);
      expect(spitter.abilities[0].id).toBe('Impaling Shot');
      expect(spitter.abilities[0].effectTemplate).toEqual([
        { kind: 'damage', amount: 2 },
        { kind: 'push', distance: 1 }
      ]);
    });
  });

  describe('Sentinel', () => {
    it('AC-3: T1 Sentinel has Mine Layer and 3 HP, 0 move, 3 range', () => {
      const sentinel = createSentinel('sen1', 'T1', { col: 0, row: 0 });
      expect(sentinel.maxHP).toBe(3);
      expect(sentinel.moveRange).toBe(0);
      expect(sentinel.abilities[0].id).toBe('Mine Layer');
      expect(sentinel.abilities[0].shape.type).toBe('SingleTile');
      expect(sentinel.abilities[0].shape.range).toBe(3);
      expect(sentinel.abilities[0].effectTemplate).toEqual([
        { kind: 'spawnHazard', hazardType: 'Mine', duration: null }
      ]);
      expect(sentinel.onDeath).toBeUndefined();
    });

    it('AC-3: T2 Sentinel has Mine Layer and onDeath mines', () => {
      const sentinel = createSentinel('sen2', 'T2', { col: 0, row: 0 });
      expect(sentinel.maxHP).toBe(4);
      expect(sentinel.onDeath).toBeDefined();
      const onDeathEffects = sentinel.onDeath!({ col: 2, row: 2 });
      expect(onDeathEffects.length).toBe(4);
      expect((onDeathEffects[0] as any).hazardType).toBe('Mine');
    });

    it('AC-3: T3 Sentinel has Mine Field (Area) and 5 HP, 1 move, 4 range', () => {
      const sentinel = createSentinel('sen3', 'T3', { col: 0, row: 0 });
      expect(sentinel.maxHP).toBe(5);
      expect(sentinel.moveRange).toBe(1);
      expect(sentinel.abilities[0].id).toBe('Mine Field');
      expect(sentinel.abilities[0].shape.type).toBe('Area');
      expect(sentinel.abilities[0].shape.range).toBe(4);
    });
  });
});
