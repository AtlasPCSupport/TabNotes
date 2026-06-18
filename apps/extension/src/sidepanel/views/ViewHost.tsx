import React from 'react';
import { ErrorBoundary } from '@tabnotes/ui';
import { useSidePanelStore } from '../store';
import { Note, NoteScope, PinHash, searchNotes, type MoveNoteTarget } from '@tabnotes/shared';
import type { Features, Theme, Align } from '../store/types';
import { ScopeOption } from './AllNotesView';

import EditorView from './EditorView';
import AllNotesView from './AllNotesView';
import ChatView from './ChatView';
import GraphView from './GraphView';
import SettingsView from './SettingsView';
import AboutView from './AboutView';
import ReferencePanel from '../components/ReferencePanel';

const SCOPE_OPTIONS: ScopeOption[] = [
  { value: 'url', label: 'URL', icon: 'url', desc: 'Exact page URL' },
  { value: 'domain', label: 'Domain', icon: 'domain', desc: 'Entire site' },
  { value: 'workspace', label: 'Projects', icon: 'workspace', desc: 'Your project' },
  { value: 'global', label: 'Global', icon: 'global', desc: 'Everywhere' },
];

export interface ViewHostProps {
  // Common context & URL info
  tabLoading: boolean;
  isRestrictedUrl: boolean;
  selectNote: (n: Note) => void;

  // EditorView props
  checklistMode: boolean;
  checklistItems: { id: string; checked: boolean; text: string }[];
  setChecklistItems: React.Dispatch<React.SetStateAction<{ id: string; checked: boolean; text: string }[]>>;
  toggleChecklistMode: () => void;
  saveChecklist: (items: { id: string; checked: boolean; text: string }[]) => void;
  editorRef: React.RefObject<HTMLDivElement>;
  onSetReminder: (ts: number) => Promise<void>;
  onClearReminder: () => Promise<void>;
  setShowReminderPicker: React.Dispatch<React.SetStateAction<boolean>>;
  setShowHistory: React.Dispatch<React.SetStateAction<boolean>>;
  showRefPanel: boolean;
  setShowRefPanel: React.Dispatch<React.SetStateAction<boolean>>;
  setShowEncPrompt: React.Dispatch<React.SetStateAction<'lock' | 'unlock' | null>>;
  insertDatetime: () => void;
  copyNote: () => Promise<void>;
  clipFeedback: boolean;
  focusMode: boolean;
  setFocusMode: React.Dispatch<React.SetStateAction<boolean>>;
  typewriterMode: boolean;
  setTypewriterMode: React.Dispatch<React.SetStateAction<boolean>>;
  colorPickerNoteId: string | null;
  setColorPickerNoteId: React.Dispatch<React.SetStateAction<string | null>>;
  onSetNoteColor: (id: string, color: string) => void;

  // ReferencePanel props
  refNoteId: string | null;
  setRefNoteId: React.Dispatch<React.SetStateAction<string | null>>;

  // AllNotesView props
  searchQ: string;
  setSearchQ: (v: string) => void;
  selectedId: string | null;
  setSelectedId: (v: string | null) => void;
  tagFilter: string | null;
  setTagFilter: (v: string | null) => void;
  selectMode: boolean;
  setSelectMode: (v: boolean) => void;
  bulkSelectedIds: Set<string>;
  setBulkSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  bulkDeleteConfirm: boolean;
  setBulkDeleteConfirm: (v: boolean) => void;
  collapsedScopes: Set<string>;
  toggleScope: (sc: string) => void;
  deleteCardConfirmId: string | null;
  setDeleteCardConfirmId: React.Dispatch<React.SetStateAction<string | null>>;
  deleteCardNote: (id: string) => Promise<void>;
  bulkDeleteNotes: () => Promise<void>;
  addNoteToContext: (folderName?: string) => Promise<void>;
  togglePin: (id: string) => void;

  // Additional EditorView props passed from monolith
  isUpdatingChecklistRef: React.MutableRefObject<boolean>;
  schedule: (c: string, t: string, tg: string) => void;
  showMovePicker: boolean;
  setShowMovePicker: (v: boolean) => void;
  moveNote: (noteId: string, target: MoveNoteTarget) => Promise<void>;
  copied: boolean;
  showHistory: boolean;
  historyRef: React.RefObject<HTMLDivElement>;
  showReminderPicker: boolean;
  reminderRef: React.RefObject<HTMLDivElement>;
  reminderInput: string;
  setReminderInput: (v: string) => void;
  exportCurrentNote: () => void;
  exportToPDF: () => void;
  captureScreenshot: () => void;

  // ChatView props
  groqKey: string;

  // SettingsView props
  toggleFeature: (key: keyof Features) => void;
  groqKeyInput: string;
  setGroqKeyInput: (val: string) => void;
  groqKeyVisible: boolean;
  setGroqKeyVisible: (updater: (v: boolean) => boolean) => void;
  saveGroqKey: (key: string) => void;
  setTheme: (theme: Theme) => Promise<void>;
  pinHash: PinHash | null;
  pinSetInput: string;
  setPinSetInput: (val: string) => void;
  pinSetConfirm: string;
  setPinSetConfirm: (val: string) => void;
  pinSetFeedback: string;
  savePin: () => void;
  removePin: () => void;
  lockNow: () => void;
  setMarkdown: (v: boolean) => Promise<void>;
  changeFontSize: (dir: 1 | -1) => void;
  setDefaultAlign: (align: Align) => void;
  setDefaultScope: (scope: NoteScope) => Promise<void>;
  digestEnabled: boolean;
  setDigestEnabled: (val: boolean) => void;
  digestTime: string;
  setDigestTime: (val: string) => void;
  saveDigest: (enabled: boolean, time: string) => void;
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
  handleExport: () => void;
  handleImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  importInputRef: React.RefObject<HTMLInputElement>;
  dataFeedback: { type: 'success' | 'error'; msg: string } | null;
  backupRemindDays: number;
  setBackupRemind: (days: number) => void;
  language: 'en' | 'es';
  setLanguage: (lng: 'en' | 'es') => Promise<void>;
}

export function ViewHost({
  tabLoading,
  isRestrictedUrl,
  selectNote,
  checklistMode,
  checklistItems,
  setChecklistItems,
  toggleChecklistMode,
  saveChecklist,
  editorRef,
  onSetReminder,
  onClearReminder,
  setShowReminderPicker,
  setShowHistory,
  showRefPanel,
  setShowRefPanel,
  setShowEncPrompt,
  insertDatetime,
  copyNote,
  clipFeedback,
  focusMode,
  setFocusMode,
  typewriterMode,
  setTypewriterMode,
  colorPickerNoteId,
  setColorPickerNoteId,
  onSetNoteColor,
  refNoteId,
  setRefNoteId,
  searchQ,
  setSearchQ,
  selectedId,
  setSelectedId,
  tagFilter,
  setTagFilter,
  selectMode,
  setSelectMode,
  bulkSelectedIds,
  setBulkSelectedIds,
  bulkDeleteConfirm,
  setBulkDeleteConfirm,
  collapsedScopes,
  toggleScope,
  deleteCardConfirmId,
  setDeleteCardConfirmId,
  deleteCardNote,
  bulkDeleteNotes,
  addNoteToContext,
  togglePin,
  isUpdatingChecklistRef,
  schedule,
  showMovePicker,
  setShowMovePicker,
  moveNote,
  copied,
  showHistory,
  historyRef,
  showReminderPicker,
  reminderRef,
  reminderInput,
  setReminderInput,
  exportCurrentNote,
  exportToPDF,
  captureScreenshot,
  groqKey,
  toggleFeature,
  groqKeyInput,
  setGroqKeyInput,
  groqKeyVisible,
  setGroqKeyVisible,
  saveGroqKey,
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
}: ViewHostProps) {
  const view = useSidePanelStore((s) => s.view);
  const setView = useSidePanelStore((s) => s.setView);

  const allNotes = useSidePanelStore((s) => s.allNotes);
  const activeWorkspaceId = useSidePanelStore((s) => s.activeWorkspaceId);
  const pinnedNotes = useSidePanelStore((s) => s.pinnedNotes);

  const workspaceAllNotes = allNotes.filter((n) => n.workspaceId === activeWorkspaceId);
  const allTags = [...new Set(workspaceAllNotes.flatMap((n) => n.tags))].sort();
  const filteredNotes = searchNotes(workspaceAllNotes, searchQ)
    .filter((n) => (tagFilter ? n.tags.includes(tagFilter) : true))
    .sort((a, b) => {
      const aPin = pinnedNotes.has(a.id) ? 0 : 1;
      const bPin = pinnedNotes.has(b.id) ? 0 : 1;
      return aPin - bPin || b.updatedAt - a.updatedAt;
    });

  const clearBulkSelection = () => {
    setBulkSelectedIds(new Set());
  };

  const selectAllInView = () => {
    if (bulkSelectedIds.size === filteredNotes.length) {
      setBulkSelectedIds(new Set());
    } else {
      setBulkSelectedIds(new Set(filteredNotes.map((n) => n.id)));
    }
  };

  return (
    <div className="sp-content">
      {/* Note editor */}
      {view === 'note' && (
        <ErrorBoundary label="editor view">
          <EditorView
            tabLoading={tabLoading}
            checklistMode={checklistMode}
            checklistItems={checklistItems}
            setChecklistItems={setChecklistItems}
            saveChecklist={saveChecklist}
            isUpdatingChecklistRef={isUpdatingChecklistRef}
            toggleChecklistMode={toggleChecklistMode}
            editorRef={editorRef}
            schedule={schedule}
            togglePin={togglePin}
            colorPickerNoteId={colorPickerNoteId}
            setColorPickerNoteId={setColorPickerNoteId}
            setNoteColor={onSetNoteColor}
            showMovePicker={showMovePicker}
            setShowMovePicker={setShowMovePicker}
            moveNote={moveNote}
            insertDatetime={insertDatetime}
            changeFontSize={changeFontSize}
            exportCurrentNote={exportCurrentNote}
            exportToPDF={exportToPDF}
            captureScreenshot={captureScreenshot}
            setShowEncPrompt={setShowEncPrompt}
            focusMode={focusMode}
            setFocusMode={setFocusMode}
            showRefPanel={showRefPanel}
            setShowRefPanel={setShowRefPanel}
            typewriterMode={typewriterMode}
            setTypewriterMode={setTypewriterMode}
            copied={copied}
            copyNote={copyNote}
            showHistory={showHistory}
            setShowHistory={setShowHistory}
            historyRef={historyRef}
            showReminderPicker={showReminderPicker}
            setShowReminderPicker={setShowReminderPicker}
            reminderRef={reminderRef}
            reminderInput={reminderInput}
            setReminderInput={setReminderInput}
            onSetReminder={onSetReminder}
            onClearReminder={onClearReminder}
            clipFeedback={clipFeedback}
            selectNote={selectNote}
          />
        </ErrorBoundary>
      )}

      {/* Reference panel */}
      {view === 'note' && showRefPanel && !isRestrictedUrl && (
        <ErrorBoundary label="reference panel">
          <ReferencePanel
            refNoteId={refNoteId}
            setRefNoteId={setRefNoteId}
            setShowRefPanel={setShowRefPanel}
          />
        </ErrorBoundary>
      )}

      {/* All notes */}
      {view === 'all' && (
        <ErrorBoundary label="all notes view">
          <AllNotesView
            scopeOptions={SCOPE_OPTIONS}
            filteredNotes={filteredNotes}
            allTags={allTags}
            searchQ={searchQ}
            setSearchQ={setSearchQ}
            tagFilter={tagFilter}
            setTagFilter={setTagFilter}
            selectMode={selectMode}
            setSelectMode={setSelectMode}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            bulkSelectedIds={bulkSelectedIds}
            setBulkSelectedIds={setBulkSelectedIds}
            clearBulkSelection={clearBulkSelection}
            bulkDeleteConfirm={bulkDeleteConfirm}
            setBulkDeleteConfirm={setBulkDeleteConfirm}
            deleteCardConfirmId={deleteCardConfirmId}
            setDeleteCardConfirmId={setDeleteCardConfirmId}
            collapsedScopes={collapsedScopes}
            toggleScope={toggleScope}
            onOpenNote={(n) => {
              selectNote(n);
              setView('note');
            }}
            onDeleteCard={deleteCardNote}
            onBulkDelete={bulkDeleteNotes}
            onCreateNote={async () => {
              await addNoteToContext();
              setView('note');
            }}
            selectAllInView={selectAllInView}
          />
        </ErrorBoundary>
      )}

      {/* Chat */}
      {view === 'chat' && (
        <ErrorBoundary label="chat view">
          <ChatView groqKey={groqKey} />
        </ErrorBoundary>
      )}

      {/* Graph view */}
      {view === 'graph' && (
        <ErrorBoundary label="graph view">
          <GraphView onSelectNote={selectNote} />
        </ErrorBoundary>
      )}

      {/* Settings */}
      {view === 'settings' && (
        <ErrorBoundary label="settings view">
          <SettingsView
            toggleFeature={toggleFeature}
            groqKey={groqKey}
            groqKeyInput={groqKeyInput}
            setGroqKeyInput={setGroqKeyInput}
            groqKeyVisible={groqKeyVisible}
            setGroqKeyVisible={setGroqKeyVisible}
            saveGroqKey={saveGroqKey}
            onOpenChat={() => setView('chat')}
            setTheme={setTheme}
            pinHash={pinHash}
            pinSetInput={pinSetInput}
            setPinSetInput={setPinSetInput}
            pinSetConfirm={pinSetConfirm}
            setPinSetConfirm={setPinSetConfirm}
            pinSetFeedback={pinSetFeedback}
            savePin={savePin}
            removePin={removePin}
            lockNow={lockNow}
            setMarkdown={setMarkdown}
            changeFontSize={changeFontSize}
            setDefaultAlign={setDefaultAlign}
            setDefaultScope={setDefaultScope}
            digestEnabled={digestEnabled}
            setDigestEnabled={setDigestEnabled}
            digestTime={digestTime}
            setDigestTime={setDigestTime}
            saveDigest={saveDigest}
            editWsName={editWsName}
            setEditWsName={setEditWsName}
            editWsColor={editWsColor}
            setEditWsColor={setEditWsColor}
            newWsNameInput={newWsNameInput}
            setNewWsNameInput={setNewWsNameInput}
            newWsColorInput={newWsColorInput}
            setNewWsColorInput={setNewWsColorInput}
            onSetActiveWorkspace={onSetActiveWorkspace}
            onUpdateWorkspace={onUpdateWorkspace}
            onDeleteWorkspace={onDeleteWorkspace}
            onCreateWorkspace={onCreateWorkspace}
            handleExport={handleExport}
            handleImport={handleImport}
            importInputRef={importInputRef}
            dataFeedback={dataFeedback}
            backupRemindDays={backupRemindDays}
            setBackupRemind={setBackupRemind}
            language={language}
            setLanguage={setLanguage}
          />
        </ErrorBoundary>
      )}

      {/* About */}
      {view === 'about' && (
        <ErrorBoundary label="about view">
          <AboutView />
        </ErrorBoundary>
      )}
    </div>
  );
}

export default ViewHost;
