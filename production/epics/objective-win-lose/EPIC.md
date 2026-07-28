<Epic: Objective / Win-Lose>
> **Layer**: Feature
> **GDD**: design/gdd/objective-and-win-lose.md
> **Architecture Module**: Objective / Win-Lose
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories objective-win-lose`

## Overview
Objective / Win-Lose is the battle's **judge**: a single pure function, `evaluate(battleState, turn, config) -> {Ongoing, Victory, Defeat}`, that answers "is this battle still going, won, or lost?" from nothing but the current board state, the current unit state, and the turn number. It owns the four v1 mission archetypes — **Survive N turns**, **Protect a target**, **Clear all enemies**, **Reach a tile** — plus the one lose condition that applies no matter which archetype is in play: a total party wipe. It also owns `max_turns`, the per-encounter turn limit that either defines a Survive/ Protect mission's win trigger or acts as an optional deadline for Clear/ Reach missions. Objective never mutates the board, never queries other systems, and never remembers anything between calls — it is asked the same question, from scratch, up to four times a turn by Turn & Phase Manager, and it must give the same answer every time it is asked with the same inputs. This purity is what makes Pillar #1 (Perfect Information, Perfect Blame) possible at the meta level of "did I win or lose, and why": the verdict is never a special case, a race condition, or a hidden counter — it is always a deterministic readout of the board the player can already see.

## Governing ADRs
| ADR | Title | Decision Summary | Engine Risk |
|-----|-------|------------------|-------------|
| ADR-0008 | ADR-0008: Shared Unit record schema (C2) | Multiple systems independently described "a unit in battle," risking schema drift (`faction` vs `team`, `hp` vs `maxHP`/`currentHP`). This ADR publish... | LOW |

## GDD Requirements
- TR-OBJECTIVE-001: Covered by ADR-0008
- TR-OBJECTIVE-002: Covered by ADR-0008
- TR-OBJECTIVE-003: Covered by None (Design/Presentation)
- TR-OBJECTIVE-004: Covered by None (Design/Presentation)
- TR-OBJECTIVE-005: Covered by ADR-0008

## Definition of Done
This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from the GDD are verified
- All Logic and Integration stories have passing test files in `tests/`
