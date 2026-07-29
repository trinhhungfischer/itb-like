# Story 007: Spawn Emergence

> **Epic**: Enemy, Abilities & Telegraph
> **Status**: Ready
> **Layer**: Feature
> **Type**: Logic
> **Estimate**:
> **Manifest Version**: 2026-07-28
> **Last Updated**:

## Context

**GDD**: `design/gdd/enemy-abilities-and-telegraph.md`
**Requirement**: `TR-ENEMY-006`

**ADR Governing Implementation**: ADR-0006: Combat `resolve()` as the single board-mutation path + 10-primitive vocabulary
**ADR Decision Summary**: Combat Resolution's `resolve(board, effects[]) → events[]` is the single board-mutation path.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: 

**Control Manifest Rules (this layer)**:
- Required: All board mutation must flow exclusively through Combat `resolve()`
- Forbidden: N/A

---

## Acceptance Criteria

*From GDD `design/gdd/enemy-abilities-and-telegraph.md`, scoped to this story:*

- [ ] **GIVEN** a spawn scheduled onto a `Clear` spawn-point tile, **WHEN** `emergeSpawns()` runs, **THEN** a new enemy with a unique `unitId` and full `maxHP` is placed there, flagged unable to act this turn.
- [ ] **GIVEN** a spawn scheduled onto an `Occupied` spawn-point tile, **WHEN** `emergeSpawns()` runs, **THEN** the spawn is delayed (state `Delayed`) and no enemy is placed; it is retried at the next Spawn Phase.
- [ ] **GIVEN** a spawn has been delayed for `spawn_retry_cap` consecutive Spawn Phases, **WHEN** the next Spawn Phase runs regardless of occupancy, **THEN** emergence is forced with a collision consequence to the blocking occupant (boundary test: fires at exactly the cap count, not one before or after).
- [ ] **GIVEN** a spawn instruction is due next Spawn Phase, **WHEN** the current Telegraph Phase runs, **THEN** a `SpawnIntent` is present on that spawn-point tile.

---

## Implementation Notes

*Derived from ADR-0006 Implementation Guidelines:*

Implement `emergeSpawns()` by utilizing Combat's `spawnUnit` primitive to insert new enemies into the board.
Track spawn delays and implement the forced eviction logic after reaching `spawn_retry_cap`.
Spawned units must be flagged inactive for the turn they emerge.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 006: On-death enemy spawns (broods)

---

## QA Test Cases

*Test cases to implement:*
- Emergence on Clear tile -> active next turn.
- Emergence on Occupied tile -> delayed.
- Emergence delayed for `spawn_retry_cap` -> forced with collision.
- Upcoming spawns correctly project `SpawnIntent`.

*Edge Cases:*
- Forcing spawn exactly at retry cap limit (no sooner, no later).
- Multiple delayed spawns stacking.

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/enemy-abilities-and-telegraph/spawn-emergence_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 006
- Unlocks: None
