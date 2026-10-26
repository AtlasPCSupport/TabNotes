import { beforeAll, expect, it } from 'vitest';
import legacy from './fixtures/legacy-backup.json';
import { ChromeStorageAdapter, DEFAULT_STORAGE, NotesService } from './storage';
import {
  applyBackupImport,
  createManualBackupEnvelope,
  createEncryptedManualBackupEnvelope,
  decryptEncryptedManualBackupEnvelope,
  parseBackupImportResult,
  parseBackupImport,
} from './backup';
import { createDriveSyncEnvelope, parseAnyDriveSyncEnvelope, mergeDriveSyncEnvelope } from './sync';
import { decryptText } from './crypto';
import type { StorageData } from './types';

beforeAll(async () => {
  if (!globalThis.crypto?.subtle) {
    const { webcrypto } = await import('node:crypto');
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  }
});

function storage(initial: StorageData) {
  const values: Record<string, unknown> = { tabnotes_data: structuredClone(initial) };
  Object.assign(globalThis, {
    chrome: {
      runtime: {},
      storage: {
        local: {
          get: (key: string, callback: (value: Record<string, unknown>) => void) => {
            const snapshot = structuredClone({ [key]: values[key] });
            setTimeout(() => callback(snapshot), 1);
          },
          set: (patch: Record<string, unknown>, callback: () => void) => {
            setTimeout(() => {
              Object.assign(values, structuredClone(patch));
              callback();
            }, 1);
          },
          remove: (key: string, callback: () => void) => {
            delete values[key];
            callback();
          },
        },
      },
    },
  });
  return { adapter: new ChromeStorageAdapter(), values };
}

it('restores old notes in all scopes and round-trips current manual/Drive formats without changing IDs or history', async () => {
  const parsed = parseBackupImport(legacy)!;
  expect(parsed).not.toBeNull();
  const restored = applyBackupImport(parsed, structuredClone(DEFAULT_STORAGE)).data;
  const manual = createManualBackupEnvelope(restored);
  expect(parseBackupImport(manual)?.data.notes).toEqual(parsed.data.notes);
  const drive = createDriveSyncEnvelope(restored, { sourceDeviceId: 'compatibility' });
  expect(parseAnyDriveSyncEnvelope(drive)).not.toBeNull();
  const merged = mergeDriveSyncEnvelope(drive, structuredClone(DEFAULT_STORAGE), {
    sourceDeviceId: 'other',
  });
  expect(createManualBackupEnvelope(merged.data).data.notes).toEqual(manual.data.notes);
  expect(restored.notes_url['url-old'].versions).toEqual(legacy.notes[0].versions);
  expect(restored.notes_workspace['project-note-old'].workspaceId).toBe('project-old');
});

it('reads legacy ciphertext, protects legacy history, and keeps edited notes encrypted through backup/restore', async () => {
  const data = applyBackupImport(parseBackupImport(legacy)!, structuredClone(DEFAULT_STORAGE)).data;
  const { adapter, values } = storage(data);
  const service = new NotesService(adapter);
  const rawBefore = JSON.stringify(values);
  await expect(service.unlockNote('encrypted-old', 'wrong')).rejects.toBeDefined();
  expect(JSON.stringify(values)).toBe(rawBefore);
  const opened = await service.unlockNote('encrypted-old', 'legacy-password');
  expect(opened.content).toBe('Nota antigua: café y tareas.');
  expect(opened.versions?.[0].content).toBe('Historia antigua privada');
  expect(JSON.stringify(values)).not.toContain('Historia antigua privada');
  await service.updateNote(opened.id, { content: 'Edición privada nueva' });
  expect(JSON.stringify(values)).not.toContain('Edición privada nueva');
  const locked = (await service.getAllNotes()).find((note) => note.id === opened.id)!;
  expect(await decryptText(locked.encryptedData!, 'legacy-password')).toBe('Edición privada nueva');
  const backup = createManualBackupEnvelope(await adapter.get());
  const protectedBackup = await createEncryptedManualBackupEnvelope(backup, 'backup-password');
  const decoded = await decryptEncryptedManualBackupEnvelope(protectedBackup, 'backup-password');
  expect(decoded).toEqual(backup);
  const fresh = storage(
    applyBackupImport(parseBackupImport(decoded)!, structuredClone(DEFAULT_STORAGE)).data
  );
  const reopened = await new NotesService(fresh.adapter).unlockNote(opened.id, 'legacy-password');
  expect(reopened.content).toBe('Edición privada nueva');
  expect(reopened.versions?.some((version) => version.content === 'Historia antigua privada')).toBe(
    true
  );
}, 20_000);

it('protects new encryption history and refuses writes from a locked session', async () => {
  const { adapter, values } = storage(structuredClone(DEFAULT_STORAGE));
  const service = new NotesService(adapter);
  const note = await service.createNote({ scope: 'global', url: '', content: 'first secret' });
  await service.updateNote(note.id, { content: 'second secret' });
  await service.lockNote(note.id, 'password');
  expect(JSON.stringify(values)).not.toContain('first secret');
  expect(JSON.stringify(values)).not.toContain('second secret');
  await expect(service.updateNote(note.id, { content: 'accidental plaintext' })).rejects.toThrow(
    'Unlock'
  );
  const opened = await service.unlockNote(note.id, 'password');
  expect(opened.content).toBe('second secret');
  expect(opened.versions?.[0].content).toBe('first secret');
}, 15_000);

it('restores image notes above the old 1 MB limit and preserves concurrent writes and atomic undo', async () => {
  const { adapter } = storage(structuredClone(DEFAULT_STORAGE));
  const a = new NotesService(adapter),
    b = new NotesService(new ChromeStorageAdapter());
  await Promise.all([
    a.createNote({
      scope: 'global',
      url: '',
      content: '<img src="data:image/png;base64,' + 'A'.repeat(1_100_000) + '">',
    }),
    b.createNote({ scope: 'global', url: '', content: 'another window' }),
  ]);
  const saved = await adapter.get();
  expect(Object.keys(saved.notes_global)).toHaveLength(2);
  const backup = createManualBackupEnvelope(saved);
  expect(parseBackupImportResult(JSON.parse(JSON.stringify(backup))).ok).toBe(true);
  const imported = parseBackupImport(legacy)!;
  await adapter.importWithSnapshot((current) => applyBackupImport(imported, current).data);
  expect((await a.getAllNotes()).length).toBe(6);
  await adapter.restoreRecoverySnapshot();
  expect(await a.getAllNotes()).toHaveLength(2);
}, 10_000);
