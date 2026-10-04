"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { useApi } from '@/lib/api/use-api';
import { useSession } from '@/lib/auth/session';
import { ApiError } from '@/lib/api/problem';
import { partyPath, updateParty, type PartyDetail } from '@/lib/api/parties';
import { PartyForm, formFromParty, localErrors, requestFromForm, type PartyFormValue } from '../_components/PartyForm';
import { RoleBadge } from '../_components/RoleBadge';
import { ContactsSection } from '../_components/ContactsSection';
import { formatDateTime } from '@/lib/format';

function Info({ label, value, mono, lang }: { label: string; value: React.ReactNode; mono?: boolean; lang?: string }) {
  return (
    <div>
      <div className="gecko-cell-meta" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div className={mono ? 'gecko-text-mono' : undefined} lang={lang} style={{ fontSize: 14, marginTop: 2, whiteSpace: 'pre-line' }}>
        {value === null || value === undefined || value === '' ? <span style={{ color: 'var(--gecko-text-disabled)' }}>—</span> : value}
      </div>
    </div>
  );
}

const fmt = formatDateTime;   // dd-MM-yyyy HH:mm

export default function CustomerDetailPage() {
  // useParams hands back the decoded segment; a code with '/' is re-encoded by partyPath.
  const params = useParams<{ id: string }>();
  const code = (() => {
    try { return decodeURIComponent(params.id); } catch { return params.id; }
  })();
  const { data: party, error, loading, reload } = useApi<PartyDetail>(partyPath(code));
  const { user } = useSession();
  const { toast } = useToast();

  // PUT needs the tenant-wide mdm.party.manage (prm); a branch grant is not enough.
  const canEdit = user?.permissions.includes('mdm.party.manage') ?? false;

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PartyFormValue | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<ApiError | null>(null);

  const startEdit = () => {
    if (!party) return;
    setForm(formFromParty(party));
    setSubmitted(false);
    setSaveError(null);
    setEditing(true);
  };

  const save = async () => {
    if (!party || !form) return;
    setSubmitted(true);
    if (Object.keys(localErrors(form, formFromParty(party))).length > 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await updateParty(party.partyCode, requestFromForm(form, party.rowVersion));
      toast({ variant: 'success', title: 'Customer saved', message: `${saved.partyCode} · ${saved.nameEn}` });
      setEditing(false);
      reload();
    } catch (e) {
      setSaveError(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
    } finally {
      setSaving(false);
    }
  };

  /** 409 on edit is either a stale rowVersion or a tax id + branch that another party holds. */
  const isStale = saveError?.status === 409 && !/already exists/.test(saveError.message);

  if (error) {
    return (
      <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 960, margin: '0 auto' }}>
        <Link href="/masters/customers" className="gecko-btn gecko-btn-outline gecko-btn-sm" style={{ alignSelf: 'flex-start' }}>
          <Icon name="arrowLeft" size={16} /> Customers
        </Link>
        {error.status === 404
          ? <EmptyState icon="search" title={`No customer ${code}`} description="It may have been removed, or the code is mistyped." />
          : <div role="alert" className="gecko-alert gecko-alert-error">{error.message}</div>}
      </div>
    );
  }

  if (!party) {
    return <div className="gecko-cell-meta" style={{ padding: 24 }}>{loading ? 'Loading customer…' : ''}</div>;
  }

  const address = [party.address, party.address2, [party.city, party.state, party.postcode].filter(Boolean).join(' ')]
    .filter(Boolean).join('\n');

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto' }}>

      <nav className="gecko-breadcrumb" aria-label="Breadcrumb">
        <Link href="/masters/customers" className="gecko-breadcrumb-item">Master Data › Customers</Link>
        <span className="gecko-breadcrumb-sep" />
        <span className="gecko-breadcrumb-current">{party.partyCode}</span>
      </nav>

      <div className="gecko-row gecko-row-between gecko-row-start" style={{ paddingBottom: 20, borderBottom: '1px solid var(--gecko-border)' }}>
        <div>
          <div className="gecko-row gecko-row-wrap" style={{ gap: 10 }}>
            <h1 className="gecko-page-title-lg">{party.nameEn}</h1>
            <span className={`gecko-status-dot gecko-status-dot-${party.isActive ? 'active' : 'warning'}`}>
              {party.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          {party.nameLocal && <div lang="th" style={{ fontSize: 16, marginTop: 4 }}>{party.nameLocal}</div>}
          <div className="gecko-row gecko-row-wrap gecko-mt-2" style={{ gap: 6 }}>
            <span className="gecko-text-mono gecko-cell-meta">{party.partyCode}</span>
            {party.roles.map(r => <RoleBadge key={r} role={r} />)}
          </div>
        </div>
        {!editing && canEdit && (
          <button className="gecko-btn gecko-btn-outline" onClick={startEdit}><Icon name="edit" size={16} /> Edit</button>
        )}
      </div>

      {(party.duplicates?.length ?? 0) > 0 && (
        <div role="note" className="gecko-alert gecko-alert-info gecko-row gecko-row-wrap">
          <Icon name="alertCircle" size={16} />
          <span>{party.duplicates!.length} other code{party.duplicates!.length === 1 ? '' : 's'} share this tax ID and branch — check you are billing the right one:</span>
          {party.duplicates!.map(d => (
            <Link key={d.partyCode} href={`/masters/customers/${encodeURIComponent(d.partyCode)}`} className="gecko-link gecko-text-mono">
              {d.partyCode}{d.isActive ? '' : ' (inactive)'}
            </Link>
          ))}
        </div>
      )}

      {editing && form ? (
        <>
          {saveError && (
            <div role="alert" className="gecko-alert gecko-alert-error gecko-row" style={{ gap: 10 }}>
              <Icon name="alertCircle" size={16} />
              <span>
                {isStale
                  ? 'Someone else saved this customer while you were editing. Reload to see their changes, then make yours again.'
                  : saveError.message}
              </span>
              {isStale && (
                <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => { setEditing(false); reload(); }}>
                  <Icon name="refresh" size={14} /> Reload
                </button>
              )}
            </div>
          )}
          <div className="gecko-card" style={{ padding: 24 }}>
            <PartyForm value={form} original={formFromParty(party)} onChange={setForm} showErrors={submitted} apiError={saveError} mode="edit" />
          </div>
          <div className="gecko-row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <button className="gecko-btn gecko-btn-outline" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
            <button className="gecko-btn gecko-btn-primary" onClick={save} disabled={saving}>
              <Icon name="save" size={16} /> {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="gecko-card" style={{ padding: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
              <Info label="Tax ID" value={party.taxId} mono />
              <Info label="Tax branch" value={party.branchNo === '00000' ? '00000 (head office)' : party.branchNo} mono />
              <Info label="Short name" value={party.shortName} />
              <Info label="Country" value={party.countryCode} />
              <Info label="Currency" value={party.defaultCurrency} />
              <Info label="Phone" value={party.phone} />
              <Info label="E-mail" value={party.email} />
              <Info label="Website" value={party.website} />
              <div style={{ gridColumn: 'span 2' }}><Info label="Address" value={address} /></div>
              <div style={{ gridColumn: 'span 2' }}><Info label="Remarks" value={party.remarks} /></div>
              <Info label="Created" value={fmt(party.createdAt)} />
              <Info label="Last updated" value={fmt(party.updatedAt)} />
            </div>
          </div>

          <ContactsSection partyCode={party.partyCode} contacts={party.contacts} canEdit={canEdit} onChanged={reload} />

          <div className="gecko-table-card">
            <div style={{ padding: '14px 16px', fontWeight: 700 }}>Other codes (aliases)</div>
            <table className="gecko-table">
              <thead><tr><th>Type</th><th>Code</th><th>Label</th></tr></thead>
              <tbody>
                {party.aliases.length === 0 && (
                  <tr><td colSpan={3} className="gecko-cell-meta">No other codes.</td></tr>
                )}
                {party.aliases.map(a => (
                  <tr key={`${a.type}:${a.code}`}>
                    <td>{a.type}</td>
                    <td className="gecko-text-mono">{a.code}</td>
                    <td>{a.label ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
