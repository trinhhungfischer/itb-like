# Overseer Aura System

**Description:** Implement the passive aura system for Overseer enemies that modifies all other enemies on the board.

## Acceptance Criteria
1. Overseer aura is applied to all enemies as a runtime stat modifier at `chooseIntents()` time.
2. Aura is instantly removed from all enemies when the Overseer is defeated.
3. Implemented variants: Warchief (+1 damage), Ironhide (+2 maxHP), Volatile (explode on death), Hivemind (+1 moveRange).
4. Only a maximum of 1 Overseer can spawn per encounter.

**Story Type:** Logic
**Story Points:** 5
**Dependencies:** Archetype Ability Definitions
