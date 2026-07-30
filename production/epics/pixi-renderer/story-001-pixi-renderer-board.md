# Story 001: PIXI Board & Tile Rendering

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
**ADR Decision Summary**: Coordinate transformations are deterministic and managed to map Engine logical tiles to rendering pixels accurately.

**Engine**: PIXI.js | **Risk**: LOW
**Engine Notes**: Basic 2D canvas/WebGL rendering.

---

## Acceptance Criteria

- [ ] Viewport fit computes exact tileSize and origin (Formula F1)
- [ ] Grid lines and terrain tiles render correctly based on Engine's `getTile`
- [ ] Hazard overlays persist correctly without event spam

---

## Implementation Notes

Use PIXI `Graphics` and `Sprite` classes to construct the tile background. Ensure z-order layers are respected: Background (1), Terrain (2), Grid Lines (3), Hazards (4).

---

## QA Test Cases

- **AC-1**: Viewport fit computes exact tileSize and origin
  - Setup: Start a battle with default 8x8 grid on a 960x720 window
  - Verify: Tile size is computed as 90px, perfectly centered
  - Pass condition: The board renders perfectly centered without cutoffs

---

## Test Evidence

**Story Type**: Visual/Feel
**Required evidence**:
- Visual/Feel: `production/qa/evidence/pixi-renderer-board-evidence.md` + sign-off

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None
- Unlocks: Story 002
