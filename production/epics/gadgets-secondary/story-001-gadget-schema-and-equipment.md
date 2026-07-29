# Story 001: Gadget Schema and Equipment Slots

> **Epic**: Gadgets & Secondary Weapons
> **Status**: Complete
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-29

## Completion Notes
**Completed**: 2026-07-29
**Criteria**: 3/3 passing
**Deviations**: None
**Test Evidence**: tests/unit/heroes-and-abilities/gadget-schema_test.ts
**Code Review**: Skipped

## Context

**GDD**: `design/content/secondary-weapons-and-gadgets.md`
**Requirement**: `TR-GADGET-001`, `TR-GADGET-002`

**ADR Governing Implementation**: N/A
**ADR Decision Summary**: Pure data schema definition and state adjustment, no architectural pattern required.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: 

**Control Manifest Rules (this layer)**:
- Required: Variety must live entirely in a pre-battle, reproducible meta layer.
- Forbidden: Expected gameplay rejections must never throw.

---

## Acceptance Criteria

*From GDD `design/content/secondary-weapons-and-gadgets.md`, scoped to this story:*

- [ ] Define `GadgetDefinition` schema with `cooldownTurns`, `usesPerBattle`, and `compatible` fields.
- [ ] Update `HeroRunState` / equipment structure to support 2 Equipment slots (shared with Passives).
- [ ] Enforce constraint: max 1 Gadget equipped per hero.

---

## Implementation Notes

Implement the new interface definitions in the core data types. Ensure that the constraints (max 1 gadget) are checked at the time of equipping in the Draft/Loadout meta phase.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 002: Action economy updates to actually use the gadget in combat.
- Story 005: Draft pool logic to acquire gadgets.

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

**[For Logic / Integration stories — automated test specs]:**

- **AC-1**: GadgetDefinition schema
  - Given: A new gadget is defined
  - When: It is parsed by the engine
  - Then: It correctly stores `cooldownTurns` and `usesPerBattle`
  - Edge cases: `usesPerBattle` is null (unlimited)

- **AC-2**: Equipment slots constraint
  - Given: A hero with empty equipment slots
  - When: Equipping a gadget
  - Then: It takes 1 slot, and a second gadget cannot be equipped on the same hero.

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/heroes-and-abilities/gadget-schema_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None
- Unlocks: Story 002, Story 005
