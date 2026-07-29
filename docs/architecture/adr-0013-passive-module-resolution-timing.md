# ADR-0013: Passive Module resolution timing

## Status
Proposed

## Date
2026-07-29

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | None (pure-web stack: TypeScript strict + PixiJS + Vite) |
| **Domain** | Core / Scripting |
| **Knowledge Risk** | LOW |
| **References Consulted** | `design/content/passive-modules-and-equipment.md`, `docs/architecture/adr-0002-deterministic-event-bus.md`, `docs/architecture/adr-0006-combat-resolve-single-mutation-path.md` |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | Headless Vitest determinism parity tests |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0002 (Deterministic synchronous event bus), ADR-0006 (Combat `resolve()` single mutation path) |
| **Enables** | None |
| **Blocks** | Implementation of Passive Modules (e.g. Shatter Strike, Slipstream, Aftershock) |
| **Ordering Note** | Must be implemented within Combat Resolution |

## Context

### Problem Statement
Passive modules (e.g., Shatter Strike, Slipstream) introduce effects triggered by Combat Resolution events (`OnAction`, `OnKill`, `OnHit`). If these effects are injected synchronously mid-resolution, they risk breaking the "single-mutation path" contract established in ADR-0006 and causing unpredictable chained state mutations. We need a defined timing and structure for resolving passive effects so they integrate deterministically with the existing event bus.

### Constraints
- Must maintain Combat Resolution's single-mutation path contract.
- Must be fully deterministic for Move Preview dry-runs.
- Must not cause infinite loops (e.g., passives triggering passives).
- Must work within the synchronous deterministic event bus (ADR-0002).

### Requirements
- Support triggers like `OnAction`, `OnHit`, `OnKill`, `OnTurnStart`.
- Passive effects must translate into the 10 standard Combat Resolution primitives.
- Support deterministic resolution order (e.g., ascending unit ID) when multiple passives trigger simultaneously.

## Decision

Passive module effects triggered by Combat Resolution events (e.g., `OnHit`, `OnKill`) will resolve as **follow-up `resolve()` calls**, rather than being injected mid-chain. 

When a passive trigger condition is met during the evaluation of a primary `resolve()` call, the Combat Resolution engine queues the passive's effect primitives. Once the primary effect chain completes, the engine immediately initiates a secondary `resolve()` cycle for the queued passive effects. This preserves Combat Resolution's single-chain contract by treating passives like Enemy on-death effects (Rule 13 of enemy GDD).

### Architecture Diagram

```text
Action -> resolve(primary_effects)
  ├─ Mutate State
  ├─ Emit 'OnKill' Event
  │    └─ Passive Module subscribes to 'OnKill' -> queues passive_effects
  └─ End primary resolve()
-> Process queued passive_effects
-> resolve(passive_effects)
  └─ Mutate State (deterministic)
```

### Key Interfaces
- `CombatEngine.queuePassiveEffect(effect: EffectPrimitive[])`
- Passive trigger hooks listen to the synchronous Event Bus and call `queuePassiveEffect`.

## Alternatives Considered

### Alternative 1: Synchronous Mid-Chain Injection
- **Description**: Inject passive effect primitives directly into the currently executing `resolve()` queue.
- **Pros**: Immediate execution, seemingly simpler state.
- **Cons**: Violates the single-mutation path contract. Can cause deeply nested state mutations where a push triggers a kill which triggers a chain reaction before the original push finishes. Highly prone to infinite loops and impossible to reason about.
- **Rejection Reason**: Breaks determinism and violates ADR-0006.

### Alternative 2: Event Bus Observer Side-Effects
- **Description**: Passives directly subscribe to the Event Bus and mutate the board state when triggered, completely bypassing `resolve()`.
- **Pros**: Fits standard event-driven architectures.
- **Cons**: Bypasses the `resolve()` single-mutation path completely. Move Preview would not be able to predict the side-effects without replicating the logic.
- **Rejection Reason**: Violates ADR-0006.

## Consequences

### Positive
- Preserves the single-mutation path contract of `resolve()`.
- Guaranteed determinism and Move Preview compatibility.
- Clear mental model: primary action finishes, then consequences (passives) happen sequentially.

### Negative
- Requires a queuing mechanism within the Combat Engine for secondary effects.
- Visual presentation might feel slightly delayed if not carefully juiced (the primary action finishes before the chain reaction starts visually).

### Risks
- **Infinite Loops**: A passive could trigger an event that triggers the same passive ad infinitum.
- **Mitigation**: Implement a strict "max chain depth" or "once per turn per trigger" guard in the passive queuing logic.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| passive-modules-and-equipment.md | Stacking Rules & Deterministic Triggers | Establishes queue order (e.g. by unit ID) and deterministic resolution cycles via follow-up resolve calls. |

## Performance Implications
- **CPU**: Negligible. Resolving enqueued arrays synchronously is fast.
- **Memory**: Minimal overhead for the effect queue.
- **Load Time**: None.
- **Network**: N/A.

## Migration Plan
The Combat Resolution engine needs to be updated to maintain a `passiveEffectQueue` and loop until the queue is empty at the end of every `resolve()` call. 

## Validation Criteria
- Headless Vitest tests verifying that a chain-reaction kill (e.g., Chain Reaction passive) resolves deterministically.
- Move Preview outputs exactly match the committed state when passive modules are active.

## Related Decisions
- [ADR-0002: Deterministic synchronous event bus](adr-0002-deterministic-event-bus.md)
- [ADR-0006: Combat resolve single mutation path](adr-0006-combat-resolve-single-mutation-path.md)
