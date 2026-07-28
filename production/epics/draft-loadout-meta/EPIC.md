<Epic: Draft / Loadout Meta>
> **Layer**: Feature
> **GDD**: design/gdd/draft-and-loadout-meta.md
> **Architecture Module**: Draft / Loadout Meta
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories draft-loadout-meta`

## Overview
Draft / Loadout Meta is the between-battle progression layer that turns a sequence of individually-solvable battles into a **run** with a build the player is accountable for. It owns three things: the **Roster** (the persistent set of recruited heroes for this run, each tracked as a `RosterMember` with HP that carries across battles), the **Loadout** (which `squad_size` Roster members are actually deployed into the next battle), and the **Draft** (the deterministic, seeded offer-and-pick flow that grows the Roster and its heroes' Ability Upgrades at Reward nodes, Rest nodes, and after every Battle/Elite victory). This is the literal mechanical home of Pillar #3: every ounce of run-to-run variety in VANGUARD — which heroes you have, which verbs are upgraded and how, which trade-offs you accepted — is decided here, by the player, with full information, never by an in-battle roll. This document does not decide what a hero *is* (Heroes & Abilities), what an upgrade *does* (Ability Upgrades), or when a node is entered (Run Structure / Node Map) — it decides *which heroes exist in this run, in what shape, and what the player is offered to grow them*.

## Governing ADRs
| ADR | Title | Decision Summary | Engine Risk |
|-----|-------|------------------|-------------|
| ADR-0008 | ADR-0008: Shared Unit record schema (C2) | Multiple systems independently described "a unit in battle," risking schema drift (`faction` vs `team`, `hp` vs `maxHP`/`currentHP`). This ADR publish... | LOW |
| ADR-0003 | ADR-0003: Run Persistence save schema & versioning | Pins the on-disk save format for VANGUARD's browser-local persistence: a `{schemaVersion, checksum, data}` envelope written to `window.localStorage` u... | LOW |
| ADR-0004 | ADR-0004: mulberry32 PRNG seed strategy (procedural only) | VANGUARD needs reproducible procedural variety (map layout, encounter assembly, draft offers) without introducing any non-determinism into battle reso... | LOW |
| ADR-0010 | ADR-0010: Difficulty/tier ownership chain (C1) | Resolves cross-system contract C1: who owns a battle node's difficulty tier and who is allowed to call the Encounter Generator. Establishes a single o... | LOW |

## GDD Requirements
- TR-DRAFT-001: Covered by ADR-0008
- TR-DRAFT-002: Covered by ADR-0008, ADR-0003
- TR-DRAFT-003: Covered by ADR-0004
- TR-DRAFT-004: Covered by None (Design/Presentation)
- TR-DRAFT-005: Covered by ADR-0010
- TR-DRAFT-006: Covered by ADR-0003
- TR-DRAFTUI-001: Covered by None (Design/Presentation)
- TR-DRAFTUI-002: Covered by None (Design/Presentation)
- TR-DRAFTUI-003: Covered by None (Design/Presentation)

## Definition of Done
This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from the GDD are verified
- All Logic and Integration stories have passing test files in `tests/`
