/**
 * Reefer operations domain types.
 *
 * Three workflows over one roster:
 *   - Pre-Cool — empties awaiting cooling before export stuffing
 *   - PTI      — Pre-Trip Inspection (12-step generic protocol; per-liner branches in Phase 2)
 *   - Monitor  — laden reefers on yard; periodic temperature readings
 */

export type ReeferStatus = 'EMPTY' | 'LADEN_IMPORT' | 'LADEN_EXPORT';
export type PlugStatus = 'PLUGGED' | 'UNPLUGGED' | 'FAULT';

/** Cargo tolerance band — drives alarm thresholds. Set on the booking. */
export type CargoBand = 'PHARMA' | 'FOOD' | 'NON_CRITICAL';

/** Default deviation tolerance, in °C, for each band. Configurable in System Parameters. */
export const BAND_TOLERANCE_C: Record<CargoBand, number> = {
  PHARMA: 0.5,
  FOOD: 2.0,
  NON_CRITICAL: 5.0,
};

export type AlarmReason =
  | 'DEVIATION'        // supply temp drifted outside band > min duration
  | 'NO_READING'       // overdue reading (> cadence + grace)
  | 'PLUG_DISCONNECTED'
  | 'UNIT_FAULT';

export interface ReeferContainer {
  containerNo: string;
  isoType: string;          // 22R1, 42R1, 45R1, 22R9 etc
  size: '20' | '40' | '45';
  liner: string;
  bookingNo?: string;       // populated for laden export / pre-cool-from-booking
  status: ReeferStatus;
  block: string;            // RF-C1, RF-C2, RF-D1, etc
  position: string;         // C1-04-03 (block-row-col)
  plug: string | null;      // plug ID, null if not plugged
  plugStatus: PlugStatus;
  setPointC: number | null;
  cargoBand: CargoBand | null;  // null for empties
  lastReadingAt: string | null; // ISO timestamp
  lastSupplyTempC: number | null;
  lastReturnTempC: number | null;
  lastHumidityPct: number | null;
  alarm: AlarmReason | null;
  remarks?: string;
}

/* ──────────────────────────────────────────────────────────────────────────
   Pre-Cool task — auto-created from booking when reefer is assigned to an
   export stuffing; manual override allowed.
   ────────────────────────────────────────────────────────────────────────── */

export type PreCoolStatus = 'REQUESTED' | 'IN_PROGRESS' | 'COMPLETED' | 'ABORTED';

export interface PreCoolTask {
  id: string;
  containerNo: string;
  bookingNo: string;
  liner: string;
  cargoBand: CargoBand;
  targetTempC: number;       // from booking, ° C
  status: PreCoolStatus;
  plug: string | null;
  startedAt: string | null;  // ISO
  completedAt: string | null;
  hoursRun: number;          // computed from startedAt
  currentTempC: number | null;
  technician: string | null;
  source: 'BOOKING' | 'MANUAL';
  remarks?: string;
}

/* ──────────────────────────────────────────────────────────────────────────
   PTI — Pre-Trip Inspection, generic 12-step protocol v1.
   ────────────────────────────────────────────────────────────────────────── */

export type PTIStatus = 'PENDING' | 'IN_PROGRESS' | 'PASSED' | 'FAILED';
export type PTIItemResult = 'OK' | 'NOT_OK' | 'NA' | null;

export interface PTIChecklistItemDef {
  id: string;
  step: number;
  label: string;
  hint?: string;
}

/** Generic terminal PTI protocol v1. Per-liner branches (Maersk / MSC / CMA)
 *  are Phase 2 — see protocolVersion on PTITask. */
export const PTI_PROTOCOL_V1: PTIChecklistItemDef[] = [
  { id: 'ext',    step: 1,  label: 'Visual inspection — exterior',     hint: 'Body damage, dents, scratches, rust' },
  { id: 'int',    step: 2,  label: 'Visual inspection — interior',     hint: 'Walls, floor T-bar, drain plug, cleanliness' },
  { id: 'seal',   step: 3,  label: 'Door seal integrity',              hint: 'Gasket compression, no light leaks' },
  { id: 'drain',  step: 4,  label: 'Drain hose / scupper',             hint: 'Clear, no blockage' },
  { id: 'plug',   step: 5,  label: 'Power cable + plug',               hint: 'Insulation intact, pins not bent' },
  { id: 'disp',   step: 6,  label: 'Display panel operational',        hint: 'Set-point, supply, return all visible' },
  { id: 'setpt',  step: 7,  label: 'Set-point accuracy',               hint: 'Set 0°C / -20°C, verify display matches' },
  { id: 'comp',   step: 8,  label: 'Compressor operation',             hint: 'Cool-down rate ≥ 1°C/min from ambient' },
  { id: 'fan',    step: 9,  label: 'Fan operation (evap + condenser)', hint: 'Both fans running, no abnormal noise' },
  { id: 'def',    step: 10, label: 'Defrost cycle test',               hint: 'Trigger defrost, verify completes' },
  { id: 'sens',   step: 11, label: 'Sensor calibration',               hint: 'Supply/return within ±0.3°C of probe' },
  { id: 'alarm',  step: 12, label: 'Alarm shutdown test',              hint: 'Trigger high-temp alarm, verify unit shuts down' },
];

export interface PTITask {
  id: string;
  containerNo: string;
  liner: string;
  protocolVersion: 'V1';      // Phase 2: 'MAERSK_V2025', 'MSC_V12', etc
  status: PTIStatus;
  technician: string | null;
  startedAt: string | null;
  completedAt: string | null;
  items: Record<string, { result: PTIItemResult; notes?: string }>;
  overallNotes?: string;
  failureReason?: string;     // populated when status === 'FAILED'
}

/* ──────────────────────────────────────────────────────────────────────────
   Temperature readings — Monitoring log
   ────────────────────────────────────────────────────────────────────────── */

export interface TempReading {
  id: string;
  containerNo: string;
  recordedAt: string;        // ISO
  recordedBy: string;
  setPointC: number;
  supplyTempC: number;
  returnTempC: number;
  humidityPct: number | null;
  plugStatus: PlugStatus;
  inBand: boolean;           // computed at log time, based on cargoBand
  remarks?: string;
}

/* ──────────────────────────────────────────────────────────────────────────
   Operational defaults — mirrored from System Parameters (Reefer section)
   Until backend wiring exists, this is the demo source of truth.
   ────────────────────────────────────────────────────────────────────────── */

export interface ReeferOpsConfig {
  /** Default cadence for temperature readings on laden reefers, in hours. */
  tempLogCadenceHours: number;
  /** Grace period after cadence elapses before NO_READING alarm fires. */
  tempLogGraceMinutes: number;
  /** Minimum deviation duration before DEVIATION alarm fires. */
  deviationGraceMinutes: number;
  /** Tolerance bands. Editable per cargo type. */
  bandToleranceC: Record<CargoBand, number>;
  /** Default PTI protocol version applied to new tasks. */
  defaultPtiProtocol: 'V1';
  /** Pre-cool target hours before stuffing — typical 6h, used for ETA. */
  preCoolTargetHours: number;
}

export const DEFAULT_REEFER_CONFIG: ReeferOpsConfig = {
  tempLogCadenceHours: 4,
  tempLogGraceMinutes: 30,
  deviationGraceMinutes: 30,
  bandToleranceC: { ...BAND_TOLERANCE_C },
  defaultPtiProtocol: 'V1',
  preCoolTargetHours: 6,
};
