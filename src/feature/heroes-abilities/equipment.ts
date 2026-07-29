export interface GadgetDefinition {
  type: 'gadget';
  id: string;
  cooldownTurns: number;
  usesPerBattle: number | null;
  compatible: string[];
}

export interface PassiveDefinition {
  type: 'passive';
  id: string;
}

export type EquipmentDefinition = GadgetDefinition | PassiveDefinition;

export interface HeroRunState {
  heroId: string;
  equipment: EquipmentDefinition[];
}

export class EquipmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EquipmentError';
  }
}

export function equipItem(heroState: HeroRunState, item: EquipmentDefinition): HeroRunState {
  if (heroState.equipment.length >= 2) {
    throw new EquipmentError('Max 2 equipment slots allowed.');
  }

  if (item.type === 'gadget') {
    const hasGadget = heroState.equipment.some(e => e.type === 'gadget');
    if (hasGadget) {
      throw new EquipmentError('Max 1 Gadget equipped per hero.');
    }
  }

  return {
    ...heroState,
    equipment: [...heroState.equipment, item]
  };
}
