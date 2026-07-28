# ADR-0003: Run Persistence save schema & versioning

## Status

Accepted

## Date

2026-07-28

## Last Verified

2026-07-28

## Decision Makers

Technical Director (owner); consulted: Run Persistence GDD author, Encounter
Generator, Run Structure / Node Map, Draft / Loadout Meta, Meta-progression /
Unlocks. Consistent with `design/architecture/cross-system-contracts.md`
(canonical) and `docs/architecture/architecture.md` §8 (Required ADR **A3**).

## Summary

Pins the on-disk save format for VANGUARD's browser-local persistence: a
`{schemaVersion, checksum, data}` envelope written to `window.localStorage`
under a **registry of independent, independently-versioned domains** — three as
of 2026-07-28 (`vanguard.meta.v{N}`, `vanguard.run.v{N}`,
`vanguard.settings.v{N}`) — with sequential per-domain migration, a pinned
order-sensitive 32-bit checksum for corruption detection, and build-then-swap
atomic writes. Resolves Run Persistence Open Q1 (production checksum algorithm)
and defers the Result-vs-throw error contract (Open Q2) to ADR-0005.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | None — pure web (TypeScript + PixiJS + Vite) |
| **Domain** | Core / Persistence (Foundation layer) |
| **Knowledge Risk** | LOW |
| **References Consulted** | `design/gdd/run-persistence.md`, `design/architecture/cross-system-contracts.md`, `docs/architecture/architecture.md` §5(d)/§8 |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | None |

> **Not applicable / low risk.** VANGUARD is a pure-web build (TypeScript strict
> + PixiJS 2D WebGL + Vite). This ADR touches only the standard, long-stable
> Web Storage API (`window.localStorage`) and pure TypeScript — there is **no
> Godot / Unity / Unreal API surface** and **no post-cutoff engine gap** to
> manage. The Godot engine-reference in `docs/engine-reference/` does not apply
> to this build and was intentionally not consulted. This ADR does not need to
> be re-validated against an engine version because the project has no native
> engine.

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | None |
| **Enables** | Meta-progression / Unlocks, Run Structure / Node Map, and Draft / Loadout Meta persistence (all three persist exclusively through this envelope). |
| **Blocks** | Any story that reads or writes persistent state (`saveRun`/`loadRun`/`clearRun`, `saveMeta`/`loadMeta`/`mergeUnlocksIntoMeta`) cannot start until this ADR is Accepted. |
| **Ordering Note** | Foundation-tier ADR — decide before any Core code. Related but **not** a dependency: ADR-0005 (Board/Combat error contract) pins the shared Result-vs-throw convention that this system's `loadRun`/`saveRun` signatures adopt; this ADR names that convention as owned by ADR-0005 rather than re-deciding it. ADR-0004 (mulberry32 seed strategy) is the reproducibility contract this ADR's resume path relies on but does not re-specify. |

## Context

### Problem Statement

VANGUARD is a browser-local roguelike whose entire retention hook is "an
in-progress run and a build you don't want to lose" (game-concept.md). The save
system must let the player close the tab mid-run and reliably resume, and must
protect permanent meta-progression across runs. Before any system can persist
state, the **on-disk contract** must be fixed: the byte layout, how versions
evolve, how corruption is detected, and how concurrent domains are isolated.
Deciding this late — after Run Structure, Draft, and Meta-progression have each
started writing to `localStorage` — would force a migration of already-shipped
saves and risk each system inventing its own incompatible format. The cost of
not deciding now is divergent, unversioned, unchecksummed saves that silently
corrupt player progress: the single worst trust violation this design can
produce (Pillar #1, "Perfect Information, Perfect Blame").

### Current State

`docs/architecture/` contains no prior `adr-*.md`; this is the first
architecture artifact written to the directory. Today no persistence format
exists — the Run Persistence GDD specifies the *requirements* (a
`{schemaVersion, checksum, data}` envelope, two domains, per-domain versioning,
an order-sensitive ≥32-bit checksum) and a *reference* checksum formula (F2),
but explicitly leaves the production checksum algorithm and the
Result-vs-throw error contract as Open Questions (Q1, Q2) requiring an ADR.
Every downstream system is designed against the *proposed* engine API and is
blocked on this decision being formalized.

### Constraints

- **Platform**: `window.localStorage` only in v1 — synchronous, per-origin,
  string-valued, ~5–10 MB typical quota, may throw `QuotaExceededError` /
  `SecurityError` (disabled in some private-browsing modes). No IndexedDB, no
  backend, no cloud sync, no accounts (architecture.md §2, Run Persistence Rule 8).
- **Determinism (Principle P1)**: same inputs → byte-identical stored strings,
  every run, across reloads. No wall-clock or RNG may enter the serialized
  battle-relevant state. Resume must reproduce a byte-identical encounter from
  stored `runSeed` + `nodeId` alone (no generated encounter is ever stored).
- **Pure simulation core (Principle P3)**: the checksum, envelope, and migration
  logic must run headless in Vitest against a mocked `localStorage` — no canvas,
  no PixiJS, no browser required for unit tests.
- **Scope**: node-map save granularity only. Mid-battle state (turn #, hazards,
  HP, undo stack) is out of scope for v1 (Run Persistence Open Q3 / architecture
  Open Q4) — it lives only in memory, owned by Turn & Phase Manager / Combat.
- **Compatibility**: the format must serve four schema co-owners (Run Structure,
  Draft, Meta-progression, plus the Encounter Generator purity contract) through
  one trusted layer; each owns the *shape* of its `data` payload, this ADR owns
  only the generic envelope around it.

### Requirements

- Independent persistence domains isolated so a corruption or migration failure
  in one can never take down another. *(Amended 2026-07-28: originally worded
  "two"; the count is not the architectural property — the isolation is. See
  Decision §2.)*
- Integer `schemaVersion` per domain, with a deterministic sequential migration
  chain (`migrate_vN_to_vN+1`) and a well-defined response to newer-than-code
  saves.
- A deterministic, order-sensitive, cheap, ≥32-bit checksum that catches
  accidental corruption (truncated writes, manual edits, reorder/transposition,
  storage bit-rot) before corrupt data reaches game logic.
- Atomic-enough writes such that a failed or interrupted write never destroys the
  previous good save.
- Performance: `saveRun`/`loadRun`/`saveMeta`/`loadMeta` < 5 ms on a ≤10 KB
  payload; a 3-step migration load < 15 ms; checksum over 10 KB < 3 ms
  (Run Persistence Performance Budget — CI-blocking).

## Decision

Persist all VANGUARD state as a **versioned, checksummed JSON envelope in
`window.localStorage`**, under a registry of independent domains, written with a
build-then-swap atomic pattern. Concretely:

**1. Envelope.** Every save (either domain) is a JSON object:

```
{ "schemaVersion": <int ≥ 1>, "checksum": <uint32>, "data": <domain payload> }
```

- `schemaVersion` — the integer schema version of *that domain's* `data` shape,
  monotonic, incremented by one per breaking schema change.
- `checksum` — the pinned checksum (below) computed over the **serialized `data`
  JSON string only** (not over the whole envelope, so `schemaVersion`/`checksum`
  fields themselves are excluded from the hashed input).
- `data` — the opaque, domain-owned payload. Persistence treats it as opaque;
  its shape is owned by the schema co-owner systems.

**2. A registry of independent domains, independently versioned.**

*Amended 2026-07-28. This section originally read "Two independent domains" and
enumerated exactly two. That was a **miscount of the architecture, not a
constraint of it** — nothing in the envelope, checksum, migration, or atomic-write
design depends on there being two. `settings-and-options.md` (#28) correctly added
a third and would otherwise have silently contradicted an Accepted ADR.*

The architectural property is **isolation**, not arity: every domain owns its key,
its `schemaVersion`, its migration chain, and its failure mode, so a corruption or
migration failure in one can never affect another. New domains may be added by
extending the registry below; doing so requires no change to any other part of
this ADR.

| Domain | Key | Lifetime | Payload owner |
|---|---|---|---|
| **Meta Save** | `vanguard.meta.v{N}` | Permanent, across runs | Meta-progression / Unlocks — unlocked heroes, enemy variants, difficulty tiers, cumulative statistics |
| **Run Save** | `vanguard.run.v{N}` | One in-progress run; deleted at campaign-level run end | Run Structure / Node Map + Draft / Loadout Meta — node-map graph, position, claimed nodes, roster + upgrades, draft history, immutable `runSeed`, start timestamp, `pilotDeaths[]` (**ADR-0012**), `nodeBonuses` multiset + one-shot consumption flags (`node-bonuses.md` Rule 12) |
| **Settings** | `vanguard.settings.v{N}` | Permanent, survives run *and* Meta reset | Settings / Options (#28) — audio, display/accessibility, input bindings, locale |

- Domains share **no** version counter; each migrates on its own chain. Different
  domains sitting on different `schemaVersion` values simultaneously is expected
  and correct.
- **The Settings domain is a peer, not a client.** Run Persistence does not call
  it and it does not call Run Persistence; it implements this ADR's architecture
  independently. That is deliberate — settings are what a player most needs
  *after* something else has gone wrong, so a colorblind player must never lose
  their palette mode to a corrupted Meta Save.
- **Run Save payload additions require an ADR.** `pilotDeaths` went through
  ADR-0012; `nodeBonuses` is recorded here (added 2026-07-28) after
  `/architecture-review` found it had been added to the GDD without one. The
  payload is opaque to Persistence but its growth is an architectural concern,
  because every field lands in the migration chain.

**3. Single run slot (v1).** Exactly one Run Save may exist at a time. Starting a
new run while one exists is a UI-level confirm/overwrite flow owned by Run
Structure / Map UI; the persistence layer has no concept of multiple concurrent
run slots and rejects a second, different-run `saveRun` without an explicit
clear/overwrite.

**4. Pinned checksum algorithm (resolves Open Q1).** The production checksum is
the GDD's F2 weighted-sum scheme — chosen and **pinned here** as the canonical
algorithm (not FNV-1a, not CRC32):

```
checksum(s) = ( Σ_{i=0}^{n-1}  codeUnit(s, i) × (i + 1) )  mod  2^32
```

where `s` is the serialized `data` JSON string, `n = s.length`, and
`codeUnit(s, i)` is the UTF-16 code unit (`s.charCodeAt(i)`, range 0–65535) at
index `i`. The `× (i + 1)` positional weight makes it order-sensitive, so a
reordered or transposed payload fails the check (unlike a plain sum). Output is a
`uint32` in `[0, 2^32 − 1]`. Reference vector: `checksum("AB") = 65×1 + 66×2 =
197`. This is **not** a security or anti-tamper mechanism (client-side, trivially
forgeable) — its sole job is catching *accidental* corruption. Because changing
this algorithm would invalidate every previously-written checksum and mass-flag
existing saves as corrupt on next load, the algorithm is **frozen**: any future
change requires a schema version bump, and is not exposed as a tuning knob.

**5. Per-domain sequential migration.** On load, if `schemaVersion <
CURRENT_VERSION` for that domain, apply `migrationsToApply = CURRENT_VERSION −
schemaVersion` (Formula F3) migration functions `migrate_vN_to_vN+1` in strictly
ascending order, then validate the migrated shape against the current schema
before treating the save as `Valid`. A missing link in the migration chain, or a
post-migration shape that fails validation, makes the save **Corrupted** — never
partially migrated. If `schemaVersion > CURRENT_VERSION` (a save from a newer
build, e.g. after a rollback), the save is **Unsupported** — explicitly *not*
Corrupted — and is **left untouched on disk**: never parsed further, never
quarantined, never overwritten by a lower-version write in that session (which
would permanently destroy the newer data once the player upgrades again).

**6. Build-then-swap atomic writes.** A write first serializes and checksums the
complete new envelope into a string, then assigns it to the `localStorage` key in
one `setItem`. The key is **never** cleared or truncated before its replacement
string is fully built. A write that throws (quota/security) therefore always
leaves the previous good save byte-for-byte intact. Writes are synchronous and
best-effort — there is no cross-page-load retry queue.

**7. Load result contract (four outcomes per domain).**

| Result | Trigger | Response |
|--------|---------|----------|
| **Empty** | Key absent | Meta: initialize schema defaults and write immediately (so unlock-merge always has a base). Run: stays absent — no "Continue" — until a run starts. |
| **Valid** | Parsed, checksum matches, `schemaVersion == CURRENT` (post-migration) | Used normally. |
| **Corrupted** | JSON parse failure, checksum mismatch, missing required field, or broken/failed migration | Quarantine under `vanguard.{domain}.corrupt.{timestamp}` (retention = tuning knob), then reset: Run → Empty-equivalent (no Continue); Meta → schema defaults. Never a silent crash or partial load. |
| **Unsupported** | `schemaVersion > CURRENT` | Key left untouched; domain treated as unavailable for the session. |

**8. Determinism / resume contract (relies on ADR-0004).** Persistence stores
**only** `runSeed` (immutable, set once at run start) + `nodeId` + reproducible
map/roster state — **never** a generated encounter. Resume re-derives the
byte-identical encounter by re-calling
`generateEncounter(runSeed, nodeId, difficultyConfig, rosterSnapshot)`
(cross-system-contracts §8), with `difficultyConfig`/`rosterSnapshot`
reconstructed as pure functions of the resumed state. This rests on the
mulberry32 seed strategy (ADR-0004) and `generateEncounter` purity (Encounter
Generator Rule 14). No in-battle RNG is ever serialized because none exists
(Principle P1). Resume restores the **start of the node's battle**, not the last
turn — a disclosed, deterministic, bounded loss ("resume from the start of this
fight"), never a silent one.

**9. Error contract deferred to ADR-0005.** Whether `loadRun`/`saveRun` return a
`Result`-style enum vs. throw (Run Persistence Open Q2) mirrors the Board/Combat
question and is **owned by ADR-0005** (Board/Combat error contract). This ADR
adopts whatever that ADR pins so the whole codebase shares one convention:
expected outcomes (Empty / Valid / Corrupted / Unsupported / QuotaExceeded /
SecurityBlocked) are modeled as returned result values (no throw for expected
states); only genuine programmer errors assert/throw. The four load outcomes in
§7 and the write outcomes (`Written | QuotaExceeded | SecurityBlocked`) are
returned values, consistent with that convention.

### Architecture

```
        ┌─────────────────────────────────────────────────────────────┐
        │  Schema co-owners (own each domain's `data` shape)            │
        │  Run Structure/Node Map · Draft/Loadout Meta ·               │
        │  Meta-progression/Unlocks                                     │
        └───────────────┬───────────────────────────┬─────────────────┘
                        │ saveRun/loadRun/clearRun   │ saveMeta/loadMeta/
                        │                            │ mergeUnlocksIntoMeta
                        ▼                            ▼
        ┌─────────────────────────────────────────────────────────────┐
        │              Run Persistence (this ADR)                      │
        │  ┌───────────────────────────────────────────────────────┐  │
        │  │ Envelope:  { schemaVersion, checksum, data }          │  │
        │  │ WRITE:  serialize data → checksum(data) → build full  │  │
        │  │         envelope string → setItem  (build-then-swap)  │  │
        │  │ LOAD:   getItem → JSON.parse → verify checksum →      │  │
        │  │         migrate vN→CURRENT → validate → RESULT        │  │
        │  │ RESULT: Empty | Valid | Corrupted(quarantine) |       │  │
        │  │         Unsupported(newer, untouched)                 │  │
        │  └───────────────────────────────────────────────────────┘  │
        │  Domain A: vanguard.meta.v{N}   Domain B: vanguard.run.v{N}  │
        │       (independent versions, independent migration chains)   │
        └───────────────┬─────────────────────────────────────────────┘
                        │ getItem / setItem / removeItem (strings only)
                        ▼
        ┌─────────────────────────────────────────────────────────────┐
        │            window.localStorage  (per-origin, ~5–10 MB)        │
        │  Quarantine: vanguard.{meta|run}.corrupt.{timestamp}          │
        └─────────────────────────────────────────────────────────────┘

  RESUME (no encounter stored):
    stored runSeed + nodeId ──► generateEncounter(runSeed, nodeId, …)  [ADR-0004]
                              ──► byte-identical encounter (mulberry32)
```

### Key Interfaces

```typescript
// Owned by Run Persistence (architecture.md §6). Field-level `data` shapes are
// the co-owner GDDs' to finalize; this ADR fixes only the envelope + outcomes.

type SchemaVersion = number; // int ≥ 1, monotonic, per-domain

interface SaveEnvelope<T> {
  schemaVersion: SchemaVersion;
  checksum: number;          // uint32, over JSON.stringify(data) only
  data: T;
}

type LoadResult<T> =
  | { kind: 'Empty' }
  | { kind: 'Valid'; data: T }
  | { kind: 'Corrupted' }        // parse fail | checksum mismatch | missing field | broken migration
  | { kind: 'Unsupported' };     // schemaVersion > CURRENT — key left untouched

type WriteResult =
  | { kind: 'Written' }
  | { kind: 'QuotaExceeded' }    // after one retry post quarantine-prune
  | { kind: 'SecurityBlocked' }; // storage disabled → session is memory-only

interface Persistence {
  saveRun(data: RunSave): WriteResult;      // single-slot; rejects a different run w/o clear
  loadRun(): LoadResult<RunSave>;
  clearRun(): void;
  saveMeta(data: MetaSave): WriteResult;
  loadMeta(): LoadResult<MetaSave>;
  mergeUnlocksIntoMeta(unlocks: Unlock[]): WriteResult; // Rule 4f(i) as one atomic call
  isStorageAvailable(): boolean;            // boot-time capability probe
}

// Pinned checksum (Decision §4 / GDD F2). Order-sensitive, uint32, deterministic.
function checksum(s: string): number {
  let acc = 0;
  for (let i = 0; i < s.length; i++) {
    acc = (acc + s.charCodeAt(i) * (i + 1)) % 0x1_0000_0000; // mod 2^32
  }
  return acc >>> 0; // ensure uint32
}
// Reference vector (regression): checksum("AB") === 197
```

### Implementation Guidelines

- **Hash the `data` string, not the envelope.** Compute `checksum` over exactly
  the string handed to `setItem` for the `data` field, so the checksum and
  version fields are never part of their own hashed input. Serialize `data` once
  and reuse that exact string for both hashing and storage — re-serializing risks
  key-order drift that would change the checksum.
- **Deterministic serialization.** `JSON.stringify` must produce identical output
  for identical state — do not let `data` contain `Date.now()`, iteration-order-
  dependent Maps/Sets, or floats formatted differently across runs. Determinism
  (P1) is a CI-tested invariant: two identical write sequences on two fresh mock
  stores must yield byte-identical strings.
- **Build-then-swap literally.** Never `removeItem` then `setItem`; assign the
  fully-built string in a single `setItem`. On `QuotaExceededError`, prune
  `*.corrupt.*` quarantine keys and retry the write exactly once; if it still
  throws, abandon the write (previous save intact) and return `QuotaExceeded`.
- **Capability probe once at boot.** `isStorageAvailable()` does
  `try { setItem(probe); removeItem(probe) } catch → false`. On `false`, run the
  session in memory-only mode (logical reads/writes succeed in-memory, nothing
  survives reload) and surface the persistent "Progress won't be saved" banner.
- **Migration functions are pure and ordered.** Each `migrate_vN_to_vN+1` is a
  pure `data → data` transform. Validate the final shape against the current
  schema before returning `Valid`; a gap or a validation failure → `Corrupted`.
- **`mergeUnlocksIntoMeta` is the only run-end path.** It performs Rule 4f(i)
  (union unlocks into Meta + write) as one call so callers cannot reorder the
  merge-then-clear sequence; run end must call it **before** `clearRun()`.
- **Headless-testable.** All of the above must run in Vitest against a mocked
  `localStorage` with no browser — no PixiJS import anywhere in this layer (P3).

## Alternatives Considered

### Alternative 1: One combined save (single key, single version)

- **Description**: Store Meta and Run state together under one `localStorage` key
  with a single shared `schemaVersion`.
- **Pros**: One key to read/write; one migration chain; marginally less code.
- **Cons**: A corruption or failed migration in the Run slice would take down
  permanent Meta-progression with it — the exact coupling Pillar #1 forbids.
  Forces a version bump of the whole blob whenever *either* schema changes,
  churning migrations. Run Save is deleted at run end but Meta must persist —
  awkward to model in one key.
- **Estimated Effort**: Slightly lower than chosen.
- **Rejection Reason**: Violates the domain-isolation requirement; a single point
  of failure over the player's most valuable data (permanent unlocks).

### Alternative 2: IndexedDB with a transactional store

- **Description**: Use IndexedDB (async, transactional, structured-clone values)
  instead of `localStorage`.
- **Pros**: True transactions, larger quota, structured values (no manual JSON),
  built-in versioned `onupgradeneeded` migrations.
- **Cons**: Asynchronous API collides with the synchronous, deterministic model
  the rest of the sim assumes (Principle P1 / P3, synchronous event bus in
  ADR-0002); adds Promise plumbing to boot and save paths; heavier to mock in
  headless Vitest; overkill for a ≤10 KB single-slot payload that uses < 0.1% of
  the `localStorage` quota (Formula F1 worked example: ~4.2 KB).
- **Estimated Effort**: Higher than chosen.
- **Rejection Reason**: Its advantages (size, transactions) solve problems this
  game does not have, while its async nature fights the deterministic synchronous
  architecture. Revisit only if mid-battle or multi-slot persistence is ever in
  scope.

### Alternative 3: A cryptographic / library hash (SHA-256, CRC32 via a lib)

- **Description**: Use a stronger or standard hash for the checksum.
- **Pros**: Lower collision rate; CRC32 is a well-known standard.
- **Cons**: SHA-256 pulls in a dependency or WebCrypto (async) for zero security
  benefit (the check is client-side and forgeable regardless); CRC32 needs a
  lookup table and adds code for a corruption-detection job the cheap weighted sum
  already does within budget (< 3 ms / 10 KB). None improve the actual goal —
  catching *accidental* corruption — enough to justify the cost.
- **Estimated Effort**: Comparable-to-higher; adds a dependency or async.
- **Rejection Reason**: The F2 weighted sum is deterministic, order-sensitive,
  dependency-free, synchronous, and within the performance budget. Collision
  resistance beyond "catch accidental corruption" is not a requirement (Rule 7 is
  explicit it is not a security mechanism).

## Consequences

### Positive

- **Domain isolation**: a corrupt or un-migratable Run Save can never destroy
  permanent Meta-progression, and vice versa (Pillar #1 at the meta layer).
- **No silent loss**: every failure path (Corrupted, Unsupported, QuotaExceeded,
  SecurityBlocked) is a disclosed, non-blocking signal, never a silent vanish.
- **Deterministic & headless-testable**: the whole layer runs in Vitest against a
  mocked `localStorage`; determinism is a CI-verifiable property (P1/P3).
- **Cheap resume**: storing only `runSeed` + `nodeId` keeps saves tiny (~4 KB)
  and makes resume a pure re-derivation via `generateEncounter` — no encounter
  is ever stored or can drift.
- **Forward/backward safety**: newer-than-code saves are preserved untouched
  (rollback-safe); older saves migrate forward deterministically.
- **One trusted layer**: four co-owner systems persist through a single audited
  envelope instead of touching `localStorage` directly.

### Negative

- **Checksum is frozen**: changing the algorithm later requires a schema bump and
  invalidates existing checksums — a deliberate cost of pinning it.
- **Migration debt accrues**: every breaking schema change adds one permanent
  `migrate_vN_to_vN+1` function; long-term retention of old versions is an
  unresolved live-service decision (GDD Open Q10).
- **Bounded data loss by design**: turns played since the last node checkpoint
  are lost on resume (disclosed, but real). True mid-battle resume is out of v1
  scope and would require a new serialize/deserialize contract from Turn & Phase
  Manager / Combat (architecture Open Q4).
- **No cross-tab safety**: `localStorage` is last-write-wins across two tabs of
  the same origin; no locking/merge in v1 (architecture Open Q5).

### Neutral

- Save granularity is fixed at node-map level (a structural decision, not a
  tuning knob).
- `data` payload shapes are owned by the co-owner GDDs; this ADR is agnostic to
  their contents and only guarantees the envelope around them.
- The Result-vs-throw surface is inherited from ADR-0005 rather than decided here.

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Non-deterministic serialization (Map order, `Date.now()` in `data`) silently breaks byte-identical determinism and checksum stability | Medium | High | CI determinism test (two identical write sequences → byte-identical strings); code review bans non-deterministic fields in `data`; serialize once and reuse the string. |
| A missing/buggy `migrate_vN_to_vN+1` corrupts real player saves on a version bump | Medium | High | Migration marks broken chains `Corrupted` (never partial); every bump ships with its migration + a load test from each prior version; quarantine preserves the original for diagnosis. |
| Checksum collision lets accidental corruption pass as Valid | Low | Medium | Order-sensitive weighting over uint32 space; checksum only guards *accidental* corruption (not a security claim); schema-shape validation after migration is a second gate. |
| Quota exhaustion on a device with a small/full `localStorage` | Low | Medium | Build-then-swap keeps the prior save intact; one retry after pruning quarantine; `QuotaExceeded` surfaced as a non-blocking toast; F1 shows ~4 KB usage (< 0.1% of quota). |
| Two tabs clobber each other's Run Save (last-write-wins) | Low | Medium | Documented known v1 limitation; single-slot reduces blast radius; future `storage`-event / `BroadcastChannel` reconciliation noted as out of scope. |

## Performance Implications

Headless TypeScript; no frame-loop or GPU cost (storage-engine overhead only).
Budgets from the Run Persistence GDD Performance Budget (CI-blocking).

| Metric | Before | Expected After | Budget |
|--------|--------|---------------|--------|
| CPU (frame time) | n/a | 0 ms (not in the render/frame loop) | 16.7 ms/frame (unaffected) |
| `saveRun`/`saveMeta` (≤10 KB, incl. checksum) | n/a | < 5 ms | < 5 ms (CI-blocking) |
| `loadRun`/`loadMeta` (incl. checksum verify, no migration) | n/a | < 5 ms | < 5 ms (CI-blocking) |
| `loadRun` with a 3-step migration chain | n/a | < 15 ms | < 15 ms (CI-blocking) |
| Boot capability probe (`isStorageAvailable`) | n/a | < 2 ms | < 2 ms (CI-blocking) |
| Checksum compute (F2) over 10 KB | n/a | < 3 ms | < 3 ms (Advisory) |
| Memory | n/a | ~4–10 KB per domain in `localStorage`; transient string during build-then-swap | Well under per-origin quota (< 0.1%, F1) |
| Network | n/a | 0 (no backend, no sync) | n/a |

## Migration Plan

This is a greenfield format — there is no existing save format to migrate *from*.
The "migration" this ADR concerns is the ongoing per-domain schema evolution it
establishes:

1. Ship both domains at `schemaVersion = 1` (`meta_save_schema_version` /
   `run_save_schema_version` tuning knobs default to 1). Keys: `vanguard.meta.v1`,
   `vanguard.run.v1`.
2. On the first breaking change to a domain's `data` shape, bump that domain's
   `CURRENT_VERSION` to 2 and ship `migrate_v1_to_v2` for it. Verify with a load
   test that seeds a v1 envelope and asserts a `Valid` v2 result deep-equal to a
   fresh-written v2 save.
3. Repeat per bump — exactly one migration function per increment (F3). The two
   domains bump independently; never renumber or skip versions.

**Rollback plan**: Because build-then-swap never truncates the prior key and
newer-than-code saves are treated `Unsupported` (left untouched), rolling the
game back to an earlier build is safe — the older build refuses to overwrite the
newer save, and the player sees "this save is from a newer version." To roll back
this *decision* (e.g. adopt IndexedDB), a one-time export/import shim reads the
`{schemaVersion, checksum, data}` envelopes and re-writes them into the new store;
the envelope's self-describing versioning makes this mechanical.

## Validation Criteria

- [ ] Round-trip: `saveRun(data)` then `loadRun()` returns `Valid` deep-equal to
      input; same holds independently for Meta.
- [ ] Determinism: two identical write sequences on two fresh mock stores produce
      byte-identical stored strings.
- [ ] Checksum regression: `checksum("AB") === 197`; a one-character mutation of a
      stored `data` string yields `Corrupted` on load (quarantined; live key
      cleared/reset).
- [ ] Non-JSON stored value and a valid-JSON-but-missing-required-field both yield
      `Corrupted` with no exception escaping the caller.
- [ ] Migration: `schemaVersion < CURRENT` runs exactly `migrationsToApply` (F3)
      functions in ascending order and validates; a missing link yields
      `Corrupted`; `schemaVersion > CURRENT` yields `Unsupported` with the key
      left untouched and not overwritten by a later write that session.
- [ ] Atomicity: a write that throws `QuotaExceededError` (after the one retry)
      leaves the previous stored string byte-identical to before the attempt and
      fires a `storage_full` signal.
- [ ] Availability: a probe that throws on `setItem` switches the session to
      memory-only mode and fires `storage_unavailable` once.
- [ ] Run-end ordering: `mergeUnlocksIntoMeta` (merge+write Meta) is called before
      `clearRun()`; an interruption between them leaves merged unlocks present and
      the stale Run Save still `Valid`.
- [ ] Single-slot: a second `saveRun` for a different run without explicit clear is
      rejected.
- [ ] Resume determinism: two `generateEncounter(runSeed, nodeId, …)` calls with
      the same re-derived inputs return deep-equal encounters (integration test).
- [ ] All performance budgets above met in CI.

## GDD Requirements Addressed

| GDD Document | System | Requirement | How This ADR Satisfies It |
|-------------|--------|-------------|--------------------------|
| `design/gdd/run-persistence.md` | Run Persistence | Core Rule 1 — two independent, independently-versioned domains so a failure in one can't take down the other | Two keys `vanguard.meta.v{N}` / `vanguard.run.v{N}`, separate `schemaVersion` counters and migration chains (Decision §2). |
| `design/gdd/run-persistence.md` | Run Persistence | Core Rule 6 — `{schemaVersion, checksum, data}` envelope; per-domain sequential migration (F3) | Envelope pinned (§1) + `migrate_vN_to_vN+1` applied in ascending order with post-migration validation (§5). |
| `design/gdd/run-persistence.md` | Run Persistence | Core Rule 7 + Open Q1 — deterministic, order-sensitive, ≥32-bit checksum; pin the production algorithm | F2 weighted sum `(Σ code(sᵢ)·(i+1)) mod 2³²` pinned as canonical and frozen (§4); resolves Open Q1. |
| `design/gdd/run-persistence.md` | Run Persistence | Core Rule 11 — build-then-swap; a failed write never truncates the previous good save | Single-`setItem` swap of a fully-built string; retry-once-then-abandon on quota (§6). |
| `design/gdd/run-persistence.md` | Run Persistence | Core Rule 6 (newer save) + Unsupported state — a newer-than-code save is not Corrupted and is left on disk | `schemaVersion > CURRENT` → `Unsupported`, key untouched, never overwritten by a lower-version write (§5, §7). |
| `design/gdd/run-persistence.md` | Run Persistence | Core Rule 9 — single run slot in v1 | Exactly one Run Save; a different-run `saveRun` without clear is rejected (§3). |
| `design/gdd/run-persistence.md` | Run Persistence | Core Rule 10 + Rule 3 — reproducible resume; never store a generated encounter | Store only `runSeed` + `nodeId` + reproducible state; resume re-derives via `generateEncounter` (§8); relies on ADR-0004 (mulberry32). |
| `design/gdd/run-persistence.md` | Run Persistence | Open Q2 — Result-vs-throw error contract must be pinned | Adopted from ADR-0005 (Board/Combat error contract); expected outcomes are returned result values, not throws (§9). |
| `design/gdd/encounter-generator.md` | Encounter Generator | Reproducibility Rule 14 — `generateEncounter(runSeed, nodeId, difficultyConfig, rosterSnapshot)` must be pure | This ADR depends on and preserves that purity by storing seed inputs only, never the output (§8). |
| `design/gdd/meta-progression-and-unlocks.md` | Meta-progression / Unlocks | Persist unlocks; run-end merge is atomic and never loses an earned unlock | `mergeUnlocksIntoMeta` performs Rule 4f(i) as one idempotent union+write, ordered before `clearRun()` (§Guidelines). |

> Cross-system-contracts.md §4 (Module Ownership, Foundation) is the canonical
> authority for the exposed API surface; where any GDD diverges from it, the
> contracts file wins and this ADR follows it.

## Related

- `docs/architecture/architecture.md` §5(d) (save/load path), §8 Required ADR
  **A3** — this ADR formalizes that entry.
- `design/architecture/cross-system-contracts.md` §4 (Foundation ownership),
  §8 (resume signature) — canonical contract source.
- ADR-0004 (mulberry32 seed strategy) — the reproducibility contract this ADR's
  resume path relies on (not a hard dependency, but load-bearing for §8).
- ADR-0005 (Board/Combat error contract) — owns the Result-vs-throw convention
  this ADR adopts (resolves Run Persistence Open Q2).
- Code (once implemented): the persistence module and its Vitest suite under the
  Foundation layer.
