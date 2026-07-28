// VERTICAL SLICE - NOT FOR PRODUCTION
import { UnitData } from '../foundation';

export const HERO_KNIGHT: UnitData = {
  id: 'hero-knight',
  name: 'Knight',
  team: 'player',
  hp: 5,
  maxHp: 5,
  col: 1,
  row: 4,
  abilities: [
    { 
      id: 'strike', 
      name: 'Strike', 
      damage: 2, 
      range: 1,
      ...({ type: 'attack', effects: [{ type: 'damage', value: 2 }], description: 'Deal 2 damage to adjacent enemy' } as any)
    },
    { 
      id: 'bash', 
      name: 'Bash', 
      damage: 1, 
      range: 1,
      ...({ push: true, type: 'attack', effects: [{ type: 'damage', value: 1 }, { type: 'push', value: 1 }], description: 'Deal 1 damage and push 1 tile' } as any)
    },
  ],
  hasMoved: false,
  hasActed: false,
  isAlive: true,
};
