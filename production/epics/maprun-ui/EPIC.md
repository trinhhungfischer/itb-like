<Epic: Map/Run UI>
> **Layer**: Presentation
> **GDD**: design/gdd/map-run-ui.md
> **Architecture Module**: Map/Run UI
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories maprun-ui`

## Overview
Map/Run UI is the player-facing shell around the campaign layer: it renders Run Structure / Node Map's `RunMap` as an explorable, clickable graph (the **map screen**), handles the input flow for choosing and committing to a node (**path selection**), and presents every node-triggered resolution screen that isn't a battle — the Reward offer screen, the Rest heal-vs-train choice, the Event placeholder, the Starting Roster Draft, and the post-Battle/Elite-Victory bonus offer screen (collectively, **reward/event screens**) — by rendering Draft / Loadout Meta's `DraftOffer`/`RestChoice` data and forwarding the player's picks back to it. It also owns the **run summary** screen shown at `run_completed`/`run_abandoned`. This system has no game-rule authority of its own: every number, every offer, every legality check it displays or enforces is computed by Run Structure / Node Map or Draft / Loadout Meta and merely rendered here — Map/Run UI's entire job is to make those systems' guarantees (full map visibility, fully-legible offers, no hidden odds) *actually readable and operable* by a human at a keyboard, which is precisely where Pillar #1 (Perfect Information, Perfect Blame) and Pillar #5 (Read in Ten Seconds) stop being backend promises and start being lived player experience.

## Governing ADRs
| ADR | Title | Decision Summary | Engine Risk |
|-----|-------|------------------|-------------|
| ADR-0010 | ADR-0010: Difficulty/tier ownership chain (C1) | Resolves cross-system contract C1: who owns a battle node's difficulty tier and who is allowed to call the Encounter Generator. Establishes a single o... | LOW |

## GDD Requirements
- TR-MAPUI-001: Covered by None (Design/Presentation)
- TR-MAPUI-002: Covered by ADR-0010
- TR-MAPUI-003: Covered by None (Design/Presentation)
- TR-MAPUI-004: Covered by None (Design/Presentation)

## Definition of Done
This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from the GDD are verified
- All Logic and Integration stories have passing test files in `tests/`
