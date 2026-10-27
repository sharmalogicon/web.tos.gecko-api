# Back-dating a gate transaction — 2026-10-27

A clerk keying last night's paper this morning needs to say when the truck was
actually at the barrier. The owner asked for a date & time box on Gate In,
defaulting to now, windable back **24 hours and no further**.

## Is it possible? Yes — the field already exists

```ts
// src/lib/api/tos.ts
export interface GateTransactionRequest {
  ...
  transactionAt?: string | null;   // <- already on the contract
}
// and TripRow.move IS a GateTransactionRequest, so every row of the trip
// Save carries it too. TripTruck additionally has arrivedAt.
```

Nothing had to be added. **web.tos simply never sent it**, so the server
stamped its own clock on every move. It does now.

---

## 1. Done on the web side (2026-10-27)

- `TruckDetails.transactionAt` — a `datetime-local` value, on the TRUCK, not
  on a row: one truck is at the gate once, and every box it carries was there
  at the same moment.
- Defaults to the clerk's own clock. `localInputValue()` in `src/lib/format.ts`
  builds it from local parts — **not** `toISOString().slice(0,16)`, which is
  UTC and would open the box 7 hours behind the wall in Bangkok. That exact
  mistake printed the wrong gate-in day across this app until 2026-10-18.
- `MAX_BACK_DATE_HOURS = 24`, enforced by `backDateIssue()` in
  `visit-moves.ts`: blank, unreadable, in the future (with one minute of grace
  for the ticking clock), or more than 24 hours back, each with its own
  sentence. It holds the Save through `blockedReason`.
- Sent as `move.transactionAt` on every row and `truck.arrivedAt` on the visit,
  computed ONCE per Save so twelve boxes cannot land seconds apart.
- Frozen once the visit is open — the server owns the arrival time by then.

Verified:

```
offset from UTC (min): 330
box shows            : 2026-10-27T10:54      <- the wall clock
UTC slice would be   : 2026-10-27T05:24      <- the wrong one
sent as              : 2026-10-27T05:24:00.000Z
round-trips to       : 27-10-2026 10:54

now              -> ACCEPTED      23 h 59 m ago -> ACCEPTED
1 min ahead      -> ACCEPTED      24 h  1 m ago -> too far back
5 min ahead      -> future        3 days ago    -> too far back
```

---

## 2. The prompt

> **Back-dated gate transactions: confirm and enforce (web.tos ask, 2026-10-27)**
>
> Gate In now sends `transactionAt` on every row's `move` (and `arrivedAt` on
> `truck`) as an ISO instant, defaulting to the clerk's local clock and
> windable back up to 24 hours. The field was already on
> `GateTransactionRequest`; we had simply never populated it.
>
> **Four things to confirm, please:**
>
> 1. **Is `transactionAt` honoured?** Does the gate store it as the
>    transaction/arrival time, or is it accepted and then ignored in favour of
>    the server clock? If it is ignored, say so — we would rather remove the
>    box than show a clerk a control that does nothing.
> 2. **What does it drive?** Specifically: the EIR's printed date, `gateInAt`
>    on the container visit, the FREE-TIME and storage clock, and the
>    cut-off / late check. A back-dated gate-in that does not move the storage
>    clock is worse than none, because the invoice and the EIR then disagree.
> 3. **Is there a server-side limit?** Please enforce the same **24 hours**,
>    and refuse the future outright, with a 400 on `transactionAt`. A cap only
>    the browser enforces is a convention, not a rule — anyone with the
>    endpoint can post last year. If you would rather make it a tenant
>    parameter than a constant, better still: tell us the key and we will read
>    it instead of hardcoding 24.
> 4. **Which permission?** Back-dating is an audit-sensitive act. Should it
>    need a permission of its own (say `tos.gate.backdate`) rather than riding
>    on `tos.gate.create`? If you add one, web.tos will disable the box and
>    pin it to now for clerks who lack it.
>
> **One request:** whatever the server decides it used, please return it.
> `GateTransaction` already carries `transactionAt` and `recordedAt` — so long
> as a read-back shows both, a supervisor can see that a move was keyed at
> 08:10 for a truck that arrived at 23:40, which is exactly the audit question
> back-dating raises.
>
> Don't change the UI; web.tos already sends it.

---

## 3. Not done

`gate/desk` and `gate/eir-in-sept` build a `GateTransactionRequest` too and
still send no `transactionAt`, so they remain "now". The owner asked for the
Gate In page; those two follow in one line each if wanted.

---

Do not change anything in `D:\SHARMA\PROJECT\gecko\platform`; report API
problems back to the owner.
