# Story 003: Trigger Type Implementations

> **Epic**: Passive Modules
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 

## Context

**GDD**: `design/content/passive-modules-and-equipment.md`
**Requirement**: `TR-COMBAT-???`
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR: N/A — No architectural pattern required for specific trigger instances.
**ADR Decision Summary**: Uses the trigger system built in Story 002 to implement the specific event hooks.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None

**Control Manifest Rules (this layer)**:
- Required: Effects must apply strictly sequentially in list order.
- Forbidden: Never add an 11th primitive without amending the GDD/ADR first.
- Guardrail: Board cost/frame < 2 ms.

---

## Acceptance Criteria

*From GDD `design/content/passive-modules-and-equipment.md`, scoped to this story:*

- [ ] Implement triggers: `Always`, `OnAction`, `OnHit`, `OnKill`, `OnTurnStart`.
- [ ] Ensure triggers fire appropriately based on combat resolution events and turn phase transitions.

---

## Implementation Notes

*Derived from ADR-NNNN Implementation Guidelines:*

Implement the hooks for each of the 5 trigger types. `OnTurnStart` hooks into the `Environment` or `TurnStart` phase events as defined by the Turn & Phase Manager.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 002: Passive Trigger System
- Story 004: Category Effects Implementation

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

**[For Logic / Integration stories — automated test specs]:**

- **AC-Trigger**: Implement triggers: `Always`, `OnAction`, `OnHit`, `OnKill`, `OnTurnStart`.
  - Given: A battle with heroes equipping dummy modules using each trigger type.
  - When: The trigger condition occurs (e.g. Turn starts, unit is killed).
  - Then: The dummy module's effect is correctly invoked exactly once.
  - Edge cases: Triggering `OnKill` when multiple units die in a single action must fire for each.

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/combat-resolution/trigger-types_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 002
- Unlocks: Story 004
