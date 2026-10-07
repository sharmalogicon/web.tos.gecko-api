"use client";
import React from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { BarcodeDisplay } from '@/components/ui/BarcodeDisplay';
import { useToast } from '@/components/ui/Toast';

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const id = params.id || 'INV-26-009412';
  const { toast } = useToast();

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 60 }}>

      {/* Header breadcrumb & actions */}
      <div className="gecko-row gecko-row-between">
        <nav className="gecko-breadcrumb" aria-label="Breadcrumb">
          <Link href="/billing/invoices" className="gecko-breadcrumb-item">Billing &amp; Invoicing › Invoices</Link>
          <span className="gecko-breadcrumb-sep" />
          <span className="gecko-breadcrumb-current">{id}</span>
        </nav>
        <div className="gecko-row gecko-stack-md">
          <button className="gecko-btn gecko-btn-ghost" onClick={() => window.print()}><Icon name="printer" size={16} /> Print</button>
          <button className="gecko-btn gecko-btn-outline" onClick={() => toast({ variant: 'info', title: 'PDF queued', message: `Invoice ${id} will download shortly.` })}><Icon name="download" size={16} /> PDF</button>
          <button className="gecko-btn gecko-btn-primary" onClick={() => toast({ variant: 'success', title: 'Invoice sent', message: `${id} emailed to the bill-to address.` })}><Icon name="send" size={16} /> Send via Email</button>
        </div>
      </div>

      {/* Invoice Document Canvas */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--gecko-border)', boxShadow: '0 8px 30px rgba(0,0,0,0.04)', padding: 48, display: 'flex', flexDirection: 'column', gap: 40 }}>
        
        {/* Doc Header */}
        <div className="gecko-row gecko-row-start gecko-row-between">
          <div>
            <div className="gecko-mini-icon gecko-mini-icon-solid gecko-mini-icon-lg gecko-mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12h4l3-9 4 18 3-9h4"/>
              </svg>
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--gecko-text-primary)', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>INVOICE</h1>
            <div style={{ fontSize: 16, color: 'var(--gecko-text-secondary)', fontFamily: 'var(--gecko-font-mono)' }}>{id}</div>
            <div className="gecko-pill gecko-pill-neutral gecko-mt-3">
              DRAFT
            </div>
          </div>

          <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--gecko-text-secondary)', lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700, color: 'var(--gecko-text-primary)', fontSize: 14 }}>GECKO</div>
            <div>Laem Chabang ICD - Import Yard</div>
            <div>Thung Sukhla, Si Racha</div>
            <div>Chon Buri 20230, Thailand</div>
            <div>Tax ID: 0105542000123</div>
          </div>

          {/* Barcode */}
          <div className="gecko-stack gecko-stack-sm" style={{ alignItems: 'center' }}>
            <BarcodeDisplay value={id} variant="qr" qrSize={90} showValue={false} />
            <div className="gecko-eyebrow" style={{ fontSize: 9, textAlign: 'center' }}>Scan to verify</div>
            <BarcodeDisplay value={id} variant="code128" showValue={false} />
          </div>
        </div>

        {/* Bill To & Details */}
        <div className="gecko-row gecko-row-between gecko-row-start" style={{ padding: '32px 0', borderTop: '1px solid var(--gecko-border)', borderBottom: '1px solid var(--gecko-border)' }}>
          <div className="gecko-flex-1">
            <div className="gecko-eyebrow gecko-mb-2">Bill To</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gecko-text-primary)', marginBottom: 4 }}>Thai Union Group PCL</div>
            <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', lineHeight: 1.6 }}>
              72/1 Moo 7, Sethakit 1 Road<br/>
              Tambon Tarsrai, Amphur Muang<br/>
              Samut Sakhon 74000, Thailand<br/>
              Customer Code: <span style={{ fontFamily: 'var(--gecko-font-mono)' }}>C-00142</span><br/>
              Tax ID: 0107537000084
            </div>
          </div>

          <div className="gecko-kv-grid" style={{ alignContent: 'start' }}>
            <div className="gecko-kv-label">Invoice Date</div>
            <div className="gecko-kv-value">Apr 24, 2026</div>
            <div className="gecko-kv-label">Terms</div>
            <div className="gecko-kv-value">Net 30</div>
            <div className="gecko-kv-label">Due Date</div>
            <div className="gecko-kv-value">May 24, 2026</div>
            <div className="gecko-kv-label">Reference</div>
            <div className="gecko-kv-value">BKG-88124</div>
          </div>
        </div>

        {/* Line Items */}
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--gecko-border)' }}>
                <th className="gecko-eyebrow" style={{ padding: '12px 0', textAlign: 'left' }}>Description</th>
                <th className="gecko-eyebrow" style={{ padding: '12px 0', textAlign: 'left' }}>Unit Ref</th>
                <th className="gecko-eyebrow" style={{ padding: '12px 0', textAlign: 'right' }}>Qty</th>
                <th className="gecko-eyebrow" style={{ padding: '12px 0', textAlign: 'right' }}>Rate</th>
                <th className="gecko-eyebrow" style={{ padding: '12px 0', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {/* Item 1 */}
              <tr style={{ borderBottom: '1px solid var(--gecko-border)' }}>
                <td style={{ padding: '16px 0' }}>
                  <div className="gecko-cell-primary">Gate entry processing (GATE-IN)</div>
                  <div className="gecko-cell-meta">Apr 24 14:30 · SO-2026-0881</div>
                </td>
                <td className="gecko-mono" style={{ padding: '16px 0', color: 'var(--gecko-text-secondary)' }}>MSKU 744218-3</td>
                <td className="gecko-num-tabular" style={{ padding: '16px 0' }}>1</td>
                <td className="gecko-num-tabular" style={{ padding: '16px 0' }}>฿120.00</td>
                <td className="gecko-money gecko-money-sm" style={{ padding: '16px 0', fontWeight: 600 }}>฿120.00</td>
              </tr>
              {/* Item 2 */}
              <tr style={{ borderBottom: '1px solid var(--gecko-border)' }}>
                <td style={{ padding: '16px 0' }}>
                  <div className="gecko-cell-primary">Container lift-on (LIFT-ON)</div>
                  <div className="gecko-cell-meta">Apr 24 14:30 · SO-2026-0882</div>
                </td>
                <td className="gecko-mono" style={{ padding: '16px 0', color: 'var(--gecko-text-secondary)' }}>MSKU 744218-3</td>
                <td className="gecko-num-tabular" style={{ padding: '16px 0' }}>1</td>
                <td className="gecko-num-tabular" style={{ padding: '16px 0' }}>฿850.00</td>
                <td className="gecko-money gecko-money-sm" style={{ padding: '16px 0', fontWeight: 600 }}>฿850.00</td>
              </tr>
              {/* Item 3 */}
              <tr style={{ borderBottom: '1px solid var(--gecko-border)' }}>
                <td style={{ padding: '16px 0' }}>
                  <div className="gecko-cell-primary">Storage, laden (STORAGE-L)</div>
                  <div className="gecko-cell-meta">4 days (Apr 20 - Apr 24) · SO-2026-0840</div>
                </td>
                <td className="gecko-mono" style={{ padding: '16px 0', color: 'var(--gecko-text-secondary)' }}>MSKU 744218-3</td>
                <td className="gecko-num-tabular" style={{ padding: '16px 0' }}>4</td>
                <td className="gecko-num-tabular" style={{ padding: '16px 0' }}>฿80.00</td>
                <td className="gecko-money gecko-money-sm" style={{ padding: '16px 0', fontWeight: 600 }}>฿320.00</td>
              </tr>
              {/* Item 4 */}
              <tr style={{ borderBottom: '1px solid var(--gecko-border)' }}>
                <td style={{ padding: '16px 0' }}>
                  <div className="gecko-cell-primary">Container stuffing (STUFF)</div>
                  <div className="gecko-cell-meta">CFS 62 cbm · SO-2026-0831</div>
                </td>
                <td className="gecko-mono" style={{ padding: '16px 0', color: 'var(--gecko-text-secondary)' }}>MSKU 744218-3</td>
                <td className="gecko-num-tabular" style={{ padding: '16px 0' }}>62</td>
                <td className="gecko-num-tabular" style={{ padding: '16px 0' }}>฿180.00</td>
                <td className="gecko-money gecko-money-sm" style={{ padding: '16px 0', fontWeight: 600 }}>฿11,160.00</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Totals Area */}
        <div className="gecko-row gecko-row-right" style={{ paddingTop: 8 }}>
          <div style={{ width: 320 }}>
            <div className="gecko-row gecko-row-between" style={{ padding: '8px 0', fontSize: 14, color: 'var(--gecko-text-secondary)' }}>
              <span>Subtotal</span>
              <span className="gecko-money gecko-money-md">฿12,450.00</span>
            </div>
            <div className="gecko-row gecko-row-between" style={{ padding: '8px 0', fontSize: 14, color: 'var(--gecko-text-secondary)', borderBottom: '1px solid var(--gecko-border)' }}>
              <span>VAT (7%)</span>
              <span className="gecko-money gecko-money-md">฿871.50</span>
            </div>
            <div className="gecko-row gecko-row-between" style={{ padding: '16px 0', fontSize: 20, fontWeight: 800, color: 'var(--gecko-primary-700)' }}>
              <span>Total due</span>
              <span style={{ fontFamily: 'var(--gecko-font-mono)' }}>฿13,321.50</span>
            </div>
          </div>
        </div>

        {/* Footer Notes */}
        <div style={{ borderTop: '1px solid var(--gecko-border)', paddingTop: 24, fontSize: 12, color: 'var(--gecko-text-disabled)', lineHeight: 1.6 }}>
          Payment is due within 30 days. Please make checks payable to GECKO.<br/>
          For wire transfers: Kasikornbank PCL, Account: 012-3-45678-9, SWIFT: KASITHBK.
        </div>
      </div>

    </div>
  );
}
