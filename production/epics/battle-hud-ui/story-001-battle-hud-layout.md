# Story 001: HUD Layout & Zones A-B-E

> **Epic**: Battle HUD UI
> **Status**: Complete
> **Layer**: Presentation
> **Type**: UI
> **Estimate**: 2 days
> **Manifest Version**: 2026-07-28

## Context

**GDD**: `design/ux/battle-hud-ux-spec.md`
**Requirement**: `TR-HUD-001`

**ADR Governing Implementation**: ADR-0001: Board Tile State Snapshot
**ADR Decision Summary**: Read from board snapshot for rendering UI state.

**Engine**: PIXI.js | **Risk**: LOW

---

## Acceptance Criteria

- [ ] Zone A (Turn/Phase) anchors Top-Left
- [ ] Zone B (Objective) anchors Top-Center
- [ ] Zone E (End Turn) anchors Bottom-Right
- [ ] UI elements scale fluidly and anchor to respective edges

---

## QA Test Cases

- **AC-1**: UI anchoring
  - Setup: Resize browser window
  - Verify: Zones remain locked to their corners/centers
  - Pass condition: No overlapping or disappearing elements at 1280x720

---

## Test Evidence

**Story Type**: UI
**Required evidence**:
- UI: `production/qa/evidence/battle-hud-layout-evidence.md` or interaction test

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None
- Unlocks: Story 002, Story 003, Story 004
