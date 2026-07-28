# Sprint 2 Plan — VANGUARD

> **Sprint**: 2
> **Start**: 2026-07-28
> **Duration**: 2 weeks
> **Goal**: Feature layer — Heroes, Enemies, Objectives, plus the new content systems (Passive Modules, Gadgets, Enemy Roster)
> **Velocity baseline**: ~13 min for full vertical slice (Foundation + Core + Presentation)

---

## Sprint Goal

> *"A feature-complete battle engine with full hero and enemy rosters, objective evaluation, and new content systems including passive modules and secondary gadgets."*

This sprint builds upon the Foundation and Core from Sprint 1, adding the Feature layer and new content systems.

---

## Stories in Sprint

### Core Battle Features (Dependency: Sprint 1 complete)

| Story | Epic | Points | Type | Priority |
|-------|------|--------|------|----------|
| Heroes & Abilities (Epic) | heroes-abilities | 15 | Logic | P0 |
| Enemy, Abilities & Telegraph (Epic) | enemy-abilities-telegraph | 15 | Logic | P0 |
| Objective / Win-Lose (Epic) | objective-win-lose | 10 | Logic | P0 |

**Core Battle subtotal**: 40 points

### Run Persistence (Deferred from Sprint 1)

| Story | Epic | Points | Type | Priority |
|-------|------|--------|------|----------|
| Envelope Serialization & Round Trip | run-persistence | 3 | Logic | P1 |
| Checksum & Corruption Detection | run-persistence | 2 | Logic | P1 |
| Schema Versioning & Migrations | run-persistence | 3 | Logic | P1 |
| Quota, Capability & Memory Mode | run-persistence | 2 | Integration | P1 |
| Run Lifecycle & Single-Slot Rules | run-persistence | 5 | Integration | P1 |
| Determinism & Resume Contract | run-persistence | 3 | Integration | P1 |

**Run Persistence subtotal**: 18 points

### Passive Modules

| Story | Epic | Points | Type | Priority |
|-------|------|--------|------|----------|
| Equipment slot data model | passive-modules | 2 | Logic | P1 |
| Passive trigger system | passive-modules | 5 | Logic | P1 |
| Trigger type implementations | passive-modules | 5 | Logic | P1 |
| Category effects implementation | passive-modules | 5 | Logic | P1 |
| Draft integration | passive-modules | 3 | Integration | P1 |

**Passive Modules subtotal**: 20 points

### Gadgets Secondary

| Story | Epic | Points | Type | Priority |
|-------|------|--------|------|----------|
| Gadget equip and slot logic | gadgets-secondary | 3 | Logic | P1 |
| Move or gadget action choice | gadgets-secondary | 5 | Logic | P1 |
| Cooldown and uses system | gadgets-secondary | 3 | Logic | P1 |
| New hazard types implementation | gadgets-secondary | 3 | Logic | P1 |

**Gadgets Secondary subtotal**: 14 points

### Enemy Roster Content

| Story | Epic | Points | Type | Priority |
|-------|------|--------|------|----------|
| Archetype ability definitions | enemy-roster-content | 3 | Content | P1 |
| Tier stat scaling | enemy-roster-content | 2 | Content | P1 |
| Overseer aura system | enemy-roster-content | 3 | Logic | P1 |
| Boss alternating AI | enemy-roster-content | 3 | Logic | P1 |
| Encounter template creation | enemy-roster-content | 3 | Content | P1 |

**Enemy Roster Content subtotal**: 14 points

---

## Sprint Totals

| Metric | Value |
|--------|-------|
| **Total stories** | 21 (counting Epics as 1 each) |
| **Total points** | 106 |
| **P0 stories** | 3 (40 points) |
| **P1 stories** | 18 (66 points) |
| **Test files required** | 21 |

---

## Execution Order

### Week 1: Core Battle Features & Persistence

```
Day 1–3: Heroes & Abilities + Enemy, Abilities & Telegraph
Day 4:   Objective / Win-Lose
Day 5:   Run Persistence (Serialization, Checksum, Versioning, Quota)
```

### Week 2: Content Systems

```
Day 6-7: Run Persistence (Lifecycle, Determinism) + Passive Modules (Data model, Triggers)
Day 8:   Passive Modules (Effects, Draft) + Gadgets Secondary (Equip, Choice)
Day 9:   Gadgets Secondary (Cooldowns, Hazards) + Enemy Roster Content (Archetypes, Scaling)
Day 10:  Enemy Roster Content (Aura, Boss AI, Templates) + Sprint review
```

---

## Definition of Done (Sprint-level)

- [ ] All P0 stories have status `Complete` via `/story-done`
- [ ] All Logic/Integration stories have passing test files in `tests/`
- [ ] `npm test` passes with 0 failures
- [ ] `npx tsc --noEmit` reports 0 errors
- [ ] Production code at `src/` (not `prototypes/`)
- [ ] No imports from `prototypes/` directory
- [ ] Git commit with all changes pushed

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Passive trigger loops | Medium | High | Strict limits on trigger cascade depth |
| Content balancing delays | High | Medium | Defer deep balancing to polish phase; focus on functional hooks |
| Complex boss AI logic | Medium | Medium | Limit boss behaviors to alternating patterns for v1 |

---

## Deferred to Sprint 3

- Undo/redo
- Move preview integration story (Threat overlay)
- Input: Locked state, keyboard navigation
- Encounter Generator (Full)
- All Presentation layer stories (Rendering, HUD, Audio, etc.)

---

## Velocity Notes

Estimated production multiplier: **5–8× prototype time** per system.
