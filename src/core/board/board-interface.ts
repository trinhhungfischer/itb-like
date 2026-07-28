/**
 * Board & Grid — canonical query/mutation surface.
 *
 * Authoritative source: design/architecture/cross-system-contracts.md §2
 * (supersedes any partial API list in design/gdd/board-and-grid.md itself,
 * per that document's own cross-system reconciliation note).
 *
 * Split into its own module (rather than living beside `BoardImpl`) so that
 * `reachable-tiles.ts` can depend on the `Board` *type* without creating a
 * runtime circular import with `board.ts` (which depends on
 * `reachable-tiles.ts` for its `reachableTiles` implementation).
 */

import type { Classification, Direction, HazardType, Tile, TileFlag, TileState, TerrainType, UnitId } from './board-types.js';
import type { Result } from './board-result.js';

/**
 * The spatial model for one battle. All queries are pure (never mutate
 * state); all mutations are deterministic and — per
 * docs/architecture/adr-0006-combat-resolve-single-mutation-path.md — invoked
 * only via Combat Resolution's `resolve()`, never called directly by Feature
 * or Presentation code.
 */
export interface Board {
  /** Board width in tiles (fixed at construction). */
  readonly width: number;
  /** Board height in tiles (fixed at construction). */
  readonly height: number;

  // ── Queries (pure) ────────────────────────────────────────────────────

  /** Formula 1: `(0 ≤ col < width) ∧ (0 ≤ row < height)`. No wraparound. */
  inBounds(col: number, row: number): boolean;

  /**
   * Materializes a read-only snapshot of one tile's full state.
   * Throws if `(col, row)` is out of bounds (Channel 2 — callers validate
   * coordinates first).
   */
  getTile(col: number, row: number): TileState;

  /** Whether the tile holds a unit. Throws if out of bounds. */
  isOccupied(col: number, row: number): boolean;

  /** The occupying unit's id, or `null` if empty. Throws if out of bounds. */
  getOccupant(col: number, row: number): UnitId | null;

  /** Whether the tile's terrain blocks entry/push-through. Throws if out of bounds. */
  isBlocked(col: number, row: number): boolean;

  /** The tile's hazard overlay, or `null` if none. Throws if out of bounds. */
  getHazard(col: number, row: number): HazardType | null;

  /** Whether the tile carries `flag`. Throws if out of bounds. */
  hasFlag(col: number, row: number, flag: TileFlag): boolean;

  /**
   * Formula 3: orthogonal (4-directional) in-bounds neighbors, fixed order
   * N, S, W, E. 2 results at a corner, 3 on an edge, 4 in the interior.
   * Throws if `(col, row)` itself is out of bounds.
   */
  neighbors(col: number, row: number): Tile[];

  /** Formula 2: Manhattan distance `|Δcol| + |Δrow|`. No bounds requirement. */
  distance(a: Tile, b: Tile): number;

  /**
   * Formula 4: all in-bounds tiles within Manhattan `range` of `origin`
   * (inclusive; `range=0` returns `{origin}`). Throws if `origin` is out of
   * bounds or `range < 0`.
   */
  tilesInRange(origin: Tile, range: number): Tile[];

  /**
   * Formula 6: one orthogonal step from `tile` toward `direction`. May
   * return an out-of-bounds coordinate — deliberately not bounds-checked
   * internally so callers can detect an edge collision via `classify`.
   */
  step(tile: Tile, direction: Direction): Tile;

  /**
   * Formula 7: push-destination classification, strict precedence
   * OutOfBounds → BlockedTerrain → Lethal → Occupied → Clear. Accepts any
   * coordinate, including out-of-bounds ones — that is its purpose.
   */
  classify(tile: Tile): Classification;

  /**
   * Formula 8: ordered, nearest-first line of tiles from `origin` toward
   * `direction`, stopping before an OutOfBounds or BlockedTerrain tile or
   * after `maxLength` steps. Occupied/Lethal tiles are included. Throws if
   * `origin` is out of bounds or `maxLength < 0`.
   */
  rayTiles(origin: Tile, direction: Direction, maxLength: number): Tile[];

  /**
   * Formula 9: the single canonical bounded flood-fill over `Clear` tiles,
   * excluding `origin` from the result. Board & Grid owns this
   * implementation (ADR-0009) — Heroes' `legalMoveTiles` and Enemy
   * movement-to-range both call it verbatim; no second BFS is permitted
   * anywhere in the codebase. The redundant `board` parameter matches the
   * ADR-0009 interface so callers can invoke it as
   * `board.reachableTiles(origin, range, board)`, uniformly with the
   * standalone function export. Throws if `origin` is out of bounds or
   * `range < 0`.
   */
  reachableTiles(origin: Tile, range: number, board: Board): Tile[];

  /**
   * Deep, fully independent copy for Move Preview / Turn & Phase Manager
   * undo. Mutating the copy never affects the live board and vice versa
   * (ADR-0001). No board-owned `restore()` exists — the caller adopts a
   * previously captured snapshot as the new live board.
   */
  snapshot(): Board;

  // ── Mutations (deterministic; invoked only via Combat Resolution) ──────

  /**
   * Empty → Occupied. Rejected (`Result.ok === false`, `reason: 'Occupied'`)
   * if the tile already holds a unit; occupant and state are left unchanged
   * on rejection. Throws if the tile is out of bounds.
   */
  place(tile: Tile, unitId: UnitId): Result;

  /** Occupied → Empty. Idempotent no-op on an already-empty tile; never rejects. Throws if out of bounds. */
  clear(tile: Tile): void;

  /**
   * Sets the tile's terrain. Rejected with `reason: 'WouldStrandOccupant'`
   * if the tile is occupied and `terrain` would be Blocked or Lethal.
   * Also generalizes the board's internal "destroy" concept:
   * `setTerrain(tile, Normal)` on non-destructible `Blocked` or on `Chasm`
   * terrain is rejected with `reason: 'NotDestructible'` (Chasm is
   * permanent — no transition back). `setTerrain(tile, Normal)` on
   * `BlockedDestructible` succeeds (terrain → Normal; any flags persist).
   * Throws if the tile is out of bounds.
   */
  setTerrain(tile: Tile, terrain: TerrainType): Result;

  /**
   * Stores the tile's hazard overlay opaquely — never validated or
   * interpreted by the board. Always succeeds (no state change to any other
   * field). Throws if the tile is out of bounds.
   */
  setHazard(tile: Tile, hazard: HazardType | null): void;

  /** Adds `flag` to the tile. Always succeeds, including on Blocked/Chasm tiles. Throws if out of bounds. */
  setFlag(tile: Tile, flag: TileFlag): void;
}
