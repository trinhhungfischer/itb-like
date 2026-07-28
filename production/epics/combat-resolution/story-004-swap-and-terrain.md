# Story 004: Swap and Terrain

> **Epic**: combat-resolution
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Estimate**:
> **Manifest Version**: 2026-07-28
> **Last Updated**:

## Context

**GDD**: `design/gdd/combat-resolution.md`
**Requirement**: `TR-COMBAT-002`, `TR-COMBAT-007`

**ADR Governing Implementation**: ADR-0006: Combat `resolve()` as the single board-mutation path + 10-primitive vocabulary
**ADR Decision Summary**: Combat Resolution's `resolve(board, effects[]) → events[]` is the single, exclusive path that mutates board state, and it does so through a closed vocabulary of 10 primitives.

**Secondary ADRs**: ADR-0005

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: Pure TypeScript, no engine dependencies.

**Control Manifest Rules (this layer)**:
- Required: Expected gameplay rejections must return a value-typed `Result`. Genuine programmer errors must fail-fast and assert/throw loudly.
- Forbidden: Target-locking must never use a live spatial query resolved mid-chain.
- Guardrail: Board cost/frame < 2 ms.

---

## Acceptance Criteria

*From GDD `design/gdd/combat-resolution.md`, scoped to this story:*

- [ ] **GIVEN** unit A at tile `X` and unit B at tile `Y`, **WHEN** `swap(A, B)`, **THEN** A is now at `Y`, B is now at `X`, and no intermediate tile state is ever observable (atomic).
- [ ] **GIVEN** unit A was removed earlier in the same chain, **WHEN** `swap(A, B)` is attempted, **THEN** the entire swap is rejected, B remains at its original tile, and a `swap_failed` event is emitted.
- [ ] **GIVEN** an empty `Normal` tile, **WHEN** `setTerrain(tile, Blocked)`, **THEN** `classify(tile)` reports `Blocked` and a subsequent `push` toward that tile stops one tile short with `CollisionResolved(kind: Wall)`.
- [ ] **GIVEN** a `Blocked` tile with no occupant, **WHEN** `setTerrain(tile, Normal)`, **THEN** `classify(tile)` reports `Clear` and a unit may subsequently be pushed or moved onto it, and `TerrainSet(tile, Normal)` is emitted.
- [ ] **GIVEN** a tile occupied by a unit, **WHEN** `setTerrain(tile, Blocked)` is attempted, **THEN** it is rejected, the terrain is unchanged, and `set_terrain_rejected` is emitted.

---

## Implementation Notes

*Derived from ADR-0006 Implementation Guidelines:*

- Implement `swap` primitive and `setTerrain` primitive.
- Validate `swap` IDs and atomicity.
- Validate `setTerrain` against current tile occupants.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 005: Hazard-on-entry for swap

---

## QA Test Cases

*Test cases not yet defined — run /qa-plan to generate them.*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/combat-resolution/swap-and-terrain_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001
- Unlocks: None
