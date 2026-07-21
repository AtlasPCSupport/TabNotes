import { describe, it, expect } from 'vitest';
import {
  isChecklistContent,
  parseChecklistItems,
  serializeChecklist,
  checklistItemsToPlainText,
  editorHtmlToPlainText,
  type ChecklistItem,
} from './checklist';

const seqId = (i: number) => `id-${i}`;

describe('isChecklistContent', () => {
  it('detects checklist content', () => {
    expect(isChecklistContent('- [ ] todo')).toBe(true);
    expect(isChecklistContent('- [x] done')).toBe(true);
    expect(isChecklistContent('  - [X] done with space')).toBe(true);
  });
  it('rejects non-checklist content', () => {
    expect(isChecklistContent('# heading')).toBe(false);
    expect(isChecklistContent('plain text')).toBe(false);
  });
  it('detects a task after leading editor whitespace', () => {
    expect(isChecklistContent('\n  - [ ] todo')).toBe(true);
  });
  it('rejects malformed task-like prefixes', () => {
    expect(isChecklistContent('- [ ]not a task')).toBe(false);
    expect(isChecklistContent('- [x]done')).toBe(false);
  });
});

describe('editorHtmlToPlainText', () => {
  it('preserves editor block boundaries and decodes common entities', () => {
    expect(editorHtmlToPlainText('<div>first</div><p>second&nbsp;&amp; third</p><ul><li>fourth</li></ul>'))
      .toBe('first\nsecond & third\nfourth\n');
  });
});

describe('parseChecklistItems', () => {
  it('parses checked and unchecked tasks', () => {
    const items = parseChecklistItems('- [ ] a\n- [x] b', seqId);
    expect(items).toEqual([
      { id: 'id-0', checked: false, text: 'a' },
      { id: 'id-1', checked: true, text: 'b' },
    ]);
  });
  it('handles uppercase X', () => {
    expect(parseChecklistItems('- [X] up', seqId)[0]).toEqual({ id: 'id-0', checked: true, text: 'up' });
  });
  it('treats plain bullets as unchecked', () => {
    expect(parseChecklistItems('- plain', seqId)[0]).toEqual({ id: 'id-0', checked: false, text: 'plain' });
  });
  it('drops blank lines', () => {
    expect(parseChecklistItems('- [ ] a\n\n  \n- [ ] b', seqId)).toHaveLength(2);
  });
  it('generates unique ids by default', () => {
    const ids = parseChecklistItems('- [ ] a\n- [ ] b\n- [ ] c').map((i) => i.id);
    expect(new Set(ids).size).toBe(3);
  });
});

describe('checklistItemsToPlainText', () => {
  it('removes checklist markers while preserving item order', () => {
    const items: ChecklistItem[] = [
      { id: '1', checked: false, text: 'one' },
      { id: '2', checked: true, text: 'two' },
    ];
    expect(checklistItemsToPlainText(items)).toBe('one\ntwo');
  });
});

describe('serializeChecklist', () => {

  it('serializes items back to markdown task lines', () => {
    const items: ChecklistItem[] = [
      { id: '1', checked: false, text: 'a' },
      { id: '2', checked: true, text: 'b' },
    ];
    expect(serializeChecklist(items)).toBe('- [ ] a\n- [x] b');
  });
  it('round-trips through parse', () => {
    const md = '- [ ] one\n- [x] two';
    expect(serializeChecklist(parseChecklistItems(md, seqId))).toBe(md);
  });
});
