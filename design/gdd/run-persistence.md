# Run Persistence

> **Status**: In Design
> **Author**: workflow (design-system fan-out)
> **Last Updated**: 2026-07-27
> **Implements Pillar**: #1 Perfect Information, Perfect Blame (a lost run/save is
> the ultimate unfair surprise); #3 Variety Lives in the Draft, Not the Dice
> (protects the meta-progression/draft layer that carries the game's variety)

## Overview

Run Persistence is the browser-local **save system**: it serializes two
independent, versioned slices of state — the player's single in-progress **run**
(node-map position, roster, draft history, run seed) and their permanent
**meta-progression** (unlocked heroes, enemy variants, difficulty tiers,
statistics) — to `window.localStorage`, and reliably restores them on the next
visit. It owns schema versioning, migration, corruption detection, and quota
handling, so that every other system (Run Structure / Node Map, Draft / Loadout
Meta, Meta-progression / Unlocks) can read and write persistent state through one
trusted, deterministic layer instead of touching `localStorage` directly. Players
never see it as a "system"; they feel it as **trust that their progress is safe**
— closing the tab and coming back should never cost them a run they cared about
(beyond the current, in-progress battle — see Core Rule 3). It exists because a
roguelike's retention hook is "an in-progress run and a build you don't want to
lose" (game-concept.md); without reliable persistence that hook is just anxiety.
Run Persistence is **v1 browser-local only** — no cloud sync, no cross-device
continuity, no account system.

## Player Fantasy

Run Persistence has no direct player fantasy — it is infrastructure, like Board &
Grid and Turn & Phase Manager. What players *feel* is **quiet safety**: they can
close the tab mid-run, mid-draft, or mid-campaign and trust that reopening the
game puts them back where they left off, with their roster and progress intact.
This directly protects Pillar #1 (Perfect Information, Perfect Blame) at the meta
layer — a run should only ever be lost to a *battle* the player lost, never to a
browser crash, a full disk, or a bad deploy. It also protects the "Investment"
retention hook named in game-concept.md: the half-built roster and the map route
already chosen are the reason the player comes back tomorrow. The failure state
of this system is a **silent** loss — a run or an unlock vanishing with no
explanation — which reads to the player as "the game cheated me," the single
worst trust violation this design can produce. A *disclosed, deterministic* loss
(e.g. "your last battle wasn't saved, resume from the start of that node") is
acceptable; a silent one is not.

## Detailed Design

### Core Rules

1. **Two independent persistence domains**, each its own versioned schema and its
   own `localStorage` key, so a corruption or migration failure in one can never
   take down the other:
   - **Meta Save** (`vanguard.meta.v{N}`) — permanent, survives across runs.
     Stores: unlocked heroes, unlocked enemy variants, unlocked difficulty tiers,
     cumulative statistics (runs completed, best tier cleared, total battles
     won). Owned jointly with Meta-progression / Unlocks, which defines *what*
     an unlock means; Persistence only stores and versions the record.
   - **Run Save** (`vanguard.run.v{N}`) — the *single* in-progress run's state:
     node-map graph + current node position + claimed/visited nodes, roster
     (heroes recruited this run + their ability upgrades), draft history, an
     immutable `runSeed` set once at run start, and a start timestamp. Removed
     entirely when the run ends (Victory, Defeat, or Abandon at the **campaign**
     level — not a single battle).
2. **Save granularity is node-map level, not mid-battle.** A checkpoint is
   captured at the start of a node (battle) and after a node resolves. Mid-battle
   state — current turn number, hazard overlays, unit HP/status, the undo stack —
   is **never persisted**; it lives only in memory, owned by Turn & Phase Manager
   / Combat Resolution. **PROVISIONAL scope decision** (see Open Questions):
   true mid-battle resume would require those systems to expose a full
   serialize/deserialize contract, which does not exist yet and is out of scope
   for v1.
3. **Resume restores the last checkpoint, not the last turn.** On load, if a
   valid Run Save exists, "Continue Run" restores the player to the **start** of
   the node/battle they were on, regenerated deterministically via the Encounter
   Generator's `generateEncounter(runSeed, nodeId, difficultyConfig,
   rosterSnapshot)` contract (same `runSeed` + `nodeId` ⇒ byte-identical
   encounter, per Pillar #1/#3 — reproducible because Persistence stores those
   two values verbatim and re-derives `difficultyConfig`/`rosterSnapshot` from
   the resumed map/roster state before calling it). Any turns played in that
   battle since the last checkpoint are lost — this is a disclosed,
   deterministic loss ("resume from the start of this fight"), never a silent
   one.
4. **Run Save write triggers** (each captures a new checkpoint unless noted):
   a. Entering a node (node selected on the map).
   b. A node resolving with Victory (updates claimed nodes + earned rewards).
   c. A draft/upgrade choice being confirmed (updates roster).
   d. The run ending (Victory/Defeat/Abandon at campaign level) — this triggers
      Rule 4f, not a normal checkpoint write.
   e. **Safety-net writes** on the `visibilitychange` (tab hidden) and
      `beforeunload` browser events — these re-write the *current* checkpoint
      (idempotent) to guard against an unflushed write; they never create a new
      checkpoint.
   f. **Run end sequence**: (i) merge any run-earned unlocks into Meta Save and
      write it, (ii) only then delete the Run Save key. This order is chosen so
      an interruption between the two steps never loses an earned unlock (see
      Edge Cases).
5. **Meta Save write triggers**: any unlock event (hero, enemy variant,
   difficulty tier unlocked), and step 4f(i) above.
6. **Schema versioning.** Each save is written as `{schemaVersion, checksum,
   data}` with an integer `schemaVersion`, versioned **independently per
   domain** (Meta and Run do not share a version counter). On load, if
   `schemaVersion < CURRENT_VERSION` for that domain, sequential migration
   functions (`migrate_vN_to_vN+1`) are applied until current (Formula F3). If
   `schemaVersion > CURRENT_VERSION` (a save from a newer build than the running
   code, e.g. after a rollback), the save is **Unsupported** — not corrupted —
   and is left untouched on disk (see Edge Cases).
7. **Corruption detection.** `checksum` is a deterministic, order-sensitive hash
   of the serialized `data` JSON string (Formula F2), computed at write time and
   re-verified at load time. A checksum mismatch, a JSON parse failure, or a
   missing required top-level field is **corrupted**, handled per Edge Cases
   (quarantine, never a silent crash or a partial/garbage load).
8. **Storage backend is `window.localStorage` only in v1.** No IndexedDB, no
   cloud sync, no cross-device or cross-browser continuity. Every write is
   wrapped to catch `QuotaExceededError` and `SecurityError` (storage disabled,
   e.g. private browsing in some browsers).
9. **Single run slot.** V1 supports exactly **one** in-progress Run Save at a
   time. Starting a new run while one exists is a UI-level confirm/overwrite
   flow (owned by Run Structure / Map UI); Persistence itself has no concept of
   multiple concurrent run slots.
10. **Determinism contract with Encounter Generator.** Because in-battle and
    encounter-selection randomness must be reproducible for resume to work
    (Pillar #1/#3), Run Persistence stores only `runSeed` (immutable, set once at
    run start) and the player's map position/choices — **never** the generated
    encounter itself. Resuming re-derives the identical encounter by calling
    `generateEncounter(runSeed, nodeId, difficultyConfig, rosterSnapshot)` again
    with the same `runSeed`/`nodeId` (Run Structure / Node Map and Draft /
    Loadout Meta reconstruct `difficultyConfig`/`rosterSnapshot` from the
    resumed state; those two inputs are already required to be pure functions of
    reproducible state, not independent randomness). This requires
    `generateEncounter()` itself to be pure (no hidden mutable state), a
    contract `encounter-generator.md` confirms (Reproducibility, Rule 14).
11. **Writes are synchronous and best-effort**, with no cross-page-load retry
    queue. A write builds the full new value first, then swaps it into the key
    (never truncates a key before the replacement is ready) — so a failed write
    always leaves the previous good save intact.

### States and Transitions

**Run Save lifecycle:** `NoRun → InProgress → RunEnded → NoRun` (RunEnded is
transient — it triggers the Rule 4f sequence and then the state is immediately
`NoRun` again).

**Load flow (per domain, independent for Meta and Run):**

`Unloaded → Loading → { Empty | Valid | Corrupted | Unsupported(NewerVersion) }`

| Load result | Meaning | System response |
|---|---|---|
| **Empty** | Key does not exist (first-ever load, or Run Save cleared at run end) | Meta: initialize to schema defaults and write immediately. Run: stays absent — no "Continue" offered — until a run starts. |
| **Valid** | Parsed, checksum matches, `schemaVersion == CURRENT_VERSION` (after migration if needed) | Loaded and used normally. |
| **Corrupted** | JSON parse failure, checksum mismatch, or missing required field | Quarantined (Edge Cases), domain reset to Empty-equivalent defaults. |
| **Unsupported(NewerVersion)** | `schemaVersion > CURRENT_VERSION` | Key left untouched; domain treated as unavailable for this session (no read, no write, no quarantine-delete). |

**Write outcome states:** `Attempting → { Written | QuotaExceeded | SecurityBlocked }`.
`QuotaExceeded` triggers one retry after pruning quarantine backups (Edge Cases);
`SecurityBlocked` (storage disabled) switches the session to **memory-only mode**
for the remainder of the session (Edge Cases).

### Interactions with Other Systems

Run Persistence is a **storage service**: it owns *how* state is versioned,
checksummed, and stored; the owning systems define *what* the payload contains.

| System | Reads from Persistence | Writes to Persistence | Ownership boundary |
|---|---|---|---|
| **Run Structure / Node Map** ✅ | node-map graph, current position, claimed nodes on resume | node position/claimed nodes on node entry & resolution (Rule 4a/4b) | Run Structure owns the map's shape and rules; Persistence owns storing/versioning it |
| **Draft / Loadout Meta** ✅ | roster + upgrade history on resume | roster/upgrade choices on confirm (Rule 4c) | Draft owns draft rules; Persistence stores the resulting roster record |
| **Meta-progression / Unlocks** ✅ | unlocked heroes/variants/tiers, statistics | unlock events (Rule 5); run-end merge (Rule 4f(i)) | Meta-progression owns unlock rules and the catalog; Persistence stores the record |
| **Heroes & Abilities** ✅ | — (roster record references hero ids) | — | Indirect — Persistence stores ids/refs, not hero definitions |
| **Encounter Generator** ✅ | — | — | Contract only: `generateEncounter(runSeed, nodeId, difficultyConfig, rosterSnapshot)` must be pure/deterministic (Rule 10); Persistence never stores its output |
| **Settings / Options** ✅ (`settings-and-options.md`, Designed 2026-07-28) | — | — | **Out of scope, and now confirmed as such.** Settings own a separate `vanguard.settings.v{N}` domain implementing this document's architecture as a **peer, not a client** — no call passes in either direction. This isolation is deliberate: a corruption in Meta or Run must never cost the player their settings (see Open Questions #8) |
| **Battle HUD / Onboarding** ✅ | save-state signals (saved / couldn't load / storage full) for toast display | — | Persistence emits events; UI owns presentation |

**Proposed engine API** (contract): `saveRun(data) → WriteResult`,
`loadRun() → {Empty|Valid(data)|Corrupted|Unsupported}`, `clearRun()`,
`saveMeta(data) → WriteResult`, `loadMeta() → {...}`, `mergeUnlocksIntoMeta(unlocks)`
(applies Rule 4f(i) as a single call so callers can't reorder the sequence),
`isStorageAvailable() → bool` (capability probe, Edge Case 4).

> **Confirmed by dependent GDDs:** Run Structure / Node Map, Draft / Loadout
> Meta, Meta-progression / Unlocks, and Encounter Generator are now Designed.
> Each has confirmed the engine API this document proposes —
> `saveRun`/`loadRun`/`clearRun` (Run Structure, Draft), `saveMeta`/`loadMeta`/
> `mergeUnlocksIntoMeta` (Meta-progression), and the `generateEncounter(runSeed,
> nodeId, difficultyConfig, rosterSnapshot)` purity contract (Encounter
> Generator, Reproducibility Rule 14) — against their own Dependencies sections,
> with no conflicts surfaced.

## Formulas

### F1. Run Save payload size estimate

`runSaveBytes(N, H, O) = O + N × B_node + H × B_hero`

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| nodes visited/claimed | `N` | int | 0–30 (typical map size) | Node records stored (id, type, visited/claimed flag, reward choice) |
| bytes per node record | `B_node` | int | ~60–100 (estimate) | Serialized JSON bytes for one node record |
| heroes in roster | `H` | int | 1–8 (per game-concept roster size) | Hero records stored (id + upgrade ids) |
| bytes per hero record | `B_hero` | int | ~150–250 (estimate) | Serialized JSON bytes for one hero record incl. 2–5 upgrade ids |
| base overhead | `O` | int | ~1000–2000 (estimate) | Run metadata: `runSeed`, `schemaVersion`, `checksum`, timestamps, difficulty tier, map graph edges |
| result | `runSaveBytes` | int | unbounded, practically ≤ ~10 KB | Total Run Save payload size |

**Output range:** unbounded in formula, but bounded in practice by map size and
roster cap (Draft / Loadout Meta's concern, not this system's). Not clamped —
Persistence stores whatever it is given and only reacts if the browser's quota
is actually exceeded (Rule 8, Edge Case 5).

**Worked example:** `N=20, B_node=80, H=6, B_hero=200, O=1500` →
`runSaveBytes = 1500 + 20×80 + 6×200 = 1500 + 1600 + 1200 = 4300 bytes ≈ 4.2 KB`.
Against a typical per-origin `localStorage` quota of 5–10 MB, one Run Save uses
**well under 0.1%** of quota — confirms a single-slot, full-JSON-payload
approach (no delta/compression scheme) is sufficient at this scale.

### F2. Checksum (corruption detection)

`checksum(s) = ( Σ_{i=0}^{n-1} code(s_i) × (i+1) ) mod 2^32`

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| serialized payload | `s` | string | any length | The JSON string of the domain's `data` field |
| payload length | `n` | int | ≥ 0 | Character count of `s` |
| char code | `code(s_i)` | int | 0–65535 | UTF-16 code unit at index `i` |
| position | `i` | int | 0..n-1 | Character index (drives the order-sensitive weight) |
| result | `checksum` | int (uint32) | 0 .. 2³²−1 | Stored alongside `data`; recomputed and compared at load |

**Output range:** `[0, 2^32 − 1]`, wrapped by the `mod`. Not a security
mechanism (client-side, trivially bypassable) — its only job is to catch
**accidental** corruption (truncated write, manual edit, storage-layer bit rot,
reordered/merged JSON) before it reaches game logic. The `× (i+1)` weight makes
it order-sensitive so a reordered/transposed payload also fails the check,
unlike a plain unweighted sum.

**Worked example:** `s = "AB"` → `code('A')=65, code('B')=66` →
`checksum = (65×1 + 66×2) mod 2^32 = (65 + 132) mod 2^32 = 197`.

*(This weighted-sum form is the reference formula this system requires —
deterministic, order-sensitive, cheap, ≥32-bit output space. The exact
production algorithm — this scheme, FNV-1a, CRC32, etc. — is an implementation
choice; see Open Questions.)*

### F3. Migration distance

`migrationsToApply(v_stored, v_current) = v_current − v_stored`, defined only
when `v_stored ≤ v_current` (see Edge Cases for `v_stored > v_current`).

| Variable | Symbol | Type | Range | Description |
|---|---|---|---|---|
| stored version | `v_stored` | int | ≥ 1 | `schemaVersion` found in the loaded save, per domain |
| current version | `v_current` | int | ≥ 1 | `schemaVersion` the running code expects, per domain |
| result | `migrationsToApply` | int | 0 .. v_current−1 | Count of sequential migration functions to run, one per version increment |

**Output range:** `[0, v_current − 1]`; `0` means already current (no migration
needed). Every version increment requires exactly one migration function
(`migrate_vN_to_vN+1`) — a missing link in that chain makes the save
**Corrupted**, not partially migrated (Edge Cases).

**Worked example:** `v_stored=1, v_current=4` → `migrationsToApply=3`; the
loader runs `migrate_v1_to_v2 → migrate_v2_to_v3 → migrate_v3_to_v4` in order,
validating the result's shape against the current schema before treating the
save as `Valid`.

## Edge Cases

- **Run Save is corrupted (checksum mismatch, parse failure, or missing
  required field):** quarantine it under `vanguard.run.corrupt.{timestamp}`
  (overwriting any older quarantined copy — retention count is a tuning knob),
  then treat the domain as `Empty`. No "Continue Run" is offered; the player can
  start a fresh run immediately. No blocking error dialog; a non-blocking toast
  informs them their last run couldn't be loaded.
- **Meta Save is corrupted:** quarantine under `vanguard.meta.corrupt.{timestamp}`,
  then **reset Meta Save to schema defaults** (no unlocks beyond the base
  roster/tier). This is a harsher outcome than the Run Save case because losing
  meta-progression is worse for the player than losing one run — but it is never
  silent: a one-time non-blocking notice states "Your saved progress couldn't be
  read and was reset."
- **`schemaVersion` is newer than the running code supports** (e.g. the player
  rolled back to an older build, or a bad deploy shipped): treated as
  **Unsupported**, explicitly **not** Corrupted. The key is **left untouched on
  disk** — it is never parsed further, never quarantined, and never overwritten
  by a stale lower-version save (which would destroy the newer data permanently
  once the player upgrades again). The domain behaves as unavailable for this
  session; the player sees "this save is from a newer version of the game."
- **`localStorage` is unavailable** (disabled, or a browser that throws on
  `setItem` in private browsing): detected once at boot via a capability probe
  (`try { setItem(probe); removeItem(probe) } catch`). If unavailable, the
  session runs in **memory-only mode**: reads/writes succeed logically in
  memory but nothing survives a reload. A persistent (non-blocking) banner
  states "Progress won't be saved this session."
- **`QuotaExceededError` on write:** retry the write **once**, after deleting
  any quarantined/backup keys (`*.corrupt.*`) to free space. If it still fails,
  the write is abandoned for that trigger, **the previous good save is left
  untouched** (per Rule 11's build-then-swap pattern), and a non-blocking
  warning states "Couldn't save — storage full." The game does not crash or
  lose its in-memory state.
- **Two tabs of the game open on the same origin:** `localStorage` is
  synchronous and shared per-origin — the tab that writes last wins; there is
  **no cross-tab locking or merge in v1**. This is a documented known
  limitation (see Open Questions), not a solved case.
- **Browser closes mid-battle (turns played since the last checkpoint):** on
  resume, per Core Rule 3, the node's battle restarts from turn 1 via
  deterministic regeneration. Turns played beyond the last checkpoint are lost
  by design — this is disclosed, not a bug, and the loss is bounded to "one
  battle's worth of turns," never the whole run.
- **A crash/close happens between Rule 4f(i) (merge unlocks into Meta Save) and
  4f(ii) (clear Run Save):** because the merge happens first and unlock-merging
  is a set union (idempotent — re-merging the same unlocks is harmless), no
  unlock is lost. The stale Run Save now points at an already-finished run. On
  the next load, Persistence exposes both a `Valid` Meta Save and a `Valid`
  (but stale) Run Save; Run Structure / Node Map (now Designed) must detect
  "resumed into an already-terminal node" (via its own `isRunComplete` check)
  and clear the stale Run Save itself rather than replaying a finished
  campaign — this is a contract requirement on Run Structure. `run-structure-
  node-map.md` does not yet document this specific check (see Open Questions
  #6); it remains open for that GDD's next revision.
- **A save is manually edited via devtools into syntactically valid but
  semantically wrong JSON** (e.g. a negative node index, an unknown hero id):
  because the checksum (F2) is computed over the *original* written payload,
  any edit changes the checksum too, so this is caught by the standard
  Corrupted path (first bullet above) — no separate semantic-validation layer
  is required for this case. This is a side effect of the corruption check, not
  a security feature; a determined tamperer could recompute a matching checksum
  — Persistence makes no anti-cheat claim.
- **Meta and Run domains are on different schema versions from each other**
  (e.g. code ships a Meta Save schema bump but the Run Save schema is
  unchanged): expected and fine — `schemaVersion` is tracked **independently
  per domain** (Rule 6); each is migrated on its own chain.
- **First-ever load (neither key exists):** both domains report `Empty`. Meta
  Save is initialized to schema defaults **and written immediately** (so any
  later unlock-merge always has a valid base to merge into). Run Save stays
  absent — it is not written until a run actually starts.

## Dependencies

**Upstream (systems Run Persistence's generic engine depends on): NONE.**
Persistence's core mechanics — versioning, checksumming, quota/corruption
handling, `localStorage` access — are self-contained (matches the systems-index
Foundation-layer placement: "no gameplay dependency"). The **shape** of each
domain's payload, however, is co-owned with the systems that produce that data
(listed below) — this is a soft, schema-level dependency, not a functional one.

| System (schema co-owner) | What it contributes to the payload | Hard / Soft |
|---|---|---|
| **Run Structure / Node Map** ✅ | node-map graph shape, node id format, claimed-node semantics | **Soft** — Persistence stores opaque data; shape is Run Structure's call |
| **Draft / Loadout Meta** ✅ | roster record shape, upgrade id format | **Soft** |
| **Meta-progression / Unlocks** ✅ | unlock catalog shape, statistics fields | **Soft** |
| **Encounter Generator** ✅ | purity contract for `generateEncounter(runSeed, nodeId, difficultyConfig, rosterSnapshot)` (Rule 10) | **Hard for resume correctness** — without it, resume cannot reproduce an identical encounter |

**Downstream (systems that depend on Run Persistence):**

| System | Interface | Hard / Soft |
|---|---|---|
| **Meta-progression / Unlocks** ✅ | `saveMeta`/`loadMeta`, `mergeUnlocksIntoMeta` | **Hard** (per systems-index: Meta-progression / Unlocks lists Run Persistence as a dependency) |
| **Run Structure / Node Map** ✅ | `saveRun`/`loadRun`/`clearRun` for map position & claimed nodes | **Hard** — confirmed by `run-structure-node-map.md`'s own Dependencies section ("resolves the bidirectional-consistency gap `run-persistence.md` explicitly flagged"); `systems-index.md`'s `Depends On` column still needs the edge added (out of scope for this edit) |
| **Draft / Loadout Meta** ✅ | `saveRun`/`loadRun` for roster/upgrade state | **Hard** — confirmed by `draft-and-loadout-meta.md`'s own Dependencies section; same `systems-index.md` edge gap as above |
| **Battle HUD / Onboarding** ✅ | save-state events for toast/banner display | **Soft** |

**Bidirectional-consistency note:** `systems-index.md` currently lists only
Meta-progression / Unlocks as depending on Run Persistence. This GDD's design
makes clear that Run Structure / Node Map and Draft / Loadout Meta will also
need to persist state through this system — when those GDDs are authored, they
must list Run Persistence as a dependency, or the index should be corrected.
*(Not edited here per this task's constraints — surfaced for the next
consistency pass.)*

## Tuning Knobs

| Knob | Default | Safe Range | Too Low | Too High |
|---|---|---|---|---|
| `run_save_slot_count` | 1 | 1–3 | `0` removes "Continue Run" entirely, defeating the Investment retention hook (game-concept.md) | Beyond 1 requires a save-select UI and multiplies quota usage per slot — deliberately deferred past v1 |
| `autosave_on_visibility_hidden` | `true` | bool | `false` removes the safety-net write, increasing the chance a crash loses the most recent checkpoint | No downside — it is idempotent (re-writes the current checkpoint only) |
| `quarantine_retention_count` | 1 | 0–3 | `0` means no corrupted-save diagnostic data is kept, making corruption reports unreproducible | Beyond 3 wastes quota on backups the player will never see |
| `save_quota_soft_limit_bytes` | 2 MB | 1–4 MB | Too low triggers false "storage full" warnings well before the real browser quota (5–10 MB typical) is hit | Too high leaves too little headroom before a real `QuotaExceededError`, risking a failed write with no advance warning |
| `meta_save_schema_version` (current) | 1 | ≥1, monotonic | N/A — this is a release counter, not a gameplay tuning value | Skipping a version number breaks the migration chain (F3 assumes exactly one migration per increment) |
| `run_save_schema_version` (current) | 1 | ≥1, monotonic | Same as above | Same as above |

**Intentionally NOT a knob:** **save granularity is fixed at node-map level**
(Core Rule 2) — mid-battle checkpointing is a structural scope decision, not a
tunable value; exposing it would imply a capability (true mid-turn resume) that
does not exist without Combat Resolution's cooperation (see Open Questions).
**The checksum algorithm is also not exposed as a knob** — swapping it silently
would invalidate every previously-written checksum and mass-corrupt existing
saves on the next load; changing it requires a schema version bump instead.

## Visual/Audio Requirements

Run Persistence has no dedicated screen, but it drives a small set of
**non-blocking status signals** that Battle HUD / Onboarding must surface. Full
visual/copy design is deferred to those systems' UX passes; the required signal
set is:

- **"Run saved"** — silent by default (no toast on every checkpoint; would be
  noisy). Only surface a visible confirmation on the *first* successful save of
  a session, to reassure new players persistence is working.
- **"Couldn't load your last run"** (Run Save corrupted) — non-blocking toast,
  dismissable, shown once per occurrence.
- **"Your saved progress couldn't be read and was reset"** (Meta Save
  corrupted) — non-blocking toast, higher visual weight than the run-corrupted
  toast given the greater loss.
- **"This save is from a newer version"** (Unsupported) — non-blocking toast;
  Continue/meta features that depend on the unreadable domain are disabled for
  the session.
- **"Progress won't be saved this session"** (storage unavailable) — persistent
  banner (not a dismissable toast) for the whole session, since every future
  write in that session will silently no-op without it.
- **"Couldn't save — storage full"** (quota exceeded after retry) — non-blocking
  toast.

No audio requirement — these are passive, non-interrupting notifications; a
subtle UI sound (if any) is Audio System's call, not specified here.

## UI Requirements

- A **"Continue Run"** entry point on the game's title/home screen, shown only
  when `loadRun()` returns `Valid`; hidden for `Empty`, `Corrupted`, and
  `Unsupported`.
- A confirm/overwrite prompt when starting a new run while a Run Save already
  exists (enforces the single-slot rule, Core Rule 9) — owned by Run Structure /
  Map UI, triggered by this system's `isRunActive()` check.
- The six toast/banner signals listed above, exact placement/styling deferred to
  Battle HUD and Onboarding / Tutorial UX passes.

## Acceptance Criteria

Pure, synchronous, deterministic tests against a fake/mocked `localStorage` (no
real browser storage in unit tests — integration tests may use a real browser
context per the project's Story Type table).

**Save/load round trip (Rules 1, 6, 7)**
- **GIVEN** a Run Save is written with `saveRun(data)`, **WHEN** `loadRun()` is
  called immediately after, **THEN** it returns `Valid` with data deep-equal to
  what was written.
- **GIVEN** the same for Meta Save, **THEN** the same round-trip guarantee holds
  independently.
- **GIVEN** two identical write sequences on two fresh mock-storage instances,
  **THEN** both produce byte-identical stored strings (determinism).

**Corruption detection & quarantine (Edge Cases, Rule 7)**
- **GIVEN** a valid Run Save, **WHEN** one character of the stored `data` string
  is mutated (checksum now mismatched) and `loadRun()` is called, **THEN** it
  returns `Corrupted`, the key is quarantined under `vanguard.run.corrupt.*`,
  and the live `vanguard.run.v{N}` key is cleared (treated as `Empty`).
- **GIVEN** a stored value that is not valid JSON, **WHEN** `loadRun()`, **THEN**
  `Corrupted` (same quarantine path), no exception escapes to the caller.
- **GIVEN** a valid JSON payload missing a required top-level field, **WHEN**
  `loadRun()`, **THEN** `Corrupted`.
- **GIVEN** a corrupted Meta Save, **WHEN** `loadMeta()`, **THEN** `Corrupted`,
  quarantined, and the live key is reset to schema defaults (not merely
  cleared) — verifying the harsher Meta-specific outcome.

**Schema version handling (Rule 6, Formula F3)**
- **GIVEN** `schemaVersion < CURRENT_VERSION`, **WHEN** loaded, **THEN**
  exactly `migrationsToApply` (F3) migration functions run in ascending order
  and the result validates against the current schema.
- **GIVEN** a version chain missing one migration function, **WHEN** loaded,
  **THEN** the result is `Corrupted` (not partially migrated).
- **GIVEN** `schemaVersion > CURRENT_VERSION`, **WHEN** loaded, **THEN** the
  result is `Unsupported(NewerVersion)`, the stored key is **not** parsed
  further and **not** overwritten by any subsequent write in that session.

**Quota & storage-availability handling (Rule 8, Edge Cases)**
- **GIVEN** a write that throws `QuotaExceededError`, **WHEN** `saveRun()` is
  called, **THEN** it retries once after removing quarantine keys; if the retry
  also throws, the write is abandoned, the previous good save (if any) is
  byte-identical to before the attempt, and a `storage_full` event fires.
- **GIVEN** the capability probe throws on `setItem`, **WHEN** the app boots,
  **THEN** the session enters memory-only mode: subsequent `saveRun`/`loadRun`
  calls succeed against an in-memory store for that session only, and a
  `storage_unavailable` event fires once.

**Run lifecycle & single-slot rule (Rules 1–5, 9)**
- **GIVEN** no Run Save exists, **WHEN** `loadRun()`, **THEN** `Empty` and
  "Continue Run" is not offered (consumer-level check on the returned state).
- **GIVEN** an active run, **WHEN** a node is entered / a node resolves victory /
  a draft choice is confirmed, **THEN** `saveRun()` is invoked exactly once per
  trigger with the updated checkpoint data.
- **GIVEN** an active run, **WHEN** the run ends, **THEN** `saveMeta()` (merge)
  is called **before** `clearRun()`, in that order (regression guard for the
  Rule 4f ordering).
- **GIVEN** the run-end sequence is interrupted after the meta merge but before
  `clearRun()`, **WHEN** the app reloads, **THEN** the merged unlocks are
  present in `loadMeta()` and the stale Run Save is still `Valid` (verifying no
  unlock is lost, per Edge Case).
- **GIVEN** a Run Save already exists, **WHEN** a second `saveRun()` for a
  *different* run is attempted without an explicit overwrite/clear, **THEN** it
  is rejected (single-slot enforcement, Rule 9).

**Determinism contract (Rule 10)**
- **GIVEN** a stored `runSeed` and `nodeId`, **WHEN** resume calls
  `generateEncounter(runSeed, nodeId, difficultyConfig, rosterSnapshot)` twice
  in a row with the same re-derived `difficultyConfig`/`rosterSnapshot`,
  **THEN** both calls return deep-equal encounter definitions (purity check on
  the contract this GDD imposes — exercised here as an integration test against
  the real Encounter Generator).

**Formulas (F1–F3)**
- **GIVEN** `(N, B_node, H, B_hero, O)`, **THEN** `runSaveBytes` matches F1 for
  ≥3 sample tuples incl. the worked example (`N=20,H=6 → 4300 bytes`).
- **GIVEN** `s="AB"`, **THEN** `checksum(s) == 197` (F2 worked example, exact
  regression value).
- **GIVEN** `(v_stored, v_current)` pairs incl. equal (0 migrations) and
  multi-step, **THEN** `migrationsToApply` matches F3 exactly.

### Performance Budget (headless TS; storage engine overhead only)

| Operation | Budget | Gate |
|---|---|---|
| `saveRun()` / `saveMeta()` (≤10 KB payload, incl. checksum compute) | < 5 ms | CI-blocking |
| `loadRun()` / `loadMeta()` (incl. checksum verify, no migration) | < 5 ms | CI-blocking |
| `loadRun()` with a 3-step migration chain | < 15 ms | CI-blocking |
| Boot-time capability probe (`isStorageAvailable`) | < 2 ms | CI-blocking |
| Checksum compute (F2) on a 10 KB string | < 3 ms | Advisory |

## Open Questions

**Needs an architecture decision (→ `/architecture-decision`):**

1. **Production checksum algorithm.** This GDD specifies the *requirements*
   (deterministic, order-sensitive, ≥32-bit output, cheap) and a reference
   formula (F2) for worked examples; the actual implementation (the F2 scheme,
   FNV-1a, CRC32, etc.) is a technical choice. Pin it in an ADR — once chosen,
   changing it later requires a schema version bump (every existing checksum
   would otherwise mismatch).
2. **Rejected-write / corrupted-load error contract.** Mirrors board-and-grid.md's
   open question: does `loadRun()`/`saveRun()` return a `Result` enum, throw,
   or emit events-only? Must be pinned so this system, its tests, and its
   callers (HUD, Run Structure) agree.

**Resolved this session (provisional defaults — confirm during implementation):**

3. **Save granularity is node-map level, not mid-battle** (Core Rule 2) — a
   deliberate v1 scope cut. Combat Resolution and Turn & Phase Manager are both
   now Designed, but neither exposes a full battle-state serialize/deserialize
   contract — their `snapshot()`/restore mechanism (per `cross-system-
   contracts.md` §2/§3) only covers Board state for **within-phase undo**, not
   the complete mid-battle state (turn number, hazard overlays, unit HP/status,
   undo stack) this system would need to persist. **If true mid-battle resume is
   wanted later**, it requires Combat Resolution / Turn & Phase Manager to
   expose a `serializeBattleState()`/`restoreBattleState()` contract analogous
   to the Board `snapshot()` mechanism — flagged here for whoever revisits those
   systems next.
4. **Single run slot (v1)** — multiple concurrent runs deferred past v1
   (`run_save_slot_count` knob documents the future extension point).
5. **Run-end ordering (merge-then-clear)** — chosen specifically to make an
   interrupted run-end fail toward "unlock kept, stale run save visible" rather
   than "unlock lost."

**Deferred to the owning system's GDD:**

6. **"Resumed into an already-terminal node" handling** — owned by **Run
   Structure / Node Map** (`isRunComplete` check, Edge Cases). Persistence only
   guarantees the stale Run Save remains loadable; Run Structure must decide
   what to do with it.
7. **Cross-tab write conflicts (last-write-wins)** — documented as a known v1
   limitation (Edge Cases), not solved. If it becomes a real problem, a future
   fix would use the `storage` event or `BroadcastChannel` to detect/reconcile
   concurrent tabs — out of scope for this GDD.
8. **Settings / Options persistence — RESOLVED 2026-07-28.**
   `settings-and-options.md` chose **its own domain**: `vanguard.settings.v{N}`,
   a third sibling to `vanguard.meta.v{N}` and `vanguard.run.v{N}`, with its own
   `schemaVersion`, migration chain, and checksum. It is a **peer, not a client**
   — it does not call this system, and this system does not call it. What it
   borrows is this document's architecture (envelope, checksum, per-domain
   version, sequential migration, four-state load model), which is why a
   corruption here can never cost the player their keybindings or colorblind
   mode. This system still defines only the Run and Meta domains.
9. **Payload schema shapes** (node record fields, hero/upgrade record fields,
   unlock catalog fields) are deferred to **Run Structure / Node Map**, **Draft
   / Loadout Meta**, and **Meta-progression / Unlocks** respectively — this GDD
   only defines the generic envelope (`schemaVersion`, `checksum`, `data`) and
   the size/versioning formulas that apply to any payload they produce.
10. **Long-term migration-chain retention** (how many old schema versions the
    game keeps supporting) is a live-service/product decision for later —
    not resolvable at this design stage.
