/**
 * Reefer operations mock fixtures for Phase 1 demo.
 *
 * 20 reefer containers in mixed states across the three workflows:
 *   - 5 empties awaiting pre-cool
 *   - 4 PTI in various states (pending / in-progress / passed / failed)
 *   - 11 laden monitoring (with 2 in alarm)
 *
 * Designed to look "alive" — varied liners, target temps, plug locations,
 * tech assignments, realistic timestamps relative to current demo date.
 */

import type {
  ReeferContainer, PreCoolTask, PTITask, TempReading,
} from './reefer-types';
import { PTI_PROTOCOL_V1 } from './reefer-types';

// Anchor "now" to a stable demo timestamp so values render deterministically.
// In production, derive from server time.
const NOW = new Date('2026-05-18T09:18:00+07:00');
const hoursAgo = (h: number) =>
  new Date(NOW.getTime() - h * 3600 * 1000).toISOString();
const minsAgo = (m: number) =>
  new Date(NOW.getTime() - m * 60 * 1000).toISOString();

/* ──────────────────────────────────────────────────────────────────────────
   Unified reefer roster
   ────────────────────────────────────────────────────────────────────────── */

export const REEFER_ROSTER: ReeferContainer[] = [
  // Empties for pre-cool ──────────────────────────────────────────────────
  {
    containerNo: 'MAEU8842301', isoType: '42R1', size: '40', liner: 'MAERSK',
    bookingNo: 'MAEU240519883', status: 'EMPTY', block: 'RF-C1', position: 'C1-02-01',
    plug: 'C1-12', plugStatus: 'PLUGGED', setPointC: -18,
    cargoBand: 'FOOD',
    lastReadingAt: minsAgo(45), lastSupplyTempC: 4.2, lastReturnTempC: 5.1,
    lastHumidityPct: 78, alarm: null,
    remarks: 'Pre-cool in progress',
  },
  {
    containerNo: 'CRSU3398472', isoType: '42R1', size: '40', liner: 'COSCO',
    bookingNo: 'COSU240520771', status: 'EMPTY', block: 'RF-C1', position: 'C1-03-02',
    plug: 'C1-08', plugStatus: 'PLUGGED', setPointC: 2,
    cargoBand: 'PHARMA',
    lastReadingAt: minsAgo(15), lastSupplyTempC: 12.1, lastReturnTempC: 13.4,
    lastHumidityPct: 65, alarm: null,
  },
  {
    containerNo: 'CMAU8843901', isoType: '22R1', size: '20', liner: 'CMA',
    bookingNo: 'CMAU240518551', status: 'EMPTY', block: 'RF-C2', position: 'C2-01-01',
    plug: null, plugStatus: 'UNPLUGGED', setPointC: null,
    cargoBand: 'FOOD',
    lastReadingAt: null, lastSupplyTempC: null, lastReturnTempC: null,
    lastHumidityPct: null, alarm: null,
    remarks: 'Awaiting plug assignment',
  },
  {
    containerNo: 'TGHU9981233', isoType: '45R1', size: '45', liner: 'EVERGREEN',
    bookingNo: 'EGLV149612498744', status: 'EMPTY', block: 'RF-D1', position: 'D1-04-02',
    plug: 'D1-22', plugStatus: 'PLUGGED', setPointC: -25,
    cargoBand: 'PHARMA',
    lastReadingAt: minsAgo(8), lastSupplyTempC: -22.8, lastReturnTempC: -21.4,
    lastHumidityPct: 55, alarm: null,
  },
  {
    containerNo: 'ONEU2113381', isoType: '42R1', size: '40', liner: 'ONE',
    bookingNo: 'ONEYBKKLCH9982', status: 'EMPTY', block: 'RF-C2', position: 'C2-02-03',
    plug: 'C2-15', plugStatus: 'PLUGGED', setPointC: -18,
    cargoBand: 'FOOD',
    lastReadingAt: minsAgo(3), lastSupplyTempC: -18.2, lastReturnTempC: -17.4,
    lastHumidityPct: 62, alarm: null,
  },

  // PTI candidates ───────────────────────────────────────────────────────
  {
    containerNo: 'MSKU7234561', isoType: '42R1', size: '40', liner: 'MAERSK',
    status: 'EMPTY', block: 'RF-C1', position: 'C1-01-01',
    plug: 'C1-01', plugStatus: 'PLUGGED', setPointC: 0,
    cargoBand: null,
    lastReadingAt: minsAgo(60), lastSupplyTempC: 0.4, lastReturnTempC: 1.1,
    lastHumidityPct: 70, alarm: null,
    remarks: 'PTI required before next stuffing',
  },
  {
    containerNo: 'HMMU4471992', isoType: '22R1', size: '20', liner: 'HMM',
    status: 'EMPTY', block: 'RF-C2', position: 'C2-03-01',
    plug: 'C2-21', plugStatus: 'PLUGGED', setPointC: 0,
    cargoBand: null,
    lastReadingAt: minsAgo(120), lastSupplyTempC: 0.8, lastReturnTempC: 1.6,
    lastHumidityPct: 68, alarm: null,
    remarks: 'PTI in progress',
  },
  {
    containerNo: 'WHLU5566108', isoType: '42R1', size: '40', liner: 'WAN HAI',
    status: 'EMPTY', block: 'RF-D1', position: 'D1-02-01',
    plug: 'D1-09', plugStatus: 'PLUGGED', setPointC: -10,
    cargoBand: null,
    lastReadingAt: hoursAgo(2), lastSupplyTempC: -10.1, lastReturnTempC: -9.4,
    lastHumidityPct: 60, alarm: null,
    remarks: 'PTI passed earlier today',
  },
  {
    containerNo: 'YMLU8014228', isoType: '42R1', size: '40', liner: 'YANG MING',
    status: 'EMPTY', block: 'RF-D1', position: 'D1-05-01',
    plug: 'D1-31', plugStatus: 'FAULT', setPointC: null,
    cargoBand: null,
    lastReadingAt: hoursAgo(3), lastSupplyTempC: null, lastReturnTempC: null,
    lastHumidityPct: null, alarm: 'UNIT_FAULT',
    remarks: 'PTI failed — compressor fault',
  },

  // Laden import monitoring ───────────────────────────────────────────────
  {
    containerNo: 'CMAU9213381', isoType: '42R1', size: '40', liner: 'CMA',
    bookingNo: 'CMAU240514998', status: 'LADEN_IMPORT', block: 'RF-C1', position: 'C1-04-01',
    plug: 'C1-18', plugStatus: 'PLUGGED', setPointC: -22,
    cargoBand: 'FOOD',
    lastReadingAt: hoursAgo(2.1), lastSupplyTempC: -21.6, lastReturnTempC: -20.4,
    lastHumidityPct: 64, alarm: null,
  },
  {
    containerNo: 'OOLU8821443', isoType: '42R1', size: '40', liner: 'OOCL',
    bookingNo: 'OOLU2405093388', status: 'LADEN_IMPORT', block: 'RF-C1', position: 'C1-05-01',
    plug: 'C1-19', plugStatus: 'PLUGGED', setPointC: 2,
    cargoBand: 'PHARMA',
    lastReadingAt: hoursAgo(3.6), lastSupplyTempC: 2.9, lastReturnTempC: 3.4,
    lastHumidityPct: 58, alarm: 'DEVIATION',  // 0.9 over band (0.5)
  },
  {
    containerNo: 'COSU1126708', isoType: '42R1', size: '40', liner: 'COSCO',
    bookingNo: 'COSU240515882', status: 'LADEN_IMPORT', block: 'RF-C1', position: 'C1-06-01',
    plug: 'C1-20', plugStatus: 'PLUGGED', setPointC: -18,
    cargoBand: 'FOOD',
    lastReadingAt: hoursAgo(3.8), lastSupplyTempC: -17.4, lastReturnTempC: -16.8,
    lastHumidityPct: 67, alarm: null,
  },
  {
    containerNo: 'MAEU3322104', isoType: '22R1', size: '20', liner: 'MAERSK',
    bookingNo: 'MAEU240517229', status: 'LADEN_IMPORT', block: 'RF-C2', position: 'C2-04-01',
    plug: 'C2-08', plugStatus: 'PLUGGED', setPointC: -25,
    cargoBand: 'FOOD',
    lastReadingAt: hoursAgo(1.2), lastSupplyTempC: -24.8, lastReturnTempC: -23.6,
    lastHumidityPct: 70, alarm: null,
  },
  {
    containerNo: 'ONEU5582147', isoType: '42R1', size: '40', liner: 'ONE',
    bookingNo: 'ONEYBKKLCH8841', status: 'LADEN_IMPORT', block: 'RF-C2', position: 'C2-05-02',
    plug: 'C2-09', plugStatus: 'PLUGGED', setPointC: 4,
    cargoBand: 'FOOD',
    lastReadingAt: hoursAgo(5.1), lastSupplyTempC: 4.3, lastReturnTempC: 5.0,
    lastHumidityPct: 72, alarm: 'NO_READING',
  },
  {
    containerNo: 'EGHU2104774', isoType: '45R1', size: '45', liner: 'EVERGREEN',
    bookingNo: 'EGLV149611228871', status: 'LADEN_IMPORT', block: 'RF-D1', position: 'D1-06-01',
    plug: 'D1-15', plugStatus: 'PLUGGED', setPointC: -20,
    cargoBand: 'FOOD',
    lastReadingAt: hoursAgo(2.0), lastSupplyTempC: -19.7, lastReturnTempC: -18.9,
    lastHumidityPct: 68, alarm: null,
  },

  // Laden export monitoring ───────────────────────────────────────────────
  {
    containerNo: 'CMAU7733821', isoType: '42R1', size: '40', liner: 'CMA',
    bookingNo: 'CMAU240519886', status: 'LADEN_EXPORT', block: 'RF-D1', position: 'D1-07-01',
    plug: 'D1-25', plugStatus: 'PLUGGED', setPointC: -18,
    cargoBand: 'FOOD',
    lastReadingAt: hoursAgo(1.5), lastSupplyTempC: -17.9, lastReturnTempC: -17.2,
    lastHumidityPct: 66, alarm: null,
  },
  {
    containerNo: 'TGHU6622038', isoType: '42R1', size: '40', liner: 'EVERGREEN',
    bookingNo: 'EGLV149612498744', status: 'LADEN_EXPORT', block: 'RF-D1', position: 'D1-08-02',
    plug: 'D1-26', plugStatus: 'PLUGGED', setPointC: 4,
    cargoBand: 'FOOD',
    lastReadingAt: hoursAgo(2.3), lastSupplyTempC: 4.1, lastReturnTempC: 4.8,
    lastHumidityPct: 64, alarm: null,
  },
  {
    containerNo: 'MSKU9974458', isoType: '22R1', size: '20', liner: 'MAERSK',
    bookingNo: 'MAEU240519999', status: 'LADEN_EXPORT', block: 'RF-C1', position: 'C1-07-01',
    plug: 'C1-27', plugStatus: 'PLUGGED', setPointC: 2,
    cargoBand: 'PHARMA',
    lastReadingAt: minsAgo(75), lastSupplyTempC: 2.3, lastReturnTempC: 2.9,
    lastHumidityPct: 59, alarm: null,
  },
  {
    containerNo: 'HLBU4488771', isoType: '42R1', size: '40', liner: 'HAPAG-LLOYD',
    bookingNo: 'HLCUBKK241001', status: 'LADEN_EXPORT', block: 'RF-D1', position: 'D1-09-01',
    plug: 'D1-28', plugStatus: 'PLUGGED', setPointC: -25,
    cargoBand: 'FOOD',
    lastReadingAt: hoursAgo(1.9), lastSupplyTempC: -24.6, lastReturnTempC: -23.8,
    lastHumidityPct: 71, alarm: null,
  },
  {
    containerNo: 'WHSU3320198', isoType: '42R1', size: '40', liner: 'WAN HAI',
    bookingNo: 'WHLH2405117701', status: 'LADEN_EXPORT', block: 'RF-C2', position: 'C2-06-02',
    plug: 'C2-30', plugStatus: 'PLUGGED', setPointC: -18,
    cargoBand: 'FOOD',
    lastReadingAt: hoursAgo(2.8), lastSupplyTempC: -17.8, lastReturnTempC: -17.0,
    lastHumidityPct: 67, alarm: null,
  },
];

/* ──────────────────────────────────────────────────────────────────────────
   Pre-Cool tasks (5)
   ────────────────────────────────────────────────────────────────────────── */

export const PRE_COOL_TASKS: PreCoolTask[] = [
  {
    id: 'pc-001', containerNo: 'MAEU8842301', bookingNo: 'MAEU240519883', liner: 'MAERSK',
    cargoBand: 'FOOD', targetTempC: -18, status: 'IN_PROGRESS', plug: 'C1-12',
    startedAt: hoursAgo(3.5), completedAt: null, hoursRun: 3.5, currentTempC: 4.2,
    technician: 'Somchai K.', source: 'BOOKING',
  },
  {
    id: 'pc-002', containerNo: 'CRSU3398472', bookingNo: 'COSU240520771', liner: 'COSCO',
    cargoBand: 'PHARMA', targetTempC: 2, status: 'IN_PROGRESS', plug: 'C1-08',
    startedAt: hoursAgo(1.2), completedAt: null, hoursRun: 1.2, currentTempC: 12.1,
    technician: 'Anan P.', source: 'BOOKING',
  },
  {
    id: 'pc-003', containerNo: 'CMAU8843901', bookingNo: 'CMAU240518551', liner: 'CMA',
    cargoBand: 'FOOD', targetTempC: -18, status: 'REQUESTED', plug: null,
    startedAt: null, completedAt: null, hoursRun: 0, currentTempC: null,
    technician: null, source: 'BOOKING',
  },
  {
    id: 'pc-004', containerNo: 'TGHU9981233', bookingNo: 'EGLV149612498744', liner: 'EVERGREEN',
    cargoBand: 'PHARMA', targetTempC: -25, status: 'COMPLETED', plug: 'D1-22',
    startedAt: hoursAgo(7.0), completedAt: hoursAgo(0.5), hoursRun: 6.5, currentTempC: -22.8,
    technician: 'Prawit S.', source: 'BOOKING',
  },
  {
    id: 'pc-005', containerNo: 'ONEU2113381', bookingNo: 'ONEYBKKLCH9982', liner: 'ONE',
    cargoBand: 'FOOD', targetTempC: -18, status: 'COMPLETED', plug: 'C2-15',
    startedAt: hoursAgo(8.2), completedAt: hoursAgo(1.8), hoursRun: 6.4, currentTempC: -18.2,
    technician: 'Niran T.', source: 'BOOKING',
  },
];

/* ──────────────────────────────────────────────────────────────────────────
   PTI tasks (4 — one in each state)
   ────────────────────────────────────────────────────────────────────────── */

function ptiItems(results: Record<string, 'OK' | 'NOT_OK' | 'NA'>) {
  const out: Record<string, { result: 'OK' | 'NOT_OK' | 'NA' | null; notes?: string }> = {};
  for (const item of PTI_PROTOCOL_V1) {
    out[item.id] = { result: results[item.id] ?? null };
  }
  return out;
}

export const PTI_TASKS: PTITask[] = [
  {
    id: 'pti-001', containerNo: 'MSKU7234561', liner: 'MAERSK',
    protocolVersion: 'V1', status: 'PENDING', technician: null,
    startedAt: null, completedAt: null,
    items: ptiItems({}),
  },
  {
    id: 'pti-002', containerNo: 'HMMU4471992', liner: 'HMM',
    protocolVersion: 'V1', status: 'IN_PROGRESS',
    technician: 'Somchai K.', startedAt: hoursAgo(0.8), completedAt: null,
    items: ptiItems({
      ext: 'OK', int: 'OK', seal: 'OK', drain: 'OK', plug: 'OK', disp: 'OK',
      setpt: 'OK',
    }),
  },
  {
    id: 'pti-003', containerNo: 'WHLU5566108', liner: 'WAN HAI',
    protocolVersion: 'V1', status: 'PASSED',
    technician: 'Prawit S.', startedAt: hoursAgo(5), completedAt: hoursAgo(3.5),
    items: ptiItems({
      ext: 'OK', int: 'OK', seal: 'OK', drain: 'OK', plug: 'OK', disp: 'OK',
      setpt: 'OK', comp: 'OK', fan: 'OK', def: 'OK', sens: 'OK', alarm: 'OK',
    }),
    overallNotes: 'All checks passed cleanly. Cool-down rate excellent.',
  },
  {
    id: 'pti-004', containerNo: 'YMLU8014228', liner: 'YANG MING',
    protocolVersion: 'V1', status: 'FAILED',
    technician: 'Niran T.', startedAt: hoursAgo(2), completedAt: hoursAgo(1),
    items: ptiItems({
      ext: 'OK', int: 'OK', seal: 'OK', drain: 'OK', plug: 'OK', disp: 'OK',
      setpt: 'OK', comp: 'NOT_OK',
    }),
    failureReason: 'Compressor failed to maintain cool-down rate. Suspect refrigerant leak. Quarantined for M&R.',
  },
];

/* ──────────────────────────────────────────────────────────────────────────
   Temperature reading log (sampling — last 24h for monitored laden reefers)
   ────────────────────────────────────────────────────────────────────────── */

export const TEMP_READINGS: TempReading[] = [
  // CMAU9213381 — recent readings, all in band
  { id: 'tr-001', containerNo: 'CMAU9213381', recordedAt: hoursAgo(2.1),
    recordedBy: 'Anan P.', setPointC: -22, supplyTempC: -21.6, returnTempC: -20.4,
    humidityPct: 64, plugStatus: 'PLUGGED', inBand: true },
  { id: 'tr-002', containerNo: 'CMAU9213381', recordedAt: hoursAgo(6.2),
    recordedBy: 'Somchai K.', setPointC: -22, supplyTempC: -21.9, returnTempC: -20.7,
    humidityPct: 63, plugStatus: 'PLUGGED', inBand: true },
  { id: 'tr-003', containerNo: 'CMAU9213381', recordedAt: hoursAgo(10.3),
    recordedBy: 'Niran T.', setPointC: -22, supplyTempC: -22.1, returnTempC: -20.9,
    humidityPct: 64, plugStatus: 'PLUGGED', inBand: true },

  // OOLU8821443 — drift in latest reading (DEVIATION alarm)
  { id: 'tr-010', containerNo: 'OOLU8821443', recordedAt: hoursAgo(3.6),
    recordedBy: 'Prawit S.', setPointC: 2, supplyTempC: 2.9, returnTempC: 3.4,
    humidityPct: 58, plugStatus: 'PLUGGED', inBand: false,
    remarks: 'Reading 0.9°C above set-point — pharma band is ±0.5°C.' },
  { id: 'tr-011', containerNo: 'OOLU8821443', recordedAt: hoursAgo(7.8),
    recordedBy: 'Anan P.', setPointC: 2, supplyTempC: 2.2, returnTempC: 2.7,
    humidityPct: 58, plugStatus: 'PLUGGED', inBand: true },

  // ONEU5582147 — overdue reading (NO_READING alarm)
  { id: 'tr-020', containerNo: 'ONEU5582147', recordedAt: hoursAgo(5.1),
    recordedBy: 'Niran T.', setPointC: 4, supplyTempC: 4.3, returnTempC: 5.0,
    humidityPct: 72, plugStatus: 'PLUGGED', inBand: true },

  // MAEU3322104
  { id: 'tr-030', containerNo: 'MAEU3322104', recordedAt: hoursAgo(1.2),
    recordedBy: 'Somchai K.', setPointC: -25, supplyTempC: -24.8, returnTempC: -23.6,
    humidityPct: 70, plugStatus: 'PLUGGED', inBand: true },

  // CMAU7733821 (laden export)
  { id: 'tr-040', containerNo: 'CMAU7733821', recordedAt: hoursAgo(1.5),
    recordedBy: 'Prawit S.', setPointC: -18, supplyTempC: -17.9, returnTempC: -17.2,
    humidityPct: 66, plugStatus: 'PLUGGED', inBand: true },
];

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────────────── */

export function getReadingsFor(containerNo: string): TempReading[] {
  return TEMP_READINGS
    .filter(r => r.containerNo === containerNo)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}

export function countByStatus<T extends { status: string }>(arr: T[]): Record<string, number> {
  return arr.reduce<Record<string, number>>((acc, x) => {
    acc[x.status] = (acc[x.status] ?? 0) + 1;
    return acc;
  }, {});
}

/** Yard reefer plug census. Used by KPI strip. */
export function plugCensus(): { used: number; capacity: number; faulted: number } {
  const used     = REEFER_ROSTER.filter(r => r.plugStatus === 'PLUGGED').length;
  const faulted  = REEFER_ROSTER.filter(r => r.plugStatus === 'FAULT').length;
  // Demo capacity figure mirrored from /dashboard/yard-glance.
  return { used, capacity: 56, faulted };
}
