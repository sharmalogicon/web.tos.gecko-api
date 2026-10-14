"use client";
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/FormGrid';
import { ApiError } from '@/lib/api/problem';
import { formatContainerNo } from '@/lib/api/tos';
import { isWellFormedContainerNo, normaliseContainerNo } from '@/lib/api/container-story';
import { renumberContainer, type RenumberResult } from '@/lib/api/container-master';

/**
 * CORRECTING A MIS-KEYED CONTAINER NUMBER.
 *
 * The number is the key every stay, EIR, hold, coupon and receipt line points
 * at, so this is not an edit of one field — the API moves the box's whole
 * history, issued documents included, and rolls the lot back if the registry
 * refuses. That is why it is a dialog with a typed confirmation and not a text
 * box on the form.
 *
 * The dialog says what will move BEFORE the clerk commits, and what did move
 * after, because "everything" is a promise worth showing the receipts for.
 *
 * On success the OLD number 404s, so the caller navigates to the new one.
 */

export function RenumberDialog({ containerNo, rowVersion, onClose, onDone }: {
  containerNo: string;
  rowVersion: string;
  onClose: () => void;
  onDone: (result: RenumberResult) => void;
}) {
  const [next, setNext] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const cleaned = normaliseContainerNo(next);
  const sameAsNow = cleaned === containerNo;
  const shaped = cleaned.length === 0 || isWellFormedContainerNo(cleaned);
  const ready = cleaned.length > 0 && !sameAsNow && shaped && reason.trim().length >= 3;

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      onDone(await renumberContainer(containerNo, { newContainerNo: cleaned, reason: reason.trim(), rowVersion }));
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={busy ? () => {} : onClose} title="Correct the container number" size="md" closeOnBackdrop={!busy}>
      <div className="gecko-stack gecko-stack-md">

        <div className="gecko-alert gecko-alert-warning">
          <Icon name="alertCircle" size={18} />
          <div>
            <strong>This moves the box&rsquo;s whole history.</strong>
            <div>
              Its registry record, every stay, booking place, hold and reservation, every EIR, survey, coupon and
              reefer session, and the charges, receipt lines and invoice lines in Revenue. Reprints will show the
              new number. There is no undo.
            </div>
          </div>
        </div>

        <Field label="Number now" htmlFor="renumber-now">
          <input id="renumber-now" className="gecko-input gecko-mono" value={formatContainerNo(containerNo)} readOnly disabled />
        </Field>

        <Field label="Correct number" required htmlFor="renumber-next"
          error={error?.forField('newContainerNo')
            ?? (sameAsNow ? 'That is the number it already has.' : undefined)
            ?? (!shaped ? '4 to 11 letters or digits \u2014 e.g. TLLU8625599.' : undefined)}
          helper="What is actually stencilled on the box.">
          <input id="renumber-next" className="gecko-input gecko-mono" value={next} maxLength={14} autoFocus
            placeholder="TLLU8625599" disabled={busy}
            onChange={e => setNext(e.target.value.toUpperCase())} />
        </Field>

        <Field label="Why" required htmlFor="renumber-reason" error={error?.forField('reason')}
          helper="Kept on the box’s log and in the renumber audit.">
          <input id="renumber-reason" className="gecko-input" value={reason} maxLength={300} disabled={busy}
            placeholder="Mis-keyed at first registration — plate reads …599"
            onChange={e => setReason(e.target.value)} />
        </Field>

        {error && !error.forField('newContainerNo') && !error.forField('reason') && (
          <div className="gecko-alert gecko-alert-error">
            <Icon name="alertCircle" size={18} />
            <div>
              <strong>{error.title}</strong>
              <div>
                {error.status === 409
                  ? (error.explanation
                    ?? 'That number is already registered or already in use — in the yard, on a booking, or held.')
                  : error.explanation ?? error.message}
              </div>
              {error.status === 409 && <div>If someone else saved this box meanwhile, close and re-open this page.</div>}
            </div>
          </div>
        )}

        <div className="gecko-row gecko-row-right">
          <button type="button" className="gecko-btn gecko-btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="gecko-btn gecko-btn-danger" disabled={!ready || busy} onClick={() => void go()}>
            {busy
              ? <><span className="gecko-spinner gecko-spinner-sm gecko-spinner-white" /> Moving the history…</>
              : <><Icon name="edit" size={15} /> Renumber</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** What moved, after the fact. Shown once, then the page follows the new number. */
export function renumberSummary(result: RenumberResult): string {
  const m = result.moved;
  const parts: [number, string][] = [
    [m.containerVisits, 'stay'], [m.gateTransactions, 'EIR'], [m.bookingContainers, 'booking place'],
    [m.holds, 'hold'], [m.surveys, 'survey'], [m.coupons, 'coupon'],
    [m.pickups, 'pick-up'], [m.reservations, 'reservation'], [m.reeferSessions, 'plug session'],
  ];
  const moved = parts.filter(([n]) => n > 0).map(([n, word]) => `${n} ${word}${n === 1 ? '' : 's'}`);
  return moved.length === 0
    ? 'Nothing else pointed at the old number.'
    : `Moved ${moved.join(', ')}. Revenue follows in a moment.`;
}
