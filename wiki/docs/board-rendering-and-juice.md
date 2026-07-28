# Board Rendering & Juice

> **Status**: In Design
> **Author**: workflow (design-system fan-out)
> **Last Updated**: 2026-07-27
> **Implements Pillar**: #5 Read in Ten Seconds; #1 Perfect Information, Perfect Blame; #4 Every Hero Is a Verb

## Overview

Board Rendering & Juice is the **pure view layer** of a VANGUARD battle: a
PixiJS (2D WebGL) scene graph that reads the current state of Board & Grid
(terrain, hazards, occupancy, flags) and the event log emitted by Combat
Resolution's `resolve()` calls, and turns both into pixels — the tile grid,
unit sprites, hazard overlays, enemy telegraph icons, and short, legible
animated feedback ("juice": knockback tweens, hit-flashes, tile-reaction
pulses, death animations). It owns exactly one piece of authoritative state
that other systems depend on: the **pixel geometry contract** (tile size,
board screen-origin, camera) that Input & Selection's `screenToTile` /
`tileToScreen` formulas require to agree with what the player sees. Beyond
that contract, this system is strictly read-only with respect to gameplay —
it never mutates Board, Combat, or Turn state, and nothing it does is ever
consulted by game logic. It exists because VANGUARD's entire value
proposition (Pillar #1: perfect information; Pillar #5: read in ten seconds)
is only real if the player can **see** it: a deterministic, fully-telegraphed
battle that isn't legibly rendered is not actually fair or readable, no
matter how correct the underlying simulation is.

## Player Fantasy

Board Rendering & Juice has no direct player fantasy of its own — like Board
& Grid, Combat Resolution, and Turn & Phase Manager, it is infrastructure.
What the player *feels* when it works is **"I can read this board at a
glance, and everything I predicted actually happened, with a satisfying
crunch."** This is where the game's declared aesthetics become tangible:
**Sensation** (the crisp, legible "juice" on every move — knockback,
tile-reactions, hit-flashes) is this system's primary deliverable, and it is
the direct mechanical proof of Pillar #1 (the resolved outcome must render
*exactly* what the telegraph and preview promised) and Pillar #5 (silhouettes,
icon-driven telegraphs, and a neutral board that makes hazards and threats pop
at a glance). It also makes Pillar #4 ("Every Hero Is a Verb") *felt*, not
just designed: a shove reads as a shove — a satisfying, legible displacement
— because the verb-family color language and knockback tween sell the verb's
identity every time it fires. The failure state of this system is **any
visual that doesn't match the logical outcome** (a unit renders somewhere
Board doesn't report it, or a telegraph shows something that doesn't happen)
— that single failure would break the trust every other pillar depends on. A
secondary failure state is **spectacle that obscures clarity**: screen shake,
particle clutter, or slow animation that makes the board harder to read is a
regression, not an improvement, for this game specifically.

## Detailed Design

### Core Rules

1. **Ownership & scope.** This system owns exactly: the tile grid's visual
   representation, unit sprites, hazard overlays, enemy telegraph overlays,
   Move Preview's "ghost" overlay, and all juice/animation feedback driven by
   Combat Resolution's event log. It does **not** own HUD elements (health
   bars, action bars, damage numbers — Battle HUD's job), audio playback
   (Audio System's job — this system only exposes event timing), or any
   gameplay decision (targeting legality, damage amounts, AI). The target
   rendering technology is PixiJS (2D WebGL) per the project's technical
   preferences; this document specifies the rendering **contract** (what must
   be shown, when, and how it maps to logical state) rather than PixiJS API
   usage.
2. **Render layer stack (fixed z-order, back to front).** The scene graph is
   organized into ordered layers; a sprite's layer is fixed by its category,
   never by insertion order alone:

   | Order | Layer | Contents | Reads from |
   |---|---|---|---|
   | 1 (back) | Board background | Neutral low-saturation base fill for the whole viewport (letterbox bars included) | Static — art direction constant |
   | 2 | Terrain | Per-tile terrain sprite (Normal / Blocked / Chasm / Water) | Board & Grid: `getTile(...).terrain` |
   | 3 | Grid lines | Subtle tile-boundary overlay | Static geometry (Formula F1) |
   | 4 | Hazard | Per-tile hazard icon/overlay (e.g. Fire) | Board & Grid: `getHazard(tile)` |
   | 5 | Telegraph | Enemy/environment intent icons for the *next* resolution | Enemy, Abilities & Telegraph: `intents_telegraphed` payload |
   | 6 | Selection & targeting highlights | Hover tile, selected-unit marker, valid/invalid target styling, keyboard-cursor reticle | Input & Selection: written state (Core Rule 4 in that GDD) |
   | 7 | Units | Hero/enemy sprites, one per occupied tile | Board & Grid: occupancy, unit id → sprite mapping |
   | 8 | Juice / VFX | Hit-flashes, impact flashes, tile-reaction pulses, death animations, terrain-destroy debris | Combat Resolution: event log (Core Rule 9) |
   | 9 (front) | Preview / ghost overlay | Predicted end-position ghost sprite, predicted path trace | Move Preview: `PreviewResult` |

   Layers 6 and 9 are the only layers **not** driven purely by Board/Combat
   state — they render transient input/preview state supplied by Input &
   Selection and Move Preview respectively, and are cleared the instant that
   state clears upstream.
3. **Camera & viewport (v1: fixed, no pan/zoom).** The entire board (default
   8×8, or whatever `grid_width` × `grid_height` the encounter specifies) is
   always fully visible, centered, and letterboxed to fit the canvas — this
   matches Input & Selection's Open Question #4 assumption and Pillar #5 (the
   whole board must be readable in one glance, not scrolled through).
   Panning/zoom are explicitly out of v1 scope (Open Questions).
4. **This system owns the pixel-geometry contract Input & Selection
   consumes.** `tileSize`, `originX`, and `originY` (Formula F1) are computed
   here, from the current canvas/viewport size and the board's `grid_width` /
   `grid_height`, and must be the **exact same values** Input & Selection's
   `screenToTile` / `tileToScreen` formulas use — this is the shared
   coordinate-transform contract flagged as an architecture decision in both
   this document and `input-and-selection.md`'s Open Questions. Whenever the
   canvas resizes, this system recomputes F1 and republishes the new values;
   Input & Selection must recompute against the same trigger.
5. **Tile rendering is terrain-driven and palette-constrained.** Each tile's
   sprite is selected by its `terrain` field (Normal / Blocked / Chasm /
   Water, per `board-and-grid.md`). Normal-terrain tiles use a low-saturation
   texture bounded by the `neutral_tile_saturation_cap` knob, so that hazard
   and telegraph overlays (which use full-saturation accent colors) visually
   dominate — this is the mechanical implementation of the Visual Identity
   Anchor's "neutral board so hazards pop" principle.
6. **Unit rendering always mirrors Board occupancy, except mid-tween.** Every
   hero and enemy renders as exactly one silhouette-first sprite, centered in
   its occupied tile (Board & Grid Core Rule 5: unit size = 1 tile in v1).
   Outside of an active knockback/swap tween (Core Rule 9), a unit's rendered
   screen position is **always** derived from Board's current `getOccupant`
   result for that tile — this system never speculatively renders a unit
   somewhere Board doesn't (yet) report it. During a tween, the sprite
   interpolates between its pre-effect and post-effect tile positions, both
   of which are already-decided, final Board states (Core Rule 12).
7. **Hazard rendering is polled, not purely event-driven.** A tile's hazard
   overlay is drawn from Board & Grid's current `getHazard(tile)` state on
   every `Static`-state frame, not only in reaction to a `HazardApplied`
   event. This matters for **permanent** hazards (`duration = null`, per
   `combat-resolution.md` Formula F4) — their overlay must persist correctly
   even many turns after the `HazardSpawned` event fired, with no re-trigger
   required. Hazard overlays include a subtle idle-loop (e.g. a gentle flame
   flicker) so a persistent hazard reads as "active," not as a static
   decoration.
8. **Telegraph rendering must match the resolved outcome exactly.** Telegraph
   icons (from Enemy, Abilities & Telegraph's `intents_telegraphed` event) are
   rendered as icon-driven overlays on every tile the intent will affect,
   using directional variants (e.g. a rotated arrow for a push direction) and
   the acting enemy's verb-family accent color (Core Rule 11). This is a
   **binding constraint, not a style choice**: because Pillar #1 promises the
   player that the telegraph *is* the truth, this system must render the
   telegraph from the same data Enemy Resolve will later execute against —
   never an approximation or a simplified icon that could misrepresent the
   coming effect's shape or magnitude.
9. **Juice playback drains Combat Resolution's event log, one primitive event
   at a time, in log order.** Each event type maps to exactly one defined
   visual reaction (Formulas F2–F5); the mapping is fixed, not
   ability-specific — a `DisplacementComplete` event (`stepsMoved > 0`)
   always plays a knockback tween, and a `CollisionResolved` event always
   plays the impact flash (Formulas F2–F3), regardless of which hero or
   enemy caused it, keeping the vocabulary of *what a push looks like*
   consistent across the whole roster (supporting Pillar #4's promise that a
   verb reads the same way every time it appears).
   Playback is **sequential by default** (`parallel_juice_enabled = false`,
   Tuning Knobs) to guarantee the animated order always matches Combat
   Resolution's strict sequential resolution order (`combat-resolution.md`
   Rule 2) — this preserves "perfect blame": the player must be able to see
   *which* effect caused *which* consequence, in the order it actually
   happened.
10. **Preview/ghost overlay rendering is non-committal and never plays
    juice.** When Input & Selection is in `Targeting` and forwards a hover to
    Move Preview, this system draws the returned `PreviewResult` as a static
    ghost: a semi-transparent duplicate sprite at the predicted end tile, a
    dotted path trace for the predicted route, and outcome icons (predicted
    damage, predicted push distance) — with **zero animation and zero
    modification to the live Board render**. The ghost overlay is drawn
    entirely in layer 9 and is cleared the instant the hover moves, the
    target is committed, or `Targeting` is exited (Input & Selection Core
    Rule 6).
11. **Rendering never blocks game logic; it gates player input instead.**
    Turn & Phase Manager and Combat Resolution both complete their work the
    instant `resolve()` returns — they do not wait for this system's
    animations to finish. Instead, this system exposes an `isAnimating()`
    flag (true for the full duration of the `Playing` state, Formula F4) that
    Input & Selection's `Locked` state contract (`input-and-selection.md`
    States and Transitions) subscribes to; input remains locked until
    animation playback completes, so the player is never asked to act on
    (or shown as already resolved) a board state they have not yet visually
    confirmed. This is the mechanism that keeps Pillar #1 true at the
    *rendering* layer, not just the logic layer.
12. **Juice timing is the one place in VANGUARD allowed to be
    frame-rate/wall-clock dependent — and this is explicitly not a
    determinism violation.** Every tween's final state is already the
    deterministic outcome Combat Resolution computed before any animation
    began (Core Rule 6); real-time easing only affects *how the player
    perceives* an already-decided outcome over time, never the outcome
    itself. This is distinct from Pillar #3 ("no RNG in battle"): juice
    introduces wall-clock time-dependence, not randomness, and it never
    feeds back into simulation state, save data, or the event log Combat
    Resolution already emitted.

### States and Transitions

**Primary render state** (mutually exclusive): `Static ↔ Playing`.

| State | Entry Trigger | What the renderer does | Exit Transitions |
|---|---|---|---|
| **Static** | Battle load; OR the previous `Playing` batch's queue is fully drained | Mirrors Board & Grid's current state exactly, frame to frame (layers 1–7 redrawn only on state change / dirty-flag, not every frame); polls hazard overlays each frame (Core Rule 7); `isAnimating() == false` | A new event batch arrives from a `resolve()` call → **Playing**. |
| **Playing** | A non-empty event list arrives from Combat Resolution (via Turn & Phase Manager's dispatch of Player Phase / Environment / Enemy Resolve / Spawn) | Drains the event queue in strict log order (Core Rule 9); each event drives exactly one juice reaction (Formulas F2–F5); `isAnimating() == true`; layer 9 (preview) is force-cleared and preview requests are ignored for the duration (Edge Cases) | Every queued event's tween reaches progress `1.0` → assert render position matches Board's authoritative state for every affected unit/tile, then → **Static**. |

**Secondary, orthogonal overlay flag** (only meaningful while primary state
is `Static`): `PreviewOverlay: off ↔ on`.

| State | Entry Trigger | What the renderer does | Exit Transitions |
|---|---|---|---|
| **off** | Default; also forced whenever primary state is `Playing` | Layer 9 empty | Input & Selection enters `Targeting` and a hover produces a `PreviewResult` → **on**. |
| **on** | A `PreviewResult` is received while primary state is `Static` | Layer 9 renders the ghost/path/outcome icons for the current hover target (Core Rule 10) | Hover changes to a different tile (re-enter **on** with new data) → **on**; hover ends, target commits, or `Targeting` exits → **off**. |

### Interactions with Other Systems

Board Rendering & Juice is a **consumer and a geometry provider**: it reads
game state from everyone below and writes back only pixel-geometry facts and
transient input-echo state.

| System | Rendering reads from this system | Rendering writes to this system | Ownership boundary |
|---|---|---|---|
| **Board & Grid** ✅ | full tile grid: terrain, hazard, occupancy, flags (already listed as a **Hard** dependent in `board-and-grid.md`'s Dependencies table) | — | Board owns the truth; Rendering only visualizes it, never mutates it |
| **Combat Resolution** ✅ | the full event log from every `resolve()` call (already listed as a **Hard** dependent in `combat-resolution.md`'s Dependencies table: "Reads the full event log to drive knockback/hit/hazard VFX") | — | Combat owns *what happened*; Rendering owns *how it looks* |
| **Turn & Phase Manager** ✅ | current phase (to know when a batch of events belongs to Player/Environment/Enemy Resolve/Spawn, for debug/labeling only — not a gating dependency, since Rendering reacts to events, not phases directly) | — | **Soft** — Rendering does not need phase awareness to function, only the event stream; phase is contextual metadata |
| **Input & Selection** | hover tile, selected unit, targeting highlight set, keyboard-cursor position (writes *into* Rendering per `input-and-selection.md`'s own Dependencies table) | `tileSize`, `originX`, `originY`, camera state (Formula F1) — the exact values Input & Selection's `screenToTile`/`tileToScreen` must also use; `isAnimating()` flag consumed by Input & Selection's `Locked` state | **Hard, bidirectional** — flagged as a shared coordinate-transform architecture decision in both this document and `input-and-selection.md`'s Open Questions |
| **Move Preview** ✅ | `PreviewResult` (predicted path, end tile, outcome deltas) on each hover request forwarded by Input & Selection | — | **Hard**. Rendering never recomputes an outcome itself — it only draws what Move Preview reports (Core Rule 10), so the previewed and committed visuals can never diverge |
| **Enemy, Abilities & Telegraph** ✅ | `intents_telegraphed` payload (per-tile intent shape, direction, verb-family) for telegraph overlay rendering | — | **Hard**. Rendering must not simplify or approximate telegraph data (Core Rule 8) |
| **Heroes & Abilities** ✅ | verb-family → accent-color registration (which palette slot each hero verb uses) | — | **Soft**. Rendering only reserves palette slots (Tuning Knobs); color-to-verb assignment is content, not rendering logic |
| **Battle HUD** | — | (indirect, via shared canvas) layer ordering coordination so HUD chrome renders above the board's layer 9 | **Soft** — not listed as a dependency edge in `systems-index.md`'s current Dependency Map for Battle HUD, but the two systems necessarily share a canvas/viewport; flagged for `/consistency-check` to confirm or add the edge |
| **Audio System** | — | (indirect) timestamped juice event markers (impact, knockback start/end, death start) Audio System *may* subscribe to for sync | **Soft**, Vertical-Slice tier. Audio System's actual dependency is on Combat Resolution's events directly (already declared in `combat-resolution.md`), not on Rendering — this avoids a needless render→audio coupling; Rendering merely exposes the same timing if Audio wants tighter sync |
| **Accessibility** *(Alpha tier)* | — | colorblind-safe rendering guarantees (shape/icon-not-color-alone), flash-frequency limits (Tuning Knobs, Visual/Audio Requirements) | **Soft**, future — `systems-index.md` already lists Accessibility as depending on Board Rendering & Juice |

> **Status:** Move Preview, Enemy, Abilities & Telegraph, Heroes & Abilities,
> Battle HUD, and Audio System are now Designed. Verified against their
> published GDDs: `move-preview.md` and `enemy-abilities-and-telegraph.md`
> each list Board Rendering & Juice as a **Hard** downstream dependent with
> an interface matching the rows above — no conflict. `heroes-and-abilities.md`
> lists Board Rendering & Juice as a **Hard** downstream dependent ("Hero
> silhouette/class for rendering selection, legal-tile highlight sets"),
> broader than and rated higher than this document's **Soft**,
> accent-color-only row above — flagged as an open item (see Dependencies
> section below) rather than resolved here. `battle-hud.md` independently
> confirms the Battle HUD ↔ Board Rendering & Juice edge is missing from
> `systems-index.md`'s Dependency Map (see Dependencies section).

## Formulas

All formulas are deterministic, pure functions of viewport/board dimensions
and event data — the *outcomes* they compute are exact; only the real-time
easing that plays them back over wall-clock time is non-deterministic
(Core Rule 12). Examples use the default **8×8** board (registry constants
`grid_width`, `grid_height`) unless stated.

### F1. Board Viewport Fit (tileSize / origin)

```
tileSize = floor( min(viewportWidth / grid_width, viewportHeight / grid_height) )
originX  = (viewportWidth  − tileSize × grid_width)  / 2
originY  = (viewportHeight − tileSize × grid_height) / 2
```

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| viewport width | `viewportWidth` | float | >0, canvas px | Current canvas width |
| viewport height | `viewportHeight` | float | >0, canvas px | Current canvas height |
| board width | `grid_width` | int | ≥1 (registry, default 8) | From Board & Grid |
| board height | `grid_height` | int | ≥1 (registry, default 8) | From Board & Grid |
| tile size | `tileSize` | int | ≥`min_tile_size_px`, ≤`max_tile_size_px` (clamped, Tuning Knobs) | Uniform square tile edge, floored to avoid subpixel seams between tiles |
| origin X/Y | `originX`, `originY` | float | ≥0, canvas px | Top-left of the board, centered (letterbox) |

**Output range:** `tileSize ∈ [min_tile_size_px, max_tile_size_px]`;
`originX, originY ≥ 0`. **Example:** `viewportWidth=960, viewportHeight=720`,
default 8×8 → `tileSize = floor(min(120, 90)) = 90`; `originX = (960 − 720)/2
= 120`; `originY = (720 − 720)/2 = 0`. This is the exact `(tileSize=90,
origin=(120,0))` triple Input & Selection's Formula 1/2 must also use.

### F2. Knockback Tween Duration

`knockbackDurationMs(stepsMoved) = step_duration_ms × max(1, stepsMoved)` —
used only when `stepsMoved ≥ 1` (Combat Resolution's F2 output); if
`stepsMoved == 0` (an immediate collision with no displacement), no
positional tween is created at all (Edge Cases) — only the fixed
`flash_duration_ms` impact flash (F3) plays.

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| tiles actually moved | `stepsMoved` | int | `[0, distance]`, from `combat-resolution.md` Formula F2 | Drives how many tile-widths the sprite must traverse |
| per-step duration | `step_duration_ms` | int | 60–250 ms (Tuning Knobs) | Time to slide across one tile |
| tween duration | `knockbackDurationMs` | int (output) | `[step_duration_ms, step_duration_ms × 14]` | 14 = board diameter bound (`W+H−2` on 8×8, per `manhattan_distance`'s registered output range) |

**Output range:** `[step_duration_ms, step_duration_ms × 14]` ms on the
default board. **Example:** `stepsMoved=2, step_duration_ms=120` →
`knockbackDurationMs = 240`.

### F3. Impact / Hit / Hazard-Tick Flash Duration

`flashDurationMs = flash_duration_ms` (fixed per event type; not a function
of magnitude — a 1-damage hit and a lethal hit flash for the same duration,
since flash length communicates *that something happened*, not *how much*;
magnitude is Battle HUD's job via damage numbers).

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| flash duration | `flash_duration_ms` | int | 60–200 ms (Tuning Knobs) | Applies to `CollisionResolved` impact flashes, `DamageApplied` hit-flashes, and `HazardApplied` tile-reaction pulses alike |

**Output:** constant `flash_duration_ms` per triggering event. **Example:**
default `120 ms` — a unit hit by `applyHazard` flashes for exactly 120 ms
regardless of the `fire_damage_per_tick` value applied.

### F4. Total Event-Chain Playback Time

`totalPlaybackMs(events) = ( Σ durationFor(event) ) / animation_speed_multiplier`
in sequential mode (`parallel_juice_enabled = false`, the v1 default); in
parallel mode, non-conflicting events (disjoint unit IDs and disjoint tiles)
overlap and `totalPlaybackMs` is the length of the longest concurrent chain
instead of the sum (Open Questions — not enabled by default).

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| event list | `events` | list | 0..N (one `resolve()` call's log) | The full event log for one action/tick |
| duration for one event | `durationFor(event)` | int (ms) | F2 or F3's output depending on event type | Per-event playback time |
| speed multiplier | `animation_speed_multiplier` | float | 0.5–3.0 (Tuning Knobs) | Global pacing control |
| total playback time | `totalPlaybackMs` | int (output) | `≥0` | `isAnimating()` stays `true` for this whole duration |

**Output range:** `[0, ∞)`, practically bounded by a single action's effect
chain length (`combat-resolution.md`'s perf budget: ~1–10 primitives per
action). **Example:** a push (`stepsMoved=2`, `step_duration_ms=120` → 240 ms)
followed by a hazard-on-entry flash (`flash_duration_ms=120`), sequential,
`animation_speed_multiplier=1.0` → `totalPlaybackMs = (240 + 120) / 1.0 = 360
ms`. At `animation_speed_multiplier=2.0`, the same chain plays in `180 ms`.

### F5. Death Animation Selection

`deathAnimationFor(cause)` is a fixed lookup, not a continuous function —
included as a formula because it is a cross-system-relevant mapping other
systems (QA, Accessibility) may need to reference:

| `cause` (from `combat-resolution.md`'s `removeUnit`) | Rendered animation | Duration |
|---|---|---|
| `Defeated` | Fade + dissolve/shatter | `death_animation_duration_ms` |
| `Fell` | Scale-down "drop" into the lethal tile, swallowed by the terrain sprite | `death_animation_duration_ms` |
| `Recalled` *(reserved, unimplemented — `combat-resolution.md` Open Question #8)* | Reserved animation slot, not yet authored | — |

**Output:** one of a fixed enum of animation IDs, never the same visual for
`Defeated` and `Fell` (Edge Cases) — this lets a player infer *why* a unit
was removed without reading a combat log, supporting Pillar #5.

## Edge Cases

- **`push`/`pull` resolves with `stepsMoved = 0` (immediate collision, no
  displacement):** no knockback tween is created; only the fixed
  `flash_duration_ms` impact flash plays on the stationary unit(s). The unit
  sprite never leaves its tile (Formula F2).
- **Two sequential `applyHazard` calls in one Environment tick both reduce a
  unit to 0 HP (per `combat-resolution.md`'s edge case):** the two death
  animations play strictly in the order Combat Resolution's event log lists
  them (Core Rule 9) — never simultaneously — so a player can attribute each
  death to its specific cause/order.
- **A unit is removed with cause `Fell` vs `Defeated`:** rendered with
  distinct animations per Formula F5; never the same visual treatment.
- **Rendering falls behind due to frame drops (long chain, low-end device):**
  every tween interpolates progress as `elapsedRealMs / durationMs` (delta-time
  based, not frame-count based), so a dropped frame causes a visible "jump"
  in interpolation rather than a permanent desync — the tween always reaches
  its correct final state at or before its nominal duration elapses, and
  `isAnimating()` still resolves to `false` at the correct real time.
- **The browser tab loses focus / requestAnimationFrame is throttled
  mid-`Playing`:** on refocus, elapsed real time (via `performance.now()`
  deltas) may show a tween already past progress `1.0` — it snaps
  immediately to its final state with no gameplay consequence, since Board
  state was already finalized by Combat Resolution before playback began
  (Core Rule 11).
- **A preview is requested (via Input & Selection → Move Preview) while the
  renderer is in `Playing`:** ignored. Per Input & Selection's `Locked` state
  contract, no preview requests are issued while `isAnimating()` is true; if
  this contract is ever violated by a caller, the request is dropped and a
  developer-only warning is logged — this is a defensive no-op, not a
  graceful fallback render.
- **Move Preview reports zero steps moved (a previewed push would
  immediately collide):** the ghost sprite renders at the **original** tile
  with an impact-icon overlay, not at a displaced tile — the preview must
  show the same "it doesn't actually move" outcome the real resolution would
  produce (Core Rule 10).
- **`grid_width`/`grid_height` set to a non-default value (per
  `board-and-grid.md`'s 5–12 safe range):** Formula F1 computes correctly for
  any `W × H` with no hardcoded assumption of 8×8 anywhere in this system's
  formulas or layer logic.
- **A hazard has `duration = null` (permanent) and is never cleared for the
  rest of the battle:** its overlay renders continuously with an idle-loop
  animation every `Static` frame (Core Rule 7), without requiring a fresh
  `HazardApplied` event to remain visible.
- **Two independent VFX (e.g. a hazard-tick pulse and a collision flash)
  target the same tile within the same short window under
  `parallel_juice_enabled = true`:** both flashes render as separate,
  additively-layered short-lived sprites — no deduplication — since both
  events are individually true and each lasts under `flash_duration_ms × 2`
  at most.
- **A unit is rendered mid-tween along a path that visually crosses another
  unit's independent in-flight tween (different source/destination tiles,
  same frame):** this is cosmetically permitted and not treated as a bug —
  Board & Grid's one-occupant invariant only guarantees no two units share a
  **final** tile; a momentary visual crossing between two legally
  non-conflicting paths is acceptable.
- **Terrain destruction (`Blocked(destructible) → Normal`, per
  `board-and-grid.md`):** rendered as a brief debris-puff VFX plus an
  immediate sprite swap from wall-texture to rubble/normal-texture, driven by
  the `TerrainSet` event Combat Resolution emits when `setTerrain(tile,
  Normal)` resolves — `setTerrain` is one of the 10 canonical combat
  primitives (`design/architecture/cross-system-contracts.md` §1) and
  already covers both directions (`setTerrain(tile, Blocked)` builds a wall;
  `setTerrain(tile, Normal)` tears one down), so no separate "destroy
  terrain" primitive or event is needed. This system reacts to `TerrainSet`
  the same way it reacts to any other juice-triggering event (Core Rule 9),
  not to a polled Board diff.
- **An ability's effect chain is empty (`effects = []`, per
  `combat-resolution.md`'s edge case):** the renderer receives an empty event
  batch; it never enters `Playing` for a zero-length batch (transitions
  `Static → Static`, no-op).
- **More verb-families exist than the reserved accent-color palette has
  slots (`verb_family_palette_size`, Tuning Knobs):** this system does not
  auto-generate a new color — it is a hard content constraint flagged for
  art-director / Heroes & Abilities to either expand the palette (with an art
  bible update) or introduce a secondary differentiator (a distinct icon
  shape) for the overflow verb-family. Rendering never silently reuses a
  color across two verb-families.
- **A unit's sprite would render smaller than is legible (extreme board size
  at `grid_width`/`grid_height` = 12, large viewport aspect mismatch):**
  `tileSize` is clamped to `min_tile_size_px` (Tuning Knobs) as a hard floor;
  if the clamped `tileSize × grid_width/height` would exceed the viewport,
  the board is displayed cropped-to-fit rather than shrunk below the
  legibility floor — **PROVISIONAL**, since v1 assumes no in-battle scrolling
  (Open Questions); this combination is flagged as a design risk, not solved
  here.

## Dependencies

**Upstream (Board Rendering & Juice depends on):**

| System | Interface | Hard / Soft |
|---|---|---|
| **Board & Grid** ✅ | full tile grid read: `terrain`, `getHazard`, occupancy/`getOccupant`, flags | **Hard** |
| **Combat Resolution** ✅ | full event log per `resolve()` call — canonical event names (`design/architecture/cross-system-contracts.md` §1): `DamageApplied`, `DisplacementComplete`, `CollisionResolved`, `SwapComplete`, `HazardSpawned`, `HazardApplied`, `UnitRemoved`, `TerrainSet`, `UnitSpawned` | **Hard** |
| **Turn & Phase Manager** ✅ | current phase (contextual/debug only, not a functional gate) | **Soft** |
| **Input & Selection** ✅ | hover tile, selected unit, targeting highlight set, keyboard-cursor position | **Hard, bidirectional** |
| **Move Preview** ✅ | `PreviewResult` per hover request | **Hard** |
| **Enemy, Abilities & Telegraph** ✅ | `intents_telegraphed` payload | **Hard** |
| **Heroes & Abilities** ✅ | verb-family → accent-color palette-slot registration | **Soft** — see bidirectional-consistency note below (asymmetry with `heroes-and-abilities.md`'s **Hard** rating, flagged not resolved) |

**Downstream (systems that depend on Board Rendering & Juice):**

| Dependent System | Interface (what it uses) | Hard / Soft |
|---|---|---|
| **Input & Selection** | `tileSize`, `originX`, `originY`, camera state (Formula F1); `isAnimating()` flag for the `Locked` state | **Hard** — already listed as a bidirectional dependency in `input-and-selection.md`'s Dependencies table |
| **Battle HUD** | shared canvas/layer-ordering coordination | **Soft** — not currently listed as an edge in `systems-index.md`'s Dependency Map; flagged for `/consistency-check` |
| **Audio System** | (optional) timestamped juice event markers for tighter sync | **Soft**, Vertical Slice tier |
| **Accessibility** *(Alpha tier)* | colorblind-safe rendering, flash-frequency limits | **Soft**, future — already listed in `systems-index.md` |

**Bidirectional-consistency note:** `board-and-grid.md` already lists Board
Rendering & Juice as a **Hard** dependent ("full tile grid: terrain, hazard,
occupancy, flags") and `combat-resolution.md` already lists it as a **Hard**
dependent ("Reads the full event log to drive knockback/hit/hazard VFX") —
both consistent with the Upstream rows above. `input-and-selection.md`
already lists Board Rendering & Juice as a **Hard, bidirectional** dependency
providing `tileSize`/origin/camera and receiving hover/selection/targeting
state — consistent with both tables above. `move-preview.md` and
`enemy-abilities-and-telegraph.md` are now Designed and each already lists
Board Rendering & Juice as a **Hard** downstream dependent matching the
Upstream rows above — verified, no conflict. `audio-system.md` is now
Designed and correctly treats Board Rendering & Juice as a **peer**, not a
dependency — consistent with the Downstream row's **Soft, Vertical Slice
tier** framing here. `battle-hud.md` is now Designed and independently
confirms (its own Rule 13) that the Battle HUD ↔ Board Rendering & Juice edge
is missing from `systems-index.md`'s Dependency Map — both documents agree;
only `systems-index.md` needs updating to add the **Soft, bidirectional**
edge. **Open item, not resolved here:** `heroes-and-abilities.md` rates the
Board Rendering & Juice relationship **Hard** ("Hero silhouette/class for
rendering selection, legal-tile highlight sets") — broader in scope and
higher-severity than this document's **Soft**, accent-color-registration-only
Upstream row. Flagged for `/consistency-check` to reconcile (either widen this
document's interface description to cover unit-identity/sprite-selection data,
or confirm the asymmetry is intentional per the "each side rates from its own
risk perspective" convention `move-preview.md` establishes).

## Tuning Knobs

| Knob | Default | Safe Range | Category | Too Low | Too High |
|---|---|---|---|---|---|
| `min_tile_size_px` | 32 px | 16–48 px | Feel | Sprites/icons become unreadable, silhouettes lose distinctness — breaks Pillar #5 | Forces cropping/scrolling on large `grid_width`/`grid_height` values (interacts with `board-and-grid.md`'s size knobs) since v1 has no camera panning |
| `max_tile_size_px` | 128 px | 64–256 px | Feel | Wastes available screen space on wide displays/small boards, juice reads as small/unsatisfying | Source art may pixelate/blur if authored below this resolution; also increases per-frame fill-rate cost |
| `step_duration_ms` | 120 ms | 60–250 ms | Feel | Knockback reads as a teleport/glitch — undermines Sensation and Pillar #1's "I can see what happened" | Turns feel sluggish, especially with several enemy actions per Enemy Resolve phase — erodes the 5–15 min battle pacing target |
| `flash_duration_ms` | 120 ms | 60–200 ms | Feel | Imperceptible — player can't tell what was hit | Adjacent events' flashes visually bleed together, muddying which event caused which reaction (breaks Pillar #5) |
| `animation_speed_multiplier` | 1.0 | 0.5–3.0 | Feel / Gate | `<0.5` makes even short chains feel slow, hurting session pacing | `>3.0` makes sequential juice blur into an unreadable instant state-swap, defeating juice's purpose as legible feedback |
| `parallel_juice_enabled` | `false` | bool | Gate | — | Enabling risks two events that Combat Resolution resolved in a specific order reading as simultaneous, misleading the player about causality (Pillar #1's "perfect blame"); default `false` until playtesting confirms parallel readability |
| `grid_line_opacity` | 0.15 | 0.0–0.4 | Feel | `0` makes tile boundaries ambiguous, especially at terrain-type edges — breaks "read at a glance" | `>0.4` adds visual noise competing with hazard/telegraph icons for attention, against the "neutral board" principle |
| `neutral_tile_saturation_cap` | 15% | 0–30% | Curve | Near 0 (pure greyscale) can look flat/lifeless, hurting Sensation | Above the cap, hazards/telegraphs stop visually dominating — the "Legible Battlefield" identity fails |
| `telegraph_icon_min_px` | 24 px | 16–40 px | Gate / Feel | Fails the "name every threat within 10 seconds" Visual Identity test at small `tileSize` | Crowds/overlaps adjacent tile icons on smaller tiles or dense telegraph clusters |
| `death_animation_duration_ms` | 400 ms | 200–800 ms | Feel | Defeats feel abrupt, undercutting the "aha" payoff | Delays the next telegraph reveal, hurting pacing in multi-kill turns |
| `verb_family_palette_size` | 8 slots | 4–16 slots | Gate | Fewer slots than the roster's verb-family count forces color reuse, breaking "one accent color per verb-family" | More slots than are ever used is harmless but risks colors becoming too close to distinguish at a glance — pair with icon-shape differentiation past ~8 |

**Interactions between knobs:**
- `min_tile_size_px`/`max_tile_size_px` interact directly with
  `board-and-grid.md`'s `grid_width`/`grid_height` knobs: a larger board
  (toward the 12×12 safe-range ceiling) pushes the computed `tileSize`
  (Formula F1) toward the floor faster on a fixed viewport; if
  `telegraph_icon_min_px` can no longer fit inside a floored `tileSize`,
  readability degrades before any single knob's "safe range" would suggest —
  re-tune board size and tile-size floors together, per
  `board-and-grid.md`'s own note that board size changes must be re-tuned
  holistically.
- `animation_speed_multiplier` multiplies against both `step_duration_ms` and
  `flash_duration_ms` (Formula F4) — do not tune the per-event durations and
  the global multiplier independently without checking the combined total
  playback time for a worst-case turn (many enemy actions in one Enemy
  Resolve phase) against the session-pacing target.
- `parallel_juice_enabled = true` combined with a low `flash_duration_ms`
  reduces total playback time the most, but is the riskiest combination for
  causal legibility — if enabled, playtesting must specifically verify
  players can still attribute each visual reaction to the correct source
  event.

## Visual/Audio Requirements

**Visual:**
- **Silhouette-first units** (Visual Identity Anchor principle 1): every
  hero/enemy sprite must be identifiable by shape alone in monochrome. This
  system renders whatever silhouette-distinct art the content pipeline
  provides; it cannot enforce silhouette-distinctness in code — recolor-only
  differentiation between two units fails this test and must be caught at
  the art-review stage (art-director), not by this GDD's logic.
- **Icon-driven telegraphs** (principle 2): a consistent icon vocabulary per
  intent type (attack = crosshair/spike, push = directional arrow,
  hazard-spawn = flame/cloud glyph, etc.), never conveyed by animation
  subtlety alone.
- **One accent color per verb-family** (principle 3): implemented via the
  `verb_family_palette_size` palette-slot system (Tuning Knobs); telegraph
  icons, ability-range highlights, and hazard overlays for a given
  verb-family always render in that family's assigned slot color.
- **Neutral board, saturated threats**: Normal-terrain tiles stay within
  `neutral_tile_saturation_cap`; hazard and telegraph overlays are always
  full-saturation, so they visually dominate the board (Core Rule 5).
- **Juice stays local and restrained**: no camera shake, no screen-wide
  flash/vignette, no particle effects that obscure adjacent tiles — every
  juice reaction is confined to the tile(s)/unit(s) actually involved
  (Core Rule 1 scope; "clarity over spectacle").
- **Colorblind-safe by construction**: every rendered state this system owns
  (hazard type, telegraph type, valid/invalid preview outcome, death cause)
  is differentiated by icon/shape, never color alone — implementing the
  requirement `input-and-selection.md` already imposes on this system for
  its own hover/selection/targeting visuals.
- **No flashing content exceeds standard safe strobing thresholds** — a hard
  accessibility constraint on every flash/pulse/impact VFX this system
  produces (impact flashes, hazard-tick pulses, hit-flashes alike).

**Audio (hooks only — this system owns zero audio playback):**
- This system exposes timestamped markers for each juice event
  (`impact_flash_start`, `knockback_start`/`knockback_end`,
  `death_animation_start`, `hazard_pulse_start`) that the Audio System *may*
  subscribe to for tight sync, but never plays a sound itself. Audio System's
  actual upstream dependency is Combat Resolution's event log directly
  (already declared in `combat-resolution.md`), avoiding an unnecessary
  render→audio coupling.
- Every visual cue this system produces is designed to be pairable with a
  simultaneous audio cue (never audio-only feedback is *implied* by this
  system's visuals) — consistent with Input & Selection's established
  "audio always paired with visual" principle.

## Acceptance Criteria

Functional/formula criteria are automatable pure-function unit tests (no
rendering required — F1–F5 and the state machine are testable in isolation
with mocked event/viewport inputs). Visual/feel criteria are ADVISORY —
screenshot + lead/art-director sign-off, per the project's Testing Standards
for Visual/Feel story types. Default board **8×8** unless stated.

**Viewport fit (Formula F1)**
- **GIVEN** `viewportWidth=960, viewportHeight=720` and the default 8×8
  board, **WHEN** `computeViewport()` runs, **THEN** it returns
  `tileSize=90, originX=120, originY=0`.
- **GIVEN** at least 3 distinct `(grid_width, grid_height)` pairs within the
  5–12 safe range (per `board-and-grid.md`), **WHEN** `computeViewport()`
  runs for each, **THEN** every result satisfies
  `tileSize × grid_width + 2×originX == viewportWidth` (and the equivalent
  for height), confirming no hardcoded 8×8 assumption.
- **GIVEN** a computed `tileSize` below `min_tile_size_px`, **WHEN**
  `computeViewport()` runs, **THEN** `tileSize` is clamped to
  `min_tile_size_px` (Edge Cases).

**Juice event mapping (Formulas F2–F5)**
- **GIVEN** a `DisplacementComplete` event with `stepsMoved=2` and
  `step_duration_ms=120`, **WHEN** the renderer processes it, **THEN** it
  creates exactly one knockback tween with `duration=240ms` and no
  additional positional tween.
- **GIVEN** a `CollisionResolved` event (`stepsMoved=0`), **WHEN**
  processed, **THEN** no positional tween is created — only a
  `flash_duration_ms` impact flash fires (Edge Cases).
- **GIVEN** a `UnitRemoved` event with `cause=Fell` and a second with
  `cause=Defeated`, **WHEN** `deathAnimationFor(cause)` is called for each,
  **THEN** it returns two distinct animation IDs (Formula F5).
- **GIVEN** `animation_speed_multiplier=2.0` and an event batch whose base
  total (F4, multiplier excluded) is `1000 ms`, **WHEN** the batch plays,
  **THEN** total wall-clock playback time is `500 ms` (± one frame, ~16 ms
  tolerance).

**State machine**
- **GIVEN** the renderer is `Static`, **WHEN** a non-empty event batch
  arrives, **THEN** it transitions to `Playing` and `isAnimating()` becomes
  `true`.
- **GIVEN** the renderer is `Playing`, **WHEN** every queued tween reaches
  progress `1.0`, **THEN** it transitions back to `Static`, `isAnimating()`
  becomes `false`, and every affected unit's rendered tile position equals
  Board & Grid's reported occupancy for that unit (no drift).
- **GIVEN** the renderer is `Playing`, **WHEN** a preview request arrives
  from Input & Selection, **THEN** it is ignored (no `PreviewOverlay` state
  change, no ghost sprite drawn) and a developer-only warning is logged
  (Edge Cases).
- **GIVEN** the renderer is `Static` and `PreviewOverlay` is `off`, **WHEN**
  a `PreviewResult` is received, **THEN** `PreviewOverlay` becomes `on` and
  the ghost sprite renders at the reported predicted tile.
- **GIVEN** `PreviewOverlay` is `on`, **WHEN** the hover target changes to a
  different tile, **THEN** the ghost overlay updates to the new
  `PreviewResult` without ever entering `Playing`.
- **GIVEN** an empty event batch (`effects=[]`, per `combat-resolution.md`'s
  edge case), **WHEN** received, **THEN** the renderer stays in `Static`
  (no-op transition, not a zero-duration `Playing` cycle).

**Hazard persistence (Core Rule 7)**
- **GIVEN** a hazard with `duration=null` spawned on turn 1, **WHEN** the
  renderer draws any `Static` frame on turn 10 with no intervening
  `HazardApplied` event for that tile, **THEN** the hazard overlay is still
  present (polled from Board state, not event-dependent for persistence).

**Visual/experiential (ADVISORY — screenshot + lead sign-off)**
- **GIVEN** a recorded full Player Phase (3 heroes, one action each) at
  default knob values, **WHEN** a first-time playtester watches the
  resulting Enemy Resolve playback, **THEN** they can correctly state, within
  10 seconds of playback ending and without narration, which hero did what
  to which enemy (validates Pillar #5).
- **GIVEN** a push chain ending in a wall or unit collision, **WHEN** a
  playtester watches it resolve, **THEN** they self-report understanding
  *why* the unit stopped where it did, without being told (validates the
  juice communicates causality, not just the underlying math).
- **GIVEN** the default neutral palette and an active Fire hazard on the
  board, **WHEN** screenshotted, **THEN** the hazard is the most visually
  salient element relative to terrain — art-director sign-off required.
- **GIVEN** a protanopia/deuteranopia color-blindness simulation filter
  applied to a screenshot containing active telegraphs, hazards, and
  selection/targeting highlights, **WHEN** reviewed, **THEN** every state
  remains distinguishable by shape/icon alone — lead sign-off required.
- **GIVEN** default knob values and a full 4–6 turn battle (game-concept.md's
  ITB-scale target), **WHEN** played end-to-end, **THEN** total juice
  playback time does not noticeably dominate the ~5-minute session-length
  target — playtest timing check.

### Performance Budget (headless TS benchmarks where possible; screen-based checks for GPU-bound work)

| Operation | Budget | Note |
|---|---|---|
| `computeViewport()` (Formula F1) | < 0.1 ms/call | Only recomputed on canvas resize |
| Per-frame update cost while `Static` (no active tweens) | < 1 ms | Dirty-flag skip for unchanged sprites; hazard idle-loop polling is the main recurring cost |
| Per-frame update cost while `Playing` (active tweens) | < 3 ms | Tween math + sprite transform updates; leaves headroom alongside Board & Grid's `<2ms` combined budget within a 16.6 ms (60 fps) frame |
| Full single-action event-chain playback (default knobs, ~1–10 primitives) | target 200 ms – 1.5 s wall-clock | Governed by Formula F4; upper end only for long multi-primitive chains |
| Full Enemy Resolve phase playback (default knobs, typical 3–6 enemy actions) | target < 3 s wall-clock | Pacing budget so a 4–6 turn battle stays within the ~5 minute session-length target from `game-concept.md` |

## Open Questions

**Needs an architecture decision (→ ADR during `/create-architecture`):**

1. **Shared coordinate-transform module.** Formulas F1 here and Formulas 1–2
   in `input-and-selection.md` must resolve to byte-identical
   `tileSize`/`originX`/`originY` values on every recompute, or clicks will
   silently misregister against what the player sees. *Proposed:* a single
   shared transform module both systems import, not two independent
   implementations. *Owner:* Tech architecture, coordinating this document
   with Input & Selection.
2. **Event log schema.** This system is a primary consumer of Combat
   Resolution's event log; the exact wire schema (field names, versioning)
   is not yet pinned — already flagged as `combat-resolution.md`'s Open
   Question #1. **Narrowed by `cross-system-contracts.md` §1:** the event
   *vocabulary* itself is now settled (`DamageApplied`, `DisplacementComplete`,
   `CollisionResolved`, `SwapComplete`, `HazardSpawned`, `HazardApplied`,
   `UnitRemoved`, `TerrainSet`, `UnitSpawned` — no separate
   `terrain_destroyed` event; `TerrainSet` already covers it, see Edge Cases).
   What remains open is only field-level schema/versioning detail. *Owner:*
   Tech architecture, coordinated across Combat Resolution, Board Rendering &
   Juice, Battle HUD, and Audio System.
3. **`isAnimating()` signal contract — narrowed.** `cross-system-contracts.md`
   §7 pins this as a direct, polled boolean query that Input & Selection's
   `Locked` state gates on (not mediated through Turn & Phase Manager, not a
   pub/sub event). What remains open is only the concrete implementation
   detail (synchronous getter vs. a cached/reactive value updated on state
   transition) — an implementation choice, not a contract ambiguity. *Owner:*
   Tech architecture, coordinated with Input & Selection.

**Resolved this session (provisional defaults — confirm during
implementation):**

4. **Sequential juice playback is the v1 default**
   (`parallel_juice_enabled = false`) to guarantee animated order always
   matches Combat Resolution's strict resolution order. Revisit after
   playtesting shows whether parallel playback stays legible for pacing.
5. **Terrain-destruction VFX react to the `TerrainSet` event** emitted when
   Combat Resolution's `setTerrain(tile, Normal)` resolves — `setTerrain` is
   one of the 10 canonical combat primitives and already covers terrain
   destruction (no separate primitive or event needed; see Edge Cases).
   **Narrowed, not fully resolved:** the only remaining open detail is the
   exact trigger point for the debris-puff VFX (on `TerrainSet` receipt vs.
   on the terrain sprite swap completing) — an implementation-timing
   question, not a schema gap.
6. **Death-animation distinction by cause is a v1 requirement**; the
   `Recalled` cause reserves a distinct-but-unauthored animation slot for
   whenever Heroes & Abilities defines that removal cause
   (`combat-resolution.md` Open Question #8).

**Deferred to the owning system's GDD:**

7. **Camera pan/zoom.** v1 assumes none (matches
   `input-and-selection.md`'s Open Question #4 assumption). If a future
   board size pushes past what a fixed, letterboxed viewport can legibly
   display, this system will need camera logic — out of scope here.
   *Owner:* revisit if `grid_width`/`grid_height` are pushed toward their
   12-tile safe-range ceiling in practice.
8. **Multi-tile units (size > 1).** Deferred consistently with
   `board-and-grid.md` and `combat-resolution.md`'s equivalent Open
   Questions; this system's per-tile sprite-centering rule (Core Rule 6)
   would need to span multiple tiles. *Owner:* Heroes & Abilities, if/when
   confirmed.
9. **PixiJS-specific implementation details** (texture atlases, sprite-sheet
   format, scene-graph library choices, batching strategy) are a
   technical-art/engine concern, not covered by this design contract.
   *Owner:* lead-programmer / technical-artist during architecture.
10. **Verb-family accent-color assignment** (which specific hex value per
    which verb-family) — this system only reserves palette slots
    (`verb_family_palette_size`); the actual color-to-verb mapping is an
    art-bible / Heroes & Abilities content decision. *Owner:* art-director /
    Heroes & Abilities.
11. **Battle HUD ↔ Board Rendering & Juice dependency edge.** Battle HUD is
    now authored (`battle-hud.md`) and independently confirms the same gap:
    a **Soft, bidirectional** shared-canvas/layer-ordering edge that
    `systems-index.md`'s current Dependency Map does not list. Both documents
    agree; only `systems-index.md` needs updating. *Owner:*
    `/consistency-check`, to add the edge.
