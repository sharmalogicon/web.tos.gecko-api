"use client";
import React, { useState, useMemo } from 'react';
import { Icon } from '@/components/ui/Icon';
import { PageToolbar } from '@/components/ui/OpsPrimitives';

// ── Types ──────────────────────────────────────────────────────────────────────

interface DaySchedule {
  day: string;
  open: boolean;
  openTime: string;
  closeTime: string;
  breakStart: string;
  breakEnd: string;
}

type HolidayType = 'National' | 'Local' | 'Facility';
type HolidayScope = 'All Yards' | 'Import Yard' | 'Export Yard' | 'Bonded Yard' | 'Empty Depot';

interface PublicHoliday {
  id: string;
  date: string;
  name: string;
  type: HolidayType;
  scope: HolidayScope;
  notes: string;
}

// ── Seed data ──────────────────────────────────────────────────────────────────

const SEED_SCHEDULE: DaySchedule[] = [
  { day: 'Monday',    open: true,  openTime: '06:00', closeTime: '20:00', breakStart: '12:00', breakEnd: '13:00' },
  { day: 'Tuesday',   open: true,  openTime: '06:00', closeTime: '20:00', breakStart: '12:00', breakEnd: '13:00' },
  { day: 'Wednesday', open: true,  openTime: '06:00', closeTime: '20:00', breakStart: '12:00', breakEnd: '13:00' },
  { day: 'Thursday',  open: true,  openTime: '06:00', closeTime: '20:00', breakStart: '12:00', breakEnd: '13:00' },
  { day: 'Friday',    open: true,  openTime: '06:00', closeTime: '20:00', breakStart: '12:00', breakEnd: '13:00' },
  { day: 'Saturday',  open: true,  openTime: '07:00', closeTime: '17:00', breakStart: '12:00', breakEnd: '13:00' },
  { day: 'Sunday',    open: false, openTime: '06:00', closeTime: '20:00', breakStart: '12:00', breakEnd: '13:00' },
];

const SEED_HOLIDAYS: PublicHoliday[] = [
  { id: 'h1', date: '2026-05-04', name: 'Labour Day',                  type: 'National', scope: 'All Yards',    notes: 'Compensatory day observed' },
  { id: 'h2', date: '2026-05-11', name: 'Visakha Bucha Day',           type: 'National', scope: 'All Yards',    notes: 'Buddhist holiday' },
  { id: 'h3', date: '2026-07-28', name: "King's Birthday",             type: 'National', scope: 'All Yards',    notes: 'HM King Vajiralongkorn' },
  { id: 'h4', date: '2026-08-12', name: "Queen's Birthday",            type: 'National', scope: 'All Yards',    notes: "National Mother's Day" },
  { id: 'h5', date: '2026-10-13', name: 'King Bhumibol Memorial Day',  type: 'National', scope: 'All Yards',    notes: 'Day of mourning' },
  { id: 'h6', date: '2026-10-23', name: 'Chulalongkorn Day',           type: 'National', scope: 'All Yards',    notes: 'Chula Day (Royal Ploughing)' },
  { id: 'h7', date: '2026-12-05', name: 'King Rama IX Birthday',       type: 'National', scope: 'All Yards',    notes: "National Father's Day" },
  { id: 'h8', date: '2026-12-31', name: "New Year's Eve",              type: 'Local',    scope: 'Import Yard',  notes: 'Reduced hours from 12:00' },
];

const TODAY_ISO = '2026-05-04';

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function computeTotalHours(day: DaySchedule): string {
  if (!day.open) return '—';
  const open  = parseMinutes(day.openTime);
  const close = parseMinutes(day.closeTime);
  if (close <= open) return '—';
  const breakMins = parseMinutes(day.breakEnd) - parseMinutes(day.breakStart);
  const total = close - open - Math.max(0, breakMins);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} hrs` : `${h}h ${m}m`;
}

function computeTotalHoursNum(day: DaySchedule): number {
  if (!day.open) return 0;
  const open  = parseMinutes(day.openTime);
  const close = parseMinutes(day.closeTime);
  if (close <= open) return 0;
  const breakMins = parseMinutes(day.breakEnd) - parseMinutes(day.breakStart);
  const total = close - open - Math.max(0, breakMins);
  return total / 60;
}

function holidayStatus(dateStr: string): { label: string; bg: string; color: string } {
  if (dateStr === TODAY_ISO)   return { label: 'Today',    bg: 'var(--gecko-warning-50)',  color: 'var(--gecko-warning-700)' };
  if (dateStr > TODAY_ISO)     return { label: 'Upcoming', bg: 'var(--gecko-success-50)',  color: 'var(--gecko-success-700)' };
  return                              { label: 'Past',     bg: 'var(--gecko-bg-subtle)',   color: 'var(--gecko-text-disabled)' };
}

function formatHolidayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dt = new Date(y, m - 1, d);
  return `${DAYS[dt.getDay()]} ${d} ${MONTHS[m - 1]} ${y}`;
}

function nextClosureDate(holidays: PublicHoliday[], schedule: DaySchedule[]): string {
  const upcoming = holidays
    .filter(h => h.date >= TODAY_ISO)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (upcoming.length === 0) {
    const sunday = schedule.find(d => d.day === 'Sunday');
    return sunday && !sunday.open ? 'Sun (weekly)' : 'None scheduled';
  }
  return formatHolidayDate(upcoming[0].date).split(' ').slice(1).join(' ');
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 150, padding: '14px 20px',
      background: 'var(--gecko-bg-surface)',
      border: '1px solid var(--gecko-border)',
      borderRadius: 10,
      borderTop: `3px solid ${accent ?? 'var(--gecko-primary-500)'}`,
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gecko-text-secondary)', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, color: 'var(--gecko-text-primary)' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Tab 1: Weekly Schedule ─────────────────────────────────────────────────────

function WeeklyScheduleTab() {
  const [schedule, setSchedule] = useState<DaySchedule[]>(SEED_SCHEDULE);
  const [savedMsg, setSavedMsg] = useState('');

  const updateDay = (idx: number, patch: Partial<DaySchedule>) => {
    setSchedule(prev => prev.map((d, i) => i === idx ? { ...d, ...patch } : d));
  };

  const copyWeekdayToWeekend = () => {
    const ref = schedule[0]; // Monday
    setSchedule(prev => prev.map((d, i) =>
      i >= 5 ? { ...d, openTime: ref.openTime, closeTime: ref.closeTime, breakStart: ref.breakStart, breakEnd: ref.breakEnd } : d
    ));
  };

  const applyToAllDays = () => {
    const ref = schedule[0];
    setSchedule(prev => prev.map(d => ({
      ...d,
      openTime: ref.openTime,
      closeTime: ref.closeTime,
      breakStart: ref.breakStart,
      breakEnd: ref.breakEnd,
    })));
  };

  const copyFromPrevious = (idx: number) => {
    if (idx === 0) return;
    const prev = schedule[idx - 1];
    updateDay(idx, { openTime: prev.openTime, closeTime: prev.closeTime, breakStart: prev.breakStart, breakEnd: prev.breakEnd });
  };

  const handleSave = () => {
    setSavedMsg('Schedule saved');
    setTimeout(() => setSavedMsg(''), 2500);
  };

  const summary = useMemo(() => {
    const daysOpen = schedule.filter(d => d.open).length;
    const totalHours = schedule.reduce((acc, d) => acc + computeTotalHoursNum(d), 0);
    const openDays = schedule.filter(d => d.open);
    const earliest = openDays.length > 0 ? openDays.reduce((a, b) => a.openTime < b.openTime ? a : b).openTime : '—';
    const latest   = openDays.length > 0 ? openDays.reduce((a, b) => a.closeTime > b.closeTime ? a : b).closeTime : '—';
    return { daysOpen, totalHours, earliest, latest };
  }, [schedule]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Controls bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        padding: '10px 16px',
        background: 'var(--gecko-bg-surface)',
        border: '1px solid var(--gecko-border)',
        borderRadius: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Icon name="calendar" size={14} style={{ color: 'var(--gecko-primary-500)' }} />
          <span style={{ fontSize: 12, color: 'var(--gecko-text-secondary)' }}>Effective from:</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>01 May 2026</span>
        </div>

        <div style={{ width: 1, height: 24, background: 'var(--gecko-border)', margin: '0 4px' }} />

        <button
          className="gecko-btn gecko-btn-ghost gecko-btn-sm"
          onClick={copyWeekdayToWeekend}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="copy" size={13} />
          Copy weekday pattern to weekend
        </button>

        <button
          className="gecko-btn gecko-btn-ghost gecko-btn-sm"
          onClick={applyToAllDays}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="refresh" size={13} />
          Apply to all days
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {savedMsg && (
            <span style={{ fontSize: 12, color: 'var(--gecko-success-600)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icon name="checkCircle" size={13} /> {savedMsg}
            </span>
          )}
          <button
            className="gecko-btn gecko-btn-primary gecko-btn-sm"
            onClick={handleSave}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="save" size={13} />
            Save Changes
          </button>
        </div>
      </div>

      {/* Schedule table */}
      <div style={{
        background: 'var(--gecko-bg-surface)',
        border: '1px solid var(--gecko-border)',
        borderRadius: 10, overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)' }}>
                {['Day', 'Status', 'Opening Time', 'Closing Time', 'Lunch Break', 'Total Hours', 'Actions'].map(col => (
                  <th key={col} style={{
                    padding: '9px 14px', textAlign: 'left',
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
                    color: 'var(--gecko-text-secondary)', whiteSpace: 'nowrap',
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schedule.map((day, idx) => {
                const isWeekend = idx >= 5;
                const totalLabel = computeTotalHours(day);
                return (
                  <tr
                    key={day.day}
                    style={{
                      borderBottom: idx < 6 ? '1px solid var(--gecko-border)' : 'none',
                      background: !day.open ? 'var(--gecko-bg-subtle)' : isWeekend ? 'var(--gecko-warning-50,#fffbeb)' : '#fff',
                    }}
                  >
                    {/* Day */}
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                          background: isWeekend ? 'var(--gecko-warning-100)' : 'var(--gecko-primary-100)',
                          color: isWeekend ? 'var(--gecko-warning-700)' : 'var(--gecko-primary-700)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, fontWeight: 800, letterSpacing: '0.04em',
                        }}>
                          {day.day.slice(0, 3).toUpperCase()}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>
                          {day.day}
                        </span>
                      </div>
                    </td>

                    {/* Status toggle */}
                    <td style={{ padding: '12px 14px' }}>
                      <button
                        onClick={() => updateDay(idx, { open: !day.open })}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
                          fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
                          background: day.open ? 'var(--gecko-success-100)' : 'var(--gecko-gray-100,#f3f4f6)',
                          color: day.open ? 'var(--gecko-success-700)' : 'var(--gecko-text-disabled)',
                          transition: 'background 0.15s, color 0.15s',
                        }}
                        title={`Click to mark as ${day.open ? 'Closed' : 'Open'}`}
                      >
                        {day.open
                          ? <><Icon name="checkCircle" size={12} /> Open</>
                          : <><Icon name="x" size={12} /> Closed</>
                        }
                      </button>
                    </td>

                    {/* Opening time */}
                    <td style={{ padding: '12px 14px' }}>
                      {day.open ? (
                        <input
                          type="time"
                          value={day.openTime}
                          onChange={e => updateDay(idx, { openTime: e.target.value })}
                          className="gecko-input gecko-input-sm"
                          style={{ width: 110, fontVariantNumeric: 'tabular-nums' }}
                        />
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--gecko-text-disabled)' }}>—</span>
                      )}
                    </td>

                    {/* Closing time */}
                    <td style={{ padding: '12px 14px' }}>
                      {day.open ? (
                        <input
                          type="time"
                          value={day.closeTime}
                          onChange={e => updateDay(idx, { closeTime: e.target.value })}
                          className="gecko-input gecko-input-sm"
                          style={{ width: 110, fontVariantNumeric: 'tabular-nums' }}
                        />
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--gecko-text-disabled)' }}>—</span>
                      )}
                    </td>

                    {/* Lunch break */}
                    <td style={{ padding: '12px 14px' }}>
                      {day.open ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="time"
                            value={day.breakStart}
                            onChange={e => updateDay(idx, { breakStart: e.target.value })}
                            className="gecko-input gecko-input-sm"
                            style={{ width: 100, fontVariantNumeric: 'tabular-nums' }}
                          />
                          <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', flexShrink: 0 }}>–</span>
                          <input
                            type="time"
                            value={day.breakEnd}
                            onChange={e => updateDay(idx, { breakEnd: e.target.value })}
                            className="gecko-input gecko-input-sm"
                            style={{ width: 100, fontVariantNumeric: 'tabular-nums' }}
                          />
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--gecko-text-disabled)' }}>—</span>
                      )}
                    </td>

                    {/* Total hours */}
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        fontSize: 13, fontWeight: 700,
                        color: day.open ? 'var(--gecko-text-primary)' : 'var(--gecko-text-disabled)',
                      }}>
                        {totalLabel}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 14px' }}>
                      <button
                        className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm"
                        onClick={() => copyFromPrevious(idx)}
                        disabled={idx === 0}
                        title={idx === 0 ? 'No previous day' : `Copy from ${schedule[idx - 1].day}`}
                        style={{ opacity: idx === 0 ? 0.3 : 1 }}
                      >
                        <Icon name="copy" size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Weekly summary bar */}
        <div style={{
          borderTop: '2px solid var(--gecko-border)',
          padding: '12px 16px',
          background: 'var(--gecko-bg-subtle)',
          display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Icon name="clock" size={14} style={{ color: 'var(--gecko-primary-500)' }} />
            <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>Total operating hours this week:</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>
              {summary.totalHours % 1 === 0 ? `${summary.totalHours} hrs` : `${summary.totalHours.toFixed(1)} hrs`}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Icon name="checkCircle" size={14} style={{ color: 'var(--gecko-success-500)' }} />
            <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>Days open:</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>
              {summary.daysOpen} / 7 days
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Icon name="arrowUp" size={13} style={{ color: 'var(--gecko-success-600)' }} />
            <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>Earliest open:</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{summary.earliest}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Icon name="arrowDown" size={13} style={{ color: 'var(--gecko-warning-600)' }} />
            <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>Latest close:</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{summary.latest}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab 2: Public Holidays ─────────────────────────────────────────────────────

const EMPTY_HOLIDAY: Omit<PublicHoliday, 'id'> = {
  date: '',
  name: '',
  type: 'National',
  scope: 'All Yards',
  notes: '',
};

function PublicHolidaysTab() {
  const [holidays, setHolidays] = useState<PublicHoliday[]>(SEED_HOLIDAYS);
  const [showAddForm, setShowAddForm] = useState(false);
  const [draft, setDraft] = useState<Omit<PublicHoliday, 'id'>>(EMPTY_HOLIDAY);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<PublicHoliday>>({});

  const handleAddSubmit = () => {
    if (!draft.date || !draft.name) return;
    const newHoliday: PublicHoliday = { ...draft, id: `h${Date.now()}` };
    setHolidays(prev => [...prev, newHoliday].sort((a, b) => a.date.localeCompare(b.date)));
    setDraft(EMPTY_HOLIDAY);
    setShowAddForm(false);
  };

  const handleDelete = (id: string) => {
    setHolidays(prev => prev.filter(h => h.id !== id));
  };

  const handleEditStart = (h: PublicHoliday) => {
    setEditId(h.id);
    setEditDraft({ ...h });
  };

  const handleEditSave = () => {
    setHolidays(prev => prev.map(h => h.id === editId ? { ...h, ...editDraft } as PublicHoliday : h));
    setEditId(null);
    setEditDraft({});
  };

  const TYPE_OPTIONS: HolidayType[] = ['National', 'Local', 'Facility'];
  const SCOPE_OPTIONS: HolidayScope[] = ['All Yards', 'Import Yard', 'Export Yard', 'Bonded Yard', 'Empty Depot'];

  const typeBadge = (t: HolidayType) => {
    const cfg: Record<HolidayType, { bg: string; color: string }> = {
      National: { bg: 'var(--gecko-primary-50)', color: 'var(--gecko-primary-700)' },
      Local:    { bg: 'var(--gecko-warning-50)', color: 'var(--gecko-warning-700)' },
      Facility: { bg: 'var(--gecko-bg-subtle)',  color: 'var(--gecko-text-secondary)' },
    };
    return cfg[t];
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Table card */}
      <div style={{
        background: 'var(--gecko-bg-surface)',
        border: '1px solid var(--gecko-border)',
        borderRadius: 10, overflow: 'hidden',
      }}>
        {/* Table header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--gecko-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="calendar" size={15} style={{ color: 'var(--gecko-primary-500)' }} />
            Public Holidays — Laem Chabang ICD
            <span className="gecko-badge gecko-badge-gray" style={{ fontSize: 10 }}>{holidays.length} holidays</span>
          </div>
          <button
            className="gecko-btn gecko-btn-primary gecko-btn-sm"
            onClick={() => { setShowAddForm(s => !s); setEditId(null); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="plus" size={13} />
            Add Holiday
          </button>
        </div>

        {/* Inline add form */}
        {showAddForm && (
          <div style={{
            padding: '14px 16px',
            background: 'var(--gecko-primary-50)',
            borderBottom: '1px solid var(--gecko-primary-100)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gecko-primary-700)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="plus" size={13} /> New Holiday
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Date *</span>
                <input
                  type="date"
                  value={draft.date}
                  onChange={e => setDraft(d => ({ ...d, date: e.target.value }))}
                  className="gecko-input gecko-input-sm"
                  style={{ width: 150 }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Holiday Name *</span>
                <input
                  type="text"
                  value={draft.name}
                  onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                  placeholder="e.g. Songkran"
                  className="gecko-input gecko-input-sm"
                  style={{ minWidth: 180 }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Type</span>
                <select
                  value={draft.type}
                  onChange={e => setDraft(d => ({ ...d, type: e.target.value as HolidayType }))}
                  className="gecko-input gecko-input-sm"
                  style={{ width: 120 }}>
                  {TYPE_OPTIONS.map(t => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Scope</span>
                <select
                  value={draft.scope}
                  onChange={e => setDraft(d => ({ ...d, scope: e.target.value as HolidayScope }))}
                  className="gecko-input gecko-input-sm"
                  style={{ width: 140 }}>
                  {SCOPE_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 160px' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Notes</span>
                <input
                  type="text"
                  value={draft.notes}
                  onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                  placeholder="Optional notes"
                  className="gecko-input gecko-input-sm"
                  style={{ minWidth: 160 }}
                />
              </label>
              <div style={{ display: 'flex', gap: 6, paddingBottom: 1 }}>
                <button
                  className="gecko-btn gecko-btn-primary gecko-btn-sm"
                  onClick={handleAddSubmit}
                  style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Icon name="check" size={13} /> Add
                </button>
                <button
                  className="gecko-btn gecko-btn-ghost gecko-btn-sm"
                  onClick={() => { setShowAddForm(false); setDraft(EMPTY_HOLIDAY); }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Holiday rows */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)' }}>
                {['Date', 'Holiday Name', 'Type', 'Scope', 'Notes', 'Status', 'Actions'].map(col => (
                  <th key={col} style={{
                    padding: '9px 14px', textAlign: 'left',
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
                    color: 'var(--gecko-text-secondary)', whiteSpace: 'nowrap',
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {holidays.map((h, idx) => {
                const st = holidayStatus(h.date);
                const isEdit = editId === h.id;
                return (
                  <tr
                    key={h.id}
                    style={{
                      borderBottom: idx < holidays.length - 1 ? '1px solid var(--gecko-border)' : 'none',
                      background: h.date === TODAY_ISO ? 'var(--gecko-warning-50)' : '#fff',
                    }}
                  >
                    {/* Date */}
                    <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                      {isEdit ? (
                        <input
                          type="date"
                          value={editDraft.date ?? h.date}
                          onChange={e => setEditDraft(d => ({ ...d, date: e.target.value }))}
                          className="gecko-input gecko-input-sm"
                          style={{ width: 150 }}
                        />
                      ) : (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>
                            {formatHolidayDate(h.date)}
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Name */}
                    <td style={{ padding: '11px 14px' }}>
                      {isEdit ? (
                        <input
                          type="text"
                          value={editDraft.name ?? h.name}
                          onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))}
                          className="gecko-input gecko-input-sm"
                          style={{ minWidth: 180 }}
                        />
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{h.name}</span>
                      )}
                    </td>

                    {/* Type */}
                    <td style={{ padding: '11px 14px' }}>
                      {isEdit ? (
                        <select
                          value={editDraft.type ?? h.type}
                          onChange={e => setEditDraft(d => ({ ...d, type: e.target.value as HolidayType }))}
                          className="gecko-input gecko-input-sm"
                          style={{ width: 120 }}>
                          {TYPE_OPTIONS.map(t => <option key={t}>{t}</option>)}
                        </select>
                      ) : (
                        <span style={{
                          fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                          padding: '2px 7px', borderRadius: 4,
                          background: typeBadge(h.type).bg, color: typeBadge(h.type).color,
                        }}>
                          {h.type}
                        </span>
                      )}
                    </td>

                    {/* Scope */}
                    <td style={{ padding: '11px 14px' }}>
                      {isEdit ? (
                        <select
                          value={editDraft.scope ?? h.scope}
                          onChange={e => setEditDraft(d => ({ ...d, scope: e.target.value as HolidayScope }))}
                          className="gecko-input gecko-input-sm"
                          style={{ width: 140 }}>
                          {SCOPE_OPTIONS.map(s => <option key={s}>{s}</option>)}
                        </select>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          {h.scope === 'All Yards'
                            ? <Icon name="globe" size={12} style={{ color: 'var(--gecko-primary-500)' }} />
                            : <Icon name="settings" size={12} style={{ color: 'var(--gecko-text-secondary)' }} />
                          }
                          <span style={{ fontSize: 12, color: 'var(--gecko-text-secondary)' }}>{h.scope}</span>
                        </div>
                      )}
                    </td>

                    {/* Notes */}
                    <td style={{ padding: '11px 14px', maxWidth: 200 }}>
                      {isEdit ? (
                        <input
                          type="text"
                          value={editDraft.notes ?? h.notes}
                          onChange={e => setEditDraft(d => ({ ...d, notes: e.target.value }))}
                          className="gecko-input gecko-input-sm"
                          style={{ width: '100%' }}
                        />
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', fontStyle: h.notes ? 'normal' : 'italic' }}>
                          {h.notes || 'No notes'}
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                        padding: '2px 7px', borderRadius: 4,
                        background: st.bg, color: st.color,
                      }}>
                        {st.label}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '11px 14px' }}>
                      {isEdit ? (
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button
                            className="gecko-btn gecko-btn-primary gecko-btn-sm"
                            onClick={handleEditSave}
                            style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Icon name="check" size={12} /> Save
                          </button>
                          <button
                            className="gecko-btn gecko-btn-ghost gecko-btn-sm"
                            onClick={() => { setEditId(null); setEditDraft({}); }}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm"
                            onClick={() => handleEditStart(h)}
                            title="Edit">
                            <Icon name="edit" size={13} />
                          </button>
                          <button
                            className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm"
                            onClick={() => handleDelete(h.id)}
                            title="Delete"
                            style={{ color: 'var(--gecko-error-500)' }}>
                            <Icon name="trash" size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {holidays.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '32px 14px', textAlign: 'center', color: 'var(--gecko-text-disabled)', fontSize: 13 }}>
                    No public holidays configured. Click &quot;Add Holiday&quot; to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function GateHoursPage() {
  const [activeTab, setActiveTab] = useState<'schedule' | 'holidays'>('schedule');

  const kpiData = useMemo(() => {
    const openDays = SEED_SCHEDULE.filter(d => d.open).length;
    const totalHours = SEED_SCHEDULE.reduce((acc, d) => acc + computeTotalHoursNum(d), 0);
    const upcomingHolidays = SEED_HOLIDAYS.filter(h => h.date >= TODAY_ISO).length;
    const nextClosure = nextClosureDate(SEED_HOLIDAYS, SEED_SCHEDULE);
    return { openDays, totalHours, upcomingHolidays, nextClosure };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gecko-space-4)' }}>

      {/* Toolbar */}
      <PageToolbar
        title="Gate Operating Hours"
        subtitle="Define weekly gate schedules, public holidays, and special event closures"
        badges={[{ label: 'Config', kind: 'info' }]}
        actions={
          <>
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="download" size={13} /> Export Schedule
            </button>
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="copy" size={13} /> Clone to Next Period
            </button>
          </>
        }
      />

      {/* KPI strip */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <KpiCard
          label="Operating Days / Week"
          value={`${kpiData.openDays} / 7`}
          sub="Current weekly schedule"
          accent="var(--gecko-primary-500)"
        />
        <KpiCard
          label="Total Weekly Hours"
          value={`${kpiData.totalHours % 1 === 0 ? kpiData.totalHours : kpiData.totalHours.toFixed(1)} hrs`}
          sub="Excl. lunch breaks"
          accent="var(--gecko-success-500)"
        />
        <KpiCard
          label="Public Holidays This Year"
          value={kpiData.upcomingHolidays}
          sub="Upcoming from today"
          accent="var(--gecko-warning-500)"
        />
        <KpiCard
          label="Next Closure Date"
          value={kpiData.nextClosure}
          sub="Nearest public holiday"
          accent="var(--gecko-error-500)"
        />
      </div>

      {/* Tabs */}
      <div>
        <div style={{
          display: 'flex', gap: 0,
          borderBottom: '2px solid var(--gecko-border)',
          marginBottom: 16,
        }}>
          {([
            { key: 'schedule', label: 'Weekly Schedule', icon: 'clock' },
            { key: 'holidays', label: 'Public Holidays',  icon: 'calendar' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '10px 18px',
                border: 'none',
                borderBottom: activeTab === tab.key
                  ? '2px solid var(--gecko-primary-600)'
                  : '2px solid transparent',
                marginBottom: -2,
                background: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 13, fontWeight: activeTab === tab.key ? 700 : 500,
                color: activeTab === tab.key ? 'var(--gecko-primary-700)' : 'var(--gecko-text-secondary)',
                transition: 'color 0.15s',
              }}
            >
              <Icon
                name={tab.icon}
                size={14}
                style={{ color: activeTab === tab.key ? 'var(--gecko-primary-600)' : 'var(--gecko-text-disabled)' }}
              />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'schedule' && <WeeklyScheduleTab />}
        {activeTab === 'holidays' && <PublicHolidaysTab />}
      </div>

      {/* Info footer */}
      <div style={{
        padding: '12px 16px',
        background: 'var(--gecko-primary-50)',
        border: '1px solid var(--gecko-primary-100)',
        borderRadius: 8,
        display: 'flex', gap: 12, alignItems: 'flex-start',
      }}>
        <Icon name="info" size={16} style={{ color: 'var(--gecko-primary-600)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12, color: 'var(--gecko-primary-800)', lineHeight: 1.6 }}>
          <strong>How gate hours work:</strong> The weekly schedule defines the default operating window
          for all gate lanes at Laem Chabang ICD. Public holidays automatically override the weekly
          schedule and close all gates for the configured scope. Changes take effect on the next
          appointment booking refresh. To schedule partial-day closures or special events, use the
          <strong> Gate Slot Capacity</strong> page to set individual time-window statuses.
        </div>
      </div>
    </div>
  );
}
