# Story 001: Implement Deterministic Event Bus

> **Epic**: Event Bus
> **Status**: Complete
> **Layer**: Foundation
> **Type**: Logic
> **Estimate**: 
> **Manifest Version**: 2026-07-28
> **Last Updated**: 2026-07-28
## Context

**GDD**: N/A
**Requirement**: N/A

**ADR Governing Implementation**: ADR-0002: Deterministic synchronous event bus
**ADR Decision Summary**: The event channel connecting Combat/Turn events to their presentation consumers is a synchronous, in-registration-order observer bus with no deferral.

**Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x) | **Risk**: LOW
**Engine Notes**: None engine-specific

**Control Manifest Rules (this layer)**:
- Required: Event Bus `emit()` must be synchronous and invoke subscribers in registration order on the caller's stack
- Forbidden: Event Bus handlers must not defer (no Promise/microtask/setTimeout/rAF)
- Guardrail: N/A

---

## Acceptance Criteria

*From ADR-0002:*

- [ ] Implement `EventBus` class in Foundation layer with `emit`, `on`, and `off` methods.
- [ ] Handlers must fire synchronously, in registration order, and `emit()` returns only after all handlers have completed.
- [ ] No `Promise`, `queueMicrotask`, `setTimeout`, or `requestAnimationFrame` on the emit/dispatch path.
- [ ] The module imports no renderer, DOM, or timer symbols (headless testability).

---

## Implementation Notes

*Derived from ADR-0002 Implementation Guidelines:*

Store handlers per event type in an ordered array, appended to by `on()`. Do not use a `Set`.
`emit()` is a synchronous loop. It must never return a `Promise` and must never be `await`ed.
Construct exactly one bus per session at boot; pass it by injection.
Keep the event objects plain data. No live object references that could vary between runs.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Integration with Combat Resolution (Combat will implement its own emission)
- Subscriptions by presentation systems (Rendering, HUD, Audio will implement their own subscriptions)

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

**[For Logic / Integration stories — automated test specs]:**

- **AC-1**: Handlers fire synchronously in registration order
  - Given: An `EventBus` instance with three handlers registered for the same event type in a specific order.
  - When: `emit()` is called with that event type.
  - Then: The handlers are invoked in the exact order they were registered.
  - Edge cases: Unregistering a handler mid-emit; emitting an event with no subscribers.

- **AC-2**: No asynchronous deferral
  - Given: An `EventBus` instance and a spy handler.
  - When: `emit()` is called.
  - Then: The spy handler is invoked before the `emit()` call returns.

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/event-bus/event_bus_test.ts` — must exist and pass

**Status**: [x] Created and passing (2026-07-28)

---

## Dependencies

- Depends on: None
- Unlocks: None

---

## Completion Notes
**Completed**: 2026-07-28
**Criteria**: all passing — verified by the test at `tests/unit/event-bus/event_bus_test.ts`
**Deviations**: see `docs/tech-debt-register.md` for sprint-level advisories
**Test Evidence**: `tests/unit/event-bus/event_bus_test.ts` (exists, passes; suite 285/285, tsc clean, coverage 98.9%)
**Code Review**: Pending — `/code-review` to be run before sprint close-out
