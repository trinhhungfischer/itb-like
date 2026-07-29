# ADR-0013: Gadget action slot

## Status
Accepted

## Date
2026-07-29

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Pure Web (TypeScript + PixiJS + Vite) |
| **Domain** | Game Logic / Action Economy |
| **Knowledge Risk** | LOW |
| **References Consulted** | `CLAUDE.md` |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | None |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | None |
| **Enables** | None |
| **Blocks** | None |
| **Ordering Note** | None |

## Context

### Problem Statement
The original design for Gadgets replaced the "Move" action slot with a Gadget action. This core mechanic broke melee heroes, as they rely heavily on their Move action for tactical positioning to reach targets. This ruined the game's tactical positioning and created a severe boundary flaw in the action economy for close-range combatants.

### Constraints
- The game must maintain a strict 2-action economy per hero turn.
- Melee heroes must retain their ability to move and position effectively.

### Requirements
- Gadgets must be usable without crippling melee character viability.
- The 2-action structure must remain structurally intact and legible.

## Decision

Gadgets will consume the "Ability" action slot instead of the "Move" action slot. When a hero uses a Gadget, it uses their Ability action for that turn, preserving their Move action. The hero's turn still strictly consists of 1 Move action and 1 Ability action (which can now be spent on the hero's innate Ability or an equipped Gadget).

### Architecture Diagram
[Move Action] + [Ability Action / Gadget Action] = 2 actions per turn.

### Key Interfaces
- `ActionSystem.consumeAbilitySlot(heroId: string, source: 'innate' | 'gadget')`

## Alternatives Considered

### Alternative 1: Gadgets as a Free Action
- **Description**: Gadgets cost no action points to use.
- **Pros**: Solves the melee hero problem entirely; feels powerful.
- **Cons**: Breaks the strict 2-action economy; creates severe balance issues and power creep.
- **Rejection Reason**: The 2-action economy is a core constraint that must not be broken.

### Alternative 2: Gadgets consume either Move or Ability flexibly
- **Description**: Gadgets can consume whichever slot the player chooses.
- **Pros**: Maximum flexibility for the player.
- **Cons**: Muddies the strict separation of Move and Ability actions, complicating UI and undo/redo logic.
- **Rejection Reason**: Dilutes the clear tactical constraints of the 2-action system.

## Consequences

### Positive
- Melee heroes remain fully viable, as their Move action is preserved for positioning.
- The 2-action economy remains intact and strictly enforced.
- Draft decisions between Gadgets and innate Abilities become more meaningful tactical tradeoffs during a turn.

### Negative
- Gadgets compete directly with innate Abilities for the same action slot, which might make some Gadgets feel less appealing if a hero's innate Ability is very strong.

### Risks
- Players might underutilize Gadgets on heroes with exceptionally strong innate Abilities.
- Mitigation: Design Gadgets to offer situational utility (e.g., healing, area denial) that innate Abilities do not cover.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| secondary-weapons-and-gadgets.md | Resolve action economy contradiction | Changes Gadget cost from Move to Ability |

## Performance Implications
- **CPU**: Negligible impact.
- **Memory**: Negligible impact.
- **Load Time**: Negligible impact.

## Migration Plan
Update `secondary-weapons-and-gadgets.md` and related UI mockups/logic to reflect that activating a Gadget disables the innate Ability button for the turn, rather than the Move button. Update combat resolution logic to deduct the Ability slot instead of the Move slot upon Gadget use.

## Validation Criteria
Playtesting must confirm that melee heroes equipped with Gadgets do not suffer a drop in win rate or tactical viability compared to ranged heroes.

## Related Decisions
- [ADR-0006: Combat Resolve Single Mutation Path](file:///e:/3HP-Project/game-test-3/docs/architecture/adr-0006-combat-resolve-single-mutation-path.md)
