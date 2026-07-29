import type { Tile, Unit } from '../heroes-abilities/unit.js';
import type { AbilityDefinition } from '../heroes-abilities/ability-targeting.js';
import type { UnitSpec } from '../../core/combat/combat-types.js';

export interface EnemyUnit extends Unit {
  moveRange: number;
}

export type BossType = 'Behemoth' | 'Architect';

function createDroneSpec(suffix: string): UnitSpec {
  return { id: `boss-drone-${suffix}`, hp: 3, hazardImmunities: [] };
}

export function createBoss(id: string, variant: BossType, position: Tile): EnemyUnit {
  let abilities: AbilityDefinition[] = [];
  
  if (variant === 'Behemoth') {
    abilities = [
      {
        id: 'Seismic Slam',
        shape: { type: 'Area', range: 1 },
        targetFilter: 'Any',
        effectTemplate: [
          { kind: 'damage', amount: 3 },
          { kind: 'push', distance: 1 }
        ]
      },
      {
        id: 'Summon Swarm',
        shape: { type: 'Area', range: 1 },
        targetFilter: 'EmptyTile',
        effectTemplate: [
          { kind: 'spawnUnit', unitSpec: createDroneSpec('1') },
          { kind: 'spawnUnit', unitSpec: createDroneSpec('2') }
        ]
      }
    ];
    return {
      id,
      team: 'enemy',
      archetype: variant,
      maxHP: 15,
      currentHP: 15,
      position,
      size: 1,
      abilities,
      hazardImmunities: [],
      statusFlags: [],
      moveSlot: 'Available',
      abilitySlot: 'Available',
      moveRange: 2
    };
  } else {
    abilities = [
      {
        id: 'Rift Tear',
        shape: { type: 'SingleTile', range: 4 },
        targetFilter: 'EmptyTile',
        effectTemplate: [
          { kind: 'setTerrain', terrainType: 'Chasm' }
        ]
      },
      {
        id: 'Shockwave',
        shape: { type: 'Area', range: 1 },
        targetFilter: 'Any',
        effectTemplate: [
          { kind: 'push', distance: 2 },
          { kind: 'damage', amount: 1 }
        ]
      }
    ];
    return {
      id,
      team: 'enemy',
      archetype: variant,
      maxHP: 12,
      currentHP: 12,
      position,
      size: 1,
      abilities,
      hazardImmunities: [],
      statusFlags: [],
      moveSlot: 'Available',
      abilitySlot: 'Available',
      moveRange: 1
    };
  }
}
