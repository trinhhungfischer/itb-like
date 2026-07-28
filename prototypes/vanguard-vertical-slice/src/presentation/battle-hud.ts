// VERTICAL SLICE - NOT FOR PRODUCTION
import { Board, EventBus, TurnManager } from '../foundation';
import { InputManager } from '../core/input-manager';

export class BattleHud {
  private container: HTMLElement;
  private turnDisplay: HTMLElement;
  private rosterPanel: HTMLElement;
  private endTurnBtn: HTMLButtonElement;
  private overlay: HTMLElement;

  constructor(
    private board: Board,
    private turnManager: TurnManager,
    private inputManager: InputManager,
    private eventBus: EventBus
  ) {
    this.container = document.createElement('div');
    this.container.style.position = 'absolute';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '800px';
    this.container.style.height = '600px';
    this.container.style.pointerEvents = 'none';
    this.container.style.color = '#F0F0F5';
    this.container.style.fontFamily = 'sans-serif';

    this.turnDisplay = document.createElement('div');
    this.turnDisplay.style.position = 'absolute';
    this.turnDisplay.style.top = '10px';
    this.turnDisplay.style.left = '10px';
    this.turnDisplay.style.padding = '10px';
    this.turnDisplay.style.backgroundColor = '#222230';
    this.turnDisplay.style.borderRadius = '5px';
    this.container.appendChild(this.turnDisplay);

    this.rosterPanel = document.createElement('div');
    this.rosterPanel.style.position = 'absolute';
    this.rosterPanel.style.bottom = '10px';
    this.rosterPanel.style.left = '10px';
    this.rosterPanel.style.padding = '10px';
    this.rosterPanel.style.backgroundColor = '#222230';
    this.rosterPanel.style.borderRadius = '5px';
    this.rosterPanel.style.pointerEvents = 'auto';
    this.container.appendChild(this.rosterPanel);

    this.endTurnBtn = document.createElement('button');
    this.endTurnBtn.innerText = 'End Turn';
    this.endTurnBtn.style.position = 'absolute';
    this.endTurnBtn.style.bottom = '10px';
    this.endTurnBtn.style.right = '10px';
    this.endTurnBtn.style.padding = '10px 20px';
    this.endTurnBtn.style.pointerEvents = 'auto';
    this.endTurnBtn.style.backgroundColor = '#222230';
    this.endTurnBtn.style.color = '#F0F0F5';
    this.endTurnBtn.style.border = '1px solid #7A7A99';
    this.endTurnBtn.style.cursor = 'pointer';
    this.endTurnBtn.onclick = () => {
      if (this.turnManager.isPlayerPhase()) {
        this.inputManager.endTurn();
      }
    };
    this.container.appendChild(this.endTurnBtn);

    this.overlay = document.createElement('div');
    this.overlay.style.position = 'absolute';
    this.overlay.style.top = '0';
    this.overlay.style.left = '0';
    this.overlay.style.width = '100%';
    this.overlay.style.height = '100%';
    this.overlay.style.display = 'none';
    this.overlay.style.justifyContent = 'center';
    this.overlay.style.alignItems = 'center';
    this.overlay.style.backgroundColor = 'rgba(0,0,0,0.7)';
    this.overlay.style.fontSize = '48px';
    this.overlay.style.pointerEvents = 'auto';
    this.container.appendChild(this.overlay);

    this.eventBus.on('phase_changed', () => this.update());
    this.eventBus.on('unit_selected', () => this.update());
    this.eventBus.on('ability_selected', () => this.update());
    this.eventBus.on('selection_cancelled', () => this.update());
    this.eventBus.on('unit_damaged', () => this.update());
    this.eventBus.on('unit_moved', () => this.update());
    this.eventBus.on('turn_started', () => this.update());
  }

  createElements(): HTMLElement {
    return this.container;
  }

  update(): void {
    this.turnDisplay.innerText = `Turn ${this.turnManager.currentTurn} - ${this.turnManager.currentPhase}`;
    
    this.rosterPanel.innerHTML = '';
    const heroes = this.board.getTeamUnits('player');
    
    for (const hero of heroes) {
      const div = document.createElement('div');
      div.innerText = `${hero.name} HP: ${hero.hp}/${hero.maxHp}`;
      
      const isSelected = this.inputManager.selectedUnitId === hero.id;
      if (isSelected) {
        div.style.color = '#4488FF';
      }

      if (isSelected && this.turnManager.isPlayerPhase()) {
        const abDiv = document.createElement('div');
        for (const ability of hero.abilities) {
          const btn = document.createElement('button');
          btn.innerText = ability.name;
          btn.style.margin = '5px';
          btn.style.backgroundColor = ability.name === 'Strike' ? '#FF3333' : '#FF8800';
          btn.style.color = 'white';
          btn.style.border = 'none';
          btn.style.padding = '5px 10px';
          btn.style.cursor = 'pointer';
          
          if (this.inputManager.selectedAbility?.id === ability.id) {
            btn.style.outline = '2px solid white';
          }
          
          btn.onclick = () => {
            this.inputManager.selectAbility(ability);
          };
          abDiv.appendChild(btn);
        }
        div.appendChild(abDiv);
      }
      
      this.rosterPanel.appendChild(div);
    }
  }

  showVictory(): void {
    this.overlay.style.display = 'flex';
    this.overlay.innerText = 'VICTORY';
    this.overlay.style.color = '#44FF44';
  }

  showDefeat(): void {
    this.overlay.style.display = 'flex';
    this.overlay.innerText = 'DEFEAT';
    this.overlay.style.color = '#FF4444';
  }
}
