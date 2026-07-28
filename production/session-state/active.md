# Active Session State

**Last Updated:** 2026-07-28T11:58:00+07:00
**Stage:** Pre-Production (PASS since 2026-07-28)
**Sprint:** Sprint 1 planned (not started), Sprint 2 planned

---

## Current Status Summary

| Area | Status | Artifact |
|------|--------|----------|
| Game Concept | ✅ Complete | `design/gdd/game-concept.md` |
| Systems Index | ✅ 28 systems (10 MVP, 14 VS, 4 Alpha) | `design/gdd/systems-index.md` |
| GDDs | ✅ **25/28 Designed** (MVP 10/10, VS 14/14, Alpha 1/4) | `design/gdd/*.md` |
| Pilots (#25) | ✅ Designed 2026-07-28 — pending independent review | `design/gdd/pilots.md` |
| Game Fiction | ✅ Mecha declared 2026-07-28 | `design/gdd/game-concept.md` § Fiction and Terminology |
| Art Bible | ✅ §1-4 Complete | `design/art/art-bible.md` |
| Architecture | ✅ PASS | `docs/architecture/architecture.md` |
| ADRs | ✅ 11 Accepted (adr-0001..0011) | `docs/architecture/adr-*.md` |
| Control Manifest | ✅ Complete | `docs/architecture/control-manifest.md` |
| Traceability | ✅ 126 TRs mapped | `docs/architecture/requirements-traceability.md` |
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

**All design + planning work is complete.** Next steps are implementation:

1. **Implement Sprint 1** — Foundation + Core layers (18 stories, 61 pts, 2 weeks)
   - Board & Grid, Turn & Phase Manager, Event Bus (Foundation)
   - Combat Resolution, Input & Selection, Move Preview (Core)
   - Production code at `src/` (not prototypes/)
   
2. **After Sprint 1** → Implement Sprint 2 — Feature layer + Content systems (21 stories, 106 pts)
   - Heroes & Abilities, Enemy AI, Objectives (P0)
   - Run Persistence, Passive Modules, Gadgets, Enemy Roster (P1)

3. **Remaining design gaps** (non-blocking):
   - Alpha #26 4X-lite Node Bonuses, #27 Accessibility, #28 Settings — Not Started
   - AI Formula F2 attackRange=0 edge case
   - Wraith two-target input UX flow
   - `design/accessibility-requirements.md` and `design/ux/accessibility-requirements.md`
     are duplicates — dedupe before designing #27

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
Simulation core: **zero changes**.

- Spec: `docs/superpowers/specs/2026-07-28-pilots-design.md`
- GDD: `design/gdd/pilots.md` — **not yet independently design-reviewed**
- ⚠️ Known risk: mechs now carry **5 customization axes** vs Into the Breach's 2.
  Mitigations are Core Rule 5's lane ban and portrait-not-icon presentation. If
  playtest shows legibility suffering, first lever is `equipmentSlots` 2 → 1.

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
