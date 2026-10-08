"use client";
import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { apiGet, apiSend } from '@/lib/api/client';
import { ApiError } from '@/lib/api/problem';

/**
 * Move the ticked containers onto another order — Vector's
 * Operation.ContainerTransfer, bound to
 * POST /api/tos/bookings/{id}/containers/transfer (live 2026-10-07).
 *
 * Until today this searched a hardcoded list of eight invented bookings and
 * then reported a success that never happened. It now searches the real
 * register, narrowed to what the API will actually accept: same branch, same
 * ORDER TYPE, status OPEN. Narrowing the search is not decoration — a target of
 * the wrong type is refused, and finding that out after picking is a worse way
 * to learn it.
 *
 * One rule is enforced HERE rather than left to the server, because the server
 * can only answer once the clerk has committed: at least one active box must
 * stay on this order. An order with nothing left on it is not a transfer, it is
 * an order that should have been cancelled.
 */

/** One booking the boxes could move to, as the register answers it. */
export interface TransferTarget {
  bookingId: string;
  orderNo: string;
  carrierRef: string | null;
  orderTypeCode: string;
  customerCode: string | null;
  vesselCallId: string | null;
  voyage: string | null;
  status: string;
  qtyRequired: number;
  qtyAssigned: number;
}

export function TransferContainersModal<TDetail>({
  sourceBookingId, sourceOrderNo, sourceOrderTypeCode, sourceVesselCallId,
  branchId, selectedIds, activeCount, onCancel, onTransferred,
}: {
  sourceBookingId: string;
  sourceOrderNo: string;
  sourceOrderTypeCode: string;
  /** Null for depot work — there is no sailing to share, so that list is hidden. */
  sourceVesselCallId: string | null;
  branchId: string;
  selectedIds: string[];
  /** Boxes still on the booking; the "one must stay" rule counts these. */
  activeCount: number;
  onCancel: () => void;
  /** The API answers the SOURCE booking's detail — the caller reloads from it. */
  onTransferred: (detail: TDetail, target: TransferTarget) => void;
}) {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<TransferTarget | null>(null);
  const [rows, setRows] = useState<TransferTarget[]>([]);
  const [sameSailing, setSameSailing] = useState<TransferTarget[]>([]);
  const [looking, setLooking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ title: string; detail: string } | null>(null);

  const count = selectedIds.length;
  const blocked = count === 0
    ? 'Tick the containers to move first.'
    : count >= activeCount && activeCount > 0
      ? 'At least one container must stay on this order. Move fewer, or cancel the order instead.'
      : null;

  const query = useCallback((text: string, vesselCallId?: string | null) => {
    // Page size and search are PascalCase; the filters are camelCase. Sending
    // the wrong casing is ignored silently and the clerk gets a list that does
    // not match what they asked for.
    const p = new URLSearchParams({ PageSize: '20', branchId, status: 'OPEN', orderTypeCode: sourceOrderTypeCode });
    if (text.trim()) p.set('Search', text.trim());
    if (vesselCallId) p.set('vesselCallId', vesselCallId);
    return apiGet<{ items: TransferTarget[] }>(`/api/tos/bookings?${p.toString()}`)
      .then(r => (r.items ?? []).filter(x => x.bookingId !== sourceBookingId))
      .catch(() => []);
  }, [branchId, sourceOrderTypeCode, sourceBookingId]);

  // The same sailing is where a box usually goes, so offer it unasked.
  useEffect(() => {
    if (!sourceVesselCallId) return;
    let alive = true;
    void query('', sourceVesselCallId).then(r => { if (alive) setSameSailing(r); });
    return () => { alive = false; };
  }, [query, sourceVesselCallId]);

  /**
   * Typed search, settled before it is sent.
   *
   * `looking` is raised INSIDE the timeout, not beside it: setting state
   * synchronously in an effect makes React render twice for one keystroke, and
   * at a counter that is the difference between a list that feels instant and
   * one that flickers.
   */
  useEffect(() => {
    // Nothing is cleared on a short search: the list below shows `sameSailing`
    // in that case, so stale matches are never on screen. Clearing them here
    // would be a synchronous setState in an effect, and a wasted render.
    if (search.trim().length < 2) return;
    let alive = true;
    const t = setTimeout(() => {
      if (!alive) return;
      setLooking(true);
      void query(search).then(r => { if (alive) { setRows(r); setLooking(false); } });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [search, query]);

  async function transfer() {
    if (!picked || blocked) return;
    setBusy(true);
    setProblem(null);
    try {
      const detail = await apiSend<TDetail>(
        'POST', `/api/tos/bookings/${sourceBookingId}/containers/transfer`,
        { targetBookingId: picked.bookingId, bookingContainerIds: selectedIds });
      onTransferred(detail, picked);
    } catch (e) {
      // The server's own words: it knows why (wrong type, not OPEN, line full)
      // and inventing a friendlier sentence would lose which it was.
      const err = e instanceof ApiError ? e : new ApiError(0, 'The containers could not be moved.');
      setProblem({ title: err.title || 'Could not move them', detail: err.explanation ?? err.message });
    } finally {
      setBusy(false);
    }
  }

  const searching = search.trim().length >= 2;
  const list = searching ? rows : sameSailing;

  return (
    <Modal isOpen onClose={onCancel} size="xl" closeOnBackdrop={false}
      title="Transfer containers"
      subtitle={`Moving ${count} container${count === 1 ? '' : 's'} off ${sourceOrderNo}. Only OPEN ${sourceOrderTypeCode} orders can take them.`}
      footer={
        <>
          <span className="gecko-modal-footer-note gecko-flex-1">
            {blocked ?? (picked ? `${count} → ${picked.orderNo}` : 'Pick the order to move them to.')}
          </span>
          <button className="gecko-btn gecko-btn-outline gecko-btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="gecko-btn gecko-btn-primary gecko-btn-sm"
            disabled={!picked || !!blocked || busy} onClick={transfer}>
            <Icon name="transferH" size={13} /> {busy ? 'Moving…' : 'Transfer'}
          </button>
        </>
      }>
      <div className="gecko-stack">
        {problem && (
          <div role="alert" className="gecko-alert gecko-alert-error">
            <Icon name="alertCircle" size={18} />
            <div><strong>{problem.title}</strong><div>{problem.detail}</div></div>
          </div>
        )}
        {blocked && (
          <div role="alert" className="gecko-alert gecko-alert-warning">
            <Icon name="alertCircle" size={16} /><span>{blocked}</span>
          </div>
        )}

        <div className="gecko-form-group">
          <label className="gecko-form-label" htmlFor="transferSearch">Find the order</label>
          <input id="transferSearch" className="gecko-input gecko-text-mono" autoFocus value={search}
            placeholder="Order no, booking / B/L no, or customer ref…"
            onChange={e => setSearch(e.target.value.toUpperCase())} />
        </div>

        {(searching || sourceVesselCallId) && (
          <div className="gecko-field-label">
            {searching ? `${rows.length} match${rows.length === 1 ? '' : 'es'}` : 'On the same sailing'}
          </div>
        )}

        <div className="gecko-transfer-list">
          {looking && <div className="gecko-transfer-empty">Searching…</div>}
          {!looking && list.length === 0 && (
            <div className="gecko-transfer-empty">
              {searching
                ? `No OPEN ${sourceOrderTypeCode} order matches that.`
                : 'Type at least two characters to search.'}
            </div>
          )}
          {!looking && list.map(t => (
            <button key={t.bookingId} type="button"
              className={`gecko-transfer-row${picked?.bookingId === t.bookingId ? ' gecko-transfer-row-picked' : ''}`}
              onClick={() => setPicked(t)}>
              <span className="gecko-transfer-row-main">
                <span className="gecko-mono-strong">{t.orderNo}</span>
                <span className="gecko-cell-meta">
                  {t.carrierRef ? `${t.carrierRef} · ` : ''}{t.customerCode ?? 'no customer'}
                  {t.voyage ? ` · ${t.voyage}` : ''}
                </span>
              </span>
              <span className="gecko-cell-meta gecko-mono" title="Boxes on it / boxes it asked for">
                {t.qtyAssigned}/{t.qtyRequired}
              </span>
            </button>
          ))}
        </div>

        <div className="gecko-alert gecko-alert-info gecko-clone-note">
          <Icon name="alertCircle" size={14} />
          <div>
            <div>
              <strong>Moves with the box:</strong> the moves already done stay done, any unspent
              coupon, and its statement lines including what has been paid.
            </div>
            <div>
              <strong>Stays behind:</strong> the gate records (EIRs) keep the old order number. On
              the target the box fills a line of its type, and a line is added if there is none.
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
