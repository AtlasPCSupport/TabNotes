import React from 'react';
import { useSidePanelStore } from '../store';
import { ICONS } from '../icons';

/** Static About screen. Extracted verbatim (Task 5.2) — no behavior change. */
export function AboutView() {
  const setView = useSidePanelStore((s) => s.setView);

  return (
    <div className="sp-settings-view">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => setView('settings')}
          style={{
            padding: '4px 10px',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--border)',
            background: 'var(--bg-subtle)',
            color: 'var(--text-muted)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <span
          style={{
            fontWeight: 700,
            fontSize: 15,
            color: 'var(--text)',
            letterSpacing: '-0.3px',
          }}
        >
          About TabNotes
        </span>
      </div>

      <div style={{ textAlign: 'center', padding: '16px 0 20px' }}>
        <div
          style={{
            width: 48,
            height: 48,
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 22,
            fontWeight: 800,
            margin: '0 auto 12px',
            boxShadow: '0 4px 16px rgba(37,99,235,0.3)',
          }}
        >
          T
        </div>
        <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.4px', marginBottom: 6 }}>
          TabNotes
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            lineHeight: 1.5,
            maxWidth: 240,
            margin: '0 auto',
          }}
        >
          Premium local-first notes for every tab, URL, domain, and workspace.
        </div>
      </div>

      {[
        {
          title: 'Editor',
          icon: ICONS.typewriter,
          color: '#2b5be8',
          items: [
            'WYSIWYG rich text (B / I / U / S / Code / Highlight)',
            'Markdown preview (toggle ↓md)',
            'Typewriter mode',
            'Text alignment & font size',
            'Date/time stamp (Ctrl+D)',
            'Keyboard shortcuts',
          ],
        },
        {
          title: 'Organization',
          icon: ICONS.folder,
          color: '#0ea5e9',
          items: [
            '4 scopes: URL · Domain · Projects · Global',
            'Multiple notes per scope (pills)',
            'Workspaces & folders',
            'Tags, pin notes & note colors',
          ],
        },
        {
          title: 'Productivity',
          icon: ICONS.spark,
          color: '#f59e0b',
          items: [
            'Templates (Daily Log, Meeting, Todo, Standup)',
            'Wiki links [[note]] with autocomplete',
            'Command palette Ctrl+K',
            'Web clipper',
            'Writing streak tracker',
            'Reminders & Daily digest',
          ],
        },
        {
          title: 'Intelligence',
          icon: ICONS.graph,
          color: '#8b5cf6',
          items: [
            'Smart suggestions while you write',
            'AI Chat powered by Groq',
            'Note graph visualization',
          ],
        },
        {
          title: 'Data & Privacy',
          icon: ICONS.shield,
          color: '#22c55e',
          items: [
            'Auto note history & restore',
            'Export .md · Import/export JSON',
            'AES-256 note encryption',
            'Local-first — no server, no account',
            'Open source (MIT)',
          ],
        },
      ].map((cat) => (
        <div key={cat.title} className="sp-settings-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 7,
                background: cat.color + '20',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {cat.icon}
            </div>
            <span
              style={{
                fontWeight: 700,
                fontSize: 12,
                color: 'var(--text)',
                letterSpacing: '-0.2px',
              }}
            >
              {cat.title}
            </span>
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {cat.items.map((item) => (
              <li
                key={item}
                style={{
                  fontSize: 11.5,
                  color: 'var(--text-muted)',
                  lineHeight: 1.7,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 6,
                }}
              >
                <span style={{ color: cat.color, marginTop: 1, flexShrink: 0 }}>•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
        <a
          href="https://github.com/mikepchelper-spec/TabNotes"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            padding: '10px',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--border)',
            background: 'var(--bg-subtle)',
            color: 'var(--text-muted)',
            fontSize: 12,
            fontWeight: 500,
            textDecoration: 'none',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)';
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
          </svg>
          View on GitHub
        </a>
        <div
          style={{
            textAlign: 'center',
            fontSize: 10.5,
            color: 'var(--text-subtle)',
            paddingBottom: 4,
          }}
        >
          MIT license · No account · No tracking
        </div>
      </div>
    </div>
  );
}

export default AboutView;
