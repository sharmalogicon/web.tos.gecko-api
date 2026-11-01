"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/problem';
import { useFacility } from '@/lib/api/facility';
import { useSession } from '@/lib/auth/session';
import { formatContainerNo } from '@/lib/api/tos';
import { formatDateTime } from '@/lib/format';
import { YARD_MANAGE, useYardSettings } from '@/lib/api/yard-map';
import {
  departureSourceLabel, dueLabel, orderPrestage, orderYardJob, usePrestage, type PrestageItem,
} from '@/lib/api/yard-work';
import { YardMapOff } from '@/components/yard/YardMapOff';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

/**
 * PRE-STAGING — what is leaving soon, and what is standing on it.
 *
 * The one list that turns the yard's foresight into work. A box due out at four
 * with two boxes on top of it is three moves, not one, and the time to find
 * that out is this morning — not when the truck is at the barrier with its
 * engine running.
 *
 * WHAT IT READS. `/yard/prestage?hours=` lists the boxes whose expected
 * departure falls inside the window (overdue ones included, soonest first),
 * each with `boxesOnTop` — the dig — and the jobs already waiting for it. The
 * expected departure is the Phase 5 date: a planner's, a planned truck's, the
 * vessel's ETD, or the booking's last day.
 *
 * WHAT IT WRITES. "Order pulls for all" is one POST that orders a PULL for
 * every box due out that has none, plus a dig for each box on top, and sets
 * the priority by how soon it leaves — within two hours is 2, within six is 3,
 * otherwise 4, and a dig is a rank sooner than its pull. One row at a time goes
 * through the same job endpoint as everything else.
 *
 * It needs `tos.yard.manage` to order anything, and reads with `tos.gate.view`.
 */

const WINDOWS: { hours: number; label: string }[] = [
  { hours: 4, label: '4 hours' },
  { hours: 12, label: '12 hours' },
  { hours: 24, label: '24 hours' },
  { hours: 72, label: '3 days' },
];

export default function PrestagePage() {
  const { branch } = useFacility();
  const { mapEnabled, loading: settingsLoading, denied } = useYardSettings();
  const { canAt } = useSession();
  const { toast } = useToast();

  const branchId = branch?.branchId ?? null;
  const canWork = canAt(YARD_MANAGE, branchId);
  const [hours, setHours] = useState(12);
  const [ordering, setOrdering] = useState<string | null>(null);
  const prestage = usePrestage(mapEnabled ? branchId : null, hours);

  const data = prestage.data?.hours === hours ? prestage.data : null;
  const items = data?.items ?? [];

  /** Order the lot: a pull each, and a dig for everything standing on them. */
  const orderAll = async () => {
    if (!branchId) return;
    setOrdering('ALL');
    try {
      const done = await orderPrestage(branchId, hours);
      toast({
        variant: 'success',
        title: `${done.jobsOrdered.length} ${done.jobsOrdered.length === 1 ? 'job' : 'jobs'} ordered`,
        message: done.digsNeeded > 0 ? `${done.digsNeeded} boxes have to be dug out.` : undefined,
      });
      prestage.reload();
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.');
      toast({ variant: 'danger', title: 'Nothing was ordered', message: err.explanation ?? err.message });
    } finally {
      setOrdering(null);
    }
  };

  /** One box: the same PULL any planner would order, through the jobs endpoint. */
  const orderOne = async (item: PrestageItem) => {
    if (!branchId) return;
    setOrdering(item.containerNo);
    try {
      const made = await orderYardJob({
        branchId,
        jobType: 'PULL',
        containerNo: item.containerNo,
        reason: `Due out ${dueLabel(item.expectedDepartureAt)}`,
      });
      const digs = made.filter(j => j.forYardJobId).length;
      toast({
        variant: 'success',
        title: `Pull ordered for ${item.containerNo}`,
        message: digs > 0 ? `${digs} ${digs === 1 ? 'dig' : 'digs'} first.` : undefined,
      });
      prestage.reload();
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.');
      toast({
        variant: err.status === 409 ? 'warning' : 'danger',
        title: `${item.containerNo}: no pull ordered`,
        message: err.explanation ?? err.message,
      });
      prestage.reload();
    } finally {
      setOrdering(null);
    }
  };

  if (settingsLoading) {
    return <div className="gecko-empty-card gecko-yard-loading">Checking what this depot records…</div>;
  }
  if (!mapEnabled) return <YardMapOff where={branch?.displayName} denied={denied} />;

  const overdue = items.filter(i => i.hoursToGo < 0).length;
  const withoutPull = items.filter(i => !i.liveJobs.includes('PULL')).length;

  return (
    <div className="gecko-stack gecko-prestage">
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <h1 className="gecko-page-title">Pre-staging</h1>
          <p className="gecko-page-subtitle">
            {data
              ? <>{items.length} due out within {data.hours} h · {data.digsNeeded} {data.digsNeeded === 1 ? 'box' : 'boxes'} to dig
                  {overdue > 0 ? ` · ${overdue} already overdue` : ''} · read {formatDateTime(data.asAt)}</>
              : 'What is leaving soon, and what is standing on it.'}
          </p>
        </div>
        <div className="gecko-toolbar">
          <div className="gecko-segctrl">
            {WINDOWS.map(w => (
              <button key={w.hours} className={`gecko-segctrl-btn${hours === w.hours ? ' gecko-segctrl-btn-active' : ''}`}
                onClick={() => setHours(w.hours)}>{w.label}</button>
            ))}
          </div>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => prestage.reload()}>
            <Icon name="refresh" size={14} /> Refresh
          </button>
          {canWork && items.length > 0 && (
            <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={!!ordering || withoutPull === 0}
              onClick={() => void orderAll()}
              title={withoutPull === 0 ? 'Every box due out already has a pull' : undefined}>
              <Icon name="truck" size={14} />
              {ordering === 'ALL' ? 'Ordering…' : `Order pulls for all (${withoutPull})`}
            </button>
          )}
        </div>
      </div>

      <ErrorBanner error={prestage.error} className="gecko-yard-alert" />

      {!prestage.error && !data && <div className="gecko-empty-card gecko-yard-loading">Reading what is due out…</div>}

      {data && items.length === 0 && (
        <EmptyState
          icon="clock"
          title={`Nothing due out in the next ${data.hours} hours`}
          description="A box is due out when a planner has said so, a truck is planned for it, its vessel is sailing, or its booking's last day is near. Set a date on the container master to put a box on this list."
        />
      )}

      {items.length > 0 && (
        <div className="gecko-table-card">
          <div className="gecko-yard-table-scroll">
            <table className="gecko-table gecko-table-compact gecko-prestage-table">
              <thead>
                <tr>
                  <th>Container</th>
                  <th>Standing at</th>
                  <th>Expected out</th>
                  <th>How it is known</th>
                  <th>On top of it</th>
                  <th>Jobs waiting</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const late = item.hoursToGo < 0;
                  const hasPull = item.liveJobs.includes('PULL');
                  return (
                    <tr key={item.containerVisitId}>
                      <td>
                        <Link href={`/units/unit-inquiry?no=${encodeURIComponent(item.containerNo)}`} className="gecko-text-mono">
                          {formatContainerNo(item.containerNo)}
                        </Link>
                        <div className="gecko-cell-meta">{item.fullEmpty === 'FULL' ? 'full' : 'empty'}</div>
                      </td>
                      <td className="gecko-text-mono">{item.positionText ?? <span className="gecko-cell-meta">no slot</span>}</td>
                      <td>
                        <div className={late ? 'gecko-prestage-late' : 'gecko-prestage-due'}>
                          {dueLabel(item.expectedDepartureAt)}
                        </div>
                        <div className="gecko-cell-meta">{formatDateTime(item.expectedDepartureAt)}</div>
                      </td>
                      <td className="gecko-cell-meta">{departureSourceLabel(item.departureSource)}</td>
                      <td>
                        {item.boxesOnTop.length === 0
                          ? <span className="gecko-cell-meta">clear</span>
                          : (
                            <div className="gecko-row gecko-row-wrap gecko-prestage-ontop">
                              <span className="gecko-pill gecko-pill-warning">{item.boxesOnTop.length} to dig</span>
                              {item.boxesOnTop.map(box => (
                                <Link key={box} href={`/units/unit-inquiry?no=${encodeURIComponent(box)}`}
                                  className="gecko-text-mono gecko-prestage-ontop-box">{box}</Link>
                              ))}
                            </div>
                          )}
                      </td>
                      <td>
                        {item.liveJobs.length === 0
                          ? <span className="gecko-cell-meta">none</span>
                          : item.liveJobs.map(j => (
                            <span key={j} className={`gecko-pill gecko-job-type gecko-job-type-${j.toLowerCase()}`}>
                              {j === 'PUT_AWAY' ? 'Put away' : j === 'PULL' ? 'Pull' : 'Relocate'}
                            </span>
                          ))}
                      </td>
                      <td className="gecko-cell-right">
                        {canWork && (
                          hasPull
                            ? <Link href="/yard/jobs" className="gecko-btn gecko-btn-ghost gecko-btn-sm">On the list</Link>
                            : (
                              <button className="gecko-btn gecko-btn-outline gecko-btn-sm"
                                disabled={!!ordering} onClick={() => void orderOne(item)}>
                                {ordering === item.containerNo ? 'Ordering…' : 'Order pull'}
                              </button>
                            )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
