// VERTICAL SLICE - NOT FOR PRODUCTION
import { Board, EventBus, TurnManager } from '../foundation';
import { CombatResolution } from './combat-resolution';
import { generateEnemyIntent } from '../content/enemy-data';

export class EnemyAI {
  constructor(
    private board: Board,
    private combat: CombatResolution,
    private turnManager: TurnManager,
    private eventBus: EventBus
  ) {
    this.eventBus.on('phase_changed', (payload: any) => {
      if (payload.phase === 'EnemyResolve') {
        this.executeEnemyTurn();
      }
    });
  }

  executeEnemyTurn(): void {
    const enemies = this.board.getTeamUnits('enemy').filter(e => e.isAlive);
    for (const enemy of enemies) {
      const intent = generateEnemyIntent(enemy, this.board);
      
      const dist = Math.abs(intent.col - enemy.col) + Math.abs(intent.row - enemy.row);
      if (dist === 1 && enemy.abilities.length > 0) {
        this.combat.resolve({
          type: 'attack',
          sourceUnitId: enemy.id,
          targetCol: intent.col,
          targetRow: intent.row,
          abilityId: enemy.abilities[0].id
        });
      } else {
        const validMoves = this.combat.getValidMoves(enemy.id);
        let bestMove = { col: enemy.col, row: enemy.row };
        let minDistance = Math.abs(intent.col - enemy.col) + Math.abs(intent.row - enemy.row); // current distance
        
        for (const move of validMoves) {
          const d = Math.abs(move.col - intent.col) + Math.abs(move.row - intent.row);
          if (d < minDistance) {
            minDistance = d;
            bestMove = move;
          }
        }
        
        if (bestMove.col !== enemy.col || bestMove.row !== enemy.row) {
          this.combat.resolve({
            type: 'move',
            sourceUnitId: enemy.id,
            targetCol: bestMove.col,
            targetRow: bestMove.row
          });
        }
      }
    }
    
    setTimeout(() => {
      this.turnManager.advancePhase();
    }, 500);
  }
}
