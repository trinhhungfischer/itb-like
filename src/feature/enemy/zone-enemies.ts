import type { Tile } from '../heroes-abilities/unit.js';
import type { AbilityDefinition } from '../heroes-abilities/ability-targeting.js';
import type { EffectPrimitive, UnitSpec } from '../../core/combat/combat-types.js';
import { EnemyUnit } from './artillery-enemies.js'; // Reuse the interface

export type EnemyTier = 'T1' | 'T2' | 'T3';

function createDroneSpec(suffix: string): UnitSpec {
  return {
    id: `spawned-drone-${suffix}`,
    hp: 2, // Drone T1 HP
    hazardImmunities: []
  };
}

export function createBroodmother(id: string, tier: EnemyTier, position: Tile): EnemyUnit {
  const hp = tier === 'T1' ? 5 : tier === 'T2' ? 6 : 8;
  const droneCount = tier === 'T3' ? 2 : 1;

  // The ability needs to spawn `droneCount` drones.
  // We can represent this by having `droneCount` spawnUnit steps, though targeting multiple empty tiles
  // using an Area shape, or assuming the AI picks an empty tile.
  // Actually, if we want to spawn 2 drones, we can use an Area of range 1 and hope for 2 empty tiles,
  // or just put two spawn steps. If we put two spawn steps on the same tile, the second will fail (not Clear).
  // For simplicity of "data configuration", we'll just specify the targetFilter as EmptyTile and Area shape if count > 1.
  
  const ability: AbilityDefinition = {
    id: 'Spawn Brood',
    shape: tier === 'T3' ? { type: 'Area', range: 1 } : { type: 'SingleTile', range: 3 },
    targetFilter: 'EmptyTile',
    effectTemplate: [
      { kind: 'spawnUnit', unitSpec: createDroneSpec('ability') }
    ]
  };

  const onDeath = (tier === 'T2' || tier === 'T3') ? (lastTile: Tile): readonly EffectPrimitive[] => {
    const effects: EffectPrimitive[] = [];
    const dirs = [
      { col: 0, row: -1 }, { col: 1, row: 0 }, { col: 0, row: 1 }, { col: -1, row: 0 }
    ];
    for (let i = 0; i < droneCount; i++) {
      effects.push({
        kind: 'spawnUnit',
        tile: { col: lastTile.col + dirs[i].col, row: lastTile.row + dirs[i].row },
        unitSpec: createDroneSpec(`ondeath-${i}`)
      });
    }
    return effects;
  } : undefined;

  return {
    id,
    team: 'enemy',
    archetype: `Broodmother${tier}`,
    maxHP: hp,
    currentHP: hp,
    position,
    size: 1,
    abilities: [ability],
    hazardImmunities: [],
    statusFlags: [],
    moveSlot: 'Available',
    abilitySlot: 'Available',
    moveRange: 1,
    onDeath
  };
}

export function createShifter(id: string, tier: EnemyTier, position: Tile): EnemyUnit {
  const hp = tier === 'T1' ? 4 : tier === 'T2' ? 5 : 6;
  const attackRange = tier === 'T1' ? 3 : 4;

  const ability: AbilityDefinition = {
    id: tier === 'T3' ? 'Terraform' : 'Erect Wall',
    shape: tier === 'T3' ? { type: 'Area', range: 1 } : { type: 'SingleTile', range: attackRange },
    targetFilter: 'EmptyTile',
    effectTemplate: [
      { kind: 'setTerrain', terrainType: 'Wall' }
    ]
  };

  return {
    id,
    team: 'enemy',
    archetype: `Shifter${tier}`,
    maxHP: hp,
    currentHP: hp,
    position,
    size: 1,
    abilities: [ability],
    hazardImmunities: [],
    statusFlags: [],
    moveSlot: 'Available',
    abilitySlot: 'Available',
    moveRange: 1
  };
}
