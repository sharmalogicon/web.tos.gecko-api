"use client";
import React, { useState, useMemo, useCallback } from 'react';
import { Icon } from '@/components/ui/Icon';
import { PageToolbar } from '@/components/ui/OpsPrimitives';

// ── Constants ─────────────────────────────────────────────────────────────────

const WINDOWS = [
  { id: 'w0', label: '06:00 – 08:00', start: '06:00', end: '08:00' },
  { id: 'w1', label: '08:00 – 10:00', start: '08:00', end: '10:00' },
  { id: 'w2', label: '10:00 – 12:00', start: '10:00', end: '12:00' },
  { id: 'w3', label: '12:00 – 14:00', start: '12:00', end: '14:00' },
  { id: 'w4', label: '14:00 – 16:00', start: '14:00', end: '16:00' },
  { id: 'w5', label: '16:00 – 18:00', start: '16:00', end: '18:00' },
  { id: 'w6', label: '18:00 – 20:00', start: '18:00', end: '20:00' },
];

const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_FULL  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTH_ABB  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const YARDS = ['Import Yard', 'Export Yard', 'Bonded Yard', 'Empty Depot'];

interface TemplateItem { id: string; label: string; icon: string; li: number; ei: number; lo: number; eo: number; status: SlotStatus; }

const TEMPLATES: TemplateItem[] = [
  { id: 'standard', label: 'Standard Weekday',  icon: 'trending',  li: 50, ei: 20, lo: 50, eo: 20, status: 'open'        },
  { id: 'reduced',  label: 'Reduced Weekend',   icon: 'arrowDown', li: 25, ei: 10, lo: 25, eo: 10, status: 'open'        },
  { id: 'peak',     label: 'Peak Season',       icon: 'flame',     li: 80, ei: 30, lo: 80, eo: 30, status: 'open'        },
  { id: 'night',    label: 'Night Shift Only',  icon: 'moon',      li: 20, ei: 10, lo: 20, eo: 10, status: 'restricted'  },
  { id: 'holiday',  label: 'Holiday Closure',   icon: 'x',         li: 0,  ei: 0,  lo: 0,  eo: 0,  status: 'holiday'    },
];

const STATUS_OPTIONS: { value: SlotStatus; label: string }[] = [
  { value: 'open',       label: 'Open — accepting appointments' },
  { value: 'restricted', label: 'Restricted — limited access' },
  { value: 'closed',     label: 'Closed — no appointments' },
  { value: 'holiday',    label: 'Holiday — facility closed' },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type SlotStatus = 'open' | 'restricted' | 'closed' | 'holiday';
type SlotKey = `${number}_${number}`;

interface SlotData {
  ladenIn: number;  emptyIn: number;
  ladenOut: number; emptyOut: number;
  bookedIn: number; bookedOut: number;
  status: SlotStatus;
  notes: string;
}

type Grid = Record<SlotKey, SlotData>;

const sk = (d: number, w: number): SlotKey => `${d}_${w}`;

// ── Seed sample grid ──────────────────────────────────────────────────────────

function seedGrid(): Grid {
  const g: Grid = {};
  // Deterministic "random" for SSR safety
  const pseudo = (seed: number) => ((seed * 16807 + 0) % 2147483647) / 2147483647;

  for (let d = 0; d < 7; d++) {
    const wkend = d >= 5; // Sat=5, Sun=6
    for (let w = 0; w < 7; w++) {
      const night = w === 6; // 18:00–20:00
      if (wkend && night) {
        g[sk(d, w)] = { ladenIn:0, emptyIn:0, ladenOut:0, emptyOut:0, bookedIn:0, bookedOut:0, status:'closed', notes:'Weekend night closure' };
        continue;
      }
      const li = wkend ? 25 : 50, ei = wkend ? 10 : 20;
      const lo = wkend ? 25 : 50, eo = wkend ? 10 : 20;
      // Peak: 08-12 slots on weekdays
      const peak = !wkend && (w === 1 || w === 2);
      const u = wkend ? 0.32 : peak ? 0.84 : night ? 0.30 : 0.58;
      const r1 = 0.8 + pseudo(d * 7 + w + 1) * 0.4;
      const r2 = 0.8 + pseudo(d * 7 + w + 50) * 0.4;
      g[sk(d, w)] = {
        ladenIn: li, emptyIn: ei, ladenOut: lo, emptyOut: eo,
        bookedIn:  Math.min(li + ei, Math.round((li + ei) * u * r1)),
        bookedOut: Math.min(lo + eo, Math.round((lo + eo) * u * r2)),
        status: night ? 'restricted' : 'open',
        notes: '',
      };
    }
  }
  return g;
}

// ── Week date helpers ─────────────────────────────────────────────────────────

function getWeekDates(offset: number): Date[] {
  // Anchor: Mon 4 May 2026
  const base = new Date(2026, 4, 4);
  base.setDate(base.getDate() + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function fmtWeekRange(dates: Date[]): string {
  const s = dates[0], e = dates[6];
  if (s.getMonth() === e.getMonth())
    return `${s.getDate()} – ${e.getDate()} ${MONTH_ABB[s.getMonth()]} ${s.getFullYear()}`;
  return `${s.getDate()} ${MONTH_ABB[s.getMonth()]} – ${e.getDate()} ${MONTH_ABB[e.getMonth()]} ${e.getFullYear()}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SlotStatus }) {
  const cfg: Record<SlotStatus, { label: string; bg: string; color: string }> = {
    open:       { label: 'Open',       bg: 'var(--gecko-success-50)',  color: 'var(--gecko-success-700)' },
    restricted: { label: 'Restricted', bg: 'var(--gecko-warning-50)',  color: 'var(--gecko-warning-700)' },
    closed:     { label: 'Closed',     bg: 'var(--gecko-error-50)',    color: 'var(--gecko-error-700)'   },
    holiday:    { label: 'Holiday',    bg: 'var(--gecko-bg-subtle)',   color: 'var(--gecko-text-disabled)' },
  };
  const c = cfg[status];
  return (
    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
      padding: '1px 5px', borderRadius: 3, background: c.bg, color: c.color, flexShrink: 0 }}>
      {c.label}
    </span>
  );
}

function UtilBar({ pct, status }: { pct: number; status: SlotStatus }) {
  const inactive = status === 'closed' || status === 'holiday';
  const color = pct >= 90 ? 'var(--gecko-error-500)' : pct >= 70 ? 'var(--gecko-warning-500)' : 'var(--gecko-success-500)';
  return (
    <div style={{ height: 3, borderRadius: 2, background: 'var(--gecko-border)', overflow: 'hidden' }}>
      {!inactive && (
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 2, transition: 'width 0.25s' }} />
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 150, padding: '14px 20px', background: 'var(--gecko-bg-surface)',
      border: '1px solid var(--gecko-border)', borderRadius: 10,
      borderTop: accent ? `3px solid ${accent}` : '3px solid var(--gecko-primary-500)' }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gecko-text-secondary)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, color: 'var(--gecko-text-primary)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function NumInput({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gecko-text-secondary)' }}>{label}</span>
      <input
        type="number" min={0} max={999}
        value={value}
        onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))}
        disabled={disabled}
        className="gecko-input gecko-input-sm"
        style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, height: 36 }}
      />
    </label>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GateSlotConfigPage() {
  const [weekOffset, setWeekOffset]   = useState(0);
  const [yard, setYard]               = useState('Import Yard');
  const [grid, setGrid]               = useState<Grid>(seedGrid);
  const [selected, setSelected]       = useState<SlotKey | null>(null);
  const [draft, setDraft]             = useState<SlotData | null>(null);
  const [tplOpen, setTplOpen]         = useState(false);
  const [yardOpen, setYardOpen]       = useState(false);
  const [savedMsg, setSavedMsg]       = useState('');
  const [unsaved, setUnsaved]         = useState(false);

  const dates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  // KPIs
  const kpi = useMemo(() => {
    const all = Object.values(grid);
    const active = all.filter(s => s.status !== 'closed' && s.status !== 'holiday');
    const totalCap = active.reduce((a, s) => a + s.ladenIn + s.emptyIn + s.ladenOut + s.emptyOut, 0);
    const totalBook = active.reduce((a, s) => a + s.bookedIn + s.bookedOut, 0);
    const util = totalCap > 0 ? Math.round(totalBook / totalCap * 100) : 0;
    const closedCount = all.filter(s => s.status === 'closed' || s.status === 'holiday').length;
    return { totalCap, totalBook, util, closedCount, activeCount: active.length };
  }, [grid]);

  const handleCellClick = useCallback((d: number, w: number) => {
    const k = sk(d, w);
    setSelected(k);
    setDraft({ ...grid[k] });
  }, [grid]);

  const handleDraftChange = (patch: Partial<SlotData>) => {
    setDraft(prev => prev ? { ...prev, ...patch } : prev);
    setUnsaved(true);
  };

  const handleSaveSlot = () => {
    if (!selected || !draft) return;
    setGrid(g => ({ ...g, [selected]: { ...draft } }));
    setSavedMsg('Slot saved');
    setUnsaved(false);
    setTimeout(() => setSavedMsg(''), 2500);
  };

  const handleClosePanel = () => {
    setSelected(null);
    setDraft(null);
    setUnsaved(false);
  };

  const applyTemplate = (t: typeof TEMPLATES[0], scope: 'all' | 'weekdays' | 'weekends') => {
    setGrid(g => {
      const next = { ...g };
      for (let d = 0; d < 7; d++) {
        const wkend = d >= 5;
        if (scope === 'weekdays' && wkend) continue;
        if (scope === 'weekends' && !wkend) continue;
        for (let w = 0; w < 7; w++) {
          next[sk(d, w)] = {
            ...next[sk(d, w)],
            ladenIn: t.li, emptyIn: t.ei,
            ladenOut: t.lo, emptyOut: t.eo,
            status: t.status,
          };
        }
      }
      return next;
    });
    setTplOpen(false);
    setSavedMsg(`Template "${t.label}" applied`);
    setTimeout(() => setSavedMsg(''), 2500);
  };

  const copyToPrevWeek = () => {
    setWeekOffset(o => o - 1);
    setSavedMsg('Navigated to previous week with copied template');
    setTimeout(() => setSavedMsg(''), 2500);
  };

  // Parse selected slot info
  const selParts = selected ? selected.split('_').map(Number) : null;
  const [selD, selW] = selParts ?? [null, null];
  const selSlotLabel = selD !== null && selW !== null
    ? `${DAYS_FULL[selD]} · ${WINDOWS[selW].label}`
    : '';

  const panelOpen = selected !== null && draft !== null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gecko-space-4)' }}>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Gate Slot Capacity</h1>
            <span className="gecko-badge gecko-badge-info" style={{ fontSize: 10 }}>Super User</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)' }}>
            Configure appointment capacity windows per yard — controls how many trucks can be processed per time slot.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {savedMsg && (
            <span style={{ fontSize: 12, color: 'var(--gecko-success-600)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icon name="checkCircle" size={14} /> {savedMsg}
            </span>
          )}
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => {}} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="copy" size={14} /> Copy to Next Week
          </button>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => {}} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="download" size={14} /> Export
          </button>
        </div>
      </div>

      {/* ── Controls: Week Nav + Yard + Template ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        padding: '10px 16px', background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 10 }}>

        {/* Week Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm"
            onClick={() => setWeekOffset(o => o - 1)} title="Previous week">
            <Icon name="chevronLeft" size={16} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 12px',
            background: 'var(--gecko-bg-subtle)', borderRadius: 6, minWidth: 230, justifyContent: 'center' }}>
            <Icon name="calendar" size={14} style={{ color: 'var(--gecko-primary-500)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>
              Week of {fmtWeekRange(dates)}
            </span>
          </div>
          <button className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm"
            onClick={() => setWeekOffset(o => o + 1)} title="Next week">
            <Icon name="chevronRight" size={16} />
          </button>
          {weekOffset !== 0 && (
            <button className="gecko-btn gecko-btn-ghost gecko-btn-sm"
              onClick={() => setWeekOffset(0)} style={{ fontSize: 11, color: 'var(--gecko-primary-600)', marginLeft: 4 }}>
              Today
            </button>
          )}
        </div>

        <div style={{ width: 1, height: 28, background: 'var(--gecko-border)', margin: '0 4px' }} />

        {/* Yard Selector */}
        <div style={{ position: 'relative' }}>
          <button
            className="gecko-btn gecko-btn-outline gecko-btn-sm"
            onClick={() => setYardOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 160 }}>
            <Icon name="mapPin" size={13} style={{ color: 'var(--gecko-primary-500)' }} />
            <span style={{ fontWeight: 600 }}>{yard}</span>
            <Icon name="chevronDown" size={12} style={{ marginLeft: 'auto', color: 'var(--gecko-text-secondary)' }} />
          </button>
          {yardOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: 4,
              background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)',
              borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 180, overflow: 'hidden' }}>
              {YARDS.map(y => (
                <button key={y}
                  onClick={() => { setYard(y); setYardOpen(false); }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px',
                    background: y === yard ? 'var(--gecko-primary-50)' : 'transparent',
                    color: y === yard ? 'var(--gecko-primary-700)' : 'var(--gecko-text-primary)',
                    fontWeight: y === yard ? 700 : 400, fontSize: 13, border: 'none', cursor: 'pointer',
                    fontFamily: 'inherit' }}>
                  {y}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ width: 1, height: 28, background: 'var(--gecko-border)', margin: '0 4px' }} />

        {/* Template Quick-Apply */}
        <div style={{ position: 'relative' }}>
          <button
            className="gecko-btn gecko-btn-primary gecko-btn-sm"
            onClick={() => setTplOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Icon name="lightning" size={13} />
            Apply Template
            <Icon name="chevronDown" size={12} style={{ opacity: 0.8 }} />
          </button>
          {tplOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: 4,
              background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)',
              borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.14)', minWidth: 340, overflow: 'hidden' }}>
              <div style={{ padding: '8px 14px 6px', borderBottom: '1px solid var(--gecko-border)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gecko-text-secondary)' }}>
                  Quick-Apply Templates
                </div>
              </div>
              {TEMPLATES.map(t => (
                <div key={t.id} style={{ borderBottom: '1px solid var(--gecko-bg-subtle)' }}>
                  <div style={{ padding: '8px 14px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{t.label}</span>
                    {t.status !== 'holiday' && t.status !== 'closed' && (
                      <span style={{ fontSize: 10, color: 'var(--gecko-text-secondary)' }}>
                        IN {t.li}L+{t.ei}E · OUT {t.lo}L+{t.eo}E
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4, padding: '2px 14px 8px' }}>
                    {(['all', 'weekdays', 'weekends'] as const).map(scope => (
                      <button key={scope}
                        onClick={() => applyTemplate(t, scope)}
                        className="gecko-btn gecko-btn-outline gecko-btn-sm"
                        style={{ fontSize: 11, padding: '2px 10px', height: 26 }}>
                        {scope === 'all' ? 'Whole Week' : scope === 'weekdays' ? 'Mon–Fri' : 'Sat–Sun'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button
                onClick={() => setTplOpen(false)}
                className="gecko-btn gecko-btn-ghost gecko-btn-sm"
                style={{ width: '100%', padding: '8px 14px', fontSize: 11, color: 'var(--gecko-text-secondary)' }}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <KpiCard
          label="Total Slot Capacity"
          value={kpi.totalCap.toLocaleString()}
          sub={`${kpi.activeCount} active windows · ${yard}`}
          accent="var(--gecko-primary-500)"
        />
        <KpiCard
          label="Appointments Booked"
          value={kpi.totalBook.toLocaleString()}
          sub={`This week (${kpi.util}% utilization)`}
          accent={kpi.util >= 90 ? 'var(--gecko-error-500)' : kpi.util >= 70 ? 'var(--gecko-warning-500)' : 'var(--gecko-success-500)'}
        />
        <KpiCard
          label="Avg Utilization"
          value={`${kpi.util}%`}
          sub={kpi.util >= 90 ? '⚠ Near capacity — consider peak template' : kpi.util >= 70 ? 'Filling up — monitor closely' : 'Healthy headroom available'}
          accent={kpi.util >= 90 ? 'var(--gecko-error-500)' : kpi.util >= 70 ? 'var(--gecko-warning-500)' : 'var(--gecko-success-500)'}
        />
        <KpiCard
          label="Closed / Holiday Slots"
          value={kpi.closedCount}
          sub={`Out of 49 total windows this week`}
          accent={kpi.closedCount > 10 ? 'var(--gecko-warning-500)' : 'var(--gecko-gray-300)'}
        />
      </div>

      {/* ── Main layout: grid + edit panel ── */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* ── Slot Grid ── */}
        <div style={{ flex: 1, minWidth: 0, background: 'var(--gecko-bg-surface)',
          border: '1px solid var(--gecko-border)', borderRadius: 10, overflow: 'hidden' }}>

          {/* Legend + header */}
          <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid var(--gecko-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>
              Weekly Slot Grid — {yard}
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--gecko-text-secondary)', flexWrap: 'wrap' }}>
              {[
                { color: 'var(--gecko-success-500)', label: '< 70% available' },
                { color: 'var(--gecko-warning-500)', label: '70–90% filling up' },
                { color: 'var(--gecko-error-500)',   label: '> 90% near full' },
              ].map(l => (
                <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 10, height: 4, borderRadius: 2, background: l.color, display: 'inline-block' }} />
                  {l.label}
                </span>
              ))}
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon name="info" size={12} style={{ color: 'var(--gecko-text-disabled)' }} />
                L = laden, E = empty
              </span>
            </div>
          </div>

          {/* Grid */}
          <div style={{ overflowX: 'auto', padding: 12 }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 4, width: '100%', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 110 }} />
                {DAYS_SHORT.map(d => <col key={d} />)}
              </colgroup>
              <thead>
                <tr>
                  <th style={{ padding: '4px 8px', textAlign: 'left', fontSize: 10, fontWeight: 700,
                    color: 'var(--gecko-text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Time Window
                  </th>
                  {dates.map((dt, i) => (
                    <th key={i} style={{ padding: '4px 4px', textAlign: 'center',
                      fontSize: 11, fontWeight: 700, color: i >= 5 ? 'var(--gecko-warning-600)' : 'var(--gecko-text-primary)' }}>
                      <div>{DAYS_SHORT[i]}</div>
                      <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--gecko-text-secondary)', marginTop: 1 }}>
                        {dt.getDate()} {MONTH_ABB[dt.getMonth()]}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WINDOWS.map((win, wi) => (
                  <tr key={win.id}>
                    {/* Time label */}
                    <td style={{ padding: '4px 8px 4px 0', verticalAlign: 'middle' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>
                        {win.start}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)' }}>– {win.end}</div>
                    </td>
                    {/* Cells */}
                    {DAYS_SHORT.map((_, di) => {
                      const k = sk(di, wi);
                      const slot = grid[k];
                      const isSel = selected === k;
                      const inactive = slot.status === 'closed' || slot.status === 'holiday';
                      const cap = slot.ladenIn + slot.emptyIn + slot.ladenOut + slot.emptyOut;
                      const booked = slot.bookedIn + slot.bookedOut;
                      const pct = cap > 0 ? Math.round(booked / cap * 100) : 0;

                      return (
                        <td key={di} style={{ padding: 2, verticalAlign: 'top' }}>
                          <div
                            onClick={() => handleCellClick(di, wi)}
                            style={{
                              padding: '7px 9px',
                              borderRadius: 7,
                              border: isSel ? '2px solid var(--gecko-primary-500)' : '1px solid var(--gecko-border)',
                              background: isSel
                                ? 'var(--gecko-primary-50)'
                                : inactive ? 'var(--gecko-bg-subtle)' : '#fff',
                              cursor: 'pointer',
                              minHeight: 88,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 3,
                              transition: 'border-color 0.12s, background 0.12s',
                              userSelect: 'none',
                            }}
                          >
                            {/* Top row: status badge + pct */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <StatusBadge status={slot.status} />
                              {!inactive && (
                                <span style={{ fontSize: 9, fontWeight: 700,
                                  color: pct >= 90 ? 'var(--gecko-error-600)' : pct >= 70 ? 'var(--gecko-warning-700)' : 'var(--gecko-success-700)' }}>
                                  {pct}%
                                </span>
                              )}
                            </div>

                            {inactive ? (
                              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: 11, color: 'var(--gecko-text-disabled)' }}>—</span>
                              </div>
                            ) : (
                              <>
                                {/* IN / OUT capacity */}
                                <div style={{ fontSize: 10, lineHeight: 1.6, marginTop: 2 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                                    <span style={{ color: 'var(--gecko-primary-600)', fontWeight: 700, fontSize: 9, letterSpacing: '0.04em' }}>IN</span>
                                    <span style={{ color: 'var(--gecko-text-secondary)' }}>{slot.ladenIn}L·{slot.emptyIn}E</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                                    <span style={{ color: 'var(--gecko-success-600)', fontWeight: 700, fontSize: 9, letterSpacing: '0.04em' }}>OUT</span>
                                    <span style={{ color: 'var(--gecko-text-secondary)' }}>{slot.ladenOut}L·{slot.emptyOut}E</span>
                                  </div>
                                </div>
                                {/* Utilization bar */}
                                <UtilBar pct={pct} status={slot.status} />
                                {/* Booked count */}
                                <div style={{ fontSize: 9, color: 'var(--gecko-text-disabled)', textAlign: 'right', marginTop: 1 }}>
                                  {booked}/{cap}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Grid footer */}
          <div style={{ padding: '8px 16px', borderTop: '1px solid var(--gecko-border)',
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--gecko-text-secondary)' }}>
            <Icon name="info" size={13} />
            Click any cell to configure its capacity. Hold Shift and click multiple cells for bulk edit.
            Capacity changes take effect from the next appointment booking refresh.
          </div>
        </div>

        {/* ── Edit Panel ── */}
        {panelOpen && draft && (
          <div style={{
            width: 340, flexShrink: 0,
            background: 'var(--gecko-bg-surface)',
            border: '1px solid var(--gecko-border)',
            borderRadius: 10, overflow: 'hidden',
            position: 'sticky', top: 80,
            boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
          }}>
            {/* Panel header */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gecko-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--gecko-primary-600)' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Edit Slot</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>{selSlotLabel}</div>
              </div>
              <button
                onClick={handleClosePanel}
                className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm"
                style={{ color: 'rgba(255,255,255,0.8)' }}>
                <Icon name="x" size={16} />
              </button>
            </div>

            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>

              {/* Status */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: 'var(--gecko-text-secondary)', display: 'block', marginBottom: 6 }}>
                  Slot Status
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {STATUS_OPTIONS.map(opt => (
                    <label key={opt.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer',
                      padding: '7px 10px', borderRadius: 7,
                      background: draft.status === opt.value ? 'var(--gecko-primary-50)' : 'var(--gecko-bg-subtle)',
                      border: `1px solid ${draft.status === opt.value ? 'var(--gecko-primary-200)' : 'var(--gecko-border)'}` }}>
                      <input type="radio" name="status" value={opt.value}
                        checked={draft.status === opt.value}
                        onChange={() => handleDraftChange({ status: opt.value })}
                        style={{ marginTop: 2, accentColor: 'var(--gecko-primary-600)' }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>
                          {opt.value.charAt(0).toUpperCase() + opt.value.slice(1)}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', marginTop: 1 }}>{opt.label}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Gate-IN capacity */}
              {(draft.status === 'open' || draft.status === 'restricted') && (
                <>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--gecko-primary-100)',
                        color: 'var(--gecko-primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 800, letterSpacing: '0.05em', flexShrink: 0 }}>IN</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>Gate-IN Capacity</div>
                        <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)' }}>Drop-off containers arriving this window</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <NumInput label="Laden Drop-off" value={draft.ladenIn}
                        onChange={v => handleDraftChange({ ladenIn: v })} />
                      <NumInput label="Empty Return" value={draft.emptyIn}
                        onChange={v => handleDraftChange({ emptyIn: v })} />
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--gecko-text-secondary)', textAlign: 'right' }}>
                      Total IN capacity: <strong>{draft.ladenIn + draft.emptyIn}</strong> TEU
                    </div>
                  </div>

                  {/* Gate-OUT capacity */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--gecko-success-100)',
                        color: 'var(--gecko-success-700)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 800, letterSpacing: '0.05em', flexShrink: 0 }}>OUT</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>Gate-OUT Capacity</div>
                        <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)' }}>Pickups releasing from yard this window</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <NumInput label="Laden Pickup" value={draft.ladenOut}
                        onChange={v => handleDraftChange({ ladenOut: v })} />
                      <NumInput label="Empty Release" value={draft.emptyOut}
                        onChange={v => handleDraftChange({ emptyOut: v })} />
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--gecko-text-secondary)', textAlign: 'right' }}>
                      Total OUT capacity: <strong>{draft.ladenOut + draft.emptyOut}</strong> TEU
                    </div>
                  </div>

                  {/* Utilization summary */}
                  <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--gecko-bg-subtle)',
                    border: '1px solid var(--gecko-border)', fontSize: 11 }}>
                    <div style={{ fontWeight: 700, color: 'var(--gecko-text-primary)', marginBottom: 4 }}>Window Summary</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--gecko-text-secondary)' }}>
                      <span>Combined capacity</span>
                      <strong style={{ color: 'var(--gecko-text-primary)' }}>
                        {draft.ladenIn + draft.emptyIn + draft.ladenOut + draft.emptyOut} trucks
                      </strong>
                    </div>
                    {(() => {
                      const slotNow = selected ? grid[selected] : null;
                      if (!slotNow) return null;
                      const booked = slotNow.bookedIn + slotNow.bookedOut;
                      const cap = draft.ladenIn + draft.emptyIn + draft.ladenOut + draft.emptyOut;
                      const pct = cap > 0 ? Math.round(booked / cap * 100) : 0;
                      return (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                          <span style={{ color: 'var(--gecko-text-secondary)' }}>Currently booked</span>
                          <strong style={{ color: pct >= 90 ? 'var(--gecko-error-600)' : pct >= 70 ? 'var(--gecko-warning-700)' : 'var(--gecko-success-700)' }}>
                            {booked} ({pct}%)
                          </strong>
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}

              {/* Notes */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: 'var(--gecko-text-secondary)', display: 'block', marginBottom: 6 }}>
                  Notes / Reason
                </label>
                <textarea
                  value={draft.notes}
                  onChange={e => handleDraftChange({ notes: e.target.value })}
                  rows={2}
                  placeholder="e.g. Labour shortage, vessel delay, public holiday…"
                  className="gecko-input"
                  style={{ width: '100%', resize: 'vertical', fontSize: 12, padding: '8px 10px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Panel footer actions */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--gecko-border)',
              display: 'flex', gap: 8, justifyContent: 'flex-end', background: 'var(--gecko-bg-subtle)' }}>
              <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={handleClosePanel}>
                Cancel
              </button>
              <button
                className="gecko-btn gecko-btn-primary gecko-btn-sm"
                onClick={handleSaveSlot}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="save" size={13} /> Save Slot
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── How-to guide ── */}
      <div style={{ padding: '12px 16px', background: 'var(--gecko-primary-50)',
        border: '1px solid var(--gecko-primary-100)', borderRadius: 8,
        display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Icon name="info" size={16} style={{ color: 'var(--gecko-primary-600)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12, color: 'var(--gecko-primary-800)', lineHeight: 1.6 }}>
          <strong>How slot capacity works:</strong> Each time window defines the maximum number of trucks
          the gate can process. <em>Laden</em> containers count against export/import limits.
          <em>Empty</em> containers (returns/releases) have separate counters.
          Hauliers booking appointments will see &quot;Fully Booked&quot; once a window reaches 100%.
          Use <strong>Restricted</strong> to allow manual overrides by gate supervisors only.
          Templates apply instantly across the selected scope — individual slots can then be tuned.
        </div>
      </div>
    </div>
  );
}
