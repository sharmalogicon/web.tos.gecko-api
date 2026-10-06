"use client";
import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import type { TripRefusalRow } from '@/lib/api/gate-trips';

/**
 * The box is not the type the booking asked for (§23.5).
 *
 * On an IMPORT full drop-off the booking can follow the box — but only if the
 * clerk says so, because it changes what the customer was quoted. The Save is
 * refused until then, with nothing charged, so answering "no" costs nothing.
 */
export function TypeChangeDialog({ rows, busy, onCancel, onAccept }: {
  rows: TripRefusalRow[];
  busy: boolean;
  onCancel: () => void;
  onAccept: () => void;
}) {
  return (
    <Modal
      isOpen
      onClose={onCancel}
      size="md"
      title="This box is not the type booked"
      subtitle="Nothing has been charged or recorded."
      footer={
        <>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onCancel} disabled={busy}>
            No — I will fix the box
          </button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={onAccept} disabled={busy}>
            <Icon name="check" size={13} /> {busy ? 'Saving…' : 'Yes, the booking follows the box'}
          </button>
        </>
      }
    >
      <div className="gecko-stack-sm">
        {rows.map(r => (
          <div key={r.index} className="gecko-type-change-row">
            <div className="gecko-text-mono gecko-mono-strong">{r.containerNo}</div>
            <div className="gecko-cell-meta">
              Booked <strong>{r.bookedType}</strong> · at the gate it is <strong>{r.keyedType}</strong>
              {r.orderNo ? <> · {r.orderNo}</> : null}
            </div>
            {r.message && <div className="gecko-cell-meta">{r.message}</div>}
          </div>
        ))}
      </div>
    </Modal>
  );
}
