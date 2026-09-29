"use client";
import React from 'react';
import { Icon } from '@/components/ui/Icon';
import type { ApiError } from '@/lib/api/problem';
import type { ChargeVariant, CommercialVocabulary, SaveChargeVariant } from '@/lib/api/charge-codes';

/**
 * The billing matrix of one charge code: who pays (bill-to) × on what terms
 * (payment term), each row with its own tax, withholding tax, credit days and GL.
 * This is what Vector wrote into the code string (S-002 CA / S-002 CR); here it
 * is one charge with two rows.
 *
 * Saved as a whole (PUT …/variants replaces the set), so rows are edited
 * locally and sent together. Server errors come back per cell —
 * variants[1].taxCode — and are shown on that cell.
 */

export interface VariantRow {
  /** Local key only — rows have no identity until saved. */
  key: string;
  billTo: string;
  paymentTermCode: string;
  taxCode: string;
  withholdingTaxCode: string;
  creditTermDays: string;
  revenueGl: string;
  costGl: string;
  legacyChargeCode: string;
}

let nextKey = 0;
const newKey = () => `row-${++nextKey}`;

export const rowsFromVariants = (variants: ChargeVariant[]): VariantRow[] => variants.map(v => ({
  key: newKey(),
  billTo: v.billTo,
  paymentTermCode: v.paymentTermCode,
  taxCode: v.taxCode ?? '',
  withholdingTaxCode: v.withholdingTaxCode ?? '',
  creditTermDays: v.creditTermDays === null ? '' : String(v.creditTermDays),
  revenueGl: v.revenueGl ?? '',
  costGl: v.costGl ?? '',
  legacyChargeCode: v.legacyChargeCode ?? '',
}));

/** A new row: the depot's common case — the customer pays cash, with VAT when the tenant has a VAT7 code. */
export const blankRow = (vocabulary: CommercialVocabulary): VariantRow => ({
  key: newKey(),
  billTo: vocabulary.billToRoles.some(r => r.code === 'CUSTOMER') ? 'CUSTOMER' : '',
  paymentTermCode: vocabulary.paymentTerms.some(t => t.code === 'CASH') ? 'CASH' : '',
  taxCode: vocabulary.taxCodes.some(t => t.code === 'VAT7') ? 'VAT7' : '',
  withholdingTaxCode: '', creditTermDays: '', revenueGl: '', costGl: '', legacyChargeCode: '',
});

const orNull = (s: string) => (s.trim() ? s.trim() : null);

export const requestFromRows = (rows: VariantRow[]): SaveChargeVariant[] => rows.map(r => ({
  billTo: r.billTo,
  paymentTermCode: r.paymentTermCode,
  taxCode: orNull(r.taxCode),
  withholdingTaxCode: orNull(r.withholdingTaxCode),
  creditTermDays: r.creditTermDays.trim() ? Number(r.creditTermDays) : null,
  revenueGl: orNull(r.revenueGl),
  costGl: orNull(r.costGl),
  legacyChargeCode: orNull(r.legacyChargeCode),
}));

/** Keyed exactly as the API keys them (variants[i].x), so one lookup serves both. */
export function variantErrors(rows: VariantRow[]): Record<string, string> {
  const e: Record<string, string> = {};
  if (rows.length === 0) e.variants = 'Add at least one way this charge is billed.';
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    if (!r.billTo) e[`variants[${i}].billTo`] = 'Who pays?';
    if (!r.paymentTermCode) e[`variants[${i}].paymentTermCode`] = 'On what terms?';
    const pair = `${r.billTo}/${r.paymentTermCode}`;
    if (r.billTo && r.paymentTermCode && seen.has(pair)) e[`variants[${i}]`] = `${pair} is already a row above — one row per payer and term.`;
    seen.add(pair);
    const days = r.creditTermDays.trim();
    if (days && !(/^\d+$/.test(days) && Number(days) <= 365)) e[`variants[${i}].creditTermDays`] = '0 to 365 days.';
  });
  return e;
}

export function VariantsEditor({ rows, onChange, vocabulary, localErrors, apiError }: {
  rows: VariantRow[];
  onChange: (rows: VariantRow[]) => void;
  vocabulary: CommercialVocabulary;
  localErrors: Record<string, string>;
  apiError: ApiError | null;
}) {
  const err = (key: string) => localErrors[key] ?? apiError?.forField(key);
  const set = (i: number, patch: Partial<VariantRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const vat = vocabulary.taxCodes.filter(t => t.taxType !== 'WITHHOLDING');
  const wht = vocabulary.taxCodes.filter(t => t.taxType === 'WITHHOLDING');
  const cell = (i: number, column: string) => `variants[${i}].${column}`;
  const select = (i: number, column: keyof VariantRow, options: { code: string; name: string }[], placeholder: string) => (
    <select
      aria-label={`${column} row ${i + 1}`}
      className={`gecko-select gecko-input-sm${err(cell(i, column)) ? ' gecko-input-error' : ''}`}
      value={rows[i][column]}
      onChange={e => set(i, { [column]: e.target.value } as Partial<VariantRow>)}
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.code} value={o.code}>{o.code === o.name ? o.code : `${o.code} — ${o.name}`}</option>)}
    </select>
  );
  const text = (i: number, column: keyof VariantRow, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input
      aria-label={`${column} row ${i + 1}`}
      className={`gecko-input gecko-input-sm gecko-text-mono${err(cell(i, column)) ? ' gecko-input-error' : ''}`}
      value={rows[i][column]}
      onChange={e => set(i, { [column]: e.target.value } as Partial<VariantRow>)}
      {...props}
    />
  );

  return (
    <div className="gecko-stack gecko-stack-sm">
      {err('variants') && <div className="gecko-field-error">{err('variants')}</div>}
      <div className="gecko-table-card">
        <table className="gecko-table">
          <thead>
            <tr>
              <th>Bill to</th>
              <th>Payment term</th>
              <th>Tax</th>
              <th>Withholding tax</th>
              <th>Credit days</th>
              <th>Revenue GL</th>
              <th>Cost GL</th>
              <th>Legacy code</th>
              <th aria-label="Remove" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} className="gecko-cell-meta">No billing rows yet — add one below.</td></tr>
            )}
            {rows.map((r, i) => {
              const rowError = err(`variants[${i}]`);
              const cellErrors = ['billTo', 'paymentTermCode', 'taxCode', 'withholdingTaxCode', 'creditTermDays', 'revenueGl', 'costGl', 'legacyChargeCode']
                .map(c => err(cell(i, c))).filter(Boolean);
              return (
                <React.Fragment key={r.key}>
                  <tr>
                    <td>{select(i, 'billTo', vocabulary.billToRoles, 'Who pays…')}</td>
                    <td>{select(i, 'paymentTermCode', vocabulary.paymentTerms, 'Terms…')}</td>
                    <td>{select(i, 'taxCode', vat.map(t => ({ code: t.code, name: `${t.ratePct}%` })), 'No tax')}</td>
                    <td>{select(i, 'withholdingTaxCode', wht.map(t => ({ code: t.code, name: `${t.ratePct}%` })), 'None')}</td>
                    <td>{text(i, 'creditTermDays', { inputMode: 'numeric', maxLength: 3, placeholder: '—' })}</td>
                    <td>{text(i, 'revenueGl', { maxLength: 20 })}</td>
                    <td>{text(i, 'costGl', { maxLength: 20 })}</td>
                    <td>{text(i, 'legacyChargeCode', { maxLength: 20, placeholder: 'e.g. S-002 CA' })}</td>
                    <td>
                      <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm" aria-label={`Remove row ${i + 1}`}
                        onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                        <Icon name="trash" size={14} />
                      </button>
                    </td>
                  </tr>
                  {(rowError || cellErrors.length > 0) && (
                    <tr>
                      <td colSpan={9} className="gecko-field-error">
                        Row {i + 1}: {[rowError, ...cellErrors].filter(Boolean).join(' ')}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div>
        <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => onChange([...rows, blankRow(vocabulary)])}>
          <Icon name="plus" size={14} /> Add billing row
        </button>
      </div>
    </div>
  );
}
