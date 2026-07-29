# Story 001: Equipment Slot Data Model

> **Epic**: Passive Modules
> **Status**: Complete
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 

## Context

**GDD**: `design/content/passive-modules-and-equipment.md`
**Requirement**: `TR-HERO-???`
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR: N/A — pure data schema extension
**ADR Decision Summary**: No architectural pattern required for extending the hero data model.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None

**Control Manifest Rules (this layer)**:
- Required: Shared Unit Record interfaces must be used where applicable.
- Forbidden: Mutable global state is forbidden.
- Guardrail: None

---

## Acceptance Criteria

*From GDD `design/content/passive-modules-and-equipment.md`, scoped to this story:*

- [ ] AC1: A hero can equip a maximum of 2 passive modules.
- [ ] Add `equipmentSlots: [EquipmentSlot, EquipmentSlot]` to `HeroDefinition` runtime. Each slot holds `PassiveModule | Gadget | null`.

---

## Implementation Notes

*Derived from ADR-NNNN Implementation Guidelines:*

No specific ADR applies. Implement the base schema `PassiveModuleDefinition` with properties for id, name, category, scope, trigger, effect, rarity, and incompatible arrays.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 002: Passive Trigger System

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

**[For Logic / Integration stories — automated test specs]:**

- **AC-1**: A hero can equip a maximum of 2 passive modules.
  - Given: A hero with empty equipment slots.
  - When: The game attempts to assign up to 2 passive modules to the hero.
  - Then: Both modules are successfully added to the `equipmentSlots` array without error.
  - Edge cases: Equipping a third module directly to the data model throws an expected gameplay rejection or validation error.

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/heroes-and-abilities/equipment-slot_test.ts` — must exist and pass

**Status**: [x] Created

---

## Completion Notes
**Completed**: 2026-07-29
**Criteria**: 2/2 passing
**Deviations**: None
**Test Evidence**: tests/unit/heroes-abilities/equipment-slot_test.ts
**Code Review**: Complete

---

## Dependencies

- Depends on: None
- Unlocks: Story 002
