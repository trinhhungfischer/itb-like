/**
 * Turn & Phase Manager — phase event vocabulary (ADR-0002).
 *
 * Implements: design/gdd/turn-and-phase-manager.md ("States and
 * Transitions" emits column); story-002-phase-events.md AC-1.
 *
 * Ten canonical, fixed phase events. Per ADR-0002's own worked example for
 * this manager, the event map is declared with `type` (not `interface`) —
 * TS only structurally matches the `EventMap` index-signature constraint
 * (`Record<string, BusEvent>`) against type aliases, not interfaces; using
 * `interface` here would produce TS2344 at `EventBus<PhaseEventMap>`. The
 * individual per-event payload shapes below may (and do) use `interface`,
 * mirroring the pattern already established in
 * tests/unit/event-bus/event_bus_test.ts's `PingEvent`/`PongEvent` fixtures
 * and `EventMap = Record<string, BusEvent>`'s own constraint.
 */

import type { BusEvent } from '../events/event-bus.js';
import type { BattleResult } from './turn-phase-types.js';

/** Turn Start: the turn counter has just incremented to `turn`. */
export interface TurnStartedEvent extends BusEvent {
  readonly type: 'turn_started';
  readonly turn: number;
}

/** Player Phase has begun for `turn`; undo/redo stack now holds exactly the phase-start snapshot. */
export interface PlayerPhaseBegunEvent extends BusEvent {
  readonly type: 'player_phase_begun';
  readonly turn: number;
}

/** A Player-Phase action's full consequence chain resolved and a snapshot was pushed. `stackDepth` is the undo stack's new size (Formula F2). */
export interface ActionAppliedEvent extends BusEvent {
  readonly type: 'action_applied';
  readonly turn: number;
  readonly stackDepth: number;
}

/**
 * An in-phase action was undone (a snapshot was popped and adopted).
 * `stackDepth` is the undo stack's new size after the pop. Not emitted for
 * a no-op undo at the phase-start snapshot (nothing was actually undone).
 */
export interface ActionUndoneEvent extends BusEvent {
  readonly type: 'action_undone';
  readonly turn: number;
  readonly stackDepth: number;
}

/** Environment phase resolution completed (hazard ticks + telegraphed environmental effects applied), strictly before EnemyResolve. */
export interface EnvironmentResolvedEvent extends BusEvent {
  readonly type: 'environment_resolved';
  readonly turn: number;
}

/**
 * Tile hazards ticked during the Environment phase. Judgment call: emitted
 * once per Environment phase as a completion marker (not once per
 * hazard-tile), since the Environment content system does not exist yet to
 * report per-hazard detail. See the implementer's report.
 */
export interface HazardTickedEvent extends BusEvent {
  readonly type: 'hazard_ticked';
  readonly turn: number;
}

/** Enemy Resolve phase completed: previously telegraphed enemy actions executed. */
export interface EnemyActionResolvedEvent extends BusEvent {
  readonly type: 'enemy_action_resolved';
  readonly turn: number;
}

/** Spawn phase completed: telegraphed enemy spawns emerged onto their spawn tiles. */
export interface EnemySpawnedEvent extends BusEvent {
  readonly type: 'enemy_spawned';
  readonly turn: number;
}

/** Telegraph phase (or Setup) completed: every surviving enemy and active environmental effect has displayed its intent for `turn` (the turn these intents apply to, i.e. the NEXT turn during a normal Telegraph phase). */
export interface IntentsTelegraphedEvent extends BusEvent {
  readonly type: 'intents_telegraphed';
  readonly turn: number;
}

/** The battle reached a terminal result. Emitted exactly once per battle (GDD Rule 6). */
export interface BattleEndedEvent extends BusEvent {
  readonly type: 'battle_ended';
  readonly turn: number;
  readonly result: BattleResult;
}

/** The full, closed phase-event vocabulary this manager emits (story-002 AC-1). */
export type PhaseEventMap = {
  turn_started: TurnStartedEvent;
  player_phase_begun: PlayerPhaseBegunEvent;
  action_applied: ActionAppliedEvent;
  action_undone: ActionUndoneEvent;
  environment_resolved: EnvironmentResolvedEvent;
  hazard_ticked: HazardTickedEvent;
  enemy_action_resolved: EnemyActionResolvedEvent;
  enemy_spawned: EnemySpawnedEvent;
  intents_telegraphed: IntentsTelegraphedEvent;
  battle_ended: BattleEndedEvent;
};
