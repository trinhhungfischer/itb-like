# Story 002: Legal Move Selection

> **Epic**: Heroes & Abilities
> **Status**: Complete
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-29

## Context

**GDD**: `design/gdd/heroes-and-abilities.md`
**Requirement**: `TR-HERO-003`

**ADR Governing Implementation**: ADR-0009: Shared reachableTiles/BFS + coordinate-transform ownership
**ADR Decision Summary**: Fixes ownership of bounded flood-fill to Board & Grid. Heroes & Abilities queries it but does not re-implement it.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None

**Control Manifest Rules (this layer)**:
- Required: Coordinates must be correctly transformed when projecting reachable tiles
- Forbidden: None
- Guardrail: None

---

## Acceptance Criteria

*From GDD `design/gdd/heroes-and-abilities.md`, scoped to this story:*

- [x] GIVEN Vanguard (`moveRange=3`) on an open board at `(3,3)`, THEN `|legalMoveTiles| == 24` and every returned tile satisfies `distance(origin,tile) ≤ 3`.
- [x] GIVEN a hero with `moveRange=0`, THEN `legalMoveTiles == ∅` and the Move slot is never offered.
- [x] GIVEN a hero fully surrounded by non-`Clear` tiles, THEN `legalMoveTiles == ∅` even with `moveRange > 0`.
- [x] GIVEN a Lethal tile within `moveRange`, THEN it is **excluded** from `legalMoveTiles` (a hero can never voluntarily walk onto Chasm/lethal Water — only forced displacement can).
- [x] GIVEN a hero uses its Move slot, WHEN its Ability's `legalTargets` is subsequently queried, THEN the query uses the hero's post-move tile, not its turn-start tile (Rule 7).

---

## Implementation Notes

*Derived from ADR-0009 Implementation Guidelines:*

Implement `legalMoveTiles` as a pass-through to `Board.reachableTiles`. Ensure that Lethal tiles are filtered out if `reachableTiles` includes them. Ensure targeting queries post-move use the updated tile.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 003: Ability Targeting Geometry

---

## QA Test Cases

**Test file path**: `tests/unit/heroes-abilities/story-002-legal-move-selection_test.ts`
**What to test**:
- `legalMoveTiles` returns correct Manhattan reachable tiles within `moveRange` (using `reachableTiles`).
- Lethal/Blocked tiles are excluded.
- Hero with 0 `moveRange` returns no move tiles.
- Fully surrounded heroes return no move tiles.
- `legalTargets` queries post-move tile after Move slot is used.

**Edge cases to cover**:
- Fully boxed-in hero (all neighbors blocked).
- Lethal tiles within `moveRange`.
- Querying targets after movement.

**Estimated test count**: ~6 unit tests

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/heroes-abilities/move-selection_test.ts` — must exist and pass

**Status**: [x] Created and Passing

---

## Dependencies

- Depends on: Story 001
- Unlocks: Story 003

## Completion Notes
**Completed**: 2026-07-29
**Criteria**: 5/5 passing
**Deviations**: None
**Test Evidence**: Logic: test file at `tests/unit/heroes-abilities/move-selection_test.ts`
**Code Review**: Complete
