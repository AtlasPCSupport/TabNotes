import React from 'react';
import { useSidePanelStore } from '../store';
import type { NoteScope, PinHash } from '@tabnotes/shared';
import type { Features, Theme, Align, SettingsTarget } from '../store/types';
import { useTranslation } from '@tabnotes/i18n';
import { AppIcon, type AppIconName } from '../components/AppIcon';

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

const SCOPE_OPTIONS: { value: NoteScope; label: string; icon: AppIconName; desc: string }[] = [
  { value: 'url', label: 'URL', icon: 'url', desc: 'Exact page URL' },
  { value: 'domain', label: 'Domain', icon: 'domain', desc: 'Entire site' },
  { value: 'workspace', label: 'Projects', icon: 'workspace', desc: 'Your project' },
  { value: 'global', label: 'Global', icon: 'global', desc: 'Everywhere' },
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

const SETTINGS_HIGHLIGHT_MS = 1400;

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
  const settingsTarget = useSidePanelStore((s) => s.settingsTarget);
  const settingsTargetVersion = useSidePanelStore((s) => s.settingsTargetVersion);
  const setSettingsTarget = useSidePanelStore((s) => s.setSettingsTarget);
  const sectionRefs = React.useRef<Partial<Record<SettingsTarget, HTMLDivElement | null>>>({});
  const [highlightedTarget, setHighlightedTarget] = React.useState<SettingsTarget | null>(null);

  const registerSection = React.useCallback(
    (target: SettingsTarget) => (node: HTMLDivElement | null) => {
      sectionRefs.current[target] = node;
    },
    []
  );

  const sectionClassName = (target: SettingsTarget) =>
    `sp-settings-anchor${highlightedTarget === target ? ' highlight' : ''}`;

  React.useEffect(() => {
    if (!settingsTarget) return;

    const target = settingsTarget;
    const timer = window.setTimeout(() => {
      const node = sectionRefs.current[target];
      if (!node) return;

      node.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'auto' });
      node.focus({ preventScroll: true });
      setHighlightedTarget(target);
      setSettingsTarget(null);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [settingsTarget, settingsTargetVersion, setSettingsTarget]);

  React.useEffect(() => {
    if (!highlightedTarget) return;
    const timer = window.setTimeout(() => setHighlightedTarget(null), SETTINGS_HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [highlightedTarget]);

  return (
    <div className="sp-settings-view">
      <div
        ref={registerSection('features')}
        className={sectionClassName('features')}
        data-settings-section="features"
        tabIndex={-1}
      >
        <FeatureToggles features={features} toggleFeature={toggleFeature} />
      </div>

      <div
        ref={registerSection('ai')}
        className={sectionClassName('ai')}
        data-settings-section="ai"
        tabIndex={-1}
      >
        <AiSettings
          groqKey={groqKey}
          groqKeyInput={groqKeyInput}
          setGroqKeyInput={setGroqKeyInput}
          groqKeyVisible={groqKeyVisible}
          setGroqKeyVisible={setGroqKeyVisible}
          saveGroqKey={saveGroqKey}
          onOpenChat={onOpenChat}
        />
      </div>

      <div
        ref={registerSection('appearance')}
        className={sectionClassName('appearance')}
        data-settings-section="appearance"
        tabIndex={-1}
      >
        <div className="sp-settings-section">
          <div className="sp-settings-label">{translate('settings.appearance')}</div>
          <div className="sp-theme-grid">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                className={`sp-theme-btn${theme === t ? ' active' : ''}`}
                onClick={() => setTheme(t)}
              >
                <AppIcon
                  name={t === 'light' ? 'light' : t === 'dark' ? 'dark' : 'settings'}
                  size={14}
                />
                <span>
                  {t === 'light'
                    ? translate('settings.themeLight')
                    : t === 'dark'
                      ? translate('settings.themeDark')
                      : translate('settings.themeSystem')}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        ref={registerSection('language')}
        className={sectionClassName('language')}
        data-settings-section="language"
        tabIndex={-1}
      >
        <LanguageSettings language={language} setLanguage={setLanguage} />
      </div>

      <div
        ref={registerSection('pin')}
        className={sectionClassName('pin')}
        data-settings-section="pin"
        tabIndex={-1}
      >
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
      </div>

      <div
        ref={registerSection('editor')}
        className={sectionClassName('editor')}
        data-settings-section="editor"
        tabIndex={-1}
      >
        <EditorSettings
          markdownEnabled={markdownEnabled}
          setMarkdown={setMarkdown}
          fontSize={fontSize}
          changeFontSize={changeFontSize}
          defaultAlign={defaultAlign}
          setDefaultAlign={setDefaultAlign}
        />
      </div>

      <div
        ref={registerSection('scope')}
        className={sectionClassName('scope')}
        data-settings-section="scope"
        tabIndex={-1}
      >
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
      </div>

      <div
        ref={registerSection('workspace')}
        className={sectionClassName('workspace')}
        data-settings-section="workspace"
        tabIndex={-1}
      >
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
      </div>

      <div
        ref={registerSection('stats')}
        className={sectionClassName('stats')}
        data-settings-section="stats"
        tabIndex={-1}
      >
        <StatsSettings />
      </div>

      <div
        ref={registerSection('data')}
        className={sectionClassName('data')}
        data-settings-section="data"
        tabIndex={-1}
      >
        <DataSettings
          handleExport={handleExport}
          handleImport={handleImport}
          importInputRef={importInputRef}
          dataFeedback={dataFeedback}
          backupRemindDays={backupRemindDays}
          setBackupRemind={setBackupRemind}
        />
      </div>

      <div
        ref={registerSection('support')}
        className={sectionClassName('support')}
        data-settings-section="support"
        tabIndex={-1}
      >
        <SupportSettings />
      </div>
    </div>
  );
}

export default SettingsView;
