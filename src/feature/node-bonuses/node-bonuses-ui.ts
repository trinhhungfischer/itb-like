import { NodeBonusId, NodeBonusesState, countClaims, getStackCap } from './node-bonuses';

export interface BadgeConfig {
  id: NodeBonusId;
  icon: string;
  label: string;
  count: number;
  isMaxed: boolean;
}

const BONUS_UI_META: Record<NodeBonusId, { icon: string; label: string }> = {
  supply_line: { icon: '⚔️', label: 'Supply Line' },
  forward_intel: { icon: '👁️', label: 'Forward Intel' },
  requisition: { icon: '💰', label: 'Requisition' },
  contingency: { icon: '🎲', label: 'Contingency' },
  field_hospital: { icon: '⛺', label: 'Field Hospital' },
  campaign_honours: { icon: '👑', label: 'Campaign Honours' }
};

export function getActiveBadges(state: NodeBonusesState): BadgeConfig[] {
  const configs: BadgeConfig[] = [];
  
  for (const id of Object.keys(BONUS_UI_META) as NodeBonusId[]) {
    const claims = countClaims(id, state.claims);
    if (claims > 0) {
      let isMax = false;
      const cap = getStackCap(id);
      
      if (id === 'forward_intel' && claims >= 1) {
        isMax = true;
      } else if (claims >= cap) {
        isMax = true;
      }
      
      configs.push({
        id,
        icon: BONUS_UI_META[id].icon,
        label: BONUS_UI_META[id].label,
        count: claims,
        isMaxed: isMax
      });
    }
  }
  
  return configs;
}

export function renderBonusBadgesHTML(state: NodeBonusesState): string {
  const badges = getActiveBadges(state);
  if (badges.length === 0) return '<div class="node-bonuses-empty">No bonuses</div>';
  
  const badgesHtml = badges.map(b => {
    const countStr = b.isMaxed ? `${b.count} (MAX)` : `${b.count}`;
    return `<div class="node-bonus-badge" title="${b.label}">
  <span class="bonus-icon">${b.icon}</span>
  <span class="bonus-count">x${countStr}</span>
</div>`;
  }).join('\n');
  
  return `<div class="node-bonuses-panel">\n${badgesHtml}\n</div>`;
}
