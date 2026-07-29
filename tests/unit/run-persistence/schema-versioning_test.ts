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

describe('Run Persistence: Schema Versioning & Migrations (Story 003)', () => {
  let storage: MockStorage;

  beforeEach(() => {
    storage = new MockStorage();
  });

  function makeRawSave(schemaVersion: number, data: unknown): string {
    const dataString = JSON.stringify(data);
    const csum = checksum(dataString);
    return `{"schemaVersion":${schemaVersion},"checksum":${csum},"data":${dataString}}`;
  }

  it('test_ac8_migrations_run_in_ascending_order_and_validate', () => {
    // GIVEN schemaVersion < CURRENT_VERSION
    storage.setItem('vanguard.run.v1', makeRawSave(1, { oldField: 'value' }));

    const migrations = {
      1: (data: any) => ({ newField: data.oldField, step: 2 }),
      2: (data: any) => ({ finalField: data.newField, step: 3 }),
    };

    const validate = (data: any) => data.step === 3 && typeof data.finalField === 'string';

    const persistence = new RunPersistence(storage, {
      runSchema: {
        currentVersion: 3,
        migrations,
        validate
      }
    });

    // WHEN loaded
    const loadResult = persistence.loadRun();

    // THEN exactly migrationsToApply migration functions run in ascending order and the result validates
    expect(loadResult).toEqual({
      kind: 'Valid',
      data: { finalField: 'value', step: 3 }
    });
  });

  it('test_ac9_missing_migration_yields_corrupted', () => {
    // GIVEN a version chain missing one migration function
    storage.setItem('vanguard.run.v1', makeRawSave(1, { oldField: 'value' }));

    const migrations = {
      // 1 is missing
      2: (data: any) => ({ finalField: data.newField, step: 3 }),
    };

    const persistence = new RunPersistence(storage, {
      runSchema: {
        currentVersion: 3,
        migrations
      }
    });

    // WHEN loaded
    const loadResult = persistence.loadRun();

    // THEN the result is Corrupted (not partially migrated)
    expect(loadResult).toEqual({ kind: 'Corrupted' });
  });

  it('test_ac9_throwing_migration_yields_corrupted', () => {
    // Checking broken migration explicitly
    storage.setItem('vanguard.run.v1', makeRawSave(1, { oldField: 'value' }));

    const migrations = {
      1: (data: any) => { throw new Error('Boom'); },
    };

    const persistence = new RunPersistence(storage, {
      runSchema: {
        currentVersion: 2,
        migrations
      }
    });

    const loadResult = persistence.loadRun();
    expect(loadResult).toEqual({ kind: 'Corrupted' });
  });

  it('test_ac9_validation_failure_yields_corrupted', () => {
    // Checking validation failure explicitly
    storage.setItem('vanguard.run.v1', makeRawSave(1, { oldField: 'value' }));

    const migrations = {
      1: (data: any) => ({ step: 2 }),
    };

    const persistence = new RunPersistence(storage, {
      runSchema: {
        currentVersion: 2,
        migrations,
        validate: (data: any) => false // Always fail validation
      }
    });

    const loadResult = persistence.loadRun();
    expect(loadResult).toEqual({ kind: 'Corrupted' });
  });

  it('test_ac10_newer_version_is_unsupported_and_not_overwritten', () => {
    // GIVEN schemaVersion > CURRENT_VERSION
    const newerData = { futureField: 'future' };
    const rawNewer = makeRawSave(5, newerData);
    storage.setItem('vanguard.run.v1', rawNewer);

    const persistence = new RunPersistence(storage, {
      runSchema: {
        currentVersion: 3
      }
    });

    // WHEN loaded
    const loadResult = persistence.loadRun();

    // THEN the result is Unsupported
    expect(loadResult).toEqual({ kind: 'Unsupported' });

    // AND the stored key is not overwritten by any subsequent write in that session
    const writeResult = persistence.saveRun({ some: 'data' });
    expect(writeResult).toEqual({ kind: 'Written' });

    // The raw store must still contain the v5 save
    expect(storage.getItem('vanguard.run.v1')).toBe(rawNewer);
  });

  it('test_ac21_migrations_to_apply_matches_f3', () => {
    // GIVEN (v_stored, v_current) pairs incl. equal (0 migrations) and multi-step
    
    // Equal (0 migrations)
    storage.setItem('vanguard.run.v1', makeRawSave(3, { field: 'value' }));
    
    let callCount = 0;
    const migrations = {
      3: (data: any) => { callCount++; return data; }, // Should not be called
    };

    let persistence = new RunPersistence(storage, {
      runSchema: {
        currentVersion: 3,
        migrations
      }
    });

    let loadResult = persistence.loadRun();
    expect(loadResult).toEqual({ kind: 'Valid', data: { field: 'value' } });
    expect(callCount).toBe(0);

    // Multi-step (v1 -> v4 = 3 migrations)
    storage.setItem('vanguard.run.v1', makeRawSave(1, { field: 'value' }));
    
    let stepsRun: number[] = [];
    const multiMigrations = {
      1: (data: any) => { stepsRun.push(1); return data; },
      2: (data: any) => { stepsRun.push(2); return data; },
      3: (data: any) => { stepsRun.push(3); return data; },
      4: (data: any) => { stepsRun.push(4); return data; }, // Should not be called
    };

    persistence = new RunPersistence(storage, {
      runSchema: {
        currentVersion: 4,
        migrations: multiMigrations
      }
    });

    loadResult = persistence.loadRun();
    expect(loadResult).toEqual({ kind: 'Valid', data: { field: 'value' } });
    
    // THEN migrationsToApply matches F3 exactly (4 - 1 = 3 migrations)
    expect(stepsRun).toEqual([1, 2, 3]);
  });
});
