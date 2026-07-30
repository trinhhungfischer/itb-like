import { Container, Graphics } from 'pixi.js';
import type { Board } from '../core/board/board-interface.js';
import type { ViewTransform } from '../core/input/coordinate-transform.js';

export const MIN_TILE_SIZE = 32;
export const MAX_TILE_SIZE = 128;

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
  
  private currentTransform: ViewTransform | null = null;
  private currentViewport = { width: 0, height: 0 };

  constructor(private board: Board) {
    this.container = new Container();
    
    this.backgroundLayer = new Graphics();
    this.terrainLayer = new Graphics();
    this.gridLinesLayer = new Graphics();
    this.hazardsLayer = new Graphics();
    
    // Core Rule 2: Render layer stack (fixed z-order, back to front)
    // 1: Board background
    // 2: Terrain
    // 3: Grid lines
    // 4: Hazard
    this.container.addChild(this.backgroundLayer);
    this.container.addChild(this.terrainLayer);
    this.container.addChild(this.gridLinesLayer);
    this.container.addChild(this.hazardsLayer);
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
  
  public renderAll(): void {
    if (!this.currentTransform) return;
    
    this.drawBackground();
    this.drawGridLines();
    this.drawTerrainAndHazards();
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
}
