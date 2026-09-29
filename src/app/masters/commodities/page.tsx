"use client";
import React, { useState } from 'react';
import { useSession } from '@/lib/auth/session';
import { useServerList } from '@/lib/api/use-server-list';
import { COMMODITIES_PATH, IMDG_CLASSES, PACKING_GROUPS, deleteCoded, saveCoded, type Commodity } from '@/lib/api/logistics';
import { EditableTable } from '../lookups/_components/EditableTable';

/**
 * LIVE against gecko_master logistics.commodity — what a booking carries, and
 * the dangerous-goods and reefer facts the gate checks. KORAKIT starts with
 * none. DG fields (IMDG class, UN number, packing group) open only on a
 * dangerous commodity; a temperature range only on a reefer one — the API
 * refuses them otherwise, it does not quietly keep them.
 *
 * The mock's HS chapter tree and "DG-flagged" counts were fixtures and are gone.
 */
export default function CommoditiesPage() {
  const { can } = useSession();
  const [dg, setDg] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const list = useServerList<Commodity>(COMMODITIES_PATH, { isDangerous: dg || undefined, includeInactive }, 'commodities');

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto' }}>
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline gecko-stack-md">
            <h1 className="gecko-page-title">Commodities</h1>
            <span className="gecko-count-badge">{list.loading && !list.data ? '…' : `${list.total.toLocaleString()} found`}</span>
          </div>
          <div className="gecko-page-subtitle gecko-mt-1">Cargo by HS code — with the dangerous-goods class and the reefer range the gate checks.</div>
        </div>
      </div>

      <EditableTable<Commodity>
        columns={[
          { key: 'commodityCode', label: 'Code', kind: 'code', required: true, createOnly: true, maxLength: 20, width: 110 },
          { key: 'hsCode', label: 'HS code', kind: 'code', maxLength: 10, width: 110, hint: '6, 8 or 10 digits' },
          { key: 'descriptionEn', label: 'Description', kind: 'text', required: true, maxLength: 255 },
          { key: 'descriptionLocal', label: 'Thai', kind: 'text', maxLength: 255 },
          { key: 'isDangerous', label: 'DG', kind: 'bool', width: 50 },
          { key: 'imdgClassCode', label: 'IMDG', kind: 'select', options: IMDG_CLASSES, width: 100, editableWhen: c => c.isDangerous },
          { key: 'unNumber', label: 'UN no.', kind: 'code', maxLength: 4, width: 70, editableWhen: c => c.isDangerous },
          { key: 'packingGroup', label: 'PG', kind: 'select', options: PACKING_GROUPS, width: 70, editableWhen: c => c.isDangerous },
          { key: 'isTemperatureControlled', label: 'Reefer', kind: 'bool', width: 60 },
          { key: 'defaultMinTempC', label: 'Min °C', kind: 'number', min: -100, max: 100, step: 0.1, width: 80, editableWhen: c => c.isTemperatureControlled },
          { key: 'defaultMaxTempC', label: 'Max °C', kind: 'number', min: -100, max: 100, step: 0.1, width: 80, editableWhen: c => c.isTemperatureControlled },
          { key: 'isActive', label: 'Active', kind: 'bool', width: 60 },
        ]}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        rowKey={c => c.commodityCode}
        blank={() => ({
          commodityCode: '', hsCode: null, descriptionEn: '', descriptionLocal: null, isDangerous: false, imdgClassCode: null,
          unNumber: null, packingGroup: null, isTemperatureControlled: false, defaultMinTempC: null, defaultMaxTempC: null, isActive: true,
        })}
        canManage={can('mdm.logistics.manage')}
        noun="Commodity"
        searchText={c => `${c.commodityCode} ${c.hsCode ?? ''} ${c.descriptionEn}`}
        search={list.search}
        onSearchChange={list.setSearch}
        // Unticking DG / reefer clears what only applies to them, so the save is not refused for a hidden value.
        onSave={async (draft, original) => {
          const row = {
            ...draft,
            ...(draft.isDangerous ? {} : { imdgClassCode: null, unNumber: null, packingGroup: null }),
            ...(draft.isTemperatureControlled ? {} : { defaultMinTempC: null, defaultMaxTempC: null }),
          };
          await saveCoded(COMMODITIES_PATH, row.commodityCode, row, original === null);
          list.reload();
        }}
        onDelete={async c => { await deleteCoded(COMMODITIES_PATH, c.commodityCode, c.rowVersion!); list.reload(); }}
        footer={list.footer}
        toolbar={
          <>
            <select className="gecko-input" style={{ width: 160 }} value={dg} onChange={e => setDg(e.target.value)} aria-label="Dangerous goods">
              <option value="">All cargo</option>
              <option value="true">Dangerous goods</option>
              <option value="false">Not dangerous</option>
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
