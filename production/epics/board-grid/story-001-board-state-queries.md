# Story 001: Board State & Pure Queries

> **Epic**: Board & Grid
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Estimate**: 4h
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-28

## Context

**GDD**: `design/gdd/board-and-grid.md`
**Requirement**: `TR-BOARD-001`, `TR-BOARD-007`

**ADR Governing Implementation**: ADR-0001: Board tile-state representation & cheap `snapshot()`
**ADR Decision Summary**: Board tile-state is stored as parallel flat typed arrays indexed by `index(c, r) = r * W + c`.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None

**Control Manifest Rules (this layer)**:
- Required: Board's internal data representation must be cheap by construction for `snapshot()`. Index function `index(c, r) = r * W + c` must be defined once and used everywhere.
- Forbidden: Queries must never return a reference into a backing array. Never duplicate the index arithmetic inline.
- Guardrail: Single O(1) query avg < 0.01 ms.

---

## Acceptance Criteria

*From GDD `design/gdd/board-and-grid.md`, scoped to this story:*

- [ ] GIVEN W≥1, H≥1, WHEN the board is constructed, THEN it succeeds and width===W, height===H.
- [ ] GIVEN no dimensions, WHEN constructed, THEN it defaults to 8×8.
- [ ] GIVEN W<1 or H<1, WHEN constructed, THEN construction is rejected and no board is produced.
- [ ] GIVEN 0≤c<W ∧ 0≤r<H, WHEN inBounds(c,r), THEN true.
- [ ] GIVEN any negative coord, WHEN inBounds, THEN false (no wraparound).
- [ ] GIVEN c=W or r=H, WHEN inBounds, THEN false.
- [ ] GIVEN interior (3,3), WHEN neighbors, THEN exactly {(3,2),(3,4),(2,3),(4,3)} (4).
- [ ] GIVEN a Blocked tile, WHEN checked, THEN isBlocked===true and classify===BlockedTerrain.
- [ ] GIVEN water_lethal=true, WHEN a unit enters Water, THEN classify===Lethal; GIVEN water_lethal=false THEN non-lethal (knob respected).
- [ ] GIVEN one tile per rank, WHEN classify, THEN it returns the expected rank, confirming order OutOfBounds → BlockedTerrain → Lethal → Occupied → Clear.
- [ ] GIVEN state S, WHEN any query is called any number of times, THEN state after === S (no query mutates).

---

## Implementation Notes

*Derived from ADR-0001 Implementation Guidelines:*

Implement `index(c, r) = r * W + c` and use it exclusively for all backing array accesses. Initialize the parallel arrays (terrain, occupancy, hazard, flags) during construction. Ensure that all read-only queries (e.g., `inBounds`, `classify`) are implemented efficiently without mutating any internal state.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 002: Snapshot performance and implementation
- Story 003: Reachable tiles BFS
- Story 004: Error contract for rejections vs throws
- Story 005: Mutations

---

## QA Test Cases

*Test cases not yet defined — run /qa-plan to generate them.*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/board-and-grid/board-state-queries_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None
- Unlocks: Story 002, Story 003, Story 004, Story 005
