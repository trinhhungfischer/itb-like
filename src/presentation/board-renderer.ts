import { Container, Graphics } from 'pixi.js';
import type { Board } from '../core/board/board-interface.js';
import type { CombatEvent } from '../core/combat/combat-events.js';
import type { ViewTransform } from '../core/input/coordinate-transform.js';

export const MIN_TILE_SIZE = 32;
export const MAX_TILE_SIZE = 128;

import { tileToScreenCenter } from '../core/input/coordinate-transform.js';

/**
 * F1: Compute viewport fit
 * tileSize = floor( min(viewportWidth / grid_width, viewportHeight / grid_height) )
 * originX  = (viewportWidth  - tileSize * grid_width)  / 2
 * originY  = (viewportHeight - tileSize * grid_height) / 2
 */
export function computeViewportTransform(
  viewportWidth: number,
  viewportHeight: number,
  boardWidth: number,
  boardHeight: number
): ViewTransform {
  let tileSize = Math.floor(
    Math.min(viewportWidth / boardWidth, viewportHeight / boardHeight)
  );
  
  // Clamp to safe tuning knob ranges (min: 32, max: 128)
  tileSize = Math.max(MIN_TILE_SIZE, Math.min(MAX_TILE_SIZE, tileSize));
  
  const originX = (viewportWidth - tileSize * boardWidth) / 2;
  const originY = (viewportHeight - tileSize * boardHeight) / 2;
  
  return {
    originX,
    originY,
    tileSize,
    boardWidth,
    boardHeight
  };
}

export class BoardRenderer {
  public readonly container: Container;
  
  private backgroundLayer: Graphics;
  private terrainLayer: Graphics;
  private gridLinesLayer: Graphics;
  private hazardsLayer: Graphics;
  private entitiesLayer: Graphics;
  
  private currentTransform: ViewTransform | null = null;
  private currentViewport = { width: 0, height: 0 };
  
  private _isAnimating = false;

  // Tuning Knobs
  private readonly step_duration_ms = 120;
  private readonly flash_duration_ms = 120;

  constructor(private board: Board) {
    this.container = new Container();
    
    this.backgroundLayer = new Graphics();
    this.terrainLayer = new Graphics();
    this.gridLinesLayer = new Graphics();
    this.hazardsLayer = new Graphics();
    this.entitiesLayer = new Graphics();
    
    // Core Rule 2: Render layer stack (fixed z-order, back to front)
    // 1: Board background
    // 2: Terrain
    // 3: Grid lines
    // 4: Hazard
    // 7: Units/Entities (Skipping 5,6 for now)
    this.container.addChild(this.backgroundLayer);
    this.container.addChild(this.terrainLayer);
    this.container.addChild(this.gridLinesLayer);
    this.container.addChild(this.hazardsLayer);
    this.container.addChild(this.entitiesLayer);
  }
  
  public resize(viewportWidth: number, viewportHeight: number): void {
    this.currentViewport = { width: viewportWidth, height: viewportHeight };
    this.currentTransform = computeViewportTransform(
      viewportWidth, 
      viewportHeight, 
      this.board.width, 
      this.board.height
    );
    this.renderAll();
  }
  
  public get transform(): ViewTransform | null {
    return this.currentTransform;
  }
  
  public isAnimating(): boolean {
    return this._isAnimating;
  }
  
  public async playEvents(events: CombatEvent[]): Promise<void> {
    if (events.length === 0) return;
    
    this._isAnimating = true;
    
    for (const event of events) {
      if (event.type === 'displacement_complete') {
        const duration = this.step_duration_ms * Math.max(1, event.stepsMoved);
        await new Promise(resolve => setTimeout(resolve, duration));
      } else if (
        event.type === 'collision_resolved' || 
        event.type === 'damage_applied' || 
        event.type === 'hazard_applied'
      ) {
        await new Promise(resolve => setTimeout(resolve, this.flash_duration_ms));
      }
      // other events could be added here
    }
    
    // Core Rule 11: Render always mirrors Board occupancy after playback
    this.renderAll();
    
    this._isAnimating = false;
  }
  
  public renderAll(): void {
    if (!this.currentTransform) return;
    
    this.drawBackground();
    this.drawGridLines();
    this.drawTerrainAndHazards();
    this.drawEntities();
  }
  
  private drawBackground(): void {
    const { width, height } = this.currentViewport;
    this.backgroundLayer.clear();
    // Neutral low-saturation base fill for the whole viewport (letterbox bars included)
    this.backgroundLayer.rect(0, 0, width, height);
    this.backgroundLayer.fill({ color: 0x1A1A24 }); 
  }
  
  private drawGridLines(): void {
    const t = this.currentTransform!;
    this.gridLinesLayer.clear();
    
    const boardPxWidth = t.boardWidth * t.tileSize;
    const boardPxHeight = t.boardHeight * t.tileSize;
    
    // Subtle tile-boundary overlay. Opacity 0.15 per tuning knobs.
    const lineStyle = { width: 1, color: 0xffffff, alpha: 0.15 };
    
    for (let col = 0; col <= t.boardWidth; col++) {
      const x = t.originX + col * t.tileSize;
      this.gridLinesLayer.moveTo(x, t.originY);
      this.gridLinesLayer.lineTo(x, t.originY + boardPxHeight);
      this.gridLinesLayer.stroke(lineStyle);
    }
    
    for (let row = 0; row <= t.boardHeight; row++) {
      const y = t.originY + row * t.tileSize;
      this.gridLinesLayer.moveTo(t.originX, y);
      this.gridLinesLayer.lineTo(t.originX + boardPxWidth, y);
      this.gridLinesLayer.stroke(lineStyle);
    }
  }
  
  private drawTerrainAndHazards(): void {
    const t = this.currentTransform!;
    this.terrainLayer.clear();
    this.hazardsLayer.clear();
    
    for (let col = 0; col < t.boardWidth; col++) {
      for (let row = 0; row < t.boardHeight; row++) {
        const x = t.originX + col * t.tileSize;
        const y = t.originY + row * t.tileSize;
        
        const tileState = this.board.getTile(col, row);
        
        // Terrain layer
        let terrainColor = 0x2A2A35; // Normal terrain
        if (tileState.terrain === 'Blocked' || tileState.terrain === 'BlockedDestructible') {
          terrainColor = 0x4A4A5A;
        } else if (tileState.terrain === 'Chasm') {
          terrainColor = 0x0A0A10;
        } else if (tileState.terrain === 'Water') {
          terrainColor = 0x1A3A5A;
        }
        
        this.terrainLayer.rect(x, y, t.tileSize, t.tileSize);
        this.terrainLayer.fill({ color: terrainColor });
        
        // Hazard layer
        const hazard = this.board.getHazard(col, row);
        if (hazard) {
          let hazardColor = 0xFF5500; // Default hazard / Fire
          if (hazard === 'Acid') hazardColor = 0x00FF55;
          if (hazard === 'Ice') hazardColor = 0x55AAFF;
          if (hazard === 'Spikes') hazardColor = 0xAAAAAA;
          
          this.hazardsLayer.rect(x + 2, y + 2, t.tileSize - 4, t.tileSize - 4);
          this.hazardsLayer.fill({ color: hazardColor, alpha: 0.4 });
        }
      }
    }
  }

  private drawEntities(): void {
    const t = this.currentTransform!;
    this.entitiesLayer.clear();
    
    for (let col = 0; col < t.boardWidth; col++) {
      for (let row = 0; row < t.boardHeight; row++) {
        if (this.board.isOccupied(col, row)) {
          const occupantId = this.board.getOccupant(col, row);
          if (occupantId) {
            const center = tileToScreenCenter(col, row, t);
            
            // Draw a distinct circle for the unit centered in the tile
            // In a real implementation this would use a Sprite with the unit's texture
            const radius = (t.tileSize / 2) * 0.7; // 70% of half-tile size
            
            // Just a placeholder color (e.g. green for hero, red for enemy)
            // Since we just have the ID, we'll hash it loosely or just use a distinct color
            const entityColor = 0xFFD700; // Gold/Yellow for all entities for now
            
            this.entitiesLayer.circle(center.px, center.py, radius);
            this.entitiesLayer.fill({ color: entityColor });
            
            // Optional: Draw a small outline to make it pop
            this.entitiesLayer.stroke({ width: 2, color: 0xFFFFFF });
          }
        }
      }
    }
  }
}
