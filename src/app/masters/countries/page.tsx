"use client";
import React from 'react';
import { useApi } from '@/lib/api/use-api';
import { COUNTRIES_PATH, type Country } from '@/lib/api/logistics';
import { EditableTable } from '../lookups/_components/EditableTable';

/**
 * LIVE, read-only — lookup.country (ISO 3166-1), the global list every tenant
 * shares. A tenant cannot add or change a country; ports, vessels (flag),
 * parties and locations refer to it by the two-letter code.
 *
 * The mock's regions, trade blocs, sanctions flags and per-country port counts
 * were fixtures and are gone.
 */
export default function CountriesPage() {
  const { data, error, loading } = useApi<Country[]>(COUNTRIES_PATH);

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto' }}>
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline gecko-stack-md">
            <h1 className="gecko-page-title">Countries</h1>
            <span className="gecko-count-badge">{loading && !data ? '…' : `${(data ?? []).length} countries`}</span>
          </div>
          <div className="gecko-page-subtitle gecko-mt-1">ISO 3166 — shared by every tenant and read-only. Ports, vessels and parties refer to a country by its two-letter code.</div>
        </div>
      </div>

      <EditableTable<Country>
        columns={[
          { key: 'countryCode', label: 'Code', kind: 'code', width: 70 },
          { key: 'iso3Code', label: 'ISO 3', kind: 'code', width: 70 },
          { key: 'numericCode', label: 'No.', kind: 'code', width: 60 },
          { key: 'nameEn', label: 'Name', kind: 'text' },
          { key: 'officialNameEn', label: 'Official name', kind: 'text' },
          { key: 'nameLocal', label: 'Thai', kind: 'text' },
          { key: 'defaultCurrency', label: 'Currency', kind: 'code', width: 80 },
        ]}
        rows={data}
        loading={loading}
        error={error}
        rowKey={c => c.countryCode}
        canManage={false}
        noun="Country"
        searchText={c => `${c.countryCode} ${c.iso3Code} ${c.numericCode} ${c.nameEn} ${c.officialNameEn ?? ''} ${c.nameLocal ?? ''}`}
        onSave={async () => { /* read-only */ }}
      />
    </div>
  );
}
