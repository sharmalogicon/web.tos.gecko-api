"use client";
import React from 'react';
import { Field, FormGrid } from '@/components/ui/FormGrid';
import type { ApiError } from '@/lib/api/problem';
import type { OrderType, OrderTypeVocabulary, SaveOrderType } from '@/lib/api/order-types';

/**
 * The order type's own fields, shared by New and the detail panel's Edit. Every
 * list comes from /api/master/vocabulary/order-types, the values the API checks.
 */

export interface OrderTypeFormValue {
  orderTypeCode: string;
  descriptionEn: string;
  descriptionLocal: string;
  directionCode: string;
  cargoClassCode: string;
  serviceCode: string;
  bookingTypeCode: string;
  /**
   * Whether this order type's moves hang off a vessel call.
   *
   * It gates two things: the booking screen only demands a vessel call (and,
   * on an export, the ports) when this is on, and a step may only carry
   * "Require vessel/voyage" when this is on — the API answers 400 otherwise.
   */
  requiresVesselSchedule: boolean;
  /**
   * Do this order type's boxes count as the depot's stock?
   *
   * Off for SWAP order types: their boxes stay out of the yard inventory, the
   * yard map, the in-yard reports and the drop-off/release counts, while the
   * gate goes on seeing them exactly as before.
   */
  showInInventory: boolean;
  isActive: boolean;
}

export const EMPTY_ORDER_TYPE: OrderTypeFormValue = {
  orderTypeCode: '', descriptionEn: '', descriptionLocal: '', directionCode: '', cargoClassCode: '',
  serviceCode: '', bookingTypeCode: '', requiresVesselSchedule: false, showInInventory: true, isActive: true,
};

export const formFromOrderType = (o: OrderType): OrderTypeFormValue => ({
  orderTypeCode: o.orderTypeCode,
  descriptionEn: o.descriptionEn,
  descriptionLocal: o.descriptionLocal ?? '',
  directionCode: o.directionCode,
  cargoClassCode: o.cargoClassCode,
  serviceCode: o.serviceCode ?? '',
  bookingTypeCode: o.bookingTypeCode ?? '',
  requiresVesselSchedule: o.requiresVesselSchedule ?? false,
  // ?? true, not ?? false: an order type read back from an API that predates
  // the field is one that counts, which is what every order type did before it.
  showInInventory: o.showInInventory ?? true,
  isActive: o.isActive,
});

export const requestFromOrderType = (f: OrderTypeFormValue, rowVersion?: string): SaveOrderType => ({
  orderTypeCode: f.orderTypeCode.trim().toUpperCase(),
  descriptionEn: f.descriptionEn.trim(),
  descriptionLocal: f.descriptionLocal.trim() || null,
  // directionCode is NOT sent: the API derives it from the booking type and
  // returns it read-only. Sending our own guess would let the two disagree.
  cargoClassCode: f.cargoClassCode,
  serviceCode: f.serviceCode || null,
  bookingTypeCode: f.bookingTypeCode || null,
  requiresVesselSchedule: f.requiresVesselSchedule,
  // Always sent. The field is optional on SaveOrderType so a caller that never
  // showed it can keep the stored value; this form shows it, so it owns it.
  showInInventory: f.showInInventory,
  isActive: f.isActive,
  rowVersion,
});

/** Same shape the API enforces: Vector codes are phrases ('EXP CY-IN (NON-NOMINATING)'). */
const CODE_SHAPE = /^[A-Z0-9][A-Z0-9 /()._-]{0,49}$/;


export function orderTypeErrors(f: OrderTypeFormValue): Record<string, string> {
  const e: Record<string, string> = {};
  if (!CODE_SHAPE.test(f.orderTypeCode.trim().toUpperCase()))
    e.orderTypeCode = 'Upper-case letters, digits, spaces and / ( ) . _ - , up to 50 characters — e.g. EXP CY/CY.';
  if (!f.descriptionEn.trim()) e.descriptionEn = 'Describe what the depot is asked to do.';
  if (!f.bookingTypeCode) e.bookingTypeCode = 'Pick a booking type — it decides the direction.';
  if (!f.cargoClassCode) e.cargoClassCode = 'Pick a cargo class.';
  return e;
}

export function OrderTypeForm({ value, onChange, vocabulary, localErrors, apiError, mode }: {
  value: OrderTypeFormValue;
  onChange: (next: OrderTypeFormValue) => void;
  vocabulary: OrderTypeVocabulary;
  localErrors: Record<string, string>;
  apiError: ApiError | null;
  mode: 'create' | 'edit';
}) {
  const err = (name: keyof OrderTypeFormValue) => localErrors[name] ?? apiError?.forField(name);
  const set = (patch: Partial<OrderTypeFormValue>) => onChange({ ...value, ...patch });
  const select = (name: keyof OrderTypeFormValue, options: { code: string; name: string }[], placeholder: string) => (
    <select className={`gecko-select${err(name) ? ' gecko-input-error' : ''}`} value={value[name] as string}
      onChange={e => set({ [name]: e.target.value } as Partial<OrderTypeFormValue>)}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.code} value={o.code}>{o.name}</option>)}
    </select>
  );

  return (
    <FormGrid columns={2}>
      <Field label="Order type code" required error={err('orderTypeCode')}
        helper={mode === 'edit' ? 'The code cannot change — bookings and quotations refer to it.' : 'As staff know it, e.g. CUSTOMER FULL or EXP CY/CY'}>
        <input className={`gecko-input gecko-text-mono${err('orderTypeCode') ? ' gecko-input-error' : ''}`} value={value.orderTypeCode}
          maxLength={50} disabled={mode === 'edit'} autoFocus={mode === 'create'}
          onChange={e => set({ orderTypeCode: e.target.value.toUpperCase() })} />
      </Field>
      <Field label="Booking type" required error={err('bookingTypeCode')}
        helper={mode === 'edit' && value.directionCode
          ? `Storage, empty release, export booking … · the API reads this as ${value.directionCode}`
          : 'Storage, empty release, export booking … · it decides the direction'}>
        {select('bookingTypeCode', vocabulary.bookingTypes, 'Choose…')}
      </Field>

      <Field label="Description (English)" required full error={err('descriptionEn')}>
        <input className={`gecko-input${err('descriptionEn') ? ' gecko-input-error' : ''}`} value={value.descriptionEn} maxLength={255}
          placeholder="e.g. Customer drops a full box and picks it up later" onChange={e => set({ descriptionEn: e.target.value })} />
      </Field>
      <Field label="Description (Thai)" full error={err('descriptionLocal')}>
        <input className="gecko-input" value={value.descriptionLocal} maxLength={255} lang="th"
          onChange={e => set({ descriptionLocal: e.target.value })} />
      </Field>

      <Field label="Cargo class" required error={err('cargoClassCode')}>
        {select('cargoClassCode', vocabulary.cargoClasses, 'Choose…')}
      </Field>
      <Field label="Service" error={err('serviceCode')} helper="Origin and destination form, e.g. CY-CY">
        {select('serviceCode', vocabulary.serviceTypes.map(s => ({ code: s.code, name: `${s.code} — ${s.name}` })), 'None')}
      </Field>

      <Field label="Vessel schedule" full error={err('requiresVesselSchedule')}
        helper="Leave it off for depot work — storage, repair, a swap. A booking of that kind has no sailing, and the booking screen will stop asking for one.">
        <label className="gecko-row" style={{ gap: 8 }}>
          <input type="checkbox" className="gecko-checkbox" checked={value.requiresVesselSchedule}
            onChange={e => set({ requiresVesselSchedule: e.target.checked })} />
          <span>Requires vessel schedule</span>
        </label>
      </Field>

      <Field label="Yard inventory" full error={err('showInInventory')}
        helper="Untick for SWAP order types: their boxes are left out of the yard inventory, yard map, in-yard reports and drop-off/release counts. The gate still sees them.">
        <label className="gecko-row gecko-gap-2">
          <input type="checkbox" className="gecko-checkbox" checked={value.showInInventory}
            onChange={e => set({ showInInventory: e.target.checked })} />
          <span>Show in yard inventory <span lang="th" className="gecko-cell-meta">(แสดงในสต็อกลาน)</span></span>
        </label>
      </Field>
    </FormGrid>
  );
}
