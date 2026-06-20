import React from 'react';
import { useTranslation } from '@tabnotes/i18n';
import { DriveSyncSettings } from './DriveSyncSettings';
import { AppIcon } from '../AppIcon';

/**
 * Data management settings: export/import backup + backup-reminder interval.
 * Persistence and file handling are done by the parent via the passed
 * handlers. Extracted verbatim from the Settings view — no behavior change.
 */
export function DataSettings({
  handleExport,
  handleImport,
  importInputRef,
  dataFeedback,
  backupRemindDays,
  setBackupRemind,
}: {
  handleExport: () => void;
  handleImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  importInputRef: React.RefObject<HTMLInputElement>;
  dataFeedback: { type: 'success' | 'error'; msg: string } | null;
  backupRemindDays: number;
  setBackupRemind: (days: number) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="sp-settings-section">
      <div className="sp-settings-label">{t('settingsSections.data')}</div>
      <div className="sp-data-grid">
        <button className="sp-data-btn export" onClick={handleExport}>
          <span className="sp-data-btn-icon">
            <AppIcon name="download" size={18} />
          </span>
          <div className="sp-data-btn-info">
            <div className="sp-data-btn-title">{t('settingsSections.exportBackup')}</div>
            <div className="sp-data-btn-desc">{t('settingsSections.exportBackupDesc')}</div>
          </div>
        </button>
        <button className="sp-data-btn import" onClick={() => importInputRef.current?.click()}>
          <span className="sp-data-btn-icon">
            <AppIcon name="upload" size={18} />
          </span>
          <div className="sp-data-btn-info">
            <div className="sp-data-btn-title">{t('settingsSections.importBackup')}</div>
            <div className="sp-data-btn-desc">{t('settingsSections.importBackupDesc')}</div>
          </div>
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleImport}
        />
      </div>
      {dataFeedback && (
        <div className={`sp-data-feedback ${dataFeedback.type}`}>
          <AppIcon name={dataFeedback.type === 'success' ? 'check' : 'close'} size={13} />{' '}
          {dataFeedback.msg}
        </div>
      )}

      <DriveSyncSettings />

      {/* Backup reminder interval */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 10,
          padding: '8px 10px',
          borderRadius: 'var(--r-md)',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border)',
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{t('settingsSections.backupReminder')}</div>
          <div style={{ fontSize: 10, color: 'var(--text-subtle)', marginTop: 1 }}>
            {t('settingsSections.backupReminderDesc')}
          </div>
        </div>
        <select
          value={backupRemindDays}
          onChange={(e) => setBackupRemind(Number(e.target.value))}
          style={{
            fontSize: 11,
            padding: '3px 6px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            color: 'var(--text)',
            cursor: 'pointer',
          }}
        >
          <option value={0}>{t('settings.backupRemindOff')}</option>
          <option value={7}>{t('settings.backupRemindDays', { days: 7 })}</option>
          <option value={14}>{t('settings.backupRemindDays', { days: 14 })}</option>
          <option value={30}>{t('settings.backupRemindDays', { days: 30 })}</option>
        </select>
      </div>
    </div>
  );
}

export default DataSettings;
