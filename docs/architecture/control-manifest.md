# Control Manifest

> **Engine**: Pure Web (TypeScript + PixiJS 8.x + Vite 6.x)
> **Last Updated**: 2026-07-28
> **Manifest Version**: 2026-07-28
> **ADRs Covered**: ADR-0001, ADR-0002, ADR-0003, ADR-0004, ADR-0005, ADR-0006, ADR-0007, ADR-0008, ADR-0009, ADR-0010, ADR-0011
> **Status**: Active — regenerate with `/create-control-manifest update` when ADRs change

This manifest is a programmer's quick-reference extracted from all Accepted ADRs,
technical preferences, and engine reference docs. For the reasoning behind each
rule, see the referenced ADR.

---

## Foundation Layer Rules

*Applies to: Board & Grid, Turn & Phase Manager, Run Persistence, Event Bus*

### Required Patterns
- **Board's internal data representation must be cheap by construction for `snapshot()`** — source: ADR-0001
- **Tile objects must be materialized only at the query boundary (e.g. `getTile`), never stored** — source: ADR-0001
- **Index function `index(c, r) = r * W + c` must be defined once and used everywhere** — source: ADR-0001
- **Board state must be byte-reproducible; no hidden identity, no RNG, no wall-clock** — source: ADR-0001
- **Event Bus `emit()` must be synchronous and invoke subscribers in registration order on the caller's stack** — source: ADR-0002
- **Run Persistence must write using build-then-swap atomic writes (one `setItem`)** — source: ADR-0003
- **Run Persistence checksum must hash the exact string handed to `setItem` for `data`** — source: ADR-0003
- **Resume must reproduce a byte-identical encounter from stored `runSeed` + `nodeId` alone** — source: ADR-0003
- **PRNG must force unsigned 32-bit (`>>> 0`) at every step** — source: ADR-0004
- **Shared Unit Record interfaces must be used where applicable** — source: ADR-0008
- **Coordinates must be correctly transformed when projecting reachable tiles** — source: ADR-0009

### Forbidden Approaches
- **Never implement `snapshot()` as a naive object-graph deep clone** — puts < 1 ms budget at risk — source: ADR-0001
- **Never duplicate the index arithmetic inline** — determinism/correctness hazard — source: ADR-0001
- **Queries must never return a reference into a backing array** — preserves single mutation path — source: ADR-0001
- **Event Bus handlers must not defer (no Promise/microtask/setTimeout/rAF)** — breaks determinism — source: ADR-0002
- **Preview dry-run events must never be published onto the shared event stream** — source: ADR-0002
- **Run Persistence must never store a generated encounter, only inputs** — source: ADR-0003
- **Run Persistence must never clear or truncate the key before its replacement string is fully built** — source: ADR-0003
- **A missing migration or shape validation failure must never be partially migrated (treat as Corrupted)** — source: ADR-0003
- **Saves with `schemaVersion > CURRENT_VERSION` must be left untouched on disk, never overwritten** — source: ADR-0003
- **Never use `Math.random()`, `Date.now()`, or PRNG in battle resolution (Combat/Turn Manager/Objectives/Enemy AI)** — breaks determinism — source: ADR-0004, technical-preferences.md

### Performance Guardrails
- **`snapshot()` full deep-copy (≤ 12×12) < 1 ms/call** — source: ADR-0001
- **Single O(1) query avg < 0.01 ms** — source: ADR-0001

---

## Core Layer Rules

*Applies to: Combat Resolution, Input & Selection, Move Preview*

### Required Patterns
- **All board mutation must flow exclusively through Combat `resolve()`** — source: ADR-0001, ADR-0006
- **Expected gameplay rejections must return a value-typed `Result`** — source: ADR-0005
- **Genuine programmer errors must fail-fast and assert/throw loudly** — source: ADR-0005
- **Rejections within an effect chain must not abort the chain (treat as per-primitive no-ops)** — source: ADR-0005
- **Effects must apply strictly sequentially in list order** — source: ADR-0006
- **Move Preview must reuse the identical `resolve()` entry point over a disposable snapshot** — source: ADR-0006, ADR-0007
- **Undo must adopt a previously captured snapshot as the new live board** — source: ADR-0007
- **Snapshot must be captured only AFTER an action's entire consequence chain resolves** — source: ADR-0007

### Forbidden Approaches
- **Expected gameplay rejections must never throw** — crashes preview overlay — source: ADR-0005
- **Never swallow a Channel-2 throw inside the sim path** — hides bug violations — source: ADR-0005
- **Combat never calls back into Turn & Phase Manager** — breaks dependency acyclic graph — source: ADR-0006
- **Target-locking must never use a live spatial query resolved mid-chain** — source: ADR-0006
- **Never add an 11th primitive without amending the GDD/ADR first** — hidden behaviours break legibility — source: ADR-0006
- **Snapshot must never be captured mid-chain** — source: ADR-0007

### Performance Guardrails
- **Board cost/frame < 2 ms** — source: ADR-0001

---

## Feature Layer Rules

*Applies to: Heroes & Abilities, Enemy Abilities & Telegraph, Objective, Encounter Generator, Difficulty Tiers, Run Structure, Draft/Loadout, Ability Upgrades, Meta-progression*

### Required Patterns
- **Variety must live entirely in a pre-battle, reproducible meta layer** — source: ADR-0004
- **Procedural consumers must draw in a declared, deterministic order** — source: ADR-0004
- **Encounter Generator must be a pure function of its inputs** — source: ADR-0010
- **Audio MUST source `lethalThreats` from `telegraphedLethalThreatCount(turn)`** — source: ADR-0011

### Forbidden Approaches
- **Encounter Generator MUST NOT call any Difficulty Tiers or Run Structure symbol** — source: ADR-0010
- **Run Structure MUST NOT import or call `generateEncounter` directly** — source: ADR-0010
- **Run Structure MUST NOT construct `DifficultyConfig`** — source: ADR-0010

---

## Presentation Layer Rules

*Applies to: Board Rendering & Juice, Battle HUD, Map/Run UI, Draft/Loadout UI, Audio System, Onboarding/Tutorial*

### Required Patterns
- **Presentation handlers must record what to animate synchronously and drive animation from their own rAF loop** — source: ADR-0002
- **Map/Run UI for a committed node MUST render the `tier` returned by `getEncounterForNode`** — source: ADR-0010
- **Battle HUD and Move Preview MUST both compute their telegraphed-tile set as the union of every living enemy's `Intent.telegraphedEffectTiles` with `telegraphedEnvironmentTiles(turn)`** — source: ADR-0011

### Forbidden Approaches
- **Presentation handlers must not re-emit onto the simulation stream** — source: ADR-0002
- **Presentation layer must never import/call simulation mutation functions** — source: technical-preferences.md
- **Audio MUST NOT compute a second lethality tally** — source: ADR-0011
- **Battle HUD and Move Preview MUST NOT consult Board & Grid's `getHazard` directly to build telegraphed-tile set** — source: ADR-0011

---

## Global Rules (All Layers)

### Naming Conventions
| Element | Convention | Example |
|---------|-----------|---------|
| Classes | PascalCase | `BoardGrid` |
| Variables | camelCase | `currentPhase` |
| Signals/Events | snake_case string literals | `turn_started` |
| Files | kebab-case | `board-grid.ts` |
| Constants | UPPER_SNAKE_CASE | `GRID_WIDTH` |

### Performance Budgets
| Target | Value |
|--------|-------|
| Framerate | 60 FPS |
| Frame budget | 16.67ms |
| Draw calls | <200 per frame |
| Memory ceiling | 256MB heap |

### Approved Libraries / Addons
- **pixi.js** ^8.x — 2D WebGL rendering
- **vite** ^6.x — build tool / dev server / HMR
- **vitest** ^3.x — test runner
- **@pixi/sound** — audio (optional, v1 advisory)

### Cross-Cutting Constraints
- **any type usage is forbidden** (use `unknown` + type guards)
- **Direct DOM manipulation in simulation code is forbidden**
- **Mutable global state is forbidden** (all state owned by explicit system modules)
- **No async in the event bus (synchronous only per ADR-0002)**
