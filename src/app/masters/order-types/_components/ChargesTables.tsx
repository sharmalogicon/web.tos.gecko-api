"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { CommercialVocabulary } from '@/lib/api/charge-codes';
import type { OrderTypeVocabulary } from '@/lib/api/order-types';
import { isPathAvailable } from '@/lib/edition';
import { ChargeDialog } from './ChargeDialog';
import { blankCharge, blankVas, chargeRowErrors, errorsForRow, type ChargeRow } from './charge-rows';

/**
 * The charges of an order type, read as two tables and edited in a dialog.
 *
 * Two tables because they answer different questions. A MOVEMENT charge is what
 * the depot bills for doing the job — lift on, lift off, the gate fee — and the
 * clerk reads it to check the job is priced. A VALUE-ADDED SERVICE is something
 * the customer may or may not ask for — washing, repair, a genset — and the clerk
 * reads it to see what the gate will offer as a tick. Mixed into one list, 'is
 * this a VAS?' was a badge in a Flags column you had to hunt for; split, it is
 * which table the row is in.
 *
 * Sortable because KORAKIT's order types carry upwards of twenty charges and the
 * API returns them in insertion order — which is the order somebody typed them in
 * years ago, and no help to anyone looking for one charge code.
 *
 * It is CONTROLLED: it never calls the API. The order type detail page answers
 * `onChange` with a whole-set PUT (the API has no per-charge endpoint, so every
 * add, edit and delete sends the full set); the new-order-type page answers it by
 * holding the rows until the order type exists to attach them to.
 */

type SortKey = 'chargeCode' | 'movementCode' | 'paymentTo' | 'paymentTermCode' | 'raised' | 'defaultQty';

interface Column {
  key: SortKey | null;
  label: string;
  title?: string;
  width?: number;
  align?: 'right' | 'center';
}

const RAISED_RANK: Record<ChargeRow['raised'], number> = { DEFAULT: 0, OPTIONAL: 1, MANUAL: 2 };

/** Blank sorts last on every column: 'every step' and 'the payer's own' are absences, not values. */
function compare(a: ChargeRow, b: ChargeRow, key: SortKey): number {
  if (key === 'raised') return RAISED_RANK[a.raised] - RAISED_RANK[b.raised];
  if (key === 'defaultQty') {
    const na = a.defaultQty.trim() === '' ? null : Number(a.defaultQty);
    const nb = b.defaultQty.trim() === '' ? null : Number(b.defaultQty);
    if (na === null || nb === null) return na === nb ? 0 : na === null ? 1 : -1;
    return na - nb;
  }
  const va = a[key];
  const vb = b[key];
  if (!va || !vb) return va === vb ? 0 : !va ? 1 : -1;
  return va.localeCompare(vb);
}

export function ChargesTables({
  rows, vocabulary, commercial, stepCodes, selectedStep, canManage, busy = false, errors, onChange,
}: {
  rows: ChargeRow[];
  vocabulary: OrderTypeVocabulary;
  commercial: CommercialVocabulary;
  /** The movement codes of this order type's steps, in order. */
  stepCodes: string[];
  /** When a step is picked, only its charges and the every-step ones are listed. */
  selectedStep: string | null;
  canManage: boolean;
  busy?: boolean;
  /** Whole-set errors keyed `charges[i]…`, as the parent validates them. */
  errors: Record<string, string>;
  /** The whole set after the change, and what to call what just happened. */
  onChange: (rows: ChargeRow[], done: string) => void;
}) {
  // An edit in flight: the row being edited (a copy lives inside the dialog) and
  // whether it is already on the order type.
  const [editing, setEditing] = useState<{ row: ChargeRow; isNew: boolean } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ChargeRow | null>(null);

  const movement = rows.filter(r => !r.isValueAddedService);
  const vas = rows.filter(r => r.isValueAddedService);

  const open = (row: ChargeRow, isNew: boolean) => { setProblem(null); setEditing({ row, isNew }); };

  /**
   * Saving one charge rebuilds the whole set, because that is what the API takes.
   * A duplicate is caught HERE and the dialog stays open on it: once the set has
   * gone to the API the answer is a 409 about a row number, which is no use to
   * someone who was editing one charge.
   */
  const commit = (edited: ChargeRow) => {
    const next = editing?.isNew
      ? [...rows, edited]
      : rows.map(r => (r.key === edited.key ? edited : r));
    const index = next.findIndex(r => r.key === edited.key);
    const mine = errorsForRow(chargeRowErrors(next, stepCodes), index);
    if (mine.length > 0) {
      setProblem(mine.join(' '));
      return;
    }
    setProblem(null);
    setEditing(null);
    onChange(next, editing?.isNew ? `${edited.chargeCode} added` : `${edited.chargeCode} saved`);
  };

  const remove = (row: ChargeRow) => {
    setRemoving(null);
    onChange(rows.filter(r => r.key !== row.key), `${row.chargeCode} removed`);
  };

  return (
    <div className="gecko-stack gecko-stack-md">
      {errors.charges && <div role="alert" className="gecko-field-error">{errors.charges}</div>}

      <ChargeTable
        title="Movement charges"
        hint="What the depot bills for doing the job."
        rows={movement}
        allRows={rows}
        empty="No movement charges — nothing is raised automatically for the moves of this order type."
        addLabel="Add charge"
        onAdd={() => open(blankCharge(), true)}
        {...{ vocabulary, commercial, selectedStep, canManage, busy, errors }}
        onEdit={row => open(row, false)}
        onRemove={setRemoving}
      />

      <ChargeTable
        title="VAS charges"
        hint="Offered to the customer — the gate shows these as a tick, not as a given."
        rows={vas}
        allRows={rows}
        empty="No value-added services — the gate will offer nothing beyond the movement charges."
        addLabel="Add VAS charge"
        onAdd={() => open(blankVas(), true)}
        {...{ vocabulary, commercial, selectedStep, canManage, busy, errors }}
        onEdit={row => open(row, false)}
        onRemove={setRemoving}
      />

      {editing && (
        <ChargeDialog
          key={editing.row.key}
          row={editing.row}
          isNew={editing.isNew}
          vocabulary={vocabulary}
          commercial={commercial}
          stepCodes={stepCodes}
          problem={problem}
          onSave={commit}
          onClose={() => { setEditing(null); setProblem(null); }}
        />
      )}

      <ConfirmDialog
        isOpen={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove(removing)}
        variant="danger"
        title={`Remove ${removing?.chargeCode ?? 'charge'}?`}
        message="This order type stops raising it. Charges already raised on existing bookings are untouched — they keep what they were given."
        confirmLabel="Remove charge"
      />
    </div>
  );
}

function ChargeTable({
  title, hint, rows, allRows, empty, addLabel, vocabulary, commercial, selectedStep,
  canManage, busy, errors, onAdd, onEdit, onRemove,
}: {
  title: string;
  hint: string;
  rows: ChargeRow[];
  /** The whole set, so a row's error index matches what the parent validated. */
  allRows: ChargeRow[];
  empty: string;
  addLabel: string;
  vocabulary: OrderTypeVocabulary;
  commercial: CommercialVocabulary;
  selectedStep: string | null;
  canManage: boolean;
  busy: boolean;
  errors: Record<string, string>;
  onAdd: () => void;
  onEdit: (row: ChargeRow) => void;
  onRemove: (row: ChargeRow) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'chargeCode', dir: 'asc' });

  const columns: Column[] = [
    { key: 'chargeCode', label: 'Charge' },
    { key: 'movementCode', label: 'Step', width: 150 },
    { key: 'paymentTo', label: 'Bill to', width: 120 },
    { key: 'paymentTermCode', label: 'Term', width: 100 },
    { key: 'raised', label: 'Raised', width: 110 },
    { key: null, label: 'Flags', width: 130 },
    { key: 'defaultQty', label: 'Qty', width: 60, align: 'right' },
  ];
  if (canManage) columns.push({ key: null, label: '', width: 76, align: 'right' });

  const shown = rows
    .filter(r => !selectedStep || r.movementCode === '' || r.movementCode === selectedStep)
    .slice()
    .sort((a, b) => (sort.dir === 'asc' ? compare(a, b, sort.key) : compare(b, a, sort.key)));

  const click = (key: SortKey) =>
    setSort(cur => ({ key, dir: cur.key === key && cur.dir === 'asc' ? 'desc' : 'asc' }));

  const nameOf = (code: string) => vocabulary.chargeCodes.find(c => c.code === code)?.name ?? '';
  const termName = (code: string) => (code ? commercial.paymentTerms.find(t => t.code === code)?.name ?? code : "the payer's own");

  return (
    <div className="gecko-stack-sm">
      <div className="gecko-row gecko-charge-table-head">
        <span className="gecko-charge-table-title">{title}</span>
        <span className="gecko-count-badge">{rows.length}</span>
        <span className="gecko-page-subtitle gecko-flex-1">— {hint}</span>
        {canManage && (
          <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onAdd} disabled={busy}>
            <Icon name="plus" size={14} /> {addLabel}
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="gecko-charge-table-empty">{empty}</div>
      ) : (
        <div className="gecko-table-card">
          <table className="gecko-table gecko-table-compact">
            <thead>
              <tr>
                {columns.map((c, i) => (
                  <th
                    key={c.label || `c${i}`}
                    title={c.title}
                    className={c.key ? 'gecko-th-sortable' : undefined}
                    style={{ width: c.width, textAlign: c.align }}
                    aria-sort={c.key && sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    onClick={c.key ? () => click(c.key as SortKey) : undefined}>
                    {c.label}
                    {c.key && (
                      <span className={`gecko-sort-icon${sort.key === c.key ? (sort.dir === 'asc' ? ' gecko-sort-asc' : ' gecko-sort-desc') : ''}`} />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map(r => {
                const messages = errorsForRow(errors, allRows.indexOf(r));
                return (
                  <React.Fragment key={r.key}>
                    <tr>
                      <td>
                        <div className="gecko-charge-code">
                          {r.chargeCode && isPathAvailable(`/masters/charge-codes/${r.chargeCode}`)
                            ? <Link href={`/masters/charge-codes/${encodeURIComponent(r.chargeCode)}`} className="gecko-id-link">{r.chargeCode}</Link>
                            : <span className="gecko-id-link gecko-charge-code-plain">{r.chargeCode || '—'}</span>}
                          <span className="gecko-cell-meta">{nameOf(r.chargeCode)}</span>
                        </div>
                      </td>
                      <td>
                        {r.movementCode
                          ? <span className="gecko-text-mono gecko-charge-step">{r.movementCode}</span>
                          : <span className="gecko-cell-meta">every step</span>}
                      </td>
                      <td><span className="gecko-badge gecko-badge-xs gecko-badge-gray">{r.paymentTo}</span></td>
                      <td className="gecko-page-subtitle">{termName(r.paymentTermCode)}</td>
                      <td>
                        {r.raised === 'DEFAULT'
                          ? <span className="gecko-badge gecko-badge-xs gecko-badge-success" title="Raised automatically">default</span>
                          : r.raised === 'OPTIONAL'
                            ? <span className="gecko-badge gecko-badge-xs gecko-badge-info" title="Offered to the clerk, not raised unless picked">optional</span>
                            : <span className="gecko-badge gecko-badge-xs gecko-badge-gray" title="Never offered; added by hand at invoicing">manual</span>}
                      </td>
                      <td>
                        <div className="gecko-row gecko-row-wrap gecko-charge-flag-badges">
                          {r.isCargoCharge && <span className="gecko-badge gecko-badge-xs gecko-badge-gray" title="Priced on the cargo, not the box">cargo</span>}
                          {r.raiseAtGateIn && <span className="gecko-badge gecko-badge-xs gecko-badge-info" title="Raised at the gate, not at invoicing">at gate</span>}
                          {!r.isCargoCharge && !r.raiseAtGateIn && <span className="gecko-cell-meta">—</span>}
                        </div>
                      </td>
                      <td className="gecko-num gecko-num-tabular">{r.defaultQty.trim() || '—'}</td>
                      {canManage && (
                        <td className="gecko-charge-actions">
                          <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon"
                            aria-label={`Edit ${r.chargeCode}`} title="Edit this charge"
                            disabled={busy} onClick={() => onEdit(r)}>
                            <Icon name="edit" size={14} />
                          </button>
                          <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon gecko-btn-icon-danger"
                            aria-label={`Remove ${r.chargeCode}`} title="Remove this charge"
                            disabled={busy} onClick={() => onRemove(r)}>
                            <Icon name="trash" size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                    {messages.length > 0 && (
                      <tr><td colSpan={columns.length} className="gecko-field-error">{r.chargeCode || 'This charge'}: {messages.join(' ')}</td></tr>
                    )}
                  </React.Fragment>
                );
              })}
              {shown.length === 0 && (
                <tr><td colSpan={columns.length} className="gecko-charge-table-empty">Nothing here on {selectedStep}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
