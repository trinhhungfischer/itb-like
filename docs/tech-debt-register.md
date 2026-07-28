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
  *Closes when:* see the Post-code-review entry below — code review proposed a better
  fix than the branded type first suggested here, and found a **second** footgun in the
  same option (omitting the bus on a live commit silently swallows every event).
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

- ~~**2026-07-28** (Combat Resolution): **`confirm` is emitted optimistically.**~~
  ✅ **RESOLVED 2026-07-28** by code review. It was not a defensible judgement call —
  every Presentation subscriber (Battle HUD, Audio, Board Rendering) would have played
  a committed-action animation and sound for an action that never happened, and
  `ConfirmEvent`'s own doc comment ("commits immediately") said the opposite of what the
  code did. The emit now happens only after the committer accepts. A test was pinning
  the old behaviour and was corrected with it.
  *Tracked from:* `production/epics/input-selection/story-002-selection-state-machine.md`

## Post-code-review (2026-07-28)

Three Required Changes from `/code-review` were **fixed** (ADR-0006 amended,
`confirm` ordering corrected, `CombatStateView` interface added). What follows is
what was deliberately left.

- **2026-07-28** (Combat Resolution): **`resolve()`'s `bus` option makes two mistakes
  expressible.** `options.bus` is a plain `EventBus`, so nothing distinguishes the
  shared session bus from a disposable preview bus. Passing the session bus into a dry
  run leaks preview events to Audio/Rendering; *omitting* the bus on a live commit
  makes the default private bus swallow every event **silently, with no error** — the
  second footgun was found by code review and had not been noticed before.
  *Proposed fix:* split into `resolve(board, state, effects, liveBus)` with **no
  default**, plus a separate `resolvePreview(board, state, effects)` that constructs its
  bus internally and accepts none. Both mistakes then become compile errors rather than
  silent runtime behaviour — strictly better than a branded type or a lint rule, and it
  closes both directions rather than only the leak.
  *Deliberately not done in the same change as the ADR-0006 amendment.*
  *Tracked from:* code review, `src/core/combat/combat-resolve.ts`

- **2026-07-28** (Turn & Phase Manager): **The undo seam cannot restore HP.**
  `TurnPhaseManager.playerPhaseSnapshots` is `Board[]` only, and the `CombatResolver`
  port has no slot for `CombatState` — the integration test's adapter has to *close
  over* it precisely because of that. Move Preview already does this correctly,
  snapshotting **both** board and state.
  Not a violation today because Story 004 (undo/redo) does not exist. But that story is
  documented as building on this exact seam, and if it does, **undoing a `damage`
  action will restore position and not HP** — a hero keeps the damage after the action
  is undone. That is the "the game lied to me" failure ADR-0007 exists to prevent, and
  it is the general case of ADR-0007's own 2026-07-28 amendment: "a battle-scoped
  charge must live in snapshotted state, not in a side table the snapshot does not
  cover." **`CombatState` is that side table.**
  *Closes when:* the seam is widened to snapshot a combined `{board, state}` pair, as
  `MovePreviewDeps` already models. **Resolve before Story 004 begins** — changing a
  port after three systems depend on it is materially more expensive.
  *Tracked from:* code review, `src/core/turn/turn-phase-manager.ts`

- **2026-07-28** (Combat Resolution): **`applyHazard` has no per-type dispatch point.**
  Beyond the already-logged Fire-only behaviour, the *shape* is the issue: the formula
  is inlined in `applyHazardPrimitive`'s body, so adding Mine or Smoke means editing
  that function and threading new config ad hoc. `HazardType` is already an open
  `string`, so nothing structural blocks it.
  *Proposed fix:* replace the single `fireDamagePerTick` value with a
  `Record<HazardType, HazardFormula>` lookup, defaulting to today's Fire behaviour.
  "Add Mine" then becomes one map entry instead of a body edit.
  *Do before* Encounter Generator's first Mine/Smoke content story.

- **2026-07-28** (Board & Grid): **`reachableTiles` has no benchmark**, though
  ADR-0009's own Validation Criteria requires `< 0.5 ms/call` in headless benchmarks
  and `snapshot()` has one. It allocates a `Set<string>`, per-layer frontier arrays, and
  fresh `{col,row}` objects per neighbour — fine at ≤144 tiles, but unmeasured, and it
  runs on hover during Move Preview. If it ever measures close to budget, `tileKey()`
  can switch from a template literal to `Set<number>` on the existing `row*W+col`
  index, removing string allocation entirely.

- **2026-07-28** (Turn & Phase Manager): **stale doc comment recommends a cross-layer
  import.** `turn-phase-contracts.ts:26-27` says to prefer importing Combat's real
  `EffectPrimitive` union "once that module exists". It now exists — but doing so would
  create a Foundation → Core dependency, contradicting the same file's own header about
  keeping the graph acyclic. The comment is wrong and should not be followed.
