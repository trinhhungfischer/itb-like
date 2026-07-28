# Cooldown and Uses System

**Description:** Implement the tracking and enforcement of `cooldownTurns` and `usesPerBattle` for Gadgets.

## Acceptance Criteria
1. Gadget availability is false if `cooldownRemaining > 0` or `usesRemaining == 0`.
2. Using a Gadget sets its `cooldownRemaining` to `cooldownTurns` and decrements `usesRemaining` (if not null).
3. `cooldownRemaining` decrements by 1 at the start of each player turn.
4. The UI reflects the current cooldown and remaining uses for the Gadget.
5. Gadgets on cooldown or out of uses cannot be selected in the UI, forcing a normal Move instead.

**Story Type:** Logic
**Story Points:** 3
**Dependencies:** Move or Gadget Action Choice
