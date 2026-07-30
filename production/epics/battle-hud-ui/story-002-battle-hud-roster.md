# Story 002: HUD Zone C (Ability Bar)

> **Epic**: Battle HUD UI
> **Status**: Ready
> **Layer**: Presentation
> **Type**: UI
> **Estimate**: 2 days
> **Manifest Version**: 2026-07-28

## Context

**GDD**: `design/ux/battle-hud-ux-spec.md`
**Requirement**: `TR-HUD-001`

**ADR Governing Implementation**: ADR-0001: Board Tile State Snapshot
**ADR Decision Summary**: State read from exact board state snapshot.

**Engine**: PIXI.js | **Risk**: LOW

---

## Acceptance Criteria

- [ ] Ability Bar (Zone C) anchors Bottom-Center
- [ ] Hero portrait, HP bar, and ability icons populate dynamically
- [ ] Selecting a hero updates the active highlighted card

---

## QA Test Cases

- **AC-1**: Ability bar population
  - Setup: Load battle with 3 heroes
  - Verify: 3 cards are displayed horizontally along the bottom center
  - Pass condition: HP bars match unit data, ability icons show correct verb-family colors

---

## Test Evidence

**Story Type**: UI
**Required evidence**:
- UI: `production/qa/evidence/battle-hud-roster-evidence.md` or interaction test

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001
- Unlocks: None
