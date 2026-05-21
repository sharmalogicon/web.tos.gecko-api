"use client";
import React, { useState, useMemo } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import {
  SEEDED_SCHEDULES,
  OPERATIONAL_REPORTS, ACCOUNTS_REPORTS,
  type AutoScheduledReport, type ScheduleFrequency, type ReportDef,
} from '@/lib/reports-catalog';

const FREQ_LABEL: Record<ScheduleFrequency, string> = {
  daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly',
};

const STATUS_TONE = {
  success: 'success', failed: 'danger', running: 'info', paused: 'neutral',
} as const;

const fmtRelativeDate = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function AutoScheduleReportsPage() {
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<AutoScheduledReport[]>(SEEDED_SCHEDULES);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return schedules;
    return schedules.filter(s =>
      s.reportTitle.toLowerCase().includes(q) ||
      s.scheduleLabel.toLowerCase().includes(q) ||
      s.recipients.some(r => r.toLowerCase().includes(q)));
  }, [schedules, search]);

  const totals = useMemo(() => {
    const active = schedules.filter(s => s.enabled).length;
    const failed = schedules.filter(s => s.lastRun?.status === 'failed').length;
    const today = schedules.filter(s => s.lastRun?.at.startsWith('2026-05-16')).length;
    return { total: schedules.length, active, failed, today };
  }, [schedules]);

  const togglePause = (id: string) => {
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
    const s = schedules.find(x => x.id === id);
    if (s) {
      toast({
        variant: s.enabled ? 'warning' : 'success',
        title: s.enabled ? 'Schedule paused' : 'Schedule resumed',
        message: s.reportTitle,
      });
    }
  };

  const runNow = (s: AutoScheduledReport) => {
    toast({ variant: 'info', title: 'Run triggered', message: `${s.reportTitle} — running now, recipients will receive the PDF when complete.` });
  };

  const remove = (s: AutoScheduledReport) => {
    setSchedules(prev => prev.filter(x => x.id !== s.id));
    toast({ variant: 'danger', title: 'Schedule deleted', message: s.reportTitle });
  };

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', paddingBottom: 40 }} className="gecko-stack gecko-stack-lg">

      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline gecko-stack-md">
            <h1 className="gecko-page-title">Auto-Schedule Reports</h1>
            <span className="gecko-count-badge">{schedules.length} schedules</span>
          </div>
          <p className="gecko-page-subtitle gecko-mt-1">
            Recurring reports that generate and email automatically on a daily, weekly, or monthly cadence.
          </p>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => setCreateOpen(true)}>
            <Icon name="plus" size={14} /> Schedule a Report
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="gecko-grid-4">
        <KpiTile icon="layers"        tone="primary"  label="Total schedules"     value={totals.total} />
        <KpiTile icon="check"         tone="success"  label="Active"              value={totals.active} />
        <KpiTile icon="alertTriangle" tone={totals.failed > 0 ? 'danger' : 'neutral'} label="Failed last run" value={totals.failed} />
        <KpiTile icon="activity"      tone="info"     label="Ran today"           value={totals.today} />
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 360 }}>
        <Icon name="search" size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-text-disabled)', pointerEvents: 'none' }} />
        <input
          className="gecko-input gecko-input-sm"
          placeholder="Search schedules, recipients…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: 32, width: '100%' }}
        />
      </div>

      {/* Schedule table */}
      <div className="gecko-table-card">
        <div style={{ overflowX: 'auto' }}>
          <table className="gecko-table gecko-table-comfortable" style={{ fontSize: 12.5, minWidth: 1100 }}>
            <thead>
              <tr>
                <th style={{ width: 36 }} aria-label="Status" />
                <th>Report</th>
                <th>Frequency</th>
                <th>Recipients</th>
                <th>Last run</th>
                <th>Next run</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="gecko-empty-state" style={{ padding: 32 }}>
                      <Icon name="clock" size={28} className="gecko-empty-state-icon" />
                      <div className="gecko-empty-state-title">No scheduled reports match the search</div>
                      <div className="gecko-empty-state-description">Try clearing the search or schedule a new one.</div>
                    </div>
                  </td>
                </tr>
              ) : filtered.map(s => {
                const status = s.lastRun?.status ?? 'paused';
                const tone   = STATUS_TONE[status];
                return (
                  <tr key={s.id} style={{ opacity: s.enabled ? 1 : 0.65 }}>
                    <td>
                      <span
                        style={{
                          display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                          background: `var(--gecko-${tone}-500)`,
                          boxShadow: s.enabled && status === 'success' ? `0 0 6px var(--gecko-${tone}-500)` : undefined,
                        }}
                        title={status}
                      />
                    </td>
                    <td>
                      <div className="gecko-cell-two-line">
                        <div className="gecko-cell-primary">{s.reportTitle}</div>
                        <div className="gecko-eyebrow gecko-mt-1">
                          {s.category === 'operational' ? 'Operational' : 'Accounts'}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="gecko-row" style={{ gap: 6 }}>
                        <span className="gecko-pill gecko-pill-info" style={{ fontSize: 10 }}>{FREQ_LABEL[s.frequency]}</span>
                        <span className="gecko-cell-meta" style={{ marginTop: 0 }}>{s.scheduleLabel}</span>
                      </div>
                    </td>
                    <td>
                      <div className="gecko-row gecko-row-wrap" style={{ gap: 4 }}>
                        {s.recipients.slice(0, 2).map(email => (
                          <span key={email} className="gecko-pill gecko-pill-neutral" style={{ fontSize: 10, fontFamily: 'var(--gecko-font-mono)' }}>
                            {email.split('@')[0]}
                          </span>
                        ))}
                        {s.recipients.length > 2 && (
                          <span style={{ fontSize: 10, color: 'var(--gecko-text-disabled)' }} title={s.recipients.join(', ')}>
                            +{s.recipients.length - 2} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {s.lastRun ? (
                        <div className="gecko-row" style={{ gap: 6 }}>
                          <Icon
                            name={status === 'success' ? 'check' : status === 'failed' ? 'x' : 'clock'}
                            size={12}
                            style={{ color: `var(--gecko-${tone}-600)` }}
                          />
                          <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 11, color: 'var(--gecko-text-secondary)' }}>
                            {fmtRelativeDate(s.lastRun.at)}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--gecko-text-disabled)' }}>Never run</span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 11, color: 'var(--gecko-text-secondary)' }}>
                      {s.enabled ? fmtRelativeDate(s.nextRun) : <span style={{ color: 'var(--gecko-text-disabled)' }}>— paused —</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="gecko-inline-row" style={{ gap: 2 }}>
                        <button
                          onClick={() => runNow(s)}
                          className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon"
                          title="Run now"
                          style={{ color: 'var(--gecko-primary-600)' }}
                        >
                          <Icon name="play" size={13} />
                        </button>
                        <button
                          onClick={() => togglePause(s.id)}
                          className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon"
                          title={s.enabled ? 'Pause' : 'Resume'}
                          style={{ color: s.enabled ? 'var(--gecko-warning-600)' : 'var(--gecko-success-600)' }}
                        >
                          <Icon name={s.enabled ? 'pause' : 'play'} size={13} />
                        </button>
                        <button
                          onClick={() => remove(s)}
                          className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon"
                          title="Delete"
                          style={{ color: 'var(--gecko-error-500)' }}
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen && (
        <CreateScheduleModal
          onCancel={() => setCreateOpen(false)}
          onCreate={(payload) => {
            const id = `sch-${Date.now()}`;
            const newSchedule: AutoScheduledReport = {
              id,
              reportId: payload.report.id,
              reportTitle: payload.report.title,
              category: payload.report.category,
              frequency: payload.frequency,
              scheduleLabel: payload.scheduleLabel,
              recipients: payload.recipients,
              enabled: true,
              nextRun: '2026-05-17T06:00:00',
              createdBy: 'SOMPORN',
            };
            setSchedules(prev => [newSchedule, ...prev]);
            setCreateOpen(false);
            toast({ variant: 'success', title: 'Schedule created', message: `${payload.report.title} — ${payload.scheduleLabel}` });
          }}
        />
      )}
    </div>
  );
}

/* ── KPI tile ───────────────────────────────────────────────────────────── */

function KpiTile({ icon, tone, label, value }: {
  icon: string; tone: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  label: string; value: number | string;
}) {
  return (
    <div className="gecko-kpi-tile">
      <div className={`gecko-kpi-tile-icon gecko-kpi-tile-icon-${tone}`}><Icon name={icon} size={16} /></div>
      <div className="gecko-kpi-tile-value">{value}</div>
      <div className="gecko-kpi-tile-label">{label}</div>
    </div>
  );
}

/* ── Create-schedule modal ──────────────────────────────────────────────── */

function CreateScheduleModal({ onCancel, onCreate }: {
  onCancel: () => void;
  onCreate: (p: { report: ReportDef; frequency: ScheduleFrequency; scheduleLabel: string; recipients: string[] }) => void;
}) {
  const [reportId, setReportId] = useState('');
  const [frequency, setFrequency] = useState<ScheduleFrequency>('daily');
  const [time, setTime] = useState('06:00');
  const [dayOfWeek, setDayOfWeek] = useState('Monday');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [recipientsRaw, setRecipientsRaw] = useState('');

  const allReports = [...OPERATIONAL_REPORTS, ...ACCOUNTS_REPORTS];
  const report = allReports.find(r => r.id === reportId);

  const scheduleLabel =
    frequency === 'daily'   ? `Daily at ${time}` :
    frequency === 'weekly'  ? `Every ${dayOfWeek} at ${time}` :
                              `${ordinal(parseInt(dayOfMonth, 10))} of month at ${time}`;

  const recipients = recipientsRaw
    .split(/[,\s\n]+/)
    .map(s => s.trim())
    .filter(Boolean);

  const valid = !!report && recipients.length > 0 && recipients.every(r => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r));

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.5)' }} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 'min(640px, 94vw)', maxHeight: '90vh',
        background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 14,
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.32)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gecko-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="clock" size={18} style={{ color: 'var(--gecko-primary-600)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Schedule a Report</div>
            <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>
              Pick a report and configure when + who receives it.
            </div>
          </div>
          <button onClick={onCancel} className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon"><Icon name="x" size={14} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div className="gecko-field">
            <div className="gecko-field-label gecko-field-required">Report</div>
            <select className="gecko-select" value={reportId} onChange={e => setReportId(e.target.value)}>
              <option value="">— Pick a report —</option>
              <optgroup label="Operational">
                {OPERATIONAL_REPORTS.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
              </optgroup>
              <optgroup label="Accounts">
                {ACCOUNTS_REPORTS.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
              </optgroup>
            </select>
          </div>

          <div className="gecko-field">
            <div className="gecko-field-label">Frequency</div>
            <div className="gecko-segctrl">
              {(['daily', 'weekly', 'monthly'] as ScheduleFrequency[]).map(f => (
                <button
                  key={f}
                  className={`gecko-segctrl-btn ${frequency === f ? 'gecko-segctrl-btn-active' : ''}`}
                  onClick={() => setFrequency(f)}
                >
                  {FREQ_LABEL[f]}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {frequency === 'weekly' && (
              <div className="gecko-field">
                <div className="gecko-field-label">Day of week</div>
                <select className="gecko-select" value={dayOfWeek} onChange={e => setDayOfWeek(e.target.value)}>
                  {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
            )}
            {frequency === 'monthly' && (
              <div className="gecko-field">
                <div className="gecko-field-label">Day of month</div>
                <select className="gecko-select" value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)}>
                  {Array.from({ length: 28 }, (_, i) => String(i + 1)).map(d => <option key={d}>{d}</option>)}
                  <option value="last">Last day</option>
                </select>
              </div>
            )}
            <div className="gecko-field">
              <div className="gecko-field-label">Time</div>
              <input type="time" className="gecko-input" value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>

          <div className="gecko-field">
            <div className="gecko-field-label gecko-field-required">Recipients</div>
            <textarea
              className="gecko-textarea"
              rows={3}
              placeholder="ops@company.com, finance@company.com — comma or newline separated"
              value={recipientsRaw}
              onChange={e => setRecipientsRaw(e.target.value)}
            />
            {recipients.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {recipients.map(r => {
                  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r);
                  return (
                    <span key={r} className={`gecko-pill ${ok ? 'gecko-pill-success' : 'gecko-pill-danger'}`} style={{ fontSize: 10, fontFamily: 'var(--gecko-font-mono)' }}>
                      {r}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ padding: 12, background: 'var(--gecko-info-50)', border: '1px solid var(--gecko-info-200)', borderRadius: 8, fontSize: 12, color: 'var(--gecko-info-700)', display: 'flex', gap: 8 }}>
            <Icon name="info" size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              Schedule preview: <strong>{scheduleLabel}</strong>
              {recipients.length > 0 && <> → <strong>{recipients.length}</strong> recipient{recipients.length === 1 ? '' : 's'}</>}
            </div>
          </div>
        </div>

        <div className="gecko-action-toolbar" style={{ padding: '14px 20px', borderTop: '1px solid var(--gecko-border)' }}>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onCancel}>Cancel</button>
          <button
            className="gecko-btn gecko-btn-primary gecko-btn-sm"
            disabled={!valid}
            onClick={() => report && onCreate({ report, frequency, scheduleLabel, recipients })}
          >
            <Icon name="check" size={13} /> Create schedule
          </button>
        </div>
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
