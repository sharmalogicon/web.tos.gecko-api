"use client";
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { PartyPicker } from '@/components/ui/PartyPicker';
import { apiSend } from '@/lib/api/client';
import { ApiError } from '@/lib/api/problem';
import type { TruckVisit } from '@/lib/api/tos';
import { visitAmendPath, type EirDetail, type VisitAmendRequest } from '@/lib/api/gate-eir';

/**
 * AMEND THE TRUCK ON A RECORDED VISIT.
 *
 * The plate, the haulier, the driver and the number are the VISIT'S, not this
 * EIR's — one truck arrives once, however many boxes it carries. So the dialog
 * names the other EIRs that move with it rather than letting a clerk find out
 * afterwards.
 *
 * THE HAULIER IS A BILLING PARTY. Changing it after the window has taken money
 * is not a typo fix, and the hint says so; what the server does about an
 * invoice already issued is the server's call, not this screen's.
 *
 * A REASON IS REQUIRED. The API asked for one (2026-10-27) and it is right to:
 * this edits a document that has already been printed and possibly billed, so
 * it goes on the record the way a void does.
 */
export function AmendTruckModal({ eir, visit, onClose, onSaved }: {
  eir: EirDetail;
  visit: TruckVisit;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [plate, setPlate] = useState(visit.truckPlate || eir.truckPlate || '');
  const [haulierCode, setHaulierCode] = useState(visit.haulierCode || '');
  const [driverName, setDriverName] = useState(visit.driverName || '');
  const [driverMobile, setDriverMobile] = useState(visit.driverMobile || '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiError | null>(null);

  const others = visit.transactions.filter(t => t.gateTransactionId !== eir.gateTransactionId);
  const was = {
    plate: visit.truckPlate || '',
    haulier: visit.haulierCode || '',
    driver: visit.driverName || '',
    mobile: visit.driverMobile || '',
  };
  const haulierChanged = haulierCode !== was.haulier;
  const changed = plate.trim() !== was.plate || haulierChanged
    || driverName.trim() !== was.driver || driverMobile.trim() !== was.mobile;

  const submit = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const body: VisitAmendRequest = {
        truckPlate: plate.trim().toUpperCase(),
        haulierCode: haulierCode || null,
        driverName: driverName.trim() || null,
        driverMobile: driverMobile.trim() || null,
        reason: reason.trim(),
      };
      // Only sent where the API answers one; see the note on TruckVisit.
      if (visit.rowVersion) body.rowVersion = visit.rowVersion;
      await apiSend('PATCH', visitAmendPath(visit.truckVisitId), body);
      toast.toast({
        variant: 'success',
        title: `${visit.visitNo} updated`,
        message: others.length > 0
          ? `The truck changed on this EIR and ${others.length} other${others.length === 1 ? '' : 's'} on the same visit.`
          : 'The truck details were changed.',
      });
      onSaved();
    } catch (e: unknown) {
      setFailure(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
    } finally {
      setBusy(false);
    }
  };

  const err = (field: string) => failure?.forField(field);
  const stale = failure?.status === 409;
  /**
   * 404 USED TO MEAN "not built yet". It does not any more — the endpoint
   * shipped on 2026-10-27, so a 404 is a visit that is no longer there, and
   * telling a clerk the API cannot do this would send them to the wrong person.
   */
  const gone = failure?.status === 404;
  const onAField = ['truckPlate', 'haulierCode', 'driverName', 'driverMobile', 'reason'].some(f => err(f));
  const general = failure && !onAField && !gone ? failure : null;

  return (
    <Modal isOpen onClose={onClose} title={`Edit the truck on ${visit.visitNo}`}
      subtitle="Who brought the box. The move, the box and the weights are not edited here."
      footer={
        <>
          <button className="gecko-btn gecko-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          {stale
            ? <button className="gecko-btn gecko-btn-primary" onClick={onSaved}>Reload the visit</button>
            : <button className="gecko-btn gecko-btn-primary" onClick={() => void submit()}
              disabled={busy || !changed || !plate.trim() || !reason.trim()}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>}
        </>
      }>
      <div className="gecko-stack gecko-gap-2h">

        {gone && (
          <div className="gecko-alert gecko-alert-warning">
            <Icon name="alertCircle" size={18} />
            <div>
              <div className="gecko-alert-title">This truck visit is no longer there.</div>
              <div>Nothing was changed. Close this and re-open the EIR.</div>
            </div>
          </div>
        )}

        {general && (
          <div className={`gecko-alert gecko-alert-${stale ? 'warning' : 'error'}`}>
            <Icon name="alertCircle" size={18} />
            <div>
              <div className="gecko-alert-title">{general.title}</div>
              {general.explanation && <div>{general.explanation}</div>}
            </div>
          </div>
        )}

        {/* Said before the edit, not after it. */}
        {others.length > 0 && (
          <div className="gecko-alert gecko-alert-info">
            <Icon name="info" size={18} />
            <div>
              These details belong to the truck visit, so {others.length} other EIR
              {others.length === 1 ? '' : 's'} on this truck change with it: {others.map(t => t.eirNo).join(', ')}.
            </div>
          </div>
        )}

        <div className="gecko-form-group">
          <label className="gecko-label gecko-label-required">Truck plate</label>
          <input className="gecko-input gecko-text-mono" value={plate} maxLength={20}
            onChange={ev => setPlate(ev.target.value.toUpperCase())} />
          {err('truckPlate') && <div className="gecko-field-error">{err('truckPlate')}</div>}
        </div>

        <div className="gecko-form-group">
          <label className="gecko-label">Transporter (haulier)</label>
          <PartyPicker role="HAULIER" value={haulierCode || null} nameFirst
            placeholder="Search haulier name or code…"
            onChange={code => setHaulierCode(code ?? '')} />
          {err('haulierCode') && <div className="gecko-field-error">{err('haulierCode')}</div>}
          {haulierChanged && (
            <div className="gecko-field-hint gecko-tone-warning">
              The haulier can be the party billed for this visit. Changing it does not move an
              invoice that has already been issued.
            </div>
          )}
        </div>

        <div className="gecko-form-group">
          <label className="gecko-label">Driver name</label>
          <input className="gecko-input" value={driverName} maxLength={100}
            onChange={ev => setDriverName(ev.target.value)} />
          {err('driverName') && <div className="gecko-field-error">{err('driverName')}</div>}
        </div>

        <div className="gecko-form-group">
          <label className="gecko-label">Mobile</label>
          <input className="gecko-input gecko-text-mono" value={driverMobile} maxLength={30} inputMode="tel"
            placeholder="08x-xxx-xxxx" onChange={ev => setDriverMobile(ev.target.value)} />
          {err('driverMobile') && <div className="gecko-field-error">{err('driverMobile')}</div>}
        </div>

        {/* LAST, and required: the clerk should have decided what to change
            before being asked to justify it. */}
        <div className="gecko-form-group">
          <label className="gecko-label gecko-label-required">Why</label>
          <textarea className="gecko-input gecko-textarea" rows={2} value={reason} maxLength={300}
            placeholder="Plate keyed wrong at the lane"
            onChange={ev => setReason(ev.target.value)} />
          <div className="gecko-field-hint">
            Goes on the record with the change, as a void&apos;s reason does.
          </div>
          {err('reason') && <div className="gecko-field-error">{err('reason')}</div>}
        </div>

      </div>
    </Modal>
  );
}
