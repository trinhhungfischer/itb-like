# Story 005: Boss Enemies

> **Epic**: Enemy Roster Content
> **Status**: Ready
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: 4 hours
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-29

## Context

**GDD**: `design/content/enemy-roster-and-archetypes.md`
**Requirement**: `TR-ROSTER-010`, `TR-ROSTER-011`

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

- [ ] Implement Boss 1: Behemoth (The Warlord). Turn parity AI (Slam / Summon), 15 HP.
- [ ] Implement Boss 2: Architect (The Board Controller). Turn parity AI (Rift Tear / Shockwave), 12 HP.

---

## Implementation Notes

*Derived from ADR-NNNN Implementation Guidelines:*

N/A — The GDD deferred boss multi-ability implementation, recommending a simple turn-parity check (`turn % 2 == 0 ? ability1 : ability2`). A full state machine is considered overkill for v1's alternating pattern.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 004: Support Enemies

---

## QA Test Cases

*Test cases not yet defined — run /qa-plan to generate them.*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/feature/boss-enemies_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None
- Unlocks: None
