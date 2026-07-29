export interface GadgetDefinition {
  type: 'gadget';
  id: string;
  cooldownTurns: number;
  usesPerBattle: number | null;
  compatible: string[];
}

export type PassiveTrigger =
  | { type: 'Always' }
  | { type: 'OnAction' }
  | { type: 'OnHit' }
  | { type: 'OnKill' }
  | { type: 'OnTurnStart' };

export interface PassiveModuleDefinition {
  type: 'passive';
  id: string;
  name: string;
  category: string;
  scope: string;
  trigger: PassiveTrigger;
  effect: any;
  rarity: string;
  incompatible: string[];
}

export type PassiveDefinition = PassiveModuleDefinition; // backwards compatibility
export type PassiveModule = PassiveModuleDefinition;
export type Gadget = GadgetDefinition;

export type EquipmentDefinition = GadgetDefinition | PassiveModuleDefinition;
export type EquipmentSlot = PassiveModule | Gadget | null;

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

export function replaceItem(heroState: HeroRunState, index: number, newItem: EquipmentDefinition): HeroRunState {
  if (index < 0 || index >= heroState.equipment.length) {
    throw new EquipmentError('Invalid equipment index.');
  }

  const currentEquipment = [...heroState.equipment];
  currentEquipment[index] = newItem;

  // Validate gadgets
  const gadgetCount = currentEquipment.filter(e => e.type === 'gadget').length;
  if (gadgetCount > 1) {
    throw new EquipmentError('Max 1 Gadget equipped per hero.');
  }

  return {
    ...heroState,
    equipment: currentEquipment
  };
}
