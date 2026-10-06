# Tariff: unapprove an approved version — build this

Owner's decision 2026-10-06. KORAKIT is going live and the web UI is already
shipped with the button; only the endpoint is missing. Pressing it today says
"Unapprove is not built yet".

**Verified against the running API 2026-10-06: there is no `unapprove` path.**

```
POST /tariffs/{id}/submit     DRAFT    → PENDING
POST /tariffs/{id}/approve    PENDING  → APPROVED      "prices go live and are frozen"
POST /tariffs/{id}/reject     PENDING  → REJECTED
POST /tariffs/{id}/withdraw   DRAFT or PENDING → WITHDRAWN
POST /tariffs/{id}/revise     APPROVED → a new DRAFT version
```

Nothing moves an APPROVED version backwards. `withdraw` is documented as *"a
DRAFT or PENDING tariff"* and refuses an approved one.

`revise` is the right path for a price that has been traded on. It does **not**
cover the case the owner means: a price approved **by mistake**, minutes ago,
that nobody has used yet. Today the only way out is a new version starting
tomorrow, which leaves the wrong price live until then.

---

## Build

```
POST /api/revenue/tariffs/{scheduleId}/unapprove
{ "rowVersion": "AAAA…", "reason": "Approved against the wrong customer" }
→ 200  the schedule, now DRAFT
```

- **APPROVED → DRAFT.** `reason` required, kept on the audit trail with who did
  it and when — the detail page already draws that trail and will show it.
- **409** when the version is not APPROVED, or `rowVersion` is stale.
- **Permission:** the same right that approves (`revenue.tariff.approve`), not
  the one that edits. Unapproving a live price is a supervisor's act.

## The three decisions, with the answers we suggest

Build to these unless the owner says otherwise — they are chosen so nothing is
lost and nothing silently changes price.

1. **The version it superseded comes back into force.** If v2 is unapproved, v1
   is live again. A depot with no live tariff prices nothing, and a gate that
   cannot price cannot take money — so leaving a scope with no active version is
   worse than restoring the one everybody was working to yesterday. If no earlier
   version exists, say so in the response (`"noActiveVersion": true`) and the
   screen will warn plainly.

2. **Refuse once the version has priced something.** If a charge exists that was
   resolved against this version, unapproving rewrites history on money that has
   already been quoted or taken. Answer **409** naming the count:
   *"This version has priced 14 charges. Use New version instead."* That is the
   line between "approved by mistake" and "approved and used".

3. **`effectiveFrom` is kept as it is.** A draft whose start date is in the past
   is honest about what happened, and the clerk can change it before submitting
   again. Clearing it would quietly lose what the price was meant to do.

## What the UI already does

The **Unapprove** button is live on `/tariff/plans/{id}` for anyone holding the
approve right. It asks for a reason in a proper dialog and calls the path above.
Until the endpoint exists it reports, in these words:

> **Unapprove is not built yet** — the API has no unapprove endpoint. Until it
> does, change an approved price with "New version".

**The day this ships the button starts working. No UI change is needed.** If you
return `noActiveVersion` or the 409 of point 2, tell us and we will show those
specifically.

Also already shipped and needing nothing from you: a DRAFT is approved in **one
press** for a user holding the approve right (the screen does submit-then-approve
itself), and the priced rows can be edited and removed in place through
`PUT /tariffs/{id}/rates`.

---

Do not change anything in `D:\SHARMA\PROJECT\gecko\platform`; report API problems
back to the owner.
