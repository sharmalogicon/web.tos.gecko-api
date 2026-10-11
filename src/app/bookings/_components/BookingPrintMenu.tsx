"use client";
import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { useApi } from '@/lib/api/use-api';
import { ApiError } from '@/lib/api/problem';
import { openPdf } from '@/lib/api/open-pdf';

/**
 * THE BOOKING'S FORMS — Vector's Print menu, bound.
 *
 *   GET /api/tos/bookings/forms                     the 13 forms, in menu order
 *   GET /api/tos/bookings/{id}/forms/{key}.pdf      one of them, for this booking
 *
 * The list is the API's, not a copy of it here: the desktop's menu order and
 * wording live on the server, and a form added there appears here with no
 * release. The names arrive as "CY/CY › Delivery Order", so the text before the
 * › is the group a clerk reads down.
 *
 * There is no parameter drawer: the booking IS the parameter.
 *
 * Authorised endpoints, so the bytes are fetched with the token and opened for
 * printing — a plain link answers 401.
 */

interface BookingForm { key: string; menu: string }

export function BookingPrintMenu({ bookingId, cancelled }: {
  bookingId: string | null;
  /** The API answers 409 for a cancelled booking; the button says so first. */
  cancelled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [printing, setPrinting] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Only asked for once the menu is opened: thirteen names are not worth a
  // request on every booking a clerk looks at.
  const { data: forms } = useApi<BookingForm[]>(open ? '/api/tos/bookings/forms' : null);

  useEffect(() => {
    const away = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, []);

  /** "CY/CY › Delivery Order" → the group, and the name under it. */
  const groups = new Map<string, { key: string; label: string }[]>();
  for (const f of forms ?? []) {
    const [head, ...rest] = f.menu.split('›');
    const group = rest.length > 0 ? head.trim() : '';
    const label = (rest.length > 0 ? rest.join('›') : head).trim();
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push({ key: f.key, label });
  }

  const print = async (key: string, label: string) => {
    if (!bookingId) return;
    setPrinting(key);
    try {
      await openPdf(`/api/tos/bookings/${bookingId}/forms/${key}.pdf`, `${key}.pdf`);
      setOpen(false);
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      toast({
        variant: 'danger',
        title: `${label} not printed`,
        message: err?.status === 409
          ? 'This booking is cancelled, so its forms cannot be printed.'
          : err?.explanation ?? err?.title ?? 'Could not reach the Gecko API.',
      });
    } finally {
      setPrinting(null);
    }
  };

  return (
    <div ref={wrap} className="gecko-sendto">
      <button className="gecko-btn gecko-btn-ghost gecko-btn-sm"
        disabled={!bookingId || cancelled}
        title={cancelled ? 'A cancelled booking has no forms to print.'
          : !bookingId ? 'Save the booking first.' : 'Print one of the booking forms'}
        onClick={() => setOpen(o => !o)}>
        <Icon name="print" size={13} /> Print <Icon name="chevronDown" size={11} />
      </button>

      {open && (
        <>
          <div className="gecko-menu-scrim" onClick={() => setOpen(false)} />
          <div className="gecko-sendto-menu" role="menu">
            {!forms && <div className="gecko-sendto-label">Reading the forms…</div>}
            {forms && forms.length === 0 && <div className="gecko-sendto-label">No forms.</div>}
            {[...groups.entries()].map(([group, items]) => (
              <React.Fragment key={group || 'ungrouped'}>
                {group && <div className="gecko-sendto-label">{group}</div>}
                {items.map(f => (
                  <button key={f.key} className="gecko-sendto-item" role="menuitem"
                    disabled={printing !== null}
                    onClick={() => void print(f.key, f.label)}>
                    <Icon name="print" size={13} />
                    <span className="gecko-sendto-item-label">{f.label}</span>
                    {printing === f.key && <span className="gecko-sendto-item-count">preparing…</span>}
                  </button>
                ))}
              </React.Fragment>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
