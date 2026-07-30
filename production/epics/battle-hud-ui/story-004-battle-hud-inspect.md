# Story 004: Unit Inspect Panel

> **Epic**: Battle HUD UI
> **Status**: Complete
> **Layer**: Presentation
> **Type**: UI
> **Estimate**: 1 day
> **Manifest Version**: 2026-07-28

## Context

**GDD**: `design/ux/battle-hud-ux-spec.md`
**Requirement**: `TR-HUD-001`

**ADR Governing Implementation**: ADR-0001: Board Tile State Snapshot
**ADR Decision Summary**: Read from board snapshot.

**Engine**: PIXI.js | **Risk**: LOW

---

## Acceptance Criteria

- [ ] Holding Alt or clicking an enemy opens the Inspect panel
- [ ] Panel renders read-only stats and intents
- [ ] Panel does not permanently obscure the HUD (e.g. Zone C pushed or transparent)

---

## QA Test Cases

- **AC-1**: Inspect panel toggle
  - Setup: Hover enemy and hold Alt
  - Verify: Panel appears with correct stats
  - Pass condition: Releasing Alt dismisses the panel

---

## Test Evidence

**Story Type**: UI
**Required evidence**:
- UI: `production/qa/evidence/battle-hud-inspect-evidence.md` or interaction test

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001
- Unlocks: None
