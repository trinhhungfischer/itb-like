# ADR-0006: Combat `resolve()` as the single board-mutation path + 10-primitive vocabulary

## Status

Accepted

## Date

2026-07-28

## Last Verified

2026-07-28

## Decision Makers

Technical Director (owner); consistent with `design/architecture/cross-system-contracts.md` §1 (canonical) and `docs/architecture/architecture.md` §8 (Required ADR A6).

## Summary

Combat Resolution's `resolve(board, effects[]) → events[]` is the single, exclusive
path that mutates board state, and it does so through a **closed vocabulary of 10
effect primitives**. This breaks the Heroes↔Combat and Enemy↔Combat dependency cycles
(abilities compile *to* primitives one-directionally), guarantees determinism (Pillar
#1), and lets Move Preview dry-run the real simulation over a `snapshot()` instead of a
parallel reimplementation.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | None (pure-web stack: TypeScript strict + PixiJS 2D/WebGL + Vite) |
| **Domain** | Core / Scripting (simulation logic; no renderer, physics, or platform API involved) |
| **Knowledge Risk** | LOW |
| **References Consulted** | `design/architecture/cross-system-contracts.md` §1; `docs/architecture/architecture.md` §4/§5/§8; `design/gdd/combat-resolution.md`; `design/gdd/move-preview.md` |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | None (stack-level). Behavioural verification is captured under Validation Criteria — headless Vitest determinism and preview/commit parity tests. |

> **Not applicable / low risk.** This is a pure-web build (TypeScript + PixiJS + Vite)
> with **no native engine**: there is no Godot/Unity/Unreal API surface, and therefore
> no post-cutoff engine gap to manage. The Godot engine-reference in
> `docs/engine-reference/` **does not apply** to this project and is intentionally not
> consulted (per `architecture.md` §2). Combat Resolution is a headless, renderer-free
> simulation module (Principle P3) and depends on no platform capability beyond the
> JavaScript runtime.

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | **ADR-0001** (Board tile-state representation & cheap `snapshot()`) — every primitive is ultimately a sequence of Board mutations/queries, and the preview/undo story rests on a cheap `snapshot()`. **ADR-0002** (Deterministic synchronous event bus) — `resolve()`'s canonical events must be delivered synchronously and in order for determinism to hold. |
| **Enables** | ADR-0007 (snapshot-based undo & preview reuse one simulation); ADR-0008 (shared `Unit` record); and the Feature-layer ability systems that compile to these primitives. |
| **Blocks** | Heroes & Abilities, Enemy/Abilities/Telegraph, Move Preview, Board Rendering & Juice, Battle HUD, Audio System — none may be implemented against a mutation contract until this ADR is Accepted. |
| **Ordering Note** | ADR-0001 and ADR-0002 must both be Accepted before implementation of `resolve()` begins. This is a Core-layer ADR; decide the Foundation ADRs (A1–A5) first per `architecture.md` §8. |

## Context

### Problem Statement

VANGUARD is built on Pillar #1 (Perfect Information, Perfect Blame): the outcome a
player previews must be *exactly* the outcome that resolves on commit — no divergence,
ever. That guarantee is only mechanically possible if (a) there is exactly one piece of
code that changes the board, and (b) that code is deterministic. `systems-index.md`
additionally flags two structural hazards that must be resolved before any gameplay
system is implemented:

1. **Dependency cycles.** Heroes and Enemies both need to *do things* to the board, and
   the board's consequences (collision, hazards, death) feed back into what heroes and
   enemies can do — a naive design has Heroes↔Combat and Enemy↔Combat mutually
   depending on each other.
2. **The "trustworthy full-consequence preview" risk** — rated VANGUARD's single
   highest technical risk. If Move Preview computes consequences with any code other
   than the real resolution code, the two *will* drift, and the game's core promise
   collapses the first time they disagree.

Deciding this now is load-bearing: the mutation contract is the interface every Feature-
and Presentation-layer system integrates against. Not deciding it means every ability
author invents their own board-mutation path, guaranteeing both cycles and preview
drift.

### Current State

`docs/architecture/` contains no prior mutation-path ADR; the convention lives
implicitly in `cross-system-contracts.md` §1 and `combat-resolution.md`. Several GDDs
already *assume* this decision (Move Preview's dry-run, Enemy's `spawnUnit` emergence,
Board's "mutations invoked only via Combat"). This ADR promotes that implicit
convention to a formally decided, testable invariant so implementation cannot silently
diverge from it.

### Constraints

- **Determinism is a hard invariant** (Principle P1): no RNG, no wall-clock/`Date.now()`
  anywhere in the battle simulation. Same inputs → byte-identical state and event log.
- **Pure simulation core** (Principle P3): Combat Resolution must run headless in Vitest
  with no canvas and must never import PixiJS.
- **Contract authority**: where any GDD disagrees with
  `design/architecture/cross-system-contracts.md`, the contracts file wins; this ADR is
  written to that contract verbatim-in-intent.
- **Single-player, turn-based, local**: no network, no async mutation source — the live
  board can only change through an explicit committed action.

### Requirements

- Exactly one entry point mutates the board; nothing else — no system, no UI, no
  convenience helper — mutates occupancy, terrain, or hazards (Principle P2).
- The primitive vocabulary is *closed* and enumerable, so the whole battle language is
  legible in a ten-second glance (Pillar #5) and every consequence is traceable before
  commit.
- Move Preview must reuse the identical `resolve()` entry point over a disposable
  snapshot — no parallel prediction code.
- The mutation path must be acyclic: abilities depend on primitives, never the reverse.
- Deterministic and fully unit-testable headlessly.

## Decision

**`resolve(board, state, effects, options?) → CombatEvent[]` is the ONLY code that
mutates battle state.** It is exposed by Combat Resolution and consumed by callers
(via Turn & Phase Manager for the live path, and by Move Preview for the dry-run path).
No other system mutates occupancy, terrain, hazards, flags, HP, or hazard immunities;
Board & Grid's mutation API (`place`/`clear`/`setTerrain`/`setHazard`/`setFlag`) is
invoked *only* from inside `resolve()`.

> **⚠️ AMENDED 2026-07-28 during implementation — the signature gained a second
> parameter.** This section originally read
> `resolve(board: Board, effects: EffectPrimitive[]) → CombatEvent[]`.
>
> **Why it had to change:** `Board` deliberately stores only *spatial* facts — terrain,
> occupancy, hazard type, flags. It has no HP and no `hazardImmunities`. Those belong to
> ADR-0008's canonical `Unit` record, owned by **Heroes & Abilities** — a Feature-layer
> module Combat **must not import**, because doing so inverts the very dependency
> direction this ADR exists to protect. So a Core-layer holder was needed, and
> `CombatState` is it: caller-owned, mutated only inside `resolve()`, carrying its own
> `snapshot()` exactly as `Board` does.
>
> **What did NOT change:** the single-mutation-path invariant, the closed primitive
> vocabulary, sequential resolution, determinism, and preview-commit parity. This is an
> amendment, not a supersession.
>
> **Why it is recorded here rather than in a code comment:** Sprint 2's Heroes &
> Abilities, Enemy AI and Objective stories are all pointed at *this document* as the
> contract to implement `compileEffects()` against. Anyone writing against the old
> two-argument text would produce code that does not compile. Flagged by code review
> (2026-07-28) as the one item blocking Sprint 2 kickoff.
>
> **Position is deliberately NOT duplicated into `CombatState`.** Combat derives a
> unit's tile by scanning `Board`'s occupancy (`findTile()`), so `Board` remains the
> single source of truth for where a unit is. ADR-0008 describes `Unit.position` as
> "kept in sync by Combat Resolution" — a field that must be *kept* in sync is a field
> that can fall out of sync, so Combat keeps no second copy.
>
> **Consumers depend on `CombatStateView`, not the concrete class** — the interface in
> `src/core/combat/combat-state-interface.ts`, mirroring the `Board` / `BoardImpl`
> split. Added by the same review to close a Dependency-Inversion gap: `resolve()`
> depended on `Board` through an interface but on `CombatState` concretely, leaving no
> abstraction for a test double or an alternate storage strategy.

**The primitive vocabulary is a CLOSED set of 10** (registry `combat_primitives`):

1. `damage(targetId, amount, sourceId?)`
2. `push(targetId, direction, distance, sourceId?)`
3. `pull(targetId, sourceId, direction, distance)`
4. `swap(unitAId, unitBId)`
5. `spawnHazard(tile, hazardType, duration?)`
6. `applyHazard(tile)`
7. `removeUnit(targetId, cause)` — the single exit point from the board for any unit
8. `setTerrain(tile, terrainType)` — the hero "wall" verb (`Blocked` = build, `Normal` = teardown)
9. `spawnUnit(tile, unitSpec)` — the single board-mutation path for *adding* a unit (enemy emergence + on-death broods)
10. the shared **collision-resolution algorithm** used by both `push` and `pull`

**No 11th primitive may be added without amending `design/gdd/combat-resolution.md`
first.** A new board behaviour (e.g. a domino `chainPush`) must be a new, explicitly
named primitive with its own design entry and this ADR/registry updated — never a hidden
branch of an existing primitive.

**Key semantics:**

- **Strictly sequential application.** Effects apply one at a time, in list order: the
  board state after effect `i` is the input to effect `i+1`. There is no simultaneous or
  parallel resolution anywhere. The chain never aborts partway — a stale target simply
  becomes a no-op (see `removeUnit` idempotence).
- **Purity = determinism, not immutability.** `resolve()` *does* mutate the `board`
  instance it is handed (via Board's mutation API); it just never touches any board other
  than the one passed in, and it uses no RNG and no clock. Determinism is the contract:
  identical `(board, effects)` → identical mutations + identical event log, every time.
- **Preview via snapshot, not a fork.** Move Preview achieves a dry-run by calling
  `resolve(board.snapshot(), effects)` — the live board is untouched because the *input*
  was a clone, not because `resolve()` refuses to mutate. This is what makes
  Preview-Commit Parity unconditional.
- **Closed event vocabulary — 12 names, not 9.** *(Corrected 2026-07-28 during
  implementation. This bullet previously read "Canonical events only… emits **exactly**"
  the nine success events, which directly contradicted **ADR-0005**'s Channel-1
  taxonomy, `combat-resolution.md`'s Edge Cases, and story-004's acceptance criteria —
  all three of which mandate three rejection events "for debuggability". Three
  documents against one summary line; the summary line was wrong.)*

  **Nine success events:** `damage_applied`, `displacement_complete`,
  `collision_resolved`, `swap_complete`, `hazard_spawned`, `hazard_applied`,
  `unit_removed`, `terrain_set`, `unit_spawned`.

  **Three rejection events** (ADR-0005 Channel 1 — a rejection is gameplay, not a bug):
  `swap_failed`, `set_terrain_rejected`, `spawn_unit_rejected`.

  There is **no** `push_resolved`/`apply()` event or entry point, and no generic
  `*_noop` marker — the GDD floats one, but no story requires it and one variant per
  primitive would balloon the vocabulary past what any consumer subscribes to. All
  consumers (Rendering, Audio, HUD, Move Preview) subscribe to these exact names via
  the synchronous event bus (ADR-0002).
- **Combat never calls back into Turn & Phase Manager.** Combat is a service; it owns
  *how* an effect list resolves, never *when*. This one-directional relationship is what
  keeps the graph acyclic.

### Architecture

```
     Heroes & Abilities ──┐                       ┌──► Board Rendering & Juice
     (compileEffects)     │                       │
                          ▼                        │ (canonical events, sync bus)
     Enemy/Telegraph ──► EffectPrimitive[]        ├──► Audio System
     (compileEffects,     │  (ordered, closed      │
      spawnUnit)          │   10-primitive         ├──► Battle HUD
                          ▼   vocabulary)          │
     Turn & Phase Mgr ──► resolve(board, effects) ─┴──► events[]
     (LIVE board)          │       ▲
                           │       │ mutations ONLY via Combat
                           ▼       │
                    Board & Grid (place/clear/setTerrain/setHazard/setFlag)

     Move Preview ──► resolve(board.snapshot(), effects) ──► events[] (overlay only;
                          live board UNTOUCHED — same code path, cloned input)

     Dependencies point downward/one-way: abilities → primitives, never the reverse.
     Combat NEVER calls back into Turn & Phase Manager (cycle broken).
```

### Key Interfaces

```typescript
// The 10-primitive closed vocabulary (registry combat_primitives).
type EffectPrimitive =
  | { kind: 'damage';      targetId: UnitId; amount: number; sourceId?: UnitId }
  | { kind: 'push';        targetId: UnitId; direction: Dir; distance: number; sourceId?: UnitId }
  | { kind: 'pull';        targetId: UnitId; sourceId: UnitId; direction: Dir; distance: number }
  | { kind: 'swap';        unitAId: UnitId; unitBId: UnitId }
  | { kind: 'spawnHazard'; tile: Tile; hazardType: HazardType; duration?: number }
  | { kind: 'applyHazard'; tile: Tile }
  | { kind: 'removeUnit';  targetId: UnitId; cause: RemovalCause }
  | { kind: 'setTerrain';  tile: Tile; terrainType: TerrainType }
  | { kind: 'spawnUnit';   tile: Tile; unitSpec: UnitSpec };
  // 10th "primitive" = the shared collision-resolution algorithm used by push/pull.

// Canonical events — the ONLY vocabulary consumers may subscribe to.
type CombatEvent =
  | { type: 'damage_applied';        targetId: UnitId; amount: number; hp: number }
  | { type: 'displacement_complete'; targetId: UnitId; stepsMoved: number }
  | { type: 'collision_resolved';    a: UnitId; b?: UnitId; collisionDamage: number; kind: 'Edge' | 'Wall' | 'Unit' }
  | { type: 'swap_complete';         unitAId: UnitId; unitBId: UnitId }
  | { type: 'hazard_spawned';        tile: Tile; hazardType: HazardType; duration?: number }
  | { type: 'hazard_applied';        tile: Tile; unitId: UnitId; amount: number }
  | { type: 'unit_removed';          targetId: UnitId; cause: RemovalCause; tile: Tile }
  | { type: 'terrain_set';           tile: Tile; terrainType: TerrainType }
  | { type: 'unit_spawned';          unitId: UnitId; tile: Tile };

// THE single battle-state mutation path. Pure w.r.t. inputs: no RNG, no clock.
// Amended 2026-07-28 — see the Decision section for why `state` exists.
//
// Live commit:  resolve(liveBoard, liveState, effects, { bus: sessionBus })
// Dry-run:      resolve(liveBoard.snapshot(), liveState.snapshot(), effects)
//                 └─ BOTH must be snapshotted. Snapshotting only the Board would
//                    leave a preview mutating real HP while the board stays clean.
//                 └─ Omitting `bus` makes resolve() construct a fresh private one,
//                    so a dry run cannot leak onto the session bus (ADR-0007:
//                    "the silence IS the boundary").
function resolve(
  board: Board,
  state: CombatStateView,
  effects: EffectPrimitive[],
  options?: { bus?: EventBus<CombatEventMap>; config?: CombatConfig },
): CombatEvent[];
```

> **Known footgun, not yet closed.** `options.bus` is a plain `EventBus`, so nothing in
> the type system distinguishes "the shared session bus" from "a disposable preview
> bus". Two mistakes are expressible: passing the session bus into a dry run (preview
> events leak to Audio/Rendering), and omitting the bus on a live commit (the default
> private bus swallows every event silently, with no error). Code review proposed
> splitting into a `resolve(..., liveBus)` with no default plus a separate
> `resolvePreview(...)` that constructs its bus internally, making both mistakes
> unrepresentable. Tracked in `docs/tech-debt-register.md`; deliberately not done in the
> same change as this amendment.

### Implementation Guidelines

- Implement `resolve()` as a strict `for i in 0..effects.length` loop dispatching on
  `effect.kind`. No parallelism, no reordering, no early abort — a removed target
  degrades to a logged no-op (`*_noop(targetId, reason)` marker) and the loop continues.
- **Target-locking:** primitives are addressed by unit ID / tile, never by a live spatial
  query resolved mid-chain. Callers that hit multiple units must snapshot the target-ID
  set once, before resolution (Combat enforces this by taking ID/tile parameters only).
- `removeUnit` is the *only* board exit and is idempotent. HP-to-0 from `damage`/
  `applyHazard` triggers `removeUnit(target, Defeated)` within the same step, before the
  next effect runs.
- `spawnUnit` and `setTerrain` reject illegal targets (non-`Clear` tile / occupied
  Blocked-or-Lethal) as no-ops with a `*_rejected` debug event — never displace, clamp,
  or silently resolve (see ADR-0005's Result-vs-throw contract for the rejection shape).
- Do **not** import PixiJS or reference any renderer/clock from this module (Principle
  P3). Emit events through the synchronous bus (ADR-0002) so ordering is byte-stable.
- Adding an 11th primitive is a design change: amend `combat-resolution.md`, the registry
  `combat_primitives`, and this ADR — code review must reject any un-amended addition.

## Alternatives Considered

### Alternative 1: Distributed mutation — each system mutates the board directly

- **Description**: Heroes, Enemies, Environment, and Encounter setup each call Board's
  mutation API directly with their own logic, instead of routing through one `resolve()`.
- **Pros**: Fewer indirections; each system "owns its own effects" with no compile step.
- **Cons**: Re-introduces the Heroes↔Combat and Enemy↔Combat cycles; makes determinism
  unenforceable (each caller could sneak in RNG/ordering); and makes a trustworthy
  preview impossible without a *second* prediction implementation that will drift.
- **Estimated Effort**: Lower upfront, far higher over the project's life.
- **Rejection Reason**: Directly defeats Principles P1, P2, and P4 and the two named
  structural risks. Non-starter.

### Alternative 2: Open/extensible primitive set (plugin effects)

- **Description**: Keep the single `resolve()` entry point but allow systems to register
  new effect kinds at runtime (an open vocabulary), rather than a fixed set of 10.
- **Pros**: Maximum flexibility for future hero verbs without touching Combat.
- **Cons**: Breaks Pillar #5 (the battle language is no longer enumerable or readable in
  ten seconds); every new effect is an untraced consequence the preview and the player
  must reason about; testing surface becomes unbounded; hidden chain reactions become
  possible.
- **Estimated Effort**: Comparable to the closed set, plus ongoing governance cost.
- **Rejection Reason**: Legibility (Pillar #5) is a design pillar, not a nicety. A closed,
  amend-only vocabulary is the point: new behaviour must be a *deliberate, named,
  design-reviewed* addition, not a silent plugin.

### Alternative 3: Immutable/functional resolution (return a new board)

- **Description**: Make `resolve()` return a brand-new `Board` rather than mutating the
  one passed in (structural sharing / persistent data structure).
- **Pros**: "Purely functional"; snapshotting is free; no accidental shared mutation.
- **Cons**: Immutable board copies per effect are heavier than the flat-typed-array
  in-place mutation ADR-0001 chose; adds allocation pressure on the hot preview path
  (recomputed every hover frame); and immutability is *not required* — determinism is.
- **Estimated Effort**: Higher (persistent data structures + GC pressure tuning).
- **Rejection Reason**: We need determinism, not immutability. Cheap `snapshot()`
  (ADR-0001) already gives preview/undo isolation via a cloned input, at lower cost than
  per-effect immutable copies.

## Consequences

### Positive

- **Cycles broken.** Heroes and Enemies depend on the primitive vocabulary
  one-directionally; Combat never calls back. The dependency graph is acyclic and the
  layer map (`architecture.md` §3) holds.
- **Preview cannot lie.** Move Preview runs the *same* `resolve()` over a snapshot, so
  Preview-Commit Parity is unconditional — the highest-rated technical risk is
  structurally mitigated, not just tested.
- **Determinism guaranteed.** One sequential, RNG-free, clock-free code path → byte-
  identical replay/undo, enabling snapshot undo (ADR-0007) and reproducible tests.
- **Legibility.** A closed 10-verb vocabulary is small enough to hold in the head and to
  render with one accent color per verb-family (Pillar #5).
- **Single audit point.** All balance, all board consequences, and all events flow
  through one function — trivial to profile, test, and reason about.

### Negative

- **A choke point.** Every board change funnels through `resolve()`; a bug here affects
  the whole game. Mitigated by exhaustive headless unit tests (the GDD already specifies
  them) and the function's purity making tests deterministic.
- **New verbs cost a design amendment.** Genuinely novel board behaviour cannot be added
  ad hoc — it requires amending `combat-resolution.md`, the registry, and this ADR. This
  friction is intentional (it protects Pillar #5) but it is real friction.
- **Callers must compile.** Heroes and Enemies must translate every ability into ordered
  primitives (`compileEffects()`) rather than "just doing it," adding an indirection.

### Neutral

- Combat becomes a pure *service* with no scheduling of its own — Turn & Phase Manager
  owns *when*, Combat owns *how*. Ownership is cleanly split but responsibilities move
  around relative to a naive "combat runs the turn" mental model.
- The event log becomes the sole integration surface for all Presentation systems; they
  never query Combat directly.

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| A future "convenience" helper mutates the board outside `resolve()` | Medium | High (re-introduces a cycle + breaks preview parity) | Code review rule + a test asserting Board mutation methods are only reachable from Combat; Principle P2 is a merge-blocking invariant. |
| An 11th primitive is added as a hidden branch of an existing one | Medium | High (breaks legibility/testability) | Closed-vocabulary rule: any new `kind` must amend `combat-resolution.md` + registry + this ADR; review rejects otherwise. |
| Hidden non-determinism (RNG/clock/iteration-order) sneaks into `resolve()` | Low | Critical (breaks the whole preview/undo/replay premise) | ≥100-run determinism smoke test asserting byte-identical state + event log; lint/ban `Math.random`/`Date.now` in the sim module. |
| Preview drifts because a caller builds effects differently for preview vs commit | Low | Critical | Move Preview passes the *identical* `candidateEffects` list to the *same* `resolve()`; call-interception test verifies the same entry point is used, not a reimplementation. |

## Performance Implications

Headless TypeScript benchmarks, decoupled from render (from `combat-resolution.md` and
`move-preview.md` performance budgets). "Before" is N/A — this is the first implementation
of the mutation path.

| Metric | Before | Expected After | Budget |
|--------|--------|---------------|--------|
| CPU — single primitive (`damage`/`applyHazard`/`removeUnit`/`spawnHazard`) | N/A | < 0.02 ms/call | < 0.02 ms/call |
| CPU — single `push`/`pull` step | N/A | < 0.02 ms/step | < 0.02 ms/step (loop hard-bounded to ≤14 iters) |
| CPU — full effect chain for one action (~1–10 primitives) | N/A | < 1 ms | < 1 ms |
| CPU — `resolve()` during Move Preview (chain + `snapshot()`) | N/A | < 2 ms combined | < 2 ms combined; inside one 16.6 ms (60 fps) frame |
| Memory | N/A | Dominated by ADR-0001's flat-typed-array `snapshot()` (array copy, no object-graph clone) | Snapshot < 1 ms on ≤12×12 |
| Network | N/A | None (single-player, fully local) | N/A |

## Migration Plan

This is a greenfield decision — no existing system is being changed, so there is nothing
to migrate. Implementation ordering:

1. Accept ADR-0001 (Board `snapshot()`) and ADR-0002 (synchronous event bus) first —
   `resolve()` depends on both. Verify: both marked Accepted.
2. Implement `resolve()` + the 10 primitives against the Board contract; wire canonical
   events onto the synchronous bus. Verify: the full Acceptance Criteria in
   `combat-resolution.md` pass headlessly in Vitest.
3. Implement `compileEffects()` in Heroes & Abilities and Enemy/Telegraph to emit ordered
   primitives; wire Move Preview to `resolve(board.snapshot(), effects)`. Verify:
   Preview-Commit Parity test passes.

**Rollback plan**: Because this is the foundational mutation contract, "rollback" means
re-opening the ADR, not reverting code — every downstream system is built on it. If the
closed-vocabulary constraint proves too rigid, the reversible escape hatch is *amending*
the vocabulary (adding a named 11th primitive via a superseding ADR), not abandoning the
single-mutation-path invariant, which is non-negotiable for determinism.

## Validation Criteria

- [ ] Determinism smoke test: identical `(board, effects)` on freshly-constructed
      identical boards yields byte-identical resulting state and identical event logs over
      ≥100 runs.
- [ ] `resolve(board.snapshot(), effects)` leaves the original `board` byte-identical
      (dry-run isolation).
- [ ] Preview-Commit Parity: for an unchanged live board, the committed event log equals
      the preview event log for the same candidate (verified via call-interception that
      the *same* `resolve()` entry point is used).
- [ ] A grep/lint check confirms no system outside Combat calls Board's mutation methods
      (`place`/`clear`/`setTerrain`/`setHazard`/`setFlag`).
- [ ] The simulation module imports no PixiJS/renderer and runs fully headless in Vitest.
- [ ] No `Math.random`/`Date.now`/`performance.now` (or equivalent) appears in the sim
      resolution path.
- [ ] The primitive `kind` union has exactly the 9 tagged effects + the shared collision
      algorithm (10 total); adding a `kind` requires an amendment to
      `combat-resolution.md` and this ADR.

## GDD Requirements Addressed

| GDD Document | System | Requirement | How This ADR Satisfies It |
|-------------|--------|-------------|--------------------------|
| `design/gdd/combat-resolution.md` | Combat Resolution | "Combat Resolution exposes exactly one entry point: `resolve(board, effects[]) → events[]`" and "owns exactly these ten primitives and nothing else" (Rules 1–2) | Codifies `resolve()` as the single entry point and the 10 primitives as the closed, amend-only vocabulary. |
| `design/gdd/combat-resolution.md` | Combat Resolution | "Effects are applied strictly sequentially… this is what guarantees determinism" (Rule 2); no RNG, no wall-clock (Overview) | Mandates strict in-order application with no parallelism, and determinism (not immutability) as the purity contract. |
| `design/gdd/combat-resolution.md` | Combat Resolution | `spawnUnit` is "the single board-mutation path for adding a unit"; `removeUnit` is "the single exit point from the board" (Rules 8, 15) | Both are members of the closed vocabulary; no other code adds or removes a unit. |
| `design/gdd/combat-resolution.md` | Combat Resolution | "breaks the Heroes↔Combat and Enemy↔Combat dependency cycles: abilities depend on Combat's primitives one-directionally" (Overview) | Combat never calls back into callers; abilities compile *to* primitives, producing an acyclic graph. |
| `design/gdd/move-preview.md` | Move Preview | "dry-running the same Combat Resolution `resolve()` entry point used for the real commit, against a disposable `Board.snapshot()`" (Overview, Rule 2); Preview-Commit Parity (Rule 3) | The single `resolve()` + `snapshot()` input is exactly what makes preview and commit unable to diverge — no parallel prediction path exists to drift. |
| `design/gdd/combat-resolution.md` / `design/gdd/move-preview.md` | Combat / Move Preview | Canonical event vocabulary consumed by Rendering, HUD, Audio, Preview; "there is no `push_resolved`/`apply()` event or entry point" | Fixes the canonical `CombatEvent` names as the sole integration surface, delivered over the synchronous bus (ADR-0002). |

> Pillars served: **#1 Perfect Information, Perfect Blame** (determinism + preview
> parity), **#2 Positioning Over Power** (`push`/`pull`/`swap` are first-class primitives
> equal to `damage`), **#4 Every Hero Is a Verb** (a whole kit compiles to positioning
> primitives), **#5 Read in Ten Seconds** (closed, enumerable vocabulary).

## Related

- **Depends on**: `docs/architecture/adr-0001-*` (Board tile-state + cheap `snapshot()`);
  `docs/architecture/adr-0002-*` (deterministic synchronous event bus).
- **Enables**: ADR-0007 (snapshot-based undo & preview reuse one simulation); ADR-0008
  (shared `Unit` record schema).
- **Canonical contract**: `design/architecture/cross-system-contracts.md` §1 (where any
  GDD disagrees, the contract wins).
- **Architecture**: `docs/architecture/architecture.md` §4 (Combat ownership row), §5
  (data flow), §8 (Required ADR A6), §9 (Principles P1–P6).
- **Registry**: `combat_primitives` (the 10-primitive set); `unit_record`.
- **GDDs**: `design/gdd/combat-resolution.md`, `design/gdd/move-preview.md`.
- **Implementation**: (to be linked once `resolve()` is implemented under `src/`).
