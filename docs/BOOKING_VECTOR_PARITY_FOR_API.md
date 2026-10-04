# Ask: booking fields Vector has and Gecko does not

Source: the Vector Booking screen, "Vessel & Voyage Details" and "Other Information"
panels. The UI is rebuilding both on `/bookings/new` (step 2 and step 4) and on the
booking page. Most of it is already in the API — this is only the gap.

## Already there, nothing needed

| Vector field | Gecko |
|---|---|
| Vessel Code + name | `booking.vesselCode`, call's `vesselCode` / `vesselName` |
| Voyage No (in / out) | `booking.voyageIn` / `voyageOut`, call's `operatorVoyageIn` / `Out` |
| Wharf | vessel call `terminalCode` |
| ETD | `booking.etd`, call's `etd` |
| CY Cut-off (Dry / Reefer) | cutoff kinds `YARD_DRY` / `YARD_REEFER` |
| Port Cut-off (Dry / Reefer) | cutoff kinds `PORT_DRY` / `PORT_REEFER` |
| Commodity | `booking.commodityCode` |
| Remarks | `booking.remarks` |

The UI reads the voyage block off the chosen vessel call and shows the vessel,
voyage, wharf and ETD read-only, as Vector does (greyed).
`GET /api/tos/vessel-calls/{id}/effective-cutoffs?lineCode=` is what that panel reads.

**The cut-offs are NOT read-only.** The owner's requirement: a clerk entering a
booking may need to change cut-off dates for that booking. That already exists —
see §0 — so please do not build a second way to do it.

## 0. Per-booking cut-off override — ALREADY BUILT, please just document it

`POST /api/tos/bookings/{id}/cutoff-exceptions` is live and answers today:

```
GET  /api/tos/bookings/{id}/cutoff-exceptions   -> 200 []
POST /api/tos/bookings/{id}/cutoff-exceptions   -> 400 naming the required fields:
     { cutoffKind, allowedUntil, reason }
```
Permission `tos.cutoff.override`, which admin@korakit.com holds. The UI will bind this
as "change this booking's cut-off" on the Vessel & Voyage panel. Nothing new needed —
we only need the contract written down so we bind it correctly:

1. The **response shape** of GET and POST (fields on an exception row: id, kind, allowedUntil,
   reason, status, who/when, revokedAt?).
2. `PLAN.md` says "list, **approve**, revoke". Is an exception effective the moment it is
   posted, or does it need approving first? If approval exists, what is the path and permission?
3. The **revoke** path (`POST …/cutoff-exceptions/{id}/revoke`?) and what it takes.
4. Which `cutoffKind` values it accepts — the vessel-call kinds, plus the two new ones in §1?
5. Does an exception change what `effective-cutoffs` returns for that booking, or does the
   gate apply it separately? The UI wants to show the clerk the date that will actually bite.

### One thing to decide, not build twice

§2 asks for `allowLateGateIn` because Vector has that checkbox. But a cut-off exception
with a late `allowedUntil` is arguably the same thing said better — per kind, dated, with
a reason and an audit trail, rather than one blanket boolean. **If you think the exception
covers it, say so and we will drop `allowLateGateIn` from the ask** rather than ship two
mechanisms that do one job and can disagree with each other.

## 1. Two cut-off kinds are missing

Vector shows **CFS Cut-off (Dry)** and **CFS Cut-off (Reefer)** beside the CY ones.
The kind list today is `PORT_DRY, PORT_REEFER, PORT_DG, YARD_DRY, YARD_REEFER,
YARD_DG, VGM, SI` — there is no CFS pair. A depot running CFS work (KORAKIT does:
the order types include CFS) cannot record the cut-off its clerks work to.

Asked for: `CFS_DRY` and `CFS_REEFER` added to the cut-off kinds, carried by
`PUT /api/tos/vessel-calls/{id}/cutoffs` and returned by `effective-cutoffs` like
the rest. No other change.

## 2. Booking header fields — Vessel & Voyage panel

Both sit on the BOOKING, not the call: they are decisions about this booking.

| field | type | why |
|---|---|---|
| `allowLateGateIn` | bool, default false | Vector's "Allow Late Gate-In". **See the note in §0 first** — the cut-off exception may already cover this, in which case drop it. |
| `paperlessCode` | string, ≤ 30, null | Vector's "PaperLess Code" — the line's e-release reference, quoted when there is no paper D/O. |

## 3. Booking header fields — Other Information panel

| field | type | notes |
|---|---|---|
| `totalQty` | int, null | the shipper's declared piece count |
| `uomCode` | string, null | its unit — BAG, CTN, PLT… a code list (`UOM`) would be better than free text |
| `totalVolumeCbm` | decimal, null | declared for the whole booking |
| `totalWeightKg` | decimal, null | declared for the whole booking |
| `marksAndNos` | string, ≤ 200, null | shipping marks |
| `specialInstruction` | string, ≤ 1000, null | separate from `remarks`, which is already used for operational notes |

### Please confirm one design point

`totalQty` / `totalVolumeCbm` / `totalWeightKg` could be **derived** from the container
rows instead of stored. Vector stores them, and we think stored is right: they are what
the **shipper declared for the booking**, which is routinely not what the boxes add up
to — and the difference is itself worth seeing. If you would rather they were computed,
say so and the UI will show them read-only instead.

If `UOM` should be a code list, tell us the category code and we will read it like the
others; otherwise the UI will send free text.

## 3b. Three more, found in the recovered June design (2026-10-04)

The original booking screen was recovered from commit `83d19af`
(`/compare/june/booking-detail`). Its header carries three fields the booking does not,
and they are not covered above:

| field | Vector / June label | note |
|---|---|---|
| `shipperPartyCode` | Shipper | the booking already has agent, customer, forwarder and haulier, but no shipper. Is "Shipper" simply the customer under another name here, or a fourth party in its own right? |
| `containerOwnerCode` | Container Owner | who owns the boxes — the line, or someone else (SOC). Today the booking only has `lineCode`, which is the carrier, not necessarily the owner. |
| `tradeModeCode` | Trade Mode | the June screen offers it beside the ports. The booking has `bookingTypeCode` and `cargoClassCode` — does one of those already mean this? |

Please answer the "is this already X" question on each rather than adding a duplicate
field: three ways to say the same party is worse than one name that is slightly wrong.

## 4. Not asked for

No change to the vessel call model beyond the two cut-off kinds. No change to
`/containers`, `/requirements`, or the booking's existing 39 fields. All new header
fields optional, so nothing that creates a booking today breaks.

Note the header `PUT /api/tos/bookings/{id}` replaces the whole header, so once these
exist the UI will send them on every header save — they need to be accepted on both
POST and PUT.
