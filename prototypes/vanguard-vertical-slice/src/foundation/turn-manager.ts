// VERTICAL SLICE - NOT FOR PRODUCTION
import { EventBus } from './event-bus';

export type Phase = 'PlayerPhase' | 'EnemyResolve' | 'EndCheck';

export class TurnManager {
  currentTurn: number = 0;
  currentPhase: Phase = 'PlayerPhase';
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  startBattle(): void {
    this.currentTurn = 1;
    this.currentPhase = 'PlayerPhase';
    this.eventBus.emit('turn_started', { turnNumber: this.currentTurn });
    this.eventBus.emit('phase_changed', { phase: this.currentPhase });
  }

  advancePhase(): void {
    if (this.currentPhase === 'PlayerPhase') {
      this.currentPhase = 'EnemyResolve';
    } else if (this.currentPhase === 'EnemyResolve') {
      this.currentPhase = 'EndCheck';
    } else if (this.currentPhase === 'EndCheck') {
      this.currentTurn++;
      this.currentPhase = 'PlayerPhase';
      this.eventBus.emit('turn_started', { turnNumber: this.currentTurn });
    }
    
    this.eventBus.emit('phase_changed', { phase: this.currentPhase });
  }

  isPlayerPhase(): boolean {
    return this.currentPhase === 'PlayerPhase';
  }
}
