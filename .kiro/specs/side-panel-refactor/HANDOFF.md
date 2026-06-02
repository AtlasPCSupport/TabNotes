# Side Panel Refactor — Handoff Playbook

**For the next AI/developer continuing this refactor.** Read this fully before touching code.

## 0. TL;DR of where we are

- Goal: decompose `apps/extension/src/sidepanel/SidePanelApp.tsx` (was 5,232 lines) into small
  components + a Zustand store, with **zero behavior/visual change**. Target: no component file
  > 1,000 lines (Requirement R1.4).
- **Current size of `SidePanelApp.tsx`: ~3,920 lines** (down from 5,232).
- Everything is green: `pnpm lint` (`--max-warnings 0`), `pnpm typecheck`, `pnpm test`
  (79 unit tests), `pnpm build`, and `pnpm --filter @tabnotes/extension e2e` (8 passing, 2
  documented `test.fixme`).
- Spec docs: `requirements.md`, `design.md`, `tasks.md` in this folder. `tasks.md` has the
  authoritative checkbox status.

## 1. The golden rules (do not break these)

1. **Behavior must stay identical.** This is a pure refactor. No feature, visual, or timing
   change. If you change behavior, you've done it wrong.
2. **Verify after EVERY extraction, in this order:**
   ```bash
   pnpm --filter @tabnotes/extension typecheck
   pnpm lint
   pnpm --filter @tabnotes/extension build
   pnpm --filter @tabnotes/extension e2e
   ```
   Do not move to the next extraction until all four are green. (typecheck+lint catch most
   issues in seconds; run e2e at least once per component.)
3. **One component per step.** Extract a single block, verify, then continue. Never batch
   multiple extractions before verifying — JSX-balance bugs are easy to introduce and hard to
   locate in bulk.
4. **Do NOT change the autosave / cross-tab-sync timing.** The refs `saveTimer`,
   `contentSavedRef`, `lastSaveTs`, `activeNoteIdRef`, `scopeRef`, `currentUrlRef`, `wsIdRef`,
   `activeFolderRef` and the 600ms autosave debounce / 1.2s self-write-skip / 250ms refresh
   debounce are correct as-is. Task 6.3 (rewriting these to `getState()`) is **intentionally
   deferred** — leave it alone unless explicitly asked. See `tasks.md` task 6.3.
5. **Persistence stays in the monolith.** Components are presentational. When a block calls
   `noteSvc.current.*`, `wsSvc.current.*`, `cr?.storage?.local`, `localStorage`, or a wrapper
   like `setTheme`/`setMarkdown`/`saveDigest`, pass those as **callback props** (e.g.
   `onCreate`, `onToggleTheme`) rather than moving the logic. This keeps timing/storage identical.

## 2. The extraction pattern (proven 13× already)

Every component so far follows this recipe. Copy it.

1. **Read the exact inline block** in `SidePanelApp.tsx` with `read_files` (get the full block,
   open tag to close tag).
2. **Create the component file** under the right folder (see §3). The component:
   - Reads **shared state** from the store directly:
     `const x = useSidePanelStore((s) => s.x);`
   - Receives **local state it doesn't own** and **handlers/persistence** as props.
   - Keeps JSX **byte-identical** (same classNames, same inline styles, same text).
3. **Replace the inline block** in `SidePanelApp.tsx` with `<NewComponent ... />`, wiring props
   to the existing monolith state/handlers. Callbacks wrap the existing inline logic verbatim.
4. **Add the import** near the other component imports (around line 30–40).
5. **Verify** (the 4 commands above). Fix lint warnings:
   - Unused imports after a block leaves → remove them.
   - `react-hooks/exhaustive-deps` for store setters → they're **stable**, add them to the dep
     array (don't suppress). For mount-only effects use
     `// eslint-disable-next-line react-hooks/exhaustive-deps` (matches existing convention).
6. **Watch for orphaned `<div>`s.** The #1 bug this refactor hit twice: when your `oldStr`
   starts *inside* a wrapper `<div className="sp-settings-section">`, removing the inner content
   leaves a dangling open/close div. Always include the wrapper div in both oldStr and newStr, or
   verify the surrounding divs balance. typecheck catches it as `JSX element 'div' has no
   corresponding closing tag` — read the reported line and remove the orphan.

## 3. Folder conventions (already established)

```
apps/extension/src/sidepanel/
  SidePanelApp.tsx          # the shrinking root (still ~3,920 lines)
  icons.ts                  # ICONS map (import from here, do not re-declare)
  store/                    # Zustand store
    index.ts                # useSidePanelStore (slices spread here)
    types.ts                # View, Features, slice interfaces, Updater<T>, SidePanelState
    runtime.ts              # NON-REACTIVE refs: saveTimer, contentSaved, lastSaveTs, editorEl
    contextSlice.ts         # view, scope, url/domain, workspaces, activeWorkspaceId, defaultScope
    settingsSlice.ts        # theme, markdownEnabled, features, fontSize, defaultAlign
    noteListSlice.ts        # allNotes, contextNotes, noteColors, pinnedNotes, folderColors, expandedFolders
    editorSlice.ts          # activeNoteId, content, title, tags, saved, preview
    README.md               # store rules (read it)
  components/
    HeaderBar.tsx ScopeBar.tsx BottomNav.tsx
    settings/               # 9 Settings sub-components (DONE)
  editor/
    NoteGraph.tsx
  views/
    GraphView.tsx AboutView.tsx ChatView.tsx AllNotesView.tsx
```

- Store setters that need functional-updater support use the `Updater<T>` type +
  `resolve(prev, next)` helper (see `settingsSlice.ts`/`noteListSlice.ts`). Reuse that pattern.
- Shared pure logic lives in `@tabnotes/shared` (text.ts, wikilinks.ts, checklist.ts, markdown.ts,
  sanitize.ts, crypto.ts). Prefer importing from there over re-implementing.

## 4. PENDING WORK (in recommended order)

### TASK A — Extract `NotePills` (the context note picker)  [SMALL, do first]
- **Where:** `SidePanelApp.tsx`, the `{view === 'note' && (<div className="sp-context-strip">…)}`
  block (currently ~line 2400) AND the note-picker pills block that follows it (`sp-note-picker`
  / `sp-note-pills` — search for `className="sp-note-pill`). They render the per-context note
  tabs + the context strip ("N notes" + "Saved" badge).
- **Reads from store:** `contextNotes`, `activeNoteId`, `saved`.
- **Props (callbacks wrapping monolith logic):** `scopeKey` (string), `tabLoading` (bool),
  `onSelectNote(n)` → wrap existing `selectNote`, `onAddNote()` → wrap `addNoteToContext`,
  `onDeletePill(id)` → wrap the existing pill delete + confirm state
  (`deletePillConfirmId`/`setDeletePillConfirmId`), plus `pillLabel` (module fn in monolith — move
  it to the component or to `@tabnotes/shared`).
- **Gotcha:** the pills have a confirm-to-delete state and horizontal scroll arrows. Keep both.

### TASK B — Extract `NoteTree` (folder rail + drag & drop)  [MEDIUM]
- **Where:** the `<div className="sp-main-layout">` → `{!isRestrictedUrl && (<div
  className="sp-notes-tree" …>)}` block (opens ~line 2429, closes before
  `{/* Main content */}` `<div className="sp-content">` ~line 2708). ~270 lines.
- **Reads from store:** `contextNotes`, `activeNoteId`, `folderColors`, `noteColors`,
  `pinnedNotes`, `expandedFolders`.
- **Props/callbacks (all exist in monolith — pass them):** `isDragging`, `dragOverFolder`,
  `activeFolder`/`setActiveFolder`, `showNewFolder`/`setShowNewFolder`, `newFolderName`/
  `setNewFolderName`, `newFolderRef`, `folderMenuId`/`setFolderMenuId`, `folderMenuRef`,
  `settingsFolder`/`setSettingsFolder`, `renameFolderVal`/`setRenameFolderVal`,
  `folderColorVal`/`setFolderColorVal`, `showMovePicker`/`setShowMovePicker`,
  and handlers: `createFolder` (line ~1828), `renameFolder` (~1851), `deleteFolder` (~1907),
  `moveNoteToFolder` (~1986), `handleDragOver` (~1962), `handleDrop` (~1974),
  `toggleFolderExpanded`, `selectNote`, `togglePin`, `setNoteColor`, plus `draggedNoteIdRef`.
- **Gotchas:**
  - This is the hover-to-expand rail (32px → 200px). Pure CSS; don't touch it.
  - HTML5 drag-and-drop: keep `draggable`, `onDragStart`, `onDragOver`, `onDragLeave`, `onDrop`
    exactly. The folder-creation confirm button CSS fix (`min-width:0` on `.sp-tree-input`,
    `flex-shrink:0` on `.sp-tree-confirm-btn`) is already in `sidepanel.css` — leave it.
  - Big prop surface (~25). That's acceptable here because it's a cohesive concern. If it feels
    unwieldy, group folder-menu state into one `folderMenu` object prop.

### TASK C — Extract `EditorView`  [LARGE, HIGHEST RISK — do last before the shell]
- **Where:** `{view === 'note' && (<div className="sp-note-view">…)}` (opens ~line 2711). This is
  the contentEditable editor + formatting toolbar + checklist mode + markdown preview + the
  restricted-URL empty state + the reference panel. ~900 lines. Also the `{view === 'note' &&
  showRefPanel && …}` reference-panel block.
- **This is the crown jewel.** Isolating it cleanly is the whole point — it makes the FUTURE
  `execCommand`→Tiptap/Lexical migration a contained swap.
- **MUST preserve exactly:**
  - `sanitizeHtml(content)` on load into `editorRef` (the `useEffect` that sets `el.innerHTML`).
  - The sanitizing `onPaste` handler.
  - `document.execCommand` formatting (do NOT replace it here — separate future spec).
  - `renderMarkdown(content)` as the ONLY HTML sink for preview (`dangerouslySetInnerHTML`).
  - checklist (Keep-style) mode, typewriter mode, wiki-link autocomplete, encryption lock/unlock
    (`encryptText`/`decryptText`), version history, reminders, templates, focus mode, font size,
    alignment, the formatting toolbar + color picker.
- **Approach:** Because of the size, extract in SUB-PIECES, verifying each:
  1. `FormattingToolbar` (the B/I/U/color/align/template buttons row) → props: the `applyFormat`,
     `applyColor`, `insertDatetime`, template handlers, `fmtActive`, `showColorPicker`, etc.
  2. `ChecklistEditor` (the Keep-style interactive list) → props: `checklistItems`,
     `handleItemCheckChange`, `saveChecklist`, drag handlers, `showCompletedList`.
  3. `WikiAutocomplete` (the `[[` suggest dropdown) → reads `allNotes`, `wikiQuery`.
  4. `ReferencePanel` (dual-view) → props: `refNoteId`, `showRefPanel`.
  5. Finally the `EditorView` shell that composes them + the contentEditable div.
- **`editorRef`:** keep it as a ref created in the monolith (or move to `runtime.editorEl` via a
  ref callback `ref={(el) => (runtime.editorEl = el)}`). The autosave + sync read it; do not break
  that wiring.
- **Verify with the autosave e2e** (`editor autosaves typed content to storage`) after EACH
  sub-piece — it's your safety net for this task specifically.

### TASK D — Reduce `SidePanelApp.tsx` to a thin shell  [Requirement R1.4 — the finish line]
- After A–C, the root should mostly be: state/effects + `<HeaderBar/> <ScopeBar/> <NotePills/>
  <NoteTree/> <ViewHost/> <BottomNav/> <CommandPalette/>`.
- **Optional but recommended:** introduce `ViewHost` (Task 3.4) — a component that maps `view` →
  the right view component, each wrapped in its own `@tabnotes/ui` `ErrorBoundary` for crash
  isolation. The command-palette overlay (`{showCmdPalette && …}`, ~line 5100+ originally) and
  the encryption-prompt modal can also be extracted here.
- **Done when:** `(Get-Content apps/extension/src/sidepanel/SidePanelApp.tsx | Measure-Object
  -Line).Lines` is **< 1000** and all 4 gates are green. Update `tasks.md` 6.4.

### TASK E — CSS co-location (Task 7.1)  [MECHANICAL, LOWEST PRIORITY]
- Split `sidepanel.css` (~4,300 lines) into per-component files under `sidepanel/styles/` (or
  co-located next to each component), moving rules **verbatim** (no selector/value changes).
- Keep the `:root` / `[data-theme='dark']` token block + the `--color-*` aliases +
  `:focus-visible` + `prefers-reduced-motion` in ONE base file imported first (cascade order
  matters).
- This is purely organizational; visuals must be pixel-identical. Skip if time-constrained.

## 5. Command palette note (don't waste time here)
The command palette (`Ctrl+K`) overlay is still inline in the monolith. It can be extracted like
the others (reads `showCmdPalette`/`cmdQuery`/`cmdSelIdx`; the command list is built from a
`paletteItems` array). **Do not** add an e2e test for it in the multi-page "real tab" context —
OS keyboard focus across Playwright pages is flaky there; the single-page baseline palette test
already covers it. (We learned this the hard way.)

## 6. e2e harness facts you need
- `apps/extension/e2e/fixtures.ts` exposes `test`, `expect`, and `openPanelWithRealTab(context,
  sidePanelUrl)`. Use the latter for any test that needs the **editor** to render (the panel must
  have a real active web-page tab, else it shows the restricted-URL placeholder).
- Run: `pnpm --filter @tabnotes/extension e2e` (builds dist first, then Playwright).
- 2 scenarios are intentionally `test.fixme`: folder drag-drop (headless DnD unreliable) and
  in-editor encryption UI (covered by `crypto.test.ts`). Leave them as fixme.
- One-time: `pnpm --filter @tabnotes/extension exec playwright install chromium`.

## 7. Cleanup habits
- After runs, delete `apps/extension/test-results/` and any stray `.vscode/settings.json` (the IDE
  regenerates an empty one; it's gitignored-worthy noise, not yours).
- Keep `pnpm-lock.yaml` in sync; CI uses `--frozen-lockfile`.
- Update `tasks.md` checkboxes as you complete each task. Use `[x]` done, `[~]` partial, `[-]`
  intentionally deferred (with a one-line reason).

## 8. What is DONE (do not redo)
State store (4 slices) · NoteGraph · ICONS · BottomNav · ScopeBar · HeaderBar (incl. workspace
switcher) · GraphView · AboutView · ChatView · AllNotesView · all 9 Settings sub-components
(FeatureToggles, AiSettings, PinSettings, EditorSettings, ScopeDigestSettings, WorkspaceSettings,
StatsSettings, DataSettings, SupportSettings) · shared pure logic (text/wikilinks/checklist) ·
PIN-lock feature · Playwright harness (8 passing). All green.
