// VERTICAL SLICE - NOT FOR PRODUCTION
import { Board, BoardSnapshot, EventBus } from '../foundation';
import { ActionIntent, CombatResolution, GameEvent } from './combat-resolution';

export interface PreviewResult {
  originalBoard: BoardSnapshot;
  resultBoard: BoardSnapshot;
  events: GameEvent[];
  unitChanges: Array<{
    unitId: string;
    hpBefore: number;
    hpAfter: number;
    posBefore: {col: number, row: number};
    posAfter: {col: number, row: number};
    died: boolean;
  }>;
}

export class MovePreview {
  preview(board: Board, intent: ActionIntent): PreviewResult {
    // 1. Take snapshot
    const originalBoard = board.snapshot();
    
    // 2. Clone board
    const simBoard = Board.fromSnapshot(originalBoard);
    
    // 3. Silent bus
    const silentBus = new EventBus();
    
    // 4. Sandbox combat resolution
    const simCombat = new CombatResolution(simBoard, silentBus);
    
    // 5. Resolve
    const result = simCombat.resolve(intent);
    
    // 6. Diff
    const resultBoard = simBoard.snapshot();
    
    const unitChanges: PreviewResult['unitChanges'] = [];
    for (const [unitId, origUnit] of Object.entries(originalBoard.units)) {
      const newUnit = resultBoard.units[unitId];
      if (newUnit) {
        if (
          origUnit.hp !== newUnit.hp || 
          origUnit.col !== newUnit.col || 
          origUnit.row !== newUnit.row || 
          origUnit.isAlive !== newUnit.isAlive
        ) {
          unitChanges.push({
            unitId,
            hpBefore: origUnit.hp,
            hpAfter: newUnit.hp,
            posBefore: { col: origUnit.col, row: origUnit.row },
            posAfter: { col: newUnit.col, row: newUnit.row },
            died: !newUnit.isAlive
          });
        }
      }
    }

    return {
      originalBoard,
      resultBoard,
      events: result.events,
      unitChanges
    };
  }
}
