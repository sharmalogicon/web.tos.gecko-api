"use client";
import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { BarcodeScanInput } from '@/components/ui/BarcodeDisplay';
import { EmptyState } from '@/components/ui/EmptyState';
import { useApi, useApiList, type Paged } from '@/lib/api/use-api';
import { useSession } from '@/lib/auth/session';
import { dwellLabel, formatContainerNo, formatDate, formatDateTime, type GateTransactionSummary } from '@/lib/api/tos';
import { eirPath, formatKg, type ContainerHolds } from '@/lib/api/gate-eir';
import { statusLabel } from '@/lib/format';
import type { Hold } from '@/lib/api/holds';
import { REEFER_SESSIONS_PATH, type ReeferSession } from '@/lib/api/reefer';
import { yardsPath, type Yard } from '@/lib/api/yards';
import {
  STORY_PERMISSIONS, eventLabel, isWellFormedContainerNo, normaliseContainerNo, registryPath, storyPath,
  type ContainerStory, type StoryVisit,
} from '@/lib/api/container-story';
import { MASTER_PERMISSIONS, type RegistryRow } from '@/lib/api/container-master';
import { MasterDataTab } from './_components/MasterDataTab';
import { FixedPortsTab } from './_components/FixedPortsTab';
import { YardStatePanel } from './_components/YardStatePanel';
import { ActivityLogTab } from './_components/ActivityLogTab';

/**
 * CONTAINER MASTER — one box, whole: what it IS and what has happened to it.
 *
 * Where it is now (the open stay: depot, yard, position, full/empty, dwell), every
 * stay before with its journal, its EIRs, the holds on it now and those released,
 * the bookings it has been on, its reefer plug sessions — and its registry record,
 * which a clerk with `mdm.equipment.manage` edits here rather than anywhere else.
 *
 * This was Unit Inquiry, read-only, and grew into Vector's Container Master
 * (owner 2026-10-12). It kept its route, because the EIR screens, the stock list
 * and /gate/container-status all link into it and none of those should break for
 * a rename.
 *
 * What is EDITABLE lives on one tab and is one PUT: the registry row and its
 * fixed ports. Everything else on the page belongs to a stay, a gate
 * transaction or a hold, each of which has its own screen and its own audit —
 * so they are shown here and changed there.
 *
 * The number travels in the URL (?no=) so an EIR, the stock list or a colleague
 * can link straight to a box.
 */
export default function UnitInquiryPage() {
  return (
    <Suspense fallback={<div className="gecko-cell-meta" style={{ padding: 24 }}>Loading…</div>}>
      <UnitInquiry />
    </Suspense>
  );
}

type Tab = 'now' | 'master' | 'ports' | 'status' | 'emr' | 'log'
  | 'moves' | 'holds' | 'bookings' | 'reefer';

function UnitInquiry() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { can, canAt } = useSession();
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
  const registry = useApi<RegistryRow>(asked && can(STORY_PERMISSIONS.registryView) ? registryPath(asked) : null);
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
  // The stay the header describes: the open one, else the newest closed one.
  const latest = current ?? s?.visits[0] ?? null;
  const loaded = !!s && s.containerNo === asked;
  const nothing = loaded && s.visits.length === 0 && s.bookings.length === 0 && moveRows.length === 0 && !reg;

  return (
    <div className="gecko-stack" style={{ gap: 18, maxWidth: 'var(--gecko-container-max)', margin: '0 auto', paddingBottom: 60 }}>

      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <div className="gecko-row gecko-row-baseline gecko-stack-md">
            <h1 className="gecko-page-title">Container master</h1>
            <span className="gecko-badge gecko-badge-success">LIVE</span>
          </div>
          <div className="gecko-page-subtitle gecko-mt-1">
            One box, whole: its registry record and fixed ports, where it is now, every stay and event, its EIRs,
            holds, bookings and plug sessions.
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
            &lsquo;{typed}&rsquo; is not a container number (4 to 11 letters or digits).
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
                {/* The registry's lifecycle states are IN_SERVICE / OFF_HIRED / SOLD / TOTAL_LOSS / SCRAPPED.
                    It never says ACTIVE, so the old test here badged every healthy box with "IN_SERVICE". */}
                {reg && reg.status !== 'IN_SERVICE' && (
                  <span className="gecko-badge gecko-badge-warning">{reg.status.replace(/_/g, ' ')}</span>
                )}
              </div>
            </div>
          </div>

          {/* The strip reads the OPEN stay, or the last one when the box has
              gone. Four dashes told a clerk nothing except that they had asked
              about a box that is not here, which the badge above already says. */}
          <div className="gecko-ui-strip">
            <Strip label={current ? 'Depot · yard' : 'Last depot · yard'}
              value={latest ? [latest.branchCode, yard?.yardCode].filter(Boolean).join(' · ') || '—' : '—'} />
            <Strip label="Position" value={current ? latest?.positionText ?? 'no slot' : '—'} mono />
            <Strip label="Full / empty" value={latest?.fullEmpty ?? '—'} />
            <Strip label={current ? 'In yard' : 'Gated out'}
              value={!latest ? '—'
                : current ? `${dwellLabel(latest.daysInYard)} (since ${formatDateTime(latest.gateInAt)})`
                : latest.gateOutAt ? formatDateTime(latest.gateOutAt) : '—'} />
          </div>

          <div className="gecko-row" style={{ gap: 0, padding: '0 20px', borderBottom: '1px solid var(--gecko-border)', flexWrap: 'wrap' }}>
            {([
              ['now', 'Overview', 'box'],
              /* What the box IS \u2014 the registry record and the ports it is tied to.
                 Two tabs over one PUT, so each sends the other's fields back. */
              ...(can(STORY_PERMISSIONS.registryView)
                ? [['master', 'Master data', 'database'] as const, ['ports', 'Fixed ports', 'mapPin'] as const]
                : []),
              /* What the box IS LIKE on this visit. Both belong to the stay, not
                 to the registry, and both need tos.yard.manage to change. */
              ['status', 'Status', 'shieldCheck'],
              ['emr', 'EMR remarks', 'tool'],
              ['log', 'Activity log', 'activity'],
              /* Stays and EIRs are one tab, two cards (owner 2026-10-12). Both
                 are read-only lists of the same history told two ways \u2014 the
                 stay, and the paperwork that opened and closed it \u2014 and a tab
                 each cost a row of the strip to save nobody a click. */
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
            {tab === 'now' && (
              <NowTab current={current} last={s.visits[0] ?? null} yard={yard} registry={reg}
                registryError={registry.error?.status ?? null}
                canRegistry={can(STORY_PERMISSIONS.registryView)} />
            )}
            {tab === 'master' && (
              <MasterDataTab
                containerNo={s.containerNo}
                registry={reg}
                registryError={registry.error?.status ?? null}
                canView={can(STORY_PERMISSIONS.registryView)}
                canEdit={can(MASTER_PERMISSIONS.manage)}
                onSaved={registry.reload}
                onRenumbered={lookUp}
              />
            )}
            {tab === 'ports' && (
              <FixedPortsTab
                registry={reg}
                registryError={registry.error?.status ?? null}
                canView={can(STORY_PERMISSIONS.registryView)}
                canEdit={can(MASTER_PERMISSIONS.manage)}
                onSaved={registry.reload}
              />
            )}
            {(tab === 'status' || tab === 'emr') && (
              /* `canAt`, not `can`: the permission is checked AT THE VISIT'S
                 BRANCH. A planner who covers one depot would otherwise see this
                 enabled on a box standing at another, and earn a 403 for it. */
              <YardStatePanel
                which={tab === 'status' ? 'condition' : 'emr'}
                visitId={current?.containerVisitId ?? null}
                inYard={!!current?.isInYard}
                conditionCode={current?.conditionCode ?? null}
                gradeCode={current?.gradeCode ?? null}
                emrRemarks={current?.emrRemarks ?? null}
                canManage={canAt(MASTER_PERMISSIONS.yardManage, current?.branchId)}
                onChanged={() => { story.reload(); activeHolds.reload(); }}
              />
            )}
            {tab === 'log' && (
              <ActivityLogTab story={s} moves={moveRows} holdsNow={holdsNow} holdsReleased={holdsGone} registry={reg}
                canReadRegistry={can(STORY_PERMISSIONS.registryView)} />
            )}
            {tab === 'moves' && (
              <div className="gecko-stack gecko-cm-stack">
                <ListCard title="Stays" count={s.visits.length}
                  desc="Each visit to a depot, with the events recorded during it.">
                  <VisitsTab visits={s.visits} />
                </ListCard>
                <ListCard title="EIRs" count={moveRows.length}
                  desc="Every gate transaction for this box, deleted ones included.">
                  <MovesTab rows={moveRows} error={moves.error?.title ?? null} />
                </ListCard>
              </div>
            )}
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

/**
 * OVERVIEW — where the box is, and what the registry says it is.
 *
 * Two cards, not two bare lists. The facts are laid out label-beside-value in a
 * grid so a card of ten of them is five lines rather than ten, and the registry
 * card is grouped — identity, build, certification, status — because eleven
 * undifferentiated rows is a wall a clerk has to read in full to find one thing.
 *
 * WHEN THE BOX IS NOT IN THE YARD the left card shows its LAST stay rather than
 * one sentence saying it is gone. "Not in the yard" beside an empty half-screen
 * answers the question nobody asked; where it went, and when, is the question
 * they did.
 */
function NowTab({ current, last, yard, registry, registryError, canRegistry }: {
  current: StoryVisit | null;
  /** The newest stay, open or closed — what to show when there is no open one. */
  last: StoryVisit | null;
  yard: Yard | null; registry: RegistryRow | null;
  registryError: number | null; canRegistry: boolean;
}) {
  const stay = current ?? last;

  return (
    <div className="gecko-ui-overview">

      {/* ── where it is ─────────────────────────────────────────────────── */}
      <section className="gecko-cm-section">
        <div className="gecko-cm-section-head">
          <div className="gecko-eyebrow">
            <Icon name="mapPin" size={13} /> {current ? 'Where it is now' : 'Where it was last'}
          </div>
          {stay && (
            <span className={`gecko-badge gecko-badge-${current ? 'success' : 'gray'}`}>
              {current ? 'In yard' : 'Gone out'}
            </span>
          )}
        </div>

        {!stay ? (
          <EmptyState icon="search" title="No stay on record"
            description="This box has never been through a gate at the depots you cover." />
        ) : (
          <>
            <dl className="gecko-ui-facts">
              <Fact label="Depot" value={stay.branchCode ?? '—'} />
              <Fact label="Yard" value={yard ? `${yard.yardCode} · ${yard.nameEn}` : stay.yardId ? '—' : 'Not assigned'} />
              <Fact label="Position" value={stay.positionText ?? 'no slot'} mono />
              <Fact label="Full / empty" value={stay.fullEmpty} />
              <Fact label="Condition · grade" value={[stay.conditionCode, stay.gradeCode].filter(Boolean).join(' · ') || '—'} mono />
              <Fact label={current ? 'Days in yard' : 'Days it stayed'} value={dwellLabel(stay.daysInYard)} />
            </dl>

            {/* The paperwork at each end of the stay, which is what a clerk
                clicks through to. */}
            <div className="gecko-ui-gates">
              <div className="gecko-ui-gate">
                <span className="gecko-eyebrow">Gated in</span>
                <Link href={eirPath('IN', stay.gateInTransactionId)} className="gecko-link gecko-mono">
                  {stay.gateInEirNo ?? 'EIR'}
                </Link>
                <span className="gecko-cell-meta">
                  {[stay.gateInMovementCode, formatDateTime(stay.gateInAt)].filter(Boolean).join(' · ')}
                </span>
              </div>
              <div className="gecko-ui-gate">
                <span className="gecko-eyebrow">Gated out</span>
                {stay.gateOutTransactionId ? (
                  <>
                    <Link href={eirPath('OUT', stay.gateOutTransactionId)} className="gecko-link gecko-mono">
                      {stay.gateOutEirNo ?? 'EIR'}
                    </Link>
                    <span className="gecko-cell-meta">{formatDateTime(stay.gateOutAt)}</span>
                  </>
                ) : <span className="gecko-cell-meta">still inside</span>}
              </div>
            </div>

            {stay.emrRemarks && (
              <div className="gecko-ui-emr">
                <span className="gecko-eyebrow"><Icon name="tool" size={12} /> EMR remarks</span>
                <span>{stay.emrRemarks}</span>
              </div>
            )}

            <div className="gecko-cell-meta">Last event {formatDateTime(stay.lastEventAt)}.</div>
          </>
        )}
      </section>

      {/* ── what it is ──────────────────────────────────────────────────── */}
      <section className="gecko-cm-section">
        <div className="gecko-cm-section-head">
          <div className="gecko-eyebrow"><Icon name="database" size={13} /> Registry · master data</div>
          {registry && registry.status !== 'IN_SERVICE' && (
            <span className="gecko-badge gecko-badge-warning">{registry.status.replace(/_/g, ' ').toLowerCase()}</span>
          )}
        </div>

        {!canRegistry ? <div className="gecko-cell-meta">You do not have access to the container registry.</div>
          : registryError === 404 ? (
            <EmptyState icon="database" title="Not in the registry"
              description="The box has been handled at the gate without a master-data record — normal for another line's equipment." />
          )
          : !registry ? <div className="gecko-cell-meta">{registryError ? 'The registry could not be read.' : 'Reading…'}</div> : (
            <>
              <FactGroup title="Identity">
                <Fact label="Type · ISO" value={[registry.typeCode, registry.isoCode].filter(Boolean).join(' · ') || '—'} mono />
                <Fact label="Owner" value={registry.ownerCode ?? '—'} />
                <Fact label="Lessor" value={registry.lessorCode ?? '—'} />
                <Fact label="Ownership" value={registry.ownershipType.replace(/_/g, ' ').toLowerCase()} />
              </FactGroup>

              <FactGroup title="Build and weights">
                <Fact label="Material" value={registry.material?.replace(/_/g, ' ').toLowerCase() ?? '—'} />
                <Fact label="Tare / max gross" value={`${formatKg(registry.tareWeightKg)} / ${formatKg(registry.maxGrossKg)}`} />
                <Fact label="Manufacturer" value={registry.manufacturer ?? '—'} />
                <Fact label="Manufactured" value={registry.manufactureDate ? formatDate(registry.manufactureDate) : '—'} />
                {(registry.reeferUnitMake || registry.reeferUnitModel) && (
                  <Fact label="Reefer unit" value={[registry.reeferUnitMake, registry.reeferUnitModel].filter(Boolean).join(' ')} />
                )}
              </FactGroup>

              <FactGroup title="Certification">
                <Fact label="CSC plate" value={registry.cscPlateRef ?? '—'} mono />
                <Fact label="ACEP" value={registry.acepRef ?? '—'} mono />
                <Fact label="Next examination"
                  value={registry.nextExaminationDate ? formatDate(registry.nextExaminationDate) : '—'} />
              </FactGroup>

              <FactGroup title="Standing">
                <Fact label="Registry status" value={registry.status.replace(/_/g, ' ').toLowerCase()} />
                <Fact label="Fixed ports" value={
                  registry.fixedPortCodes && registry.fixedPortCodes.length > 0
                    ? <span className="gecko-mono">{registry.fixedPortCodes.join(', ')}</span>
                    : 'Any port'} />
              </FactGroup>

              {registry.remarks && (
                <div className="gecko-ui-emr">
                  <span className="gecko-eyebrow">Remarks</span>
                  <span>{registry.remarks}</span>
                </div>
              )}

              <div className="gecko-cm-stamps">
                <span>
                  Created {registry.createdAt ? formatDateTime(registry.createdAt) : '—'}
                  {registry.createdByName && <> by <strong>{registry.createdByName}</strong></>}
                </span>
                <span>
                  Modified {registry.updatedAt ? formatDateTime(registry.updatedAt) : '—'}
                  {registry.updatedByName && <> by <strong>{registry.updatedByName}</strong></>}
                </span>
              </div>
            </>
          )}
      </section>
    </div>
  );
}

/** A labelled run of facts inside a card. */
function FactGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="gecko-ui-group">
      <div className="gecko-ui-group-title">{title}</div>
      <dl className="gecko-ui-facts">{children}</dl>
    </div>
  );
}

/** One fact: the label in its own column, so the values line up down the card. */
function Fact({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="gecko-ui-fact">
      <dt>{label}</dt>
      <dd className={mono ? 'gecko-mono' : undefined}>{value}</dd>
    </div>
  );
}

/**
 * A titled card around a read-only list.
 *
 * Stays and EIRs share a tab, so each needs to say what it is; without a
 * heading the two tables ran together and the second looked like more rows of
 * the first.
 */
function ListCard({ title, count, desc, children }: {
  title: string; count: number; desc: string; children: React.ReactNode;
}) {
  return (
    <section className="gecko-cm-section">
      <div className="gecko-cm-section-head">
        <div className="gecko-eyebrow">{title} ({count})</div>
        <span className="gecko-cell-meta">{desc}</span>
      </div>
      {children}
    </section>
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
            <td><span className={`gecko-badge gecko-badge-${t.status === 'VOIDED' ? 'error' : 'success'}`}>{statusLabel(t.status)}</span></td>
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


