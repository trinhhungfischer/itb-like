# Systems Index: VANGUARD

> **Status**: Draft
> **Created**: 2026-07-27
> **Last Updated**: 2026-07-27
> **Source Concept**: design/gdd/game-concept.md

---

## Overview

VANGUARD is a deterministic tactical roguelike (Into-the-Breach-like) played on a
chess-grid, with a light 4X-lite meta layer. Its mechanical scope divides into a
**deterministic battle core** (grid, turn structure, combat resolution with
push/pull/collision, unique hero verbs, telegraphed enemies, and a full move
preview) and a **roguelike meta layer** (procedurally generated encounters, a
node-map run, between-battle drafting, upgrades, and persistent unlocks). Per the
game pillars, all in-battle randomness is forbidden — variety lives in the draft,
not the dice — so the highest-value systems are the battle core (which must be
deterministic and legible) plus the encounter generator (which must guarantee
solvable, interesting battles). The target build is pure web (TypeScript + PixiJS
+ Vite); no native engine, no networking.

---

## Systems Enumeration

| # | System Name | Category | Priority | Status | Design Doc | Depends On |
|---|-------------|----------|----------|--------|------------|------------|
| 1 | Board & Grid | Core | MVP | Designed | design/gdd/board-and-grid.md | — |
| 2 | Turn & Phase Manager | Core | MVP | Designed | design/gdd/turn-and-phase-manager.md | Board & Grid |
| 3 | Combat Resolution | Gameplay | MVP | Designed | design/gdd/combat-resolution.md | Board & Grid, Turn & Phase Manager |
| 4 | Heroes & Abilities | Gameplay | MVP | Designed | design/gdd/heroes-and-abilities.md | Combat Resolution, Board & Grid |
| 5 | Enemy, Abilities & Telegraph | Gameplay | MVP | Designed | design/gdd/enemy-abilities-and-telegraph.md | Combat Resolution, Board & Grid |
| 6 | Move Preview | Gameplay | MVP | Designed | design/gdd/move-preview.md | Combat Resolution, Board & Grid, Heroes & Abilities, Enemy, Abilities & Telegraph |
| 7 | Objective / Win-Lose | Gameplay | MVP | Designed | design/gdd/objective-and-win-lose.md | Turn & Phase Manager, Combat Resolution |
| 8 | Input & Selection (inferred) | Core | MVP | Designed | design/gdd/input-and-selection.md | Board & Grid |
| 9 | Board Rendering & Juice (inferred) | UI | MVP | Designed | design/gdd/board-rendering-and-juice.md | Board & Grid, Combat Resolution |
| 10 | Battle HUD (inferred) | UI | MVP | Designed | design/gdd/battle-hud.md | Combat Resolution, Heroes & Abilities, Enemy, Abilities & Telegraph, Objective / Win-Lose, Move Preview, Input & Selection, Board & Grid |
| 11 | Run Persistence (inferred) | Persistence | Vertical Slice | Designed | design/gdd/run-persistence.md | — |
| 12 | Encounter Generator | Gameplay | Vertical Slice | Designed | design/gdd/encounter-generator.md | Enemy, Abilities & Telegraph, Board & Grid, Combat Resolution, Turn & Phase Manager, Heroes & Abilities, Objective / Win-Lose |
| 13 | Run Structure / Node Map | Gameplay | Vertical Slice | Designed | design/gdd/run-structure-node-map.md | Difficulty Tiers, Objective / Win-Lose, Turn & Phase Manager |
| 14 | Draft / Loadout Meta | Progression | Vertical Slice | Designed | design/gdd/draft-and-loadout-meta.md | Heroes & Abilities, Ability Upgrades, Run Structure / Node Map |
| 15 | Ability Upgrades | Progression | Vertical Slice | Designed | design/gdd/ability-upgrades.md | Heroes & Abilities |
| 16 | Difficulty Tiers | Gameplay | Vertical Slice | Designed | design/gdd/difficulty-tiers.md | Encounter Generator, Enemy, Abilities & Telegraph |
| 17 | Meta-progression / Unlocks | Progression | Vertical Slice | Designed | design/gdd/meta-progression-and-unlocks.md | Run Persistence, Heroes & Abilities, Draft / Loadout Meta |
| 18 | Map/Run UI (inferred) | UI | Vertical Slice | Designed | design/gdd/map-run-ui.md | Run Structure / Node Map, Draft / Loadout Meta, 4X-lite Node Bonuses |
| 19 | Draft/Loadout UI (inferred) | UI | Vertical Slice | Designed | design/gdd/draft-loadout-ui.md | Draft / Loadout Meta |
| 20 | Audio System | Audio | Vertical Slice | Designed | design/gdd/audio-system.md | Combat Resolution, Turn & Phase Manager, Enemy, Abilities & Telegraph, Move Preview |
| 21 | Onboarding / Tutorial (inferred) | Meta | Vertical Slice | Designed | design/gdd/onboarding-tutorial.md | Battle HUD, Heroes & Abilities, Enemy, Abilities & Telegraph, Combat Resolution |
| 22 | Pilots / Hero Modifiers | Progression | Alpha | Not Started | — | Heroes & Abilities |
| 23 | 4X-lite Node Bonuses | Gameplay | Alpha | Not Started | — | Run Structure / Node Map |
| 24 | Accessibility (inferred) | Meta | Alpha | Not Started | — | Battle HUD, Board Rendering & Juice |
| 25 | Settings / Options (inferred) | Meta | Alpha | Not Started | — | Audio System, Input & Selection, Accessibility |

---

## Categories

| Category | Description | Systems in This Game |
|----------|-------------|----------------------|
| **Core** | Foundation systems everything depends on | Board & Grid, Turn & Phase Manager, Input & Selection |
| **Gameplay** | The systems that make the game fun | Combat Resolution, Heroes & Abilities, Enemy, Abilities & Telegraph, Move Preview, Objective / Win-Lose, Encounter Generator, Run Structure / Node Map, Difficulty Tiers, 4X-lite Node Bonuses |
| **Progression** | How the player grows over time | Ability Upgrades, Pilots / Hero Modifiers, Draft / Loadout Meta, Meta-progression / Unlocks |
| **Persistence** | Save state and continuity | Run Persistence |
| **UI** | Player-facing information displays | Board Rendering & Juice, Battle HUD, Map/Run UI, Draft/Loadout UI |
| **Audio** | Sound and music systems | Audio System |
| **Meta** | Systems outside the core game loop | Onboarding / Tutorial, Accessibility, Settings / Options |

*(No Economy or Narrative category — VANGUARD has no currency-driven economy in v1
and only light narrative framing.)*

---

## Priority Tiers

| Tier | Definition | Target Milestone | Design Urgency |
|------|------------|------------------|----------------|
| **MVP** | Required for the core loop to function. Without these, you can't test "is this fun?" | First playable single-battle prototype | Design FIRST |
| **Vertical Slice** | Required for one complete short run. Demonstrates the full experience. | Vertical slice / demo | Design SECOND |
| **Alpha** | All features present in rough form. Complete mechanical scope, placeholder content OK. | Alpha milestone | Design THIRD |
| **Full Vision** | Polish + content-complete (multiple regions, bosses, 12+ heroes). Mostly content, not new systems. | Beta / Release | Design as needed |

---

## Dependency Map

### Foundation Layer (no dependencies)

1. **Board & Grid** — the tile grid everything is placed on; the literal board of the game.
2. **Run Persistence** — serializes run/meta state to localStorage; no gameplay dependency.

### Core Layer (depends on foundation)

1. **Turn & Phase Manager** — depends on: Board & Grid.
2. **Input & Selection** — depends on: Board & Grid.
3. **Combat Resolution** — depends on: Board & Grid, Turn & Phase Manager. *Must be a pure deterministic function (state → state) so Move Preview can reuse it.*

### Feature Layer (depends on core)

1. **Heroes & Abilities** — depends on: Combat Resolution, Board & Grid. Abilities are defined in terms of Combat's effect primitives (damage / push / pull / spawn-hazard).
2. **Enemy, Abilities & Telegraph** — depends on: Combat Resolution, Board & Grid. Covers the enemy roster, their **attack abilities + special/on-death effects** (explode, spawn, leave hazard — ITB-style), deterministic target-selection AI, **telegraph** (signaling the chosen next action), and spawning. Enemy abilities use the same Combat effect primitives as hero abilities.
3. **Move Preview** — depends on: Combat Resolution. Simulates resolution without applying it.
4. **Objective / Win-Lose** — depends on: Turn & Phase Manager, Combat Resolution.
5. **Ability Upgrades** — depends on: Heroes & Abilities.
6. **Pilots / Hero Modifiers** — depends on: Heroes & Abilities.
7. **Encounter Generator** — depends on: Enemy, Abilities & Telegraph, Board & Grid, Combat Resolution.
8. **Difficulty Tiers** — depends on: Encounter Generator, Enemy, Abilities & Telegraph.
9. **Run Structure / Node Map** — depends on: Encounter Generator, Objective / Win-Lose.
10. **Draft / Loadout Meta** — depends on: Heroes & Abilities, Ability Upgrades, Run Structure / Node Map.
11. **4X-lite Node Bonuses** — depends on: Run Structure / Node Map.
12. **Meta-progression / Unlocks** — depends on: Run Persistence, Heroes & Abilities, Draft / Loadout Meta.

### Presentation Layer (depends on features)

1. **Board Rendering & Juice** — depends on: Board & Grid, Combat Resolution.
2. **Battle HUD** — depends on: Combat Resolution, Heroes & Abilities, Enemy, Abilities & Telegraph, Objective / Win-Lose, Move Preview.
3. **Map/Run UI** — depends on: Run Structure / Node Map, Draft / Loadout Meta, 4X-lite Node Bonuses.
4. **Draft/Loadout UI** — depends on: Draft / Loadout Meta.
5. **Audio System** — depends on: Combat Resolution (event hooks).

### Polish Layer (depends on everything)

1. **Onboarding / Tutorial** — depends on: Battle HUD, Heroes & Abilities, Enemy, Abilities & Telegraph.
2. **Accessibility** — depends on: Battle HUD, Board Rendering & Juice.
3. **Settings / Options** — depends on: Audio System, Input & Selection, Accessibility.

---

## Recommended Design Order

| Order | System | Priority | Layer | Agent(s) | Est. Effort |
|-------|--------|----------|-------|----------|-------------|
| 1 | Board & Grid | MVP | Foundation | game-designer, systems-designer | S |
| 2 | Turn & Phase Manager | MVP | Core | game-designer, systems-designer | S |
| 3 | Combat Resolution | MVP | Core | game-designer, systems-designer | L |
| 4 | Heroes & Abilities | MVP | Feature | game-designer, systems-designer | L |
| 5 | Enemy, Abilities & Telegraph | MVP | Feature | game-designer, ai-programmer | M |
| 6 | Move Preview | MVP | Feature | game-designer, gameplay-programmer | M |
| 7 | Objective / Win-Lose | MVP | Feature | game-designer, systems-designer | S |
| 8 | Input & Selection | MVP | Core | game-designer, ux-designer | S |
| 9 | Board Rendering & Juice | MVP | Presentation | game-designer, art-director, technical-artist | M |
| 10 | Battle HUD | MVP | Presentation | game-designer, ux-designer, art-director | M |
| 11 | Run Persistence | Vertical Slice | Foundation | systems-designer, gameplay-programmer | S |
| 12 | Encounter Generator | Vertical Slice | Feature | game-designer, systems-designer | L |
| 13 | Run Structure / Node Map | Vertical Slice | Feature | game-designer, level-designer | M |
| 14 | Draft / Loadout Meta | Vertical Slice | Feature | game-designer, economy-designer | M |
| 15 | Ability Upgrades | Vertical Slice | Feature | game-designer, systems-designer | M |
| 16 | Difficulty Tiers | Vertical Slice | Feature | game-designer, systems-designer | M |
| 17 | Meta-progression / Unlocks | Vertical Slice | Feature | game-designer, economy-designer | M |
| 18 | Map/Run UI | Vertical Slice | Presentation | game-designer, ux-designer | M |
| 19 | Draft/Loadout UI | Vertical Slice | Presentation | game-designer, ux-designer | M |
| 20 | Audio System | Vertical Slice | Presentation | game-designer, audio-director | S |
| 21 | Onboarding / Tutorial | Vertical Slice | Polish | game-designer, ux-designer | M |
| 22 | Pilots / Hero Modifiers | Alpha | Feature | game-designer, systems-designer | M |
| 23 | 4X-lite Node Bonuses | Alpha | Feature | game-designer, systems-designer | M |
| 24 | Accessibility | Alpha | Polish | accessibility-specialist, ux-designer | M |
| 25 | Settings / Options | Alpha | Polish | game-designer, ux-designer | S |

*Effort: S = 1 session, M = 2-3 sessions, L = 4+ sessions.*

---

## Circular Dependencies

- **None found.** The potential Combat ↔ Abilities and Combat ↔ Enemy cycles are
  broken by an architectural convention: **Combat Resolution owns the effect
  primitives** (damage, push, pull, spawn-hazard, apply-hazard). Both Heroes &
  Abilities and Enemy, Abilities & Telegraph are defined purely in terms of those primitives,
  so they depend on Combat Resolution one-directionally. *(This convention should
  be recorded as an ADR during `/create-architecture`.)*

---

## High-Risk Systems

| System | Risk Type | Risk Description | Mitigation |
|--------|-----------|-----------------|------------|
| Encounter Generator | Design | Procedurally assembled battles may fail to be consistently solvable AND interesting — Into the Breach hand-tunes heavily. | Template-based generation + an automated solver/validator that rejects unsolvable layouts; prototype early with a small template set. |
| Move Preview | Technical | Showing the full, correct consequence of a planned move across all verb interactions (chained shoves, walls, swaps) requires Combat Resolution to be a pure, replayable simulation. | Design Combat Resolution as a pure function from the start (state → state); build Preview as a dry-run of the same code path, not a parallel reimplementation. |
| Heroes & Abilities | Design/Scope | Verb-first roster (Pillar 4) collides with legibility (Pillar 5) as the roster grows; unique verbs can interact combinatorially and become hard to balance or read. | Small hand-balanced roster (6–8 heroes) for VS; strict "one accent color per verb-family" visual language; cut heroes that don't add a new verb. |

---

## Open Cross-System Contracts (→ resolve in `/create-architecture` as Required ADRs)

Surfaced by the batch consistency pass (2026-07-28). These are shared-contract
decisions, not single-system fixes — they belong in the architecture phase.

| # | Contract | Systems | Recommended resolution |
|---|----------|---------|------------------------|
| C1 | **DifficultyConfig / tier ownership** (was CRITICAL) | run-structure-node-map, difficulty-tiers, encounter-generator | Run Structure calls Difficulty Tiers' `getEncounterForNode()` (not Encounter Generator directly); the returned `tier` is the single source of truth for both Map/Run UI display and the generator's difficulty curve. Drop MapNode.tierIndex (or mark display-only) and add Difficulty Tiers to Run Structure's dependencies. |
| C2 | **Shared `Unit` / `UnitRegistry` record** (+ `hazardImmunities`; + `battle_ended.nodeType`; + `processRunEnd()`) | heroes-and-abilities (owner), enemy-abilities-and-telegraph, objective-and-win-lose, ability-upgrades, draft-and-loadout-meta, turn-and-phase-manager, run-structure-node-map | Formally design the shared per-battle Unit record once (registry entry `unit_record`, status: pending). Thread `hazardImmunities` through Combat's hazard call sites; add `nodeType` to the `battle_ended` event; add `processRunEnd()` to Run Structure's terminal handling. |
| C3 | **Shared `reachableTiles(origin, range, board)` BFS** | board-and-grid (owner), heroes-and-abilities, enemy-abilities-and-telegraph | Extract one shared bounded flood-fill utility both hero movement and enemy movement-to-range consume, instead of two hand-written BFS loops. |
| C4 | **`telegraphedEnvironmentTiles(turn)` query** | enemy-abilities-and-telegraph (likely owner), battle-hud, turn-and-phase-manager | Environmental telegraphs need a queryable tile-set so Battle HUD's `heroesInDanger` safety check covers hazards, not just enemy intents (Pillar #1). |

## Progress Tracker

| Metric | Count |
|--------|-------|
| Total systems identified | 25 |
| Design docs started | 21 |
| Design docs reviewed | 21 |
| Design docs approved | 21 |
| MVP systems designed | 10/10 |
| Vertical Slice systems designed | 11/11 |

*(All 21 MVP+VS GDDs independently design-reviewed 2026-07-28, then reconciled against
`design/architecture/cross-system-contracts.md`. Alpha #22–#25 remain Not Started.)*

---

## Next Steps

- [ ] Design MVP-tier systems in design order (use `/design-system [system-name]`)
- [ ] Run `/design-review design/gdd/[system].md` on each completed GDD (fresh session)
- [ ] Prototype the two high-risk systems (Encounter Generator, Move Preview) early
- [ ] Run `/gate-check pre-production` when MVP systems are designed
- [ ] Validate the full loop with `/vertical-slice` before committing to Production
