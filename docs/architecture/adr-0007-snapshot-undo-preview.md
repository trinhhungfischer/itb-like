# ADR-0007: Snapshot-based undo & preview reuse one simulation

## Status

Accepted

## Date

2026-07-28

## Last Verified

2026-07-28

## Decision Makers

Technical Director (owner); consulted: Lead Programmer, and the owning-system
designs Turn & Phase Manager, Move Preview, Board & Grid, Combat Resolution.
Authoritative source: `design/architecture/cross-system-contracts.md` (§2, §3, §7)
and `docs/architecture/architecture.md` §8 (this is Required ADR **A7**).

## Summary

Both in-phase undo and pre-commit Move Preview are built on a single mechanism —
`Board.snapshot()` — feeding the single simulation `Combat.resolve()`. Undo is the
Turn & Phase Manager **adopting a previously captured snapshot as the new live
board** (there is no board-owned `restore()` mutation); preview is
`resolve(board.snapshot(), effects)` run silently and discarded. A snapshot is
captured only **after** an action's entire consequence chain resolves — including
on-death `spawnUnit` follow-ups — never mid-chain, so every snapshot is a complete,
consistent board state.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | None — pure web stack (TypeScript + PixiJS 2D/WebGL + Vite) |
| **Domain** | Core / Scripting (simulation state management) |
| **Knowledge Risk** | LOW — no engine API surface; TS/Pixi/Vite are within model training and stable |
| **References Consulted** | `design/architecture/cross-system-contracts.md` §2/§3/§7; `docs/architecture/architecture.md` §5a/§5b/§8; `design/gdd/turn-and-phase-manager.md`; `design/gdd/move-preview.md`; `design/gdd/board-and-grid.md` |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | None (engine). Behavioural verification is covered under Validation Criteria below. |

> **Not applicable / low risk.** VANGUARD is a pure-web build with no native game
> engine — there is no Godot/Unity/Unreal API surface, no rendering/physics
> middleware in the simulation path, and therefore no post-cutoff engine gap to
> manage. The Godot engine-reference under `docs/engine-reference/` does **not**
> apply to this decision and is intentionally not consulted. This ADR concerns pure
> TypeScript data-structure and control-flow choices only.

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | **ADR-0001** (Board tile-state representation & cheap `snapshot()` — the array-copy snapshot this ADR relies on) · **ADR-0006** (Combat `resolve()` as the single board-mutation path + the 10-primitive vocabulary — the one simulation both undo and preview reuse) |
| **Enables** | Move Preview correctness (the game's highest-risk technical dependency, `systems-index.md`); Turn & Phase Manager Player-Phase undo/redo; trustworthy forced-movement verbs (Pillar #2) |
| **Blocks** | Turn & Phase Manager implementation (undo stack) · Move Preview implementation · any Player-Phase interaction epic |
| **Ordering Note** | ADR-0001 and ADR-0006 must both be Accepted first: this ADR is a composition of a cheap snapshot (A1) and the single pure simulation (A6). It adds no new primitive and no new mutation path — it only defines *when* to snapshot and *how* undo/preview consume snapshots. |

## Context

### Problem Statement

VANGUARD makes two absolute promises to the player, both rooted in Pillar #1
(Perfect Information, Perfect Blame):

1. **Free exploration before commit** — any hero action can be taken back within the
   Player Phase, so exploring an idea is never punished; only committing to a bad one
   is (Turn & Phase Manager undo/redo).
2. **The preview never lies** — before confirming an action, the player sees its
   exact, full consequence, and the committed outcome is byte-identical to what was
   previewed (Move Preview's Preview-Commit Parity Invariant).

Both promises reduce to the same technical question: *how do we produce a
consequence, or roll one back, without a second implementation of the simulation
that could drift out of sync with the real one?* If preview used a separate
"prediction" code path, or undo reconstructed state by inverse operations, either
could diverge from `Combat.resolve()` — and a single divergence converts "I made a
mistake" into "the game lied to me," which is the one experience the entire design
exists to prevent. This decision must be made now because it is a hard prerequisite
for implementing the Turn & Phase Manager, Move Preview, Input & Selection, and the
entire Player-Phase interaction loop.

### Current State

No code exists yet; this ADR pins a convention already assumed — but not formally
decided — across three GDDs and the canonical contracts file:

- `cross-system-contracts.md` §2 states undo is the caller (Turn & Phase Manager)
  **adopting** a previously captured `snapshot()` as the new live board; there is
  **no** board-owned `restore()` mutation. Turn & Phase Manager is a **Hard**
  dependent of Board for `snapshot()`.
- §3 states the undo snapshot is captured **after the full consequence chain of each
  action resolves** (including any on-death `spawnUnit`/follow-up `resolve()`).
- §7 states Move Preview is silent, dry-runs `resolve()` on `board.snapshot()`, and
  the live board is untouched.

Without an ADR, these are prose conventions three implementers could each interpret
differently (e.g. someone could add a `Board.restore()`, or snapshot mid-chain).

### Constraints

- **Determinism is a hard invariant (Principle P1).** No RNG, no wall-clock in the
  battle simulation. Same inputs → byte-identical state and event log, every run.
  This is what makes a snapshot a sufficient record of state — no hidden ordering or
  time dependence to reconstruct.
- **One board-mutation path (Principle P2 / ADR-0006).** Only `Combat.resolve()`
  mutates the board. Undo and preview must **not** introduce a second mutation path
  (an inverse-op undo, or a preview that writes anywhere).
- **Pure headless simulation (Principle P3).** The whole mechanism must run in Vitest
  with no canvas; preview and undo cannot depend on any Pixi/render state.
- **Snapshot cost budget.** `Board.snapshot()` must be `< 1 ms` at ≤ 12×12
  (board-and-grid.md perf budget); undo/redo restore `< 2 ms` and preview total
  `t_preview ≤ 5 ms` (turn-and-phase-manager.md & move-preview.md budgets). Achieved
  by ADR-0001's flat-typed-array representation (snapshot = array copy).
- **Memory.** Undo memory is bounded to a single Player Phase (F3 ≈ 74 KB peak on
  8×8); the stack is cleared on Commit.

### Requirements

- Undo restores the board to any earlier in-phase checkpoint with zero divergence
  from the state that originally existed at that checkpoint.
- Preview produces a consequence byte-identical to the eventual commit, given an
  unchanged live board (Preview-Commit Parity).
- Neither undo nor preview mutates the live board except through the normal committed
  `resolve()` path.
- Snapshots are only ever taken at consistent, chain-complete board states.
- Meets the snapshot/restore/preview latency budgets above.

## Decision

Undo and Move Preview are two consumers of **one** mechanism —
`Board.snapshot()` — feeding **one** simulation — `Combat.resolve()` (ADR-0006).
There is no second simulation and no board-owned rollback.

**1. Undo = snapshot adoption, not board rollback.**
The Turn & Phase Manager owns an undo/redo stack of `Board` snapshots. To undo, it
**adopts** a previously captured snapshot as the new live board reference — it does
**not** call any `Board.restore()` method, because none exists. The board never
mutates itself backward; the manager simply swaps which snapshot *is* the live board.
Board exposes only `snapshot()`; the manager owns the stack and the adoption logic.

**2. Preview = the real simulation over a disposable snapshot.**
Move Preview computes `previewBoard = liveBoard.snapshot()` then
`events = Combat.resolve(previewBoard, candidateEffects)` — the **identical** entry
point the manager uses for a real commit. `previewBoard` is discarded after its
events/positions are read; no other system ever receives a reference to it. Preview
is silent (emits nothing onto the shared event stream Audio listens to) and never
touches the undo stack.

**3. Snapshot only after a full consequence chain resolves — never mid-chain.**
The Turn & Phase Manager captures a snapshot at Player-Phase start and then **after
each action's entire consequence chain has resolved** — including any on-death
`spawnUnit` follow-up effects (e.g. a killed enemy's brood spawn) and any further
`resolve()` those trigger (Enemy Rule 13). A snapshot is **never** taken partway
through a chain. Therefore every snapshot on the stack is a complete, internally
consistent board state, and undo always lands on one.

**4. One simulation, two callers — the parity guarantee.**
Because both preview (over a snapshot) and commit (over the live board) call the same
pure, deterministic `resolve()` with the same ordered `EffectPrimitive[]`, and
because VANGUARD is single-player and turn-based with no asynchronous mutation
source, the previewed events are byte-identical to the committed events whenever the
live board is unchanged between preview and confirm. Preview is not a
reimplementation; it is the real thing run against a throwaway copy.

### Architecture

```
                    Board & Grid  (ADR-0001: flat typed arrays)
                          │  snapshot()  = cheap array copy (<1ms), a full Board value
          ┌───────────────┴────────────────────────────────┐
          │                                                  │
   ┌──────▼───────────────┐                         ┌────────▼──────────────┐
   │ Turn & Phase Manager │                         │   Move Preview        │
   │  (owns UNDO stack)    │                         │  (silent dry-run)     │
   ├───────────────────────┤                         ├───────────────────────┤
   │ push snapshot AFTER   │                         │ previewBoard =         │
   │ each action's FULL     │                         │   liveBoard.snapshot() │
   │ chain (incl. on-death │                         │ resolve(previewBoard,  │
   │ spawnUnit) resolves   │                         │         effects)       │
   │                        │                         │ read events → overlay  │
   │ UNDO = adopt a prior   │                         │ discard previewBoard   │
   │ snapshot as live board │                         │ (live board UNTOUCHED) │
   │ (NO Board.restore())   │                         │ (NO undo-stack push)   │
   └──────────┬─────────────┘                         └────────┬──────────────┘
              │ commit: resolve(LIVE board, effects)           │ dry-run: resolve(SNAPSHOT, effects)
              └───────────────────────┬────────────────────────┘
                                      ▼
                     Combat.resolve(board, effects[]) -> events[]
                       (ADR-0006: THE ONE pure, deterministic simulation)
                       same code path for commit AND preview
```

### Key Interfaces

```typescript
// Board exposes ONLY snapshot() for this mechanism — there is deliberately NO restore().
interface Board {
  snapshot(): Board;   // ADR-0001: cheap deep copy (flat typed-array copy), a full live-usable Board value
  // ...queries + Combat-only mutations (ADR-0006); no rollback method exists
}

// Turn & Phase Manager — owns the undo stack; undo is ADOPTION, not board rollback.
interface TurnPhaseManager {
  // Player-Phase undo/redo stack of full Board snapshots (cleared on Commit).
  applyAction(effects: EffectPrimitive[]): CombatEvent[];
  //  1. events = Combat.resolve(this.liveBoard, effects)   // the ONE simulation, on the LIVE board
  //  2. resolve on-death spawnUnit / follow-up chain to completion (Enemy Rule 13)
  //  3. this.undoStack.push(this.liveBoard.snapshot())     // snapshot AFTER the full chain — never mid-chain
  undo(): void;   // this.liveBoard = this.undoStack.pop()  (ADOPT prior snapshot; NO Board.restore())
  redo(): void;   // symmetric: adopt the snapshot moved to the redo stack
  // Stacks are emptied when the Player Phase Commits (undo memory bounded to one phase).
}

// Move Preview — the real simulation over a disposable snapshot; silent; no live mutation.
function computePreview(liveBoard: Board, candidateEffects: EffectPrimitive[]): PreviewResult {
  const previewBoard = liveBoard.snapshot();                 // disposable copy
  const events = resolve(previewBoard, candidateEffects);    // SAME entry point as commit (ADR-0006)
  // build visual diff from events + previewBoard positions; NO event reaches the shared stream
  // previewBoard is discarded here; liveBoard is byte-identical to before this call
  return toPreviewResult(events, previewBoard);
}
```

### Implementation Guidelines

- **Never add `Board.restore()`.** Undo is the manager swapping its live-board
  reference to a snapshot. If a code review surfaces a proposed board-owned rollback
  or inverse-operation undo, reject it — it violates this ADR and re-introduces a
  second mutation path.
- **Snapshot timing is load-bearing.** The `push(snapshot())` call must sit *after*
  the full consequence chain — including on-death `spawnUnit` and any follow-up
  `resolve()` — has completed. Do not snapshot inside `resolve()` or between chained
  effects. Add a test that a chain producing a brood-spawn yields exactly one
  post-chain snapshot, not one per sub-effect.
- **Preview must be pure and silent.** Route preview `resolve()` through a path whose
  emitted events do **not** reach the shared Event Bus that Audio/Rendering commit
  consumers subscribe to (the silence *is* the commit/preview boundary — no
  `committed` tag needed, per contracts §7 / architecture §5c). Discard `previewBoard`
  immediately; never hand it to another system.
- **Adopt-by-value, not by-reference-into-the-past.** A snapshot on the undo stack
  must be an independent `Board` value (ADR-0001 array copy). After adopting snapshot
  `k`, later mutations to the live board must not retroactively alter snapshot `k`
  (covered by ADR-0001's deep-copy guarantee). Redo relies on the popped snapshot
  remaining an independent value.
- **Bound memory to the phase.** Clear both undo and redo stacks on Commit
  (Player-Phase end). This keeps peak memory at F3's ~74 KB on 8×8.

## Alternatives Considered

### Alternative 1: Board-owned `restore(snapshot)` mutation

- **Description**: Board exposes `restore(snap)` that mutates the live board in place
  back to a captured snapshot; the manager calls it on undo.
- **Pros**: Keeps a single stable `Board` object identity; no reference-swapping in
  the manager.
- **Cons**: Adds a **second board-mutation path** outside `Combat.resolve()`,
  directly violating Principle P2 / ADR-0006 ("one board-mutation path"). Every
  consumer holding a `Board` reference would need to be aware it can silently change
  underfoot. Contracts §2 explicitly rules it out: "there is no board-owned
  `restore()` mutation."
- **Estimated Effort**: Similar to chosen approach.
- **Rejection Reason**: Breaks the single-mutation-path invariant the whole
  architecture depends on. Adoption achieves identical behaviour with zero new
  mutation surface.

### Alternative 2: Command-pattern / inverse-operation undo (no snapshots)

- **Description**: Record each action as a command with an `undo()` that applies the
  inverse effects (un-damage, un-push, un-spawn), reconstructing prior state without
  storing full boards.
- **Pros**: Lower per-step memory than full-board snapshots.
- **Cons**: Requires an **inverse** of every one of the 10 primitives, including
  irreversible-looking ones (`removeUnit`, `spawnUnit`, collision-with-damage,
  hazard-on-entry chains). The inverse logic is a *second implementation* of the
  simulation that can drift out of sync with `resolve()` — precisely the divergence
  risk this ADR exists to eliminate. F3 shows full-board snapshots cost only ~74 KB
  peak on 8×8, so the memory saving is negligible at VANGUARD's scale.
- **Estimated Effort**: Substantially higher (an inverse for every primitive + chain
  ordering) and permanently higher-maintenance (every new/changed primitive needs its
  inverse re-verified).
- **Rejection Reason**: Reintroduces a parallel simulation and buys nothing —
  snapshot memory is trivial here (turn-and-phase-manager.md F3 explicitly concludes a
  delta/command undo is "not warranted" unless board or per-tile state grows ~10×).

### Alternative 3: Separate "prediction" simulation for preview

- **Description**: Move Preview runs a faster, approximate, purpose-built predictor
  instead of the real `resolve()`.
- **Pros**: Could be micro-optimized for the hover path.
- **Cons**: Any approximation can produce a previewed outcome that differs from the
  committed one — the single most damaging failure mode in the game
  (`systems-index.md` flags Move Preview as the highest-risk dependency precisely
  because "if it lies even once, the perfect-information premise collapses"). Given
  deterministic `resolve()` already runs in `< 2 ms`, there is no performance case for
  a second path.
- **Estimated Effort**: Higher (a whole second engine) with a permanent parity-drift
  liability.
- **Rejection Reason**: Directly contradicts the Preview-Commit Parity Invariant;
  move-preview.md pins "reuse `resolve()` verbatim" as a design-locked, non-knob
  invariant.

## Consequences

### Positive

- **One simulation, provable parity.** Preview and commit are the same
  `resolve()` over the same effects — parity is structural, not a thing to test into
  existence per-ability. Undo lands on states that genuinely existed.
- **Zero new mutation surface.** No `Board.restore()`, no inverse ops — the
  single-mutation-path invariant (P2/ADR-0006) holds unbroken.
- **Chain-complete snapshots.** Snapshotting only after the full chain (incl. on-death
  spawns) means undo can never land on a half-resolved board, eliminating a class of
  "impossible state" bugs.
- **Cheap and headless-testable.** Built entirely on ADR-0001's array-copy snapshot
  and ADR-0006's pure simulation — runs in Vitest with no canvas, well inside budget.
- **Directly delivers Pillars #1 and #2.** Trustworthy free undo + a preview that
  never lies are the technical embodiment of Perfect Information / Perfect Blame and
  make forced-movement verbs safe to build a game on.

### Negative

- **Full-board snapshots, not deltas.** We accept ~74 KB peak per Player Phase (8×8)
  rather than the smaller footprint of a command-pattern undo. Acceptable at v1 scale;
  revisit only if board or per-tile state grows ~10× (see Risks).
- **Snapshot-timing discipline required.** The "after the full chain, never mid-chain"
  rule is a correctness-critical timing constraint an implementer must respect;
  guarded by a dedicated test rather than the type system.
- **Preview allocates a snapshot per recompute.** Rapid hover triggers many
  short-lived snapshot allocations; mitigated by ADR-0001's cheap copy and (if needed)
  a reusable scratch buffer, but GC pressure must be watched on low-end web hardware.

### Neutral

- Board's public surface stays minimal — it gains no rollback method; all
  undo/preview intelligence lives in the manager and Move Preview respectively.
- Redo is simply the mirror of undo (adopt the snapshot moved to the redo stack); no
  extra machinery.

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| An implementer adds `Board.restore()` or an inverse-op undo, creating a 2nd mutation path | Medium | High | ADR + control-manifest rule forbidding board-owned rollback; code-review gate; the interface deliberately omits `restore()` |
| A snapshot is captured mid-chain (before on-death `spawnUnit` resolves), so undo lands on a half-resolved board | Medium | High | Snapshot only in `applyAction` after the full chain returns; dedicated test: a brood-spawning kill yields exactly one post-chain snapshot |
| Preview `resolve()` events leak onto the shared Event Bus, causing audio/render spam or a preview "commit" | Low | High | Route preview through a path whose events never reach the shared bus (contracts §7); test that no event is emitted during a preview compute |
| A snapshot shares mutable references with the live board, so undo/preview corrupts state | Low | High | Rely on ADR-0001's deep-copy guarantee; board-and-grid.md snapshot tests assert no shared refs |
| Board scale grows (>12×12 or heavy per-tile state), pushing snapshot cost past budget / GC pressure on web | Low | Medium | Perf budgets are gated (<1ms snapshot, <2ms restore, ≤5ms preview); re-profile if `grid_width/height` exceed safe range; command-pattern reconsidered only then |

## Performance Implications

| Metric | Before | Expected After | Budget |
|--------|--------|---------------|--------|
| CPU — `Board.snapshot()` (8×8, per undo push & per preview) | n/a (new) | < 1 ms | < 1 ms (≤12×12); `< 2 ms` snapshot gate in turn-and-phase-manager.md |
| CPU — undo/redo restore (snapshot adoption) | n/a | ~0 ms (reference swap) | < 2 ms (must feel instant) |
| CPU — full preview `t_preview` (snapshot + resolve + diff) | n/a | ≤ ~1 ms typical | ≤ 5 ms (`preview_latency_budget_ms`) |
| Memory — peak undo-stack (8×8, one Player Phase) | n/a | ~74 KB (F3) | ≤ 100 KB advisory; cleared on Commit |
| Network | n/a | 0 | Single-player, no network |

Numbers inherit ADR-0001 (array-copy snapshot) and ADR-0006 (`resolve()` `< 2 ms`);
this ADR adds only the orchestration around them and no per-frame cost beyond one
snapshot per committed action and one per preview recompute.

## Migration Plan

Greenfield — no existing system to migrate. Introduction order:

1. Land ADR-0001 (`snapshot()` via flat typed arrays) and ADR-0006 (`resolve()` single
   mutation path) — hard prerequisites. Verify: `snapshot()` deep-copy tests pass;
   `resolve()` purity tests pass.
2. Implement Turn & Phase Manager undo/redo as snapshot push (after full chain) +
   adoption on undo. Verify: undo/redo acceptance tests in turn-and-phase-manager.md
   (stack depth, restore equality, cleared on Commit).
3. Implement Move Preview as `resolve(snapshot, effects)`, silent, discarded. Verify:
   Preview-Commit Parity test (byte-identical committed vs previewed event log) and
   "live board unchanged after preview" test in move-preview.md.

**Rollback plan**: If snapshot-based undo ever proves too costly at a much larger
board scale, the reversal is contained: undo could migrate to a command/delta scheme
*behind the manager's existing `undo()/redo()` interface* without touching Board,
Combat, or Move Preview — Move Preview's snapshot dry-run is independent of how undo
stores history. No consumer sees the change. (Not anticipated at v1 scale per F3.)

## Validation Criteria

- [ ] **No `restore()`.** Board's public interface exposes `snapshot()` and no
  board-owned rollback/restore method (grep + review gate).
- [ ] **Undo is adoption.** After `k` actions then one `undo()`, the live board equals
  the snapshot captured after action `k−1`, and the popped snapshot moves to the redo
  stack (turn-and-phase-manager.md undo/redo acceptance tests pass).
- [ ] **Chain-complete snapshots.** An action whose consequence chain includes an
  on-death `spawnUnit` produces exactly **one** post-chain snapshot (not one per
  sub-effect), and undo restores the post-spawn board.
- [ ] **Preview-Commit Parity.** For an unchanged live board, the committed event log
  from `resolve(liveBoard, effects)` is byte-identical to the preview's event log from
  `resolve(snapshot, effects)`.
- [ ] **Preview is side-effect-free & silent.** After a preview compute the live board
  is byte-identical to before, no event reaches the shared Event Bus, and the undo
  stack depth is unchanged.
- [ ] **Determinism.** Two identical input sequences yield byte-identical snapshot
  contents and event logs (no RNG, no clock in the path).
- [ ] **Budgets met.** `snapshot()` `< 1 ms`, restore `< 2 ms`, `t_preview` `≤ 5 ms`,
  peak undo memory ≤ 100 KB on 8×8.

## GDD Requirements Addressed

| GDD Document | System | Requirement | How This ADR Satisfies It |
|-------------|--------|-------------|--------------------------|
| `design/gdd/turn-and-phase-manager.md` | Turn & Phase Manager | Rule 4: in-phase undo restores a Board `snapshot()` taken at Player-Phase start and **after each action's full consequence chain** (incl. on-death `spawnUnit`); "undo can never cross a phase boundary"; stack cleared on Commit | Defines undo as adopting a post-chain snapshot as the live board; snapshot captured only after the full chain resolves; stack bounded to and cleared at Player-Phase end |
| `design/gdd/turn-and-phase-manager.md` | Turn & Phase Manager | Dependencies: Turn & Phase Manager is a **Hard** dependent of Board for `snapshot()`/restore; Board owns state, manager owns *when* to snapshot and the adoption logic (no board-owned `restore()`) | Pins exactly this ownership split: Board exposes only `snapshot()`; the manager owns the stack and adoption; no `Board.restore()` exists |
| `design/gdd/turn-and-phase-manager.md` | Turn & Phase Manager | Formula F3 / Perf Budget: per-phase snapshot memory ~74 KB on 8×8, `snapshot()` `< 2 ms`, undo restore `< 2 ms`; command-pattern undo "not warranted" at this scale | Chooses full-board snapshots over delta/inverse undo, meeting the memory and latency budgets; Alternative 2 rejected on F3's own reasoning |
| `design/gdd/move-preview.md` | Move Preview | Rule 2 (dry-run — exact code-path reuse) & Rule 3 (Preview-Commit Parity Invariant): preview calls `resolve(board.snapshot(), effects)` — the identical commit entry point — and the committed outcome is byte-identical | Mandates one simulation for both paths; forbids a second/approximate predictor (Alternative 3 rejected) |
| `design/gdd/move-preview.md` | Move Preview | Rule 6 (cancel is free) & Rule 12 (preview never touches the undo stack): preview mutates only a disposable snapshot, zero live-board effect | Preview operates on a discarded `snapshot()` and never pushes to the undo stack; live board provably unchanged after compute |
| `design/gdd/move-preview.md` | Move Preview | Visual/Audio: "Preview is silent" — no events reach the shared stream Audio consumes | Preview `resolve()` events are read for the overlay and never emitted onto the shared Event Bus; the silence *is* the boundary |
| `design/gdd/board-and-grid.md` | Board & Grid | Interactions/Dependencies: Turn & Phase Manager "adopts a previously captured snapshot as the new live board on undo; there is no board-owned `restore()` mutation"; Move Preview runs all queries against a cloned snapshot | Encodes both consumer contracts against Board's single `snapshot()` capability; no `restore()` added to Board |

## Related

- **ADR-0001** — Board tile-state representation & cheap `snapshot()` (the array-copy
  snapshot this ADR consumes). Hard dependency.
- **ADR-0006** — Combat `resolve()` as the single board-mutation path + 10 primitives
  (the one simulation both undo-commit and preview reuse). Hard dependency.
- `design/architecture/cross-system-contracts.md` §2 (snapshot/adopt, no `restore()`),
  §3 (snapshot after full chain incl. on-death `spawnUnit`), §7 (silent preview via
  `resolve(snapshot, effects)`) — **canonical; contract wins on any conflict.**
- `docs/architecture/architecture.md` §5a (player-action path), §5b (turn/phase flow),
  §8 A7, Principles P1/P2/P3/P4.
- Implements game Pillars #1 (Perfect Information, Perfect Blame) and #2 (Positioning
  Over Power).
