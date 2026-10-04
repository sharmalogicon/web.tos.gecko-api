"use client";
/**
 * The container-entry grid's engine (GATE_API_FOR_UI.md §16b).
 *
 * The clerk types; this saves. There is no Save button for the grid, because a
 * Save button is the thing that loses eighty rows when the counter's wifi drops
 * — the work sits in the page until someone presses it, and nobody presses it
 * until they are finished.
 *
 * Instead: a row that is complete is queued, the queue goes to the server on a
 * short timer or when it is big enough, and anything not yet acknowledged is
 * also written to IndexedDB. Every one of those is safe to repeat, because the
 * row carries a clientLineId and the server answers REPLAYED for one it already
 * has. So the worst case of any failure is that a row is sent twice.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './problem';
import {
  newClientLineId, postContainerBatch,
  type BatchItem, type ContainerRowInput, type LineTally, type SavedLine,
} from './booking-entry';
import { forgetRows, pendingRows, rememberRows } from '@/lib/offline/container-queue';

/** Long enough that a fast typist is not firing a call per box; short enough that a dropped tab costs seconds. */
const FLUSH_AFTER_MS = 4000;
/** Send early once this many rows are waiting, so a paste of 50 does not sit on the timer. */
const FLUSH_AT_ROWS = 15;

export type RowStatus = 'draft' | 'queued' | 'sending' | 'saved' | 'error';

export interface GridRow extends ContainerRowInput {
  status: RowStatus;
  errors: Record<string, string[]> | null;
  bookingContainerId: string | null;
  rowVersion: string | null;
  stepsDone: number;
}

export function blankRow(over: Partial<GridRow> = {}): GridRow {
  return {
    clientLineId: newClientLineId(),
    containerNo: '',
    lineNo: 0,
    status: 'draft',
    errors: null,
    bookingContainerId: null,
    rowVersion: null,
    stepsDone: 0,
    ...over,
  };
}

/** Enough to be worth sending: a box number and the line it belongs to. */
export const isComplete = (r: GridRow): boolean =>
  r.containerNo.trim().length > 0 && r.lineNo > 0;

/** Only the fields the API takes — the status bookkeeping stays in the browser. */
function toInput(r: GridRow): ContainerRowInput {
  const {
    status: _s, errors: _e, bookingContainerId: _b, rowVersion: _v, stepsDone: _d,
    ...input
  } = r;
  void _s; void _e; void _b; void _v; void _d;
  return { ...input, containerNo: input.containerNo.trim().toUpperCase() };
}

function applyItem(row: GridRow, item: BatchItem): GridRow {
  if (item.outcome === 'REJECTED') {
    return { ...row, status: 'error', errors: item.errors ?? null };
  }
  const line: SavedLine | null = item.line;
  return {
    ...row,
    status: 'saved',
    errors: null,
    bookingContainerId: line?.bookingContainerId ?? row.bookingContainerId,
    rowVersion: line?.rowVersion ?? row.rowVersion,
    stepsDone: line?.stepsDone ?? row.stepsDone,
  };
}

export interface ContainerEntry {
  rows: GridRow[];
  lines: LineTally[];
  /** Rows typed but not yet acknowledged by the server. */
  pending: number;
  sending: boolean;
  /** A whole-call failure (409 booking not OPEN, no lines, network). */
  failure: ApiError | null;
  /** Rows recovered from a previous session, offered rather than applied. */
  recovered: GridRow[] | null;
  acceptRecovered: () => void;
  discardRecovered: () => void;
  addRow: (over?: Partial<GridRow>) => void;
  patchRow: (clientLineId: string, patch: Partial<GridRow>) => void;
  removeRow: (clientLineId: string) => void;
  /** Send everything queued now (on blur, on leaving, on a button). */
  flush: () => Promise<void>;
  setRows: React.Dispatch<React.SetStateAction<GridRow[]>>;
}

export function useContainerEntry(bookingId: string, opts?: { onSaved?: () => void }): ContainerEntry {
  const [rows, setRows] = useState<GridRow[]>([]);
  const [lines, setLines] = useState<LineTally[]>([]);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const [recovered, setRecovered] = useState<GridRow[] | null>(null);

  // The queue's source of truth. Handlers below write it BEFORE setRows so a
  // decision taken in the same tick (flush now, or wait for the timer) sees the
  // rows that actually exist; the effect keeps it honest if anything else
  // replaces the list.
  const rowsRef = useRef(rows);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaved = useRef(opts?.onSaved);
  // Written in an effect, not during render: a ref assigned while rendering is
  // not guaranteed to have landed when a concurrent render is thrown away.
  useEffect(() => { onSaved.current = opts?.onSaved; }, [opts?.onSaved]);

  /** Send every queued row. Safe to call at any time: repeats come back REPLAYED. */
  const flush = useCallback(async () => {
    if (inFlight.current || !bookingId) return;
    const queued = rowsRef.current.filter(r => r.status === 'queued' && isComplete(r));
    if (queued.length === 0) return;

    inFlight.current = true;
    setSending(true);
    setFailure(null);
    const ids = new Set(queued.map(r => r.clientLineId));
    setRows(rs => rs.map(r => (ids.has(r.clientLineId) ? { ...r, status: 'sending' } : r)));

    try {
      const results = await postContainerBatch(bookingId, queued.map(toInput));
      const byId = new Map<string, BatchItem>();
      for (const res of results) for (const item of res.items) byId.set(item.clientLineId, item);

      setRows(rs => rs.map(r => {
        const item = byId.get(r.clientLineId);
        return item ? applyItem(r, item) : r;
      }));

      const last = results[results.length - 1];
      if (last) setLines(last.lines);

      // Only drop what the server acknowledged; a rejected row stays held.
      const done = [...byId.values()].filter(i => i.outcome !== 'REJECTED').map(i => i.clientLineId);
      void forgetRows(done);
      if (done.length > 0) onSaved.current?.();
    } catch (e) {
      // The call failed as a whole, so nothing is known about these rows.
      // Put them back in the queue — resending is always safe.
      setRows(rs => rs.map(r => (ids.has(r.clientLineId) ? { ...r, status: 'queued' } : r)));
      setFailure(e instanceof ApiError ? e : new ApiError(0, 'Could not reach the Gecko API — the rows are kept and will be sent again.'));
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }, [bookingId]);

  /** Queue a complete row and start (or restart) the timer. */
  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, FLUSH_AFTER_MS);
  }, [flush]);

  /** Commit a new list: ref first, then state, then the durable copy. */
  const commit = useCallback((next: GridRow[]) => {
    rowsRef.current = next;
    setRows(next);
    void rememberRows(bookingId, next.filter(r => r.status === 'queued').map(toInput));
  }, [bookingId]);

  const patchRow = useCallback((clientLineId: string, patch: Partial<GridRow>) => {
    const next = rowsRef.current.map(r => {
      if (r.clientLineId !== clientLineId) return r;
      const merged = { ...r, ...patch };
      // Editing a saved row is a different call (PUT); the grid handles that
      // separately, so saved rows are never re-queued here.
      if (merged.status === 'saved') return merged;
      const status: RowStatus = isComplete(merged) ? 'queued' : 'draft';
      return { ...merged, status, errors: patch.errors ?? merged.errors };
    });
    commit(next);
    // Counted from the list just committed, not from a state updater — an
    // updater runs during the next render, so a count read after setRows is
    // always the PREVIOUS one, and this early flush would never fire.
    const queued = next.filter(r => r.status === 'queued').length;
    if (queued >= FLUSH_AT_ROWS) void flush(); else schedule();
  }, [commit, flush, schedule]);

  const addRow = useCallback((over?: Partial<GridRow>) => {
    commit([...rowsRef.current, blankRow(over)]);
  }, [commit]);

  const removeRow = useCallback((clientLineId: string) => {
    commit(rowsRef.current.filter(r => r.clientLineId !== clientLineId));
    void forgetRows([clientLineId]);
  }, [commit]);

  // Offer back whatever the last session did not get acknowledged.
  useEffect(() => {
    let alive = true;
    if (!bookingId) return;
    pendingRows(bookingId).then(held => {
      if (!alive || held.length === 0) return;
      setRecovered(held.map(h => blankRow({ ...h.row, status: 'queued' })));
    });
    return () => { alive = false; };
  }, [bookingId]);

  const acceptRecovered = useCallback(() => {
    const have = new Set(rowsRef.current.map(r => r.clientLineId));
    commit([...rowsRef.current, ...(recovered ?? []).filter(r => !have.has(r.clientLineId))]);
    setRecovered(null);
    schedule();
  }, [commit, recovered, schedule]);

  const discardRecovered = useCallback(() => {
    void forgetRows((recovered ?? []).map(r => r.clientLineId));
    setRecovered(null);
  }, [recovered]);

  // Last chance to save when the tab is closing. Anything that does not make it
  // is already in IndexedDB, so this is an optimisation, not the safety net.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') void flush(); };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [flush]);

  // Anything that goes through setRows directly (flush marking rows sending /
  // saved, or recovery) lands here, so the ref never drifts from the state.
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  const pending = rows.filter(r => r.status === 'queued' || r.status === 'sending').length;

  return {
    rows, lines, pending, sending, failure,
    recovered, acceptRecovered, discardRecovered,
    addRow, patchRow, removeRow, flush, setRows,
  };
}
