import { describe, it, expect, beforeEach } from 'vitest';
import { RunPersistence, StorageAdapter, checksum } from '../../../src/foundation/run-persistence/persistence';

class MockStorage implements StorageAdapter {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  // Helper for tests
  inspectStore(): Map<string, string> {
    return this.store;
  }
}

describe('Run Persistence: Envelope Serialization & Round Trip (Story 001)', () => {
  let storage: MockStorage;
  let persistence: RunPersistence;

  beforeEach(() => {
    storage = new MockStorage();
    persistence = new RunPersistence(storage);
  });

  it('AC1: saveRun(data) followed by loadRun() returns Valid with deep-equal data', () => {
    const data = {
      runSeed: 12345,
      nodeId: 'node-A',
      roster: [{ id: 'hero-1', hp: 10 }]
    };

    const writeResult = persistence.saveRun(data);
    expect(writeResult).toEqual({ kind: 'Written' });

    const loadResult = persistence.loadRun();
    expect(loadResult).toEqual({ kind: 'Valid', data });
  });

  it('AC2: saveMeta followed by loadMeta returns Valid with deep-equal data (independent round-trip)', () => {
    const metaData = {
      unlockedHeroes: ['hero-1', 'hero-2'],
      wins: 5
    };

    const writeResult = persistence.saveMeta(metaData);
    expect(writeResult).toEqual({ kind: 'Written' });

    const loadResult = persistence.loadMeta();
    expect(loadResult).toEqual({ kind: 'Valid', data: metaData });
  });

  it('AC3: Determinism - two identical write sequences produce byte-identical stored strings', () => {
    const data = {
      runSeed: 42,
      history: ['node-A', 'node-B']
    };

    const storage1 = new MockStorage();
    const persistence1 = new RunPersistence(storage1);
    persistence1.saveRun(data);

    const storage2 = new MockStorage();
    const persistence2 = new RunPersistence(storage2);
    persistence2.saveRun(data);

    const raw1 = storage1.getItem('vanguard.run.v1');
    const raw2 = storage2.getItem('vanguard.run.v1');

    expect(raw1).toBe(raw2);
    expect(raw1).toBeTruthy(); // Should not be null
  });

  it('AC13: loadRun() when no save exists returns Empty', () => {
    const loadResult = persistence.loadRun();
    expect(loadResult).toEqual({ kind: 'Empty' });
  });

  it('Checksum reference vector: checksum("AB") === 197', () => {
    expect(checksum('AB')).toBe(197);
  });

  it('Rejects corrupted saves on load', () => {
    const data = { runSeed: 1 };
    persistence.saveRun(data);
    
    // Mutate the saved string
    const raw = storage.getItem('vanguard.run.v1');
    expect(raw).toBeTruthy();
    
    const mutatedRaw = raw!.replace('runSeed":1', 'runSeed":2');
    storage.setItem('vanguard.run.v1', mutatedRaw);
    
    const loadResult = persistence.loadRun();
    expect(loadResult).toEqual({ kind: 'Corrupted' });
  });
  
  it('Leaves newer schema versions untouched on disk (Unsupported)', () => {
    const rawNewer = JSON.stringify({
      schemaVersion: 999,
      checksum: checksum('{"test":true}'),
      data: { test: true }
    });
    
    storage.setItem('vanguard.run.v1', rawNewer);
    
    const loadResult = persistence.loadRun();
    expect(loadResult).toEqual({ kind: 'Unsupported' });
    
    // Key should be untouched
    expect(storage.getItem('vanguard.run.v1')).toBe(rawNewer);
  });
});
