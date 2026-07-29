import { describe, it, expect } from 'vitest';
import { evaluate, BattleState, ObjectiveConfig } from '../../../src/feature/objective-win-lose/base-contract';
import { Unit } from '../../../src/feature/heroes-abilities/unit';

function createUnit(id: string, team: 'hero' | 'enemy', col: number, row: number): Unit {
  return {
    id,
    team,
    archetype: 'test_archetype',
    maxHP: 10,
    currentHP: 10,
    position: { col, row },
    size: 1,
    abilities: [],
    hazardImmunities: [],
    statusFlags: [],
    moveSlot: 'Available',
    abilitySlot: 'Available'
  };
}

describe('Objective evaluate() - Clear & Reach', () => {
  describe('Clear Type', () => {
    it('AC-1: Returns Victory (AllEnemiesCleared) when enemiesRemaining == 0', () => {
      const state: BattleState = {
        units: [
          createUnit('hero1', 'hero', 0, 0)
        ]
      };
      const config: ObjectiveConfig = { type: 'Clear', max_turns: null };
      
      const result = evaluate(state, 1, config);
      
      expect(result).toEqual({ status: 'Victory', reason: 'AllEnemiesCleared' });
    });

    it('AC-2: Returns Defeat (TimeExpired) at deadline when enemiesRemaining > 0', () => {
      const state: BattleState = {
        units: [
          createUnit('hero1', 'hero', 0, 0),
          createUnit('enemy1', 'enemy', 1, 1)
        ]
      };
      const config: ObjectiveConfig = { type: 'Clear', max_turns: 5 };
      
      const result = evaluate(state, 5, config);
      
      expect(result).toEqual({ status: 'Defeat', reason: 'TimeExpired' });
    });

    it('AC: Returns Ongoing if enemiesRemaining > 0 and no party wipe', () => {
      const state: BattleState = {
        units: [
          createUnit('hero1', 'hero', 0, 0),
          createUnit('enemy1', 'enemy', 1, 1)
        ]
      };
      const config: ObjectiveConfig = { type: 'Clear', max_turns: 5 };
      
      const result = evaluate(state, 4, config);
      
      expect(result).toEqual({ status: 'Ongoing' });
    });

    it('AC: Victory takes precedence over deadline if both enemiesRemaining == 0 and turn >= max_turns', () => {
      const state: BattleState = {
        units: [
          createUnit('hero1', 'hero', 0, 0)
        ]
      };
      const config: ObjectiveConfig = { type: 'Clear', max_turns: 5 };
      
      const result = evaluate(state, 5, config);
      
      expect(result).toEqual({ status: 'Victory', reason: 'AllEnemiesCleared' });
    });
  });

  describe('Reach Type', () => {
    it('AC-3: Returns Victory (GoalTileReached) when goalTile is occupied by a living Hero-faction unit', () => {
      const state: BattleState = {
        units: [
          createUnit('hero1', 'hero', 6, 1)
        ]
      };
      const config: ObjectiveConfig = { type: 'Reach', goalTile: { col: 6, row: 1 } };
      
      const result = evaluate(state, 1, config);
      
      expect(result).toEqual({ status: 'Victory', reason: 'GoalTileReached' });
    });

    it('AC-4: Returns Ongoing when goalTile is occupied by an Enemy-faction unit', () => {
      const state: BattleState = {
        units: [
          createUnit('hero1', 'hero', 0, 0),
          createUnit('enemy1', 'enemy', 6, 1)
        ]
      };
      const config: ObjectiveConfig = { type: 'Reach', goalTile: { col: 6, row: 1 } };
      
      const result = evaluate(state, 1, config);
      
      expect(result).toEqual({ status: 'Ongoing' });
    });

    it('AC: Returns Defeat (TimeExpired) if turn >= max_turns and goalTile not occupied by hero', () => {
      const state: BattleState = {
        units: [
          createUnit('hero1', 'hero', 0, 0)
        ]
      };
      const config: ObjectiveConfig = { type: 'Reach', goalTile: { col: 6, row: 1 }, max_turns: 5 };
      
      const result = evaluate(state, 5, config);
      
      expect(result).toEqual({ status: 'Defeat', reason: 'TimeExpired' });
    });

    it('AC: No memory of mid-turn occupancy; check is strictly based on occupancy at evaluation time', () => {
      const state: BattleState = {
        units: [
          createUnit('hero1', 'hero', 0, 0) // hero moved away from goal tile
        ]
      };
      const config: ObjectiveConfig = { type: 'Reach', goalTile: { col: 6, row: 1 } };
      
      const result = evaluate(state, 1, config);
      
      expect(result).toEqual({ status: 'Ongoing' });
    });
    
    it('Input validation: Rejects missing goalTile config', () => {
      const state: BattleState = {
        units: [
          createUnit('hero1', 'hero', 0, 0)
        ]
      };
      const config: ObjectiveConfig = { type: 'Reach' };
      
      expect(() => evaluate(state, 1, config)).toThrowError('Contract violation: Reach config must have goalTile');
    });
  });
});
