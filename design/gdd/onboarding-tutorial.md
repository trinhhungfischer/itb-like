# Onboarding / Tutorial

> **Status**: In Design
> **Author**: workflow (design-system fan-out)
> **Last Updated**: 2026-07-27
> **Implements Pillar**: #5 Read in Ten Seconds; #1 Perfect Information, Perfect Blame; #3 Variety Lives in the Draft, Not the Dice

## Overview

Onboarding / Tutorial is the player's first ten minutes with VANGUARD: a short,
fixed sequence of three hand-authored **Tutorial Missions** — small, real
battles (not a simulated or scripted-video experience) that teach the
**read → plan → act** loop one hero verb at a time, on progressively larger
boards, with deliberately obvious telegraphs. It never invents a second
simulation or a stripped-down "practice mode" — every tutorial battle runs
through the exact same Board & Grid, Turn & Phase Manager, Combat Resolution,
Heroes & Abilities, and Enemy, Abilities & Telegraph systems a real run uses,
so nothing the player learns is a lie they'll have to unlearn later. This
system's only additions are content (three fixed, non-procedural battle
templates) and a thin, non-authoritative **coaching layer** — a sequence of
**Tutorial Beats** that watch already-public state for a taught action and
surface a contextual hint, on a strict discovery-led timer, if the player
hasn't found it yet. Onboarding never disables a legal action, never blocks
battle progression on its own coaching state, and never punishes a mistake
during the tutorial the way a real battle would — it exists to build the
player's confidence in the deterministic, fully-telegraphed core loop before
handing them a real run, directly serving Pillar #5 (a player who has been
taught to read the board in ten seconds trusts every future battle) and
Pillar #1 (the tutorial's own failures are always disclosed and recoverable,
never a silent trap).

## Player Fantasy

**"I already understand this game."** The first ten minutes should feel like
the moment a new chess player is shown how a knight moves and immediately
sees three ways to use it — not a lecture, a discovery. The player's fantasy
here is competence arriving fast: by the end of Mission 1 they trust the
board is fully legible; by the end of Mission 2 they've personally executed a
kill with zero damage dealt (a shove into a chasm), which is the single
clearest demonstration of Pillar #2 (Positioning Over Power) the game can
offer; by the end of Mission 3 they've solved a two-hero, two-threat puzzle
unassisted, which is the exact "aha!" beat `game-concept.md`'s Core Loop
names as the moment-to-moment hook. This system's failure state is a tutorial
that either patronizes an experienced strategy player (over-explaining,
blocking input, refusing to let them just try things) or abandons a genuinely
new player at the first unfamiliar UI element with no recourse — either one
replaces "I already understand this game" with "this game doesn't trust me"
or "I don't understand this game," both of which cost the exact retention
hook (`game-concept.md`'s "Investment") the whole meta-layer depends on. The
`Skip Tutorial` affordance (Rule 10) exists specifically to protect the first
failure mode; the discovery-led hint escalation (Rule 5, Formula F2) exists
specifically to protect the second.

## Detailed Design

### Core Rules

1. **Ownership boundary.** Onboarding owns: the content of the three Tutorial
   Missions (fixed, hand-authored Board + Loadout + enemy layouts — Rule 9),
   the Tutorial Beat sequencing/state machine, Tutorial Callout content and
   trigger/completion logic, the one-time Skip offer and its persistence, and
   non-punishing retry behavior scoped to tutorial battles only (Rule 8). It
   does **not** own: battle simulation, legality, HP, telegraphs, or win/lose
   evaluation (those remain Combat Resolution's, Heroes & Abilities', Enemy,
   Abilities & Telegraph's, and Objective / Win-Lose's respectively, entirely
   unmodified for a tutorial battle), the selection/input state machine
   (Input & Selection's), or the pixel rendering of any callout/spotlight
   visual (proposed as a Board Rendering & Juice interface, Rule 13 — flagged
   PROVISIONAL). Onboarding is a read-only observer of every gameplay system
   it teaches, plus exactly one narrow write path: loading a Tutorial Battle
   Template and (Rule 8) restarting one on tutorial-scoped Defeat.
2. **Exactly three Tutorial Missions, run back-to-back, before the player's
   first real run.** Each Mission is a complete, playable battle built from a
   fixed **Tutorial Battle Template** (Rule 9), teaching one primary
   concept: **M1 "Read"** (the board, HP, telegraph, End Turn — no ability use
   required), **M2 "Act"** (the Move + Ability action economy and one hero
   verb), **M3 "Plan"** (two heroes, two simultaneous telegraphed threats, one
   turn that must answer both at once). This maps directly to
   `game-concept.md`'s stated onboarding curve ("first battles introduce one
   hero verb at a time on small boards with obvious telegraphs; the first 10
   minutes teach read → plan → act") and its own Formula F3 validates the
   ~10-minute budget. `tutorial_mission_count` is fixed at 3 (Tuning Knobs —
   intentionally not a scaling knob).
3. **Board size ramps toward the real default.** M1 uses a 5×5 board, M2 a
   6×6 board, M3 the full default **8×8** (`grid_width`, `grid_height`) —
   each a legal per-battle override of Board & Grid's own board-size tuning
   knob (documented safe range 5–12 elsewhere in this project). This is a
   deliberate legibility ramp (Pillar #5): the smallest, least-cluttered
   board teaches pure reading; by M3 the player is already standing on the
   exact board size every real battle will use, so the transition into their
   first real run introduces zero new spatial scale to learn.
4. **Tutorial Beat schema.** A `TutorialBeat` is: `{ id, missionId, order
   (int, ascending within a mission), class: Gate | Callout,
   triggerPredicate, completionPredicate, calloutContent: { text (≤
   `tutorial_callout_max_chars`), anchor: ScreenRegion | TileRef |
   HUDZoneRef }, spotlightTarget?: TileRef | HUDZoneRef,
   authoredDurationEstimateSeconds }`. Both predicates are pure, read-only
   functions of already-public state (Turn & Phase Manager's phase/turn,
   Heroes & Abilities' action-slot state, the Combat Resolution event log,
   Objective's `EvaluationResult`) — a Beat never introduces new gameplay
   state of its own, mirroring Battle HUD's own "invents no new gameplay
   state" boundary.
5. **Two Beat classes; only one Gate Beat exists in the whole sequence.**
   **Gate** beats block progression and show their full content immediately,
   no discovery window — reserved for exactly one Beat: the session-opening
   Play/Skip choice (Rule 10), which occurs before any battle exists and
   therefore never contends with Input & Selection's state machine. Every
   other Beat in all three Missions is **Callout**: non-blocking, and paced
   by the discovery-led hint-escalation timer (Formula F2) — Tier 0 (silent
   watching, the player is given a genuine chance to find the action alone),
   Tier 1 (a spotlight/dim visual nudge only, no text), Tier 2 (spotlight +
   a short explicit callout). A Callout Beat can complete at any tier,
   including Tier 0, the instant its `completionPredicate` fires — reaching
   Tier 2 is not a requirement for anything, only the ceiling of how much
   help is ever offered unprompted.
6. **No hard input gating, ever.** Onboarding never disables, hides, or
   restricts a legal action reachable through Input & Selection or Heroes &
   Abilities during a Callout Beat — every action a real battle would permit
   remains permitted throughout every Tutorial Mission. Where a Mission's
   pacing needs an earlier concept taught before a later one becomes
   *relevant*, Onboarding achieves this exclusively through **battle
   content**, never through a restriction mechanism: M1's single enemy is
   placed outside every deployed hero's ability range (so the Ability slot
   naturally reads `Unavailable — No Legal Target`, per
   `heroes-and-abilities.md` Rule 8/Formula F2 — an already-designed,
   already-legible state this document reuses verbatim rather than inventing
   a tutorial-only lock).
7. **Adaptive, retroactive completion — the discovery-led guarantee.** If the
   player performs an action that independently satisfies a later Beat's
   `completionPredicate` before that Beat (or an earlier structurally-implied
   Beat in the same Mission) ever reached Tier 1, every Beat whose predicate
   is now satisfied is marked `Completed` in the same evaluation pass
   (Formula F4) — none of them ever display a hint for an action the player
   has already, visibly, correctly performed. This is the mechanical
   guarantee behind this system's "discovery-led" framing: Onboarding
   recognizes competence, it never demands the player *prove* they read the
   hint by performing the action again in a specific order.
8. **Non-punishing tutorial Defeat.** While a Tutorial Mission is `Active`,
   Onboarding subscribes to Objective / Win-Lose's terminal
   `EvaluationResult`. If `status == Defeat` fires for a tutorial battle
   specifically, Onboarding intercepts it *before* any real-run consequence
   would apply (there is none — Tutorial Missions are never part of a Run
   Save, Rule 9) and immediately reloads the same Tutorial Battle Template
   fresh (Mission state: `Active → Retrying → Active`, States and
   Transitions), with neutral, non-blaming framing ("Let's try that
   differently") rather than a real battle's Defeat banner
   (`objective-and-win-lose.md`'s Visual/Audio Requirements). All Beats in
   that Mission reset to `Pending` on retry — but Rule 7's adaptive
   completion means any Beat the player already demonstrated understanding
   of before the reset re-completes instantly on the first repeat action,
   costing no extra hint-watching time.
9. **Tutorial Battle Templates are hand-authored, fixed content that bypasses
   Encounter Generator entirely.** Each of the three battles (Loadout,
   deployment tiles, enemy archetypes/placement, `ObjectiveConfig`) is
   authored directly by this system as static data, not generated — matching
   the same "hand-tuned, not proc-genned" quality bar `systems-index.md`
   already flags as Encounter Generator's own high-risk mitigation strategy,
   applied here from day one since a first-time player's tutorial battles
   must be perfectly solvable and perfectly legible, not merely "usually
   good." This deliberately decouples Onboarding from Encounter Generator's
   (Vertical Slice-tier, Designed — `encounter-generator.md`) procedural
   pipeline — Tutorial Battle Templates remain hand-authored static data by
   design intent, not because that system is unavailable, since a
   first-time player's tutorial battles must be perfectly solvable and
   perfectly legible on every playthrough, a bar procedural generation does
   not guarantee. **Illustrative content**
   (concrete, not placeholder): M2 teaches **Vanguard's Shove** (per
   `heroes-and-abilities.md`'s reference kit) against a `Charger`-archetype
   enemy (per `enemy-abilities-and-telegraph.md`) standing one tile from a
   Chasm tile — the canonical "kill with zero damage" demonstration
   `game-concept.md`'s Unique Hook names directly. M3 adds **Twinblade's
   Blink Swap** alongside Vanguard, against two simultaneously telegraphing
   enemies (`Charger` + `Lobber`), so the capstone puzzle is "shove one
   threat off the board while swapping an endangered ally out of the other's
   telegraphed tile in the same turn" — a direct, playable instance of the
   Core Loop's own stated moment-to-moment description.
10. **One-time Skip offer, presented before Mission 1 begins.** The session's
    Gate Beat presents exactly two choices, both fully legible with no
    hidden default: `Play Tutorial` and `Skip Tutorial`. Skip is
    unconditionally honored — no confirmation dialog, no "are you sure,"
    respecting an experienced player's time per this document's own Player
    Fantasy failure-mode analysis. Either choice writes the completion flag
    once (Rule 11) and is never re-offered automatically in a later session.
11. **Completion persistence.** On `Skip` or on the terminal `Victory` of
    Mission 3, Onboarding writes `{ tutorialCompleted: true,
    tutorialSkipped: boolean }` to the Meta Save. These two fields are **not
    a standalone Onboarding-owned schema extension** — they are canonically
    defined on `meta-progression-and-unlocks.md`'s **`MetaStatistics`**
    record (the single Meta Save payload), which owns their shape; Onboarding
    only *writes* them through Run Persistence's `mergeUnlocksIntoMeta`-shaped
    write contract, and reads them back via `loadMeta().tutorialCompleted`.
    (Their presence on the canonical schema is confirmed in
    `meta-progression-and-unlocks.md`; any residual `/consistency-check` flag
    is a reconciliation of Run Persistence's published schema against that
    owner, not an independent field proposal by this document.) Per-mission
    progress
    (`missionsCompleted: MissionId[]`) is tracked only in-memory for the
    duration of one Tutorial Session (Rule 14's Edge Case on browser close)
    — it is not itself a Meta Save field, only the final boolean is.
12. **Optional replay, never mid-run.** Once `tutorialCompleted == true`, a
    `Replay Tutorial` entry point is available from a non-battle menu context
    (**PROVISIONAL** — the exact menu surface belongs to Settings / Options,
    Alpha tier, undesigned). Replay reruns the identical three Missions and
    Beats with replay-specific Gate Beat copy, but never re-writes
    `tutorialCompleted` (already `true`) and is never offered or triggered
    while a Run Save is active — a replay session and a real run are never
    concurrent.
13. **Tutorial Callout rendering — a new, flagged overlay contract.**
    Onboarding owns callout *content* (text, anchor, spotlight target) and
    *timing* (Rule 5, Formula F2); it does not render pixels. The callout
    bubble and the board-dim/spotlight visual are proposed as a new
    interface on Board Rendering & Juice ✅ (Status: Designed), composited
    above that system's existing layers and above Battle HUD chrome
    (mirroring the HUD-above-Rendering layer-order precedent `battle-hud.md`
    Rule 13 already establishes) — **reconciled against
    `board-rendering-and-juice.md`'s published 9-layer stack (Core Rule 2)
    and its Core Rule 1 scope statement ("does not own HUD elements") in
    this pass: no existing layer covers a callout bubble or board-dim/
    spotlight overlay. The interface is confirmed genuinely absent, not
    merely unread — it is a real new-interface addition (a proposed 10th
    layer or HUD-chrome-adjacent overlay), flagged as a Required ADR during
    `/create-architecture`** (see Open Questions).
14. **First-session auto-trigger is a strict conjunction, never a forced
    interrupt.** The Tutorial Session auto-launches only when **both**
    `loadMeta().tutorialCompleted !== true` **and** `loadRun() == Empty`
    (`run-persistence.md`'s Load flow) hold at boot. A returning player with
    a corrupted/reset Meta Save (that document's own Edge Cases) but a
    `Valid` Run Save is never force-tutorialized mid-run — Rule 8's
    intercept scope and this rule together guarantee Onboarding can never
    interrupt or overwrite in-progress run state.
15. **Zero new determinism surface.** Tutorial battles use the exact same
    deterministic Combat Resolution, Turn & Phase Manager, and telegraph
    pipeline as any real battle — no RNG is introduced anywhere in this
    system, consistent with Pillar #3. The only things unique to a tutorial
    battle are (a) its content is fixed rather than generated (Rule 9) and
    (b) the coaching layer described above; the simulation itself is
    indistinguishable from a real battle from Combat Resolution's point of
    view.

### States and Transitions

**Tutorial Session state** (one per browser session, gated by Rule 14):

`NotStarted → GateOffered → { InProgress(missionIndex=1) | Skipped }` →
(if `InProgress`) `InProgress(1) → InProgress(2) → InProgress(3) →
Completed`.

`Skipped` and `Completed` are both terminal and both set
`tutorialCompleted = true` (Rule 11); `Skipped` additionally sets
`tutorialSkipped = true`. A later `Replay Tutorial` invocation (Rule 12)
re-enters at `GateOffered` (replay framing) without resetting either flag.

**Mission state** (per Mission, only meaningful while the Tutorial Session is
`InProgress`):

| State | Entered when | Exits to |
|---|---|---|
| `NotStarted` | Session enters this Mission's index | `Active` (battle template loads, Turn & Phase Manager Setup runs) |
| `Active` | Template loaded, Turn 1 begins | `MissionComplete` (Objective terminal `Victory`) or `Retrying` (Objective terminal `Defeat`, Rule 8) |
| `Retrying` | Tutorial-scoped Defeat intercepted | `Active` (template reloads fresh; all this Mission's Beats reset to `Pending`) |
| `MissionComplete` | Victory | Next Mission's `NotStarted`, or (after Mission 3) Session `Completed` |

**Beat state** (per Beat instance, reset every time its owning Mission
re-enters `Active` from `NotStarted` or from `Retrying`):

`Pending → Armed → Completed`. `Pending → Armed` when `triggerPredicate`
first evaluates `true`. While `Armed`, the hint tier escalates
`0 → 1 → 2` per Formula F2 (Gate Beats skip directly to full Tier-2-equivalent
content per Rule 5). `Armed → Completed` the instant `completionPredicate`
evaluates `true`, at any tier, cancelling any in-flight escalation; no
`Completed → Armed` transition exists **except** the Undo-invalidation case
in Edge Cases, which is the one path that reverts a specific Beat backward
without a full Mission retry.

### Interactions with Other Systems

Onboarding is a **read-only coordinator with one narrow write path** (loading
and, on tutorial-Defeat, reloading a Tutorial Battle Template) plus one
persistence write (Rule 11).

| System | Onboarding reads | Onboarding writes / provides | Ownership boundary |
|---|---|---|---|
| **Turn & Phase Manager** ✅ | `currentPhase`, `currentTurn`, phase-boundary events; the battle Setup entry point used to load a Tutorial Battle Template (**PROVISIONAL** — exact bootstrap contract not pinned by any document yet, mirrors `heroes-and-abilities.md`'s own flagged deployment-zone gap) | Invokes battle Setup/reload for tutorial content only | Manager owns phase sequencing for every battle including tutorial ones; Onboarding never bypasses it |
| **Combat Resolution** ✅ | Full event log — canonical events (`design/architecture/cross-system-contracts.md` §1): `DamageApplied`, `DisplacementComplete`, `CollisionResolved`, `SwapComplete`, `HazardSpawned`, `HazardApplied`, `UnitRemoved`, `TerrainSet`, `UnitSpawned` — Beat `triggerPredicate`/`completionPredicate` (Formula F1) read this log directly to detect a taught action (e.g. M2's "use Shove" Beat completes on a `DisplacementComplete` event sourced from Shove followed by a `UnitRemoved` event for the Charger) | — | Combat owns *what happened* and its event vocabulary is ground truth for every Beat predicate; Onboarding never calls `resolve()` itself and never mutates the event log |
| **Objective / Win-Lose** ✅ | Terminal `EvaluationResult` (`status`, `reason`), scoped to tutorial battles only | — | Objective's verdict logic is completely unmodified; Onboarding only intercepts the *consequence* of a tutorial-scoped Defeat (Rule 8), never the verdict itself |
| **Heroes & Abilities** ✅ | Action-slot state (`Available`/`Used`/`Unavailable — No Legal Target`), `legalMoveTiles`/`legalTargets` — read to evaluate Beat predicates and to author M1's out-of-range enemy placement (Rule 6) | — | Read-only; Onboarding never grants, restricts, or overrides legality |
| **Enemy, Abilities & Telegraph** ✅ | `Intent`/`telegraphedEffectTiles`/`telegraphedMoveDestination` — read to anchor callout copy to specific tiles/enemies (e.g. "this enemy will hit this tile next turn") | — | Read-only |
| **Battle HUD** ✅ | Zone taxonomy (Zone A–F identifiers, `battle-hud.md` Rule 2) — a Beat's `calloutContent.anchor` / `spotlightTarget` may reference a `HUDZoneRef` (e.g. spotlighting Zone C's Ability Bar for the "use Shove" Beat); otherwise the HUD renders exactly as it would in any real battle and Onboarding neither modifies nor reads its runtime values | — | **Soft** — the HUD is intentionally unaware a tutorial is running (Rule 15 — indistinguishable simulation); Onboarding only borrows HUD's published zone identifiers to anchor callouts, never HUD's live state |
| **Input & Selection** | Hover/select/commit event stream (the same stream Move Preview and Battle HUD consume) to evaluate Beat trigger/completion predicates | — | Read-only, never restricts or intercepts input (Rule 6) |
| **Move Preview** | `Ready` preview state, to time a callout so it never references an action the player hasn't yet been shown can be previewed (e.g. never says "commit this" before a Ready preview exists) | — | Read-only, **Soft** |
| **Board Rendering & Juice** *(interface proposed, not confirmed — Rule 13)* | — | Tutorial Callout content (text, anchor, spotlight target) for that system to render as a bubble + dim/spotlight visual | Onboarding owns *what* to show; Rendering owns *how* — same content/pixel split precedent `battle-hud.md` Rule 6 already established for telegraph icons |
| **Run Persistence** ✅ | `loadMeta().tutorialCompleted` (Rule 14's auto-trigger gate), `loadRun()` status | Writes `{tutorialCompleted, tutorialSkipped}` into Meta Save (**PROVISIONAL** schema addition, Rule 11) | Persistence owns storage/versioning mechanics; Onboarding owns the payload's meaning, matching that document's own stated co-ownership model |
| **Audio System** | — | Exposes distinct events (`tutorial_hint_tier1_shown`, `tutorial_hint_tier2_shown`, `tutorial_beat_completed`, `tutorial_mission_complete`) for optional SFX mapping | **Soft**, matches Battle HUD's own "audio hooks only" pattern |
| **Encounter Generator** ✅ | — (explicitly not consulted, Rule 9) | — | Deliberate non-dependency — the tutorial's content pipeline is independent of that Designed, Vertical-Slice-tier system (`encounter-generator.md`) by deliberate design choice, not because it is unavailable |

> **Provisional (not-yet-confirmed interfaces):** Board Rendering &
> Juice's callout/spotlight interface (Rule 13) and Turn & Phase Manager's
> exact battle-bootstrap entry point (Rule 9/14) are proposed contracts, not
> confirmed against those documents' current published state in this
> authoring pass. Run Persistence's Meta Save schema addition (Rule 11) is
> likewise proposed. All three name systems that are already Designed —
> the gap is an unconfirmed interface detail, not a missing GDD — and all
> three are flagged for `/consistency-check`.

## Formulas

All formulas are deterministic (no RNG, no wall-clock dependence beyond an
explicitly-modeled idle timer). Examples use the M2 Tutorial Battle Template
(6×6 board, Vanguard + Shove) and default knob values unless stated.

### F1. Beat Completion Evaluation

```
evaluateBeat(beat, battleState, eventLog):
  if beat.state == Pending and beat.triggerPredicate(battleState, eventLog):
    beat.state = Armed
    beat.armedAtPlayerPhaseTicks = 0
  if beat.state == Armed and beat.completionPredicate(battleState, eventLog):
    beat.state = Completed
  return beat.state
```

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| beat | `beat` | TutorialBeat | — | The Beat instance being evaluated |
| battle state | `battleState` | (board, units, phase, turn) | — | Same shape consumed by Objective / Win-Lose |
| event log | `eventLog` | Combat Resolution event list | — | Since the current Mission's `Active` entry (or since the last `Retrying → Active` reset) |
| output | Beat `state` | enum | `{Pending, Armed, Completed}` | Recomputed every frame the Mission is `Active` |

**Output:** exactly one of three states. **Worked example (M2's "use
Shove" Beat):** `triggerPredicate = (Vanguard.abilitySlot ==
'Available' AND legalTargets(Vanguard, Shove) ≠ ∅)` → becomes `Armed` the
moment the Charger enters Shove's range 1. `completionPredicate =
(eventLog contains a DisplacementComplete event sourced from Shove, followed
by a UnitRemoved event for the Charger)` — using Combat Resolution's
canonical event names (`design/architecture/cross-system-contracts.md` §1;
there is no `push_resolved` event) — → becomes `Completed` the instant the
player executes the taught action, regardless of which hint tier (0, 1, or 2)
was showing at that moment.

### F2. Hint Escalation Tier

```
hintTier(t_idle) =
  0 (None)      if t_idle < tutorial_hint_delay_ms
  1 (Spotlight) if tutorial_hint_delay_ms ≤ t_idle < tutorial_hint_delay_ms + tutorial_hint_escalation_ms
  2 (Explicit)  if t_idle ≥ tutorial_hint_delay_ms + tutorial_hint_escalation_ms
```

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| idle time | `t_idle` | ms | ≥0 | Time accumulated since this Beat became `Armed`, **counted only while Turn & Phase Manager reports `PlayerPhase`** — animation/resolution time never counts against the player |
| hint delay | `tutorial_hint_delay_ms` | ms | 2000–15000 (Tuning Knobs, default 6000) | Grace window with zero hint, protecting discovery |
| escalation window | `tutorial_hint_escalation_ms` | ms | 3000–20000 (Tuning Knobs, default 8000) | Gap between Tier 1 (visual-only) and Tier 2 (explicit text) |
| output | `hintTier` | enum (output) | `{0, 1, 2}` | Ceiling of unprompted help — never auto-performs the action for the player |

**Output range:** exactly one of `{0, 1, 2}`. **Worked example:** default
knobs, a Beat `Armed` for 7 seconds of Player-Phase time with no completion
→ `t_idle = 7000ms`, which is `≥ 6000` and `< 6000+8000=14000` →
`hintTier = 1` (a quiet spotlight/dim on the taught tile, no text yet). At
`t_idle = 15000ms` → `hintTier = 2` (spotlight plus the Beat's
`calloutContent.text`). Gate Beat 0 (Rule 5) is exempt from this formula
entirely — it always presents at Tier-2-equivalent content immediately.

### F3. Tutorial Duration Budget (authoring-time guidance)

`totalEstimatedSeconds = Σ beat_i.authoredDurationEstimateSeconds` for every
Beat across all three Missions.

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| per-beat estimate | `authoredDurationEstimateSeconds` | int | 5–90 (content-authoring guidance) | Author's estimate of typical time-to-complete for one Beat, including its own hint-escalation window in the worst case |
| total budget | `tutorial_time_budget_seconds` | int | 300–900 (Tuning Knobs, default 600 = 10 min) | The `game-concept.md`-derived target ("first 10 minutes") |
| output | `totalEstimatedSeconds` | int (output) | unbounded in formula, guidance-checked against the budget | Sum across all active (non-skipped) Beats |

**Output:** an authoring-time signal only — like Battle HUD's Formula F5, it
never truncates or blocks anything at runtime (Edge Cases). **Worked
example:** M1 (5 Beats, avg 25s) = 125s; M2 (4 Beats, avg 35s) = 140s; M3 (5
Beats, avg 45s) = 225s → `totalEstimatedSeconds = 490s ≈ 8.2 minutes`, under
the 600s default budget with margin for a slower first-time player who
triggers several Tier-2 escalations.

### F4. Adaptive Skip (retroactive completion, Rule 7)

```
adaptiveSkip(observedEvent, missionBeats):
  newlyCompleted = { b ∈ missionBeats : b.state ≠ Completed
                       AND b.completionPredicate(currentState, eventLog) }
  for b in sort(newlyCompleted, by=b.order, ascending):
    b.state = Completed   # applied in one evaluation pass, deterministic order
  return newlyCompleted
```

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| observed event | `observedEvent` | Combat Resolution / Input event | — | The action that just occurred |
| mission's beats | `missionBeats` | set of TutorialBeat | 0..N (typically 3–5 per Mission) | All Beats belonging to the current Mission, regardless of current state |
| newly completed | `newlyCompleted` | set (output) | 0..N | Every Beat whose predicate is satisfied by the current state, evaluated fresh, not just the one the player was "supposed" to be on |

**Output:** a set, applied atomically. **Worked example:** in M2, a player
who has never seen the Move tutorial Beat trigger nonetheless moves Vanguard
into Shove range and immediately Shoves the Charger into the Chasm in one
uninterrupted sequence. On the next evaluation pass, both the "use Move" Beat
(`order=1`) and the "use Shove" Beat (`order=2`) find their
`completionPredicate`s already true → both transition `Armed-or-Pending →
Completed` in the same pass, in `order` sequence, with zero hints ever shown
for either.

## Edge Cases

- **A Mission ends in Victory with one or more Callout Beats still
  `Pending`/`Armed`:** legal and expected. Mission completion is governed
  **exclusively** by Objective / Win-Lose's terminal `Victory` — never by
  "all Beats Completed." Onboarding advances to the next Mission (or ends the
  Session) immediately; the unfinished Beat's hint simply never fires. A
  tutorial coaching state must never be able to soft-lock a real battle's
  progression (this is the tutorial-specific application of Pillar #1's "no
  UI mistake" principle).
- **The player Undoes an action that had satisfied a Beat's
  `completionPredicate`:** the predicate is recomputed against the
  post-Undo event log on the next evaluation pass; if the satisfying event
  was rolled back, that specific Beat transitions `Completed → Armed` (the
  one documented exception to the "no `Completed → Armed`" rule in States
  and Transitions) and its hint-escalation timer resumes from `t_idle=0`.
  This never affects Mission-completion (which depends only on Objective's
  verdict, per the edge case above).
- **The player idles indefinitely at Gate Beat 0 (the Play/Skip choice):**
  no hint-escalation timer applies (Rule 5's Formula-F2 exemption) — the
  choice is fully presented with no hidden default and the system simply
  waits; no auto-decision is ever made on the player's behalf.
- **The browser closes mid-Mission (any point after `Active`, before
  `MissionComplete`):** per Run Persistence's own "no mid-battle
  persistence" scope cut (`run-persistence.md` Core Rule 2), the Tutorial
  Session's in-progress mission index and Beat states are **not** persisted.
  On the next load, since `tutorialCompleted` is still `false` and no Run
  Save exists (Rule 14), the Session restarts from `GateOffered` — Mission 1,
  Beat 1 — not a mid-mission resume. This is a disclosed, deterministic
  restart (the same "resume the checkpoint, not the turn" philosophy Run
  Persistence itself uses, applied one level up), not a bug; it is not a
  tuning knob (Tuning Knobs section) because it mirrors that system's own
  fixed scope boundary rather than introducing a new one.
- **A returning player has a corrupted/reset Meta Save (Run Persistence's
  own Edge Case) but a `Valid` Run Save:** Rule 14's strict conjunction means
  auto-trigger does **not** fire — a player already mid-run is never forced
  into a ten-minute tutorial because of an unrelated save-corruption event.
  The tutorial remains reachable only via the optional `Replay Tutorial`
  entry point (Rule 12).
- **Two Beats' predicates become true in the same evaluation pass** (e.g. a
  single Shove action simultaneously satisfies both a "used the Ability
  slot" Beat and a "dealt zero damage but removed a unit" Beat): Formula F4
  applies both completions in the same pass, in ascending `order`, with no
  race condition — evaluation is single-threaded and deterministic like
  every other system in this design.
- **The player deliberately lets an enemy hit a hero during a tutorial
  battle "to see what happens":** no special handling. Objective / Win-Lose's
  normal Ongoing/Defeat rules apply exactly as in a real battle; only a full
  battle-ending `Defeat` triggers Rule 8's Mission Restart — a non-lethal hit
  changes nothing about Beat pacing or Mission state.
- **`totalEstimatedSeconds` (Formula F3) exceeds `tutorial_time_budget_seconds`
  during content authoring:** an authoring-time guidance warning only
  (mirrors Battle HUD's Formula F5 "signal, not enforcement" pattern) — it
  never truncates a Mission, skips a Beat, or otherwise changes runtime
  behavior; it tells a content author to trim Beats or copy.
- **`Replay Tutorial` is invoked while `tutorialCompleted == true`:** allowed
  at any time from a non-battle menu context, never mid-run/mid-battle
  (Rule 12). Replay never re-writes `tutorialCompleted`/`tutorialSkipped`
  and never re-offers the one-time framing of Gate Beat 0 — replay-specific
  copy is used instead, a content difference only, not a new state.
- **A Tutorial Mission's authored enemy placement is later invalidated by an
  edit to Enemy, Abilities & Telegraph's archetype stats** (e.g. `Charger`'s
  `moveRange` changes in a balance pass): out of scope for this document —
  Tutorial Battle Templates are static content that must be re-validated by
  whoever edits archetype data, exactly as any other hand-authored encounter
  would need re-validation; Onboarding has no runtime safeguard against this
  (a solver/validator, if ever built for tutorial content, is future scope —
  Open Questions).
- **Skip is chosen, then the player later starts a real run and loses their
  first real battle immediately, having genuinely needed the tutorial:**
  accepted, disclosed trade-off of Rule 10's "no confirmation dialog"
  design — the `Replay Tutorial` entry point (Rule 12) remains available at
  any time as the recovery path; Onboarding does not re-offer or force the
  tutorial reactively based on early-run performance in v1 (Open Questions).

## Dependencies

**Upstream (Onboarding / Tutorial depends on):**

| System | Interface | Hard / Soft |
|---|---|---|
| **Turn & Phase Manager** ✅ | `currentPhase`, `currentTurn`, phase events; battle Setup/reload entry point for Tutorial Battle Templates (**PROVISIONAL** — exact bootstrap contract not yet pinned by any document) | **Hard** |
| **Combat Resolution** ✅ | Full event log — canonical events (`design/architecture/cross-system-contracts.md` §1): `DamageApplied`, `DisplacementComplete`, `CollisionResolved`, `SwapComplete`, `HazardSpawned`, `HazardApplied`, `UnitRemoved`, `TerrainSet`, `UnitSpawned` — every Beat `triggerPredicate`/`completionPredicate` (Formula F1) is evaluated against this log | **Hard** |
| **Objective / Win-Lose** ✅ | Terminal `EvaluationResult` (`status`, `reason`), scoped to tutorial battles, for Mission-complete detection and non-punishing Defeat interception (Rule 8) | **Hard** |
| **Heroes & Abilities** ✅ | Action-slot state, `legalMoveTiles`/`legalTargets` (Formulas F1–F2 of that document), for Beat predicate evaluation and M1's ability-out-of-range content authoring (Rule 6) | **Hard** |
| **Enemy, Abilities & Telegraph** ✅ | `Intent`/`telegraphedEffectTiles`/`telegraphedMoveDestination`, for callout copy anchored to specific tiles/enemies | **Hard** |
| **Input & Selection** | Hover/select/commit event stream, for Beat trigger/completion predicates | **Hard**, previously designed, interface not re-read this pass |
| **Move Preview** | `Ready` preview state, to time callouts against an existing preview | **Soft** |
| **Battle HUD** ✅ | Zone taxonomy (Zone A–F identifiers, `battle-hud.md` Rule 2) for `HUDZoneRef` callout anchors (Rule 4) | **Soft** |
| **Run Persistence** | `loadMeta()`, `loadRun()`, and a proposed `tutorialCompleted`/`tutorialSkipped` Meta Save field (**PROVISIONAL** schema addition) | **Hard** |
| **Board Rendering & Juice** | Proposed Tutorial Callout/spotlight rendering interface (Rule 13) — **not re-confirmed against that document's published layer list this pass** | **Hard, PROVISIONAL** |

**Downstream (systems that depend on Onboarding / Tutorial):** none. Per
`systems-index.md`'s Polish-layer placement (alongside Accessibility,
Settings / Options), Onboarding is a presentation/coaching leaf — no system
reads state from it.

**Bidirectional-consistency notes:**
- `heroes-and-abilities.md`, `enemy-abilities-and-telegraph.md`,
  `combat-resolution.md`, and `battle-hud.md` do not list Onboarding as a
  dependent (all four predate this document's authoring and none names a
  "tutorial" consumer — `combat-resolution.md`'s Downstream table and
  `battle-hud.md`'s Downstream table are both explicitly closed lists that
  omit it) — this is expected for a Polish-layer system consuming
  Feature/Core-layer read contracts that were designed without foreknowledge
  of every future reader; no conflict, since this document only *reads*
  already-published event/zone data from all four, adding no new obligation
  on any of them.
- `run-persistence.md`'s Dependencies table already lists `Battle HUD /
  Onboarding` as a **Soft** downstream dependent for "save-state signals for
  toast display" — this document's relationship is broader (Rule 11's
  read/write on `tutorialCompleted`) and should be reconciled as **Hard**
  when that document is next revised; flagged for `/consistency-check`.
- Board Rendering & Juice and the exact Turn & Phase Manager bootstrap
  contract are flagged PROVISIONAL above (Rule 13/Rule 9) precisely because
  this authoring pass did not re-read either document's current published
  interface — both must be reconciled before implementation.

## Tuning Knobs

| Knob | Default | Safe Range | Category | Too Low | Too High |
|---|---|---|---|---|---|
| `tutorial_hint_delay_ms` | 6000 ms | 2000–15000 ms | Feel | Below ~2000ms, hints appear almost instantly on every Beat, undermining the discovery-led promise (Player Fantasy) and making the tutorial feel like it doesn't trust the player | Above ~15000ms, a genuinely stuck new player (the exact case this system exists to protect, per Player Fantasy's second failure mode) waits uncomfortably long with zero guidance |
| `tutorial_hint_escalation_ms` | 8000 ms | 3000–20000 ms | Feel | Below ~3000ms, Tier 1 (silent spotlight) barely exists before Tier 2 (explicit text) arrives, collapsing the two-stage progressive-disclosure design into one abrupt reveal | Above ~20000ms, a player who needed the quiet spotlight nudge but not yet full text waits unnecessarily long for the explicit explanation once they've clearly stalled |
| `tutorial_time_budget_seconds` | 600 (10 min) | 300–900 | Curve (authoring guidance) | Setting far below realistic authored content makes Formula F3's warning fire on every legitimate content pass, diluting its usefulness as a signal | Setting far above `game-concept.md`'s explicit "first 10 minutes" target defeats the purpose of having a budget at all — the pillar test this knob exists to validate |
| `tutorial_defeat_retry_enabled` | `true` | bool | Gate | `false` would let a tutorial-scoped Defeat show a real battle's Defeat consequence, directly violating this document's non-punishing design intent — not a legitimate value in v1, retained only as a documented off-switch for a future forced-mandatory-onboarding build variant | N/A (bool) |
| `tutorial_skip_offered` | `true` | bool | Gate | `false` removes the Skip affordance entirely — legitimate only for a deliberate "mandatory onboarding" product decision (e.g. a platform certification requirement); directly trades away this document's own Player Fantasy protection against patronizing an experienced player | N/A (bool) |
| `tutorial_callout_max_chars` | 140 | 80–220 | Curve | Below ~80 chars, most taught concepts (e.g. explaining a two-hero simultaneous-threat solve in M3) cannot be phrased clearly, forcing either truncation or a multi-bubble sequence that adds friction | Above ~220 chars, a single callout stops being readable at a glance, violating Pillar #5's own "read in ten seconds" test applied to the tutorial's own UI |
| `tutorial_spotlight_dim_opacity` | 0.55 | 0.30–0.75 | Curve | Below ~0.30, the spotlight effect barely draws the eye, weakening Tier 1's entire purpose as a quiet, wordless nudge | Above ~0.75, the dimmed board risks obscuring real board state (HP bars, telegraphs) the player still needs to read, which would violate Pillar #1's "never hide a fact that matters to a decision" even inside a tutorial context |
| `tutorial_board_size_m1` / `_m2` | 5×5 / 6×6 | 5–12 (Board & Grid's own knob range) | Curve | Below 5×5, there is too little room to demonstrate movement range meaningfully | Above the ramp target (approaching or exceeding the default 8×8) for M1/M2 specifically defeats the deliberate "small board first" legibility ramp (Rule 3) |

**Interactions between knobs:**
- `tutorial_hint_delay_ms` and `tutorial_hint_escalation_ms` together define
  the full silent-to-explicit window; both should be tuned against actual
  first-time-player observation (a UX story-type "manual walkthrough"
  evidence tier, per this project's Testing Standards) rather than guessed,
  since "how long is too long to wait" is a feel judgment, not a formula
  output.
- `tutorial_skip_offered=false` and `tutorial_defeat_retry_enabled=false`
  are the only two knobs in this document capable of fully reversing its
  own Player Fantasy design intent if both are set to their non-default
  value simultaneously — flagged explicitly so a future build-variant
  decision-maker sees the coupling, not just each knob in isolation.

**Intentionally NOT knobs (structural, design-locked invariants):**
- **`tutorial_mission_count = 3`** is fixed — the read/act/plan progression
  (Rule 2) is a content-shape decision tied directly to
  `game-concept.md`'s stated onboarding curve, not a tunable count.
- **"No hard input gating" (Rule 6)** is never configurable — exposing a
  toggle to disable legal actions during a Beat would reintroduce exactly
  the "this game doesn't trust me" failure mode this document's Player
  Fantasy section identifies as unacceptable.
- **Adaptive/retroactive completion (Rule 7, Formula F4)** is always on —
  there is no mode where a player is forced to repeat an already-demonstrated
  action to "prove" they read a hint.

## Visual/Audio Requirements

*(Detailed visual style is deferred to `art-director`; the following are
functional, testable requirements this system imposes on Board Rendering &
Juice, Battle HUD's shared canvas, and Audio System.)*

**Visual — legibility and accessibility contract:**
- **Tutorial Callout text is never the sole carrier of meaning.** Every
  Tier-2 callout is paired with the Tier-1 spotlight/dim visual it escalated
  from (never text appearing with no spatial anchor) — satisfies "functional
  without reliance on color alone" by construction, since the anchor is
  positional, not chromatic.
- **Spotlight/dim never fully obscures real board state.** Per
  `tutorial_spotlight_dim_opacity`'s safe range, HP bars, telegraph icons,
  and unit silhouettes remain legible through the dimmed region — a tutorial
  must never itself violate Pillar #1 by hiding a fact that matters to the
  decision it's teaching.
- **Callout text obeys the same minimum font size as Battle HUD.** Reuses
  `hud_min_font_size_px` (14px floor) and `hud_scale` rather than defining a
  second, competing scale value — one consistent legibility floor across all
  in-battle text.
- **No flashing.** The Tier 1 → Tier 2 escalation is a fade-in (≥200ms,
  matching Battle HUD's own near-loss-warning precedent), never a
  strobe/blink; if any pulse is ever used for the spotlight edge, it is
  capped at the same "no more than 3 flashes per second" standard every
  other visual system in this project already applies.
- **Keyboard-only operable.** Gate Beat 0's Play/Skip choice and any
  Tier-2 callout's dismiss affordance (if one exists beyond "perform the
  taught action") must be fully reachable via keyboard alone (Tab/Enter),
  matching Input & Selection's own keyboard-parity requirement — never a
  mouse-only interaction.
- **Gamepad:** not applicable in v1 — inherits the same exclusion
  `input-and-selection.md` already documents (Open Question #8); revisit
  together if a platform target changes.
- **Scales correctly at all supported resolutions.** Callout anchors are
  computed relative to the same screen/tile coordinate contract Input &
  Selection's Formulas 1–2 already define, never a hardcoded pixel position.

**Audio (hooks only — this system owns zero audio playback, matching Battle
HUD's and Move Preview's own "hooks only" pattern):**
- `tutorial_hint_tier1_shown`, `tutorial_hint_tier2_shown`,
  `tutorial_beat_completed`, and `tutorial_mission_complete` each fire as
  distinct UI events for Audio System to optionally map to a `sfx_ui_*` cue;
  none is required to have sound.
- Every audio cue this system might ever trigger is paired with a
  simultaneous visual cue (Input & Selection's established project-wide
  convention, reused here) — no audio-only tutorial instruction exists.

**Subtitles / dialogue:** not applicable — this system has no voiced content
(`game-concept.md`'s "light narrative framing" places any narrative
elsewhere); all Tutorial Callout content is text-first by design, satisfying
the subtitle-equivalent requirement by construction rather than needing a
separate subtitle track.

## Acceptance Criteria

All criteria are deterministic and independently testable against a
fake/mock upstream state (Turn & Phase Manager, Objective / Win-Lose, Heroes
& Abilities, Enemy Abilities & Telegraph, Run Persistence) exposing the read
contracts this document specifies — no wall-clock time beyond an explicitly
injectable idle-time input, no RNG, no real rendering required for the
functional criteria. Visual/feel criteria are ADVISORY (manual walkthrough +
lead sign-off), per this project's Testing Standards for UI story types.

**Session trigger & skip (Rules 10, 14)**
- **GIVEN** `loadMeta().tutorialCompleted !== true` and `loadRun() ==
  Empty`, **WHEN** the app boots, **THEN** the Tutorial Session auto-launches
  at `GateOffered`.
- **GIVEN** `loadMeta().tutorialCompleted === true` **OR** `loadRun() !=
  Empty`, **WHEN** the app boots, **THEN** the Tutorial Session does not
  auto-launch.
- **GIVEN** `GateOffered`, **WHEN** `Skip Tutorial` is chosen, **THEN** the
  Session transitions to `Skipped`, `tutorialCompleted = true` and
  `tutorialSkipped = true` are written exactly once, and no Tutorial Mission
  ever loads.

**Mission sequencing & board ramp (Rules 2–3)**
- **GIVEN** `GateOffered` → `Play Tutorial`, **WHEN** the Session begins,
  **THEN** Mission 1 loads on a 5×5 board, Mission 2 on 6×6, Mission 3 on the
  default 8×8 — in that fixed order, never reordered or parallel.
- **GIVEN** Mission `N`'s terminal `Victory`, **WHEN** `N < 3`, **THEN**
  Mission `N+1` loads next; **WHEN** `N == 3`, **THEN** the Session
  transitions to `Completed` and `tutorialCompleted = true` is written
  exactly once.

**Beat lifecycle & hint escalation (Rules 4–5, Formulas F1–F2)**
- **GIVEN** a Beat whose `triggerPredicate` is false, **THEN** its state is
  `Pending` and no hint is shown at any tier.
- **GIVEN** a Beat `Armed` for `t_idle < tutorial_hint_delay_ms` of
  Player-Phase time, **THEN** `hintTier == 0` (no visible hint).
- **GIVEN** the same Beat at `t_idle` within the Tier-1 window (Formula F2),
  **THEN** only the spotlight/dim visual is shown, with no callout text.
- **GIVEN** the same Beat at `t_idle ≥ tutorial_hint_delay_ms +
  tutorial_hint_escalation_ms`, **THEN** the full callout (spotlight + text)
  is shown.
- **GIVEN** a Beat's `completionPredicate` becomes true while `hintTier ==
  0`, **THEN** the Beat transitions directly `Armed → Completed` with no
  hint ever having been shown.
- **GIVEN** non-`PlayerPhase` time elapsing while a Beat is `Armed`, **THEN**
  that elapsed time does not count toward `t_idle` (animation/resolution
  time is excluded per Formula F2's variable definition).

**Adaptive skip (Rule 7, Formula F4)**
- **GIVEN** two Beats in the same Mission whose predicates are both
  satisfied by a single observed action, **WHEN** the next evaluation pass
  runs, **THEN** both transition to `Completed` in the same pass, in
  ascending `order`.
- **GIVEN** a later-order Beat's `completionPredicate` becomes true while an
  earlier-order Beat in the same Mission is still `Pending`, **WHEN** the
  earlier Beat's own predicate is independently also satisfied by the
  current state, **THEN** both complete together (no artificial ordering
  requirement beyond what each predicate itself demands).

**Non-punishing retry (Rule 8, States and Transitions)**
- **GIVEN** a Tutorial Mission `Active` and Objective's terminal
  `EvaluationResult.status == Defeat`, **WHEN** this is detected, **THEN**
  the Mission transitions `Active → Retrying → Active` with the same
  Tutorial Battle Template reloaded fresh, and the real battle Defeat
  banner (`objective-and-win-lose.md`'s Visual/Audio Requirements) is never
  shown for a tutorial-scoped Defeat.
- **GIVEN** a Mission retry, **WHEN** all of that Mission's Beats are
  inspected, **THEN** every one has reset to `Pending`.
- **GIVEN** a Mission retry followed by the player immediately repeating an
  action they had already completed pre-Defeat, **WHEN** the corresponding
  Beat's `completionPredicate` is evaluated, **THEN** it completes on the
  first repeat with zero hint-escalation delay (Formula F4 applies
  identically post-retry).

**No hard gating / decoupled progression (Rules 6, Edge Cases)**
- **GIVEN** any Callout Beat at any hint tier, **WHEN** Heroes & Abilities'
  or Input & Selection's own legality is queried for any action unrelated to
  that Beat, **THEN** the result is identical to what it would be outside a
  tutorial context — no action is ever additionally restricted by Onboarding.
- **GIVEN** a Mission reaching Objective's terminal `Victory` with one or
  more Beats still `Pending`/`Armed`, **THEN** the Mission still transitions
  to `MissionComplete` normally.

**Persistence (Rules 11–12, 14)**
- **GIVEN** Mission 3's terminal `Victory` or a `Skip Tutorial` choice,
  **WHEN** the corresponding Meta Save write is inspected, **THEN**
  `tutorialCompleted == true` and the write occurred exactly once (not once
  per Mission).
- **GIVEN** `tutorialCompleted == true`, **WHEN** `Replay Tutorial` is
  invoked and completed again, **THEN** no additional Meta Save write to
  `tutorialCompleted`/`tutorialSkipped` occurs (idempotent, already-true
  values are not re-written).

**Duration budget (Formula F3, advisory)**
- **GIVEN** the worked-example Beat durations (M1=125s, M2=140s, M3=225s),
  **THEN** `totalEstimatedSeconds == 490`, under the default
  `tutorial_time_budget_seconds = 600` — a passing advisory check, not a
  blocking one.

## Open Questions

**Needs an architecture decision (→ ADR during `/create-architecture`):**

1. **Tutorial Battle Template bootstrap contract.** This document assumes a
   battle-instantiation entry point (loading a fixed Board + Loadout +
   enemy layout, bypassing Encounter Generator) exists or can be added to
   Turn & Phase Manager's Setup phase (Rule 9/14), but no document currently
   publishes that exact contract for *any* caller, tutorial or real.
   *Owner:* Tech architecture, coordinated with whoever finalizes battle
   Setup's public API.
2. **Board Rendering & Juice's Tutorial Callout/spotlight interface (Rule
   13).** Proposed here but not reconciled against that document's actual
   published layer list in this authoring pass (a known limitation of this
   session, per this project's own documented fan-out risk). *Owner:*
   `/consistency-check` against `board-rendering-and-juice.md`.
3. **Meta Save tutorial flags** (`tutorialCompleted`, `tutorialSkipped`,
   Rule 11) are canonically owned by `meta-progression-and-unlocks.md`'s
   `MetaStatistics` schema (the single Meta Save payload), which now defines
   them; Onboarding only writes/reads them. Remaining work is purely a
   `/consistency-check` reconciliation of `run-persistence.md`'s published
   schema against that owner, and updating that document's Dependencies table
   to list Onboarding as **Hard**, not **Soft** (Dependencies section
   bidirectional-consistency note above) — not an independent field proposal
   by this document.

**Resolved this session (provisional defaults — confirm during
implementation):**

4. **Exactly 3 Missions, read → act → plan, one verb per Mission progression**
   (Rule 2) — a direct, deliberate implementation of `game-concept.md`'s
   stated onboarding curve, not an arbitrary content choice.
5. **No hard input gating; sequencing achieved entirely through battle
   content** (Rule 6) — chosen specifically to avoid inventing a
   tutorial-only restriction mechanism that would need its own legality
   layer, and to keep the tutorial's simulation indistinguishable from a
   real battle (Rule 15).
6. **Two-tier discovery-led hint escalation, capped at explicit text, never
   auto-performing the taught action** (Rule 5, Formula F2) — chosen over a
   single-tier ("show the hint immediately") or auto-play ("do it for the
   player") model to protect both Player Fantasy failure modes
   simultaneously.
7. **Tutorial Battle Templates bypass Encounter Generator, hand-authored
   directly by this system** (Rule 9) — chosen to decouple the tutorial's
   ship-readiness from Encounter Generator's (Vertical-Slice-tier, Designed)
   procedural pipeline, and because tutorial content specifically demands
   hand-tuned, not procedural, quality.

**Deferred to the owning system's GDD or a future content pass:**

8. **Exact callout copy/microcopy for every Beat.** This document defines
   the schema, timing, and one worked example per Formula, but final voice
   and wording is a content-authoring pass, not a system-design decision.
   *Owner:* a future writing/content pass, likely coordinated with
   `narrative-designer` if the project adds one, or `game-designer`.
9. **`Replay Tutorial`'s exact menu placement.** Deferred to **Settings /
   Options** (Alpha tier, undesigned) per Rule 12. This document only
   guarantees the entry point's behavioral contract (never mid-run, never
   re-writes completion flags), not its location in the menu hierarchy.
10. **Reactive re-offering of the tutorial based on early-run struggle**
    (e.g. detecting a player who skipped and then lost their first several
    real battles, and proactively suggesting a replay). Explicitly out of
    scope for v1 (Edge Cases) — would require an analytics/heuristic signal
    this document does not define. *Owner:* revisit with
    `analytics-engineer` if post-launch data shows this is a common failure
    path.
11. **A solvability validator for Tutorial Battle Templates**, analogous to
    Encounter Generator's own planned solver/validator
    (`systems-index.md`'s High-Risk Systems mitigation). Not designed here —
    v1 relies on manual playtesting of exactly three fixed battles, which is
    tractable at this content volume; revisit only if the Mission count or
    variant count ever grows. *Owner:* Encounter Generator, if this pattern
    is later generalized.
