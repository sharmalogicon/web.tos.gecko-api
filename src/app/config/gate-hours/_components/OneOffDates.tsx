"use client";
import React from 'react';
import type { ApiError } from '@/lib/api/problem';
import { deleteException, formatDay, saveException, type GateHoursException } from '@/lib/api/gate-hours';
import { EditableTable } from '@/app/masters/lookups/_components/EditableTable';

interface Props {
  branchId: string;
  year: number;
  rows: GateHoursException[] | null;
  loading: boolean;
  error: ApiError | null;
  canManage: boolean;
  guard: (write: () => Promise<unknown>) => Promise<void>;
}

const time = (x: GateHoursException, t: string | null) =>
  x.isClosed ? <span className="gecko-cell-meta">—</span> : <span className="gecko-num-tabular">{t ?? '—'}</span>;

/** Dates that override the week and the holidays: closed all day, or one window. */
export function OneOffDates({ branchId, year, rows, loading, error, canManage, guard }: Props) {
  const today = new Date();
  const firstDay = today.getFullYear() === year
    ? `${year}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    : `${year}-01-01`;

  return (
    <EditableTable<GateHoursException>
      columns={[
        { key: 'exceptionDate', label: 'Date', kind: 'date', required: true, width: 170,
          render: x => <span className="gecko-num-tabular">{formatDay(x.exceptionDate)}</span> },
        { key: 'isClosed', label: 'Closed all day', kind: 'bool', width: 110,
          render: x => (x.isClosed ? <span className="gecko-badge gecko-badge-warning gecko-badge-xs">closed</span> : <span className="gecko-badge gecko-badge-success gecko-badge-xs">open</span>) },
        { key: 'opensAt', label: 'Opens', kind: 'time', required: true, width: 130, editableWhen: x => !x.isClosed, render: x => time(x, x.opensAt) },
        { key: 'closesAt', label: 'Closes', kind: 'time', required: true, width: 130, editableWhen: x => !x.isClosed,
          hint: 'At or before the opening time = runs past midnight', render: x => time(x, x.closesAt) },
        { key: 'reason', label: 'Reason', kind: 'text', required: true, maxLength: 200 },
      ]}
      rows={rows}
      loading={loading}
      error={error}
      rowKey={x => x.exceptionDate}
      blank={() => ({ branchId, exceptionDate: firstDay, isClosed: true, opensAt: null, closesAt: null, reason: '' })}
      canManage={canManage}
      noun="Date"
      searchText={x => `${x.exceptionDate} ${formatDay(x.exceptionDate)} ${x.reason}`}
      onSave={draft => guard(() => saveException({ ...draft, branchId }))}
      onDelete={x => guard(() => deleteException(x))}
      deleteMessage={x => `${formatDay(x.exceptionDate)} goes back to the weekly hours (or the public holiday, if there is one).`}
      note={<>
        A one-off date wins over both the weekly hours and a public holiday: close the gate for a day, or open it for one
        window only (a stock-count day, a Sunday vessel). One entry per date; {year} is shown.
      </>}
    />
  );
}
