"use client";
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_SHORT  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_HEADERS  = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const CAL_HEIGHT   = 310;
const CAL_WIDTH    = 270;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DateFieldProps {
  value: string;           // date-only: 'yyyy-mm-dd'  |  datetime: 'yyyy-mm-ddTHH:mm'
  onChange: (v: string) => void;
  placeholder?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  readOnly?: boolean;
  style?: React.CSSProperties;
  withTime?: boolean;      // show HH:mm input alongside calendar picker
}

interface PopupCoords {
  top?: number;
  bottom?: number;
  left: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function splitDateTime(value: string): { datePart: string; timePart: string } {
  if (!value) return { datePart: '', timePart: '' };
  const idx = value.indexOf('T');
  if (idx === -1) return { datePart: value, timePart: '' };
  return { datePart: value.slice(0, idx), timePart: value.slice(idx + 1, idx + 6) };
}

function joinDateTime(datePart: string, timePart: string, withTime: boolean): string {
  if (!datePart) return '';
  if (!withTime) return datePart;
  return `${datePart}T${timePart || '00:00'}`;
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
  withTime = false,
}: DateFieldProps) {
  const { datePart, timePart } = splitDateTime(value);
  const parsed     = datePart ? new Date(datePart + 'T00:00:00') : null;
  const today      = new Date();
  const [open,      setOpen]      = useState(false);
  const [coords,    setCoords]    = useState<PopupCoords>({ left: 0, top: 0 });
  const [viewYear,  setViewYear]  = useState(parsed?.getFullYear()  ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth()     ?? today.getMonth());
  const [mounted,   setMounted]   = useState(false);
  const wrapRef    = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popupRef   = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  function calcCoords() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropUp = spaceBelow < CAL_HEIGHT && rect.top > spaceBelow;
    setCoords(dropUp
      ? { bottom: window.innerHeight - rect.top + 4, left: rect.left }
      : { top: rect.bottom + 4,                      left: rect.left }
    );
  }

  // Close on outside click — works across the portal boundary
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Reposition when user scrolls or resizes while open
  useEffect(() => {
    if (!open) return;
    const reposition = () => calcCoords();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatted = parsed
    ? `${String(parsed.getDate()).padStart(2, '0')} ${MONTH_SHORT[parsed.getMonth()]} ${parsed.getFullYear()}`
    : '';

  const handleOpen = () => {
    if (disabled || readOnly) return;
    calcCoords();
    setOpen(o => !o);
  };

  const prevMonth = () =>
    viewMonth === 0  ? (setViewMonth(11), setViewYear(y => y - 1)) : setViewMonth(m => m - 1);
  const nextMonth = () =>
    viewMonth === 11 ? (setViewMonth(0),  setViewYear(y => y + 1)) : setViewMonth(m => m + 1);

  const selectDay = (day: number) => {
    const dp = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(joinDateTime(dp, timePart, withTime));
    setOpen(false);
  };

  const handleTimeChange = (t: string) => {
    onChange(joinDateTime(datePart, t, withTime));
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const jumpToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    const dp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    onChange(joinDateTime(dp, timePart || '00:00', withTime));
    setOpen(false);
  };

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

  // ── Calendar popup (rendered into document.body via portal) ──────────────
  const calendarPopup = (
    <div
      ref={popupRef}
      style={{
        position: 'fixed',
        ...(coords.top    !== undefined ? { top: coords.top }       : {}),
        ...(coords.bottom !== undefined ? { bottom: coords.bottom } : {}),
        left: coords.left,
        zIndex: 9999,
        background: 'var(--gecko-bg-surface)', borderRadius: 10,
        border: '1px solid var(--gecko-border)',
        boxShadow: '0 10px 36px rgba(0,0,0,0.18)',
        width: CAL_WIDTH, padding: '14px 14px 10px',
      }}
    >
      {/* Month / Year navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gecko-text-secondary)', padding: '4px 8px', borderRadius: 6, fontSize: 16, lineHeight: 1, fontFamily: 'inherit' }}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gecko-text-secondary)', padding: '4px 8px', borderRadius: 6, fontSize: 16, lineHeight: 1, fontFamily: 'inherit' }}>›</button>
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {DAY_HEADERS.map(dh => (
          <div key={dh} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-disabled)', padding: '2px 0' }}>{dh}</div>
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
  );

  return (
    <div ref={wrapRef} style={{ position: 'relative', ...style }}>

      {/* ── Trigger row (date picker + optional time input) ── */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>

        {/* Date trigger */}
        <div
          ref={triggerRef}
          onClick={handleOpen}
          style={{
            flex: 1,
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
            style={{ color: open ? 'var(--gecko-primary-500)' : 'var(--gecko-text-secondary)', flexShrink: 0, transition: 'color 150ms' }}
          />
          <span style={{ flex: 1, color: formatted ? 'var(--gecko-text-primary)' : 'var(--gecko-text-disabled)', fontSize: fs, whiteSpace: 'nowrap' }}>
            {formatted || placeholder}
          </span>
          {value && !disabled && !readOnly && (
            <span
              onClick={handleClear}
              style={{ color: 'var(--gecko-text-disabled)', fontSize: 15, lineHeight: 1, cursor: 'pointer', padding: '0 2px', fontFamily: 'inherit' }}
            >×</span>
          )}
        </div>

        {/* Time input — only rendered when withTime=true */}
        {withTime && (
          <input
            type="time"
            value={timePart}
            onChange={e => handleTimeChange(e.target.value)}
            disabled={disabled || readOnly}
            style={{
              width: 86, height: h,
              border: `1.5px solid var(--gecko-border)`,
              borderRadius: 7,
              background: disabled ? 'var(--gecko-bg-subtle)' : 'var(--gecko-bg-surface)',
              fontFamily: 'var(--gecko-font-mono)', fontSize: fs,
              color: timePart ? 'var(--gecko-text-primary)' : 'var(--gecko-text-secondary)',
              paddingInline: px, outline: 'none',
              cursor: disabled || readOnly ? 'not-allowed' : 'default',
              opacity: disabled ? 0.55 : 1,
              transition: 'border-color 150ms',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--gecko-primary-400)')}
            onBlur={e  => (e.currentTarget.style.borderColor = 'var(--gecko-border)')}
          />
        )}
      </div>

      {/* Portal: calendar renders on document.body — escapes all overflow:hidden parents */}
      {open && mounted && createPortal(calendarPopup, document.body)}
    </div>
  );
}
