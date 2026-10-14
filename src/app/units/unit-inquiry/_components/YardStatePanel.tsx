"use client";
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Field, FormGrid } from '@/components/ui/FormGrid';
import { useToast } from '@/components/ui/Toast';
import { useConditions, useGrades } from '@/lib/api/lookups';
import { ApiError } from '@/lib/api/problem';
import {
  putsOnDamageHold, setEmrRemarks, setVisitCondition, type VisitStateResponse,
} from '@/lib/api/container-master';

/**
 * THE BOX AS IT STANDS — Vector's "Container Status" and "Update EMR Remarks".
 *
 * Both write to the open STAY, not to the registry, which is why they live
 * apart from the identity form: a box's condition belongs to this visit, and
 * the next time it comes through the gate it starts again. Both answer 409
 * once the box has gated out, so the panel is read-only then and says why
 * rather than letting a clerk type into a dead form.
 *
 * Two separate saves, because they are two endpoints and a clerk fixing a typo
 * in the EMR note should not have to restate the condition and a reason for it.
 * Since 2026-10-12 they are also two TABS, so each is exported on its own and
 * `which` says which half to draw. The state and the saves stay together here
 * because both read the same visit and both answer with the same shape.
 *
 * Marking a box DAMAGED puts the depot's damage hold on automatically (owner
 * 2026-10-12). That is a consequence worth warning about BEFORE the save, not
 * explaining after it — so the reason field carries the warning the moment an
 * unserviceable condition is chosen.
 */

export function YardStatePanel({ which, visitId, inYard, conditionCode, gradeCode, emrRemarks, canManage, onChanged }: {
  /** Which half this tab shows. */
  which: 'condition' | 'emr';
  visitId: string | null;
  inYard: boolean;
  conditionCode: string | null;
  gradeCode: string | null;
  emrRemarks: string | null;
  /** tos.yard.manage at this depot. Gate clerks do not have it. */
  canManage: boolean;
  onChanged: (state: VisitStateResponse) => void;
}) {
  if (!visitId) {
    return (
      <section className="gecko-cm-section">
        <div className="gecko-cm-section-head">
          <div className="gecko-eyebrow">{which === 'condition' ? 'The box as it stands' : 'EMR remarks'}</div>
        </div>
        <div className="gecko-cell-meta">
          This box is not in the yard at any depot you cover, so there is no stay to change. Both the condition and
          the EMR note belong to a visit, and start again the next time the box comes through the gate.
        </div>
      </section>
    );
  }
  return (
    <YardState
      // A new stay is a new form: remounting is how the fields follow the box.
      key={visitId}
      which={which}
      visitId={visitId} inYard={inYard} conditionCode={conditionCode} gradeCode={gradeCode}
      emrRemarks={emrRemarks} canManage={canManage} onChanged={onChanged} />
  );
}

function YardState({ which, visitId, inYard, conditionCode, gradeCode, emrRemarks, canManage, onChanged }: {
  which: 'condition' | 'emr';
  visitId: string; inYard: boolean;
  conditionCode: string | null; gradeCode: string | null; emrRemarks: string | null;
  canManage: boolean; onChanged: (state: VisitStateResponse) => void;
}) {
  const { toast } = useToast();
  const { conditions } = useConditions();
  const { grades } = useGrades();

  const [condition, setCondition] = useState(conditionCode ?? '');
  const [grade, setGrade] = useState(gradeCode ?? '');
  const [reason, setReason] = useState('');
  const [savingState, setSavingState] = useState(false);
  const [stateError, setStateError] = useState<ApiError | null>(null);

  const [remarks, setRemarks] = useState(emrRemarks ?? '');
  const [savingEmr, setSavingEmr] = useState(false);
  const [emrError, setEmrError] = useState<ApiError | null>(null);

  const stateDirty = condition !== (conditionCode ?? '') || grade !== (gradeCode ?? '');
  const emrDirty = remarks !== (emrRemarks ?? '');
  const willHold = condition !== (conditionCode ?? '') && putsOnDamageHold(condition, conditions);
  const locked = !canManage || !inYard;

  const saveState = async () => {
    if (!stateDirty) return;
    if (reason.trim().length < 3) {
      setStateError(new ApiError(400, 'Say why', {
        reason: ['Say why in a few words — it goes on the box’s log.'],
      }));
      return;
    }
    setSavingState(true);
    setStateError(null);
    try {
      const state = await setVisitCondition(visitId, {
        // Only what actually moved: a field left out stays as it is.
        ...(condition !== (conditionCode ?? '') ? { conditionCode: condition } : {}),
        ...(grade !== (gradeCode ?? '') ? { gradeCode: grade } : {}),
        reason: reason.trim(),
      });
      toast({
        variant: state.holdsApplied.length > 0 ? 'warning' : 'success',
        title: 'The box was updated',
        message: state.holdsApplied.length > 0
          ? `Hold ${state.holdsApplied.join(', ')} is now on this box.`
          : [state.conditionCode, state.gradeCode].filter(Boolean).join(' / '),
      });
      setReason('');
      onChanged(state);
    } catch (e) {
      setStateError(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
    } finally {
      setSavingState(false);
    }
  };

  const saveEmr = async () => {
    setSavingEmr(true);
    setEmrError(null);
    try {
      const state = await setEmrRemarks(visitId, remarks.trim() || null);
      toast({ variant: 'success', title: 'EMR remarks saved', message: state.containerNo });
      onChanged(state);
    } catch (e) {
      setEmrError(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
    } finally {
      setSavingEmr(false);
    }
  };

  const why = !canManage
    ? <>Changing a standing box needs <code className="gecko-code">tos.yard.manage</code>, which gate clerks do not hold.</>
    : !inYard ? 'The box has gated out on this stay, so its condition and remarks are history now.'
    : null;

  return (
    <div className="gecko-stack gecko-cm-stack">
      {which === 'condition' && (
      <section className="gecko-cm-section">
        <div className="gecko-cm-section-head">
          <div className="gecko-eyebrow"><Icon name="shieldCheck" size={13} /> The box as it stands</div>
          {why && <span className="gecko-cm-readonly">{why}</span>}
        </div>

        {stateError && stateError.status !== 400 && (
          <div className="gecko-alert gecko-alert-error">
            <Icon name="alertCircle" size={18} />
            <div>
              <strong>{stateError.title}</strong>
              {stateError.status === 409
                ? <div>The box gated out while this was open. Re-read the page.</div>
                : stateError.explanation && <div>{stateError.explanation}</div>}
            </div>
          </div>
        )}

        <FormGrid columns={3}>
          <Field label="Condition" error={stateError?.forField('conditionCode')}
            helper="Vector’s “Status”. Set at the gate, by a survey, or here.">
            <select className="gecko-select" value={condition} disabled={locked}
              onChange={e => setCondition(e.target.value)}>
              <option value="">—</option>
              {conditions.map(c => (
                <option key={c.conditionCode} value={c.conditionCode}>{c.conditionCode} · {c.descriptionEn}</option>
              ))}
            </select>
          </Field>

          <Field label="Grade" error={stateError?.forField('gradeCode')}>
            <select className="gecko-select" value={grade} disabled={locked}
              onChange={e => setGrade(e.target.value)}>
              <option value="">—</option>
              {grades.map(g => (
                <option key={g.gradeCode} value={g.gradeCode}>{g.gradeCode} · {g.descriptionEn}</option>
              ))}
            </select>
          </Field>

          <Field label="Why" required={stateDirty} error={stateError?.forField('reason')}
            helper="3 to 300 characters. It goes on the box’s activity log.">
            <input className="gecko-input" value={reason} disabled={locked || !stateDirty} maxLength={300}
              placeholder={stateDirty ? 'Found damaged on a yard walk-round' : 'Change the condition or grade first'}
              onChange={e => setReason(e.target.value)} />
          </Field>
        </FormGrid>

        {willHold && (
          <div className="gecko-alert gecko-alert-warning">
            <Icon name="lock" size={16} />
            <div>
              <strong>This puts the depot’s damage hold on the box.</strong>
              <div>
                {condition} is unserviceable, so saving it holds the box automatically. Nothing releases it until
                someone releases the hold.
              </div>
            </div>
          </div>
        )}

        {!locked && (
          <div className="gecko-cm-save-actions gecko-cm-panel-actions">
            <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm" disabled={!stateDirty || savingState}
              onClick={() => { setCondition(conditionCode ?? ''); setGrade(gradeCode ?? ''); setReason(''); setStateError(null); }}>
              Discard
            </button>
            <button type="button" className="gecko-btn gecko-btn-primary gecko-btn-sm"
              disabled={!stateDirty || savingState} onClick={() => void saveState()}>
              {savingState ? <><span className="gecko-spinner gecko-spinner-sm" /> Saving…</> : <><Icon name="save" size={14} /> Update status</>}
            </button>
          </div>
        )}
      </section>
      )}

      {which === 'emr' && (
      <section className="gecko-cm-section">
        <div className="gecko-cm-section-head">
          <div className="gecko-eyebrow"><Icon name="tool" size={13} /> EMR remarks</div>
          <span className="gecko-cell-meta">Shown to the gate as a note when the box goes out.</span>
        </div>

        {emrError && (
          <div className="gecko-alert gecko-alert-error">
            <Icon name="alertCircle" size={18} />
            <div>
              <strong>{emrError.title}</strong>
              {emrError.status === 409
                ? <div>The box gated out while this was open.</div>
                : <div>{emrError.forField('remarks') ?? emrError.explanation}</div>}
            </div>
          </div>
        )}

        <textarea className="gecko-textarea" rows={3} value={remarks} disabled={locked} maxLength={500}
          placeholder="Awaiting line approval for the door repair"
          onChange={e => setRemarks(e.target.value)} />
        <div className="gecko-cell-meta">{remarks.length} / 500. Clearing it removes the note.</div>

        {!locked && (
          <div className="gecko-cm-save-actions gecko-cm-panel-actions">
            <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm" disabled={!emrDirty || savingEmr}
              onClick={() => { setRemarks(emrRemarks ?? ''); setEmrError(null); }}>
              Discard
            </button>
            <button type="button" className="gecko-btn gecko-btn-primary gecko-btn-sm"
              disabled={!emrDirty || savingEmr} onClick={() => void saveEmr()}>
              {savingEmr ? <><span className="gecko-spinner gecko-spinner-sm" /> Saving…</> : <><Icon name="save" size={14} /> Save remarks</>}
            </button>
          </div>
        )}
      </section>
      )}
    </div>
  );
}
