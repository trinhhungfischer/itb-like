# Story 003: Zone Enemies

> **Epic**: Enemy Roster Content
> **Status**: Ready
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: 3 hours
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-29

## Context

**GDD**: `design/content/enemy-roster-and-archetypes.md`
**Requirement**: `TR-ROSTER-007`, `TR-ROSTER-008`

**ADR Governing Implementation**: N/A — pure data configuration and ability definition using existing primitives
**ADR Decision Summary**: N/A

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None

**Control Manifest Rules (this layer)**:
- Required: Variety must live entirely in a pre-battle, reproducible meta layer
- Forbidden: Encounter Generator MUST NOT call any Difficulty Tiers or Run Structure symbol
- Guardrail: O(1) query avg < 0.01 ms

---

## Acceptance Criteria

*From GDD `design/content/enemy-roster-and-archetypes.md`, scoped to this story:*

- [ ] Implement Broodmother: Zone pattern, Spawner. T1/T2/T3 escalation rules per GDD (Spawn Brood).
- [ ] Implement Shifter: Zone pattern, Terrain Sculptor. T1/T2/T3 escalation rules per GDD (Erect Wall -> Terraform).

---

## Implementation Notes

*Derived from ADR-NNNN Implementation Guidelines:*

N/A — configure `AbilityDefinition`s that compile into the 10 Combat primitives. 
Note: Ensure on-death spawn mechanic is correctly attached to Broodmother definitions.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 001: Approach Enemies
- Story 002: Artillery Enemies

---

## QA Test Cases

*Test cases not yet defined — run /qa-plan to generate them.*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/feature/zone-enemies_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None
- Unlocks: None
