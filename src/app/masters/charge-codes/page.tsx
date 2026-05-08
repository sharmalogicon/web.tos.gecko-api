"use client";
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { FilterPopover, FilterField, SortOption } from '@/components/ui/FilterPopover';
import { ExportButton } from '@/components/ui/ExportButton';
import { usePagination, TablePagination } from '@/components/ui/TablePagination';

type ChargeType = 'Revenue' | 'Cost' | 'Pass-through';
type ChargeBasis = 'Flat' | 'Per-unit' | 'Tiered';
type ChargeModule = 'TOS' | 'Trucking' | 'CFS' | 'M&R';

interface ChargeCode {
  code: string;
  desc: string;
  module: ChargeModule;
  type: ChargeType;
  unit: string;
  basis: ChargeBasis;
  currency: string;
  base: string;
  vat: string;
  inUse: string;
  tariffs: number;
  glRev: string;
  status: 'Active' | 'Inactive';
}

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  bg: string;
  codes: ChargeCode[];
}

const CHARGE_CATEGORIES: Category[] = [
  {
    id: 'gate', name: 'Gate & Access', icon: 'truck',
    color: 'var(--gecko-primary-600)', bg: 'var(--gecko-primary-50)',
    codes: [
      { code: 'GATE-IN',     desc: 'Gate-in processing, FCL laden',          module: 'TOS', type: 'Revenue',      unit: 'per move',     basis: 'Flat',     currency: 'THB', base: '฿120',    vat: '7%', inUse: '948',   tariffs: 12, glRev: '4110', status: 'Active' },
      { code: 'GATE-OUT',    desc: 'Gate-out processing, FCL laden',         module: 'TOS', type: 'Revenue',      unit: 'per move',     basis: 'Flat',     currency: 'THB', base: '฿120',    vat: '7%', inUse: '872',   tariffs: 12, glRev: '4110', status: 'Active' },
      { code: 'GATE-MTY-IN', desc: 'Gate-in, empty container',               module: 'TOS', type: 'Revenue',      unit: 'per move',     basis: 'Flat',     currency: 'THB', base: '฿80',     vat: '7%', inUse: '620',   tariffs: 10, glRev: '4110', status: 'Active' },
      { code: 'GATE-MTY-OUT',desc: 'Gate-out, empty container',              module: 'TOS', type: 'Revenue',      unit: 'per move',     basis: 'Flat',     currency: 'THB', base: '฿80',     vat: '7%', inUse: '580',   tariffs: 10, glRev: '4110', status: 'Active' },
      { code: 'GATE-APPT',   desc: 'Pre-booked gate appointment slot',       module: 'TOS', type: 'Revenue',      unit: 'per appt',     basis: 'Flat',     currency: 'THB', base: 'Free',    vat: '0%', inUse: '1,240', tariffs:  8, glRev: '4115', status: 'Active' },
      { code: 'NO-SHOW',     desc: 'No-show penalty (missed appointment)',   module: 'TOS', type: 'Revenue',      unit: 'per appt',     basis: 'Flat',     currency: 'THB', base: '฿500',    vat: '7%', inUse: '34',    tariffs:  8, glRev: '4115', status: 'Active' },
    ]
  },
  {
    id: 'yard', name: 'Yard & Handling', icon: 'grid',
    color: 'var(--gecko-info-600)', bg: 'var(--gecko-info-50)',
    codes: [
      { code: 'LIFT-ON',  desc: 'Container lift-on (crane / RTG / RS)',      module: 'TOS', type: 'Revenue', unit: 'per lift',   basis: 'Flat',    currency: 'THB', base: '฿850',  vat: '7%', inUse: '820', tariffs: 14, glRev: '4120', status: 'Active' },
      { code: 'LIFT-OFF', desc: 'Container lift-off (crane / RTG / RS)',     module: 'TOS', type: 'Revenue', unit: 'per lift',   basis: 'Flat',    currency: 'THB', base: '฿850',  vat: '7%', inUse: '800', tariffs: 14, glRev: '4120', status: 'Active' },
      { code: 'SHIFTING', desc: 'In-yard container reposition',              module: 'TOS', type: 'Revenue', unit: 'per move',   basis: 'Flat',    currency: 'THB', base: '฿480',  vat: '7%', inUse: '124', tariffs: 11, glRev: '4120', status: 'Active' },
      { code: 'RESTOW',   desc: 'Vessel restow (pre-departure shuffle)',     module: 'TOS', type: 'Revenue', unit: 'per move',   basis: 'Flat',    currency: 'THB', base: '฿1,200',vat: '7%', inUse: '28',  tariffs:  6, glRev: '4120', status: 'Active' },
      { code: 'LASH-ON',  desc: 'Container deck lashing — on',              module: 'TOS', type: 'Revenue', unit: 'per unit',   basis: 'Flat',    currency: 'THB', base: '฿320',  vat: '7%', inUse: '44',  tariffs:  4, glRev: '4121', status: 'Active' },
      { code: 'WEIGH-VGM',desc: 'VGM weighing (SOLAS SOLAS 2016)',          module: 'TOS', type: 'Revenue', unit: 'per unit',   basis: 'Flat',    currency: 'THB', base: '฿250',  vat: '7%', inUse: '68',  tariffs:  4, glRev: '4121', status: 'Active' },
    ]
  },
  {
    id: 'storage', name: 'Storage & Demurrage', icon: 'clock',
    color: 'var(--gecko-warning-600)', bg: 'var(--gecko-warning-50)',
    codes: [
      { code: 'STOR-FCL-T1', desc: 'Storage laden, free-time tier 1 (day 1–5)',  module: 'TOS', type: 'Revenue',      unit: 'per TEU·day', basis: 'Tiered', currency: 'THB', base: '฿80',  vat: '7%', inUse: '1,285', tariffs: 15, glRev: '4130', status: 'Active' },
      { code: 'STOR-FCL-T2', desc: 'Storage laden, escalation tier 2 (day 6–14)',module: 'TOS', type: 'Revenue',      unit: 'per TEU·day', basis: 'Tiered', currency: 'THB', base: '฿160', vat: '7%', inUse: '188',   tariffs: 15, glRev: '4130', status: 'Active' },
      { code: 'STOR-FCL-T3', desc: 'Storage laden, escalation tier 3 (day 15+)', module: 'TOS', type: 'Revenue',      unit: 'per TEU·day', basis: 'Tiered', currency: 'THB', base: '฿320', vat: '7%', inUse: '44',    tariffs: 15, glRev: '4130', status: 'Active' },
      { code: 'STOR-MTY',    desc: 'Storage, empty container',                   module: 'TOS', type: 'Revenue',      unit: 'per TEU·day', basis: 'Tiered', currency: 'THB', base: '฿60',  vat: '7%', inUse: '1,420', tariffs: 15, glRev: '4131', status: 'Active' },
      { code: 'DEMURRAGE',   desc: 'Carrier demurrage (container on terminal)',  module: 'TOS', type: 'Pass-through', unit: 'per TEU·day', basis: 'Tiered', currency: 'USD', base: '$12',  vat: '0%', inUse: '82',    tariffs:  8, glRev: '4132', status: 'Active' },
      { code: 'DETENTION',   desc: 'Carrier detention (container off-site)',     module: 'TOS', type: 'Pass-through', unit: 'per TEU·day', basis: 'Tiered', currency: 'USD', base: '$15',  vat: '0%', inUse: '38',    tariffs:  8, glRev: '4132', status: 'Active' },
    ]
  },
  {
    id: 'reefer', name: 'Reefer & DG', icon: 'thermometer',
    color: 'var(--gecko-accent-600)', bg: 'var(--gecko-accent-50)',
    codes: [
      { code: 'RF-PLUG',   desc: 'Reefer power plug-in & monitoring',         module: 'TOS', type: 'Revenue', unit: 'per day',     basis: 'Per-unit', currency: 'THB', base: '฿420',  vat: '7%', inUse: '42', tariffs: 8, glRev: '4140', status: 'Active' },
      { code: 'RF-UNPLUG', desc: 'Reefer unplug at gate-out',                  module: 'TOS', type: 'Revenue', unit: 'per event',   basis: 'Flat',     currency: 'THB', base: '฿80',   vat: '7%', inUse: '40', tariffs: 8, glRev: '4140', status: 'Active' },
      { code: 'RF-MON',    desc: 'Additional temp inspection (24h cycle)',     module: 'TOS', type: 'Revenue', unit: 'per event',   basis: 'Flat',     currency: 'THB', base: '฿80',   vat: '7%', inUse: '18', tariffs: 8, glRev: '4140', status: 'Active' },
      { code: 'RF-PTI',    desc: 'Pre-trip inspection (PTI)',                  module: 'TOS', type: 'Revenue', unit: 'per unit',    basis: 'Flat',     currency: 'THB', base: '฿1,500',vat: '7%', inUse: '14', tariffs: 6, glRev: '4140', status: 'Active' },
      { code: 'DG-HNDL',   desc: 'Dangerous goods handling surcharge',        module: 'TOS', type: 'Revenue', unit: 'per move',    basis: 'Flat',     currency: 'THB', base: '฿1,200',vat: '7%', inUse: '26', tariffs:10, glRev: '4141', status: 'Active' },
      { code: 'DG-SEG',    desc: 'DG segregation surcharge (per day)',        module: 'TOS', type: 'Revenue', unit: 'per TEU·day', basis: 'Flat',     currency: 'THB', base: '฿240',  vat: '7%', inUse: '12', tariffs:10, glRev: '4141', status: 'Active' },
      { code: 'OOG-HNDL',  desc: 'Out-of-gauge handling surcharge',           module: 'TOS', type: 'Revenue', unit: 'per move',    basis: 'Flat',     currency: 'THB', base: '฿2,800',vat: '7%', inUse: '8',  tariffs: 6, glRev: '4142', status: 'Active' },
    ]
  },
  {
    id: 'cfs', name: 'CFS / Warehouse', icon: 'box',
    color: 'var(--gecko-success-600)', bg: 'var(--gecko-success-50)',
    codes: [
      { code: 'STUFF',    desc: 'Container stuffing (LCL → FCL)',          module: 'CFS', type: 'Revenue', unit: 'per m³',     basis: 'Per-unit', currency: 'THB', base: '฿180', vat: '7%', inUse: '88',  tariffs: 5, glRev: '4150', status: 'Active' },
      { code: 'STRIP',    desc: 'Container stripping (FCL → LCL)',         module: 'CFS', type: 'Revenue', unit: 'per m³',     basis: 'Per-unit', currency: 'THB', base: '฿180', vat: '7%', inUse: '102', tariffs: 5, glRev: '4150', status: 'Active' },
      { code: 'SORT-LBL', desc: 'Sort, label & repack',                    module: 'CFS', type: 'Revenue', unit: 'per carton', basis: 'Per-unit', currency: 'THB', base: '฿8',   vat: '7%', inUse: '22',  tariffs: 4, glRev: '4151', status: 'Active' },
      { code: 'CFS-STOR', desc: 'CFS warehouse storage',                   module: 'CFS', type: 'Revenue', unit: 'per m²·day', basis: 'Tiered',   currency: 'THB', base: '฿22',  vat: '7%', inUse: '440', tariffs: 5, glRev: '4152', status: 'Active' },
      { code: 'RE-WEIGH', desc: 'Re-weighing (cargo claim support)',        module: 'CFS', type: 'Revenue', unit: 'per event',  basis: 'Flat',     currency: 'THB', base: '฿350', vat: '7%', inUse: '14',  tariffs: 3, glRev: '4151', status: 'Active' },
    ]
  },
  {
    id: 'mr', name: 'M&R / Depot', icon: 'tool',
    color: 'var(--gecko-warning-700)', bg: 'var(--gecko-warning-50)',
    codes: [
      { code: 'WASH-STD',   desc: 'Container cleaning, standard grade',    module: 'M&R', type: 'Revenue', unit: 'per unit',  basis: 'Flat',     currency: 'THB', base: '฿1,800',  vat: '7%', inUse: '38', tariffs: 4, glRev: '4160', status: 'Active' },
      { code: 'WASH-DG',    desc: 'Post-DG container deep-cleaning',       module: 'M&R', type: 'Revenue', unit: 'per unit',  basis: 'Flat',     currency: 'THB', base: '฿4,500',  vat: '7%', inUse: '6',  tariffs: 4, glRev: '4160', status: 'Active' },
      { code: 'PTI-MR',     desc: 'Pre-trip inspection (M&R)',              module: 'M&R', type: 'Revenue', unit: 'per unit',  basis: 'Flat',     currency: 'THB', base: '฿800',    vat: '7%', inUse: '24', tariffs: 3, glRev: '4161', status: 'Active' },
      { code: 'REPAIR-MIN', desc: 'Minor repair (≤ ฿5,000 scope)',         module: 'M&R', type: 'Revenue', unit: 'per event', basis: 'Per-unit', currency: 'THB', base: 'Quoted',  vat: '7%', inUse: '18', tariffs: 2, glRev: '4162', status: 'Active' },
      { code: 'REPAIR-MAJ', desc: 'Major repair (> ฿5,000 scope)',         module: 'M&R', type: 'Revenue', unit: 'per event', basis: 'Per-unit', currency: 'THB', base: 'Quoted',  vat: '7%', inUse: '8',  tariffs: 2, glRev: '4162', status: 'Inactive' },
    ]
  },
  {
    id: 'admin', name: 'Documentation & VAS', icon: 'fileText',
    color: 'var(--gecko-gray-600)', bg: 'var(--gecko-gray-50)',
    codes: [
      { code: 'DOC-FEE',     desc: 'Documentation / BL handling fee',       module: 'TOS', type: 'Revenue',      unit: 'per BL',    basis: 'Flat', currency: 'THB', base: '฿350',  vat: '7%', inUse: '340', tariffs: 8, glRev: '4170', status: 'Active' },
      { code: 'SEAL-VERIFY', desc: 'Seal verification & photo record',       module: 'TOS', type: 'Revenue',      unit: 'per event', basis: 'Flat', currency: 'THB', base: '฿40',   vat: '7%', inUse: '240', tariffs: 4, glRev: '4171', status: 'Active' },
      { code: 'SCAN-X',      desc: 'X-ray scanner inspection',               module: 'TOS', type: 'Revenue',      unit: 'per unit',  basis: 'Flat', currency: 'THB', base: '฿600',  vat: '7%', inUse: '18',  tariffs: 3, glRev: '4172', status: 'Active' },
      { code: 'VGM-CERT',    desc: 'VGM certificate issuance (SOLAS)',       module: 'TOS', type: 'Revenue',      unit: 'per BL',    basis: 'Flat', currency: 'THB', base: '฿150',  vat: '7%', inUse: '180', tariffs: 6, glRev: '4170', status: 'Active' },
      { code: 'CUSTOMS-EXAM',desc: 'Customs physical examination surcharge', module: 'TOS', type: 'Pass-through', unit: 'per event', basis: 'Flat', currency: 'THB', base: '฿1,800',vat: '0%', inUse: '32',  tariffs: 5, glRev: '4173', status: 'Active' },
    ]
  },
];

const TYPE_STYLE: Record<ChargeType, { bg: string; color: string }> = {
  'Revenue':      { bg: 'var(--gecko-success-100)',  color: 'var(--gecko-success-700)'  },
  'Cost':         { bg: 'var(--gecko-danger-100)',   color: 'var(--gecko-danger-700)'   },
  'Pass-through': { bg: 'var(--gecko-warning-100)',  color: 'var(--gecko-warning-700)'  },
};

const MODULE_COLOR: Record<ChargeModule, string> = {
  'TOS':     'var(--gecko-primary-600)',
  'Trucking':'var(--gecko-info-600)',
  'CFS':     'var(--gecko-accent-600)',
  'M&R':     'var(--gecko-warning-700)',
};

const CC_FILTER_FIELDS: FilterField[] = [
  { type: 'search',  key: 'query',    placeholder: 'Search code or description...' },
  { type: 'select',  key: 'module',   label: 'Module',   options: [{ label: 'All', value: '' }, { label: 'TOS', value: 'TOS' }, { label: 'CFS', value: 'CFS' }, { label: 'M&R', value: 'M&R' }, { label: 'Trucking', value: 'Trucking' }] },
  { type: 'select',  key: 'type',     label: 'Type',     options: [{ label: 'All', value: '' }, { label: 'Revenue', value: 'Revenue' }, { label: 'Cost', value: 'Cost' }, { label: 'Pass-through', value: 'Pass-through' }] },
  { type: 'select',  key: 'category', label: 'Category', options: [{ label: 'All', value: '' }, { label: 'Gate & Access', value: 'gate' }, { label: 'Yard & Handling', value: 'yard' }, { label: 'Storage', value: 'storage' }, { label: 'Reefer & DG', value: 'reefer' }, { label: 'CFS', value: 'cfs' }, { label: 'M&R / Depot', value: 'mr' }, { label: 'VAS', value: 'admin' }] },
  { type: 'select',  key: 'status',   label: 'Status',   options: [{ label: 'All', value: '' }, { label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }] },
];

const CC_SORT_OPTIONS: SortOption[] = [
  { label: 'Category', value: 'category' },
  { label: 'Code A → Z', value: 'code' },
  { label: 'Usage (high → low)', value: 'usage' },
  { label: 'Tariff count', value: 'tariffs' },
];

const ALL_CODES = CHARGE_CATEGORIES.flatMap(c => c.codes);
const totalCodes    = ALL_CODES.length;
const revenueCodes  = ALL_CODES.filter(c => c.type === 'Revenue').length;
const costCodes     = ALL_CODES.filter(c => c.type === 'Cost').length;
const ptCodes       = ALL_CODES.filter(c => c.type === 'Pass-through').length;
const totalEvents   = ALL_CODES.reduce((sum, c) => sum + parseInt(c.inUse.replace(/,/g, '') || '0'), 0);

export default function ChargeCodesPage() {
  const [filters, setFilters] = useState<Record<string, string>>({ query: '', module: '', type: '', category: '', status: '' });
  const [sortBy, setSortBy] = useState('category');

  const filtered = useMemo(() => {
    let rows = CHARGE_CATEGORIES.flatMap(cat =>
      cat.codes.map(c => ({ ...c, catId: cat.id, catName: cat.name, catColor: cat.color, catBg: cat.bg, catIcon: cat.icon }))
    );
    if (filters.query)    rows = rows.filter(r => r.code.toLowerCase().includes(filters.query.toLowerCase()) || r.desc.toLowerCase().includes(filters.query.toLowerCase()));
    if (filters.module)   rows = rows.filter(r => r.module === filters.module);
    if (filters.type)     rows = rows.filter(r => r.type === filters.type);
    if (filters.category) rows = rows.filter(r => r.catId === filters.category);
    if (filters.status)   rows = rows.filter(r => r.status === filters.status);
    if (sortBy === 'code')     rows = [...rows].sort((a, b) => a.code.localeCompare(b.code));
    if (sortBy === 'usage')    rows = [...rows].sort((a, b) => parseInt(b.inUse.replace(/,/g, '')) - parseInt(a.inUse.replace(/,/g, '')));
    if (sortBy === 'tariffs')  rows = [...rows].sort((a, b) => b.tariffs - a.tariffs);
    return rows;
  }, [filters, sortBy]);

  const { page, setPage, pageSize, setPageSize, totalPages, pageItems, totalItems, startRow, endRow } = usePagination(filtered);

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 60 }}>

      {/* Page Header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>Charge Codes</h1>
            <span className="gecko-count-badge">{totalCodes} codes</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-info-700)', background: 'var(--gecko-info-100)', padding: '2px 8px', borderRadius: 12 }}>{CHARGE_CATEGORIES.length} categories</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>
            Atomic billable services. Every rate card line and invoice item resolves to a charge code.
          </div>
        </div>
        <div className="gecko-toolbar">
          <ExportButton resource="Charge codes" iconSize={16} />
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm"><Icon name="copy" size={16} /> Clone from facility</button>
          <FilterPopover
            fields={CC_FILTER_FIELDS}
            values={filters}
            onChange={setFilters}
            onApply={(v) => setFilters(v)}
            onClear={() => setFilters({ query: '', module: '', type: '', category: '', status: '' })}
            sortOptions={CC_SORT_OPTIONS}
            sortValue={sortBy}
            onSortChange={setSortBy}
          />
          <Link href="/masters/charge-codes/new" className="gecko-btn gecko-btn-primary gecko-btn-sm">
            <Icon name="plus" size={16} /> New Charge Code
          </Link>
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: 'var(--gecko-border)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden' }}>
        {[
          { label: 'Total Codes',   value: totalCodes,                     sub: `across ${CHARGE_CATEGORIES.length} categories`,  color: 'var(--gecko-text-primary)' },
          { label: 'Revenue',       value: revenueCodes,                   sub: 'billable to customer',                            color: 'var(--gecko-success-700)' },
          { label: 'Pass-through',  value: ptCodes,                        sub: 'carrier / authority charges',                     color: 'var(--gecko-warning-700)' },
          { label: 'Cost',          value: costCodes,                      sub: 'internal / vendor cost',                          color: 'var(--gecko-danger-700)' },
          { label: 'Events (30d)',  value: totalEvents.toLocaleString(),   sub: 'invoiced occurrences',                            color: 'var(--gecko-primary-600)' },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: 'var(--gecko-bg-surface)', padding: '18px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{kpi.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
            <div style={{ fontSize: 11, color: 'var(--gecko-text-disabled)', marginTop: 4 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Flat Charge Codes Table */}
      <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--gecko-shadow-sm)' }}>
        <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 12.5 }}>
          <thead>
            <tr>
              <th style={{ width: 160, whiteSpace: 'nowrap' }}>Code</th>
              <th>Description</th>
              <th style={{ width: 76 }}>Module</th>
              <th style={{ width: 108 }}>Type</th>
              <th style={{ width: 120 }}>Billing Unit</th>
              <th style={{ width: 80 }}>Basis</th>
              <th style={{ width: 44 }}>Curr</th>
              <th style={{ textAlign: 'right', width: 100 }}>Base Rate</th>
              <th style={{ width: 50 }}>VAT</th>
              <th style={{ textAlign: 'right', width: 90 }}>In Use (30d)</th>
              <th style={{ textAlign: 'right', width: 70 }}>Tariffs</th>
              <th style={{ width: 56 }}>GL Rev</th>
              <th style={{ width: 72 }}>Status</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map(c => (
              <tr key={c.code} style={{ opacity: c.status === 'Inactive' ? 0.55 : 1 }}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <Link href={`/masters/charge-codes/${c.code}`} style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: c.catColor, fontSize: 12, whiteSpace: 'nowrap' }}>{c.code}</Link>
                </td>
                <td style={{ fontWeight: 500, color: 'var(--gecko-text-primary)' }}>{c.desc}</td>
                <td>
                  <span style={{ fontSize: 10, fontWeight: 700, color: MODULE_COLOR[c.module], background: 'var(--gecko-bg-subtle)', padding: '2px 6px', borderRadius: 4, letterSpacing: '0.04em' }}>{c.module}</span>
                </td>
                <td>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: TYPE_STYLE[c.type].bg, color: TYPE_STYLE[c.type].color }}>{c.type}</span>
                </td>
                <td style={{ color: 'var(--gecko-text-secondary)', fontSize: 12 }}>{c.unit}</td>
                <td style={{ color: 'var(--gecko-text-secondary)', fontSize: 12 }}>{c.basis}</td>
                <td style={{ fontSize: 11, fontWeight: 600, color: c.currency === 'USD' ? 'var(--gecko-info-700)' : 'var(--gecko-text-secondary)' }}>{c.currency}</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, fontSize: 12.5 }}>{c.base}</td>
                <td style={{ color: 'var(--gecko-info-600)', fontWeight: 600, fontSize: 12 }}>{c.vat}</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-secondary)', fontSize: 12 }}>{c.inUse}</td>
                <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 12 }}>{c.tariffs}</td>
                <td style={{ fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-disabled)', fontSize: 11 }}>{c.glRev}</td>
                <td>
                  <span className={`gecko-status-dot gecko-status-dot-${c.status === 'Active' ? 'active' : 'neutral'}`}>{c.status}</span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button style={{ background: 'transparent', border: 'none', color: 'var(--gecko-text-disabled)', cursor: 'pointer', padding: '2px 4px' }}>
                    <Icon name="moreHorizontal" size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <TablePagination
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
          totalPages={totalPages}
          startRow={startRow}
          endRow={endRow}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          noun="charge codes"
        />
      </div>

    </div>
  );
}
