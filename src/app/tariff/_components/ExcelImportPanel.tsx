"use client";
import React, { useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/problem';
import {
  cancelImport, confirmImport, downloadTariffTemplate, isImportNote, uploadTariffWorkbook,
  type ImportPreview, type ImportRowView,
} from '@/lib/api/revenue';

/**
 * The server's Excel round-trip for ONE draft tariff
 * (Gecko.Revenue/Endpoints/Imports/ImportEndpoints.cs):
 *
 *   1. download the template — it carries this tariff's current rates and a
 *      token tying the file to this draft;
 *   2. upload it back — parsed and validated as a whole rate set, previewed,
 *      NOTHING applied (the preview is durable: confirm tomorrow if you like);
 *   3. confirm (replaces the draft's rate table) or cancel.
 *
 * Surcharge conditions are not edited in Excel; a line that keeps its RateKey
 * keeps them.
 */
export function ExcelImportPanel({ scheduleId, scheduleNo, versionNo, editable, onApplied }: {
  scheduleId: string;
  scheduleNo: string;
  versionNo: number;
  editable: boolean;
  onApplied: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<'download' | 'upload' | 'confirm' | 'cancel' | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const fail = (e: unknown) => {
    const err = e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.');
    setError(err.forField('file') ?? err.message);
  };

  async function download() {
    setBusy('download'); setError(null);
    try {
      await downloadTariffTemplate(scheduleId, `${scheduleNo.replace(/\//g, '-')}-v${versionNo}.xlsx`);
    } catch (e) { fail(e); } finally { setBusy(null); }
  }

  async function upload(f: File) {
    setBusy('upload'); setError(null); setPreview(null);
    try {
      setPreview(await uploadTariffWorkbook(scheduleId, f));
    } catch (e) { fail(e); } finally {
      setBusy(null);
      if (file.current) file.current.value = '';
    }
  }

  async function decide(which: 'confirm' | 'cancel') {
    if (!preview) return;
    setBusy(which); setError(null);
    try {
      const result = which === 'confirm' ? await confirmImport(preview.importBatchId) : await cancelImport(preview.importBatchId);
      setPreview(result);
      if (which === 'confirm') {
        toast({ variant: 'success', title: 'Workbook applied', message: `${result.rowsInsert} added · ${result.rowsUpdate} changed · ${result.rowsDelete} removed` });
        onApplied();
      }
    } catch (e) { fail(e); } finally { setBusy(null); }
  }

  // A PRICE_CHANGE note is not an issue: an UPDATE row explaining "555 → 600"
  // is the file working, and it must not survive this filter.
  const rows = preview?.rows.filter(r =>
    !onlyProblems || r.issues.some(i => !isImportNote(i)) || r.status !== 'OK') ?? [];
  const canConfirm = preview?.status === 'VALIDATED' && preview.rowsError === 0;

  return (
    <div className="gecko-table-card">
      <div className="gecko-row" style={{ padding: '14px 18px', borderBottom: '1px solid var(--gecko-border)', gap: 10 }}>
        <Icon name="fileText" size={15} />
        <div className="gecko-flex-1">
          <div className="gecko-section-header-title">Load rates from Excel</div>
          <div className="gecko-section-header-subtitle">
            Download this draft as a workbook, edit or paste the customer&apos;s rates, upload it back, check the preview, then apply.
            Tiers go in one cell: 1-7:160; 8-14:275; 15+:390.
            {' '}<strong>This draft&apos;s workbook is the whole rate set</strong> — a line deleted from it removes that rate.
            The blank template from the register only adds and re-prices: it never removes a rate.
          </div>
        </div>
        <button className="gecko-btn gecko-btn-outline gecko-btn-sm" disabled={busy !== null} onClick={download}>
          <Icon name="download" size={14} /> {busy === 'download' ? 'Preparing…' : 'Download template'}
        </button>
        <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={busy !== null || !editable} onClick={() => file.current?.click()}
          title={editable ? undefined : 'Only a DRAFT tariff takes an upload'}>
          <Icon name="upload" size={14} /> {busy === 'upload' ? 'Checking…' : 'Upload workbook'}
        </button>
        <input ref={file} type="file" hidden
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
      </div>

      <div className="gecko-stack" style={{ padding: 18 }}>
        {!editable && (
          <div className="gecko-alert gecko-alert-info gecko-row" style={{ gap: 10 }}>
            <Icon name="info" size={16} /><span>This version is not a DRAFT. You can download its rates; to change them start a new version.</span>
          </div>
        )}
        {error && (
          <div role="alert" className="gecko-alert gecko-alert-error gecko-row" style={{ gap: 10 }}>
            <Icon name="alertCircle" size={16} /><span>{error}</span>
          </div>
        )}
        {!preview && !error && (
          <div className="gecko-cell-meta">No upload yet. The template always reflects the draft as it is now — download a fresh one after any change.</div>
        )}

        {preview && (
          <>
            <div className="gecko-row gecko-row-wrap" style={{ gap: 8 }}>
              <span className="gecko-mono-strong">{preview.fileName}</span>
              <span className={`gecko-pill gecko-pill-${preview.status === 'APPLIED' ? 'success' : preview.status === 'CANCELLED' ? 'neutral' : preview.rowsError > 0 ? 'warning' : 'info'}`}>{preview.status}</span>
              <span className="gecko-cell-meta">{preview.rowsTotal} line(s) read</span>
            </div>
            <div className="gecko-grid-4" style={{ gap: 10 }}>
              <Count label="New" value={preview.rowsInsert} tone="success" />
              <Count label="Changed" value={preview.rowsUpdate} tone="info" />
              <Count label="Removed" value={preview.rowsDelete} tone="warning" />
              <Count label="Unchanged" value={preview.rowsUnchanged} tone="neutral" />
            </div>
            <div className="gecko-row gecko-row-wrap" style={{ gap: 12 }}>
              <span className="gecko-cell-meta">OK {preview.rowsOk}</span>
              <span className="gecko-cell-meta">Warnings {preview.rowsWarning}</span>
              <span className="gecko-cell-meta" style={{ color: preview.rowsError > 0 ? 'var(--gecko-error-600)' : undefined }}>Errors {preview.rowsError}</span>
              {preview.scheduleChangedSinceExport && (
                <span className="gecko-pill gecko-pill-warning">the draft changed after this template was downloaded</span>
              )}
              <label className="gecko-row gecko-cell-meta" style={{ gap: 6, marginLeft: 'auto' }}>
                <input type="checkbox" className="gecko-checkbox" checked={onlyProblems} onChange={e => setOnlyProblems(e.target.checked)} />
                Only lines with issues
              </label>
            </div>
            {preview.failureMessage && (
              <div role="alert" className="gecko-alert gecko-alert-error"><span>{preview.failureMessage}</span></div>
            )}

            <table className="gecko-table gecko-table-compact">
              <thead>
                <tr><th>Sheet · row</th><th>Action</th><th>Status</th><th>Notes &amp; issues</th></tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={4} className="gecko-cell-meta">Nothing to show.</td></tr>}
                {rows.map(r => <PreviewRow key={`${r.sheet}-${r.rowNo}`} row={r} />)}
              </tbody>
            </table>

            {preview.status === 'VALIDATED' && (
              <div className="gecko-row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                {preview.rowsError > 0 && <span className="gecko-cell-meta gecko-flex-1">Fix the lines with errors in the workbook and upload it again.</span>}
                <button className="gecko-btn gecko-btn-outline gecko-btn-sm" disabled={busy !== null} onClick={() => decide('cancel')}>
                  <Icon name="x" size={14} /> {busy === 'cancel' ? 'Cancelling…' : 'Cancel upload'}
                </button>
                <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={busy !== null || !canConfirm} onClick={() => decide('confirm')}>
                  <Icon name="check" size={14} /> {busy === 'confirm' ? 'Applying…' : 'Apply to draft'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="gecko-kpi-tile">
      <div className="gecko-kpi-tile-value">{value}</div>
      <div className="gecko-kpi-tile-label"><span className={`gecko-pill gecko-pill-${tone}`}>{label}</span></div>
    </div>
  );
}

const ACTION_TONE: Record<string, string> = { INSERT: 'success', UPDATE: 'info', DELETE: 'warning', UNCHANGED: 'neutral' };

function PreviewRow({ row }: { row: ImportRowView }) {
  const notes = row.issues.filter(isImportNote);
  const problems = row.issues.filter(i => !isImportNote(i));
  return (
    <tr>
      <td className="gecko-text-mono">{row.sheet === '(removed)' ? 'removed' : `${row.sheet} · ${row.rowNo}`}</td>
      <td>{row.action ? <span className={`gecko-pill gecko-pill-${ACTION_TONE[row.action] ?? 'neutral'}`}>{row.action}</span> : <span className="gecko-cell-meta">—</span>}</td>
      <td><span className={`gecko-pill gecko-pill-${row.status === 'ERROR' ? 'warning' : row.status === 'WARNING' ? 'info' : 'success'}`}>{row.status}</span></td>
      <td>
        {/* Two different things share this column. A NOTE is the row explaining
            itself — the new price, or that a line was copied — and reads quietly.
            A PROBLEM is something the clerk has to go back to the workbook for.
            Mixing them taught people to ignore the column. */}
        {notes.length > 0 && (
          <div className="gecko-stack" style={{ gap: 2 }}>
            {notes.map((i, n) => (
              <div key={n} className="gecko-cell-meta gecko-mono" style={{ marginTop: 0 }}>
                {i.column && <span>{i.column} </span>}{i.message}
              </div>
            ))}
          </div>
        )}
        {problems.length > 0 && (
          <ul style={{ margin: notes.length > 0 ? '4px 0 0' : 0, paddingLeft: 16 }}>
            {problems.map((i, n) => (
              <li key={n} style={{ color: i.severity === 'ERROR' ? 'var(--gecko-error-600)' : undefined }}>
                {i.column && <strong className="gecko-text-mono">{i.column}: </strong>}{i.message}
              </li>
            ))}
          </ul>
        )}
        {notes.length === 0 && problems.length === 0 && <span className="gecko-cell-meta">—</span>}
      </td>
    </tr>
  );
}
