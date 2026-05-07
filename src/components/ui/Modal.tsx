"use client";
import React, { useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

interface ModalProps {
  /** Controls visibility. Parent owns this state. */
  isOpen: boolean;
  /** Called when the user clicks the backdrop, presses Esc, or hits the ✕. */
  onClose: () => void;
  /** Optional title shown in the header. Omit to render header-less. */
  title?: React.ReactNode;
  /** Optional sub-title rendered below the title. */
  subtitle?: React.ReactNode;
  /** sm 400px (default) · md 520px · lg 720px · xl 960px. */
  size?: ModalSize;
  /** Optional extra class on the inner .gecko-modal element. */
  className?: string;
  /** When false the backdrop click does NOT close the modal. Default true. */
  closeOnBackdrop?: boolean;
  /** When false the Esc key does NOT close the modal. Default true. */
  closeOnEsc?: boolean;
  /** Body content. */
  children: React.ReactNode;
  /** Optional footer rendered inside .gecko-modal-footer. */
  footer?: React.ReactNode;
}

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: 'gecko-modal-sm',
  md: '',
  lg: 'gecko-modal-lg',
  xl: 'gecko-modal-xl',
};

/**
 * Generic modal wrapper around the .gecko-overlay + .gecko-modal classes.
 * No theme colours — all styling lives in gecko_design_system_components.css.
 *
 * Use the `variant` props on inner elements (or use <ConfirmDialog>) to get
 * danger / warning / info presentations.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  size = 'md',
  className = '',
  closeOnBackdrop = true,
  closeOnEsc = true,
  children,
  footer,
}: ModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen || !closeOnEsc) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, closeOnEsc, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="gecko-overlay"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className={`gecko-modal ${SIZE_CLASS[size]} ${className}`.trim()}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {title !== undefined && (
          <div className="gecko-modal-header">
            <div>
              <div className="gecko-modal-title">{title}</div>
              {subtitle && <div className="gecko-modal-description">{subtitle}</div>}
            </div>
            <button
              className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm"
              onClick={onClose}
              aria-label="Close"
              type="button"
            >
              <Icon name="x" size={16} />
            </button>
          </div>
        )}

        <div className="gecko-modal-body">{children}</div>

        {footer && <div className="gecko-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
