import type { Board } from '../../core/board/board-interface.js';
import type { Tile } from '../../core/board/board-types.js';

/**
 * Returns the set of reachable tiles for a hero to move to.
 * Implements TR-HERO-003: legalMoveTiles(origin, moveRange, board) is a pass-through 
 * to Board.reachableTiles (F1, resolves C3) — no second BFS.
 * 
 * Targetting queries post-move will use the updated tile since they take the origin 
 * as an argument, so if the hero moves, its new position should be passed.
 */
export function legalMoveTiles(origin: Tile, moveRange: number, board: Board): Tile[] {
  if (moveRange <= 0) return [];
  
  // Board.reachableTiles already bounds the BFS to moveRange and only expands to 'Clear' tiles,
  // excluding Lethal, Blocked, Occupied, and OutOfBounds.
  return board.reachableTiles(origin, moveRange, board);
}
