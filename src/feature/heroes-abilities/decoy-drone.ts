import { Tile, UnitId, Unit } from './unit.js';

export const DECOY_DRONE_ARCHETYPE = 'DecoyDrone';

export function constructDecoyDrone(id: UnitId, position: Tile): Unit & { moveRange: number } {
  return {
    id,
    team: 'hero',
    archetype: DECOY_DRONE_ARCHETYPE,
    maxHP: 1,
    currentHP: 1,
    position,
    size: 1,
    abilities: [],
    hazardImmunities: [],
    statusFlags: [],
    moveSlot: 'Used',
    abilitySlot: 'Used',
    moveRange: 0
  };
}
