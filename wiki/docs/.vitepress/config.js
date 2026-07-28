import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "GDD Wiki",
  description: "Mini Wiki cho Game Design Documents",
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Game Concept', link: '/game-concept' },
      { text: 'Systems Index', link: '/systems-index' }
    ],

    sidebar: [
      {
        text: 'Tổng Quan',
        items: [
          { text: 'Game Concept', link: '/game-concept' },
          { text: 'Systems Index', link: '/systems-index' },
          { text: 'Onboarding / Tutorial', link: '/onboarding-tutorial' },
          { text: 'Objective & Win/Lose', link: '/objective-and-win-lose' }
        ]
      },
      {
        text: 'Cơ Chế Lõi (Core Mechanics)',
        items: [
          { text: 'Board & Grid', link: '/board-and-grid' },
          { text: 'Input & Selection', link: '/input-and-selection' },
          { text: 'Turn & Phase Manager', link: '/turn-and-phase-manager' },
          { text: 'Combat Resolution', link: '/combat-resolution' },
          { text: 'Move Preview', link: '/move-preview' },
          { text: 'Board Rendering & Juice', link: '/board-rendering-and-juice' }
        ]
      },
      {
        text: 'Thực Thể & Kỹ Năng',
        items: [
          { text: 'Heroes & Abilities', link: '/heroes-and-abilities' },
          { text: 'Enemy Abilities & Telegraph', link: '/enemy-abilities-and-telegraph' },
          { text: 'Ability Upgrades', link: '/ability-upgrades' }
        ]
      },
      {
        text: 'Cấu Trúc Run & Cấu Trúc Game',
        items: [
          { text: 'Run Structure (Node Map)', link: '/run-structure-node-map' },
          { text: 'Encounter Generator', link: '/encounter-generator' },
          { text: 'Difficulty Tiers', link: '/difficulty-tiers' },
          { text: 'Run Persistence', link: '/run-persistence' },
          { text: 'Draft & Loadout Meta', link: '/draft-and-loadout-meta' },
          { text: 'Meta Progression & Unlocks', link: '/meta-progression-and-unlocks' }
        ]
      },
      {
        text: 'Giao Diện & Âm Thanh',
        items: [
          { text: 'Map & Run UI', link: '/map-run-ui' },
          { text: 'Draft & Loadout UI', link: '/draft-loadout-ui' },
          { text: 'Battle HUD', link: '/battle-hud' },
          { text: 'Audio System', link: '/audio-system' }
        ]
      }
    ],

    search: {
      provider: 'local'
    }
  }
})
