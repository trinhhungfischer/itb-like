# Story 004: Telegraph State & Environment Queries

> **Epic**: Enemy, Abilities & Telegraph
> **Status**: Ready
> **Layer**: Feature
> **Type**: Logic
> **Estimate**:
> **Manifest Version**: 2026-07-28
> **Last Updated**:

## Context

**GDD**: `design/gdd/enemy-abilities-and-telegraph.md`
**Requirement**: `TR-ENEMY-004`, `TR-ENEMY-005`

**ADR Governing Implementation**: ADR-0011: Environmental telegraph query (C4)
**ADR Decision Summary**: Resolves cross-system contract C4: who owns the environmental (non-enemy-intent) telegraph and how the three consumers that must account for it stay in sync.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: 

**Control Manifest Rules (this layer)**:
- Required: Audio MUST source lethalThreats from `telegraphedLethalThreatCount(turn)`
- Forbidden: Battle HUD and Move Preview MUST NOT consult Board & Grid's getHazard directly to build telegraphed-tile set

---

## Acceptance Criteria

*From GDD `design/gdd/enemy-abilities-and-telegraph.md`, scoped to this story:*

- [ ] **GIVEN** battle setup completes, **WHEN** queried before any player input, **THEN** every living enemy already has a non-`Idle`-or-`Idle` `Intent` recorded for Turn 1.
- [ ] **GIVEN** an `Intent` has been telegraphed for turn `n`, **WHEN** the board mutates during Player Phase (heroes move, abilities fire), **THEN** `telegraphedEffectTiles` and `telegraphedMoveDestination` on that stored `Intent` do not change.
- [ ] **GIVEN** an enemy spawns during the Spawn Phase, **WHEN** the same turn's Telegraph Phase runs, **THEN** that enemy has a valid `Intent` recorded for the next turn, and it performed no move/attack action during the current turn's EnemyResolve (which already passed).

---

## Implementation Notes

*Derived from ADR-0011 Implementation Guidelines:*

Implement `telegraphedEnvironmentTiles(turn)` as a thin pass-through over Board hazard state.
Implement `telegraphedLethalThreatCount(turn)` as a pure lethality tally over the shared Unit record.
Both are computed at Telegraph Phase and fixed for the turn.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 005: Execution and resolution logic

---

## QA Test Cases

*Test cases to implement:*
- Enemy intents are pre-recorded for Turn 1 before player input.
- Intents remain immutable to player phase board mutations.
- Newly spawned enemies generate next-turn Intents correctly.

*Edge Cases:*
- Spawning enemies receiving next-turn intents without acting this turn.

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/enemy-abilities-and-telegraph/telegraph-state_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 003
- Unlocks: Story 005
