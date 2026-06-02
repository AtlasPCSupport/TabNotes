import React from 'react';
import { useSidePanelStore } from '../store';
import { ICONS } from '../icons';
import type { NoteScope, PinHash } from '@tabnotes/shared';
import type { Features, Theme, Align } from '../store/types';
import { useTranslation } from '@tabnotes/i18n';

import { FeatureToggles } from '../components/settings/FeatureToggles';
import { AiSettings } from '../components/settings/AiSettings';
import { PinSettings } from '../components/settings/PinSettings';
import { EditorSettings } from '../components/settings/EditorSettings';
import { ScopeDigestSettings } from '../components/settings/ScopeDigestSettings';
import { WorkspaceSettings } from '../components/settings/WorkspaceSettings';
import { StatsSettings } from '../components/settings/StatsSettings';
import { DataSettings } from '../components/settings/DataSettings';
import { SupportSettings } from '../components/settings/SupportSettings';
import { LanguageSettings } from '../components/settings/LanguageSettings';

const SCOPE_OPTIONS: { value: NoteScope; label: string; icon: string; desc: string }[] = [
  { value: 'url', label: 'URL', icon: ICONS.url, desc: 'Exact page URL' },
  { value: 'domain', label: 'Domain', icon: ICONS.domain, desc: 'Entire site' },
  { value: 'workspace', label: 'Projects', icon: ICONS.workspace, desc: 'Your project' },
  { value: 'global', label: 'Global', icon: ICONS.global, desc: 'Everywhere' },
];

const WORKSPACE_COLORS = [
  { value: '#2f6dff', label: 'Blue' },
  { value: '#ef4444', label: 'Red' },
  { value: '#f59e0b', label: 'Orange' },
  { value: '#10b981', label: 'Green' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#6366f1', label: 'Indigo' },
  { value: '#14b8a6', label: 'Teal' },
];

export interface SettingsViewProps {
  // Feature Toggles
  toggleFeature: (key: keyof Features) => void;

  // AI settings
  groqKey: string;
  groqKeyInput: string;
  setGroqKeyInput: (val: string) => void;
  groqKeyVisible: boolean;
  setGroqKeyVisible: (updater: (v: boolean) => boolean) => void;
  saveGroqKey: (key: string) => void;
  onOpenChat: () => void;

  // Theme
  setTheme: (theme: Theme) => Promise<void>;

  // PIN settings
  pinHash: PinHash | null;
  pinSetInput: string;
  setPinSetInput: (val: string) => void;
  pinSetConfirm: string;
  setPinSetConfirm: (val: string) => void;
  pinSetFeedback: string;
  savePin: () => void;
  removePin: () => void;
  lockNow: () => void;

  // Editor settings
  setMarkdown: (v: boolean) => Promise<void>;
  changeFontSize: (dir: 1 | -1) => void;
  setDefaultAlign: (align: Align) => void;

  // Scope digest settings
  setDefaultScope: (scope: NoteScope) => Promise<void>;
  digestEnabled: boolean;
  setDigestEnabled: (val: boolean) => void;
  digestTime: string;
  setDigestTime: (val: string) => void;
  saveDigest: (enabled: boolean, time: string) => void;

  // Workspace settings
  editWsName: string;
  setEditWsName: (val: string) => void;
  editWsColor: string;
  setEditWsColor: (val: string) => void;
  newWsNameInput: string;
  setNewWsNameInput: (val: string) => void;
  newWsColorInput: string;
  setNewWsColorInput: (val: string) => void;
  onSetActiveWorkspace: (id: string | null) => Promise<void>;
  onUpdateWorkspace: (id: string, name: string, color: string) => Promise<void>;
  onDeleteWorkspace: (id: string, name: string) => Promise<void>;
  onCreateWorkspace: (name: string, color: string) => Promise<void>;

  // Data settings
  handleExport: () => void;
  handleImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  importInputRef: React.RefObject<HTMLInputElement>;
  dataFeedback: { type: 'success' | 'error'; msg: string } | null;
  backupRemindDays: number;
  setBackupRemind: (days: number) => void;
  language: 'en' | 'es';
  setLanguage: (lng: 'en' | 'es') => Promise<void>;
}

export function SettingsView({
  toggleFeature,
  groqKey,
  groqKeyInput,
  setGroqKeyInput,
  groqKeyVisible,
  setGroqKeyVisible,
  saveGroqKey,
  onOpenChat,
  setTheme,
  pinHash,
  pinSetInput,
  setPinSetInput,
  pinSetConfirm,
  setPinSetConfirm,
  pinSetFeedback,
  savePin,
  removePin,
  lockNow,
  setMarkdown,
  changeFontSize,
  setDefaultAlign,
  setDefaultScope,
  digestEnabled,
  setDigestEnabled,
  digestTime,
  setDigestTime,
  saveDigest,
  editWsName,
  setEditWsName,
  editWsColor,
  setEditWsColor,
  newWsNameInput,
  setNewWsNameInput,
  newWsColorInput,
  setNewWsColorInput,
  onSetActiveWorkspace,
  onUpdateWorkspace,
  onDeleteWorkspace,
  onCreateWorkspace,
  handleExport,
  handleImport,
  importInputRef,
  dataFeedback,
  backupRemindDays,
  setBackupRemind,
  language,
  setLanguage,
}: SettingsViewProps) {
  const { t: translate } = useTranslation();
  const features = useSidePanelStore((s) => s.features);
  const theme = useSidePanelStore((s) => s.theme);
  const markdownEnabled = useSidePanelStore((s) => s.markdownEnabled);
  const fontSize = useSidePanelStore((s) => s.fontSize);
  const defaultAlign = useSidePanelStore((s) => s.defaultAlign);
  const defaultScope = useSidePanelStore((s) => s.defaultScope);

  return (
    <div className="sp-settings-view">
      <FeatureToggles features={features} toggleFeature={toggleFeature} />

      <AiSettings
        groqKey={groqKey}
        groqKeyInput={groqKeyInput}
        setGroqKeyInput={setGroqKeyInput}
        groqKeyVisible={groqKeyVisible}
        setGroqKeyVisible={setGroqKeyVisible}
        saveGroqKey={saveGroqKey}
        onOpenChat={onOpenChat}
      />

      <div className="sp-settings-section">
        <div className="sp-settings-label">{translate('settings.appearance')}</div>
        <div className="sp-theme-grid">
          {(['light', 'dark', 'system'] as const).map((t) => (
            <button
              key={t}
              className={`sp-theme-btn${theme === t ? ' active' : ''}`}
              onClick={() => setTheme(t)}
            >
              {t === 'light'
                ? `${ICONS.light} ${translate('settings.themeLight')}`
                : t === 'dark'
                  ? `${ICONS.dark} ${translate('settings.themeDark')}`
                  : translate('settings.themeSystem')}
            </button>
          ))}
        </div>
      </div>

      <LanguageSettings language={language} setLanguage={setLanguage} />

      <PinSettings
        pinHash={pinHash}
        pinSetInput={pinSetInput}
        setPinSetInput={setPinSetInput}
        pinSetConfirm={pinSetConfirm}
        setPinSetConfirm={setPinSetConfirm}
        pinSetFeedback={pinSetFeedback}
        savePin={savePin}
        removePin={removePin}
        lockNow={lockNow}
      />

      <EditorSettings
        markdownEnabled={markdownEnabled}
        setMarkdown={setMarkdown}
        fontSize={fontSize}
        changeFontSize={changeFontSize}
        defaultAlign={defaultAlign}
        setDefaultAlign={setDefaultAlign}
      />

      <ScopeDigestSettings
        scopeOptions={SCOPE_OPTIONS}
        defaultScope={defaultScope}
        setDefaultScope={setDefaultScope}
        digestEnabled={digestEnabled}
        setDigestEnabled={setDigestEnabled}
        digestTime={digestTime}
        setDigestTime={setDigestTime}
        saveDigest={saveDigest}
      />

      <WorkspaceSettings
        workspaceColors={WORKSPACE_COLORS}
        editWsName={editWsName}
        setEditWsName={setEditWsName}
        editWsColor={editWsColor}
        setEditWsColor={setEditWsColor}
        newWsNameInput={newWsNameInput}
        setNewWsNameInput={setNewWsNameInput}
        newWsColorInput={newWsColorInput}
        setNewWsColorInput={setNewWsColorInput}
        onSetActive={onSetActiveWorkspace}
        onUpdate={onUpdateWorkspace}
        onDelete={onDeleteWorkspace}
        onCreate={onCreateWorkspace}
      />

      <StatsSettings />

      <DataSettings
        handleExport={handleExport}
        handleImport={handleImport}
        importInputRef={importInputRef}
        dataFeedback={dataFeedback}
        backupRemindDays={backupRemindDays}
        setBackupRemind={setBackupRemind}
      />

      <SupportSettings />
    </div>
  );
}

export default SettingsView;
