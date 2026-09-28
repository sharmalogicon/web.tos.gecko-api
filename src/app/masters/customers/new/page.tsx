"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/problem';
import { createParty } from '@/lib/api/parties';
import { EMPTY_PARTY, PartyForm, localErrors, requestFromForm, type PartyFormValue } from '../_components/PartyForm';

/** "A party with this tax id and branch already exists: P001234. …" → P001234 */
function existingCodeFrom(error: ApiError): string | null {
  return /already exists: (\S+?)\.(?:\s|$)/.exec(error.message)?.[1] ?? null;
}

export default function NewCustomerPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<PartyFormValue>({ ...EMPTY_PARTY });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const save = async () => {
    setSubmitted(true);
    if (Object.keys(localErrors(form)).length > 0) return;
    setSaving(true);
    setError(null);
    try {
      const party = await createParty(requestFromForm(form));
      toast({ variant: 'success', title: 'Customer registered', message: `${party.partyCode} · ${party.nameEn}` });
      router.push(`/masters/customers/${encodeURIComponent(party.partyCode)}`);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
      setSaving(false);
    }
  };

  const duplicateOf = error?.status === 409 ? existingCodeFrom(error) : null;

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 960, margin: '0 auto' }}>
      <nav className="gecko-breadcrumb" aria-label="Breadcrumb">
        <Link href="/masters/customers" className="gecko-breadcrumb-item">Master Data › Customers</Link>
        <span className="gecko-breadcrumb-sep" />
        <span className="gecko-breadcrumb-current">New customer</span>
      </nav>

      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <h1 className="gecko-page-title">New customer</h1>
          <div className="gecko-page-subtitle">The customer code is assigned automatically when you save.</div>
        </div>
      </div>

      {error && (
        <div role="alert" className="gecko-alert gecko-alert-error gecko-row" style={{ gap: 10 }}>
          <Icon name="alertCircle" size={16} />
          <span>{error.message}</span>
          {duplicateOf && (
            <Link href={`/masters/customers/${encodeURIComponent(duplicateOf)}`} className="gecko-btn gecko-btn-outline gecko-btn-sm">
              Open {duplicateOf}
            </Link>
          )}
        </div>
      )}

      <div className="gecko-card" style={{ padding: 24 }}>
        <PartyForm value={form} onChange={setForm} showErrors={submitted} apiError={error} mode="create" />
      </div>

      <div className="gecko-row" style={{ gap: 8, justifyContent: 'flex-end' }}>
        <Link href="/masters/customers" className="gecko-btn gecko-btn-outline">Cancel</Link>
        <button className="gecko-btn gecko-btn-primary" onClick={save} disabled={saving}>
          <Icon name="save" size={16} /> {saving ? 'Saving…' : 'Register customer'}
        </button>
      </div>
    </div>
  );
}
