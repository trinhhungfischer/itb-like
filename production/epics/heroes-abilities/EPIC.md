<Epic: Heroes & Abilities>
> **Layer**: Feature
> **GDD**: design/gdd/heroes-and-abilities.md
> **Architecture Module**: Heroes & Abilities
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories heroes-abilities`

## Overview
Heroes & Abilities defines the **hero chassis** (the data schema for a playable unit: HP, move range, size, and a class tag) and the **Ability Definition Schema** — a formal, reusable structure that expresses Pillar #4's promise that *every hero is a verb*: a named ability with a targeting shape, a target filter, and an ordered template of Combat Resolution effect primitives, compiled at cast time into the exact effect list that both the live game and Move Preview execute. A **Loadout** is the squad of hero instances (`squad_size` heroes) the player brings into one battle. This system owns *what a hero can do and where it can do it to* — it does not resolve any effect itself (Combat Resolution owns that), does not decide enemy behavior (Enemy, Abilities & Telegraph owns that, reusing this same Ability Definition Schema), and does not decide which heroes a player has access to across a run (Draft / Loadout Meta owns that). Because the same `compileEffects()` function is used to build the ordered effect list for both the real action and its dry-run preview, a hero's ability can never resolve differently than what the player was shown — this is the mechanical guarantee that makes Pillar #4's "unique verb" promise trustworthy rather than just a marketing label, and it is what lets Pillar #2 (Positioning Over Power) treat `push`/`pull`/`swap` as first-class win conditions rather than gimmicks bolted onto a damage-centric roster.

## Governing ADRs
| ADR | Title | Decision Summary | Engine Risk |
|-----|-------|------------------|-------------|
| ADR-0008 | ADR-0008: Shared Unit record schema (C2) | Multiple systems independently described "a unit in battle," risking schema drift (`faction` vs `team`, `hp` vs `maxHP`/`currentHP`). This ADR publish... | LOW |
| ADR-0006 | ADR-0006: Combat `resolve()` as the single board-mutation path + 10-primitive vocabulary | Combat Resolution's `resolve(board, effects[]) → events[]` is the single, exclusive path that mutates board state, and it does so through a **closed v... | LOW |
| ADR-0009 | ADR-0009: Shared reachableTiles/BFS + coordinate-transform ownership (C3) | Resolves cross-system contract **C3** by fixing two single-owner boundaries: Board & Grid owns the **one** bounded flood-fill `reachableTiles(origin, ... | LOW |
| ADR-0007 | ADR-0007: Snapshot-based undo & preview reuse one simulation | Both in-phase undo and pre-commit Move Preview are built on a single mechanism — `Board.snapshot()` — feeding the single simulation `Combat.resolve()`... | LOW |

## GDD Requirements
- TR-HERO-001: Covered by ADR-0008
- TR-HERO-002: Covered by ADR-0006
- TR-HERO-003: Covered by ADR-0009
- TR-HERO-004: Covered by ADR-0006, ADR-0007
- TR-HERO-005: Covered by ADR-0008
- TR-HERO-006: Covered by ADR-0006
- TR-HERO-007: Covered by None (Design/Presentation)
- TR-HERO-008: Covered by None (Design/Presentation)

## Definition of Done
This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from the GDD are verified
- All Logic and Integration stories have passing test files in `tests/`
