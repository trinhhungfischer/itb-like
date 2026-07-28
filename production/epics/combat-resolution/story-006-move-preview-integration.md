# Story 006: Move Preview Integration

> **Epic**: combat-resolution
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Estimate**:
> **Manifest Version**: 2026-07-28
> **Last Updated**:

## Context

**GDD**: `design/gdd/combat-resolution.md`
**Requirement**: `TR-COMBAT-008`

**ADR Governing Implementation**: ADR-0007: Snapshot-based undo & preview reuse one simulation
**ADR Decision Summary**: Both in-phase undo and pre-commit Move Preview are built on a single mechanism — `Board.snapshot()` — feeding the single simulation `Combat.resolve()`.

**Secondary ADRs**: ADR-0006

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: Pure TypeScript, no engine dependencies.

**Control Manifest Rules (this layer)**:
- Required: Move Preview must reuse the identical `resolve()` entry point over a disposable snapshot.
- Forbidden: Snapshot must never be captured mid-chain.
- Guardrail: Board cost/frame < 2 ms.

---

## Acceptance Criteria

*From GDD `design/gdd/combat-resolution.md`, scoped to this story:*

- [ ] **GIVEN** `resolve(board.snapshot(), effects)` is called, **THEN** the original `board` instance is unchanged after the call (Move Preview contract).

---

## Implementation Notes

*Derived from ADR-0007 Implementation Guidelines:*

- Ensure `resolve()` has no side effects outside the provided `board` object (and emitted events array).
- No hidden RNG or wall-clock dependence in `resolve()`.
- Validate that `resolve(board.snapshot())` works as expected for dry runs.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Move preview UI or interaction (handled in Input & Selection / Move Preview epics)

---

## QA Test Cases

*Test cases not yet defined — run /qa-plan to generate them.*

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `tests/integration/combat-resolution/move-preview-integration_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001, Story 002, Story 003, Story 004, Story 005
- Unlocks: None
