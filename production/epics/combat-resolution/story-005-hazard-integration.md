# Story 005: Hazard Integration

> **Epic**: combat-resolution
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Estimate**:
> **Manifest Version**: 2026-07-28
> **Last Updated**:

## Context

**GDD**: `design/gdd/combat-resolution.md`
**Requirement**: `TR-COMBAT-002`, `TR-COMBAT-006`

**ADR Governing Implementation**: ADR-0006: Combat `resolve()` as the single board-mutation path + 10-primitive vocabulary
**ADR Decision Summary**: Combat Resolution's `resolve(board, effects[]) → events[]` is the single, exclusive path that mutates board state, and it does so through a closed vocabulary of 10 primitives.

**Secondary ADRs**: ADR-0008

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: Pure TypeScript, no engine dependencies.

**Control Manifest Rules (this layer)**:
- Required: All board mutation must flow exclusively through Combat `resolve()`.
- Forbidden: Target-locking must never use a live spatial query resolved mid-chain.
- Guardrail: Board cost/frame < 2 ms.

---

## Acceptance Criteria

*From GDD `design/gdd/combat-resolution.md`, scoped to this story:*

- [ ] **GIVEN** an unhazarded tile, **WHEN** `spawnHazard(tile, Fire, duration=3)`, **THEN** `getHazard(tile) == Fire` and the tile's current occupant (if any) takes **no** damage as a direct result of this call alone.
- [ ] **GIVEN** a hazarded tile and a call to `applyHazard(tile)` immediately after `spawnHazard` in the same chain, **THEN** the occupant takes `fire_damage_per_tick` damage — proving the two-primitive composition works.
- [ ] **GIVEN** `applyHazard` on a tile with no hazard, **THEN** no-op.
- [ ] **GIVEN** a finite-duration hazard, **WHEN** `applyHazard` fires on its tile, **THEN** duration decrements; if duration reaches 0, the hazard is cleared.
- [ ] **GIVEN** a push lands a unit on a hazarded `Clear` tile with no further obstacle, **WHEN** resolved, **THEN** hazard-on-entry fires exactly once for that tile.
- [ ] **GIVEN** a swap lands a unit on a hazarded tile, **WHEN** resolved, **THEN** hazard-on-entry fires independently for each unit that landed on a hazarded destination.
- [ ] **GIVEN** a hazarded `Clear` tile, **WHEN** `spawnUnit(tile, unitSpec)` resolves, **THEN** the new unit is **not** damaged by the existing hazard as a direct consequence of spawning.

---

## Implementation Notes

*Derived from ADR-0006 Implementation Guidelines:*

- Implement `spawnHazard` and `applyHazard` primitives.
- Add hazard-on-entry logic inside `push`, `pull`, and `swap` resolution.
- Ensure immunity check (`hazardImmunities`) from Unit Record is applied for all `applyHazard` invocations.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Initial implementations of displacement and swap

---

## QA Test Cases

*Test cases not yet defined — run /qa-plan to generate them.*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/combat-resolution/hazard-integration_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 002, Story 003, Story 004
- Unlocks: None
