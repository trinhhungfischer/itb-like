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

  inspectStore(): Map<string, string> {
    return this.store;
  }
}

describe('Run Persistence: Checksum & Corruption Detection (Story 002)', () => {
  let storage: MockStorage;
  let persistence: RunPersistence;

  beforeEach(() => {
    storage = new MockStorage();
    persistence = new RunPersistence(storage);
  });

  it('test_ac20_checksum_ab_is_197', () => {
    expect(checksum('AB')).toBe(197);
  });

  it('test_ac4_mutated_character_quarantined_and_cleared', () => {
    // GIVEN a valid Run Save
    const data = { runSeed: 123 };
    persistence.saveRun(data);
    
    let raw = storage.getItem('vanguard.run.v1');
    expect(raw).toBeTruthy();
    
    // WHEN one character of the stored data string is mutated
    // Mutate the '1' to '2' in the data
    raw = raw!.replace('123', '124');
    storage.setItem('vanguard.run.v1', raw);
    
    // AND loadRun() is called
    const loadResult = persistence.loadRun();
    
    // THEN it returns Corrupted
    expect(loadResult).toEqual({ kind: 'Corrupted' });
    
    // AND the key is quarantined
    let foundQuarantine = false;
    for (const key of storage.inspectStore().keys()) {
      if (key.startsWith('vanguard.run.corrupt.')) {
        foundQuarantine = true;
        break;
      }
    }
    expect(foundQuarantine).toBe(true);
    
    // AND the live key is cleared
    expect(storage.getItem('vanguard.run.v1')).toBeNull();
  });

  it('test_ac5_invalid_json_quarantined_and_cleared', () => {
    // GIVEN a stored value that is not valid JSON
    storage.setItem('vanguard.run.v1', '{ invalid json, "foo": 1 ]');
    
    // WHEN loadRun()
    const loadResult = persistence.loadRun();
    
    // THEN Corrupted (no exception escapes)
    expect(loadResult).toEqual({ kind: 'Corrupted' });
    
    // AND quarantined
    let foundQuarantine = false;
    for (const key of storage.inspectStore().keys()) {
      if (key.startsWith('vanguard.run.corrupt.')) {
        foundQuarantine = true;
        break;
      }
    }
    expect(foundQuarantine).toBe(true);
    
    // AND cleared
    expect(storage.getItem('vanguard.run.v1')).toBeNull();
  });

  it('test_ac6_missing_top_level_field_quarantined_and_cleared', () => {
    // GIVEN a valid JSON payload missing a required top-level field
    // Missing 'data'
    storage.setItem('vanguard.run.v1', JSON.stringify({
      schemaVersion: 1,
      checksum: 123
    }));
    
    // WHEN loadRun()
    const loadResult = persistence.loadRun();
    
    // THEN Corrupted
    expect(loadResult).toEqual({ kind: 'Corrupted' });
    
    // AND quarantined
    let foundQuarantine = false;
    for (const key of storage.inspectStore().keys()) {
      if (key.startsWith('vanguard.run.corrupt.')) {
        foundQuarantine = true;
        break;
      }
    }
    expect(foundQuarantine).toBe(true);
    
    // AND cleared
    expect(storage.getItem('vanguard.run.v1')).toBeNull();
  });

  it('test_ac7_corrupted_meta_quarantined_and_reset', () => {
    // GIVEN a corrupted Meta Save
    storage.setItem('vanguard.meta.v1', '{ invalid json ]');
    
    // WHEN loadMeta()
    const defaultMeta = { initialized: true };
    const loadResult = persistence.loadMeta(defaultMeta);
    
    // THEN Corrupted
    expect(loadResult).toEqual({ kind: 'Corrupted' });
    
    // AND quarantined
    let foundQuarantine = false;
    for (const key of storage.inspectStore().keys()) {
      if (key.startsWith('vanguard.meta.corrupt.')) {
        foundQuarantine = true;
        break;
      }
    }
    expect(foundQuarantine).toBe(true);
    
    // AND the live key is reset to schema defaults
    const newRaw = storage.getItem('vanguard.meta.v1');
    expect(newRaw).toBeTruthy();
    
    const parsed = JSON.parse(newRaw!);
    expect(parsed.data).toEqual(defaultMeta);
  });
});
