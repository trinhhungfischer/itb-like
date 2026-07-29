import { test, expect } from 'vitest';
import { EventBus } from '../../../src/core/events/event-bus.js';
import { makeBoard } from '../../../src/core/board/index.js';
import { resolve, CombatState } from '../../../src/core/combat/index.js';
import type { EffectPrimitive } from '../../../src/core/combat/combat-types.js';
import type { CombatEventMap } from '../../../src/core/combat/combat-events.js';

test('Passive Trigger System - AC-3: OnHit passive effect resolves as follow-up', () => {
  const board = makeBoard();
  const state = CombatState.empty();
  const bus = new EventBus<CombatEventMap>();
  
  // Setup units
  board.place({ col: 1, row: 1 }, 'hero-1');
  state.registerUnit('hero-1', 10, [], undefined, []);
  
  board.place({ col: 1, row: 2 }, 'enemy-1');
  state.registerUnit('enemy-1', 10, [], undefined, []);

  // Listen to the bus to simulate a passive module hooked into OnHit
  const emittedEvents: string[] = [];
  bus.on('on_hit', (event) => {
    if (event.sourceId === 'hero-1') {
      // Simulate passive module queueing a bonus damage effect
      event.queuePassiveEffect([
        { kind: 'damage', targetId: 'enemy-1', amount: 2 }
      ]);
    }
  });

  bus.on('damage_applied', (event) => {
    emittedEvents.push(`damage_applied:${event.amount}`);
  });

  // Action: Hero hits enemy for 5 damage
  const effects: EffectPrimitive[] = [
    { kind: 'damage', targetId: 'enemy-1', amount: 5, sourceId: 'hero-1' }
  ];

  const events = resolve(board, state, effects, {
    bus,
    actionMetadata: { sourceId: 'hero-1', abilityId: 'strike' }
  });

  // Assert follow-up was processed
  expect(state.getHp('enemy-1')).toBe(3); // 10 - 5 (primary) - 2 (passive)
  
  // Verify order: Primary damage -> Passive damage
  expect(emittedEvents).toEqual([
    'damage_applied:5',
    'damage_applied:2'
  ]);
  
  // Check the emitted events list from resolve()
  const eventTypes = events.map(e => e.type);
  expect(eventTypes).toEqual([
    'on_action',         // from actionMetadata
    'damage_applied',    // primary damage
    'on_hit',            // emitted after primary damage
    'damage_applied'     // follow-up damage from passive (no sourceId)
  ]);
});

test('Passive Trigger System - Multiple simultaneous passives maintain equip order', () => {
  const board = makeBoard();
  const state = CombatState.empty();
  const bus = new EventBus<CombatEventMap>();
  
  board.place({ col: 1, row: 1 }, 'hero-1');
  state.registerUnit('hero-1', 10, [], undefined, []);
  board.place({ col: 1, row: 2 }, 'enemy-1');
  state.registerUnit('enemy-1', 10, [], undefined, []);

  // Passive 1 (Equipped first) -> pushes enemy
  bus.on('on_action', (event) => {
    if (event.sourceId === 'hero-1') {
      event.queuePassiveEffect([
        { kind: 'push', targetId: 'enemy-1', direction: 'S', distance: 1 }
      ]);
    }
  });

  // Passive 2 (Equipped second) -> damages enemy
  bus.on('on_action', (event) => {
    if (event.sourceId === 'hero-1') {
      event.queuePassiveEffect([
        { kind: 'damage', targetId: 'enemy-1', amount: 3 }
      ]);
    }
  });

  const effects: EffectPrimitive[] = []; // empty primary action

  const events = resolve(board, state, effects, {
    bus,
    actionMetadata: { sourceId: 'hero-1', abilityId: 'shout' }
  });

  // The queue array should have push, then damage.
  // We can verify this by checking the order of events emitted.
  const eventTypes = events.map(e => e.type);
  expect(eventTypes).toEqual([
    'on_action',            // from actionMetadata, triggers passives
    'displacement_complete', // from Passive 1 (first)
    'damage_applied'        // from Passive 2 (second)
  ]);
  
  // Assert state changes
  expect(state.getHp('enemy-1')).toBe(7); // 10 - 3
  const enemyTile = board.classify({ col: 1, row: 3 });
  expect(enemyTile.kind).toBe('Occupied');
  if (enemyTile.kind === 'Occupied') {
    expect(enemyTile.unitId).toBe('enemy-1'); // pushed South from 1,2 to 1,3
  }
});
