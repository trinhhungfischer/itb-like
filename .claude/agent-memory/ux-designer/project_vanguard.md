---
name: project-vanguard
description: Core facts about the VANGUARD game project relevant to UX/input design work
metadata:
  type: project
---

VANGUARD is a deterministic tactical roguelike (Into the Breach-like) built pure
web: TypeScript + PixiJS + Vite, no native engine, single-player, no networking.
Board is default 8x8, 4-directional orthogonal adjacency, Manhattan distance
(registered in `design/registry/entities.yaml`). Units occupy exactly 1 tile
(v1 — multi-tile units are a deferred/future concern per board-and-grid.md).

**Why:** The whole design is built on five pillars, and #1 "Perfect Information,
Perfect Blame" and #3 "Variety Lives in the Draft, Not the Dice" mean **zero RNG
is allowed inside a battle** — every consequence must be previewable before
commit, and every loss must be a legible player mistake, never bad luck or an
input ambiguity. Pillar #5 "Read in Ten Seconds" means UI/UX work should favor
icon-driven, non-color-reliant legibility over spectacle.

**How to apply:** When designing any battle-facing UX (input, HUD, preview,
tutorial), treat "no silent no-ops" and "full consequence preview before commit"
as hard constraints, not nice-to-haves. Never propose in-battle randomness or
hidden information as a solution to a UX problem — push variety/surprise to the
between-battle draft/meta layer instead. Primary input for v1 is keyboard+mouse
on desktop web browser; gamepad and touch are explicitly out of scope unless the
platform target changes (confirmed when authoring [[input-and-selection]]).

Game concept doc: `design/gdd/game-concept.md`. Systems index (25 systems,
dependency-ordered): `design/gdd/systems-index.md`. Cross-system locked facts
(grid size, formulas) live in `design/registry/entities.yaml` — never contradict
these, reference by name instead of re-deriving numbers.

GDDs are authored one system at a time via a `/design-system` fan-out workflow
(this agent is invoked per-system, not interactively) — each GDD gets a status
header, must include 8 required sections (Overview, Player Fantasy, Detailed
Design/Rules, Formulas, Edge Cases, Dependencies, Tuning Knobs, Acceptance
Criteria) plus Open Questions, and Visual/Audio Requirements for UI/visual
systems. Formulas need variable tables + output range + worked example. Undesigned
dependencies must be marked PROVISIONAL rather than assumed solid.

As of 2026-07-27, designed GDDs include (this agent authored
`design/gdd/input-and-selection.md`, `design/gdd/battle-hud.md`,
`design/gdd/onboarding-tutorial.md`, and `design/gdd/map-run-ui.md`):
`board-and-grid.md`, `turn-and-phase-manager.md`, `input-and-selection.md`,
`combat-resolution.md`, `heroes-and-abilities.md`,
`enemy-abilities-and-telegraph.md`, `objective-and-win-lose.md`,
`move-preview.md`, `board-rendering-and-juice.md`, `audio-system.md`,
`run-persistence.md`, `battle-hud.md`, `onboarding-tutorial.md`,
`run-structure-node-map.md`, `draft-and-loadout-meta.md`,
`ability-upgrades.md`, `encounter-generator.md`, `difficulty-tiers.md`,
`map-run-ui.md`. Turn order is
TurnStart -> PlayerPhase -> Environment -> EnemyResolve -> Spawn -> Telegraph ->
EndCheck; Undo is scoped to Player Phase via a Board `snapshot()` restore (owned
by Turn & Phase Manager, not by whatever system exposes the Undo hotkey).

**Fan-out sessions don't see each other's output.** Every GDD authored via
`/design-system` in this project so far treats ALL sibling systems except
Board & Grid / Turn & Phase Manager as "undesigned/PROVISIONAL," even after
those siblings are actually written same-day — because each authoring pass
only reads `systems-index.md`'s stale "Designed" status column, not the
actual filesystem. **How to apply:** when authoring a GDD late in the
dependency order, actually Read the real sibling GDD files (don't trust
"undesigned" framing from an earlier-written doc) — you likely have ground
truth they didn't. Also: `systems-index.md` itself is stale (still shows
only 2 systems "Designed") and hasn't been updated as GDDs are written —
don't trust its Dependency Map for edges either; cross-check the actual
docs' Dependencies sections instead.

**Known unresolved cross-doc conflict (found authoring battle-hud.md):**
`board-rendering-and-juice.md` already claims full ownership of on-tile
telegraph icon *rendering* (its Layer 5) independent of Battle HUD, but
Battle HUD's assigned scope also included "telegraph intent icons." Resolved
in `battle-hud.md` Rule 13 by splitting taxonomy-ownership (Battle HUD) from
on-tile pixel-ownership (Rendering) plus a non-duplicative "Threat Ticker"
HUD component — flagged for `/consistency-check`, not fully resolved at the
index level. If asked to run consistency-check or touch either doc again,
check `battle-hud.md` Open Questions #1-2 first.

**Onboarding / Tutorial design (`onboarding-tutorial.md`, authored
2026-07-27):** teaches read->plan->act via exactly 3 fixed, hand-authored
Tutorial Missions (board ramps 5x5 -> 6x6 -> 8x8) that bypass Encounter
Generator entirely (deliberate non-dependency — tutorial content ships before
proc-gen exists). Key reusable pattern: sequencing is achieved purely through
battle content (e.g. placing the first enemy out of ability range so the
Ability slot naturally reads "Unavailable — No Legal Target" per
`heroes-and-abilities.md` Rule 8) rather than by inventing any new
input-restriction mechanism — Onboarding never disables a legal action.
Non-punishing design: a tutorial-scoped Defeat auto-retries the same Mission
(intercepted before Objective's real Defeat banner shows), and a one-time
`Skip Tutorial` choice is always offered with no confirmation dialog. Left 3
PROVISIONAL cross-doc gaps flagged for `/consistency-check`, NOT read against
their source docs in that authoring pass (context-budget tradeoff, disclosed
in the doc itself): (1) a new Board Rendering & Juice "Tutorial
Callout/spotlight" rendering interface, (2) a proposed `tutorialCompleted` /
`tutorialSkipped` field addition to `run-persistence.md`'s Meta Save schema
(that doc currently lists Onboarding only as a **Soft** dependent for toast
signals — should become **Hard**), (3) Turn & Phase Manager's exact
battle-bootstrap/Setup entry point for loading fixed (non-procedural) battle
content. If asked to touch `board-rendering-and-juice.md` or
`run-persistence.md` again, reconcile against `onboarding-tutorial.md` Open
Questions #1-3 first.

**Map/Run UI design (`map-run-ui.md`, authored 2026-07-27):** the
presentation shell over `run-structure-node-map.md` (RunMap, node
lifecycle) and `draft-and-loadout-meta.md` (DraftOffer/RestChoice) — pure
render + narrow write calls (`enterNode`, offer-pick, RestChoice), no game
rules of its own. Key pattern reused from `input-and-selection.md`: "hover
previews, click commits," extended to a **mandatory** (not optional) two-stage
confirm for node entry, since a map node has no in-battle-style full-preview
to lean on before an irreversible choice. Resolved a real ambiguity between
this system and the sibling undesigned "Draft/Loadout UI" system
(`systems-index.md` #19): Map/Run UI owns only *node-triggered* screens
(Reward/Rest/Event/post-Victory offers, Starting Roster Draft, Run Summary);
Draft/Loadout UI (not yet authored) owns the player-initiated Roster/bench
and Loadout-configuration screens — flagged PROVISIONAL pending that doc.
Also flagged: zoom-to-fit rejected in favor of vertical scroll for tall maps
(protects min-readable-font-size floor), and `reduced_motion` /
`uiScale` (1.0–2.0, WCAG 200%-equivalent) as required accessibility
settings surfaces this doc introduces (Settings/Options and Accessibility,
both undesigned, are downstream soft consumers of them). If asked to author
`draft-and-loadout-ui` (or equivalent) or touch `run-structure-node-map.md`/
`draft-and-loadout-meta.md` again, reconcile against `map-run-ui.md`'s Rule 2
and Open Questions #1 first.
