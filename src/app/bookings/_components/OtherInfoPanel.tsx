"use client";
import React from 'react';
import { DateField } from '@/components/ui/DateField';
import { useCodeList } from '@/lib/api/lookups';

/**
 * Vector's "Other Information" panel.
 *
 * These are the SHIPPER'S DECLARED totals for the booking, which is why they are
 * typed and not added up from the container rows: what the customer declared and
 * what actually turned up are different numbers, and the difference is the thing
 * worth seeing. The boxes carry their own weight and volume separately.
 *
 * Six of these fields do not exist in the API yet
 * (docs/BOOKING_VECTOR_PARITY_FOR_API.md §3). They are rendered disabled rather
 * than hidden, so the screen is the finished shape today and lights up when the
 * API lands — nobody has to re-learn the page.
 */

export interface OtherInfo {
  totalQty: string;
  uomCode: string;
  totalVolumeCbm: string;
  totalWeightKg: string;
  commodityCode: string;
  marksAndNos: string;
  specialInstruction: string;
  remarks: string;
  cargoCategoryCode: string;
  validFrom: string;
  validTo: string;
}

/** Vector's UOM list, until the API says which code list to read. */
const UOMS = ['BAG', 'BALE', 'BOX', 'CARTON', 'CASE', 'DRUM', 'PALLET', 'PIECE', 'ROLL', 'UNIT'];

export function OtherInfoPanel({ value, onChange, fieldError, apiHasNewFields = false }: {
  value: OtherInfo;
  onChange: (patch: Partial<OtherInfo>) => void;
  fieldError: (f: string) => string | undefined;
  /** Flip on when the API carries the six declared-totals fields. */
  apiHasNewFields?: boolean;
}) {
  const cargo = useCodeList('CARGO_CATEGORY');
  const pending = apiHasNewFields ? undefined : 'Waiting on the API.';

  return (
    <div className="gecko-stack">
      <div className="gecko-eyebrow">Other information</div>

      <div className="gecko-newbk-grid">
        <Field label="Total qty" error={fieldError('totalQty')} hint={pending}>
          <input className="gecko-input" type="number" min={0} value={value.totalQty}
            disabled={!apiHasNewFields} onChange={e => onChange({ totalQty: e.target.value })} />
        </Field>
        <Field label="UOM" error={fieldError('uomCode')} hint={pending}>
          <select className="gecko-input" value={value.uomCode} disabled={!apiHasNewFields}
            onChange={e => onChange({ uomCode: e.target.value })}>
            <option value="">—</option>
            {UOMS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </Field>
        <Field label="Total volume m³" error={fieldError('totalVolumeCbm')} hint={pending}>
          <input className="gecko-input" type="number" min={0} step="0.01" value={value.totalVolumeCbm}
            disabled={!apiHasNewFields} onChange={e => onChange({ totalVolumeCbm: e.target.value })} />
        </Field>
        <Field label="Total weight kg" error={fieldError('totalWeightKg')} hint={pending}>
          <input className="gecko-input" type="number" min={0} value={value.totalWeightKg}
            disabled={!apiHasNewFields} onChange={e => onChange({ totalWeightKg: e.target.value })} />
        </Field>
      </div>

      <Field label="Commodity" error={fieldError('commodityCode')}>
        <input className="gecko-input gecko-text-mono" maxLength={30} value={value.commodityCode}
          onChange={e => onChange({ commodityCode: e.target.value.toUpperCase() })} />
      </Field>

      <Field label="Marks &amp; nos" error={fieldError('marksAndNos')} hint={pending}>
        <input className="gecko-input" maxLength={200} value={value.marksAndNos}
          disabled={!apiHasNewFields} onChange={e => onChange({ marksAndNos: e.target.value })} />
      </Field>

      <Field label="Special instruction" error={fieldError('specialInstruction')} hint={pending}>
        <textarea className="gecko-textarea gecko-input" rows={3} maxLength={1000} value={value.specialInstruction}
          disabled={!apiHasNewFields} onChange={e => onChange({ specialInstruction: e.target.value })} />
      </Field>

      <Field label="Remarks" error={fieldError('remarks')}>
        <textarea className="gecko-textarea gecko-input" rows={4} maxLength={1000} value={value.remarks}
          onChange={e => onChange({ remarks: e.target.value })} />
      </Field>

      {/* Not on Vector's panel, but the booking has them and the gate reads them. */}
      <div className="gecko-newbk-grid">
        <Field label="Cargo category" error={fieldError('cargoCategoryCode')}>
          <select className="gecko-input" value={value.cargoCategoryCode}
            onChange={e => onChange({ cargoCategoryCode: e.target.value })}>
            <option value="">Not stated</option>
            {cargo.values.map(c => <option key={c.code} value={c.code}>{c.code} - {c.descriptionEn}</option>)}
          </select>
        </Field>
        <Field label="Valid from" error={fieldError('validFrom')}>
          <DateField value={value.validFrom} onChange={v => onChange({ validFrom: v })}
            max={value.validTo || undefined} aria-label="Valid from" />
        </Field>
        <Field label="Valid to" error={fieldError('validTo')} hint="After this date the gate refuses the move.">
          <DateField value={value.validTo} onChange={v => onChange({ validTo: v })}
            min={value.validFrom || undefined} aria-label="Valid to" />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, error, hint, children }: {
  label: string; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="gecko-field-label gecko-mb-1">{label}</div>
      {children}
      {hint && !error && <div className="gecko-cell-meta">{hint}</div>}
      {error && <div className="gecko-field-error">{error}</div>}
    </div>
  );
}
