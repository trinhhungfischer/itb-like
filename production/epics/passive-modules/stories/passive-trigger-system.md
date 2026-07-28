# Passive Trigger System

**Description:** Implement the event listening system to resolve Passive Module triggers (Always, OnAction, OnHit, OnKill, OnTurnStart) by integrating with the Combat Resolution event bus. Follow ADR-0012 to use follow-up resolve() calls.

## Acceptance Criteria
1. The Combat Resolution system emits `OnAction`, `OnHit`, and `OnKill` events to the event bus.
2. The Passive Trigger System correctly listens to these events and queues passive effects for resolution.
3. Passive effects trigger as follow-up `resolve()` calls within the same resolution chain, without interrupting the main effect chain (ADR-0012).
4. `OnTurnStart` and `Always` triggers are evaluated correctly at the start of a turn and continuously, respectively.

**Story Type:** Logic
**Story Points:** 5
**Dependencies:** Equipment Slot Data Model
