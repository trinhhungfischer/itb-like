<Epic: Input & Selection>
> **Layer**: Core
> **GDD**: design/gdd/input-and-selection.md
> **Architecture Module**: Input & Selection
> **Status**: Ready
> **Stories**: 4 stories

## Overview
Input & Selection is the translation layer between raw web input (mouse/pointer and keyboard) and the logical battle state: it converts screen pixels into tile coordinates, tracks what the player has selected (a unit, an action mode, a target), and exposes a single, predictable **hover-to-preview, click-to-commit** interaction model that every hero verb and enemy interaction rides on top of. It owns *only* the selection/targeting state machine and the screen↔tile coordinate contract — it does not decide whether a move is legal (Board & Grid / Combat Resolution do that) and it does not render anything (Board Rendering & Juice does). It exists because Pillar #1 (Perfect Information, Perfect Blame) is a promise about *input*, not just display: the player must be able to preview the full consequence of an action before committing to it, cancel freely before committing, and never have an action "sneak past" them through ambiguous or laggy input handling. Primary input for v1 is **keyboard + mouse on desktop web browser**; gamepad and touch are explicitly out of scope (see Open Questions).

## Governing ADRs
| ADR | Title | Decision Summary | Engine Risk |
|-----|-------|------------------|-------------|
| ADR-0009 | ADR-0009: Shared reachableTiles/BFS + coordinate-transform ownership (C3) | Resolves cross-system contract **C3** by fixing two single-owner boundaries: Board & Grid owns the **one** bounded flood-fill `reachableTiles(origin, ... | LOW |
| ADR-0002 | ADR-0002: Deterministic synchronous event bus | VANGUARD's simulation core must be byte-for-byte reproducible so that move preview, undo, and full-run replay all agree with committed play. This ADR ... | LOW |

## GDD Requirements
- TR-INPUT-001: Covered by ADR-0009
- TR-INPUT-002: Covered by ADR-0002
- TR-INPUT-003: Covered by None (Design/Presentation)
- TR-INPUT-004: Covered by ADR-0009
- TR-INPUT-005: Covered by None (Design/Presentation)

## Definition of Done
This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from the GDD are verified
- All Logic and Integration stories have passing test files in `tests/`

## Stories

| # | Story | Type | Status | ADR |
|---|-------|------|--------|-----|
| 001 | Coordinate Transform Math | Logic | Ready | ADR-0009 |
| 002 | Core Selection State Machine | Integration | Ready | ADR-0002 |
| 003 | Locked State & Input Buffering | Logic | Ready | N/A |
| 004 | Keyboard Operability & Navigation | UI | Ready | N/A |
