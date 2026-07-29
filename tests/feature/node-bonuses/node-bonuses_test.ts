import { describe, it, expect } from 'vitest';
import {
  createEmptyNodeBonuses,
  grantBonus,
  magnitude,
  pending,
  consumeOneShot,
  effectiveOfferCount,
  revealDepth,
  NODE_BONUS_CONFIG
} from '../../../src/feature/node-bonuses/node-bonuses';

describe('Node Bonuses', () => {
  it('accumulates claims properly and applies bonuses', () => {
    let state = createEmptyNodeBonuses();
    
    // GIVEN a route claiming Battle, Reward, Battle, Rest, Elite, Reward, Boss
    state = grantBonus(state, 'Battle'); // supply_line
    state = grantBonus(state, 'Reward'); // requisition
    state = grantBonus(state, 'Battle'); // supply_line
    state = grantBonus(state, 'Rest');   // field_hospital
    state = grantBonus(state, 'Elite');  // forward_intel
    state = grantBonus(state, 'Reward'); // requisition
    state = grantBonus(state, 'Boss');   // campaign_honours

    // THEN RunState.nodeBonuses contains exactly 7 entries with Supply Line ×2 and Requisition ×2
    expect(state.claims.length).toBe(7);
    expect(state.claims.filter(c => c === 'supply_line').length).toBe(2);
    expect(state.claims.filter(c => c === 'requisition').length).toBe(2);
  });

  it('respects the per-bonus stack cap', () => {
    let state = createEmptyNodeBonuses();
    // GIVEN node_bonus_stack_cap = 3 and a bonus claimed 4 times
    state = grantBonus(state, 'Battle');
    state = grantBonus(state, 'Battle');
    state = grantBonus(state, 'Battle');
    state = grantBonus(state, 'Battle'); // 4th
    
    // THEN magnitude is base * 3, not base * 4
    expect(magnitude('supply_line', state)).toBe(NODE_BONUS_CONFIG.base.supply_line * 3);
    
    // GIVEN Requisition claimed 3 times
    let reqState = createEmptyNodeBonuses();
    reqState = grantBonus(reqState, 'Reward');
    reqState = grantBonus(reqState, 'Reward');
    reqState = grantBonus(reqState, 'Reward');
    
    // THEN magnitude(requisition) is base * 2
    expect(magnitude('requisition', reqState)).toBe(NODE_BONUS_CONFIG.base.requisition * 2);
  });

  it('handles one-shot consumption', () => {
    let state = createEmptyNodeBonuses();
    // GIVEN Supply Line claimed twice with one already consumed
    state = grantBonus(state, 'Battle');
    state = grantBonus(state, 'Battle');
    state = consumeOneShot('supply_line', state);
    
    // THEN pending(supply_line) is base * 1
    expect(pending('supply_line', state)).toBe(NODE_BONUS_CONFIG.base.supply_line * 1);
  });

  it('calculates effective draft offer count', () => {
    let state = createEmptyNodeBonuses();
    // GIVEN base offerCount = 3, Requisition x2, one unconsumed Supply Line
    state = grantBonus(state, 'Reward');
    state = grantBonus(state, 'Reward');
    state = grantBonus(state, 'Battle');
    
    // THEN it offers 6 but clamped to 5
    const originalMax = NODE_BONUS_CONFIG.max_effective_offer_count;
    expect(effectiveOfferCount(3, state)).toBe(Math.min(6, originalMax));
    expect(effectiveOfferCount(3, state)).toBe(5);
    
    // THEN the next Reward node consumes Supply line
    state = consumeOneShot('supply_line', state, pending('supply_line', state));
    
    // THEN it offers 5
    expect(effectiveOfferCount(3, state)).toBe(5);
  });

  it('calculates reveal depth', () => {
    let state = createEmptyNodeBonuses();
    // 0 claims -> 1
    expect(revealDepth(state)).toBe(1);
    
    // 1 claim -> 2
    state = grantBonus(state, 'Elite');
    expect(revealDepth(state)).toBe(2);
    
    // 2 claims -> still 2
    state = grantBonus(state, 'Elite');
    expect(revealDepth(state)).toBe(2);
  });

  it('calculates 0 magnitude for 0 claims', () => {
    const state = createEmptyNodeBonuses();
    expect(magnitude('supply_line', state)).toBe(0);
  });
});
