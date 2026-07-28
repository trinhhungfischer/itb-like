// VERTICAL SLICE - NOT FOR PRODUCTION
import { describe, it, expect } from 'vitest';
import { Board, UnitData } from './board';

describe('Board', () => {
  it('handles bounds checking correctly', () => {
    expect(Board.inBounds(0, 0)).toBe(true);
    expect(Board.inBounds(5, 5)).toBe(true);
    expect(Board.inBounds(-1, 0)).toBe(false);
    expect(Board.inBounds(6, 5)).toBe(false);
    expect(Board.inBounds(0, 6)).toBe(false);
  });

  it('can snapshot and restore', () => {
    const board = new Board();
    const unit: UnitData = {
      id: 'u1',
      name: 'Mech',
      team: 'player',
      hp: 10,
      maxHp: 10,
      col: 2,
      row: 2,
      abilities: [],
      hasMoved: false,
      hasActed: false,
      isAlive: true
    };
    board.addUnit(unit);
    board.spawnHazard(3, 3, 2);

    const snap = board.snapshot();
    const newBoard = Board.fromSnapshot(snap);

    const restoredUnit = newBoard.getUnit('u1');
    expect(restoredUnit).toBeDefined();
    expect(restoredUnit?.hp).toBe(10);
    
    const tile = newBoard.getTile(3, 3);
    expect(tile.terrain).toBe('hazard');
    expect(tile.hazardDamage).toBe(2);
    
    // Modify new board and check old board wasn't affected
    newBoard.damageUnit('u1', 5);
    expect(newBoard.getUnit('u1')?.hp).toBe(5);
    expect(board.getUnit('u1')?.hp).toBe(10);
  });
});
