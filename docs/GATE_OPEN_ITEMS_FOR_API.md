# Gate In and Gate Out — what is still open

Written 2026-10-05, after testing everything that shipped today against the
running API. It supersedes the open parts of `GATE_IN_VECTOR_PARITY_FOR_API.md`,
`GATE_VISIT_BATCH_SAVE_FOR_API.md` and `GATE_TRIPS_FINDINGS_FOR_API.md`.

**KORAKIT is not a pilot.** They are switching the desktop off, so a gap here is
a clerk standing at a barrier with no way to record what is in front of them.

---

## Already done — please do not rebuild these

Verified live today, all working:

| | |
|---|---|
| `POST /api/tos/gate/blind-orders` | raises BLIND GATE IN, `source: WALK_IN`, no B/L wanted — exactly the desktop's rule |
| `GET /api/tos/gate/bookable-boxes` | one row per box, `direction` / `fullEmpty` / `excludeBookingContainerIds` all behave |
| `GET /api/revenue/window/preview` | prices by attributes, so it works on a box with no booking yet |
| `POST /api/tos/gate/reservations` | draft-scoped, with an expiry |
| `POST /api/tos/gate/trips` | N rows, one visit, blind orders inline, **Idempotency-Key genuinely replays** |
| `GET /api/tos/gate/visits?openOnly=true` | the trucks-in-yard picker |
| the required-field matrix, `pickupDropoffMode`, §10's gate-out refusals | all as documented |

---

## 1. BLOCKING — `/gate/trips` has no `truckVisitId`

**This is the one that stops work.** `TripSaveRequest` takes `truck` but has no
way to name an existing visit, so every call opens a new one.

Proved: same `draftId`, same truck, a second save after fixing a refused row →

```
save 1 → visit TV-…-A    rows[0] GATED, rows[1] NOT_GATED
save 2 → visit TV-…-B    rows[0] NOT_GATED (its step is done), rows[1] GATED
GET /gate/visits?Search=70-2957 → totalCount: 2
```

**One truck arrival, two truck visits.** The yard's move count is wrong from
that moment on, and nobody notices until a month-end number does not add up.

It also means **Gate Out cannot use this endpoint at all** — a truck already
standing in the yard has a visit, and joining it is the normal case. Gate Out
loops the single `POST /gate/transactions` instead, which works but is not
atomic.

**Please do one of:**
- **(a)** add optional `truckVisitId` to `TripSaveRequest`; when present the rows
  join that visit instead of opening one; or
- **(b)** reuse the open visit the server already created for this `draftId` —
  `draftId` is in the request and already identifies the truck being keyed.

**(b)** is probably cleaner and needs nothing new from us.

Related, and cheap: a resent row that is already gated comes back `NOT_GATED`
with *"MTY_OUT (step 2) is still pending and required"*. That is correct and
safe, but it reads as a failure. A `status: "ALREADY_GATED"` would let the
screen show it as settled rather than as a problem to fix.

---

## 2. Atomicity — please just tell us which it is

Agreed point 1 was all-or-nothing. What happens is a **201 with partial commit**:
one row `GATED`, the next `NOT_GATED`, and the good one stays written.

**That may well be the better behaviour** — a truck with three boxes and one
hold should arguably not be stuck at the barrier for the two that are fine. We
are not asking you to change it. We are asking you to **state which it is**, so
the screen can say "2 of 3 recorded" honestly instead of implying everything
either worked or did not.

---

## 3. A refused row still leaves its blind order behind

Defect on either answer to #2. In the run above, `rows[1]` came back
`NOT_GATED` and still carried `"orderNo": "BK-KTC-2610-00033"`. The BLIND GATE
IN was created, the box was never gated, nothing cleans it up. Every refused row
leaves an orphan order on the register.

Roll the blind order back with its row, or create it only once the move is
accepted.

---

## 4. VAS at the gate — nothing lists them

Still open, and it is a visible hole: the desktop shows a tick-list of
value-added charges on every gate-in, and we cannot draw it.

The rule is exact (`LoadGateInVASCharges`, GateIn.cs line 956): offered on a
**DROP-OFF + EMPTY** or a **PICK-UP**, never otherwise, filtered to
`IsLoadAtGateIn`, by order type. That matches the contract's own wording for
`boxes[].vasOffered`, and `/window/bookings` already **takes** `&vas=CODE` — but
no endpoint enumerates them, so there is nothing to tick.

**Ask:** `GET /api/master/order-types/{orderTypeCode}/vas?atGateIn=true`
→ `[{ chargeCode, description, isLoadAtGateIn, sellRate?, currencyCode? }]`

---

## 5. Taking money at the gate — confirm the flow

The desktop collects on the Gate In screen: a Payment Details grid (charge code,
sell rate, VAT, sell amount, payment term, container) and a Payment Summary
(receipt no, amount, VAT, total, **nett**), with a withholding tick — 3% of the
amount before VAT, `nett = total − WHT`, which is contract §8 exactly.

`TripSaveRequest.payment` exists and takes `payer`, `payments[]`,
`expectedTotal`, `withholdingTax`. **Confirm this is the intended path** and
that the receipt comes back on `TripSaveResponse.receipt` — and say what the
`payer` block is for when the booking already names a customer.

Until that is confirmed we are not building a screen that takes cash.

---

## 6. Damage at the gate — confirm, do not build

`/api/master/damage-codes`, `/api/master/damage-locations` and
`POST /api/tos/gate/surveys` all exist, and `SaveSurveyRequest` already carries
`gateTransactionId, containerNo, conditionCode, gradeCode, surveyType,
surveyedAt, surveyorName, remarks, damages[]`.

**Two questions only:**
1. Is a gate damage line a survey posted **after** the EIR (so
   `gateTransactionId` is known), or should the move accept damage inline?
2. What `surveyType` does a gate-in survey use?

Answer those and we build it — this is the one pending gate item that is not
waiting on new API work.

---

## 7. Two small master-data gaps

- **Height.** The desktop pairs Material with Height (`STL` / `8'6"`).
  `ContainerResponse` has `material` and no height, and no gate field carries
  it. The box is on screen and disabled. Add `heightCode`, or tell us to drop it.
- **Agent.** `BookingResponse.agentCode` exists and the desktop makes the agent
  drive the liner list, but `GET /api/master/parties?role=AGENT` returns
  nothing. Which role lists the agents a clerk may pick — or is the agent only
  ever read off the booking?

---

## 8. A gated credit charge never becomes UNBILLED — HALF FIXED

**`d7fca89` fixed the PRICING. The WRITE still does not happen.** Retested on
KORAKIT 2026-10-06 against the published API, with evidence below.

When a haulier has a CREDIT term on a CASH charge and the tariff has no CREDIT
rate for it — KORAKIT's `S-002` on `CUSOMER MTY` — the charge is now priced at
its **CASH rate** and billed later on CREDIT, as Vector does
(`GateIn.cs:1577-1596`). It no longer disappears, and it never blocks the cash
window.

### What we had found

1. `S-002` is genuinely priced: ฿186.92 on `MTY_OUT` for `CUSOMER MTY`.
2. Haulier `20221692` put on a CREDIT term for that charge / movement / order
   type → **201**.
3. `GCKU5764334` gated out on that haulier → **201**, `EIR-KTC-2610-00025`.
4. `GET /api/revenue/charges/unbilled/orders` → **0**.

Across the tenant: 60 charges, every one CASH, `QUOTED` 22 / `CANCELLED` 38. Not
one CREDIT line and not one UNBILLED line existed.

### Retest on KORAKIT, 2026-10-06 — the quote is right, the write is missing

**Half 1 — the quote. Fixed, exactly as described.**

```
GET /api/revenue/window/bookings?orderNo=BK-KTC-2610-00038&haulierCode=20221692
  cash total = 0,  billedLater = 300.00
  box GCKU8753708:
    due      : none
    noPrice  : A-004, A-009, G01, LN, LOLO, S-003, S-116   (S-002 NOT among them)
    LATER    : S-002  term=CREDIT  byHaulierTerm=true  amount=280.37  total=300.00
    tried    : S-002  outcome=HAULIER_CREDIT
               "20221692 has a CREDIT term for S-002 at MTY_OUT: billed later, not paid here."
```

S-002 is out of `due`, out of `noPrice`, in `billedLater` on CREDIT with
`byHaulierTerm` set, and `tried` names the haulier. Every point of the rule
holds.

**Half 2 — the write at gate-out. Still does not happen.**

The same box was then taken through the gate on that haulier's truck:

```
Gate In announces the pick-up   → 201  visit TV-KTC-2610-00022, row PLANNED
Gate Out releases it            → 201  GCKU8753708 GATED, EIR-KTC-2610-00029
GET /api/revenue/charges/unbilled/orders → 0   (lines 0, total 0)
```

And in the charge register afterwards:

```
S-002 on BK-KTC-2610-00038:  QUOTED  CASH  280.37
ALL charges by status/term:  QUOTED/CASH 184,  CANCELLED/CASH 16
any CREDIT line?    false
any UNBILLED line?  false
```

So after a real gate-out on a haulier with a CREDIT term for a priced charge,
there is still **not one CREDIT charge and not one UNBILLED charge in the whole
tenant**. S-002 stays `QUOTED / CASH`.

The quote says the money will be billed later; nothing then bills it. That is
the original #8, unchanged — only its pricing half was fixed.

### What the UI did wrong, and now does

A box whose ONLY charge moves to credit has an empty `due`, so `isPayable` is
false — and the screens treated it as a box with a problem:

- **the cash window** greyed it, showed no amount, and **never displayed its
  `billedLater` lines at all**: those were only summed for SELECTED boxes, and a
  box with nothing to pay cannot be selected. ฿186.92 going on the haulier's
  account was invisible.
- **Gate In** likewise showed only `due`.

Both now show the credit lines per box, marked **"on the haulier's credit
term"** where `byHaulierTerm` is set, and say **"Nothing to pay now"** rather
than leaving a settled box looking refused. A zero total with billed-later lines
is no longer dimmed, never reads as unpriced, and never asks for a supervisor —
the red "no rate in any tariff" block still belongs to `noPrice` alone.

---

## 8a. A gate VAS moved to credit is not written UNBILLED (new, not part of #8)

Reported by the owner 2026-10-06, and NOT worked around in the UI.

A gate VAS ticked at the window, which the haulier's term then moves to credit,
shows under `billedLater` in the quote — but is **not written as an UNBILLED
charge at gate-out**. So it is quoted, shown to the clerk, and then lost.

Same shape as #8 and presumably the same place in the code, but for the VAS
lines rather than the movement's own charges.

---

## Priority, if it helps

1. **#1** — `truckVisitId`. **Shipped**; Gate Out now releases against the
   truck's own visit and one arrival stays one visit.
2. **#8** — pricing fixed in `d7fca89`; the UNBILLED **write is still missing**,
   retested 2026-10-06. The Unbilled screen stays empty until it lands.
3. **#8a** — a gate VAS moved to credit, quoted and then lost.
4. **#3** — orphan blind orders, then **#2** a one-line answer.
4. **#6** — two questions, and we build the damage panel ourselves.
5. **#4**, **#5**, **#7**.

Do not change anything in `D:\SHARMA\PROJECT\gecko\platform`; report API
problems back to the owner.
