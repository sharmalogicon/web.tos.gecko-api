# The Outstanding card must answer the search — 2026-11-01

**Screen:** `web.tos` → Billing → Unbilled Orders (`/billing/unbilled`).
**Endpoints:** `GET /api/revenue/charges/unbilled` (the card) and
`GET /api/revenue/charges/unbilled/orders` (the grid).

## What a clerk saw

Searched for one billing customer. The grid said **0 orders — "Nothing
unbilled."** The card above it said:

```
OUTSTANDING   THB 1,419.84   4 lines
   บริษัท ฟูจิทรานส์ (ประเทศไทย) …   THB 700.00
   บริษัท DMU LOGISTICS (THAIL…      THB 600.00
   ชื่อ บริษัท ซีต้าห์ โกลด์ โลจิสติกส์…   THB 119.84
```

Three payers and ฿1,419.84 outstanding for a search that found nothing, and
two of those payers are not the one that was searched for. It reads as a
screen showing made-up numbers. **It is not — the figures are real.** They are
the whole depot's outstanding, answered by a call that was never told about the
search:

| | call | filtered by |
|---|---|---|
| the grid | `/charges/unbilled/orders` | `BranchId` **and all 13 filters** |
| the card | `/charges/unbilled` | `BranchId` **only** |

So the card is right about the depot and wrong about the question, and the two
halves of one screen contradict each other.

## The ask

**`GET /api/revenue/charges/unbilled` should accept the same query as
`/charges/unbilled/orders`, and total exactly the lines that query selects.**

The web app already builds that query in one place (`unbilledParams`) and will
send the identical object to both calls:

```
BranchId          (as now)
AgentCode  ForwarderCode  CustomerCode
BookingTypeCode  OrderTypeCode  CarrierRef  MovementCode
PaymentTermCode  ChargeCode  Progress
VesselCode + Voyage   — or —   From + To
```

Same rule as the orders call: when a vessel or voyage is named the sailing
replaces the date range.

**With no filters the answer must not change** — the whole branch, exactly as
today. Nothing else about the shape changes: `asAt`, `lines`, `amount`, `tax`,
`total` and the `payers[]` breakdown stay as they are, each payer's `lines`,
`boxes`, `amount`, `tax` and `total` counting only the selected lines. A search
that selects nothing answers `lines: 0`, `total: 0`, `payers: []`, and the card
disappears on its own (`summary.data.lines > 0`).

## Why the screen cannot fix this by itself

Three reasons, so this is not pushed back as a UI job:

1. **The grid is paged.** It holds one page of orders, not every line. Summing
   the page gives a total that changes as the clerk pages, which is worse than
   a wrong one that at least stays still.
2. **The card counts LINES, the grid counts ORDERS.** One order carries many
   charge lines; the page rows cannot be added up into "4 lines".
3. **The payer breakdown is per payer across the whole selection**, which is
   the thing a credit controller reads the card for — and is exactly what is
   lost when only one page is in hand.

## Questions

1. Does `/charges/unbilled` already accept these and ignore them silently, or
   does it reject unknown query keys? If it already honours them, say so and
   the web app will simply start sending them — no API work at all.
2. `Progress` on the summary: the orders call uses it to pick what stage a line
   is at. Does it mean the same thing when the answer is a total?
3. Cost: the card is read once per search alongside the grid. If totalling the
   filtered set is expensive, say so and the screen will read it on demand
   (a "Totals" button) rather than on every search.

## Until then, on the screen

The card is **not** being hidden — the figures are true for the depot. The web
app will label it for what it is ("whole depot, not this search") the moment
this answer is known either way, and drop the label as soon as the call takes
the filters.
