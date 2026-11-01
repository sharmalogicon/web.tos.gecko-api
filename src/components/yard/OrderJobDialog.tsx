"use client";
import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import { BarcodeScanInput } from '@/components/ui/BarcodeDisplay';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/problem';
import { useFacility } from '@/lib/api/facility';
import { formatContainerNo } from '@/lib/api/tos';
import { normaliseContainerNo } from '@/lib/api/container-story';
import { orderYardJob } from '@/lib/api/yard-work';
import { SlotPicker } from './SlotPicker';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

/**
 * THE PLANNER ORDERS WORK: move this box, or bring that one out.
 *
 * A PULL is the interesting one. Ordering it also orders a RELOCATE "dig" for
 * every box standing on top of it, so the answer is a LIST of jobs and the
 * toast says how many — a planner pulling one box has to know they just made
 * three moves for the shift.
 *
 * Two screens open this: the work list (its Order work button) and the stack
 * view on Yard at a Glance, where a planner is already looking at the box they
 * want moved. Same decision, same dialog.
 */
export function OrderJobDialog({ branchId, containerNo, kind, onClose, onOrdered }: {
  branchId: string;
  /** Pre-filled when a box was picked on the map; otherwise scanned here. */
  containerNo?: string | null;
  /** Which job the caller came to order; the dialog can still be switched. */
  kind?: 'RELOCATE' | 'PULL';
  onClose: () => void;
  /** Ordered: the caller may want to refresh a list. */
  onOrdered?: () => void;
}) {
  const { yards, yard: headerYard } = useFacility();
  const { toast } = useToast();

  const [jobType, setJobType] = useState<'RELOCATE' | 'PULL'>(kind ?? 'RELOCATE');
  const [typed, setTyped] = useState(containerNo ?? '');
  const [yardId, setYardId] = useState(headerYard?.yardId ?? yards[0]?.yardId ?? '');
  const [where, setWhere] = useState<'DRIVER' | 'SLOT' | 'AREA'>('DRIVER');
  const [slot, setSlot] = useState<{ yardSlotId: string; label: string } | null>(null);
  /** The slot keyed rather than clicked; the API reads it as a slot of the yard. */
  const [slotText, setSlotText] = useState('');
  const [area, setArea] = useState('');
  const [priority, setPriority] = useState(5);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const box = normaliseContainerNo(typed);
  const ready = box.length >= 4
    // A slot that was keyed rather than clicked is an answer too.
    && (jobType === 'PULL' || where === 'DRIVER'
      || (where === 'SLOT' ? !!slot || slotText.trim().length > 0 : area.trim().length > 0));

  const send = async () => {
    setSaving(true);
    setError(null);
    try {
      const made = await orderYardJob({
        branchId,
        jobType,
        containerNo: box,
        toYardId: jobType === 'PULL' || where === 'DRIVER' ? null : yardId || null,
        toYardSlotId: jobType === 'PULL' || where !== 'SLOT' ? null : slot?.yardSlotId ?? null,
        // A slot keyed instead of clicked travels as the position text, which
        // the API reads as a slot of the yard above — same check, fewer clicks.
        toPositionText: jobType === 'PULL' ? null
          : where === 'AREA' ? area.trim().toUpperCase() || null
          : where === 'SLOT' && !slot ? slotText.trim().toUpperCase() || null
          : null,
        priority,
        reason: reason.trim() || null,
      });
      const digs = made.filter(j => j.forYardJobId);
      toast({
        variant: 'success',
        title: jobType === 'PULL'
          ? `Pull ordered — ${digs.length} ${digs.length === 1 ? 'dig' : 'digs'} first`
          : `Relocate ordered for ${box}`,
        message: digs.length > 0 ? `Dig: ${digs.map(j => j.containerNo).join(', ')}` : undefined,
      });
      onOrdered?.();
      onClose();
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.');
      // A 404 here means one thing only, and the bare "Not found" does not say it.
      setError(err.status === 404
        ? new ApiError(404, `${box} is not standing in this depot.`, {}, undefined,
          `${box} is not in the yard`, 'Only a box with an open stay can be ordered about.')
        : err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Order yard work"
      subtitle={containerNo ? formatContainerNo(containerNo) : undefined}
      size="lg"
      footer={
        <div className="gecko-row gecko-row-between gecko-sheet-footer">
          <button className="gecko-btn gecko-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="gecko-btn gecko-btn-primary" disabled={saving || !ready} onClick={() => void send()}>
            <Icon name="plus" size={14} /> {saving ? 'Ordering…' : 'Order it'}
          </button>
        </div>
      }
    >
      <div className="gecko-stack gecko-sheet">
        <div className="gecko-row gecko-row-wrap gecko-sheet-radio-row">
          <label className="gecko-row gecko-sheet-radio">
            <input type="radio" checked={jobType === 'RELOCATE'} onChange={() => setJobType('RELOCATE')} disabled={saving} />
            <span>Relocate — move it inside the yard</span>
          </label>
          <label className="gecko-row gecko-sheet-radio">
            <input type="radio" checked={jobType === 'PULL'} onChange={() => setJobType('PULL')} disabled={saving} />
            <span>Pull — bring it out for a truck</span>
          </label>
        </div>

        {containerNo
          ? (
            <div className="gecko-field">
              <label className="gecko-field-label">Container</label>
              <div className="gecko-readonly-value gecko-text-mono">{formatContainerNo(box)}</div>
            </div>
          )
          : (
            <div className="gecko-field">
              <label className="gecko-field-label">Container *</label>
              <BarcodeScanInput onScan={raw => setTyped(raw)} placeholder="Scan or type the container number…" />
              {box !== '' && <div className="gecko-cell-meta gecko-text-mono">{formatContainerNo(box)}</div>}
            </div>
          )}
        {error?.forField('containerNo') && <div className="gecko-field-error">{error.forField('containerNo')}</div>}

        {jobType === 'RELOCATE' && (
          <div className="gecko-stack gecko-sheet-where">
            <div className="gecko-field-label">Where to?</div>
            <label className="gecko-row gecko-sheet-radio">
              <input type="radio" checked={where === 'DRIVER'} onChange={() => setWhere('DRIVER')} disabled={saving} />
              <span>The driver decides</span>
            </label>
            <label className="gecko-row gecko-sheet-radio">
              <input type="radio" checked={where === 'SLOT'} onChange={() => setWhere('SLOT')} disabled={saving} />
              <span>A slot</span>
            </label>
            <label className="gecko-row gecko-sheet-radio">
              <input type="radio" checked={where === 'AREA'} onChange={() => setWhere('AREA')} disabled={saving} />
              <span>An area</span>
            </label>

            {where !== 'DRIVER' && yards.length > 1 && (
              <select className="gecko-input gecko-input-sm gecko-yard-select" value={yardId} aria-label="Yard"
                disabled={saving} onChange={e => { setYardId(e.target.value); setSlot(null); }}>
                {yards.map(y => <option key={y.yardId} value={y.yardId}>{y.yardCode} · {y.nameEn}</option>)}
              </select>
            )}
            {where === 'SLOT' && (
              <SlotPicker
                yardId={yardId || null}
                value={slot?.yardSlotId ?? null}
                valueLabel={slot?.label ?? null}
                onChange={setSlot}
                disabled={saving}
                suggestFor={yardId && box.length >= 4 ? { yardId, containerNo: box, limit: 5 } : null}
                keyIn={{
                  text: slotText,
                  error: error?.forField('toPositionText') ?? null,
                  onText: setSlotText,
                }}
              />
            )}
            {where === 'AREA' && (
              <input className="gecko-input gecko-text-mono" maxLength={30} value={area} disabled={saving}
                placeholder="e.g. M&R LINE" aria-label="Area"
                onChange={e => setArea(e.target.value.toUpperCase())} />
            )}
            {error?.forField('toYardSlotId') && <div className="gecko-field-error">{error.forField('toYardSlotId')}</div>}
          </div>
        )}

        <div className="gecko-grid-2 gecko-sheet-fields">
          <div className="gecko-field">
            <label className="gecko-field-label">Priority</label>
            <select className="gecko-input gecko-input-sm" value={priority} disabled={saving}
              onChange={e => setPriority(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(p => (
                <option key={p} value={p}>
                  {p}{p === 1 ? ' — first' : p === 5 ? ' — normal' : p === 9 ? ' — last' : ''}
                </option>
              ))}
            </select>
            <div className="gecko-field-hint">A dig is ordered one rank sooner than its pull.</div>
          </div>
          <div className="gecko-field">
            <label className="gecko-field-label">Reason</label>
            <input className="gecko-input gecko-input-sm" maxLength={500} value={reason} disabled={saving}
              placeholder="e.g. Restow for line pick-up" onChange={e => setReason(e.target.value)} />
          </div>
        </div>

        {error && !error.forField('containerNo') && !error.forField('toYardSlotId') && (
          <ErrorBanner error={error} className="gecko-sheet-error" />
        )}
      </div>
    </Modal>
  );
}
