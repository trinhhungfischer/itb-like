# Draft/Loadout UI

> **Status**: In Design
> **Author**: workflow (design-system fan-out)
> **Last Updated**: 2026-07-27
> **Implements Pillar**: #1 Perfect Information, Perfect Blame; #3 Variety Lives in the Draft, Not the Dice; #5 Read in Ten Seconds

## Overview

Draft/Loadout UI is the presentation and interaction layer for everything
`draft-and-loadout-meta.md` decides: it is the set of screens — Roster Hub,
Loadout Configuration, the shared Offer Screen, the Rest Choice screen, and
the Starting Roster Draft screen — through which the player views their
Roster, reconfigures their Loadout, compares and picks Draft Offers, and
makes the Rest node's Heal-vs-Train choice. This document owns **no game
rules**: every legality check, every generated value, and every persistent
fact it displays is computed by Draft / Loadout Meta and simply rendered
here. What this document *does* own is how that information is organized,
navigated, previewed, and confirmed — the interaction patterns, screen flow,
keyboard/mouse accessibility, and the ability compare/preview mechanism that
makes Pillar #1's "full information before commit" promise concretely
usable rather than merely mechanically true.

## Player Fantasy

**"I can see exactly what I'm choosing, and I can't lose the choice."** Where
Draft / Loadout Meta's Player Fantasy is about *authoring a build*, this
document's job is to make every one of those authoring moments feel
low-friction and zero-anxiety: a hero card that always shows its true
current state, an upgrade offer that shows its exact before-and-after
numbers before you commit, a Loadout screen that tells you immediately if
your squad is valid, and a Confirm button that is unmistakably different
from just looking. This is Self-Determination Theory's **Autonomy** made
*legible* — Draft / Loadout Meta's Player Fantasy names the failure state as
"an offer screen that feels like a slot machine"; this document is the
concrete design surface where that failure is either avoided or committed.
It serves **Pillar #1 (Perfect Information, Perfect Blame)** directly — a
UI that hides a value, buries a comparison, or lets a misclick masquerade as
a real choice breaks the pillar just as surely as hidden battle math would —
and **Pillar #5 (Read in Ten Seconds)**, extended from the battlefield to
the meta layer: a player returning to the map screen must be able to read
their squad's current shape at a glance, without hunting through menus.

## Detailed Design

### Core Rules

1. **Ownership boundary — presentation and interaction only.** This
   document defines screens, layout, navigation, and interaction patterns.
   It never re-implements or caches a legality/value computation that
   Draft / Loadout Meta already owns (`isValidLoadout`/F6, `generateOffers`/
   F1–F4, `effectiveAbility()`/Ability Upgrades F1, the Rest heal formula
   F5) — every number and every legal/illegal state shown here is read
   live from that layer, never derived independently.
2. **Five screens, one shared Compare/Inspect component.** This document
   defines: **Roster Hub** (default/home view), **Loadout Configuration**
   (modal from Roster Hub), the shared **Offer Screen** (auto-triggered;
   serves Reward-node, post-Battle/Elite-Victory, and Rest-node "Train"
   contexts identically, per Draft / Loadout Meta Rule 10's shared-resolution
   contract), the **Rest Choice** screen (auto-triggered at Rest nodes), and
   the **Starting Roster Draft** screen (one-time, first-run variant of the
   Offer Screen). All five reuse a single Compare/Inspect Panel component
   (Rules 9–10) rather than five separate detail-view designs.
3. **Roster Hub layout.** Reachable from the map screen via a persistent
   "Squad" entry point, it lists every `RosterMember` as a **Roster Card**
   (portrait/silhouette, class tag, name, current HP/maxHP as both a number
   and a proportional bar, ability name + icon, and filled/empty
   upgrade-slot pips) split into two spatially and visually distinct
   groups — **Active Loadout** (exactly `squad_size` cards, in the active
   Loadout's stored order) and **Bench** (every other Roster member,
   ordered by `RosterMember.recruitedAt`) — never intermixed, so "who is
   deployed" is legible without reading any text (Pillar #5).
4. **Loadout Configuration is the only screen where Active/Bench membership
   changes, and it is never auto-opened.** Entered from Roster Hub via an
   explicit "Edit Loadout" action only (matching Draft / Loadout Meta Rule 6
   — the previous Loadout always carries forward by default, so this screen
   is opt-in, never forced). Clicking a Bench card stages it; clicking an
   Active card while a Bench card is staged swaps them; every toggle
   recomputes the live validity gate (Formula F3, wrapping Meta's F6).
   **Cancel** discards all staged changes and reverts to the last-Confirmed
   Loadout; **Confirm** writes the new selection to Draft / Loadout Meta and
   returns to Roster Hub.
5. **The Offer Screen auto-opens and cannot be dismissed without a pick.**
   The instant Draft / Loadout Meta's offer-set state transitions
   `Ungenerated → Generated` (that document's States and Transitions), this
   screen opens over whatever is currently shown — even mid-Loadout-Config
   (Edge Cases) — and has no close/X control. Every generated offer set
   must be resolved before any other interaction in this document is
   possible. This is a deliberate zero-ambiguity gate: there is never a
   pending, easy-to-forget decision hiding behind another screen (Pillar
   #1).
6. **Offer Screen card layout and the two-step stage-then-confirm
   pattern.** One **Offer Card** per `DraftOffer`, in Draft / Loadout Meta's
   declared slot order (that document's Formula F4), plus a visually and
   spatially distinct **Skip Card** always last. Selecting a card **stages**
   it (raised/outlined, Compare Panel updates, Rule 9) without committing
   anything; selecting a different card replaces the staged selection. A
   persistent **Confirm Pick** button is enabled only when exactly one card
   is staged (Formula F3) and, once pressed, disables itself immediately
   and irreversibly triggers Draft / Loadout Meta's execute-and-
   `resolveNode` call. The two-step pattern (stage, then a separate,
   spatially distinct Confirm) is a deliberate error-prevention choice for
   this screen specifically: with 2–6 similar-looking cards on offer, a
   single-click-commits pattern (as used by Rest Choice, Rule 7) carries a
   materially higher mis-click risk here than it does for two large,
   widely-separated choice cards.
7. **Rest Choice presents exactly two direct-commit cards, not a
   stage-then-confirm flow.** Matching Draft / Loadout Meta Rule 11's
   "exactly two mutually-exclusive choices" contract: **Heal** and
   **Train**, both large and spatially separated (low mis-click risk by
   construction, unlike the Offer Screen's denser card grid), each showing
   its exact consequence inline before any click — Heal shows a compact
   per-member "current HP → new HP" list (Meta Formula F5); Train shows
   only its category label ("Reveals one Ability Upgrade offer") since its
   specific offer content does not exist until after the choice is made
   (Meta Rule 11). Clicking either card commits immediately; Heal resolves
   directly back to Roster Hub, Train chains directly into the Offer Screen
   (Rule 6) with its offer set pre-filtered to `AbilityUpgrade` only.
8. **Starting Roster Draft is a full-screen, multi-pick Offer Screen
   variant.** Shows exactly `starting_offer_count` `NewHeroOffer` cards, no
   Skip Card (Draft / Loadout Meta's Edge Cases — Skip is illegal here),
   and a persistent **"X of `squad_size` selected"** counter in place of the
   single-pick Confirm gate. Clicking a card **toggles** it in/out of the
   staged multi-selection (not a swap-to-single, unlike Rule 6's other
   contexts); Confirm is enabled only when the staged count exactly equals
   `squad_size` (Formula F3).
9. **Compare Panel — the ability compare/preview mechanism.** For a
   staged/focused `AbilityUpgradeOffer`, the panel renders the target
   `RosterMember`'s current effective ability card beside an after-upgrade
   preview card, with every field the upgrade changes flagged via Formula
   F2's before→after format (e.g., "Push Distance: 2 → 3"); non-numeric
   category changes (e.g., Extra Use) use the same format on the
   `usesPerTurn` field. For a staged/focused `NewHeroOffer`, the panel
   renders that `HeroDefinition`'s full ability card alone — there is no
   "before" state, since recruiting is additive, not a delta — alongside
   its class tag and portrait. For the Skip Card, the panel shows a neutral
   empty state ("No change to your squad"). The panel never computes an
   ability value itself; every number it shows comes from Ability Upgrades'
   `effectiveAbility()` (via Draft / Loadout Meta's pass-through).
10. **Inspect Panel reuses the Compare Panel component in single-card
    mode.** Clicking any Roster Card (Active, Bench, or within Loadout
    Config) at any time — independent of any pending offer — opens the same
    component with no "after" state, showing that member's current
    effective ability card, HP, and each filled upgrade slot's specific
    `AbilityUpgradeDefinition` by name. This is the read-only "know your
    own roster" view, and it deliberately reuses Rule 9's component rather
    than introducing a second detail-view design.
11. **`class`-tag filtering is display-only, per Draft / Loadout Meta Rule
    14's explicit delegation.** Roster Hub (and, where a `NewHeroOffer` is
    present, the Offer Screen) exposes a simple filter/group control over
    `HeroDefinition.class`. Filtering never hides a card the player is
    required to act on to proceed — a pending offer or an in-progress
    Starting Draft pick is never filterable away; filtering affects display
    order/visibility only within an otherwise-completable screen.
12. **Full keyboard-only operability.** Every interaction in Rules 3–11 is
    reachable via Tab/Shift+Tab (deterministic order, Formula F1) plus
    Enter/Space to activate the focused element, and Escape to cancel/back
    wherever Cancel is legal (Loadout Configuration only, Rule 4). This
    directly extends `input-and-selection.md`'s established "any action
    reachable by mouse must be reachable by keyboard alone" convention
    (that document's Core Rule 1) from the battle board to this system's
    menus. No interaction in this document requires drag, right-click, or a
    hover-only affordance with no keyboard equivalent.
13. **No auto-timeout, no forced decisions under a clock.** No screen in
    this document ever auto-advances, auto-picks, or penalizes idle time —
    matching this project's deterministic, no-time-pressure design language
    (already true of the underlying battle core, and of Draft / Loadout
    Meta's own rules, which contain no time-based logic). A player may leave
    any offer/choice screen open indefinitely before deciding.
14. **Irreversibility is signaled, never implied.** Because every Confirm-
    class action in this document is permanent for the run (Draft / Loadout
    Meta Rules 10–13), every Confirm-class button is visually and textually
    distinct from a staging/browsing interaction — staging a card never
    uses the word "Confirm," and only true commit actions do. This is a
    deliberate guard against the single most common failure mode in
    offer-pick UI: confusing "looking at" with "taking."

### States and Transitions

**Screen-level state machine** (top-level, owned by this document):

| State | Entered from | Exits to |
|---|---|---|
| `NotShown` | Battle is `InTurn`, or the map screen has not yet loaded | Map screen loads with a Roster present → `RosterHub`; map screen loads with an empty Roster (first run) → `StartingDraft` |
| `RosterHub` | Map screen load (non-first-run); any modal screen's resolution when no further offer is pending | `LoadoutConfig` (explicit "Edit Loadout"); interrupted by `OfferScreen`/`RestChoice` (Rule 5) |
| `LoadoutConfig` | `RosterHub` via "Edit Loadout" | Confirm or Cancel → `RosterHub`; may be interrupted by `OfferScreen`/`RestChoice` mid-edit (Edge Cases) — staged-but-unconfirmed changes are preserved, not discarded, and resume exactly where left off |
| `OfferScreen(offers)` | Automatically, the instant Draft / Loadout Meta's offer-set state (`Ungenerated → Generated`) fires, from any state | Confirm → `RosterHub` (or the interrupted screen's preserved state) |
| `RestChoice` | Automatically, on Rest-node entry | Heal → `RosterHub` directly; Train → `OfferScreen(offers)` chained, which then resolves onward to `RosterHub` |
| `StartingDraft` | Automatically, once, when the Roster is empty (before `RosterHub` first exists) | Confirm (only reachable at exactly `squad_size` staged, Rule 8) → `RosterHub`, populated for the first time. No Cancel/back transition exists for this state. |

**Screen layering (z-order).** This document defines exactly three stacked
render layers, back-to-front: **Base** (`RosterHub`, or `LoadoutConfig` when
open) → **Interrupt** (`OfferScreen`, `RestChoice`) → *(nothing renders
above Interrupt)*. `LoadoutConfig` is itself a modal layer above `RosterHub`
(entered only via explicit "Edit Loadout," Rule 4) but sits **below**
`OfferScreen`/`RestChoice` in the stack. When an `OfferScreen` or
`RestChoice` interrupts (Rule 5) — including the mid-`LoadoutConfig` case
(Edge Cases) — it always renders **topmost**, dimming and blocking all
input to whichever Base-layer screen is beneath it (`RosterHub` or an
in-progress `LoadoutConfig`) without unmounting that screen: the
interrupted screen stays alive in memory, simply non-interactive and
visually dimmed, until the Interrupt layer resolves and is popped off the
stack, at which point the Base layer becomes interactive again exactly as
it was left. `StartingDraft` is a special case of the Base layer (it exists
before `RosterHub` does) and is never itself interrupted, since it occurs
before any node-triggered offer/rest screen can fire (States and
Transitions table).

**Card-level interaction state** (within `OfferScreen`/`StartingDraft`, per
offer set): `Browsing → Focused(card)` [hover or Tab] `→ Staged(card)`
[click/Enter]. A new stage on a different card replaces the previous staged
card in single-pick contexts (Rule 6), or adds to the staged set in
`StartingDraft`'s multi-pick context (Rule 8). `Staged (valid per Formula
F3) → Confirmed` [Confirm button] is terminal for that specific offer set.

### Interactions with Other Systems

| System | Reads from Draft/Loadout UI | Draft/Loadout UI reads / calls | Ownership boundary |
|---|---|---|---|
| **Draft / Loadout Meta** ✅ | The player's staged pick/choice selections (which `DraftOffer`, which `RestChoice`, which proposed Loadout selection) | Roster, active Loadout, live `DraftOffer[]`/`RestChoice` state; `isValidLoadout()`/F6; `generateOffers()` output; Ability Upgrades' `effectiveAbility()`-derived numeric values (pass-through display data); triggers the execute + `resolveNode` calls | Draft / Loadout Meta owns every game-rule fact and legality check; this document only renders and forwards player intent — it never computes or caches a legality decision itself |
| **Input & Selection** (soft, pattern reference only) | — | The established hover-to-preview/click-to-commit and deterministic Tab-cycle interaction pattern (that document's Core Rules 1–2, Formula F5) as the design precedent Core Rule 12 extends to menu UI | Input & Selection owns board input; this document owns menu input. No runtime dependency — pattern reuse only, for interaction-language consistency across the whole game. |
| **Map/Run UI** ✅ | Whether this document has a pending mandatory screen to show (for its own map-screen entry-point badge, `map-run-ui.md` Rule 2); hands off control to this document's `RosterHub` state when its Roster Summary Widget is activated | Returns control to `MapScreen` when `RosterHub` closes with no further offer pending | **Soft** — sibling Presentation-layer systems, no direct API call in either direction beyond the screen-transition hand-off; the Roster Hub / Loadout Configuration screen split between the two documents is confirmed (matches this document's Core Rule 1 and `map-run-ui.md`'s Rule 2), but ownership of the Offer Screen / Rest Choice / Starting Roster Draft screens still overlaps between this document's Rule 2 and `map-run-ui.md`'s Rule 1 / Rules 7–9 — **unresolved cross-system overlap**, see Open Questions |
| **Audio System** ✅ | — | UI event trigger points this document fires (Visual/Audio Requirements) for Audio System to bind SFX to | **Soft** — this document enumerates hook points only; Audio System owns all playback, matching the same convention `map-run-ui.md` establishes for its own menu-layer audio hooks |
| **Accessibility** ✅ (#27, `accessibility.md`, Designed 2026-07-28) | Confirmation that every control in this document is keyboard-navigable (Rule 12) and font/scale-configurable (Tuning Knobs) | — | **Hard** — Rule 12 and the scale knobs already satisfy Accessibility's A7 (keyboard-only) and A3 (150% scale). Those are now **BLOCKING** verification gates (its V3/V4), applied per screen and per locale, not aspirations. `menu_min_font_size_px` is cited by its Formula F2 |

## Formulas

All formulas are deterministic (no RNG, no time-dependence) and operate
purely on state Draft / Loadout Meta already exposes. Examples reuse that
document's default knob values (`squad_size=3`, `starting_offer_count=5`)
and its Formula F4 worked example (offer set: `{Recruit Warden, Vanguard
+Extra Use, Recruit Twinblade, Skip}`).

### F1. Deterministic Focus Order

```
tabOrder(screen, state):
  switch screen:
    RosterHub:      Active cards (Loadout array order) ++ Bench cards
                     (RosterMember.recruitedAt order) ++ ["EditLoadoutButton"]
    LoadoutConfig:   Active group (current staged order) ++ Bench group
                     (recruitedAt order) ++ ["ConfirmButton", "CancelButton"]
    OfferScreen:     OfferCard[0..offerCount-1] (Meta F4 declared slot order)
                     ++ ["SkipCard"] ++ ["ConfirmButton"]
    RestChoice:      ["HealCard", "TrainCard"]
    StartingDraft:   OfferCard[0..starting_offer_count-1] (Meta F3/F4 draw
                     order) ++ ["ConfirmButton"]
  return ordered list of focusable element ids
```

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| screen | `screen` | enum | `{RosterHub, LoadoutConfig, OfferScreen, RestChoice, StartingDraft}` | Which of the five screens is computing its order |
| screen state | `state` | screen-specific | current staged/Active/Bench arrays | The live data driving the order — always sourced from Draft / Loadout Meta or this document's own staged-selection state, never independently reordered |

**Output:** an ordered list of focusable element ids; deterministic given
identical input state — pressing Tab repeatedly visits every element exactly
once per cycle, then wraps (matching `input-and-selection.md` Formula F5's
cycle convention). **Worked example:** `OfferScreen` with the reused
worked-example offer set `{Recruit Warden, Vanguard +Extra Use, Recruit
Twinblade, Skip}` → `tabOrder = [Card(RecruitWarden),
Card(VanguardExtraUse), Card(RecruitTwinblade), Card(Skip),
Button(Confirm)]`. Pressing Tab five times from screen-open returns focus to
`Card(RecruitWarden)`.

### F2. Numeric Delta Display Formatting

```
formatDelta(before, after):
  text = "{before} → {after}"
  if after > before:  direction = Increase; icon = "▲"
  elif after < before: direction = Decrease; icon = "▼"
  else:                 direction = Unchanged; icon = "—"
  return { text, direction, icon }   // icon is always present; color is optional decoration, never load-bearing
```

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| before value | `before` | int | field-defined (Ability Upgrades F1's `effectiveValue` with the member's *current* upgrades) | The value shown as "current" in the Compare Panel |
| after value | `after` | int | field-defined (Ability Upgrades F1's `effectiveValue` with the candidate upgrade hypothetically added) | The value shown as "if picked" in the Compare Panel |
| target field | — | enum | `{amount, distance, usesPerTurn}` | Which `AbilityDefinition` numeric field this delta describes (Heroes & Abilities / Ability Upgrades schema) |

**Output range:** `text` is always a well-formed two-number string;
`direction ∈ {Increase, Decrease, Unchanged}`; `icon ∈ {▲, ▼, —}` — the icon
is present in every case, satisfying "functional without reliance on color
alone" unconditionally. **This formula only applies inside an
offer/compare context** (a candidate upgrade is being evaluated); the plain
Inspect Panel (Rule 10, no candidate offer) displays `after` alone with no
delta styling, since there is no "before" to compare against.

**Worked example 1 (ordinary increase):** Vanguard's Shove `distance`
`baseValue = 2`, no currently-filled `PushDistanceBoost` slots (`before =
2`); the candidate offer is a `PushDistanceBoost` (`delta = +1`) →
`after = clamp(2+1, 0, 4) = 3` (Ability Upgrades F1) →
`formatDelta(2, 3) = {"2 → 3", Increase, ▲}`.

**Worked example 2 (capped, no further effect):** the same field is already
at its `fieldCap` (`4`) via prior upgrades in the member's other slot(s); a
newly-offered upgrade on this same field (only possible if it targets a
different empty slot, per Draft / Loadout Meta Formula F3's empty-slot
requirement) still legally computes `before = 4`, `after = clamp(4+1, 0, 4)
= 4` → `formatDelta(4, 4) = {"4 → 4", Unchanged, —}`. The offer is still
stageable and confirmable — the player is shown the true, honest "no further
numeric effect" outcome before committing, never a misleading `▲` (Edge
Cases; matches Ability Upgrades' "wasted but legal" precedent).

### F3. Confirm-Gate Predicate

```
isConfirmEnabled(screen, stagedState, roster):
  switch screen:
    LoadoutConfig:  return isValidLoadout(stagedState, roster)          // Meta Formula F6, unmodified
    OfferScreen:    return |stagedState| == 1                            // exactly one card staged, any card incl. Skip
    StartingDraft:  return |stagedState| == squad_size                   // Meta Rule 4
    RestChoice:     N/A — each card is a direct-commit action (Rule 7), no staged state exists
    RosterHub:      N/A — no Confirm button exists on this screen
```

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| screen | `screen` | enum | see F1 | Which screen's Confirm state is being computed |
| staged selection | `stagedState` | set of card/member ids | 0 to the screen's card count | The player's current, unconfirmed selection |
| roster | `roster` | Roster | Draft / Loadout Meta's live state | Passed through unmodified to `isValidLoadout` (Meta F6) |
| squad size | `squad_size` | int | 2–5 (Heroes & Abilities knob) | Referenced, not redefined, from Heroes & Abilities |

**Output:** boolean; recomputed on every staging change and drives the
Confirm button's enabled/disabled state. The button is **always visible**,
never hidden, even when disabled (Edge Cases) — a visible-but-disabled
Confirm communicates "you're not done yet" more clearly than an absent
control (Nielsen's visibility-of-system-status heuristic). **Worked
example:** `LoadoutConfig`, `squad_size=3`, Roster has 5 members; the player
has 2 Active cards staged and toggles a 3rd Bench card in → `|stagedState| =
3`, all distinct, all `currentHP ≥ min_hp_for_deployment` →
`isValidLoadout` returns `true` → `isConfirmEnabled = true`. The player then
un-toggles one member → `|stagedState| = 2` → `isValidLoadout` returns
`false` (count `≠ squad_size`) → Confirm reverts to disabled immediately.

## Edge Cases

- **Two offers in the same set target the same `RosterMember`** (e.g.,
  `(Vanguard, PushBoost)` and `(Vanguard, ExtraUse)` both drawn): the
  Compare Panel renders independently per focused/staged card — focusing
  one never shows the other's delta, and staging one never disables or
  hides the other; both remain independently pickable until Confirm.
- **The browser tab loses focus while `OfferScreen` or `RestChoice` is
  open:** matching `input-and-selection.md`'s established "focus loss does
  not auto-cancel" precedent, any staged (not yet Confirmed) selection
  persists exactly as left — no timeout, no auto-pick (Core Rule 13).
- **Rapid double-click / double-Enter on Confirm:** the button disables
  itself the instant the *first* activation registers, before the Meta
  layer's call even resolves — the second click/press lands on an
  already-disabled control and is a no-op. This is the
  `confirm_button_double_click_guard_ms` knob's guaranteed minimum window.
- **`LoadoutConfig` has unconfirmed staged changes when an `OfferScreen` or
  `RestChoice` interrupts** (Rest/Reward/post-Victory events can fire while
  the player is mid-configuring their Loadout at the map screen): the
  interrupting screen is modal and blocks input to `LoadoutConfig`
  underneath; the staged-but-unconfirmed state is preserved untouched and
  resumes exactly where the player left it once the interrupting screen
  resolves (States and Transitions).
- **`pool.NewHero` is empty for a given offer set** (Draft / Loadout Meta's
  structural `AbilityUpgrade`-only fallback): `OfferScreen` renders
  normally using only `AbilityUpgradeOffer`-style cards; no "why are there
  no recruit offers" messaging is shown — this is an intended structural
  state, not an error.
- **An offer set contains only the Skip Card** (a maximally-built Roster,
  Draft / Loadout Meta's edge case): `OfferScreen` still opens; Confirm is
  enabled the instant Skip is staged (`|stagedState| == 1` is satisfied by
  Skip same as any other card) and resolves normally — no special
  "nothing to show" empty-state screen is needed, since the Skip Card *is*
  the content.
- **A hero/ability name or class tag exceeds a card's designed width** at
  `menu_min_font_size_px` (a long localized string): the card truncates
  with a trailing ellipsis; that card's focus/hover state reveals the full
  untruncated string in a tooltip. The Compare Panel — a wider surface than
  a card — never truncates a name; only cards may.
- **Viewport falls to the supported minimum resolution at `ui_scale`'s
  lower bound (0.75):** the card grid reflows to fewer columns before ever
  shrinking text below `menu_min_font_size_px` — text size is never
  sacrificed to fit more columns, matching `battle-hud.md`'s established
  `hud_min_font_size_px` floor precedent, applied here to menu screens.
- **`LoadoutConfig`: the player attempts to stage a Bench member whose
  `currentHP < min_hp_for_deployment`** (only reachable if that Draft /
  Loadout Meta knob is raised above its recommended default of `1`): the
  card is visibly present but rendered in a distinct "ineligible" state
  (icon + reduced-opacity treatment, never color alone) and cannot be
  staged into Active; focusing it still opens the Inspect Panel (Rule 10)
  so the player can see *why* (HP below floor), never a silent block.
- **The Compare Panel evaluates a field already at its `fieldCap`** for the
  offered upgrade: Formula F2 returns `Unchanged`/`—`; the offer remains
  legally stageable and confirmable, and the player is shown the true,
  honest "no further numeric effect" outcome before committing (never a
  misleading increase icon).
- **The Starting Roster Draft is left with fewer than `squad_size` staged
  picks and the session is interrupted (hard reload / crash):** whether the
  in-progress staged selection survives depends on Run Persistence's
  save-trigger granularity, which is not currently specified at this
  sub-node resolution (PROVISIONAL, Open Questions). This document's
  default assumption: it does **not** survive — the screen re-renders at
  `0 of squad_size` on resume, the safe/simple default.
- **Keyboard-only play reaches a disabled Confirm button via Tab:**
  pressing Enter/Space on a disabled-but-focused Confirm is a no-op with a
  brief rejection cue (shake/flash on the button itself, matching
  `input-and-selection.md`'s established rejection-cue precedent for
  illegal actions) — never a silent failure.

## Dependencies

**Upstream (Draft/Loadout UI depends on):**

| System | Interface | Hard / Soft |
|---|---|---|
| **Draft / Loadout Meta** ✅ | Roster, active Loadout, live `DraftOffer[]`/`RestChoice` state (read); `isValidLoadout()`/F6, `generateOffers()` output, Ability Upgrades' `effectiveAbility()`-derived numeric values (pass-through display data); the pick/choice/Loadout-write calls this document triggers on Confirm | **Hard** |
| **Input & Selection** | Interaction-pattern precedent (hover-to-preview/click-to-commit, deterministic Tab-cycle) — design-language reuse only, no runtime call | **Soft** |
| **Heroes & Abilities** (indirect, via Draft / Loadout Meta pass-through) | `HeroDefinition`/`AbilityDefinition` field shapes rendered on cards and the Compare Panel | **Soft** — this document never calls Heroes & Abilities directly; all such data arrives already resolved through Draft / Loadout Meta, per `systems-index.md`'s declared dependency (Draft/Loadout UI → Draft / Loadout Meta only) |

**Downstream (systems that depend on Draft/Loadout UI):**

| System | Interface | Hard / Soft |
|---|---|---|
| **Map/Run UI** ✅ | Hands off control to this document's `RosterHub` state on Roster Summary Widget activation, and resumes `MapScreen` when `RosterHub` closes (`map-run-ui.md`'s own Rule 2 and Dependencies) | **Soft** — a screen-transition hand-off only, not a data/API dependency; Map/Run UI still reads Roster summary data directly from Draft / Loadout Meta, never through this document |

`systems-index.md` does not currently declare a downstream edge for
Draft/Loadout UI (it lists this system as a leaf Presentation-layer
consumer of Draft / Loadout Meta only); the row above reflects
`map-run-ui.md`'s own Dependencies section, which names this hand-off
explicitly and confirms it as Soft. Flagged for the next
`/consistency-check` pass to add the missing edge to `systems-index.md`
rather than edited there directly (out of this document's scope).

**Bidirectional-consistency note:** `systems-index.md` lists Draft/Loadout
UI as depending on Draft / Loadout Meta only; the Upstream table above
matches that exactly. `draft-and-loadout-meta.md`'s own Downstream table
already lists Draft/Loadout UI as **"Hard, provisional"** ("Roster (all
members, HP, upgrade slots), current Loadout, live `DraftOffer[]` sets,
`RestChoice` options" / "Player's pick/choice selections") — this document
confirms that contract and resolves its "provisional" qualifier into the
concrete screen flow, interaction rules, and formulas above.

## Tuning Knobs

| Knob | Default | Safe Range | Category | Too Low | Too High |
|---|---|---|---|---|---|
| `ui_scale` | 1.0 | 0.75–1.5 | Gate (accessibility) | Mirrors `battle-hud.md`'s `hud_scale` — below 0.75 risks sub-minimum text/icon size at common desktop viewing distances | Above 1.5, card grids can no longer fit `squad_size`/`max_roster_size` cards without forced scrolling, breaking the "whole roster visible at a glance" legibility goal (Pillar #5) |
| `menu_min_font_size_px` | 14px (at `ui_scale=1.0`) | 12–20px | Gate (accessibility) | Below 12px fails the Accessibility Checklist's "text readable at minimum font size" requirement | Above 20px as a *floor*, ability-name/stat text starts crowding Offer/Compare cards at default widths |
| `compare_panel_hover_delay_ms` | 100ms | 0–250ms | Curve | At 0ms, the Compare Panel flickers between states as the pointer merely crosses card boundaries mid-travel — visually noisy | Above 250ms, the panel feels laggy behind intentional hover, undermining the "I can see what would happen" trust Rule 9 exists to deliver |
| `offer_card_reveal_stagger_ms` | 60ms per card | 0–150ms | Curve | At 0ms, all cards appear simultaneously — flat but perfectly legible; a safe floor, never a violation | Above 150ms × a 4-card offer set, the reveal sequence exceeds ~0.6s and starts to read as a loading delay rather than a reveal |
| `confirm_button_double_click_guard_ms` | 250ms | 100–500ms | Gate | Below 100ms, fast/assistive-tech double-activation can slip through and risk a double-resolve race against Draft / Loadout Meta's `resolveNode` call | Above 500ms, a legitimate second, different confirm action (e.g., the auto-chained Offer Screen immediately after a Rest "Train" pick) can feel unresponsive |

**Interactions between knobs:**
- `offer_card_reveal_stagger_ms` never gates when keyboard focus becomes
  available — Formula F1's focus order is available the instant a screen
  opens; only the *visual* reveal is staggered. Visual polish never delays
  functional keyboard availability (Core Rule 12).
- `ui_scale` and `menu_min_font_size_px` interact exactly like
  `battle-hud.md`'s `hud_scale`/`hud_min_font_size_px` pair:
  `menu_min_font_size_px` is a hard floor regardless of `ui_scale`'s
  configured value.

## Acceptance Criteria

Given-When-Then, independently testable via a manual keyboard/mouse
walkthrough doc or an interaction test against the screen-state machine
(States and Transitions) and Formulas F1–F3 — no rendering required for the
formula-level checks.

**Roster Hub & Compare/Inspect (Rules 3, 9–10)**
- **GIVEN** a Roster with `squad_size` Active members and ≥1 Bench member,
  **WHEN** Roster Hub renders, **THEN** Active and Bench groups are
  visually distinct and every card shows portrait/class, currentHP/maxHP
  (numeric + bar), ability name+icon, and filled/empty upgrade-slot pips.
- **GIVEN** any Roster Card is activated (click or Enter-on-focus),
  **WHEN** the Inspect Panel opens, **THEN** it shows that member's full
  effective ability card with no "before"/delta styling (Rule 10).

**Loadout Configuration (Rule 4, Formula F3)**
- **GIVEN** `LoadoutConfig` with a staged selection of size `≠ squad_size`,
  **WHEN** the screen recomputes, **THEN** `isConfirmEnabled` (F3) is
  `false` and Confirm is visibly disabled but present.
- **GIVEN** `LoadoutConfig` with a valid staged selection (F6 true via F3),
  **WHEN** Confirm is pressed, **THEN** the selection is written to Draft /
  Loadout Meta and the screen returns to Roster Hub reflecting it.
- **GIVEN** `LoadoutConfig` with unconfirmed staged changes, **WHEN**
  Cancel or Escape is pressed, **THEN** the last-Confirmed Loadout is
  restored unchanged and no write occurs.

**Interrupt-and-resume state preservation (Screen layering, Rule 5, Edge Cases)**
- **GIVEN** `LoadoutConfig` is open with unconfirmed staged changes (a
  specific staged Active/Bench toggle set and a specific focused element),
  **WHEN** an `OfferScreen` or `RestChoice` interrupts (Draft / Loadout
  Meta's offer-set state fires `Ungenerated → Generated`, or a Rest node is
  entered), **THEN** `LoadoutConfig` is not unmounted or reset — it remains
  in memory, dimmed and non-interactive, beneath the interrupting screen.
- **GIVEN** the same interrupted `LoadoutConfig` state above, **WHEN** the
  interrupting `OfferScreen`/`RestChoice` resolves (Confirm pressed, or
  Heal/Train resolves to completion including any chained `OfferScreen`),
  **THEN** `LoadoutConfig` reopens with the exact same staged Active/Bench
  selection and the exact same focused element it had immediately before
  the interrupt — no staged toggle is lost, added, or reordered by the
  interrupt sequence.
- **GIVEN** `RosterHub` (not `LoadoutConfig`) is open when an `OfferScreen`
  or `RestChoice` interrupts, **WHEN** the interrupt resolves, **THEN**
  control returns to `RosterHub` in its prior state (States and
  Transitions), confirming the same preserve-and-resume contract applies
  whether the interrupted Base-layer screen is `RosterHub` or
  `LoadoutConfig`.
- **GIVEN** an `OfferScreen` or `RestChoice` is open over either Base-layer
  screen, **WHEN** the player attempts any click or keyboard input targeting
  the dimmed screen beneath it, **THEN** that input is rejected and has no
  effect — the Base layer is provably inert while the Interrupt layer is
  active (Screen layering).

**Offer Screen (Rules 5–6, 9, Formulas F1–F3)**
- **GIVEN** an `OfferScreen` with `N` generated offers plus Skip, **WHEN**
  it opens, **THEN** exactly `N+1` cards render in Draft / Loadout Meta's
  declared slot order with Skip last (Formula F1).
- **GIVEN** no card is staged, **THEN** `isConfirmEnabled` is `false` (F3).
- **GIVEN** exactly one card is staged, **WHEN** Confirm is pressed,
  **THEN** that offer executes via Draft / Loadout Meta's API exactly once,
  Confirm disables immediately, and the screen closes to Roster Hub (or the
  interrupted screen's preserved state).
- **GIVEN** an `AbilityUpgradeOffer` card is focused, **WHEN** the Compare
  Panel renders, **THEN** it shows before→after values (Formula F2) for
  exactly the field(s) that offer's definition modifies, with the
  direction icon present regardless of color settings.
- **GIVEN** a `NewHeroOffer` card is focused, **WHEN** the Compare Panel
  renders, **THEN** it shows that hero's full ability card with no
  delta/before-state styling.

**Rest Choice (Rule 7)**
- **GIVEN** a Rest-node `RestChoice` screen, **WHEN** it renders, **THEN**
  exactly two cards (Heal, Train) are shown, each with its outcome preview
  visible before any click.
- **GIVEN** Heal is clicked, **WHEN** it resolves, **THEN** every Roster
  member's HP updates immediately per Meta Formula F5 and the screen closes
  directly to Roster Hub with no intervening `OfferScreen`.
- **GIVEN** Train is clicked, **WHEN** it resolves, **THEN** exactly one
  `AbilityUpgradeOffer` plus Skip is generated and `OfferScreen` opens
  automatically, chained.

**Starting Roster Draft (Rule 8, Formula F3)**
- **GIVEN** the Starting Roster Draft screen, **WHEN** it renders, **THEN**
  it shows exactly `starting_offer_count` `NewHeroOffer` cards, no Skip
  card, and a "0 of `squad_size` selected" counter.
- **GIVEN** fewer than `squad_size` cards are staged, **WHEN** the player
  attempts to Confirm, **THEN** Confirm is disabled and no proceed action
  is possible.
- **GIVEN** exactly `squad_size` distinct cards are staged, **WHEN**
  Confirm is pressed, **THEN** all `squad_size` picks execute and Roster
  Hub opens for the first time with Active populated by exactly those
  members.

**Accessibility (Rule 12, Tuning Knobs)**
- **GIVEN** keyboard input only (no pointer events), **WHEN** a full
  offer-pick flow is performed (Tab to a card, Enter to stage, Tab to
  Confirm, Enter to confirm), **THEN** the outcome is identical to the
  equivalent mouse-driven flow.
- **GIVEN** any screen at `ui_scale=0.75` and the minimum supported
  resolution, **THEN** no text renders below `menu_min_font_size_px` and no
  interactive element becomes unreachable.
- **GIVEN** a colorblind-simulation pass (protanopia/deuteranopia) over the
  Compare Panel's delta indicators and the Heal/Train cards, **THEN**
  direction/choice remains distinguishable via icon/shape alone.

## Visual/Audio Requirements

- **Distinct iconography per offer category**, concretely: `NewHeroOffer` =
  a recruit/person-plus icon; `AbilityUpgradeOffer` = an upward-chevron icon
  rendered in the upgraded ability's own verb-family accent color, reusing
  `heroes-and-abilities.md`'s "one accent color per verb-family" language;
  `SkipOffer` = a neutral dash/"—" icon, deliberately the least visually
  loud element on the screen — never styled to look like a warning or a
  mistake.
- **Compare Panel layout: side-by-side "Before | After" cards**, not a
  single card with an inline diff. This is chosen so the unmodified "Before"
  card is visually identical to an ordinary Roster/Inspect card (Rule 10
  reuse) — keeping the player's mental model of "what a hero card looks
  like" consistent across every screen in this document (the UX consistency
  heuristic).
- **Upgraded-ability badge reuse (binding, not optional).** Any card in
  this document representing a member with ≥1 filled upgrade slot displays
  the exact same badge icon `ability-upgrades.md`'s Visual/Audio
  Requirements specifies for Battle HUD/Board Rendering — never a second
  icon language for the same fact.
- **No flashing content, unconditionally.** `offer_card_reveal_stagger_ms`'s
  reveal is a fade/slide, never a strobe; no element in this document
  exceeds 3 brightness changes per second at any tuning value — this holds
  at every knob setting, not only the defaults, satisfying the
  Accessibility Checklist's "no flashing content without warning" item
  unconditionally.
- **Icon-first Heal/Train differentiation.** Heal = a cross/heart-style
  icon (verb-neutral — Rest healing is not a hero verb, so it does not
  borrow a verb-family accent color); Train = an upward-arrow icon
  consistent with `AbilityUpgradeOffer`'s chevron language (both represent
  growth). A colorblind player must be able to tell Heal from Train by
  shape alone before reading any label text.
- **Persistent HP readout everywhere a Roster Card appears** (Roster Hub,
  Loadout Config, Inspect Panel, Compare Panel's card-styled elements):
  current HP is always shown as both a numeric "X/Y" label and a
  proportional bar fill, matching `battle-hud.md`'s established "never
  color alone" HP convention, extended to the meta layer — since
  `RosterMember.currentHP` carries real, run-long stakes, a damaged hero
  must never look identical to a full-HP one outside of battle.
- **Audio hooks (owned by Audio System ✅, Designed).** `audio-system.md`'s
  published Event → Cue Mapping pattern and UI-bus/priority model apply
  here directly (that document's Rule 2, Rule 7). Its representative cue
  catalog is battle-focused today, so the specific `cueId`s for the five
  menu trigger points below are **PROVISIONAL** pending a menu-scope
  extension to that catalog — the hook points themselves and their intended
  bus/priority are not provisional: five distinct trigger points need
  distinct one-shot SFX — card focus/hover tick, card stage chime, a single
  consistent Confirm "commit" sting reused across all five screens (one
  learnable "I just made a permanent choice" cue, not five different ones),
  Skip's deliberately muted/neutral tone (less rewarding than confirming a
  non-Skip card, so the player feels the difference), and Heal/Train's own
  distinct one-shots matching their icon differentiation above.

## Open Questions

1. **Gamepad menu navigation is deferred**, matching
   `input-and-selection.md`'s own deferral for the battle board. Formula
   F1's deterministic focus order is designed so a future D-pad/A/B mapping
   (D-pad = Tab-equivalent cycling, A = Enter/activate, B =
   Escape/cancel) could reuse it directly, but no gamepad-specific bindings
   are specified in v1. **PROVISIONAL.**
2. **Exact motion/transition treatment** between `RosterHub`,
   `LoadoutConfig`, `OfferScreen`, and `RestChoice` is not specified beyond
   `offer_card_reveal_stagger_ms` and the "no flashing" requirement — the
   concrete animation curves/durations are deferred to a future
   UI-programmer/art-director implementation pass.
3. **Whether Starting Draft's in-progress staged picks survive a hard
   reload** (Edge Cases) depends on Run Persistence's save-trigger
   granularity, which that document does not currently specify at this
   sub-node resolution. This document's default assumption ("does not
   survive") is **PROVISIONAL**, flagged for confirmation with
   `run-persistence.md`'s maintainers.
4. **Locked-hero display — resolved, not needed in this document.**
   Meta-progression / Unlocks ✅ (Designed, #17) owns hero unlock state and
   exposes it via `getUnlockedHeroIds()`, which Draft / Loadout Meta's
   `buildCandidatePool` (that document's Formula F3) filters against
   *before* any `NewHeroOffer` is ever generated
   (`meta-progression-and-unlocks.md` Rule 13, resolving Draft / Loadout
   Meta's own Rule 17 soft dependency). A locked hero therefore never
   reaches this document's offer data in the first place — there is no
   "locked" card state for Draft/Loadout UI to render and no follow-up
   revision needed here. (Locked-entry *criteria* display for the
   Hero/DifficultyTier/StartingOption categories, per
   `meta-progression-and-unlocks.md` Rule 16, is owned entirely by that
   document's own future Unlocks/Archive UI — a separate screen this
   document does not define.)
5. **Whether the Compare Panel's side-by-side layout survives at
   `ui_scale=0.75` on the smallest supported viewport** without collapsing
   to a stacked layout is flagged for a UI-programmer feasibility pass; if
   infeasible, the deterministic fallback is a top/bottom stacked
   "Before" over "After" pair, preserving the same "reuse the ordinary
   card" principle from the Visual/Audio Requirements above.
