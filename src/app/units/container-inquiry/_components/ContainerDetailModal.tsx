"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { useApi } from '@/lib/api/use-api';
import { formatContainerNo } from '@/lib/api/tos';
import { formatDateTime } from '@/lib/format';
import {
  containerInquiryPath, STATUS_LABEL, type InquiryDetail, type InquiryRow,
} from '@/lib/api/container-inquiry';
import type { StoryEvent, StoryVisit } from '@/lib/api/container-story';

/**
 * ONE BOX, IN FULL — the inquiry's pop-up.
 *
 * Four things, in the order a clerk asks them: where is it now, what is it,
 * what is stopping it, and what has it done. The first three are facts about
 * the box; the fourth is its story, which is long, so it lives behind tabs.
 *
 * `latest` is null for a box on a booking that has never been through the gate.
 * That is not an error and not an empty stay — it is said in those words.
 */
export function ContainerDetailModal({ containerNo, onClose }: {
  containerNo: string;
  onClose: () => void;
}) {
  const { data, error, loading } = useApi<InquiryDetail>(containerInquiryPath(containerNo));
  const [tab, setTab] = useState<'stays' | 'bookings'>('stays');

  const d = data;
  const latest = d?.latest ?? null;

  return (
    <Modal isOpen onClose={onClose} size="xl"
      title={formatContainerNo(containerNo)}
      subtitle={latest
        ? `${STATUS_LABEL[latest.status] ?? latest.status} · ${latest.equipmentTypeCode ?? 'type unknown'} · ${latest.fullEmpty.toLowerCase()}`
        : loading ? 'Reading the box…' : 'Booked, never gated in'}>
      <div className="gecko-stack">
        {error && (
          <div role="alert" className="gecko-alert gecko-alert-error">
            <Icon name="alertCircle" size={18} />
            <div>
              <strong>{error.status === 404 ? 'No such box here' : error.title}</strong>
              <div>
                {error.status === 404
                  ? 'It has never been through your depots and is on none of their bookings.'
                  : error.status === 403
                    ? 'That depot is not one you cover.'
                    : error.explanation ?? error.message}
              </div>
            </div>
          </div>
        )}
        {loading && !d && <div className="gecko-cell-meta">Reading the box…</div>}

        {d && (
          <>
            {/* ── where it is ─────────────────────────────────────────────── */}
            {latest ? <LatestPanel row={latest} /> : (
              <div role="status" className="gecko-alert gecko-alert-info">
                <Icon name="alertCircle" size={16} />
                <span>
                  <strong>Booked, never gated in.</strong> This box is named on a booking below but has
                  not been through the gate, so it has no stay, no position and no dwell.
                </span>
              </div>
            )}

            {/* ── what it is ──────────────────────────────────────────────── */}
            <section className="gecko-card gecko-card-padded gecko-stack-sm">
              <div className="gecko-stat-label">Registry</div>
              {d.registry ? (
                <table className="gecko-table gecko-table-compact gecko-eir-facts"><tbody>
                  <Fact label="Type" value={d.registry.equipmentTypeCode ?? '—'} />
                  <Fact label="Status" value={d.registry.status} />
                  <Fact label="Check digit"
                    value={d.registry.isCheckDigitValid ? 'Valid' : 'Does not check out'} />
                  <Fact label="Fixed ports"
                    value={d.registry.fixedPortCodes.length > 0 ? d.registry.fixedPortCodes.join(', ') : '—'} />
                </tbody></table>
              ) : (
                <div className="gecko-cell-meta">
                  Not in registry. The box has been handled at the gate without a master-data record —
                  normal for another line&rsquo;s equipment.
                </div>
              )}
            </section>

            {/* ── what is stopping it ─────────────────────────────────────── */}
            {d.holds.length > 0 && (
              <section className="gecko-card gecko-card-padded gecko-stack-sm">
                <div className="gecko-stat-label">Holds · {d.holds.length}</div>
                {d.holds.map(h => (
                  <div key={h.containerHoldId} className="gecko-inquiry-hold">
                    {/* The colour is master data's, not this screen's: a depot
                        that paints CUSTOMS red expects it red everywhere. */}
                    <span className="gecko-inquiry-hold-dot"
                      style={{ background: h.displayColorHex ?? 'var(--gecko-error-500)' }} />
                    <span className="gecko-flex-1 gecko-min-w-0">
                      <strong>{h.holdCode}</strong>
                      {h.description && <span className="gecko-cell-meta"> · {h.description}</span>}
                      <span className="gecko-cell-meta"> · {h.applyReason}</span>
                    </span>
                    <span className="gecko-cell-meta">{formatDateTime(h.appliedAt)}</span>
                  </div>
                ))}
              </section>
            )}

            {/* ── what it has done ────────────────────────────────────────── */}
            <section className="gecko-table-card gecko-table-card-menus">
              <div className="gecko-table-toolbar">
                <button className={`gecko-btn gecko-btn-sm ${tab === 'stays' ? 'gecko-btn-primary' : 'gecko-btn-outline'}`}
                  onClick={() => setTab('stays')}>
                  Stays · {d.story.visits.length}
                </button>
                <button className={`gecko-btn gecko-btn-sm ${tab === 'bookings' ? 'gecko-btn-primary' : 'gecko-btn-outline'}`}
                  onClick={() => setTab('bookings')}>
                  Bookings · {d.story.bookings.length}
                </button>
              </div>

              {tab === 'stays' && (
                <div className="gecko-inquiry-stays">
                  {d.story.visits.length === 0 && (
                    <EmptyState icon="box" title="No stay yet" description="The box has not been gated in at your depots." />
                  )}
                  {d.story.visits.map(v => <Stay key={v.containerVisitId} visit={v} />)}
                </div>
              )}

              {tab === 'bookings' && (
                <div className="gecko-table-clip">
                  <table className="gecko-table gecko-table-compact">
                    <thead>
                      <tr>
                        <th>Booking</th><th>Type</th><th>Status</th><th>Line</th>
                        <th>Customer</th><th>Assigned</th><th>Ended</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.story.bookings.length === 0 && (
                        <tr><td colSpan={7} className="gecko-cell-bleed">
                          <EmptyState icon="clipboardList" title="On no booking"
                            description="The box has been through the gate without ever being named on an order." />
                        </td></tr>
                      )}
                      {d.story.bookings.map(b => (
                        <tr key={b.bookingContainerId} className={b.isOpen ? undefined : 'gecko-statement-row-muted'}>
                          <td>
                            <Link href={`/bookings/${b.bookingId}`} className="gecko-link gecko-mono-strong">{b.orderNo}</Link>
                          </td>
                          <td className="gecko-cell-meta">{b.orderTypeCode}</td>
                          <td>
                            <span className={`gecko-badge gecko-badge-xs ${b.isOpen ? 'gecko-badge-success' : 'gecko-badge-gray'}`}>
                              {b.isOpen ? 'open' : (b.endReason ?? b.bookingStatus).toLowerCase()}
                            </span>
                          </td>
                          <td className="gecko-mono">{b.lineCode}</td>
                          <td className="gecko-mono gecko-cell-meta">{b.customerCode ?? '—'}</td>
                          <td className="gecko-cell-meta">{formatDateTime(b.assignedAt)}</td>
                          <td className="gecko-cell-meta">{b.endedAt ? formatDateTime(b.endedAt) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <th scope="row" className="gecko-eir-fact-label">{label}</th>
      <td className="gecko-eir-fact-value">{value}</td>
    </tr>
  );
}

/** The latest stay, as the row the register showed — spelled out. */
function LatestPanel({ row }: { row: InquiryRow }) {
  return (
    <section className="gecko-card gecko-card-padded gecko-stack-sm">
      <div className="gecko-row gecko-row-between gecko-row-baseline">
        <div className="gecko-stat-label">Latest stay</div>
        <span className={`gecko-badge ${row.status === 'IN_YARD' ? 'gecko-badge-success' : 'gecko-badge-gray'}`}>
          {STATUS_LABEL[row.status] ?? row.status}
        </span>
      </div>
      <div className="gecko-grid-2">
        <table className="gecko-table gecko-table-compact gecko-eir-facts"><tbody>
          <Fact label="Depot" value={row.branchCode ?? '—'} />
          <Fact label="Type" value={`${row.equipmentTypeCode ?? '—'}${row.isReefer ? ' · reefer' : ''}`} />
          <Fact label="Empty / loaded" value={row.fullEmpty.toLowerCase()} />
          <Fact label="Line" value={row.lineName ?? row.lineCode} />
          <Fact label="Agent" value={row.agentName ?? row.agentCode ?? '—'} />
          <Fact label="Customer" value={row.customerName ?? row.customerCode ?? '—'} />
          <Fact label="Position" value={row.positionText ?? 'no slot'} />
        </tbody></table>
        <table className="gecko-table gecko-table-compact gecko-eir-facts"><tbody>
          <Fact label="Gated in" value={<>{formatDateTime(row.gateInAt)}<div className="gecko-cell-meta gecko-mono">{row.gateInEirNo} · {row.gateInMovementCode}</div></>} />
          <Fact label="Gated out" value={row.gateOutAt
            ? <>{formatDateTime(row.gateOutAt)}<div className="gecko-cell-meta gecko-mono">{row.gateOutEirNo} · {row.gateOutMovementCode}</div></>
            : 'still inside'} />
          <Fact label="Days in yard" value={row.daysInYard} />
          <Fact label="Condition" value={`${row.conditionCode ?? '—'}${row.gradeCode ? ` · grade ${row.gradeCode}` : ''}`} />
          <Fact label="Booking" value={row.orderNo
            ? <>
              {row.carrierRef || row.subBlNo || row.orderNo}
              {(row.carrierRef || row.subBlNo) && <div className="gecko-cell-meta gecko-mono">{row.orderNo}</div>}
            </>
            : 'none'} />
          <Fact label="Held" value={row.isHeld ? 'yes' : 'no'} />
        </tbody></table>
      </div>
    </section>
  );
}

/** One stay, with its own event timeline underneath. */
function Stay({ visit }: { visit: StoryVisit }) {
  return (
    <div className="gecko-inquiry-stay">
      <div className="gecko-row gecko-row-between gecko-row-baseline">
        <div>
          <span className="gecko-mono-strong">{visit.gateInEirNo ?? '—'}</span>
          <span className="gecko-cell-meta"> → {visit.gateOutEirNo ?? 'still inside'}</span>
        </div>
        <span className="gecko-cell-meta">
          {visit.branchCode ?? ''} · {visit.daysInYard} day{visit.daysInYard === 1 ? '' : 's'}
        </span>
      </div>
      <div className="gecko-cell-meta">
        {visit.gateInAt ? formatDateTime(visit.gateInAt) : '—'}
        {' → '}
        {visit.gateOutAt ? formatDateTime(visit.gateOutAt) : 'open'}
        {visit.positionText ? ` · ${visit.positionText}` : ''}
      </div>
      {visit.events.length > 0 && (
        <ol className="gecko-inquiry-events">
          {visit.events.map(e => <Event key={e.visitEventId} event={e} />)}
        </ol>
      )}
    </div>
  );
}

function Event({ event }: { event: StoryEvent }) {
  // from → to is only worth printing when the event actually moved a value.
  const moved = event.fromValue || event.toValue;
  return (
    <li className="gecko-inquiry-event">
      <span className="gecko-cell-meta gecko-inquiry-event-when">{formatDateTime(event.eventAt)}</span>
      <span className="gecko-flex-1 gecko-min-w-0">
        <strong>{event.eventType.replace(/_/g, ' ').toLowerCase()}</strong>
        {moved && (
          <span className="gecko-cell-meta"> · {event.fromValue ?? '—'} → {event.toValue ?? '—'}</span>
        )}
        {event.remarks && <span className="gecko-cell-meta"> · {event.remarks}</span>}
      </span>
    </li>
  );
}
