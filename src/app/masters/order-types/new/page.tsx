"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/lib/auth/session';
import { ApiError } from '@/lib/api/problem';
import { useCommercialVocabulary } from '@/lib/api/charge-codes';
import { createOrderType, replaceCharges, replaceSteps, useOrderTypeVocabulary } from '@/lib/api/order-types';
import { OrderTypeForm, EMPTY_ORDER_TYPE, orderTypeErrors, requestFromOrderType, type OrderTypeFormValue } from '../_components/OrderTypeForm';
import { StepsEditor, blankStep, requestFromSteps, stepErrors, type StepRow } from '../_components/StepsEditor';
import { ChargesEditor, chargeRowErrors, requestFromCharges, type ChargeRow } from '../_components/ChargesEditor';

/**
 * New order type: its fields, its gate steps, and the charges it raises — saved
 * as three calls (POST, PUT …/movements, PUT …/charges), each at the rowVersion
 * the previous one returned. If a later part is refused, what was saved stays
 * saved: the page remembers it and retries only the rest, so nothing is created
 * twice.
 *
 * Replaces the old 4-step wizard, whose hard-coded movement / charge / EDI
 * catalogs and save-that-went-nowhere had nothing behind them.
 */

const PAGE: React.CSSProperties = { maxWidth: 'var(--gecko-container-max)', margin: '0 auto' };

interface Progress { code: string; rowVersion: string; stepsSaved: boolean }

export default function NewOrderTypePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useSession();
  const canManage = user?.permissions.includes('mdm.commercial.manage') ?? false;
  const { data: vocabulary, error: vocabularyError } = useOrderTypeVocabulary();
  const { data: commercial, error: commercialError } = useCommercialVocabulary();

  const [form, setForm] = useState<OrderTypeFormValue>(EMPTY_ORDER_TYPE);
  const [steps, setSteps] = useState<StepRow[]>(() => [blankStep(), blankStep()]);
  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);

  const stepCodes = steps.map(s => s.movementCode).filter(Boolean);
  const headerErrors = submitted ? orderTypeErrors(form) : {};
  const stepRowErrors = submitted ? stepErrors(steps) : {};
  const chargeErrors = submitted ? chargeRowErrors(charges, stepCodes) : {};

  const save = async () => {
    setSubmitted(true);
    if ([orderTypeErrors(form), stepErrors(steps), chargeRowErrors(charges, stepCodes)].some(e => Object.keys(e).length > 0)) return;
    setSaving(true);
    setApiError(null);
    let p = progress;
    try {
      if (!p) {
        const created = await createOrderType(requestFromOrderType(form));
        p = { code: created.orderType.orderTypeCode, rowVersion: created.orderType.rowVersion, stepsSaved: false };
        setProgress(p);
      }
      if (!p.stepsSaved) {
        const withSteps = await replaceSteps(p.code, requestFromSteps(steps), p.rowVersion);
        p = { ...p, rowVersion: withSteps.orderType.rowVersion, stepsSaved: true };
        setProgress(p);
      }
      if (charges.length > 0) await replaceCharges(p.code, requestFromCharges(charges), p.rowVersion);
      toast({ variant: 'success', title: 'Order type created', message: `${p.code} · ${form.descriptionEn}` });
      router.push('/masters/order-types');
    } catch (e) {
      setApiError(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
      setSaving(false);
    }
  };

  const header = (
    <nav className="gecko-breadcrumb" aria-label="Breadcrumb">
      <Link href="/masters" className="gecko-breadcrumb-item">Master Data</Link>
      <span className="gecko-breadcrumb-sep" />
      <Link href="/masters/order-types" className="gecko-breadcrumb-item">Order Types</Link>
      <span className="gecko-breadcrumb-sep" />
      <span className="gecko-breadcrumb-current">New</span>
    </nav>
  );

  if (!canManage) {
    return (
      <div className="gecko-stack gecko-stack-xl" style={PAGE}>
        {header}
        <div role="alert" className="gecko-alert gecko-alert-warning">
          Creating order types needs the mdm.commercial.manage permission (Tenant owner or Accounts).
        </div>
      </div>
    );
  }
  if (!vocabulary || !commercial) {
    const failed = vocabularyError ?? commercialError;
    return (
      <div className="gecko-stack gecko-stack-xl" style={PAGE}>
        {header}
        {failed ? <div role="alert" className="gecko-alert gecko-alert-error">{failed.message}</div> : <div className="gecko-cell-meta">Loading…</div>}
      </div>
    );
  }

  const locked = progress !== null;

  return (
    <div className="gecko-stack gecko-stack-xl" style={PAGE}>
      {header}
      <div>
        <h1 className="gecko-page-title">New order type</h1>
        <div className="gecko-page-subtitle gecko-mt-1">
          What the depot is asked to do: the gate steps a box walks, the checks at each step, and the charges it raises.
        </div>
      </div>

      {progress && (
        <div role="status" className="gecko-alert gecko-alert-info gecko-row">
          <Icon name="check" size={16} />
          <span>
            {progress.code} was created{progress.stepsSaved ? ' with its steps' : ''}. Fix what was refused below and save again — the saved part is kept.
          </span>
        </div>
      )}
      {apiError && (
        <div role="alert" className="gecko-alert gecko-alert-error gecko-row">
          <Icon name="alertCircle" size={16} />
          <span>{Object.keys(apiError.fieldErrors).length > 0 ? 'Some values were refused — see the marked fields and rows.' : apiError.message}</span>
        </div>
      )}

      <div className="gecko-card gecko-card-padded gecko-stack gecko-stack-md">
        <div className="gecko-form-section-title">Order type</div>
        <OrderTypeForm value={form} onChange={setForm} vocabulary={vocabulary} localErrors={headerErrors}
          apiError={locked ? null : apiError} mode={locked ? 'edit' : 'create'} />
      </div>

      <div className="gecko-card gecko-card-padded gecko-stack gecko-stack-md">
        <div>
          <div className="gecko-form-section-title">Gate steps</div>
          <div className="gecko-form-section-desc">Walked in this order. Each step is a movement, with the checks the gate enforces at that step.</div>
        </div>
        {progress?.stepsSaved
          ? <div className="gecko-cell-meta">Saved: {stepCodes.join(' → ')}. Change them later from the order type.</div>
          : <StepsEditor rows={steps} onChange={setSteps} vocabulary={vocabulary} localErrors={stepRowErrors} apiError={apiError} requiresVesselSchedule={form.requiresVesselSchedule} />}
      </div>

      <div className="gecko-card gecko-card-padded gecko-stack gecko-stack-md">
        <div>
          <div className="gecko-form-section-title">Charges raised</div>
          <div className="gecko-form-section-desc">Optional. Who pays and when — the price comes from the tariff.</div>
        </div>
        <ChargesEditor rows={charges} onChange={setCharges} stepCodes={stepCodes} vocabulary={vocabulary} commercial={commercial}
          localErrors={chargeErrors} apiError={apiError} />
      </div>

      <div className="gecko-row gecko-row-right">
        <Link href="/masters/order-types" className="gecko-btn gecko-btn-outline">Cancel</Link>
        <button className="gecko-btn gecko-btn-primary" onClick={save} disabled={saving}>
          <Icon name="save" size={16} /> {saving ? 'Saving…' : locked ? 'Save the rest' : 'Create order type'}
        </button>
      </div>
    </div>
  );
}
