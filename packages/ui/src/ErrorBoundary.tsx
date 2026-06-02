import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Label shown in the fallback, e.g. "side panel". */
  label?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render-time errors in its subtree and shows a recoverable fallback
 * instead of unmounting the whole app to a blank screen. Critical for the
 * extension surfaces, where a single render error would otherwise leave the
 * user with an empty panel and no way to recover their notes.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Surface the error for debugging. Note bodies are never logged here.
    // eslint-disable-next-line no-console
    console.error('TabNotes render error', error, info.componentStack);
  }

  private handleReload = (): void => {
    this.setState({ hasError: false, error: null });
    if (typeof location !== 'undefined') location.reload();
  };

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;

    const wrap: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
      padding: 24,
      minHeight: 200,
      height: '100%',
      boxSizing: 'border-box',
      fontFamily: 'var(--font-sans, system-ui, sans-serif)',
      color: 'var(--color-text, #e0def4)',
      textAlign: 'center',
    };
    const btn: React.CSSProperties = {
      border: 'none',
      borderRadius: 8,
      padding: '8px 16px',
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
      background: 'var(--color-accent, #2f6dff)',
      color: '#fff',
    };

    return (
      <div style={wrap} role="alert">
        <div style={{ fontSize: 30, lineHeight: 1 }}>⚠️</div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>
          Something went wrong{this.props.label ? ` in the ${this.props.label}` : ''}.
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, maxWidth: 320 }}>
          Your notes are safe and stored locally. Reloading usually fixes this.
        </div>
        <button type="button" style={btn} onClick={this.handleReload}>
          Reload
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
