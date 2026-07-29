# Story 004: Category Effects Implementation

> **Epic**: Passive Modules
> **Status**: Ready
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 

## Context

**GDD**: `design/content/passive-modules-and-equipment.md`
**Requirement**: `TR-COMBAT-???`
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR: N/A — Data configuration and specific effect logic.
**ADR Decision Summary**: No ADR applies. Module effects use existing 10 Combat Resolution primitives.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None

**Control Manifest Rules (this layer)**:
- Required: Variety must live entirely in a pre-battle, reproducible meta layer.
- Forbidden: Mutable global state is forbidden.
- Guardrail: None

---

## Acceptance Criteria

*From GDD `design/content/passive-modules-and-equipment.md`, scoped to this story:*

- [ ] AC4: `Scope: Squad` modules apply their effect to all heroes but consume only one equipment slot on the hero who drafted it.
- [ ] Implement the Combat (C1-C4), Tactical (T1-T3), Survival (S1-S4), and Utility (U1-U2) modules as defined in the Module Catalog.

---

## Implementation Notes

*Derived from ADR-NNNN Implementation Guidelines:*

Implement the 13 modules (T4 was removed). For `Scope: Squad`, the trigger registration should map the effect to all active hero units on the board.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 003: Trigger Type Implementations
- Story 005: Draft Integration

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

**[For Logic / Integration stories — automated test specs]:**

- **AC-4**: `Scope: Squad` modules apply to all heroes.
  - Given: A hero equips U1 (Scavenger, Scope: Squad).
  - When: Any hero in the squad kills an enemy.
  - Then: The +1 bonus currency effect triggers for the kill.
  - Edge cases: Kills by environmental hazards (if not attributed to a hero) do not trigger it unless specified.

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/heroes-and-abilities/module-effects_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 003
- Unlocks: Story 005
