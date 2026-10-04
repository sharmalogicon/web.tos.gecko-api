"use client";
import React from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import type { ApiError } from '@/lib/api/problem';
import type { PublicHoliday } from '@/lib/api/logistics';
import { formatDay } from '@/lib/api/gate-hours';

/** Read-only: the holidays that close this depot's gate. Edited on /masters/public-holidays. */
export function DepotHolidays({ year, rows, loading, error }: { year: number; rows: PublicHoliday[] | null; loading: boolean; error: ApiError | null }) {
  const sorted = [...(rows ?? [])].sort((a, b) => a.holidayDate.localeCompare(b.holidayDate));
  return (
    <div className="gecko-stack gecko-stack-md">
      <div className="gecko-row gecko-row-wrap" style={{ gap: 12 }}>
        <div className="gecko-cell-meta" style={{ flex: '1 1 400px' }}>
          A public holiday closes the gate for the day. A half day keeps the weekday&apos;s hours up to 12:00. A one-off
          date for the same day overrides both.
        </div>
        <Link href="/masters/public-holidays" className="gecko-btn gecko-btn-outline gecko-btn-sm gecko-inline-row">
          <Icon name="edit" size={13} /> Edit public holidays
        </Link>
      </div>

      {error && (
        <div role="alert" className="gecko-alert gecko-alert-error gecko-row" style={{ gap: 10 }}>
          <Icon name="alertCircle" size={16} /><span>{error.explanation ?? error.message}</span>
        </div>
      )}

      <div className="gecko-table-card">
        <table className="gecko-table gecko-table-compact">
          <thead>
            <tr><th style={{ width: 170 }}>Date</th><th>Holiday</th><th>Thai</th><th style={{ width: 130 }}>Applies to</th><th style={{ width: 90 }}>Half day</th></tr>
          </thead>
          <tbody>
            {loading && !rows && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24 }} className="gecko-cell-meta">Loading…</td></tr>}
            {!loading && !error && sorted.length === 0 && (
              <tr><td colSpan={5}><EmptyState icon="calendar" title={`No public holidays in ${year}`} description="The weekly hours apply every day." /></td></tr>
            )}
            {sorted.map(h => (
              <tr key={h.publicHolidayId ?? h.holidayDate}>
                <td className="gecko-num-tabular">{formatDay(h.holidayDate)}</td>
                <td>{h.nameEn}</td>
                <td>{h.nameLocal ?? <span className="gecko-cell-meta">—</span>}</td>
                <td>{h.branchId ? <span className="gecko-badge gecko-badge-info gecko-badge-xs">this depot</span> : <span className="gecko-badge gecko-badge-gray gecko-badge-xs">every depot</span>}</td>
                <td>{h.isHalfDay ? <span className="gecko-badge gecko-badge-warning gecko-badge-xs">until 12:00</span> : <span className="gecko-cell-meta">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
