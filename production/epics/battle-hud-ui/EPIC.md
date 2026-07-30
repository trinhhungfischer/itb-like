# Epic: Battle HUD UI

> **Layer**: Presentation
> **GDD**: design/ux/battle-hud-ux-spec.md
> **Architecture Module**: BattleHUD
> **Status**: Ready

## Overview

The Battle HUD is the single always-on window into the deterministic battle simulation. It appears during combat and provides all required tactical information at a glance, allowing the player to understand the complete tactical state and options within 10 seconds.

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0001: Board Tile State Snapshot | HUD reads from snapshot state | LOW |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage |
|-------|-------------|--------------|
| TR-HUD-001 | HUD Layout & Zones | ADR-0001 ✅ |
| TR-HUD-002 | 10 Second Readability | ❌ No ADR |

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/ux/battle-hud-ux-spec.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Stories

| # | Story | Type | Status | ADR |
|---|-------|------|--------|-----|
| 001 | HUD Layout & Zones A-B-E | UI | Ready | ADR-0001 |
| 002 | HUD Zone C (Ability Bar) | UI | Ready | ADR-0001 |
| 003 | HUD Zone D (Threat Ticker) | UI | Ready | ADR-0001 |
| 004 | Unit Inspect Panel | UI | Ready | ADR-0001 |
