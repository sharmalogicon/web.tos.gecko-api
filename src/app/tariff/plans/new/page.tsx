"use client";
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { DateField } from '@/components/ui/DateField';
import { EntitySearch, type EntityOption } from '@/components/ui/EntitySearch';
import { WORKFLOWS, describeThreshold } from '@/lib/approval-workflows';
import {
  describeCondition,
  resolveCharge,
  type SurchargeCondition,
  type ConditionAxis,
  type ConditionOp,
  type ModifierOp,
  type ResolutionInput as LibResolutionInput,
  type ResolutionResult as LibResolutionResult,
} from '@/lib/tariff-types';

/* ──────────────────────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────────────────────── */

type ScheduleType = 'PUBLIC' | 'CONTRACT' | 'SPOT';
type ScheduleStatus = 'Draft' | 'Pending' | 'Active' | 'Expired';
type PaymentTerm = 'CASH' | 'CREDIT';
type BilledTo = 'CUSTOMER' | 'AGENT' | 'FWD' | 'LINE' | 'CARRIER' | 'HAULIER';

type Axis = 'SIZE' | 'TYPE' | 'TRUCK_CAT' | 'CARGO_CAT';

// AI-future provenance — every rate row carries who/where/how-confident it came from.
// Today: 'human' on UI-typed rows, 'imported' on CSV rows.
// Tomorrow: 'ai-suggested' / 'ai-extracted' rows render faded with a confidence chip
// and require an explicit accept gesture; the same schema serves training-data export.
type RateRowSource = 'human' | 'imported' | 'inherited' | 'ai-suggested' | 'ai-extracted';

interface RateRow {
  id: string;
  size?: string;
  type?: string;
  truckCat?: string;
  cargoCat?: string;
  paymentTerm: PaymentTerm;
  billedTo: BilledTo;
  amount: number;
  // Conditional surcharges — structured DSL so AI agents can read + write rules.
  conditions?: SurchargeCondition[];
  // Provenance
  source: RateRowSource;
  sourceRef?: string;     // e.g. 'csv:rates-2026q2.csv:row=42' or 'ai:gpt-rate-v1:req=abc'
  confidence?: number;    // 0..1, set by AI suggestions
  acceptedAt?: string;    // ISO when a human accepted an AI suggestion
}

// Resolution types live in the shared lib so the engine + UI agree on shape.
// Re-exported aliases here keep the editor's existing call sites compiling.
type ResolutionReason = LibResolutionResult['reason'];
type ResolutionResult = LibResolutionResult;
type ResolutionInput = LibResolutionInput;

interface PricedCharge {
  id: string;
  code: string;
  desc: string;
  source: 'MOVEMENT' | 'VAS';
  orderTypeId: string;
  movementSeq: number;
  axes: Set<Axis>;
  rows: RateRow[];
}

interface TEUBand {
  id: string;
  from: number;
  to: number;
  ratePerDay: number;
}

interface DaySlab {
  id: string;
  fromDay: number;
  toDay: number;
  ratePerDay: number;
}

interface StorageConfig {
  freeDays: number;
  mode: 'PER_DAY_SLAB' | 'FLEET_TEU_SLAB';
  perDaySlabs: DaySlab[];
  fleetTeuBands: TEUBand[];
}

interface FreeTimeMatrix {
  fullExport: { normal: number; reefer: number; dg: number };
  fullImport: { normal: number; reefer: number; dg: number };
  emptyExport: { normal: number; reefer: number };
  emptyImport: { normal: number; reefer: number };
  waiveMtyDm: boolean;
}

/* ──────────────────────────────────────────────────────────────────────────
   Catalogs (mock; in production these come from masters).
   Party catalogs (liner/forwarder/shipper) are served by EntitySearch.
   ────────────────────────────────────────────────────────────────────────── */

// Charge catalog (subset, drawn from order-types page)
interface CatalogMovement {
  seq: number; code: string; name: string;
  charges: { code: string; desc: string }[];
  vas: { code: string; desc: string }[];
}
interface CatalogOrderType {
  id: string; code: string; description: string;
  bookingType: 'EXPORT' | 'IMPORT' | 'TRANSSHIPMENT';
  movements: CatalogMovement[];
}

const ORDER_TYPE_CATALOG: CatalogOrderType[] = [
  {
    id: 'exp-cy-cy', code: 'EXP CY/CY', description: 'Export CY at SCT/ECT', bookingType: 'EXPORT',
    movements: [
      { seq: 1, code: 'EMTY DLVR', name: 'Empty Delivery (Gate-Out)',
        charges: [
          { code: 'SA001', desc: 'Admission Fee' },
          { code: 'SE001', desc: 'EDI Fee' },
          { code: 'SF001', desc: 'Service Fee' },
        ],
        vas: [
          { code: 'SC009', desc: 'Scanning Fee' },
          { code: 'SE002', desc: 'Special Equipment' },
        ],
      },
      { seq: 2, code: 'FCL RCVE', name: 'Laden Gate-In (FCL Receive)',
        charges: [
          { code: 'SA001', desc: 'Admission Fee' },
          { code: 'SB001', desc: 'Storage Fee (on-receipt)' },
          { code: 'SC001', desc: 'Handling Fee' },
          { code: 'SD001', desc: 'Documentation' },
        ],
        vas: [
          { code: 'SE002', desc: 'Special Equipment' },
          { code: 'SX001', desc: 'Weighbridge' },
        ],
      },
      { seq: 3, code: 'FCL DLVR', name: 'Laden Gate-Out (Port Delivery)',
        charges: [
          { code: 'SA001', desc: 'Admission Fee' },
          { code: 'SB002', desc: 'Port Dues' },
          { code: 'SC001', desc: 'Handling Fee' },
          { code: 'SL001', desc: 'Lashing Fee' },
        ],
        vas: [
          { code: 'SA003', desc: 'Customs Fee' },
        ],
      },
    ],
  },
  {
    id: 'imp-cy-cy', code: 'IMP CY/CY', description: 'Import CY to CY Delivery', bookingType: 'IMPORT',
    movements: [
      { seq: 1, code: 'FCL RCVE', name: 'Vessel Discharge / FCL Receive',
        charges: [
          { code: 'SA001', desc: 'Admission Fee' },
          { code: 'SB001', desc: 'Storage Fee (on-receipt)' },
          { code: 'SC001', desc: 'Handling Fee' },
        ],
        vas: [{ code: 'SA003', desc: 'Customs Fee' }],
      },
      { seq: 2, code: 'FCL DLVR', name: 'Laden Gate-Out (Consignee Delivery)',
        charges: [
          { code: 'SA001', desc: 'Admission Fee' },
          { code: 'SB001', desc: 'Dwell Charge' },
          { code: 'SD001', desc: 'Documentation' },
        ],
        vas: [{ code: 'SE002', desc: 'Special Equipment' }],
      },
      { seq: 3, code: 'EMTY RCVE', name: 'Empty Gate-In (Return to Depot)',
        charges: [
          { code: 'SA001', desc: 'Admission Fee' },
          { code: 'SC002', desc: 'Inspection Fee' },
        ],
        vas: [],
      },
    ],
  },
  {
    id: 'imp-lolo', code: 'IMP LOLO CR', description: 'Import Lo-Lo with Empty Return', bookingType: 'IMPORT',
    movements: [
      { seq: 1, code: 'FCL RCVE', name: 'Lo-Lo Vessel Discharge',
        charges: [
          { code: 'SA001', desc: 'Admission Fee' },
          { code: 'SC001', desc: 'Handling Fee' },
          { code: 'SB001', desc: 'Storage Fee (on-receipt)' },
        ],
        vas: [{ code: 'SA003', desc: 'Customs Fee' }],
      },
      { seq: 2, code: 'FCL DLVR', name: 'Laden Gate-Out',
        charges: [
          { code: 'SA001', desc: 'Admission Fee' },
          { code: 'SB001', desc: 'Dwell Charge' },
        ],
        vas: [],
      },
      { seq: 3, code: 'EMTY RCVE', name: 'Empty Gate-In (Return)',
        charges: [
          { code: 'SA001', desc: 'Admission Fee' },
          { code: 'SC002', desc: 'Inspection Fee' },
        ],
        vas: [],
      },
    ],
  },
];

const SIZES = ['20', '40', '45'];
const TYPES = ['DC', 'HC', 'RF', 'OT', 'FR', 'TK'];
const TRUCK_CATS = ['TRAILER', 'SIDE-LOADER', 'FLATBED', 'TIPPER'];
const CARGO_CATS = ['GENERAL', 'HAZ', 'TEMP', 'OOG'];

const AXIS_LABEL: Record<Axis, string> = {
  SIZE: 'Size', TYPE: 'Type', TRUCK_CAT: 'Truck-Cat', CARGO_CAT: 'Cargo-Cat',
};

const AXIS_VALUES: Record<Axis, string[]> = {
  SIZE: SIZES, TYPE: TYPES, TRUCK_CAT: TRUCK_CATS, CARGO_CAT: CARGO_CATS,
};

/* ──────────────────────────────────────────────────────────────────────────
   Small helpers
   ────────────────────────────────────────────────────────────────────────── */

const TYPE_TONE: Record<ScheduleType, { tone: string; icon: string; label: string }> = {
  PUBLIC:   { tone: 'info',    icon: 'globe',    label: 'Public' },
  CONTRACT: { tone: 'primary', icon: 'fileText', label: 'Contract' },
  SPOT:     { tone: 'warning', icon: 'clock',    label: 'Spot' },
};

let _ridSeed = 1;
const rid = () => `r_${_ridSeed++}_${Math.random().toString(36).slice(2, 7)}`;

const fmtTHB = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ──────────────────────────────────────────────────────────────────────────
   Helper components
   ────────────────────────────────────────────────────────────────────────── */

function TypeSelector({ value, onChange }: { value: ScheduleType; onChange: (v: ScheduleType) => void }) {
  return (
    <div className="gecko-segctrl" style={{ width: 'fit-content' }}>
      {(['PUBLIC', 'CONTRACT', 'SPOT'] as ScheduleType[]).map(t => {
        const meta = TYPE_TONE[t];
        const active = value === t;
        return (
          <button
            key={t}
            className={`gecko-segctrl-btn ${active ? 'gecko-segctrl-btn-active' : ''}`}
            onClick={() => onChange(t)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name={meta.icon} size={13} /> {meta.label}
          </button>
        );
      })}
    </div>
  );
}

function StickyHeader({
  scheduleId, name, status, type, partySummary, onActivate, onSave, dirty,
}: {
  scheduleId: string; name: string; status: ScheduleStatus; type: ScheduleType;
  partySummary: string; onActivate: () => void; onSave: () => void; dirty: boolean;
}) {
  const tt = TYPE_TONE[type];
  const statusTone: Record<ScheduleStatus, string> =
    { Draft: 'neutral', Pending: 'warning', Active: 'success', Expired: 'danger' };
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 20,
      background: 'var(--gecko-bg-surface)',
      borderBottom: '1px solid var(--gecko-border)',
      padding: '14px 24px',
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <Link href="/tariff/plans" className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon" aria-label="Back to schedules">
        <Icon name="arrowLeft" size={16} />
      </Link>

      <div className="gecko-flex-1">
        <div className="gecko-row gecko-row-wrap" style={{ gap: 10 }}>
          <span className="gecko-id-link">
            {scheduleId}
          </span>
          <span className={`gecko-pill gecko-pill-${statusTone[status]}`}>{status}</span>
          <span className={`gecko-pill gecko-pill-${tt.tone}`}>
            <Icon name={tt.icon} size={11} style={{ marginBottom: -1, marginRight: 4 }} /> {tt.label}
          </span>
          {dirty && (
            <span className="gecko-inline-row" style={{ fontSize: 11, color: 'var(--gecko-warning-700)', fontWeight: 600, gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gecko-warning-500)' }} />
              Unsaved changes
            </span>
          )}
        </div>
        <div className="gecko-row gecko-row-baseline gecko-row-wrap gecko-mt-1" style={{ gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>
            {name || <span style={{ color: 'var(--gecko-text-disabled)', fontStyle: 'italic', fontWeight: 500 }}>Untitled Tariff Schedule</span>}
          </h1>
          {partySummary && (
            <span style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', fontFamily: 'var(--gecko-font-mono)' }}>
              {partySummary}
            </span>
          )}
        </div>
      </div>

      <div className="gecko-row">
        <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onSave}>
          <Icon name="save" size={14} /> Save Draft
        </button>
        <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={onActivate} disabled={status === 'Active' || status === 'Pending'}>
          <Icon name="check" size={14} />
          {status === 'Active' ? 'Activated' : status === 'Pending' ? 'Awaiting Approval' : 'Submit for Approval'}
        </button>
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, right, children }: {
  title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="gecko-table-card">
      <div className="gecko-row" style={{ padding: '14px 18px', borderBottom: '1px solid var(--gecko-border)', gap: 12 }}>
        <div className="gecko-flex-1">
          <div className="gecko-section-header-title">{title}</div>
          {subtitle && <div className="gecko-section-header-subtitle">{subtitle}</div>}
        </div>
        {right}
      </div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Charge card with progressive axis disclosure
   ────────────────────────────────────────────────────────────────────────── */

// Available condition axes for the inline condition editor
const CONDITION_AXES: { value: ConditionAxis; label: string; kind: 'enum' | 'bool' | 'num' }[] = [
  { value: 'SIZE',      label: 'Size',     kind: 'enum' },
  { value: 'TYPE',      label: 'Type',     kind: 'enum' },
  { value: 'CARGO_CAT', label: 'Cargo',    kind: 'enum' },
  { value: 'TRUCK_CAT', label: 'Truck',    kind: 'enum' },
  { value: 'REEFER',    label: 'Reefer',   kind: 'bool' },
  { value: 'DG',        label: 'DG',       kind: 'bool' },
  { value: 'OOG',       label: 'OOG',      kind: 'bool' },
  { value: 'WEIGHT_KG', label: 'Weight kg', kind: 'num' },
];

const AXIS_ENUMS: Record<string, string[]> = {
  SIZE: SIZES, TYPE: TYPES, CARGO_CAT: CARGO_CATS, TRUCK_CAT: TRUCK_CATS,
};

const newConditionDraft = (): SurchargeCondition => ({
  id: rid(),
  when: { axis: 'REEFER', op: 'is', values: [true] },
  then: { op: 'add', value: 0 },
});

function ConditionInlineForm({
  draft, onChange, onSave, onCancel,
}: {
  draft: SurchargeCondition;
  onChange: (d: SurchargeCondition) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const axisMeta = CONDITION_AXES.find(a => a.value === draft.when.axis);
  const kind = axisMeta?.kind ?? 'enum';

  // Reset op + values when axis kind changes
  const setAxis = (axis: ConditionAxis) => {
    const meta = CONDITION_AXES.find(a => a.value === axis);
    if (!meta) return;
    if (meta.kind === 'bool') {
      onChange({ ...draft, when: { axis, op: 'is', values: [true] } });
    } else if (meta.kind === 'num') {
      onChange({ ...draft, when: { axis, op: 'gt', values: [0] } });
    } else {
      const firstVal = (AXIS_ENUMS[axis] ?? [''])[0];
      onChange({ ...draft, when: { axis, op: 'eq', values: [firstVal] } });
    }
  };

  return (
    <div className="gecko-row gecko-row-wrap" style={{
      gap: 6,
      padding: 10, background: 'var(--gecko-bg-surface)',
      border: '1px solid var(--gecko-primary-300)', borderRadius: 8,
      boxShadow: '0 0 0 3px var(--gecko-primary-100)',
    }}>
      <span className="gecko-eyebrow">WHEN</span>
      <select
        className="gecko-select gecko-input-sm"
        value={draft.when.axis}
        onChange={e => setAxis(e.target.value as ConditionAxis)}
        style={{ minWidth: 110 }}
      >
        {CONDITION_AXES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
      </select>

      <select
        className="gecko-select gecko-input-sm"
        value={draft.when.op}
        onChange={e => onChange({ ...draft, when: { ...draft.when, op: e.target.value as ConditionOp } })}
        style={{ minWidth: 70 }}
      >
        {kind === 'enum' && <><option value="eq">is</option><option value="in">in</option></>}
        {kind === 'bool' && <option value="is">is</option>}
        {kind === 'num' && <><option value="gt">&gt;</option><option value="gte">≥</option><option value="lt">&lt;</option><option value="lte">≤</option><option value="eq">=</option></>}
      </select>

      {kind === 'enum' && (
        <select
          className="gecko-select gecko-input-sm"
          value={String(draft.when.values[0] ?? '')}
          onChange={e => onChange({ ...draft, when: { ...draft.when, values: [e.target.value] } })}
          style={{ minWidth: 90 }}
        >
          {(AXIS_ENUMS[draft.when.axis] ?? []).map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      )}
      {kind === 'bool' && (
        <select
          className="gecko-select gecko-input-sm"
          value={String(draft.when.values[0] ?? 'true')}
          onChange={e => onChange({ ...draft, when: { ...draft.when, values: [e.target.value === 'true'] } })}
          style={{ minWidth: 90 }}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      )}
      {kind === 'num' && (
        <input
          type="number"
          className="gecko-input gecko-input-sm"
          value={Number(draft.when.values[0] ?? 0)}
          onChange={e => onChange({ ...draft, when: { ...draft.when, values: [Number(e.target.value) || 0] } })}
          style={{ width: 90 }}
        />
      )}

      <Icon name="arrowRight" size={12} style={{ color: 'var(--gecko-text-disabled)' }} />

      <span className="gecko-eyebrow">THEN</span>
      <select
        className="gecko-select gecko-input-sm"
        value={draft.then.op}
        onChange={e => onChange({ ...draft, then: { ...draft.then, op: e.target.value as ModifierOp } })}
        style={{ minWidth: 90 }}
      >
        <option value="add">+ add (THB)</option>
        <option value="multiply">× multiply</option>
        <option value="replace">→ replace</option>
      </select>
      <input
        type="number"
        step="0.01"
        className="gecko-input gecko-input-sm"
        value={draft.then.value}
        onChange={e => onChange({ ...draft, then: { ...draft.then, value: Number(e.target.value) || 0 } })}
        style={{ width: 80, fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}
      />

      <div className="gecko-row gecko-ml-auto" style={{ gap: 4 }}>
        <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={onCancel}>Cancel</button>
        <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={onSave}>
          <Icon name="check" size={12} /> Add
        </button>
      </div>
    </div>
  );
}

function ChargeCard({
  charge, onUpdate, onRemove,
}: {
  charge: PricedCharge;
  onUpdate: (c: PricedCharge) => void;
  onRemove: () => void;
}) {
  const [editingConditionRowId, setEditingConditionRowId] = useState<string | null>(null);
  const [conditionDraft, setConditionDraft] = useState<SurchargeCondition>(newConditionDraft);

  const addCondition = (rowId: string, cond: SurchargeCondition) => {
    onUpdate({
      ...charge,
      rows: charge.rows.map(r => r.id === rowId
        ? { ...r, conditions: [...(r.conditions ?? []), cond] }
        : r
      ),
    });
  };

  const removeCondition = (rowId: string, conditionId: string) => {
    onUpdate({
      ...charge,
      rows: charge.rows.map(r => r.id === rowId
        ? { ...r, conditions: (r.conditions ?? []).filter(c => c.id !== conditionId) }
        : r
      ),
    });
  };

  const toggleAxis = (a: Axis) => {
    const next = new Set(charge.axes);
    if (next.has(a)) {
      next.delete(a);
      const rows = charge.rows.map(r => {
        const copy = { ...r };
        if (a === 'SIZE') delete copy.size;
        if (a === 'TYPE') delete copy.type;
        if (a === 'TRUCK_CAT') delete copy.truckCat;
        if (a === 'CARGO_CAT') delete copy.cargoCat;
        return copy;
      });
      onUpdate({ ...charge, axes: next, rows });
    } else {
      next.add(a);
      onUpdate({ ...charge, axes: next });
    }
  };

  const addRow = () => {
    const newRow: RateRow = {
      id: rid(),
      paymentTerm: 'CASH',
      billedTo: 'CUSTOMER',
      amount: 0,
      source: 'human',
    };
    if (charge.axes.has('SIZE')) newRow.size = SIZES[0];
    if (charge.axes.has('TYPE')) newRow.type = TYPES[0];
    if (charge.axes.has('TRUCK_CAT')) newRow.truckCat = TRUCK_CATS[0];
    if (charge.axes.has('CARGO_CAT')) newRow.cargoCat = CARGO_CATS[0];
    onUpdate({ ...charge, rows: [...charge.rows, newRow] });
  };

  const updateRow = (id: string, patch: Partial<RateRow>) => {
    onUpdate({ ...charge, rows: charge.rows.map(r => r.id === id ? { ...r, ...patch } : r) });
  };

  const removeRow = (id: string) => {
    onUpdate({ ...charge, rows: charge.rows.filter(r => r.id !== id) });
  };

  const axes: Axis[] = ['SIZE', 'TYPE', 'TRUCK_CAT', 'CARGO_CAT'];
  const activeAxes = axes.filter(a => charge.axes.has(a));

  // Grid template depends on which axes are on
  const cols: string[] = [];
  if (charge.axes.has('SIZE')) cols.push('60px');
  if (charge.axes.has('TYPE')) cols.push('60px');
  if (charge.axes.has('TRUCK_CAT')) cols.push('120px');
  if (charge.axes.has('CARGO_CAT')) cols.push('90px');
  cols.push('80px'); // Pymt
  cols.push('110px'); // Billed to
  cols.push('1fr');   // Amount
  cols.push('28px');  // Remove
  const gridTemplate = cols.join(' ');

  return (
    <div className="gecko-charge-card">
      <div className="gecko-charge-card-head">
        <span className="gecko-charge-card-code">{charge.code}</span>
        <span className="gecko-charge-card-desc">{charge.desc}</span>
        <span className="gecko-charge-card-meta">
          <Icon name={charge.source === 'VAS' ? 'tag' : 'fileText'} size={11} />
          {charge.source === 'VAS' ? 'VAS' : 'Movement'}
        </span>
        <button className="gecko-charge-card-remove" onClick={onRemove} aria-label="Remove charge">
          <Icon name="x" size={14} />
        </button>
      </div>

      <div className="gecko-charge-card-body">
        <div className="gecko-axis-toolbar">
          <span className="gecko-axis-toolbar-label">Vary by:</span>
          {axes.map(a => {
            const active = charge.axes.has(a);
            return (
              <button
                key={a}
                className={`gecko-axis-chip ${active ? 'gecko-axis-chip-active' : ''}`}
                onClick={() => toggleAxis(a)}
              >
                {active ? <Icon name="x" size={10} /> : <Icon name="plus" size={10} />}
                {AXIS_LABEL[a]}
              </button>
            );
          })}
        </div>

        {/* Rate rows */}
        <div className="gecko-rate-rows">
          <div className="gecko-rate-rows-header" style={{ gridTemplateColumns: gridTemplate }}>
            {charge.axes.has('SIZE') && <div>Size</div>}
            {charge.axes.has('TYPE') && <div>Type</div>}
            {charge.axes.has('TRUCK_CAT') && <div>Truck-Cat</div>}
            {charge.axes.has('CARGO_CAT') && <div>Cargo-Cat</div>}
            <div>Pymt</div>
            <div>Billed To</div>
            <div style={{ textAlign: 'right' }}>Rate (THB)</div>
            <div />
          </div>

          {charge.rows.length === 0 && (
            <div style={{
              padding: '14px 10px', textAlign: 'center', fontSize: 12,
              color: 'var(--gecko-text-disabled)', fontStyle: 'italic',
              border: '1px dashed var(--gecko-border)', borderRadius: 6,
            }}>
              No rate rows. Click <strong>+ Add rate row</strong> to start pricing.
            </div>
          )}

          {charge.rows.map(r => (
            <div key={r.id} className="gecko-rate-row-block">
              <div className="gecko-rate-row" style={{ gridTemplateColumns: gridTemplate }}>
                {charge.axes.has('SIZE') && (
                  <select className="gecko-select gecko-input-sm" value={r.size ?? ''} onChange={e => updateRow(r.id, { size: e.target.value })}>
                    {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
                {charge.axes.has('TYPE') && (
                  <select className="gecko-select gecko-input-sm" value={r.type ?? ''} onChange={e => updateRow(r.id, { type: e.target.value })}>
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
                {charge.axes.has('TRUCK_CAT') && (
                  <select className="gecko-select gecko-input-sm" value={r.truckCat ?? ''} onChange={e => updateRow(r.id, { truckCat: e.target.value })}>
                    {TRUCK_CATS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
                {charge.axes.has('CARGO_CAT') && (
                  <select className="gecko-select gecko-input-sm" value={r.cargoCat ?? ''} onChange={e => updateRow(r.id, { cargoCat: e.target.value })}>
                    {CARGO_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
                <select className="gecko-select gecko-input-sm" value={r.paymentTerm} onChange={e => updateRow(r.id, { paymentTerm: e.target.value as PaymentTerm })}>
                  <option value="CASH">CASH</option>
                  <option value="CREDIT">CREDIT</option>
                </select>
                <select className="gecko-select gecko-input-sm" value={r.billedTo} onChange={e => updateRow(r.id, { billedTo: e.target.value as BilledTo })}>
                  <option value="CUSTOMER">CUSTOMER</option>
                  <option value="HAULIER">HAULIER</option>
                  <option value="LINE">LINE</option>
                  <option value="AGENT">AGENT</option>
                  <option value="FWD">FWD</option>
                  <option value="CARRIER">CARRIER</option>
                </select>
                <div className="gecko-rate-row-amount">
                  <input
                    type="number"
                    className="gecko-rate-row-amount-input"
                    value={r.amount}
                    onChange={e => updateRow(r.id, { amount: Number(e.target.value) || 0 })}
                    step="0.01"
                    min="0"
                  />
                  <span className="gecko-rate-row-currency">THB</span>
                </div>
                <button className="gecko-rate-row-remove" onClick={() => removeRow(r.id)} aria-label="Remove rate row">
                  <Icon name="x" size={12} />
                </button>
              </div>

              {/* Conditions strip — surcharges that modify this row's base rate */}
              <div className="gecko-conditions-strip">
                {(r.conditions ?? []).map(c => (
                  <span key={c.id} className="gecko-pill gecko-pill-warning" style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {describeCondition(c)}
                    <button
                      onClick={() => removeCondition(r.id, c.id)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1, fontFamily: 'inherit', fontSize: 12 }}
                      aria-label="Remove condition"
                    >×</button>
                  </span>
                ))}

                {editingConditionRowId === r.id ? (
                  <ConditionInlineForm
                    draft={conditionDraft}
                    onChange={setConditionDraft}
                    onSave={() => {
                      addCondition(r.id, conditionDraft);
                      setEditingConditionRowId(null);
                      setConditionDraft(newConditionDraft());
                    }}
                    onCancel={() => setEditingConditionRowId(null)}
                  />
                ) : (
                  <button
                    className="gecko-axis-chip"
                    onClick={() => {
                      setEditingConditionRowId(r.id);
                      setConditionDraft(newConditionDraft());
                    }}
                    style={{ fontSize: 10 }}
                  >
                    <Icon name="plus" size={10} /> Surcharge condition
                  </button>
                )}
              </div>
            </div>
          ))}

          <button className="gecko-rate-row-add" onClick={addRow}>
            <Icon name="plus" size={12} /> Add rate row
          </button>
        </div>

        {activeAxes.length === 0 && charge.rows.length > 1 && (
          <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', fontStyle: 'italic' }}>
            Tip: when more than one rate row is shown for a flat charge, the engine picks by <strong>Pymt × Billed-To</strong> match.
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Movement Charges tab
   ────────────────────────────────────────────────────────────────────────── */

function MovementChargesTab({
  orderTypesInScope, prices, setPrices,
}: {
  orderTypesInScope: string[];
  prices: PricedCharge[];
  setPrices: React.Dispatch<React.SetStateAction<PricedCharge[]>>;
}) {
  const inScope = ORDER_TYPE_CATALOG.filter(ot => orderTypesInScope.includes(ot.id));
  const [activeOT, setActiveOT] = useState<string>(inScope[0]?.id ?? '');
  const [activeMov, setActiveMov] = useState<number>(1);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const activeOtObj = inScope.find(o => o.id === activeOT);
  const activeMovObj = activeOtObj?.movements.find(m => m.seq === activeMov);

  const existingKey = (orderTypeId: string, movementSeq: number, code: string, source: 'MOVEMENT' | 'VAS') =>
    `${orderTypeId}|${movementSeq}|${code}|${source}`;

  const existingSet = useMemo(
    () => new Set(prices.map(p => existingKey(p.orderTypeId, p.movementSeq, p.code, p.source))),
    [prices]
  );

  const addCharge = (code: string, desc: string, source: 'MOVEMENT' | 'VAS') => {
    if (!activeOtObj || !activeMovObj) return;
    const key = existingKey(activeOtObj.id, activeMovObj.seq, code, source);
    if (existingSet.has(key)) return;
    const charge: PricedCharge = {
      id: rid(),
      code, desc, source,
      orderTypeId: activeOtObj.id,
      movementSeq: activeMovObj.seq,
      axes: new Set(),
      rows: [{ id: rid(), paymentTerm: 'CASH', billedTo: 'CUSTOMER', amount: 0, source: 'human' }],
    };
    setPrices(p => [...p, charge]);
  };

  const updateCharge = (id: string, next: PricedCharge) => {
    setPrices(p => p.map(c => c.id === id ? next : c));
  };

  const removeCharge = (id: string) => {
    setPrices(p => p.filter(c => c.id !== id));
  };

  const pricedForActive = prices.filter(p =>
    p.orderTypeId === activeOT && p.movementSeq === activeMov
  );

  if (inScope.length === 0) {
    return (
      <div className="gecko-empty-state" style={{ padding: 48 }}>
        <Icon name="package" size={36} className="gecko-empty-state-icon" />
        <div className="gecko-empty-state-title">No order types in scope yet</div>
        <div className="gecko-empty-state-description">
          Add at least one order type in the <strong>Overview</strong> tab before pricing charges.
        </div>
      </div>
    );
  }

  return (
    <div className="gecko-stack gecko-stack-lg">

      {/* Order Type tab strip */}
      <div className="gecko-tabs">
        {inScope.map(ot => {
          const isActive = ot.id === activeOT;
          return (
            <button
              key={ot.id}
              className={`gecko-tab ${isActive ? 'gecko-tab-active' : ''}`}
              onClick={() => { setActiveOT(ot.id); setActiveMov(ot.movements[0]?.seq ?? 1); }}
            >
              <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}>{ot.code}</span>
              <span style={{ fontSize: 10, color: 'var(--gecko-text-disabled)', marginLeft: 4 }}>
                ({prices.filter(p => p.orderTypeId === ot.id).length})
              </span>
            </button>
          );
        })}
      </div>

      {/* Movement strip */}
      {activeOtObj && (
        <div className="gecko-row" style={{ gap: 0, overflowX: 'auto', padding: '4px 0' }}>
          {activeOtObj.movements.map((m, idx) => {
            const isActive = m.seq === activeMov;
            const pricedCount = prices.filter(p => p.orderTypeId === activeOT && p.movementSeq === m.seq).length;
            return (
              <React.Fragment key={m.seq}>
                <button
                  onClick={() => setActiveMov(m.seq)}
                  style={{
                    flexShrink: 0,
                    background: isActive ? 'var(--gecko-primary-50)' : 'var(--gecko-bg-surface)',
                    border: `1.5px solid ${isActive ? 'var(--gecko-primary-500)' : 'var(--gecko-border)'}`,
                    borderRadius: 10,
                    padding: '10px 14px',
                    cursor: 'pointer',
                    transition: 'all 120ms',
                    display: 'flex', alignItems: 'center', gap: 10,
                    fontFamily: 'inherit',
                    minWidth: 200,
                  }}
                >
                  <div style={{
                    width: 26, height: 26, borderRadius: 7,
                    background: isActive ? 'var(--gecko-primary-600)' : 'var(--gecko-gray-200)',
                    color: isActive ? '#fff' : 'var(--gecko-text-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 12,
                  }}>{m.seq}</div>
                  <div style={{ textAlign: 'left', minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 11, fontWeight: 700, color: isActive ? 'var(--gecko-primary-700)' : 'var(--gecko-text-primary)' }}>
                      {m.code}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                      {m.name}
                    </div>
                  </div>
                  {pricedCount > 0 && (
                    <span className="gecko-pill gecko-pill-primary" style={{ marginLeft: 'auto', fontSize: 10 }}>
                      {pricedCount}
                    </span>
                  )}
                </button>
                {idx < activeOtObj.movements.length - 1 && (
                  <div style={{ width: 24, height: 2, background: 'var(--gecko-border)', flexShrink: 0 }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Priced charges + Add + Import */}
      <div className="gecko-row gecko-row-between" style={{ gap: 12 }}>
        <div className="gecko-section-header-title">
          {activeMovObj?.code} — Priced Charges
          <span style={{ fontWeight: 500, color: 'var(--gecko-text-secondary)', marginLeft: 8 }}>
            ({pricedForActive.length} of {(activeMovObj?.charges.length ?? 0) + (activeMovObj?.vas.length ?? 0)} catalog items)
          </span>
        </div>
        <div className="gecko-row">
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setShowImport(s => !s)}>
            <Icon name="upload" size={14} />
            Import from CSV
          </button>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setShowCatalog(s => !s)}>
            <Icon name={showCatalog ? 'chevronUp' : 'plus'} size={14} />
            {showCatalog ? 'Close catalog' : 'Add charge from catalog'}
          </button>
        </div>
      </div>

      <ImportRatesPanel
        open={showImport}
        onClose={() => setShowImport(false)}
        prices={prices}
        setPrices={setPrices}
      />

      {/* Catalog drawer */}
      {showCatalog && activeMovObj && (
        <div className="gecko-stack gecko-stack-sm" style={{
          background: 'var(--gecko-bg-subtle)',
          border: '1px solid var(--gecko-border)',
          borderRadius: 12,
          padding: 14,
          gap: 10,
        }}>
          <div className="gecko-row">
            <Icon name="fileText" size={13} style={{ color: 'var(--gecko-primary-600)' }} />
            <span className="gecko-eyebrow">
              Movement Charges
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
            {activeMovObj.charges.map(c => {
              const isAdded = existingSet.has(existingKey(activeOT, activeMov, c.code, 'MOVEMENT'));
              return (
                <div
                  key={`${c.code}-mv`}
                  className={`gecko-catalog-item ${isAdded ? 'gecko-catalog-item-added' : ''}`}
                  onClick={() => !isAdded && addCharge(c.code, c.desc, 'MOVEMENT')}
                >
                  <span className="gecko-catalog-item-code">{c.code}</span>
                  <span className="gecko-catalog-item-desc">{c.desc}</span>
                  <Icon name={isAdded ? 'check' : 'plus'} size={14} style={{ color: isAdded ? 'var(--gecko-success-600)' : 'var(--gecko-primary-600)' }} />
                </div>
              );
            })}
          </div>

          {activeMovObj.vas.length > 0 && (
            <>
              <div className="gecko-row" style={{ marginTop: 6 }}>
                <Icon name="tag" size={13} style={{ color: 'var(--gecko-accent-600)' }} />
                <span className="gecko-eyebrow">
                  VAS — Value-Added Services (opt-in)
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
                {activeMovObj.vas.map(v => {
                  const isAdded = existingSet.has(existingKey(activeOT, activeMov, v.code, 'VAS'));
                  return (
                    <div
                      key={`${v.code}-vas`}
                      className={`gecko-catalog-item ${isAdded ? 'gecko-catalog-item-added' : ''}`}
                      onClick={() => !isAdded && addCharge(v.code, v.desc, 'VAS')}
                    >
                      <span className="gecko-catalog-item-code">{v.code}</span>
                      <span className="gecko-catalog-item-desc">{v.desc}</span>
                      <Icon name={isAdded ? 'check' : 'plus'} size={14} style={{ color: isAdded ? 'var(--gecko-success-600)' : 'var(--gecko-accent-600)' }} />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Charge cards */}
      {pricedForActive.length === 0 && !showCatalog && (
        <div className="gecko-empty-state" style={{ padding: 36 }}>
          <Icon name="dollarSign" size={32} className="gecko-empty-state-icon" />
          <div className="gecko-empty-state-title">No charges priced for this movement yet</div>
          <div className="gecko-empty-state-description">
            Click <strong>Add charge from catalog</strong> above to pick which catalog charges you negotiated.
          </div>
        </div>
      )}

      <div className="gecko-stack">
        {pricedForActive.map(c => (
          <ChargeCard
            key={c.id}
            charge={c}
            onUpdate={(next) => updateCharge(c.id, next)}
            onRemove={() => removeCharge(c.id)}
          />
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Non-Movement Charges tab
   ────────────────────────────────────────────────────────────────────────── */

function StorageCard({
  title, accent, config, onChange, supportTEU,
}: {
  title: string; accent: string; config: StorageConfig;
  onChange: (c: StorageConfig) => void; supportTEU: boolean;
}) {
  return (
    <SectionCard
      title={title}
      subtitle={config.mode === 'FLEET_TEU_SLAB' ? 'Regressive slab by fleet TEU at depot' : 'Free days + per-day slab'}
      right={
        <div className="gecko-row">
          <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 600 }}>Pricing mode:</span>
          <div className="gecko-segctrl">
            <button
              className={`gecko-segctrl-btn ${config.mode === 'PER_DAY_SLAB' ? 'gecko-segctrl-btn-active' : ''}`}
              onClick={() => onChange({ ...config, mode: 'PER_DAY_SLAB' })}
            >
              Per-day slab
            </button>
            {supportTEU && (
              <button
                className={`gecko-segctrl-btn ${config.mode === 'FLEET_TEU_SLAB' ? 'gecko-segctrl-btn-active' : ''}`}
                onClick={() => onChange({ ...config, mode: 'FLEET_TEU_SLAB' })}
              >
                Fleet-TEU slab
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="gecko-row" style={{ gap: 16, marginBottom: 14, padding: 12, background: `linear-gradient(135deg, ${accent}10, transparent)`, borderRadius: 8, border: `1px solid ${accent}40` }}>
        <div className="gecko-mini-icon" style={{ width: 36, height: 36, borderRadius: 9, background: accent, color: '#fff' }}>
          <Icon name="clock" size={18} />
        </div>
        <div className="gecko-field" style={{ flex: 0, minWidth: 120 }}>
          <div className="gecko-field-label">Free days</div>
          <input
            type="number" min="0" className="gecko-input gecko-input-sm"
            value={config.freeDays} onChange={e => onChange({ ...config, freeDays: Number(e.target.value) || 0 })}
            style={{ width: 100 }}
          />
        </div>
        <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', lineHeight: 1.5 }}>
          Container can sit free for <strong>{config.freeDays}</strong> day{config.freeDays === 1 ? '' : 's'} after gate-in. Storage clock starts day {config.freeDays + 1}.
        </div>
      </div>

      {config.mode === 'PER_DAY_SLAB' ? (
        <div className="gecko-stack gecko-stack-sm" style={{ gap: 10 }}>
          <div className="gecko-band-row gecko-band-row-header" style={{ background: 'transparent', border: 'none', gridTemplateColumns: '110px 110px 1fr auto' }}>
            <div>From day</div>
            <div>To day</div>
            <div>Rate per day per container</div>
            <div />
          </div>

          {config.perDaySlabs.map((s, i) => {
            const isLast = i === config.perDaySlabs.length - 1;
            const TONES = ['var(--gecko-info-500)', 'var(--gecko-warning-500)', 'var(--gecko-error-500)', 'var(--gecko-primary-500)', 'var(--gecko-accent-500)'];
            const tone = TONES[i % TONES.length];
            return (
              <div key={s.id} className="gecko-band-row" style={{ gridTemplateColumns: '110px 110px 1fr auto', alignItems: 'center' }}>
                <div className="gecko-row" style={{ gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: tone, flexShrink: 0 }} />
                  <input type="number" min="1" className="gecko-input gecko-input-sm"
                    value={s.fromDay} onChange={e => {
                      const next = [...config.perDaySlabs];
                      next[i] = { ...s, fromDay: Number(e.target.value) || 1 };
                      onChange({ ...config, perDaySlabs: next });
                    }}
                    style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}
                  />
                </div>
                <input type="number" min={s.fromDay} className="gecko-input gecko-input-sm"
                  value={s.toDay} onChange={e => {
                    const next = [...config.perDaySlabs];
                    next[i] = { ...s, toDay: Number(e.target.value) || s.fromDay };
                    onChange({ ...config, perDaySlabs: next });
                  }}
                  style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}
                />
                <div className="gecko-row">
                  <input type="number" min="0" step="0.01" className="gecko-input gecko-input-sm"
                    value={s.ratePerDay} onChange={e => {
                      const next = [...config.perDaySlabs];
                      next[i] = { ...s, ratePerDay: Number(e.target.value) || 0 };
                      onChange({ ...config, perDaySlabs: next });
                    }}
                    style={{ width: 120, textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}
                  />
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)' }}>THB / day / cont</span>
                  {isLast && (
                    <span className="gecko-pill gecko-pill-neutral" style={{ fontSize: 9 }}>
                      and after
                    </span>
                  )}
                </div>
                <button
                  className="gecko-charge-card-remove"
                  onClick={() => {
                    const next = config.perDaySlabs.filter(x => x.id !== s.id);
                    onChange({ ...config, perDaySlabs: next.length === 0
                      ? [{ id: rid(), fromDay: 1, toDay: 5, ratePerDay: 0 }]
                      : next
                    });
                  }}
                  aria-label="Remove slab"
                  disabled={config.perDaySlabs.length === 1}
                  title={config.perDaySlabs.length === 1 ? 'At least one slab is required' : 'Remove this slab'}
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            );
          })}

          <button
            className="gecko-rate-row-add"
            onClick={() => {
              const last = config.perDaySlabs[config.perDaySlabs.length - 1];
              const nextFrom = last ? last.toDay + 1 : 1;
              const nextTo   = nextFrom + 4;
              const nextRate = last ? Math.round(last.ratePerDay * 1.5) : 0;
              onChange({
                ...config,
                perDaySlabs: [...config.perDaySlabs, { id: rid(), fromDay: nextFrom, toDay: nextTo, ratePerDay: nextRate }],
              });
            }}
          >
            <Icon name="plus" size={12} /> Add day slab
          </button>

          <div style={{ fontSize: 11, color: 'var(--gecko-text-disabled)', fontStyle: 'italic' }}>
            Tip: slabs are evaluated low → high. The last slab applies for all days beyond its <strong>To day</strong>.
          </div>
        </div>
      ) : (
        <div className="gecko-stack gecko-stack-sm" style={{ gap: 10 }}>
          <div className="gecko-row gecko-row-start" style={{
            padding: 10, background: 'var(--gecko-info-50)', border: '1px solid var(--gecko-info-200)',
            borderRadius: 8, fontSize: 11, color: 'var(--gecko-info-700)',
          }}>
            <Icon name="info" size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong>Fleet-TEU slab:</strong> rate is determined by the line&apos;s <em>total fleet TEU</em> at the depot on the storage day —
              so the more boxes the line has parked, the lower the per-box per-day rate. Regressive volume pricing across the line&apos;s whole footprint, not per-container slab.
            </div>
          </div>

          <div className="gecko-band-row gecko-band-row-header" style={{ background: 'transparent', border: 'none' }}>
            <div>Band From</div>
            <div>Band To</div>
            <div>Rate per day per container</div>
            <div />
          </div>

          {config.fleetTeuBands.map((b, i) => (
            <div key={b.id} className="gecko-band-row">
              <input type="number" min="0" className="gecko-input gecko-input-sm"
                value={b.from} onChange={e => {
                  const next = [...config.fleetTeuBands];
                  next[i] = { ...b, from: Number(e.target.value) || 0 };
                  onChange({ ...config, fleetTeuBands: next });
                }}
              />
              <input type="number" min="0" className="gecko-input gecko-input-sm"
                value={b.to} onChange={e => {
                  const next = [...config.fleetTeuBands];
                  next[i] = { ...b, to: Number(e.target.value) || 0 };
                  onChange({ ...config, fleetTeuBands: next });
                }}
              />
              <div className="gecko-row" style={{ gap: 6 }}>
                <input type="number" min="0" step="0.01" className="gecko-input gecko-input-sm"
                  value={b.ratePerDay} onChange={e => {
                    const next = [...config.fleetTeuBands];
                    next[i] = { ...b, ratePerDay: Number(e.target.value) || 0 };
                    onChange({ ...config, fleetTeuBands: next });
                  }}
                  style={{ width: 110, textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}
                />
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)' }}>THB</span>
                <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>
                  {b.ratePerDay === 0 ? '— FREE' : ''}
                </span>
              </div>
              <button
                className="gecko-charge-card-remove"
                onClick={() => onChange({ ...config, fleetTeuBands: config.fleetTeuBands.filter(x => x.id !== b.id) })}
                aria-label="Remove band"
              >
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}

          <button
            className="gecko-rate-row-add"
            onClick={() => onChange({
              ...config,
              fleetTeuBands: [...config.fleetTeuBands, { id: rid(), from: 0, to: 0, ratePerDay: 0 }],
            })}
          >
            <Icon name="plus" size={12} /> Add band
          </button>
        </div>
      )}
    </SectionCard>
  );
}

function ReeferEventCard({
  title, icon, accent, rates, onChange,
}: {
  title: string; icon: string; accent: string;
  rates: Record<string, number>;
  onChange: (r: Record<string, number>) => void;
}) {
  const REEFER_SIZES = ['20RF', '40RF', '40HC-RF'];
  return (
    <SectionCard title={title} subtitle="Per-event flat rate by reefer container size">
      <div className="gecko-row" style={{ gap: 16 }}>
        <div className="gecko-mini-icon" style={{ width: 44, height: 44, borderRadius: 11, background: accent, color: '#fff' }}>
          <Icon name={icon} size={20} />
        </div>
        <div className="gecko-row gecko-flex-1" style={{ gap: 14 }}>
          {REEFER_SIZES.map(sz => (
            <div key={sz} className="gecko-field gecko-flex-1" style={{ minWidth: 130 }}>
              <div className="gecko-field-label">{sz}</div>
              <div className="gecko-row" style={{ gap: 6 }}>
                <input
                  type="number" min="0" step="0.01" className="gecko-input gecko-input-sm"
                  value={rates[sz] ?? 0}
                  onChange={e => onChange({ ...rates, [sz]: Number(e.target.value) || 0 })}
                  style={{ flex: 1, textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}
                />
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)' }}>THB</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Free Time tab
   ────────────────────────────────────────────────────────────────────────── */

function FreeTimeTab({ matrix, onChange }: { matrix: FreeTimeMatrix; onChange: (m: FreeTimeMatrix) => void }) {
  const Cell = ({ value, onSet }: { value: number; onSet: (n: number) => void }) => (
    <input
      type="number" min="0"
      className="gecko-input gecko-input-sm"
      value={value}
      onChange={e => onSet(Number(e.target.value) || 0)}
      style={{ width: 64, textAlign: 'center', fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}
    />
  );

  return (
    <SectionCard
      title="Free Time / Storage Free Days"
      subtitle="Days of free storage by container category and trade direction. Storage charges accrue after this."
    >
      <div className="gecko-grid-2" style={{ gap: 20 }}>

        {/* FULL */}
        <div style={{ border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden' }}>
          <div className="gecko-row" style={{ padding: '10px 14px', background: 'var(--gecko-success-50)', borderBottom: '1px solid var(--gecko-success-200)' }}>
            <Icon name="package" size={14} style={{ color: 'var(--gecko-success-700)' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-success-700)' }}>FULL (Laden)</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--gecko-border)' }}>Direction</th>
                <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--gecko-border)' }}>Normal</th>
                <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--gecko-border)' }}>Reefer</th>
                <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--gecko-border)' }}>DG</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>Export ↑</td>
                <td style={{ padding: '8px', textAlign: 'center' }}><Cell value={matrix.fullExport.normal} onSet={n => onChange({ ...matrix, fullExport: { ...matrix.fullExport, normal: n } })} /></td>
                <td style={{ padding: '8px', textAlign: 'center' }}><Cell value={matrix.fullExport.reefer} onSet={n => onChange({ ...matrix, fullExport: { ...matrix.fullExport, reefer: n } })} /></td>
                <td style={{ padding: '8px', textAlign: 'center' }}><Cell value={matrix.fullExport.dg} onSet={n => onChange({ ...matrix, fullExport: { ...matrix.fullExport, dg: n } })} /></td>
              </tr>
              <tr>
                <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--gecko-text-primary)', borderTop: '1px solid var(--gecko-border)' }}>Import ↓</td>
                <td style={{ padding: '8px', textAlign: 'center', borderTop: '1px solid var(--gecko-border)' }}><Cell value={matrix.fullImport.normal} onSet={n => onChange({ ...matrix, fullImport: { ...matrix.fullImport, normal: n } })} /></td>
                <td style={{ padding: '8px', textAlign: 'center', borderTop: '1px solid var(--gecko-border)' }}><Cell value={matrix.fullImport.reefer} onSet={n => onChange({ ...matrix, fullImport: { ...matrix.fullImport, reefer: n } })} /></td>
                <td style={{ padding: '8px', textAlign: 'center', borderTop: '1px solid var(--gecko-border)' }}><Cell value={matrix.fullImport.dg} onSet={n => onChange({ ...matrix, fullImport: { ...matrix.fullImport, dg: n } })} /></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* EMPTY */}
        <div style={{ border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden' }}>
          <div className="gecko-row" style={{ padding: '10px 14px', background: 'var(--gecko-info-50)', borderBottom: '1px solid var(--gecko-info-200)' }}>
            <Icon name="box" size={14} style={{ color: 'var(--gecko-info-700)' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-info-700)' }}>EMPTY</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--gecko-border)' }}>Direction</th>
                <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--gecko-border)' }}>Normal</th>
                <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--gecko-border)' }}>Reefer</th>
                <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--gecko-border)' }}>—</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>Export ↑</td>
                <td style={{ padding: '8px', textAlign: 'center' }}><Cell value={matrix.emptyExport.normal} onSet={n => onChange({ ...matrix, emptyExport: { ...matrix.emptyExport, normal: n } })} /></td>
                <td style={{ padding: '8px', textAlign: 'center' }}><Cell value={matrix.emptyExport.reefer} onSet={n => onChange({ ...matrix, emptyExport: { ...matrix.emptyExport, reefer: n } })} /></td>
                <td style={{ padding: '8px', textAlign: 'center', color: 'var(--gecko-text-disabled)' }}>—</td>
              </tr>
              <tr>
                <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--gecko-text-primary)', borderTop: '1px solid var(--gecko-border)' }}>Import ↓</td>
                <td style={{ padding: '8px', textAlign: 'center', borderTop: '1px solid var(--gecko-border)' }}><Cell value={matrix.emptyImport.normal} onSet={n => onChange({ ...matrix, emptyImport: { ...matrix.emptyImport, normal: n } })} /></td>
                <td style={{ padding: '8px', textAlign: 'center', borderTop: '1px solid var(--gecko-border)' }}><Cell value={matrix.emptyImport.reefer} onSet={n => onChange({ ...matrix, emptyImport: { ...matrix.emptyImport, reefer: n } })} /></td>
                <td style={{ padding: '8px', textAlign: 'center', color: 'var(--gecko-text-disabled)', borderTop: '1px solid var(--gecko-border)' }}>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="gecko-row gecko-row-between" style={{ marginTop: 18, padding: 14, background: 'var(--gecko-bg-subtle)', border: '1px solid var(--gecko-border)', borderRadius: 10, gap: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>Waive Storage for MTY DM Containers</div>
          <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>
            Damaged empties waiting on M&amp;R disposition won't accrue storage charges.
          </div>
        </div>
        <button
          className={`gecko-toggle ${matrix.waiveMtyDm ? 'gecko-toggle-on' : ''}`}
          onClick={() => onChange({ ...matrix, waiveMtyDm: !matrix.waiveMtyDm })}
          aria-pressed={matrix.waiveMtyDm}
        >
          <span className="gecko-toggle-thumb" />
        </button>
      </div>
    </SectionCard>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   CSV utilities — Excel/CSV import + template download
   No external deps. Parses RFC 4180-ish CSV (handles quoted fields with commas
   and escaped quotes). Excel "Save As CSV" output works directly.
   ────────────────────────────────────────────────────────────────────────── */

function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  return lines.map(line => {
    const fields: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQ = !inQ; }
      else if (c === ',' && !inQ) { fields.push(cur); cur = ''; }
      else cur += c;
    }
    fields.push(cur);
    return fields.map(f => f.trim());
  });
}

const TEMPLATE_HEADER = [
  'OrderType', 'MovementCode', 'MovementSeq', 'Source', 'ChargeCode', 'ChargeDesc',
  'Size', 'Type', 'TruckCat', 'CargoCat', 'PaymentTerm', 'BilledTo', 'Amount',
];

const TEMPLATE_SAMPLES: string[][] = [
  ['EXP CY/CY', 'FCL RCVE', '2', 'MOVEMENT', 'SA001', 'Admission Fee',     '',   '',   '',         '',        'CASH',   'CUSTOMER', '250'],
  ['EXP CY/CY', 'FCL RCVE', '2', 'MOVEMENT', 'SA001', 'Admission Fee',     '',   '',   '',         '',        'CREDIT', 'LINE',     '180'],
  ['EXP CY/CY', 'FCL RCVE', '2', 'MOVEMENT', 'SB001', 'Storage Fee',       '40', 'DC', '',         '',        'CREDIT', 'CUSTOMER', '420'],
  ['EXP CY/CY', 'FCL RCVE', '2', 'MOVEMENT', 'SB001', 'Storage Fee',       '20', 'DC', '',         '',        'CREDIT', 'CUSTOMER', '320'],
  ['EXP CY/CY', 'FCL RCVE', '2', 'MOVEMENT', 'SC001', 'Handling Fee',      '40', '',   'TRAILER',  'HAZ',     'CASH',   'AGENT',    '900'],
  ['IMP CY/CY', 'FCL DLVR', '2', 'VAS',      'SE002', 'Special Equipment', '',   '',   '',         '',        'CASH',   'CUSTOMER', '500'],
];

function downloadTemplate() {
  const lines = [TEMPLATE_HEADER.join(','), ...TEMPLATE_SAMPLES.map(r => r.join(','))];
  const csv = lines.join('\n') + '\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'gecko-tariff-rates-template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface ImportRow {
  rowNum: number;
  orderType: string;
  movementCode: string;
  movementSeq: number;
  source: 'MOVEMENT' | 'VAS';
  chargeCode: string;
  chargeDesc: string;
  size?: string;
  type?: string;
  truckCat?: string;
  cargoCat?: string;
  paymentTerm: PaymentTerm;
  billedTo: BilledTo;
  amount: number;
  // Validation
  orderTypeId?: string;
  matched: boolean;
  errors: string[];
}

function validateImportRows(rows: ImportRow[]): ImportRow[] {
  return rows.map(r => {
    const errors: string[] = [];
    const ot = ORDER_TYPE_CATALOG.find(o => o.code === r.orderType);
    if (!ot) errors.push(`OrderType "${r.orderType}" not found`);
    else {
      r.orderTypeId = ot.id;
      const mov = ot.movements.find(m => m.code === r.movementCode && m.seq === r.movementSeq);
      if (!mov) errors.push(`Movement "${r.movementCode}" seq ${r.movementSeq} not in ${r.orderType}`);
      else {
        const catalog = r.source === 'MOVEMENT' ? mov.charges : mov.vas;
        if (!catalog.find(c => c.code === r.chargeCode)) {
          errors.push(`Charge "${r.chargeCode}" not in ${r.movementCode} ${r.source} catalog`);
        }
      }
    }
    if (!['CASH', 'CREDIT'].includes(r.paymentTerm)) errors.push(`Invalid PaymentTerm "${r.paymentTerm}"`);
    if (!['CUSTOMER', 'AGENT', 'FWD', 'LINE', 'CARRIER', 'HAULIER'].includes(r.billedTo)) {
      errors.push(`Invalid BilledTo "${r.billedTo}"`);
    }
    if (isNaN(r.amount) || r.amount < 0) errors.push(`Invalid Amount "${r.amount}"`);
    return { ...r, errors, matched: errors.length === 0 };
  });
}

async function readImportFile(file: File): Promise<ImportRow[]> {
  const text = await file.text();
  const rows = parseCSV(text);
  const header = rows.shift();
  if (!header) throw new Error('Empty file');
  const idx = (col: string) => header.findIndex(h => h.toLowerCase() === col.toLowerCase());
  const colMap = {
    orderType:    idx('OrderType'),
    movementCode: idx('MovementCode'),
    movementSeq:  idx('MovementSeq'),
    source:       idx('Source'),
    chargeCode:   idx('ChargeCode'),
    chargeDesc:   idx('ChargeDesc'),
    size:         idx('Size'),
    type:         idx('Type'),
    truckCat:     idx('TruckCat'),
    cargoCat:     idx('CargoCat'),
    paymentTerm:  idx('PaymentTerm'),
    billedTo:     idx('BilledTo'),
    amount:       idx('Amount'),
  };
  if (Object.entries(colMap).some(([, v]) => v === -1)) {
    throw new Error('CSV header missing required columns. Download the template to see the expected format.');
  }
  const parsed: ImportRow[] = rows.map((row, i) => ({
    rowNum: i + 2, // +1 for header, +1 for 1-indexed
    orderType:    row[colMap.orderType],
    movementCode: row[colMap.movementCode],
    movementSeq:  Number(row[colMap.movementSeq]) || 0,
    source:       (row[colMap.source] as 'MOVEMENT' | 'VAS') || 'MOVEMENT',
    chargeCode:   row[colMap.chargeCode],
    chargeDesc:   row[colMap.chargeDesc] || '',
    size:         row[colMap.size] || undefined,
    type:         row[colMap.type] || undefined,
    truckCat:     row[colMap.truckCat] || undefined,
    cargoCat:     row[colMap.cargoCat] || undefined,
    paymentTerm:  row[colMap.paymentTerm] as PaymentTerm,
    billedTo:     row[colMap.billedTo] as BilledTo,
    amount:       Number(row[colMap.amount]) || 0,
    matched: false, errors: [],
  }));
  return validateImportRows(parsed);
}

function mergeImportRows(
  existing: PricedCharge[],
  rows: ImportRow[],
  filename: string,
): PricedCharge[] {
  const next = [...existing];

  for (const r of rows.filter(r => r.matched && r.orderTypeId)) {
    const key = `${r.orderTypeId}|${r.movementSeq}|${r.chargeCode}|${r.source}`;
    let charge = next.find(c =>
      `${c.orderTypeId}|${c.movementSeq}|${c.code}|${c.source}` === key
    );
    const axes = new Set<Axis>();
    if (r.size) axes.add('SIZE');
    if (r.type) axes.add('TYPE');
    if (r.truckCat) axes.add('TRUCK_CAT');
    if (r.cargoCat) axes.add('CARGO_CAT');

    const newRow: RateRow = {
      id: rid(),
      paymentTerm: r.paymentTerm,
      billedTo: r.billedTo,
      amount: r.amount,
      source: 'imported',
      sourceRef: `csv:${filename}:row=${r.rowNum}`,
    };
    if (r.size) newRow.size = r.size;
    if (r.type) newRow.type = r.type;
    if (r.truckCat) newRow.truckCat = r.truckCat;
    if (r.cargoCat) newRow.cargoCat = r.cargoCat;

    if (!charge) {
      charge = {
        id: rid(),
        code: r.chargeCode,
        desc: r.chargeDesc,
        source: r.source,
        orderTypeId: r.orderTypeId!,
        movementSeq: r.movementSeq,
        axes,
        rows: [newRow],
      };
      next.push(charge);
    } else {
      // Union axes — if the import says vary by Size, ensure axis is on
      const mergedAxes = new Set(charge.axes);
      axes.forEach(a => mergedAxes.add(a));
      const idx = next.indexOf(charge);
      next[idx] = { ...charge, axes: mergedAxes, rows: [...charge.rows, newRow] };
    }
  }
  return next;
}


/* ──────────────────────────────────────────────────────────────────────────
   Resolution engine — "Test a Move"
   Given an input move (order type + movement + axes + pymt + billed-to),
   compute which charges in THIS schedule price the move (and at what rate),
   which fall back to the Public Tariff, and the reason for each decision.

   AI-future room: these structured ResolutionResult records are immutable
   labeled decisions — perfect training data for a future ranking model that
   suggests rates by historical resolution patterns.
   ────────────────────────────────────────────────────────────────────────── */

// resolveCharge lives in @/lib/tariff-types so the engine, the editor, and
// the view-only page all agree on shape and behavior. We only keep the
// catalog-aware resolveMove() here because it depends on the editor-local
// ORDER_TYPE_CATALOG (would move to a shared catalog source in production).

const PUBLIC_TARIFF_ID_LOCAL = 'TP-2026-PUB';

function resolveMove(
  input: ResolutionInput,
  prices: PricedCharge[],
  thisScheduleId: string,
): ResolutionResult[] {
  const ot = ORDER_TYPE_CATALOG.find(o => o.id === input.orderTypeId);
  const mov = ot?.movements.find(m => m.seq === input.movementSeq);
  if (!ot || !mov) return [];

  const allCharges: { code: string; desc: string; source: 'MOVEMENT' | 'VAS' }[] = [
    ...mov.charges.map(c => ({ ...c, source: 'MOVEMENT' as const })),
    ...mov.vas.map(c => ({ ...c, source: 'VAS' as const })),
  ];

  return allCharges.map(catalogCharge => {
    const priced = prices.find(p =>
      p.orderTypeId === input.orderTypeId &&
      p.movementSeq === input.movementSeq &&
      p.code === catalogCharge.code &&
      p.source === catalogCharge.source
    );
    if (!priced) {
      return {
        chargeCode: catalogCharge.code,
        chargeDesc: catalogCharge.desc,
        source: catalogCharge.source,
        matched: false,
        winningTariffId: PUBLIC_TARIFF_ID_LOCAL,
        precedenceTrail: [thisScheduleId, PUBLIC_TARIFF_ID_LOCAL],
        reason: 'FALLBACK_PUBLIC',
      };
    }
    return resolveCharge(priced, input, thisScheduleId);
  });
}

const REASON_TONE: Record<ResolutionReason, string> = {
  EXACT_MATCH:     'success',
  AXIS_FALLBACK:   'warning',
  NO_AXES_FLAT:    'primary',
  FALLBACK_PUBLIC: 'info',
  UNPRICED:        'danger',
};

const REASON_LABEL: Record<ResolutionReason, string> = {
  EXACT_MATCH:     'Exact match',
  AXIS_FALLBACK:   'Partial axis match',
  NO_AXES_FLAT:    'Flat charge',
  FALLBACK_PUBLIC: 'Falls back to Public',
  UNPRICED:        'Unpriced',
};

/* ──────────────────────────────────────────────────────────────────────────
   Test a Move tab
   ────────────────────────────────────────────────────────────────────────── */

function TestAMoveTab({
  orderTypesInScope, prices, thisScheduleId,
}: {
  orderTypesInScope: string[];
  prices: PricedCharge[];
  thisScheduleId: string;
}) {
  const inScope = ORDER_TYPE_CATALOG.filter(o => orderTypesInScope.includes(o.id));
  const [orderTypeId, setOrderTypeId] = useState<string>(inScope[0]?.id ?? '');
  const [movementSeq, setMovementSeq] = useState<number>(inScope[0]?.movements[0]?.seq ?? 1);
  const [size, setSize] = useState<string>('40');
  const [type, setType] = useState<string>('DC');
  const [truckCat, setTruckCat] = useState<string>('TRAILER');
  const [cargoCat, setCargoCat] = useState<string>('GENERAL');
  const [paymentTerm, setPaymentTerm] = useState<PaymentTerm>('CASH');
  const [billedTo, setBilledTo] = useState<BilledTo>('CUSTOMER');
  const [results, setResults] = useState<ResolutionResult[] | null>(null);

  const ot = inScope.find(o => o.id === orderTypeId);
  const movements = ot?.movements ?? [];

  const onResolve = () => {
    if (!orderTypeId) return;
    const res = resolveMove(
      { orderTypeId, movementSeq, size, type, truckCat, cargoCat, paymentTerm, billedTo },
      prices,
      thisScheduleId,
    );
    setResults(res);
  };

  if (inScope.length === 0) {
    return (
      <div className="gecko-empty-state" style={{ padding: 48 }}>
        <Icon name="play" size={36} className="gecko-empty-state-icon" />
        <div className="gecko-empty-state-title">Add an order type to scope first</div>
        <div className="gecko-empty-state-description">
          Resolution preview needs at least one order type in scope. Add one in <strong>Overview → Coverage</strong>.
        </div>
      </div>
    );
  }

  const matchedCount = results?.filter(r => r.matched).length ?? 0;
  const fallbackCount = results?.filter(r => !r.matched).length ?? 0;

  return (
    <div className="gecko-stack gecko-stack-lg">

      <SectionCard
        title="Test a Move"
        subtitle="Simulate how a real move resolves against this schedule. See per-charge rate, axis match quality, and fallbacks to the Public tariff."
      >
        <div className="gecko-grid-4" style={{ gap: 14, marginBottom: 16 }}>
          <div className="gecko-field">
            <div className="gecko-field-label">Order Type</div>
            <select className="gecko-select" value={orderTypeId} onChange={e => {
              setOrderTypeId(e.target.value);
              const newOt = inScope.find(o => o.id === e.target.value);
              setMovementSeq(newOt?.movements[0]?.seq ?? 1);
            }}>
              {inScope.map(o => <option key={o.id} value={o.id}>{o.code}</option>)}
            </select>
          </div>
          <div className="gecko-field">
            <div className="gecko-field-label">Movement</div>
            <select className="gecko-select" value={movementSeq} onChange={e => setMovementSeq(Number(e.target.value))}>
              {movements.map(m => <option key={m.seq} value={m.seq}>#{m.seq} — {m.code}</option>)}
            </select>
          </div>
          <div className="gecko-field">
            <div className="gecko-field-label">Size</div>
            <select className="gecko-select" value={size} onChange={e => setSize(e.target.value)}>
              {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="gecko-field">
            <div className="gecko-field-label">Type</div>
            <select className="gecko-select" value={type} onChange={e => setType(e.target.value)}>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="gecko-field">
            <div className="gecko-field-label">Truck-Cat</div>
            <select className="gecko-select" value={truckCat} onChange={e => setTruckCat(e.target.value)}>
              {TRUCK_CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="gecko-field">
            <div className="gecko-field-label">Cargo-Cat</div>
            <select className="gecko-select" value={cargoCat} onChange={e => setCargoCat(e.target.value)}>
              {CARGO_CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="gecko-field">
            <div className="gecko-field-label">Payment Term</div>
            <select className="gecko-select" value={paymentTerm} onChange={e => setPaymentTerm(e.target.value as PaymentTerm)}>
              <option value="CASH">CASH</option>
              <option value="CREDIT">CREDIT</option>
            </select>
          </div>
          <div className="gecko-field">
            <div className="gecko-field-label">Billed To</div>
            <select className="gecko-select" value={billedTo} onChange={e => setBilledTo(e.target.value as BilledTo)}>
              <option value="CUSTOMER">CUSTOMER</option>
              <option value="HAULIER">HAULIER</option>
              <option value="LINE">LINE</option>
              <option value="AGENT">AGENT</option>
              <option value="FWD">FWD</option>
              <option value="CARRIER">CARRIER</option>
            </select>
          </div>
        </div>

        <button className="gecko-btn gecko-btn-primary" onClick={onResolve}>
          <Icon name="play" size={14} /> Resolve this move
        </button>
      </SectionCard>

      {results && (
        <>
          <div className="gecko-grid-3">
            <div className="gecko-kpi-tile">
              <div className="gecko-kpi-tile-icon gecko-kpi-tile-icon-success"><Icon name="check" size={16} /></div>
              <div className="gecko-kpi-tile-value">{matchedCount}</div>
              <div className="gecko-kpi-tile-label">Priced by this schedule</div>
            </div>
            <div className="gecko-kpi-tile">
              <div className="gecko-kpi-tile-icon gecko-kpi-tile-icon-info"><Icon name="arrowRight" size={16} /></div>
              <div className="gecko-kpi-tile-value">{fallbackCount}</div>
              <div className="gecko-kpi-tile-label">Fall back to Public</div>
            </div>
            <div className="gecko-kpi-tile">
              <div className="gecko-kpi-tile-icon gecko-kpi-tile-icon-primary"><Icon name="dollarSign" size={16} /></div>
              <div className="gecko-kpi-tile-value">
                {fmtTHB(results.filter(r => r.matched).reduce((s, r) => s + (r.rate ?? 0), 0))}
              </div>
              <div className="gecko-kpi-tile-label">Total resolved (this schedule)</div>
            </div>
          </div>

          <SectionCard title="Per-charge resolution" subtitle={`${results.length} catalog charges on this movement`}>
            <div className="gecko-stack gecko-stack-sm">
              {results.map((r, i) => (
                <div key={i} className="gecko-resolution-row">
                  <div className="gecko-resolution-row-charge">
                    <span className="gecko-charge-card-code">{r.chargeCode}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{r.chargeDesc}</div>
                      <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>
                        {r.source === 'VAS' ? 'VAS' : 'Movement charge'}
                      </div>
                    </div>
                  </div>
                  <div className="gecko-resolution-row-trail">
                    {r.precedenceTrail.map((t, idx) => (
                      <React.Fragment key={t}>
                        <span style={{
                          fontFamily: 'var(--gecko-font-mono)',
                          fontSize: 11, fontWeight: 700,
                          color: idx === r.precedenceTrail.length - 1
                            ? (r.matched ? 'var(--gecko-success-700)' : 'var(--gecko-info-700)')
                            : 'var(--gecko-text-disabled)',
                          textDecoration: idx === r.precedenceTrail.length - 1 ? 'none' : 'line-through',
                        }}>{t}</span>
                        {idx < r.precedenceTrail.length - 1 && (
                          <Icon name="arrowRight" size={11} style={{ color: 'var(--gecko-text-disabled)' }} />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="gecko-resolution-row-reason">
                    <span className={`gecko-pill gecko-pill-${REASON_TONE[r.reason]}`}>
                      {REASON_LABEL[r.reason]}
                    </span>
                  </div>
                  <div className="gecko-resolution-row-amount">
                    {r.matched ? (
                      <div className="gecko-stack" style={{ alignItems: 'flex-end', gap: 0 }}>
                        <div className="gecko-row gecko-row-baseline" style={{ gap: 4 }}>
                          <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 15, fontWeight: 800, color: 'var(--gecko-text-primary)' }}>
                            {fmtTHB(r.rate ?? 0)}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)' }}>THB</span>
                        </div>
                        {r.appliedConditions && r.appliedConditions.length > 0 && (
                          <div style={{ fontSize: 9, color: 'var(--gecko-warning-700)', marginTop: 2, fontStyle: 'italic' }}>
                            base ฿{fmtTHB(r.baseRate ?? 0)} + {r.appliedConditions.length} cond.
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--gecko-text-disabled)', fontStyle: 'italic' }}>
                        Standard rate
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {results.some(r => r.appliedConditions && r.appliedConditions.length > 0) && (
            <SectionCard title="Applied conditional surcharges" subtitle="Conditions matched on this move and modified the base rate.">
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--gecko-text-primary)', lineHeight: 1.8 }}>
                {results.flatMap(r => (r.appliedConditions ?? []).map(c => (
                  <li key={c.conditionId + r.chargeCode}>
                    <strong style={{ fontFamily: 'var(--gecko-font-mono)' }}>{r.chargeCode}</strong> · {c.label} → ฿{fmtTHB(c.before)} became <strong>฿{fmtTHB(c.after)}</strong>
                  </li>
                )))}
              </ul>
            </SectionCard>
          )}
        </>
      )}

      {!results && (
        <div className="gecko-empty-state" style={{ padding: 40 }}>
          <Icon name="play" size={32} className="gecko-empty-state-icon" />
          <div className="gecko-empty-state-title">Pick a move, hit Resolve</div>
          <div className="gecko-empty-state-description">
            See every catalog charge for this move, which rate row wins, and what falls back.
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   CSV Import Panel — bulk-paste rate sheets from Excel
   ────────────────────────────────────────────────────────────────────────── */

function ImportRatesPanel({
  open, onClose, prices, setPrices,
}: {
  open: boolean;
  onClose: () => void;
  prices: PricedCharge[];
  setPrices: React.Dispatch<React.SetStateAction<PricedCharge[]>>;
}) {
  const { toast } = useToast();
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<ImportRow[] | null>(null);
  const [filename, setFilename] = useState('');

  if (!open) return null;

  const handleFile = async (file: File) => {
    setFilename(file.name);
    setParsing(true);
    try {
      const rows = await readImportFile(file);
      setPreview(rows);
    } catch (e) {
      toast({ variant: 'danger', title: 'Could not parse file', message: e instanceof Error ? e.message : 'Unknown error' });
      setPreview(null);
    } finally {
      setParsing(false);
    }
  };

  const onConfirm = () => {
    if (!preview) return;
    const valid = preview.filter(r => r.matched);
    if (valid.length === 0) {
      toast({ variant: 'warning', title: 'No valid rows', message: 'Every row had errors — see the preview.' });
      return;
    }
    setPrices(existing => mergeImportRows(existing, preview, filename));
    toast({ variant: 'success', title: 'Rates imported', message: `${valid.length} rate row${valid.length === 1 ? '' : 's'} added from ${filename}` });
    setPreview(null);
    setFilename('');
    onClose();
  };

  const validCount = preview?.filter(r => r.matched).length ?? 0;
  const errorCount = preview ? preview.length - validCount : 0;

  return (
    <div className="gecko-stack" style={{
      background: 'var(--gecko-bg-subtle)',
      border: '1px solid var(--gecko-border)',
      borderRadius: 12,
      padding: 18,
      gap: 14,
    }}>
      <div className="gecko-row" style={{ gap: 10 }}>
        <Icon name="upload" size={16} style={{ color: 'var(--gecko-primary-600)' }} />
        <div className="gecko-section-header-title gecko-flex-1">Import rates from CSV / Excel</div>
        <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={onClose}>
          <Icon name="x" size={14} />
        </button>
      </div>

      <div className="gecko-row" style={{ gap: 14, padding: 14, background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 10 }}>
        <div className="gecko-flex-1">
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>
            Step 1 — Download the template
          </div>
          <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>
            CSV with 13 columns and 6 sample rows. Edit in Excel, save as CSV, then upload below.
          </div>
        </div>
        <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={downloadTemplate}>
          <Icon name="download" size={14} /> Download template
        </button>
      </div>

      <label htmlFor="rate-csv-upload" className="gecko-drop-zone">
        <Icon name="upload" size={24} style={{ color: 'var(--gecko-primary-500)' }} />
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>
          {filename || 'Step 2 — Drop or click to upload your CSV'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>
          {parsing ? 'Parsing…' : '.csv or Excel "Save As CSV" — max ~10,000 rows'}
        </div>
        <input
          id="rate-csv-upload"
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />
      </label>

      {preview && (
        <>
          <div className="gecko-row" style={{ gap: 10 }}>
            <span className="gecko-pill gecko-pill-success">{validCount} valid</span>
            {errorCount > 0 && <span className="gecko-pill gecko-pill-danger">{errorCount} with errors</span>}
            <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>
              Source: <code style={{ fontFamily: 'var(--gecko-font-mono)' }}>{filename}</code>
            </span>
          </div>

          <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--gecko-border)', borderRadius: 8 }}>
            <table className="gecko-table" style={{ fontSize: 11 }}>
              <thead>
                <tr>
                  <th>#</th><th>Order Type</th><th>Movement</th><th>Charge</th>
                  <th>Axes</th><th>Pymt</th><th>Billed</th><th style={{ textAlign: 'right' }}>Amount</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.map(r => (
                  <tr key={r.rowNum} style={{ background: r.matched ? 'transparent' : 'var(--gecko-error-50)' }}>
                    <td style={{ fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-disabled)' }}>{r.rowNum}</td>
                    <td style={{ fontFamily: 'var(--gecko-font-mono)' }}>{r.orderType}</td>
                    <td style={{ fontFamily: 'var(--gecko-font-mono)' }}>{r.movementCode} #{r.movementSeq}</td>
                    <td>
                      <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}>{r.chargeCode}</span>
                      {' '}<span style={{ color: 'var(--gecko-text-secondary)' }}>{r.chargeDesc}</span>
                    </td>
                    <td style={{ fontSize: 10, color: 'var(--gecko-text-secondary)' }}>
                      {[r.size, r.type, r.truckCat, r.cargoCat].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td>{r.paymentTerm}</td>
                    <td>{r.billedTo}</td>
                    <td className="gecko-money gecko-money-md">
                      {fmtTHB(r.amount)}
                    </td>
                    <td>
                      {r.matched
                        ? <span className="gecko-pill gecko-pill-success">OK</span>
                        : <span className="gecko-pill gecko-pill-danger" title={r.errors.join('; ')}>Error</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {errorCount > 0 && (
            <div style={{ padding: 10, background: 'var(--gecko-error-50)', border: '1px solid var(--gecko-error-200)', borderRadius: 8, fontSize: 11, color: 'var(--gecko-error-700)' }}>
              <strong>{errorCount}</strong> row{errorCount === 1 ? '' : 's'} will be skipped due to errors. Hover the red <em>Error</em> badge to see why.
            </div>
          )}

          <div className="gecko-action-toolbar">
            <button className="gecko-btn gecko-btn-outline" onClick={() => { setPreview(null); setFilename(''); }}>
              Cancel
            </button>
            <button className="gecko-btn gecko-btn-primary" onClick={onConfirm} disabled={validCount === 0}>
              <Icon name="check" size={14} /> Import {validCount} valid row{validCount === 1 ? '' : 's'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}


/* ──────────────────────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────────────────────── */

type Tab = 'overview' | 'movement' | 'non-movement' | 'free-time' | 'test-move' | 'activity';

export default function NewTariffSchedulePage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('overview');
  const [dirty, setDirty] = useState(false);

  // Schedule state
  const [scheduleId] = useState(() => `TP-${new Date().getFullYear()}-C${String(Math.floor(Math.random() * 90 + 10))}`);
  const [type, setType] = useState<ScheduleType>('CONTRACT');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<ScheduleStatus>('Draft');

  const [liner, setLiner] = useState<EntityOption | null>(null);
  const [forwarder, setForwarder] = useState<EntityOption | null>(null);
  const [shipper, setShipper] = useState<EntityOption | null>(null);

  const [effective, setEffective] = useState('');
  const [expiry, setExpiry] = useState('');
  const [salesPerson, setSalesPerson] = useState('');
  const [approver, setApprover] = useState('');
  const [workflowId, setWorkflowId] = useState<string>(() => WORKFLOWS.find(w => w.isDefault)?.id ?? WORKFLOWS[0].id);
  const [orderTypesInScope, setOrderTypesInScope] = useState<string[]>([]);

  const [prices, setPrices] = useState<PricedCharge[]>([]);
  const [ladenStorage, setLadenStorage] = useState<StorageConfig>({
    freeDays: 3, mode: 'PER_DAY_SLAB',
    perDaySlabs: [
      { id: rid(), fromDay: 1,  toDay: 5,  ratePerDay:  80 },
      { id: rid(), fromDay: 6,  toDay: 10, ratePerDay: 160 },
      { id: rid(), fromDay: 11, toDay: 30, ratePerDay: 240 },
    ],
    fleetTeuBands: [],
  });
  const [emptyStorage, setEmptyStorage] = useState<StorageConfig>({
    freeDays: 14, mode: 'PER_DAY_SLAB',
    perDaySlabs: [
      { id: rid(), fromDay: 1,  toDay: 5,  ratePerDay: 30 },
      { id: rid(), fromDay: 6,  toDay: 10, ratePerDay: 60 },
      { id: rid(), fromDay: 11, toDay: 60, ratePerDay: 90 },
    ],
    fleetTeuBands: [
      { id: rid(), from: 1, to: 499, ratePerDay: 0 },
      { id: rid(), from: 500, to: 800, ratePerDay: 5 },
      { id: rid(), from: 801, to: 999, ratePerDay: 3 },
    ],
  });
  const [ptiRates, setPtiRates] = useState<Record<string, number>>({ '20RF': 850, '40RF': 1200, '40HC-RF': 1300 });
  const [precoolRates, setPrecoolRates] = useState<Record<string, number>>({ '20RF': 600, '40RF': 800, '40HC-RF': 850 });

  const [freeTime, setFreeTime] = useState<FreeTimeMatrix>({
    fullExport: { normal: 5, reefer: 3, dg: 1 },
    fullImport: { normal: 3, reefer: 2, dg: 1 },
    emptyExport: { normal: 14, reefer: 7 },
    emptyImport: { normal: 14, reefer: 7 },
    waiveMtyDm: true,
  });

  // Mark dirty on any mutation
  const wrap = <T,>(setter: React.Dispatch<React.SetStateAction<T>>) =>
    ((v: React.SetStateAction<T>) => { setDirty(true); setter(v); }) as React.Dispatch<React.SetStateAction<T>>;

  // Party summary line
  const partySummary = useMemo(() => {
    if (type === 'PUBLIC') return 'All Standard Customers';
    const parts: string[] = [];
    if (liner) parts.push(liner.code);
    if (forwarder) parts.push(forwarder.code);
    if (shipper) parts.push(shipper.code);
    return parts.length ? parts.join(' × ') : '';
  }, [type, liner, forwarder, shipper]);

  const hasMandatoryParty = type === 'PUBLIC' || !!(liner || forwarder || shipper);

  const onSave = () => {
    if (!name.trim()) { toast({ variant: 'warning', title: 'Name required', message: 'Give your schedule a name before saving.' }); return; }
    if (!hasMandatoryParty) { toast({ variant: 'warning', title: 'Parties required', message: 'Pick at least one party (Liner, Forwarder, or Shipper).' }); return; }
    setDirty(false);
    toast({ variant: 'success', title: 'Draft saved', message: `${scheduleId} — ${name}` });
  };

  const onActivate = () => {
    if (!name.trim() || !hasMandatoryParty || !effective || !expiry) {
      toast({ variant: 'warning', title: 'Cannot activate', message: 'Fill name, validity, and at least one party first.' });
      return;
    }
    if (!approver.trim()) {
      toast({ variant: 'warning', title: 'Approver required', message: 'A supervisor must sign off before activation.' });
      return;
    }
    const wf = WORKFLOWS.find(w => w.id === workflowId);
    setStatus('Pending');
    setDirty(false);
    toast({
      variant: 'success',
      title: 'Sent for approval',
      message: `${scheduleId} → ${wf?.name ?? 'workflow'} (${wf?.steps.length ?? 0} step${wf?.steps.length === 1 ? '' : 's'}).`,
    });
  };

  const totalPricedCharges = prices.length;
  const totalRateRows = prices.reduce((s, p) => s + p.rows.length, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 60px)', background: 'var(--gecko-bg-canvas)' }}>

      <StickyHeader
        scheduleId={scheduleId}
        name={name}
        status={status}
        type={type}
        partySummary={partySummary}
        onActivate={onActivate}
        onSave={onSave}
        dirty={dirty}
      />

      {/* Tabs */}
      <div style={{ background: 'var(--gecko-bg-surface)', borderBottom: '1px solid var(--gecko-border)', padding: '0 24px' }}>
        <div className="gecko-tabs">
          {([
            { id: 'overview', label: 'Overview', icon: 'info' },
            { id: 'movement', label: 'Movement Charges', icon: 'truck' },
            { id: 'non-movement', label: 'Non-Movement Charges', icon: 'clock' },
            { id: 'free-time', label: 'Free Time', icon: 'calendar' },
            { id: 'test-move', label: 'Test a Move', icon: 'play' },
            { id: 'activity', label: 'Activity', icon: 'activity' },
          ] as { id: Tab; label: string; icon: string }[]).map(t => (
            <button
              key={t.id}
              className={`gecko-tab ${tab === t.id ? 'gecko-tab-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <Icon name={t.icon} size={13} /> {t.label}
              {t.id === 'movement' && totalPricedCharges > 0 && (
                <span className="gecko-pill gecko-pill-primary" style={{ fontSize: 10, marginLeft: 6 }}>{totalPricedCharges}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="gecko-stack gecko-stack-lg" style={{ flex: 1, padding: 24, maxWidth: 'var(--gecko-container-max)', width: '100%', margin: '0 auto' }}>

        {tab === 'overview' && (
          <>
            <SectionCard title="Scope" subtitle="Who this schedule applies to and when it's valid.">
              <div className="gecko-stack" style={{ gap: 18 }}>

                <div className="gecko-field">
                  <div className="gecko-field-label">Schedule type</div>
                  <TypeSelector value={type} onChange={(v) => { setDirty(true); setType(v); if (v === 'PUBLIC') { setLiner(null); setForwarder(null); setShipper(null); } }} />
                </div>

                <div className="gecko-field">
                  <div className="gecko-field-label gecko-field-required">Schedule name</div>
                  <input
                    className="gecko-input"
                    placeholder={type === 'PUBLIC' ? 'e.g. Public Tariff 2026' : type === 'CONTRACT' ? 'e.g. Maersk × UMC × KCE Contract 2026' : 'e.g. CP Foods Short-Term Q2 2026'}
                    value={name}
                    onChange={e => { setDirty(true); setName(e.target.value); }}
                  />
                </div>

                {type !== 'PUBLIC' && (
                  <div>
                    <div className="gecko-eyebrow gecko-mb-3">
                      Assigned parties {!hasMandatoryParty && <span style={{ color: 'var(--gecko-error-600)', textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>— at least one required</span>}
                    </div>
                    <div className="gecko-grid-3" style={{ gap: 14 }}>
                      <div className="gecko-field">
                        <div className="gecko-field-label">Liner</div>
                        <EntitySearch
                          entityType="agent"
                          value={liner}
                          onChange={v => { setDirty(true); setLiner(v); }}
                          placeholder="Search liner by code or name…"
                        />
                      </div>
                      <div className="gecko-field">
                        <div className="gecko-field-label">Forwarder</div>
                        <EntitySearch
                          entityType="forwarder"
                          value={forwarder}
                          onChange={v => { setDirty(true); setForwarder(v); }}
                          placeholder="Search forwarder by code or name…"
                        />
                      </div>
                      <div className="gecko-field">
                        <div className="gecko-field-label">Shipper / Consignee</div>
                        <EntitySearch
                          entityType="shipper"
                          value={shipper}
                          onChange={v => { setDirty(true); setShipper(v); }}
                          placeholder="Search shipper by code or name…"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="gecko-grid-4" style={{ gap: 14 }}>
                  <div className="gecko-field">
                    <div className="gecko-field-label gecko-field-required">Effective date</div>
                    <DateField value={effective} onChange={v => { setDirty(true); setEffective(v); }} placeholder="Pick effective date" />
                  </div>
                  <div className="gecko-field">
                    <div className="gecko-field-label gecko-field-required">Expiry date</div>
                    <DateField value={expiry} onChange={v => { setDirty(true); setExpiry(v); }} placeholder="Pick expiry date" />
                  </div>
                  <div className="gecko-field">
                    <div className="gecko-field-label">Sales person</div>
                    <input className="gecko-input" placeholder="e.g. YOKPORN" value={salesPerson} onChange={e => { setDirty(true); setSalesPerson(e.target.value); }} />
                  </div>
                  <div className="gecko-field">
                    <div className="gecko-field-label gecko-field-required">Approver (Supervisor)</div>
                    <input className="gecko-input" placeholder="e.g. CHAKRIYA" value={approver} onChange={e => { setDirty(true); setApprover(e.target.value); }} />
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Coverage"
              subtitle="Which order types this schedule prices. Charges outside selected order types fall back to the Public tariff."
            >
              <div className="gecko-row gecko-row-wrap">
                {ORDER_TYPE_CATALOG.map(ot => {
                  const isOn = orderTypesInScope.includes(ot.id);
                  return (
                    <button
                      key={ot.id}
                      className={`gecko-axis-chip ${isOn ? 'gecko-axis-chip-active' : ''}`}
                      onClick={() => {
                        setDirty(true);
                        setOrderTypesInScope(s => isOn ? s.filter(x => x !== ot.id) : [...s, ot.id]);
                      }}
                      style={{ padding: '8px 14px', fontSize: 12 }}
                    >
                      {isOn ? <Icon name="check" size={12} /> : <Icon name="plus" size={12} />}
                      <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}>{ot.code}</span>
                      <span style={{ color: 'var(--gecko-text-secondary)', fontWeight: 500 }}>— {ot.description}</span>
                    </button>
                  );
                })}
              </div>
              {orderTypesInScope.length === 0 && (
                <div style={{ marginTop: 14, fontSize: 11, color: 'var(--gecko-text-secondary)', fontStyle: 'italic' }}>
                  Add at least one order type to start pricing movement charges.
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Approval Workflow"
              subtitle="Pick the approval chain this schedule must pass before it can activate. Manage workflows in Configuration → Approval Workflows."
              right={
                <Link href="/config/approval-workflows" className="gecko-btn gecko-btn-ghost gecko-btn-sm">
                  <Icon name="settings" size={13} /> Manage workflows
                </Link>
              }
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                {WORKFLOWS.filter(w => w.appliesTo.includes('TARIFF_SCHEDULE')).map(w => {
                  const selected = workflowId === w.id;
                  return (
                    <button
                      key={w.id}
                      onClick={() => { setDirty(true); setWorkflowId(w.id); }}
                      className="gecko-workflow-card"
                      data-selected={selected ? 'true' : undefined}
                    >
                      <div className="gecko-row gecko-row-between">
                        <div className="gecko-row">
                          <Icon name="gitBranch" size={14} style={{ color: selected ? 'var(--gecko-primary-600)' : 'var(--gecko-text-secondary)' }} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: selected ? 'var(--gecko-primary-700)' : 'var(--gecko-text-primary)' }}>
                            {w.name}
                          </span>
                        </div>
                        {w.isDefault && <span className="gecko-pill gecko-pill-neutral" style={{ fontSize: 9 }}>DEFAULT</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', textAlign: 'left', lineHeight: 1.4 }}>
                        {w.description}
                      </div>
                      <div className="gecko-row gecko-row-wrap" style={{ gap: 4 }}>
                        {w.steps.map((s, i) => (
                          <React.Fragment key={s.id}>
                            <span style={{
                              fontSize: 10, fontWeight: 600,
                              padding: '2px 6px', borderRadius: 4,
                              background: s.approverKind === 'auto' ? 'var(--gecko-info-50)' : 'var(--gecko-bg-subtle)',
                              color: s.approverKind === 'auto' ? 'var(--gecko-info-700)' : 'var(--gecko-text-secondary)',
                              border: '1px solid var(--gecko-border)',
                            }}>
                              {s.approverKind === 'auto' ? '⚡ ' : ''}{s.name}
                            </span>
                            {i < w.steps.length - 1 && <Icon name="arrowRight" size={10} style={{ color: 'var(--gecko-text-disabled)' }} />}
                          </React.Fragment>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
              {(() => {
                const wf = WORKFLOWS.find(w => w.id === workflowId);
                const autoSteps = wf?.steps.filter(s => s.threshold && describeThreshold(s.threshold));
                if (!autoSteps?.length) return null;
                return (
                  <div className="gecko-row gecko-row-start" style={{ marginTop: 12, padding: 10, background: 'var(--gecko-info-50)', border: '1px solid var(--gecko-info-200)', borderRadius: 8, fontSize: 11, color: 'var(--gecko-info-700)' }}>
                    <Icon name="info" size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <strong>Auto-approval rules in this workflow:</strong>
                      <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                        {autoSteps.map(s => <li key={s.id}>{s.name}: {describeThreshold(s.threshold)}</li>)}
                      </ul>
                    </div>
                  </div>
                );
              })()}
            </SectionCard>

            <div className="gecko-grid-4">
              <div className="gecko-kpi-tile">
                <div className="gecko-kpi-tile-icon gecko-kpi-tile-icon-primary"><Icon name="dollarSign" size={16} /></div>
                <div className="gecko-kpi-tile-value">{totalPricedCharges}</div>
                <div className="gecko-kpi-tile-label">Priced charges</div>
              </div>
              <div className="gecko-kpi-tile">
                <div className="gecko-kpi-tile-icon gecko-kpi-tile-icon-info"><Icon name="layers" size={16} /></div>
                <div className="gecko-kpi-tile-value">{totalRateRows}</div>
                <div className="gecko-kpi-tile-label">Rate rows total</div>
              </div>
              <div className="gecko-kpi-tile">
                <div className="gecko-kpi-tile-icon gecko-kpi-tile-icon-success"><Icon name="package" size={16} /></div>
                <div className="gecko-kpi-tile-value">{orderTypesInScope.length}</div>
                <div className="gecko-kpi-tile-label">Order types in scope</div>
              </div>
              <div className="gecko-kpi-tile">
                <div className="gecko-kpi-tile-icon gecko-kpi-tile-icon-warning"><Icon name="clock" size={16} /></div>
                <div className="gecko-kpi-tile-value">{effective && expiry ? `${effective}` : '—'}</div>
                <div className="gecko-kpi-tile-label">Effective from</div>
              </div>
            </div>
          </>
        )}

        {tab === 'movement' && (
          <MovementChargesTab
            orderTypesInScope={orderTypesInScope}
            prices={prices}
            setPrices={wrap(setPrices)}
          />
        )}

        {tab === 'non-movement' && (
          <>
            <StorageCard
              title="Laden Storage"
              accent="var(--gecko-success-500)"
              config={ladenStorage}
              onChange={c => { setDirty(true); setLadenStorage(c); }}
              supportTEU={false}
            />
            <StorageCard
              title="Empty Storage"
              accent="var(--gecko-info-500)"
              config={emptyStorage}
              onChange={c => { setDirty(true); setEmptyStorage(c); }}
              supportTEU={true}
            />
            <ReeferEventCard
              title="PTI — Pre-Trip Inspection"
              icon="check"
              accent="var(--gecko-primary-500)"
              rates={ptiRates}
              onChange={r => { setDirty(true); setPtiRates(r); }}
            />
            <ReeferEventCard
              title="Precool"
              icon="activity"
              accent="var(--gecko-accent-500)"
              rates={precoolRates}
              onChange={r => { setDirty(true); setPrecoolRates(r); }}
            />
          </>
        )}

        {tab === 'free-time' && (
          <FreeTimeTab matrix={freeTime} onChange={m => { setDirty(true); setFreeTime(m); }} />
        )}

        {tab === 'test-move' && (
          <TestAMoveTab
            orderTypesInScope={orderTypesInScope}
            prices={prices}
            thisScheduleId={scheduleId}
          />
        )}

        {tab === 'activity' && (
          <SectionCard title="Activity & Approval Trail" subtitle="A timeline of who created, edited, and approved this schedule.">
            <div className="gecko-stack" style={{ gap: 0 }}>
              {[
                { who: 'You', what: 'Started new tariff schedule', when: 'just now', icon: 'plus', tone: 'var(--gecko-primary-500)' },
              ].map((e, i) => (
                <div key={i} className="gecko-row gecko-row-start" style={{ gap: 12, padding: '10px 0', borderBottom: i < 0 ? '1px solid var(--gecko-border)' : 'none' }}>
                  <div className="gecko-mini-icon" style={{ width: 28, height: 28, background: e.tone, color: '#fff' }}>
                    <Icon name={e.icon} size={13} />
                  </div>
                  <div className="gecko-flex-1">
                    <div style={{ fontSize: 13, color: 'var(--gecko-text-primary)' }}><strong>{e.who}</strong> {e.what}</div>
                    <div className="gecko-cell-meta">{e.when}</div>
                  </div>
                </div>
              ))}
              <div className="gecko-empty-card gecko-mt-4" style={{ border: '1px dashed var(--gecko-border)', fontStyle: 'italic' }}>
                More activity will appear here as the schedule is edited and approved.
              </div>
            </div>
          </SectionCard>
        )}

      </div>
    </div>
  );
}
