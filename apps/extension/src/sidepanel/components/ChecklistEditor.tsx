import React, { useRef, useState } from 'react';
import { useTranslation } from '@tabnotes/i18n';
import type { ChecklistItem } from '@tabnotes/shared';
import { AppIcon } from './AppIcon';

export type { ChecklistItem } from '@tabnotes/shared';

export interface ChecklistEditorProps {
  checklistItems: ChecklistItem[];
  setChecklistItems: (items: ChecklistItem[]) => void;
  saveChecklist: (items: ChecklistItem[]) => void;
  disabled?: boolean;
}

function newChecklistItem(text = ''): ChecklistItem {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    checked: false,
    text,
  };
}

export function ChecklistEditor({
  checklistItems,
  setChecklistItems,
  saveChecklist,
  disabled = false,
}: ChecklistEditorProps) {
  const { t } = useTranslation();
  const [showCompletedList, setShowCompletedList] = useState(true);
  const draggedChecklistIndexRef = useRef<number | null>(null);
  const inputRefs = useRef(new Map<string, HTMLInputElement>());
  const latestItemsRef = useRef(checklistItems);
  latestItemsRef.current = checklistItems;

  const commit = (items: ChecklistItem[]) => {
    setChecklistItems(items);
    saveChecklist(items);
  };

  const focusItem = (id: string, caretAtEnd = false) => {
    requestAnimationFrame(() => {
      const input = inputRefs.current.get(id);
      input?.focus();
      if (caretAtEnd && input) {
        input.setSelectionRange(input.value.length, input.value.length);
      }
    });
  };

  const updateItem = (index: number, changes: Partial<ChecklistItem>) => {
    const items = checklistItems.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...changes } : item
    );
    commit(items);
  };

  const deleteItem = (index: number) => {
    const previousId = checklistItems[index - 1]?.id;
    const nextId = checklistItems[index + 1]?.id;
    commit(checklistItems.filter((_, itemIndex) => itemIndex !== index));
    if (previousId) focusItem(previousId, true);
    else if (nextId) focusItem(nextId);
  };

  const handleItemKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const item = newChecklistItem();
      const items = [...checklistItems];
      items.splice(index + 1, 0, item);
      commit(items);
      focusItem(item.id);
      return;
    }

    if (event.key === 'Backspace' && event.currentTarget.value === '') {
      event.preventDefault();
      deleteItem(index);
    }
  };

  const handleItemDragStart = (event: React.DragEvent, index: number) => {
    draggedChecklistIndexRef.current = index;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', checklistItems[index].id);
  };

  const handleItemDragOver = (event: React.DragEvent, index: number) => {
    const draggedIndex = draggedChecklistIndexRef.current;
    if (draggedIndex === null || draggedIndex === index) return;

    const items = [...latestItemsRef.current];
    const draggedItem = items[draggedIndex];
    const targetItem = items[index];
    // Active and completed rows are rendered as separate groups. Do not allow a
    // cross-group drop that would appear to succeed before snapping back.
    if (!draggedItem || !targetItem || draggedItem.checked !== targetItem.checked) return;

    event.preventDefault();
    items.splice(draggedIndex, 1);
    items.splice(index, 0, draggedItem);
    draggedChecklistIndexRef.current = index;
    // React state updates are asynchronous, so retain this order for drag end.
    latestItemsRef.current = items;
    setChecklistItems(items);
  };

  const handleItemDragEnd = () => {
    const didDrag = draggedChecklistIndexRef.current !== null;
    draggedChecklistIndexRef.current = null;
    if (didDrag) saveChecklist(latestItemsRef.current);
  };

  const handleItemDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const didDrag = draggedChecklistIndexRef.current !== null;
    draggedChecklistIndexRef.current = null;
    if (didDrag) saveChecklist(latestItemsRef.current);
  };

  const renderItem = (item: ChecklistItem, index: number) => (
    <div
      key={item.id}
      className={`sp-checklist-row${item.checked ? ' completed' : ''}`}
      draggable={!disabled}
      onDragStart={(event) => handleItemDragStart(event, index)}
      onDragOver={(event) => handleItemDragOver(event, index)}
      onDrop={handleItemDrop}
      onDragEnd={handleItemDragEnd}
    >
      <div className="sp-checklist-drag-handle" aria-hidden="true">
        <AppIcon name="grip" size={13} />
      </div>
      <input
        type="checkbox"
        className="sp-checklist-checkbox"
        checked={item.checked}
        disabled={disabled}
        aria-label={item.checked ? t('checklist.markIncomplete') : t('checklist.markComplete')}
        onChange={(event) => updateItem(index, { checked: event.target.checked })}
      />
      <input
        ref={(element) => {
          if (element) inputRefs.current.set(item.id, element);
          else inputRefs.current.delete(item.id);
        }}
        type="text"
        className={`sp-checklist-input${item.checked ? ' checked' : ''}`}
        value={item.text}
        disabled={disabled}
        onChange={(event) => updateItem(index, { text: event.target.value })}
        onKeyDown={(event) => handleItemKeyDown(event, index)}
        placeholder={t('checklist.itemPlaceholder')}
        aria-label={t('checklist.itemPlaceholder')}
      />
      <button
        type="button"
        className="sp-checklist-delete"
        disabled={disabled}
        onClick={() => deleteItem(index)}
        aria-label={t('checklist.deleteItem')}
        title={t('checklist.deleteItem')}
      >
        <AppIcon name="close" size={12} />
      </button>
    </div>
  );

  const activeItems = checklistItems
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !item.checked);
  const completedItems = checklistItems
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.checked);

  return (
    <div className="sp-checklist-container">
      <div className="sp-checklist-list">
        {activeItems.map(({ item, index }) => renderItem(item, index))}
      </div>

      <div className="sp-checklist-add-row">
        <div className="sp-checklist-add-icon" aria-hidden="true">
          <AppIcon name="plus" size={14} />
        </div>
        <input
          type="text"
          className="sp-checklist-add-input"
          disabled={disabled}
          placeholder={t('checklist.itemPlaceholder')}
          aria-label={t('checklist.addItem')}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            const text = event.currentTarget.value.trim();
            if (!text) return;
            const item = newChecklistItem(text);
            commit([...checklistItems, item]);
            event.currentTarget.value = '';
            focusItem(item.id);
          }}
          onBlur={(event) => {
            const text = event.currentTarget.value.trim();
            if (!text) return;
            const item = newChecklistItem(text);
            commit([...checklistItems, item]);
            event.currentTarget.value = '';
          }}
        />
      </div>

      {completedItems.length > 0 && (
        <div className="sp-checklist-completed-section">
          <button
            type="button"
            className="sp-checklist-completed-header"
            onClick={() => setShowCompletedList((show) => !show)}
            aria-expanded={showCompletedList}
          >
            <span className={`sp-checklist-completed-arrow${showCompletedList ? ' open' : ''}`}>
              <AppIcon name="chevronRight" size={13} />
            </span>
            <span>{t('checklist.completed', { count: completedItems.length })}</span>
          </button>

          {showCompletedList && (
            <div className="sp-checklist-completed-list">
              {completedItems.map(({ item, index }) => renderItem(item, index))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ChecklistEditor;
