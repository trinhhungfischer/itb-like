<Epic: Move Preview>
> **Layer**: Core
> **GDD**: design/gdd/move-preview.md
> **Architecture Module**: Move Preview
> **Status**: Ready
> **Stories**: 3 stories

## Stories

| # | Story | Type | Status | ADR |
|---|-------|------|--------|-----|
| 001 | Core Dry-Run Mechanism | Logic | Ready | ADR-0007 |
| 002 | Preview Event Subscription & Lifecycle | Integration | Ready | ADR-0002 |
| 003 | Threat Overlay Cross-Reference | Logic | Ready | ADR-0011 |
## Overview
Move Preview is the mechanism that makes VANGUARD's "commit to nothing you haven't seen" promise (Pillar #1) real: before a player confirms any hero action, Move Preview computes and displays its exact, full consequence by dry-running the same Combat Resolution `resolve()` entry point used for the real commit, against a disposable `Board.snapshot()` instead of the live board. It never introduces a second, parallel simulation — it is a read-only harness around Combat Resolution and Board & Grid's existing contracts, so the previewed outcome and the committed outcome can never diverge. Move Preview owns the *decision of what to compute and when* (staleness, recompute triggers, telegraph cross-referencing) and produces a structured "preview result" (an event log plus a derived visual diff); it does not own rendering (Board Rendering & Juice) or ability legality (Heroes & Abilities / Enemy, Abilities & Telegraph). It is also what lets forced-movement verbs (push/pull/swap) carry Pillar #2's weight — a shove that ends a battle by positioning alone is only trustworthy if its consequence was fully visible before commit. `systems-index.md` flags this system as VANGUARD's single highest-risk technical dependency, because if it lies — even once — the entire "perfect information" premise of the game collapses.

## Governing ADRs
| ADR | Title | Decision Summary | Engine Risk |
|-----|-------|------------------|-------------|
| ADR-0007 | ADR-0007: Snapshot-based undo & preview reuse one simulation | Both in-phase undo and pre-commit Move Preview are built on a single mechanism — `Board.snapshot()` — feeding the single simulation `Combat.resolve()`... | LOW |
| ADR-0006 | ADR-0006: Combat `resolve()` as the single board-mutation path + 10-primitive vocabulary | Combat Resolution's `resolve(board, effects[]) → events[]` is the single, exclusive path that mutates board state, and it does so through a **closed v... | LOW |
| ADR-0002 | ADR-0002: Deterministic synchronous event bus | VANGUARD's simulation core must be byte-for-byte reproducible so that move preview, undo, and full-run replay all agree with committed play. This ADR ... | LOW |
| ADR-0001 | ADR-0001: Board tile-state representation & cheap `snapshot()` | Board tile-state (terrain, occupancy, hazard, flags) is stored as **parallel flat typed arrays** indexed by `index(c, r) = r * W + c`, so `Board.snaps... | LOW |
| ADR-0011 | ADR-0011: Environmental telegraph query (C4) | Resolves cross-system contract C4: who owns the *environmental* (non-enemy-intent) telegraph and how the three consumers that must account for it stay... | LOW |
| ADR-0005 | ADR-0005: Board/Combat error contract (Result vs throw) | Establishes a single, project-wide rule for how the Board & Grid and Combat Resolution layers signal a refused operation: **expected gameplay rejectio... | LOW |

## GDD Requirements
- TR-PREVIEW-001: Covered by ADR-0007, ADR-0006
- TR-PREVIEW-002: Covered by ADR-0002
- TR-PREVIEW-003: Covered by ADR-0001, ADR-0007
- TR-PREVIEW-004: Covered by ADR-0011
- TR-PREVIEW-005: Covered by ADR-0005
- TR-PREVIEW-006: Covered by ADR-0007

## Definition of Done
This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from the GDD are verified
- All Logic and Integration stories have passing test files in `tests/`
