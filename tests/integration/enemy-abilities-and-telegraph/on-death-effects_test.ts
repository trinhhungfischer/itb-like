import { describe, it, expect, beforeEach } from 'vitest';
import { makeBoard } from '../../../src/core/board/index.js';
import { TerrainType, type Board } from '../../../src/core/board/board-types.js';
import { CombatState } from '../../../src/core/combat/combat-state.js';
import { resolve } from '../../../src/core/combat/combat-resolve.js';
import type { UnitSpec } from '../../../src/core/combat/combat-types.js';

describe('Story 006: On-Death Effects (Integration)', () => {
  let board: Board;
  let state: CombatState;

  beforeEach(() => {
    board = makeBoard(5, 5);
    state = CombatState.empty();
  });

  it('test_onDeath_Defeated_triggers_follow_up', () => {
    const unitWithOnDeath: UnitSpec = {
      id: 'enemy-1',
      hp: 10,
      onDeath: (lastTile) => [
        { kind: 'spawnHazard', tile: lastTile, hazardType: 'Acid' }
      ]
    };

    // Spawn the unit
    resolve(board, state, [{ kind: 'spawnUnit', tile: { col: 2, row: 2 }, unitSpec: unitWithOnDeath }]);

    // Kill it with damage
    const events = resolve(board, state, [{ kind: 'damage', targetId: 'enemy-1', amount: 10 }]);

    // Should generate a hazard at 2,2
    expect(board.getHazard(2, 2)).toBe('Acid');
    
    // Check events: damage_applied -> unit_removed -> hazard_spawned
    const types = events.map(e => e.type);
    expect(types).toEqual(['damage_applied', 'unit_removed', 'hazard_spawned']);
  });

  it('test_onDeath_Fell_triggers_by_default', () => {
    const unitWithOnDeath: UnitSpec = {
      id: 'enemy-1',
      hp: 10,
      onDeath: (lastTile) => [
        { kind: 'spawnHazard', tile: lastTile, hazardType: 'Acid' }
      ]
    };

    resolve(board, state, [{ kind: 'spawnUnit', tile: { col: 2, row: 2 }, unitSpec: unitWithOnDeath }]);
    board.setTerrain({ col: 2, row: 3 }, TerrainType.Chasm);
    
    const events = resolve(board, state, [{ kind: 'push', targetId: 'enemy-1', direction: 'S', distance: 1 }]);
    
    expect(board.getHazard(2, 3)).toBe('Acid');
    const types = events.map(e => e.type);
    expect(types).toEqual(['unit_removed', 'hazard_spawned']);
  });

  it('test_onDeath_Fell_does_not_trigger_if_excluded', () => {
    const unitWithOnDeath: UnitSpec = {
      id: 'enemy-1',
      hp: 10,
      onDeath: (lastTile) => [
        { kind: 'spawnHazard', tile: lastTile, hazardType: 'Acid' }
      ],
      onDeathTriggerCauses: ['Defeated'] // Fell is excluded
    };

    resolve(board, state, [{ kind: 'spawnUnit', tile: { col: 2, row: 2 }, unitSpec: unitWithOnDeath }]);
    board.setTerrain({ col: 2, row: 3 }, TerrainType.Chasm);
    
    resolve(board, state, [{ kind: 'push', targetId: 'enemy-1', direction: 'S', distance: 1 }]);
    
    expect(board.getHazard(2, 3)).toBeNull(); // no hazard spawned
  });

  it('test_onDeath_chaining_resolves_in_order_without_infinite_loop', () => {
    const aOnDeath: UnitSpec = {
      id: 'enemy-A',
      hp: 10,
      onDeath: (lastTile) => [
        { kind: 'damage', targetId: 'enemy-B', amount: 10 }
      ]
    };
    
    const bOnDeath: UnitSpec = {
      id: 'enemy-B',
      hp: 10,
      onDeath: (lastTile) => [
        { kind: 'damage', targetId: 'enemy-C', amount: 10 }
      ]
    };
    
    const cOnDeath: UnitSpec = {
      id: 'enemy-C',
      hp: 10,
      onDeath: (lastTile) => [
        { kind: 'damage', targetId: 'enemy-A', amount: 10 }
      ]
    };

    resolve(board, state, [
      { kind: 'spawnUnit', tile: { col: 0, row: 0 }, unitSpec: aOnDeath },
      { kind: 'spawnUnit', tile: { col: 1, row: 0 }, unitSpec: bOnDeath },
      { kind: 'spawnUnit', tile: { col: 2, row: 0 }, unitSpec: cOnDeath },
    ]);

    const events = resolve(board, state, [{ kind: 'damage', targetId: 'enemy-A', amount: 10 }]);

    expect(state.hasUnit('enemy-A')).toBe(false);
    expect(state.hasUnit('enemy-B')).toBe(false);
    expect(state.hasUnit('enemy-C')).toBe(false);

    const types = events.map(e => e.type);
    expect(types).toEqual([
      'damage_applied', 'unit_removed', // A dies
      'damage_applied', 'unit_removed', // B dies
      'damage_applied', 'unit_removed', // C dies
    ]);
  });
});
