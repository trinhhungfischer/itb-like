import { describe, it, expect } from 'vitest';
import { createDrone, createCharger, createStalker } from '../../../src/feature/enemy/approach-enemies.js';

describe('Approach Enemies Configuration', () => {
  describe('Drone', () => {
    it('AC-1: T1 Drone has Bite and 2 HP, 3 move', () => {
      const drone = createDrone('d1', 'T1', { col: 0, row: 0 });
      expect(drone.maxHP).toBe(2);
      expect(drone.moveRange).toBe(3);
      expect(drone.abilities[0].id).toBe('Bite');
      expect(drone.abilities[0].effectTemplate).toEqual([
        { kind: 'damage', amount: 1 }
      ]);
    });

    it('AC-1: T2 Drone has Bite and 3 HP, 4 move', () => {
      const drone = createDrone('d2', 'T2', { col: 0, row: 0 });
      expect(drone.maxHP).toBe(3);
      expect(drone.moveRange).toBe(4);
      expect(drone.abilities[0].id).toBe('Bite');
      expect(drone.abilities[0].effectTemplate).toEqual([
        { kind: 'damage', amount: 2 }
      ]);
    });

    it('AC-1: T3 Drone has Venomous Bite (Acid) and 4 HP, 4 move', () => {
      const drone = createDrone('d3', 'T3', { col: 0, row: 0 });
      expect(drone.maxHP).toBe(4);
      expect(drone.moveRange).toBe(4);
      expect(drone.abilities[0].id).toBe('Venomous Bite');
      expect(drone.abilities[0].effectTemplate).toEqual([
        { kind: 'damage', amount: 2 },
        { kind: 'spawnHazard', hazardType: 'Acid', duration: 1 }
      ]);
    });
  });

  describe('Charger', () => {
    it('AC-2: T1 Charger has Charge Strike (dmg 2) and 3 HP, 3 move', () => {
      const charger = createCharger('c1', 'T1', { col: 0, row: 0 });
      expect(charger.maxHP).toBe(3);
      expect(charger.moveRange).toBe(3);
      expect(charger.abilities[0].id).toBe('Charge Strike');
      expect(charger.abilities[0].effectTemplate).toEqual([
        { kind: 'damage', amount: 2 }
      ]);
    });

    it('AC-2: T2 Charger has Charge Strike (dmg 2, push 1) and 4 HP, 4 move', () => {
      const charger = createCharger('c2', 'T2', { col: 0, row: 0 });
      expect(charger.maxHP).toBe(4);
      expect(charger.moveRange).toBe(4);
      expect(charger.abilities[0].id).toBe('Charge Strike');
      expect(charger.abilities[0].effectTemplate).toEqual([
        { kind: 'damage', amount: 2 },
        { kind: 'push', distance: 1 }
      ]);
    });

    it('AC-2: T3 Charger has Ram Through (dmg 3, push 2) and 5 HP, 4 move', () => {
      const charger = createCharger('c3', 'T3', { col: 0, row: 0 });
      expect(charger.maxHP).toBe(5);
      expect(charger.moveRange).toBe(4);
      expect(charger.abilities[0].id).toBe('Ram Through');
      expect(charger.abilities[0].effectTemplate).toEqual([
        { kind: 'damage', amount: 3 },
        { kind: 'push', distance: 2 }
      ]);
    });
  });

  describe('Stalker', () => {
    it('AC-3: T1 Stalker has Slash (dmg 2) and 2 HP, 4 move', () => {
      const stalker = createStalker('s1', 'T1', { col: 0, row: 0 });
      expect(stalker.maxHP).toBe(2);
      expect(stalker.moveRange).toBe(4);
      expect(stalker.abilities[0].id).toBe('Slash');
      expect(stalker.abilities[0].effectTemplate).toEqual([
        { kind: 'damage', amount: 2 }
      ]);
    });

    it('AC-3: T2 Stalker has Slash (dmg 2) and 3 HP, 5 move', () => {
      const stalker = createStalker('s2', 'T2', { col: 0, row: 0 });
      expect(stalker.maxHP).toBe(3);
      expect(stalker.moveRange).toBe(5);
      expect(stalker.abilities[0].id).toBe('Slash');
      expect(stalker.abilities[0].effectTemplate).toEqual([
        { kind: 'damage', amount: 2 }
      ]);
    });

    it('AC-3: T3 Stalker has Ambush (dmg 2, Area 1) and 4 HP, 5 move', () => {
      const stalker = createStalker('s3', 'T3', { col: 0, row: 0 });
      expect(stalker.maxHP).toBe(4);
      expect(stalker.moveRange).toBe(5);
      expect(stalker.abilities[0].id).toBe('Ambush');
      expect(stalker.abilities[0].shape.type).toBe('Area');
      expect(stalker.abilities[0].shape.range).toBe(1);
      expect(stalker.abilities[0].effectTemplate).toEqual([
        { kind: 'damage', amount: 2 }
      ]);
    });
  });
});
