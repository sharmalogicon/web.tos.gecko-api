# The Booking Register shows a customer CODE — 2026-10-08

One field on one response. Third time today, same shape as `carrierRef` /
`subBlNo` on `GateTransactionSummaryResponse`.

## The change

> **Prompt for the API:** add **`customerName: string | null`** to
> `BookingSummaryResponse` (`GET /api/tos/bookings`), from the party named by
> `customerCode`.

`BookingSummaryResponse` today:

```
bookingId, branchCode, branchId, callRef, carrierRef, createdAt, customerCode,
directionCode, lineCode, orderNo, orderTypeCode, progress, qtyAssigned,
qtyCompleted, qtyRequired, source, status, validTo, vesselCallId, voyage
```

## Why

The register's CUSTOMER column reads `20241267`. Nobody recognises a customer
by their party code — the clerk scanning 2,619 bookings for *CP INTERTRADE* has
no way to find them without opening rows one at a time.

With the field the column reads:

```
CP INTERTRADE CO.,LTD.
20241267
```

name first, code beneath in small mono — the same treatment the register now
gives the carrier ref and the order number in the first column.

## Why the screen cannot do it itself

`GET /api/master/parties` takes `search`, `role`, `page`, `pageSize`,
`includeInactive` — there is **no lookup by a set of codes**. Resolving the
names for one page of 50 bookings would mean up to 50 calls to
`/api/master/parties/{code}`, on every page change. Loading the whole party
catalogue to build a map is worse: it is unbounded and goes stale.

So either `BookingSummaryResponse` carries the name, or
`GET /api/master/parties?codes=A,B,C` exists. **The first is much simpler** —
the booking query already joins the party for `customerCode`.

## What the screen does meanwhile

Nothing breaks. The type takes `customerName` as optional and nullable, and the
column falls back to the bare code — exactly what it shows now — then switches
to name-over-code the moment the field appears. Nothing to release in step.

## While you are in there

`agentName` would help the same way — the register has an agent on most rows and
shows its code too. Not asking for it now; the customer is the one people search
by.

---

Do not change anything in `D:\SHARMA\PROJECT\gecko\platform`; report API
problems back to the owner.
