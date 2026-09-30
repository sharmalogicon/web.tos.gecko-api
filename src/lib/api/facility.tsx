"use client";

/**
 * WHERE THE USER IS WORKING — depot, the company it trades as, and the yard.
 *
 * The sidebar wordmark and the header switcher both need this, and each lookup
 * is a round trip, so it is fetched once here rather than in both.
 *
 * The depot drives everything: change it and the company and the yard list are
 * re-read, because a tenant can trade as several companies (gecko_master
 * org.company hangs off the branch, not the tenant).
 */
import React, { createContext, useContext, useMemo, useState } from 'react';
import {
  defaultBranch, useBranches, useCompany, useYards,
  type Branch, type Company, type Yard,
} from './org';
import { useSession } from '../auth/session';

interface FacilityValue {
  branches: Branch[];
  branch: Branch | null;
  selectBranch: (branchId: string) => void;
  company: Company | null;
  yards: Yard[];
  /** null means "the whole depot" — no yard filter. */
  yard: Yard | null;
  selectYard: (yardId: string | null) => void;
  loading: boolean;
}

const FacilityContext = createContext<FacilityValue | null>(null);

export function FacilityProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const { branches, loading: branchesLoading } = useBranches();

  const [pickedBranchId, setPickedBranchId] = useState<string | null>(null);
  const branch = branches.find(b => b.branchId === pickedBranchId)
    ?? defaultBranch(branches, user?.branches);

  const { company, loading: companyLoading } = useCompany(branch?.branchId ?? null);
  const { yards, loading: yardsLoading } = useYards(branch?.branchId ?? null);


  // A yard belongs to one depot, so switching depot drops the selection.
  // Adjusted during render rather than in an effect — the yard must never be
  // read as belonging to the depot the user just left.
  // https://react.dev/learn/you-might-not-need-an-effect
  const branchId = branch?.branchId ?? null;
  const [pickedYardId, setPickedYardId] = useState<string | null>(null);
  const [yardsOwner, setYardsOwner] = useState<string | null>(null);
  // Compare the normalised id: `branch?.branchId` is undefined before the
  // branches arrive, and `undefined !== null` would re-enter this on every
  // render until React gives up with "Too many re-renders".
  if (branchId !== yardsOwner) {
    setYardsOwner(branchId);
    setPickedYardId(null);
  }
  const yard = yards.find(y => y.yardId === pickedYardId) ?? null;

  const value = useMemo<FacilityValue>(() => ({
    branches,
    branch,
    selectBranch: (branchId: string) => setPickedBranchId(branchId),
    company,
    yards,
    yard,
    selectYard: (yardId: string | null) => setPickedYardId(yardId),
    loading: branchesLoading || companyLoading || yardsLoading,
  }), [branches, branch, company, yards, yard, branchesLoading, companyLoading, yardsLoading]);

  return <FacilityContext.Provider value={value}>{children}</FacilityContext.Provider>;
}

export function useFacility(): FacilityValue {
  const value = useContext(FacilityContext);
  if (!value) throw new Error('useFacility must be used inside a FacilityProvider');
  return value;
}
