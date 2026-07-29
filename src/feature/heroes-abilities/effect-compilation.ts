import type { Board } from '../../core/board/board-interface.js';
import type { Tile, Direction, UnitId, HazardType, TerrainType } from '../../core/board/board-types.js';
import type { Unit } from './unit.js';
import type { AbilityDefinition, ShapeType } from './ability-targeting.js';
import type { EffectPrimitive } from '../../core/combat/combat-types.js';

export type EffectTemplateStep =
  | { kind: 'push'; distance: number }
  | { kind: 'pull'; distance: number }
  | { kind: 'damage'; amount: number }
  | { kind: 'spawnHazard'; hazardType: HazardType; duration?: number }
  | { kind: 'applyHazard' }
  | { kind: 'setTerrain'; terrainType: TerrainType }
  | { kind: 'swap' }
  | { kind: 'spawnUnit'; unitSpec: import('../../core/combat/combat-types.js').UnitSpec }
  ;

function getDirection(from: Tile, to: Tile): Direction {
  if (to.row < from.row) return 'N';
  if (to.row > from.row) return 'S';
  if (to.col > from.col) return 'E';
  if (to.col < from.col) return 'W';
  return 'N'; // Fallback
}

export function compileEffects(
  caster: Unit,
  ability: AbilityDefinition,
  targetTile: Tile,
  board: Board,
  getUnit: (id: UnitId) => Unit | null
): EffectPrimitive[] {
  const primitives: EffectPrimitive[] = [];
  const origin = caster.position;

  // Determine affected tiles based on shape and targetTile
  let affectedTiles: Tile[] = [];
  
  if (ability.shape.type === 'Line') {
    const dir = getDirection(origin, targetTile);
    affectedTiles = board.rayTiles(origin, dir, ability.shape.range);
  } else if (ability.shape.type === 'Area') {
    // Basic area implementation, typically area around target or origin
    // But targetTile is provided. We assume area around targetTile for now, or just the target itself.
    // Story says "Line abilities".
    affectedTiles = board.tilesInRange(targetTile, ability.shape.range);
  } else {
    // SingleTile, UnitTarget, Self
    affectedTiles = [targetTile];
  }

  // Filter affected tiles based on targetFilter
  const qualifyingTiles = affectedTiles.filter(t => {
    const isOccupied = board.isOccupied(t.col, t.row);
    const occupantId = isOccupied ? board.getOccupant(t.col, t.row) : null;
    const occupant = occupantId ? getUnit(occupantId) : null;

    if (ability.excludesSelf && t.col === origin.col && t.row === origin.row) {
      return false;
    }

    switch (ability.targetFilter) {
      case 'Ally': return occupant !== null && occupant.team === caster.team;
      case 'Enemy': return occupant !== null && occupant.team !== caster.team;
      case 'AnyUnit': return occupant !== null;
      case 'EmptyTile': return !isOccupied;
      case 'AnyTile': return true;
      default: return false;
    }
  });

  if (!ability.effectTemplate) {
    return primitives;
  }

  // Snapshot target IDs if necessary (pure function just does this deterministically)
  // For Line, nearest to farthest is exactly what rayTiles returns (ordered nearest-first).
  for (const tile of qualifyingTiles) {
    const occupantId = board.isOccupied(tile.col, tile.row) ? board.getOccupant(tile.col, tile.row) : null;
    
    for (const step of ability.effectTemplate) {
      if (step.kind === 'damage' && occupantId) {
        primitives.push({
          kind: 'damage',
          targetId: occupantId,
          amount: step.amount,
          sourceId: caster.id
        });
      } else if (step.kind === 'push' && occupantId) {
        primitives.push({
          kind: 'push',
          targetId: occupantId,
          direction: getDirection(origin, tile),
          distance: step.distance,
          sourceId: caster.id
        });
      } else if (step.kind === 'pull' && occupantId) {
        primitives.push({
          kind: 'pull',
          targetId: occupantId,
          direction: getDirection(origin, tile),
          distance: step.distance,
          sourceId: caster.id
        });
      } else if (step.kind === 'swap' && occupantId) {
        primitives.push({
          kind: 'swap',
          unitAId: caster.id,
          unitBId: occupantId
        });
      } else if (step.kind === 'spawnHazard') {
        primitives.push({
          kind: 'spawnHazard',
          tile: tile,
          hazardType: step.hazardType,
          duration: step.duration
        });
      } else if (step.kind === 'applyHazard') {
        primitives.push({
          kind: 'applyHazard',
          tile: tile
        });
      } else if (step.kind === 'setTerrain') {
        primitives.push({
          kind: 'setTerrain',
          tile: tile,
          terrainType: step.terrainType
        });
      } else if (step.kind === 'spawnUnit') {
        primitives.push({
          kind: 'spawnUnit',
          tile: tile,
          // If we need deterministic unique IDs, the caller should have provided a way.
          // For now, pass the spec through. The combat resolver will enforce uniqueness if needed.
          unitSpec: step.unitSpec
        });
      }
    }
  }

  return primitives;
}
