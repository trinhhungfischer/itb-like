# Settings / Options

> **Status**: Designed (pending independent `/design-review`)
> **Author**: user + main session (Lean review mode)
> **Last Updated**: 2026-07-28
> **Priority**: Alpha | **Layer**: Presentation/Meta | **Category**: Meta
> **Implements Pillars**: #5 Read in Ten Seconds (indirectly, via Accessibility)
> **Systems index**: #28
> **Resolves**: `run-persistence.md` Open Question #8 (settings storage domain)

---

## Overview

Settings / Options is the **shell**: the screen the player configures, the schema those
values live in, the storage domain that persists them, and the pipeline that applies
them at runtime. It owns no policy about *which* options should exist — that authority
belongs to **Accessibility** (#27) for accommodations and to each owning system for its
own knobs. Settings surfaces what others declare.

It resolves one decision that has been explicitly deferred to it.
`run-persistence.md` marks Settings "Out of scope" for its save domains and its Open
Question #8 asks "whether settings get their own save domain/key or piggyback on Meta
Save". **Answer: their own domain** — `vanguard.settings.v{N}`, a third sibling to
`vanguard.meta.v{N}` and `vanguard.run.v{N}`, following that document's existing
isolation architecture exactly.

The reason is the same one Run Persistence used to separate Meta from Run: a corruption
or migration failure in one domain must never take another down with it. Settings are
the domain a player is most likely to need *after* something has gone wrong — a
colorblind player whose Meta Save corrupted must not also lose their palette mode.

---

## Player Fantasy

**"It remembered."**

There is no fantasy here in the usual sense. Settings is infrastructure, and the
measure of infrastructure is that the player never thinks about it. The player sets a
volume once, remaps a key once, enables reduced motion once — and the game simply
respects that forever, across sessions, across runs, across a corrupted save, across a
version upgrade.

The failure states are what the player *would* feel: a volume that resets on reload, a
keybind that reverts after an update, a settings screen that loses everything because
an unrelated save file broke. Each of those is a small betrayal, and the domain
isolation in this document exists specifically to make them impossible.

The one genuine experiential requirement: **changes take effect immediately**. A player
adjusting a volume slider hears the result while dragging it; a player enabling reduced
motion sees the motion stop. Nothing here requires a restart, and nothing requires the
player to hunt for an Apply button to find out whether their change worked.

---

## Detailed Design

### Core Rules

1. **Settings owns the shell; other systems own the policy.** This document owns the
   settings screen, the `SettingsState` schema, the `vanguard.settings.v{N}` storage
   domain, and the apply pipeline. It does **not** decide which accommodations must
   exist (→ **Accessibility** #27, Required Accommodations table) or what a value
   means (→ the owning system: `map-run-ui.md` for `uiScale`, `input-and-selection.md`
   for `require_confirm_click`, `audio-system.md` for bus gain).

2. **Settings live in their own persistence domain.** `vanguard.settings.v{N}` — a
   third domain alongside Meta and Run, with its own `schemaVersion`, its own migration
   chain, and its own checksum, exactly per `run-persistence.md` Rules 1 and 6. A
   failure in any other domain leaves settings intact and readable.

3. **Settings are global, never run-scoped.** They survive run start, run end, run
   abandonment, and Meta Save reset. Nothing in `RunState` may hold a setting, and
   deleting a run never touches this domain.

4. **Every value has a defined default, and defaults are resolvable without storage.**
   A first launch with no stored settings produces a fully playable configuration
   (Formula F3). Storage is an optimisation over defaults, never a prerequisite.

5. **Some defaults are resolved from the platform, not hardcoded.** `reduced_motion`
   defaults to the `prefers-reduced-motion` media query and `locale` to the browser
   locale, per Accessibility Rule 11. A platform-derived default is used **only when no
   stored value exists** — once the player sets a value explicitly, the platform is
   never consulted again for that key.

6. **Changes apply immediately, with no Apply button and no restart.** Every setting
   takes effect on change. This is a hard requirement, not a convenience: Accessibility's
   UI Requirements state a player must be able to evaluate an accommodation against the
   thing it affects.

   **Exception — destructive bulk actions confirm first** *(added 2026-07-28,
   `ux-designer` gate).* Rule 6 governs **changing a value**. It does **not** govern
   **discarding a set of values**. A reset (Rule 14) is irreversible, is not covered by
   any undo, and can destroy a keybinding layout a motor-accessibility player spent real
   effort building — precisely the population this document exists to serve. Every reset
   control therefore requires an explicit confirm step. Reading "no Apply button" as
   "no confirm dialog" would make a single misclick permanently destructive.

   **`ui_scale` applies visually on drag, and re-lays-out on release.** An immediate
   full layout recomputation on every mouse-move tick of a slider drag costs a text and
   layout pass across every visible element, against a 60 FPS / <200 draw-call budget.
   A cheap visual transform during the drag satisfies "immediate" in spirit; the
   committed re-layout fires on release. This also avoids a Fitts's Law hazard — HUD
   controls shifting under the cursor at the instant the player closes settings.

7. **Changes persist on commit, debounced.** A committed change writes the whole
   `SettingsState` to storage, debounced by `settings_write_debounce_ms` so that
   dragging a slider does not issue a write per frame. The in-memory value is always
   authoritative for the running session; storage is a mirror.

8. **A failed write never blocks play.** If `localStorage` is unavailable or throws
   (private browsing, quota, disabled), settings still apply for the session and the
   player is informed once that they will not persist. `run-persistence.md` Edge Cases
   already establishes this behaviour for its own domains; this document matches it.

9. **A corrupted settings domain resets to defaults, quarantined.** On parse failure,
   checksum mismatch, or missing required field: quarantine under
   `vanguard.settings.corrupt.{timestamp}`, reset to defaults (Rule 4), and inform the
   player. Matches `run-persistence.md`'s quarantine handling exactly.

10. **A newer-version settings domain is left untouched.** If
    `schemaVersion > CURRENT_VERSION`, the domain is treated as unavailable for the
    session — no read, no write, no quarantine-delete — and defaults are used. This
    preserves the settings of a player who downgraded, matching
    `run-persistence.md` Rule 6's `Unsupported(NewerVersion)` state.

11. **Unknown keys in a stored payload are preserved, not dropped.** A settings file
    written by a newer build that this build cannot interpret has its unknown keys
    carried through on the next write. Combined with Rule 10, this makes
    downgrade/upgrade cycles non-destructive.

12. **No setting may alter simulation state.** Per Accessibility Rule 13, every value
    here affects presentation, input handling, or audio — never board state, formulas,
    or resolution. A deterministic replay produces identical results regardless of
    settings. This is what makes settings safe to exclude from the Run Save.

13. **Key remapping conflicts are surfaced, not silently resolved.** Assigning a key
    already bound elsewhere shows the conflict and requires the player to resolve it.
    A silent steal is a defect (Accessibility V7).

    **Resolution options (specified 2026-07-28, `ux-designer` gate — previously the
    document mandated "resolve it" without ever saying how).** On conflict the player
    is offered exactly two choices:
    - **Cancel** — abandon the new assignment; both bindings keep their current keys.
      Returns to `Idle`.
    - **Swap** — the new action takes the key, and the action that previously held it
      becomes **Unbound**, shown as an explicit warning state rather than silently
      dropped. An unbound action is legal but flagged, because Accessibility A7
      requires every action stay reachable.

    The state machine is therefore
    `Idle → Listening → {Assigned | Conflict → (Cancel → Idle | Swap → Assigned)}`.

14. **A reset-to-defaults action exists at three scopes.** Per **binding**, per
    **section** (all four — Audio, Accessibility, Input, General), and **global**.
    Every reset confirms first (Rule 6's exception).

    Per-binding reset was added 2026-07-28 (`ux-designer` gate, resolving the former
    Open Question #5). The argument is cost asymmetry: making a player discard an
    entire section's customisation to undo one mis-bound key discourages exactly the
    experimentation that remapping exists to enable — most of all for the
    motor-accessibility players A5 is written for. Each binding row already owns UI
    real estate, so the cost is low.

15. **The settings screen is reachable from everywhere, including mid-battle.** From
    the main menu, the map screen, and an in-battle pause. Mid-battle access is
    required: a player who discovers they need reduced motion or a remap during a
    battle must not have to abandon it. Opening settings mid-battle never advances a
    turn, never consumes an action, and never affects the undo stack.

    > **🔴 BLOCKED — the mid-battle entry point does not exist** *(found 2026-07-28 by
    > the `ux-designer` gate; this rule previously stated the requirement as settled).*
    > Three upstream facts:
    > - `turn-and-phase-manager.md`'s battle state machine (`Setup → InTurn → Ended`)
    >   has **no `Paused` state at all**.
    > - `input-and-selection.md` line 286 is the only pause hook anywhere, and that
    >   document says of it: *"Still a reserved hook in v1's MVP scope."* Its Open
    >   Question #5 repeats that it is not implemented.
    > - `battle-hud.md`'s six persistent zones contain **no Settings or Pause
    >   affordance** — no icon, no button, no zone.
    >
    > Net effect: **mouse-only players — the stated primary input for this game — have
    > no path into settings mid-battle**, and keyboard users depend on a deferred hook.
    > This rule is a requirement *on* Turn & Phase Manager, Input & Selection, and
    > Battle HUD, not a description of existing behaviour. Resolving it needs a
    > `Paused` state and a HUD affordance. *Owner:* Open Question #6.
    >
    > **The `main menu` entry point has the same status** — no `main-menu` GDD exists.
    > Forward dependency, not a resolved path.

### Settings Catalog

Every row is declared by another system; this document surfaces them.

**Audio** — values call `audio-system.md`'s `setBusGain(bus, db)` API (Formula F1).

| Key | Type | Default | Range | Declared by |
|---|---|---|---|---|
| `volume_master` | int | 100 | 0–100 | `audio-system.md` Rule 7 |
| `volume_music` | int | 100 | 0–100 | `audio-system.md` Rule 7 |
| `volume_sfx` | int | 100 | 0–100 | `audio-system.md` Rule 7 |
| `volume_ui` | int | 100 | 0–100 | `audio-system.md` Rule 7 |
| `volume_ambience` | int | 100 | 0–100 | `audio-system.md` Rule 7 |
| `muted` | bool | `false` | — | this document |

**Accessibility** — every row maps to an Accessibility Required Accommodation.

*Renamed from "Display / Accessibility" 2026-07-28 (`ux-designer` gate): the section
contains no non-accessibility item, so "Display" was misleading. See the cross-cutting
view note under UI Requirements — `require_confirm_click` (A6) and `keybindings`
(A5/A7) live under **Input**, where players expect them, so this section alone is not
the whole accessibility surface.*

| Key | Type | Default | Range | Declared by | Accommodation |
|---|---|---|---|---|---|
| `ui_scale` | float | 1.0 | `[1.0, ui_scale_max]` (max 2.0) | `map-run-ui.md` line 459 | A3 |
| `reduced_motion` | bool | **OS** `prefers-reduced-motion` | — | `map-run-ui.md` line 643 | A8 |
| `colorblind_mode` | enum | `None` | `None \| Deuteranopia \| Protanopia \| Tritanopia` | `art-bible.md` palette | A2 |

**Input**

| Key | Type | Default | Range | Declared by | Accommodation |
|---|---|---|---|---|---|
| `require_confirm_click` | bool | `false` | — | `input-and-selection.md` line 377 | A6 |
| `keybindings` | map | per `interaction-patterns.md` | — | `input-and-selection.md` | A5, A7 |

**General**

| Key | Type | Default | Range | Declared by |
|---|---|---|---|---|
| `locale` | string | **OS** browser locale | supported locales | Localization |

> **Catalog completeness is an Accessibility gate, not this document's judgement.**
> Accessibility's Required Accommodations table A1–A11 is the authority. A1, A4, A10,
> and A11 have no row here because they are **authoring constraints with no player
> control** — shape redundancy, contrast, the flash limit, and always-available preview
> are properties of the built game, not toggles. Their absence from this catalog is
> correct and deliberate.

### Data Contracts

```
SettingsState {
  schemaVersion: int                 // this domain's own counter (Rule 2)
  audio: {
    master: int, music: int, sfx: int, ui: int, ambience: int   // 0..100
    muted: bool
  }
  display: {
    uiScale: float                   // [1.0, ui_scale_max]
    reducedMotion: bool
    colorblindMode: None | Deuteranopia | Protanopia | Tritanopia
  }
  input: {
    requireConfirmClick: bool
    keybindings: { [actionId: string]: KeyCode }
  }
  general: {
    locale: string
  }
  _unknown: { [key: string]: unknown }   // preserved forward-compat keys (Rule 11)
}
```

Stored under `vanguard.settings.v{N}` with the same envelope
(`schemaVersion` + `data` + checksum) `run-persistence.md` uses for its domains.

### States and Transitions

**Domain state** (mirrors `run-persistence.md`'s per-domain model exactly):

| State | Entry condition | Behaviour |
|---|---|---|
| `Empty` | No key present | Resolve defaults (F3); write on first commit |
| `Valid` | Parsed, checksum OK, `schemaVersion ≤ CURRENT` | Loaded; migrated if older (F4) |
| `Corrupted` | Parse failure, checksum mismatch, or missing required field | Quarantine to `vanguard.settings.corrupt.{timestamp}`, reset to defaults (Rule 9) |
| `Unsupported(NewerVersion)` | `schemaVersion > CURRENT` | Untouched — no read, no write, no delete. Defaults used for the session (Rule 10) |
| `Unavailable` | `localStorage` throws or is disabled | Defaults used; session-only; player informed once (Rule 8) |

**Per-setting lifecycle:** `Default → Modified → Committed`. `Modified` is the live
in-memory value (already applied, per Rule 6); `Committed` means it has also been
written to storage (debounced, per Rule 7). A session that ends between `Modified` and
`Committed` loses at most `settings_write_debounce_ms` of change.

**Keybinding assignment:** `Idle → Listening → {Assigned | Conflict → Idle}`. The
`Conflict` state requires explicit player resolution and never auto-resolves (Rule 13).

### Interactions with Other Systems

| System | Reads from Settings | Settings reads / calls | Ownership boundary |
|---|---|---|---|
| **Accessibility** (#27) | — | The Required Accommodations table, which dictates catalog completeness | **The core boundary (Rule 1).** Accessibility says what must be configurable; this document owns the screen, schema, storage, and apply pipeline |
| **Audio System** | Bus gains, applied via `setBusGain(bus, db)` | The bus list and the gain API | Audio owns the bus/gain model and the API; Settings owns the sliders that call it. `audio-system.md` line 202 already states exactly this split |
| **Input & Selection** | `require_confirm_click`, the active keybinding map | The binding set and its defaults | Input owns what a binding does; Settings owns what key it is on |
| **Map/Run UI** | `uiScale`, `reduced_motion` | The knob definitions and their ranges | Map/Run UI declares the knobs (lines 459, 643); Settings persists and surfaces them |
| **Board Rendering & Juice** | `reduced_motion`, `colorblind_mode` | — | Read-only consumer |
| **Battle HUD · Draft/Loadout UI** | `uiScale`, `colorblind_mode` | — | Read-only consumers |
| **Run Persistence** | — | Its domain envelope, checksum, and migration conventions — **as a pattern, not as a dependency** | Settings is a **fourth peer**, not a client. It does not call Run Persistence; it implements the same architecture in its own domain (see Dependencies) |
| **Localization** | `locale` | The supported-locale list | Localization owns the strings; Settings owns the selection |

**Systems requiring zero changes:** Board & Grid, Combat Resolution, Turn & Phase
Manager, Move Preview, Heroes & Abilities, Enemy Abilities & Telegraph, Objective /
Win-Lose, Draft / Loadout Meta, Pilots, Node Bonuses. Per Rule 12, no setting reaches
simulation state.

---

## Formulas

### F1 — Volume slider to bus gain

Converts a 0–100 slider to the decibel value `audio-system.md`'s `setBusGain(bus, db)`
expects.

`gainDb(v) = -∞ (muted)                if v = 0`
`gainDb(v) = 20 · log₁₀(v / 100)       otherwise`

**Effective gain on a bus**, combining its own slider with Master:

`effectiveDb(bus) = gainDb(v_bus) + gainDb(v_master)`, and `-∞` if `muted` is true.

**Variables:**

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| `v` | — | int | 0–100 | Slider position |
| `gainDb` | — | float | `-∞` to 0.0 | Attenuation in decibels; 0 dB = unattenuated |
| `muted` | — | bool | — | Global mute; overrides all sliders |

**Output Range:** `-∞` to 0.0 dB per bus; the combined `effectiveDb` reaches `-∞` if
either the bus or Master is at 0.

**Why this curve:** each halving of `v` is −6 dB, which is the standard perceptual
halving of loudness. A linear slider-to-dB map would make the top half of the slider do
almost nothing and the bottom 10% do everything.

**Example:** `v_sfx = 50`, `v_master = 100`.
`gainDb(50) = 20·log₁₀(0.5) ≈ −6.02 dB`; `gainDb(100) = 20·log₁₀(1.0) = 0 dB`.
`effectiveDb(SFX) ≈ −6.02 dB` — SFX at half perceived loudness. Dropping Master to 50
as well yields ≈ −12.04 dB.

**Boundary:** `v = 0` must be special-cased to `-∞` rather than computed —
`log₁₀(0)` is undefined, and clamping to a large negative number leaves audible
residue on some mixers.

### F2 — Effective value resolution

The single accessor every consuming system uses.

`value(key) = stored[key]        if key ∈ stored ∧ valid(stored[key])`
`value(key) = platform(key)      if key ∈ PLATFORM_DEFAULTED ∧ key ∉ stored`
`value(key) = DEFAULTS[key]      otherwise`

**Variables:**

| Variable | Type | Description |
|---|---|---|
| `stored` | map | The loaded `SettingsState`, empty if domain is `Empty`/`Corrupted`/`Unavailable` |
| `PLATFORM_DEFAULTED` | set | `{ reduced_motion, locale }` (Rule 5) |
| `platform(key)` | — | `prefers-reduced-motion` query, or browser locale |
| `DEFAULTS` | map | The Settings Catalog's Default column |
| `valid(v)` | bool | `v` is in the key's declared Range |

**Output:** always a usable value — the fallback chain is total (Rule 4).

**Ordering matters:** `stored` is checked **before** `platform`, so an explicit player
choice always beats an OS preference (Rule 5). A player who enabled motion despite
their OS preference is not overridden on every launch.

**Example:** OS reports `prefers-reduced-motion: reduce`, and the player has never
touched the setting. `reduced_motion ∉ stored` and is in `PLATFORM_DEFAULTED`, so
`value = true`. The player then disables it; `stored.reducedMotion = false`. On next
launch the first clause matches and returns `false` — the OS is not consulted again.

### F3 — First-launch default resolution

`defaults() = { key ↦ value(key) : key ∈ CATALOG }` with `stored = ∅`

**Output:** a complete, valid `SettingsState` with no storage read required. This is
the configuration Rules 4, 8, 9, and 10 all fall back to, so it must be total over the
catalog.

**Example:** fresh install, OS prefers reduced motion, browser locale `vi-VN`. Result:
all volumes 100, `muted` false, `uiScale` 1.0, `reducedMotion` **true** (platform),
`colorblindMode` None, `requireConfirmClick` false, default keybindings, `locale`
**`vi-VN`** (platform, if supported — otherwise `DEFAULTS.locale`).

### F4 — Migration

`migrate(data, v_stored, v_current) = fold(migrations[v_stored..v_current-1], data)`

**Variables:**

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| `v_stored` | — | int | ≥ 1 | `schemaVersion` in the loaded payload |
| `v_current` | — | int | ≥ 1 | Version this build expects |
| `migrations` | — | fn[] | — | Ordered, one per version step |

**Behaviour by relation:**

| Relation | Action |
|---|---|
| `v_stored = v_current` | No migration |
| `v_stored < v_current` | Apply each step in order (sequential chain, per `run-persistence.md` Rule 6) |
| `v_stored > v_current` | **No action.** Domain enters `Unsupported(NewerVersion)`; defaults are used and the stored payload is left byte-for-byte intact (Rule 10) |

**Independence:** this chain is entirely separate from Meta's and Run's. A settings
schema change bumps only `vanguard.settings.v{N}` — which is the concrete benefit of
Rule 2's own-domain decision over the piggyback alternative.

**Example:** `v_stored = 1`, `v_current = 3`. Apply `migrations[1]` then
`migrations[2]`. Unknown keys are carried through each step untouched (Rule 11).

---

## Edge Cases

- **If `localStorage` is entirely unavailable**: defaults resolve (F3), settings apply
  and work normally for the session, and the player is told once that they will not
  persist. Play is never blocked (Rule 8).

- **If the settings write fails but reads succeed** (quota exceeded): the in-memory
  value stays applied; the write is retried on the next commit. The player is informed
  after a second consecutive failure, not the first — a transient quota blip should not
  produce a dialog.

- **If the settings payload is corrupted**: quarantine, reset to defaults, inform. The
  player's Meta and Run saves are untouched — this is the isolation Rule 2 exists for.

- **If the settings payload is from a newer build**: left untouched, defaults used for
  the session (Rule 10). When the player upgrades again, their settings return intact.

- **If a stored value is outside its declared range** (e.g. `uiScale = 0.5`, below
  `map-run-ui.md`'s hard 1.0 floor): `valid()` fails for that key and F2 falls through
  to the default. **Per-key**, not whole-payload — one bad value must not discard a
  whole settings file.

- **If a stored `locale` is no longer supported** (removed in an update): falls through
  to `DEFAULTS.locale`. The stored value is preserved in `_unknown` in case the locale
  returns.

- **If the player remaps a key to one already bound**: the conflict is shown and must be
  resolved explicitly (Rule 13). Neither binding changes until the player chooses.

- **If the player remaps every key to the same key**: prevented by Rule 13 — the second
  assignment conflicts. There is no state in which an action becomes unreachable
  through remapping alone.

- **If a key is reserved by the browser and cannot be captured**: the remap fails
  visibly with an explanation. Per Accessibility Edge Cases, the affected action must
  have a second reachable path, so a failed remap never strands an action.

- **If the player opens settings mid-battle**: the battle is paused. No turn advances,
  no action is consumed, and the undo stack is untouched (Rule 15). Changing `ui_scale`
  or `reduced_motion` mid-battle re-renders the board immediately without altering any
  board state (Rule 12).

- **If the player changes `require_confirm_click` mid-battle**: takes effect on the next
  input. An input already in progress completes under the old behaviour, so the setting
  never strands a half-committed selection.

- **If the player resets a section to defaults**: only that section's keys are affected
  (Rule 14). A global reset affects all sections and, per Rule 5, re-consults the
  platform for `PLATFORM_DEFAULTED` keys — a global reset should behave like a fresh
  install.

- **If two browser tabs of the game are open**: `localStorage` is shared per origin.
  Last write wins, matching `run-persistence.md`'s existing multi-tab behaviour. Settings
  changed in one tab do not live-propagate to the other; the other tab's in-memory
  values remain authoritative for its session.

- **If `muted` is true and the player raises a volume slider**: the slider value is
  stored and shown, but `effectiveDb` stays `-∞` until `muted` is cleared (F1). The UI
  must indicate the mute is what is silencing output, not the slider position.

---

## Dependencies

### Upstream

| System | What Settings consumes | Hard / Soft |
|---|---|---|
| **Accessibility** (#27) | The Required Accommodations table — dictates catalog completeness | **Hard** |
| **Audio System** | The bus list and `setBusGain(bus, db)` | **Hard** |
| **Input & Selection** | The binding set, its defaults, and `require_confirm_click` | **Hard** |
| **Map/Run UI** | `uiScale` / `ui_scale_max` and `reduced_motion` definitions | **Hard** |
| **UX Interaction Patterns** | The enumerated action list that `keybindings` maps | **Hard** |
| **Localization** | The supported-locale list | **Soft** — `locale` degrades to the default if localization is absent |

> **Note on Run Persistence.** Settings is a **peer domain, not a client**. It does not
> call Run Persistence and Run Persistence does not call it — `run-persistence.md`
> line 171 explicitly places settings outside its save domains. What this document
> borrows is the *architecture*: the envelope shape, the checksum, the per-domain
> `schemaVersion`, the sequential migration chain, and the four-state load model. That
> is deliberate consistency, not a dependency, and it is why a Run Persistence outage
> cannot affect settings.

### Downstream

| System | What it consumes | Hard / Soft |
|---|---|---|
| **Audio System** | Bus gains via `setBusGain` (F1) | **Hard** |
| **Board Rendering & Juice** | `reduced_motion`, `colorblind_mode` | **Hard** |
| **Battle HUD · Map/Run UI · Draft/Loadout UI** | `ui_scale`, `colorblind_mode` | **Hard** |
| **Input & Selection** | The active `keybindings` map, `require_confirm_click` | **Hard** |
| **Localization** | `locale` | **Hard** |

**Bidirectional-consistency note:** `run-persistence.md` line 171 and Open Question #8,
`audio-system.md` lines 104–107 and 202, and `map-run-ui.md` lines 297 and 565 all
describe this system as undesigned or Not Started. Corrected in this document's landing
changeset.

---

## Tuning Knobs

| Knob | Default | Safe range | Affects | Too high | Too low |
|---|---|---|---|---|---|
| `settings_write_debounce_ms` | 500 | 100–2000 | Write frequency vs. loss window | A session ending shortly after a change loses it; above ~2s a player who changes a setting and immediately closes the tab reliably loses the change | Below ~100ms a slider drag issues a write per frame, thrashing `localStorage` synchronously on the main thread |
| `settings_schema_version` | 1 | ≥ 1 | Migration chain | — | Never decrement; `run-persistence.md` Rule 6's sequential-chain model assumes monotonic versions |

**Not knobs here:** every value in the Settings Catalog is a *player preference*, not a
designer knob — their ranges and defaults are owned by the declaring systems
(`map-run-ui.md`, `input-and-selection.md`, `audio-system.md`). This document must not
redefine them.

---

## Visual/Audio Requirements

> `art-director` and `ux-designer` not consulted — Lean review mode, and subagent
> dispatch was unavailable in the authoring session. Review manually before production.

- **The settings screen must itself pass Accessibility V1–V4** at *default* values.
  This is the bootstrap requirement from Accessibility's UI Requirements and is the
  easiest thing here to get wrong: a colorblind-mode selector that a colorblind player
  cannot read is useless. It is the one screen that must be verified before the
  accommodations it configures are available.
- **Audio sliders give immediate audible feedback.** Dragging a bus slider plays a
  short representative cue on that bus, so the player hears what they are setting
  rather than guessing from a number. **The cue is throttled** — unlike the storage
  write, nothing previously bounded its retrigger rate, so a fast drag across the full
  range would stack the cue into a machine-gun artifact, the opposite of the legibility
  this is for. One cue per `audio_preview_throttle_ms`, and never overlapping itself.
- **The settings overlay is translucent, not opaque — at least for Accessibility.**
  *(Changed 2026-07-28, `ux-designer` gate.)* Accessibility requires a setting be
  evaluable against **the thing it affects**. For `colorblind_mode` and
  `reduced_motion` opened mid-battle, that thing is the **real board** — its actual
  telegraphs, hazard colours, and HP states in the fight currently in progress. A
  full-screen modal replacing the board with a generic sample evaluates against a
  stand-in instead, and the fact that a sample was felt necessary at all is evidence of
  the tension. The fix is presentation, not scope: keep the full catalog everywhere
  (a player who needs an accommodation mid-battle must not be handed a crippled
  screen), but dim rather than replace, so the live board stays visible behind the
  Accessibility section.
- **The board sample remains for non-battle contexts** — opened from the map screen or
  main menu there is no live board to evaluate against, so a representative sample is
  still the best available reference.
- **Keybinding capture state is unmistakable.** The `Listening` state must be visually
  distinct and cancellable with Esc, and Esc must not itself be capturable as a binding.
- **Conflict presentation names both sides.** "W is already bound to Move Up" — not a
  generic error. Per Accessibility V7, a silent steal is a defect.
- **No audio cue on settings changes other than the volume previews.** Per
  `audio-system.md`'s clarity-first direction, a confirmation blip per toggle is noise.

📌 **Asset Spec** — after the art bible is approved, run
`/asset-spec system:settings-and-options`.

---

## UI Requirements

> **📌 UX Flag — Settings / Options**: this system is almost entirely UI. Run
> `/ux-design` for the settings screen **before** writing stories.

**Screen structure** — four sections matching the Settings Catalog: **Audio**,
**Accessibility**, **Input**, **General**. Each section has its own reset-to-defaults
control, each binding row has its own, and there is a global reset (Rule 14). All
confirm first (Rule 6 exception).

**Cross-cutting accessibility view (required).** Five accommodations are split across
two sections by design — `ui_scale`/`reduced_motion`/`colorblind_mode` under
Accessibility, `require_confirm_click`/`keybindings` under Input, because "volume lives
under Audio, keys live under Input" matches player mental models and should not be
broken. But a player who came here *specifically* looking for accommodations should not
have to know that split. A cross-cutting view surfaces all A-tagged rows in one place
regardless of home section. This follows from `accessibility.md`'s own framing —
accessibility is a correctness requirement, not a courtesy — and the IA should say so.

**General is deliberately a one-item section** (`locale`). It is a future-proofing
bucket, not an accidental thin category.

**Modality and focus.** The settings screen is **modal**, matching
`map-run-ui.md` Rule 12's precedent for resolution screens. Tab is **trapped inside
it**; Esc closes it (except while `Listening`, where Esc cancels the capture instead —
and Esc itself is never capturable as a binding). Clicking outside does **not** close
it, so a stray click cannot discard a keybinding capture in progress.

**Entry points** (Rule 15): main menu, map screen, and in-battle pause. All three reach
the same screen; there is no reduced "in-battle settings" variant, because a player who
needs an accommodation mid-battle needs the full set.

**Required behaviours:**

- Immediate application on change — no Apply button anywhere (Rule 6).
- Keybinding rows show the current key, enter `Listening` on activation, and surface
  conflicts inline (Rule 13).
- Mid-battle: opening pauses; closing resumes with no turn, action, or undo-stack
  change (Rule 15).
- A persistent, non-blocking notice when the domain is `Unavailable` — settings work
  this session but will not persist (Rule 8).
- Full keyboard navigation and 150% scale compliance, like every other screen
  (Accessibility A3, A7) — **specified by the `tabOrder` below, not merely asserted.**

### `tabOrder(SettingsScreen, state)` — Formula F5

Added 2026-07-28 (`ux-designer` gate). `draft-loadout-ui.md` sets this project's bar
by publishing an explicit `tabOrder(screen, state)`; this document claimed A7
compliance without it, which is the exact hand-waving the design-doc rules forbid —
and it did so on the one screen carrying the accessibility **bootstrap** requirement.

```
tabOrder(SettingsScreen, state):
  switch state:
    Browsing:   SectionTab[Audio, Accessibility, Input, General]
                 ++ ControlRow[0..n-1] of the focused section, in catalog order
                 ++ (per-row Reset for each binding row, inline after its row)
                 ++ ["SectionReset", "GlobalReset", "CloseButton"]

    Listening:  TRAPPED — Tab is inert while capturing a key, so a Tab press is
                 recorded as the binding rather than moving focus. Esc cancels and
                 returns to Browsing with focus on the originating row.

    Conflict:   ["CancelButton", "SwapButton"] only — trapped until resolved (Rule 13)

    Confirm:    ["ConfirmButton", "CancelButton"] only — trapped (Rule 6 exception)
```

**Section tabs come first**, so a keyboard user reaches any section in at most four
presses rather than tabbing through every control of every preceding section.

**`Listening` traps Tab deliberately.** Tab is a legal, bindable key; if it moved focus
during capture, it could never be bound, and Accessibility A5 requires *every* binding
be reassignable.

---

## Acceptance Criteria

**Core rules**

- **GIVEN** a fresh install with no stored settings, **WHEN** the game launches,
  **THEN** every catalog key resolves to a valid value and the game is playable (Rule 4,
  F3).
- **GIVEN** any setting is changed, **WHEN** the change is made, **THEN** it takes
  effect without an Apply button and without a restart (Rule 6).
- *(Logic / **BLOCKING**)* **GIVEN** a changed setting, **WHEN**
  `settings_write_debounce_ms` elapses, **THEN** the full `SettingsState` is written to
  `vanguard.settings.v{N}` (Rule 7). **Implement with fake timers** (`vi.useFakeTimers`),
  never a real sleep — the project's Determinism rule forbids time-dependent assertions.
- **GIVEN** settings have been changed and committed, **WHEN** a run is started,
  completed, abandoned, and the Meta Save is reset, **THEN** every setting is unchanged
  (Rule 3).
- **GIVEN** the Meta Save or Run Save is corrupted, **WHEN** the game loads, **THEN**
  settings load normally and are unaffected (Rule 2).
- **GIVEN** any setting at any value, **WHEN** a seeded battle is replayed, **THEN** the
  resulting board state is byte-identical to the same replay at defaults (Rule 12).
- **GIVEN** every row of Accessibility's Required Accommodations table that has a player
  control, **WHEN** the settings screen is inspected, **THEN** each has a corresponding
  control (Rule 1).

**Formulas**

- **GIVEN** `v_sfx = 50` and `v_master = 100`, **WHEN** F1 is computed, **THEN**
  `effectiveDb(SFX) ≈ −6.02 dB`.
- **GIVEN** `v_sfx = 50` and `v_master = 50`, **WHEN** F1 is computed, **THEN**
  `effectiveDb(SFX) ≈ −12.04 dB`.
- **GIVEN** any slider at 0, **WHEN** F1 is computed, **THEN** it returns `-∞` and not a
  computed value (boundary case).
- **GIVEN** `muted = true` and every slider at 100, **WHEN** F1 is computed, **THEN**
  every bus is `-∞`.
- **GIVEN** OS `prefers-reduced-motion: reduce` and no stored value, **WHEN** F2
  resolves `reduced_motion`, **THEN** it returns `true` (Rule 5).
- **GIVEN** the state above, **WHEN** the player sets `reduced_motion = false` and
  relaunches, **THEN** F2 returns `false` — the stored value wins over the platform
  (Rule 5, F2 ordering).
- **GIVEN** a stored `uiScale = 0.5` (below the 1.0 floor), **WHEN** F2 resolves it,
  **THEN** it returns the default 1.0 **and** every other stored key still loads
  (per-key fallback).
- **GIVEN** `v_stored = 1` and `v_current = 3`, **WHEN** F4 runs, **THEN**
  `migrations[1]` and `migrations[2]` are applied in that order (Rule 2, F4).
- **GIVEN** `v_stored = 5` and `v_current = 3`, **WHEN** the domain loads, **THEN** the
  stored payload is unmodified and defaults are used for the session (Rule 10).
- **GIVEN** a payload containing an unrecognised key, **WHEN** it is loaded, migrated,
  and rewritten, **THEN** the unrecognised key is still present (Rule 11).

**Cross-system**

- *(Logic / **BLOCKING** — **static import-boundary test, not a runtime claim**)*
  **GIVEN** this system's modules, **WHEN** their import graph is inspected, **THEN**
  the only Audio System symbol imported is `setBusGain`. *(Reframed 2026-07-28,
  `qa-lead` gate: "never manipulates a bus directly" is a negative existential over all
  code paths and cannot be proven by exercising one flow. `pilots.md` already uses this
  pattern.)*
- **GIVEN** the settings screen at default values, **WHEN** Accessibility V1–V4 are run
  against it, **THEN** all four pass (bootstrap requirement).
- **GIVEN** a key already bound, **WHEN** the player assigns it to a second action,
  **THEN** the conflict is shown, both sides are named, and neither binding changes
  until the player resolves it (Rule 13).
- *(Integration / **BLOCKED — not executable today**)* **GIVEN** a battle in progress,
  **WHEN** the player opens settings, changes a value, and closes, **THEN** the turn
  number, all action slots, and the undo stack are unchanged (Rule 15).
  **This criterion cannot be run.** Rule 15 is flagged 🔴 BLOCKED — there is no
  `Paused` state in Turn & Phase Manager, the pause hook in `input-and-selection.md` is
  unimplemented, and Battle HUD has no Settings affordance. There is no code path by
  which a tester can open settings mid-battle. *(Flagged 2026-07-28, `qa-lead` gate:
  the criterion previously read as executable while the rule it tests was already
  marked blocked three sections earlier.)*

**Reset and confirm (Rule 14)** — *added 2026-07-28, `qa-lead` gate. The `ux-designer`
gate's C2 CRITICAL fix had **zero** acceptance criteria: nothing asserted the confirm
step actually blocks the destructive action.*

- *(Logic / **BLOCKING**)* **GIVEN** any reset control, **WHEN** it is activated,
  **THEN** no value changes until the confirm step is accepted.
- *(Logic / **BLOCKING**)* **GIVEN** a confirm prompt, **WHEN** it is cancelled,
  **THEN** every setting retains its pre-reset value.
- *(Logic / **BLOCKING**)* **GIVEN** a **per-binding** reset, **WHEN** confirmed,
  **THEN** exactly that binding returns to default and no other binding or section
  changes.
- *(Logic / **BLOCKING**)* **GIVEN** a **per-section** reset, **WHEN** confirmed,
  **THEN** only that section's keys change.
- *(Logic / **BLOCKING**)* **GIVEN** a **global** reset, **WHEN** confirmed, **THEN**
  every section resets **and** `PLATFORM_DEFAULTED` keys re-consult the platform, so a
  global reset behaves like a fresh install (Rule 5).

**Keybinding conflict resolution (Rule 13)** — *added 2026-07-28, `qa-lead` gate: only
the Cancel path was implicitly covered; the Swap path had no criterion at all.*

- *(Logic / **BLOCKING**)* **GIVEN** a conflict, **WHEN** the player chooses **Cancel**,
  **THEN** both bindings keep their current keys and the state returns to `Idle`.
- *(Logic / **BLOCKING**)* **GIVEN** a conflict, **WHEN** the player chooses **Swap**,
  **THEN** the new action takes the key **and** the previous holder enters an explicit
  `Unbound` warning state — never silently dropped.
- *(UI / ADVISORY)* **GIVEN** a conflict, **WHEN** it is presented, **THEN** both the
  incoming action and the current holder are named on screen.

**Tab order (Formula F5)** — *added 2026-07-28, `qa-lead` gate. F5 is a fully-specified
pure function over four states and had no criterion, despite the project rule requiring
one per formula — on the very screen carrying the accessibility bootstrap requirement.*

- *(Logic / **BLOCKING**)* **GIVEN** state `Browsing`, **WHEN** `tabOrder` is computed,
  **THEN** the four section tabs come first, before any control row.
- *(Logic / **BLOCKING**)* **GIVEN** state `Listening`, **WHEN** Tab is pressed,
  **THEN** focus does not move and Tab is recorded as the candidate binding.
- *(Logic / **BLOCKING**)* **GIVEN** state `Conflict` or `Confirm`, **WHEN** `tabOrder`
  is computed, **THEN** it contains only that state's two controls — focus is trapped.
- **GIVEN** `localStorage` throws on write, **WHEN** the player changes a setting,
  **THEN** it applies for the session and play is never blocked (Rule 8).
- **GIVEN** a corrupted settings payload, **WHEN** the game loads, **THEN** it is
  quarantined under `vanguard.settings.corrupt.{timestamp}` and defaults are used
  (Rule 9).

**Performance**

- Settings resolution (F2) is a map lookup, called on read by consuming systems. Writes
  are debounced (Rule 7) so a slider drag issues at most one write per
  `settings_write_debounce_ms`. No per-frame storage access.

---

## Open Questions

1. **Should settings sync across devices?** Out of scope — v1 is `localStorage` only,
   matching `run-persistence.md` Rule 8's "no IndexedDB, no cloud" constraint. Any sync
   story would be a new system, not a setting. *Owner:* deferred, out of v1.

2. **Does mid-battle settings access need a reduced variant?** Rule 15 says no — the
   full screen is available everywhere. If playtest shows the full screen is disruptive
   mid-battle, the alternative is a quick-access subset (volume, reduced motion) with a
   link to the full screen. Recorded so the option is known. *Owner:* playtest.

3. **Gamepad bindings.** `technical-preferences.md` sets Gamepad Support to "None (v1)",
   so `keybindings` covers keyboard only. If gamepad is added, the binding map needs a
   per-device dimension and F2's per-key fallback needs revisiting. *Owner:* deferred
   until gamepad is in scope.

4. **Should `colorblind_mode` be a palette swap or a per-verb icon change?** This
   document stores the enum; what it *does* is owned by `art-bible.md`. Per
   Accessibility Rule 2 and F4's fallback, shape redundancy is the correctness
   guarantee and the mode is comfort — which suggests palette swap. Unconfirmed.
   *Owner:* `art-director`.

5. **Per-section reset granularity.** Rule 14 defines four sections. Whether
   `keybindings` should be resettable per-binding rather than only per-section is
   unresolved — a player who mis-binds one key currently has to reset all of Input.
   *Owner:* resolve with `/ux-design`.

---

## Review Status

> **Design Review**: **run 2026-07-28** by the user in an independent terminal
> session — **but no verdict, findings, or document changes were recorded.** The
> working tree was unchanged afterward. **Treat this document as unverified**; re-run
> `/design-review design/gdd/settings-and-options.md` in a fresh session and capture
> the verdict here. For contrast, `pilots.md`'s review returned MAJOR REVISION NEEDED
> and wrote its fixes into the document — a silent run is not evidence of quality.
>
> **Note:** `/architecture-review` (2026-07-28) separately found that this document's
> third-persistence-domain decision contradicted ADR-0003's stated "two domains".
> ADR-0003 was amended rather than this document changed — the decision here was
> sound, the ADR's arity was a miscount.
>
> **`ux-designer` gate: ✅ RUN 2026-07-28.** Returned 2 CRITICAL, 5 HIGH, 4 MEDIUM,
> 2 LOW findings. **All applied.** The two criticals were:
> **(C1)** Rule 15's mid-battle entry point depends on infrastructure that does not
> exist — Turn & Phase Manager has no `Paused` state, `input-and-selection.md` calls its
> pause hook "a reserved hook, not implemented", and Battle HUD has no Settings
> affordance at all — so **mouse-only players, this game's primary input, had no path
> into settings mid-battle.** Rule 15 now states this as a blocked requirement on three
> upstream systems rather than as settled behaviour.
> **(C2)** Reset was destructive, irreversible, and — under Rule 6's "no Apply button
> anywhere" — apparently unconfirmed, so one misclick could permanently destroy a
> keybinding layout a motor-accessibility player had built. Rule 6 now carves out
> destructive bulk actions.
> Also applied: conflict-resolution options specified (**H3**), `tabOrder` Formula F5
> added (**H2**), section renamed to Accessibility with a cross-cutting view (**H4**),
> translucent rather than opaque overlay so accommodations evaluate against the real
> board (**H5**), per-binding reset (Open Question #5 resolved), `ui_scale` layout-thrash
> mitigation (**M1**), modality/focus-trap stated (**M2**), audio preview throttled
> (**M3**).
>
> **`qa-lead` gate: ✅ RUN 2026-07-28.** Found that the two most recent CRITICAL fixes
> had **no acceptance criteria at all** — Rule 14 (reset + mandatory confirm) and
> Formula F5 (`tabOrder`) — so the C2 fix was untested and F5 violated the project's
> one-criterion-per-formula rule on the very screen carrying the accessibility
> bootstrap requirement. Also: the mid-battle AC read as executable while Rule 15 was
> already flagged BLOCKED; Rule 13's **Swap** path was uncovered; two negative-existential
> claims reframed as static import-boundary tests; the debounce AC flagged for fake
> timers. **All applied**, with story-type/gate tags added.
>
> **Still not consulted:** `systems-designer` (Formulas), `accessibility-specialist`
> (the bootstrap requirement).
