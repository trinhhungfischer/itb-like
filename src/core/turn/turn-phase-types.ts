/**
 * Turn & Phase Manager — core state-machine types.
 *
 * Implements: design/gdd/turn-and-phase-manager.md ("States and Transitions").
 * Story: production/epics/turn-phase-manager/story-001-core-phase-loop.md
 */

/**
 * Battle-level state (GDD "States and Transitions": `Setup -> InTurn -> Ended`).
 *
 * `Paused` is a reserved seam ONLY — added 2026-07-28 per story-001's
 * Implementation Notes (ux-designer gate #28 on `settings-and-options.md`
 * Rule 15: the settings screen must be reachable mid-battle). No transition
 * into or out of `Paused` is implemented by this module; nothing in this
 * codebase currently produces or consumes it. It exists so a future pause
 * feature can be added to the battle-level state machine without reshaping
 * the phase ring. Constraint that MUST hold when it is implemented: pausing
 * must never advance the turn counter, consume a Player-Phase action, or
 * touch the undo/redo stacks (Rule 15).
 */
export type BattleState = 'Setup' | 'InTurn' | 'Paused' | 'Ended';

/**
 * The fixed seven-phase ring driven every turn, identical order, no
 * reordering (GDD Core Rule 1, Core Rule 3).
 */
export type Phase =
  | 'TurnStart'
  | 'PlayerPhase'
  | 'Environment'
  | 'EnemyResolve'
  | 'Spawn'
  | 'Telegraph'
  | 'EndCheck';

/**
 * Canonical phase ring order. Exported so callers and tests can assert
 * against the fixed sequence without duplicating the literal array
 * (`phasesPerTurn == 7`, GDD "Fixed structural counts").
 */
export const PHASE_RING: readonly Phase[] = [
  'TurnStart',
  'PlayerPhase',
  'Environment',
  'EnemyResolve',
  'Spawn',
  'Telegraph',
  'EndCheck',
];

/** A battle's single terminal outcome (GDD Rule 6: mutually exclusive). */
export type BattleResult = 'Victory' | 'Defeat' | 'Abandon';
