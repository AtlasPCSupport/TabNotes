import React, { useState, MutableRefObject } from 'react';

export interface ChecklistItem {
  id: string;
  checked: boolean;
  text: string;
}

export interface ChecklistEditorProps {
  checklistItems: ChecklistItem[];
  setChecklistItems: (items: ChecklistItem[]) => void;
  saveChecklist: (items: ChecklistItem[]) => void;
  isUpdatingChecklistRef: MutableRefObject<boolean>;
}

export function ChecklistEditor({
  checklistItems,
  setChecklistItems,
  saveChecklist,
  isUpdatingChecklistRef,
}: ChecklistEditorProps) {
  const [showCompletedList, setShowCompletedList] = useState(true);
  const [draggedChecklistIndex, setDraggedChecklistIndex] = useState<number | null>(null);

  const handleItemCheckChange = (index: number, checked: boolean) => {
    const newItems = [...checklistItems];
    newItems[index].checked = checked;
    setChecklistItems(newItems);
    saveChecklist(newItems);
  };

  const handleItemTextChange = (index: number, text: string) => {
    const newItems = [...checklistItems];
    newItems[index].text = text;
    setChecklistItems(newItems);
    saveChecklist(newItems);
  };

  const handleItemDelete = (index: number) => {
    const newItems = [...checklistItems];
    newItems.splice(index, 1);
    setChecklistItems(newItems);
    saveChecklist(newItems);
  };

  const handleItemKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newItems = [...checklistItems];
      const newItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        checked: false,
        text: '',
      };
      newItems.splice(index + 1, 0, newItem);
      setChecklistItems(newItems);
      saveChecklist(newItems);

      setTimeout(() => {
        const inputs = document.querySelectorAll('.sp-checklist-input') as NodeListOf<HTMLInputElement>;
        if (inputs[index + 1]) {
          inputs[index + 1].focus();
        }
      }, 50);
    } else if (e.key === 'Backspace' && e.currentTarget.value === '') {
      e.preventDefault();
      const newItems = [...checklistItems];
      newItems.splice(index, 1);
      setChecklistItems(newItems);
      saveChecklist(newItems);

      setTimeout(() => {
        const inputs = document.querySelectorAll('.sp-checklist-input') as NodeListOf<HTMLInputElement>;
        if (index > 0 && inputs[index - 1]) {
          inputs[index - 1].focus();
          const val = inputs[index - 1].value;
          inputs[index - 1].setSelectionRange(val.length, val.length);
        } else if (inputs.length > 0) {
          inputs[0].focus();
        }
      }, 50);
    }
  };

  const handleItemDragStart = (e: React.DragEvent, index: number) => {
    setDraggedChecklistIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleItemDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedChecklistIndex === null || draggedChecklistIndex === index) return;

    const newItems = [...checklistItems];
    const draggedItem = newItems[draggedChecklistIndex];
    newItems.splice(draggedChecklistIndex, 1);
    newItems.splice(index, 0, draggedItem);

    setDraggedChecklistIndex(index);
    setChecklistItems(newItems);
  };

  const handleItemDragEnd = () => {
    setDraggedChecklistIndex(null);
    saveChecklist(checklistItems);
  };

  return (
    <div className="sp-checklist-container">
      {checklistItems.filter((it) => !it.checked).map((item) => {
        const absoluteIndex = checklistItems.findIndex((it) => it.id === item.id);
        return (
          <div
            key={item.id}
            className="sp-checklist-row"
            draggable
            onDragStart={(e) => handleItemDragStart(e, absoluteIndex)}
            onDragOver={(e) => handleItemDragOver(e, absoluteIndex)}
            onDragEnd={handleItemDragEnd}
          >
            <div className="sp-checklist-drag-handle">⠿</div>
            <input
              type="checkbox"
              className="sp-checklist-checkbox"
              checked={false}
              onChange={(e) => handleItemCheckChange(absoluteIndex, e.target.checked)}
            />
            <input
              type="text"
              className="sp-checklist-input"
              value={item.text}
              onChange={(e) => handleItemTextChange(absoluteIndex, e.target.value)}
              onKeyDown={(e) => handleItemKeyDown(e, absoluteIndex)}
              placeholder="Elemento de la lista"
            />
            <button
              className="sp-checklist-delete"
              onClick={() => handleItemDelete(absoluteIndex)}
            >
              ✕
            </button>
          </div>
        );
      })}

      <div className="sp-checklist-add-row">
        <div className="sp-checklist-add-icon">+</div>
        <input
          type="text"
          className="sp-checklist-add-input"
          placeholder="Elemento de la lista"
          onChange={(e) => {
            const val = e.target.value;
            if (!val) return;

            const newItem = {
              id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              checked: false,
              text: val,
            };
            const newItems = [...checklistItems, newItem];

            setChecklistItems(newItems);
            if (isUpdatingChecklistRef) {
              isUpdatingChecklistRef.current = true;
            }
            saveChecklist(newItems);

            setTimeout(() => {
              const inputs = document.querySelectorAll(
                '.sp-checklist-input'
              ) as NodeListOf<HTMLInputElement>;
              if (inputs.length > 0) {
                const lastInput = inputs[inputs.length - 1];
                lastInput.focus();
                e.target.value = '';
              }
            }, 50);
          }}
        />
      </div>

      {checklistItems.filter((it) => it.checked).length > 0 && (
        <div className="sp-checklist-completed-section">
          <button
            className="sp-checklist-completed-header"
            onClick={() => setShowCompletedList(!showCompletedList)}
          >
            <span
              className={`sp-checklist-completed-arrow${showCompletedList ? ' open' : ''}`}
            >
              ▶
            </span>
            <span>
              Elementos completados ({checklistItems.filter((it) => it.checked).length})
            </span>
          </button>

          {showCompletedList && (
            <div className="sp-checklist-completed-list">
              {checklistItems.filter((it) => it.checked).map((item) => {
                const absoluteIndex = checklistItems.findIndex((it) => it.id === item.id);
                return (
                  <div
                    key={item.id}
                    className="sp-checklist-row completed"
                    draggable
                    onDragStart={(e) => handleItemDragStart(e, absoluteIndex)}
                    onDragOver={(e) => handleItemDragOver(e, absoluteIndex)}
                    onDragEnd={handleItemDragEnd}
                  >
                    <div className="sp-checklist-drag-handle">⠿</div>
                    <input
                      type="checkbox"
                      className="sp-checklist-checkbox"
                      checked={true}
                      onChange={(e) => handleItemCheckChange(absoluteIndex, e.target.checked)}
                    />
                    <input
                      type="text"
                      className="sp-checklist-input checked"
                      value={item.text}
                      onChange={(e) => handleItemTextChange(absoluteIndex, e.target.value)}
                      onKeyDown={(e) => handleItemKeyDown(e, absoluteIndex)}
                      placeholder="Elemento de la lista"
                    />
                    <button
                      className="sp-checklist-delete"
                      onClick={() => handleItemDelete(absoluteIndex)}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ChecklistEditor;
