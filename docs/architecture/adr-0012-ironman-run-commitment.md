# ADR-0012: Ironman run commitment (pilot-death durability)

## Status

Accepted

## Date

2026-07-28

## Last Verified

2026-07-28

## Decision Makers

Technical Director (owner); consulted: Run Persistence (domain owner), Pilots
(requesting system), Turn & Phase Manager, Combat Resolution, Draft / Loadout Meta,
Run Structure / Node Map.

## Summary

`pilots.md` Rule 13 makes pilot death permanent — the only permanent loss in the
design, and the entire source of the system's stakes. Rule 21 asserts this is
protected by an ironman save policy with "no pre-battle checkpoint the player can
reload." **That assertion is currently false**: `run-persistence.md` Rules 2–3
capture a checkpoint at the *start* of each node and resume there, so closing the
browser after a pilot dies restores the pre-battle state with the pilot alive.

This ADR closes the gap by moving the **pilot-death commit point off
`battle_ended` and onto the death event itself** — a narrow, append-only
mid-battle write that is the minimum exception to Run Persistence's
node-granularity rule needed to make permanence real. It also corrects Rule 21's
overclaim: the run remains replayable, only *deaths* become durable.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | None — pure-web stack (TypeScript strict + PixiJS 2D WebGL + Vite) |
| **Domain** | Core / Persistence (`window.localStorage`; no engine API surface) |
| **Knowledge Risk** | LOW |
| **References Consulted** | `design/gdd/run-persistence.md` Rules 2, 3, 10, Edge Cases; `design/gdd/pilots.md` Rules 13, 21, Formula F4; `docs/architecture/adr-0003-run-persistence-save-schema.md`; `docs/architecture/adr-0008-shared-unit-record.md` |
| **Post-Cutoff APIs Used** | None — `localStorage.setItem` is stable and universally supported |
| **Verification Required** | None |

> **Not applicable / low risk.** No native engine is involved. The only platform
> surface is synchronous `localStorage`, already the sole backend fixed by
> ADR-0003 and `run-persistence.md` Rule 8.

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | **ADR-0003** (Run Persistence save schema) — this ADR adds a field to the Run Save domain, so that schema must be Accepted and its migration chain in place. **ADR-0008** (shared `Unit` record) — the death trigger keys on `Unit`'s terminal `Removed(Defeated \| Fell)` state |
| **Enables** | `pilots.md` Rule 13 (permanent death) as an actually-enforced guarantee rather than an aspiration; the Player Fantasy's "hesitation" beat, which requires the loss to be real |
| **Blocks** | Pilots implementation stories; any Run Persistence story that touches the Run Save payload shape |
| **Ordering Note** | ADR-0003 fixes the Run Save envelope and migration model this ADR extends; it must be locked first. The `schemaVersion` bump described in Migration Plan is a normal step on that existing chain, not a new mechanism. |

## Context

### Problem Statement

VANGUARD is **fully deterministic with perfect information** (Pillar 1). It also
persists an in-progress run. Those two facts combine badly with a permanent-loss
mechanic:

> If the player can return to a state before a loss, and the world after that
> state is fully predictable, then no loss is permanent — it is merely a
> suggestion the player may decline.

`pilots.md` names this directly (Rule 21): without a save commitment,
"deterministic replay plus a reloadable mid-run save would make every death
retroactively avoidable, and the entire premise of the system would collapse
into save-scumming."

Rule 21 then asserts the commitment already exists. It does not.

### Current State

Two Designed documents contradict each other:

| Document | Claim |
|---|---|
| `pilots.md` Rule 21 | "there is **no** manual save-slot or pre-battle checkpoint the player can reload to undo a death" |
| `run-persistence.md` Rule 2 | "A checkpoint is captured at the **start of a node (battle)** and after a node resolves" |
| `run-persistence.md` Rule 3 | "Resume restores the player to the **start** of the node/battle they were on" |

Rule 21 is correct that no *manual save slot* exists. It is wrong that no
pre-battle checkpoint exists — one is captured on every node entry, and
`run-persistence.md` Edge Cases explicitly documents resuming from it after a
mid-battle browser close. The `autosave_on_visibility_hidden` knob exists to make
that path *more* reliable.

**The exploit, concretely:** enter a battle → a level-3 pilot's mech is destroyed
on turn 3 → close the tab before the battle resolves → reload → "Continue Run"
restores the start of that same battle, deterministically regenerated
(`run-persistence.md` Rule 3), with the pilot alive.

This was found by inspection while authoring this ADR, not by
`/consistency-check` — that skill compares registry values, and this is a
contradiction between two prose rules with no shared registered constant.

### Constraints

1. **Mid-battle serialization does not exist and is out of v1 scope.**
   `run-persistence.md` Rule 2 is explicit: turn number, hazard overlays, unit
   HP/status, and the undo stack are never persisted, because Turn & Phase Manager
   and Combat Resolution expose no serialize/deserialize contract. This ADR must
   not require one.
2. **Accidental loss must not be punished.** Browser crashes, tab closes, and
   OS-level interruptions are indistinguishable from deliberate quits at the
   storage layer. Any policy that forfeits progress on an unclean exit punishes
   real players for their hardware.
3. **`localStorage` is synchronous and on the main thread.** Writes must stay rare
   and small; a per-turn or per-event write is not acceptable within the 16.67 ms
   frame budget.
4. **Determinism must be preserved.** Any state added must survive
   save → load → replay without altering the encounter (`run-persistence.md`
   Rule 10 / Pillar 1).
5. **Undo must keep working.** `turn-and-phase-manager.md` scopes undo to the
   Player Phase. This ADR must not make an in-phase undo interact with persistence.

### Requirements

| # | Requirement |
|---|---|
| R1 | A pilot death, once it occurs in play, survives any reload — clean or unclean |
| R2 | No mid-battle serialization contract is introduced |
| R3 | An unclean exit costs the player no progress beyond the current battle's turns |
| R4 | At most one additional `localStorage` write per battle, and only when a pilot actually dies |
| R5 | Replay of the same run with the same inputs yields identical state (Pillar 1) |
| R6 | Undo within a Player Phase never touches persistence |

## Decision

**Commit pilot deaths at the moment of death, not at `battle_ended`.**

The Run Save gains one append-only field:

```
RunSave.data {
  ...existing
  pilotDeaths: string[]          // PilotInstance.id, append-only within a run
}
```

When a piloted mech's `Unit` enters `Removed(Defeated | Fell)`, the pilot's id is
appended to `pilotDeaths` and the Run Save is written **immediately** — a single
targeted write, not a full checkpoint. On load, every id in `pilotDeaths` is
applied to `RunState.pilots` as `status: Dead` before play resumes.

The battle itself remains node-granular and replayable. A player who closes the
tab mid-battle still resumes at the start of that battle, exactly as
`run-persistence.md` Rule 3 describes — **but any pilot who had already died stays
dead, and their mech starts the replayed battle on an AI Core.**

### Architecture

```
Combat Resolution ──UnitRemoved(unitId)──► Pilots (F4 death resolution)
                                             │
                                             │ pilot was assigned?
                                             ▼
                                     Run Persistence
                                     commitPilotDeath(pilotId)
                                             │
                                             ▼
                              vanguard.run.v{N}  (single write)
```

Ordering is strict: the death is committed to storage **before** the UI announces
it. A player must never see a death that has not yet been made durable.

### Key Interfaces

```
// Run Persistence — new, narrow entry point
commitPilotDeath(pilotId: string): void
  // Appends to RunSave.data.pilotDeaths and writes the Run Save.
  // Idempotent: appending an id already present is a no-op with no write.
  // Never throws — a storage failure degrades per Rule 8 (session-only) and is
  // surfaced once, exactly like every other write failure.

// Pilots — F4 gains a commit call
resolveDeath(mech):
  if mech.unit.finalState ∈ {Removed(Defeated), Removed(Fell)} and mech.pilotId ≠ null:
      pilots[mech.pilotId].status = Dead
      runPersistence.commitPilotDeath(mech.pilotId)   // NEW — before UI notification
      mech.pilotId = null
```

### Implementation Guidelines

- `pilotDeaths` is **append-only**. No code path removes an entry. Run end
  discards the whole Run Save (`run-persistence.md` Rule 1), which is the only
  way it is cleared.
- Apply `pilotDeaths` during Run Save load, before any system reads
  `RunState.pilots`.
- The write is **not** debounced. Debouncing would reopen exactly the window this
  ADR exists to close.
- Idempotency matters: a replayed battle in which the same pilot dies again must
  not double-append.

## Alternatives Considered

### Alternative 1: Full mid-battle serialization

Persist turn number, board state, hazards, unit HP, and the undo stack, so a
reload resumes mid-battle exactly.

**Rejected.** It is the *correct* long-term answer and it closes the hole
completely — but it requires Turn & Phase Manager and Combat Resolution to expose
a serialize/deserialize contract that `run-persistence.md` Rule 2 explicitly
places out of v1 scope, and it violates R2. It also multiplies save size and
migration surface. Revisit when that contract exists
(`run-persistence.md` Open Questions).

### Alternative 2: Forfeit the battle on unclean exit

If a `battleInProgress` flag is set on load, resolve that battle as a defeat.

**Rejected.** Airtight against save-scumming and trivially cheap, but it violates
R3 by making a browser crash cost the player a battle. `run-persistence.md`
already invests in `autosave_on_visibility_hidden` specifically to *protect*
against unclean exits; this alternative inverts that intent. Punishing a real
player's hardware failure to deter a hypothetical cheater is the wrong trade in a
single-player game.

### Alternative 3: Accept node-granularity and weaken Rule 21

Document that the ironman guarantee applies only across completed nodes, and
amend `pilots.md` to promise less.

**Rejected as the primary answer, partially adopted.** It requires no engineering
at all, and honesty about the limitation is genuinely better than a false claim.
But it leaves the exploit fully open, and the exploit does not merely bend the
rules — it deletes the Player Fantasy. The hesitation beat ("do I risk this tile
with a level-3 pilot aboard?") does not survive the player knowing a reload undoes
the answer. **The Rule 21 correction from this alternative is adopted** (see
Migration Plan); the decision to leave the hole open is not.

### Why replay-without-death is acceptable

Allowing the battle itself to replay looks like a residual exploit. It is much
smaller than it appears **specifically because of Pillar 1**: the player already
had complete information before acting. Enemy intents are fully telegraphed, Move
Preview shows every consequence, and there is no hidden state to discover. A
replay therefore grants almost no new information — it grants a *retry*, which is
a materially weaker thing.

What a replay does return is the ability to undo a mistake across turn boundaries,
which in-phase undo deliberately does not offer. That is a real cost, accepted
here because R3 outweighs it: the alternative punishes crashes. The residual is
bounded, documented, and closes entirely under Alternative 1.

## Consequences

### Positive

- `pilots.md` Rule 13's permanence becomes enforced rather than aspirational, and
  the Player Fantasy's central beat becomes real.
- Cheap: one array field, one entry point, one write per death.
- No new serialization contract; Turn & Phase Manager and Combat Resolution are
  untouched.
- Degrades correctly — a storage failure falls back to `run-persistence.md`
  Rule 8's existing session-only behaviour with no special case.

### Negative

- Introduces the **first** mid-battle write, a deliberate exception to
  `run-persistence.md` Rule 2's node-granularity rule. The exception must stay
  narrow; any future request to widen it should be treated as a request for
  Alternative 1 instead.
- The battle-replay hole remains open. Documented, bounded, not closed.
- One `localStorage` write occurs during a battle, on a frame where a unit was
  removed — a frame already doing more work than most.

### Neutral

- Requires a Run Save `schemaVersion` bump and a migration step (below).
- `pilots.md` Rule 21 must be rewritten to describe the actual guarantee.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The synchronous write causes a frame hitch on the death frame | Low | Low | Payload is small and the write is once-per-death, not per-event. Measure against the 16.67 ms budget during Sprint 2; if it hitches, defer to end-of-turn — **never** to `battle_ended`, which reopens the hole |
| A replayed battle double-appends the same pilot id | Medium | Low | `commitPilotDeath` is specified idempotent |
| The narrow exception erodes into general mid-battle saving | Medium | Medium | This ADR is the only sanctioned mid-battle write. Widening it is Alternative 1 and needs its own ADR |
| Players perceive the asymmetry as a bug ("why is my pilot still dead?") | Medium | Medium | UI must state it plainly on resume. See Validation Criteria |

## Performance Implications

One synchronous `localStorage.setItem` per pilot death — at most `squad_size`
(3) per battle, and 0 in the common case. Payload grows by one short string per
death, bounded by the run's total pilot count. Negligible against the 5–10 MB
per-origin quota `run-persistence.md` already budgets against, and far below the
existing per-node checkpoint frequency.

## Migration Plan

1. Bump the Run Save `schemaVersion` and add a migration step defaulting
   `pilotDeaths` to `[]` for existing saves (normal ADR-0003 chain step — Meta and
   Settings domains are untouched and keep their own versions).
2. Amend `run-persistence.md`: add `pilotDeaths` to the Run Save contents (Rule 1)
   and record the sanctioned exception to Rule 2's node-granularity, naming this
   ADR.
3. **Amend `pilots.md` Rule 21** to state the real guarantee. It currently claims
   no pre-battle checkpoint exists. It should say: deaths are committed at the
   moment they occur and survive any reload; the battle itself remains replayable
   because mid-battle serialization is out of v1 scope.
4. Add `pilotDeaths` handling to Run Save load, applied before any consumer reads
   `RunState.pilots`.

## Validation Criteria

- **GIVEN** a battle in which a piloted mech is `Removed`, **WHEN** the tab is
  closed before `battle_ended` and the run is resumed, **THEN** that pilot's
  `status` is `Dead` and its mech starts the replayed battle on an AI Core.
- **GIVEN** the same scenario, **WHEN** the run resumes, **THEN** the player is
  told explicitly that the pilot was lost and the battle is being replayed.
- **GIVEN** a replayed battle in which the same pilot's mech is destroyed again,
  **WHEN** `commitPilotDeath` is called, **THEN** no duplicate id is appended and
  no redundant write occurs.
- **GIVEN** a mech saved by Passive Module S4 Last Stand, **WHEN** the battle ends,
  **THEN** no death was committed — S4 prevents `Removed`, so the trigger never
  fires (`pilots.md` Rule 15).
- **GIVEN** `localStorage` throws on write, **WHEN** a pilot dies, **THEN** the
  death applies for the session, play is not blocked, and the failure is surfaced
  once per `run-persistence.md` Rule 8.
- **GIVEN** any Player-Phase undo, **WHEN** it executes, **THEN** no persistence
  write occurs (R6) — undo cannot restore a `Removed` unit, so no committed death
  is ever in scope for rollback.
- **GIVEN** a run replayed from the same seed with identical inputs, **WHEN** it
  completes, **THEN** `pilotDeaths` is identical (R5).

## GDD Requirements Addressed

| GDD | Requirement |
|---|---|
| `design/gdd/pilots.md` | Rule 13 (permanent pilot death), Rule 21 (ironman commitment — **amended** by this ADR), Formula F4 (death resolution), Open Question #6 (resolved) |
| `design/gdd/run-persistence.md` | Rule 1 (Run Save contents — extended), Rule 2 (node granularity — sanctioned exception), Rule 8 (storage-failure degradation) |
| `design/gdd/draft-and-loadout-meta.md` | Rule 3a (pilot lethality) — now durable |

## Related

- **ADR-0003** — Run Persistence save schema (this ADR extends the Run Save domain)
- **ADR-0008** — Shared `Unit` record (supplies the `Removed` terminal state)
- `design/gdd/pilots.md` — requesting system
- `design/gdd/run-persistence.md` — domain owner
- `docs/consistency-failures.md` — the Rule 21 / Rule 2 contradiction is logged there
