import { EquipmentDefinition, GadgetDefinition } from '../heroes-abilities/equipment.js';

export class DraftSystem {
  private availableGadgets: GadgetDefinition[] = [];

  constructor(gadgets: GadgetDefinition[]) {
    this.availableGadgets = gadgets;
  }

  public generateRewardPool(encounterType: 'Battle' | 'Elite' | 'Boss', heroClass: string): EquipmentDefinition[] {
    // Return all gadgets compatible with the hero
    const pool: EquipmentDefinition[] = [];
    
    for (const gadget of this.availableGadgets) {
      if (gadget.compatible.includes(heroClass)) {
        pool.push(gadget);
      }
    }
    
    return pool;
  }

  public generateShop(): { item: EquipmentDefinition; cost: number }[] {
    return this.availableGadgets.map(gadget => ({
      item: gadget,
      cost: 3 // Gadgets cost exactly 3 Reputation
    }));
  }
}
