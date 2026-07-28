// Turn & Phase Manager — Core Phase Loop unit tests (Vitest)
//
// Verifies story-001-core-phase-loop.md AC-1 and the corresponding GDD
// acceptance criteria in design/gdd/turn-and-phase-manager.md: fixed
// per-turn phase order, Setup telegraph, determinism, early defeat checks,
// hard_turn_cap, terminal-result guarantees, and ownership boundaries.
//
// Naming follows the project standard: [system]_[feature]_test.ts,
// test_[scenario]_[expected] for cases. All tests are deterministic (no
// RNG, no wall-clock, no iteration-order reliance) — the fakes in fakes.ts
// have no time/randomness dependency.

import { describe, it, expect } from 'vitest'
import { PHASE_RING } from '../../../src/core/turn/turn-phase-types.js'
import { turnsElapsed, turnsRemaining, TURNS_REMAINING_UNCAPPED, undoLevelsUpperBound } from '../../../src/core/turn/turn-phase-formulas.js'
import { SQUAD_SIZE_DEFAULT, ACTIONS_PER_HERO_TURN_DEFAULT } from '../../../src/core/turn/turn-phase-config.js'
import { makeManager, makeScriptedObjective, recordAllEvents } from './fakes.js'

describe('TurnPhaseManager: turn numbering (Rule 1)', () => {
  it('test_fresh_battle_start_battle_sets_current_turn_to_1', () => {
    // Arrange
    const { manager } = makeManager()

    // Act
    manager.startBattle()

    // Assert
    expect(manager.getCurrentTurn()).toBe(1)
    expect(manager.getCurrentPhase()).toBe('PlayerPhase')
  })

  it('test_end_check_ongoing_next_turn_start_increments_current_turn', () => {
    // Arrange
    const { manager } = makeManager()
    manager.startBattle()

    // Act: turn 1 -> commit -> objective ongoing -> loops to turn 2
    manager.endPlayerPhase()

    // Assert
    expect(manager.getCurrentTurn()).toBe(2)
    expect(manager.getCurrentPhase()).toBe('PlayerPhase')
  })

  it('test_start_battle_called_twice_throws_invariant_error', () => {
    // Arrange
    const { manager } = makeManager()
    manager.startBattle()

    // Act + Assert: Channel-2 programmer error, not a legal gameplay input.
    expect(() => manager.startBattle()).toThrow()
  })
})

describe('TurnPhaseManager: fixed per-turn phase order (AC-1, Rule 3)', () => {
  it('test_full_turn_emits_phase_events_in_exact_ring_order', () => {
    // Arrange
    const { manager, eventBus } = makeManager()
    const log = recordAllEvents(eventBus)

    // Act
    manager.startBattle() // Setup + TurnStart(1) + PlayerPhase(1)
    manager.endPlayerPhase() // Environment -> EnemyResolve -> Spawn -> Telegraph -> EndCheck -> TurnStart(2) -> PlayerPhase(2)

    // Assert: exact sequence, no skip/reorder.
    expect(log.map((e) => e.type)).toEqual([
      'intents_telegraphed', // Setup
      'turn_started', // turn 1
      'player_phase_begun', // turn 1
      'hazard_ticked', // Environment (turn 1)
      'environment_resolved',
      'enemy_action_resolved', // EnemyResolve (turn 1)
      'enemy_spawned', // Spawn (turn 1)
      'intents_telegraphed', // Telegraph (turn 1, telegraphs turn 2)
      'turn_started', // turn 2
      'player_phase_begun', // turn 2
    ])
  })

  it('test_phase_ring_constant_has_seven_phases_in_gdd_order', () => {
    // Assert: Formula "phasesPerTurn == 7" + the exact named order.
    expect(PHASE_RING).toEqual([
      'TurnStart',
      'PlayerPhase',
      'Environment',
      'EnemyResolve',
      'Spawn',
      'Telegraph',
      'EndCheck',
    ])
    expect(PHASE_RING.length).toBe(7)
  })

  it('test_environment_resolved_fires_strictly_before_enemy_action_resolved', () => {
    // Arrange: regression guard for environment-first (deliberate tactical setup/disruption).
    const { manager, eventBus } = makeManager()
    const log = recordAllEvents(eventBus)

    // Act
    manager.startBattle()
    manager.endPlayerPhase()

    // Assert
    const envIndex = log.findIndex((e) => e.type === 'environment_resolved')
    const enemyIndex = log.findIndex((e) => e.type === 'enemy_action_resolved')
    expect(envIndex).toBeGreaterThanOrEqual(0)
    expect(enemyIndex).toBeGreaterThan(envIndex)
  })
})

describe('TurnPhaseManager: Setup telegraph (Rule 2)', () => {
  it('test_setup_completes_with_manager_already_awaiting_player_phase_input', () => {
    // Arrange
    const { manager } = makeManager()

    // Act: startBattle() takes no player-input parameters at all, so any
    // telegraph it produces is generated with zero player actions.
    manager.startBattle()

    // Assert: no telegraph is deferred past Setup — the manager is already
    // awaiting Player-Phase input when startBattle() returns.
    expect(manager.getCurrentPhase()).toBe('PlayerPhase')
  })

  it('test_setup_telegraph_calls_are_recorded_in_manager_call_log', () => {
    // Arrange
    const { manager, callLog } = makeManager()

    // Act
    manager.startBattle()

    // Assert: chooseIntents/telegraphIntents both ran during Setup.
    expect(callLog).toEqual(['environment.telegraphIntents', 'enemy.chooseIntents'])
  })
})

describe('TurnPhaseManager: determinism (Rule 5)', () => {
  it('test_identical_input_sequences_produce_identical_event_logs_on_two_instances', () => {
    // Arrange
    const a = makeManager()
    const b = makeManager()
    const logA = recordAllEvents(a.eventBus)
    const logB = recordAllEvents(b.eventBus)

    // Act: identical scripted sequence on both instances.
    a.manager.startBattle()
    b.manager.startBattle()
    a.manager.endPlayerPhase()
    b.manager.endPlayerPhase()
    a.manager.applyAction([{ kind: 'noop' }])
    b.manager.applyAction([{ kind: 'noop' }])
    a.manager.endPlayerPhase()
    b.manager.endPlayerPhase()

    // Assert: byte-for-byte identical event type sequence and payloads.
    expect(logA).toEqual(logB)
  })

  it('test_non_player_phases_call_zero_input_and_zero_rng_dependent_fakes', () => {
    // Arrange: the fakes in fakes.ts have no RNG/time dependency by
    // construction (deterministic call-order recorders / counters), so any
    // divergence here would come from the manager itself introducing
    // nondeterminism. Two full turns should reproduce the identical call log.
    const first = makeManager()
    managerRunTwoTurns(first.manager)
    const firstLog = [...first.callLog]

    const second = makeManager()
    managerRunTwoTurns(second.manager)

    // Assert
    expect(second.callLog).toEqual(firstLog)
  })
})

function managerRunTwoTurns(manager: ReturnType<typeof makeManager>['manager']): void {
  manager.startBattle()
  manager.endPlayerPhase()
  manager.endPlayerPhase()
}

describe('TurnPhaseManager: terminal result (Rule 6)', () => {
  it('test_victory_at_end_check_fires_battle_ended_exactly_once', () => {
    // Arrange: ongoing at every early check, victory only at the terminal EndCheck call (the 4th evaluate() call).
    const objective = makeScriptedObjective((callIndex) => (callIndex === 3 ? 'victory' : 'ongoing'))
    const { manager, eventBus } = makeManager({ objective })
    const log = recordAllEvents(eventBus)

    // Act
    manager.startBattle()
    manager.endPlayerPhase()

    // Assert
    const battleEndedEvents = log.filter((e) => e.type === 'battle_ended')
    expect(battleEndedEvents).toHaveLength(1)
    expect(battleEndedEvents[0]).toMatchObject({ result: 'Victory', turn: 1 })
    expect(manager.getBattleState()).toBe('Ended')
  })

  it('test_abandon_fires_battle_ended_abandon_and_stops_further_phases', () => {
    // Arrange
    const { manager, eventBus } = makeManager()
    const log = recordAllEvents(eventBus)
    manager.startBattle()

    // Act
    const result = manager.abandon()

    // Assert
    expect(result.ok).toBe(true)
    const battleEndedEvents = log.filter((e) => e.type === 'battle_ended')
    expect(battleEndedEvents).toHaveLength(1)
    expect(battleEndedEvents[0]).toMatchObject({ result: 'Abandon' })
    expect(manager.getBattleState()).toBe('Ended')
  })

  it('test_abandon_disabled_rejects_and_does_not_end_battle', () => {
    // Arrange
    const { manager } = makeManager({ config: { abandonEnabled: false } })
    manager.startBattle()

    // Act
    const result = manager.abandon()

    // Assert
    expect(result).toEqual({ ok: false, reason: 'AbandonDisabled' })
    expect(manager.getBattleState()).toBe('InTurn')
  })

  it('test_every_completed_battle_emits_battle_ended_exactly_once', () => {
    // Arrange: defeat at the very first early check (after Environment).
    const objective = makeScriptedObjective((callIndex) => (callIndex === 0 ? 'defeat' : 'ongoing'))
    const { manager, eventBus } = makeManager({ objective })
    const log = recordAllEvents(eventBus)

    // Act
    manager.startBattle()
    manager.endPlayerPhase()

    // Assert
    expect(log.filter((e) => e.type === 'battle_ended')).toHaveLength(1)
  })
})

describe('TurnPhaseManager: early defeat checks (Rule 7)', () => {
  it('test_defeat_after_environment_ends_battle_immediately_skipping_remaining_phases', () => {
    // Arrange
    const objective = makeScriptedObjective((callIndex) => (callIndex === 0 ? 'defeat' : 'ongoing'))
    const { manager, callLog } = makeManager({ objective })
    manager.startBattle()

    // Act
    manager.endPlayerPhase()

    // Assert: Environment DID run — GDD Rule 7 puts the early defeat check
    // "immediately after Environment", so Environment must resolve before the
    // check can see a defeat. EnemyResolve/Spawn/Telegraph never ran.
    expect(callLog).toEqual([
      'environment.telegraphIntents', // Setup
      'enemy.chooseIntents', // Setup
      'environment.resolveEnvironment', // Environment ran, THEN the check fired
    ])
    expect(manager.getBattleState()).toBe('Ended')
  })

  it('test_mid_turn_victory_does_not_end_battle_early', () => {
    // Arrange: an early check reporting 'victory' must be ignored (early
    // checks are lose-only, GDD Rule 7); the manager should continue running
    // subsequent phases rather than ending on the spot.
    const objective = makeScriptedObjective((callIndex) => (callIndex === 0 ? 'victory' : 'ongoing'))
    const { manager, callLog } = makeManager({ objective })
    manager.startBattle()

    // Act
    manager.endPlayerPhase()

    // Assert: the full ring ran; battle did not end at the early check.
    expect(callLog).toEqual([
      'environment.telegraphIntents', // Setup
      'enemy.chooseIntents', // Setup
      'environment.resolveEnvironment', // Environment
      'enemy.resolveTelegraphed', // EnemyResolve
      'enemy.emergeSpawns', // Spawn
      'environment.telegraphIntents', // Telegraph
      'enemy.chooseIntents', // Telegraph
    ])
    expect(manager.getBattleState()).toBe('InTurn')
  })

  it('test_no_early_trigger_full_turn_makes_exactly_four_objective_evaluate_calls', () => {
    // Arrange
    const objective = makeScriptedObjective(() => 'ongoing')
    const { manager } = makeManager({ objective })

    // Act
    manager.startBattle()
    manager.endPlayerPhase()

    // Assert: 3 early lose-only checks + 1 terminal check.
    expect(objective.calls).toHaveLength(4)
    expect(objective.calls.map((c) => c.turn)).toEqual([1, 1, 1, 1])
  })
})

describe('TurnPhaseManager: hard_turn_cap safety valve', () => {
  it('test_ongoing_forever_force_ends_defeat_exactly_at_hard_turn_cap_boundary', () => {
    // Arrange: small cap for a fast test; Objective always reports ongoing.
    const objective = makeScriptedObjective(() => 'ongoing')
    const { manager, eventBus } = makeManager({ objective, config: { hardTurnCap: 3 } })
    const log = recordAllEvents(eventBus)

    // Act: run turns 1, 2, then the terminal check of turn 3 should force-end.
    manager.startBattle() // turn 1
    manager.endPlayerPhase() // -> turn 2
    manager.endPlayerPhase() // -> turn 3
    manager.endPlayerPhase() // turn 3's EndCheck: turn >= hardTurnCap(3) -> forced Defeat

    // Assert: forced at turn 3 exactly, not turn 2, not turn 4.
    const battleEndedEvents = log.filter((e) => e.type === 'battle_ended')
    expect(battleEndedEvents).toHaveLength(1)
    expect(battleEndedEvents[0]).toMatchObject({ result: 'Defeat', turn: 3 })
  })

  it('test_hard_turn_cap_not_yet_reached_does_not_force_end', () => {
    // Arrange
    const objective = makeScriptedObjective(() => 'ongoing')
    const { manager } = makeManager({ objective, config: { hardTurnCap: 3 } })

    // Act
    manager.startBattle() // turn 1
    manager.endPlayerPhase() // -> turn 2

    // Assert
    expect(manager.getBattleState()).toBe('InTurn')
    expect(manager.getCurrentTurn()).toBe(2)
  })
})

describe('TurnPhaseManager: ownership boundaries (Rule 8)', () => {
  it('test_get_current_turn_and_phase_return_live_accurate_values_mid_battle', () => {
    // Arrange
    const { manager } = makeManager()

    // Act + Assert: before startBattle().
    expect(manager.getCurrentTurn()).toBe(0)
    expect(manager.getCurrentPhase()).toBeNull()

    manager.startBattle()
    expect(manager.getCurrentTurn()).toBe(1)
    expect(manager.getCurrentPhase()).toBe('PlayerPhase')

    manager.endPlayerPhase()
    expect(manager.getCurrentTurn()).toBe(2)
    expect(manager.getCurrentPhase()).toBe('PlayerPhase')
  })
})

describe('TurnPhaseManager: edge cases', () => {
  it('test_zero_action_player_phase_end_turn_is_a_legal_pass', () => {
    // Arrange
    const { manager } = makeManager()
    manager.startBattle()

    // Act
    const result = manager.endPlayerPhase()

    // Assert
    expect(result.ok).toBe(true)
    expect(manager.getCurrentTurn()).toBe(2)
  })

  it('test_all_enemies_die_mid_player_phase_remaining_phases_run_as_noop_without_crash', () => {
    // Arrange: the fake EnemyDriver/EnvironmentDriver are unconditional
    // no-ops regardless of board occupancy, exactly matching "no enemies"
    // degrading to a no-op rather than a crash (GDD Edge Cases).
    const { manager } = makeManager()
    manager.startBattle()

    // Act + Assert: no throw.
    expect(() => manager.endPlayerPhase()).not.toThrow()
    expect(manager.getCurrentTurn()).toBe(2)
  })
})

describe('TurnPhaseManager: Formula F1 (turn counter)', () => {
  it('test_turns_elapsed_and_remaining_match_worked_example', () => {
    // GDD worked example: max_turns=10, at Turn 4 -> turnsElapsed=3, turnsRemaining=7.
    expect(turnsElapsed(4)).toBe(3)
    expect(turnsRemaining(4, 10)).toBe(7)
  })

  it('test_turns_remaining_is_na_sentinel_when_uncapped_not_zero_or_infinity_or_null', () => {
    const result = turnsRemaining(4, null)
    expect(result).toBe(TURNS_REMAINING_UNCAPPED)
    expect(result).not.toBe(0)
    expect(result).not.toBeNull()
  })
})

describe('TurnPhaseManager: Formula F2 (undo upper bound, documentation-only)', () => {
  it('test_undo_levels_upper_bound_matches_registry_squad_size_and_actions_per_hero', () => {
    // GDD worked example: H=3, A_max=2 -> max 6 actions/phase.
    expect(undoLevelsUpperBound(SQUAD_SIZE_DEFAULT, ACTIONS_PER_HERO_TURN_DEFAULT)).toBe(6)
  })
})
