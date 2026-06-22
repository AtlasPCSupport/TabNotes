export interface ActiveInlineFormats {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  code: boolean;
  highlight: boolean;
}

type InlineFormatCommand = 'bold' | 'italic' | 'underline' | 'strike';

const ZERO_WIDTH_SPACE = '\u200B';

const INLINE_TAG_BY_COMMAND: Record<InlineFormatCommand, keyof HTMLElementTagNameMap> = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
  strike: 's',
};

const ACTIVE_SELECTOR_BY_COMMAND: Record<InlineFormatCommand, string> = {
  bold: 'strong,b',
  italic: 'em,i',
  underline: 'u',
  strike: 's,strike',
};

function elementFromNode(node: Node | null): Element | null {
  if (!node) return null;
  return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
}

function nodeIsInside(root: HTMLElement, node: Node | null): boolean {
  const element = elementFromNode(node);
  return Boolean(element && (element === root || root.contains(element)));
}

function placeCaretAfter(node: Node): void {
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function ensureRange(root: HTMLElement): Range | null {
  root.focus();

  const selection = window.getSelection();
  if (!selection) return null;

  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    if (nodeIsInside(root, range.commonAncestorContainer)) return range;
  }

  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  return range;
}

function insertNodeAtRange(range: Range, node: Node): void {
  range.deleteContents();
  range.insertNode(node);
  placeCaretAfter(node);
}

function insertFragmentAtRange(range: Range, fragment: DocumentFragment): void {
  const nodes = Array.from(fragment.childNodes);
  if (nodes.length === 0) return;

  range.deleteContents();
  range.insertNode(fragment);
  placeCaretAfter(nodes[nodes.length - 1]);
}

function wrapRange(range: Range, element: HTMLElement): void {
  const content = range.extractContents();
  if (content.childNodes.length === 0) {
    content.appendChild(document.createTextNode(ZERO_WIDTH_SPACE));
  }
  element.appendChild(content);
  insertNodeAtRange(range, element);

  const selection = window.getSelection();
  if (!selection) return;
  const nextRange = document.createRange();
  nextRange.selectNodeContents(element);
  nextRange.collapse(false);
  selection.removeAllRanges();
  selection.addRange(nextRange);
}

function unwrapElement(element: Element): void {
  const parent = element.parentNode;
  if (!parent) return;

  const children = Array.from(element.childNodes);
  for (const child of children) parent.insertBefore(child, element);
  parent.removeChild(element);
  parent.normalize();

  if (children.length > 0) placeCaretAfter(children[children.length - 1]);
}

function closestInside(root: HTMLElement, node: Node | null, selector: string): Element | null {
  const element = elementFromNode(node);
  const closest = element?.closest(selector) ?? null;
  return closest && root.contains(closest) ? closest : null;
}

export function getActiveInlineFormats(root: HTMLElement): ActiveInlineFormats {
  const selection = window.getSelection();
  const anchor = selection?.anchorNode ?? null;
  if (!anchor || !nodeIsInside(root, anchor)) {
    return {
      bold: false,
      italic: false,
      underline: false,
      strike: false,
      code: false,
      highlight: false,
    };
  }

  return {
    bold: Boolean(closestInside(root, anchor, ACTIVE_SELECTOR_BY_COMMAND.bold)),
    italic: Boolean(closestInside(root, anchor, ACTIVE_SELECTOR_BY_COMMAND.italic)),
    underline: Boolean(closestInside(root, anchor, ACTIVE_SELECTOR_BY_COMMAND.underline)),
    strike: Boolean(closestInside(root, anchor, ACTIVE_SELECTOR_BY_COMMAND.strike)),
    code: Boolean(closestInside(root, anchor, 'code')),
    highlight: Boolean(closestInside(root, anchor, '.tn-highlight')),
  };
}

export function insertTextAtSelection(root: HTMLElement, text: string): void {
  const range = ensureRange(root);
  if (!range) return;
  insertNodeAtRange(range, document.createTextNode(text));
}

export function insertHtmlAtSelection(root: HTMLElement, html: string): void {
  const range = ensureRange(root);
  if (!range) return;

  const template = document.createElement('template');
  template.innerHTML = html;
  insertFragmentAtRange(range, template.content);
}

export function applyInlineColor(root: HTMLElement, color: string, mode: 'text' | 'highlight'): void {
  const range = ensureRange(root);
  if (!range) return;

  const span = document.createElement('span');
  if (mode === 'text') {
    span.style.color = color;
  } else {
    span.style.backgroundColor = color;
  }
  wrapRange(range, span);
}

export function toggleInlineFormat(root: HTMLElement, command: InlineFormatCommand | 'code' | 'highlight'): void {
  const range = ensureRange(root);
  if (!range) return;

  const anchor = range.commonAncestorContainer;

  if (command === 'code') {
    const existing = closestInside(root, anchor, 'code');
    if (existing) {
      unwrapElement(existing);
      return;
    }
    wrapRange(range, document.createElement('code'));
    return;
  }

  if (command === 'highlight') {
    const existing = closestInside(root, anchor, '.tn-highlight');
    if (existing) {
      unwrapElement(existing);
      return;
    }
    const span = document.createElement('span');
    span.className = 'tn-highlight';
    wrapRange(range, span);
    return;
  }

  const existing = closestInside(root, anchor, ACTIVE_SELECTOR_BY_COMMAND[command]);
  if (existing) {
    unwrapElement(existing);
    return;
  }

  wrapRange(range, document.createElement(INLINE_TAG_BY_COMMAND[command]));
}

export function replaceTextOffsets(root: HTMLElement, start: number, end: number, replacement: string): boolean {
  const range = document.createRange();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let startSet = false;
  let endSet = false;

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const textLength = node.textContent?.length ?? 0;
    const nextOffset = offset + textLength;

    if (!startSet && start >= offset && start <= nextOffset) {
      range.setStart(node, start - offset);
      startSet = true;
    }

    if (!endSet && end >= offset && end <= nextOffset) {
      range.setEnd(node, end - offset);
      endSet = true;
      break;
    }

    offset = nextOffset;
  }

  if (!startSet || !endSet) return false;

  const selection = window.getSelection();
  if (!selection) return false;
  selection.removeAllRanges();
  selection.addRange(range);
  insertTextAtSelection(root, replacement);
  return true;
}
