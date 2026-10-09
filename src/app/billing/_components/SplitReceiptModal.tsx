"use client";
import React, { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { useApi } from '@/lib/api/use-api';
import { ApiError } from '@/lib/api/problem';
import { amount } from '@/lib/api/charges';
import { formatContainerNo } from '@/lib/api/tos';
import { CHANNEL_LABEL, PAYMENT_CHANNELS, type PaymentChannel } from '@/lib/api/window';
import {
  canChangePayer, canDivide, channelLabel, receiptPath, splitReceipt, WITHHOLDING_FLOOR,
  type Receipt, type ReceiptLine, type SplitPart,
} from '@/lib/api/receipts';
import { CustomerPicker, type PickedCustomer } from './PartyPicker';

/**
 * SPLIT A GATE RECEIPT between the parties who actually owe it.
 *
 * The barrier takes one truck on one receipt, and only afterwards does the
 * driver say two of the boxes are the haulier's.
 *
 * THE SHAPE OF THE QUESTION (owner, 2026-10-08). The clerk ticks the lines that
 * belong to SOMEBODY ELSE and names that one payer; everything unticked stays
 * with whoever the receipt was already made out to. That is one payer to type,
 * not two, and it matches how the depot describes the job — "these two are the
 * haulier's". A third payer is rare, so "Another payer" is a button rather than
 * a shape the common case has to be poured into.
 *
 * Under it the API still gets what it wants: every line on exactly one part,
 * the original voided, and the parts together matching the original channel for
 * channel. THE MONEY DOES NOT MOVE — the dialog shows that check before it will
 * send, and the server checks it again and answers 409.
 */

/**
 * Who a part is made out to.
 *
 * `original` is not a party that was picked — it is the receipt's own payer,
 * carried across unchanged. Keeping it as its own case rather than inventing a
 * PartyDetail for it means nothing is fabricated: what gets sent is exactly
 * what the receipt already says.
 */
type PartPayer = { kind: 'original' } | { kind: 'picked'; picked: PickedCustomer | null };

interface PartDraft {
  key: string;
  payer: PartPayer;
  wht: boolean;
  /** False until the clerk ticks or unticks it; before that W/H is inherited. */
  whtSet: boolean;
  /** Until the clerk touches the money, a part's payment follows its own nett. */
  authored: boolean;
  payments: { channel: PaymentChannel; amount: number; referenceNo: string | null; bankName: string | null }[];
}

const STAYS = 'stays';

const newPart = (): PartDraft => ({
  key: `p${Math.random().toString(36).slice(2, 9)}`,
  payer: { kind: 'picked', picked: null },
  wht: false,
  whtSet: false,
  authored: false,
  payments: [],
});

const to2 = (n: number) => Math.round(n * 100) / 100;

export function SplitReceiptModal({ receiptId, onClose, onDone }: {
  receiptId: string;
  onClose: () => void;
  /** The new receipts, in the order the parts were built. */
  onDone: (receipts: Receipt[]) => void;
}) {
  /**
   * The receipt is re-read here rather than handed in.
   *
   * Three screens open this dialog and each holds its own shape of a receipt,
   * but more than that: the check that the money adds up is against what the
   * SERVER says the payments are now. Splitting against a stale copy would pass
   * here and fail there.
   */
  const { data: receipt, error: readError, loading } = useApi<Receipt>(receiptPath(receiptId));

  /** The parts BEYOND the one that stays. Usually exactly one. */
  const [extra, setExtra] = useState<PartDraft[]>(() => [newPart()]);
  /** The part that keeps the original payer, which never needs picking. */
  const [stays, setStays] = useState<PartDraft>(() => ({ ...newPart(), key: STAYS, payer: { kind: 'original' } }));
  /** lineNo → part key. Absent means it stays. */
  const [assign, setAssign] = useState<Record<number, string>>({});
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ApiError | null>(null);

  const parts = useMemo(() => [stays, ...extra], [stays, extra]);
  const currency = receipt?.currencyCode ?? 'THB';
  const m = (v: number) => amount(v, currency);
  const lines = useMemo(() => receipt?.lines ?? [], [receipt]);

  /**
   * TWO THINGS A CLERK DOES TO A RECEIPT (Gecko.Revenue d5e7665, 2026-10-09).
   *
   * CHANGE PAYER is one part holding every line. It works on ANY issued
   * receipt — gate, window or cash bill — on ANY day, and the receipt is
   * UPDATED IN PLACE: same id, same number, same lines, same payments, same
   * coupons. Only who it is made out to changes. The haulier keyed where the
   * customer should have been is the commonest mistake at a barrier, and this
   * is the correction — nothing is voided, nothing is refunded, and the driver
   * is never asked for the money a second time.
   *
   * SPLIT shares the charges out between payers. That is still a GATE receipt
   * on the day it was issued; the first part keeps the original number and the
   * rest get new ones.
   *
   * To the API they are one call: the number of parts decides which it is.
   */
  const [mode, setMode] = useState<'split' | 'reissue'>('reissue');
  // Nothing to divide with one charge — and nothing MAY be divided unless the
  // API would take it, so a cash-bill or an older receipt is a payer change.
  const onlyReissue = lines.length < 2 || !canDivide(receipt);
  const reissue = onlyReissue || mode === 'reissue';
  /** In a re-issue the whole receipt is this one part. */
  const target = extra[0];
  /** Where a line goes. Anything pointing at a removed part falls back to staying. */
  const partOf = (l: ReceiptLine) => {
    if (reissue) return target.key;
    const k = assign[l.lineNo];
    return k && parts.some(p => p.key === k) ? k : STAYS;
  };
  const linesOf = (key: string) => lines.filter(l => partOf(l) === key);

  /**
   * The channel to put a part's money on by default.
   *
   * A gate receipt is nearly always one channel — the driver pays cash — so the
   * parts inherit it and the clerk types nothing. Where the original was mixed,
   * the biggest channel is the sensible guess and the check table below shows
   * at once if it was the wrong one.
   */
  const defaultChannel = useMemo<PaymentChannel>(() => {
    const by = new Map<string, number>();
    for (const p of receipt?.payments ?? []) by.set(p.channel, (by.get(p.channel) ?? 0) + p.amount);
    const best = [...by.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return (PAYMENT_CHANNELS as readonly string[]).includes(best ?? '') ? (best as PaymentChannel) : 'CASH';
  }, [receipt]);

  /** A part's own money. W/H mirrors the gate: 3% of the amount before VAT. */
  const sumOf = (p: PartDraft) => {
    const mine = linesOf(p.key);
    const net = to2(mine.reduce((n, l) => n + l.amount, 0));
    const tax = to2(mine.reduce((n, l) => n + l.taxAmount, 0));
    const total = to2(net + tax);
    const mayWithhold = total > WITHHOLDING_FLOOR;
    // Re-issuing changes the name on the receipt, not the deal: the original's
    // withholding carries over until the clerk says otherwise, because the
    // payments must still come to total − withheld.
    const on = p.whtSet ? p.wht : (reissue ? (receipt?.withholdingTaxAmount ?? 0) > 0 : false);
    const wht = on && mayWithhold ? to2((net * 3) / 100) : 0;
    return { net, tax, total, wht, nett: to2(total - wht), mayWithhold, lines: mine.length };
  };

  /**
   * What a part will actually pay with. DERIVED until the clerk edits it, so
   * ticking a line re-balances the money instead of leaving a shortfall to
   * chase. The moment they type, `authored` is set and the figures are theirs.
   */
  const paymentsOf = (p: PartDraft): PartDraft['payments'] => {
    if (p.authored && p.payments.length > 0) return p.payments;
    // A re-issue takes the original's payments VERBATIM — channel for channel,
    // reference and all. Collapsing a mixed receipt onto one channel would fail
    // the server's per-channel check for no reason.
    if (reissue && (receipt?.payments.length ?? 0) > 0) {
      return receipt!.payments.map(q => ({
        channel: (PAYMENT_CHANNELS as readonly string[]).includes(q.channel)
          ? (q.channel as PaymentChannel) : defaultChannel,
        amount: q.amount,
        referenceNo: q.referenceNo,
        bankName: q.bankName,
      }));
    }
    return [{ channel: defaultChannel, amount: sumOf(p).nett, referenceNo: null, bankName: null }];
  };

  /** The party a part has picked, if it has picked one. */
  const pickedOf = (p: PartDraft) => (p.payer.kind === 'picked' ? p.payer.picked : null);

  /** Who a part is made out to, resolved against the receipt. */
  const payerOf = (p: PartDraft) => {
    if (p.payer.kind === 'original') {
      return receipt
        ? {
          partyCode: receipt.payerPartyCode ?? '',
          name: receipt.payerName ?? '',
          taxId: receipt.payerTaxId,
          branchNo: receipt.payerBranchNo,
          address: receipt.payerAddress,
        }
        : null;
    }
    const picked = pickedOf(p);
    return picked
      ? {
        partyCode: picked.party.partyCode,
        name: picked.payer.name,
        taxId: picked.payer.taxId,
        branchNo: picked.payer.branchNo,
        address: picked.payer.address,
      }
      : null;
  };

  const originalName = receipt?.payerName?.trim() || 'the original payer';

  /**
   * Channel by channel, the parts against the original.
   *
   * This is the one check that matters: a split that changes what the drawer
   * holds is not a split. It is shown as a table rather than as a yes/no,
   * because when it is wrong the clerk needs to know by how much and where.
   */
  const check = useMemo(() => {
    const was = new Map<string, number>();
    for (const p of receipt?.payments ?? []) was.set(p.channel, to2((was.get(p.channel) ?? 0) + p.amount));
    const now = new Map<string, number>();
    for (const p of (reissue ? [target] : parts)) for (const q of paymentsOf(p)) {
      if (!q.amount) continue;
      now.set(q.channel, to2((now.get(q.channel) ?? 0) + q.amount));
    }
    const channels = [...new Set([...was.keys(), ...now.keys()])].sort();
    const rows = channels.map(c => ({
      channel: c, was: was.get(c) ?? 0, now: now.get(c) ?? 0,
      gap: to2((now.get(c) ?? 0) - (was.get(c) ?? 0)),
    }));
    return { rows, balanced: rows.every(r => Math.abs(r.gap) <= 0.01) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt, parts, assign, lines, defaultChannel, reissue, target]);

  const moved = lines.filter(l => partOf(l) !== STAYS).length;
  /** Re-issuing sends one part; a split sends the one that stays and the rest. */
  const sending = reissue ? [target] : parts;
  const empty = sending.filter(p => linesOf(p.key).length === 0);
  const noPayer = sending.filter(p => {
    const who = payerOf(p);
    return !who || !who.partyCode || !who.name.trim();
  });
  const missingRef = sending.some(p =>
    paymentsOf(p).some(q => q.channel !== 'CASH' && q.amount > 0 && !q.referenceNo?.trim()));
  const unbalanced = sending.filter(p => {
    const taken = to2(paymentsOf(p).reduce((n, q) => n + (q.amount || 0), 0));
    return Math.abs(taken - sumOf(p).nett) > 0.01;
  });

  // Any issued receipt can change payer; only a gate receipt of today can have
  // its charges shared out (Gecko.Revenue d5e7665).
  const splittable = canChangePayer(receipt);
  const divisible = canDivide(receipt);
  /**
   * A receipt is split by moving CHARGES between payers — `lineNos` per part is
   * the API's unit — so one charge cannot be divided. Saying that when the
   * dialog opens is the only honest thing to do: the form below would let the
   * clerk tick the single line, fill in a payer, and then block at the footer
   * on a rule that was never satisfiable.
   */
  const ready = Boolean(
    receipt && splittable && (reissue || moved > 0)
    && empty.length === 0 && noPayer.length === 0 && !missingRef
    && unbalanced.length === 0 && check.balanced && !busy,
  );

  const why = !receipt ? ''
    : !splittable ? 'Only an issued receipt can be changed.'
      : reissue ? ''
      : moved === 0 ? 'Tick the charges that go to the other payer.'
        : empty.length > 0
          ? `${empty.map(p => (p.key === STAYS ? originalName : payerOf(p)?.name.trim() || 'the other payer')).join(' and ')} would get no charges — a receipt with nothing on it cannot be issued.`
          : noPayer.length > 0 ? 'Choose who the ticked charges go to.'
            : unbalanced.length > 0 ? 'A payment does not come to its nett.'
              : missingRef ? 'A transfer, cheque or card needs its reference.'
                : !check.balanced ? 'The parts together must come to what was taken.'
                  : '';

  const patch = (key: string, p: Partial<PartDraft>) =>
    key === STAYS
      ? setStays(cur => ({ ...cur, ...p }))
      : setExtra(cur => cur.map(x => (x.key === key ? { ...x, ...p } : x)));

  const dropPart = (key: string) => {
    // Its lines come back to the part that stays rather than going nowhere: an
    // unassigned line is a line the clerk cannot see any more.
    setAssign(cur => {
      const next = { ...cur };
      for (const [no, k] of Object.entries(next)) if (k === key) delete next[Number(no)];
      return next;
    });
    setExtra(cur => cur.filter(p => p.key !== key));
  };

  /** Two parts: a tick is enough. Three or more: the line must say which. */
  const simple = extra.length === 1;

  async function go() {
    if (!ready || !receipt) return;
    setBusy(true);
    setProblem(null);
    try {
      const body: SplitPart[] = sending.map(p => {
        const who = payerOf(p)!;
        return {
          lineNos: linesOf(p.key).map(l => l.lineNo),
          payerPartyCode: who.partyCode,
          payer: { name: who.name.trim(), taxId: who.taxId, branchNo: who.branchNo, address: who.address },
          withholdingTax: sumOf(p).wht > 0,
          payments: paymentsOf(p).filter(q => q.amount > 0).map(q => ({
            channel: q.channel,
            amount: q.amount,
            // Cash was already tendered on the original; a split moves money
            // between receipts and gives no change.
            tenderedAmount: null,
            referenceNo: q.referenceNo?.trim() || null,
            bankName: q.bankName?.trim() || null,
          })),
        };
      });
      onDone(await splitReceipt(receipt.receiptId, { parts: body, remarks: remarks.trim() || null }));
    } catch (e) {
      setProblem(e instanceof ApiError ? e : new ApiError(0, 'The receipt could not be split.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} size="xl" closeOnBackdrop={false}
      title={`Split ${receipt?.receiptNo ?? 'this receipt'}`}
      subtitle={receipt
        ? `${lines.length} line${lines.length === 1 ? '' : 's'} · ${m(receipt.total)} taken · the money does not change`
        : 'Reading the receipt…'}
      footer={
        <>
          <span className="gecko-modal-footer-note gecko-flex-1">{why}</span>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm" disabled={!ready} onClick={() => void go()}>
            <Icon name="send" size={13} />
            {busy
              ? (reissue ? 'Changing the payer…' : 'Splitting…')
              : reissue ? 'Change payer' : `Split into ${parts.length} receipts`}
          </button>
        </>
      }>
      <div className="gecko-stack">
        {readError && (
          <div role="alert" className="gecko-alert gecko-alert-error">
            <Icon name="alertCircle" size={18} />
            <div><strong>{readError.title}</strong><div>{readError.explanation ?? readError.message}</div></div>
          </div>
        )}
        {loading && !receipt && <div className="gecko-cell-meta">Reading the receipt…</div>}

        {problem && (
          <div role="alert" className="gecko-alert gecko-alert-error">
            <Icon name="alertCircle" size={18} />
            <div>
              <strong>{problem.status === 409 ? 'The server refused it' : problem.title || 'It was refused'}</strong>
              <div>{problem.status === 409
                ? problem.explanation ?? 'Dividing a receipt needs a gate receipt of today, and the parts must come to what was taken.'
                : problem.explanation ?? problem.message}</div>
            </div>
          </div>
        )}

        {receipt && !splittable && (
          <div role="status" className="gecko-alert gecko-alert-warning">
            <Icon name="alertCircle" size={16} />
            <span>
              Only an <strong>issued</strong> receipt can be changed. This one is {receipt.status.toLowerCase()}.
            </span>
          </div>
        )}

        {receipt && splittable && (
          <>
            {/* Which of the two jobs this is. A one-charge receipt has nothing
                to divide, so the choice is not offered — it is a re-issue. */}
            {!onlyReissue && (
              <div className="gecko-split-modes" role="radiogroup" aria-label="What to do with this receipt">
                <button role="radio" aria-checked={!reissue} disabled={busy}
                  className={`gecko-btn gecko-btn-sm ${reissue ? 'gecko-btn-outline' : 'gecko-btn-primary'}`}
                  onClick={() => setMode('split')}>
                  Split between payers
                </button>
                <button role="radio" aria-checked={reissue} disabled={busy}
                  className={`gecko-btn gecko-btn-sm ${reissue ? 'gecko-btn-primary' : 'gecko-btn-outline'}`}
                  onClick={() => setMode('reissue')}>
                  Re-issue to another payer
                </button>
              </div>
            )}

            <div className="gecko-alert gecko-alert-info">
              <Icon name="alertCircle" size={16} />
              <span>
                {reissue ? (
                  <>
                    {lines.length < 2
                      ? <>{receipt.receiptNo} has one charge, so it cannot be divided — but you can change
                          who it is made out to. </>
                      : !divisible
                        ? <>This receipt cannot be divided — that is a gate receipt, on the day it was
                            issued — but you can change who it is made out to. </>
                        : <>Every charge stays together and moves to one payer. </>}
                    <strong>{receipt.receiptNo} keeps its number</strong> — only who it is made out to
                    changes. The money is untouched: the same payments, nothing refunded, and the driver
                    is not asked again.
                  </>
                ) : (
                  <>
                    Tick the charges that go to someone else. The rest stay with <strong>{originalName}</strong>.
                    {' '}<strong>{receipt.receiptNo} keeps the first part</strong>; the other parts get new
                    numbers. Nothing is refunded and no price changes.
                  </>
                )}
              </span>
            </div>

            {/* ── the lines, and which of them move ──────────────────────── */}
            <div className="gecko-table-clip">
              <table className="gecko-table gecko-table-compact gecko-table-fixed">
                <thead>
                  <tr>
                    <th style={{ width: '5%' }}>#</th>
                    <th style={{ width: '12%' }}>Charge</th>
                    <th>Description</th>
                    <th style={{ width: '13%' }}>Container</th>
                    <th style={{ width: '9%' }}>Movement</th>
                    <th className="gecko-num" style={{ width: '10%' }}>Amount</th>
                    <th className="gecko-num" style={{ width: '9%' }}>VAT</th>
                    <th className="gecko-num" style={{ width: '10%' }}>Total</th>
                    {!reissue && <th style={{ width: '18%' }}>{simple ? 'To another payer' : 'Goes to'}</th>}
                  </tr>
                </thead>
                <tbody>
                  {lines.map(l => {
                    const at = partOf(l);
                    return (
                      <tr key={l.lineNo} className={at !== STAYS ? 'gecko-row-ticked' : undefined}>
                        <td className="gecko-cell-meta">{l.lineNo}</td>
                        <td className="gecko-mono-strong">{l.chargeCode}</td>
                        <td><span className="gecko-cell-tight">{l.description ?? '—'}</span></td>
                        <td className="gecko-mono">{l.containerNo ? formatContainerNo(l.containerNo) : '—'}</td>
                        <td className="gecko-mono gecko-cell-meta">{l.movementCode ?? '—'}</td>
                        <td className="gecko-num gecko-mono">{m(l.amount)}</td>
                        <td className="gecko-num gecko-mono gecko-cell-meta">{m(l.taxAmount)}</td>
                        <td className="gecko-num gecko-mono gecko-mono-strong">{m(l.amount + l.taxAmount)}</td>
                        {!reissue && <td>
                          {simple ? (
                            <input type="checkbox" disabled={busy}
                              aria-label={`Move line ${l.lineNo} to the other payer`}
                              checked={at !== STAYS}
                              onChange={e => setAssign(cur => ({
                                ...cur, [l.lineNo]: e.target.checked ? extra[0].key : STAYS,
                              }))} />
                          ) : (
                            <select className="gecko-select gecko-input-sm" value={at} disabled={busy}
                              aria-label={`Which payer takes line ${l.lineNo}`}
                              onChange={e => setAssign(cur => ({ ...cur, [l.lineNo]: e.target.value }))}>
                              <option value={STAYS}>Stays · {originalName}</option>
                              {extra.map((p, i) => {
                                const who = payerOf(p);
                                return <option key={p.key} value={p.key}>{who?.name.trim() || `Payer ${i + 2}`}</option>;
                              })}
                            </select>
                          )}
                        </td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── the part that stays ────────────────────────────────────── */}
            {!reissue && <PartBlock
              title={`Stays with ${originalName}`}
              sum={sumOf(stays)} payments={paymentsOf(stays)} currency={currency} busy={busy}
              onPatch={p => patch(STAYS, p)}>
              {/* The receipt's own payer, carried across. It is offered as a
                  pick only when the original named no party — a walk-in — since
                  the API wants a party code on every part. */}
              {stays.payer.kind === 'original' ? (
                <div className="gecko-split-payer-kept">
                  <div>
                    <div className="gecko-kv-label">Payer</div>
                    <div className="gecko-bill-party-name">{originalName}</div>
                    <div className="gecko-cell-meta">
                      {receipt.payerPartyCode
                        ? <span className="gecko-mono">{receipt.payerPartyCode}</span>
                        : <span className="gecko-tone-error">This receipt names no customer — choose one.</span>}
                      {receipt.payerTaxId && <> · tax <span className="gecko-mono">{receipt.payerTaxId}</span></>}
                    </div>
                  </div>
                  <button className="gecko-btn gecko-btn-outline gecko-btn-sm" disabled={busy}
                    onClick={() => patch(STAYS, { payer: { kind: 'picked', picked: null } })}>
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <CustomerPicker
                    picked={pickedOf(stays)} disabled={busy}
                    roles={['CUSTOMER', 'HAULIER']} label="Payer" id={`split-${STAYS}`}
                    onPick={c => patch(STAYS, { payer: { kind: 'picked', picked: c } })}
                    onPayerChange={payer => {
                      const was = pickedOf(stays);
                      if (was) patch(STAYS, { payer: { kind: 'picked', picked: { ...was, payer } } });
                    }} />
                  <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" disabled={busy}
                    onClick={() => patch(STAYS, { payer: { kind: 'original' } })}>
                    Use {originalName} again
                  </button>
                </>
              )}
            </PartBlock>}

            {/* ── the payers the charges move to ─────────────────────────── */}
            {(reissue ? [target] : extra).map((p, i) => (
              <PartBlock key={p.key}
                title={reissue ? 'Made out to' : extra.length === 1 ? 'Goes to another payer' : `Payer ${i + 2}`}
                lockedPayments={reissue}
                sum={sumOf(p)} payments={paymentsOf(p)} currency={currency} busy={busy}
                onPatch={x => patch(p.key, x)}
                onRemove={!reissue && extra.length > 1 && !busy ? () => dropPart(p.key) : undefined}>
                <CustomerPicker
                  picked={pickedOf(p)} disabled={busy}
                  roles={['CUSTOMER', 'HAULIER']} label="Payer" id={`split-${p.key}`}
                  onPick={c => patch(p.key, { payer: { kind: 'picked', picked: c } })}
                  onPayerChange={payer => {
                    const was = pickedOf(p);
                    if (was) patch(p.key, { payer: { kind: 'picked', picked: { ...was, payer } } });
                  }} />
              </PartBlock>
            ))}

            {!reissue && (
              <div>
                <button className="gecko-btn gecko-btn-outline gecko-btn-sm" disabled={busy || extra.length >= 5}
                  onClick={() => setExtra(cur => [...cur, newPart()])}>
                  <Icon name="plus" size={13} /> Another payer
                </button>
              </div>
            )}

            {/* ── the money, before and after ────────────────────────────── */}
            <section className="gecko-card gecko-card-padded gecko-stack-sm">
              <div className="gecko-stat-label">The drawer must not change</div>
              <table className="gecko-table gecko-table-compact">
                <thead>
                  <tr>
                    <th>Channel</th>
                    <th className="gecko-num">On {receipt.receiptNo}</th>
                    <th className="gecko-num">On the new receipts</th>
                    <th className="gecko-num">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {check.rows.map(r => (
                    <tr key={r.channel} className={Math.abs(r.gap) > 0.01 ? 'gecko-split-off' : undefined}>
                      <td>{channelLabel(r.channel)}</td>
                      <td className="gecko-num gecko-mono">{m(r.was)}</td>
                      <td className="gecko-num gecko-mono">{m(r.now)}</td>
                      <td className="gecko-num gecko-mono">
                        {Math.abs(r.gap) <= 0.01 ? '—' : `${r.gap > 0 ? '+' : ''}${m(r.gap)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!check.balanced && (
                <div className="gecko-cashbill-balance gecko-cashbill-short">
                  <Icon name="alertCircle" size={14} />
                  <span>The parts do not come to what was taken. Nothing will be sent until they do.</span>
                </div>
              )}
            </section>

            <div className="gecko-form-group">
              <label className="gecko-form-label" htmlFor="splitRemarks">Remarks</label>
              <input id="splitRemarks" className="gecko-input" maxLength={300} disabled={busy}
                placeholder="Why it was split — printed on the new receipts"
                value={remarks} onChange={e => setRemarks(e.target.value)} />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

interface PartSum {
  net: number; tax: number; total: number; wht: number; nett: number; mayWithhold: boolean; lines: number;
}

/** One payer: who they are, what they take, and how they pay for it. */
function PartBlock({ title, sum, payments, currency, busy, lockedPayments, children, onPatch, onRemove }: {
  title: string;
  sum: PartSum;
  payments: PartDraft['payments'];
  currency: string;
  busy: boolean;
  /**
   * A re-issue must take the SAME money as the receipt it replaces, channel for
   * channel, or the API answers 409. There is nothing for the clerk to decide,
   * so the payments are shown and not offered for editing.
   */
  lockedPayments?: boolean;
  children: React.ReactNode;
  onPatch: (p: Partial<PartDraft>) => void;
  onRemove?: () => void;
}) {
  const m = (v: number) => amount(v, currency);
  return (
    <section className="gecko-card gecko-card-padded gecko-card-menus gecko-stack-sm">
      <div className="gecko-row gecko-row-between gecko-row-baseline">
        <div className="gecko-stat-label">
          {title} · {sum.lines} line{sum.lines === 1 ? '' : 's'} · {m(sum.total)}
        </div>
        {onRemove && (
          <button className="gecko-icon-btn-ghost" aria-label={`Remove ${title}`} onClick={onRemove}>
            <Icon name="trash" size={14} />
          </button>
        )}
      </div>

      {children}

      <div className="gecko-split-money">
        <div className="gecko-stack-xs">
          <Row label="Amount" value={m(sum.net)} />
          <Row label="VAT" value={m(sum.tax)} />
          <Row label="Total" value={m(sum.total)} strong />
          <label className="gecko-split-wht" title={sum.mayWithhold
            ? 'The customer withholds 3% and remits it themselves'
            : `Offered only over ${amount(WITHHOLDING_FLOOR, currency)}`}>
            <input type="checkbox" checked={sum.wht > 0} disabled={busy || !sum.mayWithhold || lockedPayments}
              onChange={e => onPatch({ wht: e.target.checked, whtSet: true })} />
            <span>Withholding tax (3%)</span>
          </label>
          {sum.wht > 0 && <Row label="Withheld" value={`− ${m(sum.wht)}`} />}
          <Row label="Nett to take" value={m(sum.nett)} strong />
        </div>

        {lockedPayments
          ? (
            <div className="gecko-stack-xs">
              <div className="gecko-kv-label">Paid by — unchanged</div>
              {payments.map((p, i) => (
                <div key={i} className="gecko-invoice-total-row">
                  <span>
                    {CHANNEL_LABEL[p.channel]}
                    {p.referenceNo && <span className="gecko-cell-meta"> · {p.referenceNo}</span>}
                    {p.bankName && <span className="gecko-cell-meta"> · {p.bankName}</span>}
                  </span>
                  <span className="gecko-mono">{amount(p.amount, currency)}</span>
                </div>
              ))}
              <div className="gecko-cell-meta">
                A re-issue takes the same money as the receipt it replaces, so there is nothing to change here.
              </div>
            </div>
          )
          : (
            <PartPayments payments={payments} nett={sum.nett} currency={currency} disabled={busy}
              onChange={p => onPatch({ authored: true, payments: p })} />
          )}
      </div>
    </section>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="gecko-invoice-total-row">
      <span>{label}</span>
      <span className={`gecko-mono${strong ? ' gecko-mono-strong' : ''}`}>{value}</span>
    </div>
  );
}

/**
 * How this part was paid.
 *
 * It opens on the part's own nett, on the channel the original used, so the
 * common case needs no typing at all — the shortfall only appears when a clerk
 * has deliberately made one.
 */
function PartPayments({ payments, nett, currency, disabled, onChange }: {
  payments: PartDraft['payments'];
  nett: number;
  currency: string;
  disabled: boolean;
  onChange: (p: PartDraft['payments']) => void;
}) {
  const m = (v: number) => amount(v, currency);
  const taken = to2(payments.reduce((n, p) => n + (p.amount || 0), 0));
  const gap = to2(taken - nett);
  const patch = (i: number, p: Partial<PartDraft['payments'][number]>) =>
    onChange(payments.map((row, at) => (at === i ? { ...row, ...p } : row)));

  return (
    <div className="gecko-stack-xs">
      {payments.map((p, i) => (
        <div key={i} className="gecko-split-payment">
          <select className="gecko-select gecko-input-sm" value={p.channel} disabled={disabled} aria-label="Paid by"
            onChange={e => {
              const channel = e.target.value as PaymentChannel;
              patch(i, channel === 'CASH' ? { channel, referenceNo: null, bankName: null } : { channel });
            }}>
            {PAYMENT_CHANNELS.map(c => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
          </select>
          <input className="gecko-input gecko-input-sm gecko-text-mono gecko-input-money"
            type="number" min={0} step="0.01" inputMode="decimal" disabled={disabled} aria-label="Amount"
            value={p.amount === 0 ? '' : p.amount}
            onChange={e => patch(i, { amount: Number(e.target.value) || 0 })} />
          {p.channel !== 'CASH' && (
            <>
              <input className="gecko-input gecko-input-sm gecko-text-mono" placeholder="Reference" maxLength={60}
                disabled={disabled} aria-label="Reference"
                value={p.referenceNo ?? ''} onChange={e => patch(i, { referenceNo: e.target.value || null })} />
              <input className="gecko-input gecko-input-sm" placeholder="Bank" maxLength={60} disabled={disabled}
                aria-label="Bank"
                value={p.bankName ?? ''} onChange={e => patch(i, { bankName: e.target.value || null })} />
            </>
          )}
          {payments.length > 1 && !disabled && (
            <button className="gecko-icon-btn-ghost" aria-label="Remove this payment"
              onClick={() => onChange(payments.filter((_, at) => at !== i))}>
              <Icon name="trash" size={13} />
            </button>
          )}
        </div>
      ))}

      <div className="gecko-row gecko-row-between gecko-row-baseline">
        <button className="gecko-btn gecko-btn-ghost gecko-btn-sm" disabled={disabled || payments.length >= 4}
          onClick={() => onChange([...payments,
            { channel: 'TRANSFER', amount: gap < 0 ? Math.abs(gap) : 0, referenceNo: null, bankName: null }])}>
          <Icon name="plus" size={12} /> Pay this part two ways
        </button>
        {Math.abs(gap) > 0.01 && (
          <span className="gecko-cell-meta gecko-split-gap">
            {gap < 0 ? `${m(Math.abs(gap))} short` : `${m(gap)} over`}
          </span>
        )}
      </div>
    </div>
  );
}
