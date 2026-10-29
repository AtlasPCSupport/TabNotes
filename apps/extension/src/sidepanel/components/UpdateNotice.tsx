import { useEffect, useState } from 'react';
import { useTranslation } from '@tabnotes/i18n';
import { UPDATE_NOTICE_KEY } from '../../shared/updateNotice';
import { useSidePanelStore } from '../store';
import { AppIcon } from './AppIcon';

/** Only UI metadata is stored; notes and backup data are never modified. */
export function UpdateNotice() {
  const { t } = useTranslation();
  const setView = useSidePanelStore((s) => s.setView);
  const [visible, setVisible] = useState(false);
  const version = chrome.runtime.getManifest().version;

  useEffect(() => {
    let cancelled = false;
    let changed = false;
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local' || !changes[UPDATE_NOTICE_KEY]) return;
      changed = true;
      setVisible(changes[UPDATE_NOTICE_KEY].newValue === version);
    };
    chrome.storage.onChanged.addListener(onChanged);
    void chrome.storage.local.get(UPDATE_NOTICE_KEY).then(
      (data) => {
        if (!cancelled && !changed) setVisible(data[UPDATE_NOTICE_KEY] === version);
      },
      () => undefined
    );
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, [version]);

  const dismiss = () => {
    // A failed storage write must not pretend that dismissal was persisted.
    void chrome.storage.local.remove(UPDATE_NOTICE_KEY).then(
      () => setVisible(false),
      () => undefined
    );
  };

  if (!visible) return null;
  return (
    <div className="sp-update-notice" role="status" data-testid="update-notice">
      <span>{t('releaseNotes.updated', { version })}</span>
      <button
        className="sp-update-link"
        onClick={() => {
          setView('about');
          dismiss();
        }}
      >
        {t('releaseNotes.view')}
      </button>
      <button
        className="sp-update-dismiss"
        aria-label={t('releaseNotes.dismiss')}
        onClick={dismiss}
      >
        <AppIcon name="close" size={14} />
      </button>
    </div>
  );
}
