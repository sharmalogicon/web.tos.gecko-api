"use client";
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { EntitySearch, type EntityOption } from '@/components/ui/EntitySearch';
import { BarcodeDisplay } from '@/components/ui/BarcodeDisplay';
import { DateField } from '@/components/ui/DateField';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import { useToast } from '@/components/ui/Toast';

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
  const isReefer = ['RF', 'RE', 'HR', 'RH'].includes(form.type);
  const isDG     = form.imoClass !== null && form.imoClass !== '';

  const set = (k: keyof Container, v: unknown) => setForm(prev => ({ ...prev, [k]: v }));

  const completedMoves = form.movements.filter(m => m.status).length;
  const totalMoves     = form.movements.length;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 45, backdropFilter: 'blur(1px)' }} />

      {/* Drawer */}
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 440, zIndex: 50, background: 'var(--gecko-bg-surface)', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflowY: 'hidden' }}>

        {/* Drawer header */}
        <div style={{ padding: '16px 20px', background: 'var(--gecko-primary-600)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: 'var(--gecko-font-mono)', letterSpacing: '0.04em' }}>{form.containerNo || <span style={{ opacity: 0.5, fontSize: 14 }}>TBA</span>}</div>
              <div style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 700 }}>{form.size}{form.type}</div>
              <div style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 600 }}>{form.containerMode}</div>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#fff', padding: '5px 7px', display: 'flex' }}>
              <Icon name="x" size={16} />
            </button>
          </div>
          {/* Movement progress bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(completedMoves / totalMoves) * 100}%`, background: '#fff', borderRadius: 2, transition: 'width 300ms' }} />
            </div>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: 600, whiteSpace: 'nowrap' }}>{completedMoves}/{totalMoves} movements</span>
          </div>
        </div>

        {/* Drawer body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>

          {/* ── Identity ── */}
          <div style={{ paddingTop: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gecko-text-disabled)', marginBottom: 14 }}>Identity</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="gecko-form-group" style={{ gridColumn: '1/-1' }}>
                <label className="gecko-label">Container No <span style={{ fontSize: 10, color: 'var(--gecko-text-disabled)' }}>(leave blank if not yet nominated)</span></label>
                <input className="gecko-input gecko-text-mono" value={form.containerNo} onChange={e => set('containerNo', e.target.value)} placeholder="e.g. EITU9845677" />
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label gecko-label-required">Size</label>
                <select className="gecko-input" value={form.size} onChange={e => set('size', e.target.value)}>
                  {['20', '40', '45'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label gecko-label-required">Type</label>
                <select className="gecko-input" value={form.type} onChange={e => set('type', e.target.value)}>
                  {['GP', 'HC', 'RF', 'RE', 'HR', 'OT', 'FR', 'TK', 'PL'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label gecko-label-required">Grade</label>
                <select className="gecko-input" value={form.grade} onChange={e => set('grade', e.target.value)}>
                  {['NONE', 'A', 'B', 'C'].map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label gecko-label-required">Cargo Category</label>
                <select className="gecko-input" value={form.cargoCategory} onChange={e => set('cargoCategory', e.target.value)}>
                  {['GENERAL', 'DG', 'REEFER', 'OOG', 'BREAKBULK', 'VEHICLE', 'EMPTY'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              <div className="gecko-form-group">
                <label className="gecko-label gecko-label-required">Container Mode</label>
                <select className="gecko-input" value={form.containerMode} onChange={e => set('containerMode', e.target.value)}>
                  <option value="CY">CY — Container Yard</option>
                  <option value="CFS">CFS — Freight Station</option>
                  <option value="DOOR">DOOR — Shipper/Consignee</option>
                  <option value="RAMP">RAMP — Rail Ramp</option>
                </select>
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">Haulage Type</label>
                <select className="gecko-input" value={form.haulage} onChange={e => set('haulage', e.target.value)}>
                  <option value="MERCHANT">Merchant — customer arranges</option>
                  <option value="CARRIER">Carrier — line arranges</option>
                </select>
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label gecko-label-required">Pickup Date</label>
                <DateField value={form.pickupDate} onChange={v => set('pickupDate', v)} />
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">Stowage</label>
                <select className="gecko-input" value={form.stowage}>
                  {[0, 1, 2, 3].map(n => <option key={n}>{n}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ── Seals ── */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px dashed var(--gecko-border)' }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gecko-text-disabled)', marginBottom: 12 }}>Seals</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="gecko-form-group">
                <label className="gecko-label">Agent Seal</label>
                <input className="gecko-input gecko-text-mono" value={form.sealAgent} onChange={e => set('sealAgent', e.target.value)} placeholder="e.g. EMCSAS7084" />
              </div>
              <div className="gecko-form-group">
                <label className="gecko-label">Customer Seal</label>
                <input className="gecko-input gecko-text-mono" value={form.sealCustomer} onChange={e => set('sealCustomer', e.target.value)} placeholder="Optional" />
              </div>
            </div>
          </div>

          {/* ── Reefer (conditional) ── */}
          {isReefer && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px dashed var(--gecko-border)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gecko-info-600)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="thermometer" size={12} style={{ color: 'var(--gecko-info-600)' }} /> Reefer Parameters
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr 80px', gap: 10 }}>
                <div className="gecko-form-group">
                  <label className="gecko-label">Temperature</label>
                  <input className="gecko-input gecko-text-mono" type="number" value={form.temperature ?? ''} onChange={e => set('temperature', parseFloat(e.target.value))} />
                </div>
                <div className="gecko-form-group">
                  <label className="gecko-label">Unit</label>
                  <select className="gecko-input" value={form.temperatureMode ?? 'CEL'} onChange={e => set('temperatureMode', e.target.value)}>
                    <option>CEL</option><option>FAH</option>
                  </select>
                </div>
                <div className="gecko-form-group">
                  <label className="gecko-label">Ventilation</label>
                  <input className="gecko-input gecko-text-mono" type="number" value={form.vent ?? ''} onChange={e => set('vent', parseFloat(e.target.value))} />
                </div>
                <div className="gecko-form-group">
                  <label className="gecko-label">Unit</label>
                  <select className="gecko-input" value={form.ventMode ?? 'CBM'} onChange={e => set('ventMode', e.target.value)}>
                    <option>CBM</option><option>CFH</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
                <div className="gecko-form-group">
                  <label className="gecko-label">Humidity (%)</label>
                  <input className="gecko-input gecko-text-mono" type="number" value={form.humidity ?? ''} onChange={e => set('humidity', parseFloat(e.target.value))} />
                </div>
                <div className="gecko-form-group">
                  <label className="gecko-label">Pre-Cool</label>
                  <input className="gecko-input" value={form.preCool} onChange={e => set('preCool', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* ── DG (conditional) ── */}
          {(form.cargoCategory === 'DG') && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px dashed var(--gecko-border)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gecko-warning-600)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="warning" size={12} style={{ color: 'var(--gecko-warning-600)' }} /> Hazardous Cargo
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="gecko-form-group">
                  <label className="gecko-label">IMO Hazard Class</label>
                  <select className="gecko-input" value={form.imoClass ?? ''} onChange={e => set('imoClass', e.target.value)}>
                    <option value="">Select…</option>
                    {['1','2','3','4','5','6','7','8','9'].map(c => <option key={c}>Class {c}</option>)}
                  </select>
                </div>
                <div className="gecko-form-group">
                  <label className="gecko-label">UN Number</label>
                  <input className="gecko-input gecko-text-mono" value={form.unNo} onChange={e => set('unNo', e.target.value)} placeholder="e.g. UN1234" />
                </div>
              </div>
            </div>
          )}

          {/* ── Movements (auto, read-only) ── */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px dashed var(--gecko-border)' }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gecko-text-disabled)', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Movements</span>
              <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--gecko-text-disabled)', textTransform: 'none', letterSpacing: 0 }}>Auto-generated from order type · read-only</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {form.movements.map((mv, i) => (
                <div key={mv.code} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  {/* Timeline connector */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 3 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: mv.status ? 'var(--gecko-success-100)' : 'var(--gecko-bg-subtle)', border: `2px solid ${mv.status ? 'var(--gecko-success-500)' : 'var(--gecko-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: mv.status ? 'var(--gecko-success-600)' : 'var(--gecko-text-disabled)' }}>
                      <Icon name={mv.status ? 'check' : 'clock'} size={11} stroke={2.5} />
                    </div>
                    {i < form.movements.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 24, background: mv.status ? 'var(--gecko-success-200)' : 'var(--gecko-border)' }} />}
                  </div>
                  {/* Movement detail */}
                  <div style={{ flex: 1, paddingBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: mv.status ? 'var(--gecko-success-700)' : 'var(--gecko-text-secondary)', fontFamily: 'var(--gecko-font-mono)' }}>{mv.code}</span>
                      {mv.status && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: 'var(--gecko-success-100)', color: 'var(--gecko-success-700)', fontWeight: 700 }}>DONE</span>}
                    </div>
                    {mv.status && mv.txNo && (
                      <div style={{ marginTop: 4, padding: '8px 10px', background: 'var(--gecko-bg-subtle)', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10.5, color: 'var(--gecko-text-secondary)' }}><span style={{ color: 'var(--gecko-text-disabled)' }}>Tx:</span> <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }}>{mv.txNo}</span></span>
                          <span style={{ fontSize: 10.5, color: 'var(--gecko-text-secondary)' }}><span style={{ color: 'var(--gecko-text-disabled)' }}>Date:</span> {new Date(mv.date).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}</span>
                        </div>
                        {mv.yard && <span style={{ fontSize: 10.5, color: 'var(--gecko-text-secondary)' }}><span style={{ color: 'var(--gecko-text-disabled)' }}>Yard:</span> {mv.yard} &nbsp;·&nbsp; <span style={{ color: 'var(--gecko-text-disabled)' }}>Truck:</span> <span style={{ fontFamily: 'var(--gecko-font-mono)' }}>{mv.truck}</span></span>}
                      </div>
                    )}
                    {!mv.status && <div style={{ fontSize: 10.5, color: 'var(--gecko-text-disabled)', marginTop: 2 }}>Pending</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── VAS Charges ── */}
          <div style={{ marginTop: 4, paddingTop: 16, borderTop: '1px dashed var(--gecko-border)' }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gecko-text-disabled)', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>VAS Charges</span>
              <button style={{ background: 'none', border: '1px solid var(--gecko-border)', borderRadius: 5, padding: '2px 8px', fontSize: 11, color: 'var(--gecko-primary-600)', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Icon name="plus" size={11} /> Add VAS
              </button>
            </div>
            {form.vas.length === 0
              ? <div style={{ padding: '12px 0', textAlign: 'center', fontSize: 11, color: 'var(--gecko-text-disabled)' }}>No VAS charges on this container</div>
              : <table className="gecko-table" style={{ fontSize: 11 }}>
                  <thead><tr><th>Code</th><th>Term</th><th>To</th><th style={{ textAlign: 'right' }}>Qty</th><th></th></tr></thead>
                  <tbody>{form.vas.map(v => <tr key={v.id}><td style={{ fontFamily: 'var(--gecko-font-mono)' }}>{v.chargeCode}</td><td>{v.paymentTerm}</td><td>{v.paymentTo}</td><td style={{ textAlign: 'right' }}>{v.qty}</td><td><button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gecko-danger-500)', padding: 2 }}><Icon name="trash" size={12} /></button></td></tr>)}</tbody>
                </table>
            }
          </div>

          {/* ── Remarks ── */}
          <div className="gecko-form-group" style={{ marginTop: 16 }}>
            <label className="gecko-label">Remarks</label>
            <textarea className="gecko-input" rows={2} value={form.remarks} onChange={e => set('remarks', e.target.value)} style={{ resize: 'vertical', minHeight: 60 }} />
          </div>
        </div>

        {/* Drawer footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)', flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={onDuplicate} className="gecko-btn gecko-btn-ghost gecko-btn-sm" style={{ color: 'var(--gecko-text-secondary)' }}><Icon name="copy" size={13} /> Duplicate</button>
          <button onClick={onDelete}    className="gecko-btn gecko-btn-ghost gecko-btn-sm" style={{ color: 'var(--gecko-danger-600)' }}><Icon name="trash" size={13} /> Delete</button>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} className="gecko-btn gecko-btn-outline gecko-btn-sm">Cancel</button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm"><Icon name="save" size={13} /> Save Container</button>
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

function TabContainers({ onSelectContainer }: { onSelectContainer: (c: Container) => void }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');

  const filtered = CONTAINERS.filter(c =>
    !search || c.containerNo.toLowerCase().includes(search.toLowerCase())
  );

  const toggleAll = (checked: boolean) =>
    setSelected(checked ? new Set(filtered.map(c => c.id)) : new Set());

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
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {selected.size > 0 && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 10px', background: 'var(--gecko-primary-50)', border: '1px solid var(--gecko-primary-200)', borderRadius: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-primary-700)' }}>{selected.size} selected</span>
              <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" style={{ padding: '2px 8px', fontSize: 11 }}><Icon name="transferH" size={12} /> Transfer</button>
              <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" style={{ padding: '2px 8px', fontSize: 11, color: 'var(--gecko-danger-600)' }}><Icon name="trash" size={12} /> Delete</button>
            </div>
          )}
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm"><Icon name="plus" size={13} /> Add Container</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ border: '1px solid var(--gecko-border)', borderRadius: 10, overflow: 'hidden' }}>
        <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 12.5 }}>
          <thead>
            <tr>
              <th style={{ width: 36 }}><input type="checkbox" onChange={e => toggleAll(e.target.checked)} /></th>
              <th style={{ width: 30 }}>#</th>
              <th style={{ width: 148 }}>Container No</th>
              <th style={{ width: 72 }}>Size/Type</th>
              <th style={{ width: 60 }}>Mode</th>
              <th style={{ width: 90 }}>Cargo Cat</th>
              <th style={{ width: 100 }}>Status</th>
              <th style={{ width: 120 }}>Agent Seal</th>
              <th style={{ width: 88 }}>Pickup Date</th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const st  = containerStatus(c);
              const ss  = STATUS_STYLE[st];
              const sel = selected.has(c.id);
              return (
                <tr
                  key={c.id}
                  onClick={() => onSelectContainer(c)}
                  style={{ cursor: 'pointer', background: sel ? 'var(--gecko-primary-50)' : undefined }}
                >
                  <td onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={sel} onChange={e => {
                      const next = new Set(selected);
                      e.target.checked ? next.add(c.id) : next.delete(c.id);
                      setSelected(next);
                    }} />
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
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gecko-danger-400)', padding: '3px 5px', borderRadius: 4 }} title="Delete"><Icon name="trash" size={13} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>Showing {filtered.length} of {CONTAINERS.length} containers</span>
        <span style={{ color: 'var(--gecko-text-disabled)' }}>·</span>
        <span>Click any row to view / edit details</span>
      </div>
    </div>
  );
}

function TabCargo() {
  const c = BOOKING.cargo;
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
        <button className="gecko-btn gecko-btn-primary gecko-btn-sm"><Icon name="save" size={13} /> Save Cargo Details</button>
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
  const { toast } = useToast();

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
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: 'var(--gecko-bg-subtle)', color: 'var(--gecko-text-secondary)', border: '1px solid var(--gecko-border)' }}>{b.orderType}</span>

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
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm"><Icon name="print" size={13} /> Print</button>
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" style={{ color: 'var(--gecko-info-600)' }}><Icon name="fileText" size={13} /> Billing Statement</button>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm"><Icon name="copy" size={13} /> Clone</button>

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
                    { icon: 'transferH', label: 'Transfer to New Order',      color: 'var(--gecko-text-primary)'   },
                    { icon: 'transferH', label: 'Transfer to Existing Order',  color: 'var(--gecko-text-primary)'   },
                    { icon: 'edit',      label: 'Change Order Type',           color: 'var(--gecko-text-primary)'   },
                    { icon: 'trash',     label: 'Delete Booking',              color: 'var(--gecko-danger-600)'     },
                  ].map(item => (
                    <button key={item.label} onClick={() => { setMoreOpen(false); if (item.label === 'Delete Booking') setShowDeleteModal(true); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', color: item.color, fontSize: 13, fontFamily: 'inherit', textAlign: 'left' }}>
                      <Icon name={item.icon} size={14} style={{ color: item.color }} /> {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button className="gecko-btn gecko-btn-primary gecko-btn-sm"><Icon name="save" size={13} /> Save</button>
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
            {activeTab === 'containers' && <TabContainers onSelectContainer={c => setDrawerContainer(c)} />}
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
                { icon: 'plus',       label: 'Add Container',           action: () => setActiveTab('containers') },
                { icon: 'transferH',  label: 'Transfer Containers',      action: () => {} },
                { icon: 'edit',       label: 'Change Order Type',        action: () => {} },
                { icon: 'fileText',   label: 'View Billing Statement',   action: () => {} },
                { icon: 'print',      label: 'Print Booking Advice',     action: () => {} },
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
    </div>
  );
}
