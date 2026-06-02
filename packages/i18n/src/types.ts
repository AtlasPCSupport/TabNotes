import type en from './locales/en.json';

// Recursively flattens nested keys into dotted paths: "settings.appearance", etc.
type PathInto<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends object
    ? PathInto<T[K], `${P}${K}.`>
    : `${P}${K}`;
}[keyof T & string];

export type TranslationKey = PathInto<typeof en>;
