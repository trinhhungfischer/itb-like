import { describe, it, expect, vi } from 'vitest';
import { PASSIVE_CATALOG } from '../../../src/feature/heroes-abilities/passive-catalog.js';
import { evaluateEffect } from '../../../src/feature/heroes-abilities/module-effects.js';
import { registerPassiveModules } from '../../../src/feature/heroes-abilities/passive-trigger.js';
import { EventBus } from '../../../src/core/events/event-bus.js';
import type { CombatEventMap } from '../../../src/core/combat/combat-events.js';
import type { PhaseEventMap } from '../../../src/core/turn/turn-phase-events.js';
import type { CombatResolver } from '../../../src/core/turn/turn-phase-contracts.js';
import type { Board } from '../../../src/core/board/board-interface.js';

describe('Passive Module Category Effects', () => {
  it('AC-4: Scope: Squad modules apply to all heroes (e.g. Scavenger U1)', () => {
    const combatBus = new EventBus<CombatEventMap>();
    const phaseBus = new EventBus<PhaseEventMap>();
    const combatMock: CombatResolver = { resolve: vi.fn() };
    const boardMock: Board = {} as any;
    const evaluateSpy = vi.fn(evaluateEffect);

    const scavengerModule = PASSIVE_CATALOG['U1'];
    expect(scavengerModule).toBeDefined();
    expect(scavengerModule.scope).toBe('Squad');

    // Hero-1 equips the module
    registerPassiveModules('hero-1', [scavengerModule], combatBus, phaseBus, combatMock, () => boardMock, evaluateSpy);

    const queueMockHero1 = vi.fn();
    const queueMockHero2 = vi.fn();

    // Hero-1 kills an enemy
    combatBus.emit({ type: 'on_kill' as const, sourceId: 'hero-1', targetId: 'enemy-1', queuePassiveEffect: queueMockHero1 });
    // evaluateSpy should be called for hero-1's kill
    expect(evaluateSpy).toHaveBeenCalledWith(scavengerModule, expect.objectContaining({ trigger: 'OnKill' }));
    
    // Check that it queues the currency effect
    expect(queueMockHero1).toHaveBeenCalledWith([{ kind: 'metadata', key: 'scavenger_currency', value: 1 }]);

    evaluateSpy.mockClear();

    // Hero-2 kills an enemy (without equipping the module, but hero-1 has it)
    combatBus.emit({ type: 'on_kill' as const, sourceId: 'hero-2', targetId: 'enemy-2', queuePassiveEffect: queueMockHero2 });
    
    // evaluateSpy should be called because Scavenger is Squad scope
    expect(evaluateSpy).toHaveBeenCalledWith(scavengerModule, expect.objectContaining({ trigger: 'OnKill' }));
    expect(queueMockHero2).toHaveBeenCalledWith([{ kind: 'metadata', key: 'scavenger_currency', value: 1 }]);
  });
});
