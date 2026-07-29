import { describe, it, expect, vi } from 'vitest';
import { EnemyAbilitiesAndTelegraph, EnemyUnitProvider } from '../../../src/feature/enemy/enemy-abilities-and-telegraph.js';
import type { CombatResolver } from '../../../src/core/turn/turn-phase-contracts.js';
import type { CombatStateView } from '../../../src/core/combat/combat-state-interface.js';
import type { Unit, Tile } from '../../../src/feature/heroes-abilities/unit.js';
import type { Board } from '../../../src/core/board/index.js';

describe('Story 002: Target Selection AI', () => {
  const mockResolver: CombatResolver = { resolve: vi.fn().mockReturnValue([]) };
  const mockState: CombatStateView = {} as any;
  const mockBoard: Board = {
    distance: (a: Tile, b: Tile) => Math.abs(a.col - b.col) + Math.abs(a.row - b.row)
  } as any;

  it('selects hero with lowest unitId when Manhattan distances are equal', () => {
    const enemy: Unit = { id: 'enemy1', position: { col: 2, row: 2 }, team: 'enemy', abilities: [{ id: 'Attack', range: 5 }] } as any;
    const hero1: Unit = { id: '2', position: { col: 2, row: 4 }, team: 'hero' } as any; // dist 2
    const hero2: Unit = { id: '1', position: { col: 4, row: 2 }, team: 'hero' } as any; // dist 2

    const provider: EnemyUnitProvider = {
      getAliveEnemies: () => [enemy],
      getAliveHeroes: () => [hero1, hero2]
    };

    const system = new EnemyAbilitiesAndTelegraph(mockResolver, mockState, provider);
    system.chooseIntents(mockBoard);

    const intent = system.getIntent('enemy1');
    expect(intent).toBeDefined();
    // In our implementation, we will store the selected targetId on the intent or effects
    // For now, let's just assert the abilityId or effect target.
    expect(intent?.targetId).toBe('1');
  });

  it('telegraphs Idle when nearest target is unreachable (farther target is ignored)', () => {
    const enemy: Unit = { id: 'enemy1', position: { col: 0, row: 0 }, team: 'enemy', abilities: [{ id: 'Attack', range: 1 }] } as any;
    const heroNearest: Unit = { id: '1', position: { col: 0, row: 2 }, team: 'hero' } as any; // dist 2 (unreachable)
    const heroFarther: Unit = { id: '2', position: { col: 0, row: 5 }, team: 'hero' } as any; // dist 5

    const provider: EnemyUnitProvider = {
      getAliveEnemies: () => [enemy],
      getAliveHeroes: () => [heroNearest, heroFarther]
    };

    const system = new EnemyAbilitiesAndTelegraph(mockResolver, mockState, provider);
    system.chooseIntents(mockBoard);

    const intent = system.getIntent('enemy1');
    expect(intent?.abilityId).toBe('Idle');
    expect(intent?.effects).toEqual([]);
  });

  it('telegraphs Idle when 0 heroes are alive with no error', () => {
    const enemy: Unit = { id: 'enemy1', position: { col: 0, row: 0 }, team: 'enemy', abilities: [{ id: 'Attack', range: 1 }] } as any;

    const provider: EnemyUnitProvider = {
      getAliveEnemies: () => [enemy],
      getAliveHeroes: () => []
    };

    const system = new EnemyAbilitiesAndTelegraph(mockResolver, mockState, provider);
    
    expect(() => system.chooseIntents(mockBoard)).not.toThrow();

    const intent = system.getIntent('enemy1');
    expect(intent?.abilityId).toBe('Idle');
    expect(intent?.effects).toEqual([]);
  });
});
