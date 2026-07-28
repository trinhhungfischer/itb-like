<Epic: Enemy, Abilities & Telegraph>
> **Layer**: Feature
> **GDD**: design/gdd/enemy-abilities-and-telegraph.md
> **Architecture Module**: Enemy, Abilities & Telegraph
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories enemy-abilities-telegraph`

## Overview
Enemy, Abilities & Telegraph owns everything about VANGUARD's non-player combatants: the enemy roster's definition data (stats, abilities, special on-death effects), a deterministic target-selection AI, the mechanics of **emerging** onto the board, and the **telegraph** system that shows the player exactly what every enemy will do one full turn before it happens. Like Heroes & Abilities, every enemy ability is compiled into Combat Resolution's 10 effect primitives (`damage`, `push`, `pull`, `swap`, `spawnHazard`, `applyHazard`, `removeUnit`, `setTerrain`, `spawnUnit`, plus the shared collision-resolution algorithm) — this system never mutates the board directly, which is what keeps the Enemy↔Combat dependency acyclic (per `systems-index.md`). This document exists because Pillar #1 (Perfect Information, Perfect Blame) is only as strong as its weakest link: if the enemy's *actual* resolved behavior can ever diverge from what its telegraph promised, the whole "every loss is a legible mistake" contract breaks. It is also where Pillar #2 (Positioning Over Power) gets its sharpest edge on the enemy side — telegraphed enemy actions resolve against fixed **tiles**, not chasing units, so blocking a path, standing on a landing spot, or luring two enemies together are all first-class tactical answers to a telegraph, never damage races.

## Governing ADRs
| ADR | Title | Decision Summary | Engine Risk |
|-----|-------|------------------|-------------|
| ADR-0006 | ADR-0006: Combat `resolve()` as the single board-mutation path + 10-primitive vocabulary | Combat Resolution's `resolve(board, effects[]) → events[]` is the single, exclusive path that mutates board state, and it does so through a **closed v... | LOW |
| ADR-0008 | ADR-0008: Shared Unit record schema (C2) | Multiple systems independently described "a unit in battle," risking schema drift (`faction` vs `team`, `hp` vs `maxHP`/`currentHP`). This ADR publish... | LOW |
| ADR-0004 | ADR-0004: mulberry32 PRNG seed strategy (procedural only) | VANGUARD needs reproducible procedural variety (map layout, encounter assembly, draft offers) without introducing any non-determinism into battle reso... | LOW |
| ADR-0009 | ADR-0009: Shared reachableTiles/BFS + coordinate-transform ownership (C3) | Resolves cross-system contract **C3** by fixing two single-owner boundaries: Board & Grid owns the **one** bounded flood-fill `reachableTiles(origin, ... | LOW |
| ADR-0011 | ADR-0011: Environmental telegraph query (C4) | Resolves cross-system contract C4: who owns the *environmental* (non-enemy-intent) telegraph and how the three consumers that must account for it stay... | LOW |
| ADR-0007 | ADR-0007: Snapshot-based undo & preview reuse one simulation | Both in-phase undo and pre-commit Move Preview are built on a single mechanism — `Board.snapshot()` — feeding the single simulation `Combat.resolve()`... | LOW |

## GDD Requirements
- TR-ENEMY-001: Covered by ADR-0006, ADR-0008
- TR-ENEMY-002: Covered by ADR-0004
- TR-ENEMY-003: Covered by ADR-0009
- TR-ENEMY-004: Covered by None (Design/Presentation)
- TR-ENEMY-005: Covered by ADR-0011
- TR-ENEMY-006: Covered by ADR-0006
- TR-ENEMY-007: Covered by ADR-0007
- TR-ENEMY-008: Covered by ADR-0006

## Definition of Done
This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from the GDD are verified
- All Logic and Integration stories have passing test files in `tests/`
