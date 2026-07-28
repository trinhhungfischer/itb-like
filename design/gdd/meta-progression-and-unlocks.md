# Meta-progression / Unlocks

> **Status**: In Design
> **Author**: workflow (design-system fan-out)
> **Last Updated**: 2026-07-27
> **Implements Pillar**: #3 Variety Lives in the Draft, Not the Dice (this system
> grows *what exists to be drafted* across the account's whole history, the
> permanent outer ring around Draft / Loadout Meta's per-run inner ring); #1
> Perfect Information, Perfect Blame (every unlock fires from a deterministic,
> never-RNG-gated condition — extended from the battlefield to the meta layer)

## Overview

Meta-progression / Unlocks is the **account-level, cross-run persistent
progression layer**: the system that decides which heroes, enemy variants,
Ascension (difficulty tier) offsets, and Starting Roster Draft options a given
player currently has access to, and the deterministic criteria that grow that
access over time. It owns exactly four things: the **Unlock Catalog** (a
closed, data-authored table of `UnlockDefinition`s — what can be unlocked and
under what condition), the **cumulative `MetaStatistics`** record that those
conditions are evaluated against (runs completed, tiers reached, heroes used,
enemies encountered), the single deterministic evaluation pass
(`processRunEnd`) that runs exactly once at the end of every run and fires any
newly-satisfied unlocks, and the read-only unlock-state interfaces that Draft /
Loadout Meta (hero catalog filter), Difficulty Tiers (unlocked Ascension
ceiling), and Draft / Loadout Meta's Starting Roster Draft (candidate-count
bonus) each consume. It does **not** own hero/enemy/ability *content* (Heroes &
Abilities, Enemy, Abilities & Telegraph own what a hero or archetype *is*), the
per-run Roster or Draft flow (Draft / Loadout Meta), the difficulty curve
itself (Difficulty Tiers), or the save-file mechanics (Run Persistence — this
document only defines the Meta Save payload shape that domain already
anticipates). Critically, per `game-concept.md`'s founding design ("player
growth is primarily KNOWLEDGE and OPTIONS, not raw power") and the explicit
anti-pillar ("NOT a power-creep roster"), **every unlock this system can ever
grant widens what exists, never how strong any single thing is** — an unlocked
hero is not stronger than an already-unlocked one (Heroes & Abilities' Pillar
#4 already forbids that), an unlocked Ascension offset is strictly *harder*,
never easier, and an unlocked Starting Option only ever adds *candidates to
choose from*, never a stat bonus.

## Player Fantasy

**"Every scar this account has earned is still here, and I can see exactly
what I'm still missing."** Where a single run is a puzzle and a Draft is a
build, the account itself is a *campaign of campaigns* — a trophy case the
player fills in permanently, run after run, whose contents never lie and are
never handed out by chance. This is Self-Determination Theory's **Competence**
made cumulative across sessions (each unlock is undeniable proof of a specific
thing the player did) and, for the Hero/DifficultyTier/StartingOption
categories, **Autonomy** as well — because their criteria are visible in
advance, the player can *choose* to chase a specific unlock as their next
goal, rather than simply hoping one falls out of a run. It primarily serves
**Pillar #3 (Variety Lives in the Draft, Not the Dice)**: this system is the
mechanism by which the draft pool itself grows across the account's whole
life, and it reinforces **Pillar #1 (Perfect Information, Perfect Blame)**
at the meta layer — nothing here is ever a loot box, a random roll, or a
hidden-odds gacha pull; every unlock is a deterministic function of things
the player provably did. It also directly serves the **Achiever** motivation
named in `game-concept.md` (a completable roster/tier ladder to climb) and,
for the `EnemyArchetypeEncountered` condition specifically, the **Explorer**
motivation (an enemy variant discovered by playing, not by reading a wiki
first — see Rule 16's visibility distinction). The failure state of this
system is any unlock that reads as "I got lucky" instead of "I earned this,"
or any unlock whose payload makes an existing choice strictly worse by
comparison — both would compromise Pillar #1's honesty or Pillar #4's
promise that no hero out-classes another, at the one layer of the game meant
to feel unconditionally rewarding regardless of whether the *run* was won.

## Detailed Design

### Core Rules

1. **Ownership boundary.** Meta-progression / Unlocks owns: the Unlock
   Catalog (`UnlockDefinition[]`, data-authored, not hardcoded — Tuning
   Knobs), the cumulative `MetaStatistics` record and its update rules
   (Formula F2), the single `processRunEnd` evaluation entry point (Formula
   F1) and its deterministic evaluation order, and the three read-only
   query interfaces other systems consume (`getUnlockedHeroIds()`,
   `getUnlockedAscensionOffset()`, `getStartingOfferCountBonus()`, plus the
   soft/future `getUnlockedArchetypeIds()`). It does **not** own: hero,
   ability, or enemy archetype *content* (Heroes & Abilities ✅; Enemy,
   Abilities & Telegraph ✅); the Roster, Loadout, or Draft Offer
   flow (Draft / Loadout Meta ✅); the difficulty curve or Ascension mechanics
   themselves (Difficulty Tiers ✅); node-map structure or the terminal
   run-outcome event (Run Structure / Node Map ✅, which owns
   `processRunEnd(outcome)` as the hook this document's own `processRunEnd`
   is invoked from — Rule 4); or `localStorage`
   read/write mechanics (Run Persistence — this document only defines the
   Meta Save payload's semantic content, matching that document's explicit
   "Meta-progression owns unlock rules and the catalog; Persistence only
   stores and versions the record" ownership line).
2. **Four unlock categories, a closed set.** Every `UnlockDefinition`
   belongs to exactly one of: **`Hero`** (adds one `HeroDefinition` id to
   the account's unlocked hero catalog — consumed by Draft / Loadout Meta's
   candidate-pool construction, resolving that document's Rule 17 soft
   dependency), **`EnemyVariant`** (adds one enemy archetype id to the
   account's unlocked archetype set — soft/future, Rule 10),
   **`DifficultyTier`** (raises the account's unlocked Ascension offset
   ceiling by one rung — consumed by Difficulty Tiers' `ascensionOffset`
   selection, resolving that document's own "gated by unlocks" note in its
   States and Transitions table), or **`StartingOption`** (adds to a bonus
   applied on top of Draft / Loadout Meta's `starting_offer_count` knob —
   more *candidates* to choose an opening squad from, never more squad
   slots, never a stat change). No fifth category exists in v1.
3. **Unlock conditions, a closed set of six.** Every `UnlockDefinition`
   declares exactly one `UnlockCondition`: `RunsCompleted(n)` (cumulative
   runs that reached *any* terminal state — Victory, Defeat, or Abandon —
   is `≥ n`), `TierReached(t)` (the highest Difficulty Tiers `tier` ever
   resolved for any node, across every run, win or lose, is `≥ t`),
   `BossDefeatedAtAscension(a)` (**this specific run** ended in `Victory`
   **and** was played at `finalAscensionOffset ≥ a`), `HeroUsedInVictory(heroId)`
   (**this specific run** ended in `Victory` **and** `heroId` was a member
   of at least one Loadout entered during it), `EnemyArchetypeEncountered(archetypeId)`
   (that archetype has appeared in at least one resolved battle, across any
   run, win or lose — cumulative, so a lost run can still unlock a
   discovery), and `CumulativeBattlesWon(n)` (the account's lifetime count
   of cleared `Battle`-type nodes is `≥ n`). Conditions are pure predicates
   over deterministic account/run state — **no condition in this system is
   ever evaluated against a random draw**; this is the one VANGUARD system
   whose formulas need no PRNG stream at all, since an unlock is an
   achievement, never a roll.
4. **`RunSummary` — the per-run evidence bundle.** At the end of every run
   (Victory, Defeat, or Abandon), the run's owner, Run Structure / Node Map
   ✅, assembles exactly one `RunSummary` (Data Contracts) from inside its
   own terminal entry point, `processRunEnd(outcome: {result: Victory |
   Defeat | Abandon, nodeType?: Battle | Elite | Boss})`
   (`run-structure-node-map.md` Rule 15) — that document's
   `processRunEnd(outcome)` is the exact hook point this document's own
   `processRunEnd(runSummary, metaStats, catalog)` (Formula F1) is invoked
   from, precisely once per terminal run event. `outcome.nodeType` is
   present, sourced from Turn & Phase Manager's `battle_ended` event (which
   carries `nodeType` per `cross-system-contracts.md` §10), whenever the
   outcome was determined by a battle node, and absent for a map-screen
   `Abandon`. `RunSummary` is never persisted itself — only its effect on
   `MetaStatistics` and on newly-fired unlocks survives past the call
   (matching `run-persistence.md`'s Rule 4f(i) "merge any run-earned unlocks
   into Meta Save" phrasing, which this document's `processRunEnd` output is
   the concrete producer of).
5. **`MetaStatistics` — the cumulative, monotonic account record.** Every
   numeric/count field in `MetaStatistics` (Data Contracts) only ever
   increases or stays the same across the account's lifetime (Formula F2);
   every set field (`heroesEverUsed`, `archetypesEverEncountered`,
   `unlockedHeroIds`, `unlockedArchetypeIds`, `unlockedIds`) only ever
   grows via union, never shrinks. The sole exception to monotonicity is a
   full reset to schema defaults on Meta Save corruption
   (`run-persistence.md`'s Edge Cases) — a disclosed, already-documented
   loss this system does not soften or special-case.
6. **`processRunEnd` is the single evaluation entry point, called exactly
   once per terminal run event.** It performs, in strict order: (a) merge
   `runSummary` into `metaStats` (Formula F2); (b) iterate the Unlock
   Catalog in its fixed, authored array order, evaluating each
   not-yet-unlocked definition's condition (Formula F4) against the
   **post-merge** `metaStats` and the original `runSummary`; (c) for every
   definition whose condition is now true, apply its unlock (Formula F3)
   immediately, so a later catalog entry's condition (if it happened to
   reference the just-applied state) sees the updated value within the same
   pass. There is no second pass and no re-evaluation within one call.
7. **Idempotency.** A `UnlockDefinition` whose id is already present in
   `metaStats.unlockedIds` is skipped unconditionally on every future
   `processRunEnd` call, even if its condition remains (or becomes again)
   true — an unlock fires **exactly once** per account, ever, and is
   permanent (States and Transitions).
8. **Deterministic evaluation order.** The Unlock Catalog is a fixed,
   authored array (not a set); `processRunEnd`'s iteration order is that
   array's declared order, unconditionally, every call. This guarantees
   that if two conditions become true in the same run-end pass, which one
   is "listed first" in any resulting UI ordering is always reproducible
   and never coincidental.
9. **Starting-run hero availability invariant.** The Meta Save's default,
   freshly-initialized `unlockedHeroIds` set has exactly
   `starting_unlocked_hero_count` (Tuning Knobs, default **5**) members —
   the account's earliest playable hero pool. This value is
   **structurally required** to be `≥ starting_offer_count`
   (`draft-and-loadout-meta.md`'s own knob, default **5**), proven never to
   shrink (Rule 5's monotonicity), so that a brand-new account can always
   complete Draft / Loadout Meta's Starting Roster Draft (Formula F5's
   proof) — a fresh account must never be soft-locked out of its first run.
10. **Enemy variant unlocks: mechanism defined, v1 launch content ships
    fully unlocked.** The `EnemyVariant` category and its
    `getUnlockedArchetypeIds()` interface exist and are fully specified by
    this document, but v1's default Unlock Catalog contains **zero**
    `EnemyVariant` entries with a nontrivial condition — every archetype
    Enemy, Abilities & Telegraph ships at launch is unlocked for every
    account from creation (`getUnlockedArchetypeIds()` returns the full
    catalog by default). This mirrors this project's established
    "define the mechanism now, defer the content" pattern (e.g. Heroes &
    Abilities' full roster, Difficulty Tiers' per-archetype values) and
    deliberately avoids two risks at once: inventing enemy archetype content
    ahead of Enemy, Abilities & Telegraph's own authored catalog (that
    system is now Designed ✅, but authoring real `EnemyVariant` content
    against it is a separate, deferred content pass — not a blocker on this
    document's mechanism), and risking a tier-1 archetype eligibility gap
    that could softlock early Encounter Generation (mirrored by Rule 9's
    hero-side safeguard). Post-v1 content passes may add real
    `EnemyVariant` entries now that Enemy, Abilities & Telegraph's archetype
    catalog exists to reference.
11. **Ascension unlock ladder.** `DifficultyTier`-category unlocks are
    authored as a **ladder**: each rung's `UnlockDefinition` has condition
    `BossDefeatedAtAscension(a)` and payload `{ascensionOffset: a+1}` — i.e.
    "beat the run at Ascension `a` to raise the ceiling to `a+1`." The
    account's `unlockedAscensionOffset` (starting at `0`) is exposed via
    `getUnlockedAscensionOffset()` as the maximum value the player may
    choose for a new run's `ascensionOffset` (consumed at run start by
    whichever system presents that choice — Map/Run UI ✅); it is
    monotonic (Formula F3's `max()`) and clamped at Difficulty Tiers'
    `ascension_max_offset` ceiling (that document's own knob, default
    **5**), never exceeding it.
12. **Starting Option unlocks widen candidates, never squad power.** Every
    `StartingOption` unlock's payload is a non-negative integer
    `starting_offer_count_bonus`, additively accumulated into
    `startingOfferCountBonus` (Formula F3), clamped at
    `starting_offer_count_bonus_cap` (Tuning Knobs). The **effective**
    Starting Roster Draft candidate count Draft / Loadout Meta's Rule 4
    should draw is `starting_offer_count + startingOfferCountBonus` — this
    document supplies the bonus term; Draft / Loadout Meta's own knob
    supplies the base. `squad_size` (how many of those candidates the
    player ultimately picks) never changes — this is strictly a "more to
    choose from," never a "stronger opening squad," lever.
13. **Hero unlocks feed Draft / Loadout Meta's candidate pool directly.**
    `getUnlockedHeroIds()`'s return value is the exact `heroCatalog` input
    Draft / Loadout Meta's `buildCandidatePool` (that document's Formula
    F3) should filter its `NewHero` sub-list and its Starting Roster Draft
    candidate draw against — this is the concrete resolution of that
    document's Rule 17 ("Meta-progression / Unlocks may narrow the eligible
    content pool… default v1 assumption absent that system is that the
    entire authored catalog is unlocked"). That default assumption is now
    superseded: with this system authored, the unlocked subset (not the
    full catalog) is always the correct filter input.
14. **No randomness anywhere in this system.** Every formula in this
    document (F1–F5) is a pure function of its inputs — no `mix()`, no
    `mulberry32` stream, no PRNG state of any kind is read or consumed.
    This is a deliberate, load-bearing design choice, not an oversight: an
    unlock is by definition a *deterministic reward for a deterministic
    achievement*, and introducing randomness here (e.g. a random chance to
    "roll" bonus unlock progress) would directly contradict Pillar #1 at
    the one layer of the game most visibly built to feel fair.
15. **The Unlock Catalog is data, not code.** Like every other content
    catalog in this project (Encounter Templates, Ability Upgrades, the
    hero roster), the actual `UnlockDefinition` array — which heroes/tiers/
    options unlock under which specific thresholds — is authored data in
    `assets/data/`, not hardcoded logic. This document specifies the
    schema, the evaluation mechanism, and illustrative worked examples
    (Formulas, below); the final v1 catalog content is a follow-on content
    authoring task (Open Questions), exactly mirroring Heroes & Abilities'
    and Difficulty Tiers' own content-vs-mechanism split.
16. **Criteria visibility is category-dependent, a presentation choice, not
    a mechanical one.** `Hero`, `DifficultyTier`, and `StartingOption`
    unlock criteria are **always shown to the player in full** (e.g. "Win a
    run — any outcome — to unlock Warden," "Defeat the Boss at Ascension 2
    to unlock Ascension 3") — this preserves Pillar #1's promise that the
    player can always see what they're working toward at the meta layer,
    the same way a battle's telegraphs are never hidden. `EnemyVariant`
    unlock criteria **may** be presented as an undiscovered "???" entry
    until met, since they represent narrative/combat *discovery* (an
    Explorer-motivated reward for encountering something, not a goal to
    strategize toward) rather than a build-affecting decision — this is
    purely a UI/copy choice (UI Requirements); `evaluateCondition` (Formula
    F4) behaves identically either way.

### Data Contracts

```
UnlockDefinition {
  id: string                          // stable, unique catalog key
  category: Hero | EnemyVariant | DifficultyTier | StartingOption
  payload: HeroUnlockPayload
          | EnemyVariantUnlockPayload
          | DifficultyTierUnlockPayload
          | StartingOptionUnlockPayload
  condition: UnlockCondition
  displayOrder: int                   // catalog UI ordering only; no gameplay effect
}

HeroUnlockPayload          { heroDefinitionId: string }
EnemyVariantUnlockPayload  { archetypeId: string }
DifficultyTierUnlockPayload{ ascensionOffset: int }        // "raises the ceiling to at least this value"
StartingOptionUnlockPayload{ starting_offer_count_bonus: int }  // non-negative, additive

UnlockCondition =
    RunsCompleted            { n: int }
  | TierReached               { tier: int }
  | BossDefeatedAtAscension   { ascensionOffset: int }
  | HeroUsedInVictory         { heroDefinitionId: string }
  | EnemyArchetypeEncountered { archetypeId: string }
  | CumulativeBattlesWon      { n: int }

RunSummary {                          // assembled once, at run end (Rule 4); never persisted itself
  outcome: Victory | Defeat | Abandon
  finalAscensionOffset: int           // the ascensionOffset chosen at this run's start (fixed all run)
  maxTierReached: int                 // highest Difficulty Tiers `tier` resolved for any node this run
  nodesClearedByType: { Battle: int, Elite: int, Reward: int, Event: int, Rest: int, Boss: int }
  heroesDeployed: Set<heroDefinitionId>     // union of every Loadout's membership at every node entered
  archetypesEncountered: Set<archetypeId>   // union of every enemy archetype appearing in any resolved battle
}
// Structural note: outcome == Victory  <=>  nodesClearedByType.Boss == 1
// (Victory is defined as clearing the Boss node — run-structure-node-map.md Rule 15 —
// so this document introduces no separate "bossDefeated" field.)

MetaStatistics {                      // cumulative, persisted via Run Persistence's Meta Save (Rule 5)
  runsCompleted: int                  // any terminal outcome (Victory, Defeat, or Abandon)
  runsWon: int
  bestAscensionCleared: int           // highest finalAscensionOffset with which Victory was ever achieved; -1 if never
  bestTierReached: int                // highest tier ever resolved, any run, win or lose; 0 if never
  totalBattlesWon: int
  totalElitesWon: int
  totalBossesDefeated: int
  heroesEverUsed: Set<heroDefinitionId>
  archetypesEverEncountered: Set<archetypeId>
  unlockedHeroIds: Set<heroDefinitionId>          // seeded to starting_unlocked_hero_count members (Rule 9)
  unlockedArchetypeIds: Set<archetypeId>          // seeded to "all v1 launch archetypes" (Rule 10)
  unlockedAscensionOffset: int                    // [0, ascension_max_offset], starts at 0
  startingOfferCountBonus: int                    // [0, starting_offer_count_bonus_cap], starts at 0
  unlockedIds: Set<unlockDefinitionId>            // which UnlockDefinitions have already fired (Rule 7)
  tutorialCompleted: boolean                      // true once the player finishes the onboarding tutorial; written by Onboarding/Tutorial, schema owned here
  tutorialSkipped: boolean                        // true if the player skipped the tutorial; written by Onboarding/Tutorial, schema owned here
}
```

> **Note — tutorial flags ownership.** `tutorialCompleted` and
> `tutorialSkipped` are *written* by the Onboarding / Tutorial system
> (`onboarding-tutorial.md`) but the field definitions live in — and are
> owned by — this `MetaStatistics` schema, which is the single canonical Meta
> Save payload (Rule 5). Onboarding must not define a separate/independent
> Meta Save extension for these; it reads and sets them through this schema.
> Unlike the counting/set fields, these two booleans are not required to be
> monotonic (a Meta Save reset returns them to their `false` defaults, and a
> re-run tutorial may legitimately toggle them).

### States and Transitions

**`UnlockDefinition` lifecycle** (per definition, per account):
`Locked → Unlocked` — a one-way, permanent transition, fired the instant its
condition is first satisfied during a `processRunEnd` pass (Rule 6b–c). There
is no `Relocked` state and no re-evaluation once `Unlocked` (Rule 7's
idempotency) — the only way an unlock reverts to `Locked` is a full Meta Save
reset on corruption (`run-persistence.md`'s Edge Cases), which resets the
*entire* `MetaStatistics` record, not individual unlocks selectively.

**`MetaStatistics` lifecycle** (per account): `Uninitialized → Default(seeded)
→ Accumulating(...) → Accumulating(...) → …` — monotonically accumulating for
the account's lifetime (Rule 5), with the sole reset transition
`Accumulating → Default(seeded)` triggered only by Meta Save corruption
(external to this document, per `run-persistence.md`).

**`processRunEnd` call lifecycle** (per invocation): `Idle → Merging(F2) →
Evaluating(F4, per catalog entry, in order) → Complete({updatedMetaStats,
newlyUnlocked})`. Stateless and side-effect-free with respect to anything
outside its own return value — the caller (Run Structure / Node Map) is
responsible for persisting the returned `updatedMetaStats` via Run
Persistence's `mergeUnlocksIntoMeta`/`saveMeta` (Dependencies).

### Interactions with Other Systems

Meta-progression / Unlocks is a **read-mostly account ledger**: it consumes
one event per run (its terminal outcome, packaged as `RunSummary`) and
exposes a small set of always-available, side-effect-free query interfaces
that other systems pull from at the moments they need them (Starting Draft
assembly, Ascension offset selection, candidate pool construction). It never
calls into any other system's mutation API.

| System | Reads from Meta-progression | Meta-progression reads / calls | Ownership boundary |
|---|---|---|---|
| **Run Persistence** ✅ | `saveMeta(data)` with the `MetaStatistics` payload shape (Data Contracts) as this domain's Meta Save `data`; `mergeUnlocksIntoMeta(unlocks)` at run-end (Rule 4f(i) of that document) | `loadMeta()` on boot to obtain the current `MetaStatistics` before any `processRunEnd` call | Persistence owns versioning/checksumming/storage of the payload; this document owns everything the payload *means* |
| **Heroes & Abilities** ✅ | — | Full `HeroDefinition` id catalog, to validate `HeroUnlockPayload.heroDefinitionId` values exist (catalog-load validation, Edge Cases) | Read-only; Heroes & Abilities never reads unlock state directly (it goes through Draft / Loadout Meta) |
| **Draft / Loadout Meta** ✅ | `getUnlockedHeroIds()` (Rule 13, resolves that document's Rule 17 soft dependency); `getStartingOfferCountBonus()` (Rule 12) | — | Draft / Loadout Meta owns the Roster/Draft flow itself; this document only supplies the *eligible pool* and the *candidate-count bonus* it draws from |
| **Difficulty Tiers** ✅ (new — not yet in `systems-index.md`'s declared edge for this system, see Dependencies) | `getUnlockedAscensionOffset()` (Rule 11) — the ceiling a new run's chosen `ascensionOffset` may not exceed | `ascension_max_offset` (that document's knob) as the hard clamp bound for `unlockedAscensionOffset` | Difficulty Tiers owns the mechanical *effect* of an Ascension offset on tier assignment; this document owns *how much of that range* a given account has earned access to — exactly the split Difficulty Tiers' own States and Transitions table already anticipates ("Meta-progression / Unlocks selects the value; Difficulty Tiers only clamps it") |
| **Run Structure / Node Map** ✅ | — | Calls this document's `processRunEnd(runSummary, metaStats, catalog)` from inside its own terminal entry point, `processRunEnd(outcome: {result, nodeType?})` (`run-structure-node-map.md` Rule 15), assembling `RunSummary` from `outcome` plus its own run-level state (Rule 4) | Run Structure owns run-level terminal state and is the sole caller of this document's `processRunEnd`, since no other system sees the whole run's lifecycle end-to-end |
| **Enemy, Abilities & Telegraph** ✅ | — | Would supply the archetype catalog `getUnlockedArchetypeIds()` filters against, and Encounter Generator's roll step would need to intersect its candidate pool with that filter — mirrors Difficulty Tiers' own unresolved Open Question #2 about `unlockTier` consultation | Not required for v1 launch content (Rule 10) — that system is Designed ✅, but authoring real `EnemyVariant` content against its archetype catalog is a separate, deferred content pass |
| **Map/Run UI** ✅ | Unlocked Ascension ceiling for the run-start offset picker; a locked/unlocked hero roster summary | — | Read-only consumer |
| **Unlocks / Archive UI** (undesigned, this document's own presentation layer) | Full Unlock Catalog with per-entry locked/unlocked/hidden state, `MetaStatistics` for progress display | — | Read-only consumer; see UI Requirements |

**Bidirectional-consistency notes:**
- `run-persistence.md` already lists Meta-progression / Unlocks as a Hard
  downstream dependent ("`saveMeta`/`loadMeta`, `mergeUnlocksIntoMeta`") —
  consistent with the row above; this document's `MetaStatistics` schema is
  the concrete payload that Rule fills that document's previously-opaque
  "unlock catalog shape, statistics fields" placeholder.
- `heroes-and-abilities.md` and `draft-and-loadout-meta.md` do not
  currently list Meta-progression / Unlocks as an upstream provider in
  their own Dependencies tables in the direction this document requires
  (`getUnlockedHeroIds()` feeding `buildCandidatePool`); `draft-and-loadout-meta.md`'s
  Rule 17 already anticipated this exact soft dependency and this document
  resolves it — flagged for `/consistency-check` to confirm the edge is
  added to that document's own Dependencies table on its next revision.
- `difficulty-tiers.md`'s Downstream table **already** lists Meta-progression
  / Unlocks as a Hard dependent with the precise interface this document
  implements (`ascension_max_offset` ceiling in, unlocked `ascensionOffset`
  out) — fully consistent, no gap.
- `run-structure-node-map.md`'s Downstream table now lists Meta-progression /
  Unlocks as **Hard**, calling into its own `processRunEnd(outcome)` hook
  (Rule 15) and assembling the full `RunSummary` this document requires
  (`finalAscensionOffset`, `maxTierReached`, `nodesClearedByType`,
  `heroesDeployed`, `archetypesEncountered`) from `outcome` plus its own
  run-level state, for all three terminal events (`Victory`, `Defeat`,
  `Abandon`) through the single unified entry point. **This was a
  payload-extension gap; it is now resolved** (Rule 4).
- `systems-index.md` currently lists this system's dependencies as exactly
  Run Persistence, Heroes & Abilities, and Draft / Loadout Meta. This
  document surfaces two additional real dependencies not yet reflected
  there: **Difficulty Tiers** (Hard, and already anticipated from that
  document's side) and **Run Structure / Node Map** (Hard, now resolved on
  that document's side too — its own Downstream table lists this
  dependency). *(Not edited here per this task's constraints — surfaced for
  the next consistency pass.)*

## Formulas

All formulas are deterministic — **this is the one VANGUARD system whose
formulas consume no PRNG stream at all** (Rule 14). Examples use v1 default
knob values (`starting_unlocked_hero_count=5`, `starting_offer_count_bonus_cap=1`,
`ascension_max_offset=5` from `difficulty-tiers.md`, `starting_offer_count=5`
from `draft-and-loadout-meta.md`, `squad_size=3` from `heroes-and-abilities.md`)
and the reference kit table (Vanguard, Warden, Twinblade, Ember, Striker) from
`heroes-and-abilities.md`.

### F1. Run-end unlock evaluation (`processRunEnd`)

```
processRunEnd(runSummary, metaStats, catalog):
  updated = mergeStatsIntoMeta(runSummary, metaStats)          // F2
  newlyUnlocked = []
  for def in catalog:                                          // fixed authored array order (Rule 8)
    if def.id in updated.unlockedIds: continue                 // idempotency (Rule 7)
    if evaluateCondition(def.condition, updated, runSummary):  // F4
      updated = applyUnlock(def, updated)                      // F3
      newlyUnlocked.append(def.id)
  return { updatedMetaStats: updated, newlyUnlocked }
```

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| this run's evidence | `runSummary` | RunSummary | — | Assembled once at run end (Rule 4) |
| pre-run cumulative state | `metaStats` | MetaStatistics | — | Loaded via Run Persistence's `loadMeta()` before this call |
| unlock content | `catalog` | UnlockDefinition[] | authored, fixed order | The full data-authored Unlock Catalog (Rule 15) |
| output | `{updatedMetaStats, newlyUnlocked}` | `{MetaStatistics, UnlockId[]}` | `newlyUnlocked.length ∈ [0, \|catalog\|]` | `updatedMetaStats` is written via `saveMeta`/`mergeUnlocksIntoMeta`; `newlyUnlocked` drives the unlock-reveal UI |

**Output range:** `newlyUnlocked` may be empty (a run that satisfies nothing
new — legal, Edge Cases) up to the full catalog size (every remaining locked
entry fires in one pass — legal, illustrated below).

**Worked example (multiple simultaneous unlocks):** catalog = `[unlock_warden
(RunsCompleted(1)), unlock_ascension_1 (BossDefeatedAtAscension(0)),
unlock_twinblade (TierReached(4))]`; fresh account `metaStats = {runsCompleted:0,
bestTierReached:0, unlockedIds:{}, …}`; `runSummary = {outcome:Victory,
finalAscensionOffset:0, maxTierReached:4, nodesClearedByType:{Battle:4,
Elite:1,Reward:2,Event:1,Rest:1,Boss:1}, heroesDeployed:{vanguard,striker,ember},
archetypesEncountered:{skitter}}`. After F2's merge: `runsCompleted=1,
bestTierReached=4, runsWon=1`. Evaluating in order: `unlock_warden` →
`1≥1` true → fires; `unlock_ascension_1` → `Victory ∧ 0≥0` true → fires;
`unlock_twinblade` → `4≥4` true → fires. Result: `newlyUnlocked =
[unlock_warden, unlock_ascension_1, unlock_twinblade]` — a strong first run
can legitimately unlock several things in one pass; this is intended, not a
bug (Edge Cases).

### F2. Cumulative statistics merge (`mergeStatsIntoMeta`)

```
mergeStatsIntoMeta(runSummary, metaStats):
  m = metaStats.copy()
  m.runsCompleted += 1
  if runSummary.outcome == Victory:
    m.runsWon += 1
    m.totalBossesDefeated += 1
    m.bestAscensionCleared = max(m.bestAscensionCleared, runSummary.finalAscensionOffset)
  m.bestTierReached = max(m.bestTierReached, runSummary.maxTierReached)
  m.totalBattlesWon += runSummary.nodesClearedByType.Battle
  m.totalElitesWon  += runSummary.nodesClearedByType.Elite
  m.heroesEverUsed = m.heroesEverUsed ∪ runSummary.heroesDeployed
  m.archetypesEverEncountered = m.archetypesEverEncountered ∪ runSummary.archetypesEncountered
  return m
```

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| run evidence | `runSummary` | RunSummary | — | This run's terminal state |
| prior cumulative state | `metaStats` | MetaStatistics | — | Value before this run |
| output | `m` | MetaStatistics | monotonic ≥ input | Never decreases any field relative to input (Rule 5) |

**Output range:** every counting field strictly `≥` its input value; every
set field is a superset of (or equal to) its input value.

**Worked example:** `metaStats` before: `{runsCompleted:2, runsWon:1,
bestAscensionCleared:0, bestTierReached:5, totalBattlesWon:9, totalElitesWon:2,
heroesEverUsed:{vanguard,striker}, archetypesEverEncountered:{skitter}}`;
`runSummary = {outcome:Victory, finalAscensionOffset:1, maxTierReached:6,
nodesClearedByType:{Battle:5,Elite:1,Reward:2,Event:1,Rest:1,Boss:1},
heroesDeployed:{vanguard,warden,ember}, archetypesEncountered:{skitter,broodling}}`.
Result: `runsCompleted=3, runsWon=2, bestAscensionCleared=max(0,1)=1,
bestTierReached=max(5,6)=6, totalBattlesWon=9+5=14, totalElitesWon=2+1=3,
totalBossesDefeated+=1, heroesEverUsed={vanguard,striker,warden,ember},
archetypesEverEncountered={skitter,broodling}`.

### F3. Unlock application (`applyUnlock`)

```
applyUnlock(def, metaStats):
  m = metaStats.copy()
  switch def.category:
    Hero:           m.unlockedHeroIds.add(def.payload.heroDefinitionId)
    EnemyVariant:    m.unlockedArchetypeIds.add(def.payload.archetypeId)
    DifficultyTier:  m.unlockedAscensionOffset =
                       clamp(max(m.unlockedAscensionOffset, def.payload.ascensionOffset),
                             0, ascension_max_offset)
    StartingOption:  m.startingOfferCountBonus =
                       clamp(m.startingOfferCountBonus + def.payload.starting_offer_count_bonus,
                             0, starting_offer_count_bonus_cap)
  m.unlockedIds.add(def.id)
  return m
```

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| unlock being applied | `def` | UnlockDefinition | condition already verified true | The catalog entry firing this call |
| ceiling (Difficulty Tiers) | `ascension_max_offset` | int | `[0,10]`, default 5 | Owned by `difficulty-tiers.md`, read-only here |
| ceiling (this document) | `starting_offer_count_bonus_cap` | int | Tuning Knobs, default 1 | Hard clamp on `startingOfferCountBonus` |

**Output range:** `unlockedAscensionOffset ∈ [0, ascension_max_offset]`;
`startingOfferCountBonus ∈ [0, starting_offer_count_bonus_cap]`; both set
fields (`unlockedHeroIds`, `unlockedArchetypeIds`) only ever grow.

**Worked examples (one per category):**
- **Hero:** `unlockedHeroIds = {vanguard,striker,ember}`, payload
  `{heroDefinitionId: "warden"}` → `{vanguard,striker,ember,warden}`.
- **DifficultyTier (normal step):** `unlockedAscensionOffset=0`, payload
  `{ascensionOffset:1}`, `ascension_max_offset=5` →
  `clamp(max(0,1),0,5)=1`.
- **DifficultyTier (reaching the ceiling):** `unlockedAscensionOffset=4`,
  payload `{ascensionOffset:5}` → `clamp(max(4,5),0,5)=5`.
- **StartingOption:** `startingOfferCountBonus=0`, payload
  `{starting_offer_count_bonus:1}`, cap `1` → `clamp(0+1,0,1)=1`. A
  hypothetical second `StartingOption` unlock past the cap:
  `clamp(1+1,0,1)=1` — legal, wasted (Edge Cases).

### F4. Condition evaluation (`evaluateCondition`)

```
evaluateCondition(condition, metaStats, runSummary):
  switch condition.type:
    RunsCompleted(n):            metaStats.runsCompleted >= n
    TierReached(t):               metaStats.bestTierReached >= t
    BossDefeatedAtAscension(a):   runSummary.outcome == Victory
                                     AND runSummary.finalAscensionOffset >= a
    HeroUsedInVictory(heroId):    runSummary.outcome == Victory
                                     AND heroId in runSummary.heroesDeployed
    EnemyArchetypeEncountered(id): id in metaStats.archetypesEverEncountered
    CumulativeBattlesWon(n):      metaStats.totalBattlesWon >= n
```

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| condition | `condition` | UnlockCondition | one of 6 closed types | Rule 3 |
| post-merge cumulative state | `metaStats` | MetaStatistics | — | **Already includes this run's contribution** (F1 calls F4 after F2) |
| this run's evidence | `runSummary` | RunSummary | — | Used only by the two per-run-scoped condition types |

**Output:** bool. **Note on mixing scopes (intentional):**
`BossDefeatedAtAscension` and `HeroUsedInVictory` are deliberately evaluated
against **this single run's** `runSummary`, not accumulated across runs — a
hero used in a *lost* run 1 followed by a *win* in run 2 with a different
squad must **not** satisfy `HeroUsedInVictory` for the first hero; the
achievement requires both facts to co-occur in the same run. `RunsCompleted`,
`TierReached`, `EnemyArchetypeEncountered`, and `CumulativeBattlesWon` are
deliberately cumulative, since they represent lifetime totals or "ever seen"
facts, not single-run co-occurrences.

**Worked examples:** `RunsCompleted(3)` against `metaStats.runsCompleted=3` →
`true`; `TierReached(7)` against `bestTierReached=6` → `false`;
`BossDefeatedAtAscension(2)` against `runSummary={outcome:Defeat,
finalAscensionOffset:3}` → `false` (outcome fails, offset would have
qualified — both conjuncts must hold); `EnemyArchetypeEncountered("broodling")`
against `archetypesEverEncountered={skitter,broodling}` → `true`.

### F5. Starting-run hero availability invariant

```
guaranteed:  |unlockedHeroIds| >= starting_offer_count   (at every point in the account's life)
```

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| unlocked hero count | `\|unlockedHeroIds\|` | int | monotonic non-decreasing (F3) | Grows only via `Hero`-category unlocks |
| Starting Draft candidate count | `starting_offer_count` | int | `draft-and-loadout-meta.md`'s knob, default 5 | The distinct-candidate count that document's Rule 4 requires |

**Proof:** `unlockedHeroIds` is seeded at Meta Save initialization to exactly
`starting_unlocked_hero_count` members (Rule 9, Tuning Knobs default **5**)
and is strictly non-decreasing thereafter (Rule 5/F3 — Hero-category unlocks
only ever `.add()`). Therefore, **as long as
`starting_unlocked_hero_count ≥ starting_offer_count` holds at every build**
(a cross-document tuning invariant recorded in Tuning Knobs), the inequality
above holds at every point in the account's lifetime, including the instant
of a brand-new account's very first `loadMeta()` — Draft / Loadout Meta's
Rule 4 ("shown `starting_offer_count` distinct `HeroDefinition`s… drawn from
the full unlocked hero catalog") can therefore always be satisfied, for every
player, at every point in the game's life. **Worked example:** default
knobs, `starting_unlocked_hero_count=5`, `starting_offer_count=5` → the
invariant holds with **zero margin** at account creation (the tightest legal
configuration); the first `Hero`-category unlock immediately creates
positive margin, which then only grows.

## Edge Cases

- **`newlyUnlocked` is empty for a given `processRunEnd` call:** legal and
  common — most runs, especially mid-account, satisfy nothing new. `metaStats`
  is still updated (F2's merge always runs) even when no unlock fires.
- **A single run satisfies several `UnlockDefinition`s at once** (F1's
  worked example): all fire, in the catalog's fixed authored order, within
  the same pass — this is intended, not a bug; the Unlocks/Archive UI must
  be able to present a multi-item reveal (UI Requirements), not assume at
  most one unlock per run.
- **The Unlock Catalog is empty** (e.g. very early in content authoring):
  `processRunEnd` still runs F2's merge normally and returns
  `newlyUnlocked = []` on every call — legal, matches this project's
  established "legal, just nothing happens" precedent (e.g. Draft / Loadout
  Meta's fully-built-Roster case).
- **A `DifficultyTierUnlockPayload.ascensionOffset` exceeds
  `ascension_max_offset`** (a content-authoring mistake — e.g. authoring
  "unlock Ascension 7" when the build's ceiling is 5): **rejected at catalog
  load**, naming the offending `UnlockDefinition.id`, mirroring Difficulty
  Tiers' own catalog-load-validation convention (that document's Rule 8) —
  this is a content-authoring error, never a live runtime path; F3's `clamp`
  exists as defense-in-depth, not as the primary guard.
- **A `HeroUnlockPayload.heroDefinitionId` references a hero id not present
  in Heroes & Abilities' catalog** (typo, or a hero cut post-authoring):
  rejected at catalog load, naming the offending id — same
  content-authoring-error treatment as above.
- **A `StartingOption` unlock's payload, once applied, would push
  `startingOfferCountBonus` above `starting_offer_count_bonus_cap`:**
  clamped (F3) — the unlock still fires (`unlockedIds` still records it,
  Rule 7's idempotency still applies going forward) but has **zero
  additional effect** past the cap; legal, wasted, matches this project's
  established "wasted but legal" precedent (e.g. Striker's empty ray in
  `heroes-and-abilities.md`).
- **A run ends in `Abandon`:** counts toward `runsCompleted` (F2 increments
  it unconditionally on any terminal outcome) but **never** toward
  `runsWon`, `totalBossesDefeated`, or `bestAscensionCleared` — an abandoned
  run still "happened" for `RunsCompleted`-gated unlocks, but grants no
  Victory-scoped credit. If the run was abandoned before any node was
  entered, `nodesClearedByType` is all-zero and `heroesDeployed`/
  `archetypesEncountered` are empty — every per-node or per-battle
  condition simply finds nothing to credit, not an error.
- **`HeroUsedInVictory(heroId)` where `heroId` was a Roster member all run
  but never actually placed in a Loadout that entered a node** (fully
  benched): the condition is `false` — `heroesDeployed` (RunSummary) is
  defined as the union of *Loadout membership at node entry*, not mere
  Roster membership; being recruited is not the same as being fielded.
- **An `EnemyVariant` unlock's `archetypeId` must reference an id present in
  Enemy, Abilities & Telegraph's archetype catalog** (that system is
  Designed ✅ and now defines a real archetype catalog to validate against —
  the same content-authoring-error treatment as the `Hero` case above
  applies once real `EnemyVariant` content is authored): v1 launch content
  contains zero `EnemyVariant` entries (Rule 10), so this validation path is
  currently unexercised, not blocked — it activates the moment a post-v1
  content pass adds the first real `EnemyVariant` entry.
- **The account's Meta Save is corrupted or newer-than-supported** (per
  `run-persistence.md`'s Edge Cases): this document does not soften or
  special-case either outcome — a corrupted Meta Save resets `MetaStatistics`
  to schema defaults (all unlocks lost, `unlockedHeroIds` reverts to the
  `starting_unlocked_hero_count` default set) exactly as that document
  already specifies; an `Unsupported(NewerVersion)` Meta Save makes every
  interface in this document unavailable for the session (no unlock
  queries succeed), also exactly as that document already specifies.
- **`starting_unlocked_hero_count` is misconfigured below
  `starting_offer_count`** (violating Formula F5's precondition, e.g. by an
  uncoordinated tuning change to either knob): Formula F5's guarantee **no
  longer holds** — a fresh account could be shown fewer than
  `starting_offer_count` distinct candidates at its very first Starting
  Roster Draft, which that document's Rule 4 does not define a fallback
  for. This is flagged explicitly in Tuning Knobs as the reason the two
  knobs must always be tuned together, and is the single most severe
  possible misconfiguration in this document (a fresh-account softlock),
  not merely a balance concern.
- **Two `UnlockDefinition`s of the same category target the same payload
  id** (e.g. two different conditions both unlocking `heroDefinitionId:
  "warden"`, as alternate paths to the same reward): legal — whichever
  fires first sets `warden ∈ unlockedHeroIds`; the second, evaluated in a
  later or the same pass, still evaluates its own condition and, if true,
  still adds itself to `unlockedIds` (Rule 7's idempotency is per
  `UnlockDefinition.id`, not per payload) but has no *additional* effect on
  `unlockedHeroIds` (set union is idempotent) — a legitimate "multiple ways
  to earn the same reward" authoring pattern, not an error.

## Dependencies

**Upstream (Meta-progression / Unlocks depends on):**

| System | Interface | Hard / Soft |
|---|---|---|
| **Run Persistence** ✅ | `loadMeta()`/`saveMeta()`/`mergeUnlocksIntoMeta()` for the `MetaStatistics` payload | **Hard** |
| **Heroes & Abilities** ✅ | Full `HeroDefinition` id catalog, for `HeroUnlockPayload` catalog-load validation (Edge Cases) | **Hard** (validation-time only; no runtime read) |
| **Draft / Loadout Meta** ✅ | `squad_size`, `starting_offer_count` knob values (Formula F5's invariant; Rule 12's bonus base) | **Hard** |
| **Difficulty Tiers** ✅ | `ascension_max_offset` knob value (F3's clamp bound, Rule 11) | **Hard** |
| **Run Structure / Node Map** ✅ | Calls `processRunEnd()` once per terminal run event, from inside its own `processRunEnd(outcome)` hook (Rule 15), supplying the assembled `RunSummary` | **Hard** — resolved on that document's side (Rule 15; its own Downstream table lists this dependency) |
| **Enemy, Abilities & Telegraph** ✅ | Archetype id catalog, for `EnemyVariantUnlockPayload` validation, once real `EnemyVariant` content exists (that system is Designed ✅; only its content-authoring pass is deferred) | **Soft, deferred** (Rule 10) |

**Downstream (systems that depend on Meta-progression / Unlocks):**

| Dependent System | Interface (what it uses) | Hard / Soft |
|---|---|---|
| **Draft / Loadout Meta** ✅ | `getUnlockedHeroIds()` (feeds `buildCandidatePool`'s `heroCatalog` input, resolving that document's Rule 17); `getStartingOfferCountBonus()` (Rule 12) | **Hard** — not yet reflected in that document's own Dependencies table (bidirectional-consistency gap, see Interactions) |
| **Difficulty Tiers** ✅ | `getUnlockedAscensionOffset()` as the player's currently-available Ascension ceiling at run start | **Hard** — already anticipated from that document's side (Downstream table) |
| **Map/Run UI** ✅ | Unlocked Ascension ceiling; locked/unlocked hero roster summary | **Soft, provisional** |
| **Unlocks / Archive UI** (undesigned) | Full Unlock Catalog + `MetaStatistics`, read-only | **Hard, provisional** |
| **Encounter Generator** ✅ | Would consult `getUnlockedArchetypeIds()` when rolling archetype composition slots, once `EnemyVariant` content exists | **Soft, deferred** |

**Bidirectional-consistency note:** `systems-index.md` lists this system's
dependencies as Run Persistence, Heroes & Abilities, and Draft / Loadout
Meta only. This document surfaces two additional real dependencies:
**Difficulty Tiers** (Hard, already anticipated from that document's own
Downstream table — no gap on that side) and **Run Structure / Node Map**
(Hard, now resolved on that document's side — its own Downstream table
lists this dependency, and its `processRunEnd(outcome)` hook, Rule 15,
supplies the full `RunSummary` this document requires). *(Not edited here
per this task's constraints — surfaced for the next consistency pass.)*

## Tuning Knobs

| Knob | Default | Safe Range | Category | Too Low | Too High |
|---|---|---|---|---|---|
| `starting_unlocked_hero_count` | 5 | `starting_offer_count` .. (`full_v1_roster_size − 1`), i.e. **5–7** at v1 defaults (`starting_offer_count=5`, roster target 6–8 per `heroes-and-abilities.md`'s Open Question #7) | Gate | **Below `starting_offer_count` (5): breaks Formula F5's invariant — a fresh account can be shown fewer than the required distinct Starting Roster Draft candidates, a genuine new-player softlock, the single most severe misconfiguration this document can produce.** | At `full_v1_roster_size` (every hero unlocked from account creation), the `Hero` unlock category has zero content left to grant — removes the "new heroes" pillar of this whole system's promise |
| `starting_offer_count_bonus_cap` | 1 | 0–(`draft-and-loadout-meta.md`'s `starting_offer_count` safe-range ceiling minus its default), i.e. **0–1** at v1 defaults (base 5, ceiling 6) | Gate | `0` removes the `StartingOption` category entirely — a valid, if smaller, v1 scope cut, not a broken state | Above the coupled ceiling, applying every `StartingOption` unlock would push the effective Starting Draft candidate count past Draft / Loadout Meta's own documented safe range for `starting_offer_count`, reintroducing that document's own "overwhelming first-decision menu" onboarding concern |
| `ascension_unlock_thresholds` (which Ascension steps have a `DifficultyTier` unlock authored, guideline) | one rung per integer step, `0→1, 1→2, … up to ascension_max_offset−1 → ascension_max_offset` | 1 rung per step (**not recommended to skip a rung**) | Gate | Skipping a rung (e.g. no unlock authored for `3→4`) permanently strands any account that hasn't separately reached offset 4 by some other means — since `DifficultyTier` unlocks only ever `max()` toward a payload value, a missing intermediate rung is not fatal (a later rung's payload still eventually grants it) but does create a "jump" that feels arbitrary; author the full ladder unless a deliberate design reason exists to skip one | N/A — granting more than one rung's worth of ceiling per unlock is legal (F3's `max()` handles it) but dilutes the "one Boss clear, one step up" cadence this system is designed around |
| `RunsCompleted`/`TierReached`/`CumulativeBattlesWon` threshold values (per-unlock content, guideline) | varies per entry (illustrative: `RunsCompleted(1)`, `TierReached(4)`, `CumulativeBattlesWon(10)`) | thresholds should span the account's expected lifetime play (early: first 1–3 runs; mid: 10–30 cumulative battles; late: `TierReached` near `max_tier`) | Curve | Thresholds clustered too early exhaust the catalog's content within a player's first session, leaving nothing to chase for the rest of the account's life — undermines the long-term Achiever hook `game-concept.md` names | Thresholds clustered too late (e.g. every `Hero` unlock requiring `CumulativeBattlesWon(100)+`) makes the early roster feel thin for too long, risking the same "verb-first roster collides with legibility/variety" tension `heroes-and-abilities.md`'s own risk section already names for a *content*, not mechanical, reason |
| `EnemyVariant` catalog content (guideline) | 0 entries in v1 launch content (Rule 10) | N/A until Enemy, Abilities & Telegraph ships an archetype catalog | Gate | N/A at default | N/A — deferred entirely, see Open Questions |

**Interactions between knobs:**
- `starting_unlocked_hero_count` and Draft / Loadout Meta's
  `starting_offer_count` **must always be tuned together** — Formula F5's
  new-account-softlock-avoidance proof depends structurally on the former
  never being lower than the latter; a change to either knob in isolation
  must re-verify the inequality before shipping.
- `starting_offer_count_bonus_cap` and Draft / Loadout Meta's own
  documented safe range for `starting_offer_count` are coupled the same
  way: this document's cap should never let
  `starting_offer_count + startingOfferCountBonus` exceed that other
  document's own upper safe bound (`squad_size + 3`, i.e. **6** at default
  `squad_size=3`).
- `ascension_unlock_thresholds`' ladder length and Difficulty Tiers'
  `ascension_max_offset` are coupled 1:1 by construction (Rule 11) — raising
  `ascension_max_offset` without authoring a matching new top rung leaves
  the highest offset(s) permanently unreachable through normal play (still
  technically selectable by a stale/edited save per Difficulty Tiers' own
  clamp-on-load Edge Case, but never earnable).

**Intentionally NOT knobs (structural, design-locked invariants):**
- **Unlock evaluation is never probabilistic.** There is no "chance to
  unlock early" or "bonus roll" knob anywhere in this system — every
  condition is a deterministic threshold check (Rule 14). Introducing one
  would directly contradict Pillar #1 at the account layer.
- **An unlock, once fired, can never be revoked by normal play.** There is
  no "unlock decay" or "use it or lose it" knob — only a full Meta Save
  reset (external to this document, Run Persistence's corruption path)
  ever removes an unlock, and that is a disclosed failure state, never a
  tunable design lever.
- **`processRunEnd`'s catalog iteration order is not configurable per
  session** — it is exactly the authored array order, always, so that
  "which unlock fires first when several become true at once" is
  reproducible and never a runtime decision.

## Visual/Audio Requirements

- **A distinct, undeniable "unlock" reveal moment.** When `newlyUnlocked` is
  non-empty after a run ends, the player must see an explicit reveal
  (name/icon/category of each newly-unlocked item) before returning to the
  title/map screen — this is the single moment this entire system exists
  to deliver, and it must never be buried in a stats screen the player has
  to seek out.
- **No gambling-adjacent presentation.** Because every unlock is earned,
  never rolled (Rule 14), its reveal must never borrow loot-box/gacha
  presentation conventions (spinning reels, suspenseful "will I get it"
  pacing, rarity-tier shimmer implying randomness) — a deterministic
  achievement should read as a deterministic achievement; this directly
  protects Pillar #1's "no surprises" promise from being visually
  undermined even when the mechanic itself is honest.
- **Distinct iconography per unlock category**, matching this project's
  established "icon-driven, never text-only" identification pattern
  (`game-concept.md`'s Visual Identity Anchor, already extended to Draft /
  Loadout Meta's offer categories) — `Hero`, `EnemyVariant`,
  `DifficultyTier`, and `StartingOption` unlocks must be visually
  distinguishable at a glance in both the reveal moment and the Archive
  screen (UI Requirements).
- **Locked-vs-hidden distinction is visible, not just implied.** A
  `Locked` entry whose criteria is shown (Hero/DifficultyTier/StartingOption,
  Rule 16) must render its exact condition text; a `Locked` `EnemyVariant`
  entry presented as "???" must still visually communicate "something
  exists here, undiscovered" rather than being indistinguishable from "no
  entry" — the player should always know how much of the catalog remains,
  even for hidden entries.
- **Audio hooks (owned by Audio System ✅):** this document flags
  the unlock-reveal moment as needing a distinct, positive, non-repetitive
  sting per unlock category, matching the project's "crisp SFX for
  moves/telegraphs" audio direction (`game-concept.md`) extended to the
  account-progression layer; explicitly **not** a slot-machine or
  loot-crate sound family, per the no-gambling-presentation rule above.

## UI Requirements

- **An Unlocks / Archive screen**, reachable from the title/home screen
  (alongside Run Persistence's "Continue Run" entry point), listing every
  `UnlockDefinition` grouped by category, each showing: unlocked state
  (`Locked`/`Unlocked`/`Hidden`), its criteria (per Rule 16's visibility
  rules), and, once unlocked, the exact reward it granted.
- **A post-run unlock reveal screen**, shown once per `processRunEnd` call
  that produces a non-empty `newlyUnlocked`, before the player returns to
  the title/map — presenting every newly-fired unlock from that single
  pass together (F1's multi-unlock worked example), not one at a time
  across multiple screens.
- **The run-start Ascension offset picker** (owned by Map/Run UI ✅)
  must clamp its selectable range to `getUnlockedAscensionOffset()` and
  visibly communicate the current ceiling and, ideally, "how far to the
  next rung" (e.g. "Beat the Boss at Ascension 2 to unlock Ascension 3").
- **The Starting Roster Draft screen** (owned by Draft / Loadout Meta's UI)
  must draw exactly `starting_offer_count + getStartingOfferCountBonus()`
  candidates, and should surface the bonus's source (an earned unlock) if
  non-zero, so the extra choice reads as an earned benefit, not an
  unexplained knob change.
- Full screen-flow, transition, and layout design is deferred to
  `ux-designer` (via `/ux-design` for a future
  `design/ux/unlocks-archive-screen.md`) — this document's contribution is
  the data contract (Unlock Catalog + `MetaStatistics`) that UI must render
  against.

## Acceptance Criteria

Pure, deterministic unit tests unless noted — no wall-clock time, no RNG (this
system uses none, Rule 14), no rendering. Default knob values and the
illustrative catalog/worked examples from Formulas unless stated otherwise.

**`processRunEnd` core behavior (Rules 6–8, Formula F1)**
- **GIVEN** a `runSummary` and `metaStats` with an empty Unlock Catalog,
  **WHEN** `processRunEnd` runs, **THEN** `metaStats` is updated per F2 and
  `newlyUnlocked` is exactly `[]`.
- **GIVEN** the F1 worked example's exact inputs, **WHEN** `processRunEnd`
  runs, **THEN** `newlyUnlocked` is exactly `[unlock_warden,
  unlock_ascension_1, unlock_twinblade]`, in that order (reproduced
  literally).
- **GIVEN** a `UnlockDefinition` already present in `metaStats.unlockedIds`,
  **WHEN** its condition is (re-)satisfied by a later run, **THEN** it does
  **not** appear in that later call's `newlyUnlocked` (idempotency, Rule 7).
- **GIVEN** two `UnlockDefinition`s whose conditions both become true in the
  same call, **WHEN** `processRunEnd` runs, **THEN** they appear in
  `newlyUnlocked` in exactly the catalog's authored array order, every time
  (Rule 8, determinism).

**Statistics merge (Rule 5, Formula F2)**
- **GIVEN** the F2 worked example's exact inputs, **WHEN**
  `mergeStatsIntoMeta` runs, **THEN** every output field matches the worked
  example's stated values exactly.
- **GIVEN** any `runSummary`/`metaStats` pair, **WHEN** merged, **THEN**
  every counting field of the output is `≥` the corresponding input field,
  and every set field is a superset of (or equal to) the corresponding
  input field (monotonicity invariant, randomized-input check).
- **GIVEN** a `runSummary` with `outcome = Defeat`, **WHEN** merged,
  **THEN** `runsWon`, `totalBossesDefeated`, and `bestAscensionCleared` are
  unchanged from their input values, while `runsCompleted` and
  `bestTierReached` still update normally.
- **GIVEN** a `runSummary` with `outcome = Abandon` and all-zero
  `nodesClearedByType`, **WHEN** merged, **THEN** only `runsCompleted`
  increments; every other field is unchanged.

**Condition evaluation (Rule 3, Formula F4)**
- **GIVEN** each of the six condition types with a boundary-true and a
  boundary-false input pair (e.g. `RunsCompleted(3)` against `runsCompleted
  ∈ {2,3}`), **WHEN** evaluated, **THEN** the result matches the documented
  `≥`/membership semantics exactly at both boundaries.
- **GIVEN** `BossDefeatedAtAscension(2)` against a `runSummary` with
  `outcome=Defeat, finalAscensionOffset=5`, **WHEN** evaluated, **THEN**
  the result is `false` (both conjuncts required — a high offset alone
  does not qualify without a Victory in the same run).
- **GIVEN** `HeroUsedInVictory("warden")` against a `runSummary` with
  `outcome=Victory` but `heroesDeployed` not containing `"warden"`,
  **WHEN** evaluated, **THEN** the result is `false`.

**Unlock application and clamping (Rule 11–12, Formula F3)**
- **GIVEN** the F3 worked examples (one per category), **WHEN**
  `applyUnlock` runs on each, **THEN** the resulting field matches the
  worked example's stated value exactly.
- **GIVEN** a `DifficultyTier` unlock whose payload would push
  `unlockedAscensionOffset` above `ascension_max_offset`, **WHEN** applied,
  **THEN** the result is clamped to exactly `ascension_max_offset`, never
  higher.
- **GIVEN** a `StartingOption` unlock applied when `startingOfferCountBonus`
  is already at `starting_offer_count_bonus_cap`, **WHEN** applied,
  **THEN** the value is unchanged (clamped no-op) and `unlockedIds` still
  records the unlock as fired (Edge Cases).

**Starting-run invariant (Rule 9, Formula F5)**
- **GIVEN** the default knob configuration (`starting_unlocked_hero_count=5,
  starting_offer_count=5`), **WHEN** a fresh Meta Save is initialized,
  **THEN** `|unlockedHeroIds| == starting_unlocked_hero_count` and the F5
  invariant (`|unlockedHeroIds| ≥ starting_offer_count`) holds.
- **GIVEN** any sequence of `Hero`-category unlocks applied over time,
  **WHEN** `|unlockedHeroIds|` is checked after each, **THEN** it is
  non-decreasing across the whole sequence (monotonicity regression guard).

**Catalog-load validation (Edge Cases)**
- **GIVEN** an Unlock Catalog containing a `HeroUnlockPayload` referencing a
  `heroDefinitionId` absent from Heroes & Abilities' catalog, **WHEN** the
  catalog loads, **THEN** loading fails, naming the offending
  `UnlockDefinition.id`.
- **GIVEN** an Unlock Catalog containing a `DifficultyTierUnlockPayload`
  with `ascensionOffset > ascension_max_offset`, **WHEN** the catalog
  loads, **THEN** loading fails, naming the offending `UnlockDefinition.id`
  and the excess value.

**Downstream interface contracts (Interactions)**
- **GIVEN** a `metaStats` with `unlockedHeroIds = {vanguard, striker,
  ember, warden, twinblade}`, **WHEN** `getUnlockedHeroIds()` is queried,
  **THEN** it returns exactly that set, usable verbatim as
  `draft-and-loadout-meta.md` Formula F3's `heroCatalog` filter input.
- **GIVEN** `metaStats.unlockedAscensionOffset = 2`, **WHEN**
  `getUnlockedAscensionOffset()` is queried, **THEN** it returns exactly
  `2`, and any run-start selection of `ascensionOffset ∈ {0,1,2}` is
  legal while `{3,4,5}` is not offered.

### Performance Budget (headless TS benchmarks, decoupled from render)

| Operation | Budget | Note |
|---|---|---|
| `processRunEnd` (Formula F1, catalog ≤ ~50 entries at v1 content scale) | < 1 ms | Single linear pass over a small, fixed-size authored catalog; called at most once per run |
| `mergeStatsIntoMeta` (Formula F2) | < 0.1 ms | Fixed-size field updates plus two small set unions |
| `evaluateCondition` (Formula F4, single call) | < 0.02 ms | Pure predicate, no traversal |
| `getUnlockedHeroIds()` / `getUnlockedAscensionOffset()` / `getStartingOfferCountBonus()` (read-only queries) | < 0.05 ms | Direct field reads off the in-memory `MetaStatistics` |

## Open Questions

**Needs an architecture decision (→ ADR during `/create-architecture`):**

1. **Where `heroesDeployed` and `archetypesEncountered` are actually
   accumulated during a run.** Draft / Loadout Meta already tracks Loadout
   membership per node, but not a run-long *union* of every Loadout
   configuration used; `run-structure-node-map.md`'s Rule 15 names "heroes
   deployed" as part of the run-level state it assembles `RunSummary` from,
   but neither document specifies the exact accumulation mechanism
   (event-subscription vs. direct tracking) for that field or for
   `archetypesEncountered`. *Proposed:* Run Structure / Node Map (or a new
   thin run-scoped accumulator) subscribes to Loadout-change and
   battle-composition events and folds them into the `RunSummary` it
   assembles at run end. *Owner:* Tech architecture, coordinated with Draft
   / Loadout Meta and Encounter Generator maintainers.

**Resolved this session (provisional defaults — confirm during
implementation):**

2. **`run_completed`/`run_abandoned` was replaced by a single
   `processRunEnd(outcome)` hook, which now carries a full `RunSummary`.**
   `run-structure-node-map.md` previously declared only a bare
   `run_completed(Victory | Defeat)` event (plus a separate `run_abandoned`
   signal); it now exposes `processRunEnd(outcome: {result, nodeType?})`
   (its Rule 15) as the single terminal entry point for all three outcomes,
   and assembles and forwards the full `RunSummary` shape this document
   defines (`finalAscensionOffset`, `maxTierReached`, `nodesClearedByType`,
   `heroesDeployed`, `archetypesEncountered`) from `outcome` plus its own
   run-level state — resolved, and reflected in Rule 4 and both documents'
   Dependencies tables.
3. **Meta-progression/Unlocks uses zero randomness** (Rule 14) — a
   deliberate design choice reinforcing Pillar #1 at the account layer, not
   an oversight; revisit only if a future design explicitly wants a
   lottery-style bonus-unlock mechanic (which would be a significant
   Pillar #1 policy change, not a small addition).
4. **`EnemyVariant` unlocks ship with zero real content in v1** (Rule 10) —
   the mechanism is complete and specified, and Enemy, Abilities & Telegraph
   is now Designed ✅ with a real archetype catalog to reference; only the
   `EnemyVariant`-category content-authoring pass against that catalog is
   deferred.
5. **Unlock criteria visibility split by category** (Rule 16) — Hero /
   DifficultyTier / StartingOption always visible, EnemyVariant optionally
   hidden — chosen to balance Pillar #1's meta-layer transparency against
   the genuine "discovery" value of a hidden enemy-encounter reward;
   revisit if playtesting shows hidden entries read as confusing rather
   than intriguing.

**Deferred to the owning system's GDD / a content pass:**

6. **The final v1 Unlock Catalog content** (which specific heroes/tiers/
   options unlock under which specific thresholds, beyond this document's
   illustrative examples) is a follow-on content-authoring task, mirroring
   Heroes & Abilities' and Difficulty Tiers' own content-vs-mechanism
   split.
7. **The Unlocks / Archive screen's exact layout and transition treatment**
   is deferred to `ux-designer` via a future
   `design/ux/unlocks-archive-screen.md`.
8. **Real `EnemyVariant` unlock content and exercising its catalog-load
   validation rule** are deferred until a post-v1 content pass authors
   entries against Enemy, Abilities & Telegraph's (now Designed ✅)
   archetype catalog (Rule 10, Open Question 4).
9. **Whether a future external-platform achievement layer (e.g. a
   storefront's own achievement API) should mirror this catalog** is
   explicitly out of scope for v1 — the game is browser-only with no
   account system in v1 (matches `run-persistence.md`'s own v1 scope
   line: "browser-local only — no cloud sync, no account system").
