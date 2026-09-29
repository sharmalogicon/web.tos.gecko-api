"use client";
import React, { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/problem';

/**
 * The one editable table every small master on the Lookups screen uses
 * (decision B): grades, conditions, movements, service types, tax codes, code
 * list values and code mappings. One row is edited at a time, in place. The
 * API's field errors land under the cell they name. Deactivating is editing
 * the row's Active switch; Delete is a separate, confirmed action.
 */

export type ColumnKind = 'text' | 'code' | 'number' | 'select' | 'bool' | 'date';

export interface Column<T> {
  key: keyof T & string;
  label: string;
  kind: ColumnKind;
  options?: { value: string; label: string }[];
  required?: boolean;
  /** Editable only while the row is new — the code a row is found by. */
  createOnly?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: number;
  width?: number;
  hint?: string;
  /** Read-only rendering; defaults to the value (✓ / — for bool). */
  render?: (row: T) => React.ReactNode;
  /** Hide the input (the cell stays read-only) for rows where the column does not apply. */
  editableWhen?: (draft: T) => boolean;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[] | null;
  loading: boolean;
  error: ApiError | null;
  rowKey: (row: T) => string;
  /** The blank row "Add" starts from; omit to disallow adding. */
  blank?: () => T;
  canManage: boolean;
  /** Throws ApiError on failure; its field errors are shown on the cells. */
  onSave: (draft: T, original: T | null) => Promise<void>;
  /** Omit, or return a reason from cannotDelete, to disallow delete for a row. */
  onDelete?: (row: T) => Promise<void>;
  cannotDelete?: (row: T) => string | null;
  deleteLabel?: (row: T) => string;
  deleteMessage?: (row: T) => string;
  /** Text the search box matches against. */
  searchText: (row: T) => string;
  noun: string;
  /** Extra controls placed left of the search box (filters). */
  toolbar?: React.ReactNode;
  /** Shown above the table: what this master is for. */
  note?: React.ReactNode;
}

function Cell<T>({ col, draft, set, error, isNew }: {
  col: Column<T>; draft: T; set: (patch: Partial<T>) => void; error?: string; isNew: boolean;
}) {
  const value = draft[col.key] as unknown;
  const readOnly = (col.createOnly && !isNew) || (col.editableWhen && !col.editableWhen(draft));
  if (readOnly) return <>{col.render ? col.render(draft) : display(col, value)}</>;

  const change = (v: unknown) => set({ [col.key]: v } as Partial<T>);
  const invalid = error ? { 'aria-invalid': true as const } : {};
  let input: React.ReactNode;
  switch (col.kind) {
    case 'bool':
      input = <input type="checkbox" className="gecko-checkbox" checked={Boolean(value)} onChange={e => change(e.target.checked)} aria-label={col.label} />;
      break;
    case 'select':
      input = (
        <select className="gecko-input gecko-input-sm" value={(value as string | null) ?? ''} onChange={e => change(e.target.value || null)} aria-label={col.label} {...invalid}>
          {!col.required && <option value="">—</option>}
          {(col.options ?? []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
      break;
    case 'number':
      input = (
        <input type="number" className="gecko-input gecko-input-sm gecko-num-tabular" value={value === null || value === undefined ? '' : String(value)}
          min={col.min} max={col.max} step={col.step ?? 1} aria-label={col.label} {...invalid}
          onChange={e => change(e.target.value === '' ? null : Number(e.target.value))} />
      );
      break;
    case 'date':
      input = <input type="date" className="gecko-input gecko-input-sm" value={(value as string | null) ?? ''} aria-label={col.label} {...invalid} onChange={e => change(e.target.value || null)} />;
      break;
    default:
      input = (
        <input className={`gecko-input gecko-input-sm${col.kind === 'code' ? ' gecko-text-mono' : ''}`} value={(value as string | null) ?? ''}
          maxLength={col.maxLength} aria-label={col.label} {...invalid}
          onChange={e => change(col.kind === 'code' ? e.target.value.toUpperCase() : e.target.value)} />
      );
  }
  return (
    <div>
      {input}
      {error && <div className="gecko-field-error">{error}</div>}
    </div>
  );
}

function display<T>(col: Column<T>, value: unknown): React.ReactNode {
  if (col.kind === 'bool') return value ? <Icon name="check" size={14} /> : <span className="gecko-cell-meta">—</span>;
  if (value === null || value === undefined || value === '') return <span className="gecko-cell-meta">—</span>;
  if (col.kind === 'select') return col.options?.find(o => o.value === value)?.label ?? String(value);
  if (col.kind === 'code') return <span className="gecko-text-mono">{String(value)}</span>;
  return String(value);
}

export function EditableTable<T>({
  columns, rows, loading, error, rowKey, blank, canManage, onSave, onDelete, cannotDelete,
  deleteLabel, deleteMessage, searchText, noun, toolbar, note,
}: Props<T>) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  /** Key of the row being edited; '' = the new row. null = nothing in edit. */
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<T | null>(null);
  const [original, setOriginal] = useState<T | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<ApiError | null>(null);
  const [confirm, setConfirm] = useState<T | null>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter(r => !q || searchText(r).toLowerCase().includes(q));
  }, [rows, search, searchText]);

  const start = (row: T | null) => {
    setEditing(row ? rowKey(row) : '');
    setOriginal(row);
    setDraft(row ? { ...row } : blank!());
    setSaveError(null);
  };
  const stop = () => { setEditing(null); setDraft(null); setOriginal(null); setSaveError(null); };
  const set = (patch: Partial<T>) => setDraft(d => (d ? { ...d, ...patch } : d));

  const missing = draft ? columns.filter(c => c.required && c.kind !== 'bool' && (c.editableWhen?.(draft) ?? true)
    && (draft[c.key] === null || draft[c.key] === undefined || String(draft[c.key]).trim() === '')) : [];

  const save = async () => {
    if (!draft || missing.length > 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(draft, original);
      toast({ variant: 'success', title: original ? `${noun} updated` : `${noun} added`, message: rowKey(draft) });
      stop();
    } catch (e) {
      setSaveError(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: T) => {
    setConfirm(null);
    try {
      await onDelete!(row);
      toast({ variant: 'success', title: `${noun} deleted`, message: rowKey(row) });
      if (editing === rowKey(row)) stop();
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.');
      toast({ variant: 'danger', title: err.title, message: err.explanation ?? err.message });
    }
  };

  const fieldError = (key: string) => saveError?.forField(key);
  const unplacedError = saveError && !columns.some(c => saveError.forField(c.key)) ? saveError : null;

  const renderRow = (row: T, isNew: boolean) => {
    const key = isNew ? '' : rowKey(row);
    const inEdit = editing === key && draft !== null;
    const shown = inEdit ? draft! : row;
    const deleteReason = !isNew && onDelete ? cannotDelete?.(row) ?? null : 'n/a';
    return (
      <tr key={isNew ? '__new' : key} className={inEdit ? 'gecko-table-row-selected' : undefined}>
        {columns.map(col => (
          <td key={col.key} style={col.width ? { width: col.width } : undefined}>
            {inEdit
              ? <Cell col={col} draft={shown} set={set} error={fieldError(col.key)} isNew={isNew} />
              : col.render ? col.render(row) : display(col, row[col.key])}
          </td>
        ))}
        {canManage && (
          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
            {inEdit ? (
              <div className="gecko-row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={save} disabled={saving || missing.length > 0}
                  title={missing.length > 0 ? `Required: ${missing.map(c => c.label).join(', ')}` : undefined}>
                  <Icon name="save" size={13} /> {saving ? 'Saving…' : 'Save'}
                </button>
                <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={stop} disabled={saving}>Cancel</button>
              </div>
            ) : (
              <div className="gecko-row" style={{ gap: 2, justifyContent: 'flex-end' }}>
                <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={() => start(row)} disabled={editing !== null} aria-label={`Edit ${key}`}>
                  <Icon name="edit" size={13} />
                </button>
                {deleteReason === null && (
                  <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={() => setConfirm(row)} disabled={editing !== null}
                    aria-label={`${deleteLabel?.(row) ?? 'Delete'} ${key}`} title={deleteLabel?.(row) ?? 'Delete'}>
                    <Icon name="trash" size={13} />
                  </button>
                )}
              </div>
            )}
          </td>
        )}
      </tr>
    );
  };

  return (
    <div className="gecko-stack gecko-stack-md">
      {note && <div className="gecko-cell-meta">{note}</div>}
      <div className="gecko-row gecko-row-wrap" style={{ gap: 12 }}>
        {toolbar}
        <div className="gecko-row" style={{ gap: 8, flex: '1 1 260px', maxWidth: 420 }}>
          <Icon name="search" size={16} style={{ color: 'var(--gecko-text-secondary)' }} />
          <input className="gecko-input" type="search" placeholder="Search code or description…" value={search}
            onChange={e => setSearch(e.target.value)} aria-label={`Search ${noun.toLowerCase()}s`} />
        </div>
        {canManage && blank && (
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" style={{ marginLeft: 'auto' }} onClick={() => start(null)} disabled={editing !== null}>
            <Icon name="plus" size={14} /> Add {noun.toLowerCase()}
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="gecko-alert gecko-alert-error gecko-row" style={{ gap: 10 }}>
          <Icon name="alertCircle" size={16} /><span>{error.message}</span>
        </div>
      )}
      {unplacedError && (
        <div role="alert" className="gecko-alert gecko-alert-error gecko-row" style={{ gap: 10 }}>
          <Icon name="alertCircle" size={16} /><span>{unplacedError.explanation ?? unplacedError.message}</span>
        </div>
      )}

      <div className="gecko-table-card">
        <table className="gecko-table gecko-table-compact" style={{ fontSize: 12.5 }}>
          <thead>
            <tr>
              {columns.map(c => <th key={c.key} title={c.hint} style={c.width ? { width: c.width } : undefined}>{c.label}{c.required && editing !== null ? ' *' : ''}</th>)}
              {canManage && <th style={{ width: 110 }} />}
            </tr>
          </thead>
          <tbody>
            {editing === '' && draft && renderRow(draft, true)}
            {loading && !rows && (
              <tr><td colSpan={columns.length + 1} style={{ textAlign: 'center', padding: 24 }} className="gecko-cell-meta">Loading…</td></tr>
            )}
            {!loading && !error && visible.length === 0 && editing !== '' && (
              <tr><td colSpan={columns.length + 1}>
                <EmptyState icon="search" title={`No ${noun.toLowerCase()}s ${search ? 'match' : 'yet'}`}
                  description={search ? 'Try another code or word.' : canManage && blank ? `Add the first ${noun.toLowerCase()}.` : ''} />
              </td></tr>
            )}
            {visible.map(r => renderRow(r, false))}
          </tbody>
        </table>
      </div>

      {confirm && (
        <ConfirmDialog
          isOpen
          onClose={() => setConfirm(null)}
          onConfirm={() => remove(confirm)}
          variant="danger"
          title={`${deleteLabel?.(confirm) ?? 'Delete'} ${rowKey(confirm)}?`}
          message={deleteMessage?.(confirm) ?? `It disappears from this list; the history keeps every version. If something still uses it, the delete is refused — switch it to inactive instead.`}
          confirmLabel={deleteLabel?.(confirm) ?? 'Delete'}
        />
      )}
    </div>
  );
}
