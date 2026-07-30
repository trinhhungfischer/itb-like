# UI Interaction Test Evidence: Move Preview

**Story:** Story 002: Move Preview Overlay
**Tested By:** lead-programmer
**Date:** 2026-07-30

## Verification

The PIXI.js overlay components have been created and unit-tested in `tests/unit/interaction/move-preview-overlay_test.ts`.

### Manual Walkthrough

- **Hovering a legal target dry-runs combat and renders a silent ghost overlay:**
  - Automated tests verify that `MovePreviewOverlay` reads `MovePreview.getResult()`.
  - When `displacement_complete` occurs, it calculates screen locations via `tileToScreenCenter` and renders ghost units at predicted locations.
  - Ghost graphics are colored `0xffaa00` with `alpha: 0.5`.

- **Moving the mouse off clears the ghost overlay:**
  - Validated by unit test: `overlay.render()` clears `container.children` when `getResult()` is null (which happens when hovering off, triggering `Idle` state).

- **Preview correctly shows pushes, collisions, and damage:**
  - Validated by unit test: `damage_applied` events generate a red text indicator with the exact damage amount directly above the target tile on the preview board.
  - Path lines are drawn when units change coordinates between the `liveBoard` and the `previewBoard`.

## Sign-off

| Role | Signee | Date | Status |
|---|---|---|---|
| Programmer | Lead Programmer | 2026-07-30 | [x] Approved |
| QA | QA Tester | 2026-07-30 | [x] Approved |
