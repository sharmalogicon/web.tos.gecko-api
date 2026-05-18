"use client";

/**
 * Ad-hoc reefer task creation.
 *
 * Used when crew needs to register a workflow task for a container that
 * wasn't auto-created from a booking — e.g. a reefer that arrived ahead of
 * schedule, a one-off PTI requested by the line, or a manual temp reading
 * outside the cadence.
 *
 * Three workflows in one page, picked via a segmented control.
 * Container picker accepts any ISO 6346 container number, with autocomplete
 * suggestions from the current yard reefer roster.
 *
 * Phase 1: creates in-memory mock entries + toast. Phase 2 wires to backend.
 */

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { REEFER_ROSTER } from '@/lib/reefer-mocks';
import {
  DEFAULT_REEFER_CONFIG, PTI_PROTOCOL_V1,
  type CargoBand, type PlugStatus,
} from '@/lib/reefer-types';

type TaskKind = 'PRECOOL' | 'PTI' | 'TEMP';

const TASK_LABEL: Record<TaskKind, string> = {
  PRECOOL: 'Pre-Cool',
  PTI:     'PTI',
  TEMP:    'Temperature Reading',
};

const TASK_HINT: Record<TaskKind, string> = {
  PRECOOL: 'Cool an empty reefer ahead of stuffing. Auto-creates from bookings; use this for manual one-off requests.',
  PTI:     'Pre-Trip Inspection — 12-step generic checklist v1. Required before export for most liners.',
  TEMP:    'Log a manual temperature reading. Use when off-cadence (e.g. customer-requested check, defrost cycle).',
};

const ISO_CONTAINER_RE = /^[A-Z]{4}\d{7}$/i;

const CARGO_BAND_OPTS: { value: CargoBand; label: string; tolerance: number }[] = [
  { value: 'PHARMA',       label: 'Pharma — ±0.5°C', tolerance: 0.5 },
  { value: 'FOOD',         label: 'Food — ±2°C',     tolerance: 2.0 },
  { value: 'NON_CRITICAL', label: 'Non-critical — ±5°C', tolerance: 5.0 },
];

export default function NewReeferTaskPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [kind, setKind] = useState<TaskKind>('PRECOOL');
  const [containerInput, setContainerInput] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);

  // Container suggestions from yard roster.
  const suggestions = useMemo(() => {
    const q = containerInput.trim().toUpperCase();
    if (!q) return [];
    return REEFER_ROSTER
      .filter(r => r.containerNo.toUpperCase().includes(q))
      .slice(0, 6);
  }, [containerInput]);

  const matchedRoster = REEFER_ROSTER.find(
    r => r.containerNo.toUpperCase() === containerInput.trim().toUpperCase()
  );

  const containerValid = ISO_CONTAINER_RE.test(containerInput.trim());

  /* ── Workflow-specific state ───────────────────────────────────────── */

  // Pre-Cool
  const [pcBooking, setPcBooking] = useState('');
  const [pcTargetTemp, setPcTargetTemp] = useState('-18');
  const [pcCargoBand, setPcCargoBand] = useState<CargoBand>('FOOD');
  const [pcPlug, setPcPlug] = useState('');
  const [pcTechnician, setPcTechnician] = useState('');
  const [pcStartNow, setPcStartNow] = useState(true);
  const [pcRemarks, setPcRemarks] = useState('');

  // PTI
  const [ptiTechnician, setPtiTechnician] = useState('');
  const [ptiStartNow, setPtiStartNow] = useState(true);
  const [ptiNotes, setPtiNotes] = useState('');

  // Temp reading
  const [tempSetPoint, setTempSetPoint] = useState('');
  const [tempSupply, setTempSupply] = useState('');
  const [tempReturn, setTempReturn] = useState('');
  const [tempHumidity, setTempHumidity] = useState('');
  const [tempPlugStatus, setTempPlugStatus] = useState<PlugStatus>('PLUGGED');
  const [tempTechnician, setTempTechnician] = useState('Somchai K.');
  const [tempRemarks, setTempRemarks] = useState('');

  /* ── When container picks up from suggestion, seed defaults ───────── */

  const selectContainer = (containerNo: string) => {
    setContainerInput(containerNo);
    setShowSuggest(false);
    const match = REEFER_ROSTER.find(r => r.containerNo === containerNo);
    if (!match) return;
    if (match.bookingNo) setPcBooking(match.bookingNo);
    if (match.cargoBand) setPcCargoBand(match.cargoBand);
    if (match.plug) setPcPlug(match.plug);
    if (match.setPointC !== null) setTempSetPoint(String(match.setPointC));
    setTempPlugStatus(match.plugStatus);
    if (match.lastHumidityPct !== null) setTempHumidity(String(match.lastHumidityPct));
  };

  /* ── Submit ─────────────────────────────────────────────────────────── */

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!containerValid) {
      toast({ variant: 'danger', title: 'Invalid container number',
              message: 'Expected format: 4 letters + 7 digits (e.g. MAEU1234567)' });
      return;
    }

    if (kind === 'PRECOOL') {
      if (!pcBooking.trim()) {
        toast({ variant: 'danger', title: 'Booking required',
                message: 'Pre-cool tasks must reference a booking' });
        return;
      }
      toast({
        variant: 'success',
        title: 'Pre-cool task created',
        message: `${containerInput.toUpperCase()} · target ${pcTargetTemp}°C · ${pcStartNow ? 'started now' : 'queued'}`,
      });
    } else if (kind === 'PTI') {
      toast({
        variant: 'success',
        title: 'PTI task created',
        message: `${containerInput.toUpperCase()} · protocol v1 · ${ptiStartNow ? `started — ${ptiTechnician || 'unassigned'}` : 'queued'}`,
      });
    } else {
      if (!tempSetPoint || !tempSupply || !tempReturn) {
        toast({ variant: 'danger', title: 'Missing temperatures',
                message: 'Set-point, supply, and return are all required' });
        return;
      }
      const sp = Number(tempSetPoint);
      const sup = Number(tempSupply);
      const band = matchedRoster?.cargoBand ?? 'NON_CRITICAL';
      const tol = DEFAULT_REEFER_CONFIG.bandToleranceC[band];
      const inBand = Math.abs(sup - sp) <= tol;
      toast({
        variant: inBand ? 'success' : 'danger',
        title: inBand ? 'Reading logged' : 'Reading logged — DEVIATION',
        message: inBand
          ? `${containerInput.toUpperCase()} · within ${band.toLowerCase()} band`
          : `${containerInput.toUpperCase()} · ${Math.abs(sup - sp).toFixed(1)}°C off (±${tol}°C ${band.toLowerCase()})`,
      });
    }

    router.push('/gate/reefer-ops');
  };

  /* ── Render ─────────────────────────────────────────────────────────── */

  return (
    <div className="gecko-page-container">
      {/* Header */}
      <div className="gecko-reefer-header">
        <div className="gecko-reefer-header-left">
          <Link href="/gate/reefer-ops" className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm" aria-label="Back">
            <Icon name="arrowLeft" size={16} />
          </Link>
          <div className="gecko-reefer-header-icon">
            <Icon name="plus" size={20} />
          </div>
          <div>
            <h1 className="gecko-reefer-header-title">New Reefer Task</h1>
            <p className="gecko-reefer-header-sub">
              Ad-hoc pre-cool, PTI, or temperature reading for any container in the yard
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="gecko-reefer-new-form">
        {/* Task type segmented */}
        <div className="gecko-reefer-new-card">
          <div className="gecko-section-header-title">Task type</div>
          <div className="gecko-reefer-task-picker" role="radiogroup" aria-label="Task type">
            {(['PRECOOL', 'PTI', 'TEMP'] as const).map(k => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={`gecko-reefer-task-pick${kind === k ? ' gecko-reefer-task-pick-active' : ''}`}
              >
                <Icon
                  name={k === 'PRECOOL' ? 'thermometer' : k === 'PTI' ? 'shieldCheck' : 'activity'}
                  size={18}
                />
                <div className="gecko-reefer-task-pick-text">
                  <div className="gecko-reefer-task-pick-label">{TASK_LABEL[k]}</div>
                  <div className="gecko-reefer-task-pick-hint">{TASK_HINT[k]}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Container picker */}
        <div className="gecko-reefer-new-card">
          <div className="gecko-section-header-title">Container</div>
          <div className="gecko-reefer-container-picker">
            <label className="gecko-form-row gecko-form-row-full">
              <span>Container number</span>
              <div className="gecko-reefer-typeahead">
                <input
                  type="text"
                  className="gecko-input"
                  placeholder="ABCU1234567 — type to search yard reefers or enter any container"
                  value={containerInput}
                  onChange={e => {
                    setContainerInput(e.target.value.toUpperCase());
                    setShowSuggest(true);
                  }}
                  onFocus={() => setShowSuggest(true)}
                  onBlur={() => setTimeout(() => setShowSuggest(false), 200)}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                />
                {showSuggest && suggestions.length > 0 && (
                  <div className="gecko-reefer-suggest" role="listbox">
                    {suggestions.map(s => (
                      <button
                        key={s.containerNo}
                        type="button"
                        className="gecko-reefer-suggest-row"
                        onMouseDown={(e) => { e.preventDefault(); selectContainer(s.containerNo); }}
                        role="option"
                        aria-selected="false"
                      >
                        <strong className="gecko-mono">{s.containerNo}</strong>
                        <span className="gecko-reefer-suggest-meta">
                          {s.isoType} · {s.liner} · {s.block} {s.position}
                          {s.alarm && <span className="gecko-badge gecko-badge-error" style={{ marginLeft: 6 }}>alarm</span>}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </label>

            {matchedRoster ? (
              <div className="gecko-reefer-matched-card">
                <Icon name="checkCircle" size={14} className="gecko-reefer-matched-icon" />
                <div className="gecko-reefer-matched-text">
                  <strong>{matchedRoster.containerNo}</strong> · {matchedRoster.isoType} · {matchedRoster.liner}
                  {' · '}
                  <span className="gecko-mono">{matchedRoster.block} {matchedRoster.position}</span>
                  {matchedRoster.plug && <> · Plug <span className="gecko-mono">{matchedRoster.plug}</span></>}
                  {matchedRoster.cargoBand && <> · {matchedRoster.cargoBand.toLowerCase()} band</>}
                </div>
              </div>
            ) : containerInput.length > 0 && containerValid ? (
              <div className="gecko-reefer-matched-card gecko-reefer-matched-info">
                <Icon name="info" size={14} className="gecko-reefer-matched-icon" />
                <div className="gecko-reefer-matched-text">
                  Container <strong>{containerInput.trim()}</strong> not in current yard reefer roster.
                  Task will be created and the container registered when it gates in.
                </div>
              </div>
            ) : containerInput.length > 0 && !containerValid ? (
              <div className="gecko-reefer-matched-card gecko-reefer-matched-warn">
                <Icon name="alertCircle" size={14} className="gecko-reefer-matched-icon" />
                <div className="gecko-reefer-matched-text">
                  Invalid format — expected 4 letters + 7 digits (e.g. <span className="gecko-mono">MAEU1234567</span>)
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Workflow-specific fields */}
        {kind === 'PRECOOL' && (
          <div className="gecko-reefer-new-card">
            <div className="gecko-section-header-title">Pre-cool details</div>
            <div className="gecko-reefer-form-grid">
              <label className="gecko-form-row">
                <span>Booking #</span>
                <input
                  type="text"
                  className="gecko-input gecko-input-sm"
                  placeholder="EGLV…"
                  value={pcBooking}
                  onChange={e => setPcBooking(e.target.value)}
                  required
                />
              </label>
              <label className="gecko-form-row">
                <span>Cargo band</span>
                <select
                  className="gecko-input gecko-input-sm"
                  value={pcCargoBand}
                  onChange={e => setPcCargoBand(e.target.value as CargoBand)}
                >
                  {CARGO_BAND_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="gecko-form-row">
                <span>Target temp (°C)</span>
                <input
                  type="number" step="0.1"
                  className="gecko-input gecko-input-sm"
                  value={pcTargetTemp}
                  onChange={e => setPcTargetTemp(e.target.value)}
                  required
                />
              </label>
              <label className="gecko-form-row">
                <span>Plug</span>
                <input
                  type="text"
                  className="gecko-input gecko-input-sm"
                  placeholder="e.g. C1-12"
                  value={pcPlug}
                  onChange={e => setPcPlug(e.target.value.toUpperCase())}
                />
              </label>
              <label className="gecko-form-row">
                <span>Technician</span>
                <input
                  type="text"
                  className="gecko-input gecko-input-sm"
                  placeholder="Optional if queueing"
                  value={pcTechnician}
                  onChange={e => setPcTechnician(e.target.value)}
                />
              </label>
              <label className="gecko-form-row">
                <span>Start now</span>
                <label className="gecko-reefer-inline-check">
                  <input type="checkbox" checked={pcStartNow} onChange={e => setPcStartNow(e.target.checked)} />
                  Begin cool-down immediately
                </label>
              </label>
              <label className="gecko-form-row gecko-form-row-full">
                <span>Remarks</span>
                <input
                  type="text"
                  className="gecko-input gecko-input-sm"
                  placeholder="Optional — special handling, customer instruction, etc."
                  value={pcRemarks}
                  onChange={e => setPcRemarks(e.target.value)}
                />
              </label>
            </div>
            <div className="gecko-reefer-eta-card">
              <Icon name="clock" size={13} />
              <span>
                ETA to target: <strong>~{DEFAULT_REEFER_CONFIG.preCoolTargetHours} hours</strong>{' '}
                from start (typical for {pcCargoBand.toLowerCase()} band reefers, ambient to {pcTargetTemp}°C)
              </span>
            </div>
          </div>
        )}

        {kind === 'PTI' && (
          <div className="gecko-reefer-new-card">
            <div className="gecko-section-header-title">PTI details</div>
            <div className="gecko-reefer-form-grid">
              <label className="gecko-form-row">
                <span>Protocol</span>
                <input
                  type="text" readOnly
                  className="gecko-input gecko-input-sm"
                  value="Generic v1 (12 steps)"
                  style={{ background: 'var(--gecko-bg-subtle)', color: 'var(--gecko-text-secondary)' }}
                />
              </label>
              <label className="gecko-form-row">
                <span>Technician</span>
                <input
                  type="text"
                  className="gecko-input gecko-input-sm"
                  placeholder="Optional if queueing"
                  value={ptiTechnician}
                  onChange={e => setPtiTechnician(e.target.value)}
                />
              </label>
              <label className="gecko-form-row">
                <span>Start now</span>
                <label className="gecko-reefer-inline-check">
                  <input type="checkbox" checked={ptiStartNow} onChange={e => setPtiStartNow(e.target.checked)} />
                  Begin inspection immediately
                </label>
              </label>
              <label className="gecko-form-row gecko-form-row-full">
                <span>Notes</span>
                <input
                  type="text"
                  className="gecko-input gecko-input-sm"
                  placeholder="Optional — reason for ad-hoc PTI, line instruction, etc."
                  value={ptiNotes}
                  onChange={e => setPtiNotes(e.target.value)}
                />
              </label>
            </div>
            <div className="gecko-reefer-eta-card">
              <Icon name="info" size={13} />
              <span>
                Inspection covers {PTI_PROTOCOL_V1.length} steps. Typical duration <strong>~90 minutes</strong>.
                Per-liner protocols (Maersk / MSC / CMA) available in Phase 2.
              </span>
            </div>
          </div>
        )}

        {kind === 'TEMP' && (
          <div className="gecko-reefer-new-card">
            <div className="gecko-section-header-title">Temperature reading</div>
            <div className="gecko-reefer-form-grid">
              <label className="gecko-form-row">
                <span>Set-point (°C)</span>
                <input
                  type="number" step="0.1" required
                  className="gecko-input gecko-input-sm"
                  value={tempSetPoint}
                  onChange={e => setTempSetPoint(e.target.value)}
                />
              </label>
              <label className="gecko-form-row">
                <span>Supply air (°C)</span>
                <input
                  type="number" step="0.1" required
                  className="gecko-input gecko-input-sm"
                  value={tempSupply}
                  onChange={e => setTempSupply(e.target.value)}
                />
              </label>
              <label className="gecko-form-row">
                <span>Return air (°C)</span>
                <input
                  type="number" step="0.1" required
                  className="gecko-input gecko-input-sm"
                  value={tempReturn}
                  onChange={e => setTempReturn(e.target.value)}
                />
              </label>
              <label className="gecko-form-row">
                <span>Humidity (%RH)</span>
                <input
                  type="number" min="0" max="100"
                  className="gecko-input gecko-input-sm"
                  value={tempHumidity}
                  onChange={e => setTempHumidity(e.target.value)}
                />
              </label>
              <label className="gecko-form-row">
                <span>Plug status</span>
                <select
                  className="gecko-input gecko-input-sm"
                  value={tempPlugStatus}
                  onChange={e => setTempPlugStatus(e.target.value as PlugStatus)}
                >
                  <option value="PLUGGED">Plugged</option>
                  <option value="UNPLUGGED">Unplugged</option>
                  <option value="FAULT">Fault</option>
                </select>
              </label>
              <label className="gecko-form-row">
                <span>Technician</span>
                <input
                  type="text"
                  className="gecko-input gecko-input-sm"
                  value={tempTechnician}
                  onChange={e => setTempTechnician(e.target.value)}
                />
              </label>
              <label className="gecko-form-row gecko-form-row-full">
                <span>Remarks</span>
                <input
                  type="text"
                  className="gecko-input gecko-input-sm"
                  placeholder="Optional — observation, condition at check"
                  value={tempRemarks}
                  onChange={e => setTempRemarks(e.target.value)}
                />
              </label>
            </div>
            {tempSetPoint && tempSupply && (() => {
              const sp = Number(tempSetPoint);
              const sup = Number(tempSupply);
              const band = matchedRoster?.cargoBand ?? 'NON_CRITICAL';
              const tol = DEFAULT_REEFER_CONFIG.bandToleranceC[band];
              const dev = Math.abs(sup - sp);
              const inBand = dev <= tol;
              return (
                <div className={`gecko-reefer-eta-card ${inBand ? '' : 'gecko-reefer-eta-card-warn'}`}>
                  <Icon name={inBand ? 'checkCircle' : 'alertCircle'} size={13} />
                  <span>
                    Deviation: <strong>{dev.toFixed(1)}°C</strong>
                    {' '}({inBand ? 'within' : 'outside'} {band.toLowerCase()} band ±{tol}°C).
                    {!inBand && ' DEVIATION alarm will fire on save.'}
                  </span>
                </div>
              );
            })()}
          </div>
        )}

        {/* Footer */}
        <div className="gecko-reefer-new-footer">
          <Link href="/gate/reefer-ops" className="gecko-btn gecko-btn-ghost">
            Cancel
          </Link>
          <button type="submit" className="gecko-btn gecko-btn-primary" disabled={!containerValid}>
            Create {TASK_LABEL[kind]}
          </button>
        </div>
      </form>
    </div>
  );
}
