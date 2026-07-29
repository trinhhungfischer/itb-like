# Story 006: On-Death Effects

> **Epic**: Enemy, Abilities & Telegraph
> **Status**: Complete
> **Layer**: Feature
> **Type**: Integration
> **Estimate**:
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-29

## Context

**GDD**: `design/gdd/enemy-abilities-and-telegraph.md`
**Requirement**: `TR-ENEMY-007`

**ADR Governing Implementation**: ADR-0007: Snapshot-based undo & preview reuse one simulation
**ADR Decision Summary**: Both in-phase undo and pre-commit Move Preview are built on a single mechanism — `Board.snapshot()` — feeding the single simulation `Combat.resolve()`.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: 

**Control Manifest Rules (this layer)**:
- Required: Snapshot must be captured only AFTER an action's entire consequence chain resolves
- Forbidden: Snapshot must never be captured mid-chain

---

## Acceptance Criteria

*From GDD `design/gdd/enemy-abilities-and-telegraph.md`, scoped to this story:*

- [ ] **GIVEN** an enemy with `onDeath` defined dies via damage (`Defeated`), **WHEN** the triggering `resolve()` call returns, **THEN** exactly one follow-up `resolve(board, onDeathEffects)` call fires immediately after, using the enemy's last-occupied tile as the effect anchor.
- [ ] **GIVEN** the same enemy instead dies via push into a Chasm (`Fell`) with the default `onDeath_trigger_causes = {Defeated, Fell}`, **THEN** its `onDeath` effect still fires identically.
- [ ] **GIVEN** `onDeath_trigger_causes` is set to `{Defeated}` only for a specific archetype, **WHEN** that archetype dies via `Fell`, **THEN** its `onDeath` effect does **not** fire.
- [ ] **GIVEN** two `onDeath`-bearing enemies both removed within one triggering chain, and enemy A's death radius would kill enemy B (also `onDeath`-bearing), **WHEN** follow-ups resolve, **THEN** A's follow-up fires first (removal order), which then queues B's follow-up, which fires after A's completes — no infinite loop, terminating within `enemyCount` steps.

---

## Implementation Notes

*Derived from ADR-0007 Implementation Guidelines:*

On-death effects execute via queued follow-up `resolve()` calls immediately after the triggering chain finishes. 
Wait until the entire cascade of follow-up calls concludes before yielding control back, so Turn & Phase Manager captures the undo snapshot only after all consequences are resolved.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 007: Spawning new enemies

---

## QA Test Cases

*Test cases to implement:*
- Defeated by damage triggers one follow-up `resolve()`.
- Fell (chasm) triggers `onDeath` if configured.
- Fell does NOT trigger if `onDeath_trigger_causes` is only `{Defeated}`.
- Chaining deaths via AoE resolves strictly in order without infinite looping.

*Edge Cases:*
- Multi-death chain reactions.
- Pushed into chasm vs regular damage defeat.

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `tests/integration/enemy-abilities-and-telegraph/on-death-effects_test.ts` OR playtest doc

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 005
- Unlocks: Story 007

## Completion Notes
**Completed**: 2026-07-29
**Criteria**: 4/4 passing
**Deviations**: None
**Test Evidence**: Integration: test file at `tests/integration/enemy-abilities-and-telegraph/on-death-effects_test.ts`
**Code Review**: Complete (Approved)
