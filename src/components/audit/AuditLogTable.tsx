"use client";
import React, { useState } from 'react';
import type { ApiError } from '@/lib/api/problem';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Icon } from '@/components/ui/Icon';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { formatDateTime } from '@/lib/format';

/**
 * ONE AUDIT TRAIL TABLE — the booking, the receipt, the drawer, the invoice
 * and the statement all answer the same shape, newest first, and all show it
 * the same way. Read-only.
 *
 *   ACTIVITY  an action someone took, with the field changes it made
 *   CHANGE    field changes with no recorded action (older history, a job,
 *             the gate or EDI)
 *   GATE      a gate move of one of a booking's boxes (booking trail only)
 */

export interface AuditFieldChange { field: string; label: string; from: string | null; to: string | null }

export interface AuditEntry {
  at: string;
  actorUserId: string | null;
  actorName: string;
  source: 'UI' | 'EDI' | 'JOB' | 'SCRIPT' | string;
  kind: 'ACTIVITY' | 'CHANGE' | 'GATE' | string;
  action: string;
  summary: string;
  reason: string | null;
  /** The record the line is about — a receipt no, an invoice no, a charge line. Money trails only. */
  ref?: string | null;
  changes: AuditFieldChange[];
}

const CHANGES_SHOWN = 4;

/**
 * A time field's from / to (truck's time, plugged in / out, arrived, left)
 * comes as an ISO timestamp; everything else is already a display string. A
 * plain date (yyyy-MM-dd, the booking trail) has no time part and is left as it
 * comes.
 */
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const shown = (v: string | null) => (v === null ? '—' : ISO_TIMESTAMP.test(v) ? formatDateTime(v) : v);

/** One small icon before the summary, by what kind of thing happened. */
function actionIcon(entry: AuditEntry): string | null {
  if (entry.kind === 'GATE' || entry.action.startsWith('GATE_')) return entry.kind === 'GATE' ? 'truck' : 'gate';
  if (entry.action.startsWith('HOLD_')) return 'lock';
  if (entry.action.startsWith('REEFER_')) return 'plug';
  return null;
}

export function AuditLogTable({ entries, loading, error, onRetry, showRef = false, notFoundText, lineDiff = false }: {
  entries: AuditEntry[] | null;
  loading: boolean;
  error: ApiError | null;
  onRetry: () => void;
  /** A REF column, for trails that mix several records (drawer, statement). */
  showRef?: boolean;
  /** Said instead of an error when the API answers 404 — the record is not this user's to see. */
  notFoundText?: string;
  /**
   * A line ADDED (from null) reads "+ label: to", one REMOVED (to null)
   * "− label: from" — for trails of line lists: an order type's steps and
   * charges, a tariff's rates, tiers and free time. Off elsewhere, where a
   * field set from empty is still a field change ("Voyage: — → 0344").
   */
  lineDiff?: boolean;
}) {
  const columns = showRef ? 5 : 4;

  // A failed REFRESH keeps the rows already on screen; only a trail that never
  // arrived is replaced by the banner.
  if (error && !entries && error.status === 404 && notFoundText) {
    return <div className="gecko-audit-empty">{notFoundText}</div>;
  }
  if (error && !entries) {
    return <ErrorBanner error={error} fallback="The audit log could not be read." retry={{ onClick: onRetry, label: 'Retry' }} />;
  }

  return (
    <div className="gecko-table-card">
      <table className="gecko-table gecko-table-comfortable gecko-audit-table">
        <thead>
          <tr>
            <th className="gecko-audit-col-when">Date / Time</th>
            <th className="gecko-audit-col-by">By</th>
            {showRef && <th className="gecko-audit-col-ref">Ref</th>}
            <th>Action</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {loading && !entries && <TableSkeleton columns={columns} rows={3} />}
          {entries && entries.length === 0 && (
            <tr><td colSpan={columns} className="gecko-audit-empty">No changes recorded yet.</td></tr>
          )}
          {entries?.map((e, i) => <AuditRow key={`${e.at}-${i}`} entry={e} showRef={showRef} lineDiff={lineDiff} />)}
        </tbody>
      </table>
    </div>
  );
}

function AuditRow({ entry, showRef, lineDiff }: { entry: AuditEntry; showRef: boolean; lineDiff: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const system = entry.source === 'EDI' || entry.source === 'JOB' || entry.source === 'SCRIPT';
  const changes = expanded ? entry.changes : entry.changes.slice(0, CHANGES_SHOWN);
  const hidden = entry.changes.length - CHANGES_SHOWN;
  const icon = actionIcon(entry);
  // The move was dated back: say so in the colour a clerk reads as "look again".
  const backdated = entry.action === 'GATE_BACKDATED';

  return (
    <tr>
      <td className="gecko-audit-when">{formatDateTime(entry.at)}</td>
      <td>
        {system
          ? <span className="gecko-audit-by-system"><Icon name="zap" size={11} className="gecko-audit-by-system-icon" />{entry.actorName}</span>
          : <span className="gecko-audit-by-person">{entry.actorName}</span>}
      </td>
      {showRef && <td className="gecko-audit-ref">{entry.ref ?? '—'}</td>}
      <td className={`gecko-audit-action${backdated ? ' gecko-audit-action-backdated' : ''}`}>
        {icon && <Icon name={icon} size={12} className="gecko-audit-gate-icon" />}
        {entry.summary}
        {entry.kind === 'CHANGE' && <span className="gecko-audit-no-action">(no action recorded)</span>}
      </td>
      <td className="gecko-audit-detail">
        {entry.reason && <div className="gecko-audit-reason">Reason: {entry.reason}</div>}
        {changes.map((c, i) => (
          <div key={`${c.field}-${i}`} className="gecko-audit-change">
            {lineDiff && c.from === null && c.to !== null
              ? <><span className="gecko-audit-added">+</span> {c.label}: {shown(c.to)}</>
              : lineDiff && c.to === null && c.from !== null
                ? <><span className="gecko-audit-removed">−</span> {c.label}: {shown(c.from)}</>
                : <>{c.label}: {shown(c.from)} → {shown(c.to)}</>}
          </div>
        ))}
        {hidden > 0 && (
          <button type="button" className="gecko-audit-more" onClick={() => setExpanded(x => !x)}>
            {expanded ? 'Show less' : `+${hidden} more`}
          </button>
        )}
      </td>
    </tr>
  );
}
