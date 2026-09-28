"use client";
import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ApiError } from '@/lib/api/problem';
import { searchParties, type PartySummary, type PartyRole } from '@/lib/api/parties';

/**
 * Debounced search over GET /api/master/parties. Shows code + name; the value
 * is the PARTY CODE, which is what a tariff stores (ScheduleEndpoints resolves
 * it to the party and checks it plays the role).
 */
export function PartyPicker({ role, value, onChange, placeholder, error, disabled }: {
  role: PartyRole;
  value: string | null;
  onChange: (code: string | null, party?: PartySummary) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PartySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      searchParties({ search: text, role, pageSize: 20 })
        .then(page => {
          if (cancelled) return;
          setItems(page.items);
          setTotal(page.totalCount);
          setFailure(null);
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setItems([]);
          setFailure(e instanceof ApiError && e.status === 404
            ? 'Party search is not available on this API yet — type the party code.'
            : e instanceof ApiError ? e.message : 'Could not search parties.');
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [text, role, open]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (value) {
    return (
      <div>
        <div className="gecko-input gecko-row" style={{ gap: 8 }}>
          <span className="gecko-mono-strong">{value}</span>
          <span className="gecko-flex-1 gecko-cell-meta">{label ?? ''}</span>
          {!disabled && (
            <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon" aria-label="Clear"
              onClick={() => { onChange(null); setLabel(null); setText(''); }}>
              <Icon name="x" size={12} />
            </button>
          )}
        </div>
        {error && <div className="gecko-field-error">{error}</div>}
      </div>
    );
  }

  const takeTypedCode = () => {
    const code = text.trim().toUpperCase();
    if (code) { onChange(code); setLabel('typed code — checked on save'); setOpen(false); }
  };

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <input
        className="gecko-input"
        value={text}
        disabled={disabled}
        placeholder={placeholder ?? 'Search code, name or tax id…'}
        onFocus={() => setOpen(true)}
        onChange={e => { setText(e.target.value); setOpen(true); }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (items[0]) { onChange(items[0].partyCode, items[0]); setLabel(items[0].nameEn); setOpen(false); }
            else takeTypedCode();
          }
          if (e.key === 'Escape') setOpen(false);
        }}
        aria-invalid={error ? true : undefined}
      />
      {error && <div className="gecko-field-error">{error}</div>}
      {open && (
        <div className="gecko-card" role="listbox"
          style={{ position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 30, marginTop: 4, maxHeight: 280, overflowY: 'auto', padding: 4 }}>
          {loading && <div className="gecko-cell-meta" style={{ padding: 8 }}>Searching…</div>}
          {!loading && failure && (
            <div style={{ padding: 8 }}>
              <div className="gecko-cell-meta">{failure}</div>
              {text.trim() && (
                <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm gecko-mt-1" onClick={takeTypedCode}>
                  Use code “{text.trim().toUpperCase()}”
                </button>
              )}
            </div>
          )}
          {!loading && !failure && items.length === 0 && <div className="gecko-cell-meta" style={{ padding: 8 }}>No matching {role.toLowerCase().replace('_', ' ')}.</div>}
          {!loading && items.map(p => (
            <button key={p.partyId} type="button" role="option" aria-selected={false}
              className="gecko-btn gecko-btn-ghost gecko-btn-sm"
              style={{ width: '100%', justifyContent: 'flex-start', gap: 10, opacity: p.isActive ? 1 : 0.5 }}
              disabled={!p.isActive}
              onClick={() => { onChange(p.partyCode, p); setLabel(p.nameEn); setOpen(false); }}>
              <span className="gecko-mono-strong">{p.partyCode}</span>
              <span className="gecko-flex-1" style={{ textAlign: 'left' }}>
                {p.nameEn}{p.nameLocal ? <span className="gecko-cell-meta"> · {p.nameLocal}</span> : null}
              </span>
              {p.taxId && <span className="gecko-cell-meta">{p.taxId}{p.branchNo ? `/${p.branchNo}` : ''}</span>}
              {!p.isActive && <span className="gecko-pill gecko-pill-neutral">inactive</span>}
            </button>
          ))}
          {!loading && total > items.length && <div className="gecko-cell-meta" style={{ padding: 8 }}>{total - items.length} more — keep typing to narrow.</div>}
        </div>
      )}
    </div>
  );
}
