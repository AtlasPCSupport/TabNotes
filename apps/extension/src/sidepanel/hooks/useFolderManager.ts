import React, { useState, useEffect, useRef } from 'react';
import type { Note, NoteScope, ChromeStorageAdapter, NotesService, StorageData } from '@tabnotes/shared';
import { useSidePanelStore } from '../store';

interface UseFolderManagerProps {
  currentUrlRef: React.MutableRefObject<string>;
  scopeRef: React.MutableRefObject<NoteScope>;
  wsIdRef: React.MutableRefObject<string | null>;
  noteSvc: React.MutableRefObject<NotesService>;
  adapter: React.MutableRefObject<ChromeStorageAdapter>;
  selectNote: (n: Note) => void;
  refreshAllNotes: () => Promise<Note[]>;
  setContextNotes: (notes: Note[]) => void;
}

export function useFolderManager({
  currentUrlRef,
  scopeRef,
  wsIdRef,
  noteSvc,
  adapter,
  selectNote,
  refreshAllNotes,
  setContextNotes,
}: UseFolderManagerProps) {
  const [activeFolder, setActiveFolder] = useState<string | null>(null); // null = All
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null);
  const [showMovePicker, setShowMovePicker] = useState(false);
  const newFolderRef = useRef<HTMLInputElement>(null);
  const folderMenuRef = useRef<HTMLDivElement>(null);

  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const draggedNoteIdRef = useRef<string | null>(null);

  const setFolderColors = useSidePanelStore((s) => s.setFolderColors);
  const setExpandedFolders = useSidePanelStore((s) => s.setExpandedFolders);

  // Click outside → close folder menu / move picker
  useEffect(() => {
    if (!folderMenuId && !showMovePicker) return;
    const handle = (e: MouseEvent) => {
      if (!folderMenuRef.current?.contains(e.target as Node)) {
        setFolderMenuId(null);
      }
      const mp = document.querySelector('.sp-move-picker');
      if (mp && !mp.contains(e.target as Node)) setShowMovePicker(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [folderMenuId, showMovePicker]);

  const createFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    const folder = name.startsWith('/') ? name : '/' + name;
    setActiveFolder(folder);
    setShowNewFolder(false);
    setNewFolderName('');
    setExpandedFolders((prev) => ({ ...prev, [folder]: true }));
    // Create a blank note in that folder so it persists
    const url = currentUrlRef.current;
    if (!url || url.startsWith('chrome://')) return;
    const created = await noteSvc.current.createNote({
      scope: scopeRef.current,
      url,
      workspaceId: wsIdRef.current,
      folder,
    });
    const notes = await noteSvc.current.getNotesByScope(scopeRef.current, url, wsIdRef.current);
    setContextNotes(notes);
    selectNote(created);
    await refreshAllNotes();
  };

  const renameFolder = async (oldPath: string, newName: string, newColor?: string) => {
    const newPath = newName.startsWith('/') ? newName : '/' + newName;
    if (oldPath !== newPath) {
      const data = await adapter.current.get();
      const collections = ['notes_url', 'notes_domain', 'notes_workspace', 'notes_global'] as const;
      const updates: Partial<StorageData> = {};
      for (const colKey of collections) {
        const col = data[colKey];
        if (col) {
          const colUpdates: Record<string, Note> = {};
          let changed = false;
          for (const [id, note] of Object.entries(col)) {
            if (note.folder === oldPath) {
              colUpdates[id] = { ...note, folder: newPath, updatedAt: Date.now() };
              changed = true;
            } else {
              colUpdates[id] = note;
            }
          }
          if (changed) {
            updates[colKey] = colUpdates;
          }
        }
      }
      if (Object.keys(updates).length > 0) {
        await adapter.current.set(updates);
      }
      if (activeFolder === oldPath) setActiveFolder(newPath);
    }
    setFolderMenuId(null);

    // Also update folder color keys and value
    setFolderColors((prev) => {
      const updated = { ...prev };
      if (oldPath !== newPath) {
        delete updated[oldPath];
      }
      if (newColor !== undefined) {
        if (newColor) {
          updated[newPath] = newColor;
        } else {
          delete updated[newPath];
        }
      } else if (prev[oldPath]) {
        updated[newPath] = prev[oldPath];
      }
      localStorage.setItem('tn_folder_colors', JSON.stringify(updated));
      return updated;
    });

    const url = currentUrlRef.current;
    const notes = await noteSvc.current.getNotesByScope(scopeRef.current, url, wsIdRef.current);
    setContextNotes(notes);
    await refreshAllNotes();
  };

  const deleteFolder = async (path: string) => {
    const data = await adapter.current.get();
    const collections = ['notes_url', 'notes_domain', 'notes_workspace', 'notes_global'] as const;
    const updates: Partial<StorageData> = {};
    for (const colKey of collections) {
      const col = data[colKey];
      if (col) {
        const colUpdates: Record<string, Note> = {};
        let changed = false;
        for (const [id, note] of Object.entries(col)) {
          if (note.folder === path) {
            colUpdates[id] = { ...note, folder: undefined, updatedAt: Date.now() };
            changed = true;
          } else {
            colUpdates[id] = note;
          }
        }
        if (changed) {
          updates[colKey] = colUpdates;
        }
      }
    }
    if (Object.keys(updates).length > 0) {
      await adapter.current.set(updates);
    }
    if (activeFolder === path) setActiveFolder(null);
    setFolderMenuId(null);

    // Also delete folder color
    setFolderColors((prev) => {
      const updated = { ...prev };
      delete updated[path];
      localStorage.setItem('tn_folder_colors', JSON.stringify(updated));
      return updated;
    });

    const url = currentUrlRef.current;
    const notes = await noteSvc.current.getNotesByScope(scopeRef.current, url, wsIdRef.current);
    setContextNotes(notes);
    await refreshAllNotes();
  };

  const handleDragStart = (e: React.DragEvent, noteId: string) => {
    e.dataTransfer.setData('text/plain', noteId);
    e.dataTransfer.effectAllowed = 'move';
    draggedNoteIdRef.current = noteId;
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDragOverFolder(null);
    draggedNoteIdRef.current = null;
  };

  const handleDragOver = (e: React.DragEvent, folder: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverFolder !== folder) {
      setDragOverFolder(folder);
    }
  };

  const handleDragLeave = () => {
    setDragOverFolder(null);
  };

  const moveNoteToFolder = async (noteId: string, folder: string | undefined) => {
    await noteSvc.current.updateNote(noteId, { folder });
    const url = currentUrlRef.current;
    const notes = await noteSvc.current.getNotesByScope(scopeRef.current, url, wsIdRef.current);
    setContextNotes(notes);
    await refreshAllNotes();
    setShowMovePicker(false);
  };

  const handleDrop = (e: React.DragEvent, folder: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragOverFolder(null);
    const noteId = draggedNoteIdRef.current || e.dataTransfer.getData('text/plain');
    if (noteId) {
      moveNoteToFolder(noteId, folder || undefined);
    }
    draggedNoteIdRef.current = null;
  };

  return {
    activeFolder,
    setActiveFolder,
    showNewFolder,
    setShowNewFolder,
    newFolderName,
    setNewFolderName,
    folderMenuId,
    setFolderMenuId,
    showMovePicker,
    setShowMovePicker,
    newFolderRef,
    folderMenuRef,
    dragOverFolder,
    setDragOverFolder,
    isDragging,
    setIsDragging,
    draggedNoteIdRef,
    createFolder,
    renameFolder,
    deleteFolder,
    moveNoteToFolder,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
