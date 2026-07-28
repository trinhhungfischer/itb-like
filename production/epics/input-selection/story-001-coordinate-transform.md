# Story 001: Coordinate Transform Math

> **Epic**: Input & Selection
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 

## Context

**GDD**: `design/gdd/input-and-selection.md`
**Requirement**: `TR-INPUT-001`

**ADR Governing Implementation**: ADR-0009: Shared reachableTiles/BFS + coordinate-transform ownership (C3)
**ADR Decision Summary**: A single coordinate-transform module owns both directions of the screen↔tile mapping and is imported by both Input & Selection and Board Rendering & Juice — never re-implemented on either side.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None

**Control Manifest Rules (this layer)**:
- Required: Coordinates must be correctly transformed when projecting reachable tiles

---

## Acceptance Criteria

*From GDD `design/gdd/input-and-selection.md`, scoped to this story:*

- [ ] GIVEN `tileSize=64`, `origin=(32,32)`, WHEN `screenToTile(300,150)`, THEN it returns `(4,1)`.
- [ ] GIVEN the same setup, WHEN `tileToScreenCenter(4,1)` is called on the result of the prior test, THEN it returns `(320,128)`.
- [ ] GIVEN a pixel position outside the board's pixel bounds, WHEN `screenToTile`, THEN it returns `null` and no selection state changes.

---

## Implementation Notes

*Derived from ADR-0009 Implementation Guidelines:*

The transform module is a small, dependency-free TS file (e.g. `src/ui/coordinate-transform.ts` or equivalent under the Input/Rendering boundary). It takes `view` as an argument and holds no mutable state.
Rounding is defined once, here: `screenToTile` uses `Math.floor` on the offset-and-divide; `tileToScreenCenter` adds the `tileSize/2` center offset. Do not vary rounding between the two importers.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 002: Core Selection State Machine (handling the click precision and state)

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

**[For Logic / Integration stories — automated test specs]:**

- **AC-1**: Screen to Tile Mapping
  - Given: `tileSize=64`, `origin=(32,32)`
  - When: `screenToTile(300, 150, view)` is called
  - Then: It returns `{ col: 4, row: 1 }`
  - Edge cases: Click on the exact boundary (e.g. `x=32`, `y=32` returning `{col: 0, row: 0}`)

- **AC-2**: Tile to Screen Center Mapping
  - Given: `tileSize=64`, `origin=(32,32)`
  - When: `tileToScreenCenter(4, 1, view)` is called
  - Then: It returns `{ px: 320, py: 128 }`
  - Edge cases: Negative tile coordinates if out-of-bounds queries were somehow allowed (though constrained by `inBounds`).

- **AC-3**: Out of Bounds Mapping
  - Given: A pixel position outside the board (e.g., `x=1000, y=1000`)
  - When: `screenToTile(1000, 1000, view)` is called
  - Then: It returns `null`
  - Edge cases: Just outside the origin (`x=31`), just outside the max width/height based on an 8x8 grid.

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/input-selection/input_selection_coordinate_transform_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None
- Unlocks: Story 002
