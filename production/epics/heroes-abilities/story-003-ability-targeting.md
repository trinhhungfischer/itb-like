# Story 003: Ability Targeting Geometry

> **Epic**: Heroes & Abilities
> **Status**: Complete
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-29

## Context

**GDD**: `design/gdd/heroes-and-abilities.md`
**Requirement**: `TR-HERO-002`, `TR-HERO-006`

**ADR Governing Implementation**: ADR-0006: Combat `resolve()` as the single board-mutation path
**ADR Decision Summary**: Establishes the 10-primitive vocabulary.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None

**Control Manifest Rules (this layer)**:
- Required: All board mutation must flow exclusively through Combat `resolve()`
- Forbidden: Never add an 11th primitive
- Guardrail: None

---

## Acceptance Criteria

*From GDD `design/gdd/heroes-and-abilities.md`, scoped to this story:*

- [ ] GIVEN Vanguard adjacent to exactly one enemy (Shove: UnitTarget, range 1, filter Enemy), THEN `legalTargets == {that enemy}`.
- [ ] GIVEN the same setup but the adjacent unit is an ally, THEN `legalTargets == ∅` (filter excludes it) and the Ability slot is unavailable.
- [ ] GIVEN Warden (Anchor Pull: range 4, `requiresOrthogonalAlignment`) with one enemy same-column at distance 4 and another enemy off-axis at distance 3, THEN `legalTargets` contains only the same-column enemy.
- [ ] GIVEN Striker (Line, range 4) with a wall 2 tiles away in the chosen direction, THEN `rayTiles` returns exactly the 2 tiles before the wall, never the wall tile itself.
- [ ] GIVEN a `Line` direction whose first step is `OutOfBounds`, THEN that direction is excluded from the legal-direction set entirely (not merely "resolves to nothing").
- [ ] GIVEN an ability with `targetFilter=AnyUnit` and a `push` effect template, WHEN its target is an ally, THEN it compiles and resolves exactly as it would against an enemy (no special-casing).
- [ ] GIVEN Twinblade's Blink Swap (`targetFilter=Ally, excludes self`), THEN the caster's own tile is never a member of `legalTargets`, regardless of range.

---

## Implementation Notes

*Derived from ADR-0006 Implementation Guidelines:*

Implement `legalTargets` computation using the 5 shape types (Self, SingleTile, UnitTarget, Line, Area). Apply `targetFilter` correctly (Ally, Enemy, AnyUnit, EmptyTile, AnyTile). Validate `requiresOrthogonalAlignment` correctly for push/pull.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 004: Effect Compilation and Preview Integration

---

## QA Test Cases

**Test file path**: `tests/unit/heroes-abilities/story-003-ability-targeting_test.ts`
**What to test**:
- `legalTargets` computation correctly identifies valid unit targets using shape (`UnitTarget`, `Line`, etc).
- `targetFilter` successfully includes/excludes targets (Ally, Enemy, AnyUnit).
- `requiresOrthogonalAlignment` correctly filters orthogonal targets.
- `rayTiles` logic correctly filters tiles based on bounds and blocked tiles.

**Edge cases to cover**:
- Zero legal targets for an ability.
- Line shape direction whose first step is `OutOfBounds`.
- Blink Swap targeting self is excluded.
- Area origin selection vs area effect filtering.

**Estimated test count**: ~8 unit tests

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/heroes-abilities/ability-targeting_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 002
- Unlocks: Story 004

## Completion Notes
**Completed**: 2026-07-29
**Criteria**: 7/7 passing
**Deviations**: None
**Test Evidence**: Logic: tests/unit/heroes-abilities/story-003-ability-targeting_test.ts
**Code Review**: Complete (Approved)
