# Difficulty Tiers

> **Status**: In Design
> **Author**: workflow (design-system fan-out)
> **Last Updated**: 2026-07-27
> **Implements Pillar**: #1 Perfect Information, Perfect Blame; #3 Variety Lives in the Draft, Not the Dice; #5 Read in Ten Seconds (secondary)

## Overview

Difficulty Tiers is the system that turns "harder" into a precise, numbered,
**complexity-driven** configuration rather than a vague slider or a dice roll.
It owns the ordered sequence of difficulty **tiers** (Ascension-style,
numbered `1..max_tier`), the pure formulas that translate a tier number into
a concrete `DifficultyConfig` bundle (target solution-depth band, narrowness
ceiling, enemy-count scaling, an enemy-composition **complexity budget**, and
the eligible Encounter Template pool), and the thin orchestration entry point
that assembles that bundle and calls Encounter Generator's
`generateEncounter()` on a caller's behalf. It is deliberately **not** a
content system: it never invents an enemy, a terrain tile, or a board size —
every tier only ever *selects among* and *bounds* content that Encounter
Generator's templates and Enemy, Abilities & Telegraph's archetype catalog
already declare (mirroring `encounter-generator.md`'s own "constrained
variation, not free generation" rule). This is what makes "escalating
difficulty" mechanically true to the game's founding constraint: **more
enemies, tighter boards, richer telegraph combinations, and tougher enemy
ability sets all come from authored complexity that a tier number unlocks or
scales, never from random chance** (Pillars #1 and #3). The system exists so
that "Tier 7" means something exact and reproducible — the same tier, on the
same node, with the same roster, always assembles the same
`DifficultyConfig` and therefore the same solvability/interest guarantees
Encounter Generator already provides.

## Player Fantasy

Difficulty Tiers has no ability icon and no on-screen presence of its own —
like Board & Grid, Combat Resolution, and Encounter Generator, it is
invisible infrastructure. What the player *feels* is the **Ascension
promise**: "I know exactly what got harder, and I chose to face it." Because
every tier's escalation is complexity (more distinct threats to read, tighter
puzzles, richer enemy kits) rather than inflated numbers or bad luck, a loss
at Tier 8 never feels like "the dice turned against me" — it feels like "I
underestimated how much this tier was asking me to track." This is
Csikszentmihalyi's flow channel applied to a *meta*-level curve: as the
player's skill grows across a campaign, the tier curve raises the ceiling on
puzzle depth and telegraph density just enough to keep pace, the same way
Slay the Spire's Ascension levels let a player who has mastered the base game
self-select into a harder, still-fair version of the same rules. The failure
state of this system is a tier that escalates the *wrong* axis — e.g., a
jump that quietly makes battles less solvable rather than more thoughtfully
complex — which would borrow difficulty from Pillar #1's "perfect blame"
promise instead of paying for it honestly through Pillar #3's complexity.

## Detailed Design

### Core Rules

1. **Ownership boundary.** Difficulty Tiers owns: the numbered tier sequence
   (`1..max_tier`), the pure curve formulas that turn a tier number into a
   `DifficultyConfig` (Formulas F2–F5), the Archetype Unlock Table used only
   for **offline content validation** (Rule 8), the tier-assignment formula
   that maps a run's progress to a tier (Formula F1), and the thin
   orchestration entry point `getEncounterForNode()` (Rule 9). It does
   **not** own: template content, the solver, or the retry/fallback loop
   (all Encounter Generator); enemy archetype definitions, stats, or ability
   kits (Enemy, Abilities & Telegraph); run/node-map structure, node
   ordering, or save persistence (Run Structure / Node Map ✅, Run
   Persistence ✅); or which Ascension offsets a player has unlocked
   (Meta-progression / Unlocks ✅).
2. **A tier is a single integer, `1..max_tier`.** Higher is always harder or
   equal in every one of Formulas F2–F5's outputs — the curves are
   monotonic non-decreasing in escalation direction (narrowness is the one
   curve that moves the opposite numeric direction, *tightening downward*,
   because a *lower* `narrowness_max` is the harder setting — see Formula
   F4). There is no tier `0` and no negative tier.
3. **Two independent inputs compose into one effective tier (Formula F1):**
   a **within-run node ramp** (`nodeIndex`, the battle's ordinal position in
   the current run — supplied by Run Structure / Node Map) and a **player-
   selected Ascension offset** (`ascensionOffset`, chosen once at run start,
   flat-added to every node's tier for the whole run). This mirrors Slay the
   Spire's Ascension model: the run always escalates node-to-node, and the
   player can additionally choose to start further up the curve for a
   harder, more rewarding run — both axes are complexity choices, never
   RNG.
4. **Difficulty scales exactly four axes, each with its own pure curve
   (Formulas F2–F5), and nothing else:** (a) the target **solution-depth
   band** `[depthMin, depthMax]` handed to Encounter Generator's interest
   check — deeper solutions read as "more turns of planning required"; (b)
   the **narrowness ceiling** `narrownessMax` — a lower ceiling means fewer
   of the solver's explored branches are allowed to win, i.e. a tighter,
   less-forgiving puzzle; (c) `countScalePerTier`, a single scalar passed
   straight through to Encounter Generator's own Formula F4 (enemy-count
   scaling) — Difficulty Tiers does not re-derive enemy counts itself, it
   only supplies the scalar Encounter Generator's already-defined formula
   consumes; (d) the **archetype composition complexity ceiling**
   `complexityBudget(T)` (Formula F2) — an offline, content-authoring-time
   bound (Rule 8), not a runtime `generateEncounter()` input.
5. **"More enemies" and "richer telegraph combinations" are the same
   mechanism, tier-scaled by (c) above** — Encounter Generator's own count-
   scaling formula already produces more simultaneous telegraphed threats
   as `tierIndex` rises; Difficulty Tiers' only job is to supply a
   consistent `countScalePerTier` and pass the resolved tier number through
   as `tierIndex`.
6. **"Tighter boards" is achieved entirely through template content and
   tier eligibility tagging — never a Difficulty Tiers formula.** A template
   author who wants a tier-6+ battle to feel cramped authors a template with
   a smaller `boardSizeOverride` (per `board-and-grid.md`'s `grid_width`/
   `grid_height` knobs, safe range 5–12) and tags its `eligibleTiers` to
   start at 6. Difficulty Tiers' `templatePool(T)` (Formula F5) filters the
   catalog by exactly that authored tag — it never inspects or biases on
   board size directly. This keeps "tighter boards" inside Encounter
   Generator's "constrained variation only" ownership boundary (Rule 5 of
   `encounter-generator.md`) rather than duplicating it here.
7. **"Tougher enemy ability sets" is gated by tier through the Archetype
   Unlock Table, enforced offline, never at runtime.** Every enemy
   archetype in Enemy, Abilities & Telegraph's catalog is assigned exactly
   one `unlockTier` (the lowest tier at which it may appear) and one
   `complexityRating` (an integer telegraph-load cost, Rule 8) in the
   `ArchetypeUnlockEntry` table (Data Contracts) — a **separate table this
   system owns and is the sole authority over**, keyed by `archetypeId` and
   referencing Enemy's catalog read-only; Enemy's own archetype schema is
   not modified by this system. `enemy-abilities-and-telegraph.md` Rule 2
   lists `maxHP`, `moveRange`, Abilities, `onDeath`, and target policy only,
   with no `unlockTier`/`complexityRating` fields today, which is exactly
   why this document keeps that data in its own table rather than assuming
   fields that don't exist upstream. Whether a *future* revision folds these
   fields into Enemy's schema instead is an open architecture-level question
   (Open Questions #1) — not a contradiction in this document's current,
   settled design, which owns the separate table outright.
8. **Offline complexity validation (the content-authoring gate).** At
   catalog-load time — after both the Encounter Template catalog and the
   Enemy archetype catalog are loaded, and *before* the game ever calls
   `getEncounterForNode()` — a validator checks, for every template and
   every tier in that template's `eligibleTiers`: the template's
   **worst-case composition complexity** (every composition slot rolled to
   its declared `countRange.max`, using the highest-`complexityRating`
   archetype in that slot's `archetypePool`) must not exceed
   `complexityBudget(tier)` (Formula F2). A template that fails this check
   for any tier it claims eligibility for is a content-authoring error,
   rejected at load — identical in spirit to Encounter Generator's own
   `baselineVerified` catalog-load gate (`encounter-generator.md` Rule 13).
   This check runs **once**, offline; it is never re-evaluated per
   `generateEncounter()` call, and `complexityBudget` is never passed into
   `DifficultyConfig` as a runtime field.
9. **Single entry point.** Difficulty Tiers exposes exactly
   `getEncounterForNode(runSeed, nodeId, nodeIndex, ascensionOffset,
   rosterSnapshot) → { tier: int, encounter: EncounterDefinition }`. Inside,
   it: (a) resolves `tier` via Formula F1; (b) assembles `DifficultyConfig`
   via Formulas F2–F5 (excluding the offline-only complexity budget); (c)
   calls Encounter Generator's `generateEncounter(runSeed, nodeId,
   difficultyConfig, rosterSnapshot)` unmodified; (d) returns the resolved
   `tier` alongside the resulting `EncounterDefinition`, so the caller (Run
   Structure / Node Map) can display the tier without recomputing Formula
   F1 itself. This is the same interface-inversion pattern
   `encounter-generator.md` Rule 12 already names Difficulty Tiers as the
   legitimate caller for — Encounter Generator is never permitted to call
   *into* Difficulty Tiers.
10. **Reproducibility.** Given identical `(nodeIndex, ascensionOffset)`, `tier`
    (Formula F1) and the assembled `DifficultyConfig` (Formulas F2–F5) are
    always byte-identical — no wall-clock time, no non-seeded randomness. Any
    additional randomness inside the resulting `generateEncounter()` call is
    entirely Encounter Generator's own seeded, deterministic responsibility
    (`runSeed`/`nodeId`), untouched by this system.
11. **No tier ever weakens Encounter Generator's solvability guarantee.**
    Every `DifficultyConfig` this system produces is just a set of
    parameters Encounter Generator's existing, unmodified solver/retry/
    fallback pipeline consumes exactly as documented in
    `encounter-generator.md`. A higher tier can make the *target* puzzle
    harder to find (tighter `narrownessMax`, deeper `depthMin`), but it can
    never cause an unsolvable battle to ship — that promise is entirely
    Encounter Generator's (Rule 3 of that document), inherited unchanged.

### Data Contracts

```
DifficultyConfig {                      // consumed by Encounter Generator's generateEncounter()
  tierIndex: int                        // resolved tier, Formula F1
  templatePool: TemplateId[]            // Formula F5 — candidate templates for this tier
  depthRange: { min: int, max: int }    // Formula F3 — Encounter Generator's depth_min/depth_max
  narrownessMax: float                  // Formula F4 — Encounter Generator's narrowness_max
  countScalePerTier: float              // passthrough scalar — Encounter Generator's own Formula F4 input
}

ArchetypeUnlockEntry {                  // Difficulty Tiers' own table; archetypeId refs Enemy's catalog
  archetypeId: ArchetypeId
  unlockTier: int                       // >=1; archetype excluded from validation below this tier
  complexityRating: int                 // 1 (trivial) .. 5 (highest telegraph load), used only offline (Rule 8)
}
```

`ArchetypeUnlockEntry` is **not** part of `DifficultyConfig` and is never
read by Encounter Generator at runtime — it exists solely to drive the
offline validator in Rule 8. `DifficultyConfig` itself contains no
complexity-budget field; the ceiling it represents is fully enforced before
any template becomes selectable.

### States and Transitions

Difficulty Tiers holds **no persistent mutable state of its own** — `tier`
and `DifficultyConfig` are both pure functions of their inputs (Rule 10).
The only meaningful "state" is conceptual, tracked by the caller (Run
Structure / Node Map ✅) across a run:

`RunNotStarted → AscensionSelected(ascensionOffset) → InProgress(nodeIndex) → RunComplete`

| Transition | Trigger | Owned by |
|------------|---------|----------|
| `RunNotStarted → AscensionSelected` | Player picks a starting Ascension offset (gated by unlocks) | Meta-progression / Unlocks ✅ selects the value (via its `getUnlockedAscensionOffset()`); Difficulty Tiers only clamps it (Edge Cases) |
| `AscensionSelected → InProgress` | Run begins; `nodeIndex = 0` | Run Structure / Node Map |
| `InProgress(n) → InProgress(n+1)` | Player clears a node and advances | Run Structure / Node Map — `ascensionOffset` never changes mid-run |
| `InProgress → RunComplete` | Run ends (victory, abandon, or permadeath) | Run Structure / Node Map |

At every `InProgress(n)` state, calling `getEncounterForNode()` with the
current `(nodeIndex=n, ascensionOffset)` is idempotent and side-effect-free
— re-calling it (e.g. to redisplay a preview) never changes `tier` or
consumes anything.

### Interactions with Other Systems

Difficulty Tiers is a **thin orchestrator + pure config assembler**: it
reads two upstream catalogs (templates, archetypes) to build config and
filter tables, and it drives Encounter Generator's existing entry point
exactly once per node.

| System | Difficulty Tiers reads/calls | Difficulty Tiers provides | Ownership boundary |
|--------|-------------------------------|-----------------------------|---------------------|
| **Encounter Generator** ✅ | Template catalog's `eligibleTiers` tags (Formula F5); calls `generateEncounter(runSeed, nodeId, difficultyConfig, rosterSnapshot)` | `DifficultyConfig` (Rule 9) | Difficulty Tiers assembles *parameters*; Encounter Generator owns generation, solving, and the fallback guarantee entirely unchanged |
| **Enemy, Abilities & Telegraph** ✅ | Enemy archetype catalog's archetype IDs; `unlockTier`/`complexityRating` fields (Rule 7) for the offline validator (Rule 8), held in Difficulty Tiers' own `ArchetypeUnlockEntry` table since Enemy's schema does not define them | — (read-only) | Enemy owns archetype definitions; Difficulty Tiers owns the tier-gating/complexity metadata layered on top outright (Rule 7) |
| **Run Structure / Node Map** ✅ | — | exposes `getEncounterForNode(runSeed, nodeId, nodeIndex, ascensionOffset, rosterSnapshot) → { tier, encounter }`, called once per battle node (per `cross-system-contracts.md` C1 — Difficulty Tiers is the sole caller of Encounter Generator, never called *by* it) | Difficulty Tiers has no concept of a run or a map; it resolves one node's tier + encounter per call. Run Structure calls this system as its sole hand-off into difficulty/encounter generation (`run-structure-node-map.md` Rule 13) and never assembles `DifficultyConfig` or calls `generateEncounter()` itself — fully reconciled to C1 (see Dependencies bidirectional-consistency note) |
| **Meta-progression / Unlocks** ✅ | reads `ascension_max_offset` (Tuning Knobs) as the ceiling on what can ever be unlocked | exposes `getUnlockedAscensionOffset()`, read by Run Structure / Node Map to supply this system's `ascensionOffset` parameter at run start (confirmed on that document's own Downstream table) | Difficulty Tiers defines the ceiling; Meta-progression decides how much of it a given player has unlocked |
| **Battle HUD** ✅ / **Map/Run UI** ✅ | — | exposes the resolved `tier` integer (returned alongside `EncounterDefinition`, Rule 9) for display | Read-only consumer — Difficulty Tiers computes the number, HUD/Map UI decides how to show it. **Gap:** neither `battle-hud.md` nor `map-run-ui.md` currently references Difficulty Tiers or a `tier` display field — flagged for their next revision |
| **Run Persistence** ✅ | — | `nodeIndex`/`ascensionOffset` are the only inputs a save needs to persist to exactly reproduce a run's tier progression (Rule 10) | Difficulty Tiers itself persists nothing. **Gap:** `run-persistence.md` does not yet name Difficulty Tiers or this reproducibility contract — flagged for its next revision |

**Bidirectional-consistency note:** `encounter-generator.md` already names
Difficulty Tiers as a Hard downstream dependent ("Calls
`generateEncounter(...)`, supplying `difficultyConfig` as a parameter —
never called *by* this system") and lists `systems-index.md`'s declared
direction (Difficulty Tiers depends on Encounter Generator) as the reason
its own Rule 12 interface-inversion exists — fully consistent with the
Upstream row above. `enemy-abilities-and-telegraph.md` does **not** yet list
Difficulty Tiers as a dependent, and does **not** define
`unlockTier`/`complexityRating` on its archetype schema — this is expected
and by design (Rule 7): this document owns `ArchetypeUnlockEntry` as a
separate table precisely because Enemy's schema has no such fields, so no
change to `enemy-abilities-and-telegraph.md` is required for this system to
function. Whether a future revision instead folds these fields into Enemy's
own schema is a physical-ownership alternative to evaluate via
`/consistency-check` or during `/create-architecture` (Open Questions #1),
not an unresolved contradiction in the current design.

## Formulas

All formulas are deterministic (no RNG, no time-dependence). Examples use
the default tier ceiling **`max_tier = 10`** and the default knob values
from Tuning Knobs below.

### F1. Tier assignment

`tier(nodeIndex, ascensionOffset) = clamp(1 + floor(nodeIndex / nodes_per_tier_step) + ascensionOffset, 1, max_tier)`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| node index | `nodeIndex` | int | `≥0` | This battle's 0-based ordinal position in the current run |
| ascension offset | `ascensionOffset` | int | `[0, ascension_max_offset]` | Player-selected flat bonus, fixed for the whole run |
| step size | `nodes_per_tier_step` | int | Tuning Knobs, `1–6` | Nodes between automatic +1 tier increments |
| tier ceiling | `max_tier` | int | Tuning Knobs, `5–20` | Highest tier the curve can ever produce |

**Output range:** int `[1, max_tier]`. **Worked example:**
`nodeIndex=7, ascensionOffset=2, nodes_per_tier_step=3, max_tier=10` →
`floor(7/3)=2` → `1+2+2=5` → **tier 5**. **Worked example (clamp):**
`nodeIndex=30, ascensionOffset=5` → `1+10+5=16` → clamp to `max_tier=10` →
**tier 10** (endgame plateau, Edge Cases).

### F2. Composition complexity budget (offline validation only)

`complexityBudget(T) = clamp(baseBudget + floor((T−1) × budgetScalePerTier), budgetRange.min, budgetRange.max)`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| tier | `T` | int | `[1, max_tier]` | The tier being evaluated |
| base budget | `baseBudget` | int | Tuning Knobs | Ceiling at tier 1 |
| scale per tier | `budgetScalePerTier` | float | Tuning Knobs, `0–3` | Ceiling growth per tier step |
| budget range | `budgetRange` | `[min,max]` | Tuning Knobs | Hard clamp bounds |

**Output range:** int `[budgetRange.min, budgetRange.max]`. **Worked
example:** `baseBudget=4, budgetScalePerTier=1.5, budgetRange=[4,20]` →
`T=1: 4+floor(0)=4`; `T=5: 4+floor(4×1.5)=4+6=10`; `T=10:
4+floor(9×1.5)=4+13=17`. **Consumed by Rule 8's offline validator only —
never appears in the runtime `DifficultyConfig`.**

### F3. Solution-depth target band

`depthMin(T) = baseDepthMin + floor((T−1) × depthMinScalePerTier)`
`depthMax(T) = depthMin(T) + baseBandWidth + floor((T−1) × bandWidthScalePerTier)`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| tier | `T` | int | `[1, max_tier]` | The tier being evaluated |
| base min depth | `baseDepthMin` | int | Tuning Knobs | `depthMin` at tier 1 |
| min-depth scale | `depthMinScalePerTier` | float | Tuning Knobs, `0–3` | How fast the floor rises per tier |
| base band width | `baseBandWidth` | int | Tuning Knobs | `depthMax − depthMin` at tier 1 |
| band-width scale | `bandWidthScalePerTier` | float | Tuning Knobs, `0–2` | How fast the band widens per tier |

**Output range:** `depthMin ∈ [baseDepthMin, ∞)` in practice bounded by
`max_tier`; `depthMax > depthMin` always (band width is `≥ baseBandWidth ≥
1`, enforced in Tuning Knobs). **Worked example** (matches
`encounter-generator.md`'s own cited example, confirming consistency):
`baseDepthMin=2, depthMinScalePerTier=1.0, baseBandWidth=3,
bandWidthScalePerTier=0.75` → `T=1: depthMin=2, band=3+0=3 → depthMax=5` →
**`[2,5]`**; `T=5: depthMin=2+4=6, band=3+floor(4×0.75)=3+3=6 → depthMax=12`
→ **`[6,12]`**.

### F4. Narrowness ceiling

`narrownessMax(T) = clamp(baseNarrowness − (T−1) × narrownessTighteningPerTier, narrownessFloor, narrownessCeiling)`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| tier | `T` | int | `[1, max_tier]` | The tier being evaluated |
| base narrowness | `baseNarrowness` | float | Tuning Knobs, `0–1` | Ceiling at tier 1 (most forgiving) |
| tightening per tier | `narrownessTighteningPerTier` | float | Tuning Knobs, `0–0.05` | How much the ceiling drops per tier |
| floor | `narrownessFloor` | float | Tuning Knobs, `0–1` | Hardest-allowed ceiling (never drops below this) |
| ceiling clamp | `narrownessCeiling` | float | Tuning Knobs, `0–1` | Softest-allowed ceiling (usually `= baseNarrowness`) |

**Output range:** float `[narrownessFloor, narrownessCeiling]`, always
`≤ 1.0` per Encounter Generator's own `narrowness_max` domain. **Note:**
this curve moves in the *opposite* numeric direction from F2/F3 — a lower
output is the harder setting (Rule 2). **Worked example:**
`baseNarrowness=0.10, narrownessTighteningPerTier=0.01, floor=0.02,
ceiling=0.10` → `T=1: 0.10−0=0.10`; `T=9: 0.10−8×0.01=0.02` (hits the floor
exactly); `T=10: 0.10−9×0.01=0.01` → clamp to `0.02`.

### F5. Eligible template pool

`templatePool(T) = { template ∈ catalog : T ∈ template.eligibleTiers }`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| tier | `T` | int | `[1, max_tier]` | The tier being evaluated |
| catalog | `catalog` | set of `EncounterTemplate` | template-authored | Encounter Generator's full loaded template catalog |
| eligible tiers | `template.eligibleTiers` | int[] | template-authored | Per `encounter-generator.md`'s own `EncounterTemplate` schema |

**Output:** a non-empty set of `TemplateId`s (non-emptiness for every tier
`1..max_tier` is a catalog-load-time invariant, Rule 8/Edge Cases — never a
runtime possibility if content passed validation). **Worked example:** a
catalog of 15 templates where 6 declare `T=5` in their `eligibleTiers` →
`templatePool(5)` contains exactly those 6 `TemplateId`s, passed verbatim
into `DifficultyConfig.templatePool` for Encounter Generator's Rule 6a
selection step to draw from.

### F6. Archetype eligibility check (offline validation only)

`archetypeEligible(archetypeId, T) = (unlockTier[archetypeId] ≤ T)`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| archetype id | `archetypeId` | ArchetypeId | Enemy's catalog | The archetype being checked |
| tier | `T` | int | `[1, max_tier]` | The tier being evaluated |
| unlock table | `unlockTier[·]` | Map | Rule 7's `ArchetypeUnlockEntry` table | Per-archetype minimum eligible tier |

**Output:** bool. Used exclusively inside Rule 8's offline validator to
compute a template's worst-case composition complexity (only archetypes
eligible at the tier under test are considered reachable at that tier — an
archetype pool entry that is never eligible at any tier the template claims
is itself a separate content-authoring warning, Edge Cases). **Worked
example:** `unlockTier[Broodmother]=6` → `archetypeEligible(Broodmother, 5)
= false`, `archetypeEligible(Broodmother, 6) = true`.

## Edge Cases

- **`nodeIndex` is negative:** rejected (assert) — a programmer/caller error,
  never a legal input; Run Structure / Node Map must never construct a
  negative node index.
- **`ascensionOffset` is negative:** rejected (assert) — Difficulty Tiers
  v1 has no concept of a "reduced difficulty" negative offset; if that
  becomes a future accessibility feature, it is a new signed-offset design,
  not a silent extension of this formula.
- **`ascensionOffset` exceeds `ascension_max_offset`** (e.g. a stale save
  references an offset above the current build's cap, after a balance
  patch lowered it): **clamped** to `ascension_max_offset`, not rejected —
  a resumed run must always remain playable rather than error out.
- **Formula F1's result would exceed `max_tier`** (large `nodeIndex` and/or
  `ascensionOffset`): clamped to `max_tier` exactly (Formula F1's own
  `clamp`); the remainder of the run continues at the ceiling tier — a
  deliberate "endgame plateau," not an error condition.
- **`templatePool(T)` is empty for some tier `T` in `[1, max_tier]`:** this
  must never occur at runtime — it is caught as a **catalog-load-time
  invariant failure** ("every tier `1..max_tier` must have at least one
  eligible template"), reported naming the offending tier, before
  `getEncounterForNode()` is ever reachable. If it somehow occurs at
  runtime despite this (a corrupted or hot-reloaded catalog), the call
  fails loudly with an unrecoverable content-configuration error — mirrors
  `encounter-generator.md`'s own handling of an emptied eligible-template
  pool.
- **A template's worst-case composition complexity exceeds
  `complexityBudget(T)` for a tier `T` it declares in `eligibleTiers`
  (Rule 8):** rejected at **catalog load**, naming the offending
  `templateId` and `T` — a content-authoring error, never a per-call
  runtime path (identical treatment to Encounter Generator's own
  `baselineVerified` gate).
- **An archetype referenced in a template's `archetypePool` has no entry in
  the `ArchetypeUnlockEntry` table:** treated as `unlockTier = ∞` (never
  eligible at any tier) and therefore contributes an undefined
  `complexityRating` to Rule 8's validator — this always fails the
  validator for every tier the template declares, surfacing as a
  catalog-load error naming the missing `archetypeId`. A missing table
  entry is a content bug, never silently defaulted to "always eligible."
- **A template's `archetypePool` for some composition slot contains only
  archetypes whose `unlockTier` is above every tier in the template's own
  `eligibleTiers`:** the slot can never legally resolve any of its options
  at any tier the template claims — flagged as a separate catalog-load
  warning (not necessarily a hard rejection, since Encounter Generator's
  own `rollChoice`/`rollWithoutReplacement` (Formula F3 of
  `encounter-generator.md`) has no awareness of `unlockTier` and would
  happily roll an "unlocked-too-late" archetype) — **PROVISIONAL:**
  whether this becomes a hard catalog-load rejection or an advisory-only
  warning is deferred to `/consistency-check`, since enforcing it strictly
  would require Encounter Generator's own roll step to consult this
  system's unlock table, which is not currently part of that document's
  contract (Open Questions).
- **Two different tiers produce numerically identical `depthRange` and/or
  `narrownessMax`** (both curves saturated at their clamp bounds): legal —
  the curves are allowed to plateau; `templatePool(T)` still very likely
  differs between the two tiers (different `eligibleTiers` tags), so
  content variety is preserved even when the numeric bands flatten.
- **`nodes_per_tier_step` is changed by a balance patch after a save file
  already recorded `nodeIndex`/`ascensionOffset`:** tier is always
  recomputed live from the *current* knob value and the *stored*
  `nodeIndex`/`ascensionOffset` (neither `tier` nor `DifficultyConfig` is
  itself persisted) — a balance change retroactively reshapes tier
  assignment for any resumed run. This is the intended "config, not
  hardcoded content" behavior, not a bug, but is flagged for Run
  Persistence's ✅ own save-compatibility policy — `run-persistence.md` does
  not yet address this specific retroactive-recompute scenario, so the
  cross-reference remains open pending that document's next revision.
- **`getEncounterForNode()` is called twice with identical inputs** (e.g. a
  UI re-render, or a player backing out of a node-preview and re-entering
  it before committing): both calls resolve the identical `tier` and
  `DifficultyConfig` (Rule 10); whether the *second* call re-invokes
  Encounter Generator's own `generateEncounter()` (and therefore consumes a
  second, independent — but per that document's Rule 14, byte-identical —
  generation pass) or returns a cached result is **PROVISIONAL**, deferred
  to Run Structure / Node Map's own caching policy; this document only
  guarantees that *if* both calls do reach Encounter Generator, the results
  are identical.

## Dependencies

**Upstream (Difficulty Tiers depends on):**

| System | Interface | Hard / Soft |
|--------|-----------|--------------|
| **Encounter Generator** ✅ | Template catalog's `eligibleTiers` (Formula F5); `generateEncounter(runSeed, nodeId, difficultyConfig, rosterSnapshot)` entry point | **Hard** |
| **Enemy, Abilities & Telegraph** ✅ | Archetype catalog's archetype IDs (read-only); `unlockTier`/`complexityRating` fields for offline validation (Rule 7–8), held in Difficulty Tiers' own `ArchetypeUnlockEntry` table | **Hard** |

**Downstream (systems that depend on Difficulty Tiers):**

| Dependent System | Interface (what it uses) | Hard / Soft |
|-------------------|---------------------------|--------------|
| **Run Structure / Node Map** ✅ | Calls `getEncounterForNode(runSeed, nodeId, nodeIndex, ascensionOffset, rosterSnapshot) → { tier, encounter }` once per battle node (per `cross-system-contracts.md` C1) | **Hard** |
| **Meta-progression / Unlocks** ✅ | Reads `ascension_max_offset` as the ceiling on what can ever be unlocked; exposes `getUnlockedAscensionOffset()`, supplying the player's currently-unlocked `ascensionOffset` at run start | **Hard** (for that system) |
| **Battle HUD** ✅ / **Map/Run UI** ✅ | Reads the resolved `tier` integer (returned alongside the encounter) for display | **Soft** |
| **Run Persistence** ✅ | Only needs to persist `nodeIndex`/`ascensionOffset` to exactly reproduce a run's tier progression (Rule 10, Edge Cases) | **Soft** |

**Bidirectional-consistency note:** `encounter-generator.md` already lists
Difficulty Tiers as a Hard downstream dependent whose interface matches the
Upstream row above exactly (it explicitly names this system, alongside Run
Structure / Node Map, as the only legitimate caller of `generateEncounter`),
and its own Downstream table now states the call chain explicitly as **Run
Structure → Difficulty Tiers → Encounter Generator** (C1), matching this
document's Rule 9. `systems-index.md` lists Difficulty Tiers as depending on
exactly Encounter Generator and Enemy, Abilities & Telegraph — consistent
with the Upstream table above and with no other upstream dependency
introduced.

Run Structure / Node Map, Meta-progression / Unlocks, and Run Persistence are
all now Designed (✅). Of the three:
- **Meta-progression / Unlocks** is fully reconciled — its own Downstream
  table already names Difficulty Tiers (Hard) and exposes
  `getUnlockedAscensionOffset()` matching the interface above.
- **Run Persistence** does not yet name Difficulty Tiers anywhere in its
  document; the Soft interface above (persisting `nodeIndex`/
  `ascensionOffset`) is this document's proposed contract, unconfirmed from
  that side — flagged for `/consistency-check`.
- **Run Structure / Node Map** is fully reconciled to C1: its own Rule 13
  now has Run Structure call Difficulty Tiers' `getEncounterForNode(runSeed,
  nodeId, nodeIndex, ascensionOffset, rosterSnapshot)` as its sole hand-off
  into difficulty/encounter generation, never assembling `DifficultyConfig`
  or calling `generateEncounter()` itself, and its own Dependencies table
  lists Difficulty Tiers as a Hard upstream dependency with Encounter
  Generator demoted to an indirect/Soft reference — matching this document's
  Rule 9 and the C1 ownership stated above exactly. No further reconciliation
  is needed on this pairing.

`enemy-abilities-and-telegraph.md` does not yet list Difficulty Tiers as a
dependent and does not define `unlockTier`/`complexityRating` on its own
archetype schema — this is expected under Rule 7's current design (this
document owns `ArchetypeUnlockEntry` as a standalone table precisely because
those fields don't exist upstream), not an outstanding contradiction. The
only open item is the forward-looking architecture question of whether a
future revision folds these fields into Enemy's schema instead (Open
Questions #1), which remains a legitimate `/consistency-check` /
`/create-architecture` discussion, not a blocking gap in this document.

## Tuning Knobs

| Knob | Default | Safe Range | Category | Too Low | Too High |
|------|---------|-----------|----------|---------|----------|
| `max_tier` | 10 | 5–20 | Gate | Ascension replay value collapses fast — experienced players exhaust the whole curve in one or two runs, undermining the Achiever "climb the tiers" hook (game-concept Player Motivation Profile) | Curve formulas (F2–F4) must stretch further to stay meaningfully differentiated near the ceiling; past ~20, per-tier steps risk becoming imperceptible unless `budgetScalePerTier`/`depthMinScalePerTier` are also raised, which then risks over-tuning early tiers too |
| `nodes_per_tier_step` | 3 | 1–6 | Gate | `1`: tier increments every single node — the ramp outpaces a single run's ~15–20 nodes, hitting `max_tier` almost immediately and flattening the back half of every run | High values (`6+`) mean a full run barely moves off tier 1–3, making Ascension offset the only source of real challenge and wasting the within-run escalation curve entirely |
| `ascension_max_offset` | 5 | 0–10 | Gate | `0` removes the Ascension-style meta-progression hook entirely (game-concept "self-set challenges" retention hook) | High values let a fully-unlocked player start a run already at/near `max_tier`, compressing the within-run ramp into irrelevance — should be tuned jointly with `max_tier` |
| `baseBudget` / `budgetScalePerTier` / `budgetRange` (Formula F2) | 4 / 1.5 / `[4,20]` | budget 1–30, scale 0–3 | Curve | Too low a ceiling at high tiers starves template authors of room to build the "richer telegraph combinations" this system exists to enable, forcing every high-tier template toward the same handful of low-complexity archetypes | Too high risks a high-tier battle exceeding what a player can read in ten seconds (Pillar #5) even though it is fully solvable and correctly telegraphed — complexity and legibility are in tension by design (mirrors `game-concept.md`'s Pillar 4 vs Pillar 5 tension) |
| `baseDepthMin` / `depthMinScalePerTier` / `baseBandWidth` / `bandWidthScalePerTier` (Formula F3) | 2 / 1.0 / 3 / 0.75 | min 1–6, scale 0–3, band 1–10, scale 0–2 | Curve | A `depthMin` that grows too slowly makes late-tier battles solvable almost as fast as early ones — the "aha" moment never deepens, undermining the core fantasy's "cunning commander" promise | A `depthMin` that grows too fast can make the interest check (Encounter Generator Formula F6) unsatisfiable by construction if it outpaces `solver_horizon_turns` (a cross-system footgun `encounter-generator.md`'s own Tuning Knobs section already flags — check jointly at `difficultyConfig`-authoring time) |
| `baseNarrowness` / `narrownessTighteningPerTier` / `narrownessFloor` / `narrownessCeiling` (Formula F4) | 0.10 / 0.01 / 0.02 / 0.10 | narrowness 0–1, tightening 0–0.05 | Curve | A floor too close to `baseNarrowness` means late tiers barely tighten — the puzzle never gets meaningfully less forgiving | A floor too close to `0` risks over-rejecting valid content during generation (excessive baseline fallback, per `encounter-generator.md`'s own `narrowness_max` Too-Low warning) — this system's floor and Encounter Generator's fallback-frequency telemetry should be tuned together |
| `countScalePerTier` | 0.5 | 0.0–2.0 | Curve | Enemy counts barely change across tiers — passed straight through to Encounter Generator's own Formula F4, whose Too-Low/Too-High guidance applies identically here | Same as above — Encounter Generator's own knob table already documents both extremes for this exact value; Difficulty Tiers only chooses the single default it supplies |

**Interactions between knobs:**
- `max_tier` and `ascension_max_offset` must be tuned together — Formula
  F1 clamps their sum at `max_tier`, so raising `ascension_max_offset`
  without also reconsidering `max_tier` shrinks the within-run node ramp's
  effective range for high-Ascension players (Edge Cases' "endgame
  plateau").
- `nodes_per_tier_step` and `max_tier` jointly determine how much of the
  curve a single run actually traverses; a design goal like "a full clear
  should reach roughly tier 7 of 10" should be solved as
  `max_tier ≈ (expected_run_node_count / nodes_per_tier_step) +
  ascension_max_offset_typical`, not tuned independently.
- `baseBudget`/`budgetScalePerTier` (F2) and Enemy, Abilities &
  Telegraph's per-archetype `complexityRating` values are two halves of one
  system — raising the budget curve without also authoring higher-
  `complexityRating` archetypes at higher `unlockTier`s produces no
  observable difficulty change; this is a content-pairing concern, not a
  formula bug.
- `depthMinScalePerTier`/`bandWidthScalePerTier` (F3) and Encounter
  Generator's `solver_horizon_turns` knob must be checked jointly per the
  Too-High note above — this document inherits, not duplicates, that
  cross-system footgun warning.

**Intentionally NOT knobs (structural, design-locked invariants):**
- **Difficulty is never RNG-sourced.** There is no "difficulty variance"
  or "random enemy buff" knob anywhere in this system — every escalation
  axis is a pure function of `tier`. Exposing any stochastic modifier here
  would directly contradict Pillar #3 and the founding brief ("Difficulty
  from COMPLEXITY, never RNG").
- **`complexityBudget` never becomes a runtime `DifficultyConfig` field.**
  It is fixed as an offline-only validation gate (Rule 8) so that raising
  or lowering it can never silently change what a *live* `generateEncounter()`
  call is allowed to select — only what content is allowed into the
  catalog in the first place. Making it runtime-visible would give
  Encounter Generator a second, redundant eligibility filter beyond
  `templatePool`, risking the two silently disagreeing.
- **Ascension offset is fixed for the whole run once selected** (Rule 3) —
  no mid-run knob to raise or lower it exists; changing this would make
  tier assignment path-dependent on player choices mid-run rather than a
  pure function of `(nodeIndex, ascensionOffset)`, breaking Rule 10's
  reproducibility guarantee.

## Visual/Audio Requirements

Difficulty Tiers has **no direct visual or audio presence** — like Encounter
Generator, it runs before a node is entered, produces a `tier` integer and a
`DifficultyConfig`, and hands off to Encounter Generator / Board Rendering &
Juice / Battle HUD for all actual presentation. Its one requirement on
downstream presentation is legibility-driven (Pillar #5 and Pillar #1's
"perfect information" extending to the *meta* layer):

- **The resolved `tier` for the node the player is about to enter must be
  visible before the player commits to that node** (e.g. on the Map UI's
  node preview), never revealed only after the battle begins — an
  unannounced difficulty spike would be exactly the kind of "surprise"
  Pillar #1 forbids at the battle level, extended to the run-structure
  level.
- **No visual distinction should imply randomness.** Because escalation is
  entirely complexity-driven, tier presentation (a number, a named rank, an
  icon) must never use presentation language that suggests luck (e.g. no
  "risk" iconography borrowed from gambling UI) — this is a content/UX
  concern for whichever system renders the tier number, not a rule this
  system enforces mechanically, but it is a design intent worth recording
  here since this document is that number's source of truth.
- **`ArchetypeUnlockEntry.complexityRating` and `complexityBudget` are
  diagnostic/authoring data only** — like Encounter Generator's
  `solverReport`, neither should ever be surfaced in player-facing UI.

## Acceptance Criteria

Pure, deterministic unit tests unless noted — no wall-clock time, no RNG,
no rendering. Default `max_tier=10` and default knob values (Tuning Knobs)
unless stated.

**Tier assignment (Rule 2–3, Formula F1)**
- **GIVEN** `nodeIndex=7, ascensionOffset=2, nodes_per_tier_step=3`, **WHEN**
  `tier()` is computed, **THEN** the result is exactly `5` (worked example,
  reproduced literally).
- **GIVEN** `nodeIndex=30, ascensionOffset=5, max_tier=10`, **WHEN**
  `tier()` is computed, **THEN** the result is exactly `10` (clamp, not
  `16`).
- **GIVEN** `nodeIndex=0, ascensionOffset=0`, **WHEN** `tier()` is
  computed, **THEN** the result is exactly `1` (run start floor).
- **GIVEN** a negative `nodeIndex` or `ascensionOffset`, **WHEN**
  `getEncounterForNode()` is called, **THEN** it is rejected before any
  formula evaluates.

**Config assembly determinism (Rule 10)**
- **GIVEN** identical `(nodeIndex, ascensionOffset)`, **WHEN**
  `getEncounterForNode()`'s config-assembly step runs twice (including
  across process restarts), **THEN** the resulting `tier` and
  `DifficultyConfig` are byte-identical both times.
- **GIVEN** only `nodeIndex` differs (all else identical), **WHEN** both
  are assembled, **THEN** `tier` and/or `DifficultyConfig.templatePool` may
  differ (no false-equality assumption).

**Curve formulas (F2–F4)**
- **GIVEN** the default F2 knobs, **WHEN** evaluated at `T=1, T=5, T=10`,
  **THEN** the results are exactly `4, 10, 17` (worked examples, reproduced
  literally).
- **GIVEN** the default F3 knobs, **WHEN** evaluated at `T=1` and `T=5`,
  **THEN** the results are exactly `[2,5]` and `[6,12]` (worked examples,
  matching `encounter-generator.md`'s own cited tier-scaled example
  verbatim — a cross-document consistency regression guard).
- **GIVEN** the default F4 knobs, **WHEN** evaluated at `T=1, T=9, T=10`,
  **THEN** the results are exactly `0.10, 0.02, 0.02` (the last two both
  clamp to the floor — boundary test at the exact tier the floor is first
  reached and the tier after).
- **GIVEN** any tier `T` in `[1, max_tier]`, **WHEN** F3 evaluates, **THEN**
  `depthMax(T) > depthMin(T)` always holds (band width is never zero or
  negative).

**Template pool (Formula F5, Edge Cases)**
- **GIVEN** a catalog where exactly 6 of 15 templates declare `T=5` in
  `eligibleTiers`, **WHEN** `templatePool(5)` is computed, **THEN** it
  contains exactly those 6 `TemplateId`s and no others.
- **GIVEN** a fully-loaded, passing-validation catalog, **WHEN**
  `templatePool(T)` is computed for every `T` in `[1, max_tier]`, **THEN**
  every result is non-empty.

**Offline complexity validation (Rule 8, Formula F2/F6)**
- **GIVEN** a template whose worst-case composition complexity exceeds
  `complexityBudget(T)` for some `T` it declares eligible, **WHEN** the
  catalog loads, **THEN** loading fails, reporting the offending
  `templateId` and `T`, and the template is never reachable via
  `templatePool()`.
- **GIVEN** a template whose worst-case composition complexity is at or
  below `complexityBudget(T)` for every `T` it declares, **WHEN** the
  catalog loads, **THEN** loading succeeds for this template.
- **GIVEN** a composition slot referencing an archetype with no
  `ArchetypeUnlockEntry`, **WHEN** the catalog loads, **THEN** loading
  fails, naming the missing `archetypeId`.

**Entry point contract (Rule 9)**
- **GIVEN** the system's public interface, **THEN** it exposes exactly
  `getEncounterForNode(runSeed, nodeId, nodeIndex, ascensionOffset,
  rosterSnapshot) → { tier, encounter }` and no method that mutates board
  state, unit state, or calls anything beyond Encounter Generator's own
  `generateEncounter()`.
- **GIVEN** a valid call, **WHEN** it completes, **THEN** the returned
  `tier` equals Formula F1's result for the same `(nodeIndex,
  ascensionOffset)`, and `encounter` is exactly what
  `generateEncounter(runSeed, nodeId, <assembled DifficultyConfig>,
  rosterSnapshot)` would independently return.

**Ascension offset clamping (Edge Cases)**
- **GIVEN** `ascensionOffset` above the current `ascension_max_offset`
  (e.g. a stale save), **WHEN** `getEncounterForNode()` is called, **THEN**
  it is silently clamped to `ascension_max_offset` before Formula F1
  evaluates — no error, no rejection.

### Performance Budget (headless TS benchmarks, decoupled from render)

| Operation | Budget | Note |
|-----------|--------|------|
| `tier()` (Formula F1) | < 0.01 ms | Pure arithmetic |
| Full `DifficultyConfig` assembly (F1, F3–F5; excludes F2/F6 offline-only) | < 0.1 ms | Dominated by `templatePool()`'s catalog scan; trivial at expected catalog sizes (~15–20 templates per `encounter-generator.md`'s content-volume target) |
| Offline catalog validator (Rule 8, all templates × all their eligible tiers) | < 100 ms one-time, at catalog load | Not a per-`getEncounterForNode()` cost — paid once, at game/content load, same budget class as Encounter Generator's own `baselineVerified` catalog-load check |
| `getEncounterForNode()` end-to-end, excluding the wrapped `generateEncounter()` call | < 1 ms overhead | The overwhelming majority of this call's latency is Encounter Generator's own solver work (its documented `< 5s` typical / `< 20s` worst case) — this system adds negligible overhead on top |

**Tester checks first:** confirm the offline validator (Rule 8) actually
runs and fails loudly on a deliberately-miscalibrated fixture template
(complexity ceiling exceeded, or a missing `ArchetypeUnlockEntry`) — this is
the one check most likely to be silently skipped if content authoring
outpaces the validator's implementation, and it is the sole mechanism
protecting Pillar #5 as the enemy roster and tier count both grow.

## Open Questions

**Needs an architecture decision (→ ADR during `/create-architecture`):**

1. **Where `unlockTier`/`complexityRating` physically live.** Rule 7 owns
   these fields today in a separate `ArchetypeUnlockEntry` table owned by
   Difficulty Tiers, referencing Enemy's archetype IDs read-only, rather
   than adding fields directly to Enemy's own archetype schema. This avoids
   Enemy,
   Abilities & Telegraph needing to know about tiers at all, but creates a
   second table that must stay in sync with the archetype catalog (every
   new archetype needs a matching unlock-table entry, enforced by Rule 8's
   validator). *Owner:* Tech architecture, coordinated with Enemy, Abilities
   & Telegraph once this becomes an implementation task.
2. **Whether Encounter Generator's roll step should consult
   `unlockTier` directly**, rather than relying entirely on template
   authors to hand-align `archetypePool` membership with their own
   `eligibleTiers` tags (the unresolved Edge Case above). The current
   design keeps this a content-authoring discipline, backed only by an
   advisory catalog-load warning; making it a hard constraint would require
   extending `encounter-generator.md`'s Rule 6/Formula F3 to accept an
   external eligibility filter, which is out of scope for this document to
   decide unilaterally. *Owner:* flag for `/consistency-check` between this
   document and `encounter-generator.md`.

**Resolved this session (provisional defaults — confirm during
implementation):**

3. **Tier assignment combines a within-run node ramp and a flat Ascension
   offset (Formula F1)**, rather than, e.g., Ascension multiplying the ramp
   or replacing it — chosen because additive combination is the simplest
   to reason about and matches Slay the Spire's own precedent (Ascension
   adds fixed modifiers on top of the base run, it does not rescale the
   base curve).
4. **`complexityBudget` is offline-only, never a runtime `DifficultyConfig`
   field** (Rule 8) — chosen to keep Encounter Generator's runtime contract
   completely unchanged by this document; all complexity gating happens at
   content-authoring time, before any battle is ever generated.
5. **Narrowness tightens (decreases) with tier while depth widens
   (increases) with tier** (Formulas F3–F4) — chosen as the most legible
   pairing of "harder": longer to solve AND less forgiving, rather than
   trading one off against the other.

**Deferred to the owning system's GDD:**

6. **Per-archetype `complexityRating` and `unlockTier` actual values**
   (the content itself, not the schema) are authored data, likely living
   alongside the Enemy archetype catalog in `assets/data/` or
   `design/balance/` — this document defines the *mechanism* the values
   feed, not the values themselves.
7. **Ascension unlock progression** (how a player earns each successive
   `ascensionOffset` level) is Meta-progression / Unlocks' design — this
   document only defines the ceiling (`ascension_max_offset`) and the
   mechanical effect a chosen offset has on tier assignment.
8. **Node-index source and run-map shape** (how `nodeIndex` is derived from
   an actual branching node map, rather than a simple linear ordinal) is
   Run Structure / Node Map's design — this document assumes `nodeIndex` is
   supplied as a single non-negative integer and does not prescribe how the
   map itself is laid out.
9. **`getEncounterForNode()` re-call caching policy** (Edge Cases' last
   item) is deferred to Run Structure / Node Map, which owns whether/when a
   node's encounter is pre-generated versus generated lazily on entry —
   this mirrors `encounter-generator.md`'s own identical deferral (Open
   Question 11 of that document).
