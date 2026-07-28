# Encounter Generator

> **Status**: In Design
> **Author**: workflow (design-system fan-out)
> **Last Updated**: 2026-07-27
> **Implements Pillar**: #3 Variety Lives in the Draft, Not the Dice; #1 Perfect Information, Perfect Blame; #2 Positioning Over Power (secondary)

## Overview

Encounter Generator is the system that assembles one battle's complete setup —
terrain layout, spawn points, enemy spawn schedule, objective, and initial
hazards — by taking an **authored Encounter Template** and applying
**constrained procedural variation** (parameter rolls within ranges the
template itself declares), then **proving** the result is playable before it
ever reaches the player: a deterministic **solver** must find at least one
actual winning sequence of actions (solvability), and that sequence must not
be trivially easy (interest), or the candidate is rejected and regenerated. If
every retry fails, the generator falls back to the template's **Authored
Baseline** — a fixed, pre-validated variant that is guaranteed to pass,
because it was already proven once at content-authoring time. This is
explicitly **not** free-form random battle generation: every tile, enemy, and
hazard a generated battle can contain was placed there by a human template
author; the generator only chooses *which* of the author's declared options to
use, and only ever ships a choice it has constructively proven is fair. This
is what lets Pillar #3 (Variety Lives in the Draft, Not the Dice) extend past
the hero roster into the battles themselves — encounter *selection* is
randomized by a seeded, fully-reproducible process that runs once, outside
combat, before Turn 1 — while Pillar #1 (Perfect Information, Perfect Blame)
is upheld because the game never asks the player to face a battle nobody
(design-side) has confirmed is winnable.

## Player Fantasy

Encounter Generator has no ability icon and no on-screen presence — like
Board & Grid, Combat Resolution, and Turn & Phase Manager, it is invisible
infrastructure. What the player *feels* when it works is **"this battle was
built for me to solve, not rolled against me."** Every encounter should read
as deliberately composed — a Chasm placed to matter, a Lobber positioned to
threaten a chokepoint — even though no human placed *that specific* instance
by hand; the constrained-variation model exists precisely so the generator
can never produce the "obviously unfair" or "obviously trivial" layouts a
naive random generator would. This is Csikszentmihalyi's flow channel applied
to content generation: the solver's depth/narrowness targets (Formulas F5–F6)
are the mechanism that keeps a *procedurally assembled* battle inside the
same challenge band a hand-tuned Into the Breach level would occupy, rather
than drifting into boredom (too easy) or frustration (unsolvable, or solvable
only through a hidden non-obvious trick). The failure state of this system is
a battle that reaches the player without a real solution, or one so trivial
it never asks the player to think — either would quietly undermine Pillar #1
the same way a mis-telegraphed enemy action would, except the player has no
way to "blame" a miscalculation, because there wasn't a fair puzzle to solve
in the first place.

## Detailed Design

### Core Rules

1. **Ownership boundary.** Encounter Generator owns: the Encounter Template
   schema and catalog, the constrained-variation parameter-roll process
   (seeded, deterministic), the solvability/interest **solver**, the
   retry/fallback loop, and the compiled **Encounter Definition** it hands to
   Board & Grid, Combat Resolution, and Enemy, Abilities & Telegraph at battle
   setup. It does **not** own: battle resolution itself (Turn & Phase
   Manager / Combat Resolution), enemy AI behavior (Enemy, Abilities &
   Telegraph — the generator only *schedules* which archetype spawns where
   and when), which heroes exist or their abilities (Heroes & Abilities /
   Draft), or run/node-map routing (Run Structure / Node Map — the generator
   produces exactly one battle's setup per call, on request; it has no
   concept of a "run").
2. **No parallel simulation implementation (the load-bearing design
   decision of this document).** The solver does **not** reimplement combat,
   movement, or enemy AI. It drives a **headless instance of Turn & Phase
   Manager** against a `Board.snapshot()` (per `board-and-grid.md`'s
   snapshot contract), submitting candidate hero actions programmatically
   during simulated Player Phases instead of real player input — enumerated
   via Heroes & Abilities' `legalMoveTiles()` / `legalTargets()` and compiled
   via `compileEffects()`, the exact same functions a real Player Phase
   uses — and letting Environment, EnemyResolve, Spawn, and Telegraph run
   exactly as they would in a real battle — same `Combat.resolve()` calls,
   same `Enemy.chooseIntents()` / `resolveTelegraphed()` calls, same phase
   order. Victory/Defeat detection during simulation uses the same
   `Objective.evaluate(battleState, turn, config)` call a real battle's Turn
   & Phase Manager would make — never a parallel win-check. This mirrors the
   "no parallel preview implementation" rule already
   established for Move Preview in `combat-resolution.md` and
   `enemy-abilities-and-telegraph.md`: a second, independently-written combat
   simulator is exactly the kind of code that silently drifts from the real
   game and produces a "proven solvable" battle that isn't actually solvable
   in play. This single decision is what makes the solvability *guarantee*
   sound rather than aspirational.
3. **The solver only ever proves existence, never absence.** Given a
   candidate Encounter Definition, the solver runs a bounded search (Rule 6)
   over the headless simulator. If it **finds** at least one action sequence
   that reaches Victory, solvability is proven *constructively* — an actual
   working plan exists, full stop, no inference involved. If the search
   budget is exhausted without finding one, the candidate is treated as
   **not solvable within budget** and rejected — this is true whether the
   candidate is genuinely unsolvable or merely too hard for the search to
   find in time; the generator cannot and does not try to tell these apart
   (Edge Cases). This asymmetry is deliberate: the only failure mode the
   guarantee can have is "rejects some content that might actually have been
   fine" (a lost-variety cost), never "ships an unsolvable battle" (a
   broken-promise cost). The latter is unacceptable under Pillar #1; the
   former is merely a tuning concern (Tuning Knobs).
4. **Encounter Template** is the authored content unit (schema below). A
   template declares: fixed content (terrain that never varies, a base enemy
   layout), a small closed set of **variation slots** (terrain-feature
   toggles, spawn-point pools to draw from, enemy-archetype pools with count
   ranges, hazard toggles), an **objective template** with parameter ranges
   (e.g. `maxTurns` range for a survive-objective), and an **Authored
   Baseline** — one specific, fully-resolved, zero-ambiguity instance of the
   template that a human (or an offline authoring pass) has already run
   through the solver and confirmed passes. A template with **zero**
   variation slots is legal (fully fixed content) — see Edge Cases.
5. **Constrained variation, not free generation.** Every tile the generator
   can place terrain on, every candidate spawn-point tile, and every
   archetype that can appear, must already be present in the template's
   declared pools. The generator **never** invents a terrain layout, spawn
   location, or enemy composition that isn't one of the template author's
   explicit options — it only *selects* among them. This is the mechanical
   definition of "NOT fully-random battle generation" from `systems-index.md`.
6. **Generation is a two-phase seeded process (deterministic, reproducible).**
   Given `(runSeed, nodeId, difficultyConfig, rosterSnapshot)`:
   a. **Template selection** — exactly one eligible template (one whose
      `eligibleTiers` includes the requested tier, and whose minimum roster
      requirements are met by `rosterSnapshot` — Edge Cases) is drawn once,
      deterministically, from `difficultyConfig`'s candidate pool, using a
      seed derived from `(runSeed, nodeId)` only (Formula F1). Template
      choice does **not** vary across retry attempts within the same
      generation call.
   b. **Variation rolling** — for `attemptIndex = 0, 1, 2, …` up to
      `max_generation_attempts − 1`: derive `encounterSeed(attemptIndex)`
      (Formula F1), drive a seeded PRNG stream from it (Formula F2), and roll
      every one of the chosen template's variation slots **in the template's
      declared slot order** (Formula F3) — this fixed order is what makes
      the roll itself deterministic and independent of any implementation
      detail like object/map iteration order.
7. **Compile step.** The rolled parameters are resolved into a concrete
   **Encounter Definition** (schema below): a full terrain grid, a spawn
   schedule (`{archetypeId, spawnPointTile, scheduledTurn}[]`), an objective
   definition (including `maxTurns` — see Rule 11), and initial hazard
   placements. Compilation includes a cheap **structural feasibility check**
   before the solver ever runs (e.g., "does the spawn-point pool have enough
   candidate tiles for the rolled composition's count, drawn without
   replacement?" — Edge Cases). A structural failure is treated identically
   to a solver rejection (Rule 9) — it consumes an attempt and triggers a
   re-roll, without paying the solver's search cost.
8. **Validation step (the solver).** A compiled candidate that passes the
   structural check is handed to the solver, which runs, in order:
   a. **Triviality guard** — a cheap, fixed baseline strategy (default: "pass
      every turn, take no actions") is simulated first. If this baseline
      alone reaches Victory, the candidate is rejected immediately — no
      further search is needed to know it's degenerate (Sirlin's "dominant
      trivial strategy" pattern: a puzzle with a free win isn't a puzzle).
   b. **Constructive search** — a bounded best-first search (Rule 6/Formula
      F5) over the headless simulator, capped at `solver_max_nodes` expanded
      nodes and `solver_horizon_turns` simulated turns. The search records
      every winning branch it finds within budget: `solutionsFound`,
      `nodesExpanded`, and `solutionDepthMin` (the shortest winning branch's
      action count).
   c. **Interest check (Formula F6)** — the candidate passes only if
      `solutionDepthMin` falls within the difficulty tier's declared
      `[depth_min, depth_max]` range **and** `narrowness = solutionsFound /
      nodesExpanded` is at or below the tier's `narrowness_max`. Both bounds
      come from `difficultyConfig` (Rule 12), never a global constant — a
      tier-1 tutorial battle and a tier-8 late-run battle have different
      "interesting" thresholds by design.
9. **Retry loop.** Any failure in Rule 7 or Rule 8 (structural, triviality,
   no-solution-in-budget, or out-of-range depth/narrowness) rejects the
   attempt: `attemptIndex += 1`, loop to Rule 6b, up to
   `max_generation_attempts` total roll attempts for the selected template.
10. **Baseline fallback (the guarantee's backstop).** If every rolled attempt
    is rejected, the generator returns the selected template's **Authored
    Baseline** verbatim — no further rolling, no further validation (it was
    already proven at authoring time, Rule 4). The returned Encounter
    Definition is flagged `usedFallbackBaseline = true` for
    telemetry/QA visibility (never shown to the player — a fallback battle is
    not lesser content, it is the template author's own hand-confirmed best
    instance). Because the baseline is required (Rule 13) to have already
    passed the identical solver used at runtime, this path can never itself
    fail — it is the mathematical floor under the "guaranteed solvable"
    promise.
11. **`maxTurns` ownership.** Encounter Generator authors `maxTurns` as part
    of the objective it compiles (Rule 7), which resolves
    `turn-and-phase-manager.md`'s Open Question #9 ("`max_turns` is owned by
    the Objective/Encounter system"): this system *is* that owner. The
    solver's `solver_horizon_turns` is capped at `min(maxTurns,
    solver_horizon_turns_knob)` — never allowed to search past the actual
    battle's turn limit (Tuning Knobs).
12. **Difficulty config is a parameter, never a call target.** Encounter
    Generator exposes exactly one entry point,
    `generateEncounter(runSeed, nodeId, difficultyConfig, rosterSnapshot) →
    EncounterDefinition`. `difficultyConfig` (template pool, `depth_min/max`,
    `narrowness_max`, count-scaling knobs — Formula F4) is **supplied by the
    caller**, not fetched by this system from Difficulty Tiers. This is the
    same interface-inversion pattern `turn-and-phase-manager.md` uses for
    Combat/Enemy/Objective: it is what keeps the dependency direction
    consistent with `systems-index.md`, which lists **Difficulty Tiers as
    depending on Encounter Generator** (not the reverse). Per the
    cross-system contracts (C1), **Difficulty Tiers is this system's sole
    direct caller**: it assembles `difficultyConfig` and invokes
    `generateEncounter(...)` unmodified from inside its own
    `getEncounterForNode(runSeed, nodeId, nodeIndex, ascensionOffset,
    rosterSnapshot) → {tier, encounter}` entry point. Run Structure / Node
    Map does **not** call `generateEncounter(...)` directly — it calls
    Difficulty Tiers' `getEncounterForNode(...)`, and the `tier` that call
    returns is the single source of truth for both Map/Run UI display and
    this generator's difficulty curve.
13. **Authored Baseline must be pre-validated offline.** Every template in
    the runtime catalog must carry `baselineVerified = true`, set by an
    offline authoring-time pass that runs the *exact same* solver (Rule 8)
    against the baseline once, before the template is ever added to the
    catalog. A template whose baseline has not been verified is a
    content-authoring error and is rejected at **catalog load**, not at
    generation time (Edge Cases) — the runtime guarantee never depends on an
    unverified fallback.
14. **Reproducibility.** Given identical `(runSeed, nodeId, difficultyConfig,
    rosterSnapshot)` inputs, `generateEncounter()` always returns a
    byte-identical `EncounterDefinition` — no wall-clock time, no non-seeded
    randomness, no dependency on prior calls' internal state. This is what
    makes a shareable "daily seed" run (a retention hook flagged in
    `game-concept.md`) mechanically possible, and it is also the property
    that makes this system's acceptance criteria testable at all.

### Data Contracts

```
EncounterTemplate {
  templateId: string
  eligibleTiers: int[]                 // difficulty tiers this template may serve
  minRosterSize: int                   // template's assumed minimum living-hero count (Rule 6a / Edge Cases)
  boardSizeOverride?: { width: int, height: int }   // default: registry grid_width x grid_height (8x8)
  terrainBase: TerrainGrid             // fixed terrain, never varies
  terrainVariationSlots: { tile: Coord, options: TerrainType[] }[]
  spawnPointPool: Coord[]              // candidate tiles; composition draws without replacement (Rule 7 / Edge Cases)
  enemyCompositionSlots: { archetypePool: ArchetypeId[], countRange: [min:int, max:int] }[]
  objectiveTemplate: { type: ObjectiveType, paramRanges: {...} }  // e.g. maxTurns range
  hazardVariationSlots: { tile: Coord, options: (HazardType | None)[] }[]
  authoredBaseline: EncounterDefinition   // fully resolved, zero ambiguity
  baselineVerified: bool                  // gate for catalog load (Rule 13)
}

EncounterDefinition {
  encounterSeed: uint32
  templateId: string
  usedFallbackBaseline: bool
  boardSize: { width: int, height: int }
  terrain: TerrainGrid                 // full per-tile terrain, consumed by Board & Grid at setup
  spawnPoints: { tile: Coord }[]        // Board & Grid 'spawn-point' flags
  objectiveTiles: { tile: Coord }[]     // Board & Grid 'objective' flags
  objective: { type: ObjectiveType, params: {...}, maxTurns: int }
  spawnSchedule: { archetypeId: ArchetypeId, spawnPointTile: Coord, scheduledTurn: int }[]
  initialHazards: { tile: Coord, hazardType: HazardType, duration: int|null }[]
  difficultyTier: int
  solverReport: { solutionDepthMin: int, solutionsFound: int, nodesExpanded: int, narrowness: float }
}
```

`solverReport` is diagnostic/telemetry data only — no gameplay system reads
it at runtime; it exists for QA/balance review and for the acceptance-test
harness.

### States and Transitions

**Generation lifecycle** (per `generateEncounter()` call):

`Requested → TemplateSelected → Rolling(attemptIndex) → Compiling →
Validating → [Accepted → Finalized] | [Rejected → Rolling(attemptIndex+1)]`
… looping until `Accepted` or `attemptIndex == max_generation_attempts`, at
which point → `BaselineFallback → Finalized`.

| State | Entered when | Deterministic inputs | Exit |
|-------|--------------|----------------------|------|
| `Requested` | `generateEncounter(...)` called | full call params | → `TemplateSelected` |
| `TemplateSelected` | Rule 6a draw completes | `seed(runSeed, nodeId)` | → `Rolling(0)` |
| `Rolling(i)` | attempt `i` begins | `encounterSeed(i)` (F1), template's slot order | → `Compiling` |
| `Compiling` | all slots rolled | rolled values | → `Validating` (pass) or `Rejected` (structural failure) |
| `Validating` | compile succeeds | compiled `EncounterDefinition`, `difficultyConfig` | → `Accepted` or `Rejected` |
| `Rejected(reason)` | any failure in Compiling/Validating | — | → `Rolling(i+1)` if `i+1 < max_generation_attempts`, else → `BaselineFallback` |
| `BaselineFallback` | all attempts exhausted | template's `authoredBaseline` | → `Finalized` |
| `Accepted` / `Finalized` | validation passes, or baseline used | — | terminal — `EncounterDefinition` returned |

There is no `Finalized → *` transition: one call produces exactly one
result. A fresh `generateEncounter()` call (even with identical inputs) is a
new, independent lifecycle that reproduces the same result (Rule 14) rather
than reusing prior internal state.

### Interactions with Other Systems

Encounter Generator is a **producer + orchestrating consumer**: it is called
once per battle setup, and it drives a headless simulation loop internally
(Rule 2) that itself calls into Turn & Phase Manager, Combat Resolution, and
Enemy, Abilities & Telegraph exactly as a real battle would.

| System | Encounter Generator reads/calls | Encounter Generator provides | Ownership boundary |
|--------|----------------------------------|-------------------------------|---------------------|
| **Board & Grid** ✅ | `inBounds`, `snapshot()` (for the solver's headless board copies) | writes initial terrain layout, `spawn-point` & `objective` flags at battle setup (per `board-and-grid.md`'s own Downstream table) | Generator authors initial spatial state; Board validates invariants |
| **Combat Resolution** ✅ | `resolve(board, effects)` — both for authoring initial hazards (`spawnHazard`) at real battle setup *and* for every simulated turn inside the solver | initial hazard placements (`spawnHazard` calls) | Generator authors *what* exists at setup and *what actions* to try in simulation; Combat Resolution resolves both identically to a real battle |
| **Enemy, Abilities & Telegraph** ✅ | enemy archetype catalog; `spawnEnemy(archetypeId, tile)`; `chooseIntents()` / `resolveTelegraphed()` (both for real spawn scheduling *and* inside the solver's headless simulation) | the spawn-instruction schedule (`spawnSchedule`, per that system's Rule 14 contract) | Generator authors *which/where/when* enemies exist; Enemy executes spawn/telegraph/resolve mechanics identically whether real or simulated |
| **Turn & Phase Manager** ✅ | drives a **headless instance** of the manager itself during solving (Rule 2) — the same phase-order code path, fed simulated hero actions instead of player input | — | Generator reuses, never reimplements, phase sequencing |
| **Heroes & Abilities** ✅ | `legalMoveTiles(origin, moveRange, board)`, `legalTargets(caster, ability, board)`, `compileEffects(caster, ability, selectedTarget)` — the action space the solver enumerates during simulated Player Phases and compiles to Combat primitives, identical to a real battle | — | **Hard dependency**: the solver cannot simulate a Player Phase without this contract |
| **Objective / Win-Lose** ✅ | `evaluate(battleState, turn, config)` — the solver's headless Turn & Phase Manager instance calls this exactly as a real battle would, to detect the simulated Victory/Defeat the search is looking for | authors the `objective` definition (type, params, `maxTurns`) that this same evaluator reads, as `config`, at real battle time | Generator authors *what* the objective is; Objective evaluates it identically in solving and in play |
| **Difficulty Tiers** ✅ | — (never calls into Difficulty Tiers) | exposes `generateEncounter(...)`, consumed by Difficulty Tiers' `getEncounterForNode(...)`, which assembles the `difficultyConfig` **parameter** (Rule 12) — template pool, `depth_min/max`, `narrowness_max`, count-scaling knobs | Interface inversion: Difficulty Tiers calls Encounter Generator, not vice versa — matches `systems-index.md`'s declared dependency direction |
| **Run Structure / Node Map** ✅ | — (never called directly; see below) | indirect only: Run Structure calls Difficulty Tiers' `getEncounterForNode(runSeed, nodeId, nodeIndex, ascensionOffset, rosterSnapshot) → {tier, encounter}` (C1), which wraps this system's `generateEncounter(...)` unmodified | Generator has no concept of a run or a map, and no direct call boundary with Run Structure; Difficulty Tiers is the sole direct caller |
| **Board Rendering & Juice / Battle HUD** ✅ | — | the finalized `EncounterDefinition`'s terrain/spawn/objective data is read (via Board & Grid) to render the initial board state | Indirect / Soft — mediated through Board & Grid, not called directly |

**Bidirectional-consistency note:** `board-and-grid.md`,
`combat-resolution.md`, and `enemy-abilities-and-telegraph.md` all list
Encounter Generator as a dependent, consistent with the Upstream rows above;
this GDD additionally clarifies that Combat Resolution and Enemy's
`resolve()`/`chooseIntents()`/`resolveTelegraphed()` entry points are called
**both** at real battle setup **and** repeatedly inside the solver's headless
simulation — an addition to, not a contradiction of, those systems' existing
contracts. `objective-and-win-lose.md` already lists Encounter Generator as a
Hard, provisional upstream dependency (it authors the `ObjectiveConfig` that
document's `evaluate()` consumes as `config`), consistent with this
document's Downstream row for Objective / Win-Lose below.
`heroes-and-abilities.md` lists Encounter Generator as a **Soft** dependent
reading only `squad_size`/`HeroDefinition` — it does not yet reflect that
Encounter Generator's solver is a **Hard** consumer of `legalMoveTiles()` /
`legalTargets()` / `compileEffects()`; this should be flagged via
`/consistency-check` when that document is next revised.
`systems-index.md` lists Difficulty Tiers and Run Structure / Node Map as
both depending on Encounter Generator; per C1's resolution, the accurate call
chain is Run Structure → Difficulty Tiers → Encounter Generator — Run
Structure never calls `generateEncounter()` directly, even though
`systems-index.md`'s flat dependency list does not distinguish direct from
indirect callers. Rule 12's interface inversion (Encounter Generator must
never call *into* Difficulty Tiers) holds regardless of this indirection.

## Formulas

All formulas are deterministic. Examples use the default **8×8** board
(registered constants `grid_width`, `grid_height`).

### F1. Encounter seed derivation

`encounterSeed(attemptIndex) = mix(runSeed, nodeId, templateId, attemptIndex)`

where `mix` is a well-distributed, deterministic 32-bit hash combiner (e.g.
FNV-1a or splitmix32 over the concatenated inputs). The exact algorithm is an
implementation choice pinned via ADR (Open Questions); the **contract** is
fixed regardless of choice: identical inputs always yield an identical
output, and changing any single input — even `attemptIndex` by 1 — yields a
statistically independent-looking output, so a retry is a genuinely different
roll, not a re-check of the same one.

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| run seed | `runSeed` | uint32 | any | Set once at run start; owned by Run Structure / Node Map |
| node id | `nodeId` | uint32 | any | This battle's node index in the run map |
| template id | `templateId` | string→uint32 | any | The template selected in Rule 6a |
| attempt index | `attemptIndex` | int | `[0, max_generation_attempts−1]` | Increments once per rejected roll |

**Output:** uint32 seed, `[0, 2^32−1]`. **Worked example (illustrative, not a
computed hash value):** `runSeed=0xA1B2C3D4, nodeId=7, templateId="chasm_flank_01", attemptIndex=0`
→ `encounterSeed(0) = mix(...) = <some uint32>`; `attemptIndex=1` with all
other inputs unchanged → a decorrelated, unrelated-looking uint32 — exact
values are pinned by unit test against a fixed reference vector once `mix`
is chosen, not hand-derived in this document.

### F2. PRNG stream (mulberry32)

```
state = encounterSeed
next():
  state = (state + 0x6D2B79F5) mod 2^32
  t = state
  t = (t ^ (t >> 15)) * (t | 1) mod 2^32
  t = t ^ (t + (t ^ (t >> 7)) * (t | 61)) mod 2^32
  return ((t ^ (t >> 14)) mod 2^32) / 2^32     // float in [0, 1)
```

> **Canonical algorithm.** This `mix()` combiner + `mulberry32` stream is
> registered as **`mulberry32_prng`** in `design/registry/entities.yaml`, with
> this document as its **canonical source**. Run Structure / Node Map and Draft
> / Loadout Meta reuse the *identical* algorithm and differ only in the salt
> constant they feed `mix()`; no consumer may re-derive or diverge the
> algorithm — changes are made here and propagated.

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| PRNG state | `state` | uint32 | any | Advances by one fixed increment per `next()` call |
| seed | `encounterSeed` | uint32 | `[0, 2^32−1]` | From Formula F1; initializes `state` |
| draw | output | float | `[0, 1)` | Consumed by Formula F3, one draw per variation slot, in the template's declared slot order |

**Output range:** `[0, 1)`, uniformly distributed (mulberry32 is a
well-known, statistically adequate PRNG for this non-cryptographic use).
**Note:** slot order is fixed by the template's authored declaration order —
never by map/object iteration order in the implementing language — so two
different runtimes rolling the same template produce the same sequence of
draws.

### F3. Slot value resolution

`rollInt(draw, min, max) = min + floor(draw × (max − min + 1))`
`rollChoice(draw, pool) = pool[floor(draw × |pool|)]`
`rollWithoutReplacement(draws[], pool, k)`: draws `k` distinct elements from
`pool` by repeatedly applying `rollChoice` against the **remaining** pool
(each selected element removed before the next draw), consuming one `next()`
draw per selection.

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| draw | `draw` | float | `[0,1)` | One PRNG output (F2) |
| range bounds | `min, max` | int | template-declared | Inclusive integer range for a count slot |
| pool | `pool` | array | template-declared | Candidate set for a choice slot (archetype, terrain option, spawn tile) |
| pool size | `|pool|` | int | ≥1 | Number of candidates |

**Output range:** `rollInt ∈ [min, max]`; `rollChoice ∈ pool` (index
`[0, |pool|−1]`, never out of bounds since `draw < 1`). **Worked example:**
`draw=0.62`, `min=2, max=4` → `floor(0.62 × 3) = 1` → `2 + 1 = 3` enemies
rolled for a composition slot. **Worked example (choice):** `draw=0.81`,
`pool=[Charger, Lobber, Broodmother]` (`|pool|=3`) → `floor(0.81 × 3) = 2` →
`Broodmother` selected.

### F4. Difficulty-tier count scaling

`enemyCount = clamp(baseCount + floor(tierIndex × countScalePerTier), countRange.min, countRange.max)`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| base count | `baseCount` | int | template-declared | The composition slot's un-scaled center value |
| tier index | `tierIndex` | int | `≥0` | Difficulty tier ordinal, supplied via `difficultyConfig` |
| scale per tier | `countScalePerTier` | float | `0–2` (Tuning Knobs) | How much one tier step adds to the count, before rounding |
| composition range | `countRange` | `[min,max]` | template-declared | Rule 4's declared bounds — scaling can never push a slot outside its own template's authored range |

**Output range:** `[countRange.min, countRange.max]` (always clamped — a
tier's scaling can shift *where in the template's declared range* a count
lands, never push it outside that range; template authors are the ceiling on
raw difficulty, not `difficultyConfig`). **Worked example:** `baseCount=2,
tierIndex=3, countScalePerTier=0.5, countRange=[2,4]` → `2 + floor(1.5) = 3`
→ clamp to `[2,4]` → `3` (no clamping needed here). **Worked example
(clamped):** same inputs but `tierIndex=6` → `2 + floor(3.0) = 5` → clamped
to `countRange.max = 4`.

### F5. Solver search budget and branching estimate

`nodesExpanded ≤ solver_max_nodes` (hard cap, search halts and reports
"not found" the instant this is reached without a Victory node).

Per-turn branching-factor estimate (why exhaustive search is intractable and
a bounded, heuristic-ordered best-first search is required instead of
brute-force minimax):
`b ≈ Σ_{heroes} (moveOptions × abilityOptions × targetOptions)`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| nodes expanded | `nodesExpanded` | int | `[0, solver_max_nodes]` | Search states visited this validation pass |
| node budget | `solver_max_nodes` | int | Tuning Knobs | Hard search cap |
| branching factor | `b` | int (estimate) | scenario-dependent | Rough per-turn choice-point size, for budget-setting intuition only — not a formula the solver itself evaluates |
| move options | `moveOptions` | int | ~5–20 | Reachable tiles per hero per turn (bounded by `moveRange`) |
| ability options | `abilityOptions` | int | ~1–3 | Verbs available per hero |
| target options | `targetOptions` | int | ~1–10 | Valid targets/tiles per ability |

**Output:** `nodesExpanded` is a diagnostic count, not a pass/fail value by
itself (see F6). **Worked example (why budget matters, not a literal
formula output):** 3 heroes, each with `moveOptions≈10, abilityOptions≈2,
targetOptions≈5` → `b ≈ 3 × (10×2×5) = 300` action choices at a single
turn's decision point; across a 6-turn horizon, brute-force enumeration is
`300^6 ≈ 7×10^14` — obviously intractable, which is precisely why Rule 8b
specifies a **heuristic-guided, bounded best-first search** (prioritizing
nodes that reduce remaining-threat count or approach the objective) rather
than exhaustive search: the solver is a bounded existence-prover, not an
optimal planner.

### F6. Interest score (narrowness + minimum depth)

`narrowness = solutionsFound / nodesExpanded` (undefined/treated as `1.0`
if `nodesExpanded = 0`, i.e. an instant triviality-guard rejection never
reaches this formula)

`passes = (depth_min ≤ solutionDepthMin ≤ depth_max) AND (narrowness ≤ narrowness_max)`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| solutions found | `solutionsFound` | int | `[0, nodesExpanded]` | Distinct winning branches discovered within budget |
| nodes expanded | `nodesExpanded` | int | `[1, solver_max_nodes]` | Total search states visited |
| narrowness | `narrowness` | float | `[0, 1]` | Proportion of explored branches that won — low = tight puzzle, high = trivially winnable |
| min solution depth | `solutionDepthMin` | int | `≥0` | Shortest found winning branch's action count |
| tier depth range | `depth_min, depth_max` | int | `difficultyConfig`-supplied | Target challenge band for this tier |
| narrowness ceiling | `narrowness_max` | float | `difficultyConfig`-supplied, `0–1` | Above this, too many branches win — reject |

**Output:** boolean `passes`. **Worked example (accepted):**
`nodesExpanded=4000, solutionsFound=12` → `narrowness=0.003` (0.3%);
`solutionDepthMin=6`, tier range `[4,8]` → both checks pass → **Accepted.**
**Worked example (rejected — too easy):** `nodesExpanded=4000,
solutionsFound=1800` → `narrowness=0.45`; even if `solutionDepthMin` is in
range, `0.45 > narrowness_max (e.g. 0.05)` → **Rejected**, re-roll.

## Edge Cases

- **Rolled variation's spawn-point pool has fewer usable candidate tiles
  than the rolled composition's total enemy count (drawn without
  replacement, Formula F3):** the structural feasibility check (Rule 7)
  fails **before** the solver runs; treated as a rejection, `attemptIndex`
  increments, re-roll. No collision-resolution is attempted — this is
  prevented by drawing spawn tiles without replacement in the first place,
  not resolved after the fact.
- **Rolled terrain variation fully partitions the board so no path exists
  from any spawn point to the objective:** the compile step's structural
  check does not catch this (it is not a pool-size problem); the solver's
  constructive search finds zero winning branches within budget → rejected
  identically to any other "not solvable within budget" outcome (no special
  case is needed — the search naturally fails to find a nonexistent
  solution).
- **All `max_generation_attempts` variation attempts are rejected:** the
  generator returns the selected template's `authoredBaseline` verbatim,
  flags `usedFallbackBaseline = true`, and performs no further rolling or
  validation for this call (Rule 10). This path cannot itself fail (Rule
  13's offline pre-verification guarantee).
- **A template's `authoredBaseline` has `baselineVerified = false` or the
  field is missing:** rejected at **catalog load time**, before this system
  ever runs — the catalog loader reports a content-authoring error naming
  the offending `templateId`; this template never becomes selectable via
  Rule 6a. This is a build-time/content-QA failure, not a runtime path.
- **The solver's `solver_max_nodes` budget is exhausted with zero winning
  branches found:** identical outcome to the partitioned-board case above —
  "not solvable within budget," rejected, re-roll. The generator does not
  distinguish "genuinely unsolvable" from "too hard to find in time" (Rule
  3) — both produce the same rejection.
- **The fixed do-nothing baseline strategy alone reaches Victory (e.g. a
  "survive N turns" objective with no enemies capable of reaching any
  hero):** the triviality guard (Rule 8a) rejects the candidate immediately,
  without running the full constructive search — cheaper and catches this
  specific degenerate class directly, rather than relying on the depth
  check (which a "trivial but not depth-0" battle might otherwise slip
  past).
- **`difficultyConfig` supplies an internally invalid range
  (`depth_min > depth_max`, or `narrowness_max` outside `[0,1]`):** rejected
  at config load/validation, before any `generateEncounter()` call is
  attempted — a config-authoring error, analogous to Board & Grid rejecting
  `W < 1` at construction, not a per-encounter runtime path.
- **`rosterSnapshot` has fewer living heroes than a template's
  `minRosterSize` (e.g. a permadeath run continuing with 1 hero against a
  template authored assuming 2+):** the template is excluded from the
  eligible pool at Rule 6a's selection step — this is a pre-filter on
  *eligibility*, not a validator rejection. **PROVISIONAL:** if this filter
  empties the eligible-template pool entirely for the requested tier, the
  call fails loudly (an unrecoverable content-configuration error); Run
  Structure / Node Map must never allow this state to be reachable (an
  upstream contract this document assumes but cannot itself enforce).
- **A template declares zero variation slots (fully fixed content):** no
  PRNG draws occur (Formulas F2/F3 are never invoked); the compiled
  Encounter Definition is a pure function of `templateId` alone. Validation
  still runs exactly once. If it fails, there is no different roll to
  retry — the generator proceeds directly to `BaselineFallback` (Rule 10),
  which for a zero-slot template must equal the template's own fixed
  content (Rule 13's offline verification therefore already covers this
  template's only possible output — a runtime failure here would indicate a
  corrupted template file, not a generation-time edge case).
- **`(runSeed, nodeId)` is requested twice** (e.g. the player reloads a run
  from a save, or a "daily seed" is shared): the returned
  `EncounterDefinition` is byte-identical both times (Rule 14) — this is the
  mechanism, not a side effect, that makes shareable seeded runs possible.
- **Heroes & Abilities' `legalMoveTiles()` / `legalTargets()` /
  `compileEffects()` contract is designed but not yet implemented in code**
  (current project state): until an implementation exists, the solver's
  action-space enumeration is a stub/mock; this remains a **hard
  dependency** (Dependencies section) — Encounter Generator's solver cannot
  be meaningfully implemented, let alone tested against real hero kits,
  until that implementation lands.
- **An already-generated `EncounterDefinition` is invalidated later by an
  unrelated meta-layer change** (e.g. a hero permanently dies in an earlier
  battle after this node's encounter was pre-generated ahead of time):
  **resolved by `run-structure-node-map.md`'s Rule 11** — Run Structure /
  Node Map calls `generateEncounter(...)` (via Difficulty Tiers'
  `getEncounterForNode(...)`) **lazily, on node entry**, rather than
  pre-generating ahead of time, so `rosterSnapshot` is always current at the
  moment of generation. Encounter Generator's own guarantee remains scoped
  to *at the moment of generation, using the `rosterSnapshot` it was given*
  — the lazy-call policy is what keeps that snapshot fresh in practice.
- **Two different templates, rolled independently for two different nodes
  in the same run, happen to produce visually or structurally near-identical
  Encounter Definitions:** not prevented by this system — variety comes
  from having a sufficiently large template catalog (a content/authoring
  concern), not from a runtime cross-node uniqueness constraint. A
  "don't repeat a template within N nodes" policy, if wanted, belongs to Run
  Structure / Node Map, not this document — **PROVISIONAL** cross-reference.
- **`solver_horizon_turns` is configured lower than the compiled
  encounter's `maxTurns`:** the solver only searches the first
  `solver_horizon_turns` simulated turns; a solution reachable only on a
  later turn is invisible to the search and the candidate is rejected as
  "not solvable within budget" even though it may in fact be solvable with
  more turns. This is a documented, accepted false-negative source (a
  Tuning Knobs trade-off), not a bug — the guarantee's soundness (Rule 3)
  is unaffected because a false negative can only ever cause an
  over-rejection, never ship an unsolvable battle.
- **The same enemy archetype is rolled into two different composition
  slots that then both attempt to claim the same spawn-point tile:**
  prevented structurally by Formula F3's "without replacement" draw for
  spawn-tile assignment — each candidate tile is removed from the pool the
  instant it's assigned, so this collision cannot occur by construction; if
  the pool is too small to satisfy the total rolled count, that is the
  first edge case above (structural infeasibility), not a runtime
  collision to resolve.

## Dependencies

**Upstream (Encounter Generator depends on):**

| System | Interface | Hard / Soft |
|--------|-----------|--------------|
| **Board & Grid** ✅ | `inBounds`, `snapshot()` (solver's headless board copies); mutation entry points for authoring initial terrain/flags at real battle setup | **Hard** |
| **Combat Resolution** ✅ | `resolve(board, effects)` — used both to author initial hazards at setup and repeatedly inside the solver's simulated turns | **Hard** |
| **Enemy, Abilities & Telegraph** ✅ | enemy archetype catalog; `spawnEnemy(archetypeId, tile)`; `chooseIntents()` / `resolveTelegraphed()` — both for real spawn scheduling and inside solving | **Hard** |
| **Turn & Phase Manager** ✅ | drives a **headless instance** of the manager during solving (Rule 2) | **Hard** |
| **Heroes & Abilities** ✅ | `legalMoveTiles(origin, moveRange, board)`, `legalTargets(caster, ability, board)`, `compileEffects(caster, ability, selectedTarget)` — the solver's Player-Phase action space and effect compilation | **Hard** |
| **Objective / Win-Lose** ✅ | `evaluate(battleState, turn, config)` — used by the solver's headless simulation to detect simulated Victory/Defeat | **Hard** |

**Downstream (systems that depend on Encounter Generator):**

| Dependent System | Interface (what it uses) | Hard / Soft |
|-------------------|---------------------------|--------------|
| **Difficulty Tiers** ✅ | Calls `generateEncounter(...)` from inside its own `getEncounterForNode(runSeed, nodeId, nodeIndex, ascensionOffset, rosterSnapshot)` entry point, supplying `difficultyConfig` as a parameter — never called *by* this system (Rule 12, interface inversion) | **Hard** — matches `systems-index.md`'s declared direction |
| **Run Structure / Node Map** ✅ | Calls Difficulty Tiers' `getEncounterForNode(...) → {tier, encounter}` (C1) — does **not** call `generateEncounter(...)` directly; no direct call boundary with this system | **Soft / indirect** — mediated through Difficulty Tiers |
| **Objective / Win-Lose** ✅ | Consumes the `objective` field (type, params, `maxTurns`) of the finalized `EncounterDefinition`, as the `config` argument to its own `evaluate(battleState, turn, config)` | **Hard** — reflected in that system's own GDD as a Hard, provisional upstream dependency |
| **Board Rendering & Juice / Battle HUD** ✅ | Read the finalized `EncounterDefinition`'s terrain/spawn/objective data, mediated through Board & Grid, at battle-setup render time | **Soft / indirect** |

**Bidirectional-consistency note:** `board-and-grid.md`,
`combat-resolution.md`, and `enemy-abilities-and-telegraph.md` already list
Encounter Generator as a Hard dependent, consistent with the Upstream rows
above. `objective-and-win-lose.md` also lists Encounter Generator as a Hard,
provisional upstream dependency, via the shared `evaluate()`/`config`
contract this document assumes. `heroes-and-abilities.md` lists Encounter
Generator only as a **Soft** dependent reading `squad_size`/`HeroDefinition`
— it does not yet reflect the solver's **Hard** use of `legalMoveTiles()` /
`legalTargets()` / `compileEffects()`; flagged via `/consistency-check` for
that document's next revision. `systems-index.md` lists Difficulty Tiers and
Run Structure / Node Map as both depending on Encounter Generator —
consistent with the Downstream rows above, though per C1 the actual call
chain is Run Structure → Difficulty Tiers → Encounter Generator (Run
Structure never calls this system directly); `systems-index.md`'s flat
dependency list does not distinguish direct from indirect callers. Rule 12's
interface inversion (Encounter Generator must never call *into* Difficulty
Tiers, or the declared dependency direction would form a cycle) holds
regardless of this indirection.

## Tuning Knobs

| Knob | Default | Safe Range | Category | Too Low | Too High |
|------|---------|-----------|----------|---------|----------|
| `max_generation_attempts` | 8 | 1–20 | Gate | Falls back to the Authored Baseline very often, eroding the "constrained variation" value proposition — every node starts to feel identical | Worst-case generation latency grows roughly linearly with attempts (each pays a solver run); risk of a noticeable load hitch between battles/nodes |
| `solver_max_nodes` | 5,000 | 500–50,000 | Gate | False negatives spike — genuinely solvable variations get rejected as "unproven," driving excessive baseline fallback and wasted CPU on retries that all fail the same way | Generation latency grows per attempt; past a point the marginal solvability-detection gain per extra node is small relative to the added wait |
| `solver_horizon_turns` | `min(maxTurns, 8)` | 3–12 | Gate | Rejects genuinely multi-turn-solvable variations that only pay off past the horizon (Edge Cases) — an accepted, documented trade-off, not a bug, but too low makes it common | Search cost grows combinatorially with horizon depth (each extra turn multiplies the per-turn branching factor, Formula F5) — risks near-never completing within `solver_max_nodes` |
| `target_solution_depth_min` / `_max` (per tier, via `difficultyConfig`) | tier-scaled, e.g. tier 1 `[2,5]`, tier 5 `[6,12]` | 1–20 | Curve | Range too low (max too low): battles solvable in 1–2 actions, no "aha" moment (undermines the core fantasy) | Range too high (min too high): most rolled variations fail the interest check, driving excessive baseline fallback; also stresses that `solutionDepthMin` reflects the solver's *best found* plan, not a proven-optimal one — an overly strict minimum can reject content whose *true* shortest solution the bounded search simply didn't find |
| `narrowness_max` (per tier, via `difficultyConfig`) | tier-scaled, e.g. 0.02–0.10 | 0.0–1.0 | Curve | Near 0: almost every variation gets rejected as "not tight enough," driving excessive baseline fallback and filtering out perfectly reasonable, moderately-forgiving battles | Near 1: lets through battles winnable by nearly any action sequence, undermining the "solve-and-act" tension that is this whole system's reason to exist |
| `spawn_point_pool_min_margin` | 1 | 0–5 | Gate | `0`: every attempt whose composition rolls to its declared maximum count triggers the structural-infeasibility rejection (Edge Cases) as a matter of course, wasting attempts | High values force template authors to declare large spawn-point pools even for small encounters, raising authoring burden with limited benefit past a small margin |
| `countScalePerTier` | 0.5 | 0.0–2.0 | Curve | Enemy counts barely change across tiers — difficulty progression feels flat | Enemy counts spike sharply between adjacent tiers even before per-archetype stat scaling (owned elsewhere) is applied — risks an unreadable board (Pillar #5) purely from unit count |

**Interactions between knobs:**
- `max_generation_attempts` and `solver_max_nodes` trade off the same
  resource (wall-clock generation time) two different ways — raising either
  in isolation increases worst-case latency; they should be tuned together
  against a measured load-time budget (Acceptance Criteria's performance
  section), not independently.
- `solver_horizon_turns` and `target_solution_depth_max` must be kept
  consistent: a `depth_max` that requires more actions than the horizon's
  turn budget plausibly allows (given typical `A_max` actions/hero from
  `turn-and-phase-manager.md`'s Formula F2) can make the interest check
  unsatisfiable by construction — this is a content-design footgun, not a
  system bug, and should be checked at `difficultyConfig` authoring time.
- `narrowness_max` should loosen (increase) somewhat as `target_solution_depth`
  ranges rise for higher tiers — a longer, more complex solution space
  naturally has more distinct winning branches even when the puzzle is
  still hard; holding `narrowness_max` constant across all tiers can
  over-reject high-tier content.

**Intentionally NOT knobs (structural, design-locked invariants):**
- **The solver is constructive-only** (Rule 3) — it is never permitted to
  infer or heuristically declare "probably solvable" without an actual
  found solution. Exposing a "trust heuristic estimate" toggle would break
  the soundness the entire guarantee rests on.
- **The exact PRNG algorithm** (Formula F2) is pinned once via ADR, not a
  per-run or per-difficulty setting — swapping algorithms would change
  which specific variations a given seed produces, silently breaking
  reproducibility/seed-sharing (Rule 14).
- **No parallel simulation implementation** (Rule 2) — the solver must
  always drive the real Turn & Phase Manager / Combat Resolution / Enemy
  code paths headlessly. A "fast approximate simulator" mode is exactly the
  kind of shortcut that could silently diverge from real play and is
  therefore not offered as a configurable option.
- **Constrained variation only** (Rule 5) — there is no knob to let the
  generator invent terrain/enemies outside a template's declared pools;
  that would defeat the entire "authored template" risk-mitigation
  strategy this system exists to provide.

## Visual/Audio Requirements

Encounter Generator has **no direct visual or audio presence** — it runs
entirely before Turn 1, produces data, and hands off to Board & Grid /
Board Rendering & Juice, which own all battle-setup rendering. The one
requirement this system places on downstream presentation is indirect but
important: because a generated battle must be indistinguishable, on sight,
from a hand-authored one (Player Fantasy), no visual treatment should ever
signal "this is procedural" (e.g. a distinct border/tint for
`usedFallbackBaseline = true` battles) — the fallback path is a design
safety net, not a player-facing quality tier, and must render identically to
any other resolved encounter. `solverReport` (diagnostic data) must never be
surfaced in the game UI; it is a QA/telemetry artifact only.

## Acceptance Criteria

Pure, deterministic tests unless noted. "Solver" tests require a real or
lightweight-fake `Board`/`Combat`/`Enemy`/`Turn Manager`/`Heroes` stack
implementing the contracts this document assumes.

**Ownership & entry point (Rule 1, 12)**
- **GIVEN** the system's public interface, **THEN** it exposes exactly
  `generateEncounter(runSeed, nodeId, difficultyConfig, rosterSnapshot) →
  EncounterDefinition` and no method that calls into Difficulty Tiers.

**Determinism & reproducibility (Rule 14)**
- **GIVEN** identical `(runSeed, nodeId, difficultyConfig, rosterSnapshot)`,
  **WHEN** `generateEncounter()` is called twice (including across separate
  process restarts), **THEN** both calls return byte-identical
  `EncounterDefinition` values, including `solverReport`.
- **GIVEN** only `nodeId` differs between two calls (all else identical),
  **WHEN** both are generated, **THEN** the resulting `encounterSeed`
  values (Formula F1) differ and the two `EncounterDefinition`s are not
  required to be identical (decorrelation smoke test).

**Template selection (Rule 6a)**
- **GIVEN** a `difficultyConfig` whose eligible pool contains templates
  A and B, **WHEN** `generateEncounter()` is called twice with the same
  `(runSeed, nodeId)`, **THEN** the same template is selected both times.
- **GIVEN** a `rosterSnapshot` with fewer living heroes than template A's
  `minRosterSize` but enough for template B, **WHEN** selection runs,
  **THEN** template A is excluded from the eligible pool and template B (or
  another eligible template) is selected — never A.

**Constrained variation rolling (Rules 4–6, Formulas F1–F3)**
- **GIVEN** a template with `N` variation slots declared in a fixed order,
  **WHEN** one attempt is rolled, **THEN** exactly `N` PRNG draws occur, in
  the declared slot order, and every resulting value falls within that
  slot's declared range/pool (never outside it).
- **GIVEN** a composition slot's `countRange = [2,4]` and a PRNG draw of
  `0.62`, **WHEN** `rollInt` resolves it, **THEN** the result is exactly
  `3` (Formula F3 worked example, reproduced as a literal test case).
- **GIVEN** a spawn-point pool of size 5 and a composition requiring 3
  tiles, **WHEN** tiles are assigned via `rollWithoutReplacement`, **THEN**
  the 3 assigned tiles are pairwise distinct and all drawn from the
  original pool.

**Structural feasibility (Rule 7, Edge Cases)**
- **GIVEN** a rolled composition requiring more spawn tiles than the
  template's pool contains, **WHEN** the compile step runs, **THEN** it
  fails the structural check before the solver is ever invoked, and this
  attempt is counted against `max_generation_attempts`.

**Triviality guard (Rule 8a)**
- **GIVEN** a compiled candidate whose "pass every turn" baseline strategy
  reaches Victory when simulated, **WHEN** validation runs, **THEN** the
  candidate is rejected immediately, and `nodesExpanded` from the full
  constructive search is `0` (the guard short-circuits before search
  begins).

**Constructive search & soundness (Rules 3, 8b, Formula F5)**
- **GIVEN** a candidate with at least one actual winning action sequence
  reachable within `solver_max_nodes` and `solver_horizon_turns`, **WHEN**
  the solver runs, **THEN** it reports `solutionsFound ≥ 1` and the
  reported `solutionDepthMin`-length action sequence, when replayed through
  the real (non-solver) Turn & Phase Manager / Combat Resolution / Enemy
  stack, actually reaches Victory (round-trip soundness check — the
  solver's "solvable" claim must be independently replayable, not just
  internally self-consistent).
- **GIVEN** a candidate with genuinely zero winning sequences within the
  configured board/turn constraints, **WHEN** the solver exhausts
  `solver_max_nodes`, **THEN** it reports `solutionsFound == 0` and the
  candidate is rejected — verified on a hand-constructed unsolvable fixture
  (e.g. an objective tile fully sealed by Blocked terrain with no
  destructible tiles), independent of the search's heuristics.

**Interest check (Rule 8c, Formula F6)**
- **GIVEN** `nodesExpanded=4000, solutionsFound=12, solutionDepthMin=6`
  against tier range `[4,8]` and `narrowness_max=0.05`, **WHEN** Formula F6
  evaluates, **THEN** `passes == true` (reproduces the worked example
  exactly).
- **GIVEN** the same setup but `solutionsFound=1800`, **WHEN** Formula F6
  evaluates, **THEN** `passes == false` (`narrowness=0.45 > 0.05`).
- **GIVEN** `solutionDepthMin` outside `[depth_min, depth_max]` (either
  direction) with `narrowness` otherwise acceptable, **WHEN** Formula F6
  evaluates, **THEN** `passes == false`.

**Retry loop & baseline fallback (Rules 9–10, 13, Edge Cases)**
- **GIVEN** a template whose every rolled attempt (across
  `max_generation_attempts`) is engineered to fail validation, **WHEN**
  `generateEncounter()` completes, **THEN** it returns exactly the
  template's `authoredBaseline` content, `usedFallbackBaseline == true`,
  and exactly `max_generation_attempts` roll attempts (no more, no fewer)
  were made before falling back.
- **GIVEN** a template catalog containing an entry with
  `baselineVerified == false`, **WHEN** the catalog is loaded, **THEN**
  loading fails/reports an error naming that `templateId`, and the entry is
  never reachable via `generateEncounter()`.

**Zero-slot templates (Edge Cases)**
- **GIVEN** a template with zero declared variation slots, **WHEN**
  `generateEncounter()` is called, **THEN** zero PRNG draws occur and the
  compiled result equals the template's fixed content on every call
  (regardless of `attemptIndex`).

**`maxTurns` ownership (Rule 11)**
- **GIVEN** a finalized `EncounterDefinition`, **THEN** its `objective`
  field includes a resolved `maxTurns` value, and
  `solver_horizon_turns_effective == min(maxTurns, solver_horizon_turns
  knob)` was the value actually used during validation for this candidate.

**Difficulty scaling (Formula F4)**
- **GIVEN** `baseCount=2, tierIndex=3, countScalePerTier=0.5,
  countRange=[2,4]`, **WHEN** F4 resolves, **THEN** `enemyCount == 3`
  (worked example, reproduced literally).
- **GIVEN** the same inputs but `tierIndex=6`, **WHEN** F4 resolves,
  **THEN** `enemyCount == 4` (clamped to `countRange.max`, not `5`).

### Performance Budget (headless TS benchmarks, decoupled from render)

| Operation | Budget | Note |
|-----------|--------|------|
| Single solver node expansion (one simulated action + headless `resolve()` + `evaluate()`) | < 0.5 ms | Dominated by Combat Resolution's already-budgeted effect-chain cost (< 1 ms) plus Turn Manager phase overhead (< 1 ms) |
| One full validation pass (triviality guard + constructive search up to `solver_max_nodes=5000`) | < 2.5 s (worst case, budget exhausted) | This is a load-time cost, not a per-frame cost — paid once per node, between battles |
| One `generateEncounter()` call, worst case (`max_generation_attempts=8` failed rolls + baseline fallback) | < 20 s worst case, target < 3 s typical | Should run during a run-map transition / loading screen, never during active gameplay |
| One `generateEncounter()` call, typical case (accepted on attempt 1–2) | < 5 s | Primary target for player-facing load-time feel |

**Tester checks first:** benchmark the worst-case path (an intentionally
unsolvable/degenerate template that exhausts every attempt and falls back)
to confirm the upper bound is actually bounded, not just typically fast —
this is the path most likely to be skipped in casual testing but is the one
that determines whether load-time ever visibly hitches.

## Open Questions

**Needs an architecture decision (→ ADR during `/create-architecture`):**

1. **Exact PRNG mixing/hash algorithm** for Formula F1 (`mix`) and
   confirmation of mulberry32 (Formula F2) as the chosen stream generator,
   including a pinned reference test-vector table so implementations across
   languages/rewrites stay reproducible. *Owner:* Tech architecture.
2. **Headless Turn & Phase Manager instantiation contract.** Rule 2's "drive
   a headless instance of the manager" needs a concrete API (how a
   simulated Player Phase submits actions programmatically instead of
   reading player input; how simulation state is torn down between search
   branches without leaking into the real game's manager instance).
   *Owner:* Tech architecture, coordinated with Turn & Phase Manager once
   this becomes an implementation task.
3. **Search algorithm specifics** (Rule 8b): this document specifies the
   *contract* (bounded, heuristic-ordered, constructive-only, capped at
   `solver_max_nodes`/`solver_horizon_turns`) but not the exact heuristic
   function (candidates: remaining-threat count, distance-to-objective, a
   weighted combination). *Owner:* systems-designer, once Heroes &
   Abilities' action space exists to prototype against.

**Resolved this session (provisional defaults — confirm during
implementation):**

4. **Template choice is fixed per generation call; only internal variation
   slots are re-rolled on retry** (Rule 6) — chosen over an alternative
   design where a failed template also triggers switching to a different
   template, to keep the retry loop's cost model simple and bounded. If
   playtesting/data shows certain templates fail validation unusually
   often, that is an authoring-quality signal to fix the template, not a
   reason to add cross-template retry.
5. **Triviality guard uses a single fixed baseline strategy ("pass every
   turn")**, not a suite of several naive strategies — chosen for
   simplicity and low computational cost; if this proves too weak a filter
   in practice (e.g. "always retreat" trivially wins some encounters that
   "always pass" doesn't), additional fixed baseline strategies can be
   added to Rule 8a without changing the rest of this document's contract.
6. **`solverReport` is diagnostic-only**, never gameplay-consumed — chosen
   to keep the solver's internal metrics from becoming an accidental
   gameplay dependency (e.g. a future system reading `narrowness` to award
   a "clean solve" score would couple gameplay to an internal search
   artifact that could change independently of any player-visible rule).

**Deferred to the owning system's GDD:**

7. **Encounter Template content itself** (the actual template catalog,
   terrain layouts, enemy compositions) is content, authored via
   `design/balance/` or `assets/data/`, not defined by this document — this
   document defines the *schema* and *system* only.
8. **Resolved.** The solver's legal-move/legal-target/effect-compilation
   contract is `heroes-and-abilities.md`'s own `legalMoveTiles()` /
   `legalTargets()` / `compileEffects()` (Formulas F1–F5 of that document),
   consumed here unmodified — no separate `legalActions()` function exists
   or is needed.
9. **Resolved.** The objective type catalog is `objective-and-win-lose.md`'s
   `Survive` / `Protect` / `Clear` / `Reach` types and their `ObjectiveConfig`
   parameter schema (`{type, max_turns, protectedUnitId?, goalTile?}`); this
   document's `objective` field is that same `{type, params, maxTurns}`
   shape, authored here and evaluated identically in simulation and in play
   via `evaluate(battleState, turn, config)`.
10. **Solution diversity beyond "at least one exists."** The game concept's
    Autonomy goal ("many valid solutions per puzzle") suggests a possible
    future knob — e.g. `min_solution_diversity` requiring several
    *structurally distinct* winning branches, not just several branches
    that happen to differ in minor tile choices — but this adds real
    solver complexity (defining "structurally distinct" is non-trivial) for
    a benefit that should be validated by playtesting first. **Not
    implemented v1** — flagged for revisit once the vertical slice's
    hand-authored templates give a baseline sense of how much solution
    diversity naturally occurs.
11. **Pre-generation vs. lazy generation timing** (whether Run Structure /
    Node Map generates a node's encounter when the run map is first laid
    out, or only when the player actually arrives at that node) affects how
    stale a `rosterSnapshot` can become (Edge Cases' meta-layer
    invalidation case) — this is Run Structure / Node Map's design
    decision, not this document's.
