import type { Board } from '../../core/board/board-interface.js';
import type { Tile, Direction, UnitId } from '../../core/board/board-types.js';
import type { Unit } from './unit.js';

export type TargetFilter = 'Ally' | 'Enemy' | 'AnyUnit' | 'EmptyTile' | 'AnyTile';

export type ShapeType = 'Self' | 'SingleTile' | 'UnitTarget' | 'Line' | 'Area';

export interface AbilityShape {
  type: ShapeType;
  range: number;
  requiresOrthogonalAlignment?: boolean;
}

export interface AbilityDefinition {
  id: string;
  shape: AbilityShape;
  targetFilter: TargetFilter;
  excludesSelf?: boolean;
  effectTemplate?: import('./effect-compilation.js').EffectTemplateStep[];
}

export function legalTargets(
  caster: Unit,
  ability: AbilityDefinition,
  board: Board,
  getUnit: (id: UnitId) => Unit | null
): Tile[] {
  const { shape, targetFilter, excludesSelf } = ability;
  const origin = caster.position;
  let candidates: Tile[] = [];

  switch (shape.type) {
    case 'Self':
      candidates = [origin];
      break;
    case 'SingleTile':
    case 'UnitTarget':
    case 'Area':
      candidates = board.tilesInRange(origin, shape.range);
      break;
    case 'Line': {
      const dirs: Direction[] = ['N', 'S', 'E', 'W'];
      for (const d of dirs) {
        const firstStep = board.step(origin, d);
        if (board.classify(firstStep) === 'OutOfBounds') {
          continue; // completely exclude this direction if first step is OOB
        }
        
        // rayTiles stops before OutOfBounds or BlockedTerrain.
        const ray = board.rayTiles(origin, d, shape.range);
        candidates.push(...ray);
      }
      break;
    }
  }

  // Filter out self if excludesSelf is true
  if (excludesSelf) {
    candidates = candidates.filter(t => t.col !== origin.col || t.row !== origin.row);
  }

  // Apply requiresOrthogonalAlignment
  if (shape.requiresOrthogonalAlignment) {
    candidates = candidates.filter(t => t.col === origin.col || t.row === origin.row);
  }

  // Apply targetFilter
  return candidates.filter(t => {
    const isOccupied = board.isOccupied(t.col, t.row);
    const occupantId = isOccupied ? board.getOccupant(t.col, t.row) : null;
    const occupant = occupantId ? getUnit(occupantId) : null;

    if (occupant && board.getHazard(t.col, t.row) === 'Smoke') {
      if (targetFilter === 'Ally' || targetFilter === 'Enemy' || targetFilter === 'AnyUnit') {
        return false;
      }
    }

    switch (targetFilter) {
      case 'Ally':
        return occupant !== null && occupant.team === caster.team;
      case 'Enemy':
        return occupant !== null && occupant.team !== caster.team;
      case 'AnyUnit':
        return occupant !== null;
      case 'EmptyTile':
        return !isOccupied;
      case 'AnyTile':
        return true;
      default:
        return false;
    }
  });
}
