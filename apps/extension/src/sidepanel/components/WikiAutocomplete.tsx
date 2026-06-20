import React from 'react';
import { stripFormatting } from '@tabnotes/shared';
import { useTranslation } from '@tabnotes/i18n';
import { useSidePanelStore } from '../store';

export interface WikiAutocompleteProps {
  wikiQuery: string;
  activeNoteId: string | null;
  onSelect: (label: string) => void;
}

export function WikiAutocomplete({
  wikiQuery,
  activeNoteId,
  onSelect,
}: WikiAutocompleteProps) {
  const { t } = useTranslation();
  const allNotes = useSidePanelStore((s) => s.allNotes);

  const filteredNotes = React.useMemo(() => {
    const q = wikiQuery.toLowerCase();
    return allNotes
      .filter(
        (n) =>
          n.id !== activeNoteId &&
          (n.title || stripFormatting(n.content).split('\n')[0])
            .toLowerCase()
            .includes(q)
      )
      .slice(0, 6);
  }, [allNotes, wikiQuery, activeNoteId]);

  if (filteredNotes.length === 0) {
    return (
      <div className="tn-wiki-suggest">
        <span className="tn-wiki-empty">{t('wiki.noMatchingNotes')}</span>
      </div>
    );
  }

  return (
    <div className="tn-wiki-suggest">
      {filteredNotes.map((n) => {
        const label = n.title || stripFormatting(n.content).split('\n')[0];
        return (
          <button
            key={n.id}
            className="tn-wiki-item"
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(label);
            }}
          >
            {label.slice(0, 45)}
          </button>
        );
      })}
    </div>
  );
}

export default WikiAutocomplete;
