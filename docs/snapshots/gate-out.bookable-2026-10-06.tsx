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
import { useTruckCategories } from '@/lib/api/lookups';
import {
  TOS_PERMISSIONS, preflightPath,
  type GateFinding, type GatePreflight, type GateTransaction,
} from '@/lib/api/tos';
import { GateField } from '../../_components/GateField';
import type { BookableBox } from '../../_components/BookingPicker';
import { TruckInYardPicker, type OpenVisit } from '../../_components/TruckInYardPicker';
import { OutTripFields } from './OutTripFields';
import {
  blankGateOut, blankGateOutTruck, gateOutIssues, gateOutToRequest, needsNomination, truckIssues,
  type GateOutDraft, type GateOutTruck,
} from './gate-out-draft';

/**
 * GATE OUT — one truck, every box leaving on it.
 *
 * TWO WAYS A TRUCK GETS HERE, and the difference shapes the screen:
 *
 *   ALREADY INSIDE — it came in, dropped something, and is now leaving. The
 *   clerk finds it in the yard and every fact about it is read off the visit.
 *   Each box joins that visit by `truckVisitId`.
 *
 *   ARRIVED EMPTY TO COLLECT — nothing was recorded on the way in, because a
 *   gate move needs a container and an empty truck has none. So there is no
 *   visit to find: the truck is keyed, and the FIRST box recorded opens one.
 *   This is the two-boxes-on-one-booking case, and it is why this screen takes
 *   several boxes rather than one.
 *
 * Each box is its own POST, first with `truck` and the rest with the visit id.
 * `/gate/trips` is deliberately NOT used here: it has no `truckVisitId`, so a
 * truck already in the yard would get a SECOND visit for one arrival
 * (docs/GATE_TRIPS_FINDINGS_FOR_API.md §3). Looping the single call costs
 * nothing — that endpoint is not atomic either — and keeps the yard honest.
 *
 */
export function GateOutForm() {
  const { can } = useSession();
  const { branch } = useFacility();
  const toast = useToast();
  const branchId = branch?.branchId ?? '';
  const mayRecord = can(TOS_PERMISSIONS.gateCreate);

  const [truck, setTruck] = useState<GateOutTruck>(blankGateOutTruck);
  const [rows, setRows] = useState<GateOutDraft[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [newTruck, setNewTruck] = useState(false);
  const [truckError, setTruckError] = useState<ApiError | null>(null);
  const [departed, setDeparted] = useState(false);
  const [departing, setDeparting] = useState(false);

  const { data: haulierRows } = useApiList<{ partyCode: string; nameEn: string }>(
    '/api/master/parties?role=HAULIER&pageSize=200');
  const hauliers = haulierRows ?? [];
  const { categories } = useTruckCategories();

  // A truck that is not in the yard is keyed; one that is has its facts read
  // off the visit.
  const keyedTruck = newTruck;
  const patchTruck = (p: Partial<GateOutTruck>) => setTruck(t => ({ ...t, ...p }));
  const patchRow = useCallback((key: string, p: Partial<GateOutDraft>) => {
    setRows(rs => rs.map(r => (r.key === key ? { ...r, ...p } : r)));
  }, []);

  const recorded = rows.filter(r => r.recorded);
  const visitId = truck.truckVisitId || recorded[0]?.recorded?.truckVisitId || '';
  const visitNo = truck.visitNo || recorded[0]?.recorded?.visitNo || '';
  const truckProblems = truckIssues(truck, keyedTruck);
  const truckReady = truckProblems.length === 0;
  const taken = rows.map(r => r.bookingContainerId).filter(Boolean);

  const pickTruck = (v: OpenVisit) => patchTruck({
    truckVisitId: v.truckVisitId,
    visitNo: v.visitNo,
    truckPlate: v.truckPlate,
    trailerPlate: v.trailerPlate ?? '',
    haulierCode: v.haulierCode ?? '',
    driverName: v.driverName ?? '',
    truckCategoryCode: v.truckCategoryCode ?? '',
  });

  const addBox = () => {
    const row = blankGateOut();
    setRows(rs => [...rs, row]);
    setOpenKey(row.key);
  };

  /** The box leaving, and everything its booking and the registry already know. */
  const pickBox = useCallback(async (key: string, box: BookableBox) => {
    patchRow(key, {
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
      bookedContainerNo: box.containerNo ?? '',
      movementCode: box.nextStep?.movementCode ?? '',
      fullEmpty: box.nextStep?.fullEmpty ?? null,
    });

    // The line's rowVersion, so the box that turns up can be keyed into it.
    try {
      const d = await apiGet<{ containers: { bookingContainerId: string; rowVersion: string }[] }>(
        `/api/tos/bookings/${box.bookingId}`);
      const l = d.containers.find(c => c.bookingContainerId === box.bookingContainerId);
      if (l) patchRow(key, { bookingContainerRowVersion: l.rowVersion });
    } catch { /* nomination will say so if it is missing */ }

    if (box.containerNo) {
      try {
        const c = await apiGet<{
          tareWeightKg: number | null; maxGrossKg: number | null;
          material: string | null; isoCode: string | null;
        }>(`/api/master/containers/${encodeURIComponent(box.containerNo)}`);
        patchRow(key, {
          tareWeightKg: c.tareWeightKg?.toString() ?? '',
          maxGrossWeightKg: c.maxGrossKg?.toString() ?? '',
          materialCode: c.material ?? '',
          isoCode: c.isoCode ?? '',
        });
      } catch { /* a box the registry has never seen is still allowed out */ }
    }

    try {
      const b = await apiGet<{ booking: {
        vesselCode: string | null; voyageIn: string | null; voyageOut: string | null;
        nextPrevLocation: string | null; paperlessCode: string | null;
      } }>(`/api/tos/bookings/${box.bookingId}`);
      patchRow(key, {
        vesselName: b.booking.vesselCode ?? '',
        voyageNo: b.booking.voyageOut ?? b.booking.voyageIn ?? '',
        nextLocationCode: b.booking.nextPrevLocation ?? '',
        paperlessCode: b.booking.paperlessCode ?? '',
      });
    } catch { /* display only */ }

    // What the barrier thinks of letting it out — §10's three refusals land
    // here. Skipped for a box with no number yet: nothing can be asked about a
    // container the server has not been told of, and Record nominates first.
    if (branchId && box.containerNo) {
      try {
        const answer = await apiGet<GatePreflight>(preflightPath({
          branchId, containerNo: box.containerNo, direction: 'OUT',
          truckVisitId: visitId || null,
          truckCategoryCode: truck.truckCategoryCode || null,
          haulierCode: truck.haulierCode || null,
        }));
        patchRow(key, { known: answer, findings: answer.findings ?? [] });
      } catch { patchRow(key, { known: null }); }
    }
  }, [branchId, patchRow, truck.haulierCode, truck.truckCategoryCode, visitId]);

  /**
   * Record one box. The first one carries the truck and opens the visit unless
   * the truck is already inside, in which case every box joins by id.
   */
  const record = useCallback(async (key: string) => {
    const row = rows.find(r => r.key === key);
    if (!branchId || !row || row.saving || row.recorded) return;
    patchRow(key, { saving: true, error: null });
    setTruckError(null);
    try {
      // The clerk keyed a box into a pending move: tell the booking first, so
      // the gate is asked about a container the server knows about.
      if (needsNomination(row)) {
        await apiSend('PUT',
          `/api/tos/bookings/${row.bookingId}/containers/${row.bookingContainerId}`,
          { rowVersion: row.bookingContainerRowVersion, containerNo: row.containerNo.trim().toUpperCase() });
        patchRow(key, { bookedContainerNo: row.containerNo.trim().toUpperCase() });
      }

      const written = await apiSend<GateTransaction>(
        'POST', '/api/tos/gate/transactions',
        gateOutToRequest(row, truck, branchId, visitId || null));
      patchRow(key, {
        saving: false, recorded: written, error: null,
        findings: written.findings ?? [],
      });
      if (!truck.truckVisitId) {
        patchTruck({ truckVisitId: written.truckVisitId, visitNo: written.visitNo });
      }
      setOpenKey(cur => (cur === key ? null : cur));
      toast.toast({ variant: 'success', title: written.eirNo, message: `${written.movementCode} recorded for ${written.containerNo}` });
    } catch (e) {
      const problem = e instanceof ApiError ? e : new ApiError(0, 'The gate-out could not be recorded.');
      const refused = problem.extension<GateFinding[]>('findings');
      patchRow(key, {
        saving: false, error: problem,
        findings: Array.isArray(refused) ? refused : row.findings,
      });
      if (problem.fieldErrors && Object.keys(problem.fieldErrors).some(f => f.startsWith('truck.'))) {
        setTruckError(problem);
      }
      setOpenKey(key);
    }
  }, [branchId, rows, patchRow, toast, truck, visitId]);

  /** Record every box that is ready, in order. */
  const recordAll = useCallback(async () => {
    for (const r of rows) {
      if (!r.recorded && gateOutIssues(r).length === 0) {
        // Sequential on purpose: the first opens the visit the rest join.
        await record(r.key);
      }
    }
  }, [rows, record]);

  /**
   * The truck has physically left. Recording the moves and closing the visit
   * are different facts — a truck can make several before it goes.
   */
  async function depart() {
    if (!visitId) return;
    setDeparting(true);
    try {
      await apiSend('POST', `/api/tos/gate/visits/${visitId}/depart`, {});
      setDeparted(true);
      toast.toast({ variant: 'success', title: 'Truck departed', message: visitNo });
    } catch (e) {
      setTruckError(e instanceof ApiError ? e : new ApiError(0, 'The visit could not be closed.'));
    } finally {
      setDeparting(false);
    }
  }

  const clear = () => {
    setTruck(blankGateOutTruck());
    setRows([]);
    setOpenKey(null);
    setNewTruck(false);
    setTruckError(null);
    setDeparted(false);
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

  const pending = rows.filter(r => !r.recorded);
  const readyCount = pending.filter(r => gateOutIssues(r).length === 0).length;

  return (
    <div className="gecko-stack gecko-stack-lg gecko-eirin-page">
      <div className="gecko-page-header">
        <div className="gecko-page-header-left">
          <h1 className="gecko-page-title">Gate Out</h1>
          <p className="gecko-page-subtitle">{branch?.displayName}</p>
        </div>
        <div className="gecko-page-header-right">
          {recorded.length > 0 && (
            <>
              <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => window.print()}>
                <Icon name="print" size={13} /> Print
              </button>
              {!departed && (
                <button className="gecko-btn gecko-btn-outline gecko-btn-sm" disabled={departing} onClick={depart}>
                  <Icon name="truck" size={13} /> {departing ? 'Closing…' : 'Truck has left'}
                </button>
              )}
              <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={clear}>
                <Icon name="plus" size={13} /> Next truck
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── 1 · the truck ───────────────────────────────────────────────── */}
      <div className="gecko-card gecko-card-padded gecko-stack">
        <div className="gecko-row gecko-row-between gecko-row-start">
          <div className="gecko-row gecko-gap-2h">
            <div className="gecko-step-badge">1</div>
            <div className="gecko-card-title">Truck information</div>
          </div>
          {visitNo && (
            <div className="gecko-visit-chip">
              <Icon name="truck" size={13} />
              <span className="gecko-text-mono">{visitNo}</span>
              {departed && <span className="gecko-visit-chip-mode">departed</span>}
            </div>
          )}
        </div>

        <label className="gecko-row gecko-gap-1 gecko-gate-toggle">
          <input type="checkbox" className="gecko-checkbox" checked={newTruck}
            disabled={rows.length > 0}
            onChange={e => { setNewTruck(e.target.checked); patchTruck(blankGateOutTruck()); }} />
          <span>Truck is not in the yard</span>
        </label>

        <div className="gecko-gate-truck-grid">
          <GateField label="Registration no." required error={truckError?.forField('truck.plate')}>
            {keyedTruck ? (
              <input className="gecko-input gecko-text-mono" value={truck.truckPlate} maxLength={20}
                disabled={recorded.length > 0}
                onChange={e => patchTruck({ truckPlate: e.target.value.toUpperCase() })} />
            ) : (
              <TruckInYardPicker branchId={branchId} value={truck.truckPlate}
                disabled={recorded.length > 0}
                onPick={pickTruck}
                onClear={() => patchTruck(blankGateOutTruck())} />
            )}
          </GateField>

          <GateField label="Haulier" required={keyedTruck} frozen={!keyedTruck}
            error={truckError?.forField('truck.haulierCode')}>
            {keyedTruck ? (
              <select className="gecko-input" value={truck.haulierCode} disabled={recorded.length > 0}
                onChange={e => patchTruck({ haulierCode: e.target.value })}>
                <option value="">Choose…</option>
                {hauliers.map(h => <option key={h.partyCode} value={h.partyCode}>{h.partyCode} - {h.nameEn}</option>)}
              </select>
            ) : (
              <div className="gecko-readonly-value gecko-text-mono">{truck.haulierCode || '—'}</div>
            )}
          </GateField>

          <GateField label="Truck category" frozen={!keyedTruck}
            error={truckError?.forField('truck.truckCategoryCode')}>
            {keyedTruck ? (
              <select className="gecko-input" value={truck.truckCategoryCode} disabled={recorded.length > 0}
                onChange={e => patchTruck({ truckCategoryCode: e.target.value })}>
                <option value="">Depot default</option>
                {categories.map(c => <option key={c.code} value={c.code}>{c.code} - {c.descriptionEn}</option>)}
              </select>
            ) : (
              <div className="gecko-readonly-value gecko-text-mono">{truck.truckCategoryCode || '—'}</div>
            )}
          </GateField>

          <GateField label="Driver" frozen={!keyedTruck}>
            {keyedTruck ? (
              <input className="gecko-input" value={truck.driverName} maxLength={100}
                disabled={recorded.length > 0}
                onChange={e => patchTruck({ driverName: e.target.value })} />
            ) : (
              <div className="gecko-readonly-value">{truck.driverName || '—'}</div>
            )}
          </GateField>
        </div>
      </div>

      {/* ── 2 · the boxes ───────────────────────────────────────────────── */}
      <div className="gecko-card gecko-card-padded gecko-stack">
        <div className="gecko-row gecko-row-between gecko-row-start">
          <div className="gecko-row gecko-gap-2h">
            <div className="gecko-step-badge">2</div>
            <div>
              <div className="gecko-card-title">Boxes leaving</div>
              {rows.length > 0 && (
                <div className="gecko-card-subtitle">
                  {rows.length} box{rows.length === 1 ? '' : 'es'} · {recorded.length} recorded
                </div>
              )}
            </div>
          </div>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm"
            disabled={!truckReady || departed} onClick={addBox}>
            <Icon name="plus" size={13} /> Add box
          </button>
        </div>

        {!truckReady && (
          <div className="gecko-cell-meta">
            {keyedTruck ? 'Key the truck first.' : 'Find the truck in the yard first.'}
          </div>
        )}

        {truckReady && rows.length === 0 && (
          <div className="gecko-dash-placeholder">Nothing leaving on this truck yet.</div>
        )}

        <div className="gecko-stack-sm">
          {rows.map((r, i) => {
            const issues = gateOutIssues(r);
            const done = !!r.recorded;
            const open = openKey === r.key;
            const blocked = r.findings.filter(f => f.severity === 'BLOCK');
            return (
              <div key={r.key}
                className={`gecko-move-card${done ? ' gecko-move-card-done' : ''}${open ? ' gecko-move-card-open' : ''}`}>
                <div className="gecko-move-head">
                  <button type="button" className="gecko-move-toggle"
                    aria-expanded={open} aria-label={open ? 'Collapse this box' : 'Expand this box'}
                    onClick={() => setOpenKey(k => (k === r.key ? null : r.key))}>
                    <Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} />
                  </button>
                  <span className="gecko-move-kind gecko-move-kind-out">
                    <Icon name="arrowUp" size={12} /> Pick-up
                  </span>
                  <span className="gecko-text-mono gecko-move-box">{r.containerNo || '(no box yet)'}</span>
                  <div className="gecko-move-spacer" />
                  {done ? (
                    <span className="gecko-move-eir">
                      <Icon name="shieldCheck" size={13} />
                      <Link href={`/gate/eir-out/${r.recorded!.gateTransactionId}`}
                        className="gecko-link gecko-text-mono">{r.recorded!.eirNo}</Link>
                    </span>
                  ) : (
                    <div className="gecko-row gecko-gap-1">
                      <span className={`gecko-move-ready${issues.length ? ' gecko-move-ready-no' : ''}`}>
                        {issues.length ? `${issues.length} to fill` : 'Ready'}
                      </span>
                      <button type="button" className="gecko-btn gecko-btn-primary gecko-btn-sm"
                        disabled={r.saving || issues.length > 0 || blocked.length > 0 || !truckReady}
                        onClick={() => record(r.key)}>
                        {r.saving ? 'Recording…' : 'Record'}
                      </button>
                      <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon"
                        aria-label={`Remove box ${i + 1}`} disabled={r.saving}
                        onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))}>
                        <Icon name="trash" size={13} />
                      </button>
                    </div>
                  )}
                </div>

                {(r.orderNo || r.findings.length > 0 || r.error) && (
                  <div className="gecko-move-facts">
                    {r.orderNo && (
                      <span className="gecko-move-fact">
                        <Link href={`/bookings/${r.bookingId}`} className="gecko-link gecko-text-mono">
                          {r.carrierRef || r.orderNo}
                        </Link>
                        {r.movementCode ? ` · ${r.movementCode}` : ''}
                        {r.fullEmpty ? ` · ${r.fullEmpty}` : ''}
                      </span>
                    )}
                  </div>
                )}

                {(r.findings.length > 0 || r.error) && (
                  <div className="gecko-move-notes">
                    {r.error && !r.error.fieldErrors && (
                      <div className="gecko-eirin-finding gecko-eirin-finding-block">
                        <Icon name="alertCircle" size={13} /> <span>{r.error.message}</span>
                      </div>
                    )}
                    {r.findings.map((f, j) => (
                      <div key={`${f.code}-${j}`}
                        className={`gecko-eirin-finding gecko-eirin-finding-${f.severity === 'BLOCK' ? 'block' : f.severity === 'INFO' ? 'info' : 'override'}`}>
                        <Icon name={f.severity === 'INFO' ? 'info' : 'alertCircle'} size={13} />
                        <span>{f.message}</span>
                      </div>
                    ))}
                  </div>
                )}

                {open && (
                  <div className="gecko-move-body">
                    <OutTripFields
                      d={r}
                      branchId={branchId}
                      locked={done}
                      taken={taken.filter(t => t !== r.bookingContainerId)}
                      onChange={p => patchRow(r.key, p)}
                      onPick={box => void pickBox(r.key, box)}
                      err={f => r.error?.forField(f)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {readyCount > 1 && (
          <div className="gecko-row gecko-row-end">
            <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={recordAll}>
              <Icon name="check" size={13} /> Record all {readyCount}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
