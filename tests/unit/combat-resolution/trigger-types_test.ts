import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../../src/core/events/event-bus.js';
import type { CombatEventMap } from '../../../src/core/combat/combat-events.js';
import type { PhaseEventMap } from '../../../src/core/turn/turn-phase-events.js';
import { registerPassiveModules, TriggerContext } from '../../../src/feature/heroes-abilities/passive-trigger.js';
import type { PassiveModuleDefinition } from '../../../src/feature/heroes-abilities/equipment.js';
import type { Board } from '../../../src/core/board/board-interface.js';
import type { CombatResolver } from '../../../src/core/turn/turn-phase-contracts.js';
import type { EffectPrimitive } from '../../../src/core/combat/combat-types.js';

describe('Passive Trigger Types', () => {
  const dummyEffect: EffectPrimitive[] = [{ kind: 'damage', targetId: 'enemy-1', amount: 5 }];

  function setup() {
    const combatBus = new EventBus<CombatEventMap>();
    const phaseBus = new EventBus<PhaseEventMap>();
    const resolveMock = vi.fn();
    const combatMock: CombatResolver = {
      resolve: resolveMock
    };
    const boardMock: Board = {} as any;
    const evaluateMock = vi.fn().mockReturnValue(dummyEffect);

    return { combatBus, phaseBus, combatMock, boardMock, evaluateMock, resolveMock };
  }

  function createDummyModule(triggerType: any): PassiveModuleDefinition {
    return {
      type: 'passive',
      id: `dummy-${triggerType}`,
      name: 'Dummy',
      category: 'Combat',
      scope: 'Global',
      trigger: { type: triggerType },
      effect: {},
      rarity: 'Common',
      incompatible: []
    };
  }

  it('Always trigger does not subscribe to dynamic events', () => {
    const { combatBus, phaseBus, combatMock, boardMock, evaluateMock } = setup();
    const module = createDummyModule('Always');

    registerPassiveModules('hero-1', [module], combatBus, phaseBus, combatMock, () => boardMock, evaluateMock);

    // Emit all known events just to make sure evaluateMock is never called
    combatBus.emit({ type: 'on_action', sourceId: 'hero-1', actionMetadata: {}, queuePassiveEffect: vi.fn() });
    combatBus.emit({ type: 'on_hit', sourceId: 'hero-1', targetId: 'enemy-1', damageAmount: 1, queuePassiveEffect: vi.fn() });
    combatBus.emit({ type: 'on_kill', sourceId: 'hero-1', targetId: 'enemy-1', queuePassiveEffect: vi.fn() });
    phaseBus.emit({ type: 'turn_started', turnNumber: 1 });

    expect(evaluateMock).not.toHaveBeenCalled();
  });

  it('OnAction triggers exactly once per action from the hero', () => {
    const { combatBus, phaseBus, combatMock, boardMock, evaluateMock } = setup();
    const module = createDummyModule('OnAction');

    registerPassiveModules('hero-1', [module], combatBus, phaseBus, combatMock, () => boardMock, evaluateMock);

    const queueMock1 = vi.fn();
    const queueMock2 = vi.fn();

    // Not the hero
    combatBus.emit({ type: 'on_action', sourceId: 'enemy-1', actionMetadata: {}, queuePassiveEffect: queueMock1 });
    expect(evaluateMock).not.toHaveBeenCalled();
    expect(queueMock1).not.toHaveBeenCalled();

    // The hero
    const event = { type: 'on_action' as const, sourceId: 'hero-1', actionMetadata: {}, queuePassiveEffect: queueMock2 };
    combatBus.emit(event);
    expect(evaluateMock).toHaveBeenCalledWith(module, { trigger: 'OnAction', event });
    expect(queueMock2).toHaveBeenCalledWith(dummyEffect);
  });

  it('OnHit triggers for each hit by the hero', () => {
    const { combatBus, phaseBus, combatMock, boardMock, evaluateMock } = setup();
    const module = createDummyModule('OnHit');

    registerPassiveModules('hero-1', [module], combatBus, phaseBus, combatMock, () => boardMock, evaluateMock);

    const queueMock = vi.fn();
    const event = { type: 'on_hit' as const, sourceId: 'hero-1', targetId: 'enemy-1', damageAmount: 3, queuePassiveEffect: queueMock };
    combatBus.emit(event);

    expect(evaluateMock).toHaveBeenCalledWith(module, { trigger: 'OnHit', event });
    expect(queueMock).toHaveBeenCalledWith(dummyEffect);
  });

  it('OnKill triggers for each unit killed by the hero', () => {
    const { combatBus, phaseBus, combatMock, boardMock, evaluateMock } = setup();
    const module = createDummyModule('OnKill');

    registerPassiveModules('hero-1', [module], combatBus, phaseBus, combatMock, () => boardMock, evaluateMock);

    const queueMock1 = vi.fn();
    const queueMock2 = vi.fn();
    
    // Multiple kills in one action
    const event1 = { type: 'on_kill' as const, sourceId: 'hero-1', targetId: 'enemy-1', queuePassiveEffect: queueMock1 };
    const event2 = { type: 'on_kill' as const, sourceId: 'hero-1', targetId: 'enemy-2', queuePassiveEffect: queueMock2 };
    
    combatBus.emit(event1);
    combatBus.emit(event2);

    expect(evaluateMock).toHaveBeenCalledTimes(2);
    expect(evaluateMock).toHaveBeenNthCalledWith(1, module, { trigger: 'OnKill', event: event1 });
    expect(evaluateMock).toHaveBeenNthCalledWith(2, module, { trigger: 'OnKill', event: event2 });

    expect(queueMock1).toHaveBeenCalledWith(dummyEffect);
    expect(queueMock2).toHaveBeenCalledWith(dummyEffect);
  });

  it('OnTurnStart invokes CombatResolver directly with generated effects', () => {
    const { combatBus, phaseBus, combatMock, boardMock, evaluateMock, resolveMock } = setup();
    const module = createDummyModule('OnTurnStart');

    registerPassiveModules('hero-1', [module], combatBus, phaseBus, combatMock, () => boardMock, evaluateMock);

    const event = { type: 'turn_started' as const, turnNumber: 2 };
    phaseBus.emit(event);

    expect(evaluateMock).toHaveBeenCalledWith(module, { trigger: 'OnTurnStart', event });
    expect(resolveMock).toHaveBeenCalledWith(boardMock, dummyEffect, { bus: combatBus });
  });

});
