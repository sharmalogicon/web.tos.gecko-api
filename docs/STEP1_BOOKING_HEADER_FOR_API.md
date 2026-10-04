# Step 1: create a booking header from Voyage & Parties

The UI's new booking screen saves the header ALONE and then moves to the containers
tab with the returned `bookingId`. This is the first of the booking steps; containers
come after and are not part of this ask.

## Already works — no change needed

`POST /api/tos/bookings` with `requirements: []` returns **201** with the booking,
its `bookingId`, `orderNo` and `rowVersion`. Verified against the local API on
2026-10-04 (it produced `BK-KTC-2610-00019`). Nothing to do here.

## What is missing: five header fields

The screen collects these and the booking has nowhere to put them. All optional, all
on **POST and PUT**, all returned by `GET /api/tos/bookings/{id}`:

| field | type | screen label | note |
|---|---|---|---|
| `shipperPartyCode` | string, null | Shipper | the booking has agent, customer, forwarder and haulier — no shipper. **Is "Shipper" just the customer under another name? If so say that and we will drop it.** |
| `containerOwnerCode` | string, null | Container Owner | who owns the boxes. `lineCode` is the carrier, which is not always the owner (SOC). |
| `tradeModeCode` | string, null | Trade Mode | **Does `bookingTypeCode` or `cargoClassCode` already mean this?** If so, say which and we will use it. |
| `paperlessCode` | string ≤ 30, null | Paperless Code | the line's e-release reference, quoted when there is no paper D/O. |
| `allowLateGateIn` | bool, default false | Allow Late Gate-In | lets this booking's boxes in after the CY/CFS cut-off. Owner's decision: a flag on the booking, settable only with `tos.cutoff.override`. |

Please answer the "is this already X" questions rather than adding a duplicate field —
three names for one party is worse than one name that is slightly wrong.

## One thing about the 201

After the create, the UI fills the whole header section from the answer and does not
re-read. So the **201 should return the same booking shape as `GET /api/tos/bookings/{id}`**
— including `orderNo`, `status`, `createdBy` / `createdOn`, and every field above echoed
back. If the 201 returns less than the GET, tell us and the UI will do a GET after
create instead.

## Not in this step

Containers, requirement lines, cut-off exceptions, cargo totals. Those are later steps
and are covered by `BOOKING_VECTOR_PARITY_FOR_API.md` and
`BOOKING_CONTAINER_PARITY_FOR_API.md` — please do not start them yet unless you are
already mid-way.
