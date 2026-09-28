"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as client from "../api/client";
import type { Me } from "../api/client";

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

  const load = useCallback(async () => {
    try {
      const profile = await client.me();
      setUser(profile);
      setStatus("authenticated");
    } catch {
      setUser(null);
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
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const signIn = useCallback(async (email: string, password: string) => {
    await client.login(email, password);
    await load();
  }, [load]);

  const signOut = useCallback(async () => {
    await client.logout();
    setUser(null);
    setStatus("anonymous");
  }, []);

  const value = useMemo<SessionValue>(() => ({
    status,
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
  }), [status, user, signIn, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside <SessionProvider>.");
  return value;
}
