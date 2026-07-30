import { describe, it, expect, vi } from 'vitest';
import { MovePreviewOverlay } from '../../../src/presentation/interaction/move-preview-overlay.js';
import type { MovePreview } from '../../../src/core/preview/move-preview.js';
import type { Board } from '../../../src/core/board/board-interface.js';
import type { ViewTransform } from '../../../src/core/input/coordinate-transform.js';
import { Container, Graphics, Text } from 'pixi.js';

describe('MovePreviewOverlay', () => {
  it('renders ghost and path for displaced units', () => {
    const liveBoard = {
      width: 5, height: 5,
      getOccupant: vi.fn((col, row) => (col === 1 && row === 1 ? 'unit-a' : null)),
    } as unknown as Board;

    const previewBoard = {
      width: 5, height: 5,
      getOccupant: vi.fn((col, row) => (col === 3 && row === 1 ? 'unit-a' : null)),
    } as unknown as Board;

    const result = {
      events: [
        { type: 'displacement_complete', targetId: 'unit-a', stepsMoved: 2 }
      ],
      previewBoard,
    };

    const preview = {
      getResult: vi.fn(() => result),
    } as unknown as MovePreview;

    const transform: ViewTransform = { originX: 0, originY: 0, tileSize: 64, boardWidth: 5, boardHeight: 5 };
    const overlay = new MovePreviewOverlay(preview, liveBoard);
    
    overlay.render(transform);

    const graphics = overlay.container.children.filter(c => c instanceof Graphics);
    expect(graphics.length).toBeGreaterThan(0); // Should have drawn ghost and path
  });

  it('renders damage numbers', () => {
    const liveBoard = {
      width: 5, height: 5,
      getOccupant: vi.fn((col, row) => (col === 2 && row === 2 ? 'unit-b' : null)),
    } as unknown as Board;

    const previewBoard = {
      width: 5, height: 5,
      getOccupant: vi.fn((col, row) => (col === 2 && row === 2 ? 'unit-b' : null)),
    } as unknown as Board;

    const result = {
      events: [
        { type: 'damage_applied', targetId: 'unit-b', amount: 3, hp: 7 }
      ],
      previewBoard,
    };

    const preview = {
      getResult: vi.fn(() => result),
    } as unknown as MovePreview;

    const transform: ViewTransform = { originX: 0, originY: 0, tileSize: 64, boardWidth: 5, boardHeight: 5 };
    const overlay = new MovePreviewOverlay(preview, liveBoard);
    
    overlay.render(transform);

    const texts = overlay.container.children.filter(c => c instanceof Text) as Text[];
    expect(texts.length).toBe(1);
    expect(texts[0].text).toBe('-3');
  });

  it('clears when transform is null or result is null', () => {
    const liveBoard = { width: 5, height: 5, getOccupant: vi.fn() } as unknown as Board;
    const preview = { getResult: vi.fn(() => null) } as unknown as MovePreview;
    
    const transform: ViewTransform = { originX: 0, originY: 0, tileSize: 64, boardWidth: 5, boardHeight: 5 };
    const overlay = new MovePreviewOverlay(preview, liveBoard);
    
    overlay.container.addChild(new Graphics()); // Add dummy
    overlay.render(transform);
    expect(overlay.container.children.length).toBe(0);
  });
});
