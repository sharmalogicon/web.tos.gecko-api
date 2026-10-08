"use client";

/**
 * BOOKING STATEMENT — Vector's Cost Sheet, bound.
 *
 * Two views, as the June 2026 screen had them (kept verbatim at
 * /compare/june/statement) and as the desktop has them:
 *
 *   A  a REGISTER of bookings with money still to bill, and
 *   B  one booking's charges as a single grid, with the actions that change them.
 *
 * View B is bound to GET /api/revenue/charges/statement?orderNo=, which answers
 * everything the grid, the sorting, the six filters and the money cards need in
 * one payload — so filtering costs no round trip.
 *
 * The WRITES are a different story. Of the seven things Vector does to a cost
 * sheet, the API has exactly one: waiving per box and charge code, which cannot
 * tell two lines of the same code apart. The rest — price a line, waive a line
 * by id, lock a rate, add a manual charge, apply one to every box, regenerate,
 * send to an invoice — have no endpoint at all. They are built here against the
 * agreed contracts, so the day the API lands nothing in this screen changes,
 * and until then each says exactly what is missing. See
 * docs/STATEMENT_CHARGE_EDIT_FOR_API.md.
 */

import React, { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterPopover, type FilterField } from '@/components/ui/FilterPopover';
import { useToast } from '@/components/ui/Toast';
import { useApi, useApiList } from '@/lib/api/use-api';
import { useSession } from '@/lib/auth/session';
import { useFacility } from '@/lib/api/facility';
import { saveBlob } from '@/lib/api/client';
import { formatContainerNo } from '@/lib/api/tos';
import { toCsv } from '@/lib/api/reports';
import { useCommercialVocabulary, type ChargeCode } from '@/lib/api/charge-codes';
import {
  amount, CHARGE_STATUS, flattenStatement, isEditableCharge, isUnpriced,
  payerLabel, SETTLED_LABEL, settledGroup, statementPath, whyNotEditable,
  type BookingStatement, type StatementRow,
} from '@/lib/api/charges';
import type { InvoiceTerm } from './_components/SendToMenu';
import { ChargeDetailModal } from './_components/ChargeDetailModal';
import { MoneyCards } from './_components/MoneyCards';
import { SendToMenu, type SendAction } from './_components/SendToMenu';
import { StatementRegister } from './_components/StatementRegister';
import { StatementSearchBox } from './_components/StatementSearchBox';
import { ChargeAddModal, RegenerateModal, SendToInvoiceModal, WaiveSelectedModal } from './_components/StatementModals';

export default function BookingStatementPage() {
  return (
    <Suspense fallback={<div className="gecko-cell-meta" style={{ padding: 24 }}>Loading…</div>}>
      <Statement />
    </Suspense>
  );
}

type SortKey = 'container' | 'movement' | 'chargeCode' | 'term' | 'billTo'
  | 'qty' | 'rate' | 'amount' | 'total' | 'status';

interface Column { key: SortKey; label: string; title?: string; num?: boolean; width: string }

/**
 * Widths are percentages on a fixed layout: a long Thai customer name must not
 * push Total off the right-hand edge, and the grid must never scroll sideways.
 */
const COLUMNS: Column[] = [
  { key: 'container', label: 'Container', width: '12%' },
  { key: 'movement', label: 'Movement', width: '9%' },
  { key: 'chargeCode', label: 'Charge', width: '19%' },
  { key: 'term', label: 'Term', width: '7%' },
  { key: 'billTo', label: 'Bill to', width: '13%' },
  { key: 'qty', label: 'Qty', num: true, width: '5%' },
  { key: 'rate', label: 'Rate', num: true, width: '10%' },
  { key: 'amount', label: 'Amount', num: true, width: '9%' },
  { key: 'total', label: 'Total', title: 'With VAT', num: true, width: '10%' },
  { key: 'status', label: 'Status', width: '11%' },
];

const valueOf = (r: StatementRow, key: SortKey): string | number => {
  const c = r.charge;
  switch (key) {
    case 'container': return r.containerNo ?? '￿';
    case 'movement': return c.movementCode ?? '￿';
    case 'chargeCode': return c.chargeCode;
    case 'term': return c.paymentTermCode;
    case 'billTo': return payerLabel(c.payerCode, c.payerName);
    case 'qty': return c.quantity;
    case 'rate': return c.unitRate ?? -1;
    case 'amount': return c.amount;
    case 'total': return c.total;
    case 'status': return c.status;
  }
};

/** Amount defaults to the lines worth money; the Filter badge ignores defaults. */
const DEFAULTS: Record<string, string> = {
  query: '', container: '', movement: '', settled: '', term: '', chargeType: '', amount: 'earning',
};

type Dialog =
  | { kind: 'charge'; row: StatementRow }
  | { kind: 'add'; mode: 'manual' | 'ADD' | 'UPDATE' }
  | { kind: 'waive' }
  | { kind: 'regenerate' }
  | { kind: 'send'; action: SendAction };

function Statement() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const orderNo = (params.get('orderNo') ?? '').trim().toUpperCase();

  const [typed, setTyped] = useState(orderNo);
  const [filters, setFilters] = useState<Record<string, string>>(DEFAULTS);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'container', dir: 'asc' });
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [menu, setMenu] = useState(false);

  const { toast } = useToast();
  const { user } = useSession();
  const { branch } = useFacility();
  const perms = user?.permissions ?? [];
  const mayEdit = perms.includes('revenue.charge.waive') || perms.includes('revenue.charge.override');
  // revenue.invoice.issue is NEW (2026-10-07). Without it the send answers 403,
  // so the button is not offered — a clerk should never be shown an action the
  // server will refuse.
  const mayInvoice = perms.includes('revenue.invoice.issue');

  const statement = useApi<BookingStatement>(orderNo ? statementPath(orderNo) : null);
  const s = orderNo ? statement.data : null;

  const { data: chargeCodes } = useApiList<ChargeCode>('/api/master/charge-codes?pageSize=300');
  const { data: commercial } = useCommercialVocabulary();
  const typeOf = useMemo(() => {
    const byCode = new Map<string, string>();
    for (const c of chargeCodes ?? []) byCode.set(c.chargeCode, c.chargeType);
    return byCode;
  }, [chargeCodes]);

  const all = useMemo(() => (s ? flattenStatement(s) : []), [s]);
  const cur = s?.receipts[0]?.currencyCode ?? all[0]?.charge.currencyCode ?? 'THB';
  const m = (v: number) => amount(v, cur);
  const movements = useMemo(
    () => [...new Set(all.map(r => r.charge.movementCode).filter((v): v is string => Boolean(v)))].sort(),
    [all]);

  const fields: FilterField[] = useMemo(() => {
    const distinct = (pick: (r: StatementRow) => string | null) =>
      [...new Set(all.map(pick).filter((v): v is string => Boolean(v)))].sort();
    const any = (label: string) => ({ label, value: '' });
    return [
      { type: 'search', key: 'query', placeholder: 'Charge code or name…' },
      {
        type: 'select', key: 'container', label: 'Container',
        options: [any('All containers'), ...distinct(r => r.containerNo).map(v => ({ label: formatContainerNo(v), value: v }))],
      },
      {
        type: 'select', key: 'movement', label: 'Movement',
        options: [any('All movements'), ...movements.map(v => ({ label: v, value: v }))],
      },
      {
        type: 'select', key: 'settled', label: 'Paid',
        options: [any('Paid and unpaid'), ...(['UNPAID', 'PAID', 'WAIVED', 'CANCELLED'] as const)
          .filter(g => all.some(r => settledGroup(r.charge) === g))
          .map(g => ({ label: SETTLED_LABEL[g], value: g }))],
      },
      {
        type: 'select', key: 'term', label: 'Payment term',
        options: [any('All terms'), ...distinct(r => r.charge.paymentTermCode).map(v => ({ label: termLabel(v), value: v }))],
      },
      {
        type: 'select', key: 'chargeType', label: 'Charge type',
        options: [any('All types'), ...[...new Set(all.map(r => typeOf.get(r.charge.chargeCode)).filter((v): v is string => Boolean(v)))]
          .sort().map(v => ({ label: v, value: v }))],
      },
      {
        type: 'select', key: 'amount', label: 'Amount',
        options: [
          { label: 'More than zero', value: 'earning' },
          { label: 'Zero only', value: 'zero' },
          { label: 'Show everything', value: '' },
        ],
      },
    ];
  }, [all, typeOf, movements]);

  const rows = useMemo(() => {
    const q = (filters.query ?? '').trim().toLowerCase();
    const out = all.filter(r => {
      const c = r.charge;
      if (q && !(c.chargeCode.toLowerCase().includes(q) || (c.chargeName ?? '').toLowerCase().includes(q))) return false;
      if (filters.container && r.containerNo !== filters.container) return false;
      if (filters.movement && c.movementCode !== filters.movement) return false;
      if (filters.settled && settledGroup(c) !== filters.settled) return false;
      if (filters.term && c.paymentTermCode !== filters.term) return false;
      if (filters.chargeType && typeOf.get(c.chargeCode) !== filters.chargeType) return false;
      if (filters.amount === 'earning' && !(c.amount > 0)) return false;
      if (filters.amount === 'zero' && c.amount > 0) return false;
      return true;
    });
    return out.sort((a, b) => {
      const va = valueOf(a, sort.key);
      const vb = valueOf(b, sort.key);
      const n = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sort.dir === 'asc' ? n : -n;
    });
  }, [all, filters, sort, typeOf]);

  // Ticking follows what is on screen: a hidden row that stayed ticked would be
  // waived or invoiced without the clerk ever having seen it.
  const selectable = rows.filter(r => isEditableCharge(r.charge));
  const selected = rows.filter(r => ticked.has(r.charge.chargeId));
  const allTicked = selectable.length > 0 && selectable.every(r => ticked.has(r.charge.chargeId));
  const toggle = (id: string) => setTicked(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const setSelection = (rs: StatementRow[]) => setTicked(new Set(rs.map(r => r.charge.chargeId)));

  const termCounts: Record<InvoiceTerm, number> = {
    CASH: selected.filter(r => r.charge.paymentTermCode === 'CASH').length,
    CREDIT: selected.filter(r => r.charge.paymentTermCode === 'CREDIT').length,
  };
  const selectedTotal = selected.reduce((n, r) => n + r.charge.total, 0);
  const shownTotal = rows.reduce((n, r) => n + r.charge.total, 0);
  const hidden = all.length - rows.length;

  const open = (no: string) => {
    setTicked(new Set());
    setTyped(no);
    router.replace(no ? `${pathname}?orderNo=${encodeURIComponent(no)}` : pathname);
  };
  const submit = (e: React.FormEvent) => { e.preventDefault(); open(typed.trim().toUpperCase()); };

  const click = (key: SortKey) =>
    setSort(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));

  const done = (message: string) => {
    toast({ variant: 'success', title: 'Statement updated', message });
    setTicked(new Set());
    statement.reload();
  };

  const exportCsv = () => {
    if (!s) return;
    saveBlob(toCsv(
      ['Container', 'Equipment', 'Movement', 'Charge', 'Name', 'Type', 'Bill to', 'Term', 'Payer', 'Qty', 'Rate',
        'Amount', 'VAT', 'Total', 'Quotation', 'Status', 'Receipt', 'Reason', 'Created'],
      rows.map(r => {
        const c = r.charge;
        return [r.containerNo ?? '', r.equipmentTypeCode ?? '', c.movementCode ?? '', c.chargeCode, c.chargeName ?? '',
          typeOf.get(c.chargeCode) ?? '', c.billTo, c.paymentTermCode, payerLabel(c.payerCode, c.payerName),
          c.quantity, c.unitRate, c.amount, c.taxAmount, c.total, c.scheduleNo ?? '', c.status, r.receiptNo ?? '',
          c.waiveReason ?? c.cancelReason ?? '', c.createdAt];
      }),
    ), `statement-${s.orderNo}.csv`);
  };

  const columnCount = COLUMNS.length + 1 + (mayEdit ? 1 : 0);

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto', paddingBottom: 40 }}>

      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          {orderNo && (
            <button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-mb-1" onClick={() => open('')}>
              <Icon name="arrowLeft" size={13} /> All statements
            </button>
          )}
          <div className="gecko-row gecko-row-baseline gecko-stack-md">
            <h1 className="gecko-page-title">Booking Statement</h1>
            <span className="gecko-badge gecko-badge-success">LIVE</span>
          </div>
          <div className="gecko-page-subtitle gecko-mt-1">
            {orderNo
              ? 'Every charge on this booking in one table, and the receipts that paid them.'
              : 'The latest bookings and what they bill. Open one to price, waive, add or invoice its lines.'}
          </div>
        </div>
        <div className="gecko-toolbar">
          {orderNo && (
            <>
              <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={exportCsv} disabled={!s}>
                <Icon name="download" size={14} /> Export
              </button>
              <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={statement.reload}>
                <Icon name="refreshCcw" size={14} /> Refresh
              </button>
            </>
          )}
        </div>
      </div>

      <form className="gecko-card" style={{ padding: 14 }} onSubmit={submit}>
        <div className="gecko-row" style={{ gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px' }}>
            <StatementSearchBox
              value={typed}
              onChange={setTyped}
              onOpen={open}
              branchId={branch?.branchId ?? ''}
            />
          </div>
          <button type="submit" className="gecko-btn gecko-btn-primary" disabled={!typed.trim()}>
            <Icon name="search" size={16} /> Open
          </button>
        </div>
      </form>

      {/* VIEW A — the register */}
      {!orderNo && <StatementRegister onOpen={open} />}

      {orderNo && statement.error && (
        <div className="gecko-alert gecko-alert-error">
          <Icon name="alertCircle" size={18} />
          <div>
            <strong>{statement.error.title}</strong>
            {statement.error.explanation && <div>{statement.error.explanation}</div>}
          </div>
        </div>
      )}

      {/* VIEW B — one booking */}
      {s && (
        <>
          <div className="gecko-card" style={{ padding: 16 }}>
            <div className="gecko-mono-strong" style={{ fontSize: 18 }}>{s.orderNo}</div>
            <div className="gecko-cell-meta gecko-mb-3">
              {s.orderTypeCode} · {s.bookingStatus.toLowerCase()} · {payerLabel(s.customerCode, s.customerName)}
              {s.customerName && s.customerCode ? <span className="gecko-mono"> ({s.customerCode})</span> : null}
            </div>
            <MoneyCards rows={all} currency={cur} />
          </div>

          {/* -menus: the card must not clip the toolbar's dropdowns. The
              table below does the corner-clipping instead. */}
          <section className="gecko-table-card gecko-table-card-menus">
            <div className="gecko-table-toolbar">
              <Icon name="filter" size={13} />
              <span>
                Showing <strong>{rows.length}</strong> of {all.length}
                {hidden > 0 && <> · {hidden} hidden{filters.amount === 'earning' ? ' (zero-value)' : ''}</>}
              </span>
              {selected.length > 0 && (
                <span className="gecko-badge gecko-badge-primary">{selected.length} ticked · {m(selectedTotal)}</span>
              )}
              <span className="gecko-table-toolbar-spacer" />
              <span>Shown total <strong className="gecko-mono">{m(shownTotal)}</strong></span>

              {mayEdit && (
                <div className="gecko-sendto">
                  <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={() => setMenu(v => !v)}>
                    <Icon name="moreHorizontal" size={13} /> Actions <Icon name="chevronDown" size={11} />
                  </button>
                  {menu && (
                    <>
                      <div className="gecko-menu-scrim" onClick={() => setMenu(false)} />
                      <div className="gecko-sendto-menu" role="menu">
                        <MenuItem label="Select all shown" onClick={() => { setSelection(selectable); setMenu(false); }} />
                        <MenuItem label="Unselect all" disabled={selected.length === 0}
                          onClick={() => { setTicked(new Set()); setMenu(false); }} />
                        <MenuItem label="Select the unpriced" onClick={() => {
                          setSelection(selectable.filter(r => isUnpriced({ charge: r.charge, receiptNo: r.receiptNo })));
                          setMenu(false);
                        }} />
                        <div className="gecko-filter-divider" />
                        <MenuItem label="Add a charge by hand" onClick={() => { setDialog({ kind: 'add', mode: 'manual' }); setMenu(false); }} />
                        <MenuItem label="Add a charge to every box" onClick={() => { setDialog({ kind: 'add', mode: 'ADD' }); setMenu(false); }} />
                        <MenuItem label="Update a charge on every box" onClick={() => { setDialog({ kind: 'add', mode: 'UPDATE' }); setMenu(false); }} />
                        <div className="gecko-filter-divider" />
                        <MenuItem label={`Waive the ${selected.length} ticked`} disabled={selected.length === 0}
                          onClick={() => { setDialog({ kind: 'waive' }); setMenu(false); }} />
                        <MenuItem label="Regenerate the cost sheet"
                          onClick={() => { setDialog({ kind: 'regenerate' }); setMenu(false); }} />
                      </div>
                    </>
                  )}
                </div>
              )}

              {mayInvoice && (
                <SendToMenu counts={termCounts} disabled={selected.length === 0}
                  onPick={action => setDialog({ kind: 'send', action })} />
              )}
              <FilterPopover
                fields={fields} values={filters} defaultValues={DEFAULTS} tone="orange"
                onChange={setFilters} onApply={setFilters} onClear={() => setFilters(DEFAULTS)}
              />
            </div>

            <div className="gecko-table-clip">
            <table className="gecko-table gecko-table-compact gecko-table-fixed">
              <thead>
                <tr>
                  <th className="gecko-select-col">
                    <input type="checkbox" className="gecko-checkbox" aria-label="Tick every charge shown"
                      checked={allTicked} disabled={selectable.length === 0}
                      onChange={() => (allTicked ? setTicked(new Set()) : setSelection(selectable))} />
                  </th>
                  {COLUMNS.map(c => (
                    <th key={c.label} title={c.title}
                      className={`gecko-th-sortable${c.num ? ' gecko-num' : ''}`}
                      style={{ width: c.width }}
                      aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                      onClick={() => click(c.key)}>
                      {c.label}
                      <span className={`gecko-sort-icon${sort.key === c.key ? (sort.dir === 'asc' ? ' gecko-sort-asc' : ' gecko-sort-desc') : ''}`} />
                    </th>
                  ))}
                  {mayEdit && <th style={{ width: '5%' }} aria-label="Edit" />}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={columnCount} style={{ padding: 0 }}>
                      <EmptyState icon="search"
                        title={all.length === 0 ? 'Nothing charged on this booking yet' : 'No charge matches the filter'}
                        description={all.length === 0
                          ? 'Charges appear as the boxes are quoted and gated.'
                          : `All ${all.length} charges are filtered out. Clear the filter to see them.`} />
                    </td>
                  </tr>
                )}
                {rows.map(r => {
                  const c = r.charge;
                  const st = CHARGE_STATUS[c.status] ?? CHARGE_STATUS.QUOTED;
                  const unpriced = isUnpriced({ charge: c, receiptNo: r.receiptNo });
                  const reason = c.waiveReason ?? c.cancelReason;
                  const dim = c.status === 'CANCELLED' || c.status === 'WAIVED';
                  const editable = isEditableCharge(c);
                  const isTicked = ticked.has(c.chargeId);
                  return (
                    <tr key={c.chargeId}
                      className={`${dim ? 'gecko-statement-row-muted' : ''}${isTicked ? ' gecko-row-ticked' : ''}`.trim() || undefined}>
                      <td className="gecko-select-col">
                        <input type="checkbox" className="gecko-checkbox" disabled={!editable}
                          aria-label={`Tick ${c.chargeCode}`} title={editable ? undefined : whyNotEditable(c)}
                          checked={isTicked} onChange={() => toggle(c.chargeId)} />
                      </td>
                      <td>
                        {r.containerNo
                          ? <Link href={`/units/unit-inquiry?no=${encodeURIComponent(r.containerNo)}`} className="gecko-mono-strong gecko-link">{formatContainerNo(r.containerNo)}</Link>
                          : <span className="gecko-cell-meta">not yet named</span>}
                        {r.equipmentTypeCode && <div className="gecko-cell-meta gecko-mono">{r.equipmentTypeCode}</div>}
                      </td>
                      <td>
                        <span className="gecko-mono">{c.movementCode ?? '—'}</span>
                        {c.eirNo && <div className="gecko-cell-meta gecko-mono gecko-cell-tight">{c.eirNo}</div>}
                      </td>
                      <td>
                        <div className="gecko-row gecko-stack-xs">
                          <span className="gecko-mono-strong">{c.chargeCode}</span>
                          {c.isLocked && <Icon name="shieldCheck" size={11} aria-label="Rate locked" />}
                          {c.source === 'MANUAL' && <span className="gecko-badge gecko-badge-xs gecko-badge-gray">by hand</span>}
                        </div>
                        <div className="gecko-cell-meta">{c.chargeName ?? ''}</div>
                        {c.scheduleNo && (
                          <div className="gecko-cell-meta gecko-cell-tight" title="The tariff version that priced it">
                            {c.scheduleNo}{c.scheduleVersionNo ? ` v${c.scheduleVersionNo}` : ''}
                          </div>
                        )}
                      </td>
                      <td><span className="gecko-badge gecko-badge-xs gecko-badge-gray">{termLabel(c.paymentTermCode)}</span></td>
                      <td>
                        <span className="gecko-cell-tight">{payerLabel(c.payerCode, c.payerName)}</span>
                        <span className="gecko-cell-meta">{c.billTo.toLowerCase()}</span>
                      </td>
                      <td className="gecko-num gecko-mono">{c.quantity}</td>
                      <td className="gecko-num gecko-mono">
                        {c.isRateOverridden && c.originalRate !== null && c.originalRate !== undefined && (
                          <div className="gecko-rate-original">{amount(c.originalRate, c.currencyCode)}</div>
                        )}
                        <span className={c.isRateOverridden ? 'gecko-rate-overridden' : undefined}>
                          {c.unitRate === null ? '—' : amount(c.unitRate, c.currencyCode)}
                        </span>
                      </td>
                      <td className="gecko-num gecko-mono" style={unpriced ? { color: 'var(--gecko-error-600)', fontWeight: 700 } : undefined}>
                        {unpriced ? 'no rate' : amount(c.amount, c.currencyCode)}
                      </td>
                      <td className="gecko-num gecko-mono">
                        <div style={{ fontWeight: 700 }}>{amount(c.total, c.currencyCode)}</div>
                        {c.taxAmount > 0 && <div className="gecko-cell-meta">inc. {amount(c.taxAmount, c.currencyCode)} VAT</div>}
                      </td>
                      <td>
                        <span className={`gecko-badge ${unpriced ? 'gecko-badge-error' : st.badge}`} title={st.hint}>
                          {unpriced ? 'No rate' : st.label}
                        </span>
                        {unpriced && <div className="gecko-cell-meta" style={{ color: 'var(--gecko-error-600)' }}>No tariff prices it</div>}
                        {r.receiptNo && <div className="gecko-cell-meta gecko-mono gecko-cell-tight">{r.receiptNo}</div>}
                        {reason && <div className="gecko-cell-meta gecko-cell-tight" title={reason}>{reason}</div>}
                      </td>
                      {mayEdit && (
                        <td>
                          {editable
                            ? (
                              <button className="gecko-btn gecko-btn-ghost gecko-btn-sm gecko-btn-icon"
                                aria-label={`Edit ${c.chargeCode}`} title="Price it, waive it, or lock the rate"
                                onClick={() => setDialog({ kind: 'charge', row: r })}>
                                <Icon name="edit" size={14} />
                              </button>
                            )
                            : <span className="gecko-cell-meta" title={whyNotEditable(c)}>—</span>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </section>

          <section className="gecko-table-card">
            <div style={{ padding: '10px 12px', fontWeight: 700, fontSize: 13 }}>Receipts · {s.receipts.length}</div>
            <table className="gecko-table gecko-table-compact gecko-table-fixed">
              <thead>
                <tr>
                  <th style={{ width: '16%' }}>Receipt</th><th style={{ width: '16%' }}>Time</th><th>Payer</th>
                  <th className="gecko-num" style={{ width: '13%' }}>Before VAT</th>
                  <th className="gecko-num" style={{ width: '11%' }}>VAT</th>
                  <th className="gecko-num" style={{ width: '13%' }}>Total</th>
                  <th style={{ width: '14%' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {s.receipts.length === 0 && (
                  <tr><td colSpan={7} className="gecko-cell-meta" style={{ textAlign: 'center', padding: 12 }}>No receipt has been issued on this booking.</td></tr>
                )}
                {s.receipts.map(r => (
                  <tr key={r.receiptId} className={r.status === 'VOIDED' ? 'gecko-statement-row-muted' : undefined}>
                    <td className="gecko-mono-strong gecko-cell-tight">{r.receiptNo}</td>
                    <td className="gecko-cell-tight">{r.receiptAt.slice(0, 16).replace('T', ' ')}</td>
                    <td className="gecko-cell-tight">{r.payerName}</td>
                    <td className="gecko-num gecko-mono">{amount(r.subtotal, r.currencyCode)}</td>
                    <td className="gecko-num gecko-mono">{amount(r.tax, r.currencyCode)}</td>
                    <td className="gecko-num gecko-mono" style={{ fontWeight: 700 }}>{amount(r.total, r.currencyCode)}</td>
                    <td>
                      <span className={`gecko-badge ${r.status === 'VOIDED' ? 'gecko-badge-gray' : 'gecko-badge-success'}`}>{r.status === 'VOIDED' ? 'Voided' : 'Issued'}</span>
                      {r.voidReason && <div className="gecko-cell-meta gecko-cell-tight">{r.voidReason}</div>}
                      {r.replacedByReceiptNo && <div className="gecko-cell-meta gecko-cell-tight">replaced by {r.replacedByReceiptNo}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="gecko-row gecko-row-wrap" style={{ gap: 8 }}>
            <Link href="/billing/cash-window" className="gecko-btn gecko-btn-ghost gecko-btn-sm"><Icon name="arrowRight" size={13} /> Cash window</Link>
            <Link href="/billing/unbilled" className="gecko-btn gecko-btn-ghost gecko-btn-sm"><Icon name="clipboardList" size={13} /> Unbilled orders</Link>
          </div>
        </>
      )}

      {/* Dialogs */}
      {dialog?.kind === 'charge' && (
        <ChargeDetailModal key={dialog.row.charge.chargeId} row={dialog.row} onClose={() => setDialog(null)} onDone={done} />
      )}
      {dialog?.kind === 'add' && s && (
        <ChargeAddModal mode={dialog.mode} orderNo={s.orderNo} rows={all} chargeCodes={chargeCodes ?? []}
          commercial={commercial ?? null} movements={movements} onClose={() => setDialog(null)} onDone={done} />
      )}
      {dialog?.kind === 'waive' && (
        <WaiveSelectedModal selected={selected} currency={cur} onClose={() => setDialog(null)} onDone={done} />
      )}
      {dialog?.kind === 'regenerate' && s && (
        <RegenerateModal orderNo={s.orderNo} rows={all} onClose={() => setDialog(null)} onDone={done} />
      )}
      {dialog?.kind === 'send' && (
        <SendToInvoiceModal kind={dialog.action.kind} term={dialog.action.term}
          selected={selected} currency={cur} onClose={() => setDialog(null)} onDone={done} />
      )}
    </div>
  );
}

function MenuItem({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button className="gecko-sendto-item" role="menuitem" disabled={disabled} onClick={onClick}>
      <span className="gecko-sendto-item-label">{label}</span>
    </button>
  );
}

/** CASH / CREDIT / FREE read better as words than as codes in a narrow column. */
const TERM_WORDS: Record<string, string> = { CASH: 'Cash', CREDIT: 'Credit', FREE: 'Free' };
const termLabel = (code: string) => TERM_WORDS[code] ?? code;
