"use client";

/**
 * The master-data vocabularies a tariff rate row is written in, loaded once
 * per screen. Every code here is re-validated by Gecko.Revenue
 * (RateSetValidator) — these lists only stop the user typing codes that do
 * not exist.
 */
import { useEffect, useState } from 'react';
import { apiGet } from './client';
import { ApiError } from './problem';
import { useSession } from '../auth/session';
import type { Paged } from './use-api';
import { getRevenueLookups, type BillingUnitLookup, type BillToRoleLookup, type PaymentTermLookup } from './revenue';

export interface ChargeCodeOption {
  chargeCodeId: string;
  chargeCode: string;
  descriptionEn: string;
  descriptionLocal: string | null;
  moduleCode: string;
  chargeType: string;
  chargeCategory: string;
  billingUnitCode: string;
  isActive: boolean;
}

export interface ChargeVariant {
  billTo: string;
  paymentTermCode: string;
  creditTermDays: number | null;
  isActive: boolean;
}

export interface CodeOption {
  code: string;
  label: string;
}

export interface EquipmentTypeOption extends CodeOption {
  size: string;
}

export interface TariffCatalogs {
  charges: ChargeCodeOption[];
  orderTypes: CodeOption[];
  movements: CodeOption[];
  equipmentTypes: EquipmentTypeOption[];
  cargoCategories: CodeOption[];
  truckCategories: CodeOption[];
  /** Revenue's own vocabularies (GET /api/revenue/lookups). */
  billToRoles: BillToRoleLookup[];
  paymentTerms: PaymentTermLookup[];
  billingUnits: BillingUnitLookup[];
}

const EMPTY: TariffCatalogs = { charges: [], orderTypes: [], movements: [], equipmentTypes: [], cargoCategories: [], truckCategories: [], billToRoles: [], paymentTerms: [], billingUnits: [] };

/** Pages through a list endpoint (max page size 200). */
async function all<T>(path: string): Promise<T[]> {
  const sep = path.includes('?') ? '&' : '?';
  const items: T[] = [];
  for (let page = 1; page <= 10; page++) {
    const result = await apiGet<Paged<T>>(`${path}${sep}page=${page}&pageSize=200`);
    items.push(...result.items);
    if (items.length >= result.totalCount || result.items.length === 0) break;
  }
  return items;
}

/**
 * Each list loads independently: a user without commercial.view still gets
 * the equipment types, and a missing list falls back to free text.
 */
export function useTariffCatalogs(moduleCode: string): { catalogs: TariffCatalogs; errors: string[]; loading: boolean } {
  const { status } = useSession();
  const [catalogs, setCatalogs] = useState<TariffCatalogs>(EMPTY);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    const failures: string[] = [];
    const guard = <T,>(what: string, p: Promise<T>, fallback: T) =>
      p.catch((e: unknown) => {
        failures.push(`${what}: ${e instanceof ApiError ? e.message : 'unavailable'}`);
        return fallback;
      });

    Promise.all([
      guard('Charge codes', all<ChargeCodeOption>(`/api/master/charge-codes?moduleCode=${encodeURIComponent(moduleCode)}`), []),
      guard('Order types', all<{ orderTypeCode: string; descriptionEn: string }>('/api/master/order-types'), []),
      guard('Movements', apiGet<{ movementCode: string; descriptionEn: string }[]>(`/api/master/movements?appliesToModule=${encodeURIComponent(moduleCode)}`), []),
      guard('Equipment types', all<{ typeCode: string; descriptionEn: string; lengthFt: number }>('/api/master/equipment-types'), []),
      guard('Cargo categories', apiGet<{ code: string; descriptionEn: string }[]>('/api/master/code-lists/CARGO_CATEGORY'), []),
      guard('Truck categories', apiGet<{ code: string; descriptionEn: string }[]>('/api/master/code-lists/TRUCK_CATEGORY'), []),
      guard('Bill-to roles, payment terms and billing units', getRevenueLookups(), null),
    ]).then(([charges, orderTypes, movements, equipment, cargo, trucks, lookups]) => {
      if (cancelled) return;
      setCatalogs({
        charges,
        orderTypes: orderTypes.map(o => ({ code: o.orderTypeCode, label: o.descriptionEn })),
        movements: movements.map(m => ({ code: m.movementCode, label: m.descriptionEn })),
        equipmentTypes: equipment.map(t => ({ code: t.typeCode, label: t.descriptionEn, size: String(Math.round(Number(t.lengthFt))) })),
        cargoCategories: cargo.map(c => ({ code: c.code, label: c.descriptionEn })),
        truckCategories: trucks.map(c => ({ code: c.code, label: c.descriptionEn })),
        billToRoles: lookups?.billToRoles ?? [],
        paymentTerms: lookups?.paymentTerms ?? [],
        billingUnits: lookups?.billingUnits ?? [],
      });
      setErrors(failures);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [status, moduleCode]);

  // Not signed in (or offline): nothing will load, so nothing is "loading".
  return { catalogs, errors, loading: loading && status !== 'anonymous' && status !== 'offline' };
}

const variantCache = new Map<string, Promise<ChargeVariant[]>>();

/** The bill-to × payment-term combinations a charge is set up for (charge_code_variant). */
export function chargeVariants(chargeCode: string): Promise<ChargeVariant[]> {
  const key = chargeCode.toUpperCase();
  let hit = variantCache.get(key);
  if (!hit) {
    hit = apiGet<{ variants: ChargeVariant[] }>(`/api/master/charge-codes/${encodeURIComponent(key)}`)
      .then(d => d.variants.filter(v => v.isActive))
      .catch(() => { variantCache.delete(key); return []; });
    variantCache.set(key, hit);
  }
  return hit;
}
