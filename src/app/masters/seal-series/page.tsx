"use client";
import React, { useState } from 'react';
import { useApi, useApiList, type Paged } from '@/lib/api/use-api';
import { useSession } from '@/lib/auth/session';
import { shippingLinesQueryPath, type ShippingLine } from '@/lib/api/shipping-lines';
import { SEAL_RANGES_PATH, deleteById, saveById, type SealRange } from '@/lib/api/logistics';
import { EditableTable } from '../lookups/_components/EditableTable';

interface Branch { branchId: string; branchCode: string; displayName: string }

/**
 * LIVE against gecko_master party.seal_range — the blocks of seal numbers a
 * shipping line hands a depot. Two live ranges with the same prefix never
 * overlap (a seal number is one seal, at any depot); a range seals were issued
 * from can only be made inactive. Editing needs mdm.party.manage at the depot.
 * KORAKIT starts with none.
 */
export default function SealSeriesPage() {
  const { canAt } = useSession();
  const { data: branches, error: branchError } = useApiList<Branch>('/api/branches?pageSize=100');
  const [picked, setPicked] = useState('');
  const branchId = picked || branches?.[0]?.branchId || '';
  const [includeInactive, setIncludeInactive] = useState(false);
  const { data, error, loading, reload } = useApi<SealRange[]>(
    branchId ? `${SEAL_RANGES_PATH}?branchId=${branchId}&includeInactive=${includeInactive}` : null);
  const { data: lines } = useApi<Paged<ShippingLine>>(shippingLinesQueryPath({ lineRole: 'LINE', pageSize: 200 }));

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto' }}>
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <h1 className="gecko-page-title">Seal Series</h1>
          <div className="gecko-page-subtitle gecko-mt-1">The seal numbers each shipping line has handed this depot.</div>
        </div>
      </div>

      <EditableTable<SealRange>
        columns={[
          { key: 'partyCode', label: 'Line', kind: 'select', required: true, width: 200,
            options: (lines?.items ?? []).map(l => ({ value: l.partyCode, label: `${l.partyCode} · ${l.nameEn}` })) },
          { key: 'sealPrefix', label: 'Prefix', kind: 'code', maxLength: 10, width: 90 },
          { key: 'seriesStart', label: 'First no.', kind: 'number', required: true, min: 0, width: 120 },
          { key: 'seriesEnd', label: 'Last no.', kind: 'number', required: true, min: 0, width: 120 },
          { key: 'numberLength', label: 'Digits', kind: 'number', min: 1, max: 18, width: 70, hint: 'Zero-padding printed on the seal' },
          { key: 'lastIssuedNumber', label: 'Last issued', kind: 'number', min: 0, width: 120, hint: 'When the depot hands out seals from this range' },
          { key: 'remaining', label: 'Left', kind: 'number', width: 80, editableWhen: () => false,
            render: r => <span className="gecko-num-tabular">{r.remaining?.toLocaleString() ?? '—'}</span> },
          { key: 'receivedOn', label: 'Received', kind: 'date', width: 140 },
          { key: 'isActive', label: 'Active', kind: 'bool', width: 60 },
        ]}
        rows={data}
        loading={loading}
        error={branchError ?? error}
        rowKey={r => r.sealRangeId ?? `${r.sealPrefix}${r.seriesStart}`}
        blank={() => ({
          branchId, partyCode: '', sealPrefix: '', seriesStart: 0, seriesEnd: 0, numberLength: null,
          lastIssuedNumber: null, receivedOn: new Date().toISOString().slice(0, 10), isActive: true,
        })}
        canManage={canAt('mdm.party.manage', branchId)}
        noun="Seal range"
        searchText={r => `${r.partyCode} ${r.sealPrefix}${r.seriesStart} ${r.sealPrefix}${r.seriesEnd}`}
        onSave={async draft => { await saveById(SEAL_RANGES_PATH, draft.sealRangeId, { ...draft, branchId }); reload(); }}
        onDelete={async r => { await deleteById(SEAL_RANGES_PATH, r.sealRangeId!, r.rowVersion!); reload(); }}
        cannotDelete={r => (r.lastIssuedNumber !== null ? 'Seals were issued from it — make it inactive.' : null)}
        deleteMessage={() => 'The range is removed. Seals already fitted keep their numbers; only a range nothing was issued from can be deleted.'}
        toolbar={
          <>
            <select className="gecko-input" style={{ width: 240 }} value={branchId} aria-label="Depot" onChange={e => setPicked(e.target.value)}>
              {(branches ?? []).map(b => <option key={b.branchId} value={b.branchId}>{b.branchCode} · {b.displayName}</option>)}
            </select>
            <label className="gecko-row gecko-cell-meta">
              <input type="checkbox" className="gecko-checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} />
              Show inactive
            </label>
          </>
        }
      />
    </div>
  );
}
