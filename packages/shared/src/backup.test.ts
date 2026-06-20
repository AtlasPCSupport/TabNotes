import { describe, expect, it } from 'vitest';
import {
  applyBackupImport,
  createDriveBackupEnvelope,
  createManualBackupEnvelope,
  mergeDriveBackupEnvelope,
  parseBackupImport,
  parseDriveBackupEnvelope,
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

    const envelope = createDriveBackupEnvelope(storage, 'device-1', { pins: ['a'] }, 1_700_000_000_000);
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
      1_700_000_000_000,
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
});
