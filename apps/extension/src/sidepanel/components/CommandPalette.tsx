import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useSidePanelStore } from '../store';
import { stripFormatting, NoteScope, Note } from '@tabnotes/shared';
import { AppIcon, type AppIconName } from './AppIcon';

export interface CommandPaletteProps {
  // Local states/handlers in parent
  setFocusMode: React.Dispatch<React.SetStateAction<boolean>>;
  setTypewriterMode: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Callback/service functions from SidePanelApp
  addNoteToContext: (folder?: string) => Promise<void>;
  selectNote: (n: Note) => void;
  captureScreenshot: () => void;
  exportToPDF: () => void;
  handleScopeChange: (scope: NoteScope) => void;
  loadContextNotes: (url: string, scope: NoteScope, wsId: string | null) => Promise<void>;
  
  // Refs from parent needed for functions
  currentUrlRef: React.RefObject<string>;
  scopeRef: React.RefObject<NoteScope>;
  wsIdRef: React.RefObject<string | null>;
}

interface PaletteItem {
  label: string;
  sublabel?: string;
  icon: AppIconName;
  shortcut?: string;
  run: () => void;
}

export function CommandPalette({
  setFocusMode,
  setTypewriterMode,
  addNoteToContext,
  selectNote,
  captureScreenshot,
  exportToPDF,
  handleScopeChange,
  loadContextNotes,
  currentUrlRef,
  scopeRef,
  wsIdRef,
}: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');
  const [cmdSelIdx, setCmdSelIdx] = useState(0);
  const cmdInputRef = useRef<HTMLInputElement>(null);

  const features = useSidePanelStore((s) => s.features);
  const allNotes = useSidePanelStore((s) => s.allNotes);
  const workspaces = useSidePanelStore((s) => s.workspaces);
  const activeWorkspaceId = useSidePanelStore((s) => s.activeWorkspaceId);
  const setView = useSidePanelStore((s) => s.setView);
  const setSettingsTarget = useSidePanelStore((s) => s.setSettingsTarget);
  const setMdState = useSidePanelStore((s) => s.setMdState);
  const setActiveWorkspaceId = useSidePanelStore((s) => s.setActiveWorkspaceId);

  // Global key listener for Ctrl+K
  useEffect(() => {
    const handleGlobalKeydown = (e: KeyboardEvent) => {
      if (!features.cmdPalette) return;
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const ctrl = isMac ? e.metaKey : e.ctrlKey;
      if (ctrl && e.key === 'k') {
        e.preventDefault();
        setCmdQuery('');
        setCmdSelIdx(0);
        setIsOpen(true);
      }
    };
    document.addEventListener('keydown', handleGlobalKeydown);
    return () => document.removeEventListener('keydown', handleGlobalKeydown);
  }, [features.cmdPalette]);

  // Autofocus input when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        cmdInputRef.current?.focus();
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const paletteItems: PaletteItem[] = useMemo(() => {
    const q = cmdQuery.toLowerCase().trim();
    const items: PaletteItem[] = [];

    // Notes — recent when no query, fuzzy-filtered when typing
    const notePool = q
      ? allNotes
          .filter((n) => `${n.title ?? ''} ${n.content}`.toLowerCase().includes(q))
          .slice(0, 8)
      : [...allNotes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);

    notePool.forEach((n) =>
      items.push({
        label: stripFormatting(n.title || n.content.split('\n')[0]) || 'Untitled',
        sublabel: stripFormatting(n.content.replace(/\n+/g, ' ')).slice(0, 72).trim(),
        icon: n.encrypted ? 'lock' : 'doc',
        run: () => {
          selectNote(n);
          setView('note');
        },
      })
    );

    // Actions
    const actions: PaletteItem[] = [
      {
        label: 'New note',
        icon: 'note',
        run: () => {
          addNoteToContext();
          setView('note');
        },
      },
      { label: 'All Notes', icon: 'list', run: () => setView('all') },
      { label: 'Note Graph', icon: 'graph', run: () => setView('graph') },
      {
        label: 'Settings',
        icon: 'settings',
        run: () => {
          setSettingsTarget(null);
          setView('settings');
        },
      },
      { label: 'Toggle Markdown', icon: 'markdown', run: () => setMdState((p) => !p) },
      {
        label: 'Toggle Focus mode',
        icon: 'focus',
        shortcut: 'Ctrl+Shift+F',
        run: () => setFocusMode((p) => !p),
      },
      {
        label: 'Toggle Typewriter',
        icon: 'typewriter',
        shortcut: 'Ctrl+Shift+T',
        run: () => setTypewriterMode((p) => !p),
      },
      { label: 'Capture screenshot', icon: 'camera', run: () => captureScreenshot() },
      { label: 'Export to PDF', icon: 'print', run: () => exportToPDF() },
      { label: 'Scope: URL', icon: 'url', run: () => handleScopeChange('url') },
      { label: 'Scope: Domain', icon: 'domain', run: () => handleScopeChange('domain') },
      {
        label: 'Scope: Projects',
        icon: 'workspace',
        run: () => handleScopeChange('workspace'),
      },
      { label: 'Scope: Global', icon: 'global', run: () => handleScopeChange('global') },
      ...workspaces.map((ws) => ({
        label: `Switch to workspace: ${ws.name}`,
        icon: 'workspace' as const,
        run: async () => {
          setActiveWorkspaceId(ws.id);
          if (wsIdRef.current) {
            (wsIdRef as React.MutableRefObject<string | null>).current = ws.id;
          }
          await loadContextNotes(currentUrlRef.current ?? '', scopeRef.current ?? 'global', ws.id);
        },
      })),
    ];

    const filteredActions = q ? actions.filter((a) => a.label.toLowerCase().includes(q)) : actions;
    filteredActions.forEach((a) => items.push(a));

    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmdQuery, allNotes, workspaces, activeWorkspaceId, addNoteToContext, selectNote, captureScreenshot, exportToPDF, handleScopeChange, loadContextNotes]);

  const paletteItemsRef = useRef(paletteItems);
  paletteItemsRef.current = paletteItems;

  if (!isOpen) return null;

  return (
    <div className="tn-palette-overlay" onMouseDown={() => setIsOpen(false)}>
      <div className="tn-palette-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="tn-palette-search-row">
          <span className="tn-palette-icon-search">
            <AppIcon name="command" size={15} />
          </span>
          <input
            ref={cmdInputRef}
            className="tn-palette-input"
            placeholder="Search notes or type a command…"
            value={cmdQuery}
            onChange={(e) => {
              setCmdQuery(e.target.value);
              setCmdSelIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsOpen(false);
                return;
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setCmdSelIdx((i) => Math.min(i + 1, paletteItemsRef.current.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setCmdSelIdx((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                const item = paletteItemsRef.current[cmdSelIdx];
                if (item) {
                  item.run();
                  setIsOpen(false);
                }
              }
            }}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="tn-palette-esc" onClick={() => setIsOpen(false)}>
            Esc
          </kbd>
        </div>

        <div className="tn-palette-divider" />

        <div className="tn-palette-list">
          {paletteItems.length === 0 && (
            <div className="tn-palette-empty">No results for "{cmdQuery}"</div>
          )}
          {paletteItems.map((item, idx) => (
            <button
              key={idx}
              className={`tn-palette-item${idx === cmdSelIdx ? ' selected' : ''}`}
              onMouseEnter={() => setCmdSelIdx(idx)}
              onMouseDown={(e) => {
                e.preventDefault();
                item.run();
                setIsOpen(false);
              }}
            >
              <span className="tn-palette-item-icon">
                <AppIcon name={item.icon} size={15} />
              </span>
              <span className="tn-palette-item-body">
                <span className="tn-palette-item-label">{item.label}</span>
                {item.sublabel && <span className="tn-palette-item-sub">{item.sublabel}</span>}
              </span>
              {item.shortcut && <kbd className="tn-palette-shortcut">{item.shortcut}</kbd>}
            </button>
          ))}
        </div>

        <div className="tn-palette-footer">
          <span>
            <kbd>↑↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> select
          </span>
          <span>
            <kbd>Esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
