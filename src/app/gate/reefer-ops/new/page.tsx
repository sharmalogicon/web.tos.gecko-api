"use client";

/**
 * PLUG IN A REEFER — POST /api/tos/reefer/sessions.
 *
 * Offers the reefers standing in the yard with nothing plugged in
 * (GET /api/tos/reefer/candidates); any container number can also be typed, and
 * the API says why it cannot be plugged in (not in the yard, not a reefer,
 * already plugged in). The set point is prefilled from the booking line, else
 * from what the gate read off the display.
 *
 * The candidates need tos.reefer.manage: a 403 there means this user cannot plug in.
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DateField } from '@/components/ui/DateField';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { useApi, useApiList, type Paged } from '@/lib/api/use-api';
import { ApiError } from '@/lib/api/problem';
import { useSession } from '@/lib/auth/session';
import { formatContainerNo, formatDateTime } from '@/lib/api/tos';
import {
  REEFER_PERMISSIONS, candidateRows, candidatesPath, fromLocalInput, parseSetPoint, plugIn, setPointLabel,
  type ReeferCandidate,
} from '@/lib/api/reefer';

interface Branch { branchId: string; branchCode: string; displayName: string }

const ISO_CONTAINER_RE = /^[A-Z]{4}\d{7}$/;

function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function PlugInReeferPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { branchesFor } = useSession();

  const [branchId, setBranchId] = useState('');
  const [containerInput, setContainerInput] = useState('');
  const [picked, setPicked] = useState<ReeferCandidate | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const [pluggedInAt, setPluggedInAt] = useState('');
  const [plugPoint, setPlugPoint] = useState('');
  const [setPoint, setSetPoint] = useState('');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiError | null>(null);

  const { data: branchRows } = useApiList<Branch>('/api/branches?pageSize=100');
  const mine = new Set(branchesFor(REEFER_PERMISSIONS.manage));
  const depots = (branchRows ?? []).filter(b => mine.size === 0 || mine.has(b.branchId));

  const search = useDebounced(picked ? '' : containerInput);
  const candidates = useApi<Paged<ReeferCandidate> | ReeferCandidate[]>(candidatesPath(branchId, search));
  const rows = candidateRows(candidates.data) ?? [];
  const forbidden = candidates.error?.status === 403;

  const box = containerInput.trim().toUpperCase();
  const containerValid = ISO_CONTAINER_RE.test(box);
  const setPointC = parseSetPoint(setPoint);
  const badSetPoint = Number.isNaN(setPointC);

  const choose = (c: ReeferCandidate) => {
    setPicked(c);
    setContainerInput(c.containerNo);
    setShowSuggest(false);
    setSetPoint(c.suggestedSetPointC === null ? '' : String(c.suggestedSetPointC));
    setFailure(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!containerValid || badSetPoint) return;
    setBusy(true);
    setFailure(null);
    try {
      const s = await plugIn({
        containerNo: box,
        pluggedInAt: fromLocalInput(pluggedInAt),
        plugPointCode: plugPoint.trim() || null,
        setPointC,
        remarks: remarks.trim() || null,
      });
      toast({
        variant: 'success', title: `${formatContainerNo(box)} plugged in`,
        message: `${s?.branchCode ?? ''} ${s?.plugPointCode ? `at ${s.plugPointCode} ` : ''}· ${formatDateTime(s?.pluggedInAt ?? new Date().toISOString())}`.trim(),
      });
      router.push('/gate/reefer-ops');
    } catch (err: unknown) {
      const f = err instanceof ApiError ? err : new ApiError(0, 'Could not reach the Gecko API.');
      setFailure(f);
      if (f.status === 409) { setPicked(null); candidates.reload(); }
    } finally {
      setBusy(false);
    }
  };

  const fieldKeys = ['containerNo', 'pluggedInAt', 'plugPointCode', 'setPointC', 'remarks'];
  const general = failure && !fieldKeys.some(k => failure.forField(k)) ? failure : null;
  const fieldError = (k: string) => failure?.forField(k)
    ? <div className="gecko-field-error">{failure.forField(k)}</div> : null;

  return (
    <div className="gecko-page-container">
      {/* Header */}
      <div className="gecko-reefer-header">
        <div className="gecko-reefer-header-left">
          <Link href="/gate/reefer-ops" className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm" aria-label="Back">
            <Icon name="arrowLeft" size={16} />
          </Link>
          <div className="gecko-reefer-header-icon">
            <Icon name="zap" size={20} />
          </div>
          <div>
            <h1 className="gecko-reefer-header-title">Plug in a reefer</h1>
            <p className="gecko-reefer-header-sub">
              Starts the clock its power is charged on. It stops when the box is plugged out or goes out of the gate.
            </p>
          </div>
        </div>
      </div>

      {forbidden ? (
        <div className="gecko-alert gecko-alert-warning">
          <Icon name="alertCircle" size={18} />
          <div>
            <div style={{ fontWeight: 600 }}>You cannot plug reefers in</div>
            <div>Plugging in needs {REEFER_PERMISSIONS.manage} at the depot the box stands in.</div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="gecko-reefer-new-form">
          {general && (
            <div className={`gecko-alert gecko-alert-${general.status === 409 ? 'warning' : 'error'}`}>
              <Icon name="alertCircle" size={18} />
              <div>
                <div style={{ fontWeight: 600 }}>{general.title}</div>
                {general.explanation && <div>{general.explanation}</div>}
              </div>
            </div>
          )}

          {/* Container picker */}
          <div className="gecko-reefer-new-card">
            <div className="gecko-section-header-title">Container</div>
            <div className="gecko-reefer-container-picker">
              <div className="gecko-reefer-form-grid">
                <label className="gecko-form-row">
                  <span>Depot</span>
                  <select className="gecko-input gecko-input-sm" value={branchId} onChange={e => { setBranchId(e.target.value); setPicked(null); }}>
                    <option value="">All my depots</option>
                    {depots.map(b => <option key={b.branchId} value={b.branchId}>{b.branchCode} · {b.displayName}</option>)}
                  </select>
                </label>
              </div>
              <label className="gecko-form-row gecko-form-row-full">
                <span>Container number *</span>
                <div className="gecko-reefer-typeahead">
                  <input
                    type="text"
                    className="gecko-input"
                    placeholder="ABCU1234567 — type to search reefers in the yard not plugged in"
                    value={containerInput}
                    maxLength={11}
                    onChange={e => {
                      setContainerInput(e.target.value.toUpperCase().replace(/\s/g, ''));
                      setPicked(null);
                      setShowSuggest(true);
                    }}
                    onFocus={() => setShowSuggest(true)}
                    onBlur={() => setTimeout(() => setShowSuggest(false), 200)}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    autoFocus
                  />
                  {showSuggest && !picked && rows.length > 0 && (
                    <div className="gecko-reefer-suggest" role="listbox">
                      {rows.slice(0, 8).map(c => (
                        <button
                          key={c.containerVisitId}
                          type="button"
                          className="gecko-reefer-suggest-row"
                          onMouseDown={(e) => { e.preventDefault(); choose(c); }}
                          role="option"
                          aria-selected="false"
                        >
                          <strong className="gecko-mono">{formatContainerNo(c.containerNo)}</strong>
                          <span className="gecko-reefer-suggest-meta">
                            {c.equipmentTypeCode ?? '—'} · {c.branchCode ?? '—'} · in {formatDateTime(c.gateInAt)}
                            {c.suggestedSetPointC !== null && <> · {setPointLabel(c.suggestedSetPointC)}</>}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {fieldError('containerNo')}
              </label>

              {picked ? (
                <div className="gecko-reefer-matched-card">
                  <Icon name="checkCircle" size={14} className="gecko-reefer-matched-icon" />
                  <div className="gecko-reefer-matched-text">
                    <strong>{formatContainerNo(picked.containerNo)}</strong> · {picked.equipmentTypeCode ?? '—'} · {picked.branchCode ?? '—'}
                    {' · '}gated in {formatDateTime(picked.gateInAt)}
                    {picked.suggestedSetPointC !== null && <> · set point {setPointLabel(picked.suggestedSetPointC)}</>}
                  </div>
                </div>
              ) : box.length > 0 && containerValid ? (
                <div className="gecko-reefer-matched-card gecko-reefer-matched-info">
                  <Icon name="info" size={14} className="gecko-reefer-matched-icon" />
                  <div className="gecko-reefer-matched-text">
                    <strong>{formatContainerNo(box)}</strong> is not in the list of unplugged reefers in the yard.
                    You can still try — the API will say why it cannot be plugged in.
                  </div>
                </div>
              ) : box.length > 0 ? (
                <div className="gecko-reefer-matched-card gecko-reefer-matched-warn">
                  <Icon name="alertCircle" size={14} className="gecko-reefer-matched-icon" />
                  <div className="gecko-reefer-matched-text">
                    Expected 4 letters + 7 digits (e.g. <span className="gecko-mono">MAEU1234567</span>)
                  </div>
                </div>
              ) : !candidates.loading && rows.length === 0 && !candidates.error ? (
                <div className="gecko-reefer-matched-card gecko-reefer-matched-info">
                  <Icon name="info" size={14} className="gecko-reefer-matched-icon" />
                  <div className="gecko-reefer-matched-text">Every reefer in the yard{branchId ? ' at this depot' : ''} is plugged in already.</div>
                </div>
              ) : candidates.error ? (
                <div className="gecko-reefer-matched-card gecko-reefer-matched-warn">
                  <Icon name="alertCircle" size={14} className="gecko-reefer-matched-icon" />
                  <div className="gecko-reefer-matched-text">{candidates.error.message}</div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Session details */}
          <div className="gecko-reefer-new-card">
            <div className="gecko-section-header-title">Plug-in</div>
            <div className="gecko-reefer-form-grid">
              <label className="gecko-form-row">
                <span>Plugged in at</span>
                <DateField withTime size="sm" value={pluggedInAt} onChange={setPluggedInAt} aria-label="Plugged in at" />
                <div className="gecko-cell-meta">Leave blank for now.</div>
                {fieldError('pluggedInAt')}
              </label>
              <label className="gecko-form-row">
                <span>Plug point</span>
                <input type="text" className="gecko-input gecko-input-sm" maxLength={20} placeholder="e.g. C1-12"
                       value={plugPoint} onChange={e => setPlugPoint(e.target.value.toUpperCase())} />
                {fieldError('plugPointCode')}
              </label>
              <label className="gecko-form-row">
                <span>Set point (°C)</span>
                <input type="number" step="0.1" min={-40} max={40} className="gecko-input gecko-input-sm"
                       value={setPoint} onChange={e => setSetPoint(e.target.value)} />
                {badSetPoint && <div className="gecko-field-error">Enter a number of degrees.</div>}
                {fieldError('setPointC')}
              </label>
              <label className="gecko-form-row gecko-form-row-full">
                <span>Remarks</span>
                <input type="text" className="gecko-input gecko-input-sm" maxLength={500} placeholder="Optional"
                       value={remarks} onChange={e => setRemarks(e.target.value)} />
                {fieldError('remarks')}
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="gecko-reefer-new-footer">
            <Link href="/gate/reefer-ops" className="gecko-btn gecko-btn-ghost">Cancel</Link>
            <button type="submit" className="gecko-btn gecko-btn-primary" disabled={!containerValid || badSetPoint || busy}>
              {busy ? 'Plugging in…' : 'Plug in'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
