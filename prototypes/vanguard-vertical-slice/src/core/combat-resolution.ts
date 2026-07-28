// VERTICAL SLICE - NOT FOR PRODUCTION
import { Board, EventBus, AbilityDef } from '../foundation';

export interface ActionIntent {
  type: 'move' | 'attack';
  sourceUnitId: string;
  targetCol: number;
  targetRow: number;
  abilityId?: string;
}

export interface GameEvent {
  type: string;
  payload: any;
}

export interface ResolveResult {
  success: boolean;
  events: GameEvent[];
  error?: string;
}

export class CombatResolution {
  constructor(private board: Board, private eventBus: EventBus) {}

  resolve(intent: ActionIntent): ResolveResult {
    const unit = this.board.getUnit(intent.sourceUnitId);
    if (!unit) return { success: false, events: [], error: 'Unit not found' };

    const events: GameEvent[] = [];

    if (intent.type === 'move') {
      const validMoves = this.getValidMoves(unit.id);
      const isValid = validMoves.some(m => m.col === intent.targetCol && m.row === intent.targetRow);
      
      if (!isValid) {
        return { success: false, events, error: 'Invalid move target' };
      }

      this.board.setUnitPosition(unit.id, intent.targetCol, intent.targetRow);
      const payload = { unitId: unit.id, col: intent.targetCol, row: intent.targetRow };
      this.eventBus.emit('unit_moved', payload);
      events.push({ type: 'unit_moved', payload });

      return { success: true, events };
    }

    if (intent.type === 'attack') {
      const ability = intent.abilityId 
        ? unit.abilities.find(a => a.id === intent.abilityId) 
        : unit.abilities[0];

      if (!ability) {
        return { success: false, events, error: 'No ability available' };
      }

      const validTargets = this.getValidTargets(unit.id, ability);
      const isValid = validTargets.some(t => t.col === intent.targetCol && t.row === intent.targetRow);

      if (!isValid) {
        return { success: false, events, error: 'Invalid attack target' };
      }

      const targetUnit = this.board.getUnitAt(intent.targetCol, intent.targetRow);
      if (targetUnit) {
        // 1. damage
        if (ability.damage > 0) {
          this.board.damageUnit(targetUnit.id, ability.damage);
          const dmgPayload = { unitId: targetUnit.id, damage: ability.damage, newHp: targetUnit.hp };
          this.eventBus.emit('unit_damaged', dmgPayload);
          events.push({ type: 'unit_damaged', payload: dmgPayload });

          if (!targetUnit.isAlive) {
            const deathPayload = { unitId: targetUnit.id };
            this.eventBus.emit('unit_died', deathPayload);
            events.push({ type: 'unit_died', payload: deathPayload });
          }
        }

        // 2. push
        const extAbility = ability as any;
        if (extAbility.push && targetUnit.isAlive) {
          const dirCol = Math.sign(targetUnit.col - unit.col);
          const dirRow = Math.sign(targetUnit.row - unit.row);
          
          const pushCol = targetUnit.col + dirCol;
          const pushRow = targetUnit.row + dirRow;

          if (Board.inBounds(pushCol, pushRow)) {
            const occupant = this.board.getUnitAt(pushCol, pushRow);
            const tile = this.board.getTile(pushCol, pushRow);
            if (!occupant && tile.terrain !== 'wall') {
              this.board.setUnitPosition(targetUnit.id, pushCol, pushRow);
              const pushPayload = { unitId: targetUnit.id, col: pushCol, row: pushRow };
              this.eventBus.emit('unit_pushed', pushPayload);
              events.push({ type: 'unit_pushed', payload: pushPayload });
            }
          }
        }
      }

      // 3. spawnHazard
      const extAbility2 = ability as any;
      if (extAbility2.spawnHazard) {
        this.board.spawnHazard(intent.targetCol, intent.targetRow, extAbility2.hazardDamage || 1);
        const hazPayload = { col: intent.targetCol, row: intent.targetRow, damage: extAbility2.hazardDamage || 1 };
        this.eventBus.emit('hazard_spawned', hazPayload);
        events.push({ type: 'hazard_spawned', payload: hazPayload });
      }

      return { success: true, events };
    }

    return { success: false, events, error: 'Unknown intent type' };
  }

  getValidMoves(unitId: string): Array<{col: number, row: number}> {
    const unit = this.board.getUnit(unitId);
    if (!unit) return [];

    const moves: Array<{col: number, row: number}> = [];
    const tiles = this.board.getReachableTiles(unit.col, unit.row, 2); // default range for prototype
    
    for (const t of tiles) {
      const occupant = this.board.getUnitAt(t.col, t.row);
      const tileData = this.board.getTile(t.col, t.row);
      if (!occupant && tileData.terrain !== 'wall') {
        moves.push(t);
      }
    }
    
    return moves;
  }

  getValidTargets(unitId: string, ability: AbilityDef): Array<{col: number, row: number}> {
    const unit = this.board.getUnit(unitId);
    if (!unit) return [];

    return this.board.getReachableTiles(unit.col, unit.row, ability.range);
  }
}
