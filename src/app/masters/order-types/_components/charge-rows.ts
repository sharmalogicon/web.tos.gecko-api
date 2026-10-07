import type { OrderTypeCharge, SaveOrderTypeCharge } from '@/lib/api/order-types';

/**
 * The charges an order type raises, as the screen holds them: which charge code,
 * on which step (or every step), billed to whom, on what term, and whether it is
 * raised automatically, offered to the clerk, or neither. The price is not here —
 * it is the tariff's.
 *
 * A charge can only be pinned to one of THIS order type's steps (the API refuses
 * any other movement: it would never be raised), so the step list is the steps.
 *
 * These were the top of `ChargesEditor.tsx`, which was one inline table of ten
 * controls per row. The table became two read tables and a dialog
 * (`ChargesTables` / `ChargeDialog`); the row shape and its rules did not change,
 * so they moved here where both can see them.
 */

export type Raised = 'DEFAULT' | 'OPTIONAL' | 'MANUAL';

export interface ChargeRow {
  key: string;
  chargeCode: string;
  movementCode: string;    // '' = every step
  paymentTo: string;
  paymentTermCode: string; // '' = the payer's own default term
  raised: Raised;
  isCargoCharge: boolean;
  isValueAddedService: boolean;
  raiseAtGateIn: boolean;
  defaultQty: string;
}

let nextKey = 0;
const newKey = () => `charge-${++nextKey}`;

export const rowsFromCharges = (charges: OrderTypeCharge[]): ChargeRow[] => charges.map(c => ({
  key: newKey(),
  chargeCode: c.chargeCode,
  movementCode: c.movementCode ?? '',
  paymentTo: c.paymentTo,
  paymentTermCode: c.paymentTermCode ?? '',
  raised: c.isDefault ? 'DEFAULT' : c.isOptional ? 'OPTIONAL' : 'MANUAL',
  isCargoCharge: c.isCargoCharge,
  isValueAddedService: c.isValueAddedService,
  raiseAtGateIn: c.raiseAtGateIn,
  defaultQty: c.defaultQty === null ? '' : String(c.defaultQty),
}));

export const blankCharge = (): ChargeRow => ({
  key: newKey(), chargeCode: '', movementCode: '', paymentTo: 'CUSTOMER', paymentTermCode: '', raised: 'DEFAULT',
  isCargoCharge: false, isValueAddedService: false, raiseAtGateIn: false, defaultQty: '',
});

/** A VAS row starts ticked as one — it is what the clerk pressed Add on. */
export const blankVas = (): ChargeRow => ({ ...blankCharge(), isValueAddedService: true });

export const requestFromCharges = (rows: ChargeRow[]): SaveOrderTypeCharge[] => rows.map(r => ({
  chargeCode: r.chargeCode,
  paymentTo: r.paymentTo,
  movementCode: r.movementCode || null,
  paymentTermCode: r.paymentTermCode || null,
  isDefault: r.raised === 'DEFAULT',
  isOptional: r.raised === 'OPTIONAL',
  isCargoCharge: r.isCargoCharge,
  isValueAddedService: r.isValueAddedService,
  raiseAtGateIn: r.raiseAtGateIn,
  defaultQty: r.defaultQty.trim() ? Number(r.defaultQty) : null,
}));

/** What makes two charges the same charge, as far as the API is concerned. */
export const chargeIdentity = (r: ChargeRow) => `${r.chargeCode}|${r.movementCode}|${r.paymentTo}`;

export function chargeRowErrors(rows: ChargeRow[], stepCodes: string[]): Record<string, string> {
  const e: Record<string, string> = {};
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    if (!r.chargeCode) e[`charges[${i}].chargeCode`] = 'Pick a charge code.';
    if (!r.paymentTo) e[`charges[${i}].paymentTo`] = 'Who pays?';
    if (r.movementCode && !stepCodes.includes(r.movementCode))
      e[`charges[${i}].movementCode`] = `${r.movementCode} is no longer a step of this order type.`;
    const qty = r.defaultQty.trim();
    if (qty && !(Number(qty) > 0)) e[`charges[${i}].defaultQty`] = 'A positive quantity, or blank.';
    const key = chargeIdentity(r);
    if (r.chargeCode && seen.has(key))
      e[`charges[${i}]`] = 'The same charge, step and payer is already on this order type.';
    seen.add(key);
  });
  return e;
}

/** Every error the row at `index` is responsible for, in reading order. */
export const errorsForRow = (errors: Record<string, string>, index: number): string[] =>
  ['', '.chargeCode', '.movementCode', '.paymentTo', '.paymentTermCode', '.defaultQty']
    .map(f => errors[`charges[${index}]${f}`])
    .filter((m): m is string => Boolean(m));
