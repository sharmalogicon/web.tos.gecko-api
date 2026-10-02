# Gate In / Gate Out — bringing the Vector desktop screens onto Gecko.Api

**For the Gecko.Platform API session.** Everything below was read out of the live
Vector/TMS desktop source:

- `D:\SHARMA\PROJECT\TMS_SCT\TMS\ICDOperations\GateIn.cs` (3,751 lines) — Parts 1–9
- `D:\SHARMA\PROJECT\TMS_SCT\TMS\ICDOperations\GateOut.cs` (2,612 lines) — Part B

and checked against the current API on `http://localhost:5100`. Line references
are to whichever file the section names. **Nothing in the desktop codebase was
modified and nothing should be.**

Build both together. Gate Out *updates* the truck movement Gate In created, and
can add new movement lines to it, so designing the gate-in endpoints without
gate-out in view will produce a shape that has to be reworked.

This is the screen KORAKIT's clerks use ~140 times a day. It is also the screen
every other ICD and depot we sell to will use, so the logic below is to be
implemented in full — not trimmed to what KORAKIT happens to need today. In
particular the cash/credit split stays, even though KORAKIT is 100% cash.

---

## 1. What the screen is

One **truck visit** carrying **N container lines**, priced and paid for as a
single transaction.

```
TruckMovementHd              one truck, one arrival, one receipt
 ├── TruckMovementDt  [N]    one per container moved
 ├── InvoiceHeader           the cash invoice for this visit
 │    └── InvoiceDetail [N]  one per charge line per container
 └── BookingStatement [N]    the CREDIT lines, billed later instead of now
```

Saved **atomically** in one call — `SaveTruckMovementHd` (GateIn.cs:2395) writes
the header, every container line, the invoice and the credit statement lines
together. If any part fails, none of it happened.

Truck fields lock the moment the first container is added
(`HaulierDetailsSwitch(false)`, GateIn.cs:1285) — one visit is one truck.

### What Gecko.Api already does

Verified against the running API:

```
POST /api/tos/gate/transactions  with `truck`        -> creates the visit (TV-KTC-…)
POST /api/tos/gate/transactions  with `truckVisitId` -> joins the SAME visit
```

Two containers, one visit, one plate. **The visit model is already right.** What
is missing is the pricing, the payment, and about a dozen captured fields.

---

## 2. Trip type drives the form

`TripType` is the master switch: **`DROP-OFF CONT`** or **`PICK-UP CONT`**. It
maps to Gecko's `direction` (IN / OUT) but carries more meaning, because one
visit can legitimately contain both.

### 2.1 Mandatory-field matrix (GateIn.cs:146 `SetMandatoryByTrip`)

| Condition | Mandatory |
|---|---|
| always | Agent Code, Booking/BL No, Customer Code |
| Booking type `REPO` | Customer Code becomes optional |
| `DROP-OFF CONT` | Container No, Tare Weight, Max Gross Weight |
| `DROP-OFF` + `FULL` | …plus Cargo Weight, Seal 1 |
| `DROP-OFF` + `FULL` + booking type `EXPORT` | …plus Customs Permit No |
| Order type `BLIND GATE IN` | Booking/BL No becomes optional |
| `PICK-UP CONT` | Container No **not** mandatory — assigned from the yard |

This belongs in the API as validation, not only in the UI: the same rules must
hold for an EDI or kiosk-sourced gate-in.

### 2.2 Hard validations

- **Gate-in date may not be in the future** (GateIn.cs:1184).
- **`BLIND GATE IN` + `FULL` is rejected** (GateIn.cs:1191) — a blind gate-in is
  empty-only, because by definition nothing is known about the cargo.
- **Duplicate container within a visit** is rejected *only when the trip type is
  also the same* (GateIn.cs:1327 `CheckDuplicateContainerNo`). The same box may
  be dropped and picked in one visit; it may not be dropped twice.

### 2.3 Booking size/type reconciliation

`AdviceBookingTypeSize()` (GateIn.cs:1123): when the physical box's size/type
differs from what the booking says, the clerk is prompted and may **update the
booking** to match reality (`UpdateOrderContainerTypeSize`). Three outcomes:
abandon (0), proceed unchanged (1), update the booking (2).

The API should expose this as an explicit choice rather than silently trusting
either side.

---

## 3. Charging — the heart of the screen

This is the most intricate logic in the file and the part Gecko.Api does not have
at all today. Read this section twice.

### 3.1 Where charge lines come from

Two different sources depending on whether there is a real booking:

| Case | Source |
|---|---|
| Blind gate-in (no booking) | `GetGateChargesListForBLINDGateIn(orderType, branch, agentCode, "", customerCode, {Size, PaymentTerm, PaymentTo})` (GateIn.cs:1493) |
| Normal (booking exists) | `GetGateChargesList(...)` against the booking statement (GateIn.cs:1692) |

Both return `BookingStatement` rows, which are then filtered to the **first
movement of the order type**:

```
movementCode = OrderTypeMovements(orderType).OrderBy(Sequence).First().MovementCode
stmtlist     = stmtlistAll.Where(MovementCode == movementCode)
```

For the booking-based path there are two extra filters (GateIn.cs:1707):

```
isCargoTruck == true   ->  lines where IsWaived == false
isCargoTruck == false  ->  lines where IsWaived == false AND PaidAmount == 0
```

i.e. a non-cargo truck never re-charges something already paid. Lines carrying
`TruckCategory == 0` are stamped with the visit's actual truck category.

### 3.2 The gate charge is priced on five axes

`GetGateChargeAmount` (GateIn.cs:1938) → `QuotationBO.RetrieveGateCharge`:

```
OrderType + ChargeCode + MovementCode + TruckCategory + EquipmentSize  ->  sell rate
```

**`TruckCategory` is a pricing axis.** Gecko's tariff vocabulary already has
`TRUCK_CATEGORY`, so the resolver can do this — but there is nowhere to *store*
the truck's category on a visit, so today the rate cannot be resolved. See §5.

### 3.3 Cash vs credit, and the haulier override

Every charge line carries a `PaymentTerm` (CASH / CREDIT) and a `PaymentTo`
(CUSTOMER / AGENT / HAULIER …). Then:

**The haulier may override the term, per order type, per movement, per charge**
(GateIn.cs:1316, 1508):

```
GetHaulierOrderTypeChargesList(haulierCode, orderType) -> List<HaulierChargeTerm>
   matched on (MovementCode, ChargeCode)
   -> if a match exists, its PaymentTerm REPLACES the line's term
```

So a haulier on credit turns an otherwise-cash gate charge into a credit line.
This is the single most important rule to preserve: it is how a depot bills a
trucking company monthly instead of taking cash at the barrier.

### 3.4 Routing: what gets paid now vs billed later

```
isCash  = (effective payment term == CASH)

if (isCash)  waiveGateCharge = (chargeCode == GATECHARGE && containerIndex > 0)
else         waiveGateCharge = true          // credit lines are ALWAYS zeroed here
```

Two separate things are happening:

1. **The gate charge is levied once per truck visit.** On the second and later
   containers it is waived (GateIn.cs:1538). A truck pays to enter once, not per
   box.
2. **Credit lines still appear on the invoice grid, with zero money on them**
   (rate 0, qty 0, tax 0) so the clerk can see what was due, while the real line
   is routed to `bookingstmtListConvertCREDIT` (GateIn.cs:1596) and settled on
   the customer's statement.

Credit statement lines with `Qty == 0` are forced to `Qty = 1` (GateIn.cs:1728).

### 3.5 Money arithmetic — exact

```
SellRate      = round(Price, 2)
Quantity      = Qty                                   (Int16)
TaxAmount     = round(Qty * (Price * VAT%) / 100, 2)
SellingAmount = round(SellRate * Quantity + TaxAmount, 2)      <-- TAX-INCLUSIVE
```

`SellingAmount` **includes** tax. Gecko's cash window currently treats amount and
tax separately; whichever convention wins, it must be stated once and used
everywhere, and the receipt must still reconcile to the baht. When `waiveGateCharge`
is true all four are zero.

Header totals: `InvoiceAmount`, `TaxAmount`, `TotalAmount`, `WithHoldingTaxAmount`,
`NettAmount` (GateIn.cs:2336). **Thai withholding tax is a header-level concept**
and Gecko has no field for it.

### 3.6 VAS — operator-chosen services

`LoadGateInVASCharges(tripType, efIndicator, orderType)` (GateIn.cs:956):

```
source  = OrderTypeChargesVAS(orderType).Where(IsLoadAtGateIn == true)
offered = (tripType == 'DROP-OFF CONT' && ef == 'EMPTY')  ||  (tripType == 'PICK-UP CONT')
```

**A full drop-off is offered no VAS at the gate.** Selected VAS rows are then
inner-joined to the booking-statement rows on `{ChargeCode, PaymentTerm}`
(GateIn.cs:1620) — so a VAS the tariff cannot price is silently dropped rather
than invented. VAS lines are marked with `SlabRateFrom = SlabRateTo = 999`.

> **GOOD NEWS — this already exists in Gecko.** `OrderTypeChargeItem` carries
> `isValueAddedService`, `raiseAtGateIn`, `isOptional`, `paymentTermCode` and
> `defaultQty`, and KORAKIT's real data is migrated: `BLIND GATE IN` has 16
> charges, with `SC001` present twice — `raiseAtGateIn:true/CASH` and
> `false/CREDIT`. **Do not build a new VAS catalogue.** Read
> `GET /api/master/order-types/{code}` and filter on those flags.

### 3.7 System-wide configuration

`"LOAD ONLY GATE-CHARGE FOR"` (GateIn.cs:1676) — a configured list of order types
for which *only* the gate charge is raised, everything else suppressed. Gecko has
`/api/master/settings` with a declared-settings model; this should become one of
them rather than a hard-coded list.

---

## 4. Pre-gate-in (their pre-advice / "slot booking")

`PreGateInHeaderBO.GetContainerPreGateIn(branch, containerNo)` (GateIn.cs:2938)
returns a pre-advised record and prefills:

- container status
- size and type
- **pre-declared damage codes**, which tick the damage grid automatically

Gecko has **no pre-advice, slot or appointment model anywhere**. This is a
separate piece of work; the web UI is being built ad-hoc-first so it is not a
blocker. Flagged here so it is on the roadmap rather than discovered later.

---

## 5. Fields captured by the desktop that Gecko cannot store

All nullable. Add with a migration; do **not** backfill.

### On the truck visit (`gate.truck_visit`, `TruckRequest`)

| Field | Notes |
|---|---|
| `truckCategoryCode` | **Highest priority.** `TRUCK_CATEGORY` is already a tariff axis, so without this a gate move cannot be priced by truck size. Validate against the existing code list. |

### On the gate transaction (`gate.gate_transaction`, `GateTransactionRequest`)

| Field | Notes |
|---|---|
| `containerClassCode` | their "Container Class" (NONE / …) — code list |
| `materialCode` | "STL" — steel/aluminium. Height is **not** needed: `equipment_type.heightClass` already has it |
| `maxGrossWeightKg` | decimal — mandatory for drop-offs |
| `cargoWeightKg` | decimal — net cargo, distinct from gross and tare; mandatory for full drop-offs |
| `ventSetting` | reefer ventilation |
| `humidityPct` | decimal |
| `gensetNo` | clip-on genset identifier |
| `clipOnNo` | clip-on unit number |
| `customsPermitNo` | mandatory for full export drop-offs |
| `paperlessCode` | Thai Customs paperless reference |
| `nextLocationCode` | their "Next Loc." — onward destination |

Seals already cover Agent Seal / Cust. Seal through `seals[].sealType` — confirm
the seal-type code list contains `AGENT` and `CUSTOMER` and add them if not.

### New master entity — haulier charge terms

Nothing in Gecko models this and §3.3 cannot work without it:

```
HaulierChargeTerm
  haulierPartyCode   the haulier (an existing party with role HAULIER)
  orderTypeCode
  movementCode
  chargeCode
  paymentTermCode    CASH | CREDIT
```

Read by `(haulierCode, orderType)`, matched on `(movementCode, chargeCode)`.
Needs CRUD and a screen eventually; the read is what Gate In needs now.

---

## 6. Proposed API surface

### 6.1 Extend the gate transaction

```
POST /api/tos/gate/transactions
  + truck.truckCategoryCode
  + the eleven fields in §5
  + charges: [ { chargeCode, qty } ]      operator-selected VAS
  + tripType                               DROP_OFF | PICK_UP, if direction is not enough
  + bookingSizeTypeAction                  ABORT | KEEP | UPDATE_BOOKING  (§2.3)
```

Server-side, not UI-side:
- the §2.1 mandatory matrix
- the §2.2 hard validations
- the once-per-visit gate-charge waiver (§3.4) — the UI must not be trusted to
  count containers
- the haulier payment-term override (§3.3)

### 6.2 Price a whole visit

```
GET /api/revenue/window/quote-visit?truckVisitId={id}
```

Returns, per container and per charge line: `chargeCode`, `description`,
`sellRate`, `qty`, `vatRate`, `taxAmount`, `sellingAmount`, `paymentTerm`,
`paymentTo`, `containerNo`, plus visit totals (`amount`, `vat`, `total`,
`withholdingTax`, `nett`) and a clear split of **payable now (CASH)** vs
**billed later (CREDIT)**.

Reuse the existing cash-window resolver. **Do not write a second pricing path** —
the whole point of the resolver is that one tariff answers everywhere.

### 6.3 Take the money for a visit

```
POST /api/revenue/window/receipts     accept truckVisitId so one receipt covers the visit
```

Keep `expectedTotal` and keep the 409 on a tariff change mid-transaction. Add
`withholdingTaxAmount` and `nettAmount` to the receipt.

Credit lines must post to the customer's statement in the same transaction, not
as a follow-up job.

### 6.4 Documents

The desktop prints four, chosen at save (GateIn.cs:2430): **Pickup/TruckIn form,
EIR, Coupon receipt, Full tax receipt**. Gecko has the EIR PDF and the cash
receipt. The gate coupon exists as a concept (`gate.gate_authorization`). The
pickup form has no equivalent.

---

## 7. Edit rules after save

Deliberately narrow (GateIn.cs:2375): only **seals, remarks, customs permit and
clip-on** may be changed. Everything else is immutable once invoiced. Gecko should
match this rather than allowing a general edit — and anything beyond it should be
a void-and-rebook, which the gate already supports.

---

## 8. Out of scope here

- Pre-gate-in / slot booking (§4) — its own piece of work
- The desktop's DEMO record cap (`IsDEMOCountExceed`) — licensing, not domain

---

# PART B — Gate Out

Source: `GateOut.cs` (2,612 lines). Same domain objects as Gate In —
`TruckMovementHd`/`Dt`, `BookingStatement` (CASH / CREDIT / ConvertCREDIT),
`InvoiceHeader`/`Detail`. **No `OrderTypeChargesVAS` and no `DGCategory`**: there
is no VAS selection and no damage capture at gate-out.

## B1. Gate Out is an UPDATE, not an insert

This is the single most important structural fact, and it shapes the API.

```
Gate In   ->  creates TruckMovementHd + Dt lines          (SaveTruckMovementHd)
Gate Out  ->  UPDATES that same movement                  (UpdateTruckOutTranscation)
```

`SaveTruckOutWithContainerMovement` (GateOut.cs:1538) closes the **original**
line — the box that is leaving — and may append a **new** line
(`txtNewTransactionNo`) for a box the truck takes instead. So one truck visit is
genuinely two legs: something came in, something went out, one receipt.

There is a second path. `chkLadenToPort` (GateOut.cs:1450) switches which save
runs (GateOut.cs:642):

| `chkLadenToPort` | Save path | Meaning |
|---|---|---|
| unchecked | `SaveTruckOutWithContainerMovement` | ordinary gate-out closing an existing visit |
| **checked** | `SaveTruckInWithContainerMovement` | laden box leaving for the port, recorded as a **new in-movement line** |

In Gecko terms: a gate-out transaction must be able to reference the visit it
closes, and the visit must accept further lines after it has been opened. The
current `truckVisitId` + `/depart` pair is close but does not express "close this
line and open that one in the same breath".

## B2. Release gates — can this box leave?

Enforced in order (GateOut.cs:1090–1180). All are **server rules**, not UI ones.

1. **Container on hold** — `ContainerStatus.IsHold`. Blocked **unless** the
   order-type movement carries `IsReleaseDamageContainer = true`
   (GateOut.cs:1272). So "damaged" is releasable on some movements and not
   others; it is a property of the movement, not a global.
2. **Fixed-port restriction** (EXPORT only) — if the container has a
   `ContainerFixPortList`, the booking's `DestinationPort` must appear in it:
   *"this container is designated to certain fixed ports ONLY"*. Nothing in
   Gecko models a per-container port whitelist.
3. **Movement date ordering** — the gate-out date must be **later** than the
   container's previous movement date.
4. **Laden release date** (FULL + EXPORT) — the vessel schedule carries a
   `LadenReleaseDate`; release before it is blocked (GateOut.cs:1306). Note the
   method deliberately **fails open** on any error, which is the right instinct
   for a barrier-less depot: a lookup failure must not strand a truck.
5. **LCL tally-out** (FULL + EXPORT + LCL order type) — the container must have a
   `StuffUnStuffDate` **and** a seal before it may leave. LCL-ness comes from the
   order type's `ShipmentType` containing "LCL" (GateOut.cs:1231).
6. **Long-standing days** — `Customer.NumberOfLongStandingDays` per agent
   (GateOut.cs:1256). The check is **commented out** in the live code
   (GateOut.cs:1177). Model the field; ask the owner before enforcing it.

These are not the same as Gecko's holds. Holds cover (1); (2)–(5) have no
equivalent and need building.

## B3. Field rules specific to gate-out

- **Seal mandatory is per movement** — `OrderTypeMovement.IsCheckSealNo`
  (GateOut.cs:461). Gecko already has this: `GateStep.checkSealNo`. Reuse it.
  Order types `REPO OUT` / `REPO IN` always permit seal entry regardless.
- **Gross weight is derived, not keyed**: `MaxGross = Tare + Cargo`
  (GateOut.cs:480). Compute it server-side; do not trust a keyed value.
- **Container height is derived** from size + type (`SetContainerHeight`,
  GateOut.cs:2002).

## B4. Charging at gate-out

Same machinery as Gate In §3 — `UpdateTruckDetailCharges`, the CASH/CREDIT split,
the haulier term override, the same money arithmetic. Two differences:

- **No VAS selection.** Charges are whatever the booking statement carries.
- Charges are calculated on an explicit **"Calculate Gate Charges"** action
  (GateOut.cs:1509), which also **locks the haulier** before pricing — the
  haulier determines payment term, so it cannot change after the quote.

`Save` is disabled until charges have been calculated. Worth keeping: it makes
"quote then commit" explicit rather than implicit.

## B5. A bug not to copy

GateOut.cs:604 validates that gate-out is later than gate-in using:

```csharp
TimeSpan tsDiff = dtpGateInDate.Value - dtpTruckInDate.Value;
if (tsDiff.Minutes < 0)        // <-- .Minutes is the COMPONENT, not the total
```

`TimeSpan.Minutes` is the minute component (−59..59), not the total. A gate-out
two hours *before* the gate-in gives `Minutes == 0` and passes. Use
`TotalMinutes` (or compare the timestamps directly) in the API. Flagged because
it is the kind of thing that gets faithfully reproduced during a port.

## B6. Documents

Same four as Gate In: Pickup/TruckIn form, EIR, Coupon receipt, Full tax receipt
(GateOut.cs:2298). The EIR print is offered immediately after save.

## B7. Delete

`btnDelete_Click` (GateOut.cs:2217) exists — a gate-out can be reversed. Gecko
has `POST /api/tos/gate/transactions/{id}/void`, which is the better model
(append-only). Keep void; do not add delete.

---

## 9. Open questions for the owner

1. **`SellingAmount` is tax-inclusive** in Vector (§3.5); Gecko's cash window
   keeps amount and tax separate. Which convention wins? Whichever it is, state
   it once and use it on screen, on the receipt and in the statement.
2. **Withholding tax** is captured but always written as `0` with type `NONE` in
   this screen. Is it ever non-zero at the gate, or only on monthly invoices?
3. **`PaymentTo`** distinguishes CUSTOMER / AGENT / HAULIER. Does the pilot need
   all three, or is CUSTOMER enough to start?
4. Should `tripType` be a first-class field, or is `direction` + the order type's
   movement enough to derive it?
5. **Long-standing days** (B2.6) is modelled on the customer but the enforcement
   is commented out in the live code. Build the field and leave it unenforced, or
   enforce it?
6. **Fixed-port restriction** (B2.2) needs a per-container port whitelist, which
   Gecko has nowhere. Is it in use at KORAKIT, or dormant Vector functionality?
7. `chkLadenToPort` (B1) changes which movement is written. Is "laden to port" a
   distinct movement in Gecko's order-type movement list, or a flag on the move?

## 10. Suggested build order

1. **Capture fields** (§5) + `truckCategoryCode` — unblocks pricing and is pure
   additive schema.
2. **`HaulierChargeTerm`** master (§5) — nothing in the charging model works
   without it.
3. **Charges on the gate transaction** (§6.1) + the once-per-visit waiver and the
   haulier override as *server* rules.
4. **`quote-visit`** (§6.2) — read-only, provable against the desktop's numbers.
5. **Visit-scoped receipt** (§6.3) with the CASH/CREDIT routing.
6. **Gate-out release gates** (B2) — holds first, then laden release date and LCL
   tally; fixed ports last pending question 6.
7. **Gate-out as an update to the visit** (B1), including the laden-to-port path.

Verification that costs nothing and is worth a lot: replay a real KORAKIT gate
day out of Vector and reconcile the charge lines to the baht, the same way the
August tariff replay was done during the migration.
