# Gate In — Vector parity, from the desktop source

Read from `TMS/ICDOperations/GateIn.cs` (3,751 lines) on 2026-10-04, and checked
against the running API the same day. Everything below is what the desktop
actually does, not what the screenshot looks like.

The UI is being rebuilt to match it. These are the **six places the API cannot
back it yet**, in the order they block us.

---

## 1. BLIND GATE IN contradicts itself — this one is blocking

Two endpoints each tell you to do what the other refuses:

```
POST /api/tos/bookings   { "orderTypeCode": "BLIND GATE IN", … }
  → 400  "BLIND GATE IN bookings are made by the gate itself, not by hand."

POST /api/tos/gate/transactions   (a box on no booking)
  → 409  NO_ASSIGNMENT
         "…is not on an open booking. Raise the booking (or a walk-in) and
          assign the box first."
```

`GateTransactionRequest` has 33 fields and **no** blind / walk-in flag, so there
is no third way in. A box that arrives with no paperwork cannot be gated at all
right now.

**What the desktop does** (`SetMandatoryByTrip`, line 146):

```csharp
if (cmbOrderType.Text.Trim() == "BLIND GATE IN")
    txtBLNo.BackColor = Color.FromName("White");   // B/L stops being mandatory
```

So BLIND GATE IN is an **order type the gate clerk picks**, and choosing it is
what makes the Booking/B-L No optional. It is the normal path for a box with no
order — at KORAKIT that is most of them.

**Please pick one and say which:**

- **(a)** `POST /api/tos/gate/transactions` raises the order itself when the box
  is on none — the clerk sends the gate fields plus whatever the order needs
  (order type, line, customer, equipment type), and the 201 carries the new
  `orderNo`. This is what the 400's own wording implies.
- **(b)** Allow `orderTypeCode: "BLIND GATE IN"` on `POST /api/tos/bookings`
  again, restricted to a caller with `tos.gate.create`.

Until then the screen raises an ordinary walk-in order of a real type, which
works but is not what the clerk expects to key.

---

## 2. One endpoint for the booking search: what the gate can actually gate

The gate clerk **keys the Booking / B-L No first**, not the container. That field
fills the whole trip block, so this search is the centre of the screen — and the
desktop's search dialog is a grid of **one row per booking x container**, not per
booking (the same B/L `AKC0393480` appears six times, once per box).

**It can be done today, and is**, with `GET /api/tos/bookings?Search=` (which
already matches `carrierRef`, confirmed live) + `GET /api/tos/bookings/{id}` +
`GET /api/master/movements` to tell IN from OUT. Nothing is blocked. But it
costs two round trips per box and **cannot draw the desktop's grid at all**,
because the list response drops most of the columns (below).

**The ask — one read-only endpoint that answers the clerk's actual question:**

```
GET /api/tos/gate/bookable
      ?branchId=…
      &direction=IN|OUT            the trip being keyed; only boxes owing a move that way
      &search=                     B/L (carrierRef), sub-B/L, order no, or container no
      &truckVisitId=               optional: leave out boxes already on this truck
      &page=&pageSize=
→ 200 { totalCount, items: [ … ] }   one item per BOOKABLE BOX
```

Each item, with the desktop's own column names in brackets:

```jsonc
{
  "bookingId": "…", "orderNo": "BK-KTC-2610-00021",
  "carrierRef": "RS2026-000739",          // [BookingBLNo]
  "subBlNo": "HK9LST00",                  // [SubBookingBLNo]
  "bookingTypeCode": "EXPORT", "orderTypeCode": "EXP CY/CY", "directionCode": "EXPORT",
  "agentCode": "HMM",                     // [AgentCode]
  "customerCode": "20250915", "customerName": "…",   // [CustomerCode]
  "lineCode": "HMM",
  "vesselCode": "HOLD", "voyageOut": "HOLD",         // [VesselCode] [VoyageNo]
  "bookingDate": "2026-09-02",            // [BookingDate]
  "bookingContainerId": "…", "containerNo": "AKC0393480",
  "equipmentTypeCode": "40RH", "size": "40", "type": "RH",   // [Size] [Type]
  "nextStep": { "movementCode": "FULL_OUT", "direction": "OUT", "fullEmpty": "FULL" },
  "declaredSealNo": null, "customerSealNo": null, "declaredVgmKg": null,
  "reeferSetTempC": null, "reeferVentPct": null, "reeferHumidityPct": null,
  "nextPrevLocation": null, "paperlessCode": null
}
```

Perm `tos.gate.create` (or `tos.booking.view`) at the branch.

**Why this shape and not a filter on the existing list:**

- **One row per box is the clerk's unit of work.** They are gating a box, not a
  booking. Flattening server-side removes a round trip per box AND makes the
  desktop's grid drawable.
- **The list DTO drops what the grid shows.** The same booking reads
  `bookingTypeCode: null, agentCode: null` from `GET /api/tos/bookings?Search=`
  and `"INTERNAL"` / `"APL"` from `GET /api/tos/bookings/{id}`. Vessel, voyage
  and booking date are not on the list items either.
- **`direction` cannot be answered from a booking alone.** A booking's
  `steps[]` carries `movementCode, sequenceNo, status, isRequired,
  gateTransactionId, skipReason` — **no `direction`, no `fullEmpty`**. Preflight's
  `nextStep` has both. We join to `/api/master/movements` client-side today,
  which works but means the UI decides what "FULL_OUT" means.
- **The same box must not go on one truck twice.** The desktop does
  `BkDt.ContainerKey NOT IN (…)` (`btnSearchBooking_Click`, line 555);
  `truckVisitId` lets the server do it properly.

**If only part of this is cheap**, the useful order is:
`direction` filter > one row per box > `bookingTypeCode`/`agentCode`/vessel/
voyage/`bookingDate` on the row > `truckVisitId` exclusion.

## 3. VAS at the gate — nothing lists them

The desktop shows a tick-list of value-added charges (`LoadGateInVASCharges`,
line 956), and the rule is exact:

```csharp
if (dropOffMode == "DROP-OFF CONT" && efIndicator == "EMPTY")  // offered
else if (dropOffMode == "PICK-UP CONT")                        // offered
// otherwise: no VAS
```

filtered to `vas.IsLoadAtGateIn == true`, by order type.

That matches the contract's own words for `boxes[].vasOffered` ("an empty
drop-off or a pick-up"), and `GET /api/revenue/window/bookings` already **takes**
`&vas=CODE`. But **no endpoint enumerates them** — there is nothing to tick.

**Ask:** `GET /api/master/order-types/{orderTypeCode}/vas?atGateIn=true`
→ `[{ chargeCode, description, isLoadAtGateIn, sellRate?, currencyCode? }]`

---

## 4. Payment at the gate — confirm the shape

The desktop takes the money **on this screen**: a Payment Details grid (charge
code, sell rate, VAT, sell amount, payment term, container no) and a Payment
Summary (receipt no, amount, VAT, total, **nett**), plus a withholding-tax tick.

The lines come from the booking's statement, filtered hard
(`LoadBookingDetails`, line 688):

```csharp
st.PaymentTerm == CASH && st.IsAutoLoad == true &&
st.IsVAS == false && st.IsWaived == false && st.PaidAmount == 0
```

Withholding is **3% of the sell amount before VAT**, and `nett = total − WHT` —
which is contract §8 exactly.

**Ask — confirm, don't build:** the gate screen should use
`GET /api/revenue/window/bookings` with `bookingContainerIds` = the boxes on
this truck (plus `truckCategoryCode`, `haulierCode`, `vas`, and `sameTruckAs`
for the two-bookings case), then `POST /api/revenue/window/receipts` with
`withholdingTax: true`. Is that right, and is it meant to happen **before** the
gate POST (cash before the barrier) or after? The desktop does both in one Save.

---

## 5. Damage at the gate — confirm it is the survey

`/api/master/damage-codes`, `/api/master/damage-locations` and
`POST /api/tos/gate/surveys` all exist, and `SaveSurveyRequest` already carries
`gateTransactionId, containerNo, conditionCode, gradeCode, surveyType,
surveyedAt, surveyorName, remarks, damages[]`.

The desktop's Damage Condition grid is a plain code + description list, far
simpler than that.

**Ask:** is a gate damage line meant to be a survey posted **after** the EIR
(so `gateTransactionId` is known), or should the gate POST accept the damage
lines inline? If it is a survey, what is the minimum `surveyType` for a gate-in?

---

## 6. Two small master-data gaps

- **Height.** The desktop pairs Material with Height (`STL` / `8'6"`).
  `ContainerResponse` has `material` but no height, and nothing on the gate
  request carries it. Drop it, or add `heightCode`?
- **Agent.** `BookingResponse.agentCode` exists and the desktop makes the agent
  drive the liner list (`BindDataForLiners`). But `GET /api/master/parties?role=AGENT`
  returns nothing. Which role lists the agents a clerk can pick —
  or is the agent only ever read off the booking, never chosen at the gate?

---

## What we found that the API already backs, for the record

Verified live on 2026-10-04 — no action needed, listed so nobody re-asks:

- the required-field matrix, keyed exactly as the desktop colours its boxes:
  drop-off → tare + max gross; + FULL → cargo weight + ≥1 seal; + FULL + EXPORT
  → customs permit. `REPO` dropping the customer requirement is the only desktop
  rule we could not see server-side.
- a drop-off opening the visit, a pick-up joining it by `truckVisitId`, and
  `pickupDropoffMode` deriving itself to `PICKUP_DROPOFF`.
- every §1 field echoed back: `tripType`, `truckCategoryCode`, `materialCode`,
  `maxGrossWeightKg`, `cargoWeightKg`, the reefer four, `customsPermitNo`,
  `paperlessCode`, `nextLocationCode`; `AGENT` / `CUSTOMER` seal types.
- the whole prefill chain for keying a booking: `BookingResponse` carries
  `carrierRef, bookingTypeCode, orderTypeCode, agentCode, customerCode,
  vesselCode, voyageIn/voyageOut, nextPrevLocation, paperlessCode`;
  `BookingContainerResponse` carries the seals, reefer set points and
  `requiredDate`; `ContainerResponse` carries `tareWeightKg`, `maxGrossKg`,
  `material`, `status`, `isoCode`.
- `quote-visit` answering **404** when a visit costs nothing — a real answer,
  handled as one.

## Two desktop rules we will enforce in the UI, no API change wanted

- **Gross is computed, not typed**: `gross = tare + cargo`
  (`CalculateGrossWeight`, line 3284).
- **Over Max Weight** is a *warning*, not a refusal: the desktop compares the
  computed gross against the container master's max gross and lets the clerk
  carry on (`ValidateWeight`, line 1100). Same for a size/type mismatch against
  the booking on an IMPORT FULL IN — "do you want to proceed?".
