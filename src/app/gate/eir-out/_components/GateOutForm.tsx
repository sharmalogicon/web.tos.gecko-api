"use client";
import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { apiGet } from '@/lib/api/client';
import { ApiError } from '@/lib/api/problem';
import { useFacility } from '@/lib/api/facility';
import { useSession } from '@/lib/auth/session';
import { useConditions } from '@/lib/api/lookups';
import {
  TOS_PERMISSIONS, preflightPath,
  type GateFinding, type GatePreflight, type TruckVisit,
} from '@/lib/api/tos';
import {
  cancelPickup, departVisit, isPlanned, saveTrip,
  type TripRefusalRow, type TripSaveResult, type VisitPickup,
} from '@/lib/api/gate-trips';
import { GateField } from '../../_components/GateField';
import { TruckInYardPicker, type OpenVisit } from '../../_components/TruckInYardPicker';
import {
  blankGateOutTruck, isBlocked, releaseIssues, releaseToTripRow, rowFor, yardChooses,
  type GateOutTruck, type ReleaseRow,
} from './gate-out-draft';

/**
 * GATE OUT — the truck in front of the clerk, and what it came to collect.
 *
 * It does not choose what leaves. Gate In announced each pick-up, took the
 * money and held the box for this truck; here the clerk confirms what was
 * actually loaded and lets it go. So there is no booking search and no payment
 * on this screen — only the truck's own planned pick-ups.
 *
 * The release is ONE `POST /gate/trips` carrying `truckVisitId`, so one arrival
 * stays one visit. `POST /gate/transactions` is not called from here at all.
 *
 * A truck that only dropped off has no pick-ups and simply departs. One that
 * cannot take a box it came for needs a supervisor to cancel that pick-up
 * before it can leave — otherwise the yard goes on holding a box for a truck
 * that has gone.
 */
export function GateOutForm() {
  const { can } = useSession();
  const { branch } = useFacility();
  const toast = useToast();
  const branchId = branch?.branchId ?? '';
  const mayRecord = can(TOS_PERMISSIONS.gateCreate);
  const mayOverride = can(TOS_PERMISSIONS.gateOverride);
  const { conditions } = useConditions();

  const [truck, setTruck] = useState<GateOutTruck>(blankGateOutTruck);
  const [rows, setRows] = useState<ReleaseRow[]>([]);
  const [loadingVisit, setLoadingVisit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [departing, setDeparting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [result, setResult] = useState<TripSaveResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const patchRow = useCallback((key: string, p: Partial<ReleaseRow>) => {
    setRows(rs => rs.map(r => (r.key === key ? { ...r, ...p } : r)));
  }, []);

  const outstanding = rows.filter(r => !r.releasedEirNo);
  const ready = outstanding.filter(r => releaseIssues(r).length === 0);

  /** Pick the truck, then read its visit for the pick-ups it came for. */
  const pickTruck = useCallback(async (v: OpenVisit) => {
    setTruck({
      truckVisitId: v.truckVisitId,
      visitNo: v.visitNo,
      truckPlate: v.truckPlate,
      trailerPlate: v.trailerPlate ?? '',
      haulierCode: v.haulierCode ?? '',
      driverName: v.driverName ?? '',
      truckCategoryCode: v.truckCategoryCode ?? '',
    });
    setRows([]);
    setResult(null);
    setError(null);
    setIdempotencyKey(null);
    setLoadingVisit(true);
    try {
      const visit = await apiGet<TruckVisit & { pickups?: VisitPickup[] }>(
        `/api/tos/gate/visits/${v.truckVisitId}`);
      setRows((visit.pickups ?? []).filter(isPlanned).map(rowFor));
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'The truck could not be read.'));
    } finally {
      setLoadingVisit(false);
    }
  }, []);

  /**
   * What the barrier makes of the box the clerk keyed.
   *
   * It is the server's call, not this screen's: in this yard, the right load,
   * not held, and the owner the booking's line expects. Shown in red and
   * holding the Save, because a box released against a refusal cannot be put
   * back from here.
   */
  const look = useCallback(async (key: string) => {
    const row = rows.find(r => r.key === key);
    if (!branchId || !row || !row.containerNo.trim()) return;
    patchRow(key, { looking: true });
    try {
      const answer = await apiGet<GatePreflight>(preflightPath({
        branchId,
        containerNo: row.containerNo.trim().toUpperCase(),
        direction: 'OUT',
        truckVisitId: truck.truckVisitId || null,
      }));
      patchRow(key, { known: answer, looking: false, findings: answer.findings ?? [] });
    } catch {
      patchRow(key, { looking: false, known: null });
    }
  }, [branchId, patchRow, rows, truck.truckVisitId]);

  /** Release every row that is ready, in one call. */
  const release = useCallback(async () => {
    if (!branchId || saving || ready.length === 0) return;
    setSaving(true);
    setError(null);
    const key = idempotencyKey ?? crypto.randomUUID();
    setIdempotencyKey(key);
    try {
      const answer = await saveTrip({
        branchId,
        draftId: crypto.randomUUID(),
        // The visit, not a truck block: this truck is already inside, and
        // naming it again would open a second visit for one arrival.
        truckVisitId: truck.truckVisitId,
        rows: ready.map(r => releaseToTripRow(r, branchId)),
      }, key);

      setResult(answer);
      setRows(cur => cur.map(r => {
        const i = ready.findIndex(x => x.key === r.key);
        if (i < 0) return r;
        const got = answer.rows.find(x => x.index === i);
        return got
          ? { ...r, releasedEirNo: got.eirNo, releasedPdfUrl: got.eirPdfUrl, findings: got.findings ?? [] }
          : r;
      }));
      toast.toast({
        variant: 'success',
        title: answer.visitNo ?? 'Released',
        message: answer.truckLeftAt
          ? 'Nothing left to collect — the truck is out.'
          : `${answer.rows.filter(r => r.status === 'GATED').length} box(es) released.`,
      });
    } catch (e) {
      const problem = e instanceof ApiError ? e : new ApiError(0, 'The boxes could not be released.');
      const refused = problem.extension<TripRefusalRow[]>('rows') ?? [];
      setError(problem);
      setRows(cur => cur.map(r => {
        const i = ready.findIndex(x => x.key === r.key);
        if (i < 0) return r;
        const got = refused.find(x => x.index === i);
        return got ? { ...r, findings: got.findings ?? [], error: problem } : r;
      }));
    } finally {
      setSaving(false);
    }
  }, [branchId, idempotencyKey, ready, saving, toast, truck.truckVisitId]);

  /** The truck leaves. Refused while it still has a box to collect. */
  async function depart() {
    if (!truck.truckVisitId) return;
    setDeparting(true);
    setError(null);
    try {
      await departVisit(truck.truckVisitId);
      toast.toast({ variant: 'success', title: 'Truck out', message: truck.visitNo });
      clear();
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'The truck could not be let out.'));
    } finally {
      setDeparting(false);
    }
  }

  /** A supervisor lets the truck go without the box it came for. */
  async function cancel(row: ReleaseRow) {
    const reason = window.prompt(`Why is ${row.pickup.containerNo ?? 'this pick-up'} not going?`)?.trim();
    if (!reason || !truck.truckVisitId) return;
    try {
      await cancelPickup(truck.truckVisitId, row.pickup.visitPickupId, reason);
      setRows(cur => cur.filter(r => r.key !== row.key));
      toast.toast({ variant: 'success', title: 'Pick-up cancelled', message: 'The box is free again.' });
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'The pick-up could not be cancelled.'));
    }
  }

  const clear = () => {
    setTruck(blankGateOutTruck());
    setRows([]); setResult(null); setError(null); setIdempotencyKey(null);
  };

  if (!branchId) {
    return <div className="gecko-card gecko-card-padded gecko-dash-placeholder">
      No depot is assigned to this account.
    </div>;
  }
  if (!mayRecord) {
    return <div className="gecko-card gecko-card-padded gecko-dash-placeholder">
      You do not have permission to record gate moves at this depot.
    </div>;
  }

  const picked = !!truck.truckVisitId;
  const allReleased = picked && rows.length > 0 && outstanding.length === 0;

  return (
    <div className="gecko-stack gecko-stack-lg gecko-eirin-page">
      <div className="gecko-page-header">
        <div className="gecko-page-header-left">
          <h1 className="gecko-page-title">Gate Out</h1>
          <p className="gecko-page-subtitle">{branch?.displayName}</p>
        </div>
        <div className="gecko-page-header-right">
          {picked && (
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={clear}>
              <Icon name="x" size={13} /> Another truck
            </button>
          )}
        </div>
      </div>

      {/* ── 1 · the truck in front of the clerk ─────────────────────────── */}
      {/* -menus: the registration field opens a picker, and a card that clips
          would cut it off at its own edge. */}
      <div className="gecko-card gecko-card-padded gecko-stack gecko-card-menus">
        <div className="gecko-row gecko-row-between gecko-row-start">
          <div className="gecko-row gecko-gap-2h">
            <div className="gecko-step-badge">1</div>
            <div className="gecko-card-title">Truck</div>
          </div>
          {truck.visitNo && (
            <div className="gecko-visit-chip">
              <Icon name="truck" size={13} />
              <span className="gecko-text-mono">{truck.visitNo}</span>
            </div>
          )}
        </div>

        <div className="gecko-gate-truck-grid">
          <GateField label="Registration no." required>
            <TruckInYardPicker branchId={branchId} value={truck.truckPlate}
              onPick={v => void pickTruck(v)} onClear={clear} />
          </GateField>
          <GateField label="Haulier" frozen>
            <div className="gecko-readonly-value gecko-text-mono">{truck.haulierCode || '—'}</div>
          </GateField>
          <GateField label="Truck category" frozen>
            <div className="gecko-readonly-value gecko-text-mono">{truck.truckCategoryCode || '—'}</div>
          </GateField>
          <GateField label="Driver" frozen>
            <div className="gecko-readonly-value">{truck.driverName || '—'}</div>
          </GateField>
        </div>
      </div>

      {error && <div className="gecko-alert gecko-alert-error">{error.title ?? error.message}</div>}

      {/* ── 2 · what it came to collect ─────────────────────────────────── */}
      {picked && (
        <div className="gecko-card gecko-card-padded gecko-stack">
          <div className="gecko-row gecko-gap-2h">
            <div className="gecko-step-badge">2</div>
            <div>
              <div className="gecko-card-title">Boxes to collect</div>
              {rows.length > 0 && (
                <div className="gecko-card-subtitle">
                  {outstanding.length} to release of {rows.length}
                </div>
              )}
            </div>
          </div>

          {loadingVisit ? (
            <div className="gecko-dash-placeholder">Reading the truck…</div>
          ) : rows.length === 0 ? (
            <div className="gecko-dash-placeholder">
              This truck came only to drop off — there is nothing to collect.
            </div>
          ) : (
            <div className="gecko-stack-sm">
              {rows.map(r => {
                const done = !!r.releasedEirNo;
                const issues = releaseIssues(r);
                return (
                  <div key={r.key}
                    className={`gecko-move-card${done ? ' gecko-move-card-done' : ''}`}>
                    <div className="gecko-move-head">
                      <span className="gecko-move-kind gecko-move-kind-out">
                        <Icon name="arrowUp" size={12} /> Pick-up
                      </span>
                      <span className="gecko-cell-meta gecko-text-mono">{r.pickup.orderNo}</span>
                      <span className="gecko-cell-meta">{r.pickup.equipmentTypeCode}</span>
                      <div className="gecko-move-spacer" />
                      {done ? (
                        <span className="gecko-move-eir">
                          <Icon name="shieldCheck" size={13} />
                          <span className="gecko-text-mono">{r.releasedEirNo}</span>
                          {r.releasedPdfUrl && (
                            <a className="gecko-link" href={r.releasedPdfUrl} target="_blank" rel="noreferrer">print</a>
                          )}
                        </span>
                      ) : (
                        <span className={`gecko-move-ready${issues.length ? ' gecko-move-ready-no' : ''}`}>
                          {issues.length ? issues.join(' · ') : 'Ready'}
                        </span>
                      )}
                      {!done && mayOverride && (
                        <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm"
                          onClick={() => void cancel(r)}>
                          Not going
                        </button>
                      )}
                    </div>

                    {r.findings.length > 0 && (
                      <div className="gecko-move-notes">
                        {r.findings.map((f, i) => (
                          <div key={`${f.code}-${i}`}
                            className={`gecko-eirin-finding gecko-eirin-finding-${f.severity === 'BLOCK' ? 'block' : f.severity === 'INFO' ? 'info' : 'override'}`}>
                            <Icon name={f.severity === 'INFO' ? 'info' : 'alertCircle'} size={13} />
                            <span>{f.message}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {!done && (
                      <div className="gecko-move-body">
                        <div className="gecko-gate-grid-4">
                          <GateField label="Container no." required
                            hint={yardChooses(r) ? 'The yard chooses — key the box loaded.' : undefined}
                            error={r.error?.forField('containerNo')}>
                            <input className="gecko-input gecko-text-mono" value={r.containerNo} maxLength={14}
                              onChange={e => patchRow(r.key, {
                                containerNo: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                                findings: [],
                              })}
                              onBlur={() => void look(r.key)} />
                          </GateField>
                          <GateField label="Seal #1">
                            <input className="gecko-input gecko-text-mono" value={r.sealNo1} maxLength={20}
                              onChange={e => patchRow(r.key, { sealNo1: e.target.value.toUpperCase() })} />
                          </GateField>
                          <GateField label="Seal #2">
                            <input className="gecko-input gecko-text-mono" value={r.sealNo2} maxLength={20}
                              aria-label="Seal 2"
                              onChange={e => patchRow(r.key, { sealNo2: e.target.value.toUpperCase() })} />
                          </GateField>
                          <GateField label="Status">
                            <select className="gecko-input" value={r.conditionCode}
                              onChange={e => patchRow(r.key, { conditionCode: e.target.value })}>
                              <option value="">—</option>
                              {conditions.map(c => (
                                <option key={c.conditionCode} value={c.conditionCode}>
                                  {c.conditionCode} - {c.descriptionEn}
                                </option>
                              ))}
                            </select>
                          </GateField>
                          <GateField label="Remarks" span={2}>
                            <input className="gecko-input" value={r.remarks} maxLength={300}
                              onChange={e => patchRow(r.key, { remarks: e.target.value })} />
                          </GateField>
                        </div>
                        {r.looking && <div className="gecko-cell-meta">Checking the box…</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="gecko-row gecko-row-between gecko-flex-wrap gecko-gap-2">
            <span className="gecko-cell-meta">
              {rows.some(isBlocked) ? 'A refusal above has to be cleared before the truck can go.' : ''}
            </span>
            <div className="gecko-row gecko-gap-2">
              {(rows.length === 0 || allReleased || result?.truckLeftAt) && (
                <button className="gecko-btn gecko-btn-outline gecko-btn-sm" disabled={departing}
                  onClick={depart}>
                  <Icon name="truck" size={13} /> {departing ? 'Letting out…' : 'Truck out'}
                </button>
              )}
              {outstanding.length > 0 && (
                <button className="gecko-btn gecko-btn-primary gecko-btn-sm"
                  disabled={saving || ready.length === 0} onClick={release}>
                  <Icon name="check" size={13} />
                  {saving ? 'Releasing…' : `Release ${ready.length} box${ready.length === 1 ? '' : 'es'}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {result?.truckLeftAt && (
        <div className="gecko-card gecko-card-padded gecko-saved-trip">
          <Icon name="shieldCheck" size={18} />
          <span>
            <span className="gecko-text-mono">{result.visitNo}</span> — nothing left to collect. The truck is out.
          </span>
          {' '}
          <Link href="/gate/eir-out-register" className="gecko-link">EIR-Out register</Link>
        </div>
      )}
    </div>
  );
}
