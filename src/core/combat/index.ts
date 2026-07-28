/**
 * Combat Resolution — public module surface.
 *
 * Implements: design/gdd/combat-resolution.md
 * Governing ADR: docs/architecture/adr-0006-combat-resolve-single-mutation-path.md
 */

export { resolve } from './combat-resolve.js';
export type { ResolveOptions } from './combat-resolve.js';

export { CombatState } from './combat-state.js';
export type { CombatStateView } from './combat-state-interface.js';

export type { CombatConfig } from './combat-config.js';
export { DEFAULT_COMBAT_CONFIG } from './combat-config.js';

export type { EffectPrimitive, RemovalCause, UnitSpec } from './combat-types.js';

export type {
  CombatEvent,
  CombatEventMap,
  DamageAppliedEvent,
  DisplacementCompleteEvent,
  CollisionResolvedEvent,
  SwapCompleteEvent,
  HazardSpawnedEvent,
  HazardAppliedEvent,
  UnitRemovedEvent,
  TerrainSetEvent,
  UnitSpawnedEvent,
  SwapFailedEvent,
  SetTerrainRejectedEvent,
  SpawnUnitRejectedEvent,
} from './combat-events.js';
