// VERTICAL SLICE - NOT FOR PRODUCTION
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Board, EventBus, GRID_WIDTH, GRID_HEIGHT } from '../foundation';
import { PreviewResult } from '../core/move-preview';
import { EnemyIntent } from '../content/enemy-data';

const TILE_SIZE = 80;
const TILE_GAP = 2;
const FULL_TILE = TILE_SIZE + TILE_GAP;

export class BoardRenderer {
  container: Container;
  private highlightLayer: Container;
  private unitLayer: Container;
  private uiLayer: Container;

  constructor(private app: Application, private board: Board, private eventBus: EventBus) {
    this.container = new Container();
    
    const gridLayer = new Container();
    for (let row = 0; row < GRID_HEIGHT; row++) {
      for (let col = 0; col < GRID_WIDTH; col++) {
        const bg = new Graphics();
        bg.rect(col * FULL_TILE, row * FULL_TILE, TILE_SIZE, TILE_SIZE);
        bg.fill({ color: 0x2A2A3A });
        gridLayer.addChild(bg);
      }
    }
    this.container.addChild(gridLayer);

    this.highlightLayer = new Container();
    this.container.addChild(this.highlightLayer);

    this.unitLayer = new Container();
    this.container.addChild(this.unitLayer);

    this.uiLayer = new Container();
    this.container.addChild(this.uiLayer);
  }

  pixelToGrid(x: number, y: number): {col: number, row: number} | null {
    const col = Math.floor(x / FULL_TILE);
    const row = Math.floor(y / FULL_TILE);
    if (col >= 0 && col < GRID_WIDTH && row >= 0 && row < GRID_HEIGHT) {
      return { col, row };
    }
    return null;
  }

  render(): void {
    this.unitLayer.removeChildren();

    for (let row = 0; row < GRID_HEIGHT; row++) {
      for (let col = 0; col < GRID_WIDTH; col++) {
        const tile = this.board.getTile(col, row);
        if (tile.terrain === 'wall' || tile.terrain === 'hazard') {
            const g = new Graphics();
            g.rect(col * FULL_TILE, row * FULL_TILE, TILE_SIZE, TILE_SIZE);
            if (tile.terrain === 'wall') g.fill({ color: 0x4A4A5A });
            if (tile.terrain === 'hazard') g.fill({ color: 0xFF3333, alpha: 0.4 });
            this.unitLayer.addChild(g);
        }
      }
    }

    const units = this.board.getAllUnits().filter(u => u.isAlive);
    for (const unit of units) {
      const g = new Graphics();
      const cx = unit.col * FULL_TILE + TILE_SIZE / 2;
      const cy = unit.row * FULL_TILE + TILE_SIZE / 2;
      
      g.circle(cx, cy, TILE_SIZE / 2 - 10);
      g.fill({ color: unit.team === 'player' ? 0x4488FF : 0xFF4444 });
      this.unitLayer.addChild(g);

      const style = new TextStyle({ fill: 0xffffff, fontSize: 20, fontWeight: 'bold' });
      const hpText = new Text({ text: `${unit.hp}`, style });
      hpText.anchor.set(0.5);
      hpText.position.set(cx, cy);
      this.unitLayer.addChild(hpText);
    }
  }

  showMoveHighlights(tiles: Array<{col: number, row: number}>): void {
    this.clearHighlights();
    for (const t of tiles) {
      const g = new Graphics();
      g.rect(t.col * FULL_TILE, t.row * FULL_TILE, TILE_SIZE, TILE_SIZE);
      g.fill({ color: 0x44FF44, alpha: 0.25 });
      this.highlightLayer.addChild(g);
    }
  }

  showTargetHighlights(tiles: Array<{col: number, row: number}>): void {
    this.clearHighlights();
    for (const t of tiles) {
      const g = new Graphics();
      g.rect(t.col * FULL_TILE, t.row * FULL_TILE, TILE_SIZE, TILE_SIZE);
      g.fill({ color: 0xFF8800, alpha: 0.4 });
      this.highlightLayer.addChild(g);
    }
  }

  clearHighlights(): void {
    this.highlightLayer.removeChildren();
  }

  showPreview(preview: PreviewResult): void {
    this.uiLayer.removeChildren();
    for (const change of preview.unitChanges) {
      if (change.hpAfter < change.hpBefore) {
        const style = new TextStyle({ fill: 0xff0000, fontSize: 24, fontWeight: 'bold' });
        const text = new Text({ text: `-${change.hpBefore - change.hpAfter}`, style });
        text.anchor.set(0.5);
        text.position.set(change.posBefore.col * FULL_TILE + TILE_SIZE/2, change.posBefore.row * FULL_TILE + TILE_SIZE/4);
        this.uiLayer.addChild(text);
      }
      
      if (change.posBefore.col !== change.posAfter.col || change.posBefore.row !== change.posAfter.row) {
        const g = new Graphics();
        g.moveTo(change.posBefore.col * FULL_TILE + TILE_SIZE/2, change.posBefore.row * FULL_TILE + TILE_SIZE/2);
        g.lineTo(change.posAfter.col * FULL_TILE + TILE_SIZE/2, change.posAfter.row * FULL_TILE + TILE_SIZE/2);
        g.stroke({ color: 0xffaa00, width: 4, alpha: 0.8 });
        this.uiLayer.addChild(g);
      }
    }
  }

  clearPreview(): void {
    this.uiLayer.removeChildren();
  }

  showTelegraphs(intents: EnemyIntent[]): void {
    for (const intent of intents) {
      const g = new Graphics();
      g.rect(intent.col * FULL_TILE, intent.row * FULL_TILE, TILE_SIZE, TILE_SIZE);
      g.fill({ color: 0xFF5555, alpha: 0.25 });
      this.highlightLayer.addChild(g);
    }
  }
}
