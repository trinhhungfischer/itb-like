// Move Preview — Story 002: Preview Event Subscription & Lifecycle
//
// Implements: production/epics/move-preview/story-002-preview-lifecycle.md
// GDD: design/gdd/move-preview.md "States and Transitions", Rules 1, 4-7, 10,
//      11; Edge Cases (illegal hover, phase gating, board changes mid-Ready).
// Governing ADR: adr-0002-deterministic-event-bus.md (silent subscription).
//
// SCOPE NOTE (story-002's own Test Evidence path vs. this implementer's
// exclusive scope): story-002.md names
// `tests/integration/move-preview/preview-lifecycle_test.ts` as required
// evidence. This implementer's task scope is restricted to
// `tests/unit/move-preview/**` only — this file satisfies story-002's
// evidence requirement at that path instead. Flagged in this implementer's
// report as a likely instance of the "wrong test-evidence path" defect
// class already found elsewhere this sprint.
//
// Two layers of proof, matching move-preview.ts's own class doc comment:
//  1. The pure `transitionPreviewState` table (preview-lifecycle.ts),
//     exercised directly and exhaustively — every row of the GDD's States
//     and Transitions table, including the momentary Stale/Committed states
//     no live MovePreview instance ever exposes externally (see (2)).
//  2. The `MovePreview` class's externally observable behavior when driven
//     through Input & Selection's real event vocabulary.
//
// Naming: [system]_[feature]_test.ts / test_[scenario]_[expected].
// Deterministic: no RNG, no wall clock.

import { describe, it, expect } from 'vitest'
import { makeBoard } from '../../../src/core/board/index.js'
import type { Board, Tile, UnitId } from '../../../src/core/board/index.js'
import { EventBus } from '../../../src/core/events/event-bus.js'
import { CombatState } from '../../../src/core/combat/index.js'
import type { EffectPrimitive } from '../../../src/core/combat/index.js'
import type { SelectionEventMap } from '../../../src/core/input/selection-events.js'
import type { ActionMode } from '../../../src/core/input/selection-types.js'
import { MovePreview } from '../../../src/core/preview/move-preview.js'
import type { EffectCompiler } from '../../../src/core/preview/preview-ports.js'
import { transitionPreviewState } from '../../../src/core/preview/preview-lifecycle.js'
import type { Phase } from '../../../src/core/turn/turn-phase-types.js'

// ── Layer 1: the pure transition table, row by row ─────────────────────────

describe('move-preview: transitionPreviewState — the GDD States and Transitions table', () => {
  it('test_idle_candidate_formed_becomes_computing', () => {
    expect(transitionPreviewState('Idle', { type: 'candidate_formed' })).toBe('Computing')
  })

  it('test_computing_compute_succeeded_becomes_ready', () => {
    expect(transitionPreviewState('Computing', { type: 'compute_succeeded' })).toBe('Ready')
  })

  it('test_computing_compute_failed_becomes_idle', () => {
    // Judgement call (preview-lifecycle.ts doc comment): the GDD table names
    // no explicit failure exit for Computing. Idle is the state whose
    // meaning ("nothing to preview") satisfies Rule 10's "never Ready-
    // looking" requirement.
    expect(transitionPreviewState('Computing', { type: 'compute_failed' })).toBe('Idle')
  })

  it('test_ready_candidate_changed_becomes_stale', () => {
    expect(transitionPreviewState('Ready', { type: 'candidate_changed' })).toBe('Stale')
  })

  it('test_ready_board_mutated_becomes_stale', () => {
    expect(transitionPreviewState('Ready', { type: 'board_mutated' })).toBe('Stale')
  })

  it('test_stale_recompute_started_becomes_computing', () => {
    expect(transitionPreviewState('Stale', { type: 'recompute_started' })).toBe('Computing')
  })

  it('test_stale_candidate_changed_stays_stale', () => {
    expect(transitionPreviewState('Stale', { type: 'candidate_changed' })).toBe('Stale')
  })

  it('test_ready_cancelled_becomes_discarded', () => {
    expect(transitionPreviewState('Ready', { type: 'cancelled' })).toBe('Discarded')
  })

  it('test_stale_cancelled_becomes_discarded', () => {
    expect(transitionPreviewState('Stale', { type: 'cancelled' })).toBe('Discarded')
  })

  it('test_computing_cancelled_becomes_discarded', () => {
    expect(transitionPreviewState('Computing', { type: 'cancelled' })).toBe('Discarded')
  })

  it('test_discarded_settled_becomes_idle', () => {
    expect(transitionPreviewState('Discarded', { type: 'settled' })).toBe('Idle')
  })

  it('test_ready_confirmed_becomes_committed', () => {
    expect(transitionPreviewState('Ready', { type: 'confirmed' })).toBe('Committed')
  })

  it('test_committed_settled_becomes_idle', () => {
    expect(transitionPreviewState('Committed', { type: 'settled' })).toBe('Idle')
  })

  it('test_inapplicable_events_are_defensive_no_ops', () => {
    // Every (state, event) pair the table does not name leaves state
    // unchanged rather than throwing — the machine has no Channel-2
    // invariant of its own.
    expect(transitionPreviewState('Idle', { type: 'confirmed' })).toBe('Idle')
    expect(transitionPreviewState('Idle', { type: 'cancelled' })).toBe('Idle')
    expect(transitionPreviewState('Idle', { type: 'compute_succeeded' })).toBe('Idle')
    expect(transitionPreviewState('Ready', { type: 'candidate_formed' })).toBe('Ready')
    expect(transitionPreviewState('Ready', { type: 'settled' })).toBe('Ready')
    expect(transitionPreviewState('Discarded', { type: 'cancelled' })).toBe('Discarded')
    expect(transitionPreviewState('Committed', { type: 'confirmed' })).toBe('Committed')
  })
})

// ── Layer 2: MovePreview driven through the real event vocabulary ──────────

function makeEffectCompiler(
  fn: (unitId: UnitId, mode: ActionMode, target: Tile, board: Board) => readonly EffectPrimitive[] | null,
): EffectCompiler {
  return { compileEffects: fn }
}

/** A push toward `target` (matches whichever side of the unit `target` is on) — good enough to produce a distinct, legal candidate per target tile. */
function pushCompiler(): EffectCompiler {
  return makeEffectCompiler((unitId, _mode, target) => [
    { kind: 'push', targetId: unitId, direction: target.col >= 1 ? 'E' : 'W', distance: 1 },
  ])
}

function makeScenario(overrides?: { compiler?: EffectCompiler; phase?: () => Phase | null }) {
  const board = makeBoard()
  const state = CombatState.empty()
  board.place({ col: 1, row: 1 }, 'hero-1')
  state.registerUnit('hero-1', 10)

  const selectionBus = new EventBus<SelectionEventMap>()
  const effectCompiler = overrides?.compiler ?? pushCompiler()
  const getCurrentPhase = overrides?.phase ?? ((): Phase | null => 'PlayerPhase')
  const preview = new MovePreview({ board, state, selectionBus, effectCompiler, getCurrentPhase })

  return { board, state, selectionBus, preview }
}

describe('move-preview: MovePreview — subscription-driven lifecycle', () => {
  it('test_a_legal_hover_reaches_ready', () => {
    const { selectionBus, preview } = makeScenario()

    selectionBus.emit({ type: 'hover', unitId: 'hero-1', mode: { kind: 'Move' }, tile: { col: 2, row: 1 } })

    expect(preview.getLifecycleState()).toBe('Ready')
    expect(preview.isReady()).toBe(true)
    expect(preview.getResult()).not.toBeNull()
  })

  it('test_an_illegal_hover_target_never_enters_computing_or_ready', () => {
    const { selectionBus, preview } = makeScenario({ compiler: makeEffectCompiler(() => null) })

    selectionBus.emit({ type: 'hover', unitId: 'hero-1', mode: { kind: 'Move' }, tile: { col: 6, row: 6 } })

    expect(preview.getLifecycleState()).toBe('Idle')
    expect(preview.getResult()).toBeNull()
  })

  it('test_an_illegal_hover_leaves_an_existing_ready_preview_completely_undisturbed', () => {
    let legal = true
    const { selectionBus, preview } = makeScenario({
      compiler: makeEffectCompiler((unitId, _mode, _target) =>
        legal ? [{ kind: 'push', targetId: unitId, direction: 'E', distance: 1 }] : null,
      ),
    })

    selectionBus.emit({ type: 'hover', unitId: 'hero-1', mode: { kind: 'Move' }, tile: { col: 2, row: 1 } })
    const readyResult = preview.getResult()
    expect(preview.getLifecycleState()).toBe('Ready')

    legal = false
    selectionBus.emit({ type: 'hover', unitId: 'hero-1', mode: { kind: 'Move' }, tile: { col: 6, row: 6 } })

    expect(preview.getLifecycleState()).toBe('Ready')
    expect(preview.getResult()).toBe(readyResult) // same object — untouched, not merely equal
  })

  it('test_hovering_the_same_candidate_again_does_not_trigger_a_redundant_recompute', () => {
    const { selectionBus, preview } = makeScenario()

    selectionBus.emit({ type: 'hover', unitId: 'hero-1', mode: { kind: 'Move' }, tile: { col: 2, row: 1 } })
    const first = preview.getResult()

    selectionBus.emit({ type: 'hover', unitId: 'hero-1', mode: { kind: 'Move' }, tile: { col: 2, row: 1 } })
    const second = preview.getResult()

    expect(second).toBe(first) // same PreviewResult instance — resolve() was not re-run
  })

  it('test_hovering_a_different_target_while_ready_replaces_the_preview_with_a_fresh_one', () => {
    const { selectionBus, preview } = makeScenario()

    selectionBus.emit({ type: 'hover', unitId: 'hero-1', mode: { kind: 'Move' }, tile: { col: 2, row: 1 } })
    const first = preview.getResult()

    selectionBus.emit({ type: 'hover', unitId: 'hero-1', mode: { kind: 'Move' }, tile: { col: 3, row: 1 } })
    const second = preview.getResult()

    expect(preview.getLifecycleState()).toBe('Ready')
    expect(second).not.toBe(first)
    expect(second?.candidate.target).toEqual({ col: 3, row: 1 })
  })

  it('test_a_stale_preview_is_never_presented_as_current', () => {
    // Rule 4: "A stale preview must never remain visibly displayed as
    // current." Every externally observable read of getLifecycleState()
    // after a mutating call must be Ready (fresh) or Idle — never Stale.
    const { board, selectionBus, preview } = makeScenario()

    selectionBus.emit({ type: 'hover', unitId: 'hero-1', mode: { kind: 'Move' }, tile: { col: 2, row: 1 } })
    expect(preview.getLifecycleState()).toBe('Ready')

    // Board mutates out from under the Ready preview via a source outside
    // Move Preview's own hover/select/cancel/confirm subscription (see
    // move-preview.ts's "board-mutation-without-a-new-hover gap" doc
    // comment) — block the tile the previous push target and re-notify.
    board.clear({ col: 1, row: 1 })
    board.place({ col: 1, row: 1 }, 'hero-1')
    preview.notifyLiveBoardMutated()

    expect(preview.getLifecycleState()).not.toBe('Stale')
    expect(['Ready', 'Idle']).toContain(preview.getLifecycleState())
  })

  it('test_notify_live_board_mutated_recomputes_the_ready_preview_against_the_new_board_state', () => {
    const board = makeBoard()
    const state = CombatState.empty()
    board.place({ col: 1, row: 1 }, 'hero-1')
    state.registerUnit('hero-1', 10)

    const selectionBus = new EventBus<SelectionEventMap>()
    // A candidate that pushes hero-1 East as far as possible; the recompute
    // must reflect a wall placed AFTER the initial Ready computation.
    const effectCompiler = makeEffectCompiler((unitId) => [
      { kind: 'push', targetId: unitId, direction: 'E', distance: 5 },
    ])
    const preview = new MovePreview({
      board,
      state,
      selectionBus,
      effectCompiler,
      getCurrentPhase: () => 'PlayerPhase',
    })

    selectionBus.emit({ type: 'hover', unitId: 'hero-1', mode: { kind: 'Move' }, tile: { col: 6, row: 1 } })
    const before = preview.getResult()
    expect(before?.events.some((e) => e.type === 'displacement_complete')).toBe(true)

    // Out-of-band board mutation: a wall appears two tiles east of hero-1.
    board.setTerrain({ col: 3, row: 1 }, 2 /* BlockedDestructible */)
    preview.notifyLiveBoardMutated()

    const after = preview.getResult()
    expect(after).not.toBe(before)
    expect(after?.events.some((e) => e.type === 'collision_resolved')).toBe(true)
  })

  it('test_select_discards_the_current_preview_with_zero_board_effect', () => {
    const { board, selectionBus, preview } = makeScenario()
    const before = fingerprint(board)

    selectionBus.emit({ type: 'hover', unitId: 'hero-1', mode: { kind: 'Move' }, tile: { col: 2, row: 1 } })
    expect(preview.getLifecycleState()).toBe('Ready')

    selectionBus.emit({ type: 'select', unitId: 'hero-2' })

    expect(preview.getLifecycleState()).toBe('Idle')
    expect(preview.getResult()).toBeNull()
    expect(fingerprint(board)).toBe(before)
  })

  it('test_cancel_discards_the_current_preview_with_zero_board_effect', () => {
    const { board, selectionBus, preview } = makeScenario()
    const before = fingerprint(board)

    selectionBus.emit({ type: 'hover', unitId: 'hero-1', mode: { kind: 'Move' }, tile: { col: 2, row: 1 } })
    expect(preview.getLifecycleState()).toBe('Ready')

    selectionBus.emit({ type: 'cancel', unitId: 'hero-1' })

    expect(preview.getLifecycleState()).toBe('Idle')
    expect(preview.getResult()).toBeNull()
    expect(fingerprint(board)).toBe(before)
  })

  it('test_confirm_while_ready_clears_move_previews_own_state_to_idle', () => {
    const { board, selectionBus, preview } = makeScenario()
    const before = fingerprint(board)

    selectionBus.emit({ type: 'hover', unitId: 'hero-1', mode: { kind: 'Move' }, tile: { col: 2, row: 1 } })
    expect(preview.getLifecycleState()).toBe('Ready')

    selectionBus.emit({ type: 'confirm', unitId: 'hero-1', mode: { kind: 'Move' }, target: { col: 2, row: 1 } })

    expect(preview.getLifecycleState()).toBe('Idle')
    expect(preview.getResult()).toBeNull()
    // Move Preview itself never mutates the board on confirm (Rule 7 — the
    // real commit is Turn & Phase Manager's job, not this class's).
    expect(fingerprint(board)).toBe(before)
  })

  it('test_confirm_while_not_ready_is_a_defensive_no_op', () => {
    const { preview, selectionBus } = makeScenario()
    expect(preview.getLifecycleState()).toBe('Idle')

    selectionBus.emit({ type: 'confirm', unitId: 'hero-1', mode: { kind: 'Move' }, target: { col: 2, row: 1 } })

    expect(preview.getLifecycleState()).toBe('Idle')
  })

  it('test_hover_outside_player_phase_computes_nothing_and_remains_idle', () => {
    // Rule 11 / defensive Edge Case.
    const { preview, selectionBus } = makeScenario({ phase: () => 'Environment' })

    selectionBus.emit({ type: 'hover', unitId: 'hero-1', mode: { kind: 'Move' }, tile: { col: 2, row: 1 } })

    expect(preview.getLifecycleState()).toBe('Idle')
    expect(preview.getResult()).toBeNull()
  })

  it('test_hover_after_the_phase_gate_trips_force_clears_an_existing_ready_preview', () => {
    let phase: Phase | null = 'PlayerPhase'
    const { preview, selectionBus } = makeScenario({ phase: () => phase })

    selectionBus.emit({ type: 'hover', unitId: 'hero-1', mode: { kind: 'Move' }, tile: { col: 2, row: 1 } })
    expect(preview.getLifecycleState()).toBe('Ready')

    phase = 'EnemyResolve'
    selectionBus.emit({ type: 'hover', unitId: 'hero-1', mode: { kind: 'Move' }, tile: { col: 3, row: 1 } })

    expect(preview.getLifecycleState()).toBe('Idle')
    expect(preview.getResult()).toBeNull()
  })

  it('test_a_dry_run_that_throws_is_a_fail_safe_not_a_ready_preview', () => {
    // Rule 10: preview computation cannot complete (an implementation fault,
    // simulated here via an effect list Combat Resolution's own Channel-2
    // validation rejects: a negative damage amount, which resolve() throws
    // an InvariantError for — see combat-resolve.ts's validateEffects).
    const { preview, selectionBus } = makeScenario({
      compiler: makeEffectCompiler((unitId) => [{ kind: 'damage', targetId: unitId, amount: -1 }]),
    })

    expect(() =>
      selectionBus.emit({ type: 'hover', unitId: 'hero-1', mode: { kind: 'Move' }, tile: { col: 2, row: 1 } }),
    ).not.toThrow()

    expect(preview.getLifecycleState()).toBe('Idle')
    expect(preview.isReady()).toBe(false)
    expect(preview.getResult()).toBeNull()
  })
})

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
