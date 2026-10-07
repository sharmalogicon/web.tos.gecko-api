"use client";
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import type { CommercialVocabulary } from '@/lib/api/charge-codes';
import type { OrderTypeVocabulary } from '@/lib/api/order-types';
import { type ChargeRow, type Raised } from './charge-rows';

/**
 * ONE charge on an order type, edited in a dialog.
 *
 * It was a row in a table of inputs where every charge was edited at once: ten
 * controls per line, so "Bill to" and "Payment term" were two dropdowns about
 * forty pixels wide, and the thing a clerk actually comes to do — add washing,
 * or stop raising the gate fee automatically — was buried among the nine fields
 * they did not come for. The tariff's rates moved to a dialog for the same
 * reason; this follows it, down to the sectioning.
 *
 * It edits a COPY, so Cancel leaves the set exactly as it was. That matters here
 * more than on the tariff: saving writes the WHOLE charge set back, so a
 * half-made edit left behind in a live-bound row would go to the API with it.
 */

const RAISED: { value: Raised; label: string; hint: string }[] = [
  { value: 'DEFAULT', label: 'Automatically', hint: 'Raised on every move of this step.' },
  { value: 'OPTIONAL', label: 'Offered to the clerk', hint: 'Shown at the gate as a tick, raised only if ticked.' },
  { value: 'MANUAL', label: 'Only if added by hand', hint: 'Never offered; someone adds it to the invoice.' },
];

export function ChargeDialog({ row, isNew, vocabulary, commercial, stepCodes, problem, onSave, onClose }: {
  /** Null keeps the dialog closed. The caller passes key={row.key} so a different charge remounts it. */
  row: ChargeRow | null;
  isNew: boolean;
  vocabulary: OrderTypeVocabulary;
  commercial: CommercialVocabulary;
  /** The movement codes of this order type's steps, in order. */
  stepCodes: string[];
  /** What was wrong when Save was last pressed — a duplicate, usually. */
  problem: string | null;
  onSave: (row: ChargeRow) => void;
  onClose: () => void;
}) {
  const [d, setD] = useState<ChargeRow>(row ?? ({} as ChargeRow));

  if (!row) return null;

  const set = (p: Partial<ChargeRow>) => setD(cur => ({ ...cur, ...p }));

  // A charge already on the order type may use a code deactivated since. Keep it
  // selectable, or opening the dialog on that row and saving would change it.
  const codes = !d.chargeCode || vocabulary.chargeCodes.some(c => c.code === d.chargeCode)
    ? vocabulary.chargeCodes
    : [{ code: d.chargeCode, name: 'no longer active', moduleCode: '' }, ...vocabulary.chargeCodes];
  const picked = vocabulary.chargeCodes.find(c => c.code === d.chargeCode);

  const qty = d.defaultQty.trim();
  const qtyBad = qty !== '' && !(Number(qty) > 0);
  const canSave = d.chargeCode.trim() !== '' && d.paymentTo.trim() !== '' && !qtyBad;

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      closeOnBackdrop={false}
      title={d.chargeCode ? `${d.chargeCode}${picked ? ` — ${picked.name}` : ''}` : isNew ? 'Add a charge' : 'Charge'}
      subtitle="The price comes from the tariff. This says who pays it, on which step, and whether the gate raises it by itself."
      footer={
        <>
          <span className="gecko-modal-footer-note gecko-flex-1">
            {d.chargeCode.trim() === '' ? 'Pick a charge code.' : qtyBad ? 'A positive quantity, or leave it blank.' : ''}
          </span>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose}>Cancel</button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={!canSave} onClick={() => onSave(d)}>
            <Icon name="check" size={14} /> {isNew ? 'Add charge' : 'Save charge'}
          </button>
        </>
      }
    >
      <div className="gecko-stack">
        {problem && <div role="alert" className="gecko-alert gecko-alert-error">{problem}</div>}

        {/* 1 — what is charged, and where in the order type it lands */}
        <section className="gecko-stack-sm">
          <div className="gecko-field-label">What is charged</div>
          <div className="gecko-grid-2">
            <Field label="Charge code" required>
              <select className="gecko-input" value={d.chargeCode} onChange={e => set({ chargeCode: e.target.value })}>
                <option value="">Choose…</option>
                {codes.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
              </select>
            </Field>
            <Field label="On which step" hint="Left on every step it is raised at each one.">
              <select className="gecko-input" value={d.movementCode} onChange={e => set({ movementCode: e.target.value })}>
                <option value="">Every step</option>
                {stepCodes.map((code, n) => <option key={code} value={code}>{n + 1}. {code}</option>)}
                {d.movementCode && !stepCodes.includes(d.movementCode) && (
                  <option value={d.movementCode}>{d.movementCode} (not a step of this order type)</option>
                )}
              </select>
            </Field>
          </div>
        </section>

        {/* 2 — who pays */}
        <section className="gecko-stack-sm">
          <div className="gecko-field-label">Who pays</div>
          <div className="gecko-grid-2">
            <Field label="Bill to" required>
              <select className="gecko-input" value={d.paymentTo} onChange={e => set({ paymentTo: e.target.value })}>
                <option value="">Who pays…</option>
                {commercial.billToRoles.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="Payment term" hint="Left blank it follows the payer's own term.">
              <select className="gecko-input" value={d.paymentTermCode} onChange={e => set({ paymentTermCode: e.target.value })}>
                <option value="">The payer&apos;s own</option>
                {commercial.paymentTerms.map(t => <option key={t.code} value={t.code}>{t.name}</option>)}
              </select>
            </Field>
          </div>
        </section>

        {/* 3 — when it is raised, and the three flags that change where it shows up */}
        <section className="gecko-stack-sm">
          <div className="gecko-field-label">When it is raised</div>
          <div className="gecko-grid-2">
            <Field label="Raised" hint={RAISED.find(o => o.value === d.raised)?.hint}>
              <select className="gecko-input" value={d.raised} onChange={e => set({ raised: e.target.value as Raised })}>
                {RAISED.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Default quantity" hint="Blank means the clerk keys it." error={qtyBad ? 'A positive quantity, or blank.' : undefined}>
              <input className={`gecko-input${qtyBad ? ' gecko-input-error' : ''}`} inputMode="decimal" placeholder="—"
                value={d.defaultQty} onChange={e => set({ defaultQty: e.target.value })} />
            </Field>
          </div>

          <div className="gecko-charge-flags">
            <Flag label="Priced on the cargo, not the box" checked={d.isCargoCharge}
              hint="Billed per tonne or per CBM of what is inside."
              onChange={v => set({ isCargoCharge: v })} />
            <Flag label="A value-added service" checked={d.isValueAddedService}
              hint="Listed under VAS, and offered as a tick at the gate rather than assumed."
              onChange={v => set({ isValueAddedService: v })} />
            <Flag label="Raised at the gate, not at invoicing" checked={d.raiseAtGateIn}
              hint="The clerk takes it at the window while the truck is there."
              onChange={v => set({ raiseAtGateIn: v })} />
          </div>
        </section>
      </div>
    </Modal>
  );
}

function Field({ label, required, hint, error, children }: {
  label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="gecko-form-group">
      <label className={`gecko-form-label${required ? ' gecko-form-label-required' : ''}`}>{label}</label>
      {children}
      {error ? <div className="gecko-field-error">{error}</div> : hint && <div className="gecko-helper-text">{hint}</div>}
    </div>
  );
}

function Flag({ label, hint, checked, onChange }: {
  label: string; hint: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="gecko-charge-flag">
      <input type="checkbox" className="gecko-checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span>
        <span className="gecko-charge-flag-label">{label}</span>
        <span className="gecko-charge-flag-hint">{hint}</span>
      </span>
    </label>
  );
}
