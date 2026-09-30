"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useApi } from '@/lib/api/use-api';
import { useServerList } from '@/lib/api/use-server-list';
import { apiSend } from '@/lib/api/client';
import { ApiError } from '@/lib/api/problem';
import { useSession } from '@/lib/auth/session';
import { formatContainerNo, formatDateTime } from '@/lib/api/tos';
import {
  AGE_LABEL, AGE_TONE, AUTHORITY_LABEL, HOLD_SOURCES, ageLabel, scopeLabel,
  type HoldBoardRow, type HoldSummary,
} from '@/lib/api/holds';

/**
 * HOLDS BOARD — live against gecko_tos `yard.container_hold` (TIER3 §7).
 *
 * Read-only over the hold rows that already exist: what is held, where, since
 * when, by whom and who may lift it. The one write is a release, through the
 * existing release endpoint, and only where the API says this user may make it.
 *
 * A hold has a depot: a booking hold is its booking's; a box hold is the depot
 * the box stands in. A hold on a box in no yard shows at every depot — it
 * surfaces at whichever gate the box reaches.
 */
type Tab = 'ACTIVE' | 'RELEASED';

export default function HoldsBoardPage() {
  const { user } = useSession();
  const [tab, setTab] = useState<Tab>('ACTIVE');
  const [branchId, setBranchId] = useState('');
  const [holdCode, setHoldCode] = useState('');
  const [holdType, setHoldType] = useState('');
  const [blockingScope, setBlockingScope] = useState('');
  const [source, setSource] = useState('');
  const [releasing, setReleasing] = useState<HoldBoardRow | null>(null);

  const summary = useApi<HoldSummary>(`/api/tos/holds/summary${branchId ? `?branchId=${branchId}` : ''}`);
  const list = useServerList<HoldBoardRow>('/api/tos/holds/board',
    { status: tab, branchId, holdCode, holdType, blockingScope, source }, 'holds');

  const s = summary.data;
  const rows = list.rows ?? [];
  const typeRetired = new Set((s?.byHold ?? []).filter(h => !h.typeIsActive).map(h => h.holdCode));
  const releasedToday = s?.releasedPerDay.at(-1)?.count ?? 0;
  const releasedInWindow = s?.releasedPerDay.reduce((n, d) => n + d.count, 0) ?? 0;
  const overAWeek = (s?.ageing ?? []).filter(a => a.key === '7_TO_30_DAYS' || a.key === '30_DAYS_PLUS').reduce((n, a) => n + a.count, 0);
  const inNoYard = s?.byDepot.find(d => d.branchId === null)?.count ?? 0;
  const depots = (s?.byDepot ?? []).filter(d => d.branchId !== null);
  const reload = () => { summary.reload(); list.reload(); };
  const error = summary.error ?? list.error;

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', paddingBottom: 60 }}>

      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline gecko-stack-md">
            <h1 className="gecko-page-title">Holds board</h1>
            <span className="gecko-badge gecko-badge-success">LIVE</span>
            <span className="gecko-count-badge">{s ? `${s.active} active` : '…'}</span>
          </div>
          <div className="gecko-page-subtitle gecko-mt-1">
            Every hold is a row with a person and a reason. It is lifted only by a release, on record,
            by someone the hold&apos;s release authority allows.
          </div>
        </div>
        <div className="gecko-toolbar">
          <select className="gecko-input" aria-label="Depot" value={branchId} onChange={e => setBranchId(e.target.value)} style={{ minWidth: 170 }}>
            <option value="">All my depots</option>
            {depots.map(d => <option key={d.branchId} value={d.branchId!}>{d.branchCode ?? d.branchId}</option>)}
            {branchId && !depots.some(d => d.branchId === branchId) && <option value={branchId}>Selected depot</option>}
          </select>
          <Link href="/gate/stock" className="gecko-btn gecko-btn-outline gecko-btn-sm">
            <Icon name="layers" size={16} /> Yard stock
          </Link>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={reload}>
            <Icon name="refreshCcw" size={16} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="gecko-alert gecko-alert-error">
          <Icon name="alertCircle" size={18} />
          <div>
            <div style={{ fontWeight: 600 }}>{error.title}</div>
            {error.explanation && <div>{error.explanation}</div>}
          </div>
        </div>
      )}

      <div className="gecko-grid-5" style={{ gap: 14 }}>
        <Kpi label="Active holds" value={s?.active} accent="var(--gecko-error-400)" sub={s ? `${s.byHold.length} hold codes` : undefined} />
        <Kpi label="Held 7 days or more" value={s ? overAWeek : undefined} accent="var(--gecko-warning-400)" />
        <Kpi label="On boxes in no yard" value={s ? inNoYard : undefined} accent="var(--gecko-info-400)" sub="Show at every depot" />
        <Kpi label="Released today" value={s ? releasedToday : undefined} accent="var(--gecko-success-400)" />
        <Kpi label={`Released, last ${s?.releasedPerDay.length ?? 14} days`} value={s ? releasedInWindow : undefined} accent="var(--gecko-success-400)" />
      </div>

      {s && (
        <div className="gecko-grid-3" style={{ gap: 20 }}>
          <Widget title="Active by hold">
            {s.byHold.length === 0 ? <div className="gecko-cell-meta">No active holds.</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {s.byHold.map(h => (
                  <Bar key={h.holdCode} active={holdCode === h.holdCode}
                       onClick={() => setHoldCode(holdCode === h.holdCode ? '' : h.holdCode)}
                       label={<>{h.holdCode}<span className="gecko-cell-meta"> · {h.description ?? 'hold type deleted'}{!h.typeIsActive && ' (retired)'}</span></>}
                       count={h.count} total={s.active} color={h.displayColorHex ?? 'var(--gecko-error-600)'} />
                ))}
              </div>
            )}
          </Widget>

          <Widget title="Active by age">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {s.ageing.map(a => (
                <Bar key={a.key} label={AGE_LABEL[a.key] ?? a.key} count={a.count} total={s.active} color={AGE_TONE[a.key] ?? 'var(--gecko-primary-400)'} />
              ))}
            </div>
          </Widget>

          <Widget title={`Released per day — last ${s.releasedPerDay.length} days`}>
            <ReleaseTrend days={s.releasedPerDay} />
            <div className="gecko-row" style={{ gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
              <Chips title="What they block" items={s.byBlockingScope.map(c => ({ key: c.key, label: scopeLabel(c.key), count: c.count }))}
                     selected={blockingScope} onSelect={setBlockingScope} />
              <Chips title="Placed by" items={s.bySource.map(c => ({ key: c.key, label: c.key.toLowerCase(), count: c.count }))}
                     selected={source} onSelect={setSource} />
            </div>
          </Widget>
        </div>
      )}

      <div className="gecko-tabs" role="tablist">
        {(['ACTIVE', 'RELEASED'] as Tab[]).map(t => (
          <button key={t} role="tab" aria-selected={tab === t} className={`gecko-tab ${tab === t ? 'gecko-tab-active' : ''}`} onClick={() => setTab(t)}>
            {t === 'ACTIVE' ? 'Active holds' : 'Released history'}
          </button>
        ))}
      </div>

      <div className="gecko-card" style={{ padding: 14 }}>
        <div className="gecko-row gecko-stack-md" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="gecko-form-group" style={{ flex: '1 1 240px' }}>
            <label className="gecko-form-label">Container, booking or reference</label>
            <input className="gecko-input" value={list.search} placeholder="ABCU1234567, BK-… or a customs entry"
                   onChange={e => list.setSearch(e.target.value)} />
          </div>
          <FilterSelect label="Hold" value={holdCode} onChange={setHoldCode}
                        options={(s?.byHold ?? []).map(h => ({ value: h.holdCode, label: h.holdCode }))} />
          <FilterSelect label="Hold type" value={holdType} onChange={setHoldType}
                        options={(s?.byHoldType ?? []).filter(c => c.key !== 'UNKNOWN').map(c => ({ value: c.key, label: c.key }))} />
          <FilterSelect label="Blocks" value={blockingScope} onChange={setBlockingScope}
                        options={(s?.byBlockingScope ?? []).filter(c => c.key !== 'UNKNOWN').map(c => ({ value: c.key, label: scopeLabel(c.key) }))} />
          <FilterSelect label="Source" value={source} onChange={setSource}
                        options={HOLD_SOURCES.map(v => ({ value: v, label: v.toLowerCase() }))} />
        </div>
      </div>

      {!list.loading && rows.length === 0 && !list.error ? (
        <EmptyState
          icon="shieldCheck"
          title={tab === 'ACTIVE' ? 'Nothing held' : 'No releases'}
          description={tab === 'ACTIVE'
            ? 'No active hold matches these filters. A hold appears here the moment it is placed — by hand, by EDI or by a survey.'
            : 'No released hold matches these filters.'}
        />
      ) : (
        <div className="gecko-card" style={{ padding: 0, overflow: 'auto' }}>
          <table className="gecko-table">
            <thead>
              {tab === 'ACTIVE' ? (
                <tr>
                  <th>Held</th><th>Hold</th><th>Blocks</th><th>Depot</th><th>Placed</th><th>Age</th><th>Released by</th><th />
                </tr>
              ) : (
                <tr>
                  <th>Held</th><th>Hold</th><th>Depot</th><th>Placed</th><th>Released</th><th>Held for</th>
                </tr>
              )}
            </thead>
            <tbody>
              {rows.map(row => {
                const h = row.hold;
                return (
                  <tr key={h.containerHoldId}>
                    <td>
                      {row.heldOn === 'CONTAINER'
                        ? <span style={{ fontFamily: 'var(--gecko-font-mono, monospace)' }}>{formatContainerNo(h.containerNo ?? '')}</span>
                        : <>
                            <Link href={`/bookings/${h.bookingId}`} className="gecko-link">{h.orderNo ?? 'booking'}</Link>
                            <div className="gecko-cell-meta">whole booking · {row.boxesOnBooking ?? 0} boxes</div>
                          </>}
                    </td>
                    <td>
                      <span className="gecko-badge gecko-badge-xs" style={{ background: h.displayColorHex ?? undefined, color: h.displayColorHex ? '#fff' : undefined }}>{h.holdCode}</span>
                      <div className="gecko-cell-meta">
                        {h.description ?? 'hold type deleted'}{h.holdType ? ` · ${h.holdType}` : ''}{typeRetired.has(h.holdCode) ? ' · retired type' : ''}
                      </div>
                    </td>
                    {tab === 'ACTIVE' && <td>{scopeLabel(h.blockingScope)}</td>}
                    <td>{row.depotCode ?? <span className="gecko-cell-meta">in no yard</span>}</td>
                    <td style={{ maxWidth: 280 }}>
                      <div>{formatDateTime(h.appliedAt)} · <span className="gecko-cell-meta">{placedBy(h.source, h.appliedBy, user?.userId)}</span></div>
                      <div className="gecko-cell-meta">{h.applyReason}{h.externalRef ? ` · ref ${h.externalRef}` : ''}</div>
                    </td>
                    {tab === 'ACTIVE' ? (
                      <>
                        <td>
                          <span className={row.ageDays >= 7 ? 'gecko-badge gecko-badge-xs gecko-badge-warning' : undefined}>{ageLabel(row.ageDays)}</span>
                        </td>
                        <td>{h.releaseAuthority ? (AUTHORITY_LABEL[h.releaseAuthority] ?? h.releaseAuthority) : '—'}</td>
                        <td style={{ textAlign: 'right' }}>
                          {row.canRelease
                            ? <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setReleasing(row)}>Release</button>
                            : <span className="gecko-cell-meta" title={row.releasePermission ? `Needs ${row.releasePermission}` : 'The hold type no longer exists in master data'}>
                                {row.releasePermission ? 'not yours to lift' : 'restore hold type'}
                              </span>}
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ maxWidth: 280 }}>
                          <div>{formatDateTime(h.releasedAt)} · <span className="gecko-cell-meta">{placedBy(h.releaseSource ?? 'MANUAL', h.releasedBy, user?.userId)}</span></div>
                          <div className="gecko-cell-meta">{h.releaseReason}{h.releaseRef ? ` · ref ${h.releaseRef}` : ''}</div>
                        </td>
                        <td>{ageLabel(row.ageDays)}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {list.footer}
        </div>
      )}

      {releasing && (
        <ReleaseModal row={releasing} onClose={() => setReleasing(null)} onReleased={() => { setReleasing(null); reload(); }} />
      )}
    </div>
  );
}

/** Who acted, as far as TOS can say: the source, and "you" for the signed-in user. */
function placedBy(source: string, userId: string | null, me: string | undefined): string {
  if (source !== 'MANUAL') return source === 'AUTO' ? 'by a rule' : `by ${source.toLowerCase()}`;
  if (userId && me && userId.toLowerCase() === me.toLowerCase()) return 'by you';
  return 'by hand';
}

function ReleaseModal({ row, onClose, onReleased }: { row: HoldBoardRow; onClose: () => void; onReleased: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [releaseRef, setReleaseRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const h = row.hold;
  const target = h.containerNo ? formatContainerNo(h.containerNo) : h.orderNo ?? 'booking';

  const submit = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await apiSend('POST', `/api/tos/holds/${h.containerHoldId}/release`, {
        reason: reason.trim(), releaseRef: releaseRef.trim() || null, rowVersion: h.rowVersion,
      });
      toast.toast({ variant: 'success', title: `${h.holdCode} released`, message: `${target} — on record under your name.` });
      onReleased();
    } catch (e: unknown) {
      setFailure(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API.'));
    } finally {
      setBusy(false);
    }
  };

  const stale = failure?.status === 409;
  const general = failure && !failure.forField('reason') && !failure.forField('releaseRef') ? failure : null;

  return (
    <Modal isOpen onClose={onClose} title={`Release ${h.holdCode} on ${target}`}
           subtitle={`Released by ${h.releaseAuthority ? (AUTHORITY_LABEL[h.releaseAuthority] ?? h.releaseAuthority) : '—'}. Placed ${formatDateTime(h.appliedAt)}: ${h.applyReason}`}
           footer={
             <>
               <button className="gecko-btn gecko-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
               {stale
                 ? <button className="gecko-btn gecko-btn-primary" onClick={onReleased}>Reload the board</button>
                 : <button className="gecko-btn gecko-btn-primary" onClick={submit} disabled={busy || reason.trim().length < 3 || (row.releaseRefRequired && !releaseRef.trim())}>
                     {busy ? 'Releasing…' : 'Release hold'}
                   </button>}
             </>
           }>
      <div className="gecko-stack" style={{ gap: 14 }}>
        {general && (
          <div className={`gecko-alert gecko-alert-${stale ? 'warning' : 'error'}`}>
            <Icon name="alertCircle" size={18} />
            <div>
              <div style={{ fontWeight: 600 }}>{general.title}</div>
              {general.explanation && <div>{general.explanation}</div>}
            </div>
          </div>
        )}
        <div className="gecko-form-group">
          <label className="gecko-form-label">Why is it released? *</label>
          <textarea className="gecko-input" rows={3} maxLength={500} value={reason} onChange={e => setReason(e.target.value)}
                    placeholder="e.g. Customs release received, D/O charges paid" />
          {failure?.forField('reason') && <div className="gecko-field-error">{failure.forField('reason')}</div>}
        </div>
        <div className="gecko-form-group">
          <label className="gecko-form-label">Release reference{row.releaseRefRequired ? ' *' : ''}</label>
          <input className="gecko-input" maxLength={50} value={releaseRef} onChange={e => setReleaseRef(e.target.value)}
                 placeholder={row.releaseRefRequired ? 'The document you are acting on' : 'Optional'} />
          {failure?.forField('releaseRef') && <div className="gecko-field-error">{failure.forField('releaseRef')}</div>}
        </div>
      </div>
    </Modal>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: number | undefined; sub?: string; accent: string }) {
  return (
    <div className="gecko-card gecko-card-padded" style={{ borderTop: `3px solid ${accent}` }}>
      <div className="gecko-stat-label gecko-mb-2">{label}</div>
      <div className="gecko-stat-num" style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 800, fontSize: 28 }}>{value ?? '…'}</div>
      {sub && <div className="gecko-cell-meta" style={{ marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function Widget({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, boxShadow: 'var(--gecko-shadow-sm)', overflow: 'hidden' }}>
      <div style={{ padding: '13px 20px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)', fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{title}</div>
      <div style={{ padding: '16px 20px' }}>{children}</div>
    </div>
  );
}

function Bar({ label, count, total, color, onClick, active }: {
  label: React.ReactNode; count: number; total: number; color: string; onClick?: () => void; active?: boolean;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div role={onClick ? 'button' : undefined} onClick={onClick}
         style={{ borderLeft: `4px solid ${color}`, paddingLeft: 12, cursor: onClick ? 'pointer' : undefined, background: active ? 'var(--gecko-bg-subtle)' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
        <span className="gecko-cell-primary">{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700 }}>{count}</span>
      </div>
      <div className="gecko-row">
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--gecko-bg-subtle)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3 }} />
        </div>
        <span className="gecko-cell-meta" style={{ fontFamily: 'var(--gecko-font-mono)', minWidth: 38, textAlign: 'right' }}>{pct}%</span>
      </div>
    </div>
  );
}

function ReleaseTrend({ days }: { days: { day: string; count: number }[] }) {
  const max = Math.max(1, ...days.map(d => d.count));
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 90 }}>
        {days.map(d => (
          <div key={d.day} title={`${d.day}: ${d.count} released`}
               style={{ flex: 1, height: `${Math.max(2, (d.count / max) * 100)}%`, background: d.count ? 'var(--gecko-success-600)' : 'var(--gecko-border)', borderRadius: 2 }} />
        ))}
      </div>
      <div className="gecko-row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
        <span className="gecko-cell-meta">{days[0]?.day}</span>
        <span className="gecko-cell-meta">{days.at(-1)?.day}</span>
      </div>
    </div>
  );
}

function Chips({ title, items, selected, onSelect }: {
  title: string; items: { key: string; label: string; count: number }[]; selected: string; onSelect: (v: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="gecko-cell-meta" style={{ marginBottom: 6 }}>{title}</div>
      <div className="gecko-row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {items.map(i => (
          <button key={i.key} type="button" onClick={() => onSelect(selected === i.key ? '' : i.key)}
                  className={`gecko-badge gecko-badge-xs ${selected === i.key ? 'gecko-badge-info' : 'gecko-badge-gray'}`}
                  style={{ cursor: 'pointer', border: 'none' }}>
            {i.label} · {i.count}
          </button>
        ))}
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <div className="gecko-form-group">
      <label className="gecko-form-label">{label}</label>
      <select className="gecko-input" value={value} onChange={e => onChange(e.target.value)}>
        <option value="">All</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        {value && !options.some(o => o.value === value) && <option value={value}>{value}</option>}
      </select>
    </div>
  );
}
