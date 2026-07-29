# Story 003: Movement-to-Range Destination

> **Epic**: Enemy, Abilities & Telegraph
> **Status**: Complete
> **Layer**: Feature
> **Type**: Logic
> **Estimate**:
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-29

## Context

**GDD**: `design/gdd/enemy-abilities-and-telegraph.md`
**Requirement**: `TR-ENEMY-003`

**ADR Governing Implementation**: ADR-0009: Shared reachableTiles/BFS + coordinate-transform ownership (C3)
**ADR Decision Summary**: Resolves cross-system contract C3 by fixing two single-owner boundaries: Board & Grid owns the one bounded flood-fill `reachableTiles(origin, ...)`

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: 

**Control Manifest Rules (this layer)**:
- Required: Coordinates must be correctly transformed when projecting reachable tiles
- Forbidden: N/A

---

## Acceptance Criteria

*From GDD `design/gdd/enemy-abilities-and-telegraph.md`, scoped to this story:*

- [ ] **GIVEN** a target already within `attackRange`, **WHEN** `chooseIntents()` runs, **THEN** `telegraphedMoveDestination === null`.
- [ ] **GIVEN** an enemy fully enclosed by Blocked terrain with a target out of immediate range, **WHEN** `chooseIntents()` runs, **THEN** the enemy telegraphs `Idle`.
- [ ] **GIVEN** the worked Formula F2 example 1 setup, **WHEN** `chooseIntents()` runs, **THEN** `telegraphedMoveDestination === (5,3)` exactly.

---

## Implementation Notes

*Derived from ADR-0009 Implementation Guidelines:*

Use the shared `Board.reachableTiles` BFS implementation instead of writing a new one. Enemy destination-selection policy is layered on top of this shared reachable set.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 004: Telegraph State querying

---

## QA Test Cases

*Test cases to implement:*
- Target already in range implies no movement.
- Full enclosure by blocked terrain yields `Idle`.
- Confirm F2 example behavior exactly matches specification.

*Edge Cases:*
- Enclosed spaces with no path out.
- Target already exactly within `attackRange`.

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/enemy-abilities-and-telegraph/movement-to-range_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 002
- Unlocks: Story 004

## Completion Notes
**Completed**: 2026-07-29
**Criteria**: 3/3 passing
**Deviations**: None
**Test Evidence**: Logic: test file at `tests/unit/enemy-abilities-and-telegraph/movement-to-range_test.ts`
**Code Review**: Complete
