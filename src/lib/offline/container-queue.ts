/**
 * UNSENT CONTAINER ROWS, kept in the browser (GATE_API_FOR_UI.md §16b step 4).
 *
 * A clerk typing eighty boxes at a depot counter will, sooner or later, lose
 * the wifi or have the tab closed on them. Everything already sent is on the
 * server; this holds the rows that are NOT yet acknowledged, so reopening the
 * booking offers them back instead of asking for eighty container numbers again.
 *
 * Safe to resend by construction: each row carries the `clientLineId` it was
 * born with, and the server answers REPLAYED for anything it has already saved.
 * So this store never needs to be exactly right — only never to lose work.
 *
 * Every call is wrapped: IndexedDB throws in a private window, with site data
 * blocked, and during some automated captures. Losing the draft cache is a
 * degraded experience; a page that will not render is a broken one.
 */
import type { ContainerRowInput } from '@/lib/api/booking-entry';

const DB_NAME = 'gecko-booking-entry';
const DB_VERSION = 1;
const STORE = 'rows';
const BY_BOOKING = 'byBooking';

export interface QueuedRow {
  /** Primary key: the row's identity for its whole life. */
  clientLineId: string;
  bookingId: string;
  row: ContainerRowInput;
  savedAt: number;
}

function open(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'clientLineId' });
          store.createIndex(BY_BOOKING, 'bookingId', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}


/** Remember rows that have not been acknowledged yet. Upsert by clientLineId. */
export async function rememberRows(bookingId: string, rows: readonly ContainerRowInput[]): Promise<void> {
  if (rows.length === 0) return;
  const db = await open();
  if (!db) return;
  try {
    const t = db.transaction(STORE, 'readwrite');
    const store = t.objectStore(STORE);
    const now = Date.now();
    for (const row of rows) {
      store.put({ clientLineId: row.clientLineId, bookingId, row, savedAt: now } satisfies QueuedRow);
    }
    await new Promise<void>(resolve => {
      t.oncomplete = () => resolve();
      t.onerror = () => resolve();
      t.onabort = () => resolve();
    });
  } catch {
    /* a lost draft cache is not worth breaking the page for */
  } finally {
    try { db.close(); } catch { /* already closing */ }
  }
}

/** Rows still waiting for this booking, oldest first. */
export async function pendingRows(bookingId: string): Promise<QueuedRow[]> {
  const db = await open();
  if (!db) return [];
  try {
    const t = db.transaction(STORE, 'readonly');
    const index = t.objectStore(STORE).index(BY_BOOKING);
    const got = await new Promise<QueuedRow[]>(resolve => {
      const req = index.getAll(bookingId);
      req.onsuccess = () => resolve((req.result as QueuedRow[]) ?? []);
      req.onerror = () => resolve([]);
    });
    return got.sort((a, b) => a.savedAt - b.savedAt);
  } catch {
    return [];
  } finally {
    try { db.close(); } catch { /* already closing */ }
  }
}

/** Forget rows the server has acknowledged (CREATED or REPLAYED). */
export async function forgetRows(clientLineIds: readonly string[]): Promise<void> {
  if (clientLineIds.length === 0) return;
  const db = await open();
  if (!db) return;
  try {
    const t = db.transaction(STORE, 'readwrite');
    const store = t.objectStore(STORE);
    for (const id of clientLineIds) store.delete(id);
    await new Promise<void>(resolve => {
      t.oncomplete = () => resolve();
      t.onerror = () => resolve();
      t.onabort = () => resolve();
    });
  } catch {
    /* ignore */
  } finally {
    try { db.close(); } catch { /* already closing */ }
  }
}

/** Drop everything held for one booking (it was closed, cancelled or finished). */
export async function forgetBooking(bookingId: string): Promise<void> {
  const rows = await pendingRows(bookingId);
  await forgetRows(rows.map(r => r.clientLineId));
}
