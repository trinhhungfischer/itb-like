import { EquipmentDefinition, GadgetDefinition, PassiveModuleDefinition } from '../heroes-abilities/equipment.js';

export function mulberry32(a: number): () => number {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

export class DraftSystem {
  private availableGadgets: GadgetDefinition[] = [];
  private availableModules: PassiveModuleDefinition[] = [];

  constructor(gadgets: GadgetDefinition[] = [], modules: PassiveModuleDefinition[] = []) {
    this.availableGadgets = gadgets;
    this.availableModules = modules;
  }

  public generateRewardPool(
    encounterType: 'Battle' | 'Elite' | 'Boss', 
    heroClass: string,
    seed: number = Date.now(),
    squadEquippedModuleIds: string[] = []
  ): EquipmentDefinition[] {
    const rng = mulberry32(seed);
    const pool: EquipmentDefinition[] = [];
    
    for (const gadget of this.availableGadgets) {
      if (gadget.compatible.includes(heroClass)) {
        pool.push(gadget);
      }
    }

    const validModules = this.availableModules.filter(m => {
      if (m.scope === 'Squad' && squadEquippedModuleIds.includes(m.id)) {
        return false;
      }
      return true;
    });

    let allowedRarities: string[] = [];
    if (encounterType === 'Battle') allowedRarities = ['Common', 'Uncommon'];
    else if (encounterType === 'Elite') allowedRarities = ['Uncommon', 'Rare'];
    else if (encounterType === 'Boss') allowedRarities = ['Rare'];

    const filteredModules = validModules.filter(m => allowedRarities.includes(m.rarity));

    const shuffledModules = [...filteredModules].sort(() => rng() - 0.5);
    
    const combinedPool = [...pool, ...shuffledModules];
    const finalPool = combinedPool.sort(() => rng() - 0.5).slice(0, 3);
    
    return finalPool;
  }

  public generateShop(seed: number = Date.now(), squadEquippedModuleIds: string[] = []): { item: EquipmentDefinition; cost: number }[] {
    const rng = mulberry32(seed);
    
    const validModules = this.availableModules.filter(m => {
      if (m.scope === 'Squad' && squadEquippedModuleIds.includes(m.id)) {
        return false;
      }
      return true;
    });

    const combinedPool: EquipmentDefinition[] = [...this.availableGadgets, ...validModules];
    const shuffled = combinedPool.sort(() => rng() - 0.5).slice(0, 4);

    return shuffled.map(item => {
      let cost = 3;
      if (item.type === 'passive') {
        cost = item.rarity === 'Common' ? 2 : item.rarity === 'Uncommon' ? 3 : 5;
      }
      return { item, cost };
    });
  }
}
