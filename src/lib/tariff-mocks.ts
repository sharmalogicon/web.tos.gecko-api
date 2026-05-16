/**
 * Tariff mock data — five sample schedules indexed by ID.
 * Mirrors what the list page shows. Replace with API queries in production.
 */

import type { Schedule } from './tariff-types';

function mkRow(opts: {
  id: string; size?: string; type?: string; truckCat?: string; cargoCat?: string;
  paymentTerm: 'CASH' | 'CREDIT'; billedTo: 'CUSTOMER' | 'AGENT' | 'FWD' | 'LINE' | 'CARRIER' | 'HAULIER';
  amount: number;
  source?: 'human' | 'imported' | 'ai-suggested';
}) {
  return {
    id: opts.id,
    paymentTerm: opts.paymentTerm,
    billedTo: opts.billedTo,
    amount: opts.amount,
    size: opts.size,
    type: opts.type,
    truckCat: opts.truckCat,
    cargoCat: opts.cargoCat,
    source: opts.source ?? 'human' as const,
  };
}

export const SCHEDULES: Record<string, Schedule> = {
  'TP-2026-PUB': {
    id: 'TP-2026-PUB',
    name: 'Public Tariff 2026 (Standard)',
    type: 'PUBLIC',
    status: 'Active',
    effective: '2026-01-01',
    expiry: '2026-12-31',
    salesPerson: 'YOKPORN',
    approver: 'CHAKRIYA',
    workflowId: 'wf-std-3step',
    workflowProgress: [
      { stepId: 's1', stepName: 'Sales draft',      approverLabel: 'Sales Rep',     status: 'approved', at: '2025-12-15', by: 'YOKPORN' },
      { stepId: 's2', stepName: 'Sales Manager',    approverLabel: 'Sales Manager', status: 'approved', at: '2025-12-18', by: 'CHAKRIYA' },
      { stepId: 's3', stepName: 'Finance sign-off', approverLabel: 'Finance Officer', status: 'approved', at: '2025-12-22', by: 'PRACHEE' },
    ],
    orderTypesInScope: ['exp-cy-cy', 'imp-cy-cy', 'imp-lolo'],
    prices: [
      { id: 'pc1', code: 'SA001', desc: 'Admission Fee', source: 'MOVEMENT', orderTypeId: 'exp-cy-cy', movementSeq: 2,
        axes: new Set(), rows: [
          mkRow({ id: 'r1', paymentTerm: 'CASH',   billedTo: 'CUSTOMER', amount: 250 }),
          mkRow({ id: 'r2', paymentTerm: 'CREDIT', billedTo: 'LINE',     amount: 220 }),
        ],
      },
      { id: 'pc2', code: 'SB001', desc: 'Storage Fee', source: 'MOVEMENT', orderTypeId: 'exp-cy-cy', movementSeq: 2,
        axes: new Set(['SIZE']), rows: [
          mkRow({ id: 'r3', size: '20', paymentTerm: 'CREDIT', billedTo: 'CUSTOMER', amount: 320 }),
          mkRow({ id: 'r4', size: '40', paymentTerm: 'CREDIT', billedTo: 'CUSTOMER', amount: 480 }),
          mkRow({ id: 'r5', size: '45', paymentTerm: 'CREDIT', billedTo: 'CUSTOMER', amount: 540 }),
        ],
      },
      { id: 'pc3', code: 'SC001', desc: 'Handling Fee', source: 'MOVEMENT', orderTypeId: 'exp-cy-cy', movementSeq: 2,
        axes: new Set(['SIZE']), rows: [
          mkRow({ id: 'r6', size: '20', paymentTerm: 'CASH', billedTo: 'AGENT', amount: 850 }),
          mkRow({ id: 'r7', size: '40', paymentTerm: 'CASH', billedTo: 'AGENT', amount: 1100 }),
        ],
      },
      { id: 'pc4', code: 'SA001', desc: 'Admission Fee', source: 'MOVEMENT', orderTypeId: 'imp-cy-cy', movementSeq: 1,
        axes: new Set(), rows: [
          mkRow({ id: 'r8', paymentTerm: 'CASH', billedTo: 'LINE', amount: 300 }),
        ],
      },
    ],
    ladenStorage: { freeDays: 3, mode: 'PER_DAY_SLAB',
      perDaySlabs: [
        { id: 'ls1-a', fromDay: 1,  toDay: 5,  ratePerDay:  80 },
        { id: 'ls1-b', fromDay: 6,  toDay: 10, ratePerDay: 160 },
        { id: 'ls1-c', fromDay: 11, toDay: 30, ratePerDay: 240 },
      ], fleetTeuBands: [] },
    emptyStorage: { freeDays: 14, mode: 'PER_DAY_SLAB',
      perDaySlabs: [
        { id: 'es1-a', fromDay: 1,  toDay: 5,  ratePerDay: 30 },
        { id: 'es1-b', fromDay: 6,  toDay: 10, ratePerDay: 60 },
        { id: 'es1-c', fromDay: 11, toDay: 60, ratePerDay: 90 },
      ], fleetTeuBands: [] },
    ptiRates:     { '20RF': 850, '40RF': 1200, '40HC-RF': 1300 },
    precoolRates: { '20RF': 600, '40RF': 800,  '40HC-RF': 850 },
    freeTime: {
      fullExport: { normal: 5, reefer: 3, dg: 1 },
      fullImport: { normal: 3, reefer: 2, dg: 1 },
      emptyExport: { normal: 14, reefer: 7 },
      emptyImport: { normal: 14, reefer: 7 },
      waiveMtyDm: true,
    },
    activity: [
      { id: 'a1', who: 'YOKPORN',  what: 'Created the schedule',         when: '2025-12-15 09:32', icon: 'plus',  tone: 'primary' },
      { id: 'a2', who: 'YOKPORN',  what: 'Imported 47 rate rows from rates-2026.csv', when: '2025-12-15 14:18', icon: 'upload', tone: 'info' },
      { id: 'a3', who: 'CHAKRIYA', what: 'Approved as Sales Manager',    when: '2025-12-18 11:05', icon: 'check', tone: 'success' },
      { id: 'a4', who: 'PRACHEE',  what: 'Approved as Finance Officer',  when: '2025-12-22 16:40', icon: 'check', tone: 'success' },
      { id: 'a5', who: 'System',   what: 'Activated; effective from Jan 1', when: '2026-01-01 00:00', icon: 'zap',   tone: 'success' },
    ],
  },

  'TP-2026-C01': {
    id: 'TP-2026-C01',
    name: 'Thai Union Group Contract 2026',
    type: 'CONTRACT',
    status: 'Active',
    shipper: { code: 'TUG', name: 'THAI UNION GROUP PCL' },
    effective: '2026-01-01',
    expiry: '2026-12-31',
    salesPerson: 'YOKPORN',
    approver: 'CHAKRIYA',
    workflowId: 'wf-std-3step',
    workflowProgress: [
      { stepId: 's1', stepName: 'Sales draft',      approverLabel: 'Sales Rep',     status: 'approved', at: '2025-12-10', by: 'YOKPORN' },
      { stepId: 's2', stepName: 'Sales Manager',    approverLabel: 'Sales Manager', status: 'approved', at: '2025-12-14', by: 'CHAKRIYA' },
      { stepId: 's3', stepName: 'Finance sign-off', approverLabel: 'Finance Officer', status: 'approved', at: '2025-12-20', by: 'PRACHEE' },
    ],
    orderTypesInScope: ['exp-cy-cy', 'imp-cy-cy'],
    prices: [
      { id: 'pc1', code: 'SA001', desc: 'Admission Fee', source: 'MOVEMENT', orderTypeId: 'exp-cy-cy', movementSeq: 2,
        axes: new Set(), rows: [
          mkRow({ id: 'r1', paymentTerm: 'CASH', billedTo: 'CUSTOMER', amount: 200 }),
        ],
      },
      { id: 'pc2', code: 'SB001', desc: 'Storage Fee', source: 'MOVEMENT', orderTypeId: 'exp-cy-cy', movementSeq: 2,
        axes: new Set(['SIZE']), rows: [
          mkRow({ id: 'r2', size: '20', paymentTerm: 'CREDIT', billedTo: 'CUSTOMER', amount: 280 }),
          mkRow({ id: 'r3', size: '40', paymentTerm: 'CREDIT', billedTo: 'CUSTOMER', amount: 420 }),
        ],
      },
    ],
    ladenStorage: { freeDays: 5, mode: 'PER_DAY_SLAB',
      perDaySlabs: [
        { id: 'ls2-a', fromDay: 1,  toDay: 5,  ratePerDay:  70 },
        { id: 'ls2-b', fromDay: 6,  toDay: 10, ratePerDay: 140 },
        { id: 'ls2-c', fromDay: 11, toDay: 30, ratePerDay: 210 },
      ], fleetTeuBands: [] },
    emptyStorage: { freeDays: 14, mode: 'PER_DAY_SLAB',
      perDaySlabs: [
        { id: 'es2-a', fromDay: 1,  toDay: 5,  ratePerDay: 25 },
        { id: 'es2-b', fromDay: 6,  toDay: 10, ratePerDay: 50 },
        { id: 'es2-c', fromDay: 11, toDay: 60, ratePerDay: 80 },
      ], fleetTeuBands: [] },
    ptiRates:     { '20RF': 800, '40RF': 1100, '40HC-RF': 1200 },
    precoolRates: { '20RF': 550, '40RF': 750,  '40HC-RF': 800 },
    freeTime: {
      fullExport: { normal: 7, reefer: 5, dg: 1 },
      fullImport: { normal: 5, reefer: 3, dg: 1 },
      emptyExport: { normal: 21, reefer: 10 },
      emptyImport: { normal: 21, reefer: 10 },
      waiveMtyDm: true,
    },
    activity: [
      { id: 'a1', who: 'YOKPORN', what: 'Negotiated contract with Thai Union procurement team', when: '2025-12-08 10:00', icon: 'plus', tone: 'primary' },
      { id: 'a2', who: 'YOKPORN', what: 'Drafted schedule with 30 priced charges',              when: '2025-12-10 11:30', icon: 'edit', tone: 'info' },
      { id: 'a3', who: 'CHAKRIYA', what: 'Approved as Sales Manager',                            when: '2025-12-14 09:15', icon: 'check', tone: 'success' },
      { id: 'a4', who: 'PRACHEE',  what: 'Approved as Finance Officer',                          when: '2025-12-20 14:22', icon: 'check', tone: 'success' },
      { id: 'a5', who: 'System',   what: 'Activated; effective from Jan 1',                      when: '2026-01-01 00:00', icon: 'zap',   tone: 'success' },
    ],
  },

  'TP-2026-C02': {
    id: 'TP-2026-C02',
    name: 'PTT Global VIP Volume Agreement',
    type: 'CONTRACT',
    status: 'Active',
    shipper: { code: 'PTTGC', name: 'PTT GLOBAL CHEMICAL PCL' },
    effective: '2026-03-01',
    expiry: '2027-02-28',
    salesPerson: 'NARONG',
    approver: 'CHAKRIYA',
    workflowId: 'wf-vip-fastpath',
    workflowProgress: [
      { stepId: 's1', stepName: 'Sales draft',           approverLabel: 'Sales Rep',     status: 'approved',      at: '2026-02-18', by: 'NARONG' },
      { stepId: 's2', stepName: 'Sales Manager',         approverLabel: 'Sales Manager', status: 'approved',      at: '2026-02-22', by: 'CHAKRIYA' },
      { stepId: 's3', stepName: 'Finance auto-check',    approverLabel: 'Auto (system)', status: 'auto-approved', at: '2026-02-22', by: 'System',  thresholdNote: 'Δ vs standard = 6.4% < 10%' },
    ],
    orderTypesInScope: ['exp-cy-cy', 'imp-cy-cy', 'imp-lolo'],
    prices: [
      { id: 'pc1', code: 'SA001', desc: 'Admission Fee', source: 'MOVEMENT', orderTypeId: 'exp-cy-cy', movementSeq: 2,
        axes: new Set(), rows: [
          mkRow({ id: 'r1', paymentTerm: 'CREDIT', billedTo: 'CUSTOMER', amount: 180 }),
        ],
      },
    ],
    ladenStorage: { freeDays: 7, mode: 'PER_DAY_SLAB',
      perDaySlabs: [
        { id: 'ls3-a', fromDay: 1,  toDay: 7,  ratePerDay:  60 },
        { id: 'ls3-b', fromDay: 8,  toDay: 14, ratePerDay: 120 },
        { id: 'ls3-c', fromDay: 15, toDay: 30, ratePerDay: 180 },
      ], fleetTeuBands: [] },
    emptyStorage: { freeDays: 21, mode: 'PER_DAY_SLAB',
      perDaySlabs: [
        { id: 'es3-a', fromDay: 1,  toDay: 7,  ratePerDay: 20 },
        { id: 'es3-b', fromDay: 8,  toDay: 14, ratePerDay: 40 },
        { id: 'es3-c', fromDay: 15, toDay: 60, ratePerDay: 60 },
      ], fleetTeuBands: [] },
    ptiRates:     { '20RF': 750, '40RF': 1000, '40HC-RF': 1100 },
    precoolRates: { '20RF': 500, '40RF': 700,  '40HC-RF': 750 },
    freeTime: {
      fullExport: { normal: 10, reefer: 7, dg: 2 },
      fullImport: { normal: 7,  reefer: 5, dg: 2 },
      emptyExport: { normal: 30, reefer: 14 },
      emptyImport: { normal: 30, reefer: 14 },
      waiveMtyDm: true,
    },
    activity: [
      { id: 'a1', who: 'NARONG',   what: 'VIP renewal triggered by 12-month volume',  when: '2026-02-15 09:00', icon: 'plus',  tone: 'primary' },
      { id: 'a2', who: 'CHAKRIYA', what: 'Approved as Sales Manager',                  when: '2026-02-22 10:30', icon: 'check', tone: 'success' },
      { id: 'a3', who: 'System',   what: 'Finance auto-approved (Δ 6.4% < 10%)',       when: '2026-02-22 10:31', icon: 'zap',   tone: 'info' },
      { id: 'a4', who: 'System',   what: 'Activated; effective from Mar 1',            when: '2026-03-01 00:00', icon: 'zap',   tone: 'success' },
    ],
  },

  'TP-2025-PUB': {
    id: 'TP-2025-PUB',
    name: 'Public Tariff 2025',
    type: 'PUBLIC',
    status: 'Expired',
    effective: '2025-01-01',
    expiry: '2025-12-31',
    salesPerson: 'YOKPORN',
    approver: 'CHAKRIYA',
    workflowId: 'wf-std-3step',
    workflowProgress: [
      { stepId: 's1', stepName: 'Sales draft',      approverLabel: 'Sales Rep',     status: 'approved', at: '2024-12-12', by: 'YOKPORN' },
      { stepId: 's2', stepName: 'Sales Manager',    approverLabel: 'Sales Manager', status: 'approved', at: '2024-12-16', by: 'CHAKRIYA' },
      { stepId: 's3', stepName: 'Finance sign-off', approverLabel: 'Finance Officer', status: 'approved', at: '2024-12-20', by: 'PRACHEE' },
    ],
    orderTypesInScope: ['exp-cy-cy', 'imp-cy-cy'],
    prices: [],
    ladenStorage: { freeDays: 3, mode: 'PER_DAY_SLAB',
      perDaySlabs: [
        { id: 'ls4-a', fromDay: 1,  toDay: 5,  ratePerDay:  70 },
        { id: 'ls4-b', fromDay: 6,  toDay: 10, ratePerDay: 140 },
        { id: 'ls4-c', fromDay: 11, toDay: 30, ratePerDay: 210 },
      ], fleetTeuBands: [] },
    emptyStorage: { freeDays: 14, mode: 'PER_DAY_SLAB',
      perDaySlabs: [
        { id: 'es4-a', fromDay: 1,  toDay: 5,  ratePerDay: 25 },
        { id: 'es4-b', fromDay: 6,  toDay: 10, ratePerDay: 50 },
        { id: 'es4-c', fromDay: 11, toDay: 60, ratePerDay: 80 },
      ], fleetTeuBands: [] },
    ptiRates:     { '20RF': 800, '40RF': 1100, '40HC-RF': 1200 },
    precoolRates: { '20RF': 550, '40RF': 750,  '40HC-RF': 800 },
    freeTime: {
      fullExport: { normal: 5, reefer: 3, dg: 1 },
      fullImport: { normal: 3, reefer: 2, dg: 1 },
      emptyExport: { normal: 14, reefer: 7 },
      emptyImport: { normal: 14, reefer: 7 },
      waiveMtyDm: false,
    },
    activity: [
      { id: 'a1', who: 'System', what: 'Expired automatically on Dec 31, 2025',     when: '2025-12-31 23:59', icon: 'clock', tone: 'warning' },
      { id: 'a2', who: 'System', what: 'Superseded by TP-2026-PUB',                  when: '2026-01-01 00:00', icon: 'arrowRight', tone: 'neutral' },
    ],
  },

  'TP-2026-C03': {
    id: 'TP-2026-C03',
    name: 'CP Foods Short-Term Deal',
    type: 'SPOT',
    status: 'Draft',
    shipper: { code: 'CPF', name: 'CP FOODS CO., LTD.' },
    effective: '2026-05-01',
    expiry: '2026-07-31',
    salesPerson: 'YOKPORN',
    approver: '',
    workflowId: 'wf-onestep-spot',
    workflowProgress: [
      { stepId: 's1', stepName: 'Sales Manager (direct)', approverLabel: 'Sales Manager', status: 'pending' },
    ],
    orderTypesInScope: ['exp-cy-cy'],
    prices: [
      { id: 'pc1', code: 'SA001', desc: 'Admission Fee', source: 'MOVEMENT', orderTypeId: 'exp-cy-cy', movementSeq: 2,
        axes: new Set(), rows: [
          mkRow({ id: 'r1', paymentTerm: 'CASH', billedTo: 'CUSTOMER', amount: 230, source: 'imported' }),
        ],
      },
    ],
    ladenStorage: { freeDays: 3, mode: 'PER_DAY_SLAB',
      perDaySlabs: [
        { id: 'ls5-a', fromDay: 1,  toDay: 5,  ratePerDay:  80 },
        { id: 'ls5-b', fromDay: 6,  toDay: 10, ratePerDay: 160 },
        { id: 'ls5-c', fromDay: 11, toDay: 30, ratePerDay: 240 },
      ], fleetTeuBands: [] },
    emptyStorage: { freeDays: 14, mode: 'PER_DAY_SLAB',
      perDaySlabs: [
        { id: 'es5-a', fromDay: 1,  toDay: 5,  ratePerDay: 30 },
        { id: 'es5-b', fromDay: 6,  toDay: 10, ratePerDay: 60 },
        { id: 'es5-c', fromDay: 11, toDay: 60, ratePerDay: 90 },
      ], fleetTeuBands: [] },
    ptiRates:     { '20RF': 850, '40RF': 1200, '40HC-RF': 1300 },
    precoolRates: { '20RF': 600, '40RF': 800,  '40HC-RF': 850 },
    freeTime: {
      fullExport: { normal: 4, reefer: 2, dg: 1 },
      fullImport: { normal: 3, reefer: 2, dg: 1 },
      emptyExport: { normal: 10, reefer: 5 },
      emptyImport: { normal: 10, reefer: 5 },
      waiveMtyDm: false,
    },
    activity: [
      { id: 'a1', who: 'YOKPORN', what: 'Drafted spot deal for 3-month Q2/Q3 surge', when: 'just now', icon: 'plus', tone: 'primary' },
    ],
  },
};

// Order-type display names — duplicated from the editor catalog. Future: import from a shared catalog.
export const ORDER_TYPE_LABELS: Record<string, { code: string; description: string; movements: { seq: number; code: string; name: string }[] }> = {
  'exp-cy-cy': { code: 'EXP CY/CY', description: 'Export CY at SCT/ECT', movements: [
    { seq: 1, code: 'EMTY DLVR', name: 'Empty Delivery (Gate-Out)' },
    { seq: 2, code: 'FCL RCVE',  name: 'Laden Gate-In (FCL Receive)' },
    { seq: 3, code: 'FCL DLVR',  name: 'Laden Gate-Out (Port Delivery)' },
  ]},
  'imp-cy-cy': { code: 'IMP CY/CY', description: 'Import CY to CY Delivery', movements: [
    { seq: 1, code: 'FCL RCVE',  name: 'Vessel Discharge / FCL Receive' },
    { seq: 2, code: 'FCL DLVR',  name: 'Laden Gate-Out (Consignee Delivery)' },
    { seq: 3, code: 'EMTY RCVE', name: 'Empty Gate-In (Return to Depot)' },
  ]},
  'imp-lolo': { code: 'IMP LOLO CR', description: 'Import Lo-Lo with Empty Return', movements: [
    { seq: 1, code: 'FCL RCVE',  name: 'Lo-Lo Vessel Discharge' },
    { seq: 2, code: 'FCL DLVR',  name: 'Laden Gate-Out' },
    { seq: 3, code: 'EMTY RCVE', name: 'Empty Gate-In (Return)' },
  ]},
};
