import { describe, it, expect } from 'vitest';
import { GadgetDefinition, HeroRunState, equipItem, EquipmentError, PassiveDefinition } from '../../../src/feature/heroes-abilities/equipment';

describe('Gadget Schema and Equipment (Story 001)', () => {

  it('test_ac1_gadget_definition_schema', () => {
    // Given a new gadget is defined
    const gadget: GadgetDefinition = {
      type: 'gadget',
      id: 'smoke_grenade',
      cooldownTurns: 2,
      usesPerBattle: 3,
      compatible: ['vanguard']
    };

    // Then it correctly stores cooldownTurns and usesPerBattle
    expect(gadget.cooldownTurns).toBe(2);
    expect(gadget.usesPerBattle).toBe(3);

    // Edge cases: usesPerBattle is null (unlimited)
    const unlimitedGadget: GadgetDefinition = {
      type: 'gadget',
      id: 'flashlight',
      cooldownTurns: 1,
      usesPerBattle: null,
      compatible: []
    };
    expect(unlimitedGadget.usesPerBattle).toBeNull();
  });

  it('test_ac2_equipment_slots_constraint', () => {
    // Given a hero with empty equipment slots
    let hero: HeroRunState = { heroId: 'vanguard', equipment: [] };

    const gadget1: GadgetDefinition = {
      type: 'gadget',
      id: 'smoke_grenade',
      cooldownTurns: 2,
      usesPerBattle: 3,
      compatible: []
    };

    const gadget2: GadgetDefinition = {
      type: 'gadget',
      id: 'flashbang',
      cooldownTurns: 1,
      usesPerBattle: null,
      compatible: []
    };

    const passive: PassiveDefinition = {
      type: 'passive',
      id: 'toughness'
    };

    // When equipping a gadget
    hero = equipItem(hero, gadget1);

    // Then it takes 1 slot
    expect(hero.equipment.length).toBe(1);
    expect(hero.equipment[0].id).toBe('smoke_grenade');

    // And a second gadget cannot be equipped on the same hero
    expect(() => equipItem(hero, gadget2)).toThrowError(EquipmentError);
    expect(() => equipItem(hero, gadget2)).toThrowError('Max 1 Gadget equipped per hero.');

    // But a passive can be equipped
    hero = equipItem(hero, passive);
    expect(hero.equipment.length).toBe(2);

    // And a third item cannot be equipped
    const passive2: PassiveDefinition = {
      type: 'passive',
      id: 'speed'
    };
    expect(() => equipItem(hero, passive2)).toThrowError(EquipmentError);
    expect(() => equipItem(hero, passive2)).toThrowError('Max 2 equipment slots allowed.');
  });
});
