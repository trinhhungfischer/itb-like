# Story 001: Core Phase Loop

> **Epic**: Turn & Phase Manager
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 

## Context

**GDD**: `design/gdd/turn-and-phase-manager.md`
**Requirement**: `TR-TURN-001`, `TR-TURN-003`, `TR-TURN-004`

**ADR Governing Implementation**: ADR-0006: Combat `resolve()` as the single board-mutation path
**ADR Decision Summary**: Combat Resolution's `resolve` is the single exclusive mutation path, meaning the Turn Manager orchestrates phases without mutating state directly.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: 

**Control Manifest Rules (this layer)**:
- Required: Board's internal data representation must be cheap by construction for `snapshot()`
- Forbidden: Combat never calls back into Turn & Phase Manager
- Guardrail: Single O(1) query avg < 0.01 ms

---

## Acceptance Criteria

*From GDD `design/gdd/turn-and-phase-manager.md`, scoped to this story:*

- [ ] Fixed per-turn phase order TurnStart→PlayerPhase→Environment→EnemyResolve→Spawn→Telegraph→EndCheck, identical every turn, no reordering; Environment resolves BEFORE EnemyResolve (deliberate tactical setup/disruption).
- [ ] Interface inversion: the manager drives Combat/Enemy/Objective via abstract contracts rather than concrete implementations, keeping the dependency graph acyclic.
- [ ] Deterministic and input-driven: only Player-Phase input is nondeterministic; every other phase is a pure function of board state (no timers, no wall-clock, no RNG in phase logic).

---

## Implementation Notes

*Derived from ADR-0006 Implementation Guidelines:*

Implement an orchestrator that calls interface methods for each phase. Ensure it holds no direct imports to concrete game logic. Maintain strict separation of concerns where the manager acts purely as a clock and referee.

> **⚠️ Design the state machine to accept a `Paused` state — added 2026-07-28 from the
> `ux-designer` gate on `settings-and-options.md` (#28).**
>
> That document's Rule 15 requires the settings screen be reachable **mid-battle**, and
> the gate found this is currently impossible: the battle state machine
> (`Setup → InTurn → Ended`) has **no `Paused` state**, the pause hook in
> `input-and-selection.md` is unimplemented, and Battle HUD has no affordance. Mouse-only
> players — this game's **primary input** — therefore have no path into settings during a
> battle, which also blocks a player who needs an accommodation mid-fight.
>
> **You are not asked to implement pause here** (Settings is Alpha-tier, and the HUD
> affordance belongs to Battle HUD). You *are* asked not to foreclose it: leave a seam so
> `Paused` can be added without reshaping the phase ring. Retrofitting a state into a
> Foundation state machine after Combat Resolution, Objective, and Undo all depend on it
> is far more expensive than accommodating it now.
>
> Constraint from Rule 15: pausing must never advance a turn, consume an action, or touch
> the undo stack.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 002: Phase Events
- Story 003: Objective and Win-Lose
- Story 004: In-Phase Undo/Redo

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

**[For Logic / Integration stories — automated test specs]:**

- **AC-1**: Fixed per-turn phase order
  - Given: A fresh battle instance
  - When: A turn executes
  - Then: Phases execute in exact order: TurnStart→PlayerPhase→Environment→EnemyResolve→Spawn→Telegraph→EndCheck
  - Edge cases: Empty player phase

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/turn-phase-manager/core-phase-loop_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None
- Unlocks: Story 002
