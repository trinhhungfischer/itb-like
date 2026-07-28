# ADR-0002: Deterministic synchronous event bus

## Status

Accepted

## Date

2026-07-28

## Last Verified

2026-07-28

## Decision Makers

Technical Director (owner/approver); consulted: Lead Programmer, Audio Director,
Technical Artist (Board Rendering & Juice), UX Designer (Battle HUD). Traces to
the VANGUARD Master Architecture (`docs/architecture/architecture.md` §5c, §8-A2)
and the canonical `design/architecture/cross-system-contracts.md` §1/§7.

## Summary

VANGUARD's simulation core must be byte-for-byte reproducible so that move
preview, undo, and full-run replay all agree with committed play. This ADR
decides that the single event channel connecting Combat/Turn events to their
presentation consumers is a **synchronous, in-registration-order observer bus**:
`emit()` invokes every subscriber immediately on the same call stack, with **no**
`Promise`, `queueMicrotask`, `setTimeout`, or `requestAnimationFrame` deferral
anywhere in the simulation path.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | None — pure-web stack (TypeScript strict + PixiJS + Vite) |
| **Domain** | Core / Scripting (event dispatch, simulation determinism) |
| **Knowledge Risk** | LOW |
| **References Consulted** | `docs/architecture/architecture.md` §5c/§8; `design/architecture/cross-system-contracts.md` §1/§7; `design/gdd/combat-resolution.md`; `design/gdd/audio-system.md` |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | None engine-specific |

> **Not applicable / low risk.** This is a pure-web build with no native engine
> (no Godot / Unity / Unreal API surface) and therefore no post-cutoff engine
> knowledge gap to manage. The Godot engine-reference in `docs/engine-reference/`
> does **not** apply to this project and is intentionally not consulted. The event
> bus is a hand-written TypeScript module depending only on stable, well-known
> language features (synchronous function calls and arrays); there is no
> version-pinned platform API whose behavior could drift. Because this ADR is
> engine-independent, it does **not** require re-validation on any engine upgrade.

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | None (foundational) |
| **Enables** | A6 (Combat `resolve()` single mutation path — its canonical event vocabulary rides this bus); A7 (snapshot-based undo & preview — replay equivalence depends on deterministic dispatch); A11 (environmental telegraph — HUD/Preview/Audio consume via this bus) |
| **Blocks** | Any story that emits or subscribes to a simulation event: Combat Resolution, Board Rendering & Juice, Battle HUD, Audio System, Move Preview, Turn & Phase Manager phase events |
| **Ordering Note** | Foundation-tier ADR. Must be Accepted before any Core code emits or subscribes to events. Constructed once at boot as a session singleton (`architecture.md` §5e step 3), before presentation systems mount (step 8). |

## Context

### Problem Statement

Multiple presentation systems (Board Rendering & Juice, Battle HUD, Audio System)
and one core system (Move Preview) must react to what Combat Resolution and the
Turn & Phase Manager do, without those producers importing or knowing about their
consumers (Principle P3 — pure simulation core, decoupled from PixiJS). This
requires a decoupled event channel. But VANGUARD's foremost pillar is
**determinism** (Principle P1): the same inputs must produce a byte-identical
state *and event log* on every run, across reloads, and — critically — the silent
dry-run used by Move Preview and the undo/replay machinery must produce the
**exact same** event sequence as committed play. The dispatch discipline of that
event channel is therefore not an implementation detail; it is load-bearing for
determinism. If dispatch order or timing can vary, preview can disagree with the
commit, undo can restore a subtly different world, and replay diverges. This must
be decided before any Core system emits its first event.

### Current State

Greenfield. `docs/architecture/` contains no prior event-dispatch decision; the
convention lives implicitly in `cross-system-contracts.md` §1 (canonical event
names) and §7 (silent, subscription-based Move Preview) and in the GDDs
(`combat-resolution.md` emits a fixed event vocabulary; `audio-system.md`
describes itself as a "read-only, event-driven consumer" of that stream). The
Master Architecture (§5c, §8-A2) promotes the implicit convention to this Required
ADR so it is formally decided and testable. There is no existing code or bus to
migrate.

### Constraints

- **Technical (platform):** JavaScript is single-threaded with an event loop. Any
  use of `Promise`/`queueMicrotask` defers work to the microtask queue, and
  `setTimeout`/`requestAnimationFrame` to later macro/paint tasks — both introduce
  ordering and timing that is *not* a pure function of the simulation inputs.
- **Technical (architecture):** The Foundation/Core/Feature layers must run
  headless in Vitest with no canvas and no renderer (Principle P3). The bus must
  therefore have zero dependency on PixiJS, the DOM, or `requestAnimationFrame`.
- **Compatibility:** Producers emit **only** the canonical event names from
  `cross-system-contracts.md` §1 (`damage_applied`, `displacement_complete`,
  `collision_resolved`, `swap_complete`, `hazard_spawned`, `hazard_applied`,
  `unit_removed`, `terrain_set`, `unit_spawned`) plus Turn & Phase Manager phase
  events. There is no `push_resolved`/`apply()` event or entry point.
- **Contract precedence:** Where any GDD diverges from `cross-system-contracts.md`,
  the contracts file wins; this ADR follows it.

### Requirements

- **Determinism (P1):** For identical ordered inputs, the sequence of
  `(subscriber, event)` invocations must be identical on every run and every
  reload — byte-for-byte, with no wall-clock or scheduling influence.
- **Preview/commit equivalence:** A `resolve()` over `board.snapshot()` (dry-run)
  and the same `resolve()` over the live board must emit the identical event
  sequence; only the *destination* of dispatch differs, never the ordering.
- **Decoupling (P3):** Producers depend only on `emit()`; consumers register via
  `on()`. No producer imports a consumer; the bus imports no renderer.
- **Ordering guarantee:** Subscribers for a given event fire in a well-defined,
  reproducible order (registration order).
- **Performance:** Dispatch overhead must be negligible against the battle frame
  budget (a turn-based grid game resolves a bounded, small number of effects per
  action; see Performance Implications).
- **Testability:** The full emit→subscribe path must be assertable headlessly in
  Vitest with no canvas, no timers, and no `async` test scaffolding.

## Decision

VANGUARD uses a **single, lightweight, synchronous observer event bus**,
constructed once at boot as a session singleton (`architecture.md` §5e step 3),
sitting in the Foundation layer.

**Core rule:** `emit(event)` looks up the handlers registered for `event.type`
and invokes each one **immediately, in registration (subscription) order, on the
same call stack** as the `emit()` caller. When `emit()` returns, every subscriber
has already run to completion. There is **no** deferral of any kind on the
simulation path — no `Promise`, no `queueMicrotask`, no `setTimeout`, no
`requestAnimationFrame`, no internal queue drained "later." Dispatch is a plain
synchronous `for`-loop over an ordered handler list.

**Consequences of the core rule that are themselves normative:**

1. **Registration order is the dispatch order.** Handlers fire in the order they
   were registered via `on()`. This is deterministic because boot order (§5e) is
   deterministic. No priority parameter, no sort, no `Set` iteration ambiguity —
   an ordered array.
2. **Combat emits only the canonical vocabulary** (contracts §1). Consumers
   subscribe to those exact names. No alternate event names or entry points.
3. **Preview silence is structural.** Move Preview dry-runs `resolve()` over a
   `snapshot()`; those events are consumed by Preview's own overlay logic and
   **never published onto the shared stream** that Audio/Rendering/HUD listen to.
   Because dry-run events structurally never enter the shared stream, no
   `committed` tag is needed — the silence *is* the boundary (contracts §7).
4. **Objective is not a subscriber.** Objective / Win-Lose is a pure state-poll:
   the Turn & Phase Manager calls `evaluate(battleState, turn, config)` directly
   at check points. It does not ride the bus (contracts §4; `combat-resolution.md`).
5. **No re-entrancy surprises by construction.** Because the simulation core does
   not itself subscribe-and-re-emit (only presentation consumers subscribe, and
   they never mutate the board — Principle P2/P3), a synchronous dispatch cannot
   produce an unbounded emit cascade within the sim. Presentation handlers must
   not call back into `emit()` on the simulation stream.

### Architecture

```
  SIMULATION (headless, no Pixi)                    PRESENTATION (read-only)
  ┌───────────────────────────┐
  │ Combat.resolve(liveBoard) │── returns events[] ─┐
  │  (canonical names only)   │                     │
  └───────────────────────────┘                     │
  ┌───────────────────────────┐                     ▼
  │ Turn & Phase Manager      │──phase events──►  ┌──────────────────────────┐
  │ (turn_started, ...)       │                   │      EVENT BUS           │
  └───────────────────────────┘   emit(e) ───────►│  synchronous dispatch    │
                                                   │  handlers[type] = [...]  │
                                                   │  for h in handlers: h(e) │  ← same call stack,
                                                   └───────────┬──────────────┘    registration order,
                                                               │                    NO async / no rAF
                          ┌────────────────────────────────────┼───────────────────────────┐
                          ▼                                     ▼                           ▼
                 Board Rendering & Juice               Battle HUD                    Audio System
                 (animate off events)          (HP, danger, log)             (SFX / adaptive music)

  Move Preview: resolve(board.snapshot(), effects) ── events consumed by Preview overlay ONLY,
                never emitted onto the shared stream above (structural silence, contracts §7).
```

### Key Interfaces

```typescript
// Foundation-layer singleton (architecture.md §6, §5e step 3).
// Depends on nothing; imports no renderer, no DOM, no timers.
interface EventBus {
  // Synchronous: invokes every handler registered for e.type immediately,
  // in registration order, on the caller's stack. Returns only after all
  // handlers have run. MUST NOT defer (no Promise/microtask/setTimeout/rAF).
  emit(e: CombatEvent | PhaseEvent): void;

  // Appends handler to the ordered handler list for `type`.
  // Registration order == dispatch order == deterministic (boot order is fixed).
  on(type: string, handler: (e: any) => void): void;

  // Removes a previously registered handler.
  off(type: string, handler: (e: any) => void): void;
}

// Reference dispatch shape (normative behavior, not a mandated implementation):
//   emit(e) {
//     const hs = this.handlers.get(e.type);
//     if (!hs) return;
//     for (let i = 0; i < hs.length; i++) hs[i](e);  // sync, in order, same stack
//   }
```

### Implementation Guidelines

- Store handlers per event type in an **ordered array**, appended to by `on()`.
  Do not use a `Set` for handler storage where iteration order could be ambiguous;
  registration order is a contract.
- `emit()` is a synchronous loop. It must never return a `Promise` and must never
  be `await`ed. Do not introduce an internal "event queue" drained on the next
  tick — that reintroduces deferral.
- The bus lives in Foundation. It must not `import` PixiJS, the DOM, or
  `requestAnimationFrame`. Presentation systems may *use* `requestAnimationFrame`
  for their own rendering **after** a handler returns, but rAF must never sit
  between `emit()` and a handler invocation.
- Presentation handlers are read-only observers (P3): they may read sim state and
  update visuals/audio, but must not mutate the board (only Combat may — P2) and
  must not re-`emit()` onto the simulation stream from within a handler.
- Handlers that need frame-paced animation should *record* what to animate on
  receipt of the event (synchronously) and drive the animation from their own rAF
  loop — decoupling paint timing from dispatch timing without deferring dispatch.
- Keep the event objects plain data (the canonical payloads in §6 of the Master
  Architecture). No live object references that could vary between runs.
- Construct exactly one bus per session at boot; pass it by injection (Principle
  P3 favors dependency injection over globals for testability).

## Alternatives Considered

### Alternative 1: Asynchronous / microtask-queued bus

- **Description**: `emit()` enqueues events; subscribers are invoked on a later
  microtask (`queueMicrotask`/`Promise.resolve().then`) or drained once per frame.
  A common web pattern that avoids deep synchronous call stacks and "smooths"
  bursty dispatch across frames.
- **Pros**: Shallower call stacks; naturally batches a burst of events into one
  frame; decouples producer timing from consumer work; familiar to web developers.
- **Cons**: **Fatal for this project.** Microtask/frame draining makes the
  observable event *order and timing* a function of the scheduler, not of the
  simulation inputs — directly violating Principle P1. Preview (which must run
  fully within a single synchronous `resolve()` call to produce an overlay *now*)
  could no longer be guaranteed identical to the commit. Undo/replay would have to
  reconcile in-flight queued events. Headless Vitest tests would need `async`/fake
  timers to observe effects, eroding Principle P4's "assert the event log directly."
- **Estimated Effort**: Comparable to build; higher to make correct/testable.
- **Rejection Reason**: Non-determinism on the simulation path is disqualifying.
  Determinism is a hard invariant (P1), not a tunable.

### Alternative 2: Direct method calls (no bus) / hard-wired observers

- **Description**: Combat and the Turn Manager call presentation systems directly
  (`renderer.onDamage(...)`, `audio.onDamage(...)`), or hold a fixed list of typed
  observer objects.
- **Pros**: Trivially deterministic and synchronous; no dispatch abstraction;
  easy to trace.
- **Cons**: Violates Principle P3 — the simulation core would import/know its
  presentation consumers, coupling Foundation/Core to PixiJS-facing modules and
  breaking headless testing. Adding a consumer (e.g. Onboarding/Tutorial) means
  editing Combat. Move Preview's structural-silence boundary becomes conditional
  branching inside Combat instead of "just don't subscribe."
- **Estimated Effort**: Lower initially, higher as consumers grow.
- **Rejection Reason**: Sacrifices the decoupling that lets the sim run headless
  and lets consumers be added without touching the core. A synchronous bus gives
  the same determinism *and* the decoupling.

### Alternative 3: Synchronous bus with priority-ordered dispatch

- **Description**: Same synchronous dispatch, but subscribers declare a numeric
  priority and handlers fire in priority order rather than registration order.
- **Pros**: Lets a consumer force itself first/last (e.g. HUD before Audio).
- **Cons**: Priority is another input that must be globally consistent to stay
  deterministic; ties reintroduce order ambiguity; it is complexity with no
  current need — no VANGUARD consumer requires a specific inter-consumer order
  (Rendering, Audio, and HUD react independently to the same event).
- **Estimated Effort**: Slightly higher than registration-order.
- **Rejection Reason**: Simplicity (decision criterion #2). Registration order is
  already deterministic given fixed boot order; priorities add a knob with no
  requirement driving it. Can be added later if a real ordering need appears
  (reversible — see Consequences).

## Consequences

### Positive

- **Determinism holds by construction (P1).** With no scheduler in the loop, the
  `(subscriber, event)` invocation sequence is a pure function of the simulation
  inputs — identical every run, every reload.
- **Preview == commit (P4).** The same `resolve()` produces the same event
  sequence whether run over a snapshot (silent) or the live board (published);
  Move Preview cannot drift from committed play via dispatch differences.
- **Reproducible undo/replay.** Because the event log is deterministic, replaying
  inputs reconstructs a byte-identical event log; undo (snapshot adoption, A7)
  never has to reconcile in-flight events.
- **Headless testability (P3/P4).** The full emit→subscribe path is assertable in
  synchronous Vitest tests with no canvas, no timers, no `async`.
- **Clean decoupling.** Producers depend only on `emit()`; new consumers
  (Onboarding/Tutorial, future Accessibility) subscribe without touching Combat.
- **Structural preview silence (contracts §7).** Dry-run events simply never reach
  the shared stream; no `committed` flag or filtering is needed.

### Negative

- **Discipline required, enforced by review/lint, not the type system.** "No
  async on the sim path" is a convention a careless `await` or `setTimeout` could
  violate; it must be guarded by the control manifest and code review (see Risks).
- **Deep synchronous call stacks under large bursts.** A single action that emits
  many events invokes many handlers on one stack. Acceptable here because effect
  counts per action are small and bounded (turn-based grid), but it is a real
  property to keep in mind (see Performance Implications).
- **Slow handlers block the emit caller.** A heavy presentation handler stalls
  `resolve()`'s caller. Mitigated by the guideline that handlers record-then-
  animate (defer *paint*, never *dispatch*).

### Neutral

- Presentation systems still use `requestAnimationFrame` for their *own* render
  loops; rAF is banished only from *between* `emit()` and handler invocation, not
  from rendering generally.
- The bus is a session singleton but is injected, not a global — a deliberate
  testability choice consistent with the coding standard's DI preference.

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| A future contributor adds `await`/`setTimeout`/`queueMicrotask`/`rAF` on the sim/dispatch path, silently breaking determinism | Medium | High | Record the "synchronous dispatch, no deferral" rule in the Control Manifest as a Forbidden pattern for Foundation/Core; add a determinism/replay regression test (same inputs → identical event log) to CI; lint-ban timers/async in the bus and Combat modules |
| A presentation handler re-`emit()`s onto the sim stream, causing a synchronous cascade or re-entrancy | Low | Medium | Guideline: handlers are read-only observers, must not re-emit onto the simulation stream; covered by review and P2/P3 layering rules |
| A long-running handler stalls the frame under a large event burst | Low | Medium | Handlers record-then-animate (defer paint, not dispatch); bounded effect counts per action; profile if a boss encounter proves bursty |
| Someone stores handlers in an unordered structure, making dispatch order nondeterministic | Low | High | Implementation guideline mandates an ordered array; determinism test would catch an order regression |

## Performance Implications

VANGUARD is a turn-based grid game: an action resolves a small, bounded number of
effects, each emitting at most a handful of canonical events, consumed by a
handful of subscribers. Dispatch is an array walk of synchronous calls — orders of
magnitude below any per-frame budget. There is no continuous per-frame emission
from the simulation (the sim advances on player/enemy actions, not every frame).

| Metric | Before | Expected After | Budget |
|--------|--------|---------------|--------|
| CPU (frame time) — dispatch overhead | N/A (greenfield) | << 0.1 ms per action's full event burst | 16.67 ms/frame (60 FPS target) |
| Memory | N/A | Negligible — ordered handler arrays + plain-data event objects; no queue retained | No dedicated bus budget |
| Load Time | N/A | 0 — singleton constructed once at boot (§5e step 3) | N/A |
| Network | N/A | N/A — single-player, fully local, no networking | N/A |

## Migration Plan

Greenfield — nothing to migrate. Introduction sequence:

1. Implement the `EventBus` module in Foundation with an ordered per-type handler
   array and a synchronous `emit()` loop. Verify: unit test asserting handlers
   fire in registration order, synchronously, before `emit()` returns.
2. Have Combat Resolution emit the canonical event vocabulary (contracts §1)
   through the bus. Verify: a fixed effect list produces the expected ordered
   event log (headless Vitest).
3. Subscribe Board Rendering & Juice, Battle HUD, and Audio at boot (§5e step 8);
   wire Move Preview to consume dry-run events privately (never publishing them).
   Verify: preview and commit of the same action emit identical event sequences;
   no dry-run event reaches the Audio stream.
4. Add a determinism regression test: identical scripted inputs across two runs
   yield a byte-identical event log. Wire into CI as a blocking gate.

**Rollback plan**: If a genuine ordering requirement or a burst-stall emerges, the
change is *local* to the bus module and its subscription order — the `emit()`/
`on()`/`off()` contract is unchanged. Add priority-ordered dispatch (Alternative 3)
or a record-then-animate refinement without touching producers or consumers'
event names. The "no async deferral on the sim path" invariant is **not**
rollback-eligible; it is a hard determinism guarantee.

## Validation Criteria

- [ ] Unit test proves handlers fire synchronously, in registration order, and
      that `emit()` returns only after all handlers have completed.
- [ ] Static/lint check (or manifest-enforced review) confirms no `Promise`,
      `queueMicrotask`, `setTimeout`, or `requestAnimationFrame` appears on the
      emit/dispatch path in the bus or Combat modules.
- [ ] Determinism regression test: the same scripted battle inputs produce a
      byte-identical event log across two independent runs and across a reload.
- [ ] Preview/commit equivalence test: `resolve(board.snapshot(), effects)` and
      `resolve(liveBoard, effects)` emit the identical event sequence; no dry-run
      event reaches the Audio/Rendering/HUD shared stream.
- [ ] The bus module imports no renderer/DOM/timer symbol (headless Vitest run
      with no canvas passes).
- [ ] Dispatch overhead for a worst-case single-action event burst measures
      << 0.1 ms (well under the 16.67 ms frame budget).

## GDD Requirements Addressed

<!-- Traceability audited by /architecture-review. -->

| GDD Document | System | Requirement | How This ADR Satisfies It |
|-------------|--------|-------------|--------------------------|
| `design/gdd/combat-resolution.md` | Combat Resolution | "Deterministic engine... produces the same board state and event log, with no RNG, no wall-clock dependence, and no hidden state." Emits the canonical event vocabulary (`damage_applied`, `displacement_complete`, `collision_resolved`, `swap_complete`, `hazard_spawned`, `hazard_applied`, `unit_removed`, `terrain_set`, `unit_spawned`). | Synchronous, registration-ordered dispatch with no deferral makes the emitted event log a pure function of inputs — the mechanism by which Combat's "same event log" guarantee holds end-to-end through its consumers. |
| `design/gdd/audio-system.md` | Audio System | "Read-only, non-blocking consumer" that "subscribes to the canonical event vocabulary emitted by Combat Resolution's `resolve()`"; Move Preview's dry-run events "structurally never enter the shared stream" the Audio System subscribes to. | Provides the single synchronous subscription channel Audio reads from, and guarantees preview events are never published onto it (structural silence, contracts §7) — no `committed` tag needed. |
| `design/gdd/board-rendering-and-juice.md` | Board Rendering & Juice | Drives knockback, hit-flash, spawn-in, and hazard VFX by reading Combat's emitted event log (per `combat-resolution.md` consumer table). | Delivers those events in a deterministic order via `on()`; the record-then-animate guideline lets rendering pace paint via rAF without deferring dispatch. |
| `design/gdd/battle-hud.md` | Battle HUD | Reads events to drive damage numbers / HP-bar updates and the danger/log widgets (read-only consumer). | Same synchronous, ordered event stream; HUD subscribes without the producer knowing it exists (P3). |
| `design/gdd/move-preview.md` | Move Preview | "Silent and subscription-based" (contracts §7): dry-runs Combat `resolve()` on `board.snapshot()` and must match the eventual commit exactly. | Because dispatch is deterministic and preview events are never published to the shared stream, the dry-run's event sequence is identical to the commit's — the correctness property Move Preview depends on. |
| `design/gdd/turn-and-phase-manager.md` | Turn & Phase Manager | Emits phase events (`turn_started`, `player_phase_begun`, `action_applied`, `action_undone`, `enemy_action_resolved`, `enemy_spawned`, `intents_telegraphed`, `battle_ended`) and relies on reproducible undo/replay. | Phase events ride the same synchronous bus; deterministic dispatch is a precondition for the snapshot-based undo/replay reproducibility in A7. |

> Foundational determinism decision. Enables and constrains: Combat Resolution
> (A6), snapshot-based undo & preview (A7), environmental telegraph consumers
> (A11), and every read-only presentation subscriber (Rendering, HUD, Audio,
> Onboarding). Directly serves Architecture Principle **P1 (determinism is a hard
> invariant)** and **P3 (pure simulation core, decoupled from PixiJS)**.

## Related

- `docs/architecture/architecture.md` — §5c (event model), §8-A2 (this ADR's
  mandate), §6 (`EventBus` interface), §9 (Principles P1, P3, P4).
- `design/architecture/cross-system-contracts.md` — §1 (canonical event names),
  §7 (silent subscription-based Move Preview), §4 (Objective is state-poll, not a
  subscriber).
- ADR-0006 (A6) Combat `resolve()` single mutation path — *to be written*
  (produces the events this bus carries).
- ADR-0007 (A7) Snapshot-based undo & preview — *to be written* (its replay
  reproducibility depends on this ADR).
- Code files: `EventBus` module (Foundation) — *to be implemented*.
