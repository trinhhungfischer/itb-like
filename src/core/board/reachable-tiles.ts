/**
 * Board & Grid — the single canonical bounded flood-fill.
 *
 * Implements: design/gdd/board-and-grid.md Formula 9.
 * Governing ADR: docs/architecture/adr-0009-reachable-tiles-coordinate-transform.md
 *
 * This is the ONE bounded movement flood-fill in the codebase. Heroes &
 * Abilities' `legalMoveTiles()` and Enemy movement-to-range must both consume
 * this function (via `Board.reachableTiles`, which delegates here) — no
 * second hand-written BFS is permitted anywhere else. Exported as a
 * standalone function (in addition to being wired up as `Board.reachableTiles`)
 * so future consumers can import the implementation directly if useful,
 * without ever re-deriving it.
 */

import type { Board } from './board-interface.js';
import type { Tile } from './board-types.js';
import { invariant } from './board-result.js';

/** Deterministic string key for a tile coordinate, used for the visited set. */
function tileKey(tile: Tile): string {
  return `${tile.col},${tile.row}`;
}

/**
 * Bounded BFS over `Clear` tiles, expanding only through `board.neighbors()`
 * filtered to `board.classify(n).kind === 'Clear'`. Bounded by `range`
 * orthogonal steps. Excludes `origin` from the result. Deterministic: the
 * frontier is processed in `neighbors()`'s fixed N/S/W/E order, so identical
 * inputs always produce identically-ordered output — no RNG, no clock.
 *
 * Works identically against a live board or a `board.snapshot()`, since it
 * reads only the pure `neighbors`/`classify` queries.
 *
 * Throws if `origin` is out of bounds or `range < 0` (Channel 2 — an
 * origin-taking query per docs/architecture/adr-0005-board-combat-error-contract.md).
 */
export function reachableTiles(origin: Tile, range: number, board: Board): Tile[] {
  invariant(board.inBounds(origin.col, origin.row), `reachableTiles: origin out of bounds (${origin.col},${origin.row})`);
  invariant(Number.isInteger(range) && range >= 0, `reachableTiles: range must be an integer >= 0, got ${range}`);

  const visited = new Set<string>([tileKey(origin)]);
  const result: Tile[] = [];
  let frontier: Tile[] = [origin];

  for (let step = 0; step < range; step++) {
    const next: Tile[] = [];
    for (const tile of frontier) {
      for (const neighbor of board.neighbors(tile.col, tile.row)) {
        const key = tileKey(neighbor);
        if (visited.has(key)) continue;
        if (board.classify(neighbor).kind !== 'Clear') continue;
        visited.add(key);
        result.push(neighbor);
        next.push(neighbor);
      }
    }
    frontier = next;
  }

  return result;
}
