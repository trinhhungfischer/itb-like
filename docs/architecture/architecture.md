# VANGUARD — Master Architecture

> The single, authoritative technical picture of VANGUARD: layers, module
> ownership, data flow, interface contracts, and the ADRs that must exist before
> implementation. It is the architectural reconciliation of the 21 designed GDDs
> against `design/architecture/cross-system-contracts.md` (canonical). Where any
> GDD diverges from the contracts file, **the contracts file wins**, and this
> document follows it.

---

## 1. Document Status

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Date** | 2026-07-28 |
| **Status** | Accepted (TD sign-off 2026-07-28) |
| **Stack** | TypeScript + PixiJS (2D WebGL) + Vite — pure web, no native engine |
| **GDDs covered** | 21 (10 MVP + 11 Vertical Slice), all Designed & reconciled 2026-07-28 |
| **Alpha systems noted (not covered)** | 0 — all four became Designed 2026-07-28 (`pilots.md`, `node-bonuses.md`, `accessibility.md`, `settings-and-options.md`). **None requires a simulation-core change**: Pilots and Node Bonuses are run-layer, Accessibility is a requirements authority, and Settings owns a separate `vanguard.settings.v{N}` persistence domain that is a peer of Run Persistence, not a client. This architecture is unchanged by all four — see §7 |
| **Canonical contract source** | `design/architecture/cross-system-contracts.md` |
| **Registry source** | `design/registry/entities.yaml` |
| **ADRs referenced** | None yet (`docs/architecture/` contains no `adr-*.md`) — see §7, §8 |

**Sign-off:**

- Technical Director: **APPROVED** 2026-07-28 — consistent with cross-system-contracts.md; covers all 21 Designed systems and C1–C4; 11 Required ADRs identified; no blockers.
- Lead Programmer: _LP-FEASIBILITY skipped — Lean mode._

---

## 2. Tech Stack & Knowledge-Gap Summary

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Language** | TypeScript (strict mode) | Static types enforce the cross-system contracts at compile time; the interface boundaries in §6 become real `interface` declarations. |
| **Rendering** | PixiJS (2D WebGL, Canvas2D fallback) | A deterministic 2D grid with icon-driven telegraphs needs fast 2D sprite batching, not a 3D/physics engine. Pixi is a thin, presentation-only dependency (Principle P3). |
| **Build/Dev** | Vite | Fast HMR for iteration on juice/UI; ES-module output; trivial static-host deploy for a browser game. |
| **Runtime target** | Evergreen desktop browsers (PC web primary) | Matches the target player profile (desktop strategy/puzzle players). |
| **Persistence** | `window.localStorage` | Single-player, browser-local; no backend, no accounts, no cloud sync in v1 (see Run Persistence GDD). |
| **Networking** | None | Single-player, fully local, fully deterministic. |
| **Testing** | Vitest (headless TS) for the simulation core; per-frame render/juice verified by screenshot + sign-off | Simulation core is pure and fully unit-testable (Principle P4). |

### Knowledge-Gap Risk: **LOW**

TypeScript, PixiJS, and Vite are stable and well within the model's training
knowledge; there is **no post-cutoff engine version gap** to manage. The Godot
engine-reference in `docs/engine-reference/` **does not apply** to this build and
is intentionally not consulted — the user explicitly chose a pure-web stack. The
only genuinely novel/technical risk is design-driven, not stack-driven: a
trustworthy full move-preview and a solvable-battle encounter generator (see §5,
§9, and the High-Risk table in `systems-index.md`).

---

## 3. System Layer Map

VANGUARD's 25 systems (21 Designed + 4 Alpha Not-Started) resolve into five
strict layers. Dependencies point **downward only** — a layer may depend on the
layers below it, never above. This is the structural guarantee that the
simulation core never imports presentation (Principle P3) and that the cycle-break
convention (all abilities depend on Combat's primitives, never the reverse) holds.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ PRESENTATION   Board Rendering & Juice · Battle HUD · Map/Run UI ·             │
│ (reads sim,     Draft/Loadout UI · Audio System · Onboarding/Tutorial          │
│  never mutates) ── consumes events + read-only queries only ──▲                │
├───────────────────────────────────────────────────────────────┼──────────────┤
│ FEATURE        Heroes & Abilities · Enemy Abilities & Telegraph · Objective ·  │
│                Encounter Generator · Difficulty Tiers · Run Structure/Node Map ·│
│                Draft/Loadout Meta · Ability Upgrades · Meta-progression         │
│                ── abilities compile to Combat primitives (one-way) ──▲         │
├───────────────────────────────────────────────────────────────────┼──────────┤
│ CORE           Combat Resolution (10 primitives, resolve()) ·                  │
│                Input & Selection · Move Preview                                 │
│                ── mutate only via Combat; preview via snapshot() ──▲          │
├─────────────────────────────────────────────────────────────────────┼────────┤
│ FOUNDATION     Board & Grid (spatial model + snapshot) ·                       │
│                Turn & Phase Manager (phase order + undo) ·                      │
│                Run Persistence (localStorage) · Event Bus (sync, deterministic)│
├────────────────────────────────────────────────────────────────────────────┤
│ PLATFORM       Browser · Canvas/WebGL (PixiJS) · WebAudio · localStorage       │
│                requestAnimationFrame · pointer/keyboard input                  │
└──────────────────────────────────────────────────────────────────────────────┘

  ALPHA (all Designed 2026-07-28 — zero sim-core impact):
    Feature:   Pilots · 4X-lite Node Bonuses          (run layer)
    Presentation/Meta: Accessibility (requirements authority)
                       Settings/Options (own persistence domain, peer of Run Persistence)
```

**Layer assignment of every Designed system:**

| Layer | Systems | Notes |
|-------|---------|-------|
| **Platform** | Browser APIs: DOM/Canvas, WebGL (via PixiJS), WebAudio, `localStorage`, `requestAnimationFrame`, pointer/keyboard | Not "systems" we design — the runtime substrate all layers sit on. |
| **Foundation** | Board & Grid; Turn & Phase Manager; Run Persistence; **Event Bus** (see §5c) | Zero gameplay dependencies. Board & Run Persistence are the two true roots (no upstream). |
| **Core** | Combat Resolution; Input & Selection; Move Preview | Combat is the single board-mutation path. Move Preview is a dry-run of Combat over a snapshot. |
| **Feature** | Heroes & Abilities; Enemy Abilities & Telegraph; Objective/Win-Lose; Encounter Generator; Difficulty Tiers; Run Structure/Node Map; Draft/Loadout Meta; Ability Upgrades; Meta-progression/Unlocks | All gameplay + progression logic. Abilities compile to Combat primitives one-directionally. |
| **Presentation** | Board Rendering & Juice; Battle HUD; Map/Run UI; Draft/Loadout UI; Audio System; Onboarding/Tutorial | Read-only consumers of sim state + events. **Never** call a Combat mutation. |
| **Alpha** | Pilots, 4X-lite Node Bonuses (Feature); Accessibility, Settings/Options (Presentation/Meta) — all Designed 2026-07-28 | Pilots consumes `battle_ended` and writes run state. Node Bonuses observes `MapNode.state == Claimed`. Accessibility authors no runtime code — it is a requirements and verification authority. Settings owns `vanguard.settings.v{N}`, implementing Run Persistence's architecture as a **peer** so a save corruption cannot cost the player their settings. **None touches a Foundation or Core module.** |

---

## 4. Module Ownership

Per system: what it **Owns** (authoritative state/logic no one else may
duplicate), what it **Exposes** (its public contract), and what it **Consumes**.
Sourced from `cross-system-contracts.md`; the emphasized rows are the load-bearing
ownership boundaries the whole architecture depends on.

### Foundation

| System | Owns | Exposes | Consumes |
|--------|------|---------|----------|
| **Board & Grid** | The spatial model — tile terrain, occupancy, hazard overlay, flags; the one bounded flood-fill (`reachableTiles`, C3); cheap `snapshot()`. | Pure queries (`inBounds`, `getTile`, `isOccupied`, `getOccupant`, `isBlocked`, `getHazard`, `hasFlag`, `neighbors`, `distance`, `tilesInRange`, `step`, `classify`, `rayTiles`, `reachableTiles`, `snapshot`); deterministic mutations (`place`, `clear`, `setTerrain`, `setHazard`, `setFlag`) **invoked only via Combat**. | Nothing (root). |
| **Turn & Phase Manager** | Phase sequencing (`TurnStart→PlayerPhase→Environment→EnemyResolve→Spawn→Telegraph→EndCheck`); the in-phase undo stack; when to snapshot. | Current turn #, current phase; phase events (`turn_started`, `player_phase_begun`, `action_applied`, `action_undone`, `enemy_action_resolved`, `enemy_spawned`, `intents_telegraphed`, `battle_ended`). | Board `snapshot()`; Combat `resolve()`; Enemy `resolveTelegraphed`/`emergeSpawns`/`chooseIntents`; Objective `evaluate()`. |
| **Run Persistence** | Save envelope: `{schemaVersion, checksum, data}`; versioning + migration; corruption/quarantine; quota handling; two independent domains (`vanguard.meta.v{N}`, `vanguard.run.v{N}`). | `saveRun`/`loadRun`/`clearRun`, `saveMeta`/`loadMeta`, `mergeUnlocksIntoMeta`, `isStorageAvailable`. Stores **only** `runSeed`+`nodeId`+map/roster state — never generated encounters. | `localStorage`; the mulberry32 determinism contract of `generateEncounter`. |
| **Event Bus** | The synchronous, deterministic observer channel (see §5c, ADR). | `emit(event)`, `on(type, handler)`, `off`. No async, no microtask deferral. | Nothing. |

### Core

| System | Owns | Exposes | Consumes |
|--------|------|---------|----------|
| **Combat Resolution** ★ | **The 10 effect primitives** (`damage`, `push`, `pull`, `swap`, `spawnHazard`, `applyHazard`, `removeUnit`, `setTerrain`, `spawnUnit`, + shared collision-resolution algorithm); the canonical event vocabulary; the **single board-mutation path**. | `resolve(board, effects[]) → events[]` — pure (state→state), strictly sequential, no RNG. | Board mutation API (`place`/`clear`/`setTerrain`/`setHazard`). **Never** calls back into Turn Manager. |
| **Input & Selection** | Pointer/keyboard capture; selection state machine; the `Locked` gate on `isAnimating()`. | Emits hover/select/cancel/confirm **events** (does not call `preview()` synchronously). | Board coordinate queries; Board Rendering `isAnimating()`; screen↔tile transform (C3 module). |
| **Move Preview** | The dry-run overlay — silent, subscription-based. | Threat/consequence overlay state for HUD/Rendering. | Subscribes to Input events; dry-runs Combat `resolve()` on `board.snapshot()`; unions `telegraphedEnvironmentTiles` (C4) with enemy intents. |

### Feature

| System | Owns | Exposes | Consumes |
|--------|------|---------|----------|
| **Heroes & Abilities** ★ | The shared **`AbilityDefinition`** schema (`{shape, targetFilter, effectTemplate, compileEffects()}`); the canonical **`Unit` record** (C2, registry `unit_record`). | `legalMoveTiles()` (F1, via Board `reachableTiles`), `legalTargets()`, `compileEffects()` (→ 10 primitives). | Combat primitives; Board queries. |
| **Enemy, Abilities & Telegraph** ★ | Enemy roster; deterministic target-selection AI; the **telegraph** (`telegraphedEnvironmentTiles(turn)`, `telegraphedLethalThreatCount(turn)`, C4); enemy emergence + on-death broods (via `spawnUnit`). | `resolveTelegraphed()`, `emergeSpawns()`, `chooseIntents()`, the two telegraph queries. | The **same** `AbilityDefinition` schema (reused, not re-shaped); Combat primitives; Board queries. |
| **Objective / Win-Lose** ★ | Win/lose predicates; `max_turns`. | `evaluate(battleState, turn, config) → {ongoing, victory, defeat}` — pure, side-effect-free, **state-poll** (no event subscription), callable multiple times/turn. | `battleState` (read-only); `UnitRemoved` semantics (polls board, does not subscribe). |
| **Encounter Generator** | Template-based battle assembly + solvability validation. | `generateEncounter(runSeed, nodeId, difficultyConfig, rosterSnapshot) → Encounter` — **pure** (drives the *real* Combat/Heroes/Objective code paths, never a parallel reimplementation). | mulberry32 PRNG (procedural only); real hero/enemy/objective code; Board flag-writes. |
| **Difficulty Tiers** ★ | **C1 ownership** — builds `difficultyConfig`; the returned `tier` is the single source of truth for both Map/Run UI display and the generator's difficulty curve. | `getEncounterForNode(runSeed, nodeId, nodeIndex, ascensionOffset, rosterSnapshot) → {tier, encounter}`. | Encounter Generator's `generateEncounter`. |
| **Run Structure / Node Map** | Node-map graph shape + routing rules; run lifecycle. | `processRunEnd(outcome)` (Meta-progression hooks terminal handling); node-map state. | **Difficulty Tiers**' `getEncounterForNode` (C1) — **not** Encounter Generator directly; drops its own `MapNode.tierIndex`/F6 (display-only). Persists via Run Persistence. |
| **Draft / Loadout Meta** | Draft rules; roster/upgrade selection. | Roster record; draft events. | Heroes (`Unit`/`AbilityDefinition`); Ability Upgrades; Run Structure; persists via Run Persistence. |
| **Ability Upgrades** | Upgrade catalog + slot rules (`upgrade_slots_per_hero`=2). | Upgraded `AbilityDefinition`s. | Heroes & Abilities (references `Unit`, does not re-shape it). |
| **Meta-progression / Unlocks** | Unlock catalog + rules (what an unlock *means*). | Unlock records; hooks `processRunEnd`. | Run Persistence (`saveMeta`/`mergeUnlocksIntoMeta`); Heroes; Draft. |

★ = a load-bearing ownership boundary; violating it re-introduces a cycle or a
second mutation path.

### Presentation (read-only consumers — never mutate the board)

| System | Owns | Consumes |
|--------|------|----------|
| **Board Rendering & Juice** | Sprite/animation state; `isAnimating()` gate for Input. | Board queries; Combat's canonical events (drives all juice off `DamageApplied`, `DisplacementComplete`, `CollisionResolved`, `SwapComplete`, `HazardSpawned`, `HazardApplied`, `UnitRemoved`, `TerrainSet`, `UnitSpawned`). |
| **Battle HUD** | HUD widgets; `heroesInDanger` safety check (**unions** environmental telegraph tiles with enemy intents, C4). | Combat events; Heroes/Enemy/Objective/Move Preview queries; Turn Manager turn#/phase. |
| **Map/Run UI** | Node-map presentation. | Run Structure state; the authoritative `tier` from Difficulty Tiers (C1); Draft state. |
| **Draft/Loadout UI** | Draft screen presentation. | Draft/Loadout Meta state. |
| **Audio System** | SFX/music playback; adaptive tension. | Combat's canonical event stream (ignores Preview — no preview events reach it); `telegraphedLethalThreatCount(turn)` for tension. |
| **Onboarding / Tutorial** | Scripted tutorial flow. | Battle HUD, Heroes, Enemy, Combat (read-only). |

---

## 5. Data Flow

### (a) Player-action path — the load-bearing loop

```
 Input & Selection ── emits hover/select/confirm EVENTS
        │
        ▼ (subscribes)
 Move Preview ── board.snapshot() ──► ability.compileEffects() ──► Combat.resolve(SNAPSHOT, effects)
        │                                                                   │
        │  (dry-run: live board UNTOUCHED, events discarded/overlay only)   │
        ▼                                                                    ▼
   overlay to HUD/Rendering                                        threat/consequence preview
        │
        │  ── player confirms ──►
        ▼
 Turn & Phase Manager.applyAction()
        │
        ▼
 Combat.resolve(LIVE board, effects) ──► events[]  (canonical names only)
        │                                    │
        │                                    ├──► Board Rendering & Juice (animate)
        │                                    ├──► Audio System (SFX/music)
        │                                    └──► Battle HUD (HP, danger, log)
        ▼
 Turn Manager captures Board.snapshot() AFTER the full consequence chain (incl. on-death spawnUnit)
```

The **same** `Combat.resolve()` and the **same** `compileEffects()` serve both the
silent dry-run (over a snapshot) and the committed application (over the live
board). There is exactly one simulation; preview is not a reimplementation
(mitigates the Move Preview technical risk).

### (b) Turn / phase flow — environment-first order

```
Setup (place enemies; telegraph Turn 1 intents + environmental intents)
  └─► loop:
      TurnStart      increment turn; tick duration effects; emit turn_started
      PlayerPhase    player acts freely (undo/redo); each action → Combat.resolve(live);
                     snapshot after each action's full chain; ends on "End Turn" (Committed)
      Environment    ★ resolves FIRST — hazards tick, scripted board events; via Combat.resolve
                       (early defeat check)
      EnemyResolve   telegraphed enemy actions execute in deterministic order, on the board
                     as Environment left it; via Combat.resolve   (early defeat check)
      Spawn          telegraphed spawns emerge via spawnUnit onto Clear spawn tiles
                       (early defeat check)
      Telegraph      all survivors + environment choose NEXT-turn intents and display them
      EndCheck       Objective.evaluate() — terminal victory OR defeat; else loop
```

Environment resolving **before** enemies is a deliberate tactical-depth choice
(environment can set up or disrupt the coming attacks). Per turn: **at most 4**
`Objective.evaluate` calls (3 early lose-only checks + 1 terminal win/lose check).
Undo is scoped strictly to the current Player Phase and can never cross a phase
boundary; the undo stack is cleared on Commit (bounding memory to one phase).

### (c) Event model — synchronous, deterministic observer bus

- A single lightweight **synchronous** event bus. `emit()` invokes subscribers
  **immediately and in registration order**, on the same call stack — **no**
  `Promise`, `setTimeout`, `queueMicrotask`, or `requestAnimationFrame` deferral
  anywhere in the simulation path. This is what keeps replay/undo byte-identical
  (Principle P1) and is an ADR (§8).
- Combat emits **only** the canonical event names. All consumers (Rendering,
  Audio, HUD, Move Preview) subscribe to those exact names — there is no
  `push_resolved`/`apply()` event or entry point.
- Preview events never reach the shared stream that Audio listens to, so no
  `committed` tag is needed — the silence *is* the boundary.
- Objective is a **state-poll**, not a subscriber: Turn Manager calls
  `evaluate(battleState, turn, config)` directly at the check points.

### (d) Save / load path — Run Persistence

```
Write:  build full {schemaVersion, checksum(data), data}  ──►  swap into localStorage key
        (build-then-swap: a failed write never truncates the previous good save)
        triggers: enter node · node victory · draft confirm · run end · visibility/beforeunload safety-net

Load:   read key ──► parse ──► verify checksum ──► migrate vN→CURRENT ──►
        { Empty | Valid | Corrupted(quarantine) | Unsupported(newer, left untouched) }

Resume: stored runSeed + nodeId  ──►  generateEncounter(runSeed, nodeId, difficultyConfig, rosterSnapshot)
        re-derives the byte-identical encounter (mulberry32; no encounter is ever stored)
```

Save granularity is **node-map level, not mid-battle** — mid-battle state (turn #,
hazards, HP, undo stack) lives only in memory. Two independent versioned domains
(Meta / Run) so a failure in one can't take down the other. Procedural
reproducibility rests entirely on the **mulberry32** seed strategy (registry
`mulberry32_prng`) — used for map/encounter/draft generation **only, never for
in-battle resolution**.

### (e) Init / boot order

```
1. Platform probe        — isStorageAvailable(); WebGL/Canvas capability; input listeners
2. Load meta             — loadMeta() → defaults-and-write if Empty (so unlock-merge always has a base)
3. Construct Event Bus   — synchronous singleton for the session
4. Title / Continue      — loadRun(): offer "Continue" only on Valid
5. Enter run             — Run Structure builds/loads node map; Difficulty Tiers ready
6. Enter battle (node)   — getEncounterForNode() → {tier, encounter} → Encounter Generator
                           builds Board (flags/terrain), places units, compiles telegraphs
7. Construct battle sim  — Board · Turn & Phase Manager · Combat · Objective · Move Preview
8. Mount presentation    — PixiJS Board Rendering, HUD, Audio subscribe to the Event Bus
9. Setup phase           — telegraph Turn 1; hand control to Player Phase
```

---

## 6. API Boundaries

TypeScript pseudocode for the key contracts. These are the interfaces the
compiler must enforce; signatures are drawn verbatim-in-intent from
`cross-system-contracts.md`. (Illustrative — field-level detail is the owning
GDD's to finalize.)

```typescript
// ── Board & Grid: the spatial query/mutation surface (contracts §2) ─────────────
type Tile = { col: number; row: number };
type Dir = 'N' | 'S' | 'E' | 'W';
type Classification = 'OutOfBounds' | 'BlockedTerrain' | 'Lethal' | 'Occupied' | 'Clear';

interface Board {
  // Queries (pure — never mutate)
  inBounds(c: number, r: number): boolean;
  getTile(c: number, r: number): TileState;
  isOccupied(t: Tile): boolean;
  getOccupant(t: Tile): UnitId | null;
  isBlocked(t: Tile): boolean;
  getHazard(t: Tile): HazardType | null;
  hasFlag(t: Tile, flag: TileFlag): boolean;       // 'spawn-point' | 'objective' | 'deploy-zone'
  neighbors(t: Tile): Tile[];                        // orthogonal, in-bounds (2–4)
  distance(a: Tile, b: Tile): number;                // Manhattan
  tilesInRange(origin: Tile, R: number): Tile[];
  step(t: Tile, d: Dir): Tile;                        // may be out of bounds (caller checks)
  classify(t: Tile): Classification;
  rayTiles(origin: Tile, d: Dir, maxLen: number): Tile[];
  reachableTiles(origin: Tile, range: number, board: Board): Tile[];  // the ONE BFS (C3)
  snapshot(): Board;                                  // cheap deep copy (ADR — flat typed arrays)

  // Mutations (deterministic — invoked ONLY via Combat.resolve)
  place(t: Tile, u: UnitId): Result;
  clear(t: Tile): void;
  setTerrain(t: Tile, terrain: TerrainType): Result;
  setHazard(t: Tile, h: HazardType | null): void;
  setFlag(t: Tile, flag: TileFlag): void;
}

// ── Combat Resolution: the single board-mutation path (contracts §1) ────────────
type EffectPrimitive =
  | { kind: 'damage';      targetId: UnitId; amount: number; sourceId?: UnitId }
  | { kind: 'push';        targetId: UnitId; direction: Dir; distance: number; sourceId?: UnitId }
  | { kind: 'pull';        targetId: UnitId; sourceId: UnitId; direction: Dir; distance: number }
  | { kind: 'swap';        unitAId: UnitId; unitBId: UnitId }
  | { kind: 'spawnHazard'; tile: Tile; hazardType: HazardType; duration?: number }
  | { kind: 'applyHazard'; tile: Tile }
  | { kind: 'removeUnit';  targetId: UnitId; cause: RemovalCause }
  | { kind: 'setTerrain';  tile: Tile; terrainType: TerrainType }
  | { kind: 'spawnUnit';   tile: Tile; unitSpec: UnitSpec };
  // + the shared collision-resolution algorithm used by push/pull (10th "primitive")

type CombatEvent =
  | { type: 'DamageApplied'; targetId: UnitId; amount: number; hp: number }
  | { type: 'DisplacementComplete'; targetId: UnitId; stepsMoved: number }
  | { type: 'CollisionResolved'; a: UnitId; b: UnitId; collisionDamage: number }
  | { type: 'SwapComplete'; unitAId: UnitId; unitBId: UnitId }
  | { type: 'HazardSpawned'; tile: Tile; hazardType: HazardType; duration?: number }
  | { type: 'HazardApplied'; tile: Tile; unitId: UnitId; amount: number }
  | { type: 'UnitRemoved'; targetId: UnitId; cause: RemovalCause; tile: Tile }
  | { type: 'TerrainSet'; tile: Tile; terrainType: TerrainType }
  | { type: 'UnitSpawned'; unitId: UnitId; tile: Tile };

// Pure: same board + same ordered effects → same mutations + same events. No RNG, no clock.
// Move Preview calls resolve(board.snapshot(), effects); commit calls resolve(liveBoard, effects).
function resolve(board: Board, effects: EffectPrimitive[]): CombatEvent[];

// ── Shared Unit record (contracts §6 / registry unit_record, C2) ────────────────
interface Unit {
  id: UnitId;
  team: 'hero' | 'enemy';
  archetype: string;
  maxHP: number;
  currentHP: number;
  position: Tile;
  size: 1;                       // v1 — single-tile only
  abilities: AbilityDefinition[];
  hazardImmunities: HazardType[]; // threaded through Combat's hazard call sites
  statusFlags: string[];
}

// ── Abilities (heroes & enemies share ONE schema, contracts §5) ─────────────────
interface AbilityDefinition {
  shape: TargetShape;
  targetFilter: TargetFilter;
  effectTemplate: EffectTemplate;
  compileEffects(caster: Unit, target: Tile, board: Board): EffectPrimitive[]; // → the 10 primitives
}
interface HeroQuerySurface {              // consumed by Input / Preview / Encounter
  legalMoveTiles(unit: Unit, board: Board): Tile[];   // F1, uses Board.reachableTiles
  legalTargets(unit: Unit, ability: AbilityDefinition, board: Board): Tile[];
}

// ── Objective / Win-Lose (contracts §4) ─────────────────────────────────────────
type EvaluationResult = { ongoing: boolean; victory: boolean; defeat: boolean };
function evaluate(battleState: BattleState, turn: number, config: ObjectiveConfig): EvaluationResult;

// ── Encounter & difficulty (contracts §8, C1) ───────────────────────────────────
function generateEncounter(runSeed: number, nodeId: string,
                           difficultyConfig: DifficultyConfig,
                           rosterSnapshot: RosterSnapshot): Encounter;   // pure

// Run Structure calls THIS (not generateEncounter directly); returned tier is authoritative.
function getEncounterForNode(runSeed: number, nodeId: string, nodeIndex: number,
                             ascensionOffset: number,
                             rosterSnapshot: RosterSnapshot): { tier: number; encounter: Encounter };

// ── Environmental telegraph (contracts §9, C4) ──────────────────────────────────
function telegraphedEnvironmentTiles(turn: number): Tile[];
function telegraphedLethalThreatCount(turn: number): number;

// ── Run Persistence (Run Persistence GDD) ───────────────────────────────────────
type LoadResult<T> = { kind: 'Empty' } | { kind: 'Valid'; data: T }
                   | { kind: 'Corrupted' } | { kind: 'Unsupported' };
interface Persistence {
  saveRun(data: RunSave): WriteResult;
  loadRun(): LoadResult<RunSave>;
  clearRun(): void;
  saveMeta(data: MetaSave): WriteResult;
  loadMeta(): LoadResult<MetaSave>;
  mergeUnlocksIntoMeta(unlocks: Unlock[]): WriteResult;  // Rule 4f as one atomic call
  isStorageAvailable(): boolean;
}

// ── Event Bus (synchronous, deterministic — §5c) ────────────────────────────────
interface EventBus {
  emit(e: CombatEvent | PhaseEvent): void;      // synchronous, in registration order
  on(type: string, handler: (e: any) => void): void;
  off(type: string, handler: (e: any) => void): void;
}
```

---

## 7. ADR Audit

`docs/architecture/` currently contains **no** `adr-*.md` files — this is the
first architecture artifact written to the directory.

| ADR | Status | Location |
|-----|--------|----------|
| _(none)_ | — | — |

All architectural conventions the GDDs and contracts already assume (single
mutation path, snapshot-based undo/preview, deterministic bus, C1–C4 resolutions)
are currently **implicit in the contracts file**. §8 promotes each to a Required
ADR so they are formally decided and testable before implementation.

---

## 8. Required ADRs

Grouped **Foundation-first** (the order they must be decided, matching design
order). Each is a `/architecture-decision` deliverable. These are the minimum set;
they collectively lock every cross-system contract (C1–C4) and every "→ ADR" flag
raised across the GDDs.

### Foundation ADRs (decide first — everything else builds on these)

| # | ADR | Resolves / unblocks |
|---|-----|---------------------|
| **A1** | **Board tile-state representation & cheap `snapshot()`** — store terrain, occupancy, hazard, flags as **parallel flat typed arrays** (`index(c,r)=r·W+c`) so `snapshot()` is an array copy (< 1 ms), not an object-graph clone. | Board & Grid Open Q2; the Move Preview + undo snapshot budget; Turn Manager's per-action snapshot. Unblocks **all** simulation systems. |
| **A2** | **Deterministic synchronous event bus** — `emit()` runs subscribers immediately, in registration order, same call stack; **no** async/microtask/rAF deferral in the sim path. | Principle P1 (determinism); reproducible undo/replay; contracts §1 canonical events; Audio/Rendering/HUD/Preview subscription model. |
| **A3** | **Run Persistence save schema** — `{schemaVersion, checksum, data}` envelope; per-domain versioning + sequential migration (F3); order-sensitive checksum (F2, algorithm pinned here); build-then-swap writes; two independent domains. | Run Persistence Open Q1 (checksum algorithm) + Q2 (Result-vs-throw contract); Meta-progression, Run Structure, Draft persistence. |
| **A4** | **mulberry32 seed strategy** — one shared PRNG + `mix()` combiner for **procedural generation only** (map/encounter/draft), each consumer supplying its own salt; **forbidden** in battle resolution. | Registry `mulberry32_prng`; Encounter Generator reproducibility; Run Persistence resume (`runSeed`+`nodeId` → identical encounter). |
| **A5** | **Board/Combat error contract** — expected gameplay rejections (`place` on occupied, rejected `setTerrain`) return a `Result` enum (no throw); genuine programmer errors (invalid construction, OOB query origin) assert/throw. | Board & Grid Open Q1; consistent handling across Combat, tests, HUD, Run Structure. |

### Core ADRs

| # | ADR | Resolves / unblocks |
|---|-----|---------------------|
| **A6** | **Combat `resolve()` as the single board-mutation path + the 10-primitive vocabulary** — `resolve(board, effects[]) → events[]` is the *only* thing that mutates the board; the 10 primitives are a closed vocabulary (no 11th without amending combat-resolution.md); effects apply strictly sequentially; purity = determinism, not immutability. | Breaks Heroes↔Combat / Enemy↔Combat cycles; enables Move Preview dry-run; contracts §1; registry `combat_primitives`. Unblocks Heroes, Enemy, Move Preview, Rendering, Audio. |
| **A7** | **Snapshot-based undo & preview reuse one simulation** — undo = Turn Manager adopting a prior `snapshot()` as the live board (no board-owned `restore()`); preview = `resolve(board.snapshot(), effects)`; snapshot captured only **after** each action's full consequence chain (incl. on-death `spawnUnit`). | Turn Manager §3 undo; Move Preview correctness; contracts §2/§3/§7. |

### Feature ADRs (resolve the open cross-system contracts C1–C4)

| # | ADR | Resolves / unblocks |
|---|-----|---------------------|
| **A8** | **Shared `Unit` record schema (C2)** — publish the canonical per-battle `Unit` once (registry `unit_record`), owned by Heroes & Abilities; referenced (never re-shaped) by Enemy, Objective, Ability Upgrades, Draft; `hazardImmunities` threaded through Combat's hazard call sites; `battle_ended.nodeType` + `processRunEnd()` added. | C2; registry `unit_record` (status pending→active); Enemy, Objective, Upgrades, Draft, Meta-progression. |
| **A9** | **Shared `reachableTiles`/BFS + coordinate-transform ownership (C3)** — Board & Grid owns the **one** bounded flood-fill (Formula 9) consumed by both `legalMoveTiles` and enemy movement-to-range; a single screen↔tile coordinate-transform module owned at the Input/Rendering boundary. | C3; Heroes movement, Enemy movement, Input & Selection, Move Preview. Bans any second BFS. |
| **A10** | **Difficulty/tier ownership chain (C1)** — Run Structure → `Difficulty Tiers.getEncounterForNode` → `Encounter Generator.generateEncounter`; returned `tier` is the single source of truth (Map/Run UI display **and** generator curve); Run Structure drops its own `MapNode.tierIndex`/F6 (display-only) and depends on Difficulty Tiers. | C1; Run Structure, Difficulty Tiers, Encounter Generator, Map/Run UI, Run Persistence resume. |
| **A11** | **Environmental telegraph query (C4)** — Enemy owns `telegraphedEnvironmentTiles(turn)` + `telegraphedLethalThreatCount(turn)`; Battle HUD `heroesInDanger` and Move Preview threat overlay **union** these with enemy intents; Audio tension sources `lethalThreats` from the count. | C4; Battle HUD safety check (Pillar #1), Move Preview overlay, Audio tension. |

**Coverage:** A1–A11 collectively unblock every Designed system and close every
`→ ADR` flag in the GDDs and all four open contracts (C1–C4). Decide A1–A5
(Foundation) before writing any Core code.

---

## 9. Architecture Principles

Derived from the five game pillars. These are non-negotiable invariants; a design
or code change that violates one must be escalated, not merged.

- **P1 — Determinism is a hard invariant.** No RNG and no wall-clock/`Date.now()`
  in the battle simulation. Same inputs → byte-identical state and event log,
  every run, across reloads. (Pillar #1; enables preview, undo, replay,
  resume.) Procedural variety lives *only* in the mulberry32 meta layer (Pillar
  #3), never in a battle.
- **P2 — One board-mutation path.** Every change to board state flows through
  Combat's `resolve()` and the 10 primitives. Nothing else — no system, no UI,
  no "convenience" helper — mutates occupancy, terrain, or hazards. (Pillar #2:
  positioning verbs get first-class engine status equal to damage.)
- **P3 — Pure simulation core, decoupled from PixiJS.** The Foundation/Core/
  Feature layers **never import Pixi** (or any renderer). Presentation is a
  read-only observer of sim state + the canonical event stream. The whole sim
  must run headless in Vitest with no canvas. (Pillar #5 depends on a sim that is
  legible *and* testable in isolation.)
- **P4 — Snapshot-based undo & preview reuse the one simulation.** Preview is a
  dry-run of the real `resolve()` over `board.snapshot()`; undo is adoption of a
  prior snapshot. There is never a second, parallel "prediction" implementation
  to drift out of sync. (Pillar #1: the preview must match the commit exactly.)
- **P5 — Legibility budget.** Everything battle-relevant must be readable in a
  ten-second glance: fully-telegraphed enemy + environmental intents, one accent
  color per verb-family, closed 10-primitive vocabulary, no chain reactions the
  player can't trace before committing. If a mechanic needs a mid-battle
  reference table, simplify or cut it. (Pillar #5.)
- **P6 — Contracts are the compiler's job.** Every cross-system boundary in §6 is
  a TypeScript `interface`; systems from different owners integrate only through
  those interfaces and the canonical event names. The contracts file
  (`cross-system-contracts.md`) is authoritative; when a GDD disagrees, the
  contract wins and the GDD is corrected.

---

## 10. Open Questions

Unresolved items carried forward — each needs a decision before the affected
system is implemented (not before the architecture is signed off).

1. **Multi-tile units (size > 1).** v1 fixes `size = 1`; ITB-style 2-tile units
   would require the occupancy model to become "a unit occupies a *set* of tiles,"
   touching Board, Combat collision, and `reachableTiles`. Deferred to Heroes &
   Abilities post-v1. (Board Open Q7.)
2. **Hazard content scope (Smoke / Acid).** The primitive vocabulary
   (`spawnHazard`/`applyHazard`) supports arbitrary hazard types, but *which*
   hazards ship in v1 (Fire is defined; Smoke/Acid are referenced but not fully
   specced) is a content/balance decision for Combat + Encounter Generator, not
   an engine change.
3. **`spawnUnit` balance & spawn-on-occupied resolution.** `spawnUnit` requires a
   Clear tile; the consequence when an enemy would emerge on an occupied
   spawn-point (damage occupant / delay / cancel) is flagged in Board & Enemy as a
   cross-system decision still owned by Enemy, Abilities & Telegraph.
4. **True mid-battle resume.** Persistence saves at node granularity only; a
   mid-battle resume would need Combat + Turn Manager to expose
   `serializeBattleState()`/`restoreBattleState()` (beyond the Board-only
   `snapshot()`). Explicitly out of scope for v1. (Run Persistence Open Q3.)
5. **Cross-tab write conflicts.** `localStorage` is last-write-wins across two
   tabs of the same origin; no locking/merge in v1 — a documented known
   limitation, revisitable via the `storage` event / `BroadcastChannel` later.
6. **Settings/Options persistence domain.** Whether Settings gets its own save
   domain or piggybacks on Meta Save is deferred to the (Alpha, Not Started)
   Settings/Options GDD.
7. **"Resumed into an already-terminal node" handling.** Persistence guarantees
   the stale Run Save stays loadable after an interrupted run-end; Run Structure
   must own the `isRunComplete` check that clears it — not yet documented in
   `run-structure-node-map.md` (its next revision).

---

*End of VANGUARD Master Architecture v1.0. Authoritative contract source:
`design/architecture/cross-system-contracts.md`. This document is Proposed pending
TD/LP sign-off (§1).*
