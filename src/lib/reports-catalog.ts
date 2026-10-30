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
  /** The cashier who took the money — a user GUID, not a code. */
  | 'cashierUser'
  /** A calendar year, for the two reports that summarise one. */
  | 'year'
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
  /**
   * The screen that actually answers this report today.
   *
   * KORAKIT is switching OFF the desktop, so every report they had is listed
   * here — but most have no query behind them yet. A card with no `live` says
   * so on its face rather than queueing a PDF that never arrives: on a live
   * cutover, a clerk who waits twenty minutes for a report that was never
   * generated is worse off than one who was told plainly.
   *
   * Set this the moment a report gets a real endpoint.
   */
  live?: string;
  /**
   * The report the API actually renders, as a PDF or a workbook.
   *
   * `path` is the endpoint without its extension — the format is appended
   * (`.pdf` / `.xlsx`). `params` names the query parameter each drawer field
   * maps to, because the three endpoints do NOT agree with each other:
   * empty-in-yard takes `size`/`type` and `fromDate`, full-in-yard takes
   * `containerSize`/`containerType`, and gate-in-out takes `dateFrom`/`dateTo`.
   * Spelling that out per report is better than a shared guess.
   */
  document?: ReportDocument;
  /**
   * No date range at all. Monitoring (Day) is a snapshot — its RDL has no dates
   * — so offering a range would be offering a filter the server ignores.
   */
  noDates?: boolean;
  /**
   * The range takes a TIME as well, sent as `yyyy-MM-ddTHH:mm`. Only the two
   * cash-receipt listings: a cashier's shift is not a day, and finance reads
   * them per shift.
   */
  dateTime?: boolean;
  /**
   * What the range MEANS on this report, in the depot's words — "ETA from / to",
   * "Gate in from / to". Vector labelled each one, and a clerk choosing dates
   * needs to know whether they are picking a vessel's ETA or a gate day.
   */
  dateLabel?: string;
  /**
   * A sentence shown in the drawer, above the fields. For the reports whose
   * data Gecko does not record yet: they print headings and no rows, and a
   * clerk deserves to know that before waiting for the PDF.
   */
  note?: string;
  /**
   * Hide the date range — and do not send it — when this field has a value.
   * Booking Container List takes either a booking number or a range, never
   * both; the API refuses the pair.
   */
  datesUnless?: ReportParamKey;
}

export interface ReportDocument {
  /** e.g. '/api/tos/reports/empty-in-yard' — the format is appended. */
  path: string;
  /** Drawer field → API query parameter. A field left out is not sent. */
  params: Partial<Record<ReportParamKey | 'dateFrom' | 'dateTo' | 'type', string>>;
  /** Parameters the API refuses the call without. */
  required?: ('dateFrom' | 'dateTo')[];
  /**
   * QUERY PARAMETERS THE REPORT ITSELF FIXES, sent on every run and never shown
   * in the drawer.
   *
   * This is what makes two catalogue cards out of one endpoint. Cash Collection
   * IS Gate-In / Gate-Out with `paymentChannel=CASH` — same path, same columns,
   * same summary — and a clerk looking for the cash sheet should find a card
   * called that, not be told to run another report and remember a filter.
   *
   * It is not a drawer field with a default: a default can be cleared, and a
   * cleared one would quietly turn the cash report back into the whole log.
   */
  fixed?: Record<string, string>;
}

/* ──────────────────────────────────────────────────────────────────────────
   OPERATIONAL REPORTS — Out-Bound · In-Bound · Customer-Service
   ────────────────────────────────────────────────────────────────────────── */

export const OPERATIONAL_REPORTS: ReportDef[] = [
  // ── Out-Bound ────────────────────────────────────────────────────────────
  { id: 'op-truck-control', title: 'Truck Control', description: 'All trucks that entered the yard for outbound moves, with arrival/departure timestamps and lane assignment.',
    category: 'operational', group: 'Out-Bound Reports', icon: 'truck',
    params: ['agent', 'vessel', 'voyage'],
    document: { path: '/api/tos/reports/truck-control', params: { agent: 'agentCode', vessel: 'vesselCode', voyage: 'voyageNo', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] }, dateLabel: 'ETD from / to' },

  { id: 'op-empty-in-yard', title: 'Empty in Yard', description: 'Inventory of empty containers currently parked, by line/owner and yard block.',
    category: 'operational', group: 'Out-Bound Reports', icon: 'box',
    params: ['agent', 'owner', 'forwarder', 'customer', 'vessel', 'voyage', 'yardLocation', 'typeSize',
      'bookingType', 'orderType', 'blNo', 'haulier'],
    document: {
      path: '/api/tos/reports/empty-in-yard',
      params: {
        agent: 'agentCode', owner: 'ownerCode', forwarder: 'forwarderCode', customer: 'customerCode',
        vessel: 'vesselCode', voyage: 'voyageNo', yardLocation: 'yardId',
        typeSize: 'size', bookingType: 'bookingType', orderType: 'orderType',
        blNo: 'bookingBlNo', haulier: 'haulierCode',
        dateFrom: 'fromDate', dateTo: 'toDate',
      },
    } },

  { id: 'op-full-in-yard', title: 'Full in Yard', description: 'Laden containers awaiting outbound — by customer, line, and yard slot.',
    category: 'operational', group: 'Out-Bound Reports', icon: 'package',
    params: ['agent', 'forwarder', 'customer', 'vessel', 'voyage', 'yardLocation', 'typeSize',
      'containerClass', 'bookingType', 'orderType', 'blNo', 'haulier'],
    document: {
      path: '/api/tos/reports/full-in-yard',
      params: {
        agent: 'agentCode', forwarder: 'forwarderCode', customer: 'customerCode',
        vessel: 'vesselCode', voyage: 'voyageNo', yardLocation: 'yardId',
        typeSize: 'containerSize', containerClass: 'containerGrade',
        bookingType: 'bookingType', orderType: 'orderType',
        blNo: 'bookingBlNo', haulier: 'haulierCode',
        dateFrom: 'fromDate', dateTo: 'toDate',
      },
    } },

  { id: 'op-export-booking-order', title: 'Export Booking Order', description: 'Booking-level listing of containers committed to outbound vessels.',
    category: 'operational', group: 'Out-Bound Reports', icon: 'fileText',
    params: ['agent', 'customer', 'forwarder', 'vessel', 'voyage', 'orderType', 'blNo'] },

  { id: 'op-outbound-storage', title: 'Outbound Container Storage Activity', description: 'Day-by-day storage occupancy for outbound containers — basis for storage billing.',
    category: 'operational', group: 'Out-Bound Reports', icon: 'clock',
    params: ['agent', 'vessel', 'voyage', 'orderType', 'bookingType'],
    document: { path: '/api/tos/reports/outbound-container-storage-activity', params: { agent: 'agentCode', vessel: 'vesselCode', voyage: 'voyageNo', orderType: 'orderType', bookingType: 'bookingType', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] }, dateLabel: 'ETD from / to' },

  { id: 'op-stuffing-unstuffing', title: 'Stuffing / Unstuffing', description: 'CFS cargo stuffing and unstuffing activity log.',
    category: 'operational', group: 'Out-Bound Reports', icon: 'layers',
    params: ['agent', 'customer', 'blNo', 'vessel', 'voyage', 'bookingType', 'orderType'],
    document: { path: '/api/tos/reports/stuffing-unstuffing', params: { agent: 'agentCode', customer: 'customerCode', blNo: 'bookingBlNo', vessel: 'vesselCode', voyage: 'voyageNo', bookingType: 'bookingType', orderType: 'orderType', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] }, dateLabel: 'Gate in from / to' },

  { id: 'op-cy-movements-monthly', title: 'CY Container Movements (Monthly)', description: 'Monthly aggregate of CY moves — lifts, gate-ins, gate-outs.',
    category: 'operational', group: 'Out-Bound Reports', icon: 'activity',
    params: ['agent'],
    document: { path: '/api/tos/reports/cy-container-monthly-movement', params: { agent: 'agentCode', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] }, dateLabel: 'Activities date from / to' },

  { id: 'op-pti', title: 'PTI (Pre-Trip Inspection)', description: 'Reefer pre-trip inspection log — pass/fail with technician + readings.',
    category: 'operational', group: 'Out-Bound Reports', icon: 'check',
    params: [],
    document: { path: '/api/tos/reports/pti', params: { dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] }, note: 'Headings only until PTI work orders exist in Gecko.' },

  { id: 'op-electricity-day-pti', title: 'Electricity Day (PTI)', description: 'PTI reefer plug-in days billed to the line/customer.',
    category: 'operational', group: 'Out-Bound Reports', icon: 'activity',
    params: ['agent', 'owner', 'customer'] },

  { id: 'op-stock-report', title: 'Stock Report', description: 'Full container stock snapshot across all yard blocks.',
    category: 'operational', group: 'Out-Bound Reports', icon: 'database',
    params: ['agent'],
    document: { path: '/api/tos/reports/stock-report', params: { agent: 'agentCode', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] }, dateLabel: 'Empty release from / to' },

  { id: 'op-container-repair-summary', title: 'Container Repair Summary', description: 'M&R activity summary — IICL codes, parts used, technician hours.',
    category: 'operational', group: 'Out-Bound Reports', icon: 'edit',
    params: [],
    document: { path: '/api/tos/reports/container-repair-summary', params: { dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] }, note: 'Headings and an empty TOTAL row until repair estimates exist in Gecko.' },

  { id: 'op-shore-pass', title: 'Shore Pass #1 (Evergreen B.2)', description: 'Shore pass issuance log for visiting trucks/personnel.',
    category: 'operational', group: 'Out-Bound Reports', icon: 'invoice',
    params: ['agent'],
    document: { path: '/api/tos/reports/shore-pass-1', params: { agent: 'agentCode', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] }, dateLabel: 'Gate in from / to' },

  { id: 'op-truck-turnaround', title: 'Truck Turn-Around', description: 'Truck arrival → departure time analysis — identifies gate bottlenecks.',
    category: 'operational', group: 'Out-Bound Reports', icon: 'clock',
    params: ['agent'],
    document: { path: '/api/tos/reports/truck-turn-around', params: { agent: 'agentCode', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] }, dateLabel: 'Truck arrival from / to' },

  // ── In-Bound ─────────────────────────────────────────────────────────────
  { id: 'op-import-container-list', title: 'Import Container List', description: 'All inbound containers received from a vessel/voyage.',
    category: 'operational', group: 'In-Bound Reports', icon: 'arrowDown',
    params: ['agent', 'customer', 'vessel', 'voyage'],
    document: { path: '/api/tos/reports/import-container-list', params: { agent: 'agentCode', customer: 'customerCode', vessel: 'vesselCode', voyage: 'voyageNo', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] }, dateLabel: 'ETA from / to' },

  { id: 'op-daily-import-full-in', title: 'Daily Import Full-In', description: 'Today\'s laden import gate-in transactions.',
    category: 'operational', group: 'In-Bound Reports', icon: 'arrowDown',
    params: ['agent'],
    document: { path: '/api/tos/reports/daily-import-full-in', params: { agent: 'agentCode', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] }, dateLabel: 'Gate in from / to' },

  { id: 'op-empty-out', title: 'Empty Out', description: 'Empty container deliveries from depot to merchants.',
    category: 'operational', group: 'In-Bound Reports', icon: 'arrowUp',
    params: ['agent'],
    document: { path: '/api/tos/reports/empty-out', params: { agent: 'agentCode', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] }, dateLabel: 'Gate out from / to' },

  { id: 'op-daily-unstuffing', title: 'Daily Unstuffing Report', description: 'CFS unstuffing activity by day, with cargo tally summary.',
    category: 'operational', group: 'In-Bound Reports', icon: 'layers',
    params: [],
    document: { path: '/api/tos/reports/daily-unstuffing', params: { dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] }, note: 'No lines yet: unstuffing is not recorded in Gecko. The report prints its headings.' },

  { id: 'op-import-unstuffing-customs', title: 'Import Unstuffing — Customs', description: 'Customs-flagged unstuffing operations with permit references.',
    category: 'operational', group: 'In-Bound Reports', icon: 'fileText',
    params: ['agent', 'vessel', 'voyage'],
    document: { path: '/api/tos/reports/customs-import-unstuffing', params: { agent: 'agentCode', vessel: 'vesselCode', voyage: 'voyageNo', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] }, dateLabel: 'Gate in from / to' },

  { id: 'op-summary-imp-exp', title: 'Summary (Import / Export)', description: 'Combined in/out volume summary for the period.',
    category: 'operational', group: 'In-Bound Reports', icon: 'activity',
    params: ['year', 'bookingType', 'movementCode'],
    document: { path: '/api/tos/reports/import-export-summary', params: { year: 'year', bookingType: 'bookingType', movementCode: 'movementCode' } }, noDates: true },

  { id: 'op-monthly-incoming', title: 'Monthly Incoming Container Report', description: 'Aggregate monthly inbound volume by line, customer, and vessel.',
    category: 'operational', group: 'In-Bound Reports', icon: 'package',
    params: ['year', 'bookingType', 'movementCode'],
    document: { path: '/api/tos/reports/monthly-incoming-container', params: { year: 'year', bookingType: 'bookingType', movementCode: 'movementCode' } }, noDates: true },

  { id: 'op-gate-in-out', title: 'Gate-In / Gate-Out', description: 'All gate movements (both directions) in the date range.',
    category: 'operational', group: 'In-Bound Reports', icon: 'truck',
    params: ['agent', 'forwarder', 'customer', 'vessel', 'voyage', 'typeSize', 'emptyLoaded',
      'bookingType', 'orderType', 'blNo', 'haulier', 'movementCode', 'yardLocation'],
    document: {
      path: '/api/tos/reports/gate-in-out',
      params: {
        agent: 'agentCode', forwarder: 'forwarderCode', customer: 'customerCode',
        vessel: 'vesselCode', voyage: 'voyageNo', typeSize: 'size', emptyLoaded: 'fullEmpty',
        bookingType: 'bookingType', orderType: 'orderType', blNo: 'bookingBlNo',
        haulier: 'haulierCode', movementCode: 'movementCode', yardLocation: 'yardId',
        dateFrom: 'dateFrom', dateTo: 'dateTo',
      },
      // The only one of the three that insists on a range, and it caps at 366 days.
      required: ['dateFrom', 'dateTo'],
    } },

  /**
   * THE SAME SHEET, NARROWED TO WHAT WAS NOT PAID FOR AT THE WINDOW
   * (owner 2026-10-27).
   *
   * Same columns, same agent × size/type summary as Gate-In / Gate-Out, and it
   * covers both directions — the Movement Code filter narrows it. The moves on
   * it are the ones whose gate coupon was issued on CREDIT: the customer is
   * billed later, so there is NO INVOICE NUMBER on the sheet. That is the point
   * of it, not an omission.
   */
  { id: 'op-credit-collection', title: 'Credit Collection Report', description: 'Gate-in / gate-out moves made on credit (billed later, no invoice no.), with the size summary.',
    category: 'operational', group: 'In-Bound Reports', icon: 'truck',
    params: ['agent', 'forwarder', 'customer', 'vessel', 'voyage', 'typeSize', 'emptyLoaded',
      'bookingType', 'orderType', 'blNo', 'haulier', 'movementCode', 'yardLocation'],
    document: {
      path: '/api/tos/reports/credit-collection',
      params: {
        agent: 'agentCode', forwarder: 'forwarderCode', customer: 'customerCode',
        vessel: 'vesselCode', voyage: 'voyageNo', typeSize: 'size', emptyLoaded: 'fullEmpty',
        bookingType: 'bookingType', orderType: 'orderType', blNo: 'bookingBlNo',
        haulier: 'haulierCode', movementCode: 'movementCode', yardLocation: 'yardId',
        dateFrom: 'dateFrom', dateTo: 'dateTo',
      },
      required: ['dateFrom', 'dateTo'],
    } },

  /**
   * ITS OPPOSITE NUMBER, and the same endpoint as Gate-In / Gate-Out with
   * `paymentChannel=CASH` pinned (API 2026-10-27). Credit Collection has a card
   * of its own, so the cash half needs one too — otherwise a cashier reading
   * the catalogue finds only half the pair and assumes the other does not exist.
   *
   * Gate-In / Gate-Out itself still sends no `paymentChannel` and still lists
   * every move, paid or not.
   */
  { id: 'op-cash-collection', title: 'Cash Collection Report', description: 'Gate-in / gate-out moves paid at the window, with the size summary.',
    category: 'operational', group: 'In-Bound Reports', icon: 'truck',
    params: ['agent', 'forwarder', 'customer', 'vessel', 'voyage', 'typeSize', 'emptyLoaded',
      'bookingType', 'orderType', 'blNo', 'haulier', 'movementCode', 'yardLocation'],
    document: {
      path: '/api/tos/reports/gate-in-out',
      params: {
        agent: 'agentCode', forwarder: 'forwarderCode', customer: 'customerCode',
        vessel: 'vesselCode', voyage: 'voyageNo', typeSize: 'size', emptyLoaded: 'fullEmpty',
        bookingType: 'bookingType', orderType: 'orderType', blNo: 'bookingBlNo',
        haulier: 'haulierCode', movementCode: 'movementCode', yardLocation: 'yardId',
        dateFrom: 'dateFrom', dateTo: 'dateTo',
      },
      required: ['dateFrom', 'dateTo'],
      fixed: { paymentChannel: 'CASH' },
    } },

  { id: 'op-gate-in-out-agent', title: 'Gate-In / Gate-Out (By Agent)', description: 'Gate movements grouped by shipping line / agent.',
    category: 'operational', group: 'In-Bound Reports', icon: 'truck',
    params: ['agent', 'movementCode'], live: '/reports/operational-api' },

  { id: 'op-eta', title: 'Estimated Arrival Time', description: 'Expected truck/container arrivals based on slot bookings.',
    category: 'operational', group: 'In-Bound Reports', icon: 'clock',
    params: ['agent', 'customer', 'haulier', 'bookingDate'] },

  // ── Customer-Service ────────────────────────────────────────────────────
  { id: 'op-pending-booking-summary', title: 'Pending Booking Summary', description: 'Bookings waiting for container assignment or gate activity.',
    category: 'operational', group: 'Customer-Service Reports', icon: 'fileText',
    params: ['agent', 'customer', 'vessel', 'blNo'],
    document: { path: '/api/tos/reports/pending-booking-summary', params: { agent: 'agentCode', customer: 'customerCode', vessel: 'vesselCode', blNo: 'bookingBlNo', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] }, dateLabel: 'ETA from / to' },

  { id: 'op-booking-container-list', title: 'Booking Container List', description: 'All containers under a specific booking with current status.',
    category: 'operational', group: 'Customer-Service Reports', icon: 'package',
    params: ['agent', 'customer', 'vessel', 'voyage', 'blNo'],
    document: { path: '/api/tos/reports/booking-container-list', params: { agent: 'agentCode', customer: 'customerCode', vessel: 'vesselCode', voyage: 'voyageNo', blNo: 'bookingBlNo', dateFrom: 'dateFrom', dateTo: 'dateTo' } }, dateLabel: 'Empty gate-out from / to', note: 'Booking type is fixed to EXPORT. Give a Booking/BL number, or a date range — not both.', datesUnless: 'blNo' },

  { id: 'op-export-monthly-weekly', title: 'Export Monthly / Weekly', description: 'Customer-facing export volume statement for the period.',
    category: 'operational', group: 'Customer-Service Reports', icon: 'fileText',
    params: ['agent', 'bookingType', 'orderType'],
    document: { path: '/api/tos/reports/weekly-monthly-statistics', params: { agent: 'agentCode', bookingType: 'bookingType', orderType: 'orderType', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] }, note: 'One column pair per day — a range of 31 days or fewer reads best.' },

  { id: 'op-booking-form', title: 'Booking Form', description: 'Print-ready booking confirmation form for the customer.',
    category: 'operational', group: 'Customer-Service Reports', icon: 'invoice',
    params: ['agent', 'bookingType', 'orderType'],
    document: { path: '/api/tos/reports/booking-form', params: { agent: 'agentCode', bookingType: 'bookingType', orderType: 'orderType', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'op-repo-form', title: 'Repo Form', description: 'Empty repositioning movement form for the line.',
    category: 'operational', group: 'Customer-Service Reports', icon: 'transferH',
    params: ['agent', 'bookingType', 'orderType'],
    document: { path: '/api/tos/reports/repo-form', params: { agent: 'agentCode', bookingType: 'bookingType', orderType: 'orderType', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] }, note: 'Any booking type other than REPO prints an empty report, as on Vector.' },

  // ── Added 2026-10-11 with the Operation report endpoints ─────────────

  { id: 'op-inbound-full-in', title: 'NYK External', description: 'Full gate-ins for one agent in the period (desktop &ldquo;NYK External&rdquo;; works for any agent).',
    category: 'operational', group: 'In-Bound Reports', icon: 'fileText',
    params: ['agent', 'bookingType', 'orderType'],
    document: { path: '/api/tos/reports/inbound-full-in', params: { agent: 'agentCode', bookingType: 'bookingType', orderType: 'orderType', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] }, dateLabel: 'Gate in from / to' },

  { id: 'op-shore-pass-2', title: 'Shore Pass #2 (LCMT)', description: 'A terminal&rsquo;s printed shore-pass request form.',
    category: 'operational', group: 'Out-Bound Reports', icon: 'fileText',
    params: ['agent'],
    document: { path: '/api/tos/reports/shore-pass-2', params: { agent: 'agentCode', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'op-shore-pass-3', title: 'Shore Pass #3', description: 'A terminal&rsquo;s printed shore-pass request form.',
    category: 'operational', group: 'Out-Bound Reports', icon: 'fileText',
    params: ['agent'],
    document: { path: '/api/tos/reports/shore-pass-3', params: { agent: 'agentCode', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'op-shore-pass-ect', title: 'Shore Pass ECT', description: 'Booked boxes listed by their required date.',
    category: 'operational', group: 'Out-Bound Reports', icon: 'fileText',
    params: ['agent', 'bookingType', 'loadingPort'],
    document: { path: '/api/tos/reports/shore-pass-ect', params: { agent: 'agentCode', bookingType: 'bookingType', loadingPort: 'loadingPort', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] }, dateLabel: 'Required date from / to' },

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
    params: ['agent', 'typeSize', 'vessel', 'voyage'],
    document: { path: '/api/revenue/reports/accounting/pti-standard', params: { agent: 'agentCode', typeSize: 'size', vessel: 'vesselCode', voyage: 'voyageNo', type: 'type', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'ac-monitoring-day', title: 'Monitoring (Day)', description: 'Daily reefer-monitoring service charges for plug-in containers.',
    category: 'accounts', group: 'Accounting Reports', icon: 'activity',
    params: ['agent', 'bookingType', 'vessel', 'voyage'],
    document: { path: '/api/revenue/reports/accounting/monitoring-day', params: { agent: 'agentCode', bookingType: 'bookingType', vessel: 'vesselCode', voyage: 'voyageNo' } }, noDates: true },

  { id: 'ac-electricity-day', title: 'Electricity (Day)', description: 'Daily reefer electricity charges — by reefer event date.',
    category: 'accounts', group: 'Accounting Reports', icon: 'activity',
    params: ['agent', 'vessel', 'voyage', 'bookingType', 'orderType'],
    document: { path: '/api/revenue/reports/accounting/electricity-day', params: { agent: 'agentCode', vessel: 'vesselCode', voyage: 'voyageNo', bookingType: 'bookingType', orderType: 'orderType', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'ac-electricity-day-elec', title: 'Electricity Day — ELEC band', description: 'Electricity charges under the ELEC rate band.',
    category: 'accounts', group: 'Accounting Reports', icon: 'activity',
    params: ['agent', 'vessel', 'voyage', 'bookingType', 'orderType'],
    document: { path: '/api/revenue/reports/accounting/electricity-day-elc', params: { agent: 'agentCode', vessel: 'vesselCode', voyage: 'voyageNo', bookingType: 'bookingType', orderType: 'orderType', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'ac-electricity-day-precool', title: 'Electricity Day — Pre-Cool', description: 'Pre-cool electricity charges before laden export gate-in.',
    category: 'accounts', group: 'Accounting Reports', icon: 'activity',
    params: ['agent', 'vessel', 'voyage'],
    document: { path: '/api/revenue/reports/accounting/electricity-day-precool', params: { agent: 'agentCode', vessel: 'vesselCode', voyage: 'voyageNo', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'ac-electricity-std', title: 'Electricity Standard', description: 'Standard tariff reefer electricity charge listing.',
    category: 'accounts', group: 'Accounting Reports', icon: 'activity',
    params: ['vessel', 'voyage'],
    document: { path: '/api/revenue/reports/accounting/electricity-standard', params: { vessel: 'vesselCode', voyage: 'voyageNo', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'ac-liftoff-washing', title: 'Lift-Off / Washing', description: 'Empty lift-off plus container wash service charges.',
    category: 'accounts', group: 'Accounting Reports', icon: 'box',
    params: ['agent', 'typeSize', 'bookingType', 'orderType', 'movementCode'],
    document: { path: '/api/revenue/reports/accounting/lift-off-washing', params: { agent: 'agentCode', typeSize: 'size', bookingType: 'bookingType', orderType: 'orderType', movementCode: 'movementCode', type: 'type', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'ac-hard-copy-charges', title: 'Hard-Copy Charges', description: 'Paper flooring and lashing of export empties released.',
    category: 'accounts', group: 'Accounting Reports', icon: 'fileText',
    params: ['agent', 'vessel', 'voyage'],
    document: { path: '/api/revenue/reports/accounting/paper', params: { agent: 'agentCode', vessel: 'vesselCode', voyage: 'voyageNo', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'ac-inbound-sct', title: 'Inbound charges', description: 'Inbound charges flowing into terminal accounting.',
    category: 'accounts', group: 'Accounting Reports', icon: 'arrowDown',
    params: ['agent', 'customer', 'blNo', 'vessel', 'voyage'],
    document: { path: '/api/revenue/reports/accounting/inbound-sct', params: { agent: 'agentCode', customer: 'customerCode', blNo: 'bookingBlNo', vessel: 'vesselCode', voyage: 'voyageNo', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'ac-export-full-out', title: 'Export Full-Out (CY/CY)', description: 'Outbound laden CY/CY charges — by customer and line.',
    category: 'accounts', group: 'Accounting Reports', icon: 'arrowUp',
    params: ['agent', 'vessel', 'voyage'],
    document: { path: '/api/revenue/reports/accounting/export-full-out', params: { agent: 'agentCode', vessel: 'vesselCode', voyage: 'voyageNo', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'ac-reefer-service', title: 'Reefer Service Charge', description: 'All reefer service charges (PTI, monitoring, plug, pre-cool) aggregated.',
    category: 'accounts', group: 'Accounting Reports', icon: 'activity',
    params: ['agent', 'vessel', 'voyage', 'blNo', 'bookingType', 'orderType'],
    document: { path: '/api/revenue/reports/accounting/reefer-service-charge', params: { agent: 'agentCode', vessel: 'vesselCode', voyage: 'voyageNo', blNo: 'bookingBlNo', bookingType: 'bookingType', orderType: 'orderType', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'ac-unstuffing-activity', title: 'Unstuffing Activity', description: 'CFS unstuffing service charge listing. Prints no lines until Gecko records unstuffing.',
    category: 'accounts', group: 'Accounting Reports', icon: 'layers',
    params: ['agent', 'vessel', 'voyage'],
    document: { path: '/api/revenue/reports/accounting/unstuffing-activity', params: { agent: 'agentCode', vessel: 'vesselCode', voyage: 'voyageNo', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'ac-lift-on-refund', title: 'Lift-On Refund Summary', description: 'Refunds issued against lift-on charges (cancellations, no-shows).',
    category: 'accounts', group: 'Accounting Reports', icon: 'arrowDown',
    params: ['agent', 'customer', 'blNo', 'vessel', 'voyage'],
    document: { path: '/api/revenue/reports/accounting/lift-on-refund-summary', params: { agent: 'agentCode', customer: 'customerCode', blNo: 'bookingBlNo', vessel: 'vesselCode', voyage: 'voyageNo', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'ac-container-storage-vsl-voy', title: 'Container Storage Activity (By Vsl/Voy)', description: 'Storage occupancy and charges by vessel/voyage.',
    category: 'accounts', group: 'Accounting Reports', icon: 'clock',
    params: ['agent', 'vessel', 'voyage', 'blNo'],
    document: { path: '/api/revenue/reports/accounting/container-storage-activity-by-vessel', params: { agent: 'agentCode', vessel: 'vesselCode', voyage: 'voyageNo', blNo: 'bookingBlNo', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'ac-container-storage-standard', title: 'Container Storage Activity (Standard)', description: 'Storage occupancy and charges under the standard tariff.',
    category: 'accounts', group: 'Accounting Reports', icon: 'clock',
    params: ['agent', 'vessel', 'voyage', 'bookingType', 'orderType', 'blNo'],
    document: { path: '/api/revenue/reports/accounting/container-storage-activity', params: { agent: 'agentCode', vessel: 'vesselCode', voyage: 'voyageNo', bookingType: 'bookingType', orderType: 'orderType', blNo: 'bookingBlNo', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'ac-cash-receipt-user', title: 'Cash Receipt Listing — By User', description: 'Cash receipts collected at gate, grouped by clerk/user.',
    category: 'accounts', group: 'Accounting Reports', icon: 'invoice',
    params: ['cashierUser', 'bookingType'], live: '/reports/accounts-api',
    document: { path: '/api/revenue/reports/accounting/cash-receipt-by-user', params: { cashierUser: 'cashierUserId', bookingType: 'bookingType', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] }, dateTime: true },

  { id: 'ac-cash-receipt-liner', title: 'Cash Receipt Listing — By Line', description: 'Cash receipts grouped by shipping line.',
    category: 'accounts', group: 'Accounting Reports', icon: 'invoice',
    params: ['agent'], live: '/reports/accounts-api',
    document: { path: '/api/revenue/reports/accounting/cash-receipt-by-liner', params: { agent: 'agentCode', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] }, dateTime: true },

  { id: 'ac-cash-receipt-company', title: 'Cash Receipt Listing — By Company', description: 'Cash receipts grouped by paying company/customer.',
    category: 'accounts', group: 'Accounting Reports', icon: 'invoice',
    params: [], live: '/reports/accounts-api',
    document: { path: '/api/revenue/reports/accounting/cash-receipt-by-company', params: { dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'ac-credit-receipt-detail', title: 'Credit Receipt Detail List', description: 'Detail listing of all credit-term invoiced receipts. W/H tax and payment columns print blank until credit-invoice payments are recorded.',
    category: 'accounts', group: 'Accounting Reports', icon: 'invoice',
    params: [],
    document: { path: '/api/revenue/reports/accounting/credit-receipt-detail', params: { dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'ac-sales-tax', title: 'Sales Tax (VAT) Report', description: 'VAT 7% sales tax report formatted for Thai Revenue Department submission.',
    category: 'accounts', group: 'Accounting Reports', icon: 'invoice',
    params: ['bookingType'],
    document: { path: '/api/revenue/reports/accounting/sales-tax', params: { bookingType: 'bookingType', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'ac-withholding-tax', title: 'Withholding Tax Report', description: 'WHT 3% withholding tax certificates issued in the period.',
    category: 'accounts', group: 'Accounting Reports', icon: 'invoice',
    params: [],
    document: { path: '/api/revenue/reports/accounting/withholding-tax', params: { dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'ac-credit-invoice-listing', title: 'Credit Invoice Listing', description: 'All credit-term invoices issued in the period.',
    category: 'accounts', group: 'Accounting Reports', icon: 'invoice',
    params: ['agent', 'customer', 'bookingType'],
    document: { path: '/api/revenue/reports/accounting/credit-invoice-listing', params: { agent: 'agentCode', customer: 'customerCode', bookingType: 'bookingType', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'ac-waive-charges', title: 'Waive Charges', description: 'Charges that were waived during the period, with reason codes.',
    category: 'accounts', group: 'Accounting Reports', icon: 'edit',
    params: ['agent', 'customer'], live: '/billing/service-orders' },

  // ── Added 2026-10-11 with the accounting endpoints ───────────────────────
  // Liner names stay out of the titles (see the header); the desktop's own name
  // goes in the description, because that is what finance searches for.

  { id: 'ac-electricity-day-pti', title: 'Electricity Day — PTI', description: 'PTI charges of reefer boxes gated out.',
    category: 'accounts', group: 'Accounting Reports', icon: 'thermometer',
    params: ['agent', 'vessel', 'voyage'],
    document: { path: '/api/revenue/reports/accounting/electricity-day-pti', params: { agent: 'agentCode', vessel: 'vesselCode', voyage: 'voyageNo', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'ac-electricity-std-3', title: 'Electricity Standard (3)', description: 'Hourly electricity of reefer boxes moved in the period.',
    category: 'accounts', group: 'Accounting Reports', icon: 'thermometer',
    params: ['agent', 'vessel', 'voyage'],
    document: { path: '/api/revenue/reports/accounting/electricity-standard-3', params: { agent: 'agentCode', vessel: 'vesselCode', voyage: 'voyageNo', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'ac-gate-oocl', title: 'Gate Charges by Line', description: 'A line&rsquo;s gate charge list, a line per container (desktop &ldquo;Gate OOCL&rdquo;).',
    category: 'accounts', group: 'Accounting Reports', icon: 'truck',
    params: ['agent'],
    document: { path: '/api/revenue/reports/accounting/gate-oocl', params: { agent: 'agentCode', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'ac-inbound-sct1', title: 'Inbound SCT1 — Lift-Off Refund 90%', description: 'Export lift-off for cargo, with the 90% refund.',
    category: 'accounts', group: 'Accounting Reports', icon: 'invoice',
    params: ['agent', 'customer', 'blNo', 'vessel', 'voyage', 'bookingType'],
    document: { path: '/api/revenue/reports/accounting/inbound-sct1', params: { agent: 'agentCode', customer: 'customerCode', blNo: 'bookingBlNo', vessel: 'vesselCode', voyage: 'voyageNo', bookingType: 'bookingType', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'ac-lift-off-summary', title: 'Lift-Off Summary by Line', description: 'A line&rsquo;s empties in by size/type, with lift-off and cleaning (desktop &ldquo;HYUNDAI Lift-Off Summary&rdquo;).',
    category: 'accounts', group: 'Accounting Reports', icon: 'box',
    params: ['agent'],
    document: { path: '/api/revenue/reports/accounting/hyundai-lift-off-summary', params: { agent: 'agentCode', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'ac-lift-on-summary', title: 'Lift-On Summary by Line', description: 'A line&rsquo;s empties out by size/type, with lift-on, storage, PTI and pre-cool (desktop &ldquo;HYUNDAI Lift-On Summary&rdquo;).',
    category: 'accounts', group: 'Accounting Reports', icon: 'box',
    params: ['agent'],
    document: { path: '/api/revenue/reports/accounting/hyundai-lift-on-summary', params: { agent: 'agentCode', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'ac-line-refund', title: 'Import Refund by Line', description: 'Import boxes billed, by invoice, at the fixed refund rates (desktop &ldquo;HYUNDAI Refund&rdquo;).',
    category: 'accounts', group: 'Accounting Reports', icon: 'invoice',
    params: ['agent'],
    document: { path: '/api/revenue/reports/accounting/hyundai-refund', params: { agent: 'agentCode', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'ac-nyk-upload', title: 'Line Vendor-Invoice Upload', description: 'A line&rsquo;s charges in the vendor-invoice upload format (desktop &ldquo;NYK Report&rdquo;; agent blank = NYK).',
    category: 'accounts', group: 'Accounting Reports', icon: 'fileText',
    params: ['agent', 'vessel', 'voyage', 'bookingType', 'movementCode', 'blNo', 'orderType'],
    document: { path: '/api/revenue/reports/accounting/nyk', params: { agent: 'agentCode', vessel: 'vesselCode', voyage: 'voyageNo', bookingType: 'bookingType', movementCode: 'movementCode', blNo: 'bookingBlNo', orderType: 'orderType', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'ac-export-storage', title: 'Export Container Storage Activity', description: 'The export cut of Container Storage Activity (desktop &ldquo;APL&rdquo;).',
    category: 'accounts', group: 'Accounting Reports', icon: 'clock',
    params: ['agent', 'vessel', 'voyage'],
    document: { path: '/api/revenue/reports/accounting/apl-container-storage-activity', params: { agent: 'agentCode', vessel: 'vesselCode', voyage: 'voyageNo', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

  { id: 'ac-inbound-container', title: 'Container Inbound (Unstuffing)', description: 'Import CFS/CYD boxes unstuffed, with LO/LO, unstuffing and FSC. Prints no lines until Gecko records unstuffing.',
    category: 'accounts', group: 'Accounting Reports', icon: 'layers',
    params: ['agent', 'vessel', 'voyage'],
    document: { path: '/api/revenue/reports/accounting/inbound-container', params: { agent: 'agentCode', vessel: 'vesselCode', voyage: 'voyageNo', dateFrom: 'dateFrom', dateTo: 'dateTo' }, required: ['dateFrom', 'dateTo'] } },

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
  cashierUser:    'Cashier',
  year:           'Year',
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
