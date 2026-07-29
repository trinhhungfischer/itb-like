# Story 001: Core System Contracts & Deterministic Order

> **Epic**: Enemy, Abilities & Telegraph
> **Status**: Complete
> **Layer**: Feature
> **Type**: Logic
> **Estimate**:
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-29

## Context

**GDD**: `design/gdd/enemy-abilities-and-telegraph.md`
**Requirement**: `TR-ENEMY-008`, `TR-ENEMY-002`

**ADR Governing Implementation**: ADR-0006: Combat `resolve()` as the single board-mutation path + 10-primitive vocabulary
**ADR Decision Summary**: Combat Resolution's `resolve(board, effects[]) → events[]` is the single, exclusive path that mutates board state, and it does so through a closed vocabulary of 10 primitives.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: Pure TypeScript structure; no DOM or PixiJS dependencies in logic.

**Control Manifest Rules (this layer)**:
- Required: Variety must live entirely in a pre-battle, reproducible meta layer
- Forbidden: Encounter Generator MUST NOT call any Difficulty Tiers or Run Structure symbol
- Guardrail: N/A

---

## Acceptance Criteria

*From GDD `design/gdd/enemy-abilities-and-telegraph.md`, scoped to this story:*

- [x] **GIVEN** the system's public interface, **THEN** it exposes exactly `chooseIntents()`, `resolveTelegraphed()`, `emergeSpawns()`, and no method that mutates board occupancy/terrain/hazard directly (all mutation is via `Combat.resolve()`).
- [x] **GIVEN** enemies with `unitId` 4, 7, 2 alive, **WHEN** `chooseIntents()` or `resolveTelegraphed()` runs, **THEN** processing order is exactly 2, 4, 7.
- [x] **GIVEN** two enemies whose resolved pushes both target the same destination tile, **WHEN** `resolveTelegraphed()` runs, **THEN** the lower-`unitId` enemy's push resolves first and claims the tile, verified by swapping which enemy has the lower ID and observing the outcome change accordingly.

---

## Implementation Notes

*Derived from ADR-0006 Implementation Guidelines:*

Implement the three required entry points: `chooseIntents`, `resolveTelegraphed`, and `emergeSpawns`.
Ensure these are the only ways the system interacts with Combat.
Order operations purely by ascending `unitId`.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 002: Target selection AI specifics
- Story 003: Movement pathing

---

## QA Test Cases

*Test cases to implement:*
- Verify system public interface is limited to `chooseIntents()`, `resolveTelegraphed()`, `emergeSpawns()`.
- Verify `chooseIntents()` and `resolveTelegraphed()` process enemies strictly by ascending `unitId`.
- Verify simultaneous push resolution prioritizes lower `unitId`.

*Edge Cases:*
- Out-of-order IDs at spawn (e.g. 4, 7, 2).
- Two enemies pushing into the identical tile at the same time.

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/enemy-abilities-and-telegraph/core-system-contracts_test.ts` — must exist and pass

**Status**: [x] Created and passes

---

## Dependencies

- Depends on: None
- Unlocks: Story 002

## Completion Notes
**Completed**: 2026-07-29
**Criteria**: 3/3 passing
**Deviations**: None
**Test Evidence**: Logic: test file at tests/unit/enemy-abilities-and-telegraph/core-system-contracts_test.ts
**Code Review**: Complete
