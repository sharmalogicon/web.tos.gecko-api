"use client";
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { eirPath } from '@/lib/api/gate-eir';
import type { Hold } from '@/lib/api/holds';
import type { GateTransactionSummary } from '@/lib/api/tos';
import { eventLabel, type ContainerStory } from '@/lib/api/container-story';
import { fieldLabel, useRegistryHistory, type RegistryRow } from '@/lib/api/container-master';
import { formatDateTime } from '@/lib/format';

/**
 * THE ACTIVITY LOG — everything that has happened to this box, in one column,
 * newest first.
 *
 * Vector's Activity Log is an off-hire list; this is the thing a clerk actually
 * asks for when they open it — "what happened to this box, and who did it".
 * Four sources the page already holds, merged rather than re-fetched:
 *
 *   yard.visit_event      every move, plug, survey and correction inside a stay
 *   gate transactions     the EIRs, including the voided ones
 *   container holds       applied and released, with the reason for each
 *   the registry row      when the box was first registered and last changed
 *
 * They are merged HERE and not on the server because no endpoint joins them:
 * the stays are TOS, the registry is master data, and ADR-007 keeps the two
 * apart. The cost is that the log only reaches as far back as the reads do —
 * the story caps at 100 stays and the EIR list at 100 rows, which is said at
 * the foot rather than left for someone to discover.
 *
 * Registry FIELD changes ARE here, since 2026-10-12: /history returns every
 * version of the row with what changed in it, so "modified on 06-09-2026" became
 * "tare weight 2,180 → 2,200, by Natthaphon". That read needs mdm.equipment.view,
 * which the registry panel needs anyway; without it the log simply has no
 * Registry entries rather than failing.
 */

type Kind = 'stay' | 'eir' | 'hold' | 'registry';

interface Entry {
  key: string;
  at: string;
  kind: Kind;
  icon: string;
  title: string;
  /** The change itself: "AV → DM", "EIR-KTC-2610-00038". */
  detail?: React.ReactNode;
  note?: string | null;
  where?: string | null;
}

const KIND_LABEL: Record<Kind, string> = {
  stay: 'Yard',
  eir: 'Gate',
  hold: 'Hold',
  registry: 'Registry',
};

export function ActivityLogTab({ story, moves, holdsNow, holdsReleased, registry, canReadRegistry }: {
  story: ContainerStory;
  moves: GateTransactionSummary[];
  holdsNow: { containerHoldId: string; holdCode: string; description: string | null; appliedAt: string; applyReason: string }[];
  holdsReleased: Hold[];
  registry: RegistryRow | null;
  canReadRegistry: boolean;
}) {
  const [kinds, setKinds] = useState<Set<Kind>>(() => new Set<Kind>(['stay', 'eir', 'hold', 'registry']));
  const { data: history } = useRegistryHistory(canReadRegistry ? story.containerNo : null);

  const entries = useMemo(() => {
    const out: Entry[] = [];

    // Every stay's journal. The depot is carried on the entry because a box
    // that has been to two depots reads as nonsense without it.
    for (const v of story.visits) {
      for (const e of v.events) {
        out.push({
          key: `ev-${e.visitEventId}`,
          at: e.eventAt,
          kind: 'stay',
          icon: 'activity',
          title: eventLabel(e.eventType),
          detail: (e.fromValue || e.toValue)
            ? <span className="gecko-mono">{[e.fromValue, e.toValue].filter(Boolean).join(' → ')}</span>
            : undefined,
          note: e.remarks,
          where: v.branchCode,
        });
      }
    }

    for (const t of moves) {
      out.push({
        key: `eir-${t.gateTransactionId}`,
        at: t.transactionAt,
        kind: 'eir',
        icon: t.direction === 'OUT' ? 'arrowRight' : 'arrowLeft',
        title: `Gate-${t.direction === 'OUT' ? 'out' : 'in'} · ${t.movementCode}`,
        detail: (
          <>
            <Link href={eirPath(t.direction, t.gateTransactionId)} className="gecko-link gecko-mono">{t.eirNo}</Link>
            {t.status === 'VOIDED' && <span className="gecko-badge gecko-badge-error gecko-cm-log-badge">voided</span>}
          </>
        ),
        note: [t.fullEmpty, t.truckPlate, t.orderNo].filter(Boolean).join(' · ') || null,
        where: null,
      });
    }

    for (const h of holdsNow) {
      out.push({
        key: `hold-on-${h.containerHoldId}`,
        at: h.appliedAt,
        kind: 'hold',
        icon: 'lock',
        title: `Hold applied · ${h.holdCode}`,
        detail: h.description ? <span>{h.description}</span> : undefined,
        note: h.applyReason,
        where: null,
      });
    }

    // A released hold contributes TWO entries — it was put on and taken off, and
    // those are different days by anything up to a month.
    for (const h of holdsReleased) {
      out.push({
        key: `hold-on-${h.containerHoldId}`,
        at: h.appliedAt,
        kind: 'hold',
        icon: 'lock',
        title: `Hold applied · ${h.holdCode}`,
        note: h.applyReason,
        where: h.branchCode,
      });
      if (h.releasedAt) {
        out.push({
          key: `hold-off-${h.containerHoldId}`,
          at: h.releasedAt,
          kind: 'hold',
          icon: 'checkCircle',
          title: `Hold released · ${h.holdCode}`,
          detail: h.releaseRef ? <span className="gecko-mono">{h.releaseRef}</span> : undefined,
          note: h.releaseReason,
          where: h.branchCode,
        });
      }
    }

    /**
     * The registry's own history: one entry per saved version, with the fields
     * that moved. It replaces the two timestamps the row carries, which could
     * only say THAT something changed.
     */
    (history ?? []).forEach((h, i) => {
      const renamed = h.kind === 'RENUMBERED';
      out.push({
        key: `reg-${h.at}-${i}`,
        at: h.at,
        kind: 'registry',
        icon: h.kind === 'CREATED' ? 'database' : renamed ? 'tag' : 'edit',
        title: h.kind === 'CREATED' ? 'Registered'
          : renamed ? 'Number corrected'
          : 'Registry record changed',
        detail: h.changes.length > 0 ? (
          <span className="gecko-cm-log-changes">
            {h.changes.map(c => (
              <span key={c.field} className="gecko-cm-log-change">
                {fieldLabel(c.field)} <span className="gecko-mono">{c.from ?? '\u2014'} \u2192 {c.to ?? '\u2014'}</span>
              </span>
            ))}
          </span>
        ) : undefined,
        note: [h.reason, h.byName && `by ${h.byName}`].filter(Boolean).join(' \u00b7 ') || null,
      });
    });

    // Only when the registry cannot be read at all: the row's own timestamp is
    // all there is, and saying nothing would look like nothing ever happened.
    if (!history && registry?.updatedAt) {
      out.push({
        key: 'reg-updated',
        at: registry.updatedAt,
        kind: 'registry',
        icon: 'edit',
        title: 'Registry record changed',
        note: registry.updatedByName ? `by ${registry.updatedByName}` : null,
      });
    }

    return out.sort((a, b) => b.at.localeCompare(a.at));
  }, [story, moves, holdsNow, holdsReleased, registry, history]);

  const shown = entries.filter(e => kinds.has(e.kind));

  const toggle = (k: Kind) => setKinds(prev => {
    const next = new Set(prev);
    if (next.has(k)) next.delete(k); else next.add(k);
    // Turning the last one off would show an empty page with no way back.
    return next.size === 0 ? prev : next;
  });

  const counts = (k: Kind) => entries.filter(e => e.kind === k).length;

  if (entries.length === 0) {
    return <EmptyState icon="activity" title="Nothing recorded"
      description="No gate move, hold or registry change for this box at the depots you cover." />;
  }

  return (
    <div className="gecko-stack gecko-cm-stack">
      <div className="gecko-cm-log-filters">
        {(['stay', 'eir', 'hold', 'registry'] as Kind[]).map(k => (
          <button key={k} type="button" onClick={() => toggle(k)}
            className={`gecko-cm-log-chip${kinds.has(k) ? ' gecko-cm-log-chip-on' : ''}`}>
            {KIND_LABEL[k]} <span className="gecko-cm-log-chip-count">{counts(k)}</span>
          </button>
        ))}
      </div>

      <ol className="gecko-cm-log">
        {shown.map(e => (
          <li key={e.key} className="gecko-cm-log-row">
            <div className={`gecko-cm-log-mark gecko-cm-log-mark-${e.kind}`}>
              <Icon name={e.icon} size={13} />
            </div>
            <div className="gecko-cm-log-when">
              <div className="gecko-cm-log-day">{formatDateTime(e.at).split(' ')[0]}</div>
              <div className="gecko-cell-meta">{formatDateTime(e.at).split(' ').slice(1).join(' ')}</div>
            </div>
            <div className="gecko-cm-log-what">
              <div className="gecko-cm-log-title">
                {e.title}
                {e.where && <span className="gecko-cell-meta gecko-cm-log-where">{e.where}</span>}
              </div>
              {e.detail && <div className="gecko-cm-log-detail">{e.detail}</div>}
              {e.note && <div className="gecko-cell-meta">{e.note}</div>}
            </div>
          </li>
        ))}
      </ol>

      <div className="gecko-cell-meta">
        {shown.length} of {entries.length} entries. The log reaches back as far as the reads behind it — the newest
        100 stays and the newest 100 EIRs.
      </div>
    </div>
  );
}
