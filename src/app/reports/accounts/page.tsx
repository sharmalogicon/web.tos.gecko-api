"use client";
import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { ReportCard } from '@/components/reports/ReportCard';
import { ReportParamsDrawer } from '@/components/reports/ReportParamsDrawer';
import {
  ACCOUNTS_REPORTS, groupReports,
  type ReportDef,
} from '@/lib/reports-catalog';
import type { ParamValues } from '@/components/reports/ReportParamsDrawer';
import { useFacility } from '@/lib/api/facility';
import { ApiError } from '@/lib/api/problem';
import { downloadReport, missingRequired, rangeTooLong, RANGE_LIMIT_DAYS } from '@/lib/api/report-documents';

export default function AccountsReportsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [activeReport, setActiveReport] = useState<ReportDef | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ message: string; field?: string } | null>(null);
  const { branch } = useFacility();
  const branchId = branch?.branchId ?? '';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ACCOUNTS_REPORTS;
    return ACCOUNTS_REPORTS.filter(r =>
      r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
  }, [search]);

  const grouped = useMemo(() => groupReports(filtered), [filtered]);
  const groupOrder = ['Sales Reports', 'Accounting Reports'] as const;

  /**
   * Run it, or say plainly that it cannot be run.
   *
   * This used to toast "PDF queued. Download starts when generation completes."
   * for all of them, which was simply untrue — nothing was queued and nothing
   * ever arrived. On a live cutover that is the worst kind of bug: the clerk
   * believes it worked and waits.
   */
  const onGenerate = async (r: ReportDef, vals: ParamValues, format: 'pdf' | 'xlsx') => {
    // A report the API renders wins over any `live` screen: two of the cash
    // receipt cards keep their link to /reports/accounts-api as well.
    if (r.document) {
      const bag = vals as unknown as Record<string, string>;
      const missing = missingRequired(r, bag);
      if (missing.length > 0) {
        setProblem({ message: 'This report needs a date range.', field: missing[0] });
        return;
      }
      if (rangeTooLong(vals.dateFrom, vals.dateTo)) {
        setProblem({ message: `The range is longer than ${RANGE_LIMIT_DAYS} days, which the API refuses.`, field: 'dateTo' });
        return;
      }
      setBusy(true);
      setProblem(null);
      try {
        await downloadReport(r, format, branchId, {
          ...bag,
          /**
           * The accounting endpoints want the two halves of Type — Size apart:
           * `size=40` and `type=HC`. The drawer's second select holds a whole
           * equipment typeCode (`40HC`, `20RF`), so the size prefix comes off.
           * The operational reports take the typeCode whole and are untouched.
           */
          type: (vals.type ?? '').replace(/^\d+/, ''),
        });
        toast({ variant: 'success', title: `${r.title} ready`, message: `Downloaded as ${format.toUpperCase()}.` });
        setActiveReport(null);
      } catch (e) {
        const err = e instanceof ApiError ? e : null;
        setProblem({
          message: err?.status === 403
            ? 'That depot is not one you cover.'
            : err?.status === 404
              ? 'That depot is not known.'
              : err?.explanation ?? err?.message ?? 'The report could not be generated.',
        });
      } finally {
        setBusy(false);
      }
      return;
    }
    if (r.live) {
      router.push(r.live);
      setActiveReport(null);
      return;
    }
    toast({
      variant: 'warning',
      title: `${r.title} is not available yet`,
      message: 'This report has no query behind it in Gecko yet. It is listed so nothing from the desktop goes missing.',
    });
  };

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 40 }}>

      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline" style={{ gap: 12 }}>
            <h1 className="gecko-page-title">Accounts Reports</h1>
            <span className="gecko-count-badge">{ACCOUNTS_REPORTS.length} reports</span>
          </div>
          <p className="gecko-page-subtitle" style={{ marginTop: 4 }}>
            Sales, billing, accounting and tax reports for finance and management.
          </p>
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
        busy={busy}
        problem={problem}
        onClose={() => { setActiveReport(null); setProblem(null); }}
        onGenerate={(r, v, f) => void onGenerate(r, v, f)}
      />
    </div>
  );
}
