import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanRuntimeString, getRuntimeConfig } from './runtimeConfig';

describe('web runtime configuration', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ googleClientId: ' public-client-id ' }), {
          headers: { 'content-type': 'application/json' },
        })
      )
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects placeholders and whitespace-only values', () => {
    expect(cleanRuntimeString('  client-id  ')).toBe('client-id');
    expect(cleanRuntimeString('REPLACE_WITH_CLIENT_ID')).toBeNull();
    expect(cleanRuntimeString('   ')).toBeNull();
    expect(cleanRuntimeString(42)).toBeNull();
  });

  it('loads public config without sending cookies', async () => {
    await expect(getRuntimeConfig()).resolves.toEqual({ googleClientId: ' public-client-id ' });

    const [request, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(String(request)).toBe(`${window.location.origin}/tabnotes.config.json`);
    expect(init).toEqual({ cache: 'no-store', credentials: 'omit' });
  });
});
