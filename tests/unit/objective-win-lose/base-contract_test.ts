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

describe('Objective Win-Lose Base Contract', () => {
  it('AC-1: Purity & Idempotency - calling evaluate multiple times returns identical result and does not mutate state', () => {
    const hero = createMockHero();
    const state: BattleState = { units: [hero] };
    const stateJson = JSON.stringify(state);
    const config: ObjectiveConfig = { type: 'Clear' };
    
    const result1 = evaluate(state, 1, config);
    const result2 = evaluate(state, 1, config);
    const result3 = evaluate(state, 1, config);
    
    expect(result1).toEqual({ status: 'Ongoing' });
    expect(result1).toEqual(result2);
    expect(result2).toEqual(result3);
    
    // Ensure state was not mutated
    expect(JSON.stringify(state)).toEqual(stateJson);
  });

  it('AC-2: Party Wipe - returns Defeat with reason PartyWiped when all Hero-faction units are dead (not in array)', () => {
    const state: BattleState = { units: [] }; // No heroes alive
    const config: ObjectiveConfig = { type: 'Clear' };
    
    const result = evaluate(state, 1, config);
    
    expect(result).toEqual({ status: 'Defeat', reason: 'PartyWiped' });
  });

  it('AC-3: Defeat Precedence - partyWiped takes precedence over anything else', () => {
    // Currently, since we don't have victory predicates implemented, 
    // we test that a wipe returns Defeat regardless of config
    const state: BattleState = { units: [] }; 
    const config: ObjectiveConfig = { type: 'Survive', max_turns: 5 };
    
    const result = evaluate(state, 5, config);
    
    expect(result).toEqual({ status: 'Defeat', reason: 'PartyWiped' });
  });

  it('Input validation: Rejects turn < 1', () => {
    const state: BattleState = { units: [createMockHero()] };
    const config: ObjectiveConfig = { type: 'Clear' };
    
    expect(() => evaluate(state, 0, config)).toThrow(/turn cannot be < 1/);
  });

  it('Input validation: Rejects config with max_turns <= 0', () => {
    const state: BattleState = { units: [createMockHero()] };
    const config: ObjectiveConfig = { type: 'Clear', max_turns: 0 };
    
    expect(() => evaluate(state, 1, config)).toThrow(/max_turns must be > 0/);
    
    config.max_turns = -1;
    expect(() => evaluate(state, 1, config)).toThrow(/max_turns must be > 0/);
  });

  it('Input validation: Rejects Survive/Protect config with max_turns == null', () => {
    const state: BattleState = { units: [createMockHero()] };
    const configSurvive: ObjectiveConfig = { type: 'Survive' };
    const configProtect: ObjectiveConfig = { type: 'Protect', max_turns: null };
    
    expect(() => evaluate(state, 1, configSurvive)).toThrow(/Survive\/Protect config must have max_turns/);
    expect(() => evaluate(state, 1, configProtect)).toThrow(/Survive\/Protect config must have max_turns/);
  });
  
  it('Party-wipe alone never produces Defeat if at least one Hero is alive', () => {
    const state: BattleState = { units: [createMockHero()] };
    const config: ObjectiveConfig = { type: 'Clear' };
    
    const result = evaluate(state, 1, config);
    expect(result.status).not.toBe('Defeat');
  });
});
