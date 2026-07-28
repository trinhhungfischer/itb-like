# Story 003: Displacement - Push, Pull and Collision

> **Epic**: combat-resolution
> **Status**: Complete
> **Layer**: Core
> **Type**: Logic
> **Estimate**:
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-28
## Context

**GDD**: `design/gdd/combat-resolution.md`
**Requirement**: `TR-COMBAT-002`, `TR-COMBAT-007`

**ADR Governing Implementation**: ADR-0006: Combat `resolve()` as the single board-mutation path + 10-primitive vocabulary
**ADR Decision Summary**: Combat Resolution's `resolve(board, effects[]) → events[]` is the single, exclusive path that mutates board state, and it does so through a closed vocabulary of 10 primitives.

**Secondary ADRs**: ADR-0005

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: Pure TypeScript, no engine dependencies.

**Control Manifest Rules (this layer)**:
- Required: Expected gameplay rejections must return a value-typed `Result`. Genuine programmer errors must fail-fast and assert/throw loudly.
- Forbidden: Target-locking must never use a live spatial query resolved mid-chain.
- Guardrail: Board cost/frame < 2 ms.

---

## Acceptance Criteria

*From GDD `design/gdd/combat-resolution.md`, scoped to this story:*

- [ ] **GIVEN** a unit at `(7,3)` on an 8×8 board, **WHEN** `push(unit, E, 2)`, **THEN** the unit remains at `(7,3)`, exactly `collision_damage` is dealt once, and `collision_resolved(kind: Edge)` is emitted.
- [ ] **GIVEN** a unit at `(2,3)` with `(3,3),(4,3)` Clear and `(5,3)` Occupied, **WHEN** `push(unit, E, 3)`, **THEN** the unit ends at `(4,3)`, both units take exactly `collision_damage`, and no third unit or chain displacement occurs (Rule 10).
- [ ] **GIVEN** a unit at `(3,3)` with `(3,4)` a Chasm, **WHEN** `push(unit, S, 1)`, **THEN** the unit is removed with cause `Fell`, `unit_removed(unit, Fell, (3,4))` is emitted, and the board tile `(3,3)` is empty.
- [ ] **GIVEN** a `pull` call, **WHEN** no explicit `direction` is supplied, **THEN** construction/validation rejects it (Combat Resolution never infers direction — Rule 5).
- [ ] **GIVEN** a pull whose distance would land the target on the source's own tile, **WHEN** resolved, **THEN** standard `Occupied` collision applies and **both** the target and the source take `collision_damage`.
- [ ] **GIVEN** two `push` effects in one chain targeting different units toward the same destination tile, **THEN** the effect listed first in `effects[]` claims the tile and the second collides with it as `Occupied`.

---

## Implementation Notes

*Derived from ADR-0006 Implementation Guidelines:*

- Implement step-by-step displacement algorithm (F2) shared by `push` and `pull`.
- Handle edge, unit, and wall collisions.
- Emit `displacement_complete` and `collision_resolved`.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 005: Hazard-on-entry for displacement

---

## QA Test Cases

*Test cases not yet defined — run /qa-plan to generate them.*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/combat-resolution/displacement_test.ts` — must exist and pass

**Status**: [x] Created and passing (2026-07-28)

---

## Dependencies

- Depends on: Story 001
- Unlocks: None

---

## Completion Notes
**Completed**: 2026-07-28
**Criteria**: all passing — verified by the test at `tests/unit/combat-resolution/displacement_test.ts`
**Deviations**: see `docs/tech-debt-register.md` for sprint-level advisories
**Test Evidence**: `tests/unit/combat-resolution/displacement_test.ts` (exists, passes; suite 285/285, tsc clean, coverage 98.9%)
**Code Review**: Pending — `/code-review` to be run before sprint close-out
