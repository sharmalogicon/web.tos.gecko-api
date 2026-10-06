"use client";
import React from 'react';
import type { VasOption } from '@/lib/api/gate-trips';
import { isVasSellable } from '@/lib/api/gate-trips';

/**
 * The extras that can be sold on this box, priced.
 *
 * The menu and its prices come from the same quote that priced the row
 * (§23.2a), so ticking one re-quotes and the item's line moves into what is
 * due. It is offered only where the movement offers it — an empty drop-off or
 * a pick-up — so a full drop-off simply has none and the panel does not appear.
 *
 * An item no tariff prices is shown GREYED with "no price" rather than hidden.
 * A clerk looking for washing needs to know it exists and why it cannot be
 * sold; a missing line only looks like a bug. Ticking one would block the
 * receipt, so it cannot be ticked.
 */
export function VasPanel({ menu, ticked, disabled, currency, onToggle }: {
  menu: VasOption[];
  ticked: string[];
  disabled: boolean;
  currency: string;
  onToggle: (chargeCode: string) => void;
}) {
  if (menu.length === 0) return null;

  return (
    <div className="gecko-vas-panel">
      {menu.map(v => {
        const sellable = isVasSellable(v);
        const on = ticked.includes(v.chargeCode);
        return (
          <label key={v.chargeCode}
            className={`gecko-vas-item${sellable ? '' : ' gecko-vas-item-unpriced'}`}>
            <input type="checkbox" className="gecko-checkbox"
              checked={on} disabled={disabled || !sellable}
              onChange={() => onToggle(v.chargeCode)} />
            <span className="gecko-flex-1 gecko-min-w-0">
              <span className="gecko-text-mono gecko-mono-strong">{v.chargeCode}</span>
              {v.chargeName && <span className="gecko-vas-name">{v.chargeName}</span>}
            </span>
            <span className="gecko-text-mono gecko-vas-price">
              {sellable
                ? `${v.currencyCode || currency} ${v.total.toFixed(2)}`
                : <span className="gecko-cell-meta">no price</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}
