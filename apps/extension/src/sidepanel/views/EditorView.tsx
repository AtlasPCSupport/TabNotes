import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSidePanelStore, runtime } from '../store';
import {
  Note,
  renderMarkdown,
  stripFormatting,
  autoTitleFromContent,
  sanitizeHtml,
  formatRelativeTime,
} from '@tabnotes/shared';
import { ICONS } from '../icons';
import { FormattingToolbar } from '../components/FormattingToolbar';
import { ChecklistEditor } from '../components/ChecklistEditor';
import { WikiAutocomplete } from '../components/WikiAutocomplete';
import { useTranslation, TranslationKey } from '@tabnotes/i18n';

export interface EditorViewProps {
  // Loading states
  tabLoading: boolean;

  // Checklist states & handlers
  checklistMode: boolean;
  checklistItems: { id: string; checked: boolean; text: string }[];
  setChecklistItems: (items: { id: string; checked: boolean; text: string }[]) => void;
  saveChecklist: (items: { id: string; checked: boolean; text: string }[]) => void;
  isUpdatingChecklistRef: React.MutableRefObject<boolean>;
  toggleChecklistMode: () => void;

  // Editor ref (so SidePanelApp can access the DOM node)
  editorRef: React.RefObject<HTMLDivElement>;

  // Autosave / Sync / Save handlers
  schedule: (c: string, t: string, tg: string) => void;

  // Pin & color handlers
  togglePin: (noteId: string) => void;
  colorPickerNoteId: string | null;
  setColorPickerNoteId: (id: string | null) => void;
  setNoteColor: (noteId: string, color: string) => void;

  // Folder selection and new folder states
  showMovePicker: boolean;
  setShowMovePicker: (v: boolean) => void;
  setShowNewFolder: (v: boolean) => void;
  moveNoteToFolder: (noteId: string, folder: string | undefined) => void;

  // DateTime and sizing handlers
  insertDatetime: () => void;
  changeFontSize: (dir: 1 | -1) => void;

  // Export handlers
  exportCurrentNote: () => void;
  exportToPDF: () => void;
  captureScreenshot: () => void;

  // Encryption panel triggers
  setShowEncPrompt: (mode: 'lock' | 'unlock' | null) => void;

  // UI layout/mode toggles
  focusMode: boolean;
  setFocusMode: (v: boolean) => void;
  showRefPanel: boolean;
  setShowRefPanel: (v: boolean) => void;
  typewriterMode: boolean;
  setTypewriterMode: (v: boolean) => void;

  // Clipboard functionality
  copied: boolean;
  copyNote: () => void;

  // Note version history states & handlers
  showHistory: boolean;
  setShowHistory: (v: boolean) => void;
  historyRef: React.RefObject<HTMLDivElement>;

  // Reminder states & handlers
  showReminderPicker: boolean;
  setShowReminderPicker: (v: boolean) => void;
  reminderRef: React.RefObject<HTMLDivElement>;
  reminderInput: string;
  setReminderInput: (v: string) => void;
  onSetReminder: (ts: number) => Promise<void>;
  onClearReminder: () => Promise<void>;

  // Clipboard Clipper feedback
  clipFeedback: boolean;

  // Global actions / Select
  selectNote: (n: Note) => void;
}

interface ModifiableSelection extends Selection {
  modify(alter: 'move' | 'extend', direction: string, granularity: string): void;
}

const NOTE_COLORS = [
  { value: '', label: 'Default' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#10b981', label: 'Green' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ef4444', label: 'Red' },
];



export function EditorView({
  tabLoading,
  checklistMode,
  checklistItems,
  setChecklistItems,
  saveChecklist,
  isUpdatingChecklistRef,
  toggleChecklistMode,
  editorRef,
  schedule,
  togglePin,
  colorPickerNoteId,
  setColorPickerNoteId,
  setNoteColor,
  showMovePicker,
  setShowMovePicker,
  setShowNewFolder,
  moveNoteToFolder,
  insertDatetime,
  changeFontSize,
  exportCurrentNote,
  exportToPDF,
  captureScreenshot,
  setShowEncPrompt,
  focusMode,
  setFocusMode,
  showRefPanel,
  setShowRefPanel,
  copied,
  copyNote,
  showHistory,
  setShowHistory,
  historyRef,
  showReminderPicker,
  setShowReminderPicker,
  reminderRef,
  reminderInput,
  setReminderInput,
  onSetReminder,
  onClearReminder,
  clipFeedback,
  typewriterMode,
  setTypewriterMode,
  selectNote,
}: EditorViewProps) {
  const { t } = useTranslation();
  // Store selectors
  const currentUrl = useSidePanelStore((s) => s.currentUrl);
  const scope = useSidePanelStore((s) => s.scope);
  const view = useSidePanelStore((s) => s.view);
  const allNotes = useSidePanelStore((s) => s.allNotes);
  const activeNoteId = useSidePanelStore((s) => s.activeNoteId);
  const setView = useSidePanelStore((s) => s.setView);
  const content = useSidePanelStore((s) => s.content);
  const setContent = useSidePanelStore((s) => s.setContent);
  const title = useSidePanelStore((s) => s.title);
  const setTitle = useSidePanelStore((s) => s.setTitle);
  const tags = useSidePanelStore((s) => s.tags);
  const setTags = useSidePanelStore((s) => s.setTags);
  const preview = useSidePanelStore((s) => s.preview);
  const setPreview = useSidePanelStore((s) => s.setPreview);
  const markdownEnabled = useSidePanelStore((s) => s.markdownEnabled);
  const features = useSidePanelStore((s) => s.features);
  const fontSize = useSidePanelStore((s) => s.fontSize);
  const defaultAlign = useSidePanelStore((s) => s.defaultAlign);
  const noteColors = useSidePanelStore((s) => s.noteColors);
  const contextNotes = useSidePanelStore((s) => s.contextNotes);
  const pinnedNotes = useSidePanelStore((s) => s.pinnedNotes);

  // Derived state
  const isRestrictedUrl =
    !currentUrl ||
    currentUrl.startsWith('chrome://') ||
    currentUrl.startsWith('chrome-extension://');

  const activeNote = contextNotes.find((n) => n.id === activeNoteId) ?? null;
  const activeNoteColor = activeNoteId ? (noteColors[activeNoteId] ?? '') : '';
  const scopeFolders = React.useMemo(() => {
    return [...new Set(contextNotes.map((n) => n.folder).filter(Boolean) as string[])].sort();
  }, [contextNotes]);

  // Local state for WikiAutocomplete suggest dropdown
  const [wikiQuery, setWikiQuery] = useState<string | null>(null);
  const [wikiAnchor, setWikiAnchor] = useState<{ start: number; end: number } | null>(null);

  // FormattingToolbar states
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorMode, setColorMode] = useState<'text' | 'highlight'>('text');
  const fmtRef = useRef<HTMLDivElement>(null);
  const [fmtActive, setFmtActive] = useState({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    code: false,
    highlight: false,
  });

  // Related note suggestions states
  const [suggestions, setSuggestions] = useState<Note[]>([]);
  const suggDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Track active format state at cursor position ─────────────────────
  useEffect(() => {
    const update = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !editorRef.current?.contains(sel.anchorNode)) return;
      const anchor = sel.anchorNode;
      const anchorEl =
        anchor?.nodeType === Node.TEXT_NODE ? anchor.parentElement : (anchor as Element);
      setFmtActive({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strike: document.queryCommandState('strikeThrough'),
        code: !!anchorEl?.closest('code'),
        highlight: !!anchorEl?.closest('.tn-highlight'),
      });
    };
    document.addEventListener('selectionchange', update);
    return () => document.removeEventListener('selectionchange', update);
  }, [editorRef]);

  // Close color picker on outside click
  useEffect(() => {
    if (!showColorPicker) return;
    const handler = (e: MouseEvent) => {
      if (fmtRef.current && !fmtRef.current.contains(e.target as Node)) setShowColorPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColorPicker]);

  // ── Smart suggestions: debounced related-note lookup ──────────
  useEffect(() => {
    if (suggDebounceRef.current) clearTimeout(suggDebounceRef.current);
    if (!stripFormatting(content).trim() || view !== 'note' || allNotes.length < 2) {
      setSuggestions([]);
      return;
    }
    suggDebounceRef.current = setTimeout(() => {
      const words = stripFormatting(content).split(/\s+/).slice(-30).join(' ');
      const qWords = words
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3);
      if (qWords.length === 0) {
        setSuggestions([]);
        return;
      }
      const ranked = [...allNotes]
        .filter((n) => n.id !== activeNoteId)
        .map((n) => {
          const text = `${n.title ?? ''} ${n.content}`.toLowerCase();
          const score = qWords.reduce((s, w) => s + (text.split(w).length - 1), 0);
          return { note: n, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((x) => x.note);
      setSuggestions(ranked);
    }, 700);

    return () => {
      if (suggDebounceRef.current) clearTimeout(suggDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, activeNoteId, allNotes.length, view]);

  // Keyboard shortcut listener for escape key to close wiki links
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setWikiQuery(null);
        setWikiAnchor(null);
      }
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, []);

  // ── Typewriter mode: keep cursor line vertically centered ─────
  useEffect(() => {
    if (!typewriterMode || !editorRef.current) return;
    const el = editorRef.current;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    if (rect.top !== 0) {
      el.scrollTop += rect.top - elRect.top - el.clientHeight / 2;
    }
  }, [content, typewriterMode, editorRef]);

  // Keep track of the last loaded note ID to force sync when switching notes
  const lastNoteIdRef = useRef<string | null>(null);

  // ── Sync editor innerHTML when content changes ────────────────
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    const isNoteSwitch = activeNoteId !== lastNoteIdRef.current;
    lastNoteIdRef.current = activeNoteId;

    // Do not overwrite user input while typing, unless switching notes
    if (document.activeElement === el && !isNoteSwitch) return;

    const safeContent = sanitizeHtml(content);
    if (el.innerHTML !== safeContent) {
      el.innerHTML = safeContent;
    }
  }, [content, activeNoteId, preview, editorRef]);

  // ── Apply text / highlight color to selection ─────────────────
  const applyColor = useCallback(
    (color: string, mode: 'text' | 'highlight') => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      if (mode === 'text') {
        document.execCommand('foreColor', false, color);
      } else {
        document.execCommand('hiliteColor', false, color);
      }
      requestAnimationFrame(() => {
        const html = el.innerHTML;
        setContent(html);
        schedule(html, title, tags);
      });
      setShowColorPicker(false);
    },
    [title, tags, schedule, setContent, editorRef]
  );

  // ── Formatting toolbar: wrap selected textarea text ───────────
  const wrapSel = useCallback(
    (cmd: string, _after?: string) => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      const execMap: Record<string, string> = {
        '**': 'bold',
        '*': 'italic',
        __: 'underline',
        '~~': 'strikeThrough',
      };
      if (execMap[cmd]) {
        document.execCommand(execMap[cmd]);
      } else if (cmd === '==') {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        const anchor = range.commonAncestorContainer;
        const anchorEl =
          anchor.nodeType === Node.TEXT_NODE ? anchor.parentElement : (anchor as Element);
        const existing = anchorEl?.closest('.tn-highlight');
        if (existing) {
          // Toggle OFF — unwrap the highlight span
          const p = existing.parentNode!;
          while (existing.firstChild) p.insertBefore(existing.firstChild, existing);
          p.removeChild(existing);
          p.normalize();
        } else if (!sel.isCollapsed) {
          // Toggle ON — wrap selection in highlight span
          const span = document.createElement('span');
          span.className = 'tn-highlight';
          span.appendChild(range.extractContents());
          range.insertNode(span);
          sel.removeAllRanges();
          const r2 = document.createRange();
          r2.selectNodeContents(span);
          sel.addRange(r2);
        }
      } else if (cmd === '`') {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        const anchor = range.commonAncestorContainer;
        const anchorEl =
          anchor.nodeType === Node.TEXT_NODE ? anchor.parentElement : (anchor as Element);
        const existing = anchorEl?.closest('code');
        if (existing) {
          // Toggle OFF — unwrap the code element
          const p = existing.parentNode!;
          const children = Array.from(existing.childNodes);
          if (children.length > 0) {
            const first = children[0];
            const last = children[children.length - 1];
            while (existing.firstChild) p.insertBefore(existing.firstChild, existing);
            p.removeChild(existing);
            p.normalize();
            
            // Re-select the contents
            const r2 = document.createRange();
            r2.setStartBefore(first);
            r2.setEndAfter(last);
            sel.removeAllRanges();
            sel.addRange(r2);
          } else {
            p.removeChild(existing);
            p.normalize();
          }
        } else {
          // Toggle ON — wrap selection in code element
          const code = document.createElement('code');
          if (!sel.isCollapsed) {
            code.appendChild(range.extractContents());
            range.insertNode(code);
            // Select the code element contents
            sel.removeAllRanges();
            const r2 = document.createRange();
            r2.selectNodeContents(code);
            sel.addRange(r2);
          } else {
            // If selection is collapsed, insert a zero-width space so the element is not empty,
            // allowing text to be typed inside it.
            const zwsp = document.createTextNode('\u200B');
            code.appendChild(zwsp);
            range.insertNode(code);
            
            // Position the cursor inside the code element, after the zero-width space
            const r2 = document.createRange();
            r2.setStart(zwsp, 1);
            r2.collapse(true);
            sel.removeAllRanges();
            sel.addRange(r2);
          }
        }
      }
      requestAnimationFrame(() => {
        const html = el.innerHTML;
        setContent(html);
        schedule(html, title, tags);
      });
      setShowColorPicker(false);
    },
    [title, tags, schedule, setContent, editorRef]
  );

  // ── Wiki link autocomplete ───────────────────────────────────
  const insertWikiLink = useCallback(
    (noteTitle: string) => {
      if (!wikiAnchor || !editorRef.current) return;
      editorRef.current.focus();
      const sel = window.getSelection();
      if (!sel) return;
      const queryLen = wikiAnchor.end - wikiAnchor.start;
      sel.collapseToEnd();
      const modifiableSel = sel as ModifiableSelection;
      for (let i = 0; i < queryLen; i++) {
        modifiableSel.modify('extend', 'backward', 'character');
      }
      document.execCommand('insertText', false, `[[${noteTitle}]]`);
      const html = editorRef.current.innerHTML;
      setContent(html);
      schedule(html, title, tags);
      setWikiQuery(null);
      setWikiAnchor(null);
    },
    [wikiAnchor, title, tags, schedule, setContent, editorRef]
  );

  const formatRelativeTimeText = (savedAt: number) => {
    return formatRelativeTime(savedAt);
  };

  return (
    <div className="sp-note-view">
      {isRestrictedUrl ? (
        <div className="sp-empty-state" style={{ flex: 1 }}>
          <div className="sp-empty-icon">{ICONS.lock}</div>
          <div className="sp-empty-title">{t('editor.restrictedTitle')}</div>
          <div className="sp-empty-desc">
            {t('editor.restricted')}
          </div>
        </div>
      ) : (
        <>
          <input
            className="sp-note-title-input"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              schedule(content, e.target.value, tags);
            }}
            onBlur={() => {
              const plainContent = stripFormatting(content);
              if (!title.trim() && plainContent.trim()) {
                const auto = autoTitleFromContent(plainContent);
                if (auto) {
                  setTitle(auto);
                  schedule(content, auto, tags);
                }
              }
            }}
            placeholder={
              stripFormatting(content).trim()
                ? autoTitleFromContent(stripFormatting(content)) || t('editor.titlePlaceholder')
                : t('editor.titlePlaceholder')
            }
            disabled={tabLoading}
          />

          {/* ── Formatting toolbar ── */}
          {!preview && features.formattingBar && (
            <FormattingToolbar
              fmtRef={fmtRef}
              fmtActive={fmtActive}
              wrapSel={wrapSel}
              applyColor={applyColor}
              showColorPicker={showColorPicker}
              setShowColorPicker={setShowColorPicker}
              colorMode={colorMode}
              setColorMode={setColorMode}
            />
          )}

          {preview && markdownEnabled ? (
            <div
              className="sp-markdown-preview"
              style={
                activeNoteColor
                  ? { borderLeft: `3px solid ${activeNoteColor}`, paddingLeft: 11 }
                  : undefined
              }
              dangerouslySetInnerHTML={{
                __html: content
                  ? renderMarkdown(content)
                  : '<p style="color:var(--text-subtle);font-style:italic">Nothing to preview yet.</p>',
              }}
              onClick={(e) => {
                const t = e.target as HTMLElement;
                // Wiki link navigation
                const wl = t.closest('.tn-wikilink') as HTMLElement | null;
                if (wl) {
                  const wiki = (wl.dataset.wiki ?? '').toLowerCase();
                  const target = allNotes.find(
                    (n) =>
                      (n.title ?? '').toLowerCase() === wiki ||
                      stripFormatting(n.content).split('\n')[0].toLowerCase() === wiki
                  );
                  if (target) {
                    selectNote(target);
                    setView('note');
                  }
                  return;
                }
                // Checkbox toggle
                if (t.tagName !== 'INPUT' || t.getAttribute('data-task') !== 'true') return;
                const span = t.nextElementSibling;
                const taskText = span?.textContent?.trim() ?? '';
                const checked = (t as HTMLInputElement).checked;
                const from = checked ? `- [ ] ${taskText}` : `- [x] ${taskText}`;
                const to = checked ? `- [x] ${taskText}` : `- [ ] ${taskText}`;
                const next = content.replace(from, to);
                setContent(next);
                schedule(next, title, tags);
              }}
            />
          ) : checklistMode ? (
            <ChecklistEditor
              checklistItems={checklistItems}
              setChecklistItems={setChecklistItems}
              saveChecklist={saveChecklist}
              isUpdatingChecklistRef={isUpdatingChecklistRef}
            />
          ) : (
            <div className="sp-editor-scroll-shell">
              <div
                ref={(el) => {
                  if (editorRef) {
                    (editorRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                  }
                  runtime.editorEl = el;
                }}
                className={`sp-note-textarea sp-rich-editor${typewriterMode ? ' tn-typewriter' : ''}`}
                contentEditable={!tabLoading}
                suppressContentEditableWarning
                autoFocus={!tabLoading}
                data-placeholder={t('editor.placeholder', { scope: t(`scope.${scope}` as TranslationKey) })}
                style={{
                  fontSize: fontSize,
                  textAlign: defaultAlign as React.CSSProperties['textAlign'],
                  ...(activeNoteColor
                    ? { borderLeft: `3px solid ${activeNoteColor}`, paddingLeft: 11 }
                    : {}),
                }}
                onPaste={(e) => {
                  // Intercept paste so arbitrary clipboard HTML is sanitized
                  // before it enters the editable surface (stored-XSS guard).
                  const cd = e.clipboardData;
                  if (!cd) return;
                  const html = cd.getData('text/html');
                  e.preventDefault();
                  if (html) {
                    const safe = sanitizeHtml(html);
                    document.execCommand('insertHTML', false, safe);
                  } else {
                    const text = cd.getData('text/plain');
                    document.execCommand('insertText', false, text);
                  }
                  const el = e.currentTarget;
                  const next = el.innerHTML;
                  setContent(next);
                  schedule(next, title, tags);
                }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  // Chrome leaves <br> in empty contentEditable — normalize to ''
                  if (el.innerHTML === '<br>') el.innerHTML = '';
                  const html = el.innerHTML;
                  setContent(html);
                  schedule(html, title, tags);
                  if (features.wikiLinks) {
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount > 0) {
                      const range = sel.getRangeAt(0);
                      const node = range.startContainer;
                      if (node.nodeType === Node.TEXT_NODE) {
                        const textBefore = (node.textContent ?? '').slice(0, range.startOffset);
                        const m = textBefore.match(/\[\[([^\]]*?)$/);
                        if (m) {
                          setWikiQuery(m[1]);
                          const r2 = range.cloneRange();
                          r2.selectNodeContents(el);
                          r2.setEnd(range.startContainer, range.startOffset);
                          const anchorEnd = r2.toString().length;
                          setWikiAnchor({ start: anchorEnd - m[0].length, end: anchorEnd });
                        } else {
                          setWikiQuery(null);
                          setWikiAnchor(null);
                        }
                      } else {
                        setWikiQuery(null);
                        setWikiAnchor(null);
                      }
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (!(e.ctrlKey || e.metaKey)) return;
                  if (e.key === 'b') {
                    e.preventDefault();
                    wrapSel('**');
                  }
                  if (e.key === 'i') {
                    e.preventDefault();
                    wrapSel('*');
                  }
                  if (e.key === 'u') {
                    e.preventDefault();
                    wrapSel('__');
                  }
                }}
              />
              {features.wikiLinks && wikiQuery !== null && (
                <WikiAutocomplete
                  wikiQuery={wikiQuery}
                  activeNoteId={activeNoteId}
                  onSelect={insertWikiLink}
                />
              )}
            </div>
          )}

          {/* ── Smart suggestions ── */}
          {features.smartSuggestions && suggestions.length > 0 && (
            <div className="sp-suggestions">
              <span className="sp-suggestions-label">{t('editor.related')}</span>
              {suggestions.map((n) => (
                <button
                  key={n.id}
                  className="sp-suggestion-item"
                  onClick={() => {
                    selectNote(n);
                    setSuggestions([]);
                  }}
                  title={stripFormatting(n.content).slice(0, 120)}
                >
                  <span className="sp-suggestion-title">
                    {stripFormatting(n.title || n.content.split('\n')[0]).slice(0, 36) ||
                      t('editor.untitled')}
                  </span>
                </button>
              ))}
              <button className="sp-suggestions-dismiss" onClick={() => setSuggestions([])}>
                ×
              </button>
            </div>
          )}

          <div className="sp-tags-row">
            <span className="sp-tags-label">{t('editor.tags')}</span>
            <input
              className="sp-tags-input"
              value={tags}
              onChange={(e) => {
                setTags(e.target.value);
                schedule(content, title, e.target.value);
              }}
              placeholder={t('editor.tagsPlaceholder')}
              disabled={tabLoading}
            />
          </div>

          <div className="sp-note-meta">
            <span className="sp-note-meta-text">
              {stripFormatting(content).split(/\s+/).filter(Boolean).length}{t('editor.words')}
            </span>
            <span className="sp-note-meta-sep">·</span>
            <span className="sp-note-meta-text">{stripFormatting(content).length}{t('editor.characters')}</span>
            {(() => {
              const wordCount = stripFormatting(content).split(/\s+/).filter(Boolean).length;
              if (wordCount >= 50) {
                const minutes = Math.ceil(wordCount / 200);
                return (
                  <>
                    <span className="sp-note-meta-sep">·</span>
                    <span className="sp-note-meta-text">
                      {t('editor.readingTime', { minutes })}
                    </span>
                  </>
                );
              }
              return null;
            })()}
            <span className="sp-note-meta-spacer" />

            {/* Move to folder */}
            {activeNoteId && (
              <div style={{ position: 'relative' }}>
                <button
                  className={`sp-meta-toggle${activeNote?.folder ? ' active' : ''}`}
                  onClick={() => setShowMovePicker(!showMovePicker)}
                  title={activeNote?.folder ? t('editor.inFolder', { name: activeNote.folder.replace(/^\//, '') }) : t('editor.folderTooltip')}
                >
                  {ICONS.folder}
                  {activeNote?.folder ? ' ' + activeNote.folder.replace(/^\//, '') : ''}
                </button>
                {showMovePicker && (
                  <div className="sp-move-picker">
                    <button
                      className={`sp-move-item${!activeNote?.folder ? ' active' : ''}`}
                      onClick={() => moveNoteToFolder(activeNoteId, undefined)}
                    >
                      {ICONS.doc} {t('folders.noFolder')}
                    </button>
                    {scopeFolders.map((f) => (
                      <button
                        key={f}
                        className={`sp-move-item${activeNote?.folder === f ? ' active' : ''}`}
                        onClick={() => moveNoteToFolder(activeNoteId, f)}
                      >
                        {ICONS.folder} {f.replace(/^\//, '')}
                      </button>
                    ))}
                    <div className="sp-move-divider" />
                    <button
                      className="sp-move-item new"
                      onClick={() => {
                        setShowMovePicker(false);
                        setShowNewFolder(true);
                      }}
                    >
                      ＋ {t('folders.newFolder')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Insert date */}
            <button
              className="sp-meta-toggle"
              onClick={insertDatetime}
              title={t('editor.datetimeTooltip') + ' (Ctrl+D)'}
            >
              {ICONS.calendar}
            </button>

            {/* Font size */}
            <button
              className="sp-meta-toggle"
              onClick={() => changeFontSize(-1)}
              title={t('editor.fontSizeMinus')}
              style={{ fontWeight: 700 }}
            >
              A-
            </button>
            <button
              className="sp-meta-toggle"
              onClick={() => changeFontSize(1)}
              title={t('editor.fontSizePlus')}
              style={{ fontWeight: 700 }}
            >
              A+
            </button>

            {/* Pin */}
            {activeNoteId && (
              <button
                className={`sp-meta-toggle${pinnedNotes.has(activeNoteId) ? ' active' : ''}`}
                onClick={() => togglePin(activeNoteId)}
                title={pinnedNotes.has(activeNoteId) ? t('editor.unpinTooltip') : t('editor.pinTooltip')}
              >
                {ICONS.pin}
              </button>
            )}

            {/* Color picker */}
            {activeNoteId && (
              <div style={{ position: 'relative' }}>
                <button
                  className={`sp-meta-toggle${activeNoteColor ? ' active' : ''}`}
                  onClick={() => setColorPickerNoteId(colorPickerNoteId ? null : activeNoteId)}
                  title={t('editor.paletteTooltip')}
                  style={
                    activeNoteColor
                      ? {
                          borderLeftColor: activeNoteColor,
                          borderLeftWidth: 3,
                          color: activeNoteColor,
                        }
                      : undefined
                  }
                >
                  {ICONS.palette}
                </button>
                {colorPickerNoteId === activeNoteId && (
                  <div className="sp-color-picker">
                    {NOTE_COLORS.map((c) => (
                      <button
                        key={c.value}
                        className={`sp-color-swatch${activeNoteColor === c.value ? ' active' : ''}`}
                        style={
                          c.value
                            ? {
                                background: c.value,
                                border:
                                  '2px solid ' +
                                  (activeNoteColor === c.value ? c.value : 'transparent'),
                                boxShadow:
                                  activeNoteColor === c.value
                                    ? `0 0 0 2px ${c.value}55`
                                    : 'none',
                              }
                            : {
                                background: 'var(--bg-subtle)',
                                border: '2px solid var(--border)',
                                boxShadow:
                                  activeNoteColor === c.value
                                    ? '0 0 0 2px var(--accent)'
                                    : 'none',
                              }
                        }
                        onClick={() => setNoteColor(activeNoteId, c.value)}
                        title={c.label}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Export current note */}
            {(content || title) && (
              <button
                className="sp-meta-toggle"
                onClick={exportCurrentNote}
                title={t('editor.exportTooltip')}
              >
                ↓md
              </button>
            )}

            {/* Export to PDF */}
            {(content || title) && (
              <button
                className="sp-meta-toggle"
                onClick={exportToPDF}
                title={t('editor.printTooltip')}
              >
                {ICONS.print}
              </button>
            )}

            {/* Screenshot capture */}
            {markdownEnabled && (
              <button
                className="sp-meta-toggle"
                onClick={captureScreenshot}
                title={t('editor.screenshotTooltip')}
              >
                {ICONS.camera}
              </button>
            )}

            {/* Typewriter mode */}
            <button
              className={`sp-meta-toggle${typewriterMode ? ' active' : ''}`}
              onClick={() => setTypewriterMode(!typewriterMode)}
              title={
                typewriterMode
                  ? t('editor.typewriterExitTooltip') + ' (Ctrl+Shift+T)'
                  : t('editor.typewriterTooltip') + ' (Ctrl+Shift+T)'
              }
            >
              {ICONS.typewriter}
            </button>

            {/* Encrypt note */}
            {activeNoteId && (
              <button
                className={`sp-meta-toggle${activeNote?.encrypted ? ' active' : ''}`}
                onClick={() => {
                  setShowEncPrompt(activeNote?.encrypted ? 'unlock' : 'lock');
                }}
                title={activeNote?.encrypted ? t('editor.decryptTooltip') : t('editor.encryptTooltip')}
              >
                {activeNote?.encrypted ? ICONS.lock : ICONS.unlock}
              </button>
            )}

            {/* Focus mode */}
            <button
              className={`sp-meta-toggle${focusMode ? ' active' : ''}`}
              onClick={() => setFocusMode(!focusMode)}
              title={focusMode ? t('editor.focusExitTooltip') + ' (Esc)' : t('editor.focusTooltip') + ' (Ctrl+Shift+F)'}
            >
              {focusMode ? '⊠' : '⊡'}
            </button>

            {/* Reference panel (dual view) */}
            <button
              className={`sp-meta-toggle${showRefPanel ? ' active' : ''}`}
              onClick={() => setShowRefPanel(!showRefPanel)}
              title={showRefPanel ? t('editor.refPanelExitTooltip') : t('editor.refPanelTooltip')}
            >
              ⊟
            </button>

            {/* Copy */}
            {content && (
              <button
                className={`sp-meta-toggle${copied ? ' active' : ''}`}
                onClick={copyNote}
                title={copied ? t('editor.copySuccessTooltip') : t('editor.copyTooltip')}
              >
                {copied ? '✓' : '⎘'}
              </button>
            )}

            {/* Version history */}
            {activeNoteId && (activeNote?.versions?.length ?? 0) > 0 && (
              <div style={{ position: 'relative' }} ref={historyRef}>
                <button
                  className={`sp-meta-toggle${showHistory ? ' active' : ''}`}
                  onClick={() => setShowHistory(!showHistory)}
                  title={t('editor.historyTooltip')}
                >
                  {ICONS.history}
                </button>
                {showHistory && (
                  <div className="sp-history-panel">
                    <div className="sp-history-header">{t('editor.historyTooltip')}</div>
                    {[...(activeNote!.versions ?? [])].reverse().map((v, i) => (
                      <button
                        key={i}
                        className="sp-history-item"
                        onClick={() => {
                          setContent(v.content);
                          if (v.title !== undefined) setTitle(v.title ?? '');
                          schedule(v.content, v.title ?? title, tags);
                          setShowHistory(false);
                        }}
                      >
                        <span className="sp-history-time">
                          {formatRelativeTimeText(v.savedAt)}
                        </span>
                        <span className="sp-history-preview">
                          {stripFormatting(v.content).slice(0, 55) || t('editor.emptyVersion')}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Reminder */}
            {activeNoteId && (
              <div style={{ position: 'relative' }} ref={reminderRef}>
                <button
                  className={`sp-meta-toggle${activeNote?.reminderAt ? ' active' : ''}`}
                  onClick={() => {
                    if (activeNote?.reminderAt) {
                      onClearReminder();
                    } else {
                      setShowReminderPicker(!showReminderPicker);
                    }
                  }}
                  title={
                    activeNote?.reminderAt
                      ? t('editor.reminderSetFor', { date: new Date(activeNote.reminderAt).toLocaleString() })
                      : t('editor.reminderTooltip')
                  }
                >
                  {activeNote?.reminderAt ? '⏰✓' : '⏰'}
                </button>
                {showReminderPicker && (
                  <div className="sp-reminder-picker">
                    <div className="sp-reminder-label">{t('editor.remindMeAt')}</div>
                    <input
                      type="datetime-local"
                      className="sp-reminder-input"
                      value={reminderInput}
                      onChange={(e) => setReminderInput(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                    />
                    <button
                      className="sp-reminder-set-btn"
                      disabled={!reminderInput}
                      onClick={async () => {
                        const ts = new Date(reminderInput).getTime();
                        await onSetReminder(ts);
                      }}
                    >
                      {t('editor.setReminder')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Clip feedback badge */}
            {clipFeedback && <span className="sp-clip-badge">{ICONS.check} {t('editor.clippedFeedback')}</span>}

            {/* Checklist mode toggle */}
            {activeNoteId && (
              <button
                className={`sp-meta-toggle${checklistMode ? ' active' : ''}`}
                onClick={toggleChecklistMode}
                title={
                  checklistMode
                    ? t('editor.checklistExitTooltip')
                    : t('editor.checklistTooltip')
                }
              >
                {checklistMode ? '☑' : '☐'}
              </button>
            )}

            {/* Markdown preview */}
            {markdownEnabled && (
              <button
                className={`sp-meta-toggle${preview ? ' active' : ''}`}
                onClick={() => setPreview(!preview)}
                title={t('editor.markdownTooltip')}
              >
                {preview ? ICONS.note : ICONS.markdown}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default EditorView;
