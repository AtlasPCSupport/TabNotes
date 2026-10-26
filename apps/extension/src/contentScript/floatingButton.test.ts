// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';

let shadow: ShadowRoot;
const added = vi.fn();
afterEach(() => {
  added.mock.calls[0]?.[0]({ type: 'FLOATING_SET_ENABLED', enabled: false });
  added.mockClear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function load(sendMessage: ReturnType<typeof vi.fn>) {
  vi.resetModules();
  const attach = Element.prototype.attachShadow;
  vi.spyOn(Element.prototype, 'attachShadow').mockImplementation(function (this: Element, init) {
    shadow = attach.call(this, init);
    return shadow;
  });
  vi.stubGlobal('chrome', {
    i18n: { getMessage: () => '' },
    runtime: { sendMessage, onMessage: { addListener: added, removeListener: vi.fn() } },
  });
  await vi.importActual('./floatingButton');
}

it.each(['response', 'rejection', 'invalidated-context'])('shows a visible failure for %s', async (failure) => {
  const send = failure === 'response'
    ? vi.fn().mockResolvedValue({ ok: false, error: 'FLOATING_NOT_ENABLED' })
    : failure === 'rejection'
      ? vi.fn().mockRejectedValue(new Error('Disconnected'))
      : vi.fn(() => { throw new Error('Extension context invalidated'); });
  await load(send);
  shadow.querySelector<HTMLButtonElement>('.trigger')!.click();
  shadow.querySelector<HTMLButtonElement>('.item')!.click();
  await vi.waitFor(() => {
    const alert = shadow.querySelector<HTMLElement>('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert!.hidden).toBe(false);
    expect(alert!.textContent).toContain('TabNotes');
  });
});

it('sends all seven actions once and keeps failures hidden after successful acceptance', async () => {
  const send = vi.fn().mockResolvedValue({ ok: true });
  await load(send);
  for (const item of shadow.querySelectorAll<HTMLButtonElement>('.item')) item.click();
  await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(7));
  expect(send.mock.calls.map(([message]) => message.action)).toEqual([
    'new-note', 'screenshot-current', 'screenshot-new', 'crop-current', 'crop-new', 'clip-current', 'clip-new',
  ]);
  expect(shadow.querySelector<HTMLElement>('[role="alert"]')?.hidden).toBe(true);
});
