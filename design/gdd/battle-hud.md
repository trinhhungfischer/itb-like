# Battle HUD

> **Status**: In Design
> **Author**: workflow (design-system fan-out)
> **Last Updated**: 2026-07-27
> **Implements Pillar**: #5 Read in Ten Seconds; #1 Perfect Information, Perfect Blame

## Overview

Battle HUD is the player's single always-on window into everything the
deterministic battle simulation already knows. It aggregates read-only state
from five upstream systems — Turn & Phase Manager (turn/phase), Combat
Resolution (HP/event deltas), Heroes & Abilities (hero roster, ability,
action-economy state), Enemy, Abilities & Telegraph (enemy HP, telegraphed
intent), and Objective / Win-Lose (mission status) — into six persistent
information zones: **HP bars**, **telegraph intent icons**, the **turn/phase
indicator**, the **ability bar**, the **objective/turn-limit display**, and
the **End Turn + Undo controls**. It is the concrete, on-screen instrument of
Pillar #5 (Read in Ten Seconds): if a fact about the battle matters to a
decision, it lives in the HUD, always visible, never behind a click. It is
also the last mile of Pillar #1 (Perfect Information, Perfect Blame) — every
number and icon the HUD shows must be traceable to a real, already-computed
system value, never HUD-invented state, so a player who reads the HUD
correctly can never be surprised by the simulation. Battle HUD owns exactly
two write paths back into the simulation — the End Turn and Undo/Redo
controls — and nothing else; every other pixel it draws is a read-only
projection of state owned elsewhere.

## Player Fantasy

**"I never have to hunt for the information I need to make a good call."**
The commander fantasy `game-concept.md` establishes — *"I am a cunning
commander who wins with my mind, not with numbers"* — depends on the
player's mind having unobstructed access to the board's full state. Battle
HUD is where that promise is either kept or broken: if HP, threats, and
options are legible at a glance, the player's failures are always tactical
(a real misjudgment), which is Pillar #1's entire design test. If the HUD
hides, buries, or ambiguously represents a fact — an enemy's HP looks fine
but is one hit from death, an ability looks available but secretly has no
legal target, a turn counter is easy to miss — the player's "mistake"
becomes a UI mistake instead of a tactical one, which is the one experience
this game is built to prevent. This system's failure state is exactly that:
information that exists in the simulation but doesn't reach the player's
eyes in time to matter, or information that requires more than a glance
(Pillar #5's ten-second test) to parse correctly.

## Detailed Design

### Core Rules

1. **Ownership boundary.** Battle HUD owns the layout, taxonomy, and
   legibility contract of six persistent information zones, plus exactly two
   write paths back into the simulation (Rules 9, 11). It does **not**
   decide legality, compute telegraphs/HP/objective status, own selection or
   hover state (Input & Selection's job), or render on-board sprite/tile
   pixels or animation ("juice" — Board Rendering & Juice's job, see Rule
   13). Every value this system displays is sourced from an upstream
   system's already-published read contract; this document invents no new
   gameplay state.

2. **Six persistent zones, always visible during battle.**
   - **Zone A — Turn/Phase Indicator**: a compact, always-visible readout of
     `currentTurn` and a two-state derived display (`Planning`/`Resolving`,
     Formula F1), not the raw seven-phase enum (Rule 3).
   - **Zone B — Objective/Turn-Limit Display**: exactly one of four
     type-specific layouts (Rule 12), fixed for the whole battle.
   - **Zone C — Ability Bar** (hero roster panel): one row per living-or-Down
     Loadout hero (`squad_size`, 2–5 per `heroes-and-abilities.md`), each
     showing portrait/silhouette, dual-encoded HP bar (Rule 5), ability
     icon + name, and independent Move-slot / Ability-slot state (Rule 8).
   - **Zone D — Enemy HP Bars + On-Board Telegraph Data**: per living enemy,
     a dual-encoded HP bar; the on-tile telegraph icon *pixels* are owned by
     Board Rendering & Juice (Rule 13) — Battle HUD's contribution here is
     the HP bar plus the off-board **Threat Ticker** (Rule 14).
   - **Zone E — End Turn control**: a single, always-visible primary button
     (Rule 9).
   - **Zone F — Undo/Redo control**: a paired, always-visible control (Rule
     11).
   - **Unit Inspect Panel** (on-demand, not a persistent zone): expands on
     top of Zones C/D when Input & Selection reports an `Inspect` target
     (Rule 15), surfacing the full, uncompressed detail Rules 6–7
     intentionally compress in the glance-view.

3. **Phase display is deliberately collapsed to two states.** Turn & Phase
   Manager exposes seven raw phases (`TurnStart, PlayerPhase, Environment,
   EnemyResolve, Spawn, Telegraph, EndCheck`), but the player only ever has
   a decision to make during `PlayerPhase`. Zone A therefore maps every
   phase to one of exactly two display states — `Planning` (`PlayerPhase`)
   or `Resolving` (all six other phases) — per Formula F1. This is a
   deliberate legibility simplification, not a loss of information: the
   exact phase name remains available in the Zone A tooltip / Inspect
   context for debugging or power users, but the glance-level read is
   binary ("can I act right now?"), which is the only phase-level fact a
   player needs to make a decision (Pillar #5).

4. **Data sourcing model — event-driven with a pure-pull fallback.** Every
   zone updates reactively from the same event streams Board Rendering &
   Juice and Audio System already subscribe to (Combat Resolution's event
   log; Turn & Phase Manager's phase events; Enemy, Abilities & Telegraph's
   `Intent` updates; Objective's terminal result) for sub-frame
   responsiveness. Independently, every zone's content must also be fully
   derivable from a single, stateless "current state" pull (a
   `getHUDState()`-shaped read across the five upstream systems) with zero
   event-history replay — this guarantees a HUD mounted mid-battle (e.g.
   after a session-state recovery, per `context-management.md`) renders
   correctly on its very first frame (Acceptance Criteria).

5. **HP bar dual-encoding.** Every HP bar (hero or enemy, roster panel or
   on-board) displays **both** a numeric `current/max` value and a
   proportional bar fill (Formula F2) — neither is ever shown alone. A
   critical-HP state (`isCritical`, Formula F2) is communicated by a
   distinct icon/shape change (e.g. a border treatment or corner glyph), not
   by a color shift alone, per the Accessibility Checklist's "functional
   without reliance on color alone" requirement.

6. **Telegraph icon taxonomy is HUD-specified, board-rendered.** Battle HUD
   defines *what a telegraph icon must mean* — reusing
   `enemy-abilities-and-telegraph.md`'s Visual/Audio Requirements verbatim
   as its data contract (one icon-family per Combat Resolution primitive
   family — `damage`, `push`/`pull`, `spawnHazard`/`applyHazard` — a
   distinct lower-emphasis movement indicator, a distinct Idle glyph, a
   distinct spawn-imminent glyph) — but the *pixels* of that icon rendered
   on a board tile are `board-rendering-and-juice.md`'s Layer 5 (`Telegraph`)
   responsibility, already published and reading directly from Enemy's
   `intents_telegraphed` payload. See Rule 13 for the full ownership split
   and a flagged cross-document overlap.

7. **Multi-primitive telegraph compression (glance-view only).** An enemy
   ability whose compiled `effectTemplate` spans more than one distinct
   Combat Resolution primitive family displays at most 2 stacked family
   icons in any glance-view surface this document owns (the Threat Ticker,
   Rule 14): the first non-Move primitive family, then the next distinct
   family if present. Three or more distinct families collapse to a single
   generic "complex threat" glyph in the glance view; the full,
   uncompressed breakdown is always available via the Inspect panel (Rule
   15). This mirrors `move-preview.md`'s `max_recommended_chain_length`
   legibility-capping pattern: nothing is ever hidden from the player, only
   deferred one click past the first glance (Pillar #1 is unaffected).

8. **Ability bar action-economy readout.** Each hero row shows the Move slot
   and Ability slot independently, each in one of three states:
   `Available`, `Used`, or (Ability slot only) `Unavailable — No Legal
   Target`. The last state is visually distinct from `Used` — Pillar #1
   requires the player be able to answer "why is this greyed out" without
   guessing between "I already used it" and "there is nothing to target"
   (`heroes-and-abilities.md`'s own UI Requirements state this explicitly).

9. **End Turn control.** A single, primary, always-visible button. Enabled
   only when Turn & Phase Manager reports `currentPhase == PlayerPhase`;
   disabled — visibly, never hidden — in every other phase, so the player
   always sees where the control lives rather than wondering if it vanished
   (matching `input-and-selection.md`'s "every click either does something
   visible or is visibly rejected" convention, extended to this HUD
   control). Pressing it while enabled calls Turn & Phase Manager's
   phase-commit entry point (proposed name `endPlayerPhase()` —
   **PROVISIONAL**, that document does not publish an explicit method name).

10. **End Turn soft-confirm on unresolved threats.** Before committing,
    Battle HUD computes `heroesInDanger` (Formula F4): the set of currently
    alive heroes whose *current* tile is a member of the current turn's
    telegraphed effect-tile union — enemy `Intent.telegraphedEffectTiles`
    **and** environmental `telegraphedEnvironmentTiles(turn)`, both owned by
    Enemy, Abilities & Telegraph (`cross-system-contracts.md` §9). If
    `heroesInDanger` is non-empty and the
    `end_turn_confirm_on_threatened_hero` knob is `true` (default), the
    first End Turn press arms a one-time inline warning ("N heroes still in
    a telegraphed hit — End Turn anyway?") instead of committing; a second
    explicit press (or a distinct "End Turn Anyway" affordance) within
    `end_turn_confirm_timeout_ms` commits normally. This check runs against
    the **live board with zero candidate action pending** — it is not a
    duplicate of Move Preview (which only ever previews a specific candidate
    action's consequence). It never blocks a deliberate End Turn, only an
    accidental one, directly serving Pillar #1's "confidence to think"
    promise (`turn-and-phase-manager.md`'s Player Fantasy section) by
    preventing "I forgot to move someone out of the blast."

11. **Undo/Redo control.** Always visible; enabled only when Turn & Phase
    Manager's undo stack (`undoLevels > 0`, per `turn-and-phase-manager.md`
    Formula F2) is non-empty **and** `currentPhase == PlayerPhase`;
    otherwise disabled, visibly. Pressing Undo calls the manager's undo
    entry point exactly once per press (proposed name `undo()` —
    **PROVISIONAL**); Redo is a paired, secondary affordance against the
    manager's redo stack (`redoLevels > 0`), sharing the identical
    enable/disable rule (proposed name `redo()` — **PROVISIONAL**). Neither
    control supports press-and-hold repeat — each undo/redo is a single,
    deliberate action, matching the game's "no accidental multi-undo"
    philosophy.

12. **Objective tracker variants.** Exactly one of four Zone B layouts
    renders, matching `ObjectiveConfig.type` (fixed for the whole battle,
    per `objective-and-win-lose.md` Rule 4): **Survive** shows a turn
    countdown (Formula F3); **Protect** shows the same countdown plus the
    protected unit's dual-encoded HP bar (Rule 5), always visible even
    though that hero also appears in Zone C — both read the same Unit
    Registry entry, so the two displays can never drift (Edge Cases);
    **Clear** shows a live enemy count (`enemiesRemaining`, reusing
    `objective-and-win-lose.md`'s registered Formula F3 by reference);
    **Reach** shows a persistent on-board goal-tile marker (owned by Board
    Rendering & Juice, per Rule 13's split) plus a Zone B textual distance
    readout — the registered `manhattan_distance` from the nearest living
    hero to the goal tile. No battle ever renders more than one variant, and
    the variant never changes mid-battle.

13. **Ownership split with Board Rendering & Juice — flagged overlap.**
    `board-rendering-and-juice.md` (already authored) explicitly claims
    on-board telegraph icon *rendering* as its own Layer 5 (`Telegraph`),
    reading `intents_telegraphed` directly and independently of Battle HUD,
    and its Core Rule 1 explicitly excludes "HUD elements (health bars,
    action bars, damage numbers)" from its own scope without naming
    telegraph icons as a Battle HUD deliverable. This document's assigned
    scope ("telegraph intent icons") and that document's already-published
    Layer 5 ownership **overlap on the same on-tile pixels.** This document
    resolves the overlap as follows: **Board Rendering & Juice owns 100% of
    on-tile telegraph icon rendering** (position, directional variant,
    verb-family accent color, animation) exactly as already specified;
    **Battle HUD owns the icon *taxonomy specification* (Rule 6)** that both
    that system and this one must draw from, **plus an off-board summary
    surface (the Threat Ticker, Rule 14)** that is genuinely
    non-duplicative — it aggregates and enumerates threats in HUD chrome
    space rather than rendering them on tiles. **Flagged for
    `/consistency-check`**: `systems-index.md`'s Dependency Map does not
    currently list a Battle HUD ↔ Board Rendering & Juice edge at all (both
    that document and this one independently flag the same gap). The
    canvas/layer-ordering relationship (HUD chrome renders above Board
    Rendering & Juice's layer 9, on top of the same viewport) is a **Soft,
    bidirectional** dependency that should be added to `systems-index.md`.

14. **Threat Ticker (Zone D's HUD-owned component).** A compact, persistent
    list docked near Zone A, enumerating every currently-telegraphed enemy
    action in text-plus-mini-icon form: enemy name/thumbnail, up to 2
    stacked verb-family icons (Rule 7), and a boolean "threatens a living
    hero right now" flag (reusing Formula F4's per-enemy tile-membership
    check). Enemies telegraphing `Idle` are collapsed into a single summary
    line ("N idle") rather than one row each, expandable on interaction.
    This is a scannable, list-form complement to Board Rendering & Juice's
    per-tile fidelity — valuable specifically because the enemy roster can
    reach ~15 units (`enemy-abilities-and-telegraph.md`'s own performance
    budget assumption), at which point scanning 15 on-board icons still
    costs meaningful attention, while an enumerated count-and-summary list
    serves the "how many threats am I not answering yet" gut-check Pillar
    #5 demands at the aggregate level.

15. **Unit Inspect Panel.** Triggered by Input & Selection's `Inspect` state
    (any clicked unit, friendly or enemy, exhausted or not — per
    `input-and-selection.md`'s Edge Cases). Shows the full, non-capped
    detail Rules 7–8's glance-view intentionally compresses: every
    primitive family in an inspected enemy's ability with its exact
    parameters, the full ability description text for a hero, exact HP
    values, and (for a hero) full Move/Ability slot state. This is the
    "one click away" escape hatch that keeps Rules 7's icon cap safe under
    Pillar #1 — nothing is ever permanently hidden, only deferred past the
    first glance.

16. **Predicted-outcome overlay on HP bars.** While Move Preview holds a
    `Ready` preview (`move-preview.md` States and Transitions), every HP bar
    for a unit appearing in that preview's result additionally renders a
    secondary "predicted" indicator (e.g. a ghosted/hollow segment showing
    the HP delta the candidate action would cause) layered on top of — never
    replacing — the bar's real, committed HP value (Rule 5's dual encoding
    still governs the committed value). This overlay disappears the instant
    the preview leaves `Ready` (`Stale`/`Discarded`/`Committed`), matching
    Move Preview's own staleness rule that a non-`Ready` result is never
    displayed as authoritative. This rule exists specifically to fulfill
    `move-preview.md`'s own Dependencies table, which already lists "Battle
    HUD | consumes predicted HP/damage numbers for display | Soft" —
    honoring that document's forward-declared contract.

17. **HUD renders during every phase, not just Player Phase.** Unlike Move
    Preview and Input & Selection (both Player-Phase-gated), the HUD's
    read-only zones (HP bars, Threat Ticker, turn/phase indicator, objective
    tracker) remain visible and accurate while Environment / EnemyResolve /
    Spawn / Telegraph resolve, so the player can watch the consequences of
    their plan play out in real time. Only the two write controls (End
    Turn, Undo/Redo — Rules 9, 11) are phase-gated.

18. **No silent HUD desync.** Every displayed value must update within one
    animation frame of its source event firing. A HUD value that lags
    behind the authoritative state it represents — even briefly, even
    during a `Resolving` phase — is a Pillar #1 violation (the board the
    player is reading must always be the board the simulation just decided
    upon), not merely a performance nicety.

### States and Transitions

**Zone A display state** (Formula F1, per-frame derived, no independent
memory): `Planning ↔ Resolving`. `Planning` when `currentPhase ==
PlayerPhase`; `Resolving` for every other phase. Purely a function of Turn &
Phase Manager's exposed `currentPhase` — this document adds no hidden state.

**End Turn control state** (Rules 9–10):

| State | Entered when | What it does | Exits to |
|---|---|---|---|
| **Disabled** | `currentPhase != PlayerPhase` | Renders visibly greyed; clicks are no-ops | `Ready` when `PlayerPhase` begins |
| **Ready** | `PlayerPhase` active, `heroesInDanger == ∅` OR knob `false` | A single press commits (`endPlayerPhase()`) | **Disabled** on commit (phase advances); **ArmedConfirm** if `heroesInDanger` becomes non-empty on a later press |
| **ArmedConfirm** | `PlayerPhase` active, `heroesInDanger ≠ ∅`, knob `true`, first press received | Shows the inline warning; awaits a second press | **Ready** (silently disarms) after `end_turn_confirm_timeout_ms` elapses with no second press, **or** immediately if the live board mutates (Rule 10 — any board change invalidates the armed confirm and forces recomputation on the next press); **Disabled** on a confirmed second press (commits, then phase advances) |

**Undo/Redo control state** (Rule 11): `Disabled ↔ Enabled`, independently
per control. `Enabled` iff (`undoLevels > 0` / `redoLevels > 0`
respectively) **and** `currentPhase == PlayerPhase`; `Disabled` otherwise.
No intermediate state — a press while `Enabled` always resolves in a single
frame (no async confirmation step, matching the "no misclick punishment, but
also no accidental multi-undo" balance Rule 11 establishes).

**Ability-slot HUD display state** (per hero, per slot, mirrors
`heroes-and-abilities.md`'s own Action-slot state with one HUD-only addition):
`Available → Used` (Move and Ability slots); Ability slot additionally has
`Unavailable — No Legal Target`, a **read-only derived display state** (not a
new simulation state) computed as `legalTargets(caster, ability, board) == ∅`
(reusing `heroes-and-abilities.md` Formula F2 by reference). Both slots reset
to `Available` at Turn Start, mirroring that document's own state table; a
Turn & Phase Manager `undo()` rolls a slot back to `Available` in lockstep
with the Board snapshot it restores (`heroes-and-abilities.md`'s own States
and Transitions section).

**Hero roster row state** (Zone C, mirrors `combat-resolution.md`'s unit
vitality model): `Active ↔ Down(cause)`. `Active → Down(Defeated | Fell)` on
`removeUnit`; permanent for the rest of the battle, no `Down → Active`
transition. A `Down` row remains visible in its original list position
(Edge Cases) rather than disappearing or reordering.

**Enemy telegraph display state** (Zone D / Threat Ticker, mirrors
`enemy-abilities-and-telegraph.md`'s own Enemy intent state one level up):
`Telegraphed(intent) → [ResolvedOutcome → Telegraphed(nextIntent)]`. Battle
HUD displays the stored `Intent` for the whole Player Phase and Environment
window; the instant `resolveTelegraphed()` fires for that enemy (whiff or
hit), the Threat Ticker briefly shows the outcome (sourced from Combat
Resolution's event log / the `enemy_action_whiffed` event) before that row
is replaced by the *next* turn's freshly telegraphed `Intent` at the
following Telegraph Phase — there is never a frame where a Threat Ticker row
shows stale, already-resolved data as if it were still upcoming.

**Unit Inspect Panel state**: `Closed ↔ Open(unitId)`. `Closed → Open(id)`
when Input & Selection reports an `Inspect` target; `Open(id) → Open(id2)` on
a new Inspect target (immediate switch, no confirmation); `Open → Closed` on
Input & Selection's `Idle`/deselect (Escape, click empty space, or selecting
a commandable unit instead).

### Interactions with Other Systems

Battle HUD is a **read-only aggregator with two narrow write paths**: it
subscribes to state and events from every upstream battle system and issues
exactly two commands (End Turn, Undo/Redo) back into Turn & Phase Manager.

| System | Battle HUD reads | Battle HUD provides / writes | Ownership boundary |
|---|---|---|---|
| **Board & Grid** ✅ | (indirect, via Objective's `battleState.board`) tile occupancy/flags for the Reach goal-tile distance readout | — | Board owns the spatial model; HUD only reads through Objective's exposed distance value — already listed as a Soft downstream dependent in `board-and-grid.md`'s Dependencies table ("occasional board reads (tile highlight state); mostly reads combat/unit state") |
| **Turn & Phase Manager** ✅ | `currentTurn`, `currentPhase`, `undoLevels`/`redoLevels` (Formula F2 of that doc), phase-boundary events | Calls `endPlayerPhase()` (Rule 9) and `undo()`/`redo()` (Rule 11) — both PROVISIONAL method names | Manager owns the phase/undo state machine; HUD only reads it and issues the two commands that document's own contract already anticipates ("Battle HUD | reads current turn #, current phase, undo availability; listens to phase events" — already listed as a Hard downstream dependent) |
| **Combat Resolution** ✅ | Full event log (`DamageApplied`, `UnitRemoved`, `HazardApplied`, `CollisionResolved`, …) for real-time HP/state updates | — | Combat owns *what happened*; HUD owns *how it's numerically/visually summarized in chrome* — already listed as a Soft downstream dependent ("Reads events for damage numbers / HP bar updates") |
| **Heroes & Abilities** ✅ | Hero roster (Loadout `HeroDefinition` instances), per-hero HP/`maxHP`, ability name/icon, `legalTargets` count (Formula F2 of that doc, for the `NoLegalTarget` display state), Move/Ability slot state | — | Heroes & Abilities owns legality and chassis data; HUD only displays it — already listed as a Hard dependent ("Hero HP, maxHP, ability name/icon, ability availability… Move-slot/Ability-slot used/available, legal-move-tile and legal-target-tile highlight sets") |
| **Enemy, Abilities & Telegraph** ✅ | Enemy roster/HP, `Intent`/`SpawnIntent`/`Idle` records (`telegraphedEffectTiles`, `telegraphedMoveDestination`, `abilityId`), `telegraphedEnvironmentTiles(turn)` (Formula F4's environmental term, `cross-system-contracts.md` §9), `enemy_action_whiffed` events | — | Enemy owns AI/telegraph truth; HUD owns the Threat Ticker's enumeration and compression (Rules 7, 14) of that same data — already listed as a Soft dependent ("Reads enemy HP/state for HP bars; exposes Intent summaries") |
| **Objective / Win-Lose** ✅ | `EvaluationResult` (`status`, `reason`), `ObjectiveConfig` (`type`, `max_turns`, `protectedUnitId`, `goalTile`), `enemiesRemaining` (Formula F3 of that doc) | — | Objective owns the verdict/predicate logic; HUD owns the objective tracker's presentation — already listed as a Hard, provisional dependent ("`status`, `reason`, and type-specific progress figures… for an objective tracker + win/lose banner") |
| **Move Preview** ✅ | `Ready`/`Stale`/`Discarded`/`Committed` preview state; the preview's predicted HP/damage deltas (Rule 16) | — | Move Preview owns dry-run truth; HUD only overlays its predicted deltas on top of committed HP bars — already listed as a Soft dependent ("consumes predicted HP/damage numbers for display") |
| **Input & Selection** ✅ | Selected unit, available action modes, `Inspect`-panel target | Forwards ability-bar row/icon clicks as an alternate input path into Input & Selection's shared selection state machine (Rule 2's "one shared state machine" is extended here — see Open Questions) | Input & Selection owns the selection/targeting state machine; HUD renders whatever it reports and offers a second, equivalent way to drive it — already listed as a Hard dependent ("selected unit, available action modes, Inspect-panel target") |
| **Board Rendering & Juice** ✅ | — (no gameplay data read) | Shares canvas/viewport; HUD chrome is composited above Rendering's layer 9 (Rule 13) | **Soft, bidirectional** — flagged gap in `systems-index.md`'s Dependency Map, independently noted by both documents |
| **Audio System** ✅ | — (peer, not a dependency) | — | Both HUD and Audio are independent, read-only consumers of the same Combat/Turn event streams; neither triggers off the other, avoiding drift — mirrors Audio System's own stated peer relationship with Board Rendering & Juice |
| **Pilots** ✅ (#25, `pilots.md`, Designed 2026-07-28) | A mech's **effective** action-slot count and the identity of any pilot skill currently modifying it | — | **Added 2026-07-28** by `/consistency-check` — `pilots.md` listed Battle HUD as a downstream consumer while this document had no knowledge of Pilots at all. Pilot skills in the action-economy lane (e.g. a once-per-battle second Move) change how many actions a mech actually has. Rule 5's ability-bar slot indicators must show the *effective* count, not the chassis default of `actions_per_hero_turn = 2` — a player who cannot see the extra slot cannot plan the turn, which breaks **Pillar 1 (Perfect Information)**. Pilots owns what the skill does; HUD owns showing that it is active. Display-only: no effect when no such skill is equipped |
| **Accessibility** ✅ (#27, `accessibility.md`, Designed 2026-07-28) | Every HUD element as a verification subject | — | A1 (shape/icon redundancy — HP bars, threat markers and slot indicators must not rely on hue), A3 (`uiScale` to 1.5 without clipping), A4 (contrast floors 4.5:1 / 3:1), A7 (keyboard-only reachability). These are **BLOCKING** gates (its V1–V4), applied per screen and per locale, not aspirations |
| **Settings / Options** ✅ (#28, `settings-and-options.md`, Designed 2026-07-28) | `ui_scale`, `colorblind_mode`, `reduced_motion` | — | Read-only consumer. Settings persists and surfaces the values; this document renders against them |

**Bidirectional-consistency notes:**
- `turn-and-phase-manager.md`, `combat-resolution.md`, `heroes-and-abilities.md`,
  `enemy-abilities-and-telegraph.md`, `objective-and-win-lose.md`, and
  `move-preview.md` all already list Battle HUD as a downstream dependent
  with an interface matching (or a superset of) the rows above — this
  document's Dependencies are consistent with every upstream GDD's
  forward-declared contract; no new conflicts introduced on that side.
- `board-and-grid.md` already lists Battle HUD as a Soft downstream
  dependent ("occasional board reads (tile highlight state); mostly reads
  combat/unit state") — consistent with the Board & Grid row above and with
  this document's own Dependencies table.
- `board-rendering-and-juice.md` flags "Battle HUD | shared canvas/layer-
  ordering coordination | Soft — not currently listed as an edge in
  `systems-index.md`'s current Dependency Map" as an open item in its own
  Dependencies section — this document independently reaches the identical
  conclusion (Rule 13) and the identical "flag for `/consistency-check`"
  resolution. Both documents agree; only `systems-index.md` needs updating.
- **New clarification this document adds:** `input-and-selection.md`'s Core
  Rule 1 ("Two input methods, one shared state machine") predates Battle
  HUD's authoring and does not mention HUD-driven selection (clicking a
  hero's ability-bar row/icon) as a third path into that same state
  machine. This document proposes ability-bar interaction be treated as
  fully equivalent to a board click against the same unit — not a third
  independent state machine — and flags this as a required amendment to
  `input-and-selection.md`'s Core Rule 1 (see Open Questions).

## Formulas

All formulas are deterministic, pure display-layer derivations of
already-owned upstream values — this system computes no new gameplay state,
only presentation. Examples use the default **8×8** board (registry
constants `grid_width`, `grid_height`) and the registered `manhattan_distance`
formula's output range where noted.

### F1. Phase Display-State Mapping

`displayState(phase) = Planning if phase == PlayerPhase else Resolving`

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| current phase | `phase` | enum | one of the 7 Turn & Phase Manager phases | Sourced live, never cached |
| display state | `displayState` | enum (output) | `{Planning, Resolving}` | The only phase-level fact Zone A shows by default (Rule 3) |

**Output range:** exactly one of 2 values. **Worked example:** `phase =
Environment` → `displayState = Resolving`. `phase = PlayerPhase` →
`displayState = Planning`. The exact phase name (`Environment`, `Spawn`, …)
remains available in the Zone A tooltip, unaffected by this mapping.

### F2. HP Bar Fill & Critical State

`fillRatio(hp, maxHP) = clamp(hp / maxHP, 0, 1)` ·
`isCritical(hp, maxHP) = fillRatio(hp, maxHP) ≤ hp_critical_threshold_pct`

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| current HP | `hp` | int | ≥0 (Combat Resolution's vitality model) | Sourced from the Unit Registry entry |
| max HP | `maxHP` | int | ≥1 (`HeroDefinition.maxHP` or enemy archetype `maxHP`) | Chassis-level authored data |
| fill ratio | `fillRatio` | float (output) | `[0, 1]` | Proportional bar fill |
| critical threshold | `hp_critical_threshold_pct` | float | 0.10–0.40 (Tuning Knobs, default 0.25) | Below-or-equal this ratio triggers the critical glyph |
| is critical | `isCritical` | bool (output) | — | Drives the non-color critical-state icon (Rule 5) |

**Output range:** `fillRatio ∈ [0, 1]`. **Worked examples:** `hp=2, maxHP=6`
→ `fillRatio=0.333`, `isCritical=false` (0.333 > 0.25). `hp=1, maxHP=6` →
`fillRatio=0.167`, `isCritical=true`. `hp=0` (mid-frame before `removeUnit`
fires, Edge Cases) → `fillRatio=0`, `isCritical=true`.

### F3. Turn/Objective Countdown Display

`turnsRemainingDisplay(currentTurn, max_turns) = max(0, max_turns −
currentTurn + 1)` when `max_turns` is set (non-null); the sentinel
`"No Limit"` when `max_turns == null`.

This reuses `turn-and-phase-manager.md`'s Formula F1 shape (`turnsRemaining =
max_turns − currentTurn + 1`) applied to two already-owned values —
`currentTurn` (Turn & Phase Manager) and `max_turns` (Objective / Win-Lose,
per its Rule 7) — that no single upstream system holds together. This is a
display-layer composition, not a re-derivation of either owning system's
formula.

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| current turn | `currentTurn` | int | ≥1 | Turn & Phase Manager's exposed value |
| turn limit | `max_turns` | int \| null | ≥1 or unset | Objective's `ObjectiveConfig.max_turns` |
| turns remaining (display) | `turnsRemainingDisplay` | int \| `"No Limit"` (output) | `[0, max_turns]` or sentinel | Rendered in Zone B for Survive/Protect (required) or Clear/Reach (only if a deadline is set) |

**Output range:** `[0, max_turns]` when set. **Worked example:**
`currentTurn=4, max_turns=7` → `turnsRemainingDisplay = 4` (turns 4, 5, 6, 7
remain, inclusive of the current turn — matches
`objective-and-win-lose.md`'s inclusive `turn ≥ max_turns` victory boundary).
At `currentTurn=7`, `turnsRemainingDisplay = 1` (this is the final turn).

### F4. Heroes-In-Danger (End Turn soft-confirm predicate)

```
telegraphedTiles(turn) = ( ⋃ { e.Intent.telegraphedEffectTiles : e ∈ livingEnemies } )
                          ∪ enemy.telegraphedEnvironmentTiles(turn)
heroesInDanger(units, turn) = { h ∈ units : h.faction == Hero ∧ h.alive
                                  ∧ h.tile ∈ telegraphedTiles(turn) }
softConfirmRequired = ( |heroesInDanger| > 0 ) ∧ ( end_turn_confirm_on_threatened_hero == true )
```

This precisely defines `telegraphedTiles(turn)` as the union of two
already-owned sets, both published by Enemy, Abilities & Telegraph: every
living enemy's `Intent.telegraphedEffectTiles`
(`enemy-abilities-and-telegraph.md`'s published `Intent` schema, Rule 8 of
that document) **and** `enemy.telegraphedEnvironmentTiles(turn)`, the
environmental-hazard telegraph query that same system owns per
`cross-system-contracts.md` §9 (resolving C4). This both **resolves**
`move-preview.md`'s Open Question #3, which proposed but could not confirm a
`getTelegraphedTiles(turn) -> Set<tile>` contract before Enemy, Abilities &
Telegraph was designed, **and closes the environmental-hazard gap** an
earlier revision of this formula flagged: `heroesInDanger` previously
under-counted a hero standing only in an environmental hazard's telegraphed
path (not an enemy's); it now covers both sources identically. Move
Preview's threat overlay performs the same two-set union per the identical
contract clause, so the two systems' notion of "currently threatened tiles"
can never drift.

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| unit registry | `units` | map | ≥0 entries | Same registry Objective / Win-Lose reads (`battleState.units`) |
| living enemies | `livingEnemies` | set | 0..N | Enemies with `alive == true` |
| environmental telegraph tiles | `enemy.telegraphedEnvironmentTiles(turn)` | set of coord | 0..N tiles | Owned by Enemy, Abilities & Telegraph (`cross-system-contracts.md` §9); queried, not re-derived |
| heroes in danger | `heroesInDanger` | set (output) | 0..`squad_size` | Alive heroes on a currently-telegraphed effect tile (enemy-intent or environmental) |
| soft-confirm required | `softConfirmRequired` | bool (output) | — | Drives the End Turn `ArmedConfirm` state |

**Output range:** `|heroesInDanger| ∈ [0, squad_size]` (0–5 given
`squad_size`'s 2–5 safe range; `squad_size = 3` by default). **Worked
example:** 3 heroes alive at `(2,2)`, `(4,4)`, `(5,5)`; two living enemies
telegraph `telegraphedEffectTiles = {(4,4)}` and `{(6,6)}` respectively, and
`enemy.telegraphedEnvironmentTiles(turn) = {(2,2)}` (an environmental hazard
telegraphed independently of any enemy's intent) → `telegraphedTiles(turn) =
{(2,2),(4,4),(6,6)}` → `heroesInDanger = {hero@(2,2), hero@(4,4)}` →
`softConfirmRequired = true` (default knob). Without the environmental term,
`hero@(2,2)` would have been silently missed — this is exactly the gap the
union closes.

### F5. Visible-Enemy Legibility Guidance

A non-binding design-guidance formula, structurally identical in intent to
`move-preview.md`'s Formula F2 (chain-length guidance): it reports a count,
it does not clamp or hide anything.

`enemyPanelLoad(enemyCount) = enemyCount` ·
`overRecommended = enemyCount > max_recommended_visible_enemies`

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| living enemy count | `enemyCount` | int | 0..~15 typical (`enemy-abilities-and-telegraph.md`'s own performance-budget assumption) | Current living enemy count |
| recommended cap | `max_recommended_visible_enemies` | int | 4–12 (Tuning Knobs, default 8) | A content-authoring guidance value, not a hard runtime limit |
| over-recommended flag | `overRecommended` | bool (output) | — | Signal only — never truncates or merges Zone D / Threat Ticker rows |

**Output:** boolean guidance flag. **Worked example:** `enemyCount = 11`,
`max_recommended_visible_enemies = 8` → `overRecommended = true`. Battle HUD
still renders all 11 HP bars and all 11 Threat Ticker rows in full — this
flag is a signal for Encounter Generator to reconsider that battle's enemy
density (matching `move-preview.md`'s precedent: "an oversized `diffEvents`
is a signal the ability's design violates Pillar #5… Move Preview enforces
nothing here, it only reports the number").

## Edge Cases

- **HP hits 0 the same frame `removeUnit` fires:** the HP bar shows `0/max`
  (empty fill, `isCritical = true`) for exactly the one frame between the
  `DamageApplied`/`HazardApplied` event and the `UnitRemoved` event; it
  never shows a stale pre-damage value and never renders a negative fill.
- **A hero's Ability slot has zero legal targets this turn:** the ability
  bar renders the `Unavailable — No Legal Target` state (Rule 8), not
  hidden and not visually identical to `Used`; clicking it opens the
  Inspect panel showing "no legal targets" as explicit text — never a
  silent no-op.
- **A `Line` ability's chosen direction would hit nothing** (the "empty
  corridor" case from `heroes-and-abilities.md`): surfaced by Move Preview's
  own UI requirement ("this will hit nothing"); Battle HUD's ability bar has
  no special-case here — the board-level targeting warning is Move
  Preview's / Input & Selection's responsibility, not duplicated in Zone C.
- **Squad has fewer than `squad_size` living heroes (some defeated):** the
  `Down` row(s) (States and Transitions) remain visible in their original,
  fixed list position — the ability bar never re-sorts or collapses rows,
  so the panel's layout never visually "jumps." A `Down` row shows a
  dimmed portrait, an explicit "Down" glyph plus cause (`Defeated`/`Fell`),
  and no HP bar, ability icon, or Move/Ability slot icons (all N/A,
  distinct from `Used`).
- **Zero living enemies remain** (a Clear-type battle near-won, or any type
  mid-clear): Zone D and the Threat Ticker render nothing — an empty
  display reads as "confirmed safe," matching Enemy's own Idle-icon design
  philosophy (absence of a marker means absence of a threat, never an
  ambiguous "missing data" state).
- **An enemy telegraphs `Idle`:** collapsed into the Threat Ticker's "N
  idle" summary line (Rule 14), never simply omitted — omission would be
  visually indistinguishable from "no telegraph computed yet," a state that
  should never occur once Setup completes (`turn-and-phase-manager.md`'s
  setup-telegraph guarantee).
- **The player presses End Turn while `ArmedConfirm`, then takes no further
  action for longer than `end_turn_confirm_timeout_ms`:** the armed state
  silently disarms back to `Ready`; the next End Turn press starts a fresh
  arm cycle — a confirm is never left waiting indefinitely, which would
  risk an accidental far-later commit.
- **The player presses End Turn (arming confirm), then Undoes an action
  before pressing End Turn again:** the live board changed, so
  `heroesInDanger` (Formula F4) is recomputed from scratch on the next End
  Turn press; a previously armed confirm is invalidated by any board
  mutation (mirrors Move Preview's staleness philosophy — a confirm
  computed against a board that no longer exists is never honored).
- **`end_turn_confirm_on_threatened_hero` is `false`:** End Turn always
  commits on a single press regardless of `heroesInDanger` — a legitimate
  "I know what I'm doing" mode, not a degraded state.
- **The Undo button is pressed with an empty undo stack:** per Rule 11 the
  button is already disabled/greyed and not clickable in this state; if a
  press somehow reaches the handler anyway (e.g. a buffered-hotkey edge
  case forwarded by Input & Selection), it is a no-op with the same
  rejection cue `input-and-selection.md` defines for other rejected inputs.
- **`evaluate()`'s terminal result fires (`Victory`/`Defeat`) mid-frame:**
  the End Turn and Undo/Redo controls both immediately transition to
  `Disabled` (`turn-and-phase-manager.md` — there is no `Ended → InTurn`
  transition), and the win/lose banner (`objective-and-win-lose.md`'s
  Visual/Audio Requirement) takes visual precedence over the six zones
  without removing them — the final board state remains visible underneath,
  satisfying Pillar #1's "see exactly what happened."
- **A hero is involuntarily pushed onto a hazard tile mid-Player-Phase by an
  ally's Shove** (friendly fire, `heroes-and-abilities.md` Rule 14): the HP
  bar updates immediately from the emitted `damage`/`applyHazard` events
  exactly as it would for enemy-caused damage; the HUD applies no
  faction-based filtering or softening, matching Combat Resolution's
  faction-agnostic primitive layer.
- **The Reach objective's goal tile is currently occupied by a living
  enemy:** the on-board goal marker (Board Rendering & Juice) renders in a
  distinct "occupied, not satisfied" visual state, and Zone B's distance
  readout continues showing a non-zero distance from the *nearest living
  hero* rather than reading as "reached" — this directly prevents the "why
  didn't I win, an enemy is standing there" misread
  `objective-and-win-lose.md`'s own Edge Cases flags as possible.
- **More than `max_recommended_visible_enemies` (Formula F5) enemies are
  alive simultaneously:** every one still gets its own HP bar and Threat
  Ticker row; Battle HUD never merges, hides, or paginates enemy state
  (Pillar #1 is absolute, matching `move-preview.md`'s "never hides or
  summarizes consequences to stay readable" precedent) — exceeding the
  recommendation is a signal for Encounter Generator, not something this
  system corrects at runtime.
- **A hero is both threatened (`heroesInDanger`) and the Protect objective's
  protected unit:** the protected-unit HP bar (Zone B) and that hero's
  ability-bar HP bar (Zone C) always show identical current-HP values —
  both read the same Unit Registry entry; there is no separate "protected
  unit HP" data source that could drift from the roster panel's own value.
- **Window/viewport is resized below the minimum supported resolution:**
  HUD zones reflow/scale (`hud_scale`, Tuning Knobs) rather than silently
  disappearing. **PROVISIONAL** — the pure-web target's exact minimum
  supported viewport is not pinned by this document (Open Questions).

## Dependencies

**Upstream (Battle HUD depends on):**

| System | Interface | Hard / Soft |
|---|---|---|
| **Board & Grid** ✅ | (indirect, via Objective's `battleState.board` and Formula F3's `manhattan_distance`) tile occupancy/flags for the Reach goal-tile distance readout | **Soft** |
| **Turn & Phase Manager** ✅ | `currentTurn`, `currentPhase`, `undoLevels`/`redoLevels`, phase events; `endPlayerPhase()`/`undo()`/`redo()` write entry points (PROVISIONAL names) | **Hard** |
| **Combat Resolution** ✅ | Full event log for real-time HP/state updates | **Soft** — matches `combat-resolution.md`'s own downstream listing ("Reads events for damage numbers / HP updates — Soft"); HUD's static zones (roster, objective tracker) still render correctly with zero events, only real-time HP deltas are enrichment |
| **Heroes & Abilities** ✅ | Hero roster, HP/`maxHP`, ability name/icon, `legalTargets` count, Move/Ability slot state | **Hard** |
| **Enemy, Abilities & Telegraph** ✅ | Enemy roster/HP, `Intent`/`SpawnIntent`/`Idle` records, `enemy_action_whiffed` events | **Hard** |
| **Objective / Win-Lose** ✅ | `EvaluationResult`, `ObjectiveConfig`, `enemiesRemaining` | **Hard** |
| **Move Preview** ✅ | `Ready` preview state and predicted HP/damage deltas (Rule 16) | **Soft** — the glance-view HP bars function correctly with zero active preview; the predicted-overlay is enrichment only |
| **Input & Selection** ✅ | Selected unit, available action modes, `Inspect` target | **Hard** |
| **Board Rendering & Juice** ✅ | Shared canvas/viewport (layer-ordering only, no gameplay data) | **Soft** |
| **Pilots** ✅ (#25) | A mech's **effective** action-slot count when a pilot skill grants extra uses, plus which skill is granting it | **Soft** — display-only, and a no-op when no such skill is equipped. But when one *is*, showing the chassis default instead of the effective count breaks Pillar 1 (see Interactions) |
| **Settings / Options** ✅ (#28) | `ui_scale`, `colorblind_mode`, `reduced_motion` | **Hard** |
| **Accessibility** ✅ (#27) | A1/A3/A4/A7 as **blocking** per-screen verification gates, not runtime data | **Hard** |

**Downstream (systems that depend on Battle HUD):** none currently — Battle
HUD is a presentation leaf. `systems-index.md`'s Dependency Map lists no
system depending on Battle HUD, and this document introduces none.

**Bidirectional-consistency notes:**
- `turn-and-phase-manager.md`, `combat-resolution.md`,
  `heroes-and-abilities.md`, `enemy-abilities-and-telegraph.md`,
  `objective-and-win-lose.md`, and `move-preview.md` each already list
  Battle HUD as a downstream dependent with an interface consistent with
  (or a superset of) the Upstream rows above — no conflicts found.
- `board-rendering-and-juice.md` already flags the Battle HUD edge as
  missing from `systems-index.md`'s Dependency Map (its own Dependencies
  section, downstream table) — this document reaches the same conclusion
  independently (Rule 13); both should be reconciled by adding a Soft,
  bidirectional Battle HUD ↔ Board Rendering & Juice edge to
  `systems-index.md`.
- `input-and-selection.md` already lists Battle HUD as a Hard downstream
  dependent ("selected unit, available action modes, Inspect-panel
  target… HUD renders whatever Input & Selection reports; Input & Selection
  never renders UI chrome itself") — consistent with the Upstream row
  above. This document additionally proposes ability-bar clicks be treated
  as a second, equivalent path into that same shared state machine — see
  Open Questions for the required amendment to that document's Core Rule 1.
- `audio-system.md` lists Battle HUD as a **peer**, not a dependency — this
  document agrees; no data flows between the two.

## Tuning Knobs

| Knob | Default | Safe Range | Category | Too Low | Too High |
|---|---|---|---|---|---|
| `hp_critical_threshold_pct` | 0.25 | 0.10–0.40 | Curve | Below ~0.10, a unit can be one hit from death with no critical-state warning shown, undercutting Pillar #1's "see the danger coming" | Above ~0.40, the critical glyph triggers so early it stops meaning "danger," diluting its own signal value |
| `end_turn_confirm_on_threatened_hero` | `true` | bool | Gate | `false` removes the soft-confirm safety net entirely — a legitimate "I know what I'm doing" speed mode, not a broken value | N/A (bool) |
| `end_turn_confirm_timeout_ms` | 4000 ms | 2000–8000 ms | Feel | Too short and a player who glances away mid-decision loses the armed state before they can react, feeling arbitrary | Too long and a stale armed confirm can be accidentally triggered by an End Turn press made much later, for an unrelated reason, against a board the player has since mentally moved past |
| `max_recommended_visible_enemies` | 8 | 4–12 | Curve (guidance only) | A very low value makes Formula F5's `overRecommended` flag trigger on ordinary encounters, diluting its usefulness as a signal | A very high value lets Encounter Generator author enemy-dense battles that exceed Pillar #5's "read in ten seconds" test before this guidance flag ever fires |
| `hud_scale` | 1.0 | 0.75–1.5 | Gate (accessibility) | Below 0.75, text/icons risk falling under the minimum readable size at common resolutions | Above 1.5, HUD chrome can crowd out board visibility on smaller viewports |
| `hud_min_font_size_px` | 14 px (at `hud_scale=1.0`) | 12–20 px | Gate (accessibility) | Below 12px, numeric HP/turn values fail the Accessibility Checklist's "text readable at minimum font size" requirement on typical desktop viewing distances | Above 20px as a *minimum*, HP-bar numeric labels start crowding the bar's own proportional-fill graphic at default zone widths |
| `near_loss_turn_warning_threshold` | 2 turns | 1–4 turns | Gate | `1` gives the player almost no lead time to react to an approaching Survive/Protect/deadline turn limit | `4` on a typical 4–8 turn battle (`game-concept.md`'s pacing target) means the warning is active for most of the battle, diluting its urgency signal |
| `protected_unit_warning_hp_pct` | 0.30 | 0.10–0.50 | Gate | Below 0.10, the Protect near-loss warning fires too late to act on (one hit from Defeat with no lead time) | Above 0.50, the warning is active for most of a typical Protect mission, diluting urgency |
| `threat_ticker_max_rows_before_scroll` | 10 | 6–15 | Feel | Below 6, the ticker scrolls even on modest encounters, adding friction to a quick scan | Above 15, the ticker itself risks becoming a wall of text that fails Pillar #5 before scrolling ever kicks in |

**Interactions between knobs:**
- `end_turn_confirm_timeout_ms` and `end_turn_confirm_on_threatened_hero`
  are coupled by construction — the timeout is meaningless when the knob is
  `false`.
- `near_loss_turn_warning_threshold` should be tuned against
  `objective-and-win-lose.md`'s `max_turns` guidance (safe range 1–50,
  practically 4–10 for a typical VANGUARD battle per `game-concept.md`'s
  pacing target) — a warning threshold close to or above a short mission's
  full `max_turns` value would make the warning effectively permanent.
- `hud_scale` and `hud_min_font_size_px` interact: raising `hud_scale`
  scales every zone proportionally, but `hud_min_font_size_px` is a hard
  floor beneath which text must never render regardless of `hud_scale`,
  guaranteeing the Accessibility Checklist's minimum is never silently
  violated by a low `hud_scale` setting.

**Explicitly NOT knobs here (structural, design-locked invariants):**
- **The two-state `Planning`/`Resolving` phase collapse (Rule 3)** is a
  fixed legibility decision, not a tunable display mode — exposing the raw
  seven-phase enum as an alternative default would reintroduce a
  Pillar #5 regression this document exists to prevent.
- **Dual-encoding on every HP bar (Rule 5)** is never optional — a
  color-only HP display would violate the Accessibility Checklist
  unconditionally.

## Visual/Audio Requirements

*(Detailed visual style — exact palette, iconography artwork, typography —
is deferred to `art-director`; the following are functional, testable
requirements this system imposes on that downstream work.)*

**Visual — legibility and accessibility contract:**
- **Dual-encoding on every HP bar** (Rule 5): numeric text **and**
  proportional fill, always both, never color alone for the critical state.
- **Contrast:** all HUD text must meet at least WCAG 2.1 AA contrast
  (4.5:1 for body text, 3:1 for large/bold text) against its background at
  every supported `hud_scale`.
- **Icon-first, not color-first, telegraph taxonomy** (Rule 6): every
  telegraph icon family (`damage`, `push`/`pull`, `spawnHazard`/
  `applyHazard`, movement, Idle, spawn-imminent) must be distinguishable by
  shape/icon alone, in monochrome, matching a protanopia/deuteranopia
  simulation test — this is the same standard `board-rendering-and-juice.md`
  already applies to its own on-tile rendering of the identical taxonomy;
  Battle HUD's Threat Ticker mini-icons must reuse the *exact same* shapes,
  not a second, divergent icon set.
- **No flashing content without warning:** any pulse/blink used for a
  near-loss warning (Tuning Knobs) is capped at a rate that stays under
  standard photosensitive-safety thresholds (no more than 3 flashes per
  second, matching the general guidance `board-rendering-and-juice.md`
  already applies to its own flash/pulse VFX); a first-occurrence warning
  state fades in over ≥200ms rather than snapping on, avoiding a sudden
  flash on first appearance.
- **Scales correctly at all supported resolutions:** every zone's layout is
  relative/proportional (via `hud_scale`), not hardcoded to a fixed pixel
  grid; text never drops below `hud_min_font_size_px` regardless of
  viewport size.
- **Verb-family color consistency:** any HUD element that echoes a verb
  family (ability icons in Zone C, Threat Ticker mini-icons in Zone D) uses
  the exact accent color that family already owns per
  `heroes-and-abilities.md` / `board-rendering-and-juice.md`'s
  `verb_family_palette_size` system — Battle HUD never introduces a second,
  competing color assignment for the same verb family.
- **Silhouette-preserving:** HUD chrome (panels, bars) must not obscure a
  unit's identifying silhouette on the board itself — Zone C/D portraits are
  HUD-space thumbnails, not overlays on the live board sprite.

**Audio (hooks only — this system owns zero audio playback, per
`audio-system.md`'s peer relationship):**
- End Turn commit, Undo, and Redo each expose a distinct UI event
  (`hud_end_turn_committed`, `hud_undo`, `hud_redo`) for Audio System to map
  to `sfx_ui_*` cues — Battle HUD never plays a sound directly.
- The near-loss warning state's *appearance* (not its ongoing pulse) exposes
  a one-shot event for a distinct audio sting, paired with its visual per
  the project's "every audio cue paired with a simultaneous visual cue"
  convention (`input-and-selection.md`'s established rule, reused here).
- The ArmedConfirm state's arming and disarming are each distinct, silent
  visual transitions unless Audio System chooses to add its own cue — this
  document does not require audio for the soft-confirm, only permits it.

## Subtitles / Dialogue

Not applicable — Battle HUD's scope contains no dialogue or voiced content
(`game-concept.md`'s "light narrative framing" places any narrative text
outside the in-battle HUD). No subtitle system is required by this
document.

## Acceptance Criteria

All criteria are deterministic and independently testable against a fake/mock
upstream state (Turn Manager, Combat Resolution, Heroes & Abilities, Enemy
Abilities & Telegraph, Objective, Move Preview, Input & Selection) exposing
the read contracts this document specifies — no wall-clock time, no RNG, no
real rendering required for the functional criteria. Visual/feel criteria are
ADVISORY (screenshot + lead sign-off), per the project's Testing Standards
for Visual/Feel and UI story types.

**Data sourcing & desync (Rules 4, 18)**
- **GIVEN** a HUD instance freshly mounted mid-battle (no event history
  replayed), **WHEN** its state is queried, **THEN** every zone renders
  correctly from a single pull across the five upstream read contracts —
  no zone is blank or stale.
- **GIVEN** a `DamageApplied` event fires, **WHEN** the next frame renders,
  **THEN** the affected unit's HP bar reflects the new value within that
  same frame.

**Phase display (Rule 3, Formula F1)**
- **GIVEN** `currentPhase = Environment`, **THEN** Zone A shows
  `Resolving`; **GIVEN** `currentPhase = PlayerPhase`, **THEN** Zone A
  shows `Planning`.
- **GIVEN** any of the 7 phases, **WHEN** `displayState` is computed,
  **THEN** it returns exactly one of `{Planning, Resolving}` (no third
  value, no ambiguity).

**HP bars (Rule 5, Formula F2)**
- **GIVEN** `hp=1, maxHP=6, hp_critical_threshold_pct=0.25`, **THEN**
  `isCritical = true` and the bar renders both `"1/6"` numeric text and a
  proportional fill — never fill-only or text-only.
- **GIVEN** a unit's HP reaches exactly 0 in the same frame `removeUnit`
  fires, **THEN** the bar renders `0/max` (never negative) for that frame,
  then the row transitions to `Down`/is removed per the relevant zone's
  rule.

**Ability bar / action economy (Rule 8)**
- **GIVEN** a hero with an Ability slot whose `legalTargets == ∅`, **THEN**
  the Ability slot renders `Unavailable — No Legal Target`, visually
  distinct from `Used`.
- **GIVEN** a hero uses its Move slot only, **THEN** the Move slot reads
  `Used` and the Ability slot independently still reads `Available` (or
  `Unavailable — No Legal Target` if applicable).

**Objective tracker (Rule 12, Formula F3)**
- **GIVEN** `ObjectiveConfig.type = Survive, max_turns = 7`, `currentTurn =
  4`, **THEN** Zone B shows `turnsRemainingDisplay = 4`.
- **GIVEN** `type = Protect`, **THEN** Zone B additionally shows the
  protected unit's HP bar, and that value is identical to the same hero's
  Zone C HP bar value at every frame (no drift).
- **GIVEN** `type = Clear`, **THEN** Zone B shows a live count equal to
  Objective's `enemiesRemaining`.
- **GIVEN** `type = Reach`, **THEN** Zone B shows the registered
  `manhattan_distance` from the nearest living hero to `goalTile`, and this
  value is `0` if and only if a living hero currently occupies `goalTile`.
- **GIVEN** any objective type, **WHEN** queried at two different points in
  the same battle, **THEN** the rendered variant (Survive/Protect/Clear/
  Reach layout) never changes.

**End Turn control (Rules 9–10, Formula F4, States table)**
- **GIVEN** `currentPhase != PlayerPhase`, **THEN** the End Turn control is
  `Disabled` and visibly so.
- **GIVEN** `PlayerPhase`, `heroesInDanger = ∅`, **WHEN** End Turn is
  pressed, **THEN** `endPlayerPhase()` is called immediately (single
  press).
- **GIVEN** `PlayerPhase`, `heroesInDanger ≠ ∅`,
  `end_turn_confirm_on_threatened_hero = true`, **WHEN** End Turn is
  pressed once, **THEN** the control enters `ArmedConfirm` and
  `endPlayerPhase()` is **not** yet called.
- **GIVEN** `ArmedConfirm`, **WHEN** a second press occurs within
  `end_turn_confirm_timeout_ms`, **THEN** `endPlayerPhase()` is called.
- **GIVEN** `ArmedConfirm`, **WHEN** `end_turn_confirm_timeout_ms` elapses
  with no second press, **THEN** the control returns to `Ready` and a
  subsequent single press re-arms rather than committing.
- **GIVEN** `ArmedConfirm`, **WHEN** the live board mutates (e.g. an Undo),
  **THEN** the armed state is invalidated and `heroesInDanger` is
  recomputed fresh on the next press.
- **GIVEN** `end_turn_confirm_on_threatened_hero = false`, **THEN** End
  Turn always commits on a single press regardless of `heroesInDanger`.

**Undo/Redo control (Rule 11)**
- **GIVEN** `undoLevels = 0`, **THEN** Undo is `Disabled`; **GIVEN**
  `undoLevels > 0` and `PlayerPhase`, **THEN** Undo is `Enabled`.
- **GIVEN** `currentPhase != PlayerPhase`, **THEN** both Undo and Redo are
  `Disabled` regardless of stack depth.
- **GIVEN** Undo is `Enabled`, **WHEN** pressed once, **THEN** exactly one
  `undo()` call is issued (no repeat-fire from a single press/hold).

**Telegraph data & Threat Ticker (Rules 6–7, 14; Formula F4)**
- **GIVEN** a living enemy telegraphing a `push`-only ability, **THEN** the
  Threat Ticker shows exactly one verb-family icon for that row.
- **GIVEN** a living enemy telegraphing an ability compiling 3+ distinct
  primitive families, **THEN** the Threat Ticker shows the generic
  "complex threat" glyph (never 3+ stacked icons), and the Inspect panel
  for that enemy shows the full, uncompressed breakdown.
- **GIVEN** an enemy telegraphing `Idle`, **THEN** it is represented only
  in the "N idle" summary line, not as an individual row, unless expanded.
- **GIVEN** the Formula F4 worked example setup, **THEN**
  `heroesInDanger = {hero@(2,2), hero@(4,4)}` exactly — including the hero
  standing only in an environmental telegraph tile, not just enemy-intent
  tiles.

**Inspect panel (Rule 15)**
- **GIVEN** Input & Selection reports an `Inspect` target for any unit
  (friendly, enemy, exhausted, or not), **THEN** the Inspect panel opens
  for that `unitId` and shows uncompressed detail (full ability
  description, exact HP, full slot state as applicable).
- **GIVEN** the Inspect panel is open for unit A, **WHEN** Input & Selection
  reports a new `Inspect` target B, **THEN** the panel immediately switches
  to B with no confirmation step.

**Predicted-outcome overlay (Rule 16)**
- **GIVEN** Move Preview is `Ready` for a candidate affecting unit X,
  **THEN** X's HP bar shows both its committed HP value and a predicted
  delta overlay.
- **GIVEN** Move Preview transitions out of `Ready` (`Stale`, `Discarded`,
  or `Committed`), **THEN** the predicted overlay is removed within the
  same frame.

**Phase-independent visibility (Rule 17)**
- **GIVEN** any non-`PlayerPhase` phase, **THEN** Zones A, B, C (read-only
  parts), and D remain visible and update live; only Zones E/F (End Turn,
  Undo/Redo) are `Disabled`.

### Performance Budget (headless TS benchmarks, decoupled from rendering)

| Operation | Budget | Note |
|---|---|---|
| Full HUD state pull (`getHUDState()`-equivalent, all 6 zones, `squad_size=3`, `enemyCount≤15`) | < 1 ms | Dominated by linear scans across already-cheap upstream reads (Objective's own budget: <0.05ms/call; Combat Resolution event log reads are O(1) per event) |
| Single event-driven zone update (one HP bar, one Threat Ticker row) | < 0.1 ms | No board traversal, pure data projection |
| Formula F4 (`heroesInDanger`) recompute, `squad_size≤5`, `enemyCount≤15` | < 0.2 ms | Linear scan over living enemies' `telegraphedEffectTiles` sets, then a linear membership check over living heroes |
| Full HUD frame update at 60 fps (all zones, worst-case `enemyCount=15`) | < 2 ms | Leaves ample headroom within the 16.6 ms frame shared with Board Rendering & Juice's own `<3ms` Playing-state budget |

## Open Questions

**Needs an architecture decision (→ ADR during `/create-architecture`):**

1. **Battle HUD ↔ Board Rendering & Juice edge missing from
   `systems-index.md`.** Both this document (Rule 13) and
   `board-rendering-and-juice.md` independently flag the same gap: a Soft,
   bidirectional canvas/layer-ordering dependency exists but is not listed
   in the Dependency Map. *Owner:* `/consistency-check`, to add the edge.
2. **Telegraph icon ownership overlap (Rule 13).** This document's assigned
   scope ("telegraph intent icons") and `board-rendering-and-juice.md`'s
   already-published Layer 5 ownership of on-tile telegraph rendering
   overlap on the same pixels. This document resolves the overlap by
   splitting taxonomy-ownership (Battle HUD) from on-tile pixel-ownership
   (Board Rendering & Juice) plus adding a non-duplicative Threat Ticker —
   but the underlying scope assignment in the systems-index/task brief that
   produced the overlap should be reconciled so future systems don't
   re-introduce it. *Owner:* `/consistency-check`, coordinated with
   `art-director`/`game-designer`.
3. **`endPlayerPhase()` / `undo()` / `redo()` method names.**
   `turn-and-phase-manager.md` describes the behaviors these calls trigger
   but does not publish exact method signatures. This document proposes the
   three names above as the concrete contract Battle HUD's write paths
   need. *Owner:* Tech architecture, reconciled with Turn & Phase Manager's
   next revision.
4. **Ability-bar clicks as a second path into Input & Selection's state
   machine.** `input-and-selection.md`'s Core Rule 1 ("two input methods,
   one shared state machine") predates this document and does not name HUD
   interaction as a third path feeding that same machine. This document
   proposes ability-bar row/icon clicks be treated as fully equivalent to a
   board click on the same unit. *Owner:* amend `input-and-selection.md`'s
   Core Rule 1 in its next revision, or via `/consistency-check`.

**Resolved this session (provisional defaults — confirm during
implementation):**

5. **`telegraphedTiles(turn)` is fully defined** (Formula F4) as the union
   of every living enemy's `Intent.telegraphedEffectTiles` **and**
   `enemy.telegraphedEnvironmentTiles(turn)`, resolving `move-preview.md`'s
   Open Question #3 and closing the environmental-hazard gap per
   `cross-system-contracts.md` §9's C4 resolution: Enemy, Abilities &
   Telegraph owns `telegraphedEnvironmentTiles(turn)`, and both
   `heroesInDanger` and Move Preview's threat overlay union it with enemy
   intents identically, so the two systems' notion of "currently threatened
   tiles" can never drift. *Owner:* none — resolved, no further action
   needed.
6. **The Planning/Resolving phase collapse (Rule 3)** is a deliberate
   legibility simplification, not a data loss — the exact phase name
   remains available via tooltip/Inspect. *Owner:* revisit if playtesting
   shows players want more granular phase feedback (e.g. distinguishing
   "still resolving my own action's juice" from "enemies are now acting").
7. **The End Turn soft-confirm (Rule 10) is scoped to hero safety only** —
   it does not warn about sub-optimal but non-lethal outcomes, unused
   ability slots, or other "did you mean to do that" heuristics beyond
   "a living hero is standing in a telegraphed hit." *Owner:* revisit if
   playtesting suggests a broader "are you sure" surface is warranted
   without becoming intrusive.

**Deferred to the owning system's GDD:**

8. **Minimum supported viewport/resolution for the pure-web target.** This
   document assumes `hud_scale` and `hud_min_font_size_px` are sufficient
   to guarantee legibility across supported resolutions but does not pin
   the exact minimum viewport size — that is a platform/technical-
   preferences decision. *Owner:* `technical-director`, when
   `technical-preferences.md`'s platform targets are finalized.
9. **Gamepad-only HUD operability.** Per `input-and-selection.md`'s
   established v1 scope, gamepad input is explicitly out of scope for
   VANGUARD's pure-web PC target — this document's controls (End Turn,
   Undo/Redo, ability-bar interaction) are designed to be reachable by
   keyboard-only (via Input & Selection's existing hotkey/Tab-cycle
   contract) but no gamepad-specific bindings are defined, consistent with
   that document's own deferred scope, not a new gap introduced here.
   *Owner:* revisit if a platform target changes (`input-and-selection.md`
   Open Question #8).
10. **Exact default hotkeys for End Turn / Undo / Redo.** This document
    assumes dedicated bindings exist (e.g. a distinct key for End Turn
    separate from Input & Selection's `Enter`/`Space` commit key) but does
    not pin the exact key, since `input-and-selection.md` formally owns key
    binding assignment. *Owner:* Input & Selection's next revision, or
    Settings / Options (Alpha tier) once key-remapping exists.
