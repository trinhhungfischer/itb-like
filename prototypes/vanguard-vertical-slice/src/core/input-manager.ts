// VERTICAL SLICE - NOT FOR PRODUCTION
import { Board, EventBus, TurnManager, AbilityDef } from '../foundation';
import { CombatResolution, ActionIntent } from './combat-resolution';
import { MovePreview, PreviewResult } from './move-preview';

export type InputState = 'Idle' | 'UnitSelected' | 'Targeting' | 'Locked';

export class InputManager {
  state: InputState = 'Idle';
  selectedUnitId: string | null = null;
  selectedAbility: AbilityDef | null = null;
  hoveredCol: number = -1;
  hoveredRow: number = -1;
  validMoves: Array<{col: number, row: number}> = [];
  validTargets: Array<{col: number, row: number}> = [];
  currentPreview: PreviewResult | null = null;

  constructor(
    private board: Board,
    private combat: CombatResolution,
    private preview: MovePreview,
    private turnManager: TurnManager,
    private eventBus: EventBus
  ) {}

  handleClick(col: number, row: number): void {
    if (this.state === 'Locked') return;

    if (this.state === 'Idle') {
      const unit = this.board.getUnitAt(col, row);
      if (unit && unit.team === 'player' && !unit.hasActed && this.turnManager.isPlayerPhase()) {
        this.selectUnit(unit.id);
      }
    } else if (this.state === 'UnitSelected') {
      const isMove = this.validMoves.some(m => m.col === col && m.row === row);
      if (isMove && this.selectedUnitId) {
        this.combat.resolve({
          type: 'move',
          sourceUnitId: this.selectedUnitId,
          targetCol: col,
          targetRow: row
        });
        this.cancelSelection();
      } else {
        const unit = this.board.getUnitAt(col, row);
        if (unit && unit.team === 'player' && !unit.hasActed) {
          this.selectUnit(unit.id);
        } else {
          this.cancelSelection();
        }
      }
    } else if (this.state === 'Targeting') {
      const isTarget = this.validTargets.some(t => t.col === col && t.row === row);
      if (isTarget && this.selectedUnitId && this.selectedAbility) {
        this.combat.resolve({
          type: 'attack',
          sourceUnitId: this.selectedUnitId,
          targetCol: col,
          targetRow: row,
          abilityId: this.selectedAbility.id
        });
        
        const unit = this.board.getUnit(this.selectedUnitId);
        if (unit) unit.hasActed = true;
        
        this.cancelSelection();
      } else {
        this.cancelSelection();
      }
    }
  }

  handleHover(col: number, row: number): void {
    if (this.state === 'Locked') return;
    this.hoveredCol = col;
    this.hoveredRow = row;

    if (this.state === 'UnitSelected' && this.selectedUnitId) {
      const isMove = this.validMoves.some(m => m.col === col && m.row === row);
      if (isMove) {
        this.currentPreview = this.preview.preview(this.board, {
          type: 'move',
          sourceUnitId: this.selectedUnitId,
          targetCol: col,
          targetRow: row
        });
      } else {
        this.currentPreview = null;
      }
    } else if (this.state === 'Targeting' && this.selectedUnitId && this.selectedAbility) {
      const isTarget = this.validTargets.some(t => t.col === col && t.row === row);
      if (isTarget) {
        this.currentPreview = this.preview.preview(this.board, {
          type: 'attack',
          sourceUnitId: this.selectedUnitId,
          targetCol: col,
          targetRow: row,
          abilityId: this.selectedAbility.id
        });
      } else {
        this.currentPreview = null;
      }
    }
  }

  handleKeyDown(key: string): void {
    if (this.state === 'Locked') return;
    
    if (key === 'Escape') {
      this.cancelSelection();
    } else if (key === ' ' || key === 'Space') {
      this.endTurn();
    }
  }

  selectUnit(unitId: string): void {
    this.selectedUnitId = unitId;
    this.state = 'UnitSelected';
    this.validMoves = this.combat.getValidMoves(unitId);
    this.validTargets = [];
    this.selectedAbility = null;
    this.currentPreview = null;
    this.eventBus.emit('unit_selected', { unitId });
  }

  selectAbility(ability: AbilityDef): void {
    if (!this.selectedUnitId) return;
    this.selectedAbility = ability;
    this.state = 'Targeting';
    this.validTargets = this.combat.getValidTargets(this.selectedUnitId, ability);
    this.validMoves = [];
    this.currentPreview = null;
    this.eventBus.emit('ability_selected', { abilityId: ability.id });
  }

  commitAction(): void {
    // Usually triggered via handleClick
  }

  cancelSelection(): void {
    this.state = 'Idle';
    this.selectedUnitId = null;
    this.selectedAbility = null;
    this.validMoves = [];
    this.validTargets = [];
    this.currentPreview = null;
    this.eventBus.emit('selection_cancelled', {});
  }

  endTurn(): void {
    this.cancelSelection();
    this.turnManager.advancePhase();
  }
}
