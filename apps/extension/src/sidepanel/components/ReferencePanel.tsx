import React from 'react';
import { Note, stripFormatting, renderMarkdown } from '@tabnotes/shared';
import { useTranslation, type TranslationKey } from '@tabnotes/i18n';
import { useSidePanelStore } from '../store';
import { AppIcon } from './AppIcon';

export interface ReferencePanelProps {
  refNoteId: string | null;
  setRefNoteId: (id: string | null) => void;
  setShowRefPanel: (v: boolean) => void;
}

function pillLabel(n: Note, fallback: string): string {
  if (n.title?.trim()) return stripFormatting(n.title.trim()).slice(0, 18) || fallback;
  const plain = stripFormatting(n.content);
  if (plain.trim()) {
    const first = plain.split('\n')[0];
    return first.length > 18 ? first.slice(0, 18) + '…' : first || fallback;
  }
  return fallback;
}

export function ReferencePanel({
  refNoteId,
  setRefNoteId,
  setShowRefPanel,
}: ReferencePanelProps) {
  const { t } = useTranslation();
  const allNotes = useSidePanelStore((s) => s.allNotes);
  const contextNotes = useSidePanelStore((s) => s.contextNotes);
  const activeNoteId = useSidePanelStore((s) => s.activeNoteId);

  return (
    <div className="sp-ref-panel">
      <div className="sp-ref-panel-header">
        <span className="sp-ref-panel-title">{t('reference.title')}</span>
        <button
          className="sp-icon-btn"
          style={{ fontSize: 11 }}
          title={t('common.close')}
          aria-label={t('common.close')}
          onClick={() => {
            setRefNoteId(null);
            setShowRefPanel(false);
          }}
        >
          <AppIcon name="close" size={13} />
        </button>
      </div>
      {refNoteId === null ? (
        <div className="sp-ref-note-list">
          {contextNotes.filter((n) => n.id !== activeNoteId).length === 0 ? (
            <div className="sp-ref-empty">{t('reference.empty')}</div>
          ) : (
            contextNotes
              .filter((n) => n.id !== activeNoteId)
              .map((n, i) => (
                <button
                  key={n.id}
                  className="sp-ref-note-item"
                  onClick={() => setRefNoteId(n.id)}
                >
                  <span className="sp-ref-note-label">
                    {pillLabel(n, t('reference.noteFallback', { number: i + 1 }))}
                  </span>
                  <span className="sp-ref-note-preview">
                    {stripFormatting(n.content).slice(0, 60) || '—'}
                  </span>
                </button>
              ))
          )}
          {allNotes
            .filter((n) => n.id !== activeNoteId && !contextNotes.find((c) => c.id === n.id))
            .slice(0, 8)
            .map((n, i) => (
              <button
                key={n.id}
                className="sp-ref-note-item"
                onClick={() => setRefNoteId(n.id)}
              >
                <span className="sp-ref-note-label">
                  {pillLabel(n, t('reference.noteFallback', { number: i + 1 }))}
                </span>
                <span className="sp-ref-note-preview" style={{ color: 'var(--text-subtle)' }}>
                  {t(`scope.${n.scope}` as TranslationKey)} ·{' '}
                  {stripFormatting(n.content).slice(0, 40) || '—'}
                </span>
              </button>
            ))}
        </div>
      ) : (
        (() => {
          const rn = allNotes.find((n) => n.id === refNoteId);
          if (!rn) return null;
          return (
            <div className="sp-ref-note-view">
              <div className="sp-ref-note-view-header">
                <button className="sp-ref-back" onClick={() => setRefNoteId(null)}>
                  ← {t('common.back')}
                </button>
                <span className="sp-ref-note-view-title">
                  {rn.title || pillLabel(rn, t('reference.noteFallback', { number: 1 }))}
                </span>
              </div>
              <div
                className="sp-ref-note-content sp-markdown-preview"
                dangerouslySetInnerHTML={{
                  __html: rn.content
                    ? renderMarkdown(rn.content)
                    : `<p style="color:var(--text-subtle);font-style:italic">${t(
                        'reference.emptyNote'
                      )}</p>`,
                }}
              />
            </div>
          );
        })()
      )}
    </div>
  );
}

export default ReferencePanel;
