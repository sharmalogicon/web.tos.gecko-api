"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Icon } from './Icon';

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_SHORT  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_HEADERS  = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const CAL_HEIGHT   = 310; // approximate popup height for flip detection

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DateFieldProps {
  value: string;                    // ISO yyyy-mm-dd or ''
  onChange: (v: string) => void;
  placeholder?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  readOnly?: boolean;
  style?: React.CSSProperties;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DateField({
  value,
  onChange,
  placeholder = 'Select date',
  size = 'md',
  disabled,
  readOnly,
  style,
}: DateFieldProps) {
  const parsed     = value ? new Date(value + 'T00:00:00') : null;
  const today      = new Date();
  const [open,      setOpen]      = useState(false);
  const [dropUp,    setDropUp]    = useState(false);
  const [viewYear,  setViewYear]  = useState(parsed?.getFullYear()  ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth()     ?? today.getMonth());
  const wrapRef    = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Formatted display string
  const formatted = parsed
    ? `${String(parsed.getDate()).padStart(2, '0')} ${MONTH_SHORT[parsed.getMonth()]} ${parsed.getFullYear()}`
    : '';

  const handleOpen = () => {
    if (disabled || readOnly) return;
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // Flip up if: not enough space below AND more space above
      setDropUp(spaceBelow < CAL_HEIGHT && rect.top > spaceBelow);
    }
    setOpen(o => !o);
  };

  const prevMonth = () =>
    viewMonth === 0  ? (setViewMonth(11), setViewYear(y => y - 1)) : setViewMonth(m => m - 1);
  const nextMonth = () =>
    viewMonth === 11 ? (setViewMonth(0),  setViewYear(y => y + 1)) : setViewMonth(m => m + 1);

  const selectDay = (day: number) => {
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(iso);
    setOpen(false);
  };

  const jumpToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    selectDay(today.getDate());
  };

  // Build calendar grid
  const firstDow    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const isSelected  = (d: number) =>
    !!parsed && d === parsed.getDate() && viewMonth === parsed.getMonth() && viewYear === parsed.getFullYear();
  const isTodayCell = (d: number) =>
    d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

  const h  = size === 'sm' ? 28 : 34;
  const fs = size === 'sm' ? 12 : 13;
  const px = size === 'sm' ? 8  : 10;

  return (
    <div ref={wrapRef} style={{ position: 'relative', ...style }}>

      {/* ── Trigger ── */}
      <div
        ref={triggerRef}
        onClick={handleOpen}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          paddingInline: px, height: h,
          border: `1.5px solid ${open ? 'var(--gecko-primary-400)' : 'var(--gecko-border)'}`,
          borderRadius: 7,
          background: disabled ? 'var(--gecko-bg-subtle)' : 'var(--gecko-bg-surface)',
          cursor: disabled || readOnly ? 'not-allowed' : 'pointer',
          userSelect: 'none', transition: 'border-color 150ms',
          fontFamily: 'var(--gecko-font-mono)', fontSize: fs,
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <Icon
          name="calendar"
          size={size === 'sm' ? 12 : 13}
          style={{
            color: open ? 'var(--gecko-primary-500)' : 'var(--gecko-text-secondary)',
            flexShrink: 0, transition: 'color 150ms',
          }}
        />
        <span style={{ flex: 1, color: formatted ? 'var(--gecko-text-primary)' : 'var(--gecko-text-disabled)', fontSize: fs, whiteSpace: 'nowrap' }}>
          {formatted || placeholder}
        </span>
        {value && !disabled && !readOnly && (
          <span
            onClick={e => { e.stopPropagation(); onChange(''); }}
            style={{ color: 'var(--gecko-text-disabled)', fontSize: 15, lineHeight: 1, cursor: 'pointer', padding: '0 2px', fontFamily: 'inherit' }}
          >×</span>
        )}
      </div>

      {/* ── Calendar popup ── */}
      {open && (
        <div style={{
          position: 'absolute',
          ...(dropUp
            ? { bottom: 'calc(100% + 6px)', top: 'auto' }
            : { top: 'calc(100% + 6px)',    bottom: 'auto' }
          ),
          left: 0, zIndex: 1100,
          background: 'var(--gecko-bg-surface)', borderRadius: 10,
          border: '1px solid var(--gecko-border)',
          boxShadow: '0 10px 36px rgba(0,0,0,0.16)',
          width: 270, padding: '14px 14px 10px',
        }}>

          {/* Month / Year navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gecko-text-secondary)', padding: '4px 8px', borderRadius: 6, fontSize: 16, lineHeight: 1, fontFamily: 'inherit' }}>‹</button>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
            <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gecko-text-secondary)', padding: '4px 8px', borderRadius: 6, fontSize: 16, lineHeight: 1, fontFamily: 'inherit' }}>›</button>
          </div>

          {/* Day-of-week headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {DAY_HEADERS.map(h => (
              <div key={h} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-disabled)', padding: '2px 0' }}>{h}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {cells.map((day, i) => (
              <div key={i} style={{ aspectRatio: '1' }}>
                {day ? (
                  <button
                    onClick={() => selectDay(day)}
                    style={{
                      width: '100%', height: '100%', border: 'none', borderRadius: 6,
                      fontSize: 12, fontWeight: isSelected(day) ? 700 : 400, cursor: 'pointer',
                      background: isSelected(day)
                        ? 'var(--gecko-primary-600)'
                        : isTodayCell(day) ? 'var(--gecko-primary-50)' : 'transparent',
                      color: isSelected(day)
                        ? '#fff'
                        : isTodayCell(day) ? 'var(--gecko-primary-600)' : 'var(--gecko-text-primary)',
                      outline: isTodayCell(day) && !isSelected(day)
                        ? '1.5px solid var(--gecko-primary-200)' : 'none',
                      outlineOffset: '-1px',
                    }}
                  >{day}</button>
                ) : <span />}
              </div>
            ))}
          </div>

          {/* Footer: Clear / Today */}
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--gecko-border)', display: 'flex', justifyContent: 'space-between' }}>
            <button
              onClick={() => { onChange(''); setOpen(false); }}
              style={{ background: 'none', border: 'none', color: 'var(--gecko-text-secondary)', fontSize: 11, cursor: 'pointer', padding: '2px 4px', fontFamily: 'inherit' }}
            >Clear</button>
            <button
              onClick={jumpToday}
              style={{ background: 'none', border: 'none', color: 'var(--gecko-primary-600)', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '2px 4px', fontFamily: 'inherit' }}
            >Today</button>
          </div>
        </div>
      )}
    </div>
  );
}
