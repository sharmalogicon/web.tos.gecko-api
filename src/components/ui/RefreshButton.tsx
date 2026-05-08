"use client";
import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';

type Variant = 'ghost' | 'outline' | 'primary';

interface RefreshButtonProps {
  /** Button label. Default "Refresh". */
  label?: string;
  /** Resource being refreshed — appears in the toast (e.g. "Bookings"). */
  resource?: string;
  variant?: Variant;
  /** Icon size in px. Default 14. */
  iconSize?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Optional callback fired before the toast — use to trigger real refetch. */
  onRefresh?: () => void;
}

/**
 * Standard "Refresh" button. Fires an info toast confirming the action.
 * When the data layer exists, swap the toast call for the real refetch
 * trigger — every page using <RefreshButton> updates automatically.
 */
export function RefreshButton({
  label = 'Refresh',
  resource,
  variant = 'outline',
  iconSize = 14,
  className = '',
  style,
  onRefresh,
}: RefreshButtonProps) {
  const { toast } = useToast();

  const handleClick = () => {
    onRefresh?.();
    toast({
      variant: 'info',
      title: 'Refreshed',
      message: resource
        ? `${resource} reloaded with the latest data.`
        : 'Latest data loaded.',
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`gecko-btn gecko-btn-${variant} gecko-btn-sm ${className}`.trim()}
      style={style}
    >
      <Icon name="refreshCcw" size={iconSize} /> {label}
    </button>
  );
}
