"use client";
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { FilterPopover, FilterField, SortOption } from '@/components/ui/FilterPopover';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { ExportButton } from '@/components/ui/ExportButton';
import { usePagination, TablePagination } from '@/components/ui/TablePagination';

const CUSTOMERS = [
  { id: 'C-00142', name: 'Thai Union Group PCL', country: 'TH', roles: ['Bill-to', 'Consignee'], tier: 'Key', taxId: '0107537000084', tariff: 'Custom • TU-2026', credit: '฿5.0M', balance: '฿2.14M', status: 'Active' },
  { id: 'C-00211', name: 'Siam Cement Group', country: 'TH', roles: ['Bill-to', 'Shipper'], tier: 'Key', taxId: '0107537000001', tariff: 'Custom • SCG-2026', credit: '฿8.0M', balance: '฿1.92M', status: 'Active' },
  { id: 'C-00308', name: 'PTT Global Chemical', country: 'TH', roles: ['Bill-to', 'Consignee', 'Shipper'], tier: 'Key', taxId: '0107537000128', tariff: 'Custom • PTT-2026', credit: '฿12.0M', balance: '฿3.81M', status: 'Active' },
  { id: 'C-00412', name: 'CP Foods Co., Ltd.', country: 'TH', roles: ['Bill-to', 'Consignee'], tier: 'Standard', taxId: '0107537000222', tariff: 'Standard LCB-2026', credit: '฿2.0M', balance: '฿445k', status: 'Active' },
  { id: 'C-00429', name: 'Saha Pathanapibul PCL', country: 'TH', roles: ['Consignee'], tier: 'Standard', taxId: '0107537000331', tariff: 'Standard LCB-2026', credit: '฿1.0M', balance: '฿124k', status: 'Active' },
  { id: 'C-00501', name: 'Betagro Public Co.', country: 'TH', roles: ['Bill-to', 'Consignee'], tier: 'Standard', taxId: '0107537000415', tariff: 'Standard LCB-2026', credit: '฿2.5M', balance: '—', status: 'Active' },
  { id: 'C-00622', name: 'Bangchak Corporation PCL', country: 'TH', roles: ['Shipper'], tier: 'Standard', taxId: '0107537000517', tariff: 'Standard LCB-2026', credit: '฿0', balance: '—', status: 'On hold' },
  { id: 'C-00714', name: 'Charoen Pokphand Foods PCL', country: 'TH', roles: ['Bill-to', 'Consignee', 'Shipper'], tier: 'Key', taxId: '0107537000644', tariff: 'Custom • CPF-2026', credit: '฿10.0M', balance: '฿4.20M', status: 'Active' },
  { id: 'C-00809', name: 'Indorama Ventures PCL', country: 'TH', roles: ['Shipper'], tier: 'Key', taxId: '0107537000752', tariff: 'Custom • IVL-2026', credit: '฿6.0M', balance: '฿1.04M', status: 'Active' },
];

const CUSTOMER_SORT_OPTIONS: SortOption[] = [
  { label: 'Last activity', value: 'activity' },
  { label: 'Name A → Z', value: 'name' },
  { label: 'Code A → Z', value: 'code' },
  { label: 'Credit (high → low)', value: 'credit' },
  { label: 'Balance (high → low)', value: 'balance' },
];

const CUSTOMER_FILTER_FIELDS: FilterField[] = [
  { type: 'search', key: 'query', placeholder: 'Search by name, code, tax ID, or SCAC...' },
  { type: 'select', key: 'role', label: 'Role', options: [{ label: 'All', value: '' }, { label: 'Bill-to', value: 'bill-to' }, { label: 'Consignee', value: 'consignee' }, { label: 'Shipper', value: 'shipper' }] },
  { type: 'select', key: 'tier', label: 'Tier', options: [{ label: 'All', value: '' }, { label: 'Key', value: 'key' }, { label: 'Standard', value: 'standard' }] },
  { type: 'select', key: 'tariff', label: 'Tariff', options: [{ label: 'All', value: '' }, { label: 'Custom', value: 'custom' }, { label: 'Standard LCB', value: 'standard' }] },
  { type: 'select', key: 'status', label: 'Status', options: [{ label: 'All', value: '' }, { label: 'Active', value: 'active' }, { label: 'On hold', value: 'on-hold' }] },
  { type: 'select', key: 'country', label: 'Country', options: [{ label: 'All', value: '' }, { label: 'Thailand', value: 'TH' }, { label: 'Other', value: 'other' }] },
];

function RoleBadge({ role }: { role: string }) {
  if (role === 'Bill-to') return <span style={{ background: 'var(--gecko-primary-100)', color: 'var(--gecko-primary-700)', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{role}</span>;
  if (role === 'Consignee') return <span style={{ background: 'var(--gecko-info-100)', color: 'var(--gecko-info-700)', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{role}</span>;
  if (role === 'Shipper') return <span style={{ background: 'var(--gecko-warning-100)', color: 'var(--gecko-warning-700)', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{role}</span>;
  return null;
}

// ─── New Customer Modal ───────────────────────────────────────────────────────

type CustomerRole = 'Bill-to' | 'Consignee' | 'Shipper';

interface NewCustomerForm {
  code: string;
  name: string;
  country: string;
  roles: CustomerRole[];
  tier: string;
  tariff: string;
  creditLimit: string;
  taxId: string;
  website: string;
  active: boolean;
  notes: string;
}

const EMPTY_CUSTOMER: NewCustomerForm = {
  code: '',
  name: '',
  country: 'TH',
  roles: [],
  tier: 'Standard',
  tariff: 'Standard LCB-2026',
  creditLimit: '',
  taxId: '',
  website: '',
  active: true,
  notes: '',
};

const ROLE_STYLE: Record<CustomerRole, { selected: { bg: string; color: string; border: string }; unselected: { bg: string; color: string; border: string } }> = {
  'Bill-to': {
    selected:   { bg: 'var(--gecko-primary-600)', color: '#fff',                          border: 'var(--gecko-primary-600)' },
    unselected: { bg: 'transparent',              color: 'var(--gecko-primary-600)',      border: 'var(--gecko-primary-300)' },
  },
  'Consignee': {
    selected:   { bg: 'var(--gecko-info-600)',    color: '#fff',                          border: 'var(--gecko-info-600)'    },
    unselected: { bg: 'transparent',              color: 'var(--gecko-info-600)',         border: 'var(--gecko-info-300)'    },
  },
  'Shipper': {
    selected:   { bg: 'var(--gecko-warning-500)', color: '#fff',                          border: 'var(--gecko-warning-500)' },
    unselected: { bg: 'transparent',              color: 'var(--gecko-warning-600)',      border: 'var(--gecko-warning-300)' },
  },
};

interface NewCustomerModalProps {
  onClose: () => void;
}

function NewCustomerModal({ onClose }: NewCustomerModalProps) {
  const [form, setForm] = useState<NewCustomerForm>({ ...EMPTY_CUSTOMER });
  const [touched, setTouched] = useState(false);
  const { toast } = useToast();

  const set = (partial: Partial<NewCustomerForm>) => setForm(prev => ({ ...prev, ...partial }));

  const toggleRole = (role: CustomerRole) => {
    set({
      roles: form.roles.includes(role)
        ? form.roles.filter(r => r !== role)
        : [...form.roles, role],
    });
  };

  const codeError   = touched && form.code.trim() === '';
  const nameError   = touched && form.name.trim() === '';
  const rolesError  = touched && form.roles.length === 0;
  const canSave     = form.code.trim() !== '' && form.name.trim() !== '' && form.roles.length > 0;

  const handleSave = () => {
    setTouched(true);
    if (!canSave) return;
    // TODO: persist new customer
    toast({ variant: 'success', title: 'Customer saved', message: `${form.code} · ${form.name} added.` });
    onClose();
  };

  const sectionHead = (title: string) => (
    <div style={{
      fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase' as const,
      letterSpacing: '0.09em', color: 'var(--gecko-success-700)',
      marginBottom: 14, paddingBottom: 7,
      borderBottom: '2px solid rgba(0,128,80,0.12)',
    }}>
      {title}
    </div>
  );

  const Field = ({
    label, required, hint, error, children, span,
  }: { label: string; required?: boolean; hint?: string; error?: boolean; children: React.ReactNode; span?: number }) => (
    <div className="gecko-form-group" style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <label className={`gecko-label${required ? ' gecko-label-required' : ''}`}
        style={error ? { color: 'var(--gecko-danger-600)' } : undefined}>
        {label}
      </label>
      {children}
      {hint && !error && <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>{hint}</div>}
      {error && <div style={{ fontSize: 11, color: 'var(--gecko-danger-600)', marginTop: 3 }}>This field is required</div>}
    </div>
  );

  return (
    <div
      className="gecko-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="gecko-modal gecko-modal-lg" style={{ display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-success-50)', borderRadius: '12px 12px 0 0', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="users" size={16} style={{ color: 'var(--gecko-success-600)' }} />
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--gecko-text-primary)' }}>
                New Customer
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>
              Create a new party record. One record can hold multiple roles — bill-to, consignee, or shipper.
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
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 16, marginBottom: 16 }}>
              <Field label="Customer Code" required error={codeError} hint="User-defined or auto-suggested">
                <input
                  className={`gecko-input gecko-text-mono${codeError ? ' gecko-input-error' : ''}`}
                  placeholder="C-0XXXX"
                  value={form.code}
                  onChange={e => set({ code: e.target.value })}
                  style={codeError ? { borderColor: 'var(--gecko-danger-400)' } : undefined}
                />
              </Field>
              <Field label="Full Legal Name" required error={nameError}>
                <input
                  className={`gecko-input${nameError ? ' gecko-input-error' : ''}`}
                  placeholder="e.g. Thai Union Group PCL"
                  value={form.name}
                  onChange={e => set({ name: e.target.value })}
                  style={nameError ? { borderColor: 'var(--gecko-danger-400)' } : undefined}
                />
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
              <Field label="Country" required>
                <select className="gecko-input" value={form.country} onChange={e => set({ country: e.target.value })} style={{ maxWidth: 280 }}>
                  <option value="TH">Thailand (TH)</option>
                  <option value="SG">Singapore (SG)</option>
                  <option value="MY">Malaysia (MY)</option>
                  <option value="ID">Indonesia (ID)</option>
                  <option value="VN">Vietnam (VN)</option>
                  <option value="OTHER">Other</option>
                </select>
              </Field>
            </div>
          </div>

          {/* Section 2: Roles */}
          <div>
            {sectionHead('Roles')}
            <div style={{ marginBottom: 6 }}>
              <label className="gecko-label gecko-label-required"
                style={rolesError ? { color: 'var(--gecko-danger-600)' } : undefined}>
                Assign Roles
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
              {(['Bill-to', 'Consignee', 'Shipper'] as CustomerRole[]).map(role => {
                const selected = form.roles.includes(role);
                const s = selected ? ROLE_STYLE[role].selected : ROLE_STYLE[role].unselected;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 20,
                      border: `1.5px solid ${s.border}`,
                      background: s.bg,
                      color: s.color,
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {selected && (
                      <span style={{ fontSize: 11, lineHeight: 1 }}>✓</span>
                    )}
                    {role}
                  </button>
                );
              })}
            </div>
            {rolesError && (
              <div style={{ fontSize: 11, color: 'var(--gecko-danger-600)', marginTop: 4 }}>At least one role must be selected</div>
            )}
            {!rolesError && (
              <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>Select at least one role. A single party record can hold multiple roles.</div>
            )}
          </div>

          {/* Section 3: Commercial */}
          <div>
            {sectionHead('Commercial')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <Field label="Customer Tier">
                <select className="gecko-input" value={form.tier} onChange={e => set({ tier: e.target.value })}>
                  <option value="Key Account">Key Account</option>
                  <option value="Standard">Standard</option>
                </select>
              </Field>
              <Field label="Assigned Tariff" hint={form.tariff === 'Custom' ? 'Custom tariff assigned after approval' : undefined}>
                <select className="gecko-input" value={form.tariff} onChange={e => set({ tariff: e.target.value })}>
                  <option value="Standard LCB-2026">Standard LCB-2026</option>
                  <option value="Custom">Custom</option>
                </select>
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16 }}>
              <Field label="Credit Limit" hint="0 = no credit">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 10px', height: 34, background: 'var(--gecko-bg-subtle)',
                    border: '1px solid var(--gecko-border)', borderRight: 'none',
                    borderRadius: '6px 0 0 6px', fontSize: 13, fontWeight: 700,
                    color: 'var(--gecko-text-secondary)', flexShrink: 0,
                  }}>
                    ฿
                  </span>
                  <input
                    className="gecko-input gecko-text-mono"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form.creditLimit}
                    onChange={e => set({ creditLimit: e.target.value })}
                    style={{ borderRadius: '0 6px 6px 0', borderLeft: 'none' }}
                  />
                </div>
              </Field>
            </div>
          </div>

          {/* Section 4: Contact */}
          <div>
            {sectionHead('Contact')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Tax ID / VAT Number">
                <input
                  className="gecko-input gecko-text-mono"
                  placeholder="0107537000000"
                  value={form.taxId}
                  onChange={e => set({ taxId: e.target.value })}
                />
              </Field>
              <Field label="Website">
                <input
                  className="gecko-input"
                  placeholder="company.com"
                  value={form.website}
                  onChange={e => set({ website: e.target.value })}
                />
              </Field>
            </div>
          </div>

          {/* Section 5: Status */}
          <div>
            {sectionHead('Status')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Active toggle */}
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px',
                border: `1px solid ${form.active ? 'var(--gecko-success-200)' : 'var(--gecko-border)'}`,
                borderRadius: 8, background: form.active ? 'var(--gecko-success-50)' : 'var(--gecko-bg-subtle)',
                maxWidth: 340,
              }}>
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
                    {form.active ? 'Customer is live and can be used in bookings' : 'Customer is disabled and will not appear in party lookups'}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="gecko-label">Notes <span style={{ fontWeight: 400, color: 'var(--gecko-text-disabled)' }}>(optional)</span></label>
                <textarea
                  className="gecko-input"
                  placeholder="Internal notes, credit approval details, account manager comments…"
                  value={form.notes}
                  onChange={e => set({ notes: e.target.value })}
                  rows={3}
                  style={{ resize: 'vertical', lineHeight: 1.55 }}
                />
              </div>

            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-surface)', borderRadius: '0 0 12px 12px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, fontSize: 11, color: 'var(--gecko-text-disabled)' }}>
            * Code, Name, and at least one Role are required
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose}>Cancel</button>
            <button
              className="gecko-btn gecko-btn-primary gecko-btn-sm"
              onClick={handleSave}
              disabled={touched && !canSave}
              style={touched && !canSave ? { opacity: 0.45, cursor: 'not-allowed' } : {}}
            >
              <Icon name="save" size={14} /> Save Customer
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CustomersListPage() {
  const [filters, setFilters] = useState<Record<string, string>>({
    query: '', role: '', tier: '', tariff: '', status: 'active', country: 'TH',
  });
  const [sortBy, setSortBy] = useState('activity');
  const [showModal, setShowModal] = useState(false);

  const filtered = useMemo(() => {
    return CUSTOMERS.filter((c) => {
      if (filters.query) {
        const q = filters.query.toLowerCase();
        if (!c.name.toLowerCase().includes(q) && !c.id.toLowerCase().includes(q) && !c.taxId.toLowerCase().includes(q)) return false;
      }
      if (filters.status) {
        const s = filters.status.toLowerCase().replace('-', ' ');
        if (c.status.toLowerCase() !== s) return false;
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
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>Customers</h1>
            <span className="gecko-count-badge">{pageItems.length} shown of {totalItems}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>Unified party master — bill-to, consignee, shipper, agent, prospect. One record, many roles.</div>
        </div>
        <div className="gecko-toolbar">
          <ExportButton resource="Customers" iconSize={16} />
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm"><Icon name="upload" size={16} /> Import</button>
          <FilterPopover
            fields={CUSTOMER_FILTER_FIELDS}
            values={filters}
            onChange={setFilters}
            onApply={(v) => setFilters(v)}
            onClear={() => setFilters({ query: '', role: '', tier: '', tariff: '', status: '', country: '' })}
            sortOptions={CUSTOMER_SORT_OPTIONS}
            sortValue={sortBy}
            onSortChange={setSortBy}
          />
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => setShowModal(true)}>
            <Icon name="plus" size={16} /> New Customer
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--gecko-shadow-sm)' }}>
        <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Roles</th>
              <th>Tier</th>
              <th>Tax ID</th>
              <th>Tariff</th>
              <th style={{ textAlign: 'right' }}>Credit</th>
              <th style={{ textAlign: 'right' }}>Balance</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    icon="search"
                    title="No customers match the current filters"
                    description="Try clearing the search query or adjusting role / tier / status filters."
                  />
                </td>
              </tr>
            )}
            {pageItems.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/masters/customers/${c.id}`} className="gecko-text-mono" style={{ fontWeight: 600, color: 'var(--gecko-primary-600)' }}>{c.id}</Link>
                </td>
                <td>
                  <div style={{ fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--gecko-text-disabled)' }}>{c.country}</div>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {c.roles.map(r => <RoleBadge key={r} role={r} />)}
                  </div>
                </td>
                <td>
                  <span style={{ fontSize: 11, fontWeight: 700, color: c.tier === 'Key' ? 'var(--gecko-warning-600)' : 'var(--gecko-text-secondary)' }}>{c.tier}</span>
                </td>
                <td className="gecko-text-mono" style={{ color: 'var(--gecko-text-secondary)' }}>{c.taxId}</td>
                <td style={{ color: 'var(--gecko-text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.tariff.includes('Custom') ? 'var(--gecko-primary-400)' : 'var(--gecko-gray-300)', flexShrink: 0 }} />
                    {c.tariff}
                  </div>
                </td>
                <td className="gecko-text-mono" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{c.credit}</td>
                <td className="gecko-text-mono" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{c.balance}</td>
                <td>
                  <span className={`gecko-status-dot gecko-status-dot-${c.status === 'Active' ? 'active' : 'warning'}`}>
                    {c.status}
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
          noun="customers"
        />
      </div>

      {/* New Customer Modal */}
      {showModal && (
        <NewCustomerModal onClose={() => setShowModal(false)} />
      )}

    </div>
  );
}
