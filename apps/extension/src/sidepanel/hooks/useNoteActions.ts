import React, { useEffect, useState } from 'react';
import {
  Note,
  NoteScope,
  ChromeStorageAdapter,
  NotesService,
  WorkspacesService,
  applyBackupImport,
  createEncryptedManualBackupEnvelope,
  createManualBackupEnvelope,
  decryptEncryptedManualBackupEnvelope,
  decryptText,
  encryptText,
  isBackupImportTextWithinLimit,
  isEncryptedManualBackupEnvelope,
  isEncryptedManualBackupTextWithinLimit,
  MAX_ENCRYPTED_MANUAL_BACKUP_FILE_BYTES,
  parseBackupImportResult,
  renderMarkdown,
} from '@tabnotes/shared';
import type { ExportPrefs } from '@tabnotes/shared';
import i18n, { resolveLanguage, useTranslation } from '@tabnotes/i18n';
import { useSidePanelStore } from '../store';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cr: any =
  typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).chrome
    ? (globalThis as Record<string, unknown>).chrome
    : null;

interface ReminderAlarmRestoreResult {
  cleared: number;
  scheduled: number;
  fired: number;
}

function restoreReminderAlarms(): Promise<ReminderAlarmRestoreResult | null> {
  return new Promise((resolve) => {
    if (!cr?.runtime?.sendMessage) {
      resolve(null);
      return;
    }

    cr.runtime.sendMessage(
      { type: 'RESTORE_REMINDER_ALARMS' },
      (response?: { ok?: boolean; result?: ReminderAlarmRestoreResult }) => {
        if (cr.runtime.lastError || !response?.ok) {
          resolve(null);
          return;
        }
        resolve(response.result ?? null);
      }
    );
  });
}

function countPrefs(prefs: ExportPrefs | undefined): number {
  if (!prefs) return 0;
  return [
    prefs.colors,
    prefs.folderColors,
    prefs.pins,
    prefs.fontsize,
    prefs.align,
    prefs.features,
    prefs.digest,
    prefs.streak,
    prefs.backupRemindDays,
    prefs.language,
  ].filter((value) => value !== undefined && value !== null).length;
}

interface UseNoteActionsProps {
  adapter: React.MutableRefObject<ChromeStorageAdapter>;
  noteSvc: React.MutableRefObject<NotesService>;
  wsSvc: React.MutableRefObject<WorkspacesService>;
  refreshAllNotes: () => Promise<Note[]>;
  setContextNotes: (notes: Note[]) => void;
  scopeRef: React.MutableRefObject<NoteScope>;
  currentUrlRef: React.MutableRefObject<string>;
  wsIdRef: React.MutableRefObject<string | null>;
  activeNoteIdRef: React.MutableRefObject<string | null>;
  importInputRef: React.RefObject<HTMLInputElement>;
  setBackupRemindDays: (days: number) => void;
}

export function useNoteActions({
  adapter,
  noteSvc,
  wsSvc,
  refreshAllNotes,
  setContextNotes,
  scopeRef,
  currentUrlRef,
  wsIdRef,
  activeNoteIdRef,
  importInputRef,
  setBackupRemindDays,
}: UseNoteActionsProps) {
  const { t } = useTranslation();
  const [dataFeedback, setDataFeedback] = useState<{
    type: 'success' | 'error';
    msg: string;
  } | null>(null);
  const [canRestoreImport, setCanRestoreImport] = useState(false);

  useEffect(() => {
    let active = true;
    void adapter.current
      .getRecoverySnapshot()
      .then((snapshot) => {
        if (active) setCanRestoreImport(Boolean(snapshot));
      })
      .catch(() => {
        if (active) setCanRestoreImport(false);
      });
    return () => {
      active = false;
    };
  }, [adapter]);

  const title = useSidePanelStore((s) => s.title);
  const content = useSidePanelStore((s) => s.content);
  const setContent = useSidePanelStore((s) => s.setContent);
  const tags = useSidePanelStore((s) => s.tags);
  const allNotes = useSidePanelStore((s) => s.allNotes);
  const setAllNotes = useSidePanelStore((s) => s.setAllNotes);
  const setWorkspaces = useSidePanelStore((s) => s.setWorkspaces);
  const setNoteColors = useSidePanelStore((s) => s.setNoteColors);
  const setPinnedNotes = useSidePanelStore((s) => s.setPinnedNotes);
  const setFolderColors = useSidePanelStore((s) => s.setFolderColors);
  const setFontSizeState = useSidePanelStore((s) => s.setFontSizeState);
  const setDefaultAlignState = useSidePanelStore((s) => s.setDefaultAlignState);
  const setFeatures = useSidePanelStore((s) => s.setFeatures);
  const setActiveWorkspaceId = useSidePanelStore((s) => s.setActiveWorkspaceId);
  const setDefaultScopeState = useSidePanelStore((s) => s.setDefaultScope);
  const setScope = useSidePanelStore((s) => s.setScope);
  const setThemeState = useSidePanelStore((s) => s.setThemeState);
  const setMdState = useSidePanelStore((s) => s.setMdState);
  const setLanguageState = useSidePanelStore((s) => s.setLanguageState);
  const setActiveNoteId = useSidePanelStore((s) => s.setActiveNoteId);
  const setTitle = useSidePanelStore((s) => s.setTitle);
  const setTags = useSidePanelStore((s) => s.setTags);
  const setSaved = useSidePanelStore((s) => s.setSaved);
  const currentDomain = useSidePanelStore((s) => s.currentDomain);
  const showFeedback = (type: 'success' | 'error', msg: string) => {
    setDataFeedback({ type, msg });
    setTimeout(() => setDataFeedback(null), 3500);
  };

  const countLabel = (count: number, key: string) =>
    t('backup.count', { count, label: t(`backup.${key}`, { count }) });

  const exportCurrentNote = () => {
    if (!content && !title) return;
    const text = [title ? `# ${title}` : '', content].filter(Boolean).join('\n\n');
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = (title || 'note')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 30);
    a.href = url;
    a.download = `${slug}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8"><title>${title || 'TabNote'}</title>
<style>
  body{font-family:Georgia,serif;max-width:700px;margin:40px auto;padding:0 20px;color:#1a1a1a;line-height:1.7}
  h1,h2,h3{font-family:system-ui,sans-serif}
  h1{border-bottom:2px solid #e5e7eb;padding-bottom:8px}
  code{background:#f5f5f5;padding:2px 5px;border-radius:3px;font-size:.88em}
  blockquote{border-left:3px solid #9ca3af;padding-left:16px;color:#6b7280;margin:0 0 1em}
  a{color:#dcae19} ul{padding-left:20px} li{margin:3px 0}
  .meta{font-size:.8em;color:#9ca3af;padding-bottom:10px;margin-bottom:20px;border-bottom:1px solid #f0f0f0}
  @media print{body{margin:0}}
</style></head><body>
${title ? `<h1>${title}</h1>` : ''}
<div class="meta">${new Date().toLocaleString()}${currentDomain ? ` · ${currentDomain}` : ''}${tags ? ` · Tags: ${tags}` : ''}</div>
${renderMarkdown(content)}
<script>window.addEventListener('load',()=>window.print());</script>
</body></html>`;
    if (cr?.tabs?.create) {
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      cr.tabs.create({ url });
    } else {
      const w = window.open('', '_blank');
      w?.document.write(html);
      w?.document.close();
    }
  };

  const handleLockNote = async (password: string): Promise<boolean> => {
    const id = activeNoteIdRef.current;
    if (!id || !password) return false;
    try {
      const encrypted = await encryptText(content, password);
      await noteSvc.current.updateNote(id, {
        content: t('encryption.encryptedPlaceholder'),
        encrypted: true,
        encryptedData: encrypted,
      });
      setContent(t('encryption.encryptedPlaceholder'));
      const notes = await noteSvc.current.getNotesByScope(
        scopeRef.current,
        currentUrlRef.current,
        wsIdRef.current
      );
      setContextNotes(notes);
      await refreshAllNotes();
      return true;
    } catch {
      return false;
    }
  };

  const handleUnlockNote = async (password: string): Promise<boolean> => {
    const id = activeNoteIdRef.current;
    const note = allNotes.find((n) => n.id === id);
    if (!id || !password || !note?.encryptedData) return false;
    try {
      const decrypted = await decryptText(note.encryptedData, password);
      setContent(decrypted);
      return true;
    } catch {
      return false;
    }
  };

  const handleExport = async () => {
    try {
      const data = await adapter.current.get();
      const prefs: ExportPrefs = {};
      const colors = localStorage.getItem('tn_colors');
      const pins = localStorage.getItem('tn_pins');
      const fs = localStorage.getItem('tn_fontsize');
      const al = localStorage.getItem('tn_align');
      const ft = localStorage.getItem('tn_features');
      const fColors = localStorage.getItem('tn_folder_colors');
      if (colors) prefs.colors = JSON.parse(colors);
      if (fColors) prefs.folderColors = JSON.parse(fColors);
      if (pins) prefs.pins = JSON.parse(pins);
      if (fs) prefs.fontsize = Number(fs);
      if (al) prefs.align = al as ExportPrefs['align'];
      if (ft) prefs.features = JSON.parse(ft);

      await new Promise<void>((resolve) => {
        cr?.storage?.local?.get(
          ['tn_digest', 'tn_streak', 'tn_backup_remind'],
          (res: Record<string, unknown>) => {
            if (res?.tn_digest) prefs.digest = res.tn_digest as ExportPrefs['digest'];
            if (res?.tn_streak) prefs.streak = res.tn_streak as ExportPrefs['streak'];
            if (res?.tn_backup_remind)
              prefs.backupRemindDays = (res.tn_backup_remind as { days?: number })?.days ?? 7;
            resolve();
          }
        );
      });

      const backup = createManualBackupEnvelope(data, prefs);
      const password = window.prompt(t('backup.passwordPrompt'));
      if (password === null) return;
      const payload = password
        ? await createEncryptedManualBackupEnvelope(backup, password)
        : backup;
      cr?.storage?.local?.set({ tn_last_export: Date.now() });

      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `tabnotes-backup-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showFeedback('success', t('backup.exported', { count: backup.data.notes.length }));
    } catch {
      showFeedback('error', t('backup.exportFailed'));
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > MAX_ENCRYPTED_MANUAL_BACKUP_FILE_BYTES) {
        throw new Error(t('backup.invalidFormat'));
      }
      const text = await file.text();
      let rawBackup: unknown;
      try {
        rawBackup = JSON.parse(text);
      } catch {
        throw new Error(t('backup.invalidFormat'));
      }
      const encrypted = isEncryptedManualBackupEnvelope(rawBackup);
      if (
        !(encrypted
          ? isEncryptedManualBackupTextWithinLimit(text)
          : isBackupImportTextWithinLimit(text))
      ) {
        throw new Error(t('backup.invalidFormat'));
      }
      let parsedInput: unknown = rawBackup;
      if (encrypted) {
        const password = window.prompt(t('backup.encryptedPasswordPrompt'));
        if (!password) throw new Error(t('backup.encryptedPasswordRequired'));
        parsedInput = await decryptEncryptedManualBackupEnvelope(rawBackup, password);
      }
      const result = parsedInput ? parseBackupImportResult(parsedInput) : null;
      if (!result?.ok) throw new Error(t('backup.invalidFormat'));
      const parsed = result.value;

      const current = await adapter.current.get();
      const currentPrefs: Record<string, unknown> = {};
      const localPrefKeys = ['tn_colors', 'tn_folder_colors', 'tn_pins', 'tn_fontsize', 'tn_align', 'tn_features'];
      for (const k of localPrefKeys) {
        const val = localStorage.getItem(k);
        if (val !== null) currentPrefs[k] = val;
      }
      await new Promise<void>((resolve) => {
        cr?.storage?.local?.get(['tn_digest', 'tn_streak', 'tn_backup_remind'], (res: Record<string, unknown>) => {
          if (res?.tn_digest !== undefined) currentPrefs.tn_digest = res.tn_digest;
          if (res?.tn_streak !== undefined) currentPrefs.tn_streak = res.tn_streak;
          if (res?.tn_backup_remind !== undefined) currentPrefs.tn_backup_remind = res.tn_backup_remind;
          resolve();
        });
      });

      const restored = applyBackupImport(parsed, current);
      await adapter.current.createRecoverySnapshot('before-import', Date.now(), currentPrefs);
      setCanRestoreImport(true);
      await adapter.current.set(restored.data);
      const reminderAlarms = await restoreReminderAlarms();

      if (parsed.data.prefs) {
        const p = parsed.data.prefs;
        if (p.colors != null) {
          localStorage.setItem('tn_colors', JSON.stringify(p.colors));
          setNoteColors(p.colors);
        }
        if (p.folderColors != null) {
          localStorage.setItem('tn_folder_colors', JSON.stringify(p.folderColors));
          setFolderColors(p.folderColors);
        }
        if (p.pins != null) {
          localStorage.setItem('tn_pins', JSON.stringify(p.pins));
          setPinnedNotes(new Set(p.pins));
        }
        if (p.fontsize != null) {
          localStorage.setItem('tn_fontsize', String(p.fontsize));
          setFontSizeState(p.fontsize);
        }
        if (p.align != null) {
          localStorage.setItem('tn_align', p.align);
          setDefaultAlignState(p.align);
        }
        if (p.features != null) {
          localStorage.setItem('tn_features', JSON.stringify(p.features));
          setFeatures((prev) => ({ ...prev, ...p.features }));
        }
        if (p.digest != null) cr?.storage?.local?.set({ tn_digest: p.digest });
        if (p.streak != null) cr?.storage?.local?.set({ tn_streak: p.streak });
        if (p.backupRemindDays != null) {
          setBackupRemindDays(p.backupRemindDays);
          cr?.storage?.local?.set({ tn_backup_remind: { days: p.backupRemindDays } });
          cr?.runtime?.sendMessage({ type: 'SET_BACKUP_REMIND', days: p.backupRemindDays });
        }
      }

      const [notes, wsList] = await Promise.all([
        noteSvc.current.getAllNotes(),
        wsSvc.current.getAll(),
      ]);
      setAllNotes(notes);
      setWorkspaces(wsList);

      const nextScope = restored.data.defaultScope;
      const nextWorkspaceId = restored.data.activeWorkspaceId;
      scopeRef.current = nextScope;
      wsIdRef.current = nextWorkspaceId;
      setDefaultScopeState(nextScope);
      setScope(nextScope);
      setActiveWorkspaceId(nextWorkspaceId);
      setThemeState(restored.data.theme);
      setMdState(restored.data.markdownEnabled);
      const nextLanguage = resolveLanguage(
        restored.data.language ??
          parsed.data.prefs?.language ??
          i18n.resolvedLanguage ??
          i18n.language
      );
      setLanguageState(nextLanguage);
      await i18n.changeLanguage(nextLanguage);

      const contextNotes = await noteSvc.current.getNotesByScope(
        nextScope,
        currentUrlRef.current,
        nextWorkspaceId
      );
      setContextNotes(contextNotes);
      const active =
        contextNotes.find((note) => note.id === activeNoteIdRef.current) ?? contextNotes[0] ?? null;
      activeNoteIdRef.current = active?.id ?? null;
      setActiveNoteId(active?.id ?? null);
      setContent(active?.content ?? '');
      setTitle(active?.title ?? '');
      setTags(active?.tags.join(', ') ?? '');
      setSaved(false);

      const notesTouched = restored.summary.notesAdded + restored.summary.notesUpdated;
      const workspacesTouched =
        restored.summary.workspacesAdded + restored.summary.workspacesUpdated;
      const preferenceCount =
        restored.summary.storageSettingsRestored + countPrefs(parsed.data.prefs);
      const scheduledCount = reminderAlarms?.scheduled ?? 0;
      const firedCount = reminderAlarms?.fired ?? 0;
      const reminderText =
        firedCount > 0
          ? `${t('backup.remindersScheduledCount', {
              count: scheduledCount,
            })}, ${t('backup.dueRemindersFiredCount', { count: firedCount })}`
          : t('backup.remindersScheduledCount', { count: scheduledCount });

      showFeedback(
        'success',
        t('backup.restoreSummary', {
          notes: countLabel(notesTouched, 'note'),
          workspaces: countLabel(workspacesTouched, 'workspace'),
          preferences: countLabel(preferenceCount, 'preference'),
          reminders: reminderText,
        })
      );
    } catch {
      showFeedback('error', t('backup.invalidFile'));
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const restorePreImportSnapshot = async () => {
    try {
      const snapshot = await adapter.current.restoreRecoverySnapshot();
      if (!snapshot) {
        setCanRestoreImport(false);
        showFeedback('error', t('backup.recoveryUnavailable'));
        return;
      }

      if (snapshot.prefs) {
        const localKeys = ['tn_colors', 'tn_folder_colors', 'tn_pins', 'tn_fontsize', 'tn_align', 'tn_features'];
        for (const k of localKeys) {
          if (snapshot.prefs[k] !== undefined) {
            localStorage.setItem(k, String(snapshot.prefs[k]));
          } else {
            localStorage.removeItem(k);
          }
        }
        const chromeKeys = ['tn_digest', 'tn_streak', 'tn_backup_remind'];
        for (const k of chromeKeys) {
          if (snapshot.prefs[k] !== undefined) {
            cr?.storage?.local?.set({ [k]: snapshot.prefs[k] });
          } else {
            cr?.storage?.local?.remove(k);
          }
        }
      }

      await restoreReminderAlarms();
      await refreshAllNotes();
      const [current, wsList] = await Promise.all([adapter.current.get(), wsSvc.current.getAll()]);
      setWorkspaces(wsList);
      scopeRef.current = current.defaultScope;
      wsIdRef.current = current.activeWorkspaceId;
      setDefaultScopeState(current.defaultScope);
      setScope(current.defaultScope);
      setActiveWorkspaceId(current.activeWorkspaceId);
      setThemeState(current.theme);
      setMdState(current.markdownEnabled);
      const nextLanguage = resolveLanguage(
        current.language ?? i18n.resolvedLanguage ?? i18n.language
      );
      setLanguageState(nextLanguage);
      await i18n.changeLanguage(nextLanguage);

      const contextNotes = await noteSvc.current.getNotesByScope(
        current.defaultScope,
        currentUrlRef.current,
        current.activeWorkspaceId
      );
      setContextNotes(contextNotes);
      const active =
        contextNotes.find((note) => note.id === activeNoteIdRef.current) ?? contextNotes[0] ?? null;
      activeNoteIdRef.current = active?.id ?? null;
      setActiveNoteId(active?.id ?? null);
      setContent(active?.content ?? '');
      setTitle(active?.title ?? '');
      setTags(active?.tags.join(', ') ?? '');
      setSaved(false);
      await adapter.current.clearRecoverySnapshot();
      setCanRestoreImport(false);
      showFeedback('success', t('backup.recoveryRestored'));
    } catch {
      showFeedback('error', t('backup.recoveryUnavailable'));
    }
  };

  return {
    dataFeedback,
    canRestoreImport,
    restorePreImportSnapshot,
    exportCurrentNote,
    exportToPDF,
    handleLockNote,
    handleUnlockNote,
    handleExport,
    handleImport,
  };
}
