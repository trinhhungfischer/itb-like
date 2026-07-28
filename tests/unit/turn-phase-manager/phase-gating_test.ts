/**
 * Turn & Phase Manager — phase gating and the `applyAction` return contract.
 *
 * WHY THIS FILE EXISTS: a testability review (2026-07-28) found that
 * `NotPlayerPhase` appeared in **zero** tests, despite guarding both
 * `applyAction()` and `endPlayerPhase()`. Verified empirically by deleting both
 * guards and re-running the suite: **285/285 still passed.** GDD Core Rule 3
 * ("input is only live during Player Phase") could have been removed wholesale
 * without a single test noticing.
 *
 * The same review found `getPlayerPhaseSnapshotCount()` had no test in its own
 * module — it was covered only incidentally by `tests/unit/move-preview/`,
 * asserting a different module's guarantee — and that `applyAction()`'s
 * returned `.events` were never asserted anywhere, so returning `[]` instead of
 * Combat's real output would also have gone unnoticed.
 *
 * These are the regression tests for all three.
 */

import { describe, it, expect } from 'vitest'

import { makeManager, makeScriptedObjective } from './fakes.js'
import type { EffectPrimitive } from '../../../src/core/turn/index.js'

const NO_EFFECTS: readonly EffectPrimitive[] = []

describe('TurnPhaseManager: Player-Phase gating (GDD Core Rule 3)', () => {
  it('test_apply_action_before_battle_start_is_rejected_with_not_player_phase', () => {
    // Arrange — battle not started, so phase is null, not PlayerPhase.
    const { manager } = makeManager()

    // Act
    const result = manager.applyAction(NO_EFFECTS)

    // Assert — the exact reject shape, not merely "not ok".
    expect(result).toEqual({ ok: false, reason: 'NotPlayerPhase' })
  })

  it('test_apply_action_after_battle_ended_is_rejected_with_not_player_phase', () => {
    // Arrange — defeat at the first early check ends the battle immediately.
    const objective = makeScriptedObjective((callIndex) => (callIndex === 0 ? 'defeat' : 'ongoing'))
    const { manager } = makeManager({ objective })
    manager.startBattle()
    manager.endPlayerPhase()
    expect(manager.getBattleState()).toBe('Ended')

    // Act
    const result = manager.applyAction(NO_EFFECTS)

    // Assert
    expect(result).toEqual({ ok: false, reason: 'NotPlayerPhase' })
  })

  it('test_apply_action_is_rejected_and_mutates_nothing_outside_player_phase', () => {
    // A rejection must be inert — Combat is never invoked, so the board and the
    // undo seam are both untouched.
    const { manager, board } = makeManager()
    const before = board.getTile(0, 0)

    const result = manager.applyAction(NO_EFFECTS)

    expect(result.ok).toBe(false)
    expect(board.getTile(0, 0)).toEqual(before)
    expect(manager.getPlayerPhaseSnapshotCount()).toBe(0)
  })

  it('test_end_player_phase_before_battle_start_is_rejected_with_not_player_phase', () => {
    const { manager } = makeManager()

    const result = manager.endPlayerPhase()

    expect(result).toEqual({ ok: false, reason: 'NotPlayerPhase' })
  })

  it('test_end_player_phase_twice_in_a_row_rejects_the_second_call', () => {
    // The first call commits and runs the system phases, landing back in a NEW
    // Player Phase — so the guard only bites when the phase genuinely is not
    // PlayerPhase. This pins that the guard reads live phase state rather than
    // a stale flag.
    const objective = makeScriptedObjective((callIndex) => (callIndex === 0 ? 'defeat' : 'ongoing'))
    const { manager } = makeManager({ objective })
    manager.startBattle()

    const first = manager.endPlayerPhase()
    const second = manager.endPlayerPhase()

    expect(first).toEqual({ ok: true })
    expect(second).toEqual({ ok: false, reason: 'NotPlayerPhase' })
  })

  it('test_apply_action_during_player_phase_is_accepted', () => {
    // The positive case, so the tests above cannot pass by rejecting everything.
    const { manager } = makeManager()
    manager.startBattle()

    const result = manager.applyAction(NO_EFFECTS)

    expect(result.ok).toBe(true)
  })
})

describe('TurnPhaseManager: applyAction return contract', () => {
  it('test_apply_action_returns_combat_resolutions_events_unchanged', () => {
    // Regression guard: returning `events: []` instead of Combat's real output
    // previously passed every test in the suite, silently breaking the
    // documented contract that success "carries the events Combat Resolution
    // returned, for the caller's own bookkeeping".
    //
    // Asserts exact pass-through, not merely a non-empty array — swapping the
    // events for a different non-empty array would otherwise still pass.
    const emitted = [
      { type: 'damage_applied' as const },
      { type: 'unit_removed' as const },
    ]
    const { manager } = makeManager({
      combat: { resolve: () => emitted },
    })
    manager.startBattle()

    const result = manager.applyAction(NO_EFFECTS)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable — narrowed above')
    expect(result.events).toEqual(emitted)
  })
})

describe('TurnPhaseManager: undo-seam snapshot bookkeeping (GDD Formula F2)', () => {
  it('test_each_applied_action_appends_one_snapshot_rather_than_replacing', () => {
    // Regression guard: swapping `push(...)` for `= [snapshot()]` (replace
    // instead of append) previously passed every test, because no test called
    // applyAction more than once and checked the resulting depth sequence.
    const { manager } = makeManager()
    manager.startBattle()

    const atPhaseStart = manager.getPlayerPhaseSnapshotCount()
    manager.applyAction(NO_EFFECTS)
    const afterOne = manager.getPlayerPhaseSnapshotCount()
    manager.applyAction(NO_EFFECTS)
    const afterTwo = manager.getPlayerPhaseSnapshotCount()

    expect(afterOne).toBe(atPhaseStart + 1)
    expect(afterTwo).toBe(atPhaseStart + 2)
  })

  it('test_committing_the_player_phase_clears_the_snapshot_list', () => {
    // GDD Rule 4: the list is bounded to one Player Phase.
    const { manager } = makeManager()
    manager.startBattle()
    manager.applyAction(NO_EFFECTS)
    manager.applyAction(NO_EFFECTS)
    expect(manager.getPlayerPhaseSnapshotCount()).toBeGreaterThan(1)

    manager.endPlayerPhase()

    // Back in a fresh Player Phase — the previous phase's entries are gone.
    expect(manager.getPlayerPhaseSnapshotCount()).toBeLessThanOrEqual(1)
  })
})
