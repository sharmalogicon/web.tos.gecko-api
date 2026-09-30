"use client";
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { ExportButton } from '@/components/ui/ExportButton';
import { RefreshButton } from '@/components/ui/RefreshButton';

// ─── Types ─────────────────────────────────────────────────────────────────────

type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'ARRIVED' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';
type Direction = 'GATE_IN' | 'GATE_OUT';
type MovementType = 'IN_LADEN' | 'IN_EMPTY_RETURN' | 'IN_EMPTY_HIRE_RETURN' | 'OUT_LADEN' | 'OUT_EMPTY_HIRE_OUT';
type DateFilter = 'TODAY' | 'TOMORROW' | 'WEEK' | 'ALL';

interface AppointmentRow {
  id: string;
  apptNo: string;
  slotDate: string;        // ISO date — 2026-05-13
  slotStart: string;       // HH:mm — 08:00
  slotEnd: string;         // HH:mm — 08:30
  status: AppointmentStatus;
  direction: Direction;
  movement: MovementType;
  containerNo?: string;
  containerType: string;
  bookingNo?: string;
  carrierLine: string;
  customer: string;
  truckerName: string;
  truckerCompany: string;
  vehiclePlate: string;
  vehicleType: '6W' | '10W' | '18W' | '22W';
  driverPhone: string;
  bookedAt: string;
  arrivedAt?: string;
  completedAt?: string;
  notes?: string;
}

// ─── Mock data (today = 2026-05-13, tomorrow = 2026-05-14) ──────────────────────

const TODAY = '2026-05-13';
const TOMORROW = '2026-05-14';
const D_PLUS_2 = '2026-05-15';
const D_PLUS_3 = '2026-05-16';

const APPOINTMENTS: AppointmentRow[] = [
  // Completed (early morning, already processed)
  { id: 'a1',  apptNo: 'APT-2605-0142', slotDate: TODAY, slotStart: '06:30', slotEnd: '07:00', status: 'COMPLETED', direction: 'GATE_OUT', movement: 'OUT_LADEN',          containerNo: 'MAEU8842710', containerType: '40HC', bookingNo: 'MAEU4260419834', carrierLine: 'MAERSK',     customer: 'BANGCHAK CORPORATION PCL',         truckerName: 'Somchai Phongphan',  truckerCompany: 'LCB Express Transport',    vehiclePlate: '70-1234 ฉท', vehicleType: '18W', driverPhone: '+66-89-447-8821', bookedAt: '2026-05-12T14:22:00+07:00', arrivedAt: '2026-05-13T06:35:00+07:00', completedAt: '2026-05-13T06:58:00+07:00' },
  { id: 'a2',  apptNo: 'APT-2605-0143', slotDate: TODAY, slotStart: '07:00', slotEnd: '07:30', status: 'COMPLETED', direction: 'GATE_IN',  movement: 'IN_LADEN',           containerNo: 'COSU4129877', containerType: '20GP', bookingNo: 'COSCO2604081142',  carrierLine: 'COSCO',      customer: 'THAI UNION GROUP PCL',             truckerName: 'Niran Saetang',      truckerCompany: 'Thai Logistics Co.',       vehiclePlate: '71-5678 บก', vehicleType: '10W', driverPhone: '+66-81-238-9912', bookedAt: '2026-05-12T15:01:00+07:00', arrivedAt: '2026-05-13T07:11:00+07:00', completedAt: '2026-05-13T07:24:00+07:00' },
  { id: 'a3',  apptNo: 'APT-2605-0144', slotDate: TODAY, slotStart: '07:30', slotEnd: '08:00', status: 'COMPLETED', direction: 'GATE_IN',  movement: 'IN_EMPTY_RETURN',    containerNo: 'EGHU7710022', containerType: '40HC',                                carrierLine: 'EVERGREEN',  customer: 'TCL ELECTRONICS (THAILAND)',       truckerName: 'Wirat Choomdej',     truckerCompany: 'Eastern Sea Transport',    vehiclePlate: '70-9911 ขฉ', vehicleType: '18W', driverPhone: '+66-90-127-4408', bookedAt: '2026-05-12T16:30:00+07:00', arrivedAt: '2026-05-13T07:42:00+07:00', completedAt: '2026-05-13T07:55:00+07:00' },

  // Arrived (being processed right now)
  { id: 'a4',  apptNo: 'APT-2605-0145', slotDate: TODAY, slotStart: '08:00', slotEnd: '08:30', status: 'ARRIVED',   direction: 'GATE_OUT', movement: 'OUT_LADEN',          containerNo: 'OOLU6620114', containerType: '40HC', bookingNo: 'OOLU2604022341',   carrierLine: 'OOCL',       customer: 'SIAM CEMENT GROUP (SCG)',          truckerName: 'Phaiboon Kasem',     truckerCompany: 'SCG Logistics',            vehiclePlate: '70-2244 พท', vehicleType: '22W', driverPhone: '+66-86-541-3322', bookedAt: '2026-05-12T17:14:00+07:00', arrivedAt: '2026-05-13T08:04:00+07:00' },
  { id: 'a5',  apptNo: 'APT-2605-0146', slotDate: TODAY, slotStart: '08:00', slotEnd: '08:30', status: 'ARRIVED',   direction: 'GATE_IN',  movement: 'IN_EMPTY_HIRE_RETURN', containerNo: 'CMAU5523140', containerType: '20RF',                                carrierLine: 'CMA CGM',    customer: 'CHAROEN POKPHAND (CP) GROUP',      truckerName: 'Anuwat Boonyarat',   truckerCompany: 'CP Trucking Division',     vehiclePlate: '71-1188 ฉก', vehicleType: '10W', driverPhone: '+66-89-661-2200', bookedAt: '2026-05-12T17:55:00+07:00', arrivedAt: '2026-05-13T08:07:00+07:00' },

  // Confirmed — upcoming today
  { id: 'a6',  apptNo: 'APT-2605-0147', slotDate: TODAY, slotStart: '08:30', slotEnd: '09:00', status: 'CONFIRMED', direction: 'GATE_IN',  movement: 'IN_LADEN',           containerNo: 'YMLU2287104', containerType: '40HC', bookingNo: 'YMLU4260388001',   carrierLine: 'YANG MING',  customer: 'CENTRAL RETAIL CORPORATION',       truckerName: 'Chaiwat Suwannapon', truckerCompany: 'Central Logistics Ltd.',   vehiclePlate: '70-7732 ขท', vehicleType: '18W', driverPhone: '+66-84-117-5566', bookedAt: '2026-05-12T18:20:00+07:00' },
  { id: 'a7',  apptNo: 'APT-2605-0148', slotDate: TODAY, slotStart: '09:00', slotEnd: '09:30', status: 'CONFIRMED', direction: 'GATE_OUT', movement: 'OUT_EMPTY_HIRE_OUT', containerNo: 'MSCU7720045', containerType: '20GP',                                carrierLine: 'MSC',        customer: 'INDORAMA VENTURES PCL',            truckerName: 'Prasert Wongsa',     truckerCompany: 'Indorama Transport',       vehiclePlate: '71-3380 บฉ', vehicleType: '10W', driverPhone: '+66-81-902-7711', bookedAt: '2026-05-13T05:12:00+07:00' },
  { id: 'a8',  apptNo: 'APT-2605-0149', slotDate: TODAY, slotStart: '09:30', slotEnd: '10:00', status: 'CONFIRMED', direction: 'GATE_IN',  movement: 'IN_LADEN',           containerNo: 'HLBU4451093', containerType: '40HC', bookingNo: 'HLCU4260411078',   carrierLine: 'HAPAG-LLOYD', customer: 'PTT GLOBAL CHEMICAL',              truckerName: 'Sakda Manopichai',   truckerCompany: 'PTT GC Logistics',         vehiclePlate: '70-5519 พฉ', vehicleType: '22W', driverPhone: '+66-87-441-9023', bookedAt: '2026-05-13T06:00:00+07:00' },
  { id: 'a9',  apptNo: 'APT-2605-0150', slotDate: TODAY, slotStart: '10:00', slotEnd: '10:30', status: 'CONFIRMED', direction: 'GATE_OUT', movement: 'OUT_LADEN',          containerNo: 'MAEU3349821', containerType: '40HC', bookingNo: 'MAEU4260419834',   carrierLine: 'MAERSK',     customer: 'AEON CO. (THAILAND)',              truckerName: 'Theerasak Promma',   truckerCompany: 'AEON Logistics TH',        vehiclePlate: '70-8841 ขก', vehicleType: '18W', driverPhone: '+66-85-720-4413', bookedAt: '2026-05-13T06:33:00+07:00' },
  { id: 'a10', apptNo: 'APT-2605-0151', slotDate: TODAY, slotStart: '10:30', slotEnd: '11:00', status: 'CONFIRMED', direction: 'GATE_IN',  movement: 'IN_EMPTY_RETURN',    containerNo: 'TGHU5641227', containerType: '40RF',                                carrierLine: 'EVERGREEN',  customer: 'CHAROEN POKPHAND FOODS PCL',       truckerName: 'Manop Kittipong',    truckerCompany: 'Frozen Logistics',         vehiclePlate: '71-2244 ฉบ', vehicleType: '10W', driverPhone: '+66-89-555-1188', bookedAt: '2026-05-13T07:11:00+07:00' },

  // Pending — booked but not yet confirmed
  { id: 'a11', apptNo: 'APT-2605-0152', slotDate: TODAY, slotStart: '11:00', slotEnd: '11:30', status: 'PENDING',   direction: 'GATE_OUT', movement: 'OUT_LADEN',          containerNo: 'COSU8810244', containerType: '20GP', bookingNo: 'COSU4260407771',   carrierLine: 'COSCO',      customer: 'INDORAMA VENTURES PCL',            truckerName: 'Wanchai Srisuk',     truckerCompany: 'Indorama Transport',       vehiclePlate: '71-9923 พฉ', vehicleType: '10W', driverPhone: '+66-92-441-7788', bookedAt: '2026-05-13T07:45:00+07:00' },
  { id: 'a12', apptNo: 'APT-2605-0153', slotDate: TODAY, slotStart: '13:00', slotEnd: '13:30', status: 'PENDING',   direction: 'GATE_IN',  movement: 'IN_LADEN',           containerNo: 'APLU5571009', containerType: '40HC', bookingNo: 'APLU4260319102',   carrierLine: 'APL',        customer: 'CP GROUP (CHAROEN POKPHAND)',      truckerName: 'Surasak Phaisan',    truckerCompany: 'CP Trucking Division',     vehiclePlate: '70-4421 ขก', vehicleType: '18W', driverPhone: '+66-89-117-3322', bookedAt: '2026-05-13T07:50:00+07:00' },

  // No-show — slot expired without arrival
  { id: 'a13', apptNo: 'APT-2605-0140', slotDate: TODAY, slotStart: '06:00', slotEnd: '06:30', status: 'NO_SHOW',   direction: 'GATE_OUT', movement: 'OUT_EMPTY_HIRE_OUT', containerNo: 'EGHU8841200', containerType: '20GP',                                carrierLine: 'EVERGREEN',  customer: 'BANGKOK GLASS PCL',                truckerName: 'Phongsak Chuenkam',  truckerCompany: 'BG Logistics',             vehiclePlate: '71-7799 บท', vehicleType: '6W',  driverPhone: '+66-87-220-1199', bookedAt: '2026-05-12T13:10:00+07:00', notes: 'Trucker rang gate at 09:30; slot already expired.' },

  // Cancelled
  { id: 'a14', apptNo: 'APT-2605-0141', slotDate: TODAY, slotStart: '07:30', slotEnd: '08:00', status: 'CANCELLED', direction: 'GATE_IN',  movement: 'IN_LADEN',           containerNo: 'OOLU3398117', containerType: '40HC', bookingNo: 'OOLU2604022341',   carrierLine: 'OOCL',       customer: 'SIAM CEMENT GROUP (SCG)',          truckerName: 'Adisak Kaewdee',     truckerCompany: 'SCG Logistics',            vehiclePlate: '70-1144 ฉท', vehicleType: '22W', driverPhone: '+66-89-771-3344', bookedAt: '2026-05-12T15:33:00+07:00', notes: 'Cancelled by trucker — vehicle breakdown.' },

  // Tomorrow — confirmed
  { id: 'a15', apptNo: 'APT-2605-0160', slotDate: TOMORROW, slotStart: '06:30', slotEnd: '07:00', status: 'CONFIRMED', direction: 'GATE_OUT', movement: 'OUT_LADEN',          containerNo: 'MAEU9912034', containerType: '40HC', bookingNo: 'MAEU4260419834',   carrierLine: 'MAERSK',     customer: 'PTT GLOBAL CHEMICAL',              truckerName: 'Boonchu Saiyot',     truckerCompany: 'PTT GC Logistics',         vehiclePlate: '70-3322 ขท', vehicleType: '22W', driverPhone: '+66-89-441-9988', bookedAt: '2026-05-13T08:01:00+07:00' },
  { id: 'a16', apptNo: 'APT-2605-0161', slotDate: TOMORROW, slotStart: '07:00', slotEnd: '07:30', status: 'CONFIRMED', direction: 'GATE_IN',  movement: 'IN_LADEN',           containerNo: 'MSCU1129087', containerType: '20GP', bookingNo: 'MSMU7226041109',   carrierLine: 'MSC',        customer: 'MINOR INTERNATIONAL PCL',          truckerName: 'Nattawut Thongsuk',  truckerCompany: 'Minor Logistics',          vehiclePlate: '71-5500 บก', vehicleType: '10W', driverPhone: '+66-87-332-1100', bookedAt: '2026-05-13T08:30:00+07:00' },
  { id: 'a17', apptNo: 'APT-2605-0162', slotDate: TOMORROW, slotStart: '08:30', slotEnd: '09:00', status: 'CONFIRMED', direction: 'GATE_IN',  movement: 'IN_LADEN',           containerNo: 'YMLU8810339', containerType: '40HC', bookingNo: 'YMLU4260388001',   carrierLine: 'YANG MING',  customer: 'CENTRAL RETAIL CORPORATION',       truckerName: 'Pongpat Wiriya',     truckerCompany: 'Central Logistics Ltd.',   vehiclePlate: '70-9988 พบ', vehicleType: '18W', driverPhone: '+66-92-117-4455', bookedAt: '2026-05-13T09:00:00+07:00' },

  // Tomorrow — pending
  { id: 'a18', apptNo: 'APT-2605-0163', slotDate: TOMORROW, slotStart: '14:00', slotEnd: '14:30', status: 'PENDING',   direction: 'GATE_OUT', movement: 'OUT_LADEN',          containerNo: 'HLBU9923345', containerType: '40HC', bookingNo: 'HLCU4260411078',   carrierLine: 'HAPAG-LLOYD', customer: 'PTT GLOBAL CHEMICAL',              truckerName: 'Anan Phromma',       truckerCompany: 'PTT GC Logistics',         vehiclePlate: '70-6611 ฉบ', vehicleType: '22W', driverPhone: '+66-89-220-3344', bookedAt: '2026-05-13T09:30:00+07:00' },

  // D+2 / D+3
  { id: 'a19', apptNo: 'APT-2605-0170', slotDate: D_PLUS_2, slotStart: '09:00', slotEnd: '09:30', status: 'CONFIRMED', direction: 'GATE_IN',  movement: 'IN_LADEN',           containerNo: 'APLU6620881', containerType: '40HC', bookingNo: 'APLU4260319102',   carrierLine: 'APL',        customer: 'CP GROUP (CHAROEN POKPHAND)',      truckerName: 'Suthep Wongsuwan',   truckerCompany: 'CP Trucking Division',     vehiclePlate: '70-1100 ขก', vehicleType: '18W', driverPhone: '+66-87-441-2200', bookedAt: '2026-05-13T08:45:00+07:00' },
  { id: 'a20', apptNo: 'APT-2605-0171', slotDate: D_PLUS_3, slotStart: '11:00', slotEnd: '11:30', status: 'PENDING',   direction: 'GATE_IN',  movement: 'IN_LADEN',           containerNo: 'COSU3398770', containerType: '20GP', bookingNo: 'COSCO2604081142',  carrierLine: 'COSCO',      customer: 'THAI UNION GROUP PCL',             truckerName: 'Ratchanon Kasem',    truckerCompany: 'Thai Logistics Co.',       vehiclePlate: '71-8800 บฉ', vehicleType: '10W', driverPhone: '+66-89-555-7799', bookedAt: '2026-05-13T07:20:00+07:00' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_META: Record<AppointmentStatus, { label: string; color: string; bg: string; border: string }> = {
  PENDING:   { label: 'Pending',   color: 'var(--gecko-warning-700)', bg: 'var(--gecko-warning-50)', border: 'var(--gecko-warning-200)' },
  CONFIRMED: { label: 'Confirmed', color: 'var(--gecko-primary-700)', bg: 'var(--gecko-primary-50)', border: 'var(--gecko-primary-200)' },
  ARRIVED:   { label: 'Arrived',   color: 'var(--gecko-success-700)', bg: 'var(--gecko-success-50)', border: 'var(--gecko-success-200)' },
  COMPLETED: { label: 'Completed', color: 'var(--gecko-text-secondary)', bg: 'var(--gecko-bg-subtle)', border: 'var(--gecko-border)' },
  NO_SHOW:   { label: 'No-show',   color: 'var(--gecko-danger-700)',  bg: 'var(--gecko-danger-50)',  border: 'var(--gecko-danger-200)' },
  CANCELLED: { label: 'Cancelled', color: 'var(--gecko-text-disabled)', bg: 'var(--gecko-bg-subtle)', border: 'var(--gecko-border)' },
};

const MOVEMENT_LABEL: Record<MovementType, string> = {
  IN_LADEN:             'Laden in',
  IN_EMPTY_RETURN:      'Empty return',
  IN_EMPTY_HIRE_RETURN: 'Empty hire return',
  OUT_LADEN:            'Laden out',
  OUT_EMPTY_HIRE_OUT:   'Empty hire out',
};

function formatDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2,'0')} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]}`;
}

function shortDay(iso: string) {
  const d = new Date(iso);
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return days[d.getDay()];
}

function inDateFilter(date: string, filter: DateFilter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'TODAY') return date === TODAY;
  if (filter === 'TOMORROW') return date === TOMORROW;
  // WEEK: today through D+6
  const d = new Date(date).getTime();
  const start = new Date(TODAY).getTime();
  const end = start + 6 * 86400000;
  return d >= start && d <= end;
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function GateAppointmentsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('TODAY');
  const [dirFilter, setDirFilter] = useState<Direction | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'ALL'>('ALL');

  const filtered = useMemo(() => {
    return APPOINTMENTS
      .filter(a => {
        if (!inDateFilter(a.slotDate, dateFilter)) return false;
        if (dirFilter !== 'ALL' && a.direction !== dirFilter) return false;
        if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            a.apptNo.toLowerCase().includes(q) ||
            (a.containerNo?.toLowerCase().includes(q) ?? false) ||
            (a.bookingNo?.toLowerCase().includes(q) ?? false) ||
            a.truckerName.toLowerCase().includes(q) ||
            a.vehiclePlate.toLowerCase().includes(q) ||
            a.carrierLine.toLowerCase().includes(q) ||
            a.customer.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        const dateCmp = a.slotDate.localeCompare(b.slotDate);
        if (dateCmp !== 0) return dateCmp;
        return a.slotStart.localeCompare(b.slotStart);
      });
  }, [search, dateFilter, dirFilter, statusFilter]);

  const scoped = useMemo(() => APPOINTMENTS.filter(a => inDateFilter(a.slotDate, dateFilter)), [dateFilter]);
  const kpis = useMemo(() => ({
    total:     scoped.length,
    confirmed: scoped.filter(a => a.status === 'CONFIRMED').length,
    arrived:   scoped.filter(a => a.status === 'ARRIVED').length,
    completed: scoped.filter(a => a.status === 'COMPLETED').length,
    noShow:    scoped.filter(a => a.status === 'NO_SHOW').length,
    pending:   scoped.filter(a => a.status === 'PENDING').length,
  }), [scoped]);

  const dateScopeLabel = dateFilter === 'TODAY' ? 'today' : dateFilter === 'TOMORROW' ? 'tomorrow' : dateFilter === 'WEEK' ? 'this week' : 'all';

  const onRowClick = (id: string) => {
    // Stash the appointment id so the gate desk can prefill in a real impl.
    // Today this is one-way navigation only; the desk doesn't yet read it.
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('gecko.activeAppointmentId', id);
    }
    router.push('/gate/desk');
  };

  return (
    <div className="gecko-stack gecko-stack-lg">

      {/* ── Toolbar ── */}
      <div className="gecko-page-header">
        <div className="gecko-page-header-left">
          <div className="gecko-row">
            <h1 className="gecko-page-title">Gate Appointments</h1>
            <span className="gecko-pill gecko-pill-primary">{filtered.length} of {scoped.length}</span>
          </div>
          <p className="gecko-page-subtitle">
            Time-slot bookings for trucker arrivals — Laem Chabang ICD · Import Yard
          </p>
        </div>
        <div className="gecko-page-header-actions">
          <ExportButton resource="Appointments" iconSize={13} />
          <RefreshButton resource="Appointments" iconSize={13} />
          <Link href="#new-appointment" onClick={(e) => { e.preventDefault(); alert('New appointment flow arrives in Phase 4.5 (VBS module).'); }} className="gecko-btn gecko-btn-primary gecko-btn-sm gecko-inline-row">
            <Icon name="plus" size={13} />New Appointment
          </Link>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
        {([
          { label: `Total ${dateScopeLabel}`, value: kpis.total,     icon: 'calendar',    tone: 'primary' as const },
          { label: 'Pending',                 value: kpis.pending,   icon: 'clock',       tone: 'warning' as const },
          { label: 'Confirmed',               value: kpis.confirmed, icon: 'checkCircle', tone: 'primary' as const },
          { label: 'Arrived',                 value: kpis.arrived,   icon: 'truck',       tone: 'success' as const },
          { label: 'Completed',               value: kpis.completed, icon: 'check',       tone: 'neutral' as const },
          { label: 'No-shows',                value: kpis.noShow,    icon: 'alertCircle', tone: 'danger'  as const },
        ]).map(k => (
          <div key={k.label} className="gecko-kpi-tile">
            <div className={`gecko-kpi-tile-icon gecko-kpi-tile-icon-${k.tone}`}>
              <Icon name={k.icon} size={17} />
            </div>
            <div>
              <div className="gecko-kpi-tile-value">{k.value}</div>
              <div className="gecko-kpi-tile-label">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters + Search ── */}
      <div className="gecko-row gecko-row-wrap">
        {/* Date scope toggle */}
        <div className="gecko-segctrl">
          {([
            { v: 'TODAY',    l: 'Today' },
            { v: 'TOMORROW', l: 'Tomorrow' },
            { v: 'WEEK',     l: 'This Week' },
            { v: 'ALL',      l: 'All' },
          ] as const).map(d => (
            <button key={d.v} onClick={() => setDateFilter(d.v)} className={`gecko-segctrl-btn${dateFilter === d.v ? ' gecko-segctrl-btn-active' : ''}`}>{d.l}</button>
          ))}
        </div>

        {/* Direction toggle */}
        <div className="gecko-segctrl">
          {(['ALL', 'GATE_IN', 'GATE_OUT'] as const).map(d => (
            <button key={d} onClick={() => setDirFilter(d)} className={`gecko-segctrl-btn${dirFilter === d ? ' gecko-segctrl-btn-active' : ''}`} style={{
              color: dirFilter === d ? (d === 'GATE_IN' ? 'var(--gecko-info-700)' : d === 'GATE_OUT' ? 'var(--gecko-primary-700)' : undefined) : undefined,
            }}>{d === 'ALL' ? 'All' : d === 'GATE_IN' ? '↓ Gate-In' : '↑ Gate-Out'}</button>
          ))}
        </div>

        {/* Status filter */}
        <select className="gecko-input gecko-input-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value as AppointmentStatus | 'ALL')}
          style={{ width: 140, fontSize: 12 }}>
          <option value="ALL">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="ARRIVED">Arrived</option>
          <option value="COMPLETED">Completed</option>
          <option value="NO_SHOW">No-show</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        {/* Search */}
        <div className="gecko-filter-bar-search" style={{ maxWidth: 380 }}>
          <Icon name="search" size={14} className="gecko-filter-bar-search-icon" />
          <input className="gecko-input gecko-input-sm gecko-filter-bar-search-input" placeholder="Search appt #, container, trucker, plate, booking…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ paddingRight: search ? 30 : 10 }} />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gecko-text-disabled)', padding: 0, lineHeight: 1 }}>
              <Icon name="x" size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="gecko-table-card">
        <div style={{ overflowX: 'auto' }}>
          <table className="gecko-table">
            <thead>
              <tr>
                {[
                  'Slot', 'Status', 'Direction', 'Container', 'Movement', 'Trucker', 'Vehicle', 'Carrier', 'Customer', '',
                ].map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '40px 12px', color: 'var(--gecko-text-secondary)' }}>
                    <Icon name="search" size={18} />
                    <div className="gecko-mt-2">No appointments match the current filters.</div>
                  </td>
                </tr>
              )}
              {filtered.map(a => {
                const s = STATUS_META[a.status];
                const isPast = a.status === 'COMPLETED' || a.status === 'CANCELLED';
                return (
                  <tr key={a.id}
                    onClick={() => onRowClick(a.id)}
                    style={{
                      cursor: 'pointer',
                      opacity: isPast ? 0.72 : 1,
                    }}
                  >
                    {/* Slot */}
                    <td style={{ verticalAlign: 'top' }}>
                      <div className="gecko-mono-strong">
                        {a.slotStart}–{a.slotEnd}
                      </div>
                      <div className="gecko-cell-meta">
                        {shortDay(a.slotDate)} · {formatDate(a.slotDate)}
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ verticalAlign: 'top' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 11, fontWeight: 600,
                        padding: '2px 8px', borderRadius: 20,
                        background: s.bg, color: s.color,
                        border: `1px solid ${s.border}`,
                        whiteSpace: 'nowrap',
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                        {s.label}
                      </span>
                    </td>

                    {/* Direction */}
                    <td style={{ verticalAlign: 'top' }}>
                      <div className="gecko-inline-row" style={{
                        fontWeight: 600, fontSize: 12,
                        color: a.direction === 'GATE_IN' ? 'var(--gecko-info-700)' : 'var(--gecko-primary-700)',
                      }}>
                        <Icon name={a.direction === 'GATE_IN' ? 'arrowDown' : 'arrowUp'} size={13} />
                        {a.direction === 'GATE_IN' ? 'Gate-In' : 'Gate-Out'}
                      </div>
                    </td>

                    {/* Container */}
                    <td style={{ verticalAlign: 'top' }}>
                      {a.containerNo ? (
                        <div className="gecko-cell-primary" style={{ fontFamily: 'var(--gecko-font-mono)' }}>{a.containerNo}</div>
                      ) : (
                        <div style={{ color: 'var(--gecko-text-disabled)', fontStyle: 'italic' }}>—</div>
                      )}
                      <div className="gecko-cell-meta">
                        {a.containerType}{a.bookingNo ? ` · ${a.bookingNo}` : ''}
                      </div>
                    </td>

                    {/* Movement */}
                    <td style={{ verticalAlign: 'top' }}>
                      <div>{MOVEMENT_LABEL[a.movement]}</div>
                    </td>

                    {/* Trucker */}
                    <td style={{ verticalAlign: 'top' }}>
                      <div>{a.truckerName}</div>
                      <div className="gecko-cell-meta">{a.truckerCompany}</div>
                    </td>

                    {/* Vehicle */}
                    <td style={{ verticalAlign: 'top' }}>
                      <div className="gecko-mono">{a.vehiclePlate}</div>
                      <div className="gecko-cell-meta">{a.vehicleType}</div>
                    </td>

                    {/* Carrier */}
                    <td style={{ verticalAlign: 'top' }}>
                      <div>{a.carrierLine}</div>
                    </td>

                    {/* Customer */}
                    <td style={{ verticalAlign: 'top' }}>
                      <div className="gecko-truncate" style={{ maxWidth: 220 }} title={a.customer}>{a.customer}</div>
                      <div className="gecko-cell-sub">{a.apptNo}</div>
                    </td>

                    {/* Chevron */}
                    <td style={{ textAlign: 'right' }}>
                      <Icon name="chevronRight" size={14} style={{ color: 'var(--gecko-text-disabled)' }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Helper hint */}
      <div className="gecko-helper-text" style={{ textAlign: 'center' }}>
        Click any appointment row to open the gate-in workflow for that truck.
      </div>
    </div>
  );
}
