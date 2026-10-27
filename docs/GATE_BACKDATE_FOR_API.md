# Back-dating a gate transaction — 2026-10-27

A clerk keying last night's paper this morning needs to say when the truck was
actually at the barrier.

## The rule changed on the day it was built

The first ask was a flat **24-hour** window. On seeing it the owner replaced it
(same day) with the rule that actually matters:

> **A move may be dated as far back as the paper goes — but never before that
> container's own last recorded movement. A container with no history may be
> dated anything.**

The 24-hour cap was the wrong shape twice over. It **refused** a depot catching
up on a week of paper, which is the case back-dating exists for. And it
**allowed** the one back-date that genuinely corrupts data: a move dated behind
its own predecessor, which reorders the box's history. Everything read off that
order — where the box stands, how long it has been there, what storage is owed,
which EIR is current — is then computed from a sequence that never happened.

Twenty-three hours back is fine if the box has been in the yard a month. Ten
minutes back is wrong if the box was gated out five minutes ago.

---

## 0. ANSWERED — the API shipped it, 2026-10-27 (verified live)

Probed against a running API and the real fixture data, not taken on trust.

**`lastMovementAt` is on the preflight.** §3c is done. It carries a value
for a box that has LEFT the yard, which is the case the old `inYard` fallback
could never see:

```
container      inYard      lastMovementAt                      old fallback
ZZKU9807207    null        2026-10-06T08:30:13+00:00           null   <- missed it
MRKU4000640    null        2026-09-22T18:41:00+07:00           null   <- missed it
ZZKU2070205    present     2026-10-06T08:25:34+00:00           same
ZZZU0000001    null        null  (no history)                  null
```

**What the instant actually is**, from the API owner’s reply (2026-10-27), which
corrects a guess made here from reading `BarrierReader.cs`:

| the box is… | `lastMovementAt` is |
|---|---|
| in the yard on an open stay | that stay’s last event — the gate-out rule |
| not in the yard | its last COMPLETED gate-out, **at any branch of the tenant** — the gate-in rule |
| never moved | `null` |

**§3c.1 answered — and it is wider than gate moves.** The gate moves, plus
anything that stamps the open stay’s last event: **a survey, a reefer reading, a
yard or Container Master change**. A **voided EIR does not count**.

Two things follow for the screen, both already true of it:

- The refusal says *"already has a movement at"*, not *"was last gated at"*. That
  wording is right as it stands — a survey is a movement for this purpose, and
  a clerk told "gated" would go looking for an EIR that does not exist.
- **The constraint can come from another branch.** A box gated out at Laem
  Chabang limits a gate-in keyed at Korakit. The screen needs no change for
  that, because the server does the reasoning and the preflight carries the
  answer — but it is worth knowing before someone calls it a bug.

**§3c.2 answered — it is free.** The barrier already reads the open stay, and
the last gate-out is one indexed `max`, read only when the box is not in the
yard. No second endpoint, which was the one thing we asked it not to be.

**The refusal is `BEFORE_PREVIOUS_MOVE`** (BLOCK), in two mirrored rules:
`BeforePreviousMove` for an out, `InBeforeLastOut` for an in.

**EQUAL IS REFUSED, which is not what this document originally asked for.** We
wrote "equal is allowed — two events can share a timestamp"; the API shipped
`at > previousMoveAt`, strictly later, **and the owner has since confirmed it in
writing and asked for the screen to match** (2026-10-27). It does: the same
instant would otherwise pass the screen and be refused at the POST. Recorded
here so nobody later "fixes" the UI back to the original request.

One consequence worth knowing: a stored instant has seconds and the picker has
none, so a box that last moved at 14:00:13 refuses a keyed 14:00. The refusal
therefore names the first whole minute that is genuinely accepted (14:01)
rather than quoting 14:00 and sending the clerk round again.

**THE WINDOW WAS NOT REMOVED — it was moved to the depot, which is better
than what we asked for.** We asked for the 24-hour cap to go. The API made it
`gate.max_backdate_hours` per branch, `DefaultMaxBackdateHours = 24` only where
nobody has set it, with `FutureGrace` of 5 minutes — and exposed both to us:

```
GET /api/tos/gate/settings?branchId=...
{ "branchId": "...", "maxBackdateHours": 2400, "futureGraceMinutes": 5 }
```

That answers question 5 (an upper bound — yes, the depot’s own) and is the
same shape as the capture rules: the depot decides, the screen asks. **The
fixture branch is set to 2400 hours (100 days).** A depot that has never been
configured still gets 24 hours, so please tell the owner which value KORAKIT
should carry — unset means 24, and the screen will say so honestly.

The UI read no window at all until this was found, which would have let a clerk
key nine days back on an unconfigured depot and be refused by the POST. Fixed:
`GET /gate/settings` is now read when the gate screen opens, and it drives the
picker’s floor, the hint and the Save guard.

**Still open:** question 3 (what the back-date drives — free-time / storage
clock, cut-off) and question 4 (a `tos.gate.backdate` permission).

---

## 1. Is it possible? Yes — the field already exists

```ts
// src/lib/api/tos.ts
export interface GateTransactionRequest {
  ...
  transactionAt?: string | null;   // <- already on the contract
}
// and TripRow.move IS a GateTransactionRequest, so every row of the trip
// Save carries it too. TripTruck additionally has arrivedAt.
```

Nothing had to be added. **web.tos simply never sent it**, so the server
stamped its own clock on every move. It does now.

---

## 2. Done on the web side (2026-10-27)

- `TruckDetails.transactionAt` — a `datetime-local` value, on the TRUCK, not on
  a row: one truck is at the gate once, and every box it carries was there at
  the same moment.
- Defaults to the clerk's own clock. `localInputValue()` in `src/lib/format.ts`
  builds it from local parts — **not** `toISOString().slice(0,16)`, which is
  UTC and would open the box 7 hours behind the wall in Bangkok.
- **The floor is the depot's.** `backDateIssue()` refuses blank, unreadable,
  the future (by the server's own `futureGraceMinutes`, 5) and anything older
  than the branch's `gate.max_backdate_hours`. No number is hard-coded here;
  before the settings call answers, the screen imposes no window rather than
  guessing one it might have to retract mid-keying.
- `beforeLastMoveIssue(move, transactionAt)` is the new rule, **per row**: it
  compares the truck's clock against `preflight.inYard.lastEventAt` for that
  box, blocks *Add trip*, and holds the Save through `blockedReason`.
- Sent as `move.transactionAt` on every row and `truck.arrivedAt` on the visit,
  computed ONCE per Save so twelve boxes cannot land seconds apart.
- Frozen once the visit is open — the server owns the arrival time by then.

- `GatePreflight.lastMovementAt` is read first, falling back to
  `inYard.lastEventAt` for an older API. **It is live — see §0 — so the lane
  check is now complete:** a box gated out last week is caught at the lane
  instead of one POST later. The server still holds the full history and
  remains the authority.
- `beforeLastMoveIssue` demands **strictly later**, matching the server, and
  names the earliest minute the clerk can actually key.
- **The `inYard.lastEventAt` fallback is kept deliberately, and it is dead code
  against a current API.** The owner called it optional (2026-10-27): against
  today’s API `lastMovementAt` always answers. It stays because this is a live
  cutover and the deployed API can lag the one on a developer’s machine — one
  `??` is a cheap insurance against a screen that silently stops checking.
  Delete it once prod and local are known to be the same build.

Run against the real functions, 2026-10-27:

```
THE DEPOT'S WINDOW (live settings)        THE BOX'S OWN LAST MOVEMENT
                 2400h   24h    0h         no history       -> ok (anything)
  1 hour ago     ok      ok     refused     1 min after      -> ok
  25 hours ago   ok      refused refused    the same minute  -> REFUSED (server is strict)
  99 days ago    ok      refused refused    1 minute before  -> REFUSED
  101 days ago   refused refused refused    the quoted minute-> ok  (advice is keyable)
  3 min ahead    ok      ok     ok
  6 min ahead    "in the future" (5 min grace, the server's own)
```

---

## 3. The prompt

> **Back-dated gate transactions: refuse a move that precedes the box's own
> last movement (web.tos ask, 2026-10-27)**
>
> web.tos now sends `transactionAt` on every gate transaction (and `arrivedAt`
> on the truck visit). A clerk may wind it back with no fixed window, because
> depots key paper days late. Please make the server enforce the one rule that
> keeps a container's history in order.
>
> ### 3a. The rule
>
> For each row of the gate transaction / trip save, given `transactionAt`:
>
> 1. Find that container's **latest recorded movement** — the most recent gate
>    transaction, and anything else that moves the box in time (a yard move, a
>    repair, a survey, a stuffing — whatever your event model treats as
>    sequencing a container; **please tell us which you used**).
> 2. If `transactionAt` is **earlier** than that, refuse the row.
> 3. If the container has **no previous movement**, accept any
>    `transactionAt` that is not in the future.
>
> **Equal is allowed** — two events can share a timestamp.
>
> ### 3b. The refusal
>
> Please key it to the row and the field so it lands on the right box, with a
> finding code we can switch on:
>
> ```json
> {
>   "status": 400,
>   "errors": {
>     "rows[2].move.transactionAt": [
>       "GESU1234567 already has a movement at 20/10/2026 09:30. The gate date and time cannot be before it."
>     ]
>   }
> }
> ```
>
> Code suggestion: `BACKDATE_BEFORE_LAST_MOVE`. **Please include the offending
> timestamp and the container number in the message** — a clerk who is only told
> "too early" has to go and look it up, and the screen cannot always compute it.
>
> One truck's clock covers every box on it, so a trip save with twelve rows may
> fail on one box alone. Keying the error by row index lets us put the message
> on that row rather than failing the whole truck anonymously.
>
> ### 3c. Send the last movement on the PREFLIGHT — please treat this as part
> of the ask, not a nice-to-have
>
> ```
> GET /api/tos/gate/preflight?branchId=&containerNo=&direction=
>
> {
>   ...,
>   "lastMovementAt": "2026-10-20T09:30:00Z"   // <- NEW. null = no history at all
> }
> ```
>
> **Why the preflight and not a new endpoint.** The gate already calls preflight
> the instant a clerk finishes keying a container number — that is where the
> holds, the booking, the step and the yard position come from. Putting the last
> movement in that same answer costs **no extra round trip**: the screen gets it
> with everything else it already waits for, and can refuse a bad date while the
> clerk is still looking at the box. A separate lookup would mean a second call
> per container, on every row, on a screen that often has twelve.
>
> **It must not be `inYard.lastEventAt`.** We use that today as a stand-in and it
> is the wrong value: it is the last event of the visit the box is on *now*, and
> it is **null for a box that is not in the yard** — which is precisely the
> returning box whose history matters. A box gated out last week is invisible to
> it, so the screen passes a move the server then refuses, and the clerk finds
> out after the POST instead of at the lane.
>
> **`lastMovementAt` must be the same clock the refusal in 3a compares against.**
> If the two differ by so much as a rounding, the screen will wave through moves
> the server rejects — which is worse than not checking at all, because it
> teaches a clerk the screen cannot be trusted. Whatever §3c.1 decides counts as
> a movement, this field reports.
>
> Null when the container has no recorded movement, so the screen can tell
> "no history, anything goes" from "not answered yet".
>
> ### 3c. Questions
>
> 1. ~~**Which events count as "a movement"?**~~ **ANSWERED** — the gate moves
>    plus anything stamping the open stay's last event (survey, reefer, yard /
>    Container Master); a voided EIR does not count. See §0.
> 2. ~~**Anything that stops `lastMovementAt` being cheap?**~~ **ANSWERED** — it
>    is free, and there is no second endpoint. See §0.
> 3. **What does the back-date drive?** Specifically: the EIR date, `gateInAt`,
>    the **free-time / storage clock**, and the cut-off check. If the storage
>    clock runs from `transactionAt`, back-dating moves money, and that is worth
>    knowing before a depot does it routinely.
> 4. **Should back-dating need its own permission?** A `tos.gate.backdate`
>    right, say, with the plain gate clerk limited to "now". The owner has not
>    asked for one; we raise it because re-dating a move is the kind of thing
>    that is usually supervised. Your call.
> 5. **Is there an upper bound you want anyway?** We removed ours. If finance
>    wants "not into a closed accounting period", that is a real rule and we
>    will show it — but it has to come from you, not from the screen.
>
> Don't change the UI; web.tos already sends the field and blocks what it can
> see.

---

## 4. Not done, on purpose

`gate/desk` and `gate/eir-in-sept` send no `transactionAt` and stay on "now".
They are the older single-box screens; the owner asked for this on the Gate In
that KORAKIT actually uses.

---

Do not change anything in `D:\SHARMA\PROJECT\gecko\platform`; report API
problems back to the owner.
