<Epic: Run Structure / Node Map>
> **Layer**: Feature
> **GDD**: design/gdd/run-structure-node-map.md
> **Architecture Module**: Run Structure / Node Map
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories run-structure-node-map`

## Overview
Run Structure / Node Map is the **campaign map** that frames one entire VANGUARD run: a single-region, Slay-the-Spire-style directed graph of nodes — **Battle**, **Elite**, **Reward**, **Event**, **Rest**, and a single terminal **Boss** — generated once, deterministically, from the run's seed, and revealed to the player **in full** the moment the run begins. It owns the map's topology (which nodes exist, how they connect), each node's type and difficulty tier, the player's current position and path-choice legality (which nodes are reachable *right now*), and the run-level bookkeeping that turns a sequence of individually-resolved nodes into a single Victory (reach and clear the Boss) or Defeat (lose any Battle/Elite/Boss node). It is the seam between the deterministic battle core (Turn & Phase Manager, Combat Resolution, Objective / Win-Lose) and the roguelike meta layer (Draft / Loadout Meta, Meta-progression / Unlocks): it decides **when** a battle happens and **how hard**, but never **how** a battle resolves — that remains entirely the battle core's job, called out to once per Battle/Elite/Boss node via Encounter Generator and Turn & Phase Manager. This system exists because Pillar #3 (Variety Lives in the Draft, Not the Dice) needs a *frame* for the draft to live in — the node map is the thing the player is actually navigating between hero-draft decisions, and Pillar #1 (Perfect Information, Perfect Blame) demands that frame be **fully visible, no fog of war**: the player always knows the whole shape of the road ahead, even if not what waits inside each still-unresolved battle.

## Governing ADRs
| ADR | Title | Decision Summary | Engine Risk |
|-----|-------|------------------|-------------|
| ADR-0003 | ADR-0003: Run Persistence save schema & versioning | Pins the on-disk save format for VANGUARD's browser-local persistence: a `{schemaVersion, checksum, data}` envelope written to `window.localStorage` u... | LOW |
| ADR-0004 | ADR-0004: mulberry32 PRNG seed strategy (procedural only) | VANGUARD needs reproducible procedural variety (map layout, encounter assembly, draft offers) without introducing any non-determinism into battle reso... | LOW |
| ADR-0005 | ADR-0005: Board/Combat error contract (Result vs throw) | Establishes a single, project-wide rule for how the Board & Grid and Combat Resolution layers signal a refused operation: **expected gameplay rejectio... | LOW |
| ADR-0010 | ADR-0010: Difficulty/tier ownership chain (C1) | Resolves cross-system contract C1: who owns a battle node's difficulty tier and who is allowed to call the Encounter Generator. Establishes a single o... | LOW |
| ADR-0008 | ADR-0008: Shared Unit record schema (C2) | Multiple systems independently described "a unit in battle," risking schema drift (`faction` vs `team`, `hp` vs `maxHP`/`currentHP`). This ADR publish... | LOW |

## GDD Requirements
- TR-PERSIST-001: Covered by ADR-0003
- TR-PERSIST-002: Covered by ADR-0003
- TR-PERSIST-003: Covered by ADR-0003
- TR-PERSIST-004: Covered by ADR-0003
- TR-PERSIST-005: Covered by ADR-0004, ADR-0003
- TR-PERSIST-006: Covered by ADR-0005, ADR-0003
- TR-PERSIST-007: Covered by ADR-0003
- TR-PERSIST-008: Covered by None (Design/Presentation)
- TR-RUNMAP-001: Covered by ADR-0004
- TR-RUNMAP-002: Covered by ADR-0010
- TR-RUNMAP-003: Covered by ADR-0010
- TR-RUNMAP-004: Covered by ADR-0008
- TR-RUNMAP-005: Covered by ADR-0010
- TR-RUNMAP-006: Covered by None (Design/Presentation)
- TR-RUNMAP-007: Covered by ADR-0003
- TR-MAPUI-001: Covered by None (Design/Presentation)
- TR-MAPUI-002: Covered by ADR-0010
- TR-MAPUI-003: Covered by None (Design/Presentation)
- TR-MAPUI-004: Covered by None (Design/Presentation)

## Definition of Done
This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from the GDD are verified
- All Logic and Integration stories have passing test files in `tests/`
