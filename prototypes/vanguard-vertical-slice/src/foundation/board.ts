// VERTICAL SLICE - NOT FOR PRODUCTION
import { AbilityDef } from './types';

export const GRID_WIDTH = 6;
export const GRID_HEIGHT = 6;

export interface UnitData {
  id: string;
  name: string;
  team: 'player' | 'enemy';
  hp: number;
  maxHp: number;
  col: number;
  row: number;
  abilities: AbilityDef[];
  hasMoved: boolean;
  hasActed: boolean;
  isAlive: boolean;
}

export interface TileData {
  col: number;
  row: number;
  terrain: 'normal' | 'wall' | 'hazard';
  hazardDamage: number;
  occupantId: string | null;
}

export interface BoardSnapshot {
  terrain: Uint8Array;
  hazardDamage: Uint8Array;
  occupants: (string | null)[];
  units: Record<string, UnitData>;
}

export class Board {
  private terrain: Uint8Array;
  private hazardDamage: Uint8Array;
  private occupants: (string | null)[];
  private units: Map<string, UnitData>;

  constructor() {
    const size = GRID_WIDTH * GRID_HEIGHT;
    this.terrain = new Uint8Array(size);
    this.hazardDamage = new Uint8Array(size);
    this.occupants = new Array(size).fill(null);
    this.units = new Map();
  }

  static index(col: number, row: number): number {
    return row * GRID_WIDTH + col;
  }

  static inBounds(col: number, row: number): boolean {
    return col >= 0 && col < GRID_WIDTH && row >= 0 && row < GRID_HEIGHT;
  }

  getTile(col: number, row: number): TileData {
    if (!Board.inBounds(col, row)) {
      throw new Error(`Out of bounds: ${col}, ${row}`);
    }
    const idx = Board.index(col, row);
    
    let terrainType: 'normal' | 'wall' | 'hazard' = 'normal';
    if (this.terrain[idx] === 1) terrainType = 'wall';
    else if (this.terrain[idx] === 2) terrainType = 'hazard';

    return {
      col,
      row,
      terrain: terrainType,
      hazardDamage: this.hazardDamage[idx],
      occupantId: this.occupants[idx]
    };
  }

  getUnit(id: string): UnitData | undefined {
    return this.units.get(id);
  }

  getUnitAt(col: number, row: number): UnitData | undefined {
    if (!Board.inBounds(col, row)) return undefined;
    const idx = Board.index(col, row);
    const occupantId = this.occupants[idx];
    if (occupantId) {
      return this.units.get(occupantId);
    }
    return undefined;
  }

  getAllUnits(): UnitData[] {
    return Array.from(this.units.values());
  }

  getTeamUnits(team: 'player' | 'enemy'): UnitData[] {
    return this.getAllUnits().filter(u => u.team === team);
  }

  setUnitPosition(id: string, col: number, row: number): void {
    const unit = this.units.get(id);
    if (!unit) return;
    if (!Board.inBounds(col, row)) return;

    // Clear old pos
    const oldIdx = Board.index(unit.col, unit.row);
    if (this.occupants[oldIdx] === id) {
      this.occupants[oldIdx] = null;
    }

    // Set new pos
    unit.col = col;
    unit.row = row;
    const newIdx = Board.index(col, row);
    this.occupants[newIdx] = id;
  }

  damageUnit(id: string, amount: number): void {
    const unit = this.units.get(id);
    if (!unit) return;
    
    unit.hp -= amount;
    if (unit.hp <= 0) {
      unit.hp = 0;
      this.killUnit(id);
    }
  }

  killUnit(id: string): void {
    const unit = this.units.get(id);
    if (!unit) return;
    
    unit.isAlive = false;
    const idx = Board.index(unit.col, unit.row);
    if (this.occupants[idx] === id) {
      this.occupants[idx] = null;
    }
  }

  spawnHazard(col: number, row: number, damage: number): void {
    if (!Board.inBounds(col, row)) return;
    const idx = Board.index(col, row);
    this.terrain[idx] = 2; // hazard
    this.hazardDamage[idx] = damage;
  }

  addUnit(unit: UnitData): void {
    this.units.set(unit.id, unit);
    if (Board.inBounds(unit.col, unit.row)) {
      const idx = Board.index(unit.col, unit.row);
      this.occupants[idx] = unit.id;
    }
  }

  snapshot(): BoardSnapshot {
    const unitsRecord: Record<string, UnitData> = {};
    for (const [id, unit] of this.units.entries()) {
      unitsRecord[id] = structuredClone(unit);
    }
    
    return {
      terrain: new Uint8Array(this.terrain),
      hazardDamage: new Uint8Array(this.hazardDamage),
      occupants: [...this.occupants],
      units: unitsRecord
    };
  }

  static fromSnapshot(snap: BoardSnapshot): Board {
    const board = new Board();
    board.terrain = new Uint8Array(snap.terrain);
    board.hazardDamage = new Uint8Array(snap.hazardDamage);
    board.occupants = [...snap.occupants];
    
    board.units = new Map();
    for (const [id, unit] of Object.entries(snap.units)) {
      board.units.set(id, structuredClone(unit));
    }
    
    return board;
  }

  getReachableTiles(col: number, row: number, range: number): Array<{col: number, row: number}> {
    const result: Array<{col: number, row: number}> = [];
    for (let r = -range; r <= range; r++) {
      for (let c = -range; c <= range; c++) {
        // Manhattan distance
        if (Math.abs(r) + Math.abs(c) <= range) {
          const targetCol = col + c;
          const targetRow = row + r;
          if (Board.inBounds(targetCol, targetRow)) {
            result.push({ col: targetCol, row: targetRow });
          }
        }
      }
    }
    return result;
  }
}
