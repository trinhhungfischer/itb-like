# Move Preview

> **Status**: In Design
> **Author**: workflow (design-system fan-out)
> **Last Updated**: 2026-07-27
> **Implements Pillar**: #1 Perfect Information, Perfect Blame; #5 Read in Ten Seconds

## Overview

Move Preview is the mechanism that makes VANGUARD's "commit to nothing you
haven't seen" promise (Pillar #1) real: before a player confirms any hero
action, Move Preview computes and displays its exact, full consequence by
dry-running the same Combat Resolution `resolve()` entry point used for the
real commit, against a disposable `Board.snapshot()` instead of the live
board. It never introduces a second, parallel simulation — it is a read-only
harness around Combat Resolution and Board & Grid's existing contracts, so
the previewed outcome and the committed outcome can never diverge. Move
Preview owns the *decision of what to compute and when* (staleness,
recompute triggers, telegraph cross-referencing) and produces a structured
"preview result" (an event log plus a derived visual diff); it does not own
rendering (Board Rendering & Juice) or ability legality (Heroes & Abilities /
Enemy, Abilities & Telegraph). It is also what lets forced-movement verbs
(push/pull/swap) carry Pillar #2's weight — a shove that ends a battle by
positioning alone is only trustworthy if its consequence was fully visible
before commit. `systems-index.md` flags this system as VANGUARD's single
highest-risk technical dependency, because if it lies — even once — the
entire "perfect information" premise of the game collapses.

## Player Fantasy

Move Preview has no direct player fantasy of its own — like Board & Grid,
Turn & Phase Manager, and Combat Resolution, it is invisible infrastructure.
What the player *feels* when it works is the specific, load-bearing sensation
the whole game is built on: **"I already know exactly what will happen — I
am choosing to commit, not gambling."** Hovering a shove ability over an
enemy near a chasm and watching the enemy's predicted position slide into the
pit, its HP bar untouched (a shove doesn't need damage to be lethal), is the
moment Pillar #1 (Perfect Information, Perfect Blame) and Pillar #2
(Positioning Over Power) become simultaneously, viscerally true. It is also
the primary delivery vehicle for the Challenge aesthetic (the game concept's
#1-priority MDA aesthetic): a puzzle can only be *solved* — rather than
guessed — if its consequence is fully visible before the solve is locked in.
The failure state of this system is not merely a bad feeling; it is the
*destruction of trust*: a previewed outcome that turns out different than the
committed one converts "I made a mistake" into "the game lied to me," which
is the one experience VANGUARD's entire design is structured to prevent.

## Detailed Design

### Core Rules

1. **Preview scope & trigger.** A **candidate action** is a fully-specified,
   already-legal ordered `EffectPrimitive[]` chain, compiled by Heroes &
   Abilities (or, symmetrically, an equivalent authoring path for debug/AI
   tooling — not a gameplay path) from a selected hero ability plus a
   selected target (tile or unit). Move Preview activates whenever a
   candidate action exists and the battle is in Player Phase (Turn & Phase
   Manager); it has nothing to preview outside that condition (Rule 11).
   **Move Preview is silent and subscription-based:** it subscribes to Input
   & Selection's hover/select/cancel/confirm event stream to learn when a
   candidate action forms, changes, or is discarded. It does **not** expose a
   synchronous `preview()` entry point for Input & Selection (or any other
   system) to call — Input & Selection owns emitting selection-state events;
   Move Preview owns reacting to them and computing the dry-run
   (`cross-system-contracts.md` §7). This is a one-way, event-driven
   relationship, not a request/response call.

2. **Dry-run contract — exact code-path reuse.** On candidate formation (or
   change), Move Preview calls `previewBoard = liveBoard.snapshot()` then
   `events = CombatResolution.resolve(previewBoard, candidateEffects)` — the
   identical entry point Turn & Phase Manager invokes for a real commit (per
   `combat-resolution.md`'s explicit "Move Preview... the exact same entry
   point used for real resolution" contract). Move Preview never
   re-implements any resolution logic; `previewBoard` is discarded after
   being read (no other system ever receives a reference to it).

3. **Preview-Commit Parity Invariant — the core guarantee.** For any
   candidate action, if the live board is unchanged between the moment a
   preview is computed and the moment the player confirms that exact
   candidate, calling `CombatResolution.resolve(liveBoard, candidateEffects)`
   at confirm produces byte-identical events to the preview's `events`. This
   holds **unconditionally**, not merely "usually," because Combat Resolution
   is deterministic and pure with respect to its inputs
   (`combat-resolution.md` Overview), and because VANGUARD is single-player,
   turn-based, and has no real-time or asynchronous mutation source — the
   live board can only change between preview and confirm if the player
   takes another explicit action first, which discards the current preview
   (Rule 6).

4. **Recompute policy — staleness.** A displayed preview is valid ("Ready")
   only for the exact `(liveBoardState, candidateEffects)` pair it was
   computed against. Any of the following invalidates a Ready preview and
   forces a fresh computation before it may be shown as authoritative again:
   (a) the candidate action itself changes (different ability, target, or
   direction), (b) the live board mutates — an earlier action in the same
   Player Phase is committed or undone. A stale preview must never remain
   visibly displayed as current; it is either instantly replaced by the new
   computation (within the latency budget, Formula F1) or hidden until the
   new one is Ready.

5. **Legality boundary — no duplicate logic.** Move Preview never computes
   ability legality, range, or reachability. It only ever receives
   already-legal candidate effect chains from Heroes & Abilities / Enemy,
   Abilities & Telegraph (per `combat-resolution.md` Rule 13's ownership
   boundary). If no legal candidate exists (e.g., the player hovers an
   out-of-range tile), Move Preview is simply never invoked — there is no
   "illegal preview" state to design for.

6. **Cancel is free.** Cancelling a candidate action (deselecting, pressing
   Escape, selecting a different hero) discards the preview with zero effect
   on the live board — trivially true, since `resolve()` was only ever called
   against a disposable snapshot. This mirrors Turn & Phase Manager's
   free-undo philosophy: exploring options must never cost anything until the
   player explicitly commits.

7. **Confirm re-invokes `resolve()` against the live board.** Confirming a
   previewed candidate action does not "apply the preview" — it hands the
   identical `candidateEffects` list to Turn & Phase Manager, which calls
   `CombatResolution.resolve(liveBoard, candidateEffects)` for real, pushes a
   new undo snapshot (per `turn-and-phase-manager.md` Rule 4), and emits the
   committed event log. Move Preview's own preview state is then cleared
   (transitions to Idle — see States and Transitions).

8. **Multi-target completeness.** When a candidate action's effect chain
   touches more than one unit (an AoE, a chained hazard spread, a swap), the
   preview must expose the full consequence for **every** affected unit in
   the single computed result — never a partial preview requiring the player
   to "check units one at a time." This directly serves Pillar #5 (Read in
   Ten Seconds): a whole multi-unit consequence must be knowable in one
   glance.

9. **Telegraph threat cross-reference — secondary enrichment.** After
   computing the dry-run's resulting unit positions, Move Preview performs
   one additional, non-simulated check: for each surviving unit's final
   tile, flag whether that tile is currently telegraphed as an enemy or
   environmental target for the turn about to resolve (Turn & Phase
   Manager's Telegraph Phase output, fixed for the whole following Player
   Phase — `turn-and-phase-manager.md` Rule 3.6). This is a pure
   tile-membership lookup (Formula F3), not a second `resolve()` call — Move
   Preview does not simulate how the enemy's action will resolve, only
   whether the previewed final position sits on a tile the enemy has already
   announced it will hit — **unioned with any currently telegraphed
   environmental tiles**. Per `cross-system-contracts.md` §9 (resolving C4),
   Enemy, Abilities & Telegraph ✅ owns `telegraphedEnvironmentTiles(turn)`
   (hazard/environmental telegraphs — e.g. a collapsing floor or fire spread —
   that are not tied to any single enemy's attack intent); Move Preview's
   threat overlay unions this set with the per-enemy attack-tile set read
   directly from each living enemy's `Intent.telegraphedEffectTiles`
   (`enemy-abilities-and-telegraph.md` Rule 8 data contract). This mirrors
   Battle HUD's `heroesInDanger` safety check, which performs the identical
   union (`battle-hud.md`). Move Preview derives neither set itself — both
   are read, not recomputed.

10. **Preview failure blocks confirm — fail-safe.** If preview computation
    cannot complete (an implementation error, not a gameplay path), the
    corresponding confirm action must be **blocked**, not silently allowed
    to proceed. VANGUARD must never let a player commit to a consequence
    that was not successfully shown — an unavailable preview is treated as
    "this action cannot currently be confirmed," never as "confirm blind."
    This is a hard requirement of Pillar #1, not a graceful-degradation
    nicety.

11. **Phase gating.** Move Preview only operates during Player Phase. Outside
    Player Phase there is no player-authored candidate action to preview,
    and Turn & Phase Manager's phase-transition rules already forbid player
    input in every other phase (`turn-and-phase-manager.md` States and
    Transitions table) — Move Preview inherits this gate rather than
    re-implementing it.

12. **Preview never touches the undo stack.** Unlike a committed action, a
    preview computation never pushes a snapshot onto Turn & Phase Manager's
    undo/redo stack (`turn-and-phase-manager.md` Formula F2) — it operates
    entirely on its own disposable snapshot, outside that bookkeeping.
    Hovering ten different candidate targets in a row costs zero undo-stack
    depth.

### States and Transitions

There is at most one active preview at a time; forming a new candidate
replaces any prior one. Cycle: `Idle → Computing → Ready → {Stale →
Computing | Discarded → Idle | Committed → Idle}`.

| State | Meaning | Entered when | Exits to |
|-------|---------|---------------|----------|
| **Idle** | No candidate action exists; nothing to preview | Battle enters Player Phase; after Discard or Committed | Computing (candidate formed) |
| **Computing** | `resolve(snapshot, effects)` dry-run in flight | A legal candidate action is formed or changed (Rule 4) | **Ready** (compute succeeds) or the confirm action stays blocked (Rule 10) if it fails |
| **Ready** | A valid, current preview result is available and displayed | Computing completes successfully against the still-current live board | **Stale** (board or candidate changes), **Discarded** (cancel), **Committed** (confirm) |
| **Stale** | The Ready result no longer matches the current live board/candidate | Live board mutates OR candidate changes while Ready (Rule 4) | **Computing** (immediate recompute) |
| **Discarded** | Candidate cancelled; preview cleared with zero board effect | Player cancels/deselects (Rule 6) | **Idle** |
| **Committed** | Preview handed off; the real `resolve()` call is executing on the live board | Player confirms (Rule 7) | **Idle** (after Turn & Phase Manager's commit completes) |

A stale preview is never itself "displayed as Ready" — the Stale state exists
for testability (it names the invalid window between a change and the next
recompute), not as a UI-visible state distinct from Computing.

### Interactions with Other Systems

Move Preview is a **consumer and orchestrator**: it owns no primitives and no
persistent state; it orchestrates a read-only dry run of systems that already
exist for the committed path.

| System | Move Preview reads/calls | Move Preview provides | Ownership boundary |
|--------|---------------------------|------------------------|---------------------|
| **Board & Grid** ✅ | `snapshot()`; all pure queries needed to build the visual diff | — | Board owns snapshot cost/representation; Preview only consumes it |
| **Combat Resolution** ✅ | `resolve(previewBoard, candidateEffects) -> events` — identical entry point used for commits | — | Combat owns resolution truth; Preview never reinterprets it |
| **Turn & Phase Manager** ✅ | current phase (Player Phase gate, Rule 11) | confirm handoff into the manager's real commit + undo-stack push (Rule 7) | Manager owns phase gating and the committed undo stack; Preview owns only the pre-commit dry run |
| **Heroes & Abilities** ✅ | already-legal candidate `EffectPrimitive[]` chains + legal-target set (`compileEffects()`, `legalMoveTiles()`, `legalTargets()` per `heroes-and-abilities.md`) | — | Heroes & Abilities owns legality/compilation; Preview only consumes already-legal chains (Rule 5) |
| **Enemy, Abilities & Telegraph** ✅ | per-enemy `Intent.telegraphedEffectTiles` + `telegraphedEnvironmentTiles(turn)`, unioned for the current turn (Formula F3) | — | Enemy/Telegraph owns intent and environmental telegraph data; Preview only reads it, never simulates enemy resolution |
| **Input & Selection** ✅ | hover/select/cancel/confirm **events** that form, change, or discard a candidate action — Move Preview subscribes to this stream; it never receives a synchronous call | — | Input owns UI interaction and emits events; Preview owns what happens once a candidate exists (silent, subscription-based — Rule 1) |
| **Board Rendering & Juice** ✅ | — | structured preview result (`PreviewResult`): predicted positions, HP deltas, deaths (with cause), hazard creates/applies, collision events, threat-overlay flags | Preview owns *what* to show; Rendering owns *how* to draw it |
| **Battle HUD** ✅ | — | predicted HP/damage numbers, ability-outcome summary (part of the same `PreviewResult`) | Read-only consumer of the same preview result |

> **Dependency status:** Heroes & Abilities, Enemy, Abilities & Telegraph,
> Input & Selection, Board Rendering & Juice, and Battle HUD are all ✅
> Designed (`systems-index.md`). The interfaces above have been reconciled
> against each system's actual GDD; see the Dependencies section for the
> bidirectional-consistency check.

## Formulas

All formulas are deterministic and time-independent (no RNG). Examples use
the default **8×8** board (registered constants `grid_width`, `grid_height`)
and the registered `manhattan_distance` formula's output range.

### F1. Preview Latency Budget

`t_preview = t_snapshot + t_resolve + t_diff`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| snapshot cost | `t_snapshot` | ms | < 1 (board ≤ 12×12, per `board-and-grid.md`'s performance budget) | `Board.snapshot()` cost, inherited from Board & Grid |
| resolve cost | `t_resolve` | ms | < 1 typical (1–10 primitives); up to ~1–2 for a large AoE chain (per `combat-resolution.md`'s performance budget) | Combat Resolution's `resolve()` cost for the candidate chain |
| diff cost | `t_diff` | ms | < 1 (this system's own budget) | Move Preview's own event-log → visual-diff translation, including the telegraph cross-reference (Formula F3) |
| total preview time | `t_preview` | ms (output) | typical ≤ 4, hard budget ≤ `preview_latency_budget_ms` (Tuning Knobs, default 5) | Time from candidate formation/change to Ready |

**Output range:** `t_preview ∈ [0, ~4]` ms typical. **Worked example:** an 8×8
board, a 3-primitive push+damage chain: `t_snapshot=0.4ms + t_resolve=0.3ms +
t_diff=0.2ms = 0.9ms` total — comfortably inside a single 16.6ms (60 fps)
frame, leaving over 15ms for input handling and rendering.

### F2. Visual Diff Complexity Bound

Bounds how many distinct tile-deltas a single previewed action can produce —
used to keep an ability's design legible (Pillar #5) and to size the
`max_recommended_chain_length` knob.

`diffEvents = Σ e_i` for `i` in `1..n`, where `n` is the candidate chain
length and `e_i` is the event count contributed by primitive `i`. Each
primitive contributes a bounded number of events: `damage` → 1 (+1
`removeUnit` if lethal); `push`/`pull` → up to `distance` `TileEntered`
events (hard-bounded by the board diameter — registry formula
`manhattan_distance`'s output range `[0,14]` on the default 8×8 board) + 1
terminal collision/complete event; `swap` → 2 position events (+ up to 2
hazard-on-entry events); `spawnHazard`/`applyHazard` → 1 event each;
`setTerrain` → 1 `TerrainSet` event (a wall build or teardown, whichever the
primitive specifies — `cross-system-contracts.md` §1).

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| chain length | `n` | int | ability-defined; recommended ≤ `max_recommended_chain_length` (default 6) | Number of primitives in the candidate effect chain |
| events per primitive | `e_i` | int | 1 to ~15 (a push at max board diameter) | Events one primitive can emit; dominated by push/pull step count |
| total diff events | `diffEvents` | int (output) | `n` to `15n` (worst case) | Sum of `e_i` across the chain |

**Output range:** `diffEvents ∈ [n, 15n]`. **Worked example:** a 2-primitive
"shove then hazard-apply" chain on an 8×8 board with a push that resolves 3
tiles before colliding: push contributes 3 `TileEntered` + 1
`DisplacementComplete` (or collision event) = 4 events; `applyHazard`
contributes 1 event; `diffEvents = 5`. **Wall-verb worked example:** a
1-primitive "build wall" candidate (`setTerrain(tile, Blocked)`) targeting an
unoccupied tile: the primitive contributes exactly 1 `TerrainSet` event, so
`diffEvents = 1` — the minimum possible non-empty preview, and a case where
the "consequence" is purely a battlefield-shape change rather than damage or
displacement. The preview still shows this single tile-delta with the same
rigor as any multi-unit chain (Rule 8), since a wall can be just as
positionally decisive as a shove (Pillar #2). **Design guidance:** keep
realistic per-action `diffEvents` in the single digits to hold Pillar #5's
"readable in ten seconds" — this is why `max_recommended_chain_length`
defaults to 6 rather than allowing arbitrarily long chains.

### F3. Threat-Overlap Flag

`threatened(tile) = tile ∈ telegraphedTiles(currentTurn)`

`telegraphedTiles(currentTurn) = telegraphedEnvironmentTiles(currentTurn) ∪
(⋃ enemy.Intent.telegraphedEffectTiles for enemy in livingEnemies)`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| final tile | `tile` | coord | valid tile | A previewed unit's resulting position after the dry-run |
| telegraphed tile set | `telegraphedTiles(currentTurn)` | set of coords | 0 .. (enemy count × avg targets/enemy + environmental telegraph tile count) | The **union** of Enemy, Abilities & Telegraph's `telegraphedEnvironmentTiles(turn)` (hazard/environmental telegraphs, `cross-system-contracts.md` §9) and every living enemy's `Intent.telegraphedEffectTiles` (`enemy-abilities-and-telegraph.md` Rule 8 data contract, per-enemy attack tiles). Both source sets are read directly, never recomputed by Move Preview. Fixed for the whole current Player Phase |

**Output:** boolean, per surviving previewed unit. **Worked example (enemy
intent):** a hero previewed to end at `(4,4)` after a shove-assisted
reposition; the current enemy `Intent.telegraphedEffectTiles` set is
`{(4,4), (5,4)}` (a telegraphed 2-tile attack line) → `threatened((4,4)) =
true` → the preview flags this tile with the threat-overlay indicator
(Visual/Audio Requirements), warning the player that their own move would
still leave that hero inside the enemy's announced attack. **Worked example
(environmental union):** the same hero instead previewed to end at `(6,2)`,
outside any enemy's `telegraphedEffectTiles`, but `(6,2)` is a member of
`telegraphedEnvironmentTiles(currentTurn) = {(6,2), (6,3)}` (a collapsing-floor
telegraph unrelated to any enemy attack) → `telegraphedTiles(currentTurn) =
{(4,4), (5,4), (6,2), (6,3)}` → `threatened((6,2)) = true` — the union means a
move that dodges every enemy's attack can still be flagged threatened by an
environmental hazard, exactly as `battle-hud.md`'s `heroesInDanger` check
already requires (`cross-system-contracts.md` §9).

## Edge Cases

- **The current ability has no legal targets:** no candidate action ever
  forms; Move Preview stays Idle; the confirm affordance is unavailable (not
  "shown but disabled with no preview" — it simply never appears armed).
- **The player hovers an out-of-range or illegal tile:** Move Preview is
  never invoked (Rule 5) — no preview, no error state.
- **The live board changes while a Ready preview for a *different* candidate
  is displayed** (e.g., the player undoes an earlier committed action while
  hovering a new target): the existing Ready preview immediately becomes
  Stale and is recomputed before being shown as current again (Rule 4);
  it is never left on screen representing a board state that no longer
  exists.
- **A previewed chain kills the acting unit itself** (e.g., a self-targeting
  ability pulls the caster into a hazard as a side effect): the preview
  shows the caster's own death exactly as it would show any other unit's —
  nothing about a self-inflicted or unintended consequence is hidden or
  filtered from the result.
- **A multi-unit AoE where some targets were already removed by an earlier
  effect in the same candidate chain** (the no-op case defined in
  `combat-resolution.md` Rule 8): the preview result explicitly marks that
  unit's entry as **no-effect** (matching Combat Resolution's
  `*_noop(targetId, reason:'already_removed')` event) rather than silently
  omitting it from the affected-unit set — omission would read as a bug, not
  a deliberate rule.
- **A push/pull collides on its very first step (0 net tiles moved):** the
  preview reports `stepsMoved = 0` plus the specific collision type
  (`CollisionEdge` / `CollisionWall` / `CollisionUnit`) and any resulting
  `collision_damage`, never a generic "nothing happens."
- **An ability's candidate chain is empty (`effects = []`):** legal per
  `combat-resolution.md`'s own edge case (equivalent to "pass"). The preview
  result is an explicit **empty-effect preview** ("no consequence"), and
  confirm remains available — this is distinct from "no preview exists"
  (Rule 10 blocks confirm only when computation *fails*, not when it
  legitimately computes zero effects).
- **The candidate chain is unusually large** (many chained hazard applies
  across many units, e.g., a wide fire spread): Move Preview still computes
  and shows the full, untruncated truth — Pillar #1 is absolute and this
  system never hides or summarizes consequences to stay "readable." An
  oversized `diffEvents` (Formula F2) is a signal that the *ability's
  design* violates Pillar #5 and should be reconsidered by Heroes &
  Abilities / Enemy, Abilities & Telegraph — Move Preview enforces nothing
  here, it only reports the number.
- **The player changes hover target rapidly (e.g., dragging across several
  tiles within one input frame):** each hover change triggers a fresh
  dry-run; only the result for the **most recent** candidate may ever reach
  the Ready state and be displayed — a computation for a superseded
  candidate that finishes after a newer one is discarded, never shown, even
  if it technically completes later due to a scheduling artifact.
- **A hover/select event occurs outside Player Phase** (should already be
  prevented by Input & Selection's own gating, tested here defensively):
  rejected — Move Preview computes nothing and remains Idle (Rule 11).
- **A unit is removed mid-push via hazard-on-entry (falls into a Chasm) as
  part of the previewed chain:** the preview reports removal cause `Fell`,
  distinct from `Defeated` — the two causes must never be visually or
  semantically collapsed into one generic "died" outcome (Visual/Audio
  Requirements), since Pillar #1 requires the player to know exactly *why*.
- **The current turn's telegraph data itself does not change mid-Player-Phase**
  (`turn-and-phase-manager.md` guarantees Telegraph resolves once, at the end
  of the previous turn, and is fixed through the whole following Player
  Phase): Move Preview's telegraph cross-reference (Formula F3) may treat
  `telegraphedTiles(currentTurn)` as a fixed input for the entire Player
  Phase — only board-state or candidate changes trigger recompute, never a
  telegraph change.
- **A candidate would move a unit onto or near a `spawn-point` tile:** Move
  Preview does **not** flag this in v1 — spawn-point occupancy consequences
  are Enemy, Abilities & Telegraph's rule (per `board-and-grid.md`'s own
  deferred edge case), and spawn locations are not necessarily telegraphed
  per-tile the same way an attack is. **PROVISIONAL / deferred** — see Open
  Questions.
- **A candidate somehow targets an already-dead unit** (a state-desync
  scenario that should never occur if Heroes & Abilities correctly gates
  legality against live units only): Combat Resolution's own already-removed
  no-op rule handles it gracefully; the preview shows a no-effect result, not
  a crash.
- **Board size is raised beyond the 8×8 default** (via `board-and-grid.md`'s
  `grid_width`/`grid_height` knobs, safe range 5–12): Move Preview's own
  latency budget (Formula F1) directly inherits Board & Grid's stated
  snapshot budget (< 1ms at ≤ 12×12); if a future board size exceeds that
  range, `t_preview` must be re-profiled and the `preview_latency_budget_ms`
  knob re-validated — this coupling is explicit, not incidental.
- **Preview computation legitimately fails** (implementation fault, not a
  gameplay path): confirm is blocked per Rule 10; the player sees the
  candidate remain un-confirmable rather than the game silently proceeding
  with an unshown consequence.

## Dependencies

**Upstream (Move Preview depends on):**

| System | Interface | Hard / Soft |
|--------|-----------|--------------|
| **Board & Grid** ✅ | `snapshot()` (disposable preview board) + all pure queries used to build the visual diff | **Hard** |
| **Combat Resolution** ✅ | `resolve(previewBoard, candidateEffects) -> events` — the exact live-commit entry point | **Hard** |
| **Turn & Phase Manager** ✅ | current phase (Player Phase gate, Rule 11); confirm handoff into the manager's real commit + undo-stack push | **Hard** |
| **Heroes & Abilities** ✅ | already-legal candidate `EffectPrimitive[]` chains + legal-target set (`compileEffects()`, `legalMoveTiles()` F1, `legalTargets()` F2) | **Hard** — Designed |
| **Enemy, Abilities & Telegraph** ✅ | `telegraphedEnvironmentTiles(turn)` + per-enemy `Intent.telegraphedEffectTiles`, unioned for the current turn (Formula F3) | **Soft** — enrichment only; core preview functions without it, degrading to Combat-Resolution-only consequences. Designed |
| **Input & Selection** ✅ | hover/select/cancel/confirm events that form or discard a candidate | **Hard** — Designed |

**Downstream (systems that depend on Move Preview — all now Designed;
interfaces below match each dependent's own GDD):**

| Dependent System | Interface | Hard / Soft |
|-------------------|-----------|--------------|
| **Board Rendering & Juice** ✅ | consumes the full preview result (`PreviewResult`: positions, deltas, deaths + cause, hazard events, threat flags) to draw overlays | **Hard** |
| **Battle HUD** ✅ | consumes predicted HP/damage numbers for display (Rule 16) | **Soft** |
| **Audio System** ✅ | consumes the rule "preview is silent" (Visual/Audio Requirements) — effectively a defined non-trigger rather than a data dependency | **Hard** (from Audio's side — see asymmetry note below) / **Soft** (from Move Preview's side) |

**Bidirectional-consistency note:** All six dependency edges below have now
been verified against each partner system's own authored GDD — no remaining
"propose here, confirm when authored" edges.

- `board-and-grid.md` lists Move Preview as a **Hard** dependent whose
  defining need is `snapshot()` — consistent with the Upstream row above.
- `combat-resolution.md` lists Move Preview as **Hard**, explicitly requiring
  "the exact same entry point used for real resolution" — consistent with
  Rule 2 and the Upstream row above.
- `turn-and-phase-manager.md` lists Move Preview as a **Soft** dependent
  sharing the snapshot mechanism; from Move Preview's own side the
  relationship is **Hard** (phase gating and the confirm handoff are
  load-bearing) — this asymmetry is expected and not a conflict, since
  hardness reflects how much *each side* needs the other, not a symmetric
  property.
- `heroes-and-abilities.md` lists Move Preview as **Hard**, consuming
  `compileEffects()`, `legalMoveTiles()` (F1), and `legalTargets()` (F2) —
  matching the Upstream row above verbatim.
- `enemy-abilities-and-telegraph.md` lists Move Preview reading current-turn
  `Intent`/`SpawnIntent` records as **Hard** from Enemy's own side; from Move
  Preview's side the relationship is **Soft** (enrichment only, per Rule 9) —
  the same expected asymmetry as Turn & Phase Manager above, not a conflict.
- `input-and-selection.md`'s prose (its silent-emitter model, matching Rule 1
  here) confirms the hover/select/cancel/confirm event contract this GDD
  depends on; Move Preview is listed as a **Hard** downstream dependent.
- `board-rendering-and-juice.md` lists Move Preview as **Hard**, consuming
  `PreviewResult` on each hover request — matching the Downstream row above.
- `battle-hud.md` lists Move Preview as a **Soft** dependent, consuming
  `Ready`/`Stale`/`Discarded`/`Committed` state and predicted HP/damage
  deltas — matching the Downstream row above.
- `audio-system.md` lists Move Preview as **Hard** from Audio's own side
  (Audio's silence-filtering correctness structurally depends on Move
  Preview never publishing dry-run events onto the shared stream); from Move
  Preview's side the relationship is **Soft** (Move Preview's own behavior is
  unaffected by whether Audio exists) — the same expected asymmetry pattern
  noted above, not a conflict.

## Tuning Knobs

| Knob | Default | Safe Range | Category | Too Low | Too High |
|------|---------|-----------|----------|---------|----------|
| `preview_recompute_trigger` | `hover` | enum `{hover, explicit_lock}` | Feel | N/A (enum) — `explicit_lock` trades fluid exploration for fewer/calmer visual updates; a legitimate accessibility-motivated alternative, not a broken value | N/A (enum) — `hover` is the ITB-style default, maximizing Pillar #1's "explore freely" feel |
| `preview_latency_budget_ms` | 5 | 1–8 | Gate | Forces cutting corners in the diff/telegraph step to hit the deadline, risking a preview shown before it is truly Ready — directly threatens Rule 10's fail-safe guarantee | Introduces perceptible input lag on hover, breaking the "instant feedback" feel this system exists to deliver; above ~8ms it starts competing with the 16.6ms 60fps frame budget alongside rendering |
| `stale_preview_grace_ms` | 0 | 0–100 | Feel | Default (0) is safe — recomputation is fast enough per Formula F1 that no grace window is needed | Above roughly 50–100ms, the player can act on or see a preview that is stale relative to their current hover for a perceptible window, weakening Preview-Commit Parity's *felt* trustworthiness even though the underlying guarantee (Rule 3) is unaffected |
| `telegraph_threat_overlay_enabled` | `true` | bool | Gate | `false` removes the secondary threat cross-reference (Formula F3) entirely — legitimate for a reduced-HUD/accessibility mode, but strictly less informative; core preview (Rules 1–8) is unaffected | N/A (bool) |
| `max_recommended_chain_length` | 6 | 3–12 | Curve | Forces ability authors (Heroes & Abilities / Enemy, Abilities & Telegraph) to artificially split naturally-longer effect chains into multiple abilities | A single preview can present an overwhelming number of simultaneous deltas (Formula F2), breaking Pillar #5's "read in ten seconds" even though the preview itself remains technically correct and complete |

**Interactions between knobs:**
- `preview_recompute_trigger=hover` paired with a low `preview_latency_budget_ms`
  is the intended default combination — hover-driven previews only feel good
  if they are fast. If a future ability roster pushes `t_resolve` (Formula
  F1) past the budget, either raise the budget knob or switch the trigger to
  `explicit_lock` rather than letting hover previews visibly lag.
- `max_recommended_chain_length` is a design-time linting value consumed by
  Heroes & Abilities / Enemy, Abilities & Telegraph — it does **not** clamp
  or truncate an actual preview at runtime (see Edge Cases: Move Preview
  always shows the full truth, never a truncated one). Raising it doesn't
  break correctness, only legibility.

**Explicitly NOT a knob here:** whether preview computation reuses
`CombatResolution.resolve()` verbatim (Rule 2) is a structural, design-locked
invariant — like Board & Grid's fixed adjacency and Combat Resolution's
no-chain-push rule — because exposing "use a faster, approximate preview" as
a config option would reintroduce exactly the trust risk this whole system
exists to eliminate.

## Visual/Audio Requirements

This section specifies **what** must be conveyed — the semantic/data
requirements handed to Board Rendering & Juice, Battle HUD, and Audio
System. **How** to render or animate it is those systems' domain, guided by
`art-director`'s Visual Identity Anchor ("Legible Battlefield").

- **Silhouette-preserving.** Preview overlays (ghost positions, path arrows)
  must never obscure a unit's or tile's identifying silhouette, per the
  game concept's "silhouette-first units" principle.
- **Cause-distinct death markers.** A unit removed by `Defeated` vs. `Fell`
  (Combat Resolution's vitality states) must be visually distinguishable in
  preview — collapsing both into one generic "dies" icon violates Pillar
  #1's "know exactly why."
- **Verb-family color consistency.** A previewed effect must reuse the same
  accent color as its source ability's verb-family icon (per the game
  concept's "one accent color per verb-family" principle) — e.g. a shove's
  predicted path/arrow uses the shove verb-family's accent color, never a
  generic neutral preview color.
- **Threat-overlay is a distinct, single, consistent indicator** (its own
  icon/color, not reused from any verb-family accent) applied to Formula
  F3's flagged tiles — it must read unambiguously as "you will still be hit
  here," clearly separated from the base movement/effect preview.
- **No-op units are shown, not hidden.** Units in an AoE already removed
  earlier in the same chain must display an explicit "no effect" tag rather
  than being silently omitted from the highlighted set — omission would read
  as an inconsistency or bug, not a deliberate rule.
- **Multi-unit AoE previews are simultaneous, not sequential.** All affected
  units' deltas must be visible in a single glance (Pillar #5), never
  revealed one at a time.
- **Preview is silent.** No SFX plays while a preview is Computing, Ready, or
  Stale — only Confirm (the real committed `resolve()`) triggers
  impact/collision/hazard/death SFX. This prevents audio spam from rapid
  hover exploration and keeps audio meaningful as a confirmation signal, not
  a preview signal. **(PROVISIONAL** — Audio System is undesigned; this is
  the contract proposed here.**)**
- **Performance-driven feel.** Because `t_preview` (Formula F1) targets
  sub-5ms, preview overlays should appear to update instantly on hover with
  no perceptible transition delay; any deliberate "settle" animation belongs
  to Board Rendering & Juice's presentation layer, not to Move Preview's
  compute budget.

## UI Requirements

Interaction-flow-level widget/layout decisions belong to `/ux-design`; this
section hands off the hard constraints established by this GDD's rules.

- The confirm affordance (button, hotkey, or click-to-commit) must be
  disabled/unavailable whenever no Ready preview exists for the current
  candidate (Rule 10 — never allow a blind confirm).
- Cancel must be available at all times a candidate exists, with zero
  confirmation step of its own (Rule 6 — cancelling is always free and
  instant).
- The recompute trigger (`preview_recompute_trigger` knob) determines
  whether hovering alone forms/updates a candidate, or an explicit lock-in
  click is required; the chosen mode must be consistent across every
  ability (no per-ability inconsistency), to avoid violating Pillar #5's
  predictability.

## Acceptance Criteria

Pure, deterministic tests wherever possible; integration tests where noted
(spanning Board/Combat/Turn Manager fakes). No wall-clock time, no RNG.
Default board `8×8` and default knob values unless stated.

**Dry-run correctness & no live mutation (Rules 1–3)**
- **GIVEN** a legal candidate action and a live board in state `S`, **WHEN** Move Preview computes a preview, **THEN** the live board remains byte-identical to `S` afterward (only the disposable snapshot was mutated).
- **GIVEN** a candidate action, **WHEN** Move Preview computes its preview, **THEN** it calls the exact same `CombatResolution.resolve` entry point Turn & Phase Manager uses for commits (verified via call-interception on a test double, not a parallel reimplementation).
- **GIVEN** a Ready preview for candidate `C` computed against live board state `S`, **WHEN** the player confirms `C` with no intervening board change, **THEN** the resulting committed event log is byte-identical to the preview's event log (Preview-Commit Parity, Rule 3).

**Recompute / staleness (Rule 4)**
- **GIVEN** a Ready preview, **WHEN** the candidate's target changes, **THEN** the state transitions to Computing and a new result replaces the old one before being shown as current.
- **GIVEN** a Ready preview, **WHEN** an earlier action in the same Player Phase is committed or undone (live board mutates), **THEN** the existing preview immediately becomes Stale and is never displayed as authoritative until recomputed.
- **GIVEN** no board or candidate change, **WHEN** a Ready preview is queried again, **THEN** it is returned without triggering a redundant `resolve()` call.

**Legality boundary (Rule 5)**
- **GIVEN** a hover/selection Heroes & Abilities reports as illegal, **WHEN** this occurs, **THEN** Move Preview is never invoked and no preview state (Computing/Ready) is entered.

**Cancel / Commit (Rules 6–7, 12)**
- **GIVEN** any active preview state, **WHEN** the candidate is cancelled, **THEN** the state transitions Discarded → Idle and the live board is unchanged.
- **GIVEN** a Ready preview, **WHEN** the player confirms, **THEN** Turn & Phase Manager's real `resolve()` call executes against the live board, a new undo snapshot is pushed to its stack, and Move Preview's own state returns to Idle.
- **GIVEN** any number of preview computations in a single Player Phase, **WHEN** the undo-stack depth is inspected, **THEN** it reflects only committed actions — zero contribution from preview computations.

**Multi-target completeness (Rule 8)**
- **GIVEN** a candidate action whose effect chain touches `N>1` units, **WHEN** the preview is Ready, **THEN** the preview result includes a distinct entry for every one of the `N` units.

**Telegraph cross-reference (Rule 9, Formula F3)**
- **GIVEN** a previewed unit's final tile is in the current turn's telegraphed tile set, **WHEN** the preview result is computed, **THEN** `threatened(tile) == true` is included for that unit.
- **GIVEN** a previewed unit's final tile is NOT in the telegraphed set, **THEN** `threatened(tile) == false`.
- **GIVEN** the telegraph set is empty, **THEN** every previewed unit's `threatened` flag is false and no threat overlay is shown.
- **GIVEN** `telegraph_threat_overlay_enabled == false`, **WHEN** a preview is computed, **THEN** no `threatened` flags are computed or surfaced, while all other preview data (positions, damage, deaths) remains unaffected.

**Fail-safe (Rule 10)**
- **GIVEN** preview computation fails to complete (simulated fault injection), **WHEN** the player attempts to confirm, **THEN** confirm is rejected/unavailable — the real `resolve()` is never invoked against the live board without a prior successful preview for that exact candidate.

**Phase gating (Rule 11)**
- **GIVEN** the battle is in any phase other than Player Phase, **WHEN** a candidate-action-forming event occurs (tested defensively, since Input & Selection should already prevent this), **THEN** Move Preview does not compute a preview and remains Idle.

**Performance (Formula F1)**
- **GIVEN** an 8×8 board and a typical 1–10 primitive candidate chain, **WHEN** a preview is computed, **THEN** `t_preview` completes within `preview_latency_budget_ms` (default 5ms) in ≥95% of sampled runs (profiling benchmark — advisory, not per-call CI-blocking, matching the project's Story Type table treatment of performance).

**Visual diff completeness (Formula F2, Edge Cases)**
- **GIVEN** a chain where one effect renders an earlier-chain-removed unit's later effect a no-op, **THEN** the preview result explicitly marks that unit's entry as no-effect rather than omitting it.
- **GIVEN** a push/pull that collides on its first step (0 net tiles moved), **THEN** the preview result reports `stepsMoved=0` plus the specific collision type, not a generic "nothing happens."
- **GIVEN** a unit removed via the dry-run, **THEN** the preview result reports its exact removal cause (`Defeated` or `Fell`), matching Combat Resolution's vitality-state model.
- **GIVEN** a candidate with `effects = []`, **THEN** the preview result is an explicit empty-effect result and confirm remains available (distinct from a failed computation, which blocks confirm per Rule 10).

### Performance Budget (headless TS benchmarks, decoupled from render)

| Operation | Budget | Note |
|-----------|--------|------|
| `t_preview` total (snapshot + resolve + diff), typical 1–10 primitive chain, 8×8 board | ≤ 5 ms (`preview_latency_budget_ms` default) | Inherits Board & Grid's `snapshot()` budget (<1ms) and Combat Resolution's `resolve()` budget (<2ms combined) as its two largest components |
| Move Preview's own diff/telegraph-cross-reference step (`t_diff`) | < 1 ms | Own budget on top of the inherited Board/Combat costs |
| Combined cost per hover-driven recompute at 60 fps | < 5 ms | Leaves ≥ 11.6 ms of the 16.6 ms frame for input handling and rendering |

## Open Questions

**Needs an architecture decision (→ ADR during `/create-architecture`):**

1. **Event-log → visual-diff schema.** Shares `combat-resolution.md`'s Open
   Question #1 (event schema pinning); Move Preview's diff step (Formula
   F1's `t_diff`) depends on that same schema being finalized. *Owner:* Tech
   architecture, coordinated with Board Rendering & Juice / Battle HUD once
   those are designed.
2. **Synchronous vs. worker-thread computation.** Given the ≤5ms target
   budget (F1), preview computation is assumed synchronous on the main
   thread; confirm this holds at the largest supported board size
   (`board-and-grid.md`'s safe range up to 12×12) during implementation
   profiling — if snapshot cost grows non-trivially, an async/worker path
   may be needed. *Owner:* Tech architecture.

**Resolved this session (provisional defaults — confirm during
implementation):**

3. **Telegraph query interface** `getTelegraphedTiles(turn) -> Set<tile>`
   (Rule 9) is proposed here; Enemy, Abilities & Telegraph must confirm or
   amend this shape when authored.
4. **Default recompute trigger is `hover`** (ITB-style continuous preview),
   not click-to-lock; revisit if playtesting shows visual noise or
   performance issues on lower-end web hardware.
5. **Preview is silent** (no SFX) — Audio System must implement
   "commit-only" SFX triggering when authored.

**Deferred to the owning system's GDD:**

6. **Whole-turn "ghost queue" preview** (staging multiple uncommitted
   actions and previewing their combined effect before committing any).
   Current design previews one action at a time against the live,
   already-progressed board (since Turn & Phase Manager commits each action
   immediately, undoable). A staged multi-action preview is out of scope for
   v1 — revisit if Heroes & Abilities' action-economy design wants a
   different commit model.
7. **"What would the enemy actually do differently" simulation.** v1's
   threat cross-reference (Rule 9 / Formula F3) is a shallow tile-membership
   check against already-fixed telegraphs, never a re-simulation of enemy
   decision-making. A deeper "what-if" simulation is explicitly out of scope
   and would require Enemy, Abilities & Telegraph to expose a pure,
   replayable decision function. *Owner:* Enemy, Abilities & Telegraph, if
   ever pursued post-v1.
8. **Spawn-point occupancy risk flagging** (moving onto/near a tile about to
   spawn an enemy). Deferred to Enemy, Abilities & Telegraph, per
   `board-and-grid.md`'s own deferred edge case on spawn-point occupancy.
9. **Undo-of-a-committed-action preview** (showing what "undo" would look
   like before doing it). Not in scope for v1 — undo
   (`turn-and-phase-manager.md` Rule 4) is instant and direct, not itself
   previewed.
