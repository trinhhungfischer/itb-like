import { describe, it, expect } from 'vitest';
import { 
  awardXP, 
  DEFAULT_PILOT_CONFIG, 
  DeployedMech, 
  generateSkillOffers, 
  getEffectiveSkills, 
  getLevelFromXP, 
  getSeedXP,
  pilotOfferEligible, 
  PilotInstance, 
  resolveLevelUps, 
  resolvePilotDeath, 
  RosterMember,
  validatePilotConfig
} from '../../../src/feature/pilots/pilots';

describe('Pilots System', () => {
  const catalog = ['skill1', 'skill2', 'skill3', 'skill4', 'skill5', 'skill6', 'skill7', 'skill8'];

  it('F1 - Awards XP to surviving mechs only', () => {
    const pilots: Record<string, PilotInstance> = {
      p1: { id: 'p1', level: 1, xp: 0, status: 'Assigned', skills: ['innate1'] },
      p2: { id: 'p2', level: 1, xp: 0, status: 'Assigned', skills: ['innate2'] }
    };

    const deployed: DeployedMech[] = [
      { rosterMemberId: 'm1', pilotId: 'p1', unit: { finalState: 'Alive' } },
      { rosterMemberId: 'm2', pilotId: 'p2', unit: { finalState: 'Removed(Defeated)' } }
    ];

    awardXP(deployed, pilots);

    expect(pilots.p1.xp).toBe(1);
    expect(pilots.p2.xp).toBe(0);
  });

  it('F2 - Calculates Level from XP correctly', () => {
    expect(getLevelFromXP(0)).toBe(1);
    expect(getLevelFromXP(1)).toBe(1);
    expect(getLevelFromXP(2)).toBe(2);
    expect(getLevelFromXP(3)).toBe(3);
    expect(getLevelFromXP(4)).toBe(3);
  });

  it('F4 - Pilot death resolution', () => {
    const pilots: Record<string, PilotInstance> = {
      p1: { id: 'p1', level: 3, xp: 4, status: 'Assigned', skills: ['innate1'] }
    };

    const deployed: DeployedMech[] = [
      { rosterMemberId: 'm1', pilotId: 'p1', unit: { finalState: 'Removed(Fell)' } }
    ];

    resolvePilotDeath(deployed, pilots);

    expect(pilots.p1.status).toBe('Dead');
    expect(deployed[0].pilotId).toBeNull();
  });

  it('F6 - Effective skills', () => {
    const pilots: Record<string, PilotInstance> = {
      p1: { id: 'p1', level: 2, xp: 2, status: 'Assigned', skills: ['s1', 's2'] },
      p2: { id: 'p2', level: 2, xp: 2, status: 'Dead', skills: ['s3', 's4'] }
    };

    const m1: RosterMember = { id: 'm1', pilotId: 'p1' };
    const m2: RosterMember = { id: 'm2', pilotId: 'p2' };
    const m3: RosterMember = { id: 'm3', pilotId: null };

    expect(getEffectiveSkills(m1, pilots)).toEqual(['s1', 's2']);
    expect(getEffectiveSkills(m2, pilots)).toEqual([]);
    expect(getEffectiveSkills(m3, pilots)).toEqual([]);
  });

  it('F8 - Config Validation', () => {
    expect(() => validatePilotConfig(DEFAULT_PILOT_CONFIG, catalog)).not.toThrow();

    expect(() => validatePilotConfig({
      ...DEFAULT_PILOT_CONFIG,
      pilot_level_thresholds: [3, 2] // not ascending
    }, catalog)).toThrow();

    expect(() => validatePilotConfig(DEFAULT_PILOT_CONFIG, ['s1', 's2'])).toThrow(); // catalog too small
  });

  it('Resolve Level Ups', () => {
    const pilot: PilotInstance = { id: 'p1', level: 1, xp: 3, status: 'Assigned', skills: ['innate'] };
    
    const offeredLists: string[][] = [];
    resolveLevelUps(pilot, 12345, catalog, (offers) => {
      offeredLists.push(offers);
      return offers[0]; // pick first
    });

    expect(pilot.level).toBe(3);
    expect(pilot.skills.length).toBe(3); // innate + 2 new
    expect(offeredLists.length).toBe(2);
  });

  it('F7 - Seed XP for mid-run recruits', () => {
    // defaults: T = [2, 3], maxAllowedXP = T[1]-1 = 2.
    // seed_xp_lag = 1
    // xp_per_battle = 1
    expect(getSeedXP(0)).toBe(0); // 0-1 < 0 -> 0
    expect(getSeedXP(1)).toBe(0); // 1-1 = 0
    expect(getSeedXP(2)).toBe(1); // 2-1 = 1
    expect(getSeedXP(3)).toBe(2); // 3-1 = 2
    expect(getSeedXP(4)).toBe(2); // 4-1 = 3 -> capped at 2
  });
});
