"use client";
import React, { useEffect, useRef } from 'react';
import { useApi } from '@/lib/api/use-api';
import { AuditLogTable, type AuditEntry } from './AuditLogTable';

/**
 * An audit trail read from one API path and shown in the shared table.
 *
 * Mount it when the trail is opened — that is the first read. `refreshKey`
 * is anything that changes after a write on the same screen (a save, a void,
 * a print); the trail is read again then, keeping its rows on screen meanwhile.
 */

export interface AuditTrailResponse {
  /** Booking trail: bookingId / orderNo. Money trails: entityType / id / ref. */
  entityType?: string;
  id?: string;
  ref?: string;
  entries: AuditEntry[];
}

export function useAuditTrail(path: string | null, refreshKey?: unknown) {
  const trail = useApi<AuditTrailResponse>(path);
  const { reload } = trail;

  const seenKey = useRef(refreshKey);
  useEffect(() => {
    if (Object.is(seenKey.current, refreshKey)) return;
    seenKey.current = refreshKey;
    if (path) reload();
  }, [refreshKey, path, reload]);

  return trail;
}

export function AuditLog({ path, refreshKey, showRef, onCount, notFoundText, lineDiff }: {
  path: string;
  refreshKey?: unknown;
  showRef?: boolean;
  /** The number of entries, once known — e.g. for a tab's count chip. */
  onCount?: (n: number) => void;
  /** Said instead of an error on a 404. */
  notFoundText?: string;
  /** "+ …" / "− …" for added / removed lines (master and tariff trails). */
  lineDiff?: boolean;
}) {
  const { data, error, loading, reload } = useAuditTrail(path, refreshKey);
  const entries = data?.entries ?? null;
  useEffect(() => { if (entries && onCount) onCount(entries.length); }, [entries, onCount]);
  return <AuditLogTable entries={entries} loading={loading} error={error} onRetry={reload} showRef={showRef} notFoundText={notFoundText} lineDiff={lineDiff} />;
}
