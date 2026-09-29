"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/lib/auth/session';
import { ApiError } from '@/lib/api/problem';
import { createEquipmentType, replaceIsoCodes, useEquipmentVocabulary } from '@/lib/api/equipment-types';
import {
  EMPTY_TYPE, EquipmentTypeForm, IsoCodesEditor, isoErrors, requestFromType, typeErrors, type IsoRow, type TypeFormValue,
} from '../_components/EquipmentTypeEditors';

/**
 * New container type: its fields and its ISO 6346 codes, saved as two calls
 * (POST, then PUT …/iso-codes at the rowVersion the POST returned). If the
 * mapping is refused, the type already exists: the page keeps it and retries
 * only the mapping. Replaces a mock whose save made no call.
 */

const PAGE: React.CSSProperties = { maxWidth: 'var(--gecko-container-max)', margin: '0 auto' };

export default function NewContainerTypePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useSession();
  const canManage = user?.permissions.includes('mdm.equipment.manage') ?? false;
  const { data: vocabulary, error: vocabularyError } = useEquipmentVocabulary();

  const [form, setForm] = useState<TypeFormValue>(EMPTY_TYPE);
  const [isoRows, setIsoRows] = useState<IsoRow[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [created, setCreated] = useState<{ id: string; code: string; rowVersion: string } | null>(null);

  const save = async () => {
    setSubmitted(true);
    if (Object.keys(typeErrors(form)).length > 0 || Object.keys(isoErrors(isoRows)).length > 0) return;
    setSaving(true);
    setApiError(null);
    let target = created;
    try {
      if (!target) {
        const detail = await createEquipmentType(requestFromType(form));
        target = { id: detail.type.equipmentTypeId, code: detail.type.typeCode, rowVersion: detail.type.rowVersion };
        setCreated(target);
      }
      await replaceIsoCodes(target.id, isoRows.map(r => ({ isoCode: r.isoCode, isDefaultOutbound: r.isDefaultOutbound })), target.rowVersion);
      toast({ variant: 'success', title: 'Container type created', message: `${target.code} · ${form.descriptionEn}` });
      router.push(`/masters/container-types/${target.id}`);
    } catch (e) {
      setApiError(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
      setSaving(false);
    }
  };

  const crumbs = (
    <nav className="gecko-breadcrumb" aria-label="Breadcrumb">
      <Link href="/masters" className="gecko-breadcrumb-item">Master Data</Link>
      <span className="gecko-breadcrumb-sep" />
      <Link href="/masters/container-types" className="gecko-breadcrumb-item">Container Types</Link>
      <span className="gecko-breadcrumb-sep" />
      <span className="gecko-breadcrumb-current">New</span>
    </nav>
  );

  if (!canManage || !vocabulary) {
    return (
      <div className="gecko-stack gecko-stack-xl" style={PAGE}>
        {crumbs}
        {!canManage
          ? <div role="alert" className="gecko-alert gecko-alert-warning">Creating container types needs the mdm.equipment.manage permission (Tenant owner or Ops manager).</div>
          : vocabularyError ? <div role="alert" className="gecko-alert gecko-alert-error">{vocabularyError.message}</div>
          : <div className="gecko-cell-meta">Loading…</div>}
      </div>
    );
  }

  return (
    <div className="gecko-stack gecko-stack-xl" style={PAGE}>
      {crumbs}
      <div>
        <h1 className="gecko-page-title">New container type</h1>
        <div className="gecko-page-subtitle gecko-mt-1">Your own code for a kind of box, and the ISO 6346 codes it answers to.</div>
      </div>

      {created && (
        <div role="status" className="gecko-alert gecko-alert-info gecko-row">
          <Icon name="check" size={16} />
          <span>{created.code} was created. Its ISO codes were not saved yet — fix them and save again, or{' '}
            <Link href={`/masters/container-types/${created.id}`} className="gecko-link">open it</Link>.</span>
        </div>
      )}
      {apiError && (
        <div role="alert" className="gecko-alert gecko-alert-error gecko-row">
          <Icon name="alertCircle" size={16} />
          <span>{Object.keys(apiError.fieldErrors).length > 0 ? 'Some values were refused — see the marked fields.' : apiError.explanation ? `${apiError.title} ${apiError.explanation}` : apiError.message}</span>
        </div>
      )}

      <div className="gecko-card gecko-card-padded gecko-stack gecko-stack-md">
        <div className="gecko-form-section-title">Container type</div>
        <EquipmentTypeForm value={form} onChange={setForm} vocabulary={vocabulary}
          localErrors={submitted ? typeErrors(form) : {}} apiError={created ? null : apiError} mode={created ? 'edit' : 'create'} />
      </div>

      <div className="gecko-card gecko-card-padded gecko-stack gecko-stack-md">
        <div>
          <div className="gecko-form-section-title">ISO 6346 codes</div>
          <div className="gecko-form-section-desc">Search the standard and add the codes this type answers to; mark the one written on outbound EDI.</div>
        </div>
        <IsoCodesEditor rows={isoRows} onChange={setIsoRows} localErrors={submitted ? isoErrors(isoRows) : {}} apiError={apiError} />
      </div>

      <div className="gecko-row gecko-row-right">
        <Link href="/masters/container-types" className="gecko-btn gecko-btn-outline">Cancel</Link>
        <button className="gecko-btn gecko-btn-primary" onClick={save} disabled={saving}>
          <Icon name="save" size={16} /> {saving ? 'Saving…' : created ? 'Save ISO codes' : 'Create container type'}
        </button>
      </div>
    </div>
  );
}
