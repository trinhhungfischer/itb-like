# Audio System

> **Status**: In Design
> **Author**: workflow (design-system fan-out)
> **Last Updated**: 2026-07-27
> **Implements Pillar**: #1 Perfect Information, Perfect Blame; #5 Read in Ten Seconds (supporting: #4 Every Hero Is a Verb — one sonic accent per verb-family, mirroring the visual accent-color rule)

## Overview

The Audio System is a **read-only, event-driven consumer** sitting in the Presentation
Layer: it listens to the event streams emitted by Combat Resolution and Turn & Phase
Manager (and, once designed, Heroes & Abilities, Enemy Abilities & Telegraph, Move
Preview, Objective / Win-Lose, and Input & Selection) and turns them into SFX cues and a
light, phase-and-tension-driven adaptive music bed. It owns the **Audio Event Router**
(event → cue mapping), a **voice-priority/coalescing layer** that keeps simultaneous
resolution events from turning into an unreadable wall of sound, a **bus/mix
architecture** (Master / Music / SFX / UI / Ambience) with ducking so gameplay-critical
audio is always audible, and a **deterministic variant-selection scheme** that gets
sonic variety without ever touching RNG — because the sound system must obey the same
"no randomness, no hidden state" contract as everything else in a battle (Pillar #3).
Audio never mutates board state, never blocks or delays resolution, and never carries
information the board doesn't already show visually — it is strictly supplementary to
the "Legible Battlefield" visual language, never a second, competing information
channel.

## Player Fantasy

Audio System has no direct player fantasy of its own — like Board & Grid and Turn &
Phase Manager, it is invisible infrastructure. What the player *feels* when it works is
**"the board sounds exactly as trustworthy as it looks."** A clean, punchy impact when
a shove lands an enemy in a chasm; a distinct, recognizable stinger the instant a new
lethal telegraph appears; music that quietly tightens as the board gets more dangerous
and eases the moment the player finds — and commits — the clean solution. None of it
ever surprises, misleads, or requires the player to listen for information they can't
also see, because that would violate Pillar #1 the same way a hidden dice roll would.
The reference feeling is Into the Breach's soundtrack (Ben Prunty) and mix: sparse,
mechanical, confident — audio that respects a player who is thinking hard, not one that
tries to startle or manipulate them. The failure state of this system is a sound that
implies information the board doesn't show, a mix so dense that a five-target turn
becomes noise, or music that yanks the player's attention away from a critical
telegraph — any of these would break the trust every other system in VANGUARD is built
on.

## Detailed Design

### Core Rules

1. **Read-only, non-blocking consumer.** The Audio System subscribes to the canonical
   event vocabulary emitted by Combat Resolution's `resolve(board, effects[])` — all 9
   event types covering its 10 primitives, per `cross-system-contracts.md` §1:
   `DamageApplied`, `DisplacementComplete`, `CollisionResolved`, `SwapComplete`,
   `HazardSpawned`, `HazardApplied`, `UnitRemoved`, `TerrainSet`, `UnitSpawned` (plus
   the debug-only `swap_failed` event) — and Turn & Phase Manager (`turn_started`,
   `player_phase_begun`, `action_applied`, `action_undone`, `environment_resolved`,
   `hazard_ticked`, `enemy_action_resolved`, `enemy_spawned`, `intents_telegraphed`,
   `battle_ended`). It never calls back into either system, never mutates `Board` or
   any gameplay state, and its processing must never gate or delay a `resolve()` call
   or a phase transition (mirrors Combat Resolution's own "service, never initiates
   action" contract).
2. **Audio Event Router.** Every incoming event is looked up in a static **Event → Cue
   Mapping table** (authored by `sound-designer`, format sampled in Visual/Audio
   Requirements below): `event type → cueId, bus, priority tier`. An event with no
   mapped cue is a **silent no-op** (Edge Cases) — it is never an error and never
   blocks the router.
3. **Preview never reaches the stream — no filter needed.** Move Preview
   (`move-preview.md`, ✅ Designed) is **silent and subscription-based** per
   `cross-system-contracts.md` §7: it subscribes to Input & Selection's
   hover/select/cancel/confirm events and, on hover/select, dry-runs Combat
   Resolution's `resolve()` against its own `board.snapshot()` to build a
   `PreviewResult` that it hands directly to Board Rendering & Juice and Battle
   HUD — it never publishes those dry-run events onto the event stream the
   Audio System subscribes to. Only a `resolve()` call made against the
   **live** board during an actual phase (Player Phase action commit,
   Environment, Enemy Resolve, Spawn) ever reaches Audio. Because preview
   events structurally never enter the shared stream, the Audio System
   requires no `committed` tag, no source discriminator, and no
   preview-awareness logic of its own — hovering ten candidate moves in a row
   produces zero SFX the same way it produces zero board mutation.
4. **Voice priority and stealing (Formula F1).** Each SFX bus has a fixed voice pool
   (`max_concurrent_sfx_voices`, Tuning Knobs). Every cue is authored with a priority
   tier — `Critical` (telegraph reveals, unit removal, collision damage), `Normal`
   (moves, non-lethal impacts, ability casts), `Ambient` (idle/UI hover) — and when the
   pool is full, a new request steals the lowest-priority, then oldest voice; if no
   voice qualifies, the new request is **dropped**, never queued and never forced to
   interrupt gameplay-critical audio with a lower-priority sound.
5. **Event coalescing (Formula F2).** When the same cue is triggered multiple times for
   the same battle event chain within `coalesce_window_ms` (e.g. a single AoE ability's
   effect chain, per Combat Resolution's Rule 2 "strictly sequential" resolution,
   damaging five units in quick succession), only the first `coalesce_max_full_instances`
   (`K`) plays as an audible, gain-attenuated voice; further instances in the same
   window are silently absorbed into a cluster count with no additional voice spawned.
   This keeps a five-target turn *readable* instead of a wash of five overlapping
   identical impacts (Pillar #5) — the HUD damage numbers still show every instance
   regardless of what audio played, because audio is supplementary, never the sole
   carrier (Core Rule 3 reprised).
6. **Deterministic variant selection (Formula F3).** A cue with multiple authored audio
   variants (e.g. `sfx_combat_impact_light_01`..`_03`) is never chosen by RNG. Selection
   cycles through variants in a fixed round-robin order per `cueId`, using a counter
   that resets to 0 at Turn & Phase Manager's `Setup` state (battle start). This keeps
   the Audio System honest with Pillar #3 (no RNG anywhere in battle) while still
   delivering non-repetitive sound — variety comes from *how many times you've heard
   this cue this battle*, which is itself a deterministic, replayable fact.
7. **Bus architecture.** Four buses feed a Master bus: **Music**, **SFX**, **UI**,
   **Ambience**. Every cue is authored to exactly one bus. `Settings / Options`
   (Alpha-tier, `settings-and-options.md`, Designed 2026-07-28) exposes independent Master/Music/SFX/UI/Ambience volume
   sliders that scale each bus's gain multiplicatively — this document owns the bus API
   those sliders call, not the sliders themselves.
8. **Music ducking (Formula F4).** Any `Critical`-priority SFX cue triggers a short,
   fixed ducking envelope on the Music bus (attack → hold → release, `duck_amount_db`
   floor). Ducking never fully mutes music and never applies to `Normal`/`Ambient` cues
   — this guarantees the mix hierarchy rule: **gameplay-critical audio (telegraphs,
   impacts, removals) is always audible over the music bed**, without the music
   disappearing on every minor sound.
9. **Adaptive music is phase- and tension-driven, not per-event.** The music state
   machine (States and Transitions, below) changes at two triggers only: a Turn & Phase
   Manager phase boundary that changes context (e.g. entering Player Phase, entering
   Enemy Resolve), and a tension-score recompute (Formula F5) at `Telegraph Phase`
   completion and at `EndCheck`. Music never re-evaluates mid-animation or per
   individual SFX — this keeps music transitions tied to *legible* moments (a phase
   just changed, a new telegraph just appeared), never a flickery reaction to every
   small event.
10. **Stem-based layering, not track-switching.** Each music state is a set of
    synchronized, tempo/key-locked stems (e.g. a persistent pad + a percussion layer +
    a tension layer) rather than independent full tracks. Intensity changes (Formula
    F5's `layerIndex`) fade individual stems in/out over `music_crossfade_ms`; the
    underlying pad never stops or restarts, so transitions are seamless and never
    reveal a loop-point splice.
11. **Telegraph audio is confirmatory, not primary.** A telegraph reveal
    (`intents_telegraphed`) plays a short, distinct stinger per threat category, but the
    stinger's absence (e.g. audio muted) must never remove any information — the visual
    telegraph icon (Board Rendering & Juice ✅ — per its Core Rule 8, telegraph icons
    must match the resolved outcome exactly) is the sole source of truth.
    This is a hard design rule, not a preference: it is what keeps the Audio System from
    ever becoming a second, competing channel of "perfect information" that the visual
    layer must also perfectly match (Pillar #1).
12. **Ordering is inherited, never re-derived.** The Audio System processes events in
    the exact order it receives them from Combat Resolution / Turn & Phase Manager's
    strictly-sequential resolution (Combat Resolution Rule 2; Turn Manager's "one phase
    at a time, never simultaneous" guarantee). It never reorders, batches-and-reshuffles,
    or delays a cue for mix convenience in a way that would let a later event's sound
    play before an earlier event's — audio order must always match resolution order,
    the same way the visual outcome must always match the previewed outcome.
13. **Stereo position mirrors board position (Formula F6).** Any cue tied to a specific
    tile is panned according to that tile's column, using the registered `grid_width`
    constant. This gives the player a coarse "which side of the board" audio cue for
    free, reinforcing legibility without adding any new information the board doesn't
    already show.
14. **Undo/redo audio contract.** `action_applied` triggers the acting ability/move's
    SFX; `action_undone` triggers a short, distinct "undo" cue and immediately stops (via
    a fast fade, Tuning Knobs) any still-playing voice that was spawned by the undone
    action. A subsequent redo (a fresh `action_applied` for the same action) plays the
    action's SFX again from scratch — the Audio System never "remembers" that a sound
    already played once for an action that was undone and re-applied; each commit is
    treated as a fresh event.

### States and Transitions

**Music state machine** (per battle; resets at each `Setup`):

`Uninitialized → Calm ↔ Alert ↔ Critical → VictoryStinger | DefeatStinger → Ended`

| State | Entered when | Stems active | Exits to |
|-------|-------------|--------------|----------|
| Uninitialized | Before `Setup` completes | none | `Calm` once Setup's first tension compute runs |
| Calm | `layerIndex == 0` (Formula F5) | pad only | `Alert`/`Critical` on next tension recompute; `VictoryStinger`/`DefeatStinger` on `battle_ended` |
| Alert | `layerIndex == 1` | pad + percussion | `Calm`, `Critical`, or a stinger state |
| Critical | `layerIndex == 2` | pad + percussion + tension layer | `Calm`, `Alert`, or a stinger state |
| VictoryStinger | `battle_ended(Victory)` | one-shot, all loop stems stop | `Ended` (stinger plays to completion, no loop) |
| DefeatStinger | `battle_ended(Defeat)` | one-shot, all loop stems stop | `Ended` (stinger plays to completion, no loop) |
| Ended | Stinger completes or battle abandoned | none | — (terminal; next battle re-enters at `Uninitialized`) |

`battle_ended(Abandon)` transitions directly to `Ended` with an immediate stop (no
stinger) — the player is leaving, not winning or losing.

**Ducking envelope state** (per Music bus, Formula F4): `Idle → Attack → Hold → Release
→ Idle`. A new Critical trigger arriving during `Attack`/`Hold`/`Release` resets the
envelope to `Attack`, continuing from whatever gain the envelope currently holds (no
audible jump; see F4 worked example).

**SFX voice state** (per voice, per bus, Formula F1): `Free → Playing → (Completed |
Stolen) → Free`. `Stolen` is a hard stop (no fade) to guarantee the requesting voice's
allocation succeeds within the same audio frame.

**Per-cue variant counter state** (Formula F3): `idx(cueId)` persists for the duration
of one battle only; reset to 0 for every `cueId` at `Setup`. Not persisted across
battles or saved to Run Persistence.

### Interactions with Other Systems

| System | Audio System reads | Audio System calls into | Ownership boundary |
|--------|---------------------|--------------------------|---------------------|
| **Combat Resolution** ✅ | `DamageApplied`, `DisplacementComplete`, `CollisionResolved`, `SwapComplete`/`swap_failed`, `HazardSpawned`, `HazardApplied`, `UnitRemoved`, `TerrainSet`, `UnitSpawned` | — (never calls back) | Combat owns event truth and ordering; Audio owns interpretation into sound |
| **Turn & Phase Manager** ✅ | `turn_started`, `player_phase_begun`, `action_applied`, `action_undone`, `environment_resolved`, `hazard_ticked`, `enemy_action_resolved`, `enemy_spawned`, `intents_telegraphed`, `battle_ended` | — | Manager owns *when* phases happen; Audio owns *how they sound* |
| **Heroes & Abilities** ✅ | ability-specific cue IDs (each ability definition must supply a `sfx_cue_id` per verb) | — | Heroes & Abilities owns ability content; Audio owns cue playback. **Gap to flag** — `heroes-and-abilities.md`'s `AbilityDefinition` schema does not yet include an `sfx_cue_id` field (see Bidirectional-consistency note, Dependencies) |
| **Enemy, Abilities & Telegraph** ✅ | enemy action cue IDs; telegraph-category cue IDs (for Rule 11's stinger); `telegraphedLethalThreatCount(turn)` for Formula F5's tension score, per `cross-system-contracts.md` §9 (resolving C4) | — | Same relationship as Heroes & Abilities. **Gap to flag** — `enemy-abilities-and-telegraph.md` does not yet expose `telegraphedLethalThreatCount(turn)` (see Bidirectional-consistency note, Dependencies) |
| **Move Preview** ✅ | — (Move Preview never emits into Audio's stream — Rule 3) | — | Preview is silent and subscription-based (`move-preview.md`, per `cross-system-contracts.md` §7); its dry-run `resolve()` calls never reach the event stream Audio subscribes to, so there is no data interface beyond that structural guarantee |
| **Objective / Win-Lose** ✅ | `battle_ended(result)` (via Turn Manager) drives stinger selection | — | Objective owns the verdict; Audio owns the stinger |
| **Board & Grid** ✅ | tile `col` for Formula F6 panning | — | Board owns spatial truth; Audio derives pan from it, read-only |
| **Input & Selection** ✅ | hover/select/confirm/cancel UI events | — | Input owns interaction state; Audio maps it to `sfx_ui_*` cues. Confirmed against `input-and-selection.md`'s actual emitted event vocabulary (hover/select/cancel/confirm) |
| **Board Rendering & Juice** ✅ | — (peer, not a dependency) | — | Both are read-only consumers of the same Combat/Turn event streams; kept in sync by triggering off the same source events, never off each other's animation callbacks, to avoid audio drift |
| **Battle HUD** ✅ | — (peer, not a dependency) | — | Same peer relationship as Board Rendering & Juice |
| **Settings / Options** ✅ (`settings-and-options.md`, Designed 2026-07-28) | — | exposes bus-gain API (`setBusGain(bus, db)`) | Audio owns the bus/gain model; Settings owns the UI that calls it. Settings converts its 0–100 sliders to decibels via its Formula F1 (`20·log₁₀(v/100)`, with `v=0` special-cased to `-∞`) and combines each bus with Master before calling this API. It never manipulates a bus directly |

**Contract this system requires from callers (gaps to close in the owning systems'
GDDs — see Bidirectional-consistency note, Dependencies):**
- Heroes & Abilities and Enemy, Abilities & Telegraph must supply a stable `sfx_cue_id`
  per ability/verb at authoring time — the Audio Event Router does not infer sound from
  effect-primitive type alone (a "push" from a shove hero and a "push" from an enemy
  charge should usually sound different, per Pillar #4's one-accent-per-verb-family
  visual rule mirrored in sound).
- Move Preview must remain silent and subscription-based (`move-preview.md`, per
  `cross-system-contracts.md` §7) — it must never publish its dry-run `resolve()`
  events onto the shared event stream Audio subscribes to. This is already Move
  Preview's designed behavior (Rule 3), so no additional filter contract is required of
  it.
- Enemy, Abilities & Telegraph must expose `telegraphedLethalThreatCount(turn)` (per
  `cross-system-contracts.md` §9, resolving C4) for Formula F5's tension score.

> **Dependency status:** Heroes & Abilities, Enemy, Abilities & Telegraph, Move
> Preview, Objective / Win-Lose, Board & Grid, Input & Selection, Board Rendering &
> Juice, and Battle HUD are all ✅ Designed (`systems-index.md`). Settings / Options
> (#28) and Accessibility (#27) became ✅ Designed 2026-07-28 — Settings calls this
> document's `setBusGain(bus, db)` and never touches a bus directly; Accessibility A9
> makes this document's Rule 12 ("a stinger's absence must never remove any
> information") a BLOCKING verification gate rather than an authoring intention. The
> interfaces above have been reconciled against
> each system's actual GDD; the remaining field-level gaps (missing `sfx_cue_id`,
> missing `telegraphedLethalThreatCount(turn)`) are flagged inline above and in the
> Bidirectional-consistency note below — they are contract gaps for the owning systems
> to close, not open design questions for this document.

## Formulas

All formulas are deterministic (no RNG, no wall-clock dependence beyond elapsed-ms
timers driving envelope shape, which are themselves fed by fixed durations, not random
values). Examples use the default **8×8** board (registered constant `grid_width`) and
this document's default tuning-knob values.

### F1. Voice priority and stealing

```
requestVoice(bus, cue):
  if activeCount(bus) < V_max(bus):
    allocate(cue); return PLAY
  candidates = { v in activeVoices(bus) : P(v.cue) <= P(cue) }
  if candidates is empty: return DROP
  victim = argmin(candidates, by: (P(v.cue) asc, age_ms(v) desc))
  stop(victim); allocate(cue); return PLAY
```

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| bus voice cap | `V_max(bus)` | int | 1–32 (Tuning Knobs) | Max simultaneous voices on this bus |
| cue priority | `P(cue)` | enum→int | `{Ambient=0, Normal=1, Critical=2}` | Authored per cue in the Event→Cue table |
| voice age | `age_ms(v)` | int | ≥0 | Ms since voice `v` started playing |
| active voices | `activeCount(bus)` | int | `[0, V_max]` | Current playing voices on the bus |

**Output range:** `{PLAY, DROP}` — a binary outcome per voice request.

**Worked example 1 (steal):** SFX bus, `V_max=8`, all 8 slots full (6 Normal, 2
Critical). A new `Critical UnitRemoved` cue arrives. Candidates = all 8 voices
(`P(v.cue) <= 2` is true for everything). Victim = lowest priority first → a Normal
voice; among Normal voices, oldest (`age_ms` largest) is stolen. New cue plays: `PLAY`.

**Worked example 2 (drop):** SFX bus full with 8 Critical voices (an extreme multi-kill
turn). A new `Normal sfx_ui_hover` arrives. Candidates = voices with `P(v.cue) <= 1` →
none (all are `P=2`). Result: `DROP` — the hover sound silently does not play this
frame; no error, no queue.

### F2. Event coalescing gain attenuation

```
if i <= K:
  gain_i_db = base_gain_db + (i - 1) * attenuation_db_per_step
else:
  gain_i_db = SILENT   # no voice spawned; cluster counter incremented only
```

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| coalescing window | `coalesce_window_ms` | int | 0–200 (Tuning Knobs) | Ms window in which repeated same-cue instances attenuate instead of overlapping at full volume |
| max full instances | `K` | int | 1–6 (Tuning Knobs) | How many instances within the window still spawn an audible voice |
| instance index | `i` | int | ≥1 | Ordinal position of this trigger within the current window for this `cueId` |
| base gain | `base_gain_db` | float | authored per cue | Reference gain of the loudness-normalized asset |
| attenuation step | `attenuation_db_per_step` | float | -8..-1 (Tuning Knobs, default -4) | Gain reduction applied to each successive coalesced instance |

**Output range:** `gain_i_db ∈ [base_gain_db - (K-1)*|attenuation_db_per_step|,
base_gain_db]` for `i ≤ K`; `SILENT` for `i > K`.

**Worked example:** `K=3`, `attenuation_db_per_step=-4dB`, `base_gain_db=0dB`. A
5-target AoE resolves as 5 sequential `DamageApplied` events within a 50ms
`coalesce_window_ms` (Combat Resolution's Rule 2 strict sequencing makes this a
near-instant chain). `i=1 → 0dB` (full), `i=2 → -4dB`, `i=3 → -8dB`, `i=4,5 → SILENT`
(cluster counter = 2). The HUD still shows all 5 damage numbers — audio never hides
information, it only avoids playing 5 overlapping copies of the same sound.

### F3. Deterministic round-robin variant selection

`selectedVariant = (idx mod variantCount) + 1`  ·  `idx' = idx + 1`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| variant count | `variantCount(cueId)` | int | ≥1 | Authored number of audio variants for this cue |
| play counter | `idx(cueId)` | int | ≥0 | Per-cue counter, resets to 0 at battle `Setup` |
| selected variant | `selectedVariant` | int (output) | `[1, variantCount]` | Which variant file plays this time |

**Output range:** `[1, variantCount]`, fully determined by how many times this exact
`cueId` has played so far this battle — no RNG (Pillar #3).

**Worked example:** `sfx_combat_sword_swing` has `variantCount=3`. Play 1: `idx=0 →
selected=1`, `idx→1`. Play 2: `idx=1 → selected=2`, `idx→2`. Play 3: `idx=2 →
selected=3`, `idx→3`. Play 4: `idx=3 → selected=(3 mod 3)+1=1`, cycle repeats
`1,2,3,1,2,3,…`.

### F4. Music ducking envelope

```
gain_db(t) =
  lerp(0, duck_amount_db, t / attack_ms)                                  for t in [0, attack_ms]
  duck_amount_db                                                          for t in (attack_ms, attack_ms+hold_ms]
  lerp(duck_amount_db, 0, (t - attack_ms - hold_ms) / release_ms)         for t in (attack_ms+hold_ms, attack_ms+hold_ms+release_ms]
  0                                                                       for t beyond that
```

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| duck floor | `duck_amount_db` | float | -12..0 (Tuning Knobs, default -6) | Max Music-bus attenuation while ducked |
| attack time | `attack_ms` | int | 10–200 (Tuning Knobs, default 50) | Time to reach the duck floor |
| hold time | `hold_ms` | int | 0–500 (Tuning Knobs, default 100) | Time held at the duck floor |
| release time | `release_ms` | int | 100–1000 (Tuning Knobs, default 400) | Time to return to 0dB |
| elapsed time | `t` | int (ms) | ≥0 | Ms since the triggering Critical cue fired |

**Retrigger rule:** a new Critical cue firing while `t` is still inside the envelope
resets `t=0`, continuing the release curve from the **current** gain rather than
stacking further below `duck_amount_db` — the floor is a clamp, not cumulative.

**Output range:** `gain_db(t) ∈ [duck_amount_db, 0]`.

**Worked example:** defaults. A `Critical UnitRemoved` fires at `t=0`: gain glides
`0dB → -6dB` by `t=50ms`, holds `-6dB` until `t=150ms`, then glides back to `0dB` by
`t=550ms`. A second Critical cue fires at `t=120ms` (mid-hold): envelope resets to a
fresh `Attack` starting from the current `-6dB` (no audible jump), extending the ducked
window.

### F5. Tension score → music intensity layer

`tension = clamp01( w1 * min(1, lethalThreats / 3) + w2 * heroHPMissingPct )`
`layerIndex = 0 if tension < 0.33, 1 if tension < 0.66, else 2`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| telegraphed lethal threats | `lethalThreats` | int | ≥0 | `= telegraphedLethalThreatCount(turn)`, queried directly from Enemy, Abilities & Telegraph ✅ per `cross-system-contracts.md` §9 (resolving C4) — count of currently-telegraphed enemy/environment actions that would remove ≥1 hero if unaddressed. **Gap to flag** — `enemy-abilities-and-telegraph.md` does not yet expose this query (see Bidirectional-consistency note, Dependencies) |
| missing HP fraction | `heroHPMissingPct` | float | `[0,1]` | `1 − (Σ currentHP / Σ maxHP)` across living heroes |
| threat weight | `w1` | float | Tuning Knobs, default 0.6 | Weight of threat count in tension |
| HP weight | `w2` | float | Tuning Knobs, default 0.4 (`w1+w2=1.0`) | Weight of missing HP in tension |
| tension score | `tension` | float (output) | `[0,1]` | Recomputed at `Telegraph Phase` completion and at `EndCheck` only (Rule 9) |
| intensity layer | `layerIndex` | int (output) | `{0,1,2}` | Maps to Calm / Alert / Critical (States and Transitions) |

`lethalThreats` is normalized against a cap of 3 simultaneous lethal threats — beyond
that the read is already at its ceiling per Pillar #5 (a player reading more than 3
simultaneous lethal threats is already maximally tense; additional threats don't need
to push the music further).

**Output range:** `tension ∈ [0,1]`, `layerIndex ∈ {0,1,2}`.

**Worked example:** `squad_size=3` heroes, `Σ maxHP=30` (10 each), `Σ currentHP=18` →
`heroHPMissingPct = 1 − 18/30 = 0.4`. `lethalThreats = telegraphedLethalThreatCount(turn)
= 2`. `tension = 0.6 * min(1, 2/3) + 0.4 * 0.4 = 0.6*0.667 + 0.16 = 0.4 + 0.16 = 0.56` →
`layerIndex=1` (Alert). Music crossfades to the Alert stem mix over `music_crossfade_ms`.

### F6. Stereo pan from grid column

`pan = clamp(-1, 1, (col − (grid_width−1)/2) / ((grid_width−1)/2))`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| tile column | `col` | int | `[0, grid_width−1]` | Column of the tile the sound event occurred on |
| board width | `grid_width` | int | =8 (registry constant, source `board-and-grid.md`) | Default board width |
| stereo pan | `pan` | float (output) | `[-1, 1]` | -1 = hard left, 0 = center, +1 = hard right |

**Output range:** `[-1, 1]`, linear across the board width.

**Worked example:** `grid_width=8` → columns `0..7`, center `= 3.5`. `col=0 →
pan=(0-3.5)/3.5 = -1.0` (hard left). `col=7 → +1.0` (hard right). `col=3 →
(3-3.5)/3.5 ≈ -0.143` (slightly left). `col=4 → +0.143` (slightly right).

Row (the board's other axis) is **not** mapped to any audio parameter in v1 — the game
is viewed top-down with no depth axis relevant to a stereo image. A future reverb-send
by row is a possible extension (Open Questions), not designed here.

## Edge Cases

- **An event has no entry in the Event → Cue Mapping table:** silent no-op. In
  development builds this logs a `missing_cue_mapping(eventType)` console warning; in
  production builds it is fully silent. It never throws and never blocks the event
  stream (Rule 2).
- **A cue's audio bus is at `V_max` and no candidate voice qualifies for stealing
  (Formula F1):** the request is **dropped** — the sound simply does not play this
  frame. This is expected behavior under an extreme multi-event turn, not a bug; the
  HUD/visual layer remains the source of truth regardless.
- **More than `K` coalesced instances of the same cue occur in one window (Formula
  F2):** instances `K+1..n` never spawn a voice; a silent cluster counter increments.
  No "summary" sound plays automatically for the overflow in v1 — if playtesting shows
  large-AoE turns feel under-sold, a distinct `_cluster` cue variant is a future
  extension (Open Questions), not implemented here.
- **`action_undone` fires while the undone action's SFX voice is still playing (Rule
  14):** that specific voice is stopped via a fast 80ms linear fade-out (not a hard
  cut, to avoid an audible click) and the distinct "undo" cue plays immediately,
  overlapping the fade.
- **The same action is undone and redone repeatedly (undo/redo spam within Player
  Phase):** each `action_applied` triggers its SFX fresh and each `action_undone`
  triggers the undo cue fresh — Formula F1's voice-stealing rule naturally throttles
  this if it exceeds `V_max` on the UI/SFX bus; no special-case debouncing is added
  beyond the existing priority system.
- **A Move Preview dry-run (`resolve(board.snapshot(), effects)`) produces events while
  the player merely hovers a move option:** these events never reach the Audio Event
  Router in the first place (Rule 3) — Move Preview computes its dry-run internally and
  only ever hands a `PreviewResult` to Board Rendering & Juice / Battle HUD, never
  publishing onto the shared event stream (`move-preview.md`, per
  `cross-system-contracts.md` §7). This is a structural guarantee of Move Preview's
  design, not something the Audio System filters for.
- **Battle ends via `battle_ended(Abandon)` while SFX/music are actively playing:** all
  voices on all buses stop immediately (hard cut is acceptable here — the player is
  leaving the battle, not experiencing its outcome) and the music state machine
  transitions directly to `Ended` with no stinger (States and Transitions).
- **Two Critical cues fire in the exact same resolution tick (e.g. two simultaneous
  `UnitRemoved` events from a spreading-fire tick, per Combat Resolution's own edge
  case for two units hitting 0 HP in one Environment tick):** both request voices; F1
  resolves them independently in the order Combat Resolution emitted them (Rule 12 —
  audio never reorders); the ducking envelope (F4) retriggers once per Critical cue,
  per its retrigger rule, so the second trigger simply extends the existing duck window
  rather than double-ducking.
- **Master volume is set to 0 / muted (device or Settings):** the Audio Event Router
  and all formulas above still execute normally (no early-exit optimization that skips
  logic) — muting is a pure gain multiplier at the Master bus, not a state that changes
  which events are processed. This guarantees the (undesigned) Accessibility system can
  rely on Audio's internal state being consistent even when the player can't hear it.
- **`spawnHazard` is called without a following `applyHazard` in the same chain**
  (Combat Resolution's Rule 7 split — "seed a trap for later"): only the
  hazard-creation cue plays (e.g. a short "trap set" sting); no impact/damage cue plays
  until a later `applyHazard` actually resolves against an occupant.
- **An ability's effect chain is empty (`effects = []`, a legal "pass" per Combat
  Resolution's Edge Cases):** no SFX plays; a `action_applied` event with zero
  downstream Combat events still triggers the acting hero's generic "ability used"
  UI/SFX cue if one is mapped, independent of whether any primitive actually resolved.
- **Undo is pressed at the Player-Phase-start snapshot (Turn Manager's "already at
  earliest snapshot" edge case, a no-op):** no `action_undone` event is emitted by the
  Turn Manager in this case (per its own contract), so no audio fires either — the
  Audio System has no special-case handling here because there is no event to react to.
- **A hazard's `duration` expires and auto-clears (Combat Resolution Formula F4,
  `duration'=0 → None`):** this is not itself an `applyHazard` damage event; if the
  Event → Cue table maps a distinct "hazard expired" cue, it fires on the tick that
  observes the transition; if unmapped, silent no-op per the general rule above.

## Dependencies

**Upstream (Audio System depends on):**

| System | Interface | Hard / Soft |
|--------|-----------|-------------|
| **Combat Resolution** ✅ | Reads the emitted event log (`DamageApplied`, `DisplacementComplete`, `CollisionResolved`, `SwapComplete`/`swap_failed`, `HazardSpawned`, `HazardApplied`, `UnitRemoved`, `TerrainSet`, `UnitSpawned`) | **Hard** — every SFX cue originates from these events |
| **Turn & Phase Manager** ✅ | Reads phase/lifecycle events (`turn_started`, `player_phase_begun`, `action_applied`, `action_undone`, `environment_resolved`, `hazard_ticked`, `enemy_action_resolved`, `enemy_spawned`, `intents_telegraphed`, `battle_ended`) | **Hard** — drives the music state machine and undo/redo audio contract |
| **Enemy, Abilities & Telegraph** ✅ | Reads `telegraphedLethalThreatCount(turn)` for Formula F5's tension score, per `cross-system-contracts.md` §9 (resolving C4); also the source of enemy action/telegraph cue IDs (Interactions with Other Systems) | **Hard** — Formula F5 has no tension input without it |
| **Move Preview** ✅ | No direct calls — Audio's Rule 3 correctness depends on Move Preview remaining silent and subscription-based (`move-preview.md`, per `cross-system-contracts.md` §7) and never publishing dry-run `resolve()` events onto the shared Combat/Turn event stream | **Hard** — if this contract ever changed, Audio would need a preview filter it does not currently implement |
| **Board & Grid** ✅ | Reads tile `col` for Formula F6 panning | **Hard** — panning requires board position |

**Bidirectional-consistency note:** `combat-resolution.md` already lists Audio System
as a **Soft** downstream dependent ("Reads events for SFX triggers; read-only
consumer") — consistent with the Upstream row above (this document treats the same
relationship as **Hard**, since without it there is no audio at all; the severity
label differs because each document rates the dependency from its own risk
perspective, which is expected). `enemy-abilities-and-telegraph.md` and
`move-preview.md` already list Audio System as a **Soft** downstream dependent as well
(reading telegraph/whiff/on-death events, and consuming the "preview is silent" rule,
respectively) — same expected severity-perspective difference. **`turn-and-phase-
manager.md` does not currently list Audio System in its Downstream table** — only
Battle HUD, Move Preview, and Heroes & Abilities are listed. This is a **gap to flag
for `/consistency-check`**: Turn & Phase Manager should add a row for Audio System
consuming its phase-lifecycle events, matching the Hard dependency declared here.
**Two further field-level gaps to flag:** `heroes-and-abilities.md`'s
`AbilityDefinition` schema does not yet include the `sfx_cue_id` field this document
requires (Interactions with Other Systems), and `enemy-abilities-and-telegraph.md`
does not yet expose the `telegraphedLethalThreatCount(turn)` query that Formula F5
now sources its `lethalThreats` input from, per `cross-system-contracts.md` §9. Both
are contract gaps for the owning systems to close, not blocking errors in this
document.

**Downstream (systems that depend on Audio System — currently undesigned; interfaces
below are the contract this GDD proposes):**

| Dependent System | Interface (what it uses) | Hard / Soft |
|-------------------|---------------------------|-------------|
| **Settings / Options** | `setBusGain(bus, db)` — Master/Music/SFX/UI volume control | **Hard** |
| **Accessibility** | Read-only guarantee that internal Audio state is consistent regardless of mute/volume (Edge Cases) — supports a future "visualize what would have played" debug/accessibility aid | **Soft** |

**Sibling / peer relationships (not dependencies):**

| System | Relationship |
|--------|--------------|
| **Board Rendering & Juice** | Both read the same Combat/Turn event streams independently; kept in sync by triggering off the same source events, never off each other |
| **Battle HUD** | Same peer relationship |

## Tuning Knobs

| Knob | Default | Safe Range | Too Low | Too High |
|------|---------|-----------|---------|----------|
| `max_concurrent_sfx_voices` (`V_max`, per SFX bus) | 8 | 4–32 | Important impacts get stolen/dropped mid-chain even in modest turns, undercutting the feedback a resolved action is supposed to give (weakens Pillar #5's instant-legibility promise) | Diminishing returns past the point where simultaneous audible voices exceed what a player can parse anyway; raises CPU/mixing cost and the chance of clipping before the limiter catches it |
| `coalesce_window_ms` | 50 | 0–200 | `0` disables coalescing entirely — every simultaneous event plays full-volume, turning any multi-target turn into audio mud (breaks Pillar #5) | `>200` starts merging events that are meaningfully distinct in gameplay terms (e.g. two separate abilities resolving close together but not truly simultaneous), losing feedback granularity |
| `coalesce_max_full_instances` (`K`) | 3 | 1–6 | `1` makes even a 2-target AoE always sound like a single hit, undersold and repetitive | `6` rarely triggers the coalescing benefit at all on a realistic 3–4 hero roster, defeating the knob's purpose |
| `attenuation_db_per_step` | -4 dB | -8..-1 dB | `-1dB` barely attenuates coalesced instances, nearly as loud as no coalescing | `-8dB` makes the 2nd/3rd coalesced instance nearly inaudible, feeling like only the first hit "counted" |
| `duck_amount_db` | -6 dB | -12..0 dB | `0` (no duck) lets music compete with Critical SFX, risking masking gameplay-critical audio — violates the mix-hierarchy requirement | `-12dB` makes music audibly vanish on every impact, producing a jarring "pumping" effect that undermines the intended light, unobtrusive bed |
| `duck_attack_ms` | 50 | 10–200 | Too fast (<10ms) can produce an audible click on the gain change | Too slow (>200ms) makes the duck feel laggy, arriving after the SFX it's meant to make room for has already partly played |
| `duck_hold_ms` | 100 | 0–500 | `0` means the duck floor is only ever a single instant before releasing, barely perceptible | `>500` holds music quiet longer than most single SFX cues last, wasting the duck's purpose |
| `duck_release_ms` | 400 | 100–1000 | `<100ms` produces audible "pumping" during rapid-fire multi-hit turns as the duck re-triggers before fully releasing | `>1000ms` keeps music quiet through most of a normal turn, making the ducking effectively permanent rather than reactive |
| `music_crossfade_ms` | 1000 | 250–3000 | `<250ms` makes intensity-layer changes feel like an abrupt splice rather than a swell | `>3000ms` disconnects the music's tension change from the board moment that caused it (e.g. a new lethal telegraph appearing should feel prompt) |
| `w1` / `w2` (tension weights, F5) | 0.6 / 0.4 | any pair summing to 1.0 | Setting `w1` near 0 makes music ignore incoming lethal threats entirely, undercutting the "danger is audible" goal | Setting `w1` near 1.0 makes music ignore hero HP state, so a nearly-dead squad in a currently-safe position doesn't read as tense |

**Interactions between knobs:** `coalesce_window_ms` and `duck_hold_ms`/`duck_release_ms`
should be tuned together — a coalescing window much longer than the duck's hold+release
means later coalesced instances (silent per F2) arrive after music has already started
un-ducking, producing an odd "the loudest part of the turn is now the quietest audio
moment" mismatch. `music_crossfade_ms` and F5's recompute cadence (Telegraph Phase +
EndCheck only) interact: a very long crossfade combined with the two-recompute-per-turn
cadence means a tension change might still be mid-fade when the *next* recompute fires,
which is handled gracefully (a new target layer simply becomes the crossfade's new
destination) but should stay well under one turn's typical duration.

**Explicitly NOT knobs here (structurally fixed):**
- **Preview isolation** (Rule 3) is not configurable — it is a structural guarantee
  (Move Preview never publishes dry-run events onto the shared stream), not a filter
  the Audio System implements or could be tuned to relax.
- **Audio ordering matching resolution order** (Rule 12) is not configurable, for the
  same reason Turn & Phase Manager's phase order isn't a knob — exposing it would let a
  setting silently break the "audio never lies about what happened" guarantee.

## Acceptance Criteria

Pure, deterministic unit tests against a fake event bus and a fake/mock audio backend
(recording `play(cueId, gain, pan, bus)` / `stop(voiceId)` calls instead of touching real
audio hardware) — no wall-clock time beyond simulated `t` inputs, no RNG, no rendering.

**Read-only, non-blocking contract (Rule 1)**
- **GIVEN** the Audio System is subscribed to a fake Combat Resolution event stream, **WHEN** any event is dispatched, **THEN** no call is made back into Combat Resolution or Turn & Phase Manager, and no `Board` mutation method is ever invoked by the Audio System.
- **GIVEN** a burst of 100 events dispatched synchronously, **WHEN** processed, **THEN** total dispatch-to-cue-lookup time is within the Performance Budget (below) and no event causes an unhandled exception.

**Event router / missing cue (Rule 2, Edge Cases)**
- **GIVEN** an event type with no entry in the Event → Cue Mapping table, **WHEN** dispatched, **THEN** no `play()` call occurs, no exception is thrown, and (dev build) a `missing_cue_mapping` warning is logged exactly once per occurrence.

**Preview isolation (Rule 3)**
- **GIVEN** a fake event bus that only ever carries events produced by `resolve()` calls made against the live board (Combat Resolution's committed path), **WHEN** any sequence of events is dispatched, **THEN** every event is routed normally — the Audio System performs no preview/commit discrimination of its own, since Move Preview's dry-run events structurally never appear on this bus (`move-preview.md`, per `cross-system-contracts.md` §7).
- **GIVEN** a test double simulating a Move Preview hover-driven dry-run producing events (an out-of-contract scenario, since Move Preview guarantees this never happens), **WHEN** exercised in isolation, **THEN** this is documented as outside the Audio System's responsibility to filter — any such leak would be a Move Preview contract violation to catch in Move Preview's own tests, not an Audio Event Router bug.

**Voice priority and stealing (Rule 4, Formula F1)**
- **GIVEN** a bus at `V_max` with 6 Normal + 2 Critical voices playing, **WHEN** a new Critical cue is requested, **THEN** the oldest Normal voice is stopped and the new cue plays (`PLAY`).
- **GIVEN** a bus full of 8 Critical voices, **WHEN** a new Normal cue is requested, **THEN** the request returns `DROP` and no existing voice is stopped.
- **GIVEN** a bus with free capacity, **WHEN** any cue is requested, **THEN** it plays immediately with no stealing evaluated.

**Coalescing (Rule 5, Formula F2)**
- **GIVEN** 5 identical-cue events within `coalesce_window_ms` and `K=3`, **WHEN** processed, **THEN** exactly 3 voices are spawned with gains `base_gain_db`, `base_gain_db - 4`, `base_gain_db - 8` (default `attenuation_db_per_step`), and instances 4–5 spawn no voice.
- **GIVEN** the same 5 events spread more than `coalesce_window_ms` apart, **WHEN** processed, **THEN** all 5 spawn full-gain voices (each starts a fresh window).

**Deterministic variants (Rule 6, Formula F3)**
- **GIVEN** a cue with `variantCount=3` played 4 times in one battle, **WHEN** the selected variant is recorded each time, **THEN** the sequence is exactly `[1, 2, 3, 1]`.
- **GIVEN** a new battle starts (`Setup`), **WHEN** the same cue is played, **THEN** its variant counter has reset to select variant `1` first, regardless of the previous battle's ending counter value.
- **GIVEN** identical event sequences replayed on two fresh instances, **THEN** the selected-variant sequence is byte-identical both times (determinism smoke test).

**Bus / ducking (Rules 7–8, Formula F4)**
- **GIVEN** a Critical cue fires at `t=0` with default duck knobs, **THEN** sampled Music-bus gain equals `0dB` at `t=0`, `-6dB` at `t=50ms` through `t=150ms`, and linearly returns to `0dB` by `t=550ms`.
- **GIVEN** a second Critical cue fires at `t=120ms` (inside the first's hold window), **WHEN** the envelope is sampled afterward, **THEN** it resets to a fresh attack from the gain value held at `t=120ms`, extending — not stacking below — the duck floor.
- **GIVEN** a Normal-priority cue fires, **THEN** no ducking envelope is triggered.

**Adaptive music (Rules 9–10, Formula F5)**
- **GIVEN** `lethalThreats=2`, `heroHPMissingPct=0.375`, default weights, **THEN** `tension` computes to `0.55` and `layerIndex=1` (Alert).
- **GIVEN** a tension recompute changes `layerIndex`, **WHEN** the new state is entered, **THEN** the corresponding stem set fades in/out over `music_crossfade_ms`, and the persistent pad stem never stops.
- **GIVEN** any event other than `Telegraph Phase` completion or `EndCheck`, **THEN** tension is not recomputed (verified by a mid-phase event that would change `heroHPMissingPct` producing no immediate `layerIndex` change until the next valid recompute point).

**Panning (Rule 13, Formula F6)**
- **GIVEN** `grid_width=8` and a tile-targeted event at `col=0`, **THEN** computed `pan = -1.0`.
- **GIVEN** the same setup at `col=7`, **THEN** `pan = 1.0`; at `col=3`, `pan ≈ -0.143`; at `col=4`, `pan ≈ 0.143`.

**Undo/redo (Rule 14, Edge Cases)**
- **GIVEN** an `action_applied` event whose SFX voice is still playing, **WHEN** the matching `action_undone` fires, **THEN** that voice receives a stop-fade call within 80ms and the "undo" cue plays.
- **GIVEN** the same action is re-applied (`action_applied` again) after being undone, **THEN** its SFX plays again from the start, with no memory of the prior play blocking it.

**Ordering (Rule 12)**
- **GIVEN** two events dispatched in a specific order by Combat Resolution, **WHEN** processed, **THEN** the recorded `play()` call order matches the dispatch order exactly, even if the later event has higher priority (priority affects voice-stealing outcome, not processing order).

**Muted / zero-volume (Edge Cases)**
- **GIVEN** Master bus gain set to `-∞` (muted), **WHEN** the same event sequence as an unmuted run is processed, **THEN** every internal formula (F1–F6) produces identical outputs and identical `play()` call records (only the final audible gain differs) — proving mute is a pure output-stage multiplier, not a logic short-circuit.

### Performance Budget (headless TS benchmarks, decoupled from actual audio playback)

| Operation | Budget | Note |
|-----------|--------|------|
| Single event → cue lookup + router dispatch | avg < 0.05 ms | Static map lookup, no allocation on the hot path |
| Voice request (allocate or steal, Formula F1) | avg < 0.05 ms | Bounded by `V_max` (≤32) linear scan for the steal candidate |
| Full event batch for one hero/enemy action (~1–10 events, mirrors Combat Resolution's per-action primitive count) | < 1 ms | Matches Combat Resolution's own per-action budget so Audio never becomes the turn's bottleneck |
| Tension recompute (Formula F5) | < 0.1 ms | Runs at most twice per turn (Telegraph Phase, EndCheck) |

## Visual/Audio Requirements

### Sonic Palette

**Overall direction:** clean, punchy, slightly stylized-synthetic rather than
gritty-realistic — matching "Legible Battlefield"'s high-contrast, silhouette-first,
clarity-over-spectacle visual philosophy. **Sparse, not dense**: the mix should have
headroom for every individual event to be heard distinctly, even during a busy turn
(reinforced mechanically by Formula F2's coalescing). Reference palette: **Into the
Breach** (Ben Prunty) for its confident, mechanical, uncluttered mix and its restraint
during high-stakes moments; **Tactical Breach Wizards** and **Slay the Spire** for
short, punchy tension stingers that never overstay their welcome.

**SFX character:** short, transient-forward, clearly pitched-or-noise-based per verb
family (not blended) so a player could plausibly identify *which* verb just fired with
eyes closed — this directly mirrors the visual "one accent color per verb-family" rule
(game-concept.md) as a "one sonic signature per verb-family" rule:
- **Push-family verbs** (shove, charge): a short, weighty impact + a rising whoosh on
  the displaced tiles.
- **Pull-family verbs**: a short, descending "reel-in" tone.
- **Swap-family verbs**: a bright, symmetrical two-note chime (both units "ping" at the
  same instant, reinforcing the atomic nature of `swap`).
- **Wall/zone-family verbs**: a solid, low thud + a short sustain tail (a wall reads as
  "placed," not "impacted").
- **Damage/collision**: crisp, transient impacts scaled by context (collision vs. direct
  damage vs. hazard tick get distinct timbres so the player can tell *why* HP dropped by
  ear alone, without it being the sole source of that information per Rule 11).

### Music Direction

| Context | Music state | Instrumentation | Notes |
|---------|-------------|------------------|-------|
| Battle setup / pre-Turn-1 | Calm (thin) | Sparse mallet/pad only | Establishes the "puzzle, not action scene" tone before the player has even acted |
| Player Phase, low tension (`layerIndex=0`) | Calm | Pad + occasional mallet accent | Deliberately unmelodic/ambient — must not distract from reading the board |
| Player/Enemy phases, mid tension (`layerIndex=1`) | Alert | + light percussion layer | Tempo implied but not locked to a hard beat (avoids clashing with the player's own thinking pace) |
| High tension (`layerIndex=2`) | Critical | + tension layer (tremolo strings or a synth drone swell) | Never uses jump-scare stings — tension is sustained, not spiked, respecting Pillar #1 (nothing should feel like a "gotcha") |
| `battle_ended(Victory)` | VictoryStinger | Short, resolving major-key one-shot | Confirms the read was correct — a reward, not a fanfare that overstays |
| `battle_ended(Defeat)` | DefeatStinger | Short, unresolved/minor one-shot | Communicates "here's what to reconsider," not punishment |

Music is authored as **stems**, not full mixed tracks (Rule 10): one project per battle
context, with a pad stem, a percussion stem, and a tension stem, all tempo/key-locked so
any subset can play together without phasing or beat-misalignment.

### Audio Event Architecture (representative sample)

The full event → cue catalog is authored by `sound-designer`; this table is a
representative sample establishing the pattern, not the complete list.

| Event (from Combat/Turn) | Cue ID | Bus | Priority |
|---|---|---|---|
| `DamageApplied` (direct) | `sfx_combat_impact_medium_##` | SFX | Critical |
| `CollisionResolved` (kind: Unit/Wall/Edge) | `sfx_combat_collision_##` | SFX | Critical |
| `HazardApplied` (Fire tick) | `sfx_combat_burn_tick_##` | SFX | Normal |
| `UnitRemoved` | `sfx_combat_unit_defeated_##` | SFX | Critical |
| `HazardSpawned` | `sfx_combat_hazard_set_##` | SFX | Normal |
| `TerrainSet` (wall built, hero verb) | `sfx_combat_wall_place_##` | SFX | Normal |
| `UnitSpawned` (on-death brood) | `sfx_combat_spawn_##` | SFX | Normal |
| `intents_telegraphed` (new lethal threat) | `sfx_telegraph_lethal_reveal_##` | SFX | Critical |
| `intents_telegraphed` (non-lethal) | `sfx_telegraph_minor_reveal_##` | SFX | Normal |
| `action_applied` (generic move) | `sfx_combat_move_step_##` | SFX | Normal |
| `action_undone` | `sfx_ui_undo_##` | UI | Normal |
| `enemy_spawned` | `sfx_combat_spawn_##` | SFX | Normal |
| `battle_ended(Victory)` | `mus_battle_victory_stinger` | Music | Critical |
| `battle_ended(Defeat)` | `mus_battle_defeat_stinger` | Music | Critical |
| `hover` (Input & Selection ✅) | `sfx_ui_hover_##` | UI | Ambient |
| `confirm` (Input & Selection ✅) | `sfx_ui_confirm_##` | UI | Normal |

### Mix Strategy

**Bus hierarchy:** `Master ← {Music, SFX, UI, Ambience}`. Each bus has an independent
gain stage (Settings-controlled) feeding a shared **soft-knee limiter on Master** (
threshold -1 dBTP) to prevent clipping when many coalesced-but-still-audible voices
(Formula F2) stack. **Volume hierarchy, loudest to quietest at default gains:**
Critical SFX > Music (unducked) > Normal SFX > UI > Ambience — this ordering, combined
with ducking (Formula F4), is what guarantees "the player must always hear
gameplay-critical audio" (this document's core mix mandate).

**Frequency balance:** Music occupies low-mid/pad frequency space by design
(instrumentation choice, not EQ trickery) so SFX transients (mid/high, percussive) always
cut through without needing aggressive sidechain compression beyond the ducking already
specified.

### Adaptive Audio Design (summary)

Two independent adaptive axes, both phase-gated (Rule 9), never per-frame:
1. **Phase context** (Turn & Phase Manager) — which stems are even eligible to play
   (e.g. no Ambient bus content during Enemy Resolve if that's judged too noisy —
   authored per-context, not hardcoded here).
2. **Tension score** (Formula F5) — which intensity layer (`Calm`/`Alert`/`Critical`)
   is active within the current phase context.

Both axes recombine into the music state machine in States and Transitions, above.

### Audio Asset Specifications

| Category | Format | Sample Rate | Channels | Loudness Target | File Size Budget |
|----------|--------|-------------|----------|------------------|-------------------|
| SFX (`sfx_*`) | OGG Vorbis, quality ~q6 (~160–192 kbps VBR) | 44.1 kHz | Mono (panned via Formula F6 at runtime) | -18 to -12 LUFS integrated, -1 dBTP ceiling | ≤ 150 KB per one-shot variant |
| UI SFX (`sfx_ui_*`) | OGG Vorbis, q6 | 44.1 kHz | Mono | -20 to -14 LUFS integrated, -1 dBTP ceiling | ≤ 60 KB per one-shot |
| Music stems (`mus_*`) | OGG Vorbis, q8 (~256 kbps VBR) | 44.1 kHz | Stereo | -16 LUFS integrated per stem (pre-mix; combined playback managed by bus gain, not per-stem re-normalization), -1 dBTP ceiling | ≤ 2.5 MB per stem, per loop (target loop length 30–60s) |
| Ambience (`amb_*`) | OGG Vorbis, q6 | 44.1 kHz | Stereo | -24 LUFS integrated (sits well under everything else) | ≤ 800 KB per loop |

**Naming convention** (project standard, applied to VANGUARD contexts):
`[category]_[context]_[name]_[variant].[ext]`
- `sfx_combat_impact_medium_01.ogg`, `sfx_combat_impact_medium_02.ogg`
- `sfx_combat_unit_defeated_01.ogg`
- `sfx_telegraph_lethal_reveal_01.ogg`
- `sfx_ui_button_click_01.ogg`, `sfx_ui_undo_01.ogg`
- `mus_battle_calm_pad_loop.ogg`, `mus_battle_alert_percussion_loop.ogg`,
  `mus_battle_critical_tension_loop.ogg`
- `mus_battle_victory_stinger.ogg`, `mus_battle_defeat_stinger.ogg`
- `amb_battle_room_tone_loop.ogg` (minimal, low-level bed under everything — VANGUARD's
  abstract chess-like board has no environmental storytelling need for dense ambience)

**Variant count guidance:** 2–3 variants for high-frequency cues (moves, common
impacts), 1 variant acceptable for rare/Critical cues (unit defeated, victory/defeat
stingers) where repetition is inherently rare within a single run.

## Open Questions

**Needs an architecture decision (→ ADR during `/create-architecture`):**

1. **Event schema and the `committed` tag (Rule 3).** This document assumes the shared
   event log (already flagged as Open Question #1 in `combat-resolution.md`, jointly
   owned with Rendering/HUD/Audio) will carry a `committed: boolean` field or an
   equivalent mechanism so Audio can filter out Move Preview dry-runs. *Owner:* Tech
   architecture, coordinated with Move Preview, Board Rendering & Juice, Battle HUD once
   those are designed. **Blocking** for Move Preview's audio behavior specifically.
2. **Audio backend choice (Howler vs. raw WebAudio).** This document is backend-agnostic
   (it specifies bus gain, voice pooling, panning, and envelopes as abstract concepts);
   the concrete implementation choice belongs to `lead-programmer`/`technical-director`
   per the Delegation Map, not this GDD.

**Resolved this session (provisional defaults — confirm during implementation):**

3. **Coalescing overflow (>K instances) produces no distinct "cluster" cue in v1** — a
   future `_cluster` variant is a candidate if playtesting shows large AoE turns feel
   under-sold. *Owner:* revisit after Heroes & Abilities' roster (especially any AoE
   verbs) is drafted.
4. **Tension score recompute cadence is fixed at Telegraph Phase completion + EndCheck
   only** (twice per turn max) — chosen for legibility over reactivity. *Owner:*
   revisit if playtesting shows music feels unresponsive within a single busy turn.
5. **Row (vertical board axis) is not mapped to any audio parameter** — only column-based
   panning (Formula F6) is specified. A row-based reverb-send is a possible future
   extension, not designed here.

**Deferred to the owning system's GDD:**

6. **Per-ability `sfx_cue_id` assignment.** Every hero verb and enemy action must supply
   a stable cue ID at authoring time (Interactions with Other Systems). Heroes & Abilities
   and Enemy, Abilities & Telegraph are both ✅ Designed; the remaining work is a contract
   gap in the owning systems — their `AbilityDefinition` schema does not yet carry an
   `sfx_cue_id` field — to close via `/consistency-check`, not an open design question here.
7. **`lethalThreats` source query (Formula F5).** Now canonical: Enemy, Abilities &
   Telegraph (✅ Designed) exposes `telegraphedLethalThreatCount(turn)` per
   `cross-system-contracts.md` §9 (resolving C4), which Formula F5 sources directly. The
   only remaining item is a field-level contract gap — that query is not yet surfaced in
   `enemy-abilities-and-telegraph.md`'s own published interface — flagged for
   `/consistency-check`, not an open design question here.
8. **Input & Selection's UI event vocabulary** (hover/select/cancel/confirm) is now
   confirmed against `input-and-selection.md` (✅ Designed) — those are its actual emitted
   events (Interactions with Other Systems), so the sample Event → Cue table's UI event
   names are canonical, not placeholders. No open question remains.
9. **`turn-and-phase-manager.md`'s Downstream table gap** (flagged in Dependencies,
   above) should be corrected to list Audio System when that document is next revised,
   to keep bidirectional consistency exact. *Owner:* flag via `/consistency-check`.
10. **Settings / Options' concrete slider UI and default volume values** are owned by
    that system (Alpha tier); this document only specifies the `setBusGain(bus, db)`
    contract it must call.
