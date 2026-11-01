"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { BarcodeScanInput } from '@/components/ui/BarcodeDisplay';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/problem';
import { useFacility } from '@/lib/api/facility';
import { useSession } from '@/lib/auth/session';
import { formatContainerNo } from '@/lib/api/tos';
import { normaliseContainerNo } from '@/lib/api/container-story';
import { GATE_OVERRIDE, YARD_MANAGE, canOverrideRefusal, useYardSettings } from '@/lib/api/yard-map';
import { MACHINE_KINDS } from '@/lib/api/yard-work';
import {
  MACHINE_PREFERENCE_KEY, cancelYardJob, finishYardJob, jobTypeLabel, startYardJob, useYardEquipment, useYardJobs,
  type HandlingEquipment, type YardJob,
} from '@/lib/api/yard-work';
import { readPreference, writePreference } from '@/lib/preferences';
import { SlotPicker } from '@/components/yard/SlotPicker';
import { JobCard } from '@/components/yard/JobCard';
import { OrderJobDialog } from '@/components/yard/OrderJobDialog';
import { YardMapOff } from '@/components/yard/YardMapOff';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

/**
 * YARD JOBS — the forklift's work list, on the machine with the driver.
 *
 * This screen is used STANDING UP, one-handed, on a handheld or a phone in a
 * cab. That is the whole design: one column, cards big enough to hit with a
 * glove, the container number the largest thing on each, and two actions —
 * take it, and say it is done. No tables, no columns to scroll sideways, no
 * hover (there is no mouse in a forklift).
 *
 * WHERE THE JOBS COME FROM. Most are not made here at all: every gate-in into
 * a slot puts a PUT_AWAY on the list, and the gate-out closes the PULL for the
 * box it lets out. A planner adds RELOCATE and PULL, and a PULL brings its own
 * digs with it — one RELOCATE per box standing on top, each a rank sooner,
 * because that is the order the yard has to work in.
 *
 * FINISHING SCANS THE BOX. The API compares what was scanned with the job's
 * own container and refuses the wrong one (400 `containerNo`). A driver who
 * confirms a job for a box they did not touch is the one way this list can lie
 * about the yard, so the scan is not a formality and cannot be skipped.
 *
 * EVERY ACTION NEEDS `tos.yard.manage` AT THE DEPOT. Someone without it reads
 * the list and sees no buttons — not buttons that answer 403.
 */

type Tab = 'todo' | 'done' | 'cancelled';

const TABS: { id: Tab; label: string; status: string }[] = [
  { id: 'todo', label: 'To do', status: 'OPEN,STARTED' },
  { id: 'done', label: 'Done today', status: 'DONE' },
  { id: 'cancelled', label: 'Cancelled', status: 'CANCELLED' },
];

/** The list is re-read on this beat as well as after every action. */
const REFRESH_MS = 15_000;

/** "FL-02 · Forklift · empty only · to tier 3" — what a driver needs to choose. */
function machineLabel(m: HandlingEquipment): string {
  const lifts = m.handlesFull && m.handlesEmpty ? null : m.handlesFull ? 'full only' : 'empty only';
  const kind = MACHINE_KINDS.find(k => k.value === m.kind)?.label ?? m.kind;
  return [m.equipmentCode, kind, lifts, m.maxSizeFt ? `up to ${m.maxSizeFt}'` : null,
    m.maxTier ? `to tier ${m.maxTier}` : null].filter(Boolean).join(' \u00b7 ');
}

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

export default function YardJobsPage() {
  const { branch } = useFacility();
  const { mapEnabled, loading: settingsLoading, denied } = useYardSettings();
  const { canAt } = useSession();
  const { toast } = useToast();
  const branchId = branch?.branchId ?? null;
  const canWork = canAt(YARD_MANAGE, branchId);

  /**
   * THE MACHINE THIS DEVICE DRIVES.
   *
   * Picked once a shift, not once a job: the handheld lives in the cab. It is
   * remembered in this browser only (a convenience, never a record), and it is
   * sent with every take and every finish so the API can refuse a job the
   * machine cannot do — an empty handler under a laden box, a forklift reaching
   * past its tier — and so the KPIs can say what each machine did.
   */
  const machines = useYardEquipment(mapEnabled && canWork ? branchId : null);
  const usable = (machines.data ?? []).filter(m => m.isActive);
  const [machine, setMachine] = useState<string>(() => readPreference(MACHINE_PREFERENCE_KEY) ?? '');
  const pickMachine = (code: string) => {
    setMachine(code);
    writePreference(MACHINE_PREFERENCE_KEY, code);
  };

  const [tab, setTab] = useState<Tab>('todo');
  const [mine, setMine] = useState(false);
  const [doing, setDoing] = useState<YardJob | null>(null);
  const [cancelling, setCancelling] = useState<YardJob | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const status = TABS.find(t => t.id === tab)!.status;
  const jobs = useYardJobs(mapEnabled && branchId
    ? { branchId, status, mine: tab === 'todo' ? mine : undefined, limit: 200 }
    : null);

  // The yard moves while this is open: the list is re-read on a beat, and
  // `reload()` leaves the cards on screen until the new ones land — so the
  // driver's thumb does not lose its place.
  useEffect(() => {
    const t = setInterval(() => jobs.reload(), REFRESH_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs.reload]);

  const rows = useMemo(() => {
    const all = jobs.data ?? [];
    // "Done today" is this depot's day as the driver sees it. The jobs endpoint
    // has no date filter, so the day is applied here and the tab says "today"
    // rather than pretending to be a history.
    if (tab !== 'done') return all;
    const since = startOfToday();
    return all.filter(j => j.doneAt && new Date(j.doneAt).getTime() >= since);
  }, [jobs.data, tab]);

  const take = async (job: YardJob) => {
    setBusy(job.yardJobId);
    try {
      await startYardJob(job.yardJobId, machine || null);
      jobs.reload();
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.');
      toast({
        variant: err.status === 409 ? 'warning' : 'danger',
        title: `${job.containerNo} not taken`,
        // The machine's own refusal is the useful one: "EH-01 lifts empty
        // boxes only; TTNU3535354 is full."
        message: err.forField('equipmentCode') ?? err.explanation ?? err.message,
      });
      jobs.reload();
    } finally {
      setBusy(null);
    }
  };

  if (settingsLoading) {
    return <div className="gecko-empty-card gecko-yard-loading">Checking what this depot records…</div>;
  }
  if (!mapEnabled) return <YardMapOff where={branch?.displayName} denied={denied} />;

  return (
    <div className="gecko-stack gecko-jobs">

      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <h1 className="gecko-page-title">Yard jobs</h1>
          <p className="gecko-page-subtitle">
            {branch?.displayName ?? 'This depot'} · {rows.length} {rows.length === 1 ? 'job' : 'jobs'}
            {tab === 'todo' ? ' to do' : ''} · refreshes itself
          </p>
        </div>
        <div className="gecko-toolbar">
          {canWork && usable.length > 0 && (
            <label className="gecko-row gecko-jobs-machine">
              <span className="gecko-eyebrow">Machine</span>
              <select className="gecko-input gecko-input-sm" value={machine} aria-label="My machine"
                onChange={e => pickMachine(e.target.value)}>
                <option value="">not said</option>
                {usable.map(m => <option key={m.handlingEquipmentId} value={m.equipmentCode}>{machineLabel(m)}</option>)}
              </select>
            </label>
          )}
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => jobs.reload()}>
            <Icon name="refresh" size={14} /> Refresh
          </button>
        </div>
      </div>

      <div className="gecko-row gecko-row-wrap gecko-jobs-tabs">
        <div className="gecko-segctrl">
          {TABS.map(t => (
            <button key={t.id} className={`gecko-segctrl-btn${tab === t.id ? ' gecko-segctrl-btn-active' : ''}`}
              onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'todo' && (
          <label className="gecko-row gecko-jobs-mine">
            <input type="checkbox" className="gecko-checkbox" checked={mine} onChange={e => setMine(e.target.checked)} />
            <span>Mine only</span>
          </label>
        )}
      </div>

      <ErrorBanner error={jobs.error} className="gecko-yard-alert" />

      {!jobs.error && rows.length === 0 && (
        <EmptyState
          icon="truck"
          title={tab === 'todo' ? (mine ? 'Nothing taken by you' : 'Nothing to do') : tab === 'done' ? 'Nothing finished today' : 'Nothing cancelled'}
          description={tab === 'todo'
            ? 'A box gated in to a slot puts a put-away here by itself; a planner can order a relocate or a pull.'
            : undefined}
        />
      )}

      <div className="gecko-stack gecko-jobs-list">
        {rows.map(job => (
          <JobCard
            key={job.yardJobId}
            job={job}
            canWork={canWork}
            busy={busy === job.yardJobId}
            jobs={rows}
            onTake={() => void take(job)}
            onDone={() => setDoing(job)}
            onCancel={() => setCancelling(job)}
          />
        ))}
      </div>

      {/* The planner's button. Low right, where a thumb is. */}
      {canWork && (
        <button className="gecko-btn gecko-btn-primary gecko-jobs-fab" onClick={() => setOrdering(true)}>
          <Icon name="plus" size={18} /> Order work
        </button>
      )}

      {doing && (
        <DoneSheet
          job={doing}
          machine={machine}
          machines={usable}
          onPickMachine={pickMachine}
          onClose={() => setDoing(null)}
          onDone={() => { setDoing(null); jobs.reload(); }}
        />
      )}
      {cancelling && (
        <CancelSheet
          job={cancelling}
          onClose={() => setCancelling(null)}
          onCancelled={() => { setCancelling(null); jobs.reload(); }}
        />
      )}
      {ordering && branchId && (
        <OrderJobDialog
          branchId={branchId}
          onClose={() => setOrdering(false)}
          onOrdered={() => { setTab('todo'); jobs.reload(); }}
        />
      )}
    </div>
  );
}

// ─── finishing a job ──────────────────────────────────────────────────────────

/**
 * THE DRIVER SAYS IT IS DONE: the box scanned, and where it went.
 *
 * Three steps, in the order they happen on the ground. The scan is first
 * because it is the one that can refuse everything else, and it is compared
 * with the job's box by the SERVER — this sheet checks it too, so the driver is
 * told at once rather than after a round trip, but the server's answer is the
 * one that counts.
 */
function DoneSheet({ job, machine, machines, onPickMachine, onClose, onDone }: {
  job: YardJob;
  /** The machine this device drives, remembered between jobs. */
  machine: string;
  machines: HandlingEquipment[];
  onPickMachine: (code: string) => void;
  onClose: () => void;
  onDone: () => void;
}) {
  const { canAt } = useSession();
  const { toast } = useToast();
  const canOverride = canAt(GATE_OVERRIDE, job.branchId);
  /** A pull has no destination, and a dig has none until the driver picks one. */
  const planned = job.jobType === 'PULL' ? null : job.toPositionText;

  const [scanned, setScanned] = useState('');
  const [where, setWhere] = useState<'PLANNED' | 'SLOT' | 'AREA'>(planned ? 'PLANNED' : 'SLOT');
  const [slot, setSlot] = useState<{ yardSlotId: string; label: string } | null>(null);
  const [area, setArea] = useState('');
  const [override, setOverride] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const box = normaliseContainerNo(scanned);
  const wrongBox = box !== '' && box !== job.containerNo;
  const needsPlace = job.jobType !== 'PULL' && !planned;
  const ready = box === job.containerNo
    && (job.jobType === 'PULL' || where === 'PLANNED' || (where === 'SLOT' ? !!slot : area.trim().length > 0));

  const send = async () => {
    setSaving(true);
    setError(null);
    try {
      const done = await finishYardJob(job.yardJobId, {
        containerNo: box,
        // "As planned" sends no place at all: the server then confirms the
        // job's own destination, which is one fewer thing to disagree about.
        toYardSlotId: job.jobType === 'PULL' || where !== 'SLOT' ? null : slot?.yardSlotId ?? null,
        toYardId: job.jobType === 'PULL' || where !== 'AREA' ? null : job.toYardId,
        toPositionText: job.jobType === 'PULL' || where !== 'AREA' ? null : area.trim().toUpperCase() || null,
        overrideReason: canOverride && override.trim() ? override.trim() : null,
        // What did it: the API checks the machine can lift this box at this
        // tier, and the KPIs count the job against it.
        equipmentCode: machine || null,
      });
      toast({
        variant: 'success',
        title: `${done.containerNo} done`,
        message: done.donePositionText ? `At ${done.donePositionText}.` : undefined,
      });
      onDone();
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.');
      setError(err);
      if (err.status === 409) setReloadKey(k => k + 1);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`${jobTypeLabel(job)} — ${formatContainerNo(job.containerNo)}`}
      subtitle={job.currentPosition ? `Standing at ${job.currentPosition}` : undefined}
      size="lg"
      footer={
        <div className="gecko-row gecko-row-between gecko-sheet-footer">
          <button className="gecko-btn gecko-btn-ghost gecko-job-btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="gecko-btn gecko-btn-primary gecko-job-btn" disabled={saving || !ready} onClick={() => void send()}>
            <Icon name="check" size={16} /> {saving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      }
    >
      <div className="gecko-stack gecko-sheet">

        <div className="gecko-field">
          <label className="gecko-field-label">1 · Scan the box</label>
          <BarcodeScanInput
            onScan={raw => { setScanned(raw); setError(null); }}
            placeholder="Scan or type the container number + Enter…"
            autoFocus
          />
          {box === '' && <div className="gecko-field-hint">This job is for {formatContainerNo(job.containerNo)}.</div>}
          {wrongBox && (
            <div className="gecko-field-error">
              That is {formatContainerNo(box)}. This job is for {formatContainerNo(job.containerNo)}.
            </div>
          )}
          {box !== '' && !wrongBox && (
            <div className="gecko-row gecko-sheet-ok">
              <Icon name="checkCircle" size={14} /> <span className="gecko-text-mono">{formatContainerNo(box)}</span>
            </div>
          )}
          {error?.forField('containerNo') && <div className="gecko-field-error">{error.forField('containerNo')}</div>}
        </div>

        {job.jobType === 'PULL' ? (
          <div className="gecko-cell-meta gecko-sheet-note">
            2 · A pull brings the box out to the truck — there is nowhere to put it, so there is nothing to pick.
            {job.boxesOnTop.length > 0 && (
              <> It cannot be finished while {job.boxesOnTop.join(', ')} {job.boxesOnTop.length === 1 ? 'stands' : 'stand'} on it.</>
            )}
          </div>
        ) : (
          <div className="gecko-stack gecko-sheet-where">
            <div className="gecko-field-label">2 · Where did it go?</div>
            {planned && (
              <label className="gecko-row gecko-sheet-radio">
                <input type="radio" checked={where === 'PLANNED'} onChange={() => setWhere('PLANNED')} disabled={saving} />
                <span>As planned (<span className="gecko-text-mono">{planned}</span>)</span>
              </label>
            )}
            <label className="gecko-row gecko-sheet-radio">
              <input type="radio" checked={where === 'SLOT'} onChange={() => setWhere('SLOT')} disabled={saving} />
              <span>{planned ? 'Somewhere else — a slot' : 'A slot'}</span>
            </label>
            <label className="gecko-row gecko-sheet-radio">
              <input type="radio" checked={where === 'AREA'} onChange={() => setWhere('AREA')} disabled={saving} />
              <span>{planned ? 'Somewhere else — an area' : 'An area'}</span>
            </label>

            {where === 'SLOT' && (
              <SlotPicker
                yardId={job.toYardId}
                value={slot?.yardSlotId ?? null}
                valueLabel={slot?.label ?? null}
                onChange={setSlot}
                disabled={saving}
                reloadKey={reloadKey}
                suggestFor={job.toYardId ? { yardId: job.toYardId, containerNo: job.containerNo, limit: 5 } : null}
              />
            )}
            {where === 'AREA' && (
              <input className="gecko-input gecko-text-mono" maxLength={30} value={area}
                placeholder="e.g. WASH BAY 2" disabled={saving} aria-label="Area"
                onChange={e => setArea(e.target.value.toUpperCase())} />
            )}
            {needsPlace && where === 'PLANNED' && (
              <div className="gecko-field-hint">This job has no destination, so you have to say where it went.</div>
            )}
            {error?.forField('toYardSlotId') && <div className="gecko-field-error">{error.forField('toYardSlotId')}</div>}
            {error?.forField('toPositionText') && <div className="gecko-field-error">{error.forField('toPositionText')}</div>}

            {/* The yard's rules, overridden on purpose — a supervisor only. */}
            {canOverrideRefusal(error?.forField('toYardSlotId')) && (canOverride
              ? (
                <div className="gecko-field">
                  <label className="gecko-field-label">Override reason *</label>
                  <input className="gecko-input" maxLength={300} value={override} disabled={saving}
                    placeholder="Why this slot is right anyway"
                    onChange={e => setOverride(e.target.value)} />
                  {error?.forField('overrideReason') && <div className="gecko-field-error">{error.forField('overrideReason')}</div>}
                </div>
              )
              : <div className="gecko-cell-meta">Only a supervisor can use a slot that breaks the yard&apos;s rules — pick another.</div>
            )}
          </div>
        )}

        {machines.length > 0 && (
          <div className="gecko-field">
            <label className="gecko-field-label">3 · Which machine?</label>
            <select className="gecko-input" value={machine} disabled={saving} aria-label="Machine"
              onChange={e => onPickMachine(e.target.value)}>
              <option value="">not said</option>
              {machines.map(m => <option key={m.handlingEquipmentId} value={m.equipmentCode}>{machineLabel(m)}</option>)}
            </select>
            <div className="gecko-field-hint">Remembered on this handheld for the next job.</div>
            {error?.forField('equipmentCode') && <div className="gecko-field-error">{error.forField('equipmentCode')}</div>}
          </div>
        )}

        {error && !error.forField('containerNo') && !error.forField('toYardSlotId') && !error.forField('toPositionText')
          && !error.forField('equipmentCode') && (
          <ErrorBanner error={error} className="gecko-sheet-error" />
        )}
      </div>
    </Modal>
  );
}

// ─── cancelling ───────────────────────────────────────────────────────────────

function CancelSheet({ job, onClose, onCancelled }: { job: YardJob; onClose: () => void; onCancelled: () => void }) {
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const send = async () => {
    setSaving(true);
    setError(null);
    try {
      await cancelYardJob(job.yardJobId, reason.trim());
      toast({ variant: 'success', title: `${job.containerNo}: ${jobTypeLabel(job).toLowerCase()} cancelled` });
      onCancelled();
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Cancel the ${jobTypeLabel(job).toLowerCase()} of ${formatContainerNo(job.containerNo)}?`}
      subtitle={job.jobType === 'PULL' ? 'Its digs are cancelled with it.' : undefined}
      footer={
        <div className="gecko-row gecko-row-between gecko-sheet-footer">
          <button className="gecko-btn gecko-btn-ghost" onClick={onClose} disabled={saving}>Keep it</button>
          <button className="gecko-btn gecko-btn-danger" disabled={saving || !reason.trim()} onClick={() => void send()}>
            {saving ? 'Cancelling…' : 'Cancel the job'}
          </button>
        </div>
      }
    >
      <div className="gecko-stack gecko-sheet">
        <div className="gecko-field">
          <label className="gecko-field-label">Why? *</label>
          <input className="gecko-input" maxLength={300} value={reason} autoFocus disabled={saving}
            placeholder="e.g. Truck did not come" onChange={e => setReason(e.target.value)} />
          <div className="gecko-field-hint">Kept on the job, so the next shift knows what happened.</div>
        </div>
        {error && <div className="gecko-field-error">{error.explanation ?? error.message}</div>}
      </div>
    </Modal>
  );
}
