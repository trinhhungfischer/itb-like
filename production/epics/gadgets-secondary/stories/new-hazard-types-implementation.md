# New Hazard Types Implementation

**Description:** Implement the new `Mine` and `Smoke` hazard types introduced by Gadgets and Enemies, updating Board State and Combat Resolution.

## Acceptance Criteria
1. `Mine` hazard is added: triggers on-step (any unit enters tile), deals 3 damage, infinite duration, consumed on trigger.
2. `Smoke` hazard is added: deals 0 damage, lasts 1 turn.
3. Smoke hazard blocks enemy AI targeting (AI Formula F1 skips units on Smoke as candidates).
4. Smoke does not block movement or player ability Line of Sight.
5. Existing hazard logic correctly supports on-step triggers and passive targeting blocks alongside existing per-tick triggers.

**Story Type:** Logic
**Story Points:** 5
**Dependencies:** None
