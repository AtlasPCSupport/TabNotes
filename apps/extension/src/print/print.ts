import { sanitizeHtml } from '@tabnotes/shared';

async function printNote() {
  const key = new URL(location.href).searchParams.get('id') ?? '';
  if (!/^tn_print:[a-f0-9-]{36}$/.test(key)) return;
  const result = await chrome.storage.session.get(key);
  await chrome.storage.session.remove(key);
  const html = result[key];
  if (typeof html !== 'string') return;
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  document.title = parsed.title;
  const style = document.createElement('style');
  style.textContent = parsed.querySelector('style')?.textContent ?? '';
  document.head.append(style);
  document.body.innerHTML = sanitizeHtml(parsed.body.innerHTML);
  await Promise.all(Array.from(document.images, (image) => image.decode().catch(() => undefined)));
  window.print();
}

void printNote().catch(() => {
  document.body.textContent = 'Unable to prepare this note for printing.';
});
