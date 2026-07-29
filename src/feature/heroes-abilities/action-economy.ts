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

export function consumeAbilitySlot(hero: Unit): void {
    if (isHeroRemoved(hero)) {
        throw new ActionEconomyError("Cannot request action from a removed hero.");
    }
    if (hero.abilitySlot !== 'Available') {
        throw new ActionEconomyError("Ability slot already used.");
    }
    hero.abilitySlot = 'Used';
}

export function getSquadMaxActions(squadSize: number): number {
    return squadSize * 2;
}
