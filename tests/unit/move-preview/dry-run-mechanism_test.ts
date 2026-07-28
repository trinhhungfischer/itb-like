// Move Preview — Story 001: Core Dry-Run Mechanism
//
// Implements: production/epics/move-preview/story-001-dry-run-mechanism.md
// GDD: design/gdd/move-preview.md Rules 1-3, 6, 10, 12; Edge Cases
//      ("candidate somehow targets an already-dead unit" / rejection
//      handling); Acceptance Criteria "Dry-run correctness & no live
//      mutation", "Cancel / Commit".
// Governing ADRs: adr-0007-snapshot-undo-preview.md (the dry-run mechanism
// itself), adr-0006-combat-resolve-single-mutation-path.md (reuse of the
// identical resolve() entry point), adr-0005-board-combat-error-contract.md
// (Result-vs-throw — a gameplay rejection must never make a dry run throw).
//
// Mirrors the methodology of
// tests/integration/combat-resolution/move-preview-integration_test.ts (byte-
// identical live board, zero events on a shared bus, preview/commit parity)
// but exercises those guarantees THROUGH the MovePreview class itself
// (hover-driven, story-001+002), rather than by calling resolve() directly —
// that existing suite already proves the mechanism works when used
// correctly; this suite proves MovePreview uses it correctly.
//
// Naming: [system]_[feature]_test.ts / test_[scenario]_[expected].
// Deterministic: no RNG, no wall clock. Each test builds its own board/state.

import { describe, it, expect } from 'vitest'
import { makeBoard } from '../../../src/core/board/index.js'
import type { Board, Tile, UnitId } from '../../../src/core/board/index.js'
import { EventBus } from '../../../src/core/events/event-bus.js'
import { CombatState, resolve } from '../../../src/core/combat/index.js'
import type { CombatEvent, CombatEventMap, EffectPrimitive } from '../../../src/core/combat/index.js'
import type { SelectionEventMap } from '../../../src/core/input/selection-events.js'
import type { ActionMode } from '../../../src/core/input/selection-types.js'
import { MovePreview } from '../../../src/core/preview/move-preview.js'
import type { EffectCompiler } from '../../../src/core/preview/preview-ports.js'
import { TurnPhaseManager } from '../../../src/core/turn/turn-phase-manager.js'
import type {
  CombatResolver,
  EffectPrimitive as PortEffectPrimitive,
  EnemyDriver,
  EnvironmentDriver,
  ObjectiveEvaluator,
} from '../../../src/core/turn/turn-phase-contracts.js'
import type { PhaseEventMap } from '../../../src/core/turn/turn-phase-events.js'

/** Serializes every tile's occupant/terrain/hazard for whole-board equality assertions (Board has no `equals()`). */
function fingerprint(board: Board): string {
  const rows: string[] = []
  for (let row = 0; row < board.height; row++) {
    for (let col = 0; col < board.width; col++) {
      const tile = board.getTile(col, row)
      rows.push(`${col},${row}:${tile.terrain}:${tile.occupant ?? '-'}:${tile.hazard ?? '-'}`)
    }
  }
  return rows.join('|')
}

/** A minimal, deterministic EffectCompiler stand-in for Heroes & Abilities' compileEffects() (see preview-ports.ts). */
function makeEffectCompiler(
  fn: (unitId: UnitId, mode: ActionMode, target: Tile, board: Board) => readonly EffectPrimitive[] | null,
): EffectCompiler {
  return { compileEffects: fn }
}

const ALWAYS_PLAYER_PHASE = (): 'PlayerPhase' => 'PlayerPhase'

describe('move-preview: dry-run mechanism (ADR-0007) — no live mutation', () => {
  it('test_hover_driven_preview_leaves_the_live_board_byte_identical', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 1, row: 1 }, 'hero-1')
    state.registerUnit('hero-1', 10)
    const before = fingerprint(board)

    const selectionBus = new EventBus<SelectionEventMap>()
    const effectCompiler = makeEffectCompiler((unitId) => [
      { kind: 'push', targetId: unitId, direction: 'E', distance: 3 },
    ])
    new MovePreview({ board, state, selectionBus, effectCompiler, getCurrentPhase: ALWAYS_PLAYER_PHASE })

    selectionBus.emit({ type: 'hover', unitId: 'hero-1', mode: { kind: 'Move' }, tile: { col: 4, row: 1 } })

    expect(fingerprint(board)).toBe(before)
    expect(board.getOccupant(1, 1)).toBe('hero-1')
  })

  it('test_preview_dry_run_emits_zero_events_onto_a_shared_session_bus', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 1, row: 1 }, 'hero-1')
    state.registerUnit('hero-1', 10)

    // A "shared session bus" representative of the one a real commit path
    // (Turn & Phase Manager -> Combat Resolution) would inject for a real
    // commit. MovePreview is never given a reference to this bus at all —
    // it always constructs its own private EventBus per dry run
    // (move-preview.ts's runDryRun) — so this test proves the structural
    // guarantee: even a bus that exists elsewhere in the system never
    // observes preview activity.
    const sessionBus = new EventBus<CombatEventMap>()
    const observed: CombatEvent[] = []
    sessionBus.on('displacement_complete', (e) => observed.push(e))
    sessionBus.on('damage_applied', (e) => observed.push(e))
    sessionBus.on('collision_resolved', (e) => observed.push(e))
    sessionBus.on('unit_removed', (e) => observed.push(e))

    const selectionBus = new EventBus<SelectionEventMap>()
    const effectCompiler = makeEffectCompiler((unitId) => [
      { kind: 'push', targetId: unitId, direction: 'E', distance: 3 },
      { kind: 'damage', targetId: unitId, amount: 2 },
    ])
    const preview = new MovePreview({ board, state, selectionBus, effectCompiler, getCurrentPhase: ALWAYS_PLAYER_PHASE })

    selectionBus.emit({ type: 'hover', unitId: 'hero-1', mode: { kind: 'Move' }, tile: { col: 4, row: 1 } })

    // The preview's own (private) events DID happen...
    expect(preview.isReady()).toBe(true)
    expect(preview.getResult()?.events.length).toBeGreaterThan(0)
    // ...but the shared session bus structurally saw none of them.
    expect(observed).toEqual([])
  })

  it('test_preview_and_commit_of_the_same_candidate_produce_byte_identical_event_logs', () => {
    // Preview-Commit Parity Invariant (Rule 3) — the core promise this
    // module exists to keep, exercised end to end through MovePreview.
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 1, row: 1 }, 'hero-1')
    state.registerUnit('hero-1', 10)
    board.place({ col: 4, row: 1 }, 'enemy-1')
    state.registerUnit('enemy-1', 6)

    const selectionBus = new EventBus<SelectionEventMap>()
    const effectCompiler = makeEffectCompiler((unitId) => [
      { kind: 'push', targetId: unitId, direction: 'E', distance: 5 },
    ])
    const preview = new MovePreview({ board, state, selectionBus, effectCompiler, getCurrentPhase: ALWAYS_PLAYER_PHASE })

    selectionBus.emit({ type: 'hover', unitId: 'hero-1', mode: { kind: 'Move' }, tile: { col: 2, row: 1 } })
    const previewResult = preview.getResult()
    expect(previewResult).not.toBeNull()

    // Live board is unchanged (asserted above in the previous test's sibling
    // check), so committing NOW against it satisfies Preview-Commit Parity's
    // "unchanged live board" precondition (ADR-0007 Decision point 4).
    const commitEvents = resolve(board, state, previewResult!.effects, { bus: new EventBus<CombatEventMap>() })

    expect(commitEvents).toEqual(previewResult!.events)
  })

  it('test_a_result_typed_gameplay_rejection_inside_the_candidate_reaches_ready_not_a_thrown_failure', () => {
    // Story-001 AC: "Gameplay rejections must be observable as values so a
    // dry-run over a snapshot never throws for a merely-illegal move."
    // spawnUnit onto an already-occupied tile is exactly ADR-0005's
    // Channel-1 case: Combat Resolution rejects it as a `spawn_unit_rejected`
    // event, never a throw (combat-resolve.ts spawnUnitPrimitive).
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 1, row: 1 }, 'hero-1')
    state.registerUnit('hero-1', 10)

    const selectionBus = new EventBus<SelectionEventMap>()
    const effectCompiler = makeEffectCompiler(() => [
      { kind: 'spawnUnit', tile: { col: 1, row: 1 }, unitSpec: { id: 'ghost-1', hp: 1 } },
    ])
    const preview = new MovePreview({ board, state, selectionBus, effectCompiler, getCurrentPhase: ALWAYS_PLAYER_PHASE })

    expect(() =>
      selectionBus.emit({ type: 'hover', unitId: 'hero-1', mode: { kind: 'Ability', abilityId: 'summon' }, tile: { col: 1, row: 1 } }),
    ).not.toThrow()

    expect(preview.getLifecycleState()).toBe('Ready')
    expect(preview.getResult()?.events).toEqual([
      { type: 'spawn_unit_rejected', tile: { col: 1, row: 1 }, reason: 'TileNotClear' },
    ])
  })

  it('test_an_empty_effect_candidate_is_a_legal_no_consequence_preview_not_a_failure', () => {
    // GDD Edge Cases: "An ability's candidate chain is empty (effects = [])
    // ... The preview result is an explicit empty-effect preview... confirm
    // remains available."
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 1, row: 1 }, 'hero-1')
    state.registerUnit('hero-1', 10)

    const selectionBus = new EventBus<SelectionEventMap>()
    const effectCompiler = makeEffectCompiler(() => [])
    const preview = new MovePreview({ board, state, selectionBus, effectCompiler, getCurrentPhase: ALWAYS_PLAYER_PHASE })

    selectionBus.emit({ type: 'hover', unitId: 'hero-1', mode: { kind: 'Move' }, tile: { col: 1, row: 1 } })

    expect(preview.isReady()).toBe(true)
    expect(preview.getResult()?.events).toEqual([])
  })

  it('test_preview_computation_never_pushes_a_snapshot_onto_the_turn_managers_undo_seam', () => {
    // Rule 12: "Hovering ten different candidate targets in a row costs zero
    // undo-stack depth." Wires a REAL TurnPhaseManager sharing the same live
    // board MovePreview previews against, to prove preview activity never
    // touches turn-phase-manager.ts's playerPhaseSnapshots list.
    const board = makeBoard()
    const state = CombatState.empty()
    const combatBus = new EventBus<CombatEventMap>()
    const combat: CombatResolver = {
      resolve: (b, effects) => resolve(b, state, effects as readonly EffectPrimitive[], { bus: combatBus }),
    }
    const inertEnemy: EnemyDriver = { resolveTelegraphed: () => [], emergeSpawns: () => [], chooseIntents: () => undefined }
    const inertEnvironment: EnvironmentDriver = { resolveEnvironment: () => [], telegraphIntents: () => undefined }
    const ongoingObjective: ObjectiveEvaluator = { evaluate: () => ({ result: 'ongoing' as const }) }

    // Widens the properly-typed Combat effect literal to Turn's structural
    // `{kind: string}` port type at this ONE call site — the same pattern
    // tests/integration/sprint-1-battle-engine_test.ts's `toPort()` helper
    // documents: casting at each call site would silently disable literal
    // checking everywhere, so the cast lives here, once.
    const setup: readonly EffectPrimitive[] = [
      { kind: 'spawnUnit', tile: { col: 1, row: 1 }, unitSpec: { id: 'hero-1', hp: 10 } },
    ]
    combat.resolve(board, setup as unknown as readonly PortEffectPrimitive[])

    const manager = new TurnPhaseManager({
      board,
      eventBus: new EventBus<PhaseEventMap>(),
      combat,
      enemy: inertEnemy,
      environment: inertEnvironment,
      objective: ongoingObjective,
      objectiveConfig: {},
    })
    manager.startBattle()
    const snapshotCountBeforePreviews = manager.getPlayerPhaseSnapshotCount()
    expect(snapshotCountBeforePreviews).toBe(1) // phase-start snapshot only

    const selectionBus = new EventBus<SelectionEventMap>()
    const effectCompiler = makeEffectCompiler((unitId, _mode, target) => [
      { kind: 'push', targetId: unitId, direction: target.col > 1 ? 'E' : 'W', distance: 1 },
    ])
    new MovePreview({ board, state, selectionBus, effectCompiler, getCurrentPhase: () => manager.getCurrentPhase() })

    for (const tile of [{ col: 2, row: 1 }, { col: 0, row: 1 }, { col: 3, row: 1 }]) {
      selectionBus.emit({ type: 'hover', unitId: 'hero-1', mode: { kind: 'Move' }, tile })
    }

    expect(manager.getPlayerPhaseSnapshotCount()).toBe(snapshotCountBeforePreviews)
  })
})
