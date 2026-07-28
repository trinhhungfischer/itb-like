<Epic: Meta-progression / Unlocks>
> **Layer**: Feature
> **GDD**: design/gdd/meta-progression-and-unlocks.md
> **Architecture Module**: Meta-progression / Unlocks
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories meta-progression-unlocks`

## Overview
Meta-progression / Unlocks is the **account-level, cross-run persistent progression layer**: the system that decides which heroes, enemy variants, Ascension (difficulty tier) offsets, and Starting Roster Draft options a given player currently has access to, and the deterministic criteria that grow that access over time. It owns exactly four things: the **Unlock Catalog** (a closed, data-authored table of `UnlockDefinition`s — what can be unlocked and under what condition), the **cumulative `MetaStatistics`** record that those conditions are evaluated against (runs completed, tiers reached, heroes used, enemies encountered), the single deterministic evaluation pass (`processRunEnd`) that runs exactly once at the end of every run and fires any newly-satisfied unlocks, and the read-only unlock-state interfaces that Draft / Loadout Meta (hero catalog filter), Difficulty Tiers (unlocked Ascension ceiling), and Draft / Loadout Meta's Starting Roster Draft (candidate-count bonus) each consume. It does **not** own hero/enemy/ability *content* (Heroes & Abilities, Enemy, Abilities & Telegraph own what a hero or archetype *is*), the per-run Roster or Draft flow (Draft / Loadout Meta), the difficulty curve itself (Difficulty Tiers), or the save-file mechanics (Run Persistence — this document only defines the Meta Save payload shape that domain already anticipates). Critically, per `game-concept.md`'s founding design ("player growth is primarily KNOWLEDGE and OPTIONS, not raw power") and the explicit anti-pillar ("NOT a power-creep roster"), **every unlock this system can ever grant widens what exists, never how strong any single thing is** — an unlocked hero is not stronger than an already-unlocked one (Heroes & Abilities' Pillar #4 already forbids that), an unlocked Ascension offset is strictly *harder*, never easier, and an unlocked Starting Option only ever adds *candidates to choose from*, never a stat bonus.

## Governing ADRs
| ADR | Title | Decision Summary | Engine Risk |
|-----|-------|------------------|-------------|
| ADR-0008 | ADR-0008: Shared Unit record schema (C2) | Multiple systems independently described "a unit in battle," risking schema drift (`faction` vs `team`, `hp` vs `maxHP`/`currentHP`). This ADR publish... | LOW |
| ADR-0003 | ADR-0003: Run Persistence save schema & versioning | Pins the on-disk save format for VANGUARD's browser-local persistence: a `{schemaVersion, checksum, data}` envelope written to `window.localStorage` u... | LOW |
| ADR-0004 | ADR-0004: mulberry32 PRNG seed strategy (procedural only) | VANGUARD needs reproducible procedural variety (map layout, encounter assembly, draft offers) without introducing any non-determinism into battle reso... | LOW |

## GDD Requirements
- TR-META-001: Covered by ADR-0008
- TR-META-002: Covered by ADR-0003
- TR-META-003: Covered by ADR-0004
- TR-META-004: Covered by None (Design/Presentation)

## Definition of Done
This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from the GDD are verified
- All Logic and Integration stories have passing test files in `tests/`
