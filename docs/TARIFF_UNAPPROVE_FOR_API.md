# Tariff: unapprove an approved version

Owner's decision, 2026-10-05. KORAKIT is switching the desktop off, and in
Vector a supervisor can take an approved price back. Gecko cannot.

---

## What exists

```
POST /tariffs/{id}/submit     DRAFT    → PENDING
POST /tariffs/{id}/approve    PENDING  → APPROVED      "prices go live and are frozen"
POST /tariffs/{id}/reject     PENDING  → REJECTED
POST /tariffs/{id}/withdraw   DRAFT or PENDING → WITHDRAWN
POST /tariffs/{id}/revise     APPROVED → a new DRAFT version
```

Nothing moves an APPROVED version backwards. `withdraw` is documented as *"a
DRAFT or PENDING tariff"* and refuses one that is approved.

The design is deliberate and we are not arguing with it: an approved price is
one somebody has quoted to a customer, and `revise` is the honest way to change
one. But it does not cover the case the owner means — **a price approved by
mistake**, this morning, that nobody has traded on yet. Today the only way out
is a new version starting tomorrow, which leaves the wrong price live until then.

---

## The ask

```
POST /api/revenue/tariffs/{scheduleId}/unapprove
{ "rowVersion": "AAAA…", "reason": "Approved against the wrong customer" }
→ 200  the schedule, now DRAFT
```

- **APPROVED → DRAFT**, with `reason` required and kept on the audit trail
  beside who did it and when — the detail page already draws that trail and
  would show it.
- **409** when the version is not APPROVED, or the `rowVersion` is stale.
- Perm: the same right that approves (`revenue.tariff.approve`), not the one
  that edits. Unapproving a live price is a supervisor's act.

## Three questions only you can answer

1. **What happens to the version it superseded?** If v2 was approved and
   unapproved, does v1 go back to being in force, or is there simply no active
   tariff for that scope until v2 is approved again? The screen should say which,
   because "no price is live right now" is something a depot needs told.

2. **Is there a point of no return?** Our instinct: refuse once the version has
   actually priced something — once a charge exists that was resolved against
   it. Unapproving a price that has already been billed rewrites history. A 409
   saying *"this version has priced 14 charges"* would be the right refusal.

3. **Does `effectiveFrom` survive?** If v2 was approved to start 01-11 and is
   unapproved on 05-11, it is a draft whose start date is in the past. Keep it
   and let the clerk change it, or clear it?

---

## What the UI does meanwhile

The **Unapprove** button is already on the detail page for anyone who may
approve, and it calls the path above. Until the endpoint exists it reports, in
these words:

> **Unapprove is not built yet** — the API has no unapprove endpoint. Until it
> does, change an approved price with "New version".

So the day this ships the button simply starts working; nothing in the UI needs
changing.

Also shipped on that page, and needing nothing from you: a DRAFT is now approved
in **one press** for a user who holds the approve right — the screen does
submit-then-approve rather than making a supervisor submit a tariff to
themselves and then approve it. A user who may manage but not approve still gets
"Submit for approval".

---

Do not change anything in `D:\SHARMA\PROJECT\gecko\platform`; report API
problems back to the owner.
