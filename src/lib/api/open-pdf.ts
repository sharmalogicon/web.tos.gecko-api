/**
 * PRINTING A DOCUMENT THE API RENDERS.
 *
 * Every PDF Gecko prints — the EIR, the truck-in form, the coupon, the tax
 * invoice — sits behind an authorised endpoint, and the access token lives in a
 * JavaScript variable rather than a cookie (ADR-006). So a plain `<a href>` or
 * `window.open` on one of those URLs sends no Authorization header and the API
 * answers 401, correctly. The bytes have to be fetched with the token first.
 *
 * And a clerk at a barrier PRINTS these, they do not file them: the blob opens
 * in a tab where Ctrl-P is one keystroke away. Where the browser blocks the
 * pop-up it is saved instead, so the document is never simply lost.
 */
import { apiDownload, saveBlob } from './client';

/**
 * Fetch an authorised PDF and put it in front of the clerk.
 *
 * Throws whatever the API threw — an ApiError with its status — so the caller
 * can word a 403 or a 404 in terms of the document it was asking for.
 */
export async function openPdf(url: string, fallbackName: string): Promise<void> {
  const { blob, filename } = await apiDownload(url);
  const name = filename ?? fallbackName;
  const href = URL.createObjectURL(blob);
  const tab = window.open(href, '_blank', 'noopener');
  if (tab) {
    // Chrome needs the object URL alive while the tab reads it; a minute is far
    // longer than that takes and short enough not to leak a session's worth.
    setTimeout(() => URL.revokeObjectURL(href), 60_000);
    return;
  }
  // Pop-up blocked: saving it is the honest fallback, and the clerk still has
  // the document rather than a button that did nothing.
  URL.revokeObjectURL(href);
  saveBlob(blob, name);
}

/**
 * The note that has to sit under the EIR button.
 *
 * The EIR prints VALUES ONLY, onto the depot's pre-printed stationery — there
 * are no labels, no rules and no logo on it. At "Fit to page" every value lands
 * a few millimetres off its box and the whole form is wrong, which is not
 * obvious until a driver is holding it.
 */
export const EIR_PRINT_NOTE =
  'Load the pre-printed EIR form (Letter) and print at 100 % / Actual size — not “Fit to page”, '
  + 'or the values miss the boxes.';
