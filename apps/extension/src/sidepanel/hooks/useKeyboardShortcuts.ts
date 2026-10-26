import { useEffect } from 'react';

interface UseKeyboardShortcutsProps {
  content: string;
  title: string;
  tags: string;
  focusMode: boolean;
  setFocusMode: React.Dispatch<React.SetStateAction<boolean>>;
  saveNote: (c: string, t: string, tg: string) => Promise<void>;
  insertDatetime: () => void;
}

export function useKeyboardShortcuts({
  content,
  title,
  tags,
  focusMode,
  setFocusMode,
  saveNote,
  insertDatetime,
}: UseKeyboardShortcutsProps) {
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const ctrl = e.metaKey || e.ctrlKey;
      if (!ctrl) return;

      if (e.key === 's') {
        e.preventDefault();
        saveNote(content, title, tags);
      } else if (e.key === 'd') {
        e.preventDefault();
        insertDatetime();
      } else if (e.key === 'f' && e.shiftKey) {
        e.preventDefault();
        setFocusMode((p) => !p);
      } else if (e.key === 'Escape' && focusMode) {
        setFocusMode(false);
      }
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [content, title, tags, focusMode, setFocusMode, saveNote, insertDatetime]);
}
