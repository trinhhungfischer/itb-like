/**
 * Board & Grid — spatial data types.
 *
 * Implements: design/gdd/board-and-grid.md (Detailed Design, States and
 * Transitions, Formulas F1–F9).
 * Governing ADR: docs/architecture/adr-0001-board-tile-state-snapshot.md
 */

/** An addressable board cell: integer `(col, row)`, origin `(0,0)` top-left. */
export interface Tile {
  readonly col: number;
  readonly row: number;
}

/**
 * Per-tile terrain state (GDD States and Transitions table).
 *
 * `Blocked` and `BlockedDestructible` are two distinct terrain values (rather
 * than one `Blocked` value plus a separate per-tile destructibility array) so
 * the whole tile-state model stays a set of small-integer parallel arrays per
 * ADR-0001 — no extra field, no per-tile object. Both are impassable and both
 * satisfy `isBlocked()`; only `BlockedDestructible` can transition back to
 * `Normal` via `setTerrain(tile, Normal)` ("destroy").
 */
export enum TerrainType {
  /** Default walkable tile. */
  Normal = 0,
  /** Impassable wall/rock. Cannot be destroyed. */
  Blocked = 1,
  /** Impassable wall/rock that CAN be destroyed (setTerrain(tile, Normal) → rubble). */
  BlockedDestructible = 2,
  /** Pit. Entry removes the unit (lethal). Permanent — never transitions back. */
  Chasm = 3,
  /** Lethal on entry iff the board's `waterLethal` config is true (GDD `water_lethal` knob). */
  Water = 4,
}

/**
 * Opaque hazard identifier (fire, smoke, acid, ...). Board & Grid stores
 * hazard state but never defines or interprets hazard semantics — that is
 * Combat Resolution / Enemy's responsibility (GDD Core Rule 7). Because the
 * hazard vocabulary is owned elsewhere and Board & Grid has zero upstream
 * dependencies (GDD Dependencies: "NONE"), this module does not import or
 * assume any closed set of hazard names.
 */
export type HazardType = string;

/** Tile flags set by the Encounter Generator / Objective system (GDD Core Rule 9). */
export type TileFlag = 'spawn-point' | 'objective' | 'deploy-zone';

/**
 * Canonical per-battle unit identifier. Matches
 * docs/architecture/adr-0008-shared-unit-record.md's `type UnitId = string`
 * (Heroes & Abilities owns the `Unit` record itself; Board & Grid only ever
 * stores/returns the id as an opaque string, never a `Unit`).
 */
export type UnitId = string;

/** Cardinal direction for `step`/`rayTiles` (Formula 6). */
export type Direction = 'N' | 'S' | 'E' | 'W';

/**
 * Push-destination classification (Formula 7). Strict precedence order:
 * OutOfBounds → BlockedTerrain → Lethal → Occupied → Clear. Pure descriptor —
 * classifying a tile never mutates board state.
 */
export type Classification =
  | { readonly kind: 'OutOfBounds' }
  | { readonly kind: 'BlockedTerrain' }
  | { readonly kind: 'Lethal' }
  | { readonly kind: 'Occupied'; readonly unitId: UnitId }
  | { readonly kind: 'Clear' };

/**
 * Read-only materialized view of one tile's full state, returned by
 * `getTile()`. Per ADR-0001, this object is constructed fresh at the query
 * boundary only — the board never stores an array of these.
 */
export interface TileState {
  readonly col: number;
  readonly row: number;
  readonly terrain: TerrainType;
  readonly hazard: HazardType | null;
  readonly flags: readonly TileFlag[];
  readonly occupant: UnitId | null;
}
