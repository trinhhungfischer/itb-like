# Story 003: Clear & Reach Objectives

> **Epic**: Objective / Win-Lose
> **Status**: Complete
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-29

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

- [ ] Clear type: Ongoing if enemies remaining > 0 (and no party wipe).
- [ ] Clear type: Victory (AllEnemiesCleared) if enemies remaining == 0.
- [ ] Clear type with deadline: Defeat (TimeExpired) if turn >= max_turns and enemies remaining > 0.
- [ ] Clear type with deadline: Victory takes precedence over deadline if both enemies remaining == 0 and turn >= max_turns.
- [ ] Reach type: Victory (GoalTileReached) if goalTile is occupied by a living Hero-faction unit.
- [ ] Reach type: Ongoing if goalTile is occupied by an Enemy-faction unit, or unoccupied.
- [ ] Reach type with deadline: Defeat (TimeExpired) if turn >= max_turns and goalTile not occupied by hero.
- [ ] Reach type: No memory of mid-turn occupancy; check is strictly based on occupancy at evaluation time.
- [ ] Reason codes match the Reason-code mapping table for Clear and Reach.

---

## Implementation Notes

*Derived from ADR-0008 Implementation Guidelines:*

Objective polls battleState.units (Unit record with team discriminant) and battleState.board (for occupancy).

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 001: Base contract and universal defeat.
- Story 002: Survive & Protect specific logic.

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

**[For Logic / Integration stories — automated test specs]:**

- **AC-1**: Clear type victory
  - Given: config={type: Clear, max_turns: null}
  - When: enemiesRemaining == 0
  - Then: Returns {status: Victory, reason: AllEnemiesCleared}
- **AC-2**: Clear type deadline
  - Given: config={type: Clear, max_turns: 5}, enemiesRemaining > 0
  - When: evaluate() at turn=5
  - Then: Returns {status: Defeat, reason: TimeExpired}
- **AC-3**: Reach type victory
  - Given: config={type: Reach, goalTile: (6,1)}
  - When: (6,1) is occupied by a living Hero-faction unit
  - Then: Returns {status: Victory, reason: GoalTileReached}
- **AC-4**: Reach type enemy occupant
  - Given: config={type: Reach, goalTile: (6,1)}
  - When: (6,1) is occupied by an Enemy-faction unit
  - Then: Returns {status: Ongoing}

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/objective-win-lose/clear-reach_test.ts` — must exist and pass

**Status**: [x] Created at tests/unit/objective-win-lose/clear-reach_test.ts

---

## Dependencies

- Depends on: Story 001 must be DONE
- Unlocks: None

## Completion Notes
**Completed**: 2026-07-29
**Criteria**: 9/9 passing
**Deviations**: None
**Test Evidence**: Logic: test file at tests/unit/objective-win-lose/clear-reach_test.ts
**Code Review**: Complete
