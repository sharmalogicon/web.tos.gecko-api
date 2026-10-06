"use client";
import React from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import type { TripSaveResult } from '@/lib/api/gate-trips';

/**
 * What the Save made of the truck.
 *
 * A drop-off is GATED and has its EIR. A pick-up is PLANNED — paid for, held
 * for this truck, and released later at Gate Out — so it shows its coupon and
 * says plainly that it is still waiting, rather than looking like a half-failed
 * drop-off.
 */
export function SavedTripPanel({ result }: { result: TripSaveResult }) {
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
            <a className="gecko-btn gecko-btn-outline gecko-btn-sm" href={result.receipt.pdfUrl} target="_blank" rel="noreferrer">
              <Icon name="print" size={13} /> Receipt {result.receipt.receiptNo}
            </a>
          )}
          {result.receipt?.couponPdfUrl && (
            <a className="gecko-btn gecko-btn-outline gecko-btn-sm" href={result.receipt.couponPdfUrl} target="_blank" rel="noreferrer">
              <Icon name="print" size={13} /> Coupons
            </a>
          )}
          {result.truckInPdfUrl && (
            <a className="gecko-btn gecko-btn-outline gecko-btn-sm" href={result.truckInPdfUrl} target="_blank" rel="noreferrer">
              <Icon name="print" size={13} /> Truck-in form
            </a>
          )}
        </div>
      </div>

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
              <a className="gecko-link" href={r.eirPdfUrl} target="_blank" rel="noreferrer">print EIR</a>
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
    </div>
  );
}
