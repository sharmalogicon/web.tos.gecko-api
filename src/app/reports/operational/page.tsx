"use client";
import React, { useState, useMemo } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { ReportCard } from '@/components/reports/ReportCard';
import { ReportParamsDrawer } from '@/components/reports/ReportParamsDrawer';
import {
  OPERATIONAL_REPORTS, groupReports,
  type ReportDef,
} from '@/lib/reports-catalog';

export default function OperationalReportsPage() {
  const { toast } = useToast();
  const [activeReport, setActiveReport] = useState<ReportDef | null>(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return OPERATIONAL_REPORTS;
    return OPERATIONAL_REPORTS.filter(r =>
      r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
  }, [search]);

  const grouped = useMemo(() => groupReports(filtered), [filtered]);
  const groupOrder = ['Out-Bound Reports', 'In-Bound Reports', 'Customer-Service Reports'] as const;

  const onGenerate = (r: ReportDef) => {
    toast({
      variant: 'success',
      title: 'Report generated',
      message: `${r.title} — PDF queued. Download starts when generation completes.`,
    });
    setActiveReport(null);
  };

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 40 }}>

      {/* Header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>Operational Reports</h1>
            <span className="gecko-count-badge">{OPERATIONAL_REPORTS.length} reports</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>
            Day-to-day depot operation reports — yard inventory, gate movements, customer-service exports.
          </div>
        </div>
        <div className="gecko-toolbar">
          <div style={{ position: 'relative' }}>
            <Icon name="search" size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-text-disabled)', pointerEvents: 'none' }} />
            <input
              className="gecko-input gecko-input-sm"
              placeholder="Search reports…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 32, width: 240 }}
            />
          </div>
        </div>
      </div>

      {/* Grouped report cards */}
      {groupOrder.map(group => {
        const items = grouped[group];
        if (!items || items.length === 0) return null;
        return (
          <section key={group}>
            <div className="gecko-report-group-header">
              {group}
              <span style={{ marginLeft: 8, fontWeight: 500, color: 'var(--gecko-text-disabled)' }}>· {items.length}</span>
            </div>
            <div className="gecko-report-card-grid">
              {items.map(r => (
                <ReportCard key={r.id} report={r} onRun={() => setActiveReport(r)} />
              ))}
            </div>
          </section>
        );
      })}

      {filtered.length === 0 && (
        <div className="gecko-empty-state" style={{ padding: 48 }}>
          <Icon name="search" size={28} className="gecko-empty-state-icon" />
          <div className="gecko-empty-state-title">No reports match &ldquo;{search}&rdquo;</div>
          <div className="gecko-empty-state-description">Try a different keyword or clear the search.</div>
        </div>
      )}

      <ReportParamsDrawer
        report={activeReport}
        onClose={() => setActiveReport(null)}
        onGenerate={onGenerate}
      />
    </div>
  );
}
