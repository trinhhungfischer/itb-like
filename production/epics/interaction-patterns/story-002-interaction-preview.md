# Story 002: Move Preview Overlay

> **Epic**: Interaction Patterns
> **Status**: Complete
> **Layer**: Presentation
> **Type**: UI
> **Estimate**: 2 days
> **Manifest Version**: 2026-07-28

## Context

**GDD**: `design/ux/interaction-patterns.md`
**Requirement**: `TR-INT-002`

**ADR Governing Implementation**: ADR-0007: Snapshot Undo Preview
**ADR Decision Summary**: Render ghosting over board by evaluating combat on a cloned snapshot.

**Engine**: PIXI.js | **Risk**: MEDIUM

---

## Acceptance Criteria

- [ ] Hovering a legal target dry-runs combat and renders a silent ghost overlay
- [ ] Moving the mouse off clears the ghost overlay
- [ ] Preview correctly shows pushes, collisions, and damage

---

## QA Test Cases

- **AC-1**: Dry run preview
  - Setup: Hover a target tile during an attack action
  - Verify: Semi-transparent ghost sprite of affected units appears at predicted tiles
  - Pass condition: Live state is not mutated and overlay clears immediately upon unhovering

---

## Test Evidence

**Story Type**: UI
**Required evidence**:
- UI: `production/qa/evidence/interaction-preview-evidence.md`

**Status**: [x] Created (`production/qa/evidence/interaction-preview-evidence.md`)

---

## Dependencies

- Depends on: Story 001
- Unlocks: None

## Completion Notes
**Completed**: 2026-07-30
**Criteria**: 3/3 passing
**Deviations**: None
**Test Evidence**: UI: evidence doc at `production/qa/evidence/interaction-preview-evidence.md`
**Code Review**: Complete
