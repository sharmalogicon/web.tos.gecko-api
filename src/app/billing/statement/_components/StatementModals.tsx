"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import type { ChargeCode, CommercialVocabulary } from '@/lib/api/charge-codes';
import { amount, type StatementRow } from '@/lib/api/charges';
import {
  addManualCharge, applyChargeToAll, DISCOUNT_LABEL, regenerateStatement, sellingRate,
  waiveCharges, WAIVE_REASON_LABEL, WAIVE_REASONS,
  type DiscountType, type WaiveReasonCode,
} from '@/lib/api/statement-writes';
import { sendToInvoice, type InvoiceTerm } from '@/lib/api/invoices';
import { apiProblem } from './problem';

/**
 * The four things Vector's cost sheet does to MANY lines at once, plus sending
 * them to an invoice: Manual Charge, Add/Update Charges To All Items,
 * Regenerate Cost Sheet, Waive Charges To Selected Items, Send To.
 *
 * Every one of them needs an endpoint that does not exist yet. They are built
 * against the agreed contracts so the day the API lands nothing here changes,
 * and until then each says exactly what is missing rather than failing blankly.
 */

interface Box { bookingContainerId: string; containerNo: string | null; equipmentTypeCode: string | null }

/** The boxes on the booking, from the lines themselves — one row each, in order. */
export function boxesOf(rows: StatementRow[]): Box[] {
  const seen = new Map<string, Box>();
  for (const r of rows) {
    if (!r.bookingContainerId || seen.has(r.bookingContainerId)) continue;
    seen.set(r.bookingContainerId, {
      bookingContainerId: r.bookingContainerId,
      containerNo: r.containerNo,
      equipmentTypeCode: r.equipmentTypeCode,
    });
  }
  return [...seen.values()];
}

// ── manual / bulk charge ─────────────────────────────────────────────────────

export function ChargeAddModal({ mode, orderNo, rows, chargeCodes, commercial, movements, onClose, onDone }: {
  /** 'manual' adds to the boxes ticked here; 'ADD' / 'UPDATE' apply to every box. */
  mode: 'manual' | 'ADD' | 'UPDATE';
  orderNo: string;
  rows: StatementRow[];
  chargeCodes: ChargeCode[];
  commercial: CommercialVocabulary | null;
  movements: string[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const boxes = boxesOf(rows);
  const [chargeCode, setChargeCode] = useState('');
  const [movementCode, setMovementCode] = useState('');
  const [billTo, setBillTo] = useState('CUSTOMER');
  const [term, setTerm] = useState('CASH');
  const [quantity, setQuantity] = useState('1');
  const [originalRate, setOriginalRate] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('NONE');
  const [discountRate, setDiscountRate] = useState('0');
  const [remarks, setRemarks] = useState('');
  const [picked, setPicked] = useState<Set<string>>(() => new Set(boxes.map(b => b.bookingContainerId)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);

  const bulk = mode !== 'manual';
  const rate = Number(originalRate);
  const qty = Number(quantity);
  const selling = sellingRate(rate, discountType, Number(discountRate));

  // A line with no box is the BOOKING's own, and the API takes those on credit
  // only — a cash line has to be collectable at the window with a box's move.
  const bookingLevel = !bulk && picked.size === 0;
  const termBad = bookingLevel && term === 'CASH';
  // The API requires a movement on a box line: a charge with no move is not
  // raised by anything, so nothing would ever collect it.
  const movementNeeded = !bookingLevel && movementCode === '';

  const ready = chargeCode !== '' && originalRate.trim() !== '' && Number.isFinite(rate) && rate >= 0
    && Number.isFinite(qty) && qty > 0 && remarks.trim().length >= 3 && !termBad && !movementNeeded;
  const targets = bulk ? boxes.length : (picked.size || 1);

  async function save() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    const body = {
      orderNo,
      bookingContainerIds: bulk ? [] : [...picked],
      chargeCode,
      movementCode: movementCode || null,
      billTo,
      paymentTermCode: term,
      quantity: qty,
      originalRate: rate,
      discountType,
      discountRate: discountType === 'NONE' ? 0 : Number(discountRate),
      remarks: remarks.trim(),
    };
    try {
      if (bulk) {
        const r = await applyChargeToAll({ ...body, mode });
        onDone(`${chargeCode}: ${r.added} added, ${r.updated} updated, ${r.skipped} skipped`);
      } else {
        const made = await addManualCharge(body);
        onDone(`${chargeCode} added to ${made.length} box${made.length === 1 ? '' : 'es'}`);
      }
      onClose();
    } catch (e) {
      setError(apiProblem(e, bulk ? 'bulk' : 'manual'));
    } finally {
      setBusy(false);
    }
  }

  const title = mode === 'manual' ? 'Add a charge by hand'
    : mode === 'ADD' ? 'Add this charge to every box' : 'Update this charge on every box';

  return (
    <Modal isOpen onClose={onClose} size="lg" closeOnBackdrop={false} title={title}
      subtitle={mode === 'UPDATE'
        ? 'Boxes that already carry the charge are repriced. Boxes that do not are left alone.'
        : mode === 'ADD'
          ? 'Boxes that already carry the charge are skipped, so running it twice changes nothing.'
          : 'Pick the boxes it applies to. One charge line is created per box.'}
      footer={
        <>
          <span className="gecko-modal-footer-note gecko-flex-1">
            {!chargeCode ? 'Pick a charge code.'
              : movementNeeded ? 'A charge on a box needs a movement — nothing would raise it otherwise.'
                : termBad ? "A charge with no box goes on an invoice, so it must be on credit."
                  : remarks.trim().length < 3 ? 'Say why it is being added — it is kept as the reason.'
                    : !ready ? 'A positive quantity and a rate are needed.'
                      : bookingLevel ? `the booking · ${amount(selling * qty)} before VAT`
                        : `${targets} box${targets === 1 ? '' : 'es'} · ${amount(selling * qty * targets)} before VAT`}
          </span>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={!ready || busy} onClick={save}>
            <Icon name="check" size={13} /> {busy ? 'Saving…' : mode === 'UPDATE' ? 'Update them' : 'Add it'}
          </button>
        </>
      }>
      <div className="gecko-stack">
        {error && <Problem p={error} />}

        <div className="gecko-grid-3">
          <Field label="Charge code" required>
            <select className="gecko-input" value={chargeCode} onChange={e => setChargeCode(e.target.value)}>
              <option value="">Choose…</option>
              {chargeCodes.map(c => <option key={c.chargeCode} value={c.chargeCode}>{c.chargeCode} — {c.descriptionEn}</option>)}
            </select>
          </Field>
          <Field label="Movement" required={!bookingLevel}>
            <select className={`gecko-input${movementNeeded ? ' gecko-input-error' : ''}`}
              value={movementCode} onChange={e => setMovementCode(e.target.value)}>
              <option value="">{bookingLevel ? 'No movement' : 'Choose…'}</option>
              {movements.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Quantity" required>
            <input className="gecko-input" type="number" min={0} step="0.001" value={quantity} onChange={e => setQuantity(e.target.value)} />
          </Field>
        </div>

        <div className="gecko-grid-3">
          <Field label="Bill to" required>
            <select className="gecko-input" value={billTo} onChange={e => setBillTo(e.target.value)}>
              {(commercial?.billToRoles ?? [{ code: 'CUSTOMER', name: 'Customer', nameLocal: null }])
                .map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Payment term" required>
            <select className={`gecko-input${termBad ? ' gecko-input-error' : ''}`}
              value={term} onChange={e => setTerm(e.target.value)}>
              {(commercial?.paymentTerms ?? [{ code: 'CASH', name: 'Cash', nameLocal: null }])
                .map(t => <option key={t.code} value={t.code}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Original rate" required>
            <input className="gecko-input" type="number" min={0} step="0.01" value={originalRate}
              placeholder="0.00" onChange={e => setOriginalRate(e.target.value)} />
          </Field>
        </div>

        <div className="gecko-grid-3">
          <Field label="Discount type">
            <select className="gecko-input" value={discountType} onChange={e => setDiscountType(e.target.value as DiscountType)}>
              {(['NONE', 'AMT', 'PCT'] as const).map(t => <option key={t} value={t}>{DISCOUNT_LABEL[t]}</option>)}
            </select>
          </Field>
          <Field label={discountType === 'PCT' ? 'Discount %' : 'Discount amount'}>
            <input className="gecko-input" type="number" min={0} step="0.01" disabled={discountType === 'NONE'}
              value={discountType === 'NONE' ? '' : discountRate} onChange={e => setDiscountRate(e.target.value)} />
          </Field>
          <Field label="Selling rate">
            <input className="gecko-input" value={amount(selling)} readOnly />
          </Field>
        </div>

        {!bulk && boxes.length > 0 && (
          <div className="gecko-form-group">
            <label className="gecko-form-label">Boxes ({picked.size} of {boxes.length})</label>
            <div className="gecko-box-picker">
              {boxes.map(b => (
                <label key={b.bookingContainerId} className="gecko-box-pick">
                  <input type="checkbox" className="gecko-checkbox" checked={picked.has(b.bookingContainerId)}
                    onChange={() => setPicked(prev => {
                      const next = new Set(prev);
                      if (next.has(b.bookingContainerId)) next.delete(b.bookingContainerId);
                      else next.add(b.bookingContainerId);
                      return next;
                    })} />
                  <span className="gecko-mono">{b.containerNo ?? 'not yet named'}</span>
                  {b.equipmentTypeCode && <span className="gecko-cell-meta">{b.equipmentTypeCode}</span>}
                </label>
              ))}
            </div>
          </div>
        )}

        <Field label="Remarks" required>
          <textarea className="gecko-input gecko-textarea" rows={2} maxLength={300} value={remarks}
            onChange={e => setRemarks(e.target.value)} placeholder="Why this charge is being added" />
          <div className="gecko-helper-text">
            Required — it is the reason the charge exists, and it is what someone reads when they query it.
            {bookingLevel && ' With no box ticked this is one line on the booking itself, billed on an invoice.'}
          </div>
        </Field>
      </div>
    </Modal>
  );
}

// ── waive the ticked lines ───────────────────────────────────────────────────

export function WaiveSelectedModal({ selected, currency, onClose, onDone }: {
  selected: StatementRow[];
  currency: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [reasonCode, setReasonCode] = useState<WaiveReasonCode>('GOODWILL');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);

  const total = selected.reduce((n, r) => n + r.charge.total, 0);
  const ready = reason.trim().length >= 3;

  async function save() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const r = await waiveCharges(selected.map(s => s.charge.chargeId), { reasonCode, reason: reason.trim() });
      onDone(`${r.waived} charge${r.waived === 1 ? '' : 's'} waived · ${amount(total, currency)}`);
      onClose();
    } catch (e) {
      setError(apiProblem(e, 'waive'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} size="md" closeOnBackdrop={false}
      title={`Waive ${selected.length} charge${selected.length === 1 ? '' : 's'}`}
      subtitle={`${amount(total, currency)} is forgiven. The lines stay on the statement, marked waived.`}
      footer={
        <>
          <span className="gecko-modal-footer-note gecko-flex-1">{ready ? '' : 'A note is kept on every line.'}</span>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="gecko-btn gecko-btn-warning gecko-btn-sm" disabled={!ready || busy} onClick={save}>
            <Icon name="fileX" size={13} /> {busy ? 'Waiving…' : 'Waive them'}
          </button>
        </>
      }>
      <div className="gecko-stack">
        {error && <Problem p={error} />}
        <div className="gecko-waive-list">
          {selected.slice(0, 8).map(r => (
            <div key={r.charge.chargeId} className="gecko-waive-line">
              <span className="gecko-mono-strong">{r.charge.chargeCode}</span>
              <span className="gecko-cell-meta gecko-flex-1">{r.containerNo ?? 'no box'} · {r.charge.movementCode ?? '—'}</span>
              <span className="gecko-mono">{amount(r.charge.total, r.charge.currencyCode)}</span>
            </div>
          ))}
          {selected.length > 8 && <div className="gecko-cell-meta">…and {selected.length - 8} more</div>}
        </div>
        <Field label="Reason code" required>
          <select className="gecko-input" value={reasonCode} onChange={e => setReasonCode(e.target.value as WaiveReasonCode)}>
            {WAIVE_REASONS.map(r => <option key={r} value={r}>{WAIVE_REASON_LABEL[r]}</option>)}
          </select>
        </Field>
        <Field label="Note" required>
          <textarea className="gecko-input gecko-textarea" rows={3} maxLength={500} value={reason}
            onChange={e => setReason(e.target.value)} placeholder="Agreed with the customer on 7 October" />
        </Field>
      </div>
    </Modal>
  );
}

// ── regenerate ───────────────────────────────────────────────────────────────

export function RegenerateModal({ orderNo, rows, onClose, onDone }: {
  orderNo: string;
  rows: StatementRow[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [keepLocked, setKeepLocked] = useState(true);
  const [keepManual, setKeepManual] = useState(true);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);

  const quoted = rows.filter(r => r.charge.status === 'QUOTED');
  const locked = quoted.filter(r => r.charge.isLocked).length;
  const manual = quoted.filter(r => r.charge.source === 'MANUAL').length;
  const settled = rows.length - quoted.length;
  const ready = reason.trim().length >= 3;

  async function go() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const r = await regenerateStatement({ orderNo, keepLocked, keepManual, reason: reason.trim() });
      onDone(`${r.repriced} repriced, ${r.added} added, ${r.removed} removed, ${r.keptLocked} left locked`);
      onClose();
    } catch (e) {
      setError(apiProblem(e, 'regenerate'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} size="md" closeOnBackdrop={false} title="Regenerate the cost sheet"
      subtitle="Every quoted line is priced again from the tariff in force today."
      footer={
        <>
          <span className="gecko-modal-footer-note gecko-flex-1">{ready ? '' : 'Say why it is being regenerated.'}</span>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={!ready || busy} onClick={go}>
            <Icon name="refreshCcw" size={13} /> {busy ? 'Working…' : 'Regenerate'}
          </button>
        </>
      }>
      <div className="gecko-stack">
        {error && <Problem p={error} />}
        <div className="gecko-alert gecko-alert-warning">
          <Icon name="alertCircle" size={16} />
          <span>
            {quoted.length} quoted line{quoted.length === 1 ? '' : 's'} will be repriced.
            {settled > 0 && <> {settled} already paid, invoiced or waived — those are never touched.</>}
          </span>
        </div>
        <Check checked={keepLocked} onChange={setKeepLocked}
          label={`Keep locked rates (${locked})`}
          hint="A rate a supervisor pinned stays as it is. Turn this off and every correction on this booking is undone." />
        <Check checked={keepManual} onChange={setKeepManual}
          label={`Keep charges added by hand (${manual})`}
          hint="Manual lines have no tariff behind them, so regenerating would simply delete them." />
        <Field label="Reason" required>
          <textarea className="gecko-input gecko-textarea" rows={3} maxLength={500} value={reason}
            onChange={e => setReason(e.target.value)} placeholder="New tariff approved, booking priced on the old one" />
        </Field>
      </div>
    </Modal>
  );
}

// ── send to invoice ──────────────────────────────────────────────────────────

/**
 * The only facts this modal needs about a charge.
 *
 * It is fed from two screens with two row shapes — the Booking Statement's
 * `StatementRow` and Unbilled Charges' `UnbilledLine` — and neither should have
 * to become the other to raise an invoice.
 */
export interface InvoiceCandidate {
  chargeId: string;
  paymentTermCode: string;
  /** QUOTED or UNBILLED can still be invoiced. Absent means the list is already filtered. */
  status?: string;
  total: number;
  payerCode: string | null;
  payerName: string | null;
  /** Shown in the preview list, so a clerk can see what is going on the invoice. */
  chargeCode: string;
  containerNo: string | null;
  currencyCode?: string | null;
}

export const candidateOf = (r: StatementRow): InvoiceCandidate => ({
  chargeId: r.charge.chargeId,
  paymentTermCode: r.charge.paymentTermCode,
  status: r.charge.status,
  total: r.charge.total,
  payerCode: r.charge.payerCode,
  payerName: r.charge.payerName,
  chargeCode: r.charge.chargeCode,
  containerNo: r.containerNo,
  currencyCode: r.charge.currencyCode,
});

export function SendToInvoiceModal({ kind, term, selected, currency, onClose, onDone }: {
  kind: 'new' | 'existing';
  term: InvoiceTerm;
  selected: InvoiceCandidate[];
  currency: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [invoiceNo, setInvoiceNo] = useState('');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const [done, setDone] = useState<{ invoiceNo: string; invoiceId: string } | null>(null);

  // Only lines on THIS term, and only ones that can still go on an invoice.
  // The API refuses the whole send if one line is wrong, so the selection is
  // narrowed here rather than letting twenty good lines fail for one.
  const lines = selected.filter(r => r.paymentTermCode === term
    && (r.status === undefined || r.status === 'QUOTED' || r.status === 'UNBILLED'));
  const other = selected.length - lines.length;
  const total = lines.reduce((n, r) => n + r.total, 0);

  // One invoice is one payer: the API answers 409 on a mixed selection, and
  // naming the payers here is more use than that refusal.
  const payers = [...new Set(lines.map(r => r.payerName ?? r.payerCode ?? 'unnamed'))];
  const mixed = payers.length > 1;

  const ready = lines.length > 0 && !mixed && !busy
    && (kind === 'new' || invoiceNo.trim().length > 0);

  const what = `${kind === 'new' ? 'New' : 'Existing'} ${term.toLowerCase()} invoice`;

  async function go() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const r = await sendToInvoice({
        chargeIds: lines.map(l => l.chargeId),
        paymentTermCode: term,
        invoiceNo: kind === 'existing' ? invoiceNo.trim() : null,
        remarks: remarks.trim(),
      });
      setDone({ invoiceNo: r.invoiceNo, invoiceId: r.invoiceId });
      onDone(`${r.invoiceNo} · ${r.lines} lines · ${amount(r.total, r.currencyCode)}`);
    } catch (e) {
      setError(apiProblem(e, 'invoice'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} size="md" closeOnBackdrop={false}
      title={done ? `Invoice ${done.invoiceNo} issued` : what}
      subtitle={done
        ? 'Issued and final. The lines on it are now INVOICED.'
        : `${lines.length} ${term.toLowerCase()} line${lines.length === 1 ? '' : 's'} · ${amount(total, currency)}`}
      footer={done
        ? (
          <>
            <Link href={`/billing/invoices/${encodeURIComponent(done.invoiceId)}`}
              className="gecko-btn gecko-btn-outline gecko-btn-sm">
              <Icon name="invoice" size={13} /> Open the invoice
            </Link>
            <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={onClose}>Done</button>
          </>
        )
        : (
          <>
            <span className="gecko-modal-footer-note gecko-flex-1">
              {lines.length === 0 ? `None of the ticked lines is on ${term.toLowerCase()} terms and still open.`
                : mixed ? 'One invoice is one payer. Tick the lines for a single payer.'
                  : kind === 'existing' && !invoiceNo.trim() ? 'Enter the invoice number to add them to.' : ''}
            </span>
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={!ready} onClick={go}>
              <Icon name="send" size={13} />
              {busy ? 'Sending…' : kind === 'new' ? 'Issue the invoice' : 'Add to it'}
            </button>
          </>
        )}>
      <div className="gecko-stack">
        {error && <Problem p={error} />}

        {!done && (
          <>
            {kind === 'new' && (
              <div className="gecko-alert gecko-alert-info">
                <Icon name="alertCircle" size={16} />
                <span>
                  It is issued at once and is final — there is no draft to check first, and it
                  cannot be added to afterwards.
                </span>
              </div>
            )}

            {kind === 'existing' && (
              <Field label="Invoice number" required>
                <input className="gecko-input gecko-text-mono" value={invoiceNo} autoFocus
                  onChange={e => setInvoiceNo(e.target.value.toUpperCase())} placeholder="INV-2026-0001" />
              </Field>
            )}

            {other > 0 && (
              <div className="gecko-alert gecko-alert-warning">
                <Icon name="alertCircle" size={16} />
                <span>
                  {other} other ticked line{other === 1 ? '' : 's'} will not be sent — only
                  {' '}{term.toLowerCase()} lines that are still open go on this invoice.
                </span>
              </div>
            )}

            {mixed && (
              <div className="gecko-alert gecko-alert-error">
                <Icon name="alertCircle" size={16} />
                <span>These lines are for {payers.length} payers ({payers.join(', ')}). One invoice is one payer.</span>
              </div>
            )}

            <div className="gecko-waive-list">
              {lines.slice(0, 8).map(r => (
                <div key={r.chargeId} className="gecko-waive-line">
                  <span className="gecko-mono-strong">{r.chargeCode}</span>
                  <span className="gecko-cell-meta gecko-flex-1">{r.containerNo ?? 'no box'}</span>
                  <span className="gecko-mono">{amount(r.total, r.currencyCode ?? currency)}</span>
                </div>
              ))}
              {lines.length > 8 && <div className="gecko-cell-meta">…and {lines.length - 8} more</div>}
            </div>

            <Field label="Remarks">
              <textarea className="gecko-input gecko-textarea" rows={2} maxLength={300} value={remarks}
                onChange={e => setRemarks(e.target.value)} placeholder="Shown on the invoice" />
            </Field>
          </>
        )}
      </div>
    </Modal>
  );
}

// ── shared bits ──────────────────────────────────────────────────────────────

function Problem({ p }: { p: { title: string; detail: string } }) {
  return (
    <div role="alert" className="gecko-alert gecko-alert-error">
      <Icon name="alertCircle" size={18} />
      <div><strong>{p.title}</strong><div>{p.detail}</div></div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="gecko-form-group">
      <label className={`gecko-form-label${required ? ' gecko-form-label-required' : ''}`}>{label}</label>
      {children}
    </div>
  );
}

function Check({ checked, onChange, label, hint }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; hint: string;
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
