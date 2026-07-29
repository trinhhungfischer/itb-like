import { makeBoard } from './src/core/board/index.js'
import { resolve, CombatState } from './src/core/combat/index.js'
import { EnemyAbilitiesAndTelegraph } from './src/feature/enemy/enemy-abilities-and-telegraph.js'

async function runDemo() {
  console.log('--- VANGUARD: SPRINT 2 PLAYTEST DEMO ---')
  console.log('Initializing Battle...')
  const board = makeBoard()
  const state = CombatState.empty()
  
  // 1. Setup Hero with Gadget and Passive
  board.place({ col: 2, row: 2 }, 'hero-1')
  state.registerUnit('hero-1', 10)
  const heroUnit = {
    id: 'hero-1',
    position: { col: 2, row: 2 },
    team: 'player',
    equipment: {
      weapon: 'Cannon',
      gadget: 'SmokeGrenade',
      passive: 'ShatterStrike'
    }
  }

  // 2. Setup Enemy from Roster
  board.place({ col: 2, row: 4 }, 'charger-1')
  state.registerUnit('charger-1', 15)
  const enemyUnit = {
    id: 'charger-1',
    position: { col: 2, row: 4 },
    team: 'enemy',
    abilities: [{ id: 'Charge', shape: { type: 'Directional', range: 3 } }]
  }

  const unitProvider = {
    getAliveEnemies: () => [enemyUnit],
    getAliveHeroes: () => [heroUnit]
  }

  const ai = new EnemyAbilitiesAndTelegraph({ resolve } as any, state, unitProvider)
  
  console.log('\n[Phase 1] Enemy Intent Setup')
  ai.chooseIntents(board)
  const intent = ai.getIntent('charger-1')
  console.log(`Enemy 'charger-1' plans to use: ${intent?.abilityId} targeting ${intent?.targetId}`)

  console.log('\n[Phase 2] Player Action (Gadget: Smoke Grenade)')
  console.log('Hero uses Smoke Grenade on tile (2, 4)')
  board.setHazard({ col: 2, row: 4 }, 'Smoke')
  
  console.log('\n[Phase 3] Enemy Re-evaluate (Determinism & AI)')
  ai.chooseIntents(board)
  const newIntent = ai.getIntent('charger-1')
  console.log(`Enemy 'charger-1' is in Smoke. New intent: ${newIntent?.abilityId || 'Idle'}`)
  
  console.log('\n[Phase 4] Combat Resolution (Passive: Shatter Strike)')
  console.log('Hero attacks charger-1!')
  resolve(board, state, [{ kind: 'damage', targetId: 'charger-1', amount: 3 }])
  console.log(`charger-1 HP after attack: ${state.getHp('charger-1')}`)

  console.log('\n--- DEMO COMPLETE ---')
}

runDemo().catch(console.error)
