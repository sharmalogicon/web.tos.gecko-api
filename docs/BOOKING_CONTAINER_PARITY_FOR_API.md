# Ask: two things Vector's Container Details has and Gecko does not

Source: the Vector **Booking Entry → Container Details** tab. The UI is rebuilding it
as a table + Add + modal. Everything in Vector's *Container Info* panel already maps
onto §16b fields except the two below.

## Already there, nothing needed

| Vector | Gecko (§16b / §16e) |
|---|---|
| Container No | `containerNo` |
| Type - Size | from the requirement line (shown read-only) |
| P/U Mode | `handoverMode` |
| Pickup Date | `requiredDate` |
| IMO / UN No | `imdgClass` / `unNumber` |
| Cargo Cat | `cargoCategoryCode` |
| Weight / Vol | `declaredVgmKg` / `declaredVolumeCbm` |
| Temperature / Vent / Humidity | `reeferSetTempC` / `reeferVentPct` / `reeferHumidityPct` |
| Pre-Cool | `isPreCool` |
| Agent Seal / Cust. Seal | `declaredSealNo` / `customerSealNo` |
| Stowage | `stowageCode` / `stowageNo` |
| Remarks | `remarks` |
| **Movements** panel | the container's `steps` — already returned, read-only |

## 1. Container class / grade on the booked box

Vector's grid has a **Grade** column and the panel a **Container Class** dropdown
(`NONE` in the screenshot). A booking container in Gecko has no grade of its own:
`gradeCode` exists on the gate EIR and on the container's story (what the box actually
IS), and `minGradeCode` on a requirement line (what the line asks for), but nothing on
the booked box.

Asked for: `gradeCode` (nullable, a container-grade code) on the booking container —
accepted by `POST …/containers/batch`, by `PUT …/containers/{id}`, and returned on
`GET /api/tos/bookings/{id}`. It is the grade asked for FOR THIS BOX, which may be
tighter than the line's.

If you think per-box grade is wrong and the line's `minGradeCode` should govern, say so
and the UI will show the line's grade read-only instead.

## 2. VAS charges per booked box

Vector carries a **VAS Charges** grid against each container: `Charge Code`,
`Payment Term`, `Payment To`, `Qty`, `Is AutoLoad`, `Is VAS`. These are value-added
services agreed AT BOOKING TIME — the clerk promises them when the booking is raised.

Gecko has VAS only later: `vas: string[]` on the cash-window quote terms and
`vasOffered` on a window box, i.e. services the gate or the counter adds. There is no
way to record them on the booking.

Asked for, if you agree it belongs on the booking:
```
GET    /api/tos/bookings/{id}/containers/{containerId}/vas      -> the lines
PUT    /api/tos/bookings/{id}/containers/{containerId}/vas      -> replace them
       { rowVersion, lines: [ { chargeCode, paymentTermCode, billTo, qty,
                                isAutoLoad, isVas } ] }
```
Questions before you build it:
1. Should a booked VAS line flow through to the cash window automatically, so the
   charge appears without the counter re-adding it? That is the only reason to record
   it at booking time rather than at the gate.
2. Is `billTo` ("Payment To") the same role list as a tariff's bill-to
   (`CUSTOMER / AGENT / LINE / FORWARDER / SHIPPER / CONSIGNEE`)?
3. What do `Is AutoLoad` and `Is VAS` mean to the pricer — are they flags on the line,
   or a property of the charge code we should read from master data instead?

If booking-time VAS is not how Gecko should work, say so plainly and the UI will drop
the panel rather than build a screen for something the pricer ignores.

## 2b. Units on the reefer readings, and haulage

Also from the recovered June design (`/compare/june/booking-detail`), which carries
these and the current API does not:

| field | Vector / June | note |
|---|---|---|
| temperature unit | `CEL` / `FAH` beside Temperature | `reeferSetTempC` fixes the unit in its name. Thai depots work in Celsius, so this may be deliberate — but Vector lets the clerk pick, and a booking typed from a line's Fahrenheit instruction gets mis-keyed. Either accept a unit, or tell us it is always C and we will label the field so. |
| vent unit | `VEN` / others | `reeferVentPct` likewise assumes a percentage. Vector's unit list suggests vent can be expressed as CBM/h on some lines. |
| humidity unit | `NA` | same question. |
| `haulageCode` | Haulage: MERCHANT / CARRIER | who moves the box inland. Not on the booking container today, and it decides who the depot bills for the lift. |

The three unit questions may all have the same answer ("always metric, drop it") — that
answer is fine and we will stop asking. `haulageCode` is the one we think is real.

## 3. Minor

Vector's footer shows **Created By / On** and **Modified By / On** for the container.
If the booking container already carries those, please say which fields; if not, no
need to add them for go-live.

## Not asked for

No change to the batch / preview / confirm contract, to `handoverMode`, or to anything
in §16. Both additions optional, so nothing that creates a booking today breaks.
