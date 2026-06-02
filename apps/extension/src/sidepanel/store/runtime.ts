/**
 * Non-reactive runtime registry for the side panel.
 *
 * These values are NOT UI state — they are timers, timestamps, the
 * contentEditable DOM node, and stale-closure guards. Putting them in reactive
 * Zustand state would cause needless re-renders and could change autosave/sync
 * timing. They live here as module-scoped mutable fields and are read/written
 * directly (never via React state).
 *
 * See store/README.md for the rationale and the "use get() in long-lived
 * callbacks" rule that lets the former mirror-refs collapse into store reads.
 */
export const runtime: {
  /** Debounce handle for autosave. */
  saveTimer: ReturnType<typeof setTimeout> | undefined;
  /** Last content persisted to storage — used for cross-tab dirty checking. */
  contentSaved: string;
  /** Timestamp of our most recent write — self-write skip window for onChanged. */
  lastSaveTs: number;
  /** The contentEditable editor element (set via React ref callback). */
  editorEl: HTMLDivElement | null;
} = {
  saveTimer: undefined,
  contentSaved: '',
  lastSaveTs: 0,
  editorEl: null,
};
