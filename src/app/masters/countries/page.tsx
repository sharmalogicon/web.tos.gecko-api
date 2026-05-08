"use client";
import React, { useState, useMemo } from 'react';
import { usePagination, TablePagination } from '@/components/ui/TablePagination';
import { Icon } from '@/components/ui/Icon';
import { FilterPopover, FilterField, SortOption } from '@/components/ui/FilterPopover';
import { useToast } from '@/components/ui/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────

type Region = 'ASIA_PACIFIC' | 'EUROPE' | 'AMERICAS' | 'MIDDLE_EAST' | 'AFRICA' | 'OTHER';

interface Country {
  code: string;        // ISO 3166-1 alpha-2
  name: string;        // Official English name
  alpha3: string;      // ISO 3166-1 alpha-3
  numeric: string;     // ISO 3166-1 numeric (3-digit string)
  region: Region;
  unMember: boolean;
  mappingCode: string; // Legacy / EDI mapping
  active: boolean;
}

// ─── Static data — 22 countries, Asia-Pacific heavy ──────────────────────────

const COUNTRIES: Country[] = [
  { code: 'TH', name: 'Thailand',              alpha3: 'THA', numeric: '764', region: 'ASIA_PACIFIC', unMember: true,  mappingCode: 'TH',  active: true  },
  { code: 'SG', name: 'Singapore',             alpha3: 'SGP', numeric: '702', region: 'ASIA_PACIFIC', unMember: true,  mappingCode: 'SG',  active: true  },
  { code: 'MY', name: 'Malaysia',              alpha3: 'MYS', numeric: '458', region: 'ASIA_PACIFIC', unMember: true,  mappingCode: 'MY',  active: true  },
  { code: 'ID', name: 'Indonesia',             alpha3: 'IDN', numeric: '360', region: 'ASIA_PACIFIC', unMember: true,  mappingCode: 'ID',  active: true  },
  { code: 'VN', name: 'Viet Nam',              alpha3: 'VNM', numeric: '704', region: 'ASIA_PACIFIC', unMember: true,  mappingCode: 'VN',  active: true  },
  { code: 'PH', name: 'Philippines',           alpha3: 'PHL', numeric: '608', region: 'ASIA_PACIFIC', unMember: true,  mappingCode: 'PH',  active: true  },
  { code: 'CN', name: 'China',                 alpha3: 'CHN', numeric: '156', region: 'ASIA_PACIFIC', unMember: true,  mappingCode: 'CN',  active: true  },
  { code: 'JP', name: 'Japan',                 alpha3: 'JPN', numeric: '392', region: 'ASIA_PACIFIC', unMember: true,  mappingCode: 'JP',  active: true  },
  { code: 'KR', name: 'Korea, Republic of',    alpha3: 'KOR', numeric: '410', region: 'ASIA_PACIFIC', unMember: true,  mappingCode: 'KR',  active: true  },
  { code: 'IN', name: 'India',                 alpha3: 'IND', numeric: '356', region: 'ASIA_PACIFIC', unMember: true,  mappingCode: 'IN',  active: true  },
  { code: 'HK', name: 'Hong Kong',             alpha3: 'HKG', numeric: '344', region: 'ASIA_PACIFIC', unMember: false, mappingCode: 'HK',  active: true  },
  { code: 'BD', name: 'Bangladesh',            alpha3: 'BGD', numeric: '050', region: 'ASIA_PACIFIC', unMember: true,  mappingCode: 'BD',  active: true  },
  { code: 'LK', name: 'Sri Lanka',             alpha3: 'LKA', numeric: '144', region: 'ASIA_PACIFIC', unMember: true,  mappingCode: 'LK',  active: true  },
  { code: 'PK', name: 'Pakistan',              alpha3: 'PAK', numeric: '586', region: 'ASIA_PACIFIC', unMember: true,  mappingCode: 'PK',  active: true  },
  { code: 'AU', name: 'Australia',             alpha3: 'AUS', numeric: '036', region: 'ASIA_PACIFIC', unMember: true,  mappingCode: 'AU',  active: true  },
  { code: 'AE', name: 'United Arab Emirates',  alpha3: 'ARE', numeric: '784', region: 'MIDDLE_EAST',  unMember: true,  mappingCode: 'UAE', active: true  },
  { code: 'SA', name: 'Saudi Arabia',          alpha3: 'SAU', numeric: '682', region: 'MIDDLE_EAST',  unMember: true,  mappingCode: 'SA',  active: true  },
  { code: 'QA', name: 'Qatar',                 alpha3: 'QAT', numeric: '634', region: 'MIDDLE_EAST',  unMember: true,  mappingCode: 'QA',  active: true  },
  { code: 'GB', name: 'United Kingdom',        alpha3: 'GBR', numeric: '826', region: 'EUROPE',       unMember: true,  mappingCode: 'GB',  active: true  },
  { code: 'DE', name: 'Germany',               alpha3: 'DEU', numeric: '276', region: 'EUROPE',       unMember: true,  mappingCode: 'DE',  active: true  },
  { code: 'NL', name: 'Netherlands',           alpha3: 'NLD', numeric: '528', region: 'EUROPE',       unMember: true,  mappingCode: 'NL',  active: true  },
  { code: 'US', name: 'United States of America', alpha3: 'USA', numeric: '840', region: 'AMERICAS', unMember: true,  mappingCode: 'US',  active: true  },
];

// ─── Region display config ────────────────────────────────────────────────────

const REGION_CONFIG: Record<Region, { label: string; bg: string; color: string }> = {
  ASIA_PACIFIC: { label: 'Asia Pacific', bg: 'var(--gecko-primary-100)',  color: 'var(--gecko-primary-700)'  },
  EUROPE:       { label: 'Europe',       bg: 'var(--gecko-info-100)',     color: 'var(--gecko-info-700)'     },
  AMERICAS:     { label: 'Americas',     bg: 'var(--gecko-accent-100)',   color: 'var(--gecko-accent-700)'   },
  MIDDLE_EAST:  { label: 'Middle East',  bg: 'var(--gecko-warning-100)',  color: 'var(--gecko-warning-700)'  },
  AFRICA:       { label: 'Africa',       bg: 'var(--gecko-success-100)',  color: 'var(--gecko-success-700)'  },
  OTHER:        { label: 'Other',        bg: 'var(--gecko-gray-100)',     color: 'var(--gecko-gray-600)'     },
};

// ─── Filter / sort config ─────────────────────────────────────────────────────

const COUNTRY_SORT_OPTIONS: SortOption[] = [
  { label: 'Name A → Z',   value: 'name' },
  { label: 'Code A → Z',   value: 'code' },
  { label: 'Region',       value: 'region' },
  { label: 'Numeric code', value: 'numeric' },
];

const COUNTRY_FILTER_FIELDS: FilterField[] = [
  { type: 'search',  key: 'query',    placeholder: 'Search by name, code, or alpha-3…' },
  { type: 'select',  key: 'region',   label: 'Region',    options: [
    { label: 'All regions',  value: '' },
    { label: 'Asia Pacific', value: 'ASIA_PACIFIC' },
    { label: 'Europe',       value: 'EUROPE' },
    { label: 'Americas',     value: 'AMERICAS' },
    { label: 'Middle East',  value: 'MIDDLE_EAST' },
    { label: 'Africa',       value: 'AFRICA' },
    { label: 'Other',        value: 'OTHER' },
  ]},
  { type: 'select',  key: 'unMember', label: 'UN Member', options: [
    { label: 'All',    value: '' },
    { label: 'Yes',    value: 'yes' },
    { label: 'No',     value: 'no' },
  ]},
  { type: 'select',  key: 'status',   label: 'Status',    options: [
    { label: 'All',      value: '' },
    { label: 'Active',   value: 'active' },
    { label: 'Inactive', value: 'inactive' },
  ]},
];

// ─── Badge components ─────────────────────────────────────────────────────────

function RegionBadge({ region }: { region: Region }) {
  const cfg = REGION_CONFIG[region];
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 12,
      fontSize: 11,
      fontWeight: 600,
      background: cfg.bg,
      color: cfg.color,
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '2px 8px',
      borderRadius: 12,
      fontSize: 11,
      fontWeight: 700,
      background: active ? 'var(--gecko-success-100)' : 'var(--gecko-gray-100)',
      color:      active ? 'var(--gecko-success-700)' : 'var(--gecko-gray-500)',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: active ? 'var(--gecko-success-500)' : 'var(--gecko-gray-400)',
      }} />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

// ─── Country Modal ────────────────────────────────────────────────────────────

interface CountryModalProps {
  country: Country | null;
  isNew: boolean;
  onClose: () => void;
}

function CountryModal({ country, isNew, onClose }: CountryModalProps) {
  const [form, setForm] = useState({
    code:        country?.code        ?? '',
    name:        country?.name        ?? '',
    alpha3:      country?.alpha3      ?? '',
    numeric:     country?.numeric     ?? '',
    region:      country?.region      ?? 'ASIA_PACIFIC',
    unMember:    country?.unMember    ?? true,
    mappingCode: country?.mappingCode ?? '',
    active:      country?.active      ?? true,
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const setCheck = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.checked }));

  const canSave = form.code.trim().length === 2 && form.name.trim() !== '';
  const { toast } = useToast();
  const handleSave = () => {
    if (!canSave) return;
    toast({ variant: 'success', title: isNew ? 'Country added' : 'Country updated', message: `${form.code} · ${form.name}` });
    onClose();
  };

  const modalTitle = isNew
    ? 'New Country'
    : `Edit Country — ${country?.code ?? ''}`;

  const sectionHead = (title: string) => (
    <div style={{
      fontSize: 10.5,
      fontWeight: 800,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.09em',
      color: 'var(--gecko-primary-600)',
      marginBottom: 12,
      paddingBottom: 7,
      borderBottom: '2px solid var(--gecko-primary-100)',
    }}>
      {title}
    </div>
  );

  return (
    <div
      className="gecko-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="gecko-modal gecko-modal-lg" style={{ display: 'flex', flexDirection: 'column' }}>

        {/* ── Modal Header ── */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--gecko-border)',
          background: 'var(--gecko-primary-50)',
          borderRadius: '12px 12px 0 0',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="globe" size={16} style={{ color: 'var(--gecko-primary-600)' }} />
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--gecko-text-primary)' }}>{modalTitle}</span>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', padding: '1px 5px', borderRadius: 3, background: 'var(--gecko-info-100)', color: 'var(--gecko-info-700)' }}>ISO 3166-1</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>
              {isNew
                ? 'New entry — Country Code (alpha-2) and Name are required.'
                : `Editing · Last saved by system`}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, border: '1px solid var(--gecko-border)', borderRadius: 7, background: 'var(--gecko-bg-surface)', color: 'var(--gecko-text-secondary)', fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', flexShrink: 0 }}
          >×</button>
        </div>

        {/* ── Form body (scrollable) ── */}
        <div style={{ padding: '22px 24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Section 1 — Identity (required) */}
          <div>
            {sectionHead('Identity')}
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label className="gecko-label gecko-label-required">Country Code</label>
                <input
                  className="gecko-input gecko-text-mono"
                  value={form.code}
                  onChange={set('code')}
                  placeholder="e.g. TH"
                  maxLength={2}
                  style={{ textTransform: 'uppercase' }}
                />
                <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)' }}>ISO alpha-2, 2 chars</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label className="gecko-label gecko-label-required">Country Name</label>
                <input
                  className="gecko-input"
                  value={form.name}
                  onChange={set('name')}
                  placeholder="e.g. Thailand"
                />
                <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)' }}>Official English name</div>
              </div>
            </div>
          </div>

          {/* Section 2 — ISO Codes */}
          <div>
            {sectionHead('ISO 3166-1 Codes')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label className="gecko-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  ISO Alpha-3
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.04em', padding: '1px 5px', borderRadius: 3, background: 'var(--gecko-info-100)', color: 'var(--gecko-info-700)' }}>ISO</span>
                </label>
                <input
                  className="gecko-input gecko-text-mono"
                  value={form.alpha3}
                  onChange={set('alpha3')}
                  placeholder="e.g. THA"
                  maxLength={3}
                  style={{ textTransform: 'uppercase' }}
                />
                <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)' }}>3-character alphabetic code</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label className="gecko-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  ISO Numeric
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.04em', padding: '1px 5px', borderRadius: 3, background: 'var(--gecko-info-100)', color: 'var(--gecko-info-700)' }}>ISO</span>
                </label>
                <input
                  className="gecko-input gecko-text-mono"
                  value={form.numeric}
                  onChange={set('numeric')}
                  placeholder="e.g. 764"
                  maxLength={3}
                />
                <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)' }}>3-digit numeric code</div>
              </div>
            </div>
          </div>

          {/* Section 3 — Classification */}
          <div>
            {sectionHead('Classification')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label className="gecko-label">Region</label>
                <select className="gecko-input" value={form.region} onChange={set('region')}>
                  <option value="ASIA_PACIFIC">Asia Pacific</option>
                  <option value="EUROPE">Europe</option>
                  <option value="AMERICAS">Americas</option>
                  <option value="MIDDLE_EAST">Middle East</option>
                  <option value="AFRICA">Africa</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label className="gecko-label">UN Member</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.unMember}
                    onChange={setCheck('unMember')}
                    style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--gecko-primary-600)' }}
                  />
                  <span style={{ fontSize: 13, color: 'var(--gecko-text-primary)' }}>
                    {form.unMember ? 'UN member state' : 'Not a UN member / territory'}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 4 — Legacy Mapping & Status */}
          <div>
            {sectionHead('Mapping & Status')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label className="gecko-label">Mapping Code</label>
                <input
                  className="gecko-input gecko-text-mono"
                  value={form.mappingCode}
                  onChange={set('mappingCode')}
                  placeholder="e.g. TH or legacy EDI code"
                />
                <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)' }}>Legacy system / EDI mapping reference</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label className="gecko-label">Active</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={setCheck('active')}
                    style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--gecko-primary-600)' }}
                  />
                  <span style={{ fontSize: 13, color: 'var(--gecko-text-primary)' }}>
                    {form.active ? 'Active — visible in all dropdowns' : 'Inactive — hidden from dropdowns'}
                  </span>
                </label>
              </div>
            </div>
          </div>

        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--gecko-border)',
          background: 'var(--gecko-bg-surface)',
          borderRadius: '0 0 12px 12px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{ flex: 1, fontSize: 11, color: 'var(--gecko-text-disabled)' }}>
            * Country Code (alpha-2) and Name are required
          </div>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose}>Cancel</button>
          <button
            className="gecko-btn gecko-btn-primary gecko-btn-sm"
            onClick={handleSave}
            disabled={!canSave}
            style={!canSave ? { opacity: 0.45, cursor: 'not-allowed' } : {}}
          >
            <Icon name="save" size={14} /> {isNew ? 'Save Country' : 'Save Changes'}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CountriesPage() {
  const [filters, setFilters] = useState<Record<string, string>>({
    query: '', region: '', unMember: '', status: '',
  });
  const [sortBy, setSortBy] = useState('name');
  const [modalCountry, setModalCountry] = useState<Country | null>(null);
  const [isNew, setIsNew] = useState(false);

  const filtered = useMemo(() => {
    let list = [...COUNTRIES];

    // Text search
    const q = filters.query.trim().toLowerCase();
    if (q) {
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.alpha3.toLowerCase().includes(q) ||
        c.numeric.includes(q) ||
        c.mappingCode.toLowerCase().includes(q)
      );
    }

    // Region filter
    if (filters.region) {
      list = list.filter(c => c.region === filters.region);
    }

    // UN member filter
    if (filters.unMember === 'yes') list = list.filter(c => c.unMember);
    if (filters.unMember === 'no')  list = list.filter(c => !c.unMember);

    // Status filter
    if (filters.status === 'active')   list = list.filter(c => c.active);
    if (filters.status === 'inactive') list = list.filter(c => !c.active);

    // Sort
    if (sortBy === 'name')    list.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'code')    list.sort((a, b) => a.code.localeCompare(b.code));
    if (sortBy === 'region')  list.sort((a, b) => a.region.localeCompare(b.region) || a.name.localeCompare(b.name));
    if (sortBy === 'numeric') list.sort((a, b) => a.numeric.localeCompare(b.numeric));

    return list;
  }, [filters, sortBy]);

  const { page, setPage, pageSize, setPageSize, totalPages, pageItems, totalItems, startRow, endRow } = usePagination(filtered);

  const totalCount   = COUNTRIES.length;
  const activeCount  = COUNTRIES.filter(c => c.active).length;
  const regionCount  = new Set(COUNTRIES.map(c => c.region)).size;

  const openNew = () => {
    setIsNew(true);
    setModalCountry(null);
  };

  const openEdit = (c: Country) => {
    setIsNew(false);
    setModalCountry(c);
  };

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Page Header ── */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>Countries</h1>
            <span className="gecko-count-badge">{pageItems.length} shown of {totalItems}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>
            ISO 3166-1 country catalog. Reference for ports, customers, customs, and trade compliance.
          </div>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm"><Icon name="download" size={16} /> Export</button>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm"><Icon name="upload" size={16} /> Import</button>
          <FilterPopover
            fields={COUNTRY_FILTER_FIELDS}
            values={filters}
            onChange={setFilters}
            onApply={v => setFilters(v)}
            onClear={() => setFilters({ query: '', region: '', unMember: '', status: '' })}
            sortOptions={COUNTRY_SORT_OPTIONS}
            sortValue={sortBy}
            onSortChange={setSortBy}
          />
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={openNew}>
            <Icon name="plus" size={16} /> New Country
          </button>
        </div>
      </div>

      {/* ── Stats badges ── */}
      <div style={{ display: 'flex', gap: 12 }}>
        {[
          { label: 'Total countries', value: totalCount,   color: 'var(--gecko-text-primary)',   bg: 'var(--gecko-bg-subtle)',     border: 'var(--gecko-border)' },
          { label: 'Active',          value: activeCount,  color: 'var(--gecko-success-700)',    bg: 'var(--gecko-success-50)',    border: 'var(--gecko-success-200)' },
          { label: 'Regions',         value: regionCount,  color: 'var(--gecko-primary-700)',    bg: 'var(--gecko-primary-50)',    border: 'var(--gecko-primary-200)' },
        ].map(stat => (
          <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderRadius: 10, background: stat.bg, border: `1px solid ${stat.border}` }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: stat.color, opacity: 0.8 }}>{stat.label}</span>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--gecko-shadow-sm)' }}>
        <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ width: 80 }}>Code</th>
              <th>Country Name</th>
              <th style={{ width: 80 }}>Alpha-3</th>
              <th style={{ width: 80 }}>Numeric</th>
              <th style={{ width: 140 }}>Region</th>
              <th style={{ width: 90, textAlign: 'center' }}>UN Member</th>
              <th style={{ width: 140 }}>Mapping Code</th>
              <th style={{ width: 100 }}>Status</th>
              <th style={{ width: 48 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 20px', color: 'var(--gecko-text-secondary)' }}>
                    <Icon name="globe" size={32} style={{ color: 'var(--gecko-text-disabled)', marginBottom: 10 }} />
                    <div style={{ fontSize: 14, fontWeight: 600 }}>No countries match your filters</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Try adjusting the search or filter criteria.</div>
                  </div>
                </td>
              </tr>
            ) : (
              pageItems.map(c => (
                <tr key={c.code} style={{ opacity: c.active ? 1 : 0.55 }}>

                  {/* Code */}
                  <td>
                    <span style={{
                      fontFamily: 'var(--gecko-font-mono)',
                      fontWeight: 700,
                      fontSize: 12,
                      color: 'var(--gecko-primary-700)',
                      background: 'var(--gecko-primary-50)',
                      border: '1px solid var(--gecko-primary-200)',
                      padding: '2px 8px',
                      borderRadius: 6,
                      letterSpacing: '0.04em',
                    }}>
                      {c.code}
                    </span>
                  </td>

                  {/* Name */}
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{c.name}</div>
                  </td>

                  {/* Alpha-3 */}
                  <td>
                    <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 12, color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>
                      {c.alpha3 || <span style={{ color: 'var(--gecko-text-disabled)' }}>—</span>}
                    </span>
                  </td>

                  {/* Numeric */}
                  <td>
                    <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 12, color: 'var(--gecko-text-secondary)' }}>
                      {c.numeric || <span style={{ color: 'var(--gecko-text-disabled)' }}>—</span>}
                    </span>
                  </td>

                  {/* Region */}
                  <td><RegionBadge region={c.region} /></td>

                  {/* UN Member */}
                  <td style={{ textAlign: 'center' }}>
                    {c.unMember
                      ? <Icon name="check" size={16} style={{ color: 'var(--gecko-success-600)' }} />
                      : <span style={{ color: 'var(--gecko-text-disabled)', fontSize: 16, lineHeight: 1 }}>—</span>
                    }
                  </td>

                  {/* Mapping Code */}
                  <td>
                    {c.mappingCode
                      ? <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 12, color: 'var(--gecko-text-secondary)' }}>{c.mappingCode}</span>
                      : <span style={{ color: 'var(--gecko-text-disabled)' }}>—</span>
                    }
                  </td>

                  {/* Active */}
                  <td><ActiveBadge active={c.active} /></td>

                  {/* Actions */}
                  <td style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => openEdit(c)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--gecko-text-disabled)', cursor: 'pointer', padding: '3px 5px', borderRadius: 4 }}
                      title="Edit"
                    >
                      <Icon name="edit" size={14} />
                    </button>
                  </td>

                </tr>
              ))
            )}
          </tbody>
        </table>

        <TablePagination page={page} pageSize={pageSize} totalItems={totalItems}
          totalPages={totalPages} startRow={startRow} endRow={endRow}
          onPageChange={setPage} onPageSizeChange={setPageSize} noun="countries" />
      </div>

      {/* ── Country Modal ── */}
      {(isNew || modalCountry) && (
        <CountryModal
          country={modalCountry}
          isNew={isNew}
          onClose={() => { setModalCountry(null); setIsNew(false); }}
        />
      )}

    </div>
  );
}
