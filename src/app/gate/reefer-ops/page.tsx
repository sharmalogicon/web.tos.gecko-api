"use client";

/**
 * Reefer Operations — single screen, three workflow lenses.
 *
 * Tabs:
 *   1. Pre-Cool       — empties cooling for upcoming export stuffing
 *   2. PTI            — pre-trip inspection, 12-step generic protocol v1
 *   3. Monitoring     — laden reefers on yard, periodic temp readings
 *
 * Pattern mirrors Navis N4 Reefer Manager (unified roster across workflows)
 * rather than the ContainerChain WinForms split-tab approach — modern screen
 * real estate makes the one-roster shape strictly better.
 *
 * Phase 1: mocked data + drawers; Phase 2 will swap to live backend calls.
 */

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import {
  REEFER_ROSTER, PRE_COOL_TASKS, PTI_TASKS, TEMP_READINGS,
  getReadingsFor, plugCensus,
} from '@/lib/reefer-mocks';
import type {
  PreCoolTask, PTITask, TempReading,
  PreCoolStatus, PTIStatus, PTIItemResult, CargoBand, PlugStatus,
} from '@/lib/reefer-types';
import { PTI_PROTOCOL_V1, DEFAULT_REEFER_CONFIG } from '@/lib/reefer-types';

type TabId = 'precool' | 'pti' | 'monitor';

const CARGO_BAND_LABEL: Record<CargoBand, string> = {
  PHARMA:       'Pharma',
  FOOD:         'Food',
  NON_CRITICAL: 'Non-critical',
};

const CARGO_BAND_BADGE: Record<CargoBand, string> = {
  PHARMA:       'gecko-badge gecko-badge-accent',
  FOOD:         'gecko-badge gecko-badge-info',
  NON_CRITICAL: 'gecko-badge gecko-badge-gray',
};

const PRE_COOL_BADGE: Record<PreCoolStatus, { label: string; cls: string }> = {
  REQUESTED:   { label: 'Requested',   cls: 'gecko-badge gecko-badge-gray' },
  IN_PROGRESS: { label: 'In Progress', cls: 'gecko-badge gecko-badge-warning' },
  COMPLETED:   { label: 'Target Reached', cls: 'gecko-badge gecko-badge-success' },
  ABORTED:     { label: 'Aborted',     cls: 'gecko-badge gecko-badge-error' },
};

const PTI_BADGE: Record<PTIStatus, { label: string; cls: string }> = {
  PENDING:     { label: 'Pending',     cls: 'gecko-badge gecko-badge-gray' },
  IN_PROGRESS: { label: 'In Progress', cls: 'gecko-badge gecko-badge-warning' },
  PASSED:      { label: 'Passed',      cls: 'gecko-badge gecko-badge-success' },
  FAILED:      { label: 'Failed',      cls: 'gecko-badge gecko-badge-error' },
};

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const NOW = new Date('2026-05-18T09:18:00+07:00').getTime();
  const t = new Date(iso).getTime();
  const mins = Math.round((NOW - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = mins / 60;
  if (hrs < 24) return `${hrs.toFixed(1)}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function fmtTemp(v: number | null): string {
  if (v === null || v === undefined) return '—';
  return `${v.toFixed(1)}°C`;
}

/* ────────────────────────────────────────────────────────────────────────── */

export default function ReeferOpsPage() {
  const [tab, setTab] = useState<TabId>('precool');

  const [preCool, setPreCool] = useState<PreCoolTask[]>(PRE_COOL_TASKS);
  const [pti, setPti]         = useState<PTITask[]>(PTI_TASKS);
  const [readings, setReadings] = useState<TempReading[]>(TEMP_READINGS);

  const [tempDrawerFor, setTempDrawerFor]   = useState<string | null>(null);
  const [ptiDrawerFor, setPtiDrawerFor]     = useState<string | null>(null);
  const [precoolDrawerFor, setPrecoolDrawerFor] = useState<string | null>(null);

  const { toast } = useToast();
  const plugs = plugCensus();

  // KPI strip ───────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const reefersOnYard = REEFER_ROSTER.length;
    const preCoolInProgress = preCool.filter(p => p.status === 'IN_PROGRESS').length;
    const ptiToday = pti.filter(p => p.startedAt &&
      new Date(p.startedAt) >= new Date('2026-05-18T00:00:00+07:00')).length;
    const ptiPass = pti.filter(p => p.status === 'PASSED').length;
    const ptiFail = pti.filter(p => p.status === 'FAILED').length;
    const openAlarms = REEFER_ROSTER.filter(r => r.alarm !== null).length;
    return { reefersOnYard, preCoolInProgress, ptiToday, ptiPass, ptiFail, openAlarms };
  }, [preCool, pti]);

  /* ── Action handlers ─────────────────────────────────────────────── */

  const startPreCool = (id: string) => {
    setPreCool(prev => prev.map(t => t.id === id
      ? { ...t, status: 'IN_PROGRESS' as const, startedAt: new Date().toISOString(), technician: 'Somchai K.' }
      : t));
    toast({ variant: 'success', title: 'Pre-cool started' });
  };

  const markPreCoolComplete = (id: string) => {
    setPreCool(prev => prev.map(t => t.id === id
      ? { ...t, status: 'COMPLETED' as const, completedAt: new Date().toISOString() }
      : t));
    toast({ variant: 'success', title: 'Pre-cool target reached' });
    setPrecoolDrawerFor(null);
  };

  const completePTI = (id: string, result: 'PASSED' | 'FAILED', items: PTITask['items'], notes: string, failureReason?: string) => {
    setPti(prev => prev.map(t => t.id === id
      ? { ...t, status: result, items, overallNotes: notes, failureReason,
          completedAt: new Date().toISOString(),
          startedAt: t.startedAt ?? new Date().toISOString(),
          technician: t.technician ?? 'Somchai K.' }
      : t));
    toast({
      variant: result === 'PASSED' ? 'success' : 'danger',
      title: `PTI ${result === 'PASSED' ? 'passed' : 'failed'}`,
    });
    setPtiDrawerFor(null);
  };

  const startPTI = (id: string) => {
    setPti(prev => prev.map(t => t.id === id
      ? { ...t, status: 'IN_PROGRESS' as const, startedAt: new Date().toISOString(), technician: 'Somchai K.' }
      : t));
    setPtiDrawerFor(id);
  };

  const addReading = (containerNo: string, r: Omit<TempReading, 'id' | 'containerNo' | 'recordedAt' | 'recordedBy' | 'inBand'>) => {
    const roster = REEFER_ROSTER.find(x => x.containerNo === containerNo);
    const band = roster?.cargoBand ?? 'NON_CRITICAL';
    const tolerance = DEFAULT_REEFER_CONFIG.bandToleranceC[band];
    const deviation = Math.abs(r.supplyTempC - r.setPointC);
    const inBand = deviation <= tolerance;

    const newReading: TempReading = {
      id: `tr-${Date.now()}`,
      containerNo,
      recordedAt: new Date().toISOString(),
      recordedBy: 'Somchai K.',
      inBand,
      ...r,
    };
    setReadings(prev => [newReading, ...prev]);
    toast({
      variant: inBand ? 'success' : 'danger',
      title: inBand ? 'Reading logged' : 'Reading logged — DEVIATION',
      message: inBand ? 'Within tolerance band' : `${deviation.toFixed(1)}°C outside ${band} band (±${tolerance}°C)`,
    });
    setTempDrawerFor(null);
  };

  /* ── Render ──────────────────────────────────────────────────────── */

  return (
    <div className="gecko-page-container">
      {/* Header */}
      <div className="gecko-reefer-header">
        <div className="gecko-reefer-header-left">
          <div className="gecko-reefer-header-icon">
            <Icon name="thermometer" size={20} />
          </div>
          <div>
            <h1 className="gecko-reefer-header-title">Reefer Operations</h1>
            <p className="gecko-reefer-header-sub">
              Pre-cool · PTI · Temperature monitoring — all reefers on yard
            </p>
          </div>
        </div>
        <Link href="/gate/reefer-ops/new" className="gecko-btn gecko-btn-primary">
          <Icon name="plus" size={14} />
          New Task
        </Link>
      </div>

      {/* KPI strip */}
      <div className="gecko-reefer-kpi-strip">
        <KPI icon="box"          tone="primary" label="Reefers on yard"  value={String(kpis.reefersOnYard)} />
        <KPI icon="zap"          tone="info"
             label="Plugs in use"
             value={`${plugs.used} / ${plugs.capacity}`}
             foot={plugs.faulted > 0 ? `${plugs.faulted} fault` : undefined} />
        <KPI icon="thermometer"  tone="warning" label="Pre-cool in progress" value={String(kpis.preCoolInProgress)} />
        <KPI icon="shieldCheck"  tone="success"
             label="PTI today"
             value={`${kpis.ptiPass}✓ / ${kpis.ptiFail}✗`}
             foot={`${kpis.ptiToday} run`} />
        <KPI icon="alertCircle"  tone={kpis.openAlarms > 0 ? 'danger' : 'neutral'}
             label="Open alarms" value={String(kpis.openAlarms)} />
      </div>

      {/* Tabs */}
      <div className="gecko-tabs gecko-reefer-tabs">
        <button
          className={`gecko-tab${tab === 'precool' ? ' gecko-tab-active' : ''}`}
          onClick={() => setTab('precool')}
        >
          <Icon name="thermometer" size={14} />
          Pre-Cool
          <span className="gecko-reefer-tab-count">{preCool.length}</span>
        </button>
        <button
          className={`gecko-tab${tab === 'pti' ? ' gecko-tab-active' : ''}`}
          onClick={() => setTab('pti')}
        >
          <Icon name="shieldCheck" size={14} />
          PTI
          <span className="gecko-reefer-tab-count">{pti.length}</span>
        </button>
        <button
          className={`gecko-tab${tab === 'monitor' ? ' gecko-tab-active' : ''}`}
          onClick={() => setTab('monitor')}
        >
          <Icon name="activity" size={14} />
          Monitoring
          <span className="gecko-reefer-tab-count">
            {REEFER_ROSTER.filter(r => r.status !== 'EMPTY').length}
          </span>
        </button>
      </div>

      {/* Tab body */}
      <div className="gecko-reefer-body">
        {tab === 'precool' && (
          <PreCoolTab
            tasks={preCool}
            onOpen={(id) => setPrecoolDrawerFor(id)}
            onStart={startPreCool}
          />
        )}
        {tab === 'pti' && (
          <PTITab
            tasks={pti}
            onStart={startPTI}
            onOpen={(id) => setPtiDrawerFor(id)}
          />
        )}
        {tab === 'monitor' && (
          <MonitorTab
            roster={REEFER_ROSTER.filter(r => r.status !== 'EMPTY')}
            onLogReading={(c) => setTempDrawerFor(c)}
          />
        )}
      </div>

      {/* Drawers */}
      {tempDrawerFor && (
        <TempReadingDrawer
          containerNo={tempDrawerFor}
          history={getReadingsFor(tempDrawerFor)}
          recentReadings={readings.filter(r => r.containerNo === tempDrawerFor).slice(0, 6)}
          onClose={() => setTempDrawerFor(null)}
          onSubmit={(r) => addReading(tempDrawerFor, r)}
        />
      )}
      {ptiDrawerFor && (
        <PTIChecklistDrawer
          task={pti.find(t => t.id === ptiDrawerFor)!}
          onClose={() => setPtiDrawerFor(null)}
          onComplete={completePTI}
        />
      )}
      {precoolDrawerFor && (
        <PreCoolDrawer
          task={preCool.find(t => t.id === precoolDrawerFor)!}
          onClose={() => setPrecoolDrawerFor(null)}
          onComplete={markPreCoolComplete}
        />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   KPI tile (uses shared .gecko-kpi-tile primitives)
   ────────────────────────────────────────────────────────────────────────── */

function KPI({
  icon, tone, label, value, foot,
}: {
  icon: string;
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  label: string;
  value: string;
  foot?: string;
}) {
  return (
    <div className="gecko-kpi-tile">
      <div className={`gecko-kpi-tile-icon gecko-kpi-tile-icon-${tone}`}>
        <Icon name={icon} size={16} />
      </div>
      <div>
        <div className="gecko-kpi-tile-value">{value}</div>
        <div className="gecko-kpi-tile-label">{label}{foot ? ` · ${foot}` : ''}</div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Tab 1 — Pre-Cool
   ────────────────────────────────────────────────────────────────────────── */

function PreCoolTab({
  tasks, onOpen, onStart,
}: {
  tasks: PreCoolTask[];
  onOpen: (id: string) => void;
  onStart: (id: string) => void;
}) {
  return (
    <div className="gecko-table-wrapper">
      <table className="gecko-table">
        <thead>
          <tr>
            <th>Container</th>
            <th>Booking</th>
            <th>Liner</th>
            <th>Band</th>
            <th className="gecko-num">Target</th>
            <th className="gecko-num">Current</th>
            <th className="gecko-num">Hours run</th>
            <th>Plug</th>
            <th>Technician</th>
            <th>Status</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {tasks.map(t => {
            const tempDelta = t.currentTempC !== null
              ? Math.abs(t.currentTempC - t.targetTempC)
              : null;
            const closeToTarget = tempDelta !== null && tempDelta <= 2;
            return (
              <tr key={t.id}>
                <td><strong>{t.containerNo}</strong></td>
                <td className="gecko-mono">{t.bookingNo}</td>
                <td>{t.liner}</td>
                <td><span className={CARGO_BAND_BADGE[t.cargoBand]}>{CARGO_BAND_LABEL[t.cargoBand]}</span></td>
                <td className="gecko-num gecko-mono">{fmtTemp(t.targetTempC)}</td>
                <td className="gecko-num gecko-mono">
                  {fmtTemp(t.currentTempC)}
                  {closeToTarget && t.status === 'IN_PROGRESS' && (
                    <Icon name="arrowDown" size={11} className="gecko-reefer-trend-good" />
                  )}
                </td>
                <td className="gecko-num gecko-mono">{t.hoursRun > 0 ? t.hoursRun.toFixed(1) : '—'}</td>
                <td className="gecko-mono">{t.plug ?? '—'}</td>
                <td>{t.technician ?? '—'}</td>
                <td><span className={PRE_COOL_BADGE[t.status].cls}>{PRE_COOL_BADGE[t.status].label}</span></td>
                <td>
                  <div className="gecko-reefer-actions">
                    {t.status === 'REQUESTED' && (
                      <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => onStart(t.id)}>
                        Start
                      </button>
                    )}
                    {t.status === 'IN_PROGRESS' && (
                      <button className="gecko-btn gecko-btn-success gecko-btn-sm" onClick={() => onOpen(t.id)}>
                        Open
                      </button>
                    )}
                    {(t.status === 'COMPLETED' || t.status === 'ABORTED') && (
                      <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={() => onOpen(t.id)}>
                        View
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Tab 2 — PTI
   ────────────────────────────────────────────────────────────────────────── */

function PTITab({
  tasks, onStart, onOpen,
}: {
  tasks: PTITask[];
  onStart: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="gecko-table-wrapper">
      <table className="gecko-table">
        <thead>
          <tr>
            <th>Container</th>
            <th>Liner</th>
            <th>Protocol</th>
            <th>Technician</th>
            <th>Started</th>
            <th className="gecko-num">Steps done</th>
            <th>Result</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {tasks.map(t => {
            const total = PTI_PROTOCOL_V1.length;
            const done = Object.values(t.items).filter(v => v.result !== null).length;
            return (
              <tr key={t.id}>
                <td><strong>{t.containerNo}</strong></td>
                <td>{t.liner}</td>
                <td>Generic {t.protocolVersion}</td>
                <td>{t.technician ?? '—'}</td>
                <td>{timeAgo(t.startedAt)}</td>
                <td className="gecko-num gecko-mono">{done} / {total}</td>
                <td><span className={PTI_BADGE[t.status].cls}>{PTI_BADGE[t.status].label}</span></td>
                <td>
                  <div className="gecko-reefer-actions">
                    {t.status === 'PENDING' && (
                      <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => onStart(t.id)}>
                        Start PTI
                      </button>
                    )}
                    {t.status === 'IN_PROGRESS' && (
                      <button className="gecko-btn gecko-btn-success gecko-btn-sm" onClick={() => onOpen(t.id)}>
                        Continue
                      </button>
                    )}
                    {(t.status === 'PASSED' || t.status === 'FAILED') && (
                      <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={() => onOpen(t.id)}>
                        View report
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Tab 3 — Monitoring
   ────────────────────────────────────────────────────────────────────────── */

function MonitorTab({
  roster, onLogReading,
}: {
  roster: typeof REEFER_ROSTER;
  onLogReading: (containerNo: string) => void;
}) {
  return (
    <div className="gecko-table-wrapper">
      <table className="gecko-table">
        <thead>
          <tr>
            <th>Container</th>
            <th>Booking</th>
            <th>Liner</th>
            <th>Band</th>
            <th className="gecko-num">Set-pt</th>
            <th className="gecko-num">Supply</th>
            <th className="gecko-num">Return</th>
            <th className="gecko-num">RH%</th>
            <th>Plug</th>
            <th>Last reading</th>
            <th>Status</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {roster.map(r => {
            const overdue = isOverdue(r.lastReadingAt);
            return (
              <tr key={r.containerNo} className={r.alarm ? 'gecko-reefer-row-alarm' : ''}>
                <td><strong>{r.containerNo}</strong></td>
                <td className="gecko-mono">{r.bookingNo ?? '—'}</td>
                <td>{r.liner}</td>
                <td>{r.cargoBand
                  ? <span className={CARGO_BAND_BADGE[r.cargoBand]}>{CARGO_BAND_LABEL[r.cargoBand]}</span>
                  : '—'}</td>
                <td className="gecko-num gecko-mono">{fmtTemp(r.setPointC)}</td>
                <td className="gecko-num gecko-mono">{fmtTemp(r.lastSupplyTempC)}</td>
                <td className="gecko-num gecko-mono">{fmtTemp(r.lastReturnTempC)}</td>
                <td className="gecko-num gecko-mono">{r.lastHumidityPct != null ? `${r.lastHumidityPct}%` : '—'}</td>
                <td><PlugBadge status={r.plugStatus} plug={r.plug} /></td>
                <td className={overdue ? 'gecko-reefer-overdue' : ''}>{timeAgo(r.lastReadingAt)}</td>
                <td><AlarmBadge alarm={r.alarm} /></td>
                <td>
                  <div className="gecko-reefer-actions">
                    <button className="gecko-btn gecko-btn-primary gecko-btn-sm" onClick={() => onLogReading(r.containerNo)}>
                      Log reading
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function isOverdue(iso: string | null): boolean {
  if (!iso) return true;
  const NOW = new Date('2026-05-18T09:18:00+07:00').getTime();
  const elapsed = (NOW - new Date(iso).getTime()) / 3600 / 1000;
  return elapsed > (DEFAULT_REEFER_CONFIG.tempLogCadenceHours +
                    DEFAULT_REEFER_CONFIG.tempLogGraceMinutes / 60);
}

function PlugBadge({ status, plug }: { status: PlugStatus; plug: string | null }) {
  if (status === 'FAULT') return <span className="gecko-badge gecko-badge-error">Fault</span>;
  if (status === 'UNPLUGGED') return <span className="gecko-badge gecko-badge-gray">Unplugged</span>;
  return <span className="gecko-mono gecko-reefer-plug">{plug}</span>;
}

function AlarmBadge({ alarm }: { alarm: string | null }) {
  if (!alarm) return <span className="gecko-badge gecko-badge-success">OK</span>;
  const label =
    alarm === 'DEVIATION'         ? 'Deviation' :
    alarm === 'NO_READING'        ? 'Overdue'   :
    alarm === 'PLUG_DISCONNECTED' ? 'Unplugged' :
    alarm === 'UNIT_FAULT'        ? 'Fault'     : alarm;
  return <span className="gecko-badge gecko-badge-error">{label}</span>;
}

/* ──────────────────────────────────────────────────────────────────────────
   Drawer 1 — Temperature reading
   ────────────────────────────────────────────────────────────────────────── */

function TempReadingDrawer({
  containerNo, history, recentReadings, onClose, onSubmit,
}: {
  containerNo: string;
  history: TempReading[];
  recentReadings: TempReading[];
  onClose: () => void;
  onSubmit: (r: Omit<TempReading, 'id' | 'containerNo' | 'recordedAt' | 'recordedBy' | 'inBand'>) => void;
}) {
  const roster = REEFER_ROSTER.find(r => r.containerNo === containerNo);
  const [setPointC, setSetPointC] = useState(roster?.setPointC?.toString() ?? '');
  const [supplyTempC, setSupplyTempC] = useState('');
  const [returnTempC, setReturnTempC] = useState('');
  const [humidityPct, setHumidityPct] = useState(roster?.lastHumidityPct?.toString() ?? '');
  const [plugStatus, setPlugStatus] = useState<PlugStatus>(roster?.plugStatus ?? 'PLUGGED');
  const [remarks, setRemarks] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      setPointC: Number(setPointC),
      supplyTempC: Number(supplyTempC),
      returnTempC: Number(returnTempC),
      humidityPct: humidityPct ? Number(humidityPct) : null,
      plugStatus,
      remarks: remarks || undefined,
    });
  };

  return (
    <>
      <div className="gecko-drawer-scrim" onClick={onClose} />
      <aside className="gecko-drawer gecko-drawer-lg" role="dialog" aria-label={`Log reading for ${containerNo}`}>
        <div className="gecko-drawer-header">
          <div>
            <div className="gecko-drawer-title">Log temperature reading</div>
            <div className="gecko-drawer-subtitle">
              <strong>{containerNo}</strong> · {roster?.liner} · {roster?.cargoBand
                ? CARGO_BAND_LABEL[roster.cargoBand] + ` band ± ${DEFAULT_REEFER_CONFIG.bandToleranceC[roster.cargoBand]}°C`
                : '—'}
            </div>
          </div>
          <button className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="gecko-drawer-body">
          <div className="gecko-reefer-form-grid">
            <label className="gecko-form-row">
              <span>Set-point (°C)</span>
              <input
                type="number" step="0.1" required
                className="gecko-input gecko-input-sm"
                value={setPointC} onChange={e => setSetPointC(e.target.value)}
              />
            </label>
            <label className="gecko-form-row">
              <span>Supply air (°C)</span>
              <input
                type="number" step="0.1" required autoFocus
                className="gecko-input gecko-input-sm"
                value={supplyTempC} onChange={e => setSupplyTempC(e.target.value)}
              />
            </label>
            <label className="gecko-form-row">
              <span>Return air (°C)</span>
              <input
                type="number" step="0.1" required
                className="gecko-input gecko-input-sm"
                value={returnTempC} onChange={e => setReturnTempC(e.target.value)}
              />
            </label>
            <label className="gecko-form-row">
              <span>Humidity (%RH)</span>
              <input
                type="number" min="0" max="100"
                className="gecko-input gecko-input-sm"
                value={humidityPct} onChange={e => setHumidityPct(e.target.value)}
              />
            </label>
            <label className="gecko-form-row">
              <span>Plug status</span>
              <select
                className="gecko-input gecko-input-sm"
                value={plugStatus}
                onChange={e => setPlugStatus(e.target.value as PlugStatus)}
              >
                <option value="PLUGGED">Plugged</option>
                <option value="UNPLUGGED">Unplugged</option>
                <option value="FAULT">Fault</option>
              </select>
            </label>
            <label className="gecko-form-row gecko-form-row-full">
              <span>Remarks</span>
              <input
                type="text"
                className="gecko-input gecko-input-sm"
                placeholder="Optional — observed condition, defrost, door open, etc."
                value={remarks} onChange={e => setRemarks(e.target.value)}
              />
            </label>
          </div>

          {recentReadings.length > 0 && (
            <div className="gecko-reefer-history">
              <div className="gecko-section-header-title">Recent readings</div>
              <table className="gecko-table gecko-table-compact gecko-reefer-history-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th className="gecko-num">Set-pt</th>
                    <th className="gecko-num">Supply</th>
                    <th className="gecko-num">Return</th>
                    <th className="gecko-num">RH%</th>
                    <th>By</th>
                    <th>Band</th>
                  </tr>
                </thead>
                <tbody>
                  {recentReadings.map(h => (
                    <tr key={h.id}>
                      <td>{timeAgo(h.recordedAt)}</td>
                      <td className="gecko-num gecko-mono">{fmtTemp(h.setPointC)}</td>
                      <td className="gecko-num gecko-mono">{fmtTemp(h.supplyTempC)}</td>
                      <td className="gecko-num gecko-mono">{fmtTemp(h.returnTempC)}</td>
                      <td className="gecko-num gecko-mono">{h.humidityPct ?? '—'}</td>
                      <td>{h.recordedBy}</td>
                      <td>{h.inBand
                        ? <span className="gecko-badge gecko-badge-success">In</span>
                        : <span className="gecko-badge gecko-badge-error">Out</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="gecko-drawer-footer">
            <button type="button" className="gecko-btn gecko-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="gecko-btn gecko-btn-primary">Log reading</button>
          </div>
        </form>
      </aside>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Drawer 2 — PTI Checklist
   ────────────────────────────────────────────────────────────────────────── */

function PTIChecklistDrawer({
  task, onClose, onComplete,
}: {
  task: PTITask;
  onClose: () => void;
  onComplete: (id: string, result: 'PASSED' | 'FAILED', items: PTITask['items'], notes: string, failureReason?: string) => void;
}) {
  const [items, setItems] = useState(() => ({ ...task.items }));
  const [notes, setNotes] = useState(task.overallNotes ?? '');
  const [failureReason, setFailureReason] = useState(task.failureReason ?? '');
  const readonly = task.status === 'PASSED' || task.status === 'FAILED';

  const setResult = (id: string, result: PTIItemResult) => {
    setItems(prev => ({ ...prev, [id]: { ...prev[id], result } }));
  };

  const setItemNote = (id: string, note: string) => {
    setItems(prev => ({ ...prev, [id]: { ...prev[id], notes: note } }));
  };

  const allEvaluated = Object.values(items).every(v => v.result !== null);
  const anyNotOK = Object.values(items).some(v => v.result === 'NOT_OK');

  const submit = (result: 'PASSED' | 'FAILED') => {
    onComplete(task.id, result, items, notes, result === 'FAILED' ? failureReason : undefined);
  };

  return (
    <>
      <div className="gecko-drawer-scrim" onClick={onClose} />
      <aside className="gecko-drawer gecko-drawer-lg" role="dialog" aria-label={`PTI for ${task.containerNo}`}>
        <div className="gecko-drawer-header">
          <div>
            <div className="gecko-drawer-title">PTI · {task.containerNo}</div>
            <div className="gecko-drawer-subtitle">
              {task.liner} · Protocol {task.protocolVersion} · Technician {task.technician ?? '—'}
            </div>
          </div>
          <button className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="gecko-drawer-body">
          <ul className="gecko-pti-checklist">
            {PTI_PROTOCOL_V1.map(def => {
              const v = items[def.id];
              return (
                <li key={def.id} className="gecko-pti-item">
                  <div className="gecko-pti-step">{def.step}</div>
                  <div className="gecko-pti-content">
                    <div className="gecko-pti-label">{def.label}</div>
                    {def.hint && <div className="gecko-pti-hint">{def.hint}</div>}
                    {v.result === 'NOT_OK' && (
                      <input
                        type="text"
                        className="gecko-input gecko-input-sm gecko-pti-note"
                        placeholder="Defect detail"
                        value={v.notes ?? ''}
                        onChange={e => setItemNote(def.id, e.target.value)}
                        disabled={readonly}
                      />
                    )}
                  </div>
                  <div className="gecko-pti-actions">
                    <PTIResultPicker
                      value={v.result}
                      onChange={(r) => setResult(def.id, r)}
                      disabled={readonly}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="gecko-pti-notes">
            <label className="gecko-form-row gecko-form-row-full">
              <span>Overall notes</span>
              <textarea
                className="gecko-input"
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                disabled={readonly}
                placeholder="Summary, observations, recommended next step…"
              />
            </label>
            <label className="gecko-form-row gecko-form-row-full">
              <span>Failure reason</span>
              <input
                type="text"
                className="gecko-input gecko-input-sm"
                value={failureReason}
                onChange={e => setFailureReason(e.target.value)}
                disabled={readonly}
                placeholder={anyNotOK
                  ? 'Required — at least one step marked NOT_OK'
                  : 'Optional unless marking failed'}
              />
            </label>
          </div>
        </div>

        {!readonly && (
          <div className="gecko-drawer-footer">
            <button className="gecko-btn gecko-btn-ghost" onClick={onClose}>Save & close</button>
            <button
              className="gecko-btn gecko-btn-danger"
              onClick={() => submit('FAILED')}
              disabled={!failureReason.trim()}
              title={!failureReason.trim() ? 'Provide a failure reason' : ''}
            >
              Mark Failed
            </button>
            <button
              className="gecko-btn gecko-btn-success"
              onClick={() => submit('PASSED')}
              disabled={!allEvaluated || anyNotOK}
              title={
                !allEvaluated ? 'Evaluate every step before passing'
                : anyNotOK     ? 'Cannot pass with NOT_OK items'
                : ''}
            >
              Mark Passed
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

function PTIResultPicker({
  value, onChange, disabled,
}: {
  value: PTIItemResult;
  onChange: (r: PTIItemResult) => void;
  disabled?: boolean;
}) {
  return (
    <div className="gecko-pti-picker" role="radiogroup">
      {(['OK', 'NOT_OK', 'NA'] as const).map(opt => (
        <button
          key={opt}
          type="button"
          role="radio"
          aria-checked={value === opt}
          disabled={disabled}
          onClick={() => onChange(opt)}
          className={`gecko-pti-pick gecko-pti-pick-${opt.toLowerCase().replace('_', '-')}${value === opt ? ' gecko-pti-pick-active' : ''}`}
        >
          {opt === 'OK' ? 'OK' : opt === 'NOT_OK' ? 'Not OK' : 'N/A'}
        </button>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Drawer 3 — Pre-Cool detail
   ────────────────────────────────────────────────────────────────────────── */

function PreCoolDrawer({
  task, onClose, onComplete,
}: {
  task: PreCoolTask;
  onClose: () => void;
  onComplete: (id: string) => void;
}) {
  const tolerance = DEFAULT_REEFER_CONFIG.bandToleranceC[task.cargoBand];
  const delta = task.currentTempC !== null ? task.currentTempC - task.targetTempC : null;
  const onTarget = delta !== null && Math.abs(delta) <= tolerance;
  const progressPct = task.currentTempC !== null
    ? Math.max(0, Math.min(100, 100 - Math.abs(delta!) / Math.max(1, Math.abs(task.targetTempC - 30)) * 100))
    : 0;

  return (
    <>
      <div className="gecko-drawer-scrim" onClick={onClose} />
      <aside className="gecko-drawer" role="dialog" aria-label={`Pre-cool ${task.containerNo}`}>
        <div className="gecko-drawer-header">
          <div>
            <div className="gecko-drawer-title">Pre-Cool · {task.containerNo}</div>
            <div className="gecko-drawer-subtitle">
              Booking <span className="gecko-mono">{task.bookingNo}</span> · {task.liner} · {CARGO_BAND_LABEL[task.cargoBand]} band
            </div>
          </div>
          <button className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="gecko-drawer-body">
          <div className="gecko-reefer-precool-grid">
            <Stat label="Target temp"   value={fmtTemp(task.targetTempC)} />
            <Stat label="Current temp"  value={fmtTemp(task.currentTempC)} />
            <Stat label="Hours run"     value={task.hoursRun > 0 ? task.hoursRun.toFixed(1) + 'h' : '—'} />
            <Stat label="Plug"          value={task.plug ?? '—'} />
            <Stat label="Technician"    value={task.technician ?? '—'} />
            <Stat label="Source"        value={task.source === 'BOOKING' ? 'Auto (from booking)' : 'Manual'} />
          </div>

          <div className="gecko-reefer-progress">
            <div className="gecko-section-header-title">Cool-down progress</div>
            <div className="gecko-reefer-progress-bar">
              <div
                className="gecko-reefer-progress-fill"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="gecko-reefer-progress-foot">
              {delta !== null
                ? (
                  <>
                    {onTarget
                      ? <span className="gecko-badge gecko-badge-success">On target</span>
                      : <span className="gecko-badge gecko-badge-warning">{delta > 0 ? `+${delta.toFixed(1)}°C above` : `${delta.toFixed(1)}°C below`}</span>}
                    {' '}·{' '}
                    Tolerance ± {tolerance}°C
                  </>
                )
                : 'No readings yet'}
            </div>
          </div>
        </div>

        <div className="gecko-drawer-footer">
          <button className="gecko-btn gecko-btn-ghost" onClick={onClose}>Close</button>
          {task.status === 'IN_PROGRESS' && (
            <button
              className="gecko-btn gecko-btn-success"
              onClick={() => onComplete(task.id)}
              disabled={!onTarget}
              title={!onTarget ? 'Wait until reading is within tolerance' : ''}
            >
              Mark target reached
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="gecko-reefer-stat">
      <div className="gecko-reefer-stat-label">{label}</div>
      <div className="gecko-reefer-stat-value">{value}</div>
    </div>
  );
}
