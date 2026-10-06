"use client";
import React, { useCallback, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { apiGet, apiSend } from '@/lib/api/client';
import { ApiError } from '@/lib/api/problem';
import { useFacility } from '@/lib/api/facility';
import { useSession } from '@/lib/auth/session';
import {
  TOS_PERMISSIONS, preflightPath,
  type GateFinding, type GatePreflight, type GateTransaction,
} from '@/lib/api/tos';
import { TruckVisitCard } from './_components/TruckVisitCard';
import { MoveCard } from './_components/MoveCard';
import type { BookableBox } from '../_components/BookingPicker';
import { VisitSummaryRail } from './_components/VisitSummaryRail';
import {
  MODE_LABELS, blankMove, boxLooksRight, derivedMode, moveToRequest, needsNomination,
  normaliseBox, onBooking,
  type MoveDraft, type TruckDetails,
} from './_components/visit-moves';

/**
 * GATE IN — one truck visit, every box on it.
 *
 * This is the June 2026 design, bound to Gecko.Api. The layout is unchanged
 * where the API can stand behind it; the blocks it could not — appointments,
 * lanes, safety briefing, TEU capacity, the IICL damage grid — are gone rather
 * than greyed, and the reason is written at the component that dropped each
 * one. They belong to modules that do not exist yet (VBS Phase 4.5, M&R Phase
 * 6), and a disabled box for a module years out is clutter at a gate.
 *
 * HOW A VISIT IS BUILT, which is the one thing worth reading before changing
 * anything here:
 *
 *   1. The clerk keys the truck ONCE.
 *   2. Each box is added, looked up against preflight, and recorded on its own
 *      POST. There is no batch endpoint and there should not be: one box being
 *      refused for a hold must not throw away the two already keyed beside it.
 *   3. The FIRST box recorded carries `truck` and OPENS the visit. Every box
 *      after it carries `truckVisitId`. Sending `truck` twice opens a second
 *      visit for the same arrival.
 *   4. The visit's mode (drop-off / pick-up / both) is DERIVED by the server
 *      from the moves that stand. It is never sent. What is shown here is the
 *      same rule applied locally so the chip does not lag a round trip.
 *
 * KORAKIT has no barrier: in Vector 99.7% of their bookings are created at the
 * gate. So a box on no order does not stop anything — the gate raises a BLIND
 * GATE IN for it through `/api/tos/gate/blind-orders`, its own door for exactly
 * this. A PICK-UP is the exception, and has to be: there is nothing to release
 * that was never booked.
 */

export default function GateInPage() {
  const { can } = useSession();
  const { branch } = useFacility();
  const toast = useToast();
  const branchId = branch?.branchId ?? null;
  const mayRecord = can(TOS_PERMISSIONS.gateCreate);

  const [truck, setTruck] = useState<TruckDetails>({
    plate: '', trailerPlate: '', haulierCode: '', driverName: '',
    driverLicenceNo: '', driverMobile: '', truckCategoryCode: '',
  });

  const [moves, setMoves] = useState<MoveDraft[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);

  /** Set by the first recorded move. From then on every box joins this visit. */
  const [visit, setVisit] = useState<{ truckVisitId: string; visitNo: string } | null>(null);
  const [truckError, setTruckError] = useState<ApiError | null>(null);

  const patchMove = useCallback((key: string, patch: Partial<MoveDraft>) => {
    setMoves(rows => rows.map(m => (m.key === key ? { ...m, ...patch } : m)));
  }, []);

  /** Every box already on this truck — the picker must not offer one twice. */
  const takenBoxes = moves.map(m => m.bookingContainerId).filter(Boolean);

  /**
   * The clerk picked a box off a booking. This is the desktop's
   * `LoadBookingDetails`: one choice fills the whole trip block.
   */
  const pickBooking = useCallback(async (key: string, box: BookableBox) => {
    patchMove(key, {
      bookingContainerId: box.bookingContainerId,
      bookingId: box.bookingId,
      orderNo: box.orderNo,
      carrierRef: box.carrierRef ?? '',
      orderTypeCode: box.orderTypeCode,
      bookingTypeCode: box.bookingTypeCode,
      lineCode: box.lineCode,
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
      const line = d.containers.find(c => c.bookingContainerId === box.bookingContainerId);
      if (line) patchMove(key, { bookingContainerRowVersion: line.rowVersion });
    } catch { /* nomination will say so if it is missing */ }

    // The vessel and the voyage belong to the booking header, which the
    // bookable-boxes row does not carry. One read fills them, and the clerk
    // never waits for it — the row is already usable.
    try {
      const d = await apiGet<{ booking: {
        vesselCode: string | null; voyageIn: string | null; voyageOut: string | null;
        nextPrevLocation: string | null; paperlessCode: string | null;
      } }>(`/api/tos/bookings/${box.bookingId}`);
      patchMove(key, {
        vesselName: d.booking.vesselCode ?? '',
        voyageNo: d.booking.voyageOut ?? d.booking.voyageIn ?? '',
        nextLocationCode: d.booking.nextPrevLocation ?? '',
        paperlessCode: d.booking.paperlessCode ?? '',
      });
    } catch {
      // Not fatal: they are display-only, and the move records without them.
    }
  }, [patchMove]);

  const addMove = (trip: MoveDraft['trip']) => {
    const row = blankMove(trip);
    setMoves(rows => [...rows, row]);
    setOpenKey(row.key);
  };

  /**
   * What the API already knows about this box. A read, never a gate: a BLOCKED
   * answer here usually means nothing more than "no order yet", which is what
   * this screen exists to fix. The POST is the call that decides.
   */
  const look = useCallback(async (key: string) => {
    const row = moves.find(m => m.key === key);
    if (!branchId || !row || !boxLooksRight(row.containerNo)) return;
    // A number keyed into a pending move has not been nominated yet, so the
    // server has never heard of it. Asking preflight about it would only ever
    // answer NO_ASSIGNMENT — about a box that IS on a booking. Record does the
    // nomination first and preflights after.
    if (needsNomination(row)) return;
    patchMove(key, { looking: true });
    try {
      const answer = await apiGet<GatePreflight>(preflightPath({
        branchId,
        containerNo: normaliseBox(row.containerNo),
        direction: row.trip === 'DROP_OFF_CONT' ? 'IN' : 'OUT',
        truckVisitId: visit?.truckVisitId ?? null,
        truckCategoryCode: truck.truckCategoryCode || null,
        haulierCode: truck.haulierCode || null,
      }));
      // NO_ASSIGNMENT is the ordinary case at a depot with no barrier. Showing
      // it in red would tell the clerk the box is refused while this very
      // screen is about to admit it.
      const findings = (answer.findings ?? []).filter(f => f.code !== 'NO_ASSIGNMENT');
      const prefill: Partial<MoveDraft> = { known: answer, looking: false, findings };
      if (answer.booking) {
        prefill.orderTypeCode = answer.booking.orderTypeCode;
        prefill.lineCode = answer.booking.lineCode;
        prefill.customerCode = answer.booking.customerCode ?? '';
        if (answer.booking.equipmentTypeCode) prefill.equipmentTypeCode = answer.booking.equipmentTypeCode;
        if (answer.booking.declaredSealNo && !row.seals.some(s => s.sealNo.trim())) {
          prefill.seals = [{ sealNo: answer.booking.declaredSealNo, sealType: 'LINE', isIntact: true }];
        }
      }
      patchMove(key, prefill);
    } catch {
      // A failed lookup must not stop the clerk writing the box down.
      patchMove(key, { looking: false, known: null });
    }
  }, [branchId, moves, patchMove, truck.haulierCode, truck.truckCategoryCode, visit]);

  /**
   * Record ONE box. The order is raised first when there is none, because the
   * gate POST refuses a container that is on no booking — not for a barrier's
   * sake, but because an EIR with no order behind it cannot be billed,
   * released or explained.
   */
  const record = useCallback(async (key: string) => {
    const row = moves.find(m => m.key === key);
    if (!branchId || !row || row.saving || row.recorded) return;
    patchMove(key, { saving: true, error: null });
    setTruckError(null);
    const box = normaliseBox(row.containerNo);

    try {
      // The BLIND GATE IN, through the gate's own door. The booking page
      // refuses this order type by hand — "the gate makes those" — and this is
      // the gate making it. No B/L is sent: a blind gate-in is precisely the
      // case where the driver has none.
      if (!onBooking(row) && row.trip === 'DROP_OFF_CONT') {
        await apiSend('POST', '/api/tos/gate/blind-orders', {
          branchId,
          containerNo: box,
          lineCode: row.lineCode,
          customerCode: row.customerCode,
          equipmentTypeCode: row.equipmentTypeCode || null,
          agentCode: row.agentCode || null,
          haulierCode: truck.haulierCode || null,
          remarks: row.remarks || null,
        });
      }

      // The clerk keyed a box into a pending move: tell the booking first, so
      // the gate is asked about a container the server knows about.
      if (needsNomination(row)) {
        await apiSend('PUT',
          `/api/tos/bookings/${row.bookingId}/containers/${row.bookingContainerId}`,
          { rowVersion: row.bookingContainerRowVersion, containerNo: box });
        patchMove(key, { bookedContainerNo: box });
      }

      const written = await apiSend<GateTransaction>(
        'POST', '/api/tos/gate/transactions',
        moveToRequest(row, branchId, truck, visit?.truckVisitId ?? null),
      );

      // The first box through opens the visit; the rest join it.
      if (!visit) setVisit({ truckVisitId: written.truckVisitId, visitNo: written.visitNo });

      patchMove(key, {
        saving: false,
        recorded: written,
        error: null,
        // Not stored anywhere: if these are not shown now they are gone.
        findings: written.findings ?? [],
      });
      setOpenKey(current => (current === key ? null : current));
      toast.toast({ variant: 'success', title: written.eirNo, message: `${written.movementCode} recorded for ${written.containerNo}` });
    } catch (e) {
      const problem = e instanceof ApiError ? e : new ApiError(0, 'The move could not be recorded.');
      // A 409 carries the findings — that is what turns "refused" into
      // something the clerk can act on, and reveals the override boxes.
      const refused = problem.extension<GateFinding[]>('findings');
      patchMove(key, {
        saving: false,
        error: problem,
        // NO_ASSIGNMENT is filtered on the way in and on the way out alike: at a
        // depot with no barrier the gate raises the order, so telling the clerk
        // the box is "not on an open booking" describes a problem this very
        // screen is about to solve.
        findings: Array.isArray(refused)
          ? refused.filter(f => f.code !== 'NO_ASSIGNMENT')
          : row.findings,
      });
      // A 400 on truck.* belongs on the truck card, not buried in a box row.
      if (problem.fieldErrors && Object.keys(problem.fieldErrors).some(f => f.startsWith('truck.'))) {
        setTruckError(problem);
      }
      setOpenKey(key);
    }
  }, [branchId, moves, patchMove, toast, truck, visit]);

  const startAnother = () => {
    setMoves([]);
    setVisit(null);
    setOpenKey(null);
    setTruckError(null);
    setTruck({
      plate: '', trailerPlate: '', haulierCode: '', driverName: '',
      driverLicenceNo: '', driverMobile: '', truckCategoryCode: '',
    });
  };

  const recordedCount = moves.filter(m => m.recorded).length;
  const truckReady = truck.plate.trim().length > 0;
  const mode = derivedMode(moves);

  return (
    <div className="gecko-stack gecko-stack-lg gecko-eirin-page">
      <div className="gecko-page-header">
        <div className="gecko-page-header-left">
          <h1 className="gecko-page-title">Gate In</h1>
          <p className="gecko-page-subtitle">{branch?.displayName}</p>
        </div>
        <div className="gecko-page-header-right">
          {recordedCount > 0 && (
            <>
              <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => window.print()}>
                <Icon name="print" size={13} /> Print gate pass
              </button>
              <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={startAnother}>
                <Icon name="plus" size={13} /> Next truck
              </button>
            </>
          )}
        </div>
      </div>

      {!branchId && (
        <div className="gecko-card gecko-card-padded gecko-dash-placeholder">
          No depot is assigned to this account, so a gate move cannot be recorded.
        </div>
      )}
      {branchId && !mayRecord && (
        <div className="gecko-card gecko-card-padded gecko-dash-placeholder">
          You do not have permission to record gate moves at this depot.
        </div>
      )}

      {branchId && mayRecord && (
        <div className="gecko-gate-visit-layout">
          <div className="gecko-stack gecko-stack-lg gecko-min-w-0">
            <TruckVisitCard
              truck={truck}
              onChange={patch => setTruck(t => ({ ...t, ...patch }))}
              locked={!!visit}
              visitNo={visit?.visitNo ?? null}
              modeLabel={MODE_LABELS[mode]}
              fieldError={f => truckError?.forField(f)}
            />

            <div className="gecko-card gecko-card-padded gecko-stack">
              <div className="gecko-row gecko-row-start gecko-row-between">
                <div className="gecko-row gecko-gap-2h">
                  <div className="gecko-step-badge">2</div>
                  <div>
                    <div className="gecko-card-title">Container moves</div>
                    {moves.length > 0 && (
                      <div className="gecko-card-subtitle">
                        {moves.length} box{moves.length === 1 ? '' : 'es'} · {recordedCount} recorded
                      </div>
                    )}
                  </div>
                </div>
                <div className="gecko-row gecko-gap-2">
                  <button className="gecko-btn gecko-btn-outline gecko-btn-sm"
                    disabled={!truckReady} onClick={() => addMove('DROP_OFF_CONT')}>
                    <Icon name="arrowDown" size={13} /> Add drop-off
                  </button>
                  <button className="gecko-btn gecko-btn-primary gecko-btn-sm"
                    disabled={!truckReady} onClick={() => addMove('PICK_UP_CONT')}>
                    <Icon name="arrowUp" size={13} /> Add pick-up
                  </button>
                </div>
              </div>

              {!truckReady && (
                <div className="gecko-cell-meta">Key the truck plate first.</div>
              )}

              {moves.length === 0 && truckReady && (
                <div className="gecko-dash-placeholder">Nothing on this truck yet.</div>
              )}

              <div className="gecko-stack-sm">
                {moves.map((m, i) => (
                  <MoveCard
                    key={m.key}
                    move={m}
                    index={i}
                    open={openKey === m.key}
                    branchId={branchId}
                    takenBoxes={takenBoxes}
                    onPickBooking={box => void pickBooking(m.key, box)}
                    canRecord={truckReady}
                    onToggle={() => setOpenKey(k => (k === m.key ? null : m.key))}
                    onChange={patch => patchMove(m.key, patch)}
                    onRemove={() => setMoves(rows => rows.filter(r => r.key !== m.key))}
                    onLook={() => look(m.key)}
                    onRecord={() => record(m.key)}
                  />
                ))}
              </div>
            </div>
          </div>

          <VisitSummaryRail
            moves={moves}
            truckVisitId={visit?.truckVisitId ?? null}
            visitNo={visit?.visitNo ?? null}
          />
        </div>
      )}

    </div>
  );
}
