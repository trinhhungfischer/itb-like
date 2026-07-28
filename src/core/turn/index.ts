/**
 * Turn & Phase Manager — public module surface.
 *
 * Implements: design/gdd/turn-and-phase-manager.md
 */

export type { BattleState, Phase, BattleResult } from './turn-phase-types.js';
export { PHASE_RING } from './turn-phase-types.js';

export type {
  CombatResolver,
  EffectPrimitive,
  EnemyDriver,
  EnvironmentDriver,
  ObjectiveEvaluator,
  ObjectiveResult,
  EvaluationResult,
  BattleStateView,
  ObjectiveConfig,
} from './turn-phase-contracts.js';

export type { PhaseEventMap } from './turn-phase-events.js';
export type {
  TurnStartedEvent,
  PlayerPhaseBegunEvent,
  ActionAppliedEvent,
  ActionUndoneEvent,
  EnvironmentResolvedEvent,
  HazardTickedEvent,
  EnemyActionResolvedEvent,
  EnemySpawnedEvent,
  IntentsTelegraphedEvent,
  BattleEndedEvent,
} from './turn-phase-events.js';

export type { TurnPhaseConfig } from './turn-phase-config.js';
export {
  DEFAULT_TURN_PHASE_CONFIG,
  SQUAD_SIZE_DEFAULT,
  ACTIONS_PER_HERO_TURN_DEFAULT,
  UNDO_LEVELS_UPPER_BOUND_DEFAULT,
} from './turn-phase-config.js';

export { turnsElapsed, turnsRemaining, TURNS_REMAINING_UNCAPPED, undoLevelsUpperBound } from './turn-phase-formulas.js';

export type { TurnRejectReason, TurnResult, ApplyActionResult } from './turn-phase-result.js';
export { TURN_OK, turnReject, TurnInvariantError, turnInvariant } from './turn-phase-result.js';

export { TurnPhaseManager } from './turn-phase-manager.js';
export type { TurnPhaseManagerDeps } from './turn-phase-manager.js';
