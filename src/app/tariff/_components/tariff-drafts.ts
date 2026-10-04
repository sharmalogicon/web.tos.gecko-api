/**
 * The in-browser shape of a tariff while it is being edited.
 *
 * Every field is a STRING, including the numbers: a half-typed "12." is a
 * legal thing for a user to have on screen and an illegal thing for a number,
 * and the conversion happens once, on save, where the server's answer can be
 * put back against the row that caused it.
 */
import type { FreeTimeKind, PricingMethod, TierBasis } from '@/lib/api/revenue';

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
