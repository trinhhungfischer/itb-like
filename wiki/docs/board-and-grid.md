# Board & Grid

> **Status**: In Design
> **Author**: user + Claude (design-system)
> **Last Updated**: 2026-07-27
> **Implements Pillar**: #2 Positioning Over Power, #5 Read in Ten Seconds

## Overview

Board & Grid is the spatial foundation of every VANGUARD battle: a finite
rectangular grid of square tiles (default 8×8) that stores **where everything is**
— units, terrain, hazards, spawn points, and objectives — and defines the **rules
of space** every other system reads: which tiles are adjacent, how far apart two
tiles are, whether a tile is occupied or blocked, and where the grid's edge lies.
Players never manipulate the grid as a "system"; they experience it as the literal
board they read at a glance and reason about when planning a move. It exists because
VANGUARD wins are made of **position, not damage** (Pillar #2): without a precise,
legible, deterministic model of tiles, adjacency, occupancy, and edges, there is no
space to manipulate and no puzzle to solve. The system is **intentionally minimal**
— it owns *spatial facts and queries only*; it does **not** resolve pushes, damage,
or hazard effects (that is Combat Resolution's responsibility).

## Player Fantasy

Board & Grid has no direct player fantasy — it is infrastructure. What players
*feel* is everything it makes possible: the **quiet confidence that the board is
fair and knowable**. Every tile is exactly one step, every distance countable on
fingers, every position unambiguous. This is the substrate of the game's core
feeling — *"I can see the whole situation, and I am the one who solves it"*
(Pillar #1 Perfect Information, Pillar #5 Read in Ten Seconds). When the grid does
its job, the player never thinks about it — they think about the puzzle sitting on
top of it. The failure state of this system is when a player is *surprised by
geometry* — "wait, I thought that tile was in range" — which would break the very
trust the whole game is built on.

## Detailed Design

### Core Rules

1. The board is a **finite rectangular grid of W×H square tiles**. Default **8×8**
   (matches Into the Breach). W and H are tuning knobs.
2. **Coordinates**: each tile is addressed by integer `(col, row)`, origin `(0,0)`
   at top-left; `col` increases rightward (`0..W-1`), `row` increases downward
   (`0..H-1`).
3. **Adjacency is 4-directional** (orthogonal / von Neumann): N `(0,-1)`, S `(0,+1)`,
   W `(-1,0)`, E `(+1,0)`. Diagonals are NOT adjacent for movement or push. Abilities
   may *target* any tile, but **movement steps and push/pull directions are always
   orthogonal** — this keeps the board legible (Pillar #5) and matches ITB.
4. **Distance** uses the **Manhattan metric**: `dist = |Δcol| + |Δrow|`. Movement
   range and most range checks use this.
5. **Occupancy**: each tile holds **at most one unit**; all units occupy exactly one
   tile (unit size = 1 in v1). The board enforces this one-occupant invariant; any
   operation that would place two units on a tile is **rejected and reported** to the
   caller (Combat Resolution decides the consequence, e.g. a collision).
6. Each tile has a **terrain type** (see States table) governing passability and
   lethality. **Blocked** terrain cannot be entered or moved through. **Lethal**
   terrain (chasm/water) removes any unit that enters it — the board *flags* the
   entry; Combat/Objective performs the actual removal.
7. Each tile can carry a **hazard overlay** (fire, smoke, …) as opaque state. The
   board **stores** hazard state but does not define or apply hazard effects — Combat
   Resolution / Enemy own hazard semantics.
8. The grid **boundary (edge) is impassable**, like blocked terrain: a unit cannot
   move or be pushed off the board. A push toward the edge **leaves the unit in place
   and reports an edge collision** to the caller.
9. Certain tiles carry **flags**: `spawn-point` (enemies emerge here), `objective`
   (must be protected/reached), and `deploy-zone` (where heroes may be placed at
   battle start). Flags are set by the Encounter Generator / Objective system; the
   board only stores and exposes them via `hasFlag`/`getTile`.
10. The board exposes a **pure read-only query API** plus a small set of deterministic,
    synchronous **mutation operations** (set occupancy, terrain, hazard, flag). The
    board holds **no randomness** and no time-dependence.

### States and Transitions

**Terrain states** (per tile):

| Terrain | Passable? | Blocks push? | Lethal on enter? | Destructible? | Notes |
|---------|-----------|--------------|------------------|---------------|-------|
| **Normal** | Yes | No | No | — | Default walkable tile |
| **Blocked** (wall/rock) | No | Yes | No | Optional | Impassable; if destructible, destroy → becomes Normal (rubble) |
| **Chasm / Pit** | No (entry removes unit) | No | Yes | No | Unit moved/pushed in is removed (fall) |
| **Water** | Yes* | No | Yes* | No | v1: behaves like Chasm (unit removed). `water_lethal` knob can make it non-lethal later |

**Occupancy states** (per tile): `Empty ↔ Occupied(unitId)`.
- `place(unitId)`: Empty → Occupied (rejected if already Occupied).
- `clear()`: Occupied → Empty.
- A unit move is `clear(from)` + `place(to)` performed **atomically by the caller**
  (Combat Resolution), never leaving the board in a two-occupant state.

**Hazard states** (per tile): `None ↔ Hazard(type)` — set/cleared by Combat/Enemy;
the board stores only.

**Destructible terrain transition**: `Blocked(destructible) --destroy()--> Normal`.
Chasm is permanent (no transition back).

### Interactions with Other Systems

Board & Grid is a **provider**: it owns the spatial model; other systems query it and
request mutations through Combat Resolution.

| System | Reads from Board | Writes to Board | Notes |
|--------|------------------|-----------------|-------|
| **Combat Resolution** | occupancy, terrain, `isBlocked`, `inBounds`, `neighbors`, `distance` | occupancy (move/push/removal), terrain (destroy), hazard state | Board owns *queries*; Combat owns *when* to mutate |
| **Heroes & Abilities** | `tilesInRange`, `neighbors`, `distance`, `isOccupied`, `getOccupant`, terrain | — (mutations requested via Combat) | Query-only consumer |
| **Enemy, Abilities & Telegraph** | same queries as abilities; `spawn-point` flags | — | Query-only consumer |
| **Move Preview** | ALL queries — run against a **cloned snapshot**, never the live board | — (operates on a copy) | Board must support cheap deep-copy/snapshot |
| **Board Rendering & Juice** | full tile grid: terrain, hazard, occupancy, flags | — | Query-only consumer |
| **Input & Selection** | screen↔tile coordinate mapping, `inBounds`, `getOccupant` | — | Rendering provides pixel geometry; Board provides logical coords |
| **Encounter Generator** | `inBounds`, terrain templates | initial terrain layout, `spawn-point`, `objective` & `deploy-zone` flags (at battle setup) | Generator writes initial state; Board validates invariants |
| **Objective / Win-Lose** | `objective` flags, occupancy of objective tiles | `objective` flags | Reads board to evaluate win/lose |
| **Turn & Phase Manager** | `snapshot()` — Player-Phase-start checkpoint and one per committed action | — (adopts a previously captured snapshot as the new live board on undo; there is no board-owned `restore()` mutation) | Board only provides `snapshot()`; Turn & Phase Manager owns the undo stack and the adoption logic |

**Canonical API** (queries + mutations — supersedes any earlier partial list here;
matches `design/architecture/cross-system-contracts.md` §2, the authoritative
source):

- **Queries (pure):** `inBounds(col,row)`, `getTile(col,row)`, `isOccupied(col,row)`,
  `getOccupant(col,row)`, `isBlocked(col,row)`, `getHazard(col,row)`,
  `hasFlag(col,row, flag)`, `neighbors(col,row)` (orthogonal, in-bounds),
  `distance(a,b)` (Manhattan), `tilesInRange(origin, R)`, `step(tile, dir)` (one
  orthogonal step — may return out-of-bounds), `classify(tile)` (push-destination
  descriptor: OutOfBounds / BlockedTerrain / Lethal / Occupied / Clear),
  `rayTiles(origin, dir, maxLen)` (line-of-tiles in a cardinal direction until
  Blocked/edge/`maxLen` — Formula 8), `reachableTiles(origin, range, board)` (the
  single canonical bounded flood-fill, resolving cross-system contract C3 — Formula
  9), `snapshot()` (deep copy for Move Preview / undo). None of these mutate state.
- **Mutations (deterministic, invoked only via Combat Resolution):** `place(tile,
  unitId)`, `clear(tile)`, `setTerrain(tile, terrainType)`, `setHazard(tile, type)`,
  `setFlag(tile, flag)`.

**Critical constraint → becomes an ADR**: the board must support a **cheap immutable
snapshot / deep-copy** so Move Preview can simulate a whole turn against a copy
without mutating live state. This is what makes Pillar #1 (Perfect Information via
preview) implementable, and it constrains how tile state is represented. *(Record in
`/architecture-decision` — state representation & snapshot strategy.)*

**Runtime terrain mutation (hero-built walls):** tile terrain is not fixed for the
battle — it can be changed at runtime through Combat Resolution's `setTerrain(tile,
terrainType)` primitive, which delegates to the board's `setTerrain` mutation and
**generalizes the board's internal `destroy()`** (destroy is just
`setTerrain(tile, Normal)` on a destructible Blocked tile). Because `classify()`
already ranks `Blocked` terrain as push-/movement-blocking (Formula 7), a hero verb
that raises a wall via `setTerrain(tile, Blocked)` — and later tears it down via
`setTerrain(tile, Normal)` — is fully supported with no change to the board's query
model: every existing range, push, and move check reads the mutated terrain
automatically. The board still enforces its invariants (e.g. it must not set an
occupied tile to a terrain a unit cannot stand on); Combat Resolution owns *when* and
*why* to mutate, the board owns the terrain state itself.

> **Cross-system reconciliation note:** Combat Resolution, Move Preview, Heroes &
> Abilities, Enemy, Abilities & Telegraph, Encounter Generator, and Objective /
> Win-Lose are all **Designed** (see `design/gdd/systems-index.md`). The interfaces
> above are reconciled against `design/architecture/cross-system-contracts.md`
> (canonical) and each dependent's own GDD; where a dependent's Detailed Rules
> diverge from `cross-system-contracts.md`, the contracts file wins.

## Formulas

All are deterministic spatial functions (no RNG, no time-dependence). Examples use
the default **8×8** board.

### 1. In-bounds test
`inBounds(c, r) = (0 ≤ c < W) ∧ (0 ≤ r < H)`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| column | c | int | any input | Column tested |
| row | r | int | any input | Row tested |
| width | W | int | ≥1 (def 8) | Board width (knob) |
| height | H | int | ≥1 (def 8) | Board height (knob) |

**Output:** bool. **Example:** `inBounds(7,7)=true`, `inBounds(8,3)=false`.

### 2. Manhattan distance
`distance(a, b) = |a.col − b.col| + |a.row − b.row|`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| tile A | a | coord | valid tile | First tile |
| tile B | b | coord | valid tile | Second tile |

**Output:** int `[0, W+H−2]` → `[0,14]` on 8×8. **Example:** `(1,1)→(4,5) = 3+4 = 7`.

### 3. Orthogonal neighbors (in-bounds)
`neighbors(c, r) = { (c+dc, r+dr) : (dc,dr) ∈ {(0,−1),(0,1),(−1,0),(1,0)} } ∩ inBounds`

**Output:** set of 2–4 coords (corner=2, edge=3, interior=4). **Example:**
`neighbors(0,0) = {(1,0),(0,1)}`; `neighbors(3,3) = {(3,2),(3,4),(2,3),(4,3)}`.

### 4. Tiles in range (Manhattan disk)
For each row offset `dr ∈ [−R, R]`, the column span is `[o.col−(R−|dr|), o.col+(R−|dr|)]`;
clip each span to the board.
`tilesInRange(o, R) = { t : inBounds(t) ∧ distance(o, t) ≤ R }`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| origin | o | coord | valid tile | Center (unit/ability source) |
| range | R | int | ≥0 | Manhattan radius |

**Output:** set of 1 to `min(2R²+2R+1, W·H)` tiles (unclipped diamond = `2R²+2R+1`,
a useful sanity bound). **Example:** interior `o=(3,3), R=2` → 13 tiles; corner
`o=(0,0), R=2` → 6 tiles (clipping removes 7).

### 5. 1D tile index (array storage)
`index(c, r) = r · W + c`  ·  inverse: `c = index mod W`, `r = ⌊index / W⌋`

**Output:** int `[0, W·H−1]` → `[0,63]` on 8×8. **Example:** `index(3,5)=43`; inverse
`43 → (3,5)`.

### 6. Directional step (for push/line resolution)
`step(t, d) = t + V(d)`, where `V(N)=(0,−1)`, `V(S)=(0,1)`, `V(W)=(−1,0)`, `V(E)=(1,0)`.

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| source | t | coord | valid tile | Tile being stepped from |
| direction | d | enum | {N,S,E,W} | Cardinal direction |

**Output:** a coord that **may be out of bounds** (caller checks `inBounds`
separately — deliberately not folded in, so the same primitive detects edge
collisions per Core Rule 8). **Example:** `step((7,3), E) = (8,3)` → `inBounds=false`
→ edge collision.

### 7. Push-destination classification
`classify(t) = OutOfBounds` if `¬inBounds(t)`; else `BlockedTerrain` if `isBlocked(t)`;
else `Lethal` if terrain ∈ {Chasm, lethal Water}; else `Occupied(unitId)` if
`isOccupied(t)`; else `Clear`. Pure descriptor — no mutation. **Example:** push target
`(7,3)` is a Chasm → `classify = Lethal`; Combat Resolution then removes the unit.

### 8. Ray tiles (line-shaped abilities — resolves Open Q8)

`rayTiles(origin, direction, maxLength, board)` walks one step at a time from
`origin` in a cardinal direction, appending each tile in order, and stops **before**
including a tile that is `OutOfBounds` or `BlockedTerrain` (per `classify`) or after
`maxLength` steps — whichever comes first. `Occupied` and `Lethal` tiles **are**
included (line-shaped abilities pass through units/hazards; only bounds and solid
walls stop the ray).

```
rayTiles(origin, direction, maxLength, board):
  result = []
  current = origin
  for i in 1..maxLength:
    next = board.step(current, direction)
    if not board.inBounds(next): break
    if board.isBlocked(next): break
    result.append(next)
    current = next
  return result   # ordered nearest-to-farthest
```

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| origin | `origin` | coord | valid tile | Ray's starting tile (not included in output) |
| direction | `direction` | enum | `{N,S,E,W}` | Cardinal direction (reuses Formula 6's `V(d)`) |
| max length | `maxLength` | int | ≥0 | Ability-defined ray length cap |

**Output range:** an ordered list of `0` to `maxLength` tiles, nearest-first.
**Example:** origin `(2,3)`, direction `E`, `maxLength=4`, no obstacles →
`rayTiles = [(3,3),(4,3),(5,3),(6,3)]`. If `(5,3)` is Blocked →
`rayTiles = [(3,3),(4,3)]` (the wall tile itself is excluded). Confirmed downstream
by Heroes & Abilities' Line-shaped kits (e.g. Striker's Piercing Round).

### 9. Reachable tiles (bounded flood-fill — resolves cross-system contract C3)

Board & Grid **owns** the single canonical bounded flood-fill. Heroes & Abilities'
`legalMoveTiles()` and Enemy movement-to-range both consume this function — no
second hand-written BFS anywhere in the codebase.

```
reachableTiles(origin, range, board):
  visited = { origin }
  frontier = [origin]
  for step in 1..range:
    next = []
    for tile in frontier:
      for n in board.neighbors(tile):
        if n not in visited and board.classify(n) == Clear:
          visited.add(n)
          next.append(n)
    frontier = next
  return visited − { origin }
```

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| origin | `origin` | coord | valid, `Clear` tile | Start of the flood-fill (unit's current tile) |
| range | `range` | int | ≥0 | Maximum BFS depth (movement range) |
| board | `board` | Board | live or `snapshot()` | Read via `neighbors`/`classify` only — no mutation |

**Output range:** a subset of Formula 4's Manhattan disk minus the origin:
`0 ≤ |reachableTiles| ≤ 2·range² + 2·range` (obstacles only shrink this set, since
the BFS only expands through `Clear` tiles). **Example:** open 8×8 board,
`origin=(3,3), range=3` → 24 tiles (the full radius-3 Manhattan disk minus origin).

> **Not defined here (deferred to the owning system):** "cardinal direction between
> two arbitrary tiles" is ambiguous unless the tiles share a row/col, so it is an
> ability-design tie-break (Heroes & Abilities' `legalTargets` / Combat Resolution's
> push-direction authoring), not board geometry.

## Edge Cases

**Classification precedence** (resolves "two rules apply at once"): `classify` is
evaluated in strict order **OutOfBounds → BlockedTerrain → Lethal → Occupied →
Clear**. The first match wins. E.g. a tile that is both off-board and would be
occupied resolves as OutOfBounds.

- **If a push/move resolves toward an out-of-bounds tile**: the unit stays on its
  current tile; board reports `OutOfBounds`; Combat Resolution applies the edge
  collision (Core Rule 8). The board never moves a unit off the grid.
- **If a push/move resolves onto a Blocked (wall) tile**: the unit stays; board
  reports `BlockedTerrain`; collision reported to Combat Resolution.
- **If a unit enters a Chasm / lethal-Water tile** (by move or push): board reports
  `Lethal` and, when Combat Resolution instructs, clears the occupancy (the unit is
  removed). **The board never removes a unit on its own** — it only reports the fact.
- **If a push resolves onto an Occupied tile**: board reports `Occupied(unitId)` and
  makes **no change**; Combat Resolution decides the consequence (bounce, mutual
  collision, chain-push). The one-occupant invariant forbids the board from stacking.
- **If any operation would place two units on one tile**: the board **rejects the
  second `place()`** and raises an invariant violation to the caller. This is a bug
  guard, not a gameplay path — deterministic sequential resolution should never
  request it.
- **If `tilesInRange` is called with `R = 0`**: returns exactly `{origin}` (distance
  0 ≤ 0).
- **If `tilesInRange`/`neighbors` is called with an out-of-bounds origin**: rejected
  (assert) — origins must be valid tiles; callers validate coordinates first.
- **If a negative coordinate is queried**: `inBounds` returns `false` (no wraparound —
  the grid never wraps).
- **If a destructible Blocked tile is destroyed**: terrain becomes `Normal`; the tile
  was necessarily Empty (blocked tiles cannot hold units), so no occupancy change.
  Any flags on the tile persist until explicitly cleared.
- **If a hazard is set on a Blocked or Chasm tile**: the board stores it as opaque
  state without validation; whether it has any effect is Combat/Enemy's rule, not the
  board's.
- **If an enemy would spawn on an already-occupied `spawn-point` tile**: the board
  only reports `isOccupied`; the spawn consequence (damage the occupant, delay the
  spawn, etc.) is the Enemy, Abilities & Telegraph system's rule — flagged as a cross-system
  decision for that GDD.
- **If the grid is constructed with `W < 1` or `H < 1`**: rejected at construction;
  the board enforces `W ≥ 1` and `H ≥ 1` (playable minimums are larger, but that is a
  content constraint, not a board invariant).

## Dependencies

**Upstream (systems Board & Grid depends on): NONE.** Board & Grid is a Foundation
system — it holds only spatial data and pure queries, with no dependency on any
other system.

**Downstream (systems that depend on Board & Grid):** All are **Designed** (see
`design/gdd/systems-index.md`). The interfaces below are reconciled against
`design/architecture/cross-system-contracts.md` §2 (canonical) and each dependent's
own GDD.

| Dependent System | Interface (what it uses) | Hard / Soft |
|------------------|--------------------------|-------------|
| **Combat Resolution** | reads occupancy/terrain/`classify`/`step`/`neighbors`/`distance`/`getHazard`; mutates occupancy, terrain (destroy), hazard state via `place`/`clear`/`setTerrain`/`setHazard` | **Hard** — cannot function without the board |
| **Encounter Generator** | writes initial terrain layout, `spawn-point`, `objective` & `deploy-zone` flags; reads `inBounds`, `snapshot()` | **Hard** |
| **Heroes & Abilities** | `tilesInRange`, `neighbors`, `distance`, `isOccupied`, `getOccupant`, terrain, `rayTiles`, `reachableTiles` — for legal moves & targeting | **Hard** |
| **Enemy, Abilities & Telegraph** | same spatial queries as abilities (incl. `reachableTiles` for movement-to-range); reads `spawn-point` flags | **Hard** |
| **Move Preview** | `snapshot()` + all queries — simulates a turn against a copy | **Hard** — depends on the snapshot capability specifically |
| **Input & Selection** | screen↔tile coordinate mapping, `inBounds`, `getOccupant` | **Hard** |
| **Board Rendering & Juice** | full tile grid: terrain, hazard, occupancy, flags | **Hard** |
| **Objective / Win-Lose** | reads `objective` flags & occupancy of objective tiles | **Hard** |
| **Turn & Phase Manager** | `snapshot()` at Player-Phase start and after each committed action; adopts a previously captured snapshot as the new live board on undo (no board-owned `restore()`) | **Hard** — undo and phase-gating cannot function without `snapshot()` |
| **Battle HUD** | occasional board reads (tile highlight state); mostly reads combat/unit state | **Soft** |

**Bidirectional-consistency note:** every downstream system above is now Designed
and lists Board & Grid in its own Dependencies section (confirmed against
`design/gdd/systems-index.md`'s Dependency Map, e.g. `heroes-and-abilities.md` and
`turn-and-phase-manager.md` both mark Board & Grid ✅ Hard). No dangling
one-directional edges remain.

## Tuning Knobs

| Knob | Default | Safe Range | Too Low | Too High |
|------|---------|-----------|---------|----------|
| `grid_width` (W) | 8 | 5–12 | Too cramped — no room to reposition, kills Pillar #2 (Positioning) | Board stops being readable at a glance (breaks Pillar #5) and hurts web render perf |
| `grid_height` (H) | 8 | 5–12 | Same as width | Same as width |
| `water_lethal` | `true` | bool | — | If `false`, Water becomes passable & non-lethal (v1 ships `true` = Water behaves like Chasm) |
| `edge_behavior` | `blocking_collision` | enum | — | `blocking_safe` (unit stops at edge, no collision consequence) removes a key positioning threat; `blocking_collision` is the ITB-style default |
| `blocked_destructible_default` | `false` | bool | — | If `true`, all Blocked terrain is destructible unless a tile overrides it — makes cover far more disposable |

**Interactions between knobs:**
- `grid_width` × `grid_height` set total tile count, which the **Encounter Generator**
  reads to scale enemy/objective density. Changing board size without re-tuning
  encounter density makes battles feel empty (big board) or overwhelming (small board).
- `water_lethal` couples with Combat Resolution's push semantics: if Water is lethal,
  "shove into water" is a kill; if not, it is merely a reposition. Do not flip this
  without reviewing hero/enemy balance.

**Intentionally NOT a knob:** adjacency mode is **fixed at 4-directional**. It is a
design pillar decision (legibility, Pillar #5), not a tunable value — exposing it
would let a config change silently rewrite every range/targeting formula in the game.

## Visual/Audio Requirements

**N/A.** Board & Grid is a pure spatial-data model with no rendering or audio output
of its own; all visual and audio presentation of tile, unit, terrain, and hazard
state is owned by `design/gdd/board-rendering-and-juice.md`, which reads this
system's query API.

## UI Requirements

**N/A.** Board & Grid exposes no player-facing UI. Screen↔tile input mapping is
owned by `design/gdd/input-and-selection.md`; on-screen board presentation is owned
by `design/gdd/board-rendering-and-juice.md`.

## Acceptance Criteria

All criteria are pure, synchronous, deterministic unit tests (no mocked time, no
seeded RNG). Default board `8×8` unless stated.

**Construction & determinism**
- **GIVEN** `W≥1, H≥1`, **WHEN** the board is constructed, **THEN** it succeeds and `width===W`, `height===H`.
- **GIVEN** no dimensions, **WHEN** constructed, **THEN** it defaults to `8×8`.
- **GIVEN** `W<1` or `H<1`, **WHEN** constructed, **THEN** construction is rejected and no board is produced.
- **GIVEN** a board in state `S`, **WHEN** identical mutation sequences run on two identically-constructed boards, **THEN** both reach byte-identical state (no hidden RNG/time). *(Run ≥100× / across restarts as a smoke gate — nondeterminism absence is sampled, not proven.)*

**`inBounds` (Formula 1)**
- **GIVEN** `0≤c<W ∧ 0≤r<H`, **WHEN** `inBounds(c,r)`, **THEN** `true`.
- **GIVEN** any negative coord, **WHEN** `inBounds`, **THEN** `false` (no wraparound).
- **GIVEN** `c=W` or `r=H`, **WHEN** `inBounds`, **THEN** `false`.

**`neighbors` (Formula 3)**
- **GIVEN** interior `(3,3)`, **WHEN** `neighbors`, **THEN** exactly `{(3,2),(3,4),(2,3),(4,3)}` (4).
- **GIVEN** corner `(0,0)`, **WHEN** `neighbors`, **THEN** exactly `{(1,0),(0,1)}` (2); edge tile → 3.
- **GIVEN** any tile, **WHEN** `neighbors`, **THEN** no result is diagonal and every result is `inBounds`.

**`distance` (Formula 2)**
- **GIVEN** `a=(1,1), b=(4,5)`, **WHEN** `distance`, **THEN** `7`; **GIVEN** `a===b` **THEN** `0`.
- **GIVEN** any `a,b`, **WHEN** `distance(a,b)` vs `distance(b,a)`, **THEN** equal (symmetry).
- **GIVEN** diagonal `(0,0),(1,1)`, **WHEN** `distance`, **THEN** `2` (Manhattan, not Chebyshev).

**Occupancy — one unit per tile (Rule 5)**
- **GIVEN** an empty tile, **WHEN** `place(unit)`, **THEN** occupied and `getOccupant===unit`.
- **GIVEN** a tile occupied by A, **WHEN** `place(B)`, **THEN** rejected, occupant stays A, state uncorrupted.
- **GIVEN** an occupied tile, **WHEN** `clear`, **THEN** `isOccupied===false`.
- **GIVEN** a move `clear(from)+place(to)`, **WHEN** both complete, **THEN** the unit is never observably on both/neither tile.

**Terrain (Rule 6)**
- **GIVEN** a `Blocked` tile, **WHEN** checked, **THEN** `isBlocked===true` and `classify===BlockedTerrain`.
- **GIVEN** a `Chasm` tile a unit enters, **WHEN** `classify`, **THEN** `Lethal`; occupancy unchanged until Combat calls `clear()`.
- **GIVEN** `water_lethal=true`, **WHEN** a unit enters `Water`, **THEN** `classify===Lethal`; **GIVEN** `water_lethal=false` **THEN** non-lethal (knob respected).
- **GIVEN** a destructible `Blocked` tile, **WHEN** `destroy`, **THEN** terrain `Normal`, `isBlocked===false`; flags on the tile persist.
- **GIVEN** a `Chasm` tile, **WHEN** `destroy`, **THEN** no-op (Chasm permanent).

**Hazard (Rule 7)**
- **GIVEN** any tile (incl. Blocked/Chasm), **WHEN** `setHazard(type)`, **THEN** `getHazard===type`, no occupancy/terrain field changes as a side effect.

**Edge & push (Rule 8)**
- **GIVEN** unit at `(7,3)` pushed East, **WHEN** `step` then `classify`, **THEN** `step=(8,3)`, `inBounds=false`, `classify=OutOfBounds`, unit's tile unchanged.
- **GIVEN** push onto Blocked, **WHEN** `classify`, **THEN** `BlockedTerrain`, unit unchanged.
- **GIVEN** push onto Occupied, **WHEN** `classify`, **THEN** `Occupied(unitId)`, no auto-stack, state unchanged.

**Flags (Rule 9)**
- **GIVEN** any tile, **WHEN** `setFlag('spawn-point'|'objective'|'deploy-zone')`, **THEN** `getTile().flags` includes it and `hasFlag(tile, flag)===true`; `isOccupied` reports occupancy only (board doesn't resolve spawn/objective/deploy consequences).

**API purity (Rule 10)**
- **GIVEN** state `S`, **WHEN** any query is called any number of times, **THEN** state after `=== S` (no query mutates).

**`tilesInRange` (Formula 4)**
- **GIVEN** `R=0`, **THEN** `{origin}`. **GIVEN** interior `(3,3),R=2` **THEN** 13 tiles. **GIVEN** corner `(0,0),R=2` **THEN** 6 tiles.
- **GIVEN** an OOB origin, **WHEN** called, **THEN** rejected.
- **GIVEN** any valid origin/R, **THEN** every result satisfies `distance≤R ∧ inBounds`.

**`index` (Formula 5)**
- **GIVEN** `(3,5), W=8`, **THEN** `index=43`; inverse of `43` **THEN** `(3,5)`.
- **GIVEN** every valid `(c,r)` (exhaustive on small board), **THEN** `index`→inverse round-trips with no collisions (bijection); result ∈ `[0, W·H−1]`.

**`step` (Formula 6)**
- **GIVEN** interior `t` and each of `{N,S,E,W}`, **THEN** `step` = `t + V(d)` exactly.
- **GIVEN** an edge tile stepping off-board, **THEN** `step` returns an OOB coord (no internal clamp/reject).

**`classify` precedence (Formula 7)**
- **GIVEN** one tile per rank, **WHEN** `classify`, **THEN** it returns the expected rank, confirming order **OutOfBounds → BlockedTerrain → Lethal → Occupied → Clear** (esp.: occupied Chasm → `Lethal`, not `Occupied`).

**`rayTiles` (Formula 8)**
- **GIVEN** origin `(2,3)`, direction `E`, `maxLength=4`, no obstacles, **THEN** `rayTiles = [(3,3),(4,3),(5,3),(6,3)]` (4 tiles, nearest-first).
- **GIVEN** the same setup but `(5,3)` is Blocked, **WHEN** `rayTiles`, **THEN** it returns exactly the 2 tiles before the wall and excludes the wall tile itself.
- **GIVEN** an Occupied or Lethal tile along the ray, **WHEN** `rayTiles`, **THEN** that tile IS included (only OutOfBounds/BlockedTerrain stop the walk).
- **GIVEN** a caster on the last row/column facing off the board, **WHEN** `rayTiles`, **THEN** it returns `[]` immediately (first step is OutOfBounds).

**`reachableTiles` (Formula 9)**
- **GIVEN** an interior origin with `range=3` on an open 8×8 board, **WHEN** `reachableTiles`, **THEN** it returns exactly 24 tiles, none of which is the origin.
- **GIVEN** `range=0`, **WHEN** `reachableTiles`, **THEN** it returns `∅` (origin itself is excluded from the result, per Heroes & Abilities' `legalMoveTiles` contract).
- **GIVEN** an obstacle that fully encloses the origin, **WHEN** `reachableTiles`, **THEN** it returns `∅` even with `range > 0`.
- **GIVEN** any valid `origin`/`range`, **THEN** every returned tile satisfies `distance(origin, t) ≤ range ∧ classify(t) === Clear`, confirming this is the same function both Heroes & Abilities' `legalMoveTiles()` and Enemy movement-to-range consume (no divergent BFS implementations).

**`snapshot()` (Move Preview contract)**
- **GIVEN** state `S`, **WHEN** `snapshot()` is taken and the copy is mutated, **THEN** the live board stays `S` (deep copy, no shared refs).
- **GIVEN** a snapshot at `T`, **WHEN** the live board mutates after `T`, **THEN** the snapshot does not reflect it.

### Performance Budget (headless TS benchmarks, decoupled from render)

| Operation | Budget | Note |
|-----------|--------|------|
| Single O(1) query (`inBounds`, `distance`, `neighbors`, `isOccupied`, `getOccupant`, `isBlocked`, `step`, `classify`) | avg < 0.01 ms/call | Called dozens of times per frame during hover/preview |
| `tilesInRange` (R ≤ 6, board ≤ 12×12) | < 0.5 ms/call | ~85 tiles worst case |
| **`snapshot()` full deep-copy** (≤ 12×12) | **< 1 ms/call** | **Highest-risk op** — Move Preview snapshots on every hover |
| Combined board cost per frame during active Move Preview | < 2 ms | Leaves ≥ 14 ms for PixiJS render + logic in a 16.6 ms (60 fps) frame |

**Tester checks first:** benchmark `snapshot()` in a tight headless loop (1000 iters,
no rendering), report avg ms/call — it is the one op whose cost scales with board size
and is called repeatedly during interactive preview.

## Open Questions

**Needs an architecture decision (→ ADR during `/create-architecture`):**

1. **Rejected-mutation error contract.** How does the board signal a rejected
   mutation (`place()` on occupied, `W<1` construction, OOB `tilesInRange` origin)?
   *Proposed:* expected gameplay rejections return a `Result` (boolean/enum, no
   throw); genuine programmer errors (invalid construction, OOB query origin)
   assert/throw. Must be pinned so board, tests, and callers agree. *Owner:* Tech
   architecture.
2. **Tile-state representation & `snapshot()` strategy.** `snapshot()` is the
   highest-risk op (must deep-copy in < 1 ms). *Proposed:* store tile state in flat
   typed arrays (terrain, occupancy, hazard, flags as parallel arrays) so snapshot is
   a cheap array copy rather than object-graph clone. *Owner:* Tech architecture. This
   is the ADR already flagged in Detailed Design.

**Resolved this session (provisional defaults — confirm during implementation):**

3. **`destroy()` on a non-destructible `Blocked` tile** → no-op, returns `false`.
4. **`clear()` on an already-empty tile** → idempotent no-op.
5. **`tilesInRange` with `R < 0`** → rejected (assert), consistent with OOB-origin handling.
6. **`setFlag` on `Blocked`/`Chasm` tiles** → allowed and stored opaquely, same as hazards.

**Deferred to the owning system's GDD:**

7. **Multi-tile units (size > 1).** v1 assumes every unit occupies exactly one tile.
   If large units (ITB-style 2-tile Vek) are wanted later, the occupancy model must
   extend to "a unit occupies a set of tiles." *Owner:* Heroes & Abilities (post-v1).
8. ~~**`rayTiles` for straight-line abilities.**~~ **RESOLVED.** Line-shaped hero
   abilities are confirmed (Heroes & Abilities' Striker kit). Board & Grid owns
   `rayTiles(origin, direction, maxLength, board)` — see Formula 8 and the
   canonical API in Detailed Design, matching `cross-system-contracts.md` §2.
9. **Cardinal direction between two arbitrary tiles.** Not the board's job (ambiguous
   unless same row/col). Abilities should author an explicit push direction, or Combat
   Resolution defines a tie-break rule. *Owner:* Heroes & Abilities / Combat Resolution.
