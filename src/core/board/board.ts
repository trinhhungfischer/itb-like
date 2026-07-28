/**
 * Board & Grid — tile-state representation, pure queries, and mutations.
 *
 * Implements: design/gdd/board-and-grid.md (all Formulas, Core Rules,
 * States and Transitions, Edge Cases).
 * Governing ADRs:
 *  - docs/architecture/adr-0001-board-tile-state-snapshot.md (representation, snapshot)
 *  - docs/architecture/adr-0005-board-combat-error-contract.md (Result vs throw)
 *  - docs/architecture/adr-0009-reachable-tiles-coordinate-transform.md (reachableTiles)
 *
 * ## Internal representation (ADR-0001)
 *
 * Per-tile state is stored as parallel, flat, fixed-length arrays, one per
 * field, each of length `width * height`, addressed by the single index
 * function `idx(col, row) = row * width + col`. `snapshot()` is therefore a
 * bulk array copy, never an object-graph clone; no per-tile object is ever
 * stored (only materialized at the `getTile` query boundary).
 *
 * Two of the four fields deliberately use a plain `Array` instead of a typed
 * array — a considered deviation from ADR-0001's illustrative code, not from
 * its actual requirements (flat parallel arrays, one index function, cheap
 * `.slice()` snapshot, no per-tile objects, no leaked backing-array
 * references — all preserved):
 *
 *  - `occupancy: (UnitId | null)[]` — ADR-0001's illustrative snippet shows
 *    `Int32Array` with unit ids as positive ints. That predates
 *    docs/architecture/adr-0008-shared-unit-record.md, which later ratified
 *    `type UnitId = string`. A string cannot be stored in an `Int32Array`.
 *    A flat `Array<UnitId | null>` keeps every other ADR-0001 guarantee
 *    (single index function, `.slice()` snapshot, no object-graph) while
 *    accommodating the now-canonical string id. `.slice()` on a length-≤144
 *    array of primitives is still comfortably sub-millisecond.
 *  - `hazard: (HazardType | null)[]` — hazard type is explicitly "opaque"
 *    per the GDD (Board & Grid never defines the hazard vocabulary, and has
 *    zero upstream dependencies), so it cannot be pre-assigned a closed
 *    `Uint8` enum the way `terrain`/`flags` can. Same flat-array treatment.
 *
 * `terrain` (`Uint8Array`, a closed 5-value enum Board & Grid itself owns)
 * and `flags` (`Uint8Array` bitfield) remain exactly as ADR-0001 illustrates.
 */

import type { Board } from './board-interface.js';
import type { BoardConfig } from './board-config.js';
import { DEFAULT_BOARD_CONFIG } from './board-config.js';
import type { Classification, Direction, HazardType, Tile, TileFlag, TileState, UnitId } from './board-types.js';
import { TerrainType } from './board-types.js';
import type { Result } from './board-result.js';
import { OK, invariant, reject } from './board-result.js';
import { bitFor, decodeFlags } from './board-flags.js';
import { reachableTiles as computeReachableTiles } from './reachable-tiles.js';

/** Fixed orthogonal neighbor offsets, N/S/W/E — the one order used everywhere for determinism. */
const NEIGHBOR_OFFSETS: readonly Tile[] = [
  { col: 0, row: -1 }, // N
  { col: 0, row: 1 }, // S
  { col: -1, row: 0 }, // W
  { col: 1, row: 0 }, // E
];

/** Formula 6: unit step vector per cardinal direction. */
const DIRECTION_VECTORS: Readonly<Record<Direction, Tile>> = Object.freeze({
  N: { col: 0, row: -1 },
  S: { col: 0, row: 1 },
  E: { col: 1, row: 0 },
  W: { col: -1, row: 0 },
});

class BoardImpl implements Board {
  private constructor(
    readonly width: number,
    readonly height: number,
    private readonly waterLethal: boolean,
    private readonly terrain: Uint8Array,
    private readonly occupancy: (UnitId | null)[],
    private readonly hazard: (HazardType | null)[],
    private readonly flags: Uint8Array,
  ) {}

  /** Allocates a fresh board: all tiles Normal terrain, empty, no hazard, no flags. */
  static allocate(width: number, height: number, waterLethal: boolean): BoardImpl {
    const size = width * height;
    return new BoardImpl(
      width,
      height,
      waterLethal,
      new Uint8Array(size).fill(TerrainType.Normal),
      new Array<UnitId | null>(size).fill(null),
      new Array<HazardType | null>(size).fill(null),
      new Uint8Array(size),
    );
  }

  /** The one index function (ADR-0001) — used by every query and mutation, never duplicated inline. */
  private idx(col: number, row: number): number {
    return row * this.width + col;
  }

  private isBlockedTerrain(terrain: TerrainType): boolean {
    return terrain === TerrainType.Blocked || terrain === TerrainType.BlockedDestructible;
  }

  private isLethalTerrain(terrain: TerrainType): boolean {
    return terrain === TerrainType.Chasm || (terrain === TerrainType.Water && this.waterLethal);
  }

  // ── Queries ──────────────────────────────────────────────────────────

  inBounds(col: number, row: number): boolean {
    return col >= 0 && col < this.width && row >= 0 && row < this.height;
  }

  getTile(col: number, row: number): TileState {
    invariant(this.inBounds(col, row), `getTile: out of bounds (${col},${row})`);
    const i = this.idx(col, row);
    return {
      col,
      row,
      terrain: this.terrain[i]!,
      hazard: this.hazard[i]!,
      flags: decodeFlags(this.flags[i]!),
      occupant: this.occupancy[i]!,
    };
  }

  isOccupied(col: number, row: number): boolean {
    invariant(this.inBounds(col, row), `isOccupied: out of bounds (${col},${row})`);
    return this.occupancy[this.idx(col, row)]! !== null;
  }

  getOccupant(col: number, row: number): UnitId | null {
    invariant(this.inBounds(col, row), `getOccupant: out of bounds (${col},${row})`);
    return this.occupancy[this.idx(col, row)]!;
  }

  isBlocked(col: number, row: number): boolean {
    invariant(this.inBounds(col, row), `isBlocked: out of bounds (${col},${row})`);
    return this.isBlockedTerrain(this.terrain[this.idx(col, row)]!);
  }

  getHazard(col: number, row: number): HazardType | null {
    invariant(this.inBounds(col, row), `getHazard: out of bounds (${col},${row})`);
    return this.hazard[this.idx(col, row)]!;
  }

  hasFlag(col: number, row: number, flag: TileFlag): boolean {
    invariant(this.inBounds(col, row), `hasFlag: out of bounds (${col},${row})`);
    const bits = this.flags[this.idx(col, row)]!;
    return (bits & bitFor(flag)) !== 0;
  }

  neighbors(col: number, row: number): Tile[] {
    invariant(this.inBounds(col, row), `neighbors: origin out of bounds (${col},${row})`);
    const result: Tile[] = [];
    for (const offset of NEIGHBOR_OFFSETS) {
      const nc = col + offset.col;
      const nr = row + offset.row;
      if (this.inBounds(nc, nr)) result.push({ col: nc, row: nr });
    }
    return result;
  }

  distance(a: Tile, b: Tile): number {
    return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
  }

  tilesInRange(origin: Tile, range: number): Tile[] {
    invariant(this.inBounds(origin.col, origin.row), `tilesInRange: origin out of bounds (${origin.col},${origin.row})`);
    invariant(Number.isInteger(range) && range >= 0, `tilesInRange: range must be an integer >= 0, got ${range}`);
    const result: Tile[] = [];
    for (let col = 0; col < this.width; col++) {
      for (let row = 0; row < this.height; row++) {
        if (this.distance(origin, { col, row }) <= range) result.push({ col, row });
      }
    }
    return result;
  }

  step(tile: Tile, direction: Direction): Tile {
    const v = DIRECTION_VECTORS[direction];
    // Channel 2 (ADR-0005): a bad direction is a programmer error, so it must
    // throw a named InvariantError rather than a bare
    // "Cannot read properties of undefined (reading 'col')" from the line
    // below. The type system normally prevents this, but any `as` cast at a
    // module boundary erases that guarantee -- which is exactly how it was
    // found (an integration test passed 'east'; Direction is 'N'|'S'|'E'|'W').
    invariant(v !== undefined, `Board.step: unknown direction ${String(direction)}`);
    return { col: tile.col + v.col, row: tile.row + v.row };
  }

  classify(tile: Tile): Classification {
    if (!this.inBounds(tile.col, tile.row)) return { kind: 'OutOfBounds' };
    const i = this.idx(tile.col, tile.row);
    const terrain = this.terrain[i]!;
    if (this.isBlockedTerrain(terrain)) return { kind: 'BlockedTerrain' };
    if (this.isLethalTerrain(terrain)) return { kind: 'Lethal' };
    const occupant = this.occupancy[i]!;
    if (occupant !== null) return { kind: 'Occupied', unitId: occupant };
    return { kind: 'Clear' };
  }

  rayTiles(origin: Tile, direction: Direction, maxLength: number): Tile[] {
    invariant(this.inBounds(origin.col, origin.row), `rayTiles: origin out of bounds (${origin.col},${origin.row})`);
    invariant(Number.isInteger(maxLength) && maxLength >= 0, `rayTiles: maxLength must be an integer >= 0, got ${maxLength}`);
    const result: Tile[] = [];
    let current: Tile = origin;
    for (let i = 0; i < maxLength; i++) {
      const next = this.step(current, direction);
      if (!this.inBounds(next.col, next.row)) break;
      if (this.isBlocked(next.col, next.row)) break;
      result.push(next);
      current = next;
    }
    return result;
  }

  reachableTiles(origin: Tile, range: number, board: Board): Tile[] {
    return computeReachableTiles(origin, range, board);
  }

  snapshot(): Board {
    return new BoardImpl(
      this.width,
      this.height,
      this.waterLethal,
      this.terrain.slice(),
      this.occupancy.slice(),
      this.hazard.slice(),
      this.flags.slice(),
    );
  }

  // ── Mutations (deterministic; invoked only via Combat Resolution) ──────

  place(tile: Tile, unitId: UnitId): Result {
    invariant(this.inBounds(tile.col, tile.row), `place: tile out of bounds (${tile.col},${tile.row})`);
    const i = this.idx(tile.col, tile.row);
    if (this.occupancy[i]! !== null) return reject('Occupied');
    this.occupancy[i] = unitId;
    return OK;
  }

  clear(tile: Tile): void {
    invariant(this.inBounds(tile.col, tile.row), `clear: tile out of bounds (${tile.col},${tile.row})`);
    this.occupancy[this.idx(tile.col, tile.row)] = null;
  }

  setTerrain(tile: Tile, terrain: TerrainType): Result {
    invariant(this.inBounds(tile.col, tile.row), `setTerrain: tile out of bounds (${tile.col},${tile.row})`);
    const i = this.idx(tile.col, tile.row);
    const current = this.terrain[i]!;

    // "Destroy" semantics generalize into setTerrain (GDD Detailed Design,
    // Runtime terrain mutation): destroy(tile) === setTerrain(tile, Normal).
    // Chasm never transitions back ("Chasm is permanent"); non-destructible
    // Blocked terrain cannot be destroyed either. BlockedDestructible → Normal
    // is the one legal "destroy" transition.
    if (terrain === TerrainType.Normal && (current === TerrainType.Chasm || current === TerrainType.Blocked)) {
      return reject('NotDestructible');
    }

    const wouldStrand = this.isBlockedTerrain(terrain) || this.isLethalTerrain(terrain);
    if (this.occupancy[i]! !== null && wouldStrand) return reject('WouldStrandOccupant');

    this.terrain[i] = terrain;
    return OK;
  }

  setHazard(tile: Tile, hazard: HazardType | null): void {
    invariant(this.inBounds(tile.col, tile.row), `setHazard: tile out of bounds (${tile.col},${tile.row})`);
    this.hazard[this.idx(tile.col, tile.row)] = hazard;
  }

  setFlag(tile: Tile, flag: TileFlag): void {
    invariant(this.inBounds(tile.col, tile.row), `setFlag: tile out of bounds (${tile.col},${tile.row})`);
    const i = this.idx(tile.col, tile.row);
    this.flags[i] = this.flags[i]! | bitFor(flag);
  }
}

/**
 * Constructs a new {@link Board}. Defaults to the 8×8 board defined in
 * {@link DEFAULT_BOARD_CONFIG} (design/registry/entities.yaml `grid_width` /
 * `grid_height`). Throws {@link InvariantError} if `width < 1` or
 * `height < 1` — construction is a Channel-2 programmer error, per
 * docs/architecture/adr-0005-board-combat-error-contract.md.
 */
export function makeBoard(config: Partial<BoardConfig> = {}): Board {
  const width = config.width ?? DEFAULT_BOARD_CONFIG.width;
  const height = config.height ?? DEFAULT_BOARD_CONFIG.height;
  const waterLethal = config.waterLethal ?? DEFAULT_BOARD_CONFIG.waterLethal;
  invariant(Number.isInteger(width) && width >= 1, `makeBoard: width must be an integer >= 1, got ${width}`);
  invariant(Number.isInteger(height) && height >= 1, `makeBoard: height must be an integer >= 1, got ${height}`);
  return BoardImpl.allocate(width, height, waterLethal);
}
