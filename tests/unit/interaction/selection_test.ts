import { describe, it, expect, vi } from 'vitest';
import { InputManager } from '../../../src/presentation/interaction/input-manager.js';
import { SelectionStateMachine } from '../../../src/core/input/selection-state-machine.js';
import type { Board } from '../../../src/core/board/board-interface.js';
import type { UnitLookup, TargetLegalityQuery, ActionCommitter, CommitOutcome } from '../../../src/core/input/selection-ports.js';
import { EventBus } from '../../../src/core/events/event-bus.js';
import type { ViewTransform } from '../../../src/core/input/coordinate-transform.js';

describe('Interaction Patterns - Selection & Targeting (Story 001)', () => {
  function buildHarness() {
    const board = {
      width: 5,
      height: 5,
      getOccupant: vi.fn(),
    } as unknown as Board;

    const eventBus = new EventBus();
    const unitLookup: UnitLookup = {
      unitAt: vi.fn(),
      unit: vi.fn(),
    };
    const targetLegality: TargetLegalityQuery = {
      isLegalTarget: vi.fn().mockReturnValue(true),
    };
    const actionCommitter: ActionCommitter = {
      commit: vi.fn().mockReturnValue({ committed: true, unitHasActionsRemaining: false }),
    };
    const view: ViewTransform = {
      offsetX: 0,
      offsetY: 0,
      tileSize: 10,
    };

    let isAnimating = false;
    const getCurrentPhase = vi.fn().mockReturnValue('PlayerPhase');

    const machine = new SelectionStateMachine({
      board,
      eventBus,
      unitLookup,
      targetLegality,
      actionCommitter,
      getCurrentPhase,
      isAnimating: () => isAnimating,
      getView: () => view,
      config: { clickTolerancePx: 5, maxClickHoldMs: 500 }
    });

    const manager = new InputManager({
      machine,
      board,
      unitLookup,
      getView: () => view,
    });

    return { manager, machine, board, unitLookup, targetLegality, actionCommitter, setAnimating: (val: boolean) => { isAnimating = val; } };
  }

  it('Hovering a valid target passes the tile to hoverTile', () => {
    const h = buildHarness();
    // Screen (15, 15) -> Tile (1, 1) with tileSize 10, offsets 0
    h.manager.onPointerMove(15, 15);
    
    expect(h.machine.getHoveredTile()).toEqual({ col: 1, row: 1 });
  });

  it('Clicking a valid target commits the action and locks input', () => {
    const h = buildHarness();
    
    // Setup: Idle -> UnitSelected -> Targeting
    // Fake a friendly eligible unit at (1, 1)
    vi.mocked(h.board.getOccupant).mockImplementation((col, row) => (col === 1 && row === 1 ? 'hero-1' : null));
    vi.mocked(h.unitLookup.unit).mockReturnValue({ id: 'hero-1', team: 'hero', actingEligible: true });
    
    // Select unit at (1,1) -> center is (15, 15)
    h.manager.onPointerDown(15, 15, 0);
    h.manager.onPointerUp(15, 15, 10);
    
    expect(h.machine.getState().status).toBe('UnitSelected');
    
    // Transition to Targeting mode
    h.machine.chooseMode({ type: 'Move' });
    expect(h.machine.getState().status).toBe('Targeting');
    
    // Hover a target at (2, 2) -> center is (25, 25)
    h.manager.onPointerMove(25, 25);
    expect(h.machine.getHoveredTile()).toEqual({ col: 2, row: 2 });
    
    // Click the target to commit
    // During commit, we pretend animation starts
    h.setAnimating(true);
    
    h.manager.onPointerDown(25, 25, 20);
    h.manager.onPointerUp(25, 25, 30);
    
    // Input is now locked
    expect(h.machine.getState().status).toBe('Locked');
    expect(h.actionCommitter.commit).toHaveBeenCalled();
    
    // Input remains locked until animation completes
    h.manager.onPointerDown(35, 35, 40);
    h.manager.onPointerUp(35, 35, 50);
    expect(h.machine.getState().status).toBe('Locked'); // ignored the click
    
    // Animation completes
    h.setAnimating(false);
    
    // Lock gate is synced on next pointer event (or frame sync)
    h.manager.onPointerDown(35, 35, 60);
    expect(h.machine.getState().status).toBe('Idle'); // Transitioned to Idle because the commit didn't leave actions
  });

  it('Tab/Shift-Tab cycles through living heroes', () => {
    const h = buildHarness();
    
    // Setup 3 heroes on the board at (0,0), (1,0), (2,0)
    vi.mocked(h.board.getOccupant).mockImplementation((col, row) => {
      if (row === 0 && col === 0) return 'hero-1';
      if (row === 0 && col === 1) return 'hero-2';
      if (row === 0 && col === 2) return 'hero-3';
      return null;
    });
    vi.mocked(h.unitLookup.unitAt).mockImplementation((tile, _b) => {
      if (tile.row === 0 && tile.col === 0) return { id: 'hero-1', team: 'hero', actingEligible: true };
      if (tile.row === 0 && tile.col === 1) return { id: 'hero-2', team: 'hero', actingEligible: true };
      if (tile.row === 0 && tile.col === 2) return { id: 'hero-3', team: 'hero', actingEligible: true };
      return null;
    });
    // unitLookup.unit is called when pointerUp validates the selection
    vi.mocked(h.unitLookup.unit).mockImplementation((id, _b) => {
      if (id === 'hero-1') return { id: 'hero-1', team: 'hero', actingEligible: true };
      if (id === 'hero-2') return { id: 'hero-2', team: 'hero', actingEligible: true };
      if (id === 'hero-3') return { id: 'hero-3', team: 'hero', actingEligible: true };
      return null;
    });

    // Press Tab
    h.manager.onKeyDown('Tab', false, 0);
    expect(h.machine.getState()).toEqual({ status: 'UnitSelected', unitId: 'hero-1' });

    // Press Tab again
    h.manager.onKeyDown('Tab', false, 10);
    expect(h.machine.getState()).toEqual({ status: 'UnitSelected', unitId: 'hero-2' });

    // Press Shift-Tab (back to hero 1)
    h.manager.onKeyDown('Tab', true, 20);
    expect(h.machine.getState()).toEqual({ status: 'UnitSelected', unitId: 'hero-1' });
    
    // Press Shift-Tab (wrap around to hero 3)
    h.manager.onKeyDown('Tab', true, 30);
    expect(h.machine.getState()).toEqual({ status: 'UnitSelected', unitId: 'hero-3' });
  });
});
