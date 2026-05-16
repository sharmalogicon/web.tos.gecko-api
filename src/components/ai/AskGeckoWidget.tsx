"use client";

/**
 * Ask Gecko — floating AI assist widget.
 *
 * FAB anchored bottom-right; clicking it opens a 420×620 chat panel. Welcome
 * state shows suggestion chips; user messages render right-aligned in primary,
 * assistant replies left-aligned with the bot avatar. Inline CTAs navigate via
 * Link; suggested follow-ups appear as chips below assistant messages.
 *
 * Phase 1 (demo): replies come from dispatchAskGecko() — deterministic
 * intent matching, see src/lib/ask-gecko-intents.ts.
 * Phase 2 (production): swap the dispatch call for Gecko.AI.Service.AskGecko.
 * UI does not change. See docs/08-AI-STRATEGY.md.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Icon } from '../ui/Icon';
import {
  dispatchAskGecko,
  WELCOME_SUGGESTIONS,
  WELCOME_TEXT,
  type AssistantReply,
} from '@/lib/ask-gecko-intents';

interface UserMessage {
  id: string;
  role: 'user';
  text: string;
}

interface AssistantMessage {
  id: string;
  role: 'assistant';
  reply: AssistantReply;
}

type ChatMessage = UserMessage | AssistantMessage;

function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

// Lightweight inline-markdown renderer. We only honour **bold** because the
// intent replies use it for entity highlighting; everything else stays plain.
function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const lines = text.split('\n');
  lines.forEach((line, lineIdx) => {
    const segments = line.split(/(\*\*[^*]+\*\*)/g);
    segments.forEach((seg, segIdx) => {
      if (seg.startsWith('**') && seg.endsWith('**')) {
        parts.push(<strong key={`${lineIdx}-${segIdx}`}>{seg.slice(2, -2)}</strong>);
      } else if (seg.length) {
        parts.push(<React.Fragment key={`${lineIdx}-${segIdx}`}>{seg}</React.Fragment>);
      }
    });
    if (lineIdx < lines.length - 1) {
      parts.push(<br key={`br-${lineIdx}`} />);
    }
  });
  return parts;
}

export function AskGeckoWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to newest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing, open]);

  // Focus input when panel opens
  useEffect(() => {
    if (open && inputRef.current) {
      const id = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(id);
    }
  }, [open]);

  // ESC closes the panel
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const ask = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setMessages(prev => [...prev, { id: uid(), role: 'user', text: trimmed }]);
    setInput('');
    setTyping(true);

    // Variable delay (0.6–1.2s) simulates LLM latency — feels alive, doesn't
    // feel laggy. When Phase 2 lands, the real network call replaces this
    // and the typing indicator stays in place naturally.
    const delay = 600 + Math.random() * 600;
    setTimeout(() => {
      const reply = dispatchAskGecko(trimmed);
      setMessages(prev => [...prev, { id: uid(), role: 'assistant', reply }]);
      setTyping(false);
    }, delay);
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    ask(input);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ask(input);
    }
  };

  return (
    <>
      {/* Floating action button — anchored bottom-right */}
      <button
        type="button"
        className={`gecko-ai-fab${open ? ' gecko-ai-fab-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close Ask Gecko' : 'Open Ask Gecko'}
        aria-expanded={open}
      >
        {open ? (
          <Icon name="x" size={22} />
        ) : (
          <>
            <Icon name="sparkles" size={20} />
            <span className="gecko-ai-fab-label">Ask Gecko</span>
          </>
        )}
      </button>

      {open && (
        <div className="gecko-ai-panel" role="dialog" aria-label="Ask Gecko assistant">
          {/* Header */}
          <div className="gecko-ai-panel-header">
            <div className="gecko-ai-panel-avatar">
              <Icon name="sparkles" size={16} />
            </div>
            <div className="gecko-ai-panel-title-block">
              <div className="gecko-ai-panel-title">Ask Gecko</div>
              <div className="gecko-ai-panel-subtitle">
                <span className="gecko-ai-status-dot" />
                AI · Demo
              </div>
            </div>
            <button
              type="button"
              className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <Icon name="x" size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="gecko-ai-panel-body" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="gecko-ai-welcome">
                <div className="gecko-ai-message-assistant">
                  <div className="gecko-ai-bot-avatar">
                    <Icon name="sparkles" size={14} />
                  </div>
                  <div className="gecko-ai-bubble gecko-ai-bubble-assistant">
                    {renderInlineMarkdown(WELCOME_TEXT)}
                  </div>
                </div>
                <div className="gecko-ai-suggestion-list">
                  {WELCOME_SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      type="button"
                      className="gecko-ai-suggestion-chip"
                      onClick={() => ask(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => {
              if (msg.role === 'user') {
                return (
                  <div key={msg.id} className="gecko-ai-message-user">
                    <div className="gecko-ai-bubble gecko-ai-bubble-user">{msg.text}</div>
                  </div>
                );
              }
              return (
                <div key={msg.id} className="gecko-ai-message-assistant">
                  <div className="gecko-ai-bot-avatar">
                    <Icon name="sparkles" size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="gecko-ai-bubble gecko-ai-bubble-assistant">
                      {renderInlineMarkdown(msg.reply.text)}
                    </div>

                    {msg.reply.ctas && msg.reply.ctas.length > 0 && (
                      <div className="gecko-ai-cta-row">
                        {msg.reply.ctas.map((cta, i) => (
                          <Link
                            key={i}
                            href={cta.href}
                            className="gecko-ai-inline-cta"
                            onClick={() => setOpen(false)}
                          >
                            {cta.label}
                            <Icon name="arrowRight" size={12} />
                          </Link>
                        ))}
                      </div>
                    )}

                    {msg.reply.followUps && msg.reply.followUps.length > 0 && (
                      <div className="gecko-ai-followup-row">
                        {msg.reply.followUps.map(f => (
                          <button
                            key={f}
                            type="button"
                            className="gecko-ai-suggestion-chip gecko-ai-suggestion-chip-sm"
                            onClick={() => ask(f)}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {typing && (
              <div className="gecko-ai-message-assistant">
                <div className="gecko-ai-bot-avatar">
                  <Icon name="sparkles" size={14} />
                </div>
                <div className="gecko-ai-bubble gecko-ai-bubble-assistant gecko-ai-typing">
                  <span className="gecko-ai-typing-dot" />
                  <span className="gecko-ai-typing-dot" />
                  <span className="gecko-ai-typing-dot" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={onSubmit} className="gecko-ai-panel-input-row">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask about a container, booking, billing, yard…"
              className="gecko-ai-input"
              disabled={typing}
            />
            <button
              type="submit"
              className="gecko-ai-send-btn"
              disabled={!input.trim() || typing}
              aria-label="Send"
            >
              <Icon name="send" size={16} />
            </button>
          </form>
          <div className="gecko-ai-disclosure">
            Phase 1 demo · deterministic answers. Production swaps to GPT-4o with audit log.
          </div>
        </div>
      )}
    </>
  );
}
