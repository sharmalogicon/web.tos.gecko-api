/**
 * Order Types catalog — single source of truth.
 * Consumers: masters/order-types page (config editor), bookings/* pages
 * (booking entry / detail), tariff/plans editor (rate scope), and any future
 * place that needs to know "what movements does EXP CY/CY define?".
 */

export type OrderTypePaymentTerm = 'CASH' | 'CREDIT';
export type OrderTypeBilledTo    = 'CUSTOMER' | 'AGENT' | 'FWD' | 'LINE' | 'CARRIER';

export interface OrderTypeCharge {
  id: string;
  code: string;
  description: string;
  paymentTerm: OrderTypePaymentTerm;
  billedTo: OrderTypeBilledTo;
  cargoCharge: boolean;
}

export interface OrderTypeVAS {
  id: string;
  code: string;
  description: string;
  paymentTerm: OrderTypePaymentTerm;
  paymentTo: OrderTypeBilledTo;
  loadAtGateInMTY: boolean;
}

export interface OrderTypeMovement {
  seq: number;
  code: string;
  name: string;
  releaseDM: boolean;
  grossWgt: boolean;
  sealNo: boolean;
  ediEnabled: boolean;
  ediMessages: string[];
  charges: OrderTypeCharge[];
  vasCharges: OrderTypeVAS[];
}

export interface OrderType {
  id: string;
  code: string;
  description: string;
  bookingType: 'EXPORT' | 'IMPORT' | 'TRANSSHIPMENT';
  bookingMode: 'FCL' | 'LCL' | 'RORO';
  status: 'Active' | 'Inactive';
  rules: {
    allowReleaseDamaged: boolean;
    checkMaxWeight: boolean;
    checkSealNumber: boolean;
    skipEDI: boolean;
  };
  movements: OrderTypeMovement[];
}

export const ORDER_TYPES_CATALOG: OrderType[] = [
  {
    id: 'exp-cy-cy', code: 'EXP CY/CY', description: 'Export CY at SCT/ECT',
    bookingType: 'EXPORT', bookingMode: 'FCL', status: 'Active',
    rules: { allowReleaseDamaged: false, checkMaxWeight: true, checkSealNumber: true, skipEDI: false },
    movements: [
      {
        seq: 1, code: 'EMTY DLVR', name: 'Empty Delivery (Gate-Out)',
        releaseDM: false, grossWgt: false, sealNo: false, ediEnabled: true,
        ediMessages: ['COPARN', 'CODECO'],
        charges: [
          { id: 'c1', code: 'SA001-CA', description: 'Admission Fee',  paymentTerm: 'CASH',   billedTo: 'CUSTOMER', cargoCharge: false },
          { id: 'c2', code: 'SA001-CR', description: 'Admission Fee',  paymentTerm: 'CREDIT', billedTo: 'AGENT',    cargoCharge: false },
          { id: 'c3', code: 'SA001-CR', description: 'Admission Fee',  paymentTerm: 'CREDIT', billedTo: 'FWD',      cargoCharge: false },
          { id: 'c4', code: 'SE001-CR', description: 'EDI Fee',        paymentTerm: 'CREDIT', billedTo: 'AGENT',    cargoCharge: false },
          { id: 'c5', code: 'SF001-CA', description: 'Service Fee',    paymentTerm: 'CASH',   billedTo: 'CUSTOMER', cargoCharge: false },
          { id: 'c6', code: 'SA001-CR', description: 'Admission Fee',  paymentTerm: 'CREDIT', billedTo: 'CUSTOMER', cargoCharge: false },
        ],
        vasCharges: [
          { id: 'v1', code: 'SA003-CR', description: 'Customs Fee',   paymentTerm: 'CREDIT', paymentTo: 'CUSTOMER', loadAtGateInMTY: false },
          { id: 'v2', code: 'SC009-CA', description: 'Scanning Fee',  paymentTerm: 'CASH',   paymentTo: 'CUSTOMER', loadAtGateInMTY: false },
          { id: 'v3', code: 'SE002-CA', description: 'Special Equip', paymentTerm: 'CASH',   paymentTo: 'CUSTOMER', loadAtGateInMTY: true  },
        ],
      },
      {
        seq: 2, code: 'FCL RCVE', name: 'Laden Gate-In (FCL Receive)',
        releaseDM: false, grossWgt: true, sealNo: true, ediEnabled: true,
        ediMessages: ['COPARN', 'CODECO', 'COARRI'],
        charges: [
          { id: 'c7',  code: 'SA001-CA', description: 'Admission Fee', paymentTerm: 'CASH',   billedTo: 'CUSTOMER', cargoCharge: true  },
          { id: 'c8',  code: 'SB001-CR', description: 'Storage Fee',   paymentTerm: 'CREDIT', billedTo: 'CUSTOMER', cargoCharge: false },
          { id: 'c9',  code: 'SC001-CA', description: 'Handling Fee',  paymentTerm: 'CASH',   billedTo: 'AGENT',    cargoCharge: true  },
          { id: 'c10', code: 'SD001-CR', description: 'Documentation', paymentTerm: 'CREDIT', billedTo: 'FWD',      cargoCharge: false },
        ],
        vasCharges: [
          { id: 'v4', code: 'SE002-CR', description: 'Special Equip', paymentTerm: 'CREDIT', paymentTo: 'AGENT',    loadAtGateInMTY: false },
          { id: 'v5', code: 'SE002-CR', description: 'Special Equip', paymentTerm: 'CREDIT', paymentTo: 'CUSTOMER', loadAtGateInMTY: false },
          { id: 'v6', code: 'SE002-CR', description: 'Special Equip', paymentTerm: 'CREDIT', paymentTo: 'FWD',      loadAtGateInMTY: false },
        ],
      },
      {
        seq: 3, code: 'FCL DLVR', name: 'Laden Gate-Out (Port Delivery)',
        releaseDM: false, grossWgt: false, sealNo: true, ediEnabled: true,
        ediMessages: ['CODECO', 'COARRI', 'BAPLIE'],
        charges: [
          { id: 'c11', code: 'SA001-CA', description: 'Admission Fee', paymentTerm: 'CASH',   billedTo: 'LINE',     cargoCharge: false },
          { id: 'c12', code: 'SB002-CR', description: 'Port Dues',     paymentTerm: 'CREDIT', billedTo: 'CARRIER',  cargoCharge: false },
          { id: 'c13', code: 'SC001-CA', description: 'Handling Fee',  paymentTerm: 'CASH',   billedTo: 'CUSTOMER', cargoCharge: true  },
          { id: 'c14', code: 'SE001-CR', description: 'EDI Fee',       paymentTerm: 'CREDIT', billedTo: 'AGENT',    cargoCharge: false },
          { id: 'c15', code: 'SL001-CA', description: 'Lashing Fee',   paymentTerm: 'CASH',   billedTo: 'LINE',     cargoCharge: false },
        ],
        vasCharges: [
          { id: 'v7', code: 'SA003-CR', description: 'Customs Fee', paymentTerm: 'CREDIT', paymentTo: 'CUSTOMER', loadAtGateInMTY: false },
          { id: 'v8', code: 'SX001-CA', description: 'Weighbridge',  paymentTerm: 'CASH',   paymentTo: 'CUSTOMER', loadAtGateInMTY: false },
        ],
      },
    ],
  },
  {
    id: 'imp-cy-cy', code: 'IMP CY/CY', description: 'Import CY to CY Delivery',
    bookingType: 'IMPORT', bookingMode: 'FCL', status: 'Active',
    rules: { allowReleaseDamaged: false, checkMaxWeight: false, checkSealNumber: true, skipEDI: false },
    movements: [
      {
        seq: 1, code: 'FCL RCVE', name: 'Vessel Discharge / FCL Receive',
        releaseDM: false, grossWgt: true, sealNo: true, ediEnabled: true,
        ediMessages: ['BAPLIE', 'COARRI'],
        charges: [
          { id: 'i1', code: 'SA001-CA', description: 'Admission Fee', paymentTerm: 'CASH',   billedTo: 'LINE',     cargoCharge: false },
          { id: 'i2', code: 'SB001-CR', description: 'Storage Fee',   paymentTerm: 'CREDIT', billedTo: 'CUSTOMER', cargoCharge: true  },
          { id: 'i3', code: 'SC001-CA', description: 'Handling Fee',  paymentTerm: 'CASH',   billedTo: 'LINE',     cargoCharge: false },
        ],
        vasCharges: [
          { id: 'iv1', code: 'SA003-CR', description: 'Customs Fee', paymentTerm: 'CREDIT', paymentTo: 'CUSTOMER', loadAtGateInMTY: false },
        ],
      },
      {
        seq: 2, code: 'FCL DLVR', name: 'Laden Gate-Out (Consignee Delivery)',
        releaseDM: false, grossWgt: false, sealNo: false, ediEnabled: true,
        ediMessages: ['CODECO', 'IFTMCS'],
        charges: [
          { id: 'i4', code: 'SA001-CA', description: 'Admission Fee', paymentTerm: 'CASH',   billedTo: 'CUSTOMER', cargoCharge: false },
          { id: 'i5', code: 'SB001-CR', description: 'Dwell Charge',  paymentTerm: 'CREDIT', billedTo: 'CUSTOMER', cargoCharge: true  },
          { id: 'i6', code: 'SD001-CR', description: 'Documentation', paymentTerm: 'CREDIT', billedTo: 'AGENT',    cargoCharge: false },
        ],
        vasCharges: [
          { id: 'iv2', code: 'SE002-CA', description: 'Special Equip', paymentTerm: 'CASH', paymentTo: 'CUSTOMER', loadAtGateInMTY: false },
        ],
      },
      {
        seq: 3, code: 'EMTY RCVE', name: 'Empty Gate-In (Return to Depot)',
        releaseDM: true, grossWgt: false, sealNo: false, ediEnabled: false,
        ediMessages: ['CODECO'],
        charges: [
          { id: 'i7', code: 'SA001-CA', description: 'Admission Fee',  paymentTerm: 'CASH', billedTo: 'LINE', cargoCharge: false },
          { id: 'i8', code: 'SC002-CA', description: 'Inspection Fee', paymentTerm: 'CASH', billedTo: 'LINE', cargoCharge: false },
        ],
        vasCharges: [],
      },
    ],
  },
  {
    id: 'exp-cfs', code: 'EXP CFS', description: 'Export CFS Consolidation',
    bookingType: 'EXPORT', bookingMode: 'LCL', status: 'Active',
    rules: { allowReleaseDamaged: false, checkMaxWeight: true, checkSealNumber: false, skipEDI: false },
    movements: [
      {
        seq: 1, code: 'CFS RCVE', name: 'CFS Cargo In-Receipt',
        releaseDM: false, grossWgt: true, sealNo: false, ediEnabled: false, ediMessages: [],
        charges: [
          { id: 'e1', code: 'SA001-CA', description: 'Admission Fee', paymentTerm: 'CASH',   billedTo: 'CUSTOMER', cargoCharge: true },
          { id: 'e2', code: 'SB003-CR', description: 'Warehouse Fee', paymentTerm: 'CREDIT', billedTo: 'CUSTOMER', cargoCharge: true },
        ],
        vasCharges: [
          { id: 'ev1', code: 'SH001-CA', description: 'Hazmat Surcharge', paymentTerm: 'CASH', paymentTo: 'CUSTOMER', loadAtGateInMTY: false },
        ],
      },
      {
        seq: 2, code: 'CFS STUFF', name: 'CFS Consolidation / Stuffing',
        releaseDM: false, grossWgt: true, sealNo: true, ediEnabled: false, ediMessages: [],
        charges: [
          { id: 'e3', code: 'SC003-CA', description: 'Stuffing Fee',  paymentTerm: 'CASH',   billedTo: 'CUSTOMER', cargoCharge: true  },
          { id: 'e4', code: 'SD002-CR', description: 'Documentation', paymentTerm: 'CREDIT', billedTo: 'FWD',      cargoCharge: false },
        ],
        vasCharges: [],
      },
      {
        seq: 3, code: 'FCL DLVR', name: 'Laden Gate-Out (Port Delivery)',
        releaseDM: false, grossWgt: false, sealNo: true, ediEnabled: true,
        ediMessages: ['CODECO', 'COARRI'],
        charges: [
          { id: 'e5', code: 'SA001-CA', description: 'Admission Fee', paymentTerm: 'CASH',   billedTo: 'LINE',    cargoCharge: false },
          { id: 'e6', code: 'SB002-CR', description: 'Port Dues',     paymentTerm: 'CREDIT', billedTo: 'CARRIER', cargoCharge: false },
          { id: 'e7', code: 'SL001-CA', description: 'Lashing Fee',   paymentTerm: 'CASH',   billedTo: 'LINE',    cargoCharge: false },
        ],
        vasCharges: [
          { id: 'ev2', code: 'SX001-CA', description: 'Weighbridge', paymentTerm: 'CASH', paymentTo: 'CUSTOMER', loadAtGateInMTY: false },
        ],
      },
    ],
  },
  {
    id: 'ts-fcl', code: 'TRANS-SHIP', description: 'Transshipment FCL',
    bookingType: 'TRANSSHIPMENT', bookingMode: 'FCL', status: 'Active',
    rules: { allowReleaseDamaged: false, checkMaxWeight: false, checkSealNumber: true, skipEDI: false },
    movements: [
      {
        seq: 1, code: 'FCL RCVE', name: 'Feeder Vessel Discharge',
        releaseDM: false, grossWgt: false, sealNo: true, ediEnabled: true,
        ediMessages: ['BAPLIE', 'COARRI'],
        charges: [{ id: 't1', code: 'SA001-CA', description: 'Admission Fee', paymentTerm: 'CASH', billedTo: 'CARRIER', cargoCharge: false }],
        vasCharges: [],
      },
      {
        seq: 2, code: 'YD REHDL', name: 'Yard Rehandle / Shunting',
        releaseDM: false, grossWgt: false, sealNo: false, ediEnabled: false, ediMessages: [],
        charges: [{ id: 't2', code: 'SM001-CA', description: 'Move Fee', paymentTerm: 'CASH', billedTo: 'CARRIER', cargoCharge: false }],
        vasCharges: [],
      },
      {
        seq: 3, code: 'FCL DLVR', name: 'Mother Vessel Load (Gate-Out)',
        releaseDM: false, grossWgt: false, sealNo: true, ediEnabled: true,
        ediMessages: ['BAPLIE', 'CODECO'],
        charges: [
          { id: 't3', code: 'SA001-CA', description: 'Admission Fee', paymentTerm: 'CASH', billedTo: 'CARRIER', cargoCharge: false },
          { id: 't4', code: 'SL001-CA', description: 'Lashing Fee',   paymentTerm: 'CASH', billedTo: 'LINE',    cargoCharge: false },
        ],
        vasCharges: [],
      },
    ],
  },
  {
    id: 'blind-gate', code: 'BLIND GATE IN', description: 'Blind Gate-In (No Booking)',
    bookingType: 'IMPORT', bookingMode: 'FCL', status: 'Active',
    rules: { allowReleaseDamaged: true, checkMaxWeight: false, checkSealNumber: false, skipEDI: true },
    movements: [
      {
        seq: 1, code: 'FCL RCVE', name: 'FCL Receive (Blind / No Pre-Advice)',
        releaseDM: true, grossWgt: true, sealNo: false, ediEnabled: false, ediMessages: [],
        charges: [
          { id: 'b1', code: 'SA001-CA', description: 'Admission Fee', paymentTerm: 'CASH', billedTo: 'CUSTOMER', cargoCharge: false },
          { id: 'b2', code: 'SG001-CA', description: 'Blind Fee',     paymentTerm: 'CASH', billedTo: 'CUSTOMER', cargoCharge: false },
        ],
        vasCharges: [],
      },
    ],
  },
  {
    id: 'repo-out', code: 'REPO OUT', description: 'Empty Repositioning Out',
    bookingType: 'EXPORT', bookingMode: 'FCL', status: 'Active',
    rules: { allowReleaseDamaged: true, checkMaxWeight: false, checkSealNumber: false, skipEDI: false },
    movements: [
      {
        seq: 1, code: 'EMTY DLVR', name: 'Empty Repositioning (Gate-Out)',
        releaseDM: true, grossWgt: false, sealNo: false, ediEnabled: true,
        ediMessages: ['CODECO'],
        charges: [
          { id: 'r1', code: 'SA001-CA', description: 'Admission Fee',     paymentTerm: 'CASH', billedTo: 'LINE', cargoCharge: false },
          { id: 'r2', code: 'SR001-CA', description: 'Repositioning Fee', paymentTerm: 'CASH', billedTo: 'LINE', cargoCharge: false },
        ],
        vasCharges: [],
      },
    ],
  },
  {
    id: 'imp-lolo', code: 'IMP LOLO CR', description: 'Import Lo-Lo with Empty Return',
    bookingType: 'IMPORT', bookingMode: 'FCL', status: 'Active',
    rules: { allowReleaseDamaged: false, checkMaxWeight: true, checkSealNumber: true, skipEDI: false },
    movements: [
      {
        seq: 1, code: 'FCL RCVE', name: 'Lo-Lo Vessel Discharge',
        releaseDM: false, grossWgt: true, sealNo: true, ediEnabled: true,
        ediMessages: ['BAPLIE', 'COARRI'],
        charges: [
          { id: 'l1', code: 'SA001-CA', description: 'Admission Fee', paymentTerm: 'CASH',   billedTo: 'LINE',     cargoCharge: false },
          { id: 'l2', code: 'SC001-CA', description: 'Handling Fee',  paymentTerm: 'CASH',   billedTo: 'LINE',     cargoCharge: false },
          { id: 'l3', code: 'SB001-CR', description: 'Storage Fee',   paymentTerm: 'CREDIT', billedTo: 'CUSTOMER', cargoCharge: true  },
        ],
        vasCharges: [{ id: 'lv1', code: 'SA003-CR', description: 'Customs Fee', paymentTerm: 'CREDIT', paymentTo: 'CUSTOMER', loadAtGateInMTY: false }],
      },
      {
        seq: 2, code: 'FCL DLVR', name: 'Laden Gate-Out (Consignee Delivery)',
        releaseDM: false, grossWgt: false, sealNo: false, ediEnabled: true,
        ediMessages: ['CODECO', 'IFTMCS'],
        charges: [
          { id: 'l4', code: 'SA001-CA', description: 'Admission Fee', paymentTerm: 'CASH',   billedTo: 'CUSTOMER', cargoCharge: false },
          { id: 'l5', code: 'SB001-CR', description: 'Dwell Charge',  paymentTerm: 'CREDIT', billedTo: 'CUSTOMER', cargoCharge: true  },
        ],
        vasCharges: [],
      },
      {
        seq: 3, code: 'EMTY RCVE', name: 'Empty Gate-In (Return to Depot)',
        releaseDM: true, grossWgt: false, sealNo: false, ediEnabled: false,
        ediMessages: ['CODECO'],
        charges: [
          { id: 'l6', code: 'SA001-CA', description: 'Admission Fee',  paymentTerm: 'CASH', billedTo: 'LINE', cargoCharge: false },
          { id: 'l7', code: 'SC002-CA', description: 'Inspection Fee', paymentTerm: 'CASH', billedTo: 'LINE', cargoCharge: false },
        ],
        vasCharges: [],
      },
    ],
  },
];

/** Lookup by id (e.g. `exp-cy-cy`) or by code (e.g. `EXP CY/CY`). */
export function getOrderType(idOrCode: string): OrderType | undefined {
  return ORDER_TYPES_CATALOG.find(o => o.id === idOrCode || o.code === idOrCode);
}

/** All active order types — what a booking dropdown should show. */
export const ACTIVE_ORDER_TYPES = ORDER_TYPES_CATALOG.filter(o => o.status === 'Active');
