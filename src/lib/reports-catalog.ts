/**
 * Reports catalog — all reports surfaced under /reports/{operational,accounts,schedule}.
 *
 * Catalog mirrors the legacy WinForms TOS Operational Reports tree with
 * tenant-specific liner names (HYUNDAI, NYK, OOCL, WANHAI) stripped. Each
 * report declares which parameter fields the side drawer should render.
 *
 * AI-future room: the param-key list is structured (not free-form), so an
 * AI assistant can later auto-fill defaults from natural language ("show me
 * yesterday's full-in for OOCL") without schema changes.
 */

export type ReportCategory = 'operational' | 'accounts';

export type ReportGroup =
  // operational
  | 'Out-Bound Reports'
  | 'In-Bound Reports'
  | 'Customer-Service Reports'
  // accounts
  | 'Sales Reports'
  | 'Accounting Reports';

export type ReportParamKey =
  | 'branch' | 'bookingType' | 'orderType'
  | 'agent' | 'owner' | 'forwarder' | 'customer' | 'haulier'
  | 'vessel' | 'voyage' | 'yardLocation' | 'loadingPort'
  | 'typeSize' | 'tripType' | 'containerClass' | 'emptyLoaded'
  | 'blNo' | 'bookingDate'
  | 'truckCategory' | 'movementCode'
  | 'userId';
// Note: dateRange (Date From + Date To) is implicit on every report — the
// drawer always renders it.

export interface ReportDef {
  id: string;
  title: string;
  description: string;
  category: ReportCategory;
  group: ReportGroup;
  icon: string;            // gecko icon name
  params: ReportParamKey[];
}

/* ──────────────────────────────────────────────────────────────────────────
   OPERATIONAL REPORTS — Out-Bound · In-Bound · Customer-Service
   ────────────────────────────────────────────────────────────────────────── */

export const OPERATIONAL_REPORTS: ReportDef[] = [
  // ── Out-Bound ────────────────────────────────────────────────────────────
  { id: 'op-truck-control', title: 'Truck Control', description: 'All trucks that entered the yard for outbound moves, with arrival/departure timestamps and lane assignment.',
    category: 'operational', group: 'Out-Bound Reports', icon: 'truck',
    params: ['agent', 'truckCategory', 'haulier', 'movementCode'] },

  { id: 'op-empty-in-yard', title: 'Empty in Yard', description: 'Inventory of empty containers currently parked, by line/owner and yard block.',
    category: 'operational', group: 'Out-Bound Reports', icon: 'box',
    params: ['agent', 'owner', 'yardLocation', 'typeSize', 'containerClass'] },

  { id: 'op-full-in-yard', title: 'Full in Yard', description: 'Laden containers awaiting outbound — by customer, line, and yard slot.',
    category: 'operational', group: 'Out-Bound Reports', icon: 'package',
    params: ['agent', 'customer', 'owner', 'yardLocation', 'typeSize', 'emptyLoaded'] },

  { id: 'op-export-booking-order', title: 'Export Booking Order', description: 'Booking-level listing of containers committed to outbound vessels.',
    category: 'operational', group: 'Out-Bound Reports', icon: 'fileText',
    params: ['agent', 'customer', 'forwarder', 'vessel', 'voyage', 'orderType', 'blNo'] },

  { id: 'op-outbound-storage', title: 'Outbound Container Storage Activity', description: 'Day-by-day storage occupancy for outbound containers — basis for storage billing.',
    category: 'operational', group: 'Out-Bound Reports', icon: 'clock',
    params: ['agent', 'owner', 'customer', 'typeSize', 'emptyLoaded'] },

  { id: 'op-stuffing-unstuffing', title: 'Stuffing / Unstuffing', description: 'CFS cargo stuffing and unstuffing activity log.',
    category: 'operational', group: 'Out-Bound Reports', icon: 'layers',
    params: ['customer', 'forwarder', 'vessel', 'voyage', 'movementCode'] },

  { id: 'op-cy-movements-monthly', title: 'CY Container Movements (Monthly)', description: 'Monthly aggregate of CY moves — lifts, gate-ins, gate-outs.',
    category: 'operational', group: 'Out-Bound Reports', icon: 'activity',
    params: ['agent', 'owner', 'typeSize', 'movementCode'] },

  { id: 'op-pti', title: 'PTI (Pre-Trip Inspection)', description: 'Reefer pre-trip inspection log — pass/fail with technician + readings.',
    category: 'operational', group: 'Out-Bound Reports', icon: 'check',
    params: ['agent', 'owner', 'customer', 'typeSize'] },

  { id: 'op-electricity-day-pti', title: 'Electricity Day (PTI)', description: 'PTI reefer plug-in days billed to the line/customer.',
    category: 'operational', group: 'Out-Bound Reports', icon: 'activity',
    params: ['agent', 'owner', 'customer'] },

  { id: 'op-stock-report', title: 'Stock Report', description: 'Full container stock snapshot across all yard blocks.',
    category: 'operational', group: 'Out-Bound Reports', icon: 'database',
    params: ['agent', 'owner', 'yardLocation', 'typeSize', 'containerClass', 'emptyLoaded'] },

  { id: 'op-container-repair-summary', title: 'Container Repair Summary', description: 'M&R activity summary — IICL codes, parts used, technician hours.',
    category: 'operational', group: 'Out-Bound Reports', icon: 'edit',
    params: ['agent', 'owner', 'typeSize'] },

  { id: 'op-shore-pass', title: 'Shore Pass', description: 'Shore pass issuance log for visiting trucks/personnel.',
    category: 'operational', group: 'Out-Bound Reports', icon: 'invoice',
    params: ['haulier', 'truckCategory'] },

  { id: 'op-truck-turnaround', title: 'Truck Turn-Around', description: 'Truck arrival → departure time analysis — identifies gate bottlenecks.',
    category: 'operational', group: 'Out-Bound Reports', icon: 'clock',
    params: ['agent', 'haulier', 'truckCategory'] },

  // ── In-Bound ─────────────────────────────────────────────────────────────
  { id: 'op-import-container-list', title: 'Import Container List', description: 'All inbound containers received from a vessel/voyage.',
    category: 'operational', group: 'In-Bound Reports', icon: 'arrowDown',
    params: ['agent', 'customer', 'vessel', 'voyage', 'typeSize'] },

  { id: 'op-daily-import-full-in', title: 'Daily Import Full-In', description: 'Today\'s laden import gate-in transactions.',
    category: 'operational', group: 'In-Bound Reports', icon: 'arrowDown',
    params: ['agent', 'customer', 'vessel', 'voyage'] },

  { id: 'op-empty-out', title: 'Empty Out', description: 'Empty container deliveries from depot to merchants.',
    category: 'operational', group: 'In-Bound Reports', icon: 'arrowUp',
    params: ['agent', 'owner', 'haulier', 'typeSize'] },

  { id: 'op-daily-unstuffing', title: 'Daily Unstuffing Report', description: 'CFS unstuffing activity by day, with cargo tally summary.',
    category: 'operational', group: 'In-Bound Reports', icon: 'layers',
    params: ['customer', 'forwarder', 'vessel', 'voyage'] },

  { id: 'op-import-unstuffing-customs', title: 'Import Unstuffing — Customs', description: 'Customs-flagged unstuffing operations with permit references.',
    category: 'operational', group: 'In-Bound Reports', icon: 'fileText',
    params: ['customer', 'forwarder', 'vessel', 'voyage'] },

  { id: 'op-summary-imp-exp', title: 'Summary (Import / Export)', description: 'Combined in/out volume summary for the period.',
    category: 'operational', group: 'In-Bound Reports', icon: 'activity',
    params: ['agent', 'bookingType', 'orderType'] },

  { id: 'op-monthly-incoming', title: 'Monthly Incoming Container Report', description: 'Aggregate monthly inbound volume by line, customer, and vessel.',
    category: 'operational', group: 'In-Bound Reports', icon: 'package',
    params: ['agent', 'owner', 'customer', 'vessel', 'typeSize'] },

  { id: 'op-gate-in-out', title: 'Gate-In / Gate-Out', description: 'All gate movements (both directions) in the date range.',
    category: 'operational', group: 'In-Bound Reports', icon: 'truck',
    params: ['agent', 'customer', 'haulier', 'movementCode'] },

  { id: 'op-gate-in-out-agent', title: 'Gate-In / Gate-Out (By Agent)', description: 'Gate movements grouped by shipping line / agent.',
    category: 'operational', group: 'In-Bound Reports', icon: 'truck',
    params: ['agent', 'movementCode'] },

  { id: 'op-eta', title: 'Estimated Arrival Time', description: 'Expected truck/container arrivals based on slot bookings.',
    category: 'operational', group: 'In-Bound Reports', icon: 'clock',
    params: ['agent', 'customer', 'haulier', 'bookingDate'] },

  // ── Customer-Service ────────────────────────────────────────────────────
  { id: 'op-pending-booking-summary', title: 'Pending Booking Summary', description: 'Bookings waiting for container assignment or gate activity.',
    category: 'operational', group: 'Customer-Service Reports', icon: 'fileText',
    params: ['agent', 'customer', 'forwarder', 'bookingType', 'orderType'] },

  { id: 'op-booking-container-list', title: 'Booking Container List', description: 'All containers under a specific booking with current status.',
    category: 'operational', group: 'Customer-Service Reports', icon: 'package',
    params: ['agent', 'customer', 'blNo', 'bookingDate'] },

  { id: 'op-export-monthly-weekly', title: 'Export Monthly / Weekly', description: 'Customer-facing export volume statement for the period.',
    category: 'operational', group: 'Customer-Service Reports', icon: 'fileText',
    params: ['agent', 'customer', 'forwarder', 'orderType'] },

  { id: 'op-booking-form', title: 'Booking Form', description: 'Print-ready booking confirmation form for the customer.',
    category: 'operational', group: 'Customer-Service Reports', icon: 'invoice',
    params: ['customer', 'forwarder', 'blNo'] },

  { id: 'op-repo-form', title: 'Repo Form', description: 'Empty repositioning movement form for the line.',
    category: 'operational', group: 'Customer-Service Reports', icon: 'transferH',
    params: ['agent', 'owner', 'typeSize'] },
];

/* ──────────────────────────────────────────────────────────────────────────
   ACCOUNTS REPORTS — Sales · Accounting
   (was "Management Reports" in initial planning)
   ────────────────────────────────────────────────────────────────────────── */

export const ACCOUNTS_REPORTS: ReportDef[] = [
  // ── Sales ────────────────────────────────────────────────────────────────
  { id: 'ac-sales-export', title: 'Sales Report — Export', description: 'Period sales breakdown for outbound moves — by customer, line, and charge code.',
    category: 'accounts', group: 'Sales Reports', icon: 'invoice',
    params: ['agent', 'customer', 'forwarder', 'orderType'] },

  { id: 'ac-sales-import', title: 'Sales Report — Import', description: 'Period sales breakdown for inbound moves — by customer, line, and charge code.',
    category: 'accounts', group: 'Sales Reports', icon: 'invoice',
    params: ['agent', 'customer', 'forwarder', 'orderType'] },

  // ── Accounting ───────────────────────────────────────────────────────────
  { id: 'ac-pti-std', title: 'PTI — Standard Rates', description: 'PTI charges billed at standard tariff rates.',
    category: 'accounts', group: 'Accounting Reports', icon: 'check',
    params: ['agent', 'owner', 'customer'] },

  { id: 'ac-monitoring-day', title: 'Monitoring (Day)', description: 'Daily reefer-monitoring service charges for plug-in containers.',
    category: 'accounts', group: 'Accounting Reports', icon: 'activity',
    params: ['agent', 'owner', 'customer'] },

  { id: 'ac-electricity-day', title: 'Electricity (Day)', description: 'Daily reefer electricity charges — by reefer event date.',
    category: 'accounts', group: 'Accounting Reports', icon: 'activity',
    params: ['agent', 'owner', 'customer'] },

  { id: 'ac-electricity-day-elec', title: 'Electricity Day — ELEC band', description: 'Electricity charges under the ELEC rate band.',
    category: 'accounts', group: 'Accounting Reports', icon: 'activity',
    params: ['agent', 'owner'] },

  { id: 'ac-electricity-day-precool', title: 'Electricity Day — Pre-Cool', description: 'Pre-cool electricity charges before laden export gate-in.',
    category: 'accounts', group: 'Accounting Reports', icon: 'activity',
    params: ['agent', 'owner', 'customer'] },

  { id: 'ac-electricity-std', title: 'Electricity Standard', description: 'Standard tariff reefer electricity charge listing.',
    category: 'accounts', group: 'Accounting Reports', icon: 'activity',
    params: ['agent', 'owner', 'customer'] },

  { id: 'ac-liftoff-washing', title: 'Lift-Off / Washing', description: 'Empty lift-off plus container wash service charges.',
    category: 'accounts', group: 'Accounting Reports', icon: 'box',
    params: ['agent', 'owner', 'typeSize'] },

  { id: 'ac-hard-copy-charges', title: 'Hard-Copy Charges', description: 'Paper-based document charges (delivery orders, customs forms, etc.).',
    category: 'accounts', group: 'Accounting Reports', icon: 'fileText',
    params: ['agent', 'customer', 'forwarder'] },

  { id: 'ac-inbound-sct', title: 'Inbound SCT', description: 'Inbound charges flowing into SCT (Siam Container Terminal) accounting.',
    category: 'accounts', group: 'Accounting Reports', icon: 'arrowDown',
    params: ['agent', 'customer', 'vessel', 'voyage'] },

  { id: 'ac-export-full-out', title: 'Export Full-Out (CY/CY)', description: 'Outbound laden CY/CY charges — by customer and line.',
    category: 'accounts', group: 'Accounting Reports', icon: 'arrowUp',
    params: ['agent', 'customer', 'orderType'] },

  { id: 'ac-reefer-service', title: 'Reefer Service Charge', description: 'All reefer service charges (PTI, monitoring, plug, pre-cool) aggregated.',
    category: 'accounts', group: 'Accounting Reports', icon: 'activity',
    params: ['agent', 'owner', 'customer'] },

  { id: 'ac-unstuffing-activity', title: 'Unstuffing Activity', description: 'CFS unstuffing service charge listing.',
    category: 'accounts', group: 'Accounting Reports', icon: 'layers',
    params: ['customer', 'forwarder', 'vessel'] },

  { id: 'ac-lift-on-refund', title: 'Lift-On Refund Summary', description: 'Refunds issued against lift-on charges (cancellations, no-shows).',
    category: 'accounts', group: 'Accounting Reports', icon: 'arrowDown',
    params: ['agent', 'customer'] },

  { id: 'ac-container-storage-vsl-voy', title: 'Container Storage Activity (By Vsl/Voy)', description: 'Storage occupancy and charges by vessel/voyage.',
    category: 'accounts', group: 'Accounting Reports', icon: 'clock',
    params: ['agent', 'vessel', 'voyage'] },

  { id: 'ac-container-storage-standard', title: 'Container Storage Activity (Standard)', description: 'Storage occupancy and charges under the standard tariff.',
    category: 'accounts', group: 'Accounting Reports', icon: 'clock',
    params: ['agent', 'customer', 'typeSize'] },

  { id: 'ac-cash-receipt-user', title: 'Cash Receipt Listing — By User', description: 'Cash receipts collected at gate, grouped by clerk/user.',
    category: 'accounts', group: 'Accounting Reports', icon: 'invoice',
    params: ['userId'] },

  { id: 'ac-cash-receipt-liner', title: 'Cash Receipt Listing — By Line', description: 'Cash receipts grouped by shipping line.',
    category: 'accounts', group: 'Accounting Reports', icon: 'invoice',
    params: ['agent', 'owner'] },

  { id: 'ac-cash-receipt-company', title: 'Cash Receipt Listing — By Company', description: 'Cash receipts grouped by paying company/customer.',
    category: 'accounts', group: 'Accounting Reports', icon: 'invoice',
    params: ['customer'] },

  { id: 'ac-credit-receipt-detail', title: 'Credit Receipt Detail List', description: 'Detail listing of all credit-term invoiced receipts.',
    category: 'accounts', group: 'Accounting Reports', icon: 'invoice',
    params: ['agent', 'customer'] },

  { id: 'ac-sales-tax', title: 'Sales Tax (VAT) Report', description: 'VAT 7% sales tax report formatted for Thai Revenue Department submission.',
    category: 'accounts', group: 'Accounting Reports', icon: 'invoice',
    params: ['customer'] },

  { id: 'ac-withholding-tax', title: 'Withholding Tax Report', description: 'WHT 3% withholding tax certificates issued in the period.',
    category: 'accounts', group: 'Accounting Reports', icon: 'invoice',
    params: ['customer'] },

  { id: 'ac-credit-invoice-listing', title: 'Credit Invoice Listing', description: 'All credit-term invoices issued in the period.',
    category: 'accounts', group: 'Accounting Reports', icon: 'invoice',
    params: ['agent', 'customer'] },

  { id: 'ac-waive-charges', title: 'Waive Charges', description: 'Charges that were waived during the period, with reason codes.',
    category: 'accounts', group: 'Accounting Reports', icon: 'edit',
    params: ['agent', 'customer'] },
];

/* ──────────────────────────────────────────────────────────────────────────
   Helpers — group reports for the page render
   ────────────────────────────────────────────────────────────────────────── */

export function groupReports(reports: ReportDef[]): Record<ReportGroup, ReportDef[]> {
  const out = {} as Record<ReportGroup, ReportDef[]>;
  for (const r of reports) {
    if (!out[r.group]) out[r.group] = [];
    out[r.group].push(r);
  }
  return out;
}

export function findReport(id: string): ReportDef | undefined {
  return [...OPERATIONAL_REPORTS, ...ACCOUNTS_REPORTS].find(r => r.id === id);
}

/* ──────────────────────────────────────────────────────────────────────────
   AUTO-SCHEDULE — recurring scheduled reports
   ────────────────────────────────────────────────────────────────────────── */

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly';
export type RunStatus = 'success' | 'failed' | 'running' | 'paused';

export interface AutoScheduledReport {
  id: string;
  reportId: string;             // references a ReportDef.id
  reportTitle: string;          // denormalized for table display
  category: ReportCategory;
  frequency: ScheduleFrequency;
  scheduleLabel: string;        // human-readable: "Daily at 06:00", "Mon 08:00", "1st of month"
  recipients: string[];         // email addresses
  enabled: boolean;
  lastRun?: { at: string; status: RunStatus };
  nextRun: string;              // ISO
  createdBy: string;
}

export const SEEDED_SCHEDULES: AutoScheduledReport[] = [
  {
    id: 'sch-1', reportId: 'op-stock-report', reportTitle: 'Stock Report (Daily Yard Summary)',
    category: 'operational',
    frequency: 'daily', scheduleLabel: 'Daily at 06:00',
    recipients: ['ops-lcb@gecko-tos.com', 'gate-supervisor@gecko-tos.com'],
    enabled: true,
    lastRun: { at: '2026-05-16T06:00:00', status: 'success' },
    nextRun: '2026-05-17T06:00:00',
    createdBy: 'SOMPORN',
  },
  {
    id: 'sch-2', reportId: 'op-gate-in-out', reportTitle: 'Daily Gate Movement Log',
    category: 'operational',
    frequency: 'daily', scheduleLabel: 'Daily at 23:30',
    recipients: ['gate-supervisor@gecko-tos.com'],
    enabled: true,
    lastRun: { at: '2026-05-15T23:30:00', status: 'success' },
    nextRun: '2026-05-16T23:30:00',
    createdBy: 'CHAKRIYA',
  },
  {
    id: 'sch-3', reportId: 'ac-container-storage-standard', reportTitle: 'Weekly Storage Aging',
    category: 'accounts',
    frequency: 'weekly', scheduleLabel: 'Every Monday at 08:00',
    recipients: ['finance@gecko-tos.com', 'country-head@gecko-tos.com'],
    enabled: true,
    lastRun: { at: '2026-05-12T08:00:00', status: 'success' },
    nextRun: '2026-05-19T08:00:00',
    createdBy: 'PRACHEE',
  },
  {
    id: 'sch-4', reportId: 'ac-sales-export', reportTitle: 'Monthly Sales — Export',
    category: 'accounts',
    frequency: 'monthly', scheduleLabel: '1st of month at 09:00',
    recipients: ['finance@gecko-tos.com', 'country-head@gecko-tos.com', 'ceo@gecko-tos.com'],
    enabled: true,
    lastRun: { at: '2026-05-01T09:00:00', status: 'success' },
    nextRun: '2026-06-01T09:00:00',
    createdBy: 'NARONG',
  },
  {
    id: 'sch-5', reportId: 'ac-sales-import', reportTitle: 'Monthly Sales — Import',
    category: 'accounts',
    frequency: 'monthly', scheduleLabel: '1st of month at 09:05',
    recipients: ['finance@gecko-tos.com', 'country-head@gecko-tos.com', 'ceo@gecko-tos.com'],
    enabled: true,
    lastRun: { at: '2026-05-01T09:05:00', status: 'success' },
    nextRun: '2026-06-01T09:05:00',
    createdBy: 'NARONG',
  },
  {
    id: 'sch-6', reportId: 'ac-cash-receipt-user', reportTitle: 'Daily Cash Receipts',
    category: 'accounts',
    frequency: 'daily', scheduleLabel: 'Daily at 17:00',
    recipients: ['cashier-lead@gecko-tos.com', 'finance@gecko-tos.com'],
    enabled: true,
    lastRun: { at: '2026-05-15T17:00:00', status: 'success' },
    nextRun: '2026-05-16T17:00:00',
    createdBy: 'PRANEE',
  },
  {
    id: 'sch-7', reportId: 'ac-electricity-std', reportTitle: 'Weekly Reefer Plug Utilization',
    category: 'accounts',
    frequency: 'weekly', scheduleLabel: 'Every Sunday at 20:00',
    recipients: ['maintenance@gecko-tos.com'],
    enabled: false,
    lastRun: { at: '2026-05-04T20:00:00', status: 'failed' },
    nextRun: '2026-05-18T20:00:00',
    createdBy: 'SOMSAK',
  },
  {
    id: 'sch-8', reportId: 'ac-container-storage-standard', reportTitle: 'Monthly D&D Accrual',
    category: 'accounts',
    frequency: 'monthly', scheduleLabel: '1st of month at 10:00',
    recipients: ['finance@gecko-tos.com'],
    enabled: true,
    lastRun: { at: '2026-05-01T10:00:00', status: 'success' },
    nextRun: '2026-06-01T10:00:00',
    createdBy: 'PRACHEE',
  },
];

/* ──────────────────────────────────────────────────────────────────────────
   Param metadata — labels + render hints for the side drawer
   ────────────────────────────────────────────────────────────────────────── */

export const PARAM_LABELS: Record<ReportParamKey, string> = {
  branch:         'Branch',
  bookingType:    'Booking Type',
  orderType:      'Order Type',
  agent:          'Agent / Line',
  owner:          'Owner / Line',
  forwarder:      'Forwarder',
  customer:       'Customer',
  haulier:        'Haulier',
  vessel:         'Vessel',
  voyage:         'Voyage No.',
  yardLocation:   'Yard Location',
  loadingPort:    'Loading Port',
  typeSize:       'Type — Size',
  tripType:       'Trip Type',
  containerClass: 'Container Class',
  emptyLoaded:    'Empty / Loaded',
  blNo:           'B/L No.',
  bookingDate:    'Booking Date',
  truckCategory:  'Truck Category',
  movementCode:   'Movement Code',
  userId:         'User ID',
};
