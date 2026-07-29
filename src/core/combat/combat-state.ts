/**
 * Combat Resolution — supplementary per-battle state `Board` cannot hold.
 *
 * Implements: design/gdd/combat-resolution.md Rules 3, 7, 9 (Formula F1/F3/F4);
 * docs/architecture/adr-0008-shared-unit-record.md (`hazardImmunities` threading).
 *
 * `Board` (src/core/board/**) stores only terrain/occupancy/hazard-type/flags
 * — it has no HP field, no `hazardImmunities`, and no per-tile hazard
 * `duration` (see this implementer's report for why: `Unit.currentHP` is
 * owned by the not-yet-implemented Heroes & Abilities module per ADR-0008,
 * and `duration` was never added to `Board`'s hazard model at all). `resolve()`
 * needs both to implement `damage`/`applyHazard`/hazard-on-entry, so this
 * module fills the gap as a second, `resolve()`-owned piece of caller-supplied
 * mutable state — exactly mirroring `Board`'s own contract: constructed by
 * the caller, mutated in place by `resolve()`, and independently
 * `snapshot()`-able for Move Preview isolation (ADR-0007).
 *
 * Deliberately NOT stored here: unit **position**. ADR-0008's prose says
 * position is "kept in sync by Combat Resolution," but duplicating it here
 * would create a second, syncable-out-of-date source of truth alongside
 * `Board`'s occupancy arrays. Instead, `combat-resolve.ts` derives a unit's
 * tile by scanning `Board`'s occupancy on demand — `Board` remains the sole
 * source of truth for "where is unit X," matching ADR-0001's ownership.
 */

import type { CombatStateView } from './combat-state-interface.js';
import { invariant } from '../board/board-result.js';
import type { HazardType, Tile } from '../board/board-types.js';
import type { UnitId } from '../board/board-types.js';
import type { EffectPrimitive, RemovalCause, UnitSpec } from './combat-types.js';

interface UnitRecord {
  readonly currentHP: number;
  readonly hazardImmunities: readonly HazardType[];
  readonly onDeath?: (lastTile: Tile) => readonly EffectPrimitive[];
  readonly onDeathTriggerCauses?: readonly RemovalCause[];
}

function tileKey(tile: Tile): string {
  return `${tile.col},${tile.row}`;
}

/**
 * Per-battle state supplementary to `Board`: each on-board unit's current HP
 * and hazard immunities, and each hazarded tile's remaining `duration`.
 * Construct one instance per battle (`CombatState.empty()`); `resolve()`
 * mutates it in place, exactly as it mutates the `Board` it is given.
 */
export class CombatState implements CombatStateView {
  private readonly units = new Map<UnitId, UnitRecord>();
  private readonly hazardDurations = new Map<string, number | null>();

  private constructor() {}

  /** Constructs a fresh, empty state (no units registered, no hazards tracked). */
  static empty(): CombatState {
    return new CombatState();
  }

  // ── Unit bookkeeping ────────────────────────────────────────────────────

  /** Whether `id` currently has a registered record (i.e. is on the board — see class doc comment). */
  hasUnit(id: UnitId): boolean {
    return this.units.has(id);
  }

  /** Current HP of `id`. Throws if `id` is not registered (Channel-2 programmer error — callers must guard with `hasUnit`). */
  getHp(id: UnitId): number {
    const record = this.units.get(id);
    invariant(record !== undefined, `CombatState.getHp: unit ${id} is not registered`);
    return record.currentHP;
  }

  /** Overwrites `id`'s current HP. Throws if `id` is not registered. */
  setHp(id: UnitId, hp: number): void {
    const record = this.units.get(id);
    invariant(record !== undefined, `CombatState.setHp: unit ${id} is not registered`);
    this.units.set(id, {
      currentHP: hp,
      hazardImmunities: record.hazardImmunities,
      onDeath: record.onDeath,
      onDeathTriggerCauses: record.onDeathTriggerCauses,
    });
  }

  /** Hazard types `id` takes no damage from. Returns `[]` for an unregistered unit (never throws — used opportunistically at hazard sites). */
  getHazardImmunities(id: UnitId): readonly HazardType[] {
    return this.units.get(id)?.hazardImmunities ?? [];
  }

  /** Returns the onDeath effect generator for `id`, or undefined. */
  getOnDeath(id: UnitId): ((lastTile: Tile) => readonly EffectPrimitive[]) | undefined {
    return this.units.get(id)?.onDeath;
  }

  /** Returns the causes of removal that trigger `onDeath` for `id`. Defaults to ['Defeated', 'Fell']. */
  getOnDeathTriggerCauses(id: UnitId): readonly RemovalCause[] {
    return this.units.get(id)?.onDeathTriggerCauses ?? ['Defeated', 'Fell'];
  }

  /** Registers a unit's stats and effects at spawn time. */
  registerUnit(id: UnitId, unitSpec: UnitSpec): void {
    this.units.set(id, {
      currentHP: unitSpec.hp,
      hazardImmunities: unitSpec.hazardImmunities ?? [],
      onDeath: unitSpec.onDeath,
      onDeathTriggerCauses: unitSpec.onDeathTriggerCauses,
    });
  }

  /** Removes `id`'s record (`removeUnit` primitive — the unit is no longer on the board). */
  deleteUnit(id: UnitId): void {
    this.units.delete(id);
  }

  // ── Hazard duration bookkeeping ─────────────────────────────────────────

  /** `tile`'s tracked hazard duration, or `undefined` if no hazard is tracked for that tile. `null` means permanent. */
  getHazardDuration(tile: Tile): number | null | undefined {
    return this.hazardDurations.get(tileKey(tile));
  }

  /** Records `tile`'s hazard duration (`spawnHazard` primitive, or a decremented tick from `applyHazard`). */
  setHazardDuration(tile: Tile, duration: number | null): void {
    this.hazardDurations.set(tileKey(tile), duration);
  }

  /** Stops tracking `tile`'s hazard duration (its hazard expired and was cleared). */
  clearHazardDuration(tile: Tile): void {
    this.hazardDurations.delete(tileKey(tile));
  }

  /**
   * Deep-enough independent copy for Move Preview / undo isolation, mirroring
   * `Board.snapshot()`. Safe because `UnitRecord` is only ever replaced
   * wholesale (never mutated in place — see `setHp`), so sharing its
   * `hazardImmunities` array reference across snapshots cannot leak a
   * mutation between them.
   */
  snapshot(): CombatState {
    const copy = new CombatState();
    for (const [id, record] of this.units) copy.units.set(id, record);
    for (const [key, duration] of this.hazardDurations) copy.hazardDurations.set(key, duration);
    return copy;
  }
}
