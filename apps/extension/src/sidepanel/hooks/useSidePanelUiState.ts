import { useCallback, useRef, useState } from 'react';
import type { PendingNoteReminder } from '../../shared/reminders';

/**
 * Ephemeral panel state that does not belong in the persisted note store.
 * Keeping these controls together makes SidePanelApp a coordinator instead of
 * a second state container, while preserving the existing public behavior.
 */
export function useSidePanelUiState() {
  const [deletePillConfirmId, setDeletePillConfirmId] = useState<string | null>(null);
  const [deleteCardConfirmId, setDeleteCardConfirmId] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [collapsedScopes, setCollapsedScopes] = useState<Set<string>>(
    () => new Set(['url', 'domain', 'workspace', 'global'])
  );
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [showEncPrompt, setShowEncPrompt] = useState<'lock' | 'unlock' | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const reminderRef = useRef<HTMLDivElement>(null);
  const [reminderInput, setReminderInput] = useState('');
  const [pendingReminders, setPendingReminders] = useState<PendingNoteReminder[]>([]);
  const [refNoteId, setRefNoteId] = useState<string | null>(null);
  const [showRefPanel, setShowRefPanel] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const templatesRef = useRef<HTMLDivElement>(null);
  const [colorPickerNoteId, setColorPickerNoteId] = useState<string | null>(null);

  const toggleScope = useCallback((scope: string) => {
    setCollapsedScopes((previous) => {
      const next = new Set(previous);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  }, []);

  return {
    deletePillConfirmId,
    setDeletePillConfirmId,
    deleteCardConfirmId,
    setDeleteCardConfirmId,
    searchQ,
    setSearchQ,
    selectedId,
    setSelectedId,
    selectMode,
    setSelectMode,
    bulkSelectedIds,
    setBulkSelectedIds,
    bulkDeleteConfirm,
    setBulkDeleteConfirm,
    collapsedScopes,
    toggleScope,
    tagFilter,
    setTagFilter,
    showEncPrompt,
    setShowEncPrompt,
    showHistory,
    setShowHistory,
    historyRef,
    showReminderPicker,
    setShowReminderPicker,
    reminderRef,
    reminderInput,
    setReminderInput,
    pendingReminders,
    setPendingReminders,
    refNoteId,
    setRefNoteId,
    showRefPanel,
    setShowRefPanel,
    showTemplates,
    setShowTemplates,
    templatesRef,
    colorPickerNoteId,
    setColorPickerNoteId,
  };
}
