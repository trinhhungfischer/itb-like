# Story 005: Resolution Execution & Range Gate

> **Epic**: Enemy, Abilities & Telegraph
> **Status**: Ready
> **Layer**: Feature
> **Type**: Logic
> **Estimate**:
> **Manifest Version**: 2026-07-28
> **Last Updated**:

## Context

**GDD**: `design/gdd/enemy-abilities-and-telegraph.md`
**Requirement**: `TR-ENEMY-001`

**ADR Governing Implementation**: ADR-0006: Combat `resolve()` as the single board-mutation path + 10-primitive vocabulary
**ADR Decision Summary**: Combat Resolution's `resolve()` is the exclusive path that mutates board state.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: 

**Control Manifest Rules (this layer)**:
- Required: All board mutation must flow exclusively through Combat `resolve()`
- Forbidden: Combat never calls back into Turn & Phase Manager

---

## Acceptance Criteria

*From GDD `design/gdd/enemy-abilities-and-telegraph.md`, scoped to this story:*

- [ ] **GIVEN** a telegraphed effect tile whose original occupant moved away before Resolve, **WHEN** `resolveTelegraphed()` runs, **THEN** the ability's chain resolves against that tile with no unit hit (documented no-op), and no error occurs.
- [ ] **GIVEN** a telegraphed effect tile whose occupant changed to a different unit (e.g. a hero swap), **WHEN** `resolveTelegraphed()` runs, **THEN** the effect applies to the new occupant by ID, not the originally-observed unit.
- [ ] **GIVEN** the Formula F5 worked example (Wall blocks the enemy's path), **WHEN** `resolveTelegraphed()` runs, **THEN** the enemy moves to `(6,5)`, no damage/push/etc. primitive is applied, and an `enemy_action_whiffed` event is emitted.
- [ ] **GIVEN** an enemy removed earlier this turn, **WHEN** its `resolveTelegraphed()` slot is reached, **THEN** it is skipped with no event beyond the earlier removal's own events.
- [ ] **GIVEN** an enemy's AoE tile set contains both a hero and a second enemy, **WHEN** the ability resolves, **THEN** both units take the ability's effect identically — no faction filtering occurs.

---

## Implementation Notes

*Derived from ADR-0006 Implementation Guidelines:*

Enemy actions compile to `EffectPrimitive[]` using the same `AbilityDefinition` schema as heroes.
Implement Formula F5 (range gate). If it fails, emit `enemy_action_whiffed` and skip the attack (but still process movement).
Ensure friendly fire is active by default; do not filter enemy targets from AoEs.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 006: On-death reactive effects

---

## QA Test Cases

*Test cases to implement:*
- Original target moves away -> effect applied on tile without unit (no-op).
- New occupant in target tile -> effect applied to new occupant.
- Range gate F5 (Wall blocks path) -> enemy moves but skips attack, emits whiff event.
- Dead enemies are correctly skipped without side effects.
- Friendly fire applies to enemies inside AoEs without filtering.

*Edge Cases:*
- Dead enemies attempting to resolve.
- Target swapped before resolution.

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/enemy-abilities-and-telegraph/resolution-execution_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 004
- Unlocks: Story 006
