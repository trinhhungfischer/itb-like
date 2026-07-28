# Trigger Type Implementations

**Description:** Implement the specific behaviors for each trigger type (OnAction, OnHit, OnKill, OnTurnStart, Always) as outlined in the Passive Module schema.

## Acceptance Criteria
1. `OnAction` correctly fires after the hero's ability `resolve()` completes.
2. `OnHit` correctly fires when the hero receives `push` or `pull`, or would be reduced to 0 HP.
3. `OnKill` correctly fires when the hero's ability removes a unit.
4. `OnTurnStart` evaluates conditions (e.g. if ability was skipped last turn) at the start of the hero's turn.
5. Unit tests verify that each trigger correctly identifies its activation conditions.

**Story Type:** Logic
**Story Points:** 3
**Dependencies:** Passive Trigger System
