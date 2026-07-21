import { describe, expect, it } from 'vitest';
import {
  applyBackupImport,
  createDriveBackupEnvelope,
  createEncryptedManualBackupEnvelope,
  createManualBackupEnvelope,
  mergeDriveBackupEnvelope,
  MAX_BACKUP_IMPORT_NOTES,
  MAX_BACKUP_IMPORT_WORKSPACES,
  MAX_ENCRYPTED_MANUAL_BACKUP_FILE_BYTES,
  isBackupImportTextWithinLimit,
  isEncryptedManualBackupEnvelope,
  isEncryptedManualBackupTextWithinLimit,
  parseBackupImport,
  parseBackupImportJson,
  parseBackupImportJsonResult,
  parseBackupImportResult,
  parseDriveBackupEnvelope,
  decryptEncryptedManualBackupEnvelope,
  parseManualBackupEnvelope,
} from './backup';
import { DEFAULT_STORAGE } from './storage';
import type { Note, StorageData, Workspace } from './types';

function note(id: string, updatedAt: number, content: string): Note {
  return {
    id,
    workspaceId: null,
    scope: 'global',
    scopeKey: 'global',
    content,
    tags: [],
    createdAt: updatedAt - 10,
    updatedAt,
  };
}

function workspace(id: string, updatedAt: number, name: string): Workspace {
  return {
    id,
    name,
    createdAt: updatedAt - 10,
    updatedAt,
  };
}

describe('Drive backup envelope', () => {
  it('creates and parses the current envelope format', () => {
    const storage: StorageData = {
      ...structuredClone(DEFAULT_STORAGE),
      notes_global: { a: note('a', 100, 'remote') },
      language: 'es',
    };

    const envelope = createDriveBackupEnvelope(
      storage,
      'device-1',
      { pins: ['a'] },
      1_700_000_000_000
    );
    const parsed = parseDriveBackupEnvelope(JSON.parse(JSON.stringify(envelope)));

    expect(parsed?.kind).toBe('tabnotes.driveBackup');
    expect(parsed?.sourceDeviceId).toBe('device-1');
    expect(parsed?.storage.language).toBe('es');
    expect(parsed?.data.prefs?.pins).toEqual(['a']);
  });

  it('rejects unrelated JSON', () => {
    expect(parseDriveBackupEnvelope({ notes: [] })).toBeNull();
  });
});

describe('manual backup envelope', () => {
  it('creates a complete manual backup envelope with storage settings and prefs', () => {
    const storage: StorageData = {
      ...structuredClone(DEFAULT_STORAGE),
      notes_global: { a: note('a', 100, 'manual') },
      activeWorkspaceId: 'w',
      defaultScope: 'url',
      theme: 'dark',
      markdownEnabled: true,
      language: 'es',
      workspaces: { w: workspace('w', 90, 'Workspace') },
    };

    const envelope = createManualBackupEnvelope(
      storage,
      { pins: ['a'], fontsize: 15 },
      1_700_000_000_000
    );
    const parsed = parseManualBackupEnvelope(JSON.parse(JSON.stringify(envelope)));

    expect(parsed?.kind).toBe('tabnotes.backup');
    expect(parsed?.storage).toMatchObject({
      activeWorkspaceId: 'w',
      defaultScope: 'url',
      theme: 'dark',
      markdownEnabled: true,
      language: 'es',
    });
    expect(parsed?.data.exportedAt).toBe(1_700_000_000_000);
    expect(parsed?.data.prefs?.pins).toEqual(['a']);
    expect(parsed?.data.prefs?.fontsize).toBe(15);
  });

  it('parses legacy, manual, and Drive backup imports through one compatibility path', () => {
    const storage: StorageData = {
      ...structuredClone(DEFAULT_STORAGE),
      notes_global: { a: note('a', 100, 'payload') },
    };
    const legacy = { version: 3, exportedAt: 1, notes: [], workspaces: [] };
    const manual = createManualBackupEnvelope(storage);
    const drive = createDriveBackupEnvelope(storage, 'device-1');

    expect(parseBackupImport(legacy)?.source).toBe('legacy');
    expect(parseBackupImport(manual)?.source).toBe('manual');
    expect(parseBackupImport(drive)?.source).toBe('drive');
    expect(parseBackupImport({ notes: [] })).toBeNull();
  });

  it('encrypts and decrypts manual backups without accepting malformed envelopes', async () => {
    const manual = createManualBackupEnvelope({
      ...structuredClone(DEFAULT_STORAGE),
      notes_global: { a: note('a', 100, 'protected') },
    });
    const encrypted = await createEncryptedManualBackupEnvelope(
      manual,
      'correct horse battery staple'
    );

    expect(encrypted.kind).toBe('tabnotes.encryptedBackup');
    expect(isEncryptedManualBackupEnvelope(encrypted)).toBe(true);
    expect(isEncryptedManualBackupEnvelope({ ...encrypted, schema: 2 })).toBe(false);
    expect(
      await decryptEncryptedManualBackupEnvelope(encrypted, 'correct horse battery staple')
    ).toEqual(manual);
    expect(await decryptEncryptedManualBackupEnvelope(encrypted, 'wrong password')).toBeNull();
    expect(
      await decryptEncryptedManualBackupEnvelope(
        { ...encrypted, encryptedData: 'invalid' },
        'correct horse battery staple'
      )
    ).toBeNull();
  });

  it('rejects malformed, oversized, and over-count backup imports', () => {
    const valid = createManualBackupEnvelope(
      {
        ...structuredClone(DEFAULT_STORAGE),
        notes_global: { a: note('a', 100, 'valid') },
        workspaces: { w: workspace('w', 100, 'Valid') },
      },
      undefined,
      1_700_000_000_000
    );
    expect(parseBackupImportJson(JSON.stringify(valid))?.source).toBe('manual');
    expect(parseBackupImportJson('{not json')).toBeNull();
    expect(isBackupImportTextWithinLimit('x'.repeat(10 * 1024 * 1024 + 1))).toBe(false);
    expect(
      parseBackupImport({
        ...valid,
        data: {
          ...valid.data,
          notes: Array(MAX_BACKUP_IMPORT_NOTES + 1).fill(valid.data.notes[0]),
        },
      })
    ).toBeNull();
    expect(
      parseBackupImport({
        ...valid,
        data: {
          ...valid.data,
          workspaces: Array(MAX_BACKUP_IMPORT_WORKSPACES + 1).fill(valid.data.workspaces[0]),
        },
      })
    ).toBeNull();
    expect(
      parseBackupImport({
        ...valid,
        data: { ...valid.data, notes: [{ ...valid.data.notes[0], tags: [42] }] },
      })
    ).toBeNull();
  });

  it('allows an encrypted payload large enough for the maximum plaintext import', async () => {
    const manual = createManualBackupEnvelope({
      ...structuredClone(DEFAULT_STORAGE),
      notes_global: { a: note('a', 100, 'protected') },
    });
    const encrypted = await createEncryptedManualBackupEnvelope(
      manual,
      'correct horse battery staple'
    );

    expect(isEncryptedManualBackupEnvelope(encrypted)).toBe(true);
    expect(isEncryptedManualBackupTextWithinLimit(JSON.stringify(encrypted))).toBe(true);
    expect(
      isEncryptedManualBackupTextWithinLimit(
        'x'.repeat(MAX_ENCRYPTED_MANUAL_BACKUP_FILE_BYTES + 1)
      )
    ).toBe(false);
    await expect(
      decryptEncryptedManualBackupEnvelope(
        { ...encrypted, encryptedData: 'A'.repeat(20_000_000) },
        'correct horse battery staple'
      )
    ).resolves.toBeNull();
  });

  it('applies complete manual backup imports including storage settings', () => {
    const current: StorageData = {
      ...structuredClone(DEFAULT_STORAGE),
      notes_global: { existing: note('existing', 50, 'local') },
      theme: 'light',
    };
    const backupStorage: StorageData = {
      ...structuredClone(DEFAULT_STORAGE),
      notes_global: {
        existing: note('existing', 100, 'restored'),
        imported: note('imported', 100, 'imported'),
      },
      workspaces: { w: workspace('w', 100, 'Restored Workspace') },
      activeWorkspaceId: 'w',
      defaultScope: 'workspace',
      theme: 'dark',
      markdownEnabled: true,
      language: 'es',
    };

    const parsed = parseBackupImport(createManualBackupEnvelope(backupStorage));
    expect(parsed).not.toBeNull();
    const result = applyBackupImport(parsed!, current);

    expect(result.data.notes_global.existing.content).toBe('restored');
    expect(result.data.notes_global.imported.content).toBe('imported');
    expect(result.data.workspaces.w.name).toBe('Restored Workspace');
    expect(result.data.activeWorkspaceId).toBe('w');
    expect(result.data.defaultScope).toBe('workspace');
    expect(result.data.theme).toBe('dark');
    expect(result.data.markdownEnabled).toBe(true);
    expect(result.data.language).toBe('es');
    expect(result.summary).toMatchObject({
      notesAdded: 1,
      notesUpdated: 1,
      workspacesAdded: 1,
      storageSettingsRestored: 5,
    });
  });

  it('removes a stale copy when an imported note changed scope', () => {
    const current: StorageData = {
      ...structuredClone(DEFAULT_STORAGE),
      notes_url: { moved: { ...note('moved', 10, 'old location'), scope: 'url', scopeKey: 'https://old.example' } },
    };
    const backupStorage: StorageData = {
      ...structuredClone(DEFAULT_STORAGE),
      notes_global: { moved: note('moved', 20, 'restored location') },
    };

    const parsed = parseBackupImport(createManualBackupEnvelope(backupStorage));
    const result = applyBackupImport(parsed!, current);

    expect(result.data.notes_url.moved).toBeUndefined();
    expect(result.data.notes_global.moved.content).toBe('restored location');
    expect(result.summary).toMatchObject({ notesAdded: 0, notesUpdated: 1 });
  });

  it('drops a restored active workspace if the backup does not contain it', () => {
    const backupStorage: StorageData = {
      ...structuredClone(DEFAULT_STORAGE),
      activeWorkspaceId: 'missing',
    };
    const parsed = parseBackupImport(createManualBackupEnvelope(backupStorage));
    const result = applyBackupImport(parsed!, structuredClone(DEFAULT_STORAGE));

    expect(result.data.activeWorkspaceId).toBeNull();
  });
});

describe('strict backup import validation', () => {
  it('rejects duplicate IDs instead of silently overwriting records', () => {
    const valid = createManualBackupEnvelope({
      ...structuredClone(DEFAULT_STORAGE),
      notes_global: { a: note('a', 10, 'one') },
    });
    const duplicate = {
      ...valid,
      data: { ...valid.data, notes: [valid.data.notes[0], { ...valid.data.notes[0] }] },
    };

    expect(parseBackupImport(duplicate)).toBeNull();
    expect(parseBackupImportResult(duplicate)).toEqual({ ok: false, reason: 'duplicate-id' });
  });

  it('rejects unknown fields, sparse arrays, non-finite timestamps, and overlong payloads', () => {
    const valid = createManualBackupEnvelope({
      ...structuredClone(DEFAULT_STORAGE),
      notes_global: { a: note('a', 10, 'one') },
    });
    const withUnknownField = { ...valid, unexpected: true };
    const sparseNotes: Note[] = [];
    sparseNotes.length = 1;
    const withSparseNotes = { ...valid, data: { ...valid.data, notes: sparseNotes } };
    const withInfiniteTimestamp = {
      ...valid,
      data: { ...valid.data, notes: [{ ...valid.data.notes[0], updatedAt: Infinity }] },
    };
    const withLongContent = {
      ...valid,
      data: {
        ...valid.data,
        notes: [{ ...valid.data.notes[0], content: 'x'.repeat(1_000_001) }],
      },
    };

    expect(parseBackupImport(withUnknownField)).toBeNull();
    expect(parseBackupImport(withSparseNotes)).toBeNull();
    expect(parseBackupImport(withInfiniteTimestamp)).toBeNull();
    expect(parseBackupImport(withLongContent)).toBeNull();
  });

  it('returns categorized JSON import failures', () => {
    expect(parseBackupImportJsonResult('{bad')).toEqual({ ok: false, reason: 'invalid-json' });
    expect(parseBackupImportJsonResult('x'.repeat(10 * 1024 * 1024 + 1))).toEqual({
      ok: false,
      reason: 'too-large',
    });
  });

  it('returns detached normalized data and removes duplicate tags', () => {
    const backup = createManualBackupEnvelope({
      ...structuredClone(DEFAULT_STORAGE),
      notes_global: { a: { ...note('a', 10, 'one'), tags: ['alpha', 'alpha'] } },
    });
    const parsed = parseBackupImport(backup);
    expect(parsed?.data.notes[0].tags).toEqual(['alpha']);
    backup.data.notes[0].content = 'changed after parsing';
    expect(parsed?.data.notes[0].content).toBe('one');
  });
});

describe('mergeDriveBackupEnvelope', () => {
  it('adds missing remote notes and keeps newer local notes', () => {
    const local: StorageData = {
      ...structuredClone(DEFAULT_STORAGE),
      notes_global: {
        same: note('same', 200, 'local-newer'),
      },
    };
    const remote: StorageData = {
      ...structuredClone(DEFAULT_STORAGE),
      notes_global: {
        same: note('same', 100, 'remote-older'),
        remoteOnly: note('remoteOnly', 150, 'remote-only'),
      },
      theme: 'dark',
    };

    const envelope = createDriveBackupEnvelope(remote, 'device-2');
    const result = mergeDriveBackupEnvelope(envelope, local);

    expect(result.data.notes_global.same.content).toBe('local-newer');
    expect(result.data.notes_global.remoteOnly.content).toBe('remote-only');
    expect(result.data.theme).toBe('dark');
    expect(result.summary).toMatchObject({
      notesAdded: 1,
      notesUpdated: 0,
      notesKeptLocal: 1,
    });
  });

  it('updates older local notes and workspaces from remote backup', () => {
    const local: StorageData = {
      ...structuredClone(DEFAULT_STORAGE),
      notes_global: { n: note('n', 100, 'local') },
      workspaces: { w: workspace('w', 100, 'Local') },
    };
    const remote: StorageData = {
      ...structuredClone(DEFAULT_STORAGE),
      notes_global: { n: note('n', 200, 'remote') },
      workspaces: { w: workspace('w', 200, 'Remote') },
    };

    const result = mergeDriveBackupEnvelope(createDriveBackupEnvelope(remote, 'device-2'), local);

    expect(result.data.notes_global.n.content).toBe('remote');
    expect(result.data.workspaces.w.name).toBe('Remote');
    expect(result.summary.notesUpdated).toBe(1);
    expect(result.summary.workspacesUpdated).toBe(1);
  });

  it('moves a newer remote note across scope collections without duplicating its ID', () => {
    const local: StorageData = {
      ...structuredClone(DEFAULT_STORAGE),
      notes_url: {
        moved: { ...note('moved', 100, 'local URL copy'), scope: 'url', scopeKey: 'https://old.example' },
      },
    };
    const remote: StorageData = {
      ...structuredClone(DEFAULT_STORAGE),
      notes_global: { moved: note('moved', 200, 'remote global copy') },
    };

    const result = mergeDriveBackupEnvelope(createDriveBackupEnvelope(remote, 'device-2'), local);

    expect(result.data.notes_url.moved).toBeUndefined();
    expect(result.data.notes_global.moved).toMatchObject({
      scope: 'global',
      content: 'remote global copy',
    });
    expect(result.summary).toMatchObject({ notesUpdated: 1, notesAdded: 0 });
  });

  it('keeps a newer local note even when the remote copy moved scopes', () => {
    const local: StorageData = {
      ...structuredClone(DEFAULT_STORAGE),
      notes_url: {
        moved: { ...note('moved', 200, 'local URL copy'), scope: 'url', scopeKey: 'https://newer.example' },
      },
    };
    const remote: StorageData = {
      ...structuredClone(DEFAULT_STORAGE),
      notes_global: { moved: note('moved', 100, 'remote global copy') },
    };

    const result = mergeDriveBackupEnvelope(createDriveBackupEnvelope(remote, 'device-2'), local);

    expect(result.data.notes_url.moved).toMatchObject({ content: 'local URL copy' });
    expect(result.data.notes_global.moved).toBeUndefined();
    expect(result.summary).toMatchObject({ notesKeptLocal: 1, notesAdded: 0 });
  });
});
