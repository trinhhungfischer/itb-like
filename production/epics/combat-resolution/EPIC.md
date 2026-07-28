<Epic: Combat Resolution>
> **Layer**: Core
> **GDD**: design/gdd/combat-resolution.md
> **Architecture Module**: Combat Resolution
> **Status**: Ready
> **Stories**:
> - [Story 001: Resolve Loop and Event Bus](story-001-resolve-loop-and-event-bus.md)
> - [Story 002: Unit Lifecycle - Damage, Remove, Spawn](story-002-unit-lifecycle.md)
> - [Story 003: Displacement - Push, Pull and Collision](story-003-displacement.md)
> - [Story 004: Swap and Terrain](story-004-swap-and-terrain.md)
> - [Story 005: Hazard Integration](story-005-hazard-integration.md)
> - [Story 006: Move Preview Integration](story-006-move-preview-integration.md)

## Stories

| # | Story | Type | Status | ADR |
|---|-------|------|--------|-----|
| 001 | Resolve Loop and Event Bus | Logic | Ready | ADR-0006 |
| 002 | Unit Lifecycle - Damage, Remove, Spawn | Logic | Ready | ADR-0006 |
| 003 | Displacement - Push, Pull and Collision | Logic | Ready | ADR-0006 |
| 004 | Swap and Terrain | Logic | Ready | ADR-0006 |
| 005 | Hazard Integration | Logic | Ready | ADR-0006 |
| 006 | Move Preview Integration | Integration | Ready | ADR-0007 |

## Overview
Combat Resolution is the deterministic engine that turns an ability's intent into a board outcome. It owns exactly **ten effect primitives** — `damage`, `push`, `pull`, `swap`, `spawnHazard`, `applyHazard`, `removeUnit`, `setTerrain`, `spawnUnit`, and the shared **collision resolution** algorithm that `push`/`pull` both use — and it owns nothing else. Every hero ability and every enemy ability is compiled, by its own system, into an ordered list of these primitives; Combat Resolution never knows or cares whether a `push` came from a hero's shove or an enemy's charge. This is what breaks the Heroes↔Combat and Enemy↔Combat dependency cycles flagged in `systems-index.md`: abilities depend on Combat Resolution's primitives one-directionally, never the reverse. The system is **pure with respect to its inputs** — given the same board state and the same ordered effect list, it always produces the same mutations and the same event log, with no RNG, no wall-clock dependence, and no hidden state — which is precisely what lets Move Preview dry-run a whole turn by feeding the same primitives a `Board.snapshot()` instead of the live board (per `board-and-grid.md`). Combat Resolution is the system Pillar #2 (Positioning Over Power) is built on: `push`/`pull`/`swap` are first-class primitives with the same status as `damage`, so a hero's entire kit can be pure positioning and still be a complete, powerful verb (Pillar #4).

## Governing ADRs
| ADR | Title | Decision Summary | Engine Risk |
|-----|-------|------------------|-------------|
| ADR-0006 | ADR-0006: Combat `resolve()` as the single board-mutation path + 10-primitive vocabulary | Combat Resolution's `resolve(board, effects[]) → events[]` is the single, exclusive path that mutates board state, and it does so through a **closed v... | LOW |
| ADR-0005 | ADR-0005: Board/Combat error contract (Result vs throw) | Establishes a single, project-wide rule for how the Board & Grid and Combat Resolution layers signal a refused operation: **expected gameplay rejectio... | LOW |
| ADR-0002 | ADR-0002: Deterministic synchronous event bus | VANGUARD's simulation core must be byte-for-byte reproducible so that move preview, undo, and full-run replay all agree with committed play. This ADR ... | LOW |
| ADR-0008 | ADR-0008: Shared Unit record schema (C2) | Multiple systems independently described "a unit in battle," risking schema drift (`faction` vs `team`, `hp` vs `maxHP`/`currentHP`). This ADR publish... | LOW |
| ADR-0007 | ADR-0007: Snapshot-based undo & preview reuse one simulation | Both in-phase undo and pre-commit Move Preview are built on a single mechanism — `Board.snapshot()` — feeding the single simulation `Combat.resolve()`... | LOW |

## GDD Requirements
- TR-COMBAT-001: Covered by ADR-0006
- TR-COMBAT-002: Covered by ADR-0006
- TR-COMBAT-003: Covered by ADR-0006, ADR-0005
- TR-COMBAT-004: Covered by ADR-0002, ADR-0006
- TR-COMBAT-005: Covered by ADR-0006, ADR-0005
- TR-COMBAT-006: Covered by ADR-0008
- TR-COMBAT-007: Covered by ADR-0005
- TR-COMBAT-008: Covered by ADR-0007, ADR-0006
- TR-COMBAT-009: Covered by ADR-0002

## Definition of Done
This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from the GDD are verified
- All Logic and Integration stories have passing test files in `tests/`
