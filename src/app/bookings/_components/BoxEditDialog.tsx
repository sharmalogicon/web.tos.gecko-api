"use client";
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { DateField } from '@/components/ui/DateField';
import { ApiError } from '@/lib/api/problem';
import { useCodeList } from '@/lib/api/lookups';
import { handoverModeLabel, handoverModesFor } from '@/lib/api/tos';
import { FROZEN_AFTER_GATE, putContainerLine } from '@/lib/api/booking-entry';

/**
 * Editing ONE box already on a booking (GATE_API_FOR_UI.md §16d).
 *
 * Two API facts shape this, and both were confirmed against the running API
 * before it was written:
 *
 * 1. The PUT **replaces the line's details as a whole** — a field left out is
 *    CLEARED, not kept. Omitting declaredVgmKg on a line that had 18000 set it
 *    to null. So this dialog loads every field off the box and sends every
 *    field back, whether the clerk touched it or not. A patch-shaped request
 *    here would quietly wipe weights.
 *
 * 2. A stale rowVersion is a **409**. Someone else edited the line; the honest
 *    answer is to say so and reload, not to retry and overwrite their work.
 *
 * Once the box has been through the gate the API freezes the seals, cargo,
 * DG, required date and handover mode — a change is a 400 on that field. They
 * are shown read-only rather than offered and then refused.
 */

export interface EditableBox {
  bookingContainerId: string;
  containerNo: string;
  lineNo: number;
  rowVersion: string;
  declaredSealNo: string | null;
  customerSealNo: string | null;
  declaredVgmKg: number | null;
  declaredVolumeCbm: number | null;
  requiredDate: string | null;
  cargoCategoryCode: string | null;
  imdgClass: string | null;
  unNumber: string | null;
  reeferSetTempC: number | null;
  reeferVentPct: number | null;
  reeferHumidityPct: number | null;
  stowageCode: string | null;
  stowageNo: string | null;
  isPreCool: boolean | null;
  remarks: string | null;
  handoverMode: string | null;
  steps: { status: string }[];
}

type Draft = Omit<EditableBox, 'bookingContainerId' | 'containerNo' | 'lineNo' | 'rowVersion' | 'steps'>;

const draftOf = (b: EditableBox): Draft => ({
  declaredSealNo: b.declaredSealNo,
  customerSealNo: b.customerSealNo,
  declaredVgmKg: b.declaredVgmKg,
  declaredVolumeCbm: b.declaredVolumeCbm,
  requiredDate: b.requiredDate,
  cargoCategoryCode: b.cargoCategoryCode,
  imdgClass: b.imdgClass,
  unNumber: b.unNumber,
  reeferSetTempC: b.reeferSetTempC,
  reeferVentPct: b.reeferVentPct,
  reeferHumidityPct: b.reeferHumidityPct,
  stowageCode: b.stowageCode,
  stowageNo: b.stowageNo,
  isPreCool: b.isPreCool,
  remarks: b.remarks,
  handoverMode: b.handoverMode,
});

export function BoxEditDialog({ bookingId, box, directionCode, onSaved, onClose }: {
  bookingId: string;
  box: EditableBox | null;
  directionCode: string | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [d, setD] = useState<Draft | null>(box ? draftOf(box) : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const cargo = useCodeList('CARGO_CATEGORY');

  if (!box || !d) return null;

  // Any DONE step means the box has been through the gate.
  const gated = box.steps.some(s => s.status === 'DONE');
  const frozen = (f: string) => gated && FROZEN_AFTER_GATE.includes(f);
  const patch = (p: Partial<Draft>) => setD(cur => (cur ? { ...cur, ...p } : cur));
  const err = (f: string) => error?.forField(f);
  const num = (v: string) => (v.trim() === '' ? null : Number(v));
  const stale = error?.status === 409;

  async function save() {
    if (!d || !box) return;
    setBusy(true);
    setError(null);
    try {
      // EVERY field, every time — the PUT replaces, it does not patch.
      await putContainerLine(bookingId, box.bookingContainerId, box.rowVersion, d);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'The box could not be saved.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="xl"
      closeOnBackdrop={false}
      title={box.containerNo}
      subtitle={`Line ${box.lineNo}${gated ? ' · through the gate — seals, cargo, DG, required date and handover are fixed' : ''}`}
      footer={
        <>
          <span className="gecko-modal-footer-note gecko-flex-1">
            {stale ? 'Someone else changed this box. Reload the booking and try again.' : ''}
          </span>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose}>Cancel</button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={busy || stale} onClick={save}>
            <Icon name="check" size={14} /> {busy ? 'Saving…' : 'Save box'}
          </button>
        </>
      }
    >
      <div className="gecko-stack">
        {error && (
          <div role="alert" className={`gecko-alert gecko-alert-${stale ? 'warning' : 'error'} gecko-row`} style={{ gap: 10 }}>
            <Icon name="alertCircle" size={16} />
            <span>{stale ? 'This box was changed by someone else while you had it open. Nothing has been saved — reload and re-apply your change.' : error.message}</span>
          </div>
        )}

        <section className="gecko-stack-sm">
          <div className="gecko-field-label">Seals and weight</div>
          <div className="gecko-grid-4" style={{ gap: 12 }}>
            <Labelled label="Line seal" error={err('declaredSealNo')} frozen={frozen('declaredSealNo')}>
              <input className="gecko-input" maxLength={20} value={d.declaredSealNo ?? ''} disabled={frozen('declaredSealNo')}
                onChange={e => patch({ declaredSealNo: e.target.value || null })} />
            </Labelled>
            <Labelled label="Customer seal" error={err('customerSealNo')} frozen={frozen('customerSealNo')}>
              <input className="gecko-input" maxLength={20} value={d.customerSealNo ?? ''} disabled={frozen('customerSealNo')}
                onChange={e => patch({ customerSealNo: e.target.value || null })} />
            </Labelled>
            <Labelled label="VGM kg" error={err('declaredVgmKg')}>
              <input className="gecko-input" type="number" min={0} value={d.declaredVgmKg ?? ''}
                onChange={e => patch({ declaredVgmKg: num(e.target.value) })} />
            </Labelled>
            <Labelled label="Volume m³" error={err('declaredVolumeCbm')}>
              <input className="gecko-input" type="number" min={0} step="0.01" value={d.declaredVolumeCbm ?? ''}
                onChange={e => patch({ declaredVolumeCbm: num(e.target.value) })} />
            </Labelled>
          </div>
        </section>

        <section className="gecko-stack-sm">
          <div className="gecko-field-label">Cargo</div>
          <div className="gecko-grid-4" style={{ gap: 12 }}>
            <Labelled label="Required date" error={err('requiredDate')} frozen={frozen('requiredDate')}>
              <DateField value={d.requiredDate ?? ''} readOnly={frozen('requiredDate')} aria-label="Required date"
                onChange={v => patch({ requiredDate: v || null })} />
            </Labelled>
            <Labelled label="Cargo category" error={err('cargoCategoryCode')} frozen={frozen('cargoCategoryCode')}>
              <select className="gecko-input" value={d.cargoCategoryCode ?? ''} disabled={frozen('cargoCategoryCode')}
                onChange={e => patch({ cargoCategoryCode: e.target.value || null })}>
                <option value="">from the line</option>
                {cargo.values.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
            </Labelled>
            <Labelled label="IMDG class" error={err('imdgClass')} frozen={frozen('imdgClass')}>
              <input className="gecko-input" maxLength={10} value={d.imdgClass ?? ''} disabled={frozen('imdgClass')}
                onChange={e => patch({ imdgClass: e.target.value.toUpperCase() || null })} />
            </Labelled>
            <Labelled label="UN number" error={err('unNumber')} frozen={frozen('unNumber')} hint="Four digits; needs an IMDG class.">
              <input className="gecko-input gecko-text-mono" maxLength={4} value={d.unNumber ?? ''} disabled={frozen('unNumber')}
                onChange={e => patch({ unNumber: e.target.value || null })} />
            </Labelled>
          </div>
        </section>

        <section className="gecko-stack-sm">
          <div className="gecko-field-label">Reefer and stowage</div>
          <div className="gecko-grid-4" style={{ gap: 12 }}>
            <Labelled label="Set point °C" error={err('reeferSetTempC')} hint="−70 to 40, reefer lines only.">
              <input className="gecko-input" type="number" min={-70} max={40} step="0.1" value={d.reeferSetTempC ?? ''}
                onChange={e => patch({ reeferSetTempC: num(e.target.value) })} />
            </Labelled>
            <Labelled label="Vent %" error={err('reeferVentPct')}>
              <input className="gecko-input" type="number" min={0} max={100} value={d.reeferVentPct ?? ''}
                onChange={e => patch({ reeferVentPct: num(e.target.value) })} />
            </Labelled>
            <Labelled label="Humidity %" error={err('reeferHumidityPct')}>
              <input className="gecko-input" type="number" min={0} max={100} value={d.reeferHumidityPct ?? ''}
                onChange={e => patch({ reeferHumidityPct: num(e.target.value) })} />
            </Labelled>
            <Labelled label="Stowage" error={err('stowageCode')}>
              <div className="gecko-row" style={{ gap: 6 }}>
                <input className="gecko-input" value={d.stowageCode ?? ''} placeholder="DECK" aria-label="Stowage code"
                  onChange={e => patch({ stowageCode: e.target.value.toUpperCase() || null })} />
                <input className="gecko-input" value={d.stowageNo ?? ''} placeholder="12" aria-label="Stowage number"
                  onChange={e => patch({ stowageNo: e.target.value || null })} />
              </div>
            </Labelled>
          </div>
        </section>

        <section className="gecko-stack-sm">
          <div className="gecko-grid-3" style={{ gap: 12 }}>
            <Labelled label={handoverModeLabel(directionCode)} error={err('handoverMode')} frozen={frozen('handoverMode')}>
              <select className="gecko-input" value={d.handoverMode ?? ''} disabled={frozen('handoverMode')}
                onChange={e => patch({ handoverMode: e.target.value || null })}>
                <option value="">—</option>
                {handoverModesFor(directionCode).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Labelled>
            <div>
              <div className="gecko-field-label gecko-mb-1">Pre-cooled</div>
              <label className="gecko-row" style={{ gap: 6 }}>
                <input type="checkbox" className="gecko-checkbox" checked={d.isPreCool ?? false}
                  onChange={e => patch({ isPreCool: e.target.checked })} />
                <span>Yes</span>
              </label>
            </div>
            <Labelled label="Remarks" error={err('remarks')}>
              <input className="gecko-input" maxLength={300} value={d.remarks ?? ''}
                onChange={e => patch({ remarks: e.target.value || null })} />
            </Labelled>
          </div>
        </section>
      </div>
    </Modal>
  );
}

function Labelled({ label, error, hint, frozen, children }: {
  label: string; error?: string; hint?: string; frozen?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="gecko-field-label gecko-mb-1">
        {label}
        {frozen && <span className="gecko-cell-meta" style={{ marginLeft: 6 }}>· fixed at the gate</span>}
      </div>
      {children}
      {hint && !error && <div className="gecko-cell-meta">{hint}</div>}
      {error && <div className="gecko-field-error">{error}</div>}
    </div>
  );
}
