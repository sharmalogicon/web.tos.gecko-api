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
import { codeLabel, useCodeList } from '@/lib/api/lookups';
import { EIR_PRINT_NOTE, openPdf } from '@/lib/api/open-pdf';
import { couponPdfPath } from '@/lib/api/receipts';
import { receiptByNo } from '@/lib/api/cash-bills';
import { AmendTruckModal } from './AmendTruckModal';
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
  // Labels for the derived visit mode, as the tenant worded them.
  const pudoModes = useCodeList('PICKUP_DROPOFF_MODE');
  const charges = useApi<VisitQuote>(
    e && canAt(WINDOW_PERMISSIONS.collect, e.branchId) ? visitQuotePath(e.truckVisitId) : null);
  const [voiding, setVoiding] = useState(false);
  const [amending, setAmending] = useState(false);
  /**
   * Amending a RECORDED gate document is supervisor work, so it takes the same
   * permission as voiding one rather than the clerk's create right. A voided
   * EIR is not edited at all: it is history, and the replacement carries the
   * corrected truck.
   */
  const mayAmend = !!e && e.status !== 'VOIDED' && !!visit.data
    && canAt(TOS_PERMISSIONS.gateOverride, e.branchId);
  const [printing, setPrinting] = useState(false);
  /** Which of the other two documents is being fetched, if either. */
  const [printingDoc, setPrintingDoc] = useState<'truck-in' | 'coupon' | null>(null);

  const register = e?.direction === 'OUT' ? '/gate/eir-out' : '/gate/eir-in';
  const mayVoid = !!e && e.status !== 'VOIDED' && canAt(TOS_PERMISSIONS.gateOverride, e.branchId);
  // The coupon is a cash document: without the permission the API answers 403,
  // so the button is not offered rather than shown and refused.
  const mayCollect = !!e && canAt(WINDOW_PERMISSIONS.collect, e.branchId);

  /**
   * The other two papers a gate clerk hands over.
   *
   * TRUCK-IN FORM is the visit's, not the EIR's — one truck, one form, however
   * many boxes it brought — so it is keyed on truckVisitId.
   *
   * COUPON is the RECEIPT's: it is what a driver spends at the barrier to take
   * a box out, so it only exists where money was taken. The quote answers a
   * receipt NUMBER and the PDF wants an id, so the number is resolved first —
   * the same lookup the receipts register uses.
   *
   * Both are authorised endpoints, so both fetch the bytes with the token and
   * hand over a blob. A plain link would answer 401.
   */
  const receiptNo = charges.data?.boxes
    ?.flatMap(b => b.lines ?? [])
    .map(l => l.receiptNo)
    .find((n): n is string => Boolean(n)) ?? null;

  const printTruckIn = async () => {
    if (!e) return;
    setPrintingDoc('truck-in');
    try {
      await openPdf(`${GATE_API}/visits/${e.truckVisitId}/truck-in.pdf`, `${e.visitNo}-truck-in.pdf`);
    } catch (err: unknown) {
      toast.toast({ variant: 'danger', title: 'Truck-in form not printed',
        message: err instanceof ApiError ? err.title : 'Could not reach the Gecko API.' });
    } finally {
      setPrintingDoc(null);
    }
  };

  const printCoupon = async () => {
    if (!receiptNo) return;
    setPrintingDoc('coupon');
    try {
      const receipt = await receiptByNo(receiptNo);
      await openPdf(couponPdfPath(receipt.receiptId), `${receiptNo}-coupon.pdf`);
    } catch (err: unknown) {
      const api = err instanceof ApiError ? err : null;
      toast.toast({ variant: 'danger', title: 'Coupon not printed',
        message: api?.status === 404
          ? `No coupon was issued on ${receiptNo}.`
          : api?.status === 403
            ? 'Printing a cash bill needs the cash-collect permission.'
            : api?.title ?? 'Could not reach the Gecko API.' });
    } finally {
      setPrintingDoc(null);
    }
  };

  const printEir = async () => {
    if (!e) return;
    setPrinting(true);
    try {
      // Values only, onto the depot's pre-printed stationery — so it OPENS for
      // printing rather than landing in Downloads for someone to find later.
      await openPdf(`${GATE_API}/transactions/${e.gateTransactionId}/eir.pdf`, `${e.eirNo}.pdf`);
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
          </div>
          <div className="gecko-page-subtitle gecko-mt-1">
            Gate-{e.direction.toLowerCase()} · {formatContainerNo(e.containerNo)} · {e.movementCode} · {e.fullEmpty.toLowerCase()} · {formatDateTime(e.transactionAt)}
          </div>
        </div>
        <div className="gecko-toolbar">
          {/* Enabled on a VOIDED EIR too: it prints with a VOID mark, and a
              clerk asked to show why a move was cancelled needs that paper. */}
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={printEir} disabled={printing}>
            <Icon name="print" size={14} /> {printing ? 'Preparing…' : 'Print EIR (pre-printed form)'}
          </button>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm"
            onClick={printTruckIn} disabled={printingDoc !== null}
            title="One form for the whole truck visit, however many boxes it brought">
            <Icon name="download" size={14} />
            {printingDoc === 'truck-in' ? 'Preparing…' : 'Truck-in form'}
          </button>
          {/* Only where money was taken: a coupon is what the driver spends at
              the barrier, so a visit that was charged nothing has none. */}
          {receiptNo && mayCollect && (
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm"
              onClick={printCoupon} disabled={printingDoc !== null}
              title={`The cash bill for receipt ${receiptNo}`}>
              <Icon name="print" size={14} />
              {printingDoc === 'coupon' ? 'Preparing…' : 'Coupon (cash bill)'}
            </button>
          )}
          {mayVoid && (
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setVoiding(true)}>Void EIR</button>
          )}
          {/* The EIR prints VALUES ONLY onto pre-printed stationery. At "Fit to
              page" every value lands a few millimetres out and the whole form
              is wrong — which nobody notices until a driver is holding it. */}
          <div className="gecko-print-note">{EIR_PRINT_NOTE}</div>
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

      {/* The truck first and full width: it is the thing in front of the clerk,
          and everything below is about the box it brought. */}
        <Section title="Truck" action={mayAmend && (
          <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm"
            onClick={() => setAmending(true)}>
            <Icon name="edit" size={14} /> Edit
          </button>
        )}>
          <Facts>
          <Line label="Plate" value={e.truckPlate} />
          <Line label="Visit" value={e.visitNo} />
          <Line label="Trip" value={e.tripType === 'PICK_UP_CONT' ? 'Pick-up' : 'Drop-off'} />
          <Line label="Category" value={e.truckCategoryCode ?? '—'} />
          {/* The VISIT's mode, derived by the server from the moves that stand.
              A voided EIR changes it, which is why it is read, never counted here. */}
          {visit.data?.pickupDropoffMode && (
            <Line label="Visit mode" value={codeLabel(pudoModes.values, visit.data.pickupDropoffMode)} />
          )}
          {visit.data && (
            <>
              {visit.data.trailerPlate && <Line label="Trailer" value={visit.data.trailerPlate} />}
              <Line label="Haulier" value={visit.data.haulierCode ?? '—'} />
              <Line label="Driver" value={visit.data.driverName ?? '—'} />
              {visit.data.driverMobile && <Line label="Mobile" value={visit.data.driverMobile} />}
              <Line label="Arrived / left" value={`${formatDateTime(visit.data.arrivedAt)} / ${formatDateTime(visit.data.gateOutAt)}`} />
              {visit.data.transactions.filter(t => t.gateTransactionId !== e.gateTransactionId).map(t => (
                <Line key={t.gateTransactionId} label="Also on this truck"
                      value={<Link href={eirPath(t.direction, t.gateTransactionId)} className="gecko-link">{t.eirNo} · {formatContainerNo(t.containerNo)}</Link>} />
              ))}
            </>
          )}
          </Facts>
        
        </Section>

      {/* Then the move on the left, the BOX on the right. Seals, reefer and
          weights are one subject and used to be split across two cards and two
          rows, so a clerk checking a reefer read half of it above the fold. */}
      <div className="gecko-grid-2" style={{ gap: 20 }}>
        <Section title="The move">
          <Facts>
          <Line label="Booking" value={<Link href={`/bookings/${e.bookingId}`} className="gecko-link">{e.orderNo}</Link>} />
          <Line label="Line" value={e.lineCode} />
          <Line label="Equipment" value={[e.equipmentTypeCode, e.isoCode].filter(Boolean).join(' · ') || '—'} />
          <Line label="Position" value={e.positionText ?? '—'} />
          <Line label="Recorded" value={formatDateTime(e.recordedAt)} />
          {e.replacesGateTransactionId && (
            <Line label="Reissue of" value={<Link href={eirPath(e.direction, e.replacesGateTransactionId)} className="gecko-link">the voided EIR</Link>} />
          )}
          {e.remarks && <Line label="Remarks" value={e.remarks} />}
          <Line label="Customs permit" value={e.customsPermitNo ?? '—'} />
          <Line label="Paperless code" value={e.paperlessCode ?? '—'} />
          <Line label="Next location" value={e.nextLocationCode ?? '—'} />
          </Facts>
        
        </Section>

        <Section title="The box">
          <Facts>
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
          </Facts>

          {/* The seals belong with the box they are on, not in a card of their
              own two rows further down. */}
          <div className="gecko-eir-seals">
            <div className="gecko-stat-label gecko-mb-1">Seals ({e.seals.length})</div>
            {e.seals.length === 0 ? <div className="gecko-cell-meta">No seal recorded.</div> : (
              <table className="gecko-table gecko-table-compact">
                <thead><tr><th>Seal</th><th>Type</th><th>Intact</th><th>Matches</th></tr></thead>
                <tbody>
                  {e.seals.map(sl => (
                    <tr key={sl.sealNo}>
                      <td className="gecko-mono">{sl.sealNo}</td>
                      <td>{sl.sealType.toLowerCase()}</td>
                      <td>{sl.isIntact ? 'yes' : <span className="gecko-badge gecko-badge-xs gecko-badge-warning">broken</span>}</td>
                      <td>{sl.matchesDeclared == null ? '—' : sl.matchesDeclared ? 'yes' : <span className="gecko-badge gecko-badge-xs gecko-badge-warning">no</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
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
          {/* `Line` is a <tr>. These two were inside a <div>, which is invalid
              HTML and threw a hydration error on every visit to this page —
              "<tr> cannot be a child of <div>". They belong in a table like
              every other fact on the card. */}
          <Facts>
            <Line label="Paid at the window" value={formatBaht(charges.data.paidNow.total)} />
            <Line label="Billed later" value={formatBaht(charges.data.billedLater.total)} />
          </Facts>
        </Section>
      )}

      <Section title="Overrides and cut-off">
          <Facts>
        <Line label="Cut-off applied" value={e.cutoffKindApplied ? `${e.cutoffKindApplied} · ${formatDateTime(e.cutoffAtApplied)}` : '—'} />
        <Line label="Late override" value={e.lateOverrideReason ?? '—'} />
        <Line label="Check-digit override" value={e.checkDigitOverrideReason ?? '—'} />
        <Line label="Paid by coupon" value={e.gateAuthorizationId ? 'yes' : '—'} />
          </Facts>
        
      </Section>

      {/* HIDDEN on the owner's call (2026-10-08): Survey, Photos and scans,
          and Holds on this box. The reads that fed them are left in place above
          — they cost one call each and the day these come back it is this block
          that returns, not the plumbing. Restore from
          docs/snapshots/eir-detail.three-column-2026-10-08.tsx */}

      {amending && e && visit.data && (
        <AmendTruckModal eir={e} visit={visit.data}
          onClose={() => setAmending(false)}
          onSaved={() => { setAmending(false); visit.reload(); eir.reload(); }} />
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
              <div className="gecko-alert-title">{general.title}</div>
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

/** A card. `action` puts a control on the title row — the truck's Edit. */
function Section({ title, action, children }: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="gecko-card gecko-card-padded">
      <div className="gecko-row gecko-row-between gecko-mb-2">
        <div className="gecko-stat-label">{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

/**
 * One fact about the move.
 *
 * The value carried NO size class, so it inherited the page base and rendered
 * at roughly twice the app's own key-value size — a 20RF the size of a heading
 * next to a 10px label. It is on `gecko-kv-value` now, the same 13px every
 * other detail screen uses, so this page reads like the rest of Gecko.
 */
/**
 * The facts of a move, as a TABLE.
 *
 * They were label/value flex rows, which meant every card set its own column
 * width by eye and none of them lined up — and a label with no width of its own
 * sat straight against its value. A table column is one width for every row in
 * it, decided by the browser, and it is what the rest of Gecko already uses.
 */
function Facts({ children }: { children: React.ReactNode }) {
  return (
    <table className="gecko-table gecko-table-compact gecko-eir-facts">
      <tbody>{children}</tbody>
    </table>
  );
}

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <th scope="row" className="gecko-eir-fact-label">{label}</th>
      <td className="gecko-eir-fact-value">{value}</td>
    </tr>
  );
}
