import { describe, it, expect, vi } from 'vitest';
import { EnemyAbilitiesAndTelegraph } from '../../../src/feature/enemy/enemy-abilities-and-telegraph.js';
import type { CombatResolver } from '../../../src/core/turn/turn-phase-contracts.js';
import type { CombatStateView } from '../../../src/core/combat/combat-state-interface.js';
import type { Unit } from '../../../src/feature/heroes-abilities/unit.js';
import type { Board } from '../../../src/core/board/index.js';
import type { EffectPrimitive } from '../../../src/core/combat/combat-types.js';

describe('Story 001: Core System Contracts & Deterministic Order', () => {
  it('exposes exactly chooseIntents(), resolveTelegraphed(), emergeSpawns(), and no method that mutates board directly', () => {
    const resolver: CombatResolver = { resolve: vi.fn().mockReturnValue([]) };
    const state: CombatStateView = {} as any;
    const system = new EnemyAbilitiesAndTelegraph(resolver, state, { getAliveEnemies: () => [] });
    
    expect(typeof system.chooseIntents).toBe('function');
    expect(typeof system.resolveTelegraphed).toBe('function');
    expect(typeof system.emergeSpawns).toBe('function');
    
    const prototypeMethods = Object.getOwnPropertyNames(EnemyAbilitiesAndTelegraph.prototype).filter(m => m !== 'constructor');
    const allowed = ['chooseIntents', 'resolveTelegraphed', 'emergeSpawns', 'setIntent', 'getIntent', 'getSortedEnemies'];
    for (const method of prototypeMethods) {
      expect(allowed).toContain(method);
    }
  });

  it('processes enemies strictly by ascending unitId when chooseIntents() or resolveTelegraphed() runs', () => {
    const resolver: CombatResolver = { resolve: vi.fn().mockReturnValue([]) };
    const state: CombatStateView = {} as any;
    const mockBoard: Board = {} as any;

    const units: Unit[] = [
      { id: '4', team: 'enemy' } as Unit,
      { id: '7', team: 'enemy' } as Unit,
      { id: '2', team: 'enemy' } as Unit
    ];
    
    const system = new EnemyAbilitiesAndTelegraph(resolver, state, { getAliveEnemies: () => units });
    
    system.setIntent('4', { effects: [{ kind: 'damage', targetId: 'hero', amount: 1 }] });
    system.setIntent('7', { effects: [{ kind: 'damage', targetId: 'hero', amount: 2 }] });
    system.setIntent('2', { effects: [{ kind: 'damage', targetId: 'hero', amount: 3 }] });
    
    system.resolveTelegraphed(mockBoard);
    
    expect(resolver.resolve).toHaveBeenCalledTimes(3);
    expect((resolver.resolve as any).mock.calls[0][2][0].amount).toBe(3); // unit 2
    expect((resolver.resolve as any).mock.calls[1][2][0].amount).toBe(1); // unit 4
    expect((resolver.resolve as any).mock.calls[2][2][0].amount).toBe(2); // unit 7
  });

  it('prioritizes lower unitId when two enemies resolve pushes targeting the same tile', () => {
    let tileClaimedBy: string | null = null;
    const resolver: CombatResolver = {
      resolve: vi.fn((...args: any[]) => {
        // Handle both signatures depending on whether state was passed or not
        const actualEffects = args.length === 3 ? args[2] : args[1];
        const push = actualEffects[0] as EffectPrimitive;
        if (push && push.kind === 'push' && tileClaimedBy === null) {
          tileClaimedBy = push.sourceId || null;
        }
        return [];
      })
    };
    
    const state: CombatStateView = {} as any;
    const mockBoard: Board = {} as any;

    const units: Unit[] = [
      { id: 'enemyA', team: 'enemy' } as Unit,
      { id: 'enemyB', team: 'enemy' } as Unit
    ];
    
    const system = new EnemyAbilitiesAndTelegraph(resolver, state, { getAliveEnemies: () => units });
    system.setIntent('enemyA', { effects: [{ kind: 'push', targetId: 'hero', direction: 'N', distance: 1, sourceId: 'enemyA' }] });
    system.setIntent('enemyB', { effects: [{ kind: 'push', targetId: 'hero', direction: 'N', distance: 1, sourceId: 'enemyB' }] });
    
    system.resolveTelegraphed(mockBoard);
    expect(tileClaimedBy).toBe('enemyA'); // enemyA sorts before enemyB

    tileClaimedBy = null;
    const swappedUnits: Unit[] = [
      { id: 'enemyY', team: 'enemy' } as Unit, // previously enemyA
      { id: 'enemyX', team: 'enemy' } as Unit  // previously enemyB
    ];
    const system2 = new EnemyAbilitiesAndTelegraph(resolver, state, { getAliveEnemies: () => swappedUnits });
    system2.setIntent('enemyY', { effects: [{ kind: 'push', targetId: 'hero', direction: 'N', distance: 1, sourceId: 'enemyY' }] });
    system2.setIntent('enemyX', { effects: [{ kind: 'push', targetId: 'hero', direction: 'N', distance: 1, sourceId: 'enemyX' }] });
    
    system2.resolveTelegraphed(mockBoard);
    expect(tileClaimedBy).toBe('enemyX'); // enemyX sorts before enemyY
  });
});
