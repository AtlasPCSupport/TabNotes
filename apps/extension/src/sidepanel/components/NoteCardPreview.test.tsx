// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Note } from '@tabnotes/shared';
import { NoteCardPreview } from './NoteCardPreview';

vi.mock('@tabnotes/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('./AppIcon', () => ({ AppIcon: () => null }));

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function preview(content: string, encrypted = false) {
  const note: Note = Object.freeze({
    id: 'preview',
    workspaceId: null,
    scope: 'global',
    scopeKey: '',
    title: 'Preview',
    tags: [],
    content,
    encrypted,
    createdAt: 1,
    updatedAt: 1,
  });
  const before = JSON.stringify(note);
  await act(async () => root.render(<NoteCardPreview note={note} />));
  expect(JSON.stringify(note)).toBe(before);
}

it.each([
  '- [x] **Done**\n- [ ] Pending\n- [X] Third\n- [ ] Fourth',
  '<div>- [x] <b>Done</b></div><div>- [ ] Pending</div><div>- [X] Third</div><div>- [ ] Fourth</div>',
])(
  'shows at most three read-only tasks without modifying legacy or rich content',
  async (content) => {
    await preview(content);
    expect(host.querySelectorAll('.sp-card-task')).toHaveLength(3);
    expect(host.querySelectorAll('.sp-card-task-box.checked')).toHaveLength(2);
    expect(host.textContent).toBe('DonePendingThird');
    expect(host.querySelector('input,button,[contenteditable]')).toBeNull();
    expect(host.textContent).not.toContain('- [');
  }
);

it('keeps image payloads and note HTML out of the text preview', async () => {
  await preview(
    '<p>Image caption</p><img src="data:image/png;base64,AAAA" onerror="alert(1)">![Legacy screenshot](data:image/png;base64,BBBB)'
  );
  expect(host.textContent).toContain('Image caption');
  expect(host.textContent).toContain('Legacy screenshot');
  expect(host.textContent).not.toContain('base64');
  expect(host.querySelector('img,script')).toBeNull();
});

it('limits plain previews and hides encrypted content', async () => {
  await preview('a'.repeat(1000));
  expect(host.textContent).toHaveLength(240);
  await preview('private plaintext', true);
  expect(host.textContent).toBe('');
});

it('separates adjacent rich-text blocks in the excerpt', async () => {
  await preview('<p>First paragraph.</p><p>Second paragraph.</p>');
  expect(host.textContent).toBe('First paragraph. Second paragraph.');
});
