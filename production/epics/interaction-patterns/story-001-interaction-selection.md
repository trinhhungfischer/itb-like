# Story 001: Selection State Machine

> **Epic**: Interaction Patterns
> **Status**: Complete
> **Layer**: Presentation
> **Type**: Logic
> **Estimate**: 3 days
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-30

## Context

**GDD**: `design/ux/interaction-patterns.md`
**Requirement**: `TR-INT-001`

**ADR Governing Implementation**: ADR-0007: Snapshot Undo Preview
**ADR Decision Summary**: Actions operate on snapshot state to ensure deterministic behavior.

**Engine**: PIXI.js | **Risk**: LOW

---

## Acceptance Criteria

- [x] Implements state transitions: Idle → UnitSelected → Targeting(mode) → Locked → Idle
- [x] Hovering a valid target shows highlight
- [x] Clicking a valid target commits the action and locks input
- [x] Tab/Shift-Tab cycles through living heroes

---

## QA Test Cases

- **AC-1**: Targeting mode input
  - Setup: In UnitSelected state, select an ability
  - Verify: Hovering a legal target tile highlights it. Clicking it locks input.
  - Pass condition: Input remains locked until animation completes (isAnimating = false)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/interaction/selection_test.ts` — must exist and pass

**Status**: [x] Tests created and passing in `tests/unit/interaction/selection_test.ts`

---

## Dependencies

- Depends on: None
- Unlocks: Story 002

## Completion Notes
**Completed**: 2026-07-30
**Criteria**: 4/4 passing
**Deviations**: None
**Test Evidence**: Logic: test file at `tests/unit/interaction/selection_test.ts`
**Code Review**: Complete (All constraints satisfied, tests passing)
