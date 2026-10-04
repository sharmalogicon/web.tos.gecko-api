"use client";
import React, { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import {
  FLAG_AXES, LIST_AXES, MODIFIER_OPS, NUMERIC_AXES, PRICING_METHODS, TIER_BASES,
  type PricingMethod, type TierBasis,
} from '@/lib/api/revenue';
import { chargeVariants, type ChargeVariant, type TariffCatalogs } from '@/lib/api/tariff-catalogs';
import { CodeSelect, Labelled, Pick } from './TariffFields';
import { newCondition, type ConditionDraft, type RateDraft } from './tariff-drafts';

/**
 * ONE rate, edited in a dialog instead of in a row of the register.
 *
 * The register used to be the editor: eleven dropdowns on a single line, which
 * left SIZE about forty pixels wide. What decided the change was KORAKIT's own
 * 121 migrated rates — order type, movement and bill-to are set on every one of
 * them, equipment type and size on four in five, and cargo category, truck
 * category, payment term and billing unit on NONE. A row that gives equal width
 * to all eleven spends most of itself on axes this depot never narrows by.
 *
 * So the register reads and this edits: the axes that always matter come first,
 * the ones that rarely do sit behind "Narrow it further", and surcharges — used
 * by none of the 121 — stay folded until asked for.
 *
 * It edits a COPY, so Cancel leaves the draft exactly as it was. A row of
 * live-bound inputs can never offer that.
 */
export function RateDialog({ open, row, catalogs, errors, currency, onSave, onClose }: {
  open: boolean;
  row: RateDraft | null;
  catalogs: TariffCatalogs;
  errors: Record<string, string[]> | undefined;
  currency: string;
  onSave: (r: RateDraft) => void;
  onClose: () => void;
}) {
  // The caller passes key={row.key}, so a different rate REMOUNTS this and the
  // initialisers below run again. Seeding from props in an effect instead would
  // render once with the previous rate's values and then correct itself.
  const [d, setD] = useState<RateDraft | null>(row);
  const [loaded, setLoaded] = useState<{ code: string; list: ChargeVariant[] }>({ code: '', list: [] });
  // A folded section must open itself when the server has rejected something
  // inside it. The server answers a tiered-by-DAY rate with
  // `rates[n].billingUnitCode` ("Tiers by DAY need a per-day billing unit"),
  // and Billing unit lives under "Narrow it further" — so without this the
  // clerk reads an error about a field that is not on screen.
  const hidden = ['cargocategorycode', 'truckcategorycode', 'billingunitcode'];
  const [showAxes, setShowAxes] = useState(
    Boolean(row && (row.cargoCategoryCode || row.truckCategoryCode || row.billingUnitCode))
    || hidden.some(f => errors?.[f]));
  const [showSurcharges, setShowSurcharges] = useState(
    Boolean(row && row.conditions.length > 0) || Boolean(errors?.conditions));

  // The charge code decides which payer / term pairs are even legal.
  const code = d?.chargeCode ?? '';
  useEffect(() => {
    if (!code) return;
    let alive = true;
    chargeVariants(code)
      .then(list => { if (alive) setLoaded({ code, list }); })
      .catch(() => { if (alive) setLoaded({ code, list: [] }); });
    return () => { alive = false; };
  }, [code]);

  // Variants belong to the code they were fetched for: clearing the charge code
  // must not leave the previous charge's payers on screen.
  const variants = loaded.code === code ? loaded.list : [];

  if (!open || !d) return null;

  const err = (f: string) => errors?.[f.toLowerCase()]?.join(' ');
  const patch = (p: Partial<RateDraft>) => setD(cur => (cur ? { ...cur, ...p } : cur));
  const charge = catalogs.charges.find(c => c.chargeCode === d.chargeCode);
  const tiered = d.pricingMethod !== 'FLAT';
  const billToOptions = variants.length > 0 ? [...new Set(variants.map(v => v.billTo))] : catalogs.billToRoles.map(b => b.code);
  const termOptions = variants.length > 0
    ? [...new Set(variants.filter(v => v.billTo === d.billTo).map(v => v.paymentTermCode))]
    : catalogs.paymentTerms.map(p => p.code);

  const priceMissing = tiered ? d.tiersText.trim() === '' : d.rate.trim() === '';
  const canSave = d.chargeCode.trim() !== '' && !priceMissing;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="xl"
      closeOnBackdrop={false}
      title={d.chargeCode ? `${d.chargeCode} — ${charge?.descriptionEn ?? 'rate'}` : 'Add a rate'}
      subtitle="A blank axis means the rate applies to every value of it. Where two rates both match a move, the more specific one wins."
      footer={
        <>
          <span className="gecko-modal-footer-note gecko-flex-1">
            {d.chargeCode.trim() === ''
              ? 'Pick a charge code.'
              : priceMissing ? (tiered ? 'Enter the tier list.' : 'Enter a price.') : ''}
          </span>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose}>Cancel</button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={!canSave} onClick={() => onSave(d)}>
            <Icon name="check" size={14} /> Save rate
          </button>
        </>
      }
    >
      <div className="gecko-stack">
        {errors?.[''] && <div role="alert" className="gecko-alert gecko-alert-error">{errors[''].join(' ')}</div>}

        {/* 1 — what is charged and what it costs: the two things the clerk came for */}
        <section className="gecko-stack-sm">
          <div className="gecko-field-label">What is charged</div>
          <div className="gecko-grid-3" style={{ gap: 12 }}>
            <Labelled label="Charge code" error={err('chargeCode')}>
              <CodeSelect value={d.chargeCode} required placeholder="charge…"
                options={catalogs.charges.map(c => ({ code: c.chargeCode, label: c.descriptionEn }))}
                onChange={v => patch({ chargeCode: v })} />
            </Labelled>
            <Labelled label="Pricing method">
              <select className="gecko-input" value={d.pricingMethod}
                onChange={e => {
                  const m = e.target.value as PricingMethod;
                  patch(m === 'FLAT' ? { pricingMethod: m, tierBasis: '' } : { pricingMethod: m, tierBasis: d.tierBasis || 'DAY' });
                }}>
                {PRICING_METHODS.map(m => (
                  <option key={m} value={m}>{m === 'FLAT' ? 'Flat' : m.replace('TIERED_', 'Tiered ').toLowerCase()}</option>
                ))}
              </select>
            </Labelled>
            {tiered ? (
              <Labelled label="Tier basis" error={err('tierBasis')}>
                <select className="gecko-input" value={d.tierBasis} onChange={e => patch({ tierBasis: e.target.value as TierBasis })}>
                  {TIER_BASES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </Labelled>
            ) : (
              <Labelled label={`Price (${currency})`} error={err('rate')}
                hint={charge ? charge.billingUnitCode.toLowerCase().replace(/_/g, ' ') : undefined}>
                <input className={`gecko-input ${err('rate') ? 'gecko-input-error' : ''}`} type="number" min={0} step="0.01"
                  value={d.rate} placeholder="0.00" onChange={e => patch({ rate: e.target.value })} />
              </Labelled>
            )}
          </div>
          {tiered && (
            <Labelled label="Tiers" error={err('tiers')}
              hint="One cell: from-to:price, separated by semicolons. The last band may be open-ended.">
              <input className={`gecko-input gecko-text-mono ${err('tiers') ? 'gecko-input-error' : ''}`} value={d.tiersText}
                placeholder="1-7:160; 8-14:275; 15+:390" onChange={e => patch({ tiersText: e.target.value })} />
            </Labelled>
          )}
        </section>

        {/* 2 — who pays: set on every one of the 121 migrated rates */}
        <section className="gecko-stack-sm">
          <div className="gecko-field-label">Who pays</div>
          <div className="gecko-grid-3" style={{ gap: 12 }}>
            <Labelled label="Bill to" error={err('billTo')}>
              <CodeSelect value={d.billTo} required options={billToOptions.map(c => ({ code: c, label: c }))}
                onChange={v => patch({ billTo: v })} />
            </Labelled>
            <Labelled label="Payment term" error={err('paymentTermCode')}>
              <CodeSelect value={d.paymentTermCode} required
                options={(termOptions.length ? termOptions : catalogs.paymentTerms.map(p => p.code))
                  .map(c => ({ code: c, label: catalogs.paymentTerms.find(p => p.code === c)?.name ?? c }))}
                onChange={v => patch({ paymentTermCode: v })} />
            </Labelled>
            <Labelled label="Credit days" error={err('creditTermDays')} hint="Blank follows the payment term.">
              <input className="gecko-input" type="number" min={0} max={365} value={d.creditTermDays}
                onChange={e => patch({ creditTermDays: e.target.value })} />
            </Labelled>
          </div>
        </section>

        {/* 3 — when it applies: the axes that are actually used, up front */}
        <section className="gecko-stack-sm">
          <div className="gecko-field-label">When it applies</div>
          <div className="gecko-grid-4" style={{ gap: 12 }}>
            <Labelled label="Order type" error={err('orderTypeCode')}>
              <CodeSelect value={d.orderTypeCode} options={catalogs.orderTypes} onChange={v => patch({ orderTypeCode: v })} />
            </Labelled>
            <Labelled label="Movement" error={err('movementCode')}>
              <CodeSelect value={d.movementCode} options={catalogs.movements} onChange={v => patch({ movementCode: v })} />
            </Labelled>
            <Labelled label="Equipment type" error={err('equipmentTypeCode')}>
              <CodeSelect value={d.equipmentTypeCode} options={catalogs.equipmentTypes}
                onChange={v => patch({
                  equipmentTypeCode: v,
                  equipmentSize: v ? (catalogs.equipmentTypes.find(t => t.code === v)?.size ?? d.equipmentSize) : d.equipmentSize,
                })} />
            </Labelled>
            <Labelled label="Size" error={err('equipmentSize')}>
              <Pick value={d.equipmentSize} options={['20', '40', '45']} onChange={v => patch({ equipmentSize: v })} />
            </Labelled>
          </div>

          {/* The axes none of the 121 migrated rates uses. Present, not prominent. */}
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={() => setShowAxes(v => !v)}>
            <Icon name={showAxes ? 'chevronDown' : 'chevronRight'} size={13} /> Narrow it further
          </button>
          {showAxes && (
            <div className="gecko-grid-3" style={{ gap: 12 }}>
              <Labelled label="Cargo category" error={err('cargoCategoryCode')}>
                <CodeSelect value={d.cargoCategoryCode} options={catalogs.cargoCategories}
                  onChange={v => patch({ cargoCategoryCode: v })} />
              </Labelled>
              <Labelled label="Truck category" error={err('truckCategoryCode')}>
                <CodeSelect value={d.truckCategoryCode} options={catalogs.truckCategories}
                  onChange={v => patch({ truckCategoryCode: v })} />
              </Labelled>
              <Labelled label="Billing unit" error={err('billingUnitCode')}
                hint={charge ? `charge default ${charge.billingUnitCode}` : undefined}>
                <Pick value={d.billingUnitCode} options={catalogs.billingUnits.map(u => u.code)}
                  anyLabel="charge default" onChange={v => patch({ billingUnitCode: v })} />
              </Labelled>
            </div>
          )}
        </section>

        {/* 4 — surcharges: not one of the 121 uses them, so they stay folded */}
        <section className="gecko-stack-sm">
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={() => setShowSurcharges(v => !v)}>
            <Icon name={showSurcharges ? 'chevronDown' : 'chevronRight'} size={13} />
            {' '}Surcharges{d.conditions.length > 0 ? ` (${d.conditions.length})` : ''}
          </button>
          {showSurcharges && (
            <ConditionsEditor conditions={d.conditions} errors={errors} onChange={conditions => patch({ conditions })} />
          )}
        </section>
      </div>
    </Modal>
  );
}

function ConditionsEditor({ conditions, errors, onChange }: {
  conditions: ConditionDraft[];
  errors: Record<string, string[]> | undefined;
  onChange: (c: ConditionDraft[]) => void;
}) {
  const patch = (key: string, p: Partial<ConditionDraft>) =>
    onChange(conditions.map(c => (c.key === key ? { ...c, ...p } : c)));
  return (
    <div className="gecko-stack-sm">
      <div className="gecko-row" style={{ gap: 8 }}>
        <span className="gecko-cell-meta gecko-flex-1">
          Applied in order, after the base price (e.g. +300 when WEIGHT_KG is over 30000).
        </span>
        <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={() => onChange([...conditions, newCondition()])}>
          <Icon name="plus" size={12} /> Condition
        </button>
      </div>
      {errors?.conditions && <div className="gecko-field-error">{errors.conditions.join(' ')}</div>}
      {conditions.map(c => {
        const isFlag = FLAG_AXES.includes(c.axis);
        const isNumeric = NUMERIC_AXES.includes(c.axis);
        return (
          <div key={c.key} className="gecko-row gecko-row-wrap" style={{ gap: 6 }}>
            <select className="gecko-input" style={{ width: 160 }} value={c.axis}
              onChange={e => {
                const axis = e.target.value;
                patch(c.key, { axis, op: FLAG_AXES.includes(axis) ? 'IS' : NUMERIC_AXES.includes(axis) ? 'GT' : 'IN' });
              }}>
              {[...LIST_AXES, ...FLAG_AXES, ...NUMERIC_AXES].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            {isFlag ? (
              <select className="gecko-input" style={{ width: 90 }} value={c.flag ? 'true' : 'false'}
                onChange={e => patch(c.key, { flag: e.target.value === 'true' })}>
                <option value="true">is yes</option><option value="false">is no</option>
              </select>
            ) : isNumeric ? (
              <>
                <select className="gecko-input" style={{ width: 80 }} value={c.op} onChange={e => patch(c.key, { op: e.target.value })}>
                  {['GT', 'GTE', 'LT', 'LTE'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <input className="gecko-input" style={{ width: 110 }} type="number" value={c.number}
                  placeholder="30000" onChange={e => patch(c.key, { number: e.target.value })} />
              </>
            ) : (
              <>
                <select className="gecko-input" style={{ width: 70 }} value={c.op} onChange={e => patch(c.key, { op: e.target.value })}>
                  <option value="IN">IN</option><option value="EQ">EQ</option>
                </select>
                <input className="gecko-input gecko-text-mono" style={{ width: 160 }} value={c.values}
                  placeholder="codes, comma separated" onChange={e => patch(c.key, { values: e.target.value })} />
              </>
            )}
            <span className="gecko-cell-meta">&rarr;</span>
            <select className="gecko-input" style={{ width: 110 }} value={c.modifierOp}
              onChange={e => patch(c.key, { modifierOp: e.target.value })}>
              {MODIFIER_OPS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input className="gecko-input" style={{ width: 100 }} type="number" step="0.01" value={c.modifierValue}
              onChange={e => patch(c.key, { modifierValue: e.target.value })} />
            <input className="gecko-input" style={{ width: 160 }} value={c.label} maxLength={100}
              placeholder="label (optional)" onChange={e => patch(c.key, { label: e.target.value })} />
            <button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon" aria-label="Remove condition"
              onClick={() => onChange(conditions.filter(x => x.key !== c.key))}>
              <Icon name="x" size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
