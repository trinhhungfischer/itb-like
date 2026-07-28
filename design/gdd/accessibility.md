# Accessibility

> **Status**: Designed (pending independent `/design-review`)
> **Author**: user + main session (Lean review mode)
> **Last Updated**: 2026-07-28
> **Priority**: Alpha | **Layer**: Polish | **Category**: Meta
> **Implements Pillars**: #1 Perfect Information, Perfect Blame · #5 Read in Ten Seconds
> **Systems index**: #27
> **Requirements baseline**: [`design/ux/accessibility-requirements.md`](../ux/accessibility-requirements.md)

---

## Overview

Accessibility is the **requirements authority**: it defines which accommodations must
exist, what each one must guarantee, and how compliance is verified. It does not build
the settings screen, own the storage format, or apply the values at runtime — that is
**Settings / Options** (#28). Accessibility says *"key remapping must exist and cover
every binding"*; Settings decides how the remapping UI looks and where it is saved.

The load-bearing driver is structural, not optional. `art-bible.md` §1 principle 3
establishes **"one accent color per verb-family"** as a core readability device — the
game deliberately leans on color to communicate. Combined with Pillar 5's ten-second
legibility target, that makes **color-independence a correctness requirement, not a
courtesy**: a player who cannot distinguish the verb palette cannot read the board, and
a game whose entire pitch is Perfect Information has failed its own pillar for that
player.

This system therefore treats accessibility failures the same way the project treats a
broken formula: as defects with a testable pass/fail, not as polish.

---

## Player Fantasy

**"The game never asks me for something I can't give."**

VANGUARD's Core Fantasy is *"I am a cunning commander who wins with my mind."* That
promise is unconditional — it says nothing about eyesight, color perception, motor
precision, or reaction speed, and the game's own design already removes the usual
barriers: battles are turn-based, fully telegraphed, and contain no reaction-time
input anywhere in core play (`game-concept.md`, Pillar 1).

The fantasy this system protects is therefore **the absence of a second, unintended
challenge**. The player should meet exactly one obstacle — the puzzle — and never a
second one made of small text, indistinguishable colors, or an unremappable key. When
a player loses, Pillar 1 promises the loss was *their miscalculation*. An accessibility
failure breaks that promise by making the loss the interface's fault instead.

This is infrastructure the player should never notice working. The measurable success
condition is that no player ever has to think about this system at all.

---

## Detailed Design

### Core Rules

1. **This document owns requirements; Settings / Options owns the shell.** Accessibility
   defines *which* accommodations must exist and *what threshold* each must meet.
   Settings / Options (#28) owns the settings screen, the persistence schema, the
   storage key, and the runtime apply pipeline. Neither may unilaterally change the
   other's domain.

   > **Lane boundary, stated explicitly to prevent the overlap failure mode.** A change
   > to *what a slider does or where it is stored* is Settings' call. A change to
   > *whether the slider must exist, or what range it must cover* is this document's
   > call. When in doubt: this document can be satisfied by a text file of values and
   > no UI at all; anything involving pixels or persistence is Settings'.

2. **Color is never the sole information channel.** Every verb-family, telegraph,
   hazard, team distinction, and unit state must be identifiable by **shape or icon**
   independently of hue. This is the single strictest rule in the document, and it
   binds `art-bible.md`, `board-rendering-and-juice.md`, `battle-hud.md`, and
   `map-run-ui.md` at authoring time — not at a later remediation pass.
   *Verification:* Formula F3's greyscale test.

3. **The greyscale test is a blocking gate.** Any screen or board state that loses
   game-relevant information when rendered in greyscale is a defect. This applies to
   the battle board, the HUD, the map screen, and the draft screens. It is verified
   per screen, not once globally (Verification Procedures).

4. **Contrast minimums are numeric and enforced.** Body text ≥ 4.5:1, large and UI text
   ≥ 3:1, measured by Formula F1 (WCAG 2.1 relative-luminance ratio). These are floors,
   not targets.

5. **UI scale must reach 150% without loss.** Every screen must remain fully usable at
   `uiScale = 1.5` with no clipping, overlap, or truncation of game-relevant text.
   `map-run-ui.md` already fixes `uiScale ∈ [1.0, ui_scale_max]` with a hard floor of
   1.0 — scaling only ever grows. This document requires the *upper* range to be
   honoured; it does not redefine the knob.

6. **Every binding must be remappable.** All keyboard bindings enumerated in
   `design/ux/interaction-patterns.md` must be user-reassignable. No binding may be
   hardcoded, including confirm, cancel, undo, and end-turn.

7. **The game must be fully playable keyboard-only.** Every action reachable by mouse
   must be reachable by a deterministic Tab-cycle plus Enter/Esc. `draft-loadout-ui.md`
   already specifies `tabOrder(screen, state)` for its screens; this rule extends the
   same requirement to every screen.

8. **The game must be fully playable muted.** No telegraph, threat, outcome, or state
   change may be communicated by audio alone. `audio-system.md` Rule 12 already commits
   to this ("a stinger's absence must never remove any information"); this document
   makes it a verified gate rather than an authoring intention.

9. **Reduced motion must preserve all information.** The `reduced_motion` setting
   minimises or disables juice — knockback tweens, screen shake, particle flourishes —
   while leaving every informational overlay intact. A player with reduced motion
   enabled sees strictly less decoration and exactly the same data.

10. **No content flashes above 3 Hz.** Photosensitivity limit, applies to all VFX,
    UI transitions, and telegraph pulses. This is an absolute prohibition with no
    setting to toggle — flashing content above the threshold is simply not authored.

11. **Reduced motion defaults to the OS preference.** Initial value is read from the
    `prefers-reduced-motion` media query rather than defaulting to `false`. A player who
    has already told their OS they need this must not have to tell the game again.

12. **No accommodation may be gated behind progression, difficulty, or payment.** Every
    setting in this document's Required Accommodations table is available from first
    launch.

13. **No accommodation may alter game balance.** Every requirement here changes
    *presentation and input*, never simulation state. `require_confirm_click` adds a
    confirmation step; it does not grant extra actions. Reduced motion removes
    animation; it does not change resolution. This keeps accessibility orthogonal to
    difficulty and means no player is ever choosing between comfort and challenge.

14. **The game's own design already removes several barrier classes — these must not
    be reintroduced.** Battles are turn-based with no reaction-time input, all
    information is telegraphed, and Move Preview is always available. No future system
    may add a timed input, a hidden-information mechanic, or a preview-gated feature
    without breaking this rule and Pillar 1 simultaneously.

15. **Accessibility requirements are verified per screen, not per release.** Each screen
    or system carries the Verification Procedures checklist as an acceptance condition.
    A screen that has not been checked is not done.

### Required Accommodations

The authoritative list. Settings / Options must surface every row; other systems must
respect every threshold.

| # | Accommodation | Requirement | Owner of the value | Verified by |
|---|---|---|---|---|
| A1 | Shape/icon redundancy | Every verb, telegraph, hazard, team, and unit state identifiable without hue | `art-bible.md`, per-system art | F3 greyscale |
| A2 | Colorblind palette | 8-way palette distinguishable under deuteranopia, protanopia, tritanopia; mode variants selectable | `art-bible.md` palette | F4 separation |
| A3 | UI scale | `uiScale` adjustable across `[1.0, 1.5]` minimum, no clipping | `map-run-ui.md` (`uiScale`, `ui_scale_max`) | F2 + 150% pass |
| A4 | Text contrast | Body ≥ 4.5:1, large/UI ≥ 3:1 | `art-bible.md` palette | F1 |
| A5 | Full key remapping | Every binding in `interaction-patterns.md` reassignable | `input-and-selection.md` | Remap pass |
| A6 | Confirm-click | `require_confirm_click` available, default `false` | `input-and-selection.md` (line 377) | Manual |
| A7 | Keyboard-only play | Every action reachable without a mouse | per-screen `tabOrder` | Keyboard pass |
| A8 | Reduced motion | `reduced_motion` available, defaults to OS preference | `map-run-ui.md` | Reduced-motion pass |
| A9 | Muted play | No information conveyed by audio alone | `audio-system.md` Rule 12 | Muted pass |
| A10 | Flash limit | Nothing above 3 Hz; no toggle, simply not authored | per-system VFX | VFX review |
| A11 | Cognitive load | Move Preview and Inspect always available; onboarding teaches one verb at a time | `move-preview.md`, `onboarding-tutorial.md` | Manual |

**Note on A6 and A11:** both are already satisfied by existing designs — this document
does not request new features, it forbids their removal. `require_confirm_click` exists
in `input-and-selection.md`; Move Preview is a base feature and chain-reaction preview
was explicitly promoted out of the passive pool to stay free
(`passive-modules-and-equipment.md`, T4 resolution). Those decisions are now
accessibility requirements and may not be reversed for slot-economy reasons.

### States and Transitions

This document defines **no runtime state machine.** It is a requirements and
verification authority; the settings values it constrains are owned and stored by
Settings / Options (#28).

The only lifecycle it owns is **per-screen compliance status**:

`Unverified → {Pass | Fail(checklist items)}`

| Transition | Trigger |
|---|---|
| `Unverified → Pass` | All applicable Verification Procedures items pass for that screen |
| `Unverified → Fail` | Any applicable item fails |
| `Fail → Pass` | Defects fixed and re-verified |
| `Pass → Unverified` | The screen's visuals, layout, or bindings change |

A screen at `Unverified` or `Fail` is **not Done**, per Rule 15.

### Interactions with Other Systems

| System | Reads from Accessibility | Accessibility reads / calls | Ownership boundary |
|---|---|---|---|
| **Settings / Options** (#28) | The Required Accommodations table — every row must be surfaced | — | **The core boundary (Rule 1).** This document says what must be configurable; Settings owns the screen, schema, storage, and apply pipeline |
| **Board Rendering & Juice** | A1 shape redundancy, A8 reduced-motion scope, A10 flash limit | — | Rendering owns the visuals; this document owns the constraints they satisfy |
| **Battle HUD** | A1, A3 scale behaviour, A4 contrast | — | Same |
| **Map/Run UI** | A1, A3, A8 — and owns the `uiScale` / `reduced_motion` values themselves | `uiScale` range, `reduced_motion` | Map/Run UI already declares these knobs; this document constrains their required range, not their definition |
| **Input & Selection** | A5 remapping coverage, A6 `require_confirm_click`, A7 keyboard-only | `require_confirm_click` default | Input owns bindings; this document requires they all be remappable |
| **Audio System** | A9 muted-play guarantee | Rule 12's no-information-by-audio commitment | Audio owns the mix; this document makes its existing commitment a verified gate |
| **Art Bible** | A1, A2, A4 — palette and shape language | Palette values for F1/F4 | Art owns the palette; this document owns its compliance thresholds |
| **Onboarding / Tutorial** | A11 pacing requirement | — | Onboarding owns the sequence; this document requires one-verb-at-a-time |
| **Move Preview** | A11 always-available requirement | — | Preview is a base feature and must remain one |
| **Localization** | `locale` must not break A3 or A4 | — | Translated strings must satisfy the same scale and contrast floors |

**Systems requiring zero changes:** Board & Grid, Combat Resolution, Turn & Phase
Manager, Heroes & Abilities, Enemy Abilities & Telegraph, Objective / Win-Lose, Run
Persistence, Draft / Loadout Meta, Pilots, Node Bonuses. Per Rule 13, accessibility
never touches simulation state.

---

## Formulas

### F1 — Contrast ratio (WCAG 2.1)

`contrast(c₁, c₂) = (L_lighter + 0.05) / (L_darker + 0.05)`

where relative luminance `L` for an sRGB color is:

`L = 0.2126·R + 0.7152·G + 0.0722·B`

with each channel `C ∈ {R, G, B}` linearised from its 0–1 sRGB value `c`:

`C = c / 12.92`                        if `c ≤ 0.03928`
`C = ((c + 0.055) / 1.055) ^ 2.4`      otherwise

**Variables:**

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| `c₁`, `c₂` | — | sRGB triple | each channel 0–1 | Foreground and background colors |
| `L` | — | float | 0.0–1.0 | Relative luminance (0 = black, 1 = white) |
| `contrast` | — | float | 1.0–21.0 | Ratio; 1.0 = identical, 21.0 = black on white |

**Output Range:** 1.0 to 21.0.

**Thresholds:** body text ≥ **4.5**, large text (≥ 18pt, or ≥ 14pt bold) and UI
components ≥ **3.0** (A4).

**Example:** white `#FFFFFF` (L = 1.0) on the art bible's neutral board background. If
the background is `#4A4A4A` (c ≈ 0.290 → C ≈ 0.0675 per channel → L ≈ 0.0675), then
`contrast = (1.0 + 0.05) / (0.0675 + 0.05) = 1.05 / 0.1175 ≈ 8.9` — passes both floors
comfortably.

**Note:** this is the standard WCAG formula, reproduced here so the threshold is
implementable without an external reference. It is not a VANGUARD-specific invention.

### F2 — Effective UI scale

`effectiveSize(base) = base × uiScale`

**Variables:**

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| `base` | — | px | authored per element | The element's authored size at `uiScale = 1.0` |
| `uiScale` | `s` | float | `[1.0, ui_scale_max]`, default 1.0, max 2.0 | Player setting, owned by `map-run-ui.md` |

**Output Range:** `base` to `base × ui_scale_max`. Never below `base` — the floor of
1.0 is a hard invariant from `map-run-ui.md` line 459, so scaling only grows.

**Requirement:** every screen must pass layout verification at `uiScale = 1.5` (A3).
Support beyond 1.5 up to `ui_scale_max` is desirable but only 1.5 is gated.

**Interaction with `menu_min_font_size_px`:** `draft-loadout-ui.md` sets a 14px floor
at `uiScale = 1.0`. Because F2 only multiplies upward, that floor is never violated by
scaling — it can only be violated by authoring text below 14px in the first place.

**Example:** a 14px label at `uiScale = 1.5` renders at 21px. Its container must
accommodate 21px without clipping, which is the actual test — the number is easy, the
layout is the hard part.

### F3 — Greyscale distinguishability test

A pass/fail procedure, not a continuous value.

```
greyscalePass(screen):
  render screen with every color mapped to its relative luminance L (F1)
  for each pair (a, b) of game-relevant distinctions on screen:
      if a and b are distinguishable only by hue: return FAIL(a, b)
  return PASS
```

**"Game-relevant distinction"** means any pair the player must tell apart to play
correctly: two verb-families, two hazard types, hero vs enemy, telegraphed vs
untelegraphed tile, reachable vs unreachable tile, claimed vs bypassed node.

**Output:** `PASS`, or `FAIL` with the specific offending pair — a failure must name
*which two things* are confusable, so it is actionable.

**Example FAIL:** the Shove verb (orange `#FF8800`) and a hypothetical Pull verb in a
similar-luminance blue. Both map to near-identical grey, and if their icons are also
similar the pair fails. **Fix:** change the icon shape (a chevron vs a hooked arrow —
`art-bible.md` §3 already specifies exactly this), not the color.

### F4 — Colorblind palette separation

For each of the three simulated deficiencies `d ∈ {deuteranopia, protanopia,
tritanopia}`, every pair of palette colors must remain separated:

`∀ (c₁, c₂) ∈ palette², c₁ ≠ c₂ :  ΔE₀₀(sim_d(c₁), sim_d(c₂)) ≥ delta_e_min`

**Variables:**

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| `sim_d(c)` | — | sRGB triple | — | `c` transformed through a simulation of deficiency `d` |
| `ΔE₀₀` | — | float | 0–100+ | CIEDE2000 perceptual color difference |
| `delta_e_min` | — | float | 10–25 (default **15**) | Minimum acceptable separation (Tuning Knobs) |
| `palette` | — | sRGB[] | 8 entries (A2) | The verb-family accent palette |

**Output:** `PASS`, or the failing pairs with their `ΔE₀₀` values.

**Fallback when F4 cannot be satisfied:** F4 is the *second* line of defence, not the
first. If an 8-way palette cannot achieve `delta_e_min` under all three deficiencies —
which is likely, since 8 hues is a lot — the resolution is **not** to weaken the
threshold. It is to rely on F3: shape redundancy already guarantees correctness, and
the palette only needs to be *pleasant*, not *sufficient*. Rule 2 is the load-bearing
requirement; F4 is quality of life.

**Example:** a red/green verb pair scores `ΔE₀₀ ≈ 4` under deuteranopia — a clear fail.
Because F3 passes (chevron vs hooked arrow), the game is still correct for that player;
F4's failure is logged as a palette improvement task, not a release blocker.

---

## Edge Cases

- **If a screen passes F3 but fails F4**: the screen ships. Shape redundancy (Rule 2)
  is the correctness guarantee; palette separation is comfort. Log as a palette task.

- **If a screen fails F3**: the screen is a defect and does not ship (Rule 3). The fix
  is a shape or icon change, never "add a colorblind mode that recolors it" — a mode
  that only helps players who found and enabled it does not satisfy Rule 2.

- **If text passes F1 at `uiScale = 1.0` but its container clips at 1.5**: fails A3.
  Contrast and layout are independent gates; passing one does not imply the other.

- **If a binding is required by a platform and cannot be remapped** (e.g. browser
  reserves a key): the binding must not be the *only* way to reach an action (A7). The
  action needs a second reachable path, and the reserved key is documented as
  unavailable rather than silently failing to remap.

- **If `prefers-reduced-motion` is unavailable** (browser doesn't support the query):
  default `reduced_motion` to `false` and rely on the explicit setting. Rule 11 is a
  best-effort default, not a hard requirement, because it depends on a platform
  capability.

- **If reduced motion would hide information**: the animation was carrying information,
  which violates `art-bible.md` §1 principle 2 (telegraphs are icons, not animation).
  The defect is in the animation, not in reduced motion. Fix by moving the information
  into a static overlay.

- **If a localized string breaks layout at `uiScale = 1.5`**: fails A3 for that locale.
  Layout verification is per-locale, not once in English. This is the most commonly
  missed accessibility regression and is called out explicitly for that reason.

- **If a VFX exceeds 3 Hz**: the VFX is rejected outright (Rule 10). There is no
  setting to disable it, because a photosensitive player may be harmed before they
  reach the settings screen.

- **If a future system proposes a timed input**: rejected by Rule 14, and independently
  by Pillar 1. Two rules must both be amended before such a mechanic is legal.

- **If an accommodation would change balance**: rejected by Rule 13. For example, a
  proposed "extra undo depth for motor accessibility" is illegal — undo depth is a
  simulation-scoped rule owned by `turn-and-phase-manager.md`. The accessible
  alternative is `require_confirm_click`, which prevents the misclick instead of
  compensating for it.

- **If a screen's visuals change after it passed verification**: its status reverts to
  `Unverified` (States and Transitions). Verification is not permanent.

---

## Dependencies

### Upstream

| System | What Accessibility consumes | Hard / Soft |
|---|---|---|
| **Art Bible** | The accent palette and shape language, as inputs to F1/F3/F4 | **Hard** |
| **Map/Run UI** | The `uiScale` and `reduced_motion` knob definitions (their range and default) | **Hard** |
| **Input & Selection** | The binding set and `require_confirm_click` | **Hard** |
| **UX Interaction Patterns** | The enumerated binding list that A5 must cover | **Hard** |
| **Audio System** | Rule 12's no-information-by-audio commitment | **Soft** — already committed; this document verifies it |

### Downstream

| System | What it consumes | Hard / Soft |
|---|---|---|
| **Settings / Options** (#28) | The Required Accommodations table — every row must be surfaced | **Hard** |
| **Board Rendering & Juice · Battle HUD · Map/Run UI · Draft/Loadout UI** | A1–A4, A8, A10 as authoring constraints and per-screen acceptance conditions | **Hard** |
| **Onboarding / Tutorial** | A11 pacing requirement | **Soft** |
| **Localization** | Per-locale A3/A4 verification | **Hard** |

**Bidirectional-consistency note:** `design/ux/accessibility-requirements.md` line 7
refers to this system as "Alpha system **#24**"; the systems index numbers it **#27**.
Corrected in this document's landing changeset. `map-run-ui.md` lines 296 and 565 list
Accessibility as "(undesigned, Alpha tier)" — also corrected.

---

## Tuning Knobs

Accessibility owns very few knobs by design — most of its values are **thresholds, not
preferences**, and a threshold that can be tuned down is not a threshold.

| Knob | Default | Safe range | Affects | Too high | Too low |
|---|---|---|---|---|---|
| `delta_e_min` | 15 | 10–25 | F4 palette separation strictness | Almost no 8-hue palette can pass; F4 becomes a permanently-failing check that gets ignored | Below 10, colors that are genuinely confusable pass, and F4 stops meaning anything |
| `ui_scale_verified_max` | 1.5 | 1.25–2.0 | Which scale layout is gated at | Approaching `ui_scale_max` (2.0) makes layout verification very expensive across every screen and locale | Below 1.25 the gate stops catching real clipping defects |

**Explicitly not tunable** (these are floors, not settings): the 4.5:1 and 3:1 contrast
ratios (WCAG-derived), the 3 Hz flash limit (photosensitivity safety), and the
greyscale pass requirement. Lowering any of them is a design change requiring pillar
review, not a tuning decision.

**Not knobs here:** `uiScale` and `ui_scale_max` are owned by `map-run-ui.md`;
`require_confirm_click` by `input-and-selection.md`; `menu_min_font_size_px` by
`draft-loadout-ui.md`. This document constrains their required ranges and must not
redefine them.

---

## Verification Procedures

The per-screen checklist, extending the baseline in
`design/ux/accessibility-requirements.md`. Every screen carries this as an acceptance
condition (Rule 15).

| # | Check | Method | Gate |
|---|---|---|---|
| V1 | **Greyscale pass** | Render the screen with hue stripped (F3); confirm every game-relevant distinction survives | **BLOCKING** |
| V2 | **Contrast pass** | Measure every text/background pair with F1 against the 4.5 / 3.0 floors | **BLOCKING** |
| V3 | **Scale pass** | Render at `uiScale = ui_scale_verified_max` (1.5); confirm no clipping, overlap, or truncation — **per locale** | **BLOCKING** |
| V4 | **Keyboard-only pass** | Complete the screen's full interaction set using only Tab / Enter / Esc / arrows | **BLOCKING** |
| V5 | **Muted pass** | Complete a full battle with audio disabled; confirm no information was missed | **BLOCKING** |
| V6 | **Reduced-motion pass** | Enable `reduced_motion`; confirm every informational overlay is intact and only decoration was removed | **BLOCKING** |
| V7 | **Remap pass** | Reassign every binding; confirm none is hardcoded and none conflicts silently | **BLOCKING** |
| V8 | **Flash audit** | Review all VFX and transitions for content exceeding 3 Hz | **BLOCKING** |
| V9 | **Colorblind separation** | Run F4 across the palette under all three simulated deficiencies | **ADVISORY** — see F4's fallback |

V9 is the only advisory item, for the reason given in F4: shape redundancy is the
correctness guarantee, and gating a release on an 8-hue palette achieving perceptual
separation under three deficiencies would block on something Rule 2 already makes
unnecessary.

---

## Visual/Audio Requirements

This system authors no assets. It constrains the assets other systems author — see the
Required Accommodations table (A1, A2, A4, A8, A10) and the `art-bible.md` interaction
row.

The one thing it does require of presentation: **accessibility state must be
discoverable**. A player who has enabled reduced motion or a colorblind mode should be
able to confirm it is active without reopening settings. How that indicator looks is
Settings / Options' call (Rule 1).

---

## UI Requirements

This system builds no UI. **Settings / Options (#28) owns every screen** on which these
accommodations are configured (Rule 1).

What this document requires *of* that UI:

- Every row of the Required Accommodations table has a corresponding control.
- Accessibility controls are reachable **without** first navigating a screen that
  itself fails an accessibility check — the settings screen must be usable at default
  values by a player who needs the settings. This is the bootstrap requirement and is
  easy to violate: a colorblind-mode toggle rendered in an inaccessible palette is
  useless.
- `reduced_motion` and colorblind mode take effect **immediately** on change, without
  requiring a restart or a screen transition, so the player can evaluate the setting
  against the thing it affects.

---

## Acceptance Criteria

**Core rules**

- **GIVEN** any screen, **WHEN** it is rendered in greyscale, **THEN** every
  game-relevant distinction remains identifiable (Rule 2, V1).
- **GIVEN** a screen that fails the greyscale test, **WHEN** release readiness is
  assessed, **THEN** it is treated as a blocking defect (Rule 3).
- **GIVEN** any body text, **WHEN** F1 is applied against its background, **THEN** the
  result is ≥ 4.5 (Rule 4).
- **GIVEN** any large or UI text, **WHEN** F1 is applied, **THEN** the result is ≥ 3.0.
- **GIVEN** any screen at `uiScale = 1.5` in any supported locale, **WHEN** it renders,
  **THEN** no game-relevant text is clipped, overlapped, or truncated (Rule 5, V3).
- **GIVEN** every binding in `interaction-patterns.md`, **WHEN** the player attempts to
  reassign it, **THEN** the reassignment succeeds (Rule 6, V7).
- **GIVEN** any screen, **WHEN** the player uses only Tab/Enter/Esc/arrows, **THEN**
  every action on that screen is reachable (Rule 7, V4).
- **GIVEN** a full battle with audio disabled, **WHEN** it completes, **THEN** the
  player received every telegraph, threat, and outcome visually (Rule 8, V5).
- **GIVEN** `reduced_motion` enabled, **WHEN** a battle is played, **THEN** every
  informational overlay is present and only decorative motion was removed (Rule 9, V6).
- **GIVEN** all VFX and UI transitions, **WHEN** audited, **THEN** none exceeds 3 Hz
  (Rule 10, V8).
- **GIVEN** a browser reporting `prefers-reduced-motion: reduce`, **WHEN** the game
  launches for the first time, **THEN** `reduced_motion` defaults to enabled (Rule 11).
- **GIVEN** a fresh install with no progression, **WHEN** settings are opened, **THEN**
  every accommodation in the Required Accommodations table is available (Rule 12).
- **GIVEN** any accommodation toggled to any value, **WHEN** a battle is simulated,
  **THEN** the resulting board state is identical to the same battle with default
  settings (Rule 13).

**Formulas**

- **GIVEN** `#FFFFFF` on `#4A4A4A`, **WHEN** F1 is computed, **THEN** the result is
  ≈ 8.9 and passes both floors.
- **GIVEN** identical foreground and background colors, **WHEN** F1 is computed,
  **THEN** it returns 1.0 (the minimum).
- **GIVEN** black on white, **WHEN** F1 is computed, **THEN** it returns ≈ 21.0 (the
  maximum).
- **GIVEN** a 14px label and `uiScale = 1.5`, **WHEN** F2 is applied, **THEN** it
  renders at 21px.
- **GIVEN** any `uiScale` value, **WHEN** F2 is applied, **THEN** the result is never
  less than `base` (the 1.0 floor holds).
- **GIVEN** two colors distinguishable only by hue, **WHEN** F3 runs, **THEN** it
  returns FAIL naming that specific pair.
- **GIVEN** a palette pair scoring `ΔE₀₀ = 4` under deuteranopia with `delta_e_min = 15`,
  **WHEN** F4 runs, **THEN** it reports that pair as failing — and if F3 passes for the
  same pair, the screen still ships (F4 fallback).

**Cross-system**

- **GIVEN** the Required Accommodations table, **WHEN** the Settings screen is built,
  **THEN** every row has a corresponding control (Rule 1).
- **GIVEN** the settings screen at default values, **WHEN** a player who needs an
  accommodation opens it, **THEN** the screen itself passes V1–V4 (bootstrap
  requirement).
- **GIVEN** `reduced_motion` or colorblind mode is changed, **WHEN** the change is
  committed, **THEN** it takes effect immediately without a restart.
- **GIVEN** a screen whose visuals change after passing verification, **WHEN** its
  status is checked, **THEN** it reads `Unverified` (Rule 15).

---

## Open Questions

1. **Screen-reader support.** Not required by this document. VANGUARD is a spatial
   grid game whose core information is a board layout; meaningful screen-reader support
   would require a full textual board representation, which is a substantial system in
   its own right rather than a setting. Explicitly out of v1 scope, and recorded here so
   the omission is a decision rather than an oversight. *Owner:* a future dedicated
   design pass.

2. **Is `ui_scale_max = 2.0` reachable in practice?** `map-run-ui.md` permits it, but
   only 1.5 is gated (`ui_scale_verified_max`). Whether every screen survives 2.0 is
   unverified. *Owner:* per-screen `/ux-review`.

3. **Per-locale verification cost.** V3 requires layout verification per locale, which
   scales with the number of supported languages. Whether that is automated (rendering
   harness) or manual is a tooling decision. *Owner:* `localization-lead` and tooling.

4. **Does `delta_e_min = 15` survive contact with an 8-hue palette?** F4's own fallback
   anticipates it may not. If the palette consistently fails, the honest resolution is
   to reduce the palette to fewer verb-families rather than to lower the threshold —
   which would be a `game-concept.md`-level scope decision. *Owner:* `art-director`,
   escalating to `creative-director` if the palette must shrink.

---

## Review Status

> **Design Review**: not yet run. Execute `/design-review design/gdd/accessibility.md`
> in a **fresh session**.
>
> **Specialist gates not consulted** (Lean review mode; subagent dispatch unavailable):
> `accessibility-specialist` and `ux-designer` — the two most relevant to this document
> — plus `qa-lead` (Verification Procedures) and `art-director` (F4 palette).
> **This document in particular should not go to production without an
> `accessibility-specialist` pass.**
