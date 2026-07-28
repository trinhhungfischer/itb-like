# Draft / Loadout Meta

> **Status**: In Design
> **Author**: workflow (design-system fan-out)
> **Last Updated**: 2026-07-27
> **Implements Pillar**: #3 Variety Lives in the Draft, Not the Dice; #1 Perfect Information, Perfect Blame; #2 Positioning Over Power

## Overview

Draft / Loadout Meta is the between-battle progression layer that turns a
sequence of individually-solvable battles into a **run** with a build the
player is accountable for. It owns three things: the **Roster** (the
persistent set of recruited heroes for this run, each tracked as a
`RosterMember` with HP that carries across battles), the **Loadout**
(which `squad_size` Roster members are actually deployed into the next
battle), and the **Draft** (the deterministic, seeded offer-and-pick flow
that grows the Roster and its heroes' Ability Upgrades at Reward nodes, Rest
nodes, and after every Battle/Elite victory). This is the literal mechanical
home of Pillar #3: every ounce of run-to-run variety in VANGUARD — which
heroes you have, which verbs are upgraded and how, which trade-offs you
accepted — is decided here, by the player, with full information, never by
an in-battle roll. This document does not decide what a hero *is* (Heroes &
Abilities), what an upgrade *does* (Ability Upgrades), or when a node is
entered (Run Structure / Node Map) — it decides *which heroes exist in this
run, in what shape, and what the player is offered to grow them*.

## Player Fantasy

**"Every choice I make between fights is a bet on the commander I'm
becoming."** Where a single battle is a puzzle to be solved, the run is a
build to be authored — recruiting a new verb into the squad, sinking a
second upgrade into the Vanguard's Shove instead of diversifying, choosing
to walk into the Boss at less than full strength because the free upgrade
was worth the risk. This is Self-Determination Theory's **Autonomy** and
**Competence** made explicit and cumulative: every offer is fully legible
before it's picked (no hidden odds, no blind box — Pillar #1 extended from
the battlefield to the meta layer), and every pick is a visible, ownable
step in a build the player can point to and say "I made this." It primarily
serves **Pillar #3 (Variety Lives in the Draft, Not the Dice)** — this
system *is* the draft the pillar refers to — and reinforces **Pillar #2
(Positioning Over Power)**, since the majority of what's on offer (new
verbs, push/pull/swap-boosting upgrades) expands *what a hero can do to the
board*, not a flat damage stat. It also serves **Expression** (MDA) and the
**Achiever**/**Explorer** motivations named in `game-concept.md`: Achievers
read the Roster as a collection to complete, Explorers read the offer pool
as a space of build combinations to try across repeat runs. The failure
state of this system is an offer screen that feels like a slot machine
(hidden value, illegible trade-offs — breaking Pillar #1) or a choice that
isn't really one (one option always strictly dominates — breaking Autonomy
and, with it, Pillar #3's entire promise).

## Detailed Design

### Core Rules

1. **Ownership boundary.** Draft / Loadout Meta owns: the `RosterMember`
   schema and the persistent, run-scoped hero-instance identity it
   represents; the Roster's growth rules (recruitment, capacity); the
   Loadout's selection/reconfiguration rules (already-defined-elsewhere
   Loadout *shape* per Heroes & Abilities Rule 5 — this document decides
   *which* Roster members populate it and *when* it may change); the
   deterministic Draft Offer generation and resolution flow for Reward
   nodes, Rest nodes, and post-Battle/Elite-Victory bonuses; and the
   `resolveNode(nodeId, {outcome: Completed})` callback contract Run
   Structure / Node Map requires. It does **not** own: hero chassis/ability
   *content* (Heroes & Abilities), what an upgrade numerically *does* or its
   compatibility rules (Ability Upgrades), map topology or node sequencing
   (Run Structure / Node Map), Event-node content (a future,
   entirely-undesigned narrative/event-content system — **PROVISIONAL, out
   of this document's scope**), or save-file mechanics (Run Persistence —
   this document only defines the payload shape).
2. **`RosterMember` is the persistent hero-instance identity this project
   has needed since Heroes & Abilities' former Open Question #3 and Ability
   Upgrades' Open Question #2 first flagged the gap.** A `RosterMember` is
   distinct from both `HeroDefinition` (Heroes & Abilities' authored,
   stateless content) and the battle-scoped `Unit` record — the latter is
   now formally defined (`cross-system-contracts.md` §6, registry entry
   `unit_record`, published as the authoritative "Unit Record Schema" in
   `heroes-and-abilities.md`): `{ id, team, archetype, maxHP, currentHP,
   position, size, abilities[], hazardImmunities[], statusFlags[] }`.
   `RosterMember` is the run-long record of *one specific recruited hero* —
   which `HeroDefinition` it is, its current HP (Rule 3), and its filled
   Ability Upgrade slots (owned in content by Ability Upgrades, but
   *attached to* this record, resolving that document's Rule 13/
   "PROVISIONAL: the exact persistent record this attaches to" note
   explicitly). **This document proposes and defines the `RosterMember`
   schema (Data Contracts) as the answer to both prior documents' open
   gap** — flagged for architecture confirmation (Open Questions), not a
   unilateral claim on the now-published `Unit` record's own schema, which
   this document only references (Rule 3) and never re-shapes.
3. **Persistent, non-lethal HP model — scoped to the mech.** *(Amended
   2026-07-28 by `pilots.md`: this rule's non-lethal guarantee covers the
   **mech** — the `RosterMember` — and is unchanged in substance. Its
   **pilot** is a separate entity with its own lifecycle and* **does** *die
   permanently; see Rule 3a below.)* A `RosterMember.currentHP` persists
   across the whole run, **never resets to full automatically between
   battles**, and **never falls below `1`**. At battle Setup, each deployed
   Loadout member's `currentHP` seeds that battle's fresh `Unit.currentHP`
   (Heroes & Abilities' per-battle Unit record, instantiated at deployment
   per that document's `NotDeployed → Deployed(tile)` transition). At that
   battle's terminal `battle_ended` event, every deployed member's
   post-battle `Unit.currentHP` is written back to `RosterMember.currentHP`
   — **clamped to a minimum of `1`, even if the `Unit` itself ended the
   battle `Removed(Defeated | Fell)`** (Formula F6). This is a deliberate
   design choice, not an oversight: it is what gives Rest nodes real
   stakes (Rule 11) and what resolves, for this system's v1 scope, Run
   Structure / Node Map's Open Question #6 note that "partial-roster
   continuation would require Heroes & Abilities to define cross-battle
   HP/death persistence, which does not exist yet" — it exists now, defined
   here, and it is deliberately **never permanent removal**: a hero who
   falls in battle is battered, not gone, and is fully eligible for the
   very next Loadout at `1` HP unless the player chooses to Rest first.
   This guarantees, by construction, that Heroes & Abilities' hard
   requirement ("a Loadout is exactly `squad_size` distinct heroes") can
   always be satisfied for the rest of the run (Formula F6's proof).
   3a. **Pilot lethality (added 2026-07-28, owned by `pilots.md`).** A
   `RosterMember` gains the field `pilotId: PilotInstance.id | null`
   (`null` = AI Core). Rule 3's non-lethal guarantee does **not** extend to
   pilots: if a deployed member's `Unit` ends the battle
   `Removed(Defeated | Fell)`, its assigned pilot's `status` becomes `Dead`
   and `pilotId` is set to `null`, permanently for the remainder of the run.
   This resolves at the same `battle_ended` point as Formula F6's `currentHP`
   write-back. The mech itself is unaffected — it is still written back at
   `currentHP = 1` and is still fully deployable. `pilots.md` owns the
   `PilotInstance` schema, the XP/level model, and the death formula; this
   document owns only the `pilotId` field and the `PilotOffer` pipeline.
4. **Starting Roster Draft.** Before the player's first `enterNode()` call
   (i.e., before row 1 of the generated map is ever entered — `nodeId = -1`,
   reusing `MapEdge`'s virtual-Start sentinel convention from
   `run-structure-node-map.md`), the player is shown `starting_offer_count`
   (Tuning Knobs, default **5**) distinct `HeroDefinition`s, deterministically
   drawn (Formula F3/F4) from the full unlocked hero catalog, and must pick
   exactly `squad_size` (default **3**, per Heroes & Abilities' knob) of
   them. Each picked `HeroDefinition` becomes a new `RosterMember` at full
   `maxHP`; the resulting Roster (exactly `squad_size` members) is also set
   as the initial Loadout automatically, since Roster size equals
   `squad_size` at this exact moment. This is the run's first real draft
   decision and the mechanism that gives every run's opening squad genuine
   variety (Pillar #3) from move one.
5. **Roster growth is capped and additive-only in v1.** A `RosterMember`,
   once recruited (Starting Draft or a `NewHeroOffer` pick, Rule 8), is
   **never removed** from the Roster for the rest of the run — there is no
   bench-drop, sell, or permadeath mechanic for *mechs* in v1 (consistent
   with Rule 3's non-lethal HP model). *Pilots are the sole exception in the
   whole design and are governed by Rule 3a, not this rule.* The Roster may grow up to `max_roster_size`
   (Tuning Knobs, default **7**) distinct `HeroDefinition`s; recruiting a
   `HeroDefinition` already present in the Roster is impossible by
   construction (Formula F1's candidate pool excludes already-recruited
   ids), matching Heroes & Abilities' own Loadout-level "no duplicate hero"
   invariant one level up, at the Roster level.
6. **Loadout selection is a map-screen-only action, gated identically to
   Ability Upgrades' slot-assignment gating.** The active Loadout (which
   `squad_size` Roster members are deployed) may only be changed while no
   battle is in the `InTurn` battle-level state (`turn-and-phase-manager.md`'s
   `Setup → InTurn → Ended` states) — in practice, exclusively at the map
   screen, before `enterNode()` is called for a Battle/Elite/Boss node. The
   previous battle's Loadout selection **carries forward by default**
   (no forced re-selection every node) until the player explicitly changes
   it; this keeps repeat battles fast when the player is happy with their
   current squad, while always allowing a full reconfiguration when a
   Roster member needs to be swapped out for HP recovery reasons or a
   tactical read on the upcoming node type.
7. **Squad composition constraint.** A Loadout is valid if and only if
   (Formula F6): it contains exactly `squad_size` distinct `RosterMember`
   ids, all currently present in the Roster, and each member's `currentHP
   ≥ min_hp_for_deployment` (Tuning Knobs, default **1** — i.e., no
   exclusion by default, per Rule 3's floor). Attempting to enter a
   Battle/Elite/Boss node with an invalid Loadout is rejected at the map
   screen, before `enterNode()` is ever called — this is a UI-level
   precondition this document guarantees is always satisfiable (Rule 3 +
   Rule 4's Roster-size-equals-`squad_size` starting guarantee), never a
   dead-end the player can be trapped in.
8. **Draft Offer categories (v1: four).** Every generated offer is one of:
   **`NewHeroOffer`** (recruit a specific not-yet-Rostered `HeroDefinition`,
   Rule 5), **`AbilityUpgradeOffer`** (grant one `AbilityUpgradeInstance`
   of a specific `AbilityUpgradeDefinition` to a specific Roster member's
   empty, compatible slot — validated via Ability Upgrades' `isCompatible()`
   at generation time, Rule 9's Formula F1, checked against the target
   hero's `AbilityDefinition` (`{shape, targetFilter, effectTemplate,
   compileEffects()}`, the shared hero/enemy ability schema owned by Heroes
   & Abilities per `cross-system-contracts.md` §5) so an incompatible or
   already-full-slot combination is never shown), **`PassiveModuleOffer`**, or **`GadgetOffer`**. A fifth, always-present,
   **never randomly generated** pseudo-offer, **`SkipOffer`**, is appended
   to every offer set — declining every generated offer is always legal
   (Rule 10), matching this project's established "the player may always
   decline" precedent (Heroes & Abilities' Extra-Use decline, Ability
   Upgrades' Rest-choice framing). A further category, **`PilotOffer`**, is
   **active as of 2026-07-28** (`pilots.md`): it offers one
   `PilotDefinition` and is **generated only when at least one
   `RosterMember` has `pilotId == null`** (`pilots.md` Formula F5) — so an
   offered pilot always has an empty cockpit to occupy. When that predicate
   is false, `PilotOffer` is excluded from the candidate pool and the slot is
   filled by another offer type, exactly as other unavailable categories are
   handled. `SkipOffer` still applies, so a `PilotOffer` remains declinable.
9. **Offer generation is deterministic and seeded, per the project's
   established `mix()` + `mulberry32` convention.** For any Draft-triggering
   event (Starting Draft, Reward-node entry, Rest-node Train choice,
   Battle/Elite post-Victory bonus), a fresh PRNG stream is derived
   (Formula F1/F2) from `(runSeed, nodeId)` and consumed to (a) build a
   candidate offer pool (Formula F3), then (b) draw `offerCount` distinct
   offers from it without replacement, weighted by category (Formula F4).
   Identical `(runSeed, nodeId)` inputs always regenerate a byte-identical
   offer set — the map-level and battle-level half of this project's
   reproducibility guarantee (`run-structure-node-map.md` Rule 16,
   `encounter-generator.md` Rule 14) extended to the draft layer.
10. **Reward-node resolution flow.** Entering a `Reward`-type map node
    generates `reward_offer_count` (Tuning Knobs, default **3**) offers
    plus the mandatory `SkipOffer` (Rule 8); the player picks **exactly
    one**. Picking a `NewHeroOffer` or `AbilityUpgradeOffer` immediately
    executes it (Rule 12); picking `SkipOffer` applies nothing. Either way,
    the node then calls back `resolveNode(nodeId, {outcome: Completed})`
    per Run Structure / Node Map's Rule 12 contract — a Reward node can
    never fail to complete, matching that document's "always non-failing"
    v1 scope line for Reward/Event/Rest nodes.
11. **Rest-node resolution flow — the heal-vs-upgrade trade-off.** Entering
    a `Rest`-type map node presents exactly two mutually-exclusive choices,
    no offer screen shown until a choice is made:
    - **Heal**: every `RosterMember` in the *entire Roster* (not just the
      active Loadout — this is the "banked preparation opportunity"
      `run-structure-node-map.md`'s Player Fantasy section names) is healed
      per Formula F5 (default: full heal to `maxHP`).
      - **Train**: no healing occurs; instead, exactly **one**
      `AbilityUpgradeOffer` (never a `NewHeroOffer` — Rest is about
      deepening an existing hero, not growing the Roster) is generated
      (Formula F3/F4 with the category forced to `AbilityUpgrade` and
      `offerCount = 1`), plus the mandatory `SkipOffer`. The player resolves
      it exactly as a Reward-node pick (Rule 10).
    Either branch then calls `resolveNode(nodeId, Completed)`. This is the
    system's sharpest expression of Pillar #3's "variety lives in the
    draft": walking into the Boss at less than full HP because Train's
    upgrade was worth it is a real, ownable, fully-informed bet.
12. **Post-victory bonus offers (Battle/Elite only, never Boss).** When a
    Battle or Elite node's battle reaches terminal `Victory`
    (`Objective`'s `EvaluationResult.status`, surfaced via Turn & Phase
    Manager's `battle_ended` per `run-structure-node-map.md` Rule 11),
    Draft / Loadout Meta immediately generates a bonus offer screen before
    control returns to the map: `battle_victory_offer_count` (Tuning
    Knobs, default **1**) offers for a plain Battle victory,
    `elite_victory_offer_count` (default **3**) for an Elite victory — both
    plus the mandatory `SkipOffer` — resolved exactly as Rule 10. **The
    Boss node's Victory generates no offer screen at all**: the run ends in
    `Run Victory` the instant that battle's `battle_ended(Victory)` fires
    (`run-structure-node-map.md` Rule 15), so there is no future battle for
    any granted offer to matter for — generating one would be a dangling,
    meaningless choice screen, which this document explicitly avoids
    (Edge Cases). This rule **confirms and resolves**
    `run-structure-node-map.md`'s Interactions table proposal ("post-Battle/
    Elite/Boss-Victory reward triggers") in the specific direction: Battle
    and Elite trigger it, Boss does not.
13. **Offer execution.** Executing a chosen `NewHeroOffer` creates a new
    `RosterMember` (Rule 5) at full `maxHP`, zero filled upgrade slots.
    Executing a chosen `AbilityUpgradeOffer` calls Ability Upgrades'
    assignment API (`heroes-and-abilities.md`/`ability-upgrades.md` Rule 12)
    against the target `RosterMember`'s upgrade-slot state — legal only
    while no battle is `InTurn` (Rule 6's same gate applies here, since
    every Draft-triggering event in this document occurs exclusively
    between battles or immediately after one ends).
14. **`class` (Heroes & Abilities' non-mechanical flavor tag) is used for
    filtering/grouping in the Roster/Draft UI only — never for a synergy
    bonus in v1.** This document deliberately does not introduce
    class-based bonuses, honoring Heroes & Abilities' own provisional note
    that such a system, if ever wanted, is "an addition to *that* system,
    not a retroactive change to hero chassis fields" — and, for this
    document specifically, would also need its own dedicated design pass
    to avoid becoming a hidden, illegible power source that undermines
    Pillar #1.
15. **`rosterSnapshot` is exposed read-only to Run Structure / Node Map.**
    On request (per `run-structure-node-map.md` Rule 13's `DifficultyConfig`
    assembly, which forwards a `rosterSnapshot` to Encounter Generator),
    this document provides the current Roster's shape (member count,
    `HeroDefinition` ids, aggregate upgrade count) — Draft / Loadout Meta
    never reads anything back from Encounter Generator or Run Structure in
    the other direction; this is a one-way, read-only export.
16. **Reproducibility.** Given identical `(runSeed, nodeId)` pairs — including
    across a session resume after a crash mid-offer-screen — `generateOffers`
    (Rule 9, Formula F1–F4) always returns a byte-identical offer set. This
    is the draft-layer instance of this project's established
    reproducibility guarantee (`run-structure-node-map.md` Rule 16,
    `encounter-generator.md` Rule 14).
17. **Meta-progression / Unlocks (✅ Designed) narrows the eligible hero
    pool and bonuses the Starting Draft — a Hard dependency.**
    Meta-progression / Unlocks' `getUnlockedHeroIds()` supplies the
    `heroCatalog` input this document's candidate pool construction
    (Formula F1/F3) filters against, and its `getStartingOfferCountBonus()`
    adds to `starting_offer_count` (Tuning Knobs) at Starting Draft time
    (Rule 4). That document's own Formula F5 proves
    `|unlockedHeroIds| ≥ starting_offer_count` holds at every point in the
    account's life (guarded by the cross-document tuning invariant
    `starting_unlocked_hero_count ≥ starting_offer_count`), so the Starting
    Roster Draft (Rule 4) can always be satisfied for every player, from
    account creation onward (Dependencies).

### Data Contracts

```
RosterMember {
  id: string                          // stable per-run identity
  heroDefinitionId: string            // -> HeroDefinition.id (Heroes & Abilities)
  currentHP: int                      // [1, HeroDefinition.maxHP], persists across battles (Rule 3)
  upgradeSlots: AbilityUpgradeInstance[]  // shape/content owned by Ability Upgrades;
                                       // length == upgrade_slots_per_hero (that doc's knob)
  pilotId: string | null              // -> PilotInstance.id; null = AI Core. Owned by pilots.md (Rule 3a)
  recruitedAt: nodeId | 'start'       // -1 sentinel ('start') for the Starting Roster Draft
}

Roster {
  members: RosterMember[]             // 0..max_roster_size, no duplicate heroDefinitionId
  activeLoadout: string[]             // RosterMember.id[]; length == squad_size when Configured,
                                       // empty ([]) only in the instant before the Starting Draft resolves
}

DraftOffer =
    NewHeroOffer      { heroDefinitionId: string }
  | AbilityUpgradeOffer { rosterMemberId: string, upgradeDefinitionId: string }
  | PassiveModuleOffer  { rosterMemberId: string, moduleDefinitionId: string }
  | GadgetOffer         { rosterMemberId: string, gadgetDefinitionId: string }
  | PilotOffer          { pilotDefinitionId: string }   // active 2026-07-28; gated by pilots.md F5 (Rule 8)
  | SkipOffer           {}            // never generated by RNG — always structurally appended (Rule 8)

RestChoice = Heal | Train
```

### States and Transitions

**RosterMember lifecycle:** `NotRecruited → Recruited` (Starting Draft, Rule
4, or a resolved `NewHeroOffer`, Rule 13) `→` persists for the remainder of
the run. There is no `Removed`/`Lost` transition in v1 (Rule 5) — a
`RosterMember`'s only ongoing state change is its `currentHP` value
fluctuating within `[1, maxHP]` (Rule 3), which is not a discrete lifecycle
state but a continuously-tracked field.

**Loadout configuration state** (per Roster, at the map screen only):
`Unset → Configured(squad_size members) ↔ Configured(different squad_size
members)` while no battle is `InTurn`; `Configured → Locked` for the
duration of any `InTurn` battle (Rule 6), `Locked → Configured` again the
instant that battle ends (win, lose-the-run, or abandon — the Loadout
selection itself is not destroyed by a lost battle, only the run is, per
Run Structure Rule 15).

**Draft offer set lifecycle** (per triggering event — node entry or
post-Victory): `Ungenerated → Generated(offers[] incl. SkipOffer) →
Resolved(chosenOffer)`. `Resolved` is terminal for that specific offer set
and immediately triggers Rule 13 (if not `SkipOffer`) followed by the
`resolveNode(nodeId, Completed)` callback (Rules 10–12).

### Interactions with Other Systems

Draft / Loadout Meta is a **run-scoped state owner and orchestration
target**: it never touches the board or a live battle directly — it
prepares what the *next* battle will use and reacts to what the *last* one
produced.

| System | Reads from Draft / Loadout Meta | Draft / Loadout Meta reads / calls | Ownership boundary |
|---|---|---|---|
| **Heroes & Abilities** ✅ | The resolved active Loadout (`squad_size` distinct `HeroDefinition`s, resolved from `RosterMember.heroDefinitionId`), each seeded with `RosterMember.currentHP` at battle Setup (Rule 3) | Full `HeroDefinition` catalog (draftable content); Loadout shape/validation rules (`squad_size`, no-duplicate invariant); each hero's `AbilityDefinition` (`cross-system-contracts.md` §5) for upgrade-compatibility checks (Rule 8) | Heroes & Abilities owns what a hero *is* and the shape of a valid Loadout; Draft / Loadout Meta owns *which* Roster members fill it and *whether* the Roster contains them at all |
| **Ability Upgrades** ✅ | `RosterMember.upgradeSlots` contents, changed via its assignment API (Rule 13) | Upgrade catalog, `isCompatible()` (candidate-pool filtering, Formula F1), per-member slot Empty/Filled state | Ability Upgrades owns what an upgrade *does* and legality; Draft / Loadout Meta owns *when/whether* one is offered and assigned |
| **Run Structure / Node Map** ✅ | `resolveNode(nodeId, Completed)` callback (Rules 10–12); `rosterSnapshot` (Rule 15) | Node-entry events for Reward/Rest node types; `battle_ended(Victory)` node-type context for Battle/Elite post-Victory bonuses (Rule 12) | Run Structure decides *when* a node is entered and routes control; Draft / Loadout Meta owns everything that happens *inside* a Reward/Rest node and everything that happens *as a reward for* a Battle/Elite win |
| **Run Persistence** ✅ | — | `saveRun()`/`loadRun()` for Roster + Loadout + per-member upgrade-slot state, on every roster-affecting confirmation (recruit, upgrade assignment, Rest choice, Loadout reconfiguration) — matching that document's Rule 4c write-trigger convention | Persistence stores the opaque payload this document shapes; this document never touches `localStorage` directly |
| **Meta-progression / Unlocks** ✅ | Recruitment/upgrade-pick history for unlock-eligibility bookkeeping (`HeroUsedInVictory`, `CumulativeBattlesWon` conditions) | `getUnlockedHeroIds()` (candidate-pool filtering, Rule 17), `getStartingOfferCountBonus()` (Rule 4) | Meta-progression owns unlock state and the account-level catalog; Draft / Loadout Meta owns the per-run Roster/Draft flow those unlocks feed into |
| **Draft/Loadout UI** ✅ | Roster (all members, HP, upgrade slots), current Loadout, live `DraftOffer[]` sets, `RestChoice` options | Player's pick/choice selections | Read-only + selection-input consumer; all game-rule legality lives in this document, never duplicated in UI code |
| **Map/Run UI** ✅ | Roster summary (member count, names/classes) for map-screen display alongside the node graph | — | Soft, read-only consumer |

**Bidirectional-consistency notes:**
- `heroes-and-abilities.md`'s Downstream table already lists Draft / Loadout
  Meta as **Hard** ("Full `HeroDefinition` roster to offer as draftable
  content" / "Writes/selects the active `Loadout` for a run") — consistent
  with the row above; this document's `RosterMember` (Rule 2) is the
  concrete mechanism that makes "writes/selects the active Loadout"
  precise.
- `ability-upgrades.md`'s Downstream table already lists Draft / Loadout
  Meta as **Hard** ("`isCompatible()`, the upgrade catalog, the Upgrade Slot
  assignment/removal API") and that document's Rule 13 explicitly flags the
  persistent-attachment-record gap this document's `RosterMember` schema
  resolves.
- `run-structure-node-map.md`'s Interactions table already lists Draft /
  Loadout Meta as **Hard, blocking** ("Delegates Reward/Rest node
  resolution and post-Battle/Elite/Boss-Victory reward triggers to it") —
  this document confirms that contract and resolves the one ambiguity it
  left open: Boss-node Victory does **not** trigger an offer screen (Rule
  12), the other two combat node types do.
- `run-persistence.md`'s Downstream table already lists Draft / Loadout
  Meta as **Hard** ("`saveRun`/`loadRun` for roster/upgrade state") and
  explicitly flags this as a `systems-index.md` gap to correct — this
  document does not edit `systems-index.md` (out of scope per this task's
  constraints) but confirms the dependency is real, in both directions.
- `meta-progression-and-unlocks.md`'s own Downstream table already lists
  Draft / Loadout Meta as **Hard** ("`getUnlockedHeroIds()` … resolving that
  document's Rule 17" / "`getStartingOfferCountBonus()`") and flags this as
  "not yet reflected in that document's own Dependencies table
  (bidirectional-consistency gap)" — this document now reflects it (Rule
  17, Dependencies): the relationship is confirmed **Hard**, bidirectional,
  in both directions, no longer Soft/provisional.
- **Gap surfaced, not yet in either document's contract:**
  `heroes-and-abilities.md` now publishes the authoritative `Unit` record
  schema (`cross-system-contracts.md` §6, registry `unit_record`), but its
  published `NotDeployed → Deployed(tile)` transition still states
  `currentHP = maxHP` unconditionally — it does not yet describe being
  *seeded* from an external `currentHP` value at `Deployed` time (rather
  than always starting at `HeroDefinition.maxHP`). This document's Rule 3
  depends on that seeding hook being added. Flagged in Open Questions for
  propagation to the eventual `Unit`-record architecture decision.

## Formulas

All formulas are deterministic (no RNG beyond the seeded PRNG stream itself,
no time-dependence). Examples use v1 default knob values (`squad_size=3`,
`starting_offer_count=5`, `max_roster_size=7`, `reward_offer_count=3`) and
the reference kit table from `heroes-and-abilities.md` (Vanguard, Warden,
Twinblade, Ember, Striker).

### F1. Draft seed derivation

`draftSeed = mix(runSeed, nodeId, DRAFT_SEED_SALT)`

where `mix` is the same deterministic 32-bit hash combiner pinned by the
shared ADR referenced in `encounter-generator.md`'s Open Question #1 and
`run-structure-node-map.md`'s Formula F1, and `DRAFT_SEED_SALT` is the fixed
string `"vanguard_draft_offer_v1"`. The Starting Roster Draft (Rule 4) uses
the reserved sentinel `nodeId = -1` (the same virtual-Start sentinel
`run-structure-node-map.md`'s `MapEdge.fromNodeId` already establishes),
decorrelating it from every real node's draft stream by construction (a
different `nodeId` input, same as that document's salt-based decorrelation
reasoning).

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| run seed | `runSeed` | uint32 | any | Owned by Run Structure / Node Map, set once at run start |
| node id | `nodeId` | int | `-1` (Starting Draft) or any real `MapNode.nodeId` | Identifies which draft-triggering event this stream belongs to |
| salt constant | `DRAFT_SEED_SALT` | string | fixed | `"vanguard_draft_offer_v1"` — never varies |

**Output:** uint32, `[0, 2^32−1]`. **Worked example (illustrative, matching
this project's established convention for unresolved hash values):**
`runSeed=0xA1B2C3D4, nodeId=-1` → `draftSeed = mix(0xA1B2C3D4, -1,
"vanguard_draft_offer_v1") = <some uint32>`, decorrelated from both the map
stream (`run-structure-node-map.md` F1) and any real node's later draft
stream by the differing `nodeId` input alone.

### F2. PRNG stream (mulberry32 — shared algorithm)

Identical algorithm to `encounter-generator.md`'s Formula F2 and
`run-structure-node-map.md`'s Formula F2, reproduced here for standalone
readability. This `mix()` combiner + `mulberry32` stream is registered as
**`mulberry32_prng`** in `design/registry/entities.yaml` (canonical source:
`encounter-generator.md`); this document supplies only its own salt constant
(`DRAFT_SEED_SALT`, Formula F1) and must **not** let the algorithm diverge
from that canonical definition:

```
state = draftSeed
next():
  state = (state + 0x6D2B79F5) mod 2^32
  t = state
  t = (t ^ (t >> 15)) * (t | 1) mod 2^32
  t = t ^ (t + (t ^ (t >> 7)) * (t | 61)) mod 2^32
  return ((t ^ (t >> 14)) mod 2^32) / 2^32     // float in [0, 1)
```

**Declared draw order (fixed):** for an `offerCount`-sized offer set, one
category-roll draw followed by one item-selection draw **per offer slot**,
slot index `0 → offerCount−1`, in that order — matching this project's
"declared slot order" determinism convention.

**Output range:** `[0, 1)`, uniform. **Total draws for a default
`reward_offer_count=3` offer set:** exactly 6 (2 draws × 3 slots) —
trivially small, no search/retry budget needed (unlike Encounter
Generator's solver).

### F3. Candidate offer pool construction

```
buildCandidatePool(roster, heroCatalog, upgradeCatalog):
  pool = { NewHero: [], AbilityUpgrade: [] }
  if |roster.members| < max_roster_size:
    for hero in heroCatalog:
      if hero.id not in roster.members.map(m -> m.heroDefinitionId):
        pool.NewHero.append(NewHeroOffer(hero.id))
  for member in roster.members:
    if member.upgradeSlots has an Empty slot:                    // Ability Upgrades' slot model
      for upgradeDef in upgradeCatalog:
        if isCompatible(effectiveAbility(member), upgradeDef):   // Ability Upgrades F1-adjacent check
          pool.AbilityUpgrade.append(AbilityUpgradeOffer(member.id, upgradeDef.id))
  return pool
```

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| roster | `roster` | Roster | `0..max_roster_size` members | Current run's Roster |
| hero catalog | `heroCatalog` | HeroDefinition[] | full authored v1 roster (6–8 heroes) | Filtered by Meta-progression's unlock state if that system exists (Rule 17) |
| upgrade catalog | `upgradeCatalog` | AbilityUpgradeDefinition[] | full authored catalog | Ability Upgrades' content |
| output | `pool` | `{NewHero: DraftOffer[], AbilityUpgrade: DraftOffer[]}` | each sub-list `≥0` | Never contains an incompatible or already-full-slot combination (filtered at construction, not at draw time) |

**Output range:** either sub-list may legally be empty (Edge Cases handles
both, and their simultaneous case). **Worked example:** Roster =
`{Vanguard (2 empty slots), Striker (1 empty slot, 1 filled)}`,
`max_roster_size=7`, `|roster.members|=2` (room to grow) → `pool.NewHero`
contains one `NewHeroOffer` per not-yet-recruited `HeroDefinition` (e.g.,
`{Warden, Twinblade, Ember}` if those are the remaining catalog entries);
`pool.AbilityUpgrade` contains one `AbilityUpgradeOffer` per
`(member, compatible upgradeDef)` pair across both members' empty slots —
e.g., Vanguard qualifies for Push Distance Boost and Extra Use (compatible
per `ability-upgrades.md` Rules 6–7) but not Damage Boost (no `damage` step
in Shove, that document's Rule 5) or `allyDamageImmune` (Shove's
`targetFilter=Enemy`, no ally-targetable `damage` step, that document's
Rule 8).

### F4. Weighted, no-duplicate offer draw

```
generateOffers(pool, offerCount, categoryOverride = null):
  offers = []
  remaining = pool.deepCopy()
  for i in 0..offerCount-1:
    if categoryOverride != null:
      category = categoryOverride                       // Rest-node Train path (Rule 11)
    else:
      weights = normalize({ NewHero: w_new if |remaining.NewHero|>0 else 0,
                             AbilityUpgrade: w_upg if |remaining.AbilityUpgrade|>0 else 0 })
      if weights is empty (both remaining lists exhausted): break   // Edge Cases
      draw_cat = next()                                  // F2
      category = rollWeightedType(draw_cat, weights)      // reuses run-structure-node-map.md F4's pattern
    draw_item = next()                                    // F2
    chosen = rollChoice(draw_item, remaining[category])    // reuses encounter-generator.md F3's rollChoice
    offers.append(chosen)
    remove chosen from remaining[category]
  offers.append(SkipOffer())                               // always appended, never drawn (Rule 8)
  return offers
```

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| candidate pool | `pool` | `{NewHero[], AbilityUpgrade[]}` | Formula F3 output | Deep-copied so draws consume a local working set |
| offer count | `offerCount` | int | `1–4` (Tuning Knobs, context-dependent) | How many non-Skip offers to draw |
| category weights | `w_new`, `w_upg` | float | default `0.5 / 0.5`, `offer_category_weights` knob | Zero-weight categories (empty remaining pool) are excluded and the remainder renormalized to sum `1.00` — the same structural-fallback shape as `run-structure-node-map.md` Rule 8's `Battle` fallback, generalized to two categories instead of one guaranteed one |
| category override | `categoryOverride` | enum \| null | `null` or `AbilityUpgrade` | Forces every slot to one category (Rest-node Train, Rule 11) |

**Output range:** `offers.length == min(offerCount, |pool.NewHero| +
|pool.AbilityUpgrade|) + 1` (the `+1` is the always-present `SkipOffer`) —
never pads with duplicates or fabricated offers when the pool is smaller
than `offerCount` (Edge Cases).

**Worked example (Reward node, `offerCount=3`, `w_new=w_upg=0.5`):** pool =
`{NewHero: [Warden, Twinblade], AbilityUpgrade: [(Vanguard,PushBoost),
(Vanguard,ExtraUse), (Striker,DamageBoost)]}`.
- `i=0`: `draw_cat=0.30` → weights `{NewHero:[0,0.5), AbilityUpgrade:
  [0.5,1.0)}` → `0.30` falls in `NewHero` → category=`NewHero`.
  `draw_item=0.10` → `rollChoice(0.10, [Warden, Twinblade]) =
  floor(0.10×2)=0` → **Warden**. `remaining.NewHero = [Twinblade]`.
- `i=1`: `draw_cat=0.85` → falls in `AbilityUpgrade` → category=
  `AbilityUpgrade`. `draw_item=0.50` →
  `rollChoice(0.50, [3 items]) = floor(0.50×3)=1` →
  **(Vanguard, ExtraUse)**. `remaining.AbilityUpgrade =
  [(Vanguard,PushBoost), (Striker,DamageBoost)]`.
- `i=2`: `draw_cat=0.20` → falls in `NewHero` (only `[Twinblade]` left) →
  `draw_item=0.99` → `rollChoice(0.99,[Twinblade])=floor(0.99×1)=0` →
  **Twinblade**.

Final offer set: `{Recruit Warden, Vanguard +Extra Use, Recruit Twinblade,
Skip}` — the player picks exactly one of these four.

### F5. Rest heal amount

`newHP(member) = min(member.maxHP, member.currentHP + ceil(member.maxHP ×
rest_heal_percent))`

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| member's chassis max | `member.maxHP` | int | ≥1 (`HeroDefinition.maxHP`, Heroes & Abilities) | Ceiling for the heal |
| current HP | `member.currentHP` | int | `[1, maxHP]` | Value before this Rest resolves |
| heal fraction | `rest_heal_percent` | float | `0.25–1.00` (Tuning Knobs, default `1.00`) | Fraction of `maxHP` restored |

**Output range:** `newHP ∈ [member.currentHP, member.maxHP]` — a heal can
never reduce HP and is always clamped at the chassis maximum. **Worked
example 1 (default, full heal):** Vanguard `maxHP=6, currentHP=2`
(badly wounded) → `newHP = min(6, 2 + ceil(6×1.00)) = min(6, 8) = 6` — full
heal regardless of how damaged the member was. **Worked example 2
(`rest_heal_percent=0.50`, a harder tuning):** same member →
`newHP = min(6, 2 + ceil(6×0.50)) = min(6, 5) = 5` — a genuine partial heal,
leaving real risk for the next fight.

### F6. Loadout validity check (and the "no deadlock" guarantee)

```
isValidLoadout(selection, roster):
  return |selection| == squad_size
     AND allDistinct(selection)
     AND all(m in selection: m in roster.members)
     AND all(m in selection: m.currentHP >= min_hp_for_deployment)
```

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| proposed selection | `selection` | RosterMember.id[] | any player-chosen subset | The Loadout being validated |
| squad size | `squad_size` | int | 2–5 (Heroes & Abilities knob, default 3) | Required exact selection size |
| deployment HP floor | `min_hp_for_deployment` | int | `1` (Tuning Knobs, default and recommended) | Minimum `currentHP` to be Loadout-eligible |

**Output:** boolean. **Proof of the "always satisfiable" guarantee:** the
Starting Roster Draft (Rule 4) guarantees `|roster.members| == squad_size`
at the run's very first decision point; Roster membership only ever grows
(Rule 5, never shrinks); every `RosterMember.currentHP` is structurally
floored at `1` for the whole run (Rule 3) and never removed. Therefore, at
the **default** `min_hp_for_deployment = 1`, `isValidLoadout` is satisfiable
by *any* `squad_size`-sized subset of the Roster at *every* point in the
run — a valid Loadout can never become impossible to form. **Worked
example:** `squad_size=3`, Roster has 5 members, all `currentHP ≥ 1` →
any 3 distinct members among the 5 form a valid Loadout; `C(5,3)=10`
distinct valid Loadout selections exist at this Roster size.

## Edge Cases

- **`buildCandidatePool`'s `NewHero` sub-list is empty** (Roster at
  `max_roster_size`, or every remaining `HeroDefinition` already recruited
  even below the cap): `w_new` is excluded and `w_upg` renormalizes to
  `1.00` (Formula F4) — every offer slot draws from `AbilityUpgrade`
  instead. This is the intended structural fallback, not a failure.
- **Both sub-lists are empty** (Roster at cap with every member's every
  slot either Filled or incompatible with every remaining
  `AbilityUpgradeDefinition` — a genuinely late-run, fully-built-out
  Roster): `generateOffers`'s loop breaks immediately (Formula F4); the
  offer set contains **only `SkipOffer`**. The node still resolves
  normally — the player picks the only legal option (`Skip`) and
  `resolveNode(nodeId, Completed)` still fires. This is a legal, if
  anticlimactic, terminal state for a maximally-built Roster, not an
  error.
- **`reward_offer_count` (or any `offerCount`) exceeds the candidate pool's
  total size:** `generateOffers` simply returns fewer non-Skip offers
  (Formula F4's output-range note) — it never pads with a duplicate or a
  fabricated invalid offer. E.g., if only 1 candidate remains total and
  `offerCount=3` is requested, the resulting set is `{that one candidate,
  Skip}` (2 total), not 4.
- **A `NewHeroOffer` and an `AbilityUpgradeOffer` for the same underlying
  `HeroDefinition`/member both appear in one offer set:** legal —
  `rollWithoutReplacement`-style drawing (Formula F4) only guarantees no
  two offers are the *literal same offer*, not that they can't reference
  related content; e.g., recruiting Warden and separately upgrading
  Vanguard's Push Distance can both appear in the same 3-offer set.
- **The player picks `SkipOffer` on the Starting Roster Draft's own offer
  set:** **not legal** — the Starting Draft (Rule 4) requires picking
  exactly `squad_size` distinct `NewHeroOffer`s from its
  `starting_offer_count` candidates; `SkipOffer` is not appended to this
  specific offer set, since a Roster of size `0` would violate Formula
  F6's "always satisfiable" guarantee at the very first decision point.
  This is the **one and only** Draft Offer context in this document where
  `Skip` is not offered — every other context (Reward, Rest/Train,
  post-Victory) always includes it (Rule 8).
- **Rest node's "Heal" choice when every Roster member is already at full
  `maxHP`:** `newHP` (Formula F5) is a no-op for every member — legal,
  matching this project's established "wasted but legal" precedent
  (Striker's empty ray in `heroes-and-abilities.md`, upgrade stacking past
  a cap in `ability-upgrades.md`). The node still consumes and resolves
  normally.
- **A `RosterMember`'s `Unit` ends a battle `Removed(Fell)` (displaced onto
  Lethal terrain, not merely reduced to 0 HP by `damage`):** the write-back
  to `RosterMember.currentHP` (Rule 3) is identical to the `Removed(Defeated)`
  case — clamped to `1`, never lower, never a special "permanently lost"
  branch. This document draws no mechanical distinction between the two
  `Unit`-level defeat causes at the Roster level.
- **A Battle/Elite node's battle ends in `Defeat` (the whole run ends,
  per `run-structure-node-map.md` Rule 15):** no HP write-back and no
  post-Victory offer screen occur — Rule 12 is scoped explicitly to
  terminal `Victory`; a `Defeat` routes directly to `run_completed(Defeat)`
  and this document has nothing further to do for that run.
- **Two runs share an identical `runSeed`** (a shared "daily seed," or a
  resumed session regenerating an in-progress offer screen): every draft
  event's offer set, at every `nodeId` (including `-1` for the Starting
  Draft), is byte-identical across both (Rule 16) — the draft-layer half of
  this project's reproducibility guarantee, alongside Run Structure's map
  and Encounter Generator's battles.
- **The player attempts to reconfigure the Loadout while a battle is
  `InTurn`:** rejected (Rule 6), identical gating and identical rationale
  to Ability Upgrades' Rule 12 slot-assignment gate — this is a defensive,
  programmer-error-class guard (the UI should never expose this control
  mid-battle), not a player-facing "why can't I do this."
- **`min_hp_for_deployment` is raised above `1` (a non-default tuning
  choice):** Formula F6's "always satisfiable" proof **no longer holds
  unconditionally** — it is now possible, in principle, for fewer than
  `squad_size` Roster members to meet the HP floor simultaneously,
  creating a real risk of a temporarily-unformable Loadout. This is
  flagged explicitly in Tuning Knobs as the reason `1` is the strongly
  recommended default, not merely a starting suggestion.

## Dependencies

**Upstream (Draft / Loadout Meta depends on):**

| System | Interface | Hard / Soft |
|---|---|---|
| **Heroes & Abilities** ✅ | `HeroDefinition` catalog; Loadout shape/validation (`squad_size`, no-duplicate invariant); `Deployed` seeding hook for `Unit.currentHP` (new requirement, Interactions section) | **Hard** |
| **Ability Upgrades** ✅ | Upgrade catalog; `isCompatible()`; the Upgrade Slot assignment/removal API | **Hard** |
| **Run Structure / Node Map** ✅ | Node-entry events (Reward/Rest); `battle_ended(Victory)` node-type context for post-Battle/Elite bonuses; the node graph as the space Draft events occur within | **Hard** |
| **Run Persistence** ✅ | `saveRun()`/`loadRun()` for Roster/Loadout/upgrade-slot payload | **Hard** |
| **Meta-progression / Unlocks** ✅ | `getUnlockedHeroIds()` (candidate-pool filter, Rule 17); `getStartingOfferCountBonus()` (Rule 4) | **Hard** |

**Downstream (systems that depend on Draft / Loadout Meta — status noted
per system):**

| Dependent System | Interface (what it uses) | Hard / Soft |
|---|---|---|
| **Run Structure / Node Map** ✅ | `resolveNode(nodeId, Completed)` callback; `rosterSnapshot` for `DifficultyConfig` assembly | **Hard** — matches `systems-index.md`'s declared direction ("Draft / Loadout Meta depends on … Run Structure / Node Map"), consumed from the other side per that document's own Interactions table |
| **Meta-progression / Unlocks** ✅ | Recruitment/upgrade-pick history, for unlock-eligibility bookkeeping | **Soft** |
| **Draft/Loadout UI** ✅ | Roster, Loadout, live `DraftOffer[]`/`RestChoice` state; pick/selection APIs | **Hard** |
| **Map/Run UI** ✅ | Roster summary for map-screen display | **Soft** |

**Bidirectional-consistency note:** `systems-index.md` lists Draft / Loadout
Meta as depending on Heroes & Abilities, Ability Upgrades, and Run
Structure / Node Map — consistent with the Upstream table above. This
document additionally surfaces two dependencies not currently reflected in
that index: **Run Persistence** (confirmed Hard, and already anticipated by
`run-persistence.md`'s own flagged gap) and **Meta-progression
/ Unlocks** (confirmed Hard, per Rule 17). See the "Bidirectional-consistency notes" paragraph at
the end of Interactions with Other Systems above for the full detail on
which prior documents' open gaps this document resolves.

## Tuning Knobs

| Knob | Default | Safe Range | Category | Too Low | Too High |
|---|---|---|---|---|---|
| `starting_offer_count` | 5 | `squad_size+1` to `squad_size+3` (4–6 at default `squad_size=3`) | Gate | At `squad_size+1` (4), the Starting Draft barely offers a real choice beyond the mandatory picks — the opening squad becomes near-deterministic, undercutting the "variety from move one" goal (Rule 4) | Above `squad_size+3` (6+), the very first decision the player makes — before any game-feel context from an actual battle — becomes an overwhelming menu, violating this project's onboarding convention of scaffolded, in-context teaching (`CLAUDE.md`) |
| `max_roster_size` | 7 | `squad_size` to `8` (3–8) | Gate | At `squad_size` (no bench at all), every recruited hero must immediately enter the Loadout — removes the "who's on the bench" decision entirely, and `NewHeroOffer`s become useless the instant the Roster fills, wasting draft slots | At `8` (the full v1 hero catalog, per `heroes-and-abilities.md`'s Open Question #7 "6-8 heroes" scope), "recruit everyone" becomes achievable every run, removing all scarcity from the `NewHero` category; also risks Draft/Loadout UI legibility (Pillar #5) with a long bench list |
| `reward_offer_count` | 3 | 2–4 | Curve | At `2`, Reward nodes feel stingy relative to their dedicated-screen status, weakening Pillar #3's "variety lives in the draft" promise | Above `4`, decision fatigue at every Reward node undermines the fast between-battle pacing `game-concept.md`'s session-level loop targets |
| `battle_victory_offer_count` | 1 | 0–2 | Curve | At `0`, a plain Battle victory grants literally nothing to decide — defeats the purpose of calling it a draft trigger at all (still legal, just a flat "no reward" tuning) | At `2`, a plain Battle's payoff approaches Elite's, erasing the risk/reward differentiation Elites exist to provide |
| `elite_victory_offer_count` | 3 | 2–5 | Curve | Below `2`, an Elite's extra risk isn't rewarded relative to a plain Battle, weakening the incentive to seek Elites out (Achiever/Explorer motivation, `game-concept.md`) | Above `5`, aggressive Elite-seeking can reach Ability Upgrades' field caps very early in a run, compressing the intended difficulty/power ramp too fast relative to Run Structure's tiered escalation |
| `offer_category_weights` (`w_new` / `w_upg`) | `0.5 / 0.5` | each `0.0–1.0`, sums to `1.00` | Curve | Skewing far toward `AbilityUpgrade` (e.g. `≤0.2` for `w_new`) makes Roster growth rare, starving the "which new verb did I get" Discovery/Expression beats | Skewing far toward `NewHero` (e.g. `≥0.8`) makes upgrades rare relative to recruits, weakening individual hero build identity (Ability Upgrades' whole Player Fantasy) |
| `rest_heal_percent` | 1.00 (100%) | 0.25–1.00 | Curve | Below `0.50`, Rest nodes stop reliably fulfilling the "guaranteed prep before the Boss" fairness promise `run-structure-node-map.md`'s `guarantee_rest_before_boss` knob explicitly exists to protect (Pillar #1) | N/A — hard-capped at `1.00` (Formula F5's `min(maxHP, …)` clamp); no value above 100% is meaningful |
| `min_hp_for_deployment` | 1 | 1 (**not recommended to raise**) | Gate | N/A at default — `1` is the floor Rule 3 already guarantees every member meets | **Do not raise without also redesigning the Roster-growth/HP-recovery rules** — Formula F6's "Loadout is always formable" proof depends structurally on this value equaling `1`; any higher value reintroduces a real risk of a temporarily-unformable Loadout (Edge Cases) |

**Interactions between knobs:**
- `max_roster_size` and `offer_category_weights`' `w_new` interact directly:
  once the Roster hits `max_roster_size`, `w_new` is forced to `0`
  regardless of its configured value (Formula F3/F4's structural fallback)
  — raising `w_new` late in a run at a full Roster has no effect, by
  design.
- `reward_offer_count`, `battle_victory_offer_count`, and
  `elite_victory_offer_count` should be tuned as a **relative** triple, not
  independently — their ordering (`Battle ≤ Reward ≤ Elite`, in the v1
  defaults `1 ≤ 3 ≤ 3`, or strictly `Battle < Elite`) is what encodes the
  risk/reward relationship between node types; breaking that ordering
  (e.g. `battle_victory_offer_count > elite_victory_offer_count`) would
  silently invert the intended incentive to seek out Elites.
- `rest_heal_percent` and `min_hp_for_deployment` jointly determine how
  "punishing" a bad Loadout HP state can become; both are deliberately
  kept at their safest defaults (`1.00` and `1` respectively) in v1, and
  should only be tuned together, with Formula F6's guarantee re-verified,
  if either is changed.

## Visual/Audio Requirements

- **Distinct iconography per offer category.** `NewHeroOffer`,
  `AbilityUpgradeOffer`, and `SkipOffer` must be immediately
  distinguishable at a glance on the offer screen — matching the
  "Legible Battlefield" Visual Identity Anchor's icon-driven principle
  extended from in-battle telegraphs to the meta layer; a player should
  never need to read body text to know *what kind* of offer they're
  looking at, only to evaluate its specific value.
- **Upgraded-ability badge reuse.** Any `RosterMember` with a filled
  upgrade slot must display the same upgraded-ability icon overlay
  `ability-upgrades.md`'s Visual/Audio Requirements already specifies for
  Battle HUD — this document does not introduce a second visual language
  for the same fact.
- **Persistent HP readout on the Roster/bench screen.** Because
  `RosterMember.currentHP` carries real, run-long stakes (Rule 3), every
  Roster member's current HP relative to `maxHP` must be visible wherever
  the Roster is shown (bench list, Loadout configuration, Rest-node
  choice screen) — a damaged hero must never look identical to a full-HP
  one outside of battle.
- **Rest node's Heal/Train choice must show its exact consequence before
  commit.** Per Pillar #1, selecting "Heal" must preview the exact
  post-heal HP for every Roster member (Formula F5); selecting "Train"
  must reveal its single generated offer (and Skip) before the choice is
  irreversibly applied — there is no hidden-value trade-off anywhere in
  this document's flow.
- **Audio hooks (owned by Audio System, ✅ Designed):** this document flags
  three distinct interaction moments needing distinct audio feedback —
  offer-screen reveal, pick confirmation, and Rest's Heal-vs-Train
  choice — matching the project's "crisp SFX for moves/telegraphs"
  audio direction extended to the meta layer (`game-concept.md`).

## UI Requirements

Full UI design is deferred to `ux-designer` (via `/ux-design` for a future
`design/ux/draft-loadout-screen.md`, per `systems-index.md`'s separately
tracked "Draft/Loadout UI" system). This document's contribution is the
data contract that UI must render against:

- A **Roster/bench screen** listing every `RosterMember` (portrait/class,
  current HP / maxHP, filled/empty upgrade slots) with a clear visual
  split between "in the active Loadout" and "benched."
- A **Loadout configuration screen**, reachable only from the map screen
  between nodes (never mid-battle, Rule 6), that enforces Formula F6's
  validity check live as the player toggles membership — an invalid
  in-progress selection (wrong count, or a duplicate) must be visibly
  blocked from confirming, not silently rejected after the fact.
- An **offer screen** (shared presentation for Reward-node, post-Battle/
  Elite-Victory, and Rest-node "Train" contexts) rendering the generated
  `DraftOffer[]` plus the always-present `Skip` option, with a single
  confirm-to-pick interaction (irreversible once confirmed, per this
  project's "committing action, not a preview" convention already
  established for node entry in `run-structure-node-map.md`).
- A **Rest choice screen** presenting exactly the two options (Heal /
  Train) with Heal's outcome (Formula F5, per-member) fully previewed
  before selection, per the Visual/Audio Requirements above.
- The **Starting Roster Draft screen** is a distinguished first-run variant
  of the offer screen: no `Skip` option (Edge Cases), and the UI must
  clearly communicate "pick exactly `squad_size`" as an ongoing counter
  (e.g., "2 of 3 selected") rather than a single-pick interaction, since
  this is this document's only multi-pick offer context.

## Acceptance Criteria

Pure, deterministic unit tests unless noted — no wall-clock time, no RNG
beyond the seeded stream, no rendering. Default knob values and the
reference kit table (Vanguard/Warden/Twinblade/Ember/Striker) from
`heroes-and-abilities.md` unless stated otherwise.

**RosterMember & persistent HP (Rules 2–3, Formula F6)**
- **GIVEN** a fresh run, **WHEN** the Starting Roster Draft resolves,
  **THEN** exactly `squad_size` `RosterMember`s exist, each at
  `currentHP == maxHP`, and the Roster equals the initial Loadout.
- **GIVEN** a `RosterMember` deployed into a battle with `currentHP = 4`
  (`maxHP = 6`), **WHEN** that battle's `Unit` ends the battle at
  `currentHP = 2` (damaged, still `Alive`), **THEN** the write-back sets
  `RosterMember.currentHP = 2` (Rule 3).
- **GIVEN** a `RosterMember` whose `Unit` ends a battle `Removed(Defeated)`
  or `Removed(Fell)`, **WHEN** the write-back occurs, **THEN**
  `RosterMember.currentHP` is clamped to exactly `1`, never `0` and never
  a `Removed`/`Lost` Roster-level state (Edge Cases).
- **GIVEN** any Roster state produced entirely by this document's rules,
  **THEN** every `RosterMember.currentHP` satisfies `1 ≤ currentHP ≤
  maxHP` at all times (invariant check across a randomized sequence of
  battle-outcome write-backs).

**Roster growth & recruitment (Rules 5, 8, 13)**
- **GIVEN** a Roster below `max_roster_size` and a resolved `NewHeroOffer`
  pick, **WHEN** it executes, **THEN** a new `RosterMember` is created at
  full `maxHP`, zero filled upgrade slots, and the Roster's member count
  increases by exactly 1.
- **GIVEN** a Roster already containing `HeroDefinition X`, **WHEN**
  `buildCandidatePool` (Formula F3) runs, **THEN** no `NewHeroOffer` for
  `X` ever appears in the resulting pool.
- **GIVEN** a Roster at exactly `max_roster_size`, **WHEN**
  `buildCandidatePool` runs, **THEN** `pool.NewHero` is empty and every
  generated offer set for that context draws exclusively from
  `AbilityUpgrade` (Formula F4's fallback).

**Loadout validity (Rule 7, Formula F6)**
- **GIVEN** the default `min_hp_for_deployment = 1` and any Roster of size
  `≥ squad_size`, **THEN** at least one valid Loadout selection exists
  (the "always satisfiable" guarantee).
- **GIVEN** a proposed selection with a duplicate `RosterMember.id`,
  **WHEN** `isValidLoadout` is checked, **THEN** it returns `false`.
- **GIVEN** a proposed selection of size `≠ squad_size`, **THEN**
  `isValidLoadout` returns `false`.
- **GIVEN** an attempt to reconfigure the Loadout while a battle is
  `InTurn`, **WHEN** requested, **THEN** it is rejected (Rule 6).

**Offer generation determinism (Rules 9, 16, Formulas F1–F4)**
- **GIVEN** identical `(runSeed, nodeId)` inputs, **WHEN** `generateOffers`
  is called twice (including across a simulated session resume), **THEN**
  both calls return byte-identical `DraftOffer[]` sets, in identical
  order.
- **GIVEN** the Formula F4 worked example's exact inputs (the stated pool,
  `offerCount=3`, draw sequence `0.30, 0.10, 0.85, 0.50, 0.20, 0.99`),
  **WHEN** `generateOffers` runs, **THEN** the result is exactly `{Recruit
  Warden, Vanguard +Extra Use, Recruit Twinblade, Skip}` (worked example,
  reproduced literally).
- **GIVEN** a candidate pool with fewer total items than the requested
  `offerCount`, **WHEN** `generateOffers` runs, **THEN** the result
  contains exactly `|pool| + 1` offers (every candidate, plus Skip) — never
  padded with a duplicate.
- **GIVEN** an empty candidate pool (both sub-lists empty), **WHEN**
  `generateOffers` runs, **THEN** the result is exactly `{Skip}`.

**Reward / Rest / post-Victory flows (Rules 10–12)**
- **GIVEN** a Reward node entered, **WHEN** the player picks a non-Skip
  offer, **THEN** that offer executes (Rule 13) and
  `resolveNode(nodeId, Completed)` fires exactly once.
- **GIVEN** a Reward node entered, **WHEN** the player picks `Skip`,
  **THEN** no Roster/Loadout mutation occurs and
  `resolveNode(nodeId, Completed)` still fires exactly once.
- **GIVEN** a Rest node entered and "Heal" chosen, **WHEN** resolved,
  **THEN** every Roster member's `currentHP` updates per Formula F5 and no
  offer screen is ever shown for this resolution.
- **GIVEN** a Rest node entered and "Train" chosen, **WHEN** resolved,
  **THEN** exactly one `AbilityUpgradeOffer` (plus `Skip`) is generated —
  never a `NewHeroOffer` — and the player's pick resolves exactly as a
  Reward-node pick.
- **GIVEN** a Battle-type node's battle reaches terminal `Victory`,
  **THEN** exactly `battle_victory_offer_count` offers (plus `Skip`) are
  generated automatically, before control returns to the map.
- **GIVEN** an Elite-type node's battle reaches terminal `Victory`,
  **THEN** exactly `elite_victory_offer_count` offers (plus `Skip`) are
  generated.
- **GIVEN** the Boss node's battle reaches terminal `Victory`, **THEN** no
  offer screen is generated at all (Rule 12) — verified by asserting
  `generateOffers` is never invoked for the Boss node under any Victory
  condition.

**Starting Roster Draft (Rule 4, Edge Cases)**
- **GIVEN** the Starting Roster Draft's offer set, **THEN** it contains
  exactly `starting_offer_count` `NewHeroOffer`s and **no** `SkipOffer`.
- **GIVEN** fewer than `squad_size` picks made from the Starting Draft,
  **WHEN** the player attempts to proceed to row 1, **THEN** it is
  rejected — exactly `squad_size` picks are required, no more, no fewer.

### Performance Budget (headless TS benchmarks, decoupled from render)

| Operation | Budget | Note |
|---|---|---|
| `buildCandidatePool` (Formula F3, `roster ≤ 8`, catalog ≤ 8 heroes, upgrade catalog ≤ ~20 defs) | < 1 ms | Bounded double loop over small, fixed-size v1 content catalogs |
| `generateOffers` (Formula F4, `offerCount ≤ 4`) | < 0.2 ms | 2 PRNG draws per slot plus a linear removal from a small candidate list |
| `isValidLoadout` (Formula F6) | < 0.05 ms | Set-membership and equality checks over `squad_size ≤ 5` items |
| Rest "Heal" full-roster resolution (Formula F5, `roster ≤ 8`) | < 0.1 ms | Linear pass, one clamp per member |

## Open Questions

**Needs an architecture decision (→ ADR during `/create-architecture`):**

1. **`RosterMember` vs. the now-published `Unit` record — the seeding hook
   still needs to land in `heroes-and-abilities.md`.** This document defines
   and claims the `RosterMember` schema (Rule 2) as the resolution to Heroes
   & Abilities' former Open Question #3 and Ability Upgrades' Open Question
   #2; the battle-scoped `Unit` record those documents reference is now
   formally published (`heroes-and-abilities.md`'s "Unit Record Schema",
   `cross-system-contracts.md` §6). What remains open is only the seeding
   contract between the two records: seed `Unit.currentHP` from
   `RosterMember.currentHP` at `Deployed` (instead of the currently-published
   `currentHP = maxHP`); write back at `battle_ended`. *Owner:* Tech
   architecture, coordinated with Heroes & Abilities' maintainers, to add
   the seeding hook to the published `Unit` record's `Deployed` transition.
2. **`battle_ended` event payload must carry node-type context.** Rule 12's
   differentiated offer counts (Battle vs. Elite vs. Boss) require whatever
   listens for `battle_ended(Victory)` to know *which* node type just
   completed — neither `turn-and-phase-manager.md` nor
   `objective-and-win-lose.md` currently documents this field on that
   event. *Proposed:* Run Structure / Node Map (which already knows the
   node type, per its own `MapNode.type` field) forwards it alongside the
   `battle_ended` event when it calls into this document, rather than this
   document inferring it independently. *Owner:* propagate to
   `run-structure-node-map.md` / `turn-and-phase-manager.md` maintainers.

**Resolved this session (provisional defaults — confirm during
implementation):**

3. **Persistent, non-lethal HP model** (Rule 3) — chosen over both "full
   reset every battle" and "true permadeath," specifically to give Rest
   nodes real stakes (resolving `run-structure-node-map.md`'s Open
   Question #8 naming of a "heal-vs-upgrade trade-off") while never
   creating a Loadout-deadlock risk (Formula F6's proof). Revisit only if
   playtesting shows persistent HP feels punishing without a
   corresponding narrative payoff.
4. **Boss Victory generates no offer screen** (Rule 12) — chosen because
   the run ends immediately and any granted offer would have no
   future battle to matter for. Revisit only if a future "New Game+" or
   post-run epilogue system wants a cosmetic-only final reward beat.
5. **Class tags carry no synergy bonus in v1** (Rule 14) — a deliberate
   scope line honoring Heroes & Abilities' own provisional note on the
   subject.

**Deferred to the owning system's GDD:**

6. **Event-node content and resolution.** Entirely out of this document's
   scope — owned by a future, currently entirely-undesigned
   narrative/event-content system, per `run-structure-node-map.md` Rule
   12's own scope line.
7. **`PilotOffer` / Pilots integration — RESOLVED 2026-07-28.** `pilots.md`
   is now Designed and `PilotOffer` is active in the `DraftOffer` union
   (Rule 8), gated by that document's Formula F5. `RosterMember` carries
   `pilotId` (Rule 3a). What remains open there, not here: whether a
   `PilotOffer` needs any decline handling beyond the structural `SkipOffer`
   (`pilots.md` Open Question #5) — verify with `/consistency-check`.
8. **Respec / upgrade-removal-for-refund mechanics.** Deferred entirely to
   `ability-upgrades.md`'s own Open Question #8 — this document assumes
   upgrade assignment via `AbilityUpgradeOffer` is one-directional and
   permanent for the run, matching that document's current scope.
9. **Meta-progression / Unlocks' exact catalog-gating mechanics.** This
   document's Rule 17 only guarantees a filtering seam exists; the actual
   unlock rules, currency, or criteria are entirely Meta-progression /
   Unlocks' concern (✅ Designed — see `meta-progression-and-unlocks.md`).
10. **Draft/Loadout UI's exact screen flow and transition/animation
    treatment.** Flagged throughout Visual/Audio Requirements and UI
    Requirements above; owned by `ux-designer` via a future
    `design/ux/draft-loadout-screen.md`.
