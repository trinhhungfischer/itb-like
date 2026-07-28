// Deterministic Event Bus — unit tests (Vitest)
//
// Verifies ADR-0002 (docs/architecture/adr-0002-deterministic-event-bus.md):
// synchronous, registration-ordered dispatch with no async deferral, plus
// the unsubscribe-during-emit semantics and cross-instance isolation that
// Move Preview's structural silence (contracts §7) depends on.
//
// Naming follows the project standard: test_[system]_[scenario]_[expected].
// All tests are deterministic (no RNG, no time, no iteration-order reliance).

import { describe, it, expect, vi } from 'vitest'
import { EventBus, type BusEvent } from '../../../src/core/events/event-bus'

// --- Test fixture event map -------------------------------------------------
// Deliberately distinct payload shapes per type, to exercise "type safety of
// the payload map" (a handler for 'Ping' must not compile against a 'Pong'
// payload, and vice versa).

interface PingEvent extends BusEvent {
  readonly type: 'Ping'
  readonly seq: number
}

interface PongEvent extends BusEvent {
  readonly type: 'Pong'
  readonly label: string
}

type TestEventMap = {
  Ping: PingEvent
  Pong: PongEvent
}

const ping = (seq: number): PingEvent => ({ type: 'Ping', seq })
const pong = (label: string): PongEvent => ({ type: 'Pong', label })

describe('EventBus: registration-ordered synchronous dispatch (AC-1)', () => {
  it('test_event_bus_emit_invokes_handlers_in_registration_order', () => {
    // Arrange
    const bus = new EventBus<TestEventMap>()
    const order: string[] = []
    bus.on('Ping', () => order.push('first'))
    bus.on('Ping', () => order.push('second'))
    bus.on('Ping', () => order.push('third'))

    // Act
    bus.emit(ping(1))

    // Assert
    expect(order).toEqual(['first', 'second', 'third'])
  })

  it('test_event_bus_emit_with_no_subscribers_does_not_throw', () => {
    // Arrange
    const bus = new EventBus<TestEventMap>()

    // Act + Assert
    expect(() => bus.emit(ping(1))).not.toThrow()
  })

  it('test_event_bus_emit_does_not_cross_fire_other_event_types', () => {
    // Arrange
    const bus = new EventBus<TestEventMap>()
    const pingHandler = vi.fn()
    const pongHandler = vi.fn()
    bus.on('Ping', pingHandler)
    bus.on('Pong', pongHandler)

    // Act
    bus.emit(ping(1))

    // Assert
    expect(pingHandler).toHaveBeenCalledTimes(1)
    expect(pongHandler).not.toHaveBeenCalled()
  })

  it('test_event_bus_handler_receives_exact_payload_passed_to_emit', () => {
    // Arrange
    const bus = new EventBus<TestEventMap>()
    let received: PingEvent | undefined
    bus.on('Ping', (e) => {
      received = e
    })
    const event = ping(42)

    // Act
    bus.emit(event)

    // Assert
    expect(received).toBe(event)
    expect(received?.seq).toBe(42)
  })
})

describe('EventBus: no asynchronous deferral (AC-2)', () => {
  it('test_event_bus_emit_invokes_handler_before_returning_synchronously', () => {
    // Arrange
    const bus = new EventBus<TestEventMap>()
    const handler = vi.fn()
    bus.on('Ping', handler)

    // Act
    bus.emit(ping(1))

    // Assert: the handler already ran — no await, no microtask flush needed.
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('test_event_bus_emit_runs_handlers_on_the_callers_stack', () => {
    // Arrange
    const bus = new EventBus<TestEventMap>()
    let ranSynchronously = false
    bus.on('Ping', () => {
      ranSynchronously = true
    })

    // Act
    bus.emit(ping(1))
    // Assert immediately after the call, on the same synchronous stack —
    // if dispatch were deferred (Promise/microtask/setTimeout/rAF), this
    // flag would still be false here.
    expect(ranSynchronously).toBe(true)
  })
})

describe('EventBus: subscribe / unsubscribe', () => {
  it('test_event_bus_off_stops_future_invocations', () => {
    // Arrange
    const bus = new EventBus<TestEventMap>()
    const handler = vi.fn()
    bus.on('Ping', handler)
    bus.off('Ping', handler)

    // Act
    bus.emit(ping(1))

    // Assert
    expect(handler).not.toHaveBeenCalled()
  })

  it('test_event_bus_off_unknown_handler_is_a_noop', () => {
    // Arrange
    const bus = new EventBus<TestEventMap>()
    const neverRegistered = vi.fn()

    // Act + Assert
    expect(() => bus.off('Ping', neverRegistered)).not.toThrow()
  })

  it('test_event_bus_off_removes_only_the_targeted_handler', () => {
    // Arrange
    const bus = new EventBus<TestEventMap>()
    const order: string[] = []
    const first = (): void => {
      order.push('first')
    }
    const second = (): void => {
      order.push('second')
    }
    bus.on('Ping', first)
    bus.on('Ping', second)
    bus.off('Ping', first)

    // Act
    bus.emit(ping(1))

    // Assert
    expect(order).toEqual(['second'])
  })

  it('test_event_bus_duplicate_registration_fires_handler_once_per_registration', () => {
    // Judgment call: on() unconditionally appends (an ordered array per the
    // ADR's implementation guidelines) — it does not dedupe by reference.
    // Registering the same handler twice means it fires twice per emit().
    // Arrange
    const bus = new EventBus<TestEventMap>()
    const handler = vi.fn()
    bus.on('Ping', handler)
    bus.on('Ping', handler)

    // Act
    bus.emit(ping(1))

    // Assert
    expect(handler).toHaveBeenCalledTimes(2)
  })
})

describe('EventBus: unsubscribe/subscribe-during-emit semantics (edge case)', () => {
  it('test_event_bus_handler_unsubscribing_itself_mid_emit_does_not_skip_later_handlers', () => {
    // Arrange: dispatch snapshots the handler list at the start of emit(),
    // so a handler removing itself (or a later handler) mid-dispatch must
    // not perturb which handlers still run during THIS emit() call.
    const bus = new EventBus<TestEventMap>()
    const order: string[] = []
    const self: (e: PingEvent) => void = () => {
      order.push('self')
      bus.off('Ping', self)
    }
    bus.on('Ping', self)
    bus.on('Ping', () => order.push('after'))

    // Act
    bus.emit(ping(1))

    // Assert: 'after' still ran even though 'self' unsubscribed mid-dispatch.
    expect(order).toEqual(['self', 'after'])
  })

  it('test_event_bus_unsubscribe_mid_emit_takes_effect_only_on_the_next_emit', () => {
    // Arrange
    const bus = new EventBus<TestEventMap>()
    const handler = vi.fn()
    const unsubscriber: (e: PingEvent) => void = () => {
      bus.off('Ping', handler)
    }
    bus.on('Ping', unsubscriber)
    bus.on('Ping', handler)

    // Act: first emit — handler was still subscribed when this emit() began.
    bus.emit(ping(1))
    // Second emit — handler was removed during the first emit().
    bus.emit(ping(2))

    // Assert
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('test_event_bus_subscribe_mid_emit_does_not_run_until_the_next_emit', () => {
    // Arrange
    const bus = new EventBus<TestEventMap>()
    const lateHandler = vi.fn()
    const subscriber: (e: PingEvent) => void = () => {
      bus.on('Ping', lateHandler)
    }
    bus.on('Ping', subscriber)

    // Act
    bus.emit(ping(1))

    // Assert: not invoked during the emit() that registered it...
    expect(lateHandler).not.toHaveBeenCalled()

    // ...but is invoked on the following emit().
    bus.emit(ping(2))
    expect(lateHandler).toHaveBeenCalledTimes(1)
  })
})

describe('EventBus: isolated bus instances (preview/commit structural silence)', () => {
  it('test_event_bus_two_instances_do_not_cross_emit', () => {
    // Arrange: mirrors the shared-bus vs. private-preview-bus split — Move
    // Preview's dry-run resolve() must never reach the shared stream that
    // Audio/Rendering/HUD subscribe to. Because EventBus has no module-level
    // singleton, two constructed instances are independent by construction.
    const sharedBus = new EventBus<TestEventMap>()
    const previewBus = new EventBus<TestEventMap>()
    const sharedHandler = vi.fn()
    const previewHandler = vi.fn()
    sharedBus.on('Ping', sharedHandler)
    previewBus.on('Ping', previewHandler)

    // Act: emit only on the private/preview instance, as a dry-run consumer
    // would.
    previewBus.emit(ping(1))

    // Assert: the shared stream never saw it.
    expect(previewHandler).toHaveBeenCalledTimes(1)
    expect(sharedHandler).not.toHaveBeenCalled()
  })

  it('test_event_bus_committed_emit_does_not_reach_a_separate_preview_bus', () => {
    // Arrange
    const sharedBus = new EventBus<TestEventMap>()
    const previewBus = new EventBus<TestEventMap>()
    const sharedHandler = vi.fn()
    const previewHandler = vi.fn()
    sharedBus.on('Ping', sharedHandler)
    previewBus.on('Ping', previewHandler)

    // Act: emit only on the shared/committed instance.
    sharedBus.emit(ping(1))

    // Assert
    expect(sharedHandler).toHaveBeenCalledTimes(1)
    expect(previewHandler).not.toHaveBeenCalled()
  })
})

describe('EventBus: payload map type safety', () => {
  it('test_event_bus_on_and_emit_accept_correctly_typed_payloads', () => {
    // Arrange + Act: this test's primary assertion is that the following
    // compiles under `tsc --noEmit` (strict mode, no `any`) — a Ping handler
    // is statically known to receive `seq: number`, a Pong handler `label:
    // string`, with no cross-type payload confusion.
    const bus = new EventBus<TestEventMap>()
    let seenSeq = -1
    let seenLabel = ''
    bus.on('Ping', (e) => {
      seenSeq = e.seq
    })
    bus.on('Pong', (e) => {
      seenLabel = e.label
    })

    bus.emit(ping(7))
    bus.emit(pong('hello'))

    // Assert
    expect(seenSeq).toBe(7)
    expect(seenLabel).toBe('hello')
  })

  it('test_event_bus_mismatched_payload_type_is_a_compile_error', () => {
    // Arrange
    const bus = new EventBus<TestEventMap>()

    // Act + Assert: registering a Ping handler that reads a Pong-only field
    // must fail to typecheck. If this line ever stops erroring (e.g. the
    // payload map typing regresses to `any`), `tsc --noEmit` fails on the
    // unused `@ts-expect-error` directive, catching the regression.
    // @ts-expect-error - 'label' does not exist on PingEvent; proves on()'s
    // handler parameter is typed per-event, not `any`/`unknown`.
    bus.on('Ping', (e) => e.label)

    expect(true).toBe(true)
  })
})
