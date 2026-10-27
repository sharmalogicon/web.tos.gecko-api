# Correcting the truck on a recorded EIR — 2026-10-27

A clerk keys `70-4944` as `70-4949`, or leaves the driver blank, and nobody
notices until the EIR is printed. Today the only remedy is to **void the EIR
and re-record the move** — which re-opens the booking step, re-prices the
visit, and burns an EIR number for a typo.

The owner asked for an **Edit** on the Truck block of the EIR detail (both
directions): **truck plate, haulier code, driver name, mobile**.

## The shape of the problem

Those four fields are **not on the gate transaction**. They are on the
**truck visit**:

```
gate.truck_visit          truck_plate, haulier_code, driver_name,
                          driver_mobile, trailer_plate, truck_category_code
gate.gate_transaction     container, movement, weights, seals, ...
                          (and a denormalised truckPlate on the read model)
```

So correcting them is one write against the visit, and it changes **every EIR
on that visit**. That is right — they were all the same truck — and the dialog
says so by name before the clerk presses Save.

---

## 0. ANSWERED — the endpoint shipped, 2026-10-27

`PATCH /api/tos/gate/visits/{truckVisitId}` is live, in the shape asked for,
with **one addition**: `reason` is **required**, max 300. That answers question
6 — yes, a reason is wanted — and web.tos now asks for one and will not save
without it.

Question 1 is answered too: `TruckVisitResponse` carries `rowVersion`, and the
dialog sends it.

**A 404 now means the VISIT is gone**, not that the endpoint is missing. The
"this depot's API cannot amend a truck visit yet" branch has been removed.

Still unanswered, and worth chasing: **2** (does the EIR read model's own
`truckPlate` follow the visit?), **3** (are the EIR PDF and truck-in form
rendered live or frozen at gate-in?), **4** (what happens to a receipt or
invoice already raised against the old haulier?), **5** (is `tos.gate.override`
the permission you want?) and **7** (where the before/after audit is written).

---

## 1. Built on the web side (2026-10-27)

- **Edit** on the Truck card, shown only to `tos.gate.override` at the EIR's
  branch (the same right that voids one), and never on a VOIDED EIR.
- A dialog with the four fields, the haulier through the usual party search.
- It names the other EIRs that will change: *"These details belong to the truck
  visit, so 2 other EIRs on this truck change with it: EIR-…-00091, EIR-…-00092."*
- A warning when the haulier is changed, because the haulier can be the party
  billed.
- It sends:

```http
PATCH /api/tos/gate/visits/{truckVisitId}
{ "truckPlate": "70-4944", "haulierCode": "20261626",
  "driverName": "Somchai", "driverMobile": "081-234-5678",
  "rowVersion": "<only when the visit returns one>" }
```

- A **required `Why`** box, max 300, sent as `reason`.
- On **404** it says *"This truck visit is no longer there. Nothing was changed."*
- On **409** it offers "Reload the visit".

---

## 2. The prompt

> **Let a supervisor correct the truck on a recorded visit (web.tos ask, 2026-10-27)**
>
> There is no way to fix a mistyped plate or a missing driver on a gate
> transaction short of voiding the EIR and re-recording the move — which
> re-opens the booking step and burns an EIR number for a typo. Please add an
> amendment on the truck visit:
>
> ```http
> PATCH /api/tos/gate/visits/{truckVisitId}
> {
>   "truckPlate":    "70-4944",     // required, max 20
>   "haulierCode":   "20261626",    // nullable, an existing HAULIER party
>   "driverName":    "Somchai",     // nullable, max 100
>   "driverMobile":  "081-234-5678",// nullable, max 30
>   "rowVersion":    "AAAAAAAAB9E=" // optimistic concurrency, as the void uses
> }
> ```
>
> Returning the updated `TruckVisitResponse` would suit us best; we re-read the
> visit and the EIR either way.
>
> **Seven questions, please answer rather than assume:**
>
> 1. **`rowVersion` on the visit.** `TruckVisitResponse` does not carry one
>    today, so we cannot send it. Please add it, the way `EirDetail.rowVersion`
>    guards the void — two clerks on one busy visit is not far-fetched. Until
>    it exists we send the body without it.
> 2. **The denormalised plate.** The EIR read model has its own `truckPlate`
>    (we show it as the header's PLATE). If the visit's plate changes, does
>    that copy change with it? If it is stored rather than joined, it has to be
>    updated too, or the EIR and the visit will disagree for ever.
> 3. **The printed documents.** The EIR PDF and the truck-in form carry the
>    plate and the driver. Are they rendered on demand from current data, or
>    was a copy frozen at gate-in? If frozen, a re-print after an amendment
>    shows the old truck and the correction is cosmetic.
> 4. **The haulier and the money.** The haulier can be the party billed for the
>    visit. If a cash receipt or a credit invoice has already been raised
>    against the old haulier, what should happen — refuse the change, allow it
>    and leave the document alone, or something else? Our preference is
>    **refuse with a clear ProblemDetails** rather than silently leaving an
>    invoice pointing at a party that is no longer on the visit. Whatever you
>    choose, give it a code we can key on.
> 5. **Which permission?** We have used `tos.gate.override` (what a void takes).
>    Say if you would rather it had its own, e.g. `tos.gate.amend`.
> 6. **Is a reason wanted?** A void requires one and it goes on the record. An
>    amendment of a recorded document is arguably the same. If you want one,
>    add `reason` (required, max 300) and we will add the box — we have
>    deliberately not invented the field.
> 7. **Audit.** Please write the before/after somewhere a supervisor can read
>    it. If there is a gate audit log already, this belongs in it; if the
>    container's own history is the only one, say so and we will show it there.
>
> **Out of scope on purpose:** the container number, the movement, the weights,
> the seals and the condition. Those change what the move *was*, and a void and
> re-record is the right remedy for them. This is only the truck that brought
> it.
>
> **A VOIDED EIR is not amendable** — it is history, and the replacement
> carries the corrected truck. web.tos already hides the button there.
>
> Don't change the UI; web.tos is ready and will stop showing "cannot amend
> yet" as soon as the endpoint answers.

---

## 3. Also worth knowing

`gate/eir-out` reads the same visit through `TruckInYardPicker` and shows the
truck read-only. Once this lands, a correction made from either EIR is visible
in both, because there is only one visit behind them.

---

Do not change anything in `D:\SHARMA\PROJECT\gecko\platform`; report API
problems back to the owner.
