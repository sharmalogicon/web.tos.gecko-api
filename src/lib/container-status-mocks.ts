/**
 * Container Status Update — types + mock data.
 *
 * Operational view for changing a container's status / holds / remarks.
 * Distinct from /units/unit-inquiry which is read-only history.
 *
 * Status codes (confirmed with Sharma):
 *   AV  — Available
 *   EM  — Empty (in yard)
 *   FL  — Laden / Full
 *   HD  — Hold
 *   DM  — Damaged
 *   OH  — Off-Hire
 *   RS  — Reserved
 */

export type ContainerStatus = 'AV' | 'EM' | 'FL' | 'HD' | 'DM' | 'OH' | 'RS';

export const STATUS_LABEL: Record<ContainerStatus, string> = {
  AV: 'Available',
  EM: 'Empty',
  FL: 'Laden / Full',
  HD: 'Hold',
  DM: 'Damaged',
  OH: 'Off-Hire',
  RS: 'Reserved',
};

export const STATUS_BADGE_CLS: Record<ContainerStatus, string> = {
  AV: 'gecko-badge gecko-badge-success',
  EM: 'gecko-badge gecko-badge-gray',
  FL: 'gecko-badge gecko-badge-info',
  HD: 'gecko-badge gecko-badge-warning',
  DM: 'gecko-badge gecko-badge-error',
  OH: 'gecko-badge gecko-badge-accent',
  RS: 'gecko-badge gecko-badge-primary',
};

export type HireMode = 'OWN' | 'LSD' | 'SOC' | 'COC';
export type Material = 'STL' | 'ALU' | 'COR';
export type Height   = "8'6\"" | "9'6\"";
export type EmptyFull = 'EMPTY' | 'FULL';
export type Movement = 'IN' | 'OUT' | 'INTRA-YARD' | 'TRANSFER' | null;
export type ContainerClass = 'NONE' | 'REEFER' | 'OOG' | 'TANK' | 'OPEN-TOP' | 'FLAT-RACK';

export interface ContainerFixPort {
  portCode: string;
  portName: string;
}

export interface ActivityEntry {
  id: string;
  ts: string;              // ISO
  event: string;           // e.g. STATUS CHANGED, REMARKS UPDATED, GATE-IN
  fromStatus?: ContainerStatus;
  toStatus?: ContainerStatus;
  remarks?: string;
  by: string;              // user
}

export interface ContainerRecord {
  // Identity
  containerNo: string;
  agentCode: string;        // OOCL
  agentName: string;
  ownerCode: string;        // OOCL
  hireMode: HireMode;
  tareWgt: number;          // kg
  curLoc: string;           // SCT EXP
  remarks: string;

  // Spec
  size: '20' | '40' | '45';
  type: string;             // RH, GP, HC, RF…
  material: Material;
  height: Height;
  containerClass: ContainerClass;
  maxGrossWgt: number;      // kg
  yardLocation: string;     // block + position
  isoType: string;          // 22G1, 42HC, 45RH

  // Movement / current properties
  efIndicator: string;      // 1352
  movementIndicator: string;// 1501
  temp: number | null;      // -17.00 for reefer
  temperatureMode: string;  // 1151
  agentSeal: string;
  customerSeal: string;
  eirNo: string;
  emptyFull: EmptyFull;
  movement: Movement;

  // Status
  status: ContainerStatus;
  hold: boolean;
  statusRemarks: string;
  emrRemarks: string;       // free-text M&R notes

  // Lists
  fixPorts: ContainerFixPort[];
  activity: ActivityEntry[];

  // Audit
  createdBy: string;
  createdAt: string;
  modifiedBy: string;
  modifiedAt: string;
}

/* ──────────────────────────────────────────────────────────────────────────
   Port directory (subset — for the Fix-Port lookup field)
   ────────────────────────────────────────────────────────────────────────── */

export const PORT_DIRECTORY: { code: string; name: string }[] = [
  { code: '2E9', name: 'NAGOYA UNITED CT (NABETA)' },
  { code: 'JPTYO', name: 'TOKYO' },
  { code: 'JPYOK', name: 'YOKOHAMA' },
  { code: 'SGSIN', name: 'SINGAPORE' },
  { code: 'CNSHA', name: 'SHANGHAI' },
  { code: 'HKHKG', name: 'HONG KONG' },
  { code: 'KRPUS', name: 'BUSAN' },
  { code: 'MYPKG', name: 'PORT KLANG' },
  { code: 'IDJKT', name: 'JAKARTA / TANJUNG PRIOK' },
  { code: 'VNSGN', name: 'HO CHI MINH CITY' },
  { code: 'INNSA', name: 'JAWAHARLAL NEHRU (NHAVA SHEVA)' },
  { code: 'AEJEA', name: 'JEBEL ALI' },
  { code: 'NLRTM', name: 'ROTTERDAM' },
  { code: 'DEHAM', name: 'HAMBURG' },
  { code: 'USLAX', name: 'LOS ANGELES' },
];

/* ──────────────────────────────────────────────────────────────────────────
   Mock container roster — varied statuses for demo
   ────────────────────────────────────────────────────────────────────────── */

const NOW_ISO = '2026-05-18T09:18:00+07:00';

function mkActivity(entries: Omit<ActivityEntry, 'id'>[]): ActivityEntry[] {
  return entries.map((e, i) => ({ id: `a-${Date.now()}-${i}`, ...e }));
}

export const CONTAINER_RECORDS: ContainerRecord[] = [
  {
    containerNo: 'OERU4204172',
    agentCode: 'OOCL', agentName: 'ORIENT OVERSEAS CONTAINER LINE LTD.',
    ownerCode: 'OOCL', hireMode: 'OWN',
    tareWgt: 0, curLoc: 'SCT EXP', remarks: '',
    size: '40', type: 'RH', material: 'STL', height: "9'6\"", containerClass: 'REEFER',
    maxGrossWgt: 30120, yardLocation: 'RF-D1 D1-07-01',
    isoType: '42RH',
    efIndicator: '1352', movementIndicator: '1501',
    temp: -17, temperatureMode: '1151',
    agentSeal: 'OOLKBS6279', customerSeal: '',
    eirNo: 'EISCT1260503303',
    emptyFull: 'FULL', movement: 'IN',
    status: 'AV', hold: false,
    statusRemarks: '0',
    emrRemarks: '',
    fixPorts: [{ portCode: '2E9', portName: 'NAGOYA UNITED CT (NABETA)' }],
    activity: mkActivity([
      { ts: '2026-05-12T22:48:00+07:00', event: 'CREATED', by: 'WICHCHAKORN' },
      { ts: '2026-05-13T08:15:00+07:00', event: 'GATE-IN',  remarks: 'Laden export', by: 'GATE.SUREE' },
      { ts: '2026-05-13T08:18:00+07:00', event: 'STATUS CHANGED', fromStatus: 'EM', toStatus: 'FL', by: 'GATE.SUREE' },
      { ts: '2026-05-14T11:42:00+07:00', event: 'STATUS CHANGED', fromStatus: 'FL', toStatus: 'AV', remarks: 'Cleared customs', by: 'OPS.ANAN' },
    ]),
    createdBy: 'WICHCHAKORN', createdAt: '2026-05-12T22:48:00+07:00',
    modifiedBy: 'OPS.ANAN',   modifiedAt: '2026-05-14T11:42:00+07:00',
  },
  {
    containerNo: 'MAEU7234561',
    agentCode: 'MAERSK', agentName: 'A.P. MOLLER-MAERSK (THAILAND) LTD.',
    ownerCode: 'MAERSK', hireMode: 'OWN',
    tareWgt: 3800, curLoc: 'SCT IMP', remarks: '',
    size: '40', type: 'GP', material: 'STL', height: "8'6\"", containerClass: 'NONE',
    maxGrossWgt: 30480, yardLocation: 'IMP-A2 A2-04-02',
    isoType: '42G1',
    efIndicator: '1352', movementIndicator: '1501',
    temp: null, temperatureMode: '',
    agentSeal: 'MAEU449821', customerSeal: 'CSL-7720',
    eirNo: 'EISCT1260503311',
    emptyFull: 'FULL', movement: 'IN',
    status: 'AV', hold: false,
    statusRemarks: '',
    emrRemarks: '',
    fixPorts: [{ portCode: 'SGSIN', portName: 'SINGAPORE' }],
    activity: mkActivity([
      { ts: '2026-04-24T14:32:00+07:00', event: 'GATE-IN',  remarks: 'Import laden — KCE Electronics', by: 'GATE.WICHAI' },
      { ts: '2026-04-25T09:10:00+07:00', event: 'STATUS CHANGED', fromStatus: 'FL', toStatus: 'AV', by: 'OPS.PRAWIT' },
    ]),
    createdBy: 'OPS.WICHCHAKORN', createdAt: '2026-04-24T14:30:00+07:00',
    modifiedBy: 'OPS.PRAWIT',     modifiedAt: '2026-04-25T09:10:00+07:00',
  },
  {
    containerNo: 'CMAU8843901',
    agentCode: 'CMACGM', agentName: 'CMA CGM S.A., REPRESENTED BY CMA CGM (THAILAND) LTD.',
    ownerCode: 'CMACGM', hireMode: 'OWN',
    tareWgt: 3850, curLoc: 'SCT IMP', remarks: 'Customs verification — open since 23 Apr',
    size: '40', type: 'GP', material: 'STL', height: "8'6\"", containerClass: 'NONE',
    maxGrossWgt: 30480, yardLocation: 'IMP-A2 A2-06-03',
    isoType: '42G1',
    efIndicator: '1352', movementIndicator: '1501',
    temp: null, temperatureMode: '',
    agentSeal: 'CMAU771209', customerSeal: 'CPF-4471',
    eirNo: 'EISCT1260503244',
    emptyFull: 'FULL', movement: 'IN',
    status: 'HD', hold: true,
    statusRemarks: 'Customs hold — duty assessment pending',
    emrRemarks: 'No damage on arrival; door seal intact.',
    fixPorts: [{ portCode: 'CNSHA', portName: 'SHANGHAI' }],
    activity: mkActivity([
      { ts: '2026-04-23T11:08:00+07:00', event: 'GATE-IN', remarks: 'Charoen Pokphand Foods', by: 'GATE.SUREE' },
      { ts: '2026-04-23T11:24:00+07:00', event: 'HOLD APPLIED', remarks: 'Customs — duty assessment', by: 'CUSTOMS' },
      { ts: '2026-04-25T09:05:00+07:00', event: 'STATUS CHANGED', fromStatus: 'FL', toStatus: 'HD', by: 'OPS.ANAN' },
    ]),
    createdBy: 'OPS.WICHCHAKORN', createdAt: '2026-04-23T11:05:00+07:00',
    modifiedBy: 'OPS.ANAN',        modifiedAt: '2026-04-25T09:05:00+07:00',
  },
  {
    containerNo: 'ONEU3398472',
    agentCode: 'ONE', agentName: 'OCEAN NETWORK EXPRESS (THAILAND) CO., LTD.',
    ownerCode: 'ONE', hireMode: 'OWN',
    tareWgt: 2300, curLoc: 'MT-E3', remarks: '',
    size: '20', type: 'GP', material: 'STL', height: "8'6\"", containerClass: 'NONE',
    maxGrossWgt: 24000, yardLocation: 'MT-E3 E3-02-01',
    isoType: '22G1',
    efIndicator: '1352', movementIndicator: '1501',
    temp: null, temperatureMode: '',
    agentSeal: '', customerSeal: '',
    eirNo: 'EISCT1260503290',
    emptyFull: 'EMPTY', movement: 'IN',
    status: 'EM', hold: false,
    statusRemarks: '',
    emrRemarks: 'Minor scratch on door; logged for next PTI.',
    fixPorts: [],
    activity: mkActivity([
      { ts: '2026-05-11T09:18:00+07:00', event: 'GATE-IN',  by: 'GATE.NIRAN' },
      { ts: '2026-05-11T09:20:00+07:00', event: 'STATUS CHANGED', fromStatus: 'FL', toStatus: 'EM', remarks: 'Stripped at CFS', by: 'CFS.MOO' },
    ]),
    createdBy: 'CFS.MOO',           createdAt: '2026-05-11T09:20:00+07:00',
    modifiedBy: 'CFS.MOO',          modifiedAt: '2026-05-11T09:20:00+07:00',
  },
  {
    containerNo: 'YMLU8014228',
    agentCode: 'YANGMING', agentName: 'YANG MING (THAILAND) CO., LTD.',
    ownerCode: 'YANGMING', hireMode: 'LSD',
    tareWgt: 3900, curLoc: 'MR Workshop', remarks: 'Compressor fault — quarantined for M&R',
    size: '40', type: 'RH', material: 'STL', height: "9'6\"", containerClass: 'REEFER',
    maxGrossWgt: 30120, yardLocation: 'MR-01',
    isoType: '42RH',
    efIndicator: '1352', movementIndicator: '1501',
    temp: null, temperatureMode: '',
    agentSeal: '', customerSeal: '',
    eirNo: 'EISCT1260503312',
    emptyFull: 'EMPTY', movement: null,
    status: 'DM', hold: true,
    statusRemarks: 'Failed PTI — compressor fault. Awaiting workshop slot.',
    emrRemarks: 'Refrigerant leak suspected. Quote required from approved vendor.',
    fixPorts: [],
    activity: mkActivity([
      { ts: '2026-05-18T07:30:00+07:00', event: 'PTI FAILED', remarks: 'Compressor failed to maintain cool-down rate', by: 'OPS.NIRAN' },
      { ts: '2026-05-18T07:45:00+07:00', event: 'STATUS CHANGED', fromStatus: 'EM', toStatus: 'DM', by: 'OPS.NIRAN' },
      { ts: '2026-05-18T07:45:00+07:00', event: 'HOLD APPLIED', remarks: 'Quarantine for M&R', by: 'OPS.NIRAN' },
    ]),
    createdBy: 'OPS.NIRAN', createdAt: '2026-05-18T07:30:00+07:00',
    modifiedBy: 'OPS.NIRAN', modifiedAt: '2026-05-18T07:45:00+07:00',
  },
  {
    containerNo: 'COSU9981233',
    agentCode: 'COSCO', agentName: 'COSCO SHIPPING LINES (THAILAND) CO., LTD.',
    ownerCode: 'COSCO', hireMode: 'OWN',
    tareWgt: 3700, curLoc: 'SCT IMP', remarks: '',
    size: '40', type: 'RH', material: 'STL', height: "9'6\"", containerClass: 'REEFER',
    maxGrossWgt: 30120, yardLocation: 'RF-C2 C2-05-02',
    isoType: '42RH',
    efIndicator: '1352', movementIndicator: '1501',
    temp: 4, temperatureMode: '1151',
    agentSeal: 'COSU3308812', customerSeal: 'IV-2208',
    eirNo: 'EISCT1260503275',
    emptyFull: 'FULL', movement: 'IN',
    status: 'AV', hold: false,
    statusRemarks: '',
    emrRemarks: '',
    fixPorts: [{ portCode: 'SGSIN', portName: 'SINGAPORE' }],
    activity: mkActivity([
      { ts: '2026-04-29T16:42:00+07:00', event: 'GATE-IN', remarks: 'Indorama Ventures', by: 'GATE.SUREE' },
    ]),
    createdBy: 'OPS.WICHCHAKORN', createdAt: '2026-04-29T16:40:00+07:00',
    modifiedBy: 'OPS.WICHCHAKORN', modifiedAt: '2026-04-29T16:42:00+07:00',
  },
  {
    containerNo: 'EGHU9213381',
    agentCode: 'EVERGREEN', agentName: 'EVERGREEN MARINE (THAILAND) LTD.',
    ownerCode: 'EVERGREEN', hireMode: 'OWN',
    tareWgt: 3870, curLoc: 'SCT EXP', remarks: '',
    size: '40', type: 'HC', material: 'STL', height: "9'6\"", containerClass: 'NONE',
    maxGrossWgt: 32500, yardLocation: 'EXP-B2 B2-12-02',
    isoType: '42HC',
    efIndicator: '1352', movementIndicator: '1501',
    temp: null, temperatureMode: '',
    agentSeal: 'EMCSAS5464', customerSeal: 'ML-3091',
    eirNo: 'EISCT1260406241',
    emptyFull: 'FULL', movement: 'IN',
    status: 'RS', hold: false,
    statusRemarks: 'Reserved for EVER WEB 0344-022B loadout',
    emrRemarks: '',
    fixPorts: [{ portCode: 'SGSIN', portName: 'SINGAPORE' }],
    activity: mkActivity([
      { ts: '2026-04-24T00:31:00+07:00', event: 'GATE-IN', remarks: 'TCL Electronics', by: 'GATE.WICHAI' },
      { ts: '2026-04-24T08:00:00+07:00', event: 'STATUS CHANGED', fromStatus: 'AV', toStatus: 'RS', remarks: 'Allocated to EVER WEB voyage', by: 'PLANNER.LEK' },
    ]),
    createdBy: 'OPS.WICHCHAKORN', createdAt: '2026-04-24T00:31:00+07:00',
    modifiedBy: 'PLANNER.LEK',    modifiedAt: '2026-04-24T08:00:00+07:00',
  },
];

/* ──────────────────────────────────────────────────────────────────────────
   Suppress lint for unused export — kept for Phase 2 wiring
   ────────────────────────────────────────────────────────────────────────── */
export const _now = NOW_ISO;
