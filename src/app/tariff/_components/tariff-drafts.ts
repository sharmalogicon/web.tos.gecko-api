/**
 * The in-browser shape of a tariff while it is being edited.
 *
 * Every field is a STRING, including the numbers: a half-typed "12." is a
 * legal thing for a user to have on screen and an illegal thing for a number,
 * and the conversion happens once, on save, where the server's answer can be
 * put back against the row that caused it.
 */
import { FLAG_AXES, NUMERIC_AXES, parseTiers } from '@/lib/api/revenue';
import type {
  ConditionItem, FreeTimeKind, PricingMethod, RateItem, TierBasis,
} from '@/lib/api/revenue';

export interface ConditionDraft {
  key: string;
  axis: string;
  op: string;
  values: string;
  number: string;
  flag: boolean;
  modifierOp: string;
  modifierValue: string;
  label: string;
}

export interface RateDraft {
  key: string;
  chargeCode: string;
  billTo: string;
  paymentTermCode: string;
  creditTermDays: string;
  orderTypeCode: string;
  movementCode: string;
  equipmentTypeCode: string;
  equipmentSize: string;
  cargoCategoryCode: string;
  truckCategoryCode: string;
  billingUnitCode: string;
  pricingMethod: PricingMethod;
  tierBasis: TierBasis | '';
  rate: string;
  tiersText: string;
  conditions: ConditionDraft[];
  open: boolean;
}

export interface FreeTimeDraft {
  key: string;
  freeTimeKind: FreeTimeKind;
  fullEmpty: string;
  direction: string;
  cargoGroup: string;
  equipmentSize: string;
  freeUnits: string;
}

let seed = 0;
export const newKey = () => `k${++seed}`;

export const newRate = (): RateDraft => ({
  key: newKey(), chargeCode: '', billTo: 'CUSTOMER', paymentTermCode: 'CASH', creditTermDays: '',
  orderTypeCode: '', movementCode: '', equipmentTypeCode: '', equipmentSize: '', cargoCategoryCode: '', truckCategoryCode: '',
  billingUnitCode: '', pricingMethod: 'FLAT', tierBasis: '', rate: '', tiersText: '', conditions: [], open: false,
});

export const newCondition = (): ConditionDraft => ({
  key: newKey(), axis: 'EQUIPMENT_SIZE', op: 'IN', values: '', number: '', flag: true, modifierOp: 'ADD', modifierValue: '', label: '',
});

export const newFreeTime = (over: Partial<FreeTimeDraft> = {}): FreeTimeDraft => ({
  key: newKey(), freeTimeKind: 'STORAGE', fullEmpty: '', direction: '', cargoGroup: '', equipmentSize: '', freeUnits: '',
  ...over,
});

/** A copy of a rate, with fresh keys so React and the error map stay honest. */
export const copyRate = (r: RateDraft): RateDraft => ({
  ...r, key: newKey(), conditions: r.conditions.map(c => ({ ...c, key: newKey() })),
});

/**
 * What the row says it applies to, in one line. Blank axes are "any" and are
 * simply left out — a reader scanning the register cares about what NARROWS
 * the rate, not about the six dimensions it ignores.
 */
export function scopeOf(r: RateDraft): string {
  const parts = [r.orderTypeCode, r.movementCode, r.equipmentTypeCode, r.equipmentSize, r.cargoCategoryCode, r.truckCategoryCode]
    .filter(v => v && v.trim() !== '');
  return parts.length === 0 ? 'any move' : parts.join(' · ');
}

/**
 * Server free-time rules as drafts, so the matrix can render a saved tariff
 * read-only with the same component the editor uses. One grid, one definition
 * of which eight combinations it can show.
 */
export function freeTimeDraftsOf(rules: readonly {
  freeTimeKind: string; fullEmpty: string | null; direction: string | null;
  cargoGroup: string | null; equipmentSize: string | null; freeUnits: number;
}[]): FreeTimeDraft[] {
  return rules.map(r => ({
    key: newKey(),
    freeTimeKind: r.freeTimeKind as FreeTimeDraft['freeTimeKind'],
    fullEmpty: r.fullEmpty ?? '',
    direction: r.direction ?? '',
    cargoGroup: r.cargoGroup ?? '',
    equipmentSize: r.equipmentSize ?? '',
    freeUnits: String(r.freeUnits),
  }));
}

/**
 * Saved rates, back into editable drafts.
 *
 * The inverse of `toRateItem`: the API keeps a NULL axis for "any" and a tier
 * list as rows, while the editor holds "" and a line of text. This is what lets
 * an existing quotation be opened in the same screen that creates one.
 *
 * It matters that EVERY saved row comes back. `PUT /tariffs/{id}/rates`
 * replaces the whole set, so a draft loaded with nine of its ten rows and saved
 * would delete the tenth without saying a word.
 */
export function rateDraftsOf(rates: readonly {
  chargeCode: string; billTo: string; paymentTermCode: string; creditTermDays: number | null;
  orderTypeCode: string | null; movementCode: string | null; equipmentTypeCode: string | null;
  equipmentSize: string | null; cargoCategoryCode: string | null; truckCategoryCode: string | null;
  billingUnitCode: string; pricingMethod: string; tierBasis: string | null; rate: number | null;
  tiers: readonly { fromQty: number; toQty: number | null; rate: number }[];
  conditions: readonly {
    axis: string; op: string; values: string[]; number: number | null; flag: boolean | null;
    modifierOp: string; modifierValue: number; label: string | null;
  }[];
}[]): RateDraft[] {
  return rates.map(r => ({
    key: newKey(),
    chargeCode: r.chargeCode,
    billTo: r.billTo,
    paymentTermCode: r.paymentTermCode,
    creditTermDays: r.creditTermDays?.toString() ?? '',
    orderTypeCode: r.orderTypeCode ?? '',
    movementCode: r.movementCode ?? '',
    equipmentTypeCode: r.equipmentTypeCode ?? '',
    equipmentSize: r.equipmentSize ?? '',
    cargoCategoryCode: r.cargoCategoryCode ?? '',
    truckCategoryCode: r.truckCategoryCode ?? '',
    billingUnitCode: r.billingUnitCode ?? '',
    pricingMethod: r.pricingMethod as RateDraft['pricingMethod'],
    tierBasis: (r.tierBasis ?? '') as RateDraft['tierBasis'],
    rate: r.rate?.toString() ?? '',
    // Exactly what `parseTiers` reads: ranges separated by ';', each
    // "range:rate", with '+' for an open-ended top tier — 1-7:160; 8+:200.
    tiersText: r.tiers
      .map(t => {
        const range = t.toQty === null ? `${t.fromQty}+`
          : t.fromQty === t.toQty ? `${t.fromQty}`
          : `${t.fromQty}-${t.toQty}`;
        return `${range}:${t.rate}`;
      })
      .join('; '),
    conditions: r.conditions.map(c => ({
      key: newKey(),
      axis: c.axis,
      op: c.op,
      values: (c.values ?? []).join(', '),
      number: c.number?.toString() ?? '',
      flag: c.flag ?? false,
      modifierOp: c.modifierOp,
      modifierValue: c.modifierValue?.toString() ?? '',
      label: c.label ?? '',
    })),
    open: false,
  }));
}

/* ── drafts → what the API stores ──────────────────────────────────────── */

/** '' is absent, not zero: a blank credit-days field means 'follow the term'. */
const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(/,/g, '')));
const blank = (v: string) => (v.trim() === '' ? null : v.trim());

export function toConditionItem(c: ConditionDraft): ConditionItem {
  const isFlag = FLAG_AXES.includes(c.axis);
  const isNumeric = NUMERIC_AXES.includes(c.axis);
  return {
    axis: c.axis,
    op: isFlag ? 'IS' : c.op,
    values: isFlag || isNumeric ? [] : c.values.split(/[,\s]+/).map(v => v.trim().toUpperCase()).filter(Boolean),
    number: isNumeric ? num(c.number) : null,
    flag: isFlag ? c.flag : null,
    modifierOp: c.modifierOp,
    modifierValue: num(c.modifierValue) ?? 0,
    label: blank(c.label),
  };
}


/**
 * A draft row as the API stores it. `problem` is a tier list that could not be
 * read — caught here rather than by a 400 after a round trip.
 */
export function toRateItem(r: RateDraft): { item: RateItem; problem: string | null } {
  const tiered = r.pricingMethod !== 'FLAT';
  const parsed = tiered ? parseTiers(r.tiersText) : { tiers: [], error: null };
  return {
    item: {
      chargeCode: r.chargeCode.trim().toUpperCase(),
      billTo: r.billTo,
      paymentTermCode: r.paymentTermCode,
      creditTermDays: num(r.creditTermDays),
      orderTypeCode: blank(r.orderTypeCode),
      movementCode: blank(r.movementCode),
      equipmentTypeCode: blank(r.equipmentTypeCode),
      equipmentSize: blank(r.equipmentSize),
      cargoCategoryCode: blank(r.cargoCategoryCode),
      truckCategoryCode: blank(r.truckCategoryCode),
      billingUnitCode: blank(r.billingUnitCode),
      pricingMethod: r.pricingMethod,
      tierBasis: tiered ? (r.tierBasis || null) : null,
      rate: tiered ? null : num(r.rate),
      tiers: parsed.tiers,
      conditions: r.conditions.map(toConditionItem),
    },
    problem: parsed.error,
  };
}

