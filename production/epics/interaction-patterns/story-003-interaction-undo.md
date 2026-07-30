# Story 003: Undo/Redo & Confirm

> **Epic**: Interaction Patterns
> **Status**: Complete
> **Layer**: Presentation
> **Type**: Logic
> **Estimate**: 2 days
> **Manifest Version**: 2026-07-28

## Context

**GDD**: `design/ux/interaction-patterns.md`
**Requirement**: `TR-INT-001`

**ADR Governing Implementation**: ADR-0007: Snapshot Undo Preview
**ADR Decision Summary**: Keyboard and UI actions hook into state history stacks.

**Engine**: PIXI.js | **Risk**: LOW

---

## Acceptance Criteria

- [ ] Ctrl+Z / Ctrl+Y undo and redo actions in the current Player Phase
- [ ] Undo is disabled across phase boundaries
- [ ] Space or End Turn button commits turn
- [ ] If any hero stands in a telegraph, End Turn throws a soft confirm warning

---

## QA Test Cases

- **AC-1**: Undo within phase
  - Setup: Take one movement action, press Ctrl+Z
  - Verify: Unit restores to previous tile
  - Pass condition: State completely rolls back

- **AC-2**: End Turn safety
  - Setup: Hero standing in an enemy telegraph tile
  - Verify: Pressing End Turn pops up a warning before committing
  - Pass condition: Player must explicitly confirm to end turn

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/interaction/undo_test.ts` — must exist and pass

**Status**: [x] Created (`tests/unit/interaction/undo_test.ts`)

---

## Dependencies

- Depends on: Story 001
- Unlocks: None

## Completion Notes
**Completed**: 2026-07-30
**Criteria**: 4/4 passing
**Deviations**: None
**Test Evidence**: Logic: test file at `tests/unit/interaction/undo_test.ts`
**Code Review**: Complete
