# Story 005: Board Mutations

> **Epic**: Board & Grid
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Estimate**: 3h
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-28

## Context

**GDD**: `design/gdd/board-and-grid.md`
**Requirement**: `TR-BOARD-005`, `TR-BOARD-006`

**ADR Governing Implementation**: ADR-0006: Combat `resolve()` single mutation path + 10-primitive vocabulary
**ADR Decision Summary**: Board mutations (`place`, `clear`, `setTerrain`, `setHazard`, `setFlag`) are deterministic and invoked ONLY via Combat Resolution.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None

**Control Manifest Rules (this layer)**:
- Required: All board mutation must flow exclusively through Combat `resolve()`.

---

## Acceptance Criteria

*From GDD `design/gdd/board-and-grid.md`, scoped to this story:*

- [ ] GIVEN an empty tile, WHEN place(unit), THEN occupied and getOccupant===unit.
- [ ] GIVEN an occupied tile, WHEN clear, THEN isOccupied===false.
- [ ] GIVEN a move clear(from)+place(to), WHEN both complete, THEN the unit is never observably on both/neither tile.
- [ ] GIVEN any tile, WHEN setHazard(type), THEN getHazard===type, no occupancy/terrain field changes as a side effect.
- [ ] GIVEN any tile, WHEN setFlag('spawn-point'|'objective'|'deploy-zone'), THEN getTile().flags includes it and hasFlag(tile, flag)===true.
- [ ] GIVEN a destructible Blocked tile, WHEN destroy (via setTerrain), THEN terrain Normal, isBlocked===false; flags on the tile persist.
- [ ] GIVEN a Chasm tile, WHEN destroy, THEN no-op (Chasm permanent).
- [ ] GIVEN a non-destructible Blocked tile, WHEN destroy, THEN no-op, returns false.
- [ ] GIVEN clear() on an already-empty tile, THEN idempotent no-op.
- [ ] GIVEN setFlag on Blocked/Chasm tiles, THEN allowed and stored opaquely.

---

## Implementation Notes

*Derived from ADR-0006 Implementation Guidelines:*

Implement `place`, `clear`, `setTerrain`, `setHazard`, and `setFlag`. These are the only methods that should alter the internal typed arrays. Ensure that they correctly update the typed arrays utilizing the single shared `index(c, r)` function. These mutation functions should be carefully gated and validated (e.g., `place` checks `isOccupied` and returns a `Result` as per Story 004).

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 004: Error contract

---

## QA Test Cases

*Test cases not yet defined — run /qa-plan to generate them.*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/board-grid/board-mutations_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001, Story 004
- Unlocks: None
