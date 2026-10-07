"use client";
import React from 'react';
import { Icon } from '@/components/ui/Icon';
import type { ApiError } from '@/lib/api/problem';
import type { CommercialVocabulary } from '@/lib/api/charge-codes';
import type { OrderTypeCharge, OrderTypeVocabulary, SaveOrderTypeCharge } from '@/lib/api/order-types';

/**
 * The charges an order type raises: which charge code, on which step (or every
 * step), billed to whom, on what term, and whether it is raised automatically,
 * offered to the clerk, or neither. The price is not here — it is the tariff's.
 *
 * A charge can only be pinned to one of THIS order type's steps (the API refuses
 * any other movement: it would never be raised), so the step list is the steps.
 */

export type Raised = 'DEFAULT' | 'OPTIONAL' | 'MANUAL';

export interface ChargeRow {
  key: string;
  chargeCode: string;
  movementCode: string;   // '' = every step
  paymentTo: string;
  paymentTermCode: string; // '' = the payer's own default term
  raised: Raised;
  isCargoCharge: boolean;
  isValueAddedService: boolean;
  raiseAtGateIn: boolean;
  defaultQty: string;
}

let nextKey = 0;
const newKey = () => `charge-${++nextKey}`;

export const rowsFromCharges = (charges: OrderTypeCharge[]): ChargeRow[] => charges.map(c => ({
  key: newKey(),
  chargeCode: c.chargeCode,
  movementCode: c.movementCode ?? '',
  paymentTo: c.paymentTo,
  paymentTermCode: c.paymentTermCode ?? '',
  raised: c.isDefault ? 'DEFAULT' : c.isOptional ? 'OPTIONAL' : 'MANUAL',
  isCargoCharge: c.isCargoCharge,
  isValueAddedService: c.isValueAddedService,
  raiseAtGateIn: c.raiseAtGateIn,
  defaultQty: c.defaultQty === null ? '' : String(c.defaultQty),
}));

export const blankCharge = (): ChargeRow => ({
  key: newKey(), chargeCode: '', movementCode: '', paymentTo: 'CUSTOMER', paymentTermCode: '', raised: 'DEFAULT',
  isCargoCharge: false, isValueAddedService: false, raiseAtGateIn: false, defaultQty: '',
});

export const requestFromCharges = (rows: ChargeRow[]): SaveOrderTypeCharge[] => rows.map(r => ({
  chargeCode: r.chargeCode,
  paymentTo: r.paymentTo,
  movementCode: r.movementCode || null,
  paymentTermCode: r.paymentTermCode || null,
  isDefault: r.raised === 'DEFAULT',
  isOptional: r.raised === 'OPTIONAL',
  isCargoCharge: r.isCargoCharge,
  isValueAddedService: r.isValueAddedService,
  raiseAtGateIn: r.raiseAtGateIn,
  defaultQty: r.defaultQty.trim() ? Number(r.defaultQty) : null,
}));

export function chargeRowErrors(rows: ChargeRow[], stepCodes: string[]): Record<string, string> {
  const e: Record<string, string> = {};
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    if (!r.chargeCode) e[`charges[${i}].chargeCode`] = 'Pick a charge code.';
    if (!r.paymentTo) e[`charges[${i}].paymentTo`] = 'Who pays?';
    if (r.movementCode && !stepCodes.includes(r.movementCode))
      e[`charges[${i}].movementCode`] = `${r.movementCode} is no longer a step of this order type.`;
    const qty = r.defaultQty.trim();
    if (qty && !(Number(qty) > 0)) e[`charges[${i}].defaultQty`] = 'A positive quantity, or blank.';
    const key = `${r.chargeCode}|${r.movementCode}|${r.paymentTo}`;
    if (r.chargeCode && seen.has(key)) e[`charges[${i}]`] = 'The same charge, step and payer is already a row above.';
    seen.add(key);
  });
  return e;
}

const RAISED: { value: Raised; label: string }[] = [
  { value: 'DEFAULT', label: 'Automatically' },
  { value: 'OPTIONAL', label: 'Offered to the clerk' },
  { value: 'MANUAL', label: 'Only if added' },
];

export function ChargesEditor({ rows, onChange, stepCodes, vocabulary, commercial, localErrors, apiError }: {
  rows: ChargeRow[];
  onChange: (rows: ChargeRow[]) => void;
  /** The movement codes of this order type's steps, in order. */
  stepCodes: string[];
  vocabulary: OrderTypeVocabulary;
  commercial: CommercialVocabulary;
  localErrors: Record<string, string>;
  apiError: ApiError | null;
}) {
  const err = (key: string) => localErrors[key] ?? apiError?.forField(key);
  const set = (i: number, patch: Partial<ChargeRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const cls = (key: string, base = 'gecko-select gecko-input-sm') => `${base}${err(key) ? ' gecko-input-error' : ''}`;
  // A charge already on the order type may use a code that has since been deactivated: keep it selectable.
  const chargeOptions = (current: string) =>
    vocabulary.chargeCodes.some(c => c.code === current) || !current
      ? vocabulary.chargeCodes
      : [{ code: current, name: 'inactive', moduleCode: '' }, ...vocabulary.chargeCodes];
  const COLUMNS = 10;

  return (
    <div className="gecko-stack gecko-stack-sm">
      {err('charges') && <div className="gecko-field-error">{err('charges')}</div>}
      <div className="gecko-table-card">
        <table className="gecko-table">
          <thead>
            <tr>
              <th>Charge</th>
              <th>Step</th>
              <th>Bill to</th>
              <th>Payment term</th>
              <th>Raised</th>
              <th title="Priced on the cargo, not the box">Cargo</th>
              <th title="A value-added service">VAS</th>
              <th title="Raised when the box gates in, not at invoicing">At gate-in</th>
              <th>Qty</th>
              <th aria-label="Remove" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={COLUMNS} className="gecko-cell-meta">No charges — nothing is raised automatically for this order type.</td></tr>}
            {rows.map((r, i) => {
              const messages = ['', '.chargeCode', '.movementCode', '.paymentTo', '.paymentTermCode', '.defaultQty']
                .map(c => err(`charges[${i}]${c}`)).filter(Boolean);
              const flag = (key: 'isCargoCharge' | 'isValueAddedService' | 'raiseAtGateIn', label: string) => (
                <input type="checkbox" className="gecko-checkbox" aria-label={`${label}, charge ${i + 1}`}
                  checked={r[key]} onChange={e => set(i, { [key]: e.target.checked })} />
              );
              return (
                <React.Fragment key={r.key}>
                  <tr>
                    <td>
                      <select aria-label={`Charge code, row ${i + 1}`} className={cls(`charges[${i}].chargeCode`)}
                        value={r.chargeCode} onChange={e => set(i, { chargeCode: e.target.value })}>
                        <option value="">Choose…</option>
                        {chargeOptions(r.chargeCode).map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <select aria-label={`Step, row ${i + 1}`} className={cls(`charges[${i}].movementCode`)}
                        value={r.movementCode} onChange={e => set(i, { movementCode: e.target.value })}>
                        <option value="">Every step</option>
                        {stepCodes.map((code, n) => <option key={code} value={code}>{n + 1}. {code}</option>)}
                        {r.movementCode && !stepCodes.includes(r.movementCode) && <option value={r.movementCode}>{r.movementCode} (not a step)</option>}
                      </select>
                    </td>
                    <td>
                      <select aria-label={`Bill to, row ${i + 1}`} className={cls(`charges[${i}].paymentTo`)}
                        value={r.paymentTo} onChange={e => set(i, { paymentTo: e.target.value })}>
                        <option value="">Who pays…</option>
                        {commercial.billToRoles.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <select aria-label={`Payment term, row ${i + 1}`} className={cls(`charges[${i}].paymentTermCode`)}
                        value={r.paymentTermCode} onChange={e => set(i, { paymentTermCode: e.target.value })}>
                        <option value="">Payer&apos;s default</option>
                        {commercial.paymentTerms.map(t => <option key={t.code} value={t.code}>{t.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <select aria-label={`Raised, row ${i + 1}`} className={cls(`charges[${i}]`)}
                        value={r.raised} onChange={e => set(i, { raised: e.target.value as Raised })}>
                        {RAISED.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td>{flag('isCargoCharge', 'Cargo charge')}</td>
                    <td>{flag('isValueAddedService', 'Value-added service')}</td>
                    <td>{flag('raiseAtGateIn', 'Raise at gate-in')}</td>
                    <td>
                      <input aria-label={`Default quantity, row ${i + 1}`} className={cls(`charges[${i}].defaultQty`, 'gecko-input gecko-input-sm')}
                        inputMode="decimal" value={r.defaultQty} placeholder="—" onChange={e => set(i, { defaultQty: e.target.value })} />
                    </td>
                    <td>
                      <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm" aria-label={`Remove charge ${i + 1}`}
                        onClick={() => onChange(rows.filter((_, j) => j !== i))}><Icon name="trash" size={14} /></button>
                    </td>
                  </tr>
                  {messages.length > 0 && <tr><td colSpan={COLUMNS} className="gecko-field-error">Row {i + 1}: {messages.join(' ')}</td></tr>}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div>
        <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => onChange([...rows, blankCharge()])}>
          <Icon name="plus" size={14} /> Add charge
        </button>
      </div>
    </div>
  );
}
