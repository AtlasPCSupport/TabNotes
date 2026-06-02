import React, { useState, useEffect, useRef } from 'react';
import { WorkspacesService, NotesService, NoteScope, Note } from '@tabnotes/shared';
import { useSidePanelStore } from '../store';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cr: any =
  typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).chrome
    ? (globalThis as Record<string, unknown>).chrome
    : null;

interface UseWorkspaceManagerProps {
  wsSvc: React.MutableRefObject<WorkspacesService>;
  noteSvc: React.MutableRefObject<NotesService>;
  wsIdRef: React.MutableRefObject<string | null>;
  activeNoteId: string | null;
  currentUrlRef: React.MutableRefObject<string>;
  scopeRef: React.MutableRefObject<NoteScope>;
  refreshAllNotes: () => Promise<Note[]>;
  loadContextNotes: (url: string, scope: NoteScope, wsId: string | null) => Promise<void>;
}

export function useWorkspaceManager({
  wsSvc,
  noteSvc,
  wsIdRef,
  activeNoteId,
  currentUrlRef,
  scopeRef,
  refreshAllNotes,
  loadContextNotes,
}: UseWorkspaceManagerProps) {
  const workspaces = useSidePanelStore((s) => s.workspaces);
  const setWorkspaces = useSidePanelStore((s) => s.setWorkspaces);
  const activeWorkspaceId = useSidePanelStore((s) => s.activeWorkspaceId);
  const setActiveWorkspaceId = useSidePanelStore((s) => s.setActiveWorkspaceId);
  const setContextNotes = useSidePanelStore((s) => s.setContextNotes);

  const [editWsName, setEditWsName] = useState('');
  const [editWsColor, setEditWsColor] = useState('');
  const [newWsNameInput, setNewWsNameInput] = useState('');
  const [newWsColorInput, setNewWsColorInput] = useState('#2b5be8');

  // Workspace quick-switcher dropdown
  const [wsDropdown, setWsDropdown] = useState(false);
  const wsDropdownRef = useRef<HTMLDivElement>(null);

  // Click outside dropdown
  useEffect(() => {
    if (!wsDropdown) return;
    const handle = (e: MouseEvent) => {
      if (!wsDropdownRef.current?.contains(e.target as Node)) setWsDropdown(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [wsDropdown]);

  useEffect(() => {
    wsIdRef.current = activeWorkspaceId;
    const active = workspaces.find((w) => w.id === activeWorkspaceId);
    if (active) {
      setEditWsName(active.name);
      setEditWsColor(active.color || '#2f6dff');
    } else {
      setEditWsName('');
      setEditWsColor('');
    }
  }, [activeWorkspaceId, workspaces, wsIdRef]);

  const onSetActiveWorkspace = async (id: string | null) => {
    await wsSvc.current.setActive(id);
    setActiveWorkspaceId(id);
    wsIdRef.current = id;
  };

  const onSwitchWorkspace = async (id: string | null) => {
    await wsSvc.current.setActive(id);
    setActiveWorkspaceId(id);
    wsIdRef.current = id;
    setWsDropdown(false);
    await loadContextNotes(currentUrlRef.current, scopeRef.current, id);
  };

  const onUpdateWorkspace = async (id: string, name: string, color: string) => {
    await wsSvc.current.update(id, { name, color });
    const list = await wsSvc.current.getAll();
    setWorkspaces(list);
  };

  const onDeleteWorkspace = async (id: string, name: string) => {
    if (
      confirm(
        `Delete workspace "${name}"? All notes in this workspace will be deleted.`
      )
    ) {
      await wsSvc.current.delete(id);
      const list = await wsSvc.current.getAll();
      setWorkspaces(list);
      if (activeWorkspaceId === id) {
        setActiveWorkspaceId(null);
        wsIdRef.current = null;
      }
    }
  };

  const onCreateWorkspace = async (name: string, color: string) => {
    await wsSvc.current.create(name, color);
    const list = await wsSvc.current.getAll();
    setWorkspaces(list);
    setNewWsNameInput('');
    setNewWsColorInput('#2b5be8');
  };

  const onSetReminder = async (ts: number) => {
    if (!activeNoteId) return;
    await noteSvc.current.updateNote(activeNoteId, { reminderAt: ts });
    cr?.runtime?.sendMessage({ type: 'SET_REMINDER', noteId: activeNoteId, reminderAt: ts });
    const notes = await noteSvc.current.getNotesByScope(
      scopeRef.current,
      currentUrlRef.current,
      wsIdRef.current
    );
    setContextNotes(notes);
    await refreshAllNotes();
  };

  const onClearReminder = async () => {
    if (!activeNoteId) return;
    await noteSvc.current.updateNote(activeNoteId, { reminderAt: undefined });
    cr?.runtime?.sendMessage({ type: 'CLEAR_REMINDER', noteId: activeNoteId });
    const notes = await noteSvc.current.getNotesByScope(
      scopeRef.current,
      currentUrlRef.current,
      wsIdRef.current
    );
    setContextNotes(notes);
    await refreshAllNotes();
  };

  return {
    editWsName,
    setEditWsName,
    editWsColor,
    setEditWsColor,
    newWsNameInput,
    setNewWsNameInput,
    newWsColorInput,
    setNewWsColorInput,
    wsDropdown,
    setWsDropdown,
    wsDropdownRef,
    onSetActiveWorkspace,
    onSwitchWorkspace,
    onUpdateWorkspace,
    onDeleteWorkspace,
    onCreateWorkspace,
    onSetReminder,
    onClearReminder,
  };
}
