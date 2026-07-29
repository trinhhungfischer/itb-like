import { describe, it, expect, vi } from 'vitest';
import { EnemyAbilitiesAndTelegraph, Intent } from '../../../src/feature/enemy/enemy-abilities-and-telegraph.js';
import type { Board } from '../../../src/core/board/index.js';
import type { Unit } from '../../../src/feature/heroes-abilities/unit.js';
import type { Tile } from '../../../src/core/board/board-types.js';

describe('Story 004: Telegraph State', () => {
  const createMockBoard = (fireTiles: Tile[] = []): Board => {
    return {
      width: 8,
      height: 8,
      inBounds: (c: number, r: number) => c >= 0 && c < 8 && r >= 0 && r < 8,
      getHazard: (c: number, r: number) => {
        return fireTiles.some(t => t.col === c && t.row === r) ? 'Fire' : null;
      },
      distance: (a: Tile, b: Tile) => Math.abs(a.col - b.col) + Math.abs(a.row - b.row),
      reachableTiles: (origin: Tile, range: number) => {
         const tiles: Tile[] = [];
         for(let c=0; c<8; c++) {
           for(let r=0; r<8; r++) {
              if (Math.abs(c - origin.col) + Math.abs(r - origin.row) <= range && (c !== origin.col || r !== origin.row)) {
                 tiles.push({col: c, row: r});
              }
           }
         }
         return tiles;
      }
    } as unknown as Board;
  };

  const createMockUnitProvider = (heroes: Unit[], enemies: Unit[]) => {
    return {
      getAliveHeroes: () => heroes,
      getAliveEnemies: () => enemies
    };
  };

  const createMockResolver = () => {
    return { resolve: vi.fn().mockReturnValue([]) } as any;
  };

  const createUnit = (id: string, team: 'hero'|'enemy', col: number, row: number): Unit => ({
    id, team, archetype: 'test', maxHP: 10, currentHP: 10, position: {col, row}, size: 1, abilities: [], hazardImmunities: [], statusFlags: []
  });

  it('Enemy intents are pre-recorded for Turn 1 before player input', () => {
    const hero1 = createUnit('hero1', 'hero', 0, 0);
    const enemy1 = createUnit('enemy1', 'enemy', 1, 0);
    
    const board = createMockBoard();
    const provider = createMockUnitProvider([hero1], [enemy1]);
    const sut = new EnemyAbilitiesAndTelegraph(createMockResolver(), {} as any, provider);
    
    // GIVEN battle setup completes (simulate by calling chooseIntents before Player phase)
    sut.chooseIntents(board);
    
    // THEN every living enemy already has an Intent recorded
    const intent = sut.getIntent('enemy1');
    expect(intent).toBeDefined();
    expect(intent?.abilityId).toBe('Attack'); // Based on current hardcoded logic
    expect(intent?.effects.length).toBeGreaterThan(0);
  });

  it('Intents remain immutable to player phase board mutations', () => {
    const hero1 = createUnit('hero1', 'hero', 0, 0);
    const enemy1 = createUnit('enemy1', 'enemy', 1, 0);
    
    const board = createMockBoard();
    const provider = createMockUnitProvider([hero1], [enemy1]);
    const sut = new EnemyAbilitiesAndTelegraph(createMockResolver(), {} as any, provider);
    
    // GIVEN an Intent has been telegraphed for turn n
    sut.chooseIntents(board);
    const initialIntent = sut.getIntent('enemy1');
    const telegraphedTiles = initialIntent?.telegraphedEffectTiles;
    const dest = initialIntent?.telegraphedMoveDestination;
    
    // WHEN the board mutates (hero moves away, we simulate by modifying hero position)
    hero1.position = { col: 7, row: 7 };
    
    // THEN the stored intent does not change since we don't call chooseIntents again during player phase
    const intentAfter = sut.getIntent('enemy1');
    expect(intentAfter).toBe(initialIntent); // Reference equality, immutable
  });

  it('Newly spawned enemies generate next-turn Intents correctly', () => {
    const hero1 = createUnit('hero1', 'hero', 0, 0);
    const board = createMockBoard();
    
    let enemies: Unit[] = [];
    const provider = createMockUnitProvider([hero1], enemies);
    const sut = new EnemyAbilitiesAndTelegraph(createMockResolver(), {} as any, provider);
    
    sut.chooseIntents(board);
    expect(sut.getIntent('enemy2')).toBeUndefined();
    
    // GIVEN an enemy spawns during the Spawn Phase
    enemies.push(createUnit('enemy2', 'enemy', 1, 0));
    
    // WHEN the same turn's Telegraph Phase runs
    sut.chooseIntents(board);
    
    // THEN that enemy has a valid Intent recorded for the next turn
    const intent = sut.getIntent('enemy2');
    expect(intent).toBeDefined();
    expect(intent?.abilityId).toBe('Attack');
  });

  it('telegraphedEnvironmentTiles captures Fire hazards from board state', () => {
    const board = createMockBoard([{col: 2, row: 2}]);
    const provider = createMockUnitProvider([], []);
    const sut = new EnemyAbilitiesAndTelegraph(createMockResolver(), {} as any, provider);
    
    sut.chooseIntents(board);
    const envTiles = Array.from(sut.telegraphedEnvironmentTiles(1));
    expect(envTiles.length).toBe(1);
    expect(envTiles[0].col).toBe(2);
    expect(envTiles[0].row).toBe(2);
  });

  it('telegraphedLethalThreatCount tallies enemy and environment damage', () => {
    const hero1 = createUnit('hero1', 'hero', 2, 2); // Standing on Fire
    const hero2 = createUnit('hero2', 'hero', 0, 0); // Targeted by enemy
    const enemy1 = createUnit('enemy1', 'enemy', 1, 0); // Will target hero2 (nearest)
    
    const board = createMockBoard([{col: 2, row: 2}]); // Fire at 2,2
    const provider = createMockUnitProvider([hero1, hero2], [enemy1]);
    const sut = new EnemyAbilitiesAndTelegraph(createMockResolver(), {} as any, provider);
    
    sut.chooseIntents(board);
    
    // Expected threats: 1 from fire (on hero1), 1 from enemy (on hero2)
    expect(sut.telegraphedLethalThreatCount(1)).toBe(2);
  });
});
