"use client";
import React, { useState } from 'react';
import { useSession } from '@/lib/auth/session';
import { useServerList } from '@/lib/api/use-server-list';
import { PORTS_PATH, PORT_TYPES, TRADE_MODES, deleteCoded, saveCoded, type Port } from '@/lib/api/logistics';
import { EditableTable } from '../lookups/_components/EditableTable';

/**
 * LIVE against gecko_master logistics.port — POL / POD / final destination on
 * bookings and the port of a vessel call. KORAKIT starts with none; the tenant
 * adds the ports it uses. The API checks the country, that a UN/LOCODE belongs
 * to that country and to one port only, coordinates and the time zone.
 *
 * The mock's port list, counts and "mapping code" catalogue were fixtures and
 * are gone; partner-specific codes live in Lookups → Mappings.
 */
export default function PortsPage() {
  const { can } = useSession();
  const [country, setCountry] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const list = useServerList<Port>(PORTS_PATH, { countryCode: country.trim().toUpperCase() || undefined, includeInactive }, 'ports');

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto' }}>
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline gecko-stack-md">
            <h1 className="gecko-page-title">Ports</h1>
            <span className="gecko-count-badge">{list.loading && !list.data ? '…' : `${list.total.toLocaleString()} found`}</span>
          </div>
          <div className="gecko-page-subtitle gecko-mt-1">Ports of loading, discharge and final destination, by UN/LOCODE.</div>
        </div>
      </div>

      <EditableTable<Port>
        columns={[
          { key: 'portCode', label: 'Code', kind: 'code', required: true, createOnly: true, maxLength: 20, width: 100 },
          { key: 'unLocode', label: 'UN/LOCODE', kind: 'code', maxLength: 5, width: 100 },
          { key: 'portNameEn', label: 'Name', kind: 'text', required: true, maxLength: 255 },
          { key: 'portNameLocal', label: 'Thai', kind: 'text', maxLength: 255 },
          { key: 'countryCode', label: 'Country', kind: 'code', required: true, maxLength: 2, width: 70 },
          { key: 'portType', label: 'Type', kind: 'select', required: true, options: PORT_TYPES, width: 130 },
          { key: 'tradeMode', label: 'Trade', kind: 'select', required: true, options: TRADE_MODES, width: 130 },
          { key: 'latitude', label: 'Lat', kind: 'number', min: -90, max: 90, step: 0.000001, width: 100 },
          { key: 'longitude', label: 'Long', kind: 'number', min: -180, max: 180, step: 0.000001, width: 100 },
          { key: 'timezone', label: 'Time zone', kind: 'text', maxLength: 50, width: 130, hint: 'IANA name, e.g. Asia/Bangkok' },
          { key: 'paperlessCode', label: 'Paperless', kind: 'code', maxLength: 10, width: 90, hint: 'Thai customs e-paperless port code' },
          { key: 'isActive', label: 'Active', kind: 'bool', width: 60 },
        ]}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        rowKey={p => p.portCode}
        blank={() => ({
          portCode: '', unLocode: null, portNameEn: '', portNameLocal: null, portType: 'SEAPORT', countryCode: 'TH',
          tradeMode: 'INTERNATIONAL', latitude: null, longitude: null, timezone: 'Asia/Bangkok', postcode: null,
          ediMappingCode: null, paperlessCode: null, isActive: true,
        })}
        canManage={can('mdm.logistics.manage')}
        noun="Port"
        searchText={p => `${p.portCode} ${p.unLocode ?? ''} ${p.portNameEn}`}
        search={list.search}
        onSearchChange={list.setSearch}
        onSave={async (draft, original) => { await saveCoded(PORTS_PATH, draft.portCode, draft, original === null); list.reload(); }}
        onDelete={async p => { await deleteCoded(PORTS_PATH, p.portCode, p.rowVersion!); list.reload(); }}
        deleteMessage={() => 'The port disappears from pick lists. Bookings and vessel calls that already name it keep the code. A port with contacts cannot be deleted — make it inactive.'}
        footer={list.footer}
        toolbar={
          <>
            <input className="gecko-input gecko-text-mono" style={{ width: 90 }} placeholder="Country" maxLength={2} value={country}
              onChange={e => setCountry(e.target.value.toUpperCase())} aria-label="Country" />
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
