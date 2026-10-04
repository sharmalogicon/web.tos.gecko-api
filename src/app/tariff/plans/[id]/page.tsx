"use client";
import React, { useCallback, useMemo, useState, use } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { Fact } from '@/components/ui/Fact';
import { FreeTimeMatrix } from '../../_components/FreeTimeMatrix';
import { freeTimeDraftsOf } from '../../_components/tariff-drafts';
import { useApi } from '@/lib/api/use-api';
import { useTariffCatalogs } from '@/lib/api/tariff-catalogs';
import { apiSend } from '@/lib/api/client';
import { ApiError } from '@/lib/api/problem';
import { useSession } from '@/lib/auth/session';
import {
  axis, conditionText, formatDate, formatMoment, isTimeCharge, money, partySummary,
  SCOPE_RANK_LABEL, STATUS_TONE, tierLabel, TYPE_TONE,
  type FreeTimeSet, type Rate, type RateSet, type Schedule,
} from '@/lib/api/revenue';
import { ExcelImportPanel } from '../../_components/ExcelImportPanel';

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

type Tab = 'overview' | 'charges' | 'storage' | 'activity';

export default function TariffScheduleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const { can, user } = useSession();
  const searchParams = useSearchParams();
  // ?tab=excel is an old deep link from the new-quotation screen. Excel is no
  // longer a tab — the import card sits on Overview — so it simply lands there.
  const requested = searchParams.get('tab');
  const [tab, setTab] = useState<Tab>(
    requested === 'charges' || requested === 'storage' || requested === 'activity' ? requested : 'overview');
  const [busy, setBusy] = useState<string | null>(null);

  const schedule = useApi<Schedule>(`/api/revenue/tariffs/${id}`);
  const rateSet = useApi<RateSet>(`/api/revenue/tariffs/${id}/rates`);
  const freeTime = useApi<FreeTimeSet>(`/api/revenue/tariffs/${id}/free-time`);

  const s = schedule.data;
  const rates = rateSet.data?.rates ?? [];
  const moveCharges = useMemo(() => rates.filter(r => !isTimeCharge(r)), [rates]);
  const timeCharges = useMemo(() => rates.filter(r => isTimeCharge(r)), [rates]);

  // Mapped once per load: the matrix takes drafts, so one component renders
  // both the editor's grid and this read-only one.
  const freeTimeDrafts = useMemo(() => freeTimeDraftsOf(freeTime.data?.rules ?? []), [freeTime.data]);

  // A rate carries only the charge CODE, so the descriptions come from the
  // master list — the same one the editor's dropdown reads.
  const { catalogs } = useTariffCatalogs('TOS');
  const describe = useCallback(
    (code: string) => catalogs.charges.find(c => c.chargeCode === code)?.descriptionEn ?? '',
    [catalogs]);

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
            <h1 className="gecko-page-title">{s.name}</h1>
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
        <div className="gecko-fact-strip" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto' }}>
          <Fact icon="calendar" tone="primary" value={formatDate(s.effectiveFrom)} label="Effective from (branch-local)" />
          <Fact icon="clock" tone="warning"
            value={s.effectiveUntil ? formatDate(s.effectiveUntil) : 'Open-ended'}
            label={s.effectiveTo === null && s.effectiveUntil !== null ? 'Ends when the next version starts' : 'Effective until'} />
          <Fact icon="dollarSign" tone="info" value={String(s.rateCount)}
            label={`Priced rows · ${moveCharges.length} move · ${timeCharges.length} time`} />
          <Fact icon="layers" tone="success" value={String(s.scopeRank)}
            label={SCOPE_RANK_LABEL[s.scopeRank] ?? 'Precedence rank'} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: 'var(--gecko-bg-surface)', borderBottom: '1px solid var(--gecko-border)', padding: '0 24px' }}>
        <div className="gecko-tabs">
          {([
            { id: 'overview', label: 'Overview', icon: 'info' },
            { id: 'charges', label: `Move charges (${moveCharges.length})`, icon: 'truck' },
            { id: 'storage', label: `Storage & time (${timeCharges.length})`, icon: 'clock' },
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
            {/* Excel is no longer a tab. The import belongs with the tariff it
                fills, and only while that version can still take one — a freshly
                created draft lands here with nothing priced, which is exactly
                when a clerk wants to drop the customer's workbook in. */}
            {s.isEditable && canManage && can('revenue.import.manage') && (
              <ExcelImportPanel scheduleId={s.scheduleId} scheduleNo={s.scheduleNo} versionNo={s.versionNo}
                editable onApplied={reloadAll} />
            )}
            {/* Parties on the left, storage free days beside them — the shape of
                Vector's Customer Rate Profile, in our cards. */}
            <div className="gecko-tariff-header-split">
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
            <Card title="Storage free days" icon="calendar"
              subtitle="Days free before storage starts to price. Free days come off before the tiers are counted.">
              <FreeTimeMatrix rules={freeTimeDrafts} readOnly />
            </Card>
            </div>

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

        {tab === 'charges' && <RateTable rates={moveCharges} currency={s.currencyCode} describe={describe} emptyNote="No per-move charges priced here." />}
        {tab === 'storage' && (
          <RateTable rates={timeCharges} currency={s.currencyCode} describe={describe} emptyNote="No storage or time-based charges priced here." />
        )}

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
function RateTable({ rates, currency, emptyNote, describe }: {
  rates: Rate[]; currency: string; emptyNote: string;
  /** A charge code is an identifier, not a label — the description makes the card readable. */
  describe: (code: string) => string;
}) {
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
        <Card key={code} title={code} icon="dollarSign"
          subtitle={[describe(code), `${rows.length} priced row(s) — the most specific match wins`].filter(Boolean).join(' · ')}>
          <div style={{ overflowX: 'auto' }}>
            <table className="gecko-table gecko-table-compact">
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


/** The day after a date, as YYYY-MM-DD. */
function nextDay(date: string): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
