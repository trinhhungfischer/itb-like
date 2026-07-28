<Epic: Audio System>
> **Layer**: Presentation
> **GDD**: design/gdd/audio-system.md
> **Architecture Module**: Audio System
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories audio-system`

## Overview
The Audio System is a **read-only, event-driven consumer** sitting in the Presentation Layer: it listens to the event streams emitted by Combat Resolution and Turn & Phase Manager (and, once designed, Heroes & Abilities, Enemy Abilities & Telegraph, Move Preview, Objective / Win-Lose, and Input & Selection) and turns them into SFX cues and a light, phase-and-tension-driven adaptive music bed. It owns the **Audio Event Router** (event → cue mapping), a **voice-priority/coalescing layer** that keeps simultaneous resolution events from turning into an unreadable wall of sound, a **bus/mix architecture** (Master / Music / SFX / UI / Ambience) with ducking so gameplay-critical audio is always audible, and a **deterministic variant-selection scheme** that gets sonic variety without ever touching RNG — because the sound system must obey the same "no randomness, no hidden state" contract as everything else in a battle (Pillar #3). Audio never mutates board state, never blocks or delays resolution, and never carries information the board doesn't already show visually — it is strictly supplementary to the "Legible Battlefield" visual language, never a second, competing information channel.

## Governing ADRs
| ADR | Title | Decision Summary | Engine Risk |
|-----|-------|------------------|-------------|
| ADR-0002 | ADR-0002: Deterministic synchronous event bus | VANGUARD's simulation core must be byte-for-byte reproducible so that move preview, undo, and full-run replay all agree with committed play. This ADR ... | LOW |
| ADR-0007 | ADR-0007: Snapshot-based undo & preview reuse one simulation | Both in-phase undo and pre-commit Move Preview are built on a single mechanism — `Board.snapshot()` — feeding the single simulation `Combat.resolve()`... | LOW |
| ADR-0004 | ADR-0004: mulberry32 PRNG seed strategy (procedural only) | VANGUARD needs reproducible procedural variety (map layout, encounter assembly, draft offers) without introducing any non-determinism into battle reso... | LOW |
| ADR-0011 | ADR-0011: Environmental telegraph query (C4) | Resolves cross-system contract C4: who owns the *environmental* (non-enemy-intent) telegraph and how the three consumers that must account for it stay... | LOW |

## GDD Requirements
- TR-AUDIO-001: Covered by ADR-0002
- TR-AUDIO-002: Covered by ADR-0002, ADR-0007
- TR-AUDIO-003: Covered by ADR-0004
- TR-AUDIO-004: Covered by ADR-0011
- TR-AUDIO-005: Covered by ADR-0002
- TR-AUDIO-006: Covered by None (Design/Presentation)

## Definition of Done
This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from the GDD are verified
- All Logic and Integration stories have passing test files in `tests/`
