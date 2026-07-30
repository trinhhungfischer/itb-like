# Epic: PIXI Renderer

> **Layer**: Presentation
> **GDD**: design/gdd/board-rendering-and-juice.md
> **Architecture Module**: BoardRenderingAndJuice
> **Status**: Ready

## Overview

The pure view layer of a VANGUARD battle using PixiJS. It reads the current state of the Board and the event log emitted by Combat Resolution, and turns them into pixels. It owns the pixel-geometry contract, but never mutates Board or Combat state.

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0009: Reachable Tiles Coordinate Transform | PixiJS handles the coordinate transform contract | LOW |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage |
|-------|-------------|--------------|
| TR-REND-001 | Render Board State | ADR-0009 ✅ |
| TR-REND-002 | Juice Playback | ❌ No ADR |

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/board-rendering-and-juice.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Stories

| # | Story | Type | Status | ADR |
|---|-------|------|--------|-----|
| 001 | PIXI Board & Tile Rendering | Visual/Feel | Ready | ADR-0009 |
| 002 | Entity & State Rendering | Visual/Feel | Ready | ADR-0009 |
| 003 | Basic Animations & Juice | Visual/Feel | Ready | N/A |
