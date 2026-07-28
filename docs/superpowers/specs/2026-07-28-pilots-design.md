# Design Spec: Pilots

> **Date**: 2026-07-28
> **Status**: Approved (user sign-off during brainstorming session)
> **Replaces**: systems-index #25 "Pilots / Hero Modifiers" (original chassis-modifier concept — superseded)
> **Target GDD**: `design/gdd/pilots.md`
> **Priority**: Alpha | **Layer**: Feature | **Category**: Progression

---

## 1. Problem Statement

Systems-index #25 was reserved as "Pilots / Hero Modifiers" — a system that would
override `HeroDefinition` chassis fields (`maxHP`, `moveRange`, `hazardImmunities`).
Four already-Designed documents published forward-references to that contract:

- `heroes-and-abilities.md:357,693` — "Pilots reads/overrides `HeroDefinition` fields (`maxHP`, `moveRange`)", relationship **Hard**
- `ability-upgrades.md:212` — asserts Pilots and Ability Upgrades own disjoint field sets
- `draft-and-loadout-meta.md:297` — `PilotOffer` reserved in the `DraftOffer` union, not implemented in v1
- `adr-0008:262` — `hazardImmunities = []` "unless a future Pilots/Hero-Modifier override supplies one"

Two problems were found with that reserved contract:

**Problem 1 — no fiction.** No document declares what the game's units are. `game-concept.md`
frames VANGUARD as a "squad RPG" with "heroes"; `hero-roster-and-squads.md` gives each unit a
personal nickname ("The Bulldozer"). If a unit is already a named character, layering a pilot
on top produces two overlapping identities for one board piece — a direct hit on Pillar 5
(Read in Ten Seconds).

**Problem 2 — the reserved lane was taken.** `passive-modules-and-equipment.md` was authored
after the reservation (same day, 2026-07-28) and occupies the chassis lane outright:

| Passive Module | Effect | Chassis field claimed |
|---|---|---|
| T1 Pathfinder | `moveRange` +1 | `moveRange` |
| S2 Hazard Walker | immune to `Fire` | `hazardImmunities` |
| S3 Acid Walker | immune to `Acid` | `hazardImmunities` |
| S4 Last Stand | prevent `Removed(Defeated)`, set HP 1 | HP survival |

A Pilot skill reading "+1 moveRange" or "immune to Fire" would duplicate T1/S2 exactly —
two systems, identical effects, different slots.

---

## 2. Resolution

**Adopt the mecha fiction, and move Pilots to an unoccupied mechanical lane.**

Cost analysis for the fiction change (evidence-based):

| Document | Current state | Cost to declare mecha |
|---|---|---|
| `art-bible.md` | Pure abstract geometry; "blueprint"/"laboratory" lighting; "sleek, tactical" | **Zero** — already compatible |
| `hero-roster-and-squads.md` | "shield-like front plate", "armor", "mortar tube on shoulder"; self-describes units as "ITB Combat Mech analog" | ~1 fiction paragraph |
| `heroes-and-abilities.md` | Uses the term `chassis` 25 times | **Zero** — schema already assumes machines |
| `game-concept.md` | No fiction statement | ~1 paragraph |

The art and content layers already read as machines. The word "hero" was the only thing
implying people.

---

## 3. Fiction and Terminology

- Units are **mechs** — piloted machines.
- The player is the **commander**, directing them. This matches the existing Core Fantasy
  verbatim: *"I am a cunning commander who wins with my mind, not with numbers."*
- **Pilots** are the human element inside the mechs.

**Terminology decision:** schema identifiers `HeroDefinition`, `RosterMember`, and `Unit`
are **retained unchanged**. No production code exists yet, so renaming would be free in
code — but renaming across 24 reviewed GDDs immediately before Sprint 1 is pure risk for
zero gameplay value. Player-facing text says "mech"; the schema keeps `Hero*`. A terminology
note is added to `game-concept.md` recording this deliberate split.

---

## 4. Pilot Skill Lane

Pilot skills **may** affect:

- **Action economy** — the Move slot and Ability slot (`actions_per_hero_turn = 2`)
- **Deployment** — tile placement at battle Setup
- **Run level** — currency, draft, XP

Pilot skills **may not** affect:

- `maxHP`, `moveRange`, `hazardImmunities` → owned by **Passive Modules**
- Any `AbilityDefinition` field (`range`, `distance`, `amount`, `cooldownTurns`, `usesPerTurn`)
  → owned by **Ability Upgrades**

**Note on a closed sub-lane:** "may Move after using its Ability" is *not* available as a
pilot skill. `heroes-and-abilities.md:83` already grants every mech both orders
(Move-then-Ability, Ability-then-Move) as a base rule. ITB's Camila Vera skill has no
VANGUARD equivalent because VANGUARD gives it away for free.

### Illustrative skills

The full catalog is content work belonging to the GDD. These four establish the lane's shape:

| Skill | Lane | Effect |
|---|---|---|
| Reserve Thrusters | Action economy | Once per battle, this mech may use its Move slot a second time |
| Killing Momentum | Action economy | The first time this mech removes an enemy each battle, its Ability slot refreshes |
| Forward Deploy | Deployment | At battle Setup, this mech may be placed up to 1 tile outside the deploy-zone |
| Salvager | Run level | +1 Reputation per completed battle |

---

## 5. Data Model

```
PilotDefinition {            // authored content
  id: string
  name: string
  portraitId: string
  innateSkill: PilotSkillId
}

PilotInstance {              // per-run, mutable
  id: string
  pilotDefinitionId: string
  level: int                 // 1..pilot_max_level
  xp: int
  skills: PilotSkillId[]     // [innateSkill] ++ learned; length <= pilot_max_level
  status: Active | Dead
}
```

Additions to existing records:

```
RosterMember {
  ...existing fields
  pilotId: PilotInstance.id | null      // NEW — null means AI Core
}

RunState {
  ...existing fields
  pilots: PilotInstance[]               // NEW — run-level pool
}
```

`RosterMember.pilotId` is the single authority for assignment. `PilotInstance` carries no
back-reference, so there is no dual bookkeeping to keep in sync.

**AI Core**: `pilotId == null`. Not an entity — no record, no skills, no XP accumulation.
A mech with an AI Core is fully functional; it simply has no pilot skills.

---

## 6. XP and Leveling

Run length drives the curve. `run-structure-node-map.md` sets `map_depth = 6` plus a
mandatory Boss row = **7 nodes per run**. With node-type weights (Battle 0.40–0.50,
Elite 0.15), a run contains roughly **4–5 combat nodes**.

| Knob | Value | Rationale |
|---|---|---|
| `pilot_xp_per_battle` | 1 | Awarded at `battle_ended` to the pilot of each mech that was deployed **and** did not end the battle `Removed` |
| `pilot_level2_xp` | 2 | Cumulative. Reached after ~2 battles |
| `pilot_level3_xp` | 4 | Cumulative. Reached after ~4 battles — i.e. right as the run reaches the Boss |
| `pilot_max_level` | 3 | Yields at most 3 skills: 1 innate + 2 learned |
| `pilot_skill_offer_count` | 3 | Skills offered on level-up |

**XP is flat per battle, never per kill.** Rewarding kills would push the player toward a
damage race, contradicting Pillar 2 (Positioning Over Power).

**XP is awarded regardless of battle outcome** — win or loss — provided the mech was deployed
and was not `Removed`. The award keys on the mech's survival, not the objective's result.

**Benched pilots gain no XP.** Only pilots on deployed mechs accrue. This is deliberate: it
concentrates growth in the squad the player actually fields, which is what makes a veteran
pilot's death cost something. It also means a mid-run replacement pilot never catches up to
a survivor, preserving the gradient.

**Level-up flow:** on reaching a threshold, offer `pilot_skill_offer_count` skills drawn
from the pool the pilot does not already hold, seeded via `mulberry32` with a pilot-specific
salt (per registry entry `mulberry32_prng` — procedural generation only, never in-battle).
The player picks exactly 1. **No skip option** — a level-up is pure gain with no opportunity
cost to balance, unlike a `DraftOffer`.

**Pacing consequence:** a starting pilot peaks at level 3 exactly when the run reaches its
highest-stakes encounter. Losing that pilot at the Boss is the most painful moment available —
which is the intent.

---

## 7. Death and Replacement

**Death condition:** a mech's `Unit` ends a battle in `Removed(Defeated | Fell)`
→ the assigned pilot's `status` becomes `Dead` and `RosterMember.pilotId` is set to `null`.
This is permanent for the remainder of the run. Dead pilots never return.

The mech itself survives at `currentHP = 1` per the existing non-lethal rule. **Mechs are
never lost; only pilots are.**

**Hook point:** `battle_ended` already writes `Unit.currentHP` back to
`RosterMember.currentHP` (`draft-and-loadout-meta.md` Formula F6). Pilot-death resolution
attaches at that same point. The simulation core is untouched.

**Interaction with S4 Last Stand:** the Passive Module S4 prevents `Removed(Defeated)` and
sets `currentHP = 1` instead. Because the death condition keys on the `Removed` state, S4
**saves the pilot**. This gives an already-designed passive a genuine new dimension —
life insurance for a veteran pilot — with no changes to `passive-modules-and-equipment.md`.

**No death spiral:** if every pilot dies, all mechs run on AI Cores and the run remains
winnable. The system is self-limiting.

### Allocation and acquisition

- The 3 starting-squad mechs each begin with a pilot.
- Mechs recruited mid-run via `NewHeroOffer` arrive with an **AI Core** (`pilotId = null`).
- `PilotOffer` (already reserved in the `DraftOffer` union) is **generated only when at
  least one roster member has `pilotId == null`**. An offer is therefore never unassignable.
- Reassigning a pilot between mechs is permitted, but **only on the Loadout Configuration
  screen** already specified in `draft-loadout-ui.md`. No new screen is introduced.

---

## 8. Rule 3 Amendment

`draft-and-loadout-meta.md` Rule 3 currently reads as a blanket "Persistent, non-lethal HP
model" with "no bench-drop, sell, or permadeath mechanic in v1".

Rule 3 is **not broken — it is scoped.** The amendment:

1. Restate Rule 3's non-lethal guarantee as applying to **mechs** (`RosterMember`), unchanged
   in substance: `currentHP` still floors at 1, mechs are still never removed from the Roster.
2. Add a sibling rule covering **pilot** lethality, which is a distinct entity with its own
   lifecycle.

---

## 9. Document Changes Required

| Document | Change |
|---|---|
| `draft-and-loadout-meta.md` | Scope Rule 3 to mechs; add pilot-lethality sibling rule; add `pilotId` to `RosterMember`; activate `PilotOffer` in the `DraftOffer` union; add `PilotOffer` generation precondition |
| `heroes-and-abilities.md:357,693` | Correct the Pilots interface rows — Pilots no longer overrides `maxHP`/`moveRange` |
| `ability-upgrades.md:212,712-717` | Update the field-overlap note — the real Pilots lane is action economy, not chassis |
| `adr-0008:262` | Correct the `hazardImmunities` source to **Passive Modules S2/S3**, not Pilots |
| `game-concept.md` | Add the mecha fiction statement and the schema-vs-display terminology note |
| `hero-roster-and-squads.md` | Add a fiction paragraph; visual descriptions already read as mechs |
| `systems-index.md` | Rename #25 "Pilots / Hero Modifiers" → **"Pilots"**; status → Designed; add doc link; update Progress Tracker |
| `design/registry/entities.yaml` | Register `pilot_instance` entity and the five XP/level constants |
| `design/gdd/pilots.md` | **New** — the full 8-section GDD |

**Untouched:** Board & Grid, Combat Resolution, Turn & Phase Manager, Move Preview,
Input & Selection. The simulation core requires zero changes.

---

## 10. Known Risk

Adopting Pilots gives each mech **5 customization axes**: signature ability, 2 upgrade slots,
2 equipment slots, 1 pilot slot. Into the Breach has **2** (reactor cores, pilot skills).
This is a real Pillar 5 (Read in Ten Seconds) risk, independent of the fiction question.

Two mitigations are built into this design:

1. A pilot reads as a **character** — portrait and name — not as a stat line. It occupies
   different cognitive bandwidth from the other four axes.
2. The lane separation in §4 is strict and enforceable: no pilot skill may state an effect
   expressible as a chassis-field delta or an `AbilityDefinition` field change.

This risk should be re-evaluated at the next `/review-all-gdds` pass and at playtest. If
legibility measurably suffers, the first lever to pull is reducing `equipmentSlots` from 2
to 1 — recorded here so the option is not rediscovered from scratch later.

---

## 11. Review Status

Authored during a `lean` review-mode session. Specialist agent gates
(`systems-designer` for formulas, `qa-lead` for acceptance criteria, `creative-director`
for CD-GDD-ALIGN) were **not consulted** — subagent dispatch was unavailable in this session.
Review manually, or run `/design-review design/gdd/pilots.md` in a fresh session once the
GDD is authored.
