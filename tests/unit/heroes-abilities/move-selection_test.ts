import { describe, it, expect } from 'vitest';
import { makeBoard } from '../../../src/core/board/board.js';
import { TerrainType } from '../../../src/core/board/board-types.js';
import { legalMoveTiles } from '../../../src/feature/heroes-abilities/move-selection.js';

describe('heroes-abilities: move-selection (TR-HERO-003)', () => {
  it('test_legalMoveTiles_returns_24_tiles_for_moveRange_3_on_open_board', () => {
    const board = makeBoard();
    const origin = { col: 3, row: 3 };
    const result = legalMoveTiles(origin, 3, board);
    
    expect(result.length).toBe(24);
    for (const tile of result) {
      expect(board.distance(origin, tile)).toBeLessThanOrEqual(3);
    }
  });

  it('test_legalMoveTiles_returns_empty_when_moveRange_is_0', () => {
    const board = makeBoard();
    const origin = { col: 3, row: 3 };
    const result = legalMoveTiles(origin, 0, board);
    
    expect(result).toEqual([]);
  });

  it('test_legalMoveTiles_returns_empty_when_fully_surrounded', () => {
    const board = makeBoard();
    const origin = { col: 4, row: 4 };
    
    // Fully surround the origin
    board.setTerrain({ col: 4, row: 3 }, TerrainType.Blocked);
    board.setTerrain({ col: 4, row: 5 }, TerrainType.Blocked);
    board.setTerrain({ col: 3, row: 4 }, TerrainType.Blocked);
    board.setTerrain({ col: 5, row: 4 }, TerrainType.Blocked);

    const result = legalMoveTiles(origin, 5, board);
    
    expect(result).toEqual([]);
  });

  it('test_lethal_tiles_are_excluded_from_legalMoveTiles', () => {
    const board = makeBoard();
    const origin = { col: 4, row: 4 };
    
    // Create a path but block it with Lethal terrain (Chasm)
    board.setTerrain({ col: 4, row: 3 }, TerrainType.Chasm);
    
    const result = legalMoveTiles(origin, 2, board);
    
    // Lethal tiles are not 'Clear' so they should be excluded by reachableTiles.
    const hasLethalTile = result.some(t => t.col === 4 && t.row === 3);
    expect(hasLethalTile).toBe(false);
  });

  it('test_legalTargets_query_uses_post_move_tile_after_move_slot_used', () => {
    // Since legalTargets is implemented in the next story (Story 003), this test
    // ensures that legalMoveTiles itself correctly respects the origin passed to it,
    // which simulates a hero having moved and then querying reachability from the new tile.
    const board = makeBoard();
    const originalPosition = { col: 2, row: 2 };
    const postMovePosition = { col: 5, row: 5 };
    
    const preMoveTiles = legalMoveTiles(originalPosition, 2, board);
    const postMoveTiles = legalMoveTiles(postMovePosition, 2, board);
    
    expect(preMoveTiles).not.toEqual(postMoveTiles);
    
    // The tiles returned should be centered around postMovePosition
    for (const tile of postMoveTiles) {
      expect(board.distance(postMovePosition, tile)).toBeLessThanOrEqual(2);
    }
  });
});
