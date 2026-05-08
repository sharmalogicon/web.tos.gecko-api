"use client";
import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';

type Variant = 'ghost' | 'outline' | 'primary';

interface ExportButtonProps {
  /** Button label. Default "Export". Use for variants like "Export Selected", "Export CSV". */
  label?: string;
  /** Resource being exported — appears in the toast (e.g. "bookings", "containers"). */
  resource?: string;
  /** gecko-btn variant. Default "ghost". */
  variant?: Variant;
  /** Icon size in px. Default 14. */
  iconSize?: number;
  /** Extra class on the button (e.g. font-size override). */
  className?: string;
  /** Inline style passthrough. */
  style?: React.CSSProperties;
  /** Optional callback fired before the toast — use to trigger real export work. */
  onExport?: () => void;
}

/**
 * Standard "Export" / "Download" button. Renders the gecko-btn primitive
 * and fires a toast when clicked. Until the API layer is in place, every
 * Export across the app gives the user the same feedback.
 *
 * When the export endpoint exists, swap the toast call here for the real
 * download trigger — every page updates automatically.
 */
export function ExportButton({
  label = 'Export',
  resource,
  variant = 'ghost',
  iconSize = 14,
  className = '',
  style,
  onExport,
}: ExportButtonProps) {
  const { toast } = useToast();

  const handleClick = () => {
    onExport?.();
    toast({
      variant: 'info',
      title: 'Export queued',
      message: resource
        ? `${resource} export will be ready shortly.`
        : 'File will be ready shortly.',
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`gecko-btn gecko-btn-${variant} gecko-btn-sm ${className}`.trim()}
      style={style}
    >
      <Icon name="download" size={iconSize} /> {label}
    </button>
  );
}
