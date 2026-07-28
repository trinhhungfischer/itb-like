// Turn & Phase Manager — Phase Events unit tests (Vitest)
//
// Verifies story-002-phase-events.md AC-1: the manager emits the fixed
// phase-event vocabulary (turn_started, player_phase_begun, action_applied,
// environment_resolved, hazard_ticked, enemy_action_resolved, enemy_spawned,
// intents_telegraphed, battle_ended) on the synchronous ADR-0002 event bus,
// with correct payloads, synchronously, in registration order — riding the
// same guarantees tests/unit/event-bus/event_bus_test.ts already proves for
// EventBus itself.
//
// SCOPE NOTE: `action_undone` is reserved in PhaseEventMap (story-002 AC-1
// names it) but is NOT emitted by any code path in this deliverable — there
// is no `undo()` method on TurnPhaseManager (full undo/redo is Story 004,
// see turn-phase-manager.ts's class doc comment for the corrected scope
// line). This is a genuine, flagged gap between story-002's AC-1 and its own
// "Out of Scope: Story 004" line; the type is pinned for Story 004 to use
// as-is.
//
// Naming follows the project standard: [system]_[feature]_test.ts,
// test_[scenario]_[expected] for cases.

import { describe, it, expect } from 'vitest'
import { makeManager, makeScriptedObjective } from './fakes.js'

describe('TurnPhaseManager phase events: vocabulary coverage (AC-1)', () => {
  it('test_full_turn_emits_every_implemented_vocabulary_event_type_at_least_once', () => {
    // Arrange
    const { manager, eventBus } = makeManager()
    const seen = new Set<string>()
    // action_undone deliberately excluded — see file header scope note.
    const implementedTypes = [
      'turn_started',
      'player_phase_begun',
      'action_applied',
      'environment_resolved',
      'hazard_ticked',
      'enemy_action_resolved',
      'enemy_spawned',
      'intents_telegraphed',
      'battle_ended',
    ] as const
    for (const type of implementedTypes) {
      eventBus.on(type, (e) => seen.add(e.type))
    }

    // Act: Setup + turn 1 + one action + commit into turn 2 + abandon (covers battle_ended too).
    manager.startBattle()
    manager.applyAction([{ kind: 'noop' }])
    manager.endPlayerPhase()
    manager.abandon()

    // Assert: every implemented vocabulary event fired at least once in this scripted run.
    expect([...seen].sort()).toEqual([...implementedTypes].sort())
  })
})

describe('TurnPhaseManager phase events: turn_started', () => {
  it('test_turn_started_payload_carries_the_new_turn_number', () => {
    // Arrange
    const { manager, eventBus } = makeManager()
    let received: { turn: number } | undefined
    eventBus.on('turn_started', (e) => {
      received = e
    })

    // Act
    manager.startBattle()

    // Assert
    expect(received).toEqual({ type: 'turn_started', turn: 1 })
  })
})

describe('TurnPhaseManager phase events: player_phase_begun', () => {
  it('test_player_phase_begun_fires_synchronously_immediately_after_turn_started', () => {
    // Arrange
    const { manager, eventBus } = makeManager()
    const order: string[] = []
    eventBus.on('turn_started', () => order.push('turn_started'))
    eventBus.on('player_phase_begun', () => order.push('player_phase_begun'))

    // Act
    manager.startBattle()

    // Assert: both already ran, synchronously, before startBattle() returned.
    expect(order).toEqual(['turn_started', 'player_phase_begun'])
  })
})

describe('TurnPhaseManager phase events: action_applied', () => {
  it('test_apply_action_emits_action_applied_with_stack_depth', () => {
    // Arrange
    const { manager, eventBus } = makeManager()
    manager.startBattle()
    let received: { turn: number; stackDepth: number } | undefined
    eventBus.on('action_applied', (e) => {
      received = e
    })

    // Act
    manager.applyAction([{ kind: 'noop' }])

    // Assert
    expect(received).toEqual({ type: 'action_applied', turn: 1, stackDepth: 2 })
  })
})

describe('TurnPhaseManager phase events: system-driven phase markers', () => {
  it('test_environment_and_hazard_events_carry_current_turn_number', () => {
    // Arrange
    const { manager, eventBus } = makeManager()
    let hazard: { turn: number } | undefined
    let env: { turn: number } | undefined
    eventBus.on('hazard_ticked', (e) => {
      hazard = e
    })
    eventBus.on('environment_resolved', (e) => {
      env = e
    })
    manager.startBattle()

    // Act
    manager.endPlayerPhase()

    // Assert
    expect(hazard).toEqual({ type: 'hazard_ticked', turn: 1 })
    expect(env).toEqual({ type: 'environment_resolved', turn: 1 })
  })

  it('test_enemy_action_resolved_and_enemy_spawned_carry_current_turn_number', () => {
    // Arrange
    const { manager, eventBus } = makeManager()
    let resolved: { turn: number } | undefined
    let spawned: { turn: number } | undefined
    eventBus.on('enemy_action_resolved', (e) => {
      resolved = e
    })
    eventBus.on('enemy_spawned', (e) => {
      spawned = e
    })
    manager.startBattle()

    // Act
    manager.endPlayerPhase()

    // Assert
    expect(resolved).toEqual({ type: 'enemy_action_resolved', turn: 1 })
    expect(spawned).toEqual({ type: 'enemy_spawned', turn: 1 })
  })

  it('test_intents_telegraphed_turn_is_the_turn_the_intents_apply_to', () => {
    // Arrange
    const { manager, eventBus } = makeManager()
    const payloads: number[] = []
    eventBus.on('intents_telegraphed', (e) => payloads.push(e.turn))

    // Act
    manager.startBattle() // Setup telegraphs turn 1
    manager.endPlayerPhase() // Telegraph phase of turn 1 telegraphs turn 2

    // Assert
    expect(payloads).toEqual([1, 2])
  })
})

describe('TurnPhaseManager phase events: battle_ended', () => {
  it('test_battle_ended_payload_carries_result_and_final_turn', () => {
    // Arrange
    const objective = makeScriptedObjective((callIndex) => (callIndex === 3 ? 'victory' : 'ongoing'))
    const { manager, eventBus } = makeManager({ objective })
    let received: { turn: number; result: string } | undefined
    eventBus.on('battle_ended', (e) => {
      received = e
    })

    // Act
    manager.startBattle()
    manager.endPlayerPhase()

    // Assert
    expect(received).toEqual({ type: 'battle_ended', turn: 1, result: 'Victory' })
  })
})

describe('TurnPhaseManager phase events: synchronous dispatch (no deferral)', () => {
  it('test_end_player_phase_handlers_have_already_run_before_the_call_returns', () => {
    // Arrange
    const { manager, eventBus } = makeManager()
    manager.startBattle()
    let ranSynchronously = false
    eventBus.on('environment_resolved', () => {
      ranSynchronously = true
    })

    // Act
    manager.endPlayerPhase()

    // Assert: no await, no microtask flush needed.
    expect(ranSynchronously).toBe(true)
  })
})
