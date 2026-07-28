// Input & Selection — Story 002: Core Selection State Machine
//
// Implements: production/epics/input-selection/story-002-selection-state-machine.md
// GDD: design/gdd/input-and-selection.md "States and Transitions", Core Rules
// 1-10, Edge Cases, Formula 3.
// Governing ADRs: adr-0002-deterministic-event-bus.md (silent-emitter
// contract), adr-0005-board-combat-error-contract.md (Result-vs-throw,
// reused here as SelectionResult/SelectionRejectReason),
// adr-0009-reachable-tiles-coordinate-transform.md (shared coordinate
// transform).
//
// Covers every state (Idle, UnitSelected, Targeting, Locked, Inspect) and
// its transitions; illegal-transition rejections asserted by exact Result
// shape (`{ok:false, reason:'X'}`), not merely truthiness; both
// `require_confirm_click` modes; selection clearing on a Locked-gate-driven
// phase change; and click-tolerance behaviour at and beyond threshold
// (integrated through the state machine's own pointerDown/pointerUp, in
// addition to the pure-function coverage in
// input_selection_click_precision_test.ts).
//
// Heroes & Abilities and Combat Resolution do not exist under src/ yet
// (Status: Designed only) — this suite drives the machine entirely through
// the DI ports declared in src/core/input/selection-ports.ts (UnitLookup,
// TargetLegalityQuery, ActionCommitter) via lightweight, deterministic fakes
// defined below, exactly the seam those ports document.
//
// Naming: [system]_[feature]_test.ts / test_[scenario]_[expected].
// Deterministic: no RNG, no wall clock — every timestamp is caller-supplied
// and every board/unit fixture is built fresh per test (no shared mutable
// state between tests).

import { describe, it, expect } from 'vitest'
import { makeBoard } from '../../../src/core/board/board.js'
import type { Board } from '../../../src/core/board/board-interface.js'
import type { Tile, UnitId } from '../../../src/core/board/board-types.js'
import { EventBus } from '../../../src/core/events/event-bus.js'
import { tileToScreenCenter } from '../../../src/core/input/coordinate-transform.js'
import type { ViewTransform } from '../../../src/core/input/coordinate-transform.js'
import { SelectionStateMachine } from '../../../src/core/input/selection-state-machine.js'
import type { SelectionDeps } from '../../../src/core/input/selection-state-machine.js'
import type { SelectionConfig } from '../../../src/core/input/selection-config.js'
import { SelectionInvariantError } from '../../../src/core/input/selection-result.js'
import type { SelectionResult } from '../../../src/core/input/selection-result.js'
import type { SelectionEventMap } from '../../../src/core/input/selection-events.js'
import type {
  ActionCommitter,
  CommitOutcome,
  TargetLegalityQuery,
  UnitInfo,
  UnitLookup,
} from '../../../src/core/input/selection-ports.js'
import type { ActionMode } from '../../../src/core/input/selection-types.js'
import type { Phase } from '../../../src/core/turn/turn-phase-types.js'

// ── Fakes (the DI ports selection-ports.ts declares) ──────────────────────

class FakeUnitDirectory implements UnitLookup {
  private readonly units = new Map<UnitId, UnitInfo>()

  register(unit: UnitInfo): void {
    this.units.set(unit.id, unit)
  }

  setActingEligible(id: UnitId, eligible: boolean): void {
    const existing = this.units.get(id)
    if (existing === undefined) throw new Error(`FakeUnitDirectory: unknown unit ${id}`)
    this.units.set(id, { ...existing, actingEligible: eligible })
  }

  remove(id: UnitId): void {
    this.units.delete(id)
  }

  unitAt(tile: Tile, board: Board): UnitInfo | null {
    const occupant = board.getOccupant(tile.col, tile.row)
    if (occupant === null) return null
    return this.units.get(occupant) ?? null
  }

  unit(unitId: UnitId, _board: Board): UnitInfo | null {
    return this.units.get(unitId) ?? null
  }
}

class FakeTargetLegality implements TargetLegalityQuery {
  constructor(private readonly legalTiles: ReadonlySet<string>) {}

  isLegalTarget(_unitId: UnitId, _mode: ActionMode, target: Tile, _board: Board): boolean {
    return this.legalTiles.has(`${target.col},${target.row}`)
  }
}

class FakeActionCommitter implements ActionCommitter {
  readonly calls: Array<{ unitId: UnitId; mode: ActionMode; target: Tile }> = []

  constructor(private readonly outcome: CommitOutcome) {}

  commit(unitId: UnitId, mode: ActionMode, target: Tile, _board: Board): CommitOutcome {
    this.calls.push({ unitId, mode, target })
    return this.outcome
  }
}

// ── Test harness ────────────────────────────────────────────────────────
//
// Board fixture (8x8 default): hero-1 (1,1) and hero-2 (3,1) are eligible
// heroes; hero-exhausted (5,1) is a hero with 0 actions remaining;
// enemy-1 (2,4) is an enemy. Tile (0,0)/(6,6) are always empty.
// tileSize=100 keeps every tolerance-boundary pixel offset (≤15px, GDD's
// safe range ceiling) safely inside a single tile's footprint, so
// tolerance tests never accidentally cross a tile boundary.

const VIEW: ViewTransform = { originX: 0, originY: 0, tileSize: 100, boardWidth: 8, boardHeight: 8 }

interface HarnessOptions {
  legalTiles?: ReadonlySet<string>
  commitOutcome?: CommitOutcome
  config?: Partial<SelectionConfig>
}

interface Harness {
  machine: SelectionStateMachine
  board: Board
  units: FakeUnitDirectory
  committer: FakeActionCommitter
  events: Array<SelectionEventMap[keyof SelectionEventMap]>
  phase: { value: Phase | null }
  animating: { value: boolean }
  view: ViewTransform
}

function buildHarness(opts: HarnessOptions = {}): Harness {
  const board = makeBoard()
  board.place({ col: 1, row: 1 }, 'hero-1')
  board.place({ col: 3, row: 1 }, 'hero-2')
  board.place({ col: 5, row: 1 }, 'hero-exhausted')
  board.place({ col: 2, row: 4 }, 'enemy-1')

  const units = new FakeUnitDirectory()
  units.register({ id: 'hero-1', team: 'hero', actingEligible: true })
  units.register({ id: 'hero-2', team: 'hero', actingEligible: true })
  units.register({ id: 'hero-exhausted', team: 'hero', actingEligible: false })
  units.register({ id: 'enemy-1', team: 'enemy', actingEligible: false })

  const legality = new FakeTargetLegality(opts.legalTiles ?? new Set())
  const committer = new FakeActionCommitter(opts.commitOutcome ?? { committed: true, unitHasActionsRemaining: true })

  const bus = new EventBus<SelectionEventMap>()
  const events: Array<SelectionEventMap[keyof SelectionEventMap]> = []
  bus.on('hover', (e) => events.push(e))
  bus.on('select', (e) => events.push(e))
  bus.on('cancel', (e) => events.push(e))
  bus.on('confirm', (e) => events.push(e))

  const phase: { value: Phase | null } = { value: 'PlayerPhase' }
  const animating: { value: boolean } = { value: false }

  const deps: SelectionDeps = {
    board,
    eventBus: bus,
    unitLookup: units,
    targetLegality: legality,
    actionCommitter: committer,
    getCurrentPhase: () => phase.value,
    isAnimating: () => animating.value,
    getView: () => VIEW,
    ...(opts.config !== undefined ? { config: opts.config } : {}),
  }

  const machine = new SelectionStateMachine(deps)

  return { machine, board, units, committer, events, phase, animating, view: VIEW }
}

/** Presses down and releases at the exact center of `tile` (zero drift, well within tolerance). */
function clickAt(machine: SelectionStateMachine, tile: Tile, view: ViewTransform, t = 1000): SelectionResult {
  const { px, py } = tileToScreenCenter(tile.col, tile.row, view)
  machine.pointerDown({ px, py }, t)
  return machine.pointerUp({ px, py }, t + 50)
}

/** A click resolving off-board (Formula 1 returns null). */
function clickOffBoard(machine: SelectionStateMachine, t = 1000): SelectionResult {
  machine.pointerDown({ px: -1000, py: -1000 }, t)
  return machine.pointerUp({ px: -1000, py: -1000 }, t + 50)
}

const MOVE: ActionMode = { kind: 'Move' }

// ── Idle ────────────────────────────────────────────────────────────────

describe('input-selection: selection state machine — Idle', () => {
  it('test_idle_click_off_board_stays_idle_and_is_a_true_noop', () => {
    const h = buildHarness()
    const result = clickOffBoard(h.machine)
    expect(result).toEqual({ ok: true })
    expect(h.machine.getState()).toEqual({ status: 'Idle' })
    expect(h.events).toHaveLength(0)
  })

  it('test_idle_click_empty_tile_stays_idle', () => {
    const h = buildHarness()
    const result = clickAt(h.machine, { col: 0, row: 0 }, h.view)
    expect(result).toEqual({ ok: true })
    expect(h.machine.getState()).toEqual({ status: 'Idle' })
  })

  it('test_idle_click_friendly_eligible_unit_selects_it_and_emits_select', () => {
    const h = buildHarness()
    const result = clickAt(h.machine, { col: 1, row: 1 }, h.view)
    expect(result).toEqual({ ok: true })
    expect(h.machine.getState()).toEqual({ status: 'UnitSelected', unitId: 'hero-1' })
    expect(h.events).toEqual([{ type: 'select', unitId: 'hero-1' }])
  })

  it('test_idle_click_exhausted_friendly_unit_enters_inspect_not_unit_selected', () => {
    const h = buildHarness()
    const result = clickAt(h.machine, { col: 5, row: 1 }, h.view)
    expect(result).toEqual({ ok: true })
    expect(h.machine.getState()).toEqual({
      status: 'Inspect',
      unitId: 'hero-exhausted',
      team: 'hero',
      returnTo: { status: 'Idle' },
    })
    expect(h.events).toHaveLength(0)
  })

  it('test_idle_click_enemy_unit_enters_inspect', () => {
    const h = buildHarness()
    const result = clickAt(h.machine, { col: 2, row: 4 }, h.view)
    expect(result).toEqual({ ok: true })
    expect(h.machine.getState()).toEqual({
      status: 'Inspect',
      unitId: 'enemy-1',
      team: 'enemy',
      returnTo: { status: 'Idle' },
    })
  })

  it('test_idle_escape_is_a_noop_reserved_for_the_pause_menu_hook', () => {
    const h = buildHarness()
    const result = h.machine.escape()
    expect(result).toEqual({ ok: true })
    expect(h.machine.getState()).toEqual({ status: 'Idle' })
  })
})

// ── UnitSelected ────────────────────────────────────────────────────────

describe('input-selection: selection state machine — UnitSelected', () => {
  it('test_unit_selected_click_same_unit_deselects_to_idle_and_emits_cancel', () => {
    const h = buildHarness()
    clickAt(h.machine, { col: 1, row: 1 }, h.view)
    h.events.length = 0

    const result = clickAt(h.machine, { col: 1, row: 1 }, h.view)
    expect(result).toEqual({ ok: true })
    expect(h.machine.getState()).toEqual({ status: 'Idle' })
    expect(h.events).toEqual([{ type: 'cancel', unitId: 'hero-1' }])
  })

  it('test_unit_selected_click_different_eligible_friendly_switches_immediately_and_emits_select', () => {
    const h = buildHarness()
    clickAt(h.machine, { col: 1, row: 1 }, h.view)
    h.events.length = 0

    const result = clickAt(h.machine, { col: 3, row: 1 }, h.view)
    expect(result).toEqual({ ok: true })
    expect(h.machine.getState()).toEqual({ status: 'UnitSelected', unitId: 'hero-2' })
    expect(h.events).toEqual([{ type: 'select', unitId: 'hero-2' }])
  })

  it('test_unit_selected_click_exhausted_friendly_enters_inspect_with_return_to_unit_selected', () => {
    const h = buildHarness()
    clickAt(h.machine, { col: 1, row: 1 }, h.view)

    const result = clickAt(h.machine, { col: 5, row: 1 }, h.view)
    expect(result).toEqual({ ok: true })
    expect(h.machine.getState()).toEqual({
      status: 'Inspect',
      unitId: 'hero-exhausted',
      team: 'hero',
      returnTo: { status: 'UnitSelected', unitId: 'hero-1' },
    })
  })

  it('test_unit_selected_click_enemy_enters_inspect_with_return_to_unit_selected', () => {
    const h = buildHarness()
    clickAt(h.machine, { col: 1, row: 1 }, h.view)

    const result = clickAt(h.machine, { col: 2, row: 4 }, h.view)
    expect(result).toEqual({ ok: true })
    expect(h.machine.getState()).toEqual({
      status: 'Inspect',
      unitId: 'enemy-1',
      team: 'enemy',
      returnTo: { status: 'UnitSelected', unitId: 'hero-1' },
    })
  })

  it('test_unit_selected_click_empty_tile_deselects_to_idle', () => {
    const h = buildHarness()
    clickAt(h.machine, { col: 1, row: 1 }, h.view)
    h.events.length = 0

    const result = clickAt(h.machine, { col: 0, row: 0 }, h.view)
    expect(result).toEqual({ ok: true })
    expect(h.machine.getState()).toEqual({ status: 'Idle' })
    expect(h.events).toEqual([{ type: 'cancel', unitId: 'hero-1' }])
  })

  it('test_unit_selected_click_off_board_deselects_to_idle', () => {
    const h = buildHarness()
    clickAt(h.machine, { col: 1, row: 1 }, h.view)
    h.events.length = 0

    const result = clickOffBoard(h.machine)
    expect(result).toEqual({ ok: true })
    expect(h.machine.getState()).toEqual({ status: 'Idle' })
    expect(h.events).toEqual([{ type: 'cancel', unitId: 'hero-1' }])
  })

  it('test_unit_selected_escape_deselects_to_idle_and_emits_cancel', () => {
    const h = buildHarness()
    clickAt(h.machine, { col: 1, row: 1 }, h.view)
    h.events.length = 0

    const result = h.machine.escape()
    expect(result).toEqual({ ok: true })
    expect(h.machine.getState()).toEqual({ status: 'Idle' })
    expect(h.events).toEqual([{ type: 'cancel', unitId: 'hero-1' }])
  })

  it('test_unit_selected_choose_mode_enters_targeting', () => {
    const h = buildHarness()
    clickAt(h.machine, { col: 1, row: 1 }, h.view)

    const result = h.machine.chooseMode(MOVE)
    expect(result).toEqual({ ok: true })
    expect(h.machine.getState()).toEqual({ status: 'Targeting', unitId: 'hero-1', mode: MOVE, armedTarget: null })
  })

  it('test_choose_mode_rejects_wrong_state_when_nothing_is_selected', () => {
    const h = buildHarness()
    const result = h.machine.chooseMode(MOVE)
    expect(result).toEqual({ ok: false, reason: 'WrongState' })
    expect(h.machine.getState()).toEqual({ status: 'Idle' })
  })

  it('test_choose_mode_rejects_not_acting_eligible_when_the_unit_exhausts_after_selection', () => {
    const h = buildHarness()
    clickAt(h.machine, { col: 1, row: 1 }, h.view)
    h.units.setActingEligible('hero-1', false)

    const result = h.machine.chooseMode(MOVE)
    expect(result).toEqual({ ok: false, reason: 'NotActingEligible' })
    expect(h.machine.getState()).toEqual({ status: 'UnitSelected', unitId: 'hero-1' })
  })

  it('test_choose_mode_rejects_no_selection_when_the_selected_unit_was_removed', () => {
    const h = buildHarness()
    clickAt(h.machine, { col: 1, row: 1 }, h.view)
    h.units.remove('hero-1')

    const result = h.machine.chooseMode(MOVE)
    expect(result).toEqual({ ok: false, reason: 'NoSelection' })
  })
})

// ── Targeting ───────────────────────────────────────────────────────────

describe('input-selection: selection state machine — Targeting', () => {
  it('test_targeting_hover_emits_hover_event_tagged_with_mode', () => {
    const h = buildHarness({ legalTiles: new Set(['2,2']) })
    clickAt(h.machine, { col: 1, row: 1 }, h.view)
    h.machine.chooseMode(MOVE)
    h.events.length = 0

    h.machine.hoverTile({ col: 2, row: 2 })
    expect(h.events).toEqual([{ type: 'hover', unitId: 'hero-1', mode: MOVE, tile: { col: 2, row: 2 } }])
    expect(h.machine.getHoveredTile()).toEqual({ col: 2, row: 2 })
  })

  it('test_targeting_click_illegal_target_rejects_and_state_is_untouched', () => {
    const h = buildHarness({ legalTiles: new Set(['2,2']) })
    clickAt(h.machine, { col: 1, row: 1 }, h.view)
    h.machine.chooseMode(MOVE)
    h.events.length = 0

    const result = clickAt(h.machine, { col: 6, row: 6 }, h.view) // empty tile, not in legalTiles
    expect(result).toEqual({ ok: false, reason: 'IllegalTarget' })
    expect(h.machine.getState()).toEqual({ status: 'Targeting', unitId: 'hero-1', mode: MOVE, armedTarget: null })
    expect(h.events).toHaveLength(0)
    expect(h.committer.calls).toHaveLength(0)
  })

  it('test_targeting_click_legal_target_default_config_commits_immediately_emits_confirm_and_locks', () => {
    const h = buildHarness({ legalTiles: new Set(['2,2']) })
    clickAt(h.machine, { col: 1, row: 1 }, h.view)
    h.machine.chooseMode(MOVE)
    h.events.length = 0

    const result = clickAt(h.machine, { col: 2, row: 2 }, h.view)
    expect(result).toEqual({ ok: true })
    expect(h.machine.getState()).toEqual({ status: 'Locked' })
    expect(h.events).toEqual([{ type: 'confirm', unitId: 'hero-1', mode: MOVE, target: { col: 2, row: 2 } }])
    expect(h.committer.calls).toEqual([{ unitId: 'hero-1', mode: MOVE, target: { col: 2, row: 2 } }])
  })

  it('test_targeting_commit_with_actions_remaining_returns_to_unit_selected_once_locked_gate_clears', () => {
    const h = buildHarness({
      legalTiles: new Set(['2,2']),
      commitOutcome: { committed: true, unitHasActionsRemaining: true },
    })
    clickAt(h.machine, { col: 1, row: 1 }, h.view)
    h.machine.chooseMode(MOVE)
    clickAt(h.machine, { col: 2, row: 2 }, h.view)
    expect(h.machine.getState()).toEqual({ status: 'Locked' })

    h.animating.value = true // Presentation's animation batch is still playing
    h.machine.syncLockGate()
    expect(h.machine.getState()).toEqual({ status: 'Locked' }) // still locked — isAnimating() gate

    h.animating.value = false
    h.machine.syncLockGate()
    expect(h.machine.getState()).toEqual({ status: 'UnitSelected', unitId: 'hero-1' })
  })

  it('test_targeting_commit_with_no_actions_remaining_returns_to_idle_once_locked_gate_clears', () => {
    const h = buildHarness({
      legalTiles: new Set(['2,2']),
      commitOutcome: { committed: true, unitHasActionsRemaining: false },
    })
    clickAt(h.machine, { col: 1, row: 1 }, h.view)
    h.machine.chooseMode(MOVE)
    clickAt(h.machine, { col: 2, row: 2 }, h.view)
    expect(h.machine.getState()).toEqual({ status: 'Locked' })

    h.machine.syncLockGate() // isAnimating() already false, phase already PlayerPhase
    expect(h.machine.getState()).toEqual({ status: 'Idle' })
  })

  it('test_targeting_escape_returns_to_unit_selected_with_no_board_mutation', () => {
    const h = buildHarness({ legalTiles: new Set(['2,2']) })
    clickAt(h.machine, { col: 1, row: 1 }, h.view)
    h.machine.chooseMode(MOVE)
    h.events.length = 0

    const result = h.machine.escape()
    expect(result).toEqual({ ok: true })
    expect(h.machine.getState()).toEqual({ status: 'UnitSelected', unitId: 'hero-1' })
    expect(h.events).toEqual([{ type: 'cancel', unitId: 'hero-1' }])
    expect(h.committer.calls).toHaveLength(0)
  })

  it('test_targeting_click_off_board_cancels_to_unit_selected', () => {
    const h = buildHarness({ legalTiles: new Set(['2,2']) })
    clickAt(h.machine, { col: 1, row: 1 }, h.view)
    h.machine.chooseMode(MOVE)
    h.events.length = 0

    const result = clickOffBoard(h.machine)
    expect(result).toEqual({ ok: true })
    expect(h.machine.getState()).toEqual({ status: 'UnitSelected', unitId: 'hero-1' })
    expect(h.events).toEqual([{ type: 'cancel', unitId: 'hero-1' }])
  })

  it('test_targeting_click_different_eligible_friendly_switches_even_when_its_tile_is_an_illegal_target', () => {
    // hero-2's tile (3,1) is deliberately NOT in legalTiles, proving the
    // unit-switch rule (Core Rule 4) takes priority over target-legality.
    const h = buildHarness({ legalTiles: new Set(['2,2']) })
    clickAt(h.machine, { col: 1, row: 1 }, h.view)
    h.machine.chooseMode(MOVE)
    h.events.length = 0

    const result = clickAt(h.machine, { col: 3, row: 1 }, h.view)
    expect(result).toEqual({ ok: true })
    expect(h.machine.getState()).toEqual({ status: 'UnitSelected', unitId: 'hero-2' })
    expect(h.events).toEqual([{ type: 'select', unitId: 'hero-2' }])
    expect(h.committer.calls).toHaveLength(0)
  })

  it('test_targeting_commit_refused_by_committer_rejects_as_illegal_target_and_stays_targeting', () => {
    const h = buildHarness({ legalTiles: new Set(['2,2']), commitOutcome: { committed: false } })
    clickAt(h.machine, { col: 1, row: 1 }, h.view)
    h.machine.chooseMode(MOVE)
    h.events.length = 0

    const result = clickAt(h.machine, { col: 2, row: 2 }, h.view)
    expect(result).toEqual({ ok: false, reason: 'IllegalTarget' })
    expect(h.machine.getState()).toEqual({ status: 'Targeting', unitId: 'hero-1', mode: MOVE, armedTarget: null })
    // `confirm` is emitted optimistically before the committer's outcome is known
    // (judgement call — see the implementer's report).
    expect(h.events).toEqual([{ type: 'confirm', unitId: 'hero-1', mode: MOVE, target: { col: 2, row: 2 } }])
  })
})

// ── require_confirm_click (accessibility A6) ───────────────────────────

describe('input-selection: require_confirm_click — both modes', () => {
  it('test_require_confirm_click_false_a_single_click_on_a_legal_target_commits_immediately', () => {
    const h = buildHarness({ legalTiles: new Set(['2,2']), config: { requireConfirmClick: false } })
    clickAt(h.machine, { col: 1, row: 1 }, h.view)
    h.machine.chooseMode(MOVE)
    h.events.length = 0

    const result = clickAt(h.machine, { col: 2, row: 2 }, h.view)
    expect(result).toEqual({ ok: true })
    expect(h.machine.getState()).toEqual({ status: 'Locked' })
    expect(h.events).toEqual([{ type: 'confirm', unitId: 'hero-1', mode: MOVE, target: { col: 2, row: 2 } }])
    expect(h.committer.calls).toHaveLength(1)
  })

  it('test_require_confirm_click_true_first_click_on_a_legal_target_arms_it_without_committing', () => {
    const h = buildHarness({ legalTiles: new Set(['2,2']), config: { requireConfirmClick: true } })
    clickAt(h.machine, { col: 1, row: 1 }, h.view)
    h.machine.chooseMode(MOVE)
    h.events.length = 0

    const result = clickAt(h.machine, { col: 2, row: 2 }, h.view)
    expect(result).toEqual({ ok: true })
    expect(h.machine.getState()).toEqual({
      status: 'Targeting',
      unitId: 'hero-1',
      mode: MOVE,
      armedTarget: { col: 2, row: 2 },
    })
    expect(h.events).toHaveLength(0) // no `confirm` on the arming click
    expect(h.committer.calls).toHaveLength(0)
  })

  it('test_require_confirm_click_true_second_click_on_the_armed_tile_commits', () => {
    const h = buildHarness({ legalTiles: new Set(['2,2']), config: { requireConfirmClick: true } })
    clickAt(h.machine, { col: 1, row: 1 }, h.view)
    h.machine.chooseMode(MOVE)
    clickAt(h.machine, { col: 2, row: 2 }, h.view) // arm
    h.events.length = 0

    const result = clickAt(h.machine, { col: 2, row: 2 }, h.view) // confirm
    expect(result).toEqual({ ok: true })
    expect(h.machine.getState()).toEqual({ status: 'Locked' })
    expect(h.events).toEqual([{ type: 'confirm', unitId: 'hero-1', mode: MOVE, target: { col: 2, row: 2 } }])
    expect(h.committer.calls).toHaveLength(1)
  })

  it('test_require_confirm_click_true_clicking_a_different_legal_tile_rearms_instead_of_committing_the_first', () => {
    const h = buildHarness({ legalTiles: new Set(['2,2', '2,3']), config: { requireConfirmClick: true } })
    clickAt(h.machine, { col: 1, row: 1 }, h.view)
    h.machine.chooseMode(MOVE)
    clickAt(h.machine, { col: 2, row: 2 }, h.view) // arm tile A
    h.events.length = 0

    const result = clickAt(h.machine, { col: 2, row: 3 }, h.view) // different legal tile B
    expect(result).toEqual({ ok: true })
    expect(h.machine.getState()).toEqual({
      status: 'Targeting',
      unitId: 'hero-1',
      mode: MOVE,
      armedTarget: { col: 2, row: 3 },
    })
    expect(h.events).toHaveLength(0)
    expect(h.committer.calls).toHaveLength(0)
  })

  it('test_require_confirm_click_true_escape_cancels_and_discards_the_armed_target', () => {
    const h = buildHarness({ legalTiles: new Set(['2,2']), config: { requireConfirmClick: true } })
    clickAt(h.machine, { col: 1, row: 1 }, h.view)
    h.machine.chooseMode(MOVE)
    clickAt(h.machine, { col: 2, row: 2 }, h.view) // arm

    const result = h.machine.escape()
    expect(result).toEqual({ ok: true })
    expect(h.machine.getState()).toEqual({ status: 'UnitSelected', unitId: 'hero-1' })
    expect(h.committer.calls).toHaveLength(0)
  })
})

// ── Locked gate (Core Rule 8) and phase-driven clearing ────────────────

describe('input-selection: Locked gate and selection-cleared-on-phase-change', () => {
  it('test_pointer_up_rejected_locked_when_phase_is_not_player_phase', () => {
    const h = buildHarness()
    h.phase.value = 'Environment'

    const result = clickAt(h.machine, { col: 1, row: 1 }, h.view)
    expect(result).toEqual({ ok: false, reason: 'Locked' })
    expect(h.machine.getState()).toEqual({ status: 'Locked' })
  })

  it('test_pointer_up_rejected_locked_when_isAnimating_is_true', () => {
    const h = buildHarness()
    h.animating.value = true

    const result = clickAt(h.machine, { col: 1, row: 1 }, h.view)
    expect(result).toEqual({ ok: false, reason: 'Locked' })
    expect(h.machine.getState()).toEqual({ status: 'Locked' })
  })

  it('test_escape_rejected_locked_while_phase_is_not_player_phase', () => {
    const h = buildHarness()
    h.phase.value = 'Environment'

    const result = h.machine.escape()
    expect(result).toEqual({ ok: false, reason: 'Locked' })
  })

  it('test_choose_mode_rejected_locked_while_phase_is_not_player_phase', () => {
    const h = buildHarness()
    h.phase.value = 'Environment'

    const result = h.machine.chooseMode(MOVE)
    expect(result).toEqual({ ok: false, reason: 'Locked' })
  })

  it('test_unit_selected_selection_is_cleared_on_phase_change_and_not_restored_on_return', () => {
    const h = buildHarness()
    clickAt(h.machine, { col: 1, row: 1 }, h.view)
    expect(h.machine.getState()).toEqual({ status: 'UnitSelected', unitId: 'hero-1' })

    h.phase.value = 'Environment'
    h.machine.syncLockGate()
    expect(h.machine.getState()).toEqual({ status: 'Locked' })

    h.phase.value = 'PlayerPhase'
    h.machine.syncLockGate()
    // Cleared, not restored — a fresh phase-driven Locked (no pending commit
    // resolution behind it) always unlocks to Idle (judgement call — see report).
    expect(h.machine.getState()).toEqual({ status: 'Idle' })
  })

  it('test_targeting_selection_is_also_cleared_on_phase_change_and_not_restored_on_return', () => {
    const h = buildHarness({ legalTiles: new Set(['2,2']) })
    clickAt(h.machine, { col: 1, row: 1 }, h.view)
    h.machine.chooseMode(MOVE)
    expect(h.machine.getState().status).toBe('Targeting')

    h.phase.value = 'EnemyResolve'
    h.machine.syncLockGate()
    expect(h.machine.getState()).toEqual({ status: 'Locked' })

    h.phase.value = 'PlayerPhase'
    h.machine.syncLockGate()
    expect(h.machine.getState()).toEqual({ status: 'Idle' })
  })

  it('test_hover_emits_no_event_while_locked', () => {
    const h = buildHarness()
    h.phase.value = 'Environment'
    h.machine.syncLockGate()
    h.events.length = 0

    h.machine.hoverTile({ col: 3, row: 1 })
    expect(h.events).toHaveLength(0)
  })
})

// ── Click precision integration (Formula 3), config-injected, at and beyond threshold ──

describe('input-selection: click precision integration — config-injected, at and beyond threshold', () => {
  it('test_pointer_up_with_no_matching_pointer_down_is_rejected_as_invalid_click', () => {
    const h = buildHarness()
    const { px, py } = tileToScreenCenter(1, 1, h.view)

    const result = h.machine.pointerUp({ px, py }, 1000) // no prior pointerDown
    expect(result).toEqual({ ok: false, reason: 'InvalidClick' })
    expect(h.machine.getState()).toEqual({ status: 'Idle' })
  })

  it('test_drift_exactly_at_the_injected_tolerance_threshold_is_valid_and_selects_the_unit', () => {
    const h = buildHarness({ config: { clickTolerancePx: 6 } })
    const down = tileToScreenCenter(1, 1, h.view)
    h.machine.pointerDown({ px: down.px, py: down.py }, 0)

    const result = h.machine.pointerUp({ px: down.px + 6, py: down.py }, 100) // dist == 6, the configured tolerance
    expect(result).toEqual({ ok: true })
    expect(h.machine.getState()).toEqual({ status: 'UnitSelected', unitId: 'hero-1' })
  })

  it('test_drift_just_beyond_the_injected_tolerance_threshold_is_rejected_and_leaves_state_unchanged', () => {
    const h = buildHarness({ config: { clickTolerancePx: 6 } })
    const down = tileToScreenCenter(1, 1, h.view)
    h.machine.pointerDown({ px: down.px, py: down.py }, 0)

    const result = h.machine.pointerUp({ px: down.px + 6.01, py: down.py }, 100) // dist == 6.01
    expect(result).toEqual({ ok: false, reason: 'InvalidClick' })
    expect(h.machine.getState()).toEqual({ status: 'Idle' }) // no selection happened
  })

  it('test_hold_exactly_at_the_injected_max_hold_ms_is_valid', () => {
    const h = buildHarness({ config: { maxClickHoldMs: 600 } })
    const down = tileToScreenCenter(1, 1, h.view)
    h.machine.pointerDown({ px: down.px, py: down.py }, 1000)

    const result = h.machine.pointerUp({ px: down.px, py: down.py }, 1600) // held exactly 600ms
    expect(result).toEqual({ ok: true })
    expect(h.machine.getState()).toEqual({ status: 'UnitSelected', unitId: 'hero-1' })
  })

  it('test_hold_just_beyond_the_injected_max_hold_ms_is_rejected', () => {
    const h = buildHarness({ config: { maxClickHoldMs: 600 } })
    const down = tileToScreenCenter(1, 1, h.view)
    h.machine.pointerDown({ px: down.px, py: down.py }, 1000)

    const result = h.machine.pointerUp({ px: down.px, py: down.py }, 1601) // held 601ms
    expect(result).toEqual({ ok: false, reason: 'InvalidClick' })
    expect(h.machine.getState()).toEqual({ status: 'Idle' })
  })

  it('test_identical_pixel_drift_is_valid_under_a_lenient_injected_tolerance_and_invalid_under_a_strict_one', () => {
    // Proves click_tolerance_px flows through as real injected SelectionConfig
    // data (accessibility A13), not a literal compiled into the machine.
    const strict = buildHarness({ config: { clickTolerancePx: 2 } })
    const lenient = buildHarness({ config: { clickTolerancePx: 15 } })

    const strictDown = tileToScreenCenter(1, 1, strict.view)
    strict.machine.pointerDown({ px: strictDown.px, py: strictDown.py }, 0)
    const strictResult = strict.machine.pointerUp({ px: strictDown.px + 4, py: strictDown.py }, 100)

    const lenientDown = tileToScreenCenter(1, 1, lenient.view)
    lenient.machine.pointerDown({ px: lenientDown.px, py: lenientDown.py }, 0)
    const lenientResult = lenient.machine.pointerUp({ px: lenientDown.px + 4, py: lenientDown.py }, 100)

    expect(strictResult).toEqual({ ok: false, reason: 'InvalidClick' }) // 4px > 2px tolerance
    expect(lenientResult).toEqual({ ok: true }) // 4px <= 15px tolerance
    expect(lenient.machine.getState()).toEqual({ status: 'UnitSelected', unitId: 'hero-1' })
  })

  it('test_constructing_with_a_non_positive_click_tolerance_throws_selection_invariant_error', () => {
    expect(() => buildHarness({ config: { clickTolerancePx: 0 } })).toThrow(SelectionInvariantError)
  })

  it('test_constructing_with_a_non_positive_max_hold_ms_throws_selection_invariant_error', () => {
    expect(() => buildHarness({ config: { maxClickHoldMs: -1 } })).toThrow(SelectionInvariantError)
  })
})

// ── Inspect overlay exit (judgement call — see report) ─────────────────

describe('input-selection: Inspect overlay exit', () => {
  it('test_inspect_from_idle_escape_returns_to_idle', () => {
    const h = buildHarness()
    clickAt(h.machine, { col: 2, row: 4 }, h.view) // enemy -> Inspect(returnTo: Idle)
    expect(h.machine.getState().status).toBe('Inspect')

    const result = h.machine.escape()
    expect(result).toEqual({ ok: true })
    expect(h.machine.getState()).toEqual({ status: 'Idle' })
  })

  it('test_inspect_from_unit_selected_escape_returns_to_unit_selected', () => {
    const h = buildHarness()
    clickAt(h.machine, { col: 1, row: 1 }, h.view) // select hero-1
    clickAt(h.machine, { col: 2, row: 4 }, h.view) // inspect enemy while selected
    expect(h.machine.getState()).toEqual({
      status: 'Inspect',
      unitId: 'enemy-1',
      team: 'enemy',
      returnTo: { status: 'UnitSelected', unitId: 'hero-1' },
    })

    const result = h.machine.escape()
    expect(result).toEqual({ ok: true })
    expect(h.machine.getState()).toEqual({ status: 'UnitSelected', unitId: 'hero-1' })
  })

  it('test_inspect_click_on_a_selectable_unit_resolves_against_the_return_to_state', () => {
    const h = buildHarness()
    clickAt(h.machine, { col: 2, row: 4 }, h.view) // Inspect(returnTo: Idle)
    h.events.length = 0

    const result = clickAt(h.machine, { col: 1, row: 1 }, h.view) // click hero-1 while inspecting
    expect(result).toEqual({ ok: true })
    expect(h.machine.getState()).toEqual({ status: 'UnitSelected', unitId: 'hero-1' })
    expect(h.events).toEqual([{ type: 'select', unitId: 'hero-1' }])
  })
})
