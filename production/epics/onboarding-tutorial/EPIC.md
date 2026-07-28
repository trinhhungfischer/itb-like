<Epic: Onboarding / Tutorial>
> **Layer**: Presentation
> **GDD**: design/gdd/onboarding-tutorial.md
> **Architecture Module**: Onboarding / Tutorial
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories onboarding-tutorial`

## Overview
Onboarding / Tutorial is the player's first ten minutes with VANGUARD: a short, fixed sequence of three hand-authored **Tutorial Missions** — small, real battles (not a simulated or scripted-video experience) that teach the **read → plan → act** loop one hero verb at a time, on progressively larger boards, with deliberately obvious telegraphs. It never invents a second simulation or a stripped-down "practice mode" — every tutorial battle runs through the exact same Board & Grid, Turn & Phase Manager, Combat Resolution, Heroes & Abilities, and Enemy, Abilities & Telegraph systems a real run uses, so nothing the player learns is a lie they'll have to unlearn later. This system's only additions are content (three fixed, non-procedural battle templates) and a thin, non-authoritative **coaching layer** — a sequence of **Tutorial Beats** that watch already-public state for a taught action and surface a contextual hint, on a strict discovery-led timer, if the player hasn't found it yet. Onboarding never disables a legal action, never blocks battle progression on its own coaching state, and never punishes a mistake during the tutorial the way a real battle would — it exists to build the player's confidence in the deterministic, fully-telegraphed core loop before handing them a real run, directly serving Pillar #5 (a player who has been taught to read the board in ten seconds trusts every future battle) and Pillar #1 (the tutorial's own failures are always disclosed and recoverable, never a silent trap).

## Governing ADRs
| ADR | Title | Decision Summary | Engine Risk |
|-----|-------|------------------|-------------|
| ADR-0006 | ADR-0006: Combat `resolve()` as the single board-mutation path + 10-primitive vocabulary | Combat Resolution's `resolve(board, effects[]) → events[]` is the single, exclusive path that mutates board state, and it does so through a **closed v... | LOW |
| ADR-0007 | ADR-0007: Snapshot-based undo & preview reuse one simulation | Both in-phase undo and pre-commit Move Preview are built on a single mechanism — `Board.snapshot()` — feeding the single simulation `Combat.resolve()`... | LOW |
| ADR-0003 | ADR-0003: Run Persistence save schema & versioning | Pins the on-disk save format for VANGUARD's browser-local persistence: a `{schemaVersion, checksum, data}` envelope written to `window.localStorage` u... | LOW |

## GDD Requirements
- TR-TUTORIAL-001: Covered by ADR-0006, ADR-0007
- TR-TUTORIAL-002: Covered by None (Design/Presentation)
- TR-TUTORIAL-003: Covered by ADR-0003
- TR-TUTORIAL-004: Covered by None (Design/Presentation)

## Definition of Done
This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from the GDD are verified
- All Logic and Integration stories have passing test files in `tests/`
