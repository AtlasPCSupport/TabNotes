import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@tabnotes/i18n';
import {
  floatingDomainFromUrl,
  floatingPermissionOrigins,
  FLOATING_DOMAINS_STORAGE_KEY,
} from '../../../shared/floating';
import { useSidePanelStore } from '../../store';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cr: any =
  typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).chrome
    ? (globalThis as Record<string, unknown>).chrome
    : null;

interface RuntimeResponse {
  ok?: boolean;
  error?: string;
}

function getDomains(): Promise<string[]> {
  return new Promise((resolve) => {
    cr?.storage?.local?.get(FLOATING_DOMAINS_STORAGE_KEY, (result: Record<string, unknown>) => {
      const domains = result[FLOATING_DOMAINS_STORAGE_KEY];
      resolve(
        Array.isArray(domains)
          ? domains.filter((domain): domain is string => typeof domain === 'string')
          : []
      );
    });
  });
}

function checkPermission(origins: string[]): Promise<boolean> {
  return new Promise((resolve) => cr?.permissions?.contains({ origins }, resolve));
}

function requestPermission(origins: string[]): Promise<boolean> {
  return new Promise((resolve) => cr?.permissions?.request({ origins }, resolve));
}

function removePermission(origins: string[]): Promise<boolean> {
  return new Promise((resolve) => cr?.permissions?.remove({ origins }, resolve));
}

function setFloatingDomain(domain: string, enabled: boolean): Promise<RuntimeResponse | null> {
  return new Promise((resolve, reject) => {
    if (!cr?.runtime?.sendMessage) {
      resolve(null);
      return;
    }
    cr.runtime.sendMessage(
      { type: 'FLOATING_SET_DOMAIN', domain, enabled },
      (response: RuntimeResponse | undefined) => {
        const error = cr.runtime.lastError;
        if (error) reject(new Error(error.message));
        else resolve(response ?? null);
      }
    );
  });
}

export function FloatingButtonSettings() {
  const { t } = useTranslation();
  const currentUrl = useSidePanelStore((state) => state.currentUrl);
  const domain = floatingDomainFromUrl(currentUrl);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!domain) {
      setEnabled(false);
      return;
    }
    const domains = await getDomains();
    const permission = await checkPermission(floatingPermissionOrigins(domain));
    setEnabled(domains.includes(domain) && permission);
  }, [domain]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggle = async () => {
    if (!domain || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const origins = floatingPermissionOrigins(domain);
      if (!enabled) {
        const granted = await requestPermission(origins);
        if (!granted) {
          setFeedback(t('settings.floatingPermissionDenied'));
          return;
        }
        const response = await setFloatingDomain(domain, true);
        if (!response?.ok) throw new Error(response?.error || 'ENABLE_FAILED');
        setEnabled(true);
        setFeedback(t('settings.floatingEnabled'));
      } else {
        const response = await setFloatingDomain(domain, false);
        if (!response?.ok) throw new Error(response?.error || 'DISABLE_FAILED');
        await removePermission(origins);
        setEnabled(false);
        setFeedback(t('settings.floatingDisabled'));
      }
    } catch {
      setFeedback(t('settings.floatingError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sp-settings-section" data-testid="floating-button-settings">
      <div className="sp-settings-label">{t('settings.floatingTitle')}</div>
      <div className="sp-settings-row">
        <div className="sp-settings-row-info">
          <div className="sp-settings-row-title">{t('settings.floatingCurrentSite')}</div>
          <div className="sp-settings-row-desc">
            {domain ? domain : t('settings.floatingUnsupported')}
          </div>
        </div>
        <button
          type="button"
          className={`sp-toggle ${enabled ? 'on' : 'off'}`}
          aria-pressed={enabled}
          aria-label={enabled ? t('settings.floatingDisable') : t('settings.floatingEnable')}
          disabled={!domain || busy}
          onClick={() => void toggle()}
        >
          <div className="sp-toggle-knob" />
        </button>
      </div>
      <div className="sp-settings-row-desc sp-floating-permission-note">
        {t('settings.floatingDesc')}
      </div>
      {feedback && <div className="sp-data-feedback success">{feedback}</div>}
    </div>
  );
}

export default FloatingButtonSettings;
