"use client";

/**
 * The tenant's own organisation — the depots it runs, the company each depot
 * trades as, and the yards inside it (Gecko.Api /api/branches,
 * /api/master/company, /api/master/yards).
 *
 * All three need only a signed-in user; row-level security scopes them to the
 * caller's tenant, so a branch-scoped gate clerk reads them too.
 *
 * COMPANY IS PER BRANCH, NOT PER TENANT. One tenant may trade as several
 * companies (SCT's depots belong to SCT-HQ and SCT-LOG), so the company is
 * looked up again whenever the selected depot changes — there is no
 * "the tenant's company" to cache.
 */
import { useSession } from '../auth/session';
import { useApi, useApiList } from './use-api';

export interface Branch {
  branchId: string;
  branchCode: string;
  displayName: string;
  branchType?: string | null;
  unlocode?: string | null;
  isActive?: boolean;
}

export interface Company {
  companyId: string;
  /** A matching key, never a label — show `companyLabel()` instead. */
  companyCode: string;
  nameEn: string;
  nameLocal: string | null;
  shortName: string | null;
  taxId: string | null;
  taxBranchCode: string | null;
  defaultCurrency: string | null;
  countryCode: string;
  isActive: boolean;
}

export type YardType = 'CY' | 'EMPTY' | 'EXPORT' | 'IMPORT' | 'CFS' | 'REEFER' | 'DG' | 'MNR' | 'MIXED';
export type YardFullEmpty = 'FULL' | 'EMPTY' | 'BOTH';

export interface Yard {
  yardId: string;
  yardCode: string;
  nameEn: string;
  nameLocal: string | null;
  yardType: YardType;
  fullEmpty: YardFullEmpty;
  directionCode: string | null;
  capacityTeu: number | null;
  isActive: boolean;
}

/**
 * What to call a company on screen: its short name, else its registered name.
 * KORAKIT trades as "บริษัท เอ็ม.เอ็น.พี. …" but is known as Korakit, which is
 * exactly what shortName is for; tenants without one fall back to nameEn.
 */
export function companyLabel(company: Company | null | undefined): string | null {
  if (!company) return null;
  return company.shortName?.trim() || company.nameEn?.trim() || null;
}

/**
 * Shared empty results. `data ?? []` would mint a new array on every render,
 * changing the identity of anything memoised on it.
 */
const NO_BRANCHES: Branch[] = [];
const NO_YARDS: Yard[] = [];

/** Every depot this tenant runs. Empty until the session is authenticated. */
export function useBranches(): { branches: Branch[]; loading: boolean } {
  const { status } = useSession();
  const { data, loading } = useApiList<Branch>(
    status === 'authenticated' ? '/api/branches?pageSize=100' : null,
  );
  return { branches: data ?? NO_BRANCHES, loading };
}

/**
 * The company a depot trades as. Null while loading, and null for a 404 —
 * a branch with no company is a data gap, not a reason to break the header.
 */
export function useCompany(branchId: string | null): { company: Company | null; loading: boolean } {
  const { status } = useSession();
  const enabled = status === 'authenticated' && !!branchId;
  const { data, loading } = useApi<Company>(
    enabled ? `/api/master/company?branchId=${encodeURIComponent(branchId!)}` : null,
  );
  // useApi never clears `loading` for a null path, so a header with no depot yet
  // would sit on "Loading…" for ever.
  return { company: enabled ? data ?? null : null, loading: enabled && loading };
}

/** The active yards in a depot, ordered by code. An empty list is a valid answer. */
export function useYards(branchId: string | null): { yards: Yard[]; loading: boolean } {
  const { status } = useSession();
  const enabled = status === 'authenticated' && !!branchId;
  const { data, loading } = useApiList<Yard>(
    enabled ? `/api/master/yards?branchId=${encodeURIComponent(branchId!)}&activeOnly=true&pageSize=200` : null,
  );
  return { yards: enabled ? data ?? NO_YARDS : NO_YARDS, loading: enabled && loading };
}

/**
 * The depot the user is working in: the one their token names, else the only
 * one the tenant has. A user with several and no obvious default gets the
 * first — switching between them is what the header control is for.
 */
export function defaultBranch(branches: Branch[], userBranches: string[] | undefined): Branch | null {
  return branches.find(b => (userBranches ?? []).includes(b.branchId)) ?? branches[0] ?? null;
}
