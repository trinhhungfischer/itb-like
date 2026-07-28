<Epic: Battle HUD>
> **Layer**: Presentation
> **GDD**: design/gdd/battle-hud.md
> **Architecture Module**: Battle HUD
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories battle-hud`

## Overview
Battle HUD is the player's single always-on window into everything the deterministic battle simulation already knows. It aggregates read-only state from five upstream systems — Turn & Phase Manager (turn/phase), Combat Resolution (HP/event deltas), Heroes & Abilities (hero roster, ability, action-economy state), Enemy, Abilities & Telegraph (enemy HP, telegraphed intent), and Objective / Win-Lose (mission status) — into six persistent information zones: **HP bars**, **telegraph intent icons**, the **turn/phase indicator**, the **ability bar**, the **objective/turn-limit display**, and the **End Turn + Undo controls**. It is the concrete, on-screen instrument of Pillar #5 (Read in Ten Seconds): if a fact about the battle matters to a decision, it lives in the HUD, always visible, never behind a click. It is also the last mile of Pillar #1 (Perfect Information, Perfect Blame) — every number and icon the HUD shows must be traceable to a real, already-computed system value, never HUD-invented state, so a player who reads the HUD correctly can never be surprised by the simulation. Battle HUD owns exactly two write paths back into the simulation — the End Turn and Undo/Redo controls — and nothing else; every other pixel it draws is a read-only projection of state owned elsewhere.

## Governing ADRs
| ADR | Title | Decision Summary | Engine Risk |
|-----|-------|------------------|-------------|
| ADR-0002 | ADR-0002: Deterministic synchronous event bus | VANGUARD's simulation core must be byte-for-byte reproducible so that move preview, undo, and full-run replay all agree with committed play. This ADR ... | LOW |
| ADR-0011 | ADR-0011: Environmental telegraph query (C4) | Resolves cross-system contract C4: who owns the *environmental* (non-enemy-intent) telegraph and how the three consumers that must account for it stay... | LOW |
| ADR-0008 | ADR-0008: Shared Unit record schema (C2) | Multiple systems independently described "a unit in battle," risking schema drift (`faction` vs `team`, `hp` vs `maxHP`/`currentHP`). This ADR publish... | LOW |

## GDD Requirements
- TR-HUD-001: Covered by ADR-0002
- TR-HUD-002: Covered by ADR-0011
- TR-HUD-003: Covered by ADR-0002
- TR-HUD-004: Covered by ADR-0008
- TR-HUD-005: Covered by None (Design/Presentation)

## Definition of Done
This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from the GDD are verified
- All Logic and Integration stories have passing test files in `tests/`
