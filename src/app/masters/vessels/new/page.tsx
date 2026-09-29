"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/problem';
import { apiSend } from '@/lib/api/client';
import { VESSELS_PATH, type Vessel } from '@/lib/api/logistics';
import { EMPTY_VESSEL, VesselForm, localErrors } from '../_components/VesselForm';

export default function NewVesselPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<Vessel>({ ...EMPTY_VESSEL });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const errors = submitted ? localErrors(form, null) : {};

  const save = async () => {
    setSubmitted(true);
    if (Object.keys(localErrors(form, null)).length > 0) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await apiSend<Vessel>('POST', VESSELS_PATH, form);
      toast({ variant: 'success', title: 'Vessel added', message: `${saved.vesselCode} · ${saved.vesselName}` });
      router.push(`/masters/vessels/${encodeURIComponent(saved.vesselCode)}`);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
      setSaving(false);
    }
  };

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 1040, margin: '0 auto' }}>
      <nav className="gecko-breadcrumb" aria-label="Breadcrumb">
        <Link href="/masters/vessels" className="gecko-breadcrumb-item">Master Data › Vessels</Link>
        <span className="gecko-breadcrumb-sep" />
        <span className="gecko-breadcrumb-current">New vessel</span>
      </nav>
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <h1 className="gecko-page-title">New vessel</h1>
          <div className="gecko-page-subtitle">The IMO number is checked against its check digit, and one IMO is one vessel.</div>
        </div>
      </div>

      {error && (
        <div role="alert" className="gecko-alert gecko-alert-error gecko-row" style={{ gap: 10 }}>
          <Icon name="alertCircle" size={16} /><span>{error.message}</span>
        </div>
      )}

      <div className="gecko-card" style={{ padding: 24 }}>
        <VesselForm value={form} onChange={setForm} isNew readOnly={false} errors={errors} apiError={error} />
      </div>

      <div className="gecko-row" style={{ gap: 8, justifyContent: 'flex-end' }}>
        <Link href="/masters/vessels" className="gecko-btn gecko-btn-outline">Cancel</Link>
        <button className="gecko-btn gecko-btn-primary" onClick={save} disabled={saving}>
          <Icon name="save" size={16} /> {saving ? 'Saving…' : 'Add vessel'}
        </button>
      </div>
    </div>
  );
}
