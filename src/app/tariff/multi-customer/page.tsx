"use client";

/**
 * MANY CUSTOMERS' SPECIAL PRICES, FROM ONE WORKBOOK (owner 2026-11-12).
 *
 * KORAKIT prices thirty customers in an afternoon, not one. The per-tariff
 * Excel round-trip on /tariff/plans/[id] fills ONE draft schedule; this fills a
 * SPECIAL-<code> contract for every sheet in the file, approved and live from
 * the chosen date.
 *
 * Three steps, in order, and the screen shows them that way because the file
 * leaves the building between steps 1 and 2 — a clerk edits it in Excel,
 * possibly for days, then comes back:
 *
 *   1. download the workbook, pre-filled with what each customer pays today;
 *   2. upload it back — validated and previewed, NOTHING applied;
 *   3. confirm (all of it) or cancel.
 *
 * Confirm needs `revenue.tariff.approve` on top of `revenue.import.manage`,
 * because there is no separate approval step: confirming makes prices live.
 * The button is not shown without it rather than answering 403 after the wait.
 *
 * Bound to /api/revenue/tariffs/multi-customer/*, which is built and runs
 * locally but is NOT on Azure yet (Azure needs gecko_revenue script 56 first).
 */

import React, { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/lib/auth/session';
import { useFacility } from '@/lib/api/facility';
import { ApiError } from '@/lib/api/problem';
import { PartyPicker } from '@/components/ui/PartyPicker';
import type { PartySummary } from '@/lib/api/parties';
import {
  MAX_CUSTOMERS, MAX_FILE_BYTES, cancelMultiImport, chargeCodeOf, confirmMultiImport,
  customersAffected, downloadMultiTemplate, isConfirmable, uploadMultiWorkbook,
  type MultiPreview, type MultiSheetDetail,
} from '@/lib/api/multi-customer-tariff';

/**
 * TODAY IN THE DEPOT'S OWN DAY, not UTC.
 *
 * `effectiveFrom` must be today or later or the API answers 400. Bangkok is
 * UTC+7, so `new Date().toISOString()` before 07:00 local returns YESTERDAY —
 * every upload in the first seven hours of the working day would have been
 * refused on a date the clerk never typed.
 */
function todayLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

interface PickedCustomer { code: string; name: string }

/** Green / blue / grey / amber, as the four actions were specified. */
const ACTION_TONE: Record<string, string> = {
  NEW_CONTRACT: 'success',
  REPLACE: 'info',
  NO_CHANGE: 'neutral',
  KEPT_ALL_STANDARD: 'warning',
};

const ACTION_LABEL: Record<string, string> = {
  NEW_CONTRACT: 'New contract',
  REPLACE: 'Replace',
  NO_CHANGE: 'No change',
  KEPT_ALL_STANDARD: 'Kept all standard',
};

const STATUS_TONE: Record<string, string> = {
  OK: 'success', WARNING: 'warning', ERROR: 'danger',
};

export default function MultiCustomerTariffPage() {
  const { toast } = useToast();
  const { can } = useSession();
  const { branch } = useFacility();
  const branchId = branch?.branchId ?? '';

  const mayImport = can('revenue.import.manage');
  const mayApprove = can('revenue.tariff.approve');

  const [picked, setPicked] = useState<PickedCustomer[]>([]);
  const [effectiveOn, setEffectiveOn] = useState(todayLocal());
  const [effectiveFrom, setEffectiveFrom] = useState(todayLocal());
  const [busy, setBusy] = useState<'download' | 'upload' | 'confirm' | 'cancel' | null>(null);
  const [preview, setPreview] = useState<MultiPreview | null>(null);
  const [problem, setProblem] = useState<{ title: string; detail?: string | null } | null>(null);
  const [openSheets, setOpenSheets] = useState<Set<string>>(new Set());
  const [asking, setAsking] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const fail = (e: unknown) => {
    const err = e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.');
    setProblem({ title: err.title || err.message, detail: err.detail });
  };

  const addCustomer = (code: string | null, party?: PartySummary) => {
    if (!code) return;
    setPicked(prev => {
      if (prev.some(c => c.code === code)) return prev;
      if (prev.length >= MAX_CUSTOMERS) return prev;
      return [...prev, { code, name: party?.nameEn ?? code }];
    });
  };

  const full = picked.length >= MAX_CUSTOMERS;

  async function download() {
    setBusy('download'); setProblem(null);
    try {
      await downloadMultiTemplate(branchId, picked.map(c => c.code), effectiveOn);
    } catch (e) { fail(e); } finally { setBusy(null); }
  }

  async function upload(f: File) {
    if (f.size > MAX_FILE_BYTES) {
      setProblem({ title: 'That file is larger than 20 MB, which the API refuses.' });
      if (file.current) file.current.value = '';
      return;
    }
    setBusy('upload'); setProblem(null); setPreview(null); setOpenSheets(new Set());
    try {
      setPreview(await uploadMultiWorkbook(f, branchId, effectiveFrom));
    } catch (e) { fail(e); } finally {
      setBusy(null);
      if (file.current) file.current.value = '';
    }
  }

  async function decide(which: 'confirm' | 'cancel') {
    if (!preview) return;
    setAsking(false);
    setBusy(which); setProblem(null);
    try {
      const result = which === 'confirm'
        ? await confirmMultiImport(preview.batchId)
        : await cancelMultiImport(preview.batchId);
      setPreview(result);
      if (which === 'confirm') {
        toast({
          variant: 'success', title: 'Prices are live',
          message: `${result.customersNew} new · ${result.customersReplaced} replaced, from ${result.effectiveFrom}`,
        });
      }
    } catch (e) { fail(e); } finally { setBusy(null); }
  }

  const toggleSheet = (sheet: string) => setOpenSheets(prev => {
    const next = new Set(prev);
    if (next.has(sheet)) next.delete(sheet); else next.add(sheet);
    return next;
  });

  const applied = preview?.status === 'APPLIED';
  const settled = applied || preview?.status === 'CANCELLED';
  const confirmable = isConfirmable(preview);
  const errorCount = (preview?.sheetsError ?? 0) + (preview?.rowsError ?? 0);

  /** The date cannot be in the past; the API refuses it and so does the field. */
  const fromInPast = useMemo(() => effectiveFrom < todayLocal(), [effectiveFrom]);

  if (!mayImport) {
    return (
      <div className="gecko-stack gecko-mc-page">
        <div role="alert" className="gecko-alert gecko-alert-error gecko-row gecko-gap-2h">
          <Icon name="alertCircle" size={16} />
          <span>Uploading tariffs needs the <strong>revenue.import.manage</strong> right. Ask an administrator.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="gecko-stack gecko-stack-lg gecko-mc-page">

      <div className="gecko-stack gecko-stack-xs">
        <h1 className="gecko-page-title">Multi-customer tariff upload</h1>
        <p className="gecko-page-subtitle">
          Price many customers from one workbook — a sheet each. On confirm, every sheet becomes that
          customer&apos;s <span className="gecko-text-mono">SPECIAL-&lt;code&gt;</span> contract, live from the date you
          choose. Only the prices you changed from standard are kept; the rest keeps following the standard tariff.
        </p>
      </div>

      {problem && (
        <div role="alert" className="gecko-alert gecko-alert-error gecko-stack gecko-stack-xs">
          <div className="gecko-row gecko-gap-2h">
            <Icon name="alertCircle" size={16} />
            <strong>{problem.title}</strong>
          </div>
          {problem.detail && <span className="gecko-mc-detail">{problem.detail}</span>}
        </div>
      )}

      {/* ── STEP 1 ────────────────────────────────────────────────────────── */}
      <section className="gecko-table-card">
        <div className="gecko-mc-step-head">
          <span className="gecko-mc-step-no">1</span>
          <div className="gecko-flex-1">
            <div className="gecko-section-header-title">Download the workbook</div>
            <div className="gecko-section-header-subtitle">
              Each sheet comes pre-filled with what that customer pays today — their contract prices where they have
              them, standard where they do not. Edit the prices in Excel. To add a customer the file does not have,
              copy a sheet and pick the new customer in its yellow A1 cell.
            </div>
          </div>
        </div>

        <div className="gecko-stack gecko-mc-pad">
          <div className="gecko-mc-fields">
            <label className="gecko-field">
              <span className="gecko-label">Depot</span>
              <input className="gecko-input" readOnly disabled
                value={branch ? `${branch.branchCode} · ${branch.displayName}` : 'No depot selected'} />
              <span className="gecko-field-hint">Standard prices differ by depot. Switch depots in the header.</span>
            </label>
            <label className="gecko-field">
              <span className="gecko-label">Prices as at</span>
              <input type="date" className="gecko-input" value={effectiveOn}
                onChange={e => setEffectiveOn(e.target.value)} />
              <span className="gecko-field-hint">Which prices fill the sheets. Defaults to today.</span>
            </label>
          </div>

          <div className="gecko-field">
            <span className="gecko-label">
              Customers
              <span className="gecko-mc-count">
                {picked.length} of {MAX_CUSTOMERS}
              </span>
            </span>
            <PartyPicker role="CUSTOMER" value={null} onChange={addCustomer} disabled={full}
              placeholder={full ? `${MAX_CUSTOMERS} is the most the API takes` : 'Search a customer to add…'} />
            <span className="gecko-field-hint">
              Leave this empty to get one example sheet of standard prices with no customer picked.
            </span>
          </div>

          {picked.length > 0 && (
            <div className="gecko-mc-chips">
              {picked.map(c => (
                <span key={c.code} className="gecko-mc-chip">
                  <span className="gecko-text-mono">{c.code}</span>
                  <span className="gecko-mc-chip-name">{c.name}</span>
                  <button type="button" className="gecko-mc-chip-x" title={`Remove ${c.code}`}
                    onClick={() => setPicked(prev => prev.filter(x => x.code !== c.code))}>
                    <Icon name="x" size={12} />
                  </button>
                </span>
              ))}
              <button type="button" className="gecko-btn gecko-btn-ghost gecko-btn-sm"
                onClick={() => setPicked([])}>
                <Icon name="trash" size={13} /> Clear all
              </button>
            </div>
          )}

          <div className="gecko-row gecko-row-right">
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm"
              disabled={busy !== null || !branchId} onClick={() => void download()}
              title={branchId ? undefined : 'Choose a depot first'}>
              <Icon name="download" size={14} /> {busy === 'download' ? 'Preparing…' : 'Download workbook'}
            </button>
          </div>
        </div>
      </section>

      {/* ── STEP 2 ────────────────────────────────────────────────────────── */}
      <section className="gecko-table-card">
        <div className="gecko-mc-step-head">
          <span className="gecko-mc-step-no">2</span>
          <div className="gecko-flex-1">
            <div className="gecko-section-header-title">Upload it back</div>
            <div className="gecko-section-header-subtitle">
              Checked and shown to you first. <strong>Nothing changes until you confirm.</strong>
            </div>
          </div>
        </div>

        <div className="gecko-stack gecko-mc-pad">
          <div className="gecko-mc-fields">
            <label className="gecko-field">
              <span className="gecko-label">New prices start</span>
              <input type="date" className="gecko-input" min={todayLocal()} value={effectiveFrom}
                onChange={e => setEffectiveFrom(e.target.value)} />
              <span className={fromInPast ? 'gecko-field-error' : 'gecko-field-hint'}>
                {fromInPast
                  ? 'This date has passed. The API only accepts today or later.'
                  : 'The first day the new prices apply. Today or later.'}
              </span>
            </label>
          </div>

          <div className="gecko-row gecko-row-right">
            <button className="gecko-btn gecko-btn-primary gecko-btn-sm"
              disabled={busy !== null || !branchId || fromInPast}
              onClick={() => file.current?.click()}>
              <Icon name="upload" size={14} /> {busy === 'upload' ? 'Checking…' : 'Upload workbook'}
            </button>
            <input ref={file} type="file" hidden
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
          </div>

          {!preview && !problem && (
            <div className="gecko-cell-meta">
              No upload yet. Download a fresh workbook after any price change — it always reflects today.
            </div>
          )}
        </div>
      </section>

      {/* ── STEP 3 ────────────────────────────────────────────────────────── */}
      {preview && (
        <section className="gecko-table-card">
          <div className="gecko-mc-step-head">
            <span className="gecko-mc-step-no">3</span>
            <div className="gecko-flex-1">
              <div className="gecko-section-header-title">
                {applied ? 'Applied' : settled ? 'Cancelled' : 'Check, then confirm'}
              </div>
              <div className="gecko-section-header-subtitle">
                <span className="gecko-mono-strong">{preview.fileName}</span>
                {' · '}{preview.sheets} sheet(s){' · '}prices start {preview.effectiveFrom}
              </div>
            </div>
            <span className={`gecko-pill gecko-pill-${
              applied ? 'success' : preview.status === 'CANCELLED' ? 'neutral' : errorCount > 0 ? 'warning' : 'info'
            }`}>{preview.status}</span>
          </div>

          <div className="gecko-stack gecko-mc-pad">
            {preview.failureMessage && (
              <div role="alert" className="gecko-alert gecko-alert-error">
                <span>{preview.failureMessage}</span>
              </div>
            )}

            {/* Summary bar — the shape of the batch before any row is read. */}
            <div className="gecko-mc-summary">
              <Tally label="New contracts" value={preview.customersNew} tone="success" />
              <Tally label="Replaced" value={preview.customersReplaced} tone="info" />
              <Tally label="Unchanged" value={preview.customersUnchanged} tone="neutral" />
              <Tally label="Kept all standard" value={preview.customersKeptAllStandard} tone="warning" />
              <Tally label="Errors" value={errorCount} tone={errorCount > 0 ? 'danger' : 'neutral'} />
            </div>

            <div className="gecko-row gecko-row-wrap gecko-gap-3">
              <span className="gecko-cell-meta">Prices kept {preview.rowsKept}</span>
              <span className="gecko-cell-meta">Same as standard {preview.rowsSameAsStandard}</span>
              <span className={preview.rowsDropped > 0 ? 'gecko-mc-dropped-count' : 'gecko-cell-meta'}>
                Removed {preview.rowsDropped}
              </span>
            </div>

            {errorCount > 0 && !settled && (
              <div role="alert" className="gecko-alert gecko-alert-error gecko-row gecko-gap-2h">
                <Icon name="alertCircle" size={16} />
                <span>
                  {errorCount} problem(s) stop this batch. It is all-or-nothing — fix the workbook and upload it
                  again. Nothing has changed.
                </span>
              </div>
            )}

            <table className="gecko-table gecko-table-compact">
              <thead>
                <tr>
                  <th style={{ width: '3%' }} />
                  <th style={{ width: '18%' }}>Sheet</th>
                  <th>Customer</th>
                  <th style={{ width: '14%' }}>Action</th>
                  <th className="gecko-num" style={{ width: '10%' }}>Charges kept</th>
                  <th className="gecko-num" style={{ width: '9%' }}>Prices kept</th>
                  <th className="gecko-num" style={{ width: '10%' }}>Removed</th>
                  <th style={{ width: '10%' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.sheetsDetail.length === 0 && (
                  <tr><td colSpan={8} className="gecko-cell-meta gecko-mc-empty">This file held no customer sheets.</td></tr>
                )}
                {preview.sheetsDetail.map(s => (
                  <SheetRows key={s.sheet} s={s} open={openSheets.has(s.sheet)}
                    onToggle={() => toggleSheet(s.sheet)} applied={applied} />
                ))}
              </tbody>
            </table>

            {!settled && (
              <div className="gecko-row gecko-row-right gecko-gap-2">
                {!mayApprove && (
                  <span className="gecko-cell-meta gecko-flex-1">
                    Confirming makes prices live, which needs the <strong>revenue.tariff.approve</strong> right.
                    Someone who has it can confirm this batch.
                  </span>
                )}
                <button className="gecko-btn gecko-btn-outline gecko-btn-sm"
                  disabled={busy !== null} onClick={() => void decide('cancel')}>
                  <Icon name="x" size={14} /> {busy === 'cancel' ? 'Cancelling…' : 'Cancel upload'}
                </button>
                {mayApprove && (
                  <button className="gecko-btn gecko-btn-primary gecko-btn-sm"
                    disabled={busy !== null || !confirmable} onClick={() => setAsking(true)}>
                    <Icon name="check" size={14} /> {busy === 'confirm' ? 'Applying…' : 'Confirm'}
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {asking && preview && (
        <Modal isOpen onClose={() => setAsking(false)} size="sm" title="Make these prices live?"
          footer={
            <div className="gecko-row gecko-row-right gecko-gap-2">
              <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setAsking(false)}>Not yet</button>
              <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => void decide('confirm')}>
                <Icon name="check" size={14} /> Make them live
              </button>
            </div>
          }>
          <div className="gecko-stack">
            <p>
              Make these prices live for <strong>{customersAffected(preview)}</strong> customer(s)
              from <strong>{preview.effectiveFrom}</strong>?
            </p>
            {preview.rowsDropped > 0 && (
              <div role="alert" className="gecko-alert gecko-alert-error gecko-row gecko-gap-2h">
                <Icon name="alertTriangle" size={16} />
                <span><strong>{preview.rowsDropped}</strong> current special price(s) will be removed.</span>
              </div>
            )}
            <p className="gecko-cell-meta">
              There is no separate approval step: the contracts are approved as they are written. It is
              all-or-nothing — if any one fails, none of them change.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Tally({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="gecko-mc-tally">
      <div className="gecko-mc-tally-value">{value}</div>
      <div className="gecko-mc-tally-label"><span className={`gecko-pill gecko-pill-${tone}`}>{label}</span></div>
    </div>
  );
}

/**
 * One sheet's line, and — when opened — what the API said about it.
 *
 * The expanded half is deliberately three separate lists. An issue is about the
 * sheet, a row is about one line of it, and `dropped` is money the customer
 * stops being charged: collapsing them into one feed taught people to skim.
 */
function SheetRows({ s, open, onToggle, applied }: {
  s: MultiSheetDetail; open: boolean; onToggle: () => void; applied: boolean;
}) {
  const tone = ACTION_TONE[s.action] ?? 'neutral';
  const removes = s.action === 'REPLACE' && s.rowsDropped > 0;
  const expandable = s.issues.length > 0 || s.rows.length > 0 || s.dropped.length > 0;

  return (
    <>
      <tr className={expandable ? 'gecko-mc-row' : undefined} onClick={expandable ? onToggle : undefined}>
        <td>
          {expandable && <Icon name={open ? 'chevronDown' : 'chevronRight'} size={13} />}
        </td>
        <td className="gecko-text-mono">{s.sheet}</td>
        <td>
          <span className="gecko-cell-tight">{s.customerName ?? '—'}</span>
          <span className="gecko-cell-meta gecko-text-mono">{s.customerCode}</span>
          {s.existingScheduleNo && (
            <span className="gecko-cell-meta">
              now {s.existingScheduleNo}{s.existingVersion != null ? ` v${s.existingVersion}` : ''}
            </span>
          )}
        </td>
        <td>
          <span className={`gecko-pill gecko-pill-${tone}`}>{ACTION_LABEL[s.action] ?? s.action}</span>
          {applied && s.resultScheduleId && (
            <Link className="gecko-mc-link" href={`/tariff/plans/${s.resultScheduleId}`}
              onClick={e => e.stopPropagation()}>
              Open tariff <Icon name="chevronRight" size={12} />
            </Link>
          )}
        </td>
        <td className="gecko-num gecko-mono">{s.chargesKept}</td>
        <td className="gecko-num gecko-mono">{s.rowsKept}</td>
        <td className="gecko-num gecko-mono">
          {/* Money the customer stops being charged. It reads red because it is
              the one number on this screen that takes something away. */}
          {removes
            ? <span className="gecko-mc-dropped-count">{s.rowsDropped}</span>
            : <span className="gecko-cell-meta">{s.rowsDropped || '—'}</span>}
        </td>
        <td><span className={`gecko-pill gecko-pill-${STATUS_TONE[s.status] ?? 'neutral'}`}>{s.status}</span></td>
      </tr>

      {removes && (
        <tr className="gecko-mc-warn-row">
          <td />
          <td colSpan={7} className="gecko-mc-dropped-note">
            <Icon name="alertTriangle" size={13} />
            <span>{s.rowsDropped} current special price(s) will be removed from this customer.</span>
          </td>
        </tr>
      )}

      {open && (
        <tr className="gecko-mc-detail-row">
          <td />
          <td colSpan={7}>
            <div className="gecko-stack gecko-mc-detail-pad">

              {s.issues.length > 0 && (
                <div className="gecko-stack gecko-stack-xs">
                  <div className="gecko-mc-detail-head">About this sheet</div>
                  <ul className="gecko-mc-issues">
                    {s.issues.map((i, n) => (
                      <li key={n} className={i.severity === 'ERROR' ? 'gecko-mc-issue-error' : undefined}>
                        {i.column && <strong className="gecko-text-mono">{i.column}: </strong>}
                        {i.message}
                        <span className="gecko-cell-meta gecko-text-mono"> {i.code}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {s.rows.length > 0 && (
                <div className="gecko-stack gecko-stack-xs">
                  <div className="gecko-mc-detail-head">Lines that need a look</div>
                  <table className="gecko-table gecko-table-compact">
                    <thead>
                      <tr><th style={{ width: '12%' }}>Row</th><th style={{ width: '14%' }}>Action</th>
                        <th style={{ width: '12%' }}>Status</th><th>Problem</th></tr>
                    </thead>
                    <tbody>
                      {s.rows.map(r => (
                        <tr key={`${r.sheet}-${r.rowNo}`}>
                          <td className="gecko-text-mono">{r.rowNo}</td>
                          <td className="gecko-cell-meta">{r.action ?? '—'}</td>
                          <td><span className={`gecko-pill gecko-pill-${STATUS_TONE[r.status] ?? 'neutral'}`}>{r.status}</span></td>
                          <td>
                            <ul className="gecko-mc-issues">
                              {r.issues.map((i, n) => (
                                <li key={n} className={i.severity === 'ERROR' ? 'gecko-mc-issue-error' : undefined}>
                                  {i.column && <strong className="gecko-text-mono">{i.column}: </strong>}
                                  {i.message}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {s.dropped.length > 0 && (
                <div className="gecko-stack gecko-stack-xs">
                  <div className="gecko-mc-detail-head gecko-mc-dropped-count">
                    Special prices this removes
                  </div>
                  <table className="gecko-table gecko-table-compact">
                    <thead>
                      <tr><th style={{ width: '20%' }}>Charge</th><th>Match</th>
                        <th className="gecko-num" style={{ width: '18%' }}>Price now</th></tr>
                    </thead>
                    <tbody>
                      {s.dropped.map((d, n) => (
                        <tr key={n}>
                          <td className="gecko-mono-strong">{chargeCodeOf(d.matchKey)}</td>
                          <td className="gecko-cell-meta gecko-text-mono">{d.matchKey}</td>
                          <td className="gecko-num gecko-mono">{d.price}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          </td>
        </tr>
      )}
    </>
  );
}
