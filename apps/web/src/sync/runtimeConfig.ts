export interface RuntimeConfig {
  googleClientId?: unknown;
  VITE_GOOGLE_CLIENT_ID?: unknown;
  extensionId?: unknown;
  VITE_TABNOTES_EXTENSION_ID?: unknown;
}

let runtimeConfigPromise: Promise<RuntimeConfig> | null = null;

export function cleanRuntimeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && !trimmed.includes('REPLACE_WITH') ? trimmed : null;
}

export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  if (runtimeConfigPromise) return runtimeConfigPromise;

  runtimeConfigPromise = (async () => {
    const configUrl = new URL(
      'tabnotes.config.json',
      window.location.origin + import.meta.env.BASE_URL
    );
    try {
      const response = await fetch(configUrl, {
        cache: 'no-store',
        credentials: 'omit',
      });
      if (!response.ok) return {};
      return (await response.json()) as RuntimeConfig;
    } catch {
      return {};
    }
  })();

  return runtimeConfigPromise;
}
