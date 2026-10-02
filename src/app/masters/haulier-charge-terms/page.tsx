"use client";
import React, { useState } from 'react';
import { useApi, useApiList } from '@/lib/api/use-api';
import { useSession } from '@/lib/auth/session';
import { apiSend } from '@/lib/api/client';
import { EditableTable } from '../lookups/_components/EditableTable';

/**
 * LIVE against gecko_master — a haulier's own payment term for one charge of
 * one movement of one order type.
 *
 * WHY IT EXISTS. At the cash window a line is CASH or CREDIT. A haulier with a
 * term here overrides that: a matching CASH line moves to "billed later" and
 * goes on the account instead of being taken from the driver. This is how a
 * depot bills a trucking company monthly rather than at the barrier — it is
 * the rule Vector carried, and without it every truck pays cash.
 *
 * It only ever moves money one way. A CREDIT line is never turned into cash.
 */

interface HaulierChargeTerm {
  haulierChargeTermId?: string;
  haulierCode: string;
  haulierName?: string | null;
  orderTypeCode: string;
  movementCode: string;
  chargeCode: string;
  paymentTermCode: string;
  rowVersion?: string | null;
}

interface PartyRow { partyCode: string; nameEn: string }
interface OrderTypeRow { orderTypeCode: string; descriptionEn: string }
interface MovementRow { movementCode: string; descriptionEn: string }
interface ChargeCodeRow { chargeCode: string; descriptionEn: string }

const PATH = '/api/master/haulier-charge-terms';

export default function HaulierChargeTermsPage() {
  const { can } = useSession();
  const [haulier, setHaulier] = useState('');
  const [orderType, setOrderType] = useState('');

  // The gate and the window read these by (haulier, order type), so the screen
  // filters the same way — what you see here is what pricing will find.
  const query = new URLSearchParams();
  if (haulier) query.set('haulierCode', haulier);
  if (orderType) query.set('orderTypeCode', orderType);
  const { data, error, loading, reload } = useApi<HaulierChargeTerm[]>(`${PATH}?${query}`);

  const { data: hauliers } = useApiList<PartyRow>('/api/master/parties?role=HAULIER&pageSize=200');
  const { data: orderTypes } = useApiList<OrderTypeRow>('/api/master/order-types?pageSize=200');
  const { data: movements } = useApiList<MovementRow>('/api/master/movements?pageSize=200');
  const { data: charges } = useApiList<ChargeCodeRow>('/api/master/charge-codes?pageSize=300');

  const opts = <T,>(rows: T[] | null, value: (r: T) => string, label: (r: T) => string) =>
    (rows ?? []).map(r => ({ value: value(r), label: label(r) }));

  const haulierOptions = opts(hauliers, h => h.partyCode, h => `${h.partyCode} — ${h.nameEn}`);
  const orderTypeOptions = opts(orderTypes, o => o.orderTypeCode, o => o.orderTypeCode);
  const movementOptions = opts(movements, m => m.movementCode, m => `${m.movementCode} — ${m.descriptionEn}`);
  const chargeOptions = opts(charges, c => c.chargeCode, c => `${c.chargeCode} — ${c.descriptionEn}`);

  return (
    <div className="gecko-stack gecko-stack-xl" style={{ maxWidth: 'var(--gecko-container-max)', margin: '0 auto' }}>
      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <h1 className="gecko-page-title">Haulier Charge Terms</h1>
          <div className="gecko-page-subtitle gecko-mt-1">
            Which charges a haulier is billed for instead of paying at the window.
          </div>
        </div>
      </div>

      <EditableTable<HaulierChargeTerm>
        columns={[
          { key: 'haulierCode', label: 'Haulier', kind: 'select', options: haulierOptions, required: true, width: 220,
            render: t => t.haulierName ? `${t.haulierCode} — ${t.haulierName}` : t.haulierCode },
          { key: 'orderTypeCode', label: 'Order type', kind: 'select', options: orderTypeOptions, required: true, width: 180 },
          { key: 'movementCode', label: 'Movement', kind: 'select', options: movementOptions, required: true, width: 170 },
          { key: 'chargeCode', label: 'Charge', kind: 'select', options: chargeOptions, required: true, width: 200 },
          { key: 'paymentTermCode', label: 'Term', kind: 'select', required: true, width: 120,
            options: [{ value: 'CREDIT', label: 'CREDIT — billed later' }, { value: 'CASH', label: 'CASH — paid at the window' }],
            hint: 'CREDIT moves the line off the cash total' },
        ]}
        rows={data}
        loading={loading}
        error={error}
        rowKey={t => t.haulierChargeTermId ?? `${t.haulierCode}:${t.orderTypeCode}:${t.movementCode}:${t.chargeCode}`}
        blank={() => ({
          haulierCode: haulier, orderTypeCode: orderType,
          movementCode: '', chargeCode: '', paymentTermCode: 'CREDIT',
        })}
        canManage={can('mdm.commercial.manage')}
        noun="Term"
        searchText={t => `${t.haulierCode} ${t.haulierName ?? ''} ${t.orderTypeCode} ${t.movementCode} ${t.chargeCode}`}
        onSave={async (draft, original) => {
          const body = {
            haulierCode: draft.haulierCode,
            orderTypeCode: draft.orderTypeCode,
            movementCode: draft.movementCode,
            chargeCode: draft.chargeCode,
            paymentTermCode: draft.paymentTermCode,
            rowVersion: draft.rowVersion ?? null,
          };
          if (original?.haulierChargeTermId) {
            await apiSend('PUT', `${PATH}/${original.haulierChargeTermId}`, body);
          } else {
            await apiSend('POST', PATH, body);
          }
          reload();
        }}
        onDelete={async t => {
          await apiSend('DELETE', `${PATH}/${t.haulierChargeTermId}?rowVersion=${encodeURIComponent(t.rowVersion ?? '')}`);
          reload();
        }}
        note="One term per haulier, order type, movement and charge. A duplicate is refused (409). Pricing reads these by haulier and order type, so a term only bites where all four match."
        toolbar={
          <>
            <select className="gecko-input" style={{ width: 240 }} value={haulier} aria-label="Haulier"
              onChange={e => setHaulier(e.target.value)}>
              <option value="">Every haulier</option>
              {haulierOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className="gecko-input" style={{ width: 200 }} value={orderType} aria-label="Order type"
              onChange={e => setOrderType(e.target.value)}>
              <option value="">Every order type</option>
              {orderTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </>
        }
      />
    </div>
  );
}
