# Story 002: Core Selection State Machine

> **Epic**: Input & Selection
> **Status**: Complete
> **Layer**: Core
> **Type**: Integration
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-28
## Context

**GDD**: `design/gdd/input-and-selection.md`
**Requirement**: `TR-INPUT-002`, `TR-INPUT-004`

**ADR Governing Implementation**: ADR-0002: Deterministic synchronous event bus
**ADR Decision Summary**: VANGUARD uses a single, lightweight, synchronous observer event bus. Input & Selection uses this bus to emit hover/select/cancel/confirm events silently without calling preview directly.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None

**Control Manifest Rules (this layer)**:
- Required: Event Bus `emit()` must be synchronous and invoke subscribers in registration order on the caller's stack.
- Forbidden: Event Bus handlers must not defer (no Promise/microtask/setTimeout/rAF).

---

## Acceptance Criteria

*From GDD `design/gdd/input-and-selection.md`, scoped to this story:*

- [ ] GIVEN `click_tolerance_px=6`, pointerdown at (300,150) and pointerup at (303,152) within `max_click_hold_ms`, WHEN `isValidClick`, THEN `true`.
- [ ] GIVEN the same tolerance, pointerup at (320,170) (dist > 6), WHEN `isValidClick`, THEN `false` (not treated as a commit click).
- [ ] GIVEN `Idle` state, WHEN the player clicks a friendly acting-eligible unit, THEN state becomes `UnitSelected` for that unit.
- [ ] GIVEN `UnitSelected`, WHEN the player clicks the same unit again, THEN state returns to `Idle` (deselect toggle).
- [ ] GIVEN `UnitSelected` for unit A, WHEN the player clicks a different friendly acting-eligible unit B, THEN state becomes `UnitSelected` for B.
- [ ] GIVEN `Targeting`(Move) for a selected unit, WHEN `Escape` is pressed, THEN state returns to `UnitSelected` and Board state is byte-identical to before Targeting was entered.
- [ ] GIVEN `Targeting`(mode) with a hovered legal target tile, WHEN a valid click lands on that tile, THEN the action commits, state transitions to `Locked`, and (after resolution) to `UnitSelected` or `Idle` depending on remaining actions.

---

## Implementation Notes

*Derived from ADR-0002 Implementation Guidelines:*

Input & Selection is a silent event emitter. It never calls a `preview()` function and never reads a preview result back. It emits `hover`, `select`, `cancel`, `confirm` events via the event bus.
Queries Heroes' `legalMoveTiles`/`legalTargets` for highlight sets. Does not compute legality/reachability itself.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 003: Locked State & Input Buffering
- Story 004: Keyboard Operability & Navigation

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

**[For Logic / Integration stories — automated test specs]:**

- **AC-1**: Click Precision - Valid
  - Given: `click_tolerance_px=6`, pointerdown at `(300,150)`
  - When: pointerup at `(303,152)` within `max_click_hold_ms`
  - Then: `isValidClick` returns `true`
  - Edge cases: Exactly 6px distance, exact `max_click_hold_ms` time limit.

- **AC-2**: Click Precision - Invalid (Drag)
  - Given: `click_tolerance_px=6`, pointerdown at `(300,150)`
  - When: pointerup at `(320,170)` within `max_click_hold_ms`
  - Then: `isValidClick` returns `false`
  - Edge cases: Holding longer than `max_click_hold_ms`.

- **AC-3**: Select Unit from Idle
  - Given: System is in `Idle` state
  - When: A valid click occurs on a friendly acting-eligible unit
  - Then: State transitions to `UnitSelected` for that unit, emits `select` event.
  - Edge cases: Unit has no actions left (enters `Inspect`, not `UnitSelected`).

- **AC-4**: Deselect Unit
  - Given: System is in `UnitSelected` state for Unit A
  - When: A valid click occurs on Unit A
  - Then: State transitions to `Idle`, emits `cancel`/`deselect` event.

- **AC-5**: Switch Selection
  - Given: System is in `UnitSelected` state for Unit A
  - When: A valid click occurs on friendly acting-eligible Unit B
  - Then: State transitions directly to `UnitSelected` for Unit B.

- **AC-6**: Cancel Targeting
  - Given: System is in `Targeting` mode
  - When: `Escape` key is pressed or right-click
  - Then: State returns to `UnitSelected`, emits `cancel`, board state untouched.

- **AC-7**: Commit Action
  - Given: System is in `Targeting` mode with a hovered legal target tile
  - When: A valid click occurs on that tile
  - Then: Emits `confirm` event, transitions to `Locked` state.

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `tests/unit/input-selection/input_selection_selection_state_machine_test.ts` OR playtest doc

**Status**: [x] Created and passing (2026-07-28)

---

## Dependencies

- Depends on: Story 001
- Unlocks: Story 003, Story 004

---

## Completion Notes
**Completed**: 2026-07-28
**Criteria**: all passing — verified by the test at `tests/unit/input-selection/input_selection_selection_state_machine_test.ts`
**Deviations**: see `docs/tech-debt-register.md` for sprint-level advisories
**Test Evidence**: `tests/unit/input-selection/input_selection_selection_state_machine_test.ts` (exists, passes; suite 285/285, tsc clean, coverage 98.9%)
**Code Review**: Pending — `/code-review` to be run before sprint close-out
