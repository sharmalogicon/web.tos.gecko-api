"use client";
import React, { useState } from 'react';
import { useApi, useApiList, type Paged } from '@/lib/api/use-api';
import { useSession } from '@/lib/auth/session';
import { YARD_DIRECTIONS, YARD_FULL_EMPTY, YARD_TYPES, updateYard, yardsPath, type Yard } from '@/lib/api/yards';
import { EditableTable } from '../lookups/_components/EditableTable';

interface Branch { branchId: string; branchCode: string; displayName: string }

/**
 * LIVE against gecko_master org.yard — a depot's yards: rename, retype,
 * resize. Editing needs mdm.org.manage at THAT depot. There is no add or
 * delete (the gate and the visits point at a yard) and no block / row / slot
 * layout: KORAKIT locates boxes at yard level.
 */
export default function YardsPage() {
  const { canAt } = useSession();
  const { data: branches, error: branchError } = useApiList<Branch>('/api/branches?pageSize=100');
  const [picked, setPicked] = useState('');
  const branchId = picked || branches?.[0]?.branchId || '';
  const { data, error, loading, reload } = useApi<Paged<Yard>>(branchId ? yardsPath(branchId) : null);

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto' }}>
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <h1 className="gecko-page-title">Yards</h1>
          <div className="gecko-page-subtitle gecko-mt-1">
            The yards inside a depot, what they hold and how many TEU they take.
          </div>
        </div>
      </div>

      <EditableTable<Yard>
        columns={[
          { key: 'yardCode', label: 'Code', kind: 'code', createOnly: true, width: 110 },
          { key: 'nameEn', label: 'Name', kind: 'text', required: true, maxLength: 200 },
          { key: 'nameLocal', label: 'Thai', kind: 'text', maxLength: 200 },
          { key: 'yardType', label: 'Type', kind: 'select', required: true, options: YARD_TYPES, width: 110 },
          { key: 'fullEmpty', label: 'Holds', kind: 'select', required: true, options: YARD_FULL_EMPTY, width: 140 },
          { key: 'directionCode', label: 'Direction', kind: 'select', options: YARD_DIRECTIONS, width: 140, hint: 'Empty = any direction' },
          { key: 'capacityTeu', label: 'Capacity (TEU)', kind: 'number', min: 0, max: 1_000_000, width: 120 },
          { key: 'isActive', label: 'Active', kind: 'bool', width: 64, editableWhen: () => false },
        ]}
        rows={data?.items ?? null}
        loading={loading}
        error={branchError ?? error}
        rowKey={y => y.yardCode}
        canManage={canAt('mdm.org.manage', branchId)}
        noun="Yard"
        searchText={y => `${y.yardCode} ${y.nameEn} ${y.nameLocal ?? ''}`}
        onSave={async draft => { await updateYard(draft); reload(); }}
        toolbar={
          <select className="gecko-input" style={{ width: 240 }} value={branchId} aria-label="Depot" onChange={e => setPicked(e.target.value)}>
            {(branches ?? []).map(b => <option key={b.branchId} value={b.branchId}>{b.branchCode} · {b.displayName}</option>)}
          </select>
        }
      />
    </div>
  );
}
