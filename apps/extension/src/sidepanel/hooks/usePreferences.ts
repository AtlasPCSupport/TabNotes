import { useState, useEffect } from 'react';
import { useSidePanelStore } from '../store';
import { type Features } from '../store/types';
import { ChromeStorageAdapter, NoteScope } from '@tabnotes/shared';
import i18n, { type Language } from '@tabnotes/i18n';

interface UsePreferencesProps {
  adapter: React.MutableRefObject<ChromeStorageAdapter>;
  title: string;
  content: string;
}

export function usePreferences({ adapter, title, content }: UsePreferencesProps) {
  const theme = useSidePanelStore((s) => s.theme);
  const setThemeState = useSidePanelStore((s) => s.setThemeState);
  const setMdState = useSidePanelStore((s) => s.setMdState);
  const setPreview = useSidePanelStore((s) => s.setPreview);
  const setDefaultScopeState = useSidePanelStore((s) => s.setDefaultScope);
  const fontSize = useSidePanelStore((s) => s.fontSize);
  const setFontSizeState = useSidePanelStore((s) => s.setFontSizeState);
  const setDefaultAlignState = useSidePanelStore((s) => s.setDefaultAlignState);
  const setFeatures = useSidePanelStore((s) => s.setFeatures);
  const pinnedNotes = useSidePanelStore((s) => s.pinnedNotes);
  const setPinnedNotes = useSidePanelStore((s) => s.setPinnedNotes);
  const language = useSidePanelStore((s) => s.language);
  const setLanguageState = useSidePanelStore((s) => s.setLanguageState);

  // ── Theme listener ──
  useEffect(() => {
    const apply = (t: typeof theme) => {
      const resolved =
        t === 'system'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : t;
      document.documentElement.setAttribute('data-theme', resolved);
    };
    apply(theme);
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const h = (e: MediaQueryListEvent) =>
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      mq.addEventListener('change', h);
      return () => mq.removeEventListener('change', h);
    }
  }, [theme]);

  const [copied, setCopied] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [typewriterMode, setTypewriterMode] = useState(false);

  const setTheme = async (t: typeof theme) => {
    setThemeState(t);
    await adapter.current.set({ theme: t as 'light' | 'dark' | 'system' });
  };

  const setMarkdown = async (v: boolean) => {
    setMdState(v);
    setPreview(false);
    await adapter.current.set({ markdownEnabled: v });
  };

  const setDefaultScope = async (s: NoteScope) => {
    setDefaultScopeState(s);
    await adapter.current.set({ defaultScope: s });
  };

  const copyNote = async () => {
    const text = [title, content].filter(Boolean).join('\n\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const togglePin = (noteId: string) => {
    const next = new Set(pinnedNotes);
    next.has(noteId) ? next.delete(noteId) : next.add(noteId);
    setPinnedNotes(next);
    localStorage.setItem('tn_pins', JSON.stringify(Array.from(next)));
  };

  const changeFontSize = (dir: 1 | -1) => {
    const SIZES = [11, 12, 13, 14, 15, 16];
    const idx = SIZES.indexOf(fontSize);
    const next = SIZES[Math.max(0, Math.min(SIZES.length - 1, idx + dir))];
    setFontSizeState(next);
    localStorage.setItem('tn_fontsize', String(next));
  };

  const setDefaultAlign = (a: 'left' | 'center' | 'right') => {
    setDefaultAlignState(a);
    localStorage.setItem('tn_align', a);
  };

  const toggleFeature = (key: keyof Features) => {
    setFeatures((f) => {
      const next = { ...f, [key]: !f[key] };
      localStorage.setItem('tn_features', JSON.stringify(next));
      return next;
    });
  };

  const setLanguage = async (lng: Language) => {
    setLanguageState(lng);
    i18n.changeLanguage(lng);
    await adapter.current.set({ language: lng });
  };

  return {
    copied,
    focusMode,
    setFocusMode,
    typewriterMode,
    setTypewriterMode,
    setTheme,
    setMarkdown,
    setDefaultScope,
    copyNote,
    togglePin,
    changeFontSize,
    setDefaultAlign,
    toggleFeature,
    language,
    setLanguage,
  };
}
