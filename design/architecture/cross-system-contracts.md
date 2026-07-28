# VANGUARD — Cross-System Contracts (canonical)

> **Status**: Canonical reference (pre-architecture reconciliation)
> **Created**: 2026-07-28
> **Purpose**: Single source of truth for the interfaces between systems, created
> after the batch design-review surfaced cross-document drift. Every GDD must match
> this document. Feeds `/create-architecture` (these become Required ADRs).

All contracts below are **deterministic** (no in-battle RNG) and consistent with the
locked registry (`design/registry/entities.yaml`) and the game pillars.

---

## 1. Combat Resolution — entry point & primitives

- **Entry point:** `resolve(board, effects[]) → events[]`. Effects apply **strictly
  sequentially** (never simultaneous); the function is **pure** (state → state), so
  Move Preview reuses it by passing `board.snapshot()` instead of the live board.
  Combat Resolution **never calls back into** the Turn & Phase Manager.
- **Primitive vocabulary = 10** (registry `combat_primitives`): `damage`, `push`,
  `pull`, `swap`, `spawnHazard`, `applyHazard`, `removeUnit`, `setTerrain`,
  `spawnUnit`, plus the shared **collision-resolution algorithm** used by push/pull.
  - `spawnUnit(tile, unitSpec)` creates a unit on a **Clear** tile (rejected
    otherwise). It is the single board-mutation path for enemy **emergence** (Spawn
    phase) and **on-death broods**. All unit creation goes through it — nothing else
    mutates occupancy to add a unit.
  - `setTerrain(tile, terrainType)` mutates terrain (Blocked = build a wall; Normal =
    teardown). Enables the "wall" hero verb. Rejected on an occupied tile → Blocked/Lethal.
- **Canonical event names** (all consumers — Board Rendering, Audio, Battle HUD, Move
  Preview — MUST use these): `DamageApplied`, `DisplacementComplete` (carries
  `stepsMoved`), `CollisionResolved` (carries `collision_damage` dealt to both units),
  `SwapComplete`, `HazardSpawned`, `HazardApplied`, `UnitRemoved`, `TerrainSet`,
  `UnitSpawned`. There is **no** `push_resolved` / `apply()` event or entry point.

## 2. Board & Grid — canonical query/mutation surface

Board owns the spatial model. Authoritative API (supersedes any partial list in
board-and-grid.md):
- **Queries (pure):** `inBounds`, `getTile`, `isOccupied`, `getOccupant`, `isBlocked`,
  `getHazard`, `hasFlag`, `neighbors`, `distance` (Manhattan), `tilesInRange(origin,R)`,
  `step(tile,dir)`, `classify(tile)`, `rayTiles(origin,dir,maxLen)`,
  `reachableTiles(origin,range,board)`, `snapshot()`.
- **Mutations (deterministic, via Combat):** `place`, `clear`, `setTerrain`, `setHazard`,
  `setFlag`.
- **`reachableTiles` (resolves C3):** Board & Grid **owns** the single bounded
  flood-fill (over Clear tiles, using `isBlocked`/`isOccupied`/`neighbors`). Both
  Heroes & Abilities (`legalMoveTiles`) and Enemy movement-to-range consume it — no
  second BFS implementation anywhere.
- **`rayTiles`:** line-of-tiles in a cardinal direction until Blocked/edge/`maxLen`
  (needed by line-shaped hero abilities — confirmed downstream).
- **Flags:** `spawn-point`, `objective`, **`deploy-zone`** (where heroes may be placed
  at battle start). All flags are set by Encounter Generator; Board only stores/exposes.
- **Undo / snapshot–restore:** "restore" = the caller (Turn & Phase Manager) **adopts a
  previously captured `snapshot()` as the new live board**; there is no board-owned
  `restore()` mutation. Turn & Phase Manager is a **Hard** dependent of Board for
  `snapshot()`.

## 3. Turn & Phase Manager

- Turn order (locked): `TurnStart → PlayerPhase → Environment → EnemyResolve → Spawn →
  Telegraph → EndCheck`.
- Drives systems via contracts (dependency inversion): Combat `resolve()`, Enemy
  `resolveTelegraphed()/emergeSpawns()/chooseIntents()`, Objective `evaluate()`.
- Undo snapshot is captured **after the full consequence chain of each action resolves**
  (including any on-death `spawnUnit`/follow-up `resolve()` from Enemy Rule 13).
- Hero count in all examples = **`squad_size` = 3** (not 4); max actions/phase =
  `3 × actions_per_hero_turn(2) = 6`.

## 4. Objective / Win-Lose

- Contract: `evaluate(battleState, turn, config) → {ongoing, victory, defeat}` — pure,
  side-effect-free, **state-poll** (no event subscription), callable multiple times/turn.
  Canonical first param name is **`battleState`** (not `board`). Owns `max_turns`.

## 5. Abilities (Heroes & Enemies share one schema)

- **`AbilityDefinition`** is owned by heroes-and-abilities.md: `{ shape, targetFilter,
  effectTemplate, compileEffects() }`. `compileEffects()` compiles an ability into the
  10 Combat primitives. **Enemy, Abilities & Telegraph reuses this exact schema** for
  enemy attacks and on-death effects.
- Hero query surface consumed by Input/Preview/Encounter: `legalMoveTiles()` (Formula
  F1, uses Board `reachableTiles`), `legalTargets()`, `compileEffects()`. There is no
  `getActionModes`/`isLegalTarget`.
- **On-death brood spawning** uses `spawnUnit` (primitive #9); `broodCount` is valid.

## 6. Shared `Unit` record (resolves C2)

Canonical per-battle record (registry `unit_record`, owner heroes-and-abilities.md):
`{ id, team, archetype, maxHP, currentHP, position(tile), size(=1 v1), abilities[],
hazardImmunities[], statusFlags[] }`. Referenced (not re-shaped) by Enemy, Objective,
Ability Upgrades, Draft/Loadout Meta. `hazardImmunities` is threaded through Combat's
hazard call sites (`applyHazard`, hazard-on-entry).

## 7. Move Preview & Input flow

- **Move Preview is silent** and **subscription-based**: Input & Selection **emits**
  hover/select/cancel/confirm **events**; it does **not** call a synchronous
  `preview()`. Move Preview subscribes, dry-runs Combat `resolve()` on `board.snapshot()`,
  and displays. Audio ignores preview (no events reach the shared stream), so no
  `committed` tag is needed.
- Input's `Locked` state gates on Board Rendering & Juice `isAnimating()`.

## 8. Encounter Generator & difficulty (resolves C1)

- **Entry point:** `generateEncounter(runSeed, nodeId, difficultyConfig, rosterSnapshot)
  → Encounter`. The solver drives the **real** Combat/Heroes/Objective code paths
  (`legalMoveTiles`/`legalTargets`/`compileEffects`, `evaluate(battleState,turn,config)`)
  — never a parallel reimplementation.
- **C1 ownership:** Run Structure / Node Map calls **Difficulty Tiers**'
  `getEncounterForNode(runSeed, nodeId, nodeIndex, ascensionOffset, rosterSnapshot) →
  {tier, encounter}`. Difficulty Tiers builds `difficultyConfig` and calls Encounter
  Generator. The returned **`tier` is the single source of truth** for both Map/Run UI
  display and the generator's difficulty curve. Run Structure **drops** its own
  `MapNode.tierIndex`/Formula F6 (or marks it display-only, non-authoritative) and
  **depends on Difficulty Tiers**.
- Run Persistence resume uses the same `generateEncounter(runSeed, nodeId, …)` signature
  (reproducible via stored `runSeed` + `nodeId`).

## 9. Environmental telegraph (resolves C4)

- **Enemy, Abilities & Telegraph** owns `telegraphedEnvironmentTiles(turn)` and
  `telegraphedLethalThreatCount(turn)`. Battle HUD's `heroesInDanger` and Move Preview's
  threat overlay both **union environmental telegraph tiles** with enemy intents. Audio's
  tension `lethalThreats` sources from `telegraphedLethalThreatCount(turn)`.

## 10. Run-end & events

- `battle_ended` event carries **`nodeType`** (Battle/Elite/Boss). Run Structure / Node
  Map exposes **`processRunEnd(outcome)`** for Meta-progression to hook terminal handling.

## 11. Doc hygiene (applies to all GDDs)

- Remove all stale "(undesigned)" / "PROVISIONAL — no GDD yet" language for systems that
  now exist (Status: Designed). Mark each dependency with its real ✅ status and reconcile
  the interface against the actual dependency GDD.
- `combat_primitives` count is **10** everywhere (never "eight"/"nine"/7).
- All squad-size examples use **3**.
- Dependencies are **bidirectional**: if A depends on B, B lists A.
