<Epic: Board & Grid>
> **Layer**: Foundation
> **GDD**: design/gdd/board-and-grid.md
> **Architecture Module**: Board & Grid
> **Status**: Ready
> **Stories**: 5 stories

## Stories

| # | Story | Type | Status | ADR |
|---|-------|------|--------|-----|
| 001 | Board State & Pure Queries | Logic | Ready | ADR-0001 |
| 002 | Board Snapshot | Logic | Ready | ADR-0001 |
| 003 | Reachable Tiles BFS | Logic | Ready | ADR-0009 |
| 004 | Board Error Contract | Logic | Ready | ADR-0005 |
| 005 | Board Mutations | Logic | Ready | ADR-0006 |## Overview
Board & Grid is the spatial foundation of every VANGUARD battle: a finite rectangular grid of square tiles (default 8×8) that stores **where everything is** — units, terrain, hazards, spawn points, and objectives — and defines the **rules of space** every other system reads: which tiles are adjacent, how far apart two tiles are, whether a tile is occupied or blocked, and where the grid's edge lies. Players never manipulate the grid as a "system"; they experience it as the literal board they read at a glance and reason about when planning a move. It exists because VANGUARD wins are made of **position, not damage** (Pillar #2): without a precise, legible, deterministic model of tiles, adjacency, occupancy, and edges, there is no space to manipulate and no puzzle to solve. The system is **intentionally minimal** — it owns *spatial facts and queries only*; it does **not** resolve pushes, damage, or hazard effects (that is Combat Resolution's responsibility).

## Governing ADRs
| ADR | Title | Decision Summary | Engine Risk |
|-----|-------|------------------|-------------|
| ADR-0001 | ADR-0001: Board tile-state representation & cheap `snapshot()` | Board tile-state (terrain, occupancy, hazard, flags) is stored as **parallel flat typed arrays** indexed by `index(c, r) = r * W + c`, so `Board.snaps... | LOW |
| ADR-0009 | ADR-0009: Shared reachableTiles/BFS + coordinate-transform ownership (C3) | Resolves cross-system contract **C3** by fixing two single-owner boundaries: Board & Grid owns the **one** bounded flood-fill `reachableTiles(origin, ... | LOW |
| ADR-0005 | ADR-0005: Board/Combat error contract (Result vs throw) | Establishes a single, project-wide rule for how the Board & Grid and Combat Resolution layers signal a refused operation: **expected gameplay rejectio... | LOW |
| ADR-0006 | ADR-0006: Combat `resolve()` as the single board-mutation path + 10-primitive vocabulary | Combat Resolution's `resolve(board, effects[]) → events[]` is the single, exclusive path that mutates board state, and it does so through a **closed v... | LOW |
| ADR-0002 | ADR-0002: Deterministic synchronous event bus | VANGUARD's simulation core must be byte-for-byte reproducible so that move preview, undo, and full-run replay all agree with committed play. This ADR ... | LOW |

## GDD Requirements
- TR-BOARD-001: Covered by ADR-0001
- TR-BOARD-002: Covered by ADR-0001
- TR-BOARD-003: Covered by ADR-0009
- TR-BOARD-004: Covered by ADR-0005
- TR-BOARD-005: Covered by ADR-0006
- TR-BOARD-006: Covered by ADR-0006
- TR-BOARD-007: Covered by ADR-0001
- TR-RENDER-001: Covered by ADR-0002
- TR-RENDER-002: Covered by ADR-0009
- TR-RENDER-003: Covered by None (Design/Presentation)
- TR-RENDER-004: Covered by ADR-0002
- TR-RENDER-005: Covered by None (Design/Presentation)
- TR-RENDER-006: Covered by ADR-0002

## Definition of Done
This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from the GDD are verified
- All Logic and Integration stories have passing test files in `tests/`
