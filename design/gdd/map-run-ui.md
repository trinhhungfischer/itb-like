# Map/Run UI

> **Status**: In Design
> **Author**: workflow (design-system fan-out)
> **Last Updated**: 2026-07-27
> **Implements Pillar**: #1 Perfect Information, Perfect Blame; #5 Read in Ten Seconds (supports #3 Variety Lives in the Draft, Not the Dice)

## Overview

Map/Run UI is the player-facing shell around the campaign layer: it renders
Run Structure / Node Map's `RunMap` as an explorable, clickable graph (the
**map screen**), handles the input flow for choosing and committing to a
node (**path selection**), and presents every node-triggered resolution
screen that isn't a battle — the Reward offer screen, the Rest heal-vs-train
choice, the Event placeholder, the Starting Roster Draft, and the
post-Battle/Elite-Victory bonus offer screen (collectively, **reward/event
screens**) — by rendering Draft / Loadout Meta's `DraftOffer`/`RestChoice`
data and forwarding the player's picks back to it. It also owns the
**run summary** screen shown at `run_completed`/`run_abandoned`. This system
has no game-rule authority of its own: every number, every offer, every
legality check it displays or enforces is computed by Run Structure / Node
Map or Draft / Loadout Meta and merely rendered here — Map/Run UI's entire
job is to make those systems' guarantees (full map visibility, fully-legible
offers, no hidden odds) *actually readable and operable* by a human at a
keyboard, which is precisely where Pillar #1 (Perfect Information, Perfect
Blame) and Pillar #5 (Read in Ten Seconds) stop being backend promises and
start being lived player experience.

## Player Fantasy

Run Structure / Node Map's Player Fantasy names the feeling this system is
responsible for *delivering*: **"I am charting my own campaign, and every
choice on this map is mine to own."** A backend that guarantees full
information is worthless if the UI hides it behind a hover state nobody
finds, buries a trade-off in body text nobody reads, or lets a misclick
commit an irreversible node choice — so this system's contribution to that
fantasy is **confidence**: the player should be able to look at the map
screen for ten seconds and know exactly what's ahead (Pillar #5), linger on
any node without fear of accidentally committing to it (non-destructive
hover/detail), and make every irreversible choice — entering a node, picking
a draft offer, choosing Heal over Train — through a deliberate, legible
confirm step that matches the weight of the decision. The failure state of
this system is a UI that *undermines* a fully-designed, fully-fair backend:
a node type that's ambiguous at a glance, an offer card whose value isn't
obvious until read closely, or a confirm flow so frictionless that a
misclick can spend an irreversible resource. Every rule below exists to
prevent that gap between "the game is fair" and "the game *feels* fair."

## Detailed Design

### Core Rules

1. **Ownership boundary.** Map/Run UI owns: the map screen (node graph
   rendering, hover/focus detail, path-selection input, confirm-to-enter),
   the node-triggered resolution screens — Reward offer screen, Rest
   heal-vs-train choice screen, Event placeholder screen (Rule 10,
   PROVISIONAL), post-Battle/Elite-Victory offer screen, and the Starting
   Roster Draft screen — and the Run Summary screen. It does **not** own:
   map topology, node legality, or offer/reward *content* (Run Structure /
   Node Map, Draft / Loadout Meta own all of that — this system only
   renders their outputs and forwards player input back to their public
   APIs); the Roster/bench browsing screen or the Loadout configuration
   screen (Rule 2 — assigned to the sibling **Draft/Loadout UI** system);
   battle rendering of any kind (Board Rendering & Juice, Battle HUD); or
   audio playback (Audio System — this document only enumerates required
   hook points, per Visual/Audio Requirements).
2. **Screen-ownership split with Draft/Loadout UI (confirmed for Roster
   Hub / Loadout Config; a residual overlap remains open).**
   `systems-index.md` lists this document (Map/Run UI) and **Draft/Loadout
   UI** ✅ (Designed, `design/gdd/draft-loadout-ui.md`) as sibling
   presentation systems depending on Draft / Loadout Meta. This document
   draws the line as: **Map/Run UI owns every screen that is *triggered by
   entering a specific node*** (Reward/Rest/Event/post-Victory offers,
   Starting Roster Draft — all transient, node-scoped, and gated by Run
   Structure's node-lifecycle state per Rule 9 below); **Draft/Loadout UI
   owns every screen the player can open at will, independent of any
   specific node** (its Roster Hub and Loadout Configuration screens, per
   that document's own Core Rule 1 "presentation and interaction only"
   scope). Map/Run UI renders only a compact, read-only **Roster Summary
   Widget** on the base map screen (member count/portraits, per
   `run-structure-node-map.md`'s Interactions table and
   `draft-and-loadout-meta.md`'s own "Roster summary for map-screen
   display... Soft, read-only consumer" row) that, when activated, **hands
   off** to Draft/Loadout UI's **Roster Hub** state — that document's own
   States and Transitions table names `RosterHub` as exactly the screen
   reachable "from the map screen via a persistent 'Squad' entry point"
   (its Rule 3), which is what this Roster Summary Widget *is* — from
   Roster Hub the player may separately open Loadout Configuration inside
   Draft/Loadout UI's own flow. Map/Run UI does not implement Loadout
   reconfiguration itself. **Confirmed** for this specific hand-off, now
   that Draft/Loadout UI is Designed. **Still open:** `draft-loadout-ui.md`'s
   own Rule 2 additionally names the Offer Screen, Rest Choice screen, and
   Starting Roster Draft as screens *it* defines — the same three screens
   this document's Rule 1 and Rules 7–9 claim as Map/Run UI's node-triggered
   resolution screens. That overlap is not resolved by this pass (Open
   Questions).
3. **The map screen renders the entire `RunMap` with no omissions (Pillar
   #1, made literal).** Every `MapNode`'s `type`, `tierIndex`, and `state`,
   and every `MapEdge`, are drawn simultaneously — there is no
   progressive-reveal, no "fog past row 3," no pagination. This is a direct
   UI-level enforcement of `run-structure-node-map.md` Rule 3's "whole map
   visible" guarantee: that guarantee is meaningless unless the UI actually
   shows it all at once. If `map_depth × nodes_per_row` grows large enough
   that the full graph exceeds the viewport, the map screen becomes
   **vertically scrollable** (never zoomed-to-fit) — see Edge Cases for why
   zoom-to-fit is explicitly rejected.
4. **Five mutually-exclusive node visual states (Formula F2).** Every
   rendered node is in exactly one of: **Reachable** (the player's live,
   clickable choice set — Run Structure's `reachableNodes()`),
   **CurrentPosition** (the single node the player just came from),
   **Claimed** (already resolved, in the player's taken path),
   **Bypassed** (a sibling node in an already-resolved row that was not
   chosen — history, not availability), or **FutureLocked** (visible,
   type/tier known, but not yet in the reachable set — beyond the very next
   row). Each state has a visually distinct, non-color-reliant treatment
   (Visual/Audio Requirements) — this is the map-screen expression of
   Pillar #1's "player always knows what they can and can't do right now."
5. **Hover/focus is always non-committing; only an explicit confirm commits
   (matches this project's established input-design convention).** Moving
   the pointer or keyboard-cursor over any node — Reachable or not — opens
   a **Node Detail panel** (type, tier, and, for Battle/Elite/Boss nodes,
   an explicit "contents unknown until entered" line honoring Run
   Structure's Rule 3 "topology and type are known; contents are not"
   boundary) without mutating any state, exactly mirroring
   `input-and-selection.md`'s "hover previews, click commits" pattern
   extended from the battle grid to the campaign map.
6. **Node entry is always a deliberate two-stage confirm (never a single
   click), unlike default in-battle move commits.** Because entering a
   Battle/Elite/Boss/Reward/Event/Rest node is **irreversible** (Run
   Structure's Rule 4 one-way progression — there is no undo at the map
   layer the way Player Phase has one) and, for combat node types, opens a
   real risk (Run Defeat), Map/Run UI **always** requires: (1) select a
   Reachable node (click or Enter/Space on keyboard focus) — this arms a
   visible **Confirm Entry** prompt but changes no game state; (2) a
   second, distinct confirm input (a second click on the same node, or
   Enter/Space again) that must arrive **at least `min_confirm_delay_ms`
   after the first** (Formula F4) — only then is `enterNode(nodeId)`
   called. This differs from `input-and-selection.md`'s `require_confirm_click`
   knob (optional there, because in-battle moves are already fully
   previewed before commit) — here the confirm step is **mandatory,
   not a tuning knob**, because a map node has no equivalent full-consequence
   preview to already rely on (Edge Cases explains the accidental-double-input
   case this specifically guards against).
7. **The Reward/Rest/post-Victory/Starting-Draft offer screen is one shared
   component, parametrized by context.** All four contexts render the same
   underlying `DraftOffer[]` (or `RestChoice`) shape from Draft / Loadout
   Meta and share one card-grid layout (Formula F3) and one
   confirm-to-pick interaction — this avoids four divergent screen designs
   for what is mechanically one interaction pattern (pick exactly one from
   a fully-legible set), reducing the player's UI vocabulary to a single
   learned pattern (a legibility win in its own right). The **only**
   structural differences between contexts are: (a) Starting Roster Draft
   requires **`squad_size` picks**, not one, with a live "N of `squad_size`
   selected" counter and no `Skip` card (per `draft-and-loadout-meta.md`
   Rule 4 / Edge Cases — Skip is not offered there); (b) every other
   context is a single pick including the always-present `Skip` card.
8. **Offer cards render full value up front — no hidden-value interaction.**
   A `NewHeroOffer` card shows the hero's name, verb/kit summary, and base
   stats; an `AbilityUpgradeOffer` card shows the target Roster member, the
   upgrade's name, and its exact numeric/behavioral effect; `SkipOffer`
   is visually a full card, not a de-emphasized afterthought, so declining
   never reads as "the wrong answer." No card requires a click to reveal
   its value — Pillar #1 extended to the draft screen, matching
   `draft-and-loadout-meta.md`'s own "no hidden-value trade-off anywhere in
   this document's flow" Visual/Audio requirement.
9. **Rest node's Heal choice previews its exact outcome before commit.**
   Selecting "Heal" (before final confirm) shows every Roster member's
   current HP **and** its exact post-heal HP per Draft / Loadout Meta's
   Formula F5, side by side, for the whole Roster (not just the active
   Loadout) — the player commits to a fully previewed number, never an
   estimate or a range.
10. **Event nodes render a generic placeholder screen (PROVISIONAL).**
    Because Event-node content is owned by a currently-undesigned future
    narrative/event-content system (per `run-structure-node-map.md` Rule
    12 and `draft-and-loadout-meta.md`'s Open Question #6), Map/Run UI
    ships a minimal stand-in: a single-panel screen with placeholder title
    text and one **Continue** action that calls
    `resolveNode(nodeId, {outcome: Completed})` directly — this keeps the
    run flow fully playable end-to-end before that system exists, and is
    explicitly flagged for replacement (Open Questions), not a permanent
    design.
11. **The Run Summary screen is the single terminal screen for a run.**
    On `run_completed(Victory)`, `run_completed(Defeat)`, or
    `run_abandoned` (Run Structure Rule 15), Map/Run UI replaces the map
    screen with a Run Summary: the terminal outcome (Victory / Defeat /
    Abandoned), the final route taken (every `Claimed` node, in order,
    read directly off the `RunMap` — no separate history log needed since
    `MapNode.state` already records it), and final Roster state (member
    count, HP, filled upgrade slots) pulled read-only from Draft / Loadout
    Meta. It offers exactly one forward action ("Return to Title" / "New
    Run") — there is no "continue" from a terminal run state, matching Run
    Structure's own "exactly one terminal outcome, ever" guarantee.
12. **Screen transitions gate on node-resolution state, not on data
    availability.** The Loadout configuration hand-off (Rule 2) is only
    reachable from the base map screen with no resolution screen active —
    matching Draft / Loadout Meta's Rule 6 `InTurn`-adjacent gating
    philosophy extended to this system's own screens (Edge Cases). The
    reverse is also true: once a resolution screen is open (offer, rest,
    event, starting draft), the map screen underneath is not interactable
    until that screen resolves — a resolution screen is always modal.
13. **Battle hand-off is a one-way transition, not a Map/Run UI
    responsibility.** When `enterNode()` succeeds for a Battle/Elite/Boss
    node, Map/Run UI plays a brief transition (Visual/Audio Requirements)
    and yields control entirely to the battle stack
    (`run-structure-node-map.md` Rule 14's `startBattle()` orchestration) —
    it does not render anything battle-related and does not regain control
    until that battle's `battle_ended` event (surfaced back through Run
    Structure) returns the player either to a post-Victory offer screen
    (Rule 8's shared component) or to the Run Summary screen (Rule 11, on
    Defeat).
14. **Reproducibility is inherited, not re-implemented.** Because
    `RunMap` generation (Run Structure Rule 16) and `DraftOffer` generation
    (Draft / Loadout Meta Rule 16) are both already byte-identical for a
    given seed, Map/Run UI requires no seed-awareness of its own — it is a
    pure render of whatever state those systems hand it, so two sessions
    with an identical `runSeed` render identical map screens and identical
    offer screens by construction, with zero additional logic in this
    document.

### Data Contracts

```
NodeVisualState = Reachable | CurrentPosition | Claimed | Bypassed | FutureLocked   // Formula F2

MapScreenViewModel {
  nodes: { node: MapNode, screenPos: {x,y}, visualState: NodeVisualState }[]   // Formulas F1, F2
  edges: MapEdge[]                          // straight-line render, from RunMap
  currentNodeId: int | null
  rosterSummary: { memberCount: int, portraits: string[] }   // read-only, from Draft/Loadout Meta
}

OfferScreenViewModel {
  context: Reward | Rest_Train | Battle_Victory | Elite_Victory | StartingDraft
  offers: DraftOffer[]                      // includes SkipOffer except StartingDraft (Rule 7)
  pickTarget: 1 | squad_size                // 1 for all contexts except StartingDraft
  selected: DraftOffer[]                    // grows as the player picks (StartingDraft only; else max len 1)
}

RestScreenViewModel {
  rosterPreview: { member: RosterMember, currentHP: int, postHealHP: int }[]   // Formula F5 (Draft/Loadout Meta)
  trainOffer: OfferScreenViewModel | null   // populated only after "Train" is chosen (Rule 9's forced category)
}

RunSummaryViewModel {
  outcome: Victory | Defeat | Abandoned
  claimedRoute: MapNode[]                   // in row order, state==Claimed
  finalRoster: RosterMember[]               // read-only snapshot at run end
}
```

### States and Transitions

**Map/Run UI's own screen-level state machine** (the presentation layer
sitting on top of Run Structure's run-level and node-level state machines):

```
PreRun --StartingDraftScreen(complete)--> MapScreen
MapScreen --hover/focus node--> MapScreen (NodeDetailPanel open, non-committing, Rule 5)
MapScreen --select Reachable node--> MapScreen (ConfirmEntryPrompt armed, Rule 6)
MapScreen (ConfirmEntryPrompt armed) --confirm (>= min_confirm_delay_ms later)--> [enterNode() call]
  --Battle/Elite/Boss node--> BattleHandoff (Rule 13) --battle_ended(Victory)--> OfferScreen(post-Victory) --resolved--> MapScreen
  --battle_ended(Victory), Boss node--> RunSummaryScreen(Victory)   // no offer screen, Draft/Loadout Meta Rule 12
  --battle_ended(Defeat)--> RunSummaryScreen(Defeat)
  --Reward node--> OfferScreen(Reward) --resolved (resolveNode Completed)--> MapScreen
  --Rest node--> RestScreen --Heal chosen & confirmed--> MapScreen
                 RestScreen --Train chosen--> OfferScreen(Rest_Train) --resolved--> MapScreen
  --Event node--> EventPlaceholderScreen --Continue--> MapScreen (Rule 10)
MapScreen --Roster Summary Widget activated--> [hand off to Draft/Loadout UI's RosterHub state] --return--> MapScreen
MapScreen --Abandon (no battle in progress)--> RunSummaryScreen(Abandoned)
Any BattleHandoff --Abandon mid-battle (propagated)--> RunSummaryScreen(Abandoned)
RunSummaryScreen --acknowledge--> [exit to Title / New Run, out of this document's scope]
```

**Modality rule** (Rule 12): every screen except `MapScreen` itself is
modal — while `ConfirmEntryPrompt`, any `OfferScreen`, `RestScreen`, or
`EventPlaceholderScreen` is open, the underlying map is rendered but
non-interactive (dimmed, no hover/click accepted) until that screen
resolves.

### Interactions with Other Systems

Map/Run UI is a **read-mostly render layer with narrow, well-defined write
calls**: it never mutates Run Structure's or Draft / Loadout Meta's state
directly — every mutation goes through their own public APIs
(`enterNode`, offer-pick resolution, `RestChoice` resolution), triggered by
a fully-confirmed player action.

| System | Map/Run UI reads | Map/Run UI calls (writes) | Ownership boundary |
|---|---|---|---|
| **Run Structure / Node Map** ✅ | Full `RunMap` (nodes/edges/types/tiers/states), `currentNodeId`, `reachableNodes()` (live, Rule 3) | `enterNode(nodeId)`, only after Rule 6's two-stage confirm resolves | Run Structure owns legality and topology; Map/Run UI owns rendering and the confirm gate in front of the call |
| **Draft / Loadout Meta** ✅ | `Roster` (for the Roster Summary Widget), live `DraftOffer[]`/`RestChoice` sets, `RosterMember` HP for Rest preview (Formula F5) | Offer pick resolution, `RestChoice` resolution (Heal/Train), Starting Roster Draft's `squad_size` picks | Draft / Loadout Meta owns offer content and legality; Map/Run UI owns the screen and forwards the player's pick verbatim |
| **Run Persistence** ✅ (indirect) | Whatever `RunMap`/offer/Roster state Persistence hands back on `loadRun()` resume | — | Read-only; session-resume recovery is entirely Persistence's contract (`run-persistence.md`), Map/Run UI just re-renders whatever it's given, per its own scope note in Edge Cases |
| **Draft/Loadout UI** ✅ (sibling) | — | Hands off control to Draft/Loadout UI's `RosterHub` state on Roster Summary Widget activation (Rule 2) | **Soft** — the Roster Hub / Loadout Config split is confirmed against that document's own Core Rule 1; the Offer/Rest/StartingDraft screen-ownership overlap between the two documents remains an open item (Open Questions) |
| **4X-lite Node Bonuses** ✅ (`node-bonuses.md`, Designed 2026-07-28) | `MapNode.state == Claimed` (the only extension point `run-structure-node-map.md` commits to) | — | **Hard** — the reserved badge-render slot on `Claimed` nodes is now filled by that system's bonus icons; this document also renders its active-bonus panel, its pre-claim bonus preview (required by Pillar 1), and consumes its `revealDepth` (Formula F4) |
| **Audio System** ✅ (indirect) | — | Fires named UI event hooks (Visual/Audio Requirements) for Audio System to bind SFX to | **Soft** — Map/Run UI enumerates the hook points; Audio System owns all playback, matching this project's established convention (e.g. `run-structure-node-map.md`'s equivalent section) |
| **Accessibility** ✅ (`accessibility.md`, Designed 2026-07-28) | — | Exposes `uiScale` (Formula F5) and `reduced_motion`. Accessibility requires `uiScale` cover `[1.0, 1.5]` without clipping (its A3) and `reduced_motion` default from the OS `prefers-reduced-motion` query (its A8) — it constrains the required range, it does not redefine the knobs | **Hard** downstream |
| **Settings / Options** ✅ (`settings-and-options.md`, Designed 2026-07-28) | — | Same `uiScale`/`reduced_motion` surface; Settings persists and surfaces them in its own `vanguard.settings.v{N}` domain and must not redefine their ranges | **Hard** downstream |

**Bidirectional-consistency notes** (this document does not edit any of the
files below, per this task's constraints — flagged for the next
`/consistency-check` pass):
- `run-structure-node-map.md`'s Interactions table already lists Map/Run UI
  as a downstream, read-only consumer of the full `RunMap` and
  `reachableNodes()`, calling `enterNode()` on click — this document
  confirms that contract exactly and upgrades it from that document's own
  "Hard, provisional" to simply **Hard** from this side.
- `draft-and-loadout-meta.md`'s Interactions table already lists Map/Run UI
  as a "Soft, read-only consumer" of Roster summary data for map-screen
  display — this document confirms that specific scope (the Roster Summary
  Widget, Rule 2) but clarifies it is deliberately **narrow**: full
  Roster/Loadout interaction is *not* this document's responsibility, and
  hands off to Draft/Loadout UI's `RosterHub` state instead. Now that
  Draft/Loadout UI ✅ is Designed, its own Core Rule 1 confirms the
  Roster Hub / Loadout Config half of this split; the Offer/Rest/
  StartingDraft half remains an open overlap between the two documents
  (Rule 2, Open Questions).
- `systems-index.md` lists Map/Run UI as depending on "Run Structure / Node
  Map, Draft / Loadout Meta, 4X-lite Node Bonuses" — consistent with the
  table above; this document does not surface any dependency edge missing
  from that list.

## Formulas

All formulas are deterministic, pure functions of already-deterministic
upstream state (`RunMap`, `DraftOffer[]`) plus presentation-layer inputs
(viewport size, timestamps, the `uiScale` setting) — none introduce
randomness. Examples use v1 defaults: `nodes_per_row=3`, `map_depth=6`,
`min_confirm_delay_ms=400`, `card_min_width_px=220`,
`card_max_width_px=360`, `card_gap_px=24`.

### F1. Node screen-position mapping

```
rowWidth(row) = nodes_per_row for regular rows (1..map_depth); 1 for the Boss row (map_depth+1)
screenX(node) = mapOriginX + (node.col - (rowWidth(node.row) - 1) / 2) × colSpacingPx
screenY(node) = mapOriginY - node.row × rowSpacingPx
```

Row 1 renders nearest the bottom of the map canvas (the player's current
position, the "ground") and the Boss renders at the top (the destination
being climbed toward) — the vertical-climb metaphor this project shares
with its named reference Slay the Spire (`game-concept.md`'s Inspiration
table). Each row is horizontally **centered** around `mapOriginX`
independent of its width, so row-width variety (Run Structure's
`nodes_per_row` knob, or a narrower Boss row) never produces a visually
lopsided graph.

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| node row | `node.row` | int | `1..map_depth+1` | From `MapNode` |
| node column | `node.col` | int | `0..rowWidth(row)-1` | From `MapNode` |
| row width | `rowWidth(row)` | int | `≥1` | `nodes_per_row` for regular rows, `1` for Boss |
| map origin | `mapOriginX`, `mapOriginY` | px | any | Canvas-space anchor for row 1's center |
| column spacing | `colSpacingPx` | px | `120–260` (default 180, Tuning Knobs) | Horizontal gap between adjacent columns |
| row spacing | `rowSpacingPx` | px | `160–320` (default 220, Tuning Knobs) | Vertical gap between adjacent rows |

**Output:** a pixel coordinate pair per node; unbounded in `y` for tall maps
(Edge Cases — this is what makes the map screen scrollable rather than
zoomed-to-fit). **Worked example** (defaults, `mapOriginX=640,
mapOriginY=900`): node `(row=3, col=1)`, a regular row (`rowWidth=3`):
`screenX = 640 + (1 - 1) × 180 = 640`; `screenY = 900 - 3×220 = 240`. Boss
node `(row=7, col=0)`, `rowWidth=1`: `screenX = 640 + (0-0)×180 = 640`
(centered, matching every other row); `screenY = 900 - 7×220 = -640` —
well above the visible canvas at these defaults, which is the expected,
common case for a 6-row map and exactly why Rule 3 mandates a scrollable
canvas rather than a fixed one.

### F2. Node visual-state classification

```
nodeVisualState(node, runMap):
  if node.nodeId == runMap.currentNodeId:        return CurrentPosition
  elif node.state == Claimed:                    return Claimed
  elif node.state == Bypassed:                   return Bypassed
  elif node.nodeId in reachable(runMap):         return Reachable   // Run Structure Formula F7
  else:                                            return FutureLocked
```

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| node | `node` | MapNode | — | The node being classified |
| run map | `runMap` | RunMap | — | Current campaign state |
| reachable set | `reachable(runMap)` | set of nodeId | Run Structure Formula F7 | Reused verbatim, not re-derived |

**Output:** exactly one of 5 enum values per node, total coverage — proof:
`MapNode.state ∈ {Unvisited, Bypassed, Claimed}` is already an exhaustive,
disjoint partition (`run-structure-node-map.md`'s own state machine);
`CurrentPosition` is a refinement applying to exactly the one `Claimed`
node matching `currentNodeId`, checked first in the if-chain so no node is
ever double-classified; `Reachable` vs. `FutureLocked` is the remaining
`Unvisited` split, decided by Run Structure's own reachability formula, so
this function introduces no new legality logic, only a rendering label.
**Worked example** (using `run-structure-node-map.md`'s own F5 worked
example: `currentNodeId = nodeId(row=2, col=1) = 7`, `reachable(runMap) =
{ nodeId(row=3,col=1)=10, nodeId(row=3,col=2)=11 }`): node `(row=2,col=1)`
→ `nodeId==currentNodeId` → **CurrentPosition**. Node `(row=3,col=2)`,
`nodeId=11`, `state=Unvisited` → in `reachable(runMap)` → **Reachable**.
Node `(row=4,col=0)`, `nodeId=14`, `state=Unvisited`, not in the reachable
set (rows beyond `r+1` are never reachable) → **FutureLocked**. Node
`(row=1,col=2)`, `state=Bypassed` (a sibling of whatever row-1 node was
originally entered) → **Bypassed**.

### F3. Responsive offer-card grid width

```
rawWidthPx = (viewportWidthPx - (offerCount+1) × cardGapPx) / offerCount
cardWidthPx = clamp(rawWidthPx, cardMinWidthPx, cardMaxWidthPx)
layoutMode = SingleRow if rawWidthPx >= cardMinWidthPx else VerticalStack   // Edge Cases
```

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| viewport width | `viewportWidthPx` | px | any | Current browser/canvas width |
| offer count | `offerCount` | int | `1–6`, context-dependent (`draft-and-loadout-meta.md` Tuning Knobs): `battle_victory_offer_count` 0–2 → 1–3 incl. Skip; `reward_offer_count` 2–4 → 3–5 incl. Skip; Rest's Train fixed at 1 → 2 incl. Skip; `elite_victory_offer_count` 2–5 → 3–6 incl. Skip; Starting Draft's `starting_offer_count` 4–6 (at `squad_size=3`), no Skip | Includes `SkipOffer` except Starting Draft |
| card gap | `cardGapPx` | px | `12–40` (default 24, Tuning Knobs) | Space between and around cards |
| card min width | `cardMinWidthPx` | px | `160–280` (default 220, Tuning Knobs) | Below this, text becomes unreadable — hard floor |
| card max width | `cardMaxWidthPx` | px | `280–480` (default 360, Tuning Knobs) | Above this, a single card wastes screen space relative to its content |

**Output:** `cardWidthPx ∈ [cardMinWidthPx, cardMaxWidthPx]` always — text
never renders below the readable floor (Accessibility Checklist: "Text
readable at minimum font size"). **Worked example 1** (`viewportWidthPx=1280,
offerCount=4` — 3 offers + Skip, `cardGapPx=24`): `rawWidthPx = (1280 -
5×24)/4 = 1160/4 = 290`; `290 ≥ 220` → `cardWidthPx = clamp(290,220,360) =
290`, `layoutMode = SingleRow`. **Worked example 2** (narrow viewport,
`viewportWidthPx=800, offerCount=5` — Starting Draft, no Skip, 5 offers):
`rawWidthPx = (800 - 6×24)/5 = 656/5 = 131.2`; `131.2 < 220` →
`layoutMode = VerticalStack` at the fixed floor `cardWidthPx = 220`
(Edge Cases).

### F4. Confirm-dwell validity for irreversible node entry

```
confirmValid(tSelectMs, tConfirmMs) = (tConfirmMs - tSelectMs) >= min_confirm_delay_ms
```

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| select timestamp | `tSelectMs` | ms | any | When the first (arming) input occurred |
| confirm timestamp | `tConfirmMs` | ms | any, `≥ tSelectMs` | When the second (committing) input occurred |
| minimum delay | `min_confirm_delay_ms` | ms | `150–800` (default 400, Tuning Knobs) | Motor-accessibility floor against accidental double-input |

**Output:** boolean. **Worked example 1** (accidental rapid double-click,
default knob): `tSelectMs=1000, tConfirmMs=1250` → `250 < 400` → **invalid**
— the confirm input is ignored; the `ConfirmEntryPrompt` remains armed and
open, no state changes (Edge Cases). **Worked example 2** (deliberate
second click): `tSelectMs=1000, tConfirmMs=1500` → `500 ≥ 400` → **valid** —
`enterNode(nodeId)` is called.

### F5. Accessibility text/layout scale

```
renderedFontSizePx = baseFontSizePx × uiScale
renderedCardMinWidthPx = cardMinWidthPx × uiScale
```

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| base font size | `baseFontSizePx` | px | `≥12` (authored per text element) | Design-time authored size at `uiScale=1.0` |
| UI scale | `uiScale` | float | `[1.0, ui_scale_max]` (default `1.0`, max `2.0`, Tuning Knobs) | Player accessibility setting — **never below `1.0`**, so scaling only ever grows text/targets, never shrinks below the authored floor |

**Output:** `renderedFontSizePx ≥ baseFontSizePx` and `renderedCardMinWidthPx
≥ cardMinWidthPx` always, by construction (`uiScale ≥ 1.0`). **Worked
example** (`baseFontSizePx=16, cardMinWidthPx=220, uiScale=1.5`):
`renderedFontSizePx = 24`; `renderedCardMinWidthPx = 330` — this feeds back
into Formula F3 as the new floor, so a high `uiScale` combined with a large
`offerCount` triggers `VerticalStack` layout sooner (the intended
interaction: bigger text means fewer cards fit per row, so the layout must
wrap more readily rather than ever shrinking text to force a fit).

## Edge Cases

- **The full `RunMap` is taller than the viewport (Rule 3, Formula F1's
  worked example):** the map screen becomes vertically scrollable at
  authored `colSpacingPx`/`rowSpacingPx`, **never** zoomed-to-fit — zooming
  to fit an arbitrarily tall map would shrink node icons and labels below
  the readable-font-size accessibility floor for a large `map_depth`,
  directly violating the Accessibility Checklist; scrolling has no such
  floor violation.
- **Player hovers/focuses a `FutureLocked` or `Bypassed` node:** the Node
  Detail panel opens exactly as for a Reachable node (type + tier), but
  shows **no** confirm affordance at all (no "Enter" button renders) —
  this is a passive, read-only information state, never a disabled-looking
  button that invites a frustrated click.
- **Player attempts the confirm input faster than `min_confirm_delay_ms`
  after select (Formula F4):** the input is silently ignored — the
  `ConfirmEntryPrompt` stays open and armed, no error toast, no state
  change, no `enterNode()` call. This specifically guards against a
  double-click or button-mash chain accidentally committing an irreversible
  node choice the instant it's selected.
- **The `reachableNodes()` set changes between the confirm prompt opening
  and the confirm input arriving** (only possible via a session-desync bug,
  since nothing else can mutate `currentNodeId` while the map screen is
  open and modal, Rule 12): the confirm input is rejected and the UI
  re-renders against the current, authoritative `reachableNodes()` — no
  stale-state `enterNode()` call is ever made.
- **An offer screen is generated with only `{SkipOffer}`** (both Draft /
  Loadout Meta candidate pools exhausted, that document's own Edge Cases):
  Map/Run UI renders a single, centered `Skip` card with an explanatory
  line ("No further options available — your Roster and its upgrades are
  fully built") rather than an empty or visually broken grid — Formula F3
  still applies with `offerCount=1`.
- **`rawWidthPx < cardMinWidthPx` at the current viewport/offerCount/uiScale
  combination (Formula F3):** the offer grid switches from a horizontal row
  to a vertically scrollable stack of fixed-`cardMinWidthPx` cards — text
  is never shrunk below the readable floor to force a horizontal fit.
- **Player resizes the browser window while any screen is open:** layout
  recomputes on the next frame via Formulas F1/F3; this is a pure
  presentation recompute — no game state (`RunMap`, `Roster`,
  `DraftOffer[]`) is read, written, or regenerated by a resize.
- **Event node entered (Rule 10, PROVISIONAL):** the generic placeholder
  screen renders regardless of any real Event content, and its single
  `Continue` action always successfully calls
  `resolveNode(nodeId, Completed)` — this is a deliberate stand-in so the
  run never blocks on the undesigned event-content system; it must be
  replaced wholesale (not extended) once that system exists.
- **Player attempts to activate the Roster Summary Widget's hand-off to
  Draft/Loadout UI while a resolution screen (offer/rest/event/starting
  draft) is open:** rejected — the widget itself is not rendered/
  interactable while any resolution screen is modal (Rule 12); Loadout
  reconfiguration is only ever reachable from the bare map screen.
- **A run ends (`Victory`/`Defeat`/`Abandoned`) while an offer screen is
  open:** cannot occur by construction — post-Victory offers (Rule 8) are
  always the *last* thing shown before returning to `MapScreen`, and
  `Defeat`/`Abandoned` only ever originate from a battle in progress
  (Rule 13's `BattleHandoff`), a state in which no Map/Run UI resolution
  screen can simultaneously be open (they're mutually exclusive per the
  screen-state machine above) — no teardown special-casing is required.
- **Player triggers a browser refresh or navigates away mid-run:** entirely
  out of this document's scope — Run Persistence's `loadRun()` resume
  determines what state exists on next load; Map/Run UI simply re-renders
  whatever `RunMap`/offer/Roster state it is handed, with no special
  "recovering from a crash" UI state of its own (`run-persistence.md`
  owns that contract).
- **`uiScale` is set to its maximum (`2.0`) on a small viewport:** Formula
  F5 raises `renderedCardMinWidthPx` to `440` (at default
  `cardMinWidthPx=220`), which per Formula F3 pushes `layoutMode` to
  `VerticalStack` far more readily — this is correct and intended: no text
  is ever clipped or shrunk to preserve a horizontal layout at high
  `uiScale`.
- **A future node type is proposed that cannot be reliably distinguished
  from an existing type by silhouette alone at map-icon scale** (a
  content-authoring guardrail, not a runtime failure): rejected at design
  time per the Legible Battlefield "silhouette-first" test — this is a
  design-process constraint on future content, not a code path this
  document specifies.

## Dependencies

**Upstream (Map/Run UI depends on):**

| System | Interface | Hard / Soft |
|---|---|---|
| **Run Structure / Node Map** ✅ | Full `RunMap` (nodes/edges/types/tiers/states), `currentNodeId`, `reachableNodes()`; calls `enterNode(nodeId)` after confirm | **Hard** |
| **Draft / Loadout Meta** ✅ | `Roster` summary, live `DraftOffer[]`/`RestChoice` sets, `RosterMember.currentHP` for Rest preview (Formula F5, that document's); calls offer-pick / Rest-choice / Starting-Draft-pick resolution | **Hard** |
| **Run Persistence** ✅ (indirect) | Whatever state `loadRun()` hands back on resume | **Soft** — no direct calls, pure re-render |
| **Input & Selection** ✅ (pattern reuse, not a runtime call) | Reuses the established "hover previews, click commits" convention (Rule 5) and keyboard-cursor precedent, adapted from tiles to graph nodes | **Soft** — a design-convention dependency, not an interface call |

**Downstream (systems that depend on Map/Run UI):**

| Dependent System | Interface (what it uses) | Hard / Soft |
|---|---|---|
| **Draft/Loadout UI** ✅ (sibling) | Receives control (enters its `RosterHub` state) on Roster Summary Widget activation (Rule 2); returns control to `MapScreen` on close | **Soft** — Roster Hub / Loadout Config screen-ownership confirmed against that document's own Core Rule 1; the Offer/Rest/StartingDraft overlap between the two documents remains an open item (Open Questions) |
| **4X-lite Node Bonuses** ✅ | Badge on `Claimed` nodes, active-bonus panel, pre-claim bonus preview, `revealDepth` | **Hard** |
| **Audio System** ✅ | Named UI event hooks (Visual/Audio Requirements) | **Soft** |
| **Accessibility** ✅ | `uiScale`, `reduced_motion` settings surface (Formula F5, Visual/Audio Requirements) | **Hard** |
| **Settings / Options** ✅ | Same settings surface as above | **Hard** |

**Bidirectional-consistency note:** see the "Bidirectional-consistency
notes" paragraph at the end of Interactions with Other Systems above for
the specific upgrades/clarifications this document proposes to
`run-structure-node-map.md`'s and `draft-and-loadout-meta.md`'s existing
Downstream rows — flagged for the next `/consistency-check` pass rather
than edited directly here.

## Tuning Knobs

| Knob | Default | Safe Range | Category | Too Low | Too High |
|---|---|---|---|---|---|
| `min_confirm_delay_ms` | 400 | 150–800 | Feel/Accessibility | Below ~150ms, the two-stage confirm (Rule 6) stops functioning as an accidental-double-input guard — a fast, confident double-click can slip through with no real protection, defeating the rule's purpose | Above ~800ms, deliberate, confident players feel the confirm step as sluggish friction on every single node entry, working against the "quick, confident choice" fantasy this document exists to deliver |
| `card_min_width_px` | 220 | 160–280 | Accessibility (Gate) | Below ~160px, offer card text becomes unreadable regardless of font size — this is the hard floor Formula F3 exists to enforce, so this knob should not be lowered without re-validating minimum font size at that width | Above 280px, small `offerCount` contexts (e.g. Rest's single-offer Train) waste excessive horizontal space before `card_max_width_px` caps it |
| `card_max_width_px` | 360 | 280–480 | Feel | Below 280px, a lone offer (e.g. Rest's Train screen) looks awkwardly small on a wide viewport | Above 480px, a single card can dominate the screen disproportionately to its content, hurting scan-ability of a full multi-card set |
| `card_gap_px` | 24 | 12–40 | Feel | Below 12px, cards visually crowd together, risking misclicks between adjacent cards (a Fitts's-Law target-separation concern) | Above 40px, a large `offerCount` set (e.g. Starting Draft's 5 cards) may force `VerticalStack` mode (Formula F3) even on wide viewports, unnecessarily |
| `col_spacing_px` | 180 | 120–260 | Feel | Below 120px, adjacent-row edges visually cross and clutter (Pillar #5 legibility), especially at `nodes_per_row=5` | Above 260px, the map screen requires excessive horizontal scanning even at `nodes_per_row=3`, working against "read in ten seconds" |
| `row_spacing_px` | 220 | 160–320 | Feel | Below 160px, node icons and their edges crowd vertically, risking hover/click ambiguity between adjacent rows | Above 320px, a `map_depth=6` map (Run Structure's default) requires excessive vertical scrolling even at a normal viewport height, increasing time-to-read the whole route |
| `ui_scale_max` | 2.0 (200%) | 1.5–3.0 | Accessibility | Below 1.5×, the setting fails to meet the common WCAG-aligned "200% text scaling" accessibility target this project should support | Above 3.0×, layout degradation (near-universal `VerticalStack`, Formula F3) becomes severe enough that the map/offer screens may need a dedicated low-density layout mode not yet designed — flagged in Open Questions if raised |
| `node_detail_reveal_delay_ms` | 150 | 0–400 | Feel | At `0`, the Node Detail panel flickers open/closed as the pointer merely passes over nodes en route elsewhere, feeling noisy | Above 400ms, deliberate hovering feels unresponsive — the player must wait noticeably before getting the information Pillar #1 promises is always available |

**Interactions between knobs:**
- `card_min_width_px`, `card_gap_px`, and `ui_scale_max` jointly determine,
  per Formula F3, how many offer cards fit per row at maximum accessibility
  scaling and the largest v1 `offerCount` (Starting Draft's 5) — these
  three should be validated together (does the 5-card Starting Draft still
  render sensibly, even if wrapped, at `uiScale=2.0`?) rather than tuned in
  isolation.
- `col_spacing_px` / `row_spacing_px` and Run Structure's own
  `nodes_per_row` / `map_depth` knobs (that document's Tuning Knobs)
  jointly determine total map canvas size (Formula F1) — raising either
  side without checking the other risks either a cramped map (Pillar #5
  violation) or excessive scroll distance.
- `min_confirm_delay_ms` should be tuned relative to
  `input-and-selection.md`'s `keyboard_repeat_delay_ms` (300ms default) —
  the map-entry confirm delay should generally stay **at or above** that
  battle-input value, since node entry carries strictly higher stakes
  (irreversible, run-affecting) than a single battle move.

## Visual/Audio Requirements

- **Six distinct, silhouette-first node-type icons** (Battle, Elite,
  Reward, Event, Rest, Boss) — matching the "Legible Battlefield" Visual
  Identity Anchor's icon-driven principle (`game-concept.md`), extended
  from in-battle telegraphs to the map screen exactly as
  `run-structure-node-map.md`'s own Visual/Audio Requirements calls for.
  Each icon must remain identifiable in monochrome (colorblind-safety —
  Accessibility Checklist "functional without reliance on color alone").
- **Tier/difficulty escalation must be legible without reading a number** —
  a color/intensity ramp across rows, *plus* a non-color-reliant secondary
  cue (e.g., a small tier-number badge or an increasing icon border
  weight), so the escalation reads correctly for colorblind players too.
- **Five node-state treatments (Formula F2), each non-color-reliant:**
  `Reachable` (a static or slow, low-amplitude "breathing" highlight border,
  capped ≤1Hz and fully disabled under `reduced_motion=true` — never a hard
  strobe/flash, per the Accessibility Checklist's "no flashing content"
  rule), `CurrentPosition` (a distinct marker icon, e.g. a pin/flag, not
  color alone), `Claimed` (a checkmark or filled-icon overlay), `Bypassed`
  (reduced opacity **plus** a faded/desaturated icon treatment — must read
  as "history," never as "disabled" or "an error," per
  `run-structure-node-map.md`'s own requirement), `FutureLocked` (visible
  at full icon clarity — type/tier are never hidden — but with a subdued,
  non-interactive visual weight and no hover-affordance styling).
- **The Boss node is visually unique** — distinct scale, color treatment,
  and iconography from every other node, reading unambiguously as "the
  destination," per `run-structure-node-map.md`'s own requirement.
- **Offer card iconography** distinguishes `NewHeroOffer`,
  `AbilityUpgradeOffer`, and `SkipOffer` at a glance (Rule 8) — reusing,
  where applicable, the same upgraded-ability badge `ability-upgrades.md`
  and `draft-and-loadout-meta.md` already specify for Battle HUD and the
  Roster screen, rather than inventing a second visual language for the
  same fact.
- **No strobing or rapid-flash effects anywhere in this system.** Any
  emphasis animation (Reachable node breathing highlight, offer-card
  reveal stagger, battle-transition fade) must be slow and low-amplitude,
  and the entire animation set must be disable-able via a single
  `reduced_motion` toggle (defaulting to the OS `prefers-reduced-motion`
  signal where available, else off) — satisfying the Accessibility
  Checklist's "no flashing content without warning" requirement by
  construction, not by exception-handling specific effects.
- **Audio hooks (owned by Audio System ✅ — this document only enumerates
  the required moments):** node hover/focus (Node Detail open),
  node select (Confirm Entry armed), node confirm (distinct stinger for
  combat vs. non-combat node types, since the stakes differ), offer-screen
  reveal, offer pick confirm, Rest's Heal-vs-Train choice, and Run Summary
  (a distinct victory fanfare vs. a somber defeat/abandon cue) — matching
  this project's "crisp SFX for moves/telegraphs" audio direction
  extended to the meta layer, and directly reusing
  `draft-and-loadout-meta.md`'s own enumerated "offer-screen reveal, pick
  confirmation, Heal-vs-Train choice" hook list rather than duplicating a
  second naming scheme for the same moments.
- **All text respects the `uiScale` setting (Formula F5)** — every label,
  card body, and tooltip in this system scales together; no text element
  is exempt.

## Acceptance Criteria

Pure, deterministic tests unless noted. "Screen" tests assume a
lightweight-fake Run Structure / Draft-Loadout-Meta backend implementing
their documented public contracts (`RunMap`, `reachableNodes()`,
`DraftOffer[]`, `RestChoice`).

**Map rendering completeness (Rule 3)**
- **GIVEN** any generated `RunMap`, **WHEN** the map screen renders,
  **THEN** every `MapNode` and every `MapEdge` in the `RunMap` is present
  in the rendered output — no node or edge is omitted, paginated, or
  progressively revealed.
- **GIVEN** a `RunMap` whose total rendered height (Formula F1) exceeds the
  viewport height, **WHEN** the map screen renders, **THEN** the canvas
  becomes vertically scrollable and every node remains reachable via
  scroll at its authored, unscaled icon size (no zoom-to-fit shrinking is
  ever applied).

**Node visual-state classification (Formula F2)**
- **GIVEN** the Formula F2 worked example's exact `RunMap` state, **WHEN**
  `nodeVisualState` is evaluated for each named node, **THEN** the results
  are exactly `CurrentPosition`, `Reachable`, `FutureLocked`, and
  `Bypassed` respectively (worked example, reproduced literally).
- **GIVEN** any generated `RunMap` at any point in a run, **WHEN** every
  node's visual state is computed, **THEN** each node receives exactly one
  of the five states (no node is unclassified, no node receives two).

**Non-committing hover / node detail (Rule 5)**
- **GIVEN** the pointer or keyboard-cursor moves over any node (any visual
  state), **WHEN** the Node Detail panel opens, **THEN** no game-state
  mutation occurs (`RunMap`, `Roster`, and `DraftOffer[]` are
  byte-identical before and after).
- **GIVEN** a `FutureLocked` or `Bypassed` node is hovered/focused,
  **THEN** the Node Detail panel shows type and tier but renders no
  confirm/enter affordance.

**Two-stage confirm gate (Rule 6, Formula F4)**
- **GIVEN** a Reachable node is selected then a confirm input arrives
  `< min_confirm_delay_ms` later, **WHEN** evaluated via Formula F4,
  **THEN** the confirm is rejected, `enterNode()` is never called, and the
  `ConfirmEntryPrompt` remains open.
- **GIVEN** a Reachable node is selected then a confirm input arrives
  `≥ min_confirm_delay_ms` later, **THEN** `enterNode(nodeId)` is called
  exactly once with the selected node's id.
- **GIVEN** a node not in the current `reachableNodes()` set, **WHEN** a
  select input targets it, **THEN** no `ConfirmEntryPrompt` ever arms and
  no path to `enterNode()` exists for that node.

**Offer screen layout (Formula F3) and content fidelity (Rules 7–8)**
- **GIVEN** the Formula F3 worked examples' exact inputs, **WHEN**
  `cardWidthPx`/`layoutMode` are computed, **THEN** the results match
  exactly (290px `SingleRow`; 220px `VerticalStack`, worked examples
  reproduced literally).
- **GIVEN** any `DraftOffer[]` returned by Draft / Loadout Meta, **WHEN**
  the offer screen renders, **THEN** it displays exactly that set (same
  count, same order, same `SkipOffer` presence/absence per context) with
  no added, removed, or reordered offers.
- **GIVEN** the Starting Roster Draft context, **WHEN** the offer screen
  renders, **THEN** no `SkipOffer` card is present and a live "N of
  `squad_size` selected" counter is shown, updating on each pick.

**Rest preview fidelity (Rule 9)**
- **GIVEN** a Rest node's "Heal" option is highlighted (before confirm),
  **WHEN** the preview renders, **THEN** every Roster member's displayed
  post-heal HP matches Draft / Loadout Meta's Formula F5 output exactly,
  for every member in the full Roster (not just the active Loadout).

**Event placeholder (Rule 10)**
- **GIVEN** an Event-type node is entered, **WHEN** the placeholder screen's
  `Continue` action is triggered, **THEN** `resolveNode(nodeId, Completed)`
  is called exactly once and the map screen resumes.

**Run Summary (Rule 11)**
- **GIVEN** `run_completed(Victory)` fires, **THEN** the Run Summary screen
  renders `outcome=Victory`, the full `Claimed`-node route in row order,
  and the final Roster snapshot; the same holds for `run_completed(Defeat)`
  and `run_abandoned` with their respective `outcome` values.
- **GIVEN** the Run Summary screen is showing, **WHEN** any further
  node-entry or offer-pick input is attempted, **THEN** it is rejected —
  the Run Summary is a strictly terminal screen with no path back to
  `MapScreen`.

**Accessibility (manual walkthrough evidence, per Coding Standards' UI-story
gate)**
- **GIVEN** keyboard-only input (no mouse), **WHEN** a full node-entry →
  battle-handoff → post-Victory-offer-pick → return-to-map cycle is
  performed, **THEN** every step completes without requiring pointer input
  at any point.
- **GIVEN** `uiScale=2.0` (Formula F5), **WHEN** any screen in this
  document renders, **THEN** no text is clipped or truncated and no card's
  rendered width falls below `renderedCardMinWidthPx`.
- **GIVEN** `reduced_motion=true`, **WHEN** any screen renders, **THEN** no
  animated emphasis effect (Reachable breathing highlight, reveal stagger,
  transition fade) plays — all such elements render in their static final
  state immediately.

## Open Questions

**Needs an architecture decision (→ ADR during `/create-architecture`):**

1. **Screen-ownership split with Draft/Loadout UI (Rule 2) — Roster
   Hub/Loadout Config half confirmed; Offer/Rest/StartingDraft half still
   overlaps.** `draft-loadout-ui.md` is now Designed and its Core Rule 1
   confirms "node-triggered screens live here [Map/Run UI], player-initiated
   Roster/Loadout screens live in Draft/Loadout UI" for the Roster Hub and
   Loadout Configuration screens specifically. However, `draft-loadout-ui.md`'s
   own Rule 2 also names the Offer Screen, Rest Choice screen, and Starting
   Roster Draft as screens *it* defines — the same three screens this
   document's Rule 1 and Rules 7–9 claim as Map/Run UI's node-triggered
   resolution screens. This needs an explicit cross-system decision: either
   one document is the sole render-owner of those three screens and the
   other's description is reframed as the underlying interaction-pattern
   spec being reused (not a competing owner), or the screens are formally
   split by sub-context. *Owner:* architecture decision during
   `/create-architecture`, cross-checked against both documents' Rule 2 /
   Rule 1.
2. **Battle hand-off transition ownership.** Rule 13 assumes Map/Run UI
   plays a brief transition and then yields entirely to the battle stack,
   but the exact technical seam (does Map/Run UI's PixiJS scene tear down,
   or does the battle render on top of it?) is a rendering-architecture
   question outside this document's scope. *Owner:* Tech architecture,
   coordinated with Board Rendering & Juice and Run Structure's Rule 14
   `startBattle()` contract.

**Resolved this session (provisional defaults — confirm during
implementation):**

3. **Mandatory (non-optional) two-stage confirm for node entry** (Rule 6) —
   chosen over reusing `input-and-selection.md`'s optional
   `require_confirm_click` knob, specifically because a map node has no
   equivalent full-consequence preview the way an in-battle move does.
   Revisit only if playtesting shows the mandatory confirm feels redundant
   once players are experienced (a possible future "fast confirm" opt-out
   setting, not designed here).
4. **Zoom-to-fit rejected in favor of vertical scroll** (Rule 3, Edge
   Cases) for maps taller than the viewport — chosen to protect the
   minimum-readable-font-size accessibility floor unconditionally. Revisit
   only if `map_depth`'s safe range (Run Structure's own knob, up to 12)
   proves the scroll distance itself becomes a usability problem at the
   high end.
5. **One shared offer-screen component across all four contexts** (Rule 7)
   — chosen to minimize the player's UI vocabulary; the alternative
   (four bespoke screens) was rejected as unnecessary divergence for a
   mechanically-identical interaction.

**Deferred to another system's design pass:**

6. **Event-node real content and screen design.** Entirely deferred to a
   future, currently-undesigned narrative/event-content system
   (`run-structure-node-map.md` Rule 12, `draft-and-loadout-meta.md` Open
   Question #6) — this document's Rule 10 placeholder is explicitly
   temporary.
7. **Roster/bench browsing screen and Loadout configuration screen full
   design — resolved.** Now fully specified in `draft-loadout-ui.md` ✅
   (Designed) as the Roster Hub and Loadout Configuration screens; this
   document only specifies the hand-off point (the Roster Summary Widget →
   Draft/Loadout UI's `RosterHub` state, Rule 2). See Open Question #1 for
   the separate, still-open Offer/Rest/StartingDraft screen-ownership
   overlap between the two documents.
8. **Concrete icon/asset design for the six node types and Boss's unique
   treatment.** Deferred to `art-director` / concept-art pass — this
   document specifies the *legibility requirements* those assets must
   satisfy (Visual/Audio Requirements), not the assets themselves.
9. **Gamepad/touch input mapping for the map and offer screens.** Out of
   v1 scope, matching `input-and-selection.md`'s own "keyboard + mouse
   only, gamepad/touch deferred" scope line — this document's two-stage
   confirm pattern (Rule 6) is designed to map cleanly onto a future
   gamepad's "A to arm, A again to confirm" convention if/when that input
   method is added, but no gamepad-specific bindings are specified here.
10. **A dedicated low-density layout mode for `uiScale` above `3.0`** or
    very small viewports combined with `map_depth` at its upper safe
    range — flagged as a possible follow-up if Tuning Knobs' interaction
    note under `ui_scale_max` proves to be a real problem in practice, not
    designed here.
