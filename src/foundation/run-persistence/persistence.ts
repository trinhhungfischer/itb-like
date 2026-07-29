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

export type MigrationFn = (data: unknown) => unknown;

export interface DomainSchema {
  currentVersion: number;
  migrations?: Record<number, MigrationFn>;
  validate?: (data: unknown) => boolean;
}

export interface PersistenceOptions {
  runSchema?: DomainSchema;
  metaSchema?: DomainSchema;
  eventDispatcher?: { emit(event: { type: 'storage_full' | 'storage_unavailable' }): void };
}

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
  loadMeta(defaultMeta?: unknown): LoadResult<unknown>;
  /** Boot-time capability probe. Returns false if storage is disabled/unavailable. */
  isStorageAvailable(): boolean;
}

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  readonly length?: number;
  key?(index: number): string | null;
}

class MemoryStorageAdapter implements StorageAdapter {
  private map = new Map<string, string>();
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, value: string) { this.map.set(key, value); }
  removeItem(key: string) { this.map.delete(key); }
  get length() { return this.map.size; }
  key(index: number) { return Array.from(this.map.keys())[index] ?? null; }
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
  private runSchema: DomainSchema;
  private metaSchema: DomainSchema;
  private unsupportedDomains = new Set<string>();
  private eventDispatcher?: { emit(event: { type: 'storage_full' | 'storage_unavailable' }): void };

  constructor(private storage: StorageAdapter, options: PersistenceOptions = {}) {
    this.runSchema = options.runSchema ?? { currentVersion: 1 };
    this.metaSchema = options.metaSchema ?? { currentVersion: 1 };
    this.eventDispatcher = options.eventDispatcher;

    if (!this.isStorageAvailable()) {
      this.storage = new MemoryStorageAdapter();
      this.eventDispatcher?.emit({ type: 'storage_unavailable' });
    }
  }

  isStorageAvailable(): boolean {
    const probe = '__vanguard_capability_probe__';
    try {
      this.storage.setItem(probe, probe);
      this.storage.removeItem(probe);
      return true;
    } catch {
      return false;
    }
  }

  saveRun(data: unknown): WriteResult {
    return this.saveToDomain(this.runKey, this.runSchema, data);
  }

  loadRun(): LoadResult<unknown> {
    const result = this.loadFromDomain(this.runKey, this.runSchema);
    if (result.kind === 'Corrupted') {
      this.quarantine(this.runKey);
      this.clearRun();
    }
    return result;
  }

  clearRun(): void {
    try {
      this.storage.removeItem(this.runKey);
    } catch {
      // Best effort
    }
  }

  saveMeta(data: unknown): WriteResult {
    return this.saveToDomain(this.metaKey, this.metaSchema, data);
  }

  loadMeta(defaultMeta: unknown = {}): LoadResult<unknown> {
    const result = this.loadFromDomain(this.metaKey, this.metaSchema);
    if (result.kind === 'Corrupted') {
      this.quarantine(this.metaKey);
      this.saveMeta(defaultMeta);
    } else if (result.kind === 'Empty') {
      this.saveMeta(defaultMeta);
    }
    return result;
  }

  private quarantine(key: string): void {
    try {
      const stored = this.storage.getItem(key);
      if (stored) {
        const timestamp = Date.now();
        const domainMatch = key.match(/^(vanguard\.[a-z]+)/);
        const baseKey = domainMatch ? domainMatch[1] : key;
        this.storage.setItem(`${baseKey}.corrupt.${timestamp}`, stored);
      }
    } catch {
      // Best effort quarantine
    }
  }

  private saveToDomain(key: string, schema: DomainSchema, data: unknown): WriteResult {
    if (this.unsupportedDomains.has(key)) {
      return { kind: 'Written' }; // silently drop writes to unsupported domains
    }
    try {
      const dataString = JSON.stringify(data);
      if (dataString === undefined) {
        return { kind: 'Written' }; // Or handle failure, but valid JSON should be stringified
      }
      const csum = checksum(dataString);
      
      // Serialize data once and reuse that exact string for both hashing and storage
      const envelopeString = `{"schemaVersion":${schema.currentVersion},"checksum":${csum},"data":${dataString}}`;
      
      // Build-then-swap atomic write
      this.storage.setItem(key, envelopeString);
      return { kind: 'Written' };
    } catch (e) {
      const isQuota = e instanceof Error && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED');
      if (isQuota) {
        this.pruneQuarantine();
        try {
          const csum = checksum(JSON.stringify(data)!);
          const envelopeString = `{"schemaVersion":${schema.currentVersion},"checksum":${csum},"data":${JSON.stringify(data)}}`;
          this.storage.setItem(key, envelopeString);
          return { kind: 'Written' };
        } catch (retryError) {
          this.eventDispatcher?.emit({ type: 'storage_full' });
          return { kind: 'QuotaExceeded' };
        }
      }
      if (e instanceof Error && e.name === 'SecurityError') {
        return { kind: 'SecurityBlocked' };
      }
      return { kind: 'SecurityBlocked' };
    }
  }

  private pruneQuarantine(): void {
    const s = this.storage as any;
    if (typeof s.length === 'number' && typeof s.key === 'function') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (k && k.includes('.corrupt.')) {
          keysToRemove.push(k);
        }
      }
      for (const k of keysToRemove) {
        s.removeItem(k);
      }
    }
  }

  private loadFromDomain(key: string, schema: DomainSchema): LoadResult<unknown> {
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

      if (envelope.schemaVersion > schema.currentVersion) {
        this.unsupportedDomains.add(key);
        return { kind: 'Unsupported' };
      }

      const dataString = JSON.stringify(envelope.data);
      if (dataString === undefined) {
        return { kind: 'Corrupted' };
      }
      if (checksum(dataString) !== envelope.checksum) {
        return { kind: 'Corrupted' };
      }

      let migratedData = envelope.data;
      let dataVersion = envelope.schemaVersion;
      
      while (dataVersion < schema.currentVersion) {
        if (!schema.migrations || !schema.migrations[dataVersion]) {
          return { kind: 'Corrupted' };
        }
        try {
          migratedData = schema.migrations[dataVersion](migratedData);
        } catch {
          return { kind: 'Corrupted' };
        }
        dataVersion++;
      }

      if (schema.validate && !schema.validate(migratedData)) {
        return { kind: 'Corrupted' };
      }

      return { kind: 'Valid', data: migratedData };
    } catch {
      return { kind: 'Corrupted' };
    }
  }
}
