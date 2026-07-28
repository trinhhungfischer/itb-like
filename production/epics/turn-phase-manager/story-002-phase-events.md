# Story 002: Phase Events

> **Epic**: Turn & Phase Manager
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 

## Context

**GDD**: `design/gdd/turn-and-phase-manager.md`
**Requirement**: `TR-TURN-005`

**ADR Governing Implementation**: ADR-0002: Deterministic synchronous event bus
**ADR Decision Summary**: VANGUARD's simulation core must be byte-for-byte reproducible; the event bus emits phase transitions synchronously.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: 

**Control Manifest Rules (this layer)**:
- Required: Event Bus `emit()` must be synchronous and invoke subscribers in registration order on the caller's stack
- Forbidden: Event Bus handlers must not defer (no Promise/microtask/setTimeout/rAF)
- Guardrail: N/A

---

## Acceptance Criteria

*From GDD `design/gdd/turn-and-phase-manager.md`, scoped to this story:*

- [ ] Emits phase events (turn_started, player_phase_begun, action_applied, action_undone, environment_resolved, hazard_ticked, enemy_action_resolved, enemy_spawned, intents_telegraphed, battle_ended) on the synchronous event bus.

---

## Implementation Notes

*Derived from ADR-0002 Implementation Guidelines:*

Integrate the event bus to fire appropriate events at the start and end of phases. Do not defer the events. Provide necessary payloads.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 003: Objective and Win-Lose
- Story 004: In-Phase Undo/Redo

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

**[For Logic / Integration stories — automated test specs]:**

- **AC-1**: Emits phase events synchronously
  - Given: A turn executing
  - When: A phase transitions
  - Then: The corresponding synchronous event is emitted to the bus.
  - Edge cases: N/A

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/turn-phase-manager/phase-events_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001
- Unlocks: Story 003
