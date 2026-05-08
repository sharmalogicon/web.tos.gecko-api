"use client";
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { BarcodeScanInput, BarcodeDisplay } from '@/components/ui/BarcodeDisplay';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────

type UnitStatus =
  | 'EXPECTED' | 'IN_YARD' | 'LOADED' | 'DISCHARGED' | 'GATED_OUT' | 'CANCELLED';

interface Movement {
  code: string;
  date: string;
  yard: string;
  truck: string;
  txNo: string;
  user: string;
}

interface HoldEntry {
  code: string; reason: string; placedBy: string; placedOn: string; active: boolean;
}

interface ChargeRow {
  code: string; description: string; qty: number; rate: number; amount: number; status: 'Pending' | 'Invoiced' | 'Waived';
}

interface EdiEvent {
  ts: string; messageType: string; direction: 'IN' | 'OUT'; partner: string; status: 'Acked' | 'Error' | 'Pending';
}

interface Unit {
  containerNo: string;
  size: string; type: string; grade: string;
  line: string; isoCode: string;
  status: UnitStatus;
  bookingNo: string; orderNo: string; orderType: string;
  customer: string;
  vessel: string; voyageNo: string;
  loadPort: string; dischargePort: string;
  currentLocation: string;
  fullEmpty: 'FULL' | 'EMPTY';
  cargoCategory: string;
  weight: number;
  sealAgent: string; sealCustomer: string;
  pickupDate: string;
  movements: Movement[];
  holds: HoldEntry[];
  charges: ChargeRow[];
  ediEvents: EdiEvent[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const UNITS: Unit[] = [
  {
    containerNo: 'EGHU9213381',
    size: '40', type: 'HC', grade: 'A',
    line: 'EVERGREEN', isoCode: '45G1',
    status: 'IN_YARD',
    bookingNo: 'EGLV149602390729', orderNo: 'ESCT1260402925', orderType: 'EXP CY/CY',
    customer: 'TCL ELECTRONICS (THAILAND) CO., LTD',
    vessel: 'EVER WEB', voyageNo: '0344-022B',
    loadPort: 'SCT', dischargePort: 'SGSIN',
    currentLocation: 'SCT EXP · Block A-04 · Bay 12 · Tier 2',
    fullEmpty: 'FULL', cargoCategory: 'GENERAL',
    weight: 22480, sealAgent: 'EMCSAS5464', sealCustomer: 'ML-3091',
    pickupDate: '2026-04-23',
    movements: [
      { code: 'GATE OUT (Empty)', date: '2026-04-22T08:14', yard: 'EMC Depot', truck: 'GISCT1260412199', txNo: 'EISCT1260406239', user: 'EMC.SOMPORN' },
      { code: 'FULL IN',           date: '2026-04-24T00:31', yard: 'SCT EXP',   truck: 'GISCT1260412201', txNo: 'EISCT1260406241', user: 'GATE.WICHAI' },
      { code: 'WEIGH',             date: '2026-04-24T00:36', yard: 'SCT EXP',   truck: 'GISCT1260412201', txNo: 'EISCT1260406241', user: 'GATE.WICHAI' },
    ],
    holds: [
      { code: 'CUST', reason: 'Customs X-Ray inspection scheduled', placedBy: 'CUSTOMS', placedOn: '2026-04-24T01:12', active: true },
    ],
    charges: [
      { code: 'LIFT-IN',       description: 'Container lift-in (laden)',     qty: 1, rate: 1200, amount: 1200, status: 'Invoiced' },
      { code: 'STORAGE-CY',    description: 'CY storage (per day)',          qty: 3, rate: 380,  amount: 1140, status: 'Pending'  },
      { code: 'DOC-FEE',       description: 'Documentation fee',             qty: 1, rate: 250,  amount: 250,  status: 'Invoiced' },
    ],
    ediEvents: [
      { ts: '2026-04-23T11:26', messageType: 'COPARN', direction: 'IN',  partner: 'EMC',     status: 'Acked' },
      { ts: '2026-04-24T00:32', messageType: 'CODECO', direction: 'OUT', partner: 'EMC',     status: 'Acked' },
      { ts: '2026-04-24T00:45', messageType: 'COARRI', direction: 'OUT', partner: 'CUSTOMS', status: 'Acked' },
    ],
  },
  {
    containerNo: 'COSU4260407771',
    size: '20', type: 'GP', grade: 'A',
    line: 'COSCO', isoCode: '22G1',
    status: 'EXPECTED',
    bookingNo: 'COSU4260407771', orderNo: 'ESCT1260402480', orderType: 'EXP CY/CFS',
    customer: 'INDORAMA VENTURES PCL',
    vessel: 'COSCO SHIPPING', voyageNo: '113E',
    loadPort: 'SCT', dischargePort: 'INNSA',
    currentLocation: '— (not yet at facility)',
    fullEmpty: 'EMPTY', cargoCategory: 'POLYESTER FIBERS',
    weight: 0, sealAgent: '', sealCustomer: '',
    pickupDate: '2026-04-28',
    movements: [],
    holds: [],
    charges: [],
    ediEvents: [
      { ts: '2026-04-24T09:04', messageType: 'COPARN', direction: 'IN', partner: 'COSCO', status: 'Acked' },
    ],
  },
  {
    containerNo: 'MAEU4260419834',
    size: '40', type: 'HC', grade: 'A',
    line: 'MAERSK', isoCode: '45G1',
    status: 'GATED_OUT',
    bookingNo: 'MAEU4260419834', orderNo: 'ESCT1260402881', orderType: 'EXP CFS/CY',
    customer: 'BANGCHAK CORPORATION PCL',
    vessel: 'MSC LISBON', voyageNo: 'FE025W',
    loadPort: 'SCT', dischargePort: 'NLRTM',
    currentLocation: 'Departed · MSC LISBON · 2026-04-23',
    fullEmpty: 'FULL', cargoCategory: 'LUBRICANTS',
    weight: 21800, sealAgent: 'MSC8841199', sealCustomer: '',
    pickupDate: '2026-04-18',
    movements: [
      { code: 'GATE OUT (Empty)', date: '2026-04-17T07:30', yard: 'MSC Depot', truck: 'GISCT1260411008', txNo: 'EISCT1260403881', user: 'MSC.NIRUN' },
      { code: 'FULL IN',           date: '2026-04-19T11:14', yard: 'SCT CFS',   truck: 'GISCT1260411208', txNo: 'EISCT1260404108', user: 'GATE.SOMSAK' },
      { code: 'CFS RECEIVE',       date: '2026-04-19T11:18', yard: 'SCT CFS',   truck: 'GISCT1260411208', txNo: 'EISCT1260404108', user: 'CFS.SAKDA' },
      { code: 'STUFF',             date: '2026-04-20T14:22', yard: 'SCT CFS',   truck: '',                txNo: 'CFS-ST-3088',     user: 'CFS.SAKDA' },
      { code: 'LOAD',              date: '2026-04-23T03:17', yard: 'SCT BERTH', truck: '',                txNo: 'LOAD-MSCLIS-104', user: 'CRANE.OP-3' },
    ],
    holds: [],
    charges: [
      { code: 'LIFT-IN',     description: 'Container lift-in (laden)', qty: 1, rate: 1200, amount: 1200, status: 'Invoiced' },
      { code: 'CFS-STUFF',   description: 'CFS stuffing (per CBM)',    qty: 32, rate: 95,  amount: 3040, status: 'Invoiced' },
      { code: 'LIFT-OUT',    description: 'Container lift-out (laden)', qty: 1, rate: 1200, amount: 1200, status: 'Invoiced' },
    ],
    ediEvents: [
      { ts: '2026-04-18T10:11', messageType: 'COPARN', direction: 'IN',  partner: 'MSC',     status: 'Acked' },
      { ts: '2026-04-19T11:15', messageType: 'CODECO', direction: 'OUT', partner: 'MSC',     status: 'Acked' },
      { ts: '2026-04-23T03:18', messageType: 'COARRI', direction: 'OUT', partner: 'MSC',     status: 'Acked' },
      { ts: '2026-04-23T05:42', messageType: 'BAPLIE', direction: 'IN',  partner: 'MSC',     status: 'Acked' },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<UnitStatus, { label: string; bg: string; color: string }> = {
  EXPECTED:    { label: 'Expected',     bg: 'var(--gecko-bg-subtle)',     color: 'var(--gecko-text-secondary)' },
  IN_YARD:     { label: 'In Yard',      bg: 'var(--gecko-success-50)',    color: 'var(--gecko-success-700)'    },
  LOADED:      { label: 'Loaded',       bg: 'var(--gecko-info-50)',       color: 'var(--gecko-info-700)'       },
  DISCHARGED:  { label: 'Discharged',   bg: 'var(--gecko-info-50)',       color: 'var(--gecko-info-700)'       },
  GATED_OUT:   { label: 'Gated Out',    bg: 'var(--gecko-bg-subtle)',     color: 'var(--gecko-text-secondary)' },
  CANCELLED:   { label: 'Cancelled',    bg: 'var(--gecko-error-50)',      color: 'var(--gecko-error-700)'      },
};

function fmtDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2,'0')}-${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]}-${d.getFullYear()}`;
}

function fmtDateTime(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${fmtDate(iso)} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'identity' | 'movements' | 'holds' | 'charges' | 'edi';

export default function UnitInquiryPage() {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('identity');
  const { toast } = useToast();

  // Recent searches (mock — would persist in localStorage in real app)
  const recent = useMemo(() => UNITS.slice(0, 3).map(u => u.containerNo), []);

  const unit = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.trim().toUpperCase();
    return UNITS.find(u => u.containerNo === q || u.bookingNo === q) ?? null;
  }, [query]);

  const notFound = query.trim() !== '' && unit === null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--gecko-text-primary)', margin: 0 }}>Unit Inquiry</h1>
          <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 3 }}>
            Look up any container by number — full lifecycle, movements, holds, charges, EDI events.
          </div>
        </div>
      </div>

      {/* ── Search Card ── */}
      <div className="gecko-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gecko-text-disabled)' }}>
          Container or Booking lookup
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <BarcodeScanInput
            onScan={v => setQuery(v.toUpperCase())}
            placeholder="Scan or type container no (e.g. EGHU9213381)…"
            size="md"
            autoFocus
            style={{ flex: 1, minWidth: 320 }}
          />
          {query && (
            <button onClick={() => { setQuery(''); setActiveTab('identity'); }} className="gecko-btn gecko-btn-ghost gecko-btn-sm">
              <Icon name="x" size={13} /> Clear
            </button>
          )}
        </div>
        {!query && recent.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--gecko-text-disabled)', fontWeight: 600 }}>Recent:</span>
            {recent.map(c => (
              <button
                key={c}
                onClick={() => setQuery(c)}
                className="gecko-btn gecko-btn-ghost gecko-btn-sm"
                style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 11.5 }}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Result ── */}
      {!query && (
        <EmptyState
          icon="search"
          title="Type or scan a container number"
          description="Look up any unit by its container number or booking number. Recent searches appear above."
        />
      )}

      {notFound && (
        <EmptyState
          icon="search"
          title="No unit found"
          description={
            <>
              No container or booking matches <code className="gecko-code">{query}</code>. Check the number and try again.
            </>
          }
        />
      )}

      {unit && (
        <>
          {/* Identity Banner */}
          <div className="gecko-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', background: 'var(--gecko-primary-50)', borderBottom: '1px solid var(--gecko-border)', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-disabled)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Container</div>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)', letterSpacing: '0.02em', marginTop: 2 }}>
                  {unit.containerNo}
                </div>
              </div>
              <div style={{ height: 32, width: 1, background: 'var(--gecko-border)' }} />
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-disabled)', textTransform: 'uppercase' }}>Type</div>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', marginTop: 2 }}>
                  {unit.size}{unit.type} · ISO {unit.isoCode}
                </div>
              </div>
              <div style={{ height: 32, width: 1, background: 'var(--gecko-border)' }} />
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-disabled)', textTransform: 'uppercase' }}>Line</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{unit.line}</div>
              </div>
              <div style={{ height: 32, width: 1, background: 'var(--gecko-border)' }} />
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-disabled)', textTransform: 'uppercase' }}>Status</div>
                <span style={{ display: 'inline-block', marginTop: 2, fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: STATUS_META[unit.status].bg, color: STATUS_META[unit.status].color }}>
                  {STATUS_META[unit.status].label}
                </span>
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <Link href={`/bookings/${unit.bookingNo}`} className="gecko-btn gecko-btn-outline gecko-btn-sm" style={{ textDecoration: 'none' }}>
                  <Icon name="clipboardList" size={13} /> Open Booking
                </Link>
                <button onClick={() => window.print()} className="gecko-btn gecko-btn-ghost gecko-btn-sm">
                  <Icon name="printer" size={13} /> Print
                </button>
              </div>
            </div>

            {/* Stat strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid var(--gecko-border)' }}>
              {[
                { label: 'Booking',      val: unit.bookingNo,     mono: true, color: 'var(--gecko-primary-700)' },
                { label: 'Customer',     val: unit.customer,      mono: false },
                { label: 'Vessel · Voy', val: `${unit.vessel} · ${unit.voyageNo}`, mono: false },
                { label: 'Location',     val: unit.currentLocation, mono: false },
              ].map(s => (
                <div key={s.label} style={{ padding: '12px 18px', borderRight: '1px solid var(--gecko-border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-disabled)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: s.color ?? 'var(--gecko-text-primary)', fontFamily: s.mono ? 'var(--gecko-font-mono)' : 'inherit', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.val}
                  </div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, padding: '0 20px', borderBottom: '1px solid var(--gecko-border)' }}>
              {([
                ['identity',  'Identity',  'box'],
                ['movements', `Movements (${unit.movements.length})`, 'transferH'],
                ['holds',     `Holds (${unit.holds.filter(h => h.active).length})`, 'lock'],
                ['charges',   `Charges (${unit.charges.length})`, 'fileText'],
                ['edi',       `EDI History (${unit.ediEvents.length})`, 'zap'],
              ] as const).map(([k, label, icon]) => {
                const active = activeTab === k;
                return (
                  <button
                    key={k}
                    onClick={() => setActiveTab(k as Tab)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 7,
                      fontSize: 13, fontWeight: active ? 700 : 500,
                      color: active ? 'var(--gecko-primary-700)' : 'var(--gecko-text-secondary)',
                      borderBottom: `2px solid ${active ? 'var(--gecko-primary-600)' : 'transparent'}`,
                      marginBottom: -1,
                    }}
                  >
                    <Icon name={icon} size={14} /> {label}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div style={{ padding: 20 }}>
              {activeTab === 'identity'  && <IdentityTab unit={unit} />}
              {activeTab === 'movements' && <MovementsTab unit={unit} />}
              {activeTab === 'holds'     && <HoldsTab     unit={unit} />}
              {activeTab === 'charges'   && <ChargesTab   unit={unit} />}
              {activeTab === 'edi'       && <EdiTab       unit={unit} onResend={() => toast({ variant: 'info', title: 'EDI message queued', message: 'Message will be re-sent to partner.' })} />}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tab: Identity ────────────────────────────────────────────────────────────

function IdentityTab({ unit }: { unit: Unit }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) auto', gap: 20 }}>
      <KvBlock title="Container">
        <Kv label="Container No" value={unit.containerNo} mono />
        <Kv label="ISO Type Code" value={unit.isoCode} mono />
        <Kv label="Size · Type" value={`${unit.size}' · ${unit.type}`} />
        <Kv label="Grade" value={unit.grade} />
        <Kv label="Full / Empty" value={unit.fullEmpty} />
        <Kv label="Cargo Category" value={unit.cargoCategory} />
      </KvBlock>
      <KvBlock title="Booking">
        <Kv label="Booking No" value={unit.bookingNo} mono />
        <Kv label="Order No" value={unit.orderNo} mono />
        <Kv label="Order Type" value={unit.orderType} />
        <Kv label="Customer" value={unit.customer} />
        <Kv label="Pickup Date" value={fmtDate(unit.pickupDate)} />
      </KvBlock>
      <KvBlock title="Voyage & Cargo">
        <Kv label="Vessel" value={unit.vessel} />
        <Kv label="Voyage No" value={unit.voyageNo} mono />
        <Kv label="Load Port" value={unit.loadPort} mono />
        <Kv label="Discharge Port" value={unit.dischargePort} mono />
        <Kv label="Weight" value={unit.weight ? `${unit.weight.toLocaleString()} kg` : '—'} />
        <Kv label="Seal — Agent" value={unit.sealAgent || '—'} mono />
        <Kv label="Seal — Customer" value={unit.sealCustomer || '—'} mono />
      </KvBlock>
      <div>
        <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gecko-text-disabled)', marginBottom: 10 }}>Barcode</div>
        <BarcodeDisplay value={unit.containerNo} variant="qr" qrSize={120} showValue={false} />
      </div>
    </div>
  );
}

function KvBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gecko-text-disabled)', marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  );
}

function Kv({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: 'var(--gecko-text-disabled)', marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--gecko-text-primary)', fontFamily: mono ? 'var(--gecko-font-mono)' : 'inherit' }}>{value}</div>
    </div>
  );
}

// ─── Tab: Movements ───────────────────────────────────────────────────────────

function MovementsTab({ unit }: { unit: Unit }) {
  if (unit.movements.length === 0) {
    return <EmptyState icon="clock" title="No movements yet" description="This unit has no recorded gate-in / load / discharge events." />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {unit.movements.map((m, i) => (
        <div key={i} style={{ display: 'flex', gap: 16, padding: '14px 16px', background: 'var(--gecko-bg-subtle)', border: '1px solid var(--gecko-border)', borderRadius: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--gecko-primary-100)', color: 'var(--gecko-primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 800 }}>
            {i + 1}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{m.code}</div>
              <div style={{ fontSize: 11.5, color: 'var(--gecko-text-secondary)', fontFamily: 'var(--gecko-font-mono)' }}>{fmtDateTime(m.date)}</div>
            </div>
            <div style={{ display: 'flex', gap: 18, marginTop: 6, fontSize: 11.5, color: 'var(--gecko-text-secondary)', flexWrap: 'wrap' }}>
              <div><span style={{ color: 'var(--gecko-text-disabled)' }}>Yard:</span> <strong style={{ color: 'var(--gecko-text-primary)' }}>{m.yard || '—'}</strong></div>
              <div><span style={{ color: 'var(--gecko-text-disabled)' }}>Truck:</span> <span style={{ fontFamily: 'var(--gecko-font-mono)' }}>{m.truck || '—'}</span></div>
              <div><span style={{ color: 'var(--gecko-text-disabled)' }}>Tx No:</span> <span style={{ fontFamily: 'var(--gecko-font-mono)' }}>{m.txNo || '—'}</span></div>
              <div><span style={{ color: 'var(--gecko-text-disabled)' }}>By:</span> {m.user}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Holds ───────────────────────────────────────────────────────────────

function HoldsTab({ unit }: { unit: Unit }) {
  if (unit.holds.length === 0) {
    return <EmptyState icon="check" title="No holds" description="This unit is clear — no customs, agent, or finance holds." />;
  }
  return (
    <table className="gecko-table">
      <thead>
        <tr>
          <th style={{ width: 80 }}>Code</th>
          <th>Reason</th>
          <th style={{ width: 140 }}>Placed By</th>
          <th style={{ width: 160 }}>Placed On</th>
          <th style={{ width: 80 }}>Status</th>
        </tr>
      </thead>
      <tbody>
        {unit.holds.map((h, i) => (
          <tr key={i}>
            <td><span className="gecko-badge gecko-badge-warning gecko-text-mono">{h.code}</span></td>
            <td>{h.reason}</td>
            <td>{h.placedBy}</td>
            <td className="gecko-text-mono" style={{ fontSize: 12 }}>{fmtDateTime(h.placedOn)}</td>
            <td>
              <span className={`gecko-badge ${h.active ? 'gecko-badge-error' : 'gecko-badge-gray'}`}>
                {h.active ? 'Active' : 'Released'}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Tab: Charges ─────────────────────────────────────────────────────────────

function ChargesTab({ unit }: { unit: Unit }) {
  if (unit.charges.length === 0) {
    return <EmptyState icon="fileText" title="No charges" description="This unit has not yet accrued any billing charges." />;
  }
  const total = unit.charges.reduce((s, c) => s + c.amount, 0);
  return (
    <>
      <table className="gecko-table">
        <thead>
          <tr>
            <th style={{ width: 130 }}>Charge Code</th>
            <th>Description</th>
            <th style={{ width: 60, textAlign: 'right' }}>Qty</th>
            <th style={{ width: 100, textAlign: 'right' }}>Rate</th>
            <th style={{ width: 110, textAlign: 'right' }}>Amount</th>
            <th style={{ width: 90 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {unit.charges.map((c, i) => (
            <tr key={i}>
              <td className="gecko-text-mono" style={{ fontWeight: 600 }}>{c.code}</td>
              <td>{c.description}</td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)' }}>{c.qty}</td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)' }}>{c.rate.toLocaleString()}</td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}>{c.amount.toLocaleString()}</td>
              <td>
                <span className={`gecko-badge ${c.status === 'Invoiced' ? 'gecko-badge-success' : c.status === 'Pending' ? 'gecko-badge-warning' : 'gecko-badge-gray'}`}>
                  {c.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700, padding: '10px 12px' }}>Total</td>
            <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', fontWeight: 800, fontSize: 14, color: 'var(--gecko-primary-700)' }}>{total.toLocaleString()}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </>
  );
}

// ─── Tab: EDI ─────────────────────────────────────────────────────────────────

function EdiTab({ unit, onResend }: { unit: Unit; onResend: () => void }) {
  if (unit.ediEvents.length === 0) {
    return <EmptyState icon="zap" title="No EDI events" description="No EDIFACT messages have been exchanged for this unit." />;
  }
  return (
    <table className="gecko-table">
      <thead>
        <tr>
          <th style={{ width: 160 }}>Timestamp</th>
          <th style={{ width: 100 }}>Type</th>
          <th style={{ width: 80 }}>Direction</th>
          <th>Partner</th>
          <th style={{ width: 100 }}>Status</th>
          <th style={{ width: 80 }}></th>
        </tr>
      </thead>
      <tbody>
        {unit.ediEvents.map((e, i) => (
          <tr key={i}>
            <td className="gecko-text-mono" style={{ fontSize: 12 }}>{fmtDateTime(e.ts)}</td>
            <td><span className="gecko-badge gecko-badge-info gecko-text-mono">{e.messageType}</span></td>
            <td>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: e.direction === 'IN' ? 'var(--gecko-info-50)' : 'var(--gecko-primary-50)', color: e.direction === 'IN' ? 'var(--gecko-info-700)' : 'var(--gecko-primary-700)' }}>
                {e.direction === 'IN' ? '↓ IN' : '↑ OUT'}
              </span>
            </td>
            <td className="gecko-text-mono">{e.partner}</td>
            <td>
              <span className={`gecko-badge ${e.status === 'Acked' ? 'gecko-badge-success' : e.status === 'Error' ? 'gecko-badge-error' : 'gecko-badge-warning'}`}>
                {e.status}
              </span>
            </td>
            <td>
              <button onClick={onResend} className="gecko-btn gecko-btn-ghost gecko-btn-sm" style={{ fontSize: 11 }}>
                <Icon name="refreshCcw" size={11} /> Resend
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
