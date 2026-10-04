"use client";
import React, { useState } from 'react';
import { useApi, useApiList } from '@/lib/api/use-api';
import { useSession } from '@/lib/auth/session';
import { HOLIDAYS_PATH, deleteById, saveById, type PublicHoliday } from '@/lib/api/logistics';
import { EditableTable } from '../lookups/_components/EditableTable';
import { formatDayDate } from '@/lib/format';

interface Branch { branchId: string; branchCode: string; displayName: string }

/**
 * LIVE against gecko_master org.public_holiday — the tenant's holidays, for
 * every depot or for one; they will feed gate hours and storage-day counting.
 * One holiday per date per scope. A holiday for every depot needs
 * mdm.org.manage tenant-wide; a depot's own, the grant at that depot.
 * KORAKIT starts with none (its 2012–2015 legacy rows were not loaded).
 */
export default function PublicHolidaysPage() {
  const { can } = useSession();
  const { data: branches, error: branchError } = useApiList<Branch>('/api/branches?pageSize=100');
  const [picked, setPicked] = useState('');
  const branchId = picked || branches?.[0]?.branchId || '';
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const { data, error, loading, reload } = useApi<PublicHoliday[]>(
    branchId ? `${HOLIDAYS_PATH}?year=${year}&branchId=${branchId}` : `${HOLIDAYS_PATH}?year=${year}`);
  const branchOptions = (branches ?? []).map(b => ({ value: b.branchId, label: `${b.branchCode} only` }));

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto' }}>
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <h1 className="gecko-page-title">Public Holidays</h1>
          <div className="gecko-page-subtitle gecko-mt-1">The days the depots close or run half a day — for every depot, or for one.</div>
        </div>
      </div>

      <EditableTable<PublicHoliday>
        columns={[
          { key: 'holidayDate', label: 'Date', kind: 'date', required: true, width: 150,
            render: h => <span className="gecko-num-tabular">{formatDayDate(h.holidayDate)}</span> },
          { key: 'nameEn', label: 'Holiday', kind: 'text', required: true, maxLength: 150 },
          { key: 'nameLocal', label: 'Thai', kind: 'text', maxLength: 150 },
          { key: 'isHalfDay', label: 'Half day', kind: 'bool', width: 80 },
          { key: 'branchId', label: 'Applies to', kind: 'select', options: branchOptions, width: 160, hint: '— = every depot',
            render: h => (h.branchId ? branchOptions.find(o => o.value === h.branchId)?.label ?? 'one depot' : 'Every depot') },
        ]}
        rows={data}
        loading={loading}
        error={branchError ?? error}
        rowKey={h => h.publicHolidayId ?? `${h.holidayDate}:${h.branchId ?? ''}`}
        blank={() => ({ branchId: null, holidayDate: `${year}-01-01`, nameEn: '', nameLocal: null, isHalfDay: false })}
        canManage={can('mdm.org.manage')}
        noun="Holiday"
        searchText={h => `${h.holidayDate} ${h.nameEn} ${h.nameLocal ?? ''}`}
        onSave={async draft => { await saveById(HOLIDAYS_PATH, draft.publicHolidayId, draft); reload(); }}
        onDelete={async h => { await deleteById(HOLIDAYS_PATH, h.publicHolidayId!, h.rowVersion!); reload(); }}
        note="A depot manager adds and changes their own depot's days; days for every depot need a tenant-wide manager."
        toolbar={
          <>
            <select className="gecko-input" style={{ width: 110 }} value={year} aria-label="Year" onChange={e => setYear(Number(e.target.value))}>
              {[thisYear - 1, thisYear, thisYear + 1, thisYear + 2].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select className="gecko-input" style={{ width: 240 }} value={branchId} aria-label="Depot" onChange={e => setPicked(e.target.value)}>
              {(branches ?? []).map(b => <option key={b.branchId} value={b.branchId}>{b.branchCode} · {b.displayName}</option>)}
            </select>
          </>
        }
      />
    </div>
  );
}
