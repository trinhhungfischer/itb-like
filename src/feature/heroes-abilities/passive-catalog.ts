import type { PassiveModuleDefinition } from './equipment.js';

export const PASSIVE_CATALOG: Record<string, PassiveModuleDefinition> = {
  // COMBAT
  'C1': {
    type: 'passive',
    id: 'C1',
    name: 'Force Amplifier',
    category: 'Combat',
    scope: 'Self',
    trigger: { type: 'Always' },
    effect: { kind: 'modifier', stat: 'collision_damage', multiplier: 2 },
    rarity: 'Uncommon',
    incompatible: []
  },
  'C2': {
    type: 'passive',
    id: 'C2',
    name: 'Shatter Strike',
    category: 'Combat',
    scope: 'Self',
    trigger: { type: 'OnHit' },
    effect: { kind: 'shatter_strike' },
    rarity: 'Uncommon',
    incompatible: []
  },
  'C3': {
    type: 'passive',
    id: 'C3',
    name: 'Aftershock',
    category: 'Combat',
    scope: 'Self',
    trigger: { type: 'OnAction' },
    effect: { kind: 'aftershock', hazard: 'Fire', duration: 1 },
    rarity: 'Rare',
    incompatible: []
  },
  'C4': {
    type: 'passive',
    id: 'C4',
    name: 'Chain Reaction',
    category: 'Combat',
    scope: 'Self',
    trigger: { type: 'OnKill' },
    effect: { kind: 'chain_reaction' },
    rarity: 'Rare',
    incompatible: []
  },
  
  // TACTICAL
  'T1': {
    type: 'passive',
    id: 'T1',
    name: 'Slipstream',
    category: 'Tactical',
    scope: 'Self',
    trigger: { type: 'OnAction' },
    effect: { kind: 'slipstream' },
    rarity: 'Common',
    incompatible: []
  },
  'T2': {
    type: 'passive',
    id: 'T2',
    name: 'Overwatch',
    category: 'Tactical',
    scope: 'Self',
    trigger: { type: 'OnTurnStart' },
    effect: { kind: 'overwatch', rangeBonus: 2 },
    rarity: 'Uncommon',
    incompatible: []
  },
  'T3': {
    type: 'passive',
    id: 'T3',
    name: 'Warp Beacon',
    category: 'Tactical',
    scope: 'Self',
    trigger: { type: 'OnAction' },
    effect: { kind: 'warp_beacon' },
    rarity: 'Rare',
    incompatible: []
  },

  // SURVIVAL
  'S1': {
    type: 'passive',
    id: 'S1',
    name: 'Kinetic Armor',
    category: 'Survival',
    scope: 'Self',
    trigger: { type: 'OnHit' },
    effect: { kind: 'kinetic_armor' },
    rarity: 'Common',
    incompatible: []
  },
  'S2': {
    type: 'passive',
    id: 'S2',
    name: 'Hazard Walker',
    category: 'Survival',
    scope: 'Self',
    trigger: { type: 'Always' },
    effect: { kind: 'immunity', hazard: 'Fire' },
    rarity: 'Uncommon',
    incompatible: ['S3']
  },
  'S3': {
    type: 'passive',
    id: 'S3',
    name: 'Acid Walker',
    category: 'Survival',
    scope: 'Self',
    trigger: { type: 'Always' },
    effect: { kind: 'immunity', hazard: 'Acid' },
    rarity: 'Uncommon',
    incompatible: ['S2']
  },
  'S4': {
    type: 'passive',
    id: 'S4',
    name: 'Last Stand',
    category: 'Survival',
    scope: 'Self',
    trigger: { type: 'OnHit' },
    effect: { kind: 'last_stand' },
    rarity: 'Rare',
    incompatible: []
  },

  // UTILITY
  'U1': {
    type: 'passive',
    id: 'U1',
    name: 'Scavenger',
    category: 'Utility',
    scope: 'Squad', // Squad scope!
    trigger: { type: 'OnKill' },
    effect: { kind: 'scavenger', currency: 1 },
    rarity: 'Common',
    incompatible: []
  },
  'U2': {
    type: 'passive',
    id: 'U2',
    name: 'Spotter',
    category: 'Utility',
    scope: 'Self',
    trigger: { type: 'Always' },
    effect: { kind: 'spotter' },
    rarity: 'Common',
    incompatible: []
  }
};
