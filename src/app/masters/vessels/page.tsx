"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { useSession } from '@/lib/auth/session';
import { useServerList } from '@/lib/api/use-server-list';
import { VESSELS_PATH, VESSEL_TYPES, type Vessel } from '@/lib/api/logistics';

/**
 * LIVE against gecko_master logistics.vessel. KORAKIT starts with none (its
 * old system had one placeholder, DUMMY, which was not loaded). The mock's
 * fleet, voyages and "in port" counts were fixtures and are gone; a vessel's
 * calls are on the vessel schedule.
 */
export default function VesselsPage() {
  const router = useRouter();
  const { can } = useSession();
  const [includeInactive, setIncludeInactive] = useState(false);
  const list = useServerList<Vessel>(VESSELS_PATH, { includeInactive }, 'vessels');
  const open = (v: Vessel) => router.push(`/masters/vessels/${encodeURIComponent(v.vesselCode)}`);

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto' }}>
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline gecko-stack-md">
            <h1 className="gecko-page-title">Vessels</h1>
            <span className="gecko-count-badge">{list.loading && !list.data ? '…' : `${list.total.toLocaleString()} found`}</span>
          </div>
          <div className="gecko-page-subtitle gecko-mt-1">The vessels vessel calls and bookings point at — by code, IMO, call sign and operator.</div>
        </div>
        <div className="gecko-toolbar">
          <Link href="/masters/vessels/schedule" className="gecko-btn gecko-btn-outline gecko-btn-sm"><Icon name="calendar" size={16} /> Vessel schedule</Link>
          {can('mdm.logistics.manage') && (
            <Link href="/masters/vessels/new" className="gecko-btn gecko-btn-primary gecko-btn-sm"><Icon name="plus" size={16} /> New vessel</Link>
          )}
        </div>
      </div>

      <div className="gecko-row gecko-row-wrap" style={{ gap: 12 }}>
        <div className="gecko-row" style={{ gap: 8, flex: '1 1 320px', maxWidth: 520 }}>
          <Icon name="search" size={16} style={{ color: 'var(--gecko-text-secondary)' }} />
          <input className="gecko-input" type="search" placeholder="Search code, name, IMO, call sign or MMSI…"
            value={list.search} onChange={e => list.setSearch(e.target.value)} aria-label="Search vessels" />
        </div>
        <label className="gecko-row gecko-cell-meta">
          <input type="checkbox" className="gecko-checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} />
          Show inactive
        </label>
      </div>

      {list.error && (
        <div role="alert" className="gecko-alert gecko-alert-error gecko-row" style={{ gap: 10 }}>
          <Icon name="alertCircle" size={16} /><span>{list.error.message}</span>
        </div>
      )}

      <div className="gecko-table-card">
        <table className="gecko-table gecko-table-comfortable">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>IMO</th>
              <th>Call sign</th>
              <th>Type</th>
              <th>Operator</th>
              <th>Flag</th>
              <th style={{ textAlign: 'right' }}>TEU</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {!list.loading && !list.error && (list.rows ?? []).length === 0 && (
              <tr><td colSpan={9}>
                <EmptyState icon="ship" title={list.search ? 'No vessels match' : 'No vessels yet'}
                  description={list.search ? 'Try the IMO number or the call sign.' : 'Add the vessels your depot works with.'} />
              </td></tr>
            )}
            {(list.rows ?? []).map(v => (
              <tr key={v.vesselCode} onClick={() => open(v)} style={{ cursor: 'pointer', opacity: list.loading ? 0.6 : 1 }}>
                <td><Link href={`/masters/vessels/${encodeURIComponent(v.vesselCode)}`} className="gecko-id-link" onClick={e => e.stopPropagation()}>{v.vesselCode}</Link></td>
                <td>
                  <div className="gecko-cell-two-line">
                    <div className="gecko-cell-primary">{v.vesselName}</div>
                    {v.vesselNameLocal && <div className="gecko-cell-sub" lang="th">{v.vesselNameLocal}</div>}
                  </div>
                </td>
                <td className="gecko-text-mono">{v.imoNumber ?? '—'}</td>
                <td className="gecko-text-mono">{v.callSign ?? '—'}</td>
                <td>{VESSEL_TYPES.find(t => t.value === v.vesselType)?.label ?? '—'}</td>
                <td>{v.operatorPartyCode ? <span title={v.operatorName ?? undefined}>{v.operatorPartyCode}</span> : '—'}</td>
                <td className="gecko-text-mono">{v.flagCountryCode ?? '—'}</td>
                <td className="gecko-num-tabular" style={{ textAlign: 'right' }}>{v.teuCapacity?.toLocaleString() ?? '—'}</td>
                <td><span className={`gecko-status-dot gecko-status-dot-${v.isActive ? 'active' : 'warning'}`}>{v.isActive ? 'Active' : 'Inactive'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.footer}
      </div>
    </div>
  );
}
