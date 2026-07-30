# Story 003: HUD Zone D (Threat Ticker)

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
**ADR Decision Summary**: Threat reading derived from snapshot intents.

**Engine**: PIXI.js | **Risk**: LOW

---

## Acceptance Criteria

- [ ] Threat Ticker anchors to the Right edge
- [ ] Dual-encoded HP bars float above enemies (if not handled by board layer directly, handled via UI overlay synced to camera)
- [ ] Ticker aggregates all off-board and incoming intents

---

## QA Test Cases

- **AC-1**: Threat ticker aggregation
  - Setup: 2 enemies telegraph attacks
  - Verify: Ticker shows 2 incoming threat summaries on the right edge
  - Pass condition: Icons match the exact shape and verb-color of the attacks

---

## Test Evidence

**Story Type**: UI
**Required evidence**:
- UI: `production/qa/evidence/battle-hud-threats-evidence.md` or interaction test

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001
- Unlocks: None
