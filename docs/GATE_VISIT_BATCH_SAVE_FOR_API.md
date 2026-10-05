# Gate In: quote per box, save the whole truck once

Owner's model, 2026-10-05, and it is the desktop's. The gate screen today saves
each box the moment the clerk finishes it. That is wrong for how a gate works.

---

## What the clerk actually does

One truck arrives carrying three boxes. The clerk keys box 1, box 2, box 3 — and
**nothing is written** until the barrier lets the truck through. Then **one
Save** records all three moves, raises the cash receipt, and prints. The desktop
does literally this: `btnSave_Click` → `SaveTruckMovementHd(truckmovementhdItem)`
with `TruckMovementDtItems` = every trip, which returns the transaction number
AND `InvoiceItem.InvoiceNo` together (`GateIn.cs` line 2272 onward).

So the screen needs two separate things, and has only one of them:

| step | what it must do | today |
|---|---|---|
| **Record** (per box) | price this box and show the charges — **write nothing** | ✅ `GET /api/revenue/window/bookings` already does this |
| **Save gate transactions** (once) | commit every trip + raise the cash receipt + return the gate transaction no | ❌ **does not exist** |

Right now `POST /api/tos/gate/transactions` commits one box irreversibly. Three
boxes means three commits. If the third is refused for a hold, two boxes are
already through the gate and the only way back is `/void`. A gate clerk cannot
work like that.

---

## The quote half already works — no change wanted

Confirmed live 2026-10-04:

```
GET /api/revenue/window/bookings?orderNo=BK-KTC-2610-00030
     &bookingContainerIds=fa49de47-…&truckCategoryCode=18_WHEEL&haulierCode=20221692
→ 200  due[] / billedLater[] / tried[] / vasOffered / withholdingTax,
       and the effective truckCategoryCode + haulierCode echoed back
```

That is exactly "bring back the applicable charges without saving". `sameTruckAs`
already handles the second booking on the same truck, and the PER_TRIP gate
charge already lands on one box only. Nothing to add.

---

## The ask: one atomic save for the whole visit

```
POST /api/tos/gate/transactions/batch          (name it as you prefer)
Idempotency-Key: <uuid>                        REQUIRED — a double-submit must
                                               never gate one truck twice
{
  "branchId": "…",
  "truck": { "plate":"70-4455", "trailerPlate":"TLR-442-9", "driverName":"…",
             "driverLicence":"…", "haulierCode":"HAU-01", "truckCategoryCode":"18_WHEEL" },
  "transactionAt": "2026-10-05T09:14:00+07:00",

  "trips": [                                   // 1..n, in the order keyed
    { "clientLineId": "<uuid>",                // so a resend is recognisable
      "tripType": "DROP_OFF_CONT", "direction": "IN",
      "containerNo": "AKLU6018567",
      "bookingContainerId": "…",               // the box the clerk picked, OR:
      "blindOrder": {                          // …raise a BLIND GATE IN for it
        "lineCode": "APL", "customerCode": "20120228",
        "equipmentTypeCode": "20GP", "agentCode": "APL" },
      …every field POST /gate/transactions takes today…
      "vas": ["VASWASH"]                       // ticked on this box
    }
  ],

  "payment": {                                 // omit = quote only, take no money
    "expectedTotal": 363.80,                   // the quote's cash total
    "withholdingTax": false,
    "payments": [ { "channel":"CASH", "amount":363.80 } ]
  }
}
```

**Response 201**

```jsonc
{
  "truckVisitId": "…", "visitNo": "TV-KTC-2610-00005",   // the gate transaction no
  "pickupDropoffMode": "PICKUP_DROPOFF",
  "trips": [ { "clientLineId":"…", "gateTransactionId":"…", "eirNo":"EIR-KTC-2610-00006",
               "movementCode":"FULL_IN", "fullEmpty":"FULL", "orderNo":"BK-…",
               "findings":[…] } ],
  "receipt": { "receiptId":"…", "receiptNo":"RCT-…", "total":363.80,
               "withholdingTax":null } ,
  "billedLater": { "subtotal":…, "tax":…, "total":… }
}
```

### These five are AGREED by the owner (2026-10-05) — build to them

1. **All or nothing.** The desktop's single Save implies it, and a half-gated
   truck is worse than a refused one. If trip 2 hits a hold, **nothing is
   written** and the 409 names the trip — `trips[1]` — with its findings.

2. **Blind orders must be inside the transaction.** A box with no booking needs
   its BLIND GATE IN raised as part of the same atomic save — hence `blindOrder`
   on the trip. Today the UI calls `POST /api/tos/gate/blind-orders` first, so a
   failed gate POST leaves an orphan order behind with no box ever gated.
   Keep `/blind-orders` for other callers; we would stop using it here.

3. **Field-level 400s keyed by trip index**, please:
   `{"errors": {"trips[1].tareWeightKg": ["…"], "trips[2].seals": ["…"]}}`.
   The screen puts each message under the field on that box's row.

4. **`expectedTotal` guard**: same 409 "The price changed" as the window receipt,
   so the clerk re-quotes rather than taking the wrong money. And the PER_TRIP
   gate charge still charged **once per truck**, as the quote already does.

5. **The receipt is raised by this same call.** The default cash invoice is
   created by the Save, as the desktop does it — `SaveTruckMovementHd` returns
   the transaction number and `InvoiceItem.InvoiceNo` together. It is not a
   second round trip the clerk can be interrupted in the middle of.

### Permissions

`tos.gate.create` at the branch for the moves; `revenue.cash.collect` when
`payment` is present.

---

## What the UI is doing meanwhile

Nothing. The Gate In screen stays exactly as it is — **Record** still commits one
box — until this endpoint exists. A stopgap that looped today's single POSTs
would look like the right workflow while quietly not being atomic, which is the
one property this change is for. The swap, when it lands, is confined to one
function: Record stops calling `POST /gate/transactions` and calls the window
quote instead; a new Save calls this.
