# ADR-0004: mulberry32 PRNG seed strategy (procedural only)

## Status

Accepted

## Date

2026-07-28

## Last Verified

2026-07-28

## Decision Makers

- Technical Director (owner / sign-off)
- Consulted GDDs: Encounter Generator (canonical source of `mulberry32_prng`),
  Run Structure / Node Map, Draft / Loadout Meta, Run Persistence

## Summary

VANGUARD needs reproducible procedural variety (map layout, encounter assembly,
draft offers) without introducing any non-determinism into battle resolution.
This ADR pins **one shared `mulberry32` PRNG stream plus a `mix()` 32-bit hash
combiner** (registry `mulberry32_prng`) as the single procedural randomness
source, used **only** for map/encounter/draft generation — each consumer feeding
its own fixed salt — and **forbids** any RNG in battle resolution, so that
`runSeed + nodeId` always re-derives a byte-identical encounter (enables resume
and seed-sharing).

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | None — pure-web stack: TypeScript (strict) + PixiJS (2D WebGL) + Vite |
| **Domain** | Core / Scripting (deterministic procedural generation) |
| **Knowledge Risk** | LOW |
| **References Consulted** | `design/architecture/cross-system-contracts.md` (§8), `docs/architecture/architecture.md` (§5d, §8/A4, §9/P1), `design/registry/entities.yaml` (`mulberry32_prng`), `design/gdd/encounter-generator.md` (F1–F2), `design/gdd/run-structure-node-map.md` (F1–F2), `design/gdd/draft-and-loadout-meta.md` (F1–F2), `design/gdd/run-persistence.md` (Rule 10) |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | None at the engine level. This is a pure-algorithm decision with no engine API surface. |

> **Not applicable / low risk.** This project has **no native game engine** —
> it is a pure-web TypeScript + PixiJS + Vite build. There is no Godot / Unity /
> Unreal API surface involved, and no post-cutoff engine version gap to manage:
> `mulberry32` is a self-contained integer-arithmetic routine defined entirely
> in the GDDs and reproduced in this ADR. The `docs/engine-reference/godot/`
> snapshot **does not apply** to this build and was intentionally not consulted.
> The only correctness surface is JavaScript's numeric semantics (see
> Implementation Guidelines), not any engine feature.

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | None |
| **Enables** | Encounter Generator reproducibility (`generateEncounter` Rule 14); Run Persistence resume (`runSeed` + `nodeId` → identical encounter, Rule 10); Run Structure map generation; Draft / Loadout Meta offer generation; the "daily seed" / shareable-run retention hook |
| **Blocks** | Encounter Generator solver implementation; Run Structure node-map generation; Draft offer generation; Run Persistence resume path — none may be implemented until this seed strategy is Accepted |
| **Ordering Note** | Foundation-tier ADR (A4 in `architecture.md` §8). Independent of A1–A3/A5; may be decided in parallel with them, but must precede any procedural-generation code. |

## Context

### Problem Statement

VANGUARD is a roguelike whose Pillar #3 ("Variety Lives in the Draft, Not the
Dice") demands genuine run-to-run variety in the node map, the battles the
Encounter Generator assembles, and the draft offers — while Pillar #1 ("Perfect
Information, Perfect Blame") demands that a battle, once begun, is a fair,
fully-telegraphed, deterministic puzzle the player can solve and be blamed for,
never a dice roll. These two pillars pull in opposite directions unless
randomness is **partitioned**: variety must live entirely in a *pre-battle,
reproducible* meta layer, and battle resolution must contain **zero** RNG.

Three separate systems (Run Structure, Encounter Generator, Draft / Loadout
Meta) independently need seeded pseudo-randomness. Three GDDs (F1/F2 in each)
already reference the same `mix()` + `mulberry32` construction and the registry
already lists it as `mulberry32_prng` with Encounter Generator as canonical
source. Without a formal decision, three risks are live: (a) each consumer
re-deriving or subtly diverging the algorithm, silently breaking cross-system
reproducibility and seed-sharing; (b) an implementer reaching for
`Math.random()` or a `Date.now()`-seeded stream somewhere in the generation or
battle path, permanently destroying determinism; (c) no pinned reference
test-vector, so a future rewrite in the same or another language produces
different values for the same seed. The cost of not deciding is that resume
(Run Persistence Rule 10) and shareable seeds become impossible to guarantee,
and any accidental in-battle RNG voids the preview/undo/replay invariants the
whole simulation architecture rests on.

### Current State

No `adr-*.md` exists yet; `mulberry32_prng` lives only as a registry entry plus
three GDD formula sections that each say "the exact algorithm is pinned via
ADR" (Encounter Generator Open Question #1; Run Structure Open Question #1;
Draft F2). The convention is real but **implicit** — this ADR promotes it to a
formally decided, testable contract before any procedural-generation code is
written.

### Constraints

- **Determinism is a hard invariant** (`architecture.md` Principle P1): same
  inputs → byte-identical output, across reloads and across process restarts.
- **Pure-web, no native engine**: the algorithm must be expressible in plain
  TypeScript integer arithmetic, runnable headless in Vitest with no canvas.
- **JavaScript numeric semantics**: no native uint32; all 32-bit operations must
  be forced back into the unsigned 32-bit domain explicitly (`>>> 0`).
- **Contract authority**: `design/architecture/cross-system-contracts.md` is the
  canonical source; where any GDD diverges, the contract wins. All contracts are
  declared "deterministic (no in-battle RNG)" in that document's preamble.
- **Registry authority**: the algorithm is owned once (`mulberry32_prng`,
  canonical source `encounter-generator.md`); consumers may differ only in salt.

### Requirements

- One shared, well-distributed 32-bit `mix()` combiner and one shared
  `mulberry32` stream — no per-system re-derivation.
- Each procedural consumer supplies its **own fixed salt** so that map,
  encounter, and draft streams derived from the same `runSeed` are decorrelated
  from one another.
- **Forbidden** in battle resolution — Combat `resolve()`, Turn & Phase Manager,
  Objective `evaluate()`, and every effect primitive must contain no PRNG call
  and no wall-clock read.
- Reproducible: `generateEncounter(runSeed, nodeId, …)` returns a byte-identical
  `EncounterDefinition` for identical inputs (Encounter Generator Rule 14),
  which is what makes Run Persistence resume (Rule 10) and daily-seed sharing
  work.
- A pinned reference test-vector table so any re-implementation stays bit-exact.

## Decision

Adopt a **single, shared procedural PRNG facility** — the registry
`mulberry32_prng` — as the *only* source of pseudo-randomness anywhere in
VANGUARD, and confine it strictly to the pre-battle meta layer.

1. **One algorithm, owned once.** The `mix()` 32-bit hash combiner and the
   `mulberry32` stream are defined once (canonical source
   `design/gdd/encounter-generator.md` F1/F2, mirrored verbatim in Run Structure
   and Draft). No consumer re-derives, reorders, or "optimizes" the arithmetic.
   Any change is made at the canonical source and propagated; a change is a
   breaking change (it alters which variations a given seed produces) and
   requires bumping the salt version suffix and/or a schema version, never a
   silent edit.

2. **Salt-per-consumer, one `runSeed` root.** `runSeed` is a `uint32` set once at
   run start and stored verbatim by Run Persistence (never regenerated). Each
   procedural consumer derives its own independent stream by feeding a **fixed,
   versioned salt constant** into `mix()`:
   - Run Structure / Node Map: `mapSeed = mix(runSeed, MAP_SEED_SALT)`
     (`MAP_SEED_SALT = "vanguard_run_map_v1"`).
   - Draft / Loadout Meta: `draftSeed = mix(runSeed, nodeId, DRAFT_SEED_SALT)`
     (`DRAFT_SEED_SALT = "vanguard_draft_offer_v1"`).
   - Encounter Generator:
     `encounterSeed(attemptIndex) = mix(runSeed, nodeId, templateId, attemptIndex)`
     — here `templateId` + `attemptIndex` play the salt/decorrelation role so
     each retry is a genuinely independent roll.
   Distinct salts guarantee the map, draft, and encounter streams drawn from the
   same `runSeed` are mutually decorrelated (changing `runSeed` reshuffles all of
   them together; the salt keeps them from colliding).

3. **Procedural generation ONLY.** The facility is permitted **exclusively** for
   map generation, encounter assembly (template selection + variation rolling),
   and draft-offer generation — all of which run **once, before Turn 1, outside
   combat**.

4. **FORBIDDEN in battle resolution.** Battles are fully deterministic and
   contain **no RNG**. Combat Resolution's `resolve()` and its 10 effect
   primitives, the Turn & Phase Manager phase loop, Enemy target-selection AI,
   and Objective `evaluate()` MUST NOT call the PRNG or read a wall clock
   (`Date.now()`, `performance.now()`, `Math.random()`). Enemy "choice" is
   deterministic target-selection, not a die roll. This is Principle P1 stated as
   a code-level prohibition.

5. **Reproducibility is the payoff.** Because generation is a pure function of
   `(runSeed, nodeId, …)` and battles carry no RNG, storing only `runSeed` +
   `nodeId` + map/roster state is sufficient to re-derive a byte-identical
   encounter on resume (Run Persistence Rule 10) — no generated encounter is ever
   persisted — and to reproduce an entire run from a shared seed.

6. **Pinned reference vectors.** Once implemented, a fixed reference test-vector
   table (seed → first N `mulberry32` outputs, and known `mix()` input→output
   pairs) is committed as the cross-implementation contract. `mix()` may be
   FNV-1a or splitmix32 over the concatenated inputs — the *choice* is an
   implementation detail, but once chosen it is frozen by the vector table.

### Architecture

```
                         runSeed (uint32, set once at run start,
                         stored verbatim by Run Persistence)
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        ▼                            ▼                             ▼
 mix(runSeed,                 mix(runSeed, nodeId,          mix(runSeed, nodeId,
     MAP_SEED_SALT)               DRAFT_SEED_SALT)              templateId, attemptIndex)
   = mapSeed                    = draftSeed                   = encounterSeed(i)
        │                            │                             │
        ▼                            ▼                             ▼
   mulberry32(mapSeed)        mulberry32(draftSeed)        mulberry32(encounterSeed)
        │                            │                             │
        ▼                            ▼                             ▼
   Node-map layout            Draft offer sets            Encounter variation rolls
   (Run Structure)            (Draft/Loadout Meta)        (Encounter Generator)
        │                            │                             │
        └──────────── all run ONCE, pre-battle, outside combat ────┘

  ══════════════════════════════════════════════════════════════════════════
   BATTLE RESOLUTION (Combat.resolve · Turn & Phase Manager · Enemy AI ·
   Objective.evaluate · 10 primitives)      ── NO PRNG · NO wall clock ──
   Same inputs → byte-identical state + event log, every run, across reloads.
  ══════════════════════════════════════════════════════════════════════════
```

### Key Interfaces

```typescript
// The one shared procedural PRNG facility (registry `mulberry32_prng`).
// Confined to the pre-battle meta layer. NEVER imported by the battle sim.

/** 32-bit hash combiner. Deterministic; distinct inputs decorrelate.
 *  Concrete algorithm (FNV-1a or splitmix32) pinned by the reference vectors. */
function mix(...inputs: (number | string)[]): number; // → uint32

/** mulberry32 stream. Returns a stateful generator seeded by a uint32.
 *  next() → float in [0, 1); all internal ops forced to uint32 via `>>> 0`. */
function mulberry32(seed: number): { next(): number };

// Fixed, versioned salt constants (never vary at runtime):
const MAP_SEED_SALT   = "vanguard_run_map_v1";     // Run Structure / Node Map
const DRAFT_SEED_SALT = "vanguard_draft_offer_v1"; // Draft / Loadout Meta
// Encounter Generator uses (templateId, attemptIndex) as its decorrelators.

// Reference mulberry32 body (from encounter-generator.md F2 / draft & map F2):
//   state = (state + 0x6D2B79F5) >>> 0
//   t = state
//   t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0
//   t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0
//   return ((t ^ (t >>> 14)) >>> 0) / 4294967296   // [0, 1)
```

### Implementation Guidelines

- **Force unsigned 32-bit at every step.** JavaScript bitwise operators yield
  *signed* 32-bit ints and `+`/`*` overflow into floats. Use `>>> 0` after every
  additive/xor step and `Math.imul(a, b)` for the 32-bit multiplies — this is the
  single most likely source of a cross-implementation divergence and must be
  covered by the reference vectors.
- **Salts are string constants with a version suffix** (`_v1`). Bumping a salt
  (e.g. `_v2`) is the sanctioned way to intentionally reshuffle a stream; it is a
  deliberate, reviewed change, never incidental.
- **Fixed draw order.** Consumers must draw in a **declared, deterministic order**
  (Encounter Generator draws variation slots "in the template's declared slot
  order," never map/object iteration order). Two runtimes rolling the same
  template must produce the same draw sequence.
- **Headless-testable.** The facility lives in the pure simulation/meta core
  (no PixiJS import) so Vitest can assert the reference vectors with no canvas.
- **Lint/guard the prohibition.** Battle-layer modules (Combat, Turn & Phase
  Manager, Objective, Enemy resolution, effect primitives) must not import the
  PRNG facility and must not reference `Math.random`, `Date.now`,
  `performance.now`, or `Math` non-deterministic sources. Enforce via an
  import/lint boundary check in CI (see Validation Criteria).

## Alternatives Considered

### Alternative 1: Per-system independent PRNGs (each system picks its own)

- **Description**: Let Run Structure, Encounter Generator, and Draft each choose
  and implement their own seeded RNG (e.g. one uses `mulberry32`, another
  xorshift, another an LCG).
- **Pros**: Each team moves independently; no shared-module coordination.
- **Cons**: No single reference vector; streams cannot be reasoned about
  together; a change in one silently diverges from the registry's single-owner
  rule; higher chance one system accidentally re-seeds from a clock. Directly
  violates the registry's "must NOT be re-derived per document" note.
- **Estimated Effort**: Similar up front, higher long-term maintenance.
- **Rejection Reason**: Defeats reproducibility and the single-owner registry
  contract; multiplies the surface where determinism can be accidentally broken.

### Alternative 2: A cryptographic / higher-quality PRNG (e.g. PCG, ChaCha, WebCrypto)

- **Description**: Use a statistically stronger or cryptographic generator.
- **Pros**: Better statistical properties; PCG has excellent distribution.
- **Cons**: Overkill for non-adversarial content variety; WebCrypto is async and
  not trivially seedable/reproducible (breaks the pure, synchronous, resumable
  contract); larger code, more cross-language reproducibility risk. The use case
  is content variety, not security — there is no adversary to defend against
  (the corruption-checksum ADR already notes saves are trivially tamperable).
- **Estimated Effort**: Higher.
- **Rejection Reason**: `mulberry32` is a well-known, statistically adequate,
  tiny, trivially-reproducible integer routine — exactly matched to a
  non-cryptographic, must-be-reproducible content-generation need. The GDDs
  already specify it and the registry already owns it.

### Alternative 3: Allow limited, seeded in-battle RNG (e.g. seeded damage variance)

- **Description**: Permit a seeded PRNG *inside* battle for small effects (minor
  damage variance, cosmetic variation), arguing it stays reproducible because
  it's seeded.
- **Pros**: Slightly more organic-feeling combat; common in many tactics games.
- **Cons**: Even seeded, it complicates the preview/undo/replay guarantees
  (Move Preview must reproduce the exact commit; undo must restore byte-identical
  state; the event log must be replayable) and blurs Pillar #1's "perfect
  blame" — a player losing to variance cannot cleanly blame themselves. It also
  invites scope creep toward more RNG over time.
- **Estimated Effort**: Lower to add, high long-term cost.
- **Rejection Reason**: Battles are a **fully deterministic puzzle** by design
  (Pillar #1; `cross-system-contracts.md` preamble; `architecture.md` P1). No
  in-battle RNG is the invariant that makes preview, undo, replay, and resume
  sound. This is explicitly forbidden.

## Consequences

### Positive

- **Reproducibility guaranteed**: `runSeed + nodeId` re-derives byte-identical
  encounters — enables Run Persistence resume without storing encounters, and
  makes shareable "daily seed" runs mechanically possible.
- **Single owner, single vector table**: one algorithm, pinned by reference
  vectors, safe to re-implement in a rewrite or another language bit-exactly.
- **Determinism invariant protected**: the explicit battle-layer prohibition
  keeps preview/undo/replay/resume sound (Principle P1, P4).
- **Decorrelated streams**: salts keep map, draft, and encounter randomness
  independent while all descending from one visible `runSeed`.
- **Trivially testable**: pure integer routine, headless Vitest, exact-value
  assertions — no flakiness.

### Negative

- **JS numeric footguns**: correctness hinges on disciplined `>>> 0` / `Math.imul`
  usage; a missing coercion produces a subtle, seed-dependent divergence. Mitigated
  by mandatory reference-vector tests.
- **Statistically "adequate," not cryptographic**: `mulberry32` is fine for
  content variety but must never be repurposed for anything adversarial. It is
  not, and the corruption checksum (ADR-0003 / A3) already disclaims tamper
  resistance.
- **Salt changes are breaking**: intentionally reshuffling a stream (salt `_v2`)
  changes every seed's output — acceptable and versioned, but must be a reviewed
  decision, not a casual edit.

### Neutral

- Battle "randomness feel" is achieved through positional/telegraph design and
  enemy variety, not dice — a deliberate design stance, neither better nor worse
  in the abstract, but load-bearing for this game's identity.
- The `mix()` concrete choice (FNV-1a vs splitmix32) is deferred to
  implementation and frozen by the vectors; either satisfies the contract.

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| An implementer uses `Math.random()` / `Date.now()` in the battle path | Medium | High (voids determinism, preview/undo/replay) | CI import-boundary + lint rule banning those symbols in battle-layer modules; code review; the prohibition is stated in this ADR and P1 |
| Cross-implementation divergence from missing `>>> 0` / `Math.imul` | Medium | High (seeds produce different content) | Pinned reference test-vector table asserted in Vitest; documented JS-numeric guidance |
| A consumer re-derives or tweaks the algorithm locally | Low | High (breaks reproducibility silently) | Single registry owner (`mulberry32_prng`); shared module, not copy-paste; review gate |
| Salt collision / accidental stream correlation | Low | Medium (map & draft variety correlate) | Distinct, versioned salt constants per consumer; decorrelation smoke test |
| Silent salt/algorithm change breaks existing shared seeds | Low | Medium | Salt version suffix (`_v1`); algorithm change requires vector-table update + review |

## Performance Implications

| Metric | Before | Expected After | Budget |
|--------|--------|---------------|--------|
| CPU (frame time) | 0 ms | 0 ms (never runs during a frame/battle) | 0 ms in-battle (hard: no PRNG in sim) |
| CPU (generation, per PRNG draw) | n/a | sub-microsecond (a few integer ops) | Dominated by solver cost, not PRNG — within Encounter Generator's < 2.5 s validation budget |
| Memory | n/a | negligible (one uint32 state per stream) | n/a |
| Load Time | n/a | negligible PRNG contribution; generation cost is solver-bound | Encounter Generator: < 3 s typical / < 20 s worst-case per node (its budget) |
| Network | n/a | n/a (single-player, local) | n/a |

The PRNG itself is effectively free; the only meaningful cost is in the systems
that *consume* draws (notably the Encounter Generator solver), whose budgets are
owned by their own GDDs. This ADR adds no per-frame cost by construction —
because it is forbidden from running during a frame or a battle.

## Migration Plan

Greenfield — no existing code to migrate.

1. Implement the shared `mulberry32_prng` module in the pure meta/core layer
   (no PixiJS import); commit the reference test-vector table alongside it.
2. Wire Run Structure (`MAP_SEED_SALT`), Draft (`DRAFT_SEED_SALT`), and Encounter
   Generator (`templateId`/`attemptIndex`) to the shared module.
3. Add the CI import-boundary / lint rule forbidding PRNG and wall-clock symbols
   in battle-layer modules; verify it fails on a deliberate violation, then fix.
4. Verify resume: store `runSeed` + `nodeId`, re-derive an encounter twice
   across a process restart, assert deep-equality.

**Rollback plan**: If `mulberry32` ever proved inadequate (it will not for this
use), swap the stream at the single registry owner and re-pin the vector table;
because no encounter is ever persisted, only the algorithm and salts move —
existing *runs in progress* would change their unvisited content, so such a
change ships behind a salt/schema version bump, not a hot-swap.

## Validation Criteria

- [ ] The shared module produces values bit-identical to the committed reference
      test-vector table (seed → first N outputs), asserted in Vitest.
- [ ] Same `(runSeed, nodeId, …)` → byte-identical `EncounterDefinition` across
      two calls **and** across a simulated process restart (Encounter Generator
      Rule 14 / Run Persistence Rule 10).
- [ ] Changing only `nodeId` (or only a salt) yields a decorrelated,
      unrelated-looking stream (decorrelation smoke test).
- [ ] A CI check confirms no battle-layer module imports the PRNG facility or
      references `Math.random` / `Date.now` / `performance.now`.
- [ ] A full battle replays byte-identically from the same starting state and
      action sequence (no in-battle RNG present).

## GDD Requirements Addressed

| GDD Document | System | Requirement | How This ADR Satisfies It |
|-------------|--------|-------------|--------------------------|
| `design/gdd/encounter-generator.md` | Encounter Generator | Rule 14 Reproducibility: identical `(runSeed, nodeId, difficultyConfig, rosterSnapshot)` → byte-identical `EncounterDefinition`; Open Question #1 asks to pin the PRNG/`mix()` algorithm with a reference vector | Pins the shared `mulberry32` + `mix()` as the one procedural PRNG, mandates a fixed reference-vector table, and derives `encounterSeed(attemptIndex) = mix(runSeed, nodeId, templateId, attemptIndex)` — a pure function of its inputs |
| `design/gdd/encounter-generator.md` | Encounter Generator | Player Fantasy / Rule 3: a fair, solvable puzzle, never "rolled against" the player | Procedural randomness is confined to *encounter selection/assembly* run once before Turn 1; battle resolution carries no RNG, so the puzzle itself is deterministic |
| `design/gdd/run-persistence.md` | Run Persistence | Rule 10 determinism contract: store only `runSeed` + `nodeId`, never the generated encounter; resume must re-derive the identical encounter | The seed strategy makes generation a pure function of stored `runSeed` + `nodeId`, so resume reconstructs a byte-identical encounter without persisting it |
| `design/gdd/run-structure-node-map.md` | Run Structure / Node Map | F1/F2: `mapSeed = mix(runSeed, MAP_SEED_SALT)` using the shared registered algorithm; Open Question #1 asks to confirm the shared `mix()` | Adopts the shared algorithm with `MAP_SEED_SALT = "vanguard_run_map_v1"` as this consumer's fixed salt, decorrelated from draft/encounter streams |
| `design/gdd/draft-and-loadout-meta.md` | Draft / Loadout Meta | F1/F2: `draftSeed = mix(runSeed, nodeId, DRAFT_SEED_SALT)` using the shared algorithm, not a divergent copy | Adopts the shared algorithm with `DRAFT_SEED_SALT = "vanguard_draft_offer_v1"`; the single-owner rule forbids divergence |
| `design/registry/entities.yaml` | `mulberry32_prng` | Registry formula (status: active): shared PRNG for procedural generation ONLY, never in-battle; each consumer supplies its own salt; algorithm must not be re-derived per document | This ADR is the formal decision that enforces exactly that registry contract across all three consumers and the battle-layer prohibition |
| Pillars (`architecture.md` §9) | Whole simulation | Pillar #1 "Perfect Information, Perfect Blame" (P1: determinism, no in-battle RNG/clock) and Pillar #3 "Variety Lives in the Draft, Not the Dice" | Partitions randomness: variety lives only in the reproducible pre-battle mulberry32 meta layer; battles are RNG-free and byte-identical on replay/undo/resume |

## Related

- `docs/architecture/architecture.md` §5d (save/resume path), §8/A4 (this ADR's
  entry in the Required-ADR set), §9/P1 (determinism principle).
- `design/architecture/cross-system-contracts.md` §8 (Encounter Generator entry
  point; `generateEncounter` signature; resume reproducibility) — **canonical;
  where any GDD diverges, the contract wins.**
- Sibling Foundation ADRs (per `architecture.md` §8): A1 Board snapshot, A2
  deterministic event bus, A3 Run Persistence save schema, A5 Board/Combat error
  contract — decide the full Foundation set (A1–A5) before Core code.
- `design/registry/entities.yaml` → `mulberry32_prng` (single algorithm owner).
