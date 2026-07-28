// VERTICAL SLICE - NOT FOR PRODUCTION
import { describe, it, expect } from 'vitest';
import { EventBus } from './event-bus';

describe('EventBus', () => {
  it('invokes handlers in registration order synchronously', () => {
    const bus = new EventBus();
    const calls: number[] = [];

    bus.on<{ value: number }>('test_event', (payload) => {
      calls.push(1);
      expect(payload.value).toBe(42);
    });

    bus.on<{ value: number }>('test_event', (payload) => {
      calls.push(2);
      expect(payload.value).toBe(42);
    });

    bus.emit('test_event', { value: 42 });

    expect(calls).toEqual([1, 2]);
  });

  it('unsubscribes correctly', () => {
    const bus = new EventBus();
    let count = 0;

    const unsubscribe = bus.on('test_event', () => {
      count++;
    });

    bus.emit('test_event', {});
    expect(count).toBe(1);

    unsubscribe();
    bus.emit('test_event', {});
    expect(count).toBe(1);
  });
});
