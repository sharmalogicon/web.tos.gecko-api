"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { EntitySearch, type EntityOption } from '@/components/ui/EntitySearch';

const ORDER_TYPES: Record<string, { code: string; label: string; desc: string; movements: string[] }[]> = {
  EXPORT: [
    { code: 'EXP CY/CY',   label: 'CY / CY',   desc: 'FCL — full container, yard to yard',                movements: ['FULL IN', 'LOAD'] },
    { code: 'EXP CY/CFS',  label: 'CY / CFS',  desc: 'FCL origin → CFS stuffing at destination',          movements: ['FULL IN', 'LOAD', 'DISCHARGE', 'STRIP'] },
    { code: 'EXP CFS/CY',  label: 'CFS / CY',  desc: 'LCL stuffed at origin CFS → FCL to destination',   movements: ['EMPTY IN', 'STUFF', 'FULL IN', 'LOAD'] },
    { code: 'EXP CFS/CFS', label: 'CFS / CFS', desc: 'LCL both ends — CFS stuffing and stripping',        movements: ['EMPTY IN', 'STUFF', 'FULL IN', 'LOAD', 'DISCHARGE', 'STRIP'] },
    { code: 'EXP DOOR/CY', label: 'DOOR / CY', desc: "Merchant haulage from shipper's premises",          movements: ['GATE-IN', 'LOAD'] },
  ],
  IMPORT: [
    { code: 'IMP CY/CY',   label: 'CY / CY',   desc: 'FCL — full container, yard to yard',                movements: ['DISCHARGE', 'FULL OUT'] },
    { code: 'IMP CY/CFS',  label: 'CY / CFS',  desc: 'FCL discharged → stripped at destination CFS',      movements: ['DISCHARGE', 'FULL IN', 'STRIP', 'EMPTY OUT'] },
    { code: 'IMP CFS/CY',  label: 'CFS / CY',  desc: 'LCL at origin CFS → FCL discharge at destination', movements: ['DISCHARGE', 'FULL OUT'] },
    { code: 'IMP CY/DOOR', label: 'CY / DOOR', desc: "CY discharge → carrier delivers to consignee",      movements: ['DISCHARGE', 'FULL OUT'] },
  ],
};

function FieldGroup({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div className="gecko-form-group">
      <label className={`gecko-label${required ? ' gecko-label-required' : ''}`}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 10.5, color: 'var(--gecko-text-disabled)', marginTop: 3 }}>{hint}</div>}
    </div>
  );
}


export default function NewBookingPage() {
  const [bookingType, setBookingType] = useState<'EXPORT' | 'IMPORT'>('EXPORT');
  const [orderType, setOrderType]     = useState('EXP CY/CY');
  const [bookingNo, setBookingNo]     = useState('');
  const [subBLNo, setSubBLNo]         = useState('');
  const [bookingDate, setBookingDate] = useState('2026-04-26');
  const [agent,   setAgent]   = useState<EntityOption | null>(null);
  const [shipper, setShipper] = useState<EntityOption | null>(null);
  const [fwd,     setFwd]     = useState<EntityOption | null>(null);
  const [showFwd, setShowFwd] = useState(false);

  const handleTypeChange = (type: 'EXPORT' | 'IMPORT') => {
    setBookingType(type);
    setOrderType(ORDER_TYPES[type][0].code);
  };

  const orderTypes   = ORDER_TYPES[bookingType];
  const selectedOT   = orderTypes.find(t => t.code === orderType) ?? orderTypes[0];
  const isLCL        = orderType.includes('CFS');
  const blLabel      = bookingType === 'IMPORT' ? 'B/L No' : 'Booking No';
  const subLabel     = bookingType === 'IMPORT' ? 'Sub-B/L No' : 'Sub-Booking No';
  const custLabel    = bookingType === 'EXPORT' ? 'Shipper' : 'Consignee';

  const canCreate = bookingNo && agent && shipper && orderType;

  return (
    <div style={{ maxWidth: 740, margin: '0 auto', paddingBottom: 60 }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <Link href="/bookings" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 8, border: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-surface)', color: 'var(--gecko-text-secondary)', textDecoration: 'none' }}>
          <Icon name="arrowLeft" size={16} />
        </Link>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>New Booking</h1>
          <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>Create the booking shell first — containers and voyage details can be added after.</div>
        </div>
      </div>

      {/* ── Step indicator ── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 28, border: '1px solid var(--gecko-border)', borderRadius: 10, overflow: 'hidden', background: 'var(--gecko-bg-surface)' }}>
        {[
          { n: 1, label: 'Booking Identity',  active: true  },
          { n: 2, label: 'Voyage & Ports',    active: false },
          { n: 3, label: 'Containers',        active: false },
          { n: 4, label: 'Cargo & Docs',      active: false },
        ].map((s, i, arr) => (
          <div key={s.n} style={{ flex: 1, padding: '12px 16px', background: s.active ? 'var(--gecko-primary-600)' : 'transparent', borderRight: i < arr.length - 1 ? '1px solid var(--gecko-border)' : 'none', display: 'flex', alignItems: 'center', gap: 10, opacity: s.active ? 1 : 0.5 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: s.active ? '#fff' : 'var(--gecko-bg-subtle)', color: s.active ? 'var(--gecko-primary-600)' : 'var(--gecko-text-disabled)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{s.n}</div>
            <span style={{ fontSize: 12, fontWeight: 600, color: s.active ? '#fff' : 'var(--gecko-text-secondary)', whiteSpace: 'nowrap' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Main form card ── */}
      <div className="gecko-card" style={{ padding: 0, overflow: 'hidden' }}>

        {/* Booking type toggle */}
        <div style={{ padding: '20px 28px', background: 'var(--gecko-bg-subtle)', borderBottom: '1px solid var(--gecko-border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gecko-text-secondary)', marginBottom: 12 }}>Booking Type</div>
          <div style={{ display: 'flex', gap: 12 }}>
            {(['EXPORT', 'IMPORT'] as const).map(t => (
              <button
                key={t}
                onClick={() => handleTypeChange(t)}
                style={{
                  flex: 1, padding: '16px 20px', borderRadius: 10, border: '2px solid',
                  borderColor: bookingType === t ? 'var(--gecko-primary-600)' : 'var(--gecko-border)',
                  background: bookingType === t ? 'var(--gecko-primary-600)' : 'var(--gecko-bg-surface)',
                  color: bookingType === t ? '#fff' : 'var(--gecko-text-secondary)',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 120ms',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon name={t === 'EXPORT' ? 'arrowRight' : 'arrowLeft'} size={20} />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.04em' }}>{t}</div>
                    <div style={{ fontSize: 11, marginTop: 2, opacity: 0.8 }}>
                      {t === 'EXPORT' ? 'Outbound — loading onto vessel' : 'Inbound — discharge from vessel'}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Order Type */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gecko-text-secondary)', marginBottom: 12 }}>Order Type — Container Mode</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {orderTypes.map(ot => (
                <button
                  key={ot.code}
                  onClick={() => { setOrderType(ot.code); setShowFwd(ot.code.includes('CFS')); }}
                  style={{
                    padding: '12px 14px', borderRadius: 8, border: '1.5px solid',
                    borderColor: orderType === ot.code ? 'var(--gecko-primary-400)' : 'var(--gecko-border)',
                    background: orderType === ot.code ? 'var(--gecko-primary-50)' : 'var(--gecko-bg-surface)',
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 100ms',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: orderType === ot.code ? 'var(--gecko-primary-700)' : 'var(--gecko-text-primary)', fontFamily: 'var(--gecko-font-mono)' }}>{ot.label}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--gecko-text-secondary)', marginTop: 3, lineHeight: 1.4 }}>{ot.desc}</div>
                </button>
              ))}
            </div>
            {/* Movement preview */}
            <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--gecko-bg-subtle)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-disabled)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Movements:</span>
              {selectedOT.movements.map((m, i) => (
                <React.Fragment key={m}>
                  <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-primary-700)', background: 'var(--gecko-primary-100)', padding: '2px 7px', borderRadius: 4 }}>{m}</span>
                  {i < selectedOT.movements.length - 1 && <Icon name="arrowRight" size={11} style={{ color: 'var(--gecko-text-disabled)' }} />}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--gecko-border)' }} />

          {/* Booking Reference */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gecko-text-secondary)', marginBottom: 12 }}>Booking Reference</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 180px', gap: 14 }}>
              <FieldGroup label={blLabel} required>
                <input className="gecko-input gecko-text-mono" placeholder="e.g. EGLV149602390729" value={bookingNo} onChange={e => setBookingNo(e.target.value)} />
              </FieldGroup>
              <FieldGroup label={subLabel}>
                <input className="gecko-input gecko-text-mono" placeholder="Optional" value={subBLNo} onChange={e => setSubBLNo(e.target.value)} />
              </FieldGroup>
              <FieldGroup label="Booking Date" required>
                <input className="gecko-input" type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)} />
              </FieldGroup>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--gecko-border)' }} />

          {/* Parties */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gecko-text-secondary)', marginBottom: 12 }}>Parties</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              <FieldGroup label="Shipping Agent / Line" required hint="Line operator — drives EDO linkage and container ownership">
                <EntitySearch
                  entityType="agent"
                  value={agent}
                  onChange={setAgent}
                  placeholder="Search agent code or line name…"
                  required
                />
              </FieldGroup>

              <FieldGroup label={custLabel} required>
                <EntitySearch
                  entityType={bookingType === 'EXPORT' ? 'shipper' : 'consignee'}
                  value={shipper}
                  onChange={setShipper}
                  placeholder={`Search ${custLabel.toLowerCase()} code or name…`}
                  required
                />
              </FieldGroup>

              {(showFwd || isLCL) && (
                <FieldGroup label="Freight Forwarder" hint="Required for LCL / CFS order types">
                  <EntitySearch
                    entityType="forwarder"
                    value={fwd}
                    onChange={setFwd}
                    placeholder="Search forwarder code or name…"
                  />
                </FieldGroup>
              )}

              {!showFwd && !isLCL && (
                <button
                  onClick={() => setShowFwd(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'none', border: '1px dashed var(--gecko-border)', borderRadius: 8, color: 'var(--gecko-text-secondary)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', width: 'fit-content' }}
                >
                  <Icon name="plus" size={13} /> Add Freight Forwarder
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px', borderTop: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)' }}>
            {canCreate
              ? <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--gecko-success-700)' }}><Icon name="checkCircle" size={14} /> Ready to create — voyage, containers and cargo added in next steps</span>
              : `Fill in Booking No${!agent ? ', Shipping Agent' : ''}${!shipper ? ` and ${custLabel}` : ''} to continue`}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/bookings" className="gecko-btn gecko-btn-outline gecko-btn-sm" style={{ textDecoration: 'none' }}>Cancel</Link>
            <Link
              href={canCreate ? '/bookings/EGLV149602390729' : '#'}
              className={`gecko-btn gecko-btn-sm ${canCreate ? 'gecko-btn-primary' : 'gecko-btn-outline'}`}
              style={{ textDecoration: 'none', opacity: canCreate ? 1 : 0.5, pointerEvents: canCreate ? 'auto' : 'none', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              Create Booking <Icon name="arrowRight" size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* Info callout */}
      <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--gecko-info-50)', border: '1px solid var(--gecko-info-200)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Icon name="info" size={15} style={{ color: 'var(--gecko-info-600)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12, color: 'var(--gecko-info-800)', lineHeight: 1.6 }}>
          <strong>Booking created immediately on save.</strong> You can safely close the browser after this step — your booking is in the system with an Order No. Add vessel details, containers, and cargo at any time before cut-off.
        </div>
      </div>
    </div>
  );
}
