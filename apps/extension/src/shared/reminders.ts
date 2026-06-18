export const NOTE_REMINDER_ALARM_PREFIX = 'tn_reminder_';
export const NOTE_REMINDER_NOTIFICATION_PREFIX = 'tn_notif_';
export const PENDING_REMINDERS_STORAGE_KEY = 'tn_pending_reminders';
export const OPEN_REMINDER_REQUEST_STORAGE_KEY = 'tn_open_reminder_request';
export const ACTIVE_REMINDER_ALERT_STORAGE_KEY = 'tn_active_reminder_alert';
export const REMINDER_MIN_LEAD_MS = 60 * 1000;
export const DEFAULT_REMINDER_OFFSET_MS = 10 * 60 * 1000;
export const DEFAULT_SNOOZE_MINUTES = 10;
export const MAX_PENDING_REMINDERS = 25;
export const REMINDER_ALERT_DURATION_MS = 2 * 60 * 1000;
export const REMINDER_BADGE_FLASH_MS = 650;

export interface ActiveReminderAlert {
  noteId: string;
  startedAt: number;
  expiresAt: number;
}

export interface PendingNoteReminder {
  id: string;
  noteId: string;
  title: string;
  preview: string;
  firedAt: number;
  reminderAt?: number;
  scope?: string;
  scopeKey?: string;
  workspaceId?: string | null;
}

export interface OpenReminderRequest {
  noteId: string;
  requestedAt: number;
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

export function createNoteReminderAlarmName(noteId: string): string {
  return `${NOTE_REMINDER_ALARM_PREFIX}${noteId}`;
}

export function createNoteReminderNotificationId(noteId: string): string {
  return `${NOTE_REMINDER_NOTIFICATION_PREFIX}${noteId}`;
}

export function parseNoteReminderNotificationId(notificationId: string): string | null {
  return notificationId.startsWith(NOTE_REMINDER_NOTIFICATION_PREFIX)
    ? notificationId.slice(NOTE_REMINDER_NOTIFICATION_PREFIX.length)
    : null;
}

export function parseNoteReminderAlarmName(alarmName: string): string | null {
  return alarmName.startsWith(NOTE_REMINDER_ALARM_PREFIX)
    ? alarmName.slice(NOTE_REMINDER_ALARM_PREFIX.length)
    : null;
}

export function parseDateTimeLocalInput(value: string): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function formatDateTimeLocal(timestamp: number): string {
  const date = new Date(timestamp);
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join('-') + `T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;
}

export function roundUpToMinute(timestamp: number): number {
  const date = new Date(timestamp);
  date.setSeconds(0, 0);
  if (date.getTime() < timestamp) {
    date.setMinutes(date.getMinutes() + 1);
  }
  return date.getTime();
}

export function getMinimumReminderTimestamp(now = Date.now()): number {
  return roundUpToMinute(now + REMINDER_MIN_LEAD_MS);
}

export function getDefaultReminderTimestamp(now = Date.now()): number {
  return roundUpToMinute(now + DEFAULT_REMINDER_OFFSET_MS);
}

export function isReminderTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isFutureReminderTimestamp(value: unknown, now = Date.now()): value is number {
  return isReminderTimestamp(value) && value > now;
}

export function isSchedulableReminderTimestamp(value: unknown, now = Date.now()): value is number {
  return isReminderTimestamp(value) && value >= now + REMINDER_MIN_LEAD_MS;
}

export function createPendingReminderId(noteId: string, firedAt: number): string {
  return `${noteId}:${firedAt}`;
}

export function normalizePendingReminders(value: unknown): PendingNoteReminder[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is PendingNoteReminder => {
      if (!item || typeof item !== 'object') return false;
      const reminder = item as Partial<PendingNoteReminder>;
      return (
        typeof reminder.id === 'string' &&
        typeof reminder.noteId === 'string' &&
        typeof reminder.title === 'string' &&
        typeof reminder.preview === 'string' &&
        isReminderTimestamp(reminder.firedAt)
      );
    })
    .sort((a, b) => b.firedAt - a.firedAt)
    .slice(0, MAX_PENDING_REMINDERS);
}

export function upsertPendingReminder(
  reminders: PendingNoteReminder[],
  reminder: PendingNoteReminder
): PendingNoteReminder[] {
  return normalizePendingReminders([
    reminder,
    ...reminders.filter((item) => item.noteId !== reminder.noteId),
  ]);
}

export function removePendingReminder(
  reminders: PendingNoteReminder[],
  noteId: string
): PendingNoteReminder[] {
  return reminders.filter((item) => item.noteId !== noteId);
}
