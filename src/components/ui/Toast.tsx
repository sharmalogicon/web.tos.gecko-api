"use client";
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'warning' | 'danger' | 'info';

interface ToastItem {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toast: (opts: Omit<ToastItem, 'id'>) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// ─── Variant config ───────────────────────────────────────────────────────────
// Maps a public variant name to (a) the gecko-toast-* CSS modifier and
// (b) the icon glyph rendered inside the toast. NO colour values here —
// all colours come from the design-system stylesheet.

const VARIANT_META: Record<ToastVariant, { className: string; icon: string }> = {
  success: { className: 'gecko-toast-success', icon: 'checkCircle'   },
  warning: { className: 'gecko-toast-warning', icon: 'alertTriangle' },
  danger:  { className: 'gecko-toast-error',   icon: 'trash'         },
  info:    { className: 'gecko-toast-info',    icon: 'info'          },
};

const DURATION_MS = 3000;

// ─── Single toast card ────────────────────────────────────────────────────────

function ToastCard({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
  const meta = VARIANT_META[item.variant];
  const [progress, setProgress] = useState(100);

  // Countdown progress bar + auto-dismiss
  useEffect(() => {
    const step = 30;
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += step;
      setProgress(Math.max(0, 100 - (elapsed / DURATION_MS) * 100));
      if (elapsed >= DURATION_MS) {
        clearInterval(timer);
        onRemove(item.id);
      }
    }, step);
    return () => clearInterval(timer);
  }, [item.id, onRemove]);

  return (
    <div className={`gecko-toast ${meta.className}`}>
      <div className="gecko-toast-body">
        <span className="gecko-toast-icon">
          <Icon name={meta.icon} size={16} />
        </span>
        <div className="gecko-toast-content">
          <div className="gecko-toast-title">{item.title}</div>
          {item.message && <div className="gecko-toast-message">{item.message}</div>}
        </div>
        <button className="gecko-toast-close" onClick={() => onRemove(item.id)} aria-label="Close">
          <Icon name="x" size={13} />
        </button>
      </div>
      <div className="gecko-toast-progress">
        <div className="gecko-toast-progress-bar" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

// ─── Provider + container ─────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((opts: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts(prev => [...prev, { ...opts, id }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Top-right stack — design-system class drives positioning */}
      <div className="gecko-toast-container gecko-toast-container-tr">
        {toasts.map(item => (
          <ToastCard key={item.id} item={item} onRemove={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
