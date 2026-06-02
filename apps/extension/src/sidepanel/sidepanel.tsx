import React from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '@tabnotes/ui';
import SidePanelApp from './SidePanelApp';
import { initI18n, resolveLanguage } from '@tabnotes/i18n';

// Synchronous fallback init; corrected on load from storage
initI18n(resolveLanguage(navigator.language));

const root = document.getElementById('root')!;
createRoot(root).render(
  <ErrorBoundary label="side panel">
    <SidePanelApp />
  </ErrorBoundary>
);
