import type { Board } from '../../core/board/board-interface.js';
import type { UnitLookup } from '../../core/input/selection-ports.js';
import type { SelectionStateMachine } from '../../core/input/selection-state-machine.js';
import { screenToTile, tileToScreenCenter } from '../../core/input/coordinate-transform.js';
import type { ViewTransform } from '../../core/input/coordinate-transform.js';

export interface InputManagerDeps {
  machine: SelectionStateMachine;
  board: Board;
  unitLookup: UnitLookup;
  getView: () => ViewTransform;
  undo?: () => void;
  redo?: () => void;
  canUndo?: () => boolean;
  commitTurn?: () => void;
  endTurnWarning?: () => void;
  isHeroInTelegraph?: () => boolean;
}

/**
 * Presentation layer InputManager.
 * Wires raw input events (keyboard, pointer) to the core SelectionStateMachine.
 * Handles "Tab/Shift-Tab" hero cycling by emulating a click on the next hero's tile.
 */
export class InputManager {
  constructor(private deps: InputManagerDeps) {}

  onPointerDown(px: number, py: number, timestamp: number): void {
    this.deps.machine.pointerDown({ px, py }, timestamp);
  }

  onPointerUp(px: number, py: number, timestamp: number): void {
    this.deps.machine.pointerUp({ px, py }, timestamp);
  }

  onPointerMove(px: number, py: number): void {
    const tile = screenToTile(px, py, this.deps.getView());
    this.deps.machine.hoverTile(tile);
  }

  onKeyDown(key: string, shiftKey: boolean, ctrlKey: boolean, timestamp: number): void {
    if (key === 'Tab') {
      this.cycleHero(shiftKey ? -1 : 1, timestamp);
    } else if (key === 'Escape') {
      this.deps.machine.escape();
    } else if (key === 'z' && (shiftKey === false) && ctrlKey) {
      if (this.deps.canUndo?.() !== false) {
        this.deps.undo?.();
      }
    } else if (key === 'y' && ctrlKey) {
      if (this.deps.canUndo?.() !== false) {
        this.deps.redo?.();
      }
    } else if (key === 'z' && shiftKey === true && ctrlKey) { // Ctrl+Shift+Z
      if (this.deps.canUndo?.() !== false) {
        this.deps.redo?.();
      }
    } else if (key === ' ' || key === 'EndTurn') {
      if (this.deps.isHeroInTelegraph?.()) {
        this.deps.endTurnWarning?.();
      } else {
        this.deps.commitTurn?.();
      }
    }
  }

  private cycleHero(direction: 1 | -1, timestamp: number): void {
    const heroes = this.getLivingHeroes();
    if (heroes.length === 0) return;

    const state = this.deps.machine.getState();
    let currentIndex = -1;

    if (state.status === 'UnitSelected' || state.status === 'Targeting' || state.status === 'Inspect') {
      const activeId = (state as any).unitId;
      currentIndex = heroes.findIndex(h => h.id === activeId);
    }

    let nextIndex = 0;
    if (currentIndex !== -1) {
       nextIndex = (currentIndex + direction + heroes.length) % heroes.length;
    }
    
    const nextHero = heroes[nextIndex];
    if (nextHero) {
       // Emulate click on next hero's tile to select it
       const center = tileToScreenCenter(nextHero.tile.col, nextHero.tile.row, this.deps.getView());
       // Simulate a quick click (down then up within tolerance)
       this.deps.machine.pointerDown(center, timestamp);
       this.deps.machine.pointerUp(center, timestamp + 1);
    }
  }

  private getLivingHeroes(): Array<{id: string, tile: {col: number, row: number}}> {
    const heroes = [];
    for (let row = 0; row < this.deps.board.height; row++) {
      for (let col = 0; col < this.deps.board.width; col++) {
         const occupant = this.deps.board.getOccupant(col, row);
         if (occupant) {
           const info = this.deps.unitLookup.unitAt({col, row}, this.deps.board);
           // Only cycle through eligible living heroes
           if (info && info.team === 'hero' && info.actingEligible) {
             heroes.push({ id: occupant, tile: {col, row} });
           }
         }
      }
    }
    return heroes;
  }
}
