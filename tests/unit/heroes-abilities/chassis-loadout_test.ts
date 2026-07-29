import { expect, test, describe } from 'vitest';
import { constructHeroUnit, HeroDefinition } from '../../../src/feature/heroes-abilities/unit';
import { createLoadout, LoadoutError, SQUAD_SIZE } from '../../../src/feature/heroes-abilities/loadout';
import { resetPhaseSlots, consumeMoveSlot, consumeAbilitySlot, ActionEconomyError, getSquadMaxActions } from '../../../src/feature/heroes-abilities/action-economy';

describe('Story 001: Chassis, Loadout, and Action Economy', () => {
    
    describe('Hero Chassis', () => {
        test('Hero chassis size is structurally fixed at 1', () => {
            const def: HeroDefinition = { id: 'hero_1', maxHP: 5, moveRange: 3 };
            const unit = constructHeroUnit('u1', def, { col: 0, row: 0 });
            expect(unit.size).toBe(1);
        });
        
        test('Zero moveRange heroes are valid', () => {
            const def: HeroDefinition = { id: 'hero_immobile', maxHP: 5, moveRange: 0 };
            const unit = constructHeroUnit('u2', def, { col: 0, row: 0 });
            expect(unit.size).toBe(1);
            expect(unit.maxHP).toBe(5);
        });
    });

    describe('Loadout Construction', () => {
        test('Loadout construction with exactly squad_size distinct heroes succeeds', () => {
            const heroes: HeroDefinition[] = [
                { id: 'h1', maxHP: 5, moveRange: 3 },
                { id: 'h2', maxHP: 4, moveRange: 4 },
                { id: 'h3', maxHP: 6, moveRange: 2 }
            ];
            const loadout = createLoadout(heroes);
            expect(loadout.length).toBe(SQUAD_SIZE);
        });

        test('Duplicate heroes in Loadout are rejected', () => {
            const heroes: HeroDefinition[] = [
                { id: 'h1', maxHP: 5, moveRange: 3 },
                { id: 'h1', maxHP: 5, moveRange: 3 },
                { id: 'h3', maxHP: 6, moveRange: 2 }
            ];
            expect(() => createLoadout(heroes)).toThrow(LoadoutError);
        });

        test('Loadout with incorrect number of heroes is rejected', () => {
            const heroes2: HeroDefinition[] = [
                { id: 'h1', maxHP: 5, moveRange: 3 },
                { id: 'h2', maxHP: 4, moveRange: 4 }
            ];
            expect(() => createLoadout(heroes2)).toThrow(LoadoutError);
            
            const heroes4: HeroDefinition[] = [
                { id: 'h1', maxHP: 5, moveRange: 3 },
                { id: 'h2', maxHP: 4, moveRange: 4 },
                { id: 'h3', maxHP: 6, moveRange: 2 },
                { id: 'h4', maxHP: 4, moveRange: 3 }
            ];
            expect(() => createLoadout(heroes4)).toThrow(LoadoutError);
        });
    });

    describe('Action Economy', () => {
        test('Move and Ability slots are Available at Player-Phase start', () => {
            const def: HeroDefinition = { id: 'h1', maxHP: 5, moveRange: 3 };
            const unit = constructHeroUnit('u1', def, { col: 0, row: 0 });
            unit.moveSlot = 'Used';
            unit.abilitySlot = 'Used';
            resetPhaseSlots(unit);
            expect(unit.moveSlot).toBe('Available');
            expect(unit.abilitySlot).toBe('Available');
        });

        test('Move slot becomes Used independently of Ability slot', () => {
            const def: HeroDefinition = { id: 'h1', maxHP: 5, moveRange: 3 };
            const unit = constructHeroUnit('u1', def, { col: 0, row: 0 });
            consumeMoveSlot(unit);
            expect(unit.moveSlot).toBe('Used');
            expect(unit.abilitySlot).toBe('Available');
        });

        test('Third action is rejected', () => {
            const def: HeroDefinition = { id: 'h1', maxHP: 5, moveRange: 3 };
            const unit = constructHeroUnit('u1', def, { col: 0, row: 0 });
            consumeMoveSlot(unit);
            consumeAbilitySlot(unit);
            
            expect(() => consumeMoveSlot(unit)).toThrow(ActionEconomyError);
            expect(() => consumeAbilitySlot(unit)).toThrow(ActionEconomyError);
        });

        test('Max actions per phase depends on squad size', () => {
            expect(getSquadMaxActions(3)).toBe(6);
            expect(getSquadMaxActions(5)).toBe(10);
        });

        test('Removed heroes (0 HP) are never offered actions', () => {
            const def: HeroDefinition = { id: 'h1', maxHP: 5, moveRange: 3 };
            const unit = constructHeroUnit('u1', def, { col: 0, row: 0 });
            
            unit.currentHP = 0; 
            
            expect(() => consumeMoveSlot(unit)).toThrow(ActionEconomyError);
            expect(() => consumeAbilitySlot(unit)).toThrow(ActionEconomyError);
            
            unit.moveSlot = 'Used';
            unit.abilitySlot = 'Used';
            resetPhaseSlots(unit);
            expect(unit.moveSlot).toBe('Used');
            expect(unit.abilitySlot).toBe('Used');
        });
    });
});
