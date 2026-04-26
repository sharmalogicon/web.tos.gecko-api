"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';

const UNBILLED_CUSTOMERS = [
  { id: 'C-00142', name: 'Thai Union Group', totalUnbilled: '฿12,450', soCount: 14, oldest: '4 days ago' },
  { id: 'C-00308', name: 'PTT Global Chemical', totalUnbilled: '฿8,200', soCount: 6, oldest: 'Yesterday' },
  { id: 'C-00412', name: 'CP Foods Co.', totalUnbilled: '฿3,140', soCount: 3, oldest: 'Today' },
  { id: 'C-00501', name: 'Betagro Public Co.', totalUnbilled: '฿1,850', soCount: 2, oldest: 'Today' },
];

const UNBILLED_SO_FOR_C00142 = [
  { id: 'SO-2026-0881', unit: 'MSKU 744218-3', type: '20GP', code: 'STORAGE-L', desc: 'Storage, laden (4 days)', amount: 320, date: 'Apr 24 14:30' },
  { id: 'SO-2026-0882', unit: 'MSKU 744218-3', type: '20GP', code: 'LIFT-ON', desc: 'Container lift-on', amount: 850, date: 'Apr 24 14:30' },
  { id: 'SO-2026-0873', unit: 'OOLU 551928-1', type: '40HC', code: 'STORAGE-L', desc: 'Storage, laden (8 days)', amount: 1640, date: 'Apr 23 11:00' },
  { id: 'SO-2026-0874', unit: 'OOLU 551928-1', type: '40HC', code: 'LIFT-ON', desc: 'Container lift-on', amount: 850, date: 'Apr 23 11:00' },
  { id: 'SO-2026-0840', unit: 'MSKU 119283-4', type: '20GP', code: 'GATE-IN', desc: 'Gate entry processing', amount: 120, date: 'Apr 21 09:15' },
];

export default function UnbilledPage() {
  const [activeCustomer, setActiveCustomer] = useState('C-00142');
  const [selectedSOs, setSelectedSOs] = useState<Set<string>>(new Set(UNBILLED_SO_FOR_C00142.map(so => so.id)));

  const toggleSO = (id: string) => {
    const next = new Set(selectedSOs);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedSOs(next);
  };

  const totalSelectedAmount = UNBILLED_SO_FOR_C00142
    .filter(so => selectedSOs.has(so.id))
    .reduce((acc, so) => acc + so.amount, 0);

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40, height: 'calc(100vh - 100px)' }}>

      {/* Header */}
      <div className="gecko-page-actions" style={{ flexShrink: 0 }}>
        <div className="gecko-page-actions-left">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>Unbilled Services</h1>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-warning-700)', background: 'var(--gecko-warning-100)', padding: '2px 8px', borderRadius: 12 }}>฿25,640 pending</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)' }}>Completed service orders waiting to be consolidated into invoices.</div>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm"><Icon name="settings" size={16} /> Auto-Bill Settings</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, flex: 1, minHeight: 0 }}>

        {/* Left Sidebar (Customer Queue) */}
        <div style={{ width: 340, flexShrink: 0, background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, display: 'flex', flexDirection: 'column', boxShadow: 'var(--gecko-shadow-sm)' }}>
          <div style={{ padding: 16, borderBottom: '1px solid var(--gecko-border)' }}>
            <div style={{ position: 'relative' }}>
              <Icon name="search" size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--gecko-text-disabled)' }} />
              <input className="gecko-input" placeholder="Search customer..." style={{ paddingLeft: 36, width: '100%' }} />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {UNBILLED_CUSTOMERS.map((c) => (
              <div
                key={c.id}
                onClick={() => setActiveCustomer(c.id)}
                style={{
                  padding: '16px', borderBottom: '1px solid var(--gecko-border)', cursor: 'pointer',
                  background: activeCustomer === c.id ? 'var(--gecko-primary-50)' : 'transparent',
                  borderLeft: activeCustomer === c.id ? '3px solid var(--gecko-primary-600)' : '3px solid transparent'
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

        {/* Right Detail Pane (Invoice Builder) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, boxShadow: 'var(--gecko-shadow-sm)', overflow: 'hidden' }}>

          {/* Action Header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--gecko-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Invoice Builder</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: '4px 0 0 0', color: 'var(--gecko-text-primary)' }}>Thai Union Group PCL <span style={{ fontSize: 14, color: 'var(--gecko-text-secondary)', fontWeight: 400 }}>(C-00142)</span></h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Selected Total (excl. VAT)</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gecko-primary-700)', fontFamily: 'var(--gecko-font-mono)' }}>฿{totalSelectedAmount.toLocaleString()}</div>
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
                  <th style={{ padding: '12px 16px', textAlign: 'left', width: 40, borderBottom: '1px solid var(--gecko-border)' }}>
                    <input type="checkbox" checked={selectedSOs.size === UNBILLED_SO_FOR_C00142.length} onChange={() => {
                      if (selectedSOs.size === UNBILLED_SO_FOR_C00142.length) setSelectedSOs(new Set());
                      else setSelectedSOs(new Set(UNBILLED_SO_FOR_C00142.map(s => s.id)));
                    }} />
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--gecko-border)' }}>Date</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--gecko-border)' }}>SO Number</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--gecko-border)' }}>Unit</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--gecko-border)' }}>Charge</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, borderBottom: '1px solid var(--gecko-border)' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {UNBILLED_SO_FOR_C00142.map((so) => (
                  <tr key={so.id} style={{ borderBottom: '1px solid var(--gecko-border)', background: selectedSOs.has(so.id) ? 'var(--gecko-primary-50)' : '#fff' }} onClick={() => toggleSO(so.id)}>
                    <td style={{ padding: '14px 16px' }}>
                      <input type="checkbox" checked={selectedSOs.has(so.id)} readOnly />
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--gecko-text-secondary)', fontSize: 12 }}>{so.date}</td>
                    <td style={{ padding: '14px 16px', fontFamily: 'var(--gecko-font-mono)', fontWeight: 600, color: 'var(--gecko-text-primary)' }}>{so.id}</td>
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
