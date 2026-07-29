import { describe, it, expect } from 'vitest';
import { getActiveBadges, renderBonusBadgesHTML } from '../../../src/feature/node-bonuses/node-bonuses-ui';
import { createEmptyNodeBonuses, grantBonus } from '../../../src/feature/node-bonuses/node-bonuses';

describe('Node Bonuses UI', () => {
  it('returns empty badges array for empty state', () => {
    const state = createEmptyNodeBonuses();
    expect(getActiveBadges(state)).toEqual([]);
    expect(renderBonusBadgesHTML(state)).toContain('No bonuses');
  });

  it('generates correct badges for accumulated claims', () => {
    let state = createEmptyNodeBonuses();
    state = grantBonus(state, 'Battle'); // supply_line
    state = grantBonus(state, 'Reward'); // requisition
    state = grantBonus(state, 'Reward'); // requisition (MAX because cap is 2)
    state = grantBonus(state, 'Elite');  // forward_intel (MAX because cap is 1)

    const badges = getActiveBadges(state);
    expect(badges.length).toBe(3);
    
    const reqBadge = badges.find(b => b.id === 'requisition')!;
    expect(reqBadge.count).toBe(2);
    expect(reqBadge.isMaxed).toBe(true);

    const intBadge = badges.find(b => b.id === 'forward_intel')!;
    expect(intBadge.count).toBe(1);
    expect(intBadge.isMaxed).toBe(true);
    
    const supBadge = badges.find(b => b.id === 'supply_line')!;
    expect(supBadge.count).toBe(1);
    expect(supBadge.isMaxed).toBe(false);
  });

  it('renders HTML panel correctly', () => {
    let state = createEmptyNodeBonuses();
    state = grantBonus(state, 'Reward');
    
    const html = renderBonusBadgesHTML(state);
    expect(html).toContain('class="node-bonuses-panel"');
    expect(html).toContain('class="node-bonus-badge"');
    expect(html).toContain('x1');
    expect(html).toContain('Requisition');
  });
});
