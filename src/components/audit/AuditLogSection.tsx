"use client";
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { AuditLog } from './AuditLog';

/**
 * A collapsible "Audit log" card under a record. Closed by default: the trail
 * is read only when someone opens it, and read again when `refreshKey`
 * changes while it is open.
 */
export function AuditLogSection({ path, refreshKey, showRef, lineDiff, title = 'Audit log' }: {
  /** Null while the record is not known yet — the section then does not render. */
  path: string | null;
  refreshKey?: unknown;
  showRef?: boolean;
  /** "+ …" / "− …" for added / removed lines (master and tariff trails). */
  lineDiff?: boolean;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  if (!path) return null;

  return (
    <section className="gecko-card gecko-audit-section gecko-no-print">
      <button type="button" className="gecko-audit-section-head" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <Icon name="clock" size={14} />
        <span className="gecko-audit-section-title">{title}</span>
        {count !== null && <span className="gecko-audit-section-count">{count}</span>}
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={14} className="gecko-audit-section-chevron" />
      </button>
      {open && (
        <div className="gecko-audit-section-body">
          <AuditLog path={path} refreshKey={refreshKey} showRef={showRef} lineDiff={lineDiff} onCount={setCount} />
        </div>
      )}
    </section>
  );
}
