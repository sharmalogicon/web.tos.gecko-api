# Customer Cash Bill — BUILT

**Built 2026-10-08** against the API as it runs today. Every endpoint in the
brief exists and is bound; nothing on this screen is mocked.

```
GET  /api/revenue/cash-bills/lines?branchId=&customerCode=[&orderNo=]
POST /api/revenue/cash-bills                         → 201 ReceiptResponse
GET  /api/revenue/cash-bills/receipts/by-no/{receiptNo}
GET  /api/master/parties?search=&role=CUSTOMER       the customer search
GET  /api/master/parties/{partyCode}                 name, taxId, branchNo, contacts
POST /api/revenue/window/receipts/{id}/void          change a bill by voiding it
```

Screen: `/billing/cash-bills`. The saved bill is then read on the existing
`/billing/receipts/{receiptId}`, which already has Print PDF and Void.

## What the screen does

**Who it is made out to.** The party supplies the defaults; the clerk may change
any of them, because the `payer` is SENT and not looked up. "Choose address"
lists the party's registered address and then each contact's, with the default
contact preselected — `PartyContactResponse.address1/2, city, state, postcode`
joined into the text that gets printed.

**What is billed.** `GET /cash-bills/lines` for that customer, optionally
narrowed to one booking. Everything open is ticked by default; arriving from the
Booking Statement or Unbilled Orders with `?charges=` ticks exactly those. No
manual line entry, as in the desktop — a charge on no statement is added on the
booking statement first.

**What it comes to.** W/H tax NONE / 1% / 3% of the selling amount (before VAT),
nett = total − withheld. The payments must come to the nett, and the shortfall
is stated in money while the clerk is still ticking rather than discovered on
Save. A transfer, cheque or card is refused without a reference; only cash takes
a tendered amount.

**Saving.** `POST /api/revenue/cash-bills` with an `Idempotency-Key` held for the
whole bill, not per attempt — a 409 did not spend it, so correcting the ticks and
saving again is the same action, and a double-click cannot issue two receipts.
`expectedTotal` is the total the clerk was shown.

## Four things worth knowing on the API side

1. **`/cash-bills/lines` answers a bare array**, not the `PagedResultOf…`
   envelope every other list uses, and takes no `page`/`pageSize`. A credit-side
   customer with a year of open cash charges would return all of them in one
   payload. Fine today at KORAKIT's volumes; flagging it before it is not.

2. **No permission is declared** on `POST /api/revenue/cash-bills` or
   `GET /cash-bills/lines` in the published spec. The screen gates Save on
   **`revenue.cash.collect`** — the same permission the cash window uses, since
   this is the same act. Please confirm that is what the endpoint enforces; if it
   is something else, the Save button is offered to the wrong people.

3. **409 is not in the spec.** The brief says a 409 means "lines no longer open"
   or "amount changed", but `POST /cash-bills` publishes only `201` and `400`.
   The screen handles a 409 anyway — it re-reads the lines and says so — and
   shows a 400 as the server words it. No change needed if 409 is real; worth
   adding to the OpenAPI either way.

4. **`withholdingTaxRate` is a nullable double.** The screen sends `0`, `1` or
   `3`, never null. If the API would rather have null for "none", say so and it
   will send null.

## The Send to menu, after the owner's note of 2026-10-08

On the Booking Statement and on Unbilled Orders:

| Was | Now |
| --- | --- |
| New cash invoice → `POST /invoices/send` (always 400) | **New cash invoice → `/billing/cash-bills`**, then `POST /cash-bills` |
| Existing cash invoice | **removed** — a receipt is final; void and re-issue |
| New credit invoice | unchanged, `POST /invoices/send` |
| Existing credit invoice | unchanged (409 today) |

Nothing on either screen now calls `/invoices/send` with CASH, so the 400
"Cash is collected at the cash window" can no longer be reached by a clerk.

## Related, built the same day

**Split a gate receipt** — `POST /api/revenue/window/receipts/{id}/split`, bound on
both the cash window and the receipt page. Offered only when `issuedFrom === 'GATE'`,
`status === 'ISSUED'` and it was issued today, which mirrors the API's own 409.
Every line goes to exactly one part, each part gets its payer (customer *or*
haulier) and its payments, and the dialog shows the channel-by-channel check
against the original before it will send. The parts are all printed afterwards.
Two notes for the API side:

- `PaymentRequest` requires `tenderedAmount`, which the brief's payload omitted.
  The split sends `null` — a split moves money between receipts and gives no change.
- The brief's response description matched: 200 answers the new receipts, and the
  original then reads VOIDED with `splitIntoReceiptNos`. `/billing/receipts/by-no/{no}`
  was added so those numbers can be links.

**Paid in advance at the gate** — `tried[]` entries with `outcome === 'SETTLED'`
are listed under Payment details as muted rows with the API's own `note`, with no
amount on a waiver. They enter no total, and a box with everything prepaid reads
"Nothing to pay — paid in advance"; the Save already sends `payment: null` when
nothing is due.

## One thing still needed: the receipts register

`/billing/receipts` is now the **Cash Receipts** register, on
`GET /api/revenue/reports/receipts/list` — no new endpoint was needed. But each
row is missing three fields that `ReceiptResponse` already carries:

> **Prompt for the API:** add `issuedFrom` (GATE / WINDOW / CASH_BILL),
> `splitFromReceiptNo` and `splitIntoReceiptNos[]` to the rows of
> `GET /api/revenue/reports/receipts/list`.
>
> Without `issuedFrom` the register cannot filter "gate receipts of today",
> which is exactly the set that can be split — a clerk looking for the one to
> split has to open receipts one at a time to find out. Without the split pair,
> a split reads as an unexplained VOIDED row beside two receipts that look
> unrelated to it.

## Not built, and not offered

Editing a saved bill. It is voided and billed again — the voided lines come back
as open and reappear on this screen, which is the only honest way to do it while
the receipt is a tax document.

---

Do not change anything in `D:\SHARMA\PROJECT\gecko\platform`; report API
problems back to the owner.
