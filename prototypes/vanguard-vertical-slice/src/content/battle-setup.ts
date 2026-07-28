// VERTICAL SLICE - NOT FOR PRODUCTION
import { Board } from '../foundation';
import { HERO_KNIGHT } from './hero-data';
import { createEnemy } from './enemy-data';

export function setupBattle(board: Board): void {
  // Add Hero
  const hero = structuredClone(HERO_KNIGHT);
  board.addUnit(hero);
  
  // Add enemies
  const enemy1 = createEnemy('enemy-1', 4, 1);
  const enemy2 = createEnemy('enemy-2', 5, 3);
  
  board.addUnit(enemy1);
  board.addUnit(enemy2);
}
