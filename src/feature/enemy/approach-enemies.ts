import type { Tile, Unit } from '../heroes-abilities/unit.js';
import type { AbilityDefinition } from '../heroes-abilities/ability-targeting.js';

export type EnemyTier = 'T1' | 'T2' | 'T3';

// Extends Unit to include moveRange which EnemyAbilitiesAndTelegraph expects
export interface EnemyUnit extends Unit {
  moveRange: number;
}

export function createDrone(id: string, tier: EnemyTier, position: Tile): EnemyUnit {
  const hp = tier === 'T1' ? 2 : tier === 'T2' ? 3 : 4;
  const moveRange = tier === 'T1' ? 3 : 4;

  const ability: AbilityDefinition = {
    id: tier === 'T3' ? 'Venomous Bite' : 'Bite',
    shape: { type: 'SingleTile', range: 1 },
    targetFilter: 'Enemy',
    effectTemplate: tier === 'T3' ? [
      { kind: 'damage', amount: 2 },
      { kind: 'spawnHazard', hazardType: 'Acid', duration: 1 }
    ] : [
      { kind: 'damage', amount: tier === 'T1' ? 1 : 2 }
    ]
  };

  return {
    id,
    team: 'enemy',
    archetype: `Drone${tier}`,
    maxHP: hp,
    currentHP: hp,
    position,
    size: 1,
    abilities: [ability],
    hazardImmunities: [],
    statusFlags: [],
    moveSlot: 'Available',
    abilitySlot: 'Available',
    moveRange
  };
}

export function createCharger(id: string, tier: EnemyTier, position: Tile): EnemyUnit {
  const hp = tier === 'T1' ? 3 : tier === 'T2' ? 4 : 5;
  const moveRange = tier === 'T1' ? 3 : 4;

  const ability: AbilityDefinition = {
    id: tier === 'T3' ? 'Ram Through' : 'Charge Strike',
    shape: { type: 'SingleTile', range: 1 },
    targetFilter: 'Enemy',
    effectTemplate: tier === 'T3' ? [
      { kind: 'damage', amount: 3 },
      { kind: 'push', distance: 2 }
    ] : tier === 'T2' ? [
      { kind: 'damage', amount: 2 },
      { kind: 'push', distance: 1 }
    ] : [
      { kind: 'damage', amount: 2 }
    ]
  };

  return {
    id,
    team: 'enemy',
    archetype: `Charger${tier}`,
    maxHP: hp,
    currentHP: hp,
    position,
    size: 1,
    abilities: [ability],
    hazardImmunities: [],
    statusFlags: [],
    moveSlot: 'Available',
    abilitySlot: 'Available',
    moveRange
  };
}

export function createStalker(id: string, tier: EnemyTier, position: Tile): EnemyUnit {
  const hp = tier === 'T1' ? 2 : tier === 'T2' ? 3 : 4;
  const moveRange = tier === 'T1' ? 4 : 5;

  const ability: AbilityDefinition = {
    id: tier === 'T3' ? 'Ambush' : 'Slash',
    shape: tier === 'T3' ? { type: 'Area', range: 1 } : { type: 'SingleTile', range: 1 },
    targetFilter: 'Enemy',
    effectTemplate: [
      { kind: 'damage', amount: 2 }
    ]
  };

  return {
    id,
    team: 'enemy',
    archetype: `Stalker${tier}`,
    maxHP: hp,
    currentHP: hp,
    position,
    size: 1,
    abilities: [ability],
    hazardImmunities: [],
    statusFlags: [],
    moveSlot: 'Available',
    abilitySlot: 'Available',
    moveRange
  };
}
