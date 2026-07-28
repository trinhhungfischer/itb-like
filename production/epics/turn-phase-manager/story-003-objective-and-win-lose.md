# Story 003: Objective and Win-Lose

> **Epic**: Turn & Phase Manager
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Integration
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 

## Context

**GDD**: `design/gdd/turn-and-phase-manager.md`
**Requirement**: `TR-TURN-006`, `TR-TURN-007`

**ADR Governing Implementation**: ADR-0008: Shared Unit record schema (C2)
**ADR Decision Summary**: Turn phase manager interfaces with Objective checks using shared records.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: 

**Control Manifest Rules (this layer)**:
- Required: Shared Unit Record interfaces must be used where applicable
- Forbidden: None specific to manager for this, see objective rules.
- Guardrail: N/A

---

## Acceptance Criteria

*From GDD `design/gdd/turn-and-phase-manager.md`, scoped to this story:*

- [ ] At most 4 Objective.evaluate(battleState,turn,config) calls per turn (3 early lose-only checks + 1 terminal win/lose check); early checks act on Defeat only.
- [ ] battle_ended event carries nodeType (Battle/Elite/Boss) for terminal consumers; exactly one battle_ended fires per battle.

---

## Implementation Notes

*Derived from ADR-0008 Implementation Guidelines:*

Implement early defeat checks in the manager immediately after Environment, EnemyResolve, and Spawn. End check executes terminal win/lose.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 004: In-Phase Undo/Redo

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

**[For Logic / Integration stories — automated test specs]:**

- **AC-1**: Early defeat check
  - Given: The battle state meets a defeat condition mid-turn
  - When: The corresponding phase concludes
  - Then: evaluate() triggers battle_ended(Defeat) early and halts the turn
  - Edge cases: Victory condition met early should not halt turn.

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `tests/integration/turn-phase-manager/objective-win-lose_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 002
- Unlocks: Story 004
