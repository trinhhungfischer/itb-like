# ADR-0011: Environmental telegraph query (C4)

## Status

Accepted

## Date

2026-07-28

## Last Verified

2026-07-28

## Decision Makers

Technical Director (owner). Reconciled against `design/architecture/cross-system-contracts.md`
§9 (canonical, C4) and `docs/architecture/architecture.md` §8 (A11). GDD owners
consulted: Enemy, Abilities & Telegraph; Battle HUD; Move Preview; Audio System.

## Summary

Resolves cross-system contract C4: who owns the *environmental* (non-enemy-intent)
telegraph and how the three consumers that must account for it stay in sync.
Establishes that Enemy, Abilities & Telegraph owns two read-only query methods —
`telegraphedEnvironmentTiles(turn)` and `telegraphedLethalThreatCount(turn)` — and
that Battle HUD's `heroesInDanger` safety check and Move Preview's threat overlay
both **union** the environmental tile set with per-enemy `Intent.telegraphedEffectTiles`
by the identical contract, while Audio's tension score sources `lethalThreats`
from the count. This closes the gap where a hero standing only in an environmental
hazard's telegraphed path (not an enemy's) was silently missed by the danger check.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | None — pure-web stack (TypeScript + PixiJS + Vite) |
| **Domain** | Core / Scripting (simulation-layer read surface; feeds UI and Audio, but is itself renderer-agnostic) |
| **Knowledge Risk** | LOW |
| **References Consulted** | `design/architecture/cross-system-contracts.md` §9; `docs/architecture/architecture.md` §4, §8 (A11); `design/gdd/enemy-abilities-and-telegraph.md` Rule 17 / Formula F6; `design/gdd/battle-hud.md` Formula F4; `design/gdd/move-preview.md` Formula F3; `design/gdd/audio-system.md` Formula F5 |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | None |

**Not applicable / low risk.** VANGUARD is a pure-web project — TypeScript
compiled through Vite, rendered with PixiJS (2D WebGL), persisted to
`localStorage`. There is **no native game engine** (no Godot / Unity / Unreal)
and therefore no engine API surface, no version-migration exposure, and no
post-cutoff engine knowledge gap for this decision. This ADR governs a pure,
deterministic query seam between one owning simulation module and three read-only
consumers (two Presentation-layer, one Presentation-layer Audio); it touches no
renderer, no platform API, and no third-party middleware. The Godot
engine-reference under `docs/engine-reference/` is intentionally **not consulted**
— it does not apply to this build (see `architecture.md` §2).

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0008 (Shared `Unit` record schema, C2 — `telegraphedLethalThreatCount` reads each living hero's `team`, `position`, and `currentHP` from the canonical `unit_record`; the count would have nothing well-defined to evaluate against without that shape) |
| **Enables** | Battle HUD `heroesInDanger` / End-Turn soft-confirm (Pillar #1 safety net); Move Preview threat overlay; Audio System adaptive-tension music bed |
| **Blocks** | Battle HUD Formula F4 implementation; Move Preview threat-overlay implementation; Audio System Formula F5 implementation; the environmental-hazard content that `telegraphedEnvironmentTiles` surfaces (Fire in v1) |
| **Ordering Note** | ADR-0008 must be Accepted first — the lethal-threat count is defined as a predicate over the shared `Unit` record's `team`/`position`/`currentHP` fields, so those must be canonical before this query has a stable contract to evaluate. No ordering constraint against the enemy-`Intent` data contract itself, which Enemy, Abilities & Telegraph already owns. |

## Context

### Problem Statement

VANGUARD's central promise (Pillar #1 — Perfect Information, Perfect Blame) is
that every threat on the board is fully telegraphed one turn in advance, so any
loss is a legible mistake rather than a surprise. Enemy *attack* intents were
already covered: Enemy, Abilities & Telegraph publishes a per-enemy `Intent`
record whose `telegraphedEffectTiles` is the exact, fixed set of tiles an enemy
will hit. But the board also produces threats that belong to **no single enemy's
intent** — environmental hazards that tick during the Environment Phase (Fire in
v1; scripted board events such as a collapsing floor or a rising tide are named
as future flavor). Three separate systems must account for these environmental
threats:

- **Battle HUD** computes `heroesInDanger` to drive the End-Turn soft-confirm
  ("N heroes still in danger — press again to confirm").
- **Move Preview** computes a per-tile `threatened` flag so a planned move that
  dodges every enemy can still be flagged if it lands the hero in a hazard.
- **Audio System** computes a tension score to drive the adaptive music bed.

The question C4 forces is: **who owns the environmental telegraph, and do these
three consumers each re-derive it independently?** If each system separately
combines Board & Grid's raw hazard state with the enemy `Intent` set using its
own logic, three notions of "what is telegraphed this turn" will drift out of
sync — the HUD warns of a danger the preview overlay doesn't show, or the music
swells for a threat the danger check missed. This is exactly the cross-document
drift `cross-system-contracts.md` was created to close. It must be decided before
any of the three consumer systems is implemented, because all three encode the
same union in their published formulas and would otherwise each invent it.

The concrete cost of *not* deciding, already documented in the affected GDDs:
`battle-hud.md`'s earlier revision of `heroesInDanger` under-counted a hero
standing only in an environmental hazard's telegraphed path — a direct Pillar #1
violation, where the player is told they are safe and then loses a hero to a fully
foreseeable hazard.

### Current State

- `difficulty-tiers.md` / `run-structure` reconciliation (C1, ADR-0010) is the
  only comparable ownership-chain ADR already written; C4 is the analogous
  reconciliation for the telegraph read surface and lives implicitly in
  `cross-system-contracts.md` §9.
- `enemy-abilities-and-telegraph.md` Rule 17 already defines the two query
  methods as sibling read surfaces to the per-enemy `Intent` contract, computed
  fresh at the same `chooseIntents()` (Telegraph Phase) moment and held fixed for
  the remainder of that Player Phase, exactly like `telegraphedEffectTiles`.
  Rule 17a defines `telegraphedEnvironmentTiles(turn)` as, in v1, exactly the set
  of tiles Board & Grid currently reports as bearing a `Fire` hazard — a thin
  pass-through over Board & Grid's hazard state, **not** a second source of hazard
  truth. Rule 17b / Formula F6 defines `telegraphedLethalThreatCount(turn)` as a
  pure tally over already-computed data.
- `battle-hud.md` Formula F4 already defines `heroesInDanger` as a union of the
  enemy-intent tiles and `telegraphedEnvironmentTiles(turn)`, and explicitly
  notes this *resolves* its own earlier provisional `getTelegraphedTiles(turn)`
  guess and closes the environmental gap.
- `move-preview.md` Formula F3 already defines `telegraphedTiles(currentTurn)` as
  the identical union, and states it "mirrors Battle HUD's `heroesInDanger` safety
  check, which performs the identical union."
- `audio-system.md` Formula F5 already sources `lethalThreats` directly from
  `telegraphedLethalThreatCount(turn)`.
- All four GDDs cross-flagged, before this reconciliation, that
  `enemy-abilities-and-telegraph.md` "did not yet expose" these queries; Rule 17
  closes that gap. This ADR ratifies and freezes the ownership + union contract so
  no future GDD revision can quietly re-authorize a second derivation.

### Constraints

- **Determinism is a hard invariant (Principle P1).** Both queries are pure
  functions of already-fixed telegraph/board state at the Telegraph-Phase moment;
  no RNG, no wall-clock, no in-battle randomness. Identical board + identical
  intents → byte-identical tile set and count, every call, across reloads and
  undo/redo.
- **One-way layer dependencies (architecture §3).** Enemy, Abilities & Telegraph
  is Feature-layer; Battle HUD, Move Preview (Move Preview is Core, but consumes
  these as read-only queries), and Audio System are downstream read-only
  consumers. The queries are read surfaces only — no consumer mutates anything
  through them, and this system never calls up into a consumer.
- **Single source of hazard truth (Principle P2).** Board & Grid owns hazard
  placement (`getHazard`); `telegraphedEnvironmentTiles` is a *query surface* over
  that state, never a second store of hazard positions. This system owns the
  unified "what is telegraphed" API so consumers do not each re-combine Board &
  Grid hazard state with the enemy `Intent` set, but it never re-derives or caches
  hazard placement itself.
- **The canonical contract wins (Principle P6).** Where any GDD diverges from
  `cross-system-contracts.md` §9, the contract file is authoritative and the GDD
  is corrected.
- **No native-engine or timeline constraints** — pure-web stack; the only timeline
  dependency is that ADR-0008 lands first (see Ordering Note).

### Requirements

- Exactly one owner of the environmental telegraph query surface — Enemy,
  Abilities & Telegraph — exposing exactly two methods:
  `telegraphedEnvironmentTiles(turn) → Set<Tile>` and
  `telegraphedLethalThreatCount(turn) → number`.
- Both Battle HUD `heroesInDanger` and Move Preview's threat overlay MUST compute
  their telegraphed-tile set as the **union** of every living enemy's
  `Intent.telegraphedEffectTiles` with `telegraphedEnvironmentTiles(turn)`, by the
  identical contract, so their notion of "currently threatened tiles" can never
  drift.
- Audio's tension `lethalThreats` MUST source from
  `telegraphedLethalThreatCount(turn)`, never re-tally it independently.
- Both queries are pure, side-effect-free, and idempotent for a given
  `(turn, board, intents)` state — safe to call repeatedly per turn (the HUD may
  recompute on every End-Turn press; Preview on every hover).
- The queries reflect the telegraph as fixed at the Telegraph Phase and held for
  the whole following Player Phase — they do not re-simulate enemy resolution and
  do not shift mid-Player-Phase.

## Decision

Adopt a single-owner query surface with a mandated identical union at the two
tile-consuming sites, exactly as C4 specifies:

1. **Enemy, Abilities & Telegraph is the sole owner of the environmental
   telegraph query surface.** It exposes two read-only methods, computed fresh at
   the same `chooseIntents()` (Telegraph Phase) moment as every per-enemy `Intent`
   and held fixed for the remainder of that Player Phase:

   a. **`telegraphedEnvironmentTiles(turn) → Set<Tile>`** — the set of board tiles
      that will apply an environmental hazard effect (damage, displacement, or
      removal) during the upcoming Environment Phase, independent of any single
      enemy's `Intent`. In v1 this is exactly the set of tiles Board & Grid reports
      as bearing a `Fire` hazard (`getHazard(tile) == Fire`), because Fire ticks
      every Environment Phase until it expires — so any Fire tile visible now is,
      by construction, a one-turn-ahead-visible threat. This is a thin
      pass-through over Board & Grid's hazard state; this system owns the *query
      surface*, never a second store of hazard placement. Future non-Fire scripted
      board events extend this set without changing its contract shape.

   b. **`telegraphedLethalThreatCount(turn) → number`** — the count of
      currently-telegraphed enemy *and* environment actions that would remove ≥1
      hero if unaddressed (Enemy GDD Formula F6): every non-`Idle` enemy `Intent`
      plus every tile in `telegraphedEnvironmentTiles(turn)`, each evaluated
      independently against every living hero's current tile and `currentHP` using
      each threat's already-fixed, deterministic damage value. A pure tally over
      already-computed data — no new simulation, no RNG.

2. **Battle HUD unions the two sets for `heroesInDanger` (Pillar #1 safety net).**
   `heroesInDanger` is the set of living heroes whose current tile is a member of
   `telegraphedTiles(turn) = (⋃ living enemies' Intent.telegraphedEffectTiles) ∪
   telegraphedEnvironmentTiles(turn)`. This drives the End-Turn soft-confirm.
   Pillar #1's safety guarantee is thereby extended from enemy attacks to the
   *environment* — a hero standing only in a hazard's telegraphed path is now
   caught, closing the previously-documented under-count.

3. **Move Preview unions the identical two sets for its threat overlay.** Its
   per-tile `threatened(tile)` flag tests membership in the same
   `telegraphedTiles(currentTurn)` union. Move Preview does not simulate how the
   enemy's action resolves — it only checks whether the previewed final tile sits
   on an already-announced enemy or environmental target tile. Because HUD and
   Preview use the *same* two published sets by the *same* contract clause, their
   notion of "currently threatened tiles" can never drift.

4. **Audio sources `lethalThreats` from the count.** Audio System Formula F5's
   tension score reads `lethalThreats = telegraphedLethalThreatCount(turn)`
   directly (normalized against a cap of 3 simultaneous lethal threats), never
   re-computing lethality itself.

5. **Consumers read, never re-derive.** No consumer re-combines Board & Grid's raw
   hazard state with the enemy `Intent` set on its own, and no consumer implements
   a second lethality tally. The two query methods are the single published API for
   "what is telegraphed this turn"; the union at the two tile sites is mandated to
   be identical.

### Architecture

```
                    Board & Grid  (owns hazard placement: getHazard)
                          │  getHazard(tile) == Fire   (v1 environmental source)
                          ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │ Enemy, Abilities & Telegraph   (owns the telegraph query surface)     │
 │   per-enemy Intent.telegraphedEffectTiles      (already owned)        │
 │   telegraphedEnvironmentTiles(turn) → Set<Tile>  (Rule 17a, C4)       │
 │   telegraphedLethalThreatCount(turn) → number    (Rule 17b / F6, C4)  │
 │   — computed at chooseIntents() (Telegraph Phase), fixed for the turn │
 └───────┬───────────────────────────┬──────────────────────┬───────────┘
         │ enemy tiles + env tiles    │ enemy tiles + env    │ lethal count
         │ (UNION)                    │ tiles (UNION)        │
         ▼                            ▼                      ▼
 ┌───────────────┐          ┌──────────────────┐   ┌────────────────────┐
 │  Battle HUD   │          │   Move Preview   │   │   Audio System     │
 │ heroesInDanger│          │ threatened(tile) │   │ tension F5 →       │
 │  (F4 union)   │          │  (F3 union)      │   │ lethalThreats      │
 │  → End-Turn   │          │  → threat        │   │  → music layer     │
 │    soft-confirm│         │    overlay       │   │                    │
 └───────────────┘          └──────────────────┘   └────────────────────┘
   reads shared Unit record (ADR-0008) for hero team/position/currentHP
```

The union of enemy-intent tiles with environmental tiles is performed identically
at exactly two sites (HUD F4, Preview F3) against the *same* published sets; the
lethal count is published once and read verbatim by Audio. Call direction is
strictly downward from the owner to the read-only consumers.

### Key Interfaces

```typescript
// ── Owned by Enemy, Abilities & Telegraph — the ONLY environmental telegraph
//    query surface (cross-system-contracts.md §9, resolving C4).
//    Both pure & deterministic; computed at Telegraph Phase, fixed for the
//    following Player Phase; safe to call many times per turn.

// The set of tiles that will apply an environmental hazard effect during the
// upcoming Environment Phase, independent of any single enemy's Intent.
// v1: exactly the tiles where Board & Grid reports getHazard(tile) == Fire.
// A query surface over Board & Grid's hazard state — never a second hazard store.
function telegraphedEnvironmentTiles(turn: number): Set<Tile>;

// Count of currently-telegraphed enemy + environment actions that would remove
// >=1 hero if unaddressed. Pure tally over already-fixed data (Enemy GDD F6):
// every non-Idle enemy Intent + every environmental tile, evaluated against each
// living hero's (team, position, currentHP) from the shared Unit record (ADR-0008).
function telegraphedLethalThreatCount(turn: number): number;

// ── Mandated identical union at the two tile-consuming sites ──────────────────
// Battle HUD (Formula F4) and Move Preview (Formula F3) MUST both compute:
function telegraphedTiles(turn: number): Set<Tile> {
  return union(
    // per-enemy attack tiles — read from each living enemy's Intent (Rule 8)
    flatten(livingEnemies.map(e => e.intent.telegraphedEffectTiles)),
    // environmental tiles — the query above, read not re-derived
    telegraphedEnvironmentTiles(turn),
  );
}
// Battle HUD:  heroesInDanger = livingHeroes.filter(h => telegraphedTiles(turn).has(h.position))
// Move Preview: threatened(tile) = telegraphedTiles(turn).has(tile)

// ── Audio System (Formula F5) reads the count verbatim ────────────────────────
// lethalThreats = telegraphedLethalThreatCount(turn)   // never re-tallied
```

Contract invariants (binding):

- Enemy, Abilities & Telegraph is the ONLY system that exposes
  `telegraphedEnvironmentTiles` / `telegraphedLethalThreatCount`; no consumer
  re-implements either.
- Battle HUD and Move Preview MUST both union the enemy-intent tile set with
  `telegraphedEnvironmentTiles(turn)`; neither may consult Board & Grid's
  `getHazard` directly to build its telegraphed-tile set (that would re-derive the
  environmental term and risk drift).
- Audio MUST source `lethalThreats` from `telegraphedLethalThreatCount(turn)` and
  MUST NOT compute a second lethality tally.
- Both queries MUST be pure and idempotent for a given fixed-telegraph turn state:
  repeated calls within a Player Phase return equal results.

### Implementation Guidelines

- Compute both queries at the same `chooseIntents()` (Telegraph Phase) moment as
  the per-enemy `Intent` records, and hold them fixed for the remainder of that
  Player Phase — exactly like `telegraphedEffectTiles`. They must not shift
  mid-Player-Phase in response to preview dry-runs or partial actions.
- Keep `telegraphedEnvironmentTiles` a *thin pass-through*: read Board & Grid's
  hazard state (v1: `getHazard(tile) == Fire`), do not store or cache hazard
  placement in this system. When scripted board events are authored later, extend
  the set here without changing the method signature.
- Keep `telegraphedLethalThreatCount` a *pure tally*: evaluate each threat's
  already-fixed damage against the shared `Unit` record's `team`/`position`/
  `currentHP` (ADR-0008). Do not run a fresh Combat `resolve()` — this is a count
  over known data, not a simulation.
- Honor Formula F6's documented **scope limitation**: v1 counts only
  `damage`-primitive lethality; a push/pull-only intent that would shove a hero
  into Lethal terrain is *not* counted (its `knownDamage` is 0). This is a
  deliberate v1 approximation, not a bug — the intent is still fully telegraphed
  and visible via the ordinary `Intent` data contract, just not reflected in the
  aggregate tension count. Do not "fix" this silently at a consumer site.
- The two tile-consuming sites (HUD F4, Preview F3) should call the *same* union
  helper against the *same* two published sets; do not let one site inline a
  variant. A hero standing on a tile that is both an enemy effect tile and an
  environmental tile is counted per each site's own rules (HUD: the hero is "in
  danger" once; Audio F6: the two threats are counted independently as they
  resolve in different phases) — preserve each formula's documented dedup behavior.
- All reads are deterministic: no `Date.now()`, no `Math.random()`, no in-battle
  RNG anywhere in either query or in the consumers' union/tally.

## Alternatives Considered

### Alternative 1: Each consumer combines Board hazard state with enemy intents itself

- **Description**: Do not add a dedicated environmental query. Let Battle HUD,
  Move Preview, and Audio each read Board & Grid's `getHazard` directly and combine
  it with the enemy `Intent` set using their own local logic.
- **Pros**: No new methods on Enemy, Abilities & Telegraph; each consumer is
  self-contained.
- **Cons**: Three independent derivations of "what is telegraphed this turn"
  guarantee drift over time — the HUD's danger set, the Preview's overlay set, and
  Audio's lethal tally would each evolve separately and disagree (e.g. HUD warns of
  a hazard the overlay doesn't highlight). Directly violates Pillar #1: the player
  would see inconsistent threat information. Also spreads hazard-interpretation
  logic (what counts as a lethal environmental threat) across three systems, so a
  rule change (e.g. adding a collapsing-floor event) must be edited in three
  places.
- **Estimated Effort**: Lower short-term, higher long-term (triplicated,
  drift-prone logic).
- **Rejection Reason**: Re-creates exactly the multi-consumer drift C4 exists to
  eliminate; the environmental under-count `battle-hud.md` already documented is
  precisely this failure mode.

### Alternative 2: Board & Grid owns the environmental telegraph directly

- **Description**: Put `telegraphedEnvironmentTiles` / `telegraphedLethalThreatCount`
  on Board & Grid, since Board already owns hazard placement.
- **Pros**: The tile set is derived from Board's own hazard state, so the data is
  co-located with its source.
- **Cons**: `telegraphedLethalThreatCount` is fundamentally a *telegraph* concept —
  it must be evaluated against the same Telegraph-Phase snapshot and the same
  living-hero HP/position data that the per-enemy `Intent` lethality uses, and it
  is naturally unioned with the enemy `Intent` set the *telegraph* system owns.
  Putting it on Board & Grid splits the telegraph across two owners (enemy intents
  in one system, environment in Board), forcing every consumer to reach into two
  owners to assemble one "what is telegraphed" picture — the opposite of the
  single unified query surface C4 wants. It also loads Board & Grid (a Foundation
  root with zero gameplay dependencies) with hero-lethality/HP reasoning it has no
  business knowing.
- **Estimated Effort**: Similar.
- **Rejection Reason**: Fractures telegraph ownership and burdens a Foundation root
  with Feature-layer lethality logic; the telegraph system is the natural single
  owner because it already owns the enemy-intent half of the same union.

### Alternative 3: Fold the environmental term into each enemy's `Intent`

- **Description**: Attach environmental hazard tiles to some or all enemy `Intent`
  records so consumers only ever read the per-enemy set.
- **Pros**: One data shape for consumers to read.
- **Cons**: Environmental hazards belong to *no* enemy — attaching them to an
  arbitrary enemy's intent is a category error that breaks the moment there are
  zero living enemies but active hazards, or double-counts if attached to several.
  It also corrupts the clean "this enemy will do exactly this" meaning of
  `telegraphedEffectTiles`, undermining the per-enemy legibility Pillar #1 depends
  on.
- **Estimated Effort**: Similar, with worse edge-case handling.
- **Rejection Reason**: Misattributes ownerless threats to enemies; breaks with
  zero enemies present and muddies the per-enemy intent contract.

## Consequences

### Positive

- **Single source of telegraph truth.** One owner, two published methods; the HUD
  danger set, the Preview overlay set, and the Audio tension count are all built
  from the same published data, so they cannot disagree — satisfying Pillar #1
  across all three consumers simultaneously.
- **Pillar #1 extended to the environment.** `heroesInDanger` now catches a hero
  standing only in a hazard's telegraphed path, closing the documented under-count
  where the player was told "safe" and lost a hero to a foreseeable hazard.
- **HUD and Preview provably consistent.** Both perform the identical union against
  the identical two sets, so "currently threatened tiles" is one concept with two
  render sites, not two concepts that can drift.
- **Clean layering.** Enemy, Abilities & Telegraph owns *what is telegraphed*
  (enemy + environment); Board & Grid keeps sole ownership of hazard *placement*;
  the three consumers are read-only. Each boundary is a TypeScript signature the
  compiler enforces (Principle P6).
- **Deterministic and undo-safe.** Both queries are pure tallies/pass-throughs over
  fixed Telegraph-Phase state, so they replay identically under undo/redo and
  reload (Principle P1).
- **Content extensibility.** Adding a new environmental event (collapsing floor,
  rising tide) extends `telegraphedEnvironmentTiles` in one place; every consumer
  picks it up automatically with no consumer-side change.

### Negative

- **A cross-system contract to police.** Nothing structurally stops a future edit
  from having a consumer read `getHazard` directly to build its own telegraphed set
  (re-deriving the environmental term). This must be guarded by review and an
  architecture/lint check.
- **The v1 lethality scope limitation is a known approximation.** `telegraphed-
  LethalThreatCount` counts only `damage`-primitive lethality; a forced-movement
  intent that shoves a hero into Lethal terrain is an equally real kill that the
  count misses. This is deliberate and documented (Enemy GDD F6 / Edge Cases), but
  implementers and designers must understand the tension music and any count-based
  UI under-represent forced-movement kills in v1.
- **A thin query over another system's state.** `telegraphedEnvironmentTiles` is a
  pass-through over Board & Grid's hazard state; a careless implementation could be
  tempted to cache hazard placement here, creating a second source of truth. The
  guideline forbids it, but it is a discipline point.

### Neutral

- Battle HUD, Move Preview, and Audio all gain a Hard dependency on Enemy,
  Abilities & Telegraph for these queries (previously flagged as "gaps to close"
  in each GDD; Rule 17 closes them). `systems-index.md` and dependency graphs
  should reflect these Hard edges.
- The two queries are sibling read surfaces to the per-enemy `Intent` contract, not
  part of the `Intent` record itself — a deliberate shape choice so ownerless
  threats are never misattributed to an enemy.

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| A consumer re-derives the environmental term by reading `getHazard` directly instead of `telegraphedEnvironmentTiles` | Medium | High (re-forks the contract; drift returns) | Encode the "single query surface / no direct hazard read for telegraph sets" invariant in the control manifest; add an architecture check that HUD/Preview do not call `getHazard` to build their telegraphed-tile set; `/architecture-review` audits C4 traceability. |
| HUD and Preview unions drift (one adds a term or dedup the other lacks) | Medium | Medium (Pillar #1 inconsistency between two views) | Share one union helper against the two published sets; a test asserts HUD's `telegraphedTiles(turn)` equals Preview's for the same board/turn. |
| The v1 lethality scope limitation surprises design (forced-movement kills not counted) | Medium | Low–Medium (music/UI under-sells some kills) | Documented explicitly in Enemy GDD F6 / Edge Cases and here; revisit as a scoped enhancement post-v1, not a silent per-consumer patch. |
| `telegraphedLethalThreatCount` reads stale/re-shaped hero HP or position | Low | High (wrong danger/tension) | Read only the canonical shared `Unit` record (ADR-0008), never a private copy; unit test asserts the count matches a hand-computed expectation for a fixed board. |
| `telegraphedEnvironmentTiles` caches hazard placement, becoming a second source of truth | Low | Medium | Guideline forbids caching; implement as a live pass-through over `getHazard`; review check. |

## Performance Implications

| Metric | Before | Expected After | Budget |
|--------|--------|---------------|--------|
| CPU (frame time) | n/a (new query) | `telegraphedEnvironmentTiles`: linear scan of hazard tiles, ≪ 0.1 ms; `telegraphedLethalThreatCount`: linear over living enemies + env tiles × living heroes (`enemyCount ≤ 15`, `squad_size = 3`), ≪ 0.1 ms | Battle HUD Formula F4 recompute budget < 0.2 ms; full HUD frame < 2 ms; both queries fit well inside it |
| Memory | n/a | Negligible — both return transient sets/scalars, nothing persisted | No stored telegraph copy; hazard placement stays in Board & Grid |
| Load Time | n/a | None — computed at runtime per Telegraph Phase | n/a |
| Network (if applicable) | n/a | None — fully local | None |

Both queries are computed at most once per turn at the Telegraph Phase and then
read (possibly many times) as fixed values during the Player Phase; the reads are
cheap linear scans over already-small collections and sit entirely inside Battle
HUD's documented `< 0.2 ms` Formula F4 budget and Audio's `< 0.1 ms` tension
recompute budget. No per-frame or render-loop cost is introduced.

## Migration Plan

This is a greenfield reconciliation (no shipped code yet); "migration" is the
GDD/architecture alignment already reflected in the source documents.

1. Ratify C4 as the binding ownership + union contract (this ADR). Verify —
   `cross-system-contracts.md` §9, `enemy-abilities-and-telegraph.md` Rule 17 /
   Formula F6, `battle-hud.md` Formula F4, `move-preview.md` Formula F3, and
   `audio-system.md` Formula F5 all describe the same two queries and the same
   union.
2. Implement the two queries on Enemy, Abilities & Telegraph as a live
   pass-through (`telegraphedEnvironmentTiles`) and a pure tally
   (`telegraphedLethalThreatCount`) computed at Telegraph Phase. Verify — unit
   tests over fixed boards match the GDD worked examples (F6's Charger/Lobber/Fire
   example → count of 1).
3. Wire HUD F4 and Preview F3 to the *same* union helper against the two published
   sets; wire Audio F5 to read the count. Verify — a test asserts HUD and Preview
   compute equal `telegraphedTiles(turn)` for the same board/turn.
4. When implemented, add an architecture check that HUD and Preview do not call
   Board & Grid `getHazard` to assemble their telegraphed-tile sets, and that no
   consumer re-implements the lethal tally. Verify — check fails on a deliberately
   wired violation.

**Rollback plan**: If the single-owner query surface proves wrong, supersede this
ADR with a new one. Because both queries are pure functions of Telegraph-Phase
state (no persisted data), changing the ownership or shape invalidates no saved
data — only in-memory wiring changes.

## Validation Criteria

- [ ] Enemy, Abilities & Telegraph exposes `telegraphedEnvironmentTiles(turn)` and
      `telegraphedLethalThreatCount(turn)`; no other system implements either.
- [ ] `telegraphedEnvironmentTiles(turn)` returns exactly the current Fire-hazard
      tiles in v1 (equals a direct enumeration of `getHazard(tile) == Fire`), and
      the empty set when no hazard tiles exist.
- [ ] `telegraphedLethalThreatCount(turn)` returns byte-identical counts for
      identical board/intent state across process restarts and undo/redo, and
      matches the Enemy GDD Formula F6 worked example (count = 1 for the
      Charger/Lobber/Fire setup).
- [ ] Battle HUD `heroesInDanger` includes a hero standing only in an environmental
      telegraph tile (the F4 worked example: `hero@(2,2)` is caught), not just
      enemy-intent tiles.
- [ ] Battle HUD's `telegraphedTiles(turn)` and Move Preview's
      `telegraphedTiles(currentTurn)` are equal for the same board/turn (union
      consistency test).
- [ ] Audio Formula F5's `lethalThreats` equals `telegraphedLethalThreatCount(turn)`
      (no independent tally).
- [ ] No consumer (HUD, Preview, Audio) reads Board & Grid `getHazard` directly to
      build a telegraphed-tile set (static/lint check passes).

## GDD Requirements Addressed

| GDD Document | System | Requirement | How This ADR Satisfies It |
|-------------|--------|-------------|--------------------------|
| `design/gdd/enemy-abilities-and-telegraph.md` | Enemy, Abilities & Telegraph | Rule 17 — this system owns `telegraphedEnvironmentTiles(turn)` and `telegraphedLethalThreatCount(turn)` as sibling read surfaces to the per-enemy `Intent`, computed at Telegraph Phase and held fixed for the Player Phase | Ratifies sole ownership of both queries and the Telegraph-Phase, fixed-for-the-turn computation contract |
| `design/gdd/enemy-abilities-and-telegraph.md` | Enemy, Abilities & Telegraph | Rule 17a — `telegraphedEnvironmentTiles` is a thin pass-through over Board & Grid's hazard state (v1: `getHazard == Fire`), never a second hazard store | Freezes the query-surface-over-Board-state boundary; forbids a second source of hazard truth |
| `design/gdd/enemy-abilities-and-telegraph.md` | Enemy, Abilities & Telegraph | Rule 17b / Formula F6 — `telegraphedLethalThreatCount` is a pure, deterministic tally (no RNG, no re-simulation) over non-`Idle` enemy intents + environment tiles vs. living heroes' HP/position; `damage`-only scope limitation is deliberate | Codifies the pure-tally, determinism, and documented v1 scope limitation as binding contract |
| `design/gdd/battle-hud.md` | Battle HUD | Formula F4 — `heroesInDanger` / `telegraphedTiles(turn)` is the union of every living enemy's `Intent.telegraphedEffectTiles` **and** `telegraphedEnvironmentTiles(turn)`, driving the End-Turn soft-confirm | Mandates the union at the HUD site; extends Pillar #1's safety net to the environment (closes the documented environmental under-count) |
| `design/gdd/move-preview.md` | Move Preview | Formula F3 — `threatened(tile)` tests membership in `telegraphedEnvironmentTiles(currentTurn) ∪ (⋃ enemy Intent.telegraphedEffectTiles)`, read not re-simulated, mirroring the HUD union | Mandates the identical union at the Preview site so HUD and Preview can never drift |
| `design/gdd/audio-system.md` | Audio System | Formula F5 — tension `lethalThreats = telegraphedLethalThreatCount(turn)`, sourced directly from Enemy, Abilities & Telegraph, capped at 3 | Establishes the count as the single source Audio reads; forbids a second lethality tally |

## Related

- Depends on ADR-0008 (shared `Unit` record schema, C2) — the lethal-threat count
  is evaluated against the canonical `Unit` record's `team`/`position`/`currentHP`.
- Canonical contract: `design/architecture/cross-system-contracts.md` §9 (C4).
- Master architecture: `docs/architecture/architecture.md` §4 (module ownership),
  §8 (Required ADR A11).
- Sibling reconciliation ADR: ADR-0010 (Difficulty/tier ownership chain, C1) —
  same "single owner, no parallel derivation" pattern applied to a different
  cross-system contract.
- Owning GDD: `design/gdd/enemy-abilities-and-telegraph.md` (Rule 17, Formula F6).
  Consumer GDDs: `design/gdd/battle-hud.md` (F4), `design/gdd/move-preview.md`
  (F3), `design/gdd/audio-system.md` (F5).
