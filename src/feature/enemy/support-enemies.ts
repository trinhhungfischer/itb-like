import type { Tile, Unit } from '../heroes-abilities/unit.js';
import type { EffectPrimitive } from '../../core/combat/combat-types.js';

export type AuraType = 'Warchief' | 'Ironhide' | 'Volatile' | 'Hivemind';

// We redefine EnemyUnit here to include aura, but it's compatible with the others structurally.
// Ideally, this should be in a shared types file, but for now we keep it scoped to feature stories.
export interface EnemyUnit extends Unit {
  moveRange: number;
  onDeath?: (lastTile: Tile) => readonly EffectPrimitive[];
  aura?: AuraType;
}

export type EnemyTier = 'T1' | 'T2' | 'T3';

export function createOverseer(id: string, variant: AuraType, position: Tile): EnemyUnit {
  // Overseer always has maxHP 3, moveRange 2, attackRange 0 (no attack).
  return {
    id,
    team: 'enemy',
    archetype: `Overseer_${variant}`,
    maxHP: 3,
    currentHP: 3,
    position,
    size: 1,
    abilities: [], // No attack abilities
    hazardImmunities: [],
    statusFlags: [],
    moveSlot: 'Available',
    abilitySlot: 'Available',
    moveRange: 2,
    aura: variant
  };
}
