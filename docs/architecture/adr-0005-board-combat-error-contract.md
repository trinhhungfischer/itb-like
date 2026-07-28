# ADR-0005: Board/Combat error contract (Result vs throw)

## Status

Accepted

## Date

2026-07-28

## Last Verified

2026-07-28

## Decision Makers

Technical Director (owner); reconciled against `design/architecture/cross-system-contracts.md` (canonical) and the Board & Grid + Combat Resolution GDDs.

## Summary

Establishes a single, project-wide rule for how the Board & Grid and Combat
Resolution layers signal a refused operation: **expected gameplay rejections**
(placing on an occupied tile, `setTerrain`/`spawnUnit` onto an illegal tile)
return a value-typed `Result` and never throw, while **genuine programmer
errors** (constructing a board with `W < 1`, querying with an out-of-bounds
origin, negative-`amount` damage) assert/throw. This resolves Board & Grid Open
Q1 and makes the error surface uniform across Combat, tests, HUD, and Run
Structure.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | None — pure web (TypeScript + PixiJS + Vite), 2D WebGL |
| **Domain** | Core / Scripting (error-handling contract for the simulation core) |
| **Knowledge Risk** | **LOW** |
| **References Consulted** | `design/architecture/cross-system-contracts.md` §1–§2; `docs/architecture/architecture.md` §2, §6, §8 (A5); `design/gdd/board-and-grid.md`; `design/gdd/combat-resolution.md` |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | None — this is a language-level convention (TypeScript discriminated unions + `throw`/assert), not an engine API. No native engine surface, no Godot/Unity/Unreal dependency, no post-cutoff engine gap to manage. |

> **Not applicable / low risk.** VANGUARD ships on a pure-web stack with no
> native engine. This decision rests only on stable TypeScript language features
> (tagged unions, `throw`, `console.assert`/invariant helpers) that are well
> within the toolchain's baseline. The `docs/engine-reference/godot/` snapshot
> does **not** apply to this build and was intentionally not consulted. This ADR
> does not need engine-version re-validation.

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | None |
| **Enables** | A6 (Combat `resolve()` single mutation path — its primitive-rejection semantics assume this contract); A7 (snapshot undo/preview — preview must observe rejections without exceptions); A3 (Run Persistence Result-vs-throw handling reuses this convention) |
| **Blocks** | Board & Grid implementation; Combat Resolution implementation; every Core/Feature story that mutates the board |
| **Ordering Note** | A Foundation ADR — decide before any Core code. Independent of A1–A4; may be authored in parallel with them. |

## Context

### Problem Statement

Board & Grid and Combat Resolution both refuse operations for two
fundamentally different reasons, and the GDDs currently describe the refusals
in prose without pinning *how* the refusal is signaled in code:

- Board & Grid Open Q1 asks directly: "How does the board signal a rejected
  mutation (`place()` on occupied, `W < 1` construction, OOB `tilesInRange`
  origin)?" and proposes — but does not ratify — a Result-vs-throw split.
- Combat Resolution's Edge Cases already assume both behaviors: `spawnUnit` on a
  non-`Clear` tile is "rejected as a no-op" that "emits a
  `spawn_unit_rejected` event," whereas `damage` with `amount < 0` is "enforced
  by an assertion, not silently clamped."

Without a ratified contract, three risks compound: (1) each implementer picks
their own convention, so the board might throw where Combat expects a return
value; (2) test code cannot know whether to assert-throws or assert-returns; (3)
presentation consumers (HUD, Move Preview) that dry-run `resolve()` on a
snapshot could be crashed by an exception thrown for what is really an ordinary
"that move is illegal" outcome — directly threatening the trustworthy-preview
pillar. This must be decided **now**, before any Core code is written, because
every mutation call site and every test depends on it.

### Current State

- `board-and-grid.md` lists a canonical mutation API (`place`, `clear`,
  `setTerrain`, `setHazard`, `setFlag`) and a pure query API, with Open Q1
  explicitly deferring the error-signaling contract to "Tech architecture."
- `board-and-grid.md` Edge Cases already fix the *semantics* of each rejection
  (e.g. "the board rejects the second `place()` and raises an invariant
  violation to the caller"; "OOB origin → rejected (assert)"; "`W < 1` →
  rejected at construction") but not the *mechanism*.
- `combat-resolution.md` already emits debug events for gameplay rejections
  (`spawn_unit_rejected`, `set_terrain_rejected`, `swap_failed`) and already
  specifies assertions for caller-contract violations (`amount < 0`, `pull`
  without a direction).
- `architecture.md` §6 shows `place()` and `setTerrain()` returning a `Result`
  type in the illustrative interface, and §8 lists this as Required ADR **A5**.

The pieces exist and are mutually consistent; what is missing is the ratified,
one-line rule that binds them and the precise taxonomy of which call falls on
which side.

### Constraints

- **Determinism is a hard invariant (Principle P1).** The chosen mechanism must
  not introduce nondeterminism. A `Result` return is a pure value; a `throw` on
  a programmer error is acceptable because it fires only on a bug, never on a
  legal input, so it cannot alter the byte-identical state/event log of any
  valid run.
- **One board-mutation path (Principle P2).** All board mutation flows through
  Combat `resolve()`; the error contract must compose with sequential,
  never-aborting effect-chain resolution (`combat-resolution.md` Rule 2 / effect
  chain state table: "even if effect `i` removes a unit that effect `i+2`
  targets, resolution continues... the chain itself never aborts partway").
- **Pure, headless-testable simulation core (Principle P3).** The contract must
  be verifiable in Vitest with no canvas and no renderer.
- **Contract source of truth.** Where any GDD and `cross-system-contracts.md`
  diverge, the contracts file wins; this ADR must stay consistent with it.
- **Pure-web stack.** TypeScript strict mode is the only enforcement mechanism
  available — there is no engine-provided error type.

### Requirements

- Every mutation and query in Board & Grid and every primitive in Combat
  Resolution must fall unambiguously on exactly one side of the split.
- Expected gameplay rejections must be observable as a value (so Move Preview
  and the HUD can dry-run and inspect an outcome without exception handling).
- Programmer errors must fail loudly and early (fail-fast) so bugs surface in
  development and tests rather than silently corrupting board state.
- The rule must be stateable in one sentence a programmer can apply without
  re-reading this ADR.
- Rejections that occur inside an effect chain must not abort the chain
  (consistency with Rule 2 / target-locking Rule 11).

## Decision

Adopt a **two-channel error contract**, split on a single question: *is this a
possible outcome of legal gameplay, or is it only reachable through a caller
bug?*

**Channel 1 — Expected gameplay rejections → return a `Result`, never throw.**
An operation that a correct, rule-abiding caller can legitimately attempt and
that the rules simply refuse returns a typed `Result` value. It performs no
state change (or the documented idempotent no-op), and — inside Combat — emits
the already-specified debug/telemetry event. It does **not** throw.

**Channel 2 — Genuine programmer errors → assert/throw.** An operation that is
only reachable if a caller violated the interface contract (bad construction
arguments, out-of-bounds query origin, negative damage, a `pull` with no
direction) throws (or trips an assertion/invariant helper). These conditions can
never arise from legal gameplay; a throw here is a fail-fast bug signal, not a
gameplay branch, so it never executes on a valid run and never perturbs
determinism.

### The one-sentence rule

> **If a rule-abiding player or AI could cause it, return a `Result`; if only a
> code bug could cause it, throw.**

### Taxonomy (authoritative — every call site placed on one side)

**Channel 1 — Result (no throw), from the GDDs:**

| Operation | Rejection condition | Result outcome | Debug event |
|-----------|--------------------|----------------|-------------|
| `Board.place(tile, unit)` | tile already `Occupied` | `Rejected(Occupied)`, occupant unchanged | — (Combat authors the event) |
| `Board.setTerrain(tile, t)` | tile occupied and target is `Blocked`/`Lethal` | `Rejected(WouldStrandOccupant)` | `set_terrain_rejected` |
| `Board.destroy(tile)` (`= setTerrain(tile, Normal)`) | tile is non-destructible `Blocked` or a `Chasm` | `Rejected(NotDestructible)` / no-op | — |
| `Combat.spawnUnit(tile, spec)` | `classify(tile) ∈ {Occupied, Blocked, Lethal, OutOfBounds}` | `Rejected(TileNotClear)`, no unit created | `spawn_unit_rejected` |
| `Combat.swap(a, b)` | either unit already removed | `Rejected(UnitNotOnBoard)`, no partial swap | `swap_failed` |
| `Board.clear(emptyTile)` | tile already empty | `Ok` (idempotent no-op) | — |
| A primitive targeting an already-removed unit | stale target mid-chain | `Ok`/no-op, chain continues (Rule 8) | `*_noop(reason:'already_removed')` |

**Channel 2 — assert/throw, from the GDDs:**

| Operation | Programmer-error condition | Rationale |
|-----------|--------------------------|-----------|
| Board construction | `W < 1` or `H < 1` | No board can exist; content minimums are larger — a `< 1` value is a bug (`board-and-grid.md` Core Rule / Edge Case). |
| `tilesInRange(origin, R)`, `neighbors`, other origin-taking queries | `origin` is out of bounds | "origins must be valid tiles; callers validate coordinates first." |
| `tilesInRange(origin, R)` | `R < 0` | Negative radius is meaningless; consistent with OOB-origin handling. |
| `Combat.damage(target, amount)` | `amount < 0` | Negative damage is healing — a different concept; "enforced by an assertion, not silently clamped." |
| `Combat.pull(target, source, direction, distance)` | no `direction` supplied | Combat never infers direction (`combat-resolution.md` Rule 5). |

> Boundary note: an **out-of-bounds push destination** is *not* a Channel-2
> error. `step()` deliberately returns a coordinate that may be off-board so the
> displacement algorithm can detect an edge collision (`classify → OutOfBounds`)
> as an ordinary gameplay outcome. Only an out-of-bounds *query origin* is a
> programmer error. This distinction is the crux of the contract and must be
> preserved.

### Architecture

```
                 A board/combat operation is requested
                                 │
                 ┌───────────────┴────────────────┐
                 ▼                                 ▼
   Could a rule-abiding player/AI          Only reachable via a
   legitimately cause this?                caller/code bug?
                 │                                 │
                 ▼                                 ▼
        CHANNEL 1: return Result            CHANNEL 2: assert/throw
        ─ Ok | Rejected(reason)             ─ throw InvariantError
        ─ no state change on reject         ─ fail-fast in dev & tests
        ─ Combat emits debug event          ─ never fires on a valid run
        ─ chain continues (Rule 2)          ─ so determinism is preserved
                 │                                 │
                 ▼                                 ▼
   Consumed by: Combat, Move Preview,       Consumed by: test suite
   HUD, tests (inspect the value)           (assert throws), CI
```

### Key Interfaces

```typescript
// ── Channel 1: the value-typed Result for expected gameplay rejections ─────────
type RejectReason =
  | 'Occupied'            // place onto an occupied tile
  | 'TileNotClear'        // spawnUnit onto Occupied/Blocked/Lethal/OutOfBounds
  | 'WouldStrandOccupant' // setTerrain(occupied tile, Blocked|Lethal)
  | 'NotDestructible'     // destroy() a permanent/solid tile
  | 'UnitNotOnBoard'      // swap with a removed unit
  | 'OutOfBounds';        // a push/move *destination* off the board (edge collision)

type Result =
  | { ok: true }
  | { ok: false; reason: RejectReason };

// Board mutations that can be legitimately refused return Result (never throw):
interface BoardMutations {
  place(t: Tile, u: UnitId): Result;
  setTerrain(t: Tile, terrain: TerrainType): Result;
  clear(t: Tile): void;                 // idempotent no-op; success is unconditional
  setHazard(t: Tile, h: HazardType | null): void;
  setFlag(t: Tile, flag: TileFlag): void;
}

// ── Channel 2: fail-fast invariant for programmer errors ───────────────────────
class InvariantError extends Error {}   // thrown; never caught in the sim path
function invariant(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new InvariantError(msg);
}

// Construction and origin-taking queries throw on contract violation:
function makeBoard(w: number, h: number): Board {
  invariant(w >= 1 && h >= 1, `board dims must be >= 1, got ${w}x${h}`);
  /* ... */
}
function tilesInRange(origin: Tile, R: number, board: Board): Tile[] {
  invariant(board.inBounds(origin.col, origin.row), 'tilesInRange: OOB origin');
  invariant(R >= 0, 'tilesInRange: negative radius');
  /* ... */
}
```

### Implementation Guidelines

1. **Never throw for a Channel-1 condition.** Move Preview dry-runs `resolve()`
   on a `snapshot()`; an exception thrown for a merely-illegal move would crash
   the preview overlay. Rejections must be values it can read.
2. **Never swallow a Channel-2 throw inside the sim path.** `InvariantError`
   propagates to the top of the frame and fails the test/CI. Do not wrap
   `resolve()` in a try/catch that hides invariant violations.
3. **A rejection inside an effect chain does not abort the chain.** A rejected
   primitive returns its `Result`/no-op, emits its debug event, and resolution
   continues to the next effect (Rule 2, Rule 8). Only a Channel-2 throw stops
   execution — and that only ever happens on a bug.
4. **Combat owns the rejection *event*; the Board owns the rejection *value*.**
   `Board.place` returns `Result`; the `spawn_unit_rejected` /
   `set_terrain_rejected` / `swap_failed` telemetry events are emitted by the
   Combat primitive that observed the `Result`, keeping the Board free of event
   knowledge.
5. **Prefer a shared `invariant()` helper over bare `throw`** so assertions read
   uniformly and can be centrally logged in dev builds.
6. **Tests assert the correct channel.** Gameplay-rejection tests assert the
   returned `Result` (`ok:false, reason:...`) and that state is unchanged;
   programmer-error tests assert that the call *throws* (`expect(...).toThrow`).

## Alternatives Considered

### Alternative 1: Throw for everything (exceptions as the only channel)

- **Description**: Every refused operation — occupied-tile placement included —
  throws a typed exception the caller must catch.
- **Pros**: One mechanism to learn; impossible to ignore a rejection by
  forgetting to check a return value.
- **Cons**: Move Preview dry-runs a whole turn on a snapshot; illegal moves are
  a *normal, frequent* part of that exploration, so the hot path would be paved
  with try/catch and thrown exceptions — expensive, noisy, and easy to
  over-catch (swallowing a real bug). Exceptions-as-control-flow also obscure
  which refusals are bugs vs. gameplay, defeating the "perfect blame" pillar.
- **Estimated Effort**: Similar to chosen.
- **Rejection Reason**: Collapses two semantically different situations into one
  channel and puts exceptions on a hot, legitimate path.

### Alternative 2: Return a Result for everything (never throw)

- **Description**: Even `W < 1` construction and OOB query origins return an
  error value instead of throwing.
- **Pros**: Total uniformity; no exceptions anywhere; every caller handles a
  value.
- **Cons**: Programmer errors would be silently returnable and thus ignorable —
  a caller that forgets to check `makeBoard`'s Result proceeds with a
  half-constructed board, and the bug surfaces far from its cause. Fail-fast is
  lost; test suites can no longer assert "this misuse throws." It also forces
  pure queries (`neighbors`, `distance`) to adopt a Result wrapper, polluting
  the clean query API for a condition that can only be a bug.
- **Estimated Effort**: Slightly higher (Result plumbing on pure queries).
- **Rejection Reason**: Sacrifices fail-fast bug detection to buy a uniformity
  that has no gameplay value; makes bugs quieter, not louder.

### Alternative 3: Sentinel/null returns (no Result type, no throw)

- **Description**: Rejections return `false`/`null`; misuse also returns
  `null`.
- **Pros**: Zero new types; minimal ceremony.
- **Cons**: `null` carries no reason, so HUD/telemetry cannot distinguish
  "occupied" from "out of bounds"; conflates the two channels again; and TypeScript
  cannot force the caller to handle it as strongly as a discriminated union.
- **Estimated Effort**: Lowest.
- **Rejection Reason**: Loses the rejection *reason* that HUD and debug events
  need, and gives up compiler-enforced exhaustiveness.

## Consequences

### Positive

- **Trustworthy preview is protected.** Move Preview can dry-run `resolve()` on
  a snapshot and read rejections as values — no exception can crash the overlay
  for a merely-illegal move (Pillar #1).
- **Bugs fail loud and early.** Construction/origin misuse throws in dev and
  CI, at the call site, instead of silently corrupting board state.
- **One rule, applied everywhere.** Combat, Board, tests, HUD, and Run Structure
  all read/handle rejections the same way; the taxonomy leaves no call site
  ambiguous.
- **Determinism preserved.** Channel-1 returns are pure values; Channel-2 throws
  never fire on a valid input, so no byte of a legal run's state/event log
  changes.
- **Clean test story.** Gameplay rejections are asserted as returned values;
  programmer errors are asserted as throws — the two GDDs' acceptance criteria
  map directly onto the two channels.

### Negative

- **Two mechanisms to remember.** Implementers must correctly classify each new
  operation. Mitigated by the one-sentence rule and the taxonomy table; new
  primitives must state their channel in review.
- **Callers must actually check the `Result`.** A returned rejection can be
  ignored (unlike a throw). Mitigated by TypeScript's discriminated union
  (`ok:false` narrows) and lint/review discipline; the Combat layer that emits
  the debug event is the natural checkpoint.
- **The edge-collision boundary is subtle.** "OOB destination = gameplay,
  OOB origin = bug" must be taught, or someone will wrongly make `step()` throw.
  Mitigated by the explicit boundary note and a dedicated test.

### Neutral

- Debug/telemetry events for rejections (`spawn_unit_rejected`, etc.) are
  already specified in `combat-resolution.md`; this ADR ratifies where they sit
  (Combat emits, Board returns) but adds no new event names.
- No change to the canonical Combat event vocabulary or the `resolve()`
  signature.

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| An implementer throws for a Channel-1 rejection, crashing Move Preview | Medium | High | Taxonomy table + guideline 1; a preview-on-illegal-move test that asserts no throw |
| A Channel-2 throw is swallowed by an over-broad try/catch, hiding a bug | Low | High | Guideline 2; forbid try/catch around `resolve()` in the control manifest |
| `Result` returns silently ignored by a caller | Medium | Medium | Discriminated union forces `ok` narrowing; Combat is the single checkpoint that reads Board Results |
| Misclassifying the OOB-origin vs OOB-destination boundary | Low | Medium | Explicit boundary note + dedicated acceptance test for each side |

## Performance Implications

| Metric | Before | Expected After | Budget |
|--------|--------|---------------|--------|
| CPU (frame time) | n/a | negligible (a value return / branch) | Board queries avg < 0.01 ms; full preview board cost < 2 ms/frame |
| Memory | n/a | negligible (small `Result` objects, or a shared frozen `Ok`) | Within Board & Grid budget |
| Load Time | n/a | none | n/a |
| Network | n/a | n/a (single-player, local) | n/a |

A `Result` is a tiny discriminated union; a single frozen `{ ok: true }`
singleton can be shared to avoid per-call allocation on the hot preview path.
`throw` costs nothing on the happy path because Channel-2 conditions never occur
on valid input. No measurable impact on the Board `snapshot()` / `resolve()`
budgets in `board-and-grid.md` and `combat-resolution.md`.

## Migration Plan

No system is implemented yet — this ADR is authored before Core code exists, so
there is nothing to migrate. It instead constrains the initial implementation:

1. Define `Result`, `RejectReason`, `InvariantError`, and the `invariant()`
   helper in the Foundation layer before Board & Grid mutations are written.
2. Implement Board mutations to return `Result` (Channel 1) and construction /
   origin-taking queries to `invariant()` (Channel 2), per the taxonomy.
3. Implement Combat primitives to read the Board `Result` and emit the specified
   rejection events, and to `invariant()` on `amount < 0` / missing `pull`
   direction.
4. Encode both channels in the acceptance-test suites of both GDDs (returns vs
   throws).

**Rollback plan**: If the split proves burdensome, the fallback is Alternative 1
(throw-everywhere) — but reversing is costly because every mutation call site
and its tests would change from value-checks to try/catch. Given that cost, the
decision is deliberately made up front, before call sites multiply.

## Validation Criteria

- [ ] `Board.place` on an occupied tile returns `{ok:false, reason:'Occupied'}`,
      does not throw, and leaves the occupant unchanged.
- [ ] `Combat.spawnUnit` / `setTerrain` / `swap` refusals return a `Result` and
      emit their specified debug event, and the enclosing effect chain continues
      to the next primitive.
- [ ] `makeBoard(0, 8)` and `makeBoard(8, 0)` throw `InvariantError`; no board is
      produced.
- [ ] `tilesInRange` / `neighbors` with an out-of-bounds origin throw; `tilesInRange`
      with `R < 0` throws.
- [ ] `Combat.damage` with `amount < 0`, and `pull` without a direction, throw.
- [ ] A push whose destination is off-board resolves as an **edge collision**
      (Channel 1), not a throw — confirming the origin-vs-destination boundary.
- [ ] Move Preview dry-runs a turn containing multiple illegal moves on a
      `snapshot()` with **zero** exceptions thrown.

## GDD Requirements Addressed

| GDD Document | System | Requirement | How This ADR Satisfies It |
|-------------|--------|-------------|--------------------------|
| `design/gdd/board-and-grid.md` | Board & Grid | Open Q1: "How does the board signal a rejected mutation (`place()` on occupied, `W < 1` construction, OOB `tilesInRange` origin)?" | Ratifies the proposed split: `place`-on-occupied returns a `Result`; `W < 1` construction and OOB `tilesInRange` origin throw. |
| `design/gdd/board-and-grid.md` | Board & Grid | Core Rule 5 / Edge Case: a second `place()` on a tile "is rejected and reported to the caller" without stacking | Rejection is a `Result` value with `reason:'Occupied'`; occupant unchanged, no throw. |
| `design/gdd/board-and-grid.md` | Board & Grid | Edge Cases: `W < 1`/`H < 1` construction rejected; OOB `tilesInRange`/`neighbors` origin "rejected (assert)"; `R < 0` rejected (assert) | Classified as Channel 2 (programmer errors) — assert/throw, fail-fast. |
| `design/gdd/combat-resolution.md` | Combat Resolution | `spawnUnit` on a non-`Clear` tile "rejected as a no-op" emitting `spawn_unit_rejected`; `setTerrain` on occupied→Blocked/Lethal "rejected" emitting `set_terrain_rejected`; `swap` with removed unit → `swap_failed` | Channel 1: these return a `Result`, mutate nothing, emit the specified debug event, and never abort the chain (Rule 2). |
| `design/gdd/combat-resolution.md` | Combat Resolution | `damage` with `amount < 0` "enforced by an assertion, not silently clamped"; `pull` requires an explicit `direction` (Rule 5) | Channel 2: caller-contract violations assert/throw. |
| `design/gdd/combat-resolution.md` | Combat Resolution | Rule 2 / effect-chain state table: "the chain itself never aborts partway" | Channel-1 rejections are per-primitive no-ops that let resolution continue; only a Channel-2 bug throws — preserving sequential, non-aborting resolution and determinism (Pillar #1). |

## Related

- `docs/architecture/architecture.md` §8 — Required ADR **A5** (this document);
  §6 shows `place()`/`setTerrain()` returning `Result` in the illustrative
  interface.
- `design/architecture/cross-system-contracts.md` §1–§2 — canonical Combat
  primitive and Board mutation/query surfaces this contract governs (contract
  wins on any divergence).
- Enables **A6** (single board-mutation path), **A7** (snapshot undo/preview),
  and reuses into **A3** (Run Persistence Result-vs-throw handling).
- Implements Architecture Principles **P1** (determinism), **P2** (one mutation
  path), **P3** (headless-testable core).
