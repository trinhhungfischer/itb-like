import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeViewportTransform, BoardRenderer } from '../../../src/presentation/board-renderer.js';
import type { Board } from '../../../src/core/board/board-interface.js';
import type { CombatEvent } from '../../../src/core/combat/combat-events.js';

describe('BoardRenderer', () => {
  describe('F1: Viewport fit (computeViewportTransform)', () => {
    it('computes exact tileSize and origin for 960x720 window on 8x8 grid', () => {
      // Setup: 8x8 grid, 960x720 window
      const transform = computeViewportTransform(960, 720, 8, 8);
      
      // min(960/8, 720/8) = min(120, 90) = 90
      expect(transform.tileSize).toBe(90);
      
      // originX = (960 - 90*8) / 2 = (960 - 720) / 2 = 120
      expect(transform.originX).toBe(120);
      
      // originY = (720 - 90*8) / 2 = (720 - 720) / 2 = 0
      expect(transform.originY).toBe(0);
      
      expect(transform.boardWidth).toBe(8);
      expect(transform.boardHeight).toBe(8);
    });
    
    it('clamps tileSize to minimum (32px)', () => {
      // Setup: 8x8 grid, 200x200 window
      // min(200/8, 200/8) = 25
      const transform = computeViewportTransform(200, 200, 8, 8);
      
      expect(transform.tileSize).toBe(32);
      
      // originX = (200 - 32*8) / 2 = (200 - 256) / 2 = -28
      expect(transform.originX).toBe(-28);
      expect(transform.originY).toBe(-28);
    });
    
    it('clamps tileSize to maximum (128px)', () => {
      // Setup: 8x8 grid, 2000x2000 window
      // min(2000/8, 2000/8) = 250
      const transform = computeViewportTransform(2000, 2000, 8, 8);
      
      expect(transform.tileSize).toBe(128);
    });
  });

  describe('Layers rendering', () => {
    it('renders layers correctly based on engine getTile and occupancy', () => {
      const mockBoard: Board = {
        width: 8,
        height: 8,
        getTile: vi.fn().mockReturnValue({ terrain: 'Normal' }),
        getHazard: vi.fn().mockReturnValue(null),
        isOccupied: vi.fn().mockImplementation((col, row) => col === 3 && row === 4),
        getOccupant: vi.fn().mockImplementation((col, row) => col === 3 && row === 4 ? 'unit-123' : null),
        isBlocked: vi.fn().mockReturnValue(false),
        hasFlag: vi.fn().mockReturnValue(false),
        inBounds: vi.fn().mockReturnValue(true),
        neighbors: vi.fn(),
        distance: vi.fn(),
        tilesInRange: vi.fn(),
        step: vi.fn(),
        classify: vi.fn(),
        rayTiles: vi.fn(),
        reachableTiles: vi.fn(),
        snapshot: vi.fn(),
        place: vi.fn(),
        clear: vi.fn(),
        setTerrain: vi.fn(),
        setHazard: vi.fn(),
        setFlag: vi.fn(),
      };
      
      const renderer = new BoardRenderer(mockBoard);
      
      expect(renderer.container.children.length).toBe(5);
      
      renderer.resize(960, 720);
      
      expect(mockBoard.getTile).toHaveBeenCalled();
      expect(mockBoard.getHazard).toHaveBeenCalled();
      expect(mockBoard.isOccupied).toHaveBeenCalled();
      expect(mockBoard.getOccupant).toHaveBeenCalledWith(3, 4);
    });
  });

  describe('Juice animations', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('blocks input while animating and unblocks after playback', async () => {
      const mockBoard = { width: 8, height: 8, getTile: vi.fn().mockReturnValue({ terrain: 'Normal' }), getHazard: vi.fn().mockReturnValue(null), isOccupied: vi.fn().mockReturnValue(false), getOccupant: vi.fn().mockReturnValue(null) } as unknown as Board;
      const renderer = new BoardRenderer(mockBoard);
      renderer.resize(960, 720);
      
      expect(renderer.isAnimating()).toBe(false);
      
      const promise = renderer.playEvents([
        { type: 'displacement_complete', targetId: 'unit-1', stepsMoved: 2 } as CombatEvent
      ]);
      
      expect(renderer.isAnimating()).toBe(true);
      
      // Advance timers by step_duration_ms * stepsMoved = 120 * 2 = 240
      await vi.advanceTimersByTimeAsync(240);
      
      await promise;
      
      expect(renderer.isAnimating()).toBe(false);
    });

    it('plays flashes for 120ms', async () => {
      const mockBoard = { width: 8, height: 8, getTile: vi.fn().mockReturnValue({ terrain: 'Normal' }), getHazard: vi.fn().mockReturnValue(null), isOccupied: vi.fn().mockReturnValue(false), getOccupant: vi.fn().mockReturnValue(null) } as unknown as Board;
      const renderer = new BoardRenderer(mockBoard);
      renderer.resize(960, 720);
      
      const promise = renderer.playEvents([
        { type: 'damage_applied', targetId: 'unit-1', amount: 1, hp: 1 } as CombatEvent
      ]);
      
      expect(renderer.isAnimating()).toBe(true);
      
      // 120ms per tuning knobs for flashes
      await vi.advanceTimersByTimeAsync(120);
      await promise;
      
      expect(renderer.isAnimating()).toBe(false);
    });
  });
});
