"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/problem';
import { apiSend } from '@/lib/api/client';
import { useApi } from '@/lib/api/use-api';
import { useSession } from '@/lib/auth/session';
import { VESSELS_PATH, deleteCoded, vesselPath, type Vessel } from '@/lib/api/logistics';
import { VesselForm, localErrors } from '../_components/VesselForm';

/** A vessel by its code (the IMO may be empty, so it cannot be the address). */
export default function VesselDetailPage() {
  const { code } = useParams<{ code: string }>();
  const vesselCode = decodeURIComponent(code);
  const router = useRouter();
  const { toast } = useToast();
  const { can } = useSession();
  const canManage = can('mdm.logistics.manage');
  const { data, error: loadError, loading, reload } = useApi<Vessel>(vesselPath(vesselCode));

  const [draft, setDraft] = useState<Vessel | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // The form edits a copy; a fresh read (after a save) starts a fresh copy.
  const [draftOf, setDraftOf] = useState<string | undefined>(undefined);
  if (data && draftOf !== data.rowVersion) {
    setDraftOf(data.rowVersion);
    setDraft({ ...data });
  }

  const errors = submitted && draft && data ? localErrors(draft, data.imoNumber) : {};
  const dirty = !!draft && !!data && JSON.stringify(draft) !== JSON.stringify(data);

  const save = async () => {
    if (!draft || !data) return;
    setSubmitted(true);
    if (Object.keys(localErrors(draft, data.imoNumber)).length > 0) return;
    setSaving(true);
    setError(null);
    try {
      await apiSend<Vessel>('PUT', vesselPath(vesselCode), draft);
      toast({ variant: 'success', title: 'Vessel saved', message: `${draft.vesselCode} · ${draft.vesselName}` });
      setSubmitted(false);
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setConfirmDelete(false);
    if (!data) return;
    try {
      await deleteCoded(VESSELS_PATH, data.vesselCode, data.rowVersion!);
      toast({ variant: 'success', title: 'Vessel deleted', message: data.vesselCode });
      router.push('/masters/vessels');
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
    }
  };

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 1040, margin: '0 auto' }}>
      <nav className="gecko-breadcrumb" aria-label="Breadcrumb">
        <Link href="/masters/vessels" className="gecko-breadcrumb-item">Master Data › Vessels</Link>
        <span className="gecko-breadcrumb-sep" />
        <span className="gecko-breadcrumb-current">{vesselCode}</span>
      </nav>

      {loadError && (
        <div role="alert" className="gecko-alert gecko-alert-error gecko-row" style={{ gap: 10 }}>
          <Icon name="alertCircle" size={16} /><span>{loadError.status === 404 ? `There is no vessel ${vesselCode}.` : loadError.message}</span>
        </div>
      )}
      {loading && !data && !loadError && <div className="gecko-cell-meta">Loading…</div>}

      {data && draft && (
        <>
          <div className="gecko-page-actions">
            <div className="gecko-page-actions-left">
              <div className="gecko-row gecko-row-baseline gecko-stack-md">
                <h1 className="gecko-page-title">{data.vesselName}</h1>
                <span className="gecko-badge gecko-badge-gray gecko-text-mono">{data.vesselCode}</span>
                {!data.isActive && <span className="gecko-badge gecko-badge-warning">Inactive</span>}
              </div>
              <div className="gecko-page-subtitle">
                {data.imoNumber ? `IMO ${data.imoNumber}` : 'No IMO number'}{data.operatorName ? ` · operated by ${data.operatorName}` : ''}
              </div>
            </div>
            {canManage && (
              <div className="gecko-toolbar">
                <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" style={{ color: 'var(--gecko-error-600)' }} onClick={() => setConfirmDelete(true)}>
                  <Icon name="trash" size={14} /> Delete
                </button>
              </div>
            )}
          </div>

          {error && (
            <div role="alert" className="gecko-alert gecko-alert-error gecko-row" style={{ gap: 10 }}>
              <Icon name="alertCircle" size={16} /><span>{error.message}</span>
              {error.status === 409 && <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => { setError(null); reload(); }}>Reload</button>}
            </div>
          )}

          <div className="gecko-card" style={{ padding: 24 }}>
            <VesselForm value={draft} onChange={setDraft} isNew={false} readOnly={!canManage} errors={errors} apiError={error} />
          </div>

          {canManage && (
            <div className="gecko-row" style={{ gap: 8, justifyContent: 'flex-end' }}>
              <button className="gecko-btn gecko-btn-outline" disabled={!dirty || saving} onClick={() => { setDraft({ ...data }); setError(null); setSubmitted(false); }}>Discard</button>
              <button className="gecko-btn gecko-btn-primary" onClick={save} disabled={!dirty || saving}>
                <Icon name="save" size={16} /> {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}

          <ConfirmDialog
            isOpen={confirmDelete}
            onClose={() => setConfirmDelete(false)}
            onConfirm={remove}
            variant="danger"
            title={`Delete vessel ${data.vesselCode}?`}
            message="It disappears from pick lists; vessel calls and bookings that already name it keep the code. A vessel with contacts cannot be deleted — make it inactive instead."
            confirmLabel="Delete vessel"
          />
        </>
      )}
    </div>
  );
}
