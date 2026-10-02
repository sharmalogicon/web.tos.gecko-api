"use client";

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { FormSection, Field } from '@/components/ui/OpsPrimitives';
import { useToast } from '@/components/ui/Toast';
import { apiGet, apiSend } from '@/lib/api/client';
import { ApiError } from '@/lib/api/problem';
import { useApiList } from '@/lib/api/use-api';
import { useSession } from '@/lib/auth/session';
import { useFacility } from '@/lib/api/facility';
import {
  SEAL_TYPES, TOS_PERMISSIONS, formatContainerNo, numberOrNull, preflightPath, requiredGateFields, textOrNull,
  type GateFinding, type GatePreflight, type GateTransaction, type GateTransactionRequest,
} from '@/lib/api/tos';
import { useSetting, useTruckCategories } from '@/lib/api/lookups';
import { EirRegister } from '../_components/EirRegister';

/**
 * GATE IN — record the EIR, in one screen.
 *
 * KORAKIT has no barrier. A truck arrives, the clerk writes the box down, and
 * the paperwork is raised there and then — in Vector 99.7% of their bookings
 * are created at the gate. So this screen does not stop anyone: it captures the
 * EIR and, when the box is not already on a booking, raises the BLIND GATE IN
 * order for it in the same action.
 *
 * WHAT THE SERVER STILL INSISTS ON, and why the old screen could not simply be
 * restored as it was: an EIR always hangs off a booking. POST
 * /api/tos/gate/transactions refuses a container that is not assigned
 * (NO_ASSIGNMENT, 409) — not because of a barrier, but because an EIR with no
 * order behind it cannot be billed, released or explained. So "no barrier"
 * means we raise the order for the clerk, not that we skip it.
 *
 * Preflight is still read, but only as a LOOKUP: it tells us whether the box is
 * already on an order and prefills the line and type from it. It never blocks
 * the form. The server remains the authority — holds and cut-offs still refuse
 * the move, and they should.
 */

const BLIND_ORDER_TYPE = 'BLIND GATE IN';

interface SealRow { sealNo: string; sealType: string; isIntact: boolean }
const EMPTY_SEAL: SealRow = { sealNo: '', sealType: 'LINE', isIntact: true };

interface OrderTypeRow { orderTypeCode: string; descriptionEn: string; isActive?: boolean }
interface PartyRow { partyCode: string; nameEn: string }
interface EquipmentTypeRow { equipmentTypeId: string; typeCode: string; descriptionEn: string; isActive: boolean }

/** ISO 6346: 4 letters (owner + U/J/Z), then 7 digits. */
const CONTAINER_PATTERN = /^[A-Z]{4}\d{7}$/;

function normalise(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export default function GateInPage() {
  const { can } = useSession();
  const { branch } = useFacility();
  const toast = useToast();
  const branchId = branch?.branchId ?? null;

  const mayRecord = can(TOS_PERMISSIONS.gateCreate);

  // ── the box ───────────────────────────────────────────────────────────────
  const [containerNo, setContainerNo] = useState('');
  const box = normalise(containerNo);
  const boxLooksRight = CONTAINER_PATTERN.test(box);

  // What the API already knows about it. Null until we have looked.
  const [known, setKnown] = useState<GatePreflight | null>(null);
  const [looking, setLooking] = useState(false);

  // ── the order, when one has to be raised ──────────────────────────────────
  const [orderTypeCode, setOrderTypeCode] = useState(BLIND_ORDER_TYPE);
  const [lineCode, setLineCode] = useState('');
  const [customerCode, setCustomerCode] = useState('');
  const [equipmentTypeCode, setEquipmentTypeCode] = useState('');

  // ── the EIR ───────────────────────────────────────────────────────────────
  const [seals, setSeals] = useState<SealRow[]>([{ ...EMPTY_SEAL }]);
  const [grossWeight, setGrossWeight] = useState('');
  const [tareWeight, setTareWeight] = useState('');
  const [maxGrossWeight, setMaxGrossWeight] = useState('');
  const [cargoWeight, setCargoWeight] = useState('');
  const [vgmKg, setVgmKg] = useState('');
  const [conditionCode, setConditionCode] = useState('');
  const [gradeCode, setGradeCode] = useState('');
  const [materialCode, setMaterialCode] = useState('');
  const [customsPermitNo, setCustomsPermitNo] = useState('');
  const [paperlessCode, setPaperlessCode] = useState('');
  const [nextLocationCode, setNextLocationCode] = useState('');
  const [truckCategory, setTruckCategory] = useState('');
  const [temperatureC, setTemperatureC] = useState('');
  const [yardId, setYardId] = useState('');
  const [positionText, setPositionText] = useState('');
  const [plate, setPlate] = useState('');
  const [driver, setDriver] = useState('');
  const [haulier, setHaulier] = useState('');
  const [remarks, setRemarks] = useState('');

  // ── overrides, revealed only when the server asks for them ────────────────
  const [digitReason, setDigitReason] = useState('');
  const [lateReason, setLateReason] = useState('');
  const [findings, setFindings] = useState<GateFinding[]>([]);
  const needsDigit = findings.some(f => f.code === 'CHECK_DIGIT' && f.severity === 'OVERRIDE');
  const needsLate = findings.some(f => f.code.startsWith('LATE') && f.severity === 'OVERRIDE');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [recorded, setRecorded] = useState<GateTransaction | null>(null);

  // ── reference data ────────────────────────────────────────────────────────
  const { data: orderTypes } = useApiList<OrderTypeRow>('/api/master/order-types?pageSize=200');
  const { data: lines } = useApiList<PartyRow>('/api/master/parties?role=SHIPPING_LINE&pageSize=200');
  const { data: equipmentTypes } = useApiList<EquipmentTypeRow>('/api/master/equipment-types?pageSize=200');
  const { yards } = useFacility();
  const { categories } = useTruckCategories();
  const { value: defaultTruckCategory } = useSetting('gate.default_truck_category');
  const effectiveTruckCategory = truckCategory || defaultTruckCategory || '';

  /**
   * This screen records arrivals, so the trip is always a drop-off — which is
   * what decides the fields the server then insists on. FULL/EMPTY comes from
   * the booking step, never from the clerk.
   */
  const required = requiredGateFields('DROP_OFF_CONT', known?.nextStep?.fullEmpty ?? null,
    known?.booking?.directionCode === 'EXPORT');
  const needs = (field: string) => required.includes(field);
  const fieldError = (field: string) => error?.forField(field);

  const onBooking = known?.booking ?? null;

  /**
   * Look the box up once it is a plausible container number. This is a read:
   * it prefills and tells the clerk what is already on file. A BLOCKED answer
   * does not stop anything here — the usual reason is simply that no order
   * exists yet, which is what this screen is for.
   */
  const look = useCallback(async () => {
    if (!branchId || !boxLooksRight) return;
    setLooking(true);
    setError(null);
    try {
      const answer = await apiGet<GatePreflight>(preflightPath({
        branchId, containerNo: box, direction: 'IN',
        truckCategoryCode: effectiveTruckCategory || null,
        haulierCode: haulier.trim() || null,
      }));
      setKnown(answer);
      // "Not on an open booking" is the ordinary case at a depot with no
      // barrier — it is what the order section below is for. Showing it as a
      // red BLOCK would tell the clerk the box is refused while the very same
      // screen is about to admit it. Everything else the server noticed stands.
      setFindings((answer.findings ?? []).filter(f => f.code !== 'NO_ASSIGNMENT'));
      if (answer.booking) {
        setOrderTypeCode(answer.booking.orderTypeCode);
        setLineCode(answer.booking.lineCode);
        setCustomerCode(answer.booking.customerCode ?? '');
        if (answer.booking.equipmentTypeCode) setEquipmentTypeCode(answer.booking.equipmentTypeCode);
        if (answer.booking.declaredSealNo && !seals[0].sealNo) {
          setSeals([{ ...EMPTY_SEAL, sealNo: answer.booking.declaredSealNo }]);
        }
      }
    } catch {
      // A failed lookup must not stop the clerk writing the box down; the
      // record call below is the one that decides.
      setKnown(null);
    } finally {
      setLooking(false);
    }
  }, [branchId, box, boxLooksRight, seals]);

  const reset = () => {
    setContainerNo(''); setKnown(null); setFindings([]);
    setOrderTypeCode(BLIND_ORDER_TYPE); setLineCode(''); setCustomerCode(''); setEquipmentTypeCode('');
    setSeals([{ ...EMPTY_SEAL }]);
    setGrossWeight(''); setTareWeight(''); setVgmKg('');
    setConditionCode(''); setGradeCode(''); setTemperatureC('');
    setYardId(''); setPositionText('');
    setPlate(''); setDriver(''); setHaulier(''); setRemarks('');
    setDigitReason(''); setLateReason('');
    setError(null);
  };

  const num = (v: string) => (v.trim() === '' ? null : Number(v));

  async function record() {
    if (!branchId || !boxLooksRight) return;
    setSaving(true);
    setError(null);
    try {
      // 1. The order. Only raised when the box is not already on one — this is
      //    the "blind gate in": the box is here, the paperwork follows it.
      if (!onBooking) {
        await apiSend('POST', '/api/tos/bookings', {
          branchId,
          orderTypeCode,
          lineCode,
          customerCode: customerCode.trim() || null,
          requirements: [{ equipmentTypeCode, qty: 1 }],
          containers: [{ containerNo: box }],
        });
      }

      // 2. The move itself.
      const request: GateTransactionRequest = {
        branchId,
        containerNo: box,
        direction: 'IN',
        tripType: 'DROP_OFF_CONT',
        truck: {
          plate: plate.trim() || 'UNKNOWN',
          driverName: textOrNull(driver),
          haulierCode: textOrNull(haulier),
          truckCategoryCode: effectiveTruckCategory || null,
        },
        grossWeightKg: numberOrNull(grossWeight),
        tareWeightKg: numberOrNull(tareWeight),
        maxGrossWeightKg: numberOrNull(maxGrossWeight),
        cargoWeightKg: numberOrNull(cargoWeight),
        vgmKg: numberOrNull(vgmKg),
        weightSource: grossWeight.trim() ? 'WEIGHBRIDGE' : null,
        conditionCode: textOrNull(conditionCode),
        gradeCode: textOrNull(gradeCode),
        materialCode: textOrNull(materialCode),
        customsPermitNo: textOrNull(customsPermitNo),
        paperlessCode: textOrNull(paperlessCode),
        nextLocationCode: textOrNull(nextLocationCode),
        temperatureC: numberOrNull(temperatureC),
        yardId: yardId || null,
        positionText: textOrNull(positionText),
        seals: seals.filter(s => s.sealNo.trim())
          .map(s => ({ sealNo: s.sealNo.trim().toUpperCase(), sealType: s.sealType, isIntact: s.isIntact })),
        remarks: textOrNull(remarks),
        checkDigitOverrideReason: textOrNull(digitReason),
        lateOverrideReason: textOrNull(lateReason),
      };
      const written = await apiSend<GateTransaction>('POST', '/api/tos/gate/transactions', request);

      setRecorded(written);
      toast.toast({ variant: 'success', title: written.eirNo, message: `${written.movementCode} recorded for ${written.containerNo}` });
      reset();
      // What the barrier said while recording — the truck not being the one
      // paid for, gate hours, a warning-only coupon. The server does not store
      // these, so if they are not shown now they are gone.
      setFindings(written.findings ?? []);
    } catch (err) {
      const problem = err instanceof ApiError ? err : new ApiError(0, 'The gate-in could not be recorded.');
      setError(problem);
      // A 409 carries the findings; surfacing them is what turns "refused" into
      // something the clerk can act on, and reveals the override boxes.
      const refused = problem.extension<GateFinding[]>('findings');
      if (Array.isArray(refused)) setFindings(refused);
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = useMemo(() => (
    mayRecord && !!branchId && boxLooksRight && !saving
    && (!!onBooking || (!!orderTypeCode && !!lineCode && !!equipmentTypeCode))
    && (!needsDigit || digitReason.trim().length > 0)
    && (!needsLate || lateReason.trim().length > 0)
  ), [mayRecord, branchId, boxLooksRight, saving, onBooking, orderTypeCode, lineCode, equipmentTypeCode, needsDigit, digitReason, needsLate, lateReason]);

  const setSeal = (i: number, patch: Partial<SealRow>) =>
    setSeals(rows => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="gecko-stack gecko-eirin-page">
      <div className="gecko-page-header">
        <div className="gecko-page-header-left">
          <h1 className="gecko-page-title-lg">Gate In</h1>
          <p className="gecko-page-subtitle">
            Record the EIR as the truck arrives
            {branch && <> · {branch.displayName}</>}
          </p>
        </div>
      </div>

      {!branchId && (
        <div className="gecko-card gecko-card-padded gecko-dash-placeholder">
          No depot is assigned to this account, so a gate-in cannot be recorded.
        </div>
      )}

      {!mayRecord && branchId && (
        <div className="gecko-card gecko-card-padded gecko-dash-placeholder">
          You do not have permission to record gate moves at this depot.
        </div>
      )}

      {recorded && (
        <div className="gecko-card gecko-card-padded gecko-eirin-done">
          <Icon name="shieldCheck" size={18} />
          <div>
            <div className="gecko-eirin-done-title">
              <Link href={`/gate/eir-in/${recorded.gateTransactionId}`} className="gecko-link">{recorded.eirNo}</Link>
              {' '}recorded — {recorded.movementCode}, {recorded.fullEmpty}
            </div>
            <div className="gecko-cell-meta">
              {formatContainerNo(recorded.containerNo)} on {recorded.orderNo}
            </div>
          </div>
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={() => setRecorded(null)}>Dismiss</button>
        </div>
      )}

      {branchId && mayRecord && (
        <div className="gecko-card gecko-card-padded gecko-stack gecko-stack-xl">

          <FormSection title="Container" desc="The number as it reads on the box. Everything else follows from it." cols={3}>
            <Field label="Container no." required span={2}>
              <div className="gecko-eirin-box-row">
                <input
                  className="gecko-input gecko-mono"
                  value={containerNo}
                  onChange={e => { setContainerNo(e.target.value); setKnown(null); setFindings([]); }}
                  onBlur={look}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); look(); } }}
                  placeholder="MSKU 123456-7"
                  autoFocus
                />
                {looking && <span className="gecko-cell-meta">checking…</span>}
                {!looking && boxLooksRight && known && (
                  <span className={`gecko-badge gecko-badge-xs ${known.isCheckDigitValid ? 'gecko-badge-success' : 'gecko-badge-warning'}`}>
                    {known.isCheckDigitValid ? 'check digit ok' : 'check digit fails'}
                  </span>
                )}
                {!looking && containerNo.trim() !== '' && !boxLooksRight && (
                  <span className="gecko-cell-meta gecko-eirin-hint">4 letters then 7 digits</span>
                )}
              </div>
            </Field>
            <Field label="Condition">
              <input className="gecko-input" value={conditionCode} onChange={e => setConditionCode(e.target.value.toUpperCase())} placeholder="e.g. AV" />
              {fieldError('conditionCode') && <div className="gecko-field-error">{fieldError('conditionCode')}</div>}
            </Field>
            {/* Container class IS the grade — the API has no separate field. */}
            <Field label="Container class" helper="Grade: the class on the EIR.">
              <input className="gecko-input" value={gradeCode} onChange={e => setGradeCode(e.target.value.toUpperCase())} placeholder="e.g. A" />
              {fieldError('gradeCode') && <div className="gecko-field-error">{fieldError('gradeCode')}</div>}
            </Field>
            <Field label="Material">
              <input className="gecko-input" value={materialCode} onChange={e => setMaterialCode(e.target.value.toUpperCase())} placeholder="STL" />
              {fieldError('materialCode') && <div className="gecko-field-error">{fieldError('materialCode')}</div>}
            </Field>
            <Field label="Reefer temp (°C)" helper="Leave blank for a dry box.">
              <input className="gecko-input" type="number" value={temperatureC} onChange={e => setTemperatureC(e.target.value)} />
            </Field>
          </FormSection>

          {onBooking ? (
            <FormSection title="Order" desc="This box is already on an open order — nothing to raise." cols={3}>
              <Field label="Order no.">
                <div className="gecko-eirin-readback gecko-mono">{onBooking.orderNo}</div>
              </Field>
              <Field label="Order type">
                <div className="gecko-eirin-readback">{onBooking.orderTypeCode}</div>
              </Field>
              <Field label="Line">
                <div className="gecko-eirin-readback">{onBooking.lineCode}</div>
              </Field>
            </FormSection>
          ) : (
            <FormSection
              title="Order"
              desc="No order carries this box yet, so one is raised with the EIR. That is the blind gate-in."
              cols={3}
            >
              <Field label="Order type" required>
                <select className="gecko-select" value={orderTypeCode} onChange={e => setOrderTypeCode(e.target.value)}>
                  {(orderTypes ?? []).map(t => (
                    <option key={t.orderTypeCode} value={t.orderTypeCode}>{t.orderTypeCode} — {t.descriptionEn}</option>
                  ))}
                </select>
              </Field>
              <Field label="Shipping line" required>
                <select className="gecko-select" value={lineCode} onChange={e => setLineCode(e.target.value)}>
                  <option value="">Choose…</option>
                  {(lines ?? []).map(l => <option key={l.partyCode} value={l.partyCode}>{l.partyCode} — {l.nameEn}</option>)}
                </select>
              </Field>
              <Field label="Equipment type" required>
                <select className="gecko-select" value={equipmentTypeCode} onChange={e => setEquipmentTypeCode(e.target.value)}>
                  <option value="">Choose…</option>
                  {(equipmentTypes ?? []).filter(t => t.isActive).map(t => (
                    <option key={t.equipmentTypeId} value={t.typeCode}>{t.typeCode} — {t.descriptionEn}</option>
                  ))}
                </select>
              </Field>
              <Field label="Customer" helper="Optional — the payer, when known at the gate." span={3}>
                <input className="gecko-input" value={customerCode} onChange={e => setCustomerCode(e.target.value)} placeholder="Party code" />
              </Field>
            </FormSection>
          )}

          <FormSection
            title={needs('seals') ? 'Seals — at least one required' : 'Seals'}
            desc="Every seal on the box as it arrives. A full drop-off must record one."
            cols={1}
          >
            <div className="gecko-stack gecko-stack-sm">
              {seals.map((seal, i) => (
                <div key={i} className="gecko-eirin-seal-row">
                  <input
                    className="gecko-input gecko-mono"
                    value={seal.sealNo}
                    onChange={e => setSeal(i, { sealNo: e.target.value })}
                    placeholder="Seal no."
                  />
                  <select className="gecko-select" value={seal.sealType} onChange={e => setSeal(i, { sealType: e.target.value })}>
                    {SEAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <label className="gecko-eirin-intact">
                    <input type="checkbox" checked={seal.isIntact} onChange={e => setSeal(i, { isIntact: e.target.checked })} />
                    Intact
                  </label>
                  <button
                    type="button"
                    className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm"
                    onClick={() => setSeals(rows => (rows.length === 1 ? [{ ...EMPTY_SEAL }] : rows.filter((_, j) => j !== i)))}
                    title="Remove seal"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              ))}
              <div>
                <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setSeals(rows => [...rows, { ...EMPTY_SEAL }])}>
                  <Icon name="plus" size={13} /> Add seal
                </button>
              </div>
              {fieldError('seals') && <div className="gecko-field-error">{fieldError('seals')}</div>}
            </div>
          </FormSection>

          <FormSection title="Weights" desc="From the weighbridge ticket. A drop-off always records tare and max gross; a full one also records the cargo." cols={3}>
            <Field label="Gross (kg)">
              <input className="gecko-input" type="number" value={grossWeight} onChange={e => setGrossWeight(e.target.value)} />
              {fieldError('grossWeightKg') && <div className="gecko-field-error">{fieldError('grossWeightKg')}</div>}
            </Field>
            <Field label="Tare (kg)" required={needs('tareWeightKg')}>
              <input className={`gecko-input${fieldError('tareWeightKg') ? ' gecko-input-error' : ''}`} type="number" value={tareWeight} onChange={e => setTareWeight(e.target.value)} />
              {fieldError('tareWeightKg') && <div className="gecko-field-error">{fieldError('tareWeightKg')}</div>}
            </Field>
            <Field label="Max gross (kg)" required={needs('maxGrossWeightKg')}>
              <input className={`gecko-input${fieldError('maxGrossWeightKg') ? ' gecko-input-error' : ''}`} type="number" value={maxGrossWeight} onChange={e => setMaxGrossWeight(e.target.value)} />
              {fieldError('maxGrossWeightKg') && <div className="gecko-field-error">{fieldError('maxGrossWeightKg')}</div>}
            </Field>
            <Field label="Cargo (kg)" required={needs('cargoWeightKg')}>
              <input className={`gecko-input${fieldError('cargoWeightKg') ? ' gecko-input-error' : ''}`} type="number" value={cargoWeight} onChange={e => setCargoWeight(e.target.value)} />
              {fieldError('cargoWeightKg') && <div className="gecko-field-error">{fieldError('cargoWeightKg')}</div>}
            </Field>
            <Field label="VGM (kg)">
              <input className="gecko-input" type="number" value={vgmKg} onChange={e => setVgmKg(e.target.value)} />
              {fieldError('vgmKg') && <div className="gecko-field-error">{fieldError('vgmKg')}</div>}
            </Field>
            <Field label="Customs permit no." required={needs('customsPermitNo')} helper="A full export drop-off needs it.">
              <input className={`gecko-input${fieldError('customsPermitNo') ? ' gecko-input-error' : ''}`} value={customsPermitNo} onChange={e => setCustomsPermitNo(e.target.value)} />
              {fieldError('customsPermitNo') && <div className="gecko-field-error">{fieldError('customsPermitNo')}</div>}
            </Field>
          </FormSection>

          <FormSection title="Where it goes" desc="The yard and the spot inside it." cols={3}>
            <Field label="Yard">
              <select className="gecko-select" value={yardId} onChange={e => setYardId(e.target.value)}>
                <option value="">Not assigned</option>
                {yards.map(y => <option key={y.yardId} value={y.yardId}>{y.yardCode} — {y.nameEn}</option>)}
              </select>
            </Field>
            <Field label="Position" span={2} helper="Block / row / tier as the yard writes it.">
              <input className="gecko-input gecko-mono" value={positionText} onChange={e => setPositionText(e.target.value.toUpperCase())} placeholder="A1" />
            </Field>
          </FormSection>

          <FormSection title="Truck" desc="Who brought it." cols={3}>
            <Field label="Plate">
              <input className="gecko-input gecko-mono" value={plate} onChange={e => setPlate(e.target.value.toUpperCase())} placeholder="81-4422" />
            </Field>
            <Field label="Driver">
              <input className="gecko-input" value={driver} onChange={e => setDriver(e.target.value)} />
            </Field>
            <Field label="Haulier">
              <input className="gecko-input" value={haulier} onChange={e => setHaulier(e.target.value)} placeholder="Party code" />
              {fieldError('truck.haulierCode') && <div className="gecko-field-error">{fieldError('truck.haulierCode')}</div>}
            </Field>
            {/* The axis the gate charge is priced on, so it is the truck that
                is actually here — defaulted to the depot's usual one. */}
            <Field label="Truck category">
              <select className="gecko-select" value={effectiveTruckCategory} onChange={e => setTruckCategory(e.target.value)}>
                <option value="">Any truck</option>
                {categories.filter(c => c.isActive).map(c => <option key={c.code} value={c.code}>{c.descriptionEn}</option>)}
              </select>
              {fieldError('truck.truckCategoryCode') && <div className="gecko-field-error">{fieldError('truck.truckCategoryCode')}</div>}
            </Field>
            <Field label="Next location">
              <input className="gecko-input" value={nextLocationCode} onChange={e => setNextLocationCode(e.target.value.toUpperCase())} />
            </Field>
            <Field label="Paperless code">
              <input className="gecko-input" value={paperlessCode} onChange={e => setPaperlessCode(e.target.value)} />
            </Field>
            <Field label="Remarks" span={3}>
              <input className="gecko-input" value={remarks} onChange={e => setRemarks(e.target.value)} />
            </Field>
          </FormSection>

          {findings.length > 0 && (
            <div className="gecko-eirin-findings">
              {findings.map((f, i) => (
                <div key={i} className={`gecko-eirin-finding gecko-eirin-finding-${f.severity.toLowerCase()}`}>
                  <Icon name={f.severity === 'BLOCK' ? 'alertCircle' : f.severity === 'OVERRIDE' ? 'warning' : 'info'} size={13} />
                  <span>{f.message}</span>
                </div>
              ))}
            </div>
          )}

          {(needsDigit || needsLate) && (
            <FormSection title="Supervisor override" desc="The server asked for a reason. It is written onto the EIR." cols={1}>
              {needsDigit && (
                <Field label="Reason — check digit" required>
                  <input className="gecko-input" value={digitReason} onChange={e => setDigitReason(e.target.value)} placeholder="Why this number is accepted as it reads" />
                </Field>
              )}
              {needsLate && (
                <Field label="Reason — late against cut-off" required>
                  <input className="gecko-input" value={lateReason} onChange={e => setLateReason(e.target.value)} placeholder="Who authorised the late move" />
                </Field>
              )}
            </FormSection>
          )}

          {error && (
            <div className="gecko-eirin-error">
              <Icon name="alertCircle" size={14} />
              <div>
                <div className="gecko-eirin-error-title">{error.title}</div>
                {error.explanation && <div className="gecko-eirin-error-detail">{error.explanation}</div>}
              </div>
            </div>
          )}

          <div className="gecko-row gecko-row-between gecko-eirin-actions">
            <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={reset} disabled={saving}>
              Clear
            </button>
            <button type="button" className="gecko-btn gecko-btn-primary" onClick={record} disabled={!canSubmit}>
              {saving ? 'Recording…' : onBooking ? 'Record gate-in' : 'Raise order & record gate-in'}
            </button>
          </div>
        </div>
      )}

      <div className="gecko-eirin-register">
        <EirRegister direction="IN" />
      </div>
    </div>
  );
}
