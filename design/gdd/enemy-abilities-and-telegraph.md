# Enemy, Abilities & Telegraph

> **Status**: In Design
> **Author**: workflow (design-system fan-out)
> **Last Updated**: 2026-07-27
> **Implements Pillar**: #1 Perfect Information, Perfect Blame; #5 Read in Ten Seconds; #2 Positioning Over Power

## Overview

Enemy, Abilities & Telegraph owns everything about VANGUARD's non-player
combatants: the enemy roster's definition data (stats, abilities, special
on-death effects), a deterministic target-selection AI, the mechanics of
**emerging** onto the board, and the **telegraph** system that shows the
player exactly what every enemy will do one full turn before it happens.
Like Heroes & Abilities, every enemy ability is compiled into Combat
Resolution's 10 effect primitives (`damage`, `push`, `pull`, `swap`,
`spawnHazard`, `applyHazard`, `removeUnit`, `setTerrain`, `spawnUnit`, plus
the shared collision-resolution algorithm) — this system never mutates the
board directly, which is what keeps the Enemy↔Combat dependency acyclic
(per `systems-index.md`). This document exists because Pillar #1 (Perfect
Information, Perfect Blame) is only as strong as its weakest link: if the
enemy's *actual* resolved behavior can ever diverge from what its telegraph
promised, the whole "every loss is a legible mistake" contract breaks. It is
also where Pillar #2 (Positioning Over Power) gets its sharpest edge on the
enemy side — telegraphed enemy actions resolve against fixed **tiles**, not
chasing units, so blocking a path, standing on a landing spot, or luring two
enemies together are all first-class tactical answers to a telegraph, never
damage races.

## Player Fantasy

Enemy, Abilities & Telegraph has no ability icon of its own — the player
never "uses" it — but it is the single biggest lever on how *smart* the
player feels. When an enemy's full turn is laid out as unambiguous
tile-and-icon threats, the player experiences the core fantasy directly:
**"I already know exactly what's coming — the only question is whether I'm
clever enough to answer it."** This delivers Challenge as the primary MDA
aesthetic (a fully-solvable puzzle, never a guessing game) and Discovery as
a secondary aesthetic (learning an enemy archetype's movement-to-range
logic well enough to predict it on sight, the way an Into the Breach player
learns to read a Vek's windup). The failure state of this system is any
moment where the enemy's resolved action doesn't match its displayed
telegraph, or where the AI's choice feels arbitrary rather than legible
("why did it target that one?") — either would replace "I miscalculated"
with "that wasn't fair," which is the one thing this game can never allow
(Pillar #1).

## Detailed Design

### Core Rules

1. **Ownership boundary.** This system owns: enemy roster/archetype
   definition data, compiling enemy abilities and on-death effects into
   Combat Resolution's `EffectPrimitive[]`, the deterministic target-
   selection AI, telegraph intent computation and storage, telegraph-to-
   resolution execution (movement step + effect gate), and the mechanical
   rules of spawn emergence (occupancy handling, first-turn inactivity). It
   does **not** own: the effect primitives themselves (Combat Resolution);
   *which* enemies appear in a battle, on what spawn-point, on what turn
   (Encounter Generator authors this schedule — this system only executes
   it); win/lose evaluation (Objective / Win-Lose); or phase sequencing
   (Turn & Phase Manager decides *when* to call this system's three contract
   methods, `chooseIntents()`, `resolveTelegraphed()`, `emergeSpawns()`).
2. **Enemy Definition Data.** Every enemy archetype defines: `maxHP` (int
   ≥1), `moveRange` (`M`, int ≥0 — tiles reachable per turn via BFS
   pathing, Formula F2), one or more **Abilities** (Rule 3), an optional
   `onDeath` effect-chain template (Rule 12), and a **target policy**
   (default: Nearest-Threat, Formula F1). Each *instance* of an archetype
   placed on the board is additionally assigned a unique, monotonically
   increasing `unitId` at spawn time — this ID drives deterministic
   resolution order (Rule 4) and is never reused within a battle.
3. **Ability Definition.** Enemy abilities are instances of the exact same
   `AbilityDefinition` schema `heroes-and-abilities.md` defines and owns —
   `{ shape, targetFilter, effectTemplate, compileEffects() }` — per that
   document's Rule 16 and `cross-system-contracts.md` §5; this system does
   **not** define a parallel ability schema. Each enemy Ability sets:
   - `shape`: `SingleTile` (anchored on the AI-selected target's tile,
     `range = attackRange`) or `Area` (same anchor, `range = attackRange`
     for reachability purposes, `areaRadius = r` for the AoE footprint,
     precise geometry in Formula F3) — the two of Heroes & Abilities' five
     closed-set shapes (`Self`, `SingleTile`, `UnitTarget`, `Line`, `Area`)
     enemy archetypes use in v1. Unlike a hero's `Area` ability, the enemy
     AI never lets the player pick the origin tile — `chooseIntents()`
     (Rule 5) supplies it automatically as the selected target's tile,
     substituting AI-driven selection for player input exactly as Heroes &
     Abilities' Rule 16 anticipates. The schema itself does not forbid a
     future `UnitTarget`- or `Line`-shaped enemy ability (e.g., a beam
     attacker); v1's roster simply doesn't need one.
   - `attackRange` (`R`, Manhattan distance, int ≥0, or the `∞` sentinel
     for unlimited-range "artillery" abilities) — this is the ability's
     `shape.range` field, named `attackRange` in this document for AI/
     telegraph-rule readability.
   - `targetFilter`: `Enemy` by default (from the casting enemy's team
     perspective, this targets heroes) — reusing Heroes & Abilities'
     closed set (`Self`/`Ally`/`Enemy`/`AnyUnit`/`EmptyTile`/`AnyTile`)
     verbatim; an archetype may set `AnyUnit` if Rule 11's friendly fire
     is meant to include other enemies by design (rare, e.g. a berserk
     archetype), though the default resolves against heroes only.
   - `effectTemplate`: an ordered list of Combat Resolution primitive
     calls with placeholders, identical in structure to a hero
     `effectTemplate` (`heroes-and-abilities.md` Rule 11).
   - `compileEffects(caster, ability, selectedTarget) -> EffectPrimitive[]`:
     the same pure, deterministic function signature Heroes & Abilities
     defines (its Formula F5) — enemy resolution calls it with the
     AI-selected target instead of a player selection.

   Enemy abilities are authored the same way as hero abilities (per
   `systems-index.md`'s Enemy row) and contain **zero RNG** — every
   parameter (damage amount, push distance, hazard type) is a fixed value
   on the archetype or ability definition (Pillar #3: variety lives in the
   draft, never the dice, and enemies are not drafted — they are authored
   once, deterministically).
4. **Deterministic enemy resolution order (Formula F4).** Both
   `chooseIntents()` and `resolveTelegraphed()` process living enemies in
   **strictly ascending `unitId` order** — i.e., spawn order, oldest first.
   This satisfies Turn & Phase Manager's requirement for "a deterministic
   order (owned by Enemy, Abilities & Telegraph, e.g. by enemy id/
   initiative)." Order matters most during `resolveTelegraphed()`: one
   enemy's resolution can change the board (push a unit, spawn a hazard)
   before the next enemy in the order resolves.
5. **Target-Selection AI — Nearest-Threat Policy (default, Formula F1).**
   At `chooseIntents()` time, each enemy selects exactly **one** target
   from its policy's candidate set (default: all living heroes) by nearest
   Manhattan distance, ties broken by lowest target `unitId`. **There is no
   fallback to a second-choice target** if the top choice turns out to be
   unreachable (see Rule 10) — an enemy commits to the nearest threat, full
   stop, which keeps its behavior legible ("it's going for the closest
   one") rather than surprising the player with a target switch.
6. **Movement-to-range destination (Formula F2, BFS).** Given the selected
   target's tile, the enemy computes `telegraphedMoveDestination`: the
   BFS-reachable tile (within `moveRange` steps, respecting terrain/
   occupancy) closest to the target and within the ability's `attackRange`,
   using a fixed tie-break (Formula F2). If the enemy's current tile is
   already within range, `telegraphedMoveDestination = null` (no movement
   planned). This computation happens **once**, at `chooseIntents()` time,
   using the board state as it exists at that moment (end of the previous
   turn).
7. **Telegraphed effect tiles (Formula F3).** Computed at the same
   `chooseIntents()` moment, anchored on the target's **current** tile —
   this produces `telegraphedEffectTiles`, a fixed, absolute set of board
   coordinates. Once set, this set is **never recomputed** — it is the
   literal telegraph shown to the player and the literal set of tiles that
   will be affected at resolution (Pillar #1's central promise).
8. **Intent data contract.** `chooseIntents()` produces, per living enemy,
   an `Intent` record: `{ enemyId, telegraphedMoveDestination,
   telegraphedEffectTiles, abilityId }`, or `{ enemyId, Idle: true }` if no
   valid target/path existed (Rule 10). Imminent spawns produce a parallel
   `SpawnIntent: { spawnPointTile, archetypeId }` (Rule 16). These records
   are the read contract Board Rendering & Juice and Move Preview consume.
   Separately, Rule 17 defines two environment-scoped query methods
   (`telegraphedEnvironmentTiles(turn)`, `telegraphedLethalThreatCount(turn)`)
   that are not per-enemy `Intent` records but sibling read surfaces,
   computed at this same `chooseIntents()` moment.
9. **`resolveTelegraphed()` execution**, per living enemy, in Rule 4's
   order:
   a. **Skip** entirely if the enemy no longer exists (removed earlier this
      turn) or its stored intent is `Idle`.
   b. **Movement step:** re-path from the enemy's *current* tile toward the
      *same, unchanged* `telegraphedMoveDestination` using Formula F2's BFS
      mechanism, capped at `moveRange`. The destination tile itself is
      never re-chosen — only the path to it is recomputed live. The enemy
      moves as far along that path as is currently legal (partial movement
      is normal; zero movement if immediately blocked). This is applied via
      Combat Resolution's Move semantics (Combat Resolution Rule 13),
      including hazard-on-entry.
   c. **Occupant re-resolution:** immediately before compiling this
      enemy's effect chain, query the board **once** for the current
      occupant of each `telegraphedEffectTiles` entry (which may differ
      from whoever was there at telegraph time). The resulting unit ID(s)
      are then locked for the rest of this `resolve()` call, per Combat
      Resolution Rule 11 (target-locking).
   d. **Range gate (Formula F5):** if the enemy's post-movement tile is not
      within `attackRange` of at least one telegraphed effect tile, the
      entire effect chain is skipped — a **whiff** (movement from step b
      still stands; an `enemy_action_whiffed` event is emitted).
   e. If the gate passes, compile and call
      `Combat.resolve(board, compiledEffectChain)` against the re-resolved
      occupants/tiles from step (c).
10. **Idle intent.** If no valid target exists, or no destination tile
    exists that is both BFS-reachable within `moveRange` and within
    `attackRange` of the selected target (and the enemy is not already in
    range), the enemy telegraphs and resolves as **Idle**: no movement, no
    effect chain, and a distinct "inactive" icon is shown so the player can
    tell "this enemy has genuinely committed to nothing" apart from a
    missing/broken telegraph.
11. **Friendly fire is not filtered.** An ability's effect-tile shape
    (Formula F3) is computed purely spatially around the target; any unit —
    hero **or another enemy** — standing in the resulting tile set is
    affected exactly as Combat Resolution would apply it to anyone else.
    This is intentional: it rewards luring enemies together (Pillar #2) and
    keeps Combat Resolution's primitive layer faction-agnostic and simple.
12. **On-death reactive effects (`onDeath`).** Any archetype may define an
    `onDeath` effect-chain template, parameterized by the dying enemy's
    **last occupied tile** (read from the triggering
    `unit_removed(targetId, cause, tile)` event). By default it fires for
    **both** `Defeated` and `Fell` removal causes (a per-archetype tuning
    knob can restrict it to `Defeated`-only) — because `removeUnit` is
    Combat Resolution's single exit point "regardless of cause" (Combat
    Resolution Rule 8), and a cause-conditional death effect would be
    harder to read than "if it dies, it happens" (Pillar #5). When an
    `onDeath` template includes a "brood" clause (spawning child units,
    e.g. Broodmother), it does so via Combat Resolution's `spawnUnit(tile,
    unitSpec)` primitive (primitive #9 of 10 — the single board-mutation
    path for enemy emergence, `cross-system-contracts.md` §1 and §5),
    placing up to `broodCount` (Tuning Knobs) new units on `Clear` tiles
    among the last-occupied tile's neighbors; `broodCount` is a valid,
    directly-supported knob because `spawnUnit` is exactly the primitive
    this effect compiles to.
13. **On-death sequencing.** `onDeath` is never injected mid-chain into the
    `resolve()` call that killed the enemy (Combat Resolution's contract is
    a single ordered chain with no reentrancy). Instead, this system
    listens to every `unit_removed` event any `resolve()` call emits; for
    each removed enemy with a defined `onDeath`, it **queues** a follow-up
    `resolve(board, compiledOnDeathEffects)` call, issued in the exact
    order the enemies were removed within the triggering chain, executed
    immediately after that triggering `resolve()` call returns — in
    whatever phase that was (Player Phase, Environment, or EnemyResolve). A
    follow-up call may itself remove further `onDeath`-bearing enemies,
    queuing further follow-ups the same way — a cascade that is guaranteed
    to terminate because each enemy can be removed at most once (Formula
    note, F4).

    **Undo-snapshot timing** (satisfies `cross-system-contracts.md` §3's
    Turn & Phase Manager contract): when the triggering `resolve()` call
    happens during Player Phase, Turn & Phase Manager does not capture its
    post-action `snapshot()` until this entire on-death cascade — every
    queued follow-up `resolve()` call, however many levels deep — has
    fully returned. A Player-Phase undo therefore always rewinds an atomic
    unit: *the hero action plus every on-death consequence it triggered*,
    never a partial state where a dead enemy's brood has already spawned
    but the snapshot doesn't yet reflect it. This system has no
    `snapshot()` call of its own — it satisfies the contract simply by
    returning control to Turn & Phase Manager only after the full cascade
    above has resolved synchronously.
14. **Spawn emergence (`emergeSpawns()`).** Driven by Encounter Generator's
    ✅ authored `spawnSchedule: { archetypeId, spawnPointTile,
    scheduledTurn }[]` (its data contract, referenced from that document's
    Enemy interface row). At the Spawn Phase, for every instruction due
    this turn:
    a. **Clear tile:** instantiate the enemy via Combat Resolution's
       `spawnUnit(tile, unitSpec)` (primitive #9 of 10 — the single
       board-mutation path for enemy emergence, `cross-system-
       contracts.md` §1) — new unique `unitId`, full `maxHP`, placed on
       that tile — and flag it "cannot act this turn."
    b. **Occupied tile:** the spawn is **delayed** and retried every
       subsequent Spawn Phase until the tile clears or `spawn_retry_cap`
       consecutive delays is reached (Tuning Knobs) — deliberately
       standing on a spawn-point to block it is a valid, legible tactic
       (cross-references `board-and-grid.md`'s `spawn-point` flag).
    c. **Forced emergence at `spawn_retry_cap`.** If the tile is still
       `Occupied` once the cap is reached, this system resolves the block
       itself, deterministically, in this exact order:
       i.   Query the current occupant unit of the spawn-point tile.
       ii.  Select a push direction from the fixed compass priority
            **North, South, West, East** (`board-and-grid.md`'s
            `neighbors()` iteration order, `{(0,−1),(0,1),(−1,0),(1,0)}`)
            — the first direction whose destination tile currently
            classifies as `Clear` is chosen.
       iii. **If a direction was found:** call `push(occupantId,
            direction, distance=1)` **and** apply `collision_damage`
            (Tuning Knob, `combat-resolution.md`) to the occupant
            directly — in addition to, not instead of, any collision
            damage the `push` primitive itself would separately deal.
            Being forcibly shoved out to make room for an emerging enemy
            is a violent eviction, not a clean move, regardless of
            whether the destination tile was already open. The
            spawn-point tile is now `Clear`; `spawnUnit` proceeds per
            step (a), this same Spawn Phase.
       iv.  **Fallback — no legal direction exists** (all four orthogonal
            neighbors of the spawn-point tile are
            `Blocked`/`Occupied`/out-of-bounds): the occupant is **not**
            displaced. It still takes `collision_damage` (the eviction
            attempt is punishing even when it fails), and the spawn
            instruction remains `Delayed` — forced-emergence is
            re-attempted every subsequent Spawn Phase (the cap is not
            re-armed; from here on it is retried every turn). This
            guarantees the spawn is never silently cancelled while never
            requiring `removeUnit` on a boxed-in occupant.

    This procedure is the mechanical definition behind the "collision
    consequence" referenced in the State model below.
15. **First-turn inactivity.** A freshly emerged enemy participates in
    *this same turn's* Telegraph Phase (choosing and displaying its first
    intent immediately) but never acts (moves or attacks) on the turn it
    spawns — every enemy gives the player at least one full turn of warning
    before it can affect the board (Pillar #1). This falls out naturally
    from phase order: Spawn happens after EnemyResolve, so a newly-spawned
    enemy simply didn't exist yet when this turn's attacks resolved.
16. **Spawn-imminent telegraph.** Any spawn instruction scheduled for the
    *next* Spawn Phase is itself displayed on its spawn-point tile during
    the *current* Telegraph Phase (a distinct "imminent spawn" icon,
    Visual/Audio Requirements) — spawns get the same one-turn warning as
    attacks.
17. **Environmental telegraph ownership (`telegraphedEnvironmentTiles`,
    `telegraphedLethalThreatCount`).** Per `cross-system-contracts.md` §9
    (resolving C4), this system owns two additional read-only query methods,
    computed fresh at the same `chooseIntents()` Telegraph Phase moment as
    every enemy `Intent` (Rule 7) and held fixed for the remainder of that
    Player Phase, exactly like `telegraphedEffectTiles`:
    a. **`telegraphedEnvironmentTiles(turn) -> Set<tile>`**: the set of board
       tiles that will apply an environmental hazard effect (damage,
       displacement, or removal) during the upcoming Environment Phase,
       independent of any single enemy's `Intent`. In v1, this is exactly
       the set of tiles Board & Grid currently reports as bearing a `Fire`
       hazard (`getHazard(tile) == Fire`) — because Fire ticks every
       Environment Phase for `fire_damage_per_tick` until it expires
       (`combat-resolution.md`), any Fire tile visible right now is, by
       construction, already a one-turn-ahead-visible threat. This query is
       a thin pass-through over Board & Grid's own hazard state, not a
       second source of hazard truth: this system owns the *query surface*
       (so every caller — Move Preview, Battle HUD, Audio System — has one
       unified "what's telegraphed" API instead of separately combining
       Board & Grid's hazard state with this system's `Intent` set) but
       never re-derives or stores hazard placement itself. Non-Fire scripted
       board events (e.g. a rising tide or falling-rock volley, named as
       future flavor in `turn-and-phase-manager.md` Rule 3.2) are explicitly
       deferred (Open Questions) and would extend this set once authored,
       without changing its contract shape.
    b. **`telegraphedLethalThreatCount(turn) -> int`**: the count of
       currently-telegraphed enemy/environment actions that would remove ≥1
       hero if unaddressed (Formula F6) — every non-`Idle` enemy `Intent`
       plus every tile in `telegraphedEnvironmentTiles(turn)` is evaluated
       independently against every living hero's current tile and
       `currentHP`, using each threat's already-fixed, deterministic damage
       value (an ability's `effectTemplate` `damage` amount, or
       `fire_damage_per_tick` for an environmental tile). This is a pure
       tally over already-computed data — no new simulation, no RNG. This is
       the source Audio System's tension Formula reads (`audio-system.md`
       Formula F5).

### States and Transitions

**Enemy vitality state** (mirrors `combat-resolution.md`, with an
Enemy-owned reactive hook): `Alive ↔ Removed(cause)`.
- `Alive → Removed(Defeated | Fell)`: triggered by Combat Resolution
  exactly as for any unit. If the archetype defines `onDeath`, this
  transition additionally queues a follow-up effect chain (Rule 13).
- `Removed → Removed`: idempotent no-op, inherited from Combat Resolution
  Rule 8. No `Removed → Alive` transition exists.

**Enemy intent state** (per enemy, per turn cycle):
`NoIntent → Telegraphed(intent) → [Resolved | Skipped] → (loops)`.

| State | Set by | Meaning |
|-------|--------|---------|
| `NoIntent` | — | Between resolution and the next telegraph computation (momentary) |
| `Telegraphed(intent)` | `chooseIntents()` (Telegraph Phase, Rules 5–8) | A full `Intent` record or `Idle`, displayed to the player |
| `Resolved` | `resolveTelegraphed()` (EnemyResolve Phase of the **following** turn, Rule 9) | Movement + effect gate executed — a whiff still counts as `Resolved` |
| `Skipped` | `resolveTelegraphed()` | Enemy was removed before its resolution slot; intent discarded, nothing executes |

After `Resolved`/`Skipped`, the cycle restarts within the **same** turn's
Telegraph Phase — an enemy is never without a displayed intent for longer
than the brief window between its own EnemyResolve slot and the Telegraph
Phase later that same turn.

**Spawn instruction state** (per scheduled spawn, jointly owned with
Encounter Generator ✅): `Scheduled → ImminentTelegraphed → [Emerged |
Delayed]`, where `Delayed` can loop back to itself indefinitely post-cap
via the fallback in Rule 14c.iv.
- `Scheduled → ImminentTelegraphed`: exactly one Telegraph Phase before the
  scheduled Spawn Phase (Rule 16).
- `ImminentTelegraphed → Emerged`: spawn-point tile is `Clear` at Spawn
  Phase (Rule 14a).
- `ImminentTelegraphed → Delayed → ImminentTelegraphed`: tile `Occupied`;
  retried next Spawn Phase; remains telegraphed throughout the delay
  (Rule 14b).
- `Delayed → Emerged (forced)`: after `spawn_retry_cap` consecutive delays
  (Tuning Knobs), forced emergence resolves per Rule 14c — the occupant is
  pushed 1 tile in the first `Clear` direction found in fixed compass
  order (North, South, West, East) and takes `collision_damage`, then the
  enemy is placed via `spawnUnit`.
- `Delayed → Delayed (forced retry, fallback)`: if forced emergence finds
  no `Clear` orthogonal direction (Rule 14c.iv), the occupant still takes
  `collision_damage`, no enemy is placed, and the instruction stays
  `Delayed`, re-attempting forced emergence every subsequent Spawn Phase —
  guarantees no permanent deadlock and no silent cancellation.

### Interactions with Other Systems

Enemy, Abilities & Telegraph is a **service + AI authority**: it queries
Board & Grid, compiles effects for Combat Resolution to execute, and is
itself driven by Turn & Phase Manager's phase contract.

| System | Enemy reads/calls | Enemy provides / is called by | Ownership boundary |
|--------|--------------------|-------------------------------|---------------------|
| **Board & Grid** ✅ | occupancy, terrain, `isBlocked`, `neighbors`, `distance`, `classify`, `step`, `spawn-point` flags, `tilesInRange` (Formula F3) | — | Query-only consumer — identical contract to Heroes & Abilities |
| **Combat Resolution** ✅ | — (never mutates the board directly) | compiles every ability + `onDeath` template into `EffectPrimitive[]`; calls `resolve(board, effects)` for attacks, enemy movement, and on-death follow-ups | Enemy authors *what* happens; Combat Resolution owns *how* primitives resolve |
| **Turn & Phase Manager** ✅ | current phase/turn indirectly (invoked at the right point) | implements the manager's three contract methods: `chooseIntents()` (Telegraph Phase), `resolveTelegraphed()` (EnemyResolve Phase), `emergeSpawns()` (Spawn Phase) — all deterministic, per the manager's stated contract requirement | Manager owns *when*; Enemy owns *what happens* inside each call |
| **Heroes & Abilities** ✅ | living hero unit IDs + tiles (target candidate set for Formula F1); the `AbilityDefinition` schema itself (`shape`/`targetFilter`/`effectTemplate`/`compileEffects()`, per that document's Rule 16 and `cross-system-contracts.md` §5) | — | Enemy targets heroes; heroes are never targeted *by name* from this system's side except as F1's candidate set. Heroes & Abilities is the canonical source of the shared ability schema; Enemy substitutes AI target selection for player input, reusing the same structure |
| **Encounter Generator** ✅ | — | exposes the enemy archetype catalog + an instantiation entry point (`spawnEnemy(archetypeId, tile)`); consumes the spawn-instruction schedule Encounter Generator authors | Generator authors *which/where/when*; Enemy executes the mechanical spawn/telegraph/resolve rules |
| **Move Preview** ✅ | — | exposes the current turn's stored `Intent` records (`telegraphedEffectTiles`) so Preview can answer "would this hero position still be hit" while the player plans, **and** `telegraphedEnvironmentTiles(turn)` (Rule 17a) for the same union check | Read-only for Preview; Enemy is the source of truth for what *will* happen |
| **Objective / Win-Lose** ✅ | — | emits `unit_removed` (via Combat Resolution) for enemy deaths; exposes a live-enemy count/query for "clear all enemies" objectives | Enemy does not evaluate win/lose itself |
| **Board Rendering & Juice** ✅ | — | exposes `Intent`/`SpawnIntent`/Idle state for icon rendering; emits the same Combat Resolution event log for enemy-sourced actions | Read-only consumer |
| **Battle HUD** ✅ | — | exposes enemy HP/state for HP bars; exposes Intent summaries and `enemy_action_whiffed` events; exposes `telegraphedEnvironmentTiles(turn)` (Rule 17a) for the `heroesInDanger` safety check | Read-only consumer |
| **Audio System** ✅ | — | telegraph-set / whiff / on-death events for SFX triggers; exposes `telegraphedLethalThreatCount(turn)` (Rule 17b) for the tension score | Read-only consumer |

**Contract this system requires from callers/dependents:**
- Turn & Phase Manager must call `chooseIntents()` exactly once per
  Telegraph Phase and `resolveTelegraphed()` exactly once per EnemyResolve
  Phase, in that relative order across turns, or the one-turn telegraph
  guarantee (Rule 15) breaks.
- Encounter Generator must author spawn schedules and enemy placements
  using only this system's instantiation entry point — never place enemies
  on the board directly — so every enemy's first telegraph is generated
  through the normal `chooseIntents()` path (Rule 15).
- Move Preview must read `Intent` records rather than re-deriving enemy
  behavior itself, to avoid a second AI implementation drifting from this
  one (mirrors Combat Resolution's "no parallel preview implementation"
  requirement).

> **Status note:** Heroes & Abilities, Encounter Generator, Move Preview,
> Objective / Win-Lose, Board Rendering & Juice, Battle HUD, and Audio System
> are now **Designed** (see `systems-index.md`) — the interfaces above have
> been reconciled against each system's published GDD; any drift should be
> raised via `/consistency-check`.
>
> **Unit Registry — resolved.** Per `cross-system-contracts.md` §6 and
> registry entry `unit_record`, the canonical per-battle `Unit` record
> (`{ id, team, archetype, maxHP, currentHP, position(tile), size,
> abilities[], hazardImmunities[], statusFlags[] }`) is owned by **Heroes &
> Abilities** (its "Unit Record Schema (authoritative)" section) and is
> *referenced, not re-shaped*, by this system. This system's contribution is
> the `faction: Enemy`-equivalent entries it creates at spawn/`emergeSpawns()`
> time (Rule 14a) via Combat Resolution's `spawnUnit` primitive — it does not
> define a second unit schema.

## Formulas

All formulas are deterministic (no RNG, no time-dependence). Examples use
the default **8×8** board (registered constants `grid_width`, `grid_height`)
and reuse Board & Grid's registered `manhattan_distance` formula wherever
"distance" appears below.

### F1. Nearest-Threat target selection

`selectedTarget = argmin_{t ∈ S} ( distance(o, t.tile), t.unitId )`
— lexicographic ordering: distance is the primary key, `unitId` (ascending)
is the tie-break.

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| enemy tile | `o` | coord | valid tile | The enemy's current position at `chooseIntents()` time |
| candidate set | `S` | set of `{unitId, tile}` | 0..N living units | Default policy: all living heroes |
| distance | `distance(o,t)` | int | `[0,14]` (8×8, registered `manhattan_distance`) | Manhattan distance |

**Output:** a single `{unitId, tile}`, or `NONE` if `S` is empty (Idle,
Rule 10). **Worked example:** enemy at `(2,2)`; Hero A (`id=1`) at `(2,5)`,
distance 3; Hero B (`id=2`) at `(4,3)`, distance 3; Hero C (`id=3`) at
`(6,6)`, distance 8. A and B tie at distance 3 → tie-break selects the
lower `unitId` → **Hero A (`id=1`)** is targeted, even though B exists.

### F2. Reachable destination (movement-to-range resolution, via Board & Grid's `reachableTiles`)

```
reachable(O, M) = board.reachableTiles(O, M, board)
                   // Board & Grid's single bounded flood-fill
                   // (cross-system-contracts.md §2, resolves C3) — over
                   // Clear tiles (not Blocked, not Occupied-by-another-unit,
                   // in-bounds), using isBlocked/isOccupied/neighbors. This
                   // is the same shared implementation Heroes & Abilities'
                   // legalMoveTiles() (heroes-and-abilities.md Formula F1)
                   // consumes — this system does not maintain a second BFS.
candidates(T, R) = { t ∈ reachable(O, M) : distance(t, T) ≤ R }
if distance(O, T) ≤ R:                 destination = O            (no move)
elif candidates(T, R) is non-empty:    destination = argmin over
                                        candidates of (pathLength, then
                                        row-major tile order: lower row
                                        first, then lower column)
else:                                  destination = NONE           (Idle)
```

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| origin | `O` | coord | valid tile | Enemy's tile at computation time |
| target tile | `T` | coord | valid tile | Selected target's tile (F1) |
| move range | `M` | int | ≥0 | Archetype's `moveRange` |
| attack range | `R` | int | ≥0 or `∞` | Ability's `attackRange` |
| path length | `pathLength` | int | `[0, M]` | BFS steps from `O` to a candidate |

**Output:** a tile (`O` itself, or a reached tile), or `NONE`.

**Worked example 1 (reachable, single winner):** Charger at `O=(5,5)`,
`M=3`, `R=1`, target at `T=(5,2)` (`distance=3`, so not already in range).
`(5,2)` itself is occupied by the target and excluded as a destination.
Among candidates within `R=1` of `T` — `{(5,1),(5,3),(4,2),(6,2)}` — only
`(5,3)` is within `M=3` BFS steps of `O` (`distance(O,(5,3))=2`); the
others are all `distance=4`, exceeding `M`. **Destination = `(5,3)`.**

**Worked example 2 (already in range):** Lobber at `O=(3,3)`, `R=4`,
target at `T=(3,6)`, `distance=3 ≤ R=4` → **destination = `O`**,
`telegraphedMoveDestination = null`.

**Worked example 3 (Idle — boxed in):** Charger at `O=(1,1)`, fully
enclosed by Blocked tiles on all four orthogonal sides, target far away →
`reachable(O,3) = {O}` only, and `distance(O,T) > R` → **destination =
`NONE`**, enemy telegraphs `Idle`.

### F3. Ability effect-tile shape

`SingleTile(anchor) = {anchor}` · `Radius(anchor, r) = tilesInRange(anchor, r)`
— `Radius` reuses Board & Grid's registered `tilesInRange` formula exactly.

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| anchor tile | `anchor` | coord | valid tile | The resolved target's tile (F1), used as the shape's center |
| radius | `r` | int | ≥0 | Ability-defined AoE size; `r=0` degenerates to `SingleTile` |

**Output range:** 1 to `min(2r²+2r+1, W·H)` tiles (identical bound to
Board & Grid's Formula 4). **Worked example:** Lobber targets a hero at
`(4,4)` with `Radius(r=1)` → `telegraphedEffectTiles =
{(4,4),(3,4),(5,4),(4,3),(4,5)}` (5 tiles, interior/unclipped).

### F4. Deterministic enemy resolution & telegraph order

`order = ascending unitId`, where `unitId` is assigned in a strictly
increasing sequence at the moment each enemy is placed on the board
(battle-setup enemies first, then spawns in the order they emerge).

**Output:** a total order with no possible ties (IDs are unique and
monotonic within a battle). **Worked example:** enemies with `unitId`
`4, 7, 2` are alive → `chooseIntents()` and `resolveTelegraphed()` both
process `id=2` first, then `4`, then `7` — regardless of spawn recency,
board position, or archetype.

**Cascade termination invariant (on-death, Rule 13):** an `onDeath`
follow-up cascade is bounded by `cascadeDepth ≤ enemyCount`, because
`removeUnit` is idempotent (Combat Resolution Rule 8) — every enemy can be
removed, and therefore trigger `onDeath`, at most once. No additional
formula is needed; this is a structural guarantee, not a tunable value.

### F5. Resolve-time range gate

`fires = ( min_{tile ∈ telegraphedEffectTiles} distance(enemyPostMoveTile, tile) ≤ attackRange ) OR (attackRange == ∞)`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| post-move tile | `enemyPostMoveTile` | coord | valid tile | Enemy's position **after** Rule 9(b)'s movement step |
| telegraphed tiles | `telegraphedEffectTiles` | set of coord | 1..N tiles | Locked at Telegraph time (F3), never recomputed |
| attack range | `attackRange` | int or `∞` | ≥0 | Ability-defined; `∞` = unlimited-range abilities always pass |

**Output:** boolean. If `false`, the entire effect chain is skipped (a
documented whiff — Rule 9d); if `true`, the compiled effect chain resolves
normally against the re-resolved occupants (Rule 9c). **Worked example:**
Charger's planned destination `(5,3)` becomes unreachable at resolve time
because a hero-built Wall now blocks `(5,4)`, the only northward path; a
live BFS re-path from the enemy's current tile `(5,5)` can only reach
`(6,5)` within `M=3`. `distance((6,5), (5,2)) = 1+3 = 4 > R=1` →
**gate fails, attack whiffs**; the Charger ends its action at `(6,5)`,
having moved but not attacked.

### F6. Telegraphed lethal threat count (resolves C4's `telegraphedLethalThreatCount`)

```
telegraphedLethalThreatCount(turn) =
    |{ intent ∈ nonIdleEnemyIntents(turn) : wouldRemoveAHero(intent) }|
  + |{ tile   ∈ telegraphedEnvironmentTiles(turn) : wouldRemoveAHero(tile) }|

wouldRemoveAHero(threat) = ∃ hero h :
    h.alive
  ∧ h.tile ∈ threatTiles(threat)
  ∧ h.currentHP ≤ knownDamage(threat)

threatTiles(intent) = intent.telegraphedEffectTiles      // enemy Intent
threatTiles(tile)   = { tile }                            // environment tile

knownDamage(intent) = intent.ability.effectTemplate's fixed `damage` amount
                       against that target tile (0 if the template carries
                       no `damage` primitive there — Edge Cases)
knownDamage(tile)   = fire_damage_per_tick                // v1's only
                                                            // environmental
                                                            // damage source
```

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| non-idle enemy intents | `nonIdleEnemyIntents(turn)` | set of `Intent` | 0..N living enemies | Every living enemy's stored `Intent` this turn where `Idle != true` (Rule 8) |
| environment tiles | `telegraphedEnvironmentTiles(turn)` | set of coord | 0..N tiles | Rule 17a |
| living hero | `h` | Unit | `team = Hero`, `alive = true` | Read from the shared `unit_record` (`cross-system-contracts.md` §6) |
| known damage | `knownDamage(threat)` | int | ≥0 | Fixed, deterministic per-threat damage — never simulated |

**Output:** a non-negative integer. **Worked example:** two living enemies
have non-`Idle` Intents — a Charger (`damage=2`, one hero at `currentHP=2`
stands on its sole `telegraphedEffectTiles` entry → lethal) and a Lobber
(`damage=1`, no hero currently stands on any of its effect tiles → not
lethal); one Fire tile exists (`fire_damage_per_tick=1`, no hero stands on
it → not lethal) → `telegraphedLethalThreatCount(turn) = 1` (the Charger
only).

**Scope limitation (deliberate, not an oversight):** this formula only
counts `damage`-primitive lethality. A push/pull `Intent` that would shove a
hero into Lethal terrain (an equally real kill) is **not** counted here,
because `knownDamage` for a pure forced-movement ability's effect template
is `0` — Edge Cases documents this explicitly; treated as a scope-limited v1
approximation of "lethal," not a claim that forced-movement kills are safe.

## Edge Cases

- **No living heroes exist when `chooseIntents()` runs** (candidate set `S`
  empty in Formula F1): the enemy telegraphs `Idle`. This should coincide
  with an already-triggered Defeat condition in practice, but the system
  does not assume it and never crashes on an empty target set.
- **Two or more candidate targets tie on distance:** resolved by Formula
  F1's `unitId` tie-break — always the lowest ID, deterministically, no
  exceptions.
- **The enemy's top-priority target is unreachable within range, but a
  farther target would have been reachable:** **no fallback occurs.** The
  enemy telegraphs `Idle` for this turn rather than retargeting (Rule 5) —
  an explicit legibility decision, not an oversight.
- **The enemy is already within `attackRange` of its target at
  `chooseIntents()` time:** `telegraphedMoveDestination = null`; the
  movement step in `resolveTelegraphed()` is skipped entirely (Formula
  F2's "already in range" branch).
- **The enemy's planned destination tile becomes `Blocked`/`Occupied` by a
  different unit between Telegraph and Resolve** (e.g. a hero's Wall
  ability, or another unit ending up there): the destination tile itself
  is **not** re-chosen. The live BFS re-path (Rule 9b) simply gets the
  enemy as close as currently legal toward that same original destination,
  capped at `moveRange`. A hero can deliberately stand on the enemy's
  telegraphed landing spot to physically block it — a first-class Pillar
  #2 tactic.
- **The enemy's own tile is changed by an Environment-phase effect (e.g. a
  rockslide push) before its `resolveTelegraphed()` slot:** the movement
  step (Rule 9b) re-paths from the enemy's new *current* tile toward the
  same locked destination; this can shorten, extend, or entirely negate
  the planned approach. Combined with the range gate (Formula F5), an
  Environment-phase disruption can cause an otherwise-guaranteed attack to
  whiff — this is the intended "setup/disruption" depth `turn-and-phase-
  manager.md` calls out.
- **An enemy is removed (by a hero action, hazard, or collision) before
  its own `resolveTelegraphed()` slot is reached this turn:** its stored
  intent is discarded; `resolveTelegraphed()` skips it entirely (State:
  `Skipped`) — no movement, no effect chain, no whiff event. Its telegraph
  icon simply disappears the instant it's removed (normal occupancy
  clear).
- **A telegraphed effect tile's original occupant moved away before
  Resolve (the victim dodged), and the tile is now empty:** the effect
  chain still resolves against that tile; Rule 9c's occupant re-query
  finds no unit there, so any unit-addressed primitive (`damage`,
  `applyHazard`) is a documented no-op for that tile — the ability "hits
  nothing." This is the direct implementation of `turn-and-phase-
  manager.md`'s "moving out of a telegraphed tile is a core defensive
  play."
- **A telegraphed effect tile's occupant changed to a *different* unit
  (e.g. a hero swap ability moved a different hero onto that exact tile):**
  Rule 9c's re-query targets whoever is there **now**, by ID, for the
  duration of this `resolve()` call — the ability is not "locked" to the
  originally-observed victim's identity, only to the tile. This can mean a
  telegraphed attack lands on a different hero than the one the player saw
  standing there at telegraph time; because the swap that caused this was
  itself a fully visible Player-Phase action, this remains "perfect
  information," just requiring the player to track consequences.
- **A telegraphed AoE's tile set includes both a hero and another enemy:**
  both are affected identically (Rule 11, friendly fire not filtered) —
  there is no faction check anywhere in the effect-tile shape or the
  primitive layer.
- **An `onDeath`-bearing enemy is killed during the Player Phase (before
  its own `resolveTelegraphed()` slot would even occur this turn):** the
  `onDeath` follow-up fires **immediately**, as a follow-up `resolve()`
  call right after the killing chain completes — during Player Phase, not
  deferred to EnemyResolve. Its now-moot telegraphed action for this turn
  is separately discarded per the "removed before its slot" edge case
  above.
- **Two `onDeath`-bearing enemies die in the same triggering `resolve()`
  chain, and their effect radii overlap enough to kill each other:** the
  cascade resolves in the order the enemies were removed within the
  *original* chain (Rule 13); each follow-up `resolve()` call may itself
  trigger further follow-ups, terminating within `enemyCount` steps
  (Formula F4's cascade invariant) — it cannot loop indefinitely because
  `removeUnit` is idempotent.
- **A spawn is scheduled onto an `Occupied` spawn-point tile:** delayed and
  retried every subsequent Spawn Phase (State: `Delayed`); a player
  deliberately standing on a spawn-point to block it indefinitely is legal
  until `spawn_retry_cap` forces emergence with a collision consequence
  (Tuning Knobs) — guarantees the battle can never deadlock on an
  unspawnable enemy.
- **A freshly-spawned enemy's Spawn Phase coincides with the same turn's
  Telegraph Phase:** it participates fully in Telegraph (Rule 16 already
  covers imminent-spawn telegraphing separately; this is about the enemy
  choosing its *own* first combat intent) — it cannot have acted this turn
  (Rule 15) because EnemyResolve already happened earlier in the phase
  order, before this enemy existed.
- **An enemy has `moveRange = 0` (a stationary "turret" archetype):**
  Formula F2 always resolves `destination = O` (no movement possible); if
  `O` is out of range of every candidate target, the enemy is permanently
  `Idle` until a target comes within its `attackRange` unassisted — a
  fully legible "sitting duck" archetype, no special-casing required.
- **An ability's `attackRange = ∞`** (unlimited-range artillery): Formula
  F5's range gate always passes; Formula F2's "already in range" branch
  always applies (`distance(O,T) ≤ ∞` is always true), so
  `telegraphedMoveDestination` is always `null` for such abilities —
  purely stationary ranged threats need no movement logic at all.
- **Multiple enemies telegraph an attack on the exact same tile in the
  same turn:** no deduplication occurs — each enemy resolves independently
  in Formula F4's order, and the tile (and any occupant) can be affected
  multiple times cumulatively, exactly as if the same tile were hit by
  separate hero abilities in sequence (Combat Resolution's ordinary
  sequential-chain behavior).
- **A destructible `Blocked` tile the enemy's own attack targets is
  destroyed by an unrelated effect earlier the same turn:** no special
  case — the effect chain resolves against whatever the tile's current
  state and occupant are at Rule 9c's re-query moment, identical to any
  other tile-state change between telegraph and resolve.
- **No `Fire` (or other) hazard tiles exist anywhere on the board when
  `telegraphedEnvironmentTiles(turn)` is queried:** returns the empty set —
  not an error, and `telegraphedLethalThreatCount(turn)`'s environmental
  term (Formula F6) contributes `0` in that case.
- **A hazard tile's `Fire` duration is about to expire this very Environment
  Phase (its last tick):** `telegraphedEnvironmentTiles(turn)` still
  includes it — the query reflects "will this tile apply an effect this
  coming Environment Phase," which is still true on the final tick; the tile
  is simply absent from the *next* turn's query once it has expired.
- **A hero stands on a tile that is both a telegraphed enemy effect tile
  *and* a telegraphed environmental (`Fire`) tile in the same turn:**
  `telegraphedLethalThreatCount(turn)` (Formula F6) counts the enemy
  `Intent` and the environment tile as two independent threats if each
  individually would remove that hero — no deduplication across the two
  categories, since they resolve at different phases (Environment before
  EnemyResolve) and the hero could in principle be moved away between them.
- **A push/pull-only `Intent` (no `damage` primitive) would shove a hero
  into Lethal terrain:** `telegraphedLethalThreatCount(turn)` does **not**
  count this as lethal (Formula F6's documented scope limitation) — this is
  a deliberate v1 approximation of "lethal," not a bug; the enemy's Intent
  is still fully telegraphed and visible via the ordinary `Intent` data
  contract (Rule 8), just not reflected in the aggregate tension count.

## Dependencies

**Upstream (Enemy, Abilities & Telegraph depends on):**

| System | Interface | Hard / Soft |
|--------|-----------|-------------|
| **Board & Grid** ✅ | `neighbors`, `distance`, `classify`, `step`, `isBlocked`, `isOccupied`, `getOccupant`, `tilesInRange`, `reachableTiles` (Formula F2, resolves C3), `getHazard` (Rule 17a), `spawn-point` flags (read-only) | **Hard** — target selection, pathing, and telegraph-tile computation are impossible without it |
| **Combat Resolution** ✅ | `resolve(board, effects) → events` — the sole way this system mutates the board, for attacks, enemy movement, and on-death follow-ups | **Hard** — this system authors effect lists but never mutates the board directly |
| **Turn & Phase Manager** ✅ | invoked via its phase contract (`chooseIntents()` at Telegraph, `resolveTelegraphed()` at EnemyResolve, `emergeSpawns()` at Spawn) | **Hard** — this system has no scheduling of its own |

**Downstream (systems that depend on Enemy, Abilities & Telegraph):** all
are now **Designed** (see `systems-index.md`); interfaces below are
reconciled against each dependent's published GDD.

| Dependent System | Interface (what it uses) | Hard / Soft |
|-------------------|---------------------------|-------------|
| **Encounter Generator** ✅ | Enemy archetype catalog; `spawnEnemy(archetypeId, tile)` instantiation entry point; `chooseIntents()`/`resolveTelegraphed()` (both for real spawn scheduling and inside the solver's headless simulation); the spawn-instruction schedule contract (Rule 14) | **Hard** |
| **Move Preview** ✅ | Reads current-turn `Intent`/`SpawnIntent` records (specifically `Intent.telegraphedEffectTiles`) **and** `telegraphedEnvironmentTiles(turn)` (Rule 17a), unioned, to evaluate "would this position still be hit" during Player-Phase planning | **Hard** |
| **Objective / Win-Lose** ✅ | Reads `unit_removed` events (via Combat Resolution) and a live-enemy-count query for "clear all enemies" objectives | **Hard** |
| **Board Rendering & Juice** ✅ | Reads `Intent`/`SpawnIntent`/Idle state (as an `intents_telegraphed` payload) for telegraph icon rendering; reads the Combat Resolution event log for enemy-sourced VFX | **Hard** |
| **Battle HUD** ✅ | Reads enemy HP/state, `Intent`/`SpawnIntent`/`Idle` summaries, `enemy_action_whiffed` events, and `telegraphedEnvironmentTiles(turn)` (Rule 17a, for the `heroesInDanger` safety check) | **Hard** |
| **Audio System** ✅ | Reads telegraph-set / whiff / on-death cue events, per-ability/per-archetype `sfx_cue_id`s, and `telegraphedLethalThreatCount(turn)` (Rule 17b, for the tension score) | **Hard** |
| **Heroes & Abilities** ✅ | Reads this system's living-enemy set only indirectly, as the target of hero abilities — no direct call contract | **Soft** |

**Bidirectional-consistency note:** `board-and-grid.md` already lists
Enemy, Abilities & Telegraph as a **Hard** dependent (row: "same spatial
queries as abilities; reads `spawn-point` flags") — consistent with the
Upstream row above. `turn-and-phase-manager.md` already lists this
system's three contract methods (`resolveTelegraphed()`, `emergeSpawns()`,
`chooseIntents()`) in its "Driven via contract" table — consistent.
`combat-resolution.md` already lists this system as a **Hard** dependent
("compiles every enemy action into `EffectPrimitive[]`, identically to
Heroes & Abilities") — consistent. `heroes-and-abilities.md` lists this
system as a **Hard** dependent reusing its `AbilityDefinition` schema —
consistent with the Upstream Dependencies table's "Heroes & Abilities" row.
`encounter-generator.md`, `move-preview.md`, `objective-and-win-lose.md`,
`board-rendering-and-juice.md`, `battle-hud.md`, and `audio-system.md` each
now list Enemy, Abilities & Telegraph as an upstream dependency; the ratings
above match each document's own downstream listing, with two corrections
reconciled this pass — Battle HUD and Audio System were previously rated
**Soft** in this document but are rated **Hard** in their own published
GDDs (both require `telegraphedEnvironmentTiles(turn)` /
`telegraphedLethalThreatCount(turn)`, Rule 17, to function) — corrected to
**Hard** above. `move-preview.md`, `battle-hud.md`, and `audio-system.md`
each separately flagged that this document did not yet expose
`telegraphedEnvironmentTiles(turn)` / `telegraphedLethalThreatCount(turn)`
as a "gap to close" against their own published interfaces — Rule 17
(above) closes that gap.

## Tuning Knobs

| Knob | Default | Safe Range | Category | Too Low | Too High |
|------|---------|-----------|----------|---------|----------|
| `moveRange` (per archetype) | archetype-specific (e.g. 3) | 0–6 | Curve | `0` locks an archetype to "turret" behavior — valid as a deliberate design, but too many `0`-range enemies flattens the board into a static shooting gallery, weakening Pillar #2 | `>6` on an 8×8 board lets one enemy threaten nearly the whole board every turn, making positioning-based mitigation ("just move away") nearly impossible — undermines Pillar #2 |
| `attackRange` (per ability) | archetype-specific (e.g. 1 melee, 4 ranged) | 0–8 (or `∞`) | Curve | `0` forces the enemy to stand exactly on the target's tile to attack, which Board & Grid's occupancy model forbids — effectively unusable, avoid | `∞` on many enemies removes the "get out of range" counterplay entirely; reserve for a small number of clearly-telegraphed "artillery" archetypes so the board still has range-limited threats to hide behind |
| `spawn_retry_cap` | 3 (consecutive delayed Spawn Phases) | 1–10 | Gate | `1` makes spawn-point blocking feel almost punishing-fast (an instant forced collision the very next turn a hero can't move away) | A very high cap (e.g. `10`) lets a single hero permanently neutralize a spawn point for most of a battle, which may be too strong depending on encounter design — Encounter Generator should treat this as a solvability input |
| `onDeath_trigger_causes` | `{Defeated, Fell}` (both) | `{Defeated}` or `{Defeated, Fell}` | Gate | Restricting to `{Defeated}`-only on a specific archetype creates a "safe removal" tactic (shove it into a chasm to fully neutralize it, including its death effect) — valid as an intentional reward for a hard-to-execute positioning play, but weakens the default "if it dies, it happens" legibility rule if used broadly | N/A — there is no "too high," only the binary choice of which causes trigger it |
| `broodCount` (per `onDeath` spawn-brood template) | archetype-specific (e.g. 2) | 0–4 | Curve | `0` makes a "spawn brood on death" archetype pointless — remove the effect entirely instead of setting this to 0 | High counts (>4) combined with a large `Radius` can flood the board with child enemies faster than the player can process them in ten seconds, breaking Pillar #5 |

**Interactions between knobs:**
- `moveRange` and `attackRange` should be tuned together per archetype:
  a low-`moveRange`/high-`attackRange` archetype reads as "sniper, hard to
  approach"; a high-`moveRange`/low-`attackRange` archetype reads as
  "aggressive melee rusher." Mismatched extremes (both very low) produce a
  near-inert enemy; both very high produces an omnipresent, unavoidable
  threat that erodes Pillar #2.
- `spawn_retry_cap` interacts with Encounter Generator's spawn-point
  placement: a spawn point with only one approachable blocking tile makes
  the cap far more exploitable than a spawn point with multiple approach
  angles — this is a cross-system balance concern for Encounter Generator,
  not something this document can fully resolve alone.

**Intentionally NOT knobs (structural, design-locked invariants):**
- **Telegraph lead time is fixed at exactly one turn** (Rule 15/16) — like
  Board & Grid's fixed adjacency mode and Turn & Phase Manager's fixed
  phase order, exposing this as a config value would let a setting
  silently break Pillar #1's core promise.
- **Friendly fire is always on** (Rule 11) — filtering it would require
  giving Combat Resolution's faction-agnostic primitives a faction
  concept, which is a structural change, not a per-battle tuning value.
- **No fallback targeting** (Rule 5) — a toggle to "retarget if
  unreachable" would make enemy behavior context-dependent and harder to
  read at a glance; kept fixed for legibility.
- **Resolution order (`unitId` ascending, Formula F4)** — an "initiative
  stat" alternative was considered and deliberately deferred (see Open
  Questions) rather than exposed now, to avoid two competing ordering
  systems before either is validated by play.

## Visual/Audio Requirements

Per the "Legible Battlefield" visual identity anchor (`game-concept.md`):
icon-driven telegraphs, one accent color per verb-family, neutral board so
threats pop.

- **Telegraph icon language:** each ability's `telegraphedEffectTiles` are
  highlighted with a distinct overlay color/icon keyed to the primitive
  family it compiles to (e.g., a shared "threat" accent for `damage`-
  bearing tiles, a directional arrow icon for `push`/`pull`-bearing tiles,
  a flame/overlay icon for `spawnHazard`/`applyHazard`-bearing tiles) —
  mirroring the hero-side "one accent color per verb-family" rule so the
  player reads enemy and hero verbs through the same visual grammar.
- **Movement vs. effect distinction:** `telegraphedMoveDestination` (if
  any) is shown as a distinct, lower-emphasis indicator (e.g. a dotted
  path/footstep trail) separate from the higher-emphasis
  `telegraphedEffectTiles` highlight — the player must be able to tell "it
  will walk here" from "it will hit here" at a glance, since blocking the
  former can prevent the latter (Formula F5's range gate).
  *Test: a new player can correctly point at "where it's going" vs "what
  it will hit" within ten seconds of seeing a single enemy's telegraph.*
- **Idle indicator:** a distinct "inactive" icon (e.g. a dimmed/sleeping
  glyph) is shown on any enemy telegraphing `Idle`, so its absence of a
  threat marker reads as "confirmed safe," not "telegraph missing."
- **Spawn-imminent indicator:** a distinct icon on any spawn-point tile
  with a `SpawnIntent` scheduled for next Spawn Phase, visually separate
  from both the movement and effect-tile icon families (it is neither).
- **Whiff feedback:** when Formula F5's range gate fails at resolve time,
  a brief, low-intensity visual/audio cue plays (distinct from a normal
  hit) so the player can confirm "yes, that block worked" without
  ambiguity — this is a critical trust-building moment for Pillar #1.
- **On-death effect clarity:** an `onDeath` effect chain plays its own
  full telegraph-free but clearly-attributed VFX/SFX burst (it is not
  telegraphed in advance, since it is a reaction, not a planned action) —
  the player must be able to tell the resulting damage/hazard came from
  "that enemy dying," not from an unexplained event.
- **Audio:** a single, consistent "telegraphs updated" stinger plays once
  at the end of the Telegraph Phase (shared with Turn & Phase Manager's
  environmental telegraphs, if any exist that turn) rather than one sound
  per enemy, to avoid audio clutter with a large enemy count.

## Acceptance Criteria

Pure, deterministic unit tests unless noted — no wall-clock time, no RNG,
no rendering. Default board `8×8` and default knob values unless stated.

**Ownership & contract methods (Rule 1, 9)**
- **GIVEN** the system's public interface, **THEN** it exposes exactly
  `chooseIntents()`, `resolveTelegraphed()`, `emergeSpawns()`, and no
  method that mutates board occupancy/terrain/hazard directly (all
  mutation is via `Combat.resolve()`).

**Target selection (Rule 5, Formula F1)**
- **GIVEN** an enemy and two heroes at equal Manhattan distance with
  `unitId` 1 and 2, **WHEN** `chooseIntents()` runs, **THEN** the hero with
  `unitId=1` is selected.
- **GIVEN** an enemy whose nearest target is unreachable within range but a
  farther target is reachable, **WHEN** `chooseIntents()` runs, **THEN**
  the enemy telegraphs `Idle` — the farther target is never selected.
- **GIVEN** zero living heroes, **WHEN** `chooseIntents()` runs, **THEN**
  the enemy telegraphs `Idle` with no error/crash.

**Movement-to-range (Rule 6, Formula F2)**
- **GIVEN** a target already within `attackRange`, **WHEN**
  `chooseIntents()` runs, **THEN** `telegraphedMoveDestination === null`.
- **GIVEN** an enemy fully enclosed by Blocked terrain with a target out of
  immediate range, **WHEN** `chooseIntents()` runs, **THEN** the enemy
  telegraphs `Idle`.
- **GIVEN** the worked Formula F2 example 1 setup, **WHEN**
  `chooseIntents()` runs, **THEN** `telegraphedMoveDestination === (5,3)`
  exactly.

**Telegraph data & timing (Rules 7, 8, 15; States)**
- **GIVEN** battle setup completes, **WHEN** queried before any player
  input, **THEN** every living enemy already has a non-`Idle`-or-`Idle`
  `Intent` recorded for Turn 1 (mirrors `turn-and-phase-manager.md`'s
  setup-telegraph requirement).
- **GIVEN** an `Intent` has been telegraphed for turn `n`, **WHEN** the
  board mutates during Player Phase (heroes move, abilities fire),
  **THEN** `telegraphedEffectTiles` and `telegraphedMoveDestination` on
  that stored `Intent` do not change — only the live re-query at Rule 9c
  (resolve time) can differ from what was telegraphed.
- **GIVEN** an enemy spawns during the Spawn Phase, **WHEN** the same
  turn's Telegraph Phase runs, **THEN** that enemy has a valid `Intent`
  recorded for the *next* turn, and it performed no move/attack action
  during the current turn's EnemyResolve (which already passed).

**Resolution execution (Rule 9, Formula F5)**
- **GIVEN** a telegraphed effect tile whose original occupant moved away
  before Resolve, **WHEN** `resolveTelegraphed()` runs, **THEN** the
  ability's chain resolves against that tile with no unit hit (documented
  no-op), and no error occurs.
- **GIVEN** a telegraphed effect tile whose occupant changed to a
  different unit (e.g. a hero swap), **WHEN** `resolveTelegraphed()` runs,
  **THEN** the effect applies to the **new** occupant by ID, not the
  originally-observed unit.
- **GIVEN** the Formula F5 worked example (Wall blocks the enemy's path),
  **WHEN** `resolveTelegraphed()` runs, **THEN** the enemy moves to
  `(6,5)`, no `damage`/`push`/etc. primitive is applied, and an
  `enemy_action_whiffed` event is emitted.
- **GIVEN** an enemy removed earlier this turn, **WHEN** its
  `resolveTelegraphed()` slot is reached, **THEN** it is skipped with no
  event beyond the earlier removal's own events.

**Deterministic order (Rule 4, Formula F4)**
- **GIVEN** enemies with `unitId` `4, 7, 2` alive, **WHEN**
  `chooseIntents()` or `resolveTelegraphed()` runs, **THEN** processing
  order is exactly `2, 4, 7`.
- **GIVEN** two enemies whose resolved pushes both target the same
  destination tile, **WHEN** `resolveTelegraphed()` runs, **THEN** the
  lower-`unitId` enemy's push resolves first and claims the tile,
  verified by swapping which enemy has the lower ID and observing the
  outcome change accordingly.

**Friendly fire (Rule 11)**
- **GIVEN** an enemy's AoE tile set contains both a hero and a second
  enemy, **WHEN** the ability resolves, **THEN** both units take the
  ability's effect identically — no faction filtering occurs.

**On-death effects (Rules 12–13, Formula F4 cascade invariant)**
- **GIVEN** an enemy with `onDeath` defined dies via `damage` (`Defeated`),
  **WHEN** the triggering `resolve()` call returns, **THEN** exactly one
  follow-up `resolve(board, onDeathEffects)` call fires immediately after,
  using the enemy's last-occupied tile as the effect anchor.
- **GIVEN** the same enemy instead dies via `push` into a Chasm (`Fell`)
  with the default `onDeath_trigger_causes = {Defeated, Fell}`, **THEN**
  its `onDeath` effect still fires identically.
- **GIVEN** `onDeath_trigger_causes` is set to `{Defeated}` only for a
  specific archetype, **WHEN** that archetype dies via `Fell`, **THEN**
  its `onDeath` effect does **not** fire.
- **GIVEN** two `onDeath`-bearing enemies both removed within one
  triggering chain, and enemy A's death radius would kill enemy B (also
  `onDeath`-bearing), **WHEN** follow-ups resolve, **THEN** A's follow-up
  fires first (removal order), which then queues B's follow-up, which
  fires after A's completes — no infinite loop, terminating within
  `enemyCount` steps.

**Spawning (Rules 14–16, States)**
- **GIVEN** a spawn scheduled onto a `Clear` spawn-point tile, **WHEN**
  `emergeSpawns()` runs, **THEN** a new enemy with a unique `unitId` and
  full `maxHP` is placed there, flagged unable to act this turn.
- **GIVEN** a spawn scheduled onto an `Occupied` spawn-point tile, **WHEN**
  `emergeSpawns()` runs, **THEN** the spawn is delayed (state `Delayed`)
  and no enemy is placed; it is retried at the next Spawn Phase.
- **GIVEN** a spawn has been delayed for `spawn_retry_cap` consecutive
  Spawn Phases, **WHEN** the next Spawn Phase runs regardless of
  occupancy, **THEN** emergence is forced with a collision consequence to
  the blocking occupant (boundary test: fires at exactly the cap count,
  not one before or after).
- **GIVEN** a spawn instruction is due next Spawn Phase, **WHEN** the
  current Telegraph Phase runs, **THEN** a `SpawnIntent` is present on
  that spawn-point tile.

### Performance Budget (headless TS benchmarks, decoupled from render)

| Operation | Budget | Note |
|-----------|--------|------|
| `chooseIntents()` for one enemy (F1 target select + F2 BFS + F3 shape) | < 0.5 ms | BFS is bounded by `moveRange` (≤6 typically) fanning out over Board & Grid's O(1) queries |
| `chooseIntents()` for a full battle's enemy roster (≤15 enemies, typical encounter) | < 5 ms | Runs once per Telegraph Phase, not per-frame — generous headroom |
| `resolveTelegraphed()` per enemy (movement re-path + gate + `Combat.resolve()` call) | < 1 ms | Dominated by Combat Resolution's own budgeted effect-chain cost |
| `onDeath` follow-up cascade (worst case: every enemy in a small encounter chain-triggers) | < 5 ms total | Bounded by `cascadeDepth ≤ enemyCount` (Formula F4 invariant) |

## Open Questions

**Needs an architecture decision (→ ADR during `/create-architecture`):**

1. **Unit Registry ownership.** Where HP, faction, and archetype data
   physically live is undecided (flagged in Dependencies above). This
   document provisionally assumes a shared registry it can write
   `faction: Enemy` entries into. *Owner:* Tech architecture, coordinated
   with Heroes & Abilities once designed.
2. **BFS reachability implementation ownership/reuse.** This document
   defines a BFS-based reachable-tile computation (Formula F2) for enemy
   movement. `board-and-grid.md`'s own Open Question #7 explicitly defers
   "reachability/flood-fill for legal movement" to "Combat Resolution / a
   future Movement system." Heroes & Abilities will need equivalent
   reachability logic for hero movement — this should very likely be a
   **shared** implementation (e.g. living in Combat Resolution or a small
   shared Movement utility) rather than two independently-authored BFS
   implementations that could silently diverge. *Owner:* flag for Heroes &
   Abilities' design session; resolve as an ADR before both exist
   independently.
3. **Event log schema for `enemy_action_whiffed` and on-death events.**
   Shares `combat-resolution.md`'s already-open Question #1 (event
   schema/versioning) — this document adds two new event names
   (`enemy_action_whiffed`, plus whatever the `onDeath` follow-up chain
   emits) that should be pinned in the same schema pass.

**Resolved this session (provisional defaults — confirm during
implementation):**

4. **No fallback targeting** (Rule 5) — deliberately chosen over
   retargeting to a reachable secondary target, for legibility. Revisit if
   playtesting shows too many enemies going permanently `Idle` in typical
   encounters (an Encounter Generator authoring concern, not a rule
   change).
5. **`onDeath` triggers on both `Defeated` and `Fell` by default** (Rule
   12) — chosen for consistency ("if it dies, it happens") over a
   cause-conditional model; per-archetype override exists as a knob for
   cases where "shove it into a pit to fully neutralize it" should be a
   rewarded, harder-to-execute play.
6. **Resolution order is spawn-order (`unitId` ascending), not an authored
   "initiative" stat** (Formula F4) — chosen to avoid introducing a second
   tunable ordering axis before either has been validated by play. An
   `initiative` stat remains a plausible future extension if spawn-order
   proves to feel arbitrary in practice (e.g., "the newest enemy should
   always act last" might read worse than an authored priority).
7. **Spawn-point deadlock resolution defaults to forced emergence with a
   collision consequence**, not spawn cancellation — chosen so a
   permanently-blocked spawn point can never silently remove content from
   an encounter (which would be an invisible, un-telegraphed change to the
   battle's difficulty).

**Deferred to the owning system's GDD:**

8. **Enemy archetype content (full roster, stat values, ability catalog
   beyond the three illustrative archetypes used here — Charger, Lobber,
   Broodmother).** This document defines the *schema* and *system*; the
   actual roster is content, owned by whichever process authors
   individual enemies (likely a `design/balance/` or `assets/data/`
   content pass, not a new GDD).
9. **Hazard catalog beyond Fire** — inherited directly from
   `combat-resolution.md`'s own deferred Open Question #6; enemy abilities
   that call `spawnHazard` with non-Fire types are provisional until that
   catalog exists.
10. **Encounter Generator's spawn-schedule authoring format** (how a
    battle template specifies "archetype X spawns at point Y on turn Z")
    is Encounter Generator's own concern; this document only defines the
    mechanical contract it must satisfy (Rule 14) once authored.
11. **Move Preview's exact overlay behavior** for "would I be hit if I
    stood here" is Move Preview's own design — this document only
    guarantees the `Intent` data it needs is available and stable within
    a Player Phase.
