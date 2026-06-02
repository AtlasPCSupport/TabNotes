import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import es from './locales/es.json';

export const SUPPORTED_LANGUAGES = ['en', 'es'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'en';

export const resources = {
  en: { translation: en },
  es: { translation: es },
} as const;

/** Call ONCE per app entry point, passing the persisted/detected language. */
export function initI18n(lng: Language = DEFAULT_LANGUAGE) {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      resources,
      lng,
      fallbackLng: DEFAULT_LANGUAGE,
      interpolation: { escapeValue: false }, // React already escapes values
      returnNull: false,
    });
  }
  return i18n;
}

/** Resolve a raw locale string (e.g. "es-MX") to a supported language. */
export function resolveLanguage(raw?: string | null): Language {
  const base = (raw ?? '').toLowerCase().split('-')[0];
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(base)
    ? (base as Language)
    : DEFAULT_LANGUAGE;
}

export default i18n;
