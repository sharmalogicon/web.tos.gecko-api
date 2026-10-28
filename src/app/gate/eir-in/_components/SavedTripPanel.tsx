"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/problem';
import { EIR_PRINT_NOTE, openPdf } from '@/lib/api/open-pdf';
import { SplitReceiptModal } from '@/app/billing/_components/SplitReceiptModal';
import { printReceiptParts, printedPartsToast, type Receipt } from '@/lib/api/receipts';
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
  /**
   * THE PARTS A SPLIT MADE, once one has been done from this panel.
   *
   * `result.receipt` is what the Save answered with and it never changes — so
   * after a split it names PART ONE and nothing else, which is why Receipt and
   * Coupon printed one document and the driver left two short.
   *
   * A ONE-PART answer is a change of payer, not a split: same id, same number.
   * It is still kept, because the payer printed on the paper has changed.
   */
  const [parts, setParts] = useState<Receipt[] | null>(null);
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
  /**
   * What to print: the split's parts once there are any, else the receipt the
   * Save answered with. Its `pdfUrl` is the same document `receiptPdfPath`
   * builds, so one path serves both and there is no second code path to drift.
   */
  const partList: { receiptId: string; receiptNo: string }[] = parts
    ?? (result.receipt ? [{ receiptId: result.receipt.receiptId, receiptNo: result.receipt.receiptNo }] : []);
  const split = partList.length > 1;

  /** One part on its own — what a clerk presses when a tab was blocked. */
  const printOne = async (part: { receiptId: string; receiptNo: string }) => {
    setPrinting(part.receiptId);
    try {
      const say = printedPartsToast(await printReceiptParts([part], 'receipt'), 'receipt');
      if (say) toast(say);
    } finally {
      setPrinting(null);
    }
  };

  const printParts = async (kind: 'receipt' | 'coupon') => {
    if (partList.length === 0) return;
    setPrinting(kind);
    try {
      const say = printedPartsToast(await printReceiptParts(partList, kind), kind);
      if (say) toast(say);
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
              onClick={() => void printParts('receipt')}
              title={split ? `One tax invoice per part: ${partList.map(x => x.receiptNo).join(', ')}` : undefined}>
              {printing === 'receipt'
                ? <span className="gecko-spinner gecko-spinner-sm" />
                : <Icon name="print" size={13} />}
              {split ? `Receipts ×${partList.length}` : `Receipt ${partList[0]?.receiptNo ?? result.receipt.receiptNo}`}
            </button>
          )}
          {/* One cash bill per receipt, listing every box and charge on it —
              no longer a slip per box, so the label says what it is. After a
              split that is one per PART, and the count says so. */}
          {(result.receipt?.couponPdfUrl || split) && (
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" disabled={printing !== null}
              onClick={() => void printParts('coupon')}
              title={split ? `One cash bill per part: ${partList.map(x => x.receiptNo).join(', ')}` : undefined}>
              {printing === 'coupon'
                ? <span className="gecko-spinner gecko-spinner-sm" />
                : <Icon name="print" size={13} />}
              {split ? `Coupons (cash bill) ×${partList.length}` : 'Coupon (cash bill)'}
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

      {/* ONE LINK PER PART, so a single one can be reprinted — which is what a
          clerk needs when the browser blocked the second tab and only part one
          came out. Only after a real split; one receipt has its own button. */}
      {split && (
        <div className="gecko-print-note gecko-print-note-left">
          {partList.map(part => (
            <button key={part.receiptId} className="gecko-link gecko-link-button gecko-coupon-reprint"
              disabled={printing !== null}
              onClick={() => void printOne(part)}>
              {printing === part.receiptId ? 'Preparing…' : `Print ${part.receiptNo}`}
            </button>
          ))}
        </div>
      )}

      {/* Values only, onto pre-printed stationery: scaling ruins it. */}
      <div className="gecko-print-note gecko-print-note-left">{EIR_PRINT_NOTE}</div>

      <div className="gecko-saved-rows">
        {result.rows.map(r => (
          <div key={r.index} className="gecko-saved-row">
            <span className="gecko-text-mono gecko-mono-strong">{r.containerNo || '(yard chooses)'}</span>
            {/* The gate gave this box its number; the clerk has to write it on. */}
            {r.containerNoWasMinted && (
              <span className="gecko-badge gecko-badge-warning" title="Write this number on the box">
                issued — write it on the box
              </span>
            )}
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
            setParts(made);
            // NOTHING IS DESTROYED IN A SPLIT. The first part keeps the
            // original id and number and the others are new ones beside it —
            // the cash window has always worded it this way, and this panel
            // used to contradict it, telling a clerk their receipt was gone.
            if (made.length === 1) {
              toast({
                variant: 'success',
                title: 'Payer changed',
                message: `${made[0].receiptNo} is now made out to ${made[0].payerName ?? 'the new payer'}.`,
              });
            } else {
              const [first, ...rest] = made;
              toast({
                variant: 'success',
                title: `Split into ${made.length} receipts`,
                message: `${first.receiptNo} kept the first part; new: ${rest.map(x => x.receiptNo).join(' · ')}.`
                  + ' Print now sends one document per part.',
              });
            }
          }} />
      )}
    </div>
  );
}
