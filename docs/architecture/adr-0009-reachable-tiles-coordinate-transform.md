# ADR-0009: Shared reachableTiles/BFS + coordinate-transform ownership (C3)

## Status

Accepted

## Date

2026-07-28

## Last Verified

2026-07-28

## Decision Makers

Technical Director (owner); reconciled with Board & Grid, Heroes & Abilities,
Enemy Abilities & Telegraph, Input & Selection, Board Rendering & Juice, and Move
Preview via `design/architecture/cross-system-contracts.md` (canonical).

## Summary

Resolves cross-system contract **C3** by fixing two single-owner boundaries:
Board & Grid owns the **one** bounded flood-fill `reachableTiles(origin, range,
board)` — consumed identically by Heroes' `legalMoveTiles` and Enemy
movement-to-range, with no second BFS permitted anywhere — and a **single**
screen↔tile coordinate-transform module (`screenToTile` / `tileToScreenCenter`)
is owned at the Input/Rendering boundary rather than duplicated. Both are
deterministic and RNG-free, satisfying Pillars #1 (Perfect Information/Blame) and
#5 (Read in Ten Seconds).

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | None — pure-web stack: TypeScript (strict) + PixiJS (2D WebGL) + Vite |
| **Domain** | Navigation / Core (spatial query) + Input (coordinate mapping) |
| **Knowledge Risk** | LOW |
| **References Consulted** | `design/architecture/cross-system-contracts.md` §2, §7; `docs/architecture/architecture.md` §4, §6, §8 (A9) |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | None (engine-API-wise) |

> **Not applicable / low risk.** VANGUARD is a pure-web build (TypeScript +
> PixiJS + Vite) with **no native engine** — there is no Godot/Unity/Unreal API
> surface and no post-cutoff engine version gap to manage. The Godot
> engine-reference in `docs/engine-reference/` **does not apply** to this build
> and is intentionally not consulted. TypeScript, PixiJS, and Vite are stable and
> well within the model's training knowledge. This ADR therefore carries no
> engine-compatibility risk; the only technical risk it addresses is *design*
> risk (two systems drifting out of sync), not stack risk.

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (Board tile-state representation & cheap `snapshot()`) — `reachableTiles` and the coordinate transform both read the flat typed-array tile model and must run against a `snapshot()` as cheaply as against the live board. |
| **Enables** | Heroes `legalMoveTiles` (F1), Enemy movement-to-range (F2), Input & Selection targeting/hit-test, Move Preview move-overlay, Board Rendering highlight placement. |
| **Blocks** | Heroes & Abilities movement stories; Enemy movement/telegraph stories; Input & Selection targeting; Move Preview overlay — none may implement a local BFS or a local screen↔tile transform until this ADR is Accepted. |
| **Ordering Note** | Foundation ADR-0001 must be Accepted first (tile representation is the substrate). This ADR should be Accepted before any Core/Feature system that consumes reachability or hit-testing begins implementation. |

## Context

### Problem Statement

Two spatial computations are each needed by more than one system, and each is a
candidate for accidental duplication:

1. **Bounded reachability (movement flood-fill).** Both hero movement
   (`legalMoveTiles`, `heroes-and-abilities.md` F1) and enemy movement-to-range
   (`enemy-abilities-and-telegraph.md` F2) need "the set of tiles reachable from
   an origin within N orthogonal steps, over Clear tiles only." If each system
   hand-writes its own BFS, the two implementations **will drift** — a hero could
   preview a reachable tile that the enemy pathfinder treats as unreachable (or
   vice-versa), and Move Preview (which dry-runs the *real* code) would then
   disagree with what actually resolves. That directly breaks Pillar #1's promise
   that the preview equals the commit.

2. **Screen↔tile coordinate transform.** Input & Selection converts pointer
   pixels to tile coordinates (`screenToTile`, F1) and tile coordinates back to
   canvas centers (`tileToScreenCenter`, F2); Board Rendering & Juice needs the
   *same* transform to place highlights, reticles, and juice exactly where the
   player clicks. If the two systems implement the transform independently, any
   divergence in `tileSize`/`origin`/rounding makes clicks **silently
   misregister** against what the player sees highlighted — a "misfire" that
   destroys Pillar #1's "perfect blame" (a loss must be the player's tactical
   mistake, never a UI mistake).

This is cross-system contract **C3**. It must be decided now because it is a
*structural ownership* question (who owns the one implementation), and deciding
it late means unwinding two or more already-written copies plus the tests that
pinned their divergent behavior.

### Current State

Pre-implementation. The behavior is fully specified in the GDDs but ownership is
only *implicit* in the contracts file:

- `board-and-grid.md` Formula 9 already defines `reachableTiles(origin, range,
  board)` as a BFS over `neighbors`/`classify == Clear`, and explicitly states
  Heroes' `legalMoveTiles` and Enemy movement-to-range "both consume this
  function — no second hand-written BFS anywhere in the codebase."
- `heroes-and-abilities.md` F1 is literally `return board.reachableTiles(origin,
  moveRange, board)` — a thin pass-through, "the same shared implementation Enemy
  movement-to-range consumes."
- `enemy-abilities-and-telegraph.md` F2 is `reachable(O, M) =
  board.reachableTiles(O, M, board)` — "this system does not maintain a second
  BFS."
- `input-and-selection.md` Core Rule 5 and Open Question 1 flag that Formulas 1–2
  (`screenToTile`/`tileToScreenCenter`) "must be implemented identically by Input
  & Selection and Board Rendering & Juice … or clicks will silently misregister,"
  proposing "a single shared coordinate-transform module both systems import, not
  two independent implementations."

The GDDs already *agree*; this ADR promotes that agreement to a binding,
compiler-enforceable ownership decision and bans the alternatives.

### Constraints

- **Determinism (P1).** Both functions must be pure: no RNG, no `Date.now()`, no
  wall-clock, no iteration-order nondeterminism. Same inputs → byte-identical
  output every run and across reloads (required for preview/undo/replay/resume).
- **Layer purity (P3).** `reachableTiles` lives in Foundation (Board & Grid) and
  must run headless in Vitest with no canvas and **no PixiJS import**. The
  coordinate transform, by contrast, is inherently a presentation-boundary
  concern (it consumes pixel geometry) and must **not** be pulled down into the
  simulation core.
- **Snapshot compatibility (ADR-0001).** `reachableTiles` must read the live
  board or a `board.snapshot()` interchangeably, using only pure queries
  (`neighbors`, `classify`) — never a mutation.
- **Performance.** `legalMoveTiles`/reachability budget is `< 0.5 ms/call`
  (`board-and-grid.md`, `heroes-and-abilities.md` perf tables) since it runs on
  hover during Move Preview; the coordinate transform is O(1) and effectively
  free.
- **Contract precedence (P6).** Where any GDD diverges from
  `cross-system-contracts.md`, the contracts file wins; this ADR is written to
  match it.

### Requirements

- Exactly **one** implementation of the bounded movement flood-fill, owned by
  Board & Grid, consumed unchanged by hero movement, enemy movement-to-range, and
  (transitively) Move Preview.
- Exactly **one** screen↔tile transform module, owned at the Input/Rendering
  boundary, imported by both Input & Selection and Board Rendering & Juice.
- Both are deterministic and RNG-free.
- A lint/review guardrail that makes a *second* BFS or a *second* transform a
  detectable violation, not a silent regression.

## Decision

### Part A — One bounded flood-fill, owned by Board & Grid (resolves the BFS half of C3)

**Board & Grid owns the single `reachableTiles(origin, range, board)`** — the
bounded BFS over `Clear` tiles defined in `board-and-grid.md` Formula 9. It:

- expands only through `board.neighbors(tile)` filtered to `board.classify(n) ===
  Clear` (so Blocked/Occupied/Lethal/OutOfBounds tiles are never entered),
- is bounded by `range` BFS depth (orthogonal steps),
- **excludes the origin** from its result (matching the `legalMoveTiles`
  contract),
- reads only pure queries and therefore runs identically against the live board
  or a `snapshot()`,
- is deterministic (frontier processed in a fixed, position-derived order; no RNG,
  no clock).

**Both consumers call it verbatim and add no reachability logic of their own:**

- Heroes & Abilities `legalMoveTiles(origin, moveRange, board) →
  board.reachableTiles(origin, moveRange, board)` (F1, a pass-through).
- Enemy movement-to-range `reachable(O, M) → board.reachableTiles(O, M, board)`
  (F2); the enemy's *destination-selection* policy (which reachable tile to path
  toward) stays in the Enemy system, but the reachable **set** it selects from is
  this one function.

**Any second BFS is forbidden.** No system may hand-roll a movement/reachability
flood-fill. Per-system needs that differ (e.g. enemy "path toward a destination")
are expressed as *policy on top of* the shared reachable set, not a parallel
graph search. (Note: `rayTiles` — the straight-line ability walk, Formula 8 — is a
distinct, already-owned Board query and is **not** a second BFS; the ban is on
duplicating the *flood-fill*.)

### Part B — One screen↔tile transform, owned at the Input/Rendering boundary (resolves the coordinate half of C3)

A **single coordinate-transform module** owns both directions of the screen↔tile
mapping and is imported by both Input & Selection and Board Rendering & Juice —
never re-implemented on either side:

- `screenToTile(px, py, view) → Tile | null` — `input-and-selection.md` Formula 1:
  `(⌊(px − originX)/tileSize⌋, ⌊(py − originY)/tileSize⌋)`, returning `null` when
  the result fails Board's `inBounds`.
- `tileToScreenCenter(col, row, view) → {px, py}` — `input-and-selection.md`
  Formula 2, the exact inverse (to the tile-center offset), used to place the
  keyboard reticle, targeting highlights, and juice anchors.

**Geometry ownership stays split, transform math is shared.** Board Rendering &
Juice remains the authoritative *source* of the view parameters (`tileSize`,
`originX`/`originY`, and any future camera/zoom); the shared module takes those as
an explicit `view` argument and is otherwise pure. Input & Selection does **not**
own pixel geometry — it owns the *contract* and consumes the transform. This keeps
one round-trip-consistent implementation (`screenToTile ∘ tileToScreenCenter` is
identity up to tile-center offset) so a click always resolves to the tile the
player sees highlighted.

**Layer note:** the transform module sits at the presentation/input boundary, not
in the simulation core. It may be consumed by Input & Selection and Board
Rendering, but the Foundation/Core simulation (Board, Combat, Turn Manager) never
imports it — the sim reasons in tile coordinates only (P3 preserved).

### Architecture

```
FOUNDATION
  Board & Grid ── owns ──► reachableTiles(origin, range, board)   [the ONE BFS]
        ▲  ▲                   pure: neighbors + classify==Clear, RNG-free
        │  │                   runs on live board OR snapshot() identically
        │  └───────────────────────────────┐
        │                                   │ (both call it verbatim)
   FEATURE                                  │
   Heroes & Abilities                 Enemy, Abilities & Telegraph
     legalMoveTiles(o,mv,b)             reachable(O,M)
       = board.reachableTiles(o,mv,b)     = board.reachableTiles(O,M,b)
             │  (F1)                            │  (F2)
             └──────────────┬───────────────────┘
                            ▼
                      Move Preview (dry-run) — sees the SAME reachable set
                                          → preview == commit (Pillar #1)

INPUT / PRESENTATION BOUNDARY
  Board Rendering & Juice ── owns ──► view params {tileSize, originX/Y, camera}
             │                                   │
             └────────────► coordinate-transform module ◄──────────┐
                              screenToTile(px,py,view) -> Tile|null │
                              tileToScreenCenter(col,row,view)->px,py│
                                          ▲                          │
                         imports (not re-implements)                imports
                              Input & Selection ────────────────────┘
                       (click hit-test)      (highlight/reticle placement)
   ── simulation core (Board/Combat/Turn) never imports this module (P3) ──
```

### Key Interfaces

```typescript
// ── Part A: the ONE bounded flood-fill (Board & Grid, contracts §2, C3) ─────────
interface Board {
  // ...other pure queries (neighbors, classify, snapshot, ...)
  reachableTiles(origin: Tile, range: number, board: Board): Tile[];
  // Pure BFS over classify(n)==='Clear', bounded by `range`, EXCLUDES origin.
  // Deterministic frontier order; no RNG, no clock. Works on live board or snapshot().
}

// Heroes & Abilities — F1 is a pass-through; NO local BFS.
function legalMoveTiles(origin: Tile, moveRange: number, board: Board): Tile[] {
  return board.reachableTiles(origin, moveRange, board);
}

// Enemy movement-to-range — F2 selects a destination FROM this set; NO local BFS.
function reachable(O: Tile, M: number, board: Board): Tile[] {
  return board.reachableTiles(O, M, board);
}

// ── Part B: the ONE screen<->tile transform (Input/Rendering boundary, C3) ──────
type ViewTransform = {
  originX: number;   // board top-left screen x  (owned/supplied by Board Rendering)
  originY: number;   // board top-left screen y
  tileSize: number;  // uniform square tile edge in px  (> 0)
  // future: camera/zoom fields — added here once, consumed everywhere
};

// Pure, deterministic, no PixiJS import. Imported by BOTH Input & Selection
// and Board Rendering & Juice — never re-implemented on either side.
function screenToTile(px: number, py: number, view: ViewTransform): Tile | null;      // F1
function tileToScreenCenter(col: number, row: number, view: ViewTransform): { px: number; py: number }; // F2
// Contract: for any in-bounds (col,row), screenToTile(tileToScreenCenter(col,row,v).px,
//           ...py, v) === {col,row}  (round-trip identity up to the tile-center offset).
```

### Implementation Guidelines

- **`reachableTiles` lives in the Board module** (Foundation), alongside
  `neighbors`/`classify`/`rayTiles`. It must not import anything from Feature or
  Presentation. Delegate the code-level implementation to `engine-programmer` /
  `lead-programmer` within this pattern.
- **Enemy destination policy is layered on top**, never inside, the shared BFS:
  the Enemy system computes `board.reachableTiles(...)` first, then applies its
  own deterministic tie-break to pick `telegraphedMoveDestination`. Do not fork
  the BFS to "return paths" — if a path is later needed, add a separate,
  explicitly-named path query that itself calls `reachableTiles`, rather than a
  second flood-fill.
- **The transform module is a small, dependency-free TS file** (e.g.
  `src/ui/coordinate-transform.ts` or equivalent under the Input/Rendering
  boundary). It takes `view` as an argument and holds no mutable state, so both
  importers stay in lockstep automatically. `technical-artist` /
  `lead-programmer` own the concrete placement within the approved pattern.
- **Rounding is defined once, here:** `screenToTile` uses `Math.floor` on the
  offset-and-divide (matching Formula 1); `tileToScreenCenter` adds the
  `tileSize/2` center offset (Formula 2). Do not vary rounding between the two
  importers.
- **Guardrail:** add a review/lint check (control-manifest entry) that flags any
  new orthogonal-BFS/flood-fill outside Board & Grid and any pixel↔tile arithmetic
  outside the transform module.

## Alternatives Considered

### Alternative 1: Each system implements its own BFS / its own transform

- **Description**: Heroes and Enemy each hand-write a movement flood-fill sized to
  their own needs; Input and Rendering each compute their own pixel↔tile math.
- **Pros**: No shared-module coupling; each team ships independently; a system can
  micro-optimize for its exact use.
- **Cons**: The two BFS copies **will drift** (subtle differences in
  Clear-classification, origin inclusion, or tie-break order), silently breaking
  the preview==commit guarantee (Pillar #1). The two transforms drifting makes
  clicks misregister against highlights (Pillar #1 "perfect blame"). Divergence is
  invisible until a specific board state exposes it, and by then two test suites
  pin the wrong behavior.
- **Estimated Effort**: Higher long-term (2× code, 2× tests, plus reconciliation
  debugging).
- **Rejection Reason**: Directly violates the game's core promise and P1/P5;
  precisely the failure C3 exists to prevent.

### Alternative 2: A generic pathfinding library / A* with cost fields

- **Description**: Pull in (or build) a general graph-search/A* utility and derive
  both hero and enemy movement from it, plus a matrix-transform library for
  coordinates.
- **Pros**: Handles weighted terrain, larger boards, and future multi-tile units
  "for free"; familiar to engineers.
- **Cons**: Over-engineered for a ≤12×12 uniform-cost orthogonal grid where the
  simple bounded BFS is already `< 0.5 ms`; adds a third-party dependency
  (violates P3's "thin dependency" posture and needs TD approval); a general
  library's iteration order and float cost handling are a determinism risk;
  matrix-transform libs invite non-integer rounding drift.
- **Estimated Effort**: Higher (integration + determinism hardening) for no v1
  benefit.
- **Rejection Reason**: Fails the Simplicity and Determinism criteria; v1 has
  uniform movement cost and a small fixed board, so the specified Formula-9 BFS is
  the correct-sized solution. (Weighted movement is not a v1 requirement; if it
  ever is, it amends Formula 9 in-place, still single-owner.)

### Alternative 3: Board owns the transform too (fold coordinates into Foundation)

- **Description**: Put `screenToTile`/`tileToScreenCenter` inside Board & Grid
  next to `reachableTiles` so there is one spatial home for everything.
- **Pros**: A single "spatial" module; symmetrical with the BFS decision.
- **Cons**: The transform consumes *pixel/canvas* geometry (`tileSize`, screen
  origin, camera) — presentation concerns. Putting it in Foundation drags render
  parameters into the pure simulation core, breaking P3 (the sim must run headless
  with no canvas) and coupling Board to Rendering's view state.
- **Estimated Effort**: Similar.
- **Rejection Reason**: Violates layer purity (P3). Reachability is pure tile
  logic (Foundation); the transform is a presentation-boundary concern
  (Input/Rendering). They are correctly owned in *different* layers — hence two
  parts to this one ADR, not one merged module.

## Consequences

### Positive

- **Preview equals commit.** Because hero movement, enemy movement, and Move
  Preview all read the identical reachable set, the previewed move-range is
  exactly what resolves — the load-bearing Pillar #1 guarantee.
- **Clicks never misregister.** One transform means the tile the player clicks is
  the tile they see highlighted (Pillar #1 "perfect blame," Pillar #5 legibility).
- **Single place to fix/extend.** A reachability rule change (e.g. future weighted
  terrain) or a view change (camera/zoom) is made once and is automatically
  consistent across every consumer.
- **Fully testable headless.** `reachableTiles` is a pure function unit-tested in
  Vitest (Board & Grid acceptance criteria already pin the 24-tile radius-3 case,
  origin exclusion, and full-enclosure `∅`); the transform's round-trip identity
  is a pure unit test too.
- **Determinism preserved** for undo/replay/resume (P1).

### Negative

- **Coupling on shared modules.** Every movement/hit-test consumer now depends on
  two shared units; a breaking change to either signature ripples. Mitigated by
  stable, contract-pinned signatures and the compiler enforcing them.
- **A slight indirection.** Enemy movement can't "just pathfind" — it must select
  from the shared reachable set and layer its policy on top. This is the intended
  constraint, but it is one more hop for implementers to learn.

### Neutral

- Board & Grid gains no new API surface (it already exposes `reachableTiles`); the
  ADR formalizes ownership rather than adding code.
- The transform module's home directory (under Input vs Rendering) is an
  implementation detail left to the lead; the ADR fixes ownership at the boundary,
  not the exact path.

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| A future feature silently adds a second BFS (e.g. an AoE "flood" or an ability range that "feels like" movement) | Medium | High (breaks preview==commit) | Control-manifest guardrail + review check flags any orthogonal flood-fill outside Board & Grid; code review rejects it. |
| Coordinate math duplicated in a one-off render effect (juice) | Medium | Medium (highlight/click drift) | Guardrail flags pixel↔tile arithmetic outside the transform module; effects must import it. |
| Reachability grows a real requirement (weighted terrain / multi-tile units) | Low (v1) | Medium | Amend Formula 9 in-place, single-owner; multi-tile units are an explicitly deferred Open Question (architecture.md §10.1) that would revisit this ADR. |
| Determinism regression from a `Set`/iteration-order change in the BFS frontier | Low | High | Frontier order is position-derived and fixed; determinism smoke test (≥100 identical runs) already in Board acceptance criteria. |

## Performance Implications

| Metric | Before | Expected After | Budget |
|--------|--------|---------------|--------|
| CPU — `reachableTiles`/`legalMoveTiles` (moveRange ≤ 5, board ≤ 12×12) | n/a (new) | < 0.5 ms/call | < 0.5 ms/call |
| CPU — `screenToTile`/`tileToScreenCenter` | n/a (new) | O(1), < 0.01 ms/call | < 0.01 ms/call |
| CPU — combined board cost per frame during active Move Preview | n/a | < 2 ms | < 2 ms (leaves ≥ 14 ms for PixiJS render in a 16.6 ms frame) |
| Memory | n/a | Negligible (BFS visited-set bounded by the Manhattan disk ≤ ~2R²+2R tiles) | within board budget |
| Load Time | n/a | No impact | n/a |
| Network | n/a | Not applicable (single-player, fully local) | n/a |

Sharing one implementation is strictly *cheaper* than duplicating it: no second
code path to warm, and Move Preview reuses the same call rather than a parallel
recompute.

## Migration Plan

Greenfield — no existing implementation to migrate. Sequencing:

1. Confirm ADR-0001 (tile representation & `snapshot()`) is Accepted — the BFS and
   transform both build on it. Verify: ADR-0001 status is `Accepted`.
2. Implement `reachableTiles` in Board & Grid per Formula 9; land its unit tests
   (radius-3 = 24 tiles, origin excluded, full-enclosure `∅`, every result
   `Clear` and within `range`). Verify: Board acceptance criteria pass headless.
3. Wire Heroes `legalMoveTiles` (F1) and Enemy movement-to-range (F2) as
   pass-throughs to `reachableTiles`. Verify: their tests assert *equality* with
   `board.reachableTiles(...)`, not a re-derived set.
4. Implement the shared coordinate-transform module; import it from both Input &
   Selection and Board Rendering & Juice. Verify: round-trip identity test +
   `screenToTile` off-board → `null`.
5. Add the control-manifest guardrail (no second BFS / no stray pixel↔tile math).

**Rollback plan**: If the shared-module approach ever proves wrong (it should
not — it only formalizes existing GDD agreement), the fallback is *not* to
duplicate, but to re-home the single implementation to a different owner. There is
never a state where two copies are the correct answer; rollback means moving the
one implementation, not forking it.

## Validation Criteria

- [ ] Exactly one orthogonal movement flood-fill exists in the codebase, in Board
      & Grid; a repo-wide search finds no second BFS.
- [ ] `legalMoveTiles` (F1) and enemy `reachable` (F2) each return a set
      *equal* to `board.reachableTiles(...)` for the same inputs (asserted in
      tests), including the radius-3 = 24-tile and full-enclosure `∅` cases.
- [ ] Move Preview's previewed move-range matches the committed move-range for the
      same board state (preview == commit).
- [ ] Exactly one screen↔tile transform module exists; both Input & Selection and
      Board Rendering & Juice import it (no duplicated pixel↔tile arithmetic).
- [ ] Round-trip identity: `screenToTile(tileToScreenCenter(c,r,view), view) ===
      {c,r}` for every in-bounds tile; off-board pixels → `null`.
- [ ] `reachableTiles` runs `< 0.5 ms/call` and the transform `< 0.01 ms/call` in
      headless benchmarks; combined active-preview board cost `< 2 ms/frame`.
- [ ] Determinism: identical inputs → byte-identical reachable sets across ≥100
      runs and across reloads (no RNG, no clock).

## GDD Requirements Addressed

| GDD Document | System | Requirement | How This ADR Satisfies It |
|-------------|--------|-------------|--------------------------|
| `design/gdd/board-and-grid.md` | Board & Grid | Formula 9: Board owns "the single canonical bounded flood-fill … no second hand-written BFS anywhere in the codebase" (resolves C3) | Fixes `reachableTiles` ownership in Board & Grid (Foundation), pure over `classify==Clear`, RNG-free, snapshot-safe; bans any second BFS via a control-manifest guardrail. |
| `design/gdd/heroes-and-abilities.md` | Heroes & Abilities | F1 `legalMoveTiles(origin, moveRange, board) = board.reachableTiles(...)` — "the same shared implementation Enemy movement-to-range consumes" | Mandates F1 remain a pass-through to the shared BFS; validation asserts equality with `board.reachableTiles`, not a re-implementation. |
| `design/gdd/enemy-abilities-and-telegraph.md` | Enemy, Abilities & Telegraph | F2 movement-to-range `reachable(O,M) = board.reachableTiles(O,M,board)` — "this system does not maintain a second BFS" | Enemy destination policy layers on top of the shared reachable set; the reachable set itself is the one Board BFS. |
| `design/gdd/input-and-selection.md` | Input & Selection | Core Rule 5 + Open Question 1: `screenToTile`/`tileToScreenCenter` (Formulas 1–2) "must be implemented identically … a single shared coordinate-transform module both systems import, not two independent implementations" | Establishes the one transform module at the Input/Rendering boundary, imported by both Input & Selection and Board Rendering & Juice; pins rounding and round-trip identity so clicks match highlights. |
| `design/gdd/move-preview.md` | Move Preview | Preview must equal the committed action (Pillar #1) — it dry-runs the *real* movement/targeting queries | By forcing hero and enemy movement through the identical `reachableTiles`, the dry-run sees the same reachable set that resolution uses → preview == commit. |
| `design/gdd/board-rendering-and-juice.md` | Board Rendering & Juice | Owns view geometry (`tileSize`, screen origin, camera) and must place highlights/reticles where clicks land | Rendering supplies `view` params to the shared transform and imports the same `tileToScreenCenter`; no duplicated coordinate math, so highlight placement and click hit-test cannot drift. |

Pillars served: **#1 Perfect Information, Perfect Blame** (preview == commit;
clicks match highlights) and **#5 Read in Ten Seconds** (one legible, consistent
spatial model). Both computations are deterministic with no in-battle RNG (P1).

## Related

- **Depends on** ADR-0001 (Board tile-state representation & cheap `snapshot()`).
- Resolves cross-system contract **C3** (`design/architecture/cross-system-contracts.md`
  §2; `docs/architecture/architecture.md` §8 item **A9**).
- Sibling C-resolution ADRs: A8/ADR-0008 (Shared `Unit` record, C2), A10 (Difficulty/tier
  chain, C1), A11 (Environmental telegraph, C4).
- Related code (once implemented): Board & Grid `reachableTiles`; the
  Input/Rendering coordinate-transform module; Heroes F1; Enemy F2.
