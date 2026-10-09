# Re-issue a gate receipt to a different customer — ONE LINE OF API

**Asked 2026-10-08.** The web UI is built and waiting; this is the only thing
blocking it.

## The change

`platform/Gecko.Revenue/Endpoints/Window/ReceiptSplitEndpoints.cs`, in
`SplitAsync`:

```csharp
// now
if (parts.Count < 2) Add("parts", "Split into two parts at least.");

// asked
if (parts.Count < 1) Add("parts", "A split needs a part at least.");
```

Nothing else. No new endpoint, no new contract, no migration.

## Why

A gate receipt is taken for the whole truck in one go, and it is routinely made
out to the wrong party — the haulier when it should be the customer, or the
customer when the haulier is paying. On a receipt with **two or more charges**
the clerk fixes that today by splitting it. On a receipt with **one charge**
there is nothing to divide, so `parts.Count < 2` refuses, and the only remedy
left is **void and take the money again** — asking a driver to hand over ฿214 a
second time to correct a typing error. That is the whole problem.

A **one-part split is the re-issue**: every line, a new `payerPartyCode` and
`payer`, the same payments. The original is voided naming its replacement, the
drawer does not move, and the audit trail is the one that already exists.

## Every other guard already holds for one part — traced, not assumed

| Guard (line) | With `parts.Count == 1` |
| --- | --- |
| `"A line is in two parts."` | passes — one part, no overlap possible |
| `"Every line goes to one part."` | passes — the single part holds all of them |
| `"A part has a line at least."` | passes |
| per-channel money check | passes — the one part takes exactly what the original took |
| `WithholdingTax.MayApply(total)` | unchanged; the total is the original's |
| `master.PartiesAsync(codes)` | unchanged; one code instead of two |

And the write path needs nothing:

- `PayerPartyCode = partyCode ?? original.PayerPartyCode`, `PayerName` from
  `part.Payer?.Name` — **this is the rename.**
- `SplitFromReceiptId = original.ReceiptId` — lineage kept.
- `charge.PayerPartyCode = partyCode` — the charges follow, so the booking
  statement shows the corrected customer too, not just the receipt.
- the original goes `VOIDED` with `VoidReason = "Split into CAKTC261000005"`.
- the response is the usual `IReadOnlyList<ReceiptResponse>`, of length 1.

## Optional, your call

With one part the void reason reads *"Split into CAKTC261000005"*, which is
accurate but reads oddly for a rename. If you would rather it said
*"Re-issued as CAKTC261000005"* when `issued.Count == 1`, that is a second line
in the same method. The UI does not depend on it either way — it shows
`voidReason` as the server wrote it.

## What the UI does the day this ships

The existing Split dialog already carries the party picker (customer and
haulier), the address chooser and the money check. On a one-charge receipt it
switches to:

> This receipt has one charge, so it cannot be divided — but you can change who
> it is made out to.

…the payer picker, and a **Re-issue to this customer** button that sends one
part holding every line, the new payer, and the original's payments unchanged.

Until then the dialog says the receipt cannot be split and sends nothing.

---

Do not change anything in `D:\SHARMA\PROJECT\gecko\platform`; report API
problems back to the owner.
