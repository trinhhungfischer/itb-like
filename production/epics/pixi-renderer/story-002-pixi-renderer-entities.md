# Story 002: Entity & State Rendering

> **Epic**: PIXI Renderer
> **Status**: Ready
> **Layer**: Presentation
> **Type**: Visual/Feel
> **Estimate**: 3 days
> **Manifest Version**: 2026-07-28

## Context

**GDD**: `design/gdd/board-rendering-and-juice.md`
**Requirement**: `TR-REND-001`

**ADR Governing Implementation**: ADR-0009: Reachable Tiles Coordinate Transform
**ADR Decision Summary**: Coordinate transformations map exact entity coordinates to PIXI positions.

**Engine**: PIXI.js | **Risk**: LOW

---

## Acceptance Criteria

- [ ] Heroes and enemies are rendered at exact grid tile coordinates (Layer 7)
- [ ] Entity sprites are correctly offset based on the computed origin (Formula F1)

---

## QA Test Cases

- **AC-1**: Entity renders on correct tile
  - Setup: Load a state with an entity at (3, 4)
  - Verify: Entity sprite is drawn perfectly aligned with tile (3, 4)
  - Pass condition: Sprite bounds align with grid lines

---

## Test Evidence

**Story Type**: Visual/Feel
**Required evidence**:
- Visual/Feel: `production/qa/evidence/pixi-renderer-entities-evidence.md` + sign-off

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001
- Unlocks: Story 003
