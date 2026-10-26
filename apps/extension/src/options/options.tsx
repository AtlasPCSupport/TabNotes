import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '@tabnotes/ui';
import SidePanelApp from '../sidepanel/SidePanelApp';
import { useSidePanelStore } from '../sidepanel/store';
import { initI18n, resolveLanguage } from '@tabnotes/i18n';

// Synchronous fallback init; corrected on load from storage
initI18n(resolveLanguage(navigator.language));
useSidePanelStore.setState({ view: 'settings' });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary label="options page">
      <SidePanelApp />
    </ErrorBoundary>
  </React.StrictMode>
);
