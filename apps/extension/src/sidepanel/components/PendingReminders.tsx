import React from 'react';
import { AlarmClock, ArrowUpRight, Clock3, X } from 'lucide-react';
import { formatRelativeTime } from '@tabnotes/shared';
import { useTranslation } from '@tabnotes/i18n';
import { DEFAULT_SNOOZE_MINUTES, PendingNoteReminder } from '../../shared/reminders';

export function PendingReminders({
  reminders,
  onOpen,
  onSnooze,
  onDismiss,
}: {
  reminders: PendingNoteReminder[];
  onOpen: (noteId: string) => void;
  onSnooze: (noteId: string) => void;
  onDismiss: (noteId: string) => void;
}) {
  const { t } = useTranslation();
  if (reminders.length === 0) return null;

  return (
    <section className="sp-pending-reminders" aria-label={t('reminders.title')}>
      <div className="sp-pending-reminders-head">
        <span className="sp-pending-reminders-icon" aria-hidden="true">
          <AlarmClock size={14} strokeWidth={2.4} />
        </span>
        <div className="sp-pending-reminders-copy">
          <strong>{t('reminders.title')}</strong>
          <span>{t('reminders.count', { count: reminders.length })}</span>
        </div>
      </div>

      <div className="sp-pending-reminders-list">
        {reminders.slice(0, 3).map((reminder) => (
          <article className="sp-pending-reminder" key={reminder.id}>
            <div className="sp-pending-reminder-main">
              <div className="sp-pending-reminder-title">{reminder.title}</div>
              {reminder.preview && (
                <div className="sp-pending-reminder-preview">{reminder.preview}</div>
              )}
              <div className="sp-pending-reminder-time">
                {t('reminders.due', { time: formatRelativeTime(reminder.firedAt) })}
              </div>
            </div>

            <div className="sp-pending-reminder-actions">
              <button
                type="button"
                className="sp-pending-reminder-btn sp-pending-reminder-open"
                onClick={() => onOpen(reminder.noteId)}
                title={t('reminders.open')}
              >
                <ArrowUpRight size={13} strokeWidth={2.4} />
                <span>{t('reminders.open')}</span>
              </button>
              <button
                type="button"
                className="sp-pending-reminder-btn sp-pending-reminder-snooze"
                onClick={() => onSnooze(reminder.noteId)}
                title={t('reminders.snooze', { minutes: DEFAULT_SNOOZE_MINUTES })}
              >
                <Clock3 size={13} strokeWidth={2.4} />
                <span>{t('reminders.snoozeShort')}</span>
              </button>
              <button
                type="button"
                className="sp-pending-reminder-icon-btn sp-pending-reminder-dismiss"
                onClick={() => onDismiss(reminder.noteId)}
                title={t('reminders.dismiss')}
                aria-label={t('reminders.dismiss')}
              >
                <X size={13} strokeWidth={2.5} />
              </button>
            </div>
          </article>
        ))}
      </div>

      {reminders.length > 3 && (
        <div className="sp-pending-reminders-more">
          {t('reminders.more', { count: reminders.length - 3 })}
        </div>
      )}
    </section>
  );
}

export default PendingReminders;
