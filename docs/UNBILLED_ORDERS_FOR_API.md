# Unbilled orders — the billing clerk's worklist

Read from `TMS/Billing/UnBilledOrders.cs` (1,145 lines) on 2026-10-05. The UI is
built and waiting; these are the two endpoints it needs.

---

## What exists is a different question

`GET /api/revenue/charges/unbilled` returns **totals by payer**:
`{ asAt, branchId, lines, amount, tax, total, payers[] }`, each payer carrying
`lines, boxes, amount, tax, total, oldest, newest`.

That answers *"how much is outstanding, and who owes it"*. It is a good report
and nothing here replaces it.

The clerk's question is different: *"which ORDERS have been worked and not
invoiced, what would each put on an invoice, and let me tick the ones going on
this one."* There are no order rows in that response at all, so the screen
cannot be built on it.

---

## 1. `GET /api/revenue/charges/unbilled/orders`

One row per order waiting to be invoiced — the upper grid.

**Query**, every one optional except `branchId`:

```
branchId
agentCode, forwarderCode, customerCode      the three parties the clerk filters by
bookingTypeCode, orderTypeCode              order type list is filtered by booking type
carrierRef                                  the Booking / B-L no.
movementCode, paymentTermCode, chargeCode   narrow by what is owed, not just by whom
progress = ALL | COMPLETED | HALF_COMPLETED | DELIVERED
vesselCode, voyageNo
from, to
page, pageSize
```

**One rule that is not obvious**, and the UI already follows it: naming a vessel
or voyage **replaces** the date range rather than narrowing it — the sailing IS
the period (`btnSearch_Click`, line 275, passes nulls for both dates when either
vessel or voyage is set). Please do the same server-side so the two agree.

`progress` is Vector's "Filter By" (`BindFilterBy`, line 105): ALL, COMPLETED,
50% COMPLETED, DELIVERED. **Please define what each means in Gecko terms** —
presumably over the order's movement steps (all done / at least half done / the
delivery step done). We guessed the names; the meaning is yours.

**Response** `{ totalCount, items: [...] }`:

```jsonc
{
  "bookingId": "…", "orderNo": "BK-KTC-2610-00021",
  "carrierRef": "RS2026-000739",      // [Booking-B/L No.]
  "subBlNo": "HK9LST00",              // [Sub-B/L No]
  "bookingDate": "2026-09-02",
  "bookingTypeCode": "EXPORT", "orderTypeCode": "EXP CY/CY",
  "agentCode": "HMM",
  "customerCode": "20250915", "customerName": "…",
  "vesselCode": "…", "vesselName": "…", "voyageNo": "001",
  "terminalCode": "…",                // [Wharf]
  "paymentTermCode": "CREDIT", "billTo": "CUSTOMER",
  "lines": 7, "amount": 12450.00, "tax": 871.50, "total": 13321.50,
  "currencyCode": "THB"
}
```

`lines / amount / tax / total` are **not on the desktop grid** and are the one
thing we would add: the clerk ticks orders to put on an invoice, and ticking
blind — with no idea whether this order is ฿400 or ฿40,000 — is how the wrong
orders end up on an invoice. The screen shows a running total of the ticked
rows, which needs them.

---

## 2. `GET /api/revenue/charges/unbilled/charges?orderNo=…`

The chosen order's charge lines — the lower grid. **Takes the same filters** as
above plus `orderNo`, because the desktop re-applies them when loading charges
(`LoadCharges`, line 393): a clerk filtering by `chargeCode=STORAGE` wants to see
storage lines in both grids, not everything.

```jsonc
{
  "chargeId": "…", "orderNo": "BK-…",
  "bookingContainerId": "…", "containerNo": "AKLU6018567", "size": "40", "type": "HC",
  "chargeCode": "STORAGE", "chargeName": "Storage",
  "paymentTermCode": "CREDIT", "billTo": "CUSTOMER",
  "movementCode": "FULL_IN",
  "quantity": 3, "unitRate": 150.00,
  "amount": 450.00, "taxAmount": 31.50, "total": 481.50,
  "isAutoLoad": true, "isVas": false,
  "discountType": null, "discountAmount": null,
  "paidQuantity": 0, "paidAmount": 0,
  "status": "UNBILLED"
}
```

**Vector hides a line the clerk cannot invoice**: inactive, or `Price <= 0`, or
`Qty <= 0` (line 427). The UI filters the same way, but the server doing it
saves sending rows that are never shown.

---

## 3. Then: raising the invoice

The screen has the desktop's four actions, **disabled for now** because nothing
backs them:

| Vector menu | what it does |
|---|---|
| New Cash Invoice | the ticked orders become a new cash invoice |
| Existing Cash Invoice | …are added to one already open |
| New Credit Invoice | the same, on credit |
| Existing Credit Invoice | … |

`GenerateCashInvoice` / `GenerateCreditInvoice` (lines 468 and 494) hand the
selected orders to a Customer Cash Bill / Credit Bill screen, which is a page we
have not built either.

**There is no invoice anywhere in the API today** — only `/api/revenue/charges`,
`/charges/statement` and `/charges/unbilled`. `/billing/invoices` and
`/billing/credit-notes` in the UI are still fixture arrays and are blocked from
the pilot for that reason.

So this is the larger question behind the screen: **is there an invoice model
coming, and what does it look like?** The two reads above are useful on their own
— the clerk can at least see the worklist — but the four buttons stay dark until
there is something to post to. Tell us the shape and we will build the bill
screens to it.

---

## Permissions

`revenue.charge.view` for both reads. Invoicing, when it exists, presumably wants
something stronger than that.
