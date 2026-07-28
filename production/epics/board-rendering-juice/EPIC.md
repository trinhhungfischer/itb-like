<Epic: Board Rendering & Juice>
> **Layer**: Presentation
> **GDD**: design/gdd/board-rendering-and-juice.md
> **Architecture Module**: Board Rendering & Juice
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories board-rendering-juice`

## Overview
Board Rendering & Juice is the **pure view layer** of a VANGUARD battle: a PixiJS (2D WebGL) scene graph that reads the current state of Board & Grid (terrain, hazards, occupancy, flags) and the event log emitted by Combat Resolution's `resolve()` calls, and turns both into pixels — the tile grid, unit sprites, hazard overlays, enemy telegraph icons, and short, legible animated feedback ("juice": knockback tweens, hit-flashes, tile-reaction pulses, death animations). It owns exactly one piece of authoritative state that other systems depend on: the **pixel geometry contract** (tile size, board screen-origin, camera) that Input & Selection's `screenToTile` / `tileToScreen` formulas require to agree with what the player sees. Beyond that contract, this system is strictly read-only with respect to gameplay — it never mutates Board, Combat, or Turn state, and nothing it does is ever consulted by game logic. It exists because VANGUARD's entire value proposition (Pillar #1: perfect information; Pillar #5: read in ten seconds) is only real if the player can **see** it: a deterministic, fully-telegraphed battle that isn't legibly rendered is not actually fair or readable, no matter how correct the underlying simulation is.

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
