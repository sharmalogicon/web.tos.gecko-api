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
  deleteEquipmentType, equipmentTypePath, replaceIsoCodes, updateEquipmentType, useContainerCounts, useEquipmentVocabulary,
  type EquipmentTypeDetail,
} from '@/lib/api/equipment-types';
import {
  EquipmentTypeForm, IsoCodesEditor, formFromType, isoErrors, requestFromType, rowsFromIso, typeErrors,
  type IsoRow, type TypeFormValue,
} from '../_components/EquipmentTypeEditors';

/**
 * One container type (by id): its fields and its ISO 6346 mapping, edited one
 * section at a time with the rowVersion they were read at (409 → reload).
 * Deactivate is the normal way out; Delete is refused while registry boxes or
 * partner code mappings still use the type.
 *
 * Was a mock keyed by ISO code with a fake Clone and a save that went nowhere.
 */

const PAGE: React.CSSProperties = { maxWidth: 'var(--gecko-container-max)', margin: '0 auto' };
const isStale = (e: ApiError | null) => e?.status === 409 && /changed since you loaded/i.test(e.title);
const height = (h: string) => (h === 'HIGH_CUBE' ? "High cube (9'6\")" : h === 'STANDARD' ? "Standard (8'6\")" : 'Half height');

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

export default function ContainerTypeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useSession();
  const canManage = user?.permissions.includes('mdm.equipment.manage') ?? false;

  const { data, error, loading, reload } = useApi<EquipmentTypeDetail>(equipmentTypePath(id));
  const { data: vocabulary } = useEquipmentVocabulary();
  const { data: counts } = useContainerCounts();

  const [mode, setMode] = useState<'view' | 'fields' | 'iso'>('view');
  const [form, setForm] = useState<TypeFormValue | null>(null);
  const [isoRows, setIsoRows] = useState<IsoRow[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const begin = (next: 'fields' | 'iso') => {
    if (!data) return;
    setForm(formFromType(data.type));
    setIsoRows(rowsFromIso(data.isoCodes));
    setSubmitted(false);
    setActionError(null);
    setMode(next);
  };
  const cancel = () => { setMode('view'); setActionError(null); };
  const fail = (e: unknown) => setActionError(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));

  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setActionError(null);
    try {
      await work();
      toast({ variant: 'success', title: done, message: data?.type.typeCode });
      setMode('view');
      reload();
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  if (error || !data || !vocabulary) {
    return (
      <div className="gecko-stack gecko-stack-xl" style={PAGE}>
        <Link href="/masters/container-types" className="gecko-btn gecko-btn-outline gecko-btn-sm"><Icon name="arrowLeft" size={16} /> Container types</Link>
        {error?.status === 404 || error?.status === 400
          ? <EmptyState icon="search" title="No such container type" description="It may have been deleted, or the link is wrong." />
          : error ? <div role="alert" className="gecko-alert gecko-alert-error">{error.message}</div>
          : <div className="gecko-cell-meta">{loading ? 'Loading container type…' : ''}</div>}
      </div>
    );
  }

  const t = data.type;
  const boxes = counts?.find(c => c.equipmentTypeId === t.equipmentTypeId)?.containers ?? 0;
  const group = vocabulary.isoGroups.find(g => g.code === t.isoGroupCode);
  const edit = { rowVersion: t.rowVersion, displayColorHex: t.displayColorHex };

  const saveFields = () => {
    if (!form) return;
    setSubmitted(true);
    if (Object.keys(typeErrors(form)).length > 0) return;
    run(() => updateEquipmentType(t.equipmentTypeId, requestFromType(form, edit)), 'Container type saved');
  };
  const saveIso = () => {
    setSubmitted(true);
    if (Object.keys(isoErrors(isoRows)).length > 0) return;
    run(() => replaceIsoCodes(t.equipmentTypeId, isoRows.map(r => ({ isoCode: r.isoCode, isDefaultOutbound: r.isDefaultOutbound })), t.rowVersion),
      'ISO codes saved');
  };
  const toggleActive = () =>
    run(() => updateEquipmentType(t.equipmentTypeId, requestFromType({ ...formFromType(t), isActive: !t.isActive }, edit)),
      t.isActive ? 'Container type deactivated' : 'Container type reactivated');
  const remove = async () => {
    setConfirmDelete(false);
    setBusy(true);
    setActionError(null);
    try {
      await deleteEquipmentType(t.equipmentTypeId, t.rowVersion);
      toast({ variant: 'success', title: 'Container type deleted', message: t.typeCode });
      router.push('/masters/container-types');
    } catch (e) { fail(e); setBusy(false); }
  };

  return (
    <div className="gecko-stack gecko-stack-xl" style={PAGE}>
      <nav className="gecko-breadcrumb" aria-label="Breadcrumb">
        <Link href="/masters" className="gecko-breadcrumb-item">Master Data</Link>
        <span className="gecko-breadcrumb-sep" />
        <Link href="/masters/container-types" className="gecko-breadcrumb-item">Container Types</Link>
        <span className="gecko-breadcrumb-sep" />
        <span className="gecko-breadcrumb-current">{t.typeCode}</span>
      </nav>

      <div className="gecko-row gecko-row-between gecko-row-start gecko-row-wrap">
        <div className="gecko-stack gecko-stack-xs">
          <div className="gecko-row gecko-row-wrap">
            <h1 className="gecko-page-title-lg gecko-text-mono">{t.typeCode}</h1>
            <span className={`gecko-status-dot gecko-status-dot-${t.isActive ? 'active' : 'neutral'}`}>{t.isActive ? 'Active' : 'Inactive'}</span>
            <span className="gecko-badge gecko-badge-info">{t.isoGroupCode}</span>
          </div>
          <div className="gecko-cell-primary">{t.descriptionEn}</div>
          {t.descriptionLocal && <div lang="th" className="gecko-cell-meta">{t.descriptionLocal}</div>}
        </div>
        {canManage && mode === 'view' && (
          <div className="gecko-row gecko-row-wrap">
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => begin('fields')} disabled={busy}><Icon name="edit" size={15} /> Edit</button>
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={toggleActive} disabled={busy}>
              <Icon name={t.isActive ? 'eyeOff' : 'check'} size={15} /> {t.isActive ? 'Deactivate' : 'Reactivate'}
            </button>
            <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={() => setConfirmDelete(true)} disabled={busy}><Icon name="trash" size={15} /> Delete</button>
          </div>
        )}
      </div>

      {actionError && (
        <div role="alert" className="gecko-alert gecko-alert-error gecko-row">
          <Icon name="alertCircle" size={16} />
          <span>
            {isStale(actionError)
              ? 'Someone else saved this container type while you were working. Reload to see their change, then make yours again.'
              : actionError.status === 400 && Object.keys(actionError.fieldErrors).length > 0
                ? 'Some values were refused — see the marked fields.'
                : actionError.explanation ? `${actionError.title} ${actionError.explanation}` : actionError.message}
          </span>
          {isStale(actionError) && (
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => { cancel(); reload(); }}><Icon name="refresh" size={14} /> Reload</button>
          )}
        </div>
      )}

      <div className="gecko-card gecko-card-padded gecko-stack gecko-stack-md">
        <div className="gecko-form-section-title">Container type</div>
        {mode === 'fields' && form ? (
          <>
            <EquipmentTypeForm value={form} onChange={setForm} vocabulary={vocabulary}
              localErrors={submitted ? typeErrors(form) : {}} apiError={actionError} mode="edit" />
            <div className="gecko-row gecko-row-right">
              <button className="gecko-btn gecko-btn-outline" onClick={cancel} disabled={busy}>Cancel</button>
              <button className="gecko-btn gecko-btn-primary" onClick={saveFields} disabled={busy}><Icon name="save" size={16} /> {busy ? 'Saving…' : 'Save changes'}</button>
            </div>
          </>
        ) : (
          <div className="gecko-form-grid gecko-form-grid-4">
            <Info label="Length" value={`${t.lengthFt}'`} />
            <Info label="Height" value={height(t.heightClass)} />
            <Info label="TEU" value={t.teu} />
            <Info label="ISO group" value={group ? `${group.code} — ${group.name}` : t.isoGroupCode} />
            <Info label="Handling" value={[t.isReefer && 'Reefer', t.isTank && 'Tank', t.isOog && 'Out of gauge'].filter(Boolean).join(', ') || 'Standard'} />
            <Info label="Tare (kg)" value={t.tareWeightKg} />
            <Info label="Max payload (kg)" value={t.maxPayloadKg} />
            <Info label="Max gross (kg)" value={t.maxGrossKg} />
            <Info label="Registry boxes" value={boxes.toLocaleString('en-US')} />
          </div>
        )}
      </div>

      <div className="gecko-card gecko-card-padded gecko-stack gecko-stack-md">
        <div className="gecko-row gecko-row-between">
          <div>
            <div className="gecko-form-section-title">ISO 6346 codes</div>
            <div className="gecko-form-section-desc">Inbound EDI resolves a box to this type through these codes; the default is written back on outbound messages.</div>
          </div>
          {canManage && mode === 'view' && (
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => begin('iso')} disabled={busy}><Icon name="edit" size={15} /> Edit ISO codes</button>
          )}
        </div>
        {mode === 'iso' ? (
          <>
            <IsoCodesEditor rows={isoRows} onChange={setIsoRows} localErrors={submitted ? isoErrors(isoRows) : {}} apiError={actionError} />
            <div className="gecko-row gecko-row-right">
              <button className="gecko-btn gecko-btn-outline" onClick={cancel} disabled={busy}>Cancel</button>
              <button className="gecko-btn gecko-btn-primary" onClick={saveIso} disabled={busy}><Icon name="save" size={16} /> {busy ? 'Saving…' : 'Save ISO codes'}</button>
            </div>
          </>
        ) : (
          <div className="gecko-table-card">
            <table className="gecko-table">
              <thead><tr><th>ISO code</th><th>Meaning</th><th>Default outbound</th></tr></thead>
              <tbody>
                {data.isoCodes.length === 0 && <tr><td colSpan={3} className="gecko-cell-meta">No ISO codes — inbound EDI cannot resolve boxes to this type.</td></tr>}
                {data.isoCodes.map(m => (
                  <tr key={m.isoCode}>
                    <td className="gecko-text-mono">{m.isoCode}</td>
                    <td>{m.isoDescription ?? '—'}</td>
                    <td>{m.isDefaultOutbound ? <Icon name="check" size={14} /> : ''}</td>
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
        title={`Delete ${t.typeCode}?`}
        message={boxes > 0
          ? `${boxes.toLocaleString('en-US')} registry boxes carry this type, so the delete will be refused — deactivate it instead.`
          : 'It disappears from every list, with its ISO mapping; the history keeps every version.'}
        confirmLabel="Delete container type"
      />
    </div>
  );
}
