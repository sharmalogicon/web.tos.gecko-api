"use client";
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { usePagination, TablePagination } from '@/components/ui/TablePagination';
import { ExportButton } from '@/components/ui/ExportButton';
import { useToast } from '@/components/ui/Toast';

const CONTAINER_TYPES = [
  { id: '22G1', iso: '22G1', name: "20' Standard", dims: "20' × 8'6\"", type: 'GP', cat: 'GENERAL', payload: '28,230 kg', tare: '2,300 kg', cube: '33.2 m³', active: 12, color: 'var(--gecko-primary-500)', bg: 'var(--gecko-primary-50)' },
  { id: '42G1', iso: '42G1', name: "40' Standard", dims: "40' × 8'6\"", type: 'GP', cat: 'GENERAL', payload: '26,700 kg', tare: '3,750 kg', cube: '67.7 m³', active: 18, color: 'var(--gecko-primary-500)', bg: 'var(--gecko-primary-50)' },
  { id: '45G1', iso: '45G1', name: "40' High-Cube", dims: "40' × 9'6\"", type: 'GP', cat: 'GENERAL', payload: '26,500 kg', tare: '3,900 kg', cube: '76.3 m³', active: 14, color: 'var(--gecko-primary-500)', bg: 'var(--gecko-primary-50)' },
  { id: 'L5G1', iso: 'L5G1', name: "45' High-Cube", dims: "45' × 9'6\"", type: 'GP', cat: 'GENERAL', payload: '26,500 kg', tare: '4,800 kg', cube: '86 m³', active: 3, color: 'var(--gecko-primary-500)', bg: 'var(--gecko-primary-50)' },
  { id: '22R1', iso: '22R1', name: "20' Reefer", dims: "20' × 8'6\"", type: 'RF', cat: 'REEFER', payload: '27,400 kg', tare: '3,000 kg', cube: '28.1 m³', active: 4, color: 'var(--gecko-info-500)', bg: 'var(--gecko-info-50)' },
  { id: '42R1', iso: '42R1', name: "40' Reefer", dims: "40' × 8'6\"", type: 'RF', cat: 'REEFER', payload: '26,900 kg', tare: '4,800 kg', cube: '57.8 m³', active: 3, color: 'var(--gecko-info-500)', bg: 'var(--gecko-info-50)' },
  { id: '45R1', iso: '45R1', name: "40' Reefer HC", dims: "40' × 9'6\"", type: 'RF', cat: 'REEFER', payload: '29,520 kg', tare: '4,580 kg', cube: '67.3 m³', active: 5, color: 'var(--gecko-info-500)', bg: 'var(--gecko-info-50)' },
  { id: '22U1', iso: '22U1', name: "20' Open Top", dims: "20' × 8'6\"", type: 'OT', cat: 'SPECIAL', payload: '28,080 kg', tare: '2,450 kg', cube: '32 m³', active: 2, color: 'var(--gecko-warning-500)', bg: 'var(--gecko-warning-50)' },
  { id: '42U1', iso: '42U1', name: "40' Open Top", dims: "40' × 8'6\"", type: 'OT', cat: 'SPECIAL', payload: '26,580 kg', tare: '3,870 kg', cube: '65.4 m³', active: 3, color: 'var(--gecko-warning-500)', bg: 'var(--gecko-warning-50)' },
];

function ContainerGraphic({ width, height, color }: { width: number, height: number, color: string }) {
  return (
    <div style={{ width: '100%', height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
  const filtered = useMemo(() => CONTAINER_TYPES, []);
  const { page, setPage, pageSize, setPageSize, totalPages, pageItems, totalItems, startRow, endRow } = usePagination(filtered);
  const { toast } = useToast();

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>

      {/* Header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>ISO Container Types</h1>
            <span className="gecko-count-badge">58 types</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-info-700)', background: 'var(--gecko-info-100)', padding: '2px 8px', borderRadius: 12 }}>ISO 6346</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>ISO 6346 type code catalog. Drives rate matrix, yard slot dimensions, and vessel stow.</div>
        </div>
        <div className="gecko-toolbar">
          <ExportButton resource="Container types" iconSize={16} />
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => toast({ variant: 'info', title: 'Sync BIC', message: 'BIC code registry sync queued.' })}><Icon name="refreshCcw" size={16} /> Sync BIC</button>
          <Link href="/masters/container-types/new" className="gecko-btn gecko-btn-primary gecko-btn-sm"><Icon name="plus" size={16} /> New Type</Link>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24 }}>

        {/* Left Sidebar */}
        <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Categories */}
          <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--gecko-shadow-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--gecko-primary-50)', color: 'var(--gecko-primary-700)', fontWeight: 600, fontSize: 13, borderBottom: '1px solid var(--gecko-border)' }}>
              <span>All types</span>
              <span style={{ background: 'var(--gecko-primary-600)', color: '#fff', padding: '2px 8px', borderRadius: 12, fontSize: 11 }}>12</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', color: 'var(--gecko-text-secondary)', fontWeight: 500, fontSize: 13, borderBottom: '1px solid var(--gecko-border)' }}>
              <span>Dry / General</span>
              <span>4</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', color: 'var(--gecko-text-secondary)', fontWeight: 500, fontSize: 13, borderBottom: '1px solid var(--gecko-border)' }}>
              <span>Reefer</span>
              <span>3</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', color: 'var(--gecko-text-secondary)', fontWeight: 500, fontSize: 13 }}>
              <span>Special / Open</span>
              <span>5</span>
            </div>
          </div>

          {/* Size Filter */}
          <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, padding: 16, boxShadow: 'var(--gecko-shadow-sm)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-disabled)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Filter</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500 }}><input type="checkbox" checked readOnly /> 20'</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500 }}><input type="checkbox" checked readOnly /> 40'</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500 }}><input type="checkbox" checked readOnly /> 45'</label>
            </div>
          </div>

        </div>

        {/* Right Grid */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {pageItems.map((c) => (
              <div key={c.iso} style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--gecko-shadow-sm)', display: 'flex', flexDirection: 'column' }}>

                {/* Graphic Area */}
                <div style={{ background: c.bg, padding: 16, borderBottom: '1px solid var(--gecko-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: c.color, letterSpacing: '0.05em' }}>{c.cat}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gecko-text-primary)', fontFamily: 'var(--gecko-font-mono)' }}>{c.iso}</span>
                  </div>

                  <ContainerGraphic
                    width={c.id.startsWith('2') ? 80 : c.id.startsWith('45') ? 160 : 140}
                    height={c.id.endsWith('1') && c.id.includes('5') ? 50 : 40}
                    color={c.color}
                  />
                </div>

                {/* Info Area */}
                <div style={{ padding: 16, flex: 1 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px 0', color: 'var(--gecko-text-primary)' }}>{c.name}</h3>
                  <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginBottom: 16 }}>{c.dims} · {c.type}</div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-disabled)', textTransform: 'uppercase' }}>Payload</div>
                      <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--gecko-font-mono)' }}>{c.payload}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-disabled)', textTransform: 'uppercase' }}>Tare</div>
                      <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--gecko-font-mono)' }}>{c.tare}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-disabled)', textTransform: 'uppercase' }}>Cube</div>
                      <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--gecko-font-mono)' }}>{c.cube}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-disabled)', textTransform: 'uppercase' }}>In Yard</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gecko-primary-600)' }}>{c.active} active</div>
                    </div>
                  </div>
                </div>

                {/* Footer Link */}
                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--gecko-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--gecko-bg-subtle)' }}>
                  <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>Rate row in tariff</span>
                  <Link href={`/masters/container-types/${c.iso}`} style={{ color: 'var(--gecko-primary-600)', fontSize: 12, fontWeight: 600 }}>View →</Link>
                </div>
              </div>
            ))}
          </div>
          <TablePagination page={page} pageSize={pageSize} totalItems={totalItems}
            totalPages={totalPages} startRow={startRow} endRow={endRow}
            onPageChange={setPage} onPageSizeChange={setPageSize} noun="container types" />
        </div>

      </div>
    </div>
  );
}
