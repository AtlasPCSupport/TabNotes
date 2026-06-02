import { useEffect } from 'react';

interface UseKeyboardShortcutsProps {
  content: string;
  title: string;
  tags: string;
  focusMode: boolean;
  setFocusMode: React.Dispatch<React.SetStateAction<boolean>>;
  setTypewriterMode: React.Dispatch<React.SetStateAction<boolean>>;
  saveNote: (c: string, t: string, tg: string) => Promise<void>;
  insertDatetime: () => void;
  saveTimer: React.MutableRefObject<ReturnType<typeof setTimeout> | undefined>;
}

export function useKeyboardShortcuts({
  content,
  title,
  tags,
  focusMode,
  setFocusMode,
  setTypewriterMode,
  saveNote,
  insertDatetime,
  saveTimer,
}: UseKeyboardShortcutsProps) {
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const ctrl = isMac ? e.metaKey : e.ctrlKey;
      if (!ctrl) return;

      if (e.key === 's') {
        e.preventDefault();
        clearTimeout(saveTimer.current);
        saveNote(content, title, tags);
      } else if (e.key === 'd') {
        e.preventDefault();
        insertDatetime();
      } else if (e.key === 'f' && e.shiftKey) {
        e.preventDefault();
        setFocusMode((p) => !p);
      } else if (e.key === 't' && e.shiftKey) {
        e.preventDefault();
        setTypewriterMode((p) => !p);
      } else if (e.key === 'Escape' && focusMode) {
        setFocusMode(false);
      }
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, title, tags, focusMode, setFocusMode, setTypewriterMode, saveNote, insertDatetime]);
}
