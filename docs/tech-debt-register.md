# Tech Debt Register

<!-- Appended by /story-done when advisory deviations are accepted at close. -->
<!-- Each entry: date, source story/sprint, what it is, why it was accepted, what closes it. -->

## Sprint 1 (2026-07-28)

Accepted at story close. None blocks Sprint 1; each is recorded so it is a
decision rather than a discovery later.

- **2026-07-28** (Combat Resolution, story-005): **`applyHazard` is Fire-only.**
  Formula F3 defines one flat `fire_damage_per_tick` and the implementation applies
  it to *any* hazard, because `combat-resolution.md` defines no Combat-level formula
  for Mine, Smoke, Acid, Vortex or Beacon. Concretely: spawning a `Mine` deals **1**
  damage instead of 3 and is not consumed. This is not an implementation bug — it is
  the only behaviour the spec defines.
  *Closes when:* per-type hazard formulas are authored. **Must land before the hazard
  registry is content-complete**, or five of six hazard types silently behave as Fire.
  *Tracked from:* `production/epics/combat-resolution/story-005-hazard-integration.md`

- **2026-07-28** (Move Preview / Combat / Event Bus): **The preview/commit boundary
  has no type-system enforcement.** ADR-0007 says "the silence IS the boundary" —
  isolation comes from constructing a separate `EventBus` for the dry run, and
  nothing prevents a future caller from passing the live session bus instead.
  `resolve()` defaults to a fresh private bus when none is given, so a bare call is
  safe, but the misuse remains expressible. Flagged independently by three
  implementers (Event Bus, Combat, Move Preview).
  *Closes when:* either a branded/opaque bus type makes the misuse unrepresentable,
  or a lint rule rejects passing a session bus into a preview call. Until then it is
  review discipline, which ADR-0007 itself acknowledges.
  *Tracked from:* `production/epics/move-preview/story-001-dry-run-mechanism.md`

- **2026-07-28** (Input & Selection, Move Preview): **DI ports stand in for
  unbuilt Feature-layer modules.** `UnitLookup`, `TargetLegalityQuery`,
  `ActionCommitter` and the preview compiler port are deliberately narrow subsets of
  ADR-0008's `Unit` shape, because Heroes & Abilities and Enemy/Telegraph have no
  `src/` module until Sprint 2. Additive wiring was the goal, but a hand-written
  subset of a canonical record is exactly the schema-drift risk ADR-0008 exists to
  prevent.
  *Closes when:* Heroes & Abilities lands and the ports are re-derived from the real
  `Unit` type rather than restated.
  *Tracked from:* `production/epics/input-selection/story-002-selection-state-machine.md`

- **2026-07-28** (Input & Selection, story-002): **Story Type is `Integration`,
  implementation is Logic.** The selection state machine is a pure reducer over
  injected ports with no cross-module wiring, which is Logic by
  `coding-standards.md`'s taxonomy. The evidence path was corrected to match the
  file; the `Type:` field was deliberately **not** changed, because editing a story's
  type to make a gate pass is backwards.
  *Closes when:* someone decides the type deliberately. Contrast
  `move-preview/story-002`, which really is Integration (it wires real Board,
  EventBus and CombatState) and had its *file* moved instead.
  *Tracked from:* `production/epics/input-selection/story-002-selection-state-machine.md`

- **2026-07-28** (process, whole sprint): **Six story evidence-path mismatches.**
  Board & Grid ×5, Combat story-006, Event Bus, Input ×2, Move Preview story-002 all
  stated a test path that did not match the file produced. `/story-done` matches
  literal paths, so every one of these stories would have failed its own gate with
  correct code and passing tests.
  At six occurrences this is a process defect, not a typo pattern: paths are written
  speculatively at story-creation time and never reconciled against what implementers
  produce.
  *Closes when:* either `/create-stories` derives the path mechanically from the
  naming standard, or `/story-done` resolves evidence by system+feature instead of an
  exact string. **Raise at the retrospective.**
  *Tracked from:* sprint-wide

- **2026-07-28** (Combat Resolution): **`confirm` is emitted optimistically.**
  The selection machine emits `confirm` before the injected `ActionCommitter`'s
  outcome is known, so a refusing committer still sees `confirm` fired. Matches the
  GDD's literal single-clause wording.
  *Closes when:* the GDD states the intended ordering, or the emit moves after the
  commit result.
  *Tracked from:* `production/epics/input-selection/story-002-selection-state-machine.md`
