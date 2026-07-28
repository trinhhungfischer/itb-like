# ADR-0001: Board tile-state representation & cheap `snapshot()`

## Status

Accepted

## Date

2026-07-28

## Last Verified

2026-07-28

## Decision Makers

Technical Director (owner); consulted: Board & Grid, Move Preview, and Turn & Phase
Manager GDD owners via `design/architecture/cross-system-contracts.md` (canonical).

## Summary

Board tile-state (terrain, occupancy, hazard, flags) is stored as **parallel flat
typed arrays** indexed by `index(c, r) = r * W + c`, so `Board.snapshot()` is a bulk
typed-array copy (< 1 ms) rather than an object-graph clone. This resolves Board &
Grid Open Q2 and unblocks the Move Preview per-hover snapshot budget and the Turn &
Phase Manager per-action undo snapshot — the two hottest consumers of `snapshot()`.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | None — pure web (TypeScript + PixiJS + Vite), no native game engine |
| **Domain** | Core / Foundation (spatial data model) |
| **Knowledge Risk** | LOW |
| **References Consulted** | `design/architecture/cross-system-contracts.md` §2; `docs/architecture/architecture.md` §2, §6, §8 (A1); `design/gdd/board-and-grid.md`; `design/gdd/move-preview.md`; `design/gdd/turn-and-phase-manager.md` |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | None — see note below |

> **Note**: Engine compatibility is **not applicable / low risk** for this decision.
> VANGUARD is a pure-web build (TypeScript + PixiJS 2D WebGL + Vite) with **no native
> engine** — there is no Godot / Unity / Unreal API surface, and therefore no
> post-cutoff engine knowledge gap to manage. The Godot engine-reference in
> `docs/engine-reference/` does **not** apply to this build and was intentionally not
> consulted. `ArrayBuffer` / typed arrays (`Uint8Array`, `Int32Array`, `.slice()`,
> `.set()`) and `structuredClone` are stable, universally supported ES features well
> within the model's knowledge; nothing here depends on a bleeding-edge browser API.

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | None (foundational — Board & Grid is a dependency root) |
| **Enables** | ADR A6 (Combat `resolve()` as single mutation path), A7 (snapshot-based undo & preview reuse one simulation); every simulation system that reads or copies the board |
| **Blocks** | Board & Grid implementation; Move Preview; Turn & Phase Manager undo stack; Combat Resolution (mutation call sites) — none may begin until this is Accepted |
| **Ordering Note** | First of the five Foundation ADRs (A1). Decide before any Core code (`architecture.md` §8). |

## Context

### Problem Statement

`Board.snapshot()` is the single highest-risk operation in the simulation core. Two
systems call it on the hottest paths:

- **Move Preview** snapshots the live board on **every hover** so it can dry-run
  `Combat.resolve(snapshot, effects)` without touching live state
  (`cross-system-contracts.md` §7; `move-preview.md` Rule 4). Its latency budget is
  `t_preview = t_snapshot + t_resolve + t_diff ≤ 5 ms`, with `t_snapshot` budgeted at
  **< 1 ms** (`move-preview.md` F1).
- **Turn & Phase Manager** captures a snapshot at Player-Phase start and **after each
  action's full consequence chain**, holding a stack of them for in-phase undo/redo
  (`turn-and-phase-manager.md` Rule 4, F2, F3; `cross-system-contracts.md` §3).

If `snapshot()` is implemented as a naive object-graph deep clone (144 tile objects,
each with nested fields, cloned recursively or via `structuredClone`), it allocates
hundreds of short-lived objects per hover, creating GC pressure inside a 16.6 ms
frame and putting the < 1 ms budget at risk. **The board's internal data
representation must be chosen so that `snapshot()` is cheap by construction** — this
is a foundational data-layout decision that every simulation system inherits, so it
must be made before any Core code is written. Deferring it forces Board, Combat,
Move Preview, and Turn Manager to be built against an unknown copy cost.

### Current State

No implementation exists — `docs/architecture/` contains no prior `adr-*.md`
(`architecture.md` §7). `board-and-grid.md` explicitly flags tile-state
representation and the `snapshot()` strategy as **Open Q2**, an ADR owned by Tech
architecture, with a proposed direction (flat typed arrays) awaiting formal decision.
This ADR is that decision.

### Constraints

- **Determinism (P1).** Board state and its copies must be byte-reproducible; no
  hidden identity, no RNG, no wall-clock. Same inputs → identical board and identical
  snapshot, every run and across reloads.
- **Single mutation path (P2).** Only `Combat.resolve()` mutates the board, via the
  board's mutation methods (`place`, `clear`, `setTerrain`, `setHazard`, `setFlag`).
  The representation must not leak mutable references that let anyone else write state.
- **Pure headless core (P3).** The representation lives in the Foundation layer and
  must not import PixiJS; it must run and benchmark headless under Vitest.
- **Board size.** v1 boards are `≤ 12 × 12` (≤ 144 tiles); `size = 1` (single-tile
  units only). Multi-tile units are deferred (Board Open Q7).
- **Contract authority.** The Board query/mutation surface in
  `cross-system-contracts.md` §2 and `architecture.md` §6 is fixed; this decision may
  change the *internal* layout only, not the public method signatures. **The contract
  wins.**

### Requirements

- `snapshot()` full deep-copy of a `≤ 12 × 12` board in **< 1 ms/call**
  (`board-and-grid.md` Performance Budget; `move-preview.md` F1).
- Combined board cost per frame during active Move Preview **< 2 ms**, leaving ≥ 14 ms
  for render + logic in a 60 fps frame.
- A snapshot is a **fully independent** copy: mutating the copy must never affect the
  live board (no shared references) — `board-and-grid.md` snapshot acceptance test.
- All O(1) queries (`inBounds`, `isOccupied`, `getOccupant`, `isBlocked`, `getHazard`,
  `hasFlag`, `classify`, `step`, `distance`, `neighbors`) stay avg **< 0.01 ms/call** —
  the representation must not tax the query path to make copies cheap.
- Undo stack of up to `H × A_max + 1` snapshots fits a modest memory footprint
  (`turn-and-phase-manager.md` F3 estimates ~74 KB peak per phase).

## Decision

Store all per-tile board state as **parallel, flat, fixed-length typed arrays**, one
array per state field, each of length `W * H`, addressed by a single row-major index
function:

```
index(c, r) = r * W + c        // c = column (x), r = row (y); 0 ≤ c < W, 0 ≤ r < H
```

Each tile's state is the tuple of same-index cells across the parallel arrays. There
is **no per-tile object** in the hot representation — a `Tile` / `TileState` value is
materialized only at the query boundary (`getTile`) as a read-only view, never stored.

`snapshot()` allocates a new `Board` whose arrays are **byte-copies** of the source
arrays (`typedArray.slice()` / `new Uint8Array(src)` — a bulk `memcpy`, O(W·H) bytes,
no per-element object allocation). This is the entire cost of a snapshot.

### Architecture

```
 Board (live)                                snapshot()  ── bulk memcpy per array ──►  Board (copy, independent)
 ┌──────────────────────────────────────┐                                             ┌──────────────────────────┐
 │ W, H                                  │                                             │ W, H                     │
 │ terrain   : Uint8Array [W*H]  ────────┼── .slice() ────────────────────────────────┼─► terrain'  (own buffer) │
 │ occupancy : Int32Array [W*H]  ────────┼── .slice() ────────────────────────────────┼─► occupancy'(own buffer) │
 │ hazard    : Uint8Array [W*H]  ────────┼── .slice() ────────────────────────────────┼─► hazard'   (own buffer) │
 │ flags     : Uint8Array [W*H]  ────────┼── .slice() ────────────────────────────────┼─► flags'    (own buffer) │
 └──────────────────────────────────────┘                                             └──────────────────────────┘
        ▲ index(c,r)=r*W+c into every array                                             no shared references:
        │                                                                               mutating copy never
   queries read cell; mutations (via Combat only) write cell                            touches the live board
```

### Key Interfaces

Public signatures are unchanged from `cross-system-contracts.md` §2 / `architecture.md`
§6 — only the internal layout is specified here.

> **⚠️ Amended 2026-07-28 during implementation — `occupancy` cannot be an
> `Int32Array`.** This block originally specified `occupancy: UnitId as a positive
> int; EMPTY = -1 sentinel (Int32)`. **ADR-0008, accepted later, ratifies
> `type UnitId = string`** (its line 221). A string cannot be stored in an
> `Int32Array`, so the two Accepted ADRs directly contradicted each other and the
> conflict was only discovered when Board & Grid was actually built.
>
> **Resolution:** `terrain` and `flags` stay `Uint8Array` — they are Board-owned
> closed enums, exactly as illustrated. `occupancy` and `hazard` are plain
> `(string | null)[]`. Everything this ADR actually decides is preserved: still flat
> parallel arrays, still one shared `idx(c,r) = r*W + c`, still a cheap `.slice()`
> snapshot (measured well under the 1 ms budget at ≤144 cells), still no per-tile
> objects. This ADR's own §6 sanctions it — internal layout may change behind the
> fixed public interface. The snippet below is corrected to match what shipped.

```typescript
// Field enumerations stored as small integers where the domain is a closed
// Board-owned enum (deterministic, compact):
//   terrain  : 0 Normal | 1 Blocked | 2 Chasm(Lethal) | 3 Water(Lethal) ... (Uint8)
//   hazard   : HazardType | null                              (plain array — see below)
//   occupancy: UnitId (string) | null                         (plain array — ADR-0008)
//   flags    : bitfield  0b001 spawn-point | 0b010 objective | 0b100 deploy-zone (Uint8)

class BoardImpl implements Board {
  readonly W: number;
  readonly H: number;
  private terrain:   Uint8Array;          // length W*H
  private occupancy: (UnitId | null)[];   // length W*H, null = empty (ADR-0008: UnitId is a string)
  private hazard:    (HazardType | null)[]; // length W*H, null = none
  private flags:     Uint8Array;   // length W*H, bitfield

  private idx(c: number, r: number): number { return r * this.W + c; }   // the ONE index fn

  // Queries read a single cell — O(1), no allocation on the hot path:
  isOccupied(t: Tile): boolean { return this.occupancy[this.idx(t.col, t.row)] !== -1; }
  isBlocked(t: Tile): boolean  { return this.terrain[this.idx(t.col, t.row)] === TERRAIN.Blocked; }
  // getHazard, hasFlag, classify, getOccupant … all index the same way.

  // snapshot: bulk copy of each backing array — the whole cost of a snapshot.
  snapshot(): Board {
    const s = new BoardImpl(this.W, this.H);
    s.terrain   = this.terrain.slice();     // memcpy, new buffer
    s.occupancy = this.occupancy.slice();
    s.hazard    = this.hazard.slice();
    s.flags     = this.flags.slice();
    return s;                                // fully independent; no shared refs
  }

  // Mutations — invoked ONLY via Combat.resolve() (P2). Each writes one cell.
  place(t: Tile, u: UnitId): Result { /* write occupancy[idx] = u, or Result reject */ }
  clear(t: Tile): void               { this.occupancy[this.idx(t.col, t.row)] = -1; }
  setTerrain(t: Tile, terrain: TerrainType): Result { /* write terrain[idx] */ }
  setHazard(t: Tile, h: HazardType | null): void    { /* write hazard[idx] */ }
  setFlag(t: Tile, flag: TileFlag): void            { /* flags[idx] |= bit(flag) */ }
}
```

### Implementation Guidelines

- **One index function.** `index(c, r) = r * W + c` is defined once and used by every
  query and mutation. Never duplicate the arithmetic inline — a second, subtly
  different index is a determinism/correctness hazard.
- **Encode fields as small integers**, not strings: terrain/hazard as `Uint8` enums,
  flags as a `Uint8` bitfield, occupancy as `Int32` unit id with `-1` for empty. This
  keeps each backing array a single contiguous `ArrayBuffer` that copies as one block.
- **Materialize tile objects only at the boundary.** `getTile(c, r)` may return a
  read-only `{ col, row, terrain, hazard, flags, occupant }` view for consumers, but
  the board must never *store* an array of such objects — that would re-introduce the
  object-graph clone this ADR exists to avoid.
- **`snapshot()` copies arrays, nothing else.** Do not deep-walk, do not
  `structuredClone`, do not JSON round-trip. `slice()` on each typed array is the copy.
- **No shared references escape.** Queries return primitives or fresh small value
  objects; never hand a caller a reference into a backing array. This preserves P2
  (single mutation path) and the snapshot-independence acceptance test.
- **Hazard extensibility.** If hazards later need per-tile duration/metadata, add a
  parallel array (e.g. `hazardDuration: Uint8Array`) rather than nesting objects — the
  parallel-array discipline and the cheap-snapshot property must be preserved.
- **Benchmark first (tester check).** Per `board-and-grid.md`, benchmark `snapshot()`
  in a tight headless loop (1000 iters, no rendering) and report avg ms/call before
  building dependent systems.

## Alternatives Considered

### Alternative 1: Object-graph tile model (array/matrix of `Tile` objects)

- **Description**: Store the board as `Tile[][]` (or `Tile[]`), each `Tile` a plain
  object `{ terrain, hazard, flags, occupant }`. `snapshot()` deep-clones the graph
  (recursive copy or `structuredClone`).
- **Pros**: Most natural OO expression; a tile is a first-class object; easy to read.
- **Cons**: `snapshot()` allocates up to 144 objects (plus nested field objects) per
  call — hundreds of short-lived allocations **per hover** in Move Preview, driving GC
  churn and jeopardizing the < 1 ms budget. `structuredClone` of an object graph is
  markedly slower than a `memcpy` and its cost is object-count-bound, not byte-bound.
- **Estimated Effort**: Similar authoring effort to the chosen approach.
- **Rejection Reason**: Directly threatens the one budget this decision must protect.
  The highest-frequency op would be the slowest and the most GC-hostile.

### Alternative 2: Delta / command-pattern undo (no full snapshot)

- **Description**: Instead of copying the board, record each mutation as a reversible
  command and undo by replaying inverses. Avoids full-board copies for undo.
- **Pros**: Minimal per-action memory; no bulk copy for the undo path.
- **Cons**: Does **not** serve Move Preview at all — preview needs a *fully
  independent* board to dry-run `Combat.resolve()` against, which a command log does
  not provide, so a separate copy mechanism would still be required (two mechanisms to
  keep in sync). It also contradicts the contract: undo is defined as the Turn Manager
  **adopting a prior `snapshot()` as the live board**, with *no* board-owned
  `restore()` (`cross-system-contracts.md` §2, §3; `architecture.md` A7). Inverse
  commands for chained consequences (collisions, on-death `spawnUnit`) are error-prone
  and a determinism risk.
- **Estimated Effort**: Higher — must author and test an inverse for every primitive.
- **Rejection Reason**: `turn-and-phase-manager.md` F3 shows full-board snapshots are
  cheap at this scale (~74 KB peak/phase) and explicitly concludes a delta/command
  scheme is **not warranted**. It also fails to cover Move Preview and violates the
  snapshot-adoption contract.

### Alternative 3: Copy-on-write / persistent immutable structure

- **Description**: Model the board as an immutable persistent data structure; snapshots
  share unchanged nodes and copy only on write.
- **Pros**: Cheap snapshots via structural sharing; theoretically elegant.
- **Cons**: Adds indirection (tree/trie node traversal) to every O(1) query, taxing the
  < 0.01 ms/call query budget that runs dozens of times per frame; substantial
  implementation and mental-model complexity; introduces reference-sharing subtleties
  that complicate reasoning about the single-mutation-path invariant.
- **Estimated Effort**: Significantly higher.
- **Rejection Reason**: Over-engineered for a `≤ 144`-tile board where a flat
  `memcpy` is already sub-millisecond. It trades a hot-path query cost and real
  complexity for a snapshot win we do not need. (Decision Framework: Simplicity.)

### Alternative 4: Single interleaved array-of-structs (one typed array)

- **Description**: One typed array where each tile occupies N contiguous slots
  (terrain, hazard, flags, occupant interleaved), snapshot via one `slice()`.
- **Pros**: A single array to copy; also cheap snapshot.
- **Cons**: Fields have different natural widths (occupancy needs `Int32`, the rest
  fit `Uint8`), so interleaving forces a lowest-common-denominator element type
  (wasting space) or manual byte packing (`DataView`, error-prone, less readable).
  Field-typed parallel arrays read more clearly and let each field pick its own width.
- **Estimated Effort**: Similar, slightly fiddlier.
- **Rejection Reason**: Parallel arrays give the same cheap-copy property with clearer,
  correctly-typed per-field storage and no byte-packing complexity. (Maintainability.)

## Consequences

### Positive

- `snapshot()` becomes a handful of typed-array `slice()` calls — a bulk `memcpy` that
  is sub-millisecond for `≤ 12 × 12` and allocation-light (no per-tile objects, minimal
  GC pressure). Directly satisfies the Move Preview per-hover and Turn Manager
  per-action budgets.
- O(1) queries are index-into-array reads — trivially inside the < 0.01 ms/call budget.
- Snapshot independence (no shared references) is structural: each copy owns its own
  `ArrayBuffer`s, so mutating a copy provably cannot touch the live board (satisfies the
  acceptance test).
- Fully deterministic and headless-testable (P1, P3): fixed-length integer arrays with
  no identity, no clock, no renderer dependency.
- Compact memory: four small typed arrays per board; the undo stack's ~74 KB/phase
  estimate holds comfortably.

### Negative

- The natural "a tile is an object" mental model is not the storage model — contributors
  must think in parallel arrays + an index function. Mitigated by materializing a
  read-only `TileState` view at `getTile` and documenting the one index function.
- Adding a new per-tile field means adding a new parallel array and copying it in
  `snapshot()` — a small, mechanical, easy-to-forget step. Mitigated by keeping all
  array copies in one `snapshot()` body and a test asserting snapshot independence for
  every field.
- Enum/bitfield encoding trades a little readability at the storage layer for speed;
  named constants (`TERRAIN`, `HAZARD`, flag bits) are required to keep it legible.

### Neutral

- Board dimensions `W`, `H` are fixed at construction; the arrays are allocated once.
- The public Board API in `cross-system-contracts.md` §2 is unchanged — this is a
  purely internal representation decision behind a stable interface.

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| A duplicated/inconsistent index calc introduces an off-by-one or transposition bug | Low | High | Single private `idx()` method used everywhere; unit tests for round-trip `index`↔`(c,r)` and boundary tiles |
| A future per-tile field is added but not copied in `snapshot()` | Medium | Medium | All array copies live in one `snapshot()` body; a snapshot-independence test iterates every field |
| A query leaks a mutable reference into a backing array, breaking the single-mutation-path invariant | Low | High | Queries return primitives or fresh value objects only; code review guardrail; no method returns a typed array |
| Multi-tile units (Open Q7) later need set-based occupancy | Low (v1) | Medium | Deferred by design; occupancy array can extend to per-tile unit-id sets or a secondary structure without changing the snapshot strategy |

## Performance Implications

| Metric | Before | Expected After | Budget |
|--------|--------|---------------|--------|
| CPU — `snapshot()` (≤ 12×12) | ~2–5 ms (object-graph clone / `structuredClone`, GC-heavy) | < 1 ms (bulk typed-array `memcpy`) | < 1 ms/call |
| CPU — O(1) query | n/a | avg < 0.01 ms (array index read) | < 0.01 ms/call |
| CPU — board cost/frame during active Move Preview | at risk of > 2 ms | < 2 ms | < 2 ms (≥ 14 ms left for render+logic) |
| Memory — one board | n/a | ~1–2 KB (four typed arrays, ≤ 144 cells) | — |
| Memory — undo stack/phase | n/a | ~74 KB peak (per `turn-and-phase-manager.md` F3) | modest, single-phase-bounded |
| Load Time | n/a | negligible (arrays allocated at battle construct) | — |
| Network | n/a | n/a (single-player, fully local) | n/a |

## Migration Plan

No existing implementation to migrate — this is the first architecture artifact and
Board & Grid has not been built.

1. Implement `BoardImpl` with the four parallel typed arrays and the single `idx()`.
2. Implement queries and mutations against the arrays; keep mutations private to the
   Combat call path (P2).
3. Implement `snapshot()` as per-array `slice()`.
4. Benchmark `snapshot()` headless (1000 iters) — confirm avg < 1 ms/call.
5. Build Move Preview and Turn Manager undo against the verified snapshot.

**Rollback plan**: The representation sits entirely behind the fixed Board interface
(`cross-system-contracts.md` §2). If typed arrays prove insufficient (e.g. a
requirement forces rich per-tile objects), a different internal layout can replace it
without changing any consumer, since no caller depends on the internal storage — only
on the public query/mutation/`snapshot()` signatures.

## Validation Criteria

- [ ] `snapshot()` benchmarks at avg < 1 ms/call over 1000 headless iterations on a
      `12 × 12` board.
- [ ] Mutating a snapshot leaves the live board byte-identical (independence test,
      every field: terrain, occupancy, hazard, flags).
- [ ] All O(1) queries benchmark avg < 0.01 ms/call.
- [ ] Board cost per frame during active Move Preview measures < 2 ms.
- [ ] Two snapshots of the same state are byte-identical (determinism).
- [ ] No query returns a reference into a backing array (review + test).

## GDD Requirements Addressed

| GDD Document | System | Requirement | How This ADR Satisfies It |
|-------------|--------|-------------|--------------------------|
| `design/gdd/board-and-grid.md` | Board & Grid | Open Q2: "Tile-state representation & `snapshot()` strategy" — must deep-copy `≤ 12×12` in < 1 ms | Adopts the proposed flat parallel typed-array layout; `snapshot()` becomes a bulk `memcpy` that meets the < 1 ms budget |
| `design/gdd/board-and-grid.md` | Board & Grid | Performance Budget: `snapshot()` full deep-copy (≤ 12×12) **< 1 ms/call**; single O(1) query avg < 0.01 ms; board cost/frame < 2 ms | Typed-array `slice()` copies + index-into-array reads meet all three budgets |
| `design/gdd/board-and-grid.md` | Board & Grid | Snapshot acceptance test: mutating the copy must leave the live board unchanged (deep copy, no shared refs) | Each snapshot owns fresh `ArrayBuffer`s per field — no shared references by construction |
| `design/gdd/move-preview.md` | Move Preview | F1: `t_snapshot < 1 ms` inside `t_preview ≤ 5 ms`; snapshot taken on every hover to dry-run `resolve(snapshot, effects)` | Cheap snapshot keeps per-hover preview within the latency budget; preview reuses one simulation over an independent copy |
| `design/gdd/turn-and-phase-manager.md` | Turn & Phase Manager | Rule 4 / F2 / F3: capture a snapshot at Player-Phase start and after each action's full chain; undo by adopting a prior snapshot; memory modest | Per-action full-board snapshots are cheap (bulk copy, ~74 KB/phase); confirms delta/command undo is unnecessary |
| `design/architecture/cross-system-contracts.md` | Cross-system (contract) | §2: Board owns cheap `snapshot()`; undo = caller adopting a prior snapshot, no board-owned `restore()`; deterministic, no in-battle RNG | Representation makes `snapshot()` cheap and byte-deterministic while leaving the fixed public Board API unchanged; the contract is preserved verbatim |

## Related

- `docs/architecture/architecture.md` §8 — Required ADR **A1** (this document).
- Enables ADR **A6** (Combat `resolve()` single mutation path) and **A7**
  (snapshot-based undo & preview reuse one simulation).
- `design/architecture/cross-system-contracts.md` §2 (canonical Board contract), §3
  (Turn Manager undo/snapshot), §7 (Move Preview dry-run).
- Board & Grid Open Q1 (rejected-mutation error contract) is decided separately in
  ADR **A5**, not here.
- Code (once implemented): `src/core/board/` (Board & Grid), consumers in Move Preview
  and Turn & Phase Manager.
