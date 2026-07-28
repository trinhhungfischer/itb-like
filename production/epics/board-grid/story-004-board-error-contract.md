# Story 004: Board Error Contract

> **Epic**: Board & Grid
> **Status**: Complete
> **Layer**: Foundation
> **Type**: Logic
> **Estimate**: 2h
> **Manifest Version**: 2026-07-28
P26-07-28

## Context

**GDD**: `design/gdd/board-and-grid.md`
**Requirement**: `TR-BOARD-004`

**ADR Governing Implementation**: ADR-0005: Board/Combat error contract (Result vs throw)
**ADR Decision Summary**: Expected gameplay rejections return a Result; genuine programmer errors fail-fast and assert/throw loudly.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None

**Control Manifest Rules (this layer)**:
- Required: Expected gameplay rejections must return a value-typed `Result`. Genuine programmer errors must fail-fast and assert/throw loudly.
- Forbidden: Expected gameplay rejections must never throw.

---

## Acceptance Criteria

*From GDD `design/gdd/board-and-grid.md`, scoped to this story:*

- [ ] GIVEN a tile occupied by A, WHEN place(B), THEN rejected (returns Result error), occupant stays A, state uncorrupted.
- [ ] GIVEN tilesInRange or neighbors is called with an out-of-bounds origin, THEN rejected (assert).
- [ ] GIVEN any query is called with negative coordinates or W<1/H<1 upon construction, THEN rejected (assert).

---

## Implementation Notes

*Derived from ADR-0005 Implementation Guidelines:*

Implement a value-typed `Result` (e.g., `{ success: true } | { success: false, reason: string }`) for the board mutations. `place()` on an occupied tile should return a failure result. Ensure that `inBounds` or other argument validation functions `throw` or use `console.assert` when called with non-sensical data (e.g., a negative coordinate for a query origin).

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 005: Mutations
- Story 001: Pure queries

---

## QA Test Cases

*Test cases not yet defined — run /qa-plan to generate them.*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/board-and-grid/board-error-contract_test.ts` — must exist and pass

**Status**: [x] Created and passing (2026-07-28)

---

## Dependencies

- Depends on: Story 001
- Unlocks: Story 005

---

## Completion Notes
**Completed**: 2026-07-28
**Criteria**: all passing — verified by the test at `tests/unit/board-and-grid/board-error-contract_test.ts`
**Deviations**: see `docs/tech-debt-register.md` for sprint-level advisories
**Test Evidence**: `tests/unit/board-and-grid/board-error-contract_test.ts` (exists, passes; suite 285/285, tsc clean, coverage 98.9%)
**Code Review**: Pending — `/code-review` to be run before sprint close-out
