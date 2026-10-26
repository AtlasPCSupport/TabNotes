# Changelog

All notable changes to TabNotes will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.12.0] — 2026-08-22

### Added

- Contextual onboarding that can be reopened from Help and Settings.
- Capture Hub actions for new notes, screenshots, visible-area crops, and selected text.
- Optional floating capture button with current-note and new-note destinations.
- Inbox view and content filters for text, images, and checklist notes.

### Changed

- Selection clipping now preserves the active note or creates a separate capture note by choice.
- Documentation and release metadata now describe optional per-site capture permissions accurately.

### Security

- Optional page access is limited to `http` and `https` origins and requested per site only for capture features.

## [2.11.5] — 2026-07-31

### Added

- Web Drive adapter and runtime configuration tests
- Strict TypeScript checks for the extension, web app, shared package, and i18n package
- OAuth guard tests for unpacked development builds

### Changed

- Extracted ephemeral side-panel UI state into a dedicated hook
- Clarified that Google Drive sync is not end-to-end encrypted by default
- Prevented unpacked clones from attempting the published extension's OAuth client

## [2.11.4] — 2026-06-02

### Added

- Bilingual support (English / Spanish) with `@tabnotes/i18n` shared package
- Country flag language selector in the header bar (🇺🇸 / 🇪🇸)
- Language preference persisted in `chrome.storage.local` and synced across tabs
- Translation key parity tests (Vitest) to ensure catalogs stay aligned
- `LanguageSettings` component in the Settings panel
- Manifest and background notification localization via `chrome.i18n` and `_locales/`

### Changed

- Side panel refactored into modular components: `HeaderBar`, `BottomNav`, `ScopeBar`, `NoteTree`, `EditorView`, `SettingsView`, etc.
- Zustand store split into feature slices: `editorSlice`, `settingsSlice`, `contextSlice`, `noteListSlice`
- Custom hooks extracted: `usePreferences`, `usePinLock`, `useFolderManager`, `useNoteActions`, `useWorkspaceManager`, `useKeyboardShortcuts`, `useChromeStorageAndTabs`

### Fixed

- Note content leaking across tabs (tab isolation fix in editor state management)

## [2.11.3] — 2026-05-28

### Added

- Playwright E2E test suite for the Chrome extension side panel
- CI workflow (`.github/workflows/ci.yml`) with lint, typecheck, test, build, and E2E stages
- Checklist mode: interactive checkbox items inside notes
- Wiki-link autocomplete (`[[` trigger with fuzzy matching)
- `ErrorBoundary` component in `@tabnotes/ui`

### Changed

- Upgraded to monorepo architecture with `pnpm workspaces`
- Shared packages: `@tabnotes/shared`, `@tabnotes/ui`, `@tabnotes/i18n`

## [2.11.0] — 2026-05-20

### Added

- Google Drive sync via `appDataFolder` with v2 sync envelope
- Tombstone-based deletion propagation (90-day retention)
- Conflict detection and automatic conflict copies across devices
- Offline queue with automatic retry when connectivity is restored
- Daily digest notifications summarizing writing activity
- Backup reminder alarms via `chrome.alarms`
- Note encryption with AES-256-GCM (Web Crypto API)
- PBKDF2 key derivation (100,000 iterations, SHA-256)
- PIN lock gate for the side panel
- Context menu: "Clip selection to TabNotes"
- Workspace system with color-coded workspace pills
- Note graph visualization
- Writing streak tracking
- Offscreen document for reminder audio playback

### Security

- HTML sanitization with DOMPurify (strict allowlist)
- CSS property filtering to block injection vectors
- JSON import validation with 10 MB size limit and schema enforcement
- Chrome permissions scoped to minimum required (`activeTab`, no `<all_urls>`)

## [2.9.0] — 2026-04-15

### Added

- Initial public release on Chrome Web Store
- Contextual notes per URL, domain, and workspace
- Rich text editor with formatting toolbar
- Markdown mode with live preview
- Note search and tag filtering
- Light/dark/system theme support
- JSON export and import
- Companion web app at tabnotes.atlaspcsupport.com

[2.12.0]: https://github.com/AtlasPCSupport/TabNotes/compare/v2.11.5...v2.12.0
[2.11.5]: https://github.com/AtlasPCSupport/TabNotes/compare/v2.11.4...v2.11.5
[2.11.4]: https://github.com/AtlasPCSupport/TabNotes/compare/v2.11.3...v2.11.4
[2.11.3]: https://github.com/AtlasPCSupport/TabNotes/compare/v2.11.0...v2.11.3
[2.11.0]: https://github.com/AtlasPCSupport/TabNotes/compare/v2.9.0...v2.11.0
[2.9.0]: https://github.com/AtlasPCSupport/TabNotes/releases/tag/v2.9.0
