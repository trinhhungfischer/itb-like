# ADR-0008: Shared Unit record schema (C2)

## Status

Accepted

## Date

2026-07-28

## Last Verified

2026-07-28

## Decision Makers

Technical Director (owner); consulted: Heroes & Abilities (schema owner), Enemy
Abilities & Telegraph, Objective / Win-Lose, Ability Upgrades, Draft / Loadout
Meta, Combat Resolution, Run Structure / Node Map, Meta-progression / Unlocks.

## Summary

Multiple systems independently described "a unit in battle," risking schema
drift (`faction` vs `team`, `hp` vs `maxHP`/`currentHP`). This ADR publishes the
canonical per-battle `Unit` record **once** — owned by Heroes & Abilities,
registry `unit_record` — referenced (never re-shaped) by Enemy, Objective,
Ability Upgrades and Draft/Loadout Meta, threading `hazardImmunities` through
Combat's hazard call sites and adding `battle_ended.nodeType` +
`processRunEnd(outcome)`. Resolves cross-system contract C2 (§6).

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | None — pure-web stack (TypeScript strict + PixiJS 2D WebGL + Vite) |
| **Domain** | Core / Scripting (data-model contract; no engine API surface) |
| **Knowledge Risk** | LOW |
| **References Consulted** | `design/architecture/cross-system-contracts.md` §6/§10; `docs/architecture/architecture.md` §4, §6, §8 (A8) |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | None |

> **Not applicable / low risk.** VANGUARD is a pure-web project (TypeScript +
> PixiJS + Vite) with **no native engine** — there is no Godot/Unity/Unreal API
> surface and no post-cutoff engine version gap to manage. The `Unit` record is
> a plain TypeScript `interface`; correctness is enforced by the compiler, not
> by any engine runtime. The Godot engine-reference in `docs/engine-reference/`
> does not apply to this build and was intentionally not consulted.

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0006 (Combat `resolve()` as the single board-mutation path + the 10-primitive vocabulary) — must be Accepted before this can be implemented |
| **Enables** | Ability Upgrades hazard-immunity upgrades; Draft/Loadout Meta HP write-back; Meta-progression `processRunEnd` hook; any downstream ADR that consumes `battleState.units` |
| **Blocks** | Heroes & Abilities battle-instantiation stories; Enemy roster stories; Objective `evaluate()` stories; Draft/Loadout roster persistence |
| **Ordering Note** | ADR-0006 defines the mutation path (`applyHazard`, hazard-on-entry) that `hazardImmunities` is threaded through; this ADR extends those call sites, so ADR-0006's primitive vocabulary must be locked first. |

## Context

### Problem Statement

VANGUARD's battle simulation is shared by many systems: Heroes & Abilities and
Enemy, Abilities & Telegraph both create combatants; Objective / Win-Lose polls
them to decide victory/defeat; Ability Upgrades mutates their capabilities;
Draft / Loadout Meta reads their post-battle survival to persist the roster. If
each of these systems declares its own idea of "a unit," the shapes drift —
`team` vs `faction`, `hp` vs `maxHP`/`currentHP`, "alive" as a boolean vs a
vitality state — and cross-system code silently disagrees about the same object.
This is cross-system contract **C2**, still open at architecture sign-off: the
registry entry `unit_record` was marked **status: pending** precisely because no
single document had been declared its authoritative owner. The cost of not
deciding is integration bugs that only surface at runtime (e.g. Objective
counting a hero that Combat considers removed), plus the divergence the batch
design-review already caught in `objective-and-win-lose.md` (which used
`faction`/`hp`).

### Current State

The GDDs already converge on nearly the same fields, but describe them in prose
in several places:

- `heroes-and-abilities.md` publishes a "Unit Record Schema (authoritative)"
  block and claims ownership.
- `objective-and-win-lose.md` reads `battleState.units` but its Open Question 1
  still uses `faction`/`hp`/`alive` and notes the registry status is `pending`.
- `enemy-abilities-and-telegraph.md` reads "the shared `unit_record`" for enemy
  units and living-hero targeting.
- `ability-upgrades.md` requires a per-unit `hazardImmunities` set that Combat
  must honor, but flags it as "Soft today, proposed Hard" — not yet threaded.
- `draft-and-loadout-meta.md` needs each deployed member's `currentHP` written
  back at `battle_ended`, and needs the `battle_ended` payload to carry node-type
  context.
- `run-structure-node-map.md` / `meta-progression-and-unlocks.md` define
  `processRunEnd(outcome: {result, nodeType?})` but depend on `battle_ended`
  actually carrying `nodeType`.

Nothing is *wrong* yet — nothing is implemented — but the shape is asserted in
five documents at once with no single compiler-enforced source of truth, and two
of the supporting event/field extensions (`hazardImmunities` threading,
`battle_ended.nodeType`) are still only "proposed."

### Constraints

- **Determinism (Principle P1):** the record and every operation on it must be
  deterministic — no in-battle RNG, no wall-clock. Same inputs → byte-identical
  `Unit` state and event log.
- **One board-mutation path (Principle P2 / ADR-0006):** `position` and
  `currentHP` are mutated **only** as consequences of `Combat.resolve()`
  primitives — never by Heroes, Enemy, or any UI directly.
- **Pure headless core (Principle P3):** the record lives in the sim core and
  must be constructible and testable in Vitest with no PixiJS/canvas.
- **Contract authority (Principle P6):** `cross-system-contracts.md` §6 wins over
  any GDD; where a GDD (e.g. Objective's `faction`/`hp`) diverges, the GDD is
  corrected, not the contract.
- **v1 scope:** `size` is fixed at `1` (single-tile units); multi-tile is
  explicitly deferred (Architecture Open Question 1).

### Requirements

- Publish exactly **one** canonical per-battle `Unit` record; all other systems
  reference it by import, never redeclare it.
- Distinguish authored chassis data (`HeroDefinition` / `EnemyDefinition`, no
  `currentHP`/`position`) from the runtime per-battle instance (`Unit`).
- Thread `hazardImmunities` through Combat's hazard call sites so an immune unit
  takes no hazard damage.
- Extend the `battle_ended` event with `nodeType` and expose
  `processRunEnd(outcome)` so run-terminal handling can route on node type.
- Flip registry `unit_record` from `pending` to `active` with Heroes & Abilities
  named as owner.

## Decision

Publish the canonical per-battle `Unit` record **once**, owned by
**Heroes & Abilities** (registry `unit_record`, status flipped `pending →
active`). Every other system **references** it and may **not** re-declare or
re-shape it. The record is:

```
Unit {
  id: UnitId
  team: 'hero' | 'enemy'            // canonical discriminant — NOT `faction`
  archetype: HeroDefinition.id | EnemyDefinition.id  // which chassis this instance is
  maxHP: number                     // copied from chassis data at battle Setup
  currentHP: number                 // runtime; mutated ONLY via Combat (damage / applyHazard)
  position: Tile                    // mirrors Board occupancy; kept in sync by Combat Resolution
  size: 1                           // fixed 1 in v1 (Board & Grid Core Rule 5)
  abilities: AbilityDefinition[]    // length 1 for heroes in v1; shared schema (ADR reuse)
  hazardImmunities: HazardType[]    // threaded through Combat applyHazard / hazard-on-entry
  statusFlags: StatusFlag[]         // reserved, empty in v1 base kit
}
```

**Ownership & reference rule.** Heroes & Abilities owns the type. Enemy,
Abilities & Telegraph, Objective / Win-Lose, Ability Upgrades and Draft /
Loadout Meta each **import and reference** `Unit` — they must not define a
parallel `EnemyUnit`, `ObjectiveUnit`, or add fields. Objective's earlier
`faction`/`hp`/`alive` phrasing is corrected to `team`/`maxHP`+`currentHP` and
the shared vitality model (a unit is "alive" iff it has a live `Unit` record on
the board; removal is a `UnitRemoved` consequence of Combat, per ADR-0006).

**`hazardImmunities` threading.** `hazardImmunities` is consulted inside
`Combat.resolve()` at every hazard damage site — the `applyHazard` primitive and
every hazard-on-entry check (a unit displaced onto or spawned onto a hazard
tile). If `unit.hazardImmunities` contains the tile's `HazardType`, the hazard
deals no damage to that unit and no `HazardApplied` event is emitted for it. This
keeps immunity a property of the data, not special-cased in each ability, and
keeps Combat the single place hazard damage is computed (Principle P2).

**`battle_ended.nodeType`.** The `battle_ended` event emitted by Turn & Phase
Manager gains a `nodeType` field (`Battle | Elite | Boss`), sourced from the
encounter's node context. This lets terminal consumers (Draft/Loadout Meta's
post-victory bonuses, Run Structure's routing) branch on node type without a
back-query.

**`processRunEnd(outcome)`.** Run Structure / Node Map exposes
`processRunEnd(outcome: { result: Victory | Defeat | Abandon, nodeType?: Battle |
Elite | Boss })` as the single terminal-handling entry point. `nodeType` is
present when the outcome came from a battle node (sourced from
`battle_ended.nodeType`) and absent for a map-screen `Abandon`. `processRunEnd`
is called **exactly once** per terminal run event and is the hook from which
Meta-progression's own `processRunEnd(runSummary, metaStats, catalog)` is
invoked.

### Architecture

```
                      registry: unit_record  (status: active)
                               owns │
                                    ▼
                        ┌───────────────────────┐
                        │  Heroes & Abilities    │  OWNER of `Unit` type
                        │  Unit { id, team,      │  + shared AbilityDefinition
                        │  archetype, maxHP,     │
                        │  currentHP, position,  │
                        │  size=1, abilities[],  │
                        │  hazardImmunities[],   │
                        │  statusFlags[] }       │
                        └───────────┬───────────┘
                                    │ imports & REFERENCES (never re-shapes)
       ┌────────────────┬──────────┼──────────────┬─────────────────┐
       ▼                ▼          ▼              ▼                 ▼
 Enemy, Abilities   Objective   Ability        Draft / Loadout   (Meta-progression
 & Telegraph        /Win-Lose   Upgrades       Meta               reads via Draft)
 (enemy units,      (polls      (mutates       (writes back
  living-hero        battleState  hazard-       currentHP at
  targeting)         .units)      Immunities)   battle_ended)

                        Combat.resolve()  (ADR-0006)
                        ── mutates currentHP / position only ──
                        ── consults unit.hazardImmunities at ──
                           applyHazard + hazard-on-entry sites

  battle_ended{ result, nodeType } ──► Run Structure.processRunEnd(outcome)
                                             └─► Meta.processRunEnd(runSummary,…)
```

### Key Interfaces

```typescript
// OWNED by heroes-and-abilities.md — registry `unit_record` (C2). Single source of truth.
type UnitId = string;
type Team = 'hero' | 'enemy';

interface Unit {
  id: UnitId;
  team: Team;                       // canonical discriminant (NOT `faction`)
  archetype: string;               // HeroDefinition.id | EnemyDefinition.id
  maxHP: number;                   // copied at Setup
  currentHP: number;               // runtime; mutated ONLY via Combat.resolve()
  position: Tile;                  // mirrors Board occupancy; kept in sync by Combat
  size: 1;                         // v1: single-tile only
  abilities: AbilityDefinition[];  // shared schema; length 1 for heroes in v1
  hazardImmunities: HazardType[];  // consulted in Combat hazard call sites
  statusFlags: StatusFlag[];       // reserved; empty in v1 base kit
}

// Combat hazard sites (ADR-0006) now consult immunity — no per-ability special-casing:
//   applyHazard(tile): for each unit entering/occupying `tile`,
//     if unit.hazardImmunities.includes(board.getHazard(tile)) → no damage, no HazardApplied.

// Run-terminal contract (contracts §10):
type RunResult = 'Victory' | 'Defeat' | 'Abandon';
type NodeType  = 'Battle' | 'Elite' | 'Boss';

interface BattleEndedEvent {       // emitted once by Turn & Phase Manager
  type: 'battle_ended';
  result: RunResult;
  nodeType?: NodeType;             // present iff the outcome came from a battle node
}

// Run Structure / Node Map — single terminal entry point:
function processRunEnd(outcome: { result: RunResult; nodeType?: NodeType }): void;
```

### Implementation Guidelines

- Declare `Unit` in the Heroes & Abilities module; export it. No other module
  declares a unit shape — Enemy/Objective/Upgrades/Draft `import` it. A lint/review
  rule should reject any second `interface *Unit` in the sim core.
- Construct a hero `Unit` at battle Setup from its `HeroDefinition`: copy `maxHP`,
  set `currentHP = maxHP`, populate `abilities` from the chassis' single ability,
  `hazardImmunities = []` (unless a **Passive Module** supplies one — S2 Hazard
  Walker → `Fire`, S3 Acid Walker → `Acid`; corrected 2026-07-28, the original
  text credited this to Pilots, which `pilots.md` Core Rule 5 now forbids from
  touching chassis fields), `size = 1`, `statusFlags = []`. Enemy `Unit`s construct analogously from
  `EnemyDefinition`.
- Keep `HeroDefinition`/`EnemyDefinition` (authored, no `currentHP`/`position`)
  strictly distinct from `Unit` (runtime instance). Do not add flavor/`class`
  fields to `Unit`.
- `currentHP` and `position` are written **only** inside `Combat.resolve()` (via
  `damage`/`applyHazard` and `push`/`pull`/`swap`/`spawnUnit`). No system pokes
  them directly — Objective polls, it does not mutate.
- Thread `hazardImmunities` at the two Combat hazard sites (the `applyHazard`
  primitive and hazard-on-entry after displacement/spawn). Immunity is a set
  membership test on `HazardType` — O(1) for the ≤ small immunity lists in v1.
- Add `nodeType` to the `battle_ended` payload where Turn & Phase Manager emits
  it, sourced from the active encounter's node context; leave it `undefined` for
  a map-screen `Abandon`.
- Draft / Loadout Meta subscribes to `battle_ended` and writes each surviving
  deployed member's `currentHP` back to the persisted roster there.

## Alternatives Considered

### Alternative 1: Per-system unit shapes with an adapter layer

- **Description**: Let each system keep its own unit type (`HeroUnit`,
  `EnemyUnit`, Objective's `{faction, hp, alive}`) and write adapter/mapping
  functions at each boundary.
- **Pros**: Each team evolves its own shape independently; no coordination on a
  single type.
- **Cons**: Re-introduces exactly the C2 drift the design-review caught; every
  boundary needs a mapper that can silently disagree (an `alive` boolean vs a
  removed `Unit`); doubles the surface for determinism bugs; contradicts
  Principle P6 (contracts are the compiler's job).
- **Estimated Effort**: Higher (N mappers + ongoing sync) than a single type.
- **Rejection Reason**: Solves nothing C2 asked for and adds a permanent
  drift/maintenance tax.

### Alternative 2: Combat owns the Unit record

- **Description**: Put `Unit` in the Combat Resolution module since Combat is the
  only mutator of `currentHP`/`position`.
- **Pros**: Ownership sits next to the sole mutation path.
- **Cons**: Combat is a Core-layer primitive engine; `abilities:
  AbilityDefinition[]` and `archetype` are Feature-layer concepts. Combat would
  have to import the ability schema, coupling Core up into Feature and threatening
  the one-way "abilities compile to Combat primitives" rule (a cycle). Heroes &
  Abilities already owns `AbilityDefinition`, so co-locating `Unit` there keeps
  the two record types that reference each other in one place.
- **Estimated Effort**: Similar, but with an architectural cost.
- **Rejection Reason**: Would create a Core→Feature dependency / potential cycle;
  Heroes & Abilities is the correct owner (it already owns the ability schema
  `Unit` embeds).

### Alternative 3: Keep `hazardImmunities` out of `Unit`; special-case in abilities

- **Description**: Model immunity ad hoc inside individual abilities/hazards
  rather than as a first-class `Unit` field checked by Combat.
- **Pros**: Slightly smaller record.
- **Cons**: Immunity would be recomputed in many places, drifting from the single
  Combat hazard site; Ability Upgrades explicitly needs a per-unit immunity set to
  grant. Violates "one board-mutation/`resolve` computes damage once."
- **Rejection Reason**: Data-driven immunity checked once in Combat is simpler,
  testable, and matches the Ability Upgrades requirement.

## Consequences

### Positive

- One compiler-enforced `Unit` type; cross-system integration bugs from shape
  drift become compile errors, not runtime surprises (Principle P6).
- Closes contract C2; registry `unit_record` moves `pending → active` with a
  named owner.
- `hazardImmunities` checked in a single Combat site — data-driven, unit-testable
  headlessly, and directly satisfies the Ability Upgrades requirement.
- `battle_ended.nodeType` + `processRunEnd(outcome)` give run-terminal handling a
  clean, single, once-per-run entry point (Draft bonuses, Meta unlocks, Run UI
  routing) without back-queries.
- Fully deterministic: the record and every operation on it carry no RNG or
  clock, preserving byte-identical replay/undo/preview (Principle P1).

### Negative

- Coupling: all five referencing systems now depend on a single Heroes &
  Abilities type; a breaking change to `Unit` ripples widely (mitigated —
  breaking changes surface at compile time, and the type is intentionally small).
- Requires correcting `objective-and-win-lose.md` (drop `faction`/`hp`/`alive`
  phrasing) and flipping the registry status — coordination work across GDDs.
- Extending `battle_ended` and adding `processRunEnd` touches Turn & Phase
  Manager and Run Structure, which were previously "provisional" on this shape.

### Neutral

- `statusFlags` and multi-value `hazardImmunities` are carried but empty/minimal
  in the v1 base kit — reserved capacity for later content, no v1 behavior.
- `size` is present but pinned to `1`; the field exists so a future multi-tile
  design (Open Question 1) is an additive change, not a schema break.

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| A system silently redeclares its own unit shape, re-opening C2 drift | Medium | High | Single exported type; review/lint rule rejecting a second `*Unit` interface in the sim core; contracts file is authoritative |
| `hazardImmunities` checked in some hazard sites but not all | Low | Medium | Centralize the check inside `Combat.resolve()` hazard handling (one function), not per-ability; unit test immune-unit-on-hazard = no damage/no event |
| `battle_ended.nodeType` missing for map-screen Abandon breaks a consumer | Low | Medium | Type `nodeType` as optional; `processRunEnd` handles the absent case explicitly (Abandon path) |
| `Unit` grows god-object fields over time | Medium | Medium | Keep runtime `Unit` distinct from authored `HeroDefinition`/`EnemyDefinition`; new authored data goes on the Definition, not the instance |

## Performance Implications

Pure-web (TypeScript/PixiJS). No per-frame rendering cost — this is a data-model
and event contract in the headless sim core. Budgets below are simulation-core,
not render-frame.

| Metric | Before | Expected After | Budget |
|--------|--------|---------------|--------|
| CPU (frame time) | n/a | negligible (`hazardImmunities` = O(1) set test per hazard site) | Within the 16.6 ms/frame @60fps app budget; sim step << 1 ms |
| Memory | n/a | ~one small record per unit (≤ a handful of heroes + enemies per battle) | Trivial vs the localStorage/board budget |
| Load Time | n/a | none (compile-time type; no asset) | n/a |
| Network (if applicable) | n/a | none — single-player, no networking | n/a |

## Migration Plan

No code exists yet (first architecture artifacts), so this is a documentation +
first-implementation alignment plan, not a live migration.

1. Flip registry `unit_record` status `pending → active`; record Heroes &
   Abilities as owner. Verify: `entities.yaml` shows `active` + owner.
2. Correct `objective-and-win-lose.md` Open Question 1 to reference
   `team`/`maxHP`/`currentHP` (drop `faction`/`hp`/`alive`). Verify: no
   `faction`/`hp` unit phrasing remains in that GDD.
3. Confirm `enemy-abilities-and-telegraph.md`, `ability-upgrades.md`,
   `draft-and-loadout-meta.md` all *reference* (not redeclare) `Unit`.
4. Reflect `hazardImmunities` as a **Hard** dependency in
   `combat-resolution.md` (checked in `applyHazard` + hazard-on-entry).
5. Add `nodeType` to the `battle_ended` payload in `turn-and-phase-manager.md`;
   confirm `run-structure-node-map.md` / `meta-progression-and-unlocks.md`
   `processRunEnd(outcome)` sources it.
6. At implementation: declare `Unit` once in the Heroes module; all others
   import it. Verify with a test asserting no second unit interface + an
   immune-unit-on-hazard test.

**Rollback plan**: Since nothing depends on this at runtime yet, rollback = revert
the registry status and the GDD edits; systems fall back to the pre-C2 (drifting)
state. No data migration involved.

## Validation Criteria

- [ ] Exactly one `Unit` interface exists in the sim core; Enemy/Objective/
      Upgrades/Draft import it (grep/review finds no second unit shape).
- [ ] Registry `unit_record` is `status: active` with Heroes & Abilities as owner.
- [ ] A unit whose `hazardImmunities` contains a tile's `HazardType` takes **no**
      hazard damage and produces **no** `HazardApplied` event (unit test, headless).
- [ ] `currentHP`/`position` are mutated only through `Combat.resolve()` (no
      direct writes outside Combat — verified by review).
- [ ] `battle_ended` carries `nodeType` for battle-node outcomes and omits it for
      a map-screen `Abandon`; `processRunEnd(outcome)` is invoked exactly once per
      terminal run event.
- [ ] Objective's `battleState.units` and Draft's post-battle roster read the same
      `Unit` shape (integration test: HP written by Combat is what Draft persists).

## GDD Requirements Addressed

| GDD Document | System | Requirement | How This ADR Satisfies It |
|-------------|--------|-------------|--------------------------|
| `design/gdd/heroes-and-abilities.md` | Heroes & Abilities | "Unit Record Schema (authoritative)" — owns the canonical per-battle `Unit` record, referenced not re-shaped | Names Heroes & Abilities the sole owner; publishes the exact record once; flips registry `unit_record` to active |
| `design/gdd/enemy-abilities-and-telegraph.md` | Enemy, Abilities & Telegraph | Enemy units and living-hero targeting read "the shared `unit_record`" (`team = Hero/Enemy`) | Enemy imports and references `Unit` (same `team` discriminant); no parallel enemy-unit shape |
| `design/gdd/objective-and-win-lose.md` | Objective / Win-Lose | Open Q1: adopt the canonical `unit_record` (`team` not `faction`, `maxHP`/`currentHP` not `hp`) for `battleState.units` | Corrects the `faction`/`hp`/`alive` phrasing to the canonical shape; Objective polls the shared record |
| `design/gdd/ability-upgrades.md` | Ability Upgrades (+ Combat Resolution) | Per-unit `hazardImmunities` set must be checked inside `applyHazard` and every hazard-on-entry site ("Soft today, proposed Hard") | Makes `hazardImmunities` a first-class `Unit` field threaded through Combat's hazard call sites; promotes the Combat dependency to Hard |
| `design/gdd/draft-and-loadout-meta.md` | Draft / Loadout Meta | Write each deployed member's `currentHP` back at `battle_ended`; `battle_ended` must carry node-type context | References `Unit.currentHP`; adds `battle_ended.nodeType` so post-Battle/Elite bonuses branch on node type |
| `design/gdd/turn-and-phase-manager.md` | Turn & Phase Manager | Emits `battle_ended(result)` exactly once at terminal | Extends the `battle_ended` payload with `nodeType` (Battle/Elite/Boss), absent for map-screen Abandon |
| `design/gdd/run-structure-node-map.md` | Run Structure / Node Map | Rule 15: expose `processRunEnd(outcome: {result, nodeType?})` as the terminal-handling hook | Defines `processRunEnd(outcome)` as the single once-per-run entry point sourcing `nodeType` from `battle_ended` |
| `design/gdd/meta-progression-and-unlocks.md` | Meta-progression / Unlocks | `processRunEnd` runs exactly once per run, invoked from Run Structure's `processRunEnd(outcome)` hook, using `outcome.nodeType` | Guarantees the hook exists and carries `nodeType`, from which Meta's own `processRunEnd(runSummary,…)` is called once |
| `design/gdd/combat-resolution.md` | Combat Resolution | Hazard damage computed once in `resolve()`; unit vitality model (`Alive ↔ Removed`) | `hazardImmunities` consulted at the single Combat hazard site (per ADR-0006's mutation path); no per-ability special-casing |

## Related

- **Depends on** ADR-0006 — Combat `resolve()` single board-mutation path + the
  10-primitive vocabulary (defines the `applyHazard`/hazard-on-entry sites this
  ADR threads `hazardImmunities` through).
- Resolves cross-system contract **C2** — `design/architecture/cross-system-contracts.md` §6 (and §10 for `battle_ended.nodeType` / `processRunEnd`).
- `docs/architecture/architecture.md` §8, row **A8** (this ADR); §4 Module Ownership; §6 API Boundaries (the `Unit` interface).
- Registry: `design/registry/entities.yaml` → `unit_record`.
