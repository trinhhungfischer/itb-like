# Ability Upgrades

> **Status**: In Design
> **Author**: workflow (design-system fan-out)
> **Last Updated**: 2026-07-27
> **Implements Pillar**: #3 Variety Lives in the Draft, Not the Dice; #2 Positioning Over Power; #4 Every Hero Is a Verb

## Overview

Ability Upgrades is the between-battle progression layer that lets the player
permanently strengthen a specific hero's signature verb across a run — the
mechanical home of Pillar #3's promise that all variety lives in the draft,
never in battle RNG. It defines a small, closed catalog of upgrade
**categories** (Damage Boost, Extra Use, Push Distance Boost, Immunity),
a per-hero **Upgrade Slot** model, and the deterministic **additive-delta**
resolution function that Heroes & Abilities' `compileEffects()` (that
document's Formula F5) must consult when binding an ability's effect chain.
This system does not decide *when* or *how* an upgrade is offered to the
player — that is Draft / Loadout Meta's job (✅ Designed) — it only defines
what an upgrade *is*, what it can legally target, how multiple upgrades
combine, and the exact runtime contract that makes an upgraded ability's
preview and resolution just as trustworthy as an un-upgraded one (Pillar #1).

## Player Fantasy

**"My Vanguard isn't just *a* shove anymore — it's *my* shove, built the way
I chose."** Where Heroes & Abilities gives every hero a legible, unchanging
verb, Ability Upgrades is where that verb becomes personal: the player's
run-long investment turns a generic Shove into a two-tile-further, ally-safe
signature move that only exists because of the choices they made between
battles. This directly serves **Pillar #3 (Variety Lives in the Draft, Not
the Dice)** — every point of power growth is a deterministic, player-chosen
delta, never a random roll — and reinforces **Pillar #2 (Positioning Over
Power)**, since three of the four upgrade categories (Extra Use, Push
Distance Boost, Immunity) amplify *what a verb can do to the board*, not raw
damage. It also protects **Pillar #4 (Every Hero Is a Verb)**: an upgrade
never gives a hero a second, unrelated ability or turns a positioning hero
into a damage hero — it only intensifies the one verb the hero already has.
The failure state of this system is an upgrade that reads as a generic "+X%
stronger" stat stick (undermining Pillar #4's verb identity) or a stack of
upgrades so numerous the player can no longer read a hero's effective
capability in ten seconds (breaking Pillar #5) — both are guarded against
below via strict per-field clamps and a deliberately small slot count.

## Detailed Design

### Core Rules

1. **Ownership boundary.** Ability Upgrades owns: the `AbilityUpgradeDefinition`
   schema and its four-category catalog, the per-hero **Upgrade Slot** model,
   the deterministic `effectiveAbility()` resolution function (Formula F1),
   the Extra-Use cast-sequence rule (Formula F2), and the
   ally-damage-immunity effect filter (Formula F3). It does **not** own: the
   hero chassis or base `AbilityDefinition` content (Heroes & Abilities), how
   or when upgrades are offered/drafted, upgrade rarity or currency cost
   (Draft / Loadout Meta, ✅ Designed), or how upgrade assignments persist
   across sessions (Run Persistence, ✅ Designed). This document defines *what
   an upgrade is and does*; it never decides *whether the player gets one*.
2. **Upgrade Slot model — global, uniform slot count.** Every hero in the
   active Loadout has exactly `upgrade_slots_per_hero` (Tuning Knobs, default
   **2**) Upgrade Slots. This is a **global** tuning knob applied identically
   to every hero — not a per-hero chassis field — so that a player comparing
   two heroes' upgrade investment always compares the same number of slots,
   directly serving Pillar #5 (Read in Ten Seconds): the roster is never
   asymmetric in a way that requires memorizing which hero has how many
   slots.
3. **`AbilityUpgradeInstance` occupies a slot.** Each Upgrade Slot holds `0`
   or `1` `AbilityUpgradeInstance` — a concrete, assigned copy of an
   `AbilityUpgradeDefinition` bound to one hero. A slot's state is `Empty` or
   `Filled(instance)` (States and Transitions). There is no partial-fill or
   fractional-upgrade concept.
4. **`AbilityUpgradeDefinition` schema.** Every catalog entry declares:
   `id`, `name`, `category` (one of the four below), `targetField` (which
   field of the hero's `AbilityDefinition` or its `effectTemplate` steps it
   modifies), and either `delta` (int, for the three numeric categories) or
   `immunityType` (enum, for Immunity). A definition is **stateless,
   reusable content** — many `AbilityUpgradeInstance`s across the roster can
   reference the same `AbilityUpgradeDefinition` (e.g., two different heroes
   can each hold their own "+1 Push Distance" instance).
5. **Category A — Damage Boost.** `targetField = "amount"` on a `damage` step
   within the hero's `effectTemplate`. Compatible **only** with abilities
   whose `effectTemplate` contains at least one `damage` primitive with a
   numeric `amount` parameter (e.g., Striker's Piercing Round). Incompatible
   with abilities that carry no authored `damage` step (Vanguard's Shove,
   Warden's Anchor Pull, Twinblade's Blink Swap, Ember's Firebrand's
   `spawnHazard`/`applyHazard` pair — none of these author a `damage` step
   directly).
6. **Category B — Extra Use.** `targetField = "usesPerTurn"` (the field
   Heroes & Abilities' Rule 15 already defines on every `AbilityDefinition`,
   shipping at `1` in the v1 base roster). Compatible with **every** ability,
   since `usesPerTurn` exists universally. Granting Extra Use does **not**
   add a second Ability slot to the hero's turn (Heroes & Abilities' Rule 4
   fixes `actions_per_hero_turn = 2` as a structural, non-upgradeable
   invariant) — instead, it allows **multiple consecutive casts within one
   Ability-slot activation** (Formula F2). This is the load-bearing design
   choice that lets "extra use" exist as real, meaningful power without
   contradicting Heroes & Abilities' explicit note that raising `A_max`
   "would need a second, distinct Ability slot design, not a value change."
7. **Category C — Push Distance Boost.** `targetField = "distance"` on a
   `push` or `pull` step within the `effectTemplate`. Compatible only with
   abilities whose `effectTemplate` contains a `push` or `pull` primitive
   (Vanguard's Shove, Warden's Anchor Pull). Incompatible with abilities that
   never displace a unit (Twinblade's Swap moves units but does not use the
   `push`/`pull` primitive — see Edge Cases; Striker's damage-only Line;
   Ember's hazard-only Firebrand).
8. **Category D — Immunity.** Two v1 subtypes, both attached to the **hero
   instance** rather than a specific `effectTemplate` step:
   - **`hazardImmune(hazardType)`** — the hero no longer takes damage from
     the named hazard type (`Fire` is the only v1 hazard type Combat
     Resolution's Formula F3 concretely specifies) via either hazard-on-entry
     or an Environment-phase tick. Compatible with any hero (it is a
     defensive trait independent of the hero's own ability).
   - **`allyDamageImmune`** — `damage` steps in the hero's own
     `effectTemplate` that would resolve against an ally are suppressed
     (Formula F3). Compatible only with abilities whose `effectTemplate`
     contains a `damage` step **and** whose `targetFilter` can legally
     select an `Ally`/`AnyUnit` target (per Heroes & Abilities Rules 9/14) —
     otherwise the upgrade would be a "dead" pick with nothing to suppress.
     **This subtype does not cover `collision_damage`** generated
     internally by Combat Resolution's push/pull algorithm, nor does it
     prevent an ally from being displaced onto Lethal terrain and
     `Removed(Fell)` — see Edge Cases and Open Questions for the precise,
     deliberate scope boundary.
9. **Compatibility validation.** Ability Upgrades exposes
   `isCompatible(ability, upgradeDefinition) -> bool`, evaluated per Rules
   5–8's per-category predicates above. Assigning an incompatible upgrade to
   a hero's slot is rejected outright by this document's assignment API
   (Edge Cases) — Draft / Loadout Meta must call `isCompatible` before ever
   presenting an upgrade as an offer for a given hero, so the player is never
   shown a choice that would silently do nothing.
10. **Stacking within a category.** Multiple instances of the **same**
    category assigned to the **same** hero's different slots stack
    **additively** on the same `targetField`, then are **clamped** to a
    global safety ceiling (Formula F1, Tuning Knobs). Different categories
    never interact with each other — Damage Boost, Extra Use, and Push
    Distance Boost each modify an independent field, and Immunity is a
    separate boolean/set property, not a numeric field at all.
11. **`effectiveAbility()` is the single source of truth for upgraded
    behavior.** Heroes & Abilities' `compileEffects(caster, ability,
    selectedTarget)` (that document's Formula F5) must, for any hero with
    active upgrades, first resolve `effectiveAbility(hero) ->
    AbilityDefinition` (Formula F1/F3, this document) and compile against
    the **effective** definition, not the hero's raw chassis-authored
    `AbilityDefinition`. `effectiveAbility()` is pure and deterministic:
    identical `(hero, upgrades)` inputs always produce an identical effective
    definition, so Move Preview — which calls `compileEffects()` exactly as
    the real commit does — always shows the true, upgraded consequence
    before the player commits (Pillar #1). There is no separate "preview
    math" for upgraded vs. base abilities.
12. **Assignment/removal is a run-level action, not an in-battle one.**
    Upgrade Slot contents may only be changed while no battle is in the
    `InTurn` battle-level state (`turn-and-phase-manager.md`'s
    `Setup → InTurn → Ended` battle states) — in practice, exclusively
    through Draft / Loadout Meta's between-battle interface. Once a battle's
    `Setup` battle-state begins, every deployed hero's `effectiveAbility()`
    is resolved once and held fixed for that battle's entire duration; there
    is no mechanism to re-roll or reassign upgrades mid-battle.
13. **Upgrade instances persist with the hero, not the per-battle Loadout
    selection.** An `AbilityUpgradeInstance` assigned to a hero remains
    assigned across the whole run — including battles where that hero is
    benched from the active Loadout — and is lost only if the run itself
    ends or an explicit future "respec" action (not designed here) removes
    it. The exact persistent record this attaches to — a "roster member" /
    "hero instance" identity distinct from the battle-scoped `Unit` record
    (now formally defined in `cross-system-contracts.md` §6) — is the
    **`RosterMember`** owned by Draft / Loadout Meta (✅ Designed,
    `draft-and-loadout-meta.md` Rule 2), which explicitly resolves this
    note (see Open Questions).

### States and Transitions

**Upgrade Slot state** (per hero instance, per slot index):

`Empty ↔ Filled(AbilityUpgradeInstance)`

| Transition | Trigger | Legal when |
|---|---|---|
| `Empty → Filled` | Draft / Loadout Meta assigns a compatible upgrade instance | No battle in `InTurn` state (Rule 12) |
| `Filled → Empty` | Draft / Loadout Meta removes/replaces an instance | No battle in `InTurn` state (Rule 12) |
| `Filled(A) → Filled(B)` | Direct swap, modeled as remove-then-assign in the same run-level transaction | No battle in `InTurn` state (Rule 12) |

**Effective-ability resolution state** (per `effectiveAbility()` call):
`Uncomputed → Resolved(AbilityDefinition)`. Stateless and idempotent, mirroring
Heroes & Abilities' `compileEffects()` state model — the same
`(baseAbility, activeUpgrades)` input always yields the same effective
definition, computed fresh on every call (e.g., once per HUD refresh, once
per Move Preview hover-frame) with no caching side effects required.

**Battle-scoped freeze** (per battle, per deployed hero): at battle `Setup`,
`effectiveAbility(hero)` is resolved and treated as fixed input for every
subsequent `compileEffects()` call that battle — this is not a new state
machine, but a usage contract: Upgrade Slot mutation is illegal (Rule 12) for
the whole `InTurn` duration, so the resolved value cannot drift mid-battle
even though the function itself is always re-computable.

### Interactions with Other Systems

Ability Upgrades is a **modifier layer**: it never resolves an effect itself
and never mutates the board — it only changes what Heroes & Abilities'
compiler reads before it compiles.

| System | Reads from Ability Upgrades | Ability Upgrades reads / calls | Ownership boundary |
|--------|-------------------------------|-----------------------------------|---------------------|
| **Heroes & Abilities** ✅ | `effectiveAbility(hero)` (F1/F3) — consulted inside `compileEffects()` (that document's F5) before binding; `isCompatible()` for validating upgrade offers | `AbilityDefinition` schema, `effectTemplate` step types, `usesPerTurn` field (Rule 15) | Heroes & Abilities owns the base verb; Ability Upgrades owns the deterministic delta layered on top — it never redefines the schema itself |
| **Combat Resolution** | — (no direct call) | Indirectly, via the compiled `EffectPrimitive[]` Heroes & Abilities produces from the effective ability | **New requirement flagged, not yet in that document's contract:** `applyHazard` and every hazard-on-entry call site (within `push`/`pull`/`swap`/Move) must check a per-unit `hazardImmunities` set before applying tick/entry damage — see Open Questions. Combat Resolution's `push`/`pull` collision algorithm is **not** modified by this document; `collision_damage` remains outside Ability Upgrades' reach (Rule 8, Edge Cases) |
| **Draft / Loadout Meta** ✅ | `isCompatible(ability, upgradeDefinition)`, the full upgrade catalog, per-hero slot state (Empty/Filled) | Writes/removes `AbilityUpgradeInstance`s into hero slots via this document's assignment API (Rule 12) | Draft owns *when/how/at what cost* an upgrade is offered and chosen; Ability Upgrades owns what a chosen upgrade *does* once assigned |
| **Run Persistence** ✅ | Per-hero Upgrade Slot contents, to serialize/restore across sessions | — | Run Persistence must treat Upgrade Slot state as part of the run's save payload; this document defines the shape, not the storage mechanism |
| **Move Preview** | `effectiveAbility(hero)` transitively, via Heroes & Abilities' `compileEffects()` — no direct call into this document | — | Preview never queries Ability Upgrades directly; it inherits upgraded behavior automatically because it calls the same `compileEffects()` entry point real resolution uses |
| **Battle HUD** | Equipped upgrade icons per hero, effective vs. base numeric values (e.g., "Push 2 → 4"), Upgrade Slot Empty/Filled state | — | Read-only consumer |
| **Board Rendering & Juice** | Ability-icon overlay indicating an upgraded verb (Visual/Audio Requirements) | — | Read-only consumer |
| **Meta-progression / Unlocks** ✅ | — | May gate which `AbilityUpgradeDefinition`s exist in the catalog at all (soft — this document does not require it) | Meta-progression owns catalog unlock state, if any; Ability Upgrades' catalog is authored content this document's schema can express regardless of unlock status |
| **Pilots** ✅ | — | — | **No overlap, and the boundary is now firmer than originally stated.** The earlier note claimed Pilots owns chassis fields (`maxHP`, `moveRange`) — that lane actually belongs to **Passive Modules** (T1 Pathfinder, S2/S3 Walkers, S4 Last Stand). `pilots.md` Core Rule 5 restricts Pilots to action-slot economy, deployment, and run-level effects, and explicitly forbids it from touching any `AbilityDefinition` field. The two systems are disjoint by construction, not by coincidence |

**Bidirectional-consistency note:** `heroes-and-abilities.md` already lists
Ability Upgrades as a **Hard** downstream dependent (interface: "Reads/
overrides `AbilityDefinition` fields — range, per-ability `distance`/`amount`
parameters, `cooldownTurns`") and explicitly defers "the exact override
mechanics (does an upgrade replace a field or add a delta?)" to this
document's own GDD (its Open Question #10). **This document resolves that
question: upgrades apply as an additive delta with a per-field clamp, never
a field replacement** (Rule 10, Formula F1). `systems-index.md` lists Ability
Upgrades as depending only on Heroes & Abilities — consistent with the
Upstream relationship above; this document additionally surfaces a new,
previously-unlisted soft requirement on Combat Resolution (hazard-immunity
checking) that should be propagated to that document's maintainers.

## Formulas

All formulas are deterministic (no RNG, no time-dependence). Examples use the
reference kit table from `heroes-and-abilities.md` (Vanguard, Warden,
Twinblade, Ember, Striker) and this document's default Tuning Knob values.

### F1. Effective Numeric Parameter (additive delta + clamp)

```
effectiveValue(baseValue, activeUpgrades, targetField):
  matching = [u for u in activeUpgrades if u.category in {DamageBoost, PushDistanceBoost, ExtraUse}
                                          and u.targetField == targetField]
  raw = baseValue + sum(u.delta for u in matching)
  return clamp(raw, fieldMin[targetField], fieldCap[targetField])
```

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| base value | `baseValue` | int | ability-defined (Heroes & Abilities Tuning Knobs) | The hero's chassis-authored `AbilityDefinition` value before any upgrade |
| active upgrades | `activeUpgrades` | `AbilityUpgradeInstance[]` | 0 to `upgrade_slots_per_hero` | All non-empty slots for this hero |
| target field | `targetField` | enum | `{amount, distance, usesPerTurn}` | Which numeric field is being resolved |
| per-instance delta | `u.delta` | int | +1 to +2 (Tuning Knobs) | Authored per `AbilityUpgradeDefinition` |
| field floor | `fieldMin[targetField]` | int | `amount`≥0, `distance`≥0, `usesPerTurn`≥1 | Structural minimum, never violated regardless of clamp knob values |
| field ceiling | `fieldCap[targetField]` | int | `amount`≤5, `distance`≤4, `usesPerTurn`≤2 (Tuning Knobs defaults) | Global safety ceiling — prevents unbounded stacking from breaking Pillar #2/#5 |

**Output range:** `effectiveValue ∈ [fieldMin[targetField], fieldCap[targetField]]`.
Because the clamp is applied *after* summation, additional stacked upgrades
beyond the cap are legal to hold but have **zero further numeric effect**
(Edge Cases) — this is a deliberate soft-limit, not a hard validation
rejection at assignment time (Rule 10).

**Worked example 1 (single Push Distance Boost):** Vanguard's Shove has
`baseValue = 2` (its `push` step's `distance` parameter, per the reference
kit table). One `PushDistanceBoost` instance (`delta = +1`) is assigned.
`effectiveValue(2, [boost], "distance") = clamp(2+1, 0, 4) = 3`. Move Preview
now shows the Shove displacing 3 tiles instead of 2.

**Worked example 2 (stacking above the cap):** the same Vanguard later gains
a *second* `PushDistanceBoost` instance (`delta = +1`) in their remaining
slot. `effectiveValue(2, [boost, boost], "distance") = clamp(2+1+1, 0, 4) =
4` (not 5) — the cap silently absorbs the second point of delta. The player
still "owns" both upgrade instances (they are not destroyed or refunded),
but the second one is contributing nothing further to this field.

**Worked example 3 (Extra Use):** Striker's Piercing Round has
`baseValue = 1` for `usesPerTurn` (Heroes & Abilities Rule 15's v1 default).
One `ExtraUse` instance (`delta = +1`) is assigned:
`effectiveValue(1, [extraUse], "usesPerTurn") = clamp(1+1, 1, 2) = 2` —
Striker may now fire Piercing Round twice within one Ability-slot activation
(Formula F2).

### F2. Extra-Use Cast Sequence

```
resolveAbilitySlotActivation(hero, ability):
  usesRemaining = effectiveValue(ability.usesPerTurn, hero.upgrades, "usesPerTurn")  # F1
  castsPerformed = 0
  while usesRemaining > 0:
    targets = legalTargets(hero, effectiveAbility(hero), board)   # Heroes & Abilities F2, effective def
    if targets == ∅ and castsPerformed >= 1:
      break   # no further mandatory casts; extra casts are optional, not forced
    if targets == ∅ and castsPerformed == 0:
      break   # ability slot is simply not offered this turn (Heroes & Abilities Edge Cases)
    selection = playerChoosesOrDeclines(targets)
    if selection == Decline:
      break   # player may stop early even with uses remaining
    effects = compileEffects(hero, effectiveAbility(hero), selection)  # Heroes & Abilities F5
    resolve(board, effects)   # Combat Resolution
    castsPerformed += 1
    usesRemaining -= 1
  hero.abilitySlot = Used   # flips exactly once, after the activation sequence ends, regardless of castsPerformed
```

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| hero | `hero` | Unit + upgrade state | `Alive` | The acting hero, with resolved upgrade slots |
| effective uses | `usesRemaining` | int | `[1, uses_per_turn_cap_with_upgrades]` (F1) | How many casts this activation may perform |
| casts performed | `castsPerformed` | int (output) | `[0, usesRemaining]` | Actual casts executed this activation |
| per-cast target selection | `selection` | unitId \| tile \| direction | member of `legalTargets` at the board state *at that cast* | Recomputed after each prior cast resolves, per Heroes & Abilities' Rule 7 "recompute at selection time" precedent |

**Output range:** `castsPerformed ∈ [0, usesRemaining]`. The Ability slot
transitions to `Used` exactly once per activation regardless of how many of
the available uses were actually spent — an Extra-Use hero who casts only
once (targets ran out, or the player declined the second cast) still
consumes their single Ability slot for the turn, identical to a
non-upgraded hero (Heroes & Abilities Rule 4 has no "refund on partial use"
clause, and this document does not add one).

**Worked example:** Striker (effective `usesRemaining = 2`, Formula F1 above)
fires Piercing Round East, hitting one enemy at cast 1
(`castsPerformed = 1`). The board state after cast 1 is used to recompute
`legalTargets` for cast 2; the player chooses South this time, hitting a
different enemy (`castsPerformed = 2`, `usesRemaining` reaches 0). The
Ability slot flips to `Used` once, after both casts. If instead no enemies
remained in any direction after cast 1, the loop breaks at
`castsPerformed = 1` and the slot still flips to `Used` — the second use is
forfeited, not banked or refunded.

### F3. Ally-Damage-Immune Effect Filtering

```
filterAllyDamage(compiledEffects, caster, hero):
  if not hasImmunity(hero, "allyDamageImmune"):
    return compiledEffects
  return [ e for e in compiledEffects
           if not (e.primitive == "damage" and isAlly(e.targetId, caster)) ]
```

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| compiled effects | `compiledEffects` | `EffectPrimitive[]` | output of Heroes & Abilities F5 | The ability's already-bound effect chain, before it is handed to `resolve()` |
| caster | `caster` | Unit | `Alive` | The hero whose immunity is being checked |
| immunity flag | `hasImmunity(hero, "allyDamageImmune")` | bool | — | True iff any of the hero's Filled slots holds an `allyDamageImmune` instance |
| ally check | `isAlly(targetId, caster)` | bool | — | True iff `targetId`'s faction matches `caster`'s faction (both heroes) |

**Output range:** a subset of `compiledEffects`, same or shorter length;
never longer. **This filter runs on `compileEffects()`'s output, which only
ever contains primitives the ability's `effectTemplate` explicitly
authored** — it cannot and does not touch `collision_damage`, because that
`damage` call is generated *internally*, mid-resolution, by Combat
Resolution's push/pull algorithm (`combat-resolution.md` Formula F2), never
appearing in the compiled list this filter operates on (Edge Cases, Open
Questions).

**Worked example:** a hypothetical future hero's ability compiles to
`[push(allyId, S, 2), damage(allyId, 2)]` (a "shove and singe" combo
targeting an ally under `AnyUnit`). With `allyDamageImmune` active,
`filterAllyDamage` returns `[push(allyId, S, 2)]` — the ally is still shoved
(a pure positioning consequence), but takes no direct `damage`. If that
shove then collides with a wall, the resulting `collision_damage` still
applies in full — Combat Resolution generates it independently of this
filtered list.

## Edge Cases

- **An incompatible upgrade is assigned to a hero** (e.g., Damage Boost
  offered to Twinblade's Blink Swap, which has no `damage` step):
  `isCompatible()` returns `false` and the assignment API rejects the
  request outright — no slot state changes, no partial application. This is
  a hard validation failure, not a silent no-op, so Draft / Loadout Meta's
  own bug (offering an incompatible upgrade) is caught immediately rather
  than producing a "dead" equipped item.
- **Stacking two same-category upgrades past the field cap** (Formula F1,
  Worked Example 2): both instances remain equipped and owned by the player,
  but the second contributes zero further numeric effect. This is
  intentional (a soft cap, not a hard rejection) so that future catalog
  rebalancing (raising `fieldCap`) can retroactively "unlock" value on
  already-equipped upgrades without requiring any re-assignment.
- **Extra Use with zero legal targets on the second (or later) cast:** the
  activation loop (Formula F2) breaks cleanly; the Ability slot still flips
  to `Used` after the first successful cast. This is distinct from the
  zero-legal-targets-on-the-very-first-cast case, where the Ability slot is
  never offered at all (Heroes & Abilities Edge Cases) — Extra Use only
  changes behavior for casts *after* the first.
- **Extra Use on a multi-target shape (`Line`/`Area`):** each cast within
  the activation is a full, independent target/direction selection that
  itself may compile to multiple `EffectPrimitive`s per Heroes & Abilities'
  Rule 12 (one primitive per qualifying unit). Extra Use multiplies the
  *number of casts*, not the *per-cast target count* — a Striker with
  Extra Use fires two separate rays (potentially two different directions),
  each independently hitting however many units that ray finds; it does not
  turn one ray into a double-damage ray.
- **`allyDamageImmune` and a push that ends in `collision_damage` against an
  ally:** **not suppressed.** Formula F3 only filters primitives present in
  the ability's own compiled `effectTemplate` output; `collision_damage` is
  generated internally by Combat Resolution's push/pull collision algorithm
  and never appears in that list. A friendly-fire-immune Vanguard who shoves
  an ally into a wall still deals full `collision_damage` to that ally. This
  is a genuine, documented scope limitation (Open Questions), not an
  oversight.
- **`allyDamageImmune` and an ally displaced onto Lethal terrain:** **not
  suppressed.** Being `Removed(Fell)` is a consequence of Combat Resolution's
  displacement algorithm entering a `Lethal` tile (that document's Formula
  F2), not a `damage` primitive — Formula F3 has nothing to filter. A
  friendly-fire-immune hero can still accidentally shove an ally into a
  Chasm and kill them exactly as a non-immune hero could.
- **`hazardImmune(Fire)` and the hero enters a Fire tile via forced
  displacement (hazard-on-entry):** the immunity applies identically to a
  standard Environment-phase tick — both call sites must consult the same
  per-unit `hazardImmunities` set (Open Questions' Combat Resolution
  requirement). There is no v1 case where hazard-on-entry damage is immune
  but tick damage is not, or vice versa, for the same hazard type.
- **A hero has no Upgrade Slots filled at all (the common early-run case):**
  `effectiveAbility(hero) == hero.ability` exactly — `effectiveValue` (F1)
  reduces to `clamp(baseValue, fieldMin, fieldCap)`, which is a no-op for
  every base v1 reference-kit value (all already within their field's
  default cap). An un-upgraded hero behaves byte-identically to Heroes &
  Abilities' own specification.
- **The same `AbilityUpgradeDefinition` catalog entry is instantiated onto
  two different heroes:** legal and independent — `AbilityUpgradeDefinition`
  is reusable content (Rule 4); each hero holds its own
  `AbilityUpgradeInstance`, and clamping/stacking is evaluated per-hero, per
  `targetField`, never shared across the roster.
- **An `ExtraUse` instance is assigned to a hero, then removed by Draft /
  Loadout Meta between battles, then the hero is deployed into the next
  battle:** `effectiveAbility()` is re-resolved fresh at that battle's
  `Setup` (Rule 12) — there is no stale caching of a previous battle's
  effective value; removal takes full effect starting with the very next
  battle the hero is deployed in.
- **Attempting to assign or remove an upgrade while a battle is in the
  `InTurn` state:** rejected by the assignment API (Rule 12) — this is a
  hard contract violation for whichever system attempts it (only Draft /
  Loadout Meta should ever call this API, and only from its own
  between-battle screens), not a state the player can normally trigger.
- **`Push Distance Boost` assigned to Twinblade's Blink Swap:** rejected —
  `swap` is a distinct primitive from `push`/`pull` (Combat Resolution Rule
  6: "Swap ignores intermediate tiles... it is not resolved via the
  step-by-step collision algorithm"), so Blink Swap's `effectTemplate` has
  no `distance` field for this category to target. This is the same
  incompatibility class as Rule 8's first bullet, called out explicitly
  because "swap moves a unit" can be mistaken for "swap is push/pull-like."

## Dependencies

**Upstream (Ability Upgrades depends on):**

| System | Interface | Hard / Soft |
|--------|-----------|--------------|
| **Heroes & Abilities** ✅ | `AbilityDefinition` schema, `effectTemplate` step structure, `usesPerTurn` field, `compileEffects()`/`legalTargets()` (F5/F2) which must be extended to consult `effectiveAbility()` before binding | **Hard** |

**Downstream (systems that depend on Ability Upgrades — status noted per
system):**

| Dependent System | Interface (what it uses) | Hard / Soft |
|-------------------|---------------------------|--------------|
| **Draft / Loadout Meta** ✅ | `isCompatible()`, the upgrade catalog, the Upgrade Slot assignment/removal API | **Hard** |
| **Run Persistence** ✅ | Per-hero Upgrade Slot contents as serializable save data | **Hard** |
| **Combat Resolution** ✅ (existing system, new requirement) | Per-unit `hazardImmunities` set must be checked inside `applyHazard` and every hazard-on-entry call site | **Soft today, proposed Hard** — flagged for propagation, not yet reflected in `combat-resolution.md`'s own contract |
| **Move Preview** ✅ | Inherits upgraded behavior transitively via Heroes & Abilities' `compileEffects()` — no direct interface | **Soft** (indirect) |
| **Battle HUD** ✅ | Equipped-upgrade display, effective-vs-base numeric readouts | **Soft** |
| **Board Rendering & Juice** ✅ | Ability-icon "upgraded" overlay indicator | **Soft** |

**Bidirectional-consistency note:** see the Interactions with Other Systems
section above — `heroes-and-abilities.md` already lists Ability Upgrades as
a Hard downstream dependent and explicitly defers the delta-vs-replace
question to this document, which is now resolved (Rule 10, Formula F1).
`systems-index.md`'s dependency row for Ability Upgrades lists only Heroes &
Abilities as an upstream dependency, consistent with the table above; the
new soft requirement this document surfaces on Combat Resolution should be
propagated via `/consistency-check` since that document does not currently
list Ability Upgrades anywhere in its own Dependencies section.

## Tuning Knobs

| Knob | Default | Safe Range | Category | Too Low | Too High |
|------|---------|-----------|----------|---------|----------|
| `upgrade_slots_per_hero` | 2 | 1–3 | Gate | At `1`, a hero can only ever express one upgrade choice for the entire run — thin build expression, weakens Pillar #3's "variety lives in the draft" promise | At `3+`, a single hero can stack three modifiers simultaneously, making its effective stat block harder to read at a glance during a multi-hero turn plan (Pillar #5); also increases Draft / Loadout Meta's economy pressure (more currency/offers needed per hero to "complete" a build) |
| `damage_boost_delta` (per instance) | +1 | +1 to +2 | Curve | N/A — this is a per-instance authored value, not itself subject to a "too low" failure beyond being negligible at +1 (which is the intended baseline) | At `+2` per instance, two stacked instances alone would reach the default `damage_amount_cap_with_upgrades` (5) starting from a typical base `amount` of 1–3, front-loading a run's power growth into very few draft picks — cheapens the draft-choice weight across a full run |
| `damage_amount_cap_with_upgrades` | 5 | 4–6 | Curve | Below the base per-ability `damage` guideline ceiling already documented in Heroes & Abilities (1–4), an upgrade could never add any value to a maximally-rolled base ability — the cap must sit at or above that document's own max | Above 6, a single upgraded ability approaches or exceeds typical `hero_hp_baseline` (5–7, Heroes & Abilities), letting one upgraded hit two-shot most heroes — pulls the game back toward a damage race, directly weakening Pillar #2 |
| `push_distance_boost_delta` (per instance) | +1 | +1 to +2 | Curve | N/A — baseline value | At `+2`, a single instance could push Vanguard's base Shove (distance 2) straight to the field cap (4) in one draft pick, similarly front-loading power growth |
| `push_distance_cap_with_upgrades` | 4 | 3–5 | Curve | Below Heroes & Abilities' own documented push/pull safe-range ceiling (4), upgrades could never let a hero exceed what a hand-authored ability could already achieve — removes the point of the category | Above 5, combined with edge/Chasm kills, an upgraded push can single-handedly relocate a unit across most of an 8-wide board — Heroes & Abilities' own Tuning Knobs already flag this exact threshold as risky for base abilities; this document should not casually exceed it via upgrades |
| `extra_use_delta` (per instance) | +1 | +1 (fixed) | Gate | N/A — this knob is intentionally fixed, not a tunable range, because `usesPerTurn` interacts directly with per-turn action-economy legibility, not a smooth power curve | A `+2` single-instance delta is explicitly out of range — it would let one draft pick alone reach the default cap (2) *and* create pressure to raise the cap itself, compounding two risks at once; if a "cast three times" hero archetype is ever wanted, author it as a distinct ability design (Heroes & Abilities), not this knob |
| `uses_per_turn_cap_with_upgrades` | 2 | 2–3 | Gate | Below 2, the Extra Use category has literally nothing to grant (a hero could never exceed the v1 base `usesPerTurn=1`) — the category would be dead content | At 3, a single Ability-slot activation can resolve up to three full target selections and casts in sequence — meaningfully harder to read and to preview cleanly within Pillar #5's ten-second budget; only raise alongside explicit playtesting of Move Preview's multi-cast UI |
| `hazardImmune` catalog scope (v1) | `{Fire}` only | — | Gate (content, not numeric) | N/A | Expanding this beyond `Fire` requires Combat Resolution / Encounter Generator to first define additional concrete hazard types (Combat Resolution's own Open Questions defer `Smoke`/`Acid` content) — this document cannot get ahead of that undesigned content |

**Interactions between knobs:**
- `damage_boost_delta` / `damage_amount_cap_with_upgrades` and
  `push_distance_boost_delta` / `push_distance_cap_with_upgrades` are each
  independent per-field pairs, but both must be re-checked jointly against
  Heroes & Abilities' own Tuning Knobs whenever *that* document's baseline
  ranges change — this document's caps are deliberately anchored to (at or
  just above) Heroes & Abilities' existing ceilings, not derived
  independently.
- `upgrade_slots_per_hero` interacts with every numeric category's cap: more
  slots means more opportunities to reach a given field's cap sooner in a
  run. If `upgrade_slots_per_hero` is raised, the field caps should be
  re-validated to confirm a fully-slotted hero still cannot trivially exceed
  the safe ranges documented above.
- `uses_per_turn_cap_with_upgrades` should not be raised without a
  corresponding Move Preview UI review (Move Preview ✅ Designed) — the multi-cast
  activation loop (Formula F2) is only as legible as its preview
  presentation, which this document does not control.

## Visual/Audio Requirements

- **Upgraded-ability icon overlay.** Any hero with at least one active
  Upgrade Slot affecting their ability must render a small, consistent
  overlay badge on their ability icon in Battle HUD and Board Rendering
  (e.g., a distinct corner glyph) — this must be visually distinguishable
  from the base ability icon at a glance, so the player never mistakes an
  upgraded verb for a base one mid-battle, per the "Legible Battlefield"
  Visual Identity Anchor.
- **Effective-vs-base numeric readout.** Wherever an upgraded field's value
  is displayed (push distance, damage amount, uses per turn), the UI must
  show the effective value, with the base value available as
  secondary/tooltip information (e.g., "Push 4" with a hover detail of
  "Base 2 + Upgrade 1 + Upgrade 1, capped at 4") — this makes the F1 clamp
  behavior visible rather than a hidden system, directly serving Pillar #1
  (no hidden math the player couldn't have reasoned about).
- **Immunity indicator.** A hero with an active `hazardImmune` or
  `allyDamageImmune` instance must display a persistent, always-visible
  status icon distinct from any hazard/telegraph overlay (per the Visual
  Identity Anchor's "different visual language" principle already
  established in Heroes & Abilities) — this is functionally load-bearing,
  since the Edge Cases above establish immunity has *narrower* scope than a
  player might assume (it does not cover collision damage or Fell), and the
  UI must not visually imply broader protection than the rule grants.
- **Extra-Use cast counter.** During an Extra-Use hero's Ability-slot
  activation (Formula F2), the UI must display remaining uses within the
  current activation (e.g., "1 of 2 uses remaining") so the player
  understands, mid-sequence, that they can choose additional targets before
  the slot locks — without this, a player could easily believe the ability
  slot is already spent after the first cast.
- **Audio hooks (owned by Audio System, ✅ Designed):** this document flags
  that an upgraded ability's cast should reuse the base ability's SFX
  identity (a "shove is always a shove," per Pillar #4) rather than
  introduce a separate "upgraded" sound — upgrades intensify a verb's
  numeric effect, not its sonic identity.

## Acceptance Criteria

Pure, deterministic unit tests unless noted — no wall-clock time, no RNG, no
rendering. Default Tuning Knob values and the reference kit table
(Vanguard/Warden/Twinblade/Ember/Striker) from `heroes-and-abilities.md`
unless stated otherwise.

**Upgrade Slot model (Rules 1–3)**
- **GIVEN** the default `upgrade_slots_per_hero = 2`, **WHEN** any hero is
  constructed, **THEN** it has exactly 2 Upgrade Slots, both `Empty`.
- **GIVEN** an `Empty` slot, **WHEN** a compatible `AbilityUpgradeInstance` is
  assigned, **THEN** the slot reads `Filled(instance)` and
  `effectiveAbility(hero)` reflects the change on the next call.
- **GIVEN** a `Filled` slot, **WHEN** the instance is removed, **THEN** the
  slot reads `Empty` and `effectiveAbility(hero)` reverts to the value it
  would have with that instance excluded.

**Compatibility validation (Rules 5–9)**
- **GIVEN** a Damage Boost upgrade and Twinblade's Blink Swap (no `damage`
  step), **WHEN** `isCompatible` is checked, **THEN** it returns `false` and
  assignment is rejected.
- **GIVEN** a Push Distance Boost upgrade and Vanguard's Shove (`push`
  step present), **WHEN** `isCompatible` is checked, **THEN** it returns
  `true`.
- **GIVEN** an Extra Use upgrade and any hero's ability (Striker, Warden,
  Ember, Vanguard, Twinblade all included), **WHEN** `isCompatible` is
  checked, **THEN** it returns `true` for every one (universal
  compatibility, Rule 6).
- **GIVEN** an `allyDamageImmune` upgrade and Warden's Anchor Pull
  (`targetFilter = Enemy`, no ally-targetable `damage` step), **WHEN**
  `isCompatible` is checked, **THEN** it returns `false`.

**Effective parameter resolution (Formula F1)**
- **GIVEN** Vanguard's Shove (base `distance = 2`) with one Push Distance
  Boost (`delta = +1`), **THEN** `effectiveValue(...) == 3`.
- **GIVEN** the same hero with a second Push Distance Boost instance
  (`delta = +1` each, total requested `+2`), **THEN**
  `effectiveValue(...) == 4` (clamped at `push_distance_cap_with_upgrades`),
  not `5`.
- **GIVEN** a hero with zero active upgrades, **THEN**
  `effectiveValue(baseValue, [], field) == clamp(baseValue, fieldMin,
  fieldCap)`, which equals `baseValue` for every v1 reference-kit ability
  (no base value exceeds its own field's default cap).
- **GIVEN** identical `(baseValue, activeUpgrades, targetField)` inputs
  across two calls, **THEN** both calls return byte-identical output (pure
  function, Rule 11).

**Extra-Use cast sequence (Formula F2)**
- **GIVEN** Striker with effective `usesPerTurn = 2` and two distinct
  directions each containing at least one enemy, **WHEN** the Ability slot
  is activated, **THEN** exactly 2 casts resolve, targets are recomputed
  between casts from the post-cast-1 board state, and the Ability slot
  flips to `Used` exactly once at the end.
- **GIVEN** the same hero, but the second cast's board state has zero
  qualifying targets in any direction, **THEN** the activation ends after 1
  cast, the slot still flips to `Used`, and no error/crash occurs.
- **GIVEN** an Extra-Use hero, **WHEN** the player declines the second cast
  despite `usesRemaining > 0`, **THEN** the activation ends early by choice
  and the slot still flips to `Used` after only 1 cast.
- **GIVEN** an Extra-Use Striker firing a `Line` ability with 2 qualifying
  units in one ray during a single cast, **THEN** that single cast still
  compiles to 2 `damage` primitives (per Heroes & Abilities Rule 12) — Extra
  Use does not additionally multiply the per-cast primitive count.

**Immunity resolution (Formula F3, Edge Cases)**
- **GIVEN** a hero with `allyDamageImmune` and a compiled effect chain
  `[push(allyId, S, 2), damage(allyId, 2)]`, **WHEN** `filterAllyDamage`
  runs, **THEN** the result is `[push(allyId, S, 2)]` — the `damage` step is
  removed, the `push` step is untouched.
- **GIVEN** the same hero and upgrade, **WHEN** that `push` subsequently
  collides with a wall inside Combat Resolution's own algorithm, **THEN**
  `collision_damage` is still applied in full to the ally — `allyDamageImmune`
  never intercepts it (verified via an integration test against a real
  Combat Resolution instance, since Formula F3 only operates on
  pre-resolution compiled output).
- **GIVEN** a hero with `hazardImmune(Fire)` standing on a Fire tile at the
  start of an Environment-phase tick, **THEN** the hazard tick's
  `applyHazard` call results in zero HP loss for that hero (integration
  test against Combat Resolution once the flagged extension exists — see
  Open Questions; this criterion is **provisional pending that extension**).
- **GIVEN** the same hero, **WHEN** forcibly displaced onto a different Fire
  tile via `push`, **THEN** hazard-on-entry also results in zero HP loss
  (same immunity check applied at the entry call site, not just the tick
  call site).

**Run-level assignment gating (Rule 12)**
- **GIVEN** a battle currently in the `InTurn` battle-level state, **WHEN**
  an upgrade assignment or removal is attempted, **THEN** it is rejected.
- **GIVEN** a battle in the `Ended` battle-level state (or before the next
  battle's `Setup` begins), **WHEN** an upgrade assignment is made, **THEN**
  it succeeds and is reflected the next time that hero's `effectiveAbility()`
  is resolved.

### Performance Budget (headless TS benchmarks, decoupled from render)

| Operation | Budget | Note |
|-----------|--------|------|
| `effectiveAbility(hero)` (F1, ≤3 active upgrades) | < 0.05 ms/call | Pure summation + clamp over a small, bounded upgrade list |
| `isCompatible(ability, upgradeDefinition)` | < 0.02 ms/call | Static predicate over `effectTemplate` step types, no board traversal |
| `filterAllyDamage` (F3) | < 0.05 ms/call | Linear scan over a short compiled effect list (typically ≤4 entries) |
| Full Extra-Use activation loop (F2, `usesRemaining ≤ 2`) | < 1 ms combined | Bounded by `uses_per_turn_cap_with_upgrades`; each cast reuses Heroes & Abilities' already-budgeted `legalTargets`/`compileEffects` costs |

## Open Questions

**Needs an architecture decision (→ ADR during `/create-architecture`):**

1. **Combat Resolution needs a new per-unit `hazardImmunities` check.**
   `hazardImmune(hazardType)` (Rule 8, Formula F3's sibling immunity type)
   requires `applyHazard` and every hazard-on-entry call site within
   `combat-resolution.md`'s `push`/`pull`/`swap`/Move resolution to consult a
   per-unit immunity set before applying tick/entry damage. This is **not**
   part of that document's currently-published contract (its Rule 7/9 and
   Formula F3 assume damage always applies to any occupant). *Proposed:*
   extend the eventual `Unit` record (Heroes & Abilities Open Question #3,
   still unresolved) with a `hazardImmunities: HazardType[]` field that
   `applyHazard` checks generically — keeping Combat Resolution's boundary
   clean (it queries a Unit-level property, the same way it already queries
   HP, rather than gaining explicit knowledge of "ability upgrades" as a
   concept). *Owner:* propagate to `combat-resolution.md` maintainers and
   the shared `Unit` record ADR.
2. **Persistent hero-instance / roster-member identity — now owned by Draft
   / Loadout Meta.** This document assumes Upgrade Slot state attaches to a
   persistent per-run "hero instance" distinct from both `HeroDefinition`
   (Heroes & Abilities' authored chassis data) and the battle-scoped `Unit`
   record (now formally published in `cross-system-contracts.md` §6). That
   identity is now owned: Draft / Loadout Meta (✅ Designed) defines it as
   the **`RosterMember`** record (`draft-and-loadout-meta.md` Rule 2), to
   which a hero's filled Upgrade Slots attach. What remains for the
   architecture pass is confirming the `RosterMember`↔`Unit` seeding/
   write-back hook (per `draft-and-loadout-meta.md` Open Question #1), not
   the existence of the identity itself. *Owner:* Tech architecture,
   coordinated with Draft / Loadout Meta.

**Resolved this session (provisional defaults — confirm during
implementation):**

3. **Delta vs. replacement** (`heroes-and-abilities.md` Open Question #10)
   is resolved here: upgrades apply as an **additive delta with a per-field
   clamp**, never a field replacement (Rule 10, Formula F1).
4. **Extra Use does not add a second Ability slot.** It grants additional
   sequential casts within one existing Ability-slot activation (Formula
   F2), preserving Heroes & Abilities' structurally-fixed
   `actions_per_hero_turn = 2` (that document's Rule 4, whose own Tuning
   Knobs explicitly warn against raising it without a schema redesign).
5. **`upgrade_slots_per_hero` is a single global knob**, not a per-hero
   chassis field, chosen for cross-roster legibility (Rule 2). Revisit only
   if playtesting shows certain hero archetypes need asymmetric slot counts
   — that would be a deliberate future change, not an oversight.

**Deferred to the owning system's GDD:**

6. **"Building"/objective-unit immunity is not implemented.** The task
   brief's ITB-reactor-core precedent includes protecting objective
   structures. VANGUARD's Objective / Win-Lose system (✅ Designed,
   `objective-and-win-lose.md`) defines a **Protect** mission type with a
   single `protectedUnitId`, but v1 scopes that protected unit to
   Hero-faction units only (`protected_unit_scope = HeroOnly`);
   neutral/structure "objective units" (defendable buildings/civilians) are
   explicitly deferred to a future third-faction pass (that document's own
   Open Question #10). This document reserves the `Immunity` category's
   structure to accommodate a future `objectiveUnitImmune` subtype (an
   upgrade that prevents a hero's forced-movement effects from harming a
   protected objective unit) but does **not** implement it — it stays gated
   on Objective / Win-Lose adding defendable non-hero objective units.
   *Owner:* Objective / Win-Lose, when that content is added.
7. **Upgrade catalog content, rarity, and draft-offer economy** (how many
   upgrades exist, how they're weighted, what they cost, how often they're
   offered) are entirely Draft / Loadout Meta's scope. This document only
   guarantees the schema and per-category compatibility/stacking rules
   Draft / Loadout Meta will need to build against.
8. **Respec / upgrade-removal-for-refund mechanics** (can a player undo an
   upgrade choice and recover its cost?) are not defined here — Rule 13
   assumes upgrades are otherwise permanent for the run once assigned,
   aside from ordinary Empty/Filled slot transitions Draft / Loadout Meta
   might expose. *Owner:* Draft / Loadout Meta, if such a mechanic is
   wanted.
9. **Pilots field-overlap consistency check — RESOLVED 2026-07-28.**
   `pilots.md` is now Designed. Its Core Rule 5 forbids Pilots from
   modifying any `AbilityDefinition` field, so the two systems cannot
   collide. The original framing of this note ("chassis vs. ability fields")
   was wrong in one respect: the chassis lane belongs to **Passive
   Modules**, not Pilots. The three-way boundary is now: Ability Upgrades →
   `AbilityDefinition` fields; Passive Modules → chassis fields and rules of
   engagement; Pilots → action-slot economy, deployment, run-level.
