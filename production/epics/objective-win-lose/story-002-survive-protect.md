# Story 002: Survive & Protect Objectives

> **Epic**: Objective / Win-Lose
> **Status**: Ready
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 

## Context

**GDD**: `design/gdd/objective-and-win-lose.md`
**Requirement**: `TR-OBJECTIVE-003`, `TR-OBJECTIVE-005`

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

- [ ] Survive type: Ongoing if turn < max_turns with heroes alive.
- [ ] Survive type: Victory (TurnLimitReached) if turn >= max_turns with heroes alive.
- [ ] Survive type: Clearing all enemies early does not trigger Victory.
- [ ] Protect type: Defeat (ProtectedUnitLost) if protectedUnitId is dead/missing, regardless of party wipe state.
- [ ] Protect type: Victory (TurnLimitReached) if turn >= max_turns and protected unit is alive.
- [ ] Protect type: Missing protectedUnitId in registry is treated as lost (immediate Defeat).
- [ ] Reason codes match the Reason-code mapping table for Survive and Protect.

---

## Implementation Notes

*Derived from ADR-0008 Implementation Guidelines:*

Objective polls battleState.units which contains the canonical Unit record. Use `team` discriminant ('hero' or 'enemy'). For Protect type, check the presence and alive state of the `protectedUnitId` in the unit registry.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 003: Clear & Reach specific logic.

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

**[For Logic / Integration stories — automated test specs]:**

- **AC-1**: Survive type turn cap
  - Given: config={type: Survive, max_turns: 5}, heroes alive
  - When: evaluate() at turn=4, then turn=5
  - Then: turn=4 returns Ongoing, turn=5 returns Victory (TurnLimitReached)
- **AC-2**: Survive type enemies cleared early
  - Given: config={type: Survive, max_turns: 5}, heroes alive, all enemies removed
  - When: evaluate() at turn=2
  - Then: Returns Ongoing (does not trigger Victory)
- **AC-3**: Protect type target lost
  - Given: config={type: Protect, max_turns: 6, protectedUnitId: 'vip'}, vip.alive==false
  - When: evaluate() at turn=3
  - Then: Returns {status: Defeat, reason: ProtectedUnitLost}

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/objective-win-lose/survive-protect_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 must be DONE
- Unlocks: None
