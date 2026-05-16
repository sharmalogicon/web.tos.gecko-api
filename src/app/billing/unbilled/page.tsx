"use client";
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Icon } from '@/components/ui/Icon';
import { DateField } from '@/components/ui/DateField';
import { useToast } from '@/components/ui/Toast';
import { usePagination, TablePagination } from '@/components/ui/TablePagination';

/* ──────────────────────────────────────────────────────────────────────────
   Types — Booking with nested charges, mirroring the WinForms model.
   Order Details (booking-level) ↔ Charges Details (per-charge line items).
   ────────────────────────────────────────────────────────────────────────── */

type BookingType = 'IMPORT' | 'EXPORT' | 'TRANSSHIPMENT';
type PaymentTerm = 'CASH' | 'CREDIT';
type PaymentTo   = 'CUSTOMER' | 'AGENT' | 'FWD' | 'LINE' | 'HAULIER' | 'CARRIER';

interface UnbilledCharge {
  id: string;
  containerNo: string;
  size: '20' | '40' | '45';
  type: 'GP' | 'HC' | 'RF' | 'OT';
  chargeCode: string;
  description: string;
  paymentTerm: PaymentTerm;
  paymentTo: PaymentTo;
  movementCode: string;
  qty: number;
  price: number;
  isAutoLoad: boolean;
  isVAS: boolean;
}

interface UnbilledBooking {
  id: string;
  bookingBLNo: string;
  subBLNo: string;
  bookingDate: string;     // ISO
  bookingType: BookingType;
  orderType: string;       // IMP CY/CY, EXP CY/CY...
  agentCode: string;
  customerName: string;
  customerCode: string;
  vessel: string;
  voyageNo: string;
  wharf: string;
  charges: UnbilledCharge[];
}

/* ──────────────────────────────────────────────────────────────────────────
   Mock catalog + deterministic generator — produces ~80 unbilled bookings
   with realistic mixed payment terms so bulk-billing UX is exercised.
   ────────────────────────────────────────────────────────────────────────── */

const CUSTOMERS = [
  { code: 'C-00142', name: 'Thai Union Group PCL' },
  { code: 'C-00308', name: 'PTT Global Chemical' },
  { code: 'C-00412', name: 'CP Foods Co., Ltd.' },
  { code: 'C-00501', name: 'Betagro Public Co.' },
  { code: 'C-00620', name: 'Siam Cement Group (SCG)' },
  { code: 'C-00742', name: 'AEON (Thailand) Co.' },
  { code: 'C-00829', name: 'Central Retail Corporation' },
  { code: 'C-00911', name: 'Bangchak Corporation PCL' },
  { code: 'C-01007', name: 'Minor International PCL' },
  { code: 'C-01134', name: 'KCE Electronics Public Co.' },
  { code: 'C-01219', name: 'STARSUN FOOD INTERNATIONAL' },
  { code: 'C-01302', name: 'SUKSAWAD COLD STORAGE' },
  { code: 'C-01441', name: 'C.A.S. PAPER CO., LTD.' },
  { code: 'C-01568', name: 'Indorama Ventures PCL' },
  { code: 'C-01702', name: 'Charoen Pokphand Foods PCL' },
];

const AGENTS  = ['OOCL', 'HAPAG', 'MAERSK', 'ONE', 'COSCO', 'EVGRN', 'CMA', 'PIL', 'ZIM', 'MSC'];
const VESSELS = [
  { name: 'MORESBY CHIEF',  voys: ['017S', '018N', '019S'] },
  { name: 'DEAR PANEL',     voys: ['021S', '022N'] },
  { name: 'WAN HAI 333',    voys: ['023S', '024N'] },
  { name: 'EVER GIVEN',     voys: ['514E', '515W'] },
  { name: 'ONE COMMITMENT', voys: ['203N', '204S'] },
  { name: 'MSC ROBERTA',    voys: ['418E'] },
  { name: 'CMA MARCO POLO', voys: ['651S', '652N'] },
  { name: 'COSCO PRIDE',    voys: ['305E'] },
];
const WHARFS = ['LCB', 'A0', 'A2', 'B1'];

const CHARGE_CATALOG: { code: string; desc: string; paymentTo: PaymentTo; isVAS: boolean; price: number }[] = [
  { code: 'SA001-CA',  desc: 'Admission Fee',           paymentTo: 'CUSTOMER', isVAS: false, price: 250 },
  { code: 'SA001-CR',  desc: 'Admission Fee (Credit)',  paymentTo: 'AGENT',    isVAS: false, price: 220 },
  { code: 'SL001-CR',  desc: 'Lift on / Lift off (Empty)', paymentTo: 'AGENT', isVAS: false, price: 80  },
  { code: 'SL001-CA',  desc: 'Lift on / Lift off (Empty)', paymentTo: 'CUSTOMER', isVAS: false, price: 95 },
  { code: 'SL004-CR',  desc: 'Lift on Charge',          paymentTo: 'AGENT',    isVAS: false, price: 265 },
  { code: 'SL004-CA',  desc: 'Lift on Charge',          paymentTo: 'CUSTOMER', isVAS: false, price: 285 },
  { code: 'SB001-CR',  desc: 'Storage, laden',          paymentTo: 'CUSTOMER', isVAS: false, price: 420 },
  { code: 'SC001-CA',  desc: 'Handling Fee',            paymentTo: 'CUSTOMER', isVAS: false, price: 850 },
  { code: 'SE001-CR',  desc: 'EDI Fee',                 paymentTo: 'AGENT',    isVAS: false, price: 120 },
  { code: 'SC002-CA',  desc: 'Inspection Fee',          paymentTo: 'CUSTOMER', isVAS: false, price: 320 },
  { code: 'SX001-CA',  desc: 'Weighbridge',             paymentTo: 'CUSTOMER', isVAS: true,  price: 180 },
  { code: 'SE002-CA',  desc: 'Special Equipment',       paymentTo: 'CUSTOMER', isVAS: true,  price: 500 },
  { code: 'SD001-CR',  desc: 'Documentation',           paymentTo: 'FWD',      isVAS: false, price: 80  },
  { code: 'SR001-CR',  desc: 'Reefer Plug-In (per day)', paymentTo: 'CUSTOMER', isVAS: false, price: 220 },
  { code: 'SC009-CA',  desc: 'Scanning Fee',            paymentTo: 'CUSTOMER', isVAS: true,  price: 150 },
];

const MOVEMENTS = ['MTY IN', 'MTY OUT', 'FULL IN', 'FULL OUT', 'LOAD', 'DISCHARGE'];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function pad(n: number, w: number) { return String(n).padStart(w, '0'); }

function generateBookings(count: number): UnbilledBooking[] {
  const bookings: UnbilledBooking[] = [];
  // Recent days: 20-Apr-2026 to 16-May-2026
  const baseDate = new Date('2026-04-20');
  for (let i = 0; i < count; i++) {
    const h = hash(`bk-${i}`);
    const dayOffset = h % 26;
    const hour = 7 + ((h >>> 4) % 11);
    const min  = ((h >>> 8) % 60);
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + dayOffset);
    date.setHours(hour, min, 0);

    const cust    = CUSTOMERS[h % CUSTOMERS.length];
    const agent   = AGENTS[(h >>> 5) % AGENTS.length];
    const vess    = VESSELS[(h >>> 8) % VESSELS.length];
    const voyage  = vess.voys[(h >>> 11) % vess.voys.length];
    const wharf   = WHARFS[(h >>> 14) % WHARFS.length];
    const bType: BookingType =
      ((h >>> 17) % 10) < 7 ? 'IMPORT' :
      ((h >>> 17) % 10) < 9 ? 'EXPORT' :
      'TRANSSHIPMENT';
    const orderType =
      bType === 'IMPORT' ? 'IMP CY/CY' :
      bType === 'EXPORT' ? 'EXP CY/CY' :
      'TRANS-SHIP';

    const blPrefix = bType === 'IMPORT' ? 'OOLU' : bType === 'EXPORT' ? 'OOCU' : 'TSLU';
    const blNo = `${blPrefix}${(2300000000 + (h % 700000000))}`;
    const subBl = `${blPrefix}${(2300000000 + ((h >>> 3) % 700000000))}`;

    // 2 - 4 charges per booking
    const numCharges = 2 + ((h >>> 19) % 3);
    const charges: UnbilledCharge[] = [];
    const ctrLine = bType === 'EXPORT' ? 'OOCU' : 'OOLU';
    const ctrSerial = 9000000 + (h % 999999);
    const ctrSize: '20' | '40' | '45' = ((h >>> 21) % 3) === 0 ? '20' : ((h >>> 21) % 3) === 1 ? '40' : '45';
    const ctrType: 'GP' | 'HC' | 'RF' | 'OT' = ((h >>> 23) % 4) === 0 ? 'RF' :
                                                ((h >>> 23) % 4) === 1 ? 'HC' :
                                                ((h >>> 23) % 4) === 2 ? 'OT' : 'GP';
    const container = `${ctrLine}${pad(ctrSerial, 7)}`;

    for (let c = 0; c < numCharges; c++) {
      const ch = CHARGE_CATALOG[(hash(`ch-${i}-${c}`)) % CHARGE_CATALOG.length];
      const movement = MOVEMENTS[(hash(`mv-${i}-${c}`)) % MOVEMENTS.length];
      charges.push({
        id: `cg-${i}-${c}`,
        containerNo: container,
        size: ctrSize, type: ctrType,
        chargeCode: ch.code,
        description: ch.desc,
        paymentTerm: ch.code.endsWith('-CR') ? 'CREDIT' : 'CASH',
        paymentTo: ch.paymentTo,
        movementCode: movement,
        qty: 1,
        price: ch.price,
        isAutoLoad: c < 2,
        isVAS: ch.isVAS,
      });
    }

    bookings.push({
      id: `bk-${i}`,
      bookingBLNo: blNo,
      subBLNo: subBl,
      bookingDate: date.toISOString(),
      bookingType: bType,
      orderType,
      agentCode: agent,
      customerName: cust.name,
      customerCode: cust.code,
      vessel: vess.name,
      voyageNo: voyage,
      wharf,
      charges,
    });
  }
  return bookings;
}

const ALL_BOOKINGS = generateBookings(82);

/* ──────────────────────────────────────────────────────────────────────────
   Filter types — preserved from the existing implementation.
   ────────────────────────────────────────────────────────────────────────── */

interface Filters {
  agentCode:     string;
  forwarderCode: string;
  customerCode:  string;
  bookingBlNo:   string;
  vesselCode:    string;
  voyageNo:      string;
  chargeCode:    string;
  bookingType:   string;
  orderType:     string;
  movement:      string;
  paymentTerm:   string;
  startDate:     string;
  endDate:       string;
}

const BLANK: Filters = {
  agentCode: '', forwarderCode: '', customerCode: '', bookingBlNo: '',
  vesselCode: '', voyageNo: '', chargeCode: '',
  bookingType: '', orderType: '', movement: '', paymentTerm: '',
  startDate: '', endDate: '',
};

function countActive(f: Filters) {
  return Object.values(f).filter(v => v !== '').length;
}

/* ──────────────────────────────────────────────────────────────────────────
   Filter popover — preserved from prior iteration. Renders behind the
   "Filter · N" button in the page header.
   ────────────────────────────────────────────────────────────────────────── */

function UnbilledFilterPopover({
  values, onChange, onApply, onClear,
}: {
  values: Filters;
  onChange: (f: Filters) => void;
  onApply: (f: Filters) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const active  = countActive(values);

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onMouse); document.removeEventListener('keydown', onKey); };
  }, []);

  const set = (k: keyof Filters, v: string) => onChange({ ...values, [k]: v });

  const lbl: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
    textTransform: 'uppercase', color: 'var(--gecko-text-disabled)',
    marginBottom: 5,
  };

  const TInput = ({ fk, ph }: { fk: keyof Filters; ph: string }) => (
    <input
      className="gecko-filter-input-sm"
      placeholder={ph}
      value={values[fk]}
      onChange={e => set(fk, e.target.value)}
      style={{ fontFamily: 'var(--gecko-font-mono)', textTransform: 'uppercase', paddingLeft: 8, width: '100%' }}
    />
  );

  const Sel = ({ fk, opts }: { fk: keyof Filters; opts: string[] }) => (
    <select
      className={`gecko-filter-select${values[fk] ? ' gecko-filter-select-active' : ''}`}
      value={values[fk]}
      onChange={e => set(fk, e.target.value)}
      style={{ width: '100%', height: 30, fontSize: 12 }}
    >
      {opts.map(o => <option key={o} value={o === 'ALL' ? '' : o}>{o}</option>)}
    </select>
  );

  return (
    <div ref={wrapRef} className="gecko-filter-trigger" style={{ position: 'relative' }}>
      <button
        className={`gecko-btn gecko-btn-sm ${active > 0 ? 'gecko-btn-primary' : 'gecko-btn-outline'}`}
        onClick={() => setOpen(o => !o)}
      >
        <Icon name="filter" size={13} />
        {active > 0 ? `Filter · ${active}` : 'Filter'}
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={12} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 680,
          background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 10,
          boxShadow: '0 8px 28px rgba(0,0,0,0.13)', zIndex: 50, fontFamily: 'var(--gecko-font-sans)', fontSize: 12,
        }}>
          <div style={{ padding: '11px 16px 10px', borderBottom: '1px solid var(--gecko-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Filter Unbilled Services</span>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gecko-text-disabled)', padding: 2, lineHeight: 1 }}><Icon name="x" size={14} /></button>
          </div>
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div className="gecko-filter-section-label" style={{ paddingInline: 0, marginBottom: 8 }}>Entity Codes</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                <div><div style={lbl}>Agent Code</div><TInput fk="agentCode" ph="e.g. OOCL" /></div>
                <div><div style={lbl}>Forwarder Code</div><TInput fk="forwarderCode" ph="e.g. DHL" /></div>
                <div><div style={lbl}>Customer Code</div><TInput fk="customerCode" ph="e.g. C-00142" /></div>
                <div><div style={lbl}>Booking / B-L No.</div><TInput fk="bookingBlNo" ph="e.g. OOLU2321…" /></div>
              </div>
            </div>
            <div className="gecko-filter-divider" style={{ margin: 0 }} />
            <div>
              <div className="gecko-filter-section-label" style={{ paddingInline: 0, marginBottom: 8 }}>Vessel &amp; Charge</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 1fr', gap: 10 }}>
                <div><div style={lbl}>Vessel Code</div><TInput fk="vesselCode" ph="IMO / name" /></div>
                <div><div style={lbl}>Voyage No.</div><TInput fk="voyageNo" ph="017S" /></div>
                <div><div style={lbl}>Charge Code</div><TInput fk="chargeCode" ph="e.g. SL001" /></div>
              </div>
            </div>
            <div className="gecko-filter-divider" style={{ margin: 0 }} />
            <div>
              <div className="gecko-filter-section-label" style={{ paddingInline: 0, marginBottom: 8 }}>Order Criteria &amp; Date Range</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) repeat(2, 1fr)', gap: 10 }}>
                <div><div style={lbl}>Booking Type</div><Sel fk="bookingType" opts={['ALL','IMPORT','EXPORT','TRANSSHIPMENT']} /></div>
                <div><div style={lbl}>Order Type</div><Sel fk="orderType" opts={['ALL','IMP CY/CY','EXP CY/CY','TRANS-SHIP']} /></div>
                <div><div style={lbl}>Movement</div><Sel fk="movement" opts={['ALL','MTY IN','MTY OUT','FULL IN','FULL OUT','LOAD','DISCHARGE']} /></div>
                <div><div style={lbl}>Start Date</div><DateField value={values.startDate} onChange={v => set('startDate', v)} size="sm" placeholder="From" /></div>
                <div><div style={lbl}>End Date</div><DateField value={values.endDate} onChange={v => set('endDate', v)} size="sm" placeholder="To" /></div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: 10 }}>
              <div><div style={lbl}>Payment Term</div><Sel fk="paymentTerm" opts={['ALL','CASH','CREDIT']} /></div>
            </div>
          </div>
          <div className="gecko-filter-footer">
            <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }} onClick={() => onClear()} disabled={active === 0}>Clear all</button>
            <button className="gecko-btn gecko-btn-primary gecko-btn-sm" style={{ fontSize: 11 }} onClick={() => { onApply(values); setOpen(false); }}><Icon name="search" size={13} /> Search</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────────────── */

const fmtTHB = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDateShort = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const bookingTotal = (b: UnbilledBooking) => b.charges.reduce((s, c) => s + c.price * c.qty, 0);

const bookingPaymentMix = (b: UnbilledBooking): 'CASH' | 'CREDIT' | 'MIXED' => {
  const terms = new Set(b.charges.map(c => c.paymentTerm));
  if (terms.size === 1) return [...terms][0];
  return 'MIXED';
};

const BOOKING_TYPE_TONE: Record<BookingType, string> = {
  IMPORT: 'info', EXPORT: 'success', TRANSSHIPMENT: 'warning',
};

/* ──────────────────────────────────────────────────────────────────────────
   Booking row + expanded charges sub-table
   ────────────────────────────────────────────────────────────────────────── */

function BookingRow({ b, selected, expanded, onToggleSelect, onToggleExpand }: {
  b: UnbilledBooking;
  selected: boolean;
  expanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
}) {
  const total = bookingTotal(b);
  const mix = bookingPaymentMix(b);

  return (
    <>
      <tr
        onClick={onToggleExpand}
        style={{
          background: selected ? 'var(--gecko-primary-50)' : expanded ? 'var(--gecko-bg-subtle)' : 'transparent',
          cursor: 'pointer',
        }}
      >
        <td style={{ padding: '10px 12px' }}>
          <input
            type="checkbox"
            className="gecko-checkbox"
            checked={selected}
            onChange={onToggleSelect}
            onClick={e => e.stopPropagation()}
          />
        </td>
        <td style={{ padding: '10px 4px', color: 'var(--gecko-text-secondary)' }}>
          <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={14} />
        </td>
        <td style={{ padding: '10px 12px', fontFamily: 'var(--gecko-font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--gecko-primary-700)' }}>
          {b.bookingBLNo}
          {b.subBLNo !== b.bookingBLNo && (
            <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)', marginTop: 2, fontWeight: 500 }}>
              Sub-BL: {b.subBLNo}
            </div>
          )}
        </td>
        <td style={{ padding: '10px 12px', color: 'var(--gecko-text-secondary)', fontFamily: 'var(--gecko-font-mono)', fontSize: 11 }}>
          {fmtDateShort(b.bookingDate)}
        </td>
        <td style={{ padding: '10px 12px' }}>
          <span className={`gecko-pill gecko-pill-${BOOKING_TYPE_TONE[b.bookingType]}`} style={{ fontSize: 10 }}>
            {b.bookingType}
          </span>
        </td>
        <td style={{ padding: '10px 12px', fontFamily: 'var(--gecko-font-mono)', fontSize: 11, color: 'var(--gecko-text-secondary)' }}>
          {b.orderType}
        </td>
        <td style={{ padding: '10px 12px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
            {b.customerName}
          </div>
          <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)', fontFamily: 'var(--gecko-font-mono)' }}>
            {b.customerCode}
          </div>
        </td>
        <td style={{ padding: '10px 12px', fontFamily: 'var(--gecko-font-mono)', fontSize: 11, fontWeight: 600 }}>
          {b.agentCode}
        </td>
        <td style={{ padding: '10px 12px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
            {b.vessel}
          </div>
          <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)', fontFamily: 'var(--gecko-font-mono)' }}>
            {b.voyageNo} · {b.wharf}
          </div>
        </td>
        <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'var(--gecko-font-mono)', fontWeight: 600, color: 'var(--gecko-text-secondary)' }}>
          {b.charges.length}
        </td>
        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 14, fontWeight: 800, color: 'var(--gecko-text-primary)' }}>
            ฿{fmtTHB(total)}
          </div>
        </td>
        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
          {mix === 'CASH'   && <span className="gecko-pill gecko-pill-success" style={{ fontSize: 10 }}>CASH</span>}
          {mix === 'CREDIT' && <span className="gecko-pill gecko-pill-info"    style={{ fontSize: 10 }}>CREDIT</span>}
          {mix === 'MIXED'  && <span className="gecko-pill gecko-pill-warning" style={{ fontSize: 10 }}>MIXED</span>}
        </td>
      </tr>

      {expanded && (
        <tr style={{ background: 'var(--gecko-bg-subtle)' }}>
          <td colSpan={12} style={{ padding: '0 12px 16px 56px' }}>
            <div style={{
              background: 'var(--gecko-bg-surface)',
              border: '1px solid var(--gecko-border)',
              borderRadius: 8,
              overflow: 'hidden',
            }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--gecko-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="fileText" size={13} style={{ color: 'var(--gecko-primary-600)' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Charges details — {b.charges.length} line item{b.charges.length === 1 ? '' : 's'}
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: 'var(--gecko-bg-subtle)' }}>
                    <th style={cthSt}>Container No</th>
                    <th style={cthSt}>Size</th>
                    <th style={cthSt}>Type</th>
                    <th style={cthSt}>Charge Code</th>
                    <th style={cthSt}>Description</th>
                    <th style={cthSt}>Pymt Term</th>
                    <th style={cthSt}>Payment To</th>
                    <th style={cthSt}>Movement</th>
                    <th style={{ ...cthSt, textAlign: 'right' }}>Qty</th>
                    <th style={{ ...cthSt, textAlign: 'right' }}>Price</th>
                    <th style={{ ...cthSt, textAlign: 'center' }}>Auto</th>
                    <th style={{ ...cthSt, textAlign: 'center' }}>VAS</th>
                  </tr>
                </thead>
                <tbody>
                  {b.charges.map(c => (
                    <tr key={c.id} style={{ borderTop: '1px solid var(--gecko-border)' }}>
                      <td style={ctdSt}><span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }}>{c.containerNo}</span></td>
                      <td style={ctdSt}><span style={{ fontFamily: 'var(--gecko-font-mono)' }}>{c.size}</span></td>
                      <td style={ctdSt}><span style={{ fontFamily: 'var(--gecko-font-mono)' }}>{c.type}</span></td>
                      <td style={ctdSt}><span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, color: 'var(--gecko-primary-700)' }}>{c.chargeCode}</span></td>
                      <td style={ctdSt}>{c.description}</td>
                      <td style={ctdSt}>
                        <span className={`gecko-pill gecko-pill-${c.paymentTerm === 'CASH' ? 'success' : 'info'}`} style={{ fontSize: 9 }}>{c.paymentTerm}</span>
                      </td>
                      <td style={ctdSt}><span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600, fontSize: 10 }}>{c.paymentTo}</span></td>
                      <td style={ctdSt}><span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 10 }}>{c.movementCode}</span></td>
                      <td style={{ ...ctdSt, textAlign: 'right', fontFamily: 'var(--gecko-font-mono)' }}>{c.qty.toFixed(3)}</td>
                      <td style={{ ...ctdSt, textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}>{fmtTHB(c.price)}</td>
                      <td style={{ ...ctdSt, textAlign: 'center' }}>{c.isAutoLoad ? <Icon name="check" size={12} style={{ color: 'var(--gecko-success-600)' }} /> : <span style={{ color: 'var(--gecko-text-disabled)' }}>—</span>}</td>
                      <td style={{ ...ctdSt, textAlign: 'center' }}>{c.isVAS ? <Icon name="check" size={12} style={{ color: 'var(--gecko-accent-600)' }} /> : <span style={{ color: 'var(--gecko-text-disabled)' }}>—</span>}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)' }}>
                    <td colSpan={9} style={{ ...ctdSt, textAlign: 'right', fontWeight: 700 }}>Booking total</td>
                    <td style={{ ...ctdSt, textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', fontWeight: 800, fontSize: 13, color: 'var(--gecko-text-primary)' }}>฿{fmtTHB(total)}</td>
                    <td colSpan={2} />
                  </tr>
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

const cthSt: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'left',
  fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
};
const ctdSt: React.CSSProperties = {
  padding: '8px 10px', verticalAlign: 'middle',
};

/* ──────────────────────────────────────────────────────────────────────────
   Send-to-Invoice dropdown menu
   ────────────────────────────────────────────────────────────────────────── */

type SendAction =
  | { kind: 'new'; term: PaymentTerm }
  | { kind: 'existing'; term: PaymentTerm };

function SendToMenu({ disabled, onPick }: {
  disabled: boolean;
  onPick: (a: SendAction) => void;
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

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className="gecko-btn gecko-btn-primary"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <Icon name="send" size={14} />
        Send to Invoice
        <Icon name="chevronDown" size={12} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 6px)',
          width: 280,
          background: 'var(--gecko-bg-surface)',
          border: '1px solid var(--gecko-border)',
          borderRadius: 10,
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.16)',
          zIndex: 30, overflow: 'hidden',
        }}>
          <MenuSection label="Create new invoice">
            <MenuItem icon="plus" label="New Cash invoice"   sub="For pymt term = CASH"   onClick={() => { setOpen(false); onPick({ kind: 'new', term: 'CASH' }); }} />
            <MenuItem icon="plus" label="New Credit invoice" sub="For pymt term = CREDIT" onClick={() => { setOpen(false); onPick({ kind: 'new', term: 'CREDIT' }); }} />
          </MenuSection>
          <MenuSection label="Add to existing invoice">
            <MenuItem icon="link" label="Existing Cash invoice"   sub="Prompts for invoice number" onClick={() => { setOpen(false); onPick({ kind: 'existing', term: 'CASH' }); }} />
            <MenuItem icon="link" label="Existing Credit invoice" sub="Prompts for invoice number" onClick={() => { setOpen(false); onPick({ kind: 'existing', term: 'CREDIT' }); }} />
          </MenuSection>
        </div>
      )}
    </div>
  );
}

function MenuSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '6px 0', borderBottom: '1px solid var(--gecko-border)' }}>
      <div style={{ padding: '6px 14px 4px', fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-disabled)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      {children}
    </div>
  );
}

function MenuItem({ icon, label, sub, onClick }: { icon: string; label: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', padding: '8px 14px',
        background: 'transparent', border: 'none', cursor: 'pointer',
        textAlign: 'left', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', gap: 10,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--gecko-bg-subtle)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--gecko-primary-50)', color: 'var(--gecko-primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={13} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{label}</div>
        <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', marginTop: 1 }}>{sub}</div>
      </div>
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Send modals — new invoice + existing invoice
   ────────────────────────────────────────────────────────────────────────── */

function NewInvoiceModal({ open, action, count, total, onCancel, onConfirm }: {
  open: boolean;
  action: { term: PaymentTerm } | null;
  count: number;
  total: number;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState('');
  if (!open || !action) return null;
  const draftInvoiceNo = `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000 + 1000))}`;
  return (
    <ModalShell onClose={onCancel} title="Create new invoice" subtitle={`A draft ${action.term.toLowerCase()} invoice will be created with the selected bookings.`}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <ReadonlyField label="Draft invoice no." value={draftInvoiceNo} mono />
        <ReadonlyField label="Payment term" value={action.term} />
        <ReadonlyField label="Bookings included" value={String(count)} />
        <ReadonlyField label="Total (excl. VAT)" value={`฿${fmtTHB(total)}`} mono bold />
      </div>
      <div className="gecko-field">
        <div className="gecko-field-label">Cover note (optional)</div>
        <textarea
          className="gecko-textarea"
          rows={2}
          placeholder="e.g. Monthly statement attached"
          value={note}
          onChange={e => setNote(e.target.value)}
        />
      </div>
      <div style={{ marginTop: 16, padding: 10, background: 'var(--gecko-info-50)', border: '1px solid var(--gecko-info-200)', borderRadius: 8, fontSize: 11, color: 'var(--gecko-info-700)', display: 'flex', gap: 8 }}>
        <Icon name="info" size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>Only charges with <strong>payment term = {action.term}</strong> from the selected bookings will be included. Other-term charges remain unbilled.</div>
      </div>
      <ModalFooter>
        <button className="gecko-btn gecko-btn-outline" onClick={onCancel}>Cancel</button>
        <button className="gecko-btn gecko-btn-primary" onClick={() => onConfirm(note)}>
          <Icon name="check" size={14} /> Create draft invoice
        </button>
      </ModalFooter>
    </ModalShell>
  );
}

function ExistingInvoiceModal({ open, action, count, total, onCancel, onConfirm }: {
  open: boolean;
  action: { term: PaymentTerm } | null;
  count: number;
  total: number;
  onCancel: () => void;
  onConfirm: (invoiceNo: string) => void;
}) {
  const [invoiceNo, setInvoiceNo] = useState('');
  const [touched, setTouched] = useState(false);
  if (!open || !action) return null;

  const valid = /^INV-\d{4}-\d{3,5}$/i.test(invoiceNo.trim());
  return (
    <ModalShell onClose={onCancel} title="Add to existing invoice" subtitle={`Selected charges will be appended to an existing ${action.term.toLowerCase()} invoice.`}>
      <div className="gecko-field" style={{ marginBottom: 12 }}>
        <div className="gecko-field-label gecko-field-required">Invoice number</div>
        <input
          className="gecko-input"
          placeholder="INV-2026-0173"
          value={invoiceNo}
          onChange={e => { setInvoiceNo(e.target.value.toUpperCase()); setTouched(true); }}
          onBlur={() => setTouched(true)}
          style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }}
        />
        {touched && invoiceNo && !valid && (
          <div className="gecko-field-error" style={{ marginTop: 4, fontSize: 11 }}>
            Expected format: INV-YYYY-NNNN
          </div>
        )}
        <div className="gecko-field-helper" style={{ marginTop: 4 }}>
          The invoice must be in <strong>Draft</strong> state and use payment term <strong>{action.term}</strong>.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <ReadonlyField label="Payment term" value={action.term} />
        <ReadonlyField label="Bookings to add" value={String(count)} />
        <ReadonlyField label="Charges to add" value={`@ ${action.term}-only`} />
        <ReadonlyField label="Total to append" value={`฿${fmtTHB(total)}`} mono bold />
      </div>

      <ModalFooter>
        <button className="gecko-btn gecko-btn-outline" onClick={onCancel}>Cancel</button>
        <button className="gecko-btn gecko-btn-primary" onClick={() => onConfirm(invoiceNo.trim())} disabled={!valid}>
          <Icon name="link" size={14} /> Append to {invoiceNo || 'invoice'}
        </button>
      </ModalFooter>
    </ModalShell>
  );
}

function ModalShell({ children, title, subtitle, onClose }: {
  children: React.ReactNode; title: string; subtitle: string; onClose: () => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.5)' }} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 'min(560px, 92vw)',
        background: 'var(--gecko-bg-surface)',
        border: '1px solid var(--gecko-border)', borderRadius: 14,
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.32)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gecko-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="send" size={16} style={{ color: 'var(--gecko-primary-600)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{title}</div>
            <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>{subtitle}</div>
          </div>
          <button onClick={onClose} className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon">
            <Icon name="x" size={14} />
          </button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
      {children}
    </div>
  );
}

function ReadonlyField({ label, value, mono, bold }: { label: string; value: string; mono?: boolean; bold?: boolean }) {
  return (
    <div>
      <div className="gecko-field-label" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{
        padding: '8px 12px', background: 'var(--gecko-bg-subtle)',
        border: '1px solid var(--gecko-border)', borderRadius: 6,
        fontSize: 13, fontWeight: bold ? 800 : 600,
        fontFamily: mono ? 'var(--gecko-font-mono)' : 'inherit',
        color: 'var(--gecko-text-primary)',
      }}>{value}</div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────────────────────── */

export default function UnbilledPage() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<Filters>(BLANK);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<SendAction | null>(null);

  // Apply filters
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ALL_BOOKINGS.filter(b => {
      if (filters.agentCode    && !b.agentCode.toLowerCase().includes(filters.agentCode.toLowerCase())) return false;
      if (filters.customerCode && !b.customerCode.toLowerCase().includes(filters.customerCode.toLowerCase())) return false;
      if (filters.bookingBlNo  && !(b.bookingBLNo + ' ' + b.subBLNo).toLowerCase().includes(filters.bookingBlNo.toLowerCase())) return false;
      if (filters.vesselCode   && !b.vessel.toLowerCase().includes(filters.vesselCode.toLowerCase())) return false;
      if (filters.voyageNo     && !b.voyageNo.toLowerCase().includes(filters.voyageNo.toLowerCase())) return false;
      if (filters.bookingType  && b.bookingType !== filters.bookingType) return false;
      if (filters.orderType    && b.orderType !== filters.orderType) return false;
      if (filters.chargeCode   && !b.charges.some(c => c.chargeCode.toLowerCase().includes(filters.chargeCode.toLowerCase()))) return false;
      if (filters.movement     && !b.charges.some(c => c.movementCode === filters.movement)) return false;
      if (filters.paymentTerm  && !b.charges.some(c => c.paymentTerm === filters.paymentTerm)) return false;
      if (filters.startDate    && b.bookingDate.slice(0, 10) < filters.startDate) return false;
      if (filters.endDate      && b.bookingDate.slice(0, 10) > filters.endDate) return false;
      if (q) {
        const hay = `${b.bookingBLNo} ${b.subBLNo} ${b.customerName} ${b.agentCode} ${b.vessel} ${b.voyageNo}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [filters, search]);

  // Pagination
  const { page, setPage, pageSize, setPageSize, totalPages, pageItems, totalItems, startRow, endRow } =
    usePagination(filtered, 10);

  // Aggregates across full filtered set
  const filteredAggregates = useMemo(() => {
    let total = 0, cashTotal = 0, creditTotal = 0, oldest: string | null = null;
    for (const b of filtered) {
      const t = bookingTotal(b);
      total += t;
      const mix = bookingPaymentMix(b);
      if (mix === 'CASH')   cashTotal += t;
      else if (mix === 'CREDIT') creditTotal += t;
      else { cashTotal += t/2; creditTotal += t/2; } // simple split for MIXED
      if (oldest === null || b.bookingDate < oldest) oldest = b.bookingDate;
    }
    const oldestDays = oldest
      ? Math.floor((Date.now() - new Date(oldest).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    return { count: filtered.length, total, cashTotal, creditTotal, oldestDays };
  }, [filtered]);

  // Selection
  const allOnPageSelected = pageItems.length > 0 && pageItems.every(b => selectedIds.has(b.id));
  const someOnPageSelected = !allOnPageSelected && pageItems.some(b => selectedIds.has(b.id));

  const toggleSelectAllOnPage = () => {
    const next = new Set(selectedIds);
    if (allOnPageSelected) pageItems.forEach(b => next.delete(b.id));
    else pageItems.forEach(b => next.add(b.id));
    setSelectedIds(next);
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const selectAllMatching = () => {
    setSelectedIds(new Set(filtered.map(b => b.id)));
    toast({ variant: 'info', title: 'Select-all applied', message: `${filtered.length} bookings selected across all pages.` });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  };

  const selectedBookings = useMemo(
    () => ALL_BOOKINGS.filter(b => selectedIds.has(b.id)),
    [selectedIds]
  );

  // For the modal, scope the total to the target payment term only
  const selectionByTerm = (term: PaymentTerm) => {
    let total = 0, chargeCount = 0;
    for (const b of selectedBookings) {
      for (const c of b.charges) {
        if (c.paymentTerm === term) { total += c.price * c.qty; chargeCount++; }
      }
    }
    return { total, chargeCount };
  };

  const onPickAction = (a: SendAction) => setPendingAction(a);

  const confirmNew = (_note: string) => {
    if (!pendingAction) return;
    const { total, chargeCount } = selectionByTerm(pendingAction.term);
    const draftNo = `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000 + 1000))}`;
    toast({
      variant: 'success',
      title: 'Draft invoice created',
      message: `${draftNo} · ${pendingAction.term} · ฿${fmtTHB(total)} (${chargeCount} charges)`,
    });
    clearSelection();
    setPendingAction(null);
  };

  const confirmExisting = (invoiceNo: string) => {
    if (!pendingAction) return;
    const { total, chargeCount } = selectionByTerm(pendingAction.term);
    toast({
      variant: 'success',
      title: 'Appended to invoice',
      message: `${chargeCount} charges (฿${fmtTHB(total)}) added to ${invoiceNo}`,
    });
    clearSelection();
    setPendingAction(null);
  };

  // Selected metrics for toolbar
  const selectedMetrics = useMemo(() => {
    let total = 0;
    for (const b of selectedBookings) total += bookingTotal(b);
    return { count: selectedBookings.length, total };
  }, [selectedBookings]);

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 40 }}>

      {/* Page header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>Unbilled Services</h1>
            <span className="gecko-pill gecko-pill-warning" style={{ fontSize: 11 }}>
              ฿{fmtTHB(filteredAggregates.total)} pending
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>
            Completed bookings + their charges waiting to be consolidated into invoices. Bulk-select and send to a new or existing invoice.
          </div>
        </div>
        <div className="gecko-toolbar">
          <UnbilledFilterPopover
            values={filters}
            onChange={setFilters}
            onApply={f => setFilters(f)}
            onClear={() => setFilters(BLANK)}
          />
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div className="gecko-kpi-tile">
          <div className="gecko-kpi-tile-icon gecko-kpi-tile-icon-primary"><Icon name="fileText" size={16} /></div>
          <div className="gecko-kpi-tile-value">{filteredAggregates.count}</div>
          <div className="gecko-kpi-tile-label">Pending bookings</div>
        </div>
        <div className="gecko-kpi-tile">
          <div className="gecko-kpi-tile-icon gecko-kpi-tile-icon-warning"><Icon name="dollarSign" size={16} /></div>
          <div className="gecko-kpi-tile-value">฿{fmtTHB(filteredAggregates.total)}</div>
          <div className="gecko-kpi-tile-label">Total unbilled (excl. VAT)</div>
        </div>
        <div className="gecko-kpi-tile">
          <div className="gecko-kpi-tile-icon gecko-kpi-tile-icon-success"><Icon name="check" size={16} /></div>
          <div className="gecko-kpi-tile-value">฿{fmtTHB(filteredAggregates.cashTotal)}</div>
          <div className="gecko-kpi-tile-label">Cash · ฿{fmtTHB(filteredAggregates.creditTotal)} Credit</div>
        </div>
        <div className="gecko-kpi-tile">
          <div className="gecko-kpi-tile-icon gecko-kpi-tile-icon-info"><Icon name="clock" size={16} /></div>
          <div className="gecko-kpi-tile-value">{filteredAggregates.oldestDays}d</div>
          <div className="gecko-kpi-tile-label">Oldest unbilled</div>
        </div>
      </div>

      {/* Search + selection toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        padding: '10px 14px',
        background: 'var(--gecko-bg-surface)',
        border: '1px solid var(--gecko-border)',
        borderRadius: 10,
      }}>
        <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 240, maxWidth: 380 }}>
          <Icon name="search" size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-text-disabled)' }} />
          <input
            className="gecko-input gecko-input-sm"
            placeholder="Search BL, sub-BL, customer, agent, vessel…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 32, width: '100%' }}
          />
        </div>

        <div style={{ flex: 1 }} />

        {/* Selection state */}
        {selectedMetrics.count > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--gecko-text-primary)' }}>
            <span style={{ fontWeight: 700 }}>
              {selectedMetrics.count} booking{selectedMetrics.count === 1 ? '' : 's'} selected
            </span>
            <span style={{ color: 'var(--gecko-text-secondary)' }}>·</span>
            <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}>฿{fmtTHB(selectedMetrics.total)}</span>
            {filteredAggregates.count > selectedMetrics.count && (
              <button
                className="gecko-btn gecko-btn-ghost gecko-btn-sm"
                onClick={selectAllMatching}
                style={{ fontSize: 11 }}
              >
                Select all {filteredAggregates.count} matching
              </button>
            )}
            <button
              className="gecko-btn gecko-btn-ghost gecko-btn-sm"
              onClick={clearSelection}
              style={{ fontSize: 11 }}
            >
              Clear
            </button>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--gecko-text-disabled)' }}>
            Select bookings to consolidate them into an invoice
          </span>
        )}

        <SendToMenu disabled={selectedMetrics.count === 0} onPick={onPickAction} />
      </div>

      {/* Main table */}
      <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="gecko-table" style={{ fontSize: 12, minWidth: 1100 }}>
            <thead>
              <tr>
                <th style={{ width: 40, padding: '10px 12px' }}>
                  <input
                    type="checkbox"
                    className="gecko-checkbox"
                    checked={allOnPageSelected}
                    ref={el => { if (el) el.indeterminate = someOnPageSelected; }}
                    onChange={toggleSelectAllOnPage}
                  />
                </th>
                <th style={{ width: 28 }} />
                <th>Booking / B-L</th>
                <th>Date</th>
                <th>Type</th>
                <th>Order Type</th>
                <th>Customer</th>
                <th>Agent</th>
                <th>Vessel / Voyage</th>
                <th style={{ textAlign: 'center' }}># Chrgs</th>
                <th style={{ textAlign: 'right' }}>Total (THB)</th>
                <th style={{ textAlign: 'center' }}>Pymt</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={12}>
                    <div className="gecko-empty-state" style={{ padding: 36 }}>
                      <Icon name="search" size={28} className="gecko-empty-state-icon" />
                      <div className="gecko-empty-state-title">No bookings match the current filters</div>
                      <div className="gecko-empty-state-description">Try clearing filters or adjusting the date range.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                pageItems.map(b => (
                  <BookingRow
                    key={b.id}
                    b={b}
                    selected={selectedIds.has(b.id)}
                    expanded={expanded.has(b.id)}
                    onToggleSelect={() => toggleSelectOne(b.id)}
                    onToggleExpand={() => toggleExpand(b.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
          totalPages={totalPages}
          startRow={startRow}
          endRow={endRow}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          noun="bookings"
        />
      </div>

      {/* Modals */}
      <NewInvoiceModal
        open={pendingAction?.kind === 'new'}
        action={pendingAction?.kind === 'new' ? pendingAction : null}
        count={selectedMetrics.count}
        total={pendingAction?.kind === 'new' ? selectionByTerm(pendingAction.term).total : 0}
        onCancel={() => setPendingAction(null)}
        onConfirm={confirmNew}
      />
      <ExistingInvoiceModal
        open={pendingAction?.kind === 'existing'}
        action={pendingAction?.kind === 'existing' ? pendingAction : null}
        count={selectedMetrics.count}
        total={pendingAction?.kind === 'existing' ? selectionByTerm(pendingAction.term).total : 0}
        onCancel={() => setPendingAction(null)}
        onConfirm={confirmExisting}
      />
    </div>
  );
}
