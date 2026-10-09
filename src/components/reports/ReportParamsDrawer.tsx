"use client";
import React, { useState } from 'react';
import { Icon } from '../ui/Icon';
import { DateField } from '../ui/DateField';
import { useApiList } from '@/lib/api/use-api';
import { useFacility } from '@/lib/api/facility';
import { useMovements } from '@/lib/api/lookups';
import { yardsPath, type Yard } from '@/lib/api/yards';
import { PARAM_LABELS, type ReportDef, type ReportParamKey } from '@/lib/reports-catalog';

/**
 * The parameters one report is run with.
 *
 * EVERY DROPDOWN HERE IS MASTER DATA (2026-10-08). It used to search a
 * hardcoded CATALOGUE of invented companies and offer yard blocks like
 * "IMP-A1" and movements like "EMTY IN" that exist nowhere in Gecko — so a
 * clerk could fill the drawer in completely and describe a depot that does not
 * exist. The lists are the real ones now, and what they hand back are the codes
 * the API filters on.
 *
 * The values leave as plain strings: a report is a query, and a query takes a
 * code, not an object.
 */
export interface ParamValues {
  branch?: string;
  bookingType?: string;
  orderType?: string;
  agent?: string;
  owner?: string;
  forwarder?: string;
  customer?: string;
  haulier?: string;
  vessel?: string;
  voyage?: string;
  yardLocation?: string;
  loadingPort?: string;
  /** Sent as `size` or `containerSize`, depending on the report. */
  typeSize?: string;
  /** The equipment TYPE half of the Type — Size pair. */
  type?: string;
  tripType?: string;
  containerClass?: string;
  emptyLoaded?: string;
  blNo?: string;
  bookingDate?: string;
  truckCategory?: string;
  movementCode?: string;
  userId?: string;
  dateFrom: string;
  dateTo: string;
}

const BLANK: ParamValues = { dateFrom: '', dateTo: '' };

/** The API's own vocabularies, not invented ones. */
const BOOKING_TYPES: Opt[] = [
  { value: '', label: 'Any' },
  { value: 'IMPORT', label: 'Import' },
  { value: 'EXPORT', label: 'Export' },
  { value: 'INTERNAL', label: 'Internal' },
  { value: 'REPO', label: 'Repo' },
];
const SIZES: Opt[] = [
  { value: '', label: 'Any' }, { value: '20', label: '20' }, { value: '40', label: '40' }, { value: '45', label: '45' },
];
const EMPTY_LOADED: Opt[] = [
  { value: '', label: 'Any' }, { value: 'EMPTY', label: 'Empty' }, { value: 'FULL', label: 'Loaded' },
];
const GRADES: Opt[] = [
  { value: '', label: 'Any' }, { value: 'A', label: 'A' }, { value: 'B', label: 'B' },
  { value: 'C', label: 'C' }, { value: 'D', label: 'D' },
];
const TRIP_TYPES: Opt[] = [{ value: '', label: 'Any' }, { value: 'ROUND', label: 'Round' }, { value: 'ONE-WAY', label: 'One-way' }];
const TRUCK_CATS: Opt[] = [{ value: '', label: 'Any' }];

interface Opt { value: string; label: string }
interface PartyRow { partyCode: string; nameEn: string }
interface OrderTypeRow { orderTypeCode: string; descriptionEn: string; isActive?: boolean }
interface EquipmentTypeRow { typeCode: string; descriptionEn: string; isActive: boolean }
interface VesselRow { vesselCode: string; nameEn: string }

/** The local day as yyyy-MM-dd. toISOString would shift it a day in Bangkok. */
function dayOf(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ReportParamsDrawer({ report, onClose, onGenerate, busy, problem }: {
  report: ReportDef | null;
  onClose: () => void;
  /** The format is the caller's to act on: these endpoints render both. */
  onGenerate: (report: ReportDef, params: ParamValues, format: 'pdf' | 'xlsx') => void;
  /** True while the API is rendering — a big depot's PDF takes seconds. */
  busy?: boolean;
  /** What the server refused, and the field it named. */
  problem?: { message: string; field?: string } | null;
}) {
  const [vals, setVals] = useState<ParamValues>(BLANK);
  const [forReport, setForReport] = useState<string | null>(null);
  const { branch } = useFacility();
  const branchId = branch?.branchId ?? '';

  const { data: lines } = useApiList<PartyRow>('/api/master/parties?role=SHIPPING_LINE&pageSize=200');
  const { data: customers } = useApiList<PartyRow>('/api/master/parties?role=CUSTOMER&pageSize=200');
  const { data: forwarders } = useApiList<PartyRow>('/api/master/parties?role=FORWARDER&pageSize=200');
  const { data: hauliers } = useApiList<PartyRow>('/api/master/parties?role=HAULIER&pageSize=200');
  const { data: orderTypes } = useApiList<OrderTypeRow>('/api/master/order-types?pageSize=200');
  const { data: equipTypes } = useApiList<EquipmentTypeRow>('/api/master/equipment-types?pageSize=200');
  const { data: vessels } = useApiList<VesselRow>('/api/master/vessels?pageSize=200');
  const { data: yards } = useApiList<Yard>(branchId ? yardsPath(branchId) : null);
  const { movements } = useMovements();

  const parties = (rows: PartyRow[] | null): Opt[] => [
    { value: '', label: 'Any' },
    ...(rows ?? []).map(p => ({ value: p.partyCode, label: `${p.partyCode} — ${p.nameEn}` })),
  ];

  /**
   * Fresh parameters each time a different report is opened.
   *
   * Done during render rather than in an effect — React's own way of resetting
   * state when a prop changes, and the one the compiler allows.
   */
  if (report && forReport !== report.id) {
    setForReport(report.id);
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 30);
    setVals({ ...BLANK, dateFrom: dayOf(from), dateTo: dayOf(today) });
  }

  if (!report) return null;
  const set = <K extends keyof ParamValues>(k: K, v: ParamValues[K]) => setVals(p => ({ ...p, [k]: v }));
  const need = (k: ReportParamKey) => report.params.includes(k);
  const real = Boolean(report.document);

  return (
    <>
      <div onClick={busy ? undefined : onClose} className="gecko-report-drawer-scrim" />
      <div className="gecko-report-drawer">
        {/* Header */}
        <div className="gecko-row gecko-row-start gecko-report-drawer-head">
          <Icon name={report.icon} size={18} style={{ color: 'var(--gecko-primary-600)', marginTop: 2 }} />
          <div className="gecko-flex-1">
            <div className="gecko-report-drawer-title">{report.title}</div>
            <div className="gecko-eyebrow gecko-mt-1">{report.group}</div>
          </div>
          <button onClick={onClose} disabled={busy} className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon">
            <Icon name="x" size={14} />
          </button>
        </div>

        {problem && (
          <div role="alert" className="gecko-alert gecko-alert-error gecko-report-drawer-problem">
            <Icon name="alertCircle" size={16} />
            <span>{problem.message}</span>
          </div>
        )}

        {/* Body */}
        <div className="gecko-grid-2 gecko-report-drawer-body">
          {need('bookingType') && (
            <SelectField label={PARAM_LABELS.bookingType} value={vals.bookingType ?? ''}
              onChange={v => set('bookingType', v)} opts={BOOKING_TYPES} />
          )}
          {need('orderType') && (
            <SelectField label={PARAM_LABELS.orderType} value={vals.orderType ?? ''}
              onChange={v => set('orderType', v)}
              opts={[{ value: '', label: 'Any' }, ...(orderTypes ?? [])
                .filter(t => t.isActive !== false)
                .map(t => ({ value: t.orderTypeCode, label: `${t.orderTypeCode} — ${t.descriptionEn}` }))]} />
          )}
          {need('agent') && (
            <SelectField label={PARAM_LABELS.agent} value={vals.agent ?? ''}
              onChange={v => set('agent', v)} opts={parties(lines)} />
          )}
          {need('owner') && (
            <SelectField label={PARAM_LABELS.owner} value={vals.owner ?? ''}
              onChange={v => set('owner', v)} opts={parties(lines)} />
          )}
          {need('forwarder') && (
            <SelectField label={PARAM_LABELS.forwarder} value={vals.forwarder ?? ''}
              onChange={v => set('forwarder', v)} opts={parties(forwarders)} />
          )}
          {need('customer') && (
            <SelectField label={PARAM_LABELS.customer} value={vals.customer ?? ''}
              onChange={v => set('customer', v)} opts={parties(customers)} />
          )}
          {need('haulier') && (
            <SelectField label={PARAM_LABELS.haulier} value={vals.haulier ?? ''}
              onChange={v => set('haulier', v)} opts={parties(hauliers)} />
          )}
          {need('vessel') && (
            <SelectField label={PARAM_LABELS.vessel} value={vals.vessel ?? ''}
              onChange={v => set('vessel', v)}
              opts={[{ value: '', label: 'Any' }, ...(vessels ?? [])
                .map(v => ({ value: v.vesselCode, label: `${v.vesselCode} — ${v.nameEn}` }))]} />
          )}
          {need('voyage') && (
            <InputField label={PARAM_LABELS.voyage} placeholder="e.g. 017S"
              value={vals.voyage ?? ''} onChange={v => set('voyage', v)} mono />
          )}
          {need('yardLocation') && (
            <SelectField label={PARAM_LABELS.yardLocation} value={vals.yardLocation ?? ''}
              onChange={v => set('yardLocation', v)}
              opts={[{ value: '', label: 'Any' }, ...(yards ?? [])
                .map(y => ({ value: y.yardId, label: `${y.yardCode} — ${y.nameEn}` }))]} />
          )}
          {need('loadingPort') && (
            <InputField label={PARAM_LABELS.loadingPort} placeholder="e.g. THLCH / SGSIN"
              value={vals.loadingPort ?? ''} onChange={v => set('loadingPort', v)} mono />
          )}

          {/* Size and type: two selects in one slot, as the desktop has them. */}
          {need('typeSize') && (
            <div className="gecko-field gecko-field-span-2">
              <div className="gecko-field-label">{PARAM_LABELS.typeSize}</div>
              <div className="gecko-report-pair">
                <select className="gecko-select" aria-label="Size"
                  value={vals.typeSize ?? ''} onChange={e => set('typeSize', e.target.value)}>
                  {SIZES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <select className="gecko-select" aria-label="Type"
                  value={vals.type ?? ''} onChange={e => set('type', e.target.value)}>
                  <option value="">Any</option>
                  {(equipTypes ?? []).filter(t => t.isActive)
                    .map(t => <option key={t.typeCode} value={t.typeCode}>{t.typeCode} — {t.descriptionEn}</option>)}
                </select>
              </div>
            </div>
          )}

          {need('tripType') && (
            <SelectField label={PARAM_LABELS.tripType} value={vals.tripType ?? ''}
              onChange={v => set('tripType', v)} opts={TRIP_TYPES} />
          )}
          {need('containerClass') && (
            <SelectField label={real ? 'Grade' : PARAM_LABELS.containerClass} value={vals.containerClass ?? ''}
              onChange={v => set('containerClass', v)} opts={GRADES} />
          )}
          {need('emptyLoaded') && (
            <SelectField label={PARAM_LABELS.emptyLoaded} value={vals.emptyLoaded ?? ''}
              onChange={v => set('emptyLoaded', v)} opts={EMPTY_LOADED} />
          )}
          {need('blNo') && (
            <InputField label={PARAM_LABELS.blNo} placeholder="Booking or B/L number"
              value={vals.blNo ?? ''} onChange={v => set('blNo', v)} mono />
          )}
          {need('truckCategory') && (
            <SelectField label={PARAM_LABELS.truckCategory} value={vals.truckCategory ?? ''}
              onChange={v => set('truckCategory', v)} opts={TRUCK_CATS} />
          )}
          {need('movementCode') && (
            <SelectField label={PARAM_LABELS.movementCode} value={vals.movementCode ?? ''}
              onChange={v => set('movementCode', v)}
              opts={[{ value: '', label: 'Any' }, ...movements
                .map(m => ({ value: m.movementCode, label: `${m.movementCode} — ${m.descriptionEn}` }))]} />
          )}

          {/* Every report takes a range; only some insist on one. */}
          <div className="gecko-field gecko-field-span-2">
            <div className="gecko-field-label">
              Date Range
              {report.document?.required?.length ? <span className="gecko-report-required"> *</span> : null}
            </div>
            <div className="gecko-report-pair">
              <DateField value={vals.dateFrom} onChange={v => set('dateFrom', v)} />
              <DateField value={vals.dateTo} onChange={v => set('dateTo', v)} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="gecko-row gecko-report-drawer-foot">
          <button
            className="gecko-btn gecko-btn-ghost gecko-btn-sm"
            disabled={busy}
            onClick={() => setVals({ ...BLANK, dateFrom: vals.dateFrom, dateTo: vals.dateTo })}
          >
            Clear filters
          </button>
          <div className="gecko-flex-1" />
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          {real && (
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" disabled={busy}
              onClick={() => onGenerate(report, vals, 'xlsx')}>
              <Icon name="download" size={13} /> Excel
            </button>
          )}
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={busy}
            onClick={() => onGenerate(report, vals, 'pdf')}>
            {busy ? <span className="gecko-spinner gecko-spinner-sm gecko-spinner-white" /> : <Icon name="fileText" size={13} />}
            {busy ? 'Generating…' : real ? 'Generate PDF' : 'Generate Report'}
          </button>
        </div>
      </div>
    </>
  );
}

function SelectField({ label, value, onChange, opts }: {
  label: string; value: string; onChange: (v: string) => void; opts: Opt[];
}) {
  return (
    <div className="gecko-field">
      <div className="gecko-field-label">{label}</div>
      <select className="gecko-select" value={value} onChange={e => onChange(e.target.value)}>
        {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, mono }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean;
}) {
  return (
    <div className="gecko-field">
      <div className="gecko-field-label">{label}</div>
      <input className={`gecko-input gecko-input-sm${mono ? ' gecko-text-mono' : ''}`}
        value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value.toUpperCase())} />
    </div>
  );
}
