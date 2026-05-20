"use client";
import React, { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { EntitySearch, type EntityOption } from '@/components/ui/EntitySearch';
import { BarcodeDisplay } from '@/components/ui/BarcodeDisplay';
import { DateField } from '@/components/ui/DateField';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import { useToast } from '@/components/ui/Toast';
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
  id: number; containerNo: string; size: string; type: string; grade: string;
  containerMode: string; haulage: string; pickupDate: string;
  imoClass: string | null; unNo: string; cargoCategory: string;
  weight: number; volume: number; sealAgent: string; sealCustomer: string;
  temperature: number | null; temperatureMode: string | null;
  vent: number | null; ventMode: string | null; humidity: number | null; preCool: string;
  stowage: number; remarks: string;
  movements: Movement[]; vas: VASCharge[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const BOOKING = {
  bookingNo: 'EGLV149602390729', subBLNo: 'EGLV149602390729',
  bookingDate: '2026-04-23', bookingType: 'EXPORT' as BookingType,
  orderType: 'EXP CY/CY', orderNo: 'ESCT1260402925', status: 'ACTIVE',
  agent:    { code: 'EVERGREEN',  name: 'EVERGREEN NONNOMINATE' },
  customer: { code: '20250892',   name: 'TCL ELECTRONICS (THAILAND) CO., LTD' },
  forwarder: null as null | { code: string; name: string },
  ownerCode: 'EVERGREEN',
  vessel:   { code: 'TCL13', name: 'EVER WEB' },
  voyageNo: '0344-022B', wharf: 'SIAM CONTAINER',
  loadingPort: 'SCT', dischargePort: 'SGSIN', destinationPort: 'SGSIN',
  tradeMode: 'EXPORT', prevLocation: '',
  etd: '2026-06-21',
  allowLateGateIn: false, paperlessCode: '',
  cutoffs: { cyDry: '2026-06-21T09:45', cyReefer: '2026-06-21T09:45', cfsDry: '2026-06-21T09:45', cfsReefer: '2026-06-21T09:45', portDry: '2026-06-21T09:45', portReefer: '2026-06-21T09:45' },
  cargo: { totalQty: '', uom: 'BAG', totalWeight: '', totalVolume: '', commodity: 'CONSUMER ELECTRONICS', marksAndNos: '', specialInstruction: '', remarks: '' },
  createdBy: 'SOMPORN', createdOn: '2026-04-23T11:26', modifiedBy: 'SOMPORN', modifiedOn: '2026-04-23T11:46',
};

const CONTAINERS: Container[] = [
  { id: 9,  containerNo: 'EGHU9213381', size: '40', type: 'HC', grade: 'NONE', containerMode: 'CY', haulage: 'MERCHANT', pickupDate: '2026-04-23', imoClass: null, unNo: '', cargoCategory: 'GENERAL', weight: 0, volume: 0, sealAgent: 'EMCSAS5464', sealCustomer: '', temperature: null, temperatureMode: null, vent: null, ventMode: null, humidity: null, preCool: '', stowage: 0, remarks: '',
    movements: [{ code: 'FULL IN', txNo: 'EISCT1260406241', date: '2026-04-24T00:31', status: true, yard: 'SCT EXP', truck: 'GISCT1260412201' }, { code: 'LOAD', txNo: '', date: '', status: false, yard: '', truck: '' }], vas: [] },
  { id: 10, containerNo: 'EITU9845240', size: '40', type: 'HC', grade: 'NONE', containerMode: 'CY', haulage: 'MERCHANT', pickupDate: '2026-04-23', imoClass: null, unNo: '', cargoCategory: 'GENERAL', weight: 0, volume: 0, sealAgent: 'EMCSAS7194', sealCustomer: '', temperature: null, temperatureMode: null, vent: null, ventMode: null, humidity: null, preCool: '', stowage: 0, remarks: '',
    movements: [{ code: 'FULL IN', txNo: 'EISCT1260406242', date: '2026-04-24T00:38', status: true, yard: 'SCT EXP', truck: 'GISCT1260412202' }, { code: 'LOAD', txNo: '', date: '', status: false, yard: '', truck: '' }], vas: [] },
  { id: 11, containerNo: 'EITU9844201', size: '40', type: 'HC', grade: 'NONE', containerMode: 'CY', haulage: 'MERCHANT', pickupDate: '2026-04-23', imoClass: null, unNo: '', cargoCategory: 'GENERAL', weight: 0, volume: 0, sealAgent: 'EMCSAS5604', sealCustomer: '', temperature: null, temperatureMode: null, vent: null, ventMode: null, humidity: null, preCool: '', stowage: 0, remarks: '',
    movements: [{ code: 'FULL IN', txNo: 'EISCT1260406243', date: '2026-04-24T00:42', status: true, yard: 'SCT EXP', truck: 'GISCT1260412209' }, { code: 'LOAD', txNo: '', date: '', status: false, yard: '', truck: '' }], vas: [] },
  { id: 12, containerNo: 'EITU1513064', size: '40', type: 'HC', grade: 'NONE', containerMode: 'CY', haulage: 'MERCHANT', pickupDate: '2026-04-23', imoClass: null, unNo: '', cargoCategory: 'GENERAL', weight: 0, volume: 0, sealAgent: 'EMCSAS6774', sealCustomer: '', temperature: null, temperatureMode: null, vent: null, ventMode: null, humidity: null, preCool: '', stowage: 0, remarks: '',
    movements: [{ code: 'FULL IN', txNo: 'EISCT1260406244', date: '2026-04-24T00:45', status: true, yard: 'SCT EXP', truck: 'GISCT1260412210' }, { code: 'LOAD', txNo: '', date: '', status: false, yard: '', truck: '' }], vas: [] },
  { id: 13, containerNo: 'BEAU5071982', size: '40', type: 'HC', grade: 'NONE', containerMode: 'CY', haulage: 'MERCHANT', pickupDate: '2026-04-23', imoClass: null, unNo: '', cargoCategory: 'GENERAL', weight: 0, volume: 0, sealAgent: 'EMCSAS5304', sealCustomer: '', temperature: null, temperatureMode: null, vent: null, ventMode: null, humidity: null, preCool: '', stowage: 0, remarks: '',
    movements: [{ code: 'FULL IN', txNo: '', date: '', status: false, yard: '', truck: '' }, { code: 'LOAD', txNo: '', date: '', status: false, yard: '', truck: '' }], vas: [] },
  { id: 14, containerNo: 'EITU1221210', size: '40', type: 'HC', grade: 'NONE', containerMode: 'CY', haulage: 'MERCHANT', pickupDate: '2026-04-23', imoClass: null, unNo: '', cargoCategory: 'GENERAL', weight: 0, volume: 0, sealAgent: '', sealCustomer: '', temperature: null, temperatureMode: null, vent: null, ventMode: null, humidity: null, preCool: '', stowage: 0, remarks: '',
    movements: [{ code: 'FULL IN', txNo: '', date: '', status: false, yard: '', truck: '' }, { code: 'LOAD', txNo: '', date: '', status: false, yard: '', truck: '' }], vas: [] },
  { id: 15, containerNo: 'EITU9845677', size: '40', type: 'HC', grade: 'NONE', containerMode: 'CY', haulage: 'MERCHANT', pickupDate: '2026-04-23', imoClass: null, unNo: '', cargoCategory: 'GENERAL', weight: 0, volume: 0, sealAgent: 'EMCSAS7084', sealCustomer: '', temperature: null, temperatureMode: null, vent: null, ventMode: null, humidity: null, preCool: '', stowage: 0, remarks: '',
    movements: [{ code: 'FULL IN', txNo: 'EISCT1260406244', date: '2026-04-24T00:45', status: true, yard: 'SCT EXP', truck: 'GISCT1260412213' }, { code: 'LOAD', txNo: '', date: '', status: false, yard: '', truck: '' }], vas: [] },
  { id: 16, containerNo: '',           size: '40', type: 'HC', grade: 'NONE', containerMode: 'CY', haulage: 'MERCHANT', pickupDate: '2026-04-23', imoClass: null, unNo: '', cargoCategory: 'GENERAL', weight: 0, volume: 0, sealAgent: '', sealCustomer: '', temperature: null, temperatureMode: null, vent: null, ventMode: null, humidity: null, preCool: '', stowage: 0, remarks: '',
    movements: [{ code: 'FULL IN', txNo: '', date: '', status: false, yard: '', truck: '' }, { code: 'LOAD', txNo: '', date: '', status: false, yard: '', truck: '' }], vas: [] },
];

// Template for a brand-new container — opened when "Add Container" is clicked
const BLANK_CONTAINER: Container = {
  id: 0, containerNo: '', size: '40', type: 'HC', grade: 'NONE',
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

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - new Date('2026-04-26').getTime();
  return Math.ceil(diff / 86400000);
}

function urgencyColor(days: number) {
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

function ContainerDrawer({ container, onClose, onDuplicate, onDelete }: {
  container: Container; onClose: () => void;
  onDuplicate: () => void; onDelete: () => void;
}) {
  const [form, setForm] = useState({ ...container });
  const { toast } = useToast();
  const isReefer = ['RF', 'RE', 'HR', 'RH'].includes(form.type);
  const isDG     = form.cargoCategory === 'DG';

  const set = (k: keyof Container, v: unknown) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 45, backdropFilter: 'blur(1px)' }} />

      {/* Drawer */}
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 480, zIndex: 50, background: 'var(--gecko-bg-surface)', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflowY: 'hidden' }}>

        {/* Drawer header */}
        <div style={{ padding: '16px 20px', background: 'var(--gecko-primary-600)', flexShrink: 0 }}>
          <div className="gecko-row gecko-row-between">
            <div className="gecko-row" style={{ gap: 10 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: 'var(--gecko-font-mono)', letterSpacing: '0.04em' }}>{form.containerNo || <span style={{ opacity: 0.5, fontSize: 14 }}>TBA</span>}</div>
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
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>

          {/* ── Container Info ── */}
          <div style={{ paddingTop: 20 }}>
            <div className="gecko-eyebrow gecko-mb-3">Container Info</div>

            {/* Container No (full width) */}
            <div className="gecko-form-group gecko-mb-3">
              <label className="gecko-label">Container No <span style={{ fontSize: 10, color: 'var(--gecko-text-disabled)' }}>(leave blank if not yet nominated)</span></label>
              <input className="gecko-input gecko-text-mono" value={form.containerNo} onChange={e => set('containerNo', e.target.value)} placeholder="e.g. EITU9845677" />
            </div>

            {/* Type-Size + P/U Mode */}
            <div className="gecko-grid-2">
              <div className="gecko-form-group">
                <label className="gecko-label gecko-label-required">Type — Size</label>
                <div className="gecko-grid-2" style={{ gap: 6 }}>
                  <select className="gecko-input" value={form.size} onChange={e => set('size', e.target.value)}>
                    {['20', '40', '45'].map(s => <option key={s}>{s}</option>)}
                  </select>
                  <select className="gecko-input" value={form.type} onChange={e => set('type', e.target.value)}>
                    {['GP', 'HC', 'RF', 'RE', 'HR', 'OT', 'FR', 'TK', 'PL'].map(t => <option key={t}>{t}</option>)}
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
            <div className="gecko-form-group" style={{ marginTop: 4 }}>
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
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gecko-text-disabled)', marginBottom: 12 }}>Seals &amp; Stowage</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)', flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={onDuplicate} className="gecko-btn gecko-btn-ghost gecko-btn-sm" style={{ color: 'var(--gecko-text-secondary)' }}><Icon name="copy" size={13} /> Duplicate</button>
          <button onClick={onDelete}    className="gecko-btn gecko-btn-ghost gecko-btn-sm" style={{ color: 'var(--gecko-danger-600)' }}><Icon name="trash" size={13} /> Delete</button>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} className="gecko-btn gecko-btn-outline gecko-btn-sm">Cancel</button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => { toast({ variant: 'success', title: 'Container saved', message: form.containerNo || 'New container saved as draft.' }); onClose(); }}><Icon name="save" size={13} /> Save Container</button>
        </div>
      </div>
    </>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function TabVoyage() {
  const [editMode, setEditMode] = useState(false);
  const b = BOOKING;
  const [etdEdit, setEtdEdit] = useState(b.etd);

  // Party edit state — pre-seeded from mock booking data
  const [editAgent,   setEditAgent]   = useState<EntityOption | null>({ code: b.agent.code,    name: b.agent.name });
  const [editShipper, setEditShipper] = useState<EntityOption | null>({ code: b.customer.code, name: b.customer.name });
  const [editFwd,     setEditFwd]     = useState<EntityOption | null>(null);

  const FieldRow = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gecko-text-disabled)' }}>{label}</div>
      {editMode
        ? <input className="gecko-input gecko-input-sm" defaultValue={value} style={mono ? { fontFamily: 'var(--gecko-font-mono)' } : {}} />
        : <div style={{ fontSize: 13, fontWeight: 600, color: value ? 'var(--gecko-text-primary)' : 'var(--gecko-text-disabled)', fontFamily: mono ? 'var(--gecko-font-mono)' : 'inherit' }}>{value || '—'}</div>
      }
    </div>
  );

  const cutoffDays = daysUntil(b.cutoffs.cyDry);
  const urgency    = urgencyColor(cutoffDays);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '24px' }}>

      {/* Parties */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gecko-text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="users" size={14} /> Parties</div>
          <button onClick={() => setEditMode(!editMode)} className="gecko-btn gecko-btn-ghost gecko-btn-sm" style={{ fontSize: 11 }}>
            <Icon name={editMode ? 'x' : 'edit'} size={13} /> {editMode ? 'Cancel' : 'Edit'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18, padding: '16px 20px', background: 'var(--gecko-bg-subtle)', borderRadius: 10, border: '1px solid var(--gecko-border)' }}>
          {/* Shipping Agent */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gecko-text-disabled)', marginBottom: 4 }}>Shipping Agent / Line</div>
            {editMode
              ? <EntitySearch entityType="agent" value={editAgent} onChange={setEditAgent} size="sm" placeholder="Search agent or line…" />
              : <>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{b.agent.name}</div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-secondary)', marginTop: 1 }}>{b.agent.code}</div>
                </>
            }
          </div>
          {/* Shipper */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gecko-text-disabled)', marginBottom: 4 }}>Shipper</div>
            {editMode
              ? <EntitySearch entityType="shipper" value={editShipper} onChange={setEditShipper} size="sm" placeholder="Search shipper…" />
              : <>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{b.customer.name}</div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-secondary)', marginTop: 1 }}>{b.customer.code}</div>
                </>
            }
          </div>
          {/* Container Owner */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gecko-text-disabled)', marginBottom: 4 }}>Container Owner</div>
            {editMode
              ? <EntitySearch entityType="agent" value={{ code: b.ownerCode, name: b.ownerCode }} onChange={() => {}} size="sm" placeholder="Search owner…" />
              : <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gecko-text-primary)', fontFamily: 'var(--gecko-font-mono)' }}>{b.ownerCode}</div>
            }
          </div>
          {/* Freight Forwarder */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gecko-text-disabled)', marginBottom: 4 }}>Freight Forwarder</div>
            {editMode
              ? <EntitySearch entityType="forwarder" value={editFwd} onChange={setEditFwd} size="sm" placeholder="Search forwarder…" />
              : <div style={{ fontSize: 13, color: 'var(--gecko-text-disabled)' }}>—</div>
            }
          </div>
        </div>
      </div>

      {/* Vessel & Voyage */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gecko-text-secondary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="ship" size={14} /> Vessel & Voyage</div>
        <div style={{ padding: '16px 20px', background: 'var(--gecko-bg-subtle)', borderRadius: 10, border: '1px solid var(--gecko-border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
            <FieldRow label="Vessel Name" value={b.vessel.name} />
            <FieldRow label="Vessel Code" value={b.vessel.code} mono />
            <FieldRow label="Voyage No" value={b.voyageNo} mono />
            <FieldRow label="Wharf" value={b.wharf} />
            <FieldRow label="Loading Port" value={b.loadingPort} mono />
            <FieldRow label="Discharge Port" value={b.dischargePort} mono />
            <FieldRow label="Destination Port" value={b.destinationPort} mono />
            <FieldRow label="Trade Mode" value={b.tradeMode} />
          </div>
          <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gecko-text-disabled)' }}>ETD</div>
              {editMode
                ? <DateField value={etdEdit} onChange={setEtdEdit} size="sm" />
                : <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--gecko-primary-700)', fontFamily: 'var(--gecko-font-mono)' }}>{new Date(etdEdit).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
              }
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--gecko-text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked={b.allowLateGateIn} /> Allow Late Gate-In
              </label>
            </div>
            <div className="gecko-form-group" style={{ marginBottom: 0 }}>
              <label className="gecko-label" style={{ fontSize: 10 }}>Paperless Code</label>
              <input className="gecko-input gecko-input-sm gecko-text-mono" defaultValue={b.paperlessCode} placeholder="Optional" style={{ width: 120 }} />
            </div>
          </div>
        </div>
      </div>

      {/* Cut-off Dates */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gecko-text-secondary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="clock" size={14} /> Cut-off Dates</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { label: 'CY Cut-off (Dry)',    value: b.cutoffs.cyDry },
            { label: 'CY Cut-off (Reefer)', value: b.cutoffs.cyReefer },
            { label: 'CFS Cut-off (Dry)',   value: b.cutoffs.cfsDry },
            { label: 'CFS Cut-off (Reefer)',value: b.cutoffs.cfsReefer },
            { label: 'Port Cut-off (Dry)',  value: b.cutoffs.portDry },
            { label: 'Port Cut-off (Reefer)',value: b.cutoffs.portReefer },
          ].map(co => {
            const d = daysUntil(co.value);
            const u = urgencyColor(d);
            return (
              <div key={co.label} style={{ padding: '12px 14px', borderRadius: 8, background: u.bg, border: `1px solid ${u.bar}30` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: u.color, marginBottom: 4 }}>{co.label}</div>
                {editMode
                  ? <input className="gecko-input gecko-input-sm" type="datetime-local" defaultValue={co.value} />
                  : <>
                      <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--gecko-font-mono)', color: u.color }}>{d}d</div>
                      <div style={{ fontSize: 10, color: u.color, opacity: 0.8, marginTop: 1 }}>{new Date(co.value).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                    </>
                }
              </div>
            );
          })}
        </div>
      </div>

      {editMode && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={() => setEditMode(false)} className="gecko-btn gecko-btn-outline gecko-btn-sm">Cancel</button>
          <button onClick={() => setEditMode(false)} className="gecko-btn gecko-btn-primary gecko-btn-sm"><Icon name="save" size={13} /> Save Voyage & Parties</button>
        </div>
      )}
    </div>
  );
}

function TabContainers({ onSelectContainer, onAddContainer, onDeleteContainer, orderTypeCode, selected, setSelected }: {
  onSelectContainer: (c: Container) => void;
  onAddContainer: () => void;
  onDeleteContainer: (id: number) => void;
  orderTypeCode: string;
  selected: Set<number>;
  setSelected: React.Dispatch<React.SetStateAction<Set<number>>>;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [addMultipleOpen, setAddMultipleOpen] = useState(false);
  const [vasDrawer, setVasDrawer] = useState<null | { mode: 'single' | 'multi'; containerIds: number[] }>(null);
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

  const filtered = CONTAINERS.filter(c =>
    !search || c.containerNo.toLowerCase().includes(search.toLowerCase())
  );

  const toggleAll = (checked: boolean) =>
    setSelected(checked ? new Set(filtered.map(c => c.id)) : new Set());

  const toggleExpand = (id: number) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const summary = {
    total: CONTAINERS.length,
    fullIn: CONTAINERS.filter(c => containerStatus(c) === 'FULL_IN' || containerStatus(c) === 'LOADED').length,
    awaiting: CONTAINERS.filter(c => containerStatus(c) === 'NO_ACTIVITY').length,
  };

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Mini stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--gecko-border)', border: '1px solid var(--gecko-border)', borderRadius: 10, overflow: 'hidden' }}>
        {[
          { label: 'Total Containers', val: summary.total,    color: 'var(--gecko-text-primary)'    },
          { label: 'Full In',          val: summary.fullIn,   color: 'var(--gecko-primary-600)'     },
          { label: 'Awaiting',         val: summary.awaiting, color: 'var(--gecko-warning-600)'     },
          { label: 'On Booking',       val: '40HC × 8',       color: 'var(--gecko-text-secondary)'  },
        ].map(s => (
          <div key={s.label} style={{ padding: '12px 16px', background: 'var(--gecko-bg-surface)', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: 'var(--gecko-font-mono)', lineHeight: 1 }}>{s.val}</div>
            <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
          <Icon name="search" size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-text-disabled)', pointerEvents: 'none' }} />
          <input className="gecko-input gecko-input-sm" placeholder="Search container no…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 28 }} />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {selected.size > 0 && (
            <span style={{ fontSize: 11, color: 'var(--gecko-primary-700)', background: 'var(--gecko-primary-50)', border: '1px solid var(--gecko-primary-200)', padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>
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
            onDeleteMultiple={() => toast({ variant: 'warning', title: `Delete ${selected.size} container${selected.size === 1 ? '' : 's'}`, message: 'Confirm dialog stub — backend deletion next iteration.' })}
            onUpdateVAS={() => setVasDrawer({ mode: 'multi', containerIds: [...selected] })}
            onUpdatePUDO={() => toast({ variant: 'info', title: 'Update PU/DO Mode', message: 'Picker popover coming next iteration.' })}
            onClearDetails={() => { setSelected(new Set()); setExpanded(new Set()); toast({ variant: 'info', title: 'Cleared', message: 'Selection and expanded rows reset.' }); }}
          />
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={onAddContainer}><Icon name="plus" size={13} /> Add Container</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ border: '1px solid var(--gecko-border)', borderRadius: 10, overflow: 'hidden' }}>
        <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 12.5 }}>
          <thead>
            <tr>
              <th style={{ width: 36 }}><input type="checkbox" onChange={e => toggleAll(e.target.checked)} /></th>
              <th style={{ width: 30 }} aria-label="Expand" />
              <th style={{ width: 30 }}>#</th>
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
            {filtered.map((c) => {
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
                    <td style={{ color: 'var(--gecko-text-disabled)', fontFamily: 'var(--gecko-font-mono)', fontSize: 11 }}>{c.id}</td>
                    <td>
                      <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, fontSize: 12.5, color: c.containerNo ? 'var(--gecko-text-primary)' : 'var(--gecko-text-disabled)' }}>
                        {c.containerNo || 'TBA'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-primary-700)', background: 'var(--gecko-primary-50)', padding: '2px 6px', borderRadius: 4 }}>{c.size}{c.type}</span>
                    </td>
                    <td><span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--gecko-text-secondary)' }}>{c.containerMode}</span></td>
                    <td style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>{c.cargoCategory}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: ss.color }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: ss.dot, flexShrink: 0 }} />
                        {ss.label}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 11, color: 'var(--gecko-text-secondary)' }}>{c.sealAgent || '—'}</td>
                    <td style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', fontFamily: 'var(--gecko-font-mono)', whiteSpace: 'nowrap' }}>{c.pickupDate}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                        <button onClick={() => onSelectContainer(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gecko-text-disabled)', padding: '3px 5px', borderRadius: 4 }} title="Edit"><Icon name="edit" size={13} /></button>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gecko-text-disabled)', padding: '3px 5px', borderRadius: 4 }} title="Duplicate"><Icon name="copy" size={13} /></button>
                        <button onClick={() => onDeleteContainer(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gecko-danger-400)', padding: '3px 5px', borderRadius: 4 }} title="Delete"><Icon name="trash" size={13} /></button>
                      </div>
                    </td>
                  </tr>
                  {isExp && (
                    <tr className="gecko-table-row-expand-panel">
                      <td colSpan={11}>
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

      <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>Showing {filtered.length} of {CONTAINERS.length} containers</span>
        <span style={{ color: 'var(--gecko-text-disabled)' }}>·</span>
        <span>Click the chevron to expand · click anywhere else on a row to edit</span>
      </div>

      {addMultipleOpen && (
        <AddMultipleContainersModal
          onCancel={() => setAddMultipleOpen(false)}
          onConfirm={(payload) => {
            toast({
              variant: 'success',
              title: `Added ${payload.count} container${payload.count === 1 ? '' : 's'}`,
              message: `${payload.size}${payload.type} · ${payload.mode} · ${payload.cargoCat} — ready for container-no entry.`,
            });
            setAddMultipleOpen(false);
          }}
        />
      )}

      {vasDrawer && (
        <VasDrawer
          mode={vasDrawer.mode}
          containerIds={vasDrawer.containerIds}
          availableVAS={orderTypeVAS}
          orderTypeCode={orderTypeCode}
          initialSelected={vasDrawer.mode === 'single'
            ? new Set((CONTAINERS.find(c => c.id === vasDrawer.containerIds[0])?.vas ?? []).map(v => v.chargeCode))
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

function TabCargo() {
  const c = BOOKING.cargo;
  const { toast } = useToast();
  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <div className="gecko-form-group">
          <label className="gecko-label">Total Qty</label>
          <input className="gecko-input" defaultValue={c.totalQty} placeholder="—" />
        </div>
        <div className="gecko-form-group">
          <label className="gecko-label">UOM</label>
          <select className="gecko-input" defaultValue={c.uom}>
            {['BAG', 'BOX', 'CTN', 'PAL', 'PCS', 'ROL', 'SET', 'TNE'].map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div className="gecko-form-group">
          <label className="gecko-label">Total Weight (KGS)</label>
          <input className="gecko-input gecko-text-mono" defaultValue={c.totalWeight} placeholder="0.00" />
        </div>
        <div className="gecko-form-group">
          <label className="gecko-label">Total Volume (CBM)</label>
          <input className="gecko-input gecko-text-mono" defaultValue={c.totalVolume} placeholder="0.00" />
        </div>
      </div>
      <div className="gecko-form-group">
        <label className="gecko-label">Commodity Description</label>
        <input className="gecko-input" defaultValue={c.commodity} placeholder="e.g. CONSUMER ELECTRONICS" />
      </div>
      <div className="gecko-form-group">
        <label className="gecko-label">Marks & Nos</label>
        <textarea className="gecko-input" rows={2} defaultValue={c.marksAndNos} style={{ resize: 'vertical' }} />
      </div>
      <div className="gecko-form-group">
        <label className="gecko-label">Special Instructions</label>
        <textarea className="gecko-input" rows={3} defaultValue={c.specialInstruction} style={{ resize: 'vertical' }} />
      </div>
      <div className="gecko-form-group">
        <label className="gecko-label">Remarks</label>
        <textarea className="gecko-input" rows={2} defaultValue={c.remarks} style={{ resize: 'vertical' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => toast({ variant: 'success', title: 'Cargo details saved', message: 'Booking cargo information updated.' })}><Icon name="save" size={13} /> Save Cargo Details</button>
      </div>
    </div>
  );
}

function TabAudit() {
  return (
    <div style={{ padding: '24px' }}>
      <div style={{ border: '1px solid var(--gecko-border)', borderRadius: 10, overflow: 'hidden' }}>
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
                <td style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 11, color: 'var(--gecko-text-secondary)', whiteSpace: 'nowrap' }}>
                  {new Date(a.on).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td style={{ fontSize: 12, fontWeight: 600, color: a.by.startsWith('System') ? 'var(--gecko-info-700)' : 'var(--gecko-text-primary)' }}>
                  {a.by.startsWith('System') ? <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="zap" size={11} style={{ color: 'var(--gecko-info-500)' }} />{a.by}</span> : a.by}
                </td>
                <td style={{ fontWeight: 500 }}>{a.action}</td>
                <td style={{ color: 'var(--gecko-text-secondary)', fontSize: 11, fontFamily: 'var(--gecko-font-mono)' }}>{a.field}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BookingDetailPage() {
  const [activeTab, setActiveTab] = useState<'voyage' | 'containers' | 'cargo' | 'audit'>('containers');
  const [drawerContainer, setDrawerContainer] = useState<Container | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [orderTypeCode, setOrderTypeCode] = useState<string>(BOOKING.orderType);
  const [orderTypeChangePending, setOrderTypeChangePending] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [changeOrderTypeOpen, setChangeOrderTypeOpen] = useState(false);
  const [deleteContainerId, setDeleteContainerId] = useState<number | null>(null);
  // Selection state hoisted to the page so the top "..." menu actions can
  // react to "is at least one container selected?" without going through
  // TabContainers internal state.
  const [selectedContainerIds, setSelectedContainerIds] = useState<Set<number>>(new Set());
  const { toast } = useToast();
  const router = useRouter();

  // Order Type change with soft-warn — if any container already has a recorded
  // transaction, ask the user to confirm before overwriting movement templates.
  const hasRecordedMovements = CONTAINERS.some(c => c.movements.some(m => m.status));

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

  const summary = {
    total:        CONTAINERS.length,
    fullAccept:   CONTAINERS.filter(c => containerStatus(c) !== 'NO_ACTIVITY').length,
    fullRelease:  CONTAINERS.filter(c => containerStatus(c) === 'LOADED').length,
    awaiting:     CONTAINERS.filter(c => containerStatus(c) === 'NO_ACTIVITY').length,
  };

  const TABS = [
    { id: 'voyage',     label: 'Voyage & Parties', icon: 'ship'          },
    { id: 'containers', label: 'Containers',        icon: 'packageOpen'   },
    { id: 'cargo',      label: 'Cargo & Docs',      icon: 'fileText'      },
    { id: 'audit',      label: 'Audit Log',         icon: 'clock'         },
  ] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxWidth: '100%' }}>

      {/* ── Sticky Header Band ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--gecko-bg-surface)', borderBottom: '1px solid var(--gecko-border)', boxShadow: 'var(--gecko-shadow-sm)' }}>

        {/* Row 1: identification + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--gecko-border)' }}>
          <Link href="/bookings" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 7, border: '1px solid var(--gecko-border)', color: 'var(--gecko-text-secondary)', textDecoration: 'none', flexShrink: 0 }}>
            <Icon name="arrowLeft" size={14} />
          </Link>

          {/* Badges */}
          <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 6, background: b.bookingType === 'EXPORT' ? 'var(--gecko-primary-600)' : 'var(--gecko-info-600)', color: '#fff', letterSpacing: '0.04em' }}>{b.bookingType}</span>

          {/* Order Type — dropdown sourced from the shared catalog (masters/order-types) */}
          <select
            value={orderTypeCode}
            onChange={e => attemptOrderTypeChange(e.target.value)}
            style={{
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
              background: 'var(--gecko-bg-subtle)',
              color: 'var(--gecko-text-secondary)',
              border: '1px solid var(--gecko-border)',
              fontFamily: 'inherit',
              cursor: 'pointer',
              height: 26,
            }}
            title="Change order type — sourced from masters/order-types"
          >
            {ACTIVE_ORDER_TYPES.map(ot => (
              <option key={ot.id} value={ot.code}>{ot.code}</option>
            ))}
          </select>

          {/* Booking & Order numbers */}
          <div style={{ height: 18, width: 1, background: 'var(--gecko-border)', flexShrink: 0 }} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--gecko-text-disabled)', textTransform: 'uppercase' }}>Booking</span>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)' }}>{b.bookingNo}</span>
          </div>
          <div style={{ height: 18, width: 1, background: 'var(--gecko-border)', flexShrink: 0 }} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--gecko-text-disabled)', textTransform: 'uppercase' }}>Order</span>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-primary-700)' }}>{b.orderNo}</span>
          </div>

          <div style={{ flex: 1 }} />

          {/* Actions */}
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={() => window.print()}><Icon name="print" size={13} /> Print</button>
          <Link href="/billing/statement" className="gecko-btn gecko-btn-ghost gecko-btn-sm" style={{ color: 'var(--gecko-info-600)', textDecoration: 'none' }}><Icon name="fileText" size={13} /> Billing Statement</Link>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => toast({ variant: 'info', title: 'Booking cloned', message: `${b.bookingNo} duplicated as a draft.` })}><Icon name="copy" size={13} /> Clone</button>

          {/* More menu */}
          <div style={{ position: 'relative' }}>
            <button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon" onClick={() => setMoreOpen(!moreOpen)} title="More actions">
              <Icon name="moreHorizontal" size={15} />
            </button>
            {moreOpen && (
              <>
                <div onClick={() => setMoreOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
                <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 40, background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 10, boxShadow: 'var(--gecko-shadow-md)', minWidth: 220, overflow: 'hidden' }}>
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
                    }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', color: item.color, fontSize: 13, fontFamily: 'inherit', textAlign: 'left' }}>
                      <Icon name={item.icon} size={14} style={{ color: item.color }} /> {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => toast({ variant: 'success', title: 'Booking saved', message: `${b.bookingNo} updated successfully.` })}><Icon name="save" size={13} /> Save</button>
        </div>

        {/* Row 2: vessel info + cut-off urgency */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '8px 20px', background: 'var(--gecko-bg-subtle)', fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="ship" size={13} style={{ color: 'var(--gecko-text-secondary)' }} />
            <span style={{ fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{b.vessel.name}</span>
            <span style={{ color: 'var(--gecko-text-disabled)' }}>({b.vessel.code})</span>
          </div>
          <div style={{ color: 'var(--gecko-text-disabled)' }}>·</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: 'var(--gecko-text-secondary)' }}>Voy</span>
            <span style={{ fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)' }}>{b.voyageNo}</span>
          </div>
          <div style={{ color: 'var(--gecko-text-disabled)' }}>·</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: 'var(--gecko-text-secondary)' }}>Loading</span>
            <span style={{ fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)' }}>{b.loadingPort}</span>
            <Icon name="arrowRight" size={11} style={{ color: 'var(--gecko-text-disabled)' }} />
            <span style={{ fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)' }}>{b.dischargePort}</span>
          </div>
          <div style={{ color: 'var(--gecko-text-disabled)' }}>·</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: 'var(--gecko-text-secondary)' }}>ETD</span>
            <span style={{ fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{new Date(b.etd).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="clock" size={13} style={{ color: urgency.color }} />
            <span style={{ fontSize: 11, color: urgency.color, fontWeight: 600 }}>CY Cut-off in</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: urgency.color, fontFamily: 'var(--gecko-font-mono)', background: urgency.bg, padding: '2px 8px', borderRadius: 6 }}>{cutoffDays}d</span>
            <span style={{ fontSize: 10.5, color: 'var(--gecko-text-disabled)' }}>Modified {new Date(b.modifiedOn).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} by {b.modifiedBy}</span>
          </div>
        </div>
      </div>

      {/* ── Body: main content + sidebar ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Tab nav */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-surface)', paddingLeft: 20 }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '12px 18px',
                  background: 'none', border: 'none', borderBottom: activeTab === tab.id ? '2px solid var(--gecko-primary-600)' : '2px solid transparent',
                  color: activeTab === tab.id ? 'var(--gecko-primary-700)' : 'var(--gecko-text-secondary)',
                  fontWeight: activeTab === tab.id ? 700 : 500, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  marginBottom: -1, transition: 'color 100ms',
                }}
              >
                <Icon name={tab.icon} size={14} />
                {tab.label}
                {tab.id === 'containers' && <span style={{ fontSize: 10, fontWeight: 700, background: activeTab === tab.id ? 'var(--gecko-primary-100)' : 'var(--gecko-bg-subtle)', color: activeTab === tab.id ? 'var(--gecko-primary-700)' : 'var(--gecko-text-disabled)', borderRadius: 10, padding: '1px 6px', marginLeft: 2 }}>{CONTAINERS.length}</span>}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ background: 'var(--gecko-bg-surface)' }}>
            {activeTab === 'voyage'     && <TabVoyage />}
            {activeTab === 'containers' && (
              <TabContainers
                onSelectContainer={c => setDrawerContainer(c)}
                onAddContainer={() => setDrawerContainer({ ...BLANK_CONTAINER, id: Date.now() })}
                onDeleteContainer={id => setDeleteContainerId(id)}
                orderTypeCode={orderTypeCode}
                selected={selectedContainerIds}
                setSelected={setSelectedContainerIds}
              />
            )}
            {activeTab === 'cargo'      && <TabCargo />}
            {activeTab === 'audit'      && <TabAudit />}
          </div>
        </div>

        {/* ── Right Sidebar ── */}
        <div style={{ width: 272, flexShrink: 0, borderLeft: '1px solid var(--gecko-border)', position: 'sticky', top: 93, maxHeight: 'calc(100vh - 93px)', overflowY: 'auto', background: 'var(--gecko-bg-subtle)' }}>

          {/* Booking Summary */}
          <div style={{ padding: '16px 16px 0' }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gecko-text-disabled)', marginBottom: 12 }}>Booking Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Total',        val: summary.total,       color: 'var(--gecko-text-primary)'   },
                { label: 'Full Accept',  val: summary.fullAccept,  color: 'var(--gecko-primary-600)'    },
                { label: 'Full Release', val: summary.fullRelease, color: 'var(--gecko-success-600)'    },
                { label: 'Awaiting',     val: summary.awaiting,    color: 'var(--gecko-warning-600)'    },
              ].map(s => (
                <div key={s.label} style={{ padding: '10px 12px', background: 'var(--gecko-bg-surface)', borderRadius: 8, border: '1px solid var(--gecko-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: 'var(--gecko-font-mono)', lineHeight: 1 }}>{s.val}</div>
                  <div style={{ fontSize: 9.5, color: 'var(--gecko-text-disabled)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--gecko-bg-surface)', borderRadius: 8, border: '1px solid var(--gecko-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>Container mix</span>
              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)' }}>40HC × {CONTAINERS.length}</span>
            </div>
          </div>

          {/* Cut-off Status */}
          <div style={{ padding: '16px 16px 0', marginTop: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gecko-text-disabled)', marginBottom: 12 }}>Cut-off Countdown</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'CY (Dry)',     date: b.cutoffs.cyDry     },
                { label: 'CY (Reefer)', date: b.cutoffs.cyReefer  },
                { label: 'CFS (Dry)',   date: b.cutoffs.cfsDry    },
                { label: 'Port (Dry)',  date: b.cutoffs.portDry   },
              ].map(co => {
                const d  = daysUntil(co.date);
                const u  = urgencyColor(d);
                const totalDays = daysUntil(b.etd) + cutoffDays;
                const pct = Math.max(3, Math.min(97, (d / 60) * 100));
                return (
                  <div key={co.label} style={{ padding: '8px 10px', background: 'var(--gecko-bg-surface)', borderRadius: 8, border: '1px solid var(--gecko-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--gecko-text-secondary)' }}>{co.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: u.color, fontFamily: 'var(--gecko-font-mono)' }}>{d}d</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'var(--gecko-bg-subtle)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: u.bar, borderRadius: 2, transition: 'width 400ms' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ padding: '16px', marginTop: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gecko-text-disabled)', marginBottom: 10 }}>Quick Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { icon: 'plus',       label: 'Add Container',           action: () => { setActiveTab('containers'); setDrawerContainer({ ...BLANK_CONTAINER, id: Date.now() }); } },
                { icon: 'fileText',   label: 'View Billing Statement',   action: () => router.push('/billing/statement') },
                { icon: 'print',      label: 'Print Booking Advice',     action: () => window.print() },
              ].map(qa => (
                <button key={qa.label} onClick={qa.action} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--gecko-text-primary)', fontSize: 12, fontWeight: 500, textAlign: 'left' }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--gecko-bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gecko-text-secondary)', flexShrink: 0 }}>
                    <Icon name={qa.icon} size={13} />
                  </div>
                  {qa.label}
                </button>
              ))}
            </div>
          </div>

          {/* Barcode Card */}
          <div className="gecko-card" style={{ padding: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gecko-text-secondary)', marginBottom: 12 }}>Document Barcodes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 9.5, color: 'var(--gecko-text-disabled)', marginBottom: 5 }}>Booking No</div>
                <BarcodeDisplay value="EGLV149602390729" variant="qr" qrSize={90} showValue={false} />
              </div>
              <div style={{ borderTop: '1px dashed var(--gecko-border)', paddingTop: 10 }}>
                <div style={{ fontSize: 9.5, color: 'var(--gecko-text-disabled)', marginBottom: 5 }}>Machine Readable</div>
                <BarcodeDisplay value="EGLV149602390729" variant="code128" showValue={false} />
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--gecko-border)', marginTop: 4 }}>
            {[
              { label: 'Created by', val: b.createdBy,   sub: new Date(b.createdOn).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) },
              { label: 'Modified by', val: b.modifiedBy, sub: new Date(b.modifiedOn).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) },
            ].map(m => (
              <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: 'var(--gecko-text-disabled)' }}>{m.label}</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gecko-text-secondary)' }}>{m.val}</div>
                  <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)', fontFamily: 'var(--gecko-font-mono)' }}>{m.sub}</div>
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
          onClose={() => setDrawerContainer(null)}
          onDuplicate={() => setDrawerContainer(null)}
          onDelete={() => setDrawerContainer(null)}
        />
      )}

      {/* ── Delete Booking Modal ── */}
      {showDeleteModal && (
        <DeleteConfirmModal
          resourceType="Booking"
          resourceName={b.bookingNo}
          consequences={[
            `${CONTAINERS.length} containers and all gate-in / EIR records`,
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
          totalContainers={CONTAINERS.length}
          containersWithRecordedMoves={CONTAINERS.filter(c => c.movements.some(m => m.status)).length}
          onCancel={() => setChangeOrderTypeOpen(false)}
          onConfirm={(newCode, remarks) => {
            setChangeOrderTypeOpen(false);
            setOrderTypeCode(newCode);
            toast({
              variant: 'warning',
              title: 'Order type changed',
              message: `Booking ${b.bookingNo} now uses ${newCode}. Movement templates re-seeded across ${CONTAINERS.length} containers.${remarks ? ` · Audit: ${remarks}` : ''}`,
            });
          }}
        />
      )}

      {/* ── Single-container delete confirm ── */}
      {deleteContainerId !== null && (
        <DeleteContainerModal
          container={CONTAINERS.find(c => c.id === deleteContainerId) ?? null}
          onCancel={() => setDeleteContainerId(null)}
          onConfirm={remarks => {
            const c = CONTAINERS.find(x => x.id === deleteContainerId);
            setDeleteContainerId(null);
            toast({
              variant: 'danger',
              title: 'Container deleted',
              message: `${c?.containerNo || 'Untitled container'} removed.${remarks ? ` Reason: ${remarks}` : ''}`,
            });
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
  // Build the movement chips for this container from order-type + recorded txns.
  // Order-type defines the sequence template; container.movements supplies the
  // actual transaction status, txNo, date, yard, truck.
  const mvts = useMemo(() => {
    const template = orderType?.movements ?? [];
    return template.map(t => {
      const recorded = container.movements.find(m => m.code === t.code);
      const status: 'done' | 'pending' | 'idle' =
        recorded && recorded.status ? 'done' :
        recorded ? 'pending' :
        'idle';
      return { seq: t.seq, code: t.code, name: t.name, status, recorded };
    });
  }, [orderType, container]);

  const vasCount = container.vas.length;

  return (
    <div className="gecko-table-row-expand-body">
      {/* Movements */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
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
                      {m.recorded.date && <div>{new Date(m.recorded.date).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>}
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
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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
          Container <strong style={{ fontFamily: 'var(--gecko-font-mono)' }}>{container.containerNo || 'TBA'}</strong>
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

function AddMultipleContainersModal({ onCancel, onConfirm }: {
  onCancel: () => void;
  onConfirm: (p: { count: number; size: string; type: string; mode: string; cargoCat: string }) => void;
}) {
  const [count, setCount] = useState(5);
  const [size, setSize] = useState('40');
  const [type, setType] = useState('HC');
  const [mode, setMode] = useState('CY');
  const [cargoCat, setCargoCat] = useState('GENERAL');

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.5)' }} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 'min(480px, 92vw)',
        background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 14,
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.32)', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gecko-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="plus" size={16} style={{ color: 'var(--gecko-primary-600)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Add multiple containers</div>
            <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>Containers are added with blank container numbers — fill them in as each truck arrives.</div>
          </div>
          <button onClick={onCancel} className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon"><Icon name="x" size={14} /></button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="gecko-field">
            <div className="gecko-field-label gecko-field-required">Number of containers</div>
            <input
              type="number" min="1" max="500"
              className="gecko-input"
              value={count}
              onChange={e => setCount(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
              style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}
              autoFocus
            />
            <div className="gecko-field-helper" style={{ marginTop: 4 }}>Max 500 per batch.</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="gecko-field">
              <div className="gecko-field-label">Size</div>
              <select className="gecko-select" value={size} onChange={e => setSize(e.target.value)}>
                <option value="20">20</option>
                <option value="40">40</option>
                <option value="45">45</option>
              </select>
            </div>
            <div className="gecko-field">
              <div className="gecko-field-label">Type</div>
              <select className="gecko-select" value={type} onChange={e => setType(e.target.value)}>
                <option value="GP">GP — Dry</option>
                <option value="HC">HC — High Cube</option>
                <option value="RF">RF — Reefer</option>
                <option value="OT">OT — Open Top</option>
                <option value="FR">FR — Flat Rack</option>
                <option value="TK">TK — Tank</option>
              </select>
            </div>
            <div className="gecko-field">
              <div className="gecko-field-label">Mode</div>
              <select className="gecko-select" value={mode} onChange={e => setMode(e.target.value)}>
                <option value="CY">CY</option>
                <option value="CFS">CFS</option>
                <option value="DOOR">DOOR</option>
              </select>
            </div>
            <div className="gecko-field">
              <div className="gecko-field-label">Cargo category</div>
              <select className="gecko-select" value={cargoCat} onChange={e => setCargoCat(e.target.value)}>
                <option value="GENERAL">GENERAL</option>
                <option value="HAZ">HAZ</option>
                <option value="REEFER">REEFER</option>
                <option value="OOG">OOG</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--gecko-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onCancel}>Cancel</button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => onConfirm({ count, size, type, mode, cargoCat })}>
            <Icon name="check" size={13} /> Add {count} container{count === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── VAS Drawer — single container or apply-to-many ─────────────────────── */

function VasDrawer({ mode, containerIds, availableVAS, orderTypeCode, initialSelected, onCancel, onSave }: {
  mode: 'single' | 'multi';
  containerIds: number[];
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
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gecko-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="tag" size={16} style={{ color: 'var(--gecko-primary-600)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
            <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>
              Available VAS sourced from order type <strong>{orderTypeCode}</strong>.
              {mode === 'multi' && ' Changes apply to all selected containers.'}
            </div>
          </div>
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon" onClick={onCancel}>
            <Icon name="x" size={14} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          {availableVAS.length === 0 ? (
            <div className="gecko-empty-state" style={{ padding: 36 }}>
              <Icon name="tag" size={28} className="gecko-empty-state-icon" />
              <div className="gecko-empty-state-title">No VAS defined</div>
              <div className="gecko-empty-state-description">Order type <strong>{orderTypeCode}</strong> has no VAS charges in its movement catalog.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                    <span style={{ fontSize: 10, fontFamily: 'var(--gecko-font-mono)', fontWeight: 600, color: 'var(--gecko-text-secondary)' }}>{v.paymentTo}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--gecko-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--gecko-bg-subtle)' }}>
          <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>
            <strong>{picked.size}</strong> VAS line{picked.size === 1 ? '' : 's'} selected
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 250 }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.55)' }} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 'min(520px, 92vw)',
        background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 14,
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.36)', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gecko-border)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--gecko-warning-50)' }}>
          <Icon name="alertTriangle" size={16} style={{ color: 'var(--gecko-warning-600)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Change order type?</div>
            <div style={{ fontSize: 11, color: 'var(--gecko-warning-700)', marginTop: 2 }}>
              One or more containers have recorded transactions.
            </div>
          </div>
        </div>
        <div style={{ padding: 20, fontSize: 13, color: 'var(--gecko-text-primary)', lineHeight: 1.6 }}>
          <p style={{ margin: 0 }}>
            You&apos;re switching from <strong style={{ fontFamily: 'var(--gecko-font-mono)' }}>{from}</strong> ({fromOT?.description ?? '—'}) to <strong style={{ fontFamily: 'var(--gecko-font-mono)' }}>{to}</strong> ({toOT?.description ?? '—'}).
          </p>
          <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--gecko-text-secondary)' }}>
            <li><strong>Existing transactions</strong> (FULL IN, LOAD, etc.) <em>are preserved</em>.</li>
            <li><strong>Future movements</strong> for each container will follow the new order type&apos;s template ({toOT?.movements.length ?? 0} legs).</li>
            <li><strong>VAS charges</strong> already attached stay attached; the available-VAS list will refresh to match the new order type.</li>
          </ul>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--gecko-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.5)' }} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 'min(820px, 94vw)',
        maxHeight: '88vh',
        background: 'var(--gecko-bg-surface)',
        border: '1px solid var(--gecko-border)', borderRadius: 14,
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.32)',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gecko-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="transferH" size={18} style={{ color: 'var(--gecko-primary-600)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Transfer containers</div>
            <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>
              Moving <strong>{containerCount} container{containerCount === 1 ? '' : 's'}</strong> from <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{sourceBookingNo}</span> ({sourceVessel} · {sourceVoyage}) → pick a destination booking below.
            </div>
          </div>
          <button onClick={onCancel} className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon">
            <Icon name="x" size={14} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>

          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="anchor" size={11} />
              Same vessel · voyage — top {similar.length}
              <span style={{ fontWeight: 500, color: 'var(--gecko-text-disabled)', textTransform: 'none', letterSpacing: 0 }}>
                {sourceVessel} / {sourceVoyage}
              </span>
            </div>
            {similar.length === 0 ? (
              <div style={{ padding: 12, fontSize: 11, color: 'var(--gecko-text-disabled)', fontStyle: 'italic', textAlign: 'center', background: 'var(--gecko-bg-subtle)', borderRadius: 8 }}>
                No other bookings on this vessel / voyage.
              </div>
            ) : (
              <CandidateTable items={similar} pickedId={picked} onPick={setPicked} />
            )}
          </div>

          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
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
              <div style={{ marginTop: 10 }}>
                {searchResults.length === 0 ? (
                  <div style={{ padding: 12, fontSize: 11, color: 'var(--gecko-text-disabled)', fontStyle: 'italic', textAlign: 'center', background: 'var(--gecko-bg-subtle)', borderRadius: 8 }}>
                    No bookings match <strong>&ldquo;{search}&rdquo;</strong>.
                  </div>
                ) : (
                  <CandidateTable items={searchResults} pickedId={picked} onPick={setPicked} />
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, fontSize: 12, color: 'var(--gecko-text-secondary)' }}>
            {pickedBooking ? (
              <>
                Destination: <strong style={{ fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)' }}>{pickedBooking.bookingNo}</strong>
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 250 }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.5)' }} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 'min(680px, 94vw)', maxHeight: '90vh',
        background: 'var(--gecko-bg-surface)',
        border: '1px solid var(--gecko-border)', borderRadius: 14,
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.32)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header with warning tone */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gecko-warning-200)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--gecko-warning-50)' }}>
          <Icon name="alertTriangle" size={18} style={{ color: 'var(--gecko-warning-600)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gecko-warning-700)' }}>Change order type · booking-level change</div>
            <div style={{ fontSize: 12, color: 'var(--gecko-warning-700)', marginTop: 2 }}>
              Order type is set <strong>per booking</strong> — this affects all <strong>{totalContainers} container{totalContainers === 1 ? '' : 's'}</strong> under <span style={{ fontFamily: 'var(--gecko-font-mono)' }}>{bookingNo}</span>.
            </div>
          </div>
          <button onClick={onCancel} className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon">
            <Icon name="x" size={14} />
          </button>
        </div>

        {/* Cascading-impact callout */}
        <div style={{ padding: '12px 20px', background: 'var(--gecko-bg-subtle)', borderBottom: '1px solid var(--gecko-border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>What changes</div>
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
        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Picker */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Pick a new order type ·
              <span style={{ marginLeft: 4 }}>showing <span className="gecko-pill gecko-pill-info" style={{ fontSize: 10 }}>{bookingType}</span> only</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 13, fontWeight: 800, color: isPicked ? 'var(--gecko-primary-700)' : 'var(--gecko-text-primary)' }}>{ot.code}</span>
                        {isCurrent && <span className="gecko-pill gecko-pill-neutral" style={{ fontSize: 9 }}>CURRENT</span>}
                        <span className="gecko-pill gecko-pill-info" style={{ fontSize: 9 }}>{ot.bookingMode}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>{ot.description}</div>
                      <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)', marginTop: 2, fontFamily: 'var(--gecko-font-mono)' }}>
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
            <div style={{ paddingTop: 12, borderTop: '1px dashed var(--gecko-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-warning-700)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
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
                  Doesn&apos;t match — must equal <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}>{bookingNo}</span>
                </div>
              )}

              <div className="gecko-field">
                <div className="gecko-field-label">Remarks for audit log <span style={{ fontSize: 10, color: 'var(--gecko-text-disabled)', fontWeight: 500 }}>(optional)</span></div>
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
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, fontSize: 12, color: 'var(--gecko-text-secondary)' }}>
            {!isDifferent
              ? <span style={{ color: 'var(--gecko-text-disabled)' }}>Pick a different order type to continue.</span>
              : !blMatches
                ? <span>Changing <strong style={{ fontFamily: 'var(--gecko-font-mono)' }}>{currentOrderTypeCode}</strong> → <strong style={{ fontFamily: 'var(--gecko-font-mono)' }}>{picked}</strong> · type B/L to enable.</span>
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 260 }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.55)' }} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 'min(480px, 92vw)',
        background: 'var(--gecko-bg-surface)',
        border: '1px solid var(--gecko-border)', borderRadius: 14,
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.36)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gecko-border)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--gecko-error-50)' }}>
          <Icon name="trash" size={16} style={{ color: 'var(--gecko-error-600)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gecko-error-700)' }}>Delete container</div>
            <div style={{ fontSize: 11, color: 'var(--gecko-error-700)', marginTop: 2 }}>This will permanently remove the container from the booking.</div>
          </div>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '10px 12px', background: 'var(--gecko-bg-subtle)', border: '1px solid var(--gecko-border)', borderRadius: 8, fontSize: 12 }}>
            <div style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 800, fontSize: 14 }}>
              {container.containerNo || <span style={{ color: 'var(--gecko-text-disabled)', fontStyle: 'italic' }}>TBA (no container number yet)</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 4, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <span>Size/Type: <strong style={{ fontFamily: 'var(--gecko-font-mono)' }}>{container.size}{container.type}</strong></span>
              <span>Mode: <strong>{container.containerMode}</strong></span>
              <span>Cargo: <strong>{container.cargoCategory}</strong></span>
            </div>
            {container.movements.some(m => m.status) && (
              <div style={{ marginTop: 8, padding: 8, background: 'var(--gecko-warning-50)', border: '1px solid var(--gecko-warning-200)', borderRadius: 6, fontSize: 11, color: 'var(--gecko-warning-700)', display: 'flex', gap: 6 }}>
                <Icon name="alertTriangle" size={13} style={{ flexShrink: 0, marginTop: 1 }} />
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
            <div className="gecko-field-label">Reason for deletion <span style={{ fontSize: 10, color: 'var(--gecko-text-disabled)', fontWeight: 500 }}>(audit trail)</span></div>
            <textarea
              className="gecko-textarea"
              rows={2}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="e.g. Cancelled by customer · wrong size"
            />
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--gecko-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
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
                <td style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: 'var(--gecko-primary-700)' }}>{c.bookingNo}</td>
                <td>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-text-primary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.customer}
                  </div>
                </td>
                <td style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 11, fontWeight: 600 }}>{c.agent}</td>
                <td>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{c.vessel}</div>
                  <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)', fontFamily: 'var(--gecko-font-mono)' }}>{c.voyage}</div>
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}>{c.containerCount}</td>
                <td style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 11, color: 'var(--gecko-text-secondary)', whiteSpace: 'nowrap' }}>{c.etd}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
