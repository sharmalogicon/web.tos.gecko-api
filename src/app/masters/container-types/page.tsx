"use client";
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { usePagination, TablePagination } from '@/components/ui/TablePagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { useApiList } from '@/lib/api/use-api';
import { useSession } from '@/lib/auth/session';
import { useContainerCounts } from '@/lib/api/equipment-types';
import { isPathAvailable } from '@/lib/edition';

/**
 * LIVE against gecko_master (Gecko.MasterData, batch A).
 *
 * The screen shows the TENANT'S OWN equipment types, not the ISO catalogue:
 * SCT calls a 20ft dry box 20GP and KORAKIT calls it 20DV, and both map to ISO
 * 22G1 (gecko_master decision 4). Showing ISO codes here would show a
 * vocabulary no depot clerk uses.
 */

interface EquipmentType {
  equipmentTypeId: string;
  typeCode: string;
  descriptionEn: string;
  descriptionLocal: string | null;
  lengthFt: number | null;
  heightClass: string | null;
  isoGroupCode: string | null;
  teu: number | null;
  isReefer: boolean;
  isOog: boolean;
  isTank: boolean;
  tareWeightKg: number | null;
  maxPayloadKg: number | null;
  maxGrossKg: number | null;
  displayColorHex: string | null;
  isActive: boolean;
}

type Category = 'GENERAL' | 'REEFER' | 'SPECIAL';

function categoryOf(t: EquipmentType): Category {
  if (t.isReefer) return 'REEFER';
  if (t.isOog || t.isTank) return 'SPECIAL';
  return 'GENERAL';
}

const CATEGORY_STYLE: Record<Category, { color: string; bg: string }> = {
  GENERAL: { color: 'var(--gecko-primary-500)', bg: 'var(--gecko-primary-50)' },
  REEFER: { color: 'var(--gecko-info-500)', bg: 'var(--gecko-info-50)' },
  SPECIAL: { color: 'var(--gecko-warning-500)', bg: 'var(--gecko-warning-50)' },
};

const kg = (value: number | null) =>
  value === null ? '—' : `${Math.round(value).toLocaleString('en-US')} kg`;

const heightLabel = (t: EquipmentType) => (t.heightClass === 'HIGH_CUBE' ? "9'6\"" : "8'6\"");

const dimensions = (t: EquipmentType) =>
  t.lengthFt === null ? '—' : `${t.lengthFt}' × ${heightLabel(t)}`;

function ContainerGraphic({ width, height, color }: { width: number, height: number, color: string }) {
  return (
    <div className="gecko-row" style={{ width: '100%', height: 100, justifyContent: 'center' }}>
      <div style={{
        width: width, height: height, border: `2px solid ${color}`,
        background: `rgba(255,255,255,0.5)`, position: 'relative',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '4px 0'
      }}>
        {/* Container corrugation lines */}
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ width: '100%', height: 1, background: color, opacity: 0.3 }} />
        ))}
        {/* Door handle simulation */}
        <div style={{ position: 'absolute', right: 4, top: '30%', width: 2, height: '40%', background: color }} />
        {/* Corner castings */}
        <div style={{ position: 'absolute', top: -2, left: -2, width: 4, height: 4, background: color }} />
        <div style={{ position: 'absolute', top: -2, right: -2, width: 4, height: 4, background: color }} />
        <div style={{ position: 'absolute', bottom: -2, left: -2, width: 4, height: 4, background: color }} />
        <div style={{ position: 'absolute', bottom: -2, right: -2, width: 4, height: 4, background: color }} />
      </div>
    </div>
  );
}

export default function ContainerTypesPage() {
  const types = useApiList<EquipmentType>('/api/master/equipment-types?pageSize=200&includeInactive=false');
  // Counted by the database over the whole registry — a migrated depot carries
  // 100k+ boxes, so a page of containers counted here would be wrong. Yard
  // occupancy (what is HERE today) is TOS's, not this page's.
  const containerCounts = useContainerCounts();
  const { user } = useSession();
  const canManage = user?.permissions.includes('mdm.equipment.manage') ?? false;

  const [category, setCategory] = useState<Category | 'ALL'>('ALL');
  const [sizes, setSizes] = useState<number[]>([20, 40, 45]);

  const rows = useMemo(() => types.data ?? [], [types.data]);

  const registered = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of containerCounts.data ?? []) counts.set(c.equipmentTypeId, c.containers);
    return counts;
  }, [containerCounts.data]);

  const counts = useMemo(() => ({
    ALL: rows.length,
    GENERAL: rows.filter(t => categoryOf(t) === 'GENERAL').length,
    REEFER: rows.filter(t => categoryOf(t) === 'REEFER').length,
    SPECIAL: rows.filter(t => categoryOf(t) === 'SPECIAL').length,
  }), [rows]);

  const filtered = useMemo(() => rows.filter(t =>
    (category === 'ALL' || categoryOf(t) === category) &&
    (t.lengthFt === null || sizes.includes(Math.round(t.lengthFt)))
  ), [rows, category, sizes]);

  const { page, setPage, pageSize, setPageSize, totalPages, pageItems, totalItems, startRow, endRow } = usePagination(filtered);

  const toggleSize = (size: number) =>
    setSizes(current => current.includes(size) ? current.filter(s => s !== size) : [...current, size]);

  const categories: Array<{ key: Category | 'ALL'; label: string }> = [
    { key: 'ALL', label: 'All types' },
    { key: 'GENERAL', label: 'Dry / General' },
    { key: 'REEFER', label: 'Reefer' },
    { key: 'SPECIAL', label: 'Special / Open' },
  ];

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', paddingBottom: 40 }}>

      {/* Header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline gecko-stack-md">
            <h1 className="gecko-page-title">Container Types</h1>
            <span className="gecko-count-badge">{types.loading ? '…' : `${counts.ALL} types`}</span>
            <span className="gecko-badge gecko-badge-info">ISO 6346 mapped</span>
          </div>
          <div className="gecko-page-subtitle gecko-mt-1">Your own equipment vocabulary, mapped to ISO 6346. Drives rate matrix, yard slot dimensions and vessel stow.</div>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => { types.reload(); containerCounts.reload(); }}>
            <Icon name="refreshCcw" size={16} /> Refresh
          </button>
          {canManage && isPathAvailable('/masters/container-types/new') && (
            <Link href="/masters/container-types/new" className="gecko-btn gecko-btn-primary gecko-btn-sm"><Icon name="plus" size={16} /> New Type</Link>
          )}
        </div>
      </div>

      {types.error && (
        <div role="alert" className="gecko-alert gecko-alert-warning gecko-row" style={{ gap: 10 }}>
          <Icon name="alertCircle" size={16} />
          <span>{types.error.message}</span>
          {types.error.status === 401 && <Link href="/login" className="gecko-link">Sign in</Link>}
        </div>
      )}

      <div className="gecko-row gecko-row-start" style={{ gap: 24 }}>

        {/* Left Sidebar */}
        <div className="gecko-stack gecko-flex-shrink-0" style={{ width: 240, gap: 20 }}>

          {/* Categories */}
          <div className="gecko-table-card">
            {categories.map(({ key, label }, index) => {
              const selected = category === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setCategory(key); setPage(1); }}
                  className="gecko-row gecko-row-between"
                  style={{
                    width: '100%', padding: '12px 16px', fontSize: 13, cursor: 'pointer',
                    fontWeight: selected ? 600 : 500,
                    background: selected ? 'var(--gecko-primary-50)' : 'transparent',
                    color: selected ? 'var(--gecko-primary-700)' : 'var(--gecko-text-secondary)',
                    border: 'none',
                    borderBottom: index < categories.length - 1 ? '1px solid var(--gecko-border)' : undefined,
                    textAlign: 'left',
                  }}
                >
                  <span>{label}</span>
                  <span className={selected ? 'gecko-badge gecko-badge-xs gecko-badge-primary-solid' : undefined}>
                    {counts[key]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Size Filter */}
          <div className="gecko-card">
            <div className="gecko-eyebrow gecko-mb-3">Filter</div>
            <div className="gecko-stack" style={{ gap: 10 }}>
              {[20, 40, 45].map(size => (
                <label key={size} className="gecko-row" style={{ fontSize: 13, fontWeight: 500 }}>
                  <input type="checkbox" checked={sizes.includes(size)} onChange={() => { toggleSize(size); setPage(1); }} />
                  {size}&apos;
                </label>
              ))}
            </div>
          </div>

        </div>

        {/* Right Grid */}
        <div className="gecko-flex-1">
          {types.loading && !types.data ? (
            <div className="gecko-card gecko-row" style={{ justifyContent: 'center', padding: 48, color: 'var(--gecko-text-secondary)' }}>
              Loading container types…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="box"
              title={rows.length === 0 ? 'No container types yet' : 'Nothing matches those filters'}
              description={rows.length === 0
                ? 'Equipment types are the tenant vocabulary the gate resolves ISO codes into.'
                : 'Try another category or size.'}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
              {pageItems.map((c) => {
                const style = CATEGORY_STYLE[categoryOf(c)];
                const color = c.displayColorHex ?? style.color;
                const length = c.lengthFt === null ? 40 : Math.round(c.lengthFt);
                return (
                  <div key={c.equipmentTypeId} className="gecko-table-card gecko-stack" style={{ gap: 0 }}>

                    {/* Graphic Area */}
                    <div style={{ background: style.bg, padding: 16, borderBottom: '1px solid var(--gecko-border)' }}>
                      <div className="gecko-row gecko-row-between gecko-mb-3">
                        <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: '0.05em' }}>{categoryOf(c)}</span>
                        <span className="gecko-mono-strong" style={{ fontSize: 12 }}>{c.typeCode}</span>
                      </div>

                      <ContainerGraphic
                        width={length <= 20 ? 80 : length >= 45 ? 160 : 140}
                        height={c.heightClass === 'HIGH_CUBE' ? 50 : 40}
                        color={color}
                      />
                    </div>

                    {/* Info Area */}
                    <div className="gecko-flex-1" style={{ padding: 16 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px 0', color: 'var(--gecko-text-primary)' }}>{c.descriptionEn}</h3>
                      <div className="gecko-card-subtitle gecko-mb-4" style={{ fontSize: 12 }}>
                        {dimensions(c)} · {c.isoGroupCode ?? '—'}{c.teu === null ? '' : ` · ${c.teu} TEU`}
                      </div>

                      <div className="gecko-grid-2">
                        <div>
                          <div className="gecko-eyebrow" style={{ letterSpacing: '0.06em' }}>Payload</div>
                          <div className="gecko-mono-strong" style={{ fontSize: 13 }}>{kg(c.maxPayloadKg)}</div>
                        </div>
                        <div>
                          <div className="gecko-eyebrow" style={{ letterSpacing: '0.06em' }}>Tare</div>
                          <div className="gecko-mono-strong" style={{ fontSize: 13 }}>{kg(c.tareWeightKg)}</div>
                        </div>
                        <div>
                          <div className="gecko-eyebrow" style={{ letterSpacing: '0.06em' }}>Max gross</div>
                          <div className="gecko-mono-strong" style={{ fontSize: 13 }}>{kg(c.maxGrossKg)}</div>
                        </div>
                        <div>
                          <div className="gecko-eyebrow" style={{ letterSpacing: '0.06em' }}>Registered</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gecko-primary-600)' }}>
                            {containerCounts.loading ? '…' : `${registered.get(c.equipmentTypeId) ?? 0} boxes`}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer Link */}
                    <div className="gecko-row gecko-row-between" style={{ padding: '12px 16px', borderTop: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)' }}>
                      <span className="gecko-cell-meta">Rate row in tariff</span>
                      {isPathAvailable(`/masters/container-types/${c.equipmentTypeId}`) && (
                        <Link href={`/masters/container-types/${c.equipmentTypeId}`} className="gecko-link" style={{ fontSize: 12 }}>View →</Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <TablePagination page={page} pageSize={pageSize} totalItems={totalItems}
            totalPages={totalPages} startRow={startRow} endRow={endRow}
            onPageChange={setPage} onPageSizeChange={setPageSize} noun="container types" />
        </div>

      </div>
    </div>
  );
}
