# POST /api/tos/gate/trips — three findings from testing it

Tested against the running API on 2026-10-05, straight after it shipped. The
endpoint works and most of it is right: one call, one visit, per-row EIRs,
blind orders raised inline, and the Idempotency-Key genuinely replays
(same key twice → same `tripSaveId`, nothing gated twice). The booking search,
the reservations and `/window/preview` all behave.

Three things differ from what was agreed, and the UI cannot be finished until we
know which way each goes.

---

## 1. It is not all-or-nothing — a bad row leaves the good ones committed

Agreed point 1 was: *"if trip 2 hits a hold, **nothing is written** and the 409
names the trip."* What actually happens is a **201 with partial commit**.

Two rows, the second missing its weights:

```
POST /api/tos/gate/trips  → 201
  rows[0] GCKU1113695  GATED      EIR-KTC-2610-00019
  rows[1] GCKU4906516  NOT_GATED  "tareWeightKg: A drop-off records the box's
                                   tare weight. maxGrossWeightKg: …"
```

Checked afterwards: the good box **is** gated, and the visit **is** open.

**This may well be the better behaviour** — a truck with three boxes and one
hold should arguably not be stuck at the barrier for the two that are fine. But
it is the opposite of what was agreed, and it changes the screen: a partial
result needs per-row status, a "2 of 3 gated" message, and a second Save that
sends only what is left.

**Please confirm which it is.** If partial is deliberate, say so and we will
build for it — it is no harder, it just has to be the stated contract rather
than something we discovered.

---

## 2. A row that does not gate still leaves its blind order behind

This is a defect on either answer to #1.

In the run above, row 1 was `NOT_GATED` — and it still came back carrying
`"orderNo": "BK-KTC-2610-00033"`. The BLIND GATE IN was created, the box was
never gated, and nothing cleans the order up. Every refused row leaves one.

Agreed point 2 was exactly this: *"a box with no booking needs its BLIND GATE IN
raised as part of the same atomic save … a failed gate POST leaves an orphan
order behind with no box ever gated."*

Please roll the blind order back with its row, or create it only once the move
is accepted.

---

## 3. A retry opens a SECOND visit for the same truck

The worst of the three, because it silently corrupts the yard's idea of what
arrived.

Same `draftId`, same truck, new Idempotency-Key, resending both rows with the
bad one fixed:

```
save 1  → visit TV-…-A   rows[0] GATED, rows[1] NOT_GATED
save 2  → visit TV-…-B   rows[0] NOT_GATED (correctly: its step is done now)
                         rows[1] GATED
GET /gate/visits?Search=70-2957  →  totalCount: 2
```

**One truck arrival, two truck visits.** The retry had no way to join the first:
`TripSaveRequest` has `truck` but **no `truckVisitId`**, so every save opens a
new visit.

Two ways out, your choice:

- **(a)** `TripSaveRequest.truckVisitId` — optional; when sent, the rows join
  that visit instead of opening one. The UI holds the id from the first
  response.
- **(b)** The server reuses the open visit it already created for this
  `draftId`. `draftId` is already in the request and already identifies the
  truck being keyed, so this needs nothing new from us and is probably the
  cleaner fix.

Related, and worth deciding at the same time: `rows[0]` on the retry was refused
with *"MTY_OUT (step 2) is still pending and required"* — which is correct and
safe, but it means a resend of an already-gated row reads as a failure rather
than as "already done". A `status: "ALREADY_GATED"` would let the screen show it
as settled rather than as a problem the clerk must fix.

---

## What the UI does meanwhile

Nothing is built on `/gate/trips` yet. Gate In still commits one box per Record,
as it does today, until #1 is confirmed and #2 and #3 are fixed — building the
new flow on top of a double-visit bug would put bad data in KORAKIT's yard.

Everything else is ready to wire the moment these land: `bookable-boxes`,
`/gate/reservations` and `/window/preview` are all tested and behaving.
