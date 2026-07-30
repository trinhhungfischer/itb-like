# Epic: Interaction Patterns

> **Layer**: Presentation
> **GDD**: design/ux/interaction-patterns.md
> **Architecture Module**: InputAndSelection
> **Status**: Ready

## Overview

Implements the UX interaction patterns for VANGUARD: hover-to-preview, single-click-commit, selection state machine, and Move Preview overlays. It guarantees that the player is never surprised by an action's consequence.

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0007: Snapshot Undo Preview | Move preview utilizes state snapshotting | LOW |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage |
|-------|-------------|--------------|
| TR-INT-001 | Selection State Machine | ADR-0007 ✅ |
| TR-INT-002 | Move Preview | ADR-0007 ✅ |

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/ux/interaction-patterns.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Stories

| # | Story | Type | Status | ADR |
|---|-------|------|--------|-----|
| 001 | Selection State Machine | Logic | Ready | ADR-0007 |
| 002 | Move Preview Overlay | UI | Ready | ADR-0007 |
| 003 | Undo/Redo & Confirm | Logic | Ready | ADR-0007 |
