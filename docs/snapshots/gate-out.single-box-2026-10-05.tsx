"use client";
import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { apiGet, apiSend } from '@/lib/api/client';
import { ApiError } from '@/lib/api/problem';
import { useFacility } from '@/lib/api/facility';
import { useSession } from '@/lib/auth/session';
import { useApiList } from '@/lib/api/use-api';
import { useConditions, useTruckCategories } from '@/lib/api/lookups';
import {
  TOS_PERMISSIONS, preflightPath,
  type GateFinding, type GatePreflight, type GateTransaction,
} from '@/lib/api/tos';
import { GateField } from '../../_components/GateField';
import { BookingPicker, type BookableBox } from '../../_components/BookingPicker';
import { TruckInYardPicker, type OpenVisit } from '../../_components/TruckInYardPicker';
import {
  blankGateOut, gateOutIssues, gateOutToRequest, grossOf, locationLabel,
  overMaxWeight, reeferEditable, type GateOutDraft,
} from './gate-out-draft';

/**
 * GATE OUT — one truck, one box, on its way out.
 *
 * Two ways in, and which one the clerk uses is the whole shape of the screen:
 *
 *   NORMAL — the truck is already inside. The clerk finds it in the yard, and
 *   everything about it is read off the visit. The move joins that visit by
 *   `truckVisitId`.
 *
 *   RELEASE LADEN TO PORT — a truck has just arrived to collect a full export
 *   box. There is no visit yet, so the truck is keyed and this move opens one.
 *   Vector forces pick-up / EXPORT / FULL here and turns on charging.
 *
 * The API needs no flag to tell them apart: contract §10 is explicit that
 * laden-to-port is the ordinary `FULL_OUT` step, with no new movement. What it
 * DOES enforce on any gate-out is §10's three refusals — a container whose fixed
 * ports exclude the booking's discharge port, a time earlier than the box's last
 * move, and a vessel call whose laden release is still in the future. Those come
 * back as BLOCK findings and are shown, not guessed at.
 */
export function GateOutForm() {
  const { can } = useSession();
  const { branch } = useFacility();
  const toast = useToast();
  const branchId = branch?.branchId ?? null;
  const mayRecord = can(TOS_PERMISSIONS.gateCreate);

  const [d, setD] = useState<GateOutDraft>(blankGateOut);
  const [ladenToPort, setLadenToPort] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState<GateTransaction | null>(null);
  const [departed, setDeparted] = useState(false);
  const [departing, setDeparting] = useState(false);

  const { data: haulierRows } = useApiList<{ partyCode: string; nameEn: string }>(
    '/api/master/parties?role=HAULIER&pageSize=200');
  const hauliers = haulierRows ?? [];
  const { categories } = useTruckCategories();
  const { conditions } = useConditions();

  const patch = (p: Partial<GateOutDraft>) => setD(cur => ({ ...cur, ...p }));
  const err = (f: string) => error?.forField(f);
  const issues = gateOutIssues(d, ladenToPort);
  const blocked = d.findings.filter(f => f.severity === 'BLOCK');
  const reefer = reeferEditable(d, ladenToPort);

  /** The truck standing in the yard. Its facts are the visit's, not retyped. */
  const pickTruck = (v: OpenVisit) => patch({
    truckVisitId: v.truckVisitId,
    visitNo: v.visitNo,
    truckPlate: v.truckPlate,
    trailerPlate: v.trailerPlate ?? '',
    haulierCode: v.haulierCode ?? '',
    driverName: v.driverName ?? '',
    truckCategoryCode: v.truckCategoryCode ?? '',
  });

  /** The box leaving, and everything its booking already knows about it. */
  const pickBox = useCallback(async (box: BookableBox) => {
    patch({
      bookingContainerId: box.bookingContainerId,
      bookingId: box.bookingId,
      orderNo: box.orderNo,
      carrierRef: box.carrierRef ?? '',
      orderTypeCode: box.orderTypeCode,
      bookingTypeCode: box.bookingTypeCode,
      customerCode: box.customerCode ?? '',
      agentCode: box.agentCode ?? '',
      equipmentTypeCode: box.equipmentTypeCode ?? '',
      containerNo: box.containerNo ?? '',
      movementCode: box.nextStep?.movementCode ?? '',
      fullEmpty: box.nextStep?.fullEmpty ?? null,
    });

    // The registry knows the box's own weights; the booking knows its voyage.
    try {
      const c = await apiGet<{ tareWeightKg: number | null; maxGrossKg: number | null;
        material: string | null; isoCode: string | null; status: string | null }>(
        `/api/master/containers/${encodeURIComponent(box.containerNo ?? '')}`);
      patch({
        tareWeightKg: c.tareWeightKg?.toString() ?? '',
        maxGrossWeightKg: c.maxGrossKg?.toString() ?? '',
        materialCode: c.material ?? '',
        isoCode: c.isoCode ?? '',
      });
    } catch { /* a box the registry has never seen is still allowed out */ }

    try {
      const b = await apiGet<{ booking: { vesselCode: string | null; voyageIn: string | null;
        voyageOut: string | null; nextPrevLocation: string | null; paperlessCode: string | null } }>(
        `/api/tos/bookings/${box.bookingId}`);
      patch({
        vesselName: b.booking.vesselCode ?? '',
        voyageNo: b.booking.voyageOut ?? b.booking.voyageIn ?? '',
        nextLocationCode: b.booking.nextPrevLocation ?? '',
        paperlessCode: b.booking.paperlessCode ?? '',
      });
    } catch { /* display only */ }

    // What the barrier thinks of letting it out — §10's three refusals land here.
    if (branchId && box.containerNo) {
      try {
        const answer = await apiGet<GatePreflight>(preflightPath({
          branchId, containerNo: box.containerNo, direction: 'OUT',
          truckVisitId: d.truckVisitId || null,
          truckCategoryCode: d.truckCategoryCode || null,
          haulierCode: d.haulierCode || null,
        }));
        patch({ known: answer, findings: answer.findings ?? [] });
      } catch { patch({ known: null }); }
    }
  }, [branchId, d.truckVisitId, d.truckCategoryCode, d.haulierCode]);

  async function save() {
    if (!branchId) return;
    setSaving(true);
    setError(null);
    try {
      const written = await apiSend<GateTransaction>(
        'POST', '/api/tos/gate/transactions', gateOutToRequest(d, branchId, ladenToPort));
      setDone(written);
      patch({ findings: written.findings ?? [] });
      toast.toast({ variant: 'success', title: written.eirNo, message: `${written.movementCode} recorded for ${written.containerNo}` });
    } catch (e) {
      const problem = e instanceof ApiError ? e : new ApiError(0, 'The gate-out could not be recorded.');
      setError(problem);
      const refused = problem.extension<GateFinding[]>('findings');
      if (Array.isArray(refused)) patch({ findings: refused });
    } finally {
      setSaving(false);
    }
  }

  /**
   * The truck has physically left. Recording the move and closing the visit are
   * two different facts — a truck can make several moves before it goes — so
   * this is a separate action and not a side effect of Save.
   */
  async function depart() {
    const visitId = done?.truckVisitId;
    if (!visitId) return;
    setDeparting(true);
    try {
      await apiSend('POST', `/api/tos/gate/visits/${visitId}/depart`, {});
      setDeparted(true);
      toast.toast({ variant: 'success', title: 'Truck departed', message: done!.visitNo });
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'The visit could not be closed.'));
    } finally {
      setDeparting(false);
    }
  }

  const clear = () => {
    setD(blankGateOut());
    setDone(null);
    setDeparted(false);
    setError(null);
    setLadenToPort(false);
  };

  if (!branchId) {
    return <div className="gecko-card gecko-card-padded gecko-dash-placeholder">
      No depot is assigned to this account.
    </div>;
  }
  if (!mayRecord) {
    return <div className="gecko-card gecko-card-padded gecko-dash-placeholder">
      You do not have permission to record gate moves at this depot.
    </div>;
  }

  return (
    <div className="gecko-stack gecko-stack-lg gecko-eirin-page">
      <div className="gecko-page-header">
        <div className="gecko-page-header-left">
          <h1 className="gecko-page-title">Gate Out</h1>
          <p className="gecko-page-subtitle">{branch?.displayName}</p>
        </div>
        <div className="gecko-page-header-right">
          {done && (
            <>
              <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => window.print()}>
                <Icon name="print" size={13} /> Print
              </button>
              <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={clear}>
                <Icon name="plus" size={13} /> Next truck
              </button>
            </>
          )}
        </div>
      </div>

      {done && (
        <div className="gecko-card gecko-card-padded gecko-eirin-done">
          <Icon name="shieldCheck" size={18} />
          <div>
            <div className="gecko-eirin-done-title">
              <Link href={`/gate/eir-out/${done.gateTransactionId}`} className="gecko-link">{done.eirNo}</Link>
            </div>
            <div className="gecko-cell-meta">
              {done.movementCode} · {done.containerNo} · {done.visitNo}
              {departed ? ' · truck departed' : ''}
            </div>
          </div>
          {!departed && (
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm gecko-ml-auto"
              disabled={departing} onClick={depart}>
              <Icon name="truck" size={13} /> {departing ? 'Closing…' : 'Truck has left'}
            </button>
          )}
        </div>
      )}

      {/* ── 1 · the truck ───────────────────────────────────────────────── */}
      <div className="gecko-card gecko-card-padded gecko-stack">
        <div className="gecko-row gecko-gap-2h">
          <div className="gecko-step-badge">1</div>
          <div className="gecko-card-title">Truck information</div>
        </div>

        <label className="gecko-row gecko-gap-1 gecko-laden-toggle">
          <input type="checkbox" className="gecko-checkbox" checked={ladenToPort} disabled={!!done}
            onChange={e => { setLadenToPort(e.target.checked); patch({ truckVisitId: '', visitNo: '', truckPlate: '' }); }} />
          <span>Release laden to port</span>
        </label>

        <div className="gecko-gate-truck-grid">
          <GateField label="Registration no." required error={err('truck.plate')}>
            {ladenToPort ? (
              <input className="gecko-input gecko-text-mono" value={d.truckPlate} maxLength={20} disabled={!!done}
                onChange={e => patch({ truckPlate: e.target.value.toUpperCase() })} />
            ) : (
              <TruckInYardPicker branchId={branchId} value={d.truckPlate} disabled={!!done}
                onPick={pickTruck}
                onClear={() => patch({ truckVisitId: '', visitNo: '', truckPlate: '', haulierCode: '', truckCategoryCode: '', driverName: '', trailerPlate: '' })} />
            )}
          </GateField>

          <GateField label="Haulier" required={ladenToPort} error={err('truck.haulierCode')}
            frozen={!ladenToPort}>
            {ladenToPort ? (
              <select className="gecko-input" value={d.haulierCode} disabled={!!done}
                onChange={e => patch({ haulierCode: e.target.value })}>
                <option value="">Choose…</option>
                {hauliers.map(h => <option key={h.partyCode} value={h.partyCode}>{h.partyCode} - {h.nameEn}</option>)}
              </select>
            ) : (
              <div className="gecko-readonly-value gecko-text-mono">{d.haulierCode || '—'}</div>
            )}
          </GateField>

          <GateField label="Truck category" error={err('truck.truckCategoryCode')} frozen={!ladenToPort}>
            {ladenToPort ? (
              <select className="gecko-input" value={d.truckCategoryCode} disabled={!!done}
                onChange={e => patch({ truckCategoryCode: e.target.value })}>
                <option value="">Depot default</option>
                {categories.map(c => <option key={c.code} value={c.code}>{c.code} - {c.descriptionEn}</option>)}
              </select>
            ) : (
              <div className="gecko-readonly-value gecko-text-mono">{d.truckCategoryCode || '—'}</div>
            )}
          </GateField>

          <GateField label="Current EIR no." frozen>
            <div className="gecko-readonly-value gecko-text-mono">{done?.eirNo || d.visitNo || '—'}</div>
          </GateField>
        </div>
      </div>

      {/* ── 2 · the trip ────────────────────────────────────────────────── */}
      <div className="gecko-card gecko-card-padded gecko-stack">
        <div className="gecko-row gecko-gap-2h">
          <div className="gecko-step-badge">2</div>
          <div className="gecko-card-title">Trip information</div>
        </div>

        {blocked.length > 0 && (
          <div className="gecko-stack-sm">
            {blocked.map((f, i) => (
              <div key={`${f.code}-${i}`} className="gecko-eirin-finding gecko-eirin-finding-block">
                <Icon name="alertCircle" size={13} /> <span>{f.message}</span>
              </div>
            ))}
          </div>
        )}
        {d.findings.filter(f => f.severity !== 'BLOCK').map((f, i) => (
          <div key={`${f.code}-${i}`} className={`gecko-eirin-finding gecko-eirin-finding-${f.severity === 'INFO' ? 'info' : 'override'}`}>
            <Icon name={f.severity === 'INFO' ? 'info' : 'alertCircle'} size={13} /> <span>{f.message}</span>
          </div>
        ))}

        <div className="gecko-trip-grid">
          <div className="gecko-trip-col">
            <GateField label="Trip type" frozen>
              <div className="gecko-readonly-value">Pick-up cont</div>
            </GateField>

            <GateField label="Booking - B/L no." required error={err('bookingContainerId')}>
              <BookingPicker branchId={branchId} direction="OUT" exclude={[]} disabled={!!done}
                value={d.carrierRef || d.orderNo}
                onPick={box => void pickBox(box)}
                onClear={() => patch({
                  bookingContainerId: '', bookingId: '', orderNo: '', carrierRef: '', containerNo: '',
                  orderTypeCode: '', bookingTypeCode: '', movementCode: '', fullEmpty: null,
                  known: null, findings: [],
                })} />
            </GateField>

            <GateField label="Customer" frozen>
              <div className="gecko-readonly-value gecko-text-mono">{d.customerCode || '—'}</div>
            </GateField>

            <GateField label="Container no." required error={err('containerNo')}>
              <input className="gecko-input gecko-text-mono" value={d.containerNo} maxLength={14} disabled={!!done}
                onChange={e => patch({ containerNo: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />
            </GateField>

            <GateField label="Container class" error={err('gradeCode')}>
              <input className="gecko-input gecko-text-mono" value={d.gradeCode} maxLength={10} disabled={!!done}
                placeholder="NONE" onChange={e => patch({ gradeCode: e.target.value.toUpperCase() })} />
            </GateField>

            <GateField label="Temperature °C" error={err('temperatureC')} frozen={!reefer}>
              <input className="gecko-input" type="number" step="0.1" min={-70} max={40}
                value={d.temperatureC} disabled={!reefer || !!done}
                onChange={e => patch({ temperatureC: e.target.value })} />
            </GateField>

            <GateField label="Vent" error={err('ventSetting')} frozen={!reefer}>
              <input className="gecko-input" maxLength={20} value={d.ventSetting} disabled={!reefer || !!done}
                onChange={e => patch({ ventSetting: e.target.value })} />
            </GateField>

            <GateField label="Humidity %" error={err('humidityPct')} frozen={!reefer}>
              <input className="gecko-input" type="number" min={0} max={100} value={d.humidityPct}
                disabled={!reefer || !!done} onChange={e => patch({ humidityPct: e.target.value })} />
            </GateField>

            <GateField label="Seal #1" error={err('seals')}>
              <input className="gecko-input gecko-text-mono" maxLength={20} value={d.sealNo1} disabled={!!done}
                onChange={e => patch({ sealNo1: e.target.value.toUpperCase() })} />
            </GateField>

            <GateField label="Seal #2">
              <input className="gecko-input gecko-text-mono" maxLength={20} value={d.sealNo2} disabled={!!done}
                aria-label="Seal 2" onChange={e => patch({ sealNo2: e.target.value.toUpperCase() })} />
            </GateField>

            <GateField label="Remarks" error={err('remarks')}>
              <textarea className="gecko-textarea gecko-input" rows={3} maxLength={300} value={d.remarks}
                disabled={!!done} onChange={e => patch({ remarks: e.target.value })} />
            </GateField>
          </div>

          <div className="gecko-trip-col">
            <GateField label="Empty / loaded" frozen>
              <div className="gecko-readonly-value">{d.fullEmpty ?? '—'}</div>
            </GateField>

            <GateField label="Agent" frozen>
              <div className="gecko-readonly-value gecko-text-mono">{d.agentCode || '—'}</div>
            </GateField>

            <GateField label="Size - type" frozen>
              <div className="gecko-readonly-value gecko-text-mono">{d.equipmentTypeCode || '—'}</div>
            </GateField>

            <GateField label="Status" error={err('conditionCode')}>
              <select className="gecko-input" value={d.conditionCode} disabled={!!done}
                onChange={e => patch({ conditionCode: e.target.value })}>
                <option value="">—</option>
                {conditions.map(c => (
                  <option key={c.conditionCode} value={c.conditionCode}>
                    {c.conditionCode} - {c.descriptionEn}
                  </option>
                ))}
              </select>
            </GateField>

            <GateField label="Material / height" error={err('materialCode')}>
              <div className="gecko-row gecko-gap-1">
                <input className="gecko-input gecko-text-mono" maxLength={20} value={d.materialCode}
                  placeholder="STL" aria-label="Material" disabled={!!done}
                  onChange={e => patch({ materialCode: e.target.value.toUpperCase() })} />
                <input className="gecko-input gecko-text-mono" value={d.heightCode} disabled
                  aria-label="Height" placeholder="8ft6" />
              </div>
            </GateField>

            <GateField label="Clip-on no." error={err('clipOnNo')} frozen={!reefer}>
              <input className="gecko-input gecko-text-mono" maxLength={20} value={d.clipOnNo}
                disabled={!reefer || !!done} onChange={e => patch({ clipOnNo: e.target.value.toUpperCase() })} />
            </GateField>

            <GateField label="Customs permit no." error={err('customsPermitNo')}>
              <input className="gecko-input gecko-text-mono" maxLength={40} value={d.customsPermitNo}
                disabled={!!done} onChange={e => patch({ customsPermitNo: e.target.value.toUpperCase() })} />
            </GateField>

            <GateField label={locationLabel(d)} error={err('nextLocationCode')}>
              <input className="gecko-input gecko-text-mono" maxLength={20} value={d.nextLocationCode}
                disabled={!!done} onChange={e => patch({ nextLocationCode: e.target.value.toUpperCase() })} />
            </GateField>
          </div>

          <div className="gecko-trip-col">
            <GateField label="Booking type" frozen>
              <div className="gecko-readonly-value">{d.bookingTypeCode || '—'}</div>
            </GateField>

            <GateField label="Order type" frozen>
              <div className="gecko-readonly-value">{d.orderTypeCode || '—'}</div>
            </GateField>

            <GateField label="Vessel name" frozen>
              <div className="gecko-readonly-value">{d.vesselName || '—'}</div>
            </GateField>

            <GateField label="Voyage no." frozen>
              <div className="gecko-readonly-value gecko-text-mono">{d.voyageNo || '—'}</div>
            </GateField>

            <GateField label="Tare weight kg" error={err('tareWeightKg')}>
              <input className="gecko-input" type="number" min={0} value={d.tareWeightKg} disabled={!!done}
                onChange={e => patch({ tareWeightKg: e.target.value })} />
            </GateField>

            <GateField label="Max gross weight kg" error={err('maxGrossWeightKg')}>
              <input className="gecko-input" type="number" min={0} value={d.maxGrossWeightKg} disabled={!!done}
                onChange={e => patch({ maxGrossWeightKg: e.target.value })} />
            </GateField>

            <GateField label="Cargo weight kg" error={err('cargoWeightKg')} frozen={d.fullEmpty !== 'FULL'}>
              <input className="gecko-input" type="number" min={0} value={d.cargoWeightKg}
                disabled={d.fullEmpty !== 'FULL' || !!done}
                onChange={e => patch({ cargoWeightKg: e.target.value })} />
            </GateField>

            <GateField label="Gross weight kg" frozen>
              <div className={`gecko-readonly-value gecko-text-mono${overMaxWeight(d) ? ' gecko-tone-error' : ''}`}>
                {grossOf(d)?.toLocaleString() ?? '—'}
              </div>
            </GateField>

            <GateField label="VGM kg" error={err('vgmKg')}>
              <input className="gecko-input" type="number" min={0} value={d.vgmKg} disabled={!!done}
                onChange={e => patch({ vgmKg: e.target.value })} />
            </GateField>

            <GateField label="Genset no." error={err('gensetNo')}>
              <div className="gecko-row gecko-gap-1">
                <select className="gecko-input gecko-genset-mode" value={d.gensetMode} disabled={!!done}
                  aria-label="Genset fitted"
                  onChange={e => patch({
                    gensetMode: e.target.value as 'NO' | 'YES',
                    gensetNo: e.target.value === 'NO' ? '' : d.gensetNo,
                  })}>
                  <option value="NO">NO</option>
                  <option value="YES">YES</option>
                </select>
                <input className="gecko-input gecko-text-mono" maxLength={20} value={d.gensetNo}
                  disabled={d.gensetMode === 'NO' || !!done} aria-label="Genset number"
                  onChange={e => patch({ gensetNo: e.target.value.toUpperCase() })} />
              </div>
            </GateField>

            <GateField label="Paperless code" error={err('paperlessCode')}>
              <input className="gecko-input gecko-text-mono" maxLength={40} value={d.paperlessCode}
                disabled={!!done} onChange={e => patch({ paperlessCode: e.target.value.toUpperCase() })} />
            </GateField>
          </div>
        </div>

        {overMaxWeight(d) && (
          <div className="gecko-move-issues">
            <Icon name="alertCircle" size={13} />
            <span>
              Over max weight — tare + cargo is {grossOf(d)?.toLocaleString()} kg against a plate limit
              of {Number(d.maxGrossWeightKg).toLocaleString()} kg. It can still be recorded.
            </span>
          </div>
        )}

        {error && !error.fieldErrors && (
          <div role="alert" className="gecko-eirin-finding gecko-eirin-finding-block">
            <Icon name="alertCircle" size={13} /> <span>{error.message}</span>
          </div>
        )}

        {!done && (
          <div className="gecko-row gecko-row-between">
            <span className="gecko-cell-meta">
              {issues.length ? `Still to fill: ${issues.join(' · ')}` : ''}
            </span>
            <div className="gecko-row gecko-gap-2">
              <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={clear}>Clear</button>
              <button className="gecko-btn gecko-btn-primary gecko-btn-sm"
                disabled={saving || issues.length > 0 || blocked.length > 0}
                onClick={save}>
                <Icon name="check" size={13} /> {saving ? 'Saving…' : 'Save gate out'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
