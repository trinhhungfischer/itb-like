<Epic: Turn & Phase Manager>
> **Layer**: Foundation
> **GDD**: design/gdd/turn-and-phase-manager.md
> **Architecture Module**: Turn & Phase Manager
> **Status**: Ready
> **Stories**: 4 stories

## Stories

| # | Story | Type | Status | ADR |
|---|-------|------|--------|-----|
| 001 | Core Phase Loop | Logic | Ready | ADR-0006 |
| 002 | Phase Events | Logic | Ready | ADR-0002 |
| 003 | Objective and Win-Lose | Integration | Ready | ADR-0008 |
| 004 | In-Phase Undo/Redo | Integration | Ready | ADR-0007, ADR-0001 |

## Overview
The Turn & Phase Manager is the battle's **clock and referee**: it drives every battle through a fixed, deterministic sequence of phases each turn — the player plans and commits all hero actions, then telegraphed enemy actions resolve, then enemies spawn and re-telegraph their next intents — and after each turn it asks the Objective system whether the battle is won or lost. It also owns the player's **in-phase undo/redo**, letting a move be taken back freely until the turn is committed. Players never see it as a "system"; they feel it as the **rhythm** of the game and the safety of being able to think without being punished for a misclick. It exists to guarantee the ordering that makes VANGUARD fair: **enemies always reveal intent before the player acts, and nothing resolves out of order or by surprise** (Pillar #1 Perfect Information, Perfect Blame). Without it there is no turn, no telegraph-before-act guarantee, and no clean win/lose moment.

## Governing ADRs
| ADR | Title | Decision Summary | Engine Risk |
|-----|-------|------------------|-------------|
| ADR-0007 | ADR-0007: Snapshot-based undo & preview reuse one simulation | Both in-phase undo and pre-commit Move Preview are built on a single mechanism — `Board.snapshot()` — feeding the single simulation `Combat.resolve()`... | LOW |
| ADR-0001 | ADR-0001: Board tile-state representation & cheap `snapshot()` | Board tile-state (terrain, occupancy, hazard, flags) is stored as **parallel flat typed arrays** indexed by `index(c, r) = r * W + c`, so `Board.snaps... | LOW |
| ADR-0006 | ADR-0006: Combat `resolve()` as the single board-mutation path + 10-primitive vocabulary | Combat Resolution's `resolve(board, effects[]) → events[]` is the single, exclusive path that mutates board state, and it does so through a **closed v... | LOW |
| ADR-0004 | ADR-0004: mulberry32 PRNG seed strategy (procedural only) | VANGUARD needs reproducible procedural variety (map layout, encounter assembly, draft offers) without introducing any non-determinism into battle reso... | LOW |
| ADR-0002 | ADR-0002: Deterministic synchronous event bus | VANGUARD's simulation core must be byte-for-byte reproducible so that move preview, undo, and full-run replay all agree with committed play. This ADR ... | LOW |
| ADR-0008 | ADR-0008: Shared Unit record schema (C2) | Multiple systems independently described "a unit in battle," risking schema drift (`faction` vs `team`, `hp` vs `maxHP`/`currentHP`). This ADR publish... | LOW |

## GDD Requirements
- TR-TURN-001: Covered by None (Design/Presentation)
- TR-TURN-002: Covered by ADR-0007, ADR-0001
- TR-TURN-003: Covered by ADR-0006
- TR-TURN-004: Covered by ADR-0004, ADR-0002
- TR-TURN-005: Covered by ADR-0002
- TR-TURN-006: Covered by ADR-0008
- TR-TURN-007: Covered by ADR-0008
- TR-TURN-008: Covered by ADR-0007, ADR-0001

## Definition of Done
This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from the GDD are verified
- All Logic and Integration stories have passing test files in `tests/`
