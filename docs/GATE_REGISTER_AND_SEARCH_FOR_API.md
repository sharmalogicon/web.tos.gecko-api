# Two small reads the gate screens need — 2026-10-08

Both are additions to existing responses. No new endpoints, no behaviour change.

## 1 · The EIR registers show Gecko's order number, not the one anyone quotes

`GET /api/tos/gate/transactions` answers `GateTransactionSummaryResponse`:

```
containerNo, direction, eirNo, fullEmpty, gateTransactionId,
isLate, lineCode, movementCode, orderNo, status, transactionAt, truckPlate
```

> **Prompt for the API:** add **`carrierRef`** and **`subBlNo`** to
> `GateTransactionSummaryResponse`, from the booking the transaction belongs to.

The EIR-In and EIR-Out registers have an ORDER column showing `BK-KTC-2610-00010`.
That is how Gecko files a booking; it is not what the driver, the agent or the
shipping line says on the phone — they quote the carrier's booking number or the
B/L. With those two fields the column reads the way the Booking Statement
register already does since this change:

```
CHENG-BK-88421          <- carrierRef, or subBlNo when there is no booking ref
BK-KTC-2610-00010       <- orderNo, small
```

Until they arrive the registers keep showing `orderNo` alone — nothing is broken,
it is just the wrong number in the big type.

## 2 · Gate Out cannot find a truck by the box it came for

`GET /api/tos/gate/visits` matches only the visit number and the plate
(`GateEndpoints.cs:862`):

```csharp
if (query.Search.Clean() is { } q)
    rows = rows.Where(v => v.VisitNo.Contains(q) || v.TruckPlate.Contains(q));
```

> **Prompt for the API:** make `Search` on `/api/tos/gate/visits` **also match the
> container number and order number of the visit's pickups** — i.e. include
> `db.VisitPickups` joined to the visit, matching `ContainerNo` and the booking's
> `OrderNo`, for pickups that are still `PLANNED`.

A driver at Gate Out says *"I am here for MSKU8112301"*, never *"I am visit
TV-KTC-2610-00044"*. The clerk has the box number on the paperwork in their hand
and nothing else.

**What the screen does meanwhile:** it filters the page it already has. The
response carries `pickups[]` per visit (`VisitPickupResponse` with `containerNo`,
`orderNo`, `status`), so a typed container number is matched client-side across
the open visits that came back. That is correct for a depot with a dozen trucks
inside and `openOnly=true`, and it silently stops being correct past one page —
which is why the server should do it.

## Also now live in the UI, needing nothing from you

**Gate Out lists only trucks that came to collect.** A visit is offered only when
it has at least one `PLANNED` pickup, and each row names the boxes it is here for.
A truck that came purely to drop off is no longer in the list — it has no business
on a screen that releases boxes. All of this reads `pickups[]`, which
`/gate/visits` has always returned and the screen simply ignored.

---

Do not change anything in `D:\SHARMA\PROJECT\gecko\platform`; report API
problems back to the owner.
