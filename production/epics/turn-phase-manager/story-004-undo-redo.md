# Story 004: In-Phase Undo/Redo

> **Epic**: Turn & Phase Manager
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Integration
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 

## Context

**GDD**: `design/gdd/turn-and-phase-manager.md`
**Requirement**: `TR-TURN-002`, `TR-TURN-008`

**ADR Governing Implementation**: ADR-0007: Snapshot-based undo & preview reuse one simulation, ADR-0001: Board tile-state representation
**ADR Decision Summary**: Both in-phase undo and pre-commit Move Preview are built on a single mechanism — `Board.snapshot()`.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: 

**Control Manifest Rules (this layer)**:
- Required: Board's internal data representation must be cheap by construction for `snapshot()`
- Forbidden: Never implement `snapshot()` as a naive object-graph deep clone
- Guardrail: `snapshot()` full deep-copy (≤ 12×12) < 1 ms/call

---

## Acceptance Criteria

*From GDD `design/gdd/turn-and-phase-manager.md`, scoped to this story:*

- [ ] In-phase undo/redo implemented by adopting a prior Board snapshot() as the live board (no board-owned restore()); snapshot captured at Player-Phase start and after each action's full consequence chain (incl. on-death spawnUnit); stack cleared on Commit, bounding memory to one phase (~74 KB on 8×8).
- [ ] Undo memory bounded to one Player Phase via full-board snapshots (delta/command undo not warranted at this scale, F3).

---

## Implementation Notes

*Derived from ADR-0007 Implementation Guidelines:*

Use the board snapshot functionality to record the board state. Provide undo/redo stack that resets when the player phase is committed.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- None

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

**[For Logic / Integration stories — automated test specs]:**

- **AC-1**: Undo memory bounded
  - Given: A sequence of player actions in one phase
  - When: The phase concludes
  - Then: The undo stack clears and memory is freed.
  - Edge cases: Maxing out undo stack or zero actions.

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `tests/integration/turn-phase-manager/undo-redo_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 003
- Unlocks: None
