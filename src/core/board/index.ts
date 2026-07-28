/**
 * Board & Grid — public module surface.
 *
 * Implements: design/gdd/board-and-grid.md
 * Canonical query/mutation API: design/architecture/cross-system-contracts.md §2
 */

export type { Board } from './board-interface.js';
export { makeBoard } from './board.js';

export type {
  Tile,
  HazardType,
  TileFlag,
  UnitId,
  Direction,
  Classification,
  TileState,
} from './board-types.js';
export { TerrainType } from './board-types.js';

export type { BoardConfig } from './board-config.js';
export { DEFAULT_BOARD_CONFIG, GRID_WIDTH_DEFAULT, GRID_HEIGHT_DEFAULT } from './board-config.js';

export type { Result, RejectReason } from './board-result.js';
export { OK, reject, invariant, InvariantError } from './board-result.js';

export { reachableTiles } from './reachable-tiles.js';
