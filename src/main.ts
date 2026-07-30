import { Application } from 'pixi.js';
import './feature/battle-hud/battle-hud.css';
import './feature/battle-hud/zone-c.css';
import './feature/battle-hud/zone-d.css';
import './feature/battle-hud/inspect-panel.css';
import { BattleHud } from './feature/battle-hud/BattleHud';
import './feature/battle-hud/zone-c.css';

async function bootstrap() {
  console.log('Vanguard Engine booting...');

  const app = new Application();
  
  // Initialize PIXI application
  await app.init({ 
    width: window.innerWidth, 
    height: window.innerHeight, 
    backgroundColor: 0x1A1A24,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true
  });
  
  const canvasContainer = document.getElementById('pixi-canvas');
  if (canvasContainer) {
    canvasContainer.appendChild(app.canvas);
  }

  // Handle window resize
  window.addEventListener('resize', () => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
  });

  console.log('Renderer initialized. Waiting for UI layer...');

  const hud = new BattleHud();
  hud.populateRoster([
    { id: 'h1', name: 'Vanguard', hp: 120, maxHp: 150, abilityColorClass: 'ability-shove' },
    { id: 'h2', name: 'Aegis', hp: 80, maxHp: 80, abilityColorClass: 'ability-wall' },
    { id: 'h3', name: 'Specter', hp: 45, maxHp: 60, abilityColorClass: 'ability-swap' },
  ]);

  hud.populateThreats([
    { source: 'Goblin', intent: 'Strike (15)', isLethal: false },
    { source: 'Orc Boss', intent: 'Cleave (40)', isLethal: true }
  ]);

  hud.renderEnemyHpBars([
    { id: 'e1', hp: 20, maxHp: 50, x: 400, y: 300 },
    { id: 'e2', hp: 80, maxHp: 150, x: 600, y: 250 }
  ]);
}

bootstrap().catch(console.error);
