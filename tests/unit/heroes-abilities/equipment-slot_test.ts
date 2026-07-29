import { expect, test, describe } from 'vitest';
import { HeroDefinition } from '../../../src/feature/heroes-abilities/unit';
import { PassiveModuleDefinition, EquipmentSlot } from '../../../src/feature/heroes-abilities/equipment';

export function equipToHero(hero: HeroDefinition, equipment: PassiveModuleDefinition): HeroDefinition {
    const newHero = { ...hero, equipmentSlots: [...hero.equipmentSlots] as [EquipmentSlot, EquipmentSlot] };
    if (newHero.equipmentSlots[0] === null) {
        newHero.equipmentSlots[0] = equipment;
    } else if (newHero.equipmentSlots[1] === null) {
        newHero.equipmentSlots[1] = equipment;
    } else {
        throw new Error('Equipment slots are full. Cannot equip more than 2 items.');
    }
    return newHero;
}

describe('Story 001: Equipment Slot Data Model', () => {
    test('AC-1: A hero can equip a maximum of 2 passive modules', () => {
        let hero: HeroDefinition = {
            id: 'hero_1',
            maxHP: 5,
            moveRange: 3,
            equipmentSlots: [null, null]
        };

        const module1: PassiveModuleDefinition = {
            type: 'passive',
            id: 'm1',
            name: 'Module 1',
            category: 'test',
            scope: 'self',
            trigger: {},
            effect: {},
            rarity: 'common',
            incompatible: []
        };

        const module2: PassiveModuleDefinition = {
            type: 'passive',
            id: 'm2',
            name: 'Module 2',
            category: 'test',
            scope: 'self',
            trigger: {},
            effect: {},
            rarity: 'common',
            incompatible: []
        };

        const module3: PassiveModuleDefinition = {
            type: 'passive',
            id: 'm3',
            name: 'Module 3',
            category: 'test',
            scope: 'self',
            trigger: {},
            effect: {},
            rarity: 'common',
            incompatible: []
        };

        hero = equipToHero(hero, module1);
        expect(hero.equipmentSlots[0]).toEqual(module1);
        expect(hero.equipmentSlots[1]).toBeNull();

        hero = equipToHero(hero, module2);
        expect(hero.equipmentSlots[0]).toEqual(module1);
        expect(hero.equipmentSlots[1]).toEqual(module2);

        expect(() => equipToHero(hero, module3)).toThrowError('Equipment slots are full');
    });
});
