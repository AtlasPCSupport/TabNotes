import React, { useState } from 'react';
import {
  Note,
  NoteScope,
  ChromeStorageAdapter,
  NotesService,
  WorkspacesService,
  exportData,
  importData,
  encryptText,
  decryptText,
  renderMarkdown,
} from '@tabnotes/shared';
import type { ExportData, ExportPrefs } from '@tabnotes/shared';
import { useSidePanelStore } from '../store';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cr: any =
  typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).chrome
    ? (globalThis as Record<string, unknown>).chrome
    : null;

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
  const [dataFeedback, setDataFeedback] = useState<{
    type: 'success' | 'error';
    msg: string;
  } | null>(null);

  const title = useSidePanelStore((s) => s.title);
  const content = useSidePanelStore((s) => s.content);
  const setContent = useSidePanelStore((s) => s.setContent);
  const tags = useSidePanelStore((s) => s.tags);
  const allNotes = useSidePanelStore((s) => s.allNotes);
  const setAllNotes = useSidePanelStore((s) => s.setAllNotes);
  const setWorkspaces = useSidePanelStore((s) => s.setWorkspaces);
  const setNoteColors = useSidePanelStore((s) => s.setNoteColors);
  const setPinnedNotes = useSidePanelStore((s) => s.setPinnedNotes);
  const setFontSizeState = useSidePanelStore((s) => s.setFontSizeState);
  const setDefaultAlignState = useSidePanelStore((s) => s.setDefaultAlignState);
  const setFeatures = useSidePanelStore((s) => s.setFeatures);
  const currentDomain = useSidePanelStore((s) => s.currentDomain);

  const showFeedback = (type: 'success' | 'error', msg: string) => {
    setDataFeedback({ type, msg });
    setTimeout(() => setDataFeedback(null), 3500);
  };

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
  a{color:#2b5be8} ul{padding-left:20px} li{margin:3px 0}
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
        content: 'This note is encrypted.',
        encrypted: true,
        encryptedData: encrypted,
      });
      setContent('This note is encrypted.');
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
      await noteSvc.current.updateNote(id, {
        content: decrypted,
        encrypted: false,
        encryptedData: undefined,
      });
      setContent(decrypted);
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

  const handleExport = async () => {
    try {
      const data = await adapter.current.get();
      const payload = exportData(data);

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

      payload.prefs = prefs;
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
      showFeedback('success', `Exported ${payload.notes.length} notes`);
    } catch {
      showFeedback('error', 'Export failed');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as ExportData;
      if (!Array.isArray(parsed.notes)) throw new Error('Invalid format');

      const current = await adapter.current.get();
      const merged = importData(parsed, current);
      await adapter.current.set(merged);

      if (parsed.prefs) {
        const p = parsed.prefs;
        if (p.colors != null) {
          localStorage.setItem('tn_colors', JSON.stringify(p.colors));
          setNoteColors(p.colors);
        }
        if (p.folderColors != null) {
          localStorage.setItem('tn_folder_colors', JSON.stringify(p.folderColors));
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
      const added = parsed.notes.length;
      showFeedback('success', `Imported ${added} note${added !== 1 ? 's' : ''}`);
    } catch {
      showFeedback('error', 'Invalid backup file');
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  return {
    dataFeedback,
    exportCurrentNote,
    exportToPDF,
    handleLockNote,
    handleUnlockNote,
    handleExport,
    handleImport,
  };
}
