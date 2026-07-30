# Story 003: Basic Animations & Juice

> **Epic**: PIXI Renderer
> **Status**: Complete
> **Layer**: Presentation
> **Type**: Visual/Feel
> **Estimate**: 2 days
> **Manifest Version**: 2026-07-28

## Context

**GDD**: `design/gdd/board-rendering-and-juice.md`
**Requirement**: `TR-REND-002`

**ADR Governing Implementation**: N/A - Juice events handled via event bus without complex state management.
**ADR Decision Summary**: Read from combat event log, play visual juice in sequential order.

**Engine**: PIXI.js | **Risk**: LOW

---

## Acceptance Criteria

- [ ] Knockback and hit flashes tween smoothly
- [ ] Animations block input (`isAnimating()` flag true) until resolved
- [ ] Visual effects correspond strictly to logical events

---

## QA Test Cases

- **AC-1**: Knockback tween
  - Setup: Trigger a push ability
  - Verify: Unit smoothly slides to destination tile over `step_duration_ms`
  - Pass condition: Animation completes perfectly on target tile

---

## Test Evidence

**Story Type**: Visual/Feel
**Required evidence**:
- Visual/Feel: `production/qa/evidence/pixi-renderer-juice-evidence.md` + sign-off

**Status**: [x] Approved

---

## Completion Notes
**Completed**: 2026-07-30
**Criteria**: 3/3 passing
**Deviations**: None
**Test Evidence**: Visual/Feel: evidence doc at production/qa/evidence/pixi-renderer-juice-evidence.md
**Code Review**: Complete

---

## Dependencies

- Depends on: Story 002
- Unlocks: None
