"use client";
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { DateField } from '@/components/ui/DateField';
import { useFacility } from '@/lib/api/facility';
import { formatDateTime } from '@/lib/format';
import { useYardSettings } from '@/lib/api/yard-map';
import { MACHINE_KINDS, reshuffleRate, useYardKpis, type YardKpiBlock } from '@/lib/api/yard-work';
import { TYPE_STYLE, UNTYPED_STYLE, typeLabel } from '@/components/yard/block-style';
import { YardMapOff } from '@/components/yard/YardMapOff';
import type { BlockType } from '@/lib/api/yard-map';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

/**
 * YARD KPIs — is the yard being worked well, and which block is the problem?
 *
 * Two kinds of figure, and the screen keeps them apart because they answer
 * different questions:
 *
 *   NOW        boxes, usable slots, occupancy and dwell. True at this instant,
 *              whatever period is chosen.
 *   OVER A PERIOD  gate-ins, yard moves (and per hour), jobs done and how long
 *              they took, digs, and how often the stacking rules were
 *              overridden. The default is the last seven days.
 *
 * THE RESHUFFLE RATE is the number to watch: digs ÷ pulls done. It says how
 * often collecting a box meant moving another one first — which is the cost of
 * yesterday's stowing decisions, paid today, by the forklift. A yard stacked by
 * line and size digs rarely; one stacked wherever there was room digs all day.
 *
 * Everything here is the server's count. Clicking a block opens its stack view
 * on Yard at a Glance, because the next question after "which block" is always
 * "what is in it".
 */

type Period = 'TODAY' | '7D' | '30D' | 'CUSTOM';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'TODAY', label: 'Today' },
  { id: '7D', label: '7 days' },
  { id: '30D', label: '30 days' },
  { id: 'CUSTOM', label: 'Custom' },
];

/** Midnight this morning, in the depot's own day — not 24 hours ago. */
function startOfDay(daysAgo = 0): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

type SortKey = 'blockCode' | 'boxes' | 'occupancyPct' | 'averageDays' | 'gateIns' | 'shiftsIn' | 'shiftsOut' | 'putAways';

export default function YardKpisPage() {
  const { branch, yards, yard: headerYard } = useFacility();
  const { mapEnabled, loading: settingsLoading, denied } = useYardSettings();

  const [picked, setPicked] = useState<string | null>(null);
  const [pickedOwner, setPickedOwner] = useState<string | null>(branch?.branchId ?? null);
  const branchId = branch?.branchId ?? null;
  if (branchId !== pickedOwner) { setPickedOwner(branchId); setPicked(null); }
  const yardId = (picked && yards.some(y => y.yardId === picked) ? picked : null)
    ?? headerYard?.yardId ?? yards[0]?.yardId ?? null;

  const [period, setPeriod] = useState<Period>('7D');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'occupancyPct', desc: true });

  /** What the period means as two instants, or nothing for the API's default. */
  const range = useMemo(() => {
    switch (period) {
      case 'TODAY': return { from: startOfDay(0), to: null };
      case '7D': return { from: startOfDay(6), to: null };
      case '30D': return { from: startOfDay(29), to: null };
      case 'CUSTOM': return {
        from: fromDate ? new Date(`${fromDate}T00:00`).toISOString() : null,
        // To the END of the chosen day: a period that stops at midnight leaves
        // the last day's work out of its own report.
        to: toDate ? new Date(`${toDate}T23:59:59`).toISOString() : null,
      };
    }
  }, [period, fromDate, toDate]);

  const kpis = useYardKpis(mapEnabled ? yardId : null, range.from, range.to);
  const data = kpis.data?.yardId === yardId ? kpis.data : null;

  const blocks = useMemo(() => {
    const rows = [...(data?.blocks ?? [])];
    const { key, desc } = sort;
    rows.sort((a, b) => {
      const av = a[key] ?? -1;
      const bv = b[key] ?? -1;
      const cmp = typeof av === 'string' || typeof bv === 'string'
        ? String(av).localeCompare(String(bv))
        : (av as number) - (bv as number);
      return desc ? -cmp : cmp;
    });
    return rows;
  }, [data, sort]);

  if (settingsLoading) {
    return <div className="gecko-empty-card gecko-yard-loading">Checking what this depot records…</div>;
  }
  if (!mapEnabled) return <YardMapOff where={branch?.displayName} denied={denied} />;
  if (yards.length === 0) {
    return <EmptyState icon="layers" title="This depot has no yards yet"
      description="Master Data → Yards lists the depot’s yards." />;
  }

  const reshuffle = data ? reshuffleRate(data) : null;
  const pulls = data?.jobs.find(j => j.jobType === 'PULL')?.done ?? 0;
  const unplaced = data ? data.boxesInYard - data.boxesInBlocks : 0;

  return (
    <div className="gecko-stack gecko-stack-lg gecko-kpis">
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <h1 className="gecko-page-title">Yard KPIs</h1>
          <p className="gecko-page-subtitle">
            {data
              ? <>{data.yardCode} · {formatDateTime(data.from)} to {formatDateTime(data.to)}</>
              : 'Pick a yard and a period.'}
          </p>
        </div>
        <div className="gecko-toolbar">
          {yards.length > 1 && (
            <select className="gecko-input gecko-input-sm gecko-yard-select" value={yardId ?? ''} aria-label="Yard"
              onChange={e => setPicked(e.target.value)}>
              {yards.map(y => <option key={y.yardId} value={y.yardId}>{y.yardCode} · {y.nameEn}</option>)}
            </select>
          )}
          <div className="gecko-segctrl">
            {PERIODS.map(p => (
              <button key={p.id} className={`gecko-segctrl-btn${period === p.id ? ' gecko-segctrl-btn-active' : ''}`}
                onClick={() => setPeriod(p.id)}>{p.label}</button>
            ))}
          </div>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => kpis.reload()}>
            <Icon name="refresh" size={14} /> Refresh
          </button>
        </div>
      </div>

      {period === 'CUSTOM' && (
        <div className="gecko-row gecko-row-wrap gecko-kpis-dates">
          <div className="gecko-field">
            <label className="gecko-field-label">From</label>
            <DateField size="sm" value={fromDate} onChange={setFromDate} aria-label="From" />
          </div>
          <div className="gecko-field">
            <label className="gecko-field-label">To</label>
            <DateField size="sm" value={toDate} onChange={setToDate} aria-label="To" />
          </div>
          <div className="gecko-cell-meta gecko-kpis-dates-note">
            Leave either empty for the API&apos;s own window (the last seven days).
          </div>
        </div>
      )}

      <ErrorBanner error={kpis.error} className="gecko-yard-alert" />

      {!kpis.error && !data && <div className="gecko-empty-card gecko-yard-loading">Counting…</div>}

      {data && (
        <>
          <div className="gecko-yard-kpis">
            <Tile icon="layers" tone="primary" label="Occupancy"
              value={data.occupancyPct === null ? '—' : `${data.occupancyPct}%`}
              sub={`${data.boxesInBlocks} boxes in ${data.usableSlots} slots`} />
            <Tile icon="mapPin" tone={unplaced > 0 ? 'warning' : 'neutral'} label="Not in a slot"
              value={unplaced.toLocaleString()} sub={`of ${data.boxesInYard} in the yard`} />
            <Tile icon="truck" tone="info" label="Gate-ins" value={data.gateIns.toLocaleString()} sub="in the period" />
            <Tile icon="transferH" tone="info" label="Yard moves"
              value={data.shifts.toLocaleString()} sub={`${data.movesPerHour} per hour`} />
            <Tile icon="refresh" tone={reshuffle !== null && reshuffle > 50 ? 'danger' : reshuffle !== null && reshuffle > 20 ? 'warning' : 'success'}
              label="Reshuffle rate"
              value={reshuffle === null ? '—' : `${reshuffle}%`}
              sub={pulls === 0 ? 'nothing pulled yet' : `${data.digs} digs for ${pulls} pulls`} />
            <Tile icon="shieldCheck" tone={data.ruleOverrides > 0 ? 'warning' : 'neutral'} label="Rule overrides"
              value={data.ruleOverrides.toLocaleString()} sub="slots taken against the rules" />
          </div>

          <div className="gecko-kpis-split">
            <div className="gecko-table-card">
              <div className="gecko-row gecko-yard-glance-head">
                <div className="gecko-flex-1">
                  <div className="gecko-section-header-title">Work done</div>
                  <div className="gecko-section-header-subtitle">
                    Average is from the moment the job was ordered to the moment it was finished.
                  </div>
                </div>
              </div>
              {data.jobs.length === 0
                ? <div className="gecko-cell-meta gecko-checks-none">No job was finished in the period.</div>
                : (
                  <table className="gecko-table gecko-table-compact">
                    <thead><tr><th>Job</th><th className="gecko-cell-right">Done</th><th className="gecko-cell-right">Average</th></tr></thead>
                    <tbody>
                      {data.jobs.map(j => (
                        <tr key={j.jobType}>
                          <td>{j.jobType === 'PUT_AWAY' ? 'Put away' : j.jobType === 'PULL' ? 'Pull' : 'Relocate'}</td>
                          <td className="gecko-num-tabular">{j.done}</td>
                          <td className="gecko-num-tabular">{j.averageMinutes} min</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
            </div>

            <div className="gecko-table-card">
              <div className="gecko-row gecko-yard-glance-head">
                <div className="gecko-flex-1">
                  <div className="gecko-section-header-title">Machines</div>
                  <div className="gecko-section-header-subtitle">
                    Jobs each machine finished, how long it took from taking one, and how many an hour it worked at.
                  </div>
                </div>
              </div>
              {(data.machines ?? []).length === 0
                ? <div className="gecko-cell-meta gecko-checks-none">
                    No job in the period named a machine. A driver picks theirs on Yard Jobs.
                  </div>
                : (
                  <table className="gecko-table gecko-table-compact">
                    <thead>
                      <tr>
                        <th>Machine</th><th>Kind</th>
                        <th className="gecko-cell-right">Jobs</th>
                        <th className="gecko-cell-right">Average</th>
                        <th className="gecko-cell-right">Per hour</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.machines ?? []).map(m => (
                        <tr key={m.equipmentCode}>
                          <td className="gecko-text-mono">{m.equipmentCode}</td>
                          <td>{MACHINE_KINDS.find(k => k.value === m.kind)?.label ?? m.kind}</td>
                          <td className="gecko-num-tabular">{m.done}</td>
                          <td className="gecko-num-tabular">{m.averageMinutes} min</td>
                          <td className="gecko-num-tabular">
                            {m.jobsPerHour === null ? <span className="gecko-cell-meta">—</span> : m.jobsPerHour}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
            </div>

            <div className="gecko-table-card">
              <div className="gecko-row gecko-yard-glance-head">
                <div className="gecko-flex-1">
                  <div className="gecko-section-header-title">The yard now</div>
                  <div className="gecko-section-header-subtitle">Whatever period is chosen, these are this instant.</div>
                </div>
              </div>
              <table className="gecko-table gecko-table-compact">
                <tbody>
                  <tr><td>Boxes in the yard</td><td className="gecko-num-tabular">{data.boxesInYard}</td></tr>
                  <tr><td>Standing in a slot</td><td className="gecko-num-tabular">{data.boxesInBlocks}</td></tr>
                  <tr><td>Usable slots</td><td className="gecko-num-tabular">{data.usableSlots}</td></tr>
                  <tr><td>Digs in the period</td><td className="gecko-num-tabular">{data.digs}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="gecko-table-card">
            <div className="gecko-row gecko-yard-glance-head">
              <div className="gecko-flex-1">
                <div className="gecko-section-header-title">Block by block</div>
                <div className="gecko-section-header-subtitle">
                  {data.blocks.length} blocks · click a heading to sort, a row to see the stacks
                </div>
              </div>
            </div>
            <div className="gecko-yard-table-scroll">
              <table className="gecko-table gecko-table-compact gecko-kpis-blocks">
                <thead>
                  <tr>
                    <Head label="Block" k="blockCode" sort={sort} setSort={setSort} />
                    <th>Type</th>
                    <Head label="Boxes" k="boxes" sort={sort} setSort={setSort} right />
                    <Head label="Occupancy" k="occupancyPct" sort={sort} setSort={setSort} />
                    <Head label="Avg dwell" k="averageDays" sort={sort} setSort={setSort} right />
                    <Head label="Gate-ins" k="gateIns" sort={sort} setSort={setSort} right />
                    <Head label="Moves in" k="shiftsIn" sort={sort} setSort={setSort} right />
                    <Head label="Moves out" k="shiftsOut" sort={sort} setSort={setSort} right />
                    <Head label="Put-aways" k="putAways" sort={sort} setSort={setSort} right />
                  </tr>
                </thead>
                <tbody>
                  {blocks.map(b => <BlockRow key={b.yardBlockId} block={b} yardId={data.yardId} />)}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Head({ label, k, sort, setSort, right }: {
  label: string; k: SortKey; right?: boolean;
  sort: { key: SortKey; desc: boolean };
  setSort: (s: { key: SortKey; desc: boolean }) => void;
}) {
  const on = sort.key === k;
  return (
    <th className={right ? 'gecko-cell-right' : undefined}>
      <button type="button" className="gecko-kpis-sort"
        onClick={() => setSort({ key: k, desc: on ? !sort.desc : true })}>
        {label}{on && <Icon name={sort.desc ? 'arrowDown' : 'arrowUp'} size={11} />}
      </button>
    </th>
  );
}

function BlockRow({ block, yardId }: { block: YardKpiBlock; yardId: string }) {
  const style = block.blockType ? TYPE_STYLE[block.blockType as BlockType] ?? UNTYPED_STYLE : UNTYPED_STYLE;
  const pct = block.occupancyPct;
  return (
    <tr>
      <td>
        {/* The next question after "which block" is "what is in it", and that
            is the stack view on Yard at a Glance. */}
        <Link href={`/dashboard/yard-glance?yard=${encodeURIComponent(yardId)}&block=${encodeURIComponent(block.yardBlockId)}`}
          className="gecko-text-mono gecko-yard-hot-code" style={{ color: style.stroke }}>
          {block.blockCode}
        </Link>
      </td>
      <td>
        <span className="gecko-pill gecko-yard-type-pill"
          style={{ background: style.fill, color: style.stroke, borderColor: `${style.stroke}40` }}>
          {typeLabel(block.blockType as BlockType | null)}
        </span>
      </td>
      <td className="gecko-num-tabular">
        {block.boxes}<span className="gecko-cell-meta"> / {block.usableSlots}</span>
      </td>
      <td>
        {pct === null
          ? <span className="gecko-cell-meta">no slots</span>
          : (
            <div className="gecko-row gecko-yard-bar-row">
              <div className="gecko-progress gecko-progress-sm gecko-yard-bar">
                <div className="gecko-progress-bar gecko-yard-bar-fill"
                  style={{ width: `${Math.min(100, pct)}%`, background: pct >= 85 ? 'var(--gecko-error-500)' : pct >= 60 ? 'var(--gecko-warning-500)' : 'var(--gecko-success-500)' }} />
              </div>
              <span className="gecko-num-tabular gecko-yard-bar-value">{Math.round(pct)}%</span>
            </div>
          )}
      </td>
      <td className="gecko-num-tabular">{block.averageDays}d</td>
      <td className="gecko-num-tabular">{block.gateIns}</td>
      <td className="gecko-num-tabular">{block.shiftsIn}</td>
      <td className="gecko-num-tabular">{block.shiftsOut}</td>
      <td className="gecko-num-tabular">{block.putAways}</td>
    </tr>
  );
}

function Tile({ icon, tone, label, value, sub }: {
  icon: string; tone: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  label: string; value: string | number; sub: string;
}) {
  /**
   * STACKED, the same way Yard at a glance does it (owner, 2026-11-02).
   *
   * Six tiles across the page leave each one about 180px, and a row of icon,
   * figure, name and note inside that width tore the note into a column two
   * words wide: "15 boxe / in 1042 / slot". The name is the tile's heading
   * now, the figure sits under it with its icon, and the note runs along the
   * bottom with the whole width to say itself in.
   */
  return (
    <div className="gecko-kpi-tile gecko-kpi-tile-stacked">
      <div className="gecko-eyebrow gecko-kpi-tile-head">{label}</div>
      <div className="gecko-kpi-tile-main">
        <div className={`gecko-kpi-tile-icon gecko-kpi-tile-icon-${tone}`}><Icon name={icon} size={16} /></div>
        <div className="gecko-kpi-tile-value">{value}</div>
      </div>
      <div className="gecko-cell-sub gecko-kpi-tile-foot">{sub}</div>
    </div>
  );
}
