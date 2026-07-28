/**
 * Combat Resolution — the closed, 10-primitive effect vocabulary.
 *
 * Implements: design/gdd/combat-resolution.md (Core Rules 1-15).
 * Governing ADR: docs/architecture/adr-0006-combat-resolve-single-mutation-path.md
 *
 * `EffectPrimitive` is the exact closed vocabulary from ADR-0006's Key
 * Interfaces block (9 tagged variants + the shared collision-resolution
 * algorithm used by `push`/`pull`, which is not its own tagged effect but
 * lives inside `resolve()`'s displacement handler). No 11th `kind` may be
 * added without amending the GDD and ADR-0006 first (ADR-0006 Decision).
 */

import type { Direction, HazardType, Tile, UnitId } from '../board/board-types.js';
import type { TerrainType } from '../board/board-types.js';

/**
 * Minimal projection of a unit's authored starting stats that Combat
 * Resolution's `spawnUnit` primitive needs (GDD Rule 15). Deliberately
 * narrow: `archetype`/`team`/`abilities` are Heroes & Abilities / Enemy
 * concerns Combat never reads (GDD Rule 1 ownership boundary). When
 * Heroes & Abilities implements the canonical `Unit` record
 * (docs/architecture/adr-0008-shared-unit-record.md), its `compileEffects()`
 * step should project down to this shape when constructing a `spawnUnit`
 * effect — this type is not a redeclaration of that record, only the slice
 * Combat's primitives consume.
 */
export interface UnitSpec {
  /** Stable per-battle unit identifier (docs/architecture/adr-0008 `UnitId = string`). */
  readonly id: UnitId;
  /** Starting HP, copied into `CombatState` at spawn time (GDD Formula F1). */
  readonly hp: number;
  /**
   * Hazard types this unit takes no damage from (ADR-0008 `hazardImmunities`
   * threading). Defaults to `[]` (no immunities) if omitted.
   */
  readonly hazardImmunities?: readonly HazardType[];
}

/**
 * Vitality-removal cause (GDD "States and Transitions" — `Unit` vitality
 * state `Alive ↔ Removed(cause)`). `Recalled` is reserved for a future
 * non-death removal verb (GDD Open Question 8) — no primitive implemented
 * here produces it, but `removeUnit` accepts it structurally since Rule 8
 * defines `removeUnit` as the single exit point "regardless of cause."
 */
export type RemovalCause = 'Defeated' | 'Fell' | 'Recalled';

/**
 * The closed, 10-primitive vocabulary (ADR-0006 Decision; registry entry
 * `combat_primitives`). Every hero/enemy ability compiles to an ordered list
 * of these; `resolve()` is the only code that interprets them.
 */
export type EffectPrimitive =
  | { readonly kind: 'damage'; readonly targetId: UnitId; readonly amount: number; readonly sourceId?: UnitId }
  | {
      readonly kind: 'push';
      readonly targetId: UnitId;
      readonly direction: Direction;
      readonly distance: number;
      readonly sourceId?: UnitId;
    }
  | {
      readonly kind: 'pull';
      readonly targetId: UnitId;
      readonly sourceId: UnitId;
      readonly direction: Direction;
      readonly distance: number;
    }
  | { readonly kind: 'swap'; readonly unitAId: UnitId; readonly unitBId: UnitId }
  | {
      readonly kind: 'spawnHazard';
      readonly tile: Tile;
      readonly hazardType: HazardType;
      readonly duration?: number | null;
    }
  | { readonly kind: 'applyHazard'; readonly tile: Tile }
  | { readonly kind: 'removeUnit'; readonly targetId: UnitId; readonly cause: RemovalCause }
  | { readonly kind: 'setTerrain'; readonly tile: Tile; readonly terrainType: TerrainType }
  | { readonly kind: 'spawnUnit'; readonly tile: Tile; readonly unitSpec: UnitSpec };
