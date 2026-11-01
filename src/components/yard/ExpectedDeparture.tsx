"use client";
import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/problem';
import { formatDateTime, instantFromLocalInput, localInputValue } from '@/lib/format';
import { formatContainerNo } from '@/lib/api/tos';
import { departureSourceLabel, setExpectedDeparture } from '@/lib/api/yard-work';
import type { DepartureSource } from '@/lib/api/yard-map';

/**
 * WHEN THIS BOX IS EXPECTED TO LEAVE, and who says so.
 *
 * The yard's one piece of foresight, and the only reason it can stow well: a
 * box leaving tomorrow should not be buried under one leaving next month. The
 * suggestions read it, pre-staging lists by it, and the planner sets it when
 * they know something the records do not — a customer's phone call, a vessel
 * running late.
 *
 * FOUR WAYS IT IS ALREADY KNOWN before anyone types anything: a truck planned
 * to collect it, an export's vessel ETD, the end of the booking's valid-to, or
 * nothing. The source is shown beside the date because "in two days" means a
 * different thing when a planner set it than when it is the last day of a
 * booking nobody has acted on. Setting it by hand makes the source PLANNER,
 * which outranks the rest; clearing it goes back to whatever can be derived.
 */
export function ExpectedDepartureLine({ branchId, containerNo, at, source, note, canEdit, onChanged }: {
  branchId: string;
  containerNo: string;
  at: string | null;
  source: DepartureSource | string | null | undefined;
  note: string | null;
  /** `tos.yard.manage` at this depot. */
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      <div className="gecko-row gecko-row-wrap gecko-departure">
        <span className="gecko-eyebrow">Expected out</span>
        <span className="gecko-departure-when">{at ? formatDateTime(at) : 'not known'}</span>
        <span className="gecko-cell-meta">({departureSourceLabel(source)})</span>
        {note && <span className="gecko-cell-meta gecko-departure-note">{note}</span>}
        {canEdit && (
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={() => setEditing(true)}>
            <Icon name="edit" size={13} /> Edit
          </button>
        )}
      </div>
      {editing && (
        <EditDeparture
          branchId={branchId} containerNo={containerNo} at={at} note={note}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); onChanged(); }}
        />
      )}
    </>
  );
}

function EditDeparture({ branchId, containerNo, at, note, onClose, onSaved }: {
  branchId: string; containerNo: string; at: string | null; note: string | null;
  onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [when, setWhen] = useState(() => (at ? localInputValue(new Date(at)) : localInputValue()));
  const [why, setWhy] = useState(note ?? '');
  const [saving, setSaving] = useState<'SET' | 'CLEAR' | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const send = async (clear: boolean) => {
    setSaving(clear ? 'CLEAR' : 'SET');
    setError(null);
    try {
      const saved = await setExpectedDeparture({
        branchId,
        containerNo,
        expectedDepartureAt: clear ? null : instantFromLocalInput(when),
        note: clear ? null : why.trim() || null,
      });
      toast({
        variant: 'success',
        title: clear ? `${containerNo}: date cleared` : `${containerNo} expected out`,
        message: saved.expectedDepartureAt
          ? `${formatDateTime(saved.expectedDepartureAt)} (${departureSourceLabel(saved.source)}).`
          : 'Nothing says when it leaves now.',
      });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
    } finally {
      setSaving(null);
    }
  };

  return (
    <Modal
      isOpen onClose={onClose}
      title={`When does ${formatContainerNo(containerNo)} leave?`}
      subtitle="A planner's date outranks the vessel's ETD and the booking's last day."
      footer={
        <div className="gecko-row gecko-row-between gecko-sheet-footer">
          <button className="gecko-btn gecko-btn-ghost" onClick={onClose} disabled={!!saving}>Cancel</button>
          <div className="gecko-row gecko-sheet-actions">
            <button className="gecko-btn gecko-btn-outline" disabled={!!saving} onClick={() => void send(true)}>
              {saving === 'CLEAR' ? 'Clearing…' : 'Clear'}
            </button>
            <button className="gecko-btn gecko-btn-primary" disabled={!!saving || !when} onClick={() => void send(false)}>
              <Icon name="save" size={14} /> {saving === 'SET' ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      }
    >
      <div className="gecko-stack gecko-sheet">
        <div className="gecko-field">
          <label className="gecko-field-label">Expected out *</label>
          <input className="gecko-input" type="datetime-local" value={when} disabled={!!saving}
            aria-label="Expected departure" onChange={e => setWhen(e.target.value)} />
        </div>
        <div className="gecko-field">
          <label className="gecko-field-label">Note</label>
          <input className="gecko-input" maxLength={200} value={why} disabled={!!saving}
            placeholder="e.g. Customer collecting Friday morning" onChange={e => setWhy(e.target.value)} />
          <div className="gecko-field-hint">
            Clearing the date leaves the yard to work it out again from the truck, the vessel or the booking.
          </div>
        </div>
        {error && (
          <div className="gecko-field-error">
            {error.forField('expectedDepartureAt') ?? error.forField('containerNo') ?? error.explanation ?? error.message}
          </div>
        )}
      </div>
    </Modal>
  );
}
