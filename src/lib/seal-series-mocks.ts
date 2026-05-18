/**
 * Seal series master data.
 *
 * Per-agent allocated seal number ranges. Used at gate-out / EIR-Out to
 * validate that the seal applied to an outbound container falls within
 * an active series for the registered shipping line / agent.
 *
 * Phase 1 mock data — Phase 2 syncs from api.gecko-api.
 */

export interface SealSeries {
  id: string;
  agentCode: string;          // CMACGM, MAERSK, EVERGREEN…
  agentName: string;          // long form, looked up at write-time
  prefix: string;             // C, L, L0, etc — printed on physical seal
  seriesStart: number;
  seriesEnd: number;
  currentSeal: number;        // last allocated seal in this series
  suspended: boolean;         // manual override — block allocations
  remarks?: string;
  createdAt: string;          // ISO date
  createdBy: string;
}

export type SealSeriesStatus = 'ACTIVE' | 'EXHAUSTED' | 'SUSPENDED';

export function statusOf(s: SealSeries): SealSeriesStatus {
  if (s.suspended) return 'SUSPENDED';
  if (s.currentSeal >= s.seriesEnd) return 'EXHAUSTED';
  return 'ACTIVE';
}

export function remainingOf(s: SealSeries): number {
  if (s.currentSeal >= s.seriesEnd) return 0;
  return s.seriesEnd - Math.max(s.currentSeal, s.seriesStart - 1);
}

export function totalOf(s: SealSeries): number {
  return s.seriesEnd - s.seriesStart + 1;
}

/* ──────────────────────────────────────────────────────────────────────────
   Agent directory — used by the lookup field next to the agent-code input
   ────────────────────────────────────────────────────────────────────────── */

export const AGENT_DIRECTORY: { code: string; name: string }[] = [
  { code: 'CMACGM',    name: 'CMA CGM S.A., REPRESENTED BY CMA CGM (THAILAND) LTD.' },
  { code: 'MAERSK',    name: 'A.P. MOLLER-MAERSK (THAILAND) LTD.' },
  { code: 'EVERGREEN', name: 'EVERGREEN MARINE (THAILAND) LTD.' },
  { code: 'COSCO',     name: 'COSCO SHIPPING LINES (THAILAND) CO., LTD.' },
  { code: 'ONE',       name: 'OCEAN NETWORK EXPRESS (THAILAND) CO., LTD.' },
  { code: 'MSC',       name: 'MEDITERRANEAN SHIPPING COMPANY (THAILAND) LTD.' },
  { code: 'OOCL',      name: 'ORIENT OVERSEAS CONTAINER LINE LTD.' },
  { code: 'YANGMING',  name: 'YANG MING (THAILAND) CO., LTD.' },
  { code: 'HMM',       name: 'HMM (THAILAND) CO., LTD.' },
  { code: 'WANHAI',    name: 'WAN HAI LINES (THAILAND) LTD.' },
  { code: 'HAPAG',     name: 'HAPAG-LLOYD (THAILAND) LTD.' },
];

/* ──────────────────────────────────────────────────────────────────────────
   Seal series (~30 entries across 6 main liners)
   Mirrors the WinForms screenshot structure — CMACGM with C and L0
   prefixes, varied series sizes, all "Current Seal" at 0 (fresh allocations).
   ────────────────────────────────────────────────────────────────────────── */

const TODAY = '2026-05-18';

function mk(
  id: string, agent: string, prefix: string, start: number, end: number,
  current: number, suspended = false, remarks?: string,
): SealSeries {
  const agentName = AGENT_DIRECTORY.find(a => a.code === agent)?.name ?? agent;
  return {
    id, agentCode: agent, agentName, prefix,
    seriesStart: start, seriesEnd: end, currentSeal: current,
    suspended, remarks,
    createdAt: TODAY, createdBy: 'WICHCHAKORN',
  };
}

export const SEAL_SERIES: SealSeries[] = [
  // CMACGM (mirrors the WinForms screen)
  mk('ss-001', 'CMACGM', 'C',  1788628, 1788629,        0),
  mk('ss-002', 'CMACGM', 'C',  1788654, 1788680,        0),
  mk('ss-003', 'CMACGM', 'C',  1788701, 1788730,        0),
  mk('ss-004', 'CMACGM', 'C',  1788768, 1788768,        0),
  mk('ss-005', 'CMACGM', 'L',  6199001, 6199250,    62, false, 'Q2 allocation'),
  mk('ss-006', 'CMACGM', 'L0', 698251,  698500,         0),
  mk('ss-007', 'CMACGM', 'L0', 702751,  703000,         0),
  mk('ss-008', 'CMACGM', 'L0', 706751,  707000,         0),
  mk('ss-009', 'CMACGM', 'L0', 709251,  709500,         0),
  mk('ss-010', 'CMACGM', 'L0', 843037,  843037,         0),
  mk('ss-011', 'CMACGM', 'L0', 843117,  843117,         0),
  mk('ss-012', 'CMACGM', 'L0', 854023,  854046,         0),
  mk('ss-013', 'CMACGM', 'L0', 854209,  854209,         0),
  mk('ss-014', 'CMACGM', 'L0', 854547,  854547,         0),

  // MAERSK
  mk('ss-020', 'MAERSK',    'MK', 5500000, 5500999,   441, false, 'May 2026 batch'),
  mk('ss-021', 'MAERSK',    'MK', 5501000, 5501999,     0),
  mk('ss-022', 'MAERSK',    'MS', 7732001, 7733000, 1000, false, 'fully consumed'),

  // EVERGREEN
  mk('ss-030', 'EVERGREEN', 'EV', 3200000, 3200500,   122),
  mk('ss-031', 'EVERGREEN', 'EV', 3200501, 3201000,     0),
  mk('ss-032', 'EVERGREEN', 'EM', 2800001, 2800500,     0, true, 'suspended pending audit'),

  // COSCO
  mk('ss-040', 'COSCO',     'CS', 4400000, 4400999,    88),
  mk('ss-041', 'COSCO',     'CS', 4401000, 4401999,     0),

  // ONE
  mk('ss-050', 'ONE',       'ON', 1100000, 1100500,    62),
  mk('ss-051', 'ONE',       'ON', 1100501, 1101000,     0),

  // MSC
  mk('ss-060', 'MSC',       'M',  9100000, 9100999,    34),
  mk('ss-061', 'MSC',       'M',  9101000, 9101999,     0),

  // OOCL
  mk('ss-070', 'OOCL',      'OO', 5500000, 5500499,   188),

  // YANG MING
  mk('ss-080', 'YANGMING',  'YM', 4400000, 4400299,    62, true, 'agent under review'),

  // HMM
  mk('ss-090', 'HMM',       'HM', 8800000, 8800499,    12),

  // WANHAI
  mk('ss-100', 'WANHAI',    'WH', 6600000, 6600499,    24),

  // HAPAG
  mk('ss-110', 'HAPAG',     'HL', 1200000, 1200499,    44),
];
