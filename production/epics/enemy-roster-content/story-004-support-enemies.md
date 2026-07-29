# Story 004: Support Enemies

> **Epic**: Enemy Roster Content
> **Status**: Ready
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: 4 hours
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-29

## Context

**GDD**: `design/content/enemy-roster-and-archetypes.md`
**Requirement**: `TR-ROSTER-009`

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

- [ ] Implement Overseer: Support pattern, Aura Buffer. Variants: Warchief, Ironhide, Volatile, Hivemind.

---

## Implementation Notes

*Derived from ADR-NNNN Implementation Guidelines:*

N/A — The GDD deferred the aura implementation to the implementation phase, recommending "auras as runtime stat modifiers applied at chooseIntents() time, removed on Overseer death". Ensure this does not violate Combat primitives logic.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 003: Zone Enemies
- Story 005: Boss Enemies

---

## QA Test Cases

*Test cases not yet defined — run /qa-plan to generate them.*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/feature/support-enemies_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None
- Unlocks: None
