import { Unit } from './unit';

export class ActionEconomyError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ActionEconomyError';
    }
}

export function isHeroRemoved(hero: Unit): boolean {
    return hero.currentHP <= 0; 
}

export function resetPhaseSlots(hero: Unit): void {
    if (isHeroRemoved(hero)) {
        return;
    }
    hero.moveSlot = 'Available';
    hero.abilitySlot = 'Available';
}

export function consumeMoveSlot(hero: Unit): void {
    if (isHeroRemoved(hero)) {
        throw new ActionEconomyError("Cannot request action from a removed hero.");
    }
    if (hero.moveSlot !== 'Available') {
        throw new ActionEconomyError("Move slot already used.");
    }
    hero.moveSlot = 'Used';
}

export function consumeAbilitySlot(hero: Unit, source: 'innate' | 'gadget' = 'innate'): void {
    if (isHeroRemoved(hero)) {
        throw new ActionEconomyError("Cannot request action from a removed hero.");
    }
    if (hero.abilitySlot !== 'Available') {
        throw new ActionEconomyError(`Ability slot already used (attempted by ${source}).`);
    }
    hero.abilitySlot = 'Used';
}

export interface GadgetState {
    currentCooldown: number;
    remainingUses: number | null; // null means unlimited
}

export function canUseGadget(state: GadgetState): boolean {
    if (state.currentCooldown > 0) return false;
    if (state.remainingUses !== null && state.remainingUses <= 0) return false;
    return true;
}

export function useGadget(hero: Unit, state: GadgetState, cooldownTurns: number): GadgetState {
    if (!canUseGadget(state)) {
        throw new ActionEconomyError("Gadget is not available (on cooldown or no uses left).");
    }
    
    consumeAbilitySlot(hero, 'gadget');
    
    return {
        currentCooldown: cooldownTurns,
        remainingUses: state.remainingUses !== null ? state.remainingUses - 1 : null
    };
}

export function getSquadMaxActions(squadSize: number): number {
    return squadSize * 2;
}
