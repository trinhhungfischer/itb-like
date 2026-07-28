# Story 002: Board Snapshot

> **Epic**: Board & Grid
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Estimate**: 2h
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-28

## Context

**GDD**: `design/gdd/board-and-grid.md`
**Requirement**: `TR-BOARD-002`

**ADR Governing Implementation**: ADR-0001: Board tile-state representation & cheap `snapshot()`
**ADR Decision Summary**: Tile state stored as parallel flat typed arrays so `snapshot()` is a bulk memcpy.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None

**Control Manifest Rules (this layer)**:
- Required: Board's internal data representation must be cheap by construction for `snapshot()`.
- Forbidden: Never implement `snapshot()` as a naive object-graph deep clone.
- Guardrail: `snapshot()` full deep-copy (≤ 12×12) < 1 ms/call.

---

## Acceptance Criteria

*From GDD `design/gdd/board-and-grid.md`, scoped to this story:*

- [ ] GIVEN state S, WHEN snapshot() is taken and the copy is mutated, THEN the live board stays S (deep copy, no shared refs).
- [ ] GIVEN a snapshot at T, WHEN the live board mutates after T, THEN the snapshot does not reflect it.
- [ ] GIVEN snapshot() full deep-copy (≤ 12×12), THEN it must execute in < 1 ms/call.

---

## Implementation Notes

*Derived from ADR-0001 Implementation Guidelines:*

Implement `snapshot()` by performing a fast copy (e.g., using `.slice()` on the TypedArrays) of the parallel backing arrays. Ensure that the snapshot does not hold any shared references to the original board's backing arrays. Benchmark to verify the < 1 ms/call requirement.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 001: Board state and pure queries
- Story 003: Reachable tiles BFS
- Story 004: Error contract
- Story 005: Mutations

---

## QA Test Cases

*Test cases not yet defined — run /qa-plan to generate them.*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/board-grid/board-snapshot_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001
- Unlocks: None
