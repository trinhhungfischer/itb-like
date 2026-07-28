<Epic: Run Persistence>
> **Layer**: Foundation
> **GDD**: design/gdd/run-persistence.md
> **Architecture Module**: Run Persistence
> **Status**: Ready
> **Stories**:

| # | Story | Type | Status | ADR |
|---|-------|------|--------|-----|
| 001 | [Envelope Serialization & Round Trip](story-001-envelope-serialization.md) | Logic | Ready | ADR-0003 |
| 002 | [Checksum & Corruption Detection](story-002-checksum-corruption.md) | Logic | Ready | ADR-0003 |
| 003 | [Schema Versioning & Migrations](story-003-schema-versioning.md) | Logic | Ready | ADR-0003 |
| 004 | [Quota, Capability & Memory Mode](story-004-quota-capability.md) | Integration | Ready | ADR-0003 |
| 005 | [Run Lifecycle & Single-Slot Rules](story-005-run-lifecycle.md) | Integration | Ready | ADR-0003, ADR-0005 |
| 006 | [Determinism & Resume Contract](story-006-determinism-resume.md) | Integration | Ready | ADR-0004 |

## Overview
Run Persistence is the browser-local **save system**: it serializes two independent, versioned slices of state — the player's single in-progress **run** (node-map position, roster, draft history, run seed) and their permanent **meta-progression** (unlocked heroes, enemy variants, difficulty tiers, statistics) — to `window.localStorage`, and reliably restores them on the next visit. It owns schema versioning, migration, corruption detection, and quota handling, so that every other system (Run Structure / Node Map, Draft / Loadout Meta, Meta-progression / Unlocks) can read and write persistent state through one trusted, deterministic layer instead of touching `localStorage` directly. Players never see it as a "system"; they feel it as **trust that their progress is safe** — closing the tab and coming back should never cost them a run they cared about (beyond the current, in-progress battle — see Core Rule 3). It exists because a roguelike's retention hook is "an in-progress run and a build you don't want to lose" (game-concept.md); without reliable persistence that hook is just anxiety. Run Persistence is **v1 browser-local only** — no cloud sync, no cross-device continuity, no account system.

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
