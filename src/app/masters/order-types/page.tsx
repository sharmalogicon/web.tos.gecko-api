"use client";
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { usePagination, TablePagination } from '@/components/ui/TablePagination';

// ── Keyframe animations injected into document ─────────────────────────────
const ANIM_CSS = `
@keyframes geckoFlowRight {
  0%   { left: -30%; opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { left: 115%; opacity: 0; }
}
@keyframes geckoSlideUp {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

// ── Types ─────────────────────────────────────────────────────────────────────
type PaymentTerm = 'CASH' | 'CREDIT';
type BilledTo = 'CUSTOMER' | 'AGENT' | 'FWD' | 'LINE' | 'CARRIER';

interface Charge {
  id: string; code: string; description: string;
  paymentTerm: PaymentTerm; billedTo: BilledTo; cargoCharge: boolean;
}
interface VASCharge {
  id: string; code: string; description: string;
  paymentTerm: PaymentTerm; paymentTo: BilledTo; loadAtGateInMTY: boolean;
}
interface Movement {
  seq: number; code: string; name: string;
  releaseDM: boolean; grossWgt: boolean; sealNo: boolean;
  ediEnabled: boolean; ediMessages: string[];
  charges: Charge[]; vasCharges: VASCharge[];
}
interface OrderType {
  id: string; code: string; description: string;
  bookingType: 'EXPORT' | 'IMPORT' | 'TRANSSHIPMENT';
  bookingMode: 'FCL' | 'LCL' | 'RORO';
  status: 'Active' | 'Inactive';
  rules: { allowReleaseDamaged: boolean; checkMaxWeight: boolean; checkSealNumber: boolean; skipEDI: boolean };
  movements: Movement[];
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const EDI_COLORS: Record<string, { bg: string; text: string }> = {
  COPARN: { bg: '#EDE9FE', text: '#6D28D9' },
  CODECO: { bg: '#DBEAFE', text: '#1D4ED8' },
  COARRI: { bg: '#D1FAE5', text: '#065F46' },
  BAPLIE: { bg: '#FEF3C7', text: '#92400E' },
  IFTMCS: { bg: '#F3F4F6', text: '#374151' },
};
const SEQ_COLORS = [
  { bg: '#2563EB', light: '#EFF6FF', border: '#BFDBFE' },
  { bg: '#16A34A', light: '#F0FDF4', border: '#BBF7D0' },
  { bg: '#D97706', light: '#FFFBEB', border: '#FDE68A' },
  { bg: '#7C3AED', light: '#F5F3FF', border: '#DDD6FE' },
  { bg: '#DC2626', light: '#FEF2F2', border: '#FECACA' },
];
const BTYPE: Record<string, { bg: string; text: string; label: string }> = {
  EXPORT:        { bg: '#D1FAE5', text: '#065F46', label: 'EXP' },
  IMPORT:        { bg: '#DBEAFE', text: '#1D4ED8', label: 'IMP' },
  TRANSSHIPMENT: { bg: '#FEF3C7', text: '#92400E', label: 'T/S' },
};
const MOVE_ICON: Record<string, string> = {
  // Gate
  'EMTY DLVR':  'truck',
  'FCL RCVE':   'download',
  'FCL DLVR':   'upload',
  'EMTY RCVE':  'arrowDown',
  // Vessel
  'VSSL DISCH': 'anchor',
  'VSSL LOAD':  'anchor',
  'SHFT':       'move',
  // Rail / IWT
  'RAIL RCVE':  'download',
  'RAIL DLVR':  'upload',
  // Transfer
  'XFER IN':    'arrowDown',
  'XFER OUT':   'upload',
  // CFS
  'CFS RCVE':   'box',
  'CFS STUFF':  'layers',
  'CFS STRIP':  'layers',
  // Yard
  'YD REHDL':   'move',
  // Customs
  'X-RAY':      'search',
  'CUST EXAM':  'search',
  'CUST SEAL':  'tag',
  // Compliance
  'VGM CHK':    'activity',
  'DG INSPT':   'alertTriangle',
  // Reefer
  'PTI':        'check',
  'REEF PLUG':  'activity',
  'REEF UNPG':  'activity',
  // Depot / M&R
  'DEPOT REPR': 'edit',
  'DEPOT WASH': 'layers',
  'DEGASSING':  'send',
  // Special
  'OOG HNDL':   'layers',
};

// ── Mock data ─────────────────────────────────────────────────────────────────
const ORDER_TYPES: OrderType[] = [
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

// ── Flow Connector ────────────────────────────────────────────────────────────
function FlowConnector({ idx }: { idx: number }) {
  const c1 = SEQ_COLORS[idx % SEQ_COLORS.length];
  const c2 = SEQ_COLORS[(idx + 1) % SEQ_COLORS.length];
  return (
    <div style={{ flex: '0 0 64px', position: 'relative', display: 'flex', alignItems: 'center', alignSelf: 'center', height: 40 }}>
      {/* Track */}
      <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'var(--gecko-border)', borderRadius: 1 }} />
      {/* Particle A */}
      <div style={{
        position: 'absolute', width: '38%', height: 3, borderRadius: 2,
        background: `linear-gradient(90deg, transparent, ${c1.bg})`,
        animation: 'geckoFlowRight 1.8s ease-in-out infinite',
        animationDelay: '0s',
      }} />
      {/* Particle B */}
      <div style={{
        position: 'absolute', width: '28%', height: 3, borderRadius: 2,
        background: `linear-gradient(90deg, transparent, ${c2.bg})`,
        animation: 'geckoFlowRight 1.8s ease-in-out infinite',
        animationDelay: '0.9s',
      }} />
      {/* Arrow head */}
      <div style={{
        position: 'absolute', right: -1,
        width: 0, height: 0,
        borderTop: '5px solid transparent',
        borderBottom: '5px solid transparent',
        borderLeft: '8px solid var(--gecko-border)',
      }} />
    </div>
  );
}

// ── Movement Node ─────────────────────────────────────────────────────────────
function MovementNode({ movement, isSelected, onClick }: {
  movement: Movement; isSelected: boolean; onClick: () => void;
}) {
  const col = SEQ_COLORS[(movement.seq - 1) % SEQ_COLORS.length];
  const icon = MOVE_ICON[movement.code] ?? 'activity';

  return (
    <div
      onClick={onClick}
      style={{
        width: 192, flexShrink: 0, cursor: 'pointer', overflow: 'hidden',
        borderRadius: 14, border: `2px solid ${isSelected ? col.bg : 'var(--gecko-border)'}`,
        background: isSelected ? col.light : 'var(--gecko-bg-surface)',
        transition: 'all 160ms ease',
        boxShadow: isSelected
          ? `0 0 0 4px ${col.bg}1A, 0 8px 24px ${col.bg}18`
          : '0 1px 3px rgba(0,0,0,0.07)',
        userSelect: 'none',
      }}
      onMouseEnter={e => {
        if (!isSelected) {
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
          (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)';
        }
      }}
      onMouseLeave={e => {
        if (!isSelected) {
          (e.currentTarget as HTMLElement).style.transform = '';
          (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.07)';
        }
      }}
    >
      {/* Color accent bar */}
      <div style={{ height: 4, background: col.bg }} />

      {/* Seq + EDI flag */}
      <div style={{ padding: '12px 14px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, fontSize: 14, fontWeight: 800,
          background: col.bg, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {movement.seq}
        </div>
        {movement.ediEnabled && (
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', padding: '2px 6px', borderRadius: 4, background: '#DBEAFE', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>
            EDI
          </span>
        )}
      </div>

      {/* Icon + code + name */}
      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, border: `1.5px solid ${col.border}`, background: col.light, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={15} style={{ color: col.bg }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 11, fontWeight: 800, color: 'var(--gecko-text-primary)', lineHeight: 1.2 }}>{movement.code}</div>
          <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', marginTop: 2, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{movement.name}</div>
        </div>
      </div>

      {/* EDI pills */}
      {movement.ediMessages.length > 0 && (
        <div style={{ padding: '0 14px', display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
          {movement.ediMessages.slice(0, 3).map(msg => {
            const ec = EDI_COLORS[msg] ?? { bg: '#F3F4F6', text: '#374151' };
            return (
              <span key={msg} style={{ fontSize: 8, fontWeight: 700, padding: '2px 5px', borderRadius: 3, background: ec.bg, color: ec.text, letterSpacing: '0.03em' }}>
                {msg}
              </span>
            );
          })}
        </div>
      )}

      {/* Footer: charge counts */}
      <div style={{ padding: '8px 14px 12px', borderTop: '1px solid var(--gecko-border)', display: 'flex', gap: 12, marginTop: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: isSelected ? col.bg : 'var(--gecko-text-secondary)' }}>
          <Icon name="fileText" size={10} />
          {movement.charges.length} charges
        </div>
        {movement.vasCharges.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: isSelected ? col.bg : 'var(--gecko-text-secondary)' }}>
            <Icon name="tag" size={10} />
            {movement.vasCharges.length} VAS
          </div>
        )}
      </div>
    </div>
  );
}

// ── Charges Panel ─────────────────────────────────────────────────────────────
function ChargesPanel({ movement, applicableCharges, applicableVAS, onToggleCharge, onToggleVAS }: {
  movement: Movement;
  applicableCharges: Set<string>;
  applicableVAS: Set<string>;
  onToggleCharge: (id: string) => void;
  onToggleVAS: (id: string) => void;
}) {
  const col = SEQ_COLORS[(movement.seq - 1) % SEQ_COLORS.length];

  const PTBadge = ({ term }: { term: PaymentTerm }) => (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
      background: term === 'CASH' ? '#D1FAE5' : '#DBEAFE',
      color: term === 'CASH' ? '#065F46' : '#1D4ED8',
    }}>{term}</span>
  );

  const ToBadge = ({ to }: { to: string }) => (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
      background: 'var(--gecko-bg-subtle)', color: 'var(--gecko-text-secondary)',
      border: '1px solid var(--gecko-border)',
    }}>{to}</span>
  );

  const ColHeader = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {children}
    </div>
  );

  return (
    <div style={{
      animation: 'geckoSlideUp 220ms ease',
      background: 'var(--gecko-bg-surface)',
      border: '1px solid var(--gecko-border)',
      borderRadius: 14, overflow: 'hidden',
      boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
    }}>
      {/* Panel header */}
      <div style={{
        padding: '14px 20px', background: col.light,
        borderBottom: `2px solid ${col.bg}33`,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: col.bg, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 800, flexShrink: 0,
        }}>
          {movement.seq}
        </div>
        <div>
          <div style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 15, fontWeight: 800, color: col.bg }}>{movement.code}</div>
          <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', marginTop: 1 }}>{movement.name} — Charge &amp; VAS Configuration</div>
        </div>
        {/* Movement flags */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {movement.releaseDM  && <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: '#FEF3C7', color: '#92400E' }}>Release DM</span>}
          {movement.grossWgt   && <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: '#EDE9FE', color: '#6D28D9' }}>Gross Wgt</span>}
          {movement.sealNo     && <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: '#D1FAE5', color: '#065F46' }}>Seal No</span>}
          {movement.ediEnabled && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {movement.ediMessages.map(msg => {
                const ec = EDI_COLORS[msg] ?? { bg: '#F3F4F6', text: '#374151' };
                return <span key={msg} style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: ec.bg, color: ec.text }}>{msg}</span>;
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>

        {/* Regular Charges */}
        <div style={{ padding: '18px 20px', borderRight: '1px solid var(--gecko-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="fileText" size={14} style={{ color: col.bg }} />
              Regular Charges
            </div>
            <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>
              {movement.charges.filter(c => applicableCharges.has(c.id)).length} / {movement.charges.length} active
            </span>
          </div>

          {movement.charges.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--gecko-text-disabled)', textAlign: 'center', padding: '24px 0' }}>No charges configured</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '22px 1fr 72px 90px 36px', gap: 8, padding: '5px 8px', background: 'var(--gecko-bg-subtle)', borderRadius: 6, marginBottom: 4, alignItems: 'center' }}>
                <div />
                <ColHeader>Charge Code</ColHeader>
                <ColHeader>Payment</ColHeader>
                <ColHeader>Billed To</ColHeader>
                <ColHeader>Cargo</ColHeader>
              </div>
              {movement.charges.map(c => {
                const on = applicableCharges.has(c.id);
                return (
                  <div
                    key={c.id}
                    onClick={() => onToggleCharge(c.id)}
                    style={{
                      display: 'grid', gridTemplateColumns: '22px 1fr 72px 90px 36px', gap: 8,
                      padding: '9px 8px', borderRadius: 8, cursor: 'pointer', alignItems: 'center',
                      background: on ? col.light : 'transparent',
                      border: `1px solid ${on ? col.border : 'transparent'}`,
                      transition: 'all 120ms',
                    }}
                  >
                    <input type="checkbox" className="gecko-checkbox" checked={on} onChange={() => onToggleCharge(c.id)} onClick={e => e.stopPropagation()} style={{ margin: 0 }} />
                    <div>
                      <div style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 11, fontWeight: 700, color: on ? col.bg : 'var(--gecko-text-primary)' }}>{c.code}</div>
                      <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)' }}>{c.description}</div>
                    </div>
                    <PTBadge term={c.paymentTerm} />
                    <ToBadge to={c.billedTo} />
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      {c.cargoCharge && <Icon name="check" size={12} style={{ color: col.bg }} />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* VAS Charges */}
        <div style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="tag" size={14} style={{ color: 'var(--gecko-accent-600)' }} />
              VAS Charges
            </div>
            <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>
              {movement.vasCharges.filter(v => applicableVAS.has(v.id)).length} / {movement.vasCharges.length} active
            </span>
          </div>

          {movement.vasCharges.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--gecko-text-disabled)', textAlign: 'center', padding: '24px 0' }}>
              No VAS charges for this movement
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '22px 1fr 72px 90px 50px', gap: 8, padding: '5px 8px', background: 'var(--gecko-bg-subtle)', borderRadius: 6, marginBottom: 4, alignItems: 'center' }}>
                <div />
                <ColHeader>VAS Code</ColHeader>
                <ColHeader>Payment</ColHeader>
                <ColHeader>Pay To</ColHeader>
                <ColHeader>In-MTY</ColHeader>
              </div>
              {movement.vasCharges.map(v => {
                const on = applicableVAS.has(v.id);
                return (
                  <div
                    key={v.id}
                    onClick={() => onToggleVAS(v.id)}
                    style={{
                      display: 'grid', gridTemplateColumns: '22px 1fr 72px 90px 50px', gap: 8,
                      padding: '9px 8px', borderRadius: 8, cursor: 'pointer', alignItems: 'center',
                      background: on ? '#FFF7ED' : 'transparent',
                      border: `1px solid ${on ? '#FED7AA' : 'transparent'}`,
                      transition: 'all 120ms',
                    }}
                  >
                    <input type="checkbox" className="gecko-checkbox" checked={on} onChange={() => onToggleVAS(v.id)} onClick={e => e.stopPropagation()} style={{ margin: 0 }} />
                    <div>
                      <div style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 11, fontWeight: 700, color: on ? 'var(--gecko-accent-700)' : 'var(--gecko-text-primary)' }}>{v.code}</div>
                      <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)' }}>{v.description}</div>
                    </div>
                    <PTBadge term={v.paymentTerm} />
                    <ToBadge to={v.paymentTo} />
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      {v.loadAtGateInMTY && <Icon name="check" size={12} style={{ color: 'var(--gecko-accent-600)' }} />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OrderTypeMasterPage() {
  const [selected, setSelected] = useState<OrderType>(ORDER_TYPES[0]);
  const [selectedSeq, setSelectedSeq] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  // All charges start as applicable
  const [applicableCharges, setApplicableCharges] = useState<Set<string>>(() => {
    const s = new Set<string>();
    ORDER_TYPES.forEach(ot => ot.movements.forEach(m => m.charges.forEach(c => s.add(c.id))));
    return s;
  });
  const [applicableVAS, setApplicableVAS] = useState<Set<string>>(() => {
    const s = new Set<string>();
    ORDER_TYPES.forEach(ot => ot.movements.forEach(m => m.vasCharges.forEach(v => s.add(v.id))));
    return s;
  });

  const filtered = useMemo(() => ORDER_TYPES.filter(ot =>
    !search || ot.code.toLowerCase().includes(search.toLowerCase()) || ot.description.toLowerCase().includes(search.toLowerCase())
  ), [search]);

  const { page, setPage, pageSize, setPageSize, totalPages, pageItems, totalItems, startRow, endRow } = usePagination(filtered);

  const activeMovement = selectedSeq !== null ? selected.movements.find(m => m.seq === selectedSeq) ?? null : null;
  const bt = BTYPE[selected.bookingType];

  const toggleCharge = (id: string) => setApplicableCharges(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleVAS    = (id: string) => setApplicableVAS(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>
      <style>{ANIM_CSS}</style>

      {/* Page header */}
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--gecko-text-primary)' }}>Work Order Types</h1>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>
            Configure order types, movement sequences, and associated charges per leg
          </div>
        </div>
        <div className="gecko-toolbar">
          <button className="gecko-btn gecko-btn-ghost gecko-btn-sm"><Icon name="download" size={15} /> Export</button>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm"><Icon name="edit" size={15} /> Edit</button>
          <Link href="/masters/order-types/new" className="gecko-btn gecko-btn-primary gecko-btn-sm"><Icon name="plus" size={15} /> New Work Order Type</Link>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* LEFT: Order type list */}
        <div style={{ width: 244, flexShrink: 0, background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 12, overflow: 'hidden', position: 'sticky', top: 80 }}>
          <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--gecko-border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gecko-text-secondary)', marginBottom: 10 }}>
              Work Order Types ({ORDER_TYPES.length})
            </div>
            <div style={{ position: 'relative' }}>
              <Icon name="search" size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-text-disabled)', pointerEvents: 'none' }} />
              <input
                className="gecko-input gecko-input-sm"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 28 }}
              />
            </div>
          </div>
          <div style={{ maxHeight: 540, overflowY: 'auto' }}>
            {pageItems.map(ot => {
              const b = BTYPE[ot.bookingType];
              const active = ot.id === selected.id;
              return (
                <button
                  key={ot.id}
                  onClick={() => { setSelected(ot); setSelectedSeq(null); }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 14px',
                    background: active ? 'var(--gecko-primary-50)' : 'transparent',
                    border: 'none', fontFamily: 'inherit', cursor: 'pointer',
                    borderLeft: `3px solid ${active ? 'var(--gecko-primary-600)' : 'transparent'}`,
                    transition: 'all 100ms',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 12, fontWeight: 700, color: active ? 'var(--gecko-primary-700)' : 'var(--gecko-text-primary)' }}>
                      {ot.code}
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1.5px 5px', borderRadius: 3, background: b.bg, color: b.text, flexShrink: 0 }}>
                      {b.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', marginTop: 2, lineHeight: 1.3 }}>{ot.description}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                    <span style={{ fontSize: 9, color: 'var(--gecko-text-disabled)', fontWeight: 500 }}>{ot.bookingMode}</span>
                    <span style={{ fontSize: 9, color: 'var(--gecko-text-disabled)' }}>·</span>
                    <span style={{ fontSize: 9, color: 'var(--gecko-text-disabled)' }}>{ot.movements.length} move{ot.movements.length !== 1 ? 's' : ''}</span>
                    <div style={{ marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%', background: ot.status === 'Active' ? 'var(--gecko-success-500)' : 'var(--gecko-gray-300)' }} />
                  </div>
                </button>
              );
            })}
          </div>
          <TablePagination
            page={page}
            pageSize={pageSize}
            totalItems={totalItems}
            totalPages={totalPages}
            startRow={startRow}
            endRow={endRow}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            noun="order types"
          />
        </div>

        {/* RIGHT: Detail area */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Order type header */}
          <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--gecko-font-mono)', fontSize: 20, fontWeight: 800, color: 'var(--gecko-text-primary)' }}>{selected.code}</h2>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: bt.bg, color: bt.text }}>{selected.bookingType}</span>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: 'var(--gecko-bg-subtle)', color: 'var(--gecko-text-secondary)', border: '1px solid var(--gecko-border)' }}>{selected.bookingMode}</span>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: selected.status === 'Active' ? 'var(--gecko-success-500)' : 'var(--gecko-gray-400)' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: selected.status === 'Active' ? 'var(--gecko-success-700)' : 'var(--gecko-text-secondary)' }}>{selected.status}</span>
              </div>
            </div>
            <div style={{ fontSize: 14, color: 'var(--gecko-text-secondary)', marginBottom: 14 }}>{selected.description}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', marginRight: 2 }}>Rules:</span>
              {[
                { label: 'Release Damaged', val: selected.rules.allowReleaseDamaged },
                { label: 'Check Max Weight', val: selected.rules.checkMaxWeight },
                { label: 'Check Seal No',    val: selected.rules.checkSealNumber },
                { label: 'Skip EDI',         val: selected.rules.skipEDI },
              ].map(r => (
                <span key={r.label} style={{
                  fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                  background: r.val ? 'var(--gecko-success-50)' : 'var(--gecko-bg-subtle)',
                  color: r.val ? 'var(--gecko-success-700)' : 'var(--gecko-text-disabled)',
                  border: `1px solid ${r.val ? 'var(--gecko-success-200)' : 'var(--gecko-border)'}`,
                }}>
                  {r.val ? '✓' : '○'} {r.label}
                </span>
              ))}
            </div>
          </div>

          {/* Workflow canvas */}
          <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--gecko-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="activity" size={16} style={{ color: 'var(--gecko-primary-600)' }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>Movement Workflow</span>
              <span style={{ fontSize: 12, color: 'var(--gecko-text-secondary)' }}>
                — {selected.movements.length} movement leg{selected.movements.length !== 1 ? 's' : ''}
              </span>
              {selectedSeq !== null && (
                <button
                  onClick={() => setSelectedSeq(null)}
                  style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--gecko-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}
                >
                  <Icon name="xCircle" size={13} /> Clear selection
                </button>
              )}
            </div>

            <div style={{ padding: '28px 28px 24px', overflowX: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', minWidth: 'max-content' }}>
                {selected.movements.map((mov, idx) => (
                  <React.Fragment key={mov.seq}>
                    <MovementNode
                      movement={mov}
                      isSelected={selectedSeq === mov.seq}
                      onClick={() => setSelectedSeq(selectedSeq === mov.seq ? null : mov.seq)}
                    />
                    {idx < selected.movements.length - 1 && <FlowConnector idx={idx} />}
                  </React.Fragment>
                ))}
              </div>

              {selectedSeq === null && (
                <div style={{ marginTop: 20, fontSize: 12, color: 'var(--gecko-text-disabled)', fontStyle: 'italic', textAlign: 'center' }}>
                  ↑ Click a movement node to view and configure its charges
                </div>
              )}
            </div>
          </div>

          {/* Charges panel — slides in when a node is selected */}
          {activeMovement && (
            <ChargesPanel
              movement={activeMovement}
              applicableCharges={applicableCharges}
              applicableVAS={applicableVAS}
              onToggleCharge={toggleCharge}
              onToggleVAS={toggleVAS}
            />
          )}
        </div>
      </div>
    </div>
  );
}
