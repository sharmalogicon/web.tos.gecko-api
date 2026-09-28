"use client";
import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { apiGet, apiSend } from '@/lib/api/client';
import { ApiError } from '@/lib/api/problem';
import { useSession } from '@/lib/auth/session';
import {
  DECISION_TONE, SEVERITY_TONE, TOS_PERMISSIONS,
  formatContainerNo, formatDateTime, type GateDirection, type GateFinding,
  type GatePreflight, type GateTransaction,
} from '@/lib/api/tos';

/**
 * THE GATE DESK — live against gecko_tos (PLAN §5.2–§5.5, Phase 5).
 *
 * This is the 3-second path made visible. The clerk types (or the camera reads)
 * a container number; the barrier answers ALLOWED, NEEDS OVERRIDE or REFUSED
 * with a reason for every finding, because a refusal a clerk cannot explain to
 * a driver is a refusal that gets worked around.
 *
 * Recording the move is ONE call. Behind it, one SQL transaction writes the
 * truck visit, the EIR, the seals, the step going DONE, the yard row opening or
 * closing, the visit journal, the assignment ending, the coupon being spent and
 * the outbox message Notification turns into the customer's LINE message.
 * Vector wrote those from five places, which is why its four answers to "what is
 * in the yard" disagree by three boxes.
 *
 * The screen never decides anything the API has not already decided: the
 * override fields appear because the SERVER said NEEDS_OVERRIDE, not because
 * this component guessed.
 */

interface SealRow { sealNo: string; sealType: string; isIntact: boolean }

const EMPTY_SEAL: SealRow = { sealNo: '', sealType: 'LINE', isIntact: true };

export default function GateDeskPage() {
  const { user, can, canAt } = useSession();
  const toast = useToast();

  const branchId = user?.branches?.[0] ?? null;
  const [containerNo, setContainerNo] = useState('');
  const [direction, setDirection] = useState<GateDirection>('IN');
  const [view, setView] = useState<GatePreflight | null>(null);
  const [checking, setChecking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [eir, setEir] = useState<GateTransaction | null>(null);
  const [error, setError] = useState<string | null>(null);

  // what the clerk observed
  const [plate, setPlate] = useState('');
  const [driver, setDriver] = useState('');
  const [haulier, setHaulier] = useState('');
  const [grossWeight, setGrossWeight] = useState('');
  const [position, setPosition] = useState('');
  const [seals, setSeals] = useState<SealRow[]>([EMPTY_SEAL]);
  const [lateReason, setLateReason] = useState('');
  const [digitReason, setDigitReason] = useState('');

  const mayRecord = canAt(TOS_PERMISSIONS.gateCreate, branchId);
  const mayOverrideLate = canAt(TOS_PERMISSIONS.cutoffOverride, branchId);
  const mayOverrideDigit = canAt(TOS_PERMISSIONS.gateOverride, branchId);

  const needsLate = useMemo(() => view?.findings.some(f => f.code === 'LATE') ?? false, [view]);
  const needsDigit = useMemo(() => view?.findings.some(f => f.code === 'CHECK_DIGIT') ?? false, [view]);
  const blocked = view?.decision === 'BLOCKED';

  const reset = useCallback(() => {
    setView(null); setEir(null); setError(null);
    setSeals([EMPTY_SEAL]); setGrossWeight(''); setLateReason(''); setDigitReason('');
  }, []);

  async function check(e?: React.FormEvent) {
    e?.preventDefault();
    const box = containerNo.trim().toUpperCase().replace(/\s+/g, '');
    if (!box || !branchId) return;
    setChecking(true); setError(null); setEir(null);
    try {
      const answer = await apiGet<GatePreflight>(
        `/api/tos/gate/preflight?branchId=${branchId}&containerNo=${encodeURIComponent(box)}&direction=${direction}`);
      setView(answer);
      setContainerNo(answer.containerNo);
      // The declared seal is what the paperwork says; the gate records what it sees.
      if (answer.booking?.declaredSealNo && seals.length === 1 && !seals[0].sealNo)
        setSeals([{ ...EMPTY_SEAL, sealNo: answer.booking.declaredSealNo }]);
    } catch (err) {
      setView(null);
      setError(err instanceof ApiError ? err.message : 'The barrier could not be reached.');
    } finally {
      setChecking(false);
    }
  }

  async function record() {
    if (!view || !branchId) return;
    setRecording(true); setError(null);
    try {
      const body = {
        branchId,
        containerNo: view.containerNo,
        direction,
        truck: { plate: plate.trim() || 'UNKNOWN', driverName: driver.trim() || null, haulierCode: haulier.trim() || null },
        grossWeightKg: grossWeight ? Number(grossWeight) : null,
        weightSource: grossWeight ? 'WEIGHBRIDGE' : null,
        positionText: position.trim() || null,
        seals: seals.filter(s => s.sealNo.trim()).map(s => ({ sealNo: s.sealNo.trim(), sealType: s.sealType, isIntact: s.isIntact })),
        lateOverrideReason: needsLate ? lateReason.trim() : null,
        checkDigitOverrideReason: needsDigit ? digitReason.trim() : null,
      };
      const written = await apiSend<GateTransaction>('POST', '/api/tos/gate/transactions', body);
      setEir(written);
      setView(null);
      toast.toast({ variant: 'success', title: written.eirNo, message: `${written.movementCode} recorded` });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The move could not be recorded.');
    } finally {
      setRecording(false);
    }
  }

  function nextBox() {
    reset();
    setContainerNo(''); setPlate(''); setDriver(''); setPosition('');
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', paddingBottom: 60 }}>

      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline gecko-stack-md">
            <h1 className="gecko-page-title">Gate desk</h1>
            <span className="gecko-badge gecko-badge-success">LIVE</span>
          </div>
          <div className="gecko-page-subtitle gecko-mt-1">
            Ask the barrier about a box, then record it crossing. One call writes the EIR, the step, the yard row,
            the journal and the message the customer gets — or none of them.
          </div>
        </div>
        <div className="gecko-toolbar">
          <Link href="/gate/stock" className="gecko-btn gecko-btn-outline gecko-btn-sm">
            <Icon name="layers" size={16} /> Yard stock
          </Link>
        </div>
      </div>

      {!branchId && (
        <div className="gecko-alert gecko-alert-warning">
          <Icon name="alertTriangle" size={18} />
          <div>Your account is not attached to a depot, so there is no barrier to work at.</div>
        </div>
      )}

      {/* ── the number ─────────────────────────────────────────────────── */}
      <form onSubmit={check} className="gecko-card" style={{ padding: 20 }}>
        <div className="gecko-row gecko-stack-md" style={{ gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="gecko-form-group" style={{ flex: '1 1 320px', minWidth: 260 }}>
            <label className="gecko-form-label" htmlFor="containerNo">Container number</label>
            <input
              id="containerNo"
              className="gecko-input"
              style={{ fontSize: 22, letterSpacing: '0.08em', fontFamily: 'var(--gecko-font-mono, monospace)', textTransform: 'uppercase' }}
              value={containerNo}
              onChange={e => { setContainerNo(e.target.value); if (view || eir) reset(); }}
              placeholder="ABCU1234567"
              autoFocus
              autoComplete="off"
            />
          </div>

          <div className="gecko-form-group">
            <label className="gecko-form-label">Direction</label>
            <div className="gecko-row" style={{ gap: 0 }}>
              {(['IN', 'OUT'] as GateDirection[]).map(way => (
                <button
                  key={way}
                  type="button"
                  className={`gecko-btn gecko-btn-sm ${direction === way ? 'gecko-btn-primary' : 'gecko-btn-outline'}`}
                  style={{ borderRadius: way === 'IN' ? '6px 0 0 6px' : '0 6px 6px 0', minWidth: 74 }}
                  onClick={() => { setDirection(way); if (view || eir) reset(); }}
                >
                  {way === 'IN' ? 'Gate in' : 'Gate out'}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="gecko-btn gecko-btn-primary" disabled={checking || !containerNo.trim() || !branchId}>
            <Icon name="search" size={16} /> {checking ? 'Asking…' : 'Ask the barrier'}
          </button>
          {(view || eir) && (
            <button type="button" className="gecko-btn gecko-btn-outline" onClick={nextBox}>Next box</button>
          )}
        </div>
      </form>

      {error && (
        <div className="gecko-alert gecko-alert-error">
          <Icon name="alertCircle" size={18} />
          <div>{error}</div>
        </div>
      )}

      {/* ── what the barrier said ──────────────────────────────────────── */}
      {view && <Decision view={view} />}

      {view && (
        <div className="gecko-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          <BookingCard view={view} />
          <StepCard view={view} />
          <HoldsCard view={view} />
          <ContextCard view={view} />
        </div>
      )}

      {/* ── record it ──────────────────────────────────────────────────── */}
      {view && !blocked && (
        <div className="gecko-card" style={{ padding: 20 }}>
          <div className="gecko-row gecko-row-between gecko-stack-md">
            <h2 className="gecko-card-title" style={{ margin: 0 }}>Record the move</h2>
            {!mayRecord && <span className="gecko-badge gecko-badge-gray">You may look, not record</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 14 }}>
            <Field label="Truck plate" value={plate} onChange={setPlate} placeholder="70-1234" />
            <Field label="Driver" value={driver} onChange={setDriver} placeholder="Name on the licence" />
            <Field label="Haulier code" value={haulier} onChange={setHaulier} placeholder="HAU-LCH" />
            <Field
              label={view.nextStep?.checkGrossWeight ? 'Gross weight (kg) — required' : 'Gross weight (kg)'}
              value={grossWeight} onChange={setGrossWeight} placeholder="22150" type="number"
            />
            <Field label="Yard position" value={position} onChange={setPosition} placeholder="A-03-2" />
          </div>

          {/* Seals: the step's MDM rule decides whether one is required. */}
          <div className="gecko-stack gecko-stack-md" style={{ marginTop: 18 }}>
            <div className="gecko-row gecko-row-between">
              <div className="gecko-form-label" style={{ margin: 0 }}>
                Seals {view.nextStep?.checkSealNo && <span className="gecko-badge gecko-badge-xs gecko-badge-warning">required by {view.nextStep.movementCode}</span>}
              </div>
              <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-xs" onClick={() => setSeals([...seals, { ...EMPTY_SEAL }])}>
                <Icon name="plus" size={14} /> Add seal
              </button>
            </div>
            {seals.map((seal, i) => (
              <div key={i} className="gecko-row gecko-stack-md" style={{ gap: 10, flexWrap: 'wrap' }}>
                <input
                  className="gecko-input" style={{ flex: '1 1 200px', fontFamily: 'var(--gecko-font-mono, monospace)' }}
                  value={seal.sealNo} placeholder="Seal number"
                  onChange={e => setSeals(seals.map((s, j) => j === i ? { ...s, sealNo: e.target.value } : s))}
                />
                <select
                  className="gecko-input" style={{ width: 140 }}
                  value={seal.sealType}
                  onChange={e => setSeals(seals.map((s, j) => j === i ? { ...s, sealType: e.target.value } : s))}
                >
                  {['LINE', 'CUSTOMS', 'SHIPPER', 'TERMINAL', 'OTHER'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <label className="gecko-row gecko-row-start" style={{ gap: 6 }}>
                  <input
                    type="checkbox" checked={seal.isIntact}
                    onChange={e => setSeals(seals.map((s, j) => j === i ? { ...s, isIntact: e.target.checked } : s))}
                  />
                  <span className="gecko-cell-meta">intact</span>
                </label>
                {seals.length > 1 && (
                  <button type="button" className="gecko-mini-icon gecko-mini-icon-neutral" aria-label="Remove seal"
                          onClick={() => setSeals(seals.filter((_, j) => j !== i))}>
                    <Icon name="x" size={14} />
                  </button>
                )}
              </div>
            ))}
            {view.booking?.declaredSealNo && (
              <div className="gecko-cell-meta">
                The paperwork declares <strong>{view.booking.declaredSealNo}</strong>. Record what you see —
                a difference is written on the EIR, not argued about later.
              </div>
            )}
          </div>

          {/* Overrides appear because the SERVER said so. */}
          {needsLate && (
            <Override
              tone="warning"
              title="This box is late"
              detail={view.findings.find(f => f.code === 'LATE')?.message ?? ''}
              allowed={mayOverrideLate}
              deniedNote="Only someone holding tos.cutoff.override can let it in. Fetch a supervisor."
              value={lateReason} onChange={setLateReason}
              placeholder="Why is the late gate allowed? (goes on the EIR)"
            />
          )}
          {needsDigit && (
            <Override
              tone="warning"
              title="The check digit does not match"
              detail={view.findings.find(f => f.code === 'CHECK_DIGIT')?.message ?? ''}
              allowed={mayOverrideDigit}
              deniedNote="Only someone holding tos.gate.override can accept a number that fails ISO 6346."
              value={digitReason} onChange={setDigitReason}
              placeholder="Why is this number being accepted?"
            />
          )}

          <div className="gecko-row gecko-row-between gecko-stack-md" style={{ marginTop: 20 }}>
            <div className="gecko-cell-meta">
              {view.nextStep
                ? <>This records <strong>{view.nextStep.movementCode}</strong> ({view.nextStep.fullEmpty.toLowerCase()}) on {view.booking?.orderNo}.</>
                : 'Nothing to record.'}
            </div>
            <button
              className="gecko-btn gecko-btn-primary"
              disabled={recording || !mayRecord
                || (needsLate && (!mayOverrideLate || !lateReason.trim()))
                || (needsDigit && (!mayOverrideDigit || !digitReason.trim()))}
              onClick={record}
            >
              <Icon name="check" size={16} /> {recording ? 'Recording…' : 'Record the move'}
            </button>
          </div>
        </div>
      )}

      {/* ── the EIR ────────────────────────────────────────────────────── */}
      {eir && <Receipt eir={eir} onNext={nextBox} />}
    </div>
  );
}

// ─── pieces ──────────────────────────────────────────────────────────────────

function Decision({ view }: { view: GatePreflight }) {
  const tone = DECISION_TONE[view.decision];
  return (
    <div className="gecko-card" style={{
      padding: 18, borderLeft: `5px solid var(--gecko-${tone.tone}-500)`, background: `var(--gecko-${tone.tone}-50)`,
    }}>
      <div className="gecko-row gecko-row-between" style={{ gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="gecko-row gecko-row-baseline" style={{ gap: 10 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: `var(--gecko-${tone.tone}-700)` }}>{tone.label}</span>
            <span style={{ fontFamily: 'var(--gecko-font-mono, monospace)', fontSize: 16 }}>
              {formatContainerNo(view.containerNo)}
            </span>
            <span className="gecko-badge gecko-badge-gray">{view.direction === 'IN' ? 'gate in' : 'gate out'}</span>
          </div>
          <div className="gecko-cell-meta" style={{ marginTop: 4 }}>{tone.hint}</div>
        </div>
        <div className="gecko-cell-meta">asked {formatDateTime(view.at)}</div>
      </div>

      {view.findings.length > 0 && (
        <div className="gecko-stack gecko-stack-md" style={{ marginTop: 14 }}>
          {view.findings.map((f: GateFinding) => (
            <div key={f.code + f.message} className="gecko-row gecko-row-start" style={{ gap: 10, alignItems: 'flex-start' }}>
              <span className={`gecko-badge gecko-badge-xs gecko-badge-${SEVERITY_TONE[f.severity]}`}>{f.code}</span>
              <span style={{ fontSize: 13 }}>{f.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Card({ title, children, empty }: { title: string; children?: React.ReactNode; empty?: string }) {
  return (
    <div className="gecko-card" style={{ padding: 16 }}>
      <div className="gecko-card-title" style={{ marginBottom: 10 }}>{title}</div>
      {/* `cond && <x/>` hands us `false`, which `??` would keep — show the empty note for it too. */}
      {children === false || children == null ? <div className="gecko-cell-meta">{empty}</div> : children}
    </div>
  );
}

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="gecko-row gecko-row-between" style={{ gap: 12, padding: '3px 0' }}>
      <span className="gecko-cell-meta">{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, textAlign: 'right' }}>{value ?? '—'}</span>
    </div>
  );
}

function BookingCard({ view }: { view: GatePreflight }) {
  const b = view.booking;
  return (
    <Card title="Why it is here" empty="No open booking carries this box.">
      {b && (
        <div>
          <Line label="Order" value={<Link href={`/bookings`} className="gecko-link">{b.orderNo}</Link>} />
          <Line label="Order type" value={b.orderTypeCode} />
          <Line label="Line" value={b.lineCode} />
          <Line label="Customer" value={b.customerCode ?? '—'} />
          <Line label="Vessel call" value={b.callRef ?? '—'} />
          <Line label="Valid to" value={b.validTo ?? '—'} />
        </div>
      )}
    </Card>
  );
}

function StepCard({ view }: { view: GatePreflight }) {
  const s = view.nextStep;
  return (
    <Card title="What this move completes" empty="No pending step goes this way.">
      {s && (
        <div>
          <Line label="Movement" value={<><strong>{s.movementCode}</strong> · step {s.sequenceNo}</>} />
          <Line label="Load" value={s.fullEmpty} />
          <div className="gecko-row gecko-stack-md" style={{ gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {s.checkSealNo && <span className="gecko-badge gecko-badge-xs gecko-badge-info">checks seal</span>}
            {s.checkGrossWeight && <span className="gecko-badge gecko-badge-xs gecko-badge-info">weighs</span>}
            {s.requireVesselVoyage && <span className="gecko-badge gecko-badge-xs gecko-badge-info">needs vessel</span>}
            {s.requiresSurvey && <span className="gecko-badge gecko-badge-xs gecko-badge-warning">survey</span>}
            {s.allowDamagedRelease && <span className="gecko-badge gecko-badge-xs gecko-badge-gray">damaged release ok</span>}
          </div>
          {s.stepsSkipped.length > 0 && (
            <div className="gecko-cell-meta" style={{ marginTop: 10 }}>
              Recording this skips {s.stepsSkipped.join(', ')} — optional steps, marked on the record with a reason.
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function HoldsCard({ view }: { view: GatePreflight }) {
  return (
    <Card title="Holds" empty="Nothing is holding this box.">
      {view.holds.length > 0 && (
        <div className="gecko-stack gecko-stack-md">
          {view.holds.map(h => (
            <div key={h.containerHoldId} className="gecko-row gecko-row-between" style={{ gap: 10 }}>
              <div>
                <span className={`gecko-badge gecko-badge-xs gecko-badge-${h.blocksThisMove ? 'error' : 'gray'}`}>{h.holdCode}</span>
                <span className="gecko-cell-meta" style={{ marginLeft: 8 }}>
                  {h.description ?? h.blockingScope} · via {h.heldVia === 'BOOKING' ? 'the booking' : 'the box'}
                </span>
              </div>
              <span className="gecko-cell-meta">
                {h.blocksThisMove ? 'stops this move' : `blocks ${h.blockingScope}`}
              </span>
            </div>
          ))}
          <div className="gecko-cell-meta">Released by its authority, on record — never at the barrier.</div>
        </div>
      )}
    </Card>
  );
}

function ContextCard({ view }: { view: GatePreflight }) {
  return (
    <Card title="Yard, cut-off and payment">
      <div>
        <Line label="In the yard" value={view.inYard ? `${view.inYard.fullEmpty} · ${view.inYard.positionText ?? 'no slot'}` : 'not here'} />
        <Line
          label="Cut-off"
          value={view.cutoff
            ? <span style={{ color: view.cutoff.isLate ? 'var(--gecko-error-700)' : undefined }}>
                {view.cutoff.kind} {formatDateTime(view.cutoff.at)}{view.cutoff.isLate ? ' · late' : ''}
              </span>
            : 'none applies'}
        />
        <Line label="Late approved" value={view.cutoff?.coveredByExceptionId ? 'yes, in advance' : '—'} />
        <Line label="Coupon" value={view.coupon ? `${view.coupon.couponRef} (${view.coupon.paymentChannel})` : 'none'} />
        <Line label="Check digit" value={view.isCheckDigitValid ? 'valid' : 'fails ISO 6346'} />
        <Line label="In the registry" value={view.isInRegistry ? 'yes' : 'unknown box'} />
      </div>
    </Card>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="gecko-form-group">
      <label className="gecko-form-label">{label}</label>
      <input className="gecko-input" value={value} type={type} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function Override({ tone, title, detail, allowed, deniedNote, value, onChange, placeholder }: {
  tone: string; title: string; detail: string; allowed: boolean; deniedNote: string;
  value: string; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <div style={{
      marginTop: 18, padding: 14, borderRadius: 8,
      background: `var(--gecko-${tone}-50)`, border: `1px solid var(--gecko-${tone}-200)`,
    }}>
      <div className="gecko-row gecko-row-start" style={{ gap: 8 }}>
        <Icon name="alertTriangle" size={16} />
        <strong style={{ fontSize: 13 }}>{title}</strong>
      </div>
      <div className="gecko-cell-meta" style={{ marginTop: 4 }}>{detail}</div>
      {allowed ? (
        <input className="gecko-input" style={{ marginTop: 10 }} value={value} placeholder={placeholder}
               onChange={e => onChange(e.target.value)} />
      ) : (
        <div className="gecko-cell-meta" style={{ marginTop: 10, fontWeight: 600 }}>{deniedNote}</div>
      )}
    </div>
  );
}

function Receipt({ eir, onNext }: { eir: GateTransaction; onNext: () => void }) {
  return (
    <div className="gecko-card" style={{ padding: 20, borderLeft: '5px solid var(--gecko-success-500)' }}>
      <div className="gecko-row gecko-row-between" style={{ flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div className="gecko-row gecko-row-baseline" style={{ gap: 10 }}>
            <span style={{ fontSize: 20, fontWeight: 700 }}>{eir.eirNo}</span>
            <span className="gecko-badge gecko-badge-success">{eir.status}</span>
            {eir.isLate && <span className="gecko-badge gecko-badge-warning">late, on record</span>}
            {eir.sealMismatch && <span className="gecko-badge gecko-badge-warning">seal differs</span>}
          </div>
          <div className="gecko-cell-meta" style={{ marginTop: 4 }}>
            {formatContainerNo(eir.containerNo)} · {eir.movementCode} · {eir.fullEmpty.toLowerCase()} ·
            visit {eir.visitNo} ({eir.truckPlate}) · {formatDateTime(eir.transactionAt)}
          </div>
        </div>
        <button className="gecko-btn gecko-btn-primary" onClick={onNext}>
          <Icon name="arrowRight" size={16} /> Next box
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 16 }}>
        <Line label="Order" value={eir.orderNo} />
        <Line label="Line" value={eir.lineCode} />
        <Line label="Equipment" value={eir.equipmentTypeCode ?? '—'} />
        <Line label="Gross weight" value={eir.grossWeightKg ? `${eir.grossWeightKg.toLocaleString()} kg` : '—'} />
        <Line label="Seals" value={eir.seals.length ? eir.seals.map(s => s.sealNo).join(', ') : '—'} />
        <Line label="Booking finished" value={eir.bookingContainerCompleted ? 'yes, the box is off it' : 'more steps to come'} />
      </div>

      <div className="gecko-cell-meta" style={{ marginTop: 14 }}>
        Written in one transaction: the EIR, the step, the yard row, the visit journal
        {eir.gateAuthorizationId ? ', the coupon' : ''} and the message the customer receives.
      </div>
    </div>
  );
}
