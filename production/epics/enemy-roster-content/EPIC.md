# Epic: Enemy Roster Content

> **Layer**: Feature
> **GDD**: design/content/enemy-roster-and-archetypes.md
> **Architecture Module**: Enemy, Abilities & Telegraph
> **Status**: Ready
> **Stories**: 5 stories

## Overview

Implements the full enemy roster and archetypes for VANGUARD. This includes 5 threat patterns (Approach, Artillery, Zone, Support, Boss) and 11 distinct enemy classes such as Drone, Charger, Lobber, Broodmother, and Bosses. Each archetype features specific behavior patterns, target priorities, and escalating variations for Tiers 1 through 3, all designed to hook deterministically into the core Combat Resolution primitives.

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| None | No specific ADRs directly cover the roster content | LOW |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage |
|-------|-------------|--------------|
| TR-ROSTER-001 | Implement Drone: Approach pattern, Swarm Fodder. T1/T2/T3 escalation rules per GDD (Bite -> Venomous Bite). | ❌ No ADR |
| TR-ROSTER-002 | Implement Charger: Approach pattern, Battering Ram. T1/T2/T3 escalation rules per GDD (Charge Strike -> Ram Through with push). | ❌ No ADR |
| TR-ROSTER-003 | Implement Stalker: Approach pattern, Flanker. T1/T2/T3 escalation rules per GDD (Slash -> Ambush). | ❌ No ADR |
| TR-ROSTER-004 | Implement Lobber: Artillery pattern, Mortar. T1/T2/T3 escalation rules per GDD (Acid Glob -> Acid Rain). | ❌ No ADR |
| TR-ROSTER-005 | Implement Spitter: Artillery pattern, Sniper. T1/T2/T3 escalation rules per GDD (Spike Shot -> Impaling Shot). | ❌ No ADR |
| TR-ROSTER-006 | Implement Sentinel: Artillery pattern, Area Denial. T1/T2/T3 escalation rules per GDD (Mine Layer -> Mine Field). | ❌ No ADR |
| TR-ROSTER-007 | Implement Broodmother: Zone pattern, Spawner. T1/T2/T3 escalation rules per GDD (Spawn Brood). | ❌ No ADR |
| TR-ROSTER-008 | Implement Shifter: Zone pattern, Terrain Sculptor. T1/T2/T3 escalation rules per GDD (Erect Wall -> Terraform). | ❌ No ADR |
| TR-ROSTER-009 | Implement Overseer: Support pattern, Aura Buffer. Variants: Warchief, Ironhide, Volatile, Hivemind. | ❌ No ADR |
| TR-ROSTER-010 | Implement Boss 1: Behemoth (The Warlord). Turn parity AI (Slam / Summon), 15 HP. | ❌ No ADR |
| TR-ROSTER-011 | Implement Boss 2: Architect (The Board Controller). Turn parity AI (Rift Tear / Shockwave), 12 HP. | ❌ No ADR |

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/content/enemy-roster-and-archetypes.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Stories

| # | Story | Type | Status | ADR |
|---|-------|------|--------|-----|
| 001 | Approach Enemies | Logic | Ready | N/A |
| 002 | Artillery Enemies | Logic | Ready | N/A |
| 003 | Zone Enemies | Logic | Ready | N/A |
| 004 | Support Enemies | Logic | Ready | N/A |
| 005 | Boss Enemies | Logic | Ready | N/A |

## Next Step

Run `/create-stories enemy-roster-content` to generate or update implementable stories.
