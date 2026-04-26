"use client";
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';

// ── Animations ────────────────────────────────────────────────────────────────
const ANIM_CSS = `
@keyframes geckoFlowRight {
  0%   { left: -30%; opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { left: 115%; opacity: 0; }
}
@keyframes geckoFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes geckoSlideIn {
  from { opacity: 0; transform: translateX(-6px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes geckoEdgeFlow {
  from { stroke-dashoffset: 12; }
  to   { stroke-dashoffset: 0; }
}
`;

// ── Types ─────────────────────────────────────────────────────────────────────
type PaymentTerm = 'CASH' | 'CREDIT';
type BilledTo = 'CUSTOMER' | 'AGENT' | 'FWD' | 'LINE' | 'CARRIER';

interface WizardCharge {
  tempId: string; code: string; description: string;
  paymentTerm: PaymentTerm; billedTo: BilledTo; cargoCharge: boolean;
}
interface WizardVAS {
  tempId: string; code: string; description: string;
  paymentTerm: PaymentTerm; paymentTo: BilledTo; loadAtGateInMTY: boolean;
}
interface WizardMovement {
  tempId: string; code: string; name: string; seq: number;
  releaseDM: boolean; grossWgt: boolean; sealNo: boolean; ediEnabled: boolean;
  icon: string; ediMessages: string[];
  charges: WizardCharge[]; vasCharges: WizardVAS[];
}
interface CanvasNode {
  tempId: string; code: string; name: string; icon: string; ediMessages: string[];
  x: number; y: number;
  releaseDM: boolean; grossWgt: boolean; sealNo: boolean; ediEnabled: boolean;
  charges: WizardCharge[]; vasCharges: WizardVAS[];
}
interface CanvasEdge { id: string; fromId: string; toId: string; }
interface WizardState {
  code: string; description: string;
  bookingType: 'EXPORT' | 'IMPORT' | 'TRANSSHIPMENT';
  bookingMode: 'FCL' | 'LCL' | 'RORO';
  status: 'Active' | 'Inactive';
  rules: { allowReleaseDamaged: boolean; checkMaxWeight: boolean; checkSealNumber: boolean; skipEDI: boolean };
  advancedMode: boolean;
  canvasNodes: CanvasNode[];
  canvasEdges: CanvasEdge[];
  movements: WizardMovement[];
}

// ── Canvas constants ──────────────────────────────────────────────────────────
const NODE_W = 162;
const NODE_H = 98;
const CNV_W  = 1500;
const CNV_H  = 460;
const CSNAP  = 20;
const PORT_R = 7;

function getTopoOrder(nodes: CanvasNode[], edges: CanvasEdge[]): string[] {
  const inDeg = new Map(nodes.map(n => [n.tempId, 0]));
  const adj   = new Map(nodes.map(n => [n.tempId, [] as string[]]));
  for (const e of edges) {
    adj.get(e.fromId)?.push(e.toId);
    inDeg.set(e.toId, (inDeg.get(e.toId) ?? 0) + 1);
  }
  const q   = nodes.filter(n => (inDeg.get(n.tempId) ?? 0) === 0).map(n => n.tempId);
  const res: string[] = [];
  while (q.length) {
    const id = q.shift()!;
    res.push(id);
    (adj.get(id) ?? []).forEach(nb => {
      const d = (inDeg.get(nb) ?? 0) - 1;
      inDeg.set(nb, d);
      if (d === 0) q.push(nb);
    });
  }
  const done = new Set(res);
  nodes.forEach(n => { if (!done.has(n.tempId)) res.push(n.tempId); });
  return res;
}

// ── Master catalogs ───────────────────────────────────────────────────────────
// Codes aligned with NAVIS N4, CargoWise, ISO 6346, and SMDG EDI standards.
// Covers: Sea Terminal · ICD · CFS · Depot · Rail · Reefer · DG · OOG
const MOVEMENT_CATALOG = [
  // ── Gate (truck interchange) ──────────────────────────────────────────────
  { code: 'EMTY DLVR', cat: 'Gate',          name: 'Empty Delivery (Gate-Out)',              icon: 'truck',        ediMessages: ['COPARN', 'CODECO'],           desc: 'Terminal releases empty unit to shipper/trucker for packing' },
  { code: 'FCL RCVE',  cat: 'Gate',          name: 'Laden Gate-In (FCL Receive)',            icon: 'download',     ediMessages: ['COPARN', 'CODECO', 'COARRI'], desc: 'Laden FCL received at gate from shipper/trucker' },
  { code: 'FCL DLVR',  cat: 'Gate',          name: 'Laden Gate-Out (FCL Deliver)',           icon: 'upload',       ediMessages: ['CODECO', 'COARRI', 'BAPLIE'], desc: 'Laden FCL released to consignee or forwarded to sea-port' },
  { code: 'EMTY RCVE', cat: 'Gate',          name: 'Empty Gate-In (Return)',                 icon: 'arrowDown',    ediMessages: ['CODECO'],                     desc: 'Empty unit returned to terminal by consignee or depot operator' },
  // ── Vessel (quayside / sea terminal) ─────────────────────────────────────
  { code: 'VSSL DISCH',cat: 'Vessel',        name: 'Vessel Discharge (Quay Crane)',          icon: 'anchor',       ediMessages: ['BAPLIE', 'COARRI', 'CODECO'], desc: 'Quay/gantry crane lifts container off vessel onto quay/terminal' },
  { code: 'VSSL LOAD', cat: 'Vessel',        name: 'Vessel Load (Quay Crane)',               icon: 'anchor',       ediMessages: ['BAPLIE', 'CODECO'],           desc: 'Quay/gantry crane lifts container from terminal onto vessel' },
  { code: 'SHFT',      cat: 'Vessel',        name: 'Crane Shift / Vessel Restow',            icon: 'move',         ediMessages: ['BAPLIE'],                     desc: 'Container moved on/between vessels to access another — same-port restow' },
  // ── Rail / Inland Waterway ────────────────────────────────────────────────
  { code: 'RAIL RCVE', cat: 'Rail / IWT',    name: 'Rail / IWT Receive',                    icon: 'download',     ediMessages: ['IFTMCS'],                     desc: 'Container arrives at terminal via rail wagon or inland waterway vessel' },
  { code: 'RAIL DLVR', cat: 'Rail / IWT',    name: 'Rail / IWT Deliver',                    icon: 'upload',       ediMessages: ['IFTMCS'],                     desc: 'Container dispatched from terminal via rail or IWT — intermodal handoff' },
  // ── Inter-Terminal Transfer ───────────────────────────────────────────────
  { code: 'XFER IN',   cat: 'Transfer',      name: 'Inter-Terminal Transfer In',             icon: 'arrowDown',    ediMessages: ['CODECO'],                     desc: 'Container received from another terminal (port→ICD or depot→yard)' },
  { code: 'XFER OUT',  cat: 'Transfer',      name: 'Inter-Terminal Transfer Out',            icon: 'upload',       ediMessages: ['CODECO'],                     desc: 'Container dispatched to another terminal (ICD→port or yard→depot)' },
  // ── CFS ───────────────────────────────────────────────────────────────────
  { code: 'CFS RCVE',  cat: 'CFS',           name: 'CFS Cargo In-Receipt',                  icon: 'box',          ediMessages: [],                             desc: 'LCL / break-bulk cargo received at CFS warehouse from shipper' },
  { code: 'CFS STUFF', cat: 'CFS',           name: 'CFS Consolidation / Stuffing',          icon: 'layers',       ediMessages: [],                             desc: 'LCL cargo stuffed & consolidated into FCL unit at CFS' },
  { code: 'CFS STRIP', cat: 'CFS',           name: 'CFS Devanning / Stripping',             icon: 'layers',       ediMessages: [],                             desc: 'FCL stripped and cargo de-vanned into CFS warehouse for delivery' },
  // ── Yard ──────────────────────────────────────────────────────────────────
  { code: 'YD REHDL',  cat: 'Yard',          name: 'Yard Rehandle / Shunting',              icon: 'move',         ediMessages: [],                             desc: 'Internal yard move — reposition, shunt, block-stow change, pre-marshalling' },
  // ── Customs / Government ─────────────────────────────────────────────────
  { code: 'X-RAY',     cat: 'Customs',       name: 'Customs X-Ray / Scan',                  icon: 'search',       ediMessages: [],                             desc: 'Non-intrusive customs inspection — NII scanner or X-ray lane' },
  { code: 'CUST EXAM', cat: 'Customs',       name: 'Customs Physical Examination',          icon: 'search',       ediMessages: [],                             desc: 'Customs officer physically examines cargo — may require unstuffing' },
  { code: 'CUST SEAL', cat: 'Customs',       name: 'Customs Sealing / Re-seal',             icon: 'tag',          ediMessages: [],                             desc: 'Customs affixes or replaces security seal post-examination' },
  // ── Compliance ────────────────────────────────────────────────────────────
  { code: 'VGM CHK',   cat: 'Compliance',    name: 'VGM / Weighbridge Verification',        icon: 'activity',     ediMessages: [],                             desc: 'SOLAS mandatory VGM — gross mass verified via calibrated scale' },
  { code: 'DG INSPT',  cat: 'Compliance',    name: 'DG Inspection & Segregation',           icon: 'alertTriangle',ediMessages: [],                             desc: 'IMO/IMDG compliance check — class, labels, placards, segregation verified' },
  // ── Reefer ────────────────────────────────────────────────────────────────
  { code: 'PTI',       cat: 'Reefer',        name: 'Pre-Trip Inspection (Reefer)',          icon: 'check',        ediMessages: [],                             desc: 'ACEP/CIP reefer unit check before release to shipper — mandatory for food-grade cargo' },
  { code: 'REEF PLUG', cat: 'Reefer',        name: 'Reefer Plug-In & Setpoint',            icon: 'activity',     ediMessages: [],                             desc: 'Reefer connected to PTR point; temperature setpoint programmed; monitoring starts' },
  { code: 'REEF UNPG', cat: 'Reefer',        name: 'Reefer Unplug (Pre-Departure)',        icon: 'activity',     ediMessages: [],                             desc: 'Reefer disconnected from power before gate-out; alarm log reviewed' },
  // ── Depot / M&R ───────────────────────────────────────────────────────────
  { code: 'DEPOT REPR',cat: 'Depot / M&R',   name: 'Container Repair (M&R)',                icon: 'edit',         ediMessages: [],                             desc: 'Damage assessment and repair at depot — IICL / DCSA grade reporting' },
  { code: 'DEPOT WASH',cat: 'Depot / M&R',   name: 'Container Washing / Cleaning',         icon: 'layers',       ediMessages: [],                             desc: 'Interior / exterior wash — required for food-grade reuse or DG residue clearance' },
  { code: 'DEGASSING', cat: 'Depot / M&R',   name: 'Degassing / Fumigation',               icon: 'send',         ediMessages: [],                             desc: 'Remove residual gas or fumigant — mandatory for certain cargo types before reuse' },
  // ── Special Cargo ─────────────────────────────────────────────────────────
  { code: 'OOG HNDL',  cat: 'Special Cargo', name: 'Out-of-Gauge / Breakbulk Handling',   icon: 'layers',       ediMessages: [],                             desc: 'Special lift and lash for flat-rack, open-top or breakbulk — OOG survey required' },
];

// Grouped for catalog panel rendering
const CATALOG_GROUPS: { label: string; accent: string }[] = [
  { label: 'Gate',          accent: '#2563EB' },
  { label: 'Vessel',        accent: '#0891B2' },
  { label: 'Rail / IWT',    accent: '#7C3AED' },
  { label: 'Transfer',      accent: '#D97706' },
  { label: 'CFS',           accent: '#16A34A' },
  { label: 'Yard',          accent: '#64748B' },
  { label: 'Customs',       accent: '#DC2626' },
  { label: 'Compliance',    accent: '#B45309' },
  { label: 'Reefer',        accent: '#0284C7' },
  { label: 'Depot / M&R',   accent: '#9333EA' },
  { label: 'Special Cargo', accent: '#BE185D' },
];

const CHARGE_CATALOG = [
  { code: 'SA001-CA', description: 'Admission Fee',       defaultTerm: 'CASH'   as PaymentTerm, category: 'Gate'       },
  { code: 'SA001-CR', description: 'Admission Fee',       defaultTerm: 'CREDIT' as PaymentTerm, category: 'Gate'       },
  { code: 'SA003-CR', description: 'Admission Fee (Cus)', defaultTerm: 'CREDIT' as PaymentTerm, category: 'Gate'       },
  { code: 'SB001-CR', description: 'Storage Fee',         defaultTerm: 'CREDIT' as PaymentTerm, category: 'Storage'    },
  { code: 'SB002-CR', description: 'Port Dues',           defaultTerm: 'CREDIT' as PaymentTerm, category: 'Port'       },
  { code: 'SB003-CR', description: 'Warehouse Fee',       defaultTerm: 'CREDIT' as PaymentTerm, category: 'Storage'    },
  { code: 'SC001-CA', description: 'Handling Fee',        defaultTerm: 'CASH'   as PaymentTerm, category: 'Handling'   },
  { code: 'SC002-CA', description: 'Inspection Fee',      defaultTerm: 'CASH'   as PaymentTerm, category: 'Inspection' },
  { code: 'SC003-CA', description: 'Stuffing Fee',        defaultTerm: 'CASH'   as PaymentTerm, category: 'CFS'        },
  { code: 'SC009-CA', description: 'Scanning Fee',        defaultTerm: 'CASH'   as PaymentTerm, category: 'Security'   },
  { code: 'SD001-CR', description: 'Documentation Fee',   defaultTerm: 'CREDIT' as PaymentTerm, category: 'Admin'      },
  { code: 'SE001-CR', description: 'EDI Fee',             defaultTerm: 'CREDIT' as PaymentTerm, category: 'EDI'        },
  { code: 'SE002-CA', description: 'Special Equipment',   defaultTerm: 'CASH'   as PaymentTerm, category: 'Equipment'  },
  { code: 'SE002-CR', description: 'Special Equipment',   defaultTerm: 'CREDIT' as PaymentTerm, category: 'Equipment'  },
  { code: 'SF001-CA', description: 'Service Fee',         defaultTerm: 'CASH'   as PaymentTerm, category: 'Admin'      },
  { code: 'SF002-CA', description: 'Survey Fee',          defaultTerm: 'CASH'   as PaymentTerm, category: 'Inspection' },
  { code: 'SG001-CA', description: 'Blind Gate Fee',      defaultTerm: 'CASH'   as PaymentTerm, category: 'Gate'       },
  { code: 'SH001-CA', description: 'Hazmat Surcharge',    defaultTerm: 'CASH'   as PaymentTerm, category: 'DG'         },
  { code: 'SL001-CA', description: 'Lashing Fee',         defaultTerm: 'CASH'   as PaymentTerm, category: 'Port'       },
  { code: 'SM001-CA', description: 'Move Fee',            defaultTerm: 'CASH'   as PaymentTerm, category: 'Handling'   },
  { code: 'SR001-CA', description: 'Repositioning Fee',   defaultTerm: 'CASH'   as PaymentTerm, category: 'Handling'   },
  { code: 'SX001-CA', description: 'Weighbridge Fee',     defaultTerm: 'CASH'   as PaymentTerm, category: 'Security'   },
];

const VAS_CATALOG = [
  { code: 'SA003-CR', description: 'Customs Fee',       defaultTerm: 'CREDIT' as PaymentTerm },
  { code: 'SC009-CA', description: 'Scanning Fee',      defaultTerm: 'CASH'   as PaymentTerm },
  { code: 'SE002-CA', description: 'Special Equipment', defaultTerm: 'CASH'   as PaymentTerm },
  { code: 'SE002-CR', description: 'Special Equipment', defaultTerm: 'CREDIT' as PaymentTerm },
  { code: 'SF002-CA', description: 'Survey Fee',        defaultTerm: 'CASH'   as PaymentTerm },
  { code: 'SH001-CA', description: 'Hazmat Surcharge',  defaultTerm: 'CASH'   as PaymentTerm },
  { code: 'SX001-CA', description: 'Weighbridge',       defaultTerm: 'CASH'   as PaymentTerm },
  { code: 'SR001-CA', description: 'Repositioning',     defaultTerm: 'CASH'   as PaymentTerm },
  { code: 'SL001-CA', description: 'Lashing',           defaultTerm: 'CASH'   as PaymentTerm },
];

// ── Design tokens ─────────────────────────────────────────────────────────────
const SEQ_COLORS = [
  { bg: '#2563EB', light: '#EFF6FF', border: '#BFDBFE' },
  { bg: '#16A34A', light: '#F0FDF4', border: '#BBF7D0' },
  { bg: '#D97706', light: '#FFFBEB', border: '#FDE68A' },
  { bg: '#7C3AED', light: '#F5F3FF', border: '#DDD6FE' },
  { bg: '#DC2626', light: '#FEF2F2', border: '#FECACA' },
];
const EDI_COLORS: Record<string, { bg: string; text: string }> = {
  COPARN: { bg: '#EDE9FE', text: '#6D28D9' },
  CODECO: { bg: '#DBEAFE', text: '#1D4ED8' },
  COARRI: { bg: '#D1FAE5', text: '#065F46' },
  BAPLIE: { bg: '#FEF3C7', text: '#92400E' },
  IFTMCS: { bg: '#F3F4F6', text: '#374151' },
};
const BTYPE: Record<string, { bg: string; text: string }> = {
  EXPORT:        { bg: '#D1FAE5', text: '#065F46' },
  IMPORT:        { bg: '#DBEAFE', text: '#1D4ED8' },
  TRANSSHIPMENT: { bg: '#FEF3C7', text: '#92400E' },
};

let _uid = 0;
const uid = () => `t${++_uid}-${Math.random().toString(36).slice(2, 5)}`;

// ── Step Indicator ────────────────────────────────────────────────────────────
const STEPS = ['Identity', 'Workflow', 'Charges', 'Review'];

function StepIndicator({ current }: { current: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 0, marginBottom: 32 }}>
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <React.Fragment key={label}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 80 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', fontSize: 14, fontWeight: 700,
                background: done ? '#16A34A' : active ? 'var(--gecko-primary-600)' : 'var(--gecko-bg-subtle)',
                border: `2px solid ${done ? '#16A34A' : active ? 'var(--gecko-primary-600)' : 'var(--gecko-border)'}`,
                color: (done || active) ? '#fff' : 'var(--gecko-text-disabled)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 250ms',
              }}>
                {done ? <Icon name="check" size={15} /> : n}
              </div>
              <span style={{
                fontSize: 11, fontWeight: active ? 700 : 500, whiteSpace: 'nowrap',
                color: done ? '#16A34A' : active ? 'var(--gecko-primary-700)' : 'var(--gecko-text-disabled)',
              }}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, margin: '17px 4px 0', background: done ? '#86EFAC' : 'var(--gecko-border)', transition: 'background 250ms', minWidth: 40 }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Step 1: Identity ──────────────────────────────────────────────────────────
function Step1({ state, onChange }: { state: WizardState; onChange: (patch: Partial<WizardState>) => void }) {
  const bt = BTYPE[state.bookingType];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, animation: 'geckoFadeIn 220ms ease' }}>
      <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Order Type Identity</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="gecko-form-group">
            <label className="gecko-label gecko-label-required">Order Type Code</label>
            <input className="gecko-input" placeholder="e.g. EXP CY/CY" value={state.code}
              onChange={e => onChange({ code: e.target.value.toUpperCase() })}
              style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 700, letterSpacing: '0.02em' }} />
            <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)', marginTop: 3 }}>Short unique identifier, uppercase</div>
          </div>
          <div className="gecko-form-group">
            <label className="gecko-label gecko-label-required">Description</label>
            <input className="gecko-input" placeholder="e.g. Export CY at SCT/ECT" value={state.description}
              onChange={e => onChange({ description: e.target.value })} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div className="gecko-form-group">
            <label className="gecko-label gecko-label-required">Booking Type</label>
            <select className="gecko-input" value={state.bookingType} onChange={e => onChange({ bookingType: e.target.value as any })}>
              <option>EXPORT</option><option>IMPORT</option><option>TRANSSHIPMENT</option>
            </select>
          </div>
          <div className="gecko-form-group">
            <label className="gecko-label gecko-label-required">Booking Mode</label>
            <select className="gecko-input" value={state.bookingMode} onChange={e => onChange({ bookingMode: e.target.value as any })}>
              <option>FCL</option><option>LCL</option><option>RORO</option>
            </select>
          </div>
          <div className="gecko-form-group">
            <label className="gecko-label">Status</label>
            <select className="gecko-input" value={state.status} onChange={e => onChange({ status: e.target.value as any })}>
              <option>Active</option><option>Inactive</option>
            </select>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Operational Rules</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {([
              { key: 'allowReleaseDamaged', label: 'Allow Release of Damaged Units', desc: 'Gate out units with damage flag set' },
              { key: 'checkMaxWeight',      label: 'Enforce Max Weight Check',        desc: 'Validate VGM against container limit' },
              { key: 'checkSealNumber',     label: 'Require Seal Number',             desc: 'Seal must be captured at gate' },
              { key: 'skipEDI',             label: 'Skip EDI Transmission',           desc: 'No EDI messages sent for this type' },
            ] as const).map(r => {
              const val = state.rules[r.key];
              return (
                <label key={r.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: val ? 'var(--gecko-primary-50)' : 'var(--gecko-bg-subtle)', border: `1px solid ${val ? 'var(--gecko-primary-200)' : 'var(--gecko-border)'}`, borderRadius: 10, cursor: 'pointer' }}>
                  <input type="checkbox" className="gecko-toggle gecko-toggle-sm" checked={val}
                    onChange={e => onChange({ rules: { ...state.rules, [r.key]: e.target.checked } })} style={{ marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: val ? 'var(--gecko-primary-800)' : 'var(--gecko-text-secondary)' }}>{r.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--gecko-text-disabled)', marginTop: 1 }}>{r.desc}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gecko-text-secondary)', marginBottom: 14 }}>Preview</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 18, fontWeight: 800 }}>{state.code || <span style={{ color: 'var(--gecko-text-disabled)' }}>CODE</span>}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: bt.bg, color: bt.text }}>{state.bookingType}</span>
            <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: 'var(--gecko-bg-subtle)', color: 'var(--gecko-text-secondary)', border: '1px solid var(--gecko-border)' }}>{state.bookingMode}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gecko-text-secondary)', marginBottom: 12 }}>
            {state.description || <span style={{ color: 'var(--gecko-text-disabled)', fontStyle: 'italic' }}>Description will appear here</span>}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {Object.entries(state.rules).filter(([, v]) => v).map(([k]) => (
              <span key={k} style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: 'var(--gecko-success-50)', color: 'var(--gecko-success-700)', border: '1px solid var(--gecko-success-200)' }}>
                ✓ {k === 'allowReleaseDamaged' ? 'Rel. Damaged' : k === 'checkMaxWeight' ? 'Max Wgt' : k === 'checkSealNumber' ? 'Seal No' : 'Skip EDI'}
              </span>
            ))}
          </div>
        </div>
        <div style={{ background: 'var(--gecko-info-50)', border: '1px solid var(--gecko-info-200)', borderRadius: 10, padding: 14, display: 'flex', gap: 10 }}>
          <Icon name="info" size={15} style={{ color: 'var(--gecko-info-600)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: 'var(--gecko-info-800)', lineHeight: 1.5 }}>
            The order type code is used across bookings, gate operations, and billing. Use a short, memorable code that reflects the flow direction and mode.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Workflow Canvas (Step 2) ───────────────────────────────────────────────────
function WorkflowCanvas({
  canvasNodes, canvasEdges, onChangeNodes, onChangeEdges,
}: {
  canvasNodes: CanvasNode[];
  canvasEdges: CanvasEdge[];
  onChangeNodes: (n: CanvasNode[]) => void;
  onChangeEdges: (e: CanvasEdge[]) => void;
}) {
  const canvasRef  = useRef<HTMLDivElement>(null);
  const nodesRef   = useRef(canvasNodes);
  const edgesRef   = useRef(canvasEdges);
  const cbNodesRef = useRef(onChangeNodes);
  const cbEdgesRef = useRef(onChangeEdges);
  useEffect(() => { nodesRef.current   = canvasNodes; },   [canvasNodes]);
  useEffect(() => { edgesRef.current   = canvasEdges; },   [canvasEdges]);
  useEffect(() => { cbNodesRef.current = onChangeNodes; }, [onChangeNodes]);
  useEffect(() => { cbEdgesRef.current = onChangeEdges; }, [onChangeEdges]);

  // All mutable drag / edge-draw state lives in refs; we call rerender() to flush to DOM
  const dragRef    = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const liveRef    = useRef<{ id: string; x: number; y: number }  | null>(null);
  const edgeFromRef = useRef<string | null>(null);
  const drawEndRef  = useRef<{ x: number; y: number } | null>(null);
  const [, setTick] = useState(0);
  const rerender = () => setTick(t => t + 1);

  // Convert mouse event → canvas-local coordinates (accounts for scroll)
  const toCanvas = (e: MouseEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left + canvasRef.current!.scrollLeft, y: e.clientY - r.top + canvasRef.current!.scrollTop };
  };

  useEffect(() => {
    const snap = (v: number) => Math.round(v / CSNAP) * CSNAP;

    const onMove = (e: MouseEvent) => {
      let dirty = false;
      if (dragRef.current) {
        const p = toCanvas(e);
        liveRef.current = { id: dragRef.current.id, x: p.x - dragRef.current.ox, y: p.y - dragRef.current.oy };
        dirty = true;
      }
      if (edgeFromRef.current) {
        drawEndRef.current = toCanvas(e);
        dirty = true;
      }
      if (dirty) rerender();
    };

    const onUp = () => {
      let dirty = false;
      if (dragRef.current && liveRef.current) {
        const { id, x, y } = liveRef.current;
        const nx = Math.max(0, snap(x));
        const ny = Math.max(0, Math.min(CNV_H - NODE_H - CSNAP, snap(y)));
        cbNodesRef.current(nodesRef.current.map(n => n.tempId === id ? { ...n, x: nx, y: ny } : n));
        dragRef.current = null;
        liveRef.current = null;
        dirty = true;
      }
      // edge draw cleanup — onNodeMouseUp handles completion, this just cancels if missed
      if (edgeFromRef.current) {
        edgeFromRef.current = null;
        drawEndRef.current  = null;
        dirty = true;
      }
      if (dirty) rerender();
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Displayed positions (live override during drag)
  const display = canvasNodes.map(n =>
    liveRef.current?.id === n.tempId ? { ...n, x: liveRef.current.x, y: liveRef.current.y } : n
  );

  const seqMap = new Map(getTopoOrder(canvasNodes, canvasEdges).map((id, i) => [id, i + 1]));

  const outPt  = (n: CanvasNode) => ({ x: n.x + NODE_W, y: n.y + NODE_H / 2 });
  const inPt   = (n: CanvasNode) => ({ x: n.x,          y: n.y + NODE_H / 2 });
  const bezier = (x1: number, y1: number, x2: number, y2: number) => {
    const cp = Math.max(Math.abs(x2 - x1) * 0.45, 50);
    return `M ${x1} ${y1} C ${x1+cp} ${y1} ${x2-cp} ${y2} ${x2} ${y2}`;
  };

  const onNodeMouseUp = (toId: string) => {
    if (edgeFromRef.current && edgeFromRef.current !== toId) {
      const fromId = edgeFromRef.current;
      if (!edgesRef.current.some(e => e.fromId === fromId && e.toId === toId)) {
        cbEdgesRef.current([...edgesRef.current, { id: uid(), fromId, toId }]);
      }
      edgeFromRef.current = null;
      drawEndRef.current  = null;
      rerender();
    }
  };

  const removeNode = (id: string) => {
    cbNodesRef.current(nodesRef.current.filter(n => n.tempId !== id));
    cbEdgesRef.current(edgesRef.current.filter(e => e.fromId !== id && e.toId !== id));
  };

  const deleteEdge = (eid: string) => cbEdgesRef.current(edgesRef.current.filter(e => e.id !== eid));

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const code = e.dataTransfer.getData('movement-code');
    const cat = MOVEMENT_CATALOG.find(m => m.code === code);
    if (!cat || !canvasRef.current) return;
    const r = canvasRef.current.getBoundingClientRect();
    const snap = (v: number) => Math.round(v / CSNAP) * CSNAP;
    const x = snap(Math.max(0, e.clientX - r.left + canvasRef.current.scrollLeft - NODE_W / 2));
    const y = snap(Math.max(0, e.clientY - r.top  + canvasRef.current.scrollTop  - NODE_H / 2));
    cbNodesRef.current([...nodesRef.current, {
      tempId: uid(), code: cat.code, name: cat.name, icon: cat.icon, ediMessages: cat.ediMessages,
      x, y, releaseDM: false, grossWgt: false, sealNo: false, ediEnabled: cat.ediMessages.length > 0,
      charges: [], vasCharges: [],
    }]);
  };

  const drawEdge = edgeFromRef.current;
  const drawEnd  = drawEndRef.current;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, animation: 'geckoFadeIn 220ms ease' }}>

      {/* Catalog panel */}
      <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>Movement Catalog</div>
          <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>Drag cards onto the canvas →</div>
        </div>
        <div style={{ padding: '8px 8px 8px', overflowY: 'auto', flex: 1 }}>
          {CATALOG_GROUPS.map(grp => {
            const items = MOVEMENT_CATALOG.filter(m => m.cat === grp.label);
            if (!items.length) return null;
            return (
              <div key={grp.label} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: grp.accent, padding: '3px 2px 4px', borderBottom: `1px solid ${grp.accent}30`, marginBottom: 4 }}>{grp.label}</div>
                {items.map(cat => (
                  <div key={cat.code} draggable
                    onDragStart={e => { e.dataTransfer.setData('movement-code', cat.code); e.dataTransfer.effectAllowed = 'copy'; }}
                    title={cat.desc}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 8px', borderRadius: 8, border: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-surface)', cursor: 'grab', userSelect: 'none', transition: 'all 120ms', marginBottom: 3 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = grp.accent + '12'; (e.currentTarget as HTMLElement).style.borderColor = grp.accent + '50'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--gecko-bg-surface)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--gecko-border)'; }}
                  >
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: grp.accent + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon name={cat.icon} size={12} style={{ color: grp.accent }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{cat.code}</div>
                      <div style={{ fontSize: 9, color: 'var(--gecko-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat.name}</div>
                    </div>
                    {cat.ediMessages.length > 0 && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#60A5FA', flexShrink: 0 }} />}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Canvas panel */}
      <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Toolbar */}
        <div style={{ padding: '9px 14px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="info" size={13} style={{ color: 'var(--gecko-info-500)', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', flex: 1 }}>
            Drop movements onto the canvas · Connect by dragging from the{' '}
            <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: 'var(--gecko-primary-600)', verticalAlign: 'middle' }} />{' '}
            output port · Click a connector to delete it
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gecko-primary-700)', background: 'var(--gecko-primary-50)', padding: '2px 10px', borderRadius: 10, flexShrink: 0 }}>
            {canvasNodes.length} node{canvasNodes.length !== 1 ? 's' : ''} · {canvasEdges.length} connection{canvasEdges.length !== 1 ? 's' : ''}
          </span>
          {canvasNodes.length > 0 && (
            <button
              onClick={() => { cbNodesRef.current([]); cbEdgesRef.current([]); }}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 7, border: '1px solid var(--gecko-border)', background: '#fff', cursor: 'pointer', color: 'var(--gecko-error-600)', fontFamily: 'inherit', flexShrink: 0 }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Drop zone */}
        <div
          ref={canvasRef}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
          onDrop={onDrop}
          style={{
            position: 'relative',
            height: CNV_H,
            overflowX: 'auto',
            overflowY: 'hidden',
            background: `radial-gradient(circle, #94A3B8 1.5px, transparent 1.5px) 0 0 / ${CSNAP}px ${CSNAP}px, var(--gecko-bg-subtle)`,
            cursor: liveRef.current ? 'grabbing' : 'default',
          }}
        >
          {/* SVG edge layer */}
          <svg style={{ position: 'absolute', left: 0, top: 0, width: CNV_W, height: CNV_H, pointerEvents: 'none', overflow: 'visible', zIndex: 1 }}>
            <defs>
              <marker id="gwf-head" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#3B82F6" />
              </marker>
            </defs>

            {/* Committed edges */}
            {canvasEdges.map(edge => {
              const from = display.find(n => n.tempId === edge.fromId);
              const to   = display.find(n => n.tempId === edge.toId);
              if (!from || !to) return null;
              const op = outPt(from), ip = inPt(to);
              const d = bezier(op.x, op.y, ip.x, ip.y);
              return (
                <g key={edge.id} style={{ pointerEvents: 'all', cursor: 'pointer' }} onClick={() => deleteEdge(edge.id)}>
                  {/* Wide invisible hit target */}
                  <path d={d} stroke="transparent" strokeWidth={18} fill="none" />
                  {/* Animated visible edge */}
                  <path
                    d={d}
                    stroke="#3B82F6"
                    strokeWidth={2.5}
                    fill="none"
                    strokeDasharray="8 4"
                    markerEnd="url(#gwf-head)"
                    style={{ animation: 'geckoEdgeFlow 0.7s linear infinite' }}
                  />
                </g>
              );
            })}

            {/* Drawing preview */}
            {drawEdge && drawEnd && (() => {
              const from = display.find(n => n.tempId === drawEdge);
              if (!from) return null;
              const op = outPt(from);
              return (
                <path
                  d={bezier(op.x, op.y, drawEnd.x, drawEnd.y)}
                  stroke="#93C5FD"
                  strokeWidth={2}
                  fill="none"
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                />
              );
            })()}
          </svg>

          {/* Canvas nodes */}
          {display.map(node => {
            const seq    = seqMap.get(node.tempId) ?? 1;
            const col    = SEQ_COLORS[(seq - 1) % SEQ_COLORS.length];
            const isLive = liveRef.current?.id === node.tempId;
            return (
              <div
                key={node.tempId}
                style={{ position: 'absolute', left: node.x, top: node.y, width: NODE_W, zIndex: isLive ? 20 : 2, userSelect: 'none' }}
                onMouseDown={e => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  const r = canvasRef.current!.getBoundingClientRect();
                  const px = e.clientX - r.left + canvasRef.current!.scrollLeft;
                  const py = e.clientY - r.top  + canvasRef.current!.scrollTop;
                  dragRef.current = { id: node.tempId, ox: px - node.x, oy: py - node.y };
                  rerender();
                }}
                onMouseUp={() => onNodeMouseUp(node.tempId)}
              >
                <div style={{
                  background: '#fff',
                  border: `2px solid ${col.border}`,
                  borderRadius: 12,
                  boxShadow: isLive ? '0 10px 28px rgba(0,0,0,0.18)' : '0 2px 8px rgba(0,0,0,0.07)',
                  position: 'relative',
                  cursor: isLive ? 'grabbing' : 'grab',
                  transition: 'box-shadow 120ms',
                  overflow: 'visible',
                }}>
                  {/* Color bar */}
                  <div style={{ height: 4, background: col.bg, borderRadius: '10px 10px 0 0' }} />

                  {/* Content */}
                  <div style={{ padding: '9px 11px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 5 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 7, background: col.bg, color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{seq}</div>
                      <div style={{ width: 26, height: 26, borderRadius: 7, background: col.light, border: `1px solid ${col.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon name={node.icon} size={13} style={{ color: col.bg }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 10, fontWeight: 800, color: col.bg, lineHeight: 1.2 }}>{node.code}</div>
                        <div style={{ fontSize: 9, color: 'var(--gecko-text-secondary)', lineHeight: 1.3, marginTop: 1 }}>{node.name}</div>
                      </div>
                      <button
                        onMouseDown={e => e.stopPropagation()}
                        onClick={() => removeNode(node.tempId)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--gecko-text-disabled)', display: 'flex', alignSelf: 'flex-start', lineHeight: 1 }}
                      >
                        <Icon name="xCircle" size={13} />
                      </button>
                    </div>
                    {node.ediMessages.length > 0 && (
                      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        {node.ediMessages.slice(0, 3).map(msg => {
                          const ec = EDI_COLORS[msg] ?? { bg: '#F3F4F6', text: '#374151' };
                          return <span key={msg} style={{ fontSize: 7, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: ec.bg, color: ec.text }}>{msg}</span>;
                        })}
                      </div>
                    )}
                  </div>

                  {/* Input port (left, white ring) */}
                  <div
                    style={{ position: 'absolute', left: -PORT_R, top: '50%', transform: 'translateY(-50%)', width: PORT_R * 2, height: PORT_R * 2, borderRadius: '50%', background: '#fff', border: `2px solid ${col.bg}`, zIndex: 5 }}
                    onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }}
                  />

                  {/* Output port (right, filled) */}
                  <div
                    style={{ position: 'absolute', right: -PORT_R, top: '50%', transform: 'translateY(-50%)', width: PORT_R * 2, height: PORT_R * 2, borderRadius: '50%', background: col.bg, border: '2.5px solid #fff', zIndex: 5, cursor: 'crosshair', boxShadow: `0 0 0 1.5px ${col.bg}` }}
                    onMouseDown={e => {
                      e.stopPropagation();
                      e.preventDefault();
                      const r = canvasRef.current!.getBoundingClientRect();
                      edgeFromRef.current = node.tempId;
                      drawEndRef.current  = { x: e.clientX - r.left + canvasRef.current!.scrollLeft, y: e.clientY - r.top + canvasRef.current!.scrollTop };
                      rerender();
                    }}
                  />
                </div>
              </div>
            );
          })}

          {/* Empty state */}
          {canvasNodes.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, pointerEvents: 'none' }}>
              <Icon name="activity" size={44} style={{ color: '#CBD5E1' }} />
              <div style={{ fontSize: 14, color: 'var(--gecko-text-disabled)', fontStyle: 'italic' }}>Drag movement cards from the catalog onto this canvas</div>
              <div style={{ fontSize: 12, color: 'var(--gecko-text-disabled)' }}>Then connect them by dragging from the colored output ports →</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Movement Sequence ─────────────────────────────────────────────────
function Step2({ state, onChange }: { state: WizardState; onChange: (patch: Partial<WizardState>) => void }) {

  // ── Switch to advanced: auto-layout existing movements onto the canvas ────
  const enterAdvanced = () => {
    let nodes = state.canvasNodes;
    let edges = state.canvasEdges;
    if (nodes.length === 0 && state.movements.length > 0) {
      const SPACING = NODE_W + 64;
      const sy = Math.round((CNV_H - NODE_H) / 2 / CSNAP) * CSNAP;
      nodes = state.movements.map((m, i) => ({
        tempId: m.tempId, code: m.code, name: m.name, icon: m.icon, ediMessages: m.ediMessages,
        x: 40 + i * SPACING, y: sy,
        releaseDM: m.releaseDM, grossWgt: m.grossWgt, sealNo: m.sealNo, ediEnabled: m.ediEnabled,
        charges: m.charges, vasCharges: m.vasCharges,
      }));
      edges = state.movements.slice(0, -1).map((m, i) => ({
        id: uid(), fromId: m.tempId, toId: state.movements[i + 1].tempId,
      }));
    }
    onChange({ advancedMode: true, canvasNodes: nodes, canvasEdges: edges });
  };

  // ── Switch back to simple: derive ordered list from canvas topo ───────────
  const exitAdvanced = () => {
    if (state.canvasNodes.length > 0) {
      const topoIds = getTopoOrder(state.canvasNodes, state.canvasEdges);
      const movements: WizardMovement[] = topoIds.map((id, i) => {
        const n    = state.canvasNodes.find(cn => cn.tempId === id)!;
        const prev = state.movements.find(m => m.tempId === id);
        return {
          tempId: n.tempId, code: n.code, name: n.name, icon: n.icon,
          seq: i + 1,
          releaseDM: n.releaseDM, grossWgt: n.grossWgt, sealNo: n.sealNo, ediEnabled: n.ediEnabled,
          ediMessages: n.ediMessages,
          charges: prev?.charges ?? [],
          vasCharges: prev?.vasCharges ?? [],
        };
      });
      onChange({ advancedMode: false, movements });
    } else {
      onChange({ advancedMode: false });
    }
  };

  if (state.advancedMode) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>Advanced — Visual Workflow Builder</span>
            <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginLeft: 10 }}>Drag movements, draw connectors, build any flow shape</span>
          </div>
          <button onClick={exitAdvanced} className="gecko-btn gecko-btn-ghost gecko-btn-sm" style={{ gap: 6 }}>
            <Icon name="layers" size={14} /> Simple Mode
          </button>
        </div>
        <WorkflowCanvas
          canvasNodes={state.canvasNodes}
          canvasEdges={state.canvasEdges}
          onChangeNodes={nodes => onChange({ canvasNodes: nodes })}
          onChangeEdges={edges => onChange({ canvasEdges: edges })}
        />
      </div>
    );
  }

  // ── Simple mode (original list builder) ──────────────────────────────────
  const addMovement = (cat: typeof MOVEMENT_CATALOG[number]) => {
    const newMov: WizardMovement = {
      tempId: uid(), code: cat.code, name: cat.name, icon: cat.icon,
      seq: state.movements.length + 1,
      releaseDM: false, grossWgt: false, sealNo: false, ediEnabled: cat.ediMessages.length > 0,
      ediMessages: cat.ediMessages, charges: [], vasCharges: [],
    };
    onChange({ movements: [...state.movements, newMov] });
  };
  const removeMovement = (tempId: string) =>
    onChange({ movements: state.movements.filter(m => m.tempId !== tempId).map((m, i) => ({ ...m, seq: i + 1 })) });
  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const arr = [...state.movements];
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    onChange({ movements: arr.map((m, i) => ({ ...m, seq: i + 1 })) });
  };
  const moveDown = (idx: number) => {
    if (idx === state.movements.length - 1) return;
    const arr = [...state.movements];
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    onChange({ movements: arr.map((m, i) => ({ ...m, seq: i + 1 })) });
  };
  const toggleFlag = (tempId: string, flag: 'releaseDM' | 'grossWgt' | 'sealNo' | 'ediEnabled', val: boolean) =>
    onChange({ movements: state.movements.map(m => m.tempId === tempId ? { ...m, [flag]: val } : m) });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'geckoFadeIn 220ms ease' }}>
      {/* Mode toggle header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>Movement Sequence</span>
          <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginLeft: 10 }}>Click to add legs, use ↑↓ to reorder</span>
        </div>
        <button onClick={enterAdvanced} className="gecko-btn gecko-btn-outline gecko-btn-sm" style={{ gap: 6 }}>
          <Icon name="activity" size={14} /> Advanced Mode
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
        {/* Catalog */}
        <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gecko-text-primary)', marginBottom: 2 }}>Movement Catalog</div>
            <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)' }}>Click to add to sequence →</div>
          </div>
          <div style={{ padding: '8px 10px', overflowY: 'auto', maxHeight: 560 }}>
            {CATALOG_GROUPS.map(grp => {
              const items = MOVEMENT_CATALOG.filter(m => m.cat === grp.label);
              if (!items.length) return null;
              return (
                <div key={grp.label} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: grp.accent, padding: '3px 2px 4px', borderBottom: `1px solid ${grp.accent}30`, marginBottom: 4 }}>{grp.label}</div>
                  {items.map(cat => (
                    <button key={cat.code} onClick={() => addMovement(cat)} title={cat.desc}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-surface)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 120ms', textAlign: 'left', marginBottom: 3 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = grp.accent + '12'; (e.currentTarget as HTMLElement).style.borderColor = grp.accent + '50'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--gecko-bg-surface)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--gecko-border)'; }}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: grp.accent + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon name={cat.icon} size={13} style={{ color: grp.accent }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>{cat.code}</div>
                        <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat.name}</div>
                      </div>
                      {cat.ediMessages.length > 0 && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#60A5FA', flexShrink: 0 }} />}
                      <div style={{ width: 20, height: 20, borderRadius: 5, background: grp.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon name="plus" size={10} />
                      </div>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sequence builder */}
        <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gecko-text-primary)' }}>Movement Sequence</div>
              <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 1 }}>Configure flags per leg · reorder with ↑↓</div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gecko-primary-700)', background: 'var(--gecko-primary-100)', padding: '3px 10px', borderRadius: 12 }}>
              {state.movements.length} leg{state.movements.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ padding: 14, minHeight: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {state.movements.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '40px 0', color: 'var(--gecko-text-disabled)' }}>
                <Icon name="layers" size={32} style={{ opacity: 0.4 }} />
                <div style={{ fontSize: 13, fontStyle: 'italic' }}>No movements added yet</div>
                <div style={{ fontSize: 11 }}>← Click movements from the catalog to add them</div>
              </div>
            ) : (
              state.movements.map((mov, idx) => {
                const col = SEQ_COLORS[(mov.seq - 1) % SEQ_COLORS.length];
                return (
                  <div key={mov.tempId} style={{ animation: 'geckoSlideIn 180ms ease', border: `1.5px solid ${col.border}`, borderRadius: 12, overflow: 'hidden', background: col.light }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: col.bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{mov.seq}</div>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: '#fff', border: `1px solid ${col.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon name={mov.icon} size={14} style={{ color: col.bg }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 12, fontWeight: 800, color: col.bg }}>{mov.code}</div>
                        <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)' }}>{mov.name}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => moveUp(idx)} disabled={idx === 0} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--gecko-border)', background: idx === 0 ? 'transparent' : '#fff', cursor: idx === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: idx === 0 ? 0.3 : 1 }}>
                          <Icon name="chevronUp" size={13} style={{ color: 'var(--gecko-text-secondary)' }} />
                        </button>
                        <button onClick={() => moveDown(idx)} disabled={idx === state.movements.length - 1} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--gecko-border)', background: idx === state.movements.length - 1 ? 'transparent' : '#fff', cursor: idx === state.movements.length - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: idx === state.movements.length - 1 ? 0.3 : 1 }}>
                          <Icon name="chevronDown" size={13} style={{ color: 'var(--gecko-text-secondary)' }} />
                        </button>
                        <button onClick={() => removeMovement(mov.tempId)} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--gecko-border)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="xCircle" size={13} style={{ color: 'var(--gecko-error-500)' }} />
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 0, borderTop: `1px solid ${col.border}` }}>
                      {([
                        { key: 'releaseDM'  as const, label: 'Release DM' },
                        { key: 'grossWgt'   as const, label: 'Gross Wgt'  },
                        { key: 'sealNo'     as const, label: 'Seal No'    },
                        { key: 'ediEnabled' as const, label: 'EDI'        },
                      ]).map((flag, fi) => (
                        <label key={flag.key} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 4px', cursor: 'pointer', fontSize: 10, fontWeight: 600, background: mov[flag.key] ? col.bg + '18' : 'transparent', borderRight: fi < 3 ? `1px solid ${col.border}` : 'none', color: mov[flag.key] ? col.bg : 'var(--gecko-text-disabled)', transition: 'all 120ms' }}>
                          <input type="checkbox" checked={mov[flag.key]} onChange={e => toggleFlag(mov.tempId, flag.key, e.target.checked)} style={{ width: 12, height: 12, accentColor: col.bg }} />
                          {flag.label}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 3: Charges per Movement ──────────────────────────────────────────────
function Step3({ state, onChange }: { state: WizardState; onChange: (patch: Partial<WizardState>) => void }) {
  const [activeTab, setActiveTab] = useState(0);
  const [chargeSearch, setChargeSearch] = useState('');
  const [vasSearch, setVasSearch] = useState('');

  const mov = state.movements[activeTab];
  if (!mov) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--gecko-text-disabled)' }}>No movements added. Go back and add movement legs to the canvas first.</div>;

  const col = SEQ_COLORS[(mov.seq - 1) % SEQ_COLORS.length];

  const updateMovements = (updated: WizardMovement) =>
    onChange({ movements: state.movements.map(m => m.tempId === updated.tempId ? updated : m) });

  const addCharge = (cat: typeof CHARGE_CATALOG[number]) => {
    const c: WizardCharge = { tempId: uid(), code: cat.code, description: cat.description, paymentTerm: cat.defaultTerm, billedTo: 'CUSTOMER', cargoCharge: false };
    updateMovements({ ...mov, charges: [...mov.charges, c] });
  };
  const removeCharge = (cId: string) => updateMovements({ ...mov, charges: mov.charges.filter(c => c.tempId !== cId) });
  const patchCharge  = (cId: string, patch: Partial<WizardCharge>) =>
    updateMovements({ ...mov, charges: mov.charges.map(c => c.tempId === cId ? { ...c, ...patch } : c) });

  const addVAS = (cat: typeof VAS_CATALOG[number]) => {
    const v: WizardVAS = { tempId: uid(), code: cat.code, description: cat.description, paymentTerm: cat.defaultTerm, paymentTo: 'CUSTOMER', loadAtGateInMTY: false };
    updateMovements({ ...mov, vasCharges: [...mov.vasCharges, v] });
  };
  const removeVAS = (vId: string) => updateMovements({ ...mov, vasCharges: mov.vasCharges.filter(v => v.tempId !== vId) });
  const patchVAS  = (vId: string, patch: Partial<WizardVAS>) =>
    updateMovements({ ...mov, vasCharges: mov.vasCharges.map(v => v.tempId === vId ? { ...v, ...patch } : v) });

  const filteredCharges = CHARGE_CATALOG.filter(c => !chargeSearch || c.code.toLowerCase().includes(chargeSearch.toLowerCase()) || c.description.toLowerCase().includes(chargeSearch.toLowerCase()));
  const filteredVAS     = VAS_CATALOG.filter(v => !vasSearch || v.code.toLowerCase().includes(vasSearch.toLowerCase()) || v.description.toLowerCase().includes(vasSearch.toLowerCase()));

  const SelectSm = ({ value, options, onChange: onCh }: { value: string; options: string[]; onChange: (v: string) => void }) => (
    <select value={value} onChange={e => onCh(e.target.value)} className="gecko-input gecko-input-sm" style={{ fontSize: 10, padding: '0 6px', height: 28, minWidth: 0 }}>
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'geckoFadeIn 220ms ease' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {state.movements.map((m, i) => {
          const c = SEQ_COLORS[(m.seq - 1) % SEQ_COLORS.length];
          const isActive = i === activeTab;
          return (
            <button key={m.tempId} onClick={() => { setActiveTab(i); setChargeSearch(''); setVasSearch(''); }}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${isActive ? c.bg : 'var(--gecko-border)'}`, background: isActive ? c.light : 'var(--gecko-bg-surface)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? c.bg : 'var(--gecko-text-secondary)', transition: 'all 150ms' }}>
              <div style={{ width: 20, height: 20, borderRadius: 5, background: isActive ? c.bg : 'var(--gecko-bg-subtle)', color: isActive ? '#fff' : 'var(--gecko-text-disabled)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>{m.seq}</div>
              <span style={{ fontFamily: 'var(--gecko-font-mono)' }}>{m.code}</span>
              <span style={{ fontSize: 10, opacity: 0.8 }}>({m.charges.length + m.vasCharges.length})</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Regular Charges */}
        <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gecko-border)', background: col.light, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="fileText" size={14} style={{ color: col.bg }} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>Regular Charges</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: col.bg, background: '#fff', padding: '1px 8px', borderRadius: 10 }}>{mov.charges.length} added</span>
          </div>
          {mov.charges.length > 0 && (
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--gecko-border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gecko-text-secondary)', marginBottom: 2 }}>Configured</div>
              {mov.charges.map(c => (
                <div key={c.tempId} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 100px 52px 24px', gap: 6, alignItems: 'center', padding: '7px 10px', background: col.light, border: `1px solid ${col.border}`, borderRadius: 8 }}>
                  <div>
                    <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 11, fontWeight: 700, color: col.bg }}>{c.code}</span>
                    <span style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', marginLeft: 6 }}>{c.description}</span>
                  </div>
                  <SelectSm value={c.paymentTerm} options={['CASH', 'CREDIT']} onChange={v => patchCharge(c.tempId, { paymentTerm: v as PaymentTerm })} />
                  <SelectSm value={c.billedTo} options={['CUSTOMER', 'AGENT', 'FWD', 'LINE', 'CARRIER']} onChange={v => patchCharge(c.tempId, { billedTo: v as BilledTo })} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 600, cursor: 'pointer', color: 'var(--gecko-text-secondary)', justifyContent: 'center' }}>
                    <input type="checkbox" checked={c.cargoCharge} onChange={e => patchCharge(c.tempId, { cargoCharge: e.target.checked })} style={{ width: 12, height: 12 }} />
                    Cargo
                  </label>
                  <button onClick={() => removeCharge(c.tempId)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                    <Icon name="xCircle" size={14} style={{ color: 'var(--gecko-error-400)' }} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div style={{ padding: '10px 12px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gecko-text-secondary)', marginBottom: 8 }}>Add from Catalog</div>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Icon name="search" size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-text-disabled)', pointerEvents: 'none' }} />
              <input className="gecko-input gecko-input-sm" placeholder="Search charge codes..." value={chargeSearch} onChange={e => setChargeSearch(e.target.value)} style={{ paddingLeft: 26 }} />
            </div>
            <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {filteredCharges.map(cat => (
                <div key={cat.code + cat.defaultTerm} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 7, border: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 10, fontWeight: 700 }}>{cat.code}</span>
                    <span style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', marginLeft: 6 }}>{cat.description}</span>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '1.5px 5px', borderRadius: 3, background: cat.defaultTerm === 'CASH' ? '#D1FAE5' : '#DBEAFE', color: cat.defaultTerm === 'CASH' ? '#065F46' : '#1D4ED8', flexShrink: 0 }}>{cat.defaultTerm}</span>
                  <button onClick={() => addCharge(cat)} style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--gecko-primary-600)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name="plus" size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* VAS Charges */}
        <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gecko-border)', background: '#FFF7ED', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="tag" size={14} style={{ color: 'var(--gecko-accent-600)' }} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>VAS Charges</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--gecko-accent-700)', background: '#fff', padding: '1px 8px', borderRadius: 10 }}>{mov.vasCharges.length} added</span>
          </div>
          {mov.vasCharges.length > 0 && (
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--gecko-border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gecko-text-secondary)', marginBottom: 2 }}>Configured</div>
              {mov.vasCharges.map(v => (
                <div key={v.tempId} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 100px 52px 24px', gap: 6, alignItems: 'center', padding: '7px 10px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8 }}>
                  <div>
                    <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--gecko-accent-700)' }}>{v.code}</span>
                    <span style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', marginLeft: 6 }}>{v.description}</span>
                  </div>
                  <SelectSm value={v.paymentTerm} options={['CASH', 'CREDIT']} onChange={val => patchVAS(v.tempId, { paymentTerm: val as PaymentTerm })} />
                  <SelectSm value={v.paymentTo} options={['CUSTOMER', 'AGENT', 'FWD', 'LINE', 'CARRIER']} onChange={val => patchVAS(v.tempId, { paymentTo: val as BilledTo })} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 600, cursor: 'pointer', color: 'var(--gecko-text-secondary)', justifyContent: 'center' }}>
                    <input type="checkbox" checked={v.loadAtGateInMTY} onChange={e => patchVAS(v.tempId, { loadAtGateInMTY: e.target.checked })} style={{ width: 12, height: 12 }} />
                    InMTY
                  </label>
                  <button onClick={() => removeVAS(v.tempId)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                    <Icon name="xCircle" size={14} style={{ color: 'var(--gecko-error-400)' }} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div style={{ padding: '10px 12px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gecko-text-secondary)', marginBottom: 8 }}>Add from VAS Catalog</div>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Icon name="search" size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--gecko-text-disabled)', pointerEvents: 'none' }} />
              <input className="gecko-input gecko-input-sm" placeholder="Search VAS codes..." value={vasSearch} onChange={e => setVasSearch(e.target.value)} style={{ paddingLeft: 26 }} />
            </div>
            <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {filteredVAS.map(cat => (
                <div key={cat.code + cat.defaultTerm} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 7, border: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 10, fontWeight: 700 }}>{cat.code}</span>
                    <span style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', marginLeft: 6 }}>{cat.description}</span>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '1.5px 5px', borderRadius: 3, background: cat.defaultTerm === 'CASH' ? '#D1FAE5' : '#DBEAFE', color: cat.defaultTerm === 'CASH' ? '#065F46' : '#1D4ED8', flexShrink: 0 }}>{cat.defaultTerm}</span>
                  <button onClick={() => addVAS(cat)} style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--gecko-accent-600)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name="plus" size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 4: Review ────────────────────────────────────────────────────────────
function Step4({ state }: { state: WizardState }) {
  const bt = BTYPE[state.bookingType];
  const totalCharges = state.movements.reduce((s, m) => s + m.charges.length, 0);
  const totalVAS     = state.movements.reduce((s, m) => s + m.vasCharges.length, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'geckoFadeIn 220ms ease' }}>
      <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 14, padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--gecko-font-mono)', fontSize: 22, fontWeight: 800 }}>{state.code || '—'}</h2>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: bt.bg, color: bt.text }}>{state.bookingType}</span>
          <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: 'var(--gecko-bg-subtle)', color: 'var(--gecko-text-secondary)', border: '1px solid var(--gecko-border)' }}>{state.bookingMode}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gecko-success-500)', alignSelf: 'center' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-success-700)' }}>{state.status}</span>
          </div>
        </div>
        <div style={{ fontSize: 14, color: 'var(--gecko-text-secondary)', marginBottom: 14 }}>{state.description}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--gecko-border)', border: '1px solid var(--gecko-border)', borderRadius: 10, overflow: 'hidden' }}>
          {[
            { label: 'Movements',       value: state.movements.length,                             icon: 'activity',  color: 'var(--gecko-primary-600)', bg: 'var(--gecko-primary-50)' },
            { label: 'Regular Charges', value: totalCharges,                                       icon: 'fileText',  color: 'var(--gecko-success-600)', bg: 'var(--gecko-success-50)' },
            { label: 'VAS Charges',     value: totalVAS,                                           icon: 'tag',       color: 'var(--gecko-accent-600)',  bg: 'var(--gecko-accent-50)'  },
            { label: 'EDI Messages',    value: state.movements.filter(m => m.ediEnabled).length,   icon: 'send',      color: 'var(--gecko-info-600)',    bg: 'var(--gecko-info-50)'    },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--gecko-bg-surface)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={s.icon} size={16} style={{ color: s.color }} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Workflow preview */}
      <div style={{ background: 'var(--gecko-bg-surface)', border: '1px solid var(--gecko-border)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '13px 20px', borderBottom: '1px solid var(--gecko-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="activity" size={15} style={{ color: 'var(--gecko-primary-600)' }} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>Workflow Preview</span>
        </div>
        <div style={{ padding: '24px 24px 20px', overflowX: 'auto', background: 'var(--gecko-bg-subtle)' }}>
          {state.movements.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--gecko-text-disabled)', fontSize: 13, padding: '20px 0' }}>No movements configured</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', minWidth: 'max-content', gap: 0 }}>
              {state.movements.map((mov, idx) => {
                const col = SEQ_COLORS[(mov.seq - 1) % SEQ_COLORS.length];
                return (
                  <React.Fragment key={mov.tempId}>
                    <div style={{ width: 172, flexShrink: 0, background: '#fff', border: `2px solid ${col.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                      <div style={{ height: 4, background: col.bg }} />
                      <div style={{ padding: '10px 12px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 24, height: 24, borderRadius: 7, background: col.bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{mov.seq}</div>
                        <div>
                          <div style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 10, fontWeight: 800, color: col.bg }}>{mov.code}</div>
                          <div style={{ fontSize: 9, color: 'var(--gecko-text-secondary)' }}>{mov.name}</div>
                        </div>
                      </div>
                      {mov.ediMessages.length > 0 && (
                        <div style={{ padding: '0 12px 4px', display: 'flex', gap: 3 }}>
                          {mov.ediMessages.slice(0, 3).map(msg => {
                            const ec = EDI_COLORS[msg] ?? { bg: '#F3F4F6', text: '#374151' };
                            return <span key={msg} style={{ fontSize: 7, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: ec.bg, color: ec.text }}>{msg}</span>;
                          })}
                        </div>
                      )}
                      <div style={{ padding: '6px 12px 10px', borderTop: '1px solid var(--gecko-border)', display: 'flex', gap: 8 }}>
                        <span style={{ fontSize: 9, color: 'var(--gecko-text-secondary)', display: 'flex', alignItems: 'center', gap: 3 }}><Icon name="fileText" size={9} />{mov.charges.length}</span>
                        <span style={{ fontSize: 9, color: 'var(--gecko-text-secondary)', display: 'flex', alignItems: 'center', gap: 3 }}><Icon name="tag" size={9} />{mov.vasCharges.length}</span>
                      </div>
                    </div>
                    {idx < state.movements.length - 1 && (
                      <div style={{ flex: '0 0 56px', position: 'relative', display: 'flex', alignItems: 'center', alignSelf: 'center', height: 36 }}>
                        <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'var(--gecko-border)' }} />
                        <div style={{ position: 'absolute', width: '40%', height: 3, borderRadius: 2, background: `linear-gradient(90deg, transparent, ${col.bg})`, animation: 'geckoFlowRight 1.8s ease-in-out infinite' }} />
                        <div style={{ position: 'absolute', right: -1, width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '8px solid var(--gecko-border)' }} />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Per-movement charge summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {state.movements.map(mov => {
          const col = SEQ_COLORS[(mov.seq - 1) % SEQ_COLORS.length];
          return (
            <div key={mov.tempId} style={{ background: 'var(--gecko-bg-surface)', border: `1px solid ${col.border}`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: col.bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>{mov.seq}</div>
                <span style={{ fontFamily: 'var(--gecko-font-mono)', fontSize: 12, fontWeight: 700, color: col.bg }}>{mov.code}</span>
                <span style={{ fontSize: 10, color: 'var(--gecko-text-secondary)' }}>{mov.name}</span>
              </div>
              {mov.charges.length === 0 && mov.vasCharges.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--gecko-text-disabled)', fontStyle: 'italic' }}>No charges configured</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {mov.charges.map(c => (
                    <div key={c.tempId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                      <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600 }}>{c.code}</span>
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: c.paymentTerm === 'CASH' ? '#D1FAE5' : '#DBEAFE', color: c.paymentTerm === 'CASH' ? '#065F46' : '#1D4ED8', fontWeight: 600 }}>{c.paymentTerm}</span>
                      <span style={{ fontSize: 9, color: 'var(--gecko-text-disabled)' }}>{c.billedTo}</span>
                    </div>
                  ))}
                  {mov.vasCharges.map(v => (
                    <div key={v.tempId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                      <span style={{ fontFamily: 'var(--gecko-font-mono)', fontWeight: 600, color: 'var(--gecko-accent-700)' }}>{v.code}</span>
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: '#FEF3C7', color: '#92400E', fontWeight: 600 }}>VAS</span>
                      <span style={{ fontSize: 9, color: 'var(--gecko-text-disabled)' }}>{v.paymentTo}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const INITIAL: WizardState = {
  code: '', description: '',
  bookingType: 'EXPORT', bookingMode: 'FCL', status: 'Active',
  rules: { allowReleaseDamaged: false, checkMaxWeight: false, checkSealNumber: false, skipEDI: false },
  advancedMode: false,
  canvasNodes: [],
  canvasEdges: [],
  movements: [],
};

export default function NewOrderTypePage() {
  const router = useRouter();
  const [step, setStep]   = useState(1);
  const [state, setState] = useState<WizardState>(INITIAL);
  const [errors, setErrors] = useState<string[]>([]);

  const patch = (p: Partial<WizardState>) => setState(prev => ({ ...prev, ...p }));

  const validate = (s: number): string[] => {
    if (s === 1) {
      const e: string[] = [];
      if (!state.code.trim())        e.push('Order type code is required');
      if (!state.description.trim()) e.push('Description is required');
      return e;
    }
    if (s === 2) {
      if (state.advancedMode) return state.canvasNodes.length === 0 ? ['Add at least one movement to the canvas'] : [];
      return state.movements.length === 0 ? ['Add at least one movement leg'] : [];
    }
    return [];
  };

  const next = () => {
    const errs = validate(step);
    if (errs.length) { setErrors(errs); return; }
    setErrors([]);

    if (step === 2 && state.advancedMode) {
      // Advanced mode: derive ordered movements from canvas topology
      const topoIds = getTopoOrder(state.canvasNodes, state.canvasEdges);
      const movements: WizardMovement[] = topoIds.map((id, i) => {
        const n    = state.canvasNodes.find(cn => cn.tempId === id)!;
        const prev = state.movements.find(m => m.tempId === id);
        return {
          tempId: n.tempId, code: n.code, name: n.name, icon: n.icon,
          seq: i + 1,
          releaseDM: n.releaseDM, grossWgt: n.grossWgt, sealNo: n.sealNo, ediEnabled: n.ediEnabled,
          ediMessages: n.ediMessages,
          charges:    prev?.charges    ?? [],
          vasCharges: prev?.vasCharges ?? [],
        };
      });
      patch({ movements });
    }
    // Simple mode: movements already correct in state, nothing extra needed

    setStep(s => Math.min(s + 1, 4));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const back = () => { setErrors([]); setStep(s => Math.max(s - 1, 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const save = () => router.push('/masters/order-types');

  return (
    <div style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 0, paddingBottom: 48 }}>
      <style>{ANIM_CSS}</style>

      <div className="gecko-page-actions" style={{ marginBottom: 28 }}>
        <div className="gecko-page-actions-left">
          <nav className="gecko-breadcrumb">
            <Link href="/masters/order-types" className="gecko-breadcrumb-item">Order Type Master</Link>
            <span className="gecko-breadcrumb-sep" />
            <span className="gecko-breadcrumb-current">New Order Type</span>
          </nav>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '6px 0 0', color: 'var(--gecko-text-primary)' }}>Create Order Type</h1>
        </div>
        <Link href="/masters/order-types" className="gecko-btn gecko-btn-ghost gecko-btn-sm">
          <Icon name="xCircle" size={15} /> Cancel
        </Link>
      </div>

      <StepIndicator current={step} />

      {step === 1 && <Step1 state={state} onChange={patch} />}
      {step === 2 && <Step2 state={state} onChange={patch} />}
      {step === 3 && <Step3 state={state} onChange={patch} />}
      {step === 4 && <Step4 state={state} />}

      {errors.length > 0 && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--gecko-error-50)', border: '1px solid var(--gecko-error-200)', borderRadius: 10, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Icon name="alertTriangle" size={15} style={{ color: 'var(--gecko-error-500)', marginTop: 1, flexShrink: 0 }} />
          <div>{errors.map(e => <div key={e} style={{ fontSize: 13, color: 'var(--gecko-error-700)', fontWeight: 500 }}>{e}</div>)}</div>
        </div>
      )}

      <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderTop: '1px solid var(--gecko-border)' }}>
        <button onClick={back} disabled={step === 1} className="gecko-btn gecko-btn-ghost" style={{ opacity: step === 1 ? 0 : 1, pointerEvents: step === 1 ? 'none' : 'auto' }}>
          <Icon name="chevronLeft" size={16} /> Back
        </button>
        <div style={{ display: 'flex', gap: 6 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ width: i === step ? 20 : 6, height: 6, borderRadius: 3, background: i < step ? '#16A34A' : i === step ? 'var(--gecko-primary-600)' : 'var(--gecko-border)', transition: 'all 250ms' }} />
          ))}
        </div>
        {step < 4 ? (
          <button onClick={next} className="gecko-btn gecko-btn-primary">
            Continue <Icon name="chevronRight" size={16} />
          </button>
        ) : (
          <button onClick={save} className="gecko-btn gecko-btn-primary" style={{ gap: 8 }}>
            <Icon name="check" size={16} /> Save Order Type
          </button>
        )}
      </div>
    </div>
  );
}
