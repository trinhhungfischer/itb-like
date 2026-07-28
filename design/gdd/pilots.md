# Pilots

> **Status**: Designed (pending independent `/design-review`)
> **Author**: user + main session (Lean review mode)
> **Last Updated**: 2026-07-28
> **Priority**: Alpha | **Layer**: Feature | **Category**: Progression
> **Implements Pillars**: #2 Positioning Over Power · #3 Variety Lives in the Draft · #4 Every Hero Is a Verb (protected, not extended)
> **Design spec**: [2026-07-28-pilots-design.md](../../docs/superpowers/specs/2026-07-28-pilots-design.md)
> **Supersedes**: systems-index #25 "Pilots / Hero Modifiers" (chassis-modifier concept — see Open Questions #1)

---

## Overview

A **Pilot** is the human being inside a mech. Mechs are hardware: they are dented,
repaired, and redeployed, and the player never loses one. Pilots are not. A pilot
accrues experience across the battles they are deployed in, levels up to a maximum
of three, chooses a new skill at each level, and **dies permanently the moment their
mech is destroyed**. The mech walks away at 1 HP with an empty cockpit; the pilot
does not walk away at all.

Pilot skills occupy a lane no other system touches: **action economy** (the Move and
Ability slots), **deployment** (placement at battle Setup), and **run-level** effects
(currency, draft). They are forbidden from touching chassis fields (`maxHP`,
`moveRange`, `hazardImmunities` — owned by Passive Modules) or ability parameters
(owned by Ability Upgrades). A mech with no pilot runs on an **AI Core** — fully
functional, simply skill-less.

This system exists to put something at stake. Every other progression axis in
VANGUARD only accumulates; nothing can be lost. Pilots are the one thing the player
can permanently lose inside a run, which is what converts a tactical decision
("should I move this mech into the threatened tile?") into a felt one.

---

## Player Fantasy

**"Not the machine. Her."**

The commander fantasy in `game-concept.md` is *"I am a cunning commander who wins
with my mind, not with numbers."* A commander who risks nothing is not commanding —
they are solving. Pilots supply the missing weight.

The intended emotional arc across a single run:

1. **Early (battles 1–2)** — pilots are near-anonymous. A name, a portrait, one
   innate skill. The player deploys freely.
2. **Middle (battles 2–4)** — a pilot reaches level 2, then 3. The player *chose*
   those skills. The mech in the left column is no longer "the Vanguard"; it is
   "Reyes, who can double-move and deploys forward."
3. **Boss** — the pilot is at peak value exactly when the board is most lethal. The
   player now hesitates over a tile they would have taken without thinking in
   battle 1. **That hesitation is the entire system working.**
4. **If they die** — the mech is fine. It fights the next battle on an AI Core, at
   full effectiveness minus three skills the player picked by hand. Nothing is
   unrecoverable; something is genuinely gone.

This directly serves **Pillar 2 (Positioning Over Power)** by pushing it up a layer:
positioning now carries a consequence that outlives the battle. It serves the
**Relatedness** need identified in `game-concept.md`'s motivation profile, which
currently has no mechanical support anywhere in the design.

What this fantasy is **not**: it is not a stat-growth fantasy. A pilot never makes a
mech hit harder or survive longer — those levers belong to other systems. A pilot
makes a mech *do more things per turn*, which is a fantasy about tempo and command,
not about power.

---

## Detailed Design

### Core Rules

1. **A pilot is a distinct entity from a mech.** `PilotInstance` records live in a
   run-level pool (`RunState.pilots`). A mech (`RosterMember`) references at most one
   via `RosterMember.pilotId`. The mech record owns the assignment; the pilot record
   carries no back-reference, so there is exactly one place assignment can be read
   or written.

2. **`pilotId == null` means AI Core.** An AI Core is not an entity and has no
   record. It grants no skills and accrues no XP. A mech on an AI Core is otherwise
   fully functional — it moves, acts, and takes its two action slots normally. There
   is no penalty for flying pilotless beyond the absence of skills.

3. **At most one pilot per mech; at most one mech per pilot.** A `PilotInstance` may
   be referenced by at most one `RosterMember` at a time. Assignment is total: a
   pilot is either assigned to exactly one mech or unassigned.

4. **Pilot skills are restricted to three lanes.** A pilot skill may affect:
   **action economy** (the Move slot and Ability slot defined by
   `heroes-and-abilities.md` Rule 4), **deployment** (tile placement during battle
   Setup), or **run-level** state (currency, draft offers, XP).

5. **Pilot skills are forbidden from two lanes.** A pilot skill may **not** modify
   `maxHP`, `moveRange`, or `hazardImmunities` (owned by **Passive Modules** —
   T1 Pathfinder, S2 Hazard Walker, S3 Acid Walker, S4 Last Stand), and may **not**
   modify any `AbilityDefinition` field: `range`, `areaRadius`, `shape`,
   `targetFilter`, `effectTemplate`, `usesPerTurn`, `cooldownTurns` (owned by
   **Ability Upgrades**). Any proposed skill whose effect can be restated as a
   chassis-field delta or an ability-field delta belongs to those systems, not this
   one. This rule is the primary defence against the five-axis legibility risk
   (see Open Questions #2).

6. **"Move after Ability" is not available as a pilot skill.** Both action slots may
   already be used in either order for every mech, per `heroes-and-abilities.md`
   Rule 4. VANGUARD grants for free what Into the Breach sells as a pilot skill;
   re-selling it would be a null effect.

7. **Pilot skills never introduce randomness into a battle.** Per Pillar 1, all skill
   effects are deterministic. Seeded PRNG is used only for *offer generation* between
   battles (Formula F3), never for in-battle resolution.

8. **Levels and skills.** A pilot starts at level 1 holding exactly its
   `PilotDefinition.innateSkill`. It levels at the thresholds in Formula F2, up to
   `pilot_max_level` (default **3**). Each level gained grants exactly one new skill,
   chosen by the player from `pilot_skill_offer_count` offers (Formula F3). A pilot's
   `skills` array therefore always satisfies `length == level`.

9. **Level-up offers cannot be skipped.** The player must select one of the offered
   skills. Unlike a `DraftOffer` — where `draft-and-loadout-meta.md` Rule 8
   structurally appends a `SkipOffer` because offers carry opportunity cost — a
   level-up is pure gain. There is nothing to weigh, so there is no decline path.

10. **XP is earned per battle, never per kill.** Each deployed mech that does not end
    the battle `Removed` awards `pilot_xp_per_battle` to its pilot (Formula F1).
    Kill-based XP would reward damage output and contradict Pillar 2.

11. **XP is awarded regardless of battle outcome.** A lost battle still awards XP to
    surviving deployed pilots. The award keys on the mech's final state, not the
    objective's result.

12. **Benched pilots earn nothing.** Only pilots on mechs in the active Loadout at
    battle Setup accrue XP. This concentrates growth in the squad the player actually
    fields — which is what gives a veteran's death its cost — and guarantees a
    mid-run replacement never catches up to a survivor.

13. **Pilot death.** If a mech's `Unit` ends a battle in `Removed(Defeated)` or
    `Removed(Fell)`, its assigned pilot's `status` becomes `Dead` and the mech's
    `pilotId` is set to `null` (Formula F4). This is permanent for the remainder of
    the run: a dead pilot is never revived, re-offered, or restored. The mech is
    unaffected beyond losing its pilot and survives at `currentHP = 1` per
    `draft-and-loadout-meta.md` Rule 3.

14. **Death resolution is a `battle_ended` consumer, not a combat rule.** Pilot death
    is evaluated once, at the terminal `battle_ended` event, at the same point
    `draft-and-loadout-meta.md` Formula F6 writes `Unit.currentHP` back to
    `RosterMember.currentHP`. Combat Resolution, the Turn & Phase Manager, and Move
    Preview have no knowledge of pilots and require no changes.

15. **A prevented removal is not a death.** Because Rule 13 keys on the mech's final
    `Removed` state, any effect that prevents removal also saves the pilot. The
    Passive Module **S4 Last Stand** (prevents the first `Removed(Defeated)` per
    battle, setting `currentHP = 1`) therefore functions as life insurance for a
    veteran pilot. This interaction is intentional and requires no change to
    `passive-modules-and-equipment.md`.

16. **Starting allocation.** Each of the `squad_size` (3) mechs in the starting squad
    begins the run with a pilot at level 1. Mechs recruited mid-run through a
    `NewHeroOffer` arrive with an **AI Core**.

17. **Acquisition is via `PilotOffer`.** `draft-and-loadout-meta.md` Rule 8 already
    reserves `PilotOffer` in the `DraftOffer` union; this document activates it. A
    `PilotOffer` is generated **only when at least one roster member has
    `pilotId == null`** (Formula F5), so an offered pilot always has a cockpit to
    occupy.

18. **Reassignment happens only on the Loadout Configuration screen.** A pilot may be
    moved between mechs, or moved into an empty cockpit, exclusively on the Loadout
    Configuration screen specified in `draft-loadout-ui.md` Rule 4. No new screen is
    introduced, and reassignment is never available mid-battle.

19. **Reassignment carries the pilot whole.** Level, XP, and the full `skills` array
    move with the pilot. Nothing is reset or re-rolled by reassignment.

20. **A run is never made unwinnable by pilot loss.** If every pilot dies, all mechs
    run on AI Cores and remain fully functional. The system has no death spiral: the
    worst case is the baseline experience.

### States and Transitions

**Pilot lifecycle** (per `PilotInstance`, per run):

`Unassigned → Assigned(mechId) → {Unassigned | Dead}`

| Transition | Trigger | Notes |
|---|---|---|
| `(none) → Unassigned` | A `PilotOffer` is accepted, or the run's starting pilots are created | Starting pilots transition immediately to `Assigned` |
| `Unassigned → Assigned(mechId)` | Player assigns on the Loadout Configuration screen | Target mech must have `pilotId == null` |
| `Assigned(a) → Assigned(b)` | Player reassigns on the Loadout Configuration screen | Level, XP, and skills carry unchanged (Rule 19) |
| `Assigned → Unassigned` | Player unassigns on the Loadout Configuration screen | Mech reverts to AI Core |
| `Assigned → Dead` | Owning mech ends a battle `Removed(Defeated \| Fell)` | **Terminal.** No return transition exists |

`Dead` is terminal and absorbing. A `Dead` pilot's record is retained in
`RunState.pilots` for end-of-run summary display but is never eligible for
assignment, XP, or level-up.

**Pilot level** (per `PilotInstance`): `L1 → L2 → L3`. Monotonic, driven solely by
`xp` crossing the Formula F2 thresholds. No transition decreases level; death does
not decrement, it terminates.

**Level-up resolution** (per level gained): `Pending → Offered(skills[]) → Resolved(chosen)`.
Evaluated at `battle_ended` after XP is awarded. If a single XP award crosses two
thresholds at once — impossible with default knobs, but legal if
`pilot_xp_per_battle` is tuned up — the level-ups resolve sequentially, each with
its own offer set (Edge Cases).

**Mech cockpit state** (per `RosterMember`): `Piloted(pilotId) ↔ AICore(null)`.
Both directions are reachable: `Piloted → AICore` via pilot death or unassignment;
`AICore → Piloted` via assignment.

### Interactions with Other Systems

Pilots is a **run-layer progression system**. It reads battle outcomes and writes
run state. It never participates in battle resolution.

| System | Reads from Pilots | Pilots reads / calls | Ownership boundary |
|---|---|---|---|
| **Draft / Loadout Meta** | `PilotInstance` records for `PilotOffer` generation and Loadout validation | `RosterMember.pilotId`, `Roster.members`, the `battle_ended` write-back hook | Draft owns the Roster and the offer pipeline; Pilots owns what a pilot *is* and when it dies |
| **Heroes & Abilities** | — | `HeroDefinition` for display only (mech name/class alongside pilot name) | Pilots modifies **no** `HeroDefinition` field (Rule 5). The pre-existing "Pilots overrides `maxHP`/`moveRange`" contract is superseded |
| **Passive Modules** | — | Reads S4 Last Stand's removal-prevention outcome indirectly, via the mech's final `Removed` state | Passive Modules owns all chassis-field modification. Pilots must never duplicate a module effect |
| **Ability Upgrades** | — | — | Fully disjoint. Ability Upgrades owns `AbilityDefinition` fields; Pilots owns action-slot economy |
| **Turn & Phase Manager** | Action-economy skill effects that grant extra slot uses (e.g. Reserve Thrusters) are consumed within the Player Phase | — | The Manager owns *when* actions are legal; a pilot skill only changes *how many times* a slot may be spent |
| **Encounter Generator** | Deployment-lane skill effects that widen the legal deploy-tile set at Setup | `deploy-zone` tile flags | Encounter Generator authors the deploy zone; a pilot skill may extend the legal set, never relocate the zone |
| **Run Persistence** | The full `RunState.pilots` array and every `RosterMember.pilotId` | — | Run Persistence serialises; Pilots defines the shape (see Dependencies) |
| **Draft/Loadout UI** | Pilot name, portrait, level, XP, skill list; the level-up offer set; the death notification | — | Read-only consumer plus the level-up selection input |
| **Meta-progression / Unlocks** | May gate which `PilotDefinition`s exist in the catalog | — | Meta-progression owns catalog unlock state; this document's schema is valid regardless of unlock status |

**Systems requiring zero changes:** Board & Grid, Combat Resolution, Move Preview,
Input & Selection, Objective / Win-Lose, Battle HUD, Board Rendering & Juice, Audio
System. The simulation core is untouched.

---

## Formulas

### F1 — XP award

Awarded once per pilot at the terminal `battle_ended` event.

`xpAward(mech) = pilot_xp_per_battle  if  (mech ∈ deployedLoadout ∧ mech.unit.finalState ≠ Removed)`
`xpAward(mech) = 0                    otherwise`

**Variables:**

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| `pilot_xp_per_battle` | `X` | int | 0–5 (default **1**) | XP granted per qualifying battle |
| `deployedLoadout` | — | RosterMember[] | length == `squad_size` (3) | Mechs deployed at battle Setup |
| `mech.unit.finalState` | — | enum | `Alive \| Removed(Defeated) \| Removed(Fell)` | The mech's `Unit` state at `battle_ended` |

**Output Range:** 0 to `pilot_xp_per_battle` per pilot per battle. Across a default
run (~4–5 combat nodes), a pilot deployed and surviving throughout accrues 4–5 XP.

**Example:** Squad of 3 deployed. Mech A survives (pilot has 1 XP → 2 XP). Mech B
survives (0 XP → 1 XP). Mech C ends `Removed(Defeated)` — awards 0, and its pilot
dies via F4 regardless. Note the award applies whether the battle was won or lost
(Rule 11), and pilots on benched mechs receive nothing (Rule 12).

### F2 — Level from XP

`level(xp) = 3  if  xp ≥ pilot_level3_xp`
`level(xp) = 2  if  pilot_level2_xp ≤ xp < pilot_level3_xp`
`level(xp) = 1  otherwise`

**Variables:**

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| `xp` | `x` | int | 0–∞ (practically 0–5) | Pilot's cumulative XP |
| `pilot_level2_xp` | `T₂` | int | 1–10 (default **2**) | Cumulative XP for level 2 |
| `pilot_level3_xp` | `T₃` | int | `T₂+1`–20 (default **4**) | Cumulative XP for level 3 |
| `pilot_max_level` | `L` | int | 1–5 (default **3**) | Ceiling; XP beyond `T₃` has no effect |

**Output Range:** 1 to `pilot_max_level`. Monotonically non-decreasing in `xp`.

**Invariant:** `T₂ < T₃` must hold. A configuration where `T₂ ≥ T₃` would make level 2
unreachable (Edge Cases).

**Example (defaults, ~4–5 combat nodes per run):** after battle 1, `xp=1` → L1.
After battle 2, `xp=2` → L2 (one skill chosen). After battle 4, `xp=4` → L3 (second
skill chosen). A starting pilot therefore reaches maximum value at roughly the same
node the run reaches its Boss.

### F3 — Level-up skill offer generation

`offerSet(pilot, runSeed) = firstN(pilot_skill_offer_count, shuffle(eligible, mulberry32(mix(runSeed, pilot.id, pilot.level))))`
`where eligible = pilotSkillCatalog \ pilot.skills`

**Variables:**

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| `pilot_skill_offer_count` | `N` | int | 2–5 (default **3**) | Skills offered per level-up |
| `pilotSkillCatalog` | — | PilotSkillId[] | ≥ `N + pilot_max_level` entries | All authored pilot skills |
| `eligible` | — | PilotSkillId[] | 0–len(catalog) | Catalog minus skills the pilot already holds |
| `runSeed` | — | uint32 | 0–2³²−1 | The run's seed |

**Output Range:** an array of `min(N, len(eligible))` distinct skill ids.

**Determinism:** uses the shared `mulberry32` PRNG registered in
`design/registry/entities.yaml` (`mulberry32_prng`), salted with the pilot id and the
level being gained so that two pilots levelling in the same battle receive independent
offer sets, and so replaying the same run reproduces identical offers. This is
procedural generation between battles — never in-battle randomness (Pillar 1, Rule 7).

**Example:** catalog of 10 skills; pilot holds `[reserve_thrusters]` and is gaining
level 2. `eligible` has 9 entries; the seeded shuffle takes the first 3. The player
picks 1; `skills` becomes length 2, satisfying Rule 8's `length == level`.

### F4 — Pilot death resolution

Evaluated once per deployed mech at `battle_ended`, after F1.

```
resolveDeath(mech):
  if mech.unit.finalState ∈ {Removed(Defeated), Removed(Fell)} and mech.pilotId ≠ null:
      pilots[mech.pilotId].status = Dead
      mech.pilotId = null
```

**Variables:**

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| `mech.unit.finalState` | — | enum | `Alive \| Removed(Defeated) \| Removed(Fell)` | Terminal `Unit` vitality state |
| `mech.pilotId` | — | string \| null | — | Cockpit occupancy before resolution |

**Output:** at most one `PilotInstance.status` transition to `Dead` per deployed mech
per battle; at most `squad_size` (3) deaths in a single battle.

**Ordering guarantee:** F4 runs after F1, so a mech that is `Removed` awards no XP
(F1 already returns 0 for it) and there is no window in which a dying pilot levels up.

**Example:** a squad of 3 enters a battle; mechs A and B survive, mech C is pushed
into Lethal terrain and ends `Removed(Fell)`. C's pilot — level 3, three
player-chosen skills — becomes `Dead`. C's `pilotId` becomes `null`; C itself is
written back at `currentHP = 1` per Rule 3 and is fully deployable next battle on an
AI Core. If C had instead been carrying **S4 Last Stand** and it triggered, C's final
state would be `Alive` at 1 HP, F4 would not fire, and the pilot would survive
(Rule 15).

### F5 — `PilotOffer` eligibility

`pilotOfferEligible(roster) = ∃ m ∈ roster.members : m.pilotId = null`

**Variables:**

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| `roster.members` | — | RosterMember[] | 0–`max_roster_size` (default 7) | All recruited mechs this run |

**Output Range:** boolean.

**Consumption:** Draft / Loadout Meta's offer generator must evaluate this predicate
before emitting a `PilotOffer` into a `DraftOffer` set. When it is false, `PilotOffer`
is excluded from the draw and the slot is filled by another offer type, exactly as
that document already handles other unavailable categories.

**Example:** at run start the roster is 3 mechs, all piloted → predicate false → no
`PilotOffer` can appear. After a pilot dies, or after a `NewHeroOffer` adds a fourth
mech (which arrives on an AI Core per Rule 16), the predicate becomes true and
`PilotOffer` re-enters the pool.

### F6 — Effective pilot skill set

`effectiveSkills(mech) = pilots[mech.pilotId].skills   if  mech.pilotId ≠ null ∧ pilots[mech.pilotId].status = Active`
`effectiveSkills(mech) = []                            otherwise`

**Output Range:** 0 to `pilot_max_level` (3) skill ids.

**Note:** the `status = Active` guard is defensive. Rule 13 sets `pilotId = null` at
the same moment it sets `status = Dead`, so a mech referencing a dead pilot should be
unreachable; the guard makes the formula total rather than relying on that invariant.

---

## Edge Cases

- **If a mech is deployed with `pilotId == null` (AI Core)**: F1 awards XP to nobody,
  F4 finds no pilot to kill, F6 returns `[]`. All three formulas are total over the
  null case; no special-casing is required at the call sites.

- **If all three deployed mechs are `Removed` in the same battle**: all three pilots
  die simultaneously. F4 is evaluated independently per mech with no ordering
  dependency between them. The next battle is fought with three AI Cores, which is
  fully playable (Rule 20).

- **If every pilot in the run is dead**: `PilotOffer` becomes eligible (F5 is true for
  every mech) and remains so. The run continues at baseline effectiveness. There is no
  loss condition attached to pilot count.

- **If a pilot levels up in the same battle in which their mech is `Removed`**: cannot
  occur. F1 awards 0 XP to a `Removed` mech's pilot, so no threshold is crossed, and
  F4 runs after F1 regardless.

- **If a single XP award crosses two level thresholds at once** (possible only if
  `pilot_xp_per_battle` is tuned above 1): the level-ups resolve **sequentially**. The
  first offer set is generated at `pilot.level = 1`, the player chooses, `level`
  increments to 2, then the second offer set is generated at `pilot.level = 2`. The
  level salt in F3 differs between them, so the two offer sets are independent and a
  skill chosen in the first is excluded from the second by the `\ pilot.skills`
  subtraction.

- **If `eligible` in F3 is smaller than `pilot_skill_offer_count`**: offer all
  remaining eligible skills. The player still must choose one (Rule 9).

- **If `eligible` in F3 is empty**: the level-up grants no skill. `level` still
  increments and `xp` is still recorded, but Rule 8's `length == level` invariant is
  broken by necessity. To prevent this, `pilotSkillCatalog` must contain at least
  `pilot_skill_offer_count + pilot_max_level` entries (F3 variable table). This is an
  authoring constraint, validated at content-load time, not a runtime branch.

- **If `pilot_level2_xp ≥ pilot_level3_xp`** (misconfiguration): F2 evaluates its
  clauses in order, so `xp ≥ T₃` matches first and level 2 becomes unreachable — a
  pilot would jump from 1 to 3, granting one skill for two levels and breaking Rule 8.
  The invariant `T₂ < T₃` must be validated at config load and rejected, not clamped.

- **If the player reassigns a pilot to a mech that already has one**: not offered. The
  Loadout Configuration screen only permits assignment into an empty cockpit
  (Rule 3, Rule 18). Swapping two pilots requires unassigning one first — an
  intentional friction that keeps the operation legible.

- **If a pilot is assigned to a benched mech**: legal. The pilot simply earns no XP
  (Rule 12) until that mech enters the active Loadout.

- **If a mech carrying a pilot is not deployed because the Loadout was reconfigured
  after the pilot was assigned**: the pilot is safe and earns nothing. Pilot death
  keys strictly on a deployed mech's terminal `Unit` state (F4); a mech that never
  had a `Unit` this battle cannot satisfy the condition.

- **If S4 Last Stand triggers on a mech whose pilot would otherwise die**: the pilot
  lives (Rule 15). S4 sets the final state to `Alive` at 1 HP; F4's condition is not
  met. F1 then awards XP normally, because the mech's final state is not `Removed`.

- **If the run ends (Boss defeated or run lost) with pilots still alive**: `Dead` and
  `Active` records alike are retained in `RunState.pilots` for the end-of-run summary.
  No pilot state carries into the next run — pilots are run-scoped, not meta-scoped
  (see Open Questions #3).

- **If a save is loaded mid-run**: `RunState.pilots` and every `RosterMember.pilotId`
  are restored verbatim. Because levels derive from `xp` via F2 rather than being
  independently stored, `level` and `xp` cannot desynchronise across a save/load
  boundary.

---

## Dependencies

### Upstream (systems Pilots depends on)

| System | What Pilots consumes | Hard / Soft |
|---|---|---|
| **Draft / Loadout Meta** | `RosterMember` (to add `pilotId`), `Roster`, the `DraftOffer` union (to activate `PilotOffer`), and the `battle_ended` write-back hook where F1/F4 attach | **Hard** |
| **Heroes & Abilities** | `HeroDefinition` id/name/class for display only; the `Unit` record's terminal vitality state (`Removed(Defeated \| Fell)`) as F4's trigger | **Hard** |
| **Turn & Phase Manager** | The Player Phase action-slot model (`actions_per_hero_turn = 2`) that action-economy skills modify | **Hard** |
| **Run Persistence** | Serialisation of `RunState.pilots` and `RosterMember.pilotId` | **Hard** |
| **Encounter Generator** | `deploy-zone` tile flags, which deployment-lane skills extend | **Soft** — Pilots functions with an empty deployment lane |
| **Meta-progression / Unlocks** | May gate `PilotDefinition` catalog availability | **Soft** — the schema is valid whether or not gating exists |

### Downstream (systems that depend on Pilots)

| System | What it consumes | Hard / Soft |
|---|---|---|
| **Draft/Loadout UI** | Pilot name, portrait, level, XP, `skills`; the level-up offer set and its selection input; the death notification; cockpit-empty state on Roster Cards | **Hard** |
| **Draft / Loadout Meta** | F5's `pilotOfferEligible` predicate, evaluated before emitting a `PilotOffer` | **Hard** |
| **Run Persistence** | The `PilotInstance` schema shape | **Hard** |

### Explicitly not dependencies

Board & Grid, Combat Resolution, Move Preview, Input & Selection, Objective /
Win-Lose, Battle HUD, Board Rendering & Juice, and Audio System have **no** relationship
with this system in either direction. Pilots is a run-layer system; the simulation core
requires zero changes.

**Bidirectional-consistency note:** `draft-and-loadout-meta.md`, `heroes-and-abilities.md`,
`ability-upgrades.md`, and `adr-0008` all carry forward-references written against the
superseded chassis-modifier concept. Those are corrected as part of this document's
landing changeset (see Open Questions #1).

---

## Tuning Knobs

| Knob | Default | Safe range | Affects | Too high | Too low |
|---|---|---|---|---|---|
| `pilot_xp_per_battle` | 1 | 0–5 | Level pacing | Pilots max out in 2 battles; the level-up choice loses weight and late-run recruits catch up instantly, flattening the gradient Rule 12 protects | At 0, no pilot ever levels; the system degenerates to a static one-skill attachment |
| `pilot_level2_xp` | 2 | 1–10 | First skill timing | Level 2 arrives near the Boss; the player never gets to use their chosen skill | At 1, a pilot levels after its first battle before any attachment forms |
| `pilot_level3_xp` | 4 | `pilot_level2_xp`+1 – 20 | Peak timing | Level 3 becomes unreachable in a default-length run; the ceiling is decorative | Peak arrives mid-run, so the highest-stakes stretch has no remaining growth |
| `pilot_max_level` | 3 | 1–5 | Skill ceiling per pilot | More skills per pilot compounds the five-axis legibility risk (Open Questions #2) and demands a larger catalog per F3's constraint | At 1, pilots never grow and death costs only the innate skill |
| `pilot_skill_offer_count` | 3 | 2–5 | Choice breadth at level-up | Approaches "pick anything"; build identity blurs and the catalog must grow to keep offers distinct | At 2, offers frequently feel forced |

**Interaction:** `pilot_level2_xp` and `pilot_level3_xp` are only meaningful relative
to `pilot_xp_per_battle` and to the run's combat-node count (~4–5 with
`run-structure-node-map.md` defaults `map_depth = 6`). Retune all three together;
changing `map_depth` invalidates the current thresholds.

**Constraint:** `pilot_level2_xp < pilot_level3_xp` must hold (Edge Cases).

**Not knobs here:** `squad_size` (3) and `max_roster_size` (7) are owned by
`heroes-and-abilities.md` and `draft-and-loadout-meta.md` respectively. This document
reads them and must not redefine them.

---

## Visual/Audio Requirements

> `art-director` not consulted — Lean review mode, and subagent dispatch was unavailable
> in the authoring session. Review manually before production.

**Pilots must read as people, mechs must read as machines.** This is the primary
mitigation for the five-axis legibility risk (Open Questions #2): a pilot must not
look like another equipment slot.

- **Portrait, not icon.** Each `PilotDefinition` has a `portraitId` rendering a human
  face. Every other progression axis in VANGUARD renders as a geometric icon; the
  portrait is what makes a pilot occupy different cognitive bandwidth.
- **Name prominence.** A piloted mech displays the pilot's name; an AI Core mech
  displays no name field at all, rather than a placeholder. Absence should be visible.
- **Level pips.** Level renders as 1–3 filled pips beside the portrait, matching the
  existing upgrade-slot pip language in `draft-loadout-ui.md` Rule 3 so the vocabulary
  stays consistent.
- **Death is the loudest moment in the run.** Pilot death is the only permanent loss
  in VANGUARD and must be presented as such — a distinct post-battle beat, not a line
  in a results list. The portrait is the focus of that beat.
- **Art Bible alignment**: `art-bible.md` §2 assigns Defeat "desaturated, harsh cold
  downlighting, clinical, abruptly silent". Pilot death should borrow that register
  even when the battle itself was won.
- **Audio**: one dedicated pilot-death cue, used nowhere else. Per `audio-system.md`'s
  clarity-first direction, it should be short and unmistakable rather than dramatic.
  Level-up gets a distinct, warmer cue.

📌 **Asset Spec** — after the art bible is approved, run
`/asset-spec system:pilots` to produce per-asset visual descriptions, dimensions, and
generation prompts from this section.

---

## UI Requirements

> **📌 UX Flag — Pilots**: this system has UI requirements. Run `/ux-design` for the
> affected screens **before** writing stories. Stories should cite the UX spec, not
> this GDD directly.

All pilot UI attaches to screens that already exist in `draft-loadout-ui.md`. **No new
screen is introduced.**

- **Roster Hub** — each Roster Card gains a pilot portrait, name, and level pips.
  AI Core mechs show an explicit empty-cockpit state.
- **Loadout Configuration** — the only place assignment, reassignment, and
  unassignment happen (Rule 18). Must enforce Rule 3 (one pilot per mech) by offering
  assignment only into empty cockpits.
- **Level-up selection** — a modal presenting `pilot_skill_offer_count` skills, shown
  post-battle. No skip control (Rule 9). If two level-ups resolve at once, they present
  sequentially (Edge Cases).
- **Post-battle death notification** — see Visual/Audio Requirements.
- **End-of-run summary** — lists every pilot, living and dead, with final level.

**Accessibility note:** pilot identity must not rely on portrait alone — name text is
required alongside it. This feeds the Accessibility system (#27, Not Started).

---

## Acceptance Criteria

**Core rules**

- **GIVEN** a mech with `pilotId == null`, **WHEN** it is deployed and the battle ends,
  **THEN** no XP is awarded, no death is resolved, and `effectiveSkills` returns `[]`.
- **GIVEN** a pilot assigned to mech A, **WHEN** the player attempts to assign it to
  mech B which already has a pilot, **THEN** the assignment is not offered by the UI.
- **GIVEN** a proposed pilot skill whose effect is expressible as a `moveRange`,
  `maxHP`, `hazardImmunities`, or `AbilityDefinition` field delta, **WHEN** content
  review runs, **THEN** the skill is rejected as belonging to Passive Modules or
  Ability Upgrades (Rule 5).
- **GIVEN** a pilot at level `n`, **WHEN** its record is inspected at any time,
  **THEN** `len(skills) == n` (Rule 8), except in the documented empty-catalog case.

**Formulas**

- **GIVEN** `pilot_xp_per_battle = 1` and a deployed mech ending the battle `Alive`,
  **WHEN** `battle_ended` fires, **THEN** its pilot's `xp` increases by exactly 1 (F1).
- **GIVEN** a deployed mech ending the battle `Removed(Defeated)`, **WHEN**
  `battle_ended` fires, **THEN** its pilot receives 0 XP **and** `status` becomes
  `Dead` (F1 + F4).
- **GIVEN** a lost battle in which a deployed mech survived, **WHEN** `battle_ended`
  fires, **THEN** its pilot still receives `pilot_xp_per_battle` (Rule 11).
- **GIVEN** a pilot on a benched mech, **WHEN** a battle completes, **THEN** its `xp`
  is unchanged (Rule 12).
- **GIVEN** defaults `T₂ = 2`, `T₃ = 4`, **WHEN** `xp` is 0, 1, 2, 3, 4, 5,
  **THEN** `level(xp)` returns 1, 1, 2, 2, 3, 3 respectively (F2).
- **GIVEN** the same `runSeed`, pilot id, and level, **WHEN** `offerSet` is computed
  twice, **THEN** both calls return an identical, identically-ordered array (F3).
- **GIVEN** two pilots levelling in the same battle, **WHEN** their offer sets are
  generated, **THEN** the sets are drawn independently (different pilot-id salt).
- **GIVEN** a pilot already holding skill `S`, **WHEN** a level-up offer is generated,
  **THEN** `S` does not appear in the offer set (F3).
- **GIVEN** a roster in which every member has a non-null `pilotId`, **WHEN** a
  `DraftOffer` set is generated, **THEN** no `PilotOffer` appears in it (F5).
- **GIVEN** a roster with at least one `pilotId == null`, **WHEN** offers are
  generated, **THEN** `PilotOffer` is eligible for the draw (F5).
- **GIVEN** a mech whose pilot is `Dead`, **WHEN** `effectiveSkills` is called,
  **THEN** it returns `[]` (F6).

**Cross-system**

- **GIVEN** a mech equipped with S4 Last Stand that would be `Removed(Defeated)`,
  **WHEN** S4 triggers and the battle ends, **THEN** the mech's final state is `Alive`
  at 1 HP, its pilot survives, **and** the pilot receives XP normally (Rule 15).
- **GIVEN** a battle in which a mech is `Removed`, **WHEN** `battle_ended` completes,
  **THEN** `RosterMember.currentHP` is 1 (Draft Rule 3, unchanged) **and**
  `RosterMember.pilotId` is `null` (Rule 13).
- **GIVEN** any battle, **WHEN** the simulation core executes, **THEN** no Combat
  Resolution, Board & Grid, Turn & Phase Manager, or Move Preview code path reads or
  writes a `PilotInstance`.
- **GIVEN** a mid-run save, **WHEN** it is reloaded, **THEN** every `PilotInstance`
  (`level`, `xp`, `skills`, `status`) and every `RosterMember.pilotId` matches the
  pre-save state exactly.
- **GIVEN** a full run replayed from the same seed with identical player inputs,
  **WHEN** it completes, **THEN** every pilot's level, skill set, and living/dead
  status is identical to the first playthrough.

**Performance**

- Pilot resolution runs once per `battle_ended`, over at most `squad_size` (3) mechs.
  It has no per-frame or per-turn cost and no measurable frame-time budget.

---

## Open Questions

1. **Superseded contract cleanup.** Four documents carry forward-references written
   against the original chassis-modifier concept and are corrected in this document's
   landing changeset: `heroes-and-abilities.md` (lines 357, 693 — Pilots no longer
   overrides `maxHP`/`moveRange`), `ability-upgrades.md` (lines 212, 712–717 — the
   real lane is action economy), `draft-and-loadout-meta.md` (line 297 — `PilotOffer`
   activated; Rule 3 scoped to mechs), and `adr-0008` (line 262 — `hazardImmunities`
   is sourced from Passive Modules S2/S3, not Pilots). *Owner:* this changeset.
   *Verify with:* `/consistency-check`.

2. **Five-axis legibility risk.** A mech now carries signature ability, 2 upgrade
   slots, 2 equipment slots, and 1 pilot slot. Into the Breach has 2 axes. Rule 5's
   lane separation and the portrait-not-icon direction in Visual/Audio Requirements
   are the mitigations. If playtest shows legibility suffering, the first lever is
   reducing `equipmentSlots` from 2 to 1 — recorded so it is not rediscovered from
   scratch. *Owner:* playtest, and the next `/review-all-gdds` pass.

3. **Do pilots persist across runs?** This document scopes pilots strictly to a single
   run. Into the Breach persists them via time pods, which is a meta-progression
   mechanic. Whether VANGUARD wants that belongs to `meta-progression-and-unlocks.md`,
   not here. *Owner:* Meta-progression / Unlocks, if the mechanic is wanted.

4. **Pilot skill catalog size and tiering.** F3 requires at least
   `pilot_skill_offer_count + pilot_max_level` (6 with defaults) skills. Whether the
   catalog is flat or rarity-tiered like `passive-modules-and-equipment.md` is
   unresolved. *Owner:* a content pass, tracked alongside the other content rosters in
   `design/content/`.

5. **Should a `PilotOffer` be declinable?** Rule 9 removes the skip path from
   *level-up* offers because they carry no opportunity cost. A `PilotOffer` in a draft
   set does compete with other offers, so `draft-and-loadout-meta.md` Rule 8's
   structural `SkipOffer` should already cover it — but this has not been verified
   against that document's offer-set assembly. *Owner:* Draft / Loadout Meta.
   *Verify with:* `/consistency-check`.

---

## Review Status

> **Design Review**: not yet run. Execute `/design-review design/gdd/pilots.md` in a
> **fresh session** — the reviewing agent must be independent of this authoring context.
>
> **Specialist gates not consulted** (Lean review mode; subagent dispatch unavailable
> in the authoring session): `systems-designer` (Formulas, Edge Cases), `qa-lead`
> (Acceptance Criteria), `art-director` (Visual/Audio), `creative-director`
> (CD-GDD-ALIGN pillar review). Review manually before production.
