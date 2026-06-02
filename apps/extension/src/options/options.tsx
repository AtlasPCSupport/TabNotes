import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '@tabnotes/ui';
import OptionsApp from './OptionsApp';
import { initI18n, resolveLanguage } from '@tabnotes/i18n';

// Synchronous fallback init; corrected on load from storage
initI18n(resolveLanguage(navigator.language));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary label="options page">
      <OptionsApp />
    </ErrorBoundary>
  </React.StrictMode>
);
