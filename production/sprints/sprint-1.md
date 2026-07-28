# Sprint 1 Plan — VANGUARD

> **Sprint**: 1
> **Start**: 2026-07-28
> **Duration**: 2 weeks
> **Goal**: Implement Foundation + Core layers — the complete battle engine without presentation
> **Velocity baseline**: ~13 min for full vertical slice (Foundation + Core + Presentation)

---

## Sprint Goal

> *"A headless battle engine that can run a complete turn cycle (player actions → enemy AI → win/lose check) with all combat primitives, pass all unit tests, and produce a deterministic board state from any seed."*

This sprint builds the **production-quality** Foundation and Core systems (not the prototype). The vertical slice code at `prototypes/vanguard-vertical-slice/` is reference only — production code is written from scratch using the stories below.

---

## Stories in Sprint

### Foundation Layer (Dependency: None)

| Story | Epic | Points | Type | Priority |
|-------|------|--------|------|----------|
| Board queries & index | board-grid | 3 | Logic | P0 |
| Board snapshot/restore | board-grid | 3 | Logic | P0 |
| Reachable tiles BFS | board-grid | 5 | Logic | P0 |
| Board error contract | board-grid | 2 | Logic | P1 |
| Board mutations | board-grid | 3 | Logic | P0 |
| Core phase loop | turn-phase-manager | 5 | Logic | P0 |
| Phase events | turn-phase-manager | 3 | Integration | P0 |
| Deterministic event bus | event-bus | 3 | Logic | P0 |

**Foundation subtotal**: 27 points

### Core Layer (Dependency: Foundation complete)

| Story | Epic | Points | Type | Priority |
|-------|------|--------|------|----------|
| Resolve loop & events | combat-resolution | 5 | Logic | P0 |
| Unit lifecycle | combat-resolution | 3 | Logic | P0 |
| Displacement (push/pull) | combat-resolution | 5 | Logic | P0 |
| Swap & terrain | combat-resolution | 3 | Logic | P1 |
| Hazard integration | combat-resolution | 3 | Integration | P1 |
| Move preview integration | combat-resolution | 3 | Integration | P1 |
| Coordinate transform | input-selection | 2 | Logic | P0 |
| Selection state machine | input-selection | 5 | Logic | P0 |
| Dry run mechanism | move-preview | 3 | Logic | P0 |
| Preview lifecycle | move-preview | 2 | Logic | P1 |

**Core subtotal**: 34 points

---

## Sprint Totals

| Metric | Value |
|--------|-------|
| **Total stories** | 18 |
| **Total points** | 61 |
| **P0 stories** | 12 (39 points) |
| **P1 stories** | 6 (22 points) |
| **Test files required** | 12 (all Logic + Integration stories) |

---

## Execution Order

### Week 1: Foundation

```
Day 1–2: Event Bus + Board queries/index/mutations (parallel — no dependencies)
Day 3:   Board snapshot/restore + reachable tiles BFS
Day 4:   Turn phase loop + phase events (depends on event bus)
Day 5:   Board error contract + integration testing
```

### Week 2: Core

```
Day 6–7: Combat resolve loop + unit lifecycle + displacement
Day 8:   Swap/terrain + hazard integration
Day 9:   Move preview (dry run + lifecycle)
Day 10:  Input selection (coordinate transform + state machine)
         Sprint review + integration testing
```

---

## Definition of Done (Sprint-level)

- [ ] All 12 P0 stories have status `Complete` via `/story-done`
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
| Board snapshot perf at 8×8+ | Low | Low | Profile early; flat array design ensures O(W×H) copy |
| Push/pull chain complexity | Medium | Medium | Strict sequential effect resolution per ADR-0006 |
| Input state machine bugs | Medium | Low | P0 story covers core states only; advanced states in Sprint 2 |
| Event bus ordering issues | Low | High | Unit test guarantees registration-order dispatch |

---

## Deferred to Sprint 2

- Turn phase: Objective/win-lose check, undo/redo
- Run Persistence: All 6 stories (not needed for battle engine)
- Combat: Move preview integration story (can ship without)
- Input: Locked state, keyboard navigation
- Move Preview: Threat overlay
- All Feature layer stories (Heroes, Enemies, Encounter, etc.)
- All Presentation layer stories (Rendering, HUD, Audio, etc.)

---

## Velocity Notes (from Vertical Slice)

The vertical slice built Foundation + Core in ~6 minutes (agent time). Production code requires:
- Full test coverage (slice had 5 tests; production needs ~30+)
- Error handling & edge cases
- Documentation & comments
- Code review compliance

Estimated production multiplier: **5–8× prototype time** per system.
