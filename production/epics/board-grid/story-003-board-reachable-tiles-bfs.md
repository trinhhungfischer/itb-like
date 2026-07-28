# Story 003: Reachable Tiles BFS

> **Epic**: Board & Grid
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Estimate**: 3h
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-28

## Context

**GDD**: `design/gdd/board-and-grid.md`
**Requirement**: `TR-BOARD-003`

**ADR Governing Implementation**: ADR-0009: Shared reachableTiles/BFS + coordinate-transform ownership
**ADR Decision Summary**: Board owns the single canonical bounded flood-fill `reachableTiles(origin, range, board)` over Clear tiles.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None

**Control Manifest Rules (this layer)**:
- Required: Coordinates must be correctly transformed when projecting reachable tiles.

---

## Acceptance Criteria

*From GDD `design/gdd/board-and-grid.md`, scoped to this story:*

- [ ] GIVEN an interior origin with range=3 on an open 8×8 board, WHEN reachableTiles, THEN it returns exactly 24 tiles, none of which is the origin.
- [ ] GIVEN range=0, WHEN reachableTiles, THEN it returns ∅ (origin itself is excluded).
- [ ] GIVEN an obstacle that fully encloses the origin, WHEN reachableTiles, THEN it returns ∅ even with range > 0.
- [ ] GIVEN any valid origin/range, THEN every returned tile satisfies distance(origin, t) ≤ range ∧ classify(t) === Clear.

---

## Implementation Notes

*Derived from ADR-0009 Implementation Guidelines:*

Implement `reachableTiles(origin, range, board)` as a standalone function or method that uses a deterministic, bounded Breadth-First Search. It should rely exclusively on the Board's pure queries (e.g., `neighbors()`, `classify()`) to expand only through `Clear` tiles.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 001: Board state and pure queries
- Story 002: Snapshot performance
- Story 005: Mutations

---

## QA Test Cases

*Test cases not yet defined — run /qa-plan to generate them.*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/board-grid/board-reachable-tiles-bfs_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001
- Unlocks: None
