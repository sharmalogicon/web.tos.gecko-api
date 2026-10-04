"use client";
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { formatDate } from '@/lib/format';

/**
 * THE date control for this app.
 *
 * A native <input type="date"> draws itself differently in every browser and
 * spells the date the way the viewer's OS locale does — which is how both
 * "03 Oct 2026" and "10/3/2026" ended up on screen in a system whose one date
 * format is dd-MM-yyyy. This reads dd-MM-yyyy everywhere, on every browser,
 * and its calendar is a portal so it escapes the overflow:hidden of a card or
 * a table cell.
 *
 * `min` / `max` are honoured by DISABLING the days outside the range rather
 * than hiding them, so the month still reads as a month. They matter: the cash
 * window clamps "paid until" to the depot's today, and a report's from/to
 * clamp each other.
 *
 * Styling lives in gecko_design_system_components.css §5.19d. Only the popup's
 * coordinates are inline — they are measured from the trigger when it opens.
 */

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const CAL_HEIGHT = 310;

export interface DateFieldProps {
  /** date-only 'yyyy-MM-dd', or 'yyyy-MM-ddTHH:mm' when withTime. */
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  readOnly?: boolean;
  style?: React.CSSProperties;
  /** Show an HH:mm input beside the calendar (replaces datetime-local). */
  withTime?: boolean;
  /** Earliest selectable day, 'yyyy-MM-dd'. */
  min?: string;
  /** Latest selectable day, 'yyyy-MM-dd'. */
  max?: string;
  /** Marks the trigger as invalid, to match .gecko-input-error on other fields. */
  invalid?: boolean;
  'aria-label'?: string;
}

interface PopupCoords { top?: number; bottom?: number; left: number }

function splitDateTime(value: string): { datePart: string; timePart: string } {
  if (!value) return { datePart: '', timePart: '' };
  const idx = value.indexOf('T');
  if (idx === -1) return { datePart: value, timePart: '' };
  return { datePart: value.slice(0, idx), timePart: value.slice(idx + 1, idx + 6) };
}

function joinDateTime(datePart: string, timePart: string, withTime: boolean): string {
  if (!datePart) return '';
  return withTime ? `${datePart}T${timePart || '00:00'}` : datePart;
}

const dayKey = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export function DateField({
  value,
  onChange,
  placeholder = 'dd-mm-yyyy',
  size = 'md',
  disabled,
  readOnly,
  style,
  withTime = false,
  min,
  max,
  invalid,
  'aria-label': ariaLabel,
}: DateFieldProps) {
  const { datePart, timePart } = splitDateTime(value);
  const parsed = datePart ? new Date(`${datePart}T00:00:00`) : null;
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<PopupCoords>({ left: 0, top: 0 });
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? today.getMonth());
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  function calcCoords() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropUp = spaceBelow < CAL_HEIGHT && rect.top > spaceBelow;
    setCoords(dropUp
      ? { bottom: window.innerHeight - rect.top + 4, left: rect.left }
      : { top: rect.bottom + 4, left: rect.left });
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

  // Esc closes it, like every other overlay in the app
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Follow the trigger when the page scrolls or resizes underneath it
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

  const formatted = parsed ? formatDate(datePart) : '';
  const locked = disabled || readOnly;

  const handleOpen = () => {
    if (locked) return;
    calcCoords();
    setOpen(o => !o);
  };

  const prevMonth = () =>
    viewMonth === 0 ? (setViewMonth(11), setViewYear(y => y - 1)) : setViewMonth(m => m - 1);
  const nextMonth = () =>
    viewMonth === 11 ? (setViewMonth(0), setViewYear(y => y + 1)) : setViewMonth(m => m + 1);

  /** String compare is safe and cheap on yyyy-MM-dd. */
  const outOfRange = (key: string) => (min !== undefined && min !== '' && key < min)
    || (max !== undefined && max !== '' && key > max);

  const selectDay = (day: number) => {
    const dp = dayKey(viewYear, viewMonth, day);
    if (outOfRange(dp)) return;
    onChange(joinDateTime(dp, timePart, withTime));
    setOpen(false);
  };

  const jumpToday = () => {
    const dp = dayKey(today.getFullYear(), today.getMonth(), today.getDate());
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    if (outOfRange(dp)) return;        // the field says today is not allowed; honour it
    onChange(joinDateTime(dp, timePart || '00:00', withTime));
    setOpen(false);
  };

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const isSelected = (d: number) =>
    !!parsed && d === parsed.getDate() && viewMonth === parsed.getMonth() && viewYear === parsed.getFullYear();
  const isTodayCell = (d: number) =>
    d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

  const sm = size === 'sm';

  const calendarPopup = (
    <div
      ref={popupRef}
      className="gecko-datefield-pop"
      style={{
        ...(coords.top !== undefined ? { top: coords.top } : {}),
        ...(coords.bottom !== undefined ? { bottom: coords.bottom } : {}),
        left: coords.left,
      }}
    >
      <div className="gecko-datefield-nav">
        <button type="button" className="gecko-datefield-navbtn" aria-label="Previous month" onClick={prevMonth}>&lsaquo;</button>
        <span className="gecko-datefield-month">{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button type="button" className="gecko-datefield-navbtn" aria-label="Next month" onClick={nextMonth}>&rsaquo;</button>
      </div>

      <div className="gecko-datefield-dow">
        {DAY_HEADERS.map(dh => <span key={dh}>{dh}</span>)}
      </div>

      <div className="gecko-datefield-grid">
        {cells.map((day, i) => (
          <div key={i} className="gecko-datefield-cell">
            {day ? (
              <button
                type="button"
                disabled={outOfRange(dayKey(viewYear, viewMonth, day))}
                className={[
                  'gecko-datefield-day',
                  isSelected(day) ? 'gecko-datefield-day-selected' : '',
                  isTodayCell(day) ? 'gecko-datefield-day-today' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => selectDay(day)}
              >{day}</button>
            ) : <span />}
          </div>
        ))}
      </div>

      <div className="gecko-datefield-foot">
        <button type="button" className="gecko-datefield-link gecko-datefield-link-muted"
          onClick={() => { onChange(''); setOpen(false); }}>Clear</button>
        <button type="button" className="gecko-datefield-link" onClick={jumpToday}>Today</button>
      </div>
    </div>
  );

  return (
    <div ref={wrapRef} className="gecko-datefield" style={style}>
      <div className="gecko-row" style={{ gap: 6 }}>
        <div
          ref={triggerRef}
          role="button"
          tabIndex={locked ? -1 : 0}
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-disabled={locked || undefined}
          onClick={handleOpen}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpen(); }
          }}
          className={[
            'gecko-datefield-trigger',
            sm ? 'gecko-datefield-sm' : '',
            open ? 'gecko-datefield-trigger-open' : '',
            locked ? 'gecko-datefield-trigger-disabled' : '',
            invalid ? 'gecko-input-error' : '',
          ].filter(Boolean).join(' ')}
        >
          <Icon name="calendar" size={sm ? 12 : 13} className="gecko-datefield-icon" />
          <span className={`gecko-datefield-value ${formatted ? '' : 'gecko-datefield-value-empty'}`}>
            {formatted || placeholder}
          </span>
          {value && !locked && (
            <button type="button" className="gecko-datefield-clear" aria-label="Clear date"
              onClick={e => { e.stopPropagation(); onChange(''); }}>&times;</button>
          )}
        </div>

        {withTime && (
          <input
            type="time"
            aria-label={ariaLabel ? `${ariaLabel} time` : 'Time'}
            className={`gecko-datefield-time ${sm ? 'gecko-datefield-sm' : ''}`}
            value={timePart}
            disabled={locked}
            onChange={e => onChange(joinDateTime(datePart, e.target.value, withTime))}
          />
        )}
      </div>

      {/* The calendar renders on document.body, escaping every overflow:hidden
          parent. No mounted flag: `open` only turns true from a click. */}
      {open && createPortal(calendarPopup, document.body)}
    </div>
  );
}
