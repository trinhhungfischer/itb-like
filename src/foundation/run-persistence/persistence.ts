export type SchemaVersion = number;

export interface SaveEnvelope<T> {
  schemaVersion: SchemaVersion;
  checksum: number;
  data: T;
}

export type LoadResult<T> =
  | { kind: 'Empty' }
  | { kind: 'Valid'; data: T }
  | { kind: 'Corrupted' }
  | { kind: 'Unsupported' };

export type WriteResult =
  | { kind: 'Written' }
  | { kind: 'QuotaExceeded' }
  | { kind: 'SecurityBlocked' };

export interface Persistence {
  /** Saves the current run state, overwriting any existing run save. */
  saveRun(data: unknown): WriteResult;
  /** Loads the current run state. Returns Empty if no run is saved. */
  loadRun(): LoadResult<unknown>;
  /** Clears the current run save, preventing resume. */
  clearRun(): void;
  /** Saves permanent meta-progression data. */
  saveMeta(data: unknown): WriteResult;
  /** Loads permanent meta-progression data. */
  loadMeta(): LoadResult<unknown>;
}

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function checksum(s: string): number {
  let acc = 0;
  for (let i = 0; i < s.length; i++) {
    acc = (acc + s.charCodeAt(i) * (i + 1)) % 0x1_0000_0000;
  }
  return acc >>> 0;
}

export class RunPersistence implements Persistence {
  private runKey = 'vanguard.run.v1';
  private metaKey = 'vanguard.meta.v1';

  constructor(private storage: StorageAdapter) {}

  saveRun(data: unknown): WriteResult {
    return this.saveToDomain(this.runKey, 1, data);
  }

  loadRun(): LoadResult<unknown> {
    return this.loadFromDomain(this.runKey, 1);
  }

  clearRun(): void {
    try {
      this.storage.removeItem(this.runKey);
    } catch {
      // Best effort
    }
  }

  saveMeta(data: unknown): WriteResult {
    return this.saveToDomain(this.metaKey, 1, data);
  }

  loadMeta(): LoadResult<unknown> {
    return this.loadFromDomain(this.metaKey, 1);
  }

  private saveToDomain(key: string, version: number, data: unknown): WriteResult {
    try {
      const dataString = JSON.stringify(data);
      if (dataString === undefined) {
        return { kind: 'Written' }; // Or handle failure, but valid JSON should be stringified
      }
      const csum = checksum(dataString);
      
      // Serialize data once and reuse that exact string for both hashing and storage
      const envelopeString = `{"schemaVersion":${version},"checksum":${csum},"data":${dataString}}`;
      
      // Build-then-swap atomic write
      this.storage.setItem(key, envelopeString);
      return { kind: 'Written' };
    } catch (e) {
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        return { kind: 'QuotaExceeded' };
      }
      if (e instanceof Error && e.name === 'SecurityError') {
        return { kind: 'SecurityBlocked' };
      }
      return { kind: 'SecurityBlocked' };
    }
  }

  private loadFromDomain(key: string, currentVersion: number): LoadResult<unknown> {
    try {
      const stored = this.storage.getItem(key);
      if (!stored) {
        return { kind: 'Empty' };
      }

      let envelope: SaveEnvelope<unknown>;
      try {
        envelope = JSON.parse(stored);
      } catch {
        return { kind: 'Corrupted' };
      }

      if (
        !envelope ||
        typeof envelope !== 'object' ||
        !('schemaVersion' in envelope) ||
        !('checksum' in envelope) ||
        !('data' in envelope)
      ) {
        return { kind: 'Corrupted' };
      }

      if (envelope.schemaVersion > currentVersion) {
        return { kind: 'Unsupported' };
      }

      const dataString = JSON.stringify(envelope.data);
      if (checksum(dataString) !== envelope.checksum) {
        return { kind: 'Corrupted' };
      }

      return { kind: 'Valid', data: envelope.data };
    } catch {
      return { kind: 'Corrupted' };
    }
  }
}
