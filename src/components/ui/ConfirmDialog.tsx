"use client";
import React, { useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';

export type ConfirmVariant = 'danger' | 'warning' | 'info';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** Visual + button-colour variant. Default warning. */
  variant?: ConfirmVariant;
  /** Heading text, e.g. "Cancel Booking?". */
  title: string;
  /** Body text shown under the title. Can be a string or rich JSX. */
  message: React.ReactNode;
  /** Label for the confirm button. Default "Confirm". */
  confirmLabel?: string;
  /** Label for the cancel button. Default "Cancel". */
  cancelLabel?: string;
  /** Optional bullet list of consequences shown in the warning strip. */
  consequences?: string[];
}

const VARIANT_META: Record<ConfirmVariant, { headerClass: string; btnClass: string; icon: string }> = {
  danger:  { headerClass: 'gecko-modal-header-danger',  btnClass: 'gecko-btn-danger',  icon: 'alertTriangle' },
  warning: { headerClass: 'gecko-modal-header-warning', btnClass: 'gecko-btn-warning', icon: 'alertTriangle' },
  info:    { headerClass: 'gecko-modal-header-info',    btnClass: 'gecko-btn-primary', icon: 'info'          },
};

/**
 * One-click confirmation dialog (no type-to-confirm). Use this for reversible
 * cautious actions: Cancel Booking, Void Invoice, Regenerate Statement,
 * Discard Draft, etc. For permanent destructive actions where typing the
 * resource name is appropriate, use <DeleteConfirmModal> instead.
 *
 * Pure CSS-class component — no inline colour values.
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  variant = 'warning',
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  consequences = [],
}: ConfirmDialogProps) {
  const meta = VARIANT_META[variant];

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="gecko-overlay" onClick={onClose}>
      <div
        className="gecko-modal gecko-modal-sm"
        onClick={e => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
      >
        {/* Header with variant-coloured icon */}
        <div className={`gecko-modal-header ${meta.headerClass}`}>
          <span className="gecko-modal-icon">
            <Icon name={meta.icon} size={18} />
          </span>
          <div>
            <div className="gecko-modal-title">{title}</div>
            <div className="gecko-modal-description">{message}</div>
          </div>
        </div>

        {/* Optional consequences strip */}
        {consequences.length > 0 && (
          <div className="gecko-modal-consequences">
            <ul className="gecko-modal-consequences-list">
              {consequences.map(item => <li key={item}>{item}</li>)}
            </ul>
          </div>
        )}

        {/* Footer */}
        <div className="gecko-modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="gecko-btn gecko-btn-outline gecko-btn-sm"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => { onConfirm(); }}
            className={`gecko-btn ${meta.btnClass} gecko-btn-sm`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
