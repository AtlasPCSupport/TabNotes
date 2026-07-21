import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSidePanelStore, runtime } from '../store';
import {
  Note,
  NoteScope,
  normalizeDomain,
  type MoveNoteTarget,
  renderMarkdown,
  stripFormatting,
  autoTitleFromContent,
  sanitizeHtml,
  formatRelativeTime,
} from '@tabnotes/shared';
import { FormattingToolbar } from '../components/FormattingToolbar';
import { ChecklistEditor } from '../components/ChecklistEditor';
import type { ChecklistItem } from '@tabnotes/shared';
import { WikiAutocomplete } from '../components/WikiAutocomplete';
import { AppIcon } from '../components/AppIcon';
import { useTranslation, TranslationKey } from '@tabnotes/i18n';
import {
  AlarmClock,
  CalendarDays,
  Camera,
  Check,
  ListChecks,
  Copy as CopyIcon,
  Download,
  Eye,
  Folder as FolderIcon,
  Focus as FocusIcon,
  History,
  Lock,
  LockOpen,
  Palette,
  PanelRightOpen,
  Pin as PinIcon,
  Printer,
  SquarePen,
  type LucideIcon,
} from 'lucide-react';
import {
  formatDateTimeLocal,
  getDefaultReminderTimestamp,
  getMinimumReminderTimestamp,
  isSchedulableReminderTimestamp,
  parseDateTimeLocalInput,
} from '../../shared/reminders';
import {
  applyInlineColor,
  getActiveInlineFormats,
  insertHtmlAtSelection,
  insertTextAtSelection,
  replaceTextOffsets,
  toggleInlineFormat,
} from '../utils/editorCommands';

export interface EditorViewProps {
  // Loading states
  tabLoading: boolean;

  // Checklist presentation and persistence
  checklistMode: boolean;
  checklistItems: ChecklistItem[];
  setChecklistItems: (items: ChecklistItem[]) => void;
  saveChecklist: (items: ChecklistItem[]) => void;
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
  moveNote: (noteId: string, target: MoveNoteTarget) => Promise<void>;

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

const NOTE_COLORS = [
  { value: '', key: 'default' },
  { value: '#f59e0b', key: 'amber' },
  { value: '#10b981', key: 'green' },
  { value: '#3b82f6', key: 'blue' },
  { value: '#ec4899', key: 'pink' },
  { value: '#8b5cf6', key: 'purple' },
  { value: '#ef4444', key: 'red' },
];

export function EditorView({
  tabLoading,
  checklistMode,
  checklistItems,
  setChecklistItems,
  saveChecklist,
  toggleChecklistMode,
  editorRef,
  schedule,
  togglePin,
  colorPickerNoteId,
  setColorPickerNoteId,
  setNoteColor,
  showMovePicker,
  setShowMovePicker,
  moveNote,
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
  selectNote,
}: EditorViewProps) {
  const { t } = useTranslation();
  // Store selectors
  const currentUrl = useSidePanelStore((s) => s.currentUrl);
  const scope = useSidePanelStore((s) => s.scope);
  const view = useSidePanelStore((s) => s.view);
  const allNotes = useSidePanelStore((s) => s.allNotes);
  const workspaces = useSidePanelStore((s) => s.workspaces);
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
  const hasNoteBody = Boolean(content || title);
  const hasHistory = (activeNote?.versions?.length ?? 0) > 0;
  const reminderNow = Date.now();
  const reminderMinValue = formatDateTimeLocal(getMinimumReminderTimestamp(reminderNow));
  const parsedReminderAt = parseDateTimeLocalInput(reminderInput);
  const canSetReminder = isSchedulableReminderTimestamp(parsedReminderAt, reminderNow);
  const showReminderValidation = Boolean(reminderInput) && !canSetReminder;
  const metaIcon = (Icon: LucideIcon) => <Icon aria-hidden="true" size={14} strokeWidth={2.35} />;
  const metaAction = (icon: React.ReactNode, label: React.ReactNode) => (
    <>
      <span className="sp-meta-toggle-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="sp-meta-toggle-label">{label}</span>
    </>
  );

  // Local state for WikiAutocomplete suggest dropdown
  const [wikiQuery, setWikiQuery] = useState<string | null>(null);
  const [wikiAnchor, setWikiAnchor] = useState<{ start: number; end: number } | null>(null);

  // FormattingToolbar states
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorMode, setColorMode] = useState<'text' | 'highlight'>('text');
  const fmtRef = useRef<HTMLDivElement>(null);
  const reminderInputRef = useRef<HTMLInputElement>(null);
  const [moveScope, setMoveScope] = useState<NoteScope>('domain');
  const [moveWorkspaceIdInput, setMoveWorkspaceIdInput] = useState<string>('__none__');
  const [moveFolderInput, setMoveFolderInput] = useState('');
  const [moveBusy, setMoveBusy] = useState(false);
  const [moveError, setMoveError] = useState<TranslationKey | null>(null);
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

  const moveWorkspaceId = moveWorkspaceIdInput === '__none__' ? null : moveWorkspaceIdInput;
  const moveFolderDatalistId = activeNoteId ? `sp-move-folders-${activeNoteId}` : 'sp-move-folders';
  const moveFolderSuggestions = React.useMemo(() => {
    return [
      ...new Set(
        allNotes
          .filter((note) => note.workspaceId === moveWorkspaceId)
          .map((note) => note.folder)
          .filter(Boolean) as string[]
      ),
    ].sort();
  }, [allNotes, moveWorkspaceId]);

  // ── Track active format state at cursor position ─────────────────────
  useEffect(() => {
    const update = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !editorRef.current?.contains(sel.anchorNode)) return;
      setFmtActive(getActiveInlineFormats(editorRef.current));
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

  useEffect(() => {
    if (!showMovePicker || !activeNote) return;
    setMoveScope(activeNote.scope);
    setMoveWorkspaceIdInput(activeNote.workspaceId ?? '__none__');
    setMoveFolderInput(activeNote.folder ?? '');
    setMoveError(null);
  }, [showMovePicker, activeNote]);

  const handleMoveSubmit = useCallback(async () => {
    if (!activeNoteId) return;
    if ((moveScope === 'url' || moveScope === 'domain') && !currentUrl) {
      setMoveError('editor.moveNeedsUrl');
      return;
    }

    setMoveBusy(true);
    setMoveError(null);
    const trimmedFolder = moveFolderInput.trim();
    const normalizedFolder = trimmedFolder
      ? trimmedFolder.startsWith('/')
        ? trimmedFolder
        : `/${trimmedFolder}`
      : null;

    const target: MoveNoteTarget = {
      scope: moveScope,
      workspaceId: moveWorkspaceId,
      folder: normalizedFolder,
    };
    if (moveScope === 'url' || moveScope === 'domain') {
      target.url = currentUrl;
    }

    try {
      await moveNote(activeNoteId, target);
      setShowMovePicker(false);
    } catch {
      setMoveError('editor.moveFailed');
    } finally {
      setMoveBusy(false);
    }
  }, [
    activeNoteId,
    moveScope,
    currentUrl,
    moveFolderInput,
    moveWorkspaceId,
    moveNote,
    setShowMovePicker,
  ]);

  const handleReminderConfirm = useCallback(async () => {
    const ts = parseDateTimeLocalInput(reminderInput);
    if (!isSchedulableReminderTimestamp(ts)) {
      setReminderInput(formatDateTimeLocal(getDefaultReminderTimestamp()));
      return;
    }
    await onSetReminder(ts);
    setShowReminderPicker(false);
    setReminderInput('');
  }, [reminderInput, onSetReminder, setReminderInput, setShowReminderPicker]);

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
      applyInlineColor(el, color, mode);
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
      const execMap: Record<string, string> = {
        '**': 'bold',
        '*': 'italic',
        __: 'underline',
        '~~': 'strikeThrough',
      };
      if (execMap[cmd]) {
        const command = execMap[cmd] === 'strikeThrough' ? 'strike' : execMap[cmd];
        toggleInlineFormat(el, command as 'bold' | 'italic' | 'underline' | 'strike');
      } else if (cmd === '==') {
        toggleInlineFormat(el, 'highlight');
      } else if (cmd === '`') {
        toggleInlineFormat(el, 'code');
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
      replaceTextOffsets(editorRef.current, wikiAnchor.start, wikiAnchor.end, `[[${noteTitle}]]`);
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
          <div className="sp-empty-icon">
            <AppIcon name="lock" size={30} />
          </div>
          <div className="sp-empty-title">{t('editor.restrictedTitle')}</div>
          <div className="sp-empty-desc">{t('editor.restricted')}</div>
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
              fontSize={fontSize}
              changeFontSize={changeFontSize}
              fontSizeMinusTitle={t('editor.fontSizeMinus')}
              fontSizePlusTitle={t('editor.fontSizePlus')}
              showColorPicker={showColorPicker}
              setShowColorPicker={setShowColorPicker}
              colorMode={colorMode}
              setColorMode={setColorMode}
            />
          )}

          {checklistMode ? (
            <ChecklistEditor
              checklistItems={checklistItems}
              setChecklistItems={setChecklistItems}
              saveChecklist={saveChecklist}
              disabled={tabLoading}
            />
          ) : preview && markdownEnabled ? (
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
              }}
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
                className="sp-note-textarea sp-rich-editor"
                contentEditable={!tabLoading}
                suppressContentEditableWarning
                autoFocus={!tabLoading}
                data-placeholder={t('editor.placeholder', {
                  scope: t(`scope.${scope}` as TranslationKey),
                })}
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
                    insertHtmlAtSelection(e.currentTarget, safe);
                  } else {
                    const text = cd.getData('text/plain');
                    insertTextAtSelection(e.currentTarget, text);
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
              {stripFormatting(content).split(/\s+/).filter(Boolean).length}
              {t('editor.words')}
            </span>
            <span className="sp-note-meta-sep">·</span>
            <span className="sp-note-meta-text">
              {stripFormatting(content).length}
              {t('editor.characters')}
            </span>
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

            <div className="sp-note-meta-actions">
              <button
                type="button"
                className="sp-meta-more-trigger"
                aria-haspopup="true"
                aria-label={t('editor.moreOptions')}
              >
                <span className="sp-meta-more-dot" aria-hidden="true" />
                {t('editor.moreOptions')}
              </button>

              <div
                className="sp-note-meta-action-panel"
                role="toolbar"
                aria-label={t('editor.moreOptions')}
              >
                {/* Move note */}
                <div className="sp-meta-popover-anchor">
                  <button
                    className={`sp-meta-toggle${activeNote?.folder ? ' active' : ''}`}
                    disabled={!activeNoteId}
                    onClick={() => {
                      if (!activeNoteId) return;
                      setShowMovePicker(!showMovePicker);
                    }}
                    title={
                      activeNote?.folder
                        ? t('editor.inFolder', { name: activeNote.folder.replace(/^\//, '') })
                        : t('editor.folderTooltip')
                    }
                  >
                    {metaAction(metaIcon(FolderIcon), t('editor.actionFolder'))}
                  </button>
                  {activeNoteId && showMovePicker && (
                    <form
                      className="sp-move-picker sp-move-picker-advanced"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void handleMoveSubmit();
                      }}
                    >
                      <div className="sp-move-field">
                        <label className="sp-move-label" htmlFor="tn-move-workspace">
                          {t('editor.moveWorkspaceLabel')}
                        </label>
                        <select
                          id="tn-move-workspace"
                          className="sp-move-select"
                          value={moveWorkspaceIdInput}
                          onChange={(event) => setMoveWorkspaceIdInput(event.target.value)}
                          disabled={moveBusy}
                        >
                          <option value="__none__">{t('settingsSections.noWorkspace')}</option>
                          {workspaces.map((workspace) => (
                            <option key={workspace.id} value={workspace.id}>
                              {workspace.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sp-move-field">
                        <label className="sp-move-label" htmlFor="tn-move-scope">
                          {t('editor.moveScopeLabel')}
                        </label>
                        <select
                          id="tn-move-scope"
                          className="sp-move-select"
                          value={moveScope}
                          onChange={(event) => setMoveScope(event.target.value as NoteScope)}
                          disabled={moveBusy}
                        >
                          <option value="url">{t('scope.url')}</option>
                          <option value="domain">{t('scope.domain')}</option>
                          <option value="workspace">{t('scope.workspace')}</option>
                          <option value="global">{t('scope.global')}</option>
                        </select>
                        {(moveScope === 'url' || moveScope === 'domain') && (
                          <div className="sp-move-hint">
                            {moveScope === 'url'
                              ? t('editor.moveUsesCurrentUrl')
                              : t('editor.moveUsesCurrentDomain', {
                                  domain: normalizeDomain(currentUrl),
                                })}
                          </div>
                        )}
                      </div>

                      <div className="sp-move-field">
                        <label className="sp-move-label" htmlFor="tn-move-folder">
                          {t('editor.moveFolderLabel')}
                        </label>
                        <input
                          id="tn-move-folder"
                          className="sp-move-input"
                          value={moveFolderInput}
                          onChange={(event) => setMoveFolderInput(event.target.value)}
                          placeholder={t('editor.moveNoFolder')}
                          list={moveFolderDatalistId}
                          disabled={moveBusy}
                        />
                        <datalist id={moveFolderDatalistId}>
                          {moveFolderSuggestions.map((folder) => (
                            <option key={folder} value={folder} />
                          ))}
                        </datalist>
                      </div>

                      {moveError && <div className="sp-move-error">{t(moveError)}</div>}

                      <div className="sp-move-actions">
                        <button
                          type="button"
                          className="sp-move-cancel-btn"
                          onClick={() => setShowMovePicker(false)}
                          disabled={moveBusy}
                        >
                          {t('common.cancel')}
                        </button>
                        <button type="submit" className="sp-move-submit-btn" disabled={moveBusy}>
                          {moveBusy ? t('editor.moving') : t('editor.moveApply')}
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Insert date */}
                <button
                  className="sp-meta-toggle"
                  onClick={insertDatetime}
                  title={t('editor.datetimeTooltip') + ' (Ctrl+D)'}
                >
                  {metaAction(metaIcon(CalendarDays), t('editor.actionDate'))}
                </button>

                {/* Pin */}
                <button
                  className={`sp-meta-toggle${
                    activeNoteId && pinnedNotes.has(activeNoteId) ? ' active' : ''
                  }`}
                  disabled={!activeNoteId}
                  onClick={() => {
                    if (!activeNoteId) return;
                    togglePin(activeNoteId);
                  }}
                  title={
                    activeNoteId && pinnedNotes.has(activeNoteId)
                      ? t('editor.unpinTooltip')
                      : t('editor.pinTooltip')
                  }
                >
                  {metaAction(
                    metaIcon(PinIcon),
                    activeNoteId && pinnedNotes.has(activeNoteId)
                      ? t('editor.actionPinned')
                      : t('editor.actionPin')
                  )}
                </button>

                {/* Color picker */}
                <div className="sp-meta-popover-anchor">
                  <button
                    className={`sp-meta-toggle${activeNoteColor ? ' active' : ''}`}
                    disabled={!activeNoteId}
                    onClick={() => {
                      if (!activeNoteId) return;
                      setColorPickerNoteId(colorPickerNoteId ? null : activeNoteId);
                    }}
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
                    {metaAction(metaIcon(Palette), t('editor.actionColor'))}
                  </button>
                  {activeNoteId && colorPickerNoteId === activeNoteId && (
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
                                    activeNoteColor === c.value ? `0 0 0 2px ${c.value}55` : 'none',
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
                          title={t(`formatting.colors.${c.key}` as TranslationKey)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Export current note */}
                <button
                  className="sp-meta-toggle"
                  disabled={!hasNoteBody}
                  onClick={exportCurrentNote}
                  title={t('editor.exportTooltip')}
                >
                  {metaAction(metaIcon(Download), t('editor.actionExportMd'))}
                </button>

                {/* Export to PDF */}
                <button
                  className="sp-meta-toggle"
                  disabled={!hasNoteBody}
                  onClick={exportToPDF}
                  title={t('editor.printTooltip')}
                >
                  {metaAction(metaIcon(Printer), t('editor.actionPdf'))}
                </button>

                {/* Screenshot capture */}
                {markdownEnabled && (
                  <button
                    className="sp-meta-toggle"
                    onClick={captureScreenshot}
                    title={t('editor.screenshotTooltip')}
                  >
                    {metaAction(metaIcon(Camera), t('editor.actionScreenshot'))}
                  </button>
                )}

                {/* Encrypt note */}
                <button
                  className={`sp-meta-toggle${activeNote?.encrypted ? ' active' : ''}`}
                  disabled={!activeNoteId}
                  onClick={() => {
                    if (!activeNoteId) return;
                    setShowEncPrompt(activeNote?.encrypted ? 'unlock' : 'lock');
                  }}
                  title={
                    activeNote?.encrypted ? t('editor.decryptTooltip') : t('editor.encryptTooltip')
                  }
                >
                  {metaAction(
                    metaIcon(activeNote?.encrypted ? LockOpen : Lock),
                    activeNote?.encrypted ? t('editor.actionDecrypt') : t('editor.actionEncrypt')
                  )}
                </button>

                {/* Focus mode */}
                <button
                  className={`sp-meta-toggle${focusMode ? ' active' : ''}`}
                  onClick={() => setFocusMode(!focusMode)}
                  title={
                    focusMode
                      ? t('editor.focusExitTooltip') + ' (Esc)'
                      : t('editor.focusTooltip') + ' (Ctrl+Shift+F)'
                  }
                >
                  {metaAction(metaIcon(FocusIcon), t('editor.actionFocus'))}
                </button>

                {/* Reference panel (dual view) */}
                <button
                  className={`sp-meta-toggle${showRefPanel ? ' active' : ''}`}
                  onClick={() => setShowRefPanel(!showRefPanel)}
                  title={
                    showRefPanel ? t('editor.refPanelExitTooltip') : t('editor.refPanelTooltip')
                  }
                >
                  {metaAction(
                    metaIcon(PanelRightOpen),
                    showRefPanel ? t('editor.actionRefClose') : t('editor.actionReference')
                  )}
                </button>

                {/* Copy */}
                <button
                  className={`sp-meta-toggle${copied ? ' active' : ''}`}
                  disabled={!content}
                  onClick={copyNote}
                  title={copied ? t('editor.copySuccessTooltip') : t('editor.copyTooltip')}
                >
                  {metaAction(
                    metaIcon(copied ? Check : CopyIcon),
                    copied ? t('editor.actionCopied') : t('editor.actionCopy')
                  )}
                </button>

                {/* Version history */}
                <div className="sp-meta-popover-anchor" ref={historyRef}>
                  <button
                    className={`sp-meta-toggle${showHistory ? ' active' : ''}`}
                    disabled={!hasHistory}
                    onClick={() => {
                      if (!hasHistory) return;
                      setShowHistory(!showHistory);
                    }}
                    title={t('editor.historyTooltip')}
                  >
                    {metaAction(metaIcon(History), t('editor.actionHistory'))}
                  </button>
                  {activeNoteId && hasHistory && showHistory && (
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

                {/* Reminder */}
                <div className="sp-meta-popover-anchor" ref={reminderRef}>
                  <button
                    className={`sp-meta-toggle${activeNote?.reminderAt ? ' active' : ''}`}
                    disabled={!activeNoteId}
                    onClick={() => {
                      if (!activeNoteId) return;
                      if (activeNote?.reminderAt) {
                        onClearReminder();
                      } else {
                        const willOpen = !showReminderPicker;
                        if (willOpen && !isSchedulableReminderTimestamp(parsedReminderAt)) {
                          setReminderInput(formatDateTimeLocal(getDefaultReminderTimestamp()));
                        }
                        setShowReminderPicker(willOpen);
                      }
                    }}
                    title={
                      activeNote?.reminderAt
                        ? t('editor.reminderSetFor', {
                            date: new Date(activeNote.reminderAt).toLocaleString(),
                          })
                        : t('editor.reminderTooltip')
                    }
                  >
                    {metaAction(
                      metaIcon(activeNote?.reminderAt ? Check : AlarmClock),
                      activeNote?.reminderAt
                        ? t('editor.actionReminderSet')
                        : t('editor.actionReminder')
                    )}
                  </button>
                  {showReminderPicker && (
                    <div className="sp-reminder-picker">
                      <div className="sp-reminder-label">{t('editor.remindMeAt')}</div>
                      <div className="sp-reminder-input-wrap">
                        <div className="sp-reminder-datetime-control">
                          <input
                            ref={reminderInputRef}
                            type="datetime-local"
                            className="sp-reminder-input"
                            value={reminderInput}
                            onChange={(e) => setReminderInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && canSetReminder) {
                                e.preventDefault();
                                void handleReminderConfirm();
                              }
                            }}
                            min={reminderMinValue}
                          />
                          <button
                            type="button"
                            className="sp-reminder-picker-trigger"
                            title={t('editor.remindMeAt')}
                            aria-label={t('editor.remindMeAt')}
                            onClick={() => {
                              const input = reminderInputRef.current;
                              input?.focus();
                              input?.showPicker?.();
                            }}
                          >
                            <CalendarDays size={15} strokeWidth={2.35} />
                          </button>
                        </div>
                        <button
                          type="button"
                          className="sp-reminder-ok-btn"
                          title={t('editor.setReminder')}
                          aria-label={t('editor.setReminder')}
                          disabled={!canSetReminder}
                          onClick={() => {
                            void handleReminderConfirm();
                          }}
                        >
                          {t('common.ok')}
                        </button>
                      </div>
                      {showReminderValidation && (
                        <div className="sp-reminder-validation">{t('editor.reminderInvalid')}</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Clip feedback badge */}
                {clipFeedback && (
                  <span className="sp-clip-badge">
                    <AppIcon name="check" size={12} /> {t('editor.clippedFeedback')}
                  </span>
                )}

                {/* Checklist mode */}
                {activeNoteId && (
                  <button
                    type="button"
                    className={`sp-meta-toggle${checklistMode ? ' active' : ''}`}
                    onClick={toggleChecklistMode}
                    title={
                      checklistMode
                        ? t('editor.checklistExitTooltip')
                        : t('editor.checklistTooltip')
                    }
                  >
                    {metaAction(
                      metaIcon(ListChecks),
                      checklistMode ? t('editor.actionPlainText') : t('editor.actionChecklist')
                    )}
                  </button>
                )}

                {/* Markdown preview */}
                {markdownEnabled && (
                  <button
                    className={`sp-meta-toggle${preview ? ' active' : ''}`}
                    onClick={() => setPreview(!preview)}
                    title={t('editor.markdownTooltip')}
                  >
                    {metaAction(
                      metaIcon(preview ? SquarePen : Eye),
                      preview ? t('editor.actionEdit') : t('editor.actionPreview')
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default EditorView;
