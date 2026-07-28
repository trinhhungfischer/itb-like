<Epic: Difficulty Tiers>
> **Layer**: Feature
> **GDD**: design/gdd/difficulty-tiers.md
> **Architecture Module**: Difficulty Tiers
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories difficulty-tiers`

## Overview
Difficulty Tiers is the system that turns "harder" into a precise, numbered, **complexity-driven** configuration rather than a vague slider or a dice roll. It owns the ordered sequence of difficulty **tiers** (Ascension-style, numbered `1..max_tier`), the pure formulas that translate a tier number into a concrete `DifficultyConfig` bundle (target solution-depth band, narrowness ceiling, enemy-count scaling, an enemy-composition **complexity budget**, and the eligible Encounter Template pool), and the thin orchestration entry point that assembles that bundle and calls Encounter Generator's `generateEncounter()` on a caller's behalf. It is deliberately **not** a content system: it never invents an enemy, a terrain tile, or a board size — every tier only ever *selects among* and *bounds* content that Encounter Generator's templates and Enemy, Abilities & Telegraph's archetype catalog already declare (mirroring `encounter-generator.md`'s own "constrained variation, not free generation" rule). This is what makes "escalating difficulty" mechanically true to the game's founding constraint: **more enemies, tighter boards, richer telegraph combinations, and tougher enemy ability sets all come from authored complexity that a tier number unlocks or scales, never from random chance** (Pillars #1 and #3). The system exists so that "Tier 7" means something exact and reproducible — the same tier, on the same node, with the same roster, always assembles the same `DifficultyConfig` and therefore the same solvability/interest guarantees Encounter Generator already provides.

## Governing ADRs
| ADR | Title | Decision Summary | Engine Risk |
|-----|-------|------------------|-------------|
| ADR-0010 | ADR-0010: Difficulty/tier ownership chain (C1) | Resolves cross-system contract C1: who owns a battle node's difficulty tier and who is allowed to call the Encounter Generator. Establishes a single o... | LOW |
| ADR-0004 | ADR-0004: mulberry32 PRNG seed strategy (procedural only) | VANGUARD needs reproducible procedural variety (map layout, encounter assembly, draft offers) without introducing any non-determinism into battle reso... | LOW |
| ADR-0003 | ADR-0003: Run Persistence save schema & versioning | Pins the on-disk save format for VANGUARD's browser-local persistence: a `{schemaVersion, checksum, data}` envelope written to `window.localStorage` u... | LOW |

## GDD Requirements
- TR-DIFF-001: Covered by ADR-0010
- TR-DIFF-002: Covered by ADR-0010, ADR-0004
- TR-DIFF-003: Covered by ADR-0010
- TR-DIFF-004: Covered by None (Design/Presentation)
- TR-DIFF-005: Covered by ADR-0010, ADR-0003

## Definition of Done
This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from the GDD are verified
- All Logic and Integration stories have passing test files in `tests/`
