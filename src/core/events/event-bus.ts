/**
 * Deterministic Event Bus (Foundation layer)
 *
 * Implements the synchronous, registration-ordered observer bus mandated by
 * ADR-0002 (`docs/architecture/adr-0002-deterministic-event-bus.md`). This is
 * the single event channel Combat Resolution and the Turn & Phase Manager use
 * to notify read-only presentation consumers (Board Rendering & Juice, Battle
 * HUD, Audio System) without those producers ever importing or knowing about
 * their consumers (Principle P3).
 *
 * ## Determinism contract (ADR-0002)
 * - `emit()` invokes every handler registered for the event's `type`
 *   **synchronously, in registration order, on the caller's call stack**.
 *   `emit()` returns only after every handler has run to completion.
 * - There is **no** deferral of any kind on the dispatch path: no `Promise`,
 *   `queueMicrotask`, `setTimeout`, or `requestAnimationFrame`.
 * - Handlers are stored in an ordered array per event type (never a `Set`),
 *   so dispatch order is never ambiguous.
 *
 * ## Type safety
 * `EventBus` is generic over a caller-supplied `TEventMap` — a mapping from
 * event `type` string to the full event payload shape for that type. This
 * module intentionally does not hardcode the canonical Combat/Turn event
 * vocabulary (`damage_applied`, `turn_started`, etc.) — that vocabulary is
 * owned by Combat Resolution (ADR-0006) and the Turn & Phase Manager, which
 * will each instantiate their own `EventBus<TheirEventMap>`. This keeps
 * Foundation decoupled from Feature/Core payload shapes while still giving
 * `on()`/`off()`/`emit()` full compile-time payload checking with no `any`.
 *
 * ## Unsubscribe-during-emit semantics
 * `emit()` dispatches over a **snapshot** of the handler list taken at the
 * moment `emit()` is called. Consequently, within a single `emit()` call:
 * - A handler that calls `off()` on itself or another handler does **not**
 *   change which handlers run during *this* `emit()` call — the snapshot is
 *   already fixed. The unsubscribe takes effect starting with the *next*
 *   `emit()` of that type.
 * - A handler that calls `on()` to add a new subscriber does **not** cause
 *   that new subscriber to run during *this* `emit()` call, only future ones.
 * This keeps a single `emit()` call's invocation set a pure function of the
 * subscriptions that existed when it started, independent of what a handler
 * does mid-dispatch — required for the byte-identical event log ADR-0002
 * demands.
 *
 * ## Preview / commit isolation
 * The bus has no notion of "committed" vs "preview" and no `committed` flag
 * (contracts §7). Isolation is structural: construct one `EventBus` instance
 * per independent event stream — the shared session bus that Audio/
 * Rendering/HUD subscribe to, and, separately, any private bus a dry-run
 * consumer such as Move Preview wants to observe its own `resolve()` calls
 * through — and never emit dry-run events onto the shared instance. Because
 * `EventBus` is a plain injectable class with no module-level singleton, two
 * instances are fully independent by construction: emitting on one never
 * invokes handlers registered on another.
 *
 * @example
 * ```ts
 * interface AppEvents {
 *   damage_applied: { type: 'damage_applied'; targetId: string; amount: number };
 *   unit_removed: { type: 'unit_removed'; unitId: string };
 * }
 *
 * const bus = new EventBus<AppEvents>();
 * bus.on('damage_applied', (e) => console.log(e.targetId, e.amount));
 * bus.emit({ type: 'damage_applied', targetId: 'u1', amount: 3 });
 * ```
 */

/** Base shape every bus event must satisfy: a string discriminant `type`. */
export interface BusEvent {
  readonly type: string;
}

/**
 * Maps each event's `type` discriminant to its full event shape. Callers
 * define their own event map (e.g. a future `CombatEventMap`) to get
 * compile-time-checked `on()`/`off()`/`emit()` calls.
 */
export type EventMap = Record<string, BusEvent>;

/** A synchronous handler for events of shape `E`. Must not return a value. */
export type EventHandler<E extends BusEvent> = (event: E) => void;

/**
 * Internal, type-erased handler shape used for storage only. Never exposed
 * on the public API — `on()`/`off()`/`emit()` are fully typed against
 * `TEventMap`.
 */
type AnyHandler = (event: BusEvent) => void;

/**
 * Synchronous, registration-ordered, in-process event bus.
 *
 * Construct one instance per independent event stream via dependency
 * injection (never a module-level singleton — see class doc comment for the
 * preview/commit isolation rationale).
 *
 * @typeParam TEventMap - Maps each event `type` string to its payload shape.
 */
export class EventBus<TEventMap extends EventMap> {
  private readonly handlersByType = new Map<string, AnyHandler[]>();

  /**
   * Registers `handler` to be invoked whenever `emit()` is called with an
   * event whose `type === type`. Appends to the end of the ordered handler
   * list for `type`, so registration order determines dispatch order.
   *
   * Registering the same handler twice for the same type registers it
   * twice; it will be invoked twice per matching `emit()` call. Call `off()`
   * once per `on()` to fully unsubscribe.
   *
   * @example
   * ```ts
   * bus.on('unit_removed', (e) => console.log(`removed ${e.unitId}`));
   * ```
   */
  on<K extends keyof TEventMap & string>(type: K, handler: EventHandler<TEventMap[K]>): void {
    let list = this.handlersByType.get(type);
    if (list === undefined) {
      list = [];
      this.handlersByType.set(type, list);
    }
    // Safety of this boundary cast: `on<K>` only ever pushes handlers typed
    // for `TEventMap[K]` into the bucket keyed by `type === K`, and `emit()`
    // only ever looks up handlers by `event.type` and invokes them with that
    // same event. Each per-key bucket is therefore always homogeneous at
    // runtime, even though a single `Map`'s value type cannot express "the
    // array for key K only contains EventHandler<TEventMap[K]>" per key.
    // This is the module's one intentional type-erasure boundary; it is not
    // an `any` — the erased type is the `unknown`-payload `AnyHandler`, and
    // the public API surface (`on`/`off`/`emit`) remains fully typed.
    list.push(handler as unknown as AnyHandler);
  }

  /**
   * Removes a previously registered `handler` for `type`. If `handler` was
   * never registered (or was already removed) for `type`, this is a no-op —
   * `off()` never throws.
   *
   * Safe to call from inside a handler currently executing during `emit()`;
   * see the class doc comment's "Unsubscribe-during-emit semantics" section
   * for exactly what that does and does not affect.
   *
   * @example
   * ```ts
   * const onDamage = (e: DamageAppliedEvent) => { ... };
   * bus.on('damage_applied', onDamage);
   * bus.off('damage_applied', onDamage);
   * ```
   */
  off<K extends keyof TEventMap & string>(type: K, handler: EventHandler<TEventMap[K]>): void {
    const list = this.handlersByType.get(type);
    if (list === undefined) return;
    const target = handler as unknown as AnyHandler;
    const index = list.indexOf(target);
    if (index !== -1) {
      list.splice(index, 1);
    }
  }

  /**
   * Synchronously invokes every handler registered for `event.type`, in
   * registration order, on the caller's call stack. Returns only after every
   * handler has run to completion. If no handler is registered for
   * `event.type`, this is a no-op.
   *
   * Dispatches over a snapshot of the handler list taken at the start of
   * this call — see the class doc comment's "Unsubscribe-during-emit
   * semantics" section.
   *
   * @example
   * ```ts
   * bus.emit({ type: 'damage_applied', targetId: 'u1', amount: 3 });
   * ```
   */
  emit(event: TEventMap[keyof TEventMap]): void {
    const list = this.handlersByType.get(event.type);
    if (list === undefined || list.length === 0) return;
    const snapshot = list.slice();
    for (const handler of snapshot) {
      handler(event);
    }
  }
}
