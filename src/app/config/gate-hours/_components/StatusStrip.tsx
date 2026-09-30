"use client";
import React from 'react';
import { Icon } from '@/components/ui/Icon';
import type { ApiError } from '@/lib/api/problem';
import { formatDay, wallTime, type GateHoursState, type GateHoursStatus } from '@/lib/api/gate-hours';

const STATE_LABEL: Record<GateHoursState, string> = {
  OPEN: 'Open now',
  NOT_CONFIGURED: 'No gate hours set',
  OUTSIDE_HOURS: 'Closed — outside gate hours',
  HOLIDAY: 'Closed — public holiday',
  CLOSED_DATE: 'Closed — one-off date',
};

/** "22:00" when it is the same depot day as `now`, else "Thu 1 Oct 2026 06:00". */
function when(iso: string, now: string): string {
  const at = wallTime(iso);
  return at.date === wallTime(now).date ? at.time : `${formatDay(at.date)} ${at.time}`;
}

/** Open now or closed, from GET /gate-hours/status — the same answer the barrier gets. */
export function StatusStrip({ status, error, loading }: { status: GateHoursStatus | null; error: ApiError | null; loading: boolean }) {
  if (error) {
    return (
      <div role="alert" className="gecko-alert gecko-alert-error gecko-row" style={{ gap: 10 }}>
        <Icon name="alertCircle" size={16} /><span>{error.explanation ?? error.message}</span>
      </div>
    );
  }
  if (!status) {
    return <div className="gecko-card gecko-cell-meta" style={{ padding: '12px 16px' }}>{loading ? 'Checking the gate…' : 'Pick a depot.'}</div>;
  }

  if (status.state === 'NOT_CONFIGURED') {
    return (
      <div className="gecko-banner gecko-banner-info">
        <Icon name="info" size={16} className="gecko-banner-icon" />
        <div><strong>No gate hours set</strong> — the barrier does not check hours at this depot.</div>
      </div>
    );
  }

  const open = status.state === 'OPEN';
  const tone = open ? 'success' : 'warning';
  return (
    <div className="gecko-card" style={{ padding: '12px 16px', borderLeft: `5px solid var(--gecko-${tone}-500)`, background: `var(--gecko-${tone}-50)` }}>
      <div className="gecko-row gecko-row-wrap" style={{ gap: 18 }}>
        <span className="gecko-inline-row" style={{ fontSize: 15, fontWeight: 700, color: `var(--gecko-${tone}-700)`, gap: 6 }}>
          <Icon name={open ? 'checkCircle' : 'clock'} size={16} />
          {STATE_LABEL[status.state]}
        </span>
        {open && status.openUntil && (
          <span className="gecko-cell-meta">until <strong className="gecko-num-tabular">{when(status.openUntil, status.localAt)}</strong></span>
        )}
        {!open && (
          <span className="gecko-cell-meta">
            {status.nextOpensAt
              ? <>next opens <strong className="gecko-num-tabular">{when(status.nextOpensAt, status.localAt)}</strong></>
              : 'no opening found ahead'}
          </span>
        )}
        {status.note && <span style={{ fontSize: 13 }}>{status.note}</span>}
        <span className="gecko-cell-meta gecko-num-tabular" style={{ marginLeft: 'auto' }}>
          depot time {formatDay(wallTime(status.localAt).date)} {wallTime(status.localAt).time}
        </span>
      </div>
    </div>
  );
}
