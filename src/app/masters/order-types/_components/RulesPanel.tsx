"use client";
import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Field, FormGrid } from '@/components/ui/FormGrid';
import { useGrades } from '@/lib/api/lookups';
import type { ApiError } from '@/lib/api/problem';
import {
  CAPTURE_RULES, NO_RULES, OWNER_MATCHES, PAYMENT_RULES,
  type OrderTypeRules, type OrderTypeStep, type OrderTypeVocabulary,
} from '@/lib/api/order-types';

/**
 * THE RULES PANEL — order-type-wide rules (gecko_master 34).
 *
 * Not to be confused with Vector's box of the same name, which edited the
 * SELECTED STEP's four flags; those are already columns in the steps grid.
 * These five belong to the order type itself and the gate reads them per truck,
 * not per step.
 *
 * Read mode is prose, not five empty controls. An order type with no rules is
 * the common case and "— — — —" says nothing; a sentence says what the gate
 * will actually do.
 *
 * Walk-in is the one rule with a shape the screen can check first: the API
 * demands exactly one step, and that step must be a gate drop-off or pick-up of
 * a full or empty box, because the gate finds the order type from those two
 * answers alone. Offering a tick that is certain to be refused is worse than
 * disabling it with the reason.
 */

export const rulesFrom = (rules: OrderTypeRules | undefined): OrderTypeRules =>
  rules ? { ...rules, releaseGradeCodes: [...(rules.releaseGradeCodes ?? [])] } : { ...NO_RULES, releaseGradeCodes: [] };

export const rulesDiffer = (a: OrderTypeRules, b: OrderTypeRules): boolean =>
  a.isWalkIn !== b.isWalkIn
  || a.paymentRule !== b.paymentRule
  || a.ownerMatch !== b.ownerMatch
  || a.maxBoxesPerTruck !== b.maxBoxesPerTruck
  || CAPTURE_RULES.some(r => a[r.key] !== b[r.key])
  || [...a.releaseGradeCodes].sort().join(',') !== [...b.releaseGradeCodes].sort().join(',');

/**
 * Whether the order type's single step could carry a walk-in truck, and how to
 * describe it. Mirrors WalkInStepProblemAsync: the movement must go IN or OUT
 * and be FULL or EMPTY.
 */
export function walkInShape(steps: OrderTypeStep[], vocabulary: OrderTypeVocabulary | null): {
  ok: boolean; chip: string | null;
} {
  if (steps.length !== 1 || !vocabulary) return { ok: false, chip: null };
  const movement = vocabulary.movements.find(m => m.code === steps[0].movementCode);
  if (!movement) return { ok: false, chip: null };
  const direction = movement.direction === 'IN' ? 'Drop off' : movement.direction === 'OUT' ? 'Pick up' : null;
  const load = movement.fullEmpty === 'FULL' ? 'Full' : movement.fullEmpty === 'EMPTY' ? 'Empty' : null;
  if (!direction || !load) return { ok: false, chip: null };
  return { ok: true, chip: `${direction} · ${load}` };
}

// ─── read ─────────────────────────────────────────────────────────────────────

export function RulesSummary({ rules, walkInChip }: { rules: OrderTypeRules; walkInChip: string | null }) {
  const payment = PAYMENT_RULES.find(p => p.value === (rules.paymentRule ?? ''));
  const owner = OWNER_MATCHES.find(o => o.value === (rules.ownerMatch ?? ''));
  const captured = CAPTURE_RULES.filter(r => rules[r.key]);
  const plain = !rules.isWalkIn && !rules.paymentRule && !rules.ownerMatch
    && rules.releaseGradeCodes.length === 0 && rules.maxBoxesPerTruck === null
    && captured.length === 0;

  if (plain) {
    return (
      <div className="gecko-cell-meta gecko-ot-rules-plain">
        No special rules. The charge rows decide payment, a pick-up may take any grade, a box of another owner
        follows the depot&apos;s own setting, a truck may carry as many boxes as it can, and the gate asks the
        clerk for nothing beyond what each step already demands.
      </div>
    );
  }

  return (
    <dl className="gecko-ot-rules-read">
      {rules.isWalkIn && (
        <Read label="Walk-in">
          A truck may arrive with no paperwork; the gate raises one booking of this order type for it.
          {walkInChip && <span className="gecko-badge gecko-badge-info gecko-ot-rules-chip">{walkInChip}</span>}
        </Read>
      )}
      {captured.length > 0 && (
        <Read label="The gate must key">
          <span className="gecko-ot-rules-grades">
            {captured.map(r => <span key={r.key} className="gecko-ot-grade">{r.label}</span>)}
          </span>
          <Hint>On every step of this order type, on top of whatever the step itself ticks.</Hint>
        </Read>
      )}
      {rules.paymentRule && <Read label="Payment">{payment?.label ?? rules.paymentRule}<Hint>{payment?.hint}</Hint></Read>}
      {rules.releaseGradeCodes.length > 0 && (
        <Read label="Release grades">
          <span className="gecko-ot-rules-grades">
            {rules.releaseGradeCodes.map(g => <span key={g} className="gecko-ot-grade">{g}</span>)}
          </span>
          <Hint>A pick-up on this order type takes no other grade.</Hint>
        </Read>
      )}
      {rules.ownerMatch && <Read label="Another owner&rsquo;s box">{owner?.label ?? rules.ownerMatch}<Hint>{owner?.hint}</Hint></Read>}
      {rules.maxBoxesPerTruck !== null && (
        <Read label="Max per truck">
          {rules.maxBoxesPerTruck} box{rules.maxBoxesPerTruck === 1 ? '' : 'es'}
          <Hint>Counts the walk-in boxes of this order type on one truck.</Hint>
        </Read>
      )}
    </dl>
  );
}

function Read({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="gecko-ot-rules-row">
      <dt className="gecko-eyebrow">{label}</dt>
      <dd className="gecko-ot-rules-value">{children}</dd>
    </div>
  );
}

const Hint = ({ children }: { children?: React.ReactNode }) =>
  children ? <div className="gecko-cell-meta">{children}</div> : null;

// ─── edit ─────────────────────────────────────────────────────────────────────

export function RulesEditor({ value, onChange, steps, vocabulary, localErrors, apiError, walkInLocked }: {
  value: OrderTypeRules;
  onChange: (next: OrderTypeRules) => void;
  steps: OrderTypeStep[];
  vocabulary: OrderTypeVocabulary | null;
  localErrors: Record<string, string>;
  apiError: ApiError | null;
  /**
   * The New page: the order type has no steps yet, and the API cannot check the
   * walk-in rule without them — it would accept the tick and then refuse the
   * first step save. Disabled there with the reason, rather than a trap.
   */
  walkInLocked?: boolean;
}) {
  const { grades, denied } = useGrades();
  const err = (key: string) => localErrors[key] ?? apiError?.forField(key);
  const set = (patch: Partial<OrderTypeRules>) => onChange({ ...value, ...patch });

  const shape = walkInShape(steps, vocabulary);
  const walkInWhy = walkInLocked
    ? 'Add the single step first, then tick this on the order type.'
    : steps.length === 0 ? 'This order type has no steps yet.'
    : steps.length > 1 ? `This order type has ${steps.length} steps; a walk-in order type has exactly one.`
    : !shape.ok ? 'Its step is not a gate drop-off or pick-up of a full or empty box.'
    : null;
  const walkInDisabled = Boolean(walkInLocked) || (!shape.ok && !value.isWalkIn);

  const toggleGrade = (code: string) => set({
    releaseGradeCodes: value.releaseGradeCodes.includes(code)
      ? value.releaseGradeCodes.filter(g => g !== code)
      : [...value.releaseGradeCodes, code],
  });

  return (
    <div className="gecko-stack gecko-stack-md">

      {/* ── R1 walk-in ── */}
      <div className="gecko-ot-rule-block">
        <label className="gecko-ot-rule-tick">
          <input type="checkbox" className="gecko-checkbox"
            checked={value.isWalkIn} disabled={walkInDisabled}
            onChange={e => set({ isWalkIn: e.target.checked })} />
          <span>
            <span className="gecko-ot-rule-name">Walk-in (no booking)</span>
            <span className="gecko-cell-meta">
              A truck may arrive with no paperwork. The gate raises one booking of this order type per truck,
              customer and line.
            </span>
          </span>
          {value.isWalkIn && shape.chip && <span className="gecko-badge gecko-badge-info">{shape.chip}</span>}
        </label>
        {walkInWhy && <div className="gecko-cell-meta gecko-ot-rule-why"><Icon name="info" size={12} /> {walkInWhy}</div>}
        {err('rules.isWalkIn') && <div className="gecko-field-error">{err('rules.isWalkIn')}</div>}
        {value.isWalkIn && shape.ok && (
          <div className="gecko-cell-meta gecko-ot-rule-why">
            <Icon name="info" size={12} /> Only one active walk-in order type may answer {shape.chip}. If another
            already does, the save is refused and names it.
          </div>
        )}
      </div>

      {/* ── R7-R10 what the gate must capture ── */}
      <div className="gecko-ot-rule-block">
        <div className="gecko-ot-rule-name">What the gate clerk must key</div>
        <div className="gecko-cell-meta">
          Asked on every step of this order type. Seal and Cargo weight can also be ticked on a single step in
          the grid above — use that where only one step wants them, such as weighing the laden-in and not the
          empty-out. Either tick asking is enough.
        </div>
        <div className="gecko-ot-capture-grid">
          {CAPTURE_RULES.map(r => {
            // A position sits inside a yard. Rather than refusing the save, ticking
            // Position turns Yard on with it, and unticking Yard takes Position away.
            const on = value[r.key];
            const toggle = (next: boolean) => {
              if (r.key === 'requirePosition') return set({ requirePosition: next, requireYard: next || value.requireYard });
              if (r.key === 'requireYard') return set({ requireYard: next, requirePosition: next ? value.requirePosition : false });
              return set({ [r.key]: next } as Partial<OrderTypeRules>);
            };
            return (
              <label key={r.key} className="gecko-ot-capture-tick" title={r.hint}>
                <input type="checkbox" className="gecko-checkbox" checked={on}
                  onChange={e => toggle(e.target.checked)} />
                <span>
                  <span className="gecko-ot-capture-name">{r.label}</span>
                  <span className="gecko-cell-meta">{r.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
        {CAPTURE_RULES.map(r => err(`rules.${r.key}`) && (
          <div key={r.key} className="gecko-field-error">{err(`rules.${r.key}`)}</div>
        ))}
      </div>

      <FormGrid columns={2}>
        {/* ── R2 payment ── */}
        <Field label="Payment rule" error={err('rules.paymentRule')}
          helper={PAYMENT_RULES.find(p => p.value === (value.paymentRule ?? ''))?.hint}>
          <select className="gecko-select" value={value.paymentRule ?? ''}
            onChange={e => set({ paymentRule: e.target.value || null })}>
            {PAYMENT_RULES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Field>

        {/* ── R4 owner match ── */}
        <Field label="Box of another owner" error={err('rules.ownerMatch')}
          helper={OWNER_MATCHES.find(o => o.value === (value.ownerMatch ?? ''))?.hint}>
          <select className="gecko-select" value={value.ownerMatch ?? ''}
            onChange={e => set({ ownerMatch: e.target.value || null })}>
            {OWNER_MATCHES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>

        {/* ── R5 cap ── */}
        <Field label="Max boxes per truck" error={err('rules.maxBoxesPerTruck')}
          helper="Walk-in boxes of this order type on one truck. Empty = no cap.">
          <input className="gecko-input" type="number" min={1} max={99} placeholder="No cap"
            value={value.maxBoxesPerTruck ?? ''}
            onChange={e => set({ maxBoxesPerTruck: e.target.value === '' ? null : Number(e.target.value) })} />
        </Field>

        {/* ── R3 grades ── */}
        <Field label="Release grades" full error={err('rules.releaseGradeCodes')}
          helper={value.releaseGradeCodes.length === 0
            ? 'None picked — a pick-up may take any grade.'
            : 'A pick-up on this order type takes only the grades ticked.'}>
          {denied ? (
            <div className="gecko-cell-meta">
              You cannot read the container grades (<code className="gecko-code">mdm.equipment.view</code>), so this
              rule cannot be changed here. It currently holds:{' '}
              {value.releaseGradeCodes.length > 0
                ? <span className="gecko-mono">{value.releaseGradeCodes.join(', ')}</span>
                : 'any grade'}.
            </div>
          ) : grades.length === 0 ? (
            <div className="gecko-cell-meta">No container grades are set up. Add them in Master data → Lookups.</div>
          ) : (
            <div className="gecko-ot-grade-picker">
              {grades.map(g => {
                const on = value.releaseGradeCodes.includes(g.gradeCode);
                return (
                  <button key={g.gradeCode} type="button"
                    className={`gecko-ot-grade-pick${on ? ' gecko-ot-grade-pick-on' : ''}`}
                    aria-pressed={on}
                    title={`${g.descriptionEn}${g.isReleasable ? '' : ' — not normally released'}`}
                    onClick={() => toggleGrade(g.gradeCode)}>
                    {on && <Icon name="check" size={12} />}
                    <span className="gecko-mono">{g.gradeCode}</span>
                    <span className="gecko-ot-grade-desc">{g.descriptionEn}</span>
                  </button>
                );
              })}
            </div>
          )}
        </Field>
      </FormGrid>
    </div>
  );
}
