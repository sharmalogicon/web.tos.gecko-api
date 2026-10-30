"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet } from "./client";
import { ApiError } from "./problem";
import { useSession } from "../auth/session";
import { cacheGeneration, cachedAnswer, rememberAnswer } from "./api-cache";

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
  const { status, tokenReady } = useSession();
  const [data, setData] = useState<T | null>(() => (path === null ? null : cachedAnswer<T>(path) ?? null));
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(() => path === null || cachedAnswer(path) === undefined);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce(n => n + 1), []);
  // The token is enough to read with: no need to wait for /auth/me as well.
  const canRead = status === "authenticated" || (status === "loading" && tokenReady);

  // SIGNING IN OR OUT DROPS WHAT THIS HOOK IS HOLDING.
  //
  // `clearApiCache()` empties the shared map, but this hook's own `data` state
  // survives it, so after a sign-out and a sign-in as ANOTHER TENANT the
  // sidebar, the depot strip and an invoice header each went on painting the
  // previous tenant's company until the new read landed. Brief, and it reads
  // exactly like one customer being shown another's data.
  //
  // Only on a cache clear — NOT on every path change. Paging a register
  // changes the path with nothing cached for the new page, and blanking the
  // table there would replace "the rows you were reading" with an empty box
  // for the length of a round trip.
  //
  // Adjusted during render rather than in an effect: the old tenant's rows
  // must never be painted once, even for a frame.
  // https://react.dev/learn/you-might-not-need-an-effect
  const [seenGeneration, setSeenGeneration] = useState(cacheGeneration);
  if (seenGeneration !== cacheGeneration()) {
    setSeenGeneration(cacheGeneration());
    setData(null);
    setError(null);
  }

  useEffect(() => {
    if (path === null || (status === "loading" && !tokenReady)) return;

    if (!canRead) {
      setLoading(false);
      setError(status === "offline"
        ? new ApiError(0, "The Gecko API is not reachable — showing sample data.")
        : new ApiError(401, "Sign in to see live data."));
      return;
    }

    let cancelled = false;
    // Seen before this session: show it now, and refresh it behind the scenes.
    const cached = cachedAnswer<T>(path);
    if (cached !== undefined) {
      setData(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    apiGet<T>(path)
      .then(result => {
        if (cancelled) return;
        rememberAnswer(path, result);
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
    // canRead is derived from status + tokenReady, both listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, status, tokenReady, nonce]);

  return { data, error, loading, reload };
}

/** `useApi` for a paged list, unwrapped to the rows. */
export function useApiList<T>(path: string | null): ApiResource<T[]> & { totalCount: number } {
  const { data, error, loading, reload } = useApi<Paged<T>>(path);
  return { data: data?.items ?? null, error, loading, reload, totalCount: data?.totalCount ?? 0 };
}
