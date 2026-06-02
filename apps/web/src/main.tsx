import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from '@tabnotes/ui';
import App from './App';
import './index.css';
import { initI18n, resolveLanguage } from '@tabnotes/i18n';

// Synchronous fallback init; corrected on load from storage/localStorage
initI18n(resolveLanguage(navigator.language));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary label="app">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
