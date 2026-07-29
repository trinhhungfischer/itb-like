# Story 001: Approach Enemies

> **Epic**: Enemy Roster Content
> **Status**: Ready
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: 3 hours
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-29

## Context

**GDD**: `design/content/enemy-roster-and-archetypes.md`
**Requirement**: `TR-ROSTER-001`, `TR-ROSTER-002`, `TR-ROSTER-003`

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

- [ ] Implement Drone: Approach pattern, Swarm Fodder. T1/T2/T3 escalation rules per GDD (Bite -> Venomous Bite).
- [ ] Implement Charger: Approach pattern, Battering Ram. T1/T2/T3 escalation rules per GDD (Charge Strike -> Ram Through with push).
- [ ] Implement Stalker: Approach pattern, Flanker. T1/T2/T3 escalation rules per GDD (Slash -> Ambush).

---

## Implementation Notes

*Derived from ADR-NNNN Implementation Guidelines:*

N/A — configure `AbilityDefinition`s that compile into the 10 Combat primitives. 

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 002: Artillery Enemies
- Story 003: Zone Enemies
- Story 004: Support Enemies
- Story 005: Boss Enemies

---

## QA Test Cases

*Test cases not yet defined — run /qa-plan to generate them.*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/feature/approach-enemies_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None
- Unlocks: None
