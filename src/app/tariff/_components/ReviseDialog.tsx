"use client";
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { DateField } from '@/components/ui/DateField';
import { Field, FormGrid } from '@/components/ui/FormGrid';
import { formatDate } from '@/lib/format';

/**
 * STARTING THE NEXT VERSION OF AN APPROVED TARIFF.
 *
 * An approved price is one somebody has quoted to a customer, so it is never
 * edited — a change is a new version. The API copies the whole thing: every
 * priced row with its axes, its tiers, its conditions and their values, the
 * storage and time rows, and the free-time rules. The header comes too, down to
 * the currency, the parties and whether prices include tax.
 *
 * WHAT CHANGES IS THE DATES. That is the whole point of a revision, and it is
 * why this is three fields rather than the one date it used to ask for: the end
 * date is on the API's contract (`effectiveTo`) and was simply never sent, so a
 * clerk who wanted a tariff to run to a fixed day had to create it open-ended
 * and go and change it afterwards.
 *
 * The copy is listed before the button, not after, because "58 move charges and
 * 8 storage rows are coming with this" is the fact that tells a clerk they are
 * about to do the right thing.
 */

export interface ReviseValues {
  effectiveFrom: string;
  /** '' = open-ended, which is what most tariffs are. */
  effectiveTo: string;
  name: string;
}

export function ReviseDialog({ versionNo, scheduleNo, name, currentFrom, currentUntil, moveRows, timeRows, freeTimeRules, initialFrom, busy, onClose, onConfirm }: {
  versionNo: number;
  scheduleNo: string;
  name: string;
  currentFrom: string;
  currentUntil: string | null;
  moveRows: number;
  timeRows: number;
  freeTimeRules: number;
  initialFrom: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (values: ReviseValues) => void | Promise<void>;
}) {
  const [from, setFrom] = useState(initialFrom);
  const [until, setUntil] = useState('');
  const [title, setTitle] = useState(name);

  // The API refuses both of these; saying so here saves the round trip.
  const startsTooEarly = Boolean(from) && from <= currentFrom;
  const endsBeforeItStarts = Boolean(until) && Boolean(from) && until < from;
  const ready = Boolean(from) && !startsTooEarly && !endsBeforeItStarts && title.trim().length > 0;

  return (
    <Modal
      isOpen
      onClose={busy ? () => {} : onClose}
      size="md"
      title={`Start version ${versionNo + 1} of ${scheduleNo}`}
      subtitle="An approved price is frozen, so a change is a new version."
      footer={
        <>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={!ready || busy}
            onClick={() => void onConfirm({ effectiveFrom: from, effectiveTo: until, name: title.trim() })}>
            {busy
              ? <><span className="gecko-spinner gecko-spinner-sm gecko-spinner-white" /> Copying…</>
              : <><Icon name="copy" size={13} /> Create the draft</>}
          </button>
        </>
      }
    >
      <div className="gecko-stack gecko-stack-md">

        {/* What comes across, before the dates, because it is the reassurance. */}
        <div className="gecko-revise-carry">
          <div className="gecko-eyebrow">Copied into the new version</div>
          <ul className="gecko-revise-list">
            <li><strong>{moveRows}</strong> move charge{moveRows === 1 ? '' : 's'}, with every tier and condition</li>
            <li><strong>{timeRows}</strong> storage &amp; time row{timeRows === 1 ? '' : 's'}</li>
            <li><strong>{freeTimeRules}</strong> free-time rule{freeTimeRules === 1 ? '' : 's'}</li>
            <li>The header — customer, currency, tax treatment and scope</li>
          </ul>
          <div className="gecko-cell-meta">
            Everything is editable on the draft until you submit it for approval.
          </div>
        </div>

        <FormGrid columns={2}>
          <Field label="In force from" required
            error={startsTooEarly ? `Later than v${versionNo}, which starts ${formatDate(currentFrom)}.` : undefined}
            helper={!startsTooEarly ? `v${versionNo} runs from ${formatDate(currentFrom)}${currentUntil ? ` to ${formatDate(currentUntil)}` : ' open-ended'}.` : undefined}>
            <DateField value={from} onChange={setFrom} aria-label="In force from" />
          </Field>

          <Field label="In force until"
            error={endsBeforeItStarts ? 'The end date is before the start date.' : undefined}
            helper={!endsBeforeItStarts && !until
              ? 'Leave it empty for open-ended — the next approved version ends it.'
              : undefined}>
            <DateField value={until} onChange={setUntil} aria-label="In force until" />
          </Field>

          <Field label="Name" required full
            helper="Carried from this version; change it if the new one is called something else.">
            <input className="gecko-input" value={title} maxLength={200}
              onChange={e => setTitle(e.target.value)} />
          </Field>
        </FormGrid>
      </div>
    </Modal>
  );
}
