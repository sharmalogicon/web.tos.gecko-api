"use client";
import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';

// ── Voyage data ──────────────────────────────────────────────────────────────
const LINE_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  MSK:  { dot: '#0066CC', bg: '#EBF4FF', text: '#004A99' },
  OOCL: { dot: '#E65C00', bg: '#FFF3EB', text: '#C44A00' },
  EGL:  { dot: '#00873D', bg: '#EDFAF3', text: '#006830' },
  CMA:  { dot: '#D0021B', bg: '#FFEBEE', text: '#A80015' },
  HLC:  { dot: '#F47920', bg: '#FFF4E6', text: '#C05E00' },
  ONE:  { dot: '#E4002B', bg: '#FFEBEE', text: '#B30022' },
  HMM:  { dot: '#005BAC', bg: '#EBF2FF', text: '#004488' },
};

const VOYAGES = [
  { id: 'MSK-142E',  vessel: 'Maersk Kalmar',        line: 'MSK',  pol: 'THSGN', pod: 'CNSHA', etd: '2026-04-03', eta: '2026-04-09', status: 'Departed',  teu: 1800, filled: 1420, berth: 'B-2', wharf: 'Wharf 1', direction: 'Outbound' },
  { id: 'OOL-089W',  vessel: 'OOCL Hamburg',         line: 'OOCL', pol: 'THLCB', pod: 'USLAX', etd: '2026-04-05', eta: '2026-04-22', status: 'En Route',  teu: 2100, filled: 1890, berth: 'C-1', wharf: 'Wharf 2', direction: 'Outbound' },
  { id: 'EGL-336N',  vessel: 'Ever Given',            line: 'EGL',  pol: 'CNSHA', pod: 'THLCB', etd: '2026-04-08', eta: '2026-04-28', status: 'En Route',  teu: 1650, filled: 980,  berth: 'A-3', wharf: 'Wharf 3', direction: 'Inbound'  },
  { id: 'MSK-201W',  vessel: 'Maersk Honam',         line: 'MSK',  pol: 'THLCB', pod: 'NLRTM', etd: '2026-04-12', eta: '2026-05-02', status: 'En Route',  teu: 2400, filled: 2100, berth: 'B-1', wharf: 'Wharf 1', direction: 'Outbound' },
  { id: 'CMA-771S',  vessel: 'CMA CGM Rossini',      line: 'CMA',  pol: 'SGSIN', pod: 'THLCB', etd: '2026-04-14', eta: '2026-04-18', status: 'En Route',  teu: 900,  filled: 640,  berth: 'D-2', wharf: 'Wharf 4', direction: 'Inbound'  },
  { id: 'HLC-044E',  vessel: 'Hapag Chennai',        line: 'HLC',  pol: 'THLCB', pod: 'INMAA', etd: '2026-04-14', eta: '2026-04-20', status: 'En Route',  teu: 750,  filled: 510,  berth: 'D-1', wharf: 'Wharf 2', direction: 'Outbound' },
  { id: 'OOL-112E',  vessel: 'OOCL Seoul',           line: 'OOCL', pol: 'THLCB', pod: 'JPNGO', etd: '2026-04-17', eta: '2026-04-21', status: 'Open',      teu: 1400, filled: 320,  berth: null,  wharf: 'Wharf 3', direction: 'Outbound' },
  { id: 'EGL-401W',  vessel: 'Ever Glory',           line: 'EGL',  pol: 'USLGB', pod: 'THLCB', etd: '2026-04-19', eta: '2026-05-06', status: 'Open',      teu: 1900, filled: 880,  berth: null,  wharf: 'Wharf 1', direction: 'Inbound'  },
  { id: 'MSK-198E',  vessel: 'Maersk Sentosa',       line: 'MSK',  pol: 'THLCB', pod: 'CNSHA', etd: '2026-04-22', eta: '2026-04-28', status: 'Open',      teu: 1600, filled: 440,  berth: null,  wharf: 'Wharf 2', direction: 'Outbound' },
  { id: 'ONE-055E',  vessel: 'ONE Stork',            line: 'ONE',  pol: 'THLCB', pod: 'JPYOK', etd: '2026-04-22', eta: '2026-04-26', status: 'Open',      teu: 820,  filled: 190,  berth: null,  wharf: 'Wharf 4', direction: 'Outbound' },
  { id: 'CMA-802N',  vessel: 'CMA CGM Brazil',       line: 'CMA',  pol: 'THLCB', pod: 'BRSSZ', etd: '2026-04-25', eta: '2026-05-14', status: 'Open',      teu: 1100, filled: 210,  berth: null,  wharf: 'Wharf 3', direction: 'Outbound' },
  { id: 'HLC-091W',  vessel: 'Hapag Manila',         line: 'HLC',  pol: 'PHMNL', pod: 'THLCB', etd: '2026-04-25', eta: '2026-04-28', status: 'Open',      teu: 600,  filled: 80,   berth: null,  wharf: 'Wharf 1', direction: 'Inbound'  },
  { id: 'MSK-220W',  vessel: 'Maersk Denver',        line: 'MSK',  pol: 'THLCB', pod: 'NLRTM', etd: '2026-04-28', eta: '2026-05-18', status: 'Scheduled', teu: 2200, filled: 0,    berth: null,  wharf: null,      direction: 'Outbound' },
  { id: 'OOL-135E',  vessel: 'OOCL Busan',           line: 'OOCL', pol: 'KRBSN', pod: 'THLCB', etd: '2026-04-29', eta: '2026-05-03', status: 'Scheduled', teu: 1300, filled: 0,    berth: null,  wharf: null,      direction: 'Inbound'  },
  { id: 'HMM-088N',  vessel: 'HMM Le Havre',         line: 'HMM',  pol: 'THLCB', pod: 'FRLEH', etd: '2026-04-30', eta: '2026-05-20', status: 'Scheduled', teu: 1750, filled: 0,    berth: null,  wharf: null,      direction: 'Outbound' },
  { id: 'EGL-450S',  vessel: 'Ever Ace',             line: 'EGL',  pol: 'THLCB', pod: 'AUSYD', etd: '2026-05-02', eta: '2026-05-12', status: 'Scheduled', teu: 980,  filled: 0,    berth: null,  wharf: null,      direction: 'Outbound' },
  { id: 'CMA-840E',  vessel: 'CMA CGM Tenere',       line: 'CMA',  pol: 'CNNGB', pod: 'THLCB', etd: '2026-05-06', eta: '2026-05-10', status: 'Scheduled', teu: 850,  filled: 0,    berth: null,  wharf: null,      direction: 'Inbound'  },
  { id: 'MSK-241E',  vessel: 'Maersk Esbjerg',       line: 'MSK',  pol: 'THLCB', pod: 'CNSHA', etd: '2026-05-09', eta: '2026-05-15', status: 'Scheduled', teu: 1700, filled: 0,    berth: null,  wharf: null,      direction: 'Outbound' },
  { id: 'ONE-072W',  vessel: 'ONE Competence',       line: 'ONE',  pol: 'USLAX', pod: 'THLCB', etd: '2026-05-12', eta: '2026-05-28', status: 'Scheduled', teu: 1450, filled: 0,    berth: null,  wharf: null,      direction: 'Inbound'  },
  { id: 'OOL-158W',  vessel: 'OOCL Rotterdam',       line: 'OOCL', pol: 'THLCB', pod: 'NLRTM', etd: '2026-05-15', eta: '2026-06-04', status: 'Scheduled', teu: 2000, filled: 0,    berth: null,  wharf: null,      direction: 'Outbound' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay(); // 0=Sun
}
function toKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_LABELS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

type Voyage = typeof VOYAGES[number];

function statusColor(status: string) {
  if (status === 'Open')      return 'var(--gecko-success-600)';
  if (status === 'En Route')  return 'var(--gecko-info-600)';
  if (status === 'Departed')  return 'var(--gecko-text-disabled)';
  return 'var(--gecko-text-secondary)';
}
function statusBg(status: string) {
  if (status === 'Open')      return 'var(--gecko-success-50)';
  if (status === 'En Route')  return 'var(--gecko-info-50)';
  if (status === 'Departed')  return 'var(--gecko-gray-100)';
  return 'var(--gecko-bg-subtle)';
}

// ── Popover ───────────────────────────────────────────────────────────────────
function VoyagePopover({ voyage, anchorRect, containerRect, onClose }: {
  voyage: Voyage;
  anchorRect: DOMRect;
  containerRect: DOMRect;
  onClose: () => void;
}) {
  const lc = LINE_COLORS[voyage.line] ?? { dot: '#6b7280', bg: '#f3f4f6', text: '#374151' };
  const fillPct = voyage.teu > 0 ? Math.round((voyage.filled / voyage.teu) * 100) : 0;

  // Position: prefer below the dot, flip up if near bottom
  const dotMidX = anchorRect.left - containerRect.left + anchorRect.width / 2;
  const dotBottomY = anchorRect.bottom - containerRect.top + 8;
  const dotTopY = anchorRect.top - containerRect.top - 8;
  const CARD_W = 280;
  const CARD_H = 270;

  const flipUp = dotBottomY + CARD_H > containerRect.height - 20;
  const left = Math.min(Math.max(dotMidX - CARD_W / 2, 8), containerRect.width - CARD_W - 8);
  const top = flipUp ? dotTopY - CARD_H : dotBottomY;

  return (
    <div
      style={{
        position: 'absolute', zIndex: 100,
        left, top,
        width: CARD_W,
        background: '#fff',
        border: '1px solid var(--gecko-border)',
        borderRadius: 12,
        boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {/* Header strip */}
      <div style={{ background: lc.bg, borderBottom: `1px solid ${lc.dot}22`, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 14, fontWeight: 700, color: lc.text }}>{voyage.id}</div>
          <div style={{ fontSize: 11, color: lc.text, opacity: 0.8, marginTop: 1 }}>{voyage.vessel}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: statusBg(voyage.status), color: statusColor(voyage.status), border: `1px solid ${statusColor(voyage.status)}33` }}>
            {voyage.status.toUpperCase()}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
            background: voyage.direction === 'Inbound' ? 'var(--gecko-success-100)' : 'var(--gecko-primary-100)',
            color: voyage.direction === 'Inbound' ? 'var(--gecko-success-700)' : 'var(--gecko-primary-700)',
          }}>
            {voyage.direction === 'Inbound' ? '↓ Inbound' : '↑ Outbound'}
          </span>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Route */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{voyage.pol}</span>
          <Icon name="arrowRight" size={12} style={{ color: 'var(--gecko-text-disabled)' }} />
          <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{voyage.pod}</span>
        </div>

        {/* ETD / ETA */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gecko-text-secondary)', marginBottom: 2 }}>ETD</div>
            <div style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)' }}>{voyage.etd}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gecko-text-secondary)', marginBottom: 2 }}>ETA</div>
            <div style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)' }}>{voyage.eta}</div>
          </div>
        </div>

        {/* TEU fill */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
            <span style={{ color: 'var(--gecko-text-secondary)', fontWeight: 500 }}>TEU Utilisation</span>
            <span style={{ fontWeight: 700, color: fillPct > 85 ? 'var(--gecko-error-600)' : fillPct > 60 ? 'var(--gecko-warning-600)' : 'var(--gecko-success-600)' }}>{fillPct}%</span>
          </div>
          <div className="gecko-progress gecko-progress-sm">
            <div className="gecko-progress-bar" style={{
              width: `${fillPct}%`,
              background: fillPct > 85 ? 'var(--gecko-error-500)' : fillPct > 60 ? 'var(--gecko-warning-500)' : 'var(--gecko-success-500)',
            }} />
          </div>
          <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)', marginTop: 3 }}>{voyage.filled.toLocaleString()} / {voyage.teu.toLocaleString()} TEU</div>
        </div>

        {/* Berth + Wharf */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {voyage.berth && (
            <div style={{ fontSize: 11, color: 'var(--gecko-primary-700)', background: 'var(--gecko-primary-50)', padding: '4px 8px', borderRadius: 6, fontWeight: 600, fontFamily: 'var(--gecko-font-mono)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon name="anchor" size={11} /> Berth {voyage.berth}
            </div>
          )}
          {voyage.wharf && (
            <div style={{ fontSize: 11, color: 'var(--gecko-accent-700)', background: 'var(--gecko-accent-50)', padding: '4px 8px', borderRadius: 6, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon name="layers" size={11} /> {voyage.wharf}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Voyage Dot ────────────────────────────────────────────────────────────────
function VoyageDot({ voyage, onHover, onLeave }: {
  voyage: Voyage;
  onHover: (v: Voyage, rect: DOMRect) => void;
  onLeave: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lc = LINE_COLORS[voyage.line] ?? { dot: '#6b7280', bg: '#f3f4f6', text: '#374151' };

  return (
    <Link
      href={`/masters/vessels/schedule/${voyage.id}`}
      ref={ref as React.Ref<HTMLAnchorElement>}
      onMouseEnter={() => ref.current && onHover(voyage, (ref.current as unknown as HTMLElement).getBoundingClientRect())}
      onMouseLeave={onLeave}
      title={`${voyage.id} — click to open`}
      style={{
        width: 22, height: 22, borderRadius: 6,
        background: lc.bg,
        border: `1.5px solid ${lc.dot}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        transition: 'transform 100ms, box-shadow 100ms',
        flexShrink: 0,
        textDecoration: 'none',
      }}
      onMouseOver={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.2)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 2px 8px ${lc.dot}44`; }}
      onMouseOut={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
    >
      <span style={{ fontSize: 8, fontWeight: 700, color: lc.text, letterSpacing: '-0.02em' }}>
        {voyage.line.slice(0, 3)}
      </span>
    </Link>
  );
}

// ── Calendar Day Cell ─────────────────────────────────────────────────────────
function DayCell({ day, month, year, voyages, today, onHover, onLeave }: {
  day: number; month: number; year: number;
  voyages: Voyage[];
  today: string;
  onHover: (v: Voyage, rect: DOMRect) => void;
  onLeave: () => void;
}) {
  const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const isToday = key === today;
  const MAX_VISIBLE = 4;
  const visible = voyages.slice(0, MAX_VISIBLE);
  const overflow = voyages.length - MAX_VISIBLE;

  return (
    <div style={{
      minHeight: 90,
      padding: '8px 8px 6px',
      border: '1px solid var(--gecko-border)',
      borderRadius: 8,
      background: isToday ? 'var(--gecko-primary-50)' : 'var(--gecko-bg-surface)',
      display: 'flex', flexDirection: 'column', gap: 4,
      position: 'relative',
    }}>
      {/* Day number */}
      <div style={{
        fontSize: 12, fontWeight: isToday ? 700 : 500,
        color: isToday ? 'var(--gecko-primary-700)' : 'var(--gecko-text-secondary)',
        lineHeight: 1,
        ...(isToday ? {
          width: 22, height: 22, background: 'var(--gecko-primary-600)', color: '#fff',
          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        } : {}),
      }}>
        {day}
      </div>

      {/* Voyage dots */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {visible.map(v => (
          <VoyageDot key={v.id} voyage={v} onHover={onHover} onLeave={onLeave} />
        ))}
        {overflow > 0 && (
          <div style={{
            width: 22, height: 22, borderRadius: 6, background: 'var(--gecko-gray-100)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700, color: 'var(--gecko-text-secondary)',
          }}>
            +{overflow}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────
function Legend() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {Object.entries(LINE_COLORS).map(([line, c]) => (
        <div key={line} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: c.text }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: c.dot }} />
          {line}
        </div>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function VesselSchedulePage() {
  const [month, setMonth] = useState(3); // April = 3 (0-indexed)
  const [year, setYear]   = useState(2026);
  const [hovered, setHovered] = useState<{ voyage: Voyage; rect: DOMRect } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const today = toKey(new Date('2026-04-25'));

  // Map ETD date → voyages
  const voyagesByDay = VOYAGES.reduce<Record<string, Voyage[]>>((acc, v) => {
    const d = v.etd.slice(0, 10);
    if (!acc[d]) acc[d] = [];
    acc[d].push(v);
    return acc;
  }, {});

  const daysInMonth  = getDaysInMonth(year, month);
  const firstDayDow  = getFirstDayOfMonth(year, month); // 0=Sun
  const blanks       = firstDayDow;
  const totalCells   = Math.ceil((blanks + daysInMonth) / 7) * 7;

  const handleHover = (voyage: Voyage, dotRect: DOMRect) => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    setHovered({ voyage, rect: dotRect });
  };
  const handleLeave = () => {
    leaveTimerRef.current = setTimeout(() => setHovered(null), 80);
  };

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const containerRect = containerRef.current?.getBoundingClientRect() ?? null;

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>

      {/* Page header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>Vessel Call Schedule</h1>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-primary-700)', background: 'var(--gecko-primary-100)', padding: '2px 8px', borderRadius: 12 }}>Calendar View</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>ETD-based voyage calendar for Laem Chabang ICD · hover a dot to see voyage details</div>
        </div>
        <div className="gecko-toolbar">
          <Link href="/masters/vessels" className="gecko-btn gecko-btn-ghost gecko-btn-sm">
            <Icon name="list" size={16} /> List View
          </Link>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm"><Icon name="download" size={16} /> Export</button>
          <Link href="/masters/vessels/schedule/new" className="gecko-btn gecko-btn-primary gecko-btn-sm">
            <Icon name="plus" size={16} /> New Voyage
          </Link>
        </div>
      </div>

      {/* Calendar card */}
      <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 14, boxShadow: 'var(--gecko-shadow-sm)', overflow: 'hidden' }}>

        {/* Calendar toolbar */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gecko-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm" onClick={prevMonth}>
              <Icon name="chevronLeft" size={16} />
            </button>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--gecko-text-primary)', minWidth: 160, textAlign: 'center' }}>
              {MONTH_NAMES[month]} {year}
            </span>
            <button className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm" onClick={nextMonth}>
              <Icon name="chevronRight" size={16} />
            </button>
            <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={() => { setMonth(3); setYear(2026); }} style={{ fontSize: 12 }}>
              Today
            </button>
          </div>
          <Legend />
        </div>

        {/* Day-of-week header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, padding: '12px 16px 4px', background: 'var(--gecko-bg-subtle)' }}>
          {DAY_LABELS.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 0' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div
          ref={containerRef}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, padding: '4px 16px 16px', background: 'var(--gecko-bg-subtle)', position: 'relative' }}
        >
          {Array.from({ length: totalCells }).map((_, idx) => {
            const dayNum = idx - blanks + 1;
            const isValid = dayNum >= 1 && dayNum <= daysInMonth;

            if (!isValid) {
              return <div key={idx} style={{ minHeight: 90, borderRadius: 8, background: 'transparent' }} />;
            }

            const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const dayVoyages = voyagesByDay[key] ?? [];

            return (
              <DayCell
                key={idx}
                day={dayNum}
                month={month}
                year={year}
                voyages={dayVoyages}
                today={today}
                onHover={handleHover}
                onLeave={handleLeave}
              />
            );
          })}

          {/* Popover */}
          {hovered && containerRect && (
            <VoyagePopover
              voyage={hovered.voyage}
              anchorRect={hovered.rect}
              containerRect={containerRect}
              onClose={() => setHovered(null)}
            />
          )}
        </div>
      </div>

      {/* Month summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Voyages this month', value: VOYAGES.filter(v => v.etd.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).length, icon: 'ship', color: 'var(--gecko-primary-600)', bg: 'var(--gecko-primary-50)' },
          { label: 'Open for booking',   value: VOYAGES.filter(v => v.etd.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`) && v.status === 'Open').length, icon: 'check', color: 'var(--gecko-success-600)', bg: 'var(--gecko-success-50)' },
          { label: 'Total TEU capacity', value: VOYAGES.filter(v => v.etd.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).reduce((s, v) => s + v.teu, 0).toLocaleString(), icon: 'layers', color: 'var(--gecko-info-600)', bg: 'var(--gecko-info-50)' },
          { label: 'Shipping lines',     value: [...new Set(VOYAGES.filter(v => v.etd.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).map(v => v.line))].length, icon: 'flag', color: 'var(--gecko-accent-600)', bg: 'var(--gecko-accent-50)' },
        ].map(stat => (
          <div key={stat.label} className="gecko-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={stat.icon} size={18} style={{ color: stat.color }} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gecko-text-primary)', lineHeight: 1 }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
