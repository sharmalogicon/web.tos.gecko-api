"use client";
import React, { useState } from 'react';
import { Icon } from '../ui/Icon';

/* ──────────────────────────────────────────────────────────────────────────
   Gate-print module — three print formats, one shared data shape:

     1. A4 EIR-Out paperwork (official, archived, filed with customs)
     2. Dot-matrix gate slip (continuous form 8.5" wide; monospace)
     3. Thermal cash receipt (80mm wide; for cash collected at gate)

   Usage:
     const { openOptions, PrintHost } = useGatePrint({ ...data });
     ...
     <button onClick={openOptions}>Print</button>
     <PrintHost />

   PrintHost renders the modal + the three off-screen print templates.
   When the user picks a mode the module sets body.print-mode-X, injects
   a thermal @page rule when needed, and calls window.print(). After
   print completes the body class is cleared.
   ────────────────────────────────────────────────────────────────────────── */

export interface GatePrintCharge {
  code: string;
  desc: string;
  qty: number;
  unit?: string;          // "cont" / "TEU" / "day"
  amount: number;         // THB
}

export interface GatePrintData {
  // Document identity
  documentType: 'EIR-OUT' | 'EIR-IN';
  documentNo: string;        // e.g. GOUT-2026-05-18-001
  visitId: string;           // e.g. GIN-4429
  depotName: string;
  depotBranch: string;       // e.g. "Laem Chabang ICD · Yard A"
  printedAt: Date;
  cashierName: string;
  gateClerkName: string;

  // Parties
  customer: string;
  agent: string;
  line: string;
  haulier: string;

  // Truck
  truckPlate: string;
  trailerNo?: string;
  driverName: string;
  driverLicense: string;
  driverMobile: string;

  // Container / move
  containerNo: string;
  iso: string;
  isLaden: boolean;
  direction: 'IMPORT' | 'EXPORT' | 'EMPTY_OUT' | 'EMPTY_RETURN';
  cargoClass: 'NONE' | 'REEFER' | 'HAZ';

  bookingNo?: string;
  edoNo?: string;
  vessel?: string;
  voyage?: string;
  yardSpot?: string;

  linerSeal?: string;
  shipperSeal?: string;
  customsSeal?: string;

  tareKg: number;
  maxGrossKg: number;
  vgmKg?: number;
  cargoWeightKg?: number;
  vgmMethod?: '1' | '2';

  remarks?: string;

  // Charges (used for receipt + EIR footer)
  charges: GatePrintCharge[];
  taxRate: number;          // e.g. 0.07 for 7% VAT
}

type PrintMode = 'eir' | 'gate-slip' | 'receipt';

/* ── Print orchestrator hook ─────────────────────────────────────────────── */

export function useGatePrint(data: GatePrintData) {
  const [modalOpen, setModalOpen] = useState(false);

  const print = (mode: PrintMode) => {
    if (typeof window === 'undefined') return;
    const body = document.body;
    const cls = `print-mode-${mode}`;

    // Thermal needs a specific paper size — inject @page rule
    let injected: HTMLStyleElement | null = null;
    if (mode === 'receipt') {
      injected = document.createElement('style');
      injected.id = 'gecko-thermal-page-style';
      injected.textContent = '@page { size: 80mm auto; margin: 0; }';
      document.head.appendChild(injected);
    } else if (mode === 'gate-slip') {
      injected = document.createElement('style');
      injected.id = 'gecko-dotmatrix-page-style';
      // 8.5" wide continuous form, browser will paginate at default page length
      injected.textContent = '@page { size: 8.5in 11in; margin: 8mm; }';
      document.head.appendChild(injected);
    }

    body.classList.add(cls);
    setModalOpen(false);

    // Defer to next frame so the layout settles before print dialog opens
    window.requestAnimationFrame(() => {
      window.print();
      // Cleanup after print dialog dismisses
      window.setTimeout(() => {
        body.classList.remove(cls);
        if (injected && injected.parentNode) injected.parentNode.removeChild(injected);
      }, 200);
    });
  };

  const PrintHost = () => (
    <>
      <PrintOptionsModal open={modalOpen} onClose={() => setModalOpen(false)} onPick={print} data={data} />
      {/* Off-screen templates — rendered into DOM but hidden via .print-template CSS */}
      <div className="print-template print-template-eir">       <PrintableEIR     data={data} /></div>
      <div className="print-template print-template-gate-slip"> <PrintableGateSlip data={data} /></div>
      <div className="print-template print-template-receipt">   <PrintableReceipt data={data} /></div>
    </>
  );

  return { openOptions: () => setModalOpen(true), PrintHost, print };
}

/* ──────────────────────────────────────────────────────────────────────────
   Print Options Modal — pick the format, see a mini preview
   ────────────────────────────────────────────────────────────────────────── */

function PrintOptionsModal({ open, onClose, onPick, data }: {
  open: boolean; onClose: () => void; onPick: (mode: PrintMode) => void; data: GatePrintData;
}) {
  if (!open) return null;
  return (
    <div className="no-print" style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.5)' }} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 'min(820px, 92vw)',
        background: 'var(--gecko-bg-surface)',
        border: '1px solid var(--gecko-border)', borderRadius: 14,
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.32)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gecko-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name="print" size={18} style={{ color: 'var(--gecko-primary-600)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>Print this gate visit</div>
            <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>
              {data.documentNo} · pick the format below — the same data prints to all three
            </div>
          </div>
          <button onClick={onClose} className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon">
            <Icon name="x" size={14} />
          </button>
        </div>

        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <PrintCard
            title="A4 EIR-Out"
            badge="OFFICIAL"
            description="Full archived paperwork. For customs filing and customer copy."
            printer="Any A4 laser / inkjet printer"
            preview={
              <div className="gecko-print-preview-a4">
                <div style={{ fontWeight: 800, fontSize: 7, marginBottom: 2 }}>EQUIPMENT INTERCHANGE RECEIPT — OUT</div>
                <div style={{ fontSize: 5.5, color: '#555' }}>{data.depotName} · {data.documentNo}</div>
                <div style={{ marginTop: 4, paddingTop: 3, borderTop: '0.5px solid #aaa', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  <div><strong>Container</strong><br />{data.containerNo}</div>
                  <div><strong>ISO</strong><br />{data.iso}</div>
                  <div><strong>Truck</strong><br />{data.truckPlate}</div>
                  <div><strong>Driver</strong><br />{data.driverName.slice(0, 14)}</div>
                </div>
                <div style={{ marginTop: 3, fontSize: 5, color: '#999' }}>Seals · VGM · Charges · Signatures</div>
              </div>
            }
            onClick={() => onPick('eir')}
          />
          <PrintCard
            title="Gate Slip"
            badge="DOT-MATRIX"
            description="Pre-printed continuous form. For the gatehouse log book."
            printer="9-pin / 24-pin dot-matrix (Epson LQ, etc.)"
            preview={
              <div className="gecko-print-preview-dot">
                <div>{data.depotName.toUpperCase().slice(0, 30).padEnd(30)}</div>
                <div>GATE SLIP {data.documentNo}</div>
                <div>{'─'.repeat(36)}</div>
                <div>TRUCK    {data.truckPlate}</div>
                <div>DRIVER   {data.driverName.slice(0, 22)}</div>
                <div>CTR/ISO  {data.containerNo} {data.iso}</div>
                <div>DIR      {data.direction}</div>
                <div>LANE     {data.depotBranch.slice(0, 14)}</div>
              </div>
            }
            onClick={() => onPick('gate-slip')}
          />
          <PrintCard
            title="Cash Receipt"
            badge="80mm THERMAL"
            description="POS thermal stub. For cash payment at gate."
            printer="ESC/POS thermal (Epson TM-T, Star TSP)"
            preview={
              <div className="gecko-print-preview-thermal">
                <div style={{ textAlign: 'center', fontWeight: 800 }}>{data.depotName.split(' ').slice(0, 2).join(' ')}</div>
                <div style={{ textAlign: 'center', fontSize: 6 }}>{data.depotBranch}</div>
                <div style={{ borderTop: '1px dashed #000', marginTop: 4, paddingTop: 4 }}>
                  <div>Rcpt: {data.documentNo.slice(0, 16)}</div>
                  <div>Trk:  {data.truckPlate}</div>
                  <div>Ctr:  {data.containerNo}</div>
                </div>
                <div style={{ borderTop: '1px dashed #000', marginTop: 4, paddingTop: 4 }}>
                  {data.charges.slice(0, 2).map(c => (
                    <div key={c.code} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{c.code}</span><span>฿{c.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            }
            onClick={() => onPick('receipt')}
          />
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)', fontSize: 11, color: 'var(--gecko-text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="info" size={13} />
          The browser print dialog opens next. Pick your installed printer. Production deploys ship a 4 MB <strong>Gecko Print Agent</strong> for one-click raw thermal / dot-matrix printing without the OS dialog.
        </div>
      </div>
    </div>
  );
}

function PrintCard({ title, badge, description, printer, preview, onClick }: {
  title: string; badge: string; description: string; printer: string;
  preview: React.ReactNode; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="gecko-print-card" style={{
      display: 'flex', flexDirection: 'column', textAlign: 'left',
      padding: 14, gap: 10, cursor: 'pointer', fontFamily: 'inherit',
      background: 'var(--gecko-bg-surface)',
      border: '1.5px solid var(--gecko-border)',
      borderRadius: 12,
      transition: 'all 120ms',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--gecko-primary-500)';
        e.currentTarget.style.background = 'var(--gecko-primary-50)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--gecko-border)';
        e.currentTarget.style.background = 'var(--gecko-bg-surface)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{title}</span>
        <span className="gecko-pill gecko-pill-neutral" style={{ fontSize: 9 }}>{badge}</span>
      </div>
      <div style={{ minHeight: 130, display: 'flex', alignItems: 'flex-start' }}>
        {preview}
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', lineHeight: 1.4 }}>{description}</div>
        <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)', marginTop: 4, fontStyle: 'italic' }}>{printer}</div>
      </div>
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Format helpers
   ────────────────────────────────────────────────────────────────────────── */

const fmtTHB = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDateTime = (d: Date) =>
  d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const directionLabel = (d: GatePrintData['direction']) => ({
  IMPORT: 'IMPORT (laden in / out)',
  EXPORT: 'EXPORT (laden out)',
  EMPTY_OUT: 'EMPTY HIRE-OUT',
  EMPTY_RETURN: 'EMPTY RETURN',
}[d]);

/* ──────────────────────────────────────────────────────────────────────────
   Template 1 — A4 EIR-Out
   ────────────────────────────────────────────────────────────────────────── */

function PrintableEIR({ data }: { data: GatePrintData }) {
  const subTotal = data.charges.reduce((s, c) => s + c.amount, 0);
  const vat = subTotal * data.taxRate;
  const total = subTotal + vat;
  return (
    <div style={{ padding: '8mm', maxWidth: '210mm', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1.5pt solid #000', paddingBottom: 6 }}>
        <div>
          <div style={{ fontSize: '8pt', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Equipment Interchange Receipt</div>
          <h1>{data.documentType === 'EIR-OUT' ? 'EIR-OUT · GATE-OUT RELEASE' : 'EIR-IN · GATE-IN RECEIPT'}</h1>
          <div style={{ fontSize: '9pt' }}>{data.depotName} · {data.depotBranch}</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '9pt' }}>
          <div><strong>EIR No:</strong> <span className="mono">{data.documentNo}</span></div>
          <div><strong>Visit:</strong> <span className="mono">{data.visitId}</span></div>
          <div><strong>Printed:</strong> {fmtDateTime(data.printedAt)}</div>
        </div>
      </div>

      {/* Parties */}
      <h2>Parties</h2>
      <table>
        <tbody>
          <tr>
            <th style={{ width: '20%' }}>Customer</th>
            <td>{data.customer}</td>
            <th style={{ width: '20%' }}>Agent</th>
            <td>{data.agent}</td>
          </tr>
          <tr>
            <th>Shipping line</th>
            <td>{data.line}</td>
            <th>Haulier</th>
            <td>{data.haulier}</td>
          </tr>
          {data.vessel && (
            <tr>
              <th>Vessel · Voyage</th>
              <td>{data.vessel}{data.voyage ? ` / ${data.voyage}` : ''}</td>
              <th>Booking / EDO</th>
              <td className="mono">{data.bookingNo ?? data.edoNo ?? '—'}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Truck & driver */}
      <h2>Truck & Driver</h2>
      <table>
        <tbody>
          <tr>
            <th>Truck plate</th><td className="mono">{data.truckPlate}</td>
            <th>Trailer</th><td className="mono">{data.trailerNo ?? '—'}</td>
          </tr>
          <tr>
            <th>Driver</th><td>{data.driverName}</td>
            <th>License</th><td className="mono">{data.driverLicense}</td>
          </tr>
          <tr>
            <th>Mobile</th><td className="mono">{data.driverMobile}</td>
            <th>Gate clerk</th><td>{data.gateClerkName}</td>
          </tr>
        </tbody>
      </table>

      {/* Container */}
      <h2>Container</h2>
      <table>
        <tbody>
          <tr>
            <th>Container No.</th><td className="mono">{data.containerNo}</td>
            <th>ISO size/type</th><td className="mono">{data.iso}</td>
          </tr>
          <tr>
            <th>Direction</th><td>{directionLabel(data.direction)}</td>
            <th>Cargo class</th><td>{data.cargoClass === 'NONE' ? 'General' : data.cargoClass}</td>
          </tr>
          <tr>
            <th>Yard spot</th><td className="mono">{data.yardSpot ?? '—'}</td>
            <th>Status</th><td>{data.isLaden ? 'LADEN' : 'EMPTY'}</td>
          </tr>
          <tr>
            <th>Tare / Max-gross</th><td className="mono">{data.tareKg.toLocaleString()} / {data.maxGrossKg.toLocaleString()} kg</td>
            <th>Cargo weight</th><td className="mono">{data.cargoWeightKg ? `${data.cargoWeightKg.toLocaleString()} kg` : '—'}</td>
          </tr>
          {data.vgmKg !== undefined && (
            <tr>
              <th>VGM</th><td className="mono">{data.vgmKg.toLocaleString()} kg · Method {data.vgmMethod}</td>
              <th>Seal · Liner</th><td className="mono">{data.linerSeal ?? '—'}</td>
            </tr>
          )}
          <tr>
            <th>Seal · Shipper</th><td className="mono">{data.shipperSeal ?? '—'}</td>
            <th>Seal · Customs</th><td className="mono">{data.customsSeal ?? '—'}</td>
          </tr>
        </tbody>
      </table>

      {/* Charges */}
      {data.charges.length > 0 && (
        <>
          <h2>Charges</h2>
          <table>
            <thead>
              <tr>
                <th style={{ width: '15%' }}>Code</th>
                <th>Description</th>
                <th style={{ width: '10%', textAlign: 'right' }}>Qty</th>
                <th style={{ width: '20%', textAlign: 'right' }}>Amount (THB)</th>
              </tr>
            </thead>
            <tbody>
              {data.charges.map(c => (
                <tr key={c.code}>
                  <td className="mono">{c.code}</td>
                  <td>{c.desc}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{c.qty} {c.unit ?? ''}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{fmtTHB(c.amount)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>Subtotal</td>
                <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtTHB(subTotal)}</td>
              </tr>
              <tr>
                <td colSpan={3} style={{ textAlign: 'right' }}>VAT {(data.taxRate * 100).toFixed(0)}%</td>
                <td className="mono" style={{ textAlign: 'right' }}>{fmtTHB(vat)}</td>
              </tr>
              <tr>
                <td colSpan={3} style={{ textAlign: 'right', fontWeight: 800, fontSize: '11pt' }}>TOTAL</td>
                <td className="mono" style={{ textAlign: 'right', fontWeight: 800, fontSize: '11pt' }}>{fmtTHB(total)}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      {data.remarks && (
        <>
          <h2>Remarks</h2>
          <div style={{ fontSize: '10pt', padding: '4pt 6pt', border: '0.5pt solid #000' }}>{data.remarks}</div>
        </>
      )}

      {/* Signatures */}
      <div className="signatures">
        <div>Driver signature<br /><span style={{ fontSize: '9pt' }}>{data.driverName}</span></div>
        <div>Gate Clerk<br /><span style={{ fontSize: '9pt' }}>{data.gateClerkName}</span></div>
        <div>Cashier<br /><span style={{ fontSize: '9pt' }}>{data.cashierName}</span></div>
      </div>

      <div style={{ marginTop: 24, fontSize: '7.5pt', color: '#444', textAlign: 'center', borderTop: '0.5pt solid #999', paddingTop: 6 }}>
        This EIR is generated electronically by Gecko TOS · {fmtDateTime(data.printedAt)} · {data.depotName}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Template 2 — Dot-matrix gate slip (monospace, narrow column)
   ────────────────────────────────────────────────────────────────────────── */

function PrintableGateSlip({ data }: { data: GatePrintData }) {
  // 80-column monospace layout. Each line ≤ 80 chars.
  const W = 80;
  const pad = (s: string, n: number) => (s || '').slice(0, n).padEnd(n, ' ');
  const center = (s: string) => {
    const t = (s || '').slice(0, W);
    const space = Math.max(0, Math.floor((W - t.length) / 2));
    return ' '.repeat(space) + t;
  };
  const hr = '='.repeat(W);
  const sep = '-'.repeat(W);

  const lines: string[] = [];
  lines.push(hr);
  lines.push(center(data.depotName.toUpperCase()));
  lines.push(center(data.depotBranch));
  lines.push(center('GATE SLIP · ' + (data.documentType === 'EIR-OUT' ? 'OUTBOUND' : 'INBOUND')));
  lines.push(hr);
  lines.push(`SLIP NO   : ${pad(data.documentNo, 30)}  PRINTED  : ${fmtDateTime(data.printedAt)}`);
  lines.push(`VISIT ID  : ${pad(data.visitId, 30)}  CASHIER  : ${data.cashierName}`);
  lines.push(sep);
  lines.push(`TRUCK     : ${pad(data.truckPlate, 16)}  TRAILER  : ${pad(data.trailerNo ?? '-', 18)}`);
  lines.push(`DRIVER    : ${pad(data.driverName, 28)}  LICENSE  : ${data.driverLicense}`);
  lines.push(`HAULIER   : ${data.haulier}`);
  lines.push(`MOBILE    : ${data.driverMobile}`);
  lines.push(sep);
  lines.push(`CONTAINER : ${pad(data.containerNo, 16)}  ISO      : ${data.iso}`);
  lines.push(`DIRECTION : ${pad(directionLabel(data.direction), 32)}  STATUS : ${data.isLaden ? 'LADEN' : 'EMPTY'}`);
  lines.push(`CUSTOMER  : ${data.customer}`);
  lines.push(`AGENT/LINE: ${pad(data.agent, 28)}  LINE     : ${data.line}`);
  if (data.bookingNo) lines.push(`BOOKING   : ${data.bookingNo}`);
  if (data.edoNo)     lines.push(`EDO       : ${data.edoNo}`);
  if (data.yardSpot)  lines.push(`YARD SPOT : ${data.yardSpot}`);
  lines.push(sep);
  if (data.linerSeal || data.shipperSeal || data.customsSeal) {
    lines.push(`SEAL #1   : ${pad(data.linerSeal ?? '-', 16)}  (LINER)`);
    lines.push(`SEAL #2   : ${pad(data.shipperSeal ?? '-', 16)}  (SHIPPER)`);
    if (data.customsSeal) lines.push(`SEAL CUST : ${data.customsSeal}`);
    lines.push(sep);
  }
  lines.push(`TARE/MAX  : ${data.tareKg.toLocaleString()} / ${data.maxGrossKg.toLocaleString()} kg`);
  if (data.cargoWeightKg) lines.push(`CARGO WT  : ${data.cargoWeightKg.toLocaleString()} kg`);
  if (data.vgmKg)         lines.push(`VGM       : ${data.vgmKg.toLocaleString()} kg (method ${data.vgmMethod ?? '-'})`);
  lines.push(sep);
  if (data.charges.length > 0) {
    lines.push('CHARGES:');
    data.charges.forEach(c => {
      lines.push(`  ${pad(c.code, 10)} ${pad(c.desc, 42)} ${pad(String(c.qty), 6)} ${fmtTHB(c.amount).padStart(12)}`);
    });
    const subTotal = data.charges.reduce((s, c) => s + c.amount, 0);
    const vat = subTotal * data.taxRate;
    const total = subTotal + vat;
    lines.push(' '.repeat(62) + '-'.repeat(W - 62));
    lines.push(`  ${pad('SUB-TOTAL', 60)}${fmtTHB(subTotal).padStart(18)}`);
    lines.push(`  ${pad('VAT ' + (data.taxRate * 100).toFixed(0) + '%', 60)}${fmtTHB(vat).padStart(18)}`);
    lines.push(`  ${pad('TOTAL (THB)', 60)}${fmtTHB(total).padStart(18)}`);
    lines.push(sep);
  }
  if (data.remarks) {
    lines.push(`REMARKS   : ${data.remarks}`);
    lines.push(sep);
  }
  lines.push('');
  lines.push('Driver:  __________________________   Gate Clerk: __________________________');
  lines.push('');
  lines.push('Cashier: __________________________   Date/Time : __________________________');
  lines.push(hr);
  lines.push(center('GECKO TOS  ·  ' + fmtDateTime(data.printedAt)));

  return <pre>{lines.join('\n')}</pre>;
}

/* ──────────────────────────────────────────────────────────────────────────
   Template 3 — 80mm thermal cash receipt
   ────────────────────────────────────────────────────────────────────────── */

function PrintableReceipt({ data }: { data: GatePrintData }) {
  const subTotal = data.charges.reduce((s, c) => s + c.amount, 0);
  const vat = subTotal * data.taxRate;
  const total = subTotal + vat;
  return (
    <>
      <h1>{data.depotName.toUpperCase()}</h1>
      <div className="center small">{data.depotBranch}</div>
      <div className="center small">Tax ID: 0105560000000</div>
      <hr />
      <div className="center" style={{ fontWeight: 700 }}>CASH RECEIPT</div>
      <div className="center small">{data.documentType === 'EIR-OUT' ? 'Gate-Out · Outbound' : 'Gate-In · Inbound'}</div>
      <hr />
      <div className="row"><span>Receipt:</span><strong>{data.documentNo}</strong></div>
      <div className="row"><span>Visit:</span><span>{data.visitId}</span></div>
      <div className="row"><span>Date:</span><span>{fmtDateTime(data.printedAt)}</span></div>
      <div className="row"><span>Cashier:</span><span>{data.cashierName}</span></div>
      <hr />
      <div className="row"><span>Truck:</span><strong>{data.truckPlate}</strong></div>
      <div className="row"><span>Driver:</span><span>{data.driverName}</span></div>
      <div className="row"><span>Container:</span><strong>{data.containerNo}</strong></div>
      <div className="row"><span>ISO:</span><span>{data.iso}</span></div>
      <div className="row"><span>Direction:</span><span>{data.isLaden ? 'LADEN' : 'EMPTY'} {data.direction}</span></div>
      <hr />
      {data.charges.map(c => (
        <React.Fragment key={c.code}>
          <div className="row small"><span>{c.code} {c.desc}</span></div>
          <div className="row"><span>  {c.qty} {c.unit ?? ''}</span><span>{fmtTHB(c.amount)}</span></div>
        </React.Fragment>
      ))}
      <hr />
      <div className="row"><span>Sub-total</span><span>{fmtTHB(subTotal)}</span></div>
      <div className="row"><span>VAT {(data.taxRate * 100).toFixed(0)}%</span><span>{fmtTHB(vat)}</span></div>
      <div className="total row"><span>TOTAL</span><span>฿ {fmtTHB(total)}</span></div>
      <hr />
      <div className="center small">PAID IN CASH</div>
      <div className="center small">Customer copy</div>
      <div style={{ height: '4mm' }} />
      <div className="center small">Thank you · Drive safely</div>
      <div className="center small">{data.depotName} · {fmtDateTime(data.printedAt)}</div>
      <div style={{ height: '8mm' }} />
    </>
  );
}
