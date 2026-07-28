// VERTICAL SLICE - NOT FOR PRODUCTION
import { Application } from 'pixi.js';
import { Board, EventBus, TurnManager } from './foundation';
import { CombatResolution, InputManager, MovePreview } from './core';
import { setupBattle } from './content/battle-setup';
import { BoardRenderer } from './presentation/board-renderer';
import { BattleHud } from './presentation/battle-hud';
import { EnemyAI } from './core/enemy-ai';
import { generateEnemyIntent } from './content/enemy-data';

async function init() {
  const app = new Application();
  await app.init({ width: 800, height: 600, backgroundColor: 0x1A1A24 });
  
  // Set body margins and overflow to display correctly
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  document.body.appendChild(app.canvas);

  const eventBus = new EventBus();
  const board = new Board();
  
  setupBattle(board);

  const turnManager = new TurnManager(eventBus);
  const combat = new CombatResolution(board, eventBus);
  const preview = new MovePreview();
  const inputManager = new InputManager(board, combat, preview, turnManager, eventBus);
  const enemyAI = new EnemyAI(board, combat, turnManager, eventBus);

  const renderer = new BoardRenderer(app, board, eventBus);
  app.stage.addChild(renderer.container);
  
  // Center the board roughly
  renderer.container.position.set(150, 50);

  const hud = new BattleHud(board, turnManager, inputManager, eventBus);
  const hudElement = hud.createElements();
  document.body.appendChild(hudElement);

  // Reset actions on phase change
  eventBus.on('phase_changed', (payload: any) => {
    if (payload.phase === 'PlayerPhase') {
      for (const unit of board.getTeamUnits('player')) {
        unit.hasActed = false;
        unit.hasMoved = false;
      }
    } else if (payload.phase === 'EnemyResolve') {
      for (const unit of board.getTeamUnits('enemy')) {
        unit.hasActed = false;
        unit.hasMoved = false;
      }
    }
  });

  // Interaction
  app.canvas.addEventListener('pointermove', (e: PointerEvent) => {
    const rect = app.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - renderer.container.x;
    const y = e.clientY - rect.top - renderer.container.y;
    const gridPos = renderer.pixelToGrid(x, y);
    if (gridPos) {
      inputManager.handleHover(gridPos.col, gridPos.row);
    }
  });

  app.canvas.addEventListener('pointerdown', (e: PointerEvent) => {
    const rect = app.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - renderer.container.x;
    const y = e.clientY - rect.top - renderer.container.y;
    const gridPos = renderer.pixelToGrid(x, y);
    if (gridPos) {
      inputManager.handleClick(gridPos.col, gridPos.row);
    }
  });

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    inputManager.handleKeyDown(e.key);
  });

  app.ticker.add(() => {
    renderer.render();

    if (inputManager.state === 'UnitSelected') {
      renderer.showMoveHighlights(inputManager.validMoves);
    } else if (inputManager.state === 'Targeting') {
      renderer.showTargetHighlights(inputManager.validTargets);
    } else {
      renderer.clearHighlights();
    }

    // Show enemy telegraphs if player phase and idle
    if (turnManager.isPlayerPhase()) {
      const enemies = board.getTeamUnits('enemy').filter(e => e.isAlive);
      const intents = enemies.map(e => generateEnemyIntent(e, board));
      renderer.showTelegraphs(intents);
    }

    if (inputManager.currentPreview) {
      renderer.showPreview(inputManager.currentPreview);
    } else {
      renderer.clearPreview();
    }

    const heroes = board.getTeamUnits('player').filter(h => h.isAlive);
    const enemiesLeft = board.getTeamUnits('enemy').filter(e => e.isAlive);
    
    if (heroes.length === 0) {
      hud.showDefeat();
      inputManager.state = 'Locked';
    } else if (enemiesLeft.length === 0) {
      hud.showVictory();
      inputManager.state = 'Locked';
    }
  });

  hud.update();
  turnManager.startBattle();
}

init();
