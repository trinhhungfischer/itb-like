import { describe, it, expect, vi } from 'vitest';
import { InputManager } from '../../../src/presentation/interaction/input-manager.js';
import { SelectionStateMachine } from '../../../src/core/input/selection-state-machine.js';
import type { Board } from '../../../src/core/board/board-interface.js';
import type { UnitLookup, TargetLegalityQuery, ActionCommitter } from '../../../src/core/input/selection-ports.js';
import { EventBus } from '../../../src/core/events/event-bus.js';
import type { ViewTransform } from '../../../src/core/input/coordinate-transform.js';

describe('Interaction Patterns - Undo/Redo & Confirm (Story 003)', () => {
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
      originX: 0,
      originY: 0,
      tileSize: 10,
      boardWidth: 5,
      boardHeight: 5,
    };

    const getCurrentPhase = vi.fn().mockReturnValue('PlayerPhase');

    const machine = new SelectionStateMachine({
      board,
      eventBus,
      unitLookup,
      targetLegality,
      actionCommitter,
      getCurrentPhase,
      isAnimating: () => false,
      getView: () => view,
      config: { clickTolerancePx: 5, maxClickHoldMs: 500 }
    });

    const undo = vi.fn();
    const redo = vi.fn();
    const canUndo = vi.fn().mockReturnValue(true);
    const commitTurn = vi.fn();
    const endTurnWarning = vi.fn();
    const isHeroInTelegraph = vi.fn().mockReturnValue(false);

    const manager = new InputManager({
      machine,
      board,
      unitLookup,
      getView: () => view,
      undo,
      redo,
      canUndo,
      commitTurn,
      endTurnWarning,
      isHeroInTelegraph,
    });

    return { manager, machine, undo, redo, canUndo, commitTurn, endTurnWarning, isHeroInTelegraph };
  }

  it('Ctrl+Z requests undo when allowed', () => {
    const h = buildHarness();
    // Shift is false, Ctrl is true
    h.manager.onKeyDown('z', false, true, 0);
    expect(h.undo).toHaveBeenCalledOnce();
    expect(h.redo).not.toHaveBeenCalled();
  });

  it('Ctrl+Y requests redo when allowed', () => {
    const h = buildHarness();
    h.manager.onKeyDown('y', false, true, 0);
    expect(h.redo).toHaveBeenCalledOnce();
    expect(h.undo).not.toHaveBeenCalled();
  });

  it('Ctrl+Shift+Z requests redo when allowed', () => {
    const h = buildHarness();
    h.manager.onKeyDown('z', true, true, 0);
    expect(h.redo).toHaveBeenCalledOnce();
    expect(h.undo).not.toHaveBeenCalled();
  });

  it('Does not undo when canUndo returns false (e.g. across phase boundaries)', () => {
    const h = buildHarness();
    h.canUndo.mockReturnValue(false);
    h.manager.onKeyDown('z', false, true, 0);
    expect(h.undo).not.toHaveBeenCalled();
  });

  it('Space / EndTurn button requests turn commit', () => {
    const h = buildHarness();
    h.manager.onKeyDown(' ', false, false, 0);
    expect(h.commitTurn).toHaveBeenCalledOnce();
    
    h.manager.onKeyDown('EndTurn', false, false, 10);
    expect(h.commitTurn).toHaveBeenCalledTimes(2);
    expect(h.endTurnWarning).not.toHaveBeenCalled();
  });

  it('Space / EndTurn button throws soft confirm warning if hero in telegraph', () => {
    const h = buildHarness();
    h.isHeroInTelegraph.mockReturnValue(true);
    h.manager.onKeyDown(' ', false, false, 0);
    
    expect(h.endTurnWarning).toHaveBeenCalledOnce();
    expect(h.commitTurn).not.toHaveBeenCalled();
  });
});
