"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { DateField } from '@/components/ui/DateField';

// ─── Mock data ────────────────────────────────────────────────────────────────

const UNBILLED_CUSTOMERS = [
  { id: 'C-00142', name: 'Thai Union Group',   totalUnbilled: '฿12,450', soCount: 14, oldest: '4 days ago' },
  { id: 'C-00308', name: 'PTT Global Chemical', totalUnbilled: '฿8,200',  soCount: 6,  oldest: 'Yesterday'  },
  { id: 'C-00412', name: 'CP Foods Co.',        totalUnbilled: '฿3,140',  soCount: 3,  oldest: 'Today'      },
  { id: 'C-00501', name: 'Betagro Public Co.',  totalUnbilled: '฿1,850',  soCount: 2,  oldest: 'Today'      },
];

const UNBILLED_SOS = [
  { id: 'SO-2026-0881', unit: 'MSKU 744218-3', type: '20GP', code: 'STORAGE-L', desc: 'Storage, laden (4 days)',  amount: 320,  date: 'Apr 24 14:30' },
  { id: 'SO-2026-0882', unit: 'MSKU 744218-3', type: '20GP', code: 'LIFT-ON',   desc: 'Container lift-on',       amount: 850,  date: 'Apr 24 14:30' },
  { id: 'SO-2026-0873', unit: 'OOLU 551928-1', type: '40HC', code: 'STORAGE-L', desc: 'Storage, laden (8 days)',  amount: 1640, date: 'Apr 23 11:00' },
  { id: 'SO-2026-0874', unit: 'OOLU 551928-1', type: '40HC', code: 'LIFT-ON',   desc: 'Container lift-on',       amount: 850,  date: 'Apr 23 11:00' },
  { id: 'SO-2026-0840', unit: 'MSKU 119283-4', type: '20GP', code: 'GATE-IN',   desc: 'Gate entry processing',   amount: 120,  date: 'Apr 21 09:15' },
];

// ─── Filter state ─────────────────────────────────────────────────────────────

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

// ─── Wide Filter Popover ──────────────────────────────────────────────────────

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

  // Shared mini label style inside the panel
  const lbl: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
    textTransform: 'uppercase', color: 'var(--gecko-text-disabled)',
    marginBottom: 5,
  };

  // Text input (code lookups)
  const TInput = ({ fk, ph }: { fk: keyof Filters; ph: string }) => (
    <input
      className="gecko-filter-input-sm"
      placeholder={ph}
      value={values[fk]}
      onChange={e => set(fk, e.target.value)}
      style={{ fontFamily: 'var(--gecko-font-mono)', textTransform: 'uppercase', paddingLeft: 8, width: '100%' }}
    />
  );

  // Select input
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

      {/* ── Trigger button ── */}
      <button
        className={`gecko-btn gecko-btn-sm ${active > 0 ? 'gecko-btn-primary' : 'gecko-btn-outline'}`}
        onClick={() => setOpen(o => !o)}
      >
        <Icon name="filter" size={13} />
        {active > 0 ? `Filter · ${active}` : 'Filter'}
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={12} />
      </button>

      {/* ── Floating panel ── */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          right: 0,
          width: 680,
          background: 'var(--gecko-bg-surface)',
          border: '1px solid var(--gecko-border)',
          borderRadius: 10,
          boxShadow: '0 8px 28px rgba(0,0,0,0.13)',
          zIndex: 50,
          fontFamily: 'var(--gecko-font-sans)',
          fontSize: 12,
        }}>

          {/* Panel header */}
          <div style={{ padding: '11px 16px 10px', borderBottom: '1px solid var(--gecko-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Filter Unbilled Services
            </span>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gecko-text-disabled)', padding: 2, lineHeight: 1 }}>
              <Icon name="x" size={14} />
            </button>
          </div>

          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ── Section 1: Entity Lookups ── */}
            <div>
              <div className="gecko-filter-section-label" style={{ paddingInline: 0, marginBottom: 8 }}>Entity Codes</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                <div><div style={lbl}>Agent Code</div><TInput fk="agentCode" ph="e.g. HAPAG" /></div>
                <div><div style={lbl}>Forwarder Code</div><TInput fk="forwarderCode" ph="e.g. DHL" /></div>
                <div><div style={lbl}>Customer Code</div><TInput fk="customerCode" ph="e.g. C-00142" /></div>
                <div><div style={lbl}>Booking / B-L No.</div><TInput fk="bookingBlNo" ph="e.g. EGLV14960…" /></div>
              </div>
            </div>

            <div className="gecko-filter-divider" style={{ margin: 0 }} />

            {/* ── Section 2: Vessel & Charge ── */}
            <div>
              <div className="gecko-filter-section-label" style={{ paddingInline: 0, marginBottom: 8 }}>Vessel & Charge</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 1fr', gap: 10 }}>
                <div><div style={lbl}>Vessel Code</div><TInput fk="vesselCode" ph="IMO / name" /></div>
                <div><div style={lbl}>Voyage No.</div><TInput fk="voyageNo" ph="512E" /></div>
                <div><div style={lbl}>Charge Code</div><TInput fk="chargeCode" ph="e.g. STORAGE-L" /></div>
              </div>
            </div>

            <div className="gecko-filter-divider" style={{ margin: 0 }} />

            {/* ── Section 3: Order Criteria + Date Range ── */}
            <div>
              <div className="gecko-filter-section-label" style={{ paddingInline: 0, marginBottom: 8 }}>Order Criteria &amp; Date Range</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) repeat(2, 1fr)', gap: 10 }}>
                <div>
                  <div style={lbl}>Booking Type</div>
                  <Sel fk="bookingType" opts={['ALL','IMPORT','EXPORT','TRANSSHIPMENT']} />
                </div>
                <div>
                  <div style={lbl}>Order Type</div>
                  <Sel fk="orderType" opts={['ALL','CY/CY','CY/CFS','CFS/CY','CFS/CFS','DOOR/CY']} />
                </div>
                <div>
                  <div style={lbl}>Movement</div>
                  <Sel fk="movement" opts={['ALL','FULL IN','FULL OUT','EMPTY IN','EMPTY OUT','LOAD','DISCHARGE']} />
                </div>
                <div>
                  <div style={lbl}>Start Date</div>
                  <DateField value={values.startDate} onChange={v => set('startDate', v)} size="sm" placeholder="From" />
                </div>
                <div>
                  <div style={lbl}>End Date</div>
                  <DateField value={values.endDate} onChange={v => set('endDate', v)} size="sm" placeholder="To" />
                </div>
              </div>
            </div>

            {/* Second criteria row: Payment Term */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: 10 }}>
              <div>
                <div style={lbl}>Payment Term</div>
                <Sel fk="paymentTerm" opts={['ALL','NET 30','NET 60','PREPAID','COLLECT','COD']} />
              </div>
            </div>

          </div>

          {/* ── Footer ── */}
          <div className="gecko-filter-footer">
            <button
              className="gecko-btn gecko-btn-ghost gecko-btn-sm"
              style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}
              onClick={() => { onClear(); }}
              disabled={active === 0}
            >
              Clear all
            </button>
            <button
              className="gecko-btn gecko-btn-primary gecko-btn-sm"
              style={{ fontSize: 11 }}
              onClick={() => { onApply(values); setOpen(false); }}
            >
              <Icon name="search" size={13} /> Search
            </button>
          </div>

        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UnbilledPage() {
  const [activeCustomer, setActiveCustomer] = useState('C-00142');
  const [selectedSOs, setSelectedSOs] = useState<Set<string>>(
    new Set(UNBILLED_SOS.map(so => so.id))
  );
  const [filters, setFilters] = useState<Filters>(BLANK);

  const toggleSO = (id: string) => {
    const next = new Set(selectedSOs);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedSOs(next);
  };

  const total = UNBILLED_SOS
    .filter(so => selectedSOs.has(so.id))
    .reduce((acc, so) => acc + so.amount, 0);

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 40, height: 'calc(100vh - 100px)' }}>

      {/* ── Header ── */}
      <div className="gecko-page-actions" style={{ flexShrink: 0 }}>
        <div className="gecko-page-actions-left">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>Unbilled Services</h1>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-warning-700)', background: 'var(--gecko-warning-100)', padding: '2px 8px', borderRadius: 12 }}>
              ฿25,640 pending
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>
            Completed service orders waiting to be consolidated into invoices.
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

      {/* ── Two-pane layout ── */}
      <div style={{ display: 'flex', gap: 24, flex: 1, minHeight: 0 }}>

        {/* Left sidebar — Customer Queue */}
        <div style={{ width: 340, flexShrink: 0, background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, display: 'flex', flexDirection: 'column', boxShadow: 'var(--gecko-shadow-sm)' }}>
          <div style={{ padding: 16, borderBottom: '1px solid var(--gecko-border)' }}>
            <div style={{ position: 'relative' }}>
              <Icon name="search" size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--gecko-text-disabled)' }} />
              <input className="gecko-input" placeholder="Search customer..." style={{ paddingLeft: 36, width: '100%' }} />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {UNBILLED_CUSTOMERS.map(c => (
              <div
                key={c.id}
                onClick={() => setActiveCustomer(c.id)}
                style={{
                  padding: 16, borderBottom: '1px solid var(--gecko-border)', cursor: 'pointer',
                  background: activeCustomer === c.id ? 'var(--gecko-primary-50)' : 'transparent',
                  borderLeft: activeCustomer === c.id ? '3px solid var(--gecko-primary-600)' : '3px solid transparent',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontWeight: 600, color: activeCustomer === c.id ? 'var(--gecko-primary-800)' : 'var(--gecko-text-primary)' }}>{c.name}</div>
                  <div style={{ fontWeight: 700, fontFamily: 'var(--gecko-font-mono)' }}>{c.totalUnbilled}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--gecko-text-secondary)' }}>
                  <div>{c.soCount} pending orders</div>
                  <div>Oldest: {c.oldest}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right pane — Invoice Builder */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, boxShadow: 'var(--gecko-shadow-sm)', overflow: 'hidden' }}>

          {/* Action header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--gecko-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Invoice Builder</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: '4px 0 0 0', color: 'var(--gecko-text-primary)' }}>
                Thai Union Group PCL{' '}
                <span style={{ fontSize: 14, color: 'var(--gecko-text-secondary)', fontWeight: 400 }}>(C-00142)</span>
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Selected Total (excl. VAT)</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gecko-primary-700)', fontFamily: 'var(--gecko-font-mono)' }}>฿{total.toLocaleString()}</div>
              </div>
              <button className="gecko-btn gecko-btn-primary gecko-btn-lg" disabled={selectedSOs.size === 0}>
                Generate Invoice
              </button>
            </div>
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--gecko-bg-subtle)', color: 'var(--gecko-text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', position: 'sticky', top: 0, zIndex: 10 }}>
                  <th style={{ padding: '12px 16px', width: 40, borderBottom: '1px solid var(--gecko-border)' }}>
                    <input type="checkbox"
                      checked={selectedSOs.size === UNBILLED_SOS.length}
                      onChange={() => {
                        if (selectedSOs.size === UNBILLED_SOS.length) setSelectedSOs(new Set());
                        else setSelectedSOs(new Set(UNBILLED_SOS.map(s => s.id)));
                      }}
                    />
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--gecko-border)' }}>Date</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--gecko-border)' }}>SO Number</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--gecko-border)' }}>Unit</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--gecko-border)' }}>Charge</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, borderBottom: '1px solid var(--gecko-border)' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {UNBILLED_SOS.map(so => (
                  <tr key={so.id} onClick={() => toggleSO(so.id)}
                    style={{ borderBottom: '1px solid var(--gecko-border)', background: selectedSOs.has(so.id) ? 'var(--gecko-primary-50)' : '#fff', cursor: 'pointer' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <input type="checkbox" checked={selectedSOs.has(so.id)} readOnly />
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--gecko-text-secondary)', fontSize: 12 }}>{so.date}</td>
                    <td style={{ padding: '14px 16px', fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }}>{so.id}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600, fontFamily: 'var(--gecko-font-mono)' }}>{so.unit}</div>
                      <div style={{ fontSize: 11, color: 'var(--gecko-text-disabled)', fontFamily: 'var(--gecko-font-mono)' }}>{so.type}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--gecko-info-700)', fontFamily: 'var(--gecko-font-mono)', fontSize: 12 }}>{so.code}</div>
                      <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)' }}>{so.desc}</div>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--gecko-font-mono)' }}>฿{so.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  );
}
