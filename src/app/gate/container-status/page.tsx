"use client";

/**
 * Container Status Update — operational workflow for changing a container's
 * status, holds, and remarks. Distinct from /units/unit-inquiry which is
 * read-only history.
 *
 * Layout (top → bottom):
 *   1. Search header with typeahead
 *   2. Hero strip with container summary + status pill
 *   3. Three-column grid:
 *        a) Container Properties (read-only spec from master)
 *        b) Current Movement (read-only state + reefer-gated temp)
 *        c) Actions panel (Status update form + EMR remarks)
 *   4. Activity Log (full-width collapsible table)
 *   5. Fix Port Details (full-width collapsible)
 */

import React, { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { FormGrid, Field } from '@/components/ui/FormGrid';
import {
  CONTAINER_RECORDS, STATUS_LABEL, STATUS_BADGE_CLS, PORT_DIRECTORY,
  type ContainerRecord, type ContainerStatus, type ActivityEntry, type ContainerFixPort,
} from '@/lib/container-status-mocks';

const NOW = new Date('2026-05-18T09:18:00+07:00').getTime();

function timeAgo(iso: string): string {
  const mins = Math.round((NOW - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = mins / 60;
  if (hrs < 24) return `${hrs.toFixed(1)}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

const ALL_STATUSES: ContainerStatus[] = ['AV', 'EM', 'FL', 'HD', 'DM', 'OH', 'RS'];

export default function ContainerStatusPage() {
  const [records, setRecords] = useState<ContainerRecord[]>(CONTAINER_RECORDS);
  const [query, setQuery] = useState('');
  const [selectedNo, setSelectedNo] = useState<string | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const { toast } = useToast();

  // Suggestions
  const suggestions = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return [];
    return records.filter(r => r.containerNo.includes(q)).slice(0, 8);
  }, [query, records]);

  const selected = useMemo(
    () => records.find(r => r.containerNo === selectedNo) ?? null,
    [records, selectedNo],
  );

  /* ── Mutations ─────────────────────────────────────────────────────── */

  const updateStatus = (
    containerNo: string,
    nextStatus: ContainerStatus,
    nextHold: boolean,
    nextRemarks: string,
  ) => {
    setRecords(prev => prev.map(r => {
      if (r.containerNo !== containerNo) return r;
      const fromStatus = r.status;
      const newActivity: ActivityEntry = {
        id: `a-${Date.now()}`,
        ts: new Date().toISOString(),
        event: 'STATUS CHANGED',
        fromStatus,
        toStatus: nextStatus,
        remarks: nextRemarks || undefined,
        by: 'SOMCHAI.K',
      };
      const holdActivity: ActivityEntry | null = nextHold !== r.hold
        ? {
            id: `a-${Date.now()}-h`,
            ts: new Date().toISOString(),
            event: nextHold ? 'HOLD APPLIED' : 'HOLD RELEASED',
            remarks: nextRemarks || undefined,
            by: 'SOMCHAI.K',
          }
        : null;
      return {
        ...r,
        status: nextStatus,
        hold: nextHold,
        statusRemarks: nextRemarks,
        modifiedBy: 'SOMCHAI.K',
        modifiedAt: new Date().toISOString(),
        activity: [
          ...(holdActivity ? [holdActivity] : []),
          newActivity,
          ...r.activity,
        ],
      };
    }));
    toast({ variant: 'success', title: 'Status updated',
            message: `${containerNo} · ${STATUS_LABEL[nextStatus]}${nextHold ? ' · Hold ON' : ''}` });
  };

  const updateEmrRemarks = (containerNo: string, newRemarks: string) => {
    setRecords(prev => prev.map(r => r.containerNo === containerNo
      ? {
          ...r,
          emrRemarks: newRemarks,
          modifiedBy: 'SOMCHAI.K',
          modifiedAt: new Date().toISOString(),
          activity: [
            { id: `a-${Date.now()}-e`, ts: new Date().toISOString(),
              event: 'EMR REMARKS UPDATED', remarks: newRemarks, by: 'SOMCHAI.K' },
            ...r.activity,
          ],
        }
      : r));
    toast({ variant: 'success', title: 'EMR remarks updated' });
  };

  const addFixPort = (containerNo: string, port: ContainerFixPort) => {
    setRecords(prev => prev.map(r => r.containerNo === containerNo
      ? { ...r, fixPorts: [...r.fixPorts, port] } : r));
  };

  const removeFixPort = (containerNo: string, portCode: string) => {
    setRecords(prev => prev.map(r => r.containerNo === containerNo
      ? { ...r, fixPorts: r.fixPorts.filter(p => p.portCode !== portCode) } : r));
  };

  /* ── Render ────────────────────────────────────────────────────────── */

  return (
    <div className="gecko-page-container">
      {/* Header */}
      <div className="gecko-cs-header">
        <div className="gecko-cs-header-left">
          <div className="gecko-cs-header-icon">
            <Icon name="box" size={20} />
          </div>
          <div>
            <h1 className="gecko-cs-header-title">Container Status Update</h1>
            <p className="gecko-cs-header-sub">
              Update status, holds, and EMR remarks for any container in the yard.
              Audited trail · single source of truth for downstream EDI.
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="gecko-cs-search-card">
        <div className="gecko-cs-search-label">SEARCH CONTAINER NO.</div>
        <div className="gecko-cs-typeahead">
          <Icon name="search" size={16} className="gecko-cs-search-icon" />
          <input
            type="text"
            className="gecko-input gecko-cs-search-input"
            placeholder="Type any 4-letter prefix or part of the container number…"
            value={query}
            onChange={e => { setQuery(e.target.value.toUpperCase()); setShowSuggest(true); }}
            onFocus={() => setShowSuggest(true)}
            onBlur={() => setTimeout(() => setShowSuggest(false), 200)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
          {showSuggest && suggestions.length > 0 && (
            <div className="gecko-cs-suggest" role="listbox">
              {suggestions.map(s => (
                <button
                  key={s.containerNo}
                  type="button"
                  className="gecko-cs-suggest-row"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setSelectedNo(s.containerNo);
                    setQuery(s.containerNo);
                    setShowSuggest(false);
                  }}
                >
                  <strong className="gecko-mono">{s.containerNo}</strong>
                  <span className="gecko-cs-suggest-meta">
                    {s.size}{s.type} · {s.agentCode} · {s.curLoc}
                    <span className={`${STATUS_BADGE_CLS[s.status]} gecko-cs-suggest-status`}>
                      {STATUS_LABEL[s.status]}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selected ? (
        <ContainerDetail
          record={selected}
          onUpdateStatus={updateStatus}
          onUpdateEmr={updateEmrRemarks}
          onAddPort={addFixPort}
          onRemovePort={removeFixPort}
        />
      ) : (
        <div className="gecko-cs-empty">
          <Icon name="search" size={40} className="gecko-cs-empty-icon" />
          <div className="gecko-cs-empty-title">Search for a container to begin</div>
          <div className="gecko-cs-empty-hint">
            Try{' '}
            {CONTAINER_RECORDS.slice(0, 4).map((c, i) => (
              <React.Fragment key={c.containerNo}>
                {i > 0 && ' · '}
                <button
                  type="button"
                  className="gecko-cs-empty-link"
                  onClick={() => { setSelectedNo(c.containerNo); setQuery(c.containerNo); }}
                >
                  {c.containerNo}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Detail body — hero strip + 3-column grid + activity log + fix ports
   ────────────────────────────────────────────────────────────────────────── */

function ContainerDetail({
  record, onUpdateStatus, onUpdateEmr, onAddPort, onRemovePort,
}: {
  record: ContainerRecord;
  onUpdateStatus: (no: string, status: ContainerStatus, hold: boolean, remarks: string) => void;
  onUpdateEmr: (no: string, remarks: string) => void;
  onAddPort: (no: string, port: ContainerFixPort) => void;
  onRemovePort: (no: string, portCode: string) => void;
}) {
  const isReefer = record.containerClass === 'REEFER';

  return (
    <>
      {/* Hero strip */}
      <div className="gecko-cs-hero">
        <div className="gecko-cs-hero-left">
          <div className="gecko-cs-hero-number gecko-mono">{record.containerNo}</div>
          <div className="gecko-cs-hero-chips">
            <span className="gecko-cs-chip">{record.size}{record.type}</span>
            <span className="gecko-cs-chip">{record.height}</span>
            <span className="gecko-cs-chip">{record.material}</span>
            {isReefer && <span className="gecko-cs-chip gecko-cs-chip-accent">REEFER</span>}
            <span className="gecko-cs-chip-mono">ISO {record.isoType}</span>
            <span className="gecko-cs-chip-meta">Agent · {record.agentCode}</span>
            <span className="gecko-cs-chip-meta">Loc · {record.curLoc}</span>
          </div>
        </div>
        <div className="gecko-cs-hero-right">
          <span className={STATUS_BADGE_CLS[record.status]}>{STATUS_LABEL[record.status]}</span>
          {record.hold && <span className="gecko-badge gecko-badge-warning">HOLD</span>}
        </div>
      </div>

      {/* 3-column grid */}
      <div className="gecko-cs-grid">
        <PropertiesCard record={record} />
        <MovementCard   record={record} />
        <ActionsCard
          record={record}
          onUpdateStatus={onUpdateStatus}
          onUpdateEmr={onUpdateEmr}
        />
      </div>

      {/* Activity Log */}
      <ActivityLogCard activity={record.activity} />

      {/* Fix Port Details */}
      <FixPortsCard
        fixPorts={record.fixPorts}
        onAdd={(p) => onAddPort(record.containerNo, p)}
        onRemove={(code) => onRemovePort(record.containerNo, code)}
      />

      {/* Audit footer */}
      <div className="gecko-cs-audit">
        Created by <strong>{record.createdBy}</strong> · {fmtDateTime(record.createdAt)}
        {' · '}
        Modified by <strong>{record.modifiedBy}</strong> · {fmtDateTime(record.modifiedAt)}
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Card 1 — Container Properties (read-only)
   ────────────────────────────────────────────────────────────────────────── */

function PropertiesCard({ record }: { record: ContainerRecord }) {
  return (
    <section className="gecko-cs-card">
      <div className="gecko-cs-card-title">
        <Icon name="box" size={14} /> Container Properties
      </div>
      <dl className="gecko-cs-dl">
        <Row label="Agent">
          <div>{record.agentCode}</div>
          <div className="gecko-cs-dl-sub">{record.agentName}</div>
        </Row>
        <Row label="Owner">{record.ownerCode}</Row>
        <Row label="Hire Mode">{record.hireMode}</Row>
        <Row label="Size · Type">{record.size} · {record.type}</Row>
        <Row label="Material / Height">{record.material} · {record.height}</Row>
        <Row label="Container Class">{record.containerClass}</Row>
        <Row label="ISO Type">{record.isoType}</Row>
        <Row label="Tare Weight">{record.tareWgt.toLocaleString()} kg</Row>
        <Row label="Max Gross">{record.maxGrossWgt.toLocaleString()} kg</Row>
        <Row label="Yard Location">{record.yardLocation || '—'}</Row>
      </dl>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Card 2 — Current Movement (read-only)
   ────────────────────────────────────────────────────────────────────────── */

function MovementCard({ record }: { record: ContainerRecord }) {
  const isReefer = record.containerClass === 'REEFER';
  return (
    <section className="gecko-cs-card">
      <div className="gecko-cs-card-title">
        <Icon name="activity" size={14} /> Current Movement
      </div>
      <dl className="gecko-cs-dl">
        <Row label="Empty / Full">
          <span className="gecko-badge gecko-badge-info">{record.emptyFull}</span>
        </Row>
        <Row label="Movement">{record.movement ?? '—'}</Row>
        <Row label="EIR No.">{record.eirNo || '—'}</Row>
        <Row label="Agent Seal">{record.agentSeal || '—'}</Row>
        <Row label="Customer Seal">{record.customerSeal || '—'}</Row>
        <Row label="EF Indicator">{record.efIndicator}</Row>
        <Row label="Movement Indicator">{record.movementIndicator}</Row>
        {isReefer && (
          <>
            <Row label="Temperature">{record.temp !== null ? `${record.temp.toFixed(1)} °C` : '—'}</Row>
            <Row label="Temp Mode">{record.temperatureMode || '—'}</Row>
          </>
        )}
        <Row label="Current Loc">{record.curLoc}</Row>
      </dl>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Card 3 — Actions (Status + EMR forms)
   ────────────────────────────────────────────────────────────────────────── */

function ActionsCard({
  record, onUpdateStatus, onUpdateEmr,
}: {
  record: ContainerRecord;
  onUpdateStatus: (no: string, status: ContainerStatus, hold: boolean, remarks: string) => void;
  onUpdateEmr: (no: string, remarks: string) => void;
}) {
  const [status, setStatus]         = useState<ContainerStatus>(record.status);
  const [hold, setHold]             = useState(record.hold);
  const [statusRemarks, setStatusRemarks] = useState(record.statusRemarks);
  const [emrRemarks, setEmrRemarks] = useState(record.emrRemarks);

  // Reset local form state when container changes
  React.useEffect(() => {
    setStatus(record.status);
    setHold(record.hold);
    setStatusRemarks(record.statusRemarks);
    setEmrRemarks(record.emrRemarks);
  }, [record.containerNo, record.status, record.hold, record.statusRemarks, record.emrRemarks]);

  const statusDirty = status !== record.status
    || hold !== record.hold
    || statusRemarks !== record.statusRemarks;

  const emrDirty = emrRemarks !== record.emrRemarks;

  return (
    <section className="gecko-cs-card gecko-cs-card-accent">
      <div className="gecko-cs-card-title">
        <Icon name="edit" size={14} /> Actions
      </div>

      <div className="gecko-cs-form-section">
        <div className="gecko-cs-form-section-title">Change Status</div>

        <FormGrid columns={1}>
          <Field label="Status" htmlFor="cs-status">
            <select
              id="cs-status"
              className="gecko-input"
              value={status}
              onChange={e => setStatus(e.target.value as ContainerStatus)}
            >
              {ALL_STATUSES.map(s => (
                <option key={s} value={s}>{s} — {STATUS_LABEL[s]}</option>
              ))}
            </select>
          </Field>
        </FormGrid>

        <label className="gecko-cs-hold-row">
          <input
            type="checkbox"
            checked={hold}
            onChange={e => setHold(e.target.checked)}
          />
          <span>Hold</span>
          <span className="gecko-cs-hold-hint">Blocks gate-out until released</span>
        </label>

        <FormGrid columns={1}>
          <Field label="Status Remarks" htmlFor="cs-status-remarks">
            <textarea
              id="cs-status-remarks"
              className="gecko-input"
              rows={2}
              value={statusRemarks}
              onChange={e => setStatusRemarks(e.target.value)}
              placeholder="Why this status change? (e.g. customs hold, damage code, allocation)"
            />
          </Field>
        </FormGrid>

        <div className="gecko-cs-form-actions">
          <button
            type="button"
            className="gecko-btn gecko-btn-ghost gecko-btn-sm"
            onClick={() => {
              setStatus(record.status);
              setHold(record.hold);
              setStatusRemarks(record.statusRemarks);
            }}
            disabled={!statusDirty}
          >
            Reset
          </button>
          <button
            type="button"
            className="gecko-btn gecko-btn-primary gecko-btn-sm"
            disabled={!statusDirty}
            onClick={() => onUpdateStatus(record.containerNo, status, hold, statusRemarks)}
          >
            Update Status
          </button>
        </div>
      </div>

      <div className="gecko-cs-form-divider" />

      <div className="gecko-cs-form-section">
        <FormGrid columns={1}>
          <Field label="EMR Remarks" htmlFor="cs-emr"
                 helper="Free-text notes from M&R / workshop — damage, repair quote, vendor instruction, etc.">
            <textarea
              id="cs-emr"
              className="gecko-input gecko-cs-emr-textarea"
              rows={4}
              value={emrRemarks}
              onChange={e => setEmrRemarks(e.target.value)}
              placeholder="Notes will be visible to the gate cashier and the M&R workshop."
            />
          </Field>
        </FormGrid>
        <div className="gecko-cs-form-actions">
          <button
            type="button"
            className="gecko-btn gecko-btn-ghost gecko-btn-sm"
            onClick={() => setEmrRemarks(record.emrRemarks)}
            disabled={!emrDirty}
          >
            Reset
          </button>
          <button
            type="button"
            className="gecko-btn gecko-btn-primary gecko-btn-sm"
            disabled={!emrDirty}
            onClick={() => onUpdateEmr(record.containerNo, emrRemarks)}
          >
            Update Remarks
          </button>
        </div>
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Activity Log
   ────────────────────────────────────────────────────────────────────────── */

function ActivityLogCard({ activity }: { activity: ActivityEntry[] }) {
  const [expanded, setExpanded] = useState(true);
  const sorted = useMemo(() => [...activity].sort((a, b) => b.ts.localeCompare(a.ts)), [activity]);

  return (
    <section className="gecko-cs-card gecko-cs-card-full">
      <button
        type="button"
        className="gecko-cs-card-title gecko-cs-card-title-toggle"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
      >
        <Icon name="clock" size={14} /> Activity Log
        <span className="gecko-cs-card-count">{activity.length}</span>
        <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={14} className="gecko-cs-card-toggle-icon" />
      </button>
      {expanded && (
        <div className="gecko-cs-table-wrap">
          <table className="gecko-table gecko-table-compact gecko-cs-activity-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Event</th>
                <th>Transition</th>
                <th>Remarks</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(e => (
                <tr key={e.id}>
                  <td className="gecko-cs-activity-when">
                    <div>{fmtDateTime(e.ts)}</div>
                    <div className="gecko-cs-dl-sub">{timeAgo(e.ts)}</div>
                  </td>
                  <td><strong>{e.event}</strong></td>
                  <td>
                    {e.fromStatus && e.toStatus ? (
                      <span className="gecko-cs-transition">
                        <span className={STATUS_BADGE_CLS[e.fromStatus]}>{e.fromStatus}</span>
                        <Icon name="arrowRight" size={12} />
                        <span className={STATUS_BADGE_CLS[e.toStatus]}>{e.toStatus}</span>
                      </span>
                    ) : '—'}
                  </td>
                  <td>{e.remarks ?? '—'}</td>
                  <td className="gecko-mono">{e.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Fix Port Details
   ────────────────────────────────────────────────────────────────────────── */

function FixPortsCard({
  fixPorts, onAdd, onRemove,
}: {
  fixPorts: ContainerFixPort[];
  onAdd: (p: ContainerFixPort) => void;
  onRemove: (code: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);

  const suggestions = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return [];
    return PORT_DIRECTORY
      .filter(p => p.code.includes(q) || p.name.includes(q))
      .filter(p => !fixPorts.some(f => f.portCode === p.code))
      .slice(0, 8);
  }, [query, fixPorts]);

  return (
    <section className="gecko-cs-card gecko-cs-card-full">
      <button
        type="button"
        className="gecko-cs-card-title gecko-cs-card-title-toggle"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
      >
        <Icon name="anchor" size={14} /> Fix Port Details
        <span className="gecko-cs-card-count">{fixPorts.length}</span>
        <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={14} className="gecko-cs-card-toggle-icon" />
      </button>
      {expanded && (
        <div className="gecko-cs-fix-ports-body">
          <div className="gecko-cs-fix-port-typeahead">
            <input
              type="text"
              className="gecko-input gecko-input-sm"
              placeholder="Add port — type code or name (e.g. SGSIN or Singapore)"
              value={query}
              onChange={e => { setQuery(e.target.value.toUpperCase()); setShowSuggest(true); }}
              onFocus={() => setShowSuggest(true)}
              onBlur={() => setTimeout(() => setShowSuggest(false), 200)}
            />
            {showSuggest && suggestions.length > 0 && (
              <div className="gecko-cs-suggest">
                {suggestions.map(s => (
                  <button
                    key={s.code}
                    type="button"
                    className="gecko-cs-suggest-row"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onAdd({ portCode: s.code, portName: s.name });
                      setQuery('');
                      setShowSuggest(false);
                    }}
                  >
                    <strong className="gecko-mono">{s.code}</strong>
                    <span className="gecko-cs-suggest-meta">{s.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {fixPorts.length === 0 ? (
            <div className="gecko-cs-fix-port-empty">No fix ports declared for this container.</div>
          ) : (
            <table className="gecko-table gecko-table-compact gecko-cs-fix-port-table">
              <thead>
                <tr>
                  <th>Port Code</th>
                  <th>Port Name</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {fixPorts.map(p => (
                  <tr key={p.portCode}>
                    <td className="gecko-mono">{p.portCode}</td>
                    <td>{p.portName}</td>
                    <td>
                      <button
                        type="button"
                        className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm"
                        onClick={() => onRemove(p.portCode)}
                        aria-label="Remove port"
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
