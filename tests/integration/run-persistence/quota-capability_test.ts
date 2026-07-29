import { describe, it, expect, vi } from 'vitest';
import { RunPersistence, StorageAdapter } from '../../../src/foundation/run-persistence/persistence';

class MockStorageAdapter implements StorageAdapter {
  private map = new Map<string, string>();
  public throwOnSet = false;
  public throwErrorName = 'QuotaExceededError';
  public throwCounter = 0;

  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, value: string) {
    if (this.throwOnSet) {
      this.throwCounter++;
      const err = new Error('Mock error');
      err.name = this.throwErrorName;
      throw err;
    }
    this.map.set(key, value);
  }
  removeItem(key: string) { this.map.delete(key); }
  
  get length() { return this.map.size; }
  key(index: number) { return Array.from(this.map.keys())[index] ?? null; }

  // Expose for testing
  getBackingMap() { return this.map; }
}

describe('RunPersistence Quota & Capability (Story 004)', () => {

  it('AC11: Retries once after removing quarantine keys on QuotaExceededError; on failure abandons write and fires storage_full', () => {
    const storage = new MockStorageAdapter();
    const dispatcher = { emit: vi.fn() };
    const persistence = new RunPersistence(storage, { eventDispatcher: dispatcher });

    // Set a good save and a corrupt key
    storage.setItem('vanguard.run.v1', '{"schemaVersion":1,"checksum":197,"data":"AB"}');
    storage.setItem('vanguard.run.corrupt.123', 'bad');

    expect(storage.length).toBe(2);

    // Make it throw on every setItem now
    storage.throwOnSet = true;
    storage.throwErrorName = 'QuotaExceededError';
    storage.throwCounter = 0;

    const res = persistence.saveRun('CD');

    expect(res).toEqual({ kind: 'QuotaExceeded' });
    // First throw + 1 retry throw = 2 throws
    expect(storage.throwCounter).toBe(2);

    // Quarantine keys should be pruned
    expect(storage.getItem('vanguard.run.corrupt.123')).toBeNull();

    // Previous good save should be byte-identical
    expect(storage.getItem('vanguard.run.v1')).toBe('{"schemaVersion":1,"checksum":197,"data":"AB"}');

    // Event fired
    expect(dispatcher.emit).toHaveBeenCalledWith({ type: 'storage_full' });
  });

  it('AC11 (success path): Retries once after removing quarantine keys and succeeds', () => {
    const storage = new MockStorageAdapter();
    const dispatcher = { emit: vi.fn() };
    const persistence = new RunPersistence(storage, { eventDispatcher: dispatcher });

    storage.setItem('vanguard.run.corrupt.123', 'bad');

    // Throw on first attempt, succeed on retry
    storage.setItem = vi.fn().mockImplementationOnce((k, v) => {
      const err = new Error('Quota');
      err.name = 'QuotaExceededError';
      throw err;
    }).mockImplementationOnce((k, v) => {
      storage.getBackingMap().set(k, v);
    });

    const res = persistence.saveRun('CD');

    expect(res).toEqual({ kind: 'Written' });
    expect(storage.getItem('vanguard.run.corrupt.123')).toBeNull(); // pruned
    expect(storage.getItem('vanguard.run.v1')).toBeTruthy();
    expect(dispatcher.emit).not.toHaveBeenCalled();
  });

  it('AC12: Capability probe throws → enters memory-only mode and fires storage_unavailable', () => {
    const storage = new MockStorageAdapter();
    // Storage throws on the probe
    storage.throwOnSet = true;
    storage.throwErrorName = 'SecurityError';

    const dispatcher = { emit: vi.fn() };
    const persistence = new RunPersistence(storage, { eventDispatcher: dispatcher });

    // The event should have been fired during construction

    expect(dispatcher.emit).toHaveBeenCalledWith({ type: 'storage_unavailable' });

    // Now storage is throwing, but saveRun should succeed because it uses an in-memory adapter
    const writeRes = persistence.saveRun('memory_data');
    expect(writeRes).toEqual({ kind: 'Written' });

    const loadRes = persistence.loadRun();
    expect(loadRes).toEqual({ kind: 'Valid', data: 'memory_data' });

    // The original storage adapter should NOT have been touched for saveRun
    expect(storage.getBackingMap().size).toBe(0);
  });

  it('Capability probe success allows normal writes', () => {
    const storage = new MockStorageAdapter();
    const dispatcher = { emit: vi.fn() };
    
    // Default mock adapter doesn't throw, so probe succeeds
    const persistence = new RunPersistence(storage, { eventDispatcher: dispatcher });

    expect(persistence.isStorageAvailable()).toBe(true);
    expect(dispatcher.emit).not.toHaveBeenCalled();

    persistence.saveRun('real_data');
    expect(storage.getBackingMap().get('vanguard.run.v1')).toBeTruthy();
  });

});
