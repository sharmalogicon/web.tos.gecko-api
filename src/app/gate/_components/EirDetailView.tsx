"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useApi, type Paged } from '@/lib/api/use-api';
import { apiDownload, apiSend, saveBlob } from '@/lib/api/client';
import { ApiError } from '@/lib/api/problem';
import { useSession } from '@/lib/auth/session';
import { TOS_PERMISSIONS, formatContainerNo, formatDateTime, type TruckVisit } from '@/lib/api/tos';
import { WINDOW_PERMISSIONS, formatBaht, visitQuotePath, type VisitQuote } from '@/lib/api/window';
import {
  GATE_API, attachmentsPath, eirPath, formatBytes, formatKg,
  type ContainerHolds, type EirDetail, type GateAttachment, type Survey,
} from '@/lib/api/gate-eir';

/**
 * EIR DETAIL — one gate transaction, live against gecko_tos.
 *
 * The move, its seals, the survey of that move with its damages, the photos,
 * the truck visit it came on, and the holds on the box NOW. The printed EIR is
 * the API's PDF. A supervisor (tos.gate.override at this depot) may void it.
 */
export function EirDetailView({ id }: { id: string }) {
  const { can, canAt } = useSession();
  const toast = useToast();
  const eir = useApi<EirDetail>(`${GATE_API}/transactions/${id}`);
  const e = eir.data;
  const surveys = useApi<Paged<Survey>>(e ? `${GATE_API}/surveys?gateTransactionId=${e.gateTransactionId}&pageSize=20` : null);
  const photos = useApi<GateAttachment[]>(e ? attachmentsPath('GATE_TRANSACTION', e.gateTransactionId) : null);
  const visit = useApi<TruckVisit>(e ? `${GATE_API}/visits/${e.truckVisitId}` : null);
  const holds = useApi<ContainerHolds>(e && can(TOS_PERMISSIONS.holdView) ? `/api/tos/containers/${e.containerNo}/holds` : null);
  // What the whole truck visit was charged — cash taken at the window against
  // credit on an account. 404 simply means the visit's moves cost nothing.
  const charges = useApi<VisitQuote>(
    e && canAt(WINDOW_PERMISSIONS.collect, e.branchId) ? visitQuotePath(e.truckVisitId) : null);
  const [voiding, setVoiding] = useState(false);
  const [printing, setPrinting] = useState(false);

  const register = e?.direction === 'OUT' ? '/gate/eir-out' : '/gate/eir-in';
  const mayVoid = !!e && e.status !== 'VOIDED' && canAt(TOS_PERMISSIONS.gateOverride, e.branchId);

  const printEir = async () => {
    if (!e) return;
    setPrinting(true);
    try {
      const file = await apiDownload(`${GATE_API}/transactions/${e.gateTransactionId}/eir.pdf`);
      saveBlob(file.blob, file.filename ?? `${e.eirNo}.pdf`);
    } catch (err: unknown) {
      toast.toast({ variant: 'danger', title: 'EIR not printed', message: err instanceof ApiError ? err.title : 'Could not reach the Gecko API.' });
    } finally {
      setPrinting(false);
    }
  };

  if (eir.error) {
    return (
      <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto' }}>
        <div className="gecko-alert gecko-alert-error">
          <Icon name="alertCircle" size={18} />
          <div>
            <div style={{ fontWeight: 600 }}>{eir.error.status === 404 ? 'No such EIR at your depots' : eir.error.title}</div>
            {eir.error.explanation && <div>{eir.error.explanation}</div>}
          </div>
        </div>
        <Link href="/gate/eir-in" className="gecko-btn gecko-btn-ghost gecko-btn-sm">Back to the register</Link>
      </div>
    );
  }
  if (!e) return <div className="gecko-cell-meta" style={{ padding: 24 }}>Loading the EIR…</div>;

  const surveyRows = surveys.data?.items ?? [];

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', paddingBottom: 60 }}>
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <Link href={register} className="gecko-link gecko-cell-meta">← {e.direction === 'OUT' ? 'EIR-Out' : 'EIR-In'} register</Link>
          <div className="gecko-row gecko-row-baseline gecko-stack-md gecko-mt-1">
            <h1 className="gecko-page-title">{e.eirNo}</h1>
            <span className={`gecko-badge gecko-badge-${e.status === 'VOIDED' ? 'error' : 'success'}`}>{e.status}</span>
            {e.isLate && <span className="gecko-badge gecko-badge-warning">late, on record</span>}
            {e.sealMismatch && <span className="gecko-badge gecko-badge-warning">seal differs</span>}
            {!e.isCheckDigitValid && <span className="gecko-badge gecko-badge-warning">check digit overridden</span>}
          </div>
          <div className="gecko-page-subtitle gecko-mt-1">
            Gate-{e.direction.toLowerCase()} · {formatContainerNo(e.containerNo)} · {e.movementCode} · {e.fullEmpty.toLowerCase()} · {formatDateTime(e.transactionAt)}
          </div>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={printEir} disabled={printing}>
            <Icon name="download" size={14} /> {printing ? 'Preparing…' : 'EIR PDF'}
          </button>
          {mayVoid && (
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setVoiding(true)}>Void EIR</button>
          )}
        </div>
      </div>

      {e.status === 'VOIDED' && (
        <div className="gecko-alert gecko-alert-error">
          <Icon name="alertCircle" size={18} />
          <div>
            <div style={{ fontWeight: 600 }}>Voided {formatDateTime(e.voidedAt)}</div>
            <div>{e.voidReason ?? 'No reason recorded.'} The number is kept and never reused; the move is re-recorded at the gate desk.</div>
          </div>
        </div>
      )}

      <div className="gecko-grid-3" style={{ gap: 20 }}>
        <Section title="The move">
          <Line label="Booking" value={<Link href={`/bookings/${e.bookingId}`} className="gecko-link">{e.orderNo}</Link>} />
          <Line label="Line" value={e.lineCode} />
          <Line label="Equipment" value={[e.equipmentTypeCode, e.isoCode].filter(Boolean).join(' · ') || '—'} />
          <Line label="Position" value={e.positionText ?? '—'} />
          <Line label="Recorded" value={formatDateTime(e.recordedAt)} />
          {e.replacesGateTransactionId && (
            <Line label="Reissue of" value={<Link href={eirPath(e.direction, e.replacesGateTransactionId)} className="gecko-link">the voided EIR</Link>} />
          )}
          {e.remarks && <Line label="Remarks" value={e.remarks} />}
        </Section>

        <Section title="Weight and condition">
          <Line label="Gross" value={formatKg(e.grossWeightKg)} />
          <Line label="Tare" value={formatKg(e.tareWeightKg)} />
          <Line label="VGM" value={e.vgmKg == null ? '—' : `${formatKg(e.vgmKg)}${e.vgmMethod ? ` (${e.vgmMethod})` : ''}`} />
          <Line label="Max gross" value={formatKg(e.maxGrossWeightKg)} />
          <Line label="Cargo" value={formatKg(e.cargoWeightKg)} />
          <Line label="Weight source" value={e.weightSource ?? '—'} />
          {/* Container class IS the grade — there is no separate field. */}
          <Line label="Condition / class" value={[e.conditionCode, e.gradeCode].filter(Boolean).join(' / ') || '—'} />
          <Line label="Material" value={e.materialCode ?? '—'} />
          {e.tempObservedC != null && <Line label="Temperature seen" value={`${e.tempObservedC} °C`} />}
          {(e.ventSetting || e.humidityPct != null || e.gensetNo || e.clipOnNo) && (
            <Line label="Reefer" value={[
              e.ventSetting && `vent ${e.ventSetting}`,
              e.humidityPct != null && `${e.humidityPct}% RH`,
              e.gensetNo && `genset ${e.gensetNo}`,
              e.clipOnNo && `clip-on ${e.clipOnNo}`,
            ].filter(Boolean).join(' · ')} />
          )}
        </Section>

        <Section title="Documents">
          <Line label="Customs permit" value={e.customsPermitNo ?? '—'} />
          <Line label="Paperless code" value={e.paperlessCode ?? '—'} />
          <Line label="Next location" value={e.nextLocationCode ?? '—'} />
        </Section>

        <Section title="Truck">
          <Line label="Plate" value={e.truckPlate} />
          <Line label="Visit" value={e.visitNo} />
          <Line label="Trip" value={e.tripType === 'PICK_UP_CONT' ? 'Pick-up' : 'Drop-off'} />
          <Line label="Category" value={e.truckCategoryCode ?? '—'} />
          {visit.data && (
            <>
              {visit.data.trailerPlate && <Line label="Trailer" value={visit.data.trailerPlate} />}
              <Line label="Haulier" value={visit.data.haulierCode ?? '—'} />
              <Line label="Driver" value={visit.data.driverName ?? '—'} />
              <Line label="Arrived / left" value={`${formatDateTime(visit.data.arrivedAt)} / ${formatDateTime(visit.data.gateOutAt)}`} />
              {visit.data.transactions.filter(t => t.gateTransactionId !== e.gateTransactionId).map(t => (
                <Line key={t.gateTransactionId} label="Also on this truck"
                      value={<Link href={eirPath(t.direction, t.gateTransactionId)} className="gecko-link">{t.eirNo} · {formatContainerNo(t.containerNo)}</Link>} />
              ))}
            </>
          )}
        </Section>
      </div>

      {charges.data && (
        <Section title="What this truck visit was charged">
          <table className="gecko-table">
            <thead>
              <tr><th>Box</th><th>Charge</th><th className="gecko-num">Amount</th><th className="gecko-num">VAT</th><th className="gecko-num">Total</th><th>Term</th><th>Receipt</th></tr>
            </thead>
            <tbody>
              {charges.data.boxes.flatMap(box => box.lines.map((l, i) => (
                <tr key={`${box.gateTransactionId}-${l.chargeCode}-${i}`}>
                  <td className="gecko-mono">{i === 0 ? formatContainerNo(box.containerNo ?? '') : ''}</td>
                  <td>
                    {l.description || l.chargeCode}
                    {l.isGateCharge && <span className="gecko-badge gecko-badge-xs gecko-badge-gray"> per trip</span>}
                  </td>
                  <td className="gecko-num">{formatBaht(l.amount)}</td>
                  <td className="gecko-num">{formatBaht(l.taxAmount)}</td>
                  <td className="gecko-num">{formatBaht(l.sellingAmount)}</td>
                  <td>
                    <span className={`gecko-badge gecko-badge-xs ${l.paymentTerm === 'CASH' ? 'gecko-badge-success' : 'gecko-badge-warning'}`}>
                      {l.paymentTerm}
                    </span>
                  </td>
                  <td className="gecko-cell-meta">{l.receiptNo ?? l.status}</td>
                </tr>
              )))}
            </tbody>
          </table>
          <div className="gecko-row gecko-row-between" style={{ marginTop: 10 }}>
            <Line label="Paid at the window" value={formatBaht(charges.data.paidNow.total)} />
            <Line label="Billed later" value={formatBaht(charges.data.billedLater.total)} />
          </div>
        </Section>
      )}

      <div className="gecko-grid-2" style={{ gap: 20 }}>
        <Section title={`Seals (${e.seals.length})`}>
          {e.seals.length === 0 ? <div className="gecko-cell-meta">No seal recorded.</div> : (
            <table className="gecko-table">
              <thead><tr><th>Seal</th><th>Type</th><th>Intact</th><th>Matches the booking</th></tr></thead>
              <tbody>
                {e.seals.map(s => (
                  <tr key={s.sealNo}>
                    <td style={{ fontFamily: 'var(--gecko-font-mono, monospace)' }}>{s.sealNo}</td>
                    <td>{s.sealType.toLowerCase()}</td>
                    <td>{s.isIntact ? 'yes' : <span className="gecko-badge gecko-badge-xs gecko-badge-warning">broken</span>}</td>
                    <td>{s.matchesDeclared == null ? '—' : s.matchesDeclared ? 'yes' : <span className="gecko-badge gecko-badge-xs gecko-badge-warning">no</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Overrides and cut-off">
          <Line label="Cut-off applied" value={e.cutoffKindApplied ? `${e.cutoffKindApplied} · ${formatDateTime(e.cutoffAtApplied)}` : '—'} />
          <Line label="Late override" value={e.lateOverrideReason ?? '—'} />
          <Line label="Check-digit override" value={e.checkDigitOverrideReason ?? '—'} />
          <Line label="Paid by coupon" value={e.gateAuthorizationId ? 'yes' : '—'} />
        </Section>
      </div>

      <Section title="Survey">
        {surveys.error ? <div className="gecko-field-error">{surveys.error.title}</div>
          : surveyRows.length === 0 ? <div className="gecko-cell-meta">{surveys.loading ? 'Loading…' : 'This move was not surveyed.'}</div>
          : surveyRows.map(s => <SurveyBlock key={s.surveyId} survey={s} />)}
      </Section>

      <Section title="Photos and scans">
        <AttachmentList rows={photos.data} error={photos.error} empty="No photo was taken with this EIR." />
      </Section>

      {can(TOS_PERMISSIONS.holdView) && (
        <Section title="Holds on this box now">
          {holds.error ? <div className="gecko-field-error">{holds.error.title}</div>
            : !holds.data ? <div className="gecko-cell-meta">Loading…</div>
            : holds.data.holds.length === 0 ? <div className="gecko-cell-meta">Not held.</div>
            : (
              <table className="gecko-table">
                <thead><tr><th>Hold</th><th>Via</th><th>Placed</th><th>Why</th></tr></thead>
                <tbody>
                  {holds.data.holds.map(h => (
                    <tr key={h.containerHoldId}>
                      <td><span className="gecko-badge gecko-badge-xs" style={{ background: h.displayColorHex ?? undefined, color: h.displayColorHex ? '#fff' : undefined }}>{h.holdCode}</span>
                        <div className="gecko-cell-meta">{h.description}</div></td>
                      <td>{h.heldVia === 'BOOKING' ? `booking ${h.orderNo ?? ''}` : 'the box'}</td>
                      <td>{formatDateTime(h.appliedAt)}</td>
                      <td>{h.applyReason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          <div className="gecko-cell-meta gecko-mt-1"><Link href="/gate/holds" className="gecko-link">Holds board</Link></div>
        </Section>
      )}

      {voiding && (
        <VoidModal eir={e} onClose={() => setVoiding(false)}
                   onVoided={() => { setVoiding(false); eir.reload(); }} />
      )}
    </div>
  );
}

function SurveyBlock({ survey: s }: { survey: Survey }) {
  const photos = useApi<GateAttachment[]>(attachmentsPath('SURVEY', s.surveyId));
  return (
    <div className="gecko-stack" style={{ gap: 10 }}>
      <div className="gecko-row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <strong>{s.surveyType.replace('_', ' ').toLowerCase()}</strong>
        <span className={`gecko-badge gecko-badge-xs gecko-badge-${s.isServiceable ? 'success' : 'error'}`}>{s.isServiceable ? 'serviceable' : 'unserviceable'}</span>
        <span className="gecko-cell-meta">{formatDateTime(s.surveyedAt)} · {s.surveyorName ?? '—'} · condition {s.conditionCode ?? '—'} / grade {s.gradeCode ?? '—'}</span>
        {s.holdsApplied.map(h => <span key={h} className="gecko-badge gecko-badge-xs gecko-badge-warning">{h} applied</span>)}
      </div>
      {s.remarks && <div>{s.remarks}</div>}
      {s.damages.length === 0 ? <div className="gecko-cell-meta">No damage recorded.</div> : (
        <table className="gecko-table">
          <thead><tr><th>#</th><th>Damage</th><th>Location</th><th>Component</th><th>Size (cm)</th><th>Qty</th><th>Remarks</th></tr></thead>
          <tbody>
            {s.damages.map(d => (
              <tr key={d.surveyDamageId}>
                <td>{d.lineNo}</td>
                <td>{d.damageCode}{d.makesUnserviceable && <span className="gecko-badge gecko-badge-xs gecko-badge-error" style={{ marginLeft: 4 }}>unserviceable</span>}
                  <div className="gecko-cell-meta">{d.damageDescription}{d.isPreExisting ? ' · pre-existing' : ''}</div></td>
                <td>{d.locationCode ?? '—'}</td>
                <td>{d.componentCode ?? '—'}</td>
                <td>{d.lengthCm == null && d.widthCm == null ? '—' : `${d.lengthCm ?? '?'} × ${d.widthCm ?? '?'}`}</td>
                <td>{d.quantity}</td>
                <td>{d.remarks ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <AttachmentList rows={photos.data} error={photos.error} empty="No survey photo." />
    </div>
  );
}

function AttachmentList({ rows, error, empty }: { rows: GateAttachment[] | null; error: ApiError | null; empty: string }) {
  if (error) return <div className="gecko-field-error">{error.title}</div>;
  if (!rows) return <div className="gecko-cell-meta">Loading…</div>;
  if (rows.length === 0) return <div className="gecko-cell-meta">{empty}</div>;
  return (
    <div className="gecko-row" style={{ gap: 12, flexWrap: 'wrap' }}>
      {rows.map(a => <AttachmentTile key={a.attachmentId} a={a} />)}
    </div>
  );
}

/** The content endpoint needs the bearer token, so the file is fetched and shown from a blob. */
function AttachmentTile({ a }: { a: GateAttachment }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const isImage = a.contentType.startsWith('image/');
  useEffect(() => {
    if (!isImage) return;
    let gone = false;
    let made: string | null = null;
    apiDownload(`${GATE_API}/attachments/${a.attachmentId}/content`)
      .then(f => { if (!gone) { made = URL.createObjectURL(f.blob); setUrl(made); } })
      .catch(() => { if (!gone) setFailed(true); });
    return () => { gone = true; if (made) URL.revokeObjectURL(made); };
  }, [a.attachmentId, isImage]);

  const open = async () => {
    const f = await apiDownload(`${GATE_API}/attachments/${a.attachmentId}/content`);
    saveBlob(f.blob, f.filename ?? `${a.attachmentId}${a.contentType === 'application/pdf' ? '.pdf' : ''}`);
  };

  return (
    <button type="button" className="gecko-card" onClick={open} title="Download"
            style={{ width: 160, padding: 8, textAlign: 'left', cursor: 'pointer' }}>
      <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gecko-gray-50)', borderRadius: 4, overflow: 'hidden' }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a blob URL, not an optimisable asset */}
        {url ? <img src={url} alt={a.caption ?? 'gate photo'} style={{ maxWidth: '100%', maxHeight: '100%' }} />
          : <Icon name={failed ? 'alertCircle' : 'fileText'} size={28} />}
      </div>
      <div className="gecko-cell-meta" style={{ marginTop: 6 }}>{a.caption ?? a.contentType}</div>
      <div className="gecko-cell-meta">{formatDateTime(a.takenAt ?? a.createdAt)} {formatBytes(a.sizeBytes)}</div>
    </button>
  );
}

function VoidModal({ eir, onClose, onVoided }: { eir: EirDetail; onClose: () => void; onVoided: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiError | null>(null);

  const submit = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await apiSend('POST', `${GATE_API}/transactions/${eir.gateTransactionId}/void`, { reason: reason.trim(), rowVersion: eir.rowVersion });
      toast.toast({ variant: 'success', title: `${eir.eirNo} voided`, message: 'The step it completed is open again. Re-record the move at the gate desk.' });
      onVoided();
    } catch (e: unknown) {
      setFailure(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
    } finally {
      setBusy(false);
    }
  };

  const stale = failure?.status === 409;
  const general = failure && !failure.forField('reason') ? failure : null;

  return (
    <Modal isOpen onClose={onClose} title={`Void ${eir.eirNo}`}
           subtitle={`${formatContainerNo(eir.containerNo)} · ${eir.movementCode}. The number is kept; the booking step and the yard go back to how they were.`}
           footer={
             <>
               <button className="gecko-btn gecko-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
               {stale
                 ? <button className="gecko-btn gecko-btn-primary" onClick={onVoided}>Reload the EIR</button>
                 : <button className="gecko-btn gecko-btn-primary" onClick={submit} disabled={busy || reason.trim().length < 3}>
                     {busy ? 'Voiding…' : 'Void EIR'}
                   </button>}
             </>
           }>
      <div className="gecko-stack" style={{ gap: 14 }}>
        {general && (
          <div className={`gecko-alert gecko-alert-${stale ? 'warning' : 'error'}`}>
            <Icon name="alertCircle" size={18} />
            <div>
              <div style={{ fontWeight: 600 }}>{general.title}</div>
              {general.explanation && <div>{general.explanation}</div>}
            </div>
          </div>
        )}
        <div className="gecko-form-group">
          <label className="gecko-form-label">Why is it voided? *</label>
          <textarea className="gecko-input" rows={3} maxLength={300} value={reason} onChange={ev => setReason(ev.target.value)}
                    placeholder="e.g. Wrong box keyed at the desk" />
          {failure?.forField('reason') && <div className="gecko-field-error">{failure.forField('reason')}</div>}
        </div>
      </div>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="gecko-card gecko-card-padded">
      <div className="gecko-stat-label gecko-mb-2">{title}</div>
      {children}
    </div>
  );
}

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="gecko-row" style={{ justifyContent: 'space-between', gap: 12, padding: '4px 0' }}>
      <span className="gecko-cell-meta">{label}</span>
      <span style={{ textAlign: 'right' }}>{value}</span>
    </div>
  );
}
