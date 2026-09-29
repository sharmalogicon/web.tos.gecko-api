"use client";
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/lib/auth/session';
import { ApiError } from '@/lib/api/problem';
import { createChargeCode, replaceVariants, useCommercialVocabulary } from '@/lib/api/charge-codes';
import { ChargeCodeForm, EMPTY_CHARGE, chargeErrors, requestFromCharge, type ChargeFormValue } from '../_components/ChargeCodeForm';
import { VariantsEditor, blankRow, requestFromRows, variantErrors, type VariantRow } from '../_components/VariantsEditor';

/**
 * New charge code: its fields and at least one billing row, saved in two calls
 * (POST the code, then PUT its billing rows at the version the POST returned).
 * If the rows are refused, the code already exists: the page keeps it, locks the
 * code field and retries only the rows — it never creates the code twice.
 *
 * Replaces the old 5-step wizard, whose base rate, min/max, VAT %, GL and
 * applicability steps had nothing behind them.
 */

const PAGE: React.CSSProperties = { maxWidth: 'var(--gecko-container-max)', margin: '0 auto' };

export default function NewChargeCodePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useSession();
  const canManage = user?.permissions.includes('mdm.commercial.manage') ?? false;
  const { data: vocabulary, error: vocabularyError } = useCommercialVocabulary();

  const [form, setForm] = useState<ChargeFormValue>(EMPTY_CHARGE);
  /** null until the user touches the matrix; until then it shows one starting row. */
  const [editedRows, setRows] = useState<VariantRow[] | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  /** Set once the POST succeeded: from then on only the billing rows are (re)sent. */
  const [created, setCreated] = useState<{ code: string; rowVersion: string } | null>(null);

  // One starting row once the vocabulary is known (customer / cash / VAT7 where those exist).
  const startingRows = useMemo(() => (vocabulary ? [blankRow(vocabulary)] : []), [vocabulary]);
  const rows = editedRows ?? startingRows;

  const fieldErrors = submitted ? chargeErrors(form) : {};
  const rowErrors = submitted ? variantErrors(rows) : {};

  const save = async () => {
    setSubmitted(true);
    if (Object.keys(chargeErrors(form)).length > 0 || Object.keys(variantErrors(rows)).length > 0) return;
    setSaving(true);
    setApiError(null);
    let target = created;
    try {
      if (!target) {
        const detail = await createChargeCode(requestFromCharge(form));
        target = { code: detail.charge.chargeCode, rowVersion: detail.charge.rowVersion };
        setCreated(target);
      }
      await replaceVariants(target.code, requestFromRows(rows), target.rowVersion);
      toast({ variant: 'success', title: 'Charge code created', message: `${target.code} · ${form.descriptionEn}` });
      router.push(`/masters/charge-codes/${encodeURIComponent(target.code)}`);
    } catch (e) {
      setApiError(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
      setSaving(false);
    }
  };

  const header = (
    <nav className="gecko-breadcrumb" aria-label="Breadcrumb">
      <Link href="/masters" className="gecko-breadcrumb-item">Master Data</Link>
      <span className="gecko-breadcrumb-sep" />
      <Link href="/masters/charge-codes" className="gecko-breadcrumb-item">Charge Codes</Link>
      <span className="gecko-breadcrumb-sep" />
      <span className="gecko-breadcrumb-current">New</span>
    </nav>
  );

  if (!canManage) {
    return (
      <div className="gecko-stack gecko-stack-xl" style={PAGE}>
        {header}
        <div role="alert" className="gecko-alert gecko-alert-warning">
          Creating charge codes needs the mdm.commercial.manage permission (Tenant owner or Accounts).
        </div>
      </div>
    );
  }
  if (!vocabulary) {
    return (
      <div className="gecko-stack gecko-stack-xl" style={PAGE}>
        {header}
        {vocabularyError
          ? <div role="alert" className="gecko-alert gecko-alert-error">{vocabularyError.message}</div>
          : <div className="gecko-cell-meta">Loading…</div>}
      </div>
    );
  }

  const conflict = apiError?.status === 409;

  return (
    <div className="gecko-stack gecko-stack-xl" style={PAGE}>
      {header}
      <div>
        <h1 className="gecko-page-title">New charge code</h1>
        <div className="gecko-page-subtitle gecko-mt-1">
          What is chargeable, per what unit, and how it is billed. The price itself is set in a tariff.
        </div>
      </div>

      {created && (
        <div role="status" className="gecko-alert gecko-alert-info gecko-row">
          <Icon name="check" size={16} />
          <span>
            {created.code} was created. Its billing rows were not saved yet — fix them and save again,
            or <Link href={`/masters/charge-codes/${encodeURIComponent(created.code)}`} className="gecko-link">open it</Link> and add them later.
          </span>
        </div>
      )}
      {apiError && (
        <div role="alert" className="gecko-alert gecko-alert-error gecko-row">
          <Icon name="alertCircle" size={16} />
          <span>
            {conflict
              ? apiError.message
              : Object.keys(apiError.fieldErrors).length > 0 ? 'Some values were refused — see the marked fields.' : apiError.message}
          </span>
        </div>
      )}

      <div className="gecko-card gecko-card-padded gecko-stack gecko-stack-md">
        <div className="gecko-form-section-title">Charge code</div>
        <ChargeCodeForm value={form} onChange={setForm} vocabulary={vocabulary}
          localErrors={fieldErrors} apiError={created ? null : apiError} mode={created ? 'edit' : 'create'} />
      </div>

      <div className="gecko-card gecko-card-padded gecko-stack gecko-stack-md">
        <div>
          <div className="gecko-form-section-title">Billing</div>
          <div className="gecko-form-section-desc">Who pays, on what terms, with which tax — one row per payer and term.</div>
        </div>
        <VariantsEditor rows={rows} onChange={setRows} vocabulary={vocabulary} localErrors={rowErrors} apiError={apiError} />
      </div>

      <div className="gecko-row gecko-row-right">
        <Link href="/masters/charge-codes" className="gecko-btn gecko-btn-outline">Cancel</Link>
        <button className="gecko-btn gecko-btn-primary" onClick={save} disabled={saving}>
          <Icon name="save" size={16} /> {saving ? 'Saving…' : created ? 'Save billing rows' : 'Create charge code'}
        </button>
      </div>
    </div>
  );
}
