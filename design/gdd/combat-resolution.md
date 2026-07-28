# Combat Resolution

> **Status**: In Design
> **Author**: workflow (design-system fan-out)
> **Last Updated**: 2026-07-27
> **Implements Pillar**: #1 Perfect Information, Perfect Blame; #2 Positioning Over Power; #4 Every Hero Is a Verb

## Overview

Combat Resolution is the deterministic engine that turns an ability's intent
into a board outcome. It owns exactly **ten effect primitives** — `damage`,
`push`, `pull`, `swap`, `spawnHazard`, `applyHazard`, `removeUnit`,
`setTerrain`, `spawnUnit`, and the shared **collision resolution** algorithm
that `push`/`pull` both use — and it owns nothing else. Every hero ability and every enemy ability is compiled,
by its own system, into an ordered list of these primitives; Combat
Resolution never knows or cares whether a `push` came from a hero's shove or
an enemy's charge. This is what breaks the Heroes↔Combat and Enemy↔Combat
dependency cycles flagged in `systems-index.md`: abilities depend on Combat
Resolution's primitives one-directionally, never the reverse. The system is
**pure with respect to its inputs** — given the same board state and the
same ordered effect list, it always produces the same mutations and the same
event log, with no RNG, no wall-clock dependence, and no hidden state — which
is precisely what lets Move Preview dry-run a whole turn by feeding the same
primitives a `Board.snapshot()` instead of the live board (per
`board-and-grid.md`). Combat Resolution is the system Pillar #2 (Positioning
Over Power) is built on: `push`/`pull`/`swap` are first-class primitives with
the same status as `damage`, so a hero's entire kit can be pure positioning
and still be a complete, powerful verb (Pillar #4).

## Player Fantasy

Combat Resolution has no direct player fantasy — like Board & Grid and Turn &
Phase Manager, it is invisible infrastructure. What the player *feels* when
this system works is **"the board obeyed exactly what I saw."** When a
player previews a shove that lands an enemy in a chasm, commits it, and the
enemy falls into the chasm — with no dice roll, no "miss," no different
outcome than the preview promised — that instant of *"yes, exactly that"* is
Combat Resolution succeeding invisibly. It is the mechanical proof behind
Pillar #1 (Perfect Information, Perfect Blame): every consequence the player
reasoned about before committing is the consequence that happens. It is also
what makes Pillar #4 (Every Hero Is a Verb) *feel* true rather than just
being a marketing line — because push, pull, and swap are resolved with the
same rigor and the same weight as damage, a hero who never deals a point of
damage can still feel as powerful and decisive as one who does. The failure
state of this system is a resolved outcome that doesn't match what the
preview showed, or an unfun "gotcha" (an untelegraphed chain reaction) — both
would break the trust the whole game depends on.

## Detailed Design

### Core Rules

1. **Ownership boundary.** Combat Resolution owns exactly these primitives
   and nothing else: `damage`, `push`, `pull`, `swap`, `spawnHazard`,
   `applyHazard`, `removeUnit`, `setTerrain`, `spawnUnit`, and the shared
   collision resolution algorithm used by `push`/`pull`. It does **not** define what any hero or enemy
   ability *does* (that is Heroes & Abilities / Enemy, Abilities & Telegraph's
   job) — it only defines what happens when one of those abilities issues a
   primitive call. It does not decide targeting, range, or AI — it only
   resolves the primitives it is handed.
2. **The resolution contract.** Combat Resolution exposes exactly one entry
   point: `resolve(board: Board, effects: EffectPrimitive[]) -> events: Event[]`.
   `effects` is an **ordered list**, authored by the calling system (an
   ability's effect chain, an Environment-phase hazard tick, an enemy's
   resolved action). Effects are applied **strictly sequentially** — the
   board state after effect `i` is the input to effect `i+1`. There is no
   simultaneous or parallel resolution anywhere in this system; this is what
   guarantees determinism (Pillar #1) and matches Turn & Phase Manager's
   "one-at-a-time application — never simultaneous" rule for enemy actions.
   `resolve()` mutates the `board` instance it is given (via Board & Grid's
   mutation API — `place`/`clear`/`setTerrain`/`setHazard`) and returns the
   event log; it never mutates any board *other* than the one passed in.
   Determinism, not immutability, is the purity contract: Move Preview
   achieves a dry-run by calling `resolve(board.snapshot(), effects)` instead
   of the live board, per `board-and-grid.md`'s snapshot contract — the live
   board is untouched because the *input* was a clone, not because
   `resolve()` itself refuses to mutate.
3. **`damage(targetId, amount, sourceId?)`.** Reduces the target's HP by a
   flat, non-negative integer `amount` (see Formula F1). No hit chance, no
   crit, no resistance/type system is defined by this document — flat damage
   only. Emits `DamageApplied(targetId, amount, hp')` on every call. If the
   target's HP reaches 0, `removeUnit(targetId, Defeated)` is triggered as
   part of the same resolution step, before the next effect in the chain
   runs (Rule 8 covers the accompanying `UnitRemoved` event).
4. **`push(targetId, direction, distance, sourceId?)`.** Displaces `targetId`
   up to `distance` tiles in one cardinal `direction` (per
   `board-and-grid.md` Core Rule 3: push directions are always orthogonal),
   resolved **one tile at a time** using the shared collision algorithm
   (Formula F2). The push always terminates at the first obstacle; there are
   no chain pushes (Rule 10).
5. **`pull(targetId, sourceId, direction, distance)`.** Uses the identical
   tile-by-tile algorithm as `push` (Formula F2), but the caller must supply
   an explicit `direction` — Combat Resolution never computes "the direction
   from target toward source" itself. This resolves `board-and-grid.md`'s
   Open Question #9 ("cardinal direction between two arbitrary tiles is
   ambiguous"): the ambiguity is pushed to the calling ability, which is
   responsible for only offering `pull` on targets that share a row or
   column with the source, and for computing the resulting orthogonal
   direction before calling this primitive. If a caller supplies a
   `distance` that would move the target onto the source's own tile, the
   source's tile is treated as `Occupied` like any other unit — standard
   unit-collision resolution applies (Edge Case, below); the source is not
   exempt from occupancy rules.
6. **`swap(unitAId, unitBId)`.** Atomically exchanges the board positions of
   two currently-placed units. Both units must currently occupy the board;
   if either does not, the whole swap is rejected as a no-op (Edge Cases).
   Swap ignores intermediate tiles and range — it is not resolved via the
   step-by-step collision algorithm, because both destination tiles are, by
   definition, tiles a unit is already legally standing on (a unit can never
   be standing on Blocked or Lethal terrain, so no terrain-validity check is
   needed). Range/targeting restrictions on *which* units may be swapped are
   an ability-level concern (Heroes & Abilities), not this primitive's. A
   successful exchange emits `SwapComplete(unitAId, unitBId)`.
7. **`spawnHazard(tile, hazardType, duration?)` / `applyHazard(tile)` are
   split by design.** `spawnHazard` only sets the tile's hazard overlay
   (delegates to `Board.setHazard`); it does **not** automatically affect
   whoever is currently standing on that tile. `applyHazard` is the only
   primitive that resolves a hazard's effect against a tile's current
   occupant. This single-responsibility split keeps every primitive doing
   exactly one thing (Pillar #4's "verb" philosophy applied to the engine
   itself) and keeps them independently composable: an ability that wants to
   "create fire AND immediately burn whoever's standing there" issues
   `spawnHazard` followed by `applyHazard` in the same effect chain; an
   ability that wants to "seed a trap for later" issues only `spawnHazard`.
   A tile holds **at most one hazard**; a new `spawnHazard` call on an
   already-hazarded tile **overwrites** the previous hazard (last-write-wins,
   no stacking, matching Board & Grid's `None ↔ Hazard(type)` state model).
   A successful `spawnHazard` call emits `HazardSpawned(tile, hazardType,
   duration)`; a successful `applyHazard` call against a hazarded tile with
   a current occupant emits `HazardApplied(tile, unitId, amount)`.
8. **`removeUnit(targetId, cause)` is the single exit point from the board**
   for any unit, regardless of cause (`Defeated`, `Fell`, or a future
   ability-driven `Recalled` — see Open Questions). It clears the unit's
   board occupancy and emits `UnitRemoved(targetId, cause, tile)`, which is
   the event Objective / Win-Lose listens to for both lose conditions (all
   heroes removed) and win conditions (all enemies removed, or a named
   target removed). `removeUnit` is **idempotent**: calling it on a unit
   already removed is a no-op, guarding against a unit being targeted twice
   in one effect chain (e.g. damage that kills a unit, followed by a
   pre-computed `applyHazard` that targets the same now-empty tile).
9. **Hazard-on-entry.** Any primitive that causes a unit to occupy a **new**
   tile — a successful step within `push`/`pull`, a completed `swap`, or an
   ordinary hero `Move` (Rule 13) — immediately triggers `applyHazard` on the
   tile the unit just entered, if that tile carries a hazard. This makes
   "step into fire and get burned right now" the default, legible behavior
   rather than a delayed one; the Environment phase (Turn & Phase Manager)
   additionally re-applies hazards every turn to whoever is *currently*
   standing on them, so a unit that stays on a hazard is burned both on
   entry and again at the next tick. A unit that does **not** actually
   change tiles (a push that collides on step 1 and displaces 0 tiles) never
   triggers hazard-on-entry.
10. **No chain pushes in v1 (explicit design decision).** When `push`/`pull`
    resolves onto an `Occupied` tile, the obstacle unit is **never itself
    displaced**. The pushed unit stops one tile short and both units take
    `collision_damage` (Tuning Knobs). This keeps every collision resolvable
    with a single, uniform rule regardless of how many units are involved,
    which is what makes it possible to read a whole multi-hero turn in ten
    seconds (Pillar #5) — a domino chain reaction would require the player
    to trace an unbounded cascade before committing. If a future hero verb
    wants a chained "bowling" push, it must be a **new, explicitly named
    primitive** (e.g. `chainPush`), not a hidden variant of this one — this
    is flagged as a future extension point, not designed here (Open
    Questions).
11. **Target-locking for multi-target effect chains.** When an ability
    affects multiple units (an AoE), the calling system must snapshot the
    list of target unit IDs **once**, before the effect chain begins
    resolving — not re-query "who is on this tile" between primitives in the
    same chain. This mirrors Turn & Phase Manager's rule that a telegraphed
    attack "resolves against the telegraphed tile... not chasing the unit":
    if an earlier primitive in the chain pushes a unit out of the AoE, a
    later primitive in the *same* chain still targets that unit by ID (and,
    per Rules 3/8, becomes a no-op if that unit was removed in the interim).
    Combat Resolution enforces this by taking primitives parameterized by
    unit ID / tile, never by a live spatial query resolved mid-chain.
12. **Ordering rule for simultaneous outcomes on one tile.** When a single
    `push`/`pull` step both lands a unit on a hazarded tile *and* immediately
    collides with a further obstacle, landing resolves before impact:
    hazard-on-entry is applied first (the unit "arrives"), then
    `collision_damage` from the obstacle is applied (the unit "hits the
    wall"). This ordering is fixed and does not change with knob values.
13. **Basic Move is a validated case, not a resolved case.** Ordinary hero
    locomotion (walking to an empty, in-range, reachable tile) is a thin
    wrapper over the same `place`/`clear` primitives Board & Grid assigns to
    the "caller" — but unlike `push`/`pull`, a Move's destination must
    already be known-legal (every intermediate and final tile classifies as
    `Clear`) **before** Combat Resolution is asked to apply it; Heroes &
    Abilities is responsible for that legality check (reachability, range,
    terrain) when computing the move's legal-tile set. Combat Resolution
    does not "resolve" an illegal move via collision consequences the way it
    does for a forced displacement — an illegal move is simply never
    offered to the player as an option. If a destination becomes illegal
    between preview and commit (e.g. another effect earlier in the same
    Player Phase changed it), the move is rejected outright, not partially
    resolved. Basic Move still triggers hazard-on-entry (Rule 9) on its
    destination tile.
14. **`setTerrain(tile, terrainType)`.** Deterministically mutates a single
    tile's terrain to `terrainType` (delegates to Board & Grid's `setTerrain`
    mutation — the same one the engine already exposes and that Board's
    internal `destroy` is built on). No RNG, no wall-clock dependence, no
    hidden state: given the same tile and target type it always produces the
    same terrain state. This is the primitive behind a hero **"wall" verb** —
    `setTerrain(tile, Blocked)` raises an impassable wall, `setTerrain(tile,
    Normal)` tears it back down — and it composes with the rest of the engine
    for free because Board's `classify()` already treats `Blocked` as
    movement- and push-blocking (Rule 4 / Formula F2's `BlockedTerrain`
    case), so a hero-built wall stops displacement exactly like any
    pre-authored wall. Setting a tile currently occupied by a unit to a value
    that unit could not legally stand on (`Blocked` or `Lethal`) is rejected
    as a contract violation, not silently resolved (Edge Cases) — a disguised
    removal must go through `removeUnit`. A successful call emits
    `TerrainSet(tile, terrainType)`.
15. **`spawnUnit(tile, unitSpec)`.** Creates a new unit on the board at
    `tile` from the caller-supplied `unitSpec` (archetype, team, starting
    HP/abilities — owned and validated by whichever system authored the
    spec, not by this primitive). `tile` must classify as `Clear`
    (`board.classify(tile) == Clear`); any other classification (`Occupied`,
    `Blocked`, `Lethal`, `OutOfBounds`) causes the call to be **rejected** as
    a no-op — `spawnUnit` never displaces an existing occupant, breaks
    through Blocked/Lethal terrain, or clamps to a fallback tile itself.
    This is the **single board-mutation path for adding a unit to the
    board** — nothing else in this document, or in any calling system, may
    mutate occupancy to introduce a new unit. It has two callers: Enemy,
    Abilities & Telegraph's Spawn-phase **emergence** (new enemies entering
    the battle on a Turn & Phase Manager `Spawn` step) and **on-death
    broods** (an enemy's `removeUnit` triggering a follow-up `spawnUnit` for
    its spawn children, per Enemy, Abilities & Telegraph's own on-death
    effect rules). A successful call emits `UnitSpawned(unitId, tile,
    unitSpec)`. A newly spawned unit does **not** retroactively trigger
    hazard-on-entry (Rule 9) — hazard-on-entry only fires for a unit that
    *moves onto* a hazarded tile, and `spawnUnit` creates the unit already
    standing there; a caller that wants a spawned unit to immediately suffer
    a hazard already present on `tile` must chain an explicit
    `applyHazard(tile)` call after `spawnUnit` in the same effect list,
    identical in spirit to Rule 7's `spawnHazard` + `applyHazard`
    composition.

### States and Transitions

**Unit vitality state** (per unit): `Alive ↔ Removed(cause)`.
- `— → Alive`: a unit's vitality state begins at `Alive` the instant
  `spawnUnit` places it on the board (Rule 15) — the only primitive that
  introduces a unit into this state machine.
- `Alive → Removed(Defeated)`: triggered when `damage` or `applyHazard`
  brings HP to 0 (Rule 3, Formula F1/F3).
- `Alive → Removed(Fell)`: triggered when a `push`/`pull` step or a Move
  places a unit on a `Lethal` tile (Formula F2).
- `Alive → Removed(Recalled)`: reserved for a future non-death removal
  (e.g. a "swap out for reinforcement" hero verb) — **not implemented by
  any primitive in this document** (Open Questions).
- `Removed → Removed`: idempotent no-op (Rule 8). There is no `Removed →
  Alive` transition; removal is permanent for the remainder of the battle.

**Tile hazard state** (per tile, mirrors `board-and-grid.md`'s
`None ↔ Hazard(type)`, extended here with lifecycle ownership):
- `None → Hazard(type, duration)`: triggered by `spawnHazard`.
- `Hazard(type, duration) → Hazard(type, duration)`: `spawnHazard` called
  again overwrites type/duration (last-write-wins).
- `Hazard(type, duration) → Hazard(type, duration−1)`: each Environment-phase
  tick that calls `applyHazard` on this tile decrements a finite `duration`
  (Formula F4).
- `Hazard(type, 0) → None`: automatic clear the instant `duration` reaches 0.
- `Hazard(type, null) `: permanent — never auto-decrements; persists until an
  explicit future `spawnHazard(tile, None)` call (no primitive in this
  document currently issues that — Open Questions).

**Effect chain resolution state** (per `resolve()` call): `Pending →
Resolving → Complete`. Linear, no branching, no re-entrancy.

| State | Meaning | Can exit early? |
|-------|---------|------------------|
| Pending | `effects[]` received, none yet applied | — |
| Resolving | Effects applied strictly in order, index `i` incrementing | **No** — even if effect `i` removes a unit that effect `i+2` targets, resolution continues through the full list (Rule 8's no-op handles the stale target); the chain itself never aborts partway |
| Complete | All effects applied; full `events[]` returned to caller | — |

### Interactions with Other Systems

Combat Resolution is a **service**: other systems author effect lists and
call it; it never initiates action on its own.

| System | Calls into Combat Resolution | Combat Resolution calls into | Ownership boundary |
|--------|------------------------------|-------------------------------|---------------------|
| **Board & Grid** ✅ | — | `place`, `clear`, `setTerrain` (destroy), `setHazard`; queries `classify`, `step`, `neighbors`, `distance`, `isOccupied`, `getOccupant`, `isBlocked` | Board owns spatial state and query truth; Combat owns *when* and *why* to mutate it |
| **Turn & Phase Manager** ✅ | `resolve(board, effects)` during Player Phase (per hero action), Environment Phase (hazard ticks + scripted events), Enemy Resolve Phase (per telegraphed enemy action), Spawn Phase (`spawnUnit` placement) | — (Combat never advances phases or queries the manager) | Manager owns *when* resolution happens; Combat owns *how* an effect list resolves |
| **Heroes & Abilities** ✅ | — | — | Heroes & Abilities compiles a hero verb into an ordered `EffectPrimitive[]` and calls `resolve()` via the Turn Manager during Player Phase; it never bypasses Combat Resolution to mutate the board directly |
| **Enemy, Abilities & Telegraph** ✅ | — | — | Same relationship as Heroes & Abilities: enemy actions compile to the same primitive vocabulary — this is the mechanism that breaks the Enemy↔Combat dependency cycle noted in `systems-index.md`. Also calls `spawnUnit` for Spawn-phase emergence and on-death broods (Rule 15) |
| **Move Preview** ✅ | `resolve(board.snapshot(), effects)` — identical call, cloned input | — | Preview reuses this exact code path (not a reimplementation) so the previewed outcome and the committed outcome can never diverge |
| **Objective / Win-Lose** ✅ | — | — | Reads battle **state** via a pure `evaluate(battleState, turn, config)` call — state-based polling, no event subscription; it inspects post-resolution board/unit state to evaluate win/lose predicates rather than subscribing to Combat's event stream. Combat never queries or notifies Objective |
| **Board Rendering & Juice** ✅ | — | — | Reads the emitted event log (`DamageApplied`, `DisplacementComplete`, `CollisionResolved`, `SwapComplete`, `HazardSpawned`, `HazardApplied`, `UnitRemoved`, `TerrainSet`, `UnitSpawned`) to drive knockback animation, hit-flash, spawn-in, and hazard VFX; Combat has no rendering knowledge |
| **Battle HUD** ✅ | — | — | Reads events to drive damage numbers / HP bar updates; read-only consumer |
| **Audio System** ✅ | — | — | Reads events for SFX triggers (impact, collision, hazard tick, spawn); read-only consumer |
| **Encounter Generator** ✅ | — | `spawnHazard` (authoring initial hazard layout at battle setup, alongside Board's initial terrain) | Generator authors *what* hazards exist at setup; Combat provides the primitive it's placed through |

**Contract this system requires from callers:**
- Heroes & Abilities and Enemy, Abilities & Telegraph must compile every
  ability into the ten primitives above — **no ability may mutate board
  state directly.** This is the load-bearing convention that keeps the
  dependency graph acyclic (already flagged in `systems-index.md`'s
  "Circular Dependencies" section).
- Enemy, Abilities & Telegraph's Spawn-phase emergence and on-death broods
  must go through `spawnUnit` — no other path may add a unit to the board
  (Rule 15).
- Any caller that targets multiple units in one chain must snapshot target
  IDs before resolution begins (Rule 11).
- Move Preview must call the exact same `resolve()` entry point Turn & Phase
  Manager uses for real resolution — a parallel preview implementation would
  reintroduce the "trustworthy full-consequence preview" risk flagged as
  high-risk in `systems-index.md`.

Heroes & Abilities, Enemy, Abilities & Telegraph, Move Preview, Objective /
Win-Lose, Board Rendering & Juice, Battle HUD, Audio System, Ability
Upgrades, and Encounter Generator are all **Designed** (`systems-index.md`).
Each already lists Combat Resolution as an upstream dependency; the
interfaces above match what those GDDs actually consume — see
`design/architecture/cross-system-contracts.md` for the canonical version of
this contract.

## Formulas

All formulas are deterministic (no RNG, no time-dependence). Examples use the
default **8×8** board (registered constants `grid_width`, `grid_height`) and
the default tuning-knob values from this document.

### F1. Damage resolution

`hp' = max(0, hp − amount)`  ·  `isDefeated = (hp' == 0)`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| current HP | `hp` | int | ≥0 | Target's HP before this damage instance |
| damage amount | `amount` | int | ≥0 (see Edge Cases for negative input) | Flat damage; magnitude is owned by the calling ability/enemy stat, not this system |
| resulting HP | `hp'` | int | `[0, hp]` | HP after this instance; monotonically non-increasing |

**Output range:** `hp' ∈ [0, hp]`. **Examples:** `hp=5, amount=7 → hp'=0` →
`isDefeated=true` → `removeUnit(target, Defeated)` fires in the same step.
`hp=10, amount=3 → hp'=7` → not defeated.

### F2. Push/Pull tile-by-tile displacement (collision resolution)

Both `push` and `pull` resolve via the identical step loop; `pull`'s
`direction` points toward the source (Rule 5) instead of away from it.

```
resolveDisplacement(board, unitId, direction, distance):
  stepsMoved = 0
  currentTile = board.getTile(unitId)
  for i in 1..distance:
    nextTile = board.step(currentTile, direction)
    case board.classify(nextTile):
      Clear:
        board.clear(currentTile); board.place(nextTile, unitId)
        if board.getHazard(nextTile) != None: applyHazard(nextTile)
        currentTile = nextTile; stepsMoved += 1
      OutOfBounds:
        emit CollisionResolved(unitId, kind: Edge); damage(unitId, collision_damage)
        return  # stop, 0 further steps
      BlockedTerrain:
        emit CollisionResolved(unitId, kind: Wall); damage(unitId, collision_damage)
        return  # stop
      Lethal:
        board.clear(currentTile); board.place(nextTile, unitId)
        removeUnit(unitId, Fell)
        return  # stop, unit is gone
      Occupied(otherId):
        emit CollisionResolved(unitId, kind: Unit, otherId)
        damage(unitId, collision_damage); damage(otherId, collision_damage)
        return  # stop, no chain (Rule 10)
  emit DisplacementComplete(unitId, stepsMoved)
```

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| target unit | `unitId` | id | valid unit | Unit being displaced |
| direction | `direction` | enum | `{N,S,E,W}` | Always orthogonal (Board & Grid Rule 3) |
| requested distance | `distance` | int | ≥0, ability-defined | Owned by the calling ability, not a global knob |
| collision damage | `collision_damage` | int | 0–3 (Tuning Knobs) | Applied on Edge/Wall/Unit collision |
| tiles actually moved | `stepsMoved` | int (output) | `[0, distance]` | May be less than requested if an obstacle was hit |

**Output range:** `stepsMoved ∈ [0, distance]`; the algorithm always
terminates within `distance` iterations (hard-bounded loop, no risk of
infinite resolution even if `distance` exceeds the board's diameter of 14).

**Worked example 1 (edge collision):** unit at `(7,3)` on an 8×8 board,
pushed East, `distance=2`. Step 1: `step((7,3),E)=(8,3)`, `classify=OutOfBounds`
(col 8 ≥ width 8) → `CollisionResolved(kind: Edge)`, unit stays at `(7,3)`,
takes 1 damage (`collision_damage` default), `stepsMoved=0`.

**Worked example 2 (unit collision short of full distance):** unit at
`(2,3)` pushed East, `distance=3`; `(3,3)` and `(4,3)` are `Clear`, `(5,3)`
is `Occupied`. Step 1: `(3,3)` Clear → move, `stepsMoved=1`. Step 2: `(4,3)`
Clear → move, `stepsMoved=2`. Step 3: `(5,3)` Occupied →
`CollisionResolved(kind: Unit)`, mover stays at `(4,3)`, both units take 1
damage. Final: unit ends at `(4,3)`, 2 of the requested 3 tiles resolved.

**Worked example 3 (lethal terrain):** unit at `(3,3)` pushed South,
`distance=1`, `(3,4)` is a Chasm. Step 1: `classify=Lethal` → unit enters
`(3,4)` then is removed via `removeUnit(unit, Fell)`. Push resolution ends;
`stepsMoved` is not reported (unit no longer exists).

### F3. Hazard tick damage (Fire, base v1 hazard type)

`hp' = max(0, hp − fire_damage_per_tick)`  ·  same defeat trigger as F1.

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| current HP | `hp` | int | ≥0 | Occupant's HP before this tick |
| fire damage/tick | `fire_damage_per_tick` | int | 0–3 (Tuning Knobs) | Flat, deterministic — no RNG variance |

**Output range:** `hp' ∈ [0, hp]`. **Example:** `hp=3, fire_damage_per_tick=1
→ hp'=2`. A unit that enters a Fire tile (hazard-on-entry, Rule 9) and then
remains through the next Environment tick takes the damage **twice** — once
on entry, once on tick — by design (standing in fire is a compounding cost).

### F4. Hazard duration decrement

`duration' = max(0, duration − 1)` when `duration` is a finite int; no
decrement when `duration = null` (permanent). Auto-clear when `duration'=0`.

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| duration before tick | `duration` | int \| null | `≥0` or `null` | `null` = permanent hazard |
| duration after tick | `duration'` | int \| null | `≥0` or `null` | Decremented once per Environment-phase `applyHazard` call on this tile |

**Example:** `duration=1` → after this Environment tick the hazard still
applied this turn, but `duration'=0` clears it before the *next* Environment
phase. `duration=null` → unaffected; persists until an explicit future clear
(no primitive here issues one — Open Questions).

## Edge Cases

- **`damage` with `amount < 0`:** rejected — this is a programmer/caller
  contract violation (negative damage would be healing, a different concept
  not defined by this primitive), not a graceful runtime path. Callers must
  never construct a negative-amount `Damage` effect; this is enforced by an
  assertion, not silently clamped to 0.
- **Any primitive targeting a unit that was already removed earlier in the
  same effect chain:** no-op. The primitive still appears in the event log
  as `*_noop(targetId, reason: 'already_removed')` for debuggability, but no
  state changes. This is the general rule Rules 3/6/8/11 all rely on.
- **`push`/`pull` with `distance = 0`:** no-op; no events beyond an optional
  `DisplacementComplete(unitId, 0)` marker. Not an error.
- **`push`/`pull` requesting a `distance` larger than the board's diameter
  (e.g. `distance=20` on an 8-wide board):** resolved normally — the
  step-by-step algorithm self-terminates at the first obstacle or the board
  edge, which is guaranteed to occur within at most `W+H−2=14` steps on the
  default board (bounded by the `manhattan_distance` output range). No
  special-case clamping is needed.
- **`pull` whose requested distance would land the target on the source's
  own tile:** the source's tile classifies as `Occupied` like any other
  unit; standard unit-collision resolution applies (target stops one tile
  short, both target and **source** take `collision_damage`). This is
  intentional — a badly-tuned pull ability that tries to pull a target all
  the way onto the caster is not a special case, it's a costly mistake for
  whichever ability author configured it that way.
- **`swap` where one or both unit IDs no longer occupy the board (already
  removed by an earlier effect in the same chain):** the entire `swap` is
  rejected as a single no-op — there is no "partial swap." A
  `swap_failed(unitAId, unitBId, reason)` event is emitted for debuggability.
- **`swap` landing a unit on a hazarded tile:** hazard-on-entry (Rule 9)
  fires for **both** units independently at their respective new tiles,
  immediately after the atomic position exchange completes.
- **`spawnHazard` on a tile that already has a different hazard type:** the
  old hazard is overwritten (last-write-wins); no stacking, no blending of
  effects. There is exactly one hazard slot per tile (matches Board & Grid's
  `None ↔ Hazard(type)` state, not a list).
- **`spawnHazard` on a tile currently occupied by a unit:** the tile's
  hazard state is set as normal; the occupant is **not** affected until a
  subsequent `applyHazard` call (either chained immediately by the same
  ability, or at the next Environment tick) — per Rule 7's split
  responsibility. This is different from hazard-on-entry, which only fires
  when a unit *moves onto* an already-hazarded tile, not when a hazard is
  *created underneath* a stationary unit.
- **`applyHazard` on a tile with no hazard, or a hazard tile with no
  occupant:** no-op in both cases (nothing to resolve against).
- **`applyHazard` damage reduces a unit to 0 HP:** identical `removeUnit`
  cascade as `damage` (Formula F1/F3 share the same defeat trigger).
- **`spawnUnit` targeting a tile that is not `Clear`** (`Occupied`,
  `Blocked`, `Lethal`, or `OutOfBounds`): rejected as a no-op — `spawnUnit`
  never displaces an existing occupant, breaks through Blocked/Lethal
  terrain, or clamps to the nearest valid tile. A `spawn_unit_rejected(tile,
  reason)` event is emitted for debuggability, mirroring `setTerrain`'s
  `set_terrain_rejected` (Rule 14).
- **`spawnUnit` onto a `Clear` tile that also carries an active hazard:**
  the unit is created and occupies the tile; hazard-on-entry (Rule 9) does
  **not** fire automatically, because `spawnUnit` is unit *creation*, not a
  unit *moving onto* a tile (Rule 15). A caller that wants the spawned unit
  to immediately suffer the hazard must chain an explicit `applyHazard(tile)`
  call after `spawnUnit` in the same effect list.
- **`setTerrain` on a tile currently occupied by a unit, targeting `Blocked`
  or `Lethal`:** rejected as a caller-contract violation (a unit can never
  legally stand on Blocked terrain, and turning the tile Lethal would be a
  disguised `removeUnit`). Setting an occupied tile to `Normal` (or any
  passable terrain) is allowed. A `set_terrain_rejected(tile, terrainType,
  reason)` event is emitted for debuggability.
- **`setTerrain` that changes a tile to `Blocked` under a unit's *previewed*
  path:** no special-case — because resolution is strictly sequential (Rule
  2), a later `push`/`Move` in the same chain simply sees the now-`Blocked`
  tile via `classify()` and collides/stops normally. A hero can wall off a
  lane and the very next primitive respects the new wall.
- **`removeUnit` called twice on the same unit (e.g. damage kills it, then a
  stale chained effect also calls `removeUnit`):** idempotent no-op on the
  second call (Rule 8); no double-emit of `unit_removed`.
- **Two separate push effects in one chain that would both move different
  units into the same destination tile:** resolved by strict sequential
  order (Rule 2) — whichever push effect appears earlier in the `effects[]`
  list resolves first and claims the tile; the later push then sees that
  tile as `Occupied` and collides normally. There is no simultaneous
  resolution to disambiguate.
- **A push/pull step both enters a hazard tile and, on the very next step,
  hits an obstacle:** per Rule 12, hazard-on-entry resolves for the tile the
  unit actually lands on (the last `Clear` tile), then collision damage from
  the obstacle beyond it is applied — both can stack within a single
  `push`/`pull` call.
- **A `Move` (Rule 13) targets a tile that has an active hazard:**
  hazard-on-entry fires exactly as it would for push/pull; Move is not
  exempt.
- **An ability's effect chain is empty (`effects = []`):** `resolve()`
  returns an empty event log; legal no-op (equivalent to a hero "passing"
  with an ability that has no valid targets).
- **Two units both reduced to exactly 0 HP by the same `applyHazard` tick
  (e.g. a hero and an enemy standing on adjacent tiles both hit by a
  spreading fire authored as two sequential `applyHazard` calls):** both are
  removed; order follows the order the calling system (Environment phase)
  listed the tiles in — Combat Resolution does not invent an ordering, it
  only guarantees whatever order it's given is applied strictly
  sequentially (Rule 2).

## Dependencies

**Upstream (Combat Resolution depends on):**

| System | Interface | Hard / Soft |
|--------|-----------|-------------|
| **Board & Grid** ✅ | `place`, `clear`, `setTerrain`, `setHazard` (mutations); `classify`, `step`, `neighbors`, `distance`, `isOccupied`, `getOccupant`, `isBlocked`, `getHazard`, `snapshot()` (queries) | **Hard** — every primitive is ultimately a sequence of Board mutations/queries |
| **Turn & Phase Manager** ✅ | Combat Resolution is *called by* the manager's `resolve(board, effects) → events` contract; it does not call back into the manager | **Hard** — Combat Resolution only runs when invoked during a phase; it owns no scheduling of its own |

**Downstream (systems that depend on Combat Resolution's primitives — all
Designed; see `systems-index.md`):**

| Dependent System | Interface (what it uses) | Hard / Soft |
|-------------------|---------------------------|-------------|
| **Heroes & Abilities** ✅ | Compiles every hero verb into `EffectPrimitive[]`; calls `resolve()` via the Turn Manager; never mutates the board directly | **Hard** |
| **Enemy, Abilities & Telegraph** ✅ | Compiles every enemy action into `EffectPrimitive[]`, identically to Heroes & Abilities; also calls `spawnUnit` for Spawn-phase emergence and on-death broods (Rule 15) | **Hard** |
| **Move Preview** ✅ | Calls `resolve(board.snapshot(), effects)` — the exact same entry point used for real resolution | **Hard** — the "trustworthy preview" risk depends on this being the *same* code path, not a parallel one |
| **Objective / Win-Lose** ✅ | Reads battle **state** via a pure `evaluate(battleState, turn, config)` call — state-based polling, no event subscription — to evaluate win/lose predicates | **Hard** |
| **Encounter Generator** ✅ | Uses `spawnHazard` to author initial hazard layout at battle setup | **Hard** |
| **Board Rendering & Juice** ✅ | Reads the full event log to drive knockback/hit/hazard VFX | **Hard** |
| **Battle HUD** ✅ | Reads events for damage numbers / HP updates | **Soft** |
| **Audio System** ✅ | Reads events for SFX triggers | **Soft** |
| **Ability Upgrades** ✅ | Reads/overrides `AbilityDefinition` fields (per-ability `distance`/`amount`/`duration` parameters) that Heroes & Abilities' `compileEffects()` ultimately binds into primitive calls; never calls Combat Resolution directly | **Soft** — indirect, mediated by Heroes & Abilities' compilation step |

**Bidirectional-consistency note:** `board-and-grid.md` already lists Combat
Resolution as a **Hard** dependent in its own Dependencies table (row
"Combat Resolution — reads occupancy/terrain/`classify`/`step`/`neighbors`/
`distance`; mutates occupancy, terrain (destroy), hazard state") — consistent
with the Upstream row above. `turn-and-phase-manager.md` drives Combat
Resolution via the canonical `resolve(board, effects) → events` contract
(per `design/architecture/cross-system-contracts.md` §1 — the entry point is
`resolve()`; there is no `apply()` entry point); any lingering `apply(action)`
phrasing in that document is stale and should be reconciled to this
signature. Heroes & Abilities, Enemy, Abilities & Telegraph, Move Preview,
Objective / Win-Lose, Encounter Generator, Board Rendering & Juice, Battle
HUD, Ability Upgrades, and Audio System are all **Designed**
(`systems-index.md`) and each already lists Combat Resolution as an upstream
dependency matching the interfaces above; any drift should be surfaced via
`/consistency-check`.

## Tuning Knobs

| Knob | Default | Safe Range | Category | Too Low | Too High |
|------|---------|-----------|----------|---------|----------|
| `collision_damage` | 1 | 0–3 | Curve | `0` makes collisions purely positional (no chip damage) — a legitimate variant, but removes "pushing into a wall/ally hurts" as a tactical cost, weakening the risk side of forced-movement plays | `>3` turns collision itself into a primary damage source, competing with Pillar #2 (Positioning Over Power) by making the push *itself* the win condition rather than the resulting position; also stacks unpredictably-feeling (though still deterministic) with hazard damage in a single chain |
| `fire_damage_per_tick` | 1 | 0–3 | Curve | `0` makes Fire a pure area-denial/vision tool with no HP cost — valid if that's the intended design for this hazard, but then it can't threaten lethal outcomes | `>3` turns a single Fire tile into a near-instant-kill zone (especially combined with hazard-on-entry + tick in the same turn dealing double), trivializing the "read the board and plan around it" puzzle into "never touch fire, full stop" |
| `hazard_default_duration` | `null` (permanent until overwritten) | `null` or `1–10` (turns) | Gate | A very low finite default (e.g. `1`) makes hazard-creating abilities feel wasted — the threat vanishes before it can be planned around | An unbounded number of permanent hazards accumulating across a long battle clutters the board and breaks Pillar #5 (Read in Ten Seconds); if battles run long, per-ability duration overrides (set by Heroes & Abilities / Enemy) should be preferred over raising this global default |

**Interactions between knobs:**
- `collision_damage` and `fire_damage_per_tick` should be tuned together
  relative to typical hero/enemy HP pools (owned by Heroes & Abilities /
  Enemy stat design, not yet authored): if either knob approaches a
  significant fraction of a typical unit's HP, forced movement alone
  becomes a damage-race tool, which cuts against Pillar #2's intent that
  position — not accumulated chip damage — should decide battles.
- `hazard_default_duration` interacts with `fire_damage_per_tick`: a
  low-damage, long-duration hazard reads as "area denial"; a
  high-damage, short-duration hazard reads as "a burst threat to plan
  around." Both are valid, but changing one without considering the other
  can silently shift a hazard's tactical role.

**Explicitly NOT knobs here (owned elsewhere or structurally fixed):**
- Per-ability `distance` (push/pull range) and per-ability `amount` (damage
  magnitude) are **not** global knobs — they are parameters supplied by
  whichever ability calls the primitive, owned by Heroes & Abilities / Enemy,
  Abilities & Telegraph's own tuning knobs.
- **No chain-push toggle exists** (Rule 10) — this is a structural,
  design-locked invariant (like Board & Grid's fixed 4-directional
  adjacency), not a tunable value, because exposing it would let a config
  change silently turn every push ability into an unbounded, hard-to-read
  cascade.

## Acceptance Criteria

Pure, deterministic unit tests — no wall-clock time, no RNG, no rendering.
Default board `8×8` and default knob values unless stated. All tests operate
on a Board & Grid instance (real or a lightweight fake exposing the same
query/mutation contract).

**Resolution contract (Rules 1–2)**
- **GIVEN** an empty `effects[]` list, **WHEN** `resolve(board, [])`, **THEN** it returns an empty event log and the board is unchanged.
- **GIVEN** an `effects[]` list of length `n`, **WHEN** `resolve()` runs, **THEN** effect `i` is applied to the board state left by effect `i−1`, for every `i` from 1 to `n` (verified via an effect chain where effect 2 depends on a mutation only effect 1 could have caused).
- **GIVEN** identical `(board, effects)` inputs run twice on freshly-constructed identical boards, **THEN** both produce byte-identical resulting board state and identical event logs (determinism smoke test, ≥100 runs).
- **GIVEN** `resolve(board.snapshot(), effects)` is called, **THEN** the original `board` instance is unchanged after the call (Move Preview contract).

**Damage (Rule 3, Formula F1)**
- **GIVEN** a unit with `hp=5`, **WHEN** `damage(unit, 7)`, **THEN** `hp'=0`, `DamageApplied(unit, 7, 0)` is emitted, and `UnitRemoved(unit, Defeated)` is also emitted in the same `resolve()` call.
- **GIVEN** a unit with `hp=10`, **WHEN** `damage(unit, 3)`, **THEN** `hp'=7` and no removal event fires.
- **GIVEN** `amount < 0` is constructed, **WHEN** validated, **THEN** it is rejected before `resolve()` accepts the effect list (contract violation, not a runtime no-op).

**Push (Rules 4, 10, 12; Formula F2)**
- **GIVEN** a unit at `(7,3)` on an 8×8 board, **WHEN** `push(unit, E, 2)`, **THEN** the unit remains at `(7,3)`, exactly `collision_damage` is dealt once, and `CollisionResolved(kind: Edge)` is emitted.
- **GIVEN** a unit at `(2,3)` with `(3,3),(4,3)` Clear and `(5,3)` Occupied, **WHEN** `push(unit, E, 3)`, **THEN** the unit ends at `(4,3)`, both units take exactly `collision_damage`, and no third unit or chain displacement occurs (Rule 10).
- **GIVEN** a unit at `(3,3)` with `(3,4)` a Chasm, **WHEN** `push(unit, S, 1)`, **THEN** the unit is removed with cause `Fell`, `UnitRemoved(unit, Fell, (3,4))` is emitted, and the board tile `(3,3)` is empty.
- **GIVEN** a push lands a unit on a hazarded `Clear` tile with no further obstacle, **WHEN** resolved, **THEN** hazard-on-entry fires exactly once for that tile (Rule 9).

**Pull (Rule 5)**
- **GIVEN** a `pull` call, **WHEN** no explicit `direction` is supplied, **THEN** construction/validation rejects it (Combat Resolution never infers direction — Rule 5).
- **GIVEN** a pull whose distance would land the target on the source's own tile, **WHEN** resolved, **THEN** standard `Occupied` collision applies and **both** the target and the source take `collision_damage`.

**Swap (Rule 6)**
- **GIVEN** unit A at tile `X` and unit B at tile `Y`, **WHEN** `swap(A, B)`, **THEN** A is now at `Y`, B is now at `X`, and no intermediate tile state is ever observable (atomic).
- **GIVEN** unit A was removed earlier in the same chain, **WHEN** `swap(A, B)` is attempted, **THEN** the entire swap is rejected, B remains at its original tile, and a `swap_failed` event is emitted.
- **GIVEN** a swap lands a unit on a hazarded tile, **WHEN** resolved, **THEN** hazard-on-entry fires independently for each unit that landed on a hazarded destination.

**Hazard primitives (Rule 7, Formulas F3–F4)**
- **GIVEN** an unhazarded tile, **WHEN** `spawnHazard(tile, Fire, duration=3)`, **THEN** `getHazard(tile) == Fire` and the tile's current occupant (if any) takes **no** damage as a direct result of this call alone.
- **GIVEN** a hazarded tile and a call to `applyHazard(tile)` immediately after `spawnHazard` in the same chain, **THEN** the occupant takes `fire_damage_per_tick` damage — proving the two-primitive composition works.
- **GIVEN** `applyHazard` on a tile with no hazard, **THEN** no-op, no event beyond an optional no-op marker.
- **GIVEN** `applyHazard` on a hazarded tile with no occupant, **THEN** no-op (hazard state itself is unchanged, no damage).
- **GIVEN** a hazard with `duration=1`, **WHEN** `applyHazard` ticks it once, **THEN** `duration'=0` and the tile's hazard is auto-cleared (`getHazard(tile) == None`) before the call returns.
- **GIVEN** a hazard with `duration=null`, **WHEN** `applyHazard` ticks it any number of times, **THEN** the hazard is never auto-cleared.
- **GIVEN** a tile already hazarded with `Fire`, **WHEN** `spawnHazard(tile, Smoke)` is called, **THEN** `getHazard(tile) == Smoke` (overwrite, no stacking).

**SetTerrain (Rule 14)**
- **GIVEN** an empty `Normal` tile, **WHEN** `setTerrain(tile, Blocked)`, **THEN** `classify(tile)` reports `Blocked` and a subsequent `push` toward that tile stops one tile short with `CollisionResolved(kind: Wall)` (proving a hero-built wall blocks displacement with no engine changes).
- **GIVEN** a `Blocked` tile with no occupant, **WHEN** `setTerrain(tile, Normal)`, **THEN** `classify(tile)` reports `Clear` and a unit may subsequently be pushed or moved onto it (wall torn down), and `TerrainSet(tile, Normal)` is emitted.
- **GIVEN** a tile occupied by a unit, **WHEN** `setTerrain(tile, Blocked)` is attempted, **THEN** it is rejected, the terrain is unchanged, and `set_terrain_rejected` is emitted.

**SpawnUnit (Rule 15)**
- **GIVEN** an empty `Clear` tile, **WHEN** `spawnUnit(tile, unitSpec)`, **THEN** a new unit occupying `tile` exists on the board in the `Alive` state, and `UnitSpawned(unitId, tile, unitSpec)` is emitted exactly once.
- **GIVEN** a tile that is `Occupied`, `Blocked`, `Lethal`, or `OutOfBounds`, **WHEN** `spawnUnit(tile, unitSpec)` is attempted, **THEN** the call is rejected as a no-op — no unit is created and no `UnitSpawned` event fires.
- **GIVEN** a hazarded `Clear` tile, **WHEN** `spawnUnit(tile, unitSpec)` resolves, **THEN** the new unit is **not** damaged by the existing hazard as a direct consequence of spawning (hazard-on-entry does not retroactively apply); a subsequent `applyHazard(tile)` in the same chain is required to damage it.

**RemoveUnit (Rule 8)**
- **GIVEN** a unit on the board, **WHEN** `removeUnit(unit, Defeated)`, **THEN** its tile becomes empty and `UnitRemoved(unit, Defeated, tile)` fires exactly once.
- **GIVEN** a unit already removed, **WHEN** `removeUnit` is called on it again (same or different cause), **THEN** no-op — no second `UnitRemoved` event.

**Target-locking (Rule 11)**
- **GIVEN** an effect chain `[push(unitB, ...), damage(unitB, 5)]` where the push moves `unitB` off the tile an AoE was originally aimed at, **THEN** the subsequent `damage(unitB, 5)` still resolves against `unitB` by ID (not by re-querying the original tile), proving primitives are ID-addressed, not tile-addressed, once a chain begins.

**Determinism & ordering (Rule 2, Edge Cases)**
- **GIVEN** two `push` effects in one chain targeting different units toward the same destination tile, **THEN** the effect listed first in `effects[]` claims the tile and the second collides with it as `Occupied` — verified by swapping the order of the same two effects and observing the outcome change accordingly (order-dependence is intentional and testable).

### Performance Budget (headless TS benchmarks, decoupled from render)

| Operation | Budget | Note |
|-----------|--------|------|
| Single primitive resolution (`damage`, `applyHazard`, `removeUnit`, `spawnHazard`) | avg < 0.02 ms/call | Dominated by Board & Grid's already-budgeted O(1) query/mutation cost |
| Single `push`/`pull` step (one tile of displacement) | avg < 0.02 ms/step | Bounded loop of ≤14 iterations even at max distance |
| Full effect chain for one hero/enemy action (~1–10 primitives) | < 1 ms | Leaves headroom for Move Preview to re-run this on every hover frame |
| `resolve()` call during Move Preview (chain + `board.snapshot()` cost) | < 2 ms combined | Inherits Board & Grid's `snapshot()` budget (<1 ms on ≤12×12) as its dominant cost |

## Open Questions

**Needs an architecture decision (→ ADR during `/create-architecture`):**

1. **Event log serialization contract.** Rendering, HUD, and Audio all
   consume the same canonical event stream this document defines
   (`DamageApplied`, `DisplacementComplete`, `CollisionResolved`,
   `SwapComplete`, `HazardSpawned`, `HazardApplied`, `UnitRemoved`,
   `TerrainSet`, `UnitSpawned` — per
   `design/architecture/cross-system-contracts.md` §1), but the exact wire
   schema (fields, versioning) isn't pinned. *Proposed:* a flat, tagged-union
   event type per primitive, matching the naming used throughout this
   document. *Owner:* Tech architecture, coordinated with Board Rendering &
   Juice / Battle HUD / Audio System (all Designed).

**Resolved this session (provisional defaults — confirm during
implementation):**

2. **Pull's direction ambiguity** (`board-and-grid.md` Open Question #9) is
   resolved here: `pull` requires an explicit `direction` from the caller;
   Heroes & Abilities must restrict pull-target eligibility to same-row/
   same-column tiles and compute the direction itself. *Owner to confirm:*
   Heroes & Abilities, when authored.
3. **No chain pushes in v1** — a deliberate legibility decision (Rule 10).
   If a future hero verb needs domino-style chained displacement, it
   requires a distinct, explicitly-named primitive, not a hidden branch of
   `push`. *Owner:* revisit if/when such a hero is drafted for the roster.
4. **Collision damage is a single shared value** across edge/wall/unit
   collisions, rather than three separate knobs — chosen for legibility and
   because splitting them adds tuning surface without a clear design need
   yet. Revisit if playtesting shows edge/wall collisions should feel
   different from unit-on-unit collisions.

**Deferred to the owning system's GDD:**

5. **Damage types / resistances.** This document defines only flat, typeless
   damage. If VANGUARD wants damage-type interactions (e.g. "armor reduces
   physical, not fire"), that is a Heroes & Abilities / Enemy stat-system
   concern layered on top of the `damage` primitive's `amount` parameter —
   **not** redefined here. **PROVISIONAL: assumed not to exist in v1**,
   consistent with the game concept's "no bloated numeric systems" scope
   guidance.
6. **Hazard catalog beyond Fire.** Only `Fire` is concretely specified
   (Formula F3). `Smoke`, `Acid`, or other hazard types are reserved type
   slots that must resolve through `applyHazard`, but their actual effects
   (damage amount, non-damage effects like vision-blocking) are content
   authored by Encounter Generator / Enemy, Abilities & Telegraph — both
   already **Designed** (`systems-index.md`), and each likewise only
   concretely specifies `Fire` today (`enemy-abilities-and-telegraph.md`
   itself flags its non-Fire `spawnHazard` calls as provisional). This is
   unauthored *content* within two already-designed systems, not a
   design-status gap — expanding the hazard catalog is a future content
   pass on those two GDDs, not a new architecture question.
7. **Multi-tile units (size > 1).** Every primitive in this document assumes
   unit size = 1 (per Board & Grid's Core Rule 5 and its own deferred Open
   Question #7). If larger units are added post-v1, `push`/`pull`/`swap`
   all need extension to move a set of tiles atomically. *Owner:* Heroes &
   Abilities, if/when confirmed.
8. **`Recalled` removal cause.** Reserved in the vitality state model
   (States and Transitions) for a possible future non-death removal verb
   (e.g. "swap a hero out of battle"), but **no primitive in this document
   currently produces it** — it is a placeholder enum value, not a
   implemented feature. *Owner:* Heroes & Abilities, if such a verb is
   drafted.
9. **Explicit hazard-clear primitive.** There is currently no primitive to
   clear a hazard other than `spawnHazard` overwriting it or `duration`
   expiring — an ability whose entire purpose is "remove this hazard" (e.g.
   "extinguish fire") has no primitive to call. *Owner:* revisit when Heroes
   & Abilities' roster is drafted; likely resolved as `spawnHazard(tile,
   None)` being a legal call rather than a new primitive.
10. **Overkill/excess-damage tracking.** Damage beyond what was needed to
    reach 0 HP is currently discarded (Formula F1 clamps at 0, no overflow
    value is captured). If a future hero verb wants "overkill splashes to an
    adjacent tile" or similar, this document would need an `excess` output
    value added to the `damage` primitive. **Not implemented v1.**
