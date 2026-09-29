"use client";
import React, { useState } from 'react';
import { useSession } from '@/lib/auth/session';
import { useServerList } from '@/lib/api/use-server-list';
import { LOCATIONS_PATH, LOCATION_TYPES, deleteCoded, saveCoded, type Location } from '@/lib/api/logistics';
import { EditableTable } from '../lookups/_components/EditableTable';

/**
 * LIVE against gecko_master logistics.location — a customer's factory or
 * warehouse, an industrial estate, a terminal at the port: where a box is
 * delivered or picked up, and the terminal of a vessel call. The party is
 * whose premises it is. KORAKIT starts with none.
 *
 * The mock's facility → yard → block → row → slot tree is not this table (a
 * depot's yards are under Master Data → Yards) and is gone.
 */
export default function LocationsPage() {
  const { can } = useSession();
  const [type, setType] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const list = useServerList<Location>(LOCATIONS_PATH, { locationType: type || undefined, includeInactive }, 'locations');

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto' }}>
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline gecko-stack-md">
            <h1 className="gecko-page-title">Locations</h1>
            <span className="gecko-count-badge">{list.loading && !list.data ? '…' : `${list.total.toLocaleString()} found`}</span>
          </div>
          <div className="gecko-page-subtitle gecko-mt-1">Where boxes go and come from outside the depot — factories, warehouses, estates, port terminals.</div>
        </div>
      </div>

      <EditableTable<Location>
        columns={[
          { key: 'locationCode', label: 'Code', kind: 'code', required: true, createOnly: true, maxLength: 30, width: 120 },
          { key: 'locationNameEn', label: 'Name', kind: 'text', required: true, maxLength: 255 },
          { key: 'locationNameLocal', label: 'Thai', kind: 'text', maxLength: 255 },
          { key: 'locationType', label: 'Type', kind: 'select', required: true, options: LOCATION_TYPES, width: 140 },
          { key: 'partyCode', label: 'Owner', kind: 'code', maxLength: 60, width: 110, hint: 'Party code of whose premises it is',
            render: l => (l.partyCode ? <span title={l.partyName ?? undefined} className="gecko-text-mono">{l.partyCode}</span> : <span className="gecko-cell-meta">—</span>) },
          { key: 'address1', label: 'Address', kind: 'text', maxLength: 255 },
          { key: 'city', label: 'City', kind: 'text', maxLength: 100, width: 120 },
          { key: 'areaCode', label: 'Area', kind: 'code', maxLength: 20, width: 80, hint: 'Trucking zone' },
          { key: 'countryCode', label: 'Country', kind: 'code', maxLength: 2, width: 70 },
          { key: 'isActive', label: 'Active', kind: 'bool', width: 60 },
        ]}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        rowKey={l => l.locationCode}
        blank={() => ({
          locationCode: '', locationNameEn: '', locationNameLocal: null, locationType: 'FACTORY', areaCode: null, partyCode: null,
          address1: null, address2: null, city: null, state: null, postcode: null, countryCode: 'TH', latitude: null, longitude: null, isActive: true,
        })}
        canManage={can('mdm.logistics.manage')}
        noun="Location"
        searchText={l => `${l.locationCode} ${l.locationNameEn} ${l.city ?? ''}`}
        search={list.search}
        onSearchChange={list.setSearch}
        onSave={async (draft, original) => { await saveCoded(LOCATIONS_PATH, draft.locationCode, draft, original === null); list.reload(); }}
        onDelete={async l => { await deleteCoded(LOCATIONS_PATH, l.locationCode, l.rowVersion!); list.reload(); }}
        footer={list.footer}
        toolbar={
          <>
            <select className="gecko-input" style={{ width: 170 }} value={type} onChange={e => setType(e.target.value)} aria-label="Location type">
              <option value="">All types</option>
              {LOCATION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
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
