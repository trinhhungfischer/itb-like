export type PilotStatus = 'Unassigned' | 'Assigned' | 'Dead';

export interface PilotInstance {
  id: string;
  level: number;
  xp: number;
  status: PilotStatus;
  skills: string[]; 
}

export interface RosterMember {
  id: string;
  pilotId: string | null;
}

export type UnitFinalState = 'Alive' | 'Removed(Defeated)' | 'Removed(Fell)';

export interface DeployedMech {
  rosterMemberId: string;
  pilotId: string | null;
  unit: {
    finalState: UnitFinalState;
  };
}

export interface RunStatePilots {
  pilots: Record<string, PilotInstance>;
}

export interface PilotConfig {
  pilot_xp_per_battle: number;
  pilot_level_thresholds: number[]; 
  pilot_max_level: number; 
  pilot_skill_offer_count: number; 
  pilot_seed_xp_lag: number; 
}

export const DEFAULT_PILOT_CONFIG: PilotConfig = {
  pilot_xp_per_battle: 1,
  pilot_level_thresholds: [2, 3],
  pilot_max_level: 3,
  pilot_skill_offer_count: 3,
  pilot_seed_xp_lag: 1
};

// PRNG for F3
export function mulberry32(a: number): () => number {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

// Helper to shuffle
function shuffle<T>(array: T[], rng: () => number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// F8 - Config/Content Validation
export function validatePilotConfig(cfg: PilotConfig, unlockedSkillCatalog: string[]) {
  if (cfg.pilot_level_thresholds.length !== cfg.pilot_max_level - 1) {
    throw new Error('pilot_level_thresholds length must be pilot_max_level - 1');
  }
  
  for (let i = 1; i < cfg.pilot_level_thresholds.length; i++) {
    if (cfg.pilot_level_thresholds[i] <= cfg.pilot_level_thresholds[i - 1]) {
      throw new Error('pilot_level_thresholds must be strictly ascending');
    }
  }

  if (unlockedSkillCatalog.length < cfg.pilot_skill_offer_count + cfg.pilot_max_level) {
    throw new Error('Skill catalog too small for configured offer count and max level');
  }
}

// F1 - XP Award
export function awardXP(deployedLoadout: DeployedMech[], pilots: Record<string, PilotInstance>, cfg: PilotConfig = DEFAULT_PILOT_CONFIG) {
  for (const mech of deployedLoadout) {
    if (mech.pilotId && pilots[mech.pilotId]) {
      const pilot = pilots[mech.pilotId];
      if (pilot.status !== 'Dead' && !mech.unit.finalState.startsWith('Removed')) {
        pilot.xp += cfg.pilot_xp_per_battle;
      }
    }
  }
}

// F2 - Level from XP
export function getLevelFromXP(xp: number, cfg: PilotConfig = DEFAULT_PILOT_CONFIG): number {
  let lvl = 1;
  // pilot_level_thresholds is 0-indexed, but corresponds to target levels 2..L
  for (let i = 2; i <= cfg.pilot_max_level; i++) {
    if (xp >= cfg.pilot_level_thresholds[i - 2]) {
      lvl = i;
    } else {
      break;
    }
  }
  return lvl;
}

// F3 - Level-up skill offer generation
export function generateSkillOffers(pilot: PilotInstance, runSeed: number, levelBeingGained: number, catalog: string[], cfg: PilotConfig = DEFAULT_PILOT_CONFIG): string[] {
  const eligible = catalog.filter(skill => !pilot.skills.includes(skill));
  
  // mix(runSeed, pilot.id, pilot.level) -> simplistic hash for seed
  // The GDD says: mulberry32(mix(runSeed, pilot.id, pilot.level)) where level is the level being gained
  const stringToHash = `${runSeed}:${pilot.id}:${levelBeingGained}`;
  let hash = 0;
  for (let i = 0; i < stringToHash.length; i++) {
    hash = Math.imul(31, hash) + stringToHash.charCodeAt(i) | 0;
  }
  
  const rng = mulberry32(hash);
  const shuffled = shuffle(eligible, rng);
  
  return shuffled.slice(0, cfg.pilot_skill_offer_count);
}

// F4 - Pilot death resolution
export function resolvePilotDeath(deployedLoadout: DeployedMech[], pilots: Record<string, PilotInstance>) {
  for (const mech of deployedLoadout) {
    if ((mech.unit.finalState === 'Removed(Defeated)' || mech.unit.finalState === 'Removed(Fell)') && mech.pilotId) {
      if (pilots[mech.pilotId]) {
        pilots[mech.pilotId].status = 'Dead';
      }
      mech.pilotId = null;
    }
  }
}

// F5 - PilotOffer eligibility
export function pilotOfferEligible(rosterMembers: RosterMember[]): boolean {
  return rosterMembers.some(m => m.pilotId === null);
}

// F6 - Effective pilot skill set
export function getEffectiveSkills(mech: RosterMember, pilots: Record<string, PilotInstance>): string[] {
  if (mech.pilotId && pilots[mech.pilotId] && pilots[mech.pilotId].status !== 'Dead') {
    return [...pilots[mech.pilotId].skills];
  }
  return [];
}

// Handle Level-Ups sequentially (Edge Case loop)
export function resolveLevelUps(pilot: PilotInstance, runSeed: number, catalog: string[], onOfferCreated: (offers: string[]) => string, cfg: PilotConfig = DEFAULT_PILOT_CONFIG) {
  const targetLevel = getLevelFromXP(pilot.xp, cfg);
  for (let L = pilot.level + 1; L <= targetLevel; L++) {
    const offers = generateSkillOffers(pilot, runSeed, L, catalog, cfg);
    const chosen = onOfferCreated(offers);
    if (!chosen || !offers.includes(chosen)) {
      throw new Error('Must choose a valid skill from offers');
    }
    pilot.skills.push(chosen);
    pilot.level = L;
  }
}

// F7 - Seed XP for mid-run recruits
export function getSeedXP(combatsElapsed: number, cfg: PilotConfig = DEFAULT_PILOT_CONFIG): number {
  const baseXP = (combatsElapsed - cfg.pilot_seed_xp_lag) * cfg.pilot_xp_per_battle;
  const maxAllowedXP = cfg.pilot_level_thresholds[cfg.pilot_max_level - 2] - 1;
  return Math.max(0, Math.min(baseXP, maxAllowedXP));
}
