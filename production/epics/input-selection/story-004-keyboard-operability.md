# Story 004: Keyboard Operability & Navigation

> **Epic**: Input & Selection
> **Status**: Ready
> **Layer**: Core
> **Type**: UI
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 

## Context

**GDD**: `design/gdd/input-and-selection.md`
**Requirement**: `TR-INPUT-005`

**ADR Governing Implementation**: ADR: N/A — Presentation/Input accessibility feature
**ADR Decision Summary**: Presentation and interaction feature to guarantee accessibility through keyboard navigation.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None

**Control Manifest Rules (this layer)**:
- Required: Deterministic `index(c, r) = r * W + c` must be defined once and used everywhere.

---

## Acceptance Criteria

*From GDD `design/gdd/input-and-selection.md`, scoped to this story:*

- [ ] GIVEN the game in `Idle` with ≥1 acting-eligible unit, WHEN the player presses `Tab` repeatedly with no mouse input at all, THEN the keyboard focus visits every acting-eligible unit exactly once per full cycle, in the deterministic order of Formula 5.
- [ ] GIVEN a unit is keyboard-selected, WHEN the player uses arrow keys to move the tile cursor and presses `Enter` on a legal target tile, THEN the action commits identically to a mouse click on that tile.
- [ ] GIVEN the keyboard cursor at an edge tile, WHEN an arrow key would step it off-board, THEN the cursor does not move (Formula 4) and no error state occurs.
- [ ] GIVEN a full Player Phase (select every eligible unit, choose and commit one action each), WHEN performed with keyboard input only (no mouse events), THEN the phase completes to `EndCheck` exactly as a mouse-driven Player Phase would.

---

## Implementation Notes

*Derived from ADR-NNNN Implementation Guidelines:*

Use `keyboardStep(cursor, dir) = Board.step(cursor, dir)` if `Board.inBounds(result)`, else `cursor` unchanged.
Use deterministic unit cycle order: `cycleOrder = sort({ acting-eligible friendly units }, by = Board.index(unit.tile) ascending)`. `Tab` moves to next, `Shift+Tab` to previous.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 002: Core Selection State Machine (mouse inputs)

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

**[For Visual/Feel / UI stories — manual verification steps]:**

- **AC-1**: Tab Targeting Order
  - Setup: Start a battle with multiple units on the board in `Idle` state.
  - Verify: Press `Tab` repeatedly.
  - Pass condition: Focus cycles through all acting-eligible units in deterministic order (top-to-bottom, left-to-right) and loops.

- **AC-2**: Keyboard Targeting & Commit
  - Setup: Unit is keyboard-selected.
  - Verify: Move cursor with arrow keys to a legal target tile and press `Enter`.
  - Pass condition: The action commits successfully just like a mouse click.

- **AC-3**: Keyboard Edge Constraints
  - Setup: Move cursor to the edge of the board.
  - Verify: Press arrow key in the direction of the edge.
  - Pass condition: Cursor remains on the edge tile; does not wrap around or crash.

- **AC-4**: Full Keyboard Turn
  - Setup: Start a player phase.
  - Verify: Complete a full player phase using only the keyboard.
  - Pass condition: The phase resolves exactly as if a mouse was used.

---

## Test Evidence

**Story Type**: UI
**Required evidence**:
- UI: `production/qa/evidence/keyboard-operability-evidence.md` or interaction test

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 002
- Unlocks: None
