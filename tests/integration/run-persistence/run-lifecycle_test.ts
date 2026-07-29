import { describe, it, expect } from 'vitest';
import { RunPersistence, StorageAdapter } from '../../../src/foundation/run-persistence/persistence';

class MockStorageAdapter implements StorageAdapter {
  private map = new Map<string, string>();
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, value: string) { this.map.set(key, value); }
  removeItem(key: string) { this.map.delete(key); }
  get length() { return this.map.size; }
  key(index: number) { return Array.from(this.map.keys())[index] ?? null; }
}

describe('Story 005: Run Lifecycle & Single-Slot Rules', () => {

  it('AC14 & AC17: saveRun prevents overwriting a different run ID without explicit clear', () => {
    const storage = new MockStorageAdapter();
    const persistence = new RunPersistence(storage);

    // Initial save (AC14 - exactly once per trigger)
    const run1 = { runSeed: 100, progress: 1 };
    const res1 = persistence.saveRun(run1);
    expect(res1).toEqual({ kind: 'Written' });
    expect(persistence.loadRun()).toEqual({ kind: 'Valid', data: run1 });

    // AC17: attempt to save different run
    const run2 = { runSeed: 200, progress: 1 };
    const res2 = persistence.saveRun(run2);
    expect(res2).toEqual({ kind: 'Rejected_DifferentRun' });

    // Still holds run1
    expect(persistence.loadRun()).toEqual({ kind: 'Valid', data: run1 });

    // Explicit overwrite (update same run)
    const run1Update = { runSeed: 100, progress: 2 };
    const resUpdate = persistence.saveRun(run1Update);
    expect(resUpdate).toEqual({ kind: 'Written' });
    expect(persistence.loadRun()).toEqual({ kind: 'Valid', data: run1Update });

    // Clear explicitly allows run2
    persistence.clearRun();
    const res3 = persistence.saveRun(run2);
    expect(res3).toEqual({ kind: 'Written' });
    expect(persistence.loadRun()).toEqual({ kind: 'Valid', data: run2 });
  });

  it('AC15 & AC16: mergeUnlocksIntoMeta correctly unions array and persists before clearRun', () => {
    const storage = new MockStorageAdapter();
    const persistence = new RunPersistence(storage);

    // Initial meta state
    persistence.saveMeta({ unlocks: ['hero_A'] });

    // Active run
    persistence.saveRun({ runSeed: 300 });

    // Simulate run end
    const unlocksToMerge = ['hero_B', 'hero_A'];
    
    // AC15: merge unlocks into Meta as one atomic call
    const mergeRes = persistence.mergeUnlocksIntoMeta(unlocksToMerge);
    expect(mergeRes).toEqual({ kind: 'Written' });
    
    // AC16: Interruption before clearRun() check - meta is merged, run save still valid
    expect(persistence.loadRun().kind).toBe('Valid');
    
    const metaRes = persistence.loadMeta();
    expect(metaRes.kind).toBe('Valid');
    const unlocks = (metaRes.data as any).unlocks;
    expect(unlocks).toContain('hero_A');
    expect(unlocks).toContain('hero_B');
    expect(unlocks.length).toBe(2);
    
    // Now complete the run-end sequence
    persistence.clearRun();
    expect(persistence.loadRun().kind).toBe('Empty');
  });

});
