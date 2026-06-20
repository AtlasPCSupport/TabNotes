import React from 'react';
import { useSidePanelStore } from '../../store';
import { useTranslation, type TranslationKey } from '@tabnotes/i18n';
import { AppIcon } from '../AppIcon';

export interface WorkspaceColor {
  value: string;
  labelKey: TranslationKey;
}

/**
 * Active Workspace settings: switch active workspace, rename/recolor/delete the
 * active one, and create new workspaces. Workspace + note data come from the
 * store; the actual `WorkspacesService` operations are performed by the parent
 * via the passed action callbacks. Extracted verbatim — no behavior change.
 */
export function WorkspaceSettings({
  workspaceColors,
  editWsName,
  setEditWsName,
  editWsColor,
  setEditWsColor,
  newWsNameInput,
  setNewWsNameInput,
  newWsColorInput,
  setNewWsColorInput,
  onSetActive,
  onUpdate,
  onDelete,
  onCreate,
}: {
  workspaceColors: WorkspaceColor[];
  editWsName: string;
  setEditWsName: (v: string) => void;
  editWsColor: string;
  setEditWsColor: (v: string) => void;
  newWsNameInput: string;
  setNewWsNameInput: (v: string) => void;
  newWsColorInput: string;
  setNewWsColorInput: (v: string) => void;
  onSetActive: (id: string | null) => void;
  onUpdate: (id: string, name: string, color: string) => void;
  onDelete: (id: string, name: string) => void;
  onCreate: (name: string, color: string) => void;
}) {
  const { t } = useTranslation();
  const workspaces = useSidePanelStore((s) => s.workspaces);
  const activeWorkspaceId = useSidePanelStore((s) => s.activeWorkspaceId);
  const allNotes = useSidePanelStore((s) => s.allNotes);

  return (
    <div className="sp-settings-section">
      <div className="sp-settings-label">{t('settingsSections.activeWorkspace')}</div>
      <div className="sp-scope-grid">
        <div
          className={`sp-scope-row${activeWorkspaceId === null ? ' active' : ''}`}
          onClick={() => onSetActive(null)}
        >
          <span className="sp-scope-row-icon">
            <AppIcon name="global" size={15} />
          </span>
          <div className="sp-scope-row-info">
            <div className="sp-scope-row-name">{t('settingsSections.noWorkspace')}</div>
            <div className="sp-scope-row-desc">{t('settingsSections.globalNotes')}</div>
          </div>
          {activeWorkspaceId === null && (
            <span className="sp-scope-row-check">
              <AppIcon name="check" size={13} />
            </span>
          )}
        </div>
        {workspaces.map((ws) => {
          const isActive = activeWorkspaceId === ws.id;
          const notesCount = allNotes.filter((n) => n.workspaceId === ws.id).length;
          return (
            <div
              key={ws.id}
              className={`sp-scope-row${isActive ? ' active' : ''}`}
              style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}
              onClick={() => {
                if (!isActive) onSetActive(ws.id);
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <span
                  className="sp-scope-row-icon"
                  style={{
                    color: ws.color || 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                  }}
                >
                  ●
                </span>
                <div className="sp-scope-row-info" style={{ flex: 1 }}>
                  <div className="sp-scope-row-name">{ws.name}</div>
                  <div className="sp-scope-row-desc">
                    {t('settingsSections.notesCount', { count: notesCount })}
                  </div>
                </div>
                {isActive && (
                  <span className="sp-scope-row-check">
                    <AppIcon name="check" size={13} />
                  </span>
                )}
              </div>

              {isActive && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    borderTop: '1px solid var(--border)',
                    paddingTop: 6,
                    marginTop: 2,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      className="sp-folder-rename-input"
                      style={{ flex: 1, height: 24, fontSize: 11 }}
                      value={editWsName}
                      onChange={(e) => setEditWsName(e.target.value)}
                      placeholder={t('settingsSections.renameWorkspace')}
                    />
                    <button
                      className="sp-folder-chip active"
                      style={{ padding: '2px 8px', fontSize: 10 }}
                      onClick={() => {
                        if (!editWsName.trim()) return;
                        onUpdate(ws.id, editWsName.trim(), editWsColor);
                      }}
                    >
                      {t('common.save')}
                    </button>
                    <button
                      className="sp-folder-chip"
                      style={{
                        padding: '2px 8px',
                        fontSize: 10,
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: 'rgb(239, 68, 68)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                      }}
                      onClick={() => onDelete(ws.id, ws.name)}
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {workspaceColors.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setEditWsColor(c.value)}
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          background: c.value,
                          border:
                            editWsColor === c.value
                              ? '1.5px solid var(--text)'
                              : '1px solid var(--border)',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                        title={t(c.labelKey)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Form to create a new workspace */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newWsNameInput.trim()) return;
          onCreate(newWsNameInput.trim(), newWsColorInput);
        }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          marginTop: 14,
          padding: '10px 12px',
          border: '1px dashed var(--border)',
          borderRadius: 'var(--r-md)',
          background: 'rgba(255, 255, 255, 0.01)',
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.05em',
            color: 'var(--text-subtle)',
            textTransform: 'uppercase',
          }}
        >
          {t('settingsSections.createNewWorkspace')}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            className="sp-folder-rename-input"
            style={{ flex: 1, height: 26, fontSize: 11, padding: '3px 8px' }}
            value={newWsNameInput}
            onChange={(e) => setNewWsNameInput(e.target.value)}
            placeholder={t('settingsSections.workspaceNamePlaceholder')}
          />
          <button
            type="submit"
            className="sp-folder-chip active"
            style={{ padding: '2px 10px', fontSize: 10, height: 26 }}
          >
            {t('common.create')}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
          <span style={{ fontSize: 10, color: 'var(--text-subtle)', marginRight: 4 }}>{t('settingsSections.workspaceColorLabel')}</span>
          {workspaceColors.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setNewWsColorInput(c.value)}
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: c.value,
                border:
                  newWsColorInput === c.value
                    ? '1.5px solid var(--text)'
                    : '1px solid var(--border)',
                cursor: 'pointer',
                padding: 0,
              }}
              title={t(c.labelKey)}
            />
          ))}
        </div>
      </form>
    </div>
  );
}

export default WorkspaceSettings;
