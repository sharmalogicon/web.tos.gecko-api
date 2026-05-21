"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '../ui/Icon';

/* ──────────────────────────────────────────────────────────────────────────
   Send-to-Invoice — shared dropdown menu + new/existing invoice modals.

   Used by /billing/unbilled (bulk send selected bookings) and
   /billing/statement/[id] (bulk send selected charges from one statement).

   The caller owns:
     - selection state (count + total)
     - what gets included per term (e.g. only CASH charges go to a Cash invoice)
     - confirmation handlers (which receive the chosen term + invoice-no)
   ────────────────────────────────────────────────────────────────────────── */

export type SendInvoicePaymentTerm = 'CASH' | 'CREDIT';

export type SendAction =
  | { kind: 'new'; term: SendInvoicePaymentTerm }
  | { kind: 'existing'; term: SendInvoicePaymentTerm };

const fmtTHB = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ── Dropdown menu ──────────────────────────────────────────────────────── */

export function SendToInvoiceMenu({ disabled, onPick, label = 'Send to Invoice', size = 'md' }: {
  disabled: boolean;
  onPick: (a: SendAction) => void;
  label?: string;
  size?: 'sm' | 'md';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, []);

  const btnClass = size === 'sm' ? 'gecko-btn gecko-btn-primary gecko-btn-sm' : 'gecko-btn gecko-btn-primary';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`${btnClass} gecko-inline-row`}
      >
        <Icon name="send" size={size === 'sm' ? 13 : 14} />
        {label}
        <Icon name="chevronDown" size={12} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 6px)', width: 280,
          background: 'var(--gecko-bg-surface)',
          border: '1px solid var(--gecko-border)', borderRadius: 10,
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.16)',
          zIndex: 200, overflow: 'hidden',
        }}>
          <MenuSection label="Create new invoice">
            <MenuItem icon="plus" label="New Cash invoice"   sub="For pymt term = CASH"   onClick={() => { setOpen(false); onPick({ kind: 'new', term: 'CASH' }); }} />
            <MenuItem icon="plus" label="New Credit invoice" sub="For pymt term = CREDIT" onClick={() => { setOpen(false); onPick({ kind: 'new', term: 'CREDIT' }); }} />
          </MenuSection>
          <MenuSection label="Add to existing invoice">
            <MenuItem icon="link" label="Existing Cash invoice"   sub="Prompts for invoice number" onClick={() => { setOpen(false); onPick({ kind: 'existing', term: 'CASH' }); }} />
            <MenuItem icon="link" label="Existing Credit invoice" sub="Prompts for invoice number" onClick={() => { setOpen(false); onPick({ kind: 'existing', term: 'CREDIT' }); }} />
          </MenuSection>
        </div>
      )}
    </div>
  );
}

function MenuSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '6px 0', borderBottom: '1px solid var(--gecko-border)' }}>
      <div style={{ padding: '6px 14px 4px', fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-disabled)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      {children}
    </div>
  );
}

function MenuItem({ icon, label, sub, onClick }: { icon: string; label: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="gecko-row"
      style={{
        width: '100%', padding: '8px 14px',
        background: 'transparent', border: 'none', cursor: 'pointer',
        textAlign: 'left', fontFamily: 'inherit',
        gap: 10,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--gecko-bg-subtle)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--gecko-primary-50)', color: 'var(--gecko-primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={13} />
      </div>
      <div className="gecko-flex-1">
        <div className="gecko-cell-primary">{label}</div>
        <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', marginTop: 1 }}>{sub}</div>
      </div>
    </button>
  );
}

/* ── New-invoice modal ──────────────────────────────────────────────────── */

export function NewInvoiceModal({ open, action, lineCount, lineLabel = 'lines', total, onCancel, onConfirm }: {
  open: boolean;
  action: { term: SendInvoicePaymentTerm } | null;
  lineCount: number;
  lineLabel?: string;
  total: number;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState('');
  if (!open || !action) return null;
  const draftInvoiceNo = `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000 + 1000))}`;
  return (
    <ModalShell onClose={onCancel} title="Create new invoice" subtitle={`A draft ${action.term.toLowerCase()} invoice will be created with the selected items.`}>
      <div className="gecko-grid-2" style={{ marginBottom: 14 }}>
        <ReadonlyField label="Draft invoice no." value={draftInvoiceNo} mono />
        <ReadonlyField label="Payment term" value={action.term} />
        <ReadonlyField label={`${lineLabel} included`} value={String(lineCount)} />
        <ReadonlyField label="Total (excl. VAT)" value={`฿${fmtTHB(total)}`} mono bold />
      </div>
      <div className="gecko-field">
        <div className="gecko-field-label">Cover note (optional)</div>
        <textarea
          className="gecko-textarea"
          rows={2}
          placeholder="e.g. Monthly statement attached"
          value={note}
          onChange={e => setNote(e.target.value)}
        />
      </div>
      <div className="gecko-row gecko-row-start" style={{ marginTop: 16, padding: 10, background: 'var(--gecko-info-50)', border: '1px solid var(--gecko-info-200)', borderRadius: 8, fontSize: 11, color: 'var(--gecko-info-700)' }}>
        <Icon name="info" size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>Only items with <strong>payment term = {action.term}</strong> from the current selection will be included. Other-term items remain unbilled.</div>
      </div>
      <ModalFooter>
        <button className="gecko-btn gecko-btn-outline" onClick={onCancel}>Cancel</button>
        <button className="gecko-btn gecko-btn-primary" onClick={() => onConfirm(note)}>
          <Icon name="check" size={14} /> Create draft invoice
        </button>
      </ModalFooter>
    </ModalShell>
  );
}

/* ── Existing-invoice modal ─────────────────────────────────────────────── */

export function ExistingInvoiceModal({ open, action, lineCount, lineLabel = 'lines', total, onCancel, onConfirm }: {
  open: boolean;
  action: { term: SendInvoicePaymentTerm } | null;
  lineCount: number;
  lineLabel?: string;
  total: number;
  onCancel: () => void;
  onConfirm: (invoiceNo: string) => void;
}) {
  const [invoiceNo, setInvoiceNo] = useState('');
  const [touched, setTouched] = useState(false);
  if (!open || !action) return null;

  const valid = /^INV-\d{4}-\d{3,5}$/i.test(invoiceNo.trim());
  return (
    <ModalShell onClose={onCancel} title="Add to existing invoice" subtitle={`Selected items will be appended to an existing ${action.term.toLowerCase()} invoice.`}>
      <div className="gecko-field" style={{ marginBottom: 12 }}>
        <div className="gecko-field-label gecko-field-required">Invoice number</div>
        <input
          className="gecko-input"
          placeholder="INV-2026-0173"
          value={invoiceNo}
          onChange={e => { setInvoiceNo(e.target.value.toUpperCase()); setTouched(true); }}
          onBlur={() => setTouched(true)}
          style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }}
        />
        {touched && invoiceNo && !valid && (
          <div className="gecko-field-error" style={{ marginTop: 4, fontSize: 11 }}>
            Expected format: INV-YYYY-NNNN
          </div>
        )}
        <div className="gecko-field-helper" style={{ marginTop: 4 }}>
          The invoice must be in <strong>Draft</strong> state and use payment term <strong>{action.term}</strong>.
        </div>
      </div>

      <div className="gecko-grid-2">
        <ReadonlyField label="Payment term" value={action.term} />
        <ReadonlyField label={`${lineLabel} to add`} value={String(lineCount)} />
        <ReadonlyField label="Filter" value={`${action.term}-only`} />
        <ReadonlyField label="Total to append" value={`฿${fmtTHB(total)}`} mono bold />
      </div>

      <ModalFooter>
        <button className="gecko-btn gecko-btn-outline" onClick={onCancel}>Cancel</button>
        <button className="gecko-btn gecko-btn-primary" onClick={() => onConfirm(invoiceNo.trim())} disabled={!valid}>
          <Icon name="link" size={14} /> Append to {invoiceNo || 'invoice'}
        </button>
      </ModalFooter>
    </ModalShell>
  );
}

/* ── Internals ──────────────────────────────────────────────────────────── */

function ModalShell({ children, title, subtitle, onClose }: {
  children: React.ReactNode; title: string; subtitle: string; onClose: () => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.5)' }} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 'min(560px, 92vw)',
        background: 'var(--gecko-bg-surface)',
        border: '1px solid var(--gecko-border)', borderRadius: 14,
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.32)',
        overflow: 'hidden',
      }}>
        <div className="gecko-row" style={{ padding: '16px 20px', borderBottom: '1px solid var(--gecko-border)', gap: 10 }}>
          <Icon name="send" size={16} style={{ color: 'var(--gecko-primary-600)' }} />
          <div className="gecko-flex-1">
            <div className="gecko-drawer-title">{title}</div>
            <div className="gecko-drawer-subtitle">{subtitle}</div>
          </div>
          <button onClick={onClose} className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon">
            <Icon name="x" size={14} />
          </button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="gecko-action-toolbar" style={{ marginTop: 18 }}>
      {children}
    </div>
  );
}

function ReadonlyField({ label, value, mono, bold }: { label: string; value: string; mono?: boolean; bold?: boolean }) {
  return (
    <div>
      <div className="gecko-field-label gecko-mb-1">{label}</div>
      <div style={{
        padding: '8px 12px', background: 'var(--gecko-bg-subtle)',
        border: '1px solid var(--gecko-border)', borderRadius: 6,
        fontSize: 13, fontWeight: bold ? 800 : 600,
        fontFamily: mono ? 'var(--gecko-font-mono)' : 'inherit',
        color: 'var(--gecko-text-primary)',
      }}>{value}</div>
    </div>
  );
}
