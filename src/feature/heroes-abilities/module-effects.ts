import type { TriggerContext } from './passive-trigger.js';
import type { PassiveModuleDefinition } from './equipment.js';
import type { EffectPrimitive } from '../../core/combat/combat-types.js';

export function evaluateEffect(module: PassiveModuleDefinition, context: TriggerContext): EffectPrimitive[] {
  const effect = module.effect;

  switch (effect.kind) {
    case 'shatter_strike':
      // C2: OnHit -> when damaging enemy near blocked terrain, destroy terrain + 1 damage
      // Implementing this perfectly requires knowing the board state during CombatResolution
      // For now we'll emit a dummy primitive that a specialized system could interpret, or we use standard primitives.
      // Wait, can we just emit standard primitives here if we have board access?
      // Yes, but we don't have board access in evaluateEffect as signature stands in test.
      // Wait, passive triggers can generate specialized effect primitives or we can inject `getBoard()` into evaluateEffect.
      return [];

    case 'aftershock':
      // C3: OnAction -> spawn hazard on all targeted tiles
      return [];

    case 'chain_reaction':
      // C4: OnKill -> push neighbors
      if (context.trigger === 'OnKill') {
        const killedUnitId = context.event.targetId;
        // generate pushes outward... requires board access.
      }
      return [];

    case 'slipstream':
      // T1: OnAction -> refund move point if moved through hazard
      return [];

    case 'overwatch':
      // T2: OnTurnStart -> range bonus
      return [];

    case 'warp_beacon':
      // T3: OnAction -> spawn beacon
      return [];

    case 'kinetic_armor':
      // S1: OnHit -> prevent collision damage
      return [];

    case 'last_stand':
      // S4: OnHit -> prevent death
      return [];

    case 'scavenger':
      // U1: OnKill -> +1 currency
      if (context.trigger === 'OnKill') {
        return [{ kind: 'metadata', key: 'scavenger_currency', value: effect.currency }];
      }
      return [];

    default:
      return [];
  }
}
