"use client";
import React, { useMemo, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { useApi } from '@/lib/api/use-api';
import { apiSend } from '@/lib/api/client';
import { ApiError } from '@/lib/api/problem';
import { useSession } from '@/lib/auth/session';
import {
  axis, conditionText, formatDate, formatMoment, isTimeCharge, money, partySummary,
  SCOPE_RANK_LABEL, STATUS_TONE, tierLabel, TYPE_TONE,
  type FreeTimeSet, type PriceRequest, type PriceResult, type Rate, type RateSet, type Schedule,
} from '@/lib/api/revenue';

/**
 * LIVE against gecko_revenue. One version of one price agreement.
 *
 * What changed when this stopped being a mock:
 *   * Rates are NOT nested under order type and movement. A rate row carries
 *     optional axes (order type, movement, equipment type, size, cargo, truck)
 *     and the most specific match wins — Vector mixes 11 axis combinations
 *     inside one quotation, so a fixed hierarchy cannot load real data.
 *   * "Test a move" calls the REAL resolver (POST /api/revenue/price) instead of
 *     a copy of the pricing logic in the browser. Two implementations of
 *     precedence would drift, and the one the customer gets billed by is the
 *     server's.
 *   * Approval progress shows what the API records — submitted, approved,
 *     rejected, by whom — not invented workflow steps.
 */

type Tab = 'overview' | 'charges' | 'time' | 'free-time' | 'test-move' | 'activity';

export default function TariffScheduleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const { can, user } = useSession();
  const [tab, setTab] = useState<Tab>('overview');
  const [busy, setBusy] = useState<string | null>(null);

  const schedule = useApi<Schedule>(`/api/revenue/tariffs/${id}`);
  const rateSet = useApi<RateSet>(`/api/revenue/tariffs/${id}/rates`);
  const freeTime = useApi<FreeTimeSet>(`/api/revenue/tariffs/${id}/free-time`);

  const s = schedule.data;
  const rates = rateSet.data?.rates ?? [];
  const moveCharges = useMemo(() => rates.filter(r => !isTimeCharge(r)), [rates]);
  const timeCharges = useMemo(() => rates.filter(r => isTimeCharge(r)), [rates]);

  const reloadAll = () => { schedule.reload(); rateSet.reload(); freeTime.reload(); };

  async function act(action: 'submit' | 'approve' | 'reject' | 'withdraw', reason?: string) {
    if (!s) return;
    setBusy(action);
    try {
      await apiSend('POST', `/api/revenue/tariffs/${s.scheduleId}/${action}`, { rowVersion: s.rowVersion, reason });
      toast({ variant: 'success', title: `Tariff ${action === 'submit' ? 'submitted' : `${action}ed`}`, message: `${s.scheduleNo} v${s.versionNo}` });
      reloadAll();
    } catch (e) {
      const error = e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.');
      toast({ variant: 'danger', title: `Could not ${action}`, message: error.message });
    } finally {
      setBusy(null);
    }
  }

  /**
   * A new version of an APPROVED tariff: the API copies its rates, tiers,
   * conditions and free time into a fresh DRAFT (PLAN §4.1 — an approved price
   * is never edited). It must start later than the version it replaces, so the
   * default offered is the day after this one stops being in force.
   */
  async function revise() {
    if (!s) return;
    const suggested = nextDay(s.effectiveUntil ?? s.effectiveFrom);
    const from = window.prompt(`Start date for v${s.versionNo + 1} (YYYY-MM-DD)`, suggested)?.trim();
    if (!from) return;
    setBusy('revise');
    try {
      const created = await apiSend<Schedule>('POST', `/api/revenue/tariffs/${s.scheduleId}/revise`, {
        rowVersion: s.rowVersion,
        effectiveFrom: from,
      });
      toast({ variant: 'success', title: `v${created.versionNo} drafted`, message: `${created.rateCount} rate row(s) copied — edit and submit.` });
      router.push(`/tariff/plans/${created.scheduleId}`);
    } catch (e) {
      const error = e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.');
      toast({ variant: 'danger', title: 'Could not start a new version', message: error.message });
    } finally {
      setBusy(null);
    }
  }

  if (schedule.loading && !s) {
    return <div className="gecko-card gecko-row" style={{ justifyContent: 'center', padding: 48, margin: 24, color: 'var(--gecko-text-secondary)' }}>Loading tariff…</div>;
  }

  if (!s) {
    return (
      <div style={{ padding: 24 }}>
        <EmptyState
          icon="alertCircle"
          title={schedule.error?.status === 404 ? 'No such tariff version' : 'Could not load this tariff'}
          description={schedule.error?.status === 404
            ? 'Tariffs are addressed by their schedule id now. Open one from the list.'
            : schedule.error?.message}
          action={<Link href="/tariff/plans" className="gecko-btn gecko-btn-primary gecko-btn-sm">Back to schedules</Link>}
        />
      </div>
    );
  }

  const tone = TYPE_TONE[s.scheduleType];
  const canManage = can('revenue.tariff.manage');
  const canApprove = can('revenue.tariff.approve');
  const isOpen = s.status === 'DRAFT' || s.status === 'PENDING';

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

        <div className="gecko-flex-1">
          <div className="gecko-row gecko-row-wrap" style={{ gap: 10 }}>
            <span className="gecko-id-link">{s.scheduleNo}</span>
            <span className="gecko-cell-meta">v{s.versionNo}</span>
            <span className={`gecko-pill gecko-pill-${STATUS_TONE[s.status] ?? 'neutral'}`}>{s.status}</span>
            <span className={`gecko-pill gecko-pill-${STATUS_TONE[s.lifecycle] ?? 'neutral'}`}>{s.lifecycle}</span>
            <span className={`gecko-pill gecko-pill-${tone.tone}`}>
              <Icon name={tone.icon} size={11} style={{ marginBottom: -1, marginRight: 4 }} /> {tone.label}
            </span>
            {!s.isEditable && <span style={{ fontSize: 11, color: 'var(--gecko-text-disabled)', fontStyle: 'italic' }}>frozen — a change is a new version</span>}
          </div>
          <div className="gecko-row gecko-row-baseline gecko-row-wrap gecko-mt-1" style={{ gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{s.name}</h1>
            <span style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', fontFamily: 'var(--gecko-font-mono)' }}>{partySummary(s)}</span>
          </div>
        </div>

        {/* Workflow actions — the API refuses anything illegal, this only hides what is pointless */}
        <div className="gecko-row">
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={reloadAll} aria-label="Reload">
            <Icon name="refreshCcw" size={14} />
          </button>
          {s.status === 'DRAFT' && canManage && (
            <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={busy !== null} onClick={() => act('submit')}>
              <Icon name="send" size={14} /> {busy === 'submit' ? 'Submitting…' : 'Submit for approval'}
            </button>
          )}
          {s.status === 'PENDING' && canApprove && (
            <>
              <button className="gecko-btn gecko-btn-outline gecko-btn-sm" disabled={busy !== null} onClick={() => {
                const reason = window.prompt('Why is this tariff rejected?')?.trim();
                if (reason) act('reject', reason);
              }}>
                <Icon name="x" size={14} /> Reject
              </button>
              <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={busy !== null} onClick={() => act('approve')}>
                <Icon name="check" size={14} /> {busy === 'approve' ? 'Approving…' : 'Approve'}
              </button>
            </>
          )}
          {isOpen && canManage && (
            <button className="gecko-btn gecko-btn-outline gecko-btn-sm" disabled={busy !== null} onClick={() => {
              const reason = window.prompt('Why withdraw it?')?.trim();
              if (reason) act('withdraw', reason);
            }}>
              <Icon name="cornerUpLeft" size={14} /> Withdraw
            </button>
          )}
          {s.status === 'APPROVED' && canManage && (
            <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={busy !== null} onClick={revise}>
              <Icon name="copy" size={14} /> {busy === 'revise' ? 'Copying…' : 'New version'}
            </button>
          )}
        </div>
      </div>

      {/* Validity strip */}
      <div style={{ background: 'var(--gecko-bg-surface)', borderBottom: '1px solid var(--gecko-border)', padding: '16px 24px' }}>
        <div className="gecko-grid-4" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', gap: 14 }}>
          <div className="gecko-kpi-tile">
            <div className="gecko-kpi-tile-icon gecko-kpi-tile-icon-primary"><Icon name="calendar" size={16} /></div>
            <div className="gecko-kpi-tile-value" style={{ fontSize: 16 }}>{formatDate(s.effectiveFrom)}</div>
            <div className="gecko-kpi-tile-label">Effective from (branch-local)</div>
          </div>
          <div className="gecko-kpi-tile">
            <div className="gecko-kpi-tile-icon gecko-kpi-tile-icon-warning"><Icon name="clock" size={16} /></div>
            <div className="gecko-kpi-tile-value" style={{ fontSize: 16 }}>{s.effectiveUntil ? formatDate(s.effectiveUntil) : 'Open-ended'}</div>
            <div className="gecko-kpi-tile-label">
              {s.effectiveTo === null && s.effectiveUntil !== null ? 'Ends when the next version starts' : 'Effective until'}
            </div>
          </div>
          <div className="gecko-kpi-tile">
            <div className="gecko-kpi-tile-icon gecko-kpi-tile-icon-info"><Icon name="dollarSign" size={16} /></div>
            <div className="gecko-kpi-tile-value">{s.rateCount}</div>
            <div className="gecko-kpi-tile-label">
              Priced rows · {moveCharges.length} move · {timeCharges.length} time
            </div>
          </div>
          <div className="gecko-kpi-tile">
            <div className="gecko-kpi-tile-icon gecko-kpi-tile-icon-success"><Icon name="layers" size={16} /></div>
            <div className="gecko-kpi-tile-value">{s.scopeRank}</div>
            <div className="gecko-kpi-tile-label">{SCOPE_RANK_LABEL[s.scopeRank] ?? 'Precedence rank'}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: 'var(--gecko-bg-surface)', borderBottom: '1px solid var(--gecko-border)', padding: '0 24px' }}>
        <div className="gecko-tabs">
          {([
            { id: 'overview', label: 'Overview', icon: 'info' },
            { id: 'charges', label: `Move charges (${moveCharges.length})`, icon: 'truck' },
            { id: 'time', label: `Storage & time (${timeCharges.length})`, icon: 'clock' },
            { id: 'free-time', label: `Free time (${freeTime.data?.rules.length ?? 0})`, icon: 'calendar' },
            { id: 'test-move', label: 'Test a move', icon: 'play' },
            { id: 'activity', label: 'Activity', icon: 'activity' },
          ] as { id: Tab; label: string; icon: string }[]).map(t => (
            <button key={t.id} className={`gecko-tab ${tab === t.id ? 'gecko-tab-active' : ''}`} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} size={13} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="gecko-stack gecko-stack-lg" style={{ flex: 1, padding: 24, maxWidth: 'var(--gecko-container-max)', width: '100%', margin: '0 auto' }}>

        {rateSet.error && tab !== 'overview' && (
          <div role="alert" className="gecko-alert gecko-alert-warning gecko-row" style={{ gap: 10 }}>
            <Icon name="alertCircle" size={16} /><span>{rateSet.error.message}</span>
          </div>
        )}

        {tab === 'overview' && (
          <>
            <Card title="Parties & scope" icon="users"
              subtitle={s.scheduleType === 'PUBLIC'
                ? 'A public list applies to every customer with no contract of their own.'
                : 'Every party named here must match the shipment for this tariff to be a candidate.'}>
              <div className="gecko-grid-3" style={{ gap: 14 }}>
                <Field label="Schedule type" value={
                  <span className={`gecko-pill gecko-pill-${tone.tone}`} style={{ fontSize: 11 }}>
                    <Icon name={tone.icon} size={11} style={{ marginBottom: -1, marginRight: 4 }} /> {tone.label}
                  </span>} />
                <Field label="Precedence" value={`rank ${s.scopeRank} — ${SCOPE_RANK_LABEL[s.scopeRank] ?? ''}`} />
                <Field label="Branch" value={s.branchId ? <span className="gecko-text-mono" style={{ fontSize: 12 }}>{s.branchId.slice(0, 8)}…</span> : 'All branches'} />
              </div>
              {s.scheduleType !== 'PUBLIC' && (
                <div className="gecko-grid-4" style={{ gap: 14, marginTop: 14 }}>
                  <PartyChip label="Agent / line" code={s.agentPartyCode} />
                  <PartyChip label="Forwarder" code={s.forwarderPartyCode} />
                  <PartyChip label="Customer" code={s.customerPartyCode} />
                  <PartyChip label="Booking (spot)" code={s.bookingRef} />
                </div>
              )}
              <div className="gecko-grid-4" style={{ gap: 14, marginTop: 14 }}>
                <Field label="Currency" value={s.currencyCode} />
                <Field label="Prices include tax" value={s.pricesIncludeTax ? 'Yes — VAT-inclusive list' : 'No'} />
                <Field label="Damaged empty storage" value={s.waiveDamagedEmptyStorage ? 'Waived' : 'Charged'} />
                <Field label="Version" value={`v${s.versionNo} of lineage ${s.lineageId.slice(0, 8)}…`} />
              </div>
              {s.remarks && (
                <div style={{ marginTop: 14 }}>
                  <Field label="Remarks" value={<span style={{ fontWeight: 400 }}>{s.remarks}</span>} />
                </div>
              )}
            </Card>

            {s.status === 'REJECTED' && s.rejectionReason && (
              <div role="alert" className="gecko-alert gecko-alert-error gecko-row" style={{ gap: 10 }}>
                <Icon name="alertCircle" size={16} />
                <span><strong>Rejected:</strong> {s.rejectionReason}</span>
              </div>
            )}

            <Card title="What the gate will charge" icon="dollarSign"
              subtitle="Charge codes priced in this version. Anything not here falls through to the public tariff, per charge.">
              {rates.length === 0 ? (
                <div className="gecko-cell-meta">No rates on this version yet.</div>
              ) : (
                <div className="gecko-row gecko-row-wrap">
                  {[...new Set(rates.map(r => r.chargeCode))].sort().map(code => (
                    <span key={code} className="gecko-pill gecko-pill-primary" style={{ padding: '6px 12px', fontSize: 12 }}>
                      <strong style={{ fontFamily: 'var(--gecko-font-mono)' }}>{code}</strong>
                      <span style={{ fontWeight: 500, marginLeft: 6, opacity: 0.85 }}>
                        {rates.filter(r => r.chargeCode === code).length} row(s)
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        {tab === 'charges' && <RateTable rates={moveCharges} currency={s.currencyCode} emptyNote="No per-move charges priced here." />}
        {tab === 'time' && <RateTable rates={timeCharges} currency={s.currencyCode} emptyNote="No storage or time-based charges priced here." />}

        {tab === 'free-time' && (
          <Card title="Free time" icon="calendar"
            subtitle="Free units come off BEFORE the tiers are counted: 3 free days and a 1–7 tier means calendar days 4–10 price at tier 1.">
            {(freeTime.data?.rules.length ?? 0) === 0 ? (
              <div className="gecko-cell-meta">No free-time rules on this version — the public tariff decides.</div>
            ) : (
              <table className="gecko-table gecko-table-compact" style={{ fontSize: 12 }}>
                <thead>
                  <tr><th>Kind</th><th>Full / empty</th><th>Direction</th><th>Cargo group</th><th>Size</th><th style={{ textAlign: 'right' }}>Free</th></tr>
                </thead>
                <tbody>
                  {freeTime.data!.rules.map((r, i) => (
                    <tr key={i}>
                      <td className="gecko-mono-strong">{r.freeTimeKind}</td>
                      <td>{axis(r.fullEmpty)}</td>
                      <td>{axis(r.direction)}</td>
                      <td>{axis(r.cargoGroup)}</td>
                      <td>{axis(r.equipmentSize)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{r.freeUnits} {r.unit.toLowerCase()}{r.freeUnits === 1 ? '' : 's'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}

        {tab === 'test-move' && <TestAMove schedule={s} rates={rates} />}

        {tab === 'activity' && (
          <Card title="Approval trail" icon="activity" subtitle="What the API recorded — system versioning keeps every earlier state of the row.">
            <div>
              <TrailRow icon="filePlus" tone="neutral" what="Version created" when={null}
                detail={`v${s.versionNo}${s.versionNo > 1 ? ' — a copy of the previous version, opened as a draft' : ''}`} />
              <TrailRow icon="send" tone="warning" what="Submitted for approval" when={s.submittedAt} />
              {s.status === 'REJECTED'
                ? <TrailRow icon="x" tone="error" what="Rejected" when={null} detail={s.rejectionReason ?? undefined} />
                : <TrailRow icon="check" tone="success" what="Approved — prices live and frozen" when={s.approvedAt}
                    detail={s.approvedBy ? `by user ${s.approvedBy.slice(0, 8)}…${s.approvedBy === user?.userId ? ' (you)' : ''}` : undefined} />}
              <TrailRow icon="clock" tone="info" what={`In force: ${s.lifecycle}`} when={null}
                detail={`${formatDate(s.effectiveFrom)} → ${s.effectiveUntil ? formatDate(s.effectiveUntil) : 'open-ended'}`} last />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ── sub-components ─────────────────────────────────────────────────────── */

function Card({ title, subtitle, icon, right, children }: {
  title: string; subtitle?: string; icon?: string; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="gecko-table-card">
      <div className="gecko-row" style={{ padding: '14px 18px', borderBottom: '1px solid var(--gecko-border)', gap: 10 }}>
        {icon && <Icon name={icon} size={15} style={{ color: 'var(--gecko-primary-600)' }} />}
        <div className="gecko-flex-1">
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
      <div className="gecko-field-label gecko-mb-1">{label}</div>
      <div style={{ fontSize: 13, color: 'var(--gecko-text-primary)', fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function PartyChip({ label, code }: { label: string; code: string | null }) {
  return (
    <div style={{
      padding: '10px 14px',
      background: code ? 'var(--gecko-bg-subtle)' : 'transparent',
      border: '1px solid var(--gecko-border)',
      borderRadius: 10,
    }}>
      <div className="gecko-field-label gecko-mb-1">{label}</div>
      {code
        ? <div className="gecko-id-link" style={{ fontSize: 13, color: 'var(--gecko-primary-700)' }}>{code}</div>
        : <div style={{ fontSize: 12, color: 'var(--gecko-text-disabled)', fontStyle: 'italic' }}>any</div>}
    </div>
  );
}

function TrailRow({ icon, tone, what, when, detail, last }: {
  icon: string; tone: string; what: string; when: string | null; detail?: string; last?: boolean;
}) {
  const happened = when !== null || detail !== undefined;
  return (
    <div className="gecko-row gecko-row-start" style={{ gap: 12, padding: '12px 0', borderBottom: last ? 'none' : '1px solid var(--gecko-border)', opacity: happened ? 1 : 0.45 }}>
      <div className="gecko-mini-icon" style={{ background: `var(--gecko-${tone}-500)`, color: '#fff' }}>
        <Icon name={icon} size={14} />
      </div>
      <div className="gecko-flex-1">
        <div style={{ fontSize: 13, color: 'var(--gecko-text-primary)' }}>{what}</div>
        <div className="gecko-cell-sub">{[when ? formatMoment(when) : null, detail].filter(Boolean).join(' · ') || 'not yet'}</div>
      </div>
    </div>
  );
}

/** One table for every rate row: the axes as columns, because that is what they are. */
function RateTable({ rates, currency, emptyNote }: { rates: Rate[]; currency: string; emptyNote: string }) {
  const byCharge = useMemo(() => {
    const groups = new Map<string, Rate[]>();
    for (const r of rates) groups.set(r.chargeCode, [...(groups.get(r.chargeCode) ?? []), r]);
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rates]);

  if (rates.length === 0) {
    return <Card title="Rates" icon="dollarSign"><div className="gecko-cell-meta">{emptyNote}</div></Card>;
  }

  return (
    <div className="gecko-stack gecko-stack-lg">
      {byCharge.map(([code, rows]) => (
        <Card key={code} title={code} icon="dollarSign" subtitle={`${rows.length} priced row(s) — the most specific match wins`}>
          <div style={{ overflowX: 'auto' }}>
            <table className="gecko-table gecko-table-compact" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Bill to</th><th>Term</th>
                  <th>Order type</th><th>Movement</th><th>Equip</th><th>Size</th><th>Cargo</th><th>Truck</th>
                  <th>Unit</th><th>Method</th>
                  <th style={{ textAlign: 'right' }}>Rate</th>
                  <th style={{ textAlign: 'right' }}>Spec</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {[...rows].sort((a, b) => b.specificity - a.specificity).map(r => (
                  <React.Fragment key={r.tosRateId}>
                    <tr>
                      <td className="gecko-mono-strong">{r.billTo}</td>
                      <td>{r.paymentTermCode}{r.creditTermDays !== null ? ` ${r.creditTermDays}d` : ''}</td>
                      <td>{axis(r.orderTypeCode)}</td>
                      <td>{axis(r.movementCode)}</td>
                      <td>{axis(r.equipmentTypeCode)}</td>
                      <td>{axis(r.equipmentSize)}</td>
                      <td>{axis(r.cargoCategoryCode)}</td>
                      <td>{axis(r.truckCategoryCode)}</td>
                      <td>{r.billingUnitCode}</td>
                      <td>{r.pricingMethod === 'FLAT' ? 'flat' : `${r.pricingMethod.replace('TIERED_', '').toLowerCase()} / ${r.tierBasis?.toLowerCase()}`}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        {r.pricingMethod === 'FLAT'
                          ? money(r.rate, currency)
                          : <span className="gecko-cell-meta">see tiers</span>}
                      </td>
                      <td style={{ textAlign: 'right' }} className="gecko-cell-meta">{r.specificity}</td>
                      <td className="gecko-cell-meta">{r.source}</td>
                    </tr>
                    {(r.tiers.length > 0 || r.conditions.length > 0) && (
                      <tr>
                        <td colSpan={13} style={{ background: 'var(--gecko-bg-subtle)' }}>
                          {r.tiers.length > 0 && (
                            <div className="gecko-row gecko-row-wrap" style={{ gap: 8, marginBottom: r.conditions.length > 0 ? 8 : 0 }}>
                              <span className="gecko-field-label">Tiers ({r.tierBasis?.toLowerCase()}, chargeable units)</span>
                              {r.tiers.map((t, i) => (
                                <span key={i} className="gecko-pill gecko-pill-neutral" style={{ fontSize: 11 }}>
                                  {tierLabel(t)} → <strong>{money(t.rate, currency)}</strong>
                                </span>
                              ))}
                            </div>
                          )}
                          {r.conditions.length > 0 && (
                            <div className="gecko-row gecko-row-wrap" style={{ gap: 8 }}>
                              <span className="gecko-field-label">Surcharges (applied in order)</span>
                              {[...r.conditions].sort((a, b) => a.sequenceNo - b.sequenceNo).map(c => (
                                <span key={c.sequenceNo} className="gecko-pill gecko-pill-warning" style={{ fontSize: 11 }}>{conditionText(c)}</span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}

/**
 * The real resolver over HTTP. It does NOT force this schedule: it prices the
 * shipment as the gate would, and the trail shows whether this version won —
 * which is the question worth asking before approving a price.
 */
function TestAMove({ schedule, rates }: { schedule: Schedule; rates: Rate[] }) {
  const chargeCodes = useMemo(() => [...new Set(rates.map(r => r.chargeCode))].sort(), [rates]);
  const orderTypes = useMemo(() => [...new Set(rates.map(r => r.orderTypeCode).filter(Boolean))] as string[], [rates]);
  const sizes = useMemo(() => [...new Set(rates.map(r => r.equipmentSize).filter(Boolean))] as string[], [rates]);
  const cargoCategories = useMemo(() => [...new Set(rates.map(r => r.cargoCategoryCode).filter(Boolean))] as string[], [rates]);
  const firstRate = rates[0];

  const [form, setForm] = useState<PriceRequest>({
    moduleCode: schedule.moduleCode,
    eventTime: new Date().toISOString(),
    chargeCode: chargeCodes[0] ?? 'LIFTIN',
    billTo: firstRate?.billTo ?? 'CUSTOMER',
    paymentTermCode: firstRate?.paymentTermCode ?? 'CREDIT',
    branchId: schedule.branchId,
    agentPartyCode: schedule.agentPartyCode,
    forwarderPartyCode: schedule.forwarderPartyCode,
    customerPartyCode: schedule.customerPartyCode,
    bookingRef: schedule.bookingRef,
    orderTypeCode: orderTypes[0] ?? null,
    equipmentSize: sizes[0] ?? null,
    cargoCategoryCode: cargoCategories[0] ?? null,
    quantity: 1,
    freeTimeKind: null,
    fullEmpty: 'FULL',
    direction: 'IMPORT',
  });
  const [result, setResult] = useState<PriceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pricing, setPricing] = useState(false);

  const set = <K extends keyof PriceRequest>(key: K, value: PriceRequest[K]) => setForm(f => ({ ...f, [key]: value }));

  const selectedRate = rates.find(r => r.chargeCode === form.chargeCode);
  const isDurationCharge = selectedRate ? isTimeCharge(selectedRate) : false;

  async function run() {
    setPricing(true);
    setError(null);
    try {
      const body: PriceRequest = {
        ...form,
        eventTime: new Date(form.eventTime).toISOString(),
        freeTimeKind: isDurationCharge ? (form.freeTimeKind ?? 'STORAGE') : null,
      };
      setResult(await apiSend<PriceResult>('POST', '/api/revenue/price', body));
    } catch (e) {
      setResult(null);
      setError(e instanceof ApiError ? e.message : 'Could not reach the Gecko API.');
    } finally {
      setPricing(false);
    }
  }

  const currency = result?.currencyCode ?? schedule.currencyCode;

  return (
    <div className="gecko-stack gecko-stack-lg">
      <Card title="Price one move" icon="play"
        subtitle="Calls POST /api/revenue/price — the same resolver the gate and the cashier use. Nothing is saved.">
        <div className="gecko-grid-4" style={{ gap: 14 }}>
          <Labelled label="Charge">
            <select className="gecko-input" value={form.chargeCode} onChange={e => set('chargeCode', e.target.value)}>
              {(chargeCodes.length > 0 ? chargeCodes : ['LIFTIN', 'LIFTOUT', 'STORAGE']).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Labelled>
          <Labelled label="Bill to">
            <select className="gecko-input" value={form.billTo} onChange={e => set('billTo', e.target.value)}>
              {['CUSTOMER', 'LINE', 'AGENT', 'FORWARDER', 'SHIPPER', 'CONSIGNEE', 'HAULIER'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Labelled>
          <Labelled label="Payment term">
            <select className="gecko-input" value={form.paymentTermCode} onChange={e => set('paymentTermCode', e.target.value)}>
              {['CREDIT', 'CASH', 'COD', 'PREPAID'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Labelled>
          <Labelled label="Event time (with offset)">
            <input className="gecko-input" type="datetime-local"
              value={toLocalInput(form.eventTime)}
              onChange={e => set('eventTime', new Date(e.target.value).toISOString())} />
          </Labelled>

          <Labelled label="Order type">
            <input className="gecko-input" value={form.orderTypeCode ?? ''} placeholder="any"
              onChange={e => set('orderTypeCode', e.target.value || null)} list="tt-order-types" />
            <datalist id="tt-order-types">{orderTypes.map(o => <option key={o} value={o} />)}</datalist>
          </Labelled>
          <Labelled label="Equipment size">
            <input className="gecko-input" value={form.equipmentSize ?? ''} placeholder="any"
              onChange={e => set('equipmentSize', e.target.value || null)} list="tt-sizes" />
            <datalist id="tt-sizes">{sizes.map(o => <option key={o} value={o} />)}</datalist>
          </Labelled>
          <Labelled label="Equipment type">
            <input className="gecko-input" value={form.equipmentTypeCode ?? ''} placeholder="any (supplies reefer / OOG)"
              onChange={e => set('equipmentTypeCode', e.target.value || null)} />
          </Labelled>
          <Labelled label="Cargo category">
            <input className="gecko-input" value={form.cargoCategoryCode ?? ''} placeholder="any"
              onChange={e => set('cargoCategoryCode', e.target.value || null)} list="tt-cargo" />
            <datalist id="tt-cargo">{cargoCategories.map(o => <option key={o} value={o} />)}</datalist>
          </Labelled>

          <Labelled label={isDurationCharge ? `Quantity (${selectedRate?.tierBasis?.toLowerCase() ?? 'day'}s, calendar)` : 'Quantity'}>
            <input className="gecko-input" type="number" min={0} step="0.01" value={form.quantity ?? 1}
              onChange={e => set('quantity', Number(e.target.value))} />
          </Labelled>
          <Labelled label="Gross weight (kg)">
            <input className="gecko-input" type="number" min={0} value={form.grossWeightKg ?? ''} placeholder="—"
              onChange={e => set('grossWeightKg', e.target.value === '' ? null : Number(e.target.value))} />
          </Labelled>
          <Labelled label="Full / empty">
            <select className="gecko-input" value={form.fullEmpty ?? ''} onChange={e => set('fullEmpty', e.target.value || null)}>
              <option value="">any</option><option value="FULL">FULL</option><option value="EMPTY">EMPTY</option>
            </select>
          </Labelled>
          <Labelled label="Direction">
            <select className="gecko-input" value={form.direction ?? ''} onChange={e => set('direction', e.target.value || null)}>
              <option value="">any</option><option value="IMPORT">IMPORT</option><option value="EXPORT">EXPORT</option><option value="LOCAL">LOCAL</option>
            </select>
          </Labelled>
        </div>

        <div className="gecko-row" style={{ marginTop: 16, gap: 12 }}>
          <label className="gecko-row" style={{ fontSize: 13, gap: 6 }}>
            <input type="checkbox" checked={form.isDangerousGoods ?? false} onChange={e => set('isDangerousGoods', e.target.checked)} />
            Dangerous goods
          </label>
          <div className="gecko-flex-1" />
          <span className="gecko-cell-meta">
            Parties come from this schedule: {partySummary(schedule)}
          </span>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={pricing} onClick={run}>
            <Icon name="play" size={14} /> {pricing ? 'Pricing…' : 'Price it'}
          </button>
        </div>
      </Card>

      {error && (
        <div role="alert" className="gecko-alert gecko-alert-error gecko-row" style={{ gap: 10 }}>
          <Icon name="alertCircle" size={16} /><span>{error}</span>
        </div>
      )}

      {result && (
        <>
          <Card
            title={result.outcome === 'PRICED' ? 'Priced' : 'No price found'}
            icon={result.outcome === 'PRICED' ? 'checkCircle' : 'alertCircle'}
            subtitle={result.outcome === 'PRICED'
              ? `${result.scheduleNo} v${result.versionNo} (${result.scheduleType}, rank ${result.scopeRank})${result.scheduleId === schedule.scheduleId ? ' — this version' : ' — NOT this version'}`
              : 'The gate would refuse a coupon and the accrual job would park this line for review.'}
            right={result.outcome === 'PRICED' && (
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gecko-primary-700)' }}>{money(result.amount, currency)}</div>
            )}>
            <div className="gecko-grid-4" style={{ gap: 14 }}>
              <Field label="Priced for (branch-local date)" value={formatDate(result.pricedForDate)} />
              <Field label="Method" value={result.pricingMethod ?? '—'} />
              <Field label="Unit" value={result.billingUnitCode ?? '—'} />
              <Field label="Specificity" value={result.specificity?.toString() ?? '—'} />
              <Field label="Quantity" value={result.quantity.toString()} />
              <Field label="Free units" value={result.freeUnits === null ? '—' : `${result.freeUnits}${result.freeTimeFromScheduleNo ? ` (from ${result.freeTimeFromScheduleNo})` : ''}`} />
              <Field label="Chargeable" value={result.chargeableQuantity?.toString() ?? '—'} />
              <Field label="Base / unit rate" value={`${money(result.baseRate, currency)} / ${money(result.unitRate, currency)}`} />
            </div>

            {result.tiers.length > 0 && (
              <table className="gecko-table gecko-table-compact" style={{ fontSize: 12, marginTop: 16 }}>
                <thead>
                  <tr><th>Tier</th><th style={{ textAlign: 'right' }}>Units</th><th style={{ textAlign: 'right' }}>Rate</th><th style={{ textAlign: 'right' }}>Amount</th></tr>
                </thead>
                <tbody>
                  {result.tiers.map((t, i) => (
                    <tr key={i}>
                      <td className="gecko-mono-strong">{tierLabel(t)}</td>
                      <td style={{ textAlign: 'right' }}>{t.quantity}</td>
                      <td style={{ textAlign: 'right' }}>{money(t.rate, currency)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(t.amount, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {result.conditions.length > 0 && (
              <div className="gecko-stack gecko-stack-sm" style={{ marginTop: 16 }}>
                <span className="gecko-field-label">Surcharges applied, in order</span>
                {result.conditions.map(c => (
                  <div key={c.sequenceNo} className="gecko-row" style={{ gap: 8, fontSize: 12 }}>
                    <span className="gecko-pill gecko-pill-warning" style={{ fontSize: 11 }}>{c.sequenceNo}</span>
                    <span>{c.label}</span>
                    <span className="gecko-cell-meta">{money(c.before, currency)} → <strong>{money(c.after, currency)}</strong></span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Why — every tariff the resolver tried" icon="gitBranch"
            subtitle="In precedence order. This is the trail the gate snapshots onto the charge line.">
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12, lineHeight: 1.9 }}>
              {result.precedenceTrail.map((line, i) => (
                <li key={i} style={{ color: line.includes('CHOSEN') ? 'var(--gecko-success-700)' : 'var(--gecko-text-secondary)', fontWeight: line.includes('CHOSEN') ? 700 : 400 }}>
                  {line}
                </li>
              ))}
            </ol>
          </Card>
        </>
      )}
    </div>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="gecko-field-label gecko-mb-1">{label}</div>
      {children}
    </div>
  );
}

/** The day after a date, as YYYY-MM-DD. */
function nextDay(date: string): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** <input type="datetime-local"> wants local wall-clock with no zone. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
