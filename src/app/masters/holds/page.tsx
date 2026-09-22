"use client";
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePagination, TablePagination } from '@/components/ui/TablePagination';
import { Icon } from '@/components/ui/Icon';
import { FilterPopover, FilterField, SortOption } from '@/components/ui/FilterPopover';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { ExportButton } from '@/components/ui/ExportButton';
import { useApi } from '@/lib/api/use-api';
import { apiSend } from '@/lib/api/client';
import { ApiError } from '@/lib/api/problem';

/**
 * LIVE against gecko_master (equipment.hold) — list, create, edit, soft-delete.
 *
 * THIS IS A VOCABULARY, NOT AN ASSIGNMENT. It says a CUSTOMS hold exists, what
 * it blocks and who may lift it. Putting a hold on a box is TOS's job
 * (gecko_tos container_hold); this screen has no container on it.
 *
 * The API's vocabulary replaced the mock's, where they disagreed:
 *  - hold type: CUSTOMS / LEGAL / TECHNICAL / OPERATIONS / FINANCE / LINE
 *    (damage and survey are TECHNICAL; "port authority" is not a depot hold).
 *  - blocking scope names the MOVE it stops: ALL / RELEASE / LOAD / GATE_IN /
 *    GATE_OUT. The mock's "NONE — advisory only" is gone: a hold that blocks
 *    nothing is a remark, and remarks are not holds.
 *  - priority is 1–9 (1 = most urgent), not four words.
 *  - "auto apply" is not a switch but the platform EVENT that raises it
 *    (HOLD_EVENT, a closed code list the code raises). A switch with no event
 *    would be a hold that never fires.
 *  - the notify TEMPLATE is gone: which template goes out is Notification's
 *    configuration; the hold only says whether to notify.
 */

interface Hold {
  holdId: string;
  holdCode: string;
  descriptionEn: string;
  descriptionLocal: string | null;
  holdType: string;
  blockingScope: string;
  releaseAuthority: string;
  priority: number;
  displayColorHex: string | null;
  autoApplyOnEvent: string | null;
  notifyOnApply: boolean;
  isActive: boolean;
  rowVersion: string;
}

interface CodeValue { code: string; descriptionEn: string; isActive: boolean }

type HoldForm = Omit<Hold, 'holdId' | 'rowVersion'> & { rowVersion: string | null };

// ─── Vocabularies (mirror the API's AllowedValues) ───────────────────────────

const HOLD_TYPES: Record<string, { bg: string; color: string; label: string }> = {
  CUSTOMS:    { bg: 'var(--gecko-error-100)',  color: 'var(--gecko-error-700)',  label: 'Customs'    },
  LEGAL:      { bg: '#f3e8ff',                  color: '#6b21a8',                  label: 'Legal'      },
  TECHNICAL:  { bg: 'var(--gecko-warning-100)', color: 'var(--gecko-warning-700)', label: 'Technical'  },
  OPERATIONS: { bg: 'var(--gecko-info-100)',    color: 'var(--gecko-info-700)',    label: 'Operations' },
  FINANCE:    { bg: 'var(--gecko-success-100)', color: 'var(--gecko-success-700)', label: 'Finance'    },
  LINE:       { bg: 'var(--gecko-primary-100)', color: 'var(--gecko-primary-700)', label: 'Line'       },
};

const SCOPES: Record<string, { bg: string; color: string; label: string; hint: string }> = {
  ALL:      { bg: 'var(--gecko-error-100)',  color: 'var(--gecko-error-700)',  label: 'All moves', hint: 'No movement of any kind' },
  RELEASE:  { bg: 'var(--gecko-warning-100)', color: 'var(--gecko-warning-700)', label: 'Release',   hint: 'Cannot be released to a customer or line' },
  GATE_OUT: { bg: '#fef9c3',                  color: '#854d0e',                  label: 'Gate-out',  hint: 'Cannot leave through the gate' },
  LOAD:     { bg: 'var(--gecko-info-100)',    color: 'var(--gecko-info-700)',    label: 'Load',      hint: 'Cannot be loaded to a vessel' },
  GATE_IN:  { bg: 'var(--gecko-gray-100)',    color: 'var(--gecko-gray-600)',    label: 'Gate-in',   hint: 'Cannot be received' },
};

const AUTHORITIES: Record<string, string> = {
  CUSTOMS: 'Customs',
  LINE: 'Shipping line',
  SUPERVISOR: 'Supervisor',
  DEPOT_OPERATIONS: 'Depot operations',
  DEPOT_FINANCE: 'Depot finance',
  MNR: 'M&R',
};

const priorityStyle = (p: number) =>
  p <= 1 ? { bg: 'var(--gecko-error-100)',  color: 'var(--gecko-error-700)',  label: 'Critical' }
  : p <= 2 ? { bg: 'var(--gecko-warning-100)', color: 'var(--gecko-warning-700)', label: 'High' }
  : p <= 4 ? { bg: 'var(--gecko-info-100)',    color: 'var(--gecko-info-700)',    label: 'Normal' }
  : { bg: 'var(--gecko-gray-100)', color: 'var(--gecko-gray-500)', label: 'Low' };

// ─── Badges ──────────────────────────────────────────────────────────────────

function Pill({ bg, color, children, title }: { bg: string; color: string; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: bg, color, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

function HoldTypeBadge({ type }: { type: string }) {
  const s = HOLD_TYPES[type] ?? { bg: 'var(--gecko-gray-100)', color: 'var(--gecko-gray-600)', label: type };
  return <Pill bg={s.bg} color={s.color}>{s.label}</Pill>;
}

function ScopeBadge({ scope }: { scope: string }) {
  const s = SCOPES[scope] ?? { bg: 'var(--gecko-gray-100)', color: 'var(--gecko-gray-600)', label: scope, hint: '' };
  return <Pill bg={s.bg} color={s.color} title={s.hint}><Icon name="lock" size={10} />{s.label}</Pill>;
}

function PriorityBadge({ priority }: { priority: number }) {
  const s = priorityStyle(priority);
  return (
    <Pill bg={s.bg} color={s.color} title={`Priority ${priority} of 9 (1 = most urgent)`}>
      {priority <= 1 && <Icon name="zap" size={10} />}
      {priority} · {s.label}
    </Pill>
  );
}

function ReleaseAuthBadge({ auth }: { auth: string }) {
  return (
    <span className="gecko-badge gecko-badge-xs gecko-badge-gray">
      <Icon name="user" size={10} />
      {AUTHORITIES[auth] ?? auth}
    </span>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────

const EMPTY_FORM: HoldForm = {
  holdCode: '', descriptionEn: '', descriptionLocal: null,
  holdType: 'CUSTOMS', blockingScope: 'GATE_OUT', releaseAuthority: 'CUSTOMS',
  priority: 5, displayColorHex: null, autoApplyOnEvent: null, notifyOnApply: false,
  isActive: true, rowVersion: null,
};

const toForm = (h: Hold): HoldForm => ({ ...h });

// Defined at module level: a component declared inside the modal's render is a
// NEW component each keystroke, so React remounts the input and focus is lost.
function Field({ label, required, hint, error, children, span }: {
  label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode; span?: number;
}) {
  return (
    <div className="gecko-form-group" style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <label className={`gecko-label${required ? ' gecko-label-required' : ''}`}>{label}</label>
      {children}
      {error
        ? <div style={{ marginTop: 3, fontSize: 11, color: 'var(--gecko-error-600)' }}>{error}</div>
        : hint && <div className="gecko-cell-meta" style={{ marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

function Switch({ on, onChange, tone, title, children }: {
  on: boolean; onChange: (v: boolean) => void; tone: string; title: string; children: React.ReactNode;
}) {
  return (
    <div className="gecko-row gecko-row-start gecko-stack-md" style={{ padding: '12px 14px', border: '1px solid var(--gecko-border)', borderRadius: 8, background: on ? `var(--gecko-${tone}-50)` : 'var(--gecko-bg-surface)' }}>
      <button
        type="button"
        onClick={() => onChange(!on)}
        role="switch"
        aria-checked={on}
        aria-label={title}
        style={{
          width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', flexShrink: 0, marginTop: 2,
          background: on ? `var(--gecko-${tone}-600)` : 'var(--gecko-gray-300)', position: 'relative', transition: 'background 0.2s',
        }}
      >
        <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block' }} />
      </button>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{title}</div>
        <div className="gecko-cell-meta">{children}</div>
      </div>
    </div>
  );
}

const sectionHead = (title: string) => (
  <div style={{
    fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--gecko-primary-600)',
    marginBottom: 14, paddingBottom: 7, borderBottom: '2px solid rgba(var(--gecko-primary-rgb, 37,99,235), 0.12)',
  }}>{title}</div>
);

function HoldModal({ hold, events, onClose, onSaved }: {
  hold: Hold | null; events: CodeValue[]; onClose: () => void; onSaved: () => void;
}) {
  const isNew = hold === null;
  const [form, setForm] = useState<HoldForm>(hold ? toForm(hold) : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const { toast } = useToast();
  const set = (partial: Partial<HoldForm>) => setForm(prev => ({ ...prev, ...partial }));

  const canSave = !saving && form.holdCode.trim() !== '' && form.descriptionEn.trim() !== '';

  const body = () => ({
    holdCode: form.holdCode.trim(),
    descriptionEn: form.descriptionEn.trim(),
    descriptionLocal: form.descriptionLocal?.trim() || null,
    holdType: form.holdType,
    blockingScope: form.blockingScope,
    releaseAuthority: form.releaseAuthority,
    priority: form.priority,
    displayColorHex: form.displayColorHex || null,
    autoApplyOnEvent: form.autoApplyOnEvent || null,
    notifyOnApply: form.notifyOnApply,
    isActive: form.isActive,
    rowVersion: form.rowVersion,
  });

  const run = async (work: () => Promise<unknown>, done: string) => {
    setSaving(true);
    setError(null);
    try {
      await work();
      toast({ variant: 'success', title: done, message: `${form.holdCode} · ${form.descriptionEn}` });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
    } finally {
      setSaving(false);
    }
  };

  const save = () => canSave && run(
    () => isNew
      ? apiSend('POST', '/api/master/holds', body())
      : apiSend('PUT', `/api/master/holds/${encodeURIComponent(hold.holdCode)}`, body()),
    isNew ? 'Hold added' : 'Hold updated');

  const remove = () => {
    if (isNew || !window.confirm(`Delete hold ${hold.holdCode}? Boxes already carrying it keep their history.`)) return;
    run(() => apiSend('DELETE', `/api/master/holds/${encodeURIComponent(hold.holdCode)}`), 'Hold deleted');
  };

  const fieldError = (name: string) => error?.forField(name);
  const eventHint = events.find(e => e.code === form.autoApplyOnEvent)?.descriptionEn;

  return (
    <div className="gecko-overlay" onClick={e => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="gecko-modal gecko-modal-lg gecko-stack" style={{ gap: 0 }} role="dialog" aria-modal="true" aria-label={isNew ? 'New hold' : `Edit hold ${hold.holdCode}`}>

        {/* Header */}
        <div className="gecko-row gecko-row-start gecko-row-between gecko-flex-shrink-0" style={{ padding: '18px 24px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-error-50)', borderRadius: '12px 12px 0 0', gap: 16 }}>
          <div>
            <div className="gecko-row">
              <Icon name="lock" size={16} style={{ color: 'var(--gecko-error-600)' }} />
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--gecko-text-primary)' }}>
                {isNew ? 'New Hold' : `Edit Hold — ${hold.holdCode}`}
              </span>
            </div>
            <div className="gecko-cell-meta" style={{ fontSize: 12, marginTop: 3 }}>
              {isNew
                ? 'Define a kind of hold. Putting it on a box happens in the yard, not here.'
                : 'Changes apply to holds placed from now on; holds already on boxes keep what they were placed with.'}
            </div>
          </div>
          <button onClick={onClose} disabled={saving} aria-label="Close" className="gecko-mini-icon gecko-mini-icon-neutral"
            style={{ border: '1px solid var(--gecko-border)', borderRadius: 7, background: 'var(--gecko-bg-surface)', color: 'var(--gecko-text-secondary)', fontSize: 17, cursor: 'pointer', fontFamily: 'inherit' }}>
            ×
          </button>
        </div>

        {/* Body */}
        <div className="gecko-stack gecko-stack-xl gecko-flex-1" style={{ padding: '22px 24px', overflowY: 'auto' }}>

          {error && (
            <div role="alert" className="gecko-alert gecko-alert-error gecko-row" style={{ gap: 10 }}>
              <Icon name="alertCircle" size={16} /><span>{error.message}</span>
            </div>
          )}

          <div>
            {sectionHead('Identity')}
            <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16 }}>
              <Field label="Hold Code" required error={fieldError('holdCode')}
                hint={isNew ? "Upper-case, digits, '_' — e.g. LINE_STOP" : 'The code cannot change once boxes can carry it'}>
                <input className="gecko-input gecko-text-mono" placeholder="e.g. LINE_STOP" maxLength={20}
                  value={form.holdCode} disabled={!isNew}
                  onChange={e => set({ holdCode: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })} />
              </Field>
              <Field label="Description" required error={fieldError('descriptionEn')}>
                <input className="gecko-input" placeholder="e.g. Shipping line stop instruction" maxLength={200}
                  value={form.descriptionEn} onChange={e => set({ descriptionEn: e.target.value })} />
              </Field>
              <Field label="Colour" hint="Shown on the yard map" error={fieldError('displayColorHex')}>
                <div className="gecko-row" style={{ gap: 8 }}>
                  <input type="color" aria-label="Hold colour" value={form.displayColorHex ?? '#9CA3AF'}
                    onChange={e => set({ displayColorHex: e.target.value.toUpperCase() })}
                    style={{ width: 40, height: 32, padding: 0, border: '1px solid var(--gecko-border)', borderRadius: 6, background: 'none' }} />
                  <span className="gecko-text-mono gecko-cell-meta">{form.displayColorHex ?? 'none'}</span>
                </div>
              </Field>
              <Field label="Description (Thai)" error={fieldError('descriptionLocal')}>
                <input className="gecko-input" placeholder="e.g. ศุลกากรอายัด" maxLength={200}
                  value={form.descriptionLocal ?? ''} onChange={e => set({ descriptionLocal: e.target.value })} />
              </Field>
            </div>
          </div>

          <div>
            {sectionHead('Blocking & Release')}
            <div className="gecko-grid-2" style={{ gap: 16 }}>
              <Field label="Hold Type" required error={fieldError('holdType')}>
                <select className="gecko-input" value={form.holdType} onChange={e => set({ holdType: e.target.value })}>
                  {Object.entries(HOLD_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </Field>
              <Field label="Priority" hint="1 is the most urgent; the yard shows the highest hold first" error={fieldError('priority')}>
                <select className="gecko-input" value={form.priority} onChange={e => set({ priority: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(p => <option key={p} value={p}>{p} — {priorityStyle(p).label}</option>)}
                </select>
              </Field>
              <Field label="Blocks" required hint={SCOPES[form.blockingScope]?.hint} error={fieldError('blockingScope')}>
                <select className="gecko-input" value={form.blockingScope} onChange={e => set({ blockingScope: e.target.value })}>
                  {Object.entries(SCOPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </Field>
              <Field label="Released by" required hint="Who may lift this hold" error={fieldError('releaseAuthority')}>
                <select className="gecko-input" value={form.releaseAuthority} onChange={e => set({ releaseAuthority: e.target.value })}>
                  {Object.entries(AUTHORITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
            </div>
            <div className="gecko-row gecko-row-wrap gecko-mt-3" style={{ padding: '10px 14px', background: 'var(--gecko-bg-subtle)', borderRadius: 8, border: '1px solid var(--gecko-border)', gap: 10 }}>
              <span className="gecko-cell-meta" style={{ fontWeight: 600 }}>Preview:</span>
              <HoldTypeBadge type={form.holdType} />
              <ScopeBadge scope={form.blockingScope} />
              <ReleaseAuthBadge auth={form.releaseAuthority} />
              <PriorityBadge priority={form.priority} />
            </div>
          </div>

          <div>
            {sectionHead('Automation & Notification')}
            <div className="gecko-grid-2" style={{ gap: 16 }}>
              <Field label="Apply automatically when" error={fieldError('autoApplyOnEvent')}
                hint={eventHint ?? 'Leave empty to apply by hand only'}>
                <select className="gecko-input" value={form.autoApplyOnEvent ?? ''} onChange={e => set({ autoApplyOnEvent: e.target.value || null })}>
                  <option value="">— by hand only —</option>
                  {events.filter(e => e.isActive || e.code === form.autoApplyOnEvent).map(e => <option key={e.code} value={e.code}>{e.code}</option>)}
                </select>
              </Field>
              <Switch on={form.notifyOnApply} onChange={v => set({ notifyOnApply: v })} tone="success" title="Notify on apply">
                The responsible party is told when this hold is placed or lifted
              </Switch>
              <Switch on={form.isActive} onChange={v => set({ isActive: v })} tone="success" title={form.isActive ? 'Active' : 'Inactive'}>
                {form.isActive ? 'Offered when placing holds' : 'Hidden from the apply list; existing holds are unaffected'}
              </Switch>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="gecko-row gecko-flex-shrink-0" style={{ padding: '14px 24px', borderTop: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-surface)', borderRadius: '0 0 12px 12px', gap: 10 }}>
          {!isNew && (
            <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={remove} disabled={saving} style={{ color: 'var(--gecko-error-600)' }}>
              <Icon name="trash" size={14} /> Delete
            </button>
          )}
          <div className="gecko-action-toolbar" style={{ marginLeft: 'auto' }}>
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={save} disabled={!canSave}
              style={!canSave ? { opacity: 0.45, cursor: 'not-allowed' } : {}}>
              <Icon name="save" size={14} /> {saving ? 'Saving…' : isNew ? 'Save Hold' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Filter / Sort ───────────────────────────────────────────────────────────

const SORT_OPTIONS: SortOption[] = [
  { label: 'Priority (most urgent first)', value: 'priority' },
  { label: 'Code A → Z', value: 'code' },
  { label: 'Hold type', value: 'type' },
];

const all = (label: string) => ({ label, value: '' });
const FILTER_FIELDS: FilterField[] = [
  { type: 'search', key: 'query', placeholder: 'Search code or description…' },
  { type: 'select', key: 'holdType', label: 'Hold type', options: [all('All'), ...Object.entries(HOLD_TYPES).map(([k, v]) => ({ label: v.label, value: k }))] },
  { type: 'select', key: 'blockingScope', label: 'Blocks', options: [all('All'), ...Object.entries(SCOPES).map(([k, v]) => ({ label: v.label, value: k }))] },
  { type: 'select', key: 'releaseAuthority', label: 'Released by', options: [all('All'), ...Object.entries(AUTHORITIES).map(([k, v]) => ({ label: v, value: k }))] },
  { type: 'select', key: 'status', label: 'Status', options: [{ label: 'Active', value: 'active' }, { label: 'All', value: 'all' }] },
];

const NO_FILTERS = { query: '', holdType: '', blockingScope: '', releaseAuthority: '', status: 'active' };

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HoldsPage() {
  const [filters, setFilters] = useState<Record<string, string>>(NO_FILTERS);
  const [sortBy, setSortBy] = useState('priority');
  // undefined = closed, null = new, Hold = editing
  const [editing, setEditing] = useState<Hold | null | undefined>(undefined);

  const path = `/api/master/holds${filters.status === 'all' ? '?includeInactive=true' : ''}`;
  const { data, error, loading, reload } = useApi<Hold[]>(path);
  const { data: events } = useApi<CodeValue[]>('/api/master/code-lists/HOLD_EVENT');

  const holds = useMemo(() => data ?? [], [data]);

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const result = holds.filter(h =>
      (!filters.holdType || h.holdType === filters.holdType) &&
      (!filters.blockingScope || h.blockingScope === filters.blockingScope) &&
      (!filters.releaseAuthority || h.releaseAuthority === filters.releaseAuthority) &&
      (!q || h.holdCode.toLowerCase().includes(q) || h.descriptionEn.toLowerCase().includes(q) || (h.descriptionLocal ?? '').includes(filters.query.trim())));
    if (sortBy === 'code') return [...result].sort((a, b) => a.holdCode.localeCompare(b.holdCode));
    if (sortBy === 'type') return [...result].sort((a, b) => a.holdType.localeCompare(b.holdType) || a.priority - b.priority);
    return [...result].sort((a, b) => a.priority - b.priority || a.holdCode.localeCompare(b.holdCode));
  }, [holds, filters, sortBy]);

  const { page, setPage, pageSize, setPageSize, totalPages, pageItems, totalItems, startRow, endRow } = usePagination(filtered);

  const stats = [
    { label: 'Hold types', value: holds.length, color: 'var(--gecko-text-primary)' },
    { label: 'Critical', value: holds.filter(h => h.priority <= 1).length, color: 'var(--gecko-error-700)' },
    { label: 'Block all moves', value: holds.filter(h => h.blockingScope === 'ALL').length, color: 'var(--gecko-error-600)' },
    { label: 'Auto-applied', value: holds.filter(h => h.autoApplyOnEvent).length, color: 'var(--gecko-primary-600)' },
    { label: 'Notify', value: holds.filter(h => h.notifyOnApply).length, color: 'var(--gecko-success-700)' },
  ];

  const onSaved = () => { setEditing(undefined); reload(); };

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto' }}>

      {/* Header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline gecko-row-wrap gecko-stack-md">
            <h1 className="gecko-page-title">Holds</h1>
            <span className="gecko-count-badge">{loading && !data ? '…' : `${totalItems} hold types`}</span>
          </div>
          <div className="gecko-page-subtitle gecko-mt-1">
            The kinds of hold a box can carry — what each one stops, and who may lift it.
          </div>
        </div>
        <div className="gecko-toolbar">
          <ExportButton resource="Holds" iconSize={16} />
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={reload}>
            <Icon name="refreshCcw" size={16} /> Refresh
          </button>
          <FilterPopover
            fields={FILTER_FIELDS}
            values={filters}
            onChange={setFilters}
            onApply={v => setFilters(v)}
            onClear={() => setFilters(NO_FILTERS)}
            sortOptions={SORT_OPTIONS}
            sortValue={sortBy}
            onSortChange={setSortBy}
          />
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => setEditing(null)} disabled={!!error}>
            <Icon name="plus" size={16} /> New Hold
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="gecko-alert gecko-alert-warning gecko-row" style={{ gap: 10 }}>
          <Icon name="alertCircle" size={16} />
          <span>{error.message}</span>
          {error.status === 401 && <Link href="/login" className="gecko-link">Sign in</Link>}
        </div>
      )}

      {/* Stats */}
      <div className="gecko-row gecko-row-wrap gecko-stack-md">
        {stats.map(s => (
          <div key={s.label} className="gecko-card gecko-card-tight" style={{ textAlign: 'center', minWidth: 110 }}>
            <div className="gecko-stat-num" style={{ color: s.color }}>{s.value}</div>
            <div className="gecko-stat-label gecko-mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="gecko-table-card">
        <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 12.5, tableLayout: 'fixed', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 130 }}>Hold Code</th>
              <th>Description</th>
              <th style={{ width: 110 }}>Type</th>
              <th style={{ width: 110 }}>Blocks</th>
              <th style={{ width: 140 }}>Released by</th>
              <th style={{ width: 110 }}>Priority</th>
              <th style={{ width: 150 }}>Auto-applied on</th>
              <th style={{ width: 56, textAlign: 'center' }}>Notify</th>
              <th style={{ width: 76 }}>Status</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading && !data ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--gecko-text-secondary)' }}>Loading holds…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10}>
                <EmptyState
                  icon="search"
                  title={holds.length === 0 ? 'No hold types yet' : 'No holds match the current filters'}
                  description={holds.length === 0 ? 'Add the first kind of hold a box can carry.' : 'Try clearing the search or the type / scope filters.'}
                />
              </td></tr>
            ) : pageItems.map(h => (
              <tr key={h.holdId} style={{ opacity: h.isActive ? 1 : 0.55 }}>
                <td>
                  <button type="button" onClick={() => setEditing(h)} className="gecko-row"
                    style={{ gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, flexShrink: 0, background: h.displayColorHex ?? 'var(--gecko-gray-300)' }} />
                    <span className="gecko-badge gecko-badge-xs gecko-badge-primary gecko-text-mono">{h.holdCode}</span>
                  </button>
                </td>
                <td>
                  <div className="gecko-cell-two-line">
                    <div className="gecko-cell-primary" style={{ fontSize: 13 }}>{h.descriptionEn}</div>
                    {h.descriptionLocal && <div className="gecko-cell-sub gecko-truncate" style={{ fontSize: 11, fontFamily: 'inherit' }}>{h.descriptionLocal}</div>}
                  </div>
                </td>
                <td><HoldTypeBadge type={h.holdType} /></td>
                <td><ScopeBadge scope={h.blockingScope} /></td>
                <td><ReleaseAuthBadge auth={h.releaseAuthority} /></td>
                <td><PriorityBadge priority={h.priority} /></td>
                <td>
                  {h.autoApplyOnEvent ? (
                    <span className="gecko-row" style={{ gap: 4, color: 'var(--gecko-primary-600)', fontSize: 11 }}
                      title={events?.find(e => e.code === h.autoApplyOnEvent)?.descriptionEn}>
                      <Icon name="zap" size={12} />
                      <span className="gecko-text-mono">{h.autoApplyOnEvent}</span>
                    </span>
                  ) : <span className="gecko-cell-meta">by hand</span>}
                </td>
                <td style={{ textAlign: 'center' }}>
                  {h.notifyOnApply
                    ? <span title="Notifies on apply / release" className="gecko-inline-row" style={{ color: 'var(--gecko-success-600)' }}><Icon name="bell" size={14} /></span>
                    : <span style={{ color: 'var(--gecko-text-disabled)', fontSize: 16, lineHeight: 1 }}>—</span>}
                </td>
                <td>
                  <span className={`gecko-status-dot gecko-status-dot-${h.isActive ? 'active' : 'neutral'}`}>
                    {h.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button onClick={() => setEditing(h)} title="Edit hold" aria-label={`Edit hold ${h.holdCode}`}
                    style={{ background: 'transparent', border: 'none', color: 'var(--gecko-text-disabled)', cursor: 'pointer', padding: '3px 5px', borderRadius: 4 }}>
                    <Icon name="edit" size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <TablePagination page={page} pageSize={pageSize} totalItems={totalItems}
          totalPages={totalPages} startRow={startRow} endRow={endRow}
          onPageChange={setPage} onPageSizeChange={setPageSize} noun="holds" />
      </div>

      {editing !== undefined && (
        <HoldModal
          key={editing?.holdId ?? 'new'}
          hold={editing}
          events={events ?? []}
          onClose={() => setEditing(undefined)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
