"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/problem';
import { EIR_PRINT_NOTE, openPdf } from '@/lib/api/open-pdf';
import { SplitReceiptModal } from '@/app/billing/_components/SplitReceiptModal';
import type { TripSaveResult } from '@/lib/api/gate-trips';

/**
 * What the Save made of the truck.
 *
 * A drop-off is GATED and has its EIR. A pick-up is PLANNED — paid for, held
 * for this truck, and released later at Gate Out — so it shows its coupon and
 * says plainly that it is still waiting, rather than looking like a half-failed
 * drop-off.
 *
 * SPLIT lives here too (owner, 2026-10-08), as a button beside the prints
 * rather than behind a post-save dialog like the desktop's. This is the moment
 * it is wanted: the receipt has just been taken for the whole truck and the
 * driver is standing there saying two of the boxes are the haulier's. Sending
 * the clerk to the cash window or to the receipt page to do it is sending them
 * away from the barrier.
 */
export function SavedTripPanel({ result }: { result: TripSaveResult }) {
  const { toast } = useToast();
  const [splitting, setSplitting] = useState(false);
  /** Which document is being fetched — the pressed button spins, not all of them. */
  const [printing, setPrinting] = useState<string | null>(null);

  /**
   * EVERY PAPER ON THIS PANEL IS BEHIND AN AUTHORISED ENDPOINT.
   *
   * All four used to be plain `<a href>` to the URLs the save answered with,
   * and every one of them returned 401: the access token lives in a JavaScript
   * variable, never a cookie, so a browser navigation carries nothing. They are
   * fetched with the token now and opened for printing.
   */
  const print = async (key: string, url: string, name: string, what: string) => {
    setPrinting(key);
    try {
      await openPdf(url, name);
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      toast({
        variant: 'danger',
        title: `${what} not printed`,
        message: err?.status === 403
          ? 'That document needs a permission you do not have at this depot.'
          : err?.status === 404
            ? `No ${what.toLowerCase()} was issued for this truck.`
            : err?.title ?? 'Could not reach the Gecko API.',
      });
    } finally {
      setPrinting(null);
    }
  };
  const gated = result.rows.filter(r => r.status === 'GATED');
  const planned = result.rows.filter(r => r.status === 'PLANNED');
  const refused = result.rows.filter(r => r.status !== 'GATED' && r.status !== 'PLANNED');

  return (
    <div className="gecko-card gecko-card-padded gecko-stack gecko-saved-trip">
      <div className="gecko-row gecko-row-between gecko-row-start">
        <div className="gecko-row gecko-gap-2h">
          <Icon name="shieldCheck" size={18} />
          <div>
            <div className="gecko-card-title">
              {result.visitNo ? <span className="gecko-text-mono">{result.visitNo}</span> : 'Saved'}
            </div>
            <div className="gecko-cell-meta">
              {gated.length} gated in{planned.length ? ` · ${planned.length} waiting for gate out` : ''}
              {result.truckLeftAt ? ' · truck out' : ''}
            </div>
          </div>
        </div>
        <div className="gecko-row gecko-gap-2 gecko-flex-wrap">
          {result.receipt && (
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" disabled={printing !== null}
              onClick={() => void print('receipt', result.receipt!.pdfUrl, `${result.receipt!.receiptNo}.pdf`, 'Receipt')}>
              {printing === 'receipt'
                ? <span className="gecko-spinner gecko-spinner-sm" />
                : <Icon name="print" size={13} />}
              Receipt {result.receipt.receiptNo}
            </button>
          )}
          {/* One cash bill per receipt, listing every box and charge on it —
              no longer a slip per box, so the label says what it is. */}
          {result.receipt?.couponPdfUrl && (
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" disabled={printing !== null}
              onClick={() => void print('coupon', result.receipt!.couponPdfUrl!, `${result.receipt!.receiptNo}-coupon.pdf`, 'Coupon')}>
              {printing === 'coupon'
                ? <span className="gecko-spinner gecko-spinner-sm" />
                : <Icon name="print" size={13} />}
              Coupon (cash bill)
            </button>
          )}
          {result.truckInPdfUrl && (
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" disabled={printing !== null}
              onClick={() => void print('truck-in', result.truckInPdfUrl!, `${result.visitNo ?? 'truck'}-truck-in.pdf`, 'Truck-in form')}>
              {printing === 'truck-in'
                ? <span className="gecko-spinner gecko-spinner-sm" />
                : <Icon name="print" size={13} />}
              Truck-in form
            </button>
          )}
          {/* A receipt just taken at the gate is by definition a GATE receipt of
              today, so the API's three conditions hold and the dialog does not
              need to be guarded here — it checks again, and so does the server. */}
          {result.receipt && (
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setSplitting(true)}
              title="Share the charges between payers, or change who the whole receipt is made out to">
              <Icon name="transferH" size={13} /> Split / change payer
            </button>
          )}
        </div>
      </div>

      {/* Values only, onto pre-printed stationery: scaling ruins it. */}
      <div className="gecko-print-note gecko-print-note-left">{EIR_PRINT_NOTE}</div>

      <div className="gecko-saved-rows">
        {result.rows.map(r => (
          <div key={r.index} className="gecko-saved-row">
            <span className="gecko-text-mono gecko-mono-strong">{r.containerNo || '(yard chooses)'}</span>
            <span className={`gecko-saved-badge gecko-saved-badge-${r.status === 'GATED' ? 'in' : r.status === 'PLANNED' ? 'wait' : 'no'}`}>
              {r.status === 'GATED' ? 'Gated in' : r.status === 'PLANNED' ? 'Waiting for gate out' : r.status}
            </span>
            {r.eirNo && (
              <Link href={`/gate/eir-in/${r.gateTransactionId}`} className="gecko-link gecko-text-mono">{r.eirNo}</Link>
            )}
            {r.couponRef && <span className="gecko-cell-meta gecko-text-mono">{r.couponRef}</span>}
            {r.eirPdfUrl && (
              <button className="gecko-link gecko-link-button" disabled={printing !== null}
                onClick={() => void print(`eir-${r.index}`, r.eirPdfUrl!, `${r.eirNo ?? 'eir'}.pdf`, 'EIR')}>
                {printing === `eir-${r.index}` ? 'Preparing…' : 'Print EIR (pre-printed form)'}
              </button>
            )}
            {r.reason && <span className="gecko-cell-meta gecko-tone-error">{r.reason}</span>}
          </div>
        ))}
      </div>

      {refused.length > 0 && (
        <div className="gecko-alert gecko-alert-warning">
          {refused.length} box{refused.length === 1 ? '' : 'es'} did not go through. Its cash stands and its coupon is still good.
        </div>
      )}

      {splitting && result.receipt && (
        <SplitReceiptModal receiptId={result.receipt.receiptId}
          onClose={() => setSplitting(false)}
          onDone={made => {
            setSplitting(false);
            toast({
              variant: 'success',
              title: `Split into ${made.length} receipts`,
              message: `${made.map(x => x.receiptNo).join(' · ')} — the original is voided. Print each from its own page.`,
            });
            // Each part is its own tax invoice and the driver leaves with all
            // of them, so all of them are printed. The banner above still names
            // the original, which is now voided and points at these.

          }} />
      )}
    </div>
  );
}
