"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useApi } from '@/lib/api/use-api';
import { useSession } from '@/lib/auth/session';
import { ApiError } from '@/lib/api/problem';
import {
  chargeCodePath, deleteChargeCode, replaceVariants, updateChargeCode, useCommercialVocabulary,
  type ChargeCodeDetail,
} from '@/lib/api/charge-codes';
import { ChargeCodeForm, chargeErrors, formFromCharge, requestFromCharge, type ChargeFormValue } from '../_components/ChargeCodeForm';
import { VariantsEditor, requestFromRows, rowsFromVariants, variantErrors, type VariantRow } from '../_components/VariantsEditor';

/**
 * One charge code: its own fields, and its billing matrix (bill-to × payment
 * term, each with tax, withholding and GL). LIVE against /api/master/charge-codes.
 *
 * Two editors, one at a time: the code's fields (PUT) and the matrix (PUT
 * …/variants, a whole-set replace). Both carry the rowVersion they were read at;
 * a 409 means someone else saved first, and the page offers a reload rather than
 * overwriting them.
 *
 * Removed from the old mock because nothing stores them: Clone, base rate, VAT %
 * on the code, GL on the code, applicability, usage and revenue figures.
 */

/** Same width as the other master pages. */
const PAGE: React.CSSProperties = { maxWidth: 'var(--gecko-container-max)', margin: '0 auto' };

const fmt = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

/** The API's words for a lost race — distinct from "still used", which is also 409. */
const isStale = (e: ApiError | null) => e?.status === 409 && /changed since you loaded/i.test(e.title);

function Info({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="gecko-eyebrow">{label}</div>
      <div className={mono ? 'gecko-text-mono gecko-cell-primary' : 'gecko-cell-primary'}>
        {value === null || value === undefined || value === '' ? <span className="gecko-cell-meta">—</span> : value}
      </div>
    </div>
  );
}

export default function ChargeCodeDetailPage() {
  const params = useParams<{ code: string }>();
  const code = (() => { try { return decodeURIComponent(params.code); } catch { return params.code; } })();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useSession();
  // Tenant-wide only: the endpoints use RequirePermission, so a branch grant does not count.
  const canManage = user?.permissions.includes('mdm.commercial.manage') ?? false;

  const { data, error, loading, reload } = useApi<ChargeCodeDetail>(chargeCodePath(code));
  const { data: vocabulary, error: vocabularyError } = useCommercialVocabulary();

  const [mode, setMode] = useState<'view' | 'fields' | 'variants'>('view');
  const [form, setForm] = useState<ChargeFormValue | null>(null);
  const [rows, setRows] = useState<VariantRow[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const begin = (next: 'fields' | 'variants') => {
    if (!data) return;
    setForm(formFromCharge(data.charge));
    setRows(rowsFromVariants(data.variants));
    setSubmitted(false);
    setActionError(null);
    setMode(next);
  };
  const cancel = () => { setMode('view'); setActionError(null); };

  /** Runs one write; on success reloads, so the page holds the new rowVersion. */
  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setActionError(null);
    try {
      await work();
      toast({ variant: 'success', title: done, message: code });
      setMode('view');
      reload();
      return true;
    } catch (e) {
      setActionError(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const fieldErrors = submitted && form ? chargeErrors(form) : {};
  const rowErrors = submitted ? variantErrors(rows) : {};

  const saveFields = () => {
    if (!data || !form) return;
    setSubmitted(true);
    if (Object.keys(chargeErrors(form)).length > 0) return;
    run(() => updateChargeCode(code, requestFromCharge(form, data.charge.rowVersion)), 'Charge code saved');
  };

  const saveVariants = () => {
    if (!data) return;
    setSubmitted(true);
    if (Object.keys(variantErrors(rows)).length > 0) return;
    run(() => replaceVariants(code, requestFromRows(rows), data.charge.rowVersion), 'Billing rows saved');
  };

  /** Deactivate is the normal way out (decision A): nothing that already uses the code breaks. */
  const toggleActive = () => {
    if (!data) return;
    const next = { ...formFromCharge(data.charge), isActive: !data.charge.isActive };
    run(() => updateChargeCode(code, requestFromCharge(next, data.charge.rowVersion)),
      next.isActive ? 'Charge code reactivated' : 'Charge code deactivated');
  };

  const remove = async () => {
    if (!data) return;
    setConfirmDelete(false);
    setBusy(true);
    setActionError(null);
    try {
      await deleteChargeCode(code, data.charge.rowVersion);
      toast({ variant: 'success', title: 'Charge code deleted', message: code });
      router.push('/masters/charge-codes');
    } catch (e) {
      setActionError(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
      setBusy(false);
    }
  };

  const back = (
    <nav className="gecko-breadcrumb" aria-label="Breadcrumb">
      <Link href="/masters" className="gecko-breadcrumb-item">Master Data</Link>
      <span className="gecko-breadcrumb-sep" />
      <Link href="/masters/charge-codes" className="gecko-breadcrumb-item">Charge Codes</Link>
      <span className="gecko-breadcrumb-sep" />
      <span className="gecko-breadcrumb-current">{code}</span>
    </nav>
  );

  if (error) {
    return (
      <div className="gecko-stack gecko-stack-xl" style={PAGE}>
        {back}
        {error.status === 404
          ? <EmptyState icon="search" title={`No charge code ${code}`} description="It may have been deleted, or the code is mistyped." />
          : <div role="alert" className="gecko-alert gecko-alert-error">{error.message}</div>}
      </div>
    );
  }
  if (!data || !vocabulary) {
    return (
      <div className="gecko-stack gecko-stack-xl" style={PAGE}>
        {back}
        {vocabularyError
          ? <div role="alert" className="gecko-alert gecko-alert-error">{vocabularyError.message}</div>
          : <div className="gecko-cell-meta">{loading ? 'Loading charge code…' : ''}</div>}
      </div>
    );
  }

  const c = data.charge;
  const unit = vocabulary.billingUnits.find(u => u.code === c.billingUnitCode)?.name ?? c.billingUnitCode;
  const moduleName = vocabulary.modules.find(m => m.code === c.moduleCode)?.name ?? c.moduleCode;
  const termName = (t: string) => vocabulary.paymentTerms.find(p => p.code === t)?.name ?? t;
  const payerName = (b: string) => vocabulary.billToRoles.find(r => r.code === b)?.name ?? b;

  return (
    <div className="gecko-stack gecko-stack-xl" style={PAGE}>
      {back}

      <div className="gecko-row gecko-row-between gecko-row-start gecko-row-wrap">
        <div className="gecko-stack gecko-stack-xs">
          <div className="gecko-row gecko-row-wrap">
            <h1 className="gecko-page-title-lg gecko-text-mono">{c.chargeCode}</h1>
            <span className={`gecko-status-dot gecko-status-dot-${c.isActive ? 'active' : 'neutral'}`}>{c.isActive ? 'Active' : 'Inactive'}</span>
            <span className="gecko-badge gecko-badge-info">{c.moduleCode}</span>
          </div>
          <div className="gecko-cell-primary">{c.descriptionEn}</div>
          {c.descriptionLocal && <div lang="th" className="gecko-cell-meta">{c.descriptionLocal}</div>}
        </div>
        {canManage && mode === 'view' && (
          <div className="gecko-row gecko-row-wrap">
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => begin('fields')} disabled={busy}>
              <Icon name="edit" size={15} /> Edit
            </button>
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={toggleActive} disabled={busy}>
              <Icon name={c.isActive ? 'eyeOff' : 'check'} size={15} /> {c.isActive ? 'Deactivate' : 'Reactivate'}
            </button>
            <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={() => setConfirmDelete(true)} disabled={busy}>
              <Icon name="trash" size={15} /> Delete
            </button>
          </div>
        )}
      </div>

      {actionError && (
        <div role="alert" className="gecko-alert gecko-alert-error gecko-row">
          <Icon name="alertCircle" size={16} />
          <span>
            {isStale(actionError)
              ? 'Someone else saved this charge code while you were working. Reload to see their change, then make yours again.'
              : actionError.status === 400 && Object.keys(actionError.fieldErrors).length > 0
                ? 'Some values were refused — see the marked fields.'
                : actionError.explanation ? `${actionError.title} ${actionError.explanation}` : actionError.message}
          </span>
          {isStale(actionError) && (
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => { cancel(); reload(); }}>
              <Icon name="refresh" size={14} /> Reload
            </button>
          )}
        </div>
      )}

      {/* ── the charge code's own fields ─────────────────────────────── */}
      <div className="gecko-card gecko-card-padded gecko-stack gecko-stack-md">
        <div className="gecko-form-section-title">Charge code</div>
        {mode === 'fields' && form ? (
          <>
            <ChargeCodeForm value={form} onChange={setForm} vocabulary={vocabulary}
              localErrors={fieldErrors} apiError={actionError} mode="edit" />
            <div className="gecko-row gecko-row-right">
              <button className="gecko-btn gecko-btn-outline" onClick={cancel} disabled={busy}>Cancel</button>
              <button className="gecko-btn gecko-btn-primary" onClick={saveFields} disabled={busy}>
                <Icon name="save" size={16} /> {busy ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </>
        ) : (
          <div className="gecko-form-grid gecko-form-grid-3">
            <Info label="Module" value={`${c.moduleCode} — ${moduleName}`} />
            <Info label="Charge type" value={fmt(c.chargeType)} />
            <Info label="Category" value={fmt(c.chargeCategory)} />
            <Info label="Billing unit" value={unit} />
            <Info label="Priced per service type" value={c.isByService ? 'Yes' : 'No'} />
          </div>
        )}
      </div>

      {/* ── the billing matrix ──────────────────────────────────────── */}
      <div className="gecko-card gecko-card-padded gecko-stack gecko-stack-md">
        <div className="gecko-row gecko-row-between">
          <div>
            <div className="gecko-form-section-title">Billing</div>
            <div className="gecko-form-section-desc">Who pays, on what terms, with which tax — one row per payer and term. The price is set in a tariff.</div>
          </div>
          {canManage && mode === 'view' && (
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => begin('variants')} disabled={busy}>
              <Icon name="edit" size={15} /> Edit billing
            </button>
          )}
        </div>

        {mode === 'variants' ? (
          <>
            <VariantsEditor rows={rows} onChange={setRows} vocabulary={vocabulary} localErrors={rowErrors} apiError={actionError} />
            <div className="gecko-row gecko-row-right">
              <button className="gecko-btn gecko-btn-outline" onClick={cancel} disabled={busy}>Cancel</button>
              <button className="gecko-btn gecko-btn-primary" onClick={saveVariants} disabled={busy}>
                <Icon name="save" size={16} /> {busy ? 'Saving…' : 'Save billing'}
              </button>
            </div>
          </>
        ) : (
          <div className="gecko-table-card">
            <table className="gecko-table">
              <thead>
                <tr><th>Bill to</th><th>Payment term</th><th>Tax</th><th>Withholding</th><th>Credit days</th><th>Revenue GL</th><th>Cost GL</th><th>Legacy code</th></tr>
              </thead>
              <tbody>
                {data.variants.length === 0 && (
                  <tr><td colSpan={8} className="gecko-cell-meta">
                    No billing rows — this charge cannot be billed until it has one.
                  </td></tr>
                )}
                {data.variants.map(v => (
                  <tr key={v.chargeCodeVariantId}>
                    <td>{payerName(v.billTo)}</td>
                    <td>{termName(v.paymentTermCode)}</td>
                    <td className="gecko-text-mono">{v.taxCode ?? '—'}</td>
                    <td className="gecko-text-mono">{v.withholdingTaxCode ?? '—'}</td>
                    <td>{v.creditTermDays ?? '—'}</td>
                    <td className="gecko-text-mono">{v.revenueGl ?? '—'}</td>
                    <td className="gecko-text-mono">{v.costGl ?? '—'}</td>
                    <td className="gecko-text-mono">{v.legacyChargeCode ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        variant="danger"
        title={`Delete ${code}?`}
        message="It disappears from every list; the history keeps every version. If an order type still raises it, the delete is refused — deactivate it instead."
        confirmLabel="Delete charge code"
      />
    </div>
  );
}
