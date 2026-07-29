import { expect, test } from 'vitest';
import { makeBoard } from '../../../src/core/board/index.js';
import type { UnitId } from '../../../src/core/board/board-types.js';
import { TerrainType } from '../../../src/core/board/board-types.js';
import { EnemyAbilitiesAndTelegraph } from '../../../src/feature/enemy/enemy-abilities-and-telegraph.js';

test('Enemy telegraphs Idle when fully enclosed by blocked terrain and target out of range', () => {
  const board = makeBoard();
  board.setTerrain({ col: 1, row: 0 }, TerrainType.Blocked);
  board.setTerrain({ col: 1, row: 2 }, TerrainType.Blocked);
  board.setTerrain({ col: 0, row: 1 }, TerrainType.Blocked);
  board.setTerrain({ col: 2, row: 1 }, TerrainType.Blocked);

  const enemyId = 'enemy-1' as UnitId;
  const heroId = 'hero-1' as UnitId;

  const mockCombatResolver = { resolve: () => [] };
  const mockStateView = {} as any;

  const enemyObj = {
    id: enemyId,
    team: 'enemy',
    position: { col: 1, row: 1 },
    moveRange: 3,
    abilities: [{ id: 'attack', shape: { type: 'SingleTile', range: 1 }, targetFilter: 'Enemy' }]
  };

  const heroObj = {
    id: heroId,
    team: 'hero',
    position: { col: 5, row: 5 }
  };

  const mockProvider = {
    getAliveEnemies: () => [enemyObj] as any,
    getAliveHeroes: () => [heroObj] as any
  };

  const ai = new EnemyAbilitiesAndTelegraph(mockCombatResolver, mockStateView, mockProvider);
  ai.chooseIntents(board);

  const intent = ai.getIntent(enemyId);
  expect(intent).toBeDefined();
  expect(intent!.abilityId).toBe('Idle');
});

test('Target already in range implies no movement (telegraphedMoveDestination is null)', () => {
  const board = makeBoard();
  const enemyId = 'enemy-1' as UnitId;
  const heroId = 'hero-1' as UnitId;

  const enemyObj = {
    id: enemyId,
    team: 'enemy',
    position: { col: 3, row: 3 },
    moveRange: 3,
    abilities: [{ id: 'attack', shape: { type: 'SingleTile', range: 4 }, targetFilter: 'Enemy' }]
  };

  const heroObj = {
    id: heroId,
    team: 'hero',
    position: { col: 3, row: 6 } // distance 3 <= range 4
  };

  const mockProvider = {
    getAliveEnemies: () => [enemyObj] as any,
    getAliveHeroes: () => [heroObj] as any
  };

  const ai = new EnemyAbilitiesAndTelegraph({ resolve: () => [] }, {} as any, mockProvider);
  ai.chooseIntents(board);

  const intent = ai.getIntent(enemyId);
  expect(intent).toBeDefined();
  expect(intent!.abilityId).toBe('attack');
  expect(intent!.targetId).toBe(heroId);
  expect(intent!.telegraphedMoveDestination).toBeNull();
});

test('Confirm F2 example behavior exactly matches specification: O=(5,5), M=3, R=1, target at T=(5,2)', () => {
  const board = makeBoard();
  const enemyId = 'enemy-1' as UnitId;
  const heroId = 'hero-1' as UnitId;

  board.place({ col: 5, row: 2 }, heroId);

  const enemyObj = {
    id: enemyId,
    team: 'enemy',
    position: { col: 5, row: 5 },
    moveRange: 3,
    abilities: [{ id: 'attack', shape: { type: 'SingleTile', range: 1 }, targetFilter: 'Enemy' }]
  };

  const heroObj = {
    id: heroId,
    team: 'hero',
    position: { col: 5, row: 2 }
  };

  const mockProvider = {
    getAliveEnemies: () => [enemyObj] as any,
    getAliveHeroes: () => [heroObj] as any
  };

  const ai = new EnemyAbilitiesAndTelegraph({ resolve: () => [] }, {} as any, mockProvider);
  ai.chooseIntents(board);

  const intent = ai.getIntent(enemyId);
  expect(intent).toBeDefined();
  expect(intent!.abilityId).toBe('attack');
  expect(intent!.targetId).toBe(heroId);
  expect(intent!.telegraphedMoveDestination).toEqual({ col: 5, row: 3 });
});
