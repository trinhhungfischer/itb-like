# VANGUARD — Interaction Pattern Library

> UX interaction patterns for the deterministic tactical roguelike VANGUARD (pure web,
> mouse + keyboard). Grounded in `design/gdd/input-and-selection.md`,
> `design/gdd/move-preview.md`, `design/gdd/battle-hud.md`, and
> `design/architecture/cross-system-contracts.md` §7. Governing pillars: #1 Perfect
> Information, #5 Read in Ten Seconds.

## Input Model

- **Primary input:** mouse (hover + single click) with full keyboard parity.
- **Hover-to-preview, single-click-commit** is the core loop of battle interaction:
  hovering a legal destination/target shows the full deterministic consequence
  (Move Preview); a single click commits it. No confirm step by default (an opt-in
  `require_confirm_click` accessibility setting adds a two-step confirm).
- **Input is gated during resolution** (`Locked` state): while Board Rendering is
  animating (`isAnimating()`), input is buffered at depth 1 (last-write-wins,
  re-validated on unlock) — the player can never commit against stale pre-resolution
  state (Pillar #1).

## Selection State Machine (from input-and-selection.md)

`Idle → UnitSelected → Targeting(mode) → Locked → Idle`

| From | Input | To | Feedback |
|------|-------|----|----------|
| Idle | click own hero | UnitSelected | hero highlighted; legal move tiles shown |
| Idle | click enemy / exhausted unit | Idle (Inspect) | read-only stat/intent panel; no command |
| Idle | click empty tile | Idle | deselect (explicit, visible) |
| UnitSelected | choose Move / Ability | Targeting(mode) | valid targets highlighted; invalid dimmed |
| Targeting | hover target | Targeting | Move Preview overlay renders the outcome |
| Targeting | click legal target | Locked → Idle | action commits; resolution animates |
| Targeting | Esc / click self | UnitSelected | cancel targeting |
| any | Tab / Shift-Tab | cycle heroes | deterministic board-order cycle |

## Core Patterns

- **Move Preview (silent overlay):** on hover, the game dry-runs Combat `resolve()`
  against a board snapshot and shows every consequence — pushes, collisions, deaths,
  hazard results, terrain changes. It is **silent** (no audio) and never mutates live
  state. This is the pattern that makes "solve + act in one move" legible.
- **Telegraph reading:** enemy intents AND environmental telegraphs are shown as
  persistent icon/overlay marks on target tiles before the player acts. The threat
  set the HUD warns about unions both sources (C4).
- **Undo / Redo:** free within the current Player Phase (restores prior board
  snapshot); disabled outside it. Undo never crosses a phase boundary. Keyboard:
  Ctrl+Z / Ctrl+Y.
- **End Turn soft-confirm:** if any hero currently stands on a telegraphed threat tile
  (`heroesInDanger`, enemy + environment), End Turn shows a soft confirm rather than
  committing silently — a safety net for Pillar #1.
- **Node-map navigation:** on the run map, hovering a node previews its type/tier;
  clicking a reachable node selects the path. Reward/event/draft screens open as
  focused modals over the map.
- **Draft / Loadout selection:** between battles, offered heroes/abilities/upgrades
  are presented as comparable cards; hover previews the ability's effect; click
  selects. Loadout can be inspected any time from the map.

## Feedback Principles

- Every click produces a **visible result** (commit, cancel, inspect, or deselect) —
  no silent no-ops.
- Legality is shown **before** action: legal tiles/targets highlighted, illegal ones
  dimmed; an ability with zero legal targets renders disabled (never enters Targeting).
- Consequence is shown **before** commit (Move Preview) — the player is never surprised.

## Keyboard Map (default, remappable)

| Action | Key |
|--------|-----|
| Cycle heroes | Tab / Shift+Tab |
| Confirm / commit | Enter / left-click |
| Cancel targeting | Esc / right-click |
| Undo / Redo | Ctrl+Z / Ctrl+Y |
| End Turn | Space |
| Inspect (hold) | Alt |

All bindings are remappable (see `design/ux/accessibility-requirements.md`).
