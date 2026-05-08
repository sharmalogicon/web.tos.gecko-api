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
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 60 }}>
      
      {/* Header breadcrumb & actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <nav className="gecko-breadcrumb" aria-label="Breadcrumb">
          <Link href="/billing/invoices" className="gecko-breadcrumb-item">Billing &amp; Invoicing › Invoices</Link>
          <span className="gecko-breadcrumb-sep" />
          <span className="gecko-breadcrumb-current">{id}</span>
        </nav>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="gecko-btn gecko-btn-ghost" onClick={() => window.print()}><Icon name="printer" size={16} /> Print</button>
          <button className="gecko-btn gecko-btn-outline" onClick={() => toast({ variant: 'info', title: 'PDF queued', message: `Invoice ${id} will download shortly.` })}><Icon name="download" size={16} /> PDF</button>
          <button className="gecko-btn gecko-btn-primary" onClick={() => toast({ variant: 'success', title: 'Invoice sent', message: `${id} emailed to the bill-to address.` })}><Icon name="send" size={16} /> Send via Email</button>
        </div>
      </div>

      {/* Invoice Document Canvas */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--gecko-border)', boxShadow: '0 8px 30px rgba(0,0,0,0.04)', padding: 48, display: 'flex', flexDirection: 'column', gap: 40 }}>
        
        {/* Doc Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ width: 40, height: 40, background: 'var(--gecko-primary-600)', color: '#fff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12h4l3-9 4 18 3-9h4"/>
              </svg>
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--gecko-text-primary)', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>INVOICE</h1>
            <div style={{ fontSize: 16, color: 'var(--gecko-text-secondary)', fontFamily: 'var(--gecko-font-mono)' }}>{id}</div>
            <div style={{ marginTop: 12, display: 'inline-flex', background: 'var(--gecko-gray-100)', color: 'var(--gecko-text-secondary)', padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 700 }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <BarcodeDisplay value={id} variant="qr" qrSize={90} showValue={false} />
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gecko-text-secondary)', textAlign: 'center' }}>Scan to verify</div>
            <BarcodeDisplay value={id} variant="code128" showValue={false} />
          </div>
        </div>

        {/* Bill To & Details */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '32px 0', borderTop: '1px solid var(--gecko-border)', borderBottom: '1px solid var(--gecko-border)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-disabled)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Bill To</div>
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
              <tr style={{ borderBottom: '2px solid var(--gecko-border)', color: 'var(--gecko-text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '12px 0', textAlign: 'left', fontWeight: 700 }}>Description</th>
                <th style={{ padding: '12px 0', textAlign: 'left', fontWeight: 700 }}>Unit Ref</th>
                <th style={{ padding: '12px 0', textAlign: 'right', fontWeight: 700 }}>Qty</th>
                <th style={{ padding: '12px 0', textAlign: 'right', fontWeight: 700 }}>Rate</th>
                <th style={{ padding: '12px 0', textAlign: 'right', fontWeight: 700 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {/* Item 1 */}
              <tr style={{ borderBottom: '1px solid var(--gecko-border)' }}>
                <td style={{ padding: '16px 0' }}>
                  <div style={{ fontWeight: 600, color: 'var(--gecko-text-primary)' }}>Gate entry processing (GATE-IN)</div>
                  <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>Apr 24 14:30 · SO-2026-0881</div>
                </td>
                <td style={{ padding: '16px 0', fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-secondary)' }}>MSKU 744218-3</td>
                <td style={{ padding: '16px 0', textAlign: 'right', fontFamily: 'var(--gecko-font-mono)' }}>1</td>
                <td style={{ padding: '16px 0', textAlign: 'right', fontFamily: 'var(--gecko-font-mono)' }}>฿120.00</td>
                <td style={{ padding: '16px 0', textAlign: 'right', fontWeight: 600, fontFamily: 'var(--gecko-font-mono)' }}>฿120.00</td>
              </tr>
              {/* Item 2 */}
              <tr style={{ borderBottom: '1px solid var(--gecko-border)' }}>
                <td style={{ padding: '16px 0' }}>
                  <div style={{ fontWeight: 600, color: 'var(--gecko-text-primary)' }}>Container lift-on (LIFT-ON)</div>
                  <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>Apr 24 14:30 · SO-2026-0882</div>
                </td>
                <td style={{ padding: '16px 0', fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-secondary)' }}>MSKU 744218-3</td>
                <td style={{ padding: '16px 0', textAlign: 'right', fontFamily: 'var(--gecko-font-mono)' }}>1</td>
                <td style={{ padding: '16px 0', textAlign: 'right', fontFamily: 'var(--gecko-font-mono)' }}>฿850.00</td>
                <td style={{ padding: '16px 0', textAlign: 'right', fontWeight: 600, fontFamily: 'var(--gecko-font-mono)' }}>฿850.00</td>
              </tr>
              {/* Item 3 */}
              <tr style={{ borderBottom: '1px solid var(--gecko-border)' }}>
                <td style={{ padding: '16px 0' }}>
                  <div style={{ fontWeight: 600, color: 'var(--gecko-text-primary)' }}>Storage, laden (STORAGE-L)</div>
                  <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>4 days (Apr 20 - Apr 24) · SO-2026-0840</div>
                </td>
                <td style={{ padding: '16px 0', fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-secondary)' }}>MSKU 744218-3</td>
                <td style={{ padding: '16px 0', textAlign: 'right', fontFamily: 'var(--gecko-font-mono)' }}>4</td>
                <td style={{ padding: '16px 0', textAlign: 'right', fontFamily: 'var(--gecko-font-mono)' }}>฿80.00</td>
                <td style={{ padding: '16px 0', textAlign: 'right', fontWeight: 600, fontFamily: 'var(--gecko-font-mono)' }}>฿320.00</td>
              </tr>
              {/* Item 4 */}
              <tr style={{ borderBottom: '1px solid var(--gecko-border)' }}>
                <td style={{ padding: '16px 0' }}>
                  <div style={{ fontWeight: 600, color: 'var(--gecko-text-primary)' }}>Container stuffing (STUFF)</div>
                  <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>CFS 62 cbm · SO-2026-0831</div>
                </td>
                <td style={{ padding: '16px 0', fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-secondary)' }}>MSKU 744218-3</td>
                <td style={{ padding: '16px 0', textAlign: 'right', fontFamily: 'var(--gecko-font-mono)' }}>62</td>
                <td style={{ padding: '16px 0', textAlign: 'right', fontFamily: 'var(--gecko-font-mono)' }}>฿180.00</td>
                <td style={{ padding: '16px 0', textAlign: 'right', fontWeight: 600, fontFamily: 'var(--gecko-font-mono)' }}>฿11,160.00</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Totals Area */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
          <div style={{ width: 320 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14, color: 'var(--gecko-text-secondary)' }}>
              <span>Subtotal</span>
              <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600, color: 'var(--gecko-text-primary)' }}>฿12,450.00</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14, color: 'var(--gecko-text-secondary)', borderBottom: '1px solid var(--gecko-border)' }}>
              <span>VAT (7%)</span>
              <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600, color: 'var(--gecko-text-primary)' }}>฿871.50</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', fontSize: 20, fontWeight: 800, color: 'var(--gecko-primary-700)' }}>
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
