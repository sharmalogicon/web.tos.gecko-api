"use client";
import React from 'react';
import { Icon } from '@/components/ui/Icon';
import type { ApiError } from '@/lib/api/problem';
import type { OrderTypeStep, OrderTypeVocabulary, SaveOrderTypeStep } from '@/lib/api/order-types';

/**
 * The gate steps of one order type, walked 1..n. Each row is a movement with the
 * five gate rules the barrier enforces AT THAT STEP (Vector proved they differ
 * per step: weighed at the laden-in, not at the empty-out).
 *
 * The sequence is the row order — no number to type, so no gaps to make. The
 * request sends rows in this order, so the API's movements[i] errors are this
 * table's row i.
 */

export interface StepRow {
  key: string;
  movementCode: string;
  pudoMode: string;
  isRequired: boolean;
  isBillable: boolean;
  checkSealNo: boolean;
  checkGrossWeight: boolean;
  requireVesselVoyage: boolean;
  allowDamagedRelease: boolean;
  skipEdi: boolean;
}

let nextKey = 0;
const newKey = () => `step-${++nextKey}`;

export const RULES: { key: keyof StepRow; label: string; hint: string }[] = [
  { key: 'checkSealNo', label: 'Seal', hint: 'Gate clerk must capture / match the seal number' },
  { key: 'checkGrossWeight', label: 'Weight', hint: 'Gross weight required and checked against max gross' },
  { key: 'requireVesselVoyage', label: 'Vessel', hint: 'The move must name a vessel call' },
  { key: 'allowDamagedRelease', label: 'Damaged ok', hint: 'A box flagged damaged may still pass this step' },
  { key: 'skipEdi', label: 'No EDI', hint: 'No gate message is sent to the line for this step' },
];

export const rowsFromSteps = (steps: OrderTypeStep[]): StepRow[] =>
  [...steps].sort((a, b) => a.sequenceNo - b.sequenceNo).map(s => ({
    key: newKey(),
    movementCode: s.movementCode,
    pudoMode: s.pudoMode ?? '',
    isRequired: s.isRequired,
    isBillable: s.isBillable,
    checkSealNo: s.checkSealNo,
    checkGrossWeight: s.checkGrossWeight,
    requireVesselVoyage: s.requireVesselVoyage,
    allowDamagedRelease: s.allowDamagedRelease,
    skipEdi: s.skipEdi,
  }));

export const blankStep = (): StepRow => ({
  key: newKey(), movementCode: '', pudoMode: '', isRequired: true, isBillable: true,
  checkSealNo: false, checkGrossWeight: false, requireVesselVoyage: false, allowDamagedRelease: false, skipEdi: false,
});

export const requestFromSteps = (rows: StepRow[]): SaveOrderTypeStep[] => rows.map((r, i) => ({
  movementCode: r.movementCode,
  sequenceNo: i + 1,
  isRequired: r.isRequired,
  isBillable: r.isBillable,
  checkSealNo: r.checkSealNo,
  checkGrossWeight: r.checkGrossWeight,
  requireVesselVoyage: r.requireVesselVoyage,
  allowDamagedRelease: r.allowDamagedRelease,
  skipEdi: r.skipEdi,
  pudoMode: r.pudoMode || null,
}));

export function stepErrors(rows: StepRow[]): Record<string, string> {
  const e: Record<string, string> = {};
  if (rows.length === 0) e.movements = 'Add at least one step — without steps the gate cannot process this order type.';
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    if (!r.movementCode) e[`movements[${i}].movementCode`] = 'Pick a movement.';
    else if (seen.has(r.movementCode)) e[`movements[${i}].movementCode`] = `${r.movementCode} appears twice — each movement once per order type.`;
    seen.add(r.movementCode);
  });
  return e;
}

export function StepsEditor({ rows, onChange, vocabulary, localErrors, apiError }: {
  rows: StepRow[];
  onChange: (rows: StepRow[]) => void;
  vocabulary: OrderTypeVocabulary;
  localErrors: Record<string, string>;
  apiError: ApiError | null;
}) {
  const err = (key: string) => localErrors[key] ?? apiError?.forField(key);
  const set = (i: number, patch: Partial<StepRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, by: -1 | 1) => {
    const next = [...rows];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    onChange(next);
  };
  // A step already on the order type may use a movement that has since been deactivated: keep it selectable.
  const movementOptions = (current: string) =>
    vocabulary.movements.some(m => m.code === current) || !current
      ? vocabulary.movements
      : [{ code: current, name: 'inactive', direction: '', fullEmpty: '' }, ...vocabulary.movements];

  return (
    <div className="gecko-stack gecko-stack-sm">
      {err('movements') && <div className="gecko-field-error">{err('movements')}</div>}
      <div className="gecko-table-card">
        <table className="gecko-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Movement</th>
              <th>Pick-up / drop-off</th>
              <th title="A box cannot skip a required step">Required</th>
              <th title="This step can raise charges">Billable</th>
              {RULES.map(r => <th key={r.key} title={r.hint}>{r.label}</th>)}
              <th aria-label="Order and remove" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8 + RULES.length} className="gecko-cell-meta">No steps yet — add the first below.</td></tr>}
            {rows.map((r, i) => {
              const messages = [err(`movements[${i}]`), err(`movements[${i}].movementCode`), err(`movements[${i}].sequenceNo`), err(`movements[${i}].pudoMode`)]
                .filter(Boolean);
              const check = (key: keyof StepRow, label: string) => (
                <input type="checkbox" className="gecko-checkbox" aria-label={`${label}, step ${i + 1}`}
                  checked={r[key] as boolean} onChange={e => set(i, { [key]: e.target.checked } as Partial<StepRow>)} />
              );
              return (
                <React.Fragment key={r.key}>
                  <tr>
                    <td className="gecko-text-mono">{i + 1}</td>
                    <td>
                      <select aria-label={`Movement, step ${i + 1}`}
                        className={`gecko-select gecko-input-sm${err(`movements[${i}].movementCode`) ? ' gecko-input-error' : ''}`}
                        value={r.movementCode} onChange={e => set(i, { movementCode: e.target.value })}>
                        <option value="">Choose…</option>
                        {movementOptions(r.movementCode).map(m => <option key={m.code} value={m.code}>{m.code} — {m.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <select aria-label={`Pick-up or drop-off, step ${i + 1}`}
                        className={`gecko-select gecko-input-sm${err(`movements[${i}].pudoMode`) ? ' gecko-input-error' : ''}`}
                        value={r.pudoMode} onChange={e => set(i, { pudoMode: e.target.value })}>
                        <option value="">—</option>
                        {vocabulary.pudoModes.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                      </select>
                    </td>
                    <td>{check('isRequired', 'Required')}</td>
                    <td>{check('isBillable', 'Billable')}</td>
                    {RULES.map(rule => <td key={rule.key}>{check(rule.key, rule.label)}</td>)}
                    <td>
                      <div className="gecko-row">
                        <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm" aria-label={`Move step ${i + 1} up`}
                          disabled={i === 0} onClick={() => move(i, -1)}><Icon name="arrowUp" size={14} /></button>
                        <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm" aria-label={`Move step ${i + 1} down`}
                          disabled={i === rows.length - 1} onClick={() => move(i, 1)}><Icon name="arrowDown" size={14} /></button>
                        <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm" aria-label={`Remove step ${i + 1}`}
                          onClick={() => onChange(rows.filter((_, j) => j !== i))}><Icon name="trash" size={14} /></button>
                      </div>
                    </td>
                  </tr>
                  {messages.length > 0 && (
                    <tr><td colSpan={8 + RULES.length} className="gecko-field-error">Step {i + 1}: {messages.join(' ')}</td></tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div>
        <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => onChange([...rows, blankStep()])}>
          <Icon name="plus" size={14} /> Add step
        </button>
      </div>
    </div>
  );
}
