# Pilots

> **Status**: Revised per `/design-review` 2026-07-28 (MAJOR REVISION items addressed; independent re-review pending)
> **Author**: user + main session; revised against full specialist review (game-designer, systems-designer, economy-designer, qa-lead, creative-director)
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

1. **Early (battle 1)** — pilots are near-anonymous. A name, a portrait, one
   innate skill. The player deploys freely.
2. **Middle (battles 2–3)** — a pilot reaches level 2, then 3. The player *chose*
   those skills. The mech in the left column is no longer "the Vanguard"; it is
   "Reyes, who can double-move and deploys forward." With the retuned curve
   (`T₃ = 3`, Formula F2) a starting pilot reaches peak value by roughly the third
   combat — **while there is still run left for that value to matter.**
3. **The high-stakes mid-to-late battles** — this is where the system fires. A
   surviving veteran carries three hand-picked skills *and* future value into every
   remaining node, so the player now hesitates over a tile they would have taken
   without thinking in battle 1. **That hesitation is the entire system working.**
   It is deliberately located here, not at the terminal Boss: because pilots are
   run-scoped (Open Questions #3) and the Boss is the last node, a Boss-node death
   has no *mechanical* future cost — win and the run is over, lose and it is over
   anyway. The hesitation that survives to the Boss is therefore **purely emotional**
   (Relatedness overriding optimization), which is the truest form of this feeling —
   but it can only exist if attachment was built earlier, which is why the mid-run
   beat and the narrative-content requirement (Visual/Audio Requirements) are
   load-bearing, not decorative.
4. **If they die** — the mech is fine. It fights the next battle on an AI Core, at
   full effectiveness minus the skills the player picked by hand. Nothing is
   unrecoverable; something is genuinely gone — and under the ironman save policy
   (Rule 21) it stays gone.

This directly serves **Pillar 2 (Positioning Over Power)** by pushing it up a layer:
positioning now carries a consequence that outlives the battle. It serves the
**Relatedness** need identified in `game-concept.md`'s motivation profile, which
currently has no mechanical support anywhere in the design.

What this fantasy is **not**: it is not a stat-growth fantasy. A pilot never makes a
mech hit harder or survive longer — those levers belong to other systems. A pilot
makes a mech *do more things per turn*, which is a fantasy about tempo and command,
not about power.

---

## Detailed Rules

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

16. **Starting allocation.** Each of the `squad_size` mechs in the starting squad
    begins the run with a pilot at level 1 and `xp = 0`. Mechs recruited mid-run
    through a `NewHeroOffer` arrive with an **AI Core** (no pilot, no XP).

17. **Acquisition is via `PilotOffer`.** `draft-and-loadout-meta.md` Rule 8 already
    reserves `PilotOffer` in the `DraftOffer` union; this document activates it. A
    `PilotOffer` is generated **only when at least one roster member has
    `pilotId == null`** (Formula F5), so an offered pilot always has a cockpit to
    occupy. A pilot acquired via `PilotOffer` is created with **seed XP** (Formula
    F7) scaled to how far the run has progressed, so a late recruit can still reach
    L2–L3 in the remaining nodes — but is always kept strictly behind a pilot that
    survived every battle from the start, preserving the gradient Rule 12 protects.
    Without this catch-up a mid-run `PilotOffer` reaches at most L1–L2 and is a trap
    pick against the immediate value of an `AbilityUpgradeOffer` (see F7 rationale).

18. **Reassignment happens only on the Loadout Configuration screen.** A pilot may be
    moved between mechs, or moved into an empty cockpit, exclusively on the Loadout
    Configuration screen specified in `draft-loadout-ui.md` Rule 4. No new screen is
    introduced, and reassignment is never available mid-battle.

19. **Reassignment carries the pilot whole.** Level, XP, and the full `skills` array
    move with the pilot. Nothing is reset or re-rolled by reassignment.

20. **A run is never made unwinnable by pilot loss.** If every pilot dies, all mechs
    run on AI Cores and remain fully functional. The system has no death spiral: the
    worst case is the baseline experience.

21. **Pilot death is permanent under an ironman save policy.** The run uses a
    **single-slot autosave that resumes but never rewinds**: state is committed at
    the terminal `battle_ended` event (the same point F4 resolves death), and there
    is no manual save-slot or pre-battle checkpoint the player can reload to undo a
    death. This is what makes "something is genuinely gone" true rather than
    aspirational — without it, deterministic replay (Acceptance Criteria) plus a
    reloadable mid-run save would make every death retroactively avoidable, and the
    entire premise of the system would collapse into save-scumming. This policy is a
    **run-persistence contract**, not a pilots-only rule: it is owned by
    `run-persistence.md` and formalised in **ADR-0012 (proposed): Ironman Run
    Commitment** (see Dependencies and Open Questions #6). Pilots does not implement
    saving; it depends on this commitment.

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

**Pilot level** (per `PilotInstance`): `L1 → … → L(pilot_max_level)` (default `L1 → L3`).
Monotonic, driven solely by `xp` crossing the Formula F2 thresholds. No transition
decreases level; death does not decrement, it terminates. A pilot may *enter* the pool
above L1 only via F7 seed XP (mid-run recruits).

**Level-up resolution** (per level gained): `Pending → Offered(skills[]) → Resolved(chosen)`.
Evaluated at `battle_ended` after XP is awarded. If a single XP award crosses two
thresholds at once — impossible with default knobs (`X = 1`), but legal if
`pilot_xp_per_battle` is tuned up or an F7-seeded recruit's first award crosses two —
the level-ups resolve sequentially, each with its own offer set (Edge Cases,
`resolveLevelUps` loop).

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
Input & Selection, Objective / Win-Lose, Audio System. The **simulation core is
untouched** — no combat/turn/preview code path reads a `PilotInstance`.

> **Move Preview specifically requires no change** because it simulates the
> consequence of an *already-committed* action; it is agnostic to how many action
> slots a mech has remaining, which is the only thing action-economy skills alter.

**Systems requiring a display-only change (Pillar 1 — Perfect Information):** two of
the three pilot-skill lanes produce battle-time state the player must see to plan,
so the earlier draft's "Battle HUD / Board Rendering: zero changes" claim was wrong
and is corrected here:

- **Battle HUD** must render a mech's *actual* action-slot availability when an
  action-economy skill (e.g. Reserve Thrusters) grants an extra slot use — a mech
  with three effective uses must not display as two, or the player cannot plan
  legally (Pillar 1). This is a read of an already-dynamic action count, not new
  simulation state.
- **Board Rendering & Juice / deploy overlay** must highlight the *widened* legal
  deploy-tile set at Setup when a deployment-lane skill extends it, for the same
  reason. Encounter Generator still authors the zone; the renderer must draw the
  extended legal set, not the base zone.

Both are additive display reads, not simulation changes. They are recorded as **soft
downstream dependencies** (Dependencies section).

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
| `deployedLoadout` | — | RosterMember[] | length == `squad_size` (default 3) | Mechs deployed at battle Setup |
| `mech.unit.finalState` | — | enum | `Alive \| Removed(Defeated) \| Removed(Fell)` | The mech's `Unit` state at `battle_ended` |

**Output Range:** 0 to `pilot_xp_per_battle` per pilot per battle. Across a default
run (~4–5 combat nodes), a pilot deployed and surviving throughout accrues 4–5 XP.

**Example:** Squad of 3 deployed. Mech A survives (pilot has 1 XP → 2 XP). Mech B
survives (0 XP → 1 XP). Mech C ends `Removed(Defeated)` — awards 0, and its pilot
dies via F4 regardless. Note the award applies whether the battle was won or lost
(Rule 11), and pilots on benched mechs receive nothing (Rule 12).

### F2 — Level from XP

Level is derived from cumulative XP against an **ascending threshold array**
`pilot_level_thresholds`, indexed by target level `2 .. pilot_max_level`, where
`pilot_level_thresholds[i]` is the cumulative XP required to reach level `i`. This
form makes `pilot_max_level` a true parameter (the earlier hardcoded `1 / 2 / 3`
clauses were correct only at the default `L = 3` and could neither honour `L = 1`
nor reach levels 4–5 at `L = 5`):

```
level(xp):
    lvl = 1
    for i in 2 .. pilot_max_level:                 # ascending
        if xp ≥ pilot_level_thresholds[i]: lvl = i
        else: break                                 # array is ascending — no higher level qualifies
    return lvl
```

**Variables:**

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| `xp` | `x` | int | 0–∞ (practically 0 – `T[L]`) | Pilot's cumulative XP |
| `pilot_level_thresholds` | `T[2..L]` | int[] | strictly ascending; `len == pilot_max_level − 1` | Cumulative XP per level. Default `[T₂ = 2, T₃ = 3]` |
| `pilot_max_level` | `L` | int | 1–5 (default **3**) | Number of levels; equals `len(T) + 1`. XP beyond `T[L]` has no effect |

**Output Range:** genuinely 1 to `pilot_max_level` (previously true only at default).
Monotonically non-decreasing in `xp`. At `L = 1` the loop never executes and every
pilot stays L1 (death costs only the innate skill); at `L = 5` a five-entry threshold
array makes levels 4–5 reachable.

**Invariant:** `pilot_level_thresholds` must be **strictly ascending** and have length
`pilot_max_level − 1`. This is validated and rejected (not clamped) at content/config
load by **Formula F8**; a non-ascending array (the old `T₂ ≥ T₃` misconfiguration)
would make an intermediate level unreachable and break Rule 8's `length == level`.

**Example (defaults `T = [2, 3]`):** `level(0)=1`, `level(1)=1`, `level(2)=2`,
`level(3)=3`, `level(4)=3`, `level(5)=3`. After battle 1 (`xp=1`) → L1; after battle 2
(`xp=2`) → L2, first skill chosen; after battle 3 (`xp=3`) → L3, second skill chosen.
A starting pilot deployed every battle reaches **maximum value by ~the third combat**
of a ~4–5-combat run — while there are still high-stakes nodes left for that value to
matter, which is the window the Player Fantasy places the hesitation beat in. (The
prior `T₃ = 4` default landed L3 at battle 4, at or after the median run's Boss;
economy-designer review showed the modal run then never fielded a full L3 kit.)

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

**Catalog constraint (applies to the *unlocked* subset, not the authored total).**
The `≥ N + pilot_max_level` size floor guarantees `eligible` never drops below `N`
at any level-up. If Meta-progression ever unlock-gates individual pilot **skills**
(distinct from gating `PilotDefinition`s, which it already may — Dependencies), the
floor must be evaluated against the *currently unlocked* catalog the shuffle actually
draws from, or the empty-eligible edge case (Edge Cases) can trigger earlier than the
authored count implies. F8 validates the unlocked subset for this reason. If skills
are never unlock-gated, that is equivalent and F8 simply validates the full catalog.

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
| `mech.pilotId` | — | `PilotInstance.id \| null` | resolves in `RunState.pilots`, or `null` | Cockpit occupancy before resolution |

**Output:** at most one `PilotInstance.status` transition to `Dead` per deployed mech
per battle; at most `squad_size` deaths in a single battle.

**Ordering note:** the "no dying pilot levels up" guarantee does **not** actually
depend on F4 running after F1 — it falls out of F1's own guard. F1 keys XP on the
mech's `finalState` (a `Removed` mech earns 0 regardless of `pilotId`), while F4 is
the only formula that mutates `pilotId`, and only for `Removed` mechs. Swapping F1/F4
execution order would therefore not break the invariant; the load-bearing condition
is the shared `finalState ≠ Removed` test, not the sequencing. (F4 is still specified
to run after F1 for readability.)

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

`effectiveSkills(mech) = pilots[mech.pilotId].skills   if  mech.pilotId ≠ null ∧ pilots[mech.pilotId] exists ∧ pilots[mech.pilotId].status = Active`
`effectiveSkills(mech) = []                            otherwise`

**Output Range:** 0 to `pilot_max_level` skill ids.

**Note on the guards.** Two guards make this formula total:
- The `pilots[mech.pilotId] exists` check protects against a **dangling `pilotId`**
  (a `RosterMember.pilotId` that resolves to nothing in `RunState.pilots` — e.g. a
  corrupted or partially-migrated save). Without it, `pilots[mech.pilotId].status`
  dereferences `undefined` and throws.
- The `status = Active` check is defensive against a dead-but-still-referenced pilot.
  Rule 13 sets `pilotId = null` at the same moment it sets `status = Dead`, so this
  state *should* be unreachable — and it is genuinely unreachable rather than merely
  unlikely **because ADR-0002's synchronous, non-async event bus guarantees F4's two
  writes cannot be interleaved by another reader**. The guard does not paper over a
  race; it makes the formula robust to a future save-schema change that could
  reintroduce the state.

### F7 — Seed XP for mid-run recruits (catch-up)

A pilot created by an accepted `PilotOffer` (Rule 17) does not start at `xp = 0` like
a starting pilot (Rule 16). It is seeded so it can still reach L2–L3 in the remaining
nodes, while remaining **strictly behind** a pilot that survived every battle from the
start.

`seedXP(recruit) = clamp( (combatsElapsed − pilot_seed_xp_lag) × pilot_xp_per_battle,  0,  pilot_level_thresholds[pilot_max_level] − 1 )`

**Variables:**

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| `combatsElapsed` | — | int | 0 – combat-node count | Combat nodes already resolved this run (read from run state; owned by Run Structure / Draft-Loadout Meta) |
| `pilot_seed_xp_lag` | `Δ` | int | 0–3 (default **1**) | How many qualifying battles behind a run-long survivor a recruit starts |
| `pilot_xp_per_battle` | `X` | int | 0–5 (default **1**) | Reuses F1's knob |
| `pilot_level_thresholds[pilot_max_level]` | `T[L]` | int | — | The max-level threshold; the cap keeps a recruit **below** max level on arrival |

**Output Range:** `0` to `T[L] − 1` XP. The lower `clamp` handles early recruitment
(`combatsElapsed < Δ` → `0`). The upper `clamp` guarantees a recruit **never arrives
already at `pilot_max_level`** — it must still earn its final level in play.

**Why it never catches a survivor:** a pilot deployed and surviving every battle has
`xp = combatsElapsed` (F1). A recruit seeded at `(combatsElapsed − Δ) × X` with `Δ ≥ 1`
starts at least `Δ` qualifying battles behind, and both gain `X` per battle thereafter,
so the gap is preserved for the rest of the run. This delivers the "add catch-up"
decision without flattening the gradient Rule 12 protects.

**Example (defaults `Δ=1`, `X=1`, `T=[2,3]`):** a `PilotOffer` accepted after 3
combats seeds `seedXP = clamp((3−1)×1, 0, 2) = 2` → the recruit arrives at **L2** with
one guaranteed level-up choice, versus the old behaviour where it arrived at L1 with no
realistic path to L3. A survivor at that same point has `xp = 3` (L3) — still ahead.

### F8 — Content/config-load validation

A single validator, run once at content/config load (owned by the content-load path
in **Draft / Loadout Meta**, alongside its existing offer-pool loading), rejects the
misconfigurations F2 and F3 describe. It is a load-time gate, **not** a runtime branch.

```
validatePilotConfig(cfg, unlockedSkillCatalog):
  assert len(cfg.pilot_level_thresholds) == cfg.pilot_max_level − 1        # F2 shape
  assert cfg.pilot_level_thresholds is strictly ascending                 # F2 invariant (was T₂ < T₃)
  assert len(unlockedSkillCatalog) ≥ cfg.pilot_skill_offer_count + cfg.pilot_max_level   # F3 floor, unlocked subset
  # each assert fails LOUD at load — reject the build/config, never clamp
```

**Output:** pass, or a hard load-time rejection naming the violated constraint.

**Rationale:** the earlier draft described both invariants ("must be validated at
config load") but named no owner, no check, and no test — which the project's own
`design-docs.md` "no hand-waving" rule forbids. F8 gives them one owner, an explicit
check, and testable Acceptance Criteria (see Acceptance Criteria § Config validation).

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

- **If a single XP award crosses two level thresholds at once** (possible when
  `pilot_xp_per_battle` is tuned above 1, or via F7 seed XP): the level-ups resolve
  **sequentially**, one offer set per level gained, via this loop at `battle_ended`
  after F1:
  ```
  resolveLevelUps(pilot):
    target = level(pilot.xp)                          # F2
    for L in (pilot.level + 1) .. target:             # bound is F2's target, honours pilot_max_level
      offer = offerSet(pilot, runSeed) at pilot.level = L − 1   # F3, salted by the level being gained
      chosen = playerChoose(offer)                    # Rule 9 — no skip
      pilot.skills.append(chosen); pilot.level = L
  ```
  Because the F3 salt includes the level being gained, the offer sets are independent,
  and a skill chosen in an earlier step is excluded from later steps by F3's
  `\ pilot.skills` subtraction. The loop bound is `level(pilot.xp)`, so it honours
  `pilot_max_level` at any tuning (this is the formula the prior draft described only
  in prose).

- **If `eligible` in F3 is smaller than `pilot_skill_offer_count`**: offer all
  remaining eligible skills. The player still must choose one (Rule 9). F8's load-time
  catalog-size floor is what keeps this from happening under intended tunings.

- **If `eligible` in F3 is empty**: the level-up grants no skill. `level` still
  increments and `xp` is still recorded, but Rule 8's `length == level` invariant is
  broken by necessity. **This state is prevented, not handled at runtime:** F8 rejects
  at content-load any catalog with fewer than `pilot_skill_offer_count + pilot_max_level`
  entries (evaluated against the *unlocked* subset, per F3's catalog constraint).

- **If `pilot_level_thresholds` is not strictly ascending** (misconfiguration, e.g.
  the old `T₂ ≥ T₃`): F2's loop would let a higher level's threshold mask an
  intermediate one, so a pilot could jump 1 → 3 and gain one skill for two levels,
  breaking Rule 8. This is **rejected at content/config load by F8**, not clamped and
  not handled at runtime.

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
  are restored verbatim. Because `level` derives from `xp` via F2 rather than being
  independently stored, `level` and `xp` cannot desynchronise **within a single
  balance configuration**. There is no player-facing "reload to before a death" here:
  under Rule 21's ironman single-slot autosave, loading resumes the committed run
  state and cannot rewind past a `battle_ended` at which a pilot died.

- **If the pilot balance knobs change between sessions** (a balance patch to
  `pilot_level_thresholds`): a loaded pilot's `level` is recomputed from stored `xp`
  under the *new* thresholds, but its stored `skills` array is not touched — which can
  reintroduce the `length == level` violation Rule 8 forbids (e.g. thresholds raised,
  so a pilot's recomputed level drops below its skill count). Pilot-knob changes are
  therefore **not retroactive-safe** and require a save-migration step (reconcile
  `skills` length to the recomputed level) owned by Run Persistence's schema-version
  handling. Same-session reload (no knob change) is unaffected. *Flagged for
  `run-persistence.md` migration handling.*

- **If a `PilotOffer` is accepted mid-run**: the new pilot is created with F7 seed XP
  (not `xp = 0`), so `level(seedXP)` may be L2 immediately. This is the only path by
  which a pilot enters the pool above L1; it never exceeds `pilot_max_level − 1` XP on
  arrival (F7 cap), so it always has at least one level-up left to earn in play.

---

## Dependencies

### Upstream (systems Pilots depends on)

| System | What Pilots consumes | Hard / Soft |
|---|---|---|
| **Draft / Loadout Meta** | `RosterMember` (to add `pilotId`), `Roster`, the `DraftOffer` union (to activate `PilotOffer`), and the `battle_ended` write-back hook where F1/F4 attach | **Hard** |
| **Heroes & Abilities** | `HeroDefinition` id/name/class for display only; the `Unit` record's terminal vitality state (`Removed(Defeated \| Fell)`) as F4's trigger | **Hard** |
| **Turn & Phase Manager** | The Player Phase action-slot model (`actions_per_hero_turn = 2`) that action-economy skills modify | **Hard** |
| **Run Persistence** | Serialisation of `RunState.pilots` and `RosterMember.pilotId`; **the ironman single-slot autosave commitment (Rule 21, ADR-0012 proposed)** that makes pilot death permanent; the balance-knob save-migration step (Edge Cases) | **Hard** |
| **Run Structure / Node Map** | `combatsElapsed` (combat nodes resolved this run), read by F7 seed-XP | **Soft** — absent it, F7 degrades to `seedXP = 0` and mid-run recruits start at L1 |
| **Encounter Generator** | `deploy-zone` tile flags, which deployment-lane skills extend | **Soft** — Pilots functions with an empty deployment lane |
| **Meta-progression / Unlocks** | May gate `PilotDefinition` catalog availability, and *possibly* individual pilot-skill availability (F3/F8 evaluate the unlocked subset) | **Soft** — the schema is valid whether or not gating exists |

### Downstream (systems that depend on Pilots)

| System | What it consumes | Hard / Soft |
|---|---|---|
| **Draft/Loadout UI** | Pilot name, portrait, level, XP, `skills`; the level-up offer set and its selection input; the death notification; cockpit-empty state on Roster Cards | **Hard** |
| **Draft / Loadout Meta** | F5's `pilotOfferEligible` predicate, evaluated before emitting a `PilotOffer`; **a `w_pilot` draw weight in its `generateOffers` formula so `PilotOffer` can actually be selected** (see cross-doc note below) | **Hard** |
| **Run Persistence** | The `PilotInstance` schema shape | **Hard** |
| **Battle HUD** | A mech's *effective* action-slot count when an action-economy skill grants extra uses (Pillar 1 in-battle visibility — Detailed Rules) | **Soft** — display-only; no effect if no such skill is equipped |
| **Board Rendering & Juice** | The *widened* legal deploy-tile set at Setup when a deployment-lane skill extends it (Pillar 1) | **Soft** — display-only |
| **Narrative-director / Writer** | Per-pilot narrative content — name, portrait brief, a death line, optional deployment barks (Visual/Audio Requirements) — authored in a content pass | **Soft** — Pilots functions mechanically without it, but the Relatedness fantasy does not (see Player Fantasy) |

### Explicitly not dependencies

Board & Grid, Combat Resolution, Move Preview, Input & Selection, Objective /
Win-Lose, and Audio System have **no** relationship with this system in either
direction. Pilots is a run-layer system; **the simulation core requires zero changes.**
(Battle HUD and Board Rendering & Juice were previously listed here in error — they
carry display-only changes to surface action-economy and deployment skill effects
per Pillar 1; they are now soft downstream dependencies above.)

**Cross-doc contradiction to resolve before Sprint 1 (blocking).** `draft-and-loadout-meta.md`
Rule 8 declares `PilotOffer` "active", but that document's `generateOffers` formula
defines a draw pool and category weights (`w_new`, `w_upg`) with **no `w_pilot`** — so
as literally specified, a `PilotOffer` can never be drawn, and Rule 8's prose and its
own formula disagree. Pilots' entire acquisition path (Rule 17, F5) depends on this
being fixed in `draft-and-loadout-meta.md` (add `w_pilot`, gated by F5). *Owner:*
Draft / Loadout Meta. *Verify with:* `/consistency-check` (tracked in Open Questions #5).

**Bidirectional-consistency note:** `draft-and-loadout-meta.md`, `heroes-and-abilities.md`,
`ability-upgrades.md`, and `adr-0008` all carry forward-references written against the
superseded chassis-modifier concept. Those are corrected as part of this document's
landing changeset (see Open Questions #1).

---

## Tuning Knobs

| Knob | Default | Safe range | Affects | Too high | Too low |
|---|---|---|---|---|---|
| `pilot_xp_per_battle` | 1 | 0–5 | Level pacing | Pilots max out in ~2 battles; the level-up choice loses weight and recruits catch up instantly, flattening the gradient Rule 12 protects | At 0, no pilot ever levels; the system degenerates to a static one-skill attachment |
| `pilot_level_thresholds[T₂]` | 2 | 1–10 | First skill timing | Level 2 arrives late; the player never gets to use their chosen skill | At 1, a pilot levels after its first battle before any attachment forms |
| `pilot_level_thresholds[T₃]` | **3** | `T₂`+1 – 20 | Peak timing | Level 3 unreachable in a default-length run; the ceiling is decorative | Peak arrives too early, so the highest-stakes stretch has no remaining growth |
| `pilot_max_level` | 3 | 1–5 | Skill ceiling per pilot; also the length of `pilot_level_thresholds` (`= L − 1`) | More skills per pilot compounds the five-axis legibility risk (Open Questions #2) and demands a larger catalog per F3/F8 | At 1, pilots never grow and death costs only the innate skill |
| `pilot_skill_offer_count` | 3 | 2–5 | Choice breadth at level-up | Approaches "pick anything"; build identity blurs and the catalog must grow to keep offers distinct | At 2, offers frequently feel forced |
| `pilot_seed_xp_lag` | 1 | 0–3 | Mid-run recruit catch-up (F7) | At 3+, a recruit lags so far it can't reach L2 before run end — `PilotOffer` reverts toward a trap pick | At 0, a recruit ties a run-long survivor's XP, erasing the veteran-advantage gradient Rule 12 protects |

**Interaction:** the `pilot_level_thresholds` entries are only meaningful relative to
`pilot_xp_per_battle` and to the run's combat-node count (~4–5 with
`run-structure-node-map.md` defaults `map_depth = 6`). The default `[2, 3]` is chosen
so a starting pilot reaches L3 by ~the third combat, leaving late nodes as a
high-stakes window with a fully-levelled pilot (see F2 example and Player Fantasy).
Retune the thresholds and `pilot_xp_per_battle` together; **changing `map_depth`
invalidates the current thresholds** — `map_depth` is a 3–12 knob owned by
`run-structure-node-map.md`, and there is currently no shared derivation tying the two
(recommended follow-up: derive thresholds from `map_depth`, or add an F8 assertion that
flags a `map_depth` change without a pilot-threshold review — Open Questions #7).

**Constraint:** `pilot_level_thresholds` must be **strictly ascending** with length
`pilot_max_level − 1`. Enforced at load by Formula F8 (Edge Cases).

**Not knobs here:** `squad_size` (default 3) and `max_roster_size` (default 7) are
owned by `heroes-and-abilities.md` and `draft-and-loadout-meta.md` respectively. This
document reads them symbolically and must not redefine them.

---

## Visual/Audio Requirements

> `art-director` and `narrative-director` not consulted during authoring. Both gates
> are now **required before production** (see Narrative Content Requirement below and
> the downstream Narrative dependency). Evidence: screenshot + art-director/qa-lead
> sign-off, **ADVISORY** gate per `coding-standards.md`'s test-evidence table.

**Pilots must read as people, mechs must read as machines.** This is the primary
mitigation for the five-axis legibility risk (Open Questions #2): a pilot must not
look like another equipment slot.

- **Portrait, not icon.** Each `PilotDefinition` has a `portraitId` rendering a human
  face. Every other progression axis in VANGUARD renders as a geometric icon; the
  portrait is what makes a pilot occupy different cognitive bandwidth.
- **Name prominence.** A piloted mech displays the pilot's name; an AI Core mech
  displays no name field at all, rather than a placeholder. Absence should be visible.
- **Level pips.** Level renders as 1–`pilot_max_level` filled pips beside the portrait,
  matching the existing upgrade-slot pip language in `draft-loadout-ui.md` Rule 3 so
  the vocabulary stays consistent.
- **Death is the loudest moment in the run.** Pilot death is the only permanent loss
  in VANGUARD and must be presented as such — a distinct post-battle beat, not a line
  in a results list. The portrait is the focus of that beat.
- **Art Bible alignment**: `art-bible.md` §2 assigns Defeat "desaturated, harsh cold
  downlighting, clinical, abruptly silent". Pilot death should borrow that register
  even when the battle itself was won.
- **Audio**: one dedicated pilot-death cue, used nowhere else. Per `audio-system.md`'s
  clarity-first direction, it should be short and unmistakable rather than dramatic.
  Level-up gets a distinct, warmer cue.

### Narrative Content Requirement (required before production)

The whole system exists to serve the **Relatedness** need, which `game-concept.md`
notes has *no other mechanical support in the design*. The mechanical layer (portrait
+ name + skills) is necessary but not sufficient to make the player feel "**her**" —
attachment needs actual content, not just a level pip. Therefore each `PilotDefinition`
must carry a light narrative payload, authored in a content pass with `narrative-director`
and `writer`:

- **Name** (already in schema) and a **portrait brief** for the asset pass.
- **A death line** — one short piece of text or VO shown at the death beat. This is the
  single highest-leverage attachment element and is **required, not optional**.
- **Optional deployment barks** — 1–2 short lines surfaced on deploy/level-up, if the
  content budget allows. Advisory.

This is deliberately *light* (consistent with the concept doc ranking Narrative as the
lowest-priority aesthetic) — a death line and a portrait, not a character arc. But the
death line specifically is load-bearing on the emotional payoff and must not be cut to
"portrait only". *Owner:* a narrative content pass (`team-narrative` / `narrative-director`),
tracked alongside the pilot-skill catalog content (Open Questions #4).

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
required alongside it — a portrait alone fails Accessibility A1 (shape/icon redundancy)
and its F3 greyscale test, both BLOCKING gates in `accessibility.md` (#27).

---

## Acceptance Criteria

Each AC is tagged with its **story type** and **gate level** per `coding-standards.md`'s
test-evidence table: **[Logic / BLOCKING]** = automated unit test in `tests/unit/pilots/`;
**[Integration / BLOCKING]** = integration test or documented playtest; **[UI / ADVISORY]**
= manual walkthrough or interaction test; **[Visual / ADVISORY]** = screenshot + sign-off.

**Core rules — [Logic / BLOCKING]**

- **GIVEN** a mech with `pilotId == null`, **WHEN** it is deployed and the battle ends,
  **THEN** no XP is awarded, no death is resolved, and `effectiveSkills` returns `[]`.
- **(Rule 5, rewritten from "content review runs" — schema-exhaustiveness test)**
  **GIVEN** the `PilotSkillEffect` type union / skill-effect schema, **WHEN** the
  content-schema exhaustiveness test runs at build/content-load, **THEN** no variant or
  field of that schema is capable of writing `maxHP`, `moveRange`, `hazardImmunities`,
  or any `AbilityDefinition` field (`range`, `areaRadius`, `shape`, `targetFilter`,
  `effectTemplate`, `usesPerTurn`, `cooldownTurns`). *(Depends on the pilot-skill schema
  existing — flagged: the catalog is not yet authored, Open Questions #4.)*
- **(Rule 3, data-layer half — split out from the old UI-only AC)** **GIVEN** a direct
  call to the assignment mutator targeting a mech whose `pilotId != null`, **THEN** the
  assignment is rejected and no `pilotId` is overwritten (the "at most one pilot per
  mech / one mech per pilot" invariant holds independent of UI).
- **(Rule 8)** **GIVEN** a pilot at level `n`, **WHEN** its record is inspected at any
  time, **THEN** `len(skills) == n` — enforced together with F8, which makes the
  empty-catalog exception unreachable under a valid config.
- **(Rule 16)** **GIVEN** a fresh run, **THEN** each of the `squad_size` starting mechs
  has a pilot at level 1 with `xp = 0`, and a mech added by a `NewHeroOffer` has
  `pilotId == null` (AI Core).
- **(Rule 19)** **GIVEN** a pilot at level `n` with XP `x` and skill set `S`, **WHEN** it
  is reassigned from mech A to mech B, **THEN** its `level`, `xp`, and `skills` are
  byte-for-byte unchanged (nothing reset or re-rolled).

**Formulas — [Logic / BLOCKING]**

- **(F1)** **GIVEN** `pilot_xp_per_battle = 1` and a deployed mech ending the battle
  `Alive`, **WHEN** `battle_ended` fires, **THEN** its pilot's `xp` increases by exactly 1.
- **(F1 + F4)** **GIVEN** a deployed mech ending `Removed(Defeated)` **and** (separately)
  a mech ending `Removed(Fell)`, **WHEN** `battle_ended` fires, **THEN** in *both* cases
  the pilot receives 0 XP **and** `status` becomes `Dead` (both `Removed` variants tested).
- **(Rule 11)** **GIVEN** a lost battle in which a deployed mech survived, **THEN** its
  pilot still receives `pilot_xp_per_battle`.
- **(Rule 12)** **GIVEN** a pilot on a benched mech, **WHEN** a battle completes, **THEN**
  its `xp` is unchanged.
- **(Rule 10, negative-space)** **GIVEN** two deployed surviving mechs, one that removed 0
  enemies and one that removed 5, **THEN** both pilots receive identical XP (kill count has
  zero effect).
- **(F2, retuned defaults `T = [2, 3]`)** **WHEN** `xp` is 0, 1, 2, 3, 4, 5, **THEN**
  `level(xp)` returns 1, 1, 2, 3, 3, 3 respectively.
- **(F2 parameterisation)** **GIVEN** `pilot_max_level = 1`, **THEN** `level(xp) == 1` for
  all `xp`; **and GIVEN** `pilot_max_level = 5` with a valid 4-entry threshold array,
  **THEN** some `xp` yields `level == 5` (the formula honours `pilot_max_level`, not a
  hardcoded 3).
- **(F3 determinism — assert on inputs, not output)** **GIVEN** the same `runSeed`, pilot
  id, and level, **WHEN** `offerSet` is computed twice, **THEN** both calls return an
  identical, identically-ordered array.
- **(F3 independence — assert on the salt, not output equality)** **GIVEN** two pilots
  levelling in the same battle, **THEN** the `mix(runSeed, pilot.id, pilot.level)` seed
  values computed for the two differ (output-array comparison is rejected as flaky).
- **(F3)** **GIVEN** a pilot already holding skill `S`, **WHEN** an offer is generated,
  **THEN** `S` does not appear in it.
- **(F3 boundary)** **GIVEN** `eligible` smaller than `pilot_skill_offer_count`, **THEN**
  the offer contains all remaining eligible skills and the player must still choose one.
- **(Multi-level-up, Edge Cases)** **GIVEN** a single XP award that crosses two thresholds
  (`pilot_xp_per_battle` or F7 seed pushing past two levels), **THEN** two offer sets
  resolve sequentially, the second is salted by the second level, and a skill chosen in
  the first is absent from the second.
- **(F5)** **GIVEN** a roster where every member has non-null `pilotId`, **THEN** no
  `PilotOffer` is eligible; **and GIVEN** at least one `pilotId == null`, **THEN**
  `PilotOffer` is eligible.
- **(F6)** **GIVEN** a mech whose pilot is `Dead`, **THEN** `effectiveSkills` returns `[]`;
  **and GIVEN** a mech with a dangling `pilotId` (unresolved in `RunState.pilots`), **THEN**
  `effectiveSkills` returns `[]` without throwing.
- **(F7 catch-up)** **GIVEN** defaults `Δ = 1`, `X = 1`, `T = [2, 3]` and a `PilotOffer`
  accepted after 3 combats, **THEN** the recruit is created with `xp = 2` (level 2); **and**
  a pilot that survived all 3 combats has `xp = 3` (strictly ahead); **and** no seeded
  recruit is ever created at `xp ≥ T[pilot_max_level]`.

**Config validation — [Logic / BLOCKING]**

- **(F8)** **GIVEN** a `pilot_level_thresholds` that is not strictly ascending (e.g. the
  old `T₂ ≥ T₃`), **WHEN** content/config load runs, **THEN** the load is rejected with an
  error naming the violated invariant (not clamped, not silently accepted).
- **(F8)** **GIVEN** an (unlocked) `pilotSkillCatalog` with fewer than
  `pilot_skill_offer_count + pilot_max_level` entries, **WHEN** content load runs, **THEN**
  the load is rejected.
- **(F8)** **GIVEN** a `pilot_level_thresholds` whose length ≠ `pilot_max_level − 1`,
  **THEN** the load is rejected.

**Cross-system — [Integration / BLOCKING]**

- **(Rule 15)** **GIVEN** a mech equipped with S4 Last Stand that would be
  `Removed(Defeated)`, **WHEN** S4 triggers and the battle ends, **THEN** the mech's final
  state is `Alive` at 1 HP, its pilot survives, **and** the pilot receives XP normally.
- **(Rule 13)** **GIVEN** a battle in which a mech is `Removed`, **WHEN** `battle_ended`
  completes, **THEN** `RosterMember.currentHP` is 1 (Draft Rule 3) **and**
  `RosterMember.pilotId` is `null`.
- **(Rule 20 / all-dead)** **GIVEN** a run in which all three starting pilots have died,
  **THEN** all mechs are AI Cores, remain deployable, and no loss condition is triggered
  by pilot count.
- **(Simulation isolation — static import-boundary test, not a runtime claim)** **GIVEN**
  the module import graph, **THEN** no file under the simulation-core paths (Board & Grid,
  Combat Resolution, Turn & Phase Manager, Move Preview) imports or references the
  `PilotInstance` type. *(Strictly stronger than a per-battle runtime check.)*
- **(Rule 21 / permanence)** **GIVEN** a mid-run autosave and a battle in which a pilot
  died, **WHEN** the game is resumed from that autosave, **THEN** the run resumes *after*
  that `battle_ended` with the pilot `Dead` — there is no reachable save state from which
  the death can be replayed/undone.
- **(Save round-trip)** **GIVEN** a mid-run save, **WHEN** it is reloaded *under the same
  balance config*, **THEN** every `PilotInstance` (`level`, `xp`, `skills`, `status`) and
  every `RosterMember.pilotId` matches the pre-save state exactly.
- **(Replay determinism — fixture named)** **GIVEN** a recorded `PlayerInputLog` (movement,
  targeting, level-up skill picks, Loadout reassignments) replayed against a fixed
  `runSeed`, **WHEN** the run completes, **THEN** every pilot's level, skill set, and
  living/dead status is identical to the first playthrough. *(Requires the `PlayerInputLog`
  fixture format defined in `run-persistence.md`.)*

**UI — [UI / ADVISORY]**

- **(Rule 3, UI half)** **GIVEN** a pilot assigned to mech A, **WHEN** the player views
  mech B which already has a pilot, **THEN** the Loadout Configuration screen does not
  offer assignment into B's occupied cockpit.
- **(Rule 9)** **GIVEN** a level-up modal, **THEN** it presents `pilot_skill_offer_count`
  skills and exposes **no** skip/decline control.
- **(Accessibility A1 — BLOCKING gate in `accessibility.md` #27, given a local AC here)**
  **GIVEN** any pilot shown in the UI, **THEN** its identity is conveyed by **name text
  alongside** the portrait (never portrait/colour alone), passing the A1 shape-redundancy
  and greyscale checks.
- **(End-of-run summary)** **GIVEN** run end, **THEN** the summary lists every pilot,
  living and dead, with final level.

**Visual / Audio — [Visual / ADVISORY]** *(screenshot + art-director/qa-lead sign-off)*

- Pilots read as people and mechs as machines; the death beat is a distinct post-battle
  moment (not a results-list line); the pilot-death audio cue is unique to that event.
- The per-pilot **death line** (Narrative Content Requirement) is present and shown at the
  death beat. *(Requires narrative content pass — Open Questions #4.)*

**Performance — [Logic / BLOCKING] (call-count assertion, not a frame-time claim)**

- **GIVEN** a `battle_ended` event, **WHEN** pilot resolution (F1 + F4) runs, **THEN** the
  resolver is invoked exactly once per `battle_ended` (never per frame or per turn) and
  iterates at most `squad_size` mechs.

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
   slots, 2 equipment slots, and 1 pilot slot. Into the Breach has 2 axes. Mitigations:
   Rule 5's lane separation, the portrait-not-icon direction, and (added in this
   revision) the required in-battle display of action-economy and deployment skill
   effects (Detailed Rules) so those two lanes don't add *hidden* planning load.
   Review noted portrait-not-icon addresses *categorisation* but not planning-time
   *memory load*; if playtest shows legibility suffering, the first lever is reducing
   `equipmentSlots` from 2 to 1 — recorded so it is not rediscovered from scratch.
   *Owner:* playtest, and the next `/review-all-gdds` pass.

3. **Do pilots persist across runs?** This document scopes pilots strictly to a single
   run. Into the Breach persists them via time pods, which is a meta-progression
   mechanic. Whether VANGUARD wants that belongs to `meta-progression-and-unlocks.md`,
   not here. *Owner:* Meta-progression / Unlocks, if the mechanic is wanted.

4. **Pilot skill catalog size and tiering.** F3 requires at least
   `pilot_skill_offer_count + pilot_max_level` (6 with defaults) skills. Whether the
   catalog is flat or rarity-tiered like `passive-modules-and-equipment.md` is
   unresolved. *Owner:* a content pass, tracked alongside the other content rosters in
   `design/content/`.

5. **`PilotOffer` draw weight + declinability (blocking cross-doc).** Two coupled items
   for `draft-and-loadout-meta.md`: (a) its `generateOffers` formula must add a
   `w_pilot` draw weight gated by F5, or `PilotOffer` can never be drawn (Dependencies
   cross-doc note); and (b) whether a `PilotOffer` is declinable — Rule 9 removes the
   skip path from *level-up* offers (no opportunity cost), but a `PilotOffer` competes
   with other offers, so Rule 8's structural `SkipOffer` should cover it. Both unverified
   against that document's offer-set assembly. *Owner:* Draft / Loadout Meta.
   *Verify with:* `/consistency-check`.

6. **Ironman save commitment (ADR needed).** Rule 21 declares a single-slot,
   resume-only autosave so pilot death is permanent. This is a **run-persistence
   contract**, not a pilots-only rule, and needs **ADR-0012 (proposed): Ironman Run
   Commitment** authored during `/create-architecture`, plus the balance-knob
   save-migration step (Edge Cases). *Owner:* Run Persistence / architecture.

7. **Threshold ↔ `map_depth` coupling.** `pilot_level_thresholds` are only valid for the
   current combat-node count (~4–5 at `map_depth = 6`); `map_depth` is a 3–12 knob owned
   by `run-structure-node-map.md` with no shared derivation. Recommended: derive
   thresholds from `map_depth`, or add an F8 assertion that flags a `map_depth` change
   without a pilot-threshold review. *Owner:* systems-designer, next balance pass.

8. **Death-rate target (premise is load-bearing on it).** The "something at stake"
   premise assumes deployed mechs are `Removed` often enough that pilot loss actually
   occurs; at a low `Removed` rate most runs end with all three starting pilots alive
   and the hesitation beat never fires. The target rate is owned by Combat Resolution /
   Encounter Generator / Difficulty Tiers and is **not defined in any reviewed doc**.
   Recommended: define and track an expected per-tier `Removed` rate as an explicit
   cross-system target. *Owner:* systems-designer + combat balance, coordinate via
   `/review-all-gdds`.

9. **Pilot-skill strength must make fielding-the-veteran tempting.** The intended
   hesitation only exists if a veteran's skills are strong enough that benching one for
   an AI Core is a real sacrifice; if skills are weak, benching dominates. Skill impact
   is undefined until the catalog pass (#4) and must be tuned so an equipped pilot is a
   meaningful upgrade over an AI Core, without touching the forbidden chassis/ability
   lanes (Rule 5). *Owner:* the pilot-skill catalog content pass (#4).

---

## Review Status

> **Design Review**: **run 2026-07-28** (full mode, independent session). Specialists
> consulted: `game-designer`, `systems-designer`, `economy-designer`, `qa-lead`, and
> `creative-director` (senior synthesis). Verdict: **MAJOR REVISION NEEDED**.
>
> **This revision addresses that review.** All 9 blocking items resolved in-doc:
> XP-curve retune + fantasy reframe (F2, Player Fantasy); F2 parameterised on a
> threshold array; F8 config-load validation added and owned; ironman save policy
> (Rule 21, ADR-0012 proposed); mid-run catch-up (F7); narrative-content requirement
> (Visual/Audio); in-battle UI visibility for skill effects (Detailed Rules, corrected
> "zero changes" claim); AC rewrites + story-type/gate tags; `PilotOffer` cross-doc
> `w_pilot` gap flagged as blocking for `draft-and-loadout-meta.md`.
>
> **Still open (tracked, not blocking this doc):** ADR-0012 authoring (Open Q #6);
> the `draft-and-loadout-meta.md` `w_pilot` fix (Open Q #5, cross-doc — run
> `/consistency-check`); death-rate target and skill-strength tuning (Open Q #8, #9,
> cross-system); narrative + skill-catalog content passes (#4). Recommend an
> independent **re-review in a fresh session** before implementation.
