"use client";

/**
 * Ask Gecko — AI assist surface.
 *
 * Two pieces:
 *   - <AskGeckoProvider>   wraps the authenticated app shell; owns isOpen state
 *                          and renders the bottom-right chat panel
 *   - <AskGeckoTrigger />  pill button placed in the global header toolbar
 *
 * UX rules (Sharma's calls):
 *   - Closing the panel clears the conversation — next open starts fresh
 *   - When messages exist, a back/reset icon appears in the panel header to
 *     return to the welcome state (suggestion chips) without closing
 *
 * Phase 1: replies from dispatchAskGecko() (deterministic).
 * Phase 2: swap dispatch call for Gecko.AI.Service.AskGecko (GPT-4o + audit).
 */

import React, {
  createContext, useContext, useCallback, useState, useRef, useEffect,
} from 'react';
import Link from 'next/link';
import { Icon } from '../ui/Icon';
import {
  dispatchAskGecko,
  WELCOME_SUGGESTIONS,
  WELCOME_TEXT,
  type AssistantReply,
} from '@/lib/ask-gecko-intents';

/* ──────────────────────────────────────────────────────────────────────────
   Context
   ────────────────────────────────────────────────────────────────────────── */

interface AskGeckoCtx {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const AskGeckoContext = createContext<AskGeckoCtx | null>(null);

function useAskGecko(): AskGeckoCtx {
  const ctx = useContext(AskGeckoContext);
  if (!ctx) {
    // Render-time fallback so a stray <AskGeckoTrigger /> outside the provider
    // is silently disabled rather than throwing.
    return { isOpen: false, open: () => {}, close: () => {}, toggle: () => {} };
  }
  return ctx;
}

export function AskGeckoProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open   = useCallback(() => setIsOpen(true), []);
  const close  = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(o => !o), []);
  return (
    <AskGeckoContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
      <AskGeckoPanel />
    </AskGeckoContext.Provider>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Trigger button — placed in the global header
   ────────────────────────────────────────────────────────────────────────── */

export function AskGeckoTrigger() {
  const { isOpen, toggle } = useAskGecko();
  return (
    <button
      type="button"
      className={`gecko-ai-trigger${isOpen ? ' gecko-ai-trigger-open' : ''}`}
      onClick={toggle}
      aria-label={isOpen ? 'Close Ask Gecko' : 'Open Ask Gecko'}
      aria-expanded={isOpen}
    >
      <Icon name="sparkles" size={15} />
      <span>Ask Gecko</span>
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Chat panel — anchored bottom-right
   ────────────────────────────────────────────────────────────────────────── */

interface UserMessage      { id: string; role: 'user';      text: string; }
interface AssistantMessage { id: string; role: 'assistant'; reply: AssistantReply; }
type ChatMessage = UserMessage | AssistantMessage;

function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

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

function AskGeckoPanel() {
  const { isOpen, close } = useAskGecko();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing, isOpen]);

  // Focus input on open
  useEffect(() => {
    if (isOpen && inputRef.current) {
      const id = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  // ESC closes
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  // Clear the conversation when the panel closes — next open starts fresh.
  useEffect(() => {
    if (!isOpen) {
      // Defer the wipe by one tick so the closing animation can play before
      // the welcome state pops back in (looks cleaner if user reopens fast).
      const id = setTimeout(() => {
        setMessages([]);
        setInput('');
        setTyping(false);
      }, 200);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  const ask = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages(prev => [...prev, { id: uid(), role: 'user', text: trimmed }]);
    setInput('');
    setTyping(true);
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

  const resetToWelcome = () => {
    setMessages([]);
    setInput('');
    setTyping(false);
    inputRef.current?.focus();
  };

  if (!isOpen) return null;

  const hasMessages = messages.length > 0;

  return (
    <div className="gecko-ai-panel" role="dialog" aria-label="Ask Gecko assistant">
      {/* Header */}
      <div className="gecko-ai-panel-header">
        {hasMessages && (
          <button
            type="button"
            className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm"
            onClick={resetToWelcome}
            aria-label="Back to suggestions"
            title="Start over"
          >
            <Icon name="arrowLeft" size={16} />
          </button>
        )}
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
          onClick={close}
          aria-label="Close"
        >
          <Icon name="x" size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="gecko-ai-panel-body" ref={scrollRef}>
        {!hasMessages && (
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
              <div className="gecko-ai-message-content">
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
                        onClick={close}
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
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Backward-compat — old <AskGeckoWidget /> stays as a no-op alias so any
   stale imports won't break the build. New code uses <AskGeckoProvider>.
   ────────────────────────────────────────────────────────────────────────── */

export function AskGeckoWidget() {
  return null;
}
