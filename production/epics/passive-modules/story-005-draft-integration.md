# Story 005: Draft Integration

> **Epic**: Passive Modules
> **Status**: Complete
> **Layer**: Feature
> **Type**: Integration
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-29

## Context

**GDD**: `design/content/passive-modules-and-equipment.md`
**Requirement**: `TR-DRAFT-???`
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR: N/A — Integration with existing UI/meta-layer.
**ADR Decision Summary**: No ADR applies. Extending existing draft/loadout pool to support Modules.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None

**Control Manifest Rules (this layer)**:
- Required: Deterministic seeded draft offers: draftSeed = mix(runSeed, nodeId, DRAFT_SEED_SALT)
- Forbidden: Mutable global state is forbidden.
- Guardrail: None

---

## Acceptance Criteria

*From GDD `design/content/passive-modules-and-equipment.md`, scoped to this story:*

- [x] AC2: Attempting to equip a 3rd module prompts the player to replace an existing one.
- [x] Add Module to the draftable content pool alongside heroes and upgrades, distributing by rarity weights.

---

## Implementation Notes

*Derived from ADR-NNNN Implementation Guidelines:*

Ensure the draft pool seeded random generator (`mulberry32`) is used to pick modules. Squad-scoped modules must be removed from the draft pool once picked by the squad.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 004: Category Effects Implementation

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

**[For Logic / Integration stories — automated test specs]:**

- **AC-2**: Attempting to equip a 3rd module prompts replacement.
  - Given: A hero with 2 passive modules already equipped.
  - When: The player selects a 3rd module in the Draft/Loadout phase.
  - Then: A prompt or state is returned requiring the player to replace one of the existing modules.
  - Edge cases: Replacing a squad-scoped module re-adds it to the potential draft pool if applicable.

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `tests/integration/draft-and-loadout-meta/draft-modules_test.ts` — must exist and pass

**Status**: [x] tests/integration/draft-and-loadout-meta/draft-modules_test.ts

---

## Dependencies

- Depends on: Story 004
- Unlocks: None

## Completion Notes
**Completed**: 2026-07-29
**Criteria**: 2/2 passing
**Deviations**: None
**Test Evidence**: tests/integration/draft-and-loadout-meta/draft-modules_test.ts
**Code Review**: Complete
