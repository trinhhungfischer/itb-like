# Turn & Phase Manager

> **Status**: In Design
> **Author**: user + Claude (design-system)
> **Last Updated**: 2026-07-27
> **Implements Pillar**: #1 Perfect Information, Perfect Blame; #2 Positioning Over Power

## Overview

The Turn & Phase Manager is the battle's **clock and referee**: it drives every
battle through a fixed, deterministic sequence of phases each turn — the player
plans and commits all hero actions, then telegraphed enemy actions resolve, then
enemies spawn and re-telegraph their next intents — and after each turn it asks the
Objective system whether the battle is won or lost. It also owns the player's
**in-phase undo/redo**, letting a move be taken back freely until the turn is
committed. Players never see it as a "system"; they feel it as the **rhythm** of the
game and the safety of being able to think without being punished for a misclick. It
exists to guarantee the ordering that makes VANGUARD fair: **enemies always reveal
intent before the player acts, and nothing resolves out of order or by surprise**
(Pillar #1 Perfect Information, Perfect Blame). Without it there is no turn, no
telegraph-before-act guarantee, and no clean win/lose moment.

## Player Fantasy

Turn & Phase Manager has no direct player fantasy — it is the game's rhythm and
rulebook. What players *feel* is the **confidence to think**. Because every enemy
telegraphs before the player moves, and because any move can be undone until the
turn is committed, the player is never punished for *exploring* an idea — only for
*committing* to a bad one. This is the emotional core of Pillar #1 (Perfect
Information, Perfect Blame): *"the game will never surprise me; if I lose, it's
because I chose wrong — and I could have seen it."* The reference is Into the
Breach's turn structure and free undo — the reason its puzzles feel *fair* rather
than punishing. The failure state is any moment where the order of resolution
surprises the player, or an action cannot be taken back before commit — either
would replace "I miscalculated" with "that wasn't fair," and break the whole game's
trust.

## Detailed Design

### Core Rules

1. A battle is played as a sequence of discrete **turns**, numbered from 1. Each turn
   runs a **fixed, ordered sequence of phases** — identical every turn, no randomness,
   no reordering (Pillar #1).
2. **Battle setup** (before Turn 1): the board/encounter is initialized and initial
   enemies placed; then enemies **and any environmental effects** compute and **display
   their intents for Turn 1** (telegraph). The player never acts without seeing the
   current telegraphs.
3. **Per-turn phase order:**
   1. **Turn Start** — increment the turn counter; tick start-of-turn/duration effects; emit `turn_started`.
   2. **Player Phase** — the player freely moves heroes and uses abilities in any order, with **undo/redo available**, then ends the phase explicitly ("End Turn"). Board mutations are requested through Combat Resolution; the manager owns the phase and its undo stack.
   3. **Environment Phase** — telegraphed environmental effects resolve and tile hazards tick **first**: fire/acid/smoke spread and damage units standing on them, plus scripted board events (e.g. a rising tide, falling rocks) that can push, kill, or block. Deterministic order. Resolving before enemies lets the environment **set up or disrupt** the coming attacks — a core source of tactical depth. Effects are applied by Combat Resolution; the manager sequences them.
   4. **Enemy Resolve Phase** — the enemy actions telegraphed at the end of the previous turn (or at setup, for Turn 1) execute in a **deterministic order** (owned by Enemy, Abilities & Telegraph, e.g. by enemy id/initiative), against the board **as the Environment phase just left it**. The manager drives execution; Combat Resolution applies effects.
   5. **Spawn Phase** — telegraphed enemy spawns emerge onto their spawn tiles. Deterministic order.
   6. **Telegraph Phase** — all surviving enemies (existing + newly spawned) **and environmental effects** choose intents for the *next* turn and display them. The board is now fully telegraphed, ready for the next Player Phase.
   7. **End Check** — query Objective / Win-Lose; if a terminal condition is met, end the battle; otherwise loop to Turn Start.
4. **Undo/redo is scoped strictly to the current Player Phase.** The player may undo
   any of their in-phase actions back to the phase's start state, and redo. Once "End
   Turn" is confirmed, the phase's actions become permanent — **undo can never cross a
   phase boundary** (enemy resolution is never undoable). Undo is implemented by
   restoring a Board `snapshot()` captured at Player-Phase start and after each action's
   **full consequence chain** resolves — including any on-death `spawnUnit` follow-up
   effects triggered by that action (e.g. a killed enemy's brood spawn), per
   `cross-system-contracts.md` §3. A snapshot is never taken mid-chain, so undo always
   restores to a complete, consistent board state.
   The snapshot/undo stack is **cleared when the Player Phase ends** (Committed),
   bounding undo memory to a single phase.
5. The manager is **deterministic and input-driven**: the only nondeterministic
   element is player input during Player Phase. Every other phase is a pure function of
   board state — no timers, no real-time, no RNG.
6. A battle ends in exactly one terminal result: **Victory**, **Defeat**, or (optional)
   **Abandon** (player quits the run). The manager emits `battle_ended(result)`.
7. An **early defeat check** runs immediately after Environment, after Enemy Resolve,
   and after Spawn (3 checks), so a mid-turn total-party-kill or objective destruction
   ends the battle promptly rather than waiting for End Check. **Early checks evaluate the
   lose predicate only** — a mid-turn *victory* is decided only at the terminal End Check,
   after the whole turn resolves. (So per turn: 3 early lose-checks + 1 terminal
   win/lose check = 4 `Objective.evaluate` calls at most.)
8. The manager **exposes** the current turn number and current phase (HUD reads them).
   It does **not** define win/lose predicates (Objective owns those) nor apply effects
   (Combat owns those).

### States and Transitions

**Battle-level states:** `Setup → InTurn (loop) → Ended`.

**Phase cycle (within `InTurn`)** — a fixed ring; the only branch is at End Check:

`TurnStart → PlayerPhase → Environment → EnemyResolve → Spawn → Telegraph → EndCheck → (TurnStart | Ended)`

| Phase | Who acts | Undoable? | Can end battle? | Emits |
|-------|----------|-----------|-----------------|-------|
| Turn Start | system | — | No | `turn_started` |
| Player Phase | player | **Yes** (within phase) | No (Abandon only) | `player_phase_begun`, `action_applied`, `action_undone` |
| Environment | system | No | **Yes** (early defeat check) | `environment_resolved`, `hazard_ticked` |
| Enemy Resolve | system (enemy AI) | No | **Yes** (early defeat check) | `enemy_action_resolved` |
| Spawn | system | No | **Yes** (early defeat check) | `enemy_spawned` |
| Telegraph | system (enemy AI + env) | No | No | `intents_telegraphed` |
| End Check | system | No | **Yes** (victory or defeat) | `battle_ended` (if terminal) |

**Player Phase sub-states:** `Planning ↔ Planning` (each applied/undone action stays in
Planning) → `Committed` on confirmed End Turn. Only the `Planning → Committed` transition
is irreversible.

**Terminal results:** `Victory`, `Defeat`, `Abandon` — mutually exclusive; a battle
resolves to exactly one.

### Interactions with Other Systems

The manager is an **orchestrator**: it owns *sequencing and timing*; other systems own
*content and effects*.

| System | Manager reads | Manager drives / calls | Ownership boundary |
|--------|---------------|------------------------|--------------------|
| **Board & Grid** ✅ | board state for phase logic | `snapshot()` at Player-Phase start & per action (after its full consequence chain resolves); restore on undo | Board owns state; manager owns when to snapshot/restore |
| **Combat Resolution** ✅ | resulting events | `resolve(board, effects[])` for player actions (Player Phase); environmental effects & hazard ticks (Environment); enemy actions (Resolve); spawns (Spawn) | Manager owns *when*; Combat owns *how* effects resolve |
| **Enemy, Abilities & Telegraph** ✅ | telegraphed intents; deterministic resolution order | `resolveTelegraphed()` (Resolve), `emergeSpawns()` (Spawn), `chooseIntents()` (Telegraph) | Manager owns sequencing; Enemy owns AI + order |
| **Objective / Win-Lose** ✅ | `evaluate(battleState, turn, config) → EvaluationResult` | query at End Check + early defeat checks | Manager owns *when* to ask; Objective owns the predicate and `max_turns` |
| **Heroes & Abilities** ✅ | — | player actions in Player Phase are hero ability uses, routed via Combat | Indirect |
| **Battle HUD** ✅ | current turn #, current phase, undo availability | emits phase events HUD listens to | HUD is read-only consumer |
| **Move Preview** ✅ | — | shares Board's `snapshot()` mechanism | Preview & undo both depend on snapshot |

**Environmental effects** (fire/acid/smoke spread, scripted board events) are resolved
in the Environment phase. Their *catalog and telegraph rules* are owned by Combat
Resolution / Encounter Generator (which authors which hazards a battle contains); the
manager only sequences the Environment phase and requires that environmental intents be
**telegraphed and deterministic**, exactly like enemy intents.

**Contract the manager requires (confirmed against each dependency's GDD; see
`design/architecture/cross-system-contracts.md`):**
- Enemy, Abilities & Telegraph exposes a **deterministic** resolution order and pure
  intent-selection (no RNG), or Pillar #1 breaks.
- Objective / Win-Lose exposes a **pure** `evaluate(battleState, turn, config)` with no
  side effects, callable multiple times per turn, and owns `max_turns`.
- Combat Resolution exposes a **pure** `resolve(board, effects[]) → events[]` entry point
  and does not advance the turn (the manager, not Combat, controls phase flow).

All six dependencies (Combat Resolution, Enemy, Abilities & Telegraph, Objective /
Win-Lose, Heroes & Abilities, Battle HUD, Move Preview) are **Designed**. The interfaces
above are confirmed against their authored GDDs and the canonical
`cross-system-contracts.md`; no conflicts found.

## Formulas

**Scope note:** this system is a deterministic state machine, not a numeric balance
system. The relations below are **counters and memory footprint only** — none produce
a tunable gameplay outcome. **There are no balance formulas in this system** (no damage,
chance, drop-rate, or scaling math); any such math belongs to Enemy, Spawn, or
Objective, which consume this system's turn/phase signals.

### F1. Turn counter
`currentTurn(n) = n`  ·  `turnsElapsed = currentTurn − 1`  ·
`turnsRemaining = max_turns − currentTurn + 1` (only if `max_turns` is set)

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| current turn | `currentTurn` | int | 1..∞ (or 1..`max_turns`) | Turn in progress; +1 each Turn Start |
| turns elapsed | `turnsElapsed` | int | 0..∞ | Turns fully completed |
| turn cap | `max_turns` | int \| null | 1..∞ or unset | Optional cap (survive-N objectives; Objective owns the stop) |
| turns remaining | `turnsRemaining` | int \| N/A | 0..`max_turns` | Includes current turn; **N/A when uncapped** (do not conflate with 0) |

**Example:** `max_turns=10`, at Turn 4 → `turnsElapsed=3`, `turnsRemaining=7`.

### F2. Undo/redo stack depth
`stackDepth(k) = k + 1`  ·  `undoLevels(k) = k`  ·  `redoLevels(j) = j` (any new action clears redo to 0)
Upper bound: `undoLevels_max = H × A_max`.

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| actions taken this phase | `k` | int | 0..`H×A_max` | Player actions applied in the current Player Phase |
| hero count | `H` | int | ≥1 (default 3) | Owned by Heroes & Abilities — registry `squad_size` (default 3, safe range 2–5) |
| max actions/hero | `A_max` | int | =2 (fixed) | Owned by Heroes & Abilities — registry `actions_per_hero_turn` (fixed 2: one Move, one Ability) |
| snapshots held | `stackDepth` | int | 1..`H×A_max+1` | Phase-start snapshot (index 0) + one per fully-resolved action |

**Example (`squad_size`=3):** `H=3`, `A_max=2` → max 6 actions/phase; after 3 actions
`undoLevels=3`, `stackDepth=4`.

### F3. Undo/snapshot memory per Player Phase
`memPerSnapshot = W × H_grid × B_tile + O`  ·  `memPerPhase(k) = (k + 1) × memPerSnapshot`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| board width | `W` | int | =8 (registry `grid_width`) | Board width |
| board height | `H_grid` | int | =8 (registry `grid_height`) | Board height (distinct from hero count `H`) |
| bytes/tile | `B_tile` | int | ~64–128 (estimate) | Serialized bytes per tile — depends on Board's serialization (not yet a registered constant) |
| snapshot overhead | `O` | int | ~1.5–2.5 KB (estimate) | Entity list (hero/enemy positions, HP, statuses) |

**Example (8×8, `B_tile=100`, `O=2000`, `k=8`):** `memPerSnapshot ≈ 8.2 KB`;
`memPerPhase ≈ 9 × 8.4 KB ≈ 74 KB` peak. **Conclusion:** per-action full-board snapshots
are cheap at this scale — a delta/command-pattern undo is **not warranted** unless board
size or per-tile state grows ~10×.

### Fixed structural counts (invariants, not variables)
- `phasesPerTurn = 7` (TurnStart, PlayerPhase, Environment, EnemyResolve, Spawn, Telegraph, EndCheck).
- `endChecksPerTurn = 3` early **lose-only** checks (after Environment, Resolve, Spawn) + 1 terminal win/lose check at EndCheck = **4** `Objective.evaluate` calls per full turn.

> **External dependencies:** `H` (hero count) and `A_max` (actions/hero) are consumed
> here but owned and confirmed by heroes-and-abilities.md (registry `squad_size`=3,
> `actions_per_hero_turn`=2). `B_tile`/`O` are still local estimates, not cross-system
> facts — confirm once Board's serialization format is finalized.

## Edge Cases

- **If the player ends the turn with zero actions**: legal (a "pass"); the undo stack
  holds only the phase-start snapshot; proceed normally to Enemy Resolve.
- **If all enemies are destroyed during the Player Phase**: the battle does **not** end
  mid-phase. The remaining enemy phases (Resolve/Spawn/Telegraph) simply run as no-ops,
  then End Check evaluates the result. (Whether "no enemies" means victory is the
  Objective system's call — e.g. a survive-N objective is not won just by clearing.)
- **If a win and a lose condition are both satisfied at the same check**: **Defeat takes
  precedence over Victory.** The manager treats Objective's single verdict as
  authoritative; only if the manager must reconcile its own separate defeat/victory
  checks does this precedence apply.
- **If an enemy's telegraphed target tile no longer holds the original unit at Resolve**
  (the victim moved, or terrain changed): the telegraphed action resolves against the
  **telegraphed tile/position exactly as shown**, not chasing the unit — moving out of a
  telegraphed tile is a core defensive play (Pillar #1). If the tile is now empty, area
  effects still apply to that tile with no unit hit. *(Exact semantics owned by Enemy &
  Telegraph; the manager only guarantees the telegraph shown == the action resolved.)*
- **If two telegraphed enemy actions affect the same tile in one Resolve phase**: they
  apply **sequentially in the deterministic resolution order** (Enemy-owned); the state
  after each action is the input to the next. The manager guarantees ordered, one-at-a-
  time application — never simultaneous.
- **If an environmental hazard and an enemy attack target the same tile in one turn**:
  they resolve in **phase order — Environment before Enemy Resolve** — each applied
  sequentially, so a unit killed by the hazard is already gone when the enemy attack
  resolves (the attack then hits an empty tile). Environmental effects are telegraphed
  just like enemy actions and resolve against the telegraphed tile.
- **If the Environment phase displaces an enemy before it resolves its attack** (e.g. a
  tide or rockfall pushes the enemy): because Environment runs first, the enemy attacks
  from wherever it now stands (per Enemy, Abilities & Telegraph's displacement rule) — this is the
  intended source of setup/disruption plays. The telegraph shown last turn must already
  reflect the deterministic Environment→Enemy order, so the player is never surprised
  (Pillar #1). *(Truthful-telegraph computation is owned by Enemy, Abilities & Telegraph.)*
- **If an enemy spawns onto a tile occupied by a hero**: the spawn consequence (damage
  the occupant, block the spawn, etc.) is Enemy, Abilities & Telegraph's rule; the manager only
  sequences the Spawn phase. *(See board-and-grid.md edge case: board reports occupancy,
  does not resolve the spawn.)*
- **If the player presses Undo at the phase-start state (empty stack)**: no-op (already
  at the earliest snapshot).
- **If the player presses Undo/Redo outside the Player Phase**: rejected — undo/redo is
  disabled in every other phase (Rule 4).
- **If the player abandons mid-battle**: the manager emits `battle_ended(Abandon)`; the
  run layer handles consequences. No further phases run.
- **If Objective returns `ongoing` indefinitely with no reachable terminal state**:
  a `hard_turn_cap` safety knob force-ends the battle (as Defeat) to prevent an infinite
  loop. This is a guard, not a gameplay mechanic — a well-formed encounter should always
  have a reachable win/lose before the cap.
- **If a start-of-turn/duration effect and the turn increment interact** (e.g. a 1-turn
  effect applied last turn): duration effects tick at **Turn Start, after** the counter
  increments, so "lasts 1 turn" means it is present during exactly one Player Phase then
  expires at the next Turn Start.

## Dependencies

**Upstream (Turn & Phase Manager depends on):**

| System | Interface | Hard / Soft |
|--------|-----------|-------------|
| **Board & Grid** ✅ | `snapshot()` / restore for Player-Phase undo (captured after each action's full consequence chain, incl. on-death `spawnUnit` follow-ups); board state for phase logic | **Hard** — undo and phase logic need it |

**Driven via contract (the manager invokes these; all now Designed — see
`design/architecture/cross-system-contracts.md`).** Functionally the manager needs
them to run a battle, but to avoid a dependency cycle the manager depends on
**abstract contracts** it defines, which these systems implement (dependency
inversion — see note below):

| System | Contract the manager calls | Hard / Soft |
|--------|----------------------------|-------------|
| **Combat Resolution** ✅ | `resolve(board, effects[]) → events[]` — pure, no phase advance | **Hard** |
| **Enemy, Abilities & Telegraph** ✅ | `resolveTelegraphed()`, `emergeSpawns()`, `chooseIntents()` — all deterministic | **Hard** |
| **Objective / Win-Lose** ✅ | `evaluate(battleState, turn, config) → EvaluationResult` — pure, side-effect-free, owns `max_turns` | **Hard** |

**Downstream (consume the manager's turn/phase signals):**

| System | Interface | Hard / Soft |
|--------|-----------|-------------|
| **Battle HUD** ✅ | reads current turn #, current phase, undo availability; listens to phase events | **Hard** (for HUD) |
| **Move Preview** ✅ | shares Board's `snapshot()` mechanism the manager also uses | **Soft** |
| **Heroes & Abilities** ✅ | player actions during Player Phase are hero ability uses (routed via Combat) | **Soft / indirect** |

> **Potential circular dependency → resolve via interface inversion (ADR).** The manager
> *drives* Combat / Enemy / Objective, yet the systems-index lists those systems as
> depending on the Turn Manager (they consume its phase signals). This is not a true
> cycle if the manager depends only on the **contracts** above (`resolve`,
> `resolveTelegraphed`, `evaluate`, …) rather than concrete implementations. Record the
> contract boundary in `/architecture-decision`, mirroring the "Combat owns effect
> primitives" convention from board-and-grid.md.

**Bidirectional-consistency note:** Per `cross-system-contracts.md` §2, Turn & Phase
Manager is a **Hard** dependent of Board & Grid for `snapshot()`/restore — undo and
phase logic cannot function without it. This document's own Board & Grid row above
already states Hard, correctly. `board-and-grid.md`'s Dependencies table also lists
Turn & Phase Manager as a **Hard** dependent of Board & Grid (`snapshot()` at
Player-Phase start and after each committed action; adopts a previously captured
snapshot as the new live board on undo), and its own bidirectional-consistency note
confirms no dangling one-directional edges remain. Both documents agree: **Hard**,
consistent. Combat Resolution, Enemy, Abilities & Telegraph, and Objective / Win-Lose
are now Designed and each lists this manager's contract in its own Dependencies
(confirmed against their authored GDDs) — consistent.

## Tuning Knobs

| Knob | Default | Safe Range | Too Low | Too High |
|------|---------|-----------|---------|----------|
| `undo_enabled` | `true` | bool | If `false`, removes free in-phase undo — directly weakens Pillar #1 (Perfect Information, Perfect Blame). Reserve `false` for an optional hardcore/ironman mode | — |
| `max_undo_levels` | unlimited (within phase) | 1 .. `H×A_max` | Capping too low frustrates planning ("I can't take back far enough") | No downside — F3 shows per-phase snapshot memory is trivial (~74 KB on 8×8), so unlimited-within-phase is fine |
| `hard_turn_cap` | 50 | 20 .. 200 | Cuts off legitimately long battles as a false Defeat | Risks a runaway loop if an encounter's objective is malformed and never terminates |
| `abandon_enabled` | `true` | bool | If `false`, player cannot quit a battle mid-run | — |

**Referenced, not owned here:** `max_turns` (per-encounter survival limit) is defined by
the **Objective / Encounter** system; the manager only *counts* turns and exposes the
number (see Formula F1). Do not duplicate it as a manager knob — point to its source.

**Intentionally NOT knobs** (structural, like the board's adjacency mode): the **phase
order**, the **number of early defeat checks**, and the **Environment-before-Enemy
ordering** are design-locked invariants — exposing them as config would let a setting
silently change the game's core resolution guarantees (Pillar #1).

## Visual/Audio Requirements

[To be designed]

## UI Requirements

[To be designed]

## Acceptance Criteria

Pure state-machine unit tests — no wall-clock time, no RNG, no rendering. The harness
drives phases by direct calls and reads `currentTurn`, `currentPhase`, emitted events,
and snapshot-stack state.

**Turn numbering & phase order (Rules 1, 3)**
- **GIVEN** a fresh battle, **WHEN** `startBattle()`, **THEN** `currentTurn == 1`.
- **GIVEN** turn `n` passes End Check with no terminal result, **WHEN** the next Turn Start fires, **THEN** `currentTurn == n+1`.
- **GIVEN** any turn, **WHEN** phases are enumerated, **THEN** the sequence is exactly `[TurnStart, PlayerPhase, Environment, EnemyResolve, Spawn, Telegraph, EndCheck]` — every turn, no skip/reorder; illegal transitions are rejected.
- **GIVEN** a turn executes, **WHEN** Environment and EnemyResolve run, **THEN** Environment's order index is strictly before EnemyResolve's (regression guard for environment-first).

**Setup telegraph (Rule 2)**
- **GIVEN** setup completes, **WHEN** queried before any player input, **THEN** every enemy AND every active environmental effect has a non-null Turn-1 telegraph, generated with zero player actions and zero RNG.

**Undo/redo (Rule 4)**
- **GIVEN** Player Phase just started, **THEN** the snapshot stack holds exactly one entry (phase-start).
- **GIVEN** an action is committed, **THEN** a snapshot is pushed (`stackDepth += 1`).
- **GIVEN** `k` actions then `undo()`, **THEN** Board == snapshot at depth `k`, popped snapshot moves to redo stack.
- **GIVEN** a redo entry exists, **WHEN** `redo()`, **THEN** Board advances to it; **WHEN** a *new* action is committed instead, **THEN** redo stack is cleared.
- **GIVEN** Player Phase ends (→ Environment), **THEN** undo and redo stacks are both empty.
- **GIVEN** any phase ≠ Player Phase, **WHEN** `undo()`/`redo()`, **THEN** rejected/no-op, Board and phase unchanged.
- **GIVEN** the stack is at phase-start (0 actions), **WHEN** `undo()`, **THEN** no-op, no error.

**Determinism (Rule 5)**
- **GIVEN** identical input sequences on two battle instances, **THEN** all emitted events and final Board states are identical.
- **GIVEN** any non-Player phase, **WHEN** it resolves, **THEN** it consumes zero input and zero RNG. *(Also enforce via a static CI lint forbidding `Math.random`/`Date.now`/`setTimeout` in phase logic — non-GWT.)*

**Terminal result (Rule 6)**
- **GIVEN** End Check reports Victory / Defeat, **THEN** exactly one `battle_ended(result)` fires and no further transitions occur.
- **GIVEN** Abandon with `abandon_enabled==true`, **THEN** one `battle_ended(Abandon)` fires, overriding any in-flight phase; with `==false`, abandon is rejected, state unchanged.
- **GIVEN** any completed battle, **THEN** `battle_ended` was emitted exactly once.
- **GIVEN** win and lose both true at a check, **THEN** result is **Defeat** (loss precedence).

**Early defeat checks (Rule 7)**
- **GIVEN** Environment / EnemyResolve / Spawn completes and Objective's lose predicate is true, **THEN** `battle_ended(Defeat)` fires immediately and the remaining phases of that turn do not execute.
- **GIVEN** a mid-turn *victory* condition becomes true, **THEN** the battle does **not** end early — victory is decided only at the terminal End Check.
- **GIVEN** no early check triggers, **WHEN** the turn completes, **THEN** exactly 3 early lose-checks + 1 terminal check occurred.

**Ownership boundaries (Rule 8)**
- **GIVEN** the manager's interface, **THEN** it exposes no method that evaluates win/lose directly (delegated to injected Objective) and no method that mutates Board tiles/units/HP directly (delegated to Combat).
- **GIVEN** `getCurrentTurn()`/`getCurrentPhase()`, **THEN** they return live accurate values.

**Edge cases**
- **GIVEN** Player Phase with zero actions, **WHEN** ended, **THEN** transition to Environment succeeds (legal pass).
- **GIVEN** all enemies die during Player Phase, **THEN** EnemyResolve/Spawn run as no-ops (no crash) and the battle ends only when End Check evaluates Victory.
- **GIVEN** an enemy telegraphs an attack on tile `(x,y)` and the target later leaves `(x,y)` (e.g. displaced by Environment), **WHEN** EnemyResolve runs, **THEN** the action resolves against tile `(x,y)` exactly — no retarget/chase.
- **GIVEN** Objective returns `ongoing` every check up to `hard_turn_cap` (default 50), **WHEN** turn 50's terminal check still returns `ongoing`, **THEN** force-end `battle_ended(Defeat)` fires at turn 50 (not 49, not 51 — boundary test).

**Formulas (F1–F3)**
- **GIVEN** `currentTurn==n`, **THEN** `turnsElapsed==n−1`; with Objective `max_turns==M`, `turnsRemaining==M−n+1`; with no finite cap, `turnsRemaining==N/A` (sentinel, not 0/Infinity/null).
- **GIVEN** `k` actions committed, **THEN** `stackDepth==k+1`, `undoLevels==k`; after one undo, redo has 1 entry; a new action clears redo.
- **GIVEN** `(W,H_grid,B_tile,O,k)`, **THEN** `memPerPhase == (k+1)×(W×H_grid×B_tile+O)` for ≥3 sample tuples incl. the 8×8 ~74 KB case. *(Formula-correctness is BLOCKING; runtime heap ~74 KB is an advisory profiling check, not CI-blocking.)*
- **GIVEN** any turn, **THEN** `phasesPerTurn==7`.

**Tuning knobs**
- **GIVEN** `undo_enabled==false`, **WHEN** `undo()`/`redo()` during Player Phase, **THEN** rejected (knob overrides the phase gate).
- **GIVEN** `hard_turn_cap` default, **THEN** it is `50`; when overridden to `C`, force-end fires at turn `C`.
- **GIVEN** the manager, **THEN** it holds no local `max_turns` state — it reads it via the Objective interface (ownership boundary).

### Performance Budget (headless TS; manager overhead only, not delegated work)

| Metric | Budget | Gate |
|--------|--------|------|
| Single phase transition (manager overhead) | < 1 ms | CI-blocking |
| Full 7-phase turn (manager overhead only) | < 5 ms | CI-blocking |
| `Board.snapshot()` on 8×8 | < 2 ms | CI-blocking (input-lag risk) |
| Undo/redo restore | < 2 ms | CI-blocking (must feel instant) |
| Peak snapshot-stack memory (8×8, default) | ≤ 100 KB | Advisory (alert if >20% over F3 prediction) |
| Memory growth across a 50-turn battle | Flat (stacks cleared each phase) | Advisory / nightly soak |

**Integration-level (not pure unit):** the telegraph-vs-Environment coherence checks
(displaced-enemy resolution) span Combat/Environment contracts — test with Board/Combat
fakes as integration tests, per the project's Story Type table.

## Open Questions

**Needs an architecture decision (→ `/architecture-decision`):**

1. **Interface inversion for the driven systems.** The manager must depend on *contracts*
   (`resolve`, `resolveTelegraphed`, `emergeSpawns`, `chooseIntents`, `evaluate`) rather than
   concrete Combat/Enemy/Objective implementations, to avoid a dependency cycle. Pin the
   contract boundary in an ADR (mirrors board-and-grid.md's "Combat owns effect primitives").
2. **Snapshot/undo representation.** Shares board-and-grid.md's open ADR on tile-state
   representation (flat typed arrays for cheap `snapshot()`); undo reuses that mechanism.

**Resolved this session (provisional defaults — confirm during implementation):**

3. **Snapshot-stack lifetime** → cleared when the Player Phase ends (Rule 4); undo memory
   bounded to one phase.
4. **Early checks are lose-only** → mid-turn victory waits for the terminal End Check (Rule 7).
5. **`max_undo_levels` when exceeded** → default is unlimited-within-phase (memory is trivial
   per F3). If a finite cap `L` is set, it acts as a **rolling window**: only the most recent
   `L` action-snapshots are retained and undo is limited to `L` steps (the phase-start snapshot
   may be unreachable beyond `L`). Capping is discouraged.

**Deferred to the owning system's GDD:**

6. **`H` (hero count) and `A_max` (actions/hero)** bound the undo stack (F2) but are owned by
   **Heroes & Abilities / action economy** — confirm their source when authored.
7. **`B_tile` / `O`** (snapshot byte costs, F3) are local estimates — confirm once Board's
   serialization format is finalized.
8. **Telegraph-vs-Environment coherence** — that a displaced enemy's telegraph truthfully
   reflects the Environment→Enemy order is owned by **Enemy, Abilities & Telegraph**; verify with an
   integration test (Board/Combat fakes), not a pure unit test.
9. **`max_turns`** (survival cap) is owned by **Objective / Encounter**; the manager only
   counts and exposes turns.
