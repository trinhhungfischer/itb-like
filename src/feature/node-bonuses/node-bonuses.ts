export type NodeBonusId =
  | 'supply_line'
  | 'forward_intel'
  | 'requisition'
  | 'contingency'
  | 'field_hospital'
  | 'campaign_honours';

export type MapNodeType = 'Battle' | 'Elite' | 'Reward' | 'Event' | 'Rest' | 'Boss';

export interface NodeBonusesState {
  claims: NodeBonusId[];
  consumed: Record<string, number>;
}

export const NODE_BONUS_CONFIG = {
  node_bonus_stack_cap: 3,
  stackCap_requisition: 2,
  max_effective_offer_count: 5,
  base: {
    supply_line: 1,
    forward_intel: 1,
    requisition: 1,
    contingency: 1,
    field_hospital: 1,
    campaign_honours: 0
  } as Record<NodeBonusId, number>
};

export function createEmptyNodeBonuses(): NodeBonusesState {
  return { claims: [], consumed: {} };
}

export function bonusForType(nodeType: MapNodeType): NodeBonusId {
  switch (nodeType) {
    case 'Battle': return 'supply_line';
    case 'Elite': return 'forward_intel';
    case 'Reward': return 'requisition';
    case 'Event': return 'contingency';
    case 'Rest': return 'field_hospital';
    case 'Boss': return 'campaign_honours';
  }
}

export function grantBonus(state: NodeBonusesState, nodeType: MapNodeType): NodeBonusesState {
  const bonus = bonusForType(nodeType);
  return {
    ...state,
    claims: [...state.claims, bonus],
    consumed: { ...state.consumed }
  };
}

export function getStackCap(bonusId: NodeBonusId): number {
  if (bonusId === 'requisition') return NODE_BONUS_CONFIG.stackCap_requisition;
  return NODE_BONUS_CONFIG.node_bonus_stack_cap;
}

export function countClaims(bonusId: NodeBonusId, claims: NodeBonusId[]): number {
  return claims.filter(c => c === bonusId).length;
}

export function magnitude(bonusId: NodeBonusId, state: NodeBonusesState): number {
  const c = countClaims(bonusId, state.claims);
  const cap = getStackCap(bonusId);
  return NODE_BONUS_CONFIG.base[bonusId] * Math.min(c, cap);
}

export function pending(bonusId: NodeBonusId, state: NodeBonusesState): number {
  const c = countClaims(bonusId, state.claims);
  const cap = getStackCap(bonusId);
  const consumed = state.consumed[bonusId] || 0;
  return NODE_BONUS_CONFIG.base[bonusId] * Math.max(0, Math.min(c, cap) - consumed);
}

export function consumeOneShot(bonusId: NodeBonusId, state: NodeBonusesState, amount: number = 1): NodeBonusesState {
  const current = state.consumed[bonusId] || 0;
  return {
    ...state,
    consumed: { ...state.consumed, [bonusId]: current + amount }
  };
}

export function effectiveOfferCount(baseOfferCount: number, state: NodeBonusesState): number {
  const reqMag = magnitude('requisition', state);
  const supPen = pending('supply_line', state);
  const total = baseOfferCount + reqMag + supPen;
  return Math.min(total, NODE_BONUS_CONFIG.max_effective_offer_count);
}

export function revealDepth(state: NodeBonusesState): number {
  const intelCount = countClaims('forward_intel', state.claims);
  return 1 + (intelCount >= 1 ? 1 : 0);
}
