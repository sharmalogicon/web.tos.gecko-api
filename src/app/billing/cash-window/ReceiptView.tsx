"use client";
import React, { useCallback, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { apiDownload, saveBlob } from '@/lib/api/client';
import { ProblemAlert, problemOf, type Problem } from './ProblemAlert';
import { CHANNEL_LABEL, formatBaht, receiptPdfPath, taxBranchLabel, type Receipt } from '@/lib/api/window';

/**
 * The receipt — the Thai tax invoice the driver carries to the gate.
 *
 * Two ways out: Print sends the 80 mm thermal slip below through the design
 * system's print mode (body.print-mode-receipt, @page injected at print time);
 * Download PDF fetches the A4 full tax invoice the API renders
 * (GET /window/receipts/{id}/receipt.pdf — seller, buyer, VAT, VOID mark).
 * Thai-capable fonts come after the mono stack: Courier has no Thai glyphs.
 *
 * The seller block is master data as it stands: a field MDM does not hold
 * prints as "(not set)" — never invented.
 */

const THAI_SAFE = "var(--gecko-font-mono), 'Courier New', 'Tahoma', 'Leelawadee UI', 'Sarabun', 'Noto Sans Thai', monospace";

const NOT_SET = '(not set)';
const channelLabel = (c: string) => CHANNEL_LABEL[c as keyof typeof CHANNEL_LABEL] ?? c;
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

export function usePrintReceipt() {
  return useCallback(() => {
    const body = document.body;
    const page = document.createElement('style');
    page.id = 'gecko-cash-receipt-page';
    page.textContent = '@page { size: 80mm auto; margin: 0; }';
    document.head.appendChild(page);
    body.classList.add('print-mode-receipt');
    window.requestAnimationFrame(() => {
      window.print();
      window.setTimeout(() => {
        body.classList.remove('print-mode-receipt');
        page.remove();
      }, 200);
    });
  }, []);
}

export function ReceiptView({ receipt, depot, onPrint, onNext }: {
  receipt: Receipt; depot: string; onPrint: () => void; onNext: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [pdfError, setPdfError] = useState<Problem | null>(null);
  const seller = receipt.seller;
  const voided = receipt.status === 'VOIDED';

  async function downloadPdf() {
    setDownloading(true); setPdfError(null);
    try {
      const { blob, filename } = await apiDownload(receiptPdfPath(receipt.receiptId));
      saveBlob(blob, filename ?? `${receipt.receiptNo}.pdf`);
    } catch (e) {
      setPdfError(problemOf(e, 'The PDF could not be downloaded.'));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <div className="gecko-card no-print" style={{ padding: 20 }}>
        <div className="gecko-row" style={{ gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <Icon name="checkCircle" size={28} style={{ color: 'var(--gecko-success-600, #15803d)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--gecko-font-mono, monospace)' }}>
              {receipt.receiptNo}
              {voided && <span className="gecko-badge gecko-badge-error" style={{ marginLeft: 10 }}>VOIDED</span>}
            </div>
            <div className="gecko-text-muted">
              {receipt.orderNo} · {receipt.payerName} · {when(receipt.receiptAt)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="gecko-text-muted" style={{ fontSize: 12 }}>Total paid</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{formatBaht(receipt.total)}</div>
          </div>
          {receipt.change > 0 && (
            <div style={{ textAlign: 'right', padding: '6px 14px', borderRadius: 8, background: 'var(--gecko-warning-50, #fffbeb)' }}>
              <div className="gecko-text-muted" style={{ fontSize: 12 }}>Change to give</div>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{formatBaht(receipt.change)}</div>
            </div>
          )}
        </div>

        {receipt.coupons.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="gecko-text-muted" style={{ fontSize: 12, marginBottom: 4 }}>Released at the gate</div>
            <div className="gecko-row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {receipt.coupons.map(c => (
                <span key={c.couponRef} className="gecko-badge gecko-badge-success">
                  {c.containerNo ?? '—'} · {c.movementCode} · {c.couponRef}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="gecko-row" style={{ gap: 10, marginTop: 18 }}>
          <button className="gecko-btn gecko-btn-primary" onClick={onPrint} autoFocus>
            <Icon name="printer" size={16} /> Print receipt
          </button>
          <button className="gecko-btn gecko-btn-outline" onClick={() => void downloadPdf()} disabled={downloading}>
            <Icon name="download" size={16} /> {downloading ? 'Preparing PDF…' : 'Download PDF'}
          </button>
          <button className="gecko-btn gecko-btn-outline" onClick={onNext}>
            Next driver
          </button>
        </div>
        {!seller && (
          <div className="gecko-text-muted" style={{ fontSize: 12, marginTop: 8 }}>
            This depot has no invoicing company in master data, so the seller block prints as {NOT_SET}.
          </div>
        )}
        {pdfError && <ProblemAlert problem={pdfError} style={{ marginTop: 12 }} />}
      </div>

      {/* ── what reaches the paper ─────────────────────────────────────── */}
      <div className="print-template print-template-receipt" style={{ fontFamily: THAI_SAFE }}>
        {seller ? (
          <>
            <h1>{seller.nameLocal ?? seller.nameEn}</h1>
            {seller.nameLocal && <div className="center small">{seller.nameEn}</div>}
            <div className="center small">{seller.address ?? `Address: ${NOT_SET}`}</div>
            <div className="center small">Tax ID: {seller.taxId ?? NOT_SET}</div>
            <div className="center small">{taxBranchLabel(seller.taxBranchNo, seller.isHeadOffice) ?? `Branch: ${NOT_SET}`}</div>
            {seller.phone && <div className="center small">Tel {seller.phone}</div>}
          </>
        ) : (
          <>
            <h1>{depot}</h1>
            <div className="center small">Tax ID: {NOT_SET}</div>
          </>
        )}
        <hr />
        <div className="center small">ใบเสร็จรับเงิน / ใบกำกับภาษี</div>
        <div className="center small">RECEIPT / TAX INVOICE</div>
        {voided && <div className="center"><strong>*** VOID ***</strong></div>}
        <hr />
        <div className="row"><span>No.</span><strong>{receipt.receiptNo}</strong></div>
        <div className="row"><span>Date</span><span>{when(receipt.receiptAt)}</span></div>
        <div className="row"><span>Order</span><span>{receipt.orderNo}</span></div>
        <div className="row"><span>Payer</span><span className="right">{receipt.payerName}</span></div>
        {receipt.payerTaxId && <div className="row"><span>Tax ID</span><span>{receipt.payerTaxId}</span></div>}
        {receipt.payerBranchNo && <div className="row small"><span>Branch</span><span>{taxBranchLabel(receipt.payerBranchNo)}</span></div>}
        {receipt.payerAddress && <div className="small">{receipt.payerAddress}</div>}
        <hr />
        {receipt.lines.map(l => (
          <div key={l.lineNo} style={{ marginBottom: 3 }}>
            <div>{l.description}</div>
            <div className="row small">
              <span>{[l.containerNo, l.movementCode].filter(Boolean).join(' · ')}{l.quantity !== 1 ? ` ×${l.quantity}` : ''}</span>
              <span>{formatBaht(l.amount)}</span>
            </div>
          </div>
        ))}
        <hr />
        <div className="row"><span>Subtotal</span><span>{formatBaht(receipt.subtotal)}</span></div>
        <div className="row"><span>VAT 7%</span><span>{formatBaht(receipt.tax)}</span></div>
        <div className="row total"><span>TOTAL</span><span>{formatBaht(receipt.total)}</span></div>
        {receipt.payments.map((p, i) => (
          <div key={i}>
            <div className="row"><span>{channelLabel(p.channel)}{p.referenceNo ? ` ${p.referenceNo}` : ''}</span><span>{formatBaht(p.amount)}</span></div>
            {p.tendered != null && <div className="row small"><span>Tendered</span><span>{formatBaht(p.tendered)}</span></div>}
          </div>
        ))}
        {receipt.change > 0 && <div className="row"><strong>Change</strong><strong>{formatBaht(receipt.change)}</strong></div>}
        {receipt.coupons.length > 0 && (
          <>
            <hr />
            <div className="small">Gate release</div>
            {receipt.coupons.map(c => (
              <div key={c.couponRef} className="row small">
                <span>{c.containerNo ?? '—'} {c.movementCode}</span><strong>{c.couponRef}</strong>
              </div>
            ))}
          </>
        )}
        <hr />
        <div className="center small">ขอบคุณครับ / Thank you</div>
      </div>
    </>
  );
}
