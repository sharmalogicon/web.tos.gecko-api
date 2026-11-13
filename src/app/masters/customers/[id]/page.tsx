"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { useApi } from '@/lib/api/use-api';
import { useSession } from '@/lib/auth/session';
import { ApiError } from '@/lib/api/problem';
import { deleteParty, partyPath, updateParty, type PartyDetail } from '@/lib/api/parties';
import { PartyForm, formFromParty, localErrors, requestFromForm, type PartyFormValue } from '../_components/PartyForm';
import { RoleBadge } from '../_components/RoleBadge';
import { ContactsSection } from '../_components/ContactsSection';
import { formatDateTime } from '@/lib/format';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

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
  const router = useRouter();

  // PUT needs the tenant-wide mdm.party.manage (prm); a branch grant is not enough.
  const canEdit = user?.permissions.includes('mdm.party.manage') ?? false;

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PartyFormValue | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<ApiError | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  /**
   * THE SERVER'S REFUSAL, shown in its own words.
   *
   * A 409 means the delete did not happen and the customer still has business
   * open. Only the API knows what — "1 open booking (BK...); 2 active
   * quotations" — so this holds the ApiError and the dialog renders its title
   * and detail verbatim. Anything this screen invented here would be a guess
   * about somebody's money.
   */
  const [refusal, setRefusal] = useState<ApiError | null>(null);
  /** A delete that failed for any other reason: 412, 403, a network drop. */
  const [deleteError, setDeleteError] = useState<ApiError | null>(null);

  /** `isActive` overrides the stored value — how "Set inactive instead" opens Edit. */
  const startEdit = (isActive?: boolean) => {
    if (!party) return;
    const base = formFromParty(party);
    setForm(isActive === undefined ? base : { ...base, isActive });
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

  const remove = async () => {
    if (!party) return;
    setConfirmDelete(false);
    setDeleting(true);
    setRefusal(null);
    setDeleteError(null);
    try {
      await deleteParty(party.partyCode, party.rowVersion);
      toast({ variant: 'success', title: 'Customer deleted', message: `${party.partyCode} · ${party.nameEn}` });
      router.push('/masters/customers');
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.');
      // 409 is the refusal: nothing was deleted and the customer stays on
      // screen, so the clerk can act on what it names without navigating back.
      if (err.status === 409) setRefusal(err);
      else setDeleteError(err);
    } finally {
      setDeleting(false);
    }
  };

  /** 409 on edit is either a stale rowVersion or a tax id + branch that another party holds. */
  const isStale = saveError?.status === 409 && !/already exists/.test(saveError.message);
  /** A delete loses the race the same way an edit does: reload and try again. */
  const deleteStale = deleteError?.status === 412;

  if (error) {
    return (
      <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 960, margin: '0 auto' }}>
        <Link href="/masters/customers" className="gecko-btn gecko-btn-outline gecko-btn-sm" style={{ alignSelf: 'flex-start' }}>
          <Icon name="arrowLeft" size={16} /> Customers
        </Link>
        {error.status === 404
          ? <EmptyState icon="search" title={`No customer ${code}`} description="It may have been removed, or the code is mistyped." />
          : <ErrorBanner error={error} />}
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
          <div className="gecko-row gecko-gap-2">
            <button className="gecko-btn gecko-btn-outline" onClick={() => startEdit()} disabled={deleting}>
              <Icon name="edit" size={16} /> Edit
            </button>
            <button className="gecko-btn gecko-btn-outline gecko-btn-danger-text" onClick={() => setConfirmDelete(true)} disabled={deleting}>
              <Icon name="trash" size={16} /> {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        )}
      </div>

      {deleteError && (
        <ErrorBanner
          error={deleteError}
          heading={deleteStale ? 'This customer changed while you were looking at it' : undefined}
          detail={deleteStale
            ? 'Someone else saved it since this page loaded, so the delete was refused. Reload to see their changes, then decide again.'
            : undefined}
          action={deleteStale ? (
            <button type="button" className="gecko-error-banner-link" onClick={() => { setDeleteError(null); reload(); }}>
              <Icon name="refresh" size={14} /> Reload
            </button>
          ) : undefined}
        />
      )}

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
            <ErrorBanner
              error={saveError}
              detail={isStale
                ? 'Someone else saved this customer while you were editing. Reload to see their changes, then make yours again.'
                : undefined}
              action={isStale ? (
                <button type="button" className="gecko-error-banner-link" onClick={() => { setEditing(false); reload(); }}>
                  <Icon name="refresh" size={14} /> Reload
                </button>
              ) : undefined}
            />
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

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        variant="danger"
        title={`Delete customer ${party.partyCode}?`}
        message={`${party.partyCode} – ${party.nameEn}. It will be hidden from lists and pickers. Its bookings, invoices and receipts are kept.`}
        confirmLabel="Delete customer"
      />

      {/* THE REFUSAL. The heading and the body are the server's own words:
          it is the only party that knows what is still open, and it names it
          by number. The customer is untouched, so OK simply closes. */}
      <Modal
        isOpen={!!refusal}
        onClose={() => setRefusal(null)}
        title={refusal?.title ?? 'The customer cannot be deleted.'}
        size="md"
        footer={
          <>
            <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm"
              onClick={() => { setRefusal(null); startEdit(false); }}>
              <Icon name="eyeOff" size={14} /> Set inactive instead
            </button>
            <button type="button" className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => setRefusal(null)}>OK</button>
          </>
        }
      >
        <div>{refusal?.detail ?? 'It still has business open. Close or end that first, or set the customer inactive.'}</div>
      </Modal>
    </div>
  );
}
