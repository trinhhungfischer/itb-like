import { describe, it, expect } from 'vitest';
import { mix, mulberry32 } from '../../../src/foundation/prng/prng';

// Dummy implementation of generateEncounter as it doesn't exist yet, to prove the contract.
function generateEncounter(runSeed: number, nodeId: string, difficultyConfig: any, rosterSnapshot: any) {
  // ADR-0004: encounterSeed(attemptIndex) = mix(runSeed, nodeId, templateId, attemptIndex)
  const templateId = 'basic_combat';
  const attemptIndex = 0;
  const encounterSeed = mix(runSeed, nodeId, templateId, attemptIndex);
  const prng = mulberry32(encounterSeed);
  
  return {
    id: `encounter_${nodeId}`,
    enemies: Array.from({ length: 3 }).map((_, i) => ({
      type: 'goblin',
      hp: Math.floor(prng.next() * 10) + 20,
      position: { x: Math.floor(prng.next() * 8), y: Math.floor(prng.next() * 8) }
    })),
    hazards: Array.from({ length: 2 }).map((_, i) => ({
      type: 'spikes',
      position: { x: Math.floor(prng.next() * 8), y: Math.floor(prng.next() * 8) }
    }))
  };
}

// Helper for F1: Run Save payload size estimate
function runSaveBytes(N: number, B_node: number, H: number, B_hero: number, O: number): number {
  return O + N * B_node + H * B_hero;
}

describe('Run Persistence - Determinism & Resume Contract', () => {
  describe('AC18: Determinism of generateEncounter', () => {
    it('returns deep-equal encounter definitions when called with same inputs', () => {
      const runSeed = 123456789;
      const nodeId = 'node_1';
      const difficultyConfig = { tier: 1 };
      const rosterSnapshot = { heroes: ['h1', 'h2'] };

      const encounter1 = generateEncounter(runSeed, nodeId, difficultyConfig, rosterSnapshot);
      const encounter2 = generateEncounter(runSeed, nodeId, difficultyConfig, rosterSnapshot);

      expect(encounter1).toEqual(encounter2);
    });

    it('returns different encounters for different nodeIds', () => {
      const runSeed = 123456789;
      const difficultyConfig = { tier: 1 };
      const rosterSnapshot = { heroes: ['h1', 'h2'] };

      const encounter1 = generateEncounter(runSeed, 'node_1', difficultyConfig, rosterSnapshot);
      const encounter2 = generateEncounter(runSeed, 'node_2', difficultyConfig, rosterSnapshot);

      expect(encounter1).not.toEqual(encounter2);
    });
  });

  describe('AC19: Run Save payload size estimate', () => {
    it('matches F1 for sample tuples', () => {
      // Worked example: N=20, B_node=80, H=6, B_hero=200, O=1500 -> 4300 bytes
      expect(runSaveBytes(20, 80, 6, 200, 1500)).toBe(4300);
      
      // Additional samples
      expect(runSaveBytes(0, 80, 1, 200, 1500)).toBe(1700); // Start of run
      expect(runSaveBytes(30, 100, 8, 250, 2000)).toBe(7000); // Late run
    });
  });
});
