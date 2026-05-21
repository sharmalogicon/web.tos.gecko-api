"use client";
import React, { useState, useEffect } from 'react';
import { Icon } from '../ui/Icon';
import { DateField } from '../ui/DateField';
import { EntitySearch, type EntityOption } from '../ui/EntitySearch';
import { PARAM_LABELS, type ReportDef, type ReportParamKey } from '@/lib/reports-catalog';

/**
 * Side drawer that renders only the parameter fields declared by the selected
 * report. The user fills them in and clicks Generate — for Phase 1 we just
 * confirm with a toast (the parent handler decides what to do with the values).
 */

const BRANCHES        = ['All Branches', 'Laem Chabang ICD', 'Bangkok Inland', 'Songkhla Depot'];
const BOOKING_TYPES   = ['All', 'IMPORT', 'EXPORT', 'TRANSSHIPMENT'];
const ORDER_TYPES_OPT = ['All', 'EXP CY/CY', 'IMP CY/CY', 'EXP CFS', 'TRANS-SHIP', 'BLIND GATE IN', 'REPO OUT', 'IMP LOLO CR'];
const SIZES           = ['Any', '20', '40', '45'];
const TYPES           = ['Any', 'GP', 'HC', 'RF', 'RE', 'HR', 'OT', 'FR', 'TK'];
const TRIP_TYPES      = ['Any', 'ROUND', 'ONE-WAY'];
const CONTAINER_CLASSES = ['Any', 'NONE', 'A', 'B', 'C'];
const EMPTY_LOADED    = ['Any', 'EMPTY', 'LOADED'];
const YARD_LOCATIONS  = ['Any', 'IMP-A1', 'IMP-A2', 'EXP-B1', 'EXP-B2', 'MT-E1', 'RF-C1', 'HAZ-D1'];
const TRUCK_CATS      = ['Any', '6W', '10W', '18W', '22W'];
const MOVEMENT_CODES  = ['Any', 'FULL IN', 'FULL OUT', 'EMTY IN', 'EMTY OUT', 'LOAD', 'DISCHARGE'];

interface ParamValues {
  branch?: string;
  bookingType?: string;
  orderType?: string;
  agent?: EntityOption | null;
  owner?: EntityOption | null;
  forwarder?: EntityOption | null;
  customer?: EntityOption | null;
  haulier?: EntityOption | null;
  vessel?: EntityOption | null;
  voyage?: string;
  yardLocation?: string;
  loadingPort?: string;
  size?: string;
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

export function ReportParamsDrawer({ report, onClose, onGenerate }: {
  report: ReportDef | null;
  onClose: () => void;
  onGenerate: (report: ReportDef, params: ParamValues) => void;
}) {
  const [vals, setVals] = useState<ParamValues>(BLANK);

  // Reset values when a new report is opened
  useEffect(() => {
    if (report) {
      // Default date range = last 30 days (mock — using today's date 2026-05-16)
      const today = new Date('2026-05-16');
      const from  = new Date(today); from.setDate(from.getDate() - 30);
      setVals({
        ...BLANK,
        dateFrom: from.toISOString().slice(0, 10),
        dateTo:   today.toISOString().slice(0, 10),
        branch: 'All Branches',
        bookingType: 'All',
        orderType: 'All',
      });
    }
  }, [report]);

  if (!report) return null;
  const set = <K extends keyof ParamValues>(k: K, v: ParamValues[K]) => setVals(p => ({ ...p, [k]: v }));

  const need = (k: ReportParamKey) => report.params.includes(k);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 60 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 540, maxWidth: '95vw',
        background: 'var(--gecko-bg-surface)', borderLeft: '1px solid var(--gecko-border)',
        zIndex: 61, display: 'flex', flexDirection: 'column',
        boxShadow: '-12px 0 36px rgba(0, 0, 0, 0.18)',
        animation: 'gecko-slide-in-right 220ms ease',
      }}>
        {/* Header */}
        <div className="gecko-row gecko-row-start" style={{ padding: '16px 20px', borderBottom: '1px solid var(--gecko-border)', gap: 12 }}>
          <Icon name={report.icon} size={18} style={{ color: 'var(--gecko-primary-600)', marginTop: 2 }} />
          <div className="gecko-flex-1">
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{report.title}</div>
            <div className="gecko-eyebrow gecko-mt-1">
              {report.group}
            </div>
          </div>
          <button onClick={onClose} className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon">
            <Icon name="x" size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="gecko-grid-2" style={{ flex: 1, overflowY: 'auto', padding: 18, alignContent: 'start' }}>

          {need('branch') && (
            <SelectField label={PARAM_LABELS.branch}
              value={vals.branch ?? ''} onChange={v => set('branch', v)} opts={BRANCHES} />
          )}
          {need('bookingType') && (
            <SelectField label={PARAM_LABELS.bookingType}
              value={vals.bookingType ?? ''} onChange={v => set('bookingType', v)} opts={BOOKING_TYPES} />
          )}
          {need('orderType') && (
            <SelectField label={PARAM_LABELS.orderType}
              value={vals.orderType ?? ''} onChange={v => set('orderType', v)} opts={ORDER_TYPES_OPT} />
          )}
          {need('agent') && (
            <EntityField label={PARAM_LABELS.agent} entityType="agent"
              value={vals.agent ?? null} onChange={v => set('agent', v)} />
          )}
          {need('owner') && (
            <EntityField label={PARAM_LABELS.owner} entityType="agent"
              value={vals.owner ?? null} onChange={v => set('owner', v)} />
          )}
          {need('forwarder') && (
            <EntityField label={PARAM_LABELS.forwarder} entityType="forwarder"
              value={vals.forwarder ?? null} onChange={v => set('forwarder', v)} />
          )}
          {need('customer') && (
            <EntityField label={PARAM_LABELS.customer} entityType="customer"
              value={vals.customer ?? null} onChange={v => set('customer', v)} />
          )}
          {need('haulier') && (
            <EntityField label={PARAM_LABELS.haulier} entityType="haulier"
              value={vals.haulier ?? null} onChange={v => set('haulier', v)} />
          )}
          {need('vessel') && (
            <EntityField label={PARAM_LABELS.vessel} entityType="vessel"
              value={vals.vessel ?? null} onChange={v => set('vessel', v)} />
          )}
          {need('voyage') && (
            <InputField label={PARAM_LABELS.voyage} placeholder="e.g. 017S"
              value={vals.voyage ?? ''} onChange={v => set('voyage', v)} mono />
          )}
          {need('yardLocation') && (
            <SelectField label={PARAM_LABELS.yardLocation}
              value={vals.yardLocation ?? ''} onChange={v => set('yardLocation', v)} opts={YARD_LOCATIONS} />
          )}
          {need('loadingPort') && (
            <InputField label={PARAM_LABELS.loadingPort} placeholder="e.g. THLCH / SGSIN"
              value={vals.loadingPort ?? ''} onChange={v => set('loadingPort', v)} mono />
          )}

          {/* Type-Size — two side-by-side selects in one slot */}
          {need('typeSize') && (
            <div className="gecko-field" style={{ gridColumn: 'span 2' }}>
              <div className="gecko-field-label">{PARAM_LABELS.typeSize}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <select className="gecko-select" value={vals.size ?? 'Any'} onChange={e => set('size', e.target.value)}>
                  {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className="gecko-select" value={vals.type ?? 'Any'} onChange={e => set('type', e.target.value)}>
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          )}

          {need('tripType') && (
            <SelectField label={PARAM_LABELS.tripType}
              value={vals.tripType ?? ''} onChange={v => set('tripType', v)} opts={TRIP_TYPES} />
          )}
          {need('containerClass') && (
            <SelectField label={PARAM_LABELS.containerClass}
              value={vals.containerClass ?? ''} onChange={v => set('containerClass', v)} opts={CONTAINER_CLASSES} />
          )}
          {need('emptyLoaded') && (
            <SelectField label={PARAM_LABELS.emptyLoaded}
              value={vals.emptyLoaded ?? ''} onChange={v => set('emptyLoaded', v)} opts={EMPTY_LOADED} />
          )}
          {need('blNo') && (
            <InputField label={PARAM_LABELS.blNo} placeholder="e.g. EGLV14960…"
              value={vals.blNo ?? ''} onChange={v => set('blNo', v)} mono />
          )}
          {need('bookingDate') && (
            <DateFieldSlot label={PARAM_LABELS.bookingDate}
              value={vals.bookingDate ?? ''} onChange={v => set('bookingDate', v)} />
          )}
          {need('truckCategory') && (
            <SelectField label={PARAM_LABELS.truckCategory}
              value={vals.truckCategory ?? ''} onChange={v => set('truckCategory', v)} opts={TRUCK_CATS} />
          )}
          {need('movementCode') && (
            <SelectField label={PARAM_LABELS.movementCode}
              value={vals.movementCode ?? ''} onChange={v => set('movementCode', v)} opts={MOVEMENT_CODES} />
          )}
          {need('userId') && (
            <InputField label={PARAM_LABELS.userId} placeholder="Username"
              value={vals.userId ?? ''} onChange={v => set('userId', v)} mono />
          )}

          {/* Date Range — always shown, spans full row */}
          <div className="gecko-field" style={{ gridColumn: 'span 2' }}>
            <div className="gecko-field-label gecko-field-required">Date Range</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <DateField value={vals.dateFrom} onChange={v => set('dateFrom', v)} placeholder="From" />
              <DateField value={vals.dateTo}   onChange={v => set('dateTo',   v)} placeholder="To" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="gecko-row" style={{ padding: '14px 20px', borderTop: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)' }}>
          <button
            className="gecko-btn gecko-btn-ghost gecko-btn-sm"
            onClick={() => setVals({ ...BLANK, dateFrom: vals.dateFrom, dateTo: vals.dateTo })}
            style={{ color: 'var(--gecko-text-secondary)' }}
          >
            Clear filters
          </button>
          <div className="gecko-flex-1" />
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose}>Cancel</button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => onGenerate(report, vals)}>
            <Icon name="fileText" size={13} /> Generate Report
          </button>
        </div>
      </div>
    </>
  );
}

/* ── Tiny field helpers ─────────────────────────────────────────────────── */

function InputField({ label, value, onChange, placeholder, mono }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean;
}) {
  return (
    <div className="gecko-field">
      <div className="gecko-field-label">{label}</div>
      <input
        className={`gecko-input gecko-input-sm${mono ? ' gecko-text-mono' : ''}`}
        value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      />
    </div>
  );
}

function SelectField({ label, value, onChange, opts }: {
  label: string; value: string; onChange: (v: string) => void; opts: string[];
}) {
  return (
    <div className="gecko-field">
      <div className="gecko-field-label">{label}</div>
      <select className="gecko-select gecko-input-sm" value={value} onChange={e => onChange(e.target.value)}>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function EntityField({ label, entityType, value, onChange }: {
  label: string; entityType: 'agent' | 'forwarder' | 'customer' | 'haulier' | 'vessel';
  value: EntityOption | null; onChange: (v: EntityOption | null) => void;
}) {
  return (
    <div className="gecko-field">
      <div className="gecko-field-label">{label}</div>
      <EntitySearch
        entityType={entityType}
        value={value}
        onChange={onChange}
        size="sm"
        placeholder={`Search ${label.toLowerCase()}…`}
      />
    </div>
  );
}

function DateFieldSlot({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="gecko-field">
      <div className="gecko-field-label">{label}</div>
      <DateField value={value} onChange={onChange} placeholder="Pick date" />
    </div>
  );
}
