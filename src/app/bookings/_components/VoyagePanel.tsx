"use client";
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { DateField } from '@/components/ui/DateField';
import { useApi } from '@/lib/api/use-api';
import { ApiError } from '@/lib/api/problem';
import { useSession } from '@/lib/auth/session';
import { formatDate, formatDateTime } from '@/lib/format';
import {
  CUTOFF_KINDS, addCutoffException, cutoffExceptionsPath, effectiveCutoffsPath,
  exceptionId, isLive, revokeCutoffException,
  type CutoffException, type EffectiveCutoff,
} from '@/lib/api/booking-voyage';

/**
 * Vessel & Voyage, as Vector lays it out.
 *
 * Vessel, voyage, wharf and ETD come from the vessel call and are READ-ONLY —
 * they belong to the sailing, and a booking that could retype them is a booking
 * that can disagree with every other booking on the same ship.
 *
 * The cut-offs are read-only in the same way, but each one can be OVERRIDDEN for
 * this booking alone: that is a cut-off exception, carrying who allowed it, until
 * when and why, instead of quietly moving the sailing's date under everybody else.
 */

export interface VoyageCall {
  vesselCallId: string;
  callRef: string;
  vesselCode?: string | null;
  vesselName?: string | null;
  terminalCode?: string | null;
  operatorVoyageIn?: string | null;
  operatorVoyageOut?: string | null;
  etd: string;
  status: string;
  lines: string[];
}

export function VoyagePanel({
  bookingId, lineCode, calls, vesselCallId, onVesselCall,
  polPortCode, podPortCode, fpdPortCode, onPort,
  allowLateGateIn, onAllowLate, paperlessCode, onPaperless,
  fieldError, apiHasNewFields = false,
}: {
  /** Null until the booking exists — the cut-off override needs a booking. */
  bookingId: string | null;
  lineCode: string | null;
  calls: VoyageCall[];
  vesselCallId: string;
  onVesselCall: (id: string) => void;
  polPortCode: string;
  podPortCode: string;
  fpdPortCode: string;
  onPort: (which: 'pol' | 'pod' | 'fpd', v: string) => void;
  allowLateGateIn: boolean;
  onAllowLate: (v: boolean) => void;
  paperlessCode: string;
  onPaperless: (v: string) => void;
  fieldError: (f: string) => string | undefined;
  /** Flip on when the API carries allowLateGateIn / paperlessCode. */
  apiHasNewFields?: boolean;
}) {
  const { can } = useSession();
  const mayOverride = can('tos.cutoff.override');
  const call = calls.find(c => c.vesselCallId === vesselCallId) ?? null;

  const cutoffs = useApi<EffectiveCutoff[]>(
    call ? effectiveCutoffsPath(call.vesselCallId, lineCode) : null);
  const exceptions = useApi<CutoffException[]>(
    bookingId ? cutoffExceptionsPath(bookingId) : null);

  const [override, setOverride] = useState<{ kind: string; label: string } | null>(null);

  const liveExceptions = (exceptions.data ?? []).filter(isLive);
  const exceptionFor = (kind: string) => liveExceptions.find(e => e.cutoffKind === kind) ?? null;
  const cutoffFor = (kind: string) => (cutoffs.data ?? []).find(c => c.kind === kind) ?? null;

  return (
    <div className="gecko-stack">
      <div className="gecko-eyebrow">Vessel &amp; voyage</div>

      <div className="gecko-newbk-grid">
        <FieldBlock label="Vessel call" error={fieldError('vesselCallId')}
          hint="The sailing this booking belongs to. Everything below follows from it.">
          <select className="gecko-input" value={vesselCallId} onChange={e => onVesselCall(e.target.value)}>
            <option value="">Awaiting the line&apos;s schedule</option>
            {calls.filter(c => c.status !== 'CANCELLED').map(c => (
              <option key={c.vesselCallId} value={c.vesselCallId}>
                {c.callRef} · ETD {formatDate(c.etd)}{c.lines.length ? ` · ${c.lines.join(', ')}` : ''}
              </option>
            ))}
          </select>
        </FieldBlock>
        <ReadOnly label="Vessel" value={call ? [call.vesselCode, call.vesselName].filter(Boolean).join(' — ') : null} />
        <ReadOnly label="Voyage in / out" value={call ? [call.operatorVoyageIn, call.operatorVoyageOut].filter(Boolean).join(' / ') : null} />
        <ReadOnly label="Wharf" value={call?.terminalCode ?? null} />
      </div>

      <div className="gecko-newbk-grid">
        <ReadOnly label="ETD" value={call ? formatDateTime(call.etd) : null} />
        <FieldBlock label="Paperless code" error={fieldError('paperlessCode')}
          hint={apiHasNewFields ? "The line's e-release reference." : 'Waiting on the API — see docs/BOOKING_VECTOR_PARITY_FOR_API.md.'}>
          <input className="gecko-input gecko-text-mono" maxLength={30} value={paperlessCode}
            disabled={!apiHasNewFields} onChange={e => onPaperless(e.target.value.toUpperCase())} />
        </FieldBlock>
        <div>
          <div className="gecko-field-label gecko-mb-1">Late gate-in</div>
          <label className="gecko-row" style={{ gap: 6 }}>
            <input type="checkbox" className="gecko-checkbox" checked={allowLateGateIn}
              disabled={!apiHasNewFields || !mayOverride}
              onChange={e => onAllowLate(e.target.checked)} />
            <span>Allow after the cut-off</span>
          </label>
          {/* Deliberately not hidden without the permission: a clerk should see
              that the tick exists and is not theirs to give. */}
          <div className="gecko-cell-meta">
            {!apiHasNewFields ? 'Waiting on the API.'
              : mayOverride ? 'Only tos.cutoff.override may set this.'
              : 'A supervisor with tos.cutoff.override sets this.'}
          </div>
        </div>
      </div>

      <div className="gecko-newbk-grid">
        <FieldBlock label="Port of loading" error={fieldError('polPortCode')}>
          <input className="gecko-input gecko-text-mono" maxLength={10} value={polPortCode}
            placeholder="THLCH" onChange={e => onPort('pol', e.target.value.toUpperCase())} />
        </FieldBlock>
        <FieldBlock label="Port of discharge" error={fieldError('podPortCode')}>
          <input className="gecko-input gecko-text-mono" maxLength={10} value={podPortCode}
            onChange={e => onPort('pod', e.target.value.toUpperCase())} />
        </FieldBlock>
        <FieldBlock label="Final place of delivery" error={fieldError('fpdPortCode')}>
          <input className="gecko-input gecko-text-mono" maxLength={10} value={fpdPortCode}
            onChange={e => onPort('fpd', e.target.value.toUpperCase())} />
        </FieldBlock>
      </div>

      {/* ── cut-offs ─────────────────────────────────────────────────────── */}
      <div className="gecko-stack-sm">
        <div className="gecko-row" style={{ gap: 8 }}>
          <span className="gecko-field-label gecko-flex-1">Cut-offs</span>
          {!call && <span className="gecko-cell-meta">Pick a vessel call to see them.</span>}
        </div>

        {call && (
          <table className="gecko-table gecko-table-compact">
            <thead>
              <tr>
                <th style={{ width: 200 }}>Cut-off</th>
                <th style={{ width: 170 }}>From the sailing</th>
                <th style={{ width: 170 }}>This booking</th>
                <th>Why</th>
                <th style={{ width: 120 }} />
              </tr>
            </thead>
            <tbody>
              {CUTOFF_KINDS.map(k => {
                const base = cutoffFor(k.kind);
                const ex = exceptionFor(k.kind);
                return (
                  <tr key={k.kind}>
                    <td>
                      {k.label}
                      {k.pending && <div className="gecko-cell-meta">not in the API yet</div>}
                    </td>
                    <td className="gecko-text-mono">{base ? formatDateTime(base.at) : '—'}</td>
                    <td className="gecko-text-mono" style={{ color: ex ? 'var(--gecko-warning-700)' : undefined }}>
                      {ex ? formatDateTime(ex.allowedUntil) : '—'}
                    </td>
                    <td className="gecko-cell-meta">{ex?.reason ?? ''}</td>
                    <td>
                      {mayOverride && bookingId && !k.pending && (
                        ex
                          ? <button className="gecko-btn gecko-btn-ghost gecko-btn-sm"
                              onClick={() => void revokeCutoffException(bookingId, exceptionId(ex)).then(() => exceptions.reload())}>
                              Revoke
                            </button>
                          : <button className="gecko-btn gecko-btn-outline gecko-btn-sm"
                              onClick={() => setOverride({ kind: k.kind, label: k.label })}>
                              Change
                            </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {call && !bookingId && (
          <div className="gecko-cell-meta">
            A cut-off is changed for one booking, so the booking has to exist first — create it on step 1.
          </div>
        )}
        {call && bookingId && !mayOverride && (
          <div className="gecko-cell-meta">Changing a cut-off needs tos.cutoff.override.</div>
        )}
      </div>

      {override && bookingId && (
        <OverrideDialog
          bookingId={bookingId}
          kind={override.kind}
          label={override.label}
          current={cutoffFor(override.kind)?.at ?? null}
          onClose={() => setOverride(null)}
          onDone={() => { setOverride(null); exceptions.reload(); }} />
      )}
    </div>
  );
}

function OverrideDialog({ bookingId, kind, label, current, onClose, onDone }: {
  bookingId: string; kind: string; label: string; current: string | null;
  onClose: () => void; onDone: () => void;
}) {
  const [until, setUntil] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      // datetime-local has no zone; the server reads it in the depot's.
      await addCutoffException(bookingId, { cutoffKind: kind, allowedUntil: until, reason: reason.trim() });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'The cut-off could not be changed.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="md"
      title={`Change ${label}`}
      subtitle="For this booking only. The sailing's own cut-off is untouched, and every other booking on it keeps the original."
      footer={
        <>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm"
            disabled={busy || !until || reason.trim().length < 3} onClick={submit}>
            <Icon name="check" size={14} /> {busy ? 'Saving…' : 'Allow until'}
          </button>
        </>
      }
    >
      <div className="gecko-stack">
        {error && <div role="alert" className="gecko-alert gecko-alert-error">{error.message}</div>}
        <div className="gecko-cell-meta">
          The sailing says {current ? formatDateTime(current) : 'nothing for this cut-off'}.
        </div>
        <div>
          <div className="gecko-field-label gecko-mb-1">Allowed until</div>
          <DateField withTime value={until} onChange={setUntil} aria-label="Allowed until" />
        </div>
        <div>
          <div className="gecko-field-label gecko-mb-1">Why (kept on the booking)</div>
          <textarea className="gecko-textarea gecko-input" rows={3} maxLength={300}
            value={reason} onChange={e => setReason(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

function FieldBlock({ label, error, hint, children }: {
  label: string; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="gecko-field-label gecko-mb-1">{label}</div>
      {children}
      {hint && !error && <div className="gecko-cell-meta">{hint}</div>}
      {error && <div className="gecko-field-error">{error}</div>}
    </div>
  );
}

/** Inherited from the sailing — shown, never typed. */
function ReadOnly({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="gecko-field-label gecko-mb-1">{label}</div>
      <div className="gecko-readonly-value">{value || '—'}</div>
      <div className="gecko-cell-meta">From the vessel schedule.</div>
    </div>
  );
}
