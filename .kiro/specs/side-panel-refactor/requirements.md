# Requirements Document

## Introduction

This feature is a structural refactor of the TabNotes Chrome extension side panel. The
current implementation, `apps/extension/src/sidepanel/SidePanelApp.tsx`, is a single React
component of roughly 5,200 lines containing 80+ `useState` hooks and ~25 `useRef` handles in
one function body, paired with a single `sidepanel.css` file of roughly 4,000 lines. This
monolith is the root cause of low testability, no runtime error isolation, and high regression
risk on every change.

The goal of this feature is internal stability and maintainability with **zero user-visible
behavior or visual regression**. The work decomposes the monolith into cohesive feature
modules, lifts the flat hook surface into a Zustand state store organized into per-concern
slices, and optionally co-locates CSS with the new component boundaries. The refactor must be
delivered incrementally as shippable slices, keep the existing lint, typecheck, test, and build
pipeline green at every step, and preserve every existing side panel behavior exactly.

This is explicitly **not** a feature that adds or changes user-facing functionality. Any
behavior or appearance difference observable by an end user is a defect, not an enhancement.

## Glossary

- **Side_Panel_App**: The React application rendered in the extension side panel, currently
  implemented as `apps/extension/src/sidepanel/SidePanelApp.tsx`.
- **Monolith**: The current single-file `SidePanelApp.tsx` component and its paired
  `sidepanel.css` file, before decomposition.
- **Feature_Module**: A cohesive unit (React component plus any co-located hooks/helpers)
  extracted from the Monolith, scoped to one concern. The candidate set is: Editor, Note List
  (including folders/tree), Command Palette, AI Chat, Settings, Note Graph, Header/Scope Bar,
  and Workspace Switcher.
- **State_Store**: A Zustand store (Zustand 5.x, the version already used by `apps/web`) that
  holds side panel UI and domain state previously held in `useState`/`useRef`, organized into
  Slices.
- **Slice**: A logically grouped section of the State_Store responsible for one concern
  (for example: editor state, note-list state, folders state, command-palette state, chat
  state, settings state).
- **Storage_Layer**: The existing persistence abstraction in `@tabnotes/shared`, comprising the
  `StorageAdapter` interface (`get`, `set`, `update(mutator)`, `clear`), `ChromeStorageAdapter`,
  `NotesService`, and `WorkspacesService`.
- **Storage_Schema**: The `chrome.storage.local` data shape defined by `StorageData` in
  `@tabnotes/shared` (`notes_url`, `notes_domain`, `notes_workspace`, `notes_global`,
  `workspaces`, `activeWorkspaceId`, `defaultScope`, `theme`, `markdownEnabled`, `version`),
  currently at `STORAGE_VERSION = 3`.
- **Shared_Package**: The `@tabnotes/shared` workspace package exporting types, utils, storage,
  sanitize (`sanitizeHtml`/`renderMarkdown`), markdown, and crypto (`encryptText`/`decryptText`).
- **Build_Pipeline**: The repository quality gates run in CI: `pnpm lint` (ESLint with
  `--max-warnings 0`), `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- **Shared_Test_Suite**: The existing Vitest suite in `packages/shared/src/*.test.ts`
  (currently 47 tests) covering sanitize, markdown, crypto, storage, and utils.
- **Browser_Verification**: Playwright-based browser automation that exercises the built,
  unpacked extension to confirm runtime/DOM behavior.
- **Error_Boundary**: The `ErrorBoundary` component exported from `@tabnotes/ui` that wraps app
  roots and isolates render failures.
- **Refactor_Slice**: A single, independently reviewable and shippable increment of this
  refactor (for example, extracting one Feature_Module or migrating one Slice).
- **Behavior_Baseline**: The observable behavior and appearance of the side panel as it exists
  before this refactor begins, used as the reference for regression checks.

## Requirements

### Requirement 1: Decompose the side panel monolith into feature modules

**User Story:** As a TabNotes maintainer, I want the side panel split into cohesive feature
modules, so that I can change one concern without reading or risking the entire 5,200-line file.

#### Acceptance Criteria

1. THE Side_Panel_App SHALL be composed of separate Feature_Modules for the Editor, Note List
   (including folders and tree), Command Palette, AI Chat, Settings, Note Graph, Header/Scope
   Bar, and Workspace Switcher.
2. THE Side_Panel_App SHALL retain a single root component that composes the Feature_Modules and
   mounts at the existing `sidepanel.tsx` entry point.
3. WHERE a Feature_Module is extracted, THE Feature_Module SHALL reside in its own source file
   under `apps/extension/src/sidepanel/`.
4. WHEN the decomposition is complete, THE Side_Panel_App SHALL contain no single component file
   exceeding 1,000 source lines.
5. THE Side_Panel_App SHALL expose every Feature_Module's rendered output through the existing
   side panel views (`note`, `all`, `settings`, `graph`, `chat`, `about`) without adding,
   removing, or renaming any view available to the user.

### Requirement 2: Lift component state into a Zustand store organized by slices

**User Story:** As a TabNotes maintainer, I want side panel state managed in a Zustand store with
clear slices, so that state is shared between modules without prop drilling and is testable in
isolation.

#### Acceptance Criteria

1. THE State_Store SHALL be implemented with Zustand version 5.x, consistent with the version
   already declared by `apps/web`.
2. THE State_Store SHALL organize state into Slices, one per concern, covering at minimum
   editor state, note-list and folder state, command-palette state, AI-chat state, and settings
   state.
3. WHEN a Feature_Module reads or updates shared state, THE Feature_Module SHALL do so through
   the State_Store rather than through component-local `useState` or `useRef` for that shared
   state.
4. THE State_Store SHALL expose typed selectors and actions such that no Slice accesses another
   Slice's internal fields directly through untyped access.
5. WHERE state is local to a single Feature_Module and not shared, THE Feature_Module MAY retain
   component-local `useState` for that state.
6. THE State_Store SHALL preserve the existing autosave coordination currently backed by
   `saveTimer`, `contentSavedRef`, `lastSaveTs`, `activeNoteIdRef`, `scopeRef`, `currentUrlRef`,
   `wsIdRef`, and `activeFolderRef` so that autosave timing and cross-tab dirty-checking behave
   identically to the Behavior_Baseline.

### Requirement 3: Preserve all existing side panel behavior

**User Story:** As a TabNotes user, I want the side panel to work exactly as before the refactor,
so that none of my notes workflows break.

#### Acceptance Criteria

1. WHEN a user edits note content, THE Side_Panel_App SHALL autosave the change with the same
   debounce timing as the Behavior_Baseline.
2. WHEN note data changes in another tab via `chrome.storage.onChanged`, THE Side_Panel_App SHALL
   reflect the updated data in real time without overwriting unsaved local edits, matching the
   Behavior_Baseline.
3. WHEN the extension is opened through the quick-capture flag, THE Side_Panel_App SHALL apply
   the quick-capture handling identically to the Behavior_Baseline.
4. WHEN a user drags a note onto a folder, THE Side_Panel_App SHALL move the note into that folder
   identically to the Behavior_Baseline.
5. WHILE checklist (Keep-style) mode is active, THE Side_Panel_App SHALL render and reorder
   checklist items identically to the Behavior_Baseline.
6. WHILE typewriter mode is active, THE Side_Panel_App SHALL keep the caret line positioned
   identically to the Behavior_Baseline.
7. WHEN a user types a wiki-link trigger, THE Side_Panel_App SHALL present wiki-link autocomplete
   identically to the Behavior_Baseline.
8. WHEN a user locks or unlocks a note with a password, THE Side_Panel_App SHALL encrypt or
   decrypt the note using `encryptText`/`decryptText` from the Shared_Package identically to the
   Behavior_Baseline.
9. WHEN a user opens version history, THE Side_Panel_App SHALL display and restore stored note
   versions identically to the Behavior_Baseline.
10. WHEN a user sets a reminder on a note, THE Side_Panel_App SHALL store and surface the reminder
    identically to the Behavior_Baseline.
11. WHEN a user inserts a template, THE Side_Panel_App SHALL insert the template content
    identically to the Behavior_Baseline.
12. WHEN a user exports or imports data, THE Side_Panel_App SHALL include notes, workspaces, and
    preferences (`ExportPrefs`) identically to the Behavior_Baseline.
13. WHILE focus mode is active, THE Side_Panel_App SHALL hide the same chrome and show the same
    editor surface as the Behavior_Baseline.
14. THE Side_Panel_App SHALL render note content through `renderMarkdown`/`sanitizeHtml` from the
    Shared_Package as the only HTML sink, preserving the existing sanitization guarantees.
15. WHEN a user opens the command palette, THE Side_Panel_App SHALL list and execute the same
    commands as the Behavior_Baseline.

### Requirement 4: No visual regression and preserved theme

**User Story:** As a TabNotes user, I want the side panel to look exactly the same after the
refactor, so that the interface I know is unchanged.

#### Acceptance Criteria

1. THE Side_Panel_App SHALL render the existing amethyst dark theme with the same colors,
   spacing, and typography as the Behavior_Baseline.
2. WHERE CSS is reorganized to match component boundaries, THE Side_Panel_App SHALL produce the
   same computed styles for equivalent elements as the Behavior_Baseline, and SHALL preserve
   identical visual output even where the CSS reorganization is left incomplete.
3. THE Side_Panel_App SHALL preserve the existing layout in which the header, formatting toolbar,
   metadata row, and bottom navigation remain fixed while only the note content area scrolls.
4. THE Side_Panel_App SHALL preserve the existing iconography rendered in the scope bar and
   bottom navigation without substituting different glyphs.

### Requirement 5: Preserve the storage layer and data model

**User Story:** As a TabNotes maintainer, I want the refactor to reuse the existing storage layer
unchanged, so that persisted data and cross-tab synchronization keep working.

#### Acceptance Criteria

1. THE Side_Panel_App SHALL perform all persistence through the existing Storage_Layer
   (`StorageAdapter`, `ChromeStorageAdapter`, `NotesService`, `WorkspacesService`).
2. THE Side_Panel_App SHALL NOT alter the Storage_Schema or change `STORAGE_VERSION` from its
   current value of 3.
3. WHEN the Side_Panel_App performs a read-modify-write on stored data, THE Side_Panel_App SHALL
   use the `update(mutator)` primitive so writes remain serialized and atomic as in the
   Behavior_Baseline.
4. THE Side_Panel_App SHALL continue to read and write the `chrome.storage.local` key
   `tabnotes_data` without introducing additional persisted top-level keys.

### Requirement 6: Move pure logic toward the shared package and make it unit-testable

**User Story:** As a TabNotes maintainer, I want extracted pure logic to be unit-testable, so that
behavior is protected by fast automated tests instead of manual inspection.

#### Acceptance Criteria

1. WHERE logic extracted from the Monolith is pure and free of DOM or `chrome` API dependencies,
   THE refactor SHALL place that logic in the Shared_Package when it is reusable beyond the side
   panel.
2. THE refactor SHALL provide unit tests for all logic extracted as standalone functions,
   including title derivation, formatting stripping, reading-time calculation, checklist parsing,
   and wiki-link matching.
3. WHERE pure logic is extracted into the Shared_Package, THE refactor SHALL keep the
   Shared_Test_Suite passing with the suite count not decreasing below its current 47 tests.
4. WHEN pure logic is added to the Shared_Package, THE refactor SHALL run the corresponding tests
   under the existing Vitest configuration.

### Requirement 7: Keep the build pipeline green at every increment

**User Story:** As a TabNotes maintainer, I want every refactor increment to pass all quality
gates, so that the extension is never left in a broken state.

#### Acceptance Criteria

1. WHEN a Refactor_Slice is completed, THE Build_Pipeline SHALL pass `pnpm lint` with
   `--max-warnings 0`.
2. WHEN a Refactor_Slice is completed, THE Build_Pipeline SHALL pass `pnpm typecheck`.
3. WHEN a Refactor_Slice is completed, THE Build_Pipeline SHALL pass `pnpm test`.
4. WHEN a Refactor_Slice is completed, THE Build_Pipeline SHALL pass `pnpm build` and produce a
   loadable unpacked extension in `apps/extension/dist`.
5. IF any Build_Pipeline gate fails after a Refactor_Slice, THEN THE refactor SHALL withhold that
   Refactor_Slice from merge until the failing gate passes.

### Requirement 8: Deliver the refactor as incremental shippable slices

**User Story:** As a TabNotes maintainer, I want the refactor delivered in small slices, so that
each change is reviewable and reversible rather than a risky big-bang rewrite.

#### Acceptance Criteria

1. THE refactor SHALL be divided into Refactor_Slices, each independently reviewable and
   mergeable.
2. WHEN a Refactor_Slice is merged, THE Side_Panel_App SHALL remain fully functional with all
   behaviors from Requirement 3 intact.
3. WHERE a Feature_Module has not yet been extracted, THE Side_Panel_App SHALL continue to use the
   not-yet-extracted code without requiring the full decomposition to be complete.
4. THE refactor SHALL avoid any single Refactor_Slice that replaces the entire Monolith in one
   step.

### Requirement 9: Verify runtime behavior through browser automation

**User Story:** As a TabNotes maintainer, I want runtime side panel behavior verified with browser
automation, so that DOM and interaction regressions are caught beyond what type checks detect.

#### Acceptance Criteria

1. THE Browser_Verification SHALL run Playwright against the built, unpacked extension loaded from
   `apps/extension/dist`.
2. THE Browser_Verification SHALL cover the editor autosave, note content scrolling with fixed
   chrome, folder drag-and-drop, checklist mode, command palette, and encryption lock/unlock
   behaviors.
3. WHEN a Browser_Verification scenario detects a behavior that differs from the Behavior_Baseline,
   THE Browser_Verification SHALL report a failure identifying the affected scenario.
4. WHEN a Refactor_Slice changes a Feature_Module covered by Browser_Verification, THE refactor
   SHALL run the corresponding Browser_Verification scenarios before the Refactor_Slice is merged.

### Requirement 10: Preserve runtime error isolation

**User Story:** As a TabNotes user, I want a failure in one part of the side panel to not blank the
entire panel, so that I can keep using the rest of my notes.

#### Acceptance Criteria

1. THE Side_Panel_App SHALL remain wrapped by the Error_Boundary from `@tabnotes/ui` at its root.
2. IF a Feature_Module throws during render, THEN THE Side_Panel_App SHALL contain the failure
   through an Error_Boundary rather than unmounting the entire side panel.
3. WHERE a Feature_Module renders an independently recoverable surface, THE Side_Panel_App MAY wrap
   that Feature_Module in its own Error_Boundary to localize failures.
