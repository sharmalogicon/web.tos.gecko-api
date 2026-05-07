"use client";
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';

interface DeleteConfirmModalProps {
  /** Optional override for the heading. Defaults to "Delete {resourceType}". */
  title?: string;
  /** Kind of entity being deleted, e.g. "Booking", "Customer". Used in default
   *  title and confirm-button label. */
  resourceType: string;
  /** The exact string the user must re-type to unlock the Delete button
   *  (booking number, customer code, container ISO, …). */
  resourceName: string;
  /** Optional bullet list describing what will be permanently removed. */
  consequences?: string[];
  onClose: () => void;
  /** Receives the deletion-remark text the user typed. */
  onConfirm: (remarks: string) => void;
}

/**
 * GitHub / Vercel-style destructive confirmation dialog.
 * Two unlock conditions: typed resourceName matches AND remarks are non-empty.
 *
 * Styling lives entirely in gecko_design_system_components.css under the
 * 5.11 MODAL section. This component is a thin wrapper — no inline colours.
 */
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
    <div className="gecko-overlay" onClick={onClose}>
      <div
        className="gecko-modal gecko-modal-sm"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gecko-delete-title"
      >
        {/* ── Header ── */}
        <div className="gecko-modal-header gecko-modal-header-danger">
          <span className="gecko-modal-icon">
            <Icon name="trash" size={18} />
          </span>
          <div>
            <div id="gecko-delete-title" className="gecko-modal-title">{heading}</div>
            <div className="gecko-modal-description">
              This action is <strong>permanent and cannot be undone.</strong>
              {consequences.length > 0 && ' The following will be permanently removed:'}
            </div>
          </div>
        </div>

        {/* ── Consequences strip ── */}
        {(consequences.length > 0 || resourceName) && (
          <div className="gecko-modal-consequences">
            <div className="gecko-modal-consequences-resource">{resourceName}</div>
            {consequences.length > 0 && (
              <ul className="gecko-modal-consequences-list">
                {consequences.map(item => <li key={item}>{item}</li>)}
              </ul>
            )}
          </div>
        )}

        {/* ── Form body ── */}
        <div className="gecko-modal-body">
          <div className="gecko-modal-body-stack">

            {/* Deletion remarks (required) */}
            <div className="gecko-form-group">
              <label className="gecko-label gecko-label-required">Deletion remarks</label>
              <textarea
                className="gecko-textarea"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder={`State the reason for deleting this ${resourceType.toLowerCase()}…`}
                rows={3}
              />
            </div>

            {/* Type-to-confirm */}
            <div className="gecko-form-group">
              <label className="gecko-label">
                To confirm, type{' '}
                <code className="gecko-code">{resourceName}</code>{' '}
                below
              </label>
              <input
                className={`gecko-input gecko-text-mono ${confirmText && confirmText !== resourceName ? 'gecko-input-error' : ''}`}
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder={resourceName}
              />
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="gecko-modal-footer">
          <button onClick={onClose} className="gecko-btn gecko-btn-outline gecko-btn-sm">
            Cancel
          </button>
          <button
            disabled={!canDelete}
            onClick={() => canDelete && onConfirm(remarks)}
            className="gecko-btn gecko-btn-danger gecko-btn-sm"
          >
            <Icon name="trash" size={14} /> Delete {resourceType}
          </button>
        </div>
      </div>
    </div>
  );
}
