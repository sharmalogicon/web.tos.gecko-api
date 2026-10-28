# Names, the booking number, and the coupon on an EIR — 2026-10-28

Three things a clerk looking at an EIR cannot see today, all for the same
reason: the gate reads return **codes and ids**, never the words the depot
actually uses.

---

## 0. ANSWERED — all of it shipped, 2026-10-28 (verified live)

The API built every field asked for in §3 (platform `b3642e7`, no DB script).
Probed against the local API as KORAKIT, admin@korakit.com:

| Claim | Probe | Result |
|---|---|---|
| `lineName` on the register | `GET /gate/transactions?branchId=KTC&pageSize=200` | 200 rows, **every** one has it; `APL`, `CHENG LIE`, and `NO-LINE` → "Customer-owned - no shipping line recorded" |
| names + refs on the detail | 25 details read | `lineName`, `customerCode`, `customerName`, `carrierRef`, `subBlNo`, `coupon` present on all 25 |
| Thai names survive | EIR-KTC-2610-00043 | customer 20210377 → `ดับเบิ้ล เอ (1991) จำกัด(มหาชน) (สำนักงานใหญ่)` |
| coupon, CASH | EIR-KTC-2610-00041 | `CAKTC261000010-1` · CASH · receipt `CAKTC261000010` |
| coupon, CREDIT | EIR-KTC-2610-00043 | `AUTO-BK-KTC-2610-00047-1-D85A6E` · CREDIT · `receiptNo` **null** |
| no coupon | EIR-KTC-2610-00042 | `coupon` null, `gateAuthorizationId` null |
| a split receipt | EIR-KTC-2610-00039 / 00040 | both paid on `CAKTC261000006`; `receiptNo` now `CAKTC261000008` / `CAKTC261000007` while `couponRef` still names the original |
| `haulierName` | `GET /gate/visits?branchId=KTC&pageSize=50` | on every row; 19 distinct hauliers resolved, Thai included; a visit with no haulier gives `null`/`null` |
| `lineName` on `transactions[]` | `GET /gate/visits/{id}` | present |
| null, never `""` | 200 transactions + 50 visits | no empty-string name anywhere |

**`receiptNo` is not the coupon's own number.** `couponRef` keeps naming the
receipt the cash was first taken on; `receiptNo` names the receipt that holds
the box now. After a split they differ, and `receiptNo` is the one to quote.

**Answers to the three questions:** (1) keep `lineName` on the registers — it
is one cached master-data read per page, not a join per row; (2) a coupon
revoked after it was spent sets `revokedAt`/`revokeReason` and the move still
stands, so never show a clean "yes"; (3) show the **visit's** haulier, not the
booking's — that is the truck that drove in.

**Only the GET detail is enriched.** The `POST /gate/transactions` and the void
answer still carry codes, which is why both re-read the EIR.

### Wired on the web side the same day

- EIR detail: Line and Haulier by name, a **Customer** row that could not exist
  before, Booking straight off the EIR (no longer via the visit), and "Paid by
  coupon" showing the ref, the channel, the live receipt and a revocation.
- EIR-In / EIR-Out registers: line names on the rows and in the CSV export.
- The per-party `GET /api/master/parties/{code}` lookups are gone; `PartyName`
  is now purely presentational.

---

## 1. What the screen showed before any of this

| Row | Shows | Should show |
|---|---|---|
| Booking | `BK-KTC-2610-00185` (Gecko's filing number) | the carrier's booking no, else the B/L, else the filing number |
| Line | `20261955` | the shipping line's name |
| Haulier | `20230149` | the transporter's name |
| Customer | *(absent — no gate read carries it)* | the customer's name |
| Paid by coupon | `yes` / `—` | which coupon, on what channel, against which receipt |

## 2. What was done on the web side first, before the API answered (superseded by §0)

- **Booking number.** `GET /gate/visits/{id}` already returns `CarrierRef` and
  `SubBlNo` on every `GateTransactionSummaryResponse` it lists, and the EIR
  detail already reads the visit. So the detail now leads with
  `carrierRef ?? subBlNo ?? orderNo`, with `orderNo` as the small second line —
  the same rule the registers have used since 2026-10-08. **No change wanted.**
- **Line and haulier names.** Resolved on the detail page with one
  `GET /api/master/parties/{code}` each, cached per path for the session. The
  code remains visible underneath, and stays as the only thing shown if the
  read fails. This works, and it is enough for ONE EIR.

**It was not enough for a register.** Fifty rows is fifty party reads. That is
what §3 asked for, and the API answered it the same day — the per-party reads
are gone and the registers show names. Kept here only as the record of why the
ask was made.

---

## 3. The prompt

> **Put the names and the coupon on the gate reads (web.tos ask, 2026-10-28)**
>
> The gate reads hand us codes only, so every screen either prints a generated
> party code at a clerk — `20261955` for a shipping line — or makes a
> round-trip per code to MDM. You already join the booking and the visit in
> these projections; the names are one more join away, on your side, once.
>
> **3a. `GateTransactionResponse`** (`GET /gate/transactions/{id}` — the EIR
> detail). Please append:
>
> ```csharp
> string? LineName        = null,   // the LineCode party's name
> string? CustomerCode    = null,   // booking.CustomerCode — we have NO source for this today
> string? CustomerName    = null,
> string? CarrierRef      = null,   // booking.CarrierRef — the summary has it, the detail does not
> string? SubBlNo         = null,
> ```
>
> `CarrierRef` and `SubBlNo` are the odd ones out: `GateTransactionSummary`
> has carried them since 2026-10-08 but the detail never did, so the detail has
> to read the whole truck visit to learn the booking number of the move it is
> already looking at. Appended, so existing readers are unaffected.
>
> **The customer is the one we cannot work around.** It is on the booking and
> nowhere in any gate read, and we are not going to `GET /bookings/{id}` from a
> gate screen for one field — that response carries every requirement and every
> container line on the booking.
>
> **3b. `GateTransactionSummaryResponse`** (the EIR-In / EIR-Out registers, and
> `transactions[]` on a visit). Please append `LineName`. That is the one the
> registers need; a per-row lookup is not an option there.
>
> **3c. `TruckVisitResponse`.** Please append `HaulierName` beside
> `HaulierCode`, for the same reason — it is read on every EIR detail and on
> the gate desk.
>
> **Which name?** Whatever MDM holds as the party's **local** name where there
> is one, falling back to English — that is the order the screens already use,
> and it is what is printed on the paperwork at a Thai depot. One field, your
> choice of which; we will not try to re-derive it.
>
> **3d. The coupon.** `GateTransactionResponse.GateAuthorizationId` is a bare
> `Guid?`, so the EIR detail can only say **yes** or **—**. A supervisor asked
> which coupon paid for a move cannot answer it from the EIR. You already have
> the shape — `GateCouponResponse(GateAuthorizationId, CouponRef,
> PaymentChannel, ValidUntil)` on the preflight. Please return it on the EIR:
>
> ```csharp
> GateCouponResponse? Coupon = null,   // the coupon this move was recorded against
> ```
>
> …with the receipt number on it if you have it to hand, since that is the next
> thing anyone asks. Keep `GateAuthorizationId` where it is; we will go on
> reading it and will simply show more when `Coupon` is there.
>
> **Three questions, please answer rather than assume:**
>
> 1. **Is a name on these reads a problem for you?** If the join is expensive
>    on the register query, say so and we will take `LineName` on the detail
>    only and keep codes on the register.
> 2. **The revoked coupon.** If a coupon is revoked AFTER it was spent at the
>    gate (`CouponHandler` logs a warning for exactly this), what should the
>    EIR show? We would rather say *"coupon CPN-… , revoked after it was
>    spent"* than go on showing a clean **yes**.
> 3. **`HaulierCode` on the booking.** `BookingResponse` has one and so does
>    the visit. If they disagree on a recorded move, which one is the truck
>    that actually came? We show the VISIT's, since that is who drove in.
>
> **Out of scope on purpose:** the party addresses, the tax id, and anything
> else on the party record. A name is all a gate screen needs; the party page
> is one click away for the rest.
>
> Don't change the UI; web.tos reads these as optional fields and keeps
> printing codes until they arrive.

---

## 4. What web.tos does the moment each lands

| Field | What changes |
|---|---|
| `CarrierRef` / `SubBlNo` on the detail | the detail stops depending on the visit read for the booking number |
| `LineName` on the detail | the per-party `GET` for the line goes away |
| `HaulierName` on the visit | the per-party `GET` for the haulier goes away |
| `CustomerCode` / `CustomerName` | a **Customer** row appears on the move card — it cannot before |
| `LineName` on the summary | the EIR-In and EIR-Out registers show names instead of codes |
| `Coupon` | "Paid by coupon" becomes the ref, the channel and the receipt |

---

Do not change anything in `D:\SHARMA\PROJECT\gecko\platform`; report API
problems back to the owner.
