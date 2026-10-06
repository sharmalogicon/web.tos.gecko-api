"use client";
import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { useApi } from '@/lib/api/use-api';
import { GATE_DAMAGE_CODES_PATH, type GateDamageLists, type TripDamage } from '@/lib/api/gate-trips';

/**
 * What is wrong with the box, recorded with the move.
 *
 * The survey goes in the Save, not a second call: the server writes it right
 * after that box's EIR (§23.3), so a damaged box cannot end up gated with its
 * damage lost because a follow-up request failed.
 *
 * A code marked `makesUnserviceable` puts the depot's damage hold on the box.
 * The clerk is told which ones do before they pick, rather than discovering it
 * when the box will not come out again.
 *
 * The lists come from `/gate/damage-codes` and not the master endpoint, because
 * a gate clerk does not hold `mdm` rights.
 */
export function DamagePanel({ damages, disabled, onChange }: {
  damages: TripDamage[];
  disabled: boolean;
  onChange: (next: TripDamage[]) => void;
}) {
  const lists = useApi<GateDamageLists>(GATE_DAMAGE_CODES_PATH);
  const codes = lists.data?.damageCodes ?? [];
  const locations = lists.data?.locations ?? [];
  const components = lists.data?.components ?? [];

  const patch = (i: number, p: Partial<TripDamage>) =>
    onChange(damages.map((d, j) => (j === i ? { ...d, ...p } : d)));

  const unserviceable = (code: string) => codes.find(c => c.damageCode === code)?.makesUnserviceable;

  return (
    <div className="gecko-stack-sm">
      {lists.error && <div className="gecko-field-error">{lists.error.message}</div>}

      {damages.map((d, i) => (
        <div key={i} className="gecko-damage-row">
          <select className="gecko-input" value={d.damageCode} disabled={disabled}
            aria-label={`Damage code ${i + 1}`}
            onChange={e => patch(i, { damageCode: e.target.value })}>
            <option value="">Damage…</option>
            {codes.map(c => (
              <option key={c.damageCode} value={c.damageCode}>
                {c.damageCode} - {c.description}{c.makesUnserviceable ? ' (holds the box)' : ''}
              </option>
            ))}
          </select>

          <select className="gecko-input" value={d.locationCode ?? ''} disabled={disabled}
            aria-label={`Damage location ${i + 1}`}
            onChange={e => patch(i, { locationCode: e.target.value || null })}>
            <option value="">Where…</option>
            {locations.map(l => <option key={l} value={l}>{l}</option>)}
          </select>

          <select className="gecko-input" value={d.componentCode ?? ''} disabled={disabled}
            aria-label={`Damage component ${i + 1}`}
            onChange={e => patch(i, { componentCode: e.target.value || null })}>
            <option value="">Part…</option>
            {components.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <input className="gecko-input gecko-damage-qty" type="number" min={1} value={d.quantity ?? 1}
            disabled={disabled} aria-label={`Damage quantity ${i + 1}`}
            onChange={e => patch(i, { quantity: Number(e.target.value) || 1 })} />

          <input className="gecko-input" value={d.remarks ?? ''} maxLength={200} disabled={disabled}
            placeholder="Remarks" aria-label={`Damage remarks ${i + 1}`}
            onChange={e => patch(i, { remarks: e.target.value || null })} />

          <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon"
            aria-label={`Remove damage ${i + 1}`} disabled={disabled}
            onClick={() => onChange(damages.filter((_, j) => j !== i))}>
            <Icon name="trash" size={13} />
          </button>
        </div>
      ))}

      {damages.some(d => unserviceable(d.damageCode)) && (
        <div className="gecko-alert gecko-alert-warning">
          One of these puts the depot&apos;s damage hold on the box — it will not go out again until the hold is released.
        </div>
      )}

      <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm gecko-self-start"
        disabled={disabled}
        onClick={() => onChange([...damages, { damageCode: '', locationCode: null, componentCode: null, quantity: 1, remarks: null }])}>
        <Icon name="plus" size={13} /> Add damage
      </button>
    </div>
  );
}
