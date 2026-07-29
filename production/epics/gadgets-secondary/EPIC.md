# Epic: Gadgets & Secondary Weapons

> **Layer**: Feature
> **GDD**: design/content/secondary-weapons-and-gadgets.md
> **Architecture Module**: Heroes & Abilities
> **Status**: Ready
> **Stories**: 5 stories

## Overview

Implements Gadgets as a second, constrained action option that heroes can use instead of their signature Ability slot. This preserves the limit of 2 actions per turn (Move + Ability OR Gadget) and allows tactical flexibility without breaking the core positioning verbs. The epic covers the `GadgetDefinition` schema, hero equipment slots constraints (max 1 gadget), cooldown and uses tracking per battle, new hazards like Smoke, and integration into the Draft/Loadout meta pool.

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0013: Gadget action slot | Gadgets consume the Ability action slot, not the Move slot. | LOW |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage |
|-------|-------------|--------------|
| TR-GADGET-001 | GadgetDefinition schema supporting cooldownTurns and usesPerBattle constraints. | ❌ No ADR |
| TR-GADGET-002 | Hero equipment state: 2 Equipment slots shared with Passives, max 1 Gadget equipped. | ❌ No ADR |
| TR-GADGET-003 | Action economy: Gadget consumes the Ability slot (Move + Gadget), preserving 2 actions/turn. | ADR-0013 ✅ |
| TR-GADGET-004 | New Smoke hazard: Blocks unit targeting, does not block movement, duration 1. | ❌ No ADR |
| TR-GADGET-005 | Decoy Drone: A non-acting hero-team unit that attracts F1 target selection. | ❌ No ADR |
| TR-GADGET-006 | Draft Meta: Add Gadgets to mixed reward pools and Shop (costs 3 Reputation). | ❌ No ADR |

## Stories

| # | Story | Type | Status | ADR |
|---|-------|------|--------|-----|
| 001 | Gadget Schema and Equipment Slots | Logic | Ready | N/A |
| 002 | Gadget Action Economy | Logic | Ready | ADR-0013 |
| 003 | Smoke Hazard | Logic | Ready | N/A |
| 004 | Decoy Drone | Logic | Ready | N/A |
| 005 | Draft Pool Integration | Integration | Ready | N/A |

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/content/secondary-weapons-and-gadgets.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Next Step

Run `/story-readiness` then `/dev-story` to begin implementation.
