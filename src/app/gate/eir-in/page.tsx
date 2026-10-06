"use client";
import React, { useCallback, useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { apiGet } from '@/lib/api/client';
import { ApiError } from '@/lib/api/problem';
import { useFacility } from '@/lib/api/facility';
import { useSession } from '@/lib/auth/session';
import {
  TOS_PERMISSIONS, preflightPath,
  type GateFinding, type GatePreflight,
} from '@/lib/api/tos';
import {
  overTruckLimit, reserveBox, saveTrip,
  type TripRefusalRow, type TripSaveResult, type VasOption,
} from '@/lib/api/gate-trips';
import { TruckVisitCard } from './_components/TruckVisitCard';
import { MoveCard } from './_components/MoveCard';
import { GatePaymentPanel } from './_components/GatePaymentPanel';
import { TypeChangeDialog } from './_components/TypeChangeDialog';
import { SavedTripPanel } from './_components/SavedTripPanel';
import type { BookableBox } from '../_components/BookingPicker';
import {
  MODE_LABELS, blankMove, boxLooksRight, derivedMode, moveToTripRow, normaliseBox,
  type MoveDraft, type QuoteLineLike, type TruckDetails,
} from './_components/visit-moves';

/**
 * GATE IN — one truck, every box on it, one Save.
 *
 * RECORD DOES NOT COMMIT. It holds the place the box will fill and prices the
 * row. Nothing is written and no money is taken until Save, which puts the
 * whole truck through in a single call — so a truck can never end up half
 * gated, and a refused box can be fixed without unpicking the others.
 *
 * A PICK-UP IS ANNOUNCED HERE, NOT RELEASED (§25). Its money is taken now, no
 * EIR is written, and the row comes back PLANNED with a coupon. The box is held
 * for this truck for 24 hours and released at Gate Out against the same visit.
 * A truck that comes only to collect still gets its visit here.
 *
 * `POST /gate/transactions` is not called from this screen at all any more.
 */
export default function GateInPage() {
  const { can } = useSession();
  const { branch } = useFacility();
  const toast = useToast();
  const branchId = branch?.branchId ?? '';
  const mayRecord = can(TOS_PERMISSIONS.gateCreate);

  /** One draft per truck. It names the places this clerk is holding. */
  const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  const [truck, setTruck] = useState<TruckDetails>({
    plate: '', trailerPlate: '', haulierCode: '', driverName: '',
    driverLicenceNo: '', driverMobile: '', truckCategoryCode: '',
  });
  const [moves, setMoves] = useState<MoveDraft[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [visit, setVisit] = useState<{ truckVisitId: string; visitNo: string } | null>(null);
  const [result, setResult] = useState<TripSaveResult | null>(null);

  const [truckError, setTruckError] = useState<ApiError | null>(null);
  const [saveError, setSaveError] = useState<ApiError | null>(null);
  const [typeAsk, setTypeAsk] = useState<TripRefusalRow[] | null>(null);
  const [saving, setSaving] = useState(false);

  const [payerName, setPayerName] = useState('');
  const [wht, setWht] = useState(false);

  const patchMove = useCallback((key: string, patch: Partial<MoveDraft>) => {
    setMoves(rows => rows.map(m => (m.key === key ? { ...m, ...patch } : m)));
  }, []);

  const takenBoxes = moves.map(m => m.bookingContainerId).filter(Boolean);
  const truckReady = truck.plate.trim().length > 0;
  const pending = moves.filter(m => !m.result);

  // What the clerk owes, from the rows the quote priced.
  const cashTotal = pending.reduce((n, m) => n + m.quoteTotal, 0);
  const cashTax = pending.reduce((n, m) => n + m.quoteTax, 0);
  // Withholding is 3% of the amount before VAT; the customer pays the rest.
  const whtAmount = wht ? Math.round((cashTotal - cashTax) * 3) / 100 : 0;
  const nett = Math.round((cashTotal - whtAmount) * 100) / 100;

  const overLimit = overTruckLimit(moves.filter(m => m.trip === 'DROP_OFF_CONT').map(m => m.size))
    || overTruckLimit(moves.filter(m => m.trip === 'PICK_UP_CONT').map(m => m.size));

  const addMove = (trip: MoveDraft['trip']) => {
    const row = blankMove(trip);
    setMoves(rows => [...rows, row]);
    setOpenKey(row.key);
  };

  /**
   * What this row would cost, and what else could be sold on it.
   *
   * One call answers both: the quote returns the VAS menu for the box's next
   * movement, each item priced as if ticked (§23.2a), so the panel needs no
   * second request.
   */
  const priceRow = useCallback(async (key: string) => {
    const row = moves.find(m => m.key === key);
    if (!branchId || !row) return;
    const p = new URLSearchParams({ branchId });
    const add = (k: string, v: string) => { if (v.trim()) p.set(k, v.trim()); };
    add('orderTypeCode', row.orderTypeCode);
    add('lineCode', row.lineCode);
    add('customerCode', row.customerCode);
    add('agentCode', row.agentCode);
    add('equipmentTypeCode', row.equipmentTypeCode);
    add('containerNo', normaliseBox(row.containerNo));
    add('truckCategoryCode', truck.truckCategoryCode);
    add('haulierCode', truck.haulierCode);
    for (const v of row.vasTicked) p.append('vas', v);
    try {
      const q = await apiGet<{
        boxes: { due?: QuoteLineLike[]; billedLater?: QuoteLineLike[]; vasMenu?: VasOption[] }[];
        total?: number; tax?: number;
      }>(`/api/revenue/window/preview?${p}`);
      const box = q.boxes?.[0];
      patchMove(key, {
        due: box?.due ?? [],
        billedLater: box?.billedLater ?? [],
        vasMenu: box?.vasMenu ?? [],
        quoteTotal: q.total ?? 0,
        quoteTax: q.tax ?? 0,
      });
    } catch {
      // A price that cannot be read must not stop a box being keyed. The Save
      // is the call that decides what is owed.
      patchMove(key, { due: [], billedLater: [], vasMenu: [] });
    }
  }, [branchId, moves, patchMove, truck.haulierCode, truck.truckCategoryCode]);

  /** The clerk picked a place off a booking. One choice fills the row. */
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
      size: (box.equipmentTypeCode ?? '').slice(0, 2),
      type: (box.equipmentTypeCode ?? '').slice(2),
      reserved: false,
      placeMessage: null,
    });
    await priceRow(key);
  }, [patchMove, priceRow]);

  /**
   * What the barrier already thinks of the box. A read, never a gate.
   *
   * Skipped for a number keyed onto a booking place: the server has not been
   * told of it yet, so the only answer it could give is NO_ASSIGNMENT — about a
   * box that IS on a booking. Record holds the place and checks it properly.
   */
  const look = useCallback(async (key: string) => {
    const row = moves.find(m => m.key === key);
    if (!branchId || !row || !boxLooksRight(row.containerNo)) return;
    if (row.bookingContainerId) return;
    patchMove(key, { looking: true });
    try {
      const answer = await apiGet<GatePreflight>(preflightPath({
        branchId,
        containerNo: normaliseBox(row.containerNo),
        direction: row.trip === 'DROP_OFF_CONT' ? 'IN' : 'OUT',
        truckCategoryCode: truck.truckCategoryCode || null,
        haulierCode: truck.haulierCode || null,
      }));
      patchMove(key, {
        known: answer,
        looking: false,
        // NO_ASSIGNMENT is the ordinary case here: the gate raises the order.
        findings: (answer.findings ?? []).filter(f => f.code !== 'NO_ASSIGNMENT'),
      });
    } catch {
      patchMove(key, { looking: false, known: null });
    }
  }, [branchId, moves, patchMove, truck.haulierCode, truck.truckCategoryCode]);

  const toggleVas = useCallback(async (key: string, chargeCode: string) => {
    const row = moves.find(m => m.key === key);
    if (!row) return;
    patchMove(key, {
      vasTicked: row.vasTicked.includes(chargeCode)
        ? row.vasTicked.filter(c => c !== chargeCode)
        : [...row.vasTicked, chargeCode],
    });
    // Re-quote: the server moves the ticked item into `due` and prices it.
    await priceRow(key);
  }, [moves, patchMove, priceRow]);

  /**
   * RECORD — hold the place, price the row. Nothing is written.
   *
   * Sending the keyed number WITH the place does two jobs: it stops another
   * lane taking the place, and it checks the box against the yard rules now
   * rather than at Save, with the truck already at the barrier (§24.2).
   */
  const record = useCallback(async (key: string) => {
    const row = moves.find(m => m.key === key);
    if (!branchId || !row || row.saving || row.result) return;
    patchMove(key, { saving: true, error: null, placeMessage: null });
    setTruckError(null);
    try {
      if (row.bookingContainerId) {
        const held = await reserveBox({
          branchId, draftId,
          bookingContainerId: row.bookingContainerId,
          containerNo: normaliseBox(row.containerNo) || null,
        });
        patchMove(key, {
          // The server may hold a DIFFERENT place. Carrying on with the one we
          // asked for is how two trucks end up on one.
          bookingContainerId: held.bookingContainerId ?? row.bookingContainerId,
          placeMessage: held.switchedFromBookingContainerId ? held.message : null,
          findings: held.findings ?? [],
        });
      }
      await priceRow(key);
      patchMove(key, { saving: false, reserved: true });
      setOpenKey(cur => (cur === key ? null : cur));
    } catch (e) {
      const problem = e instanceof ApiError ? e : new ApiError(0, 'The place could not be held.');
      const code = problem.extension<string>('code');
      const refused = problem.extension<GateFinding[]>('findings');
      patchMove(key, {
        saving: false, reserved: false, error: problem,
        findings: Array.isArray(refused) ? refused.filter(f => f.code !== 'NO_ASSIGNMENT') : [],
      });
      // BOX_REFUSED carries the rules the box broke, shown on the row itself.
      // The others are one sentence the clerk acts on.
      if (code !== 'BOX_REFUSED') {
        toast.toast({ variant: 'danger', title: 'The place could not be held', message: problem.message });
      }
      setOpenKey(key);
    }
  }, [branchId, draftId, moves, patchMove, priceRow, toast]);

  /**
   * SAVE — the whole truck, in one call, with the money.
   *
   * Every row is read at the barrier before anything is taken: a refusal
   * anywhere refuses the Save entirely, nothing charged and nothing created
   * (§23.1). The Idempotency-Key is minted once per attempt and kept for its
   * retries, so a resend after a timeout returns the same EIRs rather than
   * gating the truck twice.
   */
  const save = useCallback(async (acceptTypeChange = false) => {
    if (!branchId || saving) return;
    const rows = moves.filter(m => !m.result);
    if (rows.length === 0) return;
    setSaving(true);
    setSaveError(null);
    setTypeAsk(null);

    // Agreeing to a type change is a new attempt, so it takes a new key.
    const key = acceptTypeChange || !idempotencyKey ? crypto.randomUUID() : idempotencyKey;
    setIdempotencyKey(key);

    try {
      const answer = await saveTrip({
        branchId, draftId,
        truck: {
          plate: truck.plate.trim().toUpperCase(),
          trailerPlate: truck.trailerPlate.trim() || null,
          driverName: truck.driverName.trim() || null,
          driverLicence: truck.driverLicenceNo.trim() || null,
          haulierCode: truck.haulierCode || null,
          truckCategoryCode: truck.truckCategoryCode || null,
        },
        rows: rows.map(m => moveToTripRow(acceptTypeChange ? { ...m, acceptTypeChange: true } : m, branchId)),
        vas: [...new Set(rows.flatMap(m => m.vasTicked))],
        payment: cashTotal > 0
          ? {
            // No name: the receipt goes to the first row's customer (§23.1).
            payer: { name: payerName.trim() || null, taxId: null, branchNo: null, address: null },
            payments: [{ channel: 'CASH', amount: nett }],
            expectedTotal: cashTotal,
            withholdingTax: wht,
          }
          : null,
      }, key);

      setResult(answer);
      if (answer.truckVisitId && answer.visitNo) {
        setVisit({ truckVisitId: answer.truckVisitId, visitNo: answer.visitNo });
      }
      setMoves(cur => cur.map(m => {
        const i = rows.findIndex(r => r.key === m.key);
        if (i < 0) return m;
        const got = answer.rows.find(r => r.index === i);
        return got
          ? {
            ...m, result: got, findings: got.findings ?? [], error: null,
            bookingContainerId: got.bookingContainerId || m.bookingContainerId,
          }
          : m;
      }));
      const gated = answer.rows.filter(r => r.status === 'GATED').length;
      const planned = answer.rows.filter(r => r.status === 'PLANNED').length;
      toast.toast({
        variant: 'success',
        title: answer.visitNo ?? 'Saved',
        message: [gated ? `${gated} gated in` : '', planned ? `${planned} planned for collection` : '']
          .filter(Boolean).join(' · ') || 'Saved.',
      });
    } catch (e) {
      const problem = e instanceof ApiError ? e : new ApiError(0, 'The truck could not be saved.');
      const code = problem.extension<string>('code');
      const refusedRows = problem.extension<TripRefusalRow[]>('rows') ?? [];

      // A box of another type than booked. On an IMPORT full drop-off the
      // booking can follow the box — but only if the clerk says so, because it
      // changes what the customer was quoted.
      if (code === 'TYPE_MISMATCH' && refusedRows.some(r => r.canChange)) {
        setTypeAsk(refusedRows.filter(r => r.canChange));
        setSaving(false);
        return;
      }

      setSaveError(problem);
      // Each refusal belongs on its own row, not in one banner the clerk has to
      // match against five boxes. Nothing was charged in any of these.
      setMoves(cur => cur.map(m => {
        const i = rows.findIndex(r => r.key === m.key);
        if (i < 0) return m;
        const got = refusedRows.find(r => r.index === i);
        return got ? { ...m, findings: got.findings ?? [], error: problem } : m;
      }));
    } finally {
      setSaving(false);
    }
  }, [branchId, cashTotal, draftId, idempotencyKey, moves, nett, payerName, saving, toast, truck, wht]);

  const startAnother = () => {
    setMoves([]); setVisit(null); setResult(null); setOpenKey(null);
    setTruckError(null); setSaveError(null); setTypeAsk(null);
    setIdempotencyKey(null); setDraftId(crypto.randomUUID());
    setPayerName(''); setWht(false);
    setTruck({
      plate: '', trailerPlate: '', haulierCode: '', driverName: '',
      driverLicenceNo: '', driverMobile: '', truckCategoryCode: '',
    });
  };

  const mode = derivedMode(moves);
  const readyToSave = useMemo(
    () => truckReady && pending.length > 0 && !overLimit
      && pending.every(m => m.reserved || !m.bookingContainerId),
    [truckReady, pending, overLimit]);

  if (!branchId) {
    return <div className="gecko-card gecko-card-padded gecko-dash-placeholder">
      No depot is assigned to this account, so a gate move cannot be recorded.
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
          <h1 className="gecko-page-title">Gate In</h1>
          <p className="gecko-page-subtitle">{branch?.displayName}</p>
        </div>
        <div className="gecko-page-header-right">
          {result && (
            <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={startAnother}>
              <Icon name="plus" size={13} /> Next truck
            </button>
          )}
        </div>
      </div>

      {result && <SavedTripPanel result={result} />}

      <div className="gecko-gate-visit-layout">
        <div className="gecko-stack gecko-stack-lg gecko-min-w-0">
          <TruckVisitCard
            truck={truck}
            onChange={patch => setTruck(t => ({ ...t, ...patch }))}
            locked={moves.length > 0 || !!result}
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
                      {moves.length} box{moves.length === 1 ? '' : 'es'}
                    </div>
                  )}
                </div>
              </div>
              <div className="gecko-row gecko-gap-2">
                {/* Two actions, not a choice. Styling one as primary made it
                    look already chosen, so a clerk could not tell which they
                    had pressed. Equal weight now, each tinted like the row it
                    adds — the button and its result agree. */}
                <button className="gecko-btn gecko-btn-sm gecko-btn-add-in"
                  disabled={!truckReady || !!result} onClick={() => addMove('DROP_OFF_CONT')}>
                  <Icon name="arrowDown" size={13} /> Add drop-off
                </button>
                <button className="gecko-btn gecko-btn-sm gecko-btn-add-out"
                  disabled={!truckReady || !!result} onClick={() => addMove('PICK_UP_CONT')}>
                  <Icon name="arrowUp" size={13} /> Add pick-up
                </button>
              </div>
            </div>

            {!truckReady && <div className="gecko-cell-meta">Key the truck plate first.</div>}
            {moves.length === 0 && truckReady && (
              <div className="gecko-dash-placeholder">Nothing on this truck yet.</div>
            )}

            {overLimit && (
              <div className="gecko-alert gecko-alert-error">
                A truck carries 1 × 40 ft or 2 × 20 ft each way. Take a box off before saving.
              </div>
            )}

            {saveError && (
              <div className="gecko-alert gecko-alert-error">
                {saveError.title ?? saveError.message} — nothing was charged.
              </div>
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
                  onToggleVas={code => void toggleVas(m.key, code)}
                />
              ))}
            </div>
          </div>
        </div>

        <GatePaymentPanel
          moves={moves}
          visitNo={visit?.visitNo ?? null}
          modeLabel={MODE_LABELS[mode]}
          cashTotal={cashTotal}
          cashTax={cashTax}
          withholdingTax={whtAmount}
          nett={nett}
          wht={wht}
          onWht={setWht}
          payerName={payerName}
          onPayerName={setPayerName}
          saving={saving}
          canSave={readyToSave && !result}
          saved={!!result}
          onSave={() => void save(false)}
        />
      </div>

      {typeAsk && (
        <TypeChangeDialog
          rows={typeAsk}
          busy={saving}
          onCancel={() => setTypeAsk(null)}
          onAccept={() => void save(true)}
        />
      )}
    </div>
  );
}
