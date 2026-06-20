# TabNotes — Multilingual (i18n) Implementation Guide

A complete, step-by-step plan to make TabNotes bilingual/multilingual in a robust, easily
maintained way. Written for this exact monorepo (`apps/extension`, `apps/web`, `packages/*`).

> **Scope:** This translates the **UI chrome** (buttons, labels, settings, messages, empty
> states) — NOT user note content. Notes stay in whatever language the user wrote them.

---

## 1. Architecture decision (what & why)

| Concern | Tool | Why |
|---|---|---|
| React UI strings (both apps) | **`i18next` + `react-i18next`** | Runtime language switching, pluralization, interpolation, fallback, framework-agnostic so ONE system serves both `apps/extension` and `apps/web`. |
| Translation catalogs | **JSON in a new `packages/i18n`** | Single source of truth shared by both apps; translator-friendly; unit-testable. |
| Chosen language | **Persisted preference** in `StorageData` + `ExportPrefs` | Matches the existing `theme`/`defaultScope` pattern; survives reloads; included in backups. |
| First-run default | **`chrome.i18n.getUILanguage()` / `navigator.language`** | Smart default, user can override. |
| Manifest name/description | **`chrome.i18n` + `_locales/`** | The ONLY way to localize Web Store listing + `chrome://extensions`. |

**Why not `chrome.i18n` for the whole UI?** It's locked to the browser UI language, can't switch
at runtime from inside the app, and is clumsy with React. We reserve it strictly for the manifest.

**Robustness pillars (do not skip these):**
1. `en` is the source of truth AND the fallback language.
2. **Typed keys** generated from `en.json` → missing/renamed keys become *compile errors*.
3. A **CI key-parity test** → every locale has exactly the same keys as `en`.
4. Namespaced keys by feature (`editor.*`, `settings.*`, `noteList.*`, `common.*`).
5. No hardcoded UI strings — the catalog is the only place copy lives.

---

## 2. Versions to install (pin them)

From repo root. (Check latest patch at install time; these majors are correct as of writing.)

```bash
pnpm --filter @tabnotes/i18n add i18next@^23 react-i18next@^14
```

`react`, `react-dom`, `typescript`, `vitest` are already in the workspace.

> The extension and web apps consume `@tabnotes/i18n` as `workspace:*` (see step 4).

---

## 3. Create `packages/i18n`

### 3.1 `packages/i18n/package.json`
```json
{
  "name": "@tabnotes/i18n",
  "version": "1.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext .ts,.tsx",
    "test": "vitest run"
  },
  "dependencies": {
    "i18next": "^23",
    "react-i18next": "^14"
  },
  "devDependencies": {
    "typescript": "^5.4.5",
    "vitest": "2.1.9"
  }
}
```

### 3.2 `packages/i18n/tsconfig.json`
Copy the shape of `packages/shared/tsconfig.json` (same compilerOptions, `"include": ["src"]`,
add `"resolveJsonModule": true` — it's already true there).

### 3.3 Locale catalogs — `packages/i18n/src/locales/en.json`
English is the **source of truth**. Use nested, feature-namespaced keys. Example skeleton:

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "create": "Create",
    "close": "Close",
    "confirmDelete": "Delete?",
    "savedBadge": "Saved"
  },
  "nav": {
    "note": "Note",
    "allNotes": "All Notes",
    "ask": "Ask",
    "settings": "Settings"
  },
  "scope": {
    "url": "URL",
    "domain": "Domain",
    "workspace": "Proyecto",
    "global": "Global",
    "urlDesc": "Exact page URL",
    "domainDesc": "Entire site",
    "workspaceDesc": "Your project",
    "globalDesc": "Everywhere"
  },
  "editor": {
    "placeholder": "Note for this {{scope}}…",
    "titlePlaceholder": "Title…",
    "tagsPlaceholder": "tag1, tag2",
    "readingTime": "~{{minutes}} min",
    "restricted": "TabNotes can't take notes on this page."
  },
  "noteList": {
    "searchPlaceholder": "Search notes, titles, tags…",
    "noResults": "No results",
    "noNotes": "No notes yet",
    "selected": "{{count}} selected",
    "noteCount_one": "{{count}} note",
    "noteCount_other": "{{count}} notes"
  },
  "settings": {
    "activeFeatures": "Active Features",
    "appearance": "Appearance",
    "security": "Security — PIN lock",
    "editor": "Editor",
    "defaultScope": "Default Scope",
    "dailyDigest": "Daily Digest",
    "activeWorkspace": "Active Workspace",
    "data": "Data",
    "stats": "Stats",
    "support": "Support",
    "themeLight": "Light",
    "themeDark": "Dark",
    "themeSystem": "System",
    "language": "Language"
  },
  "pin": {
    "enable": "Enable PIN lock",
    "lockNow": "Lock now",
    "changePin": "Change PIN",
    "removePin": "Remove PIN",
    "enabled": "PIN is enabled",
    "locked": "TabNotes is locked",
    "enterPin": "Enter your PIN to open the side panel.",
    "incorrect": "Incorrect PIN",
    "unlock": "Unlock"
  }
}
```
Then create one file per language, e.g. `es.json` (Spanish), with the **same keys**:

```json
{
  "common": { "save": "Guardar", "cancel": "Cancelar", "delete": "Eliminar", "create": "Crear", "close": "Cerrar", "confirmDelete": "¿Eliminar?", "savedBadge": "Guardado" },
  "nav": { "note": "Nota", "allNotes": "Todas", "ask": "Preguntar", "settings": "Ajustes" }
  // …rest of keys, fully translated…
}
```

> **Pluralization:** i18next uses the `_one` / `_other` suffix convention (see `noteCount` above).
> Use `t('noteList.noteCount', { count: n })` and it picks the right plural form per language.

### 3.4 The i18n instance — `packages/i18n/src/config.ts`
```ts
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

/** Call ONCE per app entry point, passing the persisted/desired language. */
export function initI18n(lng: Language = DEFAULT_LANGUAGE) {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      resources,
      lng,
      fallbackLng: DEFAULT_LANGUAGE,   // never show blanks
      interpolation: { escapeValue: false }, // React already escapes
      returnNull: false,
    });
  }
  return i18n;
}

/** Resolve a raw locale (e.g. "es-MX") to a supported language, falling back to en. */
export function resolveLanguage(raw?: string | null): Language {
  const base = (raw ?? '').toLowerCase().split('-')[0];
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(base)
    ? (base as Language)
    : DEFAULT_LANGUAGE;
}

export default i18n;
```

### 3.5 Typed keys (compile-time safety) — `packages/i18n/src/types.ts`
```ts
import type en from './locales/en.json';

// Recursively flattens nested keys into dotted paths: "settings.appearance", etc.
type PathInto<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends object
    ? PathInto<T[K], `${P}${K}.`>
    : `${P}${K}`;
}[keyof T & string];

export type TranslationKey = PathInto<typeof en>;
```
Then augment react-i18next so `t()` is type-checked — `packages/i18n/src/react-i18next.d.ts`:
```ts
import 'react-i18next';
import type en from './locales/en.json';

declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
  }
}
```
After this, `t('settings.appearance')` autocompletes and `t('settings.typo')` is a **type error**.

### 3.6 Barrel — `packages/i18n/src/index.ts`
```ts
export * from './config';
export * from './types';
export { useTranslation, Trans } from 'react-i18next';
```

---

## 4. Wire the apps to consume `@tabnotes/i18n`

In **`apps/extension/package.json`** and **`apps/web/package.json`**, add to `dependencies`:
```json
"@tabnotes/i18n": "workspace:*"
```
In **`apps/extension/vite.config.ts`** and **`apps/web/vite.config.ts`**, add the alias next to
the existing ones:
```ts
'@tabnotes/i18n': resolve(__dirname, '../../packages/i18n/src/index.ts'),
```
In **`apps/extension/tsconfig.json`** and **`apps/web/tsconfig.json`**, add to `paths`:
```json
"@tabnotes/i18n": ["../../packages/i18n/src/index.ts"]
```
Then run `pnpm install` from the repo root.

---

## 5. Add `language` as a persisted preference

### 5.1 Extend the storage types — `packages/shared/src/types.ts`
Add to `StorageData`:
```ts
  // i18n: persisted UI language (undefined = use detected default)
  language?: 'en' | 'es';
```
Add to `ExportPrefs` (so it's included in backups/restore):
```ts
  language?: 'en' | 'es';
```
> Bump `STORAGE_VERSION` is **not** required — the field is optional and back-compatible. The
> `migrateNote`/`get()` merge with `DEFAULT_STORAGE` already tolerates missing fields.

Add to `DEFAULT_STORAGE` in `packages/shared/src/storage.ts`:
```ts
  language: undefined,
```

### 5.2 Add language to the side-panel store — `apps/extension/src/sidepanel/store/`
In `settingsSlice.ts` (it already owns `theme`, `markdownEnabled`, etc.) add:
```ts
// types.ts → SettingsSlice
language: Language;
setLanguageState: (v: Language) => void;
```
```ts
// settingsSlice.ts
language: DEFAULT_LANGUAGE,
setLanguageState: (v) => set({ language: v }),
```
(Import `Language`, `DEFAULT_LANGUAGE` from `@tabnotes/i18n`.)

The **persist wrapper** lives in `SidePanelApp.tsx` next to `setTheme` (the pattern that writes to
storage). Add:
```ts
const setLanguage = async (lng: Language) => {
  setLanguageState(lng);
  i18n.changeLanguage(lng);          // runtime switch — instant
  await adapter.current.set({ language: lng });
};
```
On initial load (where the panel reads `theme`/`markdownEnabled` from `storageData`), also read
`language` and call `initI18n(resolved)` + `setLanguageState(resolved)`:
```ts
const resolved = resolveLanguage(
  (storageData as { language?: string }).language ?? cr?.i18n?.getUILanguage?.() ?? navigator.language
);
setLanguageState(resolved);
i18n.changeLanguage(resolved);
```

---

## 6. Initialize i18n at every entry point

There are **four** React roots; each must init i18n before first paint. Init synchronously with a
best-effort language, then correct it once storage is read (step 5.2).

- `apps/extension/src/sidepanel/sidepanel.tsx`
- `apps/extension/src/popup/popup.tsx`
- `apps/extension/src/options/options.tsx`
- `apps/web/src/main.tsx`

Pattern (example for `sidepanel.tsx`):
```tsx
import { initI18n, resolveLanguage } from '@tabnotes/i18n';
// best-effort sync default; the app corrects it after reading chrome.storage
initI18n(resolveLanguage(navigator.language));
```
react-i18next does not require a Provider when using the default i18n instance, but wrapping in
`<Suspense fallback={null}>` is recommended if you later switch to lazy-loaded catalogs.

---

## 7. Replace hardcoded strings (the bulk of the work)

Do this **component by component**, ideally as each UI area is extracted by the side-panel refactor.
In each component:

```tsx
import { useTranslation } from '@tabnotes/i18n';

export function BottomNav(/* … */) {
  const { t } = useTranslation();
  // before: <span className="sp-nav-label">Note</span>
  // after:  <span className="sp-nav-label">{t('nav.note')}</span>
}
```

Rules while replacing:
- **Interpolation:** `t('editor.placeholder', { scope })` for `Note for this {{scope}}…`.
- **Pluralization:** `t('noteList.noteCount', { count })` — never build `"s"` suffixes by hand.
- **Scope labels:** the `SCOPE_OPTIONS` array currently hardcodes labels (incl. the Spanish
  `"Proyecto"`). Change it to store `labelKey: 'scope.workspace'` and translate at render:
  `t(opt.labelKey)`. **Keep the internal scope value `'workspace'` unchanged** — only the display
  label is translated. This also fixes the existing mixed-language debt.
- **Do NOT translate:** note content, titles, tags, user-entered workspace/folder names, scope
  *keys* (URLs/domains).
- **Background service worker** (`background/index.ts`) builds notification strings (digest,
  reminders). i18next isn't initialized there by default. Either (a) init a lightweight i18next
  instance in the worker too, or (b) keep those few notification strings in `chrome.i18n`
  `_locales/`. Pick one and document it; (a) keeps everything in one catalog.

---

## 8. Add the in-app Language selector

In the Settings UI (the `Appearance` area, alongside theme — file
`apps/extension/src/sidepanel/components/settings/EditorSettings.tsx` or a new
`LanguageSettings.tsx`):
```tsx
const { t } = useTranslation();
const language = useSidePanelStore((s) => s.language);
// render a segmented control / select:
<select value={language} onChange={(e) => onChangeLanguage(e.target.value as Language)}>
  <option value="en">English</option>
  <option value="es">Español</option>
</select>
```
`onChangeLanguage` → the `setLanguage` wrapper from step 5.2 (persists + `i18n.changeLanguage`).
For the **web app**, mirror this in its settings page using its Zustand store + `localStorage`.

---

## 9. Localize the manifest (Web Store + chrome://extensions)

This is the ONLY place `chrome.i18n` is used.

1. Create `apps/extension/public/_locales/en/messages.json`:
```json
{
  "appName": { "message": "TabNotes" },
  "appDesc": { "message": "Contextual notes per tab, domain, or workspace. Local-first, no account needed." }
}
```
2. Create `apps/extension/public/_locales/es/messages.json` with translated `message` values
   (same keys).
3. In `apps/extension/public/manifest.json`, replace literals with message refs and set default:
```json
{
  "name": "__MSG_appName__",
  "description": "__MSG_appDesc__",
  "default_locale": "en"
}
```
4. The command descriptions (`commands.*.description`) and `action.default_title` can also use
   `__MSG_*__` keys the same way.

> Vite copies `public/` into `dist/`, so `_locales/` ships automatically. Verify it appears in
> `apps/extension/dist/_locales/` after `pnpm build:extension`.

---

## 10. Robustness: tests & CI guards

### 10.1 Key-parity test — `packages/i18n/src/locales.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import en from './locales/en.json';
import es from './locales/es.json';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  );
}

describe('locale key parity', () => {
  const enKeys = keys(en).sort();
  for (const [name, locale] of [['es', es]] as const) {
    it(`${name} has exactly the same keys as en`, () => {
      expect(keys(locale).sort()).toEqual(enKeys);
    });
  }
});
```
This fails CI if any locale is missing a key or has an extra one. Add `packages/i18n` to the
recursive test run (it already runs via `pnpm test` / `pnpm -r test`).

### 10.2 Optional: lint rule against literal JSX text
Add `eslint-plugin-i18next` (or `react/jsx-no-literals`) later to flag untranslated strings. Start
as a warning, not an error, to avoid blocking.

### 10.3 CI
No workflow change needed — `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` already run
and will now cover `packages/i18n`. Confirm the e2e build still loads.

---

## 11. RTL readiness (future-proofing, do now even if not shipping Arabic/Hebrew yet)
- Add a `dir` map in i18n config: `const RTL = new Set(['ar', 'he', 'fa']);`
- When language changes, set `document.documentElement.dir = RTL.has(lng) ? 'rtl' : 'ltr';`
- Audit CSS for hardcoded `left`/`right` that should be `inline-start`/`inline-end` over time.

---

## 12. Recommended sequencing (to minimize churn)
1. Build `packages/i18n` skeleton (steps 2–3) + wire apps (step 4) + add `language` pref (step 5).
2. Init at entry points (step 6). Ship — nothing visible changes yet (all strings still English).
3. Add the Language selector (step 8) and manifest `_locales` (step 9).
4. Migrate strings **per component**, ideally as the side-panel refactor extracts each component
   (so you touch each string once, in its final home — not twice). Start with `SettingsView`
   sub-components and `BottomNav`/`ScopeBar` (already extracted).
5. Add the key-parity test (step 10) as soon as `es.json` exists.
6. Translate `es.json` fully; expand to more languages by copying `en.json` → `xx.json`,
   translating, and adding to `SUPPORTED_LANGUAGES` + `resources`.

## 13. Definition of done
- [ ] `packages/i18n` exists, typed, with `en` + at least `es`.
- [ ] `t()` is type-checked (typo = compile error).
- [ ] Language is a persisted pref, included in export/import, defaults to detected locale.
- [ ] In-app language switch works at runtime in both extension and web app.
- [ ] Manifest name/description localized via `_locales/`.
- [ ] Key-parity Vitest passes; `lint`/`typecheck`/`build`/`e2e` all green.
- [ ] No hardcoded UI strings remain in migrated components (note CONTENT untouched).

## 14. Pitfalls specific to this repo
- **`"Proyecto"` debt:** the workspace scope label is hardcoded Spanish today. The i18n pass is the
  moment to fix it — translate the *label*, keep the internal `'workspace'` value.
- **Don't translate user data.** Notes/titles/tags/workspace names are user content.
- **Background worker** has no React; decide notification-string strategy (step 7).
- **Timing vs refactor:** migrate strings as components are extracted, not before — avoids editing
  the same string in the monolith and again in the extracted file.
- **`escapeValue: false`** is correct for React (it escapes already); do not flip it on or you'll
  double-escape.
