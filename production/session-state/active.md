# Active Session State

**Last Updated:** 2026-07-28 — 28/28 GDDs · 12 ADRs · 147 TRs · consistency + architecture reviews done
**Stage:** Pre-Production (PASS since 2026-07-28)
**Sprint:** Sprint 1 planned (not started), Sprint 2 planned

---

## Current Status Summary

| Area | Status | Artifact |
|------|--------|----------|
| Game Concept | ✅ Complete | `design/gdd/game-concept.md` |
| Systems Index | ✅ 28 systems (10 MVP, 14 VS, 4 Alpha) | `design/gdd/systems-index.md` |
| GDDs | ✅ **28/28 Designed** (MVP 10/10, VS 14/14, Alpha 4/4) | `design/gdd/*.md` |
| Alpha #25 Pilots | ✅ Designed · ✅ **reviewed** (MAJOR REVISION NEEDED → fixed) | `design/gdd/pilots.md` |
| Alpha #26 Node Bonuses | ✅ Designed · ⚠️ review ran, **no verdict recorded** | `design/gdd/node-bonuses.md` |
| Alpha #27 Accessibility | ✅ Designed · ⚠️ review ran, **no verdict recorded** | `design/gdd/accessibility.md` |
| Alpha #28 Settings | ✅ Designed · ⚠️ review ran, **no verdict recorded** | `design/gdd/settings-and-options.md` |
| Game Fiction | ✅ Mecha declared 2026-07-28 | `design/gdd/game-concept.md` § Fiction and Terminology |
| Art Bible | ✅ §1-4 Complete | `design/art/art-bible.md` |
| Architecture | ✅ PASS | `docs/architecture/architecture.md` |
| ADRs | ✅ **12 Accepted** (adr-0001..0012) | `docs/architecture/adr-*.md` |
| Control Manifest | ✅ Complete | `docs/architecture/control-manifest.md` |
| Traceability | ✅ **147 TRs** (125 baseline + 22 Alpha) | `docs/architecture/tr-registry.yaml` |
| UX Specs | ✅ Battle HUD UX spec | `design/ux/battle-hud-ux-spec.md` |
| Vertical Slice | ✅ Prototype playable | `prototypes/vanguard-vertical-slice/` |
| Hero Roster | ✅ 12 heroes, 4 squads | `design/content/hero-roster-and-squads.md` |
| Enemy Roster | ✅ 11 archetypes, 5 patterns, 3 tiers | `design/content/enemy-roster-and-archetypes.md` |
| Passive Modules | ✅ 14 modules, 2 hybrid equipment slots | `design/content/passive-modules-and-equipment.md` |
| Gadgets | ✅ 9 gadgets (Move-replacement) | `design/content/secondary-weapons-and-gadgets.md` |
| Epics | ✅ 25 epics | `production/epics/index.md` |
| Sprint 1 | ✅ Planned (18 stories, 61 pts) | `production/sprints/sprint-1.md` |
| Sprint 2 | ✅ Planned (21 stories, 106 pts) | `production/sprints/sprint-2.md` |
| Gate Check | ✅ PASS (Pre-Production) | `production/gate-checks/gate-check-pre-production-2026-07-28.md` |
| Tech Stack | ✅ TS + PixiJS + Vite (pure web) | `.claude/docs/technical-preferences.md` |

---

## Content Design Decisions (Resolved)

### Hero Loadout (Final v1)
```
HeroRunState {
  chassis + signatureAbility          // permanent identity
  abilityUpgrades: [Slot, Slot]       // 2 numeric upgrade slots
  equipmentSlots: [Slot, Slot]        // 2 hybrid slots (Passive | Gadget)
}
```
- Max 1 Gadget per hero (replaces Move action)
- Chain-reaction preview is a free base feature (not a passive)

### Hazard Registry (6 types)
| Type | Trigger | Source |
|------|---------|--------|
| Fire | Per-tick | Ember heroes, Aftershock passive |
| Acid | Per-tick | Lobber T3 |
| Mine | On-step (consumed) | Sentinel enemy |
| Smoke | Blocks targeting | Smoke Bomb gadget |
| Vortex | Per-tick + pull | Flux hero |
| Beacon | Player-activated teleport | Warp Beacon passive |

### Enemy Roster
- 11 archetypes across 5 threat patterns (Approach/Artillery/Zone/Support/Boss)
- 3 tiers: T1 Standard → T2 Elite → T3 Alpha
- 4 Overseer aura variants (Warchief/Ironhide/Volatile/Hivemind)
- 2 Bosses (Behemoth warlord, Architect board-controller)

---

## Design Review Findings (2026-07-28)

| # | Finding | Status |
|---|---------|--------|
| 1 | Vanguard ability canonical name = "Ram" | ✅ Fixed |
| 2 | Crucible ability canonical name = "Eruption" | ✅ Fixed |
| 3 | Vortex hazard missing from registry | ✅ Added |
| 4 | Beacon hazard missing from registry | ✅ Added |
| 5 | AI Formula F2 edge case for attackRange=0 | ⏳ Deferred to implementation |
| 6 | Wraith two-target input flow | ⏳ Deferred to implementation |

---

## Resume Pointer

**All 28 GDDs are authored.** Design work is complete in volume; what remains is
reconciliation, then implementation.

✅ **Done 2026-07-28:** `/consistency-check` (4 findings, all closed) ·
`/architecture-review` Alpha delta (3 gaps, all closed) · ADR-0012 authored ·
22 Alpha TRs registered. See the Session Extract at the end of this file.

**0. Re-review #26, #27, #28** — their `/design-review` runs left no verdict and no
document change. That is indistinguishable from a clean pass and must not be read as
one: `pilots.md`'s review returned **MAJOR REVISION NEEDED** and rewrote a rule that
was factually unachievable. Capture each verdict in the GDD's Review Status block.

**1. Implement Sprint 1** — Foundation + Core layers (18 stories, 61 pts, 2 weeks)
   - Board & Grid, Turn & Phase Manager, Event Bus (Foundation)
   - Combat Resolution, Input & Selection, Move Preview (Core)
   - Production code at `src/` (not `prototypes/`)

**2. After Sprint 1** → Sprint 2 — Feature layer + Content systems (21 stories, 106 pts)
   - Heroes & Abilities, Enemy AI, Objectives (P0)
   - Run Persistence, Passive Modules, Gadgets, Enemy Roster (P1)

**Note:** the 4 Alpha systems are **not** in either sprint plan. Both sprints were
planned on 2026-07-28 before those GDDs existed. They are Alpha-tier, so this is
correct for now — but Sprint 3+ planning must account for them.

**Remaining design gaps** (non-blocking):
   - AI Formula F2 attackRange=0 edge case
   - Wraith two-target input UX flow
   - *(Resolved: `design/accessibility-requirements.md` is NOT a duplicate — it is a
     22-line pointer that explicitly names `design/ux/accessibility-requirements.md`
     as canonical. Nothing to dedupe.)*

### Pilots (#25) — completed 2026-07-28

The original "Pilots / Hero Modifiers" concept was **superseded**, not implemented as
reserved. Two problems were found: the game had no declared fiction (units were named
characters, so a pilot on top gave one board piece two identities), and the reserved
chassis lane (`maxHP`/`moveRange`/`hazardImmunities`) had already been claimed by
Passive Modules (T1 Pathfinder, S2/S3 Walkers, S4 Last Stand).

Resolution: declared the mecha fiction (near-free — the art bible and hero roster
already read as machines) and moved Pilots to the unoccupied **action economy ·
deployment · run-level** lane. Pilots gain XP, level to 3, and **die permanently**
when their mech is Removed — the sole permanent loss in the whole design.
`draft-and-loadout-meta.md` Rule 3 was **scoped to mechs** (new Rule 3a), not broken.
Foundation + Core: **zero changes**. **Presentation is not exempt** — Battle HUD must
render a mech's *effective* action-slot count when a pilot skill grants extra uses, or
Pillar 1 (Perfect Information) breaks. The original draft claimed otherwise; the design
review retracted it.

- Spec: `docs/superpowers/specs/2026-07-28-pilots-design.md`
- GDD: `design/gdd/pilots.md` — ✅ **independently design-reviewed** 2026-07-28
  (MAJOR REVISION NEEDED; all 9 blocking items resolved in-doc, commit `f59f5da`).
  That review also produced **ADR-0012** and corrected Rule 21, which had asserted a
  guarantee `run-persistence.md` could not provide.
- ⚠️ Known risk: mechs now carry **5 customization axes** vs Into the Breach's 2.
  Mitigations are Core Rule 5's lane ban and portrait-not-icon presentation. If
  playtest shows legibility suffering, first lever is `equipmentSlots` 2 → 1.

### Alpha #26–#28 — completed 2026-07-28

Each resolved a decision another doc had explicitly deferred to it:

- **#26 Node Bonuses** answers `game-concept.md`'s open question *"node bonuses vs.
  real territory control"* → **bonuses only**. Consumes exactly the one extension
  point `run-structure-node-map.md` promised (`MapNode.state == Claimed`); adds no map
  state, no transition, and **no new player decision** — route choice already exists.
- **#27 Accessibility** is the **requirements authority**, not a UI system. It expands
  `design/ux/accessibility-requirements.md` into 11 required accommodations, 4 formulas
  (WCAG contrast, UI scale, greyscale test, CIEDE2000 palette separation), and 9
  verification gates — 8 BLOCKING.
- **#28 Settings** is the **shell** and resolves `run-persistence.md` Open Question #8
  → settings get **their own domain** `vanguard.settings.v{N}`, a peer of Meta/Run, so
  a save corruption can never cost a player their keybindings or colorblind mode.

**Lane discipline applied deliberately**, after the Pilots/Passive-Modules collision
showed what happens without it: #27 owns *which* accommodations must exist and to what
threshold; #28 owns the screen, schema, storage, and apply pipeline. Neither may change
the other's domain.

**Numbering drift found and fixed**: `ux/accessibility-requirements.md` called
Accessibility "#24"; `input-and-selection.md` called Settings "#25" (which is Pilots)
in three places.

### Review status — 1 of 4 landed

*Corrected 2026-07-28: an earlier note here said the verdicts were lost. They were
not — `pilots.md`'s review arrived as uncommitted working-tree changes after that
check ran.*

| GDD | Review | Verdict | State |
|---|---|---|---|
| `pilots.md` | ✅ run (full mode) | **MAJOR REVISION NEEDED** | Revision applied in-doc by the review session; committed `f59f5da` |
| `node-bonuses.md` | ⚠️ run, no repo change | unknown | — |
| `accessibility.md` | ⚠️ run, no repo change | unknown | — |
| `settings-and-options.md` | ⚠️ run, no repo change | unknown | — |

The Pilots review recorded its verdict in the GDD's own Review Status block and
resolved all 9 blocking items. Specialists consulted there: `game-designer`,
`systems-designer`, `economy-designer`, `qa-lead`, `creative-director`.

**The other three produced no repo change.** That may mean clean verdicts or
terminal-only output — indistinguishable from here. `systems-index.md` still reads
"Design docs reviewed: 24" and cannot advance those three past `Designed` until
someone confirms.

**Still open from the Pilots review itself:** ADR-0012 (ironman save policy) is
proposed but unauthored; death-rate and skill-strength tuning targets are undefined;
narrative and skill-catalog content passes are outstanding. The review recommends an
independent **re-review before implementation**.

### ⚠️ Open consistency findings — 3 deferred

`/consistency-check` ran 2026-07-28. Full detail in `docs/consistency-failures.md`.
One conflict fixed, three deferred by user decision:

1. **Registry stale vs. reviewed `pilots.md`** — the review reshaped
   `pilot_level2_xp`/`pilot_level3_xp` into a `pilot_level_thresholds` array and
   changed L3 from 4 to 3; added `pilot_seed_xp_lag`. `entities.yaml` still holds the
   old shape and value.
2. **A retracted claim is still propagated** — the review corrected `pilots.md`'s
   "Battle HUD / Board Rendering: zero changes" claim (an extra Move slot must be
   visible or Pillar 1 breaks). `architecture.md` and this file still carry the
   uncorrected version. The *simulation-core* half remains true.
3. **`pilots.md` → `battle-hud.md` edge is one-directional** — `battle-hud.md` has no
   mention of Pilots, violating the bidirectional-dependency rule.

**Also outstanding:** no specialist gate ran during authoring of #26/#27/#28 —
subagent dispatch was unavailable. `accessibility.md` should not reach production
without an `accessibility-specialist` pass; `settings-and-options.md` is almost
entirely UI and never saw a `ux-designer`. An independent `/design-review` does not
substitute for either.

<!-- CONSISTENCY-CHECK: 2026-07-28 | GDDs checked: 25 | Conflicts found: 4 (1 resolved, 3 deferred) | Report: docs/consistency-failures.md -->


### Key Architecture Reminders
- **Deterministic**: No RNG in battle. PRNG = mulberry32, seeded once per encounter.
- **Phase order**: TurnStart → PlayerPhase → Environment → EnemyResolve → Spawn → Telegraph → EndCheck
- **Undo**: Scoped to Player Phase only.
- **Actions**: `actions_per_hero_turn = 2` (Move/Gadget + Ability). Never 3.
- **Combat**: 10 effect primitives. All abilities compile to these. Sequential resolution.
- **Squad size**: 3 heroes per squad.

---

## Git Log (recent)
```
c183f91 fix: resolve design review findings — naming consistency + hazard registry
b3805ff production: add Sprint 2 plan — Feature layer + content systems
ce7fe48 Update GDDs with 3 new content designs
07196f6 Add epics and stories for content systems
5aced3e design: resolve all open questions — hybrid 2-slot system, new hazard types, base chain-preview
2b4fb2f content: add enemy roster (11 archetypes), passive modules (14), and gadgets (9)
6aa50ef feat: complete pre-production pipeline — epics, stories, sprint-1, hero roster
```

## Session Extract — /architecture-review 2026-07-28 (Alpha delta)

- Verdict: **CONCERNS → resolved** (3 gaps found, all 3 fixed in-pass)
- Requirements: 147 total — 125 baseline + **22 new Alpha TRs registered**
  (`TR-PILOT-001..008`, `TR-NODEBONUS-001..003`, `TR-A11Y-001..005`,
  `TR-SETTINGS-001..006`). The 4 Alpha systems were previously invisible to
  `/create-stories` and `/story-done`.
- GDD revision flags: None (no engine — pure web)
- Gaps found and closed:
  1. `settings-and-options.md` added a **third** persistence domain while ADR-0003
     (Accepted) stated "two" in six places → ADR-0003 §2 rewritten as a **domain
     registry**; the arity was a miscount, isolation is the real invariant
  2. `RunState.nodeBonuses` was added to the Run Save payload with **no ADR**,
     while `pilotDeaths` went through ADR-0012 the same day → recorded in
     ADR-0003 §2 with a standing rule that payload additions need an ADR
  3. ADR-0007 (undo/preview) had **zero** mention of action slots while Pilots
     introduced once-per-battle charges → amended: **charges roll back with the
     snapshot**, and battle-scoped charges must live in snapshotted state
- Report: `docs/architecture/architecture-review-2026-07-28-alpha-delta.md`

**Sprint 1 unaffected** — all three sat in Feature/Alpha layers. GAP 3 is the one
an implementer could have hit early (undo is a Sprint 1 story) and is now
specified before any code was written against the ambiguity.
