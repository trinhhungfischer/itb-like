import { describe, it, expect } from 'vitest';
import { evaluate, BattleState, ObjectiveConfig } from '../../../src/feature/objective-win-lose/base-contract';
import { Unit } from '../../../src/feature/heroes-abilities/unit';

function createMockHero(): Unit {
  return {
    id: 'hero_1',
    team: 'hero',
    archetype: 'hero_def',
    maxHP: 10,
    currentHP: 10,
    position: { col: 0, row: 0 },
    size: 1,
    abilities: [],
    hazardImmunities: [],
    statusFlags: [],
    moveSlot: 'Available',
    abilitySlot: 'Available'
  };
}

function createMockVip(): Unit {
  return {
    id: 'vip',
    team: 'hero', // Assuming VIP is on hero team
    archetype: 'vip_def',
    maxHP: 5,
    currentHP: 5,
    position: { col: 1, row: 1 },
    size: 1,
    abilities: [],
    hazardImmunities: [],
    statusFlags: [],
    moveSlot: 'Available',
    abilitySlot: 'Available'
  };
}

describe('Objective Win-Lose: Survive & Protect', () => {
  it('AC-1: Survive type turn cap', () => {
    const config: ObjectiveConfig = { type: 'Survive', max_turns: 5 };
    const state: BattleState = { units: [createMockHero()] };
    
    // When evaluate() at turn=4
    const result4 = evaluate(state, 4, config);
    // Then returns Ongoing
    expect(result4).toEqual({ status: 'Ongoing' });

    // When evaluate() at turn=5
    const result5 = evaluate(state, 5, config);
    // Then returns Victory (TurnLimitReached)
    expect(result5).toEqual({ status: 'Victory', reason: 'TurnLimitReached' });
  });

  it('AC-2: Survive type enemies cleared early', () => {
    const config: ObjectiveConfig = { type: 'Survive', max_turns: 5 };
    // No enemies in the state, only heroes
    const state: BattleState = { units: [createMockHero()] };
    
    // When evaluate() at turn=2
    const result = evaluate(state, 2, config);
    // Then Returns Ongoing (does not trigger Victory)
    expect(result).toEqual({ status: 'Ongoing' });
  });

  it('AC-3: Protect type target lost', () => {
    const config: ObjectiveConfig = { type: 'Protect', max_turns: 6, protectedUnitId: 'vip' };
    // VIP is missing from units (simulating dead)
    const state: BattleState = { units: [createMockHero()] };
    
    // When evaluate() at turn=3
    const result = evaluate(state, 3, config);
    // Then Returns {status: Defeat, reason: ProtectedUnitLost}
    expect(result).toEqual({ status: 'Defeat', reason: 'ProtectedUnitLost' });
  });

  it('Protect type target alive returns Ongoing, then Victory at max_turns', () => {
    const config: ObjectiveConfig = { type: 'Protect', max_turns: 6, protectedUnitId: 'vip' };
    const state: BattleState = { units: [createMockHero(), createMockVip()] };
    
    const result3 = evaluate(state, 3, config);
    expect(result3).toEqual({ status: 'Ongoing' });

    const result6 = evaluate(state, 6, config);
    expect(result6).toEqual({ status: 'Victory', reason: 'TurnLimitReached' });
  });

  it('Input validation: Rejects Protect config without protectedUnitId', () => {
    const state: BattleState = { units: [createMockHero()] };
    const config: ObjectiveConfig = { type: 'Protect', max_turns: 5 }; // missing protectedUnitId
    
    expect(() => evaluate(state, 1, config)).toThrow(/Protect config must have protectedUnitId/);
  });
});
