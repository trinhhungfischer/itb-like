import { describe, it, expect } from 'vitest';
import { Unit, constructHeroUnit } from '../../../src/feature/heroes-abilities/unit';
import { consumeAbilitySlot, GadgetState, useGadget, canUseGadget, ActionEconomyError } from '../../../src/feature/heroes-abilities/action-economy';

describe('Gadget Action Economy (Story 002)', () => {
    
    it('test_ac1_gadget_consumes_ability_slot', () => {
        // Given a hero with an equipped Gadget that is off cooldown
        const hero = constructHeroUnit('hero1', { id: 'vanguard', maxHP: 10, moveRange: 3 }, { col: 0, row: 0 });
        let gadgetState: GadgetState = { currentCooldown: 0, remainingUses: 2 };
        
        // When the hero uses the Gadget
        gadgetState = useGadget(hero, gadgetState, 2);
        
        // Then the hero's Ability slot is marked as used for the turn, but the Move slot remains available.
        expect(hero.abilitySlot).toBe('Used');
        expect(hero.moveSlot).toBe('Available');
    });

    it('test_ac2_cooldown_constraint', () => {
        // Given a hero with a Gadget on cooldown
        const hero = constructHeroUnit('hero1', { id: 'vanguard', maxHP: 10, moveRange: 3 }, { col: 0, row: 0 });
        let gadgetState: GadgetState = { currentCooldown: 1, remainingUses: 2 };
        
        // When the player attempts to use the Gadget
        const canUse = canUseGadget(gadgetState);
        
        // Then the Gadget cannot be selected and an expected gameplay rejection is returned.
        expect(canUse).toBe(false);
        expect(() => useGadget(hero, gadgetState, 2)).toThrowError(ActionEconomyError);
        expect(() => useGadget(hero, gadgetState, 2)).toThrowError('Gadget is not available');
    });

    it('test_ac2_uses_constraint', () => {
        const hero = constructHeroUnit('hero1', { id: 'vanguard', maxHP: 10, moveRange: 3 }, { col: 0, row: 0 });
        let gadgetState: GadgetState = { currentCooldown: 0, remainingUses: 0 };
        
        const canUse = canUseGadget(gadgetState);
        
        expect(canUse).toBe(false);
        expect(() => useGadget(hero, gadgetState, 2)).toThrowError(ActionEconomyError);
    });
});
