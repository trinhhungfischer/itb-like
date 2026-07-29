/**
 * Combat Resolution — canonical event vocabulary (ADR-0002 / ADR-0006).
 *
 * Implements: design/gdd/combat-resolution.md Interactions table ("Board
 * Rendering & Juice... reads the emitted event log").
 * Governing ADRs:
 *  - docs/architecture/adr-0006-combat-resolve-single-mutation-path.md (event names)
 *  - docs/architecture/adr-0002-deterministic-event-bus.md (`type`, not
 *    `interface`, for the event-map alias — TS only structurally matches the
 *    `EventBus<TEventMap extends EventMap>` constraint against type aliases)
 *
 * The 9 canonical names are exactly ADR-0006's list. This module additionally
 * defines 3 debug/rejection events (`swap_failed`, `set_terrain_rejected`,
 * `spawn_unit_rejected`) that ADR-0005's Channel-1 taxonomy and the GDD's own
 * Edge Cases explicitly require Combat to emit ("for debuggability") — see
 * this implementer's report for why ADR-0006's "canonical events only" line
 * and ADR-0005/the GDD's explicit rejection-event requirements are in tension,
 * and why the 3 extra names were kept rather than dropped.
 */

import type { BusEvent } from '../events/event-bus.js';
import type { RejectReason } from '../board/board-result.js';
import type { HazardType, Tile, UnitId } from '../board/board-types.js';
import type { TerrainType } from '../board/board-types.js';
import type { RemovalCause, UnitSpec } from './combat-types.js';

/** `damage`/`applyHazard`'s HP-reduction consequence (GDD Formula F1/F3). */
export interface DamageAppliedEvent extends BusEvent {
  readonly type: 'damage_applied';
  readonly targetId: UnitId;
  readonly amount: number;
  readonly hp: number;
}

/**
 * A `push`/`pull` completed its full requested `distance` with no collision
 * (GDD Formula F2). Per F2's pseudocode, this is emitted ONLY when the step
 * loop finishes without hitting an obstacle — a collision case emits
 * `collision_resolved` instead and returns without this event.
 */
export interface DisplacementCompleteEvent extends BusEvent {
  readonly type: 'displacement_complete';
  readonly targetId: UnitId;
  readonly stepsMoved: number;
}

/** A `push`/`pull` step terminated against an edge, a wall, or another unit (GDD Formula F2). */
export interface CollisionResolvedEvent extends BusEvent {
  readonly type: 'collision_resolved';
  readonly a: UnitId;
  readonly b?: UnitId;
  readonly collisionDamage: number;
  readonly kind: 'Edge' | 'Wall' | 'Unit';
}

/** `swap` succeeded: both units atomically exchanged tiles (GDD Rule 6). */
export interface SwapCompleteEvent extends BusEvent {
  readonly type: 'swap_complete';
  readonly unitAId: UnitId;
  readonly unitBId: UnitId;
}

/**
 * `spawnHazard` set a tile's hazard overlay (GDD Rule 7). `duration` is the
 * resolved value (config default applied if the caller omitted it) —
 * `null` means permanent. Widened from ADR-0006's illustrative
 * `duration?: number` to `duration: number | null` (always present) so a
 * permanent hazard is representable; see this implementer's report.
 */
export interface HazardSpawnedEvent extends BusEvent {
  readonly type: 'hazard_spawned';
  readonly tile: Tile;
  readonly hazardType: HazardType;
  readonly duration: number | null;
}

/** `applyHazard` resolved damage against a hazarded tile's occupant (GDD Rule 7, Formula F3). Not emitted if the occupant is immune (ADR-0008). */
export interface HazardAppliedEvent extends BusEvent {
  readonly type: 'hazard_applied';
  readonly tile: Tile;
  readonly unitId: UnitId;
  readonly amount: number;
}

/** `removeUnit` — the single board exit point (GDD Rule 8). */
export interface UnitRemovedEvent extends BusEvent {
  readonly type: 'unit_removed';
  readonly targetId: UnitId;
  readonly cause: RemovalCause;
  readonly tile: Tile;
}

/** `setTerrain` succeeded (GDD Rule 14 — the hero "wall" verb). */
export interface TerrainSetEvent extends BusEvent {
  readonly type: 'terrain_set';
  readonly tile: Tile;
  readonly terrainType: TerrainType;
}

/**
 * `spawnUnit` succeeded (GDD Rule 15). Carries `unitSpec` in addition to
 * ADR-0006's illustrative `{unitId, tile}` shape, matching the GDD's own
 * explicit signature `unit_spawned(unitId, tile, unitSpec)` — see this
 * implementer's report.
 */
export interface UnitSpawnedEvent extends BusEvent {
  readonly type: 'unit_spawned';
  readonly unitId: UnitId;
  readonly tile: Tile;
  readonly unitSpec: UnitSpec;
}

/** Debug event: `swap` rejected because a unit was already removed (ADR-0005 Channel-1 taxonomy row `Combat.swap`). */
export interface SwapFailedEvent extends BusEvent {
  readonly type: 'swap_failed';
  readonly unitAId: UnitId;
  readonly unitBId: UnitId;
  readonly reason: 'UnitNotOnBoard';
}

/** Debug event: `setTerrain` rejected by `Board.setTerrain`'s `Result` (GDD Rule 14 Edge Case). */
export interface SetTerrainRejectedEvent extends BusEvent {
  readonly type: 'set_terrain_rejected';
  readonly tile: Tile;
  readonly terrainType: TerrainType;
  readonly reason: RejectReason;
}

/** Debug event: `spawnUnit` rejected because `classify(tile) !== Clear` (ADR-0005 Channel-1 taxonomy row `Combat.spawnUnit`). */
export interface SpawnUnitRejectedEvent extends BusEvent {
  readonly type: 'spawn_unit_rejected';
  readonly tile: Tile;
  readonly reason: 'TileNotClear';
}

/**
 * The full event vocabulary `resolve()` may emit: ADR-0006's 9 canonical
 * names plus the 3 ADR-0005/GDD-mandated debug/rejection events. Declared
 * with `type` (not `interface`) — required for `EventBus<CombatEventMap>` to
 * structurally satisfy `EventMap = Record<string, BusEvent>` (TS2344
 * otherwise).
 */
export interface OnActionEvent extends BusEvent {
  readonly type: 'on_action';
  readonly sourceId: UnitId;
  readonly abilityId: string;
  readonly queuePassiveEffect: (effects: EffectPrimitive[]) => void;
}

export interface OnHitEvent extends BusEvent {
  readonly type: 'on_hit';
  readonly sourceId: UnitId;
  readonly targetId: UnitId;
  readonly amount: number;
  readonly queuePassiveEffect: (effects: EffectPrimitive[]) => void;
}

export interface OnKillEvent extends BusEvent {
  readonly type: 'on_kill';
  readonly sourceId: UnitId;
  readonly targetId: UnitId;
  readonly queuePassiveEffect: (effects: EffectPrimitive[]) => void;
}

export type CombatEventMap = {
  damage_applied: DamageAppliedEvent;
  displacement_complete: DisplacementCompleteEvent;
  collision_resolved: CollisionResolvedEvent;
  swap_complete: SwapCompleteEvent;
  hazard_spawned: HazardSpawnedEvent;
  hazard_applied: HazardAppliedEvent;
  unit_removed: UnitRemovedEvent;
  terrain_set: TerrainSetEvent;
  unit_spawned: UnitSpawnedEvent;
  swap_failed: SwapFailedEvent;
  set_terrain_rejected: SetTerrainRejectedEvent;
  spawn_unit_rejected: SpawnUnitRejectedEvent;
  on_action: OnActionEvent;
  on_hit: OnHitEvent;
  on_kill: OnKillEvent;
};

/** Union of every event shape `resolve()` may return/emit. */
export type CombatEvent = CombatEventMap[keyof CombatEventMap];
