"use client";
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';

interface DeleteConfirmModalProps {
  /** Label shown in the header, e.g. "Delete Booking" */
  title?: string;
  /** Kind of entity, e.g. "Booking", "Customer". Used in default title and button label. */
  resourceType: string;
  /** The exact string the user must re-type to unlock the Delete button (booking no, customer code, etc.) */
  resourceName: string;
  /** Optional bullet list describing what will be permanently removed */
  consequences?: string[];
  onClose: () => void;
  /** Receives the deletion remarks the user typed */
  onConfirm: (remarks: string) => void;
}

export function DeleteConfirmModal({
  title,
  resourceType,
  resourceName,
  consequences = [],
  onClose,
  onConfirm,
}: DeleteConfirmModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [remarks, setRemarks] = useState('');
  const canDelete = confirmText === resourceName && remarks.trim().length > 0;
  const heading = title ?? `Delete ${resourceType}`;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9000, backdropFilter: 'blur(2px)' }}
      />

      {/* Dialog — flex column so footer always sticks to bottom */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 9001, width: 480,
        maxHeight: 'calc(100vh - 80px)',
        background: 'var(--gecko-bg-surface)',
        borderRadius: 14, boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
        border: '1px solid var(--gecko-danger-200)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>

        {/* Header — fixed */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--gecko-border)', display: 'flex', alignItems: 'flex-start', gap: 14, flexShrink: 0 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'var(--gecko-danger-50)', border: '1px solid var(--gecko-danger-200)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
          }}>
            <Icon name="trash" size={18} style={{ color: 'var(--gecko-danger-600)' }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gecko-text-primary)', marginBottom: 4 }}>{heading}</div>
            <div style={{ fontSize: 12.5, color: 'var(--gecko-text-secondary)', lineHeight: 1.5 }}>
              This action is{' '}
              <strong style={{ color: 'var(--gecko-danger-700)' }}>permanent and cannot be undone.</strong>
              {consequences.length > 0 && ' The following will be permanently removed:'}
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* Consequences */}
          {(consequences.length > 0 || resourceName) && (
            <div style={{ padding: '14px 24px', background: 'var(--gecko-danger-50)', borderBottom: '1px solid var(--gecko-danger-100)' }}>
              <div style={{
                fontSize: 12, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)',
                color: 'var(--gecko-danger-700)', marginBottom: consequences.length > 0 ? 8 : 0,
              }}>
                {resourceName}
              </div>
              {consequences.length > 0 && (
                <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {consequences.map(item => (
                    <li key={item} style={{ fontSize: 12, color: 'var(--gecko-danger-700)', lineHeight: 1.5 }}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Form fields */}
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Remarks */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-text-primary)', display: 'block', marginBottom: 6 }}>
                Deletion remarks <span style={{ color: 'var(--gecko-danger-600)' }}>*</span>
              </label>
              <textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder={`State the reason for deleting this ${resourceType.toLowerCase()}…`}
                rows={3}
                style={{
                  width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 12.5,
                  padding: '9px 12px', borderRadius: 7, border: '1.5px solid var(--gecko-border)',
                  background: 'var(--gecko-bg-surface)', color: 'var(--gecko-text-primary)',
                  outline: 'none', boxSizing: 'border-box', lineHeight: 1.5,
                }}
              />
            </div>

            {/* Confirm by typing */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-text-primary)', display: 'block', marginBottom: 6 }}>
                To confirm, type{' '}
                <span style={{
                  fontFamily: 'var(--gecko-font-mono)', background: 'var(--gecko-bg-subtle)',
                  padding: '1px 6px', borderRadius: 4, border: '1px solid var(--gecko-border)', fontSize: 11.5,
                }}>
                  {resourceName}
                </span>{' '}
                below
              </label>
              <input
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder={resourceName}
                style={{
                  width: '100%', fontFamily: 'var(--gecko-font-mono)', fontSize: 12.5,
                  padding: '9px 12px', borderRadius: 7,
                  border: `1.5px solid ${confirmText && confirmText !== resourceName ? 'var(--gecko-danger-400)' : 'var(--gecko-border)'}`,
                  background: 'var(--gecko-bg-surface)', color: 'var(--gecko-text-primary)',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer — always visible, never scrolls away */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--gecko-border)',
          background: 'var(--gecko-bg-subtle)',
          display: 'flex', gap: 10, justifyContent: 'flex-end',
          flexShrink: 0,
        }}>
          <button onClick={onClose} className="gecko-btn gecko-btn-outline gecko-btn-sm" style={{ minWidth: 90 }}>
            Cancel
          </button>
          <button
            disabled={!canDelete}
            onClick={() => canDelete && onConfirm(remarks)}
            style={{
              minWidth: 160, padding: '8px 16px', borderRadius: 7,
              border: '1.5px solid #b91c1c',
              cursor: canDelete ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'center',
              background: canDelete ? '#dc2626' : 'transparent',
              color: canDelete ? '#fff' : '#dc2626',
              opacity: canDelete ? 1 : 0.45,
              transition: 'background 150ms, opacity 150ms',
            }}
          >
            <Icon name="trash" size={14} /> Delete {resourceType}
          </button>
        </div>
      </div>
    </>
  );
}
