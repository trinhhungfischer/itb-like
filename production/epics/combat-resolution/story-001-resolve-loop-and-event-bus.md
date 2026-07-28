# Story 001: Resolve Loop and Event Bus

> **Epic**: combat-resolution
> **Status**: Complete
> **Layer**: Core
> **Type**: Logic
> **Estimate**:
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-28
## Context

**GDD**: `design/gdd/combat-resolution.md`
**Requirement**: `TR-COMBAT-001`, `TR-COMBAT-003`, `TR-COMBAT-004`, `TR-COMBAT-009`

**ADR Governing Implementation**: ADR-0006: Combat `resolve()` as the single board-mutation path + 10-primitive vocabulary
**ADR Decision Summary**: Combat Resolution's `resolve(board, effects[]) → events[]` is the single, exclusive path that mutates board state, and it does so through a closed vocabulary of 10 primitives.

**Secondary ADRs**: ADR-0005, ADR-0002

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: Pure TypeScript, no engine dependencies.

**Control Manifest Rules (this layer)**:
- Required: All board mutation must flow exclusively through Combat `resolve()`. Effects must apply strictly sequentially in list order.
- Forbidden: Combat never calls back into Turn & Phase Manager. Target-locking must never use a live spatial query resolved mid-chain.
- Guardrail: Board cost/frame < 2 ms.

---

## Acceptance Criteria

*From GDD `design/gdd/combat-resolution.md`, scoped to this story:*

- [ ] **GIVEN** an empty `effects[]` list, **WHEN** `resolve(board, [])`, **THEN** it returns an empty event log and the board is unchanged.
- [ ] **GIVEN** an `effects[]` list of length `n`, **WHEN** `resolve()` runs, **THEN** effect `i` is applied to the board state left by effect `i−1`, for every `i` from 1 to `n`.
- [ ] **GIVEN** identical `(board, effects)` inputs run twice on freshly-constructed identical boards, **THEN** both produce byte-identical resulting board state and identical event logs (determinism smoke test, ≥100 runs).
- [ ] **GIVEN** an ability's effect chain is empty (`effects = []`), **WHEN** `resolve()` runs, **THEN** it returns an empty event log; legal no-op.

---

## Implementation Notes

*Derived from ADR-0006 Implementation Guidelines:*

- Expose a single `resolve(board: Board, effects: EffectPrimitive[]): Event[]` function.
- Process effects sequentially in a loop.
- Emit events using the canonical event vocabulary.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 002: Unit Lifecycle primitives (Damage, Spawn, Remove)
- Story 003: Displacement primitives

---

## QA Test Cases

*Test cases not yet defined — run /qa-plan to generate them.*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/combat-resolution/resolve-loop-and-event-bus_test.ts` — must exist and pass

**Status**: [x] Created and passing (2026-07-28)

---

## Dependencies

- Depends on: None
- Unlocks: Story 002, Story 003, Story 004, Story 005

---

## Completion Notes
**Completed**: 2026-07-28
**Criteria**: all passing — verified by the test at `tests/unit/combat-resolution/resolve-loop-and-event-bus_test.ts`
**Deviations**: see `docs/tech-debt-register.md` for sprint-level advisories
**Test Evidence**: `tests/unit/combat-resolution/resolve-loop-and-event-bus_test.ts` (exists, passes; suite 285/285, tsc clean, coverage 98.9%)
**Code Review**: Pending — `/code-review` to be run before sprint close-out
