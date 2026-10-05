/**
 * Unbilled orders — the billing clerk's worklist (GATE_API_FOR_UI.md §22).
 *
 * Vector's `UnBilledOrders` screen: find the orders that have been worked and
 * not yet invoiced, look at the charge lines each would put on an invoice, and
 * tick the ones going on this one.
 *
 * It is NOT the payer summary at `/api/revenue/charges/unbilled`, which answers
 * "how much is outstanding, by payer". That one is still read here, as a strip
 * above the grid — the two questions sit well together.
 */

/** Vector's "Filter By": how much of the order has actually happened. */
export const UNBILLED_PROGRESS = ['ALL', 'COMPLETED', 'HALF_COMPLETED', 'DELIVERED'] as const;
export type UnbilledProgress = (typeof UNBILLED_PROGRESS)[number];

export const PROGRESS_LABELS: Record<UnbilledProgress, string> = {
  ALL: 'All',
  COMPLETED: 'Completed',
  HALF_COMPLETED: '50% completed',
  DELIVERED: 'Delivered',
};

/**
 * Every filter the screen offers. The API takes them PascalCase, which is why
 * they are mapped rather than spread — a lowercase key is silently ignored and
 * the clerk gets a list that quietly does not match what they asked for.
 */
export interface UnbilledQuery {
  agentCode: string;
  forwarderCode: string;
  customerCode: string;
  vesselCode: string;
  voyage: string;
  bookingTypeCode: string;
  orderTypeCode: string;
  carrierRef: string;
  movementCode: string;
  paymentTermCode: string;
  chargeCode: string;
  progress: UnbilledProgress;
  from: string;
  to: string;
}

export const blankUnbilledQuery = (): UnbilledQuery => ({
  agentCode: '', forwarderCode: '', customerCode: '',
  vesselCode: '', voyage: '',
  bookingTypeCode: '', orderTypeCode: '', carrierRef: '',
  movementCode: '', paymentTermCode: '', chargeCode: '',
  progress: 'ALL', from: '', to: '',
});

/** One order waiting to be invoiced. */
export interface UnbilledOrder {
  bookingId: string;
  orderNo: string;
  carrierRef: string | null;
  subBlNo: string | null;
  bookedAt: string;
  bookingTypeCode: string;
  orderTypeCode: string;
  agentCode: string | null;
  agentName: string | null;
  customerCode: string | null;
  customerName: string | null;
  forwarderCode: string | null;
  vesselCode: string | null;
  callRef: string | null;
  voyage: string | null;
  terminalCode: string | null;
  /** An order can carry both CASH and CREDIT lines, so these are lists. */
  paymentTerms: string[];
  billTo: string[];
  boxes: number;
  lines: number;
  amount: number;
  tax: number;
  total: number;
  currencyCode: string;
  stepsDone: number;
  stepsTotal: number;
  firstDate: string | null;
  lastDate: string | null;
}

/** The page carries its own totals, so the footer is the server's arithmetic. */
export interface UnbilledOrdersPage {
  items: UnbilledOrder[];
  page: number;
  pageSize: number;
  totalCount: number;
  lines: number;
  amount: number;
  tax: number;
  total: number;
}

/** One charge line of an order. */
export interface UnbilledLine {
  chargeId: string;
  bookingId: string;
  orderNo: string;
  bookingContainerId: string | null;
  containerNo: string | null;
  equipmentTypeCode: string | null;
  movementCode: string | null;
  eirNo: string | null;
  pricedForDate: string | null;
  chargeCode: string;
  chargeName: string | null;
  billTo: string;
  payerCode: string | null;
  payerName: string | null;
  paymentTermCode: string;
  quantity: number;
  unitRate: number | null;
  amount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  currencyCode: string;
  billingUnitCode: string | null;
  /** Charged once for the whole truck, not per box. */
  isTripCharge: boolean;
  scheduleNo: string | null;
  source: string;
}

/**
 * The filters, as query parameters.
 *
 * Naming a vessel or voyage REPLACES the date range rather than narrowing it:
 * the sailing is the period. Vector does the same (`btnSearch_Click`,
 * UnBilledOrders.cs line 275, passes nulls for both dates when either is set),
 * and sending both would hide rows the clerk just asked to see.
 */
export function unbilledParams(q: UnbilledQuery, branchId: string): Record<string, string> {
  const p: Record<string, string> = { BranchId: branchId };
  const add = (k: string, v: string) => { if (v.trim()) p[k] = v.trim(); };
  add('AgentCode', q.agentCode);
  add('ForwarderCode', q.forwarderCode);
  add('CustomerCode', q.customerCode);
  add('BookingTypeCode', q.bookingTypeCode);
  add('OrderTypeCode', q.orderTypeCode);
  add('CarrierRef', q.carrierRef);
  add('MovementCode', q.movementCode);
  add('PaymentTermCode', q.paymentTermCode);
  add('ChargeCode', q.chargeCode);
  if (q.progress !== 'ALL') p.Progress = q.progress;
  if (q.vesselCode.trim() || q.voyage.trim()) {
    add('VesselCode', q.vesselCode);
    add('Voyage', q.voyage);
  } else {
    add('From', q.from);
    add('To', q.to);
  }
  return p;
}

export const UNBILLED_ORDERS_PATH = '/api/revenue/charges/unbilled/orders';
export const UNBILLED_LINES_PATH = '/api/revenue/charges/unbilled/lines';

export const unbilledExportPath = (q: UnbilledQuery, branchId: string) =>
  `${UNBILLED_ORDERS_PATH}.xlsx?${new URLSearchParams(unbilledParams(q, branchId))}`;

/** The lines read is per order — it answers 400 without one. */
export const unbilledLinesPath = (q: UnbilledQuery, branchId: string, orderNo: string) =>
  `${UNBILLED_LINES_PATH}?${new URLSearchParams({ ...unbilledParams(q, branchId), OrderNo: orderNo })}`;

/** What the ticked orders add up to, so nobody ticks blind. */
export function selectionTotals(orders: UnbilledOrder[], picked: Set<string>) {
  const rows = orders.filter(o => picked.has(o.orderNo));
  return {
    orders: rows.length,
    boxes: rows.reduce((n, o) => n + (o.boxes ?? 0), 0),
    lines: rows.reduce((n, o) => n + (o.lines ?? 0), 0),
    amount: rows.reduce((n, o) => n + (o.amount ?? 0), 0),
    tax: rows.reduce((n, o) => n + (o.tax ?? 0), 0),
    total: rows.reduce((n, o) => n + (o.total ?? 0), 0),
    currencyCode: rows[0]?.currencyCode ?? null,
  };
}

export const money = (n: number | null | undefined, currency?: string | null) =>
  n == null ? '—'
    : `${currency ?? 'THB'} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
