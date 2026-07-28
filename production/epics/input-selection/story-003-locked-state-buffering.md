# Story 003: Locked State & Input Buffering

> **Epic**: Input & Selection
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 

## Context

**GDD**: `design/gdd/input-and-selection.md`
**Requirement**: `TR-INPUT-003`

**ADR Governing Implementation**: ADR: N/A — pure logic implementation for state machine gating
**ADR Decision Summary**: Pure state machine logic for locked states and buffering.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None

**Control Manifest Rules (this layer)**:
- Required: Genuine programmer errors must fail-fast and assert/throw loudly.

---

## Acceptance Criteria

*From GDD `design/gdd/input-and-selection.md`, scoped to this story:*

- [ ] GIVEN `Locked` and `input_buffer_depth=1`, WHEN the player clicks a tile, THEN the click is stored (not acted on) and no Board mutation occurs during `Locked`.
- [ ] GIVEN a buffered click exists and the game unlocks, WHEN the buffered target is re-validated and found still legal, THEN it is handled exactly as if clicked in real time.
- [ ] GIVEN a buffered click exists and the game unlocks, WHEN the buffered target is re-validated and found no longer legal (e.g. target unit removed), THEN it is rejected (with the rejection cue) and no action is taken.
- [ ] GIVEN `input_buffer_depth=0` and `Locked`, WHEN the player clicks, THEN the click is rejected immediately with a visible cue, and nothing is buffered.
- [ ] GIVEN the current phase is not `PlayerPhase` (per Turn & Phase Manager), WHEN any click or key commit is attempted, THEN the system is in `Locked` and Formula 6's buffering rule applies — no direct commit occurs.

---

## Implementation Notes

*Derived from ADR-NNNN Implementation Guidelines:*

Input & Selection enters Locked whenever either: (a) current phase is not `PlayerPhase`, or (b) `isAnimating()` returns `true`. While Locked, pointer/keyboard commit attempts are captured per `input_buffer_depth` but not acted on.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 004: Keyboard Operability & Navigation

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

**[For Logic / Integration stories — automated test specs]:**

- **AC-1**: Buffer Click during Locked State
  - Given: System is in `Locked` state and `input_buffer_depth=1`
  - When: Player clicks a tile
  - Then: Click is buffered, no commit/action occurs.

- **AC-2**: Process Buffered Click - Legal
  - Given: A click is buffered
  - When: System unlocks and the buffered target is still legal
  - Then: The click is processed, committing the action.

- **AC-3**: Process Buffered Click - Illegal
  - Given: A click is buffered
  - When: System unlocks but the target is no longer legal
  - Then: Click is rejected, rejection cue triggered.

- **AC-4**: Reject Click when Buffer is 0
  - Given: `input_buffer_depth=0` and system is `Locked`
  - When: Player clicks
  - Then: Click is immediately rejected, not buffered.

- **AC-5**: Non-Player Phase Lock
  - Given: Turn & Phase Manager reports a phase other than `PlayerPhase`
  - When: Any click occurs
  - Then: The system is treated as `Locked`.

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/input-selection/locked-buffering_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 002
- Unlocks: None
