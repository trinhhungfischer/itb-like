import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnemyAbilitiesAndTelegraph } from '../../../src/feature/enemy/enemy-abilities-and-telegraph.js';
import type { Board } from '../../../src/core/board/index.js';
import type { CombatStateView } from '../../../src/core/combat/combat-state-interface.js';
import type { CombatResolver } from '../../../src/core/turn/turn-phase-contracts.js';
import type { BusEvent } from '../../../src/core/events/event-bus.js';

describe('Story 007: Spawn Emergence', () => {
  let combatResolver: CombatResolver;
  let state: CombatStateView;
  let unitProvider: any;
  let sut: EnemyAbilitiesAndTelegraph;
  let board: Board;
  let occupants: Record<string, string>;

  beforeEach(() => {
    occupants = {};
    board = {
      width: 5,
      height: 5,
      getOccupant: (c: number, r: number) => occupants[`${c},${r}`] || null,
      getHazard: () => null,
      distance: () => 1,
      reachableTiles: () => [],
      rayTiles: () => [],
    } as unknown as Board;

    combatResolver = {
      resolve: vi.fn((board, effects) => {
        return effects.map((e: any) => ({ type: e.kind + '_resolved', ...e })) as BusEvent[];
      })
    };

    state = {
      hasUnit: vi.fn(),
      getHp: vi.fn(),
      getHazardImmunities: vi.fn()
    } as unknown as CombatStateView;

    unitProvider = {
      getAliveEnemies: () => [],
      getAliveHeroes: () => []
    };

    sut = new EnemyAbilitiesAndTelegraph(combatResolver, state, unitProvider);
  });

  it('test_emergence_clearTile_activeNextTurn', () => {
    // GIVEN a spawn scheduled onto a Clear spawn-point tile
    const tile = { col: 1, row: 1 };
    sut.scheduleSpawn({
      tile,
      unitSpec: { id: 'enemy_1', hp: 5, hazardImmunities: [] }
    });

    // WHEN emergeSpawns() runs
    const events = sut.emergeSpawns(board);

    // THEN a new enemy is placed there
    expect(combatResolver.resolve).toHaveBeenCalledWith(
      board,
      expect.arrayContaining([
        expect.objectContaining({ kind: 'spawnUnit', tile, unitSpec: expect.objectContaining({ id: 'enemy_1' }) })
      ])
    );
    
    // flagged unable to act this turn
    const intent = sut.getIntent('enemy_1');
    expect(intent).toBeDefined();
    expect(intent?.abilityId).toBe('Spawned_Inactive');
    
    // it was not delayed
    expect(sut.getSpawnIntents()).toHaveLength(0);
  });

  it('test_emergence_occupiedTile_delayed', () => {
    // GIVEN a spawn scheduled onto an Occupied spawn-point tile
    const tile = { col: 1, row: 1 };
    occupants['1,1'] = 'hero_1'; // tile is occupied
    
    sut.scheduleSpawn({
      tile,
      unitSpec: { id: 'enemy_1', hp: 5, hazardImmunities: [] }
    });

    // WHEN emergeSpawns() runs
    const events = sut.emergeSpawns(board);

    // THEN the spawn is delayed (state Delayed) and no enemy is placed
    expect(combatResolver.resolve).not.toHaveBeenCalled();
    
    // it is retried at the next Spawn Phase
    const pendingSpawns = sut.getSpawnIntents();
    expect(pendingSpawns).toHaveLength(1);
    expect(pendingSpawns[0].delayCount).toBe(1);
  });

  it('test_emergence_delayed_forcedWithCollision', () => {
    // GIVEN a spawn has been delayed for spawn_retry_cap consecutive Spawn Phases
    const tile = { col: 2, row: 2 };
    occupants['2,2'] = 'hero_2'; // tile is occupied
    
    sut.scheduleSpawn({
      tile,
      unitSpec: { id: 'enemy_forced', hp: 5, hazardImmunities: [] }
    });

    // Manually force the delay count to reach the cap minus one, then trigger one more delay, then the cap
    sut.emergeSpawns(board); // delay count 1
    sut.emergeSpawns(board); // delay count 2
    sut.emergeSpawns(board); // delay count 3 (cap reached if cap is 3)

    expect(combatResolver.resolve).not.toHaveBeenCalled(); // No spawns yet
    
    // Check it's exactly at the cap
    expect(sut.getSpawnIntents()[0].delayCount).toBe(sut.SPAWN_RETRY_CAP);

    // WHEN the next Spawn Phase runs regardless of occupancy
    const events = sut.emergeSpawns(board);

    // THEN emergence is forced with a collision consequence to the blocking occupant
    expect(combatResolver.resolve).toHaveBeenCalledWith(
      board,
      expect.arrayContaining([
        expect.objectContaining({ kind: 'damage', targetId: 'hero_2', amount: 1 }),
        expect.objectContaining({ kind: 'removeUnit', targetId: 'hero_2', cause: 'Defeated' }),
        expect.objectContaining({ kind: 'spawnUnit', unitSpec: expect.objectContaining({ id: 'enemy_forced' }) })
      ])
    );
    
    // No longer delayed
    expect(sut.getSpawnIntents()).toHaveLength(0);
  });

  it('test_upcomingSpawns_projectSpawnIntent', () => {
    // GIVEN a spawn instruction is due next Spawn Phase
    const tile = { col: 3, row: 3 };
    sut.scheduleSpawn({
      tile,
      unitSpec: { id: 'enemy_new', hp: 10, hazardImmunities: [] }
    });
    
    // WHEN the current Telegraph Phase runs (intents are visible)
    // THEN a SpawnIntent is present on that spawn-point tile
    const spawnIntents = sut.getSpawnIntents();
    expect(spawnIntents).toHaveLength(1);
    expect(spawnIntents[0].tile).toEqual(tile);
    expect(spawnIntents[0].delayCount).toBe(0);
  });
});
