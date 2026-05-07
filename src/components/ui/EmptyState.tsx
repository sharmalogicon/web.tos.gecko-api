"use client";
import React from 'react';
import { Icon } from '@/components/ui/Icon';

interface EmptyStateProps {
  /** Icon glyph name (from the gecko Icon set), e.g. "search", "inbox". */
  icon?: string;
  /** Headline text, e.g. "No results found". */
  title: string;
  /** Sub-text below the title. */
  description?: React.ReactNode;
  /** Optional action element (button, link, etc.) rendered under the description. */
  action?: React.ReactNode;
  /** Extra class on the outer container (e.g. for compact list-row variant). */
  className?: string;
}

/**
 * Empty-state placeholder for tables, lists, and search results that returned
 * zero rows. Pure design-system classes — no inline colours.
 *
 * Usage:
 *   <EmptyState
 *     icon="search"
 *     title="No bookings found"
 *     description="Try adjusting your filters or clear the search query."
 *     action={<button className="gecko-btn gecko-btn-outline gecko-btn-sm">Clear filters</button>}
 *   />
 */
export function EmptyState({
  icon = 'clipboardList',
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`gecko-empty-state ${className}`.trim()}>
      <div className="gecko-empty-state-icon">
        <Icon name={icon} size={28} />
      </div>
      <div className="gecko-empty-state-title">{title}</div>
      {description && (
        <div className="gecko-empty-state-description">{description}</div>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
