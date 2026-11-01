"use client";
import React from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { formatContainerNo } from '@/lib/api/tos';
import { jobTypeLabel, type YardJob } from '@/lib/api/yard-work';

/**
 * ONE JOB, AS A DRIVER READS IT ON A HANDHELD.
 *
 * The container number is the biggest thing on the card, because that is what
 * the driver matches against the box in front of them. Then where it is and
 * where it goes, the priority, and how long it has been waiting. The actions
 * are at the bottom, 44px tall, because a thumb in a glove is not a mouse.
 *
 * A PULL names what is standing on the box: the API refuses to finish one while
 * anything is, so the card says it first and links each box to its own story.
 * `jobs` is the list on screen, which is how a dig can say whose way it clears
 * and a pull can count its digs — no extra read for either.
 */

/** "12 min", "3 h", "2 d" — how long this has been waiting. */
function age(since: string): string {
  const ms = Date.now() - new Date(since).getTime();
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`;
}

export function JobCard({ job, canWork, busy, jobs, onTake, onDone, onCancel }: {
  job: YardJob;
  canWork: boolean;
  busy: boolean;
  /** The list, so a dig can point at the pull it clears. */
  jobs: YardJob[];
  onTake: () => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const live = job.status === 'OPEN' || job.status === 'STARTED';
  const buried = live && job.boxesOnTop.length > 0;
  const digs = job.jobType === 'PULL' ? jobs.filter(j => j.forYardJobId === job.yardJobId) : [];
  const forJob = job.forYardJobId ? jobs.find(j => j.yardJobId === job.forYardJobId) ?? null : null;

  return (
    <section className={`gecko-card gecko-job gecko-job-${job.status.toLowerCase()}`}>
      <div className="gecko-row gecko-row-wrap gecko-job-head">
        <Link href={`/units/unit-inquiry?no=${encodeURIComponent(job.containerNo)}`} className="gecko-job-box">
          {formatContainerNo(job.containerNo)}
        </Link>
        <span className={`gecko-pill gecko-job-type gecko-job-type-${job.jobType.toLowerCase()}`}>
          {jobTypeLabel(job)}
        </span>
        <span className="gecko-pill gecko-pill-neutral gecko-job-pri" title="1 goes first">P{job.priority}</span>
        {job.status === 'STARTED' && (
          <span className="gecko-pill gecko-pill-info">
            taken{job.assignedToName ? ` by ${job.assignedToName}` : ''}
          </span>
        )}
        {job.status === 'DONE' && <span className="gecko-pill gecko-pill-success">done</span>}
        {job.status === 'CANCELLED' && <span className="gecko-pill gecko-pill-neutral">cancelled</span>}
        <span className="gecko-cell-meta gecko-job-age">{age(job.createdAt)}</span>
      </div>

      <div className="gecko-row gecko-row-wrap gecko-job-route">
        <span className="gecko-job-where">
          <span className="gecko-eyebrow">From</span>
          <span className="gecko-text-mono">{job.currentPosition ?? job.fromPositionText ?? '—'}</span>
        </span>
        <Icon name="arrowRight" size={16} />
        <span className="gecko-job-where">
          <span className="gecko-eyebrow">To</span>
          <span className="gecko-text-mono">
            {job.status === 'DONE' && job.donePositionText
              ? job.donePositionText
              : job.toPositionText ?? (job.jobType === 'PULL' ? 'the truck' : "driver's choice")}
          </span>
        </span>
      </div>

      {job.reason && <div className="gecko-cell-meta gecko-job-why">{job.reason}</div>}
      {job.cancelledReason && <div className="gecko-cell-meta gecko-job-why">{job.cancelledReason}</div>}
      {forJob && (
        <div className="gecko-cell-meta gecko-job-why">
          Clears the way for <strong className="gecko-text-mono">{forJob.containerNo}</strong>
          {forJob.currentPosition ? <> at <span className="gecko-text-mono">{forJob.currentPosition}</span></> : null}
        </div>
      )}

      {/* A pull cannot be finished while anything stands on the box: the API
          refuses it, so the card says so first and names the digs. */}
      {buried && (
        <div className="gecko-row gecko-row-wrap gecko-job-dig">
          <Icon name="warning" size={13} />
          <span>
            Dig first: {job.boxesOnTop.map((box, i) => (
              <React.Fragment key={box}>
                {i > 0 ? ', ' : ' '}
                <Link href={`/units/unit-inquiry?no=${encodeURIComponent(box)}`} className="gecko-text-mono">{box}</Link>
              </React.Fragment>
            ))}
            {digs.length > 0 && <> · {digs.filter(d => d.status === 'DONE').length} of {digs.length} dug</>}
          </span>
        </div>
      )}

      {canWork && live && (
        <div className="gecko-row gecko-row-wrap gecko-job-actions">
          {job.status === 'OPEN' && (
            <button className="gecko-btn gecko-btn-outline gecko-job-btn" disabled={busy} onClick={onTake}>
              <Icon name="check" size={16} /> {busy ? 'Taking…' : 'Take'}
            </button>
          )}
          <button className="gecko-btn gecko-btn-primary gecko-job-btn" onClick={onDone}>
            <Icon name="save" size={16} /> Done
          </button>
          <button className="gecko-btn gecko-btn-ghost gecko-job-btn gecko-btn-danger-text" onClick={onCancel}>
            Cancel
          </button>
        </div>
      )}
    </section>
  );
}
