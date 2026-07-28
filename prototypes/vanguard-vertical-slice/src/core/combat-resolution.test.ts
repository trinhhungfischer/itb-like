// VERTICAL SLICE - NOT FOR PRODUCTION
import { describe, it, expect, beforeEach } from 'vitest';
import { Board, EventBus, UnitData } from '../foundation';
import { CombatResolution } from './combat-resolution';

describe('CombatResolution', () => {
  let board: Board;
  let eventBus: EventBus;
  let combat: CombatResolution;

  beforeEach(() => {
    board = new Board();
    eventBus = new EventBus();
    combat = new CombatResolution(board, eventBus);
  });

  it('should resolve damage and push sequentially in one attack', () => {
    const attacker: UnitData = {
      id: 'u1', name: 'Attacker', team: 'player',
      hp: 10, maxHp: 10, col: 2, row: 2,
      abilities: [
        { id: 'bash', name: 'Bash', damage: 2, range: 1, push: true } as any
      ],
      hasMoved: false, hasActed: false, isAlive: true
    };
    
    const target: UnitData = {
      id: 'u2', name: 'Target', team: 'enemy',
      hp: 5, maxHp: 5, col: 3, row: 2,
      abilities: [],
      hasMoved: false, hasActed: false, isAlive: true
    };

    board.addUnit(attacker);
    board.addUnit(target);

    const result = combat.resolve({
      type: 'attack',
      sourceUnitId: 'u1',
      targetCol: 3,
      targetRow: 2,
      abilityId: 'bash'
    });

    expect(result.success).toBe(true);
    
    const updatedTarget = board.getUnit('u2');
    expect(updatedTarget?.hp).toBe(3); // Damaged
    expect(updatedTarget?.col).toBe(4); // Pushed right
    expect(updatedTarget?.row).toBe(2);

    const eventTypes = result.events.map(e => e.type);
    expect(eventTypes).toContain('unit_damaged');
    expect(eventTypes).toContain('unit_pushed');
  });
});
