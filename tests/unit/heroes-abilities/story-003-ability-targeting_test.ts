import { expect, test, describe } from 'vitest';
import { makeBoard } from '../../../src/core/board/board.js';
import { TerrainType } from '../../../src/core/board/board-types.js';
import { legalTargets, AbilityDefinition } from '../../../src/feature/heroes-abilities/ability-targeting.js';
import type { Unit } from '../../../src/feature/heroes-abilities/unit.js';

describe('Ability Targeting Geometry', () => {
  const createMockUnit = (id: string, col: number, row: number, team: 'hero' | 'enemy'): Unit => ({
    id,
    team,
    archetype: 'mock',
    maxHP: 10,
    currentHP: 10,
    position: { col, row },
    size: 1,
    abilities: [],
    hazardImmunities: [],
    statusFlags: [],
    moveSlot: 'Available',
    abilitySlot: 'Available'
  });

  test('UnitTarget range 1 with TargetFilter=Enemy returns exactly that enemy', () => {
    const board = makeBoard({ width: 8, height: 8, waterLethal: false });
    const vanguard = createMockUnit('vanguard', 3, 3, 'hero');
    const enemy = createMockUnit('enemy', 3, 4, 'enemy');
    
    board.place({col: 3, row: 3}, vanguard.id);
    board.place({col: 3, row: 4}, enemy.id);

    const units = [vanguard, enemy];
    const getUnit = (id: string) => units.find(u => u.id === id) || null;

    const shove: AbilityDefinition = {
      id: 'shove',
      shape: { type: 'UnitTarget', range: 1 },
      targetFilter: 'Enemy'
    };

    const targets = legalTargets(vanguard, shove, board, getUnit);
    expect(targets.length).toBe(1);
    expect(targets[0]).toEqual({ col: 3, row: 4 });
  });

  test('UnitTarget range 1 with TargetFilter=Enemy returns empty if adjacent is ally', () => {
    const board = makeBoard({ width: 8, height: 8, waterLethal: false });
    const vanguard = createMockUnit('vanguard', 3, 3, 'hero');
    const ally = createMockUnit('ally', 3, 4, 'hero');
    
    board.place({col: 3, row: 3}, vanguard.id);
    board.place({col: 3, row: 4}, ally.id);

    const units = [vanguard, ally];
    const getUnit = (id: string) => units.find(u => u.id === id) || null;

    const shove: AbilityDefinition = {
      id: 'shove',
      shape: { type: 'UnitTarget', range: 1 },
      targetFilter: 'Enemy'
    };

    const targets = legalTargets(vanguard, shove, board, getUnit);
    expect(targets.length).toBe(0);
  });

  test('Anchor Pull range 4 requiresOrthogonalAlignment filters off-axis targets', () => {
    const board = makeBoard({ width: 8, height: 8, waterLethal: false });
    const warden = createMockUnit('warden', 3, 3, 'hero');
    const enemy1 = createMockUnit('enemy1', 3, 7, 'enemy');
    const enemy2 = createMockUnit('enemy2', 5, 4, 'enemy');
    
    board.place(warden.position, warden.id);
    board.place(enemy1.position, enemy1.id);
    board.place(enemy2.position, enemy2.id);

    const units = [warden, enemy1, enemy2];
    const getUnit = (id: string) => units.find(u => u.id === id) || null;

    const anchorPull: AbilityDefinition = {
      id: 'anchorPull',
      shape: { type: 'UnitTarget', range: 4, requiresOrthogonalAlignment: true },
      targetFilter: 'Enemy'
    };

    const targets = legalTargets(warden, anchorPull, board, getUnit);
    expect(targets.length).toBe(1);
    expect(targets[0]).toEqual(enemy1.position);
  });

  test('Line range 4 with wall 2 tiles away returns exactly 2 tiles before wall', () => {
    const board = makeBoard({ width: 8, height: 8, waterLethal: false });
    const striker = createMockUnit('striker', 3, 3, 'hero');
    
    board.place(striker.position, striker.id);
    board.setTerrain({col: 3, row: 6}, TerrainType.Blocked);

    const units = [striker];
    const getUnit = (id: string) => units.find(u => u.id === id) || null;

    const lineAttack: AbilityDefinition = {
      id: 'line',
      shape: { type: 'Line', range: 4 },
      targetFilter: 'AnyTile'
    };

    const targets = legalTargets(striker, lineAttack, board, getUnit);
    const southTargets = targets.filter(t => t.col === 3 && t.row > 3);
    
    expect(southTargets).toEqual([
      { col: 3, row: 4 },
      { col: 3, row: 5 }
    ]);
  });

  test('Line direction with first step OutOfBounds is excluded entirely', () => {
    const board = makeBoard({ width: 8, height: 8, waterLethal: false });
    const edgeUnit = createMockUnit('edgeUnit', 0, 3, 'hero');
    
    board.place(edgeUnit.position, edgeUnit.id);

    const units = [edgeUnit];
    const getUnit = (id: string) => units.find(u => u.id === id) || null;

    const lineAttack: AbilityDefinition = {
      id: 'line',
      shape: { type: 'Line', range: 2 },
      targetFilter: 'AnyTile'
    };

    const targets = legalTargets(edgeUnit, lineAttack, board, getUnit);
    const westTargets = targets.filter(t => t.col < 0);
    expect(westTargets.length).toBe(0);
  });

  test('AnyUnit target filter allows ally', () => {
    const board = makeBoard({ width: 8, height: 8, waterLethal: false });
    const hero = createMockUnit('hero', 3, 3, 'hero');
    const ally = createMockUnit('ally', 3, 4, 'hero');
    
    board.place(hero.position, hero.id);
    board.place(ally.position, ally.id);

    const units = [hero, ally];
    const getUnit = (id: string) => units.find(u => u.id === id) || null;

    const pushAny: AbilityDefinition = {
      id: 'pushAny',
      shape: { type: 'UnitTarget', range: 1 },
      targetFilter: 'AnyUnit'
    };

    const targets = legalTargets(hero, pushAny, board, getUnit);
    expect(targets).toContainEqual(ally.position);
  });

  test('Blink Swap excludesSelf from legalTargets', () => {
    const board = makeBoard({ width: 8, height: 8, waterLethal: false });
    const twinblade = createMockUnit('twinblade', 3, 3, 'hero');
    
    board.place(twinblade.position, twinblade.id);

    const units = [twinblade];
    const getUnit = (id: string) => units.find(u => u.id === id) || null;

    const blinkSwap: AbilityDefinition = {
      id: 'blinkSwap',
      shape: { type: 'UnitTarget', range: 4 },
      targetFilter: 'Ally',
      excludesSelf: true
    };

    const targets = legalTargets(twinblade, blinkSwap, board, getUnit);
    expect(targets.some(t => t.col === 3 && t.row === 3)).toBe(false);
  });
  
  test('Zero legal targets for an ability', () => {
    const board = makeBoard({ width: 8, height: 8, waterLethal: false });
    const hero = createMockUnit('hero', 3, 3, 'hero');
    
    board.place(hero.position, hero.id);

    const units = [hero];
    const getUnit = (id: string) => units.find(u => u.id === id) || null;

    const enemyOnly: AbilityDefinition = {
      id: 'attack',
      shape: { type: 'UnitTarget', range: 2 },
      targetFilter: 'Enemy'
    };

    const targets = legalTargets(hero, enemyOnly, board, getUnit);
    expect(targets.length).toBe(0);
  });
});
