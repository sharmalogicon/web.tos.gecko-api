"use client";
import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { BarcodeScanInput } from '@/components/ui/BarcodeDisplay';
import { EmptyState } from '@/components/ui/EmptyState';
import { useApi, useApiList, type Paged } from '@/lib/api/use-api';
import { useSession } from '@/lib/auth/session';
import { dwellLabel, formatContainerNo, formatDateTime, type GateTransactionSummary } from '@/lib/api/tos';
import { eirPath, formatKg, type ContainerHolds } from '@/lib/api/gate-eir';
import type { Hold } from '@/lib/api/holds';
import { REEFER_SESSIONS_PATH, type ReeferSession } from '@/lib/api/reefer';
import { yardsPath, type Yard } from '@/lib/api/yards';
import {
  STORY_PERMISSIONS, eventLabel, isWellFormedContainerNo, normaliseContainerNo, registryPath, storyPath,
  type ContainerStory, type RegistryContainer, type StoryVisit,
} from '@/lib/api/container-story';

/**
 * UNIT INQUIRY — one box's story, live against Gecko.Api.
 *
 * Where it is now (the open stay: depot, yard, position, full/empty, dwell), every
 * stay before with its journal, its EIRs, the holds on it now and those released,
 * the bookings it has been on, its reefer plug sessions and its registry facts.
 * Everything is read-only here; each section links to the screen that changes it.
 *
 * The number travels in the URL (?no=) so an EIR, the stock list or a colleague
 * can link straight to a box. /gate/container-status redirects here.
 */
export default function UnitInquiryPage() {
  return (
    <Suspense fallback={<div className="gecko-cell-meta" style={{ padding: 24 }}>Loading…</div>}>
      <UnitInquiry />
    </Suspense>
  );
}

type Tab = 'now' | 'visits' | 'moves' | 'holds' | 'bookings' | 'reefer';

function UnitInquiry() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { can } = useSession();
  const [tab, setTab] = useState<Tab>('now');

  const typed = params.get('no') ?? '';
  const no = normaliseContainerNo(typed);
  const wellFormed = isWellFormedContainerNo(no);
  const asked = wellFormed ? no : null;

  const lookUp = (raw: string) => {
    setTab('now');
    router.replace(`${pathname}?no=${encodeURIComponent(normaliseContainerNo(raw))}`);
  };

  const story = useApi<ContainerStory>(asked ? storyPath(asked) : null);
  const registry = useApi<RegistryContainer>(asked && can(STORY_PERMISSIONS.registryView) ? registryPath(asked) : null);
  const moves = useApiList<GateTransactionSummary>(asked ? `/api/tos/gate/transactions?containerNo=${asked}&pageSize=100` : null);
  const activeHolds = useApi<ContainerHolds>(asked && can(STORY_PERMISSIONS.holdView) ? `/api/tos/containers/${asked}/holds` : null);
  const released = useApiList<Hold>(asked && can(STORY_PERMISSIONS.holdView) ? `/api/tos/holds?containerNo=${asked}&status=RELEASED&pageSize=100` : null);
  const reefer = useApi<Paged<ReeferSession>>(asked && can(STORY_PERMISSIONS.reeferView)
    ? `${REEFER_SESSIONS_PATH}?search=${asked}&status=ALL&pageSize=100` : null);

  const s = story.data;
  const current = s?.current ?? null;
  const yards = useApiList<Yard>(current?.yardId && can(STORY_PERMISSIONS.yardView) ? yardsPath(current.branchId) : null);
  const yard = current?.yardId ? yards.data?.find(y => y.yardId === current.yardId) ?? null : null;

  // The search is the whole number, so the reefer "contains" search is narrowed to this box.
  const sessions = (reefer.data?.items ?? []).filter(r => r.containerNo === asked);
  const moveRows = moves.data ?? [];
  const holdsNow = activeHolds.data?.holds ?? [];
  const holdsGone = released.data ?? [];
  const reg = registry.data;
  const loaded = !!s && s.containerNo === asked;
  const nothing = loaded && s.visits.length === 0 && s.bookings.length === 0 && moveRows.length === 0 && !reg;

  return (
    <div className="gecko-stack" style={{ gap: 18, maxWidth: 'var(--gecko-container-max)', margin: '0 auto', paddingBottom: 60 }}>

      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline gecko-stack-md">
            <h1 className="gecko-page-title">Unit inquiry</h1>
            <span className="gecko-badge gecko-badge-success">LIVE</span>
          </div>
          <div className="gecko-page-subtitle gecko-mt-1">
            A box&apos;s full story: where it is now, every stay and event, its EIRs, holds, bookings, plug sessions and registry facts.
          </div>
        </div>
        <div className="gecko-toolbar">
          <Link href="/gate/stock" className="gecko-btn gecko-btn-outline gecko-btn-sm">
            <Icon name="layers" size={16} /> Yard stock
          </Link>
        </div>
      </div>

      <div className="gecko-card gecko-card-padded gecko-stack" style={{ gap: 14 }}>
        <div className="gecko-eyebrow">Container lookup</div>
        <div className="gecko-row gecko-row-wrap" style={{ gap: 10 }}>
          <BarcodeScanInput
            onScan={lookUp}
            placeholder="Scan or type a container number + Enter (e.g. MSKU1234565)…"
            size="md"
            autoFocus
            style={{ flex: 1, minWidth: 320 }}
          />
          {typed && (
            <button onClick={() => router.replace(pathname)} className="gecko-btn gecko-btn-ghost gecko-btn-sm">
              <Icon name="x" size={13} /> Clear
            </button>
          )}
        </div>
        {typed && !wellFormed && (
          <div className="gecko-field-error">
            &lsquo;{typed}&rsquo; is not a container number (4 letters ending U/J/Z, 7 digits).
          </div>
        )}
        {story.error && story.error.status === 400 && (
          <div className="gecko-field-error">{story.error.forField('containerNo') ?? story.error.title}</div>
        )}
      </div>

      {!typed && (
        <EmptyState icon="search" title="Type or scan a container number"
          description="The box's current stay, its history at your depots, its EIRs, holds, bookings and registry record." />
      )}

      {asked && story.error && story.error.status !== 400 && (
        <div className="gecko-alert gecko-alert-error">
          <Icon name="alertCircle" size={18} />
          <div>
            <div style={{ fontWeight: 600 }}>{story.error.title}</div>
            {story.error.explanation && <div>{story.error.explanation}</div>}
          </div>
        </div>
      )}

      {asked && !loaded && !story.error && <div className="gecko-cell-meta" style={{ padding: 12 }}>Reading the box&apos;s story…</div>}

      {nothing && (
        <EmptyState icon="search" title="Nothing on record"
          description={<>No stay, EIR, booking or registry record for <code className="gecko-code">{formatContainerNo(asked!)}</code> at the depots you cover.</>} />
      )}

      {loaded && !nothing && s && (
        <div className="gecko-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="gecko-row gecko-row-wrap" style={{ padding: '16px 20px', background: 'var(--gecko-primary-50)', borderBottom: '1px solid var(--gecko-border)', gap: 18 }}>
            <Banner label="Container" value={formatContainerNo(s.containerNo)} big />
            <Divider />
            <Banner label="Type" value={[reg?.typeCode ?? current?.equipmentTypeCode ?? s.visits[0]?.equipmentTypeCode, reg?.isoCode && `ISO ${reg.isoCode}`].filter(Boolean).join(' · ') || '—'} />
            <Divider />
            <Banner label="Line" value={current?.lineCode ?? s.visits[0]?.lineCode ?? s.bookings[0]?.lineCode ?? reg?.ownerCode ?? '—'} />
            <Divider />
            <div>
              <div className="gecko-eyebrow">Status</div>
              <div className="gecko-row" style={{ gap: 6, marginTop: 4 }}>
                <span className={`gecko-badge gecko-badge-${s.isInYard ? 'success' : 'gray'}`}>{s.isInYard ? 'IN YARD' : 'NOT IN YARD'}</span>
                {activeHolds.data?.isHeld && <span className="gecko-badge gecko-badge-error">HELD</span>}
                {reg && reg.status !== 'ACTIVE' && <span className="gecko-badge gecko-badge-warning">{reg.status}</span>}
              </div>
            </div>
          </div>

          <div className="gecko-grid-4" style={{ gap: 0, borderBottom: '1px solid var(--gecko-border)' }}>
            <Strip label="Depot · yard" value={current ? [current.branchCode, yard?.yardCode].filter(Boolean).join(' · ') || '—' : '—'} />
            <Strip label="Position" value={current?.positionText ?? '—'} mono />
            <Strip label="Full / empty" value={current?.fullEmpty ?? '—'} />
            <Strip label="In yard" value={current ? `${dwellLabel(current.daysInYard)} (since ${formatDateTime(current.gateInAt)})` : '—'} />
          </div>

          <div className="gecko-row" style={{ gap: 0, padding: '0 20px', borderBottom: '1px solid var(--gecko-border)', flexWrap: 'wrap' }}>
            {([
              ['now', 'Now & registry', 'box'],
              ['visits', `Stays (${s.visits.length})`, 'clock'],
              ['moves', `EIRs (${moveRows.length})`, 'transferH'],
              ...(can(STORY_PERMISSIONS.holdView) ? [['holds', `Holds (${holdsNow.length} active)`, 'lock'] as const] : []),
              ['bookings', `Bookings (${s.bookings.length})`, 'clipboardList'],
              ...(can(STORY_PERMISSIONS.reeferView) ? [['reefer', `Reefer (${sessions.length})`, 'thermometer'] as const] : []),
            ] as const).map(([k, label, icon]) => {
              const active = tab === k;
              return (
                <button key={k} onClick={() => setTab(k)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 7,
                    fontSize: 13, fontWeight: active ? 700 : 500,
                    color: active ? 'var(--gecko-primary-700)' : 'var(--gecko-text-secondary)',
                    borderBottom: `2px solid ${active ? 'var(--gecko-primary-600)' : 'transparent'}`,
                    marginBottom: -1,
                  }}>
                  <Icon name={icon} size={14} /> {label}
                </button>
              );
            })}
          </div>

          <div style={{ padding: 20 }}>
            {tab === 'now' && <NowTab current={current} yard={yard} registry={reg} registryError={registry.error?.status ?? null}
              canRegistry={can(STORY_PERMISSIONS.registryView)} />}
            {tab === 'visits' && <VisitsTab visits={s.visits} />}
            {tab === 'moves' && <MovesTab rows={moveRows} error={moves.error?.title ?? null} />}
            {tab === 'holds' && <HoldsTab now={holdsNow} released={holdsGone} />}
            {tab === 'bookings' && <BookingsTab story={s} canBookings={can(STORY_PERMISSIONS.bookingView)} />}
            {tab === 'reefer' && <ReeferTab sessions={sessions} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function NowTab({ current, yard, registry, registryError, canRegistry }: {
  current: StoryVisit | null; yard: Yard | null; registry: RegistryContainer | null;
  registryError: number | null; canRegistry: boolean;
}) {
  return (
    <div className="gecko-grid-2" style={{ gap: 24 }}>
      <KvBlock title="Current stay">
        {!current ? <div className="gecko-cell-meta">Not in the yard at any depot you cover.</div> : (
          <>
            <Kv label="Depot" value={current.branchCode ?? '—'} />
            <Kv label="Yard" value={yard ? `${yard.yardCode} · ${yard.nameEn}` : current.yardId ? '—' : 'Not assigned'} />
            <Kv label="Position" value={current.positionText ?? '—'} mono />
            <Kv label="Full / empty" value={current.fullEmpty} />
            <Kv label="Condition / grade" value={[current.conditionCode, current.gradeCode].filter(Boolean).join(' / ') || '—'} />
            <Kv label="Gate-in" value={
              <Link href={eirPath('IN', current.gateInTransactionId)} className="gecko-link">
                {current.gateInEirNo ?? 'EIR'} · {current.gateInMovementCode ?? ''} · {formatDateTime(current.gateInAt)}
              </Link>} />
            <Kv label="Days in yard" value={dwellLabel(current.daysInYard)} />
            <Kv label="Last event" value={formatDateTime(current.lastEventAt)} />
          </>
        )}
      </KvBlock>
      <KvBlock title="Registry (master data)">
        {!canRegistry ? <div className="gecko-cell-meta">You do not have access to the container registry.</div>
          : registryError === 404 ? <div className="gecko-cell-meta">Not in the container registry.</div>
          : !registry ? <div className="gecko-cell-meta">{registryError ? 'The registry could not be read.' : 'Reading…'}</div> : (
            <>
              <Kv label="Type · ISO" value={[registry.typeCode, registry.isoCode].filter(Boolean).join(' · ') || '—'} mono />
              <Kv label="Owner / lessor" value={[registry.ownerCode, registry.lessorCode].filter(Boolean).join(' / ') || '—'} />
              <Kv label="Ownership" value={registry.ownershipType.replace(/_/g, ' ').toLowerCase()} />
              <Kv label="Material" value={registry.material ?? '—'} />
              <Kv label="Tare / max gross" value={`${formatKg(registry.tareWeightKg)} / ${formatKg(registry.maxGrossKg)}`} />
              {(registry.reeferUnitMake || registry.reeferUnitModel) && (
                <Kv label="Reefer unit" value={[registry.reeferUnitMake, registry.reeferUnitModel].filter(Boolean).join(' ')} />
              )}
              <Kv label="Manufactured" value={[registry.manufacturer, registry.manufactureDate].filter(Boolean).join(' · ') || '—'} />
              <Kv label="CSC / ACEP" value={[registry.cscPlateRef, registry.acepRef].filter(Boolean).join(' / ') || '—'} />
              <Kv label="Next examination" value={registry.nextExaminationDate ?? '—'} />
              <Kv label="Status" value={registry.status} />
              {!registry.isCheckDigitValid && <Kv label="Check digit" value="Fails ISO 6346 (accepted on override)" />}
            </>
          )}
      </KvBlock>
    </div>
  );
}

function VisitsTab({ visits }: { visits: StoryVisit[] }) {
  const [open, setOpen] = useState<string | null>(visits[0]?.containerVisitId ?? null);
  if (visits.length === 0) return <EmptyState icon="clock" title="No stays" description="The box has not been through a gate at your depots." />;
  return (
    <table className="gecko-table">
      <thead>
        <tr><th>Depot</th><th>Gate-in</th><th>Gate-out</th><th>Full / empty</th><th>Line</th><th>Position</th><th>Days</th><th>Events</th></tr>
      </thead>
      <tbody>
        {visits.map(v => (
          <React.Fragment key={v.containerVisitId}>
            <tr>
              <td>{v.branchCode ?? '—'}{v.isInYard && <span className="gecko-badge gecko-badge-success" style={{ marginLeft: 6 }}>now</span>}</td>
              <td>
                <Link href={eirPath('IN', v.gateInTransactionId)} className="gecko-link gecko-mono">{v.gateInEirNo ?? 'EIR'}</Link>
                <div className="gecko-cell-meta">{formatDateTime(v.gateInAt)}</div>
              </td>
              <td>
                {v.gateOutTransactionId ? (
                  <>
                    <Link href={eirPath('OUT', v.gateOutTransactionId)} className="gecko-link gecko-mono">{v.gateOutEirNo ?? 'EIR'}</Link>
                    <div className="gecko-cell-meta">{formatDateTime(v.gateOutAt)}</div>
                  </>
                ) : <span className="gecko-cell-meta">in yard</span>}
              </td>
              <td>{v.fullEmpty}</td>
              <td>{v.lineCode}</td>
              <td className="gecko-mono">{v.positionText ?? '—'}</td>
              <td>{v.daysInYard}</td>
              <td>
                <button className="gecko-btn gecko-btn-ghost gecko-btn-sm"
                  onClick={() => setOpen(open === v.containerVisitId ? null : v.containerVisitId)}>
                  {v.events.length} <Icon name={open === v.containerVisitId ? 'chevronUp' : 'chevronDown'} size={13} />
                </button>
              </td>
            </tr>
            {open === v.containerVisitId && (
              <tr>
                <td colSpan={8} style={{ background: 'var(--gecko-bg-subtle)' }}>
                  {v.events.length === 0 ? <span className="gecko-cell-meta">No events recorded.</span> : (
                    <div className="gecko-stack gecko-stack-sm">
                      {v.events.map(e => (
                        <div key={e.visitEventId} className="gecko-row" style={{ gap: 12 }}>
                          <span className="gecko-cell-meta" style={{ minWidth: 110 }}>{formatDateTime(e.eventAt)}</span>
                          <strong>{eventLabel(e.eventType)}</strong>
                          {(e.fromValue || e.toValue) && (
                            <span className="gecko-mono">{[e.fromValue, e.toValue].filter(Boolean).join(' → ')}</span>
                          )}
                          {e.remarks && <span className="gecko-cell-meta">{e.remarks}</span>}
                        </div>
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
  );
}

function MovesTab({ rows, error }: { rows: GateTransactionSummary[]; error: string | null }) {
  if (error) return <div className="gecko-cell-meta">{error}</div>;
  if (rows.length === 0) return <EmptyState icon="transferH" title="No EIRs" description="No gate transaction for this box at your depots." />;
  return (
    <table className="gecko-table">
      <thead><tr><th>EIR</th><th>When</th><th>Direction</th><th>Movement</th><th>Full / empty</th><th>Booking</th><th>Truck</th><th>Status</th></tr></thead>
      <tbody>
        {rows.map(t => (
          <tr key={t.gateTransactionId}>
            <td><Link href={eirPath(t.direction, t.gateTransactionId)} className="gecko-link gecko-mono">{t.eirNo}</Link></td>
            <td>{formatDateTime(t.transactionAt)}</td>
            <td>{t.direction}</td>
            <td>{t.movementCode}{t.isLate && <span className="gecko-badge gecko-badge-warning" style={{ marginLeft: 6 }}>late</span>}</td>
            <td>{t.fullEmpty}</td>
            <td className="gecko-mono">{t.orderNo}</td>
            <td>{t.truckPlate}</td>
            <td><span className={`gecko-badge gecko-badge-${t.status === 'VOIDED' ? 'error' : 'success'}`}>{t.status}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function HoldsTab({ now, released }: { now: ContainerHolds['holds']; released: Hold[] }) {
  return (
    <div className="gecko-stack" style={{ gap: 20 }}>
      <div className="gecko-row" style={{ justifyContent: 'space-between' }}>
        <div className="gecko-eyebrow">Holding it now</div>
        <Link href="/gate/holds" className="gecko-link gecko-cell-meta">Holds board →</Link>
      </div>
      {now.length === 0 ? <div className="gecko-cell-meta">Nothing holds this box.</div> : (
        <table className="gecko-table">
          <thead><tr><th>Hold</th><th>Via</th><th>Applied</th><th>Reason</th><th>Release by</th></tr></thead>
          <tbody>
            {now.map(h => (
              <tr key={h.containerHoldId}>
                <td><strong>{h.holdCode}</strong><div className="gecko-cell-meta">{h.description ?? ''}</div></td>
                <td>{h.heldVia === 'BOOKING' ? `booking ${h.orderNo ?? ''}` : 'the box'}</td>
                <td>{formatDateTime(h.appliedAt)}</td>
                <td>{h.applyReason}</td>
                <td>{h.releaseAuthority ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="gecko-eyebrow">Released</div>
      {released.length === 0 ? <div className="gecko-cell-meta">No released holds on this box.</div> : (
        <table className="gecko-table">
          <thead><tr><th>Hold</th><th>Applied</th><th>Released</th><th>Release reason</th><th>Ref</th></tr></thead>
          <tbody>
            {released.map(h => (
              <tr key={h.containerHoldId}>
                <td><strong>{h.holdCode}</strong><div className="gecko-cell-meta">{h.applyReason}</div></td>
                <td>{formatDateTime(h.appliedAt)}</td>
                <td>{formatDateTime(h.releasedAt)}</td>
                <td>{h.releaseReason ?? '—'}</td>
                <td className="gecko-mono">{h.releaseRef ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function BookingsTab({ story, canBookings }: { story: ContainerStory; canBookings: boolean }) {
  if (!canBookings) return <div className="gecko-cell-meta">You do not have access to bookings.</div>;
  if (story.bookings.length === 0) return <EmptyState icon="clipboardList" title="No bookings" description="The box is not on a booking at your depots." />;
  const current = new Set(story.visits.map(v => v.currentBookingContainerId).filter(Boolean));
  return (
    <table className="gecko-table">
      <thead><tr><th>Booking</th><th>Order type</th><th>Depot</th><th>Line</th><th>Customer</th><th>Assigned</th><th>On it</th><th>Booking status</th></tr></thead>
      <tbody>
        {story.bookings.map(b => (
          <tr key={b.bookingContainerId}>
            <td>
              <Link href={`/bookings/${b.bookingId}`} className="gecko-link gecko-mono">{b.orderNo}</Link>
              {current.has(b.bookingContainerId) && <span className="gecko-badge gecko-badge-info" style={{ marginLeft: 6 }}>current</span>}
            </td>
            <td>{b.orderTypeCode}</td>
            <td>{b.branchCode ?? '—'}</td>
            <td>{b.lineCode}</td>
            <td>{b.customerCode ?? '—'}</td>
            <td>{formatDateTime(b.assignedAt)}</td>
            <td>{b.isOpen ? 'yes' : `ended ${formatDateTime(b.endedAt)}${b.endReason ? ` (${b.endReason.toLowerCase()})` : ''}`}</td>
            <td>{b.bookingStatus}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ReeferTab({ sessions }: { sessions: ReeferSession[] }) {
  if (sessions.length === 0) return <EmptyState icon="thermometer" title="No plug sessions" description="This box has not been plugged in at your depots." />;
  return (
    <>
      <div className="gecko-row gecko-mb-2" style={{ justifyContent: 'flex-end' }}>
        <Link href="/gate/reefer-ops" className="gecko-link gecko-cell-meta">Reefer plug log →</Link>
      </div>
      <table className="gecko-table">
        <thead><tr><th>Depot</th><th>Plugged in</th><th>Plugged out</th><th>Point</th><th>Set point</th><th>Hours billed</th><th>Closed by</th></tr></thead>
        <tbody>
          {sessions.map(r => (
            <tr key={r.id}>
              <td>{r.branchCode ?? '—'}{r.isOpen && <span className="gecko-badge gecko-badge-success" style={{ marginLeft: 6 }}>plugged</span>}</td>
              <td>{formatDateTime(r.pluggedInAt)}</td>
              <td>{formatDateTime(r.pluggedOutAt)}</td>
              <td className="gecko-mono">{r.plugPointCode ?? '—'}</td>
              <td>{r.setPointC == null ? '—' : `${r.setPointC} °C`}</td>
              <td>{r.billableHours}</td>
              <td>{r.closeReason === 'GATE_OUT' ? 'gate-out' : r.closeReason === 'MANUAL' ? 'manual' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

// ─── Bits ─────────────────────────────────────────────────────────────────────

function Banner({ label, value, big }: { label: string; value: React.ReactNode; big?: boolean }) {
  return (
    <div>
      <div className="gecko-eyebrow">{label}</div>
      <div className={big ? 'gecko-stat-num gecko-stat-num-22' : undefined}
        style={big ? { fontFamily: 'var(--gecko-font-mono)', letterSpacing: '0.02em', marginTop: 2 }
          : { fontSize: 14, fontWeight: 700, fontFamily: 'var(--gecko-font-mono)', marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 32, width: 1, background: 'var(--gecko-border)' }} />;
}

function Strip({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ padding: '12px 18px', borderRight: '1px solid var(--gecko-border)' }}>
      <div className="gecko-eyebrow">{label}</div>
      <div className="gecko-truncate" style={{ fontSize: 13, fontWeight: 600, fontFamily: mono ? 'var(--gecko-font-mono)' : 'inherit', marginTop: 3 }}>
        {value}
      </div>
    </div>
  );
}

function KvBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="gecko-eyebrow gecko-mb-3">{title}</div>
      <div className="gecko-stack gecko-stack-sm">{children}</div>
    </div>
  );
}

function Kv({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: 'var(--gecko-text-disabled)', marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--gecko-text-primary)', fontFamily: mono ? 'var(--gecko-font-mono)' : 'inherit' }}>{value}</div>
    </div>
  );
}

