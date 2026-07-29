import type { Tile, Unit } from '../heroes-abilities/unit.js';
import type { AbilityDefinition } from '../heroes-abilities/ability-targeting.js';
import type { EffectPrimitive } from '../../core/combat/combat-types.js';

export type EnemyTier = 'T1' | 'T2' | 'T3';

export interface EnemyUnit extends Unit {
  moveRange: number;
  onDeath?: (lastTile: Tile) => readonly EffectPrimitive[];
}

export function createLobber(id: string, tier: EnemyTier, position: Tile): EnemyUnit {
  const hp = tier === 'T1' ? 2 : tier === 'T2' ? 4 : 5;
  const moveRange = tier === 'T1' ? 1 : tier === 'T2' ? 1 : 2;
  const attackRange = tier === 'T1' ? 4 : tier === 'T2' ? 4 : 5;

  const ability: AbilityDefinition = {
    id: tier === 'T3' ? 'Acid Rain' : 'Acid Glob',
    shape: tier === 'T1' ? { type: 'SingleTile', range: attackRange } : { type: 'Area', range: attackRange },
    targetFilter: 'Enemy',
    effectTemplate: tier === 'T3' ? [
      { kind: 'damage', amount: 1 },
      { kind: 'spawnHazard', hazardType: 'Acid', duration: 2 }
    ] : tier === 'T2' ? [
      { kind: 'damage', amount: 1 }
    ] : [
      { kind: 'damage', amount: 1 }
    ]
  };

  const onDeath = tier === 'T3' ? (lastTile: Tile): readonly EffectPrimitive[] => {
    // Generate acid on neighbors
    const effects: EffectPrimitive[] = [];
    const dirs = [
      { col: 0, row: -1 }, { col: 1, row: 0 }, { col: 0, row: 1 }, { col: -1, row: 0 }
    ];
    for (const d of dirs) {
      effects.push({
        kind: 'spawnHazard',
        tile: { col: lastTile.col + d.col, row: lastTile.row + d.row },
        hazardType: 'Acid',
        duration: 2
      });
    }
    return effects;
  } : undefined;

  return {
    id,
    team: 'enemy',
    archetype: `Lobber${tier}`,
    maxHP: hp,
    currentHP: hp,
    position,
    size: 1,
    abilities: [ability],
    hazardImmunities: [],
    statusFlags: [],
    moveSlot: 'Available',
    abilitySlot: 'Available',
    moveRange,
    onDeath
  };
}

export function createSpitter(id: string, tier: EnemyTier, position: Tile): EnemyUnit {
  const hp = tier === 'T1' ? 2 : tier === 'T2' ? 3 : 4;
  const moveRange = tier === 'T1' ? 0 : 1;
  const attackRange = 100; // Infinity

  const ability: AbilityDefinition = {
    id: tier === 'T3' ? 'Impaling Shot' : 'Spike Shot',
    shape: { type: 'SingleTile', range: attackRange, requiresOrthogonalAlignment: true },
    targetFilter: 'Enemy',
    effectTemplate: tier === 'T3' ? [
      { kind: 'damage', amount: 2 },
      { kind: 'push', distance: 1 }
    ] : [
      { kind: 'damage', amount: 2 }
    ]
  };

  return {
    id,
    team: 'enemy',
    archetype: `Spitter${tier}`,
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

export function createSentinel(id: string, tier: EnemyTier, position: Tile): EnemyUnit {
  const hp = tier === 'T1' ? 3 : tier === 'T2' ? 4 : 5;
  const moveRange = tier === 'T1' ? 0 : tier === 'T2' ? 0 : 1;
  const attackRange = tier === 'T1' ? 3 : tier === 'T2' ? 3 : 4;

  const ability: AbilityDefinition = {
    id: tier === 'T3' ? 'Mine Field' : 'Mine Layer',
    shape: tier === 'T3' ? { type: 'Area', range: attackRange } : { type: 'SingleTile', range: attackRange },
    targetFilter: 'Enemy', // Though it spawns a mine, the target is still the enemy's tile
    effectTemplate: [
      { kind: 'spawnHazard', hazardType: 'Mine', duration: null } // duration: null means infinite/doesn't expire
    ]
  };

  const onDeath = (tier === 'T2' || tier === 'T3') ? (lastTile: Tile): readonly EffectPrimitive[] => {
    // Generate mines on neighbors
    const effects: EffectPrimitive[] = [];
    const dirs = [
      { col: 0, row: -1 }, { col: 1, row: 0 }, { col: 0, row: 1 }, { col: -1, row: 0 }
    ];
    for (const d of dirs) {
      effects.push({
        kind: 'spawnHazard',
        tile: { col: lastTile.col + d.col, row: lastTile.row + d.row },
        hazardType: 'Mine',
        duration: null
      });
    }
    return effects;
  } : undefined;

  return {
    id,
    team: 'enemy',
    archetype: `Sentinel${tier}`,
    maxHP: hp,
    currentHP: hp,
    position,
    size: 1,
    abilities: [ability],
    hazardImmunities: [],
    statusFlags: [],
    moveSlot: 'Available',
    abilitySlot: 'Available',
    moveRange,
    onDeath
  };
}
