"use client";
import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/problem';
import { useFacility } from '@/lib/api/facility';
import { useSession } from '@/lib/auth/session';
import { formatContainerNo } from '@/lib/api/tos';
import { instantFromLocalInput, localInputValue } from '@/lib/format';
import {
  GATE_OVERRIDE, canOverrideRefusal, moveYardBox, useYardHasSlots, useYardSettings, type YardLocation,
} from '@/lib/api/yard-map';
import { SlotPicker } from './SlotPicker';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

/**
 * MOVE A BOX THAT IS ALREADY IN THE DEPOT.
 *
 * Not a gate-out and a gate-in: the stay keeps its one row, and the move goes
 * on the box's journal as SHIFT (from → to, the reason in its remarks), which
 * is what the container master then shows. `POST /api/tos/yard/moves`, which
 * needs `tos.yard.manage` at the depot — a clerk without it is never shown
 * this dialog.
 *
 * TWO WAYS TO SAY WHERE, because a depot has both:
 *   A SLOT — the normal case in a yard that is mapped. The same stack picker
 *            the gate uses, so it is the same decision made the same way.
 *   AN AREA — a wash bay, the M&R line, a corner with no slots. Free text, and
 *            a yard select, because an area may be in another yard.
 *
 * THE DIG IS CHECKED FIRST. A box with another standing on top of it cannot be
 * moved at all, and the API refuses with a 409 naming them. `boxesOnTop` from
 * the locate read says so before the clerk fills anything in, and offers to
 * move the top box instead — which is what has to happen anyway.
 *
 * THE YARD'S RULES APPLY HERE TOO (Phase 3). A slot that breaks one is refused
 * with the server's own sentence, and a supervisor (`tos.gate.override`) may
 * take it anyway with a reason, which is kept on the box's SHIFT history after
 * the move's own reason. Anyone else is told to pick another slot.
 */
export function MoveBoxDialog({ location, onClose, onMoved, onMoveInstead }: {
  /** Where the box stands now, from `/yard/locate` or a move's own answer. */
  location: YardLocation;
  onClose: () => void;
  /** The move landed: the box's new place. */
  onMoved: (to: YardLocation) => void;
  /** The clerk chose to move the box standing on top of this one instead. */
  onMoveInstead?: (containerNo: string) => void;
}) {
  const { yards } = useFacility();
  const { canAt } = useSession();
  const { toast } = useToast();
  /** A supervisor may stow against the yard's rules, with a written reason. */
  const canOverride = canAt(GATE_OVERRIDE, location.branchId);

  /**
   * THE DEPOT'S OWN WAY OF SAYING WHERE, until the clerk says otherwise.
   *
   * KORAKIT locates by AREA — a typed code like ก — and has no stacks to
   * pick from, so a dialog that always opened on the slot picker opened on an
   * empty list and the clerk had to know to click past it. The depot's setting
   * decides which radio starts on; choosing one pins it for the rest of the
   * dialog, settings or not.
   */
  const { locationMode } = useYardSettings();
  const [howPicked, setHowPicked] = useState<'SLOT' | 'AREA' | null>(null);
  const [yardId, setYardId] = useState<string>(location.yardId ?? yards[0]?.yardId ?? '');
  // A yard with no slots has nothing to pick, whatever the depot's mode says.
  const yardSlots = useYardHasSlots(yardId || null);
  const how: 'SLOT' | 'AREA' = howPicked
    ?? (locationMode === 'AREA' || (yardSlots.known && !yardSlots.hasSlots) ? 'AREA' : 'SLOT');
  const setHow = setHowPicked;
  const [slot, setSlot] = useState<{ yardSlotId: string; label: string } | null>(null);
  /**
   * A SLOT KEYED RATHER THAN CLICKED. The API reads it as a slot of this yard
   * and checks it exactly as a picked one, so a clerk who knows the label need
   * not go looking for it on the map.
   */
  const [slotText, setSlotText] = useState('');
  /**
   * The box's own area to start from: correcting ก to ข is an edit of one
   * character, not a field to fill from scratch. A box standing in a SLOT
   * starts empty — its position text is the slot's label, which would be the
   * wrong thing to type into an area.
   */
  const [areaTyped, setAreaTyped] = useState<string | null>(null);
  const area = areaTyped ?? (location.yardSlotId ? '' : location.positionText ?? '');
  const setArea = setAreaTyped;
  const [reason, setReason] = useState('');
  const [override, setOverride] = useState('');
  const [when, setWhen] = useState(() => localInputValue());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  /** Bumped on a 409 so the picker re-reads: somebody just took that slot. */
  const [reloadKey, setReloadKey] = useState(0);

  const onTop = location.boxesOnTop ?? [];
  const blocked = onTop.length > 0;

  const send = async () => {
    setSaving(true);
    setError(null);
    try {
      const keyed = slotText.trim().toUpperCase();
      const to = await moveYardBox({
        branchId: location.branchId,
        containerNo: location.containerNo,
        toYardSlotId: how === 'SLOT' ? slot?.yardSlotId ?? null : null,
        // An area move names its yard; a PICKED slot names its own, so sending
        // the yard with it would only be another thing that can disagree. A
        // KEYED slot does need it: the text is read as a slot OF THAT YARD.
        toYardId: how === 'AREA' || (how === 'SLOT' && !slot && keyed) ? yardId || null : null,
        toPositionText: how === 'AREA'
          ? area.trim().toUpperCase() || null
          : slot ? null : keyed || null,
        reason: reason.trim() || null,
        // Only once the yard has refused a rule and the user may override it:
        // a reason from anyone else is a 400 on this field.
        overrideReason: canOverride && override.trim() ? override.trim() : null,
        movedAt: instantFromLocalInput(when),
      });
      toast({
        variant: 'success',
        title: `Moved ${to.containerNo} to ${to.positionText ?? 'the yard'}`,
        message: to.yardCode ? `In ${to.yardCode}.` : undefined,
      });
      onMoved(to);
      onClose();
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.');
      setError(err);
      // 409 is either "a box stands on top" or "that slot was just taken" —
      // the second is worth re-reading the stacks for.
      if (err.status === 409) setReloadKey(k => k + 1);
    } finally {
      setSaving(false);
    }
  };

  const ready = how === 'SLOT' ? (!!slot || slotText.trim().length > 0) : area.trim().length > 0;
  /** The 409 that names a box standing on top, so it can be offered instead. */
  const standsOnTop = error?.status === 409 ? onTop[0] ?? null : null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Move ${formatContainerNo(location.containerNo)}`}
      subtitle={[
        location.yardCode,
        location.positionText ?? (location.yardSlotId ? 'in a slot' : 'no position recorded'),
        `${location.daysInYard} days in yard`,
      ].filter(Boolean).join(' · ')}
      size="lg"
      footer={
        <div className="gecko-row gecko-row-between gecko-movebox-footer">
          <span className="gecko-cell-meta">
            The box keeps its stay; the move is recorded on its history.
          </span>
          <div className="gecko-row gecko-movebox-actions">
            <button className="gecko-btn gecko-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="gecko-btn gecko-btn-primary" onClick={() => void send()}
              disabled={saving || !ready || blocked}>
              <Icon name="transferH" size={14} /> {saving ? 'Moving…' : 'Move box'}
            </button>
          </div>
        </div>
      }
    >
      <div className="gecko-stack gecko-movebox">

        {blocked && (
          <div role="alert" className="gecko-alert gecko-alert-warning gecko-row gecko-movebox-dig">
            <Icon name="warning" size={16} />
            <div className="gecko-flex-1">
              <strong>{onTop.join(', ')} {onTop.length === 1 ? 'stands' : 'stand'} on top of this box.</strong>
              {' '}It cannot be lifted until they are moved.
            </div>
            {onMoveInstead && (
              <button className="gecko-btn gecko-btn-outline gecko-btn-sm"
                onClick={() => onMoveInstead(onTop[onTop.length - 1])}>
                Move {onTop[onTop.length - 1]} first
              </button>
            )}
          </div>
        )}

        <div className="gecko-row gecko-movebox-how">
          <label className="gecko-row gecko-movebox-radio">
            <input type="radio" checked={how === 'SLOT'} onChange={() => setHow('SLOT')} disabled={saving} />
            <span>To a slot</span>
          </label>
          <label className="gecko-row gecko-movebox-radio">
            <input type="radio" checked={how === 'AREA'} onChange={() => setHow('AREA')} disabled={saving} />
            <span>To an area</span>
          </label>
        </div>

        {how === 'SLOT' ? (
          <div className="gecko-field">
            <label className="gecko-field-label">Yard and slot</label>
            <div className="gecko-row gecko-movebox-yardrow">
              <select className="gecko-input gecko-input-sm gecko-yard-select" value={yardId} aria-label="Yard"
                disabled={saving} onChange={e => { setYardId(e.target.value); setSlot(null); }}>
                {yards.map(y => <option key={y.yardId} value={y.yardId}>{y.yardCode} · {y.nameEn}</option>)}
              </select>
            </div>
            <SlotPicker
              yardId={yardId || null}
              value={slot?.yardSlotId ?? null}
              valueLabel={slot?.label ?? null}
              onChange={setSlot}
              disabled={saving || blocked}
              reloadKey={reloadKey}
              keyIn={{
                text: slotText,
                error: error?.forField('toPositionText') ?? null,
                onText: setSlotText,
              }}
              // The box is already in the yard, so the yard reads its own facts
              // — type, line, customer, DG, out of gauge — and leaves its
              // current slot out of the suggestions.
              suggestFor={yardId ? { yardId, containerNo: location.containerNo, limit: 5 } : null}
            />
            {error?.forField('toYardSlotId') && (
              <div className="gecko-field-error">{error.forField('toYardSlotId')}</div>
            )}

            {/* THE RULE THE SLOT BREAKS, and who may overrule it. */}
            {canOverrideRefusal(error?.forField('toYardSlotId')) && (
              canOverride
                ? (
                  <div className="gecko-field gecko-movebox-override">
                    <label className="gecko-field-label">Override reason *</label>
                    <input className="gecko-input gecko-input-sm" maxLength={300} value={override}
                      placeholder="Why this slot is right anyway"
                      disabled={saving}
                      onChange={e => setOverride(e.target.value)} />
                    <div className="gecko-field-hint">
                      Kept on the box&apos;s history with the move. Leave it empty to pick another slot instead.
                    </div>
                    {error?.forField('overrideReason') && (
                      <div className="gecko-field-error">{error.forField('overrideReason')}</div>
                    )}
                  </div>
                )
                : (
                  <div className="gecko-cell-meta gecko-movebox-override">
                    Only a supervisor (gate override) can use a slot that breaks the yard&apos;s rules
                    — pick another, or ask one.
                  </div>
                )
            )}
          </div>
        ) : (
          <div className="gecko-grid-2 gecko-movebox-fields">
            <div className="gecko-field">
              <label className="gecko-field-label">Yard</label>
              <select className="gecko-input gecko-input-sm" value={yardId} aria-label="Yard"
                disabled={saving} onChange={e => setYardId(e.target.value)}>
                {yards.map(y => <option key={y.yardId} value={y.yardId}>{y.yardCode} · {y.nameEn}</option>)}
              </select>
            </div>
            <div className="gecko-field">
              <label className="gecko-field-label">Area</label>
              <input className="gecko-input gecko-input-sm gecko-text-mono" maxLength={30} value={area}
                placeholder="e.g. WASH BAY 2" disabled={saving}
                onChange={e => setArea(e.target.value.toUpperCase())} />
              {error?.forField('toPositionText') && (
                <div className="gecko-field-error">{error.forField('toPositionText')}</div>
              )}
            </div>
          </div>
        )}

        <div className="gecko-grid-2 gecko-movebox-fields">
          <div className="gecko-field">
            <label className="gecko-field-label">Reason</label>
            <input className="gecko-input gecko-input-sm" maxLength={500} value={reason}
              placeholder="e.g. Restow for line pick-up" disabled={saving}
              onChange={e => setReason(e.target.value)} />
            <div className="gecko-field-hint">Kept on the box&apos;s history beside the move.</div>
          </div>
          <div className="gecko-field">
            <label className="gecko-field-label">When</label>
            <input className="gecko-input gecko-input-sm" type="datetime-local" value={when}
              disabled={saving} onChange={e => setWhen(e.target.value)} />
            {error?.forField('movedAt') && <div className="gecko-field-error">{error.forField('movedAt')}</div>}
          </div>
        </div>

        {error && !error.forField('toYardSlotId') && !error.forField('toPositionText') && !error.forField('movedAt') && (
          <ErrorBanner
            error={error}
            className="gecko-movebox-error"
            action={standsOnTop && onMoveInstead
              ? <button type="button" className="gecko-error-banner-link" onClick={() => onMoveInstead(standsOnTop)}>
                Move {standsOnTop} instead
              </button>
              : undefined}
          />
        )}
      </div>
    </Modal>
  );
}
