# ADR-0010: Difficulty/tier ownership chain (C1)

## Status

Accepted

## Date

2026-07-28

## Last Verified

2026-07-28

## Decision Makers

Technical Director (owner). Reconciled against `design/architecture/cross-system-contracts.md`
§8 (canonical, C1) and `docs/architecture/architecture.md` §8 (A10). GDD owners
consulted: Difficulty Tiers, Run Structure / Node Map, Encounter Generator,
Map/Run UI.

## Summary

Resolves cross-system contract C1: who owns a battle node's difficulty tier and
who is allowed to call the Encounter Generator. Establishes a single ownership
chain — Run Structure → `Difficulty Tiers.getEncounterForNode(...)` →
`Encounter Generator.generateEncounter(...)` — in which the `tier` returned by
Difficulty Tiers is the single source of truth for both Map/Run UI display and
the generator's difficulty curve, and Run Structure drops its own authoritative
tier computation (Formula F6 / `MapNode.tierIndex` demoted to a display-only,
non-authoritative pre-battle estimate).

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | None — pure-web stack (TypeScript + PixiJS + Vite) |
| **Domain** | Core / Scripting (simulation-adjacent orchestration; no rendering, physics, or platform API surface) |
| **Knowledge Risk** | LOW |
| **References Consulted** | `design/architecture/cross-system-contracts.md` §8; `docs/architecture/architecture.md` §4, §8 (A10) |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | None |

**Not applicable / low risk.** VANGUARD is a pure-web project — TypeScript
compiled through Vite, rendered with PixiJS (2D WebGL), persisted to
`localStorage`. There is **no native game engine** (no Godot / Unity / Unreal)
and therefore no engine API surface, no version-migration exposure, and no
post-cutoff engine knowledge gap for this decision. This ADR governs a pure,
deterministic orchestration seam between three simulation-layer TypeScript
modules; it touches no renderer, no platform API, and no third-party middleware.
The Godot engine-reference under `docs/engine-reference/` is intentionally **not
consulted** — it does not apply to this build (see `architecture.md` §2).

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0004 (mulberry32 seed strategy — must be Accepted; the chain's reproducibility rests on it); ADR-0008 (Shared `Unit` record schema, C2 — `rosterSnapshot` is composed of canonical `Unit`-derived records) |
| **Enables** | Map/Run UI authoritative tier display; Run Persistence node-granularity resume (re-derives the identical encounter from stored `runSeed` + `nodeId`) |
| **Blocks** | Run Structure / Node Map battle-node entry path; Difficulty Tiers `getEncounterForNode` implementation; Map/Run UI tier badge |
| **Ordering Note** | ADR-0004 and ADR-0008 must be Accepted first. ADR-0004 because a byte-identical `tier`/encounter requires the pinned seed/`mix()` contract; ADR-0008 because `rosterSnapshot` is a read-only projection of the shared `Unit` record and must not re-shape it. |

## Context

### Problem Statement

Difficulty/tier resolution was specified in **two** places with overlapping
authority. `run-structure-node-map.md` carried its own tier computation
(Formula F6 → `MapNode.tierIndex`) and, in an earlier framing, could call the
Encounter Generator directly. `difficulty-tiers.md` independently owns a tier
curve (Formula F1, which also accounts for the player-selected `ascensionOffset`
that F6 never sees) and exposes `getEncounterForNode(...)`. Two systems computing
"how hard is this node" from different formulas, with two possible callers of
`generateEncounter()`, is exactly the drift that cross-system-contracts.md was
created to close. This is contract **C1**. It must be decided before any
battle-node entry code is written, because the entire run→battle hand-off
depends on which system owns the number and who assembles `DifficultyConfig`.

The cost of not deciding: Map/Run UI would show a tier (F6) that the generator's
actual curve (F1 + `ascensionOffset`) can silently disagree with, breaking
Pillar #1 (Perfect Information, Perfect Blame) at the run-structure level — the
player would be shown one difficulty and dealt another. Two callers of
`generateEncounter()` would also fork `DifficultyConfig` assembly, re-introducing
the kind of duplicated logic that guarantees divergence over time.

### Current State

- `docs/architecture/` contains no `adr-*.md` files prior to this reconciliation
  batch; the C1 convention lives implicitly in `cross-system-contracts.md` §8.
- `difficulty-tiers.md` Rule 9 already defines the single entry point
  `getEncounterForNode(runSeed, nodeId, nodeIndex, ascensionOffset, rosterSnapshot)
  → { tier, encounter }`, internally assembles `DifficultyConfig` (its Formulas
  F2–F5), and calls `generateEncounter()` on the caller's behalf. Encounter
  Generator (Rule 12 of its own GDD) already names Difficulty Tiers — not Run
  Structure — as the legitimate direct caller, and forbids being called *into*
  by Difficulty Tiers (no cyclic call).
- `run-structure-node-map.md` Rule 13 already delegates to Difficulty Tiers and
  labels its own Formula F6 / `MapNode.tierIndex` as "display-only,
  non-authoritative." This ADR ratifies and freezes that reconciliation as the
  architecture-level contract so no future GDD revision can quietly re-authorize
  a second authority.

### Constraints

- **Determinism is a hard invariant (Principle P1).** Given identical
  `(nodeIndex, ascensionOffset)` and roster, `tier` and the assembled
  `DifficultyConfig` — and therefore the resulting encounter — must be
  byte-identical across calls and across process restarts. No wall-clock, no
  unseeded randomness. All procedural variety derives from the mulberry32 seed
  strategy (ADR-0004), never from in-battle RNG.
- **One-way layer dependencies (architecture §3).** Run Structure, Difficulty
  Tiers, and Encounter Generator are all Feature-layer. The permitted call
  direction is Run Structure → Difficulty Tiers → Encounter Generator, and
  never the reverse; Encounter Generator must never call into Difficulty Tiers.
- **The canonical contract wins.** Where any GDD diverges from
  `cross-system-contracts.md`, the contract file is authoritative and the GDD is
  corrected (Principle P6). C1's wording there is the binding text.
- **No native-engine or timeline constraints** — pure-web stack; the only
  timeline dependency is that ADR-0004 and ADR-0008 land first.

### Requirements

- Exactly one authoritative tier value per battle node, consumed identically by
  presentation (Map/Run UI) and by the generator's difficulty curve.
- Exactly one caller of `generateEncounter()` — Difficulty Tiers — and exactly
  one assembler of `DifficultyConfig` — Difficulty Tiers.
- Run Structure retains ownership of *when* a battle happens and *node ordering*
  (`nodeIndex`), but not *how hard* it is.
- The chain must be a pure function of its inputs, reproducible for Run
  Persistence resume from stored `runSeed` + `nodeId` + roster state.
- `getEncounterForNode` must be idempotent and side-effect-free for a given
  input tuple (safe to call for a UI preview and again on entry).

## Decision

Adopt a single, strictly-ordered ownership chain for difficulty and encounter
generation, exactly as C1 specifies:

1. **Run Structure / Node Map** is the sole *initiator*. For every
   Battle/Elite/Boss node, on entry (lazily — never pre-computed at map-gen
   time), it calls Difficulty Tiers' single entry point and nothing else. It
   supplies `nodeId` (Formula F3), `nodeIndex` (this node's 0-based ordinal
   along the chosen path), the run-start-fixed `ascensionOffset` (forwarded
   unmodified from Meta-progression / Unlocks), and the current `rosterSnapshot`.
   It does **not** assemble `DifficultyConfig` and does **not** call
   `generateEncounter()` directly.

2. **Difficulty Tiers** is the sole *tier authority and sole caller of the
   generator*. Inside `getEncounterForNode`, it (a) resolves `tier` via its
   Formula F1 (which alone accounts for `ascensionOffset`), (b) assembles
   `DifficultyConfig` via its Formulas F2–F5 (the offline-only complexity budget
   F2 is never a runtime `DifficultyConfig` field), (c) calls Encounter
   Generator's `generateEncounter(runSeed, nodeId, difficultyConfig,
   rosterSnapshot)` unmodified, and (d) returns `{ tier, encounter }`.

3. **Encounter Generator** is the sole *content generator*. It consumes
   `difficultyConfig` as an opaque parameter, owns solvability/retry/fallback
   entirely, and never calls back up the chain.

4. **The returned `tier` is the single source of truth.** It is the value
   Map/Run UI displays *and* the value that shaped the generator's curve — they
   are the same number by construction, so they can never disagree. Run
   Structure stores the returned `tier` for display but never recomputes or
   overrides it.

5. **Run Structure drops its own authoritative tier.** `MapNode.tierIndex` /
   Formula F6 are retained **only** as a display-only, non-authoritative
   pre-battle estimate (so the Map/Run UI can show an approximate difficulty
   before a node is entered) and are **overwritten** by the authoritative `tier`
   the instant `getEncounterForNode` resolves. Run Structure's dependency edge
   moves to Difficulty Tiers (Hard); its dependency on Encounter Generator
   becomes indirect/Soft (no direct call).

### Architecture

```
   Meta-progression/Unlocks                Draft/Loadout Meta
        │ getUnlockedAscensionOffset()          │ rosterSnapshot
        ▼ (ascensionOffset, run-start-fixed)    ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ Run Structure / Node Map          (owns: WHEN + node order)  │
 │   - nodeIndex (ordinal), nodeId (F3)                         │
 │   - F6/MapNode.tierIndex = DISPLAY-ONLY estimate (overwritten)│
 └───────────────┬─────────────────────────────────────────────┘
                 │ getEncounterForNode(runSeed, nodeId, nodeIndex,
                 │                     ascensionOffset, rosterSnapshot)
                 ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ Difficulty Tiers        (owns: HOW HARD — the authoritative  │
 │   - tier = F1(nodeIndex, ascensionOffset)   tier + config)   │
 │   - difficultyConfig = F2–F5 (F2 offline-only)               │
 └───────────────┬─────────────────────────────────────────────┘
                 │ generateEncounter(runSeed, nodeId,
                 │                   difficultyConfig, rosterSnapshot)
                 ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ Encounter Generator     (owns: CONTENT + solvability)        │
 │   - drives the REAL Combat/Heroes/Objective code paths       │
 │   - NEVER calls back into Difficulty Tiers                    │
 └───────────────┬─────────────────────────────────────────────┘
                 ▼
      returns Encounter ──► Difficulty Tiers returns { tier, encounter }
                 │
                 ├──► Run Structure: store authoritative `tier`, start battle
                 └──► Map/Run UI: display `tier`  (SAME number as the curve used)
```

Call direction is strictly downward. There is exactly one caller of
`generateEncounter()` (Difficulty Tiers) and exactly one authoritative producer
of `tier` (Difficulty Tiers).

### Key Interfaces

```typescript
// Owned by Difficulty Tiers — the ONLY entry Run Structure calls for difficulty.
// Pure & deterministic: identical inputs → byte-identical { tier, encounter }.
function getEncounterForNode(
  runSeed: number,
  nodeId: string,
  nodeIndex: number,          // 0-based ordinal along the chosen path (row - 1)
  ascensionOffset: number,    // run-start-fixed; forwarded unmodified from Meta
  rosterSnapshot: RosterSnapshot,   // read-only projection of shared Unit (ADR-0008)
): { tier: number; encounter: Encounter };

// Owned by Encounter Generator — called ONLY by Difficulty Tiers. difficultyConfig
// is opaque to Run Structure. Pure; procedural variety derives from runSeed only.
function generateEncounter(
  runSeed: number,
  nodeId: string,
  difficultyConfig: DifficultyConfig,   // assembled by Difficulty Tiers (F2–F5)
  rosterSnapshot: RosterSnapshot,
): Encounter;

// Run Structure's node record — tierIndex is DISPLAY-ONLY and overwritten.
interface MapNode {
  nodeId: string;
  // ...
  tierIndex: number;   // F6 pre-battle ESTIMATE ONLY, non-authoritative;
                       // replaced by getEncounterForNode().tier on entry
}
```

Contract invariants (binding):

- Run Structure MUST NOT import or call `generateEncounter` directly.
- Run Structure MUST NOT construct `DifficultyConfig`.
- Encounter Generator MUST NOT call any Difficulty Tiers or Run Structure symbol.
- The number rendered by Map/Run UI for a *committed/entered* node MUST be the
  `tier` returned by `getEncounterForNode`, never a locally recomputed value.

### Implementation Guidelines

- Resolve tier via Difficulty Tiers Formula F1 only; F1 is the sole formula that
  incorporates `ascensionOffset`. Never blend F1 with Run Structure's F6.
- Keep `getEncounterForNode` pure and side-effect-free: calling it for a UI
  preview and again on entry with the same inputs must yield identical results
  (whether the second call re-runs generation or returns a cache is Run
  Structure's caching policy, out of scope here; determinism guarantees the
  results match either way).
- `rosterSnapshot` is a read-only projection derived from the shared `Unit`
  record (ADR-0008); do not re-shape the record and do not let the generator
  mutate it.
- All randomness inside the chain is seeded via the mulberry32 strategy
  (ADR-0004), keyed by `runSeed` (+ `nodeId`/salt as that ADR pins). No
  `Date.now()`, no `Math.random()`, no in-battle RNG.
- Persist only `nodeIndex` + `ascensionOffset` (+ `runSeed`, `nodeId`) — never a
  materialized `tier`, `DifficultyConfig`, or `Encounter`; all three are
  re-derived on resume so a balance-knob patch reshapes resumed runs correctly.

## Alternatives Considered

### Alternative 1: Run Structure owns tier and calls the generator directly

- **Description**: Run Structure computes the authoritative tier (Formula F6)
  and calls `generateEncounter()` itself, treating Difficulty Tiers as a passive
  formula library it reads from.
- **Pros**: One fewer hop; Run Structure already had F6.
- **Cons**: F6 cannot see `ascensionOffset` (a per-run player choice), so the
  displayed tier would diverge from the difficulty actually generated — a direct
  Pillar #1 violation. Puts `DifficultyConfig` assembly in the caller,
  duplicating logic Difficulty Tiers owns and inviting drift. Creates a second
  caller of `generateEncounter()`, contradicting Encounter Generator's own Rule
  12.
- **Estimated Effort**: Similar to chosen approach.
- **Rejection Reason**: Re-creates the exact two-authority drift C1 exists to
  eliminate; breaks perfect-information at the run level.

### Alternative 2: Encounter Generator computes its own tier from `nodeIndex`

- **Description**: Collapse Difficulty Tiers into Encounter Generator — pass
  `nodeIndex`/`ascensionOffset` straight to the generator and let it derive both
  tier and content.
- **Pros**: Fewest modules; single call.
- **Cons**: Overloads the generator with progression-curve responsibility it
  does not own, entangling the solvability engine with Ascension/meta concerns.
  Map/Run UI would then have to reach *into* the generator to display a tier, or
  reimplement the curve — reintroducing a second computation. Violates the
  layered ownership boundaries (§4) and Difficulty Tiers' reason to exist.
- **Estimated Effort**: Lower short-term, higher long-term (coupling).
- **Rejection Reason**: Destroys the separation between "how hard" (curve) and
  "what content, solvably" (generator); makes tier display awkward and
  duplication-prone.

## Consequences

### Positive

- **Single source of truth.** The displayed tier and the curve-shaping tier are
  the same value by construction — they cannot disagree, satisfying Pillar #1 at
  the run-structure level.
- **One caller, one assembler.** Exactly one path assembles `DifficultyConfig`
  and calls `generateEncounter()`, eliminating a whole class of divergence bugs.
- **Clean layering.** Run Structure owns *when*; Difficulty Tiers owns *how
  hard*; Encounter Generator owns *content + solvability* — each boundary is a
  TypeScript `interface` the compiler enforces (Principle P6).
- **Deterministic resume.** Persisting only `nodeIndex`/`ascensionOffset`
  (+ `runSeed`/`nodeId`) reproduces tier and encounter exactly, and lets balance
  patches retroactively (and correctly) reshape resumed runs.
- **Cycle-free.** Encounter Generator never calls back up, so the Feature-layer
  call graph stays acyclic.

### Negative

- **One extra hop** (Run Structure → Difficulty Tiers → Encounter Generator)
  versus a direct call. Negligible: Difficulty Tiers' documented overhead is
  < 1 ms; all real latency is the generator's solver work.
- **Two tier numbers coexist** — the F6 display estimate and the authoritative
  `tier`. This is a deliberate, documented split (estimate before entry,
  authoritative on entry), but it is a subtlety implementers must respect: the
  estimate must be visibly overwritten, never trusted for gameplay.
- **A cross-system contract to police.** Nothing structurally stops a future
  edit from re-adding a direct `generateEncounter()` call in Run Structure; this
  must be guarded by review and a lint/architecture check.

### Neutral

- Run Structure's dependency on Encounter Generator becomes indirect/Soft;
  systems-index.md and any dependency graphs should reflect the Difficulty Tiers
  Hard edge.
- `MapNode.tierIndex` remains in the data contract but changes meaning (estimate,
  not authority) — a semantic change, not a schema change.

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| A future edit re-adds a direct `generateEncounter()` call in Run Structure | Medium | High (re-forks the contract) | Encode the "single caller" invariant in the control manifest; add an architecture/lint check that Run Structure does not import the generator; `/architecture-review` audits C1 traceability. |
| Map/Run UI shows the F6 estimate after entry instead of the authoritative tier | Medium | Medium (Pillar #1 violation) | Require the UI to bind the entered-node badge to `getEncounterForNode().tier`; overwrite `MapNode.tierIndex` on resolve; test asserts display == returned tier. |
| F6 estimate and F1 authoritative tier diverge enough to mislead pre-entry | Low | Low | Both are documented as monotonic stepped ramps; the estimate is explicitly labeled approximate in-UI; divergence is bounded and expected only via `ascensionOffset`. |
| `rosterSnapshot` mutated by the generator, breaking determinism | Low | High | Pass a read-only projection (ADR-0008); generator contract is pure; unit test asserts snapshot equality before/after. |

## Performance Implications

| Metric | Before | Expected After | Budget |
|--------|--------|---------------|--------|
| CPU (frame time) | n/a (pre-battle, off the render loop) | Difficulty Tiers overhead < 1 ms per node entry | Generator solver: < 5 s typical / < 20 s worst (its own budget); this ADR adds < 1 ms |
| Memory | n/a | Negligible — `{ tier, encounter }` is transient | No persisted `DifficultyConfig`/`Encounter` |
| Load Time | n/a | Offline catalog validation < 100 ms one-time (Difficulty Tiers Rule 8) | One-time, at content load |
| Network (if applicable) | n/a | None — fully local | None |

The chain runs once per Battle/Elite/Boss node **entry**, entirely off the
per-frame render loop, so it has no frame-budget impact. The dominant cost is
the Encounter Generator's own solver work, unchanged by this decision.

## Migration Plan

This is a greenfield reconciliation (no shipped code yet); "migration" is the
GDD/architecture alignment already reflected in the source documents.

1. Ratify C1 as the binding chain (this ADR). Verify — `cross-system-contracts.md`
   §8, `difficulty-tiers.md` Rule 9/13, `run-structure-node-map.md` Rule 13, and
   `encounter-generator.md` Rule 12 all describe the same chain.
2. Freeze `MapNode.tierIndex` / Formula F6 as display-only in Run Structure;
   ensure it is overwritten by the returned `tier` on entry. Verify — data
   contract comment + UI binding test.
3. When implemented, add an architecture check that Run Structure does not
   import `generateEncounter` and does not construct `DifficultyConfig`.
   Verify — check fails on a deliberately-wired violation.

**Rollback plan**: If the single-authority chain proves wrong, supersede this
ADR with a new one; because only `nodeIndex`/`ascensionOffset` (+ seed/nodeId)
are persisted and tier/encounter are always re-derived, no saved data is
invalidated by changing the ownership.

## Validation Criteria

- [ ] Run Structure contains no direct call to `generateEncounter()` and never
      constructs `DifficultyConfig` (static/lint check passes).
- [ ] `getEncounterForNode(runSeed, nodeId, nodeIndex, ascensionOffset,
      rosterSnapshot)` returns byte-identical `{ tier, encounter }` for identical
      inputs across process restarts.
- [ ] The tier rendered by Map/Run UI for an entered node equals the `tier`
      returned by `getEncounterForNode` (never the F6 estimate).
- [ ] `MapNode.tierIndex` is overwritten with the authoritative `tier` on node
      entry.
- [ ] Encounter Generator references no Difficulty Tiers / Run Structure symbol
      (no upward call).
- [ ] Run Persistence resume, from stored `runSeed` + `nodeId` +
      `nodeIndex`/`ascensionOffset`, re-derives the identical tier and encounter.

## GDD Requirements Addressed

| GDD Document | System | Requirement | How This ADR Satisfies It |
|-------------|--------|-------------|--------------------------|
| `design/gdd/difficulty-tiers.md` | Difficulty Tiers | Rule 9 — single entry point `getEncounterForNode(runSeed, nodeId, nodeIndex, ascensionOffset, rosterSnapshot) → {tier, encounter}`; Difficulty Tiers is the sole caller of `generateEncounter()` and sole `DifficultyConfig` assembler | Ratifies that entry point as the only run→difficulty hand-off and Difficulty Tiers as the sole generator caller |
| `design/gdd/difficulty-tiers.md` | Difficulty Tiers | Rule 10 — tier and `DifficultyConfig` are pure, byte-identical functions of `(nodeIndex, ascensionOffset)`; no wall-clock, no unseeded RNG | Makes determinism a binding chain invariant, anchored to ADR-0004's seed strategy |
| `design/gdd/run-structure-node-map.md` | Run Structure / Node Map | Rule 13 — Run Structure never assembles `DifficultyConfig` or calls Encounter Generator directly; delegates to Difficulty Tiers; returned `tier` is the single source of truth | Codifies the delegation and the single-source-of-truth tier as architecture-level contract |
| `design/gdd/run-structure-node-map.md` | Run Structure / Node Map | Formula F6 / `MapNode.tierIndex` is display-only, non-authoritative and overwritten by the returned `tier` on entry | Freezes F6 as a demoted estimate; requires overwrite on entry and UI binding to the authoritative value |
| `design/gdd/encounter-generator.md` | Encounter Generator | Rule 12 — Difficulty Tiers (not Run Structure) is the legitimate direct caller of `generateEncounter()`; the generator never calls into Difficulty Tiers | Enforces the one-caller / cycle-free constraint |
| `design/gdd/map-run-ui.md` | Map/Run UI | Displays a node's difficulty tier | Guarantees the displayed tier is the same value that shaped the generator's curve, satisfying Pillar #1 (Perfect Information, Perfect Blame) at the run level |

## Related

- Depends on ADR-0004 (mulberry32 seed strategy) — reproducibility of the chain.
- Depends on ADR-0008 (shared `Unit` record schema, C2) — `rosterSnapshot` shape.
- Canonical contract: `design/architecture/cross-system-contracts.md` §8 (C1).
- Master architecture: `docs/architecture/architecture.md` §4 (module ownership),
  §8 (Required ADR A10).
