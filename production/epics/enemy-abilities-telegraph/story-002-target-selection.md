# Story 002: Target Selection AI

> **Epic**: Enemy, Abilities & Telegraph
> **Status**: Complete
> **Layer**: Feature
> **Type**: Logic
> **Estimate**:
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-29

## Context

**GDD**: `design/gdd/enemy-abilities-and-telegraph.md`
**Requirement**: `TR-ENEMY-002`

**ADR Governing Implementation**: ADR-0004: mulberry32 PRNG seed strategy (procedural only)
**ADR Decision Summary**: VANGUARD needs reproducible procedural variety without introducing any non-determinism into battle resolution. Thus, target selection MUST be purely deterministic.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: 

**Control Manifest Rules (this layer)**:
- Required: Board state must be byte-reproducible; no hidden identity, no RNG, no wall-clock
- Forbidden: Never use Math.random(), Date.now(), or PRNG in battle resolution

---

## Acceptance Criteria

*From GDD `design/gdd/enemy-abilities-and-telegraph.md`, scoped to this story:*

- [ ] **GIVEN** an enemy and two heroes at equal Manhattan distance with `unitId` 1 and 2, **WHEN** `chooseIntents()` runs, **THEN** the hero with `unitId=1` is selected.
- [ ] **GIVEN** an enemy whose nearest target is unreachable within range but a farther target is reachable, **WHEN** `chooseIntents()` runs, **THEN** the enemy telegraphs `Idle` — the farther target is never selected.
- [ ] **GIVEN** zero living heroes, **WHEN** `chooseIntents()` runs, **THEN** the enemy telegraphs `Idle` with no error/crash.

---

## Implementation Notes

*Derived from ADR-0004 Implementation Guidelines:*

Do not use RNG. Rely entirely on the deterministic target policy: Manhattan distance, tie-broken by lowest `unitId`.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 003: Movement paths and `telegraphedMoveDestination`

---

## QA Test Cases

*Test cases to implement:*
- Verify tie-breaking target selection uses lowest `unitId` for equal Manhattan distance.
- Verify `Idle` telegraph when nearest target is unreachable.
- Verify `Idle` telegraph when 0 heroes are alive without throwing errors.

*Edge Cases:*
- Unreachable targets despite being closer than reachable targets.
- Board with no living hero units.

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/enemy-abilities-and-telegraph/target-selection_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001
- Unlocks: Story 003

## Completion Notes
**Completed**: 2026-07-29
**Criteria**: 3/3 passing
**Deviations**: None
**Test Evidence**: Logic: test file at `tests/unit/enemy-abilities-and-telegraph/target-selection_test.ts`
**Code Review**: Complete
