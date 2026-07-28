# Story 001: Core Dry-Run Mechanism

> **Epic**: Move Preview
> **Status**: Complete
> **Layer**: Core
> **Type**: Logic
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-28
## Context

**GDD**: `design/gdd/move-preview.md`
**Requirement**: `TR-PREVIEW-001`, `TR-PREVIEW-005`, `TR-PREVIEW-006`

**ADR Governing Implementation**: ADR-0007: Snapshot-based undo & preview reuse one simulation
**ADR Decision Summary**: Both in-phase undo and pre-commit Move Preview are built on a single mechanism — `Board.snapshot()` — feeding the single simulation `Combat.resolve()`.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None

**Control Manifest Rules (this layer)**:
- Required: Move Preview must reuse the identical `resolve()` entry point over a disposable snapshot
- Required: Expected gameplay rejections must return a value-typed `Result`
- Forbidden: Preview dry-run events must never be published onto the shared event stream

---

## Acceptance Criteria

*From GDD `design/gdd/move-preview.md`, scoped to this story:*

- [ ] Dry-runs the identical Combat resolve() entry point over board.snapshot(); Preview-Commit Parity Invariant holds unconditionally.
- [ ] Gameplay rejections must be observable as values so a dry-run over a snapshot never throws for a merely-illegal move.
- [ ] Preview never pushes to the undo stack; the disposable preview board is discarded after read.

---

## Implementation Notes

*Derived from ADR-0007, ADR-0006, ADR-0005 Implementation Guidelines:*

- Use `Board.snapshot()` to create a disposable board.
- Call `CombatResolution.resolve(previewBoard, candidateEffects)`.
- Never push the preview snapshot to the undo stack.
- Handle `Result` values from rejections gracefully without throwing, returning an empty or failed preview consequence rather than crashing.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 002: Subscription to hover/select events and preview timing.
- Story 003: Threat overlay unions.

---

## QA Test Cases

*Test cases not yet defined — run /qa-plan to generate them.*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/move-preview/dry-run-mechanism_test.ts` — must exist and pass

**Status**: [x] Created and passing (2026-07-28)

---

## Dependencies

- Depends on: None
- Unlocks: Story 002

---

## Completion Notes
**Completed**: 2026-07-28
**Criteria**: all passing — verified by the test at `tests/unit/move-preview/dry-run-mechanism_test.ts`
**Deviations**: see `docs/tech-debt-register.md` for sprint-level advisories
**Test Evidence**: `tests/unit/move-preview/dry-run-mechanism_test.ts` (exists, passes; suite 285/285, tsc clean, coverage 98.9%)
**Code Review**: Pending — `/code-review` to be run before sprint close-out
