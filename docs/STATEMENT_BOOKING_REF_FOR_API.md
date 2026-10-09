# The Booking Statement header needs the booking / B/L number — 2026-10-08

One field pair on one response. Same change you just made to
`GateTransactionSummaryResponse`, for the same reason.

## The change

> **Prompt for the API:** add **`carrierRef: string | null`** and
> **`subBlNo: string | null`** to `BookingStatementResponse`
> (`GET /api/revenue/charges/statement?orderNo=…`), from the booking the
> statement is for.

`BookingStatementResponse` today:

```
bookingId, bookingStatus, boxes, branchId, customerCode, customerName,
orderNo, orderTypeCode, receipts, totals
```

## Why

The statement header is the biggest text on the screen and it shows
`BK-KTC-2610-00039` — Gecko's filing number. Nobody rings up quoting it. The
agent, the line and the driver all quote the carrier's booking number or the
B/L, and the clerk has to translate in their head on every call.

With the two fields the header reads:

```
CHENG-BK-88421  (BK-KTC-2610-00039)
```

— the number the customer said, and Gecko's own in brackets behind it, small.

The register above it (`/api/revenue/charges/unbilled/orders`) **already**
answers `carrierRef` and `subBlNo` and has read that way since this morning, so
today the list and the detail of the same booking disagree about what to call
it. That is the part worth fixing.

## What the screen does meanwhile

Nothing breaks. The type takes both as optional and nullable, and the header
falls back to `orderNo` alone — exactly what it shows now — then flips to the
form above the moment the fields appear. No UI change will be needed on your
side of the release.

## Where else the same pair would help

`StatementReceiptResponse` and the charge rows carry `orderNo` only. Not asking
for those now; the header is the one a clerk reads on every call.

---

Do not change anything in `D:\SHARMA\PROJECT\gecko\platform`; report API
problems back to the owner.
