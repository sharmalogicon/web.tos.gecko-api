"use client";
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { FilterPopover, FilterField, SortOption } from '@/components/ui/FilterPopover';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { ExportButton } from '@/components/ui/ExportButton';
import { usePagination, TablePagination } from '@/components/ui/TablePagination';

// ─── New Line Modal Types ──────────────────────────────────────────────────────

type EdiMessage = 'COPARN' | 'CODECO' | 'BAPLIE';
type Alliance = 'None' | 'Gemini' | 'Premier' | 'Independent';

interface NewLineForm {
  lineCode: string;
  scacCode: string;
  fullName: string;
  brandColor: string;
  hqCity: string;
  hqCountry: string;
  primaryPrefix: string;
  secondaryPrefix: string;
  ediMessages: EdiMessage[];
  alliance: Alliance;
  active: boolean;
}

const EMPTY_LINE_FORM: NewLineForm = {
  lineCode: '',
  scacCode: '',
  fullName: '',
  brandColor: '#3b82f6',
  hqCity: '',
  hqCountry: '',
  primaryPrefix: '',
  secondaryPrefix: '',
  ediMessages: [],
  alliance: 'None',
  active: true,
};

const HQ_COUNTRY_OPTIONS = [
  { label: 'CH — Switzerland', value: 'CH' },
  { label: 'DK — Denmark', value: 'DK' },
  { label: 'HK — Hong Kong', value: 'HK' },
  { label: 'SG — Singapore', value: 'SG' },
  { label: 'TW — Taiwan', value: 'TW' },
  { label: 'DE — Germany', value: 'DE' },
  { label: 'FR — France', value: 'FR' },
  { label: 'IL — Israel', value: 'IL' },
  { label: 'US — United States', value: 'US' },
  { label: 'GB — United Kingdom', value: 'GB' },
  { label: 'Other', value: 'Other' },
];

const EDI_OPTIONS: EdiMessage[] = ['COPARN', 'CODECO', 'BAPLIE'];

// ─── New Line Modal ────────────────────────────────────────────────────────────

interface NewLineModalProps {
  onClose: () => void;
}

function NewLineModal({ onClose }: NewLineModalProps) {
  const [form, setForm] = useState<NewLineForm>({ ...EMPTY_LINE_FORM });
  const set = (partial: Partial<NewLineForm>) => setForm(prev => ({ ...prev, ...partial }));
  const { toast } = useToast();
  const handleSave = () => {
    if (!canSave) return;
    toast({ variant: 'success', title: 'Line saved', message: `${form.lineCode} · ${form.fullName} added.` });
    onClose();
  };

  const canSave = form.lineCode.trim() !== '' && form.scacCode.trim() !== '' && form.fullName.trim() !== '';

  const toggleEdi = (msg: EdiMessage) => {
    set({
      ediMessages: form.ediMessages.includes(msg)
        ? form.ediMessages.filter(m => m !== msg)
        : [...form.ediMessages, msg],
    });
  };

  const sectionHead = (title: string) => (
    <div style={{
      fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase' as const,
      letterSpacing: '0.09em', color: 'var(--gecko-primary-600)',
      marginBottom: 14, paddingBottom: 7,
      borderBottom: '2px solid rgba(var(--gecko-primary-rgb, 37,99,235), 0.12)',
    }}>
      {title}
    </div>
  );

  const Field = ({
    label, required, hint, children, span,
  }: { label: string; required?: boolean; hint?: string; children: React.ReactNode; span?: number }) => (
    <div className="gecko-form-group" style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <label className={`gecko-label${required ? ' gecko-label-required' : ''}`}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>{hint}</div>}
    </div>
  );

  return (
    <div
      className="gecko-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="gecko-modal gecko-modal-lg" style={{ display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-primary-50)', borderRadius: '12px 12px 0 0', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="ship" size={16} style={{ color: 'var(--gecko-primary-600)' }} />
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--gecko-text-primary)' }}>New Shipping Line</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>
              Register a new carrier or line operator in the master catalog.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, border: '1px solid var(--gecko-border)', borderRadius: 7, background: 'var(--gecko-bg-surface)', color: 'var(--gecko-text-secondary)', fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', flexShrink: 0 }}
          >
            ×
          </button>
        </div>

        {/* Form Body */}
        <div style={{ padding: '22px 24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Section 1: Identity */}
          <div>
            {sectionHead('Identity')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <Field label="Line Code" required hint='Uppercase short code, e.g. "MSC"'>
                <input
                  className="gecko-input gecko-text-mono"
                  placeholder="e.g. MSC"
                  value={form.lineCode}
                  onChange={e => set({ lineCode: e.target.value.toUpperCase() })}
                  style={{ textTransform: 'uppercase' }}
                />
              </Field>
              <Field label="SCAC Code" required hint="4-char carrier code, e.g. MSCU">
                <input
                  className="gecko-input gecko-text-mono"
                  placeholder="e.g. MSCU"
                  maxLength={4}
                  value={form.scacCode}
                  onChange={e => set({ scacCode: e.target.value.toUpperCase() })}
                  style={{ textTransform: 'uppercase' }}
                />
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'end' }}>
              <Field label="Full Name" required>
                <input
                  className="gecko-input"
                  placeholder='e.g. Mediterranean Shipping Co.'
                  value={form.fullName}
                  onChange={e => set({ fullName: e.target.value })}
                />
              </Field>
              <div className="gecko-form-group" style={{ flexShrink: 0 }}>
                <label className="gecko-label">Brand Color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="color"
                    value={form.brandColor}
                    onChange={e => set({ brandColor: e.target.value })}
                    style={{ width: 36, height: 34, padding: 2, border: '1px solid var(--gecko-border)', borderRadius: 6, cursor: 'pointer', background: 'var(--gecko-bg-surface)' }}
                  />
                  <div style={{ width: 20, height: 20, borderRadius: 4, background: form.brandColor, border: '1px solid var(--gecko-border)', flexShrink: 0 }} />
                  <span className="gecko-text-mono" style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>{form.brandColor}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Location */}
          <div>
            {sectionHead('Location')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="HQ City" hint='e.g. "Geneva"'>
                <input
                  className="gecko-input"
                  placeholder="e.g. Geneva"
                  value={form.hqCity}
                  onChange={e => set({ hqCity: e.target.value })}
                />
              </Field>
              <Field label="HQ Country">
                <select
                  className="gecko-input"
                  value={form.hqCountry}
                  onChange={e => set({ hqCountry: e.target.value })}
                >
                  <option value="">— Select —</option>
                  {HQ_COUNTRY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          {/* Section 3: Container Prefixes */}
          <div>
            {sectionHead('Container Prefixes')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Primary Prefix" hint='e.g. "MSCU"'>
                <input
                  className="gecko-input gecko-text-mono"
                  placeholder="e.g. MSCU"
                  value={form.primaryPrefix}
                  onChange={e => set({ primaryPrefix: e.target.value.toUpperCase() })}
                  style={{ textTransform: 'uppercase' }}
                />
              </Field>
              <Field label="Secondary Prefix" hint='Optional, e.g. "MEDU"'>
                <input
                  className="gecko-input gecko-text-mono"
                  placeholder="e.g. MEDU"
                  value={form.secondaryPrefix}
                  onChange={e => set({ secondaryPrefix: e.target.value.toUpperCase() })}
                  style={{ textTransform: 'uppercase' }}
                />
              </Field>
            </div>
          </div>

          {/* Section 4: EDI & Integration */}
          <div>
            {sectionHead('EDI & Integration')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="EDI Messages">
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 2 }}>
                  {EDI_OPTIONS.map(msg => {
                    const active = form.ediMessages.includes(msg);
                    return (
                      <button
                        key={msg}
                        type="button"
                        onClick={() => toggleEdi(msg)}
                        style={{
                          padding: '4px 12px',
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: active ? 'none' : '1px solid var(--gecko-border)',
                          background: active ? 'var(--gecko-primary-600)' : 'transparent',
                          color: active ? '#fff' : 'var(--gecko-text-secondary)',
                          fontFamily: 'var(--gecko-font-mono)',
                          letterSpacing: '0.04em',
                          transition: 'background 0.15s, color 0.15s',
                        }}
                      >
                        {msg}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Alliance">
                <select
                  className="gecko-input"
                  value={form.alliance}
                  onChange={e => set({ alliance: e.target.value as Alliance })}
                >
                  <option value="None">None</option>
                  <option value="Gemini">Gemini</option>
                  <option value="Premier">Premier</option>
                  <option value="Independent">Independent</option>
                </select>
              </Field>
            </div>
          </div>

          {/* Section 5: Status */}
          <div>
            {sectionHead('Status')}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', border: `1px solid ${form.active ? 'var(--gecko-success-200)' : 'var(--gecko-border)'}`, borderRadius: 8, background: form.active ? 'var(--gecko-success-50)' : 'var(--gecko-bg-subtle)', maxWidth: 340 }}>
              <button
                type="button"
                onClick={() => set({ active: !form.active })}
                style={{
                  width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', flexShrink: 0, marginTop: 2,
                  background: form.active ? 'var(--gecko-success-600)' : 'var(--gecko-gray-300)',
                  position: 'relative', transition: 'background 0.2s',
                }}
                role="switch"
                aria-checked={form.active}
              >
                <span style={{
                  position: 'absolute', top: 2, left: form.active ? 18 : 2,
                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.2s', display: 'block',
                }} />
              </button>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: form.active ? 'var(--gecko-success-700)' : 'var(--gecko-text-secondary)' }}>
                  {form.active ? 'Active' : 'Inactive'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>
                  {form.active ? 'Line is live and available for EDO and vessel assignments' : 'Line is disabled and will not appear in operational lookups'}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-surface)', borderRadius: '0 0 12px 12px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, fontSize: 11, color: 'var(--gecko-text-disabled)' }}>
            * Line Code, SCAC Code and Full Name are required
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose}>Cancel</button>
            <button
              className="gecko-btn gecko-btn-primary gecko-btn-sm"
              onClick={handleSave}
              disabled={!canSave}
              style={!canSave ? { opacity: 0.45, cursor: 'not-allowed' } : {}}
            >
              <Icon name="save" size={14} /> Save Line
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

const LINE_FILTER_FIELDS: FilterField[] = [
  { type: 'search', key: 'query', placeholder: 'Search SCAC, name, prefix...' },
  { type: 'select', key: 'edi', label: 'EDI', options: [{ label: 'All', value: '' }, { label: 'COPARN', value: 'coparn' }, { label: 'CODECO', value: 'codeco' }, { label: 'BAPLIE', value: 'baplie' }, { label: 'Manual', value: 'manual' }] },
  { type: 'select', key: 'alliance', label: 'Alliance', options: [{ label: 'All', value: '' }, { label: 'Gemini', value: 'gemini' }, { label: 'Premier', value: 'premier' }, { label: 'Independent', value: 'independent' }] },
  { type: 'select', key: 'status', label: 'Status', options: [{ label: 'All', value: '' }, { label: 'Active', value: 'active' }, { label: 'On hold', value: 'on-hold' }] },
];
const LINE_SORT_OPTIONS: SortOption[] = [
  { label: 'Name A → Z', value: 'name' },
  { label: 'Code A → Z', value: 'code' },
  { label: 'EDOs (high → low)', value: 'edos' },
  { label: 'Fleet size', value: 'fleet' },
];

const SHIPPING_LINES = [
  { id: 'MSC', scac: 'MSCU', name: 'Mediterranean Shipping Co.', hq: 'Geneva, CH', prefix: 'MSCU/MEDU', fleet: 18, edos: '1,284', edi: ['COPARN', 'CODECO', 'BAPLIE'], status: 'Active', color: '#FFCC00' },
  { id: 'OOCL', scac: 'OOLU', name: 'Orient Overseas Container Line', hq: 'Hong Kong, HK', prefix: 'OOLU/COCU', fleet: 14, edos: '942', edi: ['COPARN', 'CODECO'], status: 'Active', color: '#FF0000' },
  { id: 'MAEU', scac: 'MAEU', name: 'Maersk Line', hq: 'Copenhagen, DK', prefix: 'MAEU/MSKU', fleet: 16, edos: '1,118', edi: ['COPARN', 'CODECO', 'BAPLIE'], status: 'Active', color: '#40B4E5' },
  { id: 'CMA', scac: 'CMDU', name: 'CMA CGM Group', hq: 'Marseille, FR', prefix: 'CMAU/CXDU', fleet: 12, edos: '814', edi: ['COPARN', 'CODECO'], status: 'Active', color: '#D6001C' },
  { id: 'EMC', scac: 'EGLV', name: 'Evergreen Marine', hq: 'Taoyuan, TW', prefix: 'EGHU/EMCU', fleet: 9, edos: '612', edi: ['COPARN', 'CODECO'], status: 'Active', color: '#008B45' },
  { id: 'HLC', scac: 'HLCU', name: 'Hapag-Lloyd', hq: 'Hamburg, DE', prefix: 'HLXU/HLBU', fleet: 8, edos: '528', edi: ['COPARN', 'CODECO'], status: 'Active', color: '#FF8C00' },
  { id: 'YML', scac: 'YNLU', name: 'Yang Ming Marine', hq: 'Keelung, TW', prefix: 'YNLU/YMNU', fleet: 7, edos: '455', edi: ['COPARN'], status: 'Active', color: '#0047AB' },
  { id: 'ONE', scac: 'ONEY', name: 'Ocean Network Express', hq: 'Singapore, SG', prefix: 'ONEU/TCLU', fleet: 11, edos: '721', edi: ['COPARN', 'CODECO', 'BAPLIE'], status: 'Active', color: '#FF007F' },
  { id: 'ZIM', scac: 'ZIMU', name: 'ZIM Integrated Shipping', hq: 'Haifa, IL', prefix: 'ZIMU/ZCSU', fleet: 5, edos: '298', edi: ['COPARN'], status: 'Active', color: '#00008B' },
  { id: 'PIL', scac: 'PCIU', name: 'Pacific Intl Lines', hq: 'Singapore, SG', prefix: 'PCIU/PILU', fleet: 4, edos: '184', edi: ['manual'], status: 'Active', color: '#0055A4' },
  { id: 'WHL', scac: 'WHLC', name: 'Wan Hai Lines', hq: 'Taipei, TW', prefix: 'WHLU', fleet: 3, edos: '126', edi: ['COPARN'], status: 'On hold', color: '#005BBB' },
];

export default function ShippingLinesPage() {
  const [filters, setFilters] = useState<Record<string, string>>({ query: '', edi: '', alliance: '', status: 'active' });
  const [sortBy, setSortBy] = useState('name');
  const [showNewLineModal, setShowNewLineModal] = useState(false);
  const { toast } = useToast();

  const filtered = useMemo(() => {
    return SHIPPING_LINES.filter((line) => {
      if (filters.query) {
        const q = filters.query.toLowerCase();
        if (!line.name.toLowerCase().includes(q) && !line.id.toLowerCase().includes(q) && !line.scac.toLowerCase().includes(q) && !line.prefix.toLowerCase().includes(q)) return false;
      }
      if (filters.status) {
        const s = filters.status.toLowerCase().replace('-', ' ');
        if (line.status.toLowerCase() !== s) return false;
      }
      return true;
    });
  }, [filters.query, filters.status]);

  const { page, setPage, pageSize, setPageSize, totalPages, pageItems, totalItems, startRow, endRow } = usePagination(filtered);

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>Shipping Lines</h1>
            <span className="gecko-count-badge">{pageItems.length} shown of {totalItems}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-info-700)', background: 'var(--gecko-info-100)', padding: '2px 8px', borderRadius: 12 }}>34 EDI-linked</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>Line operators and carriers. Source of EDO, BL, and vessel schedule.</div>
        </div>
        <div className="gecko-toolbar">
          <ExportButton resource="Shipping lines" iconSize={16} />
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => toast({ variant: 'info', title: 'Sync SMDG', message: 'SMDG carrier registry sync queued.' })}><Icon name="refreshCcw" size={16} /> Sync SMDG</button>
          <FilterPopover
            fields={LINE_FILTER_FIELDS}
            values={filters}
            onChange={setFilters}
            onApply={(v) => setFilters(v)}
            onClear={() => setFilters({ query: '', edi: '', alliance: '', status: '' })}
            sortOptions={LINE_SORT_OPTIONS}
            sortValue={sortBy}
            onSortChange={setSortBy}
          />
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => setShowNewLineModal(true)}><Icon name="plus" size={16} /> New Line</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--gecko-shadow-sm)' }}>
        <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ width: 100 }}>Code</th>
              <th>SCAC</th>
              <th>Line Operator</th>
              <th>HQ</th>
              <th>Container Prefix</th>
              <th style={{ textAlign: 'right' }}>Fleet</th>
              <th style={{ textAlign: 'right' }}>EDOs (30d)</th>
              <th>EDI Messages</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10}>
                  <EmptyState
                    icon="search"
                    title="No shipping lines match the current filters"
                    description="Try clearing the search query or adjusting alliance / status filters."
                  />
                </td>
              </tr>
            )}
            {pageItems.map((line, i) => (
              <tr key={line.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 4, background: line.color }} />
                    <span className="gecko-text-mono" style={{ fontWeight: 700, color: 'var(--gecko-primary-700)' }}>{line.id}</span>
                  </div>
                </td>
                <td className="gecko-text-mono" style={{ fontSize: 12, color: 'var(--gecko-text-secondary)' }}>{line.scac}</td>
                <td style={{ fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{line.name}</td>
                <td style={{ color: 'var(--gecko-text-secondary)' }}>{line.hq}</td>
                <td className="gecko-text-mono" style={{ fontSize: 12, fontWeight: 600 }}>{line.prefix}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{line.fleet}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{line.edos}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {line.edi.map(msg => (
                      msg === 'manual'
                        ? <span key={msg} style={{ background: 'var(--gecko-gray-100)', color: 'var(--gecko-text-secondary)', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, textTransform: 'lowercase' }}>{msg}</span>
                        : <span key={msg} style={{ background: 'var(--gecko-info-100)', color: 'var(--gecko-info-700)', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{msg}</span>
                    ))}
                  </div>
                </td>
                <td>
                  <span className={`gecko-status-dot gecko-status-dot-${line.status === 'Active' ? 'active' : 'warning'}`}>
                    {line.status}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button style={{ background: 'transparent', border: 'none', color: 'var(--gecko-text-disabled)', cursor: 'pointer' }}><Icon name="moreHorizontal" size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <TablePagination
          page={page} pageSize={pageSize} totalItems={totalItems}
          totalPages={totalPages} startRow={startRow} endRow={endRow}
          onPageChange={setPage} onPageSizeChange={setPageSize}
          noun="lines"
        />
      </div>

      {/* New Line Modal */}
      {showNewLineModal && (
        <NewLineModal onClose={() => setShowNewLineModal(false)} />
      )}

    </div>
  );
}
