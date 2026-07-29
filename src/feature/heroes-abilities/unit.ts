export type UnitId = string;
export type Team = 'hero' | 'enemy';
export type ActionSlotState = 'Available' | 'Used';

export interface Tile {
  col: number;
  row: number;
}

export interface AbilityDefinition {
  id: string;
}

export interface Unit {
  id: UnitId;
  team: Team;
  archetype: string;
  maxHP: number;
  currentHP: number;
  position: Tile;
  size: 1;
  abilities: AbilityDefinition[];
  hazardImmunities: string[];
  statusFlags: string[];
  moveSlot: ActionSlotState;
  abilitySlot: ActionSlotState;
}

export interface HeroDefinition {
  id: string;
  maxHP: number;
  moveRange: number;
  equipmentSlots: [import('./equipment').EquipmentSlot, import('./equipment').EquipmentSlot];
}

export function constructHeroUnit(id: UnitId, heroDef: HeroDefinition, position: Tile): Unit {
  return {
    id,
    team: 'hero',
    archetype: heroDef.id,
    maxHP: heroDef.maxHP,
    currentHP: heroDef.maxHP,
    position,
    size: 1,
    abilities: [],
    hazardImmunities: [],
    statusFlags: [],
    moveSlot: 'Available',
    abilitySlot: 'Available'
  };
}
