# Story 001: Base Contract & Universal Defeat

> **Epic**: Objective / Win-Lose
> **Status**: Complete
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-29

## Context

**GDD**: `design/gdd/objective-and-win-lose.md`
**Requirement**: `TR-OBJECTIVE-001`, `TR-OBJECTIVE-002`, `TR-OBJECTIVE-003`, `TR-OBJECTIVE-004`

**ADR Governing Implementation**: ADR-0008: Shared Unit record schema (C2)
**ADR Decision Summary**: Publishes the canonical per-battle Unit record once, owned by Heroes & Abilities, referenced by other systems. Objective polls battleState.units.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None — pure-web stack (TypeScript strict + PixiJS 2D WebGL + Vite)

**Control Manifest Rules (this layer)**:
- Required: Shared Unit Record interfaces must be used where applicable.
- Forbidden: Never use Math.random(), Date.now(), or PRNG in battle resolution (Combat/Turn Manager/Objectives/Enemy AI).

---

## Acceptance Criteria

*From GDD `design/gdd/objective-and-win-lose.md`, scoped to this story:*

- [ ] Purity & idempotency: evaluate(battleState, turn, config) is pure, idempotent, and does not mutate battleState.
- [ ] Universal party-wipe predicate: Returns {status: Defeat, reason: PartyWiped} when all Hero-faction units have alive==false, regardless of type or turn.
- [ ] Party-wipe alone never produces Defeat if at least one Hero is alive.
- [ ] Defeat precedence: If both partyWiped and a type's victory predicate are true, returns Defeat.
- [ ] Input validation: Rejects turn < 1 (assertion/contract violation).
- [ ] Input validation: Rejects config with max_turns <= 0.
- [ ] Input validation: Rejects Survive/Protect config with max_turns == null.

---

## Implementation Notes

*Derived from ADR-0008 Implementation Guidelines:*

Objective polls battleState.units which contains the canonical Unit record. Use `team` discriminant ('hero' or 'enemy'), and `currentHP` / `maxHP`. A unit is alive if it is present and hasn't been removed by Combat.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 002: Survive & Protect specific logic.
- Story 003: Clear & Reach specific logic.

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

**[For Logic / Integration stories — automated test specs]:**

- **AC-1**: Purity & Idempotency
  - Given: Identical (battleState, turn, config) inputs
  - When: evaluate() is called multiple times
  - Then: Every call returns identical EvaluationResult and no field of battleState is mutated.
- **AC-2**: Party Wipe
  - Given: All Hero-faction units have alive==false
  - When: evaluate() is called
  - Then: Returns {status: Defeat, reason: PartyWiped}
- **AC-3**: Defeat Precedence
  - Given: Both partyWiped and a type's victory predicate are true
  - When: evaluate() is called
  - Then: Returns {status: Defeat, reason: PartyWiped}

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/objective-win-lose/base-contract_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None
- Unlocks: Story 002, Story 003

## Completion Notes
**Completed**: 2026-07-29
**Criteria**: 7/7 passing
**Deviations**: None
**Test Evidence**: Logic: test file at tests/unit/objective-win-lose/base-contract_test.ts
**Code Review**: Complete
