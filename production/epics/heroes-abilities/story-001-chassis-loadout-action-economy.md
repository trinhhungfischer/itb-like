# Story 001: Chassis, Loadout, and Action Economy

> **Epic**: Heroes & Abilities
> **Status**: Complete
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-29

## Context

**GDD**: `design/gdd/heroes-and-abilities.md`
**Requirement**: `TR-HERO-001`, `TR-HERO-005`, `TR-HERO-007`

**ADR Governing Implementation**: ADR-0008: Shared Unit record schema
**ADR Decision Summary**: Defines a canonical Unit record owned by Heroes & Abilities to prevent schema drift across systems.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None

**Control Manifest Rules (this layer)**:
- Required: Shared Unit Record interfaces must be used where applicable
- Forbidden: None
- Guardrail: None

---

## Acceptance Criteria

*From GDD `design/gdd/heroes-and-abilities.md`, scoped to this story:*

- [ ] GIVEN a `HeroDefinition` with `maxHP≥1` and `moveRange≥0`, WHEN constructed, THEN `size===1` always, regardless of any input (structurally fixed, not settable).
- [ ] GIVEN a Loadout construction request with `squad_size=3` and 3 distinct `HeroDefinition`s, WHEN validated, THEN it succeeds.
- [ ] GIVEN a Loadout construction request containing two copies of the same `HeroDefinition.id`, WHEN validated, THEN it is rejected (duplicate-hero invariant, Rule 5).
- [ ] GIVEN a Loadout construction request with fewer or more than `squad_size` heroes, WHEN validated, THEN it is rejected.
- [ ] GIVEN a living hero at Player-Phase start, THEN both Move and Ability slots read `Available`.
- [ ] GIVEN a hero uses its Move slot, THEN Move reads `Used` and Ability remains `Available` (slots are independent).
- [ ] GIVEN a hero has used both slots, WHEN a third action is attempted by that hero this Player Phase, THEN it is rejected.
- [ ] GIVEN `squad_size=3`, THEN `maxActionsPerPhase = 6` (F4); GIVEN `squad_size=5`, THEN `maxActionsPerPhase = 10`.
- [ ] GIVEN a `Removed` hero, WHEN any action is requested from it, THEN rejected — zero slots ever offered (Rule 4, Edge Cases).
- [ ] GIVEN a hero with `hp=5` (chassis `maxHP=5`) takes `damage(unit, 7)` via Combat Resolution, THEN the hero is `Removed(Defeated)` and, per Rule 4/Edge Cases, is never offered an action again this battle.
- [ ] GIVEN a hero pushed/pulled onto Lethal terrain, THEN it is `Removed(Fell)`, identical to any other unit under Combat Resolution's vitality model — this document adds no divergent hero-specific rule.

---

## Implementation Notes

*Derived from ADR-0008 Implementation Guidelines:*

Implement the `Unit` and `HeroDefinition` records. Use the `Shared Unit Record` schema. Track HP and action slots (Move, Ability) per living hero. Enforce exactly `squad_size` distinct heroes per loadout.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 002: Legal Move Selection

---

## QA Test Cases

**Test file path**: `tests/unit/heroes-abilities/story-001-chassis-loadout-action-economy_test.ts`
**What to test**:
- Hero chassis size is structurally fixed at 1.
- Loadout construction with exactly `squad_size` distinct heroes succeeds.
- Duplicate heroes in Loadout are rejected.
- Loadout with incorrect number of heroes is rejected.
- Move and Ability slots are `Available` at Player-Phase start.
- Move slot becomes `Used` independently of Ability slot.
- Third action is rejected.
- Removed heroes (0 HP or Lethal terrain) are never offered actions.

**Edge cases to cover**:
- Zero `moveRange` heroes.
- Removed heroes attempting actions.
- Max HP damage logic.

**Estimated test count**: ~11 unit tests

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/heroes-abilities/chassis-loadout_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None
- Unlocks: Story 002

## Completion Notes
**Completed**: 2026-07-29
**Criteria**: 11/11 passing
**Deviations**: None
**Test Evidence**: Logic: test file at tests/unit/heroes-abilities/chassis-loadout_test.ts
**Code Review**: Complete
