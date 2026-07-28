/**
 * Combat Resolution — the single board-mutation path.
 *
 * Implements: design/gdd/combat-resolution.md (all Core Rules, Formulas
 * F1-F4, Edge Cases).
 * Governing ADRs:
 *  - docs/architecture/adr-0006-combat-resolve-single-mutation-path.md (resolve() contract, 10 primitives)
 *  - docs/architecture/adr-0005-board-combat-error-contract.md (Result vs throw — reused verbatim from board-result.ts)
 *  - docs/architecture/adr-0007-snapshot-undo-preview.md (preview isolation via a private bus + `CombatState`/`Board` snapshots)
 *  - docs/architecture/adr-0002-deterministic-event-bus.md (synchronous, registration-ordered dispatch)
 *
 * `resolve(board, state, effects, options?) -> CombatEvent[]` is the ONLY
 * code that mutates `board`/`state`. See this implementer's report for why
 * the signature carries a `CombatState` second parameter beyond ADR-0006's
 * illustrative `resolve(board, effects)`.
 */

import type { Board } from '../board/board-interface.js';
import type { Classification, Direction, HazardType, Tile, TerrainType, UnitId } from '../board/board-types.js';
import { invariant } from '../board/board-result.js';
import { EventBus } from '../events/event-bus.js';
import type { CombatConfig } from './combat-config.js';
import { DEFAULT_COMBAT_CONFIG } from './combat-config.js';
import { CombatState } from './combat-state.js';
import type { EffectPrimitive, RemovalCause, UnitSpec } from './combat-types.js';
import type { CombatEvent, CombatEventMap } from './combat-events.js';

/** Optional injectables for `resolve()`. Both default so `resolve()` is usable standalone in tests. */
export interface ResolveOptions {
  /** Tuning knobs (GDD Tuning Knobs). Defaults to `DEFAULT_COMBAT_CONFIG`. */
  readonly config?: CombatConfig;
  /**
   * The event bus to emit onto (ADR-0002 synchronous dispatch). The live
   * path injects the shared session bus; Move Preview injects a fresh,
   * private `EventBus` instance so dry-run events never reach shared
   * subscribers (ADR-0007 — "the silence IS the boundary"). Defaults to a
   * throwaway private instance if omitted, so a bare `resolve(board, state,
   * effects)` call never leaks onto any shared stream by accident.
   */
  readonly bus?: EventBus<CombatEventMap>;
}

/** Internal per-call context threaded through every primitive handler. */
interface ResolveContext {
  readonly board: Board;
  readonly state: CombatState;
  readonly bus: EventBus<CombatEventMap>;
  readonly config: CombatConfig;
  readonly events: CombatEvent[];
}

function emit(ctx: ResolveContext, event: CombatEvent): void {
  ctx.events.push(event);
  ctx.bus.emit(event);
}

/**
 * Locates a unit's current tile by scanning `board`'s occupancy (Board has
 * no unit-id -> tile reverse lookup — see this implementer's report).
 * O(width*height); cheap at VANGUARD's board scale (<=12x12).
 */
function findTile(board: Board, unitId: UnitId): Tile | null {
  for (let row = 0; row < board.height; row++) {
    for (let col = 0; col < board.width; col++) {
      if (board.getOccupant(col, row) === unitId) return { col, row };
    }
  }
  return null;
}

/**
 * Channel-2 validation pass over the WHOLE effect list before any mutation
 * begins (GDD Edge Cases: negative `amount` / missing `pull` direction are
 * "rejected before resolve() accepts the effect list" — a caller-contract
 * violation, not a runtime no-op). Throws `InvariantError` via `invariant()`.
 */
function validateEffects(effects: readonly EffectPrimitive[]): void {
  for (const effect of effects) {
    if (effect.kind === 'damage') {
      invariant(effect.amount >= 0, `Combat.resolve: damage amount must be >= 0, got ${effect.amount}`);
    } else if (effect.kind === 'pull') {
      invariant(
        effect.direction !== undefined && effect.direction !== null,
        'Combat.resolve: pull requires an explicit direction (Rule 5 — Combat never infers it)',
      );
    }
  }
}

// ── Primitive handlers ─────────────────────────────────────────────────────

/** `damage(targetId, amount)` — GDD Rule 3, Formula F1. */
function applyDamage(ctx: ResolveContext, targetId: UnitId, amount: number): void {
  if (!ctx.state.hasUnit(targetId)) return; // stale/already-removed target (Rule 8/11): silent no-op, chain continues
  const hp = ctx.state.getHp(targetId);
  const newHp = Math.max(0, hp - amount);
  ctx.state.setHp(targetId, newHp);
  emit(ctx, { type: 'damage_applied', targetId, amount, hp: newHp });
  if (newHp === 0) removeUnitPrimitive(ctx, targetId, 'Defeated');
}

/** `removeUnit(targetId, cause)` — GDD Rule 8: the single, idempotent board exit point. */
function removeUnitPrimitive(ctx: ResolveContext, targetId: UnitId, cause: RemovalCause): void {
  if (!ctx.state.hasUnit(targetId)) return; // idempotent no-op: already removed
  const tile = findTile(ctx.board, targetId);
  invariant(tile !== null, `Combat.removeUnit: unit ${targetId} is registered but not found on the board`);
  ctx.board.clear(tile);
  ctx.state.deleteUnit(targetId);
  emit(ctx, { type: 'unit_removed', targetId, cause, tile });
}

/** `spawnUnit(tile, unitSpec)` — GDD Rule 15. `tile` must classify `Clear`; otherwise rejected as a no-op (ADR-0005 Channel 1, reason `TileNotClear`). */
function spawnUnitPrimitive(ctx: ResolveContext, tile: Tile, unitSpec: UnitSpec): void {
  const classification = ctx.board.classify(tile);
  if (classification.kind !== 'Clear') {
    emit(ctx, { type: 'spawn_unit_rejected', tile, reason: 'TileNotClear' });
    return;
  }
  const result = ctx.board.place(tile, unitSpec.id);
  invariant(result.ok, 'Combat.spawnUnit: place() failed immediately after a Clear classification');
  ctx.state.registerUnit(unitSpec.id, unitSpec.hp, unitSpec.hazardImmunities ?? []);
  emit(ctx, { type: 'unit_spawned', unitId: unitSpec.id, tile, unitSpec });
  // No hazard-on-entry: spawnUnit is creation, not "moving onto" a tile (Rule 15 Edge Case).
}

/** `setTerrain(tile, terrainType)` — GDD Rule 14. Delegates to `Board.setTerrain`'s existing `Result` (ADR-0005) rather than re-validating. */
function setTerrainPrimitive(ctx: ResolveContext, tile: Tile, terrainType: TerrainType): void {
  const result = ctx.board.setTerrain(tile, terrainType);
  if (!result.ok) {
    emit(ctx, { type: 'set_terrain_rejected', tile, terrainType, reason: result.reason });
    return;
  }
  emit(ctx, { type: 'terrain_set', tile, terrainType });
}

/** `spawnHazard(tile, hazardType, duration?)` — GDD Rule 7. Overwrites any existing hazard (last-write-wins). */
function spawnHazardPrimitive(
  ctx: ResolveContext,
  tile: Tile,
  hazardType: HazardType,
  duration: number | null | undefined,
): void {
  const finalDuration = duration === undefined ? ctx.config.hazardDefaultDuration : duration;
  ctx.board.setHazard(tile, hazardType);
  ctx.state.setHazardDuration(tile, finalDuration);
  emit(ctx, { type: 'hazard_spawned', tile, hazardType, duration: finalDuration });
}

/**
 * `applyHazard(tile)` — GDD Rule 7, Formulas F3/F4. The only primitive that
 * resolves a hazard's effect against a tile's current occupant. No-ops if
 * the tile has no hazard, or has no occupant (Edge Cases — duration does
 * NOT decrement in either no-op case). Consults `hazardImmunities`
 * (ADR-0008): an immune occupant takes no damage and no `hazard_applied` is
 * emitted, but the tick still counts against `duration` (only "no occupant"
 * skips the tick — see this implementer's report for that judgment call).
 *
 * NOTE (documented scope limitation): this only implements Formula F3's
 * flat-damage model, applied whenever ANY hazard occupies the tile — Board's
 * `HazardType` is opaque (GDD/board-and-grid.md) and no other Combat-level
 * formula is registered for a specific type (e.g. Mine's 3 damage). Per-type
 * hazard behavior beyond flat tick damage is explicitly deferred to
 * Encounter Generator / Enemy content authoring (GDD Open Question 6) and is
 * NOT implemented here.
 */
function applyHazardPrimitive(ctx: ResolveContext, tile: Tile): void {
  const hazardType = ctx.board.getHazard(tile.col, tile.row);
  if (hazardType === null) return;
  const occupantId = ctx.board.getOccupant(tile.col, tile.row);
  if (occupantId === null) return;

  const immunities = ctx.state.getHazardImmunities(occupantId);
  if (!immunities.includes(hazardType)) {
    emit(ctx, { type: 'hazard_applied', tile, unitId: occupantId, amount: ctx.config.fireDamagePerTick });
    applyDamage(ctx, occupantId, ctx.config.fireDamagePerTick);
  }

  const currentDuration = ctx.state.getHazardDuration(tile);
  if (currentDuration !== null && currentDuration !== undefined) {
    const newDuration = Math.max(0, currentDuration - 1);
    if (newDuration === 0) {
      ctx.board.setHazard(tile, null);
      ctx.state.clearHazardDuration(tile);
    } else {
      ctx.state.setHazardDuration(tile, newDuration);
    }
  }
}

/** `swap(unitAId, unitBId)` — GDD Rule 6. Atomic (single synchronous call; no intermediate state is externally observable). */
function swapPrimitive(ctx: ResolveContext, unitAId: UnitId, unitBId: UnitId): void {
  if (!ctx.state.hasUnit(unitAId) || !ctx.state.hasUnit(unitBId)) {
    emit(ctx, { type: 'swap_failed', unitAId, unitBId, reason: 'UnitNotOnBoard' });
    return;
  }
  const tileA = findTile(ctx.board, unitAId);
  const tileB = findTile(ctx.board, unitBId);
  invariant(tileA !== null && tileB !== null, 'Combat.swap: a unit is registered but not found on the board');

  ctx.board.clear(tileA);
  ctx.board.clear(tileB);
  ctx.board.place(tileB, unitAId);
  ctx.board.place(tileA, unitBId);
  emit(ctx, { type: 'swap_complete', unitAId, unitBId });

  // Hazard-on-entry fires independently for each unit's new tile (Rule 9 / Edge Cases).
  if (ctx.board.getHazard(tileB.col, tileB.row) !== null) applyHazardPrimitive(ctx, tileB);
  if (ctx.board.getHazard(tileA.col, tileA.row) !== null) applyHazardPrimitive(ctx, tileA);
}

/**
 * Shared step-by-step displacement algorithm used by both `push` and `pull`
 * (GDD Formula F2 — "the 10th primitive"). Resolves one tile at a time;
 * terminates at the first obstacle (no chain pushes, Rule 10). Per F2's own
 * pseudocode, `displacement_complete` is emitted ONLY if the full requested
 * `distance` is covered with no collision — a collision emits
 * `collision_resolved` instead and returns without it.
 */
function resolveDisplacement(ctx: ResolveContext, unitId: UnitId, direction: Direction, distance: number): void {
  if (!ctx.state.hasUnit(unitId)) return; // stale target (Rule 8/11): silent no-op
  let currentTile = findTile(ctx.board, unitId);
  invariant(currentTile !== null, `Combat displacement: unit ${unitId} is registered but not found on the board`);

  let stepsMoved = 0;
  for (let i = 0; i < distance; i++) {
    const nextTile = ctx.board.step(currentTile, direction);
    const classification: Classification = ctx.board.classify(nextTile);

    switch (classification.kind) {
      case 'Clear': {
        ctx.board.clear(currentTile);
        ctx.board.place(nextTile, unitId);
        if (ctx.board.getHazard(nextTile.col, nextTile.row) !== null) applyHazardPrimitive(ctx, nextTile);
        currentTile = nextTile;
        stepsMoved += 1;
        continue;
      }
      case 'OutOfBounds': {
        emit(ctx, { type: 'collision_resolved', a: unitId, collisionDamage: ctx.config.collisionDamage, kind: 'Edge' });
        applyDamage(ctx, unitId, ctx.config.collisionDamage);
        return;
      }
      case 'BlockedTerrain': {
        emit(ctx, { type: 'collision_resolved', a: unitId, collisionDamage: ctx.config.collisionDamage, kind: 'Wall' });
        applyDamage(ctx, unitId, ctx.config.collisionDamage);
        return;
      }
      case 'Lethal': {
        ctx.board.clear(currentTile);
        ctx.board.place(nextTile, unitId);
        removeUnitPrimitive(ctx, unitId, 'Fell');
        return;
      }
      case 'Occupied': {
        const otherId = classification.unitId;
        emit(ctx, {
          type: 'collision_resolved',
          a: unitId,
          b: otherId,
          collisionDamage: ctx.config.collisionDamage,
          kind: 'Unit',
        });
        applyDamage(ctx, unitId, ctx.config.collisionDamage);
        applyDamage(ctx, otherId, ctx.config.collisionDamage);
        return;
      }
    }
  }
  emit(ctx, { type: 'displacement_complete', targetId: unitId, stepsMoved });
}

// ── Dispatch ─────────────────────────────────────────────────────────────

function dispatch(ctx: ResolveContext, effect: EffectPrimitive): void {
  switch (effect.kind) {
    case 'damage':
      applyDamage(ctx, effect.targetId, effect.amount);
      return;
    case 'push':
      resolveDisplacement(ctx, effect.targetId, effect.direction, effect.distance);
      return;
    case 'pull':
      resolveDisplacement(ctx, effect.targetId, effect.direction, effect.distance);
      return;
    case 'swap':
      swapPrimitive(ctx, effect.unitAId, effect.unitBId);
      return;
    case 'spawnHazard':
      spawnHazardPrimitive(ctx, effect.tile, effect.hazardType, effect.duration);
      return;
    case 'applyHazard':
      applyHazardPrimitive(ctx, effect.tile);
      return;
    case 'removeUnit':
      removeUnitPrimitive(ctx, effect.targetId, effect.cause);
      return;
    case 'setTerrain':
      setTerrainPrimitive(ctx, effect.tile, effect.terrainType);
      return;
    case 'spawnUnit':
      spawnUnitPrimitive(ctx, effect.tile, effect.unitSpec);
      return;
  }
}

/**
 * THE single board-mutation path (ADR-0006). Applies `effects` strictly
 * sequentially to `board`/`state` (both mutated in place) and returns the
 * full ordered event log. Pure with respect to its inputs: no RNG, no
 * wall-clock, no hidden state — identical `(board, state, effects)` always
 * produces identical mutations and an identical event log.
 *
 * Live commit: `resolve(liveBoard, liveState, effects, { bus: sharedBus })`.
 * Move Preview dry-run: `resolve(board.snapshot(), state.snapshot(), effects,
 * { bus: new EventBus() })` — a fresh, private bus ensures the dry-run's
 * events never reach shared subscribers (ADR-0007; the silence IS the
 * boundary, there is no `committed` flag).
 *
 * @throws InvariantError if any `damage` effect has `amount < 0`, or any
 *   `pull` effect omits `direction` — validated over the WHOLE list before
 *   any mutation begins (Channel-2 programmer errors, ADR-0005).
 */
export function resolve(
  board: Board,
  state: CombatState,
  effects: readonly EffectPrimitive[],
  options: ResolveOptions = {},
): CombatEvent[] {
  validateEffects(effects);
  const ctx: ResolveContext = {
    board,
    state,
    bus: options.bus ?? new EventBus<CombatEventMap>(),
    config: options.config ?? DEFAULT_COMBAT_CONFIG,
    events: [],
  };
  for (const effect of effects) {
    dispatch(ctx, effect);
  }
  return ctx.events;
}
