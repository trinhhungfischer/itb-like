<Epic: Ability Upgrades>
> **Layer**: Feature
> **GDD**: design/gdd/ability-upgrades.md
> **Architecture Module**: Ability Upgrades
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories ability-upgrades`

## Overview
Ability Upgrades is the between-battle progression layer that lets the player permanently strengthen a specific hero's signature verb across a run — the mechanical home of Pillar #3's promise that all variety lives in the draft, never in battle RNG. It defines a small, closed catalog of upgrade **categories** (Damage Boost, Extra Use, Push Distance Boost, Immunity), a per-hero **Upgrade Slot** model, and the deterministic **additive-delta** resolution function that Heroes & Abilities' `compileEffects()` (that document's Formula F5) must consult when binding an ability's effect chain. This system does not decide *when* or *how* an upgrade is offered to the player — that is Draft / Loadout Meta's job (✅ Designed) — it only defines what an upgrade *is*, what it can legally target, how multiple upgrades combine, and the exact runtime contract that makes an upgraded ability's preview and resolution just as trustworthy as an un-upgraded one (Pillar #1).

## Governing ADRs
| ADR | Title | Decision Summary | Engine Risk |
|-----|-------|------------------|-------------|
| ADR-0006 | ADR-0006: Combat `resolve()` as the single board-mutation path + 10-primitive vocabulary | Combat Resolution's `resolve(board, effects[]) → events[]` is the single, exclusive path that mutates board state, and it does so through a **closed v... | LOW |
| ADR-0007 | ADR-0007: Snapshot-based undo & preview reuse one simulation | Both in-phase undo and pre-commit Move Preview are built on a single mechanism — `Board.snapshot()` — feeding the single simulation `Combat.resolve()`... | LOW |
| ADR-0008 | ADR-0008: Shared Unit record schema (C2) | Multiple systems independently described "a unit in battle," risking schema drift (`faction` vs `team`, `hp` vs `maxHP`/`currentHP`). This ADR publish... | LOW |
| ADR-0003 | ADR-0003: Run Persistence save schema & versioning | Pins the on-disk save format for VANGUARD's browser-local persistence: a `{schemaVersion, checksum, data}` envelope written to `window.localStorage` u... | LOW |

## GDD Requirements
- TR-UPGRADE-001: Covered by ADR-0006, ADR-0007
- TR-UPGRADE-002: Covered by ADR-0008
- TR-UPGRADE-003: Covered by ADR-0003
- TR-UPGRADE-004: Covered by None (Design/Presentation)
- TR-UPGRADE-005: Covered by None (Design/Presentation)

## Definition of Done
This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from the GDD are verified
- All Logic and Integration stories have passing test files in `tests/`
