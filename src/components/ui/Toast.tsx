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

const META: Record<ToastVariant, { icon: string; color: string; bg: string; border: string; bar: string; label: string }> = {
  success: { icon: 'checkCircle', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', bar: '#22c55e', label: 'Success'  },
  warning: { icon: 'alertTriangle', color: '#b45309', bg: '#fffbeb', border: '#fde68a', bar: '#f59e0b', label: 'Warning' },
  danger:  { icon: 'trash',       color: '#b91c1c', bg: '#fef2f2', border: '#fecaca', bar: '#ef4444', label: 'Deleted'  },
  info:    { icon: 'info',        color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', bar: '#3b82f6', label: 'Info'     },
};

const DURATION = 3000;

// ─── Single toast card ────────────────────────────────────────────────────────

function ToastCard({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
  const m = META[item.variant];
  const [entered, setEntered] = useState(false);
  const [progress, setProgress] = useState(100);

  // Slide-in on mount
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 16);
    return () => clearTimeout(t);
  }, []);

  // Countdown progress bar + auto-dismiss
  useEffect(() => {
    const step = 30;
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += step;
      setProgress(Math.max(0, 100 - (elapsed / DURATION) * 100));
      if (elapsed >= DURATION) {
        clearInterval(timer);
        dismiss();
      }
    }, step);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = () => {
    setEntered(false);
    setTimeout(() => onRemove(item.id), 300);
  };

  return (
    <div
      style={{
        width: 340,
        background: m.bg,
        border: `1px solid ${m.border}`,
        borderRadius: 10,
        boxShadow: '0 8px 28px rgba(0,0,0,0.13)',
        overflow: 'hidden',
        transform: entered ? 'translateX(0)' : 'translateX(calc(100% + 28px))',
        opacity: entered ? 1 : 0,
        transition: 'transform 300ms cubic-bezier(0.34,1.4,0.64,1), opacity 250ms ease',
      }}
    >
      {/* Body */}
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <Icon name={m.icon} size={16} style={{ color: m.color, marginTop: 1, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: m.color, lineHeight: 1.3 }}>{item.title}</div>
          {item.message && (
            <div style={{ fontSize: 11.5, color: m.color, opacity: 0.75, marginTop: 3, lineHeight: 1.45 }}>{item.message}</div>
          )}
        </div>
        <button
          onClick={dismiss}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: m.color, opacity: 0.5, padding: 2, display: 'flex', flexShrink: 0, lineHeight: 1 }}
        >
          <Icon name="x" size={13} />
        </button>
      </div>

      {/* Shrinking progress bar */}
      <div style={{ height: 3, background: `${m.bar}30` }}>
        <div style={{ height: '100%', width: `${progress}%`, background: m.bar, transition: 'width 30ms linear' }} />
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

      {/* Fixed top-right stack */}
      <div style={{
        position: 'fixed', top: 20, right: 20, zIndex: 99999,
        display: 'flex', flexDirection: 'column', gap: 10,
        pointerEvents: 'none',
      }}>
        {toasts.map(item => (
          <div key={item.id} style={{ pointerEvents: 'auto' }}>
            <ToastCard item={item} onRemove={remove} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
