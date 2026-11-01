# Who did it — the container's activity log — 2026-11-01

**Screen:** `web.tos` → Units → Container master → **Activity log**.
**Reads it merges:** `/api/tos/containers/{no}/story` (visit events),
`/api/tos/gate/transactions` (EIRs), the container's holds, and
`/api/master/equipment/{id}/history` (the registry row).

## 0. ANSWERED — the names shipped, 2026-11-01

Every field below is live: `eventByName` on visit events, `createdBy` /
`createdByName` and `voidedBy` / `voidedByName` on gate moves (list and
detail), and `appliedBy(Name)` / `releasedByName` on holds. All additions;
nothing existing changed.

The rule the screen was built on is confirmed:

- **id null** = no person did it → *System activity*.
- **id present, name null** = a person this tenant does not list (a desktop
  migration) → the id, not the system.
- Existing Azure data was checked: every gate move has a creator, every visit
  event has a user, and the only applier-less hold is an automatic one — so no
  old row is wrongly labelled.

Answers to the questions below: `eventBy` is always a user id (1); a null means
the system (2); the gate move keeps its own creator (3); the hold's applier was
already stored, only the names are new (4).

The web client reads all of them as of this commit. The fields are typed
optional so a depot on an older API degrades to the id, or to silence, rather
than to `undefined`.

---

The log's whole promise is *"what happened to this box, and who did it"*. It
keeps the first half. Checked against the running API's OpenAPI
(`localhost:5100/openapi/v1.json`, 2026-11-01), here is the second half:

| the log's source | schema | who it names |
|---|---|---|
| registry history | `ContainerHistoryEntryResponse` | **`by` + `byName`** ✅ |
| visit events | `ContainerStoryEventResponse` | `eventBy` — **an id, no name** |
| gate transactions | `GateTransactionResponse` | only `voidedBy` — **nobody for the move itself** |
| holds | `ActiveHoldResponse` | `source`, `applyReason` — **no user at all** |

So one source in four can answer it. On the screen that reads:

```
01-11-2026 16:04  Correction  KTC     Reefer plug session voided (entered by mistake).
30-10-2026 08:50  Registered          by GECKO Admin          ← the only one
28-10-2026 21:20  Gate-in     KTC     EIR-KTC-2610-00137
28-10-2026 21:20  Plugged in  KTC     TEST electricity simulation
```

Somebody voided a plug session and corrected a box's record, and the log cannot
say who. That is the entry an argument is actually about.

## What is asked for

**One shape, the one the API already uses.** `ContainerHistoryEntryResponse`
answers this well — an id and a name beside it — so the ask is to carry the
same pair everywhere the log reads:

```jsonc
// ContainerStoryEventResponse
{ "eventBy": "3f9a1b2c-…",        // as now
  "eventByName": "Natthaphon S."  // NEW — null when the system did it
}

// GateTransactionResponse
{ "createdBy": "…", "createdByName": "…",   // NEW — the clerk who gated it
  "voidedBy": "…",  "voidedByName": "…" }   // voidedBy exists; the name is new

// ActiveHoldResponse  (and whatever answers released holds)
{ "appliedBy": "…", "appliedByName": "…",   // NEW
  "releasedBy": "…", "releasedByName": "…" } // NEW
```

**Null means the system, and only the system.** The screen prints *"System
activity"* for a null, so a null must mean "no person did this" — an automatic
plug-in at the gate, a status the server moved on, an import. It must not mean
"a person did it and we did not keep who", because the log would then credit
people's work to the system and stop being worth reading.

Where the row genuinely has no user recorded at all — old rows written before
the column existed — **send the field as absent rather than null** if that can
be told apart; the screen will say nothing rather than claim either.

**The name is the display name**, as `byName` already does it: what a clerk
calls that person, not an e-mail or a login. The id stays because it is what an
auditor follows.

## Why the screen cannot do this itself

There is no name lookup to call. `/api/users/{userId}/user-name` is a **PUT**
that sets a sign-in name, and `/api/users` is a paged admin list behind an IAM
permission a gate clerk does not hold. So a user id on a screen is a dead end
unless the read that carries it carries the name too — which is exactly why
`byName` exists on the registry history.

## What the screen does in the meantime (shipped with this doc)

- Registry entries: **"by GECKO Admin"**, as before, moved to sit in the same
  place as every other entry's attribution.
- Visit events: `eventByName` when it arrives, **today the id** shortened to
  eight characters with the whole of it on hover, and **"System activity"**
  when `eventBy` is null.
- Gate and hold entries: **nothing**, because the response names nobody and a
  guess would be worse than a gap.

Add the fields and the log fills in; `eventByName` is already optional in the
web client, so nothing on this side needs changing for that one.

## Questions

1. Is `eventBy` on a visit event always a user id, or is it sometimes already a
   name or a service account's label? The screen currently assumes an opaque id.
2. Is a null `eventBy` today "the system", or "we did not record it"? The
   answer decides whether *"System activity"* is honest on existing rows.
3. Does the gate transaction keep the clerk who recorded it, or only the truck
   visit? If it is on the visit, say so and the screen will read it there.
4. Holds: is the applier kept anywhere today, or would that be a new column?
   If it is a new column, old holds will have no user, which is the "absent,
   not null" case above.
