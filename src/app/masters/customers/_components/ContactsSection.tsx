"use client";
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Field, FormGrid } from '@/components/ui/FormGrid';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/problem';
import {
  CONTACT_ROLES, createContact, deleteContact, updateContact, type PartyContact, type SaveContactRequest,
} from '@/lib/api/parties';

/**
 * A party's contacts — for a migrated depot mostly tax-invoice addresses.
 * Add / edit / delete need mdm.party.manage; every write carries the contact's
 * rowVersion (409 → reload). One default per contact type: ticking Default
 * moves it here from the previous default, server-side.
 */

type Draft = Omit<SaveContactRequest, 'rowVersion'>;
const EMPTY: Draft = {
  contactType: 'BILLING', contactPerson: null, jobTitle: null, phone: null, mobile: null, email: null,
  address1: null, address2: null, city: null, state: null, postcode: null, isDefault: false,
};
const draftOf = (c: PartyContact): Draft => ({
  contactType: c.role, contactPerson: c.name, jobTitle: c.jobTitle, phone: c.phone, mobile: c.mobile, email: c.email,
  address1: c.address1, address2: c.address2, city: c.city, state: c.state, postcode: c.postcode, isDefault: c.isDefault,
});
const humanize = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export function ContactsSection({ partyCode, contacts, canEdit, onChanged }: {
  partyCode: string;
  contacts: PartyContact[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState<PartyContact | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [toDelete, setToDelete] = useState<PartyContact | null>(null);

  const open = (target: PartyContact | 'new') => {
    setDraft(target === 'new' ? EMPTY : draftOf(target));
    setError(null);
    setEditing(target);
  };
  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      toast({ variant: 'success', title: done, message: partyCode });
      setEditing(null);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
    } finally {
      setBusy(false);
    }
  };
  const save = () => run(
    () => editing === 'new' ? createContact(partyCode, draft) : updateContact(partyCode, (editing as PartyContact).contactId, { ...draft, rowVersion: (editing as PartyContact).rowVersion }),
    editing === 'new' ? 'Contact added' : 'Contact saved');
  const remove = () => {
    const c = toDelete;
    setToDelete(null);
    if (c) run(() => deleteContact(partyCode, c.contactId, c.rowVersion), 'Contact deleted');
  };

  const err = (name: keyof Draft) => error?.forField(name);
  const text = (name: keyof Draft, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field label={label} error={err(name)}>
      <input className={`gecko-input${err(name) ? ' gecko-input-error' : ''}`} value={(draft[name] as string | null) ?? ''}
        onChange={e => setDraft({ ...draft, [name]: e.target.value || null })} {...props} />
    </Field>
  );
  const stale = error?.status === 409;

  return (
    <div className="gecko-table-card">
      <div className="gecko-row gecko-row-between gecko-card-padded">
        <strong>Contacts</strong>
        {canEdit && !editing && (
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => open('new')}><Icon name="plus" size={14} /> Add contact</button>
        )}
      </div>

      {editing && (
        <div className="gecko-card-padded gecko-stack gecko-stack-md">
          {error && (
            <div role="alert" className="gecko-alert gecko-alert-error">
              {stale ? 'Someone else changed this contact. Cancel, and open it again to see their change.'
                : Object.keys(error.fieldErrors).length > 0 ? 'Some values were refused — see the marked fields.' : error.message}
            </div>
          )}
          <FormGrid columns={3}>
            <Field label="Role" required error={err('contactType')}>
              <select className="gecko-select" value={draft.contactType} onChange={e => setDraft({ ...draft, contactType: e.target.value })}>
                {CONTACT_ROLES.map(r => <option key={r} value={r}>{humanize(r)}</option>)}
              </select>
            </Field>
            {text('contactPerson', 'Name', { maxLength: 200 })}
            {text('jobTitle', 'Job title', { maxLength: 100 })}
            {text('phone', 'Phone', { maxLength: 50, type: 'tel' })}
            {text('mobile', 'Mobile', { maxLength: 50, type: 'tel' })}
            {text('email', 'E-mail', { maxLength: 255, type: 'email' })}
            {text('address1', 'Address', { maxLength: 255 })}
            {text('address2', 'Address line 2', { maxLength: 255 })}
            {text('city', 'City / District', { maxLength: 100 })}
            {text('state', 'Province', { maxLength: 100 })}
            {text('postcode', 'Postcode', { maxLength: 25 })}
            <Field label="Default" helper="The one used for this role, e.g. on tax invoices">
              <label className="gecko-row gecko-mt-2">
                <input type="checkbox" className="gecko-checkbox" checked={draft.isDefault} onChange={e => setDraft({ ...draft, isDefault: e.target.checked })} />
                <span>Default {humanize(draft.contactType).toLowerCase()} contact</span>
              </label>
            </Field>
          </FormGrid>
          <div className="gecko-row gecko-row-right">
            <button className="gecko-btn gecko-btn-outline" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
            <button className="gecko-btn gecko-btn-primary" onClick={save} disabled={busy}><Icon name="save" size={16} /> {busy ? 'Saving…' : 'Save contact'}</button>
          </div>
        </div>
      )}
      {!editing && error && <div role="alert" className="gecko-alert gecko-alert-error">{error.message}</div>}

      <table className="gecko-table">
        <thead>
          <tr><th>Name</th><th>Role</th><th>Job title</th><th>Phone</th><th>Mobile</th><th>E-mail</th><th>Address</th>{canEdit && <th aria-label="Actions" />}</tr>
        </thead>
        <tbody>
          {contacts.length === 0 && <tr><td colSpan={canEdit ? 8 : 7} className="gecko-cell-meta">No contacts on file.</td></tr>}
          {contacts.map(c => (
            <tr key={c.contactId}>
              <td>{c.name ?? '—'}{c.isDefault && <> <span className="gecko-badge gecko-badge-xs">Default</span></>}</td>
              <td>{humanize(c.role)}</td>
              <td>{c.jobTitle ?? '—'}</td>
              <td className="gecko-text-mono">{c.phone ?? '—'}</td>
              <td className="gecko-text-mono">{c.mobile ?? '—'}</td>
              <td>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : '—'}</td>
              <td>{[c.address1, c.address2, c.city, c.state, c.postcode].filter(Boolean).join(', ') || '—'}</td>
              {canEdit && (
                <td>
                  <div className="gecko-row">
                    <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" aria-label={`Edit contact ${c.name ?? c.role}`} onClick={() => open(c)} disabled={!!editing || busy}><Icon name="edit" size={14} /></button>
                    <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" aria-label={`Delete contact ${c.name ?? c.role}`} onClick={() => setToDelete(c)} disabled={!!editing || busy}><Icon name="trash" size={14} /></button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmDialog isOpen={!!toDelete} onClose={() => setToDelete(null)} onConfirm={remove} variant="danger"
        title="Delete this contact?" message={`${toDelete?.name ?? humanize(toDelete?.role ?? '')} is removed from ${partyCode}; the history keeps it.`}
        confirmLabel="Delete contact" />
    </div>
  );
}
