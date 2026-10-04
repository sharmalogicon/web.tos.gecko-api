"use client";
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { apiGet, apiSend, newIdempotencyKey } from '@/lib/api/client';
import { newClientLineId } from '@/lib/api/booking-entry';
import { defaultHandoverMode, handoverModesFor } from '@/lib/api/tos';
import { ApiError } from '@/lib/api/problem';
import { useFacility } from '@/lib/api/facility';
import { useSession } from '@/lib/auth/session';
import { PartyPicker } from '@/app/tariff/_components/PartyPicker';
import { useCodeList } from '@/lib/api/lookups';
import { PortPicker } from './PortPicker';
import type { Port } from '@/lib/api/logistics';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { BarcodeDisplay } from '@/components/ui/BarcodeDisplay';
import { DateField } from '@/components/ui/DateField';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import { useToast } from '@/components/ui/Toast';
import { formatDate, formatDateTime } from '@/lib/format';
import { useApi, useApiList } from '@/lib/api/use-api';
import { effectiveCutoffsPath, type EffectiveCutoff } from '@/lib/api/booking-voyage';
import { useRouter } from 'next/navigation';
import {
  ACTIVE_ORDER_TYPES,
  getOrderType,
  type OrderType as OrderTypeDef,
  type OrderTypeMovement as OrderTypeMovementDef,
  type OrderTypeVAS as OrderTypeVASDef,
} from '@/lib/order-types-catalog';

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingType = 'EXPORT' | 'IMPORT';
type ContainerStatus = 'NO_ACTIVITY' | 'PARTIAL' | 'FULL_IN' | 'LOADED' | 'DISCHARGED' | 'FULL_OUT';

interface Movement { code: string; txNo: string; date: string; status: boolean; yard: string; truck: string }
interface VASCharge { id: number; chargeCode: string; paymentTerm: string; paymentTo: string; qty: number; isAutoLoad: boolean; isVAS: boolean }
interface Container {
  /** The API's bookingContainerId once saved; a temporary key before that. */
  id: string;
  /** Which requirement line this box fills. */
  lineNo: number;
  /** The identity this row was born with — what makes a resend safe (§16b). */
  clientLineId: string;
  /** Needed to edit a saved line; empty while the row is new. */
  rowVersion: string;
  handoverMode: string;
  stowageCode: string;
  containerNo: string; size: string; type: string; grade: string;
  containerMode: string; haulage: string; pickupDate: string;
  imoClass: string | null; unNo: string; cargoCategory: string;
  weight: number; volume: number; sealAgent: string; sealCustomer: string;
  temperature: number | null; temperatureMode: string | null;
  vent: number | null; ventMode: string | null; humidity: number | null; preCool: string;
  stowage: number; remarks: string;
  movements: Movement[]; vas: VASCharge[];
}

/**
 * An API container line in the shape this screen reads.
 *
 * The June screen was drawn against Vector's vocabulary and the API speaks its
 * own; this is the one place the two are reconciled, so no component below has
 * to know both. Fields Vector has and Gecko does not — grade, container mode,
 * haulage, the reefer UNITS, VAS — come back empty and are marked on screen as
 * waiting on the API (docs/BOOKING_CONTAINER_PARITY_FOR_API.md).
 */
function containerFromApi(line: ApiContainerLine, requirements: ApiRequirement[]): Container {
  const req = requirements.find(r => r.lineNo === line.lineNo);
  const equip = req?.equipmentTypeCode ?? '';
  return {
    id: line.bookingContainerId,
    lineNo: line.lineNo,
    stowageCode: line.stowageCode ?? '',
    containerNo: line.containerNo ?? '',
    // "40HC" is a size and a type glued together, which is how the depot says it.
    size: equip.slice(0, 2),
    type: equip.slice(2),
    grade: '',
    containerMode: '',
    haulage: '',
    pickupDate: line.requiredDate ?? '',
    imoClass: line.imdgClass ?? null,
    unNo: line.unNumber ?? '',
    cargoCategory: line.cargoCategoryCode ?? '',
    weight: line.declaredVgmKg ?? 0,
    volume: line.declaredVolumeCbm ?? 0,
    sealAgent: line.declaredSealNo ?? '',
    sealCustomer: line.customerSealNo ?? '',
    temperature: line.reeferSetTempC,
    temperatureMode: line.reeferSetTempC === null ? null : 'CEL',
    vent: line.reeferVentPct,
    ventMode: line.reeferVentPct === null ? null : 'VEN',
    humidity: line.reeferHumidityPct,
    preCool: line.isPreCool ? 'Y' : '',
    stowage: Number(line.stowageNo ?? 0) || 0,
    remarks: line.remarks ?? '',
    // The save answer carries the moves, so the drawer fills without a second call.
    movements: (line.steps ?? []).map(s => ({
      code: s.movementCode,
      txNo: s.gateTransactionId ?? '',
      date: '',
      status: s.status === 'DONE',
      yard: '',
      truck: '',
    })),
    vas: [],
    handoverMode: line.handoverMode ?? '',
    rowVersion: line.rowVersion,
    clientLineId: line.clientLineId ?? '',
  };
}

/** What this screen sends for one box. */
function containerToApi(c: Container, clientLineId: string) {
  const n = (v: number) => (v === 0 ? null : v);
  return {
    clientLineId,
    containerNo: c.containerNo.trim().toUpperCase(),
    lineNo: c.lineNo,
    declaredSealNo: c.sealAgent.trim() || null,
    customerSealNo: c.sealCustomer.trim() || null,
    declaredVgmKg: n(c.weight),
    declaredVolumeCbm: n(c.volume),
    requiredDate: c.pickupDate || null,
    cargoCategoryCode: c.cargoCategory || null,
    imdgClass: c.imoClass || null,
    unNumber: c.unNo || null,
    reeferSetTempC: c.temperature,
    reeferVentPct: c.vent,
    reeferHumidityPct: c.humidity,
    stowageCode: c.stowageCode || null,
    stowageNo: c.stowage ? String(c.stowage) : null,
    isPreCool: c.preCool === 'Y',
    remarks: c.remarks.trim() || null,
    handoverMode: c.handoverMode || null,
  };
}

interface ApiStep { movementCode: string; sequenceNo: number; status: string; gateTransactionId: string | null }

interface ApiContainerLine {
  bookingContainerId: string;
  clientLineId: string | null;
  containerNo: string | null;
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
  steps: ApiStep[] | null;
}

interface ApiRequirement { lineNo: number; equipmentTypeCode: string; qty: number; qtyAssigned: number; qtyCompleted: number }

interface ApiBookingDetail {
  booking: SavedBooking;
  requirements: ApiRequirement[];
  containers: ApiContainerLine[];
}

interface BatchItem {
  clientLineId: string;
  containerNo: string;
  outcome: 'CREATED' | 'REPLAYED' | 'REJECTED';
  line: ApiContainerLine | null;
  errors: Record<string, string[]> | null;
  /**
   * Said, not refused — the check digit softened to a warning on the owner's
   * call (2026-10-04). The row IS saved; the clerk is told the number looks
   * wrong so it can be corrected when the box turns up.
   */
  warnings: Record<string, string[]> | null;
}

interface BatchAnswer {
  created: number; replayed: number; rejected: number;
  lines: { lineNo: number; equipmentTypeCode: string; qty: number; assigned: number }[];
  items: BatchItem[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

/**
 * A BLANK booking, in the shape the June screen reads.
 *
 * This page is the June booking screen serving BOTH new and edit: the fields,
 * the tabs and the container drawer are that design unchanged. What differs for
 * a new booking is only that everything starts empty and there is no order
 * number until it is saved.
 *
 * NOT BOUND YET (2026-10-04, owner's sequencing): the design is being reviewed
 * first, then wired. Every API call this page will need already exists, correct,
 * in docs/snapshots/booking-detail.bound-2026-10-04.tsx.
 */
const BOOKING = {
  bookingNo: '', subBLNo: '',
  bookingDate: new Date().toISOString().slice(0, 10), bookingType: 'EXPORT' as BookingType,
  // Blank on purpose: the order type decides the direction, the gate steps and
  // which fields matter, so defaulting it would quietly pick all of that for
  // the clerk. The badge reads NO TYPE until they choose.
  orderType: '', orderNo: '', status: 'DRAFT',
  agent:    null as null | { code: string; name: string },
  customer: null as null | { code: string; name: string },
  forwarder: null as null | { code: string; name: string },
  ownerCode: '',
  vessel:   { code: '', name: '' },
  voyageNo: '', wharf: '',
  loadingPort: '', dischargePort: '', destinationPort: '',
  tradeMode: '', prevLocation: '',
  etd: '',
  allowLateGateIn: false, paperlessCode: '',
  cutoffs: { cyDry: '', cyReefer: '', cfsDry: '', cfsReefer: '', portDry: '', portReefer: '' },
  cargo: { totalQty: '', uom: 'BAG', totalWeight: '', totalVolume: '', commodity: '', marksAndNos: '', specialInstruction: '', remarks: '' },
  createdBy: '', createdOn: '', modifiedBy: '', modifiedOn: '',
};


/**
 * An existing booking, poured back into the form.
 *
 * Every field the screen can change is read back, because the header PUT
 * REPLACES: anything not seeded here would be sent as null on the next save and
 * silently cleared. The derived ones — direction, container owner, trade mode —
 * are deliberately absent; they live on `created` and are never sent.
 */
function formFromBooking(b: SavedBookingFull): HeaderForm {
  const txt = (v: string | null | undefined) => v ?? '';
  const num = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));
  return {
    agentCode: txt(b.agentCode ?? b.lineCode),
    customerCode: txt(b.customerCode),
    forwarderCode: txt(b.forwarderCode),
    carrierRef: txt(b.carrierRef),
    customerRef: txt(b.customerRef),
    vesselCallId: txt(b.vesselCallId),
    polPortCode: txt(b.polPortCode),
    podPortCode: txt(b.podPortCode),
    fpdPortCode: txt(b.fpdPortCode),
    paperlessCode: txt(b.paperlessCode),
    allowLateGateIn: b.allowLateGateIn ?? false,
    totalQty: num(b.totalQty),
    uomCode: txt(b.uomCode),
    totalVolumeCbm: num(b.totalVolumeCbm),
    totalWeightKg: num(b.totalWeightKg),
    commodityCode: txt(b.commodityCode),
    cargoCategoryCode: txt(b.cargoCategoryCode),
    marksAndNos: txt(b.marksAndNos),
    specialInstruction: txt(b.specialInstruction),
    remarks: txt(b.remarks),
  };
}

/** The booking as GET returns it — SavedBooking plus everything the form reads. */
interface SavedBookingFull extends SavedBooking {
  lineCode?: string | null;
  agentCode?: string | null;
  customerCode?: string | null;
  forwarderCode?: string | null;
  carrierRef?: string | null;
  customerRef?: string | null;
  vesselCallId?: string | null;
  polPortCode?: string | null;
  podPortCode?: string | null;
  fpdPortCode?: string | null;
  paperlessCode?: string | null;
  allowLateGateIn?: boolean | null;
  totalQty?: number | null;
  uomCode?: string | null;
  totalVolumeCbm?: number | null;
  totalWeightKg?: number | null;
  commodityCode?: string | null;
  cargoCategoryCode?: string | null;
  marksAndNos?: string | null;
  specialInstruction?: string | null;
  remarks?: string | null;
  orderTypeCode?: string | null;
}

// Template for a brand-new container — opened when "Add Container" is clicked
/**
 * An order type as MDM returns it: the choice, with its attributes.
 * Same shape the previously-bound booking form used — reused rather than
 * re-derived, so the two screens cannot drift apart.
 */
/**
 * The booking header as the clerk is filling it in.
 *
 * Only what the UI SENDS lives here. containerOwnerCode and tradeModeCode are
 * derived by the API and never sent (§18), so they are read off `created`
 * instead — a form field for a value you cannot set is a lie.
 */
interface HeaderForm {
  /**
   * Party CODES, not objects: PartyPicker searches GET /api/master/parties and
   * hands back the code, which is what the booking API takes. The screen used
   * EntitySearch before — a hardcoded catalogue of invented companies that
   * never touched the API and needed three characters before it showed
   * anything.
   */
  agentCode: string;
  customerCode: string;
  forwarderCode: string;
  carrierRef: string;
  customerRef: string;
  vesselCallId: string;
  polPortCode: string;
  podPortCode: string;
  fpdPortCode: string;
  paperlessCode: string;
  allowLateGateIn: boolean;
  // Cargo & docs — the shipper's declared totals (§17a).
  totalQty: string;
  uomCode: string;
  totalVolumeCbm: string;
  totalWeightKg: string;
  commodityCode: string;
  cargoCategoryCode: string;
  marksAndNos: string;
  specialInstruction: string;
  remarks: string;
  /**
   * The ports as PICKED, kept only so Trade Mode can be shown before the
   * booking is saved. Never sent — the API takes the codes and derives the rest.
   */
  polPort?: Port | null;
  podPort?: Port | null;
  fpdPort?: Port | null;
}

const EMPTY_HEADER: HeaderForm = {
  agentCode: '', customerCode: '', forwarderCode: '',
  carrierRef: '', customerRef: '', vesselCallId: '',
  polPortCode: '', podPortCode: '', fpdPortCode: '',
  paperlessCode: '', allowLateGateIn: false,
  totalQty: '', uomCode: '', totalVolumeCbm: '', totalWeightKg: '',
  commodityCode: '', cargoCategoryCode: '', marksAndNos: '', specialInstruction: '', remarks: '',
};

/**
 * The booking as the API hands it back. The 201 of POST /api/tos/bookings is
 * field-for-field the GET (§18), so the screen fills from the answer and never
 * re-reads.
 */
interface SavedBooking {
  bookingId: string;
  orderNo: string;
  status: string;
  rowVersion: string;
  directionCode: string | null;
  containerOwnerCode: string | null;
  tradeModeCode: string | null;
  createdAt: string | null;
  createdByName: string | null;
  updatedAt: string | null;
  updatedByName: string | null;
}

interface ApiOrderType {
  orderTypeCode: string;
  descriptionEn: string;
  directionCode: string | null;
  serviceCode: string | null;
  cargoClassCode: string | null;
  bookingTypeCode: string | null;
  /**
   * Whether this order type's moves hang off a sailing. Depot work — storage,
   * repair, a swap — has none, and a screen that demands a vessel call for it
   * is asking the clerk to invent one.
   */
  requiresVesselSchedule: boolean;
  isActive: boolean;
}

/** A sailing the booking can point at. */
interface CallSummary {
  vesselCallId: string; callRef: string; etd: string; status: string;
  vesselCode?: string | null; vesselName?: string | null; terminalCode?: string | null;
  operatorVoyageIn?: string | null; operatorVoyageOut?: string | null; lines?: string[];
}

/** A week back, read once at module load: a clock read during render is impure. */
const CALLS_PATH = `/api/tos/vessel-calls?from=${encodeURIComponent(new Date(Date.now() - 7 * 86_400_000).toISOString())}&pageSize=200`;

const BLANK_CONTAINER: Container = {
  id: '', lineNo: 0, clientLineId: '', rowVersion: '', handoverMode: '', stowageCode: '',
  containerNo: '', size: '40', type: 'HC', grade: 'NONE',
  containerMode: 'CY', haulage: 'MERCHANT', pickupDate: '2026-04-23',
  imoClass: null, unNo: '', cargoCategory: 'GENERAL',
  weight: 0, volume: 0, sealAgent: '', sealCustomer: '',
  temperature: null, temperatureMode: null,
  vent: null, ventMode: null, humidity: null, preCool: '',
  stowage: 0, remarks: '',
  movements: [
    { code: 'FULL IN', txNo: '', date: '', status: false, yard: '', truck: '' },
    { code: 'LOAD',    txNo: '', date: '', status: false, yard: '', truck: '' },
  ],
  vas: [],
};

const AUDIT_LOG = [
  { by: 'SOMPORN',     on: '2026-04-23T11:46', action: 'Modified vessel details',         field: 'Voyage No → 0344-022B' },
  { by: 'SOMPORN',     on: '2026-04-23T11:30', action: 'Added container #15',             field: 'EITU9845677 · 40HC' },
  { by: 'System·EDI',  on: '2026-04-24T00:45', action: 'FULL IN recorded via EIR',        field: 'EITU9845677 · Truck GISCT1260412213' },
  { by: 'System·EDI',  on: '2026-04-24T00:42', action: 'FULL IN recorded via EIR',        field: 'EITU9844201 · Truck GISCT1260412209' },
  { by: 'SOMPORN',     on: '2026-04-23T11:26', action: 'Booking created',                 field: 'EGLV149602390729 · EXP CY/CY' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Whole days from today to a cut-off, or null when there is no date.
 *
 * It returned NaN before, which reached the screen as "NaNd" the moment the
 * booking had no vessel call yet. A countdown to nothing is not zero days, and
 * it is not an error either — it is nothing, and the header says so.
 */
function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const at = new Date(dateStr).getTime();
  if (Number.isNaN(at)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((at - today.getTime()) / 86400000);
}

function urgencyColor(days: number | null) {
  if (days === null) return { bg: 'var(--gecko-bg-subtle)', color: 'var(--gecko-text-disabled)', bar: 'var(--gecko-border)' };
  if (days > 7)  return { bg: 'var(--gecko-success-100)', color: 'var(--gecko-success-700)', bar: 'var(--gecko-success-500)' };
  if (days > 3)  return { bg: 'var(--gecko-warning-100)', color: 'var(--gecko-warning-700)', bar: 'var(--gecko-warning-500)' };
  if (days >= 0) return { bg: 'var(--gecko-danger-100)',  color: 'var(--gecko-danger-700)',  bar: 'var(--gecko-danger-500)'  };
  return           { bg: 'var(--gecko-gray-100)',         color: 'var(--gecko-gray-600)',    bar: 'var(--gecko-gray-400)'    };
}

function containerStatus(c: Container): ContainerStatus {
  const done = c.movements.filter(m => m.status);
  if (done.length === 0) return 'NO_ACTIVITY';
  const codes = done.map(m => m.code);
  if (codes.includes('LOAD') || codes.includes('DISCHARGE')) return c.movements[0].code === 'LOAD' ? 'LOADED' : 'DISCHARGED';
  if (codes.includes('FULL IN')) return 'FULL_IN';
  if (codes.includes('FULL OUT')) return 'FULL_OUT';
  return 'PARTIAL';
}

const STATUS_STYLE: Record<ContainerStatus, { dot: string; label: string; color: string }> = {
  NO_ACTIVITY: { dot: 'var(--gecko-gray-300)',    label: 'Awaiting',   color: 'var(--gecko-text-disabled)' },
  PARTIAL:     { dot: 'var(--gecko-info-400)',    label: 'In Progress',color: 'var(--gecko-info-700)'      },
  FULL_IN:     { dot: 'var(--gecko-primary-500)', label: 'Full In',    color: 'var(--gecko-primary-700)'   },
  LOADED:      { dot: 'var(--gecko-success-500)', label: 'Loaded',     color: 'var(--gecko-success-700)'   },
  DISCHARGED:  { dot: 'var(--gecko-success-500)', label: 'Discharged', color: 'var(--gecko-success-700)'   },
  FULL_OUT:    { dot: 'var(--gecko-success-500)', label: 'Full Out',   color: 'var(--gecko-success-700)'   },
};

// ─── Container Drawer ─────────────────────────────────────────────────────────

function ContainerDrawer({ container, onClose, onDuplicate, onDelete, onSave, requirements }: {
  container: Container; onClose: () => void;
  onDuplicate: () => void; onDelete: () => void;
  /** Saves ONE box and returns the server's field errors, or null when it took it. */
  onSave: (c: Container) => Promise<Record<string, string[]> | null>;
  requirements: ApiRequirement[];
}) {
  const [form, setForm] = useState({ ...container });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]> | null>(null);
  const { toast } = useToast();

  /**
   * Which requirement line this box fills.
   *
   * The drawer asks for a type and a size, as Vector does; the API wants the
   * LINE. They are the same question — a line IS an equipment type and a count —
   * so the line is found from the type, preferring one that still has room.
   */
  /**
   * What the dropdowns offer.
   *
   * The booking's own requirement lines come first — those are what it has asked
   * for — but a booking raised on this screen starts with NO lines, and a list
   * narrowed to nothing is an empty dropdown and a dead screen. So when the
   * booking asks for nothing yet, the full list is offered and the line is
   * created from whatever the clerk picks (see ensureLine on the page).
   */
  const asked = [...new Set(requirements.map(r => r.equipmentTypeCode))];
  const sizesAsked = asked.length > 0
    ? [...new Set(asked.map(e => e.slice(0, 2)))]
    : ['20', '40', '45'];
  const typesForSize = [...new Set(asked.filter(e => e.startsWith(form.size)).map(e => e.slice(2)))];
  const typesAsked = typesForSize.length > 0
    ? typesForSize
    : ['GP', 'HC', 'RF', 'RE', 'HR', 'OT', 'FR', 'TK', 'PL'];

  function lineFor(size: string, type: string): number {
    const equip = `${size}${type}`;
    const matching = requirements.filter(r => r.equipmentTypeCode === equip);
    const withRoom = matching.find(r => r.qtyAssigned + r.qtyCompleted < r.qty);
    return (withRoom ?? matching[0])?.lineNo ?? 0;
  }

  async function save() {
    setBusy(true);
    setErrors(null);
    // lineFor returns 0 when the booking asks for nothing of this type yet; the
    // page then adds the line rather than refusing the box.
    const failed = await onSave({ ...form, lineNo: form.lineNo || lineFor(form.size, form.type) });
    setBusy(false);
    if (failed) { setErrors(failed); return; }
    onClose();
  }
  const isReefer = ['RF', 'RE', 'HR', 'RH'].includes(form.type);
  const isDG     = form.cargoCategory === 'DG';

  const set = (k: keyof Container, v: unknown) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} className="gecko-drawer-scrim" style={{ backdropFilter: 'blur(1px)' }} />

      {/* Drawer */}
      <div className="gecko-drawer" style={{ width: 480 }}>

        {/* Drawer header — branded primary-600 bar (kept inline: header tone is dynamic per drawer) */}
        <div style={{ padding: '16px 20px', background: 'var(--gecko-primary-600)', flexShrink: 0 }}>
          <div className="gecko-row gecko-row-between">
            <div className="gecko-row" style={{ gap: 10 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: 'var(--gecko-font-mono)', letterSpacing: '0.04em' }}>{form.containerNo || <span style={{ opacity: 0.5, fontSize: 14 }}>Not nominated</span>}</div>
              <div style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 700 }}>{form.size}{form.type}</div>
              <div style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 600 }}>{form.containerMode}</div>
              {isReefer && (
                <div className="gecko-inline-row" style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12, background: 'rgba(255,255,255,0.18)', color: '#fff', fontWeight: 700, gap: 3 }}>
                  <Icon name="thermometer" size={10} /> REEFER
                </div>
              )}
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#fff', padding: '5px 7px', display: 'flex' }}>
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>

        {/* Drawer body */}
        <div className="gecko-flex-1" style={{ overflowY: 'auto', padding: '0 20px 20px' }}>

          {/* ── Container Info ── */}
          <div className="gecko-mt-5">
            <div className="gecko-eyebrow gecko-mb-3">Container Info</div>

            {/* Container No (full width) */}
            {/* The server's answer, where the clerk is already looking. */}
            {errors && Object.keys(errors).length > 0 && (
              <div role="alert" className="gecko-alert gecko-alert-error gecko-mb-3">
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {Object.entries(errors).map(([field, msgs]) => (
                    <li key={field}><strong className="gecko-text-mono">{field}: </strong>{msgs.join(' ')}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="gecko-form-group gecko-mb-3">
              <label className="gecko-label">Container No <span className="gecko-helper-text" style={{ marginTop: 0, display: 'inline' }}>(leave blank if not yet nominated)</span></label>
              <input className="gecko-input gecko-text-mono" value={form.containerNo} onChange={e => set('containerNo', e.target.value)} placeholder="e.g. EITU9845677" />
            </div>

            {/* Type-Size + P/U Mode */}
            <div className="gecko-grid-2">
              <div className="gecko-form-group">
                <label className="gecko-label gecko-label-required">Type — Size</label>
                <div className="gecko-grid-2 gecko-stack-sm" style={{ gap: 6 }}>
                  <select className="gecko-input" value={form.size} onChange={e => set('size', e.target.value)}>
                    {sizesAsked.map(s => <option key={s}>{s}</option>)}
                  </select>
                  <select className="gecko-input" value={form.type} onChange={e => set('type', e.target.value)}>
                    {typesAsked.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">P/U Mode</label>
                <select className="gecko-input" value={form.haulage} onChange={e => set('haulage', e.target.value)}>
                  <option value="MERCHANT">P/U OWN — merchant haulage</option>
                  <option value="CARRIER">P/U ONLY — carrier haulage</option>
                </select>
              </div>
            </div>

            {/* Container Class + Cargo Cat */}
            <div className="gecko-grid-2 gecko-mt-3">
              <div className="gecko-form-group">
                <label className="gecko-label">Container Class</label>
                <select className="gecko-input" value={form.grade} onChange={e => set('grade', e.target.value)}>
                  {['NONE', 'A', 'B', 'C'].map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label gecko-label-required">Cargo Cat</label>
                <select className="gecko-input" value={form.cargoCategory} onChange={e => set('cargoCategory', e.target.value)}>
                  {['GENERAL', 'DG', 'REEFER', 'OOG', 'BREAKBULK', 'VEHICLE', 'EMPTY'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* IMO/UN No (always visible — required when DG, optional otherwise) */}
            <div className="gecko-grid-2 gecko-mt-3">
              <div className="gecko-form-group">
                <label className={`gecko-label ${isDG ? 'gecko-label-required' : ''}`}>IMO / UN No</label>
                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 6 }}>
                  <select className="gecko-input" value={form.imoClass ?? ''} onChange={e => set('imoClass', e.target.value)}>
                    <option value="">G1.0</option>
                    {['1','2','3','4','5','6','7','8','9'].map(c => <option key={c}>Class {c}</option>)}
                  </select>
                  <input
                    className="gecko-input gecko-text-mono"
                    value={form.unNo}
                    onChange={e => set('unNo', e.target.value)}
                    placeholder={isDG ? 'UN____' : 'N/A'}
                    disabled={!isDG}
                    style={{ background: !isDG ? 'var(--gecko-bg-subtle)' : undefined }}
                  />
                </div>
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">Container Mode</label>
                <select className="gecko-input" value={form.containerMode} onChange={e => set('containerMode', e.target.value)}>
                  <option value="CY">CY — Container Yard</option>
                  <option value="CFS">CFS — Freight Station</option>
                  <option value="DOOR">DOOR — Shipper/Consignee</option>
                  <option value="RAMP">RAMP — Rail Ramp</option>
                </select>
              </div>
            </div>

            {/* Weight / Volume + Pickup Date */}
            <div className="gecko-grid-2 gecko-mt-3">
              <div className="gecko-form-group">
                <label className="gecko-label">Weight / Vol</label>
                <div className="gecko-grid-2" style={{ gap: 6 }}>
                  <input
                    className="gecko-input gecko-text-mono" type="number" min="0" step="0.01"
                    value={form.weight || ''} onChange={e => set('weight', parseFloat(e.target.value) || 0)}
                    placeholder="kg" style={{ textAlign: 'right' }}
                  />
                  <input
                    className="gecko-input gecko-text-mono" type="number" min="0" step="0.001"
                    value={form.volume || ''} onChange={e => set('volume', parseFloat(e.target.value) || 0)}
                    placeholder="m³" style={{ textAlign: 'right' }}
                  />
                </div>
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label gecko-label-required">Pickup Date</label>
                <DateField value={form.pickupDate} onChange={v => set('pickupDate', v)} />
              </div>
            </div>
          </div>

          {/* ── Parameters · Temperature (reefer-only) + Vent / Humidity / Pre-Cool (always editable) ── */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px dashed var(--gecko-border)' }}>
            <div className="gecko-eyebrow gecko-row gecko-mb-3" style={{ gap: 6 }}>
              <Icon name="thermometer" size={12} />
              Container Parameters
            </div>

            {/* Temperature — gated on reefer */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 10 }}>
              <div className="gecko-form-group">
                <label className="gecko-label gecko-row" style={{ gap: 6 }}>
                  Temperature
                  {!isReefer && <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--gecko-text-disabled)' }}>(reefer types only)</span>}
                </label>
                <input
                  className="gecko-input gecko-text-mono" type="number"
                  value={form.temperature ?? ''} onChange={e => set('temperature', parseFloat(e.target.value))}
                  disabled={!isReefer} style={{ background: !isReefer ? 'var(--gecko-bg-subtle)' : undefined }}
                  placeholder={isReefer ? 'e.g. -18.0' : ''}
                />
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">Unit</label>
                <select
                  className="gecko-input" value={form.temperatureMode ?? 'CEL'}
                  onChange={e => set('temperatureMode', e.target.value)}
                  disabled={!isReefer} style={{ background: !isReefer ? 'var(--gecko-bg-subtle)' : undefined }}
                >
                  <option>CEL</option><option>FAH</option>
                </select>
              </div>
            </div>

            {/* Vent — always editable */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 10, marginTop: 4 }}>
              <div className="gecko-form-group">
                <label className="gecko-label">Vent</label>
                <input
                  className="gecko-input gecko-text-mono" type="number"
                  value={form.vent ?? ''} onChange={e => set('vent', parseFloat(e.target.value))}
                  placeholder="e.g. 15"
                />
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">Mode</label>
                <select
                  className="gecko-input" value={form.ventMode ?? 'VEN'}
                  onChange={e => set('ventMode', e.target.value)}
                >
                  <option>VEN</option><option>CBM</option><option>CFH</option>
                </select>
              </div>
            </div>

            {/* Humidity — always editable */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 10, marginTop: 4 }}>
              <div className="gecko-form-group">
                <label className="gecko-label">Humidity (%)</label>
                <input
                  className="gecko-input gecko-text-mono" type="number" min="0" max="100"
                  value={form.humidity ?? ''} onChange={e => set('humidity', parseFloat(e.target.value))}
                  placeholder="e.g. 85"
                />
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">Mode</label>
                <select className="gecko-input" defaultValue="NA">
                  <option>NA</option><option>HCS</option>
                </select>
              </div>
            </div>

            {/* Pre-Cool — always editable */}
            <div className="gecko-form-group gecko-mt-1">
              <label className="gecko-label">Pre-Cool</label>
              <input
                className="gecko-input" value={form.preCool}
                onChange={e => set('preCool', e.target.value)}
                placeholder="e.g. Yes / 2h before gate-in"
              />
            </div>
          </div>

          {/* ── Seals + Stowage ── */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px dashed var(--gecko-border)' }}>
            <div className="gecko-eyebrow gecko-mb-3">Seals &amp; Stowage</div>
            <div className="gecko-grid-2">
              <div className="gecko-form-group">
                <label className="gecko-label">Agent Seal</label>
                <input className="gecko-input gecko-text-mono" value={form.sealAgent} onChange={e => set('sealAgent', e.target.value)} placeholder="e.g. EMCSAS7084" />
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">Customer Seal</label>
                <input className="gecko-input gecko-text-mono" value={form.sealCustomer} onChange={e => set('sealCustomer', e.target.value)} placeholder="Optional" />
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">Stowage</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <select className="gecko-input" value={form.stowage} onChange={e => set('stowage', parseInt(e.target.value, 10))}>
                    {[0, 1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}
                  </select>
                  <input className="gecko-input gecko-text-mono" placeholder="Slot" />
                </div>
              </div>
            </div>
          </div>

          {/* ── Remarks ── */}
          <div className="gecko-form-group" style={{ marginTop: 20, paddingTop: 16, borderTop: '1px dashed var(--gecko-border)' }}>
            <label className="gecko-label">Remarks</label>
            <textarea className="gecko-input" rows={3} value={form.remarks} onChange={e => set('remarks', e.target.value)} style={{ resize: 'vertical', minHeight: 72 }} />
          </div>
        </div>

        {/* Drawer footer */}
        <div className="gecko-drawer-footer" style={{ justifyContent: 'flex-start' }}>
          <button onClick={onDuplicate} className="gecko-btn gecko-btn-ghost gecko-btn-sm" style={{ color: 'var(--gecko-text-secondary)' }}><Icon name="copy" size={13} /> Duplicate</button>
          <button onClick={onDelete}    className="gecko-btn gecko-btn-ghost gecko-btn-sm" style={{ color: 'var(--gecko-danger-600)' }}><Icon name="trash" size={13} /> Delete</button>
          <div className="gecko-flex-1" />
          <button onClick={onClose} className="gecko-btn gecko-btn-outline gecko-btn-sm">Cancel</button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={busy} onClick={() => void save()}>
            <Icon name="save" size={13} /> {busy ? 'Saving…' : 'Save Container'}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

/** A value the API derives or the sailing owns — shown, never typed. */
function Derived({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="gecko-stack gecko-stack-xs">
      <div className="gecko-eyebrow">{label}</div>
      <div className="gecko-readonly-value" style={{ fontFamily: mono ? 'var(--gecko-font-mono)' : 'inherit' }}>
        {value || '—'}
      </div>
    </div>
  );
}

/**
 * The booking header: parties, the sailing, the ports, the references.
 *
 * It owns no state. The page owns the form and the save, because the header's
 * Save button lives up in the sticky bar and because step 1 is ONE call —
 * POST /api/tos/bookings with requirements: [] — not a save per panel.
 */
function TabVoyage({ form, patch, created, direction, canOverride, needsVessel, portsRequired, onSave, saving, missing, saveError }: {
  form: HeaderForm;
  patch: (p: Partial<HeaderForm>) => void;
  created: SavedBooking | null;
  direction: string | null;
  canOverride: boolean;
  /** Does this order type run against a sailing? Decides what is marked required. */
  needsVessel: boolean;
  /** Loading and destination ports are required only on a scheduled EXPORT booking. */
  portsRequired: boolean;
  onSave: () => void;
  saving: boolean;
  /** Why the booking cannot be saved yet, or null when it can. */
  missing: string | null;
  saveError: ApiError | null;
}) {
  // A booking that does not exist yet is always being typed into.
  const [editing, setEditing] = useState(true);
  const editMode = created === null || editing;

  const { data: calls } = useApiList<CallSummary>(CALLS_PATH);
  const call = (calls ?? []).find(c => c.vesselCallId === form.vesselCallId) ?? null;

  const { data: cutoffs } = useApi<EffectiveCutoff[]>(
    call ? effectiveCutoffsPath(call.vesselCallId, null) : null);
  const cutoffAt = (kind: string) => (cutoffs ?? []).find(c => c.kind === kind)?.at ?? '';

  // GATE_API_FOR_UI.md §18: the shipper IS the customer. Only the LABEL changes
  // — "Shipper" when the box is going out, "Consignee" when it is coming in —
  // because that is the word the clerk uses for the same party.
  const customerLabel = direction === 'IMPORT' ? 'Consignee' : 'Shipper';

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ padding: '24px' }}>

      {/* References */}
      <div>
        <div className="gecko-eyebrow gecko-row gecko-mb-4"><Icon name="fileText" size={14} /> References</div>
        <div className="gecko-grid-2" style={{ gap: 18, padding: '16px 20px', background: 'var(--gecko-bg-subtle)', borderRadius: 10, border: '1px solid var(--gecko-border)' }}>
          <div>
            <div className="gecko-eyebrow gecko-mb-1">
              Booking / B&#47;L No <span style={{ color: 'var(--gecko-danger-600)' }}>*</span>
            </div>
            {editMode
              ? <input className="gecko-input gecko-input-sm gecko-text-mono" value={form.carrierRef} maxLength={50}
                  placeholder="The line&apos;s booking or B/L number"
                  onChange={e => patch({ carrierRef: e.target.value.toUpperCase() })} />
              : <div className="gecko-readonly-value">{form.carrierRef || '—'}</div>}
          </div>
          <div>
            <div className="gecko-eyebrow gecko-mb-1">Sub Booking / B&#47;L No</div>
            {editMode
              ? <input className="gecko-input gecko-input-sm gecko-text-mono" value={form.customerRef} maxLength={40}
                  onChange={e => patch({ customerRef: e.target.value.toUpperCase() })} />
              : <div className="gecko-readonly-value">{form.customerRef || '—'}</div>}
          </div>
        </div>
      </div>

      {/* Parties */}
      <div>
        <div className="gecko-row gecko-row-between gecko-mb-4">
          <div className="gecko-eyebrow gecko-row"><Icon name="users" size={14} /> Parties</div>
          {created && (
            <button onClick={() => setEditing(!editing)} className="gecko-btn gecko-btn-ghost gecko-btn-sm" style={{ fontSize: 11 }}>
              <Icon name={editing ? 'x' : 'edit'} size={13} /> {editing ? 'Cancel' : 'Edit'}
            </button>
          )}
        </div>
        <div className="gecko-grid-2" style={{ gap: 18, padding: '16px 20px', background: 'var(--gecko-bg-subtle)', borderRadius: 10, border: '1px solid var(--gecko-border)' }}>
          <div>
            <div className="gecko-eyebrow gecko-mb-1">Shipping Agent / Line</div>
            {editMode
              ? <PartyPicker role="SHIPPING_LINE" value={form.agentCode || null}
                  onChange={v => patch({ agentCode: v ?? '' })} placeholder="Search agent or line…" />
              : <div className="gecko-readonly-value">{form.agentCode || '—'}</div>}
          </div>
          <div>
            <div className="gecko-eyebrow gecko-mb-1">
              {customerLabel} <span style={{ color: 'var(--gecko-danger-600)' }}>*</span>
            </div>
            {editMode
              ? <PartyPicker role="CUSTOMER" value={form.customerCode || null}
                  onChange={v => patch({ customerCode: v ?? '' })} placeholder={`Search ${customerLabel.toLowerCase()}…`} />
              : <div className="gecko-readonly-value">{form.customerCode || '—'}</div>}
          </div>
          {/* Derived by the API from the line's MDM operator code — never sent. */}
          <Derived label="Container Owner" value={created?.containerOwnerCode ?? null} mono />
          <div>
            <div className="gecko-eyebrow gecko-mb-1">Freight Forwarder</div>
            {editMode
              ? <PartyPicker role="FORWARDER" value={form.forwarderCode || null}
                  onChange={v => patch({ forwarderCode: v ?? '' })} placeholder="Search forwarder…" />
              : <div className="gecko-readonly-value">{form.forwarderCode || '—'}</div>}
          </div>
        </div>
      </div>

      {/* Vessel & Voyage */}
      <div>
        <div className="gecko-eyebrow gecko-row gecko-mb-4"><Icon name="ship" size={14} /> Vessel &amp; Voyage</div>
        <div style={{ padding: '16px 20px', background: 'var(--gecko-bg-subtle)', borderRadius: 10, border: '1px solid var(--gecko-border)' }}>
          {/* The vessel call is the ONE thing chosen here. Vessel, voyage, wharf
              and ETD belong to the sailing (§18): a booking that could retype
              them is a booking that disagrees with every other booking on the
              same ship. */}
          <div className="gecko-stack gecko-stack-xs" style={{ marginBottom: 18 }}>
            <div className="gecko-eyebrow">
              Vessel call{needsVessel && <span style={{ color: 'var(--gecko-danger-600)' }}> *</span>}
            </div>
            {!needsVessel && (
              <div className="gecko-cell-meta">
                This work order type is depot work — a sailing is optional.
              </div>
            )}
            <select className="gecko-input gecko-input-sm" value={form.vesselCallId}
              onChange={e => patch({ vesselCallId: e.target.value })} disabled={!editMode}>
              <option value="">Awaiting the line&apos;s schedule</option>
              {(calls ?? []).filter(c => c.status !== 'CANCELLED').map(c => (
                <option key={c.vesselCallId} value={c.vesselCallId}>
                  {c.callRef} · ETD {formatDate(c.etd)}{c.lines?.length ? ` · ${c.lines.join(', ')}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="gecko-grid-4" style={{ gap: 18 }}>
            <Derived label="Vessel Name" value={call?.vesselName ?? null} />
            <Derived label="Vessel Code" value={call?.vesselCode ?? null} mono />
            <Derived label="Voyage No" value={[call?.operatorVoyageIn, call?.operatorVoyageOut].filter(Boolean).join(' / ') || null} mono />
            <Derived label="Wharf" value={call?.terminalCode ?? null} />
            <PortField label="Loading Port" required={portsRequired} value={form.polPortCode} editMode={editMode}
              seaportsFirst onChange={(v, p) => patch({ polPortCode: v, polPort: p })} />
            <PortField label="Discharge Port" value={form.podPortCode} editMode={editMode}
              onChange={(v, p) => patch({ podPortCode: v, podPort: p })} />
            <PortField label="Destination Port" required={portsRequired} value={form.fpdPortCode} editMode={editMode}
              onChange={(v, p) => patch({ fpdPortCode: v, fpdPort: p })} />
            {/* The destination port's trade mode, or the discharge port's when
                there is no destination. After a save the API's own value wins. */}
            <Derived label="Trade Mode"
              value={created?.tradeModeCode ?? form.fpdPort?.tradeMode ?? form.podPort?.tradeMode ?? null} />
          </div>

          <div className="gecko-row gecko-stack-md" style={{ marginTop: 18 }}>
            <div className="gecko-stack gecko-stack-xs">
              <div className="gecko-eyebrow">ETD</div>
              {/* The sailing's, not the booking's. */}
              <div style={{ fontSize: 15, fontWeight: 800, color: call ? 'var(--gecko-primary-700)' : 'var(--gecko-text-disabled)', fontFamily: 'var(--gecko-font-mono)' }}>
                {call ? formatDate(call.etd) : '—'}
              </div>
            </div>
            <div className="gecko-row">
              {/* §17a: only tos.cutoff.override may set it. Shown to everyone so
                  a clerk learns the tick exists and is not theirs to give. */}
              <label className="gecko-row" style={{ gap: 6, fontSize: 12, color: 'var(--gecko-text-secondary)', cursor: canOverride ? 'pointer' : 'default' }}>
                <input type="checkbox" checked={form.allowLateGateIn} disabled={!editMode || !canOverride}
                  onChange={e => patch({ allowLateGateIn: e.target.checked })} /> Allow Late Gate-In
              </label>
            </div>
            <div className="gecko-form-group" style={{ marginBottom: 0 }}>
              <label className="gecko-label" style={{ fontSize: 10 }}>Paperless Code</label>
              <input className="gecko-input gecko-input-sm gecko-text-mono" value={form.paperlessCode} maxLength={30}
                placeholder="Optional" style={{ width: 120 }} disabled={!editMode}
                onChange={e => patch({ paperlessCode: e.target.value.toUpperCase() })} />
            </div>
          </div>
        </div>
      </div>

      {/* Cut-off Dates */}
      <div>
        <div className="gecko-eyebrow gecko-row gecko-mb-4"><Icon name="clock" size={14} /> Cut-off Dates</div>
        <div className="gecko-grid-3">
          {/* ALWAYS read-only (§18). A late box is let in by Allow Late Gate-In
              or a cut-off exception — never by editing a date here, which would
              move it for every booking on the sailing. */}
          {[
            { label: 'CY Cut-off (Dry)',     value: cutoffAt('YARD_DRY') },
            { label: 'CY Cut-off (Reefer)',  value: cutoffAt('YARD_REEFER') },
            { label: 'CFS Cut-off (Dry)',    value: cutoffAt('CFS_DRY') },
            { label: 'CFS Cut-off (Reefer)', value: cutoffAt('CFS_REEFER') },
            { label: 'Port Cut-off (Dry)',   value: cutoffAt('PORT_DRY') },
            { label: 'Port Cut-off (Reefer)',value: cutoffAt('PORT_REEFER') },
          ].map(co => {
            const d = daysUntil(co.value);
            const u = urgencyColor(d);
            return (
              <div key={co.label} style={{ padding: '12px 14px', borderRadius: 8, background: u.bg, border: `1px solid ${u.bar}30` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: u.color, marginBottom: 4 }}>{co.label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--gecko-font-mono)', color: u.color }}>{d === null ? '—' : `${d}d`}</div>
                <div style={{ fontSize: 10, color: u.color, opacity: 0.8, marginTop: 1 }}>{formatDateTime(co.value)}</div>
              </div>
            );
          })}
        </div>
        {!call && <div className="gecko-cell-meta gecko-mt-2">Pick a vessel call to see its cut-offs.</div>}
      </div>

      {/* The step's own action bar. The sticky header carries a Save too, but a
          clerk who has just filled in the last field is HERE, at the bottom —
          and this is the button that says what happens next. */}
      <div className="gecko-action-toolbar gecko-action-toolbar-between" style={{ alignItems: 'center' }}>
        {saveError && (
          <div role="alert" className="gecko-field-error gecko-flex-1">
            {saveError.status === 409 && saveError.extension<string>('existingOrderNo')
              ? `That booking already exists: ${saveError.extension<string>('existingOrderNo')}.`
              : saveError.message}
          </div>
        )}
        {!saveError && (
          <div className="gecko-cell-meta gecko-flex-1">
            {created
              ? <>Saved as <strong>{created.orderNo}</strong>. Containers are next.</>
              : missing ?? 'Ready — this creates the booking and opens the Containers tab.'}
          </div>
        )}
        <button className="gecko-btn gecko-btn-primary gecko-btn-sm"
          disabled={saving || !!missing || created !== null}
          title={missing ?? undefined}
          onClick={onSave}>
          <Icon name="save" size={13} />
          {saving ? 'Saving…' : created ? 'Saved' : 'Save & proceed to Containers'}
          {!saving && !created && <Icon name="arrowRight" size={13} />}
        </button>
      </div>
    </div>
  );
}

/** A port, searched from master data — never typed (the API 400s an unknown code). */
function PortField({ label, value, required, editMode, seaportsFirst, onChange }: {
  label: string; value: string; required?: boolean; editMode: boolean;
  seaportsFirst?: boolean;
  onChange: (portCode: string, port: Port | null) => void;
}) {
  return (
    <div className="gecko-stack gecko-stack-xs">
      <div className="gecko-eyebrow">
        {label}{required && <span style={{ color: 'var(--gecko-danger-600)' }}> *</span>}
      </div>
      {editMode
        ? <PortPicker value={value} onChange={onChange} required={required} seaportsFirst={seaportsFirst} />
        : <div className="gecko-readonly-value">{value || '—'}</div>}
    </div>
  );
}


function TabContainers({ containers, requirements, onSelectContainer, onAddContainer, onDeleteContainer, orderTypeCode, selected, setSelected, canAddContainers, onAddMultiple, onDeleteMany, onSetHandover, handoverModes }: {
  onSelectContainer: (c: Container) => void;
  onAddContainer: () => void;
  onDeleteContainer: (id: string) => void;
  orderTypeCode: string;
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  /** False until the booking exists: a box is assigned TO a booking. */
  canAddContainers: boolean;
  /** The booking's boxes, as the API has them. */
  containers: Container[];
  requirements: ApiRequirement[];
  /** Paste-many: saves every number in ONE batch call. */
  onAddMultiple: (p: { numbers: string[]; size: string; type: string; cargoCat: string }) => Promise<void>;
  onDeleteMany: (ids: string[]) => Promise<void>;
  onSetHandover: (ids: string[], mode: string) => Promise<void>;
  handoverModes: { value: string; label: string }[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [addMultipleOpen, setAddMultipleOpen] = useState(false);
  const [vasDrawer, setVasDrawer] = useState<null | { mode: 'single' | 'multi'; containerIds: string[] }>(null);
  const { toast } = useToast();

  const orderType = useMemo(() => getOrderType(orderTypeCode), [orderTypeCode]);
  const orderTypeVAS = useMemo<OrderTypeVASDef[]>(() => {
    // De-duplicate by code (some movements share VAS codes)
    const seen = new Set<string>();
    const out: OrderTypeVASDef[] = [];
    (orderType?.movements ?? []).forEach(m => m.vasCharges.forEach(v => {
      if (!seen.has(v.code)) { seen.add(v.code); out.push(v); }
    }));
    return out;
  }, [orderType]);

  const filtered = containers.filter(c =>
    !search || (c.containerNo ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const toggleAll = (checked: boolean) =>
    setSelected(checked ? new Set(filtered.map(c => c.id)) : new Set());

  const toggleExpand = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const summary = {
    total: containers.length,
    fullIn: containers.filter(c => containerStatus(c) === 'FULL_IN' || containerStatus(c) === 'LOADED').length,
    awaiting: containers.filter(c => containerStatus(c) === 'NO_ACTIVITY').length,
  };

  return (
    <div className="gecko-stack gecko-stack-lg" style={{ padding: '20px 24px' }}>
      {/* Mini stats */}
      <div className="gecko-kpi-strip">
        {[
          { label: 'Total Containers', val: summary.total,    color: 'var(--gecko-text-primary)'    },
          { label: 'Full In',          val: summary.fullIn,   color: 'var(--gecko-primary-600)'     },
          { label: 'Awaiting',         val: summary.awaiting, color: 'var(--gecko-warning-600)'     },
          // Was a hardcoded '40HC × 8' from the mock. Until requirement lines are
          // wired this is simply what is on the booking, which is nothing yet.
          { label: 'On Booking',       val: `${containers.length}`, color: 'var(--gecko-text-secondary)'  },
        ].map(s => (
          <div key={s.label} className="gecko-kpi-cell" style={{ textAlign: 'center' }}>
            <div className="gecko-stat-num-22" style={{ fontWeight: 800, color: s.color, fontFamily: 'var(--gecko-font-mono)', lineHeight: 1 }}>{s.val}</div>
            <div className="gecko-eyebrow gecko-mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="gecko-row gecko-stack-md">
        <div className="gecko-flex-1" style={{ position: 'relative', maxWidth: 280 }}>
          <Icon name="search" size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-text-disabled)', pointerEvents: 'none' }} />
          <input className="gecko-input gecko-input-sm" placeholder="Search container no…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 28 }} />
        </div>
        <div className="gecko-row gecko-ml-auto">
          {selected.size > 0 && (
            <span className="gecko-pill gecko-pill-primary" style={{ fontSize: 11, padding: '4px 10px' }}>
              {selected.size} selected
            </span>
          )}
          <BulkActionsMenu
            selectedCount={selected.size}
            totalCount={filtered.length}
            onSelectAll={() => setSelected(new Set(filtered.map(c => c.id)))}
            onUnselectAll={() => setSelected(new Set())}
            onAddMultiple={() => setAddMultipleOpen(true)}
            onUpdateMultiple={() => toast({ variant: 'info', title: 'Update Multiple', message: 'Bulk-update form coming next iteration.' })}
            onDeleteMultiple={() => {
              if (window.confirm(`Take ${selected.size} box(es) off this booking? Their pending steps are cancelled.`)) {
                void onDeleteMany([...selected]).then(() => setSelected(new Set()));
              }
            }}
            onUpdateVAS={() => setVasDrawer({ mode: 'multi', containerIds: [...selected] })}
            onUpdatePUDO={() => {
              // The legal modes depend on the booking's direction, so they are
              // offered rather than typed — the API refuses anything else.
              const legal = handoverModes.map(m => `${m.value} — ${m.label}`).join("\n");
              const choice = window.prompt(
                `Set the mode on ${selected.size} box(es).\n\n${legal}`,
                handoverModes[0]?.value ?? '');
              const mode = choice?.trim().toUpperCase();
              if (mode && handoverModes.some(m => m.value === mode)) void onSetHandover([...selected], mode);
              else if (mode) toast({ variant: 'warning', title: 'Not a mode of this booking', message: mode });
            }}
            onClearDetails={() => { setSelected(new Set()); setExpanded(new Set()); toast({ variant: 'info', title: 'Cleared', message: 'Selection and expanded rows reset.' }); }}
          />
          {/* A box is assigned TO a booking, so there has to be one first. */}
          {canAddContainers && (
            <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={onAddContainer}>
              <Icon name="plus" size={13} /> Add Container
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="gecko-table-card">
        <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 12.5 }}>
          <thead>
            <tr>
              {/* Both leading columns are as narrow as their contents: the
                  table had a scrollbar and the right-hand panel was cut off. */}
              <th style={{ width: 28 }}><input type="checkbox" onChange={e => toggleAll(e.target.checked)} /></th>
              <th style={{ width: 24 }} aria-label="Expand" />
              <th style={{ width: 148 }}>Container No</th>
              <th style={{ width: 72 }}>Size/Type</th>
              <th style={{ width: 60 }}>Mode</th>
              <th style={{ width: 90 }}>Cargo Cat</th>
              <th style={{ width: 100 }}>Status</th>
              <th style={{ width: 120 }}>Agent Seal</th>
              <th style={{ width: 88 }}>Pickup Date</th>
              <th style={{ width: 60 }} aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => {
              const st  = containerStatus(c);
              const ss  = STATUS_STYLE[st];
              const sel = selected.has(c.id);
              const isExp = expanded.has(c.id);
              return (
                <React.Fragment key={c.id}>
                  <tr
                    className="gecko-table-row-expandable"
                    data-expanded={isExp ? 'true' : undefined}
                    onClick={() => onSelectContainer(c)}
                    style={{ background: sel ? 'var(--gecko-primary-50)' : undefined }}
                  >
                    <td onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={sel} onChange={e => {
                        const next = new Set(selected);
                        e.target.checked ? next.add(c.id) : next.delete(c.id);
                        setSelected(next);
                      }} />
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <button
                        className="gecko-table-expand-toggle"
                        data-expanded={isExp ? 'true' : undefined}
                        onClick={() => toggleExpand(c.id)}
                        aria-label={isExp ? 'Collapse details' : 'Expand details'}
                      >
                        <Icon name={isExp ? 'chevronDown' : 'chevronRight'} size={13} />
                      </button>
                    </td>

                    <td>
                      <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, fontSize: 12.5, color: c.containerNo ? 'var(--gecko-text-primary)' : 'var(--gecko-text-disabled)' }}>
                        {c.containerNo || 'Not nominated'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-primary-700)', background: 'var(--gecko-primary-50)', padding: '2px 6px', borderRadius: 4 }}>{c.size}{c.type}</span>
                    </td>
                    <td><span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--gecko-text-secondary)' }}>{c.containerMode}</span></td>
                    <td className="gecko-cell-meta">{c.cargoCategory}</td>
                    <td>
                      <span className="gecko-inline-row" style={{ gap: 5, fontSize: 11, fontWeight: 700, color: ss.color }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: ss.dot, flexShrink: 0 }} />
                        {ss.label}
                      </span>
                    </td>
                    <td className="gecko-cell-meta" style={{ fontFamily: 'var(--gecko-font-mono)' }}>{c.sealAgent || '—'}</td>
                    <td className="gecko-cell-meta" style={{ fontFamily: 'var(--gecko-font-mono)', whiteSpace: 'nowrap' }}>{c.pickupDate}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="gecko-row gecko-row-right" style={{ gap: 2 }}>
                        <button onClick={() => onSelectContainer(c)} className="gecko-icon-btn-ghost" title="Edit"><Icon name="edit" size={13} /></button>
                        <button className="gecko-icon-btn-ghost" title="Duplicate"><Icon name="copy" size={13} /></button>
                        <button onClick={() => onDeleteContainer(c.id)} className="gecko-icon-btn-ghost" style={{ color: 'var(--gecko-danger-400)' }} title="Delete"><Icon name="trash" size={13} /></button>
                      </div>
                    </td>
                  </tr>
                  {isExp && (
                    <tr className="gecko-table-row-expand-panel">
                      <td colSpan={10}>
                        <ExpandedContainerPanel
                          container={c}
                          orderType={orderType}
                          onManageVAS={() => setVasDrawer({ mode: 'single', containerIds: [c.id] })}
                          onEdit={() => onSelectContainer(c)}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="gecko-row gecko-cell-meta">
        <span>Showing {filtered.length} of {containers.length} containers</span>
        <span style={{ color: 'var(--gecko-text-disabled)' }}>·</span>
        <span>Click the chevron to expand · click anywhere else on a row to edit</span>
      </div>

      {addMultipleOpen && (
        <AddMultipleContainersModal
          requirements={requirements}
          onCancel={() => setAddMultipleOpen(false)}
          onConfirm={async p => { await onAddMultiple(p); setAddMultipleOpen(false); }}
        />
      )}

      {vasDrawer && (
        <VasDrawer
          mode={vasDrawer.mode}
          containerIds={vasDrawer.containerIds}
          availableVAS={orderTypeVAS}
          orderTypeCode={orderTypeCode}
          initialSelected={vasDrawer.mode === 'single'
            ? new Set((containers.find(c => c.id === vasDrawer.containerIds[0])?.vas ?? []).map(v => v.chargeCode))
            : new Set()
          }
          onCancel={() => setVasDrawer(null)}
          onSave={(codes) => {
            const n = vasDrawer.containerIds.length;
            toast({
              variant: 'success',
              title: vasDrawer.mode === 'single' ? 'VAS saved' : `VAS applied to ${n} containers`,
              message: `${codes.size} VAS line${codes.size === 1 ? '' : 's'} set${vasDrawer.mode === 'multi' ? ` across ${n} containers` : ''}.`,
            });
            setVasDrawer(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * Cargo & docs — the shipper's DECLARED totals for the booking.
 *
 * They are typed, not added up from the boxes: what the customer declared and
 * what actually turned up are different numbers, and the difference is the thing
 * worth seeing. The boxes carry their own weight and volume separately.
 */
function TabCargo({ form, patch, created, onSave, saving, error }: {
  form: HeaderForm;
  patch: (p: Partial<HeaderForm>) => void;
  created: SavedBooking | null;
  onSave: () => void;
  saving: boolean;
  error: ApiError | null;
}) {
  const uoms = useCodeList('UOM');
  const err = (f: string) => error?.forField(f);

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ padding: '24px', maxWidth: 820 }}>
      {!created && (
        <div className="gecko-alert gecko-alert-info">
          Save the booking on Voyage &amp; Parties first — this is stored against it.
        </div>
      )}

      <div className="gecko-grid-2">
        <div className="gecko-form-group">
          <label className="gecko-label">Total Qty</label>
          <input className="gecko-input" type="number" min={1} value={form.totalQty} placeholder="—"
            onChange={e => patch({ totalQty: e.target.value })} />
          {err('totalQty') && <div className="gecko-field-error">{err('totalQty')}</div>}
        </div>
        <div className="gecko-form-group">
          <label className="gecko-label">UOM</label>
          <select className="gecko-input" value={form.uomCode} onChange={e => patch({ uomCode: e.target.value })}>
            <option value="">—</option>
            {uoms.values.map(u => <option key={u.code} value={u.code}>{u.code} — {u.descriptionEn}</option>)}
          </select>
          {err('uomCode') && <div className="gecko-field-error">{err('uomCode')}</div>}
        </div>
        <div className="gecko-form-group">
          <label className="gecko-label">Total Weight (KGS)</label>
          <input className="gecko-input gecko-text-mono" type="number" min={0} step="0.01"
            value={form.totalWeightKg} placeholder="0.00"
            onChange={e => patch({ totalWeightKg: e.target.value })} />
          {err('totalWeightKg') && <div className="gecko-field-error">{err('totalWeightKg')}</div>}
        </div>
        <div className="gecko-form-group">
          <label className="gecko-label">Total Volume (CBM)</label>
          <input className="gecko-input gecko-text-mono" type="number" min={0} step="0.01"
            value={form.totalVolumeCbm} placeholder="0.00"
            onChange={e => patch({ totalVolumeCbm: e.target.value })} />
          {err('totalVolumeCbm') && <div className="gecko-field-error">{err('totalVolumeCbm')}</div>}
        </div>
      </div>

      <div className="gecko-form-group">
        <label className="gecko-label">Commodity</label>
        {/* NOT free text: the API checks it against master data and answers
            "Unknown commodity 'ELECTRONICS'". A typed box here is a guaranteed
            400, so the list is offered — and said plainly when it is empty. */}
        <CommoditySelect value={form.commodityCode} onChange={v => patch({ commodityCode: v })} />
        {err('commodityCode') && <div className="gecko-field-error">{err('commodityCode')}</div>}
      </div>

      <div className="gecko-form-group">
        <label className="gecko-label">Cargo Category</label>
        <CargoCategorySelect value={form.cargoCategoryCode} onChange={v => patch({ cargoCategoryCode: v })} />
        {err('cargoCategoryCode') && <div className="gecko-field-error">{err('cargoCategoryCode')}</div>}
      </div>

      <div className="gecko-form-group">
        <label className="gecko-label">Marks &amp; Nos</label>
        <textarea className="gecko-input" rows={2} maxLength={200} value={form.marksAndNos}
          style={{ resize: 'vertical' }} onChange={e => patch({ marksAndNos: e.target.value })} />
        {err('marksAndNos') && <div className="gecko-field-error">{err('marksAndNos')}</div>}
      </div>

      <div className="gecko-form-group">
        <label className="gecko-label">Special Instructions</label>
        <textarea className="gecko-input" rows={3} maxLength={1000} value={form.specialInstruction}
          style={{ resize: 'vertical' }} onChange={e => patch({ specialInstruction: e.target.value })} />
        {err('specialInstruction') && <div className="gecko-field-error">{err('specialInstruction')}</div>}
      </div>

      <div className="gecko-form-group">
        <label className="gecko-label">Remarks</label>
        <textarea className="gecko-input" rows={2} maxLength={1000} value={form.remarks}
          style={{ resize: 'vertical' }} onChange={e => patch({ remarks: e.target.value })} />
        {err('remarks') && <div className="gecko-field-error">{err('remarks')}</div>}
      </div>

      <div className="gecko-action-toolbar gecko-action-toolbar-between" style={{ alignItems: 'center' }}>
        <div className="gecko-cell-meta gecko-flex-1">
          {error && !error.fieldErrors ? error.message : 'Declared by the shipper — not summed from the boxes.'}
        </div>
        <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={saving || !created} onClick={onSave}>
          <Icon name="save" size={13} /> {saving ? 'Saving…' : 'Save Cargo Details'}
        </button>
      </div>
    </div>
  );
}

/**
 * The tenant's commodities. Empty for KORAKIT today, so the control says so
 * rather than inviting a value the API will refuse.
 */
function CommoditySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data } = useApiList<{ commodityCode: string; descriptionEn: string }>('/api/master/commodities?pageSize=500');
  const items = data ?? [];
  return (
    <>
      <select className="gecko-input" value={value} disabled={items.length === 0}
        onChange={e => onChange(e.target.value)}>
        <option value="">Not stated</option>
        {items.map(c => <option key={c.commodityCode} value={c.commodityCode}>{c.commodityCode} — {c.descriptionEn}</option>)}
      </select>
      {items.length === 0 && (
        <div className="gecko-helper-text">No commodities in master data yet — add them under Master Data to use this.</div>
      )}
    </>
  );
}

/** The tenant's cargo categories, from the CARGO_CATEGORY code list. */
function CargoCategorySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const cargo = useCodeList('CARGO_CATEGORY');
  return (
    <select className="gecko-input" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">Not stated</option>
      {cargo.values.map(c => <option key={c.code} value={c.code}>{c.code} — {c.descriptionEn}</option>)}
    </select>
  );
}

function TabAudit() {
  return (
    <div style={{ padding: '24px' }}>
      <div className="gecko-table-card">
        <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ width: 120 }}>Date / Time</th>
              <th style={{ width: 110 }}>By</th>
              <th>Action</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {AUDIT_LOG.map((a, i) => (
              <tr key={i}>
                <td className="gecko-cell-sub" style={{ marginTop: 0, whiteSpace: 'nowrap' }}>
                  {formatDateTime(a.on)}
                </td>
                <td style={{ fontSize: 12, fontWeight: 600, color: a.by.startsWith('System') ? 'var(--gecko-info-700)' : 'var(--gecko-text-primary)' }}>
                  {a.by.startsWith('System') ? <span className="gecko-row" style={{ gap: 5 }}><Icon name="zap" size={11} style={{ color: 'var(--gecko-info-500)' }} />{a.by}</span> : a.by}
                </td>
                <td style={{ fontWeight: 500 }}>{a.action}</td>
                <td className="gecko-cell-sub" style={{ marginTop: 0 }}>{a.field}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

/**
 * THE booking screen — the same one for raising a booking and for editing one.
 *
 * `/bookings/new` renders it with no id and it starts empty; `/bookings/{id}`
 * renders it with an id and it loads that booking. There is deliberately no
 * second "edit" screen: a clerk who creates a booking and a clerk who opens one
 * see the same fields in the same places, and every change is made once.
 */
export function BookingWorkspace({ bookingId }: { bookingId?: string }) {
  // Voyage & Parties, not Containers: the June page opened on Containers
  // because it was showing a booking that already existed. A new booking has
  // nothing to show there, and the header is what has to be filled in first.
  const [activeTab, setActiveTab] = useState<'voyage' | 'containers' | 'cargo' | 'audit'>('voyage');
  const [drawerContainer, setDrawerContainer] = useState<Container | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [orderTypeCode, setOrderTypeCode] = useState<string>(BOOKING.orderType);

  // ── step 1: the header ────────────────────────────────────────────────────
  const [form, setForm] = useState<HeaderForm>(EMPTY_HEADER);
  const patch = useCallback((p: Partial<HeaderForm>) => setForm(f => ({ ...f, ...p })), []);
  const [created, setCreated] = useState<SavedBooking | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<ApiError | null>(null);
  // One key for this form: a double-click must not raise two bookings (§14).
  const [idempotencyKey] = useState(newIdempotencyKey);
  const { branch } = useFacility();
  const { can } = useSession();
  const canOverride = can('tos.cutoff.override');

  const { data: apiOrderTypes } = useApiList<ApiOrderType>('/api/master/order-types?pageSize=200');

  /**
   * The chosen order type decides the direction; the badge only reports it.
   * Once the booking exists the API's own directionCode wins, because it is the
   * one the gate will work to.
   */
  const chosenOrderType = (apiOrderTypes ?? []).find(ot => ot.orderTypeCode === orderTypeCode) ?? null;
  const direction = created?.directionCode ?? chosenOrderType?.directionCode ?? null;
  /** The chosen sailing, for the context strip above the tabs. */
  const { data: headerCalls } = useApiList<CallSummary>(CALLS_PATH);
  const headerCall = (headerCalls ?? []).find(c => c.vesselCallId === form.vesselCallId) ?? null;

  /** Nothing about a sailing is demanded until the order type says there is one. */
  const needsVessel = chosenOrderType?.requiresVesselSchedule ?? false;
  /**
   * Ports are required only on a SCHEDULED EXPORT BOOKING. Depot work has no
   * sailing and no ports; an import D/O has a destination that is the depot.
   * Read off the order type's bookingTypeCode, which is what the API checks.
   */
  const portsRequired = needsVessel && chosenOrderType?.bookingTypeCode === 'EXPORT_BOOKING';

  /**
   * §17c, enforced on screen so the clerk is not taught by a 400:
   *   carrierRef on every booking
   *   customerCode on an export booking or an import D/O
   *   an export booking needs a loading port and a destination
   */
  const missing = !orderTypeCode ? 'Choose a work order type.'
    : !branch ? 'No depot is assigned to this account.'
    : !form.agentCode ? 'Choose the shipping line or agent.'
    : !form.carrierRef.trim() ? 'The booking / B.L number is required.'
    : !form.customerCode ? `The ${direction === 'IMPORT' ? 'consignee' : 'shipper'} is required.`
    // Only a scheduled order type demands a sailing and its ports. Depot work
    // may carry them, but is never held up for them.
    : needsVessel && !form.vesselCallId ? 'This work order type runs against a vessel call — choose one.'
    : portsRequired && !form.polPortCode.trim() ? 'An export booking needs a loading port.'
    : portsRequired && !form.fpdPortCode.trim() && !form.podPortCode.trim() ? 'An export booking needs a destination port.'
    : null;

  /**
   * Step 1 is ONE call: the header alone, with no containers (§16a, §18).
   * The 201 IS the GET, so the screen fills from the answer and never re-reads.
   */
  async function saveHeader() {
    if (missing || !branch) return;
    setSaving(true);
    setSaveError(null);
    const nil = (v: string) => (v.trim() === '' ? null : v.trim());
    try {
      const answer = await apiSend<{ booking: SavedBooking }>('POST', '/api/tos/bookings', {
        ...headerBody(),
        // Containers are step 2, against a booking that already exists.
        requirements: [],
      }, idempotencyKey);
      setCreated(answer.booking);
      toast({ variant: 'success', title: 'Booking created', message: `${answer.booking.orderNo} — now add the containers.` });
      void reloadBooking(answer.booking.bookingId);
      setActiveTab('containers');
    } catch (e) {
      setSaveError(e instanceof ApiError ? e : new ApiError(0, 'The booking could not be created.'));
    } finally {
      setSaving(false);
    }
  }
  const [orderTypeChangePending, setOrderTypeChangePending] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [changeOrderTypeOpen, setChangeOrderTypeOpen] = useState(false);
  const [deleteContainerId, setDeleteContainerId] = useState<string | null>(null);
  // Selection state hoisted to the page so the top "..." menu actions can
  // react to "is at least one container selected?" without going through
  // TabContainers internal state.
  const [selectedContainerIds, setSelectedContainerIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  /**
   * The booking's boxes. Loaded from the API and replaced from every save
   * answer — never guessed at locally, so what the table shows is what the
   * server holds.
   */
  const [containers, setContainers] = useState<Container[]>([]);
  const [requirements, setRequirements] = useState<ApiRequirement[]>([]);

  /** Re-read the booking whole: header, lines and boxes in one call. */
  async function reloadBooking(id: string, seedForm = false) {
    try {
      const d = await apiGet<ApiBookingDetail>(`/api/tos/bookings/${id}`);
      setCreated(d.booking);
      setRequirements(d.requirements ?? []);
      setContainers((d.containers ?? []).map(l => containerFromApi(l, d.requirements ?? [])));
      // Only on the first load: later reloads must not overwrite what the clerk
      // is in the middle of typing.
      if (seedForm) {
        const full = d.booking as SavedBookingFull;
        setForm(formFromBooking(full));
        if (full.orderTypeCode) setOrderTypeCode(full.orderTypeCode);
      }
    } catch {
      /* the screen keeps what it has; the next save will say if it is stale */
    }
  }

  /** Opening an existing booking: load it once, form and all. */
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!bookingId || loadedFor.current === bookingId) return;
    loadedFor.current = bookingId;
    void reloadBooking(bookingId, true);
  }, [bookingId]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Everything the header carries, in the shape both POST and PUT take. */
  function headerBody() {
    const nil = (v: string) => (v.trim() === '' ? null : v.trim());
    const num = (v: string) => (v.trim() === '' ? null : Number(v));
    return {
      branchId: branch?.branchId,
      orderTypeCode,
      lineCode: form.agentCode || null,
      agentCode: form.agentCode || null,
      customerCode: form.customerCode || null,
      forwarderCode: form.forwarderCode || null,
      carrierRef: nil(form.carrierRef),
      customerRef: nil(form.customerRef),
      vesselCallId: form.vesselCallId || null,
      polPortCode: nil(form.polPortCode),
      podPortCode: nil(form.podPortCode),
      fpdPortCode: nil(form.fpdPortCode),
      paperlessCode: nil(form.paperlessCode),
      allowLateGateIn: form.allowLateGateIn,
      totalQty: num(form.totalQty),
      uomCode: nil(form.uomCode),
      totalVolumeCbm: num(form.totalVolumeCbm),
      totalWeightKg: num(form.totalWeightKg),
      commodityCode: nil(form.commodityCode),
      cargoCategoryCode: nil(form.cargoCategoryCode),
      marksAndNos: nil(form.marksAndNos),
      specialInstruction: nil(form.specialInstruction),
      remarks: nil(form.remarks),
    };
  }

  /**
   * Update the header of a booking that exists.
   *
   * The PUT REPLACES the whole header (§17a), so EVERY field goes every time —
   * sending only the tab being edited would clear the others.
   */
  async function putHeader() {
    if (!created) return;
    setSaving(true);
    setSaveError(null);
    try {
      const answer = await apiSend<{ booking: SavedBooking }>(
        'PUT', `/api/tos/bookings/${created.bookingId}`,
        { ...headerBody(), rowVersion: created.rowVersion });
      setCreated(answer.booking);
      toast({ variant: 'success', title: 'Booking updated', message: answer.booking.orderNo });
    } catch (e) {
      setSaveError(e instanceof ApiError ? e : new ApiError(0, 'The booking could not be updated.'));
    } finally {
      setSaving(false);
    }
  }

  /**
   * Make sure the booking asks for this equipment before a box of it is sent.
   *
   * The API will not take a box on a line that does not exist, and this screen
   * has no separate "what the booking asks for" panel — by design, the June one
   * had none either. So the booking's promise GROWS as boxes are added: pick a
   * 40HC and the booking is asked to want one more 40HC.
   *
   * It is reported, never silent: the toast names the line it added or widened.
   * Returns the lineNo to use, or 0 if the lines could not be saved.
   */
  async function ensureLineFor(equip: string, want = 1): Promise<number> {
    if (!created) return 0;
    const existing = requirements.find(r => r.equipmentTypeCode === equip);
    const room = existing ? existing.qty - existing.qtyAssigned - existing.qtyCompleted : 0;
    if (existing && room >= want) return existing.lineNo;

    const next = requirements.map(r => ({
      equipmentTypeCode: r.equipmentTypeCode,
      // widen the line these boxes need; leave the others as they are
      qty: r.equipmentTypeCode === equip ? r.qty + (want - room) : r.qty,
    }));
    if (!existing) next.push({ equipmentTypeCode: equip, qty: want });

    try {
      const answer = await apiSend<{ booking?: { rowVersion: string }; requirements?: ApiRequirement[] }>(
        'PUT', `/api/tos/bookings/${created.bookingId}/requirements`,
        { rowVersion: created.rowVersion, requirements: next });
      const lines = answer.requirements ?? [];
      setRequirements(lines);
      if (answer.booking?.rowVersion) setCreated({ ...created, rowVersion: answer.booking.rowVersion });
      toast({
        variant: 'info',
        title: existing ? `Line widened for ${equip}` : `Line added for ${equip}`,
        message: 'The booking now asks for it.',
      });
      return lines.find(r => r.equipmentTypeCode === equip)?.lineNo ?? 0;
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, 'The equipment line could not be saved.');
      toast({ variant: 'danger', title: 'Could not add the line', message: err.message });
      return 0;
    }
  }

  /**
   * Save ONE box — a NEW one by POST, an EXISTING one by PUT.
   *
   * The two are not interchangeable, and this is the trap: re-POSTing a row the
   * server already has answers REPLAYED and SILENTLY DISCARDS the edit. Proved
   * against the running API — a seal sent as "CHANGED-BY-BATCH" came back
   * unchanged. Every edit would have looked saved and done nothing.
   *
   * So: no rowVersion means the box is new, and /batch creates it; a rowVersion
   * means it exists, and the PUT replaces it (sending every field, because a
   * field left out is cleared — §16d).
   */
  async function saveContainer(c: Container): Promise<Record<string, string[]> | null> {
    if (!created) return { containerNo: ['Save the booking first.'] };
    // A new box needs a line to sit on; the booking is asked to want it.
    let lineNo = c.lineNo;
    if (!c.rowVersion) {
      lineNo = await ensureLineFor(`${c.size}${c.type}`);
      if (!lineNo) return { containerNo: [`The booking could not be made to ask for a ${c.size}${c.type}.`] };
    }
    try {
      if (c.rowVersion) {
        const { clientLineId: _c, lineNo: _l, ...rest } = containerToApi(c, c.clientLineId);
        void _c; void _l;
        // containerNo IS sent: it is how an unnominated box is nominated later.
        await apiSend('PUT', `/api/tos/bookings/${created.bookingId}/containers/${c.id}`,
          { rowVersion: c.rowVersion, ...rest });
      } else {
        const clientLineId = c.clientLineId || newClientLineId();
        const answer = await apiSend<BatchAnswer>(
          'POST', `/api/tos/bookings/${created.bookingId}/containers/batch`,
          { containers: [containerToApi({ ...c, lineNo, clientLineId }, clientLineId)] });
        const item = answer.items[0];
        if (!item) return { containerNo: ['The API answered with nothing for this box.'] };
        if (item.outcome === 'REJECTED') return item.errors ?? { containerNo: ['Rejected.'] };
        // Saved, but with something worth saying.
        if (item.warnings && Object.keys(item.warnings).length > 0) {
          toast({
            variant: 'warning',
            title: 'Saved with a warning',
            message: Object.values(item.warnings).flat().join(' '),
          });
        }
      }
      // Re-read so the table, the summary and the line tallies all move together.
      await reloadBooking(created.bookingId);
      toast({ variant: 'success', title: 'Container saved', message: c.containerNo || 'Not nominated' });
      return null;
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, 'The container could not be saved.');
      // A stale rowVersion is a 409: someone else changed it while this was open.
      if (err.status === 409) {
        await reloadBooking(created.bookingId);
        return { containerNo: ['This box was changed by someone else. It has been reloaded — re-apply your change.'] };
      }
      return err.fieldErrors && Object.keys(err.fieldErrors).length > 0
        ? err.fieldErrors
        : { containerNo: [err.message] };
    }
  }

  /**
   * Save MANY boxes in one call — this is what /batch is actually for.
   *
   * Each row stands alone: a bad number comes back REJECTED with its own error
   * while the good ones are saved, so a paste of forty with two typos lands
   * thirty-eight boxes and names the two.
   */
  async function saveContainers(rows: Container[]): Promise<BatchItem[]> {
    if (!created || rows.length === 0) return [];
    try {
      const answer = await apiSend<BatchAnswer>(
        'POST', `/api/tos/bookings/${created.bookingId}/containers/batch`,
        { containers: rows.map(c => containerToApi(c, c.clientLineId || newClientLineId())) });
      await reloadBooking(created.bookingId);
      return answer.items;
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, 'The boxes could not be saved.');
      toast({ variant: 'danger', title: 'Not saved', message: err.message });
      return [];
    }
  }

  /**
   * Take several boxes off at once. The API unassigns ONE box per call, so this
   * is a loop, not a bulk endpoint — and a 409 on one box must not stop the
   * rest, because it only means that one already left.
   */
  async function removeContainers(ids: string[]) {
    if (!created || ids.length === 0) return;
    let gone = 0;
    const failed: string[] = [];
    for (const id of ids) {
      try {
        await apiSend('DELETE', `/api/tos/bookings/${created.bookingId}/containers/${id}`);
        gone += 1;
      } catch {
        failed.push(containers.find(c => c.id === id)?.containerNo || id.slice(0, 8));
      }
    }
    await reloadBooking(created.bookingId);
    toast({
      variant: failed.length ? 'warning' : 'success',
      title: `${gone} removed`,
      message: failed.length ? `Could not remove: ${failed.join(', ')}` : 'The boxes are off the booking.',
    });
  }

  /**
   * Paste-many: every number becomes a box on the line that asks for that
   * equipment, saved in ONE call. Rejected rows are named rather than counted,
   * because "3 failed" tells a clerk nothing about which to retype.
   */
  async function onAddMultiple(p: { numbers: string[]; size: string; type: string; cargoCat: string }) {
    const equip = `${p.size}${p.type}`;
    // Same rule as one box: the booking is asked to want them.
    let line = requirements.find(r => r.equipmentTypeCode === equip);
    if (!line || line.qty - line.qtyAssigned - line.qtyCompleted < p.numbers.length) {
      const lineNo = await ensureLineFor(equip, p.numbers.length);
      if (!lineNo) return;
      line = { lineNo, equipmentTypeCode: equip, qty: 0, qtyAssigned: 0, qtyCompleted: 0 };
    }
    const rows: Container[] = p.numbers.map(no => ({
      ...BLANK_CONTAINER,
      id: `new-${no}`,
      clientLineId: newClientLineId(),
      lineNo: line.lineNo,
      containerNo: no,
      size: p.size,
      type: p.type,
      cargoCategory: p.cargoCat,
    }));
    const items = await saveContainers(rows);
    const bad = items.filter(i => i.outcome === 'REJECTED');
    const warned = items.filter(i => i.outcome !== 'REJECTED' && i.warnings && Object.keys(i.warnings).length > 0);
    const ok = items.length - bad.length;
    const notes = [
      bad.length ? `Refused: ${bad.map(b => `${b.containerNo} (${Object.values(b.errors ?? {}).flat()[0] ?? 'rejected'})`).join('; ')}` : '',
      warned.length ? `Saved with a warning: ${warned.map(w => w.containerNo).join(', ')}` : '',
    ].filter(Boolean).join(' · ');
    toast({
      variant: bad.length || warned.length ? 'warning' : 'success',
      title: `${ok} of ${items.length} added`,
      message: notes || `On ${created?.orderNo ?? 'the booking'}.`,
    });
  }

  /**
   * A new box, opened on a line the booking actually has room for.
   *
   * It used to open on a hardcoded 40HC regardless, so on a booking asking for
   * 20GP the clerk's first action was always to correct the two dropdowns.
   */
  function blankContainer(): Container {
    const line = requirements.find(r => r.qtyAssigned + r.qtyCompleted < r.qty) ?? requirements[0];
    const equip = line?.equipmentTypeCode ?? '';
    return {
      ...BLANK_CONTAINER,
      id: `new-${Date.now()}`,
      clientLineId: newClientLineId(),
      lineNo: line?.lineNo ?? 0,
      size: equip.slice(0, 2) || BLANK_CONTAINER.size,
      type: equip.slice(2) || BLANK_CONTAINER.type,
      handoverMode: defaultHandoverMode(direction),
    };
  }

  /** Set the same handover mode on several boxes (one PUT each — §16d). */
  async function setHandoverOn(ids: string[], handoverMode: string) {
    if (!created || ids.length === 0) return;
    let done = 0;
    const failed: string[] = [];
    for (const id of ids) {
      const c = containers.find(x => x.id === id);
      if (!c) continue;
      try {
        // The PUT REPLACES the line, so everything read is sent back.
        const { clientLineId: _c, containerNo: _n, lineNo: _l, ...rest } =
          containerToApi({ ...c, handoverMode }, c.clientLineId);
        void _c; void _n; void _l;
        await apiSend('PUT', `/api/tos/bookings/${created.bookingId}/containers/${id}`,
          { rowVersion: c.rowVersion, ...rest });
        done += 1;
      } catch {
        failed.push(c.containerNo || id.slice(0, 8));
      }
    }
    await reloadBooking(created.bookingId);
    toast({
      variant: failed.length ? 'warning' : 'success',
      title: `${done} updated`,
      message: failed.length ? `Could not update: ${failed.join(', ')}` : `Mode set to ${handoverMode}.`,
    });
  }

  /** Take a box off the booking, then re-read. */
  async function removeContainer(id: string) {
    if (!created) return;
    try {
      await apiSend('DELETE', `/api/tos/bookings/${created.bookingId}/containers/${id}`);
      await reloadBooking(created.bookingId);
      toast({ variant: 'success', title: 'Container removed', message: 'The box is off the booking.' });
    } catch (e) {
      // 409 = the page is out of date (the gate took it, or it already left).
      const err = e instanceof ApiError ? e : new ApiError(0, 'The container could not be removed.');
      toast({ variant: 'warning', title: 'Not removed', message: err.message });
      if (err.status === 409) await reloadBooking(created.bookingId);
    }
  }
  const router = useRouter();

  // Order Type change with soft-warn — if any container already has a recorded
  // transaction, ask the user to confirm before overwriting movement templates.
  const hasRecordedMovements = containers.some(c => c.movements.some(m => m.status));

  const attemptOrderTypeChange = (newCode: string) => {
    if (newCode === orderTypeCode) return;
    if (hasRecordedMovements) {
      setOrderTypeChangePending(newCode);
    } else {
      setOrderTypeCode(newCode);
      toast({ variant: 'success', title: 'Order type updated', message: `Movement templates re-seeded from ${newCode}.` });
    }
  };

  const confirmOrderTypeChange = () => {
    if (orderTypeChangePending) {
      setOrderTypeCode(orderTypeChangePending);
      toast({ variant: 'warning', title: 'Order type changed', message: `Existing transactions preserved; future moves will follow the new ${orderTypeChangePending} template.` });
      setOrderTypeChangePending(null);
    }
  };

  const b = BOOKING;
  const cutoffDays = daysUntil(b.cutoffs.cyDry);
  const urgency    = urgencyColor(cutoffDays);

  /**
   * The order-type list, from MDM (GATE_API_FOR_UI.md §18).
   *
   * BLIND GATE IN is left out: the API refuses it on create with a 400, because
   * the GATE raises those, not a booking clerk. Offering a choice only to reject
   * it teaches people the screen is unreliable.
   *
   * NOTHING ELSE is filtered. The order type is the CHOICE; direction, booking
   * type, service and cargo class are its ATTRIBUTES, read off whichever one is
   * picked. Filtering the list by a direction would be backwards — and against
   * this tenant's real data it would empty the list, because KORAKIT's eight
   * order types are seven DOMESTIC and one IMPORT, with no EXPORT among them.
   */
  const offerableOrderTypes = useMemo(
    // isActive matters: a retired order type must not be offered on a new
    // booking even though old bookings still carry it.
    () => (apiOrderTypes ?? []).filter(ot => ot.isActive && ot.orderTypeCode !== 'BLIND GATE IN'),
    [apiOrderTypes]);

  /** The chosen order type decides the direction; the badge only reports it. */
  const summary = {
    total:        containers.length,
    fullAccept:   containers.filter(c => containerStatus(c) !== 'NO_ACTIVITY').length,
    fullRelease:  containers.filter(c => containerStatus(c) === 'LOADED').length,
    awaiting:     containers.filter(c => containerStatus(c) === 'NO_ACTIVITY').length,
  };

  const TABS = [
    { id: 'voyage',     label: 'Voyage & Parties', icon: 'ship'          },
    { id: 'containers', label: 'Containers',        icon: 'packageOpen'   },
    { id: 'cargo',      label: 'Cargo & Docs',      icon: 'fileText'      },
    { id: 'audit',      label: 'Audit Log',         icon: 'clock'         },
  ] as const;

  return (
    <div className="gecko-stack" style={{ gap: 0, maxWidth: '100%' }}>

      {/* ── Sticky Header Band ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--gecko-bg-surface)', borderBottom: '1px solid var(--gecko-border)', boxShadow: 'var(--gecko-shadow-sm)' }}>

        {/* Row 1: identification + actions */}
        <div className="gecko-row gecko-stack-md" style={{ padding: '10px 20px', borderBottom: '1px solid var(--gecko-border)' }}>
          <Link href="/bookings" className="gecko-mini-icon" style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--gecko-border)', color: 'var(--gecko-text-secondary)', textDecoration: 'none' }}>
            <Icon name="arrowLeft" size={14} />
          </Link>

          {/* Badges */}
          {/* Derived, never chosen: the order type carries the direction. */}
          <span
            title={chosenOrderType ? `${chosenOrderType.orderTypeCode} is a ${direction} order type (booking type ${chosenOrderType.bookingTypeCode ?? '—'})` : 'Pick a work order type'}
            style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 6,
              background: direction === 'EXPORT' ? 'var(--gecko-primary-600)' : direction === 'IMPORT' ? 'var(--gecko-info-600)' : direction ? 'var(--gecko-gray-500)' : 'var(--gecko-bg-subtle)',
              color: direction ? '#fff' : 'var(--gecko-text-disabled)', letterSpacing: '0.04em' }}>
            {direction ?? 'NO TYPE'}
          </span>

          {/* Order Type — dropdown sourced from the shared catalog (masters/order-types) */}
          <select
            value={orderTypeCode}
            onChange={e => attemptOrderTypeChange(e.target.value)}
            className="gecko-cell-meta"
            style={{
              fontWeight: 700, padding: '3px 10px', borderRadius: 6,
              background: 'var(--gecko-bg-subtle)',
              border: '1px solid var(--gecko-border)',
              fontFamily: 'inherit',
              cursor: 'pointer',
              height: 26,
            }}
            title="Change order type — sourced from masters/order-types"
          >
            <option value="">Choose a work order type…</option>
            {offerableOrderTypes.map(ot => (
              <option key={ot.orderTypeCode} value={ot.orderTypeCode}>
                {ot.orderTypeCode} - {ot.descriptionEn}
                {[ot.directionCode, ot.serviceCode, ot.cargoClassCode].filter(Boolean).length > 0
                  && ` (${[ot.directionCode, ot.serviceCode, ot.cargoClassCode].filter(Boolean).join(' · ')})`}
              </option>
            ))}
          </select>

          {/* Booking & Order numbers */}
          <div style={{ height: 18, width: 1, background: 'var(--gecko-border)', flexShrink: 0 }} />
          <div className="gecko-row gecko-row-baseline" style={{ gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--gecko-text-disabled)', textTransform: 'uppercase' }}>Booking</span>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: created ? 'var(--gecko-text-primary)' : 'var(--gecko-text-disabled)' }}>{form.carrierRef || '—'}</span>
          </div>

          <div className="gecko-flex-1" />

          {/* Actions */}
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={() => window.print()}><Icon name="print" size={13} /> Print</button>
          {created && (
            <Link href={`/billing/statement?orderNo=${encodeURIComponent(created?.orderNo ?? '')}`} className="gecko-btn gecko-btn-ghost gecko-btn-sm" style={{ color: 'var(--gecko-info-600)', textDecoration: 'none' }}>
              <Icon name="fileText" size={13} /> Billing Statement
            </Link>
          )}
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => toast({ variant: 'info', title: 'Booking cloned', message: `${b.bookingNo} duplicated as a draft.` })}><Icon name="copy" size={13} /> Clone</button>

          {/* More menu */}
          <div style={{ position: 'relative' }}>
            <button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon" onClick={() => setMoreOpen(!moreOpen)} title="More actions">
              <Icon name="moreHorizontal" size={15} />
            </button>
            {moreOpen && (
              <>
                <div onClick={() => setMoreOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
                <div className="gecko-floating-card" style={{ position: 'absolute', right: 0, top: '110%', zIndex: 40, minWidth: 220, overflow: 'hidden' }}>
                  {[
                    { icon: 'transferH', label: 'Transfer to New Order',      color: 'var(--gecko-text-primary)', requiresSelection: true,  action: () => toast({ variant: 'info', title: 'Transfer to New Order', message: 'Coming soon — new-booking creation workflow.' }) },
                    { icon: 'transferH', label: 'Transfer to Existing Order',  color: 'var(--gecko-text-primary)', requiresSelection: true,  action: () => setTransferOpen(true) },
                    { icon: 'edit',      label: 'Change Order Type',           color: 'var(--gecko-text-primary)', requiresSelection: false, action: () => setChangeOrderTypeOpen(true) },
                    { icon: 'trash',     label: 'Delete Booking',              color: 'var(--gecko-danger-600)',   requiresSelection: false, action: () => setShowDeleteModal(true) },
                  ].map(item => (
                    <button key={item.label} onClick={() => {
                      setMoreOpen(false);
                      if (item.requiresSelection && selectedContainerIds.size === 0) {
                        toast({ variant: 'warning', title: 'Select containers first', message: `Pick at least one container in the grid before running "${item.label}".` });
                        return;
                      }
                      item.action();
                    }} className="gecko-row" style={{ width: '100%', gap: 10, padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', color: item.color, fontSize: 13, fontFamily: 'inherit', textAlign: 'left' }}>
                      <Icon name={item.icon} size={14} style={{ color: item.color }} /> {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button className="gecko-btn gecko-btn-primary gecko-btn-sm"
            disabled={saving || !!missing || created !== null}
            title={missing ?? (created ? 'Already created' : 'Create the booking header')}
            onClick={() => void saveHeader()}>
            <Icon name="save" size={13} /> {saving ? 'Saving…' : created ? 'Saved' : 'Save'}
          </button>
        </div>

        {/* Row 2: vessel info + cut-off urgency */}
        <div className="gecko-row" style={{ gap: 20, padding: '8px 20px', background: 'var(--gecko-bg-subtle)', fontSize: 12 }}>
          {/* The order number sits here, with the booking's other facts, rather
              than in the toolbar — the toolbar is for things you press. */}
          <div className="gecko-row gecko-row-baseline" style={{ gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--gecko-text-disabled)', textTransform: 'uppercase' }}>Order</span>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: created ? 'var(--gecko-primary-700)' : 'var(--gecko-text-disabled)' }}>{created?.orderNo ?? '—'}</span>
          </div>
          <div style={{ color: 'var(--gecko-text-disabled)' }}>·</div>
          {/* Read off the chosen vessel call. It used to read the blank fixture,
              which is why this line showed an empty "()". */}
          <div className="gecko-row" style={{ gap: 6 }}>
            <Icon name="ship" size={13} style={{ color: 'var(--gecko-text-secondary)' }} />
            <span style={{ fontWeight: 700, color: headerCall ? 'var(--gecko-text-primary)' : 'var(--gecko-text-disabled)' }}>
              {headerCall?.vesselName ?? 'No vessel call'}
            </span>
            {headerCall?.vesselCode && <span style={{ color: 'var(--gecko-text-disabled)' }}>({headerCall.vesselCode})</span>}
          </div>
          <div style={{ color: 'var(--gecko-text-disabled)' }}>·</div>
          <div className="gecko-row" style={{ gap: 5 }}>
            <span style={{ color: 'var(--gecko-text-secondary)' }}>Voy</span>
            <span style={{ fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)' }}>
              {[headerCall?.operatorVoyageIn, headerCall?.operatorVoyageOut].filter(Boolean).join(' / ') || '—'}
            </span>
          </div>
          <div style={{ color: 'var(--gecko-text-disabled)' }}>·</div>
          <div className="gecko-row" style={{ gap: 5 }}>
            <span style={{ color: 'var(--gecko-text-secondary)' }}>Loading</span>
            <span style={{ fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)' }}>{b.loadingPort}</span>
            <Icon name="arrowRight" size={11} style={{ color: 'var(--gecko-text-disabled)' }} />
            <span style={{ fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)' }}>{b.dischargePort}</span>
          </div>
          <div style={{ color: 'var(--gecko-text-disabled)' }}>·</div>
          <div className="gecko-row" style={{ gap: 5 }}>
            <span style={{ color: 'var(--gecko-text-secondary)' }}>ETD</span>
            <span style={{ fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{formatDate(b.etd)}</span>
          </div>

          <div className="gecko-row gecko-ml-auto">
            <Icon name="clock" size={13} style={{ color: urgency.color }} />
            <span style={{ fontSize: 11, color: urgency.color, fontWeight: 600 }}>CY Cut-off in</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: urgency.color, fontFamily: 'var(--gecko-font-mono)', background: urgency.bg, padding: '2px 8px', borderRadius: 6 }}>{cutoffDays === null ? '—' : `${cutoffDays}d`}</span>
            <span style={{ fontSize: 10.5, color: 'var(--gecko-text-disabled)' }}>
              {created ? <>Modified {formatDateTime(created.updatedAt)} by {created.updatedByName ?? '—'}</> : 'Not saved yet'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Body: main content + sidebar ── */}
      <div className="gecko-row gecko-row-start" style={{ gap: 0 }}>

        {/* Main content */}
        <div className="gecko-flex-1">

          {/* Tab nav */}
          <div className="gecko-tab-bar" style={{ background: 'var(--gecko-bg-surface)', paddingLeft: 20 }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`gecko-tab-item${activeTab === tab.id ? ' gecko-tab-item-active' : ''}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
              >
                <Icon name={tab.icon} size={14} />
                {tab.label}
                {tab.id === 'containers' && <span style={{ fontSize: 10, fontWeight: 700, background: activeTab === tab.id ? 'var(--gecko-primary-100)' : 'var(--gecko-bg-subtle)', color: activeTab === tab.id ? 'var(--gecko-primary-700)' : 'var(--gecko-text-disabled)', borderRadius: 10, padding: '1px 6px', marginLeft: 2 }}>{containers.length}</span>}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ background: 'var(--gecko-bg-surface)' }}>
            {activeTab === 'voyage' && (
              <TabVoyage form={form} patch={patch} created={created} direction={direction}
                canOverride={canOverride} onSave={() => void saveHeader()} saving={saving}
                missing={missing} saveError={saveError} needsVessel={needsVessel} portsRequired={portsRequired} />
            )}
            {activeTab === 'containers' && (
              <TabContainers
                onSelectContainer={c => setDrawerContainer(c)}
                onAddContainer={() => setDrawerContainer(blankContainer())}
                onDeleteContainer={id => setDeleteContainerId(id)}
                orderTypeCode={orderTypeCode}
                canAddContainers={created !== null}
                containers={containers}
                requirements={requirements}
                onAddMultiple={onAddMultiple}
                onDeleteMany={removeContainers}
                onSetHandover={setHandoverOn}
                handoverModes={handoverModesFor(direction)}
                selected={selectedContainerIds}
                setSelected={setSelectedContainerIds}
              />
            )}
            {activeTab === 'cargo' && (
              <TabCargo form={form} patch={patch} created={created}
                onSave={() => void putHeader()} saving={saving} error={saveError} />
            )}
            {activeTab === 'audit'      && <TabAudit />}
          </div>
        </div>

        {/* ── Right Sidebar ── */}
        <div style={{ width: 272, flexShrink: 0, borderLeft: '1px solid var(--gecko-border)', position: 'sticky', top: 93, maxHeight: 'calc(100vh - 93px)', overflowY: 'auto', background: 'var(--gecko-bg-subtle)' }}>

          {/* Booking Summary */}
          <div style={{ padding: '16px 16px 0' }}>
            <div className="gecko-eyebrow gecko-mb-3">Booking Summary</div>
            <div className="gecko-grid-2 gecko-stack-sm">
              {[
                { label: 'Total',        val: summary.total,       color: 'var(--gecko-text-primary)'   },
                { label: 'Full Accept',  val: summary.fullAccept,  color: 'var(--gecko-primary-600)'    },
                { label: 'Full Release', val: summary.fullRelease, color: 'var(--gecko-success-600)'    },
                { label: 'Awaiting',     val: summary.awaiting,    color: 'var(--gecko-warning-600)'    },
              ].map(s => (
                <div key={s.label} style={{ padding: '10px 12px', background: 'var(--gecko-bg-surface)', borderRadius: 8, border: '1px solid var(--gecko-border)', textAlign: 'center' }}>
                  <div className="gecko-stat-num-22" style={{ fontWeight: 800, color: s.color, fontFamily: 'var(--gecko-font-mono)', lineHeight: 1 }}>{s.val}</div>
                  <div className="gecko-eyebrow gecko-mt-1">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="gecko-row gecko-row-between gecko-mt-2" style={{ padding: '8px 10px', background: 'var(--gecko-bg-surface)', borderRadius: 8, border: '1px solid var(--gecko-border)' }}>
              <span className="gecko-cell-meta">Container mix</span>
              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)' }}>
                {containers.length === 0 ? '—' : `${containers.length} box(es)`}
              </span>
            </div>
          </div>

          {/* Cut-off Status */}
          <div style={{ padding: '16px 16px 0', marginTop: 8 }}>
            <div className="gecko-eyebrow gecko-mb-3">Cut-off Countdown</div>
            <div className="gecko-stack gecko-stack-sm" style={{ gap: 6 }}>
              {[
                { label: 'CY (Dry)',     date: b.cutoffs.cyDry     },
                { label: 'CY (Reefer)', date: b.cutoffs.cyReefer  },
                { label: 'CFS (Dry)',   date: b.cutoffs.cfsDry    },
                { label: 'Port (Dry)',  date: b.cutoffs.portDry   },
              ].map(co => {
                const d  = daysUntil(co.date);
                const u  = urgencyColor(d);
                // No vessel call yet means no cut-off to count down to: the bar
                // is empty rather than guessing a position from NaN.
                const pct = d === null ? 0 : Math.max(3, Math.min(97, (d / 60) * 100));
                return (
                  <div key={co.label} style={{ padding: '8px 10px', background: 'var(--gecko-bg-surface)', borderRadius: 8, border: '1px solid var(--gecko-border)' }}>
                    <div className="gecko-row gecko-row-between gecko-mb-1">
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--gecko-text-secondary)' }}>{co.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: u.color, fontFamily: 'var(--gecko-font-mono)' }}>{d === null ? '—' : `${d}d`}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'var(--gecko-bg-subtle)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: u.bar, borderRadius: 2, transition: 'width 400ms' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Actions — every one of these needs a booking to act on, so
              they appear only once the header has been saved and there is an
              order number. Offering "Print Booking Advice" for a booking that
              does not exist is offering a blank page. */}
          {created && (
          <div style={{ padding: '16px', marginTop: 8 }}>
            <div className="gecko-eyebrow gecko-mb-3">Quick Actions</div>
            <div className="gecko-stack gecko-stack-sm" style={{ gap: 6 }}>
              {[
                { icon: 'plus',       label: 'Add Container',           action: () => { setActiveTab('containers'); setDrawerContainer(blankContainer()); } },
                { icon: 'fileText',   label: 'View Billing Statement',   action: () => router.push(`/billing/statement?orderNo=${encodeURIComponent(created?.orderNo ?? '')}`) },
                { icon: 'print',      label: 'Print Booking Advice',     action: () => window.print() },
              ].map(qa => (
                <button key={qa.label} onClick={qa.action} className="gecko-row" style={{ gap: 9, padding: '8px 10px', background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--gecko-text-primary)', fontSize: 12, fontWeight: 500, textAlign: 'left' }}>
                  <div className="gecko-mini-icon gecko-mini-icon-neutral" style={{ width: 24, height: 24, borderRadius: 6 }}>
                    <Icon name={qa.icon} size={13} />
                  </div>
                  {qa.label}
                </button>
              ))}
            </div>
          </div>
          )}

          {/* Barcode Card — hidden on the owner's call (2026-10-04). It printed
              the mock's booking number on a QR and a Code 128, and nothing reads
              those yet. Restore it when a document actually carries them. */}

          {/* Metadata */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--gecko-border)', marginTop: 4 }}>
            {[
              { label: 'Created by', val: created?.createdByName ?? '—',  sub: formatDateTime(created?.createdAt) },
              { label: 'Modified by', val: created?.updatedByName ?? '—',  sub: formatDateTime(created?.updatedAt) },
            ].map(m => (
              <div key={m.label} className="gecko-row gecko-row-between gecko-mb-2">
                <span style={{ fontSize: 10, color: 'var(--gecko-text-disabled)' }}>{m.label}</span>
                <div style={{ textAlign: 'right' }}>
                  <div className="gecko-cell-meta" style={{ fontWeight: 600 }}>{m.val}</div>
                  <div className="gecko-cell-sub" style={{ marginTop: 0 }}>{m.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Container Drawer ── */}
      {drawerContainer && (
        <ContainerDrawer
          container={drawerContainer}
          requirements={requirements}
          onSave={saveContainer}
          onClose={() => setDrawerContainer(null)}
          onDuplicate={() => setDrawerContainer(null)}
          onDelete={() => { void removeContainer(drawerContainer.id); setDrawerContainer(null); }}
        />
      )}

      {/* ── Delete Booking Modal ── */}
      {showDeleteModal && (
        <DeleteConfirmModal
          resourceType="Booking"
          resourceName={b.bookingNo}
          consequences={[
            `${containers.length} containers and all gate-in / EIR records`,
            'Billing statement and all associated charges',
            'EDI message history and audit log',
            'Vessel stow slot assignment',
          ]}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={remarks => {
            setShowDeleteModal(false);
            toast({ variant: 'danger', title: 'Booking deleted', message: `${b.bookingNo} has been permanently removed.` });
          }}
        />
      )}

      {/* ── Order Type change · soft-warn confirm ── */}
      {orderTypeChangePending && (
        <OrderTypeChangeConfirm
          from={orderTypeCode}
          to={orderTypeChangePending}
          onCancel={() => setOrderTypeChangePending(null)}
          onConfirm={confirmOrderTypeChange}
        />
      )}

      {/* ── Transfer Containers modal ── */}
      {transferOpen && (
        <TransferContainersModal
          sourceBookingNo={b.bookingNo}
          sourceVessel={b.vessel.name}
          sourceVoyage={b.voyageNo}
          containerCount={selectedContainerIds.size}
          onCancel={() => setTransferOpen(false)}
          onTransfer={target => {
            setTransferOpen(false);
            const n = selectedContainerIds.size;
            toast({
              variant: 'success',
              title: 'Containers transferred',
              message: `${n} container${n === 1 ? '' : 's'} moved from ${b.bookingNo} → ${target.bookingNo}.`,
            });
            setSelectedContainerIds(new Set());
          }}
        />
      )}

      {/* ── Change Order Type modal (booking-level · typed-BL confirm) ── */}
      {changeOrderTypeOpen && (
        <ChangeOrderTypeModal
          bookingNo={b.bookingNo}
          bookingType={b.bookingType}
          currentOrderTypeCode={orderTypeCode}
          totalContainers={containers.length}
          containersWithRecordedMoves={containers.filter(c => c.movements.some(m => m.status)).length}
          onCancel={() => setChangeOrderTypeOpen(false)}
          onConfirm={(newCode, remarks) => {
            setChangeOrderTypeOpen(false);
            setOrderTypeCode(newCode);
            toast({
              variant: 'warning',
              title: 'Order type changed',
              message: `Booking ${b.bookingNo} now uses ${newCode}. Movement templates re-seeded across ${containers.length} containers.${remarks ? ` · Audit: ${remarks}` : ''}`,
            });
          }}
        />
      )}

      {/* ── Single-container delete confirm ── */}
      {deleteContainerId !== null && (
        <DeleteContainerModal
          container={containers.find(c => c.id === deleteContainerId) ?? null}
          onCancel={() => setDeleteContainerId(null)}
          onConfirm={() => {
            // The API has no reason field on an unassign, so the remark the
            // modal collects is not pretended to be stored.
            const id = deleteContainerId;
            setDeleteContainerId(null);
            if (id) void removeContainer(id);
          }}
        />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Booking helper components
   ────────────────────────────────────────────────────────────────────────── */

function ExpandedContainerPanel({ container, orderType, onManageVAS, onEdit }: {
  container: Container;
  orderType: OrderTypeDef | undefined;
  onManageVAS: () => void;
  onEdit: () => void;
}) {
  /**
   * The box's moves, from the API.
   *
   * These come back on the save answer as `steps` (GATE_API_FOR_UI.md §16b) and
   * are the real plan for THIS box, snapshotted when it was assigned. The panel
   * used to build them from the mock order-type catalogue instead, which holds
   * none of this tenant's order types — so the list was always empty.
   *
   * The catalogue is still consulted, but only to put a readable name on a code.
   */
  const mvts = useMemo(() => {
    const named = new Map((orderType?.movements ?? []).map(t => [t.code, t.name]));
    return container.movements.map((m, i) => ({
      seq: i + 1,
      code: m.code,
      name: named.get(m.code) ?? m.code.replace(/_/g, ' ').toLowerCase(),
      status: (m.status ? 'done' : 'pending') as 'done' | 'pending' | 'idle',
      recorded: m,
    }));
  }, [container.movements, orderType]);

  const vasCount = container.vas.length;

  return (
    <div className="gecko-table-row-expand-body">
      {/* Movements */}
      <div>
        <div className="gecko-eyebrow gecko-row gecko-mb-2">
          <Icon name="activity" size={11} />
          Movements
          {orderType && (
            <span style={{ fontWeight: 500, color: 'var(--gecko-text-disabled)', textTransform: 'none', letterSpacing: 0 }}>
              from order type <strong style={{ color: 'var(--gecko-text-secondary)' }}>{orderType.code}</strong>
            </span>
          )}
        </div>
        {mvts.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--gecko-text-disabled)', fontStyle: 'italic', padding: '12px 0' }}>
            No movements defined on the active order type.
          </div>
        ) : (
          <div className="gecko-mvmt-strip" style={{ gap: 0 }}>
            {mvts.map((m, idx) => (
              <React.Fragment key={m.code}>
                <div className="gecko-mvmt-chip" data-status={m.status}>
                  <div className="gecko-mvmt-chip-head">
                    <span style={{ width: 18, height: 18, borderRadius: 5, background: m.status === 'done' ? 'var(--gecko-success-600)' : m.status === 'pending' ? 'var(--gecko-warning-500)' : 'var(--gecko-gray-300)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>
                      {m.seq}
                    </span>
                    <span>{m.code}</span>
                    {m.status === 'done' && <Icon name="check" size={11} style={{ color: 'var(--gecko-success-600)' }} />}
                  </div>
                  <div className="gecko-mvmt-chip-name">{m.name}</div>
                  {m.recorded?.txNo && (
                    <div className="gecko-mvmt-chip-meta">
                      ✓ {m.recorded.txNo}
                      {m.recorded.date && <div>{formatDateTime(m.recorded.date)}</div>}
                      {m.recorded.yard && <div>{m.recorded.yard} · {m.recorded.truck}</div>}
                    </div>
                  )}
                  {!m.recorded?.txNo && m.status === 'pending' && (
                    <div className="gecko-mvmt-chip-meta" style={{ fontStyle: 'italic' }}>awaiting transaction</div>
                  )}
                  {m.status === 'idle' && (
                    <div className="gecko-mvmt-chip-meta" style={{ color: 'var(--gecko-text-disabled)' }}>not started</div>
                  )}
                </div>
                {idx < mvts.length - 1 && (
                  <div className="gecko-mvmt-connector">
                    <Icon name="chevronRight" size={14} />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="gecko-row gecko-row-wrap">
        <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onManageVAS}>
          <Icon name="tag" size={13} />
          Manage VAS Charges
          <span className="gecko-pill gecko-pill-neutral" style={{ fontSize: 9, marginLeft: 4 }}>{vasCount}</span>
        </button>
        <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={onEdit}>
          <Icon name="edit" size={13} />
          Edit container
        </button>
        <span style={{ fontSize: 10, color: 'var(--gecko-text-disabled)', marginLeft: 'auto' }}>
          Container <strong className="gecko-mono">{container.containerNo || 'Not nominated'}</strong>
        </span>
      </div>
    </div>
  );
}

/* ── Bulk Actions Menu — mirrors the WinForms context menu ────────────── */

function BulkActionsMenu({
  selectedCount, totalCount,
  onSelectAll, onUnselectAll, onAddMultiple, onUpdateMultiple, onDeleteMultiple,
  onUpdateVAS, onUpdatePUDO, onClearDetails,
}: {
  selectedCount: number; totalCount: number;
  onSelectAll: () => void; onUnselectAll: () => void;
  onAddMultiple: () => void; onUpdateMultiple: () => void; onDeleteMultiple: () => void;
  onUpdateVAS: () => void; onUpdatePUDO: () => void; onClearDetails: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, []);

  const needSelection = selectedCount === 0;
  const item = (icon: string, label: string, onClick: () => void, opts: { disabled?: boolean; danger?: boolean } = {}) => (
    <button
      className={`gecko-bulk-menu-item ${opts.danger ? 'gecko-bulk-menu-item-danger' : ''}`}
      onClick={() => { if (!opts.disabled) { onClick(); setOpen(false); } }}
      disabled={opts.disabled}
    >
      <Icon name={icon} size={13} />
      <span>{label}</span>
    </button>
  );

  return (
    <div ref={ref} className="gecko-bulk-menu">
      <button
        className="gecko-btn gecko-btn-outline gecko-btn-sm"
        onClick={() => setOpen(o => !o)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
      >
        <Icon name="moreHorizontal" size={13} />
        Bulk actions
        <Icon name="chevronDown" size={11} />
      </button>
      {open && (
        <div className="gecko-bulk-menu-panel">
          {item('checkSquare', `Select all (${totalCount})`, onSelectAll)}
          {item('square',      'Unselect all',                onUnselectAll, { disabled: selectedCount === 0 })}
          <div className="gecko-bulk-menu-divider" />
          {item('plus',  'Add multiple containers',       onAddMultiple)}
          {item('edit',  `Update multiple containers${selectedCount > 0 ? ` (${selectedCount})` : ''}`, onUpdateMultiple, { disabled: needSelection })}
          {item('trash', `Delete multiple containers${selectedCount > 0 ? ` (${selectedCount})` : ''}`, onDeleteMultiple, { disabled: needSelection, danger: true })}
          <div className="gecko-bulk-menu-divider" />
          {item('tag',   `Update VAS to selected${selectedCount > 0 ? ` (${selectedCount})` : ''}`,        onUpdateVAS,   { disabled: needSelection })}
          {item('truck', `Update PU/DO Mode to selected${selectedCount > 0 ? ` (${selectedCount})` : ''}`, onUpdatePUDO,  { disabled: needSelection })}
          <div className="gecko-bulk-menu-divider" />
          {item('xCircle', 'Clear details', onClearDetails)}
        </div>
      )}
    </div>
  );
}

/* ── Add Multiple Containers — count + template ─────────────────────────── */

/**
 * Add several boxes at once, by their numbers.
 *
 * It used to ask for a COUNT and a type, and make that many blank rows. The API
 * will not take a box without a container number — it answers "'' is not a
 * container number" — so those rows could never have been saved. What a clerk
 * actually has is a list of numbers, off a release note or a scanner dump, so
 * that is what this takes.
 */
function AddMultipleContainersModal({ onCancel, onConfirm, requirements }: {
  onCancel: () => void;
  onConfirm: (p: { numbers: string[]; size: string; type: string; cargoCat: string }) => Promise<void>;
  requirements: ApiRequirement[];
}) {
  const [text, setText] = useState('');
  const [size, setSize] = useState('40');
  const [type, setType] = useState('HC');
  const [cargoCat, setCargoCat] = useState('GENERAL');
  const [busy, setBusy] = useState(false);

  // One per line, or separated by commas / spaces — however it was copied.
  const numbers = [...new Set(
    text.split(/[\s,;]+/).map(t => t.trim().toUpperCase()).filter(Boolean),
  )];

  const equip = `${size}${type}`;
  const line = requirements.find(r => r.equipmentTypeCode === equip);
  const room = line ? line.qty - line.qtyAssigned - line.qtyCompleted : 0;

  return (
    <div className="gecko-modal-shell" onClick={onCancel}>
      <div className="gecko-modal-card" onClick={e => e.stopPropagation()}>
        <div className="gecko-modal-head">
          <div>
            <div className="gecko-modal-title">Add multiple containers</div>
            <div className="gecko-modal-subtitle">Paste the numbers — one per line, or separated by commas.</div>
          </div>
        </div>

        <div className="gecko-stack" style={{ padding: '16px 20px' }}>
          <div className="gecko-form-group">
            <label className="gecko-label gecko-label-required">Container numbers</label>
            <textarea className="gecko-input gecko-text-mono" rows={7} value={text}
              placeholder={'EITU9845677\nGECU7000005\nMSCU1234566'}
              onChange={e => setText(e.target.value)} />
            <div className="gecko-helper-text">
              {numbers.length === 0 ? 'Nothing pasted yet.' : `${numbers.length} number${numbers.length === 1 ? '' : 's'} read.`}
              {line
                ? ` Line ${line.lineNo} (${equip}) has room for ${room}.`
                : ` No line on this booking asks for a ${equip}.`}
            </div>
          </div>

          <div className="gecko-grid-3">
            <div className="gecko-form-group">
              <label className="gecko-label">Size</label>
              <select className="gecko-input" value={size} onChange={e => setSize(e.target.value)}>
                {['20', '40', '45'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="gecko-form-group">
              <label className="gecko-label">Type</label>
              <select className="gecko-input" value={type} onChange={e => setType(e.target.value)}>
                {['GP', 'HC', 'RF', 'RH', 'OT', 'FL', 'TK'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="gecko-form-group">
              <label className="gecko-label">Cargo category</label>
              <select className="gecko-input" value={cargoCat} onChange={e => setCargoCat(e.target.value)}>
                {['GENERAL', 'DANGEROUS', 'REEFER_GEN', 'REEFER_DG', 'CONSOL', 'BONDED'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {numbers.length > room && line && (
            <div className="gecko-alert gecko-alert-warning">
              Line {line.lineNo} has room for {room}. The rest will be refused — raise the quantity first.
            </div>
          )}
        </div>

        <div className="gecko-modal-foot">
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm"
            disabled={busy || numbers.length === 0 || !line}
            onClick={async () => {
              setBusy(true);
              await onConfirm({ numbers, size, type, cargoCat });
              setBusy(false);
            }}>
            <Icon name="plus" size={13} /> {busy ? 'Saving…' : `Add ${numbers.length || ''} container${numbers.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── VAS Drawer — single container or apply-to-many ─────────────────────── */

function VasDrawer({ mode, containerIds, availableVAS, orderTypeCode, initialSelected, onCancel, onSave }: {
  mode: 'single' | 'multi';
  containerIds: string[];
  availableVAS: OrderTypeVASDef[];
  orderTypeCode: string;
  initialSelected: Set<string>;
  onCancel: () => void;
  onSave: (codes: Set<string>) => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(initialSelected);
  const togglePick = (code: string) => setPicked(prev => { const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); return n; });
  const title = mode === 'single'
    ? `Manage VAS — Container ${containerIds[0]}`
    : `Update VAS — ${containerIds.length} container${containerIds.length === 1 ? '' : 's'}`;

  return (
    <>
      <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 520, maxWidth: '94vw',
        background: 'var(--gecko-bg-surface)', borderLeft: '1px solid var(--gecko-border)',
        zIndex: 201, display: 'flex', flexDirection: 'column',
        boxShadow: '-12px 0 36px rgba(0, 0, 0, 0.18)',
        animation: 'gecko-slide-in-right 220ms ease',
      }}>
        <div className="gecko-row" style={{ padding: '16px 20px', borderBottom: '1px solid var(--gecko-border)', gap: 10 }}>
          <Icon name="tag" size={16} style={{ color: 'var(--gecko-primary-600)' }} />
          <div className="gecko-flex-1">
            <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
            <div className="gecko-cell-meta">
              Available VAS sourced from order type <strong>{orderTypeCode}</strong>.
              {mode === 'multi' && ' Changes apply to all selected containers.'}
            </div>
          </div>
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon" onClick={onCancel}>
            <Icon name="x" size={14} />
          </button>
        </div>

        <div className="gecko-flex-1" style={{ overflowY: 'auto', padding: 18 }}>
          {availableVAS.length === 0 ? (
            <div className="gecko-empty-state" style={{ padding: 36 }}>
              <Icon name="tag" size={28} className="gecko-empty-state-icon" />
              <div className="gecko-empty-state-title">No VAS defined</div>
              <div className="gecko-empty-state-description">Order type <strong>{orderTypeCode}</strong> has no VAS charges in its movement catalog.</div>
            </div>
          ) : (
            <div className="gecko-stack gecko-stack-sm" style={{ gap: 6 }}>
              {availableVAS.map(v => {
                const on = picked.has(v.code);
                return (
                  <label
                    key={v.code}
                    style={{
                      display: 'grid', gridTemplateColumns: '20px 1fr auto auto', gap: 10, alignItems: 'center',
                      padding: '10px 12px',
                      background: on ? 'var(--gecko-primary-50)' : 'var(--gecko-bg-surface)',
                      border: `1px solid ${on ? 'var(--gecko-primary-300)' : 'var(--gecko-border)'}`,
                      borderRadius: 8, cursor: 'pointer',
                    }}
                  >
                    <input type="checkbox" className="gecko-checkbox" checked={on} onChange={() => togglePick(v.code)} />
                    <div>
                      <div style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--gecko-primary-700)' }}>{v.code}</div>
                      <div style={{ fontSize: 11, color: 'var(--gecko-text-primary)', marginTop: 2 }}>{v.description}</div>
                    </div>
                    <span className={`gecko-pill gecko-pill-${v.paymentTerm === 'CASH' ? 'success' : 'info'}`} style={{ fontSize: 9 }}>{v.paymentTerm}</span>
                    <span className="gecko-cell-sub" style={{ fontWeight: 600, marginTop: 0 }}>{v.paymentTo}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="gecko-row gecko-row-between" style={{ padding: '14px 20px', borderTop: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)' }}>
          <span className="gecko-card-subtitle" style={{ marginTop: 0 }}>
            <strong>{picked.size}</strong> VAS line{picked.size === 1 ? '' : 's'} selected
          </span>
          <div className="gecko-row">
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onCancel}>Cancel</button>
            <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => onSave(picked)}>
              <Icon name="check" size={13} />
              {mode === 'single' ? 'Save VAS for this container' : `Apply VAS to ${containerIds.length} containers`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Order Type change soft-warn ─────────────────────────────────────────── */

function OrderTypeChangeConfirm({ from, to, onCancel, onConfirm }: {
  from: string; to: string; onCancel: () => void; onConfirm: () => void;
}) {
  const fromOT = getOrderType(from);
  const toOT   = getOrderType(to);
  return (
    <div className="gecko-modal-shell" onClick={onCancel}>
      <div className="gecko-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="gecko-row" style={{ padding: '16px 20px', borderBottom: '1px solid var(--gecko-border)', gap: 10, background: 'var(--gecko-warning-50)' }}>
          <Icon name="alertTriangle" size={16} style={{ color: 'var(--gecko-warning-600)' }} />
          <div className="gecko-flex-1">
            <div style={{ fontSize: 15, fontWeight: 700 }}>Change order type?</div>
            <div style={{ fontSize: 11, color: 'var(--gecko-warning-700)', marginTop: 2 }}>
              One or more containers have recorded transactions.
            </div>
          </div>
        </div>
        <div style={{ padding: 20, fontSize: 13, color: 'var(--gecko-text-primary)', lineHeight: 1.6 }}>
          <p style={{ margin: 0 }}>
            You&apos;re switching from <strong className="gecko-mono">{from}</strong> ({fromOT?.description ?? '—'}) to <strong className="gecko-mono">{to}</strong> ({toOT?.description ?? '—'}).
          </p>
          <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--gecko-text-secondary)' }}>
            <li><strong>Existing transactions</strong> (FULL IN, LOAD, etc.) <em>are preserved</em>.</li>
            <li><strong>Future movements</strong> for each container will follow the new order type&apos;s template ({toOT?.movements.length ?? 0} legs).</li>
            <li><strong>VAS charges</strong> already attached stay attached; the available-VAS list will refresh to match the new order type.</li>
          </ul>
        </div>
        <div className="gecko-action-toolbar" style={{ padding: '12px 20px', borderTop: '1px solid var(--gecko-border)' }}>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onCancel}>Cancel</button>
          <button className="gecko-btn gecko-btn-warning gecko-btn-sm" onClick={onConfirm}>
            <Icon name="check" size={13} /> Yes, change order type
          </button>
        </div>
      </div>
    </div>
  );
}


/* ──────────────────────────────────────────────────────────────────────────
   Transfer Containers — modal with candidate bookings + free search
   ────────────────────────────────────────────────────────────────────────── */

interface CandidateBooking {
  bookingNo: string;
  blNo: string;
  customer: string;
  agent: string;
  vessel: string;
  voyage: string;
  etd: string;
  orderType: string;
  containerCount: number;
}

const CANDIDATE_BOOKINGS: CandidateBooking[] = [
  // Top — same vessel + voyage as the source booking (EVER WEB / 0344-022B)
  { bookingNo: 'EGLV148710233102', blNo: 'EGLV148710233102', customer: 'TCL ELECTRONICS (THAILAND) CO., LTD',  agent: 'EVERGREEN', vessel: 'EVER WEB', voyage: '0344-022B', etd: '2026-06-21', orderType: 'EXP CY/CY', containerCount: 4 },
  { bookingNo: 'EGLV149612498744', blNo: 'EGLV149612498744', customer: 'THAI UNION GROUP PCL',                 agent: 'EVERGREEN', vessel: 'EVER WEB', voyage: '0344-022B', etd: '2026-06-21', orderType: 'EXP CY/CY', containerCount: 12 },
  { bookingNo: 'EGLV149600114985', blNo: 'EGLV149600114985', customer: 'PTT GLOBAL CHEMICAL PCL',              agent: 'EVERGREEN', vessel: 'EVER WEB', voyage: '0344-022B', etd: '2026-06-21', orderType: 'EXP CY/CY', containerCount: 6 },
  { bookingNo: 'EGLV149800223071', blNo: 'EGLV149800223071', customer: 'CP FOODS CO., LTD',                    agent: 'EVERGREEN', vessel: 'EVER WEB', voyage: '0344-022B', etd: '2026-06-21', orderType: 'EXP CY/CY', containerCount: 2 },
  { bookingNo: 'EGLV149991002883', blNo: 'EGLV149991002883', customer: 'BETAGRO PUBLIC CO.',                   agent: 'EVERGREEN', vessel: 'EVER WEB', voyage: '0344-022B', etd: '2026-06-21', orderType: 'EXP CY/CY', containerCount: 8 },
  // Other bookings (different vessel/voyage) — surface via search
  { bookingNo: 'MAEU2200448712', blNo: 'MAEU2200448712', customer: 'SIAM CEMENT GROUP (SCG)',     agent: 'MAERSK',    vessel: 'MAERSK EDINBURGH', voyage: 'M-512N', etd: '2026-06-28', orderType: 'EXP CY/CY', containerCount: 16 },
  { bookingNo: 'ONEY1187220046', blNo: 'ONEY1187220046', customer: 'AEON (THAILAND) CO.',         agent: 'ONE',       vessel: 'ONE COMMITMENT',   voyage: 'C-308S', etd: '2026-07-02', orderType: 'EXP CY/CY', containerCount: 3 },
  { bookingNo: 'CMAU8842339001', blNo: 'CMAU8842339001', customer: 'CHAROEN POKPHAND FOODS PCL',  agent: 'CMA-CGM',   vessel: 'CMA MARCO POLO',   voyage: '0712E',  etd: '2026-06-25', orderType: 'EXP CY/CY', containerCount: 9 },
];

function TransferContainersModal({
  sourceBookingNo, sourceVessel, sourceVoyage, containerCount,
  onCancel, onTransfer,
}: {
  sourceBookingNo: string;
  sourceVessel: string;
  sourceVoyage: string;
  containerCount: number;
  onCancel: () => void;
  onTransfer: (target: CandidateBooking) => void;
}) {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<string | null>(null);

  const similar = useMemo(
    () => CANDIDATE_BOOKINGS
      .filter(c => c.bookingNo !== sourceBookingNo && c.vessel === sourceVessel && c.voyage === sourceVoyage)
      .slice(0, 5),
    [sourceBookingNo, sourceVessel, sourceVoyage]
  );

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return CANDIDATE_BOOKINGS
      .filter(c => c.bookingNo !== sourceBookingNo)
      .filter(c =>
        c.bookingNo.toLowerCase().includes(q) ||
        c.customer.toLowerCase().includes(q)   ||
        c.vessel.toLowerCase().includes(q)     ||
        c.voyage.toLowerCase().includes(q));
  }, [search, sourceBookingNo]);

  const pickedBooking = picked ? CANDIDATE_BOOKINGS.find(c => c.bookingNo === picked) ?? null : null;

  return (
    <div className="gecko-modal-shell" onClick={onCancel}>
      <div className="gecko-modal-card gecko-modal-card-xl" onClick={(e) => e.stopPropagation()}>
        <div className="gecko-row" style={{ padding: '16px 20px', borderBottom: '1px solid var(--gecko-border)', gap: 10 }}>
          <Icon name="transferH" size={18} style={{ color: 'var(--gecko-primary-600)' }} />
          <div className="gecko-flex-1">
            <div style={{ fontSize: 15, fontWeight: 700 }}>Transfer containers</div>
            <div className="gecko-cell-meta">
              Moving <strong>{containerCount} container{containerCount === 1 ? '' : 's'}</strong> from <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{sourceBookingNo}</span> ({sourceVessel} · {sourceVoyage}) → pick a destination booking below.
            </div>
          </div>
          <button onClick={onCancel} className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon">
            <Icon name="x" size={14} />
          </button>
        </div>

        <div className="gecko-stack gecko-flex-1" style={{ overflowY: 'auto', padding: 20, gap: 18 }}>

          <div>
            <div className="gecko-eyebrow gecko-row gecko-mb-2">
              <Icon name="anchor" size={11} />
              Same vessel · voyage — top {similar.length}
              <span style={{ fontWeight: 500, color: 'var(--gecko-text-disabled)', textTransform: 'none', letterSpacing: 0 }}>
                {sourceVessel} / {sourceVoyage}
              </span>
            </div>
            {similar.length === 0 ? (
              <div className="gecko-empty-card" style={{ fontStyle: 'italic', fontSize: 11 }}>
                No other bookings on this vessel / voyage.
              </div>
            ) : (
              <CandidateTable items={similar} pickedId={picked} onPick={setPicked} />
            )}
          </div>

          <div>
            <div className="gecko-eyebrow gecko-row gecko-mb-2">
              <Icon name="search" size={11} />
              Or search any booking
            </div>
            <div style={{ position: 'relative' }}>
              <Icon name="search" size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-text-disabled)', pointerEvents: 'none' }} />
              <input
                className="gecko-input"
                placeholder="Type a booking no, customer, vessel, or voyage…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 34 }}
                autoFocus
              />
            </div>
            {search.trim().length >= 2 && (
              <div className="gecko-mt-3">
                {searchResults.length === 0 ? (
                  <div className="gecko-empty-card" style={{ fontStyle: 'italic', fontSize: 11 }}>
                    No bookings match <strong>&ldquo;{search}&rdquo;</strong>.
                  </div>
                ) : (
                  <CandidateTable items={searchResults} pickedId={picked} onPick={setPicked} />
                )}
              </div>
            )}
          </div>
        </div>

        <div className="gecko-row" style={{ padding: '14px 20px', borderTop: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)', gap: 12 }}>
          <div className="gecko-flex-1 gecko-page-subtitle">
            {pickedBooking ? (
              <>
                Destination: <strong className="gecko-mono" style={{ color: 'var(--gecko-text-primary)' }}>{pickedBooking.bookingNo}</strong>
                <span style={{ marginLeft: 6, color: 'var(--gecko-text-disabled)' }}>· {pickedBooking.customer}</span>
              </>
            ) : (
              <span style={{ color: 'var(--gecko-text-disabled)' }}>Select a destination booking to enable Transfer.</span>
            )}
          </div>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onCancel}>Cancel</button>
          <button
            className="gecko-btn gecko-btn-primary gecko-btn-sm"
            disabled={!pickedBooking}
            onClick={() => pickedBooking && onTransfer(pickedBooking)}
          >
            <Icon name="transferH" size={13} /> Transfer now
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Change Order Type — booking-level cascading change.

   Type-to-confirm pattern: the user picks a new order type, then must type
   the booking B/L number exactly to arm the apply button. Same protective
   pattern used by GitHub (delete repo), Vercel (delete project), AWS
   (delete resource) etc. — appropriate because:
     - cascades across ALL containers
     - re-seeds movement templates
     - refreshes the VAS catalog
     - changes billing eligibility
   ────────────────────────────────────────────────────────────────────────── */

function ChangeOrderTypeModal({
  bookingNo, bookingType, currentOrderTypeCode, totalContainers, containersWithRecordedMoves,
  onCancel, onConfirm,
}: {
  bookingNo: string;
  bookingType: 'EXPORT' | 'IMPORT';
  currentOrderTypeCode: string;
  totalContainers: number;
  containersWithRecordedMoves: number;
  onCancel: () => void;
  onConfirm: (newCode: string, remarks: string) => void;
}) {
  const eligible = useMemo(
    () => ACTIVE_ORDER_TYPES.filter(o => o.bookingType === bookingType),
    [bookingType]
  );
  const [picked, setPicked] = useState<string>(currentOrderTypeCode);
  const [typedBL, setTypedBL] = useState('');
  const [remarks, setRemarks] = useState('');

  const isDifferent = picked && picked !== currentOrderTypeCode;
  const blMatches = typedBL.trim().toUpperCase() === bookingNo.toUpperCase();
  const armed = isDifferent && blMatches;

  const copyBL = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(bookingNo).catch(() => { /* ignore */ });
    }
  };

  return (
    <div className="gecko-modal-shell" onClick={onCancel}>
      <div className="gecko-modal-card gecko-modal-card-lg" onClick={(e) => e.stopPropagation()}>
        {/* Header with warning tone */}
        <div className="gecko-row" style={{ padding: '16px 20px', borderBottom: '1px solid var(--gecko-warning-200)', gap: 10, background: 'var(--gecko-warning-50)' }}>
          <Icon name="alertTriangle" size={18} style={{ color: 'var(--gecko-warning-600)' }} />
          <div className="gecko-flex-1">
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gecko-warning-700)' }}>Change order type · booking-level change</div>
            <div style={{ fontSize: 12, color: 'var(--gecko-warning-700)', marginTop: 2 }}>
              Order type is set <strong>per booking</strong> — this affects all <strong>{totalContainers} container{totalContainers === 1 ? '' : 's'}</strong> under <span className="gecko-mono">{bookingNo}</span>.
            </div>
          </div>
          <button onClick={onCancel} className="gecko-icon-btn-ghost"><Icon name="x" size={14} /></button>
        </div>

        {/* Cascading-impact callout */}
        <div style={{ padding: '12px 20px', background: 'var(--gecko-bg-subtle)', borderBottom: '1px solid var(--gecko-border)' }}>
          <div className="gecko-eyebrow gecko-mb-2">What changes</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--gecko-text-primary)', lineHeight: 1.6 }}>
            <li>Movement templates re-seed across all <strong>{totalContainers}</strong> containers</li>
            <li>VAS catalog refreshes to match the new order type</li>
            <li>Billing eligibility may shift — verify the tariff covers the new movement set</li>
            {containersWithRecordedMoves > 0 && (
              <li style={{ color: 'var(--gecko-warning-700)' }}>
                <strong>{containersWithRecordedMoves}</strong> container{containersWithRecordedMoves === 1 ? ' has' : 's have'} recorded transactions — those records stay; future moves follow the new template
              </li>
            )}
          </ul>
        </div>

        {/* Body */}
        <div className="gecko-stack gecko-stack-md gecko-flex-1" style={{ overflowY: 'auto', padding: 18 }}>

          {/* Picker */}
          <div>
            <div className="gecko-eyebrow gecko-mb-2">
              Pick a new order type ·
              <span style={{ marginLeft: 4 }}>showing <span className="gecko-pill gecko-pill-info" style={{ fontSize: 10 }}>{bookingType}</span> only</span>
            </div>
            <div className="gecko-stack gecko-stack-sm" style={{ gap: 6 }}>
              {eligible.length === 0 ? (
                <div className="gecko-empty-state" style={{ padding: 24 }}>
                  <div className="gecko-empty-state-title">No matching order types</div>
                  <div className="gecko-empty-state-description">Configure one in Master Data → Order Types.</div>
                </div>
              ) : eligible.map(ot => {
                const isCurrent = ot.code === currentOrderTypeCode;
                const isPicked  = ot.code === picked;
                return (
                  <button
                    key={ot.id}
                    onClick={() => setPicked(ot.code)}
                    style={{
                      display: 'grid', gridTemplateColumns: '20px 1fr auto', gap: 12, alignItems: 'center',
                      padding: '10px 14px',
                      background: isPicked ? 'var(--gecko-primary-50)' : 'var(--gecko-bg-surface)',
                      border: `1.5px solid ${isPicked ? 'var(--gecko-primary-500)' : 'var(--gecko-border)'}`,
                      borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                      transition: 'all 120ms',
                    }}
                  >
                    <input type="radio" name="ot-pick" checked={isPicked} onChange={() => setPicked(ot.code)} />
                    <div>
                      <div className="gecko-row">
                        <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 13, fontWeight: 800, color: isPicked ? 'var(--gecko-primary-700)' : 'var(--gecko-text-primary)' }}>{ot.code}</span>
                        {isCurrent && <span className="gecko-pill gecko-pill-neutral" style={{ fontSize: 9 }}>CURRENT</span>}
                        <span className="gecko-pill gecko-pill-info" style={{ fontSize: 9 }}>{ot.bookingMode}</span>
                      </div>
                      <div className="gecko-cell-meta">{ot.description}</div>
                      <div className="gecko-cell-sub">
                        {ot.movements.map(m => m.code).join(' → ')}
                      </div>
                    </div>
                    <Icon name={isPicked ? 'check' : 'chevronRight'} size={14} style={{ color: isPicked ? 'var(--gecko-primary-600)' : 'var(--gecko-text-disabled)' }} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Typed-BL confirmation — appears only after a different order type is picked */}
          {isDifferent && (
            <div className="gecko-stack" style={{ paddingTop: 12, borderTop: '1px dashed var(--gecko-border)', gap: 10 }}>
              <div className="gecko-eyebrow" style={{ color: 'var(--gecko-warning-700)' }}>
                Confirm by typing the booking B/L number
              </div>

              {/* Copy-affordance row */}
              <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
                <div style={{
                  flex: 1, padding: '8px 12px',
                  background: 'var(--gecko-bg-subtle)',
                  border: '1px solid var(--gecko-border)', borderRadius: 8,
                  fontFamily: 'var(--gecko-font-mono)', fontSize: 14, fontWeight: 800,
                  color: 'var(--gecko-text-primary)', letterSpacing: '0.04em',
                  display: 'flex', alignItems: 'center',
                  userSelect: 'all',
                }}>
                  {bookingNo}
                </div>
                <button
                  type="button"
                  onClick={copyBL}
                  className="gecko-btn gecko-btn-outline gecko-btn-sm"
                  title="Copy to clipboard"
                >
                  <Icon name="copy" size={13} /> Copy
                </button>
              </div>

              <input
                className="gecko-input gecko-text-mono"
                value={typedBL}
                onChange={e => setTypedBL(e.target.value.toUpperCase())}
                placeholder="Type the B/L number above to confirm"
                style={{
                  fontWeight: 700, letterSpacing: '0.04em',
                  borderColor: blMatches ? 'var(--gecko-success-500)' : (typedBL ? 'var(--gecko-warning-500)' : undefined),
                }}
                autoFocus
              />
              {typedBL && !blMatches && (
                <div style={{ fontSize: 11, color: 'var(--gecko-warning-700)' }}>
                  Doesn&apos;t match — must equal <span className="gecko-mono" style={{ fontWeight: 700 }}>{bookingNo}</span>
                </div>
              )}

              <div className="gecko-field">
                <div className="gecko-field-label">Remarks for audit log <span className="gecko-helper-text" style={{ marginTop: 0, display: 'inline', fontWeight: 500 }}>(optional)</span></div>
                <textarea
                  className="gecko-textarea"
                  rows={2}
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder={`e.g. Customer changed shipping plan from ${currentOrderTypeCode} to ${picked}`}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="gecko-row" style={{ padding: '14px 20px', borderTop: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)', gap: 12 }}>
          <div className="gecko-flex-1 gecko-page-subtitle">
            {!isDifferent
              ? <span style={{ color: 'var(--gecko-text-disabled)' }}>Pick a different order type to continue.</span>
              : !blMatches
                ? <span>Changing <strong className="gecko-mono">{currentOrderTypeCode}</strong> → <strong className="gecko-mono">{picked}</strong> · type B/L to enable.</span>
                : <span style={{ color: 'var(--gecko-success-700)', fontWeight: 600 }}>
                    <Icon name="check" size={12} style={{ marginBottom: -1, marginRight: 4 }} />
                    B/L verified · ready to apply.
                  </span>
            }
          </div>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onCancel}>Cancel</button>
          <button
            className="gecko-btn gecko-btn-warning gecko-btn-sm"
            disabled={!armed}
            onClick={() => armed && onConfirm(picked, remarks.trim())}
          >
            <Icon name="alertTriangle" size={13} /> Change order type
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Single-container delete — small typed-DELETE confirm with remarks.
   Same UX shape as the booking DeleteConfirmModal, scoped to one container.
   ────────────────────────────────────────────────────────────────────────── */

function DeleteContainerModal({ container, onCancel, onConfirm }: {
  container: Container | null;
  onCancel: () => void;
  onConfirm: (remarks: string) => void;
}) {
  const [typed, setTyped] = useState('');
  const [remarks, setRemarks] = useState('');
  if (!container) return null;
  const armed = typed.trim().toUpperCase() === 'DELETE';

  return (
    <div className="gecko-modal-shell" onClick={onCancel}>
      <div className="gecko-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="gecko-row" style={{ padding: '16px 20px', borderBottom: '1px solid var(--gecko-border)', gap: 10, background: 'var(--gecko-error-50)' }}>
          <Icon name="trash" size={16} style={{ color: 'var(--gecko-error-600)' }} />
          <div className="gecko-flex-1">
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gecko-error-700)' }}>Delete container</div>
            <div style={{ fontSize: 11, color: 'var(--gecko-error-700)', marginTop: 2 }}>This will permanently remove the container from the booking.</div>
          </div>
        </div>

        <div className="gecko-stack gecko-stack-lg" style={{ padding: 20 }}>
          <div className="gecko-card gecko-card-tight" style={{ background: 'var(--gecko-bg-subtle)', fontSize: 12 }}>
            <div style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 800, fontSize: 14 }}>
              {container.containerNo || <span style={{ color: 'var(--gecko-text-disabled)', fontStyle: 'italic' }}>TBA (no container number yet)</span>}
            </div>
            <div className="gecko-row gecko-row-wrap gecko-cell-meta" style={{ marginTop: 4, gap: 14 }}>
              <span>Size/Type: <strong className="gecko-mono">{container.size}{container.type}</strong></span>
              <span>Mode: <strong>{container.containerMode}</strong></span>
              <span>Cargo: <strong>{container.cargoCategory}</strong></span>
            </div>
            {container.movements.some(m => m.status) && (
              <div className="gecko-banner gecko-banner-warning gecko-mt-2">
                <Icon name="alertTriangle" size={13} />
                <span>This container has recorded transactions ({container.movements.filter(m => m.status).map(m => m.code).join(', ')}). Deletion will also remove those gate records.</span>
              </div>
            )}
          </div>

          <div className="gecko-field">
            <div className="gecko-field-label gecko-field-required">Type <strong style={{ fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-error-600)' }}>DELETE</strong> to confirm</div>
            <input
              className="gecko-input gecko-text-mono"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder="DELETE"
              style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}
              autoFocus
            />
          </div>

          <div className="gecko-field">
            <div className="gecko-field-label">Reason for deletion <span className="gecko-helper-text" style={{ marginTop: 0, display: 'inline', fontWeight: 500 }}>(audit trail)</span></div>
            <textarea
              className="gecko-textarea"
              rows={2}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="e.g. Cancelled by customer · wrong size"
            />
          </div>
        </div>

        <div className="gecko-action-toolbar" style={{ padding: '12px 20px', borderTop: '1px solid var(--gecko-border)' }}>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onCancel}>Cancel</button>
          <button
            className="gecko-btn gecko-btn-danger gecko-btn-sm"
            disabled={!armed}
            onClick={() => onConfirm(remarks.trim())}
          >
            <Icon name="trash" size={13} /> Delete container
          </button>
        </div>
      </div>
    </div>
  );
}

function CandidateTable({ items, pickedId, onPick }: {
  items: CandidateBooking[];
  pickedId: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <div style={{ border: '1px solid var(--gecko-border)', borderRadius: 8, overflow: 'hidden' }}>
      <table className="gecko-table gecko-table-compact" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ width: 32 }} aria-label="Pick" />
            <th>Booking</th>
            <th>Customer</th>
            <th>Agent</th>
            <th>Vessel · Voyage</th>
            <th style={{ textAlign: 'right' }}>Cntrs</th>
            <th>ETD</th>
          </tr>
        </thead>
        <tbody>
          {items.map(c => {
            const isPicked = c.bookingNo === pickedId;
            return (
              <tr
                key={c.bookingNo}
                onClick={() => onPick(c.bookingNo)}
                className="gecko-row-clickable"
                style={{ background: isPicked ? 'var(--gecko-primary-50)' : undefined }}
              >
                <td>
                  <input
                    type="radio"
                    name="transfer-target"
                    checked={isPicked}
                    onChange={() => onPick(c.bookingNo)}
                    onClick={e => e.stopPropagation()}
                  />
                </td>
                <td><span className="gecko-id-link">{c.bookingNo}</span></td>
                <td>
                  <div className="gecko-cell-primary gecko-truncate" style={{ maxWidth: 200 }}>
                    {c.customer}
                  </div>
                </td>
                <td className="gecko-mono-strong">{c.agent}</td>
                <td>
                  <div className="gecko-cell-two-line">
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{c.vessel}</div>
                    <div className="gecko-cell-sub">{c.voyage}</div>
                  </div>
                </td>
                <td className="gecko-money">{c.containerCount}</td>
                <td className="gecko-cell-meta" style={{ fontFamily: 'var(--gecko-font-mono)', whiteSpace: 'nowrap' }}>{c.etd}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
