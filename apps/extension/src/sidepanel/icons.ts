/**
 * Monochrome glyphs used across the side panel chrome and views.
 * Extracted from the monolith so all components share one source.
 */
export const ICONS = {
  url: '⌁',
  domain: '◎',
  workspace: '▦',
  global: '◌',
  note: '✎',
  list: '☷',
  graph: '◇',
  settings: '◷',
  folder: '▱',
  trash: '⌫',
  pin: '⌖',
  calendar: '◫',
  palette: '◐',
  print: '▣',
  camera: '▢',
  typewriter: '⌁',
  lock: '◼',
  unlock: '◻',
  history: '◴',
  key: '⌑',
  chat: '◍',
  light: '☼',
  dark: '◒',
  markdown: '◈',
  focus: '□',
  flame: '△',
  doc: '▤',
  check: '✓',
  spark: '✦',
  shield: '⬠',
} as const;

export type IconKey = keyof typeof ICONS;
