import { describe, expect, it } from 'vitest';
import { createDriveBackupEnvelope } from './backup';
import {
  createDeleteTombstone,
  createDriveSyncEnvelope,
  mergeDriveSyncEnvelope,
  parseAnyDriveSyncEnvelope,
  parseDriveSyncEnvelope,
} from './sync';
import { DEFAULT_STORAGE } from './storage';
import type { Note, StorageData, Workspace } from './types';

function note(id: string, updatedAt: number, content: string, workspaceId: string | null = null): Note {
  return {
    id,
    workspaceId,
    scope: workspaceId ? 'workspace' : 'global',
    scopeKey: workspaceId ?? 'global',
    content,
    title: id,
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

function storage(patch: Partial<StorageData> = {}): StorageData {
  return {
    ...structuredClone(DEFAULT_STORAGE),
    ...patch,
  };
}

describe('Drive sync envelope v2', () => {
  it('creates and parses the v2 sync format', () => {
    const local = storage({
      notes_global: { a: note('a', 100, 'hello') },
      language: 'es',
    });

    const envelope = createDriveSyncEnvelope(local, {
      sourceDeviceId: 'device-a',
      prefs: { pins: ['a'] },
      now: 1_700_000_000_000,
    });
    const parsed = parseDriveSyncEnvelope(JSON.parse(JSON.stringify(envelope)));

    expect(parsed?.kind).toBe('tabnotes.driveSync');
    expect(parsed?.schema).toBe(2);
    expect(parsed?.syncRevision).toBe(1);
    expect(parsed?.sourceDeviceId).toBe('device-a');
    expect(parsed?.storage.language).toBe('es');
    expect(parsed?.data.prefs?.pins).toEqual(['a']);
  });

  it('migrates the existing drive backup v1 envelope into sync v2 shape', () => {
    const backup = createDriveBackupEnvelope(
      storage({ notes_global: { a: note('a', 100, 'legacy') } }),
      'desktop',
      undefined,
      1_700_000_000_000,
    );

    const parsed = parseAnyDriveSyncEnvelope(backup);

    expect(parsed?.kind).toBe('tabnotes.driveSync');
    expect(parsed?.schema).toBe(2);
    expect(parsed?.syncRevision).toBe(1);
    expect(parsed?.sourceDeviceId).toBe('desktop');
    expect(parsed?.data.notes[0]?.content).toBe('legacy');
  });

  it('increments sync revision from a previous envelope', () => {
    const first = createDriveSyncEnvelope(storage(), {
      sourceDeviceId: 'a',
      now: 100,
    });
    const second = createDriveSyncEnvelope(storage(), {
      sourceDeviceId: 'a',
      previous: first,
      now: 200,
    });

    expect(second.syncRevision).toBe(2);
  });
});

describe('mergeDriveSyncEnvelope', () => {
  it('adds remote notes and keeps newer local notes', () => {
    const local = storage({
      notes_global: { same: note('same', 300, 'local-newer') },
    });
    const remoteStorage = storage({
      notes_global: {
        same: note('same', 200, 'remote-older'),
        remoteOnly: note('remoteOnly', 250, 'remote-only'),
      },
      theme: 'dark',
    });
    const remote = createDriveSyncEnvelope(remoteStorage, {
      sourceDeviceId: 'mobile',
      now: 400,
    });

    const result = mergeDriveSyncEnvelope(remote, local, {
      sourceDeviceId: 'desktop',
      now: 500,
    });

    expect(result.data.notes_global.same.content).toBe('local-newer');
    expect(result.data.notes_global.remoteOnly.content).toBe('remote-only');
    expect(result.data.theme).toBe('dark');
    expect(result.summary.notesAdded).toBe(1);
    expect(result.summary.notesKeptLocal).toBe(1);
  });

  it('applies tombstones so deleted remote notes are not revived locally', () => {
    const local = storage({
      notes_global: { gone: note('gone', 100, 'local copy') },
    });
    const remote = createDriveSyncEnvelope(storage(), {
      sourceDeviceId: 'mobile',
      tombstones: [
        createDeleteTombstone(
          { entityType: 'note', id: 'gone', scope: 'global', workspaceId: null },
          'mobile',
          200,
        ),
      ],
      now: 300,
    });

    const result = mergeDriveSyncEnvelope(remote, local, {
      sourceDeviceId: 'desktop',
      now: 400,
    });

    expect(result.data.notes_global.gone).toBeUndefined();
    expect(result.summary.notesDeleted).toBe(1);
    expect(result.tombstones).toHaveLength(1);
  });

  it('uses local tombstones to keep stale remote notes deleted', () => {
    const remote = createDriveSyncEnvelope(
      storage({ notes_global: { old: note('old', 100, 'stale remote') } }),
      { sourceDeviceId: 'desktop', now: 150 },
    );

    const result = mergeDriveSyncEnvelope(remote, storage(), {
      sourceDeviceId: 'mobile',
      localTombstones: [
        createDeleteTombstone(
          { entityType: 'note', id: 'old', scope: 'global', workspaceId: null },
          'mobile',
          200,
        ),
      ],
      now: 300,
    });

    expect(result.data.notes_global.old).toBeUndefined();
    expect(result.summary.notesAdded).toBe(0);
  });

  it('creates a deterministic conflict copy when both sides edited after last sync', () => {
    const local = storage({
      notes_global: { n: note('n', 300, 'local edit') },
    });
    const remote = createDriveSyncEnvelope(
      storage({ notes_global: { n: note('n', 320, 'remote edit') } }),
      { sourceDeviceId: 'mobile', now: 330 },
    );

    const first = mergeDriveSyncEnvelope(remote, local, {
      sourceDeviceId: 'desktop',
      lastSyncedAt: 200,
      now: 400,
    });
    const second = mergeDriveSyncEnvelope(remote, first.data, {
      sourceDeviceId: 'desktop',
      lastSyncedAt: 200,
      now: 500,
    });

    const conflictIds = Object.keys(second.data.notes_global).filter((id) => id.includes('__conflict__'));

    expect(first.data.notes_global.n.content).toBe('local edit');
    expect(conflictIds).toHaveLength(1);
    expect(second.summary.noteConflictsCreated).toBe(0);
  });

  it('deletes a workspace and its notes when a newer workspace tombstone arrives', () => {
    const local = storage({
      workspaces: { w: workspace('w', 100, 'Project') },
      activeWorkspaceId: 'w',
      notes_workspace: { n: note('n', 100, 'workspace note', 'w') },
    });
    const remote = createDriveSyncEnvelope(storage(), {
      sourceDeviceId: 'mobile',
      tombstones: [
        createDeleteTombstone(
          { entityType: 'workspace', id: 'w', workspaceId: 'w' },
          'mobile',
          200,
        ),
      ],
      now: 300,
    });

    const result = mergeDriveSyncEnvelope(remote, local, {
      sourceDeviceId: 'desktop',
      now: 400,
    });

    expect(result.data.workspaces.w).toBeUndefined();
    expect(result.data.notes_workspace.n).toBeUndefined();
    expect(result.data.activeWorkspaceId).toBeNull();
    expect(result.summary.workspacesDeleted).toBe(1);
  });
});

