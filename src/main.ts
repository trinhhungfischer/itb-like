import { Application } from 'pixi.js';
import './feature/battle-hud/battle-hud.css';

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
}

bootstrap().catch(console.error);
