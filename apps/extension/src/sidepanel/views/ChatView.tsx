import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Note, stripFormatting } from '@tabnotes/shared';
import { useSidePanelStore } from '../store';
import { AppIcon } from '../components/AppIcon';
import { useTranslation } from '@tabnotes/i18n';

export type ChatMsg = { role: 'user' | 'assistant'; content: string };

/**
 * AI chat (RAG) view. Reads view-context bits from the store; chat state and
 * the `sendChat` handler are encapsulated locally.
 */
export function ChatView({
  groqKey,
}: {
  groqKey: string;
}) {
  const { t } = useTranslation();
  const allNotes = useSidePanelStore((s) => s.allNotes);
  const currentDomain = useSidePanelStore((s) => s.currentDomain);
  const setView = useSidePanelStore((s) => s.setView);
  const setSettingsTarget = useSidePanelStore((s) => s.setSettingsTarget);
  const view = useSidePanelStore((s) => s.view);

  // Local chat states
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatScope, setChatScope] = useState<'domain' | 'all'>('domain');

  // Local chat refs
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // RAG note ranking logic
  const rankNotes = useCallback((notes: Note[], query: string): Note[] => {
    if (!query.trim()) return [...notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 12);
    const words = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);
    return [...notes]
      .map((n) => {
        const text = `${n.title ?? ''} ${n.content}`.toLowerCase();
        const score = words.reduce((s, w) => s + (text.split(w).length - 1), 0);
        return { note: n, score };
      })
      .sort((a, b) => b.score - a.score || b.note.updatedAt - a.note.updatedAt)
      .slice(0, 10)
      .map((x) => x.note);
  }, []);

  const sendChat = useCallback(async () => {
    const q = chatInput.trim();
    if (!q || chatLoading) return;
    if (!groqKey) {
      setChatMessages((m) => [
        ...m,
        { role: 'assistant', content: `⚠ ${t('chat.missingKeyMessage')}` },
      ]);
      return;
    }
    const pool =
      chatScope === 'domain'
        ? allNotes.filter((n) => n.scope === 'domain' && n.scopeKey === currentDomain)
        : allNotes;
    const relevant = rankNotes(pool, q);
    const scopeLabel =
      chatScope === 'domain'
        ? currentDomain
          ? t('chat.scopeDomain', { domain: currentDomain })
          : t('chat.scopeCurrentSite')
        : t('chat.scopeAll');
    const contextStr =
      relevant.length > 0
        ? relevant
            .map((n) => `### ${n.title || t('chat.untitled')}\n${stripFormatting(n.content).slice(0, 800)}`)
            .join('\n\n---\n\n')
        : t('chat.noNotesFound');
    const system = t('chat.systemPrompt', { scope: scopeLabel, context: contextStr });

    const userMsg = { role: 'user' as const, content: q };
    setChatMessages((m) => [...m, userMsg, { role: 'assistant', content: '' }]);
    setChatInput('');
    setChatLoading(true);

    try {
      const history = [...chatMessages, userMsg].slice(-8);
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: system },
            ...history.map((m) => ({ role: m.role, content: m.content })),
          ],
          stream: true,
          max_tokens: 1024,
          temperature: 0.3,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        setChatMessages((m) => {
          const n = [...m];
          n[n.length - 1] = {
            role: 'assistant',
            content: `❌ API error ${res.status}: ${errText.slice(0, 120)}`,
          };
          return n;
        });
        setChatLoading(false);
        return;
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let full = '';
      let streamDone = false;
      while (!streamDone) {
        const { done, value } = await reader.read();
        streamDone = done;
        if (done) continue;
        const lines = decoder
          .decode(value)
          .split('\n')
          .filter((l) => l.startsWith('data: ') && !l.includes('[DONE]'));
        for (const line of lines) {
          try {
            const delta = JSON.parse(line.slice(6)).choices?.[0]?.delta?.content;
            if (delta) {
              full += delta;
              setChatMessages((m) => {
                const n = [...m];
                n[n.length - 1] = { role: 'assistant', content: full };
                return n;
              });
            }
          } catch {
            /* skip malformed chunk */
          }
        }
      }
    } catch (e) {
      setChatMessages((m) => {
        const n = [...m];
        n[n.length - 1] = { role: 'assistant', content: `❌ ${String(e)}` };
        return n;
      });
    }
    setChatLoading(false);
  }, [
    chatInput,
    chatLoading,
    groqKey,
    chatScope,
    allNotes,
    currentDomain,
    chatMessages,
    rankNotes,
    t,
  ]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (view === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, view]);

  return (
    <div className="sp-chat-view">
      {/* Scope toggle + note count */}
      <div className="sp-chat-topbar">
        <div className="sp-chat-scope-toggle">
          <button
            className={`sp-chat-scope-btn${chatScope === 'domain' ? ' active' : ''}`}
            onClick={() => setChatScope('domain')}
            title={t('chat.domainTitle')}
          >
            <AppIcon name="domain" size={13} /> {currentDomain || t('chat.domainFallback')}
          </button>
          <button
            className={`sp-chat-scope-btn${chatScope === 'all' ? ' active' : ''}`}
            onClick={() => setChatScope('all')}
            title={t('chat.allTitle')}
          >
            <AppIcon name="global" size={13} /> {t('chat.allNotes')}
          </button>
        </div>
        <span className="sp-chat-ctx-count">
          {(() => {
            const pool =
              chatScope === 'domain'
                ? allNotes.filter((n: Note) => n.scope === 'domain' && n.scopeKey === currentDomain)
                : allNotes;
            return t('chat.contextCount', { count: pool.length });
          })()}
        </span>
      </div>

      {/* Messages */}
      <div className="sp-chat-messages">
        {chatMessages.length === 0 && (
          <div className="sp-chat-empty">
            {!groqKey ? (
              <div className="sp-chat-no-key">
                <span className="sp-chat-no-key-icon">
                  <AppIcon name="key" size={32} />
                </span>
                <p>{t('chat.missingKeyBody')}</p>
                <button
                  className="sp-chat-goto-settings"
                  onClick={() => {
                    setSettingsTarget('ai');
                    setView('settings');
                  }}
                >
                  {t('chat.openSettings')}
                </button>
              </div>
            ) : (
              <div className="sp-chat-hint">
                <span className="sp-chat-hint-icon">
                  <AppIcon name="chat" size={30} />
                </span>
                <p>{t('chat.hint')}</p>
                <div className="sp-chat-examples">
                  {[
                    t('chat.exampleIdeas'),
                    t('chat.exampleSummary'),
                    t('chat.exampleFollowUp'),
                  ].map((ex) => (
                    <button
                      key={ex}
                      className="sp-chat-example"
                      onClick={() => {
                        setChatInput(ex);
                        chatInputRef.current?.focus();
                      }}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {chatMessages.map((msg, i) => (
          <div key={i} className={`sp-chat-msg sp-chat-msg-${msg.role}`}>
            <div className="sp-chat-bubble">
              {msg.content ||
                (msg.role === 'assistant' && chatLoading && i === chatMessages.length - 1 ? (
                  <span className="sp-chat-typing">
                    <span />
                    <span />
                    <span />
                  </span>
                ) : null)}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input row */}
      <div className="sp-chat-input-row">
        <input
          ref={chatInputRef}
          className="sp-chat-input"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendChat();
            }
          }}
          placeholder={t('chat.placeholder')}
          disabled={chatLoading}
          autoComplete="off"
        />
        <button
          className="sp-chat-send"
          onClick={sendChat}
          disabled={chatLoading || !chatInput.trim()}
          title={t('chat.sendTitle')}
        >
          {chatLoading ? '…' : <AppIcon name="send" size={14} />}
        </button>
      </div>

      {chatMessages.length > 0 && (
        <button className="sp-chat-clear" onClick={() => setChatMessages([])}>
          {t('chat.clearChat')}
        </button>
      )}
    </div>
  );
}

export default ChatView;
