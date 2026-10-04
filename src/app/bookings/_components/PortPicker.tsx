"use client";
import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { apiGet } from '@/lib/api/client';
import { ApiError } from '@/lib/api/problem';
import type { Port } from '@/lib/api/logistics';

/**
 * A port, chosen — never typed.
 *
 * The API checks the code against master data and answers 400 on the field for
 * anything it does not know, so a free-text box here is a guaranteed rejection
 * discovered at save time. This searches instead, and only a PICKED port is
 * ever sent.
 *
 * It also hands back the whole port, because the panel needs more than the
 * code: the destination port's `tradeMode` is what the Trade Mode line shows
 * before the booking has been saved.
 */
export function PortPicker({ value, onChange, placeholder, required, disabled, seaportsFirst, error }: {
  /** The stored portCode, or '' when none is chosen. */
  value: string;
  onChange: (portCode: string, port: Port | null) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** Loading ports are seaports on Vector; others are still allowed, just lower. */
  seaportsFirst?: boolean;
  error?: string;
}) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Port[]>([]);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  // Two characters before asking: a one-letter search over every port in the
  // world is a long answer that helps nobody.
  useEffect(() => {
    if (!open) return;
    const q = text.trim();
    // Below two characters there is nothing to ask for. The list is filtered at
    // render instead of cleared here: a setState run straight from an effect
    // makes React render twice for nothing.
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      apiGet<{ items: Port[] }>(`/api/master/ports?search=${encodeURIComponent(q)}&pageSize=20`)
        .then(page => {
          if (cancelled) return;
          const found = page.items ?? [];
          setItems(seaportsFirst
            ? [...found].sort((a, b) => Number(b.portType === 'SEAPORT') - Number(a.portType === 'SEAPORT'))
            : found);
          setFailure(null);
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setItems([]);
          setFailure(e instanceof ApiError ? e.message : 'Could not search ports.');
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [text, open, seaportsFirst]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  const tooShort = text.trim().length < 2;

  const pick = (p: Port) => {
    onChange(p.portCode, p);
    setText('');
    setOpen(false);
  };

  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      {value && !open ? (
        <div className="gecko-row" style={{ gap: 6 }}>
          <span className="gecko-readonly-value gecko-flex-1">{value}</span>
          {!disabled && (
            <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon"
              aria-label="Change port" onClick={() => { onChange('', null); setOpen(true); }}>
              <Icon name="x" size={13} />
            </button>
          )}
        </div>
      ) : (
        <input
          className={`gecko-input gecko-input-sm gecko-text-mono${error ? ' gecko-input-error' : ''}`}
          value={text}
          disabled={disabled}
          placeholder={placeholder ?? (required ? 'Search port…' : 'Optional — search port…')}
          onFocus={() => setOpen(true)}
          onChange={e => { setText(e.target.value); setOpen(true); }} />
      )}

      {open && !disabled && (
        <div className="gecko-card" role="listbox"
          style={{ position: 'absolute', zIndex: 40, top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 260, overflowY: 'auto', padding: 4 }}>
          {tooShort && <div className="gecko-cell-meta" style={{ padding: 8 }}>Type two characters to search.</div>}
          {loading && <div className="gecko-cell-meta" style={{ padding: 8 }}>Searching…</div>}
          {failure && <div className="gecko-field-error" style={{ padding: 8 }}>{failure}</div>}
          {!loading && !failure && !tooShort && items.length === 0 && (
            <div className="gecko-cell-meta" style={{ padding: 8 }}>
              No port matches. Ports come from Master Data — if none are loaded yet, nothing will match.
            </div>
          )}
          {tooShort ? null : items.map(p => (
            <button key={p.portCode} type="button" role="option" aria-selected={false}
              className="gecko-row" onClick={() => pick(p)}
              style={{ width: '100%', gap: 8, padding: '7px 10px', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
              <span className="gecko-text-mono" style={{ fontWeight: 700 }}>{p.portCode}</span>
              <span className="gecko-flex-1">{p.portNameEn}</span>
              <span className="gecko-cell-meta">{p.countryCode}{p.portType === 'SEAPORT' ? '' : ` · ${p.portType}`}</span>
            </button>
          ))}
        </div>
      )}
      {error && <div className="gecko-field-error">{error}</div>}
    </div>
  );
}
