import {
  editorHtmlToPlainText,
  isChecklistContent,
  parseChecklistItems,
  stripFormatting,
  type Note,
} from '@tabnotes/shared';
import { useTranslation } from '@tabnotes/i18n';
import { AppIcon } from './AppIcon';

/** Read-only preview: never render note HTML or rewrite its stored content. */
export function NoteCardPreview({ note }: { note: Note }) {
  const { t } = useTranslation();
  if (note.encrypted || !note.content) return null;

  const content = note.content.replace(/!\[([^\]]*)\]\(data:image\/[^)]*\)/gi, '$1');
  const plainText = editorHtmlToPlainText(content);

  if (isChecklistContent(plainText)) {
    const items = parseChecklistItems(plainText, String).slice(0, 3);
    return (
      <div className="sp-card-checklist">
        {items.map((item) => (
          <div key={item.id} className="sp-card-task">
            <span
              className={`sp-card-task-box${item.checked ? ' checked' : ''}`}
              role="img"
              aria-label={t(item.checked ? 'noteList.taskComplete' : 'noteList.taskIncomplete')}
            >
              {item.checked && <AppIcon name="check" size={10} />}
            </span>
            <span className="sp-card-task-text">{stripFormatting(item.text).slice(0, 160)}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="sp-card-excerpt">
      {stripFormatting(plainText).replace(/\s+/g, ' ').slice(0, 240)}
    </div>
  );
}
