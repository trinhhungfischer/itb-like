# Objective / Win-Lose

> **Status**: In Design
> **Author**: workflow (design-system fan-out)
> **Last Updated**: 2026-07-27
> **Implements Pillar**: #1 Perfect Information, Perfect Blame; #2 Positioning Over Power

## Overview

Objective / Win-Lose is the battle's **judge**: a single pure function,
`evaluate(battleState, turn, config) -> {Ongoing, Victory, Defeat}`, that answers "is
this battle still going, won, or lost?" from nothing but the current board
state, the current unit state, and the turn number. It owns the four v1
mission archetypes — **Survive N turns**, **Protect a target**, **Clear all
enemies**, **Reach a tile** — plus the one lose condition that applies no
matter which archetype is in play: a total party wipe. It also owns
`max_turns`, the per-encounter turn limit that either defines a Survive/
Protect mission's win trigger or acts as an optional deadline for Clear/
Reach missions. Objective never mutates the board, never queries other
systems, and never remembers anything between calls — it is asked the same
question, from scratch, up to four times a turn by Turn & Phase Manager, and
it must give the same answer every time it is asked with the same inputs.
This purity is what makes Pillar #1 (Perfect Information, Perfect Blame)
possible at the meta level of "did I win or lose, and why": the verdict is
never a special case, a race condition, or a hidden counter — it is always a
deterministic readout of the board the player can already see.

## Player Fantasy

Objective / Win-Lose has no direct player fantasy — like Board & Grid, Turn &
Phase Manager, and Combat Resolution, it is invisible infrastructure. What
the player *feels* when it works is **certainty about the stakes**: at every
moment, the player can look at the board and know exactly what they need to
protect, clear, reach, or survive, and exactly what would end the battle in
defeat right now. There is never a moment of "wait, did I actually lose?" or
"I thought clearing the enemies would win this" — the objective type is
legible before the first move is made, and the verdict that ends the battle
is always traceable to a fact the player could see on the board (Pillar #1).
This system is also where **Pillar #2 (Positioning Over Power)** becomes
mission-shaped: three of the four objective types (Survive, Protect, Reach)
can be won without dealing a point of damage — winning is about where units
are and staying alive, not about grinding enemies down. The failure state of
this system is an "unfair" loss: a defeat the player could not have
predicted from the board in front of them, or a victory/defeat call that
contradicts what the board visibly shows. Either would puncture the trust
Pillar #1 depends on.

## Detailed Design

### Core Rules

1. **The contract.** Objective exposes exactly one entry point:
   `evaluate(battleState, turn, config) -> EvaluationResult` (canonical
   parameter name `battleState`, per `cross-system-contracts.md` #4). It is
   **pure**: given the same `battleState`, `turn`, and `config`, it always
   returns the same `EvaluationResult`, with no side effects, no internal
   memory of prior calls, and no RNG. It is **state-poll** — Objective is
   asked, not told: there is no event subscription, no callback
   registration, and no listener setup; every answer is derived fresh from
   the arguments of that single call. It is **idempotent and re-entrant**:
   Turn & Phase Manager calls it up to **four times per turn** (three early
   checks + one terminal check, per `turn-and-phase-manager.md` Rule 7) and
   every call is a fresh, from-scratch evaluation — Objective does not know
   or care which of the four calls it is answering.
2. **`battleState` composition (this document's own shape is still a
   PROVISIONAL placeholder — see below).** `battleState = { board: Board,
   units: UnitRegistry }`. `board` is a Board & Grid instance (or its
   `snapshot()`) exposing occupancy, terrain, and flags per
   `board-and-grid.md`. `units` is a **Unit Registry** — a lookup of
   `unitId -> { faction: Hero | Enemy, alive: boolean, hp: int }` — assumed
   to belong to Heroes & Abilities ✅ and Enemy, Abilities & Telegraph ✅,
   both now **Designed**. `heroes-and-abilities.md` has since published the
   authoritative per-battle Unit record shape (its "Unit Record Schema
   (authoritative)" section), matching `cross-system-contracts.md` #6's
   canonical shape exactly (`{ id, team, archetype, maxHP, currentHP,
   position(tile), size(=1 v1), abilities[], hazardImmunities[],
   statusFlags[] }`, using `team` rather than `faction`, `maxHP`/`currentHP`
   rather than a single `hp`, and no explicit `alive` flag) — richer than
   this document's simplified `{faction, alive, hp}` stand-in. The registry
   entry `unit_record` still shows **status: pending**, reflecting that this
   document (and its formulas below) have not yet migrated to the canonical
   shape. This document's shape remains a **provisional placeholder** until
   the canonical `unit_record` is formally adopted here (Open Question 1) —
   it is assumed to be kept consistent with the board's occupancy by Combat
   Resolution's mutations (a unit removed via `removeUnit` has `alive ===
   false` and no board occupancy, by the same call).
3. **`ObjectiveConfig` is authored per encounter, not per call (interface
   still PROVISIONAL — field-naming reconciliation open).**
   `ObjectiveConfig = { type: Survive | Protect | Clear | Reach, max_turns:
   int | null, protectedUnitId?: UnitId, goalTile?: TileCoord }`. It is
   fixed for the whole battle at battle setup — Objective never mutates it
   and never re-derives `type` mid-battle. Authoring ownership belongs to
   the **Encounter Generator** ✅ (`encounter-generator.md`, now Designed),
   which assembles `EncounterDefinition.objective = {type, params,
   maxTurns}` at battle setup. That shape uses different field names than
   `ObjectiveConfig` above (`maxTurns` vs. `max_turns`; a generic `params`
   bag vs. this document's discrete `protectedUnitId`/`goalTile` fields) —
   this naming/shape reconciliation is still open (see Dependencies note
   and Open Questions). Objective's own contract only requires that a
   well-formed config is handed to it — see Edge Cases for what happens
   with a malformed one.
4. **Exactly one objective type per battle in v1.** The four types —
   **Survive**, **Protect**, **Clear**, **Reach** — are **mutually
   exclusive**: a battle is configured with exactly one `type`, never a
   combination. This is a deliberate v1 scope line (Pillar #5, Read in Ten
   Seconds: one objective, one HUD readout, no compound win-condition
   arithmetic for the player to track mid-battle). Composable objectives are
   a possible post-v1 extension (Open Questions).
5. **The universal lose predicate: party wipe.** Regardless of `type`, if
   zero **Hero**-faction units are `alive` in `battleState.units`, the
   battle is **Defeat** (Formula F1). This is evaluated on every call, for
   every type, with no opt-out — a wiped squad always loses, because a
   battle with no living heroes has no one left to achieve any objective
   (Pillar #1: the player must always be able to see this coming).
6. **Defeat takes precedence over Victory.** If a call's inputs satisfy both
   a defeat predicate and a victory predicate simultaneously, the result is
   **Defeat**. This precedence is enforced *inside* `evaluate()`'s own
   algorithm (Formula F7 checks every defeat predicate before any victory
   predicate) — it is not left for the caller to reconcile two independent
   booleans. This matches `turn-and-phase-manager.md`'s stated rule ("Defeat
   takes precedence over Victory") and guarantees `EvaluationResult` is
   always a single unambiguous status, never a contradictory pair.
7. **`max_turns` is owned here, and it means two different things depending
   on `type`.** For **Survive** and **Protect**, `max_turns` is the
   **win trigger**: reaching turn `max_turns` alive (and, for Protect, with
   the protected unit alive) IS the victory condition — it is a **required**,
   non-null, positive integer for these two types. For **Clear** and
   **Reach**, `max_turns` is an **optional deadline**: if set, failing to
   clear all enemies / reach the goal tile by turn `max_turns` is Defeat
   ("ran out of time"); if left `null`, there is no time pressure from
   Objective at all for these two types (only the party-wipe predicate, and
   for Protect the target-loss predicate, can end the battle early).
   `max_turns` is **distinct from** Turn & Phase Manager's `hard_turn_cap`
   (default 50) — that is a structural safety valve against a malformed
   encounter that never reaches a terminal state, not a designed mission
   mechanic; see `turn-and-phase-manager.md` Tuning Knobs.
8. **The `turn` argument is the caller's current turn counter**, 1-indexed,
   matching Turn & Phase Manager's `currentTurn` (per its Formula F1).
   Objective does not track its own turn count; every call must be given the
   turn number explicitly.
9. **`EvaluationResult` is a tri-state status plus a reason code.**
   `EvaluationResult = { status: Ongoing | Victory | Defeat, reason:
   ReasonCode }`. `status` is the single gameplay-affecting field Turn &
   Phase Manager acts on. `reason` (`PartyWiped`, `ProtectedUnitLost`,
   `TimeExpired`, `TurnLimitReached`, `AllEnemiesCleared`,
   `GoalTileReached`, or `None` when `status == Ongoing`) is
   **non-authoritative metadata** for HUD/telemetry — it never changes what
   the battle does, only what it displays.
10. **Objective type semantics (win/lose predicates per type)** — see States
    and Transitions for the full predicate table; summarized here:
    - **Survive**: Victory = reach `max_turns` alive. No enemy-clear
      requirement; clearing every enemy early does **not** end a Survive
      battle early (per `turn-and-phase-manager.md`'s own stated edge case
      — "a survive-N objective is not won just by clearing").
    - **Protect**: Victory = reach `max_turns` alive **and** with
      `protectedUnitId` alive. Losing the protected unit is Defeat
      immediately, independent of party wipe.
    - **Clear**: Victory = zero living Enemy-faction units remain. No
      turn trigger unless `max_turns` is set as a deadline.
    - **Reach**: Victory = a living **Hero**-faction unit currently occupies
      `goalTile` at the moment of the check. No turn trigger unless
      `max_turns` is set as a deadline.
11. **Objective validates nothing about board legality.** It does not check
    whether `goalTile` is reachable, whether `protectedUnitId` was ever
    placed, or whether `max_turns` is sane for the encounter's pacing — that
    is content-authoring validation, owned by whichever system authors
    `ObjectiveConfig` (Encounter Generator ✅). Objective's
    contract assumes a well-formed config; see Edge Cases for the exact,
    non-graceful behavior when that assumption is violated.

### States and Transitions

**Battle-level verdict lifecycle:** `Ongoing → Victory` (terminal) or
`Ongoing → Defeat` (terminal). There is no `Victory/Defeat → Ongoing`
transition — once Turn & Phase Manager acts on a terminal `EvaluationResult`,
the battle has ended and further `evaluate()` calls are moot (Objective does
not know or enforce this; "battle has ended" is Turn & Phase Manager's state,
not Objective's).

**Per-type predicate table** (`H` = alive Hero-faction units, `E` = alive
Enemy-faction units, `pu` = the unit at `protectedUnitId`, `gt` = the unit
currently occupying `goalTile`):

| Type | Victory predicate | Type-specific Defeat predicate | Universal Defeat predicate |
|------|--------------------|----------------------------------|------------------------------|
| **Survive** | `turn ≥ max_turns` | — (none beyond universal) | `count(H) == 0` |
| **Protect** | `turn ≥ max_turns` (evaluated only once the type-specific defeat predicate is false) | `pu.alive == false` | `count(H) == 0` |
| **Clear** | `count(E) == 0` | `max_turns != null AND turn ≥ max_turns AND count(E) > 0` | `count(H) == 0` |
| **Reach** | `gt exists AND gt.faction == Hero AND gt.alive` | `max_turns != null AND turn ≥ max_turns AND NOT (victory predicate)` | `count(H) == 0` |

Every row's **Defeat** result (universal or type-specific) is checked before
its **Victory** predicate — Rule 6's precedence, applied uniformly.

**Reason-code mapping** (informational only, per Rule 9):

| Trigger | `status` | `reason` |
|---------|----------|----------|
| `count(H) == 0` | Defeat | `PartyWiped` |
| Protect, `pu.alive == false` | Defeat | `ProtectedUnitLost` |
| Clear/Reach, deadline exceeded | Defeat | `TimeExpired` |
| Survive/Protect, `turn ≥ max_turns`, no defeat predicate true | Victory | `TurnLimitReached` |
| Clear, `count(E) == 0` | Victory | `AllEnemiesCleared` |
| Reach, goal tile occupied by a living Hero | Victory | `GoalTileReached` |
| None of the above | Ongoing | `None` |

### Interactions with Other Systems

Objective is a **pure predicate service**: other systems feed it state and
turn number; it never initiates action, mutates anything, or calls back into
another system.

| System | Reads from Objective | Provides to Objective | Ownership boundary |
|--------|----------------------|--------------------------|---------------------|
| **Turn & Phase Manager** ✅ | `evaluate()`'s `EvaluationResult`, up to 4×/turn (3 early — acts on `status==Defeat` only, per its own Rule 7 — + 1 terminal — acts on both `Victory` and `Defeat`) | the current `turn` number; the current `battleState` | Manager owns *when* to call and *which fields to act on*; Objective owns the predicate logic only |
| **Board & Grid** ✅ | — | `objective`/goal-tile flags, occupancy, via `battleState.board` (per `board-and-grid.md`'s Dependencies row for this system) | Objective is a read-only consumer of Board's query API |
| **Combat Resolution** ✅ | — | the board/unit mutations it applies (HP loss, `removeUnit`, position changes) are what `battleState` reflects by the time Objective is called | **Clarifies a divergence with `combat-resolution.md`'s Dependencies table**, which describes Objective as reading Combat's *emitted event stream*. This GDD's authoritative contract is **state-based polling** (`battleState`), not event consumption — required for Rule 1's purity/idempotency guarantee (an event-log replay would make repeated same-input calls path-dependent). The event log remains available as an *optional* secondary source for reason-code enrichment, never for the core `status` determination. Flagged for `/consistency-check`. |
| **Heroes & Abilities** ✅ | — | owns Hero-faction unit definitions feeding `battleState.units`; its own Dependencies table describes this as an indirect read of Combat Resolution's `unit_removed` event log rather than this document's state-poll contract — same divergence flagged for Combat Resolution below | Hard |
| **Enemy, Abilities & Telegraph** ✅ | — | owns Enemy-faction unit definitions feeding `battleState.units`; its own Dependencies table likewise describes an event-log read (`unit_removed` + a live-enemy-count query) rather than this document's state-poll contract — same divergence | Hard |
| **Encounter Generator** ✅ | — | authors the per-battle `ObjectiveConfig` (`type`, `max_turns`, `protectedUnitId`/`goalTile`) at battle setup; its solver's headless Turn & Phase Manager instance calls this document's `evaluate(battleState, turn, config)` directly, confirming the contract | Hard |
| **Battle HUD** ✅ | `status` + `reason` + type-specific progress (turns remaining, enemies remaining, protected-unit HP, goal-tile distance) | — | Read-only consumer — confirmed in `battle-hud.md`'s own Dependencies table |
| **Run Structure / Node Map** ✅ | the terminal `EvaluationResult` (`Victory`/`Defeat`), read **indirectly via Turn & Phase Manager's `battle_ended` event** (per `cross-system-contracts.md` #10), not a direct call into this document | — | Read-only consumer; routes run progression or ends the run — confirmed in `run-structure-node-map.md`'s own Dependencies table |
| **Board Rendering & Juice** ✅ | terminal `status` (proposed, for victory/defeat board-wide VFX) | — | **Open item**: `board-rendering-and-juice.md`'s own Dependencies table does not currently list Objective / Win-Lose as an upstream dependency — flagged for `/consistency-check` |
| **Audio System** ✅ | terminal `status`, read via Turn & Phase Manager's `battle_ended(result)` event (for win/lose stingers) | — | Read-only, soft — confirmed in `audio-system.md`'s own Dependencies table |

> **Reconciliation status:** all seven dependency systems listed above are
> now Designed (systems-index.md #4, #5, #9, #10, #12, #13, #20). Two open
> items remain, both already flagged for `/consistency-check`: (1) Heroes &
> Abilities and Enemy, Abilities & Telegraph both describe reading
> Objective's data via Combat Resolution's event log rather than this
> document's state-poll contract — the same divergence already noted for
> Combat Resolution itself; and (2) Board Rendering & Juice's own
> Dependencies table does not yet list Objective / Win-Lose as an upstream
> dependency.

## Formulas

All formulas are deterministic (no RNG, no time-dependence). `battleState`
and `turn` are as defined in Core Rules 1–2.

### F1. Party-wipe predicate (universal lose condition)

`partyWiped(units) = (count(u ∈ units : u.faction == Hero ∧ u.alive) == 0)`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|--------------|
| unit registry | `units` | map | ≥0 entries | All units known to the battle, hero and enemy |
| faction | `u.faction` | enum | `{Hero, Enemy}` | v1 supports exactly two factions |
| alive flag | `u.alive` | bool | — | `false` once `removeUnit` has fired for that unit (Combat Resolution) |

**Output:** bool. **Example:** 3 heroes placed, 2 `removeUnit`'d →
`count(alive Hero)=1` → `partyWiped=false`. All 3 removed →
`partyWiped=true`.

### F2. Turn-cap trigger

`turnCapReached(turn, max_turns) = (max_turns ≠ null) ∧ (turn ≥ max_turns)`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|--------------|
| current turn | `turn` | int | ≥1 | Supplied by Turn & Phase Manager |
| turn limit | `max_turns` | int \| null | ≥1 or unset | Required for Survive/Protect; optional deadline for Clear/Reach |

**Output:** bool. **Example:** `max_turns=6`, checked at `turn=6` →
`true` (the boundary is inclusive: completing turn 6's terminal check with
the type's other conditions satisfied IS "having survived 6 turns"; `turn=5`
→ `false`).

### F3. Enemies-remaining count

`enemiesRemaining(units) = count(u ∈ units : u.faction == Enemy ∧ u.alive)`

**Output:** int, `[0, totalEnemiesEverSpawned]`. **Example:** 5 enemies
spawned across the battle (including mid-battle Spawn-phase arrivals), 5
`removeUnit`'d → `enemiesRemaining=0`.

### F4. Clear-type victory predicate

`clearVictory(units) = (enemiesRemaining(units) == 0)`

**Output:** bool. Combined with F1 per the master algorithm (F7) — F4 alone
does not account for a simultaneous party wipe; F7 does.

### F5. Goal-tile occupancy predicate (Reach type)

`goalReached(board, units, goalTile) = isOccupied(board, goalTile) ∧
units[getOccupant(board, goalTile)].faction == Hero ∧
units[getOccupant(board, goalTile)].alive == true`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|--------------|
| goal tile | `goalTile` | coord | valid, in-bounds tile | Set once in `ObjectiveConfig` |
| occupant lookup | `getOccupant` | Board & Grid query | — | Per `board-and-grid.md`'s query API |

**Output:** bool. Board & Grid's one-occupant-per-tile invariant means at
most one unit can satisfy this at a time — no aggregation across multiple
occupants is possible or needed. **Example:** goal tile `(6,1)` occupied by
a living hero → `true`; occupied by a living enemy → `false` (faction check
fails); unoccupied → `false` (`isOccupied` fails first).

### F6. Protected-unit-lost predicate (Protect type)

`protectedUnitLost(units, protectedUnitId) = (units[protectedUnitId] ==
undefined) ∨ (units[protectedUnitId].alive == false)`

**Output:** bool. A missing registry entry (never placed, or a config typo)
is treated identically to "removed" — see Edge Cases. **Example:**
`protectedUnitId` present with `alive=true` → `false` (not lost);
`removeUnit` fired for it earlier in the battle → `true`.

### F7. Master evaluation algorithm (composition + precedence)

```
evaluate(battleState, turn, config) -> EvaluationResult:
  # 1. Universal defeat predicate — checked for every type, always first.
  if partyWiped(battleState.units):
    return { status: Defeat, reason: PartyWiped }

  # 2. Type-specific defeat predicates — checked before any victory check.
  if config.type == Protect and protectedUnitLost(battleState.units, config.protectedUnitId):
    return { status: Defeat, reason: ProtectedUnitLost }

  if config.type in {Clear, Reach}:
    typeVictory = (config.type == Clear)
        ? clearVictory(battleState.units)
        : goalReached(battleState.board, battleState.units, config.goalTile)
    if turnCapReached(turn, config.max_turns) and not typeVictory:
      return { status: Defeat, reason: TimeExpired }

  # 3. Victory predicates — only reached if no defeat predicate fired.
  switch config.type:
    Survive:
      if turnCapReached(turn, config.max_turns):
        return { status: Victory, reason: TurnLimitReached }
    Protect:
      if turnCapReached(turn, config.max_turns):
        return { status: Victory, reason: TurnLimitReached }
    Clear:
      if clearVictory(battleState.units):
        return { status: Victory, reason: AllEnemiesCleared }
    Reach:
      if goalReached(battleState.board, battleState.units, config.goalTile):
        return { status: Victory, reason: GoalTileReached }

  # 4. Nothing resolved — battle continues.
  return { status: Ongoing, reason: None }
```

**Output range:** exactly one of `{Ongoing, Victory, Defeat}` — never both,
never neither. **Worked example (Protect):** `config = {type: Protect,
max_turns: 8, protectedUnitId: 'vip_1'}`. At `turn=5`, 2 of 3 heroes alive
(`squad_size` = 3),
`vip_1.alive=true` → `partyWiped=false`, `protectedUnitLost=false`,
`turnCapReached(5,8)=false` → falls through every branch →
`{status: Ongoing, reason: None}`. At `turn=8`, same units still alive →
`turnCapReached(8,8)=true` → `{status: Victory, reason: TurnLimitReached}`.
If instead `vip_1` had been removed at turn 6, every subsequent call from
turn 6 onward returns `{status: Defeat, reason: ProtectedUnitLost}`
regardless of `turn`.

## Edge Cases

- **Battle starts with zero living heroes (misconfigured encounter/setup
  bug):** `partyWiped` is true on the very first `evaluate()` call (the
  early check after Turn 1's Environment phase) → **Defeat, reason
  `PartyWiped`, battle ends on Turn 1** before the player takes a
  meaningful action. This is a content/setup bug guard, not a designed
  gameplay path.
- **Clear-type battle starts with zero enemies (misconfigured
  encounter):** `clearVictory` is already true and no defeat predicate is
  true → the battle plays a full Turn 1 (with all enemy phases running as
  no-ops per `turn-and-phase-manager.md`'s "no enemies" edge case), and
  **Victory, reason `AllEnemiesCleared`, fires at Turn 1's terminal End
  Check** — not earlier, because victory is only decided at the terminal
  check (Rule 1).
- **Survive/Protect config with `max_turns == null`:** invalid config.
  `turnCapReached` would never fire, meaning the type's only victory
  predicate is permanently unreachable — this is **not** silently tolerated
  as "an unwinnable-by-design battle"; it is treated as a content-authoring
  error. Config well-formedness (Survive/Protect require a positive
  `max_turns`) is validated at battle setup, before `evaluate()` is ever
  called — Objective's own contract assumes it is never handed such a
  config (see Dependencies / Encounter Generator).
- **Clear/Reach config with `max_turns == null`:** valid and intentional —
  no deadline; the battle runs until cleared/reached, party-wiped, or (for
  Protect only) target-lost, with Turn & Phase Manager's `hard_turn_cap`
  (default 50) as the only remaining backstop, per that system's own
  documented safety-valve behavior.
- **`turn < 1` supplied to `evaluate()`:** rejected as a contract violation
  (assert), not a graceful runtime path — Turn & Phase Manager's
  `currentTurn` is defined to start at 1 and only increase; a caller
  supplying an invalid turn number is a programmer error, matching this
  project's convention for invalid inputs (e.g. `combat-resolution.md`'s
  `damage(amount < 0)`).
- **`max_turns` supplied as `0` or negative:** invalid config, rejected at
  the same authoring-time validation step as the missing-`max_turns` case
  above — never reaches `evaluate()` as a live value.
- **`protectedUnitId` references a unit that was never placed on the board
  (bad config):** `units[protectedUnitId]` is `undefined`, and Formula F6
  treats a missing registry entry identically to "removed" —
  **`protectedUnitLost` is true from the first call**, producing an
  immediate Defeat at Turn 1. This is a content bug guard (should be caught
  by Encounter Generator validation before battle start), not a special
  runtime case Objective handles gracefully.
- **`goalTile` is authored on unreachable, Blocked, or Chasm terrain (bad
  authoring):** Objective does not validate reachability — that is Board &
  Grid / Encounter Generator's authoring-time concern. `goalReached` simply
  checks occupancy; if the tile can truly never be legally occupied, the
  battle runs until Turn & Phase Manager's `hard_turn_cap` safety valve
  force-ends it as Defeat. No special-case handling exists in this system
  for that scenario.
- **An enemy unit occupies the Reach `goalTile`:** `goalReached` is `false`
  — the faction check in Formula F5 explicitly requires the occupant be
  Hero-faction and alive. An enemy standing on the goal tile never
  satisfies victory, by design (prevents an accidental "the enemy AI walked
  onto my objective and won the game for me" outcome).
- **A hero is involuntarily pushed onto the Reach `goalTile` by an enemy or
  hazard effect (not a deliberate player move):** still counts as Victory
  at the next terminal check where that hero remains present. `goalReached`
  is purely state-based — it has no concept of *how* the occupant arrived,
  consistent with Rule 1's pure, state-only contract.
- **A hero reaches the goal tile mid-Player-Phase, then is pushed off it
  again before the turn's terminal End Check** (e.g. by an Environment or
  Enemy Resolve effect later the same turn): no victory fires that turn —
  `goalReached` is evaluated fresh at the terminal check and the hero is no
  longer there. The player may return to the tile on a later turn; there is
  no "victory was already earned" memory (Rule 1: no internal state between
  calls).
- **Both the universal party-wipe predicate and a type's victory predicate
  are true in the same call** (e.g. a spreading Environment-phase hazard
  kills the last hero and the last enemy in the same tick, satisfying both
  `partyWiped` and `clearVictory`): Formula F7 checks defeat predicates
  first — the result is **Defeat, reason `PartyWiped`**, never Victory.
  This is Rule 6's precedence, structurally guaranteed by evaluation order,
  not an arbitrary tie-break.
- **`evaluate()` is called before Turn 1's Player Phase has ever run** (an
  early defeat check can, in principle, be invoked immediately after Turn
  1's Environment phase with `turn=1`): fully valid — the function is total
  over its documented input domain and returns whatever the current
  `battleState` implies (`Ongoing` in the normal case, or an immediate
  Defeat if a setup bug left zero heroes alive, per the first edge case
  above).
- **`battleState.units` and `battleState.board` occupancy briefly disagree**
  (e.g. a hypothetical bug where `removeUnit` clears board occupancy but the
  external Unit Registry entry lags behind): **PROVISIONAL** — Objective
  assumes `battleState` is always internally consistent at the moment it is
  called, because Turn & Phase Manager only invokes `evaluate()` between
  phases, never mid-`resolve()`. This is a sequencing contract with Combat
  Resolution / Turn & Phase Manager, not a case Objective defends against
  itself.
- **A battle is configured with an objective `type` value outside the four
  defined enum members** (a future/typo'd type): rejected as an invalid
  config at authoring time, identically to the missing-`max_turns` case —
  `evaluate()`'s contract assumes `config.type` is always one of the four
  documented values.

## Dependencies

**Upstream (Objective depends on — for input data, not necessarily control
flow; see the Combat Resolution row for why data-dependency and
call-direction differ here):**

| System | Interface | Hard / Soft |
|--------|-----------|--------------|
| **Board & Grid** ✅ | `objective`/goal-tile flags, occupancy, via `battleState.board`'s query API (`isOccupied`, `getOccupant`) | **Hard** |
| **Combat Resolution** ✅ | Objective reads the *result* of Combat Resolution's mutations (HP loss, `removeUnit`, repositioning) via `battleState`, not its call chain or event stream directly | **Hard** (data dependency; see the Interactions table's clarification of `combat-resolution.md`'s event-stream description) |
| **Turn & Phase Manager** ✅ | Supplies the `turn` integer and the current `battleState` on each call; Objective has no dependency on the manager's internal phase machinery beyond that one argument | **Hard** (control-flow inversion: the manager calls Objective, but Objective still depends on the `turn` value the manager produces) |
| **Heroes & Abilities** ✅ | Owns Hero-faction unit definitions (`faction`, `hp`, `alive`) feeding `battleState.units`; canonical shape is `cross-system-contracts.md` #6's `unit_record` (registry status: pending until formally cross-adopted here — Open Question 1) | **Hard** |
| **Enemy, Abilities & Telegraph** ✅ | Owns Enemy-faction unit definitions feeding `battleState.units`, same `unit_record` shape | **Hard** |
| **Encounter Generator** ✅ | Authors the per-battle `ObjectiveConfig` (`type`, `max_turns`, `protectedUnitId`/`goalTile`) at battle setup and is responsible for its well-formedness (Edge Cases); its solver calls this document's `evaluate(battleState, turn, config)` directly | **Hard** |

**Downstream (systems that depend on Objective's verdict):**

| System | Interface | Hard / Soft |
|--------|-----------|--------------|
| **Turn & Phase Manager** ✅ | Calls `evaluate(battleState, turn, config) -> EvaluationResult` up to 4×/turn; acts on `status` per its own early-check-vs-terminal-check rules | **Hard** |
| **Battle HUD** ✅ | `status`, `reason`, and type-specific progress figures (turns remaining, enemies remaining, protected-unit HP, goal-tile occupancy) for an objective tracker + win/lose banner | **Hard** — confirmed in `battle-hud.md`'s own Dependencies table |
| **Run Structure / Node Map** ✅ | The terminal `EvaluationResult` to route run progression (advance the node map) or end the run (on Defeat), read indirectly via Turn & Phase Manager's `battle_ended` event | **Hard** — confirmed in `run-structure-node-map.md`'s own Dependencies table |
| **Board Rendering & Juice** ✅ | Terminal `status` for victory/defeat board-wide VFX (proposed) | **Soft — open item**: not yet listed in `board-rendering-and-juice.md`'s own Dependencies table; flagged for `/consistency-check` |
| **Audio System** ✅ | Terminal `status`, read via Turn & Phase Manager's `battle_ended(result)` event, for win/lose musical stingers | **Soft** — confirmed in `audio-system.md`'s own Dependencies table |

**Bidirectional-consistency note:** `systems-index.md`'s row 7 already lists
Objective / Win-Lose's dependencies as "Turn & Phase Manager, Combat
Resolution" — consistent with the Upstream table above (framed as data
dependencies co-existing with the "the manager calls Objective" control-flow
inversion already established by `turn-and-phase-manager.md`'s "Driven via
contract" pattern). `board-and-grid.md` already lists Objective / Win-Lose
as a Hard dependent (reads `objective` flags & occupancy of objective
tiles) — consistent. `turn-and-phase-manager.md` already lists Objective's
`evaluate(battleState, turn, config) → EvaluationResult` contract as a
"Driven via contract" Hard dependency and states "Early checks evaluate the
lose predicate only" — consistent with this document's Rule 1 and the
Interactions table's clarification of how that filtering is applied (by the
manager, not inside Objective). `combat-resolution.md` lists Objective /
Win-Lose as reading its emitted event stream (`unit_removed`,
`damage_applied`, …) — **this document refines that contract**: the
authoritative, purity-preserving mechanism is state-based polling via
`battleState`, with the event log demoted to optional reason-code metadata.
Flag this refinement for `/consistency-check` against `combat-resolution.md`
(and, by the same divergence, against `heroes-and-abilities.md` and
`enemy-abilities-and-telegraph.md`, which also describe an event-log read
rather than state polling). Heroes & Abilities, Enemy, Abilities &
Telegraph, Encounter Generator, Battle HUD, Run Structure / Node Map, Board
Rendering & Juice, and Audio System are now all Designed and each lists
Objective / Win-Lose per the interfaces above, with two remaining open
items: the event-stream-vs-state-poll divergence just noted, and Board
Rendering & Juice not yet listing Objective / Win-Lose in its own
Dependencies table (see Interactions table above) — both flagged for
`/consistency-check`.

## Tuning Knobs

| Knob | Default | Safe Range | Category | Too Low | Too High |
|------|---------|-----------|----------|---------|----------|
| `max_turns` (per encounter) | none (required for Survive/Protect; `null` for Clear/Reach) | 1–50 (bounded above by `hard_turn_cap`'s default; higher requires raising that knob too) | Gate | Too few turns on a Survive/Protect mission ends the puzzle before the player can execute a multi-turn plan, undermining the "read → plan → act" loop; too tight a Clear/Reach deadline turns a positioning puzzle into a race, diluting Pillar #2 | Too high on Survive/Protect makes the mission feel padded/directionless (no sense of an approaching finish line); too high a Clear/Reach deadline makes the deadline meaningless flavor text with no real stakes |
| `reach_goal_faction_filter` | `HeroOnly` | `{HeroOnly, AnyFaction}` | Gate | N/A (only two values) | Setting `AnyFaction` risks a design mistake where an enemy or a future neutral unit satisfies a Reach objective unintentionally (see Edge Cases); reserve `AnyFaction` only for a deliberately-designed escort/ally-unit mission variant, not as a default |
| `deadline_mode` (Clear/Reach only, applies when `max_turns` is set) | `Hard` | `{Hard, Informational}` | Gate | N/A | `Informational` mode (deadline shown in HUD but does not trigger Defeat) removes the actual stakes behind a displayed countdown, which risks reading as a broken/lying HUD element if not clearly labeled — use deliberately, not as a silent default override |
| `protected_unit_scope` (Protect only) | `HeroOnly` | `{HeroOnly, AnyFaction}` | Gate | N/A | **PROVISIONAL** — v1 has no neutral/escort faction defined; `AnyFaction` is a placeholder for a future third faction (Heroes & Abilities/Enemy Abilities own faction definitions). Setting this before a third faction exists has no effect beyond `HeroOnly` |

**Interactions between knobs:**
- `max_turns` and Turn & Phase Manager's `hard_turn_cap` (default 50, safe
  range 20–200) must satisfy `max_turns ≤ hard_turn_cap` for any
  Survive/Protect mission or any Clear/Reach mission with a `Hard`
  deadline — otherwise the safety-valve Defeat fires *before* the
  authored mission length is ever reached, silently truncating the
  intended design. Encounter Generator (when authored) should validate
  this inequality at authoring time.
- `deadline_mode=Informational` combined with `reach_goal_faction_filter`
  or `protected_unit_scope` has no direct interaction — they are
  independent per-type knobs — but changing `deadline_mode` without
  updating the HUD's countdown display risks a display that implies
  stakes that no longer exist; this is a Battle HUD design concern, not an
  Objective one.

**Intentionally NOT knobs here** (structural, matching the "fixed adjacency
mode" / "fixed phase order" convention from `board-and-grid.md` and
`turn-and-phase-manager.md`):
- **Defeat-over-Victory precedence** (Rule 6) is a fixed evaluation order,
  not configurable — exposing it as a toggle would let a setting silently
  create a "both true, Victory wins" state that contradicts every other
  system's stated Defeat-precedence rule.
- **The universal party-wipe lose predicate** (Rule 5) always applies to
  every objective type — there is no knob to disable it, because a
  Pillar #1-legible battle can never allow "you have zero living heroes but
  the battle continues" as a state.
- **Objective-type mutual exclusivity** (Rule 4, v1) — a battle has exactly
  one `type`; this is a v1 scope decision, not a tunable value (see Open
  Questions for the deferred composability question).

## Visual/Audio Requirements

Full visual and audio design is deferred to `art-director` / `audio-director`
(via `/art-bible` and a future Audio System GDD). This system's contribution
to that design is the **interface it exposes**, not the presentation itself:

- `EvaluationResult.status` (`Ongoing`/`Victory`/`Defeat`) is the sole
  trigger for any win/lose banner, board-wide VFX, or musical stinger —
  triggered exactly once, at the terminal call where `status` first becomes
  non-`Ongoing` (Turn & Phase Manager's `battle_ended` event, per
  `turn-and-phase-manager.md`).
- `EvaluationResult.reason` should be legible to the player in some form
  (e.g. "Protected unit lost" vs. "Party wiped" read differently), since
  Pillar #1 requires the player understand *why* a battle ended, not just
  *that* it ended.
- Type-specific progress values (turns remaining via Formula F2's inverse,
  `enemiesRemaining` via F3, protected-unit HP, goal-tile distance) should
  be continuously readable during play, not only at battle end — this
  informs a persistent HUD element (see UI Requirements) but the specific
  treatment (icon, color, animation) is not decided here.

## UI Requirements

Full UI design is deferred to `ux-designer` (via `/ux-design` for
`design/ux/hud.md`). This system's contribution is the data contract:

- Battle HUD needs a persistent **objective tracker** whose displayed
  content varies by `type`: a turn counter for Survive/Protect, a living-
  enemy counter for Clear, and a goal-tile indicator (e.g. a ping or
  distance readout) for Reach. Protect additionally needs the protected
  unit's HP/status visible at all times (Pillar #1 — the player must see
  the threat to their objective coming, not just its loss after the fact).
- A near-loss warning state (e.g. protected unit critically low, or
  approaching a Clear/Reach deadline) is a strong candidate for explicit UI
  treatment, but the exact threshold and presentation are UX decisions, not
  specified here.
- The win/lose banner triggered by a terminal `EvaluationResult` should
  surface `reason` in player-facing language, not just the raw enum.

## Acceptance Criteria

Pure, deterministic unit tests — no wall-clock time, no RNG, no rendering.
The harness constructs a `battleState` (real or fake Board & Grid + a plain
Unit Registry map) and an `ObjectiveConfig`, then calls `evaluate()` directly.

**Purity & idempotency (Rule 1)**
- **GIVEN** identical `(battleState, turn, config)` inputs, **WHEN**
  `evaluate()` is called any number of times in any order relative to other
  calls, **THEN** every call returns an identical `EvaluationResult`.
- **GIVEN** an `evaluate()` call, **WHEN** it returns, **THEN** no field of
  `battleState` (board or units) has changed as a result of the call.

**Universal party-wipe predicate (Rule 5, Formula F1)**
- **GIVEN** any `config.type`, **WHEN** all Hero-faction units have
  `alive==false`, **THEN** `evaluate()` returns `{status: Defeat, reason:
  PartyWiped}` regardless of the state of enemies, the protected unit, the
  goal tile, or `turn`.
- **GIVEN** at least one Hero-faction unit with `alive==true`, **THEN**
  the party-wipe predicate alone never produces Defeat.

**Defeat precedence (Rule 6, Formula F7)**
- **GIVEN** a `battleState` where both `partyWiped` and a type's victory
  predicate are simultaneously true, **WHEN** `evaluate()` is called,
  **THEN** the result is `{status: Defeat, reason: PartyWiped}`, never
  Victory.

**Survive type (Rules 7, 10; States table)**
- **GIVEN** `config = {type: Survive, max_turns: 5}`, **WHEN** called at
  `turn=4` with heroes alive, **THEN** `{status: Ongoing}`.
- **GIVEN** the same config, **WHEN** called at `turn=5` with heroes alive,
  **THEN** `{status: Victory, reason: TurnLimitReached}`.
- **GIVEN** the same config, **WHEN** all enemies are removed at `turn=2`
  but heroes remain alive, **THEN** `evaluate()` still returns
  `{status: Ongoing}` at `turn=2` and `turn=3` — clearing enemies early does
  not trigger Victory for a Survive objective.

**Protect type (Rules 7, 10; Formula F6)**
- **GIVEN** `config = {type: Protect, max_turns: 6, protectedUnitId:
  'vip'}`, **WHEN** `vip.alive==false` at `turn=3`, **THEN**
  `{status: Defeat, reason: ProtectedUnitLost}` — independent of the party
  being far from wiped.
- **GIVEN** the same config, **WHEN** `vip.alive==true` at `turn=6` and no
  defeat predicate is true, **THEN** `{status: Victory, reason:
  TurnLimitReached}`.
- **GIVEN** `protectedUnitId` referencing a unit absent from the registry,
  **WHEN** `evaluate()` is called at any `turn`, **THEN** `{status: Defeat,
  reason: ProtectedUnitLost}` (Formula F6's `undefined`-treated-as-lost
  case).

**Clear type (Rules 7, 10; Formula F4)**
- **GIVEN** `config = {type: Clear, max_turns: null}`, **WHEN** at least
  one Enemy-faction unit is alive, **THEN** `{status: Ongoing}` (unless
  party wipe applies).
- **GIVEN** the same config, **WHEN** `enemiesRemaining==0`, **THEN**
  `{status: Victory, reason: AllEnemiesCleared}`.
- **GIVEN** `config = {type: Clear, max_turns: 5}`, **WHEN** called at
  `turn=5` with `enemiesRemaining>0`, **THEN** `{status: Defeat, reason:
  TimeExpired}`.
- **GIVEN** the same deadline config, **WHEN** `enemiesRemaining==0` is
  reached at exactly `turn=5`, **THEN** `{status: Victory, reason:
  AllEnemiesCleared}` — victory is checked before the deadline can fire
  against an already-won state (Formula F7's ordering: `typeVictory` is
  computed before the deadline defeat check).

**Reach type (Rules 7, 10; Formula F5)**
- **GIVEN** `config = {type: Reach, goalTile: (6,1), max_turns: null}`,
  **WHEN** `(6,1)` is occupied by a living Hero-faction unit, **THEN**
  `{status: Victory, reason: GoalTileReached}`.
- **GIVEN** the same config, **WHEN** `(6,1)` is occupied by a living
  Enemy-faction unit, **THEN** `{status: Ongoing}` — an enemy occupying the
  goal tile never satisfies Reach victory.
- **GIVEN** the same config, **WHEN** `(6,1)` is unoccupied, **THEN**
  `{status: Ongoing}`.
- **GIVEN** `config = {type: Reach, goalTile: (6,1), max_turns: 4}`,
  **WHEN** called at `turn=4` with `(6,1)` still unoccupied by a living
  hero, **THEN** `{status: Defeat, reason: TimeExpired}`.
- **GIVEN** a hero occupies `(6,1)` at `turn=2` (via Player Phase movement)
  but is displaced off it before that turn's terminal check, **WHEN**
  `evaluate()` is called at the terminal check, **THEN** `{status:
  Ongoing}` — no memory of the earlier mid-turn occupancy persists.

**Input validation (Rule 8, Edge Cases)**
- **GIVEN** `turn < 1`, **WHEN** `evaluate()` is called, **THEN** the call
  is rejected (assertion/contract violation), not silently coerced.
- **GIVEN** `config.max_turns ≤ 0` for any type, **WHEN** validated at
  config-authoring time, **THEN** the config is rejected before any battle
  using it can start.
- **GIVEN** `config.type == Survive` or `Protect` with `config.max_turns ==
  null`, **WHEN** validated at config-authoring time, **THEN** the config
  is rejected (required field missing for these two types).

**Reason-code correctness (Rule 9, States table)**
- **GIVEN** each of the six non-`None` trigger conditions in the
  Reason-code mapping table, **WHEN** `evaluate()` returns a terminal
  `status`, **THEN** `reason` exactly matches the table's mapping for that
  trigger (six cases, each independently testable).

### Performance Budget (headless TS benchmarks, decoupled from render)

| Operation | Budget | Note |
|-----------|--------|------|
| Single `evaluate()` call (any type, default 8×8 board, ≤20 units) | avg < 0.05 ms/call | Dominated by a linear scan of `battleState.units`; called up to 4×/turn |
| Full turn's worth of `evaluate()` calls (4 calls) | < 0.2 ms combined | Negligible relative to Board & Grid's `snapshot()` budget (<1 ms) and Combat Resolution's per-action budget (<1 ms) |

## Open Questions

**Needs an architecture decision (→ ADR during `/create-architecture`):**

1. **Unit Registry ownership and exact schema.** `battleState.units` is
   assumed to be `{unitId -> {faction, alive, hp}}`, owned jointly by
   Heroes & Abilities and Enemy, Abilities & Telegraph once designed. Pin
   the exact schema (does it live on `Board` itself, or as a separate
   registry object passed alongside it?) as an ADR once those systems are
   authored — this document's `battleState` shape is a **provisional
   contract**, not a final one.
2. **Event-stream vs. state-polling reconciliation with Combat
   Resolution.** This document resolves Objective's read contract as
   state-based (`battleState` polling) rather than the event-stream
   consumption described in `combat-resolution.md`'s Dependencies table.
   Confirm this via `/consistency-check` and update whichever document is
   wrong, or explicitly document both as valid (state-based for the core
   verdict, event-based as optional enrichment) in an ADR.

**Resolved this session (provisional defaults — confirm during
implementation):**

3. **Objective types are mutually exclusive per battle in v1** (Rule 4) —
   no composable objectives (e.g. "Protect AND Clear simultaneously").
   *Owner:* revisit if Encounter Generator's content needs demand it.
4. **`max_turns` boundary is inclusive** (`turn ≥ max_turns` triggers, per
   Formula F2) — "survive 6 turns" means the battle can end in Victory as
   early as turn 6's terminal check, not turn 7's.
5. **Reach-type victory requires exactly one living Hero-faction occupant**
   of a single `goalTile` — no multi-tile or "all heroes must gather"
   variant in v1.
6. **`ObjectiveConfig` well-formedness validation happens at
   authoring/battle-setup time, not inside `evaluate()`** — a malformed
   config (missing `max_turns` for Survive/Protect, dangling
   `protectedUnitId`) is a content bug caught upstream, not a runtime
   branch this system handles gracefully.

**Deferred to the owning system's GDD:**

7. **Composable objectives (v2).** Combining, e.g., "Protect" as a modifier
   layered onto "Clear" (protect this unit *while* clearing all enemies) is
   a natural extension but out of v1 scope (Rule 4). *Owner:* revisit when
   Encounter Generator's content variety needs it.
8. **Multi-goal-tile Reach ("all heroes must reach separate extraction
   points").** Not modeled — v1's Reach is single-tile, any-one-hero.
   *Owner:* Encounter Generator / Heroes & Abilities, if such a mission
   shape is drafted.
9. **Reach as a hold-position objective** (must remain on the tile for `K`
   consecutive turns, not just be present at one terminal check). Deferred
   — v1's Reach is satisfied by simple presence at the moment of the
   terminal check. *Owner:* revisit if an "extraction zone" mission
   archetype is drafted.
10. **Third/neutral factions** (escort NPCs, defendable structures) for
    Protect-type targets beyond Hero-faction units. Not modeled in v1
    (binary Hero/Enemy faction assumption throughout this document).
    *Owner:* Heroes & Abilities / Enemy, Abilities & Telegraph, if such
    content is drafted. The `protected_unit_scope` knob is a placeholder
    for this extension.
11. **`ObjectiveConfig` authoring-time validation tooling** (who/what
    rejects a malformed config, and how — a build-time linter? a runtime
    assertion at battle setup?). *Owner:* Encounter Generator, when
    authored.
