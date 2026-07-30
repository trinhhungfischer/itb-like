import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { MovePreview } from '../../core/preview/move-preview.js';
import type { Board } from '../../core/board/board-interface.js';
import type { ViewTransform } from '../../core/input/coordinate-transform.js';
import { tileToScreenCenter } from '../../core/input/coordinate-transform.js';

export class MovePreviewOverlay {
  public readonly container: Container;

  constructor(
    private readonly preview: MovePreview,
    private readonly liveBoard: Board
  ) {
    this.container = new Container();
  }

  public render(transform: ViewTransform | null): void {
    this.container.removeChildren();
    if (!transform) return;

    const result = this.preview.getResult();
    if (!result) return;

    const previewBoard = result.previewBoard;

    // Scan for displacements (units that moved or spawned)
    for (let r2 = 0; r2 < previewBoard.height; r2++) {
      for (let c2 = 0; c2 < previewBoard.width; c2++) {
        const unitId = previewBoard.getOccupant(c2, r2);
        if (unitId) {
          // Find original position in liveBoard
          let c1 = -1;
          let r1 = -1;
          for (let r = 0; r < this.liveBoard.height; r++) {
            for (let c = 0; c < this.liveBoard.width; c++) {
              if (this.liveBoard.getOccupant(c, r) === unitId) {
                c1 = c;
                r1 = r;
                break;
              }
            }
            if (c1 !== -1) break;
          }

          if (c1 !== c2 || r1 !== r2) {
            // Unit moved or spawned
            const p2 = tileToScreenCenter(c2, r2, transform);

            // Draw ghost
            const ghost = new Graphics();
            ghost.circle(p2.x, p2.y, transform.tileSize * 0.4);
            ghost.fill({ color: 0xffaa00, alpha: 0.5 });
            this.container.addChild(ghost);

            if (c1 !== -1 && r1 !== -1) {
              // Draw path
              const p1 = tileToScreenCenter(c1, r1, transform);
              const path = new Graphics();
              path.moveTo(p1.x, p1.y);
              path.lineTo(p2.x, p2.y);
              path.stroke({ color: 0xffaa00, width: 4, alpha: 0.8 });
              this.container.addChild(path);
            }
          }
        }
      }
    }

    // Scan for damage and hazards
    for (const event of result.events) {
      if (event.type === 'damage_applied' || event.type === 'hazard_applied') {
        const targetId = event.type === 'damage_applied' ? event.targetId : event.unitId;
        
        // Find unit in previewBoard for text placement
        let tCol = -1;
        let tRow = -1;
        for (let r = 0; r < previewBoard.height; r++) {
          for (let c = 0; c < previewBoard.width; c++) {
            if (previewBoard.getOccupant(c, r) === targetId) {
              tCol = c;
              tRow = r;
              break;
            }
          }
          if (tCol !== -1) break;
        }

        if (tCol !== -1 && tRow !== -1) {
          const pt = tileToScreenCenter(tCol, tRow, transform);
          const style = new TextStyle({ fill: 0xff0000, fontSize: 24, fontWeight: 'bold' });
          const text = new Text({ text: `-${event.amount}`, style });
          text.anchor.set(0.5);
          text.position.set(pt.x, pt.y - transform.tileSize * 0.3);
          this.container.addChild(text);
        }
      } else if (event.type === 'collision_resolved') {
        // Draw collision indicator (e.g. an X or a flash) at the collision point
        // We can just use the target's current predicted location as the point of collision
        let tCol = -1;
        let tRow = -1;
        for (let r = 0; r < previewBoard.height; r++) {
          for (let c = 0; c < previewBoard.width; c++) {
            if (previewBoard.getOccupant(c, r) === event.a) {
              tCol = c;
              tRow = r;
              break;
            }
          }
          if (tCol !== -1) break;
        }

        if (tCol !== -1 && tRow !== -1 && event.collisionDamage > 0) {
          const pt = tileToScreenCenter(tCol, tRow, transform);
          const style = new TextStyle({ fill: 0xff8800, fontSize: 24, fontWeight: 'bold' });
          const text = new Text({ text: `Collision -${event.collisionDamage}`, style });
          text.anchor.set(0.5);
          text.position.set(pt.x, pt.y - transform.tileSize * 0.6);
          this.container.addChild(text);
        }
      }
    }
  }
}
