import type { NoteScope } from '@tabnotes/shared';
import type { TranslationKey } from '@tabnotes/i18n';
import type { AppIconName } from './components/AppIcon';
import type { Template } from './components/NoteTree';

export const SCOPE_OPTIONS: { value: NoteScope; label: string; icon: AppIconName; desc: string }[] = [
  { value: 'url', label: 'URL', icon: 'url', desc: 'Exact page URL' },
  { value: 'domain', label: 'Domain', icon: 'domain', desc: 'Entire site' },
  { value: 'workspace', label: 'Projects', icon: 'workspace', desc: 'Your project' },
  { value: 'global', label: 'Global', icon: 'global', desc: 'Everywhere' },
];

export const templateFieldKey = (id: Template['id'], field: 'title' | 'content'): TranslationKey =>
  `templates.${id}.${field}` as TranslationKey;

export const templateDateLocale = (language?: string): string =>
  language?.toLowerCase().startsWith('es') ? 'es-ES' : 'en-US';
