"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as client from "../api/client";
import type { Me } from "../api/client";
import { clearApiCache } from "../api/api-cache";
import { clearPartyNames } from "../api/party-names";

/**
 * Who is signed in, for the whole app.
 *
 * On mount it tries /auth/refresh once: the access token lives in memory and is
 * gone after a reload, but the HttpOnly refresh cookie is not, so a reload
 * restores the session instead of bouncing the user to the login page.
 *
 * `status` is explicit rather than "user === null", because these are four
 * different things: "we do not know yet" (would flash the login page at an
 * authenticated user on every reload), "signed out", "signed in", and
 * "the API is not running" — which must NOT send a developer browsing the
 * mock screens to a login page they cannot get through.
 */

export type SessionStatus = "loading" | "authenticated" | "anonymous" | "offline";

interface SessionValue {
  status: SessionStatus;
  /**
   * True once an access token is in hand — before /auth/me answers. Screens
   * may read data from here on, alongside the profile rather than after it.
   */
  tokenReady: boolean;
  user: Me | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Held tenant-wide (`prm`) OR at any branch (`bpm`) — the door check a screen uses. */
  can: (permission: string) => boolean;
  /** Held for THIS depot's rows. A gate clerk works at one branch (gecko_tos PLAN Q11). */
  canAt: (permission: string, branchId: string | null | undefined) => boolean;
  /** The branches the user can act in for a permission; empty means none. */
  branchesFor: (permission: string) => string[];
}

/**
 * A ROLE CLAIM, as a person reads it.
 *
 * ClaimsBuilder emits a tenant-wide role as its code and a BRANCH-SCOPED one as
 * `CODE@branchId` (ClaimsBuilder.cs:87), so a gate clerk's role arrives as
 * "GATE_CLERK@1c59e785-33a5-f111-9b0d-00919e4766d5". Printed raw, the account
 * menu showed the guid.
 *
 * The branch is not dropped information here \u2014 `branches` carries it, and the
 * depot switcher names it. This is only about reading the role aloud.
 */
export const roleLabel = (claim: string) =>
  claim.split('@')[0].replace(/_/g, ' ');

/**
 * WHAT TO CALL THE SIGNED-IN PERSON, in one place.
 *
 * Their name when the session carries one, their e-mail when it does not, and
 * their role when it carries neither. `firstName` holds the whole name and
 * `lastName` is always null, so the join below yields the name as stored.
 *
 * Every screen asks this rather than reaching into the fields, so when the API
 * starts sending firstName and lastName the menu, the sidebar and the settings
 * page all change together.
 */
export function displayName(user: Me | null): string {
  if (!user) return 'Not signed in';
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (user.email) return user.email;
  return user.roles[0] ? roleLabel(user.roles[0]) : (user.userType ?? 'Signed in');
}

/**
 * Two letters for the avatar: from the name when there is one, else the role.
 *
 * `firstName` holds the WHOLE name and `lastName` is always null (API,
 * 2026-10-21), so the letters come off `firstName` itself. Splitting on the
 * space would be wrong — a Thai name, or anyone with two family names, does
 * not divide where the first space happens to fall.
 */
export function initialsOf(user: Me | null): string {
  if (!user) return '\u2014';
  const first = user.firstName?.trim();
  const last = user.lastName?.trim();
  // Only if the API ever sends the two apart does an initial of each make sense.
  if (first && last) return (first[0] + last[0]).toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  if (last) return last.slice(0, 2).toUpperCase();
  return displayName(user).slice(0, 2).toUpperCase();
}

const SessionContext = createContext<SessionValue | null>(null);

/**
 * The `bpm` claim: "perm1,perm2@branchId,branchId", one claim per distinct
 * permission set (gecko_tos PLAN Q11 — grouped, because a 40-permission
 * OPS_MANAGER over three depots would not fit in a header otherwise).
 */
function branchesOf(user: Me | null, permission: string): string[] {
  const branches: string[] = [];
  for (const claim of user?.branchPermissions ?? []) {
    const at = claim.lastIndexOf("@");
    if (at <= 0) continue;
    if (!claim.slice(0, at).split(",").includes(permission)) continue;
    for (const branchId of claim.slice(at + 1).split(",")) if (branchId) branches.push(branchId);
  }
  return branches;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<Me | null>(null);
  const [tokenReady, setTokenReady] = useState(false);

  const load = useCallback(async () => {
    try {
      const profile = await client.me();
      setUser(profile);
      setStatus("authenticated");
    } catch {
      setUser(null);
      setTokenReady(false);
      setStatus("anonymous");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let token: Awaited<ReturnType<typeof client.refresh>> = null;
      try {
        token = await client.refresh();
      } catch {
        if (!cancelled) setStatus("offline");
        return;
      }
      if (cancelled) return;
      if (!token) {
        setStatus("anonymous");
        return;
      }
      setTokenReady(true);
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const signIn = useCallback(async (email: string, password: string) => {
    clearApiCache();
    clearPartyNames();
    await client.login(email, password);
    setTokenReady(true);
    await load();
  }, [load]);

  const signOut = useCallback(async () => {
    await client.logout();
    clearApiCache();
    clearPartyNames();
    setUser(null);
    setTokenReady(false);
    setStatus("anonymous");
  }, []);

  const value = useMemo<SessionValue>(() => ({
    status,
    tokenReady,
    user,
    signIn,
    signOut,
    can: (permission: string) =>
      (user?.permissions.includes(permission) ?? false) || branchesOf(user, permission).length > 0,
    canAt: (permission: string, branchId: string | null | undefined) =>
      (user?.permissions.includes(permission) ?? false)
      || (!!branchId && branchesOf(user, permission).includes(branchId)),
    branchesFor: (permission: string) =>
      user?.permissions.includes(permission) ? (user?.branches ?? []) : branchesOf(user, permission),
  }), [status, tokenReady, user, signIn, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside <SessionProvider>.");
  return value;
}
