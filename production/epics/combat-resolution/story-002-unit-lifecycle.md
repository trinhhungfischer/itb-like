# Story 002: Unit Lifecycle - Damage, Remove, Spawn

> **Epic**: combat-resolution
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Estimate**:
> **Manifest Version**: 2026-07-28
> **Last Updated**:

## Context

**GDD**: `design/gdd/combat-resolution.md`
**Requirement**: `TR-COMBAT-002`, `TR-COMBAT-005`, `TR-COMBAT-007`

**ADR Governing Implementation**: ADR-0006: Combat `resolve()` as the single board-mutation path + 10-primitive vocabulary
**ADR Decision Summary**: Combat Resolution's `resolve(board, effects[]) → events[]` is the single, exclusive path that mutates board state, and it does so through a closed vocabulary of 10 primitives.

**Secondary ADRs**: ADR-0005, ADR-0008

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: Pure TypeScript, no engine dependencies.

**Control Manifest Rules (this layer)**:
- Required: Expected gameplay rejections must return a value-typed `Result`. Genuine programmer errors must fail-fast and assert/throw loudly.
- Forbidden: Expected gameplay rejections must never throw. Never swallow a Channel-2 throw inside the sim path.
- Guardrail: Board cost/frame < 2 ms.

---

## Acceptance Criteria

*From GDD `design/gdd/combat-resolution.md`, scoped to this story:*

- [ ] **GIVEN** a unit with `hp=5`, **WHEN** `damage(unit, 7)`, **THEN** `hp'=0`, `DamageApplied(unit, 7, 0)` is emitted, and `UnitRemoved(unit, Defeated)` is also emitted in the same `resolve()` call.
- [ ] **GIVEN** a unit with `hp=10`, **WHEN** `damage(unit, 3)`, **THEN** `hp'=7` and no removal event fires.
- [ ] **GIVEN** `amount < 0` is constructed, **WHEN** validated, **THEN** it is rejected before `resolve()` accepts the effect list (contract violation, not a runtime no-op).
- [ ] **GIVEN** an empty `Clear` tile, **WHEN** `spawnUnit(tile, unitSpec)`, **THEN** a new unit occupying `tile` exists on the board in the `Alive` state, and `UnitSpawned(unitId, tile, unitSpec)` is emitted exactly once.
- [ ] **GIVEN** a tile that is `Occupied`, `Blocked`, `Lethal`, or `OutOfBounds`, **WHEN** `spawnUnit(tile, unitSpec)` is attempted, **THEN** the call is rejected as a no-op — no unit is created and no `UnitSpawned` event fires.
- [ ] **GIVEN** a unit on the board, **WHEN** `removeUnit(unit, Defeated)`, **THEN** its tile becomes empty and `UnitRemoved(unit, Defeated, tile)` fires exactly once.
- [ ] **GIVEN** a unit already removed, **WHEN** `removeUnit` is called on it again (same or different cause), **THEN** no-op — no second `UnitRemoved` event.

---

## Implementation Notes

*Derived from ADR-0006 Implementation Guidelines:*

- Implement `damage`, `removeUnit`, `spawnUnit` primitives inside `resolve()`.
- HP reduction logic (F1) and defeat trigger.
- Assert/throw for negative damage.
- `spawnUnit` and `removeUnit` interact directly with Board's `place` and `clear` mutations.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 005: Hazard damage triggers

---

## QA Test Cases

*Test cases not yet defined — run /qa-plan to generate them.*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/combat-resolution/unit-lifecycle_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001
- Unlocks: None
