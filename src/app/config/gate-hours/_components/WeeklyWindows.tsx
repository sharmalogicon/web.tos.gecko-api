"use client";
import React from 'react';
import type { ApiError } from '@/lib/api/problem';
import { WEEKDAYS, deleteWindow, formatMinutes, saveWindow, weekdayName, type GateHoursWindow } from '@/lib/api/gate-hours';
import { EditableTable } from '@/app/masters/lookups/_components/EditableTable';

const toMinutes = (t: string | null | undefined) => {
  if (!t || !/^\d{2}:\d{2}$/.test(t)) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/** Length and overnight-ness from the times on screen, so an unsaved edit shows them too. */
function span(opensAt: string | null, closesAt: string | null): { minutes: number; overnight: boolean } | null {
  const o = toMinutes(opensAt);
  const c = toMinutes(closesAt);
  if (o === null || c === null || o === c) return null;
  return { minutes: c > o ? c - o : c + 1440 - o, overnight: c <= o };
}

const label = (w: GateHoursWindow) => `${weekdayName(w.isoWeekday)} ${w.opensAt}–${w.closesAt}`;

interface Props {
  branchId: string;
  rows: GateHoursWindow[] | null;
  loading: boolean;
  error: ApiError | null;
  canManage: boolean;
  /** Runs a write, reloading after it — also after a 409, so the stale row is replaced. */
  guard: (write: () => Promise<unknown>) => Promise<void>;
}

/** The week at a glance, then one row per window (each its own API row and rowVersion). */
export function WeeklyWindows({ branchId, rows, loading, error, canManage, guard }: Props) {
  return (
    <div className="gecko-stack" style={{ gap: 16 }}>
      <div className="gecko-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
          {WEEKDAYS.map(d => {
            const day = (rows ?? []).filter(w => w.isoWeekday === Number(d.value));
            const minutes = day.reduce((sum, w) => sum + (w.minutes ?? 0), 0);
            const weekend = Number(d.value) >= 6;
            return (
              <div key={d.value} style={{
                padding: '12px 14px', borderRight: '1px solid var(--gecko-border)',
                background: day.length === 0 ? 'var(--gecko-bg-subtle)' : undefined,
              }}>
                <div className="gecko-row" style={{ gap: 8, marginBottom: 8 }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                    background: weekend ? 'var(--gecko-warning-100)' : 'var(--gecko-primary-100)',
                    color: weekend ? 'var(--gecko-warning-700)' : 'var(--gecko-primary-700)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.04em',
                  }}>{d.label.slice(0, 3).toUpperCase()}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{d.label}</span>
                </div>
                {day.length === 0 ? (
                  <span className="gecko-badge gecko-badge-gray gecko-badge-xs">{rows ? 'Closed' : '…'}</span>
                ) : (
                  <div className="gecko-stack" style={{ gap: 4 }}>
                    {day.map(w => (
                      <div key={w.gateHoursWindowId} className="gecko-num-tabular" style={{ fontSize: 13, fontWeight: 600 }}>
                        {w.opensAt}–{w.closesAt}
                        {w.isOvernight && <span className="gecko-badge gecko-badge-info gecko-badge-xs" style={{ marginLeft: 6 }}>overnight</span>}
                      </div>
                    ))}
                    <div className="gecko-cell-meta">{formatMinutes(minutes)}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <EditableTable<GateHoursWindow>
        columns={[
          { key: 'isoWeekday', label: 'Day', kind: 'select', options: WEEKDAYS, required: true, width: 150, render: w => weekdayName(w.isoWeekday) },
          { key: 'opensAt', label: 'Opens', kind: 'time', required: true, width: 130, render: w => <span className="gecko-num-tabular">{w.opensAt}</span> },
          { key: 'closesAt', label: 'Closes', kind: 'time', required: true, width: 130, hint: 'At or before the opening time = runs past midnight',
            render: w => <span className="gecko-num-tabular">{w.closesAt}</span> },
          { key: 'isOvernight', label: 'Overnight', kind: 'bool', width: 100, editableWhen: () => false,
            render: w => (span(w.opensAt, w.closesAt)?.overnight ? <span className="gecko-badge gecko-badge-info gecko-badge-xs">overnight</span> : <span className="gecko-cell-meta">—</span>) },
          { key: 'minutes', label: 'Length', kind: 'number', width: 100, editableWhen: () => false,
            render: w => { const s = span(w.opensAt, w.closesAt); return s ? <span className="gecko-num-tabular">{formatMinutes(s.minutes)}</span> : <span className="gecko-cell-meta">—</span>; } },
        ]}
        rows={rows}
        loading={loading}
        error={error}
        rowKey={label}
        blank={() => ({ branchId, isoWeekday: 1, opensAt: '', closesAt: '' })}
        canManage={canManage}
        noun="Window"
        searchText={w => `${weekdayName(w.isoWeekday)} ${w.opensAt} ${w.closesAt}`}
        onSave={draft => guard(() => saveWindow({ ...draft, branchId }))}
        onDelete={w => guard(() => deleteWindow(w))}
        deleteMessage={w => `The gate no longer opens ${label(w)} at this depot. If it was the day's only window, the gate is closed that day.`}
        note={<>
          A break is two windows (06:00–12:00 and 13:00–20:00). A window that closes at or before it opens runs past
          midnight (22:00–06:00 belongs to the day it opens). A day with no windows is a day the gate is closed.
        </>}
      />
    </div>
  );
}
