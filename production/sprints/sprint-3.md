# Sprint 3 Plan — Alpha Systems

> **Sprint**: 3
> **Start**: 2026-07-29
> **Duration**: 2 weeks
> **Goal**: Execute the Alpha phase progression and map systems (Pilots, 4X-lite Node Bonuses) along with essential accessibility and settings infrastructure.
> **Velocity baseline**: ~13 min for full vertical slice (Foundation + Core + Presentation)

---

## Sprint Goal

> *"Implement Alpha progression mechanics via the Pilots system, introduce run-global MapNode claims via Node Bonuses, and establish robust Accessibility and Settings infrastructure."*

---

## Stories in Sprint

### Pilots System (Alpha)

| Story | Epic | Points | Type | Priority |
|-------|------|--------|------|----------|
| Pilots System Implementation | pilots | 8 | Logic | P0 |
| Pilots Mid-Run Recruits | pilots | 3 | Logic | P1 |

**Pilots System subtotal**: 11 points

### Node Bonuses (Alpha)

| Story | Epic | Points | Type | Priority |
|-------|------|--------|------|----------|
| Node Bonuses Implementation | node-bonuses | 8 | Logic | P0 |
| Node Bonuses UI Badges | node-bonuses | 3 | UI | P2 |

**Node Bonuses subtotal**: 11 points

### Accessibility (Alpha)

| Story | Epic | Points | Type | Priority |
|-------|------|--------|------|----------|
| Accessibility Thresholds & Gates | accessibility | 5 | Logic | P0 |

**Accessibility subtotal**: 5 points

### Settings and Options (Alpha)

| Story | Epic | Points | Type | Priority |
|-------|------|--------|------|----------|
| Settings Domain & Persistence | settings-and-options | 5 | Logic | P0 |
| Settings Keybinding Conflict UI | settings-and-options | 3 | UI | P1 |

**Settings and Options subtotal**: 8 points

---

## Sprint Totals

| Metric | Value |
|--------|-------|
| **Total stories** | 7 |
| **Total points** | 35 |
| **P0 stories** | 4 (26 points) |
| **P1 stories** | 2 (6 points) |
| **P2 stories** | 1 (3 points) |
| **Test files required** | 7 |

---

## Execution Order

### Week 1: Core Progression & Map Claims

```text
Day 1–3: Pilots System Implementation
Day 4-5: Node Bonuses Implementation
```

### Week 2: Accessibility, Settings & Secondary features

```text
Day 6-7: Accessibility Thresholds & Gates + Settings Domain & Persistence
Day 8:   Pilots Mid-Run Recruits
Day 9:   Settings Keybinding Conflict UI
Day 10:  Node Bonuses UI Badges + Sprint review
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
| Pilots permanent death saving issues | Medium | High | Rely on ADR-0012 run-persistence |
| Complex UI for accessibility settings | High | Medium | Follow strict rules defined |
