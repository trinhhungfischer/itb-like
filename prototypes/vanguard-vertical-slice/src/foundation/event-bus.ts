// VERTICAL SLICE - NOT FOR PRODUCTION

export type EventHandler<T = unknown> = (payload: T) => void;

export class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();

  on<T>(event: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    const eventHandlers = this.handlers.get(event)!;
    // Cast handler to generic EventHandler to store it
    eventHandlers.push(handler as EventHandler);

    return () => {
      const currentHandlers = this.handlers.get(event);
      if (currentHandlers) {
        this.handlers.set(
          event,
          currentHandlers.filter((h) => h !== handler)
        );
      }
    };
  }

  emit<T>(event: string, payload: T): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      // Invoke handlers in registration order synchronously
      for (const handler of eventHandlers) {
        handler(payload);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
