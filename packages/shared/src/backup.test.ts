import { describe, expect, it } from 'vitest';
import {
  createDriveBackupEnvelope,
  mergeDriveBackupEnvelope,
  parseDriveBackupEnvelope,
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
