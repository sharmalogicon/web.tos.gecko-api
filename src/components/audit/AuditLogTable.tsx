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
   * A line ADDED (from null) shows "—" | "+ new", one REMOVED (to null)
   * "− old" | "—", and a removed + added pair of the same line sits on one row
   * — for trails of line lists: an order type's steps and charges, a tariff's
   * rates, tiers and free time. Off elsewhere, where a field set from empty is
   * still a field change ("Voyage: — → 0344").
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

/**
 * A line value reads "<what> · … · tier 1-10: 84.11". Split it into the line's
 * identity (everything but the tier), the tier, and the amount after ": ".
 */
interface LinePart { identity: string; sub: string | null; amount: string | null; raw: string }
function parseLine(v: string): LinePart {
  const colon = v.lastIndexOf(': ');
  const head = colon >= 0 ? v.slice(0, colon) : v;
  const amount = colon >= 0 ? v.slice(colon + 2) : null;
  const segs = head.split(' · ');
  let tierAt = -1;
  segs.forEach((s, i) => { if (/^tier\b/i.test(s)) tierAt = i; });
  return {
    identity: tierAt >= 0 ? segs.filter((_, i) => i !== tierAt).join(' · ') : head,
    sub: tierAt >= 0 ? segs[tierAt] : null,
    amount,
    raw: v,
  };
}
const tierStart = (p: LinePart) => Number(/\d+/.exec(p.sub ?? '')?.[0] ?? Number.MAX_SAFE_INTEGER);
const partText = (p: LinePart) => (p.sub ? `${p.sub}: ${p.amount ?? ''}` : p.amount ?? p.raw);

/** One displayed row: a plain field change, or a removed / added line pair under a shared identity. */
type ChangeRow =
  | { kind: 'plain'; change: AuditFieldChange }
  | { kind: 'pair'; label: string; identity: string; field: string | null; old: string | null; new: string | null; oldMark: boolean; newMark: boolean };

/**
 * With `lineDiff`, a line removed and a line added under the same label and the
 * same identity (same charge, customer, order type, move, box) go on ONE row,
 * old beside new — tier for tier when the tier is the same, otherwise in tier
 * order — so a re-tiered rate reads straight across.
 */
function buildRows(changes: AuditFieldChange[], lineDiff: boolean): ChangeRow[] {
  if (!lineDiff) return changes.map(change => ({ kind: 'plain', change }));
  const groups = new Map<string, { label: string; identity: string; removed: LinePart[]; added: LinePart[] }>();
  const order: (string | AuditFieldChange)[] = [];
  for (const c of changes) {
    const removed = c.to === null && c.from !== null;
    const added = c.from === null && c.to !== null;
    if (!removed && !added) { order.push(c); continue; }
    const part = parseLine((removed ? c.from : c.to) as string);
    const key = `${c.label}\u0000${part.identity}`;
    let g = groups.get(key);
    if (!g) { g = { label: c.label, identity: part.identity, removed: [], added: [] }; groups.set(key, g); order.push(key); }
    (removed ? g.removed : g.added).push(part);
  }

  const rows: ChangeRow[] = [];
  for (const item of order) {
    if (typeof item !== 'string') { rows.push({ kind: 'plain', change: item }); continue; }
    const g = groups.get(item)!;
    // Nothing to pair with: keep the plain one-sided rows.
    if (g.removed.length === 0 || g.added.length === 0) {
      for (const p of g.removed) rows.push({ kind: 'plain', change: { field: g.label, label: g.label, from: p.raw, to: null } });
      for (const p of g.added) rows.push({ kind: 'plain', change: { field: g.label, label: g.label, from: null, to: p.raw } });
      continue;
    }
    const removed = [...g.removed].sort((a, b) => tierStart(a) - tierStart(b));
    const added = [...g.added].sort((a, b) => tierStart(a) - tierStart(b));
    // Same tier on both sides: a true rate change, old amount → new amount.
    for (const r of [...removed]) {
      const at = added.findIndex(a => a.sub === r.sub);
      if (at < 0) continue;
      const a = added.splice(at, 1)[0];
      removed.splice(removed.indexOf(r), 1);
      rows.push({ kind: 'pair', label: g.label, identity: g.identity, field: r.sub, old: r.amount ?? r.raw, new: a.amount ?? a.raw, oldMark: false, newMark: false });
    }
    // The rest side by side in tier order; the longer side runs on against "—".
    for (let i = 0; i < Math.max(removed.length, added.length); i++) {
      const r = removed[i], a = added[i];
      rows.push({ kind: 'pair', label: g.label, identity: g.identity, field: null,
        old: r ? partText(r) : null, new: a ? partText(a) : null, oldMark: !!r, newMark: !!a });
    }
  }
  return rows;
}

/**
 * An entry's changes as Field | Old value | New value, nested in the Detail
 * cell. Under ~640px each change stacks: the field, then "old → new".
 */
function ChangesTable({ rows, lineDiff }: { rows: ChangeRow[]; lineDiff: boolean }) {
  const groupOf = (r: ChangeRow | undefined) => (r?.kind === 'pair' ? `${r.label}\u0000${r.identity}` : null);
  return (
    <table className="gecko-audit-changes">
      <thead>
        <tr>
          <th className="gecko-audit-changes-field">Field</th>
          <th className="gecko-audit-changes-old">Old value</th>
          <th className="gecko-audit-changes-new">New value</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          if (row.kind === 'plain') {
            const c = row.change;
            const added = lineDiff && c.from === null && c.to !== null;
            const removed = lineDiff && c.to === null && c.from !== null;
            return (
              <tr key={`p-${i}`}>
                <td className="gecko-audit-changes-field">{c.label}</td>
                <td className="gecko-audit-changes-old">
                  {removed && <span className="gecko-audit-removed">− </span>}{shown(c.from)}
                </td>
                <td className="gecko-audit-changes-new">
                  {added && <span className="gecko-audit-added">+ </span>}{shown(c.to)}
                </td>
              </tr>
            );
          }
          // The shared identity is said once, above its first pair.
          const head = groupOf(row) !== groupOf(rows[i - 1]);
          return (
            <React.Fragment key={`g-${i}`}>
              {head && (
                <tr className="gecko-audit-changes-group">
                  <td className="gecko-audit-changes-field">{row.label}</td>
                  <td colSpan={2} className="gecko-audit-changes-identity">{row.identity}</td>
                </tr>
              )}
              <tr className="gecko-audit-changes-pair">
                <td className="gecko-audit-changes-field gecko-audit-changes-sub">{row.field ?? ''}</td>
                <td className="gecko-audit-changes-old">
                  {row.oldMark && <span className="gecko-audit-removed">− </span>}{row.old ?? '—'}
                </td>
                <td className="gecko-audit-changes-new">
                  {row.newMark && <span className="gecko-audit-added">+ </span>}{row.new ?? '—'}
                </td>
              </tr>
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

function AuditRow({ entry, showRef, lineDiff }: { entry: AuditEntry; showRef: boolean; lineDiff: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const system = entry.source === 'EDI' || entry.source === 'JOB' || entry.source === 'SCRIPT';
  // "+N more" counts displayed rows: a removed + added pair is one row.
  const rows = buildRows(entry.changes, lineDiff);
  const shownRows = expanded ? rows : rows.slice(0, CHANGES_SHOWN);
  const hidden = rows.length - CHANGES_SHOWN;
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
        {shownRows.length > 0 && <ChangesTable rows={shownRows} lineDiff={lineDiff} />}
        {hidden > 0 && (
          <button type="button" className="gecko-audit-more" onClick={() => setExpanded(x => !x)}>
            {expanded ? 'Show less' : `+${hidden} more`}
          </button>
        )}
      </td>
    </tr>
  );
}
