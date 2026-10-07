# Booking Statement (Vector Cost Sheet) — BUILT and wired

**API shipped 2026-10-07 and running locally on http://localhost:5100. It is NOT
on Azure yet — the owner deploys that separately.** Every endpoint below was
verified against the live OpenAPI document on 2026-10-07 and the UI calls them
at the shapes shown.

## Verified: every request body matches, field for field

| endpoint | state |
|---|---|
| `POST /charges/{id}/price` + `DELETE` | wired · Vector's originalRate + discountType + discountRate |
| `POST /charges/{id}/waive` + `DELETE` | wired · reasonCode from the closed list |
| `POST /charges/waive` (bulk) | wired · all-or-nothing, max 500 |
| `POST /charges/{id}/lock` | wired |
| `POST /charges/regenerate` | wired · keepLocked / keepManual, shows noRate |
| `POST /charges/manual`, `POST /charges/bulk` | wired · remarks required, movement required on a box line, booking-level line is CREDIT only |
| `POST /invoices/send` | wired · CREDIT only, issued at once, no append |
| `GET /invoices`, `GET /invoices/{id}` | wired · `/billing/invoices` UNBLOCKED |
| `GET /charges/statement` 17 new fields | read |
| `GET /charges/unbilled/orders?includeSettled=true` | read · the register now shows billable / billed / unbilled |

---

## ONE MISMATCH — please confirm which is right

`GET /api/revenue/invoices/{invoiceId}` answers `InvoiceDetailResponse`, whose
`lines` point at **`InvoiceLineResponse`** — and that is the SUBSCRIPTION
billing line:

```
InvoiceLineResponse { invoiceLineId, description, quantity, unitPrice,
                      lineTotal, entitlementId }
```

`/api/subscription/invoices/{id}` resolves to the same type. The shape agreed
for a depot invoice was the charge line:

```
{ lineNo, chargeId, orderNo, containerNo, movementCode, chargeCode, chargeName,
  quantity, unitRate, amount, taxCode, taxRate, taxAmount, total }
```

**Why it matters:** a tax invoice that cannot name the container, the movement
or the charge code is not one a depot can send to a customer, and `entitlementId`
is a subscription concept with no meaning here.

It may simply be two same-named types colliding in the OpenAPI document while
the runtime is right. **The invoice page reads EITHER** (`lineView` in
`src/lib/api/invoices.ts`) and draws a column only when the data fills it, so
nothing breaks on the test round — but please say which it actually is.

## Smaller things, in passing

- **No due date anywhere.** `InvoiceSummaryResponse` has `issuedAt` and
  `paymentTermCode` but no due date, so the register and the document both drop
  June's "Due Date" column rather than compute one from a term we cannot read.
- **Still not built, and the screens do not pretend otherwise:** the invoice
  PDF, credit notes (`/billing/credit-notes` stays blocked), and recording a
  payment against an invoice.

## Tariffs — done, matches

Unapprove is gone from the UI (2026-10-06). An approved tariff is changed with
**New version** (`POST /tariffs/{id}/revise`), and a draft is approved in one
press where self-approval is allowed.

---

Do not change anything in `D:\SHARMA\PROJECT\gecko\platform`; report API
problems back to the owner.
