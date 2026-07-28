/**
 * Combat Resolution — supplementary per-battle runtime state, as an interface.
 *
 * Split out from `combat-state.ts` on 2026-07-28 by code review, mirroring the
 * `board-interface.ts` / `board.ts` split that is this project's established
 * pattern. Before this, `resolve()` and `MovePreviewDeps` both depended on the
 * concrete `CombatState` class while depending on `Board` through its
 * interface — an inconsistency, and a Dependency-Inversion gap: there was no
 * abstraction a test double or an alternate implementation could satisfy.
 *
 * That matters more than it looks. `snapshot()` is called on the preview-hover
 * path, so if the storage strategy is ever changed for performance (typed
 * arrays instead of `Map`, say), depending on the concrete class makes that a
 * breaking change for every consumer rather than a swap behind an interface.
 *
 * WHY THIS TYPE EXISTS AT ALL — the layering constraint that produced it:
 * `Board` deliberately stores only spatial facts (terrain, occupancy, hazard
 * type, flags). HP and hazard immunities belong to ADR-0008's canonical `Unit`
 * record, which is owned by **Heroes & Abilities** — a Feature-layer module
 * Combat must not import, or it inverts the very dependency direction ADR-0006
 * exists to protect. `CombatState` is the Core-layer holder for that data, and
 * it is caller-owned and mutated only inside `resolve()`, exactly as `Board`
 * is.
 *
 * Position is deliberately NOT stored here. Combat derives a unit's tile by
 * scanning `Board`'s occupancy (`findTile()` in `combat-resolve.ts`), so
 * `Board` stays the single source of truth for where a unit is. ADR-0008's
 * `Unit.position` is described as "kept in sync by Combat Resolution" — a field
 * that must be *kept* in sync is a field that can fall out of sync, so Combat
 * keeps no second copy.
 */

import type { Tile, UnitId, HazardType } from '../board/board-types.js';

/**
 * Read/write surface for the supplementary battle state `resolve()` mutates
 * alongside `Board`.
 *
 * Every method that takes a `UnitId` and returns a value throws
 * `InvariantError` for an unregistered unit (Channel 2, ADR-0005 — a
 * programmer error), **except** {@link getHazardImmunities}, which is queried
 * opportunistically at hazard call sites and returns `[]` instead. Guard with
 * {@link hasUnit} when the unit's presence is genuinely uncertain.
 */
export interface CombatStateView {
  /** Whether `id` currently has a registered record — i.e. is on the board. */
  hasUnit(id: UnitId): boolean;

  /** Current HP of `id`. Throws if `id` is not registered. */
  getHp(id: UnitId): number;

  /** Overwrites `id`'s current HP. Throws if `id` is not registered. */
  setHp(id: UnitId, hp: number): void;

  /** Hazard types `id` takes no damage from. Returns `[]` for an unregistered unit — never throws. */
  getHazardImmunities(id: UnitId): readonly HazardType[];

  /** Registers a unit's HP and immunities at spawn time. */
  registerUnit(id: UnitId, hp: number, hazardImmunities?: readonly HazardType[]): void;

  /** Removes `id`'s record. Called when a unit leaves the board. */
  deleteUnit(id: UnitId): void;

  /**
   * Remaining ticks for the hazard on `tile`: a number, `null` for permanent,
   * or `undefined` when no duration is tracked for that tile.
   */
  getHazardDuration(tile: Tile): number | null | undefined;

  /** Sets a hazard's remaining ticks on `tile`. `null` means permanent. */
  setHazardDuration(tile: Tile, duration: number | null): void;

  /** Stops tracking a duration for `tile`. */
  clearHazardDuration(tile: Tile): void;

  /**
   * An independent copy, safe to mutate without affecting this instance.
   *
   * Mirrors `Board.snapshot()`'s contract, and is what makes Move Preview's
   * dry run correct: a preview must snapshot **both** `Board` and this state,
   * or it will mutate real HP while leaving the board untouched. See
   * `move-preview.ts` `runDryRun()`.
   */
  snapshot(): CombatStateView;
}
