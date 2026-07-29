import { describe, it, expect } from 'vitest';
import { createOverseer } from '../../../src/feature/enemy/support-enemies.js';

describe('Support Enemies Configuration', () => {
  describe('Overseer', () => {
    it('AC-1: Warchief Variant has maxHP 3, move 2, Warchief aura', () => {
      const overseer = createOverseer('o1', 'Warchief', { col: 0, row: 0 });
      expect(overseer.maxHP).toBe(3);
      expect(overseer.moveRange).toBe(2);
      expect(overseer.aura).toBe('Warchief');
      expect(overseer.abilities.length).toBe(0); // no attack
    });

    it('AC-1: Ironhide Variant has maxHP 3, move 2, Ironhide aura', () => {
      const overseer = createOverseer('o2', 'Ironhide', { col: 0, row: 0 });
      expect(overseer.maxHP).toBe(3);
      expect(overseer.moveRange).toBe(2);
      expect(overseer.aura).toBe('Ironhide');
    });

    it('AC-1: Volatile Variant has maxHP 3, move 2, Volatile aura', () => {
      const overseer = createOverseer('o3', 'Volatile', { col: 0, row: 0 });
      expect(overseer.maxHP).toBe(3);
      expect(overseer.moveRange).toBe(2);
      expect(overseer.aura).toBe('Volatile');
    });

    it('AC-1: Hivemind Variant has maxHP 3, move 2, Hivemind aura', () => {
      const overseer = createOverseer('o4', 'Hivemind', { col: 0, row: 0 });
      expect(overseer.maxHP).toBe(3);
      expect(overseer.moveRange).toBe(2);
      expect(overseer.aura).toBe('Hivemind');
    });
  });
});
