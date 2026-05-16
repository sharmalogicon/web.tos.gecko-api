"use client";
import React, { useState, use } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { SCHEDULES, ORDER_TYPE_LABELS } from '@/lib/tariff-mocks';
import {
  WORKFLOWS,
  describeThreshold,
} from '@/lib/approval-workflows';
import {
  TYPE_TONE, STATUS_TONE,
  REASON_TONE, REASON_LABEL,
  PUBLIC_TARIFF_ID,
  fmtTHB, fmtDateLong, daysBetween,
  resolveCharge,
  SIZES, TYPES, TRUCK_CATS, CARGO_CATS,
  describeCondition,
  type Schedule, type PricedCharge, type WorkflowProgressStep,
  type PaymentTerm, type BilledTo, type ResolutionInput, type ResolutionResult,
} from '@/lib/tariff-types';

type Tab = 'overview' | 'movement' | 'non-movement' | 'free-time' | 'test-move' | 'activity';

/* ──────────────────────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────────────────────── */

export default function TariffScheduleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const schedule = SCHEDULES[id];
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('overview');

  if (!schedule) return notFound();

  const tt = TYPE_TONE[schedule.type];
  const today = new Date().toISOString().slice(0, 10);
  const totalDays = daysBetween(schedule.effective, schedule.expiry);
  const elapsedDays = daysBetween(schedule.effective, today);
  const remainingDays = Math.max(0, daysBetween(today, schedule.expiry));
  const pctElapsed = totalDays > 0 ? Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100)) : 0;
  const workflow = WORKFLOWS.find(w => w.id === schedule.workflowId);

  const totalRateRows = schedule.prices.reduce((s, p) => s + p.rows.length, 0);
  const annualizedEstimate = schedule.prices.reduce((s, p) =>
    s + p.rows.reduce((rs, r) => rs + r.amount, 0), 0) * 120; // very rough: 120 moves/yr avg

  const partySummary =
    schedule.type === 'PUBLIC' ? 'All Standard Customers' :
    [schedule.liner?.code, schedule.forwarder?.code, schedule.shipper?.code].filter(Boolean).join(' × ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 60px)', background: 'var(--gecko-bg-canvas)' }}>

      {/* Sticky header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'var(--gecko-bg-surface)',
        borderBottom: '1px solid var(--gecko-border)',
        padding: '14px 24px',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <Link href="/tariff/plans" className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon" aria-label="Back to schedules">
          <Icon name="arrowLeft" size={16} />
        </Link>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--gecko-primary-600)' }}>
              {schedule.id}
            </span>
            <span className={`gecko-pill gecko-pill-${STATUS_TONE[schedule.status]}`}>{schedule.status}</span>
            <span className={`gecko-pill gecko-pill-${tt.tone}`}>
              <Icon name={tt.icon} size={11} style={{ marginBottom: -1, marginRight: 4 }} /> {tt.label}
            </span>
            <span style={{ fontSize: 11, color: 'var(--gecko-text-disabled)', fontStyle: 'italic' }}>view only</span>
          </div>
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{schedule.name}</h1>
            {partySummary && (
              <span style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', fontFamily: 'var(--gecko-font-mono)' }}>
                {partySummary}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => toast({ variant: 'info', title: 'Export', message: 'PDF export coming soon.' })}>
            <Icon name="download" size={14} /> Export
          </button>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => toast({ variant: 'info', title: 'Duplicate', message: 'Schedule duplication coming soon.' })}>
            <Icon name="copy" size={14} /> Duplicate
          </button>
          <Link href="/tariff/plans/new" className="gecko-btn gecko-btn-primary gecko-btn-sm">
            <Icon name="edit" size={14} /> Edit Schedule
          </Link>
        </div>
      </div>

      {/* Hero validity strip */}
      <div style={{ background: 'var(--gecko-bg-surface)', borderBottom: '1px solid var(--gecko-border)', padding: '16px 24px' }}>
        <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>

          <div className="gecko-kpi-tile">
            <div className="gecko-kpi-tile-icon gecko-kpi-tile-icon-primary"><Icon name="calendar" size={16} /></div>
            <div className="gecko-kpi-tile-value" style={{ fontSize: 16 }}>{fmtDateLong(schedule.effective)}</div>
            <div className="gecko-kpi-tile-label">Effective from</div>
          </div>
          <div className="gecko-kpi-tile">
            <div className="gecko-kpi-tile-icon gecko-kpi-tile-icon-warning"><Icon name="clock" size={16} /></div>
            <div className="gecko-kpi-tile-value" style={{ fontSize: 16 }}>{fmtDateLong(schedule.expiry)}</div>
            <div className="gecko-kpi-tile-label">
              {schedule.status === 'Expired' ? 'Expired' : `${remainingDays} day${remainingDays === 1 ? '' : 's'} remaining`}
            </div>
          </div>
          <div className="gecko-kpi-tile">
            <div className="gecko-kpi-tile-icon gecko-kpi-tile-icon-info"><Icon name="dollarSign" size={16} /></div>
            <div className="gecko-kpi-tile-value">{schedule.prices.length}</div>
            <div className="gecko-kpi-tile-label">Priced charges · {totalRateRows} rate rows</div>
          </div>
          <div className="gecko-kpi-tile">
            <div className="gecko-kpi-tile-icon gecko-kpi-tile-icon-success"><Icon name="trendingUp" size={16} /></div>
            <div className="gecko-kpi-tile-value">฿{(annualizedEstimate / 1_000_000).toFixed(1)}M</div>
            <div className="gecko-kpi-tile-label">Annualized estimate (rough)</div>
          </div>
        </div>

        {/* Progress bar */}
        {schedule.status === 'Active' && (
          <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '14px auto 0', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 600, minWidth: 50 }}>Day {elapsedDays}</span>
            <div className="gecko-progress" style={{ flex: 1 }}>
              <div className="gecko-progress-bar gecko-progress-success" style={{ width: `${pctElapsed}%` }} />
            </div>
            <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 600, minWidth: 100, textAlign: 'right' }}>
              of {totalDays} ({pctElapsed.toFixed(0)}%)
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ background: 'var(--gecko-bg-surface)', borderBottom: '1px solid var(--gecko-border)', padding: '0 24px' }}>
        <div className="gecko-tabs">
          {([
            { id: 'overview',     label: 'Overview',                icon: 'info' },
            { id: 'movement',     label: 'Movement Charges',        icon: 'truck' },
            { id: 'non-movement', label: 'Non-Movement Charges',    icon: 'clock' },
            { id: 'free-time',    label: 'Free Time',               icon: 'calendar' },
            { id: 'test-move',    label: 'Test a Move',             icon: 'play' },
            { id: 'activity',     label: 'Activity',                icon: 'activity' },
          ] as { id: Tab; label: string; icon: string }[]).map(t => (
            <button
              key={t.id}
              className={`gecko-tab ${tab === t.id ? 'gecko-tab-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <Icon name={t.icon} size={13} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: 24, maxWidth: 'var(--gecko-container-max)', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {tab === 'overview' && (
          <>
            <ReadOnlyCard title="Parties & validity" icon="users">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                <Field label="Schedule type"
                  value={
                    <span className={`gecko-pill gecko-pill-${tt.tone}`} style={{ fontSize: 11 }}>
                      <Icon name={tt.icon} size={11} style={{ marginBottom: -1, marginRight: 4 }} /> {tt.label}
                    </span>
                  } />
                <Field label="Status"
                  value={<span className={`gecko-pill gecko-pill-${STATUS_TONE[schedule.status]}`}>{schedule.status}</span>} />
                <Field label="Workflow"
                  value={
                    <Link href="/config/approval-workflows" style={{ fontSize: 13, color: 'var(--gecko-primary-700)', fontWeight: 600, textDecoration: 'none' }}>
                      {workflow?.name ?? '—'} <Icon name="externalLink" size={11} style={{ marginBottom: -1 }} />
                    </Link>
                  } />
              </div>

              {schedule.type !== 'PUBLIC' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 14 }}>
                  <PartyChip label="Liner"    p={schedule.liner} />
                  <PartyChip label="Forwarder" p={schedule.forwarder} />
                  <PartyChip label="Shipper / Consignee" p={schedule.shipper} />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 14 }}>
                <Field label="Effective"   value={<span style={{ fontFamily: 'var(--gecko-font-mono)' }}>{fmtDateLong(schedule.effective)}</span>} />
                <Field label="Expiry"      value={<span style={{ fontFamily: 'var(--gecko-font-mono)' }}>{fmtDateLong(schedule.expiry)}</span>} />
                <Field label="Sales person" value={schedule.salesPerson || '—'} />
                <Field label="Approver"    value={schedule.approver || '—'} />
              </div>
            </ReadOnlyCard>

            {/* Approval workflow progress */}
            <ReadOnlyCard
              title="Approval progress"
              icon="gitBranch"
              subtitle={`${schedule.workflowProgress.filter(s => s.status === 'approved' || s.status === 'auto-approved').length} of ${schedule.workflowProgress.length} step${schedule.workflowProgress.length === 1 ? '' : 's'} complete`}
              right={
                workflow?.steps.some(s => s.threshold && describeThreshold(s.threshold)) && (
                  <span style={{ fontSize: 11, color: 'var(--gecko-info-700)' }}>
                    Has auto-approval rule
                  </span>
                )
              }
            >
              <WorkflowChain steps={schedule.workflowProgress} />
            </ReadOnlyCard>

            <ReadOnlyCard title="Coverage" icon="package" subtitle="Order types priced under this schedule">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {schedule.orderTypesInScope.map(otId => {
                  const ot = ORDER_TYPE_LABELS[otId];
                  if (!ot) return null;
                  return (
                    <span key={otId} className="gecko-pill gecko-pill-primary" style={{ padding: '6px 12px', fontSize: 12 }}>
                      <Icon name="package" size={11} style={{ marginBottom: -1, marginRight: 4 }} />
                      <strong style={{ fontFamily: 'var(--gecko-font-mono)' }}>{ot.code}</strong>
                      <span style={{ fontWeight: 500, marginLeft: 6, opacity: 0.85 }}>{ot.description}</span>
                    </span>
                  );
                })}
              </div>
            </ReadOnlyCard>
          </>
        )}

        {tab === 'movement' && (
          <MovementChargesView prices={schedule.prices} />
        )}

        {tab === 'non-movement' && (
          <NonMovementView schedule={schedule} />
        )}

        {tab === 'free-time' && (
          <FreeTimeView schedule={schedule} />
        )}

        {tab === 'test-move' && (
          <TestAMoveView schedule={schedule} />
        )}

        {tab === 'activity' && (
          <ReadOnlyCard title="Activity & approval trail" icon="activity">
            <div>
              {schedule.activity.map((e, i) => (
                <div key={e.id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: i < schedule.activity.length - 1 ? '1px solid var(--gecko-border)' : 'none' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `var(--gecko-${e.tone}-500)`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name={e.icon} size={14} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--gecko-text-primary)' }}><strong>{e.who}</strong> {e.what}</div>
                    <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2, fontFamily: 'var(--gecko-font-mono)' }}>{e.when}</div>
                  </div>
                </div>
              ))}
            </div>
          </ReadOnlyCard>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────────────────────────────────── */

function ReadOnlyCard({ title, subtitle, icon, right, children }: {
  title: string; subtitle?: string; icon?: string; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--gecko-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        {icon && <Icon name={icon} size={15} style={{ color: 'var(--gecko-primary-600)' }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="gecko-section-header-title">{title}</div>
          {subtitle && <div className="gecko-section-header-subtitle">{subtitle}</div>}
        </div>
        {right}
      </div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="gecko-field-label" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--gecko-text-primary)', fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function PartyChip({ label, p }: { label: string; p?: { code: string; name: string } }) {
  return (
    <div style={{
      padding: '10px 14px',
      background: p ? 'var(--gecko-bg-subtle)' : 'transparent',
      border: '1px solid var(--gecko-border)',
      borderRadius: 10,
    }}>
      <div className="gecko-field-label" style={{ marginBottom: 4 }}>{label}</div>
      {p ? (
        <>
          <div style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--gecko-primary-700)' }}>{p.code}</div>
          <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 2, lineHeight: 1.4 }}>{p.name}</div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--gecko-text-disabled)', fontStyle: 'italic' }}>not assigned</div>
      )}
    </div>
  );
}

function WorkflowChain({ steps }: { steps: WorkflowProgressStep[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, overflowX: 'auto', padding: '4px 0' }}>
      {steps.map((s, i) => {
        const isApproved = s.status === 'approved';
        const isAuto = s.status === 'auto-approved';
        const isPending = s.status === 'pending';
        const tone =
          isApproved ? 'var(--gecko-success-500)' :
          isAuto ? 'var(--gecko-info-500)' :
          isPending ? 'var(--gecko-warning-500)' :
          'var(--gecko-gray-300)';
        const icon =
          isApproved ? 'check' :
          isAuto ? 'zap' :
          isPending ? 'clock' :
          'circle';
        return (
          <React.Fragment key={s.stepId}>
            <div style={{ flex: '0 0 auto', minWidth: 180, display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 14px', background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 10, borderLeft: `3px solid ${tone}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: tone, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={icon} size={12} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{s.stepName}</div>
              </div>
              <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)' }}>{s.approverLabel}</div>
              {s.by && s.at && (
                <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)', fontFamily: 'var(--gecko-font-mono)' }}>
                  {isAuto ? '⚡ ' : ''}{s.by} · {s.at}
                </div>
              )}
              {s.thresholdNote && (
                <div style={{ fontSize: 10, color: 'var(--gecko-info-700)', fontStyle: 'italic' }}>{s.thresholdNote}</div>
              )}
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: '0 0 28px', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 24 }}>
                <Icon name="arrowRight" size={16} style={{ color: 'var(--gecko-text-disabled)' }} />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function MovementChargesView({ prices }: { prices: PricedCharge[] }) {
  if (prices.length === 0) {
    return (
      <ReadOnlyCard title="Movement-bound charges" icon="truck">
        <div className="gecko-empty-state" style={{ padding: 36 }}>
          <Icon name="dollarSign" size={28} className="gecko-empty-state-icon" />
          <div className="gecko-empty-state-title">No charges priced</div>
          <div className="gecko-empty-state-description">All charges fall back to the Public tariff for this schedule.</div>
        </div>
      </ReadOnlyCard>
    );
  }

  // Group by order type → movement
  const grouped: Record<string, Record<number, PricedCharge[]>> = {};
  for (const p of prices) {
    if (!grouped[p.orderTypeId]) grouped[p.orderTypeId] = {};
    if (!grouped[p.orderTypeId][p.movementSeq]) grouped[p.orderTypeId][p.movementSeq] = [];
    grouped[p.orderTypeId][p.movementSeq].push(p);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {Object.entries(grouped).map(([otId, byMov]) => {
        const ot = ORDER_TYPE_LABELS[otId];
        return (
          <ReadOnlyCard
            key={otId}
            title={ot?.code ?? otId}
            subtitle={ot?.description}
            icon="package"
          >
            {Object.entries(byMov).map(([seqStr, charges]) => {
              const seq = Number(seqStr);
              const mov = ot?.movements.find(m => m.seq === seq);
              return (
                <div key={seq} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--gecko-primary-600)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11 }}>{seq}</div>
                    <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{mov?.code}</span>
                    <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>{mov?.name}</span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="gecko-table gecko-table-compact" style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Code</th><th>Description</th><th>Kind</th>
                          <th>Size</th><th>Type</th><th>Truck</th><th>Cargo</th>
                          <th>Pymt</th><th>Billed To</th>
                          <th style={{ textAlign: 'right' }}>Rate (THB)</th>
                          <th>Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {charges.flatMap(c => c.rows.map(r => (
                          <tr key={r.id}>
                            <td className="gecko-text-mono" style={{ fontWeight: 700 }}>{c.code}</td>
                            <td>{c.desc}</td>
                            <td>
                              <span className={`gecko-pill gecko-pill-${c.source === 'VAS' ? 'warning' : 'neutral'}`} style={{ fontSize: 9 }}>{c.source}</span>
                            </td>
                            <td className="gecko-text-mono">{r.size ?? '—'}</td>
                            <td className="gecko-text-mono">{r.type ?? '—'}</td>
                            <td className="gecko-text-mono">{r.truckCat ?? '—'}</td>
                            <td className="gecko-text-mono">{r.cargoCat ?? '—'}</td>
                            <td>{r.paymentTerm}</td>
                            <td>{r.billedTo}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}>{fmtTHB(r.amount)}</td>
                            <td>
                              {r.source === 'imported' && <span className="gecko-pill gecko-pill-info" style={{ fontSize: 9 }} title={r.sourceRef}>CSV</span>}
                              {r.source === 'ai-suggested' && <span className="gecko-pill gecko-pill-violet" style={{ fontSize: 9 }}>AI</span>}
                              {r.source === 'human' && <span style={{ fontSize: 10, color: 'var(--gecko-text-disabled)' }}>manual</span>}
                            </td>
                          </tr>
                        )))}
                      </tbody>
                    </table>
                  </div>

                  {/* Surcharge conditions (if any) */}
                  {charges.some(c => c.rows.some(r => r.conditions?.length)) && (
                    <div style={{ marginTop: 8, padding: 10, background: 'var(--gecko-bg-subtle)', borderRadius: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                        Conditional surcharges
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {charges.flatMap(c => c.rows.flatMap(r => (r.conditions ?? []).map(cond =>
                          <span key={cond.id} className="gecko-pill gecko-pill-warning" style={{ fontSize: 10 }}>
                            <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, marginRight: 4 }}>{c.code}</span>
                            {describeCondition(cond)}
                          </span>
                        )))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </ReadOnlyCard>
        );
      })}
    </div>
  );
}

function NonMovementView({ schedule }: { schedule: Schedule }) {
  return (
    <>
      <ReadOnlyCard title="Laden Storage" icon="package" subtitle={`Free days: ${schedule.ladenStorage.freeDays} · Mode: per-day slab`}>
        <DaySlabReadout slabs={schedule.ladenStorage.perDaySlabs} />
      </ReadOnlyCard>

      <ReadOnlyCard title="Empty Storage" icon="box"
        subtitle={`Free days: ${schedule.emptyStorage.freeDays} · Mode: ${schedule.emptyStorage.mode === 'FLEET_TEU_SLAB' ? 'Fleet-TEU slab' : 'per-day slab'}`}>
        {schedule.emptyStorage.mode === 'PER_DAY_SLAB' ? (
          <DaySlabReadout slabs={schedule.emptyStorage.perDaySlabs} />
        ) : (
          <table className="gecko-table" style={{ fontSize: 12 }}>
            <thead><tr><th>Fleet TEU band</th><th style={{ textAlign: 'right' }}>Rate per day per container</th></tr></thead>
            <tbody>
              {schedule.emptyStorage.fleetTeuBands.map(b => (
                <tr key={b.id}>
                  <td className="gecko-text-mono">{b.from} – {b.to} TEU</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--gecko-font-mono)', fontWeight: 700 }}>
                    {b.ratePerDay === 0 ? <span className="gecko-pill gecko-pill-success">FREE</span> : `฿${b.ratePerDay}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ReadOnlyCard>

      <ReadOnlyCard title="PTI — Pre-Trip Inspection" icon="check" subtitle="Per-event flat rate by reefer container size">
        <ReeferTable rates={schedule.ptiRates} />
      </ReadOnlyCard>

      <ReadOnlyCard title="Precool" icon="activity" subtitle="Per-event flat rate by reefer container size">
        <ReeferTable rates={schedule.precoolRates} />
      </ReadOnlyCard>
    </>
  );
}

function DaySlabReadout({ slabs }: { slabs: { id: string; fromDay: number; toDay: number; ratePerDay: number }[] }) {
  if (slabs.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--gecko-text-disabled)', fontStyle: 'italic' }}>No slabs configured.</div>;
  }
  const TONES = ['info', 'warning', 'error', 'primary', 'neutral'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {slabs.map((s, i) => {
        const tone = TONES[i % TONES.length];
        const isLast = i === slabs.length - 1;
        return (
          <div key={s.id} style={{
            display: 'grid', gridTemplateColumns: '14px 1fr auto', gap: 12, alignItems: 'center',
            padding: '10px 14px',
            background: 'var(--gecko-bg-subtle)',
            border: '1px solid var(--gecko-border)',
            borderRadius: 8,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: `var(--gecko-${tone}-500)` }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gecko-text-primary)', fontFamily: 'var(--gecko-font-mono)' }}>
                Day {s.fromDay} – {isLast ? `${s.toDay}+ (and after)` : s.toDay}
              </div>
              <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>
                {isLast ? 'Rate continues for all days beyond this band' : `${s.toDay - s.fromDay + 1} days in this band`}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 18, fontWeight: 800, color: `var(--gecko-${tone}-700)` }}>
                {s.ratePerDay === 0 ? 'FREE' : `฿${s.ratePerDay}`}
              </span>
              {s.ratePerDay > 0 && (
                <span style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', fontWeight: 700 }}>/ day / cont</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StorageTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div style={{ background: 'var(--gecko-bg-subtle)', border: '1px solid var(--gecko-border)', borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 22, fontWeight: 800, color: `var(--gecko-${tone}-700)` }}>{value}</span>
        <span style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', fontWeight: 700 }}>THB/day</span>
      </div>
    </div>
  );
}

function ReeferTable({ rates }: { rates: Record<string, number> }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      {Object.entries(rates).map(([sz, amt]) => (
        <div key={sz} style={{ background: 'var(--gecko-bg-subtle)', border: '1px solid var(--gecko-border)', borderRadius: 10, padding: 14 }}>
          <div className="gecko-field-label" style={{ marginBottom: 6 }}>{sz}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 18, fontWeight: 800, color: 'var(--gecko-primary-700)' }}>฿{fmtTHB(amt)}</span>
            <span style={{ fontSize: 10, color: 'var(--gecko-text-secondary)' }}>per event</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function FreeTimeView({ schedule }: { schedule: Schedule }) {
  const m = schedule.freeTime;
  const Cell = ({ v }: { v: number }) => (
    <span style={{ display: 'inline-block', minWidth: 32, padding: '4px 8px', background: 'var(--gecko-bg-subtle)', border: '1px solid var(--gecko-border)', borderRadius: 6, fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, fontSize: 12, textAlign: 'center' }}>{v}</span>
  );
  return (
    <ReadOnlyCard title="Free time / storage free days" icon="calendar">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        <div style={{ border: '1px solid var(--gecko-border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: 'var(--gecko-success-50)', borderBottom: '1px solid var(--gecko-success-200)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="package" size={14} style={{ color: 'var(--gecko-success-700)' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-success-700)' }}>FULL (Laden)</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase' }}>Direction</th>
                <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase' }}>Normal</th>
                <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase' }}>Reefer</th>
                <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase' }}>DG</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderTop: '1px solid var(--gecko-border)' }}>
                <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600 }}>Export ↑</td>
                <td style={{ padding: '8px', textAlign: 'center' }}><Cell v={m.fullExport.normal} /></td>
                <td style={{ padding: '8px', textAlign: 'center' }}><Cell v={m.fullExport.reefer} /></td>
                <td style={{ padding: '8px', textAlign: 'center' }}><Cell v={m.fullExport.dg} /></td>
              </tr>
              <tr style={{ borderTop: '1px solid var(--gecko-border)' }}>
                <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600 }}>Import ↓</td>
                <td style={{ padding: '8px', textAlign: 'center' }}><Cell v={m.fullImport.normal} /></td>
                <td style={{ padding: '8px', textAlign: 'center' }}><Cell v={m.fullImport.reefer} /></td>
                <td style={{ padding: '8px', textAlign: 'center' }}><Cell v={m.fullImport.dg} /></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ border: '1px solid var(--gecko-border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: 'var(--gecko-info-50)', borderBottom: '1px solid var(--gecko-info-200)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="box" size={14} style={{ color: 'var(--gecko-info-700)' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-info-700)' }}>EMPTY</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase' }}>Direction</th>
                <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase' }}>Normal</th>
                <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase' }}>Reefer</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderTop: '1px solid var(--gecko-border)' }}>
                <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600 }}>Export ↑</td>
                <td style={{ padding: '8px', textAlign: 'center' }}><Cell v={m.emptyExport.normal} /></td>
                <td style={{ padding: '8px', textAlign: 'center' }}><Cell v={m.emptyExport.reefer} /></td>
              </tr>
              <tr style={{ borderTop: '1px solid var(--gecko-border)' }}>
                <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600 }}>Import ↓</td>
                <td style={{ padding: '8px', textAlign: 'center' }}><Cell v={m.emptyImport.normal} /></td>
                <td style={{ padding: '8px', textAlign: 'center' }}><Cell v={m.emptyImport.reefer} /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 14, padding: 12, background: m.waiveMtyDm ? 'var(--gecko-success-50)' : 'var(--gecko-bg-subtle)', borderRadius: 10, fontSize: 12, color: m.waiveMtyDm ? 'var(--gecko-success-700)' : 'var(--gecko-text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name={m.waiveMtyDm ? 'check' : 'x'} size={14} />
        <strong>Waive Storage for MTY DM Containers:</strong> {m.waiveMtyDm ? 'enabled' : 'disabled'}
      </div>
    </ReadOnlyCard>
  );
}

function TestAMoveView({ schedule }: { schedule: Schedule }) {
  const otsInScope = schedule.orderTypesInScope.filter(id => ORDER_TYPE_LABELS[id]);
  const [orderTypeId, setOrderTypeId] = useState<string>(otsInScope[0] ?? '');
  const [movementSeq, setMovementSeq] = useState<number>(ORDER_TYPE_LABELS[otsInScope[0]]?.movements[0]?.seq ?? 1);
  const [size, setSize] = useState<string>('40');
  const [type, setType] = useState<string>('DC');
  const [truckCat, setTruckCat] = useState<string>('TRAILER');
  const [cargoCat, setCargoCat] = useState<string>('GENERAL');
  const [paymentTerm, setPaymentTerm] = useState<PaymentTerm>('CASH');
  const [billedTo, setBilledTo] = useState<BilledTo>('CUSTOMER');
  const [results, setResults] = useState<ResolutionResult[] | null>(null);

  const ot = ORDER_TYPE_LABELS[orderTypeId];
  const movements = ot?.movements ?? [];

  const onResolve = () => {
    if (!orderTypeId) return;
    const input: ResolutionInput = { orderTypeId, movementSeq, size, type, truckCat, cargoCat, paymentTerm, billedTo };
    const allCharges = [
      ...(movements.find(m => m.seq === movementSeq) ? schedule.prices.filter(p => p.orderTypeId === orderTypeId && p.movementSeq === movementSeq) : []),
    ];
    const allCatalogCharges = ORDER_TYPE_LABELS[orderTypeId]?.movements.find(m => m.seq === movementSeq);
    // For unpriced charges, we'd need the full catalog. For view-only, we just resolve what's priced.
    const res = allCharges.map(p => resolveCharge(p, input, schedule.id));
    setResults(res);
    void allCatalogCharges; // suppress unused
  };

  if (otsInScope.length === 0) {
    return (
      <ReadOnlyCard title="Test a Move" icon="play">
        <div className="gecko-empty-state" style={{ padding: 36 }}>
          <Icon name="play" size={28} className="gecko-empty-state-icon" />
          <div className="gecko-empty-state-title">No order types in scope</div>
          <div className="gecko-empty-state-description">Nothing to test against — this schedule does not cover any order types.</div>
        </div>
      </ReadOnlyCard>
    );
  }

  const matchedCount = results?.filter(r => r.matched).length ?? 0;
  const fallbackCount = results?.filter(r => !r.matched).length ?? 0;

  return (
    <>
      <ReadOnlyCard title="Test a Move" icon="play" subtitle="Simulate a real move against this schedule.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>
          <div className="gecko-field">
            <div className="gecko-field-label">Order Type</div>
            <select className="gecko-select" value={orderTypeId} onChange={e => {
              setOrderTypeId(e.target.value);
              setMovementSeq(ORDER_TYPE_LABELS[e.target.value]?.movements[0]?.seq ?? 1);
            }}>
              {otsInScope.map(id => <option key={id} value={id}>{ORDER_TYPE_LABELS[id].code}</option>)}
            </select>
          </div>
          <div className="gecko-field">
            <div className="gecko-field-label">Movement</div>
            <select className="gecko-select" value={movementSeq} onChange={e => setMovementSeq(Number(e.target.value))}>
              {movements.map(m => <option key={m.seq} value={m.seq}>#{m.seq} — {m.code}</option>)}
            </select>
          </div>
          <div className="gecko-field">
            <div className="gecko-field-label">Size</div>
            <select className="gecko-select" value={size} onChange={e => setSize(e.target.value)}>
              {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="gecko-field">
            <div className="gecko-field-label">Type</div>
            <select className="gecko-select" value={type} onChange={e => setType(e.target.value)}>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="gecko-field">
            <div className="gecko-field-label">Truck-Cat</div>
            <select className="gecko-select" value={truckCat} onChange={e => setTruckCat(e.target.value)}>
              {TRUCK_CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="gecko-field">
            <div className="gecko-field-label">Cargo-Cat</div>
            <select className="gecko-select" value={cargoCat} onChange={e => setCargoCat(e.target.value)}>
              {CARGO_CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="gecko-field">
            <div className="gecko-field-label">Payment Term</div>
            <select className="gecko-select" value={paymentTerm} onChange={e => setPaymentTerm(e.target.value as PaymentTerm)}>
              <option value="CASH">CASH</option><option value="CREDIT">CREDIT</option>
            </select>
          </div>
          <div className="gecko-field">
            <div className="gecko-field-label">Billed To</div>
            <select className="gecko-select" value={billedTo} onChange={e => setBilledTo(e.target.value as BilledTo)}>
              <option value="CUSTOMER">CUSTOMER</option><option value="HAULIER">HAULIER</option>
              <option value="LINE">LINE</option><option value="AGENT">AGENT</option>
              <option value="FWD">FWD</option><option value="CARRIER">CARRIER</option>
            </select>
          </div>
        </div>

        <button className="gecko-btn gecko-btn-primary" onClick={onResolve}>
          <Icon name="play" size={14} /> Resolve this move
        </button>
      </ReadOnlyCard>

      {results && results.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div className="gecko-kpi-tile">
              <div className="gecko-kpi-tile-icon gecko-kpi-tile-icon-success"><Icon name="check" size={16} /></div>
              <div className="gecko-kpi-tile-value">{matchedCount}</div>
              <div className="gecko-kpi-tile-label">Priced by this schedule</div>
            </div>
            <div className="gecko-kpi-tile">
              <div className="gecko-kpi-tile-icon gecko-kpi-tile-icon-info"><Icon name="arrowRight" size={16} /></div>
              <div className="gecko-kpi-tile-value">{fallbackCount}</div>
              <div className="gecko-kpi-tile-label">Fall back to Public</div>
            </div>
            <div className="gecko-kpi-tile">
              <div className="gecko-kpi-tile-icon gecko-kpi-tile-icon-primary"><Icon name="dollarSign" size={16} /></div>
              <div className="gecko-kpi-tile-value">{fmtTHB(results.filter(r => r.matched).reduce((s, r) => s + (r.rate ?? 0), 0))}</div>
              <div className="gecko-kpi-tile-label">Total resolved (THB)</div>
            </div>
          </div>

          <ReadOnlyCard title="Per-charge resolution" subtitle={`${results.length} priced charges on this movement`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {results.map((r, i) => (
                <div key={i} className="gecko-resolution-row">
                  <div className="gecko-resolution-row-charge">
                    <span className="gecko-charge-card-code">{r.chargeCode}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{r.chargeDesc}</div>
                      <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>{r.source === 'VAS' ? 'VAS' : 'Movement charge'}</div>
                    </div>
                  </div>
                  <div className="gecko-resolution-row-trail">
                    {r.precedenceTrail.map((t, idx) => (
                      <React.Fragment key={t}>
                        <span style={{
                          fontFamily: 'var(--gecko-font-mono)', fontSize: 11, fontWeight: 700,
                          color: idx === r.precedenceTrail.length - 1
                            ? (r.matched ? 'var(--gecko-success-700)' : 'var(--gecko-info-700)')
                            : 'var(--gecko-text-disabled)',
                          textDecoration: idx === r.precedenceTrail.length - 1 ? 'none' : 'line-through',
                        }}>{t}</span>
                        {idx < r.precedenceTrail.length - 1 && <Icon name="arrowRight" size={11} style={{ color: 'var(--gecko-text-disabled)' }} />}
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="gecko-resolution-row-reason">
                    <span className={`gecko-pill gecko-pill-${REASON_TONE[r.reason]}`}>{REASON_LABEL[r.reason]}</span>
                  </div>
                  <div className="gecko-resolution-row-amount">
                    {r.matched ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 15, fontWeight: 800 }}>{fmtTHB(r.rate ?? 0)}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)' }}>THB</span>
                        </div>
                        {r.appliedConditions && r.appliedConditions.length > 0 && (
                          <div style={{ fontSize: 9, color: 'var(--gecko-warning-700)', marginTop: 2, fontStyle: 'italic' }}>
                            base ฿{fmtTHB(r.baseRate ?? 0)} + {r.appliedConditions.length} cond.
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--gecko-text-disabled)', fontStyle: 'italic' }}>Standard rate</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ReadOnlyCard>

          {results.some(r => r.appliedConditions && r.appliedConditions.length > 0) && (
            <ReadOnlyCard title="Applied conditional surcharges" icon="zap"
              subtitle="Conditions that matched this move and modified the base rate">
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--gecko-text-primary)' }}>
                {results.flatMap(r => (r.appliedConditions ?? []).map(c => (
                  <li key={c.conditionId + r.chargeCode}>
                    <strong style={{ fontFamily: 'var(--gecko-font-mono)' }}>{r.chargeCode}</strong> · {c.label} → ฿{fmtTHB(c.before)} became ฿{fmtTHB(c.after)}
                  </li>
                )))}
              </ul>
            </ReadOnlyCard>
          )}
        </>
      )}

      {results && results.length === 0 && (
        <div className="gecko-empty-state" style={{ padding: 36 }}>
          <Icon name="info" size={28} className="gecko-empty-state-icon" />
          <div className="gecko-empty-state-title">Nothing priced on this movement</div>
          <div className="gecko-empty-state-description">All charges fall back to the Public tariff for this move.</div>
        </div>
      )}
    </>
  );
}
