"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet } from "./client";
import { ApiError } from "./problem";
import { useSession } from "../auth/session";

/** Every list endpoint answers with this envelope. */
export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface ApiResource<T> {
  data: T | null;
  error: ApiError | null;
  /** True until the first answer arrives; a reload leaves the old data on screen. */
  loading: boolean;
  reload: () => void;
}

/**
 * Reads one API resource for the signed-in session.
 *
 * It waits for the session: firing while the provider is still exchanging the
 * refresh cookie would send an anonymous request and paint an error the user
 * never caused. While the API is unreachable ("offline") the caller can fall
 * back to whatever mock data the screen still carries.
 */
export function useApi<T>(path: string | null): ApiResource<T> {
  const { status } = useSession();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce(n => n + 1), []);

  useEffect(() => {
    if (path === null || status === "loading") return;

    if (status !== "authenticated") {
      setLoading(false);
      setError(status === "offline"
        ? new ApiError(0, "The Gecko API is not reachable — showing sample data.")
        : new ApiError(401, "Sign in to see live data."));
      return;
    }

    let cancelled = false;
    setLoading(true);
    apiGet<T>(path)
      .then(result => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? e : new ApiError(0, "Could not reach the Gecko API."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [path, status, nonce]);

  return { data, error, loading, reload };
}

/** `useApi` for a paged list, unwrapped to the rows. */
export function useApiList<T>(path: string | null): ApiResource<T[]> & { totalCount: number } {
  const { data, error, loading, reload } = useApi<Paged<T>>(path);
  return { data: data?.items ?? null, error, loading, reload, totalCount: data?.totalCount ?? 0 };
}
