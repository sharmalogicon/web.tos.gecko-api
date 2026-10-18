# A walk-in box with no container number — 2026-10-18

> **BUILT on the API side, 2026-10-18** (platform, gecko_tos script 31) — see **§6** for the contract
> as built and the owner's answers to §3. The UI work in §4 is what remains.

**Owner, 2026-10-18: a walk-in truck can arrive with a box whose number cannot
be read or does not exist, and the gate has to be able to take it in.**

Today it cannot. `GateTransactionRequest.ContainerNo` is `[Required]`, so the
Save refuses the row. The UI has been left as it is — the number is still
mandatory on the screen — because making it optional in the UI alone would move
the refusal from the row, where the clerk can fix it, to the Save, with the
truck at the barrier.

---

## 1. Why "make the column nullable" is the wrong fix

The container number is not a field on a row. It is the **key that eight TOS
tables and Revenue join on**:

```
yard.container_visit        booking.booking_container    gate.gate_transaction
gate.box_reservation        hold.container_hold          gate.gate_authorization
survey.survey               reefer.reefer_power_session  revenue.container_stay
```

A null in it means, concretely:

- **Gate-out cannot find the box.** `/gate/walk-in-boxes` and the booking
  pickers all select by number.
- **The yard stock row has no identity** — `vw_container_in_yard` is keyed on it.
- **The EIR prints a blank** where the box goes.
- **A hold cannot be placed**, because `container_hold.container_no` is how a
  hold attaches to a box.
- **Nothing can charge it.** `revenue.container_stay` keys on the number.

A box nobody can release, hold, bill or print is not a box the depot has taken
custody of. So the ask is right but the obvious implementation is not.

---

## 2. What we propose instead: the gate issues a number

> **Prompt for the API:** let a walk-in row be saved with **no**
> `move.containerNo`, and have the gate **mint a placeholder** for it. Every
> join keeps working; the box is a first-class box from the moment it is taken
> in; the real number is set later by the renumber endpoint that already exists.

### 2.1 The request

`POST /api/tos/gate/trips`, a `walkIn` row only:

```json
{ "walkIn": { "fullEmpty": "EMPTY", "customerCode": "C0001", "lineCode": "MAEU" },
  "move": { "direction": "IN", "tripType": "DROP_OFF_CONT", "tareWeightKg": 2200 } }
```

- `move.containerNo` **omitted or null** — allowed **only** when the row is
  `walkIn` and `move.direction` is `IN`. A pick-up names a box that is already
  in the yard, so it always has a number; a booked row's box is on the booking.
- Anything else with no number stays a 400 on `rows[i].move.containerNo`.

### 2.2 The placeholder

The number has to satisfy the shape the rest of the system already enforces —
`^[A-Z0-9]{4,11}$`, `MaxLength(11)` — so it cannot be a sentence. We suggest:

```
NOID<branch-seq>      e.g.  NOID0001234      11 characters, unmistakable
```

Minted from a number series per branch, like `EIR_NO`. It must be:

- **Unique per tenant**, so nothing collides.
- **Obviously not a real box** — `NOID` is not a valid ISO owner code, and no
  line will ever stencil it.
- **Returned on the row result**, so the clerk sees what the box is now called
  and the EIR prints something they can quote.

### 2.3 Finding it again

The box behaves exactly like any other: it is in `/gate/walk-in-boxes`, in the
container inquiry, holdable, chargeable, releasable at the gate.

**When the real number is learnt, it is already solvable:**
`POST /api/tos/containers/{containerNo}/renumber`, built 2026-10-12, moves the
stays, EIRs, surveys, coupons, holds, reservations and Revenue's rows with it.
`NOID0001234 → MSKU1234565` is exactly what that endpoint is for.

One edge case to answer: today renumber **409s when the new number is already
in use** (in the yard, on a booking, held). A depot that mints a placeholder for
a box whose real number is *already* in the yard will hit that. Either the
message needs to name the clash, or the renumber needs a merge path. Our vote is
to name the clash and stop — a merge is a data decision nobody should make at a
barrier.

### 2.4 Response

The row result should say the number was minted, so the UI can tell the clerk
rather than leaving them to notice:

```json
{ "index": 0, "containerNo": "NOID0001234", "containerNoWasMinted": true,
  "orderNo": "BK-KTC-2610-00044", "status": "GATED", "eirNo": "EIR-KTC-2610-00051" }
```

---

## 3. Questions for the owner before it is built

1. **Is this really "cannot be read", or "has no number"?** They want different
   answers. A number that exists but is unreadable wants a placeholder and a
   renumber later. A box that genuinely has none — a locally-built or
   shipper-made unit — keeps the placeholder for life, and the depot needs to be
   able to put a label on it.
2. **Should the gate force a survey on these?** A box arriving unidentified is
   the one most worth photographing. `requireSurvey` already exists per step.
3. **Does the placeholder belong in the registry?** We think not — it is a gate
   fact, not master data — but if it is to be labelled and reused, it does.
4. **Who may do it?** Taking in an unidentified box is a decision with
   consequences. A permission (`tos.gate.override`, already used for the
   check-digit override) or at least a required reason would be reasonable.

---

## 4. What the UI will do once it exists

- The container number stops being mandatory **on a walk-in drop-off only**, and
  shows "a number will be issued" rather than an empty required field.
- The row result's minted number is shown on the card and on the saved row, so
  the clerk can write it on the box.
- The Container Master's **Correct number** already does the rest.

Nothing is built on the UI side yet; the field is still mandatory, which is the
honest state until the API can accept the row.

---

Do not change anything in `D:\SHARMA\PROJECT\gecko\platform`; report API
problems back to the owner.

---

## 5. The prompt, to hand to the API side

> **Walk-in gate-in without a container number (web.tos ask, 2026-10-18)**
>
> A walk-in truck can arrive with a box whose number cannot be read, or which
> has none. `POST /api/tos/gate/trips` refuses the row today because
> `GateTransactionRequest.ContainerNo` is `[Required]`. The gate needs to take
> the box in.
>
> **Do not make `container_no` nullable.** Eight TOS tables and Revenue join on
> it — `container_visit`, `booking_container`, `gate_transaction`,
> `box_reservation`, `container_hold`, `gate_authorization`, `survey`,
> `reefer_power_session`, `revenue.container_stay`. A null there is a box that
> cannot be released at the gate, held, billed, or printed on an EIR.
>
> **Instead, let the gate mint one.**
>
> 1. On `POST /api/tos/gate/trips`, accept a row whose `move.containerNo` is
>    null or absent **only when** that row is a `walkIn` AND
>    `move.direction == "IN"`. Every other row keeps the current 400 on
>    `rows[i].move.containerNo`.
> 2. Mint a placeholder from a per-branch number series, as `EIR_NO` is minted.
>    It must satisfy the existing shape `^[A-Z0-9]{4,11}$` and must not look
>    like a real box. Suggested: `NOID` + a 7-digit sequence — `NOID0001234`.
>    `NOID` is not a valid ISO owner code, so it can never collide with a
>    stencilled number.
> 3. The box is then **ordinary in every respect** — it appears in
>    `/gate/walk-in-boxes`, in the container inquiry and in yard stock; it can
>    be held, charged and released like any other.
> 4. Return it on the row result so the clerk can write it on the box:
>    `{ "containerNo": "NOID0001234", "containerNoWasMinted": true, … }`.
>    Add `containerNoWasMinted` to `TripRowResult`; the UI will show it.
>
> **The real number later** is already solved —
> `POST /api/tos/containers/{containerNo}/renumber` (2026-10-12) moves the
> stays, EIRs, surveys, coupons, holds, reservations and Revenue's rows.
> `NOID0001234 → MSKU1234565` is exactly its job. **One thing to settle:**
> renumber currently 409s when the target number is already in the yard, on a
> booking or held. A depot that minted a placeholder for a box whose real number
> is already in the yard will hit that. Our vote is to keep the 409 and name the
> clash rather than add a merge — merging two box histories is not a decision to
> take at a barrier.
>
> **Four questions we could not answer from the code**, in §3 of
> `WALK_IN_NO_CONTAINER_NO_FOR_API.md`: whether the number is unreadable or
> genuinely absent (they want different lifetimes for the placeholder), whether
> these boxes should force a survey, whether the placeholder belongs in the
> master-data registry, and whether taking in an unidentified box should need a
> permission or a reason.
>
> **Tests we would expect:** a walk-in drop-off with no number mints one and
> gates; the same row as a booked box, or as a pick-up, or as `blind`, still
> 400s; two minted boxes on one truck get different numbers; a minted box is
> returned by `/gate/walk-in-boxes`; renumbering a minted box to a real number
> moves its stay and its EIR.

---

## 6. As built (API, 2026-10-18)

**Owner's answers to §3:**

1. Unreadable or absent — both handled the same way: the NOID number stays until the
   Container Master's **Correct number** replaces it; a box that never had one keeps it.
2. **No forced survey** — the walk-in order type's normal survey rule applies.
3. **Not in the registry.** The NOID number is a gate fact. When it is renumbered, the
   real number is registered (or found, if the box is already known).
4. **Nothing extra** — no reason and no permission. Any clerk who can gate in can do it.

**The contract:**

- `POST /api/tos/gate/trips`: a row with `walkIn` and `move.direction = "IN"` may omit
  `move.containerNo` (or send null / ""). `walkIn.equipmentTypeCode` and `walkIn.lineCode`
  are then required — there is no registry entry to take them from (400 on
  `rows[i].walkIn.equipmentTypeCode` / `rows[i].walkIn.lineCode`).
- Every other row with no number is still a 400: a walk-in **pick-up** on
  `rows[i].move.containerNo`; a **booked** or **blind** drop-off on `rows[i].move.ContainerNo`.
- The number: `NOID` + 7 digits (`NOID0000001`), from a tenant-wide series (`NO_ID_BOX`), so
  it is unique across all depots of the tenant. Two boxes on one truck get two numbers.
  A retried Save returns the same numbers.
- Each row result carries **`containerNoWasMinted: true`** and `containerNo` = the NOID
  number; the EIR prints it.
- From then on it is an ordinary box: `/gate/walk-in-boxes`, the inquiry, yard stock,
  holds, charges, gate-out. The check-digit and "unknown container" settings do not refuse it.
- `POST /api/tos/containers/{NOID…}/renumber` with the real number moves the stay, EIRs,
  surveys, coupons, holds, reservations and Revenue's rows, and registers the real number.
  It still answers **409 when the real number is in the yard, on a booking or held**
  ("Renumbering would merge two boxes") — §2.3's vote.
- A depot whose tenant has no `NO_ID_BOX` series answers **409** "This depot has no number
  series for a box with no number" — key the number instead.
