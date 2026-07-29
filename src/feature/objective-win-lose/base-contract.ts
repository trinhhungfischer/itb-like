import { Unit } from '../heroes-abilities/unit';

export type RunResult = 'Ongoing' | 'Victory' | 'Defeat';

export interface EvaluationResult {
  status: RunResult;
  reason?: string;
}

export type ObjectiveType = 'Survive' | 'Protect' | 'Clear' | 'Reach';

export interface ObjectiveConfig {
  type: ObjectiveType;
  max_turns?: number | null;
  protectedUnitId?: string;
  goalTile?: { col: number; row: number };
}

export interface BattleState {
  units: Unit[];
}

/**
 * Evaluates the battle state against the objective configuration to determine
 * if the battle is ongoing, won, or lost.
 * 
 * @param battleState The current state of the battle
 * @param turn The current turn number (1-indexed)
 * @param config The objective configuration
 * @returns An evaluation result indicating the battle status
 */
export function evaluate(battleState: BattleState, turn: number, config: ObjectiveConfig): EvaluationResult {
  // Input validation
  if (turn < 1) {
    throw new Error('Contract violation: turn cannot be < 1');
  }

  if (config.max_turns !== undefined && config.max_turns !== null && config.max_turns <= 0) {
    throw new Error('Contract violation: max_turns must be > 0');
  }

  if ((config.type === 'Survive' || config.type === 'Protect') && config.max_turns == null) {
    throw new Error('Contract violation: Survive/Protect config must have max_turns');
  }

  if (config.type === 'Protect' && !config.protectedUnitId) {
    throw new Error('Contract violation: Protect config must have protectedUnitId');
  }

  if (config.type === 'Protect') {
    const protectedUnit = battleState.units.find(u => u.id === config.protectedUnitId);
    if (!protectedUnit) {
      return { status: 'Defeat', reason: 'ProtectedUnitLost' };
    }
  }

  // Universal party-wipe defeat predicate
  const heroUnits = battleState.units.filter(u => u.team === 'hero');
  if (heroUnits.length === 0) {
    return { status: 'Defeat', reason: 'PartyWiped' };
  }

  if (config.type === 'Survive' || config.type === 'Protect') {
    if (turn >= config.max_turns!) {
      return { status: 'Victory', reason: 'TurnLimitReached' };
    }
  }

  // (Specific objective logic for Survive/Protect/Clear/Reach will be added here in subsequent stories)
  if (config.type === 'Clear') {
    const enemyUnits = battleState.units.filter(u => u.team === 'enemy');
    if (enemyUnits.length === 0) {
      return { status: 'Victory', reason: 'AllEnemiesCleared' };
    }
    if (config.max_turns && turn >= config.max_turns) {
      return { status: 'Defeat', reason: 'TimeExpired' };
    }
  }

  if (config.type === 'Reach') {
    if (!config.goalTile) {
      throw new Error('Contract violation: Reach config must have goalTile');
    }
    const heroAtGoal = battleState.units.find(
      u => u.team === 'hero' && u.position.col === config.goalTile!.col && u.position.row === config.goalTile!.row
    );
    if (heroAtGoal) {
      return { status: 'Victory', reason: 'GoalTileReached' };
    }
    if (config.max_turns && turn >= config.max_turns) {
      return { status: 'Defeat', reason: 'TimeExpired' };
    }
  }

  return { status: 'Ongoing' };
}
