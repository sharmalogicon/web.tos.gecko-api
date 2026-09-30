"use client";
import React, { useCallback, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { PageToolbar } from '@/components/ui/OpsPrimitives';
import { useApi, useApiList } from '@/lib/api/use-api';
import { useSession } from '@/lib/auth/session';
import { ApiError } from '@/lib/api/problem';
import { HOLIDAYS_PATH, type PublicHoliday } from '@/lib/api/logistics';
import {
  exceptionsPath, formatMinutes, statusPath, windowsPath,
  type GateHoursException, type GateHoursStatus, type GateHoursWindow,
} from '@/lib/api/gate-hours';
import { StatusStrip } from './_components/StatusStrip';
import { WeeklyWindows } from './_components/WeeklyWindows';
import { OneOffDates } from './_components/OneOffDates';
import { DepotHolidays } from './_components/DepotHolidays';

interface Branch { branchId: string; branchCode: string; displayName: string }

function KpiCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div
      className="gecko-card gecko-card-accent-top"
      style={{ flex: 1, minWidth: 150, padding: '14px 20px', ['--gecko-accent-color' as string]: accent ?? 'var(--gecko-primary-500)' }}
    >
      <div className="gecko-eyebrow gecko-mb-2">{label}</div>
      <div className="gecko-stat-num">{value}</div>
      {sub && <div className="gecko-cell-meta">{sub}</div>}
    </div>
  );
}

type Tab = 'schedule' | 'dates' | 'holidays';

/**
 * LIVE against gecko_master org.gate_hours_window / org.gate_hours_exception —
 * when a depot's gate is open. The barrier asks GET /gate-hours/status: a depot
 * with no windows is not checked at all. Order of precedence for a day: a
 * one-off date, else a public holiday (a half day keeps the hours up to 12:00),
 * else the weekly windows. Reads need mdm.org.view; writes mdm.org.manage AT
 * the depot.
 */
export default function GateHoursPage() {
  const { canAt } = useSession();
  const { data: branches, error: branchError } = useApiList<Branch>('/api/branches?pageSize=100');
  const [picked, setPicked] = useState('');
  const branchId = picked || branches?.[0]?.branchId || '';
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [tab, setTab] = useState<Tab>('schedule');

  const windows = useApi<GateHoursWindow[]>(branchId ? windowsPath(branchId) : null);
  const dates = useApi<GateHoursException[]>(branchId ? exceptionsPath(branchId, year) : null);
  const status = useApi<GateHoursStatus>(branchId ? statusPath(branchId) : null);
  const holidays = useApi<PublicHoliday[]>(branchId ? `${HOLIDAYS_PATH}?year=${year}&branchId=${encodeURIComponent(branchId)}` : null);

  const canManage = canAt('mdm.org.manage', branchId);

  const { reload: reloadWindows } = windows;
  const { reload: reloadDates } = dates;
  const { reload: reloadStatus } = status;

  /** Reload after every write — and after a 409, so the stale row is replaced before the user retries. */
  const guardWith = useCallback((reloadList: () => void) => async (write: () => Promise<unknown>) => {
    try {
      await write();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) { reloadList(); reloadStatus(); }
      throw e;
    }
    reloadList();
    reloadStatus();
  }, [reloadStatus]);

  const rows = windows.data ?? [];
  const openDays = new Set(rows.map(w => w.isoWeekday)).size;
  const weeklyMinutes = rows.reduce((sum, w) => sum + (w.minutes ?? 0), 0);
  const halfDays = (holidays.data ?? []).filter(h => h.isHalfDay).length;
  const closedDates = (dates.data ?? []).filter(x => x.isClosed).length;

  return (
    <div className="gecko-stack" style={{ gap: 'var(--gecko-space-4)' }}>
      <PageToolbar
        title="Gate Operating Hours"
        subtitle="When the gate is open at each depot — the weekly windows, one-off dates, and the public holidays that close it"
        badges={[{ label: 'Config', kind: 'info' }]}
        actions={
          <>
            <select className="gecko-input gecko-input-sm" style={{ width: 240 }} value={branchId} aria-label="Depot" onChange={e => setPicked(e.target.value)}>
              {(branches ?? []).map(b => <option key={b.branchId} value={b.branchId}>{b.branchCode} · {b.displayName}</option>)}
            </select>
            <select className="gecko-input gecko-input-sm" style={{ width: 100 }} value={year} aria-label="Year" onChange={e => setYear(Number(e.target.value))}>
              {[thisYear - 1, thisYear, thisYear + 1, thisYear + 2].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </>
        }
      />

      {branchError && (
        <div role="alert" className="gecko-alert gecko-alert-error gecko-row" style={{ gap: 10 }}>
          <Icon name="alertCircle" size={16} /><span>{branchError.explanation ?? branchError.message}</span>
        </div>
      )}

      <StatusStrip status={status.data} error={status.error} loading={status.loading} />

      <div className="gecko-row gecko-row-wrap" style={{ gap: 12 }}>
        <KpiCard label="Open Days / Week" value={windows.data ? `${openDays} / 7` : '—'} sub="Days with at least one window" />
        <KpiCard label="Weekly Gate Hours" value={windows.data ? formatMinutes(weeklyMinutes) : '—'} sub="Sum of all windows" accent="var(--gecko-success-500)" />
        <KpiCard label={`One-off Dates ${year}`} value={dates.data ? dates.data.length : '—'} sub={dates.data ? `${closedDates} closed all day` : undefined} accent="var(--gecko-warning-500)" />
        <KpiCard label={`Public Holidays ${year}`} value={holidays.data ? holidays.data.length : '—'} sub={holidays.data ? `${halfDays} half day` : undefined} accent="var(--gecko-error-500)" />
      </div>

      {branchId && !canManage && (
        <div className="gecko-cell-meta">You can view this depot&apos;s gate hours; changing them needs Manage organisation at this depot.</div>
      )}

      <div>
        <div className="gecko-tab-bar gecko-mb-4">
          {([
            { key: 'schedule', label: 'Weekly Schedule', icon: 'clock' },
            { key: 'dates', label: 'One-off Dates', icon: 'calendar' },
            { key: 'holidays', label: 'Public Holidays', icon: 'calendar' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`gecko-tab-item${tab === t.key ? ' gecko-tab-item-active' : ''}`}>
              <Icon name={t.icon} size={14} style={{ color: tab === t.key ? 'var(--gecko-primary-600)' : 'var(--gecko-text-disabled)' }} />
              {t.label}
            </button>
          ))}
        </div>

        {branchId && tab === 'schedule' && (
          <WeeklyWindows key={branchId} branchId={branchId} rows={windows.data} loading={windows.loading} error={windows.error}
            canManage={canManage} guard={guardWith(reloadWindows)} />
        )}
        {branchId && tab === 'dates' && (
          <OneOffDates key={`${branchId}:${year}`} branchId={branchId} year={year} rows={dates.data} loading={dates.loading} error={dates.error}
            canManage={canManage} guard={guardWith(reloadDates)} />
        )}
        {branchId && tab === 'holidays' && (
          <DepotHolidays year={year} rows={holidays.data} loading={holidays.loading} error={holidays.error} />
        )}
      </div>

      <div className="gecko-banner gecko-banner-info">
        <Icon name="info" size={16} className="gecko-banner-icon" />
        <div style={{ lineHeight: 1.6 }}>
          <strong>How gate hours work:</strong> for any day the barrier looks first for a one-off date, then a public
          holiday (closed; a half day keeps the weekday&apos;s hours up to 12:00), then the weekly windows. Outside those
          hours the barrier warns the clerk. A depot with no weekly windows has no gate hours, and the barrier does not
          check hours there.
        </div>
      </div>
    </div>
  );
}
