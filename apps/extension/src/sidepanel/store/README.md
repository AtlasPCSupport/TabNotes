# Side panel store

A single Zustand store, composed from per-concern slice creators, that holds the side panel's
shared UI and domain state. It replaces the flat `useState`/`useRef` surface of the original
`SidePanelApp.tsx` monolith.

## Layout

- `index.ts` — `create()`s the store by spreading all slice creators; exports `useSidePanelStore`.
- `types.ts` — `View`, each slice interface, and the composed `SidePanelState` intersection.
- `runtime.ts` — **non-reactive** registry for timers, timestamps, and the editor DOM node.
- `*Slice.ts` — one slice creator per concern (context, editor, noteList, commandPalette,
  settings, checklist). Added incrementally as the monolith is decomposed.

## Two hard rules

1. **Use `getState()` in long-lived callbacks.** Inside `chrome.storage.onChanged`, timers, and
   other listeners that outlive a render, read live state with `useSidePanelStore.getState()`
   (or `get()` inside a slice). Do **not** rely on destructured/captured state — it goes stale.
   This is exactly why the monolith needed mirror-refs (`activeNoteIdRef`, `scopeRef`, …); with
   the store, `getState()` returns the current value and those refs disappear.

2. **Timers, timestamps, and DOM nodes go in `runtime`, not the store.** `saveTimer`,
   `contentSaved`, `lastSaveTs`, and `editorEl` are not UI state. Keeping them reactive would
   cause needless re-renders and could shift autosave/sync timing. They live in `runtime.ts` and
   are read/written directly.

## Slices

Subscribe with narrow selectors:

```ts
const view = useSidePanelStore((s) => s.view);
const setView = useSidePanelStore((s) => s.setView);
```

Cross-slice access goes through `get()` and the owning slice's actions — never reach into another
slice's fields directly.
