# Invoices: filter by payer type — 2026-10-20

The invoice register now shows **Payer type** as its own column — the payer's
role, not the party: CUSTOMER, SHIPPING LINE, HAULIER, FORWARDER. The labels
come from `GET /api/revenue/lookups` → `billToRoles`, so a tenant that adds a
role gets it with no release.

**The filter is the missing half.** `GET /api/revenue/invoices` takes
`branchId`, `payerCode`, `orderNo` and `Search`. There is no `billTo`.

The UI is wired for it already: `InvoiceQuery.billTo` exists and
`invoicesPath()` sends `billTo=` when it is set. The control is deliberately
**absent from the filter panel** until the API can honour it — see §2.

---

## 1. The prompt

> **Invoices: filter by payer type (web.tos ask, 2026-10-20)**
>
> `GET /api/revenue/invoices` (`InvoiceEndpoints.ListAsync`) takes `branchId`,
> `payerCode`, `orderNo` and `Search`. Add **`billTo`**, the payer's role — a
> soft reference to `lookup.bill_to_role`, the same vocabulary
> `GET /api/revenue/lookups` returns as `billToRoles`.
>
> ```csharp
> private static async Task<…> ListAsync(
>     [AsParameters] ListQuery query, RevenueDbContext db, ICallerPermissions scope, CancellationToken ct,
>     Guid? branchId = null, string? payerCode = null, string? orderNo = null, string? billTo = null)
> …
> if (!string.IsNullOrWhiteSpace(billTo)) rows = rows.Where(i => i.BillTo == billTo.Trim());
> ```
>
> Same shape as the existing `payerCode` filter — one parameter, one `Where`.
> `Invoices.BillTo` is already on the row and already returned on
> `InvoiceSummaryResponse`, so nothing else changes.
>
> An unknown role should return an empty page rather than a 400: the UI builds
> the options from the lookup, so a value it sends is one the tenant has.
>
> **While you are in there**, `GET /api/revenue/charges/unbilled` takes only
> `branchId` (see §3) — a separate ask, same register.
>
> Don't change the UI; web.tos will pick it up.

---

## 2. Why the control is not shipped yet

The register is **paged on the server** — 25 a page. A filter applied on the
client would narrow the page in front of the clerk and leave page 2 untouched.
With four invoices on one page that looks like it works; the day there are
thirty it quietly stops being a filter and becomes a highlighter, with nothing
on screen to say so.

Owner's call, 2026-10-20: wire it and wait rather than ship something that is
right only while the data is small.

The day `billTo` lands, the control is one `FilterField` in
`src/app/billing/invoices/page.tsx` — the options, the label and the query are
all already there.

---

## 3. Related, not the same

`GET /api/revenue/charges/unbilled` — the **Outstanding** card on Unbilled
Orders — also takes `branchId` alone, while the list beneath it
(`/charges/unbilled/orders`) takes the whole filter form. So the card is a
depot-wide total sitting above a filtered list, and the two disagree whenever a
filter is set. Raised separately with the owner; fixing it means teaching
`/charges/unbilled` the same parameters its `/orders` sibling already takes.

---

Do not change anything in `D:\SHARMA\PROJECT\gecko\platform`; report API
problems back to the owner.
