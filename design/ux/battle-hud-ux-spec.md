# Battle HUD — UX Specification

> **Screen**: Battle HUD (in-game overlay during combat)
> **GDD Source**: `design/gdd/battle-hud.md`
> **Status**: Draft
> **Date**: 2026-07-28
> **Pillars Served**: #1 Perfect Information, Perfect Blame; #5 Read in Ten Seconds

---

## 1. Screen Purpose & Context
The Battle HUD is the single always-on window into the deterministic battle simulation. It appears during combat and provides all required tactical information at a glance. The player needs to instantly understand the current phase, their available actions, the objective status, and all incoming threats. The success criteria for this screen is that a player can read the complete tactical state and understand their options within 10 seconds (per Pillar #5), ensuring that any mistakes are purely tactical and not UI-related (per Pillar #1).

## 2. Layout Zones
The HUD consists of 6 persistent zones and one on-demand panel (per GDD Rule 2):

*   **Zone A (Turn/Phase Indicator)**: Top-Left. A compact readout of the turn number and a binary state (`Planning` or `Resolving`).
*   **Zone B (Objective/Turn-Limit Display)**: Top-Center. Shows the specific objective (Survive, Protect, Clear, Reach).
*   **Zone C (Ability Bar / Hero Roster)**: Bottom-Left to Bottom-Center. One row/card per living-or-Down hero, showing portrait, HP bar, ability icon, and Move/Ability slot state.
*   **Zone D (Enemy HP + Telegraphs)**: Floating above on-board enemies + Threat Ticker on the Right edge. Shows dual-encoded enemy HP and an off-board summary of threats.
*   **Zone E (End Turn)**: Bottom-Right. A prominent, always-visible primary button.
*   **Zone F (Undo/Redo)**: Bottom-Right, adjacent to the End Turn button.
*   **Unit Inspect Panel**: On-demand panel that expands over Zones C/D when a unit is inspected.

## 3. Information Hierarchy
To satisfy the "10-second glance" test, the visual hierarchy prioritizes immediate threats and available actions:

1.  **FIRST (Highest Priority)**: Incoming Threats (Zone D Telegraphs & Threat Ticker) and End Turn button (Zone E) if the player must act.
2.  **SECOND (Core Tactical State)**: Ability Bar (Zone C) to see available moves and ability slots. Objective status (Zone B).
3.  **THIRD (Context & Safety)**: Turn/Phase (Zone A), Undo/Redo availability (Zone F), and exact numerical HP values.

## 4. Interaction Flows
All interactions follow the pure web mouse + keyboard model from `interaction-patterns.md`:

*   **Selecting a Hero / Using an Ability**: Single-click on a hero (or Tab) selects them. Hovering over a valid target shows a silent, fully deterministic Move Preview. A single click commits the action.
*   **End Turn Confirmation**: Pressing End Turn checks if any hero is standing on a telegraphed threat tile (GDD Rule 10). If so, it triggers an inline soft-confirm warning ("N heroes still in a telegraphed hit — End Turn anyway?").
*   **Undo/Redo**: Single deliberate clicks (or Ctrl+Z / Ctrl+Y) revert or re-apply the state. Disabled visibly outside `PlayerPhase`.
*   **Inspecting an Enemy**: Clicking an enemy or holding Alt (Inspect) opens the read-only Unit Inspect Panel over the HUD, showing exact stats and breaking down complex telegraphs.

## 5. Visual Treatment
The HUD adheres to the `art-bible.md` color system to ensure immediate readability against the `#1A1A24` background:

*   **UI Panels**: `#222230` (Dark slate) with `#F0F0F5` primary text and `#7A7A99` subdued text.
*   **Ability Icons (Verb-Family Colors)**: Shove (`#FF8800`), Pull (`#00CCFF`), Swap (`#BB33FF`), Wall (`#FFCC00`), Zone/AoE (`#00FFAA`).
*   **Threats & Telegraphs**: Lethal/Damage intents (`#FF3333`), Enemy Intent/Movement (`#FF5588`).
*   **HP Bars**: Dual-encoded (GDD Rule 5) with a proportional bar fill and numeric text. Critical HP triggers a distinct border/glyph change, not just a color shift.

## 6. Responsive Behavior
As a web game (PixiJS), the HUD scales fluidly to fit the browser viewport.
*   Minimum supported resolution is 1280x720.
*   Zones A, B, E, and F anchor to their respective screen corners/edges.
*   Zone C (Ability Bar) centers horizontally along the bottom edge, scaling uniformly so hero cards never overlap.
*   Zone D (Threat Ticker) anchors to the right edge. On-board HP bars scale with the camera zoom.

## 7. Accessibility
Adheres strictly to the `accessibility-requirements.md` baseline:

*   **Dual-Encoding**: HP is always shown as both a number and a bar. Critical HP uses a shape/glyph change.
*   **Colorblind Safety**: All telegraphs and abilities are identified by a unique shape/icon paired with their accent color. Color is never the sole information channel.
*   **Keyboard Navigation**: Full keyboard parity (Tab cycling, Enter to commit, Space to End Turn).
*   **Text & Scaling**: Text scales up to 150% without clipping.
*   **Motion**: Reduced-motion settings preserve all informational overlays and HUD elements.

## 8. Edge Cases
*   **0 Heroes Alive**: The game ends via the Objective system; HUD remains in a read-only state showing final stats before the defeat screen.
*   **Hero goes Down mid-turn**: The hero's row in Zone C grays out, their HP bar locks at 0, and their Move/Ability slots update to `Unavailable`.
*   **Objective changes mid-battle**: The objective is fixed per battle (GDD Rule 12). If dynamic updates occur (e.g., enemy count drops), Zone B animates briefly to draw attention, then settles.
*   **All enemies dead but turn not ended**: End Turn button pulses to indicate the phase can be safely advanced, assuming Objective conditions are met.
*   **Inspect panel overlaps ability bar**: The Unit Inspect panel features a semi-transparent `#222230` background or pushes Zone C elements aside to ensure it does not permanently obscure vital state.

## 9. Acceptance Criteria
*   A new player can identify all incoming threats within 10 seconds (greyscale mode enabled).
*   Every HP bar (hero and enemy) displays both a proportional fill and a `current/max` text readout.
*   The End Turn button prevents accidental commits by prompting a warning if a hero is on a telegraphed threat tile.
*   Undo and Redo controls correctly enable/disable based on the phase and stack availability.
*   Ability icons strictly utilize their designated verb-family hex color and corresponding geometric shape.
