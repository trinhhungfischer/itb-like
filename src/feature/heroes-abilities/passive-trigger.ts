import { EventBus } from '../../core/events/event-bus.js';
import type { CombatEventMap, OnActionEvent, OnHitEvent, OnKillEvent } from '../../core/combat/combat-events.js';
import type { PhaseEventMap, TurnStartedEvent } from '../../core/turn/turn-phase-events.js';
import type { EffectPrimitive, UnitId } from '../../core/combat/combat-types.js';
import type { PassiveModuleDefinition } from './equipment.js';
import type { CombatResolver } from '../../core/turn/turn-phase-contracts.js';
import type { Board } from '../../core/board/board-interface.js';

/** Context passed to evaluateEffect to determine the actual generated primitives based on the trigger. */
export type TriggerContext =
  | { trigger: 'OnAction'; event: OnActionEvent }
  | { trigger: 'OnHit'; event: OnHitEvent }
  | { trigger: 'OnKill'; event: OnKillEvent }
  | { trigger: 'OnTurnStart'; event: TurnStartedEvent };

export function registerPassiveModules(
  heroId: UnitId,
  modules: PassiveModuleDefinition[],
  combatBus: EventBus<CombatEventMap>,
  phaseBus: EventBus<PhaseEventMap>,
  combat: CombatResolver,
  getBoard: () => Board,
  evaluateEffect: (module: PassiveModuleDefinition, context: TriggerContext) => EffectPrimitive[]
): void {
  for (const module of modules) {
    switch (module.trigger.type) {
      case 'OnAction':
        combatBus.on('on_action', (event) => {
          if (event.sourceId === heroId) {
            const effects = evaluateEffect(module, { trigger: 'OnAction', event });
            if (effects.length > 0) {
              event.queuePassiveEffect(effects);
            }
          }
        });
        break;

      case 'OnHit':
        combatBus.on('on_hit', (event) => {
          if (event.sourceId === heroId) {
            const effects = evaluateEffect(module, { trigger: 'OnHit', event });
            if (effects.length > 0) {
              event.queuePassiveEffect(effects);
            }
          }
        });
        break;

      case 'OnKill':
        combatBus.on('on_kill', (event) => {
          if (event.sourceId === heroId) {
            const effects = evaluateEffect(module, { trigger: 'OnKill', event });
            if (effects.length > 0) {
              event.queuePassiveEffect(effects);
            }
          }
        });
        break;

      case 'OnTurnStart':
        phaseBus.on('turn_started', (event) => {
          const effects = evaluateEffect(module, { trigger: 'OnTurnStart', event });
          if (effects.length > 0) {
            // Emitted system-phase effects are evaluated directly via combat resolver.
            combat.resolve(getBoard(), effects, { bus: combatBus });
          }
        });
        break;

      case 'Always':
        // Always triggers are evaluated statically (e.g. during max HP compilation),
        // so they don't subscribe to dynamic combat/phase events.
        break;
    }
  }
}
