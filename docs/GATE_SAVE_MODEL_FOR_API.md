# Gate In and Gate Out on one save model — what the Gate Out build needs

2026-10-06, while the Gate Out API is being written. The UI is about to put
**both** gate screens on §24: Record reserves the place and prices it, Save
commits the whole truck. Four things decide whether Gate Out can join Gate In on
that model, and the first one is the only hard blocker.

---

## 1. BLOCKING — `TripSaveRequest` needs `truckVisitId`

`POST /api/tos/gate/trips` takes `truck` and has no way to name an existing
visit, so every Save opens a new one.

Gate In survives that: a truck arriving has no visit, so opening one is right.
**Gate Out does not.** A truck standing in the yard already has a visit, and
joining it is the ordinary case — today every Save would give one arrival a
second visit, and the yard's move count is wrong from that moment.

Proved 2026-10-05: same `draftId`, same truck, a second Save after fixing a
refused row produced `TV-…-A` and `TV-…-B`, and `GET /gate/visits?Search=70-2957`
answered `totalCount: 2`.

Either will do:

- **(a)** optional `truckVisitId` on `TripSaveRequest`; when present the rows join
  that visit; or
- **(b)** the server reuses the open visit it already has for this `draftId` —
  `draftId` is already in the request and already identifies the truck being
  keyed.

**(b)** is cleaner and needs nothing from us. Without one of them Gate Out has to
stay on the per-box `POST /gate/transactions`, and the two gate screens end up
with different save models — which is how a clerk learns one screen and
mis-keys the other.

---

## 2. `POST /gate/transactions` does not honour a reservation

Tested today:

```
POST /gate/reservations  { bookingContainerId: <empty place>, containerNo: GCKU2964180 }
  → 201, place held

POST /gate/transactions  { containerNo: GCKU2964180, … }
  → 409  NO_ASSIGNMENT  "…is not on an open booking."
```

§24.3 says the Save writes the number onto the place and the UI must not PUT the
booking line first. That is true of `/gate/trips` — but the single-box POST still
refuses, so a screen on the old path cannot use §24 at all.

**Please say which you intend:**

- **(a)** `/gate/trips` is the only save path for a booked box, and
  `/gate/transactions` stays for walk-ins and corrections only — we will move
  both screens over and stop using it; or
- **(b)** `/gate/transactions` should honour a held reservation the same way, in
  which case say so and we keep it as the single-box path.

We are building for **(a)** unless told otherwise.

---

## 3. Confirm §24 applies to OUT rows on the Save

§24.7 says `LOAD_MISMATCH` and `NOT_IN_YARD` come from preflight and from Record,
and that the Save refuses them too. Please confirm for `/gate/trips` rows with
`tripType: PICK_UP_CONT`:

- the yard rules of §24.1 are enforced on the Save, not only at Record;
- `PLACE_SWITCHED` auto-move applies to a pick-up place as it does to a drop-off;
- `POST /gate/reservations` accepts a place whose next step is an OUT move.

If a pick-up place behaves differently from a drop-off place in any of these,
say how — the screen shows the same row for both.

---

## 4. Two small ones

- **`ALREADY_GATED`** (§24.4) — confirm it comes back from `/gate/trips` rows as
  well as from `/gate/transactions`, so the row can be shown refused and the box
  re-read rather than the whole Save failing.
- **Departing.** Gate Out closes the visit with
  `POST /gate/visits/{id}/depart`. If the Save can also depart a visit when the
  truck is leaving for good, say so and we will do it in one call instead of two.

---

## Why both screens together

The yard rules, the findings, the auto-move and the refusal codes are identical
for a box coming in and a box going out. Building them twice, in two idioms,
against two save models, would mean writing the same careful handling twice and
getting it subtly different — and a gate clerk moves between the two screens all
day.

With `truckVisitId` in, both go on §24 together and the difference between them
is only the direction of the move, which is what it should be.

---

Do not change anything in `D:\SHARMA\PROJECT\gecko\platform`; report API
problems back to the owner.
