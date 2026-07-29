# Epic: Passive Modules

> **Layer**: Feature
> **GDD**: design/content/passive-modules-and-equipment.md
> **Architecture Module**: Heroes & Abilities, Combat Resolution
> **Status**: Ready
> **Stories**: 5 stories

## Overview

Implements the Passive Modules and Equipment system. This epic introduces 2 hybrid equipment slots per hero (supporting Passive Modules or Gadgets), establishes the `PassiveModuleDefinition` schema, and integrates module triggers (`OnAction`, `OnHit`, `OnKill`, `OnTurnStart`) into the Combat Resolution and Move Preview systems. It introduces 14 modules across Combat, Tactical, Survival, and Utility categories, fundamentally changing the rules of engagement beyond simple numeric buffs.

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| *None* | ⚠️ Recommended ADR-0012 for "Passive Module resolution timing" is not yet authored. | LOW |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage |
|-------|-------------|--------------|
| *None* | TR-IDs not yet mapped in tr-registry.yaml | ❌ No ADR |

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/content/passive-modules-and-equipment.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Stories

| # | Story | Type | Status | ADR |
|---|-------|------|--------|-----|
| 001 | Equipment Slot Data Model | Logic | Ready | N/A |
| 002 | Passive Trigger System | Logic | Ready | N/A |
| 003 | Trigger Type Implementations | Logic | Ready | N/A |
| 004 | Category Effects Implementation | Logic | Ready | N/A |
| 005 | Draft Integration | Integration | Ready | N/A |

## Next Step

Run `/create-stories passive-modules` to break this epic into implementable stories.
