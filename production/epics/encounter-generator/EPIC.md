<Epic: Encounter Generator>
> **Layer**: Feature
> **GDD**: design/gdd/encounter-generator.md
> **Architecture Module**: Encounter Generator
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories encounter-generator`

## Overview
Encounter Generator is the system that assembles one battle's complete setup — terrain layout, spawn points, enemy spawn schedule, objective, and initial hazards — by taking an **authored Encounter Template** and applying **constrained procedural variation** (parameter rolls within ranges the template itself declares), then **proving** the result is playable before it ever reaches the player: a deterministic **solver** must find at least one actual winning sequence of actions (solvability), and that sequence must not be trivially easy (interest), or the candidate is rejected and regenerated. If every retry fails, the generator falls back to the template's **Authored Baseline** — a fixed, pre-validated variant that is guaranteed to pass, because it was already proven once at content-authoring time. This is explicitly **not** free-form random battle generation: every tile, enemy, and hazard a generated battle can contain was placed there by a human template author; the generator only chooses *which* of the author's declared options to use, and only ever ships a choice it has constructively proven is fair. This is what lets Pillar #3 (Variety Lives in the Draft, Not the Dice) extend past the hero roster into the battles themselves — encounter *selection* is randomized by a seeded, fully-reproducible process that runs once, outside combat, before Turn 1 — while Pillar #1 (Perfect Information, Perfect Blame) is upheld because the game never asks the player to face a battle nobody (design-side) has confirmed is winnable.

## Governing ADRs
| ADR | Title | Decision Summary | Engine Risk |
|-----|-------|------------------|-------------|
| ADR-0004 | ADR-0004: mulberry32 PRNG seed strategy (procedural only) | VANGUARD needs reproducible procedural variety (map layout, encounter assembly, draft offers) without introducing any non-determinism into battle reso... | LOW |
| ADR-0010 | ADR-0010: Difficulty/tier ownership chain (C1) | Resolves cross-system contract C1: who owns a battle node's difficulty tier and who is allowed to call the Encounter Generator. Establishes a single o... | LOW |
| ADR-0006 | ADR-0006: Combat `resolve()` as the single board-mutation path + 10-primitive vocabulary | Combat Resolution's `resolve(board, effects[]) → events[]` is the single, exclusive path that mutates board state, and it does so through a **closed v... | LOW |
| ADR-0007 | ADR-0007: Snapshot-based undo & preview reuse one simulation | Both in-phase undo and pre-commit Move Preview are built on a single mechanism — `Board.snapshot()` — feeding the single simulation `Combat.resolve()`... | LOW |
| ADR-0009 | ADR-0009: Shared reachableTiles/BFS + coordinate-transform ownership (C3) | Resolves cross-system contract **C3** by fixing two single-owner boundaries: Board & Grid owns the **one** bounded flood-fill `reachableTiles(origin, ... | LOW |

## GDD Requirements
- TR-ENCGEN-001: Covered by ADR-0004, ADR-0010
- TR-ENCGEN-002: Covered by ADR-0006, ADR-0007, ADR-0009
- TR-ENCGEN-003: Covered by ADR-0004
- TR-ENCGEN-004: Covered by ADR-0010
- TR-ENCGEN-005: Covered by ADR-0006
- TR-ENCGEN-006: Covered by None (Design/Presentation)

## Definition of Done
This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from the GDD are verified
- All Logic and Integration stories have passing test files in `tests/`
