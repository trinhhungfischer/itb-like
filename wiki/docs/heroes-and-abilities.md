# Heroes & Abilities

> **Status**: In Design
> **Author**: workflow (design-system fan-out)
> **Last Updated**: 2026-07-27
> **Implements Pillar**: #4 Every Hero Is a Verb; #2 Positioning Over Power; #1 Perfect Information, Perfect Blame; #5 Read in Ten Seconds

## Overview

Heroes & Abilities defines the **hero chassis** (the data schema for a
playable unit: HP, move range, size, and a class tag) and the **Ability
Definition Schema** — a formal, reusable structure that expresses Pillar #4's
promise that *every hero is a verb*: a named ability with a targeting shape,
a target filter, and an ordered template of Combat Resolution effect
primitives, compiled at cast time into the exact effect list that both the
live game and Move Preview execute. A **Loadout** is the squad of hero
instances (`squad_size` heroes) the player brings into one battle. This
system owns *what a hero can do and where it can do it to* — it does not
resolve any effect itself (Combat Resolution owns that), does not decide
enemy behavior (Enemy, Abilities & Telegraph owns that, reusing this same
Ability Definition Schema), and does not decide which heroes a player has
access to across a run (Draft / Loadout Meta owns that). Because the same
`compileEffects()` function is used to build the ordered effect list for both
the real action and its dry-run preview, a hero's ability can never resolve
differently than what the player was shown — this is the mechanical
guarantee that makes Pillar #4's "unique verb" promise trustworthy rather
than just a marketing label, and it is what lets Pillar #2 (Positioning Over
Power) treat `push`/`pull`/`swap` as first-class win conditions rather than
gimmicks bolted onto a damage-centric roster.

## Player Fantasy

**"I am not a generic soldier — I am the one person who can do *this*, and
knowing exactly when to do it is what makes me good."** Each hero hands the
player a single, legible verb (a shove, a pull, a swap, a controlled burn)
rather than a menu of interchangeable attacks; the fantasy is mastery of a
*signature move*, not accumulation of a stat sheet. This primarily serves
**Pillar #4 (Every Hero Is a Verb)** — the emotional promise is "I know
exactly what I bring to this fight, and so does the puzzle" — and
**Pillar #2 (Positioning Over Power)**, where a hero who never deals a point
of damage can still decide a battle by *where* they put an enemy. It also
serves the MDA aesthetics of **Expression** (the loadout you draft becomes
your signature build) and **Discovery** (finding that Shove-into-Chasm or
Pull-then-Swap combo is the "aha!" the whole game is built around). Because
every ability's preview is byte-identical to its resolution (Pillar #1), the
player's fantasy is never undercut by an ability doing something other than
what was shown — the verb always does exactly what it promised. The failure
state of this system is a hero that feels like a reskinned stat-stick (no
unique verb, breaking Pillar #4) or a kit so combinatorially complex it can't
be read on the board in ten seconds (breaking Pillar #5) — the intentional
tension the game concept already names between these two pillars.

## Detailed Design

### Core Rules

1. **Hero chassis schema.** Every hero is defined by a `HeroDefinition`:
   `id`, `name`, `class` (a flavor/UI tag — see Rule 2), `maxHP` (int ≥1),
   `moveRange` (int ≥0, Manhattan-based reachability, Formula F1), `size`
   (fixed at `1` for every hero in v1, per `board-and-grid.md` Core Rule 5 —
   multi-tile heroes are out of scope, deferred by Board & Grid's Open
   Question #7), and exactly one `ability` (its signature verb, Rule 3).
2. **`class` is a non-mechanical tag in v1.** It exists purely as a UI/flavor
   grouping (e.g., "Vanguard," "Support," "Controller") for Draft / Loadout
   Meta to filter or display by. It has **no in-battle mechanical effect**
   in this document. **PROVISIONAL:** if Draft / Loadout Meta later wants
   class-based synergy bonuses, that is an addition to *that* system, not a
   retroactive change to hero chassis fields here.
3. **Exactly one signature ability per hero, no passives, in v1.** A hero's
   entire kit is: the universal Move action (Rule 6, driven by chassis
   `moveRange`) plus one `AbilityDefinition` (its verb). This is a direct
   enforcement of Pillar #4's design test ("if a new hero is merely
   *stronger* than an existing one, cut it — it must bring a new verb"): a
   one-ability roster makes every hero's identity legible and impossible to
   pad with incremental stat bonuses. Passive traits, multi-ability kits,
   and hero-level modifiers are explicitly deferred to **Pilots / Hero
   Modifiers** (`Not Started`, Alpha tier per `systems-index.md`) and
   **Ability Upgrades** (`Designed`, Vertical Slice tier) — this document
   defines only the base v1 kit shape.
4. **Action economy.** During Player Phase, each *living* hero has exactly
   two independent action slots per turn: a **Move slot** (used 0 or 1
   times) and an **Ability slot** (used 0 or 1 times). Both are optional and
   may be used in **either order** — Move-then-Ability, Ability-then-Move,
   either alone, or neither (a full pass). This fixes
   `actions_per_hero_turn` (the `A_max` value `turn-and-phase-manager.md`'s
   Formula F2 references as an external dependency) at **2**, resolving that
   document's Open Question #6. A hero that has been `Removed` (Rule 13) has
   zero available slots — it is never offered any action, in any phase, for
   the remainder of the battle.
5. **Loadout schema.** A `Loadout` is exactly `squad_size` (the `H` value
   `turn-and-phase-manager.md`'s Formula F2 references) **distinct**
   `HeroDefinition` instances — no duplicate hero definitions within one
   Loadout in v1 (a squad never fields two copies of the same verb; this
   keeps every turn's option set legible, Pillar #5). `squad_size` defaults
   to **3** (Tuning Knobs). Selecting *which* heroes populate a Loadout
   across a run, and persisting that choice, is owned by **Draft / Loadout
   Meta** — this document only defines what a valid Loadout instance
   contains and validates the "no duplicates" / "exactly `squad_size`
   members" invariants.
6. **Move action.** A hero's Move slot, when used, relocates it to any tile
   in its **legal move set** (Formula F1): the result of Board & Grid's
   `reachableTiles(origin, moveRange, board)` bounded flood-fill — the
   single shared implementation also consumed by Enemy movement-to-range
   (`cross-system-contracts.md` §2, resolves C3) — restricted to tiles that
   classify as `Clear` at every intermediate and final step (per
   `combat-resolution.md` Rule 13 — a hero can never voluntarily step onto
   Blocked, Lethal, or Occupied terrain; only forced displacement via
   `push`/`pull` can place a unit on Lethal terrain, e.g. Rule 10's Vanguard
   example). Heroes & Abilities calls this shared query — it does not
   maintain its own flood-fill — and is responsible for offering only legal
   destinations to the player and to Move Preview; Combat Resolution's Move
   wrapper trusts that pre-validation (it does not re-derive legality).
7. **Targets are recomputed from the hero's current position at selection
   time.** If the Move slot is used before the Ability slot, the Ability's
   legal target set (Rule 8, Formula F2) is computed from the hero's
   **post-move** tile, not its turn-start tile. This is intentional
   tactical depth (move-then-strike vs. strike-then-reposition are
   different plays), not an inconsistency — Move Preview must always show
   targets computed from the board state that would actually exist at that
   point in the plan.
8. **Ability targeting shapes.** An `AbilityDefinition` declares exactly one
   `shape` from a closed set of five (Formulas F2–F3 give the precise
   geometry for each):
   - **Self** — no target selection; the ability always affects the caster.
   - **SingleTile** — the player picks exactly one tile from
     `tilesInRange(casterTile, range)`.
   - **UnitTarget** — the player picks exactly one *unit* whose tile is in
     `tilesInRange(casterTile, range)` and `isOccupied`.
   - **Line** — the player picks one cardinal `direction`; the target set is
     `rayTiles(casterTile, direction, range)` (Formula F3).
   - **Area** — the player picks one origin tile from
     `tilesInRange(casterTile, range)` (as SingleTile), then the ability
     affects `tilesInRange(chosenOrigin, areaRadius)` (a second,
     ability-defined radius, distinct from `range`).
9. **Target filters.** Independently of shape, an `AbilityDefinition`
   declares a `targetFilter` that further restricts *who/what* qualifies:
   `Self`, `Ally`, `Enemy`, `AnyUnit`, `EmptyTile`, or `AnyTile`. A filter of
   `Ally` or `AnyUnit` is explicitly permitted — an ability may target the
   caster's own allies (e.g., a rescue-pull that yanks a teammate out of a
   telegraphed hit). Whether a given hero's ability can target allies,
   enemies, or both is a per-ability authoring choice, not a system-wide
   restriction (Rule 14).
10. **Orthogonal alignment for push/pull-style abilities.** Any ability
    whose effect template includes a `push` or `pull` primitive must
    guarantee a well-defined orthogonal `direction` at cast time — Combat
    Resolution never infers it (per `combat-resolution.md` Rule 5). Two
    authoring patterns satisfy this, and every push/pull ability in this
    document uses one of them:
    - **Target-then-direction**: shape `UnitTarget` with `range = 1`.
      Because a Manhattan disk of radius 1 is exactly the four orthogonal
      neighbors (`board-and-grid.md` Formula 4 at `R=1`), the target is
      always orthogonally adjacent and the direction (caster→target) is
      unambiguous.
    - **Direction-then-target**: shape `Line` with
      `requiresOrthogonalAlignment` implicitly satisfied by construction
      (a ray is already a single cardinal direction); the ability resolves
      against whichever unit(s) `rayTiles` finds.
    - For `UnitTarget` abilities with `range > 1` that still need
      push/pull (e.g., a ranged pull), the `targetFilter` additionally sets
      `requiresOrthogonalAlignment = true`: the legal-target predicate
      (Formula F2) excludes any tile that does not share the caster's row
      or column, and the direction is computed as target→caster (for
      `pull`) or caster→target (for `push`). This resolves
      `board-and-grid.md`'s Open Question #9 and matches
      `combat-resolution.md`'s Open Question #2 resolution, which explicitly
      assigns this responsibility to Heroes & Abilities.
11. **Effect-chain compilation is the single source of truth for preview and
    resolution.** Every `AbilityDefinition` stores an ordered
    `effectTemplate` — a list of Combat Resolution primitive calls with
    placeholders (`$target`, `$direction`, `$distance`, `$amount`) instead
    of concrete values. `compileEffects(caster, ability, selectedTarget) ->
    EffectPrimitive[]` (Formula F5) is a **pure, deterministic** function
    that binds those placeholders once the player (or, for enemies, the AI)
    has made a selection. This exact function's output is what Move Preview
    dry-runs via `resolve(board.snapshot(), effects)` and what the real
    Player Phase action commits via `resolve(board, effects)`
    (`combat-resolution.md`'s resolution contract) — there is no separate
    "preview description" maintained anywhere; the preview *is* the
    compiled effect chain, rendered.
12. **Multi-target compilation order.** Shapes that can qualify more than
    one unit at once (`Line` passing through several units, `Area` covering
    several units) compile to **one primitive instance per qualifying
    unit**, with all qualifying unit IDs snapshotted once before the chain
    begins (per `combat-resolution.md` Rule 11's target-locking
    requirement). The compilation order is fixed and deterministic:
    nearest-to-farthest along the ray for `Line`; the iteration order of
    `tilesInRange` for `Area`. This ordering never changes at runtime and is
    part of the ability's definition, not computed ad hoc.
13. **HP and defeat.** Heroes participate in Combat Resolution's `damage`,
    `applyHazard`, and `removeUnit` primitives identically to enemies — this
    document defines no hero-specific damage or defeat rule.
    `HeroDefinition.maxHP` is chassis-level (authored data); the runtime
    current-HP value lives on the battle's per-instance Unit record (see
    "Unit Record Schema" above — this document's canonical schema per
    `cross-system-contracts.md` §6). A hero reduced to 0
    HP is `Removed(Defeated)` (or `Removed(Fell)` if displaced into Lethal
    terrain) and, per `combat-resolution.md`'s vitality state model, this is
    permanent for the rest of the battle — there is no revive primitive in
    this document or in Combat Resolution.
14. **Friendly-fire is a per-ability authoring choice, not a system rule.**
    Rule 9 already allows `Ally`/`AnyUnit` target filters; this rule makes
    explicit that a `push`/`pull`/`damage`-carrying ability with an
    `AnyUnit` filter can legally target and harm an ally (e.g., shoving an
    ally into a wall for `collision_damage` is a real, intended possibility,
    not a bug) exactly as it can an enemy. This is deliberate design space:
    it is what makes "pull an ally out of a telegraphed hit" a distinct,
    powerful verb rather than a purely offensive tool, directly serving
    Pillar #2.
15. **`usesPerTurn` and `cooldownTurns`.** Every `AbilityDefinition` in the
    v1 base roster ships with `usesPerTurn = 1` (it consumes the single
    Ability slot once, matching Rule 4) and `cooldownTurns = 0` (no
    cooldown — available every turn the Ability slot is free), matching the
    reference genre (Into the Breach mech weapons have no cooldown; the
    action economy alone paces their use). Both fields are exposed per
    ability as forward-looking hooks for future higher-impact verbs (e.g. a
    3-turn-cooldown "ultimate"); the v1 base kit does not use non-default
    values (Tuning Knobs).
16. **Enemy abilities reuse this exact schema.** `AbilityDefinition` (shape,
    range, `targetFilter`, `effectTemplate`, `compileEffects`) is authored
    here as a **general-purpose structure**, not a hero-only one. Enemy,
    Abilities & Telegraph must construct its enemy actions as instances of
    this same schema, substituting deterministic AI-driven target selection
    for player input — this is the mechanism that lets both hero and enemy
    abilities compile into the identical Combat Resolution primitive
    vocabulary without duplicating targeting logic in two places.

### AbilityDefinition Schema (authoritative)

Every hero and enemy ability is an instance of this schema. Per
`cross-system-contracts.md` §5, `AbilityDefinition` is **owned by Heroes &
Abilities**; Enemy, Abilities & Telegraph reuses it verbatim (Rule 16) rather
than defining its own shape:

```
AbilityDefinition {
  shape: Self | SingleTile | UnitTarget | Line | Area        // Rule 8
  range: int                                                  // ability-defined, Tuning Knobs
  areaRadius?: int                                            // Area shape only, Rule 8
  targetFilter: {
    kind: Self | Ally | Enemy | AnyUnit | EmptyTile | AnyTile // Rule 9
    requiresOrthogonalAlignment?: bool                        // Rule 10
  }
  effectTemplate: EffectTemplateStep[]      // ordered Combat Resolution
                                             // primitive calls with
                                             // placeholders ($target,
                                             // $direction, $distance,
                                             // $amount) — Rule 11
  usesPerTurn: int                          // fixed 1 in v1, Rule 15
  cooldownTurns: int                        // fixed 0 in v1, Rule 15
  compileEffects(caster, selectedTarget) -> EffectPrimitive[]   // Formula F5
}
```

The contract's four load-bearing fields — `shape`, `targetFilter`,
`effectTemplate`, `compileEffects()` — are exactly `AbilityDefinition`'s
targeting geometry, its who/what restriction, its ordered primitive
template, and the pure binding function that turns a selection into a
concrete effect list (Rule 11, Formula F5); `range`, `areaRadius`,
`usesPerTurn`, and `cooldownTurns` are the ability-authored parameters those
four fields need. Each `effectTemplate` step is a call into one of the **10
Combat Resolution primitives** (`damage`, `push`, `pull`, `swap`,
`spawnHazard`, `applyHazard`, `removeUnit`, `setTerrain`, `spawnUnit`, or the
shared collision-resolution algorithm implicitly triggered by `push`/`pull`)
— see Dependencies. `compileEffects` is a method on the ability instance, so
both Heroes & Abilities and Enemy, Abilities & Telegraph call
`ability.compileEffects(...)` identically regardless of which system
authored the ability.

### Unit Record Schema (authoritative)

The canonical per-battle `Unit` record. Per `cross-system-contracts.md` §6
and registry entry `unit_record`, this record is **owned by Heroes &
Abilities** and is *referenced, not re-shaped*, by Enemy, Abilities &
Telegraph, Objective / Win-Lose, Ability Upgrades, and Draft / Loadout Meta:

```
Unit {
  id: UnitId
  team: Hero | Enemy
  archetype: HeroDefinition.id | EnemyDefinition.id   // which chassis this instance is
  maxHP: int                        // copied from chassis data at battle Setup
  currentHP: int                    // runtime; mutated by damage / applyHazard
  position: tile                    // mirrors Board occupancy; kept in sync by Combat Resolution
  size: int                         // fixed 1 in v1 (Board & Grid Core Rule 5)
  abilities: AbilityDefinition[]    // length 1 for heroes in v1 (Rule 3)
  hazardImmunities: HazardType[]    // threaded through Combat's applyHazard / hazard-on-entry call sites
  statusFlags: StatusFlag[]         // reserved, empty in v1 base kit
}
```

A hero's `Unit` record is instantiated at battle Setup from its
`HeroDefinition`: `maxHP` is copied, `abilities` is populated from the
chassis' single `ability`, `currentHP = maxHP`, and `hazardImmunities = []`
unless a future Pilots / Hero Modifiers override sets one. `HeroDefinition`
(authored, chassis-level data) and `Unit` (runtime, per-battle instance
data) are deliberately distinct: `HeroDefinition` has no `currentHP`/
`position`, and `Unit` has no `class`/flavor fields. This is the record Rule
13 refers to as "the battle's per-instance Unit record."

### States and Transitions

**Hero vitality** (per hero instance): shares `combat-resolution.md`'s unit
vitality model exactly — `Alive ↔ Removed(Defeated | Fell)`. No
hero-specific vitality states exist; this document adds no new transition.

**Loadout / deployment lifecycle** (per hero instance, per battle):

`NotDeployed → Deployed(tile) → {Active | Removed}`

- `NotDeployed → Deployed(tile)`: at battle Setup, Encounter Generator
  places each Loadout hero onto a tile flagged `deploy-zone` — Board &
  Grid's flag set now includes `deploy-zone` alongside `spawn-point` and
  `objective` (`cross-system-contracts.md` §2), authored by Encounter
  Generator and stored/exposed by Board & Grid.
- `Deployed → Active`: the default state for the rest of the battle while
  `Alive`.
- `Active → Removed`: on defeat (Rule 13); terminal, no return transition.

**Action-slot state** (per living hero, per Player Phase — reset at Turn
Start, mirrors Turn & Phase Manager's undo-stack scoping):

| Slot | States | Forward transition | Rollback transition |
|------|--------|---------------------|----------------------|
| Move | `Available → Used` | Player issues a Move action | `Used → Available` when the Turn Manager's `undo()` restores the Board snapshot from before this action — slot bookkeeping is restored in lockstep with the Board snapshot, at the same undo depth |
| Ability | `Available → Used` | Player issues an Ability action | Same rollback rule as Move |

Both slots reset to `Available` for every living hero at the start of each
new Player Phase (Turn Start), independent of the previous turn's usage —
there is no carry-over or banking of unused slots (matches the ITB
reference and keeps the action economy legible turn-to-turn).

**Ability-definition compile state** (per `compileEffects()` call):
`Uncompiled → Compiled(EffectPrimitive[])`. Stateless and idempotent — the
same `(caster, ability, selectedTarget)` input always produces the same
output, called as many times as needed (e.g., once per hover-frame during
Move Preview) with no side effects.

### Interactions with Other Systems

Heroes & Abilities is a **compiler and legality authority**: it decides what
a hero *may* do and turns a chosen action into the primitive vocabulary
Combat Resolution executes; it never mutates the board directly.

| System | Reads from Heroes & Abilities | Heroes & Abilities reads / calls | Ownership boundary |
|--------|-------------------------------|-----------------------------------|---------------------|
| **Board & Grid** ✅ | — | `reachableTiles`, `rayTiles`, `tilesInRange`, `neighbors`, `distance`, `isOccupied`, `getOccupant`, `isBlocked`, `classify`, `step` for legality (Formulas F1–F3) — `reachableTiles` (F1) and `rayTiles` (F3) are Board & Grid's own canonical queries per `cross-system-contracts.md` §2, not Heroes & Abilities-local helpers | Board owns spatial truth; Heroes & Abilities only queries it, never mutates |
| **Combat Resolution** ✅ | — | `resolve(board, effects)` with the output of `compileEffects()`; never bypasses this to mutate the board | Combat owns *how* an effect list resolves; Heroes & Abilities owns *which* effect list a chosen action compiles to |
| **Turn & Phase Manager** ✅ | `squad_size` (H) and `actions_per_hero_turn` (A_max = 2) — the external values that document's Formula F2 requires (its Open Question #6, resolved here) | Player Phase window in which hero actions are legal; Board `snapshot()`/undo also rolls back this document's action-slot bookkeeping (States and Transitions) | Manager owns *when* actions may be taken and undo timing; Heroes & Abilities owns *what* an action is |
| **Enemy, Abilities & Telegraph** | The `AbilityDefinition` schema itself (shape / targetFilter / effectTemplate / `compileEffects` pattern) — Rule 16 | — | Heroes & Abilities is the canonical source of the shared ability schema; Enemy substitutes AI target selection for player input, reusing the same structure rather than redefining it |
| **Move Preview** | `compileEffects(caster, ability, target)` — the exact same function used for real resolution | Legal-target and legal-move sets (Formulas F1–F3), to know what selections are even offerable | Preview never reimplements targeting or compilation logic — it calls this document's functions and Combat Resolution's `resolve()` against a cloned board |
| **Battle HUD** | Hero HP, `maxHP`, ability name/icon, ability availability (legal-target-count > 0), Move-slot/Ability-slot used/available, legal-move-tile and legal-target-tile highlight sets | — | Read-only consumer |
| **Board Rendering & Juice** | Hero silhouette/class for rendering selection, legal-tile highlight sets | — | Read-only consumer |
| **Encounter Generator** | `squad_size`, full `HeroDefinition` list (for deployment planning / difficulty balancing) | — (Heroes & Abilities does not read Encounter Generator) | Encounter Generator authors deployment tiles; Heroes & Abilities only defines chassis/ability data it can read |
| **Draft / Loadout Meta** | Full `HeroDefinition` roster to offer as draftable content | Writes/selects the active `Loadout` for a run | Draft owns *which* heroes are available and chosen; Heroes & Abilities owns what a hero *is* |
| **Ability Upgrades** | `AbilityDefinition` fields it may modify (range, distance/amount parameters, `cooldownTurns`) | — | Ability Upgrades extends/overrides fields defined here; it does not redefine the schema |
| **Pilots / Hero Modifiers** (Not Started) | `HeroDefinition` fields it may modify (maxHP, moveRange) | — | Same relationship as Ability Upgrades, at the chassis level |

> **Status note:** Enemy, Abilities & Telegraph, Move Preview, Battle HUD,
> Board Rendering & Juice, Encounter Generator, Draft / Loadout Meta, and
> Ability Upgrades are now **Designed** (see `systems-index.md`) — the
> interfaces above should already match their published GDDs; any drift
> should be raised via `/consistency-check`. **Pilots / Hero Modifiers**
> remains **Not Started** — the interface row above is still this GDD's
> proposed contract until that document exists.

**Illustrative reference kits.** The following four hero definitions are
worked examples used throughout Formulas, Edge Cases, and Acceptance
Criteria to ground the abstract schema in concrete numbers. They are **not**
the final v1 roster (roster content — the full 6–8 hero set — is authored
separately, e.g. via a future quick-spec or content pass) but they are valid,
complete `HeroDefinition` instances a programmer could implement today:

| Hero | Class (flavor) | maxHP | moveRange | Ability | Shape | Range | Filter | Effect template |
|------|-----------------|-------|-----------|---------|-------|-------|--------|------------------|
| **Vanguard** | Vanguard | 6 | 3 | Shove | UnitTarget | 1 | Enemy | `push($target, dir=casterToTarget, distance=2)` |
| **Warden** | Controller | 5 | 2 | Anchor Pull | UnitTarget, `requiresOrthogonalAlignment` | 4 | Enemy | `pull($target, source=caster, dir=targetToCaster, distance=$distToTarget−1)` |
| **Twinblade** | Support | 5 | 3 | Blink Swap | UnitTarget | 3 | Ally (excludes self) | `swap(caster, $target)` |
| **Ember** | Controller | 5 | 2 | Firebrand | SingleTile | 3 | AnyTile | `spawnHazard($target, Fire, duration=2)` then, if `isOccupied($target)`, `applyHazard($target)` |
| **Striker** | Vanguard | 7 | 3 | Piercing Round | Line | 4 | — (hits all qualifying units in ray) | for each unit in `rayTiles(caster, $direction, 4)`: `damage(unit, 2)` |

## Formulas

All formulas are deterministic (no RNG, no time-dependence). Examples use
the default **8×8** board (`grid_width`, `grid_height`) and the reference
kits above.

### F1. Legal Move Tiles (bounded reachability, via Board & Grid's `reachableTiles`)

```
legalMoveTiles(origin, moveRange, board):
  return board.reachableTiles(origin, moveRange, board)
  // Board & Grid's single bounded flood-fill (over Clear tiles, using
  // isBlocked/isOccupied/neighbors), excluding the origin tile itself —
  // the same shared implementation Enemy movement-to-range consumes
  // (cross-system-contracts.md §2, resolves C3). Heroes & Abilities does
  // not maintain a second BFS.
```

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| starting tile | `origin` | coord | valid, `Clear` tile the hero occupies | Hero's current position at query time (Rule 7) |
| move range | `moveRange` | int | ≥0 (chassis stat) | Hero's `moveRange` chassis field |
| board | `board` | Board | live or `snapshot()` | Passed through to `reachableTiles` — Heroes & Abilities issues no direct mutation |

**Output range:** a subset of `board-and-grid.md` Formula 4's Manhattan disk
minus the origin: `0 ≤ |legalMoveTiles| ≤ 2·moveRange² + 2·moveRange`
(obstacles only shrink this set, never grow it, since the underlying BFS only
expands through `Clear` tiles). This assumes Board & Grid's
`reachableTiles(origin, range, board)` excludes the origin from its result,
consistent with the pre-contract local implementation it replaces; even if
that origin-inclusion detail differs once `board-and-grid.md` formally
publishes the formula, Heroes & Abilities never offers a hero's current tile
as a Move destination (Edge Cases), so the legality rule holds either way.

**Worked example (open board):** Vanguard (`moveRange=3`) at `(3,3)` on an
open 8×8 board: `|legalMoveTiles| = 2·9 + 6 = 24` (the full radius-3 Manhattan
disk minus the origin).

**Worked example (with an obstacle):** same hero, same tile, but `(3,2)` is
Blocked: the BFS branch through `(3,2)` is cut, along with every tile only
reachable through it; the resulting set is strictly smaller than 24 (exact
count depends on what else is reachable around the obstacle — this is why
the formula gives an upper bound, not an exact closed form, once terrain is
involved).

### F2. Legal Ability Targets

```
legalTargets(caster, ability, board):
  candidates =
    Self        → { caster.tile }
    SingleTile  → board.tilesInRange(caster.tile, ability.range)
    UnitTarget  → { t in board.tilesInRange(caster.tile, ability.range)
                     : board.isOccupied(t) }
    Line        → { d in {N,S,E,W}
                     : rayTiles(caster.tile, d, ability.range, board) ≠ ∅ }
                   // candidates here are DIRECTIONS, not tiles — see F3
    Area        → board.tilesInRange(caster.tile, ability.range)
                   // candidates are ORIGIN tiles for the AoE, see Rule 8

  return { c in candidates : ability.targetFilter.accepts(c, board, caster) }
```

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| caster | `caster` | Unit | must be `Alive` | The acting hero |
| ability | `ability` | AbilityDefinition | — | The hero's signature ability |
| `targetFilter.accepts` | — | predicate | bool | `Self`/`Ally`/`Enemy`/`AnyUnit`/`EmptyTile`/`AnyTile`, optionally AND'd with `requiresOrthogonalAlignment(caster.tile)` = `(Δcol==0) ∨ (Δrow==0)` |

**Output range:** `UnitTarget`/`SingleTile`/`Area` candidate sets are
bounded by `board-and-grid.md` Formula 4 (`0` to `2R²+2R+1` tiles before
filtering); `Line` candidates are bounded to `{0,1,2,3,4}` directions.

**Worked example (Vanguard's Shove, UnitTarget + Enemy, range 1):** caster at
`(4,4)`; `tilesInRange((4,4),1) = {(4,4),(4,3),(4,5),(3,4),(5,4)}` — **5**
tiles, including the origin itself (`distance=0 ≤ 1`, per
`board-and-grid.md` Formula 4). `UnitTarget`'s `isOccupied` filter keeps
every occupied tile in that set, and the origin always qualifies here since
the caster itself occupies `(4,4)` — so before `targetFilter` is applied,
the raw `UnitTarget` candidate set is `{(4,4)}` (the caster) unioned with
any occupied neighbor tiles. The `Enemy` filter then excludes `(4,4)` (the
caster is never its own enemy) along with any ally-occupied tile, leaving
only enemy-occupied tiles. Suppose only `(5,4)` is occupied, by an enemy →
`legalTargets = {(5,4)}`. If `(5,4)` held an ally instead, the `Enemy`
filter excludes it too → `legalTargets = ∅` (the origin was already
excluded regardless of who stands there) and the Ability slot is
unavailable this turn (Rule 12) though Move remains usable.

**Worked example (Warden's Anchor Pull, UnitTarget + Enemy +
`requiresOrthogonalAlignment`, range 4):** caster at `(2,2)`; an enemy sits
at `(2,6)` (`distance=4`, same column → alignment satisfied) and another
enemy sits at `(4,3)` (`distance=3`, but `Δcol=2, Δrow=1` — neither is 0,
alignment fails) → only `(2,6)` qualifies.

### F3. Ray Tiles (Line-shape geometry — Board & Grid's canonical `rayTiles` query)

```
rayTiles(origin, direction, maxLength, board):
  result = []
  current = origin
  for i in 1..maxLength:
    next = board.step(current, direction)
    if not board.inBounds(next): break
    if board.isBlocked(next): break
    result.append(next)
    current = next
  return result   # ordered nearest-to-farthest; may include Lethal/Occupied tiles
```

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| origin | `origin` | coord | valid tile | Ray's starting tile (the caster's tile in all v1 examples) |
| direction | `direction` | enum | `{N,S,E,W}` | Chosen cardinal direction — always well-defined, per Rule 10 |
| max length | `maxLength` | int | ≥1 (ability's `range`) | Ability-defined ray length cap |

**Output range:** an ordered list of `0` to `maxLength` tiles. The ray stops
at the first `OutOfBounds` or `BlockedTerrain` tile (exclusive — that tile
is never included) but **passes through** `Occupied`/`Lethal`/`Clear` tiles,
since it is pure targeting geometry; whether the ability hits every unit
found or only the first is an `effectTemplate` authoring choice (Rule 12),
not something this formula decides.

**Worked example 1 (open ray):** Striker at `(2,3)`, direction `E`,
`maxLength=4`, no obstacles: `rayTiles = [(3,3),(4,3),(5,3),(6,3)]` — 4
tiles.

**Worked example 2 (wall stops the ray):** same caster/direction, but
`(5,3)` is Blocked: `rayTiles = [(3,3),(4,3)]` — the wall tile itself is
excluded, and nothing beyond it is reachable.

**Worked example 3 (ray passes through units):** same open-board setup as
Example 1, with an enemy at `(4,3)` and another at `(6,3)`: `rayTiles`
still returns all 4 tiles; Striker's `effectTemplate` ("for each unit in the
ray, `damage`") then compiles to **two** `damage` primitive instances, one
per occupied tile, in ray order (Rule 12).

> **Resolved — Board & Grid's canonical query.** Per
> `cross-system-contracts.md` §2, `rayTiles(origin, dir, maxLen)` is one of
> Board & Grid's own canonical pure queries (alongside `reachableTiles`),
> superseding `board-and-grid.md`'s Open Question #8 deferral. The geometry
> below is reproduced here for reference because Heroes & Abilities and
> Enemy, Abilities & Telegraph both consume it identically for line-shaped
> abilities — it is Board & Grid's single implementation, not a Heroes &
> Abilities-local helper. `board-and-grid.md` itself still needs a
> follow-up sync pass to literally list `rayTiles`/`reachableTiles` in its
> own Formulas section — tracked as a propagation item, not a blocker here.

### F4. Action-slot bound per Player Phase (resolves Turn & Phase Manager's F2 external inputs)

`H = squad_size = 3` (default) · `A_max = actions_per_hero_turn = 2` (fixed,
Rule 4) · `maxActionsPerPhase = H × A_max`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| squad size | `H` | int | 2–5 (Tuning Knobs) | Number of heroes in the active Loadout |
| actions per hero | `A_max` | int | fixed at 2 in v1 | Move slot + Ability slot |

**Output range:** `maxActionsPerPhase ∈ [4, 10]` given the safe `squad_size`
range. **Example (default `H=3`):** `maxActionsPerPhase = 6`, so
`turn-and-phase-manager.md`'s Formula F2 (`undoLevels_max = H × A_max`)
evaluates to `6` — six is the maximum undo depth within a single Player
Phase at the default squad size, directly bounding that document's Formula
F3 memory estimate as well.

### F5. Effect-Chain Compilation

```
compileEffects(caster, ability, selectedTarget):
  # selectedTarget is a unit ID, a tile, or a direction, depending on ability.shape
  bindings = resolveBindings(caster, ability, selectedTarget)
    # e.g. for Vanguard's Shove: { $target: selectedTarget.unitId,
    #                              $direction: computeDirection(caster.tile, selectedTarget.tile),
    #                              $distance: 2 }
  effects = []
  for templateStep in ability.effectTemplate:
    effects.append( bind(templateStep, bindings) )
  return effects   # EffectPrimitive[], ready for Combat Resolution.resolve()
```

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| caster | `caster` | Unit | `Alive` | Acting hero |
| ability | `ability` | AbilityDefinition | — | The compiled ability |
| selection | `selectedTarget` | unitId \| tile \| direction | must be a member of `legalTargets(caster, ability, board)` (F2) | Player's (or AI's) choice |
| output | `effects` | EffectPrimitive[] | length = `ability.effectTemplate.length` for single-target shapes; length = `template.length × qualifyingUnitCount` for `Line`/`Area` (Rule 12) | Fed directly into `Combat Resolution.resolve()` |

**Output range:** a non-negative-length ordered list; `0` only if the
ability's shape found zero qualifying units for a multi-target template
(e.g., a `Line` ray with no units on it compiles to an empty `damage` set —
legal, just a wasted cast, see Edge Cases).

**Worked example (Vanguard's Shove):** caster `Vanguard@(4,4)`,
`selectedTarget = enemy@(5,4)` → `bindings = { $target: enemyId,
$direction: E, $distance: 2 }` → `compileEffects` returns
`[push(enemyId, E, 2)]`, the exact single-element list Combat Resolution's
`resolve()` receives, and the exact list Move Preview renders as the
telegraph before commit.

## Edge Cases

- **An ability has zero legal targets this turn:** the Ability slot is
  simply not offered as an option (greyed out in the HUD's action menu);
  this is not an error and does not block the Move slot. The hero may still
  Move, or pass entirely.
- **A hero's `moveRange` is `0`:** valid ("turret" archetype). `legalMoveTiles`
  (F1) always returns the empty set for such a hero; the Move slot is never
  offered, but the Ability slot functions normally.
- **A hero is fully boxed in (every neighbor Blocked/Occupied/Lethal):**
  `legalMoveTiles` returns `∅` even with `moveRange > 0`. Same handling as
  the zero-`moveRange` case — Move slot unavailable this turn, not an error.
- **The caster itself has been `Removed` before its action is attempted**
  (e.g., an earlier hero's friendly-fire Shove, per Rule 14, killed a
  teammate via `collision_damage` before that teammate's own turn to act):
  Heroes & Abilities rejects any action request from a non-`Alive` caster at
  the legality-check layer — this is a distinct guard from Combat
  Resolution's mid-chain "already removed" no-op (which handles removed
  *targets*, not removed *casters*). A dead hero is never offered any
  action.
- **Move is used, changing the hero's position, then the Ability slot's
  legal-target set is queried:** the set reflects the **post-move**
  position (Rule 7) — this is the intended "move into range, then act"
  play, not a bug. Move Preview must recompute `legalTargets` from the
  in-progress plan's simulated position, not the turn-start position.
- **A `Line` ability's chosen direction yields zero qualifying units**
  (e.g., Striker fires down an empty corridor): `compileEffects` returns an
  empty `EffectPrimitive[]` (F5) — this is a **legal but wasted** cast; the
  Ability slot is still consumed (Rule 4 has no "refund on whiff" clause).
  This is a real tactical cost the player must read before committing
  (Pillar #1) — Move Preview must show "no targets in this ray" clearly
  rather than silently doing nothing.
- **A `Line` direction whose very first step is `OutOfBounds`** (caster on
  the edge, facing off the board): `rayTiles` returns `[]` immediately;
  per Formula F2, a direction is only offered as a legal choice if
  `rayTiles(...) ≠ ∅` — so this direction is **not presented** to the
  player at all (distinct from the "empty corridor" case above, where the
  direction is legal but happens to hit nothing this turn).
- **`Twinblade`'s Blink Swap targeting itself:** `targetFilter = Ally
  (excludes self)` per the reference kit table — the caster's own tile is
  never a member of `legalTargets` for a Swap-type ability, since
  `swap(caster, caster)` is meaningless. This exclusion is a required part
  of any Swap-shaped ability's filter, not something Combat Resolution
  guards against (it would happily no-op a degenerate swap, but Heroes &
  Abilities should never offer the choice).
- **Two heroes' Move actions target the same tile in one Player Phase:**
  actions apply strictly sequentially (per `combat-resolution.md` Rule 2 /
  `turn-and-phase-manager.md`'s "never simultaneous" rule) — whichever hero
  moves first legally occupies the tile; the second hero's `legalMoveTiles`
  is recomputed at *their* action time and will no longer include that tile
  (it now classifies `Occupied`), so the conflict cannot actually occur —
  it resolves itself via re-query, not via a special collision rule.
- **A `pull`-type ability's requested distance would land the target on the
  caster's own tile:** per `combat-resolution.md`'s Edge Cases, the caster's
  tile classifies `Occupied` like any unit — the target stops one tile
  short and **both** target and caster take `collision_damage`. Heroes &
  Abilities does not special-case this; it is Warden's Anchor Pull (and any
  future pull ability) inheriting Combat Resolution's general rule as-is.
- **An `Area` ability's chosen origin tile is itself occupied by an ally the
  ability's filter would otherwise exclude:** the origin-tile selection
  (Rule 8, `SingleTile`-style pick) is governed by the Area ability's own
  `targetFilter` for *choosing the origin* (commonly `AnyTile`, since the
  origin is a placement, not a victim); the AoE's actual **effects**, once
  centered, apply per-unit filtering separately (e.g., "damage all
  `Enemy`-filtered units in the disk" would skip an ally standing inside
  it). An Area ability's authoring must specify both the origin's filter
  and each affected unit's filter — they are not the same value by
  default, and this document does not assume they are.
- **Undo is used mid-Player-Phase after both a Move and an Ability action:**
  per States and Transitions, one `undo()` call rolls the Board back one
  snapshot depth **and** restores the corresponding action-slot's
  `Used → Available` state in lockstep — a hero whose Ability action is
  undone regains its Ability slot exactly as if it had never acted, and its
  position (if a prior Move is still in the undo stack) is unaffected by
  that specific undo.
- **A hero's `maxHP` is queried before the battle's Unit records exist**
  (e.g., during Draft / Loadout Meta browsing, outside any battle): valid —
  `maxHP` is chassis-level authored data, readable independent of any
  battle instance. Current HP only exists once a Unit record is instantiated
  at battle Setup.
- **Squad has fewer than `squad_size` living heroes remaining mid-battle**
  (some were defeated): the Loadout schema's "exactly `squad_size` distinct
  heroes" invariant applies only to **Loadout composition at battle start**,
  not to how many remain alive — a battle with 1 surviving hero out of 3 is
  a normal, valid mid-battle state, not an invariant violation. Whether
  losing all heroes ends the battle is Objective / Win-Lose's rule, not
  this system's.

## Dependencies

**Upstream (Heroes & Abilities depends on):**

| System | Interface | Hard / Soft |
|--------|-----------|--------------|
| **Board & Grid** ✅ | `reachableTiles`, `rayTiles`, `tilesInRange`, `neighbors`, `distance`, `isOccupied`, `getOccupant`, `isBlocked`, `classify`, `step`, `inBounds` (Formulas F1–F3) — `reachableTiles` and `rayTiles` are Board & Grid's own canonical queries per `cross-system-contracts.md` §2 (resolves this document's former Open Questions #1 and the C3 shared-BFS contract) | **Hard** |
| **Combat Resolution** ✅ | `resolve(board, effects)` entry point; the 10 Combat primitives (`damage`, `push`, `pull`, `swap`, `spawnHazard`, `applyHazard`, `removeUnit`, `setTerrain`, `spawnUnit`, plus the shared collision-resolution algorithm used by push/pull) that every `effectTemplate` compiles into | **Hard** |
| **Turn & Phase Manager** ✅ | Player Phase as the window in which hero actions are legal; `Board.snapshot()`/undo mechanism, which this document's action-slot bookkeeping rides alongside | **Hard** |

**Downstream (systems that depend on Heroes & Abilities):** all are now
**Designed** (see `systems-index.md`) except **Pilots / Hero Modifiers**
(**Not Started**); interfaces below are reconciled against each dependent's
published GDD where one exists.

| Dependent System | Interface (what it uses) | Hard / Soft |
|-------------------|---------------------------|--------------|
| **Enemy, Abilities & Telegraph** | Reuses the `AbilityDefinition` schema (shape/filter/effectTemplate/`compileEffects`) verbatim, substituting AI target selection (Rule 16) | **Hard** |
| **Move Preview** | `compileEffects()`, `legalMoveTiles()` (F1), `legalTargets()` (F2) — to know what can be previewed and to produce the exact effect list Combat Resolution will later commit | **Hard** |
| **Objective / Win-Lose** | Reads hero-vitality events (`unit_removed`) emitted by Combat Resolution when a hero is defeated — indirect, via Combat's event log, not a direct call into this document | **Soft** |
| **Battle HUD** | Hero HP/`maxHP`, ability name/icon/availability, action-slot used/available state, legal-move/legal-target highlight sets | **Hard** (for HUD) |
| **Board Rendering & Juice** | Hero class/silhouette identity for rendering; legal-tile highlight sets | **Hard** (for rendering) |
| **Encounter Generator** | `squad_size`, full `HeroDefinition` roster (for deployment-zone sizing / difficulty balancing) | **Soft** |
| **Draft / Loadout Meta** | Full `HeroDefinition` roster (draftable content); writes the selected `Loadout` this document validates | **Hard** |
| **Ability Upgrades** | Reads/overrides `AbilityDefinition` fields (range, per-ability `distance`/`amount` parameters, `cooldownTurns`) | **Hard** |
| **Pilots / Hero Modifiers** | Reads/overrides `HeroDefinition` fields (`maxHP`, `moveRange`) | **Hard** |

**Bidirectional-consistency note:** `board-and-grid.md` already lists Heroes
& Abilities as a **Hard** dependent (`tilesInRange`, `neighbors`, `distance`,
`isOccupied`, `getOccupant`, terrain — "for legal moves & targeting") —
consistent with the Upstream row above; the former `rayTiles` gap is now
resolved (see Open Questions). `turn-and-phase-manager.md` already lists
Heroes & Abilities as a **Soft/indirect** dependent ("player actions during
Player Phase are hero ability uses, routed via Combat") and separately flags
`H`/`A_max` as external values "owned by Heroes & Abilities / a future
action-economy spec" in its Formula F2 — this document resolves that: `H =
squad_size` (default 3), `A_max = actions_per_hero_turn` (fixed 2). This
should be treated as **resolving** that document's Open Question #6, not a
new open item. `combat-resolution.md` already lists Heroes & Abilities as a
**Hard** dependent ("Compiles every hero verb into `EffectPrimitive[]`;
calls `resolve()` via the Turn Manager; never mutates the board directly") —
consistent with the Upstream row above, and this document's Rule 11/Formula
F5 is the concrete mechanism that satisfies it.

## Tuning Knobs

| Knob | Default | Safe Range | Category | Too Low | Too High |
|------|---------|-----------|----------|---------|----------|
| `squad_size` (H) | 3 | 2–5 | Gate | Below 2, there is no positioning puzzle between heroes (no synergy plays possible) and a single defeat can end the battle instantly — too punishing and too shallow for Pillar #2/#4 combos | Above 5, a single Player Phase's action space (per F4, `H×2` actions) grows large enough to threaten Pillar #5 (Read in Ten Seconds) — more simultaneous plans to track before committing than a player can hold in a ten-second read |
| `actions_per_hero_turn` (A_max) | 2 (fixed: 1 Move + 1 Ability) | 1–3 | Gate | `1` removes the ability to both reposition and act in the same turn, collapsing "move-then-strike" tactics — a significant loss of expressive depth versus the ITB reference | `3+` (e.g. two ability uses per turn) would need a second, distinct Ability slot design, not a value change — raising this knob alone without redesigning the schema breaks the "one verb, once per turn" legibility Pillar #4/#5 rely on. **Not intended to be raised in v1**; reserved for a future upgrade-driven exception on individual heroes, not a global change |
| `hero_hp_baseline` (guideline range for `maxHP` when authoring new heroes) | 5–7 | 3–10 | Curve | Below 3, a hero dies to a single `collision_damage` (max 3) or two `fire_damage_per_tick` (max 3×2) hits, making forced-movement plays feel like unavoidable one-shots rather than readable threats | Above 10, Combat Resolution's `collision_damage`/`fire_damage_per_tick` knobs (max 3 each) become negligible chip damage relative to hero HP, weakening the tactical cost of forced-movement/hazard exposure that Pillar #2 depends on |
| `hero_move_range_baseline` (guideline range when authoring new heroes) | 2–4 | 0–6 | Curve | `0` is valid only for an intentional "turret" archetype (Edge Cases) — a whole roster at 0 would remove all positioning play | Above 6 on an 8×8 board, a single hero can reach nearly the entire board in one Move, undermining the board's role as a constrained puzzle space (interacts with Board & Grid's `grid_width`/`grid_height` knobs — do not raise this without also reviewing board size) |
| per-ability `range` | ability-specific | 0 (Self) – 6 | Curve | Very low ranges on non-melee-flavored verbs make an ability feel unusable most turns | Very high ranges (near board diameter, 14) let an ability threaten almost anywhere, reducing the positioning tension of "get in range" that Pillar #2 depends on |
| per-ability push/pull `distance` | ability-specific | 1–4 | Curve | `1` makes forced movement feel marginal — often not enough to reach a hazard/edge from a typical engagement position | `>4` on an 8-wide board can single-handedly relocate a unit across most of the board in one hit, which (combined with edge/chasm kills) can feel like an instant-win button rather than a readable tactical option — cross-reference Combat Resolution's own note that push/pull distance is "owned by Heroes & Abilities' tuning knobs" |
| per-ability `damage` amount (e.g. Striker) | ability-specific | 1–4 | Curve | `0` is valid only for a pure-utility ability with no damage component (most verbs in this roster) | `>4` starts to compete with `hero_hp_baseline` (5–7) closely enough that a single damage-focused ability can two-shot a typical hero/enemy, pulling the game back toward a damage race and weakening Pillar #2's "positioning, not power" thesis — this is the single most important knob to keep conservative |
| `cooldownTurns` | 0 (v1 base roster) | 0–3 | Gate | N/A at default — every base v1 ability is available every turn (Rule 15) | A high default cooldown on a base-kit ability (not an "ultimate") makes a hero's only verb absent for multiple turns, which is close to unplayable for a one-ability hero — reserve non-zero values for deliberately rare, high-impact future verbs only |

**Interactions between knobs:**
- `hero_hp_baseline` must be tuned jointly with Combat Resolution's
  `collision_damage` and `fire_damage_per_tick` (as that document's own
  Tuning Knobs section already flags) and with this document's per-ability
  `damage` amount — all three compete for the same "how many hits does a
  hero survive" budget.
- `squad_size` and per-ability `range`/`distance` interact with Board &
  Grid's `grid_width`/`grid_height`: a larger board without proportionally
  larger ranges makes heroes feel disconnected from each other; a smaller
  board with unchanged ranges compresses the puzzle toward "everything can
  hit everything," reducing meaningful positioning choices.
- `actions_per_hero_turn` is deliberately **not** meant to vary per
  playthrough or difficulty tier — it is closer to Board & Grid's
  "intentionally not a knob" adjacency-mode decision than a true tuning
  dial, kept as a documented knob here only because Turn & Phase Manager's
  formulas reference it externally and its value must live *somewhere*
  authoritative.

## Visual/Audio Requirements

Heroes & Abilities is the system where the "Legible Battlefield" art
direction becomes concrete gameplay-legible content, not just a style
guideline — the following are functional requirements, not polish:

- **Silhouette-first hero identity.** Every `HeroDefinition`'s visual
  representation must be identifiable by shape alone, at the board's
  default zoom, with zero color information (per the Visual Identity
  Anchor's "silhouette-first units" test in `game-concept.md`). This is a
  functional requirement because Pillar #5 depends on instant hero
  recognition during a multi-hero turn plan.
- **One accent color per verb-family.** Abilities that share a primitive
  family must share a color language: every `push`-based ability uses the
  same accent color across the whole roster (e.g., all shove-type verbs),
  distinct from the accent color used by every `pull`-based ability,
  distinct again from `swap`, `spawnHazard`/`applyHazard`, and `damage`.
  This lets a player infer *what kind of thing is about to happen* from
  color alone before reading any tooltip, directly serving the Visual
  Identity Anchor's "color alone communicates what a verb does" test.
- **Legal-tile and legal-target highlighting.** When a hero is selected,
  the board must render `legalMoveTiles` (F1) and, upon selecting the
  Ability slot, `legalTargets` (F2) as distinct, unambiguous overlays —
  these must never look like Board Rendering's hazard/telegraph overlays
  (different visual language, same neutral-board-lets-overlays-pop
  principle from the Visual Identity Anchor).
- **Ability preview overlay.** Once a target is selected (or hovered), the
  board must render the exact tiles/units the compiled `EffectPrimitive[]`
  (F5) will affect — this is the player-facing surface of Move Preview
  consuming this document's `compileEffects()` output; Heroes & Abilities'
  obligation is to guarantee that data is available and accurate, not to
  render it (Board Rendering & Juice / Move Preview own the rendering).
- **Direction indicator for `Line`-shaped abilities.** Because a `Line`
  ability's targeting selection is a direction rather than a tile (Rule 8),
  its UI must present the four (or fewer, per Edge Cases) legal cardinal
  directions as an explicit, discrete choice — not a free-aim cursor —
  keeping every possible outcome enumerable and previewable (Pillar #1).
- **Audio hooks (owned by Audio System):** this document does
  not specify SFX content, but flags that ability-selection, legal-target
  highlight, and cast-commit are three distinct interaction moments that
  will need distinct audio feedback per the project's "crisp SFX for
  moves/telegraphs" audio direction (`game-concept.md`).

## UI Requirements

- **Hero roster panel (Battle HUD):** for each Loadout hero, display
  portrait/silhouette, current HP / `maxHP`, ability name + icon, and
  Move-slot / Ability-slot availability (used vs. available) at a glance —
  the whole squad's action-economy state must be readable without clicking
  into any individual hero (Pillar #5).
- **Ability selection:** selecting a hero and then its Ability slot must
  immediately surface `legalTargets` (F2) with zero additional clicks; if
  `legalTargets = ∅`, the Ability slot must render as visibly disabled
  (not simply absent) so the player understands *why* it's unavailable
  this turn, rather than wondering if it's a bug.
- **Undo affordance:** because undo is free within Player Phase (Turn &
  Phase Manager), the UI must make "undo my last action" a single,
  always-visible control while any hero still has unresolved actions this
  phase — this is load-bearing for Pillar #1's "confidence to think"
  promise, not a nice-to-have.
- **Empty-ray feedback (Line abilities):** if a selected direction's
  `rayTiles` result contains no qualifying units (Edge Cases), the UI must
  visibly communicate "this will hit nothing" before the player commits,
  not just show an empty highlight that could be misread as a rendering
  gap.

## Acceptance Criteria

Pure, deterministic unit tests unless noted — no wall-clock time, no RNG, no
rendering. Default board `8×8`, default knob values, and the reference kit
table (Vanguard/Warden/Twinblade/Ember/Striker) unless stated otherwise.

**Chassis & Loadout (Rules 1–5)**
- **GIVEN** a `HeroDefinition` with `maxHP≥1` and `moveRange≥0`, **WHEN**
  constructed, **THEN** `size===1` always, regardless of any input
  (structurally fixed, not settable).
- **GIVEN** a Loadout construction request with `squad_size=3` and 3
  distinct `HeroDefinition`s, **WHEN** validated, **THEN** it succeeds.
- **GIVEN** a Loadout construction request containing two copies of the same
  `HeroDefinition.id`, **WHEN** validated, **THEN** it is rejected
  (duplicate-hero invariant, Rule 5).
- **GIVEN** a Loadout construction request with fewer or more than
  `squad_size` heroes, **WHEN** validated, **THEN** it is rejected.

**Action economy (Rule 4, Formula F4)**
- **GIVEN** a living hero at Player-Phase start, **THEN** both Move and
  Ability slots read `Available`.
- **GIVEN** a hero uses its Move slot, **THEN** Move reads `Used` and
  Ability remains `Available` (slots are independent).
- **GIVEN** a hero has used both slots, **WHEN** a third action is
  attempted by that hero this Player Phase, **THEN** it is rejected.
- **GIVEN** `squad_size=3`, **THEN** `maxActionsPerPhase = 6` (F4);
  **GIVEN** `squad_size=5`, **THEN** `maxActionsPerPhase = 10`.
- **GIVEN** a `Removed` hero, **WHEN** any action is requested from it,
  **THEN** rejected — zero slots ever offered (Rule 4, Edge Cases).

**Move legality (Rule 6, Formula F1)**
- **GIVEN** Vanguard (`moveRange=3`) on an open board at `(3,3)`, **THEN**
  `|legalMoveTiles| == 24` and every returned tile satisfies
  `distance(origin,tile) ≤ 3`.
- **GIVEN** a hero with `moveRange=0`, **THEN** `legalMoveTiles == ∅` and
  the Move slot is never offered.
- **GIVEN** a hero fully surrounded by non-`Clear` tiles, **THEN**
  `legalMoveTiles == ∅` even with `moveRange > 0`.
- **GIVEN** a Lethal tile within `moveRange`, **THEN** it is **excluded**
  from `legalMoveTiles` (a hero can never voluntarily walk onto Chasm/lethal
  Water — only forced displacement can).
- **GIVEN** a hero uses its Move slot, **WHEN** its Ability's `legalTargets`
  is subsequently queried, **THEN** the query uses the hero's post-move
  tile, not its turn-start tile (Rule 7).

**Ability targeting (Rules 8–10, Formula F2)**
- **GIVEN** Vanguard adjacent to exactly one enemy (Shove: UnitTarget,
  range 1, filter Enemy), **THEN** `legalTargets == {that enemy}`.
- **GIVEN** the same setup but the adjacent unit is an ally, **THEN**
  `legalTargets == ∅` (filter excludes it) and the Ability slot is
  unavailable.
- **GIVEN** Warden (Anchor Pull: range 4, `requiresOrthogonalAlignment`)
  with one enemy same-column at distance 4 and another enemy off-axis at
  distance 3, **THEN** `legalTargets` contains only the same-column enemy.
- **GIVEN** Striker (Line, range 4) with a wall 2 tiles away in the chosen
  direction, **THEN** `rayTiles` returns exactly the 2 tiles before the
  wall, never the wall tile itself.
- **GIVEN** a `Line` direction whose first step is `OutOfBounds`, **THEN**
  that direction is excluded from the legal-direction set entirely (not
  merely "resolves to nothing").

**Effect-chain compilation (Rules 11–12, Formula F5)**
- **GIVEN** Vanguard's Shove compiled against a valid adjacent enemy target,
  **THEN** `compileEffects` returns exactly `[push(targetId, direction,
  distance=2)]` with `direction` computed as caster→target.
- **GIVEN** the identical `(caster, ability, target)` input, **WHEN**
  `compileEffects` is called twice, **THEN** both calls return
  byte-identical output (pure function, no hidden state).
- **GIVEN** Striker's ray contains 2 qualifying enemy units, **THEN**
  `compileEffects` returns exactly 2 `damage` primitives, ordered
  nearest-to-farthest along the ray, with both target IDs snapshotted
  before compilation begins (verified via a case where an earlier `damage`
  in the same chain would, if re-queried live, have changed which unit
  occupies the farther tile — the compiled list must not re-derive it).
- **GIVEN** a `Line` ability's ray contains zero qualifying units, **THEN**
  `compileEffects` returns an empty array (legal, not an error).
- **GIVEN** `compileEffects`'s output for a real Player-Phase action,
  **WHEN** the identical output is instead passed to
  `resolve(board.snapshot(), effects)` for a preview, **THEN** the
  resulting event log and board mutations are identical in shape to what
  the real commit will produce (WYSIWYG contract, Rule 11) — verified via
  an integration test against a Combat Resolution fake/real instance.

**Friendly-fire and swap exclusions (Rules 9, 14; Edge Cases)**
- **GIVEN** an ability with `targetFilter=AnyUnit` and a `push` effect
  template, **WHEN** its target is an ally, **THEN** it compiles and
  resolves exactly as it would against an enemy (no special-casing).
- **GIVEN** Twinblade's Blink Swap (`targetFilter=Ally, excludes self`),
  **THEN** the caster's own tile is never a member of `legalTargets`,
  regardless of range.

**Undo interaction (States and Transitions)**
- **GIVEN** a hero has used its Ability slot, **WHEN** the Turn Manager's
  `undo()` restores the Board to the pre-action snapshot, **THEN** that
  hero's Ability slot reads `Available` again at the same undo depth.
- **GIVEN** a hero used Move then Ability (two snapshots deep), **WHEN**
  one `undo()` is called, **THEN** only the Ability slot's action is rolled
  back — the Move slot remains `Used` and the hero's position from the Move
  is retained.

**HP / defeat (Rule 13)**
- **GIVEN** a hero with `hp=5` (chassis `maxHP=5`) takes `damage(unit, 7)`
  via Combat Resolution, **THEN** the hero is `Removed(Defeated)` and,
  per Rule 4/Edge Cases, is never offered an action again this battle.
- **GIVEN** a hero pushed/pulled onto Lethal terrain, **THEN** it is
  `Removed(Fell)`, identical to any other unit under Combat Resolution's
  vitality model — this document adds no divergent hero-specific rule.

### Performance Budget (headless TS benchmarks, decoupled from render)

| Operation | Budget | Note |
|-----------|--------|------|
| `legalMoveTiles` (F1, `moveRange ≤ 5`, board ≤ 12×12) | < 0.5 ms/call | BFS bounded by the same diamond size as Board's `tilesInRange` |
| `legalTargets` (F2, any shape) | < 0.3 ms/call | Dominated by one `tilesInRange` call plus a linear filter |
| `rayTiles` (F3, `maxLength ≤ 6`) | < 0.1 ms/call | Bounded loop, ≤6 iterations |
| `compileEffects` (F5) | < 0.1 ms/call | Pure binding/template substitution, no board traversal |
| Combined cost of computing every living hero's legal Move + Ability sets, once per Player-Phase frame during hover/preview (`squad_size=3`) | < 3 ms | Leaves headroom within the board's own `< 2 ms` Move-Preview-active budget from `board-and-grid.md`, inside the 16.6 ms (60 fps) frame shared with PixiJS rendering |

## Open Questions

**Resolved by `cross-system-contracts.md` (2026-07-28):**

1. **`rayTiles` — RESOLVED.** Per `cross-system-contracts.md` §2, `rayTiles`
   is now one of Board & Grid's own canonical pure queries (alongside
   `reachableTiles`), not a Heroes & Abilities-local helper. Formula F3
   reproduces its geometry here for reference only, since Heroes &
   Abilities and Enemy, Abilities & Telegraph both consume the identical
   shared implementation for line-shaped attacks (Rule 16). No further
   architecture decision needed.
2. **Deployment-zone flag — RESOLVED.** Per `cross-system-contracts.md` §2,
   Board & Grid's flag set now includes `deploy-zone` alongside
   `spawn-point` and `objective`, authored by Encounter Generator and
   stored/exposed by Board & Grid — matching this document's States and
   Transitions section (`NotDeployed → Deployed(tile)`).
3. **Unit-record ownership and schema — RESOLVED.** Per
   `cross-system-contracts.md` §6 and registry entry `unit_record`, the
   canonical per-battle `Unit` record is owned by Heroes & Abilities and
   published above (see "Unit Record Schema (authoritative)"). Enemy,
   Abilities & Telegraph, Objective / Win-Lose, Ability Upgrades, and
   Draft / Loadout Meta reference it rather than re-shaping it.

**Resolved this session (provisional defaults — confirm during
implementation):**

4. **`H` and `A_max`** (`turn-and-phase-manager.md`'s Open Question #6) are
   resolved here: `H = squad_size` (default 3, range 2–5), `A_max =
   actions_per_hero_turn` (fixed 2: one Move slot, one Ability slot).
5. **Pull's direction ambiguity** (`board-and-grid.md`'s Open Question #9,
   `combat-resolution.md`'s Open Question #2) is resolved here via Rule 10's
   two authoring patterns (target-then-direction at range 1;
   `requiresOrthogonalAlignment` filtering at longer range).
6. **No passives / single-ability-per-hero in v1** (Rule 3) is a deliberate
   scope decision favoring Pillar #4 legibility over kit depth; revisit only
   if playtesting shows the base roster feels too thin, via Pilots / Hero
   Modifiers rather than a retroactive change here.

**Deferred to the owning system's GDD:**

7. **The v1 full hero roster (6–8 heroes for Vertical Slice).** This
   document's reference kits (Vanguard, Warden, Twinblade, Ember, Striker)
   are illustrative and implementable, but the final content roster —
   including which verbs make the cut, balance pass, and flavor/narrative —
   is a follow-on content authoring task, not part of this system
   specification.
8. **"Wall" / terrain-creation verbs — RESOLVED.** `game-concept.md`'s
   example verb list names "wall" alongside shove/swap/pull. This was
   previously a gap; it is now resolved by Combat Resolution's **`setTerrain`
   primitive** (one of the 10 canonical Combat primitives), which deterministically converts a tile's
   terrain — e.g. `setTerrain(tile, Blocked)` to erect a wall,
   `setTerrain(tile, Normal)` to tear it down — generalizing the mutation the
   board already uses internally for `destroy()`. Because Board & Grid's
   `classify()` already treats `Blocked` terrain as movement-/push-blocking, a
   hero-built wall "just works" with no further engine change. A
   "Warden erects a wall"-style hero kit can therefore be authored on top of
   `setTerrain`; the remaining work is content/balance (verb range, cooldown,
   destructibility), not a missing primitive.
9. **Draft / Loadout Meta's persistence and drafting mechanics** (how a
   Loadout is chosen and changes across a run) are entirely out of this
   document's scope — only the *shape* of a valid Loadout is defined here.
10. **Ability Upgrades' and Pilots / Hero Modifiers' exact override
    mechanics** (e.g., does an upgrade replace a field or add a delta?) are
    deferred to those systems' own GDDs; this document only guarantees the
    fields they will need to read/override (`AbilityDefinition`'s range/
    distance/amount/cooldown, `HeroDefinition`'s maxHP/moveRange) are
    clearly named and typed.
