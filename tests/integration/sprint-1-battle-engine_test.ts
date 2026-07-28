/**
 * Sprint 1 acceptance — the battle engine, wired for real.
 *
 * Every other test in this repo is a unit test against one module, with its
 * neighbours faked. That leaves the sprint's actual goal unverified:
 *
 *   "A headless battle engine that can run a complete turn cycle ... with all
 *    combat primitives ... and produce a deterministic board state from any
 *    seed."  — production/sprints/sprint-1.md
 *
 * 245 unit tests can all pass while the modules refuse to fit together. This
 * file wires the REAL Board, the REAL Combat Resolution, the REAL EventBus and
 * the REAL TurnPhaseManager and drives them through complete turns.
 *
 * WHAT IS STILL FAKED, AND WHY: Enemy/Abilities & Telegraph and Objective /
 * Win-Lose are Sprint 2 Feature-layer systems with no `src/` module yet, so
 * they are necessarily test doubles here. The Environment driver likewise.
 * That is a real limit on what this file proves — it verifies the Foundation
 * and Core layers integrate, not the full game loop. When those systems land,
 * this file should swap the doubles for the real modules.
 */

import { describe, it, expect } from 'vitest'

import { makeBoard, TerrainType } from '../../src/core/board/index.js'
import type { Board, Tile } from '../../src/core/board/index.js'
import { EventBus } from '../../src/core/events/event-bus.js'
import { CombatState, resolve } from '../../src/core/combat/index.js'
import type { EffectPrimitive as CombatEffect } from '../../src/core/combat/index.js'
import { TurnPhaseManager } from '../../src/core/turn/index.js'
import type {
  PhaseEventMap,
  CombatResolver,
  EffectPrimitive,
  EnemyDriver,
  EnvironmentDriver,
  ObjectiveEvaluator,
} from '../../src/core/turn/index.js'

// ─────────────────────────────────────────────────────────────────────────────
// Wiring
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adapts the REAL Combat `resolve()` to Turn's `CombatResolver` port.
 *
 * Note the shape mismatch this exposes: the port is
 * `resolve(board, effects)` while Combat's real signature is
 * `resolve(board, state, effects, options)`. `CombatState` was introduced
 * during implementation because Board stores no HP or hazard immunities and
 * `Unit` belongs to a Feature-layer module Combat must not import. The port
 * predates that, so the adapter closes over the state.
 */
function makeRealCombatResolver(state: CombatState, bus: EventBus<never>): CombatResolver {
  return {
    resolve(board: Board, effects: readonly EffectPrimitive[]) {
      // The port's EffectPrimitive is structural (`{ kind: string }`); Combat's
      // is a discriminated union. The cast is the seam, and it is checked at
      // runtime by Combat's own validateEffects().
      return resolve(board, state, effects as readonly CombatEffect[], {
        bus: bus as never,
      })
    },
  }
}

/**
 * Widens a properly-typed Combat effect list to Turn's structural port type.
 *
 * The cast lives HERE and nowhere else, deliberately. Turn's `EffectPrimitive`
 * is `{ kind: string }` — strictly looser than Combat's discriminated union —
 * so casting at each call site would silently disable checking on every effect
 * literal in this file. It already bit once: an early draft wrote
 * `direction: 'east'` and TypeScript said nothing, because the cast had thrown
 * the union away. `Direction` is `'N' | 'S' | 'E' | 'W'`, so
 * `DIRECTION_VECTORS['east']` was `undefined` and Board.step() crashed on
 * `undefined.col` at runtime. Declaring the literals as `CombatEffect[]` first
 * puts that error back where the compiler can see it.
 */
function toPort(effects: readonly CombatEffect[]): readonly EffectPrimitive[] {
  return effects as unknown as readonly EffectPrimitive[]
}

/** A deterministic no-op enemy. Enemy/Telegraph is Sprint 2. */
function makeInertEnemy(): EnemyDriver {
  return {
    resolveTelegraphed: () => [],
    emergeSpawns: () => [],
    chooseIntents: () => undefined,
  }
}

/** A deterministic no-op environment. */
function makeInertEnvironment(): EnvironmentDriver {
  return {
    resolveEnvironment: () => [],
    telegraphIntents: () => undefined,
  }
}

/** Objective that never terminates the battle — lets us drive many turns. */
function makeOngoingObjective(): ObjectiveEvaluator {
  return { evaluate: () => ({ result: 'ongoing' as const }) }
}

const TILE = (col: number, row: number): Tile => ({ col, row })

/**
 * Builds a complete, real battle: 8x8 board, two units registered in
 * CombatState, a wall to push into, and a manager wired to real Combat.
 */
function makeBattle() {
  const board = makeBoard()
  const state = CombatState.empty()
  const combatBus = new EventBus<never>()
  const phaseBus = new EventBus<PhaseEventMap>()

  const combat = makeRealCombatResolver(state, combatBus)

  // Spawn through the real primitive so CombatState and Board agree.
  const setup: readonly CombatEffect[] = [
    { kind: 'spawnUnit', tile: TILE(1, 1), unitSpec: { id: 'hero', hp: 5 } },
    { kind: 'spawnUnit', tile: TILE(3, 1), unitSpec: { id: 'enemy', hp: 3 } },
    { kind: 'setTerrain', tile: TILE(5, 1), terrainType: TerrainType.Blocked },
  ]
  combat.resolve(board, toPort(setup))

  const manager = new TurnPhaseManager({
    board,
    eventBus: phaseBus,
    combat,
    enemy: makeInertEnemy(),
    environment: makeInertEnvironment(),
    objective: makeOngoingObjective(),
    objectiveConfig: {},
  })

  return { board, state, manager, phaseBus, combat }
}

/** Byte-comparable board fingerprint — every tile's terrain, occupant and hazard. */
function fingerprint(board: Board): string {
  const rows: string[] = []
  for (let r = 0; r < 8; r += 1) {
    const cells: string[] = []
    for (let c = 0; c < 8; c += 1) {
      const t = board.getTile(c, r)
      cells.push(`${t.terrain}:${t.occupant ?? '-'}:${t.hazard ?? '-'}`)
    }
    rows.push(cells.join('|'))
  }
  return rows.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Sprint 1 acceptance: real modules integrate', () => {
  it('test_real_combat_mutates_the_real_board_through_the_turn_managers_port', () => {
    const { board, manager, combat } = makeBattle()
    manager.startBattle()

    expect(board.getTile(3, 1).occupant).toBe('enemy')

    // Push the enemy two tiles right, through the port the manager holds.
    const push: readonly CombatEffect[] = [
      { kind: 'push', targetId: 'enemy', direction: 'E', distance: 2 },
    ]
    combat.resolve(board, toPort(push))

    expect(board.getTile(3, 1).occupant).toBeNull()
    expect(board.getTile(5, 1).occupant).toBeNull() // wall — did not land here
    expect(board.getTile(4, 1).occupant).toBe('enemy')
  })

  it('test_a_full_turn_cycle_completes_and_advances_the_turn_counter', () => {
    const { manager } = makeBattle()
    manager.startBattle()

    const startTurn = manager.getCurrentTurn()
    manager.endPlayerPhase()

    expect(manager.getBattleState()).toBe('InTurn')
    expect(manager.getCurrentTurn()).toBe(startTurn + 1)
  })

  it('test_ten_turns_run_without_the_engine_falling_over', () => {
    const { manager } = makeBattle()
    manager.startBattle()

    for (let i = 0; i < 10; i += 1) manager.endPlayerPhase()

    expect(manager.getBattleState()).toBe('InTurn')
    expect(manager.getCurrentTurn()).toBe(11)
  })

  it('test_two_identical_battles_produce_byte_identical_boards', () => {
    // The sprint goal's determinism claim, end to end across real modules.
    const a = makeBattle()
    const b = makeBattle()

    const script: readonly CombatEffect[] = [
      { kind: 'push', targetId: 'enemy', direction: 'E', distance: 2 },
      { kind: 'damage', targetId: 'enemy', amount: 1 },
      { kind: 'spawnHazard', tile: TILE(2, 2), hazardType: 'Fire', duration: 2 },
    ]

    for (const battle of [a, b]) {
      battle.manager.startBattle()
      battle.combat.resolve(battle.board, toPort(script))
      battle.manager.endPlayerPhase()
      battle.manager.endPlayerPhase()
    }

    expect(fingerprint(a.board)).toBe(fingerprint(b.board))
    expect(a.state.getHp('enemy')).toBe(b.state.getHp('enemy'))
  })

  it('test_combat_and_combat_state_never_disagree_about_a_removed_unit', () => {
    // Board owns position; CombatState owns HP. A kill must clear both, or the
    // two sources of truth drift -- the exact failure ADR-0008 warns about.
    const { board, state, combat, manager } = makeBattle()
    manager.startBattle()

    const kill: readonly CombatEffect[] = [{ kind: 'damage', targetId: 'enemy', amount: 99 }]
    combat.resolve(board, toPort(kill))

    expect(board.getTile(3, 1).occupant).toBeNull()
    expect(state.hasUnit('enemy')).toBe(false)
  })

  it('test_preview_against_a_snapshot_leaves_the_live_board_untouched', () => {
    // Pillar 1's load-bearing guarantee, across real Board + real Combat.
    const { board, state, manager } = makeBattle()
    manager.startBattle()

    const before = fingerprint(board)

    const previewBoard = board.snapshot()
    const previewBus = new EventBus<never>()
    resolve(
      previewBoard,
      state,
      [{ kind: 'push', targetId: 'enemy', direction: 'E', distance: 2 }] as readonly CombatEffect[],
      { bus: previewBus as never },
    )

    expect(fingerprint(board)).toBe(before)
    expect(previewBoard.getTile(4, 1).occupant).toBe('enemy')
  })
})
