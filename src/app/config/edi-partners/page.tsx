"use client";
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';

// ── Types ──────────────────────────────────────────────────────────────────────

type PartnerType = 'Shipping Line' | 'Customs Authority' | 'Port Authority' | 'Haulier' | 'Internal';
type ConnectionType = 'FTP' | 'SFTP' | 'API' | 'AS2' | 'EMAIL';
type PartnerStatus = 'Active' | 'Inactive' | 'Error';
type MsgDirection = 'IN' | 'OUT' | 'BOTH';

interface MsgType {
  code: string;
  description: string;
  direction: MsgDirection;
  lastReceived: string;
  active: boolean;
}

interface ActivityEntry {
  ts: string;
  msgType: string;
  direction: 'IN' | 'OUT';
  status: 'OK' | 'Error';
}

interface Partner {
  id: string;
  name: string;
  code: string;
  type: PartnerType;
  connection: ConnectionType;
  messages: string[];
  lastActivity: string;
  msgsToday: number;
  status: PartnerStatus;
  host: string;
  port: number;
  username: string;
  inboundDir: string;
  outboundDir: string;
  msgTypes: MsgType[];
  activityLog: ActivityEntry[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const PARTNER_TYPE_COLORS: Record<PartnerType, { bg: string; color: string; header: string }> = {
  'Shipping Line':      { bg: 'var(--gecko-primary-50)',  color: 'var(--gecko-primary-700)',  header: 'var(--gecko-primary-600)'  },
  'Customs Authority':  { bg: 'var(--gecko-warning-50)',  color: 'var(--gecko-warning-700)',  header: 'var(--gecko-warning-600)'  },
  'Port Authority':     { bg: 'var(--gecko-success-50)',  color: 'var(--gecko-success-700)',  header: 'var(--gecko-success-600)'  },
  'Haulier':            { bg: '#f0f9ff',                  color: '#0369a1',                   header: '#0369a1'                   },
  'Internal':           { bg: 'var(--gecko-bg-subtle)',   color: 'var(--gecko-text-secondary)', header: '#475569'                 },
};

const CONNECTION_COLORS: Record<ConnectionType, { bg: string; color: string }> = {
  SFTP:  { bg: 'var(--gecko-primary-50)',  color: 'var(--gecko-primary-700)'  },
  API:   { bg: 'var(--gecko-success-50)',  color: 'var(--gecko-success-700)'  },
  AS2:   { bg: 'var(--gecko-warning-50)',  color: 'var(--gecko-warning-700)'  },
  FTP:   { bg: '#f0f9ff',                  color: '#0369a1'                   },
  EMAIL: { bg: 'var(--gecko-bg-subtle)',   color: 'var(--gecko-text-secondary)' },
};

const STATUS_COLORS: Record<PartnerStatus, { bg: string; color: string }> = {
  Active:   { bg: 'var(--gecko-success-50)',  color: 'var(--gecko-success-700)'  },
  Inactive: { bg: 'var(--gecko-bg-subtle)',   color: 'var(--gecko-text-secondary)' },
  Error:    { bg: 'var(--gecko-error-50)',    color: 'var(--gecko-error-700)'    },
};

// Palette for 2-letter avatar circles
const AVATAR_PALETTE = [
  '#2563eb', '#0891b2', '#059669', '#d97706', '#7c3aed',
  '#db2777', '#ea580c', '#16a34a', '#4f46e5', '#475569',
];

function avatarColor(code: string): string {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) & 0xffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

// ── Sample Data ────────────────────────────────────────────────────────────────

const INITIAL_PARTNERS: Partner[] = [
  {
    id: 'p1', name: 'Maersk Line', code: 'MAEU',
    type: 'Shipping Line', connection: 'SFTP',
    messages: ['BAPLIE', 'COPRAR', 'COARRI', 'COPINO'],
    lastActivity: '2026-05-04 09:14', msgsToday: 143, status: 'Active',
    host: 'sftp.maersk.com', port: 22,
    username: 'lcb_logicon_prod',
    inboundDir: '/incoming/lcb/',
    outboundDir: '/outgoing/lcb/',
    msgTypes: [
      { code: 'BAPLIE', description: 'Stowage Plan',                 direction: 'IN',  lastReceived: '2026-05-04 09:14', active: true  },
      { code: 'COPRAR', description: 'Container Pre-Advice/Discharge', direction: 'IN',  lastReceived: '2026-05-04 08:50', active: true  },
      { code: 'COARRI', description: 'Container Arrival',             direction: 'OUT', lastReceived: '2026-05-04 09:00', active: true  },
      { code: 'COPINO', description: 'Pre-notification',              direction: 'IN',  lastReceived: '2026-05-04 07:22', active: true  },
    ],
    activityLog: [
      { ts: '2026-05-04 09:14', msgType: 'BAPLIE', direction: 'IN',  status: 'OK'    },
      { ts: '2026-05-04 09:00', msgType: 'COARRI', direction: 'OUT', status: 'OK'    },
      { ts: '2026-05-04 08:50', msgType: 'COPRAR', direction: 'IN',  status: 'OK'    },
      { ts: '2026-05-04 07:22', msgType: 'COPINO', direction: 'IN',  status: 'Error' },
    ],
  },
  {
    id: 'p2', name: 'CMA CGM', code: 'CMDU',
    type: 'Shipping Line', connection: 'SFTP',
    messages: ['BAPLIE', 'COPRAR', 'COARRI'],
    lastActivity: '2026-05-04 08:52', msgsToday: 89, status: 'Active',
    host: 'sftp.cma-cgm.com', port: 22,
    username: 'lcb_cma_prod',
    inboundDir: '/in/lcb/',
    outboundDir: '/out/lcb/',
    msgTypes: [
      { code: 'BAPLIE', description: 'Stowage Plan',                  direction: 'IN',  lastReceived: '2026-05-04 08:52', active: true  },
      { code: 'COPRAR', description: 'Container Pre-Advice/Discharge', direction: 'IN',  lastReceived: '2026-05-04 08:10', active: true  },
      { code: 'COARRI', description: 'Container Arrival',              direction: 'OUT', lastReceived: '2026-05-04 08:30', active: true  },
    ],
    activityLog: [
      { ts: '2026-05-04 08:52', msgType: 'BAPLIE', direction: 'IN',  status: 'OK' },
      { ts: '2026-05-04 08:30', msgType: 'COARRI', direction: 'OUT', status: 'OK' },
      { ts: '2026-05-04 08:10', msgType: 'COPRAR', direction: 'IN',  status: 'OK' },
      { ts: '2026-05-04 07:55', msgType: 'BAPLIE', direction: 'IN',  status: 'OK' },
    ],
  },
  {
    id: 'p3', name: 'COSCO Shipping', code: 'COSU',
    type: 'Shipping Line', connection: 'API',
    messages: ['BAPLIE', 'COPRAR', 'IFTDGN'],
    lastActivity: '2026-05-04 07:30', msgsToday: 67, status: 'Active',
    host: 'api.cosco.com', port: 443,
    username: 'lcb_cosco_api',
    inboundDir: '/v2/messages/in',
    outboundDir: '/v2/messages/out',
    msgTypes: [
      { code: 'BAPLIE', description: 'Stowage Plan',                  direction: 'IN',  lastReceived: '2026-05-04 07:30', active: true  },
      { code: 'COPRAR', description: 'Container Pre-Advice/Discharge', direction: 'IN',  lastReceived: '2026-05-04 07:00', active: true  },
      { code: 'IFTDGN', description: 'DG Notification',               direction: 'IN',  lastReceived: '2026-05-04 06:45', active: true  },
    ],
    activityLog: [
      { ts: '2026-05-04 07:30', msgType: 'BAPLIE', direction: 'IN', status: 'OK' },
      { ts: '2026-05-04 07:00', msgType: 'COPRAR', direction: 'IN', status: 'OK' },
      { ts: '2026-05-04 06:45', msgType: 'IFTDGN', direction: 'IN', status: 'OK' },
      { ts: '2026-05-04 06:10', msgType: 'BAPLIE', direction: 'IN', status: 'OK' },
    ],
  },
  {
    id: 'p4', name: 'ONE (Ocean Network)', code: 'ONEY',
    type: 'Shipping Line', connection: 'SFTP',
    messages: ['COPRAR', 'COARRI'],
    lastActivity: '2026-05-03 22:10', msgsToday: 31, status: 'Active',
    host: 'sftp.one-line.com', port: 22,
    username: 'lcb_one_prod',
    inboundDir: '/incoming/lcb/',
    outboundDir: '/outgoing/lcb/',
    msgTypes: [
      { code: 'COPRAR', description: 'Container Pre-Advice/Discharge', direction: 'IN',  lastReceived: '2026-05-03 22:10', active: true  },
      { code: 'COARRI', description: 'Container Arrival',              direction: 'OUT', lastReceived: '2026-05-03 21:55', active: true  },
    ],
    activityLog: [
      { ts: '2026-05-03 22:10', msgType: 'COPRAR', direction: 'IN',  status: 'OK' },
      { ts: '2026-05-03 21:55', msgType: 'COARRI', direction: 'OUT', status: 'OK' },
      { ts: '2026-05-03 20:30', msgType: 'COPRAR', direction: 'IN',  status: 'OK' },
      { ts: '2026-05-03 19:45', msgType: 'COARRI', direction: 'OUT', status: 'OK' },
    ],
  },
  {
    id: 'p5', name: 'Thai Customs Dept.', code: 'THDOC',
    type: 'Customs Authority', connection: 'AS2',
    messages: ['CUSCAR', 'CUSDEC', 'CUSRES'],
    lastActivity: '2026-05-04 09:00', msgsToday: 12, status: 'Active',
    host: 'as2.customs.go.th', port: 4080,
    username: 'LCB_CUSTOMS_AS2',
    inboundDir: '/customs/in/',
    outboundDir: '/customs/out/',
    msgTypes: [
      { code: 'CUSCAR', description: 'Customs Cargo Report',  direction: 'OUT', lastReceived: '2026-05-04 09:00', active: true  },
      { code: 'CUSDEC', description: 'Customs Declaration',   direction: 'OUT', lastReceived: '2026-05-04 08:45', active: true  },
      { code: 'CUSRES', description: 'Customs Response',      direction: 'IN',  lastReceived: '2026-05-04 09:05', active: true  },
    ],
    activityLog: [
      { ts: '2026-05-04 09:05', msgType: 'CUSRES', direction: 'IN',  status: 'OK' },
      { ts: '2026-05-04 09:00', msgType: 'CUSCAR', direction: 'OUT', status: 'OK' },
      { ts: '2026-05-04 08:45', msgType: 'CUSDEC', direction: 'OUT', status: 'OK' },
      { ts: '2026-05-04 07:30', msgType: 'CUSCAR', direction: 'OUT', status: 'OK' },
    ],
  },
  {
    id: 'p6', name: 'Laem Chabang Port', code: 'LCBPA',
    type: 'Port Authority', connection: 'FTP',
    messages: ['VESSEL_ARRIVAL', 'BERTH_PLAN'],
    lastActivity: '2026-05-04 06:00', msgsToday: 8, status: 'Active',
    host: 'ftp.laemchabangport.com', port: 21,
    username: 'lcb_tosync',
    inboundDir: '/sync/in/',
    outboundDir: '/sync/out/',
    msgTypes: [
      { code: 'VESSEL_ARRIVAL', description: 'Vessel Arrival Notice', direction: 'IN',   lastReceived: '2026-05-04 06:00', active: true  },
      { code: 'BERTH_PLAN',     description: 'Berth Planning Message', direction: 'BOTH', lastReceived: '2026-05-04 05:50', active: true  },
    ],
    activityLog: [
      { ts: '2026-05-04 06:00', msgType: 'VESSEL_ARRIVAL', direction: 'IN',  status: 'OK' },
      { ts: '2026-05-04 05:50', msgType: 'BERTH_PLAN',     direction: 'IN',  status: 'OK' },
      { ts: '2026-05-04 05:45', msgType: 'BERTH_PLAN',     direction: 'OUT', status: 'OK' },
      { ts: '2026-05-03 22:00', msgType: 'VESSEL_ARRIVAL', direction: 'IN',  status: 'OK' },
    ],
  },
  {
    id: 'p7', name: 'Evergreen Marine', code: 'EGLV',
    type: 'Shipping Line', connection: 'SFTP',
    messages: ['BAPLIE', 'COPRAR'],
    lastActivity: '2026-05-03 18:44', msgsToday: 44, status: 'Active',
    host: 'sftp.evergreen-marine.com', port: 22,
    username: 'lcb_egl_prod',
    inboundDir: '/incoming/lcb/',
    outboundDir: '/outgoing/lcb/',
    msgTypes: [
      { code: 'BAPLIE', description: 'Stowage Plan',                  direction: 'IN', lastReceived: '2026-05-03 18:44', active: true  },
      { code: 'COPRAR', description: 'Container Pre-Advice/Discharge', direction: 'IN', lastReceived: '2026-05-03 17:30', active: true  },
    ],
    activityLog: [
      { ts: '2026-05-03 18:44', msgType: 'BAPLIE', direction: 'IN', status: 'OK' },
      { ts: '2026-05-03 17:30', msgType: 'COPRAR', direction: 'IN', status: 'OK' },
      { ts: '2026-05-03 16:10', msgType: 'BAPLIE', direction: 'IN', status: 'OK' },
      { ts: '2026-05-03 15:00', msgType: 'COPRAR', direction: 'IN', status: 'OK' },
    ],
  },
  {
    id: 'p8', name: 'Bangkok Haulage Co.', code: 'BKHC',
    type: 'Haulier', connection: 'EMAIL',
    messages: ['GATE_APT', 'GATE_OUT'],
    lastActivity: '2026-05-04 10:30', msgsToday: 6, status: 'Active',
    host: 'smtp.bangkokhaulage.co.th', port: 587,
    username: 'edi@bangkokhaulage.co.th',
    inboundDir: 'inbox/edi/',
    outboundDir: 'sent/edi/',
    msgTypes: [
      { code: 'GATE_APT', description: 'Gate Appointment Request', direction: 'IN',  lastReceived: '2026-05-04 10:30', active: true  },
      { code: 'GATE_OUT', description: 'Gate Out Notification',    direction: 'OUT', lastReceived: '2026-05-04 10:35', active: true  },
    ],
    activityLog: [
      { ts: '2026-05-04 10:35', msgType: 'GATE_OUT', direction: 'OUT', status: 'OK' },
      { ts: '2026-05-04 10:30', msgType: 'GATE_APT', direction: 'IN',  status: 'OK' },
      { ts: '2026-05-04 09:15', msgType: 'GATE_APT', direction: 'IN',  status: 'OK' },
      { ts: '2026-05-04 09:20', msgType: 'GATE_OUT', direction: 'OUT', status: 'OK' },
    ],
  },
  {
    id: 'p9', name: 'Hapag-Lloyd', code: 'HLCU',
    type: 'Shipping Line', connection: 'API',
    messages: ['BAPLIE', 'COPRAR', 'COARRI', 'IFTDGN'],
    lastActivity: '2026-05-03 14:20', msgsToday: 0, status: 'Error',
    host: 'api.hapag-lloyd.com', port: 443,
    username: 'lcb_hlcu_api',
    inboundDir: '/v1/edi/in',
    outboundDir: '/v1/edi/out',
    msgTypes: [
      { code: 'BAPLIE', description: 'Stowage Plan',                  direction: 'IN',   lastReceived: '2026-05-03 14:20', active: true  },
      { code: 'COPRAR', description: 'Container Pre-Advice/Discharge', direction: 'IN',   lastReceived: '2026-05-03 13:50', active: true  },
      { code: 'COARRI', description: 'Container Arrival',              direction: 'OUT',  lastReceived: '2026-05-03 13:30', active: true  },
      { code: 'IFTDGN', description: 'DG Notification',               direction: 'IN',   lastReceived: '2026-05-03 12:00', active: false },
    ],
    activityLog: [
      { ts: '2026-05-03 14:20', msgType: 'BAPLIE', direction: 'IN',  status: 'Error' },
      { ts: '2026-05-03 13:50', msgType: 'COPRAR', direction: 'IN',  status: 'Error' },
      { ts: '2026-05-03 13:30', msgType: 'COARRI', direction: 'OUT', status: 'Error' },
      { ts: '2026-05-03 12:00', msgType: 'IFTDGN', direction: 'IN',  status: 'OK'    },
    ],
  },
  {
    id: 'p10', name: 'Internal TOS Sync', code: 'INTERNAL',
    type: 'Internal', connection: 'API',
    messages: ['ALL_TYPES'],
    lastActivity: '2026-05-04 09:45', msgsToday: 456, status: 'Active',
    host: 'localhost', port: 8080,
    username: 'tos_internal',
    inboundDir: '/internal/in',
    outboundDir: '/internal/out',
    msgTypes: [
      { code: 'ALL_TYPES', description: 'Internal TOS Integration Bus', direction: 'BOTH', lastReceived: '2026-05-04 09:45', active: true },
    ],
    activityLog: [
      { ts: '2026-05-04 09:45', msgType: 'ALL_TYPES', direction: 'IN',  status: 'OK' },
      { ts: '2026-05-04 09:44', msgType: 'ALL_TYPES', direction: 'OUT', status: 'OK' },
      { ts: '2026-05-04 09:43', msgType: 'ALL_TYPES', direction: 'IN',  status: 'OK' },
      { ts: '2026-05-04 09:42', msgType: 'ALL_TYPES', direction: 'OUT', status: 'OK' },
    ],
  },
];

// ── Small sub-components ───────────────────────────────────────────────────────

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
      padding: '2px 7px', borderRadius: 4, background: bg, color,
      whiteSpace: 'nowrap', lineHeight: 1.6,
    }}>
      {label}
    </span>
  );
}

function StatusDot({ status }: { status: PartnerStatus }) {
  const dotColor = status === 'Active' ? 'var(--gecko-success-500)' : status === 'Error' ? 'var(--gecko-error-500)' : 'var(--gecko-text-disabled)';
  const { bg, color } = STATUS_COLORS[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
      padding: '2px 7px', borderRadius: 4, background: bg, color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, display: 'inline-block', flexShrink: 0 }} />
      {status}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
      color: 'var(--gecko-text-secondary)', marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--gecko-border)', margin: '4px 0' }} />;
}

function KpiCard({ label, value, sub, accent, icon }: { label: string; value: string | number; sub?: string; accent?: string; icon: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 160,
      padding: '14px 18px',
      background: 'var(--gecko-bg-surface)',
      border: '1px solid var(--gecko-border)',
      borderRadius: 10,
      borderTop: `3px solid ${accent ?? 'var(--gecko-primary-500)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Icon name={icon} size={13} style={{ color: accent ?? 'var(--gecko-primary-500)' }} />
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gecko-text-secondary)' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, color: 'var(--gecko-text-primary)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function EdiPartnersPage() {
  const [partners, setPartners]               = useState<Partner[]>(INITIAL_PARTNERS);
  const [search, setSearch]                   = useState('');
  const [typeFilter, setTypeFilter]           = useState<PartnerType | 'All'>('All');
  const [statusFilter, setStatusFilter]       = useState<PartnerStatus | 'All'>('All');
  const [selectedId, setSelectedId]           = useState<string | null>(null);
  const [showAdd, setShowAdd]                 = useState(false);
  const [showPassword, setShowPassword]       = useState(false);
  const [connTestState, setConnTestState]     = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');

  // Add form state
  const [addName, setAddName]       = useState('');
  const [addCode, setAddCode]       = useState('');
  const [addType, setAddType]       = useState<PartnerType>('Shipping Line');
  const [addConn, setAddConn]       = useState<ConnectionType>('SFTP');

  const selectedPartner = useMemo(() => partners.find(p => p.id === selectedId) ?? null, [partners, selectedId]);

  const filtered = useMemo(() => partners.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
    const matchType   = typeFilter === 'All' || p.type === typeFilter;
    const matchStatus = statusFilter === 'All' || p.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  }), [partners, search, typeFilter, statusFilter]);

  function handleTestConnection() {
    setConnTestState('testing');
    setTimeout(() => {
      setConnTestState(selectedPartner?.status === 'Error' ? 'fail' : 'ok');
    }, 1400);
  }

  function handleToggleMsgType(partnerId: string, code: string) {
    setPartners(prev => prev.map(p => {
      if (p.id !== partnerId) return p;
      return {
        ...p,
        msgTypes: p.msgTypes.map(m => m.code === code ? { ...m, active: !m.active } : m),
      };
    }));
  }

  function handleAddPartner() {
    if (!addName.trim() || !addCode.trim()) return;
    const newPartner: Partner = {
      id: `p${Date.now()}`,
      name: addName.trim(),
      code: addCode.trim().toUpperCase(),
      type: addType,
      connection: addConn,
      messages: [],
      lastActivity: '—',
      msgsToday: 0,
      status: 'Inactive',
      host: '',
      port: addConn === 'SFTP' ? 22 : addConn === 'FTP' ? 21 : addConn === 'AS2' ? 4080 : 443,
      username: '',
      inboundDir: '/incoming/',
      outboundDir: '/outgoing/',
      msgTypes: [],
      activityLog: [],
    };
    setPartners(prev => [...prev, newPartner]);
    setShowAdd(false);
    setAddName(''); setAddCode('');
    setAddType('Shipping Line'); setAddConn('SFTP');
    setSelectedId(newPartner.id);
  }

  const panelOpen = (selectedId !== null || showAdd) && !!(selectedPartner || showAdd);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gecko-space-4)' }}>

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>EDI Partners</h1>
            <Badge label="Config" bg="var(--gecko-primary-50)" color="var(--gecko-primary-700)" />
          </div>
          <div style={{ fontSize: 12, color: 'var(--gecko-text-secondary)' }}>
            Configure trading partner connections, message types, and EDI exchange profiles
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="gecko-btn gecko-btn-outline gecko-btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="download" size={14} /> Export
          </button>
          <button
            className="gecko-btn gecko-btn-primary gecko-btn-sm"
            onClick={() => { setShowAdd(true); setSelectedId(null); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="plus" size={14} /> Add Partner
          </button>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <KpiCard
          label="Active Partners"
          value={8}
          sub="of 10 total configured"
          accent="var(--gecko-primary-500)"
          icon="users"
        />
        <KpiCard
          label="Messages Today"
          value="1,247"
          sub="across all active partners"
          accent="var(--gecko-success-500)"
          icon="activity"
        />
        <KpiCard
          label="Failed / Pending"
          value={3}
          sub="require attention"
          accent="var(--gecko-error-500)"
          icon="alertCircle"
        />
        <KpiCard
          label="Last Sync"
          value="2 min ago"
          sub={
            // rendered below as JSX inline
            undefined
          }
          accent="var(--gecko-success-500)"
          icon="refresh"
        />
      </div>

      {/* Last Sync card override for green dot */}
      {/* We use a wrapper trick — re-render the last kpi with custom sub */}
      {/* Actually handled via the sub prop — replaced with span below by reimplementing */}

      {/* ── Main layout: table + detail panel ── */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* ── Partner Table ── */}
        <div style={{
          flex: 1, minWidth: 0,
          background: 'var(--gecko-bg-surface)',
          border: '1px solid var(--gecko-border)',
          borderRadius: 10, overflow: 'hidden',
        }}>

          {/* Toolbar */}
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--gecko-border)',
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 280 }}>
              <Icon name="search" size={14} style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--gecko-text-secondary)', pointerEvents: 'none',
              }} />
              <input
                className="gecko-input gecko-input-sm"
                placeholder="Search partners…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 30, width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            {/* Type filter */}
            <div style={{ position: 'relative' }}>
              <select
                className="gecko-input gecko-input-sm"
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value as PartnerType | 'All')}
                style={{ paddingRight: 28, appearance: 'none', cursor: 'pointer', minWidth: 150 }}>
                <option value="All">All Types</option>
                <option>Shipping Line</option>
                <option>Customs Authority</option>
                <option>Port Authority</option>
                <option>Haulier</option>
                <option>Internal</option>
              </select>
              <Icon name="chevronDown" size={12} style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--gecko-text-secondary)', pointerEvents: 'none',
              }} />
            </div>

            {/* Status filter */}
            <div style={{ position: 'relative' }}>
              <select
                className="gecko-input gecko-input-sm"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as PartnerStatus | 'All')}
                style={{ paddingRight: 28, appearance: 'none', cursor: 'pointer', minWidth: 120 }}>
                <option value="All">All Status</option>
                <option>Active</option>
                <option>Inactive</option>
                <option>Error</option>
              </select>
              <Icon name="chevronDown" size={12} style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--gecko-text-secondary)', pointerEvents: 'none',
              }} />
            </div>

            <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--gecko-text-secondary)' }}>
              {filtered.length} partner{filtered.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--gecko-border)', background: 'var(--gecko-bg-subtle)' }}>
                  {['Partner', 'Type', 'Connection', 'Message Types', 'Last Activity', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{
                      padding: '9px 14px', textAlign: 'left', fontWeight: 600,
                      fontSize: 11, letterSpacing: '0.04em', color: 'var(--gecko-text-secondary)',
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '32px 14px', textAlign: 'center', color: 'var(--gecko-text-secondary)', fontSize: 13 }}>
                      No partners match the current filters.
                    </td>
                  </tr>
                )}
                {filtered.map(p => {
                  const isSelected = selectedId === p.id;
                  const avatarBg = avatarColor(p.code);
                  const typeColors = PARTNER_TYPE_COLORS[p.type];
                  const connColors = CONNECTION_COLORS[p.connection];
                  return (
                    <tr
                      key={p.id}
                      onClick={() => { setSelectedId(p.id); setShowAdd(false); setConnTestState('idle'); }}
                      style={{
                        borderBottom: '1px solid var(--gecko-border)',
                        background: isSelected ? 'var(--gecko-primary-50)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--gecko-bg-subtle)'; }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      {/* Partner name + code */}
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: avatarBg, color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', flexShrink: 0,
                          }}>
                            {p.code.slice(0, 2)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--gecko-text-primary)', fontSize: 13 }}>{p.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', fontFamily: 'monospace' }}>{p.code}</div>
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td style={{ padding: '10px 14px' }}>
                        <Badge label={p.type} bg={typeColors.bg} color={typeColors.color} />
                      </td>

                      {/* Connection */}
                      <td style={{ padding: '10px 14px' }}>
                        <Badge label={p.connection} bg={connColors.bg} color={connColors.color} />
                      </td>

                      {/* Message Types */}
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 200 }}>
                          {p.messages.slice(0, 4).map(m => (
                            <span key={m} style={{
                              fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                              background: 'var(--gecko-bg-subtle)', color: 'var(--gecko-text-secondary)',
                              border: '1px solid var(--gecko-border)', fontFamily: 'monospace',
                            }}>{m}</span>
                          ))}
                          {p.messages.length > 4 && (
                            <span style={{
                              fontSize: 9, padding: '1px 5px', borderRadius: 3,
                              background: 'var(--gecko-bg-subtle)', color: 'var(--gecko-text-secondary)',
                            }}>+{p.messages.length - 4}</span>
                          )}
                        </div>
                      </td>

                      {/* Last Activity */}
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: 12, color: 'var(--gecko-text-primary)' }}>{p.lastActivity}</div>
                        {p.msgsToday > 0 && (
                          <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>
                            {p.msgsToday} msgs today
                          </div>
                        )}
                        {p.msgsToday === 0 && p.lastActivity !== '—' && (
                          <div style={{ fontSize: 10, color: 'var(--gecko-error-500)', marginTop: 2 }}>No msgs today</div>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '10px 14px' }}>
                        <StatusDot status={p.status} />
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button
                            className="gecko-btn gecko-btn-outline gecko-btn-sm"
                            onClick={e => { e.stopPropagation(); setSelectedId(p.id); setShowAdd(false); setConnTestState('idle'); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                            <Icon name="settings" size={12} /> Configure
                          </button>
                          <button
                            className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm"
                            onClick={e => e.stopPropagation()}
                            style={{ color: 'var(--gecko-text-secondary)' }}>
                            <Icon name="moreH" size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          <div style={{
            padding: '8px 16px', borderTop: '1px solid var(--gecko-border)',
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 11, color: 'var(--gecko-text-secondary)',
          }}>
            <Icon name="info" size={13} />
            Click a row to view and edit the partner&apos;s connection profile.
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--gecko-success-500)', display: 'inline-block' }} />
              Live sync active
            </span>
          </div>
        </div>

        {/* ── Detail / Add Panel ── */}
        {panelOpen && (
          <div style={{
            width: 340, flexShrink: 0,
            background: 'var(--gecko-bg-surface)',
            border: '1px solid var(--gecko-border)',
            borderRadius: 10, overflow: 'hidden',
            position: 'sticky', top: 80,
            boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
            maxHeight: 'calc(100vh - 100px)',
            display: 'flex', flexDirection: 'column',
          }}>

            {/* ── ADD PANEL ── */}
            {showAdd && (
              <>
                <div style={{
                  padding: '12px 16px', borderBottom: '1px solid var(--gecko-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--gecko-primary-600)',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Add EDI Partner</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>New trading partner profile</div>
                  </div>
                  <button
                    onClick={() => setShowAdd(false)}
                    className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm"
                    style={{ color: 'rgba(255,255,255,0.8)' }}>
                    <Icon name="x" size={16} />
                  </button>
                </div>

                <div style={{ padding: 16, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <SectionLabel>Partner Name</SectionLabel>
                    <input
                      className="gecko-input gecko-input-sm"
                      placeholder="e.g. Evergreen Marine"
                      value={addName}
                      onChange={e => setAddName(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <SectionLabel>Partner Code</SectionLabel>
                    <input
                      className="gecko-input gecko-input-sm"
                      placeholder="e.g. EGLV"
                      value={addCode}
                      onChange={e => setAddCode(e.target.value.toUpperCase())}
                      style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'monospace', textTransform: 'uppercase' }}
                    />
                  </div>
                  <div>
                    <SectionLabel>Partner Type</SectionLabel>
                    <div style={{ position: 'relative' }}>
                      <select
                        className="gecko-input gecko-input-sm"
                        value={addType}
                        onChange={e => setAddType(e.target.value as PartnerType)}
                        style={{ width: '100%', boxSizing: 'border-box', paddingRight: 28, appearance: 'none' }}>
                        <option>Shipping Line</option>
                        <option>Customs Authority</option>
                        <option>Port Authority</option>
                        <option>Haulier</option>
                        <option>Internal</option>
                      </select>
                      <Icon name="chevronDown" size={12} style={{
                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                        color: 'var(--gecko-text-secondary)', pointerEvents: 'none',
                      }} />
                    </div>
                  </div>
                  <div>
                    <SectionLabel>Connection Type</SectionLabel>
                    <div style={{ position: 'relative' }}>
                      <select
                        className="gecko-input gecko-input-sm"
                        value={addConn}
                        onChange={e => setAddConn(e.target.value as ConnectionType)}
                        style={{ width: '100%', boxSizing: 'border-box', paddingRight: 28, appearance: 'none' }}>
                        <option>SFTP</option>
                        <option>FTP</option>
                        <option>API</option>
                        <option>AS2</option>
                        <option>EMAIL</option>
                      </select>
                      <Icon name="chevronDown" size={12} style={{
                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                        color: 'var(--gecko-text-secondary)', pointerEvents: 'none',
                      }} />
                    </div>
                  </div>

                  <div style={{
                    padding: '10px 12px', borderRadius: 8,
                    background: 'var(--gecko-primary-50)', border: '1px solid var(--gecko-primary-100)',
                    display: 'flex', gap: 8, alignItems: 'flex-start',
                  }}>
                    <Icon name="info" size={14} style={{ color: 'var(--gecko-primary-600)', flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 11, color: 'var(--gecko-primary-800)', lineHeight: 1.5 }}>
                      Connection credentials and message types can be configured after the partner is created.
                    </span>
                  </div>
                </div>

                <div style={{
                  padding: '12px 16px', borderTop: '1px solid var(--gecko-border)',
                  display: 'flex', gap: 8, justifyContent: 'flex-end',
                  background: 'var(--gecko-bg-subtle)',
                }}>
                  <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
                  <button
                    className="gecko-btn gecko-btn-primary gecko-btn-sm"
                    onClick={handleAddPartner}
                    disabled={!addName.trim() || !addCode.trim()}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="plus" size={13} /> Save Partner
                  </button>
                </div>
              </>
            )}

            {/* ── DETAIL PANEL ── */}
            {!showAdd && selectedPartner && (() => {
              const p = selectedPartner;
              const headerBg = PARTNER_TYPE_COLORS[p.type].header;
              return (
                <>
                  {/* Panel header */}
                  <div style={{
                    padding: '12px 16px', borderBottom: '1px solid var(--gecko-border)',
                    background: headerBg, flexShrink: 0,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 8,
                          background: 'rgba(255,255,255,0.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: '0.04em', flexShrink: 0,
                        }}>
                          {p.code.slice(0, 2)}
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{p.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <span style={{
                              fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
                              color: 'rgba(255,255,255,0.8)',
                              background: 'rgba(255,255,255,0.15)', padding: '1px 6px', borderRadius: 3,
                            }}>{p.code}</span>
                            <span style={{
                              fontSize: 10, fontWeight: 700,
                              color: p.status === 'Active' ? '#86efac' : p.status === 'Error' ? '#fca5a5' : 'rgba(255,255,255,0.6)',
                              background: 'rgba(255,255,255,0.12)', padding: '1px 7px', borderRadius: 10,
                              display: 'flex', alignItems: 'center', gap: 4,
                            }}>
                              <span style={{
                                width: 5, height: 5, borderRadius: '50%',
                                background: p.status === 'Active' ? '#86efac' : p.status === 'Error' ? '#fca5a5' : 'rgba(255,255,255,0.5)',
                                display: 'inline-block',
                              }} />
                              {p.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedId(null)}
                        className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm"
                        style={{ color: 'rgba(255,255,255,0.8)', flexShrink: 0 }}>
                        <Icon name="x" size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Scrollable body */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>

                    {/* ── Connection Settings ── */}
                    <div>
                      <SectionLabel>Connection Settings</SectionLabel>
                      <div style={{
                        background: 'var(--gecko-bg-subtle)', borderRadius: 8,
                        border: '1px solid var(--gecko-border)', overflow: 'hidden',
                      }}>
                        {[
                          { label: 'Type',    value: p.connection, badge: true  },
                          { label: 'Host',    value: p.host,       badge: false },
                          { label: 'Port',    value: String(p.port), badge: false },
                          { label: 'Username', value: p.username,  badge: false },
                        ].map(({ label, value, badge }, i) => (
                          <div key={label} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '7px 12px',
                            borderBottom: i < 3 ? '1px solid var(--gecko-border)' : 'none',
                          }}>
                            <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 500 }}>{label}</span>
                            {badge ? (
                              <Badge label={value} bg={CONNECTION_COLORS[p.connection].bg} color={CONNECTION_COLORS[p.connection].color} />
                            ) : (
                              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-text-primary)', fontFamily: label !== 'Port' ? 'monospace' : 'inherit' }}>{value}</span>
                            )}
                          </div>
                        ))}

                        {/* Password */}
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '7px 12px', borderTop: '1px solid var(--gecko-border)',
                        }}>
                          <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 500 }}>Password</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-text-primary)', fontFamily: 'monospace', letterSpacing: '0.12em' }}>
                              {showPassword ? 'L0g!c0n_s3cure' : '••••••••'}
                            </span>
                            <button
                              onClick={() => setShowPassword(s => !s)}
                              className="gecko-btn gecko-btn-ghost gecko-btn-icon gecko-btn-sm"
                              style={{ color: 'var(--gecko-text-secondary)', width: 22, height: 22 }}
                              title={showPassword ? 'Hide' : 'Show'}>
                              <Icon name={showPassword ? 'eyeOff' : 'eye'} size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Directories */}
                        {[
                          { label: 'Inbound Dir',  value: p.inboundDir  },
                          { label: 'Outbound Dir', value: p.outboundDir },
                        ].map(({ label, value }) => (
                          <div key={label} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '7px 12px', borderTop: '1px solid var(--gecko-border)',
                          }}>
                            <span style={{ fontSize: 11, color: 'var(--gecko-text-secondary)', fontWeight: 500 }}>{label}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gecko-text-primary)', fontFamily: 'monospace' }}>{value}</span>
                          </div>
                        ))}
                      </div>

                      {/* Test Connection */}
                      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          className="gecko-btn gecko-btn-outline gecko-btn-sm"
                          onClick={handleTestConnection}
                          disabled={connTestState === 'testing'}
                          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {connTestState === 'testing' ? (
                            <><Icon name="refresh" size={13} style={{ animation: 'spin 1s linear infinite' }} /> Testing…</>
                          ) : (
                            <><Icon name="zap" size={13} /> Test Connection</>
                          )}
                        </button>
                        {connTestState === 'ok' && (
                          <span style={{ fontSize: 12, color: 'var(--gecko-success-600)', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
                            <Icon name="checkCircle" size={14} /> Connected
                          </span>
                        )}
                        {connTestState === 'fail' && (
                          <span style={{ fontSize: 12, color: 'var(--gecko-error-600)', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
                            <Icon name="alertCircle" size={14} /> Failed
                          </span>
                        )}
                      </div>
                    </div>

                    <Divider />

                    {/* ── Message Types ── */}
                    <div>
                      <SectionLabel>Message Types</SectionLabel>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {p.msgTypes.map(m => (
                          <div key={m.code} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 10px', borderRadius: 7,
                            background: 'var(--gecko-bg-subtle)', border: '1px solid var(--gecko-border)',
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: 'var(--gecko-text-primary)' }}>{m.code}</span>
                                <span style={{
                                  fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                                  background: m.direction === 'IN' ? 'var(--gecko-primary-50)' : m.direction === 'OUT' ? 'var(--gecko-success-50)' : 'var(--gecko-warning-50)',
                                  color: m.direction === 'IN' ? 'var(--gecko-primary-700)' : m.direction === 'OUT' ? 'var(--gecko-success-700)' : 'var(--gecko-warning-700)',
                                }}>
                                  {m.direction === 'IN' ? '↓ IN' : m.direction === 'OUT' ? '↑ OUT' : '↕ BOTH'}
                                </span>
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>{m.description}</div>
                              <div style={{ fontSize: 9, color: 'var(--gecko-text-disabled)', marginTop: 1 }}>Last: {m.lastReceived}</div>
                            </div>
                            {/* Toggle */}
                            <button
                              onClick={() => handleToggleMsgType(p.id, m.code)}
                              style={{
                                width: 34, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer',
                                background: m.active ? 'var(--gecko-success-500)' : 'var(--gecko-border)',
                                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                              }}
                              title={m.active ? 'Disable' : 'Enable'}
                            >
                              <span style={{
                                position: 'absolute', top: 2, left: m.active ? 18 : 2,
                                width: 14, height: 14, borderRadius: '50%',
                                background: '#fff', transition: 'left 0.2s',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                              }} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Divider />

                    {/* ── Activity Log ── */}
                    <div>
                      <SectionLabel>Recent Activity</SectionLabel>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {p.activityLog.map((entry, i) => (
                          <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '6px 10px', borderRadius: 6,
                            background: 'var(--gecko-bg-subtle)', border: '1px solid var(--gecko-border)',
                          }}>
                            <Icon
                              name={entry.direction === 'IN' ? 'arrowLeft' : 'arrowRight'}
                              size={13}
                              style={{ color: entry.direction === 'IN' ? 'var(--gecko-primary-500)' : 'var(--gecko-success-500)', flexShrink: 0 }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: 'var(--gecko-text-primary)' }}>{entry.msgType}</span>
                                <span style={{
                                  fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                                  background: entry.status === 'OK' ? 'var(--gecko-success-50)' : 'var(--gecko-error-50)',
                                  color: entry.status === 'OK' ? 'var(--gecko-success-700)' : 'var(--gecko-error-700)',
                                }}>
                                  {entry.status === 'OK' ? '✓ OK' : '✗ Error'}
                                </span>
                              </div>
                              <div style={{ fontSize: 9, color: 'var(--gecko-text-disabled)', marginTop: 1 }}>{entry.ts}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* Panel footer */}
                  <div style={{
                    padding: '12px 16px', borderTop: '1px solid var(--gecko-border)',
                    display: 'flex', gap: 8,
                    background: 'var(--gecko-bg-subtle)', flexShrink: 0,
                  }}>
                    <Link href={`/config/edi-partners/${selectedPartner?.id ?? ''}`} style={{ flex: 1, textDecoration: 'none' }}>
                      <button
                        className="gecko-btn gecko-btn-outline gecko-btn-sm"
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <Icon name="edit" size={13} /> Edit Full Profile
                      </button>
                    </Link>
                    <button
                      className="gecko-btn gecko-btn-ghost gecko-btn-sm"
                      style={{ color: 'var(--gecko-error-600)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Icon name="x" size={13} /> Disable
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── Info banner ── */}
      <div style={{
        padding: '11px 16px',
        background: 'var(--gecko-primary-50)',
        border: '1px solid var(--gecko-primary-100)',
        borderRadius: 8,
        display: 'flex', gap: 12, alignItems: 'flex-start',
      }}>
        <Icon name="shieldCheck" size={15} style={{ color: 'var(--gecko-primary-600)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12, color: 'var(--gecko-primary-800)', lineHeight: 1.6 }}>
          <strong>EDI Partners</strong> define how the TOS exchanges operational messages (BAPLIE, COPRAR, CUSCAR, etc.) with shipping lines, customs, and port authorities.
          All credentials are encrypted at rest. Use <strong>Test Connection</strong> to verify live connectivity before enabling a partner.
          Message toggles take effect immediately — disabling a type will queue incoming messages of that type for manual review.
        </div>
      </div>

    </div>
  );
}
