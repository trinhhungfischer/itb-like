/**
 * Combat Resolution — data-driven tuning knobs.
 *
 * Implements: design/gdd/combat-resolution.md (Tuning Knobs section).
 * `collision_damage` / `fire_damage_per_tick` / `hazard_default_duration`
 * are registered in design/registry/entities.yaml. Values here must never be
 * scattered as inline literals elsewhere in this module (mirrors the pattern
 * in src/core/board/board-config.ts).
 */

/** Construction-time tuning configuration for `resolve()`. */
export interface CombatConfig {
  /** Flat damage on an Edge/Wall/Unit collision (GDD Formula F2). Safe range 0-3. registry `collision_damage`. */
  readonly collisionDamage: number;
  /** Flat damage per `applyHazard` tick against a Fire-hazarded tile's occupant (GDD Formula F3). Safe range 0-3. registry `fire_damage_per_tick`. */
  readonly fireDamagePerTick: number;
  /** Default `spawnHazard` duration when the caller omits one. `null` = permanent. registry `hazard_default_duration`. */
  readonly hazardDefaultDuration: number | null;
}

/** Default configuration (design/registry/entities.yaml defaults). */
export const DEFAULT_COMBAT_CONFIG: Readonly<CombatConfig> = Object.freeze({
  collisionDamage: 1,
  fireDamagePerTick: 1,
  hazardDefaultDuration: null,
});
