// VERTICAL SLICE - NOT FOR PRODUCTION
import { UnitData, Board } from '../foundation';

export interface EnemyIntent {
  col: number;
  row: number;
  enemyId: string;
}

export function createEnemy(id: string, col: number, row: number): UnitData {
  return {
    id,
    name: 'Beetle',
    team: 'enemy',
    hp: 3,
    maxHp: 3,
    col,
    row,
    abilities: [
      {
        id: 'bite',
        name: 'Bite',
        damage: 1,
        range: 1,
        ...({ type: 'attack', effects: [{ type: 'damage', value: 1 }], description: 'Deal 1 damage to adjacent tile' } as any)
      }
    ],
    hasMoved: false,
    hasActed: false,
    isAlive: true,
  };
}

export function generateEnemyIntent(enemy: UnitData, board: Board): EnemyIntent {
  const heroes = board.getTeamUnits('player').filter(h => h.isAlive);
  if (heroes.length === 0) {
    return { col: enemy.col, row: enemy.row, enemyId: enemy.id };
  }
  
  let closestHero = heroes[0];
  let minDistance = Infinity;
  for (const hero of heroes) {
    const dist = Math.abs(hero.col - enemy.col) + Math.abs(hero.row - enemy.row);
    if (dist < minDistance) {
      closestHero = hero;
      minDistance = dist;
    }
  }

  if (minDistance === 1) {
    return { col: closestHero.col, row: closestHero.row, enemyId: enemy.id };
  }

  // Move towards hero and telegraph the tile in that direction
  const dirCol = Math.sign(closestHero.col - enemy.col);
  const dirRow = Math.sign(closestHero.row - enemy.row);
  
  if (Math.abs(dirCol) >= Math.abs(dirRow)) {
    return { col: enemy.col + dirCol, row: enemy.row, enemyId: enemy.id };
  } else {
    return { col: enemy.col, row: enemy.row + dirRow, enemyId: enemy.id };
  }
}
