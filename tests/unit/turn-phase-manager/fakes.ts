// Turn & Phase Manager test fakes — Combat/Enemy/Environment/Objective
// doubles implementing the manager's own contracts (turn-phase-contracts.ts).
//
// Deterministic, RNG-free, hand-scripted, no I/O — per Test Standards
// ("mock external dependencies... tests should be fast and deterministic").
// Real Board & Grid is used directly (imported, not reimplemented) so undo
// tests can assert against real, observable board mutations.

import { makeBoard, type Board } from '../../../src/core/board/index.js'
import type { BusEvent } from '../../../src/core/events/event-bus.js'
import { EventBus } from '../../../src/core/events/event-bus.js'
import type {
  CombatResolver,
  EffectPrimitive,
  EnemyDriver,
  EnvironmentDriver,
  ObjectiveConfig,
  ObjectiveEvaluator,
  ObjectiveResult,
} from '../../../src/core/turn/turn-phase-contracts.js'
import type { PhaseEventMap } from '../../../src/core/turn/turn-phase-events.js'
import { TurnPhaseManager, type TurnPhaseManagerDeps } from '../../../src/core/turn/turn-phase-manager.js'
import type { TurnPhaseConfig } from '../../../src/core/turn/turn-phase-config.js'

/** Fresh default 8x8 board (src/core/board, not reimplemented). */
export function testBoard(): Board {
  return makeBoard()
}

/**
 * Fake CombatResolver that mutates the LIVE board deterministically and
 * observably: each call to `resolve()` places a distinct unit at
 * `(callIndex, 0)`, regardless of the `effects` argument's contents (this
 * manager never interprets `EffectPrimitive.kind` itself, so the fake does
 * not need to either). Lets undo/redo tests assert real board-state changes
 * and reversions without any real Combat Resolution implementation.
 */
export function makeFakeCombat(): CombatResolver & { callCount: () => number } {
  let count = 0
  return {
    callCount: () => count,
    resolve(board: Board, _effects: readonly EffectPrimitive[]): readonly BusEvent[] {
      board.place({ col: count, row: 0 }, `u${count}`)
      count += 1
      return []
    },
  }
}

/** Records every phase-driven call in `callLog`, in the order the manager makes them, without touching the board. */
export function makeLoggingEnemy(callLog: string[]): EnemyDriver {
  return {
    resolveTelegraphed(_board: Board): readonly BusEvent[] {
      callLog.push('enemy.resolveTelegraphed')
      return []
    },
    emergeSpawns(_board: Board): readonly BusEvent[] {
      callLog.push('enemy.emergeSpawns')
      return []
    },
    chooseIntents(_board: Board): void {
      callLog.push('enemy.chooseIntents')
    },
  }
}

/** Records every phase-driven call in `callLog`, in the order the manager makes them, without touching the board. */
export function makeLoggingEnvironment(callLog: string[]): EnvironmentDriver {
  return {
    resolveEnvironment(_board: Board): readonly BusEvent[] {
      callLog.push('environment.resolveEnvironment')
      return []
    },
    telegraphIntents(_board: Board): void {
      callLog.push('environment.telegraphIntents')
    },
  }
}

/**
 * Scripted ObjectiveEvaluator: `script` is called once per `evaluate()`
 * invocation, in call order, and its return value becomes that call's
 * verdict. Every call is recorded in `calls` for assertions on call count /
 * turn arguments (GDD Rule 7: at most 4 `evaluate()` calls per turn).
 */
export function makeScriptedObjective(
  script: (callIndex: number, turn: number) => ObjectiveResult,
): ObjectiveEvaluator & { readonly calls: ReadonlyArray<{ readonly turn: number }> } {
  const calls: Array<{ turn: number }> = []
  return {
    calls,
    evaluate(_battleState, turn: number, _config: ObjectiveConfig) {
      const result = script(calls.length, turn)
      calls.push({ turn })
      return { result }
    },
  }
}

/** Always reports `ongoing` — never ends a battle on its own. */
export function makeAlwaysOngoingObjective(): ObjectiveEvaluator & { readonly calls: ReadonlyArray<{ readonly turn: number }> } {
  return makeScriptedObjective(() => 'ongoing')
}

const EMPTY_OBJECTIVE_CONFIG: ObjectiveConfig = Object.freeze({})

/** Convenience harness: wires a {@link TurnPhaseManager} with sensible always-ongoing/no-op fakes, overridable per test. */
export function makeManager(overrides?: {
  readonly board?: Board
  readonly combat?: CombatResolver
  readonly enemy?: EnemyDriver
  readonly environment?: EnvironmentDriver
  readonly objective?: ObjectiveEvaluator
  readonly objectiveConfig?: ObjectiveConfig
  readonly config?: Partial<TurnPhaseConfig>
}): {
  readonly manager: TurnPhaseManager
  readonly board: Board
  readonly eventBus: EventBus<PhaseEventMap>
  readonly callLog: string[]
} {
  const board = overrides?.board ?? testBoard()
  const eventBus = new EventBus<PhaseEventMap>()
  const callLog: string[] = []

  const deps: TurnPhaseManagerDeps = {
    board,
    eventBus,
    combat: overrides?.combat ?? makeFakeCombat(),
    enemy: overrides?.enemy ?? makeLoggingEnemy(callLog),
    environment: overrides?.environment ?? makeLoggingEnvironment(callLog),
    objective: overrides?.objective ?? makeAlwaysOngoingObjective(),
    objectiveConfig: overrides?.objectiveConfig ?? EMPTY_OBJECTIVE_CONFIG,
    ...(overrides?.config !== undefined ? { config: overrides.config } : {}),
  }

  return { manager: new TurnPhaseManager(deps), board, eventBus, callLog }
}

/** Subscribes to every event in {@link PhaseEventMap} and records `(type, payload)` pairs in emission order. */
export function recordAllEvents(eventBus: EventBus<PhaseEventMap>): BusEvent[] {
  const log: BusEvent[] = []
  const types: Array<keyof PhaseEventMap> = [
    'turn_started',
    'player_phase_begun',
    'action_applied',
    'action_undone',
    'environment_resolved',
    'hazard_ticked',
    'enemy_action_resolved',
    'enemy_spawned',
    'intents_telegraphed',
    'battle_ended',
  ]
  for (const type of types) {
    eventBus.on(type, (e) => log.push(e))
  }
  return log
}
